import { ToolError } from './errors.mjs';

export const CSV_LIMITS = Object.freeze({ maxBytes: 1_048_576, maxRows: 5_000, maxColumns: 30 });
export class CsvError extends ToolError {
  constructor(code, record = 0, column = 1, line = 1) {
    super(code, { record, column, line });
    this.name = 'CsvError';
  }
}

export function parseCsv(bytes, limits = {}) {
  if (!limits || Object.keys(limits).some(key => !Object.hasOwn(CSV_LIMITS, key))) throw new TypeError('INVALID_CSV_LIMIT');
  const settings = { ...CSV_LIMITS, ...limits };
  for (const [key, ceiling] of Object.entries(CSV_LIMITS)) {
    if (!Number.isInteger(settings[key]) || settings[key] < 1 || settings[key] > ceiling) throw new TypeError('INVALID_CSV_LIMIT');
  }
  if (!(bytes instanceof Uint8Array)) throw new TypeError('BYTE_INPUT_REQUIRED');
  // The size gate deliberately precedes TextDecoder construction/decoding.
  if (bytes.byteLength > settings.maxBytes) throw new CsvError('FILE_TOO_LARGE');
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { throw new CsvError('INVALID_UTF8'); }
  if (text.startsWith('\uFEFF')) text = text.slice(1);
  if (text.trim() === '') throw new CsvError('CSV_SYNTAX');

  const rows = [];
  let headers = null;
  let fields = [];
  let chunks = [];
  let state = 'fieldStart';
  let start = 0;
  let line = 1;
  let separator = null;
  const record = () => headers === null ? 0 : rows.length + 1;
  const fail = code => { throw new CsvError(code, record(), fields.length + 1, line); };
  function finishField(end) {
    if (fields.length >= settings.maxColumns) fail('TOO_MANY_COLUMNS');
    if (state !== 'afterQuote') chunks.push(text.slice(start, end));
    fields.push(chunks.join(''));
    chunks = [];
  }
  function finishRecord() {
    if (headers === null) {
      const seen = new Set();
      for (let i = 0; i < fields.length; i++) {
        if (fields[i] === '' || seen.has(fields[i])) throw new CsvError('HEADER_EMPTY_OR_DUPLICATE', 0, i + 1, line);
        seen.add(fields[i]);
      }
      headers = fields;
    } else {
      if (fields.length !== headers.length) throw new CsvError('ROW_WIDTH', record(), fields.length, line);
      if (rows.length >= settings.maxRows) fail('TOO_MANY_ROWS');
      rows.push(fields);
    }
    fields = [];
  }
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const code = text.charCodeAt(i);
    if (code < 32 && char !== '\t' && char !== '\r' && char !== '\n' || code === 127) fail('CSV_SYNTAX');
    if (state === 'quoted') {
      if (char === '"') {
        chunks.push(text.slice(start, i));
        if (text[i + 1] === '"') { chunks.push('"'); i++; start = i + 1; }
        else state = 'afterQuote';
      } else if (char === '\r' || char === '\n' && text[i - 1] !== '\r') line++;
      continue;
    }
    if (char === '\r' || char === '\n') {
      const currentSeparator = char === '\r' && text[i + 1] === '\n' ? '\r\n' : char;
      if (separator !== null && separator !== currentSeparator) fail('CSV_SYNTAX');
      separator = currentSeparator;
      finishField(i);
      finishRecord();
      if (currentSeparator === '\r\n') i++;
      start = i + 1;
      state = 'fieldStart';
      line++;
    } else if (char === ',') {
      finishField(i);
      start = i + 1;
      state = 'fieldStart';
    } else if (state === 'afterQuote') fail('CSV_SYNTAX');
    else if (char === '"') {
      if (state !== 'fieldStart') fail('CSV_SYNTAX');
      state = 'quoted';
      start = i + 1;
    } else state = 'unquoted';
  }
  if (state === 'quoted') fail('CSV_SYNTAX');
  // Exactly one final terminator closes its record without adding another.
  if (start < text.length || fields.length || state !== 'fieldStart') {
    finishField(text.length);
    finishRecord();
  }
  return { headers, rows };
}
