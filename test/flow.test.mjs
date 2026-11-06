// The rules of the evening, in node: seats, options, kart pick, track vote, Gran Premio, results, what each phone hears. Then the
// whole thing in a real browser on the real server: a real phone page and scripted ones, from the lobby to the podium and back,
// with a phone leaving and returning.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFlow, createHudFeed, hudOf, padFx, resultRows, FLOW, POINTS, RANDOM } from '../src/game/flow.js';
import { viewRect } from '../src/ui/screens/hud.js';
import { viewLayout } from '../src/render/index.js';
import { launch, headlessShell, ROOT } from '../tools/harness.mjs';
import { startServer, pad, sleep } from '../server/testing.js';

const KARTS = ['tabia', 'gatto', 'seggiovia', 'mocanita', 'caruta', 'logan', 'jeep', 'becak', 'jukung'];
const TRACKS = ['antelao', 'pelmo', 'bran', 'bali'];
const REGIONS = { antelao: 'cadore', pelmo: 'cadore', bran: 'romania', bali: 'indonesia' };
// Scripted randomness: the values cycle, so a coin's result is part of the test.
const script = (...v) => { let i = 0; return () => v[i++ % v.length]; };
const make = (rng = script(0.1, 0.6, 0.3, 0.9)) => createFlow({ karts: KARTS, tracks: TRACKS, regions: REGIONS, rng });
const toPick = (f, ...slots) => { for (const s of slots) f.join(s); f.go(); f.drain(); };
const toVote = (f, ...slots) => {
  toPick(f, ...slots);
  for (const s of slots) f.pick(s, KARTS[s], true);
  f.step(FLOW.allReady + 0.01);
  f.drain();
};
const rows = (field) => field.map((p, n) => ({ i: n, slot: p.slot, kart: p.kart, human: p.human, place: n + 1, time: 100 + n, bestLap: 30 }));

describe('lobby', () => {
  test('options are validated and clamped', () => {
    const f = make();
    assert.equal(f.setOpts({ difficulty: 'nope', laps: 4, mode: 'x' }), false);
    f.setOpts({ difficulty: 'hard', bots: 99, laps: 5, mode: 'gp' });
    assert.deepEqual(f.opts, { difficulty: 'hard', bots: 7, laps: 5, mode: 'gp' });
    f.setOpts({ bots: -3 });
    assert.equal(f.opts.bots, 0);
  });
  test('the start button works with nobody seated: the keyboard takes seat one', () => {
    const f = make();
    assert.equal(f.go(), true);
    assert.equal(f.phase, 'pick');
    assert.equal(f.seats[0].source, 'keyboard');
    assert.equal(f.seats[0].present, true);
  });
  test('options only change in the lobby', () => {
    const f = make();
    toPick(f, 0);
    assert.equal(f.setOpts({ bots: 1 }), false);
  });
});

describe('kart pick', () => {
  test('moves on once everyone is ready, a beat later', () => {
    const f = make();
    toPick(f, 0, 1);
    f.pick(0, 'jeep', true);
    f.step(5);
    assert.equal(f.phase, 'pick');
    f.pick(1, 'jeep', true);
    f.step(FLOW.allReady / 2);
    assert.equal(f.phase, 'pick');
    f.step(FLOW.allReady);
    assert.equal(f.phase, 'vote');
  });
  test('taking "ready" back holds the screen', () => {
    const f = make();
    toPick(f, 0);
    f.pick(0, 'jeep', true);
    f.pick(0, 'jeep', false);
    f.step(5);
    assert.equal(f.phase, 'pick');
  });
  test('refuses karts it does not know', () => {
    const f = make();
    toPick(f, 0);
    assert.equal(f.pick(0, 'gong', true), false);
    assert.equal(f.seats[0].kart, null);
  });
  test('a phone gone does not hold the others up', () => {
    const f = make();
    toPick(f, 0, 1);
    f.pick(0, 'jeep', true);
    f.leave(1);
    f.step(FLOW.allReady + 0.1);
    assert.equal(f.phase, 'vote');
  });
  test('a click on the TV gives the kart to the first seat not ready', () => {
    const f = make();
    toPick(f, 0, 1);
    f.pickFromTV('jeep');
    f.pickFromTV('gatto');
    assert.equal(f.seats[0].kart, 'jeep');
    assert.equal(f.seats[1].kart, 'gatto');
    assert.equal(f.seats[1].ready, true);
  });
});

describe('track vote', () => {
  test('the same track goes straight through', () => {
    const f = make();
    toVote(f, 0, 1);
    f.vote(0, 'bali', true);
    assert.equal(f.state.vote.phase, 'open');
    f.vote(1, 'bali', true);
    assert.equal(f.state.vote.phase, 'agree');
    f.step(FLOW.agree + 0.01);
    assert.equal(f.phase, 'loading');
    assert.equal(f.state.track, 'bali');
  });
  test('differing votes: the coin spins over them and lands on one', () => {
    const f = make(script(0.9, 0.1));
    toVote(f, 0, 1);
    f.vote(0, 'bali', true);
    f.vote(1, 'pelmo', true);
    const v = f.state.vote;
    assert.equal(v.phase, 'roll');
    assert.deepEqual([...v.candidates].sort(), ['bali', 'pelmo']);
    const seen = new Set();
    for (let t = 0; t < FLOW.roll; t += 0.05) { f.step(0.05); seen.add(v.spin); }
    assert.equal(seen.size, 2, 'the spin shows both cards');
    assert.equal(v.spin, v.pick);
    assert.equal(v.landed, true);
    assert.ok(['bali', 'pelmo'].includes(v.pick));
    f.step(FLOW.land + 0.1);
    assert.equal(f.state.track, v.pick);
  });
  test('a random ballot spins over every track', () => {
    const f = make();
    toVote(f, 0);
    f.vote(0, RANDOM, true);
    assert.deepEqual(f.state.vote.candidates, TRACKS);
    assert.ok(TRACKS.includes(f.state.vote.pick));
  });
  test('a vote for a track that does not exist is ignored', () => {
    const f = make();
    toVote(f, 0);
    assert.equal(f.vote(0, 'jakarta', true), false);
    assert.equal(f.state.vote.phase, 'open');
  });
  test('a track that fails to load leaves the list and the vote opens again', () => {
    const f = make();
    toVote(f, 0);
    f.forceTrack('bali');
    f.step(FLOW.solo + 0.1);
    assert.equal(f.phase, 'loading');
    assert.equal(f.failed('bali'), true);
    assert.equal(f.phase, 'vote');
    assert.equal(f.tracks.includes('bali'), false);
  });
});

describe('Gran Premio', () => {
  const gp = (rng) => { const f = make(rng); f.setOpts({ mode: 'gp' }); toVote(f, 0, 1); return f; };
  test('phones add and remove tracks in the order picked; the random card starts it', () => {
    const f = gp();
    f.vote(0, 'bali', true);
    f.vote(1, 'antelao', true);
    f.vote(0, 'pelmo', true);
    assert.deepEqual(f.state.list, ['bali', 'antelao', 'pelmo']);
    f.vote(1, 'antelao', true);
    assert.deepEqual(f.state.list, ['bali', 'pelmo']);
    assert.ok(f.drain().some((e) => e.type === 'unlock'), 'the phone hears its lock is released');
    f.vote(0, RANDOM, true);
    assert.equal(f.phase, 'loading');
    assert.deepEqual(f.state.gp.tracks, ['bali', 'pelmo']);
    assert.equal(f.state.track, 'bali');
  });
  test('presets: a region, all, a random draw', () => {
    const f = gp();
    f.gpPreset('cadore');
    assert.deepEqual(f.state.list, ['antelao', 'pelmo']);
    f.gpPreset('all');
    assert.deepEqual(f.state.list, TRACKS);
    f.gpPreset('random3');
    assert.equal(f.state.list.length, 3);
    assert.equal(new Set(f.state.list).size, 3);
    f.gpPreset('clear');
    assert.deepEqual(f.state.list, []);
  });
  test('starting with too few tracks draws the rest', () => {
    const f = gp();
    f.gpToggle('bali');
    f.gpStart();
    assert.equal(f.state.gp.tracks.length, FLOW.gpRandom);
    assert.equal(f.state.gp.tracks[0], 'bali');
  });
  test('the table adds up race after race, the field stays, the grid turns over, the final podium comes from the table', () => {
    const f = gp();
    f.gpPreset('cadore');
    f.gpStart();
    const field1 = f.field();
    f.loaded();
    assert.equal(f.phase, 'race');
    f.raceDone(rows(field1));
    assert.equal(f.phase, 'results');
    assert.equal(f.gpMore, true);
    const t1 = f.gpTable();
    assert.equal(t1[0].points, POINTS[0]);
    assert.equal(f.nextTrack, 'pelmo');
    f.step(FLOW.results + 1);
    assert.equal(f.phase, 'results', 'between races the table waits for a press');
    assert.equal(f.next('rematch'), true);
    assert.equal(f.phase, 'loading');
    assert.equal(f.state.track, 'pelmo');
    const field2 = f.field();
    assert.deepEqual(field2.map((p) => p.kart).sort(), field1.map((p) => p.kart).sort(), 'same entrants');
    assert.equal(field2.at(-1).kart, field1[0].kart, 'the leader of the table starts last');
    f.loaded();
    f.raceDone(rows(field2).reverse().map((r, n) => ({ ...r, place: n + 1 })));
    assert.equal(f.state.gp.finished, true);
    const t2 = f.gpTable();
    for (const e of t2) assert.ok(e.points >= 0);
    assert.equal(t2.reduce((a, e) => a + e.points, 0), 2 * POINTS.slice(0, field1.length).reduce((a, b) => a + b, 0));
    f.step(FLOW.results + 0.1);
    assert.equal(f.phase, 'podium');
    const top = f.top3();
    assert.deepEqual(top.map((e) => e.place), [1, 2, 3]);
    assert.equal(top[0].points, t2[0].points);
    assert.equal(f.phoneFor(), 'podium');
    assert.equal(f.next('lobby'), true);
    assert.equal(f.state.gp, null);
  });
  test('a rematch of a finished Gran Premio is the whole list again, from a clean table; a rematch of a single race stays one race', () => {
    const f = gp();
    f.gpPreset('cadore');
    f.gpStart();
    const list = [...f.state.gp.tracks];
    for (let n = 0; n < list.length; n++) { const field = f.field(); f.loaded(); f.raceDone(rows(field)); if (n < list.length - 1) f.next('rematch'); }
    assert.equal(f.state.gp.finished, true);
    assert.equal(f.next('rematch'), true);
    assert.equal(f.phase, 'loading');
    assert.deepEqual(f.state.gp.tracks, list);
    assert.equal(f.state.gp.index, 0);
    assert.equal(f.state.gp.finished, false);
    assert.equal(f.state.track, list[0]);
    assert.ok(f.gpTable().every((e) => e.points === 0));
    const single = make();
    single.setOpts({ bots: 3 });
    toVote(single, 0);
    single.forceTrack('bali');
    single.step(FLOW.solo + 0.1);
    single.loaded();
    single.raceDone(rows(single.field()));
    assert.equal(single.next('rematch'), true);
    assert.equal(single.state.gp, null);
    assert.equal(single.state.track, 'bali');
  });
});

describe('results and after', () => {
  const race = () => {
    const f = make();
    f.setOpts({ bots: 3 });
    toVote(f, 0);
    f.forceTrack('bali');
    f.step(FLOW.solo + 0.1);
    const field = f.field();
    f.loaded();
    f.raceDone(rows(field));
    return f;
  };
  test('the table leads to the podium by itself, or at a press', () => {
    const f = race();
    assert.equal(f.phase, 'results');
    f.step(FLOW.results - 0.5);
    assert.equal(f.phase, 'results');
    f.step(1);
    assert.equal(f.phase, 'podium');
    assert.equal(f.top3().length, 3);
  });
  test('under the TV\'s podium of a single race the phone stays on its results: rematch and change track stay in reach', () => {
    const f = race();
    f.toPodium();
    assert.equal(f.phoneFor(), 'results');
    assert.equal(typeof f.menuFor(0).place, 'number');
  });
  test('rematch keeps track and karts, change track votes again, the lobby keeps the seats and clears the picks', () => {
    let f = race();
    f.next('rematch');
    assert.equal(f.phase, 'loading');
    assert.equal(f.state.track, 'bali');
    assert.equal(f.seats[0].kart, KARTS[0]);
    f = race();
    f.next('track');
    assert.equal(f.phase, 'vote');
    assert.equal(f.seats[0].track, null);
    f = race();
    f.next('lobby');
    assert.equal(f.phase, 'lobby');
    assert.equal(f.seats[0].present, true);
    assert.equal(f.seats[0].kart, null);
  });
  test('points are only for a Gran Premio', () => {
    assert.ok(race().state.results.rows.every((r) => r.points === 0));
  });
  test('a phone that stayed away gives its seat up on the way to the lobby', () => {
    const f = make();
    f.join(0); f.join(1);
    f.go();
    f.leave(1);
    f.pick(0, 'jeep', true);
    f.step(FLOW.allReady + 0.1);
    f.forceTrack('bali');
    f.step(FLOW.solo + 0.1);
    f.field(); f.loaded();
    f.raceDone(rows(f.state.field));
    f.next('lobby');
    assert.equal(f.seats[1].present, false);
  });
  test('quit and restart from the pause menu', () => {
    const f = make();
    toVote(f, 0);
    f.forceTrack('bali');
    f.step(FLOW.solo + 0.1);
    f.field(); f.loaded();
    assert.equal(f.restart(), true);
    assert.equal(f.phase, 'loading');
    f.loaded();
    assert.equal(f.quit(), true);
    assert.equal(f.phase, 'lobby');
  });
});

describe('the field', () => {
  const field = (humans, bots) => {
    const f = make();
    f.setOpts({ bots });
    for (let i = 0; i < humans; i++) f.join(i);
    f.go();
    for (let i = 0; i < humans; i++) f.pick(i, KARTS[i], true);
    return f.field();
  };
  test('one player with bots, four with none, four with seven asked for', () => {
    assert.equal(field(1, 7).length, 8);
    assert.equal(field(4, 0).length, 4);
    assert.equal(field(4, 7).length, 8);
    assert.equal(field(1, 0).length, 1);
  });
  test('bots avoid the karts the humans took while there are others', () => {
    const list = field(3, 5);
    const taken = list.filter((p) => p.human).map((p) => p.kart);
    assert.ok(list.filter((p) => !p.human).every((p) => !taken.includes(p.kart)));
    assert.equal(new Set(list.map((p) => p.kart)).size, list.length);
  });
  test('humans start in the back half but not dead last', () => {
    const list = field(1, 7);
    const at = list.findIndex((p) => p.human);
    assert.ok(at >= 4 && at < 7, `grid position ${at}`);
  });
  test('a phone gone before the start does not race', () => {
    const f = make();
    f.join(0); f.join(1);
    f.go();
    f.pick(0, 'jeep', true);
    f.leave(1);
    assert.equal(f.field().filter((p) => p.human).length, 1);
  });
});

describe('what a phone hears', () => {
  test('at the results the lowest phone connected has the buttons, and they move when it leaves or returns', () => {
    const f = make();
    f.join(0); f.join(1); f.join(2);
    assert.equal(f.authority(), 0);
    f.leave(0);
    assert.equal(f.authority(), 1);
    f.state.phase = 'results';
    assert.deepEqual([f.menuFor(0).edit, f.menuFor(1).edit, f.menuFor(2).edit], [false, true, false]);
    f.leave(1);
    assert.deepEqual([f.menuFor(1).edit, f.menuFor(2).edit], [false, true]);
    f.join(0);
    assert.deepEqual([f.menuFor(0).edit, f.menuFor(2).edit], [true, false]);
    f.join(3, 'keyboard');
    f.leave(0); f.leave(2);
    assert.equal(f.authority(), -1, 'a keyboard seat has no phone to tap');
  });
  test('reset: back to the lobby with no seats, from any phase', () => {
    const f = make();
    f.join(0); f.join(1);
    f.go();
    f.drain();
    f.reset();
    assert.equal(f.phase, 'lobby');
    assert.deepEqual(f.seats.filter((s) => s.present), []);
    const ev = f.drain();
    assert.ok(ev.some((e) => e.type === 'phase' && e.phase === 'lobby'));
    assert.deepEqual(ev.filter((e) => e.type === 'free').map((e) => e.slot), [0, 1]);
  });
  test('its menu for each phase', () => {
    const f = make();
    f.join(0); f.join(1);
    assert.deepEqual(f.menuFor(0).opts, f.opts);
    assert.equal(f.menuFor(1).edit, true);
    f.go();
    f.pick(1, 'jeep', true);
    let m = f.menuFor(0);
    assert.deepEqual(m.karts, KARTS);
    assert.deepEqual(m.others, [{ slot: 1, kart: 'jeep', ready: true }]);
    f.pick(0, 'gatto', true);
    f.step(FLOW.allReady + 0.1);
    f.vote(1, 'bali', true);
    m = f.menuFor(0);
    assert.deepEqual(m.tracks, TRACKS);
    assert.deepEqual(m.others, [{ slot: 1, track: 'bali', lock: true }]);
    assert.equal(m.pick, null);
    f.vote(0, 'bali', true);
    assert.equal(f.menuFor(0).pick, 'bali');
  });
  test('a phone that comes back takes its seat back, with its pick', () => {
    const f = make();
    f.join(0);
    f.go();
    f.pick(0, 'jeep', false);
    f.leave(0);
    assert.equal(f.seats[0].away, true);
    f.join(0);
    assert.equal(f.seats[0].away, false);
    assert.equal(f.menuFor(0).kart, 'jeep');
  });
  test('sim events become vibrations for humans only', () => {
    const karts = [{ i: 0, slot: 1, human: true }, { i: 1, slot: -1, human: false }];
    const out = padFx([
      { type: 'boxTake', kart: 0, item: 'razzo' }, { type: 'boxTake', kart: 0, item: null }, { type: 'boxTake', kart: 1, item: 'razzo' },
      { type: 'hit', kart: 0, kind: 'tumble' }, { type: 'hit', kart: 0, kind: 'slide' }, { type: 'boost', kart: 0 }, { type: 'shield', kart: 0 },
      { type: 'lap', kart: 0 }, { type: 'lastLap', kart: 0 }, { type: 'finish', kart: 0, place: 3 }, { type: 'bump', a: 0, b: 1 },
    ], karts);
    assert.deepEqual(out.map((m) => m.kind), ['roulette', 'box', 'hit', 'bump', 'boost', 'shield', 'lap', 'lastLap', 'finish', 'bump']);
    assert.equal(out[0].item, 'razzo');
    assert.equal(out[8].place, 3);
    assert.ok(out.every((m) => m.slot === 1));
  });
  test('the phone feels the turbo by its tier, charging a drift, a landing and an item; bots feel nothing', () => {
    const karts = [{ i: 0, slot: 1, human: true }, { i: 1, slot: -1, human: false }];
    const of = (e) => padFx([e], karts).map(({ slot, ...m }) => m);
    assert.deepEqual(of({ type: 'boost', kart: 0, kind: 'drift', tier: 3 }), [{ kind: 'boost', tier: 3 }]);
    assert.deepEqual(of({ type: 'boost', kart: 0, kind: 'pad' }), [{ kind: 'boost', tier: 1 }]);
    assert.deepEqual(of({ type: 'driftStart', kart: 0, dir: 1 }), [{ kind: 'drift' }]);
    assert.deepEqual(of({ type: 'driftTier', kart: 0, tier: 2 }), [{ kind: 'charge', tier: 2 }]);
    assert.deepEqual(of({ type: 'driftTier', kart: 0, tier: 0 }), []);
    assert.deepEqual(of({ type: 'land', kart: 0, force: 14 }), [{ kind: 'land', big: true }]);
    assert.deepEqual(of({ type: 'land', kart: 0, force: 5 }), [{ kind: 'land', big: false }]);
    assert.deepEqual(of({ type: 'itemUse', kart: 0, item: 'razzo' }), [{ kind: 'use' }]);
    assert.deepEqual(of({ type: 'traffic', kart: 0, kind: 'scrape' }), [{ kind: 'bump' }]);
    assert.deepEqual(of({ type: 'traffic', kart: 0, kind: 'part' }), [], 'a scooter parting is only an opinion');
    for (const type of ['boost', 'driftStart', 'driftTier', 'land', 'itemUse', 'traffic']) assert.deepEqual(of({ type, kart: 1, tier: 2, kind: 'scrape' }), [], type);
  });
  test('the HUD: the item is hidden while it spins, laps are 1 based and capped', () => {
    const k = { place: 2, lap: 1, item: null, itemCharges: 0, rouletteT: 0.4, boostT: 1 };
    assert.deepEqual(hudOf(k, 3), { place: 2, lap: 2, laps: 3, item: null, charges: 0, boost: true });
    assert.equal(hudOf({ ...k, lap: 3, rouletteT: 0, item: 'mici', itemCharges: 3 }, 3).lap, 3);
    assert.equal(hudOf({ ...k, rouletteT: 0, item: 'mici' }, 3).item, 'mici');
  });
  test('about five HUDs a second, and at once on a change', () => {
    const feed = createHudFeed();
    const h = { place: 1, lap: 1, item: null, charges: 0, boost: false };
    assert.equal(feed.due(0, h, 0), true);
    assert.equal(feed.due(0, h, 0.1), false);
    assert.equal(feed.due(0, h, 0.21), true);
    assert.equal(feed.due(0, { ...h, place: 2 }, 0.22), true);
    feed.forget(0);
    assert.equal(feed.due(0, { ...h, place: 2 }, 0.23), true);
  });
  test('results rows sort by place and a kart still out has no time', () => {
    const r = resultRows([{ i: 0, slot: 0, kart: 'a', human: true, place: 2, finished: false, finishT: 0, bestLapT: null }, { i: 1, slot: -1, kart: 'b', human: false, place: 1, finished: true, finishT: 90, bestLapT: 29 }]);
    assert.deepEqual(r.map((x) => x.place), [1, 2]);
    assert.equal(r[0].time, 90);
    assert.equal(r[1].time, null);
  });
});

test('the HUD views sit where the renderer draws them', () => {
  for (const n of [1, 2, 3, 4]) {
    const L = viewLayout(n);
    for (let q = 0; q < Math.min(n, L.length); q++) {
      const [x, y, w, h] = L[q], [a, b, c, d] = viewRect(q, n);
      assert.deepEqual([a, b, c, d], [x, 1 - y - h, w, h], `view ${q} of ${n}`);
    }
  }
});

// ---------- in the browser ----------
const hasBrowser = !!headlessShell();
test('a whole evening in the browser: lobby to podium, a phone leaving and returning, rematch, change track, Gran Premio', { skip: !hasBrowser && 'no browser', timeout: 280000 }, async (t) => {
  const dist = mkdtempSync(join(tmpdir(), 'rk-flow-'));
  execFileSync(process.execPath, ['build.mjs'], { cwd: ROOT, env: { ...process.env, DIST: dist }, stdio: 'ignore' });
  const srv = await startServer({ distDir: dist, padSilentMs: 1e9, reserveMs: 60000 });
  const browser = await launch('metal');
  t.after(async () => { await browser.close(); await srv.close(); rmSync(dist, { recursive: true, force: true }); });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'en-US' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${srv.base}/?quality=capture&laps=2`);
  await page.waitForFunction(() => window.__game?.ready || window.__game?.error, null, { timeout: 60000 });
  const phase = (p, ms = 90000) => page.waitForFunction((q) => window.__game.phase === q || window.__game.error, p, { timeout: ms });
  const g = (fn, arg) => page.evaluate(fn, arg);
  assert.equal(await g(() => window.__game.error), null);
  assert.equal(await g(() => window.__game.phase), 'lobby');

  // a real phone page in the first seat, a scripted one in the second
  const phoneCtx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, locale: 'en-US' });
  const real = await phoneCtx.newPage();
  await real.goto(`${srv.base}/pad`);
  await real.waitForFunction(() => window.__pad?.joined && window.__pad.slot === 0, null, { timeout: 15000 });
  await real.waitForFunction(() => window.__pad.phase === 'lobby', null, { timeout: 5000 });
  const p2 = await pad(srv, 'phone-two');
  await page.waitForFunction(() => window.__game.seats?.filter((s) => s.present).length === 2);

  // options from the phone reach the TV, the TV's reach the phone
  p2.send({ t: 'opt', bots: 3, laps: 2 });
  await page.waitForFunction(() => window.__game.flowApi.opts.bots === 3);
  await real.waitForFunction(() => window.__pad.menu.opts?.bots === 3, null, { timeout: 3000 });

  await real.click('#goBtn');
  await phase('pick');
  await real.waitForFunction(() => window.__pad.phase === 'pick', null, { timeout: 3000 });
  // the phone says which card is in front before anyone confirms
  await page.waitForFunction(() => window.__game.seats[0].kart);
  p2.send({ t: 'pick', kart: 'jeep', ready: false });
  await page.waitForFunction(() => window.__game.seats[1].kart === 'jeep');
  await real.waitForFunction(() => (window.__pad.menu.others || []).some((o) => o.slot === 1 && o.kart === 'jeep'), null, { timeout: 3000 });
  await real.click('#readyBtn');
  p2.send({ t: 'pick', kart: 'jeep', ready: true });
  await phase('vote');
  await real.waitForFunction(() => window.__pad.phase === 'vote', null, { timeout: 3000 });
  const track = await g(() => window.__game.flowApi.tracks[0]);
  p2.send({ t: 'vote', track, lock: true });
  await real.evaluate((id) => { window.__pad.carousel.show?.(id); }, track);
  await real.click('#voteBtn');
  await page.waitForFunction(() => window.__game.phase === 'loading' || window.__game.flowApi.state.vote.phase !== 'open');
  await phase('race');
  await page.waitForFunction(() => window.__game.flyover || window.__game.state?.phase);
  // a phone press skips the flyover
  await page.evaluate(() => window.__game.skipFlyover());
  await page.waitForFunction(() => !window.__game.flyover);
  await real.waitForFunction(() => window.__pad.phase === 'race', null, { timeout: 3000 });

  // a phone leaves: the seat stays, the TV says so; it comes back and hears everything again
  await p2.close();
  await page.waitForFunction(() => window.__game.seats[1].away === true);
  const missing = await page.waitForFunction(() => [...document.querySelectorAll('.hv .miss')].some((e) => !e.classList.contains('hide')), null, { timeout: 10000 });
  assert.ok(missing);
  const back = await pad(srv, 'phone-two');
  const heard = await back.next((m) => m.t === 'phase');
  assert.equal(heard.phase, 'race');
  const hud = await back.next((m) => m.t === 'hud');
  assert.ok(hud.laps === 2);
  await page.waitForFunction(() => window.__game.seats[1].away === false);
  await page.waitForFunction(() => [...document.querySelectorAll('.hv .miss')].every((e) => e.classList.contains('hide')), null, { timeout: 3000 });

  // the rest of the race on autopilot, at speed
  await g(() => { window.__game.setAuto(true); window.__game.advance(40000); });
  await phase('results');
  const results = await g(() => window.__game.results);
  assert.equal(results.length, 5);
  assert.deepEqual(results.map((r) => r.place), [1, 2, 3, 4, 5]);
  await real.waitForFunction(() => window.__pad.phase === 'results', null, { timeout: 3000 });
  await real.waitForFunction(() => window.__pad.menu.place > 0, null, { timeout: 3000 });
  // nothing is left of the HUD under the results, and the TV goes to the podium by itself
  assert.equal(await g(() => document.querySelector('.hudscr').classList.contains('hide')), true);
  await g(() => window.__game.next('podium'));
  await phase('podium');
  assert.equal(await real.evaluate(() => window.__pad.phase), 'results', 'the phone keeps its buttons');
  assert.equal((await g(() => window.__game.podium)).length, 3);

  // rematch from the phone: straight back, same track, no reload of the world
  await real.click('#resAgain');
  await phase('race');
  assert.equal(await g(() => window.__game.track), track);
  await g(() => { window.__game.manual = true; window.__game.skipFlyover(); });
  await page.waitForFunction(() => !window.__game.flyover);
  await g(() => window.__game.advance(40000));
  await phase('results');
  // change track from the phone
  await real.click('#resTrack');
  await phase('vote');
  await real.waitForFunction(() => window.__pad.phase === 'vote', null, { timeout: 3000 });
  assert.equal(await g(() => window.__game.seats[0].track), null, 'a fresh ballot');
  // back to the lobby from the TV: click-through by the menu's own wiring
  await g(() => { const f = window.__game.flowApi; f.forceTrack(f.tracks[0]); });
  await phase('race');
  await g(() => { window.__game.manual = true; window.__game.skipFlyover(); });
  await page.waitForFunction(() => !window.__game.flyover);
  await g(() => window.__game.advance(40000));
  await phase('results');
  await page.click('.results .bigbtn[data-a="lobby"]', { force: true });
  await phase('lobby');
  await real.waitForFunction(() => window.__pad.phase === 'lobby', null, { timeout: 3000 });

  // a Gran Premio of two races from the phone's menus and a cumulative table
  back.send({ t: 'opt', mode: 'gp' });
  await page.waitForFunction(() => window.__game.flowApi.opts.mode === 'gp');
  await g(() => window.__game.flowApi.setOpts({ mode: 'gp', laps: 2, bots: 2 }));
  await g(() => { const f = window.__game.flowApi; f.go(); });
  await phase('pick');
  await g(() => { const f = window.__game.flowApi; f.pick(0, 'tabia', true); f.pick(1, 'gatto', true); });
  await phase('vote');
  // Keep one short and one long track in this regression: a random GP can miss Batur.
  await g(() => { const f = window.__game.flowApi; f.gpPreset('clear'); f.gpToggle('antelao'); f.gpToggle('batur'); });
  back.send({ t: 'vote', track: 'random', lock: true });
  await phase('race');
  const races = await g(() => window.__game.flowApi.state.gp.tracks.length);
  for (let i = 0; i < races; i++) {
    await g(() => { window.__game.manual = true; window.__game.skipFlyover(); });
    await page.waitForFunction(() => !window.__game.flyover);
    // Two laps of a long track can exceed 40000 ticks. Advance until the race ends,
    // with a finite 2000 s simulation budget so a stuck kart still fails the test.
    for (let ticks = 0; ticks < 120000 && await g(() => window.__game.phase === 'race'); ticks += 2000) {
      await g(() => window.__game.advance(2000));
    }
    const raceEnd = await g(() => ({ phase: window.__game.phase, track: window.__game.track, t: window.__game.state.t, laps: window.__game.state.karts.map((k) => k.lap) }));
    assert.equal(raceEnd.phase, 'results', JSON.stringify(raceEnd));
    t.diagnostic(`GP race ${i + 1}: ${raceEnd.track}, ${raceEnd.t.toFixed(1)} s`);
    assert.equal((await g(() => window.__game.gp)).n, i + 1);
    if (i < races - 1) { await g(() => window.__game.next('rematch')); await phase('race'); }
  }
  const table = await g(() => window.__game.gp.table);
  assert.equal(table.length, 4);
  assert.ok(table[0].points >= table[3].points);
  await g(() => window.__game.next('podium'));
  await phase('podium');
  await real.waitForFunction(() => window.__pad.phase === 'podium', null, { timeout: 3000 });
  await g(() => window.__game.next('lobby'));
  await phase('lobby');

  assert.deepEqual(errors, []);
  await back.close();
  await sleep(50);
});

test('the keyboard alone, in real time: from the lobby to a moving kart, to the pause and out', { skip: !hasBrowser && 'no browser', timeout: 120000 }, async (t) => {
  const dist = mkdtempSync(join(tmpdir(), 'rk-keys-'));
  execFileSync(process.execPath, ['build.mjs'], { cwd: ROOT, env: { ...process.env, DIST: dist }, stdio: 'ignore' });
  const srv = await startServer({ distDir: dist });
  const browser = await launch('metal');
  t.after(async () => { await browser.close(); await srv.close(); rmSync(dist, { recursive: true, force: true }); });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'it-IT' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${srv.base}/?quality=capture&laps=2&bots=3`);
  await page.waitForFunction(() => window.__game?.ready, null, { timeout: 60000 });
  const phase = (p) => page.waitForFunction((q) => window.__game.phase === q, p, { timeout: 60000 });
  const tap = async (code) => { await page.keyboard.down(code); await sleep(90); await page.keyboard.up(code); await sleep(90); };
  await sleep(700); // past the guard that stops a held key running through the menus

  await tap('KeyE');
  await phase('pick');
  assert.equal(await page.evaluate(() => window.__game.seats[0].source), 'keyboard');
  await sleep(600);
  await tap('KeyD');
  const kart = await page.evaluate(() => window.__game.seats[0].kart);
  assert.ok(kart);
  await tap('KeyD');
  assert.notEqual(await page.evaluate(() => window.__game.seats[0].kart), kart, 'D moves to the next kart');
  await tap('KeyE');
  await phase('vote');
  await sleep(600);
  await tap('KeyE');
  await tap('KeyE');
  await page.waitForFunction(() => window.__game.seats[0].lock || window.__game.phase !== 'vote', null, { timeout: 5000 }).catch(() => {});
  await phase('race');
  // the flyover goes at any key, and the clock runs by itself from there
  await page.waitForFunction(() => window.__game.flyover);
  await sleep(300);
  await tap('Space');
  await page.waitForFunction(() => !window.__game.flyover && window.__game.state.phase === 'race', null, { timeout: 15000 });
  const before = await page.evaluate(() => { const k = window.__game.state.karts[window.__game.views[0]]; return { x: k.x, z: k.z, y: k.y, frames: window.__game.frames }; });
  await page.keyboard.down('KeyW');
  await sleep(1500);
  await page.keyboard.up('KeyW');
  const after = await page.evaluate(() => { const k = window.__game.state.karts[window.__game.views[0]]; return { x: k.x, z: k.z, y: k.y, frames: window.__game.frames }; });
  assert.ok(Math.hypot(after.x - before.x, after.z - before.z) > 3, 'the kart drives');
  assert.ok(after.frames > before.frames + 5, 'frames are drawn');

  await tap('Escape');
  assert.equal(await page.evaluate(() => window.__game.paused), true);
  const frozen = await page.evaluate(() => window.__game.state.t);
  await sleep(300);
  assert.equal(await page.evaluate(() => window.__game.state.t), frozen, 'the pause stops the race');
  await page.click('.pausescr button[data-a="quit"]', { timeout: 3000 });
  await phase('lobby');
  assert.deepEqual(errors, []);
});


test('every track has a picture of its own on the vote card; only the random card is the mosaic', async () => {
  const { trackArt } = await import('../src/ui/screens/art.js');
  const { TRACK_IDS } = await import('../src/data/tracks.js');
  for (const id of TRACK_IDS) assert.doesNotMatch(trackArt(id), /mosaic/, `${id} falls back to the surprise card`);
  assert.match(trackArt('random'), /mosaic/);
});
