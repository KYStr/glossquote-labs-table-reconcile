import test from 'node:test';
import assert from 'node:assert/strict';
import { serializeResult, OUTPUT_NAMES, OUTPUT_LIMIT } from '../public/js/core/export.mjs';
import { boundaryResult, boundaryOptions } from './boundary-fixture.mjs';

const opts = { keyMode: 'exact', keys: [{ leftColumn: 'id', rightColumn: 'key' }], fields: [{ leftColumn: 'v', rightColumn: 'value' }] };
const decode = bytes => new TextDecoder().decode(bytes);
const fixture = {
  counts: { leftRows: 1, rightRows: 0, same: 0, leftOnly: 1, rightOnly: 0, changed: 0 },
  same: [], leftOnly: [{ key: ['A'], leftRow: 1, left: ['A', 'line\n"quoted"'] }], rightOnly: [], changed: [],
};

test('A17: fixed names and full hand-written JSON schema round trip', () => {
  const output = serializeResult(fixture, opts);
  assert.deepEqual(OUTPUT_NAMES, { json: 'table-reconcile.json', text: 'table-reconcile.txt' });
  assert.deepEqual(JSON.parse(decode(output.json)), {
    schemaVersion: 1, tool: 'table-reconcile',
    options: { keyMode: 'exact', keys: [{ left: 'id', right: 'key' }], fields: [{ left: 'v', right: 'value' }] },
    counts: { leftRows: 1, rightRows: 0, same: 0, leftOnly: 1, rightOnly: 0, changed: 0 },
    same: [], leftOnly: [{ key: ['A'], leftRow: 1, left: ['A', 'line\n"quoted"'] }], rightOnly: [], changed: [],
  });
});
test('TXT has four sections and quotes newlines and control characters unambiguously', () => {
  const text = decode(serializeResult(fixture, opts).text);
  assert.equal(text, [
    'Table reconciliation report', 'Schema version: 1', 'Key mode: exact', 'Keys:', '  "id" <-> "key"',
    'Compared fields:', '  "v" <-> "value"', 'Left rows: 1', 'Right rows: 0', '',
    'same: 0', '', 'leftOnly: 1', '  Key: ["A"]', '  Left data row: 1', '  Left values: ["A","line\\n\\"quoted\\""]', '', 'rightOnly: 0', '', 'changed: 0', '',
  ].join('\n'));
  const hostile = structuredClone(fixture);
  hostile.leftOnly[0].left[1] = '<img src=x onerror=alert(1)>\u0000\t\r\n';
  const output = serializeResult(hostile, opts);
  assert.equal(JSON.parse(decode(output.json)).leftOnly[0].left[1], '<img src=x onerror=alert(1)>\u0000\t\r\n');
  assert.ok(decode(output.text).includes('\\u0000\\t\\r\\n'));
});
test('report includes both full rows, all changed pairs, and ordered same entries', () => {
  const result = {
    counts: { leftRows: 2, rightRows: 2, same: 1, leftOnly: 0, rightOnly: 0, changed: 1 },
    same: [{ key: ['b'], leftRow: 2, rightRow: 1 }], leftOnly: [], rightOnly: [],
    changed: [{ key: ['a'], leftRow: 1, rightRow: 2, left: ['a', '1'], right: ['a', '1.0'], fields: [{ left: 'v', right: 'value', leftValue: '1', rightValue: '1.0' }] }],
  };
  const output = serializeResult(result, opts);
  assert.deepEqual(JSON.parse(decode(output.json)).changed, result.changed);
  assert.ok(decode(output.text).includes('  Field "v" <-> "value": "1" -> "1.0"'));
});

// Independent empty-result oracle: constants are hand-written, not derived from serializer output.
const emptyDocument = {
  schemaVersion: 1, tool: 'table-reconcile',
  options: { keyMode: 'exact', keys: [{ left: 'id', right: 'key' }], fields: [{ left: 'v', right: 'value' }] },
  counts: { leftRows: 0, rightRows: 0, same: 0, leftOnly: 0, rightOnly: 0, changed: 0 },
  same: [], leftOnly: [], rightOnly: [], changed: [],
};
const emptyText = 'Table reconciliation report\nSchema version: 1\nKey mode: exact\nKeys:\n  "id" <-> "key"\nCompared fields:\n  "v" <-> "value"\nLeft rows: 0\nRight rows: 0\n\nsame: 0\n\nleftOnly: 0\n\nrightOnly: 0\n\nchanged: 0\n';
test('A18: exact configurable combined byte boundary accepts, one byte less rejects', () => {
  const encoder = new TextEncoder();
  const expectedBytes = encoder.encode(JSON.stringify(emptyDocument, null, 2) + '\n').length + encoder.encode(emptyText).length;
  const result = { counts: emptyDocument.counts, same: [], leftOnly: [], rightOnly: [], changed: [] };
  const output = serializeResult(result, opts, { maxOutputBytes: expectedBytes });
  assert.equal(output.json.length + output.text.length, expectedBytes);
  assert.throws(() => serializeResult(result, opts, { maxOutputBytes: expectedBytes - 1 }), { code: 'OUTPUT_TOO_LARGE' });
});
test('A18: real 16 MiB cap is enforced on UTF-8 bytes, never truncated', () => {
  assert.equal(OUTPUT_LIMIT, 16_777_216);
  const huge = structuredClone(fixture);
  huge.leftOnly[0].left[1] = '台'.repeat(3_000_000);
  assert.throws(() => serializeResult(huge, opts), { code: 'OUTPUT_TOO_LARGE' });
  assert.throws(() => serializeResult(fixture, opts, { maxOutputBytes: OUTPUT_LIMIT + 1 }), { message: 'INVALID_OUTPUT_LIMIT' });
});
test('A18: exactly 16,777,216 bytes accepts; exactly 16,777,217 rejects', () => {
  const output = serializeResult(boundaryResult(), boundaryOptions);
  assert.equal(output.json.length + output.text.length, 16_777_216);
  assert.throws(() => serializeResult(boundaryResult(true), boundaryOptions), { code: 'OUTPUT_TOO_LARGE' });
});
