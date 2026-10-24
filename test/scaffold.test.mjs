import test from 'node:test';
import assert from 'node:assert/strict';
import { HOST, PORT, resolveRequest } from '../scripts/serve.mjs';

test('preview routing is an exact loopback allowlist (no listener started)', () => {
  assert.equal(HOST, '127.0.0.1');
  assert.equal(PORT, 4222);
  assert.deepEqual(resolveRequest({ method: 'GET', url: '/', host: '127.0.0.1:4222' }), { status: 200, path: 'index.html', mime: 'text/html; charset=utf-8' });
  assert.equal(resolveRequest({ method: 'GET', url: '/', host: 'evil.example:4222' }).status, 403);
  assert.equal(resolveRequest({ method: 'POST', url: '/', host: '127.0.0.1:4222' }).status, 405);
  for (const url of ['/../package.json', '/%2e%2e/package.json', '/missing', '/_headers', '/?q=private']) assert.equal(resolveRequest({ method: 'GET', url, host: '127.0.0.1:4222' }).status, 404);
});
