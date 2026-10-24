import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv } from '../public/js/core/csv.mjs';
import { reconcileSteps, validateMappings } from '../public/js/core/reconcile.mjs';

const table = text => parseCsv(new TextEncoder().encode(text));
const options = { keys: [{ leftColumn: 'id', rightColumn: 'id' }], fields: [{ leftColumn: 'v', rightColumn: 'v' }], keyMode: 'exact' };
export async function finish(iterator) { for (;;) { const step = await iterator.next(); if (step.done) return step.value; } }
const run = (left, right, opts = options) => finish(reconcileSteps(table(left), table(right), opts));

test('A08: hand-written four-category oracle and exact row provenance', async () => {
  assert.deepEqual(await run('id,v\n001,A\n002,B', 'id,v\n001,A\n003,C'), {
    counts: { leftRows: 2, rightRows: 2, same: 1, leftOnly: 1, rightOnly: 1, changed: 0 },
    same: [{ key: ['001'], leftRow: 1, rightRow: 1 }],
    leftOnly: [{ key: ['002'], leftRow: 2, left: ['002', 'B'] }],
    rightOnly: [{ key: ['003'], rightRow: 2, right: ['003', 'C'] }], changed: [],
  });
});
test('A09/A15: changed rows include all differences and full original rows', async () => {
  const value = await run('id,v\n001,A', 'id,v\n001,X');
  assert.deepEqual(value.changed, [{ key: ['001'], leftRow: 1, rightRow: 1, left: ['001', 'A'], right: ['001', 'X'], fields: [{ left: 'v', right: 'v', leftValue: 'A', rightValue: 'X' }] }]);
  assert.equal((await run('id,v\n001,1', 'id,v\n001,1.0')).counts.changed, 1);
});
test('A10: no number/case/Unicode normalization', async () => {
  for (const [l, r] of [['001', '1'], ['A', 'a'], ['é', 'e\u0301']]) {
    const result = await run(`id,v\n${l},x`, `id,v\n${r},x`);
    assert.deepEqual(result.counts, { leftRows: 1, rightRows: 1, same: 0, leftOnly: 1, rightOnly: 1, changed: 0 });
  }
});
test('A11: tuple encoding cannot collide through delimiters', async () => {
  const result = await run('id,k,v\na|b,c,x', 'id,k,v\na,b|c,x', { ...options, keys: [...options.keys, { leftColumn: 'k', rightColumn: 'k' }] });
  assert.deepEqual(result.leftOnly[0].key, ['a|b', 'c']);
  assert.deepEqual(result.rightOnly[0].key, ['a', 'b|c']);
});
test('A12: either-side duplicate rejects with both data indexes, including unmatched keys', async () => {
  await assert.rejects(run('id,v\nx,A\nx,B', 'id,v\ny,C'), { code: 'KEY_DUPLICATE', side: 'left', row: 2, previousRow: 1 });
  await assert.rejects(run('id,v\ny,A', 'id,v\nx,B\nx,C'), { code: 'KEY_DUPLICATE', side: 'right', row: 2, previousRow: 1 });
});
test('A13: trim revalidates uniqueness and never changes stored values', async () => {
  await assert.rejects(run('id,v\nx,A\n x ,B', 'id,v\nx,A', { ...options, keyMode: 'trim' }), { code: 'KEY_DUPLICATE', row: 2 });
  const exact = await run('id,v\nx,A\n x ,B', 'id,v\nx,A');
  assert.deepEqual(exact.leftOnly[0].left, [' x ', 'B']);
  const trimmed = await run('id,v\n x ,A', 'id,v\nx,A', { ...options, keyMode: 'trim', fields: options.keys });
  assert.deepEqual(trimmed.changed[0].key, ['x']);
  assert.deepEqual(trimmed.changed[0].left, [' x ', 'A']);
  assert.deepEqual(trimmed.changed[0].fields, [{ left: 'id', right: 'id', leftValue: ' x ', rightValue: 'x' }]);
});
test('A14: every tuple member must be nonempty (including after trim)', async () => {
  await assert.rejects(run('id,v\n"",A', 'id,v\nx,A'), { code: 'KEY_EMPTY', side: 'left', row: 1, column: 1 });
  await assert.rejects(run('id,v\nx,A', 'id,v\n   ,A', { ...options, keyMode: 'trim' }), { code: 'KEY_EMPTY', side: 'right', row: 1 });
  assert.equal((await run('id,v\n   ,A', 'id,v\n   ,A')).counts.same, 1);
});
test('A16: hostile cell text and __proto__ header remain unexecuted strings', async () => {
  const value = '<img src=x onerror=alert(1)>';
  const result = await run(`id,v\nx,${value}`, 'id,v\nx,y');
  assert.equal(result.changed[0].left[1], value);
  const mapped = { keys: [{ leftColumn: '__proto__', rightColumn: 'key' }], fields: [{ leftColumn: 'v', rightColumn: 'value' }], keyMode: 'exact' };
  assert.equal((await run('__proto__,v\nx,A', 'key,value\nx,A', mapped)).counts.same, 1);
});
test('mapping is explicit and one-to-one within each group; cross-group reuse is valid', () => {
  const l = table('id,v\nx,A'); const r = table('id,v\nx,A');
  assert.deepEqual(validateMappings(l, r, options), { ok: true });
  assert.deepEqual(validateMappings(l, r, { ...options, fields: options.keys }), { ok: true });
  for (const invalid of [
    { ...options, keys: [] }, { ...options, fields: [] }, { ...options, keyMode: 'numeric' },
    { ...options, keys: [options.keys[0], options.keys[0]] },
    { ...options, fields: [{ leftColumn: 'id', rightColumn: 'v' }, { leftColumn: 'v', rightColumn: 'v' }] },
    { ...options, keys: [{ leftColumn: 'missing', rightColumn: 'id' }] },
    { ...options, extra: true }, { ...options, keys: [{ ...options.keys[0], extra: 'x' }] },
  ]) assert.equal(validateMappings(l, r, invalid).ok, false);
  assert.equal(validateMappings({ headers: ['id'], rows: [[1]] }, r, options).ok, false);
  assert.equal(validateMappings({ headers: ['id', 'v'], rows: [new Array(2)] }, r, options).ok, false);
});
test('classification preserves left order, then right-only order, and covers both sides once', async () => {
  const result = await run('id,v\nb,B\na,A\nc,C\nd,D', 'id,v\ne,E\nc,X\na,A\nf,F');
  assert.deepEqual(result.same.map(x => x.key), [['a']]);
  assert.deepEqual(result.leftOnly.map(x => x.key), [['b'], ['d']]);
  assert.deepEqual(result.rightOnly.map(x => x.key), [['e'], ['f']]);
  assert.deepEqual(result.changed.map(x => x.key), [['c']]);
  const leftRows = [...result.same, ...result.changed, ...result.leftOnly].map(x => x.leftRow).sort();
  const rightRows = [...result.same, ...result.changed, ...result.rightOnly].map(x => x.rightRow).sort();
  assert.deepEqual(leftRows, [1, 2, 3, 4]); assert.deepEqual(rightRows, [1, 2, 3, 4]);
});
test('empty sides give complete zero-count sections and right-only rows', async () => {
  assert.deepEqual((await run('id,v', 'id,v')).counts, { leftRows: 0, rightRows: 0, same: 0, leftOnly: 0, rightOnly: 0, changed: 0 });
  assert.deepEqual((await run('id,v', 'id,v\nx,A')).rightOnly, [{ key: ['x'], rightRow: 1, right: ['x', 'A'] }]);
});
test('A21: actual task yield at 100/201; abort returns no result or partial arrays', async () => {
  const rows = Array.from({ length: 201 }, (_, i) => [String(i), 'A']);
  const data = { headers: ['id', 'v'], rows };
  const abort = new AbortController();
  const iterator = reconcileSteps(data, data, options, { signal: abort.signal, batchSize: 100 });
  let taskRan = false; setTimeout(() => { taskRan = true; }, 0);
  assert.deepEqual(await iterator.next(), { done: false, value: { stage: 'left-index', processed: 100, total: 201 } });
  assert.equal(taskRan, true);
  abort.abort();
  await assert.rejects(iterator.next(), e => e.code === 'CANCELLED' && !('result' in e) && !('same' in e));
  assert.deepEqual(await iterator.next(), { value: undefined, done: true });
});
test('abort while a chunk is yielding and before first work both reject', async () => {
  const data = table('id,v\nx,A');
  const abort = new AbortController();
  const iterator = reconcileSteps(data, data, options, { signal: abort.signal });
  const pending = iterator.next(); abort.abort();
  await assert.rejects(pending, { code: 'CANCELLED' });
  const pre = new AbortController(); pre.abort();
  await assert.rejects(reconcileSteps(data, data, options, { signal: pre.signal }).next(), { code: 'CANCELLED' });
});
test('three-key mappings accept different column names and reject a fourth pair', async () => {
  const opts = { keyMode: 'exact', keys: [{ leftColumn: 'a', rightColumn: 'x' }, { leftColumn: 'b', rightColumn: 'y' }, { leftColumn: 'c', rightColumn: 'z' }], fields: [{ leftColumn: 'v', rightColumn: 'value' }] };
  const left = table('a,b,c,v\n1,2,3,old'); const right = table('x,y,z,value\n1,2,3,new');
  assert.deepEqual((await finish(reconcileSteps(left, right, opts))).changed[0].key, ['1', '2', '3']);
  assert.equal(validateMappings(left, right, { ...opts, keys: [...opts.keys, { leftColumn: 'v', rightColumn: 'value' }] }).ok, false);
});
test('201 rows finish across real bounded batches, with no duplicate coverage', async () => {
  const rows = Array.from({ length: 201 }, (_, i) => [String(i), String(i)]);
  const iterator = reconcileSteps({ headers: ['id', 'v'], rows }, { headers: ['id', 'v'], rows }, options);
  const progress = []; let result;
  for (;;) { const step = await iterator.next(); if (step.done) { result = step.value; break; } progress.push(step.value); }
  for (const stage of ['left-index', 'right-index', 'compare-left', 'compare-right']) assert.deepEqual(progress.filter(x => x.stage === stage).map(x => x.processed), [100, 200, 201]);
  assert.equal(result.counts.same, 201); assert.equal(new Set(result.same.map(row => row.leftRow)).size, 201); assert.equal(new Set(result.same.map(row => row.rightRow)).size, 201);
});
