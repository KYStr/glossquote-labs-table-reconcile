import { ToolError } from './errors.mjs';
import { CSV_LIMITS } from './csv.mjs';

function validTable(table) {
  return table && Object.keys(table).length === 2 && Array.isArray(table.headers) && Array.isArray(table.rows)
    && table.headers.length > 0 && table.headers.length <= CSV_LIMITS.maxColumns
    && Array.from(table.headers).every(h => typeof h === 'string' && h !== '') && new Set(table.headers).size === table.headers.length
    && table.rows.length <= CSV_LIMITS.maxRows
    && Array.from(table.rows).every(row => Array.isArray(row) && row.length === table.headers.length && Array.from(row).every(v => typeof v === 'string'));
}

export function validateMappings(left, right, options) {
  const issues = [];
  const issue = (section, reason, pair) => issues.push({ code: 'MAPPING_INVALID', section, reason, ...(pair === undefined ? {} : { pair }) });
  if (!validTable(left) || !validTable(right)) return { ok: false, issues: [{ code: 'MAPPING_INVALID', section: 'table', reason: 'TABLE_INVALID' }] };
  if (!options || Object.keys(options).some(k => !['keys', 'fields', 'keyMode'].includes(k)) || !['exact', 'trim'].includes(options.keyMode)) issue('options', 'OPTIONS_INVALID');
  for (const section of ['keys', 'fields']) {
    const pairs = options?.[section];
    if (!Array.isArray(pairs) || pairs.length < 1 || pairs.length > (section === 'keys' ? 3 : 30)) { issue(section, 'PAIR_COUNT'); continue; }
    const usedLeft = new Set();
    const usedRight = new Set();
    pairs.forEach((pair, index) => {
      if (!pair || Object.keys(pair).length !== 2 || !Object.hasOwn(pair, 'leftColumn') || !Object.hasOwn(pair, 'rightColumn')
        || typeof pair.leftColumn !== 'string' || typeof pair.rightColumn !== 'string'
        || !left.headers.includes(pair.leftColumn) || !right.headers.includes(pair.rightColumn)) { issue(section, 'COLUMN_UNKNOWN', index + 1); return; }
      if (usedLeft.has(pair.leftColumn) || usedRight.has(pair.rightColumn)) issue(section, 'COLUMN_REUSED', index + 1);
      usedLeft.add(pair.leftColumn);
      usedRight.add(pair.rightColumn);
    });
  }
  return issues.length ? { ok: false, issues } : { ok: true };
}

export async function* reconcileSteps(left, right, options, { signal, batchSize = 100 } = {}) {
  if (!validateMappings(left, right, options).ok) throw new ToolError('MAPPING_INVALID');
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100) throw new ToolError('MAPPING_INVALID');
  const checkAbort = () => { if (signal?.aborted) throw new ToolError('CANCELLED'); };
  const taskYield = () => new Promise(resolve => setTimeout(resolve, 0));
  const keyIndices = {
    left: options.keys.map(pair => left.headers.indexOf(pair.leftColumn)),
    right: options.keys.map(pair => right.headers.indexOf(pair.rightColumn)),
  };
  const fieldIndices = options.fields.map(pair => ({ ...pair, li: left.headers.indexOf(pair.leftColumn), ri: right.headers.indexOf(pair.rightColumn) }));
  const indexes = { left: new Map(), right: new Map() };
  checkAbort();
  for (const side of ['left', 'right']) {
    const table = side === 'left' ? left : right;
    for (let i = 0; i < table.rows.length; i++) {
      checkAbort();
      const tuple = keyIndices[side].map(column => options.keyMode === 'trim' ? table.rows[i][column].trim() : table.rows[i][column]);
      const emptyColumn = tuple.indexOf('');
      if (emptyColumn !== -1) throw new ToolError('KEY_EMPTY', { side, row: i + 1, column: keyIndices[side][emptyColumn] + 1 });
      const encoded = JSON.stringify(tuple);
      if (indexes[side].has(encoded)) throw new ToolError('KEY_DUPLICATE', { side, row: i + 1, previousRow: indexes[side].get(encoded).row });
      indexes[side].set(encoded, { row: i + 1, tuple, values: table.rows[i] });
      if ((i + 1) % batchSize === 0 || i + 1 === table.rows.length) {
        await taskYield();
        checkAbort();
        yield { stage: `${side}-index`, processed: i + 1, total: table.rows.length };
        checkAbort();
      }
    }
  }
  const result = {
    counts: { leftRows: left.rows.length, rightRows: right.rows.length, same: 0, leftOnly: 0, rightOnly: 0, changed: 0 },
    same: [], leftOnly: [], rightOnly: [], changed: [],
  };
  let processed = 0;
  for (const [encoded, lref] of indexes.left) {
    checkAbort();
    const rref = indexes.right.get(encoded);
    if (!rref) result.leftOnly.push({ key: lref.tuple, leftRow: lref.row, left: lref.values });
    else {
      const fields = [];
      for (const pair of fieldIndices) {
        if (lref.values[pair.li] !== rref.values[pair.ri]) fields.push({ left: pair.leftColumn, right: pair.rightColumn, leftValue: lref.values[pair.li], rightValue: rref.values[pair.ri] });
      }
      if (fields.length === 0) result.same.push({ key: lref.tuple, leftRow: lref.row, rightRow: rref.row });
      else result.changed.push({ key: lref.tuple, leftRow: lref.row, rightRow: rref.row, left: lref.values, right: rref.values, fields });
    }
    processed++;
    if (processed % batchSize === 0 || processed === left.rows.length) {
      await taskYield(); checkAbort();
      yield { stage: 'compare-left', processed, total: left.rows.length };
      checkAbort();
    }
  }
  processed = 0;
  for (const [encoded, rref] of indexes.right) {
    checkAbort();
    if (!indexes.left.has(encoded)) result.rightOnly.push({ key: rref.tuple, rightRow: rref.row, right: rref.values });
    processed++;
    if (processed % batchSize === 0 || processed === right.rows.length) {
      await taskYield(); checkAbort();
      yield { stage: 'compare-right', processed, total: right.rows.length };
      checkAbort();
    }
  }
  checkAbort();
  for (const category of ['same', 'leftOnly', 'rightOnly', 'changed']) result.counts[category] = result[category].length;
  return result;
}
