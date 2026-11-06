// The long track engine on a synthetic 10 km figure of eight, whose legs cross 14 m apart: searches stay windowed, a kart
// never jumps level, everyone finishes, the sim stays deterministic. The rendering half is at the end of the file.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { launch } from '../tools/harness.mjs';
import { serveDev } from '../tools/render-dev.mjs';
import { lapCheck, summarize } from '../tools/long-check.mjs';
import { longTestDef } from './helpers/long-track.mjs';
import { buildTrack } from '../src/world/track.js';
import { buildTerrain } from '../src/world/terrain.js';
import { createRace } from '../src/sim/index.js';
import { KART_IDS } from '../src/data/karts.js';

const def = longTestDef({}), track = buildTrack(def), terrain = buildTerrain(track), S = track.samples, n = track.n;
const arc = (a, b) => { const o = Math.abs(a - b) % n; return Math.min(o, n - o); };

// where the two legs pass over each other: the pair of samples far apart along the road and closest on the map
function findCrossing() {
  let best = null;
  const st = track.structures[0];
  for (let i = st.i0; i !== st.i1; i = (i + 1) % n) for (let j = 0; j < n; j += 1) {
    if (arc(i, j) < 400) continue;
    const e = (S.x[i] - S.x[j]) ** 2 + (S.z[i] - S.z[j]) ** 2;
    if (!best || e < best.e) best = { hi: i, lo: j, e };
  }
  return best;
}
const X = findCrossing();

test('long: 10 km, one band about every 500 m, in order, on the road', () => {
  assert.ok(track.long);
  assert.ok(track.length >= 9500 && track.length <= 10500, `length ${track.length}`);
  assert.ok(track.bands.length >= 18 && track.bands.length <= 22, `${track.bands.length} bands`);
  const us = track.bands.map((b) => b.u);
  for (let i = 1; i < us.length; i++) {
    const gap = (us[i] - us[i - 1]) * track.length;
    assert.ok(gap > 300 && gap < 750, `gap ${gap.toFixed(0)} m after band ${i - 1}`);
  }
  for (const b of track.bands) {
    assert.equal(b.boxes.length, 5);
    for (const j of track.jumps) assert.ok(arc(b.i, j.i) * track.step > 30, 'no crates on a jump lip');
  }
});

test('long: the two legs really cross, 14 m apart', () => {
  const dy = S.y[X.hi] - S.y[X.lo];
  assert.ok(Math.sqrt(X.e) < 3, `legs ${Math.sqrt(X.e).toFixed(1)} m apart on the map`);
  assert.ok(dy >= 6, `levels ${dy.toFixed(1)} m apart`);
});

test('long: the index finds exactly what a scan of the whole lap finds', () => {
  let seed = 12345;
  const r = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let q = 0; q < 1500; q++) {
    const x = terrain.x0 + r() * terrain.w * terrain.step, z = terrain.z0 + r() * terrain.h * terrain.step;
    let bd = Infinity;
    for (let k = 0; k < n; k++) { const e = (x - S.x[k]) ** 2 + (z - S.z[k]) ** 2; if (e < bd) bd = e; }
    const got = track.nearest(x, z), e = (x - S.x[got.i]) ** 2 + (z - S.z[got.i]) ** 2;
    assert.ok(Math.abs(e - bd) < 1e-3, `off by ${Math.sqrt(e) - Math.sqrt(bd)} m at ${x}, ${z}`);
  }
});

test('long: nearest with a hint stays on its level through the crossing, even when the hint has gone stale', () => {
  for (const [i0, name] of [[X.hi, 'upper'], [X.lo, 'lower']]) {
    let h = (i0 - 60 + n) % n;
    for (let o = -60; o <= 60; o++) {
      const i = (i0 + o + n) % n, d = 5 * Math.sin(o / 7), q = track.nearest(S.x[i] + S.nx[i] * d, S.z[i] + S.nz[i] * d, h);
      assert.ok(arc(q.i, i) <= 2, `${name} leg: at ${i} found ${q.i}`);
      h = q.f;
    }
    // far off the road with the hint on one level: a rescue, a kart thrown wide. The search must come back to this level.
    const far = track.nearest(S.x[X.lo] + 130, S.z[X.lo] + 130, i0);
    const plain = track.nearest(S.x[X.lo] + 130, S.z[X.lo] + 130);
    assert.ok(Number.isInteger(far.i) && Number.isInteger(plain.i));
    const stale = track.nearest(S.x[X.lo], S.z[X.lo], (i0 + 200) % n);
    assert.ok(arc(stale.i, i0) < 240, `${name} leg: a stale hint 400 m away jumped to ${stale.i}, the other level`);
  }
});

function race(difficulty, seed) {
  const players = Array.from({ length: 8 }, (_, i) => ({ slot: -1, kart: KART_IDS[i % KART_IDS.length], human: false }));
  const R = createRace({ track, terrain, seed, laps: 1, players, difficulty, countdown: 0 });
  const K = R.state.karts, f0 = K.map((k) => k.progress), stuck = K.map(() => 0), last = K.map((k) => k.trackI);
  let worstStep = 0, maxJump = 0, crossingsHi = 0, crossingsLo = 0, steps = 0;
  const maxSteps = 60 * 60 * 14;
  const t0 = performance.now();
  while (R.state.phase !== 'done' && steps < maxSteps) {
    R.step([]);
    R.drainEvents();
    steps++;
    for (const k of K) {
      if (k.finished || k.rescueT > 0) { last[k.i] = k.trackI; stuck[k.i] = 0; continue; }
      const jump = arc(k.trackI, last[k.i]);
      if (jump > maxJump && k.shortcut < 0) maxJump = jump;
      last[k.i] = k.trackI;
      stuck[k.i] = k.speed < 1 && !k.hitT ? stuck[k.i] + 1 / 60 : 0;
      if (stuck[k.i] > worstStep) worstStep = stuck[k.i];
      // on the crossing the ground under a kart is the level it came in on
      if (arc(k.trackI, X.hi) < 3) { crossingsHi++; assert.ok(Math.abs(k.y - S.y[X.hi]) < 4, `kart ${k.i} on the deck at y ${k.y}, deck ${S.y[X.hi]}`); }
      if (arc(k.trackI, X.lo) < 3) { crossingsLo++; assert.ok(Math.abs(k.y - S.y[X.lo]) < 4, `kart ${k.i} under the deck at y ${k.y}, road ${S.y[X.lo]}`); }
    }
  }
  return { R, K, steps, worstStep, maxJump, crossingsHi, crossingsLo, ms: performance.now() - t0, f0 };
}

for (const difficulty of ['easy', 'medium', 'hard']) {
  test(`long: all 8 ${difficulty} bots finish the 10 km lap with no kart stuck over 4 s and no jump of level`, () => {
    const r = race(difficulty, 11);
    const left = r.K.filter((k) => !k.finished);
    assert.equal(left.length, 0, `not home after ${(r.steps / 60).toFixed(0)} s: ${left.map((k) => `${k.kart} at ${(k.u * track.length).toFixed(0)} m`).join(', ')}`);
    assert.ok(r.worstStep <= 4, `stuck ${r.worstStep.toFixed(1)} s`);
    assert.ok(r.maxJump * track.step <= 70, `a kart moved ${(r.maxJump * track.step).toFixed(0)} m along the road in one step`);
    assert.ok(r.crossingsHi > 0 && r.crossingsLo > 0, 'karts drove both levels');
    const winner = Math.min(...r.K.map((k) => k.finishT));
    assert.ok(winner > 150 && winner < 500, `winner ${winner.toFixed(0)} s`);
  });
}

test('long: the same seed gives the same race', () => {
  const hash = (R) => createHash('sha256').update(JSON.stringify(R.state)).digest('hex');
  const a = race('hard', 5), b = race('hard', 5);
  assert.equal(a.steps, b.steps);
  assert.equal(hash(a.R), hash(b.R));
});

test('long: the cost of a sim step does not grow with the lap', () => {
  const short = buildTrack(longTestDef({ km: 2.5 })), terr = buildTerrain(short);
  const cost = (T, G) => {
    const players = Array.from({ length: 8 }, (_, i) => ({ slot: -1, kart: KART_IDS[i], human: false }));
    const R = createRace({ track: T, terrain: G, seed: 3, laps: 1, players, difficulty: 'medium', countdown: 0 });
    for (let i = 0; i < 400; i++) R.step([]);
    const t = performance.now();
    for (let i = 0; i < 2000; i++) { R.step([]); R.drainEvents(); }
    return (performance.now() - t) / 2000;
  };
  cost(short, terr); cost(track, terrain); // warm the JIT
  const a = Math.min(cost(short, terr), cost(short, terr)), b = Math.min(cost(track, terrain), cost(track, terrain));
  assert.ok(b < a * 3 && b < 2, `2.5 km ${a.toFixed(3)} ms a step, 10 km ${b.toFixed(3)} ms`);
});

// ---------- the renderer, in a real Metal browser ----------
const BUDGET = { fps: { 1: 60, 2: 60, 4: 45 }, calls: 150, tris: 500000 };
let srv, browser, page;
const errors = [];
before(async () => {
  srv = await serveDev({});
  browser = await launch('metal', { uncapped: true });
  page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })).newPage();
  page.on('pageerror', (e) => errors.push(e.message));
});
after(async () => {
  await Promise.race([browser?.close(), new Promise((r) => setTimeout(r, 3000))]);
  srv?.close();
});

// a real time GPU test on a shared machine: a timing failure gets one more try before it counts
async function retried(views) {
  for (let attempt = 0; ; attempt++) {
    const r = await lapCheck(page, srv, { views, speed: 8 }), s = summarize(r), slowOnSwap = s.onP99 > s.offP99 * 1.6 + 4 || s.onWorst > 50;
    if (attempt === 1 || (s.fps >= BUDGET.fps[views] && !slowOnSwap)) return { r, s, slowOnSwap };
  }
}

for (const views of [1, 2, 4]) {
  test(`long: ${views} view(s), a whole 10 km lap within budget, no hitch at chunk borders, no memory growth`, async () => {
    const { r, s, slowOnSwap } = await retried(views);
    const said = `${s.fps.toFixed(0)} fps, ${r.maxCalls} calls, ${(r.maxTris / 1000).toFixed(0)}k tris, swap frames p99 ${s.onP99.toFixed(1)} worst ${s.onWorst.toFixed(1)} ms, others p99 ${s.offP99.toFixed(1)} worst ${s.offWorst.toFixed(1)} ms, heap growth ${(s.heapGrowth * 100).toFixed(1)}%`;
    assert.ok(s.fps >= BUDGET.fps[views], said);
    assert.ok(r.maxCalls <= BUDGET.calls, said);
    assert.ok(r.maxTris <= BUDGET.tris, said);
    assert.ok(!slowOnSwap, said);
    assert.ok(s.onFrames > 40 * views, `the stream changed on only ${s.onFrames} frames: nothing was tested`);
    assert.ok(s.heapGrowth < 0.05, said);
    assert.ok(Math.max(...s.gpuMB) < 120, `near and far buffers on the GPU ${Math.max(...s.gpuMB)} MB`);
    // the last tenth holds no more than the first half did at its busiest: nothing piles up along the lap
    const geo = s.geometries, firstHalf = Math.max(...geo.slice(1, 5));
    assert.ok(geo[geo.length - 1] <= firstHalf * 1.5, `geometries ${geo.join(' ')}`);
    assert.equal(r.home.finished, r.home.total, `home ${r.home.finished} of ${r.home.total}`);
    assert.deepEqual(errors, []);
  });
}

test('long: a view draws exactly one level of each item, and the ground under its kart is the fine one', async () => {
  await page.goto(`${srv.base}/?track=long-test&views=2&quality=capture&countdown=0&laps=1`);
  await page.waitForFunction(() => window.__dev?.ready || window.__dev?.error, null, { timeout: 180000 });
  const out = await page.evaluate(() => {
    const D = window.__dev, R = D.renderer, W = R.world, S = W.stream, res = [];
    for (const u of [0.05, 0.2, 0.33, 0.47, 0.6, 0.73, 0.88, 0.98]) {
      D.at(u, { settle: 30 });
      for (const v of R.views) {
        const c = v.cam.camera.position, st = v.stream;
        let both = 0, under = 0;
        S.show(st);
        for (const it of S.items) {
          if (it.far?.visible && it.near.some((m) => m.visible)) both++;
          if (it.near.some((m) => m.visible) && W.ground.cells.some((g) => g.near === it.near) && c.x >= it.ax && c.x <= it.bx && c.z >= it.az && c.z <= it.bz) under++;
        }
        res.push({ u, both, under, drawn: st.list.length });
      }
    }
    return { res, stream: !!W.stream, bands: D.track.bands.length };
  });
  for (const r of out.res) {
    assert.equal(r.both, 0, `u ${r.u}: both levels of an item at once`);
    assert.ok(r.under >= 1, `u ${r.u}: no fine ground under the camera`);
    assert.ok(r.drawn > 5, `u ${r.u}: only ${r.drawn} things drawn`);
  }
});

test('long: three views bake the overview, and the race goes on drawing', async () => {
  await page.goto(`${srv.base}/?track=long-test&views=3&quality=capture&countdown=0&laps=1`);
  await page.waitForFunction(() => window.__dev?.ready || window.__dev?.error, null, { timeout: 180000 });
  const r = await page.evaluate(() => {
    const D = window.__dev, gl = D.renderer.three.getContext();
    let st;
    for (let i = 0; i < 12; i++) st = D.stepDraw(2);
    const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, px = new Uint8Array(4), seen = new Set();
    // the bottom right cell, while the drawing buffer is still this frame's
    for (let i = 0; i < 40; i++) { gl.readPixels(Math.round(W * (0.55 + 0.4 * (i % 8) / 8)), Math.round(H * (0.05 + 0.4 * Math.floor(i / 8) / 5)), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); seen.add(px.join()); }
    return { colours: seen.size, calls: st.perView, tris: st.trianglesPerView };
  });
  assert.ok(r.colours > 8, `the overview cell shows ${r.colours} colours`);
  assert.ok(r.calls <= BUDGET.calls && r.tris <= BUDGET.tris, JSON.stringify(r));
});

test('long: the real HUD follows the kart with its map and counts the kilometres', async () => {
  await page.goto(`${srv.base}/?track=long-test&views=1&quality=capture&countdown=0&laps=1&hud=1&lang=en`);
  await page.waitForFunction(() => window.__dev?.ready || window.__dev?.error, null, { timeout: 180000 });
  const r = await page.evaluate(() => {
    const D = window.__dev, lap = () => document.querySelector('.hv .lap').textContent.trim(), canvas = document.querySelector('.hv .map canvas'), g = canvas.getContext('2d');
    const paint = () => { const d = g.getImageData(0, 0, canvas.width, canvas.height).data; let inked = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 40) inked++; return { inked, sum: d.reduce((a, b) => (a + b) & 0xffffff, 0) }; };
    for (let i = 0; i < 20; i++) D.stepDraw(2);
    const a = { lap: lap(), map: paint() };
    D.at(0.5, { settle: 30 }); for (let i = 0; i < 20; i++) D.stepDraw(2);
    const b = { lap: lap(), map: paint() };
    D.at(0.97, { settle: 30 }); for (let i = 0; i < 20; i++) D.stepDraw(2);
    const c = { lap: lap(), last: document.querySelector('.hv .lap').classList.contains('last'), banners: document.querySelectorAll('.hv .banner').length };
    return { a, b, c };
  });
  assert.match(r.a.lap, /To go\s*(9\.\d|10\.\d) km/, r.a.lap);
  assert.match(r.b.lap, /To go\s*[45]\.\d km/, r.b.lap);
  assert.match(r.c.lap, /To go\s*0\.\d km/, r.c.lap);
  assert.ok(r.c.last, 'the last kilometre is marked');
  assert.ok(r.a.map.inked > 3000, 'the map shows the road');
  assert.notEqual(r.a.map.sum, r.b.map.sum, 'the map moved with the kart');
});

test('long: a short track never goes near any of it', async () => {
  await page.goto(`${srv.base}/?track=antelao&views=1&quality=capture&countdown=0`);
  await page.waitForFunction(() => window.__dev?.ready || window.__dev?.error, null, { timeout: 180000 });
  const r = await page.evaluate(() => {
    const D = window.__dev, W = D.renderer.world, st = D.frames(10);
    return { error: D.error, long: D.track.long, stream: W.stream ?? null, cells: W.ground.cells, groups: W.road.groups, rocks: W.rocks.parent !== null, view: 'stream' in D.renderer.views[0], s: st.stream ?? null };
  });
  assert.equal(r.error, null);
  assert.equal(r.long, false);
  assert.equal(r.stream, null);
  assert.equal(r.cells, null);
  assert.equal(r.groups, null);
  assert.ok(r.rocks);
  assert.equal(r.view, false);
  assert.equal(r.s, null);
});
