import { lstat, readdir, readFile } from 'node:fs/promises';
import { resolve, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const PUBLIC_FILES = Object.freeze([
  '_headers', 'robots.txt', 'index.html', 'en/index.html', 'styles/app.css',
  'js/app.js', 'js/i18n.mjs', 'js/core/errors.mjs', 'js/core/csv.mjs',
  'js/core/reconcile.mjs', 'js/core/export.mjs', 'js/core/session.mjs',
]);
export const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'none'; font-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; worker-src 'none'";
export const HEADERS = Object.freeze({
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'X-Frame-Options': 'DENY',
  'X-Robots-Tag': 'noindex, nofollow',
  'Cache-Control': 'no-store',
});
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export async function inventory(directory, allowed, { required = true } = {}) {
  const base = resolve(directory);
  const names = new Set(allowed);
  const directories = new Set(['']);
  for (const name of names) {
    if (!/^[a-zA-Z0-9_./-]+$/.test(name) || name.split('/').some(p => !p || p === '.' || p === '..')) throw new Error('UNSAFE_ALLOWLIST');
    const parts = name.split('/');
    while (parts.length > 1) { parts.pop(); directories.add(parts.join('/')); }
  }
  const rootStat = await lstat(base);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('UNSAFE_DIRECTORY');
  const found = [];
  async function walk(folder) {
    const entries = await readdir(folder, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(folder, entry.name);
      const rel = relative(base, full).split(sep).join('/');
      const stat = await lstat(full);
      if (stat.isSymbolicLink()) throw new Error('LINK_REJECTED');
      if (stat.isDirectory()) {
        if (!directories.has(rel)) throw new Error(`UNKNOWN_DIRECTORY: ${rel}`);
        await walk(full);
      } else if (stat.isFile() && names.has(rel)) found.push(rel);
      else throw new Error(`UNKNOWN_FILE: ${rel}`);
    }
  }
  await walk(base);
  if (required && [...names].some(name => !found.includes(name))) throw new Error('MISSING_REQUIRED_FILE');
  return found.sort();
}

export async function sourceManifest(base = join(ROOT, 'public')) {
  await inventory(base, PUBLIC_FILES);
  return Promise.all([...PUBLIC_FILES].sort().map(async path => {
    const bytes = await readFile(join(base, path));
    return { path, bytes: bytes.length, sha256: sha256(bytes) };
  }));
}
