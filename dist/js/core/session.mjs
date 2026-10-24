import { parseCsv, CSV_LIMITS } from './csv.mjs';
import { reconcileSteps, validateMappings } from './reconcile.mjs';
import { serializeResult } from './export.mjs';

const freshOptions = () => ({ keys: [{ leftColumn: '', rightColumn: '' }], fields: [], keyMode: 'exact' });
const copyOptions = options => ({ keyMode: options.keyMode, keys: options.keys.map(pair => ({ ...pair })), fields: options.fields.map(pair => ({ ...pair })) });

// This controller owns all data references; its view never persists outside this page.
// Injected URL/Blob/algorithm adapters are used only by offline lifecycle tests.
export function createSession({ urls = globalThis.URL, BlobClass = globalThis.Blob, parse = parseCsv, compare = reconcileSteps, serialize = serializeResult, onChange = () => {} } = {}) {
  const state = {
    phase: 'idle', generation: 0, sourceRevision: 0,
    files: { left: null, right: null }, meta: { left: null, right: null },
    tables: { left: null, right: null }, fileErrors: { left: null, right: null },
    options: freshOptions(), confirmed: false, result: null, downloads: null,
    error: null, notice: null, progress: null, canRun: false, canExport: false,
  };
  let controller = null;
  let output = null;
  const emit = () => onChange(state);
  function releaseDownloads() {
    if (state.downloads) for (const url of Object.values(state.downloads)) urls.revokeObjectURL(url);
    state.downloads = null;
    output = null;
    state.canExport = false;
  }
  function invalidate(phase) {
    state.generation++;
    controller?.abort(); controller = null;
    releaseDownloads();
    state.result = null; state.error = null; state.notice = null; state.progress = null;
    state.phase = phase;
    state.canRun = false;
  }
  function validate() {
    return Boolean(state.tables.left && state.tables.right && state.confirmed && validateMappings(state.tables.left, state.tables.right, state.options).ok);
  }
  function readyPhase(keepStale = false) {
    state.canRun = validate();
    if (!keepStale) state.phase = state.canRun ? 'ready' : 'mapping';
  }
  function publicError(error, side) {
    const codes = ['FILE_TOO_LARGE', 'INVALID_UTF8', 'CSV_SYNTAX', 'ROW_WIDTH', 'HEADER_EMPTY_OR_DUPLICATE', 'TOO_MANY_ROWS', 'TOO_MANY_COLUMNS', 'MAPPING_INVALID', 'KEY_EMPTY', 'KEY_DUPLICATE', 'OUTPUT_TOO_LARGE', 'CANCELLED'];
    const result = { code: codes.includes(error?.code) ? error.code : 'CSV_SYNTAX' };
    if (side === 'left' || side === 'right') result.side = side;
    if (error?.side === 'left' || error?.side === 'right') result.side = error.side;
    for (const key of ['record', 'column', 'line', 'row', 'previousRow']) if (Number.isInteger(error?.[key]) && error[key] >= 0) result[key] = error[key];
    return result;
  }

  async function load(side, file) {
    if (side !== 'left' && side !== 'right') throw new TypeError('INVALID_SIDE');
    const wasResult = state.result !== null || state.phase === 'stale';
    invalidate('loading');
    const generation = state.generation;
    const ownController = new AbortController(); controller = ownController;
    state.files[side] = file;
    state.tables[side] = null; state.fileErrors[side] = null;
    state.meta[side] = file ? { name: String(file.name).slice(0, 1024), size: file.size, loaded: false } : null;
    state.options = freshOptions(); state.confirmed = false; state.sourceRevision++;
    if (wasResult) state.notice = 'stale';
    emit();
    if (!file) { readyPhase(); emit(); return; }
    try {
      if (!Number.isInteger(file.size) || file.size < 0 || file.size > CSV_LIMITS.maxBytes) throw { code: 'FILE_TOO_LARGE' };
      const buffer = await file.arrayBuffer();
      if (ownController.signal.aborted || generation !== state.generation) return;
      const parsed = parse(new Uint8Array(buffer));
      if (ownController.signal.aborted || generation !== state.generation) return;
      state.tables[side] = parsed;
      state.meta[side].loaded = true;
      if (state.tables.left && state.tables.right) {
        const suggestions = state.tables.left.headers.filter(header => state.tables.right.headers.includes(header));
        state.options.fields = suggestions.length ? suggestions.map(header => ({ leftColumn: header, rightColumn: header })) : [{ leftColumn: '', rightColumn: '' }];
      }
      state.sourceRevision++;
      readyPhase();
      if (parsed.rows.length === 0) state.notice = 'empty';
      emit();
    } catch (error) {
      if (ownController.signal.aborted || generation !== state.generation) return;
      state.files[side] = null; state.tables[side] = null;
      state.fileErrors[side] = publicError(error, side);
      state.phase = 'blocked'; state.canRun = false;
      emit();
    } finally { if (controller === ownController) controller = null; }
  }

  function configure(options, confirmed = false) {
    const stale = state.result !== null || state.phase === 'stale';
    invalidate(stale ? 'stale' : 'mapping');
    state.options = copyOptions(options);
    state.confirmed = confirmed;
    readyPhase(stale);
    if (stale) state.notice = 'stale';
    emit();
  }

  async function run() {
    if (!validate()) {
      invalidate('blocked'); state.error = { code: 'MAPPING_INVALID' }; emit(); return;
    }
    invalidate('comparing');
    const generation = state.generation;
    const ownController = new AbortController(); controller = ownController;
    const options = copyOptions(state.options);
    emit();
    const iterator = compare(state.tables.left, state.tables.right, options, { signal: ownController.signal, batchSize: 100 });
    try {
      for (;;) {
        const step = await iterator.next();
        if (ownController.signal.aborted || generation !== state.generation) { await iterator.return(); return; }
        if (step.done) {
          state.result = step.value;
          state.phase = 'result'; state.canRun = true; state.progress = null;
          try { output = serialize(state.result, options); state.canExport = true; }
          catch (error) { releaseDownloads(); state.error = publicError(error); }
          emit(); return;
        }
        state.progress = step.value; emit();
      }
    } catch (error) {
      if (ownController.signal.aborted || generation !== state.generation) return;
      releaseDownloads(); state.result = null; state.progress = null;
      if (error?.code === 'CANCELLED') { readyPhase(); state.notice = 'cancelled'; }
      else { state.phase = 'blocked'; state.error = publicError(error); state.canRun = validate(); }
      emit();
    } finally { if (controller === ownController) controller = null; }
  }

  function prepareDownloads() {
    if (state.phase !== 'result' || !state.result || !state.canExport || !output || state.downloads) return false;
    const created = [];
    try {
      // Both byte arrays have passed their individual + combined size check.
      const json = new BlobClass([output.json], { type: 'application/json;charset=utf-8' });
      const text = new BlobClass([output.text], { type: 'text/plain;charset=utf-8' });
      created.push(urls.createObjectURL(json));
      created.push(urls.createObjectURL(text));
      state.downloads = { json: created[0], text: created[1] };
      output = null;
      emit(); return true;
    } catch {
      for (const url of created) urls.revokeObjectURL(url);
      releaseDownloads(); state.notice = 'downloadFailed'; emit(); return false;
    }
  }

  function cancel() {
    if (state.phase !== 'comparing') return;
    invalidate('mapping'); readyPhase(); state.phase = 'mapping'; state.notice = 'cancelled'; emit();
  }
  function reset() {
    invalidate('idle');
    state.files = { left: null, right: null }; state.meta = { left: null, right: null };
    state.tables = { left: null, right: null }; state.fileErrors = { left: null, right: null };
    state.options = freshOptions(); state.confirmed = false; state.sourceRevision++; emit();
  }
  return Object.freeze({ view: () => state, load, configure, run, cancel, reset, pagehide: reset, prepareDownloads });
}
