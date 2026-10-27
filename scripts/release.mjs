import { mkdir, lstat, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, PUBLIC_FILES, inventory, sha256 } from './files.mjs';

// Preselected destination only. No environment/CLI origin, credentials or uploader.
export const ORIGIN = 'https://reconcile.glossquote.com';
export const TOOL_SLUG = 'table-reconcile';
export const SOURCE_FILES = Object.freeze([
  { path: '_headers', bytes: 450, sha256: '26984a067759774480233873f9eea1cf12eece87f926a63bedefbacdde5fc965' },
  { path: 'en/index.html', bytes: 8000, sha256: '07ca70d8e8c73bdc355b90361424a50f9198ecad8fd811e45735819c3fddd0ae' },
  { path: 'index.html', bytes: 7689, sha256: '3a0fe90f56daf6d0f6f4343045057e47bb18ef58afcb076ca72eae3e8bd1cec5' },
  { path: 'js/app.js', bytes: 15623, sha256: '6fed972c3e1199daf520bf809e6ad94a20f7d46fbea9c369f7d776566c94dcf1' },
  { path: 'js/core/csv.mjs', bytes: 3860, sha256: '6e5437b0138d28282a39c898c269749f792f843fc75c36988a9d6ae4c484c013' },
  { path: 'js/core/errors.mjs', bytes: 183, sha256: '1e8dd3b4440213d22c472b78ec9f7bdfdb935e67285d89daba29a62bc931be0c' },
  { path: 'js/core/export.mjs', bytes: 2609, sha256: '89e1a3d4cc1026908d432b9aad6d18c0446ec035a75ba786a43b3f916bbb7a5d' },
  { path: 'js/core/reconcile.mjs', bytes: 5810, sha256: '3c8ec61df5961c3da2dc1ed43c92e3fc09e847d0e8739989d38172494cf05a51' },
  { path: 'js/core/session.mjs', bytes: 8061, sha256: '51700be4a9fb3b24b04f46f63802fc9b53dad18f409674813f00811bc86b9580' },
  { path: 'js/i18n.mjs', bytes: 14633, sha256: '96e1f227286dd2d0263beb236e916c9433b3b954d7d14f09193b6158dffcce5c' },
  { path: 'robots.txt', bytes: 26, sha256: '331ea9090db0c9f6f597bd9840fd5b171830f6e0b3ba1cb24dfa91f0c95aedc1' },
  { path: 'styles/app.css', bytes: 10506, sha256: 'c755eedf624bfd20db7cc84267da8004f4137e4f8c29c50c2a12b6b344b93737' },
].map(Object.freeze));
export const SITE_FILES = Object.freeze([...new Set([...PUBLIC_FILES, 'robots.txt', '_headers', '_redirects', 'sitemap.xml'])].sort());
const OUTPUT_FILES = Object.freeze(['manifest.json', ...SITE_FILES.map(path => `site/${path}`)]);
const REDIRECTS = '/ /index.html 301\n/en /en/index.html 301\n/en/ /en/index.html 301\n';
const PAGES = Object.freeze(['index.html', 'en/index.html']);
const MANIFEST_LIMIT = 65_536;
const CANDIDATE_BANNERS = Object.freeze({
  'index.html': '<p class="preview">本地候選版 · 尚未完成瀏覽器驗收</p>',
  'en/index.html': '<p class="preview">Local candidate · browser acceptance pending</p>',
});
const DEPLOYMENT_CONFIG = {
  name: 'glossquote-table-reconcile', compatibility_date: '2026-10-24',
  workers_dev: false, preview_urls: false, send_metrics: false,
  routes: [{ pattern: 'reconcile.glossquote.com', custom_domain: true }],
  observability: { enabled: false, logs: { enabled: false, invocation_logs: false }, traces: { enabled: false } },
  assets: { directory: './release-artifacts/site', run_worker_first: false, html_handling: 'none', not_found_handling: 'none' },
  build: { command: 'node scripts/release.mjs build' },
};

function reject(code) { throw new Error(code); }
const sameList = (a, b) => a.length === b.length && a.every((value, index) => value === b[index]);
function exactConfig(actual, expected) {
  if (expected === null || typeof expected !== 'object') return actual === expected;
  if (Array.isArray(expected)) return Array.isArray(actual) && actual.length === expected.length && expected.every((value, index) => exactConfig(actual[index], value));
  if (!actual || typeof actual !== 'object' || Array.isArray(actual)) return false;
  return sameList(Object.keys(actual).sort(), Object.keys(expected).sort()) && Object.keys(expected).every(key => exactConfig(actual[key], expected[key]));
}
export function validateDeploymentConfig(config) {
  if (!exactConfig(config, DEPLOYMENT_CONFIG)) reject('DEPLOYMENT_CONFIG_INVALID');
  return true;
}
export async function readDeploymentConfig(root = ROOT) {
  const path = join(root, 'wrangler.jsonc'); const stat = await lstat(path);
  if (stat.isSymbolicLink() || !stat.isFile() || stat.size > 16_384) reject('DEPLOYMENT_CONFIG_INVALID');
  const bytes = await readFile(path);
  if (bytes.length > 16_384) reject('DEPLOYMENT_CONFIG_INVALID');
  let config;
  try { config = JSON.parse(bytes.toString('utf8')); } catch { reject('DEPLOYMENT_CONFIG_INVALID'); }
  validateDeploymentConfig(config);
  return config;
}
export function parseArguments(args) {
  if (args.length !== 1 || !['build', 'check'].includes(args[0])) reject('RELEASE_ARGUMENTS');
  return args[0];
}
async function directory(path) {
  const stat = await lstat(path);
  if (stat.isSymbolicLink() || !stat.isDirectory()) reject('UNSAFE_RELEASE_DIRECTORY');
}
async function exists(path) {
  try { await lstat(path); return true; } catch (error) { if (error.code !== 'ENOENT') throw error; return false; }
}

function releaseHtml(bytes, page) {
  const html = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const start = html.indexOf('<head>'); const end = html.indexOf('</head>');
  if (start < 0 || end < start || html.indexOf('<head>', start + 1) !== -1 || html.indexOf('</head>', end + 1) !== -1) reject('SOURCE_HEAD');
  const before = html.slice(0, start); const after = html.slice(end);
  const banner = CANDIDATE_BANNERS[page];
  const introduction = '<div class="introduction">';
  if (!banner || after.split(banner).length !== 2 || after.split(introduction + banner).length !== 2) reject('SOURCE_CANDIDATE_BANNER');
  const releaseBody = after.replace(introduction + banner, introduction);
  const head = html.slice(start, end);
  const marker = '<meta name="robots" content="noindex,nofollow">';
  if (head.split(marker).length !== 2 || /rel=["'](?:canonical|alternate)["']/.test(head)) reject('SOURCE_SEO');
  const seo = [
    `  <link rel="canonical" href="${ORIGIN}/${page}">`,
    `  <link rel="alternate" hreflang="zh-Hant" href="${ORIGIN}/index.html">`,
    `  <link rel="alternate" hreflang="en" href="${ORIGIN}/en/index.html">`,
    `  <link rel="alternate" hreflang="x-default" href="${ORIGIN}/index.html">`,
  ].join('\n') + '\n';
  return Buffer.from(before + head.replace(marker, '<meta name="robots" content="index,follow">') + seo + releaseBody);
}

// A semantic cross-check accompanies exact expected-byte comparison. It parses
// only this pinned static head; it is not a browser/HTML-security validation.
function headAttributes(tag) {
  const attrs = new Map();
  for (const [, key, value] of tag.matchAll(/\s([a-z][\w-]*)="([^"]*)"/gi)) {
    const name = key.toLowerCase(); if (attrs.has(name)) reject('DUPLICATE_SEO_ATTRIBUTE'); attrs.set(name, value);
  }
  return attrs;
}
export function validateReleaseSeo(bytes, page) {
  if (!PAGES.includes(page)) reject('UNKNOWN_RELEASE_PAGE');
  const html = bytes.toString('utf8');
  const head = html.match(/<head>([\s\S]*?)<\/head>/)?.[1];
  if (!head) reject('RELEASE_HEAD');
  const metas = [...head.matchAll(/<meta\b[^>]*>/g)].map(match => headAttributes(match[0])).filter(attrs => attrs.get('name') === 'robots');
  if (metas.length !== 1 || metas[0].get('content') !== 'index,follow') reject('RELEASE_ROBOTS_META');
  const links = [...head.matchAll(/<link\b[^>]*>/g)].map(match => headAttributes(match[0]));
  const canonical = links.filter(attrs => attrs.get('rel') === 'canonical');
  if (canonical.length !== 1 || canonical[0].get('href') !== `${ORIGIN}/${page}` || canonical[0].size !== 2) reject('RELEASE_CANONICAL');
  const alternate = links.filter(attrs => attrs.get('rel') === 'alternate');
  if (alternate.length !== 3) reject('RELEASE_ALTERNATES');
  for (const [lang, target] of [['zh-Hant', 'index.html'], ['en', 'en/index.html'], ['x-default', 'index.html']]) {
    const entries = alternate.filter(attrs => attrs.get('hreflang') === lang);
    if (entries.length !== 1 || entries[0].get('href') !== `${ORIGIN}/${target}` || entries[0].size !== 3) reject('RELEASE_ALTERNATE_TARGET');
  }
  const lang = html.match(/<html lang="([^"]+)">/)?.[1];
  if (page === 'index.html' ? !['zh-TW', 'zh-Hant'].includes(lang) : lang !== 'en') reject('RELEASE_LANGUAGE');
  if (Object.values(CANDIDATE_BANNERS).some(banner => html.includes(banner))) reject('RELEASE_CANDIDATE_BANNER');
  return true;
}

async function expectedRelease(root) {
  if (Number(process.versions.node.split('.')[0]) < 24) reject('NODE_24_REQUIRED');
  await directory(root);
  await readDeploymentConfig(root);
  const url = new URL(ORIGIN);
  if (url.protocol !== 'https:' || url.origin !== ORIGIN || url.pathname !== '/' || url.port || url.username || url.password || url.search || url.hash) reject('RELEASE_ORIGIN_CONSTANT');
  if (!sameList([...PUBLIC_FILES].sort(), SOURCE_FILES.map(file => file.path))) reject('SOURCE_ALLOWLIST_CHANGED');
  await inventory(join(root, 'public'), PUBLIC_FILES);
  const input = new Map(); const sourceFiles = [];
  for (const pin of SOURCE_FILES) {
    const path = join(root, 'public', pin.path); const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== pin.bytes) reject('SOURCE_CHANGED');
    const bytes = await readFile(path); const digest = sha256(bytes);
    if (bytes.length !== pin.bytes || digest !== pin.sha256) reject('SOURCE_CHANGED');
    sourceFiles.push({ path: pin.path, bytes: bytes.length, sha256: digest }); input.set(pin.path, bytes);
  }
  const output = new Map(input);
  for (const page of PAGES) { const html = releaseHtml(input.get(page), page); validateReleaseSeo(html, page); output.set(page, html); }
  output.set('_redirects', Buffer.from(REDIRECTS));
  output.set('robots.txt', Buffer.from(`User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap.xml\n`));
  const headers = input.get('_headers').toString('utf8');
  const directive = /^  X-Robots-Tag: noindex, nofollow$/gm;
  if ([...headers.matchAll(directive)].length !== 1) reject('SOURCE_HEADERS');
  output.set('_headers', Buffer.from(headers.replace(directive, '  X-Robots-Tag: index, follow')));
  output.set('sitemap.xml', Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${ORIGIN}/index.html</loc></url>\n  <url><loc>${ORIGIN}/en/index.html</loc></url>\n</urlset>\n`));
  const files = SITE_FILES.map(path => ({ path, bytes: output.get(path).length, sha256: sha256(output.get(path)) }));
  const manifest = { schemaVersion: 1, mode: 'release-candidate', origin: ORIGIN, toolSlug: TOOL_SLUG, files, sourceFiles };
  return { output, manifest, manifestBytes: Buffer.from(JSON.stringify(manifest, null, 2) + '\n') };
}

async function validateOutput(root, expected) {
  const base = join(root, 'release-artifacts');
  // Manifest paths are never used to read files; only this closed allowlist is.
  await inventory(base, OUTPUT_FILES);
  const stat = await lstat(join(base, 'manifest.json'));
  if (stat.size > MANIFEST_LIMIT) reject('MANIFEST_TOO_LARGE');
  const actual = await readFile(join(base, 'manifest.json'));
  if (!actual.equals(expected.manifestBytes)) reject('MANIFEST_MISMATCH');
  for (const path of SITE_FILES) {
    const expectedBytes = expected.output.get(path); const file = join(base, 'site', path); const assetStat = await lstat(file);
    if (assetStat.size !== expectedBytes.length) reject('RELEASE_ASSET_MISMATCH');
    const bytes = await readFile(file);
    if (!bytes.equals(expectedBytes)) reject('RELEASE_ASSET_MISMATCH');
    if (PAGES.includes(path)) validateReleaseSeo(bytes, path);
  }
}
function summary(expected) {
  return { mode: 'release-candidate', origin: ORIGIN, toolSlug: TOOL_SLUG,
    site: 'release-artifacts/site/', files: expected.manifest.files.length,
    bytes: expected.manifest.files.reduce((total, file) => total + file.bytes, 0),
    manifestSha256: sha256(expected.manifestBytes) };
}
export async function checkRelease({ root = ROOT } = {}) {
  const expected = await expectedRelease(resolve(root));
  await validateOutput(resolve(root), expected);
  return { ...summary(expected), status: 'CHECKED_OFFLINE' };
}
export async function buildRelease({ root = ROOT } = {}) {
  const base = resolve(root); const output = join(base, 'release-artifacts');
  // Finish all input validation and byte construction before any output writes.
  const expected = await expectedRelease(base);
  if (await exists(output)) {
    await validateOutput(base, expected);
    return { ...summary(expected), status: 'EXISTING_BYTES_VERIFIED' };
  }
  // Exclusive creation only. Existing, partial or tampered output is never
  // deleted or overwritten, including a manifest rewritten with an asset.
  await mkdir(output);
  await mkdir(join(output, 'site'));
  const directories = new Set(['']);
  for (const path of SITE_FILES) {
    const parts = path.split('/'); parts.pop();
    for (let length = 1; length <= parts.length; length++) {
      const dir = parts.slice(0, length).join('/');
      if (!directories.has(dir)) { await mkdir(join(output, 'site', dir)); directories.add(dir); }
    }
    await writeFile(join(output, 'site', path), expected.output.get(path), { flag: 'wx' });
  }
  await writeFile(join(output, 'manifest.json'), expected.manifestBytes, { flag: 'wx' });
  await validateOutput(base, expected);
  return { ...summary(expected), status: 'BUILT_OFFLINE' };
}
export async function runRelease(args, options) {
  const mode = parseArguments(args);
  return mode === 'build' ? buildRelease(options) : checkRelease(options);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try { process.stdout.write(`${JSON.stringify(await runRelease(process.argv.slice(2)))}\n`); }
  catch (error) {
    const known = /^[A-Z][A-Z_]+(?:: [a-zA-Z0-9_./-]+)?$/.test(error.message);
    process.stderr.write(`${known ? error.message : 'RELEASE_FAILED'}\n`); process.exitCode = 1;
  }
}
