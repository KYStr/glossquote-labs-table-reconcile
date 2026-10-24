// Inert text/element model for controller tests. It has no browser engine,
// event execution from markup, network, storage, focus, keyboard or OS access.
export class FakeElement {
  constructor(tag, owner) { this.tagName = tag.toUpperCase(); this.owner = owner; this.children = []; this.attributes = new Map(); this.listeners = new Map(); this._text = ''; this.files = []; this.hidden = false; this.disabled = false; this.checked = false; }
  set textContent(value) { this.replaceChildren(); this._text = String(value); }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  set innerHTML(_) { throw new Error('UNSAFE_MARKUP_IN_FAKE'); }
  append(...nodes) { this._text = this._text || ''; for (const child of nodes) { child.parent = this; this.children.push(child); } }
  replaceChildren(...nodes) { for (const child of this.children) child.parent = null; this.children = []; this._text = ''; this.append(...nodes); }
  setAttribute(key, value) { this.attributes.set(key, String(value)); if (key === 'hidden') this.hidden = true; if (key === 'disabled') this.disabled = true; }
  getAttribute(key) { return this.attributes.get(key) ?? null; }
  removeAttribute(key) { this.attributes.delete(key); if (key === 'hidden') this.hidden = false; }
  set id(value) { this.setAttribute('id', value); } get id() { return this.getAttribute('id'); }
  set href(value) { this.setAttribute('href', value); } get href() { return this.getAttribute('href') || ''; }
  set download(value) { this.setAttribute('download', value); } get download() { return this.getAttribute('download'); }
  set value(value) { this._value = value; if (this.tagName === 'INPUT' && this.getAttribute('type') === 'file' && value === '') this.files = []; }
  get value() { return this._value || ''; }
  addEventListener(name, handler) { if (!this.listeners.has(name)) this.listeners.set(name, []); this.listeners.get(name).push(handler); }
  trigger(name) { if (this.disabled) throw new Error('DISABLED_CONTROL_IN_FAKE'); for (const handler of this.listeners.get(name) || []) handler({ target: this, preventDefault() {} }); }
  focus() { this.owner.activeElement = this; }
}
function descendants(root) { return [root, ...root.children.flatMap(descendants)]; }
export function fakeDocument(html) {
  const document = { documentElement: null, activeElement: null };
  document.createElement = tag => new FakeElement(tag, document);
  const root = document.createElement('root'); const stack = [root];
  const voids = new Set(['meta', 'link', 'input', 'br', 'hr']);
  for (const match of html.matchAll(/<(\/)?([a-z][a-z0-9-]*)([^>]*)>/gi)) {
    const tag = match[2].toLowerCase();
    if (match[1]) { while (stack.length > 1) { if (stack.pop().tagName.toLowerCase() === tag) break; } continue; }
    const element = document.createElement(tag);
    for (const attr of match[3].matchAll(/([a-z][\w:-]*)(?:="([^"]*)")?/gi)) element.setAttribute(attr[1], attr[2] || '');
    stack.at(-1).append(element);
    if (tag === 'html') { document.documentElement = element; element.lang = element.getAttribute('lang'); }
    if (!voids.has(tag)) stack.push(element);
  }
  document.getElementById = id => descendants(root).find(element => element.id === id) || null;
  document.querySelectorAll = selector => {
    if (selector.startsWith('#')) { const [id, tag] = selector.slice(1).split(' '); const element = document.getElementById(id); return element ? descendants(element).filter(n => !tag || n.tagName.toLowerCase() === tag) : []; }
    const attribute = selector.match(/^\[([^=]+)="([^"]+)"\]$/);
    if (attribute) return descendants(root).filter(element => element.getAttribute(attribute[1]) === attribute[2]);
    return descendants(root).filter(element => element.tagName.toLowerCase() === selector);
  };
  document.querySelector = selector => document.querySelectorAll(selector)[0] || null;
  return document;
}
export function fakeWindow() {
  const listeners = new Map();
  return { addEventListener: (name, handler) => { if (!listeners.has(name)) listeners.set(name, []); listeners.get(name).push(handler); }, dispatch: name => { for (const handler of listeners.get(name) || []) handler(); } };
}
export async function until(predicate) {
  for (let i = 0; i < 100; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 5)); }
  throw new Error('FAKE_CONTROLLER_TIMEOUT');
}
