#!/usr/bin/env node
// tools/long-check.mjs [track] [--views 1,2,4] [--speed 4] [--size 1920x1080] [--km 10] [--shots dir]: a whole lap of a long
// track, every kart on autopilot, in a real Metal browser at `speed` times real time, closing each frame with a one pixel read.
// Prints frame times, frames on which the stream changed against the others, the worst draw calls and triangles per view
// against the budget, and JS heap and GPU figures along the lap. Exit code 1 if a budget is broken or memory grows. Default
// track: the synthetic 10 km lap. Close other GPU users first if the fps figure matters.
import { launch, gpuInfo } from './harness.mjs';
import { serveDev } from './render-dev.mjs';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const track = argv.find((a, i) => !a.startsWith('--') && (i === 0 || !argv[i - 1].startsWith('--'))) || 'long-test';
const viewsList = opt('views', '1,2,4').split(',').map(Number), speed = +opt('speed', 4), km = opt('km', '10'), [W, H] = opt('size', '1920x1080').split('x').map(Number);
const BUDGET = { fps: { 1: 60, 2: 60, 3: 45, 4: 45 }, calls: 150, tris: 500000 };

export async function lapCheck(page, srv, { track = 'long-test', views = 1, speed = 4, km = 10, query = '', onU = null } = {}) {
  await page.goto(`${srv.base}/?track=${track}&km=${km}&views=${views}&quality=capture&countdown=0&laps=1&difficulty=hard&auto=1${query}`);
  await page.waitForFunction(() => window.__dev?.ready || window.__dev?.error, null, { timeout: 240000 });
  const err = await page.evaluate(() => window.__dev.error);
  if (err) throw new Error(err);
  const cdp = await page.context().newCDPSession(page);
  const heap = async () => { await cdp.send('HeapProfiler.collectGarbage'); const h = await cdp.send('Runtime.getHeapUsage'); return h.usedSize + (h.backingStorageSize || 0); }; // with the typed arrays, where the world's data lives
  const memory = [];
  const load = await page.evaluate(() => window.__dev.loadMs);
  // in slices, so that the heap can be read between them with a real collection
  const slices = 10;
  const rows = [];
  for (let s = 0; s < slices; s++) {
    const r = await page.evaluate(async ({ speed, slice, slices }) => {
      const D = window.__dev, R = D.renderer, gl = R.three.getContext(), px = new Uint8Array(4), K = D.race.state.karts;
      const iv = [], swapped = []; let last = 0, maxCalls = 0, maxTris = 0, worstAt = 0, prevSwaps = D.stats().stream?.swaps ?? 0;
      const goal = (slice + 1) / slices;
      await new Promise((done) => {
        const tick = () => {
          // the view's kart has driven this share of the lap
          if (K[0].finished || K[0].progress >= goal) { done(); return; }
          const st = D.stepDraw(speed);
          gl.readPixels(0, 0, 1, 1, 6408, 5121, px);
          const n = performance.now();
          if (last) { iv.push(n - last); swapped.push((st.stream?.swaps ?? 0) !== prevSwaps ? 1 : 0); }
          last = n; prevSwaps = st.stream?.swaps ?? 0;
          if (st.perView > maxCalls) { maxCalls = st.perView; worstAt = K[0].u; }
          if (st.trianglesPerView > maxTris) maxTris = st.trianglesPerView;
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      return { iv, swapped, maxCalls, maxTris, worstAt, u: K[0].u, info: { ...R.three.info.memory }, gpu: D.stats().stream?.gpuBytes ?? 0, finished: K.filter((k) => k.finished).length };
    }, { speed, slice: s, slices });
    rows.push(r);
    memory.push({ at: (s + 1) / slices, heap: await heap(), geometries: r.info.geometries, textures: r.info.textures, gpu: r.gpu });
    onU?.(s + 1, slices);
  }
  // the rest of the field, faster, undrawn: did everyone get home?
  const home = await page.evaluate(() => {
    const D = window.__dev, K = D.race.state.karts;
    for (let i = 0; i < 60 * 240 && D.race.state.phase !== 'done' && K.some((k) => !k.finished); i++) D.frames(1, false);
    return { finished: K.filter((k) => k.finished).length, total: K.length, times: K.map((k) => +k.finishT.toFixed(1)) };
  });
  const iv = rows.flatMap((r) => r.iv), sw = rows.flatMap((r) => r.swapped);
  return { load, rows, iv, sw, memory, home, maxCalls: Math.max(...rows.map((r) => r.maxCalls)), maxTris: Math.max(...rows.map((r) => r.maxTris)) };
}

export const quantile = (a, p) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
export function summarize(r) {
  const on = r.iv.filter((_, i) => r.sw[i]), off = r.iv.filter((_, i) => !r.sw[i]);
  const heaps = r.memory.map((m) => m.heap), first = heaps[1], end = heaps[heaps.length - 1];
  return {
    frames: r.iv.length, fps: (r.iv.length / r.iv.reduce((a, b) => a + b, 0)) * 1000,
    p50: quantile(r.iv, 0.5), p99: quantile(r.iv, 0.99), worst: Math.max(...r.iv),
    onFrames: on.length, onP50: quantile(on, 0.5), onP99: quantile(on, 0.99), onWorst: on.length ? Math.max(...on) : 0, offP50: quantile(off, 0.5), offP99: quantile(off, 0.99), offWorst: off.length ? Math.max(...off) : 0,
    heapGrowth: end / first - 1, heapMB: end / 1e6, geometries: r.memory.map((m) => m.geometries), textures: r.memory.map((m) => m.textures), gpuMB: r.memory.map((m) => +(m.gpu / 1e6).toFixed(1)),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const srv = await serveDev({ dist: process.env.DIST || null });
  const browser = await launch('metal', { uncapped: true, extra: ['--enable-precise-memory-info'] });
  const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })).newPage();
  page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
  let failed = false;
  try {
    for (const views of viewsList) {
      const r = await lapCheck(page, srv, { track, views, speed, km });
      const s = summarize(r);
      if (views === viewsList[0]) console.log(`gpu: ${(await gpuInfo(page)).renderer}, ${W}x${H}, ${speed}x real time, load ${(r.load / 1000).toFixed(1)} s`);
      const ok = s.fps >= BUDGET.fps[views] && r.maxCalls <= BUDGET.calls && r.maxTris <= BUDGET.tris && s.heapGrowth < 0.05 && r.home.finished === r.home.total;
      if (!ok) failed = true;
      console.log(`views ${views}: ${s.frames} frames, ${s.fps.toFixed(0)} fps (budget ${BUDGET.fps[views]}), p50 ${s.p50.toFixed(1)} p99 ${s.p99.toFixed(1)} worst ${s.worst.toFixed(1)} ms; per view worst ${r.maxCalls.toFixed(0)} calls (${BUDGET.calls}), ${(r.maxTris / 1000).toFixed(0)}k tris (${BUDGET.tris / 1000}k), ${ok ? 'ok' : 'OVER'}`);
      console.log(`  frames with a stream change ${s.onFrames}: p50 ${s.onP50.toFixed(1)} p99 ${s.onP99.toFixed(1)} worst ${s.onWorst.toFixed(1)} ms; others: p50 ${s.offP50.toFixed(1)} p99 ${s.offP99.toFixed(1)} worst ${s.offWorst.toFixed(1)} ms`);
      console.log(`  heap ${s.heapMB.toFixed(0)} MB, growth from 20% to the end of the lap ${(s.heapGrowth * 100).toFixed(1)}%; geometries ${s.geometries.join(' ')}; textures ${s.textures[0]}..${s.textures[s.textures.length - 1]}; near and far buffers on the GPU, MB ${s.gpuMB.join(' ')}`);
      console.log(`  home ${r.home.finished}/${r.home.total}, times ${r.home.times.join(' ')}`);
    }
  } finally {
    await Promise.race([browser.close(), new Promise((res) => setTimeout(res, 3000))]);
    srv.close();
  }
  process.exit(failed ? 1 : 0);
}
