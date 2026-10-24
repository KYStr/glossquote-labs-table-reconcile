import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, symlink, lstat, rm } from 'node:fs/promises';
import { join, resolve, relative, isAbsolute, dirname } from 'node:path';
import { build } from '../scripts/build.mjs';
import { ROOT, PUBLIC_FILES, inventory, HEADERS } from '../scripts/files.mjs';
import { makePage, verifyPages } from '../scripts/pages.mjs';
import { COPY } from '../public/js/i18n.mjs';
import { resolveRequest } from '../scripts/serve.mjs';

const fixtureParent = resolve(ROOT, 'evidence/m2a/preview-fixtures');
async function fixture(fn) {
  await mkdir(fixtureParent, { recursive: true });
  const folder = await mkdtemp(join(fixtureParent, 'owned-'));
  try {
    for (const file of PUBLIC_FILES) {
      await mkdir(dirname(join(folder, 'public', file)), { recursive: true });
      await writeFile(join(folder, 'public', file), await readFile(join(ROOT, 'public', file)));
    }
    return await fn(folder);
  } finally {
    // Delete only this exact, task-created fixture. Never follow a caller path.
    const rel = relative(fixtureParent, resolve(folder));
    assert.ok(rel.startsWith('owned-') && !rel.includes('..') && !isAbsolute(rel));
    assert.equal((await lstat(folder)).isSymbolicLink(), false);
    await rm(folder, { recursive: true });
  }
}

test('static language pages have full localized title/description/H1, FAQ, home and language routes', async () => {
  await verifyPages();
  for (const [language, home, alternate] of [['zh-TW', 'https://glossquote.com/index.html', '/en/index.html'], ['en', 'https://glossquote.com/en/index.html', '/index.html']]) {
    const page = makePage(language); const m = COPY[language];
    assert.ok(page.includes(`<title>${m.title}</title>`)); assert.ok(page.includes(`<h1>${m.h1}</h1>`));
    assert.ok(page.includes(`<meta name="description" content="${m.description}">`));
    assert.ok(page.includes(`href="${home}"`)); assert.ok(page.includes(`href="${alternate}"`));
    assert.ok(page.includes('name="robots" content="noindex,nofollow"'));
    assert.equal(/canonical|sitemap|http-equiv="refresh"/i.test(page), false);
    assert.equal((page.match(/<h1>/g) || []).length, 1); assert.equal((page.match(/aria-live=/g) || []).length, 1);
    for (const [q, answer] of m.faq) { assert.ok(page.includes(q)); assert.ok(page.includes(answer)); }
    for (const category of ['same', 'leftOnly', 'rightOnly', 'changed']) assert.ok(page.includes(`id="count-${category}">0`));
    assert.ok(page.includes('download="table-reconcile.json"')); assert.ok(page.includes('download="table-reconcile.txt"'));
  }
});
test('preview routing has exact bilingual paths/MIME, no workspace fallback, safe HEAD and method denial', () => {
  for (const url of ['/en/', '/en/index.html', '/index.html', '/js/core/csv.mjs', '/styles/app.css', '/robots.txt']) assert.equal(resolveRequest({ method: 'HEAD', url, host: '127.0.0.1:4222' }).status, 200);
  for (const url of ['/en', '/test/a.test.mjs', '/HANDOFF.md', '/dist/index.html', '//index.html', '/en/%2e%2e/index.html', '/js\\app.js', '/index.html?x=1']) assert.equal(resolveRequest({ method: 'GET', url, host: '127.0.0.1:4222' }).status, 404);
  for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS', 'TRACE']) assert.deepEqual(resolveRequest({ method, url: '/', host: '127.0.0.1:4222' }), { status: 405, allow: 'GET, HEAD' });
  for (const host of ['0.0.0.0:4222', '127.0.0.1:80', '127.0.0.1:4222.evil', '', undefined]) assert.equal(resolveRequest({ method: 'GET', url: '/', host }).status, 403);
});
test('security header configuration denies connections and indexing (not a live-response test)', async () => {
  const file = await readFile(join(ROOT, 'public/_headers'), 'utf8');
  for (const [key, value] of Object.entries(HEADERS)) assert.ok(file.includes(`  ${key}: ${value}\n`));
  assert.ok(HEADERS['Content-Security-Policy'].includes("connect-src 'none'"));
  assert.equal(HEADERS['X-Robots-Tag'], 'noindex, nofollow');
});
test('closed source allowlist refuses unreviewed files and empty directories', async () => fixture(async root => {
  await writeFile(join(root, 'public/unreviewed.txt'), 'keep');
  await assert.rejects(inventory(join(root, 'public'), PUBLIC_FILES), /UNKNOWN_FILE/);
  assert.equal(await readFile(join(root, 'public/unreviewed.txt'), 'utf8'), 'keep');
  await rm(join(root, 'public/unreviewed.txt'));
  await mkdir(join(root, 'public/unknown'));
  await assert.rejects(inventory(join(root, 'public'), PUBLIC_FILES), /UNKNOWN_DIRECTORY/);
}));
test('source junctions, output junctions and unsafe allowlist entries are refused', async () => fixture(async root => {
  await mkdir(join(root, 'outside'));
  await symlink(join(root, 'outside'), join(root, 'public/link'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(inventory(join(root, 'public'), PUBLIC_FILES), /LINK_REJECTED/);
  await rm(join(root, 'public/link'));
  await symlink(join(root, 'outside'), join(root, 'dist'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(build({ root, verify: false }), /UNSAFE_DIRECTORY/);
  await assert.rejects(inventory(join(root, 'public'), ['../outside']), /UNSAFE_ALLOWLIST/);
}));
test('build is deterministic, byte-exact, preview-only and excludes docs/evidence/test', async () => fixture(async root => {
  await writeFile(join(root, 'PRIVATE-NOT-FOR-BUILD.txt'), 'synthetic-not-shipped');
  const result = await build({ root, verify: false }); assert.equal(result.mode, 'preview'); assert.equal(result.files, 12);
  const first = await readFile(join(root, 'dist/build-manifest.json'), 'utf8');
  await build({ root, verify: false }); assert.equal(await readFile(join(root, 'dist/build-manifest.json'), 'utf8'), first);
  assert.deepEqual(await inventory(join(root, 'dist'), [...PUBLIC_FILES, 'build-manifest.json']), [...PUBLIC_FILES, 'build-manifest.json'].sort());
  for (const file of PUBLIC_FILES) assert.deepEqual(await readFile(join(root, 'dist', file)), await readFile(join(root, 'public', file)));
  await writeFile(join(root, 'public/styles/app.css'), '/* intentional source update */\n');
  await build({ root, verify: false }); assert.equal(await readFile(join(root, 'dist/styles/app.css'), 'utf8'), '/* intentional source update */\n');
}));
test('unknown/stale output files are preserved and block rebuilding', async () => fixture(async root => {
  await build({ root, verify: false });
  await writeFile(join(root, 'dist/old-release.txt'), 'preserve-me');
  await assert.rejects(build({ root, verify: false }), /UNKNOWN_FILE/);
  assert.equal(await readFile(join(root, 'dist/old-release.txt'), 'utf8'), 'preserve-me');
}));
test('modified managed output and a traversal manifest fail closed without deletion', async () => fixture(async root => {
  await build({ root, verify: false });
  const original = await readFile(join(root, 'dist/index.html'));
  await writeFile(join(root, 'dist/index.html'), 'locally-modified');
  await assert.rejects(build({ root, verify: false }), /MODIFIED_OUTPUT/);
  assert.equal(await readFile(join(root, 'dist/index.html'), 'utf8'), 'locally-modified');
  await writeFile(join(root, 'dist/index.html'), original);
  const manifest = JSON.parse(await readFile(join(root, 'dist/build-manifest.json'), 'utf8'));
  manifest.files[0].path = '../PRIVATE-NOT-FOR-BUILD.txt';
  await writeFile(join(root, 'dist/build-manifest.json'), JSON.stringify(manifest));
  await assert.rejects(build({ root, verify: false }), /STALE_MANIFEST/);
}));
