import { mkdir, readFile, writeFile, lstat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, PUBLIC_FILES, inventory, sourceManifest, sha256 } from './files.mjs';
import { check } from './check.mjs';

export async function build({ root = ROOT, verify = true } = {}) {
  if (verify) await check();
  const source = join(root, 'public');
  const target = join(root, 'dist');
  const files = await sourceManifest(source);
  let exists = false;
  try { await lstat(target); exists = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (exists) {
    const present = await inventory(target, [...PUBLIC_FILES, 'build-manifest.json'], { required: false });
    if (present.length) {
      if (!present.includes('build-manifest.json')) throw new Error('UNMANAGED_OUTPUT');
      const prior = JSON.parse(await readFile(join(target, 'build-manifest.json'), 'utf8'));
      if (prior.schemaVersion !== 1 || prior.mode !== 'preview' || !Array.isArray(prior.files) || prior.files.length !== PUBLIC_FILES.length) throw new Error('STALE_MANIFEST');
      if (present.length !== PUBLIC_FILES.length + 1) throw new Error('INCOMPLETE_OUTPUT');
      const seen = new Set();
      for (const item of prior.files) {
        if (!PUBLIC_FILES.includes(item.path) || seen.has(item.path)) throw new Error('STALE_MANIFEST');
        seen.add(item.path);
        const bytes = await readFile(join(target, item.path));
        if (bytes.length !== item.bytes || sha256(bytes) !== item.sha256) throw new Error('MODIFIED_OUTPUT');
      }
    }
  }
  await mkdir(target, { recursive: true });
  for (const { path } of files) {
    await mkdir(dirname(join(target, path)), { recursive: true });
    await writeFile(join(target, path), await readFile(join(source, path)));
  }
  const manifest = { schemaVersion: 1, mode: 'preview', files };
  await writeFile(join(target, 'build-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return { mode: 'preview', files: files.length, bytes: files.reduce((n, f) => n + f.bytes, 0) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try { process.stdout.write(`${JSON.stringify(await build())}\n`); }
  catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
