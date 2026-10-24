import { readFile, writeFile, readdir, lstat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, PUBLIC_FILES, sha256, inventory } from './files.mjs';

export const SPEC_FILES = Object.freeze([
  'START-HERE.md', 'AGENTS.md', 'README.md', 'PRODUCT.md', 'TECHNICAL.md', 'UX-SEO.md', 'TASKS.md', 'ACCEPTANCE.md',
  'docs/BRAND.md', 'docs/DESIGN-SYSTEM.md', 'docs/ENGINEERING.md', 'docs/GIT-PUBLICATION-SAFETY.md', 'docs/PRIVACY-SECURITY.md',
]);
export async function sourceEntries() {
  const paths = ['package.json', '.gitignore', ...PUBLIC_FILES.map(path => `public/${path}`)];
  await inventory(join(ROOT, 'public'), PUBLIC_FILES);
  for (const dir of ['scripts', 'test']) {
    for (const name of await readdir(join(ROOT, dir))) {
      const stat = await lstat(join(ROOT, dir, name));
      if (stat.isSymbolicLink() || !stat.isFile() || !name.endsWith('.mjs')) throw new Error('UNREVIEWED_SOURCE_ENTRY');
      paths.push(`${dir}/${name}`);
    }
  }
  return Promise.all(paths.sort().map(async path => {
    const stat = await lstat(join(ROOT, path)); if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('UNSAFE_SOURCE_FILE');
    const bytes = await readFile(join(ROOT, path)); return { path, bytes: bytes.length, sha256: sha256(bytes) };
  }));
}
export async function capture({ verify = false } = {}) {
  const files = await sourceEntries();
  const sourceSetSha256 = sha256(files.map(file => `${file.path}\0${file.bytes}\0${file.sha256}\n`).join(''));
  const manifest = { schemaVersion: 1, tool: 'table-reconcile', version: '0.1.0-m1-candidate', sourceSetSha256, files };
  const path = join(ROOT, 'evidence/m1/source-manifest.json');
  if (verify) {
    if (JSON.stringify(JSON.parse(await readFile(path, 'utf8'))) !== JSON.stringify(manifest)) throw new Error('SOURCE_CHANGED');
  } else {
    const text = JSON.stringify(manifest, null, 2) + '\n';
    await writeFile(path, text);
    await writeFile(join(ROOT, 'evidence/m1/source-manifest.sha256'), `${sha256(text)}  source-manifest.json\n`);
    const specifications = await Promise.all(SPEC_FILES.map(async path => {
      const bytes = await readFile(join(ROOT, path)); return { path, bytes: bytes.length, sha256: sha256(bytes) };
    }));
    await writeFile(join(ROOT, 'evidence/m1/specification-manifest.json'), JSON.stringify({ note: '13 unchanged contracts; HANDOFF is the fourteenth supplied document and is intentionally updated.', files: specifications }, null, 2) + '\n');
  }
  return { files: files.length, sourceSetSha256, status: verify ? 'VERIFIED' : 'CAPTURED' };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try { process.stdout.write(`${JSON.stringify(await capture({ verify: process.argv.includes('--verify') }))}\n`); }
  catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
