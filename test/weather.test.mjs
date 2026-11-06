// Weather and night. In node: a plain race has none of it and the same bytes; the road's grip and speed per surface, puddles and drifts, thunder, the flow's options; bots home under every sky on every track.
// In a browser: the budgets at 1, 2 and 4 views, the painted panels still joined to the sky, and the real path, a phone and the TV from the lobby chip and the vote's to the results, then a plain race with none of it.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildTrack } from '../src/world/track.js';
import { buildTerrain } from '../src/world/terrain.js';
import { createRace, DT } from '../src/sim/index.js';
import { WEATHER, SURFACE } from '../src/sim/tuning.js';
import { loadTrackDef, TRACK_IDS } from '../src/data/tracks.js';
import { KART_IDS } from '../src/data/karts.js';
import { WEATHER_CHOICES, drawWeather, raceWeather, weatherKey } from '../src/data/weather.js';
import { createFlow, padFx, FLOW as RULES } from '../src/game/flow.js';
import { sanitizeOpt } from '../server/room.js';
import { gradeOf, gradeLinear, poleSpots, lampSpots } from '../src/render/weather.js';
import { launch, headlessShell, buildDist, startServerProcess, openPad } from '../tools/harness.mjs';
import { serveDev } from '../tools/render-dev.mjs';

const hasBrowser = !!headlessShell?.();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const worlds = new Map();
async function world(id) {
  if (!worlds.has(id)) {
    const track = buildTrack(await loadTrackDef(id));
    worlds.set(id, { track, terrain: buildTerrain(track) });
  }
  return worlds.get(id);
}
const field = (n = 8) => Array.from({ length: n }, (_, i) => ({ slot: -1, kart: KART_IDS[i % KART_IDS.length], human: false }));
const hash = (s) => {
  const text = JSON.stringify(s);
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};

describe('the road', () => {
  test('a plain race has none of it: no state, no events, and the same bytes whether the option is left out or null', async () => {
    const { track, terrain } = await world('antelao');
    const a = createRace({ track, terrain, seed: 9, laps: 2, countdown: 0, players: field() });
    const b = createRace({ track, terrain, seed: 9, laps: 2, countdown: 0, players: field(), weather: null });
    assert.equal(a.state.weather, undefined);
    assert.deepEqual(a.patches, []);
    for (let s = 0; s < 1500; s++) {
      a.step([]); b.step([]);
      for (const e of [...a.drainEvents(), ...b.drainEvents()]) assert.ok(e.type !== 'splash' && e.type !== 'thunder');
    }
    assert.equal(hash(a.state), hash(b.state));
  });

  test('a clear night changes nothing on the road: the same race as by day, only the state says night', async () => {
    const { track, terrain } = await world('antelao');
    const a = createRace({ track, terrain, seed: 4, laps: 2, countdown: 0, players: field() });
    const b = createRace({ track, terrain, seed: 4, laps: 2, countdown: 0, players: field(), weather: raceWeather('clear', true) });
    assert.equal(b.state.weather.night, true);
    assert.equal(b.patches.length, 0);
    // a human at the wheel: bots look less far at night, by design, and only for a disaster's lane
    for (let s = 0; s < 1200; s++) { a.step([]); b.step([]); }
    const place = (r) => r.state.karts.map((k) => [k.x.toFixed(3), k.z.toFixed(3)]);
    assert.deepEqual(place(a), place(b));
  });

  test('the same seed and sky give the same race, another seed other puddles', async () => {
    const { track, terrain } = await world('antelao');
    const go = (seed, kind) => { const r = createRace({ track, terrain, seed, laps: 2, countdown: 0, players: field(), weather: raceWeather(kind, false) }); for (let s = 0; s < 1800; s++) r.step([]); return r; };
    for (const kind of ['rain', 'snow', 'fog']) assert.equal(hash(go(21, kind).state), hash(go(21, kind).state), kind);
    assert.notEqual(hash(go(21, 'rain').patches), hash(go(22, 'rain').patches));
    assert.equal(go(21, 'fog').patches.length, 0, 'fog lies on no road');
  });

  test('grip and speed change by surface as the table says, and the wet sand is the one thing that gets better', () => {
    for (const kind of ['rain', 'snow']) {
      const W = WEATHER[kind];
      assert.ok(W.grip.asphalt < 0.85, `${kind} asphalt holds less`);
      for (const s of Object.keys(SURFACE)) if (s !== 'sand') assert.ok((W.grip[s] ?? 1) < 1 || !(s in W.grip), `${kind} ${s}`);
    }
    assert.ok(WEATHER.rain.speed.sand > 1 && WEATHER.rain.grip.sand > 1, 'rain packs the sand');
    assert.ok(WEATHER.fog.grip.asphalt < 1 && WEATHER.fog.grip.asphalt > WEATHER.rain.grip.asphalt);
  });

  test('the same wheel on the same straight slides more in the rain than dry, and more again on the snow', async () => {
    const { track, terrain } = await world('antelao');
    let i0 = 0, best = 1e9;
    for (let i = 60; i < track.n - 60; i++) {
      if (track.structureAt(i) || track.samples.w[i] < 11) continue;
      let c = 0;
      for (let j = -50; j <= 50; j += 5) c = Math.max(c, Math.abs(track.curvature[i + j]));
      if (c < best) { best = c; i0 = i; }
    }
    const slide = (kind) => {
      const r = createRace({ track, terrain, seed: 3, laps: 3, countdown: 0, players: [{ slot: 0, kart: 'jeep', human: true }], weather: raceWeather(kind, false) });
      r.teleport(0, (i0 - 30) / track.n, 0, { speed: 24 });
      let most = 0;
      for (let s = 0; s < 22; s++) {
        r.step([{ steer: 1, throttle: 1, item: false, drift: false }]);
        const k = r.state.karts[0];
        most = Math.max(most, Math.abs(k.vx * Math.cos(k.yaw) - k.vz * Math.sin(k.yaw)));
      }
      return most;
    };
    const dry = slide('clear'), wet = slide('rain'), snow = slide('snow');
    assert.ok(wet > dry * 1.08, `dry ${dry} wet ${wet}`);
    assert.ok(snow > wet, `wet ${wet} snow ${snow}`);
  });

  test('a puddle: one splash at the way in, a slide and less speed, a phone that feels it; the pan does not care; a kart beside it feels nothing', async () => {
    const { track, terrain } = await world('antelao');
    const human = [{ slot: 0, kart: 'jeep', human: true }, { slot: 1, kart: 'jeep', human: true }];
    const r = createRace({ track, terrain, seed: 8, laps: 3, countdown: 0, players: human, weather: raceWeather('rain', false) });
    assert.ok(r.patches.length >= 8, `${r.patches.length} puddles on a lap`);
    const q = r.patches.find((c) => Math.abs(c.d) + c.rz + 3.5 < track.samples.w[c.i] / 2 || Math.abs(c.d) > 1.5) ?? r.patches[3];
    const back = Math.ceil(q.rx / track.step) + 3, from = (q.i - back) / track.n;
    const beside = q.d > 0 ? q.d - q.rz - 2.4 : q.d + q.rz + 2.4;
    r.teleport(0, from, q.d, { speed: 26 });
    r.teleport(1, from, beside, { speed: 26 });
    const seen = [];
    const steer = { steer: 0, throttle: 1, item: false, drift: false };
    let wet = 0;
    for (let s = 0; s < 45; s++) {
      r.step([steer, steer]);
      seen.push(...r.drainEvents().filter((e) => e.type === 'splash'));
      if (r.state.karts[0].speed < r.state.karts[1].speed - 0.05) wet++;
    }
    assert.equal(seen.filter((e) => e.kart === 0).length, 1, 'one splash through one puddle');
    assert.equal(seen.filter((e) => e.kart === 1).length, 0, 'beside it, nothing');
    assert.ok(wet > 8, `the kart in the water runs slower than the one beside it for ${wet} steps`);
    assert.deepEqual(padFx([seen[0]], r.state.karts), [{ slot: 0, kind: 'bump' }], 'the phone shakes');
    const r2 = createRace({ track, terrain, seed: 8, laps: 3, countdown: 0, players: human.slice(0, 1), weather: raceWeather('rain', false) });
    r2.teleport(0, from, q.d, { speed: 26 });
    r2.state.karts[0].bigT = 5;
    let splashed = 0;
    for (let s = 0; s < 45; s++) { r2.step([steer]); splashed += r2.drainEvents().filter((e) => e.type === 'splash').length; }
    assert.equal(splashed, 0, 'the pan goes through');
  });

  test('no patch in a tunnel, on a jump or a pad, and every one fits on its road', async () => {
    for (const id of TRACK_IDS) {
      const { track, terrain } = await world(id);
      for (const kind of ['rain', 'snow']) {
        const r = createRace({ track, terrain, seed: 5, laps: 1, countdown: 0, players: field(2), weather: raceWeather(kind, false) });
        assert.ok(r.patches.length > 5, `${id} ${kind}`);
        for (const q of r.patches) {
          assert.notEqual(track.structureAt(q.i), 'tunnel', id);
          assert.ok(Math.abs(q.d) + q.rz <= track.samples.w[q.i] / 2 + 0.01, `${id}: off the road`);
          for (const j of [...track.jumps, ...track.pads]) { let o = Math.abs(j.i - q.i); if (o > track.n / 2) o = track.n - o; assert.ok(o * track.step >= 34, `${id}: on ${j.i}`); }
        }
      }
    }
  });

  test('a storm: thunder now and then in the rain, a flash that fades, never in the snow or the fog', async () => {
    const { track, terrain } = await world('antelao');
    const go = (kind) => {
      const r = createRace({ track, terrain, seed: 6, laps: 3, countdown: 0, players: field(), weather: raceWeather(kind, false) });
      let n = 0, peak = 0;
      for (let s = 0; s < 60 * 120; s++) { r.step([]); n += r.drainEvents().filter((e) => e.type === 'thunder').length; peak = Math.max(peak, r.state.weather.flash); }
      return { n, peak, end: r.state.weather.flash };
    };
    const rain = go('rain');
    assert.ok(rain.n >= 3 && rain.n <= 8, `${rain.n} in 2 minutes`);
    assert.ok(rain.peak > 0.5);
    assert.equal(go('snow').n, 0);
    assert.equal(go('fog').n, 0);
  });

  test('the bots get home on every road under every sky, nobody stuck', { timeout: 300000 }, async () => {
    for (const id of TRACK_IDS) {
      const { track, terrain } = await world(id);
      for (const kind of ['rain', 'snow', 'fog']) {
        const r = createRace({ track, terrain, seed: 11, laps: track.long ? 1 : 2, countdown: 0, players: field(), difficulty: 'medium', weather: raceWeather(kind, false) });
        let s = 0, still = new Float64Array(8), worst = 0;
        for (; s < 60 * 900 && r.state.phase !== 'done'; s++) {
          r.step([]);
          for (const k of r.state.karts) { still[k.i] = !k.finished && k.hitT <= 0 && k.rescueT <= 0 && Math.hypot(k.vx, k.vz) < 1.5 ? still[k.i] + DT : 0; worst = Math.max(worst, still[k.i]); }
        }
        const home = r.state.karts.filter((k) => k.finished).length;
        assert.equal(home, 8, `${id} ${kind}: ${home} home`);
        assert.ok(worst <= 4.5, `${id} ${kind}: stuck ${worst.toFixed(1)} s`);
      }
    }
  });
});

describe('the choice', () => {
  const flowOf = (rng = Math.random) => { const f = createFlow({ karts: KART_IDS, tracks: ['antelao', 'pelmo'], rng }); f.join(0); return f; };
  const toVote = (f) => { f.go(); f.drain(); f.pick(0, 'jeep', true); f.step(RULES.allReady + 0.01); f.drain(); };
  const toRace = (f) => { toVote(f); f.vote(0, 'antelao', true); f.step(RULES.solo + 0.1); f.step(RULES.land + 0.1); assert.equal(f.phase, 'loading'); };

  test('clear and day are no key at all, and a plain race has no sky', () => {
    const f = flowOf();
    assert.ok(!('weather' in f.opts) && !('night' in f.opts));
    f.setOpts({ weather: 'rain', night: true });
    assert.equal(f.opts.weather, 'rain'); assert.equal(f.opts.night, true);
    f.setOpts({ weather: 'clear', night: false });
    assert.ok(!('weather' in f.opts) && !('night' in f.opts));
    toRace(f);
    assert.equal(f.weather, null);
  });

  test('a phone can still change the sky on the vote, not on the kart pick; the race has what was on show', () => {
    const f = flowOf();
    f.go(); f.drain();
    f.setOpts({ weather: 'snow' });
    assert.ok(!('weather' in f.opts), 'not on the kart pick');
    f.pick(0, 'jeep', true);
    f.step(RULES.allReady + 0.01); f.drain();
    assert.equal(f.phase, 'vote');
    const laps = f.opts.laps;
    f.setOpts({ weather: 'snow', night: true, laps: laps === 5 ? 3 : 5 });
    assert.equal(f.opts.laps, laps, 'only the sky');
    assert.equal(f.menuFor(0).weather, 'snow');
    assert.equal(f.menuFor(0).night, true);
    f.vote(0, 'antelao', true);
    f.step(RULES.solo + 0.1); f.step(RULES.land + 0.1);
    assert.deepEqual(f.weather, { kind: 'snow', night: true });
  });

  test('a surprise is drawn again for each race on the same evening; alone against the clock the sky is always clear', () => {
    let x = 7;
    const f = flowOf(() => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; });
    f.setOpts({ weather: 'surprise' });
    toRace(f);
    const seen = new Set();
    for (let n = 0; n < 24; n++) {
      seen.add(weatherKey(f.weather));
      f.loaded();
      f.raceDone(f.field().map((p, i) => ({ i, slot: p.slot, kart: p.kart, human: p.human, place: i + 1, time: 100 + i, bestLap: 30 })));
      assert.equal(f.next('rematch'), true);
      assert.equal(f.phase, 'loading');
    }
    assert.ok(seen.size >= 4, [...seen].join());
    const t = flowOf();
    t.setOpts({ mode: 'time', weather: 'rain', night: true });
    toRace(t);
    assert.equal(t.weather, null);
  });

  test('the room lets the fields through and nothing else', () => {
    assert.deepEqual(sanitizeOpt({ t: 'opt', weather: 'rain', night: true }), { weather: 'rain', night: true });
    for (const w of WEATHER_CHOICES) assert.equal(sanitizeOpt({ t: 'opt', weather: w }).weather, w);
    assert.equal(sanitizeOpt({ t: 'opt', weather: 'lava' }), null);
    assert.equal(sanitizeOpt({ t: 'opt', night: 'yes' }), null);
  });

  test('the grade: nothing for no weather, the same colour in gives the same colour out, night darker than rain, fog nearer its veil', () => {
    const def = { id: 'antelao' }, sky = [0.6, 0.65, 0.8];
    const g = (kind, night) => gradeLinear(gradeOf({ kind, night }, def), sky, 0.1);
    const l = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    assert.deepEqual(gradeLinear(gradeOf(null, def), sky, 0.1).map((v) => +v.toFixed(5)), sky);
    assert.ok(l(g('clear', true)) < 0.2 && l(g('clear', true)) < l(g('rain', false)));
    const F = gradeOf({ kind: 'fog' }, def), fog = gradeLinear(F, [0.05, 0.3, 0.05], 0.02);
    assert.ok(Math.abs(fog[0] - F.veil[0]) < 0.05, 'fog hides what is far');
    // Bran is a night already: a night there is no change
    assert.deepEqual(gradeLinear(gradeOf({ kind: 'clear', night: true }, { id: 'bran' }), sky, 0.1).map((v) => +v.toFixed(5)), sky);
  });

  test('poles and lamps stay off the road and out of the tunnels', async () => {
    for (const id of TRACK_IDS) {
      const { track } = await world(id);
      for (const q of [...poleSpots(track), ...lampSpots(track)]) {
        const near = track.nearest(q.x, q.z);
        if (track.samples.y[near.i] - q.y > 3) continue; // under a viaduct
        assert.ok(Math.abs(near.d) > track.samples.w[near.i] / 2 - 1, `${id}: on the road at ${q.x},${q.z}`);
      }
      for (const q of lampSpots(track)) assert.notEqual(track.structureAt(q.i), 'tunnel', id);
    }
  });
});

describe('in a browser', { skip: !hasBrowser && 'no browser' }, () => {
  test('the budgets under every sky at 1, 2 and 4 views, a short road and a long one, at the worst of the lap', { timeout: 590000 }, async (t) => {
    const srv = await serveDev({ port: 0 });
    const browser = await launch('metal');
    t.after(async () => { await browser.close(); await srv.close?.(); });
    const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })).newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    const report = [];
    for (const [id, skies] of [['antelao', ['weather=rain', 'weather=snow&night=1', 'weather=fog', 'night=1']], ['jakarta', ['weather=rain&night=1']]]) {
      for (const sky of skies) for (const views of [1, 2, 4]) {
        await page.goto(`${srv.base}/?track=${id}&views=${views}&quality=capture&countdown=0&${sky}`);
        await page.waitForFunction(() => window.__dev?.ready || window.__dev?.error, null, { timeout: 180000 });
        const r = await page.evaluate(({ views }) => {
          const d = window.__dev, out = { calls: 0, tris: 0 }, N = 16;
          for (let n = 0; n < N; n++) {
            d.at((n + 0.5) / N, { speed: 22, settle: 8, others: true });
            const s = d.draw();
            out.calls = Math.max(out.calls, s.perView); out.tris = Math.max(out.tris, s.trianglesPerView);
          }
          return out;
        }, { views });
        report.push(`${id} ${sky} ${views}v: ${r.calls.toFixed(0)} calls ${(r.tris / 1000).toFixed(0)}k`);
        assert.ok(r.calls <= 150, report.at(-1));
        assert.ok(r.tris <= 500000, report.at(-1));
      }
    }
    console.log(report.join('\n'));
    assert.deepEqual(errs, []);
  });

  test('the paintings still join the sky: across the top of the panels no step, under any sky', { timeout: 240000 }, async (t) => {
    const srv = await serveDev({ port: 0 });
    const browser = await launch('metal');
    t.after(async () => { await browser.close(); await srv.close?.(); });
    const page = await (await browser.newContext({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 })).newPage();
    let clear = 0;
    const out = [];
    for (const sky of ['', 'weather=rain', 'weather=snow', 'weather=fog', 'night=1', 'weather=rain&night=1']) {
      await page.goto(`${srv.base}/?track=antelao&views=1&quality=capture&countdown=0&${sky}`);
      await page.waitForFunction(() => window.__dev?.ready || window.__dev?.error, null, { timeout: 180000 });
      const step = await page.evaluate(() => {
        const d = window.__dev, gl = d.renderer.three.getContext(), H = gl.drawingBufferHeight, W = gl.drawingBufferWidth, px = new Uint8Array(W * H * 4);
        let worst = 0;
        for (const az of [0.3, 1.5, 2.8, 4.2, 5.4]) {
          const x = d.track.samples.x[0], z = d.track.samples.z[0], y = d.track.samples.y[0] + 30;
          d.pose(x, y, z, x + Math.sin(az) * 100, y + 72, z + Math.cos(az) * 100, 70);
          d.draw();
          gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
          for (let row = 1; row < H; row++) {
            const diffs = [];
            for (let c = 8; c < W; c += 16) {
              const a = (row * W + c) * 4, b = ((row - 1) * W + c) * 4;
              // against the brightness there: a seam on a dark sky shows as much as a bright one on a bright sky
              diffs.push((Math.abs(px[a] - px[b]) + Math.abs(px[a + 1] - px[b + 1]) + Math.abs(px[a + 2] - px[b + 2])) / (px[a] + px[a + 1] + px[a + 2] + 90));
            }
            diffs.sort((p, q) => p - q);
            worst = Math.max(worst, diffs[diffs.length >> 1]); // the median: a star is not a seam
          }
        }
        return worst;
      });
      out.push(`${sky || 'clear'} ${step.toFixed(3)}`);
      if (!sky) clear = step;
      else assert.ok(step <= clear * 1.15 + 0.004, `${sky}: a step of ${step} across the sky, against ${clear} on a clear day (${out.join(', ')})`);
    }
    console.log(`median step across the sky: ${out.join(', ')}`);
  });

  test('a phone and the TV from the lobby and the vote to the results under that sky, then a plain race on the same page with none of it', { timeout: 420000 }, async (t) => {
    const dist = mkdtempSync(join(tmpdir(), 'rk-wxt-'));
    await buildDist(dist);
    const srv = await startServerProcess({ dist });
    const browser = await launch('metal');
    t.after(async () => { await browser.close(); await srv.close(); rmSync(dist, { recursive: true, force: true }); });
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'it-IT' });
    const tv = await ctx.newPage();
    const errs = [];
    tv.on('pageerror', (e) => errs.push(e.message));
    tv.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    await tv.goto(`${srv.base}/?lang=it&quality=capture&laps=1&flyover=0&countdown=1&seed=12`);
    await tv.waitForFunction(() => window.__game?.ready || window.__game?.error, null, { timeout: 120000 });
    assert.equal(await tv.evaluate(() => window.__game.error), null);
    const phone = await openPad(browser, srv.base, { label: 'wx', locale: 'it-IT' });
    await tv.waitForFunction(() => window.__game.seats[0]?.present, null, { timeout: 20000 });
    // the chips on the phone reach the TV, and the TV's click the phone
    assert.equal(await tv.evaluate(() => 'weather' in window.__game.flowApi.opts), false, 'nothing chosen yet');
    await phone.page.locator('.seg[data-key="weather"] button[data-v="rain"]').tap();
    await tv.waitForFunction(() => window.__game.flowApi.opts.weather === 'rain', null, { timeout: 5000 });
    assert.ok(await tv.locator('.lobby .chips[data-key="weather"] [data-v="rain"].on').count());
    await tv.locator('.lobby .chips[data-key="night"] [data-v="night"]').click();
    await tv.waitForFunction(() => window.__game.flowApi.opts.night === true, null, { timeout: 5000 });
    await phone.page.waitForFunction(() => document.querySelector('.seg[data-key="night"] button[data-v="true"]').classList.contains('on'), null, { timeout: 5000 });
    // text fits and no row of the card overflows
    const fit = await tv.evaluate(() => { const c = document.querySelector('.lobby .opts').getBoundingClientRect(), last = [...document.querySelectorAll('.lobby .optrow')].at(-1).getBoundingClientRect(); return { card: c.bottom, row: last.bottom, cut: [...document.querySelectorAll('.lobby .wxrow .chip')].filter((b) => b.scrollWidth > b.clientWidth + 1).map((b) => b.textContent) }; });
    assert.ok(fit.row <= fit.card, JSON.stringify(fit));
    assert.deepEqual(fit.cut, []);
    const padFit = await phone.page.evaluate(() => { const c = document.getElementById('optCard').getBoundingClientRect(); return [...document.querySelectorAll('#optCard .opt')].filter((r) => !r.classList.contains('hide')).map((r) => r.getBoundingClientRect()).every((r) => r.top >= c.top - 1 && r.bottom <= c.bottom + 1); });
    assert.ok(padFit, 'every row of the phone card shows');
    await phone.page.locator('#goBtn').tap();
    await phone.page.waitForFunction(() => window.__pad.phase === 'pick', null, { timeout: 8000 });
    await sleep(350);
    await phone.page.locator('#readyBtn').tap();
    await tv.waitForFunction(() => window.__game.phase === 'vote', null, { timeout: 8000 });
    await sleep(600);
    // on the vote, once the road is known, the sky can still change: rain to snow, from the phone
    const cycleTo = async (w) => { await phone.page.locator('#wxCycle').tap(); await tv.waitForFunction((q) => (window.__game.flowApi.opts.weather ?? 'clear') === q, w, { timeout: 5000 }); await sleep(150); };
    await cycleTo('snow');
    assert.match(await tv.locator('.vote .wxc').textContent(), /Neve/);
    for (const w of ['fog', 'surprise', 'clear', 'rain']) await cycleTo(w);
    const vote = async () => { await phone.page.evaluate(() => window.__pad.carousel.show?.('antelao')); await sleep(200); await phone.page.locator('#voteBtn').tap(); };
    await vote();
    await tv.waitForFunction(() => window.__game.state?.weather, null, { timeout: 180000 });
    const on = await tv.evaluate(() => { const g = window.__game, R = g.renderer; return { wx: g.weather, state: g.state.weather.kind, stats: R.weatherStats(), lit: R.shared.wx.uWxOn.value, windows: R.world.windows?.length ?? 0 }; });
    assert.deepEqual(on.wx, { kind: 'rain', night: true });
    assert.equal(on.state, 'rain');
    assert.ok(on.stats.lamps > 10 && on.stats.patches > 5 && on.stats.fall, JSON.stringify(on.stats));
    assert.ok(on.windows > 20, `${on.windows} lit windows`);
    assert.equal(on.lit, 1);
    await tv.evaluate(() => { const g = window.__game; g.setScript((i) => g.drive(i)); });
    await tv.waitForFunction(() => window.__game.state?.phase === 'race', null, { timeout: 30000 });
    await sleep(2500);
    const luma = () => tv.evaluate(() => {
      const R = window.__game.renderer, gl = R.three.getContext(), W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, px = new Uint8Array(W * H * 4);
      window.__game.draw(); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const band = (from, to) => { let s = 0, n = 0; for (let y = from; y < to; y += 4) for (let x = 0; x < W; x += 4) { const i = (y * W + x) * 4; s += px[i] * 0.21 + px[i + 1] * 0.72 + px[i + 2] * 0.07; n++; } return s / n; };
      return { luma: band(0, H), sky: band(H - (H >> 3), H), calls: R.stats().perView }; // readPixels starts at the bottom
    });
    const dark = await luma();
    assert.ok(dark.calls <= 150);
    await tv.evaluate(() => { window.__game.speed = 6; });
    await tv.waitForFunction(() => window.__game.phase === 'results', null, { timeout: 200000 });
    const counts = await tv.evaluate(() => window.__game.counts);
    assert.ok(counts.splash > 0, `a race through the puddles: ${JSON.stringify(counts).slice(0, 300)}`);
    // back to the lobby, clear and by day, on the same page
    await phone.page.waitForFunction(() => window.__pad.phase === 'results', null, { timeout: 15000 });
    await tv.evaluate(() => window.__game.next('lobby'));
    await tv.waitForFunction(() => window.__game.phase === 'lobby', null, { timeout: 15000 });
    await phone.page.waitForFunction(() => window.__pad.phase === 'lobby', null, { timeout: 15000 });
    await tv.locator('.lobby .chips[data-key="weather"] [data-v="clear"]').click();
    await tv.locator('.lobby .chips[data-key="night"] [data-v="night"]').click();
    await tv.waitForFunction(() => !('weather' in window.__game.flowApi.opts) && !('night' in window.__game.flowApi.opts), null, { timeout: 5000 });
    await phone.page.locator('#goBtn').tap();
    await phone.page.waitForFunction(() => window.__pad.phase === 'pick', null, { timeout: 8000 });
    await sleep(350);
    await phone.page.locator('#readyBtn').tap();
    await tv.waitForFunction(() => window.__game.phase === 'vote', null, { timeout: 8000 });
    await sleep(500);
    await vote();
    await tv.waitForFunction(() => window.__game.phase === 'race' && window.__game.state && !window.__game.state.weather && window.__game.ready, null, { timeout: 180000 });
    await tv.evaluate(() => { const g = window.__game; g.setScript((i) => g.drive(i)); });
    await tv.waitForFunction(() => window.__game.state?.phase === 'race', null, { timeout: 30000 });
    await sleep(2500);
    const off = await tv.evaluate(() => { const g = window.__game, R = g.renderer; return { wx: g.weather, state: g.state.weather ?? null, stats: R.weatherStats(), lit: R.shared.wx.uWxOn.value, lr: R.shared.wx.uLitRect.value.z, windows: R.world.windows ?? null, flash: R.shared.grade.uGrFlash.value }; });
    assert.equal(off.wx, null);
    assert.equal(off.state, null);
    assert.equal(off.stats, null);
    assert.equal(off.lit, 0);
    assert.equal(off.lr, 0, 'no lit map left');
    assert.equal(off.windows, null, 'no lit window in a day race');
    const day = await luma();
    assert.ok(dark.luma < day.luma && dark.sky < day.sky * 0.45, `night ${JSON.stringify(dark)} against day ${JSON.stringify(day)}`);
    await tv.evaluate(() => { window.__game.speed = 6; });
    await tv.waitForFunction(() => window.__game.phase === 'results', null, { timeout: 200000 });
    const c2 = await tv.evaluate(() => window.__game.counts);
    assert.ok(!c2.splash && !c2.thunder, 'nothing of it in the plain race');
    assert.deepEqual(errs, []);
    await phone.ctx.close();
  });
});
