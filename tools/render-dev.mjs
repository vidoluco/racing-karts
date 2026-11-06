// Serves the render dev page: esbuild bundles dev/render-dev.js into a private folder, a tiny static server hands it out with
// the horizon data. Shared by tools/shoot.mjs, tools/perf.mjs and test/render.test.mjs. Nothing is written to the repo's dist.
import { build } from 'esbuild';
import http from 'node:http';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.bin': 'application/octet-stream', '.png': 'image/png', '.jpg': 'image/jpeg' };

export async function serveDev({ dist = null, entry = 'dev/render-dev.js', html = 'dev/render.html', out = 'render-dev.js' } = {}) {
  const own = !dist;
  dist ||= mkdtempSync(join(tmpdir(), 'rk-render-'));
  await build({ entryPoints: [join(ROOT, entry)], bundle: true, format: 'esm', outfile: join(dist, out), target: 'es2022', logLevel: 'warning', sourcemap: 'inline', absWorkingDir: ROOT });
  copyFileSync(join(ROOT, html), join(dist, 'index.html'));
  const server = http.createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
    // the bundle and the page come from the private folder, data straight from the repo
    const file = path === '/' ? join(dist, 'index.html') : path.startsWith('/data/') || path.startsWith('/assets/') ? join(ROOT, path) : join(dist, path);
    if (!existsSync(file)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(readFileSync(file));
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const { port } = server.address();
  return { base: `http://127.0.0.1:${port}`, dist, close() { server.close(); server.closeAllConnections?.(); if (own) rmSync(dist, { recursive: true, force: true }); } };
}
