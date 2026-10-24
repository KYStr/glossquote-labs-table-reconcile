import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, CsvError } from '../public/js/core/csv.mjs';

const encode = s => new TextEncoder().encode(s);
const parse = s => parseCsv(encode(s));
const error = (text, code, record, column) => assert.throws(() => parse(text), e => e instanceof CsvError && e.code === code && (record === undefined || e.record === record) && (column === undefined || e.column === column));

test('A01: each file independently accepts CRLF, LF or CR, exact strings', () => {
  const expected = { headers: ['id', 'v'], rows: [['001', 'A'], ['002', 'B']] };
  assert.deepEqual(parse('id,v\r\n001,A\r\n002,B'), expected);
  assert.deepEqual(parse('id,v\n001,A\n002,B\n'), expected);
  assert.deepEqual(parse('id,v\r001,A\r002,B\r'), expected);
});
test('A02–A03: escaped quotes, commas and quoted mixed newlines remain exact', () => {
  assert.deepEqual(parse('id,note\r\n1,"a,b"\r\n2,"x""y"').rows, [['1', 'a,b'], ['2', 'x"y']]);
  assert.deepEqual(parse('id,note\r\n1,"a\r\nb"').rows, [['1', 'a\r\nb']]);
  assert.deepEqual(parse('id,note\n1,"a\rb\nc\r\nd"\n').rows, [['1', 'a\rb\nc\r\nd']]);
});
test('A04: quote syntax fails at a fixed record and column; no partial table', () => {
  for (const text of ['id,v\n1,"open', 'id,v\n1,a"b', 'id,v\n1,"x" tail', 'id,v\n1,"x""']) error(text, 'CSV_SYNTAX', 1, 2);
});
test('A05: unequal widths and intermediate blank records are refused', () => {
  error('id,v\n1,A,B', 'ROW_WIDTH', 1);
  error('id,v\n1', 'ROW_WIDTH', 1);
  error('id,v\n\n1,A', 'ROW_WIDTH', 1);
  error('id,v\n1,A\n\n', 'ROW_WIDTH', 2);
});
test('A06: 1 MiB accepts; one extra byte is rejected before decoding', () => {
  const bytes = encode('id\n' + 'x'.repeat(1_048_573));
  assert.equal(bytes.length, 1_048_576);
  assert.equal(parseCsv(bytes).rows[0][0].length, 1_048_573);
  const invalid = new Uint8Array(1_048_577).fill(255);
  assert.throws(() => parseCsv(invalid), { code: 'FILE_TOO_LARGE' });
});
test('A07: headers are exact nonempty unique strings, including hostile property names', () => {
  error('id,id\n1,2', 'HEADER_EMPTY_OR_DUPLICATE', 0, 2);
  error(',value\n1,2', 'HEADER_EMPTY_OR_DUPLICATE', 0, 1);
  assert.deepEqual(parse(' id,id,__proto__\n a ,b,c').headers, [' id', 'id', '__proto__']);
});
test('UTF-8 is fatal; one leading BOM is removed, second BOM is retained', () => {
  assert.throws(() => parseCsv(new Uint8Array([0xc0, 0xaf])), { code: 'INVALID_UTF8' });
  assert.throws(() => parseCsv(new Uint8Array([0xe2, 0x82])), { code: 'INVALID_UTF8' });
  assert.deepEqual(parse('\uFEFFid,v\n001,台灣').rows, [['001', '台灣']]);
  assert.deepEqual(parse('\uFEFF\uFEFFid\n1').headers, ['\uFEFFid']);
});
test('empty, whitespace-only, binary and mixed external separators fail closed', () => {
  for (const text of ['', ' \t\r\n ', '\uFEFF', 'id,v\n1,\0', 'id,v\r\n1,A\n2,B', 'id,v\r1,A\r\n2,B']) error(text, 'CSV_SYNTAX');
});
test('terminators, empty quoted cells, empty trailing cells, header-only', () => {
  assert.deepEqual(parse('id,v\n1,""\n2,').rows, [['1', ''], ['2', '']]);
  assert.deepEqual(parse('id,v\n'), { headers: ['id', 'v'], rows: [] });
  assert.deepEqual(parse('id'), { headers: ['id'], rows: [] });
  assert.deepEqual(parse('"a,b",v\n"1,2",x').headers, ['a,b', 'v']);
});
test('A19–A20: exact row/column caps and first rejected data record', () => {
  assert.equal(parse('id\n' + Array.from({ length: 5000 }, (_, i) => String(i)).join('\n')).rows.length, 5000);
  error('id\n' + Array.from({ length: 5001 }, (_, i) => String(i)).join('\n'), 'TOO_MANY_ROWS', 5001);
  assert.equal(parse(Array.from({ length: 30 }, (_, i) => `c${i}`).join(',')).headers.length, 30);
  error(Array.from({ length: 31 }, (_, i) => `c${i}`).join(','), 'TOO_MANY_COLUMNS', 0, 31);
  error('id\n' + Array(31).fill('v').join(','), 'TOO_MANY_COLUMNS', 1, 31);
});
test('malformed data line is located by logical record even after quoted newlines', () => {
  error('id,v\n1,"a\nb"\n2,"x"z', 'CSV_SYNTAX', 2, 2);
  assert.throws(() => parse('id,v\n1,"a\nb"\n2,"x"z'), e => e.line === 4);
});
test('deterministic generated round trips preserve exact synthetic strings', () => {
  const values = ['', '001', '1.0', '台灣', 'é', 'e\u0301', 'a,b', 'a"b', 'x\r\ny', ' x ', '<img src=x onerror=alert(1)>'];
  const rows = Array.from({ length: 44 }, (_, i) => [String(i), values[i % values.length]]);
  const quote = value => `"${value.replaceAll('"', '""')}"`;
  const csv = [['id', 'v'], ...rows].map(row => row.map(quote).join(',')).join('\r\n');
  assert.deepEqual(parse(csv).rows, rows);
});
test('limits cannot raise hard caps or introduce unknown configuration fields', () => {
  for (const limits of [{ maxBytes: 1_048_577 }, { maxRows: 5001 }, { maxColumns: 31 }, { maxRows: 0 }, { unknown: true }]) assert.throws(() => parseCsv(encode('id'), limits), { message: 'INVALID_CSV_LIMIT' });
});
