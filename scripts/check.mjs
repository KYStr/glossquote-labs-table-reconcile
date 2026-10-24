import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { ROOT, PUBLIC_FILES, HEADERS, inventory } from './files.mjs';
import { verifyPages } from './pages.mjs';
import { readDeploymentConfig } from './release.mjs';

const seo = {
  'index.html': { lang: 'zh-TW', title: '兩份 CSV 表格對帳｜找出缺列與欄位差異', description: '在本機用唯一鍵核對兩份 CSV，找出一致、僅左、僅右及不同欄位，下載差異報告與 JSON。', h1: '把兩份清單逐列對起來' },
  'en/index.html': { lang: 'en', title: 'Compare Two CSV Tables | Find Missing and Changed Rows', description: 'Match two local CSV files by a unique key. Review same, left-only, right-only, and changed rows, then download a report and JSON.', h1: 'See exactly what changed between two lists' },
};

export async function check({ scaffold = false } = {}) {
  if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('NODE_24_REQUIRED');
  await readDeploymentConfig(ROOT);
  const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));
  if (!pkg.private || pkg.type !== 'module' || pkg.engines?.node !== '>=24' || pkg.dependencies || pkg.devDependencies) throw new Error('PACKAGE_CONTRACT');
  const commands = { test: 'node --test test/*.test.mjs', check: 'node scripts/check.mjs', build: 'node scripts/build.mjs', dev: 'node scripts/serve.mjs', 'build:release': 'node scripts/release.mjs build', 'check:release': 'node scripts/release.mjs check' };
  if (Object.keys(pkg.scripts || {}).length !== 6 || Object.entries(commands).some(([key, command]) => pkg.scripts?.[key] !== command)) throw new Error('SCRIPT_CONTRACT');
  const files = await inventory(join(ROOT, 'public'), PUBLIC_FILES);
  const scripts = (await readdir(join(ROOT, 'scripts'))).filter(x => x.endsWith('.mjs')).map(x => `scripts/${x}`);
  const tests = (await readdir(join(ROOT, 'test'))).filter(x => x.endsWith('.mjs')).map(x => `test/${x}`);
  for (const path of [...files.filter(x => /\.(mjs|js)$/.test(x)).map(x => `public/${x}`), ...scripts, ...tests]) {
    const child = spawnSync(process.execPath, ['--check', join(ROOT, path)], { shell: false, windowsHide: true, encoding: 'utf8' });
    if (child.error || child.status !== 0) throw new Error(`ESM_SYNTAX: ${path}`);
  }
  for (const file of files) {
    const text = await readFile(join(ROOT, 'public', file), 'utf8');
    if (/\.(js|mjs)$/.test(file) && /\b(innerHTML|outerHTML|insertAdjacentHTML|eval|localStorage|sessionStorage|indexedDB|XMLHttpRequest|WebSocket|sendBeacon)\b|\bfetch\s*\(|\bconsole\.|document\.write|document\.cookie|serviceWorker|new\s+Function/.test(text)) throw new Error(`FORBIDDEN_API: ${file}`);
    if (/\.(css|js|mjs)$/.test(file) && /https?:\/\/|@import|url\s*\(/.test(text)) throw new Error(`REMOTE_RESOURCE: ${file}`);
    if (/\.(js|mjs)$/.test(file)) for (const match of text.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) {
      if (!match[1].startsWith('./') && !match[1].startsWith('../')) throw new Error('NONLOCAL_MODULE');
      const path = fileURLToPath(new URL(match[1], new URL(`../public/${file}`, import.meta.url))).slice(join(ROOT, 'public').length + 1).replaceAll('\\', '/');
      if (!PUBLIC_FILES.includes(path)) throw new Error('MODULE_OUTSIDE_ALLOWLIST');
    }
    if (/js\/core\/(csv|reconcile|export|errors)\.mjs/.test(file) && /\b(document|window|Blob)\b/.test(text)) throw new Error(`IMPURE_ALGORITHM: ${file}`);
    if (file.endsWith('.html')) {
      if (/\son[a-z]+\s*=|\sstyle\s*=|<style\b|<iframe|<object|<embed|<base\b|<script(?![^>]*\bsrc=)/i.test(text)) throw new Error(`UNSAFE_HTML: ${file}`);
      if (!/<meta name="robots" content="noindex,nofollow">/.test(text) || /rel="canonical"|sitemap/i.test(text)) throw new Error(`PREVIEW_SEO: ${file}`);
      for (const match of text.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
        const value = match[1];
        if (value.startsWith('#')) continue;
        if (['https://glossquote.com/index.html', 'https://glossquote.com/en/index.html'].includes(value)) continue;
        if (!value.startsWith('/') || !PUBLIC_FILES.includes(value.slice(1))) throw new Error(`UNREVIEWED_REFERENCE: ${file}`);
      }
      if (!scaffold && (text.match(/<h1\b/g)?.length !== 1 || !text.includes('aria-live="polite"'))) throw new Error(`PAGE_SEMANTICS: ${file}`);
      if (!scaffold) {
        const expected = seo[file];
        if (!text.includes(`<html lang="${expected.lang}">`) || !text.includes(`<title>${expected.title}</title>`) || !text.includes(`<meta name="description" content="${expected.description}">`) || !text.includes(`<h1>${expected.h1}</h1>`)) throw new Error(`SEO_CONTENT: ${file}`);
        if ((text.match(/aria-live=/g) || []).length !== 1 || (text.match(/<script\b/g) || []).length !== 1) throw new Error('PAGE_RESOURCE_OR_LIVE_REGION_COUNT');
      }
    }
  }
  const headers = await readFile(join(ROOT, 'public/_headers'), 'utf8');
  for (const [key, value] of Object.entries(HEADERS)) if (!headers.includes(`  ${key}: ${value}\n`)) throw new Error('PREVIEW_HEADER_CONFIG');
  if (await readFile(join(ROOT, 'public/robots.txt'), 'utf8') !== 'User-agent: *\nDisallow: /\n') throw new Error('PREVIEW_ROBOTS');
  if (!scaffold) await verifyPages();
  return { files: files.length, syntaxFiles: scripts.length + tests.length + files.filter(x => /\.(mjs|js)$/.test(x)).length, mode: scaffold ? 'scaffold' : 'preview' };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try { process.stdout.write(`${JSON.stringify(await check({ scaffold: process.argv.includes('--scaffold') }))}\n`); }
  catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
