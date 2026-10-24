export class ToolError extends Error {
  constructor(code, details = {}) {
    super(code);
    this.name = 'ToolError';
    this.code = code;
    Object.assign(this, details);
  }
}
