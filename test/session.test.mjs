import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession } from '../public/js/core/session.mjs';
import { serializeResult } from '../public/js/core/export.mjs';
import { boundaryResult, boundaryOptions } from './boundary-fixture.mjs';

const options = { keyMode: 'exact', keys: [{ leftColumn: 'id', rightColumn: 'id' }], fields: [{ leftColumn: 'v', rightColumn: 'v' }] };
function file(text, name = 'synthetic.csv') {
  const data = new TextEncoder().encode(text);
  return { name, size: data.byteLength, arrayBuffer: async () => data.buffer };
}
function harness(extra = {}) {
  const created = []; const revoked = []; const blobs = [];
  class FakeBlob extends Blob { constructor(parts, settings) { super(parts, settings); blobs.push(this); } }
  const urls = { createObjectURL: value => { const url = `blob:synthetic-${created.length}`; created.push({ url, value }); return url; }, revokeObjectURL: url => revoked.push(url) };
  const session = createSession({ BlobClass: FakeBlob, urls, ...extra });
  return { session, created, revoked, blobs };
}
async function ready(session, l = 'id,v\n001,A', r = 'id,v\n001,X') {
  await session.load('left', file(l)); await session.load('right', file(r)); session.configure(options, true);
}

test('mapping suggestions are exact; no key is guessed or run authorized implicitly', async () => {
  const { session } = harness(); await session.load('left', file('id,v,Left\n1,A,X')); await session.load('right', file('id,v,right\n1,A,Y'));
  assert.deepEqual(session.view().options.keys, [{ leftColumn: '', rightColumn: '' }]);
  assert.deepEqual(session.view().options.fields, [{ leftColumn: 'id', rightColumn: 'id' }, { leftColumn: 'v', rightColumn: 'v' }]);
  assert.equal(session.view().canRun, false);
  session.configure(options, false); assert.equal(session.view().canRun, false);
  await session.run(); assert.equal(session.view().error.code, 'MAPPING_INVALID');
  session.configure(options, true); assert.equal(session.view().phase, 'ready');
});
test('exports require result confirmation; both correct UTF-8 Blob types become available together', async () => {
  const { session, created, blobs } = harness(); await ready(session); await session.run();
  assert.equal(session.view().phase, 'result'); assert.equal(session.view().result.counts.changed, 1);
  assert.equal(session.view().canExport, true); assert.equal(created.length, 0); assert.equal(blobs.length, 0);
  assert.equal(session.prepareDownloads(), true); assert.equal(created.length, 2); assert.equal(blobs.length, 2);
  assert.deepEqual(Object.keys(session.view().downloads), ['json', 'text']);
  assert.equal(blobs[0].type, 'application/json;charset=utf-8'); assert.equal(blobs[1].type, 'text/plain;charset=utf-8');
  assert.equal(JSON.parse(await blobs[0].text()).changed[0].right[1], 'X');
  assert.ok((await blobs[1].text()).startsWith('Table reconciliation report\n'));
  assert.equal(session.prepareDownloads(), false); assert.equal(created.length, 2);
});
test('every options change synchronously revokes both old URLs and clears successful results', async () => {
  const { session, revoked } = harness(); await ready(session); await session.run(); session.prepareDownloads();
  session.configure({ ...options, keyMode: 'trim' });
  assert.equal(session.view().phase, 'stale'); assert.equal(session.view().result, null); assert.equal(session.view().canExport, false);
  assert.equal(session.view().downloads, null); assert.deepEqual(revoked, ['blob:synthetic-0', 'blob:synthetic-1']);
  assert.equal(session.prepareDownloads(), false);
  session.configure(options, true); await session.run(); assert.equal(session.view().phase, 'result');
});
test('file gate precedes arrayBuffer and invalid input never retains an old result or URL', async () => {
  const { session, revoked } = harness(); await ready(session); await session.run(); session.prepareDownloads();
  let reads = 0;
  await session.load('left', { name: '<img src=x onerror=alert(1)>.csv', size: 1_048_577, arrayBuffer: async () => { reads++; return new ArrayBuffer(0); } });
  assert.equal(reads, 0); assert.equal(session.view().phase, 'blocked'); assert.equal(session.view().fileErrors.left.code, 'FILE_TOO_LARGE');
  assert.equal(session.view().tables.left, null); assert.equal(session.view().files.left, null); assert.equal(session.view().result, null);
  assert.equal(session.view().downloads, null); assert.equal(revoked.length, 2);
});
test('reading errors are sanitized and source-located, without stack or raw content', async () => {
  const { session } = harness();
  await session.load('right', { name: 'synthetic.csv', size: 4, arrayBuffer: async () => { throw new Error('CANARY_PRIVATE_CONTENT'); } });
  assert.deepEqual(session.view().fileErrors.right, { code: 'CSV_SYNTAX', side: 'right' });
  assert.equal(JSON.stringify(session.view().fileErrors).includes('CANARY_PRIVATE_CONTENT'), false);
  await session.load('right', { name: 'bad.csv', size: 2, arrayBuffer: async () => new Uint8Array([0xff, 0xff]).buffer });
  assert.equal(session.view().fileErrors.right.code, 'INVALID_UTF8');
});
test('cancel at a real 100-row yield leaves mapping and no partial classifications', async () => {
  let session; const observations = [];
  const h = harness({ onChange: state => { if (state.progress) { observations.push({ ...state.progress }); session.cancel(); } } }); session = h.session;
  const text = 'id,v\n' + Array.from({ length: 201 }, (_, i) => `${i},A`).join('\n');
  await ready(session, text, text); await session.run();
  assert.deepEqual(observations, [{ stage: 'left-index', processed: 100, total: 201 }]);
  assert.equal(session.view().phase, 'mapping'); assert.equal(session.view().notice, 'cancelled');
  assert.equal(session.view().result, null); assert.equal(session.view().downloads, null); assert.equal(h.blobs.length, 0);
});
test('mapping changes during a chunk invalidate old work even when it later returns', async () => {
  let session; let changed = false;
  const h = harness({ onChange: state => { if (state.progress && !changed) { changed = true; session.configure({ ...options, keyMode: 'trim' }, true); } } }); session = h.session;
  await ready(session); const generation = session.view().generation; await session.run();
  assert.ok(session.view().generation > generation + 1); assert.equal(session.view().options.keyMode, 'trim');
  assert.equal(session.view().result, null); assert.equal(session.view().phase, 'ready'); assert.equal(h.created.length, 0);
});
test('reset while a file read is pending makes its late completion inert', async () => {
  const { session } = harness(); let deliver;
  const pending = session.load('left', { name: 'late.csv', size: 10, arrayBuffer: () => new Promise(resolve => { deliver = resolve; }) });
  assert.equal(session.view().phase, 'loading'); session.reset(); deliver(new TextEncoder().encode('id,v\n1,A').buffer); await pending;
  assert.equal(session.view().phase, 'idle'); assert.deepEqual(session.view().tables, { left: null, right: null });
  assert.deepEqual(session.view().files, { left: null, right: null }); assert.deepEqual(session.view().meta, { left: null, right: null });
});
test('generation guards a late algorithm return even if its adapter ignores AbortSignal', async () => {
  let deliver; let closed = 0;
  const { session, created } = harness({ compare: () => ({ next: () => new Promise(resolve => { deliver = resolve; }), return: async () => { closed++; return { done: true }; } }) });
  await ready(session); const pending = session.run(); session.reset(); deliver({ done: true, value: { counts: { changed: 999 } } }); await pending;
  assert.equal(closed, 1); assert.equal(session.view().phase, 'idle'); assert.equal(session.view().result, null); assert.equal(created.length, 0);
});
test('A18: output overflow creates neither Blob, clears previous URLs, and preserves readable result', async () => {
  let tooSmall = false;
  const { session, created, revoked, blobs } = harness({ serialize: (result, opts) => serializeResult(result, opts, tooSmall ? { maxOutputBytes: 1 } : {}) });
  await ready(session); await session.run(); session.prepareDownloads(); tooSmall = true;
  await session.run();
  assert.equal(session.view().phase, 'result'); assert.equal(session.view().result.counts.changed, 1);
  assert.equal(session.view().error.code, 'OUTPUT_TOO_LARGE'); assert.equal(session.view().canExport, false);
  assert.equal(session.view().downloads, null); assert.equal(session.prepareDownloads(), false);
  assert.equal(created.length, 2); assert.equal(blobs.length, 2); assert.equal(revoked.length, 2);
});
test('a URL allocation failure is atomic and revokes the first of two URLs', async () => {
  let calls = 0; const revoked = [];
  const { session } = harness({ urls: { createObjectURL: () => { if (++calls === 2) throw new Error('CANARY'); return 'blob:first'; }, revokeObjectURL: value => revoked.push(value) } });
  await ready(session); await session.run(); assert.equal(session.prepareDownloads(), false);
  assert.deepEqual(revoked, ['blob:first']); assert.equal(session.view().downloads, null); assert.equal(session.view().notice, 'downloadFailed');
});
test('reset and pagehide release files, parsed tables, result references and both Blob URLs', async () => {
  for (const method of ['reset', 'pagehide']) {
    const { session, revoked } = harness(); await ready(session); await session.run(); session.prepareDownloads(); session[method]();
    const state = session.view();
    assert.equal(state.phase, 'idle'); assert.deepEqual(state.files, { left: null, right: null });
    assert.deepEqual(state.tables, { left: null, right: null }); assert.deepEqual(state.meta, { left: null, right: null });
    assert.equal(state.result, null); assert.equal(state.downloads, null); assert.equal(state.progress, null); assert.equal(state.canExport, false);
    assert.deepEqual(revoked, ['blob:synthetic-0', 'blob:synthetic-1']);
  }
});
test('A18: the true 16 MiB boundary makes both downloads available; +1 clears both without allocating', async () => {
  let over = false;
  const { session, created, revoked, blobs } = harness({ compare: async function* () { return boundaryResult(over); }, serialize: result => serializeResult(result, boundaryOptions) });
  await ready(session); await session.run(); assert.equal(session.prepareDownloads(), true);
  assert.equal(blobs[0].size + blobs[1].size, 16_777_216);
  over = true; await session.run(); assert.equal(session.prepareDownloads(), false);
  assert.equal(session.view().error.code, 'OUTPUT_TOO_LARGE'); assert.ok(session.view().result);
  assert.equal(session.view().downloads, null); assert.equal(created.length, 2); assert.equal(blobs.length, 2); assert.equal(revoked.length, 2);
});
