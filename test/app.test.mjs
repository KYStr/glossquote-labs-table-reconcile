import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { ROOT } from '../scripts/files.mjs';
import { makePage } from '../scripts/pages.mjs';
import { COPY } from '../public/js/i18n.mjs';
import { fakeDocument, fakeWindow, until } from './dom-fake.mjs';

for (const language of ['zh-TW', 'en']) test(`${language}: offline inert DOM model exercises file -> map -> real core -> report -> stale -> clear`, async () => {
  const document = fakeDocument(makePage(language)); const window = fakeWindow(); const m = COPY[language];
  const originalDocument = globalThis.document; const originalWindow = globalThis.window;
  const originalCreate = URL.createObjectURL; const originalRevoke = URL.revokeObjectURL;
  const created = []; const revoked = [];
  URL.createObjectURL = value => { const url = `blob:fake-${created.length}`; created.push({ url, value }); return url; };
  URL.revokeObjectURL = value => revoked.push(value);
  globalThis.document = document; globalThis.window = window;
  const id = value => document.getElementById(value);
  try {
    await import(`${pathToFileURL(join(ROOT, 'public/js/app.js')).href}?inert-test=${language}`);
    assert.equal(id('status').textContent, m.idle); assert.equal(id('run').disabled, true);
    const hostile = '<img src=x onerror=alert(1)>';
    const longValue = `${hostile}${'x'.repeat(250)}`;
    id('file-left').files = [new File([`id,v\n001,${longValue}`], `${hostile}.csv`, { type: 'text/csv' })];
    id('file-left').trigger('change');
    await until(() => !id('file-left').disabled);
    assert.ok(id('meta-left').textContent.includes(hostile)); assert.equal(id('file-left').files.length, 0);
    id('file-right').files = [new File(['id,v\n001,X'], 'synthetic-right.csv', { type: 'text/csv' })];
    id('file-right').trigger('change'); await until(() => !id('mapping-content').hidden);
    assert.ok(id('sample-left').textContent.includes(longValue));
    assert.equal(document.querySelectorAll('img').length, 0);
    for (const side of ['left', 'right']) { id(`keys-${side}-0`).value = 'id'; id(`keys-${side}-0`).trigger('change'); }
    id('confirm-mapping').checked = true; id('confirm-mapping').trigger('change');
    assert.equal(id('run').disabled, false); id('run').trigger('click'); assert.equal(id('run').getAttribute('aria-busy'), 'true');
    await until(() => !id('result-content').hidden);
    assert.equal(id('count-changed').textContent, '1'); assert.equal(id('count-same').textContent, '0');
    assert.ok(id('result-table').textContent.includes(longValue)); assert.equal(document.querySelectorAll('img').length, 0);
    assert.equal(id('download-json').hidden, true); id('prepare').trigger('click');
    assert.equal(created.length, 2); assert.equal(id('download-json').href, 'blob:fake-0'); assert.equal(id('download-text').href, 'blob:fake-1');
    const json = JSON.parse(await created[0].value.text());
    assert.equal(json.changed[0].left[1], longValue); assert.equal(json.changed[0].right[1], 'X');
    document.querySelector('[data-category="same"]').trigger('click'); assert.ok(id('result-table').textContent.includes(m.noMatches));
    id('key-mode').value = 'trim'; id('key-mode').trigger('change');
    assert.equal(id('download-json').getAttribute('href'), null); assert.equal(id('download-text').getAttribute('href'), null);
    assert.equal(id('download-json').hidden, true); assert.equal(id('result-table').textContent, ''); assert.equal(revoked.length, 2);
    assert.equal(id('status').textContent, m.stale);
    id('reset').trigger('click');
    assert.equal(id('sample-left').textContent, ''); assert.equal(id('sample-right').textContent, ''); assert.equal(id('key-pairs').textContent, '');
    assert.equal(id('meta-left').textContent, m.noFile); assert.equal(id('status').textContent, m.idle);
    window.dispatch('pagehide'); assert.equal(id('download-json').getAttribute('href'), null);
  } finally {
    globalThis.document = originalDocument; globalThis.window = originalWindow;
    URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke;
  }
});
