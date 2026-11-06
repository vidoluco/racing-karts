#!/usr/bin/env node
// tools/budget-sweep.mjs [tracks,comma] [--views 1,4] [--step 0.005] [--settle 16] [--size 1280x720]: walks every track in small
// steps of the lap with the field around view 0's kart and prints the worst draw calls and triangles per view against the
// budget, and where they happen. test/render.test.mjs uses sweep() for the real assertion; this is the same thing by hand.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { launch } from './harness.mjs';
import { serveDev, ROOT } from './render-dev.mjs';

export const BUDGET = { calls: 150, tris: 500000 };
export const allTracks = () => readdirSync(join(ROOT, 'src/world/tracks')).filter((f) => f.endsWith('.js') && !f.startsWith('_')).map((f) => f.replace('.js', ''));

export async function sweep(page, srv, track, { views = 1, step = 0.005, settle = 16, query = '', before = null } = {}) {
  await page.goto(`${srv.base}/?track=${track}&views=${views}&quality=capture&countdown=1${query}`);
  await page.waitForFunction(() => window.__dev?.ready || window.__dev?.error, null, { timeout: 240000 });
  const err = await page.evaluate(() => window.__dev.error);
  if (err) throw new Error(`${track}: ${err}`);
  if (before) await page.evaluate(before);
  // a slice at a time, so the page never holds one long task and a stalled browser is seen as a timeout, not as a hang
  const worst = { calls: 0, callsAt: 0, tris: 0, trisAt: 0, spots: 0, ms: 0 };
  const n = Math.round(1 / step);
  for (let from = 0; from < n; from += 40) {
    const r = await page.evaluate(({ from, to, step, settle }) => {
      const D = window.__dev, t0 = performance.now(); let calls = 0, callsAt = 0, tris = 0, trisAt = 0, spots = 0;
      for (let i = from; i < to; i++) {
        const u = (i + 0.5) * step;
        D.at(u, { others: true, settle });
        const s = D.draw();
        spots++;
        if (s.perView > calls) { calls = s.perView; callsAt = u; }
        if (s.trianglesPerView > tris) { tris = s.trianglesPerView; trisAt = u; }
      }
      return { calls, callsAt, tris, trisAt, spots, ms: performance.now() - t0 };
    }, { from, to: Math.min(n, from + 40), step, settle });
    if (r.calls > worst.calls) { worst.calls = r.calls; worst.callsAt = r.callsAt; }
    if (r.tris > worst.tris) { worst.tris = r.tris; worst.trisAt = r.trisAt; }
    worst.spots += r.spots; worst.ms += r.ms;
  }
  return worst;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
  const tracks = argv[0] && !argv[0].startsWith('--') ? argv[0].split(',') : allTracks();
  const viewsList = opt('views', '1,4').split(',').map(Number), step = +opt('step', 0.005), settle = +opt('settle', 16), [W, H] = opt('size', '1280x720').split('x').map(Number);
  const srv = await serveDev({});
  const browser = await launch('metal');
  const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })).newPage();
  page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
  let failed = false;
  try {
    for (const id of tracks) for (const views of viewsList) {
      const t0 = Date.now(), w = await sweep(page, srv, id, { views, step, settle });
      const over = w.calls > BUDGET.calls || w.tris > BUDGET.tris;
      if (over) failed = true;
      console.log(`${id.padEnd(15)} views ${views}: ${(w.tris / 1000).toFixed(0)}k tris at u ${w.trisAt.toFixed(3)}, ${w.calls} calls at u ${w.callsAt.toFixed(3)}, ${w.spots} spots, ${((Date.now() - t0) / 1000).toFixed(0)} s${over ? '  OVER' : ''}`);
    }
  } finally {
    await Promise.race([browser.close(), new Promise((res) => setTimeout(res, 3000))]);
    srv.close();
  }
  process.exit(failed ? 1 : 0);
}
