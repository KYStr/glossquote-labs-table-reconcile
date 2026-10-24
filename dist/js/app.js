import { COPY } from './i18n.mjs';
import { createSession } from './core/session.mjs';
import { validateMappings } from './core/reconcile.mjs';
import { OUTPUT_NAMES } from './core/export.mjs';

const language = document.documentElement.lang === 'en' ? 'en' : 'zh-TW';
const m = COPY[language];
const number = new Intl.NumberFormat(language);
const fmt = value => number.format(value);
const byId = id => document.getElementById(id);
const categories = ['same', 'leftOnly', 'rightOnly', 'changed'];
const pageSize = 50;
let category = 'changed';
let page = 0;
let lastResult = null;
let lastSourceRevision = -1;
let rebuildMapping = true;
let announcement = '';

function node(tag, text, className) {
  const result = document.createElement(tag);
  if (text !== undefined) result.textContent = text;
  if (className) result.className = className;
  return result;
}
function valueNode(value) {
  const text = JSON.stringify(value);
  if (text.length <= 160) return node('pre', text, 'cell-value');
  const detail = node('details');
  detail.append(node('summary', `${text.slice(0, 120)}…`), node('pre', text, 'cell-value'));
  return detail;
}
function errorText(error) {
  const parts = [];
  if (error.side) parts.push(m[error.side]);
  if (error.previousRow !== undefined) parts.push(`${m.location.record} ${fmt(error.previousRow)}, ${fmt(error.row)}`);
  else if (error.row !== undefined) parts.push(`${m.location.record} ${fmt(error.row)}`);
  else if (error.record !== undefined) parts.push(error.record === 0 ? m.location.header : `${m.location.record} ${fmt(error.record)}`);
  if (error.column !== undefined) {
    const header = error.side ? session.view().tables[error.side]?.headers[error.column - 1] : undefined;
    parts.push(`${m.location.column} ${fmt(error.column)}${header === undefined ? '' : ` ${JSON.stringify(header)}`}`);
  }
  if (error.line !== undefined) parts.push(`${m.location.line} ${fmt(error.line)}`);
  return `${parts.length ? parts.join(' · ') + ' — ' : ''}${m.errors[error.code] || m.errors.CSV_SYNTAX}`;
}
function say(text) {
  if (text !== announcement) { byId('status').textContent = text; announcement = text; }
}
function optionsChanged(options, confirmed = false) { session.configure(options, confirmed); }

function mappingRow(section, pair, index, state) {
  const row = node('div', undefined, 'mapping-row');
  for (const side of ['left', 'right']) {
    const key = `${side}Column`;
    const label = node('label', m.pairLabel(section, m[side], fmt(index + 1)));
    const select = node('select');
    select.id = `${section}-${side}-${index}`;
    label.htmlFor = select.id;
    select.setAttribute('aria-describedby', `${section === 'keys' ? 'key-help' : 'field-help'} mapping-feedback work-error`);
    const placeholder = node('option', m.selectColumn); placeholder.value = ''; select.append(placeholder);
    for (const header of state.tables[side].headers) {
      const option = node('option', JSON.stringify(header)); option.value = header; select.append(option);
    }
    select.value = pair[key];
    select.addEventListener('change', () => {
      const options = structuredClone(session.view().options);
      options[section][index][key] = select.value;
      optionsChanged(options);
    });
    label.append(select); row.append(label);
  }
  const remove = node('button', m.remove, 'quiet'); remove.type = 'button';
  remove.setAttribute('aria-label', `${m.remove} · ${section === 'keys' ? m.key : m.compareHeading} ${fmt(index + 1)}`);
  remove.addEventListener('click', () => {
    const options = structuredClone(session.view().options);
    options[section].splice(index, 1);
    rebuildMapping = true; optionsChanged(options);
    byId(section === 'keys' ? 'add-key' : 'add-field').focus();
  });
  row.append(remove); return row;
}

function renderMappings(state) {
  const both = Boolean(state.tables.left && state.tables.right);
  byId('mapping-content').hidden = !both;
  byId('mapping-empty').hidden = both;
  byId('mapping-controls').disabled = !both || state.phase === 'loading';
  if (both && (rebuildMapping || lastSourceRevision !== state.sourceRevision)) {
    byId('key-pairs').replaceChildren(...state.options.keys.map((pair, index) => mappingRow('keys', pair, index, state)));
    byId('field-pairs').replaceChildren(...state.options.fields.map((pair, index) => mappingRow('fields', pair, index, state)));
    renderSamples(state);
    rebuildMapping = false;
  }
  if (!both) {
    for (const id of ['key-pairs', 'field-pairs', 'sample-left', 'sample-right']) byId(id).replaceChildren();
    rebuildMapping = true;
  }
  lastSourceRevision = state.sourceRevision;
  byId('add-key').disabled = state.options.keys.length >= 3;
  byId('add-field').disabled = !both || state.options.fields.length >= Math.min(state.tables.left.headers.length, state.tables.right.headers.length);
  byId('key-mode').value = state.options.keyMode;
  byId('confirm-mapping').checked = state.confirmed;
  if (both) {
    const valid = validateMappings(state.tables.left, state.tables.right, state.options).ok;
    byId('mapping-feedback').textContent = valid ? (state.confirmed ? m.ready : m.mapUnconfirmed) : m.mapInvalid;
  } else byId('mapping-feedback').textContent = '';
  for (const select of document.querySelectorAll('#key-pairs select')) select.setAttribute('aria-invalid', String(['KEY_EMPTY', 'KEY_DUPLICATE'].includes(state.error?.code)));
}
function renderSamples(state) {
  for (const side of ['left', 'right']) {
    const data = state.tables[side];
    const region = node('div', undefined, 'table-region');
    region.setAttribute('role', 'region'); region.setAttribute('aria-label', `${m[side]} · ${m.samples}`); region.tabIndex = 0;
    const table = node('table'); table.append(node('caption', m[`${side}File`]));
    const head = node('thead'); const header = node('tr');
    for (const text of [m.header, m.firstRow]) { const th = node('th', text); th.scope = 'col'; header.append(th); }
    head.append(header); table.append(head);
    const body = node('tbody');
    data.headers.forEach((name, index) => {
      const tr = node('tr'); const th = node('th'); th.scope = 'row'; th.append(valueNode(name));
      const td = node('td'); td.append(data.rows.length ? valueNode(data.rows[0][index]) : node('span', m.noRows));
      tr.append(th, td); body.append(tr);
    });
    table.append(body); region.append(table); byId(`sample-${side}`).replaceChildren(region);
  }
}
function sourceDetails(entry, state) {
  const details = node('details', undefined, 'row-detail'); details.append(node('summary', m.allValues));
  const list = node('dl', undefined, 'field-diff');
  for (const side of ['left', 'right']) {
    const rowIndex = entry[`${side}Row`];
    if (rowIndex === undefined) continue;
    const table = state.tables[side];
    const values = entry[side] || table.rows[rowIndex - 1];
    table.headers.forEach((header, index) => {
      list.append(node('dt', `${m[side]} · ${JSON.stringify(header)}`));
      const value = node('dd'); value.append(valueNode(values[index])); list.append(value);
    });
  }
  details.append(list); return details;
}
function renderResultRows(state) {
  const result = state.result;
  if (!result) { byId('result-table').replaceChildren(); return; }
  const entries = result[category];
  const pageCount = Math.max(1, Math.ceil(entries.length / pageSize));
  page = Math.min(page, pageCount - 1);
  byId('prev').disabled = page === 0;
  byId('next').disabled = page + 1 >= pageCount;
  byId('page-position').textContent = m.page(fmt(entries.length ? page * pageSize + 1 : 0), fmt(Math.min(entries.length, (page + 1) * pageSize)), fmt(entries.length));
  if (!entries.length) { byId('result-table').replaceChildren(node('p', `${m[category]}: ${fmt(0)} · ${m.noMatches}`, 'empty')); return; }
  const table = node('table'); table.append(node('caption', `${m[category]} · ${fmt(entries.length)}`));
  const head = node('thead'); const tr = node('tr');
  for (const label of [m.key, m.leftRow, m.rightRow, m.detail]) { const th = node('th', label); th.scope = 'col'; tr.append(th); }
  head.append(tr); table.append(head);
  const body = node('tbody');
  for (const entry of entries.slice(page * pageSize, (page + 1) * pageSize)) {
    const row = node('tr');
    const key = node('th'); key.scope = 'row'; key.append(valueNode(entry.key)); row.append(key);
    row.append(node('td', entry.leftRow === undefined ? '—' : fmt(entry.leftRow), 'data'), node('td', entry.rightRow === undefined ? '—' : fmt(entry.rightRow), 'data'));
    const cell = node('td');
    if (category === 'same') cell.append(node('p', m.sameValues));
    const fields = entry.fields || (category === 'same' ? state.options.fields.map(pair => ({ left: pair.leftColumn, right: pair.rightColumn,
      leftValue: state.tables.left.rows[entry.leftRow - 1][state.tables.left.headers.indexOf(pair.leftColumn)],
      rightValue: state.tables.right.rows[entry.rightRow - 1][state.tables.right.headers.indexOf(pair.rightColumn)] })) : []);
    if (fields.length) {
      const list = node('dl', undefined, 'field-diff');
      for (const field of fields) {
        list.append(node('dt', `${JSON.stringify(field.left)} ↔ ${JSON.stringify(field.right)}`));
        for (const side of ['left', 'right']) { const dd = node('dd'); dd.append(node('span', `${m[side]}: `), valueNode(field[`${side}Value`])); list.append(dd); }
      }
      cell.append(list);
    }
    cell.append(sourceDetails(entry, state)); row.append(cell); body.append(row);
  }
  table.append(body); byId('result-table').replaceChildren(table);
}
function renderResults(state) {
  const resultChanged = state.result !== lastResult;
  if (resultChanged) {
    page = 0;
    if (state.result) category = ['changed', 'leftOnly', 'rightOnly', 'same'].find(name => state.result.counts[name] > 0) || 'same';
  }
  for (const name of categories) {
    const button = document.querySelector(`[data-category="${name}"]`);
    button.disabled = !state.result;
    button.setAttribute('aria-pressed', String(Boolean(state.result && category === name)));
    byId(`count-${name}`).textContent = fmt(state.result?.counts[name] || 0);
  }
  byId('result-summary').textContent = state.result ? m.success(Object.fromEntries(Object.entries(state.result.counts).map(([k, v]) => [k, fmt(v)]))) : (state.phase === 'stale' ? m.stale : m.resultEmpty);
  byId('result-content').hidden = !state.result;
  byId('export-controls').hidden = !state.result;
  if (resultChanged) renderResultRows(state);
  lastResult = state.result;
  byId('prepare').hidden = Boolean(state.downloads);
  byId('prepare').disabled = !state.canExport;
  for (const kind of ['json', 'text']) {
    const anchor = byId(`download-${kind}`);
    anchor.download = OUTPUT_NAMES[kind];
    if (state.downloads?.[kind]) { anchor.href = state.downloads[kind]; anchor.hidden = false; }
    else { anchor.removeAttribute('href'); anchor.hidden = true; }
  }
}
function render(state) {
  for (const side of ['left', 'right']) {
    const input = byId(`file-${side}`); input.disabled = state.phase === 'loading';
    input.setAttribute('aria-invalid', String(Boolean(state.fileErrors[side])));
    const meta = state.meta[side];
    byId(`meta-${side}`).textContent = !meta ? m.noFile : `${meta.name}\n${meta.loaded ? m.meta(fmt(meta.size), fmt(state.tables[side].rows.length), fmt(state.tables[side].headers.length)) : `${fmt(meta.size)} bytes`}`;
    byId(`error-${side}`).textContent = state.fileErrors[side] ? errorText(state.fileErrors[side]) : '';
  }
  renderMappings(state);
  byId('run').disabled = !state.canRun || state.phase === 'loading' || state.phase === 'comparing';
  byId('run').textContent = state.phase === 'stale' || state.result ? m.rerun : m.run;
  byId('run').setAttribute('aria-busy', String(state.phase === 'comparing'));
  byId('cancel').hidden = state.phase !== 'comparing';
  byId('progress').hidden = !state.progress;
  if (state.progress) { byId('progress').max = Math.max(1, state.progress.total); byId('progress').value = state.progress.processed; }
  byId('error-box').hidden = !state.error;
  byId('work-error').textContent = state.error ? errorText(state.error) : '';
  byId('key-summary').textContent = '';
  if (state.error?.code === 'KEY_DUPLICATE' && state.tables[state.error.side]) {
    const table = state.tables[state.error.side]; const values = table.rows[state.error.row - 1];
    const tuple = state.options.keys.map(pair => { const value = values[table.headers.indexOf(pair[`${state.error.side}Column`])]; return (state.options.keyMode === 'trim' ? value.trim() : value).slice(0, 72); });
    byId('key-summary').textContent = m.keySummary(JSON.stringify(tuple).slice(0, 256));
  }
  let status = m.idle;
  if (state.error) status = errorText(state.error);
  else if (state.fileErrors.left || state.fileErrors.right) status = errorText(state.fileErrors.left || state.fileErrors.right);
  else if (state.phase === 'comparing') status = state.progress ? m.progress(m.stages[state.progress.stage], fmt(state.progress.processed), fmt(state.progress.total)) : m.comparing;
  else if (state.phase === 'loading') status = m.loading;
  else if (state.notice) status = state.notice === 'empty' ? m.noRows : m[state.notice];
  else if (state.result) status = m.success(Object.fromEntries(Object.entries(state.result.counts).map(([k, v]) => [k, fmt(v)])));
  else if (state.phase === 'ready') status = m.ready;
  else if (state.phase === 'mapping') status = m.mappingState;
  say(status);
  renderResults(state);
}

const session = createSession({ onChange: render });
for (const side of ['left', 'right']) byId(`file-${side}`).addEventListener('change', () => {
  const input = byId(`file-${side}`); const file = input.files?.[0] || null;
  input.value = ''; void session.load(side, file);
});
for (const section of ['keys', 'fields']) byId(section === 'keys' ? 'add-key' : 'add-field').addEventListener('click', () => {
  const options = structuredClone(session.view().options);
  options[section].push({ leftColumn: '', rightColumn: '' });
  rebuildMapping = true; optionsChanged(options);
});
byId('key-mode').addEventListener('change', () => optionsChanged({ ...session.view().options, keyMode: byId('key-mode').value }));
byId('confirm-mapping').addEventListener('change', () => optionsChanged(session.view().options, byId('confirm-mapping').checked));
byId('run').addEventListener('click', () => { void session.run(); });
byId('cancel').addEventListener('click', session.cancel);
byId('reset').addEventListener('click', () => { session.reset(); for (const side of ['left', 'right']) byId(`file-${side}`).value = ''; });
byId('prepare').addEventListener('click', session.prepareDownloads);
for (const name of categories) document.querySelector(`[data-category="${name}"]`).addEventListener('click', () => { category = name; page = 0; renderResults(session.view()); renderResultRows(session.view()); });
byId('prev').addEventListener('click', () => { page--; renderResultRows(session.view()); });
byId('next').addEventListener('click', () => { page++; renderResultRows(session.view()); });
window.addEventListener('pagehide', session.pagehide);
render(session.view());
if (typeof File === 'undefined' || typeof Blob === 'undefined' || typeof TextDecoder === 'undefined' || typeof TextEncoder === 'undefined' || typeof structuredClone === 'undefined' || typeof AbortController === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
  for (const side of ['left', 'right']) byId(`file-${side}`).disabled = true;
  say(m.unsupported);
}
