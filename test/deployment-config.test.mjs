import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT } from '../scripts/files.mjs';
import { validateDeploymentConfig, readDeploymentConfig } from '../scripts/release.mjs';

const expected = {
  name: 'glossquote-table-reconcile', compatibility_date: '2026-10-24',
  workers_dev: false, preview_urls: false, send_metrics: false,
  routes: [{ pattern: 'reconcile.glossquote.com', custom_domain: true }],
  observability: { enabled: false, logs: { enabled: false, invocation_logs: false }, traces: { enabled: false } },
  assets: { directory: './release-artifacts/site', run_worker_first: false, html_handling: 'none', not_found_handling: 'none' },
  build: { command: 'node scripts/release.mjs build' },
};
test('Wrangler config exactly matches the authorized static-only deployment contract', async () => {
  const actual = JSON.parse(await readFile(join(ROOT, 'wrangler.jsonc'), 'utf8'));
  assert.deepEqual(actual, expected); assert.deepEqual(await readDeploymentConfig(), expected);
  assert.equal(validateDeploymentConfig(actual), true);
});
test('config validation accepts equivalent JSON key ordering without changing policy', () => {
  const reversed = Object.fromEntries(Object.entries(expected).reverse());
  reversed.assets = Object.fromEntries(Object.entries(expected.assets).reverse());
  assert.equal(validateDeploymentConfig(reversed), true);
});
test('unapproved routes, execution, telemetry, storage, build commands and omitted controls fail closed', () => {
  const edits = [
    c => { c.name = 'other-tool'; }, c => { c.compatibility_date = '2026-10-25'; },
    c => { c.routes[0].pattern = '040141.xyz'; }, c => { c.routes[0].pattern += '/*'; }, c => { c.routes[0].custom_domain = false; }, c => { c.routes.push({ pattern: 'other.example', custom_domain: true }); },
    c => { c.workers_dev = true; }, c => { c.preview_urls = true; }, c => { c.send_metrics = true; },
    c => { c.observability.enabled = true; }, c => { c.observability.logs.enabled = true; }, c => { c.observability.logs.invocation_logs = true; }, c => { c.observability.traces.enabled = true; }, c => { delete c.observability.logs; },
    c => { c.assets.directory = './public'; }, c => { c.assets.run_worker_first = true; }, c => { c.assets.html_handling = 'auto-trailing-slash'; }, c => { c.assets.not_found_handling = 'single-page-application'; },
    c => { c.build.command = 'wrangler deploy'; }, c => { c.main = 'worker.mjs'; }, c => { c.kv_namespaces = []; }, c => { c.d1_databases = []; }, c => { c.vars = { SYNTHETIC: 'not-authorized' }; },
  ];
  for (const edit of edits) { const config = structuredClone(expected); edit(config); assert.throws(() => validateDeploymentConfig(config), /DEPLOYMENT_CONFIG_INVALID/); }
});
test('malformed config types and additional top-level fields are rejected', () => {
  for (const config of [null, undefined, false, [], 'config', { ...expected, extra: true }]) assert.throws(() => validateDeploymentConfig(config), /DEPLOYMENT_CONFIG_INVALID/);
});
