import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, readdir, lstat, unlink, rmdir, rm, symlink, rename } from 'node:fs/promises';
import { join, resolve, relative, isAbsolute, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, PUBLIC_FILES, sha256 } from '../scripts/files.mjs';
import { buildRelease, checkRelease, runRelease, parseArguments, validateReleaseSeo, ORIGIN, TOOL_SLUG, SOURCE_FILES, SITE_FILES } from '../scripts/release.mjs';

const parent = resolve(ROOT, 'evidence/m2c/release-fixtures');
const origin = 'https://reconcile.glossquote.com';
const siteFile = (root, path) => join(root, 'release-artifacts/site', path);
const manifestFile = root => join(root, 'release-artifacts/manifest.json');
const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
async function snapshot(folder) {
  const records = [];
  async function walk(dir) {
    for (const name of (await readdir(dir)).sort()) {
      const path = join(dir, name); const stat = await lstat(path); const rel = relative(folder, path).replaceAll('\\', '/');
      if (stat.isSymbolicLink()) records.push({ path: rel, type: 'link' });
      else if (stat.isDirectory()) { records.push({ path: rel, type: 'directory' }); await walk(path); }
      else { const bytes = await readFile(path); records.push({ path: rel, bytes: bytes.length, sha256: sha256(bytes) }); }
    }
  }
  await walk(folder); return records;
}
async function removeOwnedFixture(folder) {
  const rel = relative(parent, resolve(folder));
  assert.ok(rel.startsWith('owned-') && !rel.includes('..') && !isAbsolute(rel));
  assert.equal((await lstat(folder)).isSymbolicLink(), false);
  // Explicitly unlink files/links and remove empty directories; never follow a
  // junction or call recursive deletion on release output or the real project.
  async function clear(dir) {
    for (const name of await readdir(dir)) {
      const path = join(dir, name); const stat = await lstat(path);
      if (stat.isSymbolicLink()) await rm(path, { recursive: false });
      else if (stat.isDirectory()) await clear(path);
      else await unlink(path);
    }
    await rmdir(dir);
  }
  await clear(folder);
}
async function fixture(fn, { scripts = false } = {}) {
  await mkdir(parent, { recursive: true });
  const root = await mkdtemp(join(parent, 'owned-'));
  try {
    await writeFile(join(root, 'wrangler.jsonc'), await readFile(join(ROOT, 'wrangler.jsonc')));
    for (const file of PUBLIC_FILES) {
      await mkdir(dirname(join(root, 'public', file)), { recursive: true });
      await writeFile(join(root, 'public', file), await readFile(join(ROOT, 'public', file)));
    }
    if (scripts) for (const file of ['files.mjs', 'release.mjs']) {
      await mkdir(join(root, 'scripts'), { recursive: true });
      await writeFile(join(root, 'scripts', file), await readFile(join(ROOT, 'scripts', file)));
    }
    return await fn(root);
  } finally { await removeOwnedFixture(root); }
}
async function unchangedFailure(root, pattern) {
  const before = await snapshot(join(root, 'release-artifacts'));
  await assert.rejects(checkRelease({ root }), pattern);
  await assert.rejects(buildRelease({ root }), pattern);
  assert.deepEqual(await snapshot(join(root, 'release-artifacts')), before);
}
function parsedHead(html) {
  const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
  return [...head.matchAll(/<(meta|link)\b([^>]+)>/g)].map(([, tag, attributes]) => {
    const entries = [...attributes.matchAll(/([a-z][\w-]*)="([^"]*)"/g)].map(([, key, value]) => [key, value]);
    assert.equal(new Set(entries.map(([key]) => key)).size, entries.length);
    return { tag, ...Object.fromEntries(entries) };
  });
}

test('release destination and source pins match the accepted M1 public set', async () => {
  assert.equal(ORIGIN, origin); assert.equal(TOOL_SLUG, 'table-reconcile');
  const old = await readJson(join(ROOT, 'evidence/m1/source-manifest.json'));
  assert.deepEqual(SOURCE_FILES, old.files.filter(f => f.path.startsWith('public/')).map(f => ({ ...f, path: f.path.slice(7) })));
  assert.deepEqual(SITE_FILES, [...new Set([...PUBLIC_FILES, '_headers', '_redirects', 'robots.txt', 'sitemap.xml'])].sort());
});
test('release changes only SEO heads and the exact two candidate banner nodes', async () => fixture(async root => {
  const before = await snapshot(join(root, 'public')); await buildRelease({ root });
  for (const page of ['index.html', 'en/index.html']) {
    const source = await readFile(join(root, 'public', page), 'utf8'); const output = await readFile(siteFile(root, page), 'utf8');
    const tags = parsedHead(output);
    assert.deepEqual(tags.filter(t => t.rel === 'canonical'), [{ tag: 'link', rel: 'canonical', href: `${origin}/${page}` }]);
    assert.deepEqual(tags.filter(t => t.rel === 'alternate'), [
      { tag: 'link', rel: 'alternate', hreflang: 'zh-Hant', href: `${origin}/index.html` },
      { tag: 'link', rel: 'alternate', hreflang: 'en', href: `${origin}/en/index.html` },
      { tag: 'link', rel: 'alternate', hreflang: 'x-default', href: `${origin}/index.html` },
    ]);
    assert.deepEqual(tags.filter(t => t.name === 'robots'), [{ tag: 'meta', name: 'robots', content: 'index,follow' }]);
    const banner = page === 'index.html' ? '<p class="preview">本地候選版 · 尚未完成瀏覽器驗收</p>' : '<p class="preview">Local candidate · browser acceptance pending</p>';
    assert.equal(source.split(banner).length, 2);
    assert.equal(output.split('</head>')[1], source.split('</head>')[1].replace(banner, ''));
    const restored = output.replace(/^  <link rel="(?:canonical|alternate)"[^\n]*\n/gm, '').replace('<meta name="robots" content="index,follow">', '<meta name="robots" content="noindex,nofollow">').replace('<div class="introduction">', '<div class="introduction">' + banner);
    assert.equal(restored, source);
    assert.equal(output.includes(banner), false);
    assert.equal(/rel="canonical"|sitemap/.test(source), false); assert.ok(source.includes('noindex,nofollow'));
  }
  assert.deepEqual(await snapshot(join(root, 'public')), before);
}));
test('all runtime and non-SEO assets remain byte-exact, preview/dist are untouched', async () => fixture(async root => {
  await mkdir(join(root, 'dist')); await writeFile(join(root, 'dist/index.html'), await readFile(join(ROOT, 'dist/index.html')));
  const sourceBefore = await snapshot(join(root, 'public')); const previewBefore = await snapshot(join(root, 'dist'));
  await buildRelease({ root });
  for (const path of PUBLIC_FILES.filter(path => !['_headers', 'robots.txt', 'index.html', 'en/index.html'].includes(path))) assert.deepEqual(await readFile(siteFile(root, path)), await readFile(join(root, 'public', path)));
  assert.deepEqual(await snapshot(join(root, 'public')), sourceBefore); assert.deepEqual(await snapshot(join(root, 'dist')), previewBefore);
}));
test('robots/sitemap contain just the two planned URLs; security headers change only X-Robots-Tag', async () => fixture(async root => {
  await buildRelease({ root });
  assert.equal(await readFile(siteFile(root, 'robots.txt'), 'utf8'), 'User-agent: *\nAllow: /\nSitemap: https://reconcile.glossquote.com/sitemap.xml\n');
  const xml = await readFile(siteFile(root, 'sitemap.xml'), 'utf8');
  assert.ok(xml.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'));
  assert.deepEqual([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]), ['https://reconcile.glossquote.com/index.html', 'https://reconcile.glossquote.com/en/index.html']);
  assert.equal(/lastmod|<loc>.*(?:localhost|127\.0\.0\.1)/.test(xml), false);
  const original = await readFile(join(root, 'public/_headers'), 'utf8');
  assert.equal(await readFile(siteFile(root, '_headers'), 'utf8'), original.replace('  X-Robots-Tag: noindex, nofollow', '  X-Robots-Tag: index, follow'));
}));
test('manifest schema is exact, site is closed, and rebuilding is deterministic without overwrites', async () => fixture(async root => {
  await writeFile(join(root, 'private-not-an-asset.txt'), 'synthetic');
  await buildRelease({ root }); const bytes = await readFile(manifestFile(root)); const before = await snapshot(join(root, 'release-artifacts'));
  const manifest = JSON.parse(bytes);
  assert.deepEqual(Object.keys(manifest), ['schemaVersion', 'mode', 'origin', 'toolSlug', 'files', 'sourceFiles']);
  assert.equal(manifest.schemaVersion, 1); assert.equal(manifest.mode, 'release-candidate'); assert.equal(manifest.origin, origin); assert.equal(manifest.toolSlug, 'table-reconcile');
  assert.deepEqual(manifest.files.map(f => f.path), [...SITE_FILES]); assert.deepEqual(manifest.sourceFiles, SOURCE_FILES);
  assert.equal(manifest.files.some(f => f.path.includes('manifest') || f.path.startsWith('evidence/')), false);
  assert.equal(bytes.toString().includes(root.replaceAll('\\', '/')), false); assert.equal(bytes.toString().includes(root), false);
  for (const file of [...manifest.files, ...manifest.sourceFiles]) assert.deepEqual(Object.keys(file), ['path', 'bytes', 'sha256']);
  assert.equal((await checkRelease({ root })).status, 'CHECKED_OFFLINE');
  assert.equal((await buildRelease({ root })).status, 'EXISTING_BYTES_VERIFIED');
  assert.deepEqual(await snapshot(join(root, 'release-artifacts')), before); assert.deepEqual(await readFile(manifestFile(root)), bytes);
}));
test('release adds exactly three static 301 entry redirects to the existing canonical HTML assets', async () => fixture(async root => {
  await buildRelease({ root });
  const bytes = await readFile(siteFile(root, '_redirects'));
  assert.deepEqual(bytes, Buffer.from('/ /index.html 301\n/en /en/index.html 301\n/en/ /en/index.html 301\n'));
  const rules = bytes.toString('utf8').trimEnd().split('\n').map(line => line.split(' '));
  assert.deepEqual(rules, [['/', '/index.html', '301'], ['/en', '/en/index.html', '301'], ['/en/', '/en/index.html', '301']]);
  for (const [, destination] of rules) assert.equal((await lstat(siteFile(root, destination.slice(1)))).isFile(), true);
  const manifest = await readJson(manifestFile(root));
  assert.equal(manifest.files.length, 14);
  assert.deepEqual(manifest.files.find(file => file.path === '_redirects'), { path: '_redirects', bytes: bytes.length, sha256: sha256(bytes) });
  assert.equal(manifest.sourceFiles.some(file => file.path === '_redirects'), false);
  assert.equal(JSON.parse(await readFile(join(root, 'wrangler.jsonc'), 'utf8')).assets.html_handling, 'none');
}));
test('changed, missing, duplicate, external or unknown redirect rules fail without overwriting output', async () => fixture(async root => {
  await buildRelease({ root });
  const original = await readFile(siteFile(root, '_redirects'), 'utf8');
  const edits = [
    original.replace('/ /index.html 301', '/ /index.html 302'),
    original.replace('/en/ /en/index.html 301\n', ''),
    original + '/fr /en/index.html 301\n',
    original + '/* /index.html 301\n',
    original + '/ /en/index.html 301\n',
    original.replace('/en /en/index.html', '/en https://example.invalid/en/index.html'),
    original.replace('/en/ /en/index.html', '/en/ /en/index.html?extra=1'),
    original.replace('/en /en/index.html', '/en /index.html'),
  ];
  for (const changed of edits) {
    await writeFile(siteFile(root, '_redirects'), changed);
    await unchangedFailure(root, /RELEASE_ASSET_MISMATCH/);
  }
}));
test('tampered HTML/JS/header output fails without overwriting the modified file', async () => {
  for (const path of ['index.html', 'en/index.html', 'js/app.js', '_headers', '_redirects']) await fixture(async root => {
    await buildRelease({ root }); await writeFile(siteFile(root, path), 'modified synthetic artifact');
    await unchangedFailure(root, /RELEASE_ASSET_MISMATCH/);
  });
});
test('manifest + asset co-tampering is rejected even with valid recomputed hashes', async () => {
  for (const path of ['en/index.html', 'js/app.js', 'robots.txt', '_headers', '_redirects', 'sitemap.xml']) await fixture(async root => {
    await buildRelease({ root }); const bytes = Buffer.from('synthetic tampered bytes'); await writeFile(siteFile(root, path), bytes);
    const manifest = await readJson(manifestFile(root)); const entry = manifest.files.find(file => file.path === path);
    entry.bytes = bytes.length; entry.sha256 = sha256(bytes);
    await writeFile(manifestFile(root), JSON.stringify(manifest, null, 2) + '\n');
    await unchangedFailure(root, /MANIFEST_MISMATCH/);
  });
});
test('release does not permit any additional body change or restored candidate banner, even with a forged manifest', async () => {
  for (const page of ['index.html', 'en/index.html']) for (const restoreBanner of [false, true]) await fixture(async root => {
    await buildRelease({ root });
    const original = await readFile(siteFile(root, page), 'utf8');
    const banner = page === 'index.html' ? '<p class="preview">本地候選版 · 尚未完成瀏覽器驗收</p>' : '<p class="preview">Local candidate · browser acceptance pending</p>';
    const changed = restoreBanner ? original.replace('<div class="introduction">', '<div class="introduction">' + banner) : original.replace('<h1>', '<h1>UNAUTHORIZED BODY CHANGE ');
    const bytes = Buffer.from(changed); await writeFile(siteFile(root, page), bytes);
    if (restoreBanner) assert.throws(() => validateReleaseSeo(bytes, page), /RELEASE_CANDIDATE_BANNER/);
    const manifest = await readJson(manifestFile(root)); const entry = manifest.files.find(file => file.path === page); entry.bytes = bytes.length; entry.sha256 = sha256(bytes);
    await writeFile(manifestFile(root), JSON.stringify(manifest, null, 2) + '\n');
    await unchangedFailure(root, /MANIFEST_MISMATCH/);
  });
});
test('wrong origin, schema, slug, duplicate/order/traversal/source records and extra fields fail', async () => fixture(async root => {
  await buildRelease({ root }); const original = await readFile(manifestFile(root));
  const edits = [
    m => { m.origin = 'https://wrong.glossquote.com'; }, m => { m.origin = `${origin}:8443`; },
    m => { m.mode = 'production'; }, m => { m.schemaVersion = 2; }, m => { m.toolSlug = 'wrong-tool'; },
    m => { m.files.reverse(); }, m => { m.files[1] = { ...m.files[0] }; }, m => { m.files[0].path = '../outside.txt'; },
    m => { m.sourceFiles[0].sha256 = '0'.repeat(64); }, m => { m.sourceFiles.pop(); }, m => { m.extra = 'not-allowed'; },
  ];
  for (const edit of edits) { const manifest = JSON.parse(original); edit(manifest); await writeFile(manifestFile(root), JSON.stringify(manifest, null, 2) + '\n'); await unchangedFailure(root, /MANIFEST_MISMATCH/); }
}));
test('extra output files and empty unknown directories, including root siblings, are preserved and refused', async () => {
  for (const path of ['site/private.txt', 'README.md', 'site/foreign-directory/']) await fixture(async root => {
    await buildRelease({ root }); const target = join(root, 'release-artifacts', path);
    if (path.endsWith('/')) await mkdir(target); else await writeFile(target, 'preserve');
    await unchangedFailure(root, /UNKNOWN_FILE|UNKNOWN_DIRECTORY/);
  });
});
test('missing output file/manifest and unmanaged or empty output directories fail safely', async () => {
  for (const path of ['site/js/app.js', 'site/en/index.html', 'site/_redirects', 'manifest.json']) await fixture(async root => {
    await buildRelease({ root }); await unlink(join(root, 'release-artifacts', path)); await unchangedFailure(root, /MISSING_REQUIRED_FILE/);
  });
  await fixture(async root => { await mkdir(join(root, 'release-artifacts')); await unchangedFailure(root, /MISSING_REQUIRED_FILE/); });
});
test('same-length source changes reject build/check and forged source+output manifests', async () => fixture(async root => {
  await buildRelease({ root }); const path = 'js/app.js'; const bytes = await readFile(join(root, 'public', path)); bytes[0] ^= 1;
  await writeFile(join(root, 'public', path), bytes);
  const manifest = await readJson(manifestFile(root)); manifest.sourceFiles.find(f => f.path === path).sha256 = sha256(bytes); manifest.files.find(f => f.path === path).sha256 = sha256(bytes);
  await writeFile(siteFile(root, path), bytes); await writeFile(manifestFile(root), JSON.stringify(manifest, null, 2) + '\n');
  await unchangedFailure(root, /SOURCE_CHANGED/);
}));
test('invalid source inventory fails before creating any real release output', async () => {
  for (const kind of ['extra-file', 'unknown-directory', 'missing-file', 'source-change']) await fixture(async root => {
    if (kind === 'extra-file') await writeFile(join(root, 'public/private.txt'), 'synthetic');
    if (kind === 'unknown-directory') await mkdir(join(root, 'public/unused'));
    if (kind === 'missing-file') await unlink(join(root, 'public/robots.txt'));
    if (kind === 'source-change') await writeFile(join(root, 'public/styles/app.css'), 'changed');
    await assert.rejects(buildRelease({ root }), /UNKNOWN_FILE|UNKNOWN_DIRECTORY|MISSING_REQUIRED_FILE|SOURCE_CHANGED/);
    await assert.rejects(lstat(join(root, 'release-artifacts')), { code: 'ENOENT' });
  });
});
test('source/output/ancestor junctions are refused without reading through or deleting links', async () => {
  await fixture(async root => {
    await rename(join(root, 'public/js'), join(root, 'saved-js'));
    await symlink(join(root, 'saved-js'), join(root, 'public/js'), process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(buildRelease({ root }), /LINK_REJECTED/);
    assert.equal((await lstat(join(root, 'public/js'))).isSymbolicLink(), true);
  });
  await fixture(async root => {
    await buildRelease({ root }); await rename(join(root, 'release-artifacts/site/js'), join(root, 'saved-output-js'));
    await symlink(join(root, 'saved-output-js'), join(root, 'release-artifacts/site/js'), process.platform === 'win32' ? 'junction' : 'dir');
    await unchangedFailure(root, /LINK_REJECTED/);
  });
  await fixture(async root => {
    await mkdir(join(root, 'outside')); await symlink(join(root, 'outside'), join(root, 'release-artifacts'), process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(buildRelease({ root }), /UNSAFE_DIRECTORY/); assert.deepEqual(await snapshot(join(root, 'outside')), []);
  });
});
test('oversized manifest is refused before loading it, with all bytes left unchanged', async () => fixture(async root => {
  await buildRelease({ root }); await writeFile(manifestFile(root), 'x'.repeat(65_537)); await unchangedFailure(root, /MANIFEST_TOO_LARGE/);
}));
test('invalid, missing or linked deployment config fails before creating output', async () => {
  for (const kind of ['invalid-json', 'oversized', 'missing', 'linked']) await fixture(async root => {
    const path = join(root, 'wrangler.jsonc');
    if (kind === 'invalid-json') await writeFile(path, '{not JSON');
    if (kind === 'oversized') await writeFile(path, ' '.repeat(16_385));
    if (kind === 'missing' || kind === 'linked') await unlink(path);
    if (kind === 'linked') { await mkdir(join(root, 'not-a-config')); await symlink(join(root, 'not-a-config'), path, process.platform === 'win32' ? 'junction' : 'dir'); }
    await assert.rejects(buildRelease({ root }), /DEPLOYMENT_CONFIG_INVALID|ENOENT/);
    await assert.rejects(lstat(join(root, 'release-artifacts')), { code: 'ENOENT' });
  });
});
test('independent semantic validator rejects malformed, duplicate and nonreciprocal SEO', async () => fixture(async root => {
  await buildRelease({ root });
  for (const page of ['index.html', 'en/index.html']) {
    const html = await readFile(siteFile(root, page), 'utf8');
    assert.equal(validateReleaseSeo(Buffer.from(html), page), true);
    for (const changed of [
      html.replace('rel="canonical"', 'rel="wrong"'), html.replace('hreflang="en"', 'hreflang="zh-Hant"'),
      html.replace('hreflang="x-default" href="https://reconcile.glossquote.com/index.html"', 'hreflang="x-default" href="https://reconcile.glossquote.com/en/index.html"'),
      html.replace('content="index,follow"', 'content="noindex,nofollow"'), html.replace('</head>', '<link rel="canonical" href="https://wrong.example/index.html">\n</head>'),
      html.replace('rel="canonical" href=', 'rel="canonical" rel="canonical" href='),
    ]) assert.throws(() => validateReleaseSeo(Buffer.from(changed), page), /RELEASE_|DUPLICATE_SEO_ATTRIBUTE/);
  }
}));
test('no/default/unknown/multiple CLI arguments fail in a task-owned copy; valid build/check succeed', async () => fixture(async root => {
  const script = join(root, 'scripts/release.mjs'); const before = await snapshot(root);
  for (const args of [[], ['deploy'], ['--help'], ['build', 'check'], ['check', '--origin', origin], ['build', '--origin=https://wrong.example']]) {
    assert.throws(() => parseArguments(args), /RELEASE_ARGUMENTS/); await assert.rejects(runRelease(args, { root }), /RELEASE_ARGUMENTS/);
    const child = spawnSync(process.execPath, [script, ...args], { cwd: root, shell: false, windowsHide: true, encoding: 'utf8', timeout: 10_000 });
    assert.ifError(child.error); assert.equal(child.status, 1); assert.equal(child.stdout, ''); assert.equal(child.stderr.trim(), 'RELEASE_ARGUMENTS');
  }
  assert.deepEqual(await snapshot(root), before);
  for (const mode of ['build', 'check']) {
    const child = spawnSync(process.execPath, [script, mode], { cwd: root, shell: false, windowsHide: true, encoding: 'utf8', timeout: 10_000 });
    assert.ifError(child.error); assert.equal(child.status, 0); assert.equal(child.stderr, ''); assert.equal(JSON.parse(child.stdout).origin, origin);
  }
}, { scripts: true }));
