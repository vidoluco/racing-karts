// Caccia alla Forma: the rules in the sim, on a short track and a long one; what the items and the bots do with it; the flow; the words. Then
// the real path in a browser: a real phone page and the TV from the lobby to the results and the podium, and a normal race after it with none of it.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildTrack } from '../src/world/track.js';
import { buildTerrain } from '../src/world/terrain.js';
import { createRace, DT } from '../src/sim/index.js';
import { FORMA } from '../src/sim/tuning.js';
import { FORMA_LAPS } from '../src/sim/forma.js';
import { formaHud, formaRows } from '../src/game/forma.js';
import { createFlow, FLOW, padFx, hudOf, createHudFeed, FORMA_MIN_BOTS } from '../src/game/flow.js';
import { loadTrackDef } from '../src/data/tracks.js';
import { sanitizeOpt } from '../server/room.js';
import { it as IT, en as EN } from '../src/i18n/index.js';
import { SFX } from '../src/audio/sfx.js';
import { rng32 } from '../src/audio/dsp.js';
import { launch, headlessShell, buildDist, startServerProcess, openPad, thumbFor } from '../tools/harness.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const KARTS = ['tabia', 'gatto', 'seggiovia', 'mocanita', 'caruta', 'logan', 'jeep', 'becak'];
const worlds = new Map();
async function world(id) {
  if (!worlds.has(id)) {
    const track = buildTrack(await loadTrackDef(id));
    worlds.set(id, { track, terrain: buildTerrain(track) });
  }
  return worlds.get(id);
}
const field = (n = 8, human = -1) => KARTS.slice(0, n).map((kart, i) => ({ slot: i === human ? 0 : -1, kart, human: i === human }));
const hash = (s) => {
  const text = JSON.stringify(s);
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};
const run = (r, steps, inputs = () => []) => { const out = []; for (let s = 0; s < steps && r.state.phase !== 'done'; s++) { r.step(inputs(r)); out.push(...r.drainEvents()); } return out; };
// the holder for a test: put the wheel in this kart's hands by parking it on the wheel
function give(r, i) {
  const F = r.state.forma, T = r.internals.track;
  r.teleport(i, F.wheel.f / T.n, F.wheel.d, { speed: 10 });
  for (let s = 0; s < 40 && F.holder !== i; s++) { r.state.karts[i].x = F.wheel.x; r.state.karts[i].z = F.wheel.z; r.state.karts[i].y = F.wheel.y - 1; r.step([]); }
  r.drainEvents();
  assert.equal(F.holder, i, 'the wheel is in its hands');
}

describe('the rules', () => {
  test('nothing of it in a normal race: no state, the same bytes with the option spelled false', async () => {
    const { track, terrain } = await world('antelao');
    const a = createRace({ track, terrain, seed: 9, laps: 2, countdown: 0, players: field() });
    const b = createRace({ track, terrain, seed: 9, laps: 2, countdown: 0, players: field(), forma: false });
    assert.equal(a.state.forma, undefined);
    assert.equal(a.internals.forma, undefined);
    for (let s = 0; s < 1200; s++) { a.step([]); b.step([]); const q = [...a.drainEvents(), ...b.drainEvents()]; assert.ok(!q.some((e) => e.type.startsWith('forma'))); }
    assert.equal(hash(a.state), hash(b.state));
    assert.equal(a.state.laps, 2);
  });

  test('the same seed and inputs give the same match, and another seed another', async () => {
    const { track, terrain } = await world('antelao');
    const go = (seed) => { const r = createRace({ track, terrain, seed, countdown: 0, players: field(), forma: { duration: 40 } }); run(r, 60 * 42); return r; };
    const a = go(21), b = go(21), c = go(22);
    assert.equal(hash(a.state), hash(b.state));
    assert.notEqual(hash(a.state.forma.held), hash(c.state.forma.held));
  });

  test('the wheel waits through the countdown, then rolls ahead by itself and nobody can hold it before the go', async () => {
    const { track, terrain } = await world('antelao');
    const r = createRace({ track, terrain, seed: 3, countdown: 2, players: field(), forma: true });
    const F = r.state.forma, f0 = F.wheel.f;
    assert.ok(Math.abs(F.gaps[0]) < 1e-9 && F.holder === -1);
    for (let s = 0; s < 100; s++) r.step([]);
    assert.equal(F.wheel.f, f0, 'still');
    assert.equal(F.left, FORMA.duration, 'the clock has not started');
    for (let s = 0; s < 120; s++) r.step([]);
    assert.ok(((F.wheel.f - f0 + track.n) % track.n) * track.step > 10, 'it rolled');
    assert.ok(F.left < FORMA.duration);
  });

  test('the laps do not end it, the clock does; the longest held is first, and the wheel goes home with the winner', async () => {
    const { track, terrain } = await world('antelao');
    const r = createRace({ track, terrain, seed: 5, laps: 1, countdown: 0, players: field(), forma: { duration: 90 } });
    assert.equal(r.state.laps, FORMA_LAPS);
    const kinds = new Set(run(r, 60 * 95).map((e) => e.type));
    const F = r.state.forma, S = r.state;
    assert.equal(S.phase, 'done');
    assert.ok(Math.abs(S.t - 90) < 0.1, `over at ${S.t}`);
    assert.ok(!kinds.has('lap') && !kinds.has('overtake'), 'no laps to chime for');
    assert.ok(kinds.has('formaGrab') && kinds.has('formaEnd') && kinds.has('finish'));
    const byPlace = [...S.karts].sort((a, b) => a.place - b.place);
    for (let i = 1; i < byPlace.length; i++) assert.ok(F.held[byPlace[i - 1].i] >= F.held[byPlace[i].i], 'in order of seconds held');
    assert.equal(new Set(S.karts.map((k) => k.place)).size, S.karts.length, 'each its own place');
    assert.equal(F.holder, byPlace[0].i);
    const total = F.held.reduce((a, b) => a + b, 0);
    assert.ok(total > 40 && total <= 90.01, `seconds held in all: ${total}`);
    const before = [...F.held];
    run(r, 120);
    assert.deepEqual(F.held, before, 'the clock stays stopped after the end');
  });

  test('any hit drops it, and a kart cannot take back what it lost at once; someone else can', async () => {
    const { track, terrain } = await world('antelao');
    for (const [kind, cause] of [['spin', 'mici'], ['tumble', 'razzo'], ['slide', 'polenta']]) {
      const r = createRace({ track, terrain, seed: 7, countdown: 0, players: field(3), forma: true }), F = r.state.forma;
      give(r, 0);
      r.state.karts[0].safeT = 0;
      assert.equal(r.internals.hitKart(r.state.karts[0], 1, kind, cause), 'hit');
      r.step([]);
      const ev = r.drainEvents(), d = ev.find((e) => e.type === 'formaDrop');
      assert.ok(d, `${kind} drops it`);
      assert.equal(d.by, 1);
      assert.equal(F.holder, -1);
      assert.equal(F.wheel.lockKart, 0);
      assert.ok(F.wheel.lockT > 0);
      // on it, with the kart that lost it: nothing until the lock runs out
      const k = r.state.karts[0];
      k.hitT = 0; k.hitKind = null;
      for (let s = 0; s < 40; s++) { k.x = F.wheel.x; k.z = F.wheel.z; k.y = F.wheel.y - 1; r.step([]); assert.equal(F.holder, -1, 'not back in its own hands yet'); }
      r.drainEvents();
      r.state.karts[1].x = F.wheel.x; r.state.karts[1].z = F.wheel.z; r.state.karts[1].y = F.wheel.y - 1;
      k.x += 30;
      r.step([]);
      const g = r.drainEvents().find((e) => e.type === 'formaGrab');
      assert.equal(g?.kart, 1, 'the other kart takes it');
      assert.equal(g.from, 0);
    }
  });

  test('mici take the hit and the wheel stays; the pan is immune; a stork ride drops it on the road', async () => {
    const { track, terrain } = await world('antelao');
    const mk = () => { const r = createRace({ track, terrain, seed: 7, countdown: 0, players: field(3), forma: true }); give(r, 0); r.state.karts[0].safeT = 0; return r; };
    let r = mk();
    r.give(0, 'mici');
    assert.equal(r.internals.hitKart(r.state.karts[0], 1, 'spin', 'razzo'), 'blocked');
    r.step([]);
    assert.equal(r.state.forma.holder, 0);
    r = mk();
    r.state.karts[0].bigT = 3;
    assert.equal(r.internals.hitKart(r.state.karts[0], 1, 'spin', 'razzo'), 'immune');
    r.step([]);
    assert.equal(r.state.forma.holder, 0);
    r = mk();
    r.rescue(0);
    r.step([]);
    const d = r.drainEvents().find((e) => e.type === 'formaDrop');
    assert.equal(d?.cause, 'rescue');
    const F = r.state.forma, i = Math.round(F.wheel.f) % track.n;
    assert.ok(Math.abs(F.wheel.d) < track.samples.w[i] / 2, 'on the road');
  });

  test('a hard shove and a long push take it off the holder; a light touch and the first seconds in hand do not', async () => {
    const { track, terrain } = await world('antelao');
    const r0 = createRace({ track, terrain, seed: 7, countdown: 0, players: field(3), forma: true });
    give(r0, 0);
    const F0 = r0.state.forma, K0 = r0.state.karts;
    K0[0].safeT = 0;
    F0.wheel.grace = FORMA.ramGrace;
    r0.internals.emit({ type: 'bump', a: 0, b: 1, force: FORMA.ramForce + 3 });
    r0.step([]);
    assert.equal(F0.holder, 0, 'in its first seconds nothing shoves it off');
    F0.wheel.grace = 0;
    r0.internals.emit({ type: 'bump', a: 0, b: 1, force: 2 });
    r0.step([]);
    assert.equal(F0.holder, 0, 'a light touch is only a touch');
    r0.internals.emit({ type: 'bump', a: 1, b: 0, force: FORMA.ramForce + 0.1 });
    r0.step([]);
    assert.equal(F0.holder, -1, 'a hard shove is');
    assert.equal(r0.drainEvents().find((e) => e.type === 'formaDrop').cause, 'ram');
    // on a turbo any bump will do
    const r1 = createRace({ track, terrain, seed: 7, countdown: 0, players: field(3), forma: true });
    give(r1, 0);
    r1.state.karts[0].safeT = 0; r1.state.forma.wheel.grace = 0; r1.state.karts[1].boostT = 1;
    r1.internals.emit({ type: 'bump', a: 0, b: 1, force: 2 });
    r1.step([]);
    assert.equal(r1.state.forma.holder, -1);
    // parked on the bumper: soft contact, no bump event, and the time runs out for the holder
    const r2 = createRace({ track, terrain, seed: 7, countdown: 0, players: field(3), forma: true });
    give(r2, 0);
    const K = r2.state.karts, F = r2.state.forma;
    K[0].safeT = 0; F.wheel.grace = 0;
    let t = 0;
    while (F.holder === 0 && t < 3) {
      K[1].x = K[0].x + 2.2; K[1].z = K[0].z; K[1].y = K[0].y; K[1].hitT = 0; K[1].vx = K[0].vx; K[1].vz = K[0].vz;
      r2.step([]); t += DT;
    }
    assert.equal(F.holder, -1);
    assert.ok(t > FORMA.pressT * 0.9 && t < FORMA.pressT + 0.4, `after ${t} s`);
  });

  test('the wheel weighs: the longer in hand the slower; behind it you are pulled, ahead of it you are held back', async () => {
    const { track, terrain } = await world('antelao');
    const r = createRace({ track, terrain, seed: 7, countdown: 0, players: field(4), forma: true });
    give(r, 0);
    const F = r.state.forma, P = r.internals.priv, wf = F.wheel.f / track.n;
    r.teleport(1, wf - 120 / track.length, 0, { speed: 20 });
    r.teleport(2, wf + 120 / track.length, 0, { speed: 20 });
    r.teleport(3, wf - 4 / track.length, 3, { speed: 20 });
    r.state.karts[0].safeT = 9; F.wheel.grace = 99;
    r.step([]);
    const fresh = P[0].rubber;
    assert.ok(fresh < 0, 'the holder gives speed up');
    assert.ok(P[1].rubber > FORMA.near, `chaser ${P[1].rubber}`);
    assert.ok(P[2].rubber < -0.3, `past it ${P[2].rubber}`);
    assert.ok(P[3].rubber > 0 && P[3].rubber < P[1].rubber);
    F.streak[0] = 60;
    r.step([]);
    assert.ok(P[0].rubber < fresh - 0.1, 'and more so later');
    // a human gets the same: it is the road's rule, not a bot's
    const h = createRace({ track, terrain, seed: 7, countdown: 0, players: field(3, 1), forma: true });
    h.teleport(1, (h.state.forma.wheel.f / track.n) - 150 / track.length, 0, { speed: 20 });
    h.step([, { steer: 0, throttle: 1 }]);
    assert.ok(h.internals.priv[1].rubber > FORMA.near);
  });

  test('a kart lost too far off is flown back behind the wheel', async () => {
    const { track, terrain } = await world('antelao');
    const r = createRace({ track, terrain, seed: 7, countdown: 0, players: field(3), forma: true }), F = r.state.forma;
    r.teleport(1, (F.wheel.f / track.n) - 600 / track.length, 0, { speed: 0 });
    const ev = run(r, 60 * 4);
    assert.ok(ev.some((e) => e.type === 'formaFetch' && e.kart === 1));
    assert.ok(ev.some((e) => e.type === 'rescue' && e.kart === 1), 'the stork, the one every other rescue uses');
    assert.ok(Math.abs(F.gaps[1]) < 200, `now ${F.gaps[1]} m off`);
  });

  test('the razzo goes for the holder, ahead or behind, and the frana falls on it; with the wheel loose the usual rules', async () => {
    const { track, terrain } = await world('antelao');
    const players = field(4).map((p, i) => (i ? { ...p, slot: i - 1, human: true } : p));
    const r = createRace({ track, terrain, seed: 7, countdown: 0, players, forma: true }), F = r.state.forma;
    give(r, 0);
    F.wheel.grace = 99;
    const wf = F.wheel.f / track.n;
    r.teleport(1, wf - 60 / track.length, 0, { speed: 25 });
    r.teleport(2, wf + 60 / track.length, 0, { speed: 25 });
    r.teleport(3, wf - 30 / track.length, 3, { speed: 25 });
    r.give(1, 'razzo');
    r.step([, { steer: 0, throttle: 1, item: true }]);
    const a = r.state.shots.find((s) => s.owner === 1 && s.kind === 'razzo');
    assert.equal(a?.target, 0);
    assert.equal(a.sweep, false);
    r.give(2, 'razzo');
    r.step([, , { steer: 0, throttle: 1, item: true }]);
    const b = r.state.shots.find((s) => s.owner === 2 && s.kind === 'razzo');
    assert.equal(b?.target, 0);
    assert.equal(b.free, true, 'from ahead it turns round through the air');
    r.give(3, 'frana');
    const before = r.state.spills.length;
    r.step([, , , { steer: 0, throttle: 1, item: true }]);
    const rocks = r.state.spills.slice(before).filter((s) => s.kind === 'frana');
    assert.ok(rocks.length > 0);
    const ahead = (((rocks[0].i - r.internals.priv[0].f) % track.n) + track.n) % track.n * track.step;
    assert.ok(ahead > 10 && ahead < 150, `in front of the holder: ${ahead}`);
    // on a road with no holder: the race's own rule, the kart ahead
    const q = createRace({ track, terrain, seed: 7, countdown: 0, players: field(4), forma: true });
    assert.equal(q.internals.forma.razzoAim(q.state.karts[1]), null);
  });

  test('no second cheese on the road: the crates never give the rolling wheel here, and still do in a race', async () => {
    const { track, terrain } = await world('antelao');
    const count = (forma) => {
      const r = createRace({ track, terrain, seed: 4, laps: 3, countdown: 0, players: field(), difficulty: 'hard', forma: forma && { duration: 170 } });
      let rolled = 0;
      for (let s = 0; s < 60 * 170 && r.state.phase !== 'done'; s++) { r.step([]); for (const e of r.drainEvents()) if (e.type === 'boxTake' && e.item === 'formaggio') rolled++; }
      return rolled;
    };
    assert.equal(count(true), 0);
    assert.ok(count(false) > 0, 'the check can see one');
  });

  for (const id of ['antelao', 'bali', 'batur', 'jakarta']) {
    test(`a real match on ${id}: the wheel changes hands, nobody runs away with it, the pack stays round it, bots do not get stuck`, async () => {
      const { track, terrain } = await world(id);
      const r = createRace({ track, terrain, seed: 11, countdown: 0, players: field(8), difficulty: 'medium', forma: true });
      let grabs = 0, looseT = 0, far = 0, n = 0, worst = 0;
      const still = new Array(8).fill(0);
      for (let s = 0; s < 60 * 182 && r.state.phase !== 'done'; s++) {
        r.step([]);
        for (const e of r.drainEvents()) if (e.type === 'formaGrab') grabs++;
        const F = r.state.forma;
        if (F.holder < 0) looseT += DT;
        if (!(s % 30)) { n++; far += F.gaps.reduce((a, g) => a + Math.abs(g), 0) / 8; }
        r.state.karts.forEach((k, i) => { still[i] = !k.finished && k.hitT <= 0 && k.rescueT <= 0 && Math.hypot(k.vx, k.vz) < 1 ? still[i] + DT : 0; worst = Math.max(worst, still[i]); });
      }
      const F = r.state.forma, sorted = [...F.held].sort((a, b) => b - a);
      assert.equal(r.state.phase, 'done');
      assert.ok(grabs >= 10, `${id}: ${grabs} grabs`);
      assert.ok(Math.max(...F.best) < 90, `${id}: longest hold ${Math.max(...F.best)}`);
      assert.ok(sorted[0] > 15 && sorted[0] < 110, `${id}: winner ${sorted[0]}`);
      assert.ok(looseT < 110, `${id}: ${looseT} s loose`);
      assert.ok(far / n < 140, `${id}: pack ${far / n} m from the wheel on average`);
      assert.ok(worst < 6, `${id}: stuck ${worst} s`);
    });
  }
});

describe('the game around it', () => {
  const make = () => createFlow({ karts: KARTS, tracks: ['antelao', 'batur'], rng: () => 0.3 });
  test('the room lets the mode through', () => {
    assert.equal(sanitizeOpt({ t: 'opt', mode: 'forma' }).mode, 'forma');
  });
  test('alone it gets bots whatever the lobby says; two people may duel; the lobby\'s number stands otherwise', () => {
    const f = make();
    f.join(0);
    f.setOpts({ mode: 'forma', bots: 0 });
    assert.equal(f.field().filter((p) => !p.human).length, FORMA_MIN_BOTS);
    f.setOpts({ bots: 5 });
    assert.equal(f.field().filter((p) => !p.human).length, 5);
    f.join(1);
    f.setOpts({ bots: 0 });
    assert.equal(f.field().filter((p) => !p.human).length, 0);
    const g = make();
    g.join(0);
    g.setOpts({ mode: 'race', bots: 0 });
    assert.equal(g.field().filter((p) => !p.human).length, 0, 'a normal race alone stays alone');
  });
  test('results and podium as any race; the phone hears the seconds held', () => {
    const f = make();
    f.join(0);
    f.setOpts({ mode: 'forma' });
    f.go();
    f.pick(0, KARTS[0], true);
    f.step(FLOW.allReady + 0.01);
    f.forceTrack('antelao');
    f.step(5);
    f.loaded();
    const F = { held: [10, 20], best: [5, 9], grabs: [2, 3], drops: [1, 2], rank: [2, 1], gaps: [0, 0] };
    const rows = formaRows([{ i: 0, slot: 0, kart: KARTS[0], human: true, place: 2, time: 180, bestLap: 50 }, { i: 1, slot: -1, kart: KARTS[1], human: false, place: 1, time: 180, bestLap: 50 }], F);
    f.raceDone(rows);
    assert.equal(f.phase, 'results');
    const m = f.menuFor(0);
    assert.equal(m.time, 10);
    assert.deepEqual(m.forma, { held: 10, best: 5, grabs: 2, drops: 1 });
    assert.equal(m.place, 2);
    f.step(FLOW.results + 1);
    assert.equal(f.phase, 'podium');
    assert.equal(f.top3()[0].time, 20);
  });
  test('a phone hears its rank and the clock in place of its place on the road and its laps; a normal race none of it', () => {
    const F = { rank: [3], held: [12.7], holder: 0, left: 61.2, gaps: [0], over: false };
    const k = { i: 0, place: 5, lap: 0, item: null, rouletteT: 0, itemCharges: 0, boostT: 0 };
    const h = formaHud(hudOf(k, FORMA_LAPS), F, k);
    assert.equal(h.place, 3);
    assert.equal(h.laps, 0);
    assert.deepEqual(h.forma, { left: 62, held: 12, mine: true, loose: false, gap: 0, over: false });
    assert.equal(hudOf(k, 3).forma, undefined);
    const feed = createHudFeed();
    assert.equal(feed.due(0, h, 0), true);
    assert.equal(feed.due(0, h, 0.01), false);
    assert.equal(feed.due(0, { ...h, forma: { ...h.forma, mine: false } }, 0.02), true, 'losing it is news at once');
  });
  test('a phone feels it in the hand', () => {
    const K = [{ i: 0, slot: 0, human: true }, { i: 1, slot: -1, human: false }, { i: 2, slot: 2, human: true }];
    assert.deepEqual(padFx([{ type: 'formaGrab', kart: 0 }], K), [{ slot: 0, kind: 'formaGrab' }]);
    assert.deepEqual(padFx([{ type: 'formaDrop', kart: 0 }], K), [{ slot: 0, kind: 'formaDrop' }]);
    assert.deepEqual(padFx([{ type: 'formaGrab', kart: 1 }], K), []);
    assert.deepEqual(padFx([{ type: 'formaLast' }], K).map((m) => m.slot), [0, 2]);
  });
  test('words in both languages, and the sounds render', () => {
    const keys = Object.keys(IT).filter((k) => k.startsWith('forma.') || k === 'lobby.forma' || k === 'lobby.startForma');
    assert.ok(keys.length > 15);
    for (const k of keys) assert.ok(EN[k], `${k} in English`);
    assert.match(IT['forma.bestHold'], /ù/);
    for (const name of ['formaGrab', 'formaDrop', 'formaOther', 'formaLead', 'formaTick', 'formaEnd']) {
      const b = SFX[name](44100, rng32(7)), L = b.left ?? b.l ?? b[0] ?? b;
      let peak = 0;
      for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]));
      assert.ok(L.length > 4000 && peak > 0.2 && peak <= 1.01, `${name}: ${L.length} samples, peak ${peak}`);
    }
  });
});

// ---------- the real path ----------
const hasBrowser = !!headlessShell();
const touch = (p, type, points) => p.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });

test('from the lobby to the podium by phone, on a short clock: the wheel on the road and in the hands, HUD, sounds, phone, results; then a normal race with none of it', { skip: !hasBrowser && 'no browser', timeout: 420000 }, async (t) => {
  const dist = mkdtempSync(join(tmpdir(), 'rk-forma-'));
  await buildDist(dist);
  const srv = await startServerProcess({ dist });
  const browser = await launch('metal');
  t.after(async () => { await browser.close(); await srv.close(); rmSync(dist, { recursive: true, force: true }); });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'it-IT' });
  const tv = await ctx.newPage();
  const errors = [];
  tv.on('pageerror', (e) => errors.push(e.message));
  await tv.goto(`${srv.base}/?lang=it&formaT=40`);
  await tv.waitForFunction(() => window.__game?.ready || window.__game?.error, null, { timeout: 120000 });
  assert.equal(await tv.evaluate(() => window.__game.error), null);
  const phone = await openPad(browser, srv.base, { label: 'forma', locale: 'it-IT' });
  t.after(() => phone.ctx.close().catch(() => {}));
  const tvIs = (ph, ms = 150000) => tv.waitForFunction((q) => window.__game.phase === q || window.__game.error, ph, { timeout: ms });
  const padIs = (ph, ms = 20000) => phone.page.waitForFunction((q) => window.__pad.phase === q, ph, { timeout: ms });
  const tap = (sel) => phone.page.locator(sel).tap();
  async function toTheRoad() {
    await tap('#goBtn');
    await tvIs('pick', 8000);
    await padIs('pick');
    await sleep(350);
    await tap('#readyBtn');
    await tvIs('vote', 8000);
    await padIs('vote');
    await sleep(350);
    await phone.page.evaluate(() => window.__pad.carousel.show?.('antelao'));
    await sleep(150);
    await tap('#voteBtn');
    await tvIs('race');
    await tv.waitForFunction(() => window.__game.state, null, { timeout: 120000 });
    await tv.evaluate(() => window.__game.skipFlyover());
    await tv.waitForFunction(() => window.__game.state?.phase === 'race', null, { timeout: 30000 });
  }

  // ---------- the lobby ----------
  await padIs('lobby');
  await tv.waitForFunction(() => window.__game.seats[0]?.present, null, { timeout: 20000 });
  await tap('.seg[data-key="mode"] button[data-v="forma"]');
  await tv.waitForFunction(() => window.__game.flowApi.opts.mode === 'forma', null, { timeout: 5000 });
  await tv.waitForFunction(() => document.querySelector('.lobby .chips[data-key="mode"] .chip[data-v="forma"]').classList.contains('on'), null, { timeout: 5000 });
  assert.ok(await tv.evaluate(() => document.querySelector('.lobby .ll').parentElement.classList.contains('off')), 'laps mean nothing here');
  assert.match(await tv.textContent('.lobby .gobtn span'), /forma/i);
  await toTheRoad();

  // ---------- the road ----------
  const facts = () => tv.evaluate(() => {
    const g = window.__game, s = g.state, F = s.forma, q = (c) => document.querySelector(`.hudscr ${c}`);
    return { laps: s.laps, duration: F?.duration, left: F?.left, boxes: s.boxes.length, karts: s.karts.length, where: q('.fo-where b')?.textContent, clock: q('.lap b')?.textContent, board: q('.fo-board')?.children.length, hv: q('.hv').classList.contains('forma'), wrong: q('.wrong').classList.contains('hide'), scene: g.renderer.scene.children.some((c) => c.renderOrder === 6 && c.visible) };
  });
  let f = await facts();
  assert.equal(f.duration, 40);
  assert.equal(f.karts, 8);
  assert.ok(f.boxes > 0, 'crates on the road');
  assert.ok(f.hv && f.board >= 3);
  assert.match(f.clock, /^0:[34]\d$/);
  assert.ok(f.where);
  // the wheel is in the picture
  await tv.evaluate(() => window.__game.draw());
  assert.ok((await facts()).scene, 'the wheel\'s world is drawn');

  // the stick by touch for a while, driving from what a bot would do
  const start = thumbFor(phone.geo, 0, 0);
  await touch(phone, 'touchStart', [{ ...start, id: 1 }]);
  const begun = Date.now();
  while (Date.now() - begun < 2500) {
    const want = await tv.evaluate(() => window.__game.botInput(0));
    await touch(phone, 'touchMove', [{ ...thumbFor(phone.geo, want.x, Math.min(0, want.y)), id: 1 }]);
    await sleep(50);
  }
  await touch(phone, 'touchEnd', []);
  assert.ok(await tv.evaluate(() => window.__game.state.karts.find((k) => k.human).speed > 8), 'the phone drives');

  // the phone's HUD follows the sim
  await phone.page.waitForFunction(() => !document.getElementById('formaTag').classList.contains('hide') && /\d:\d\d/.test(document.getElementById('lap').textContent), null, { timeout: 8000 });
  assert.match(await phone.page.textContent('#formaTag'), /\d+ m|Ce l/);

  // put the human's kart on the wheel: it is theirs, on the TV and on the phone
  await tv.evaluate(() => {
    const g = window.__game, i = g.state.karts.findIndex((k) => k.human), F = g.state.forma;
    g.setScript((j) => g.drive(j));
    g.__hold = setInterval(() => { const k = g.state.karts[i], w = F.wheel; if (F.holder !== i) { k.x = w.x; k.z = w.z; k.y = w.y - 1; k.hitT = 0; } }, 16);
  });
  await tv.waitForFunction(() => { const g = window.__game; return g.state.forma.holder === g.views[0]; }, null, { timeout: 20000 });
  await tv.evaluate(() => clearInterval(window.__game.__hold));
  await tv.waitForFunction(() => document.querySelector('.hudscr .fo-where').classList.contains('mine') || !window.__game.state.forma, null, { timeout: 5000 }).catch(() => {});
  await phone.page.waitForFunction(() => /Ce l|\d+ m/.test(document.getElementById('formaTag').textContent), null, { timeout: 5000 });
  assert.ok(await tv.evaluate(() => (window.__game.counts.formaGrab || 0) >= 1));

  // on to the end by autopilot
  await tv.evaluate(() => { window.__game.speed = 5; });
  await tv.waitForFunction(() => window.__game.state?.phase === 'done' || window.__game.phase === 'results', null, { timeout: 120000 });
  await tvIs('results', 40000);
  await padIs('results');
  const res = await tv.evaluate(() => {
    const g = window.__game;
    return { rows: g.results.map((r) => ({ place: r.place, held: r.forma?.held, time: r.time, human: r.human })), title: document.querySelector('.results h1').textContent, cls: document.querySelector('.results').classList.contains('forma'), first: document.querySelector('.results .rows .tm').textContent, counts: g.counts };
  });
  assert.equal(res.title, 'Caccia alla Forma');
  assert.ok(res.cls);
  assert.ok(res.rows.every((r, i) => r.place === i + 1 && Number.isFinite(r.held) && r.time === r.held));
  for (let i = 1; i < res.rows.length; i++) assert.ok(res.rows[i - 1].held >= res.rows[i].held);
  assert.ok(res.counts.formaEnd === 1 && res.counts.formaGrab >= 2, JSON.stringify(res.counts));
  assert.ok(!res.counts.lap, 'no lap chimes');
  await phone.page.waitForFunction(() => /forma \d:\d\d$/i.test(document.getElementById('resTime').textContent), null, { timeout: 8000 });
  await tv.evaluate(() => window.__game.next('podium'));
  await tvIs('podium', 8000);
  await tv.waitForFunction(() => /forma/i.test(document.querySelector('.podscr .nameplate span')?.textContent || ''), null, { timeout: 5000 });

  // ---------- then a normal race on the same page: none of it ----------
  await tv.evaluate(() => window.__game.next('lobby'));
  await tvIs('lobby', 8000);
  await padIs('lobby');
  await sleep(300);
  await tap('.seg[data-key="mode"] button[data-v="race"]');
  await tap('.seg[data-key="laps"] button[data-v="2"]');
  await tv.waitForFunction(() => window.__game.flowApi.opts.mode === 'race' && window.__game.flowApi.opts.laps === 2, null, { timeout: 5000 });
  await toTheRoad();
  await sleep(400);
  const normal = await tv.evaluate(() => {
    const g = window.__game, s = g.state, q = (c) => document.querySelector(`.hudscr ${c}`);
    return { forma: s.forma, laps: s.laps, where: !!q('.fo-where'), hv: q('.hv').classList.contains('forma'), lap: q('.lap b').textContent, wheel: g.renderer.scene.children.some((c) => c.renderOrder === 6 && c.visible), counts: Object.keys(g.counts).filter((k) => k.startsWith('forma')) };
  });
  assert.equal(normal.forma, undefined);
  assert.equal(normal.laps, 2);
  assert.equal(normal.where, false);
  assert.equal(normal.hv, false);
  assert.match(normal.lap, /1\/2/);
  assert.equal(normal.wheel, false);
  assert.deepEqual(normal.counts, []);
  await phone.page.waitForFunction(() => document.getElementById('formaTag').classList.contains('hide') && /\d\/2/.test(document.getElementById('lap').textContent), null, { timeout: 8000 });
  assert.deepEqual(errors, []);
});

test('a long track, by the keyboard alone: the tools\' way in, the clock not the kilometres', { skip: !hasBrowser && 'no browser', timeout: 240000 }, async (t) => {
  const dist = mkdtempSync(join(tmpdir(), 'rk-forma-long-'));
  await buildDist(dist);
  const srv = await startServerProcess({ dist });
  const browser = await launch('metal');
  t.after(async () => { await browser.close(); await srv.close(); rmSync(dist, { recursive: true, force: true }); });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'en-US' });
  const tv = await ctx.newPage();
  const errors = [];
  tv.on('pageerror', (e) => errors.push(e.message));
  await tv.goto(`${srv.base}/?lang=en&track=batur&mode=forma&formaT=20&flyover=0&countdown=1&bots=7&players=1&kart=jeep`);
  await tv.waitForFunction(() => window.__game?.ready || window.__game?.error, null, { timeout: 180000 });
  assert.equal(await tv.evaluate(() => window.__game.error), null);
  await tv.waitForFunction(() => window.__game.state?.phase === 'race', null, { timeout: 30000 });
  const hud = await tv.evaluate(() => ({ lap: document.querySelector('.hudscr .lap small').textContent, where: document.querySelector('.hudscr .fo-where b')?.textContent, long: window.__game.renderer.world.track.long != null }));
  assert.equal(hud.lap, 'Time');
  assert.ok(hud.where);
  await tv.keyboard.down('KeyW');
  await tv.evaluate(() => { const g = window.__game; g.setScript((i) => g.drive(i)); g.speed = 4; });
  await tv.waitForFunction(() => window.__game.phase === 'results' || window.__game.error, null, { timeout: 120000 });
  await tv.keyboard.up('KeyW');
  const end = await tv.evaluate(() => ({ err: window.__game.error, title: document.querySelector('.results h1').textContent, rows: window.__game.results.length, grabs: window.__game.counts.formaGrab, km: document.querySelector('.hudscr .lap small').textContent }));
  assert.equal(end.err, null);
  assert.equal(end.title, 'Cheese Chase');
  assert.equal(end.rows, 8);
  assert.ok(end.grabs >= 1);
  assert.equal(end.km, 'Time', 'never the kilometres to go');
  assert.deepEqual(errors, []);
});
