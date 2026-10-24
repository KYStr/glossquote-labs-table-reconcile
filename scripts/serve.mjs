import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, PUBLIC_FILES, HEADERS, inventory } from './files.mjs';

export const HOST = '127.0.0.1';
export const PORT = 4222;
const routes = new Map(PUBLIC_FILES.filter(f => f !== '_headers').map(f => [`/${f}`, f]));
routes.set('/', 'index.html');
routes.set('/en/', 'en/index.html');
const mimes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };

export function resolveRequest({ method, url, host }) {
  if (host !== `${HOST}:${PORT}`) return { status: 403 };
  if (method !== 'GET' && method !== 'HEAD') return { status: 405, allow: 'GET, HEAD' };
  if (typeof url !== 'string' || !routes.has(url)) return { status: 404 };
  const path = routes.get(url);
  return { status: 200, path, mime: mimes[extname(path)] };
}

export async function start() {
  await inventory(join(ROOT, 'public'), PUBLIC_FILES);
  const server = createServer(async (req, res) => {
    const decision = resolveRequest({ method: req.method, url: req.url, host: req.headers.host });
    const headers = { ...HEADERS, 'Content-Type': 'text/plain; charset=utf-8' };
    if (decision.allow) headers.Allow = decision.allow;
    let body = Buffer.from('Request rejected.\n');
    if (decision.status === 200) {
      try { body = await readFile(join(ROOT, 'public', decision.path)); headers['Content-Type'] = decision.mime; }
      catch { res.writeHead(500, headers); res.end('Preview file unavailable.\n'); return; }
    }
    res.writeHead(decision.status, { ...headers, 'Content-Length': body.length });
    res.end(req.method === 'HEAD' ? undefined : body);
  });
  server.on('error', () => { process.stderr.write('PREVIEW_LISTEN_FAILED: use an available task-owned port; no process was stopped.\n'); process.exitCode = 1; });
  server.listen(PORT, HOST, () => process.stdout.write(`Local preview: http://${HOST}:${PORT}\n`));
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) await start();
