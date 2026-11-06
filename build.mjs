// Bundles the game and the phone controller as ES modules and copies the static files. Output in dist/, or in DIST when set,
// so that several agents can each run their own copy. --dev: unminified with sourcemaps.
import { build } from 'esbuild';
import { cpSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const dist = resolve(process.env.DIST || join(root, 'dist'));
const dev = process.argv.includes('--dev');
const inRoot = (p) => join(root, p);

const bundles = [['src/main.js', 'game.js'], ['controller/pad.js', 'pad.js']];
const files = [['index.template.html', 'index.html'], ['controller/pad.html', 'pad.html']];
const dirs = [['data/horizon', 'data/horizon'], ['assets/ui', 'assets/ui'], ['assets/backdrops', 'assets/backdrops'], ['assets/voice', 'assets/voice']];

mkdirSync(dist, { recursive: true });
const done = [];
await Promise.all(bundles.map(async ([entry, out]) => {
  if (!existsSync(inRoot(entry))) return;
  await build({
    absWorkingDir: root, entryPoints: [entry], outfile: join(dist, out),
    bundle: true, format: 'esm', target: 'es2022', minify: !dev, sourcemap: dev, legalComments: 'none', logLevel: 'warning',
  });
  done.push(out);
}));
for (const [src, out] of files) {
  if (!existsSync(inRoot(src))) continue;
  copyFileSync(inRoot(src), join(dist, out));
  done.push(out);
}
for (const [src, out] of dirs) {
  if (!existsSync(inRoot(src))) continue;
  mkdirSync(join(dist, out), { recursive: true });
  cpSync(inRoot(src), join(dist, out), { recursive: true });
  done.push(`${out}/`);
}
console.log(`${dist} ready: ${done.join(', ') || 'nothing to build'}`);
