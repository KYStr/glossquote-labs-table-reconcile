// Serializer-only synthetic stress fixtures. The independently written empty-key
// JSON + TXT layouts total 938 (two same rows) or 797 (one same row) bytes.
// Adding one ASCII character to the first key adds one byte in each file.
export const boundaryOptions = { keyMode: 'exact', keys: [{ leftColumn: 'id', rightColumn: 'key' }], fields: [{ leftColumn: 'v', rightColumn: 'value' }] };
export function boundaryResult(over = false) {
  const n = over ? 1 : 2;
  const keyLength = over ? 8_388_210 : 8_388_139;
  return {
    counts: { leftRows: n, rightRows: n, same: n, leftOnly: 0, rightOnly: 0, changed: 0 },
    same: [{ key: ['A'.repeat(keyLength)], leftRow: 1, rightRow: 1 }, ...(over ? [] : [{ key: ['B'], leftRow: 2, rightRow: 2 }])],
    leftOnly: [], rightOnly: [], changed: [],
  };
}
