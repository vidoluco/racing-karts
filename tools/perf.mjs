#!/usr/bin/env node
// tools/perf.mjs [track] [--views 1,2,3,4] [--seconds 8] [--size 1920x1080] [--capped] [--quality capture|auto] [--sweep]
// A real race (four karts on autopilot) in a real Metal browser, frame intervals taken from requestAnimationFrame, at full
// resolution unless --quality auto. Uncapped by default, so the interval shows the headroom. Draw calls and triangles are
// the worst seen in the run, against the budget. --sweep walks the camera round the whole lap at one view for the budget.
import { launch, gpuInfo } from './harness.mjs';
import { serveDev } from './render-dev.mjs';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const has = (k) => argv.includes(`--${k}`);
const track = argv.find((a, i) => !a.startsWith('--') && (i === 0 || !argv[i - 1].startsWith('--'))) || 'antelao';
const viewsList = opt('views', '1,2,3,4').split(',').map(Number), seconds = +opt('seconds', 8), [W, H] = opt('size', '1920x1080').split('x').map(Number);
const quality = opt('quality', 'capture');
const BUDGET = { fps: { 1: 60, 2: 60, 3: 45, 4: 45 }, calls: 150, tris: 500000 };
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

const srv = await serveDev({ dist: process.env.DIST || null });
const browser = await launch('metal', { uncapped: !has('capped') });
const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })).newPage();
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
let failed = false;
const open = async (views) => {
  await page.goto(`${srv.base}/?track=${track}&views=${views}&quality=${quality}&countdown=0&auto=1${opt('query', null) ? `&${opt('query')}` : ''}`); // --query weather=rain&night=1
  await page.waitForFunction(() => window.__dev?.ready || window.__dev?.error, null, { timeout: 180000 });
  const err = await page.evaluate(() => window.__dev.error);
  if (err) throw new Error(err);
};
try {
  await open(1);
  console.log(`gpu: ${(await gpuInfo(page)).renderer}, ${W}x${H}, ${has('capped') ? 'vsync' : 'uncapped'}, quality ${quality}`);
  if (has('sweep')) {
    const out = await page.evaluate(async () => {
      const D = window.__dev, rows = [];
      for (let u = 0; u < 1; u += 0.01) { D.at(u, { others: true, settle: 8 }); const s = D.draw(); rows.push({ u: +u.toFixed(2), calls: s.perView, tris: s.trianglesPerView }); await new Promise((r) => setTimeout(r)); }
      return rows;
    });
    const mc = out.reduce((a, b) => (b.calls > a.calls ? b : a)), mt = out.reduce((a, b) => (b.tris > a.tris ? b : a));
    console.log(`sweep ${out.length} places: worst calls ${mc.calls} at u ${mc.u} (budget ${BUDGET.calls}), worst triangles ${(mt.tris / 1000).toFixed(0)}k at u ${mt.u} (budget ${BUDGET.tris / 1000}k)`);
    if (mc.calls > BUDGET.calls || mt.tris > BUDGET.tris) failed = true;
  }
  for (const views of viewsList) {
    await open(views);
    const r = await page.evaluate(async (ms) => {
      const D = window.__dev, iv = []; let maxCalls = 0, maxTris = 0, last = 0, scale = 1, stop = false;
      const px = new Uint8Array(4);
      D.run();
      await new Promise((res) => setTimeout(res, 1500)); // past the first gathers and shader compiles
      const t0 = performance.now();
      const tick = () => {
        // a one pixel read waits for the GPU to finish the frame: uncapped intervals alone only time the commands being issued
        D.renderer.three.getContext().readPixels(0, 0, 1, 1, 6408, 5121, px);
        const n = performance.now();
        if (last) iv.push(n - last);
        last = n;
        const s = D.stats(); maxCalls = Math.max(maxCalls, s.perView); maxTris = Math.max(maxTris, s.trianglesPerView); scale = s.scale;
        if (!stop) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      await new Promise((res) => setTimeout(res, ms));
      stop = true; D.stop();
      return { iv, maxCalls, maxTris, scale, wall: performance.now() - t0 };
    }, seconds * 1000);
    const fps = (r.iv.length / r.iv.reduce((a, b) => a + b, 0)) * 1000, ok = fps >= BUDGET.fps[views] && r.maxCalls <= BUDGET.calls && r.maxTris <= BUDGET.tris;
    if (!ok) failed = true;
    console.log(`views ${views}: ${fps.toFixed(1)} fps (budget ${BUDGET.fps[views]}), interval p50 ${q(r.iv, 0.5).toFixed(1)} p95 ${q(r.iv, 0.95).toFixed(1)} p99 ${q(r.iv, 0.99).toFixed(1)} ms, scale ${r.scale.toFixed(2)}, per view worst ${r.maxCalls.toFixed(0)} calls (${BUDGET.calls}), ${(r.maxTris / 1000).toFixed(0)}k tris (${BUDGET.tris / 1000}k), ${ok ? 'ok' : 'OVER'}`);
  }
} finally {
  await Promise.race([browser.close(), new Promise((res) => setTimeout(res, 3000))]);
  srv.close();
}
process.exit(failed ? 1 : 0);
