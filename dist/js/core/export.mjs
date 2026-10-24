import { ToolError } from './errors.mjs';

export const OUTPUT_LIMIT = 16 * 1024 * 1024;
export const OUTPUT_NAMES = Object.freeze({ json: 'table-reconcile.json', text: 'table-reconcile.txt' });
export class OutputLimitError extends ToolError {
  constructor() { super('OUTPUT_TOO_LARGE'); this.name = 'OutputLimitError'; }
}

export function serializeResult(result, options, { maxOutputBytes = OUTPUT_LIMIT } = {}) {
  if (!Number.isInteger(maxOutputBytes) || maxOutputBytes < 1 || maxOutputBytes > OUTPUT_LIMIT) throw new TypeError('INVALID_OUTPUT_LIMIT');
  const settings = {
    keyMode: options.keyMode,
    keys: options.keys.map(pair => ({ left: pair.leftColumn, right: pair.rightColumn })),
    fields: options.fields.map(pair => ({ left: pair.leftColumn, right: pair.rightColumn })),
  };
  const report = {
    schemaVersion: 1,
    tool: 'table-reconcile',
    options: settings,
    counts: result.counts,
    same: result.same,
    leftOnly: result.leftOnly,
    rightOnly: result.rightOnly,
    changed: result.changed,
  };
  const jsonString = `${JSON.stringify(report, null, 2)}\n`;
  const q = JSON.stringify;
  const lines = [
    'Table reconciliation report',
    'Schema version: 1',
    `Key mode: ${settings.keyMode}`,
    'Keys:',
    ...settings.keys.map(pair => `  ${q(pair.left)} <-> ${q(pair.right)}`),
    'Compared fields:',
    ...settings.fields.map(pair => `  ${q(pair.left)} <-> ${q(pair.right)}`),
    `Left rows: ${result.counts.leftRows}`,
    `Right rows: ${result.counts.rightRows}`,
  ];
  for (const category of ['same', 'leftOnly', 'rightOnly', 'changed']) {
    lines.push('', `${category}: ${result.counts[category]}`);
    for (const entry of result[category]) {
      lines.push(`  Key: ${q(entry.key)}`);
      if (entry.leftRow !== undefined) lines.push(`  Left data row: ${entry.leftRow}`);
      if (entry.rightRow !== undefined) lines.push(`  Right data row: ${entry.rightRow}`);
      if (entry.left) lines.push(`  Left values: ${q(entry.left)}`);
      if (entry.right) lines.push(`  Right values: ${q(entry.right)}`);
      if (entry.fields) for (const field of entry.fields) lines.push(`  Field ${q(field.left)} <-> ${q(field.right)}: ${q(field.leftValue)} -> ${q(field.rightValue)}`);
    }
  }
  const textString = `${lines.join('\n')}\n`;
  const encoder = new TextEncoder();
  const json = encoder.encode(jsonString);
  const text = encoder.encode(textString);
  if (json.byteLength > maxOutputBytes || text.byteLength > maxOutputBytes || json.byteLength + text.byteLength > maxOutputBytes) throw new OutputLimitError();
  return { json, text };
}
