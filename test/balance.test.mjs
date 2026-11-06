// Balance rules that must hold whatever the numbers become. The numbers themselves: docs/progress/balance.md, tool docs/progress/gioco-exp/bal.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack } from '../src/world/track.js';
import { buildTerrain } from '../src/world/terrain.js';
import { loadTrackDef } from '../src/data/tracks.js';
import { createRace } from '../src/sim/index.js';
import { AUTO_HOME, BOOST, DIFFICULTY, kartPhysics } from '../src/sim/tuning.js';
import { ITEMS, BOX_RESPAWN, rollItem } from '../src/data/items.js';
import { KART_IDS } from '../src/data/karts.js';
import { hudOf } from '../src/game/flow.js';

const worlds = {};
async function world(id) {
  if (worlds[id]) return worlds[id];
  const track = buildTrack(await loadTrackDef(id));
  return (worlds[id] = { track, terrain: buildTerrain(track) });
}
const racers = (n, humans = 1) => Array.from({ length: n }, (_, i) => (i < humans ? { slot: i, kart: 'tabia', human: true, name: 'a', difficulty: 'ace' } : { slot: -1, kart: KART_IDS[i % KART_IDS.length], human: false }));
const forward = { steer: 0, throttle: 0, item: false, drift: false };
const press = (throttle = 0) => ({ steer: 0, throttle, item: true, drift: false });

// A human slot that follows a long shortcut with the bot's brain, from the mouth of the shortcut to its end.
for (const [id, index] of [['jakarta', 0], ['batur', 1], ['cortina', 0], ['bucarest', 0]]) {
  test(`${id}: driving the shortcut that runs far from the main road brings no stork`, async () => {
    const W = await world(id), sc = W.track.shortcuts[index];
    let furthest = 0, rescues = 0, on = 0;
    for (let tries = 0; tries < 8 && on < 60; tries++) {
      const r = createRace({ track: W.track, terrain: W.terrain, seed: 40 + tries, laps: 1, players: racers(1), difficulty: 'medium', countdown: 0, timeTrial: true });
      const K = r.state.karts[0];
      r.teleport(0, sc.from - 60 / W.track.length, 0, { speed: 28, lap: 0 });
      for (let f = 0; f < 60 * 40 && !K.finished; f++) {
        r.step([r.autopilot(0)]);
        if (K.shortcut === sc.index) { on++; furthest = Math.max(furthest, Math.abs(K.d)); }
        for (const e of r.drainEvents()) if (e.type === 'rescue') rescues++;
      }
    }
    assert.ok(on > 60, `the kart must really drive the shortcut, frames on it ${on}`);
    assert.ok(furthest > 70, `it must get far from the main road, got ${furthest.toFixed(0)} m`);
    assert.equal(rescues, 0);
  });
}

function durianRun(W, seed, lob) {
  const r = createRace({ track: W.track, terrain: W.terrain, seed, laps: 9, players: racers(2), difficulty: 'medium', countdown: 0 });
  const K = r.state.karts;
  r.teleport(0, 0.1, 0, { speed: 28, lap: 2 }); r.teleport(1, 0.1 - 40 / W.track.length, 3, { speed: 0, lap: 2 });
  r.give(0, 'durian');
  let stink = 0, spill = null;
  for (let f = 0; f < 60 * 7; f++) {
    const a = r.autopilot(0);
    r.step([f === 2 ? { ...a, item: true, throttle: lob ? 1 : 0 } : { ...a, item: false }]);
    r.drainEvents();
    spill ||= r.state.spills.find((s) => s.kind === 'durian');
    K[1].vx = 0; K[1].vz = 0;
    if (K[0].stinkT > 0) stink++;
  }
  return { stink, spill };
}

test('a lobbed durian never stinks its own thrower, who drives through it', async () => {
  const W = await world('antelao');
  for (let s = 0; s < 6; s++) {
    const m = durianRun(W, 200 + s, true);
    assert.ok(m.spill, 'it landed');
    assert.equal(m.stink, 0, `seed ${200 + s}`);
  }
});

test('a rival driving into a lobbed durian does stink', async () => {
  const W = await world('antelao');
  const r = createRace({ track: W.track, terrain: W.terrain, seed: 7, laps: 9, players: racers(2), difficulty: 'medium', countdown: 0 });
  r.teleport(0, 0.1, 0, { speed: 25, lap: 2 }); r.teleport(1, 0.1 + 200 / W.track.length, 0, { speed: 25, lap: 3 });
  r.give(0, 'durian');
  r.step([press(1), r.autopilot(1)]);
  r.teleport(1, 0.1 + 20 / W.track.length, 0, { speed: 26, lap: 2 });
  let stunk = false;
  for (let f = 0; f < 60 * 5 && !stunk; f++) { r.step([{ ...forward, throttle: -0.3 }, r.autopilot(1)]); r.drainEvents(); stunk = r.state.karts[1].stinkT > 0; }
  assert.ok(stunk, 'the kart behind the thrower meets the cloud');
});

for (const item of ['polenta', 'durian', 'formaggio']) {
  test(`${item} from last with nobody behind goes forward; with a rival close behind it goes behind`, async () => {
    const W = await world('antelao');
    const go = (behind) => {
      const r = createRace({ track: W.track, terrain: W.terrain, seed: 11, laps: 9, players: racers(3), difficulty: 'medium', countdown: 0 });
      r.teleport(0, 0.2, 0, { speed: 26, lap: 2 });
      r.teleport(1, 0.2 + 60 / W.track.length, 0, { speed: 26, lap: 2 });
      r.teleport(2, behind ? 0.2 - 25 / W.track.length : 0.2 + 90 / W.track.length, 0, { speed: 26, lap: 2 });
      r.give(0, item);
      const k = r.state.karts[0], u = k.progress;
      r.step([press(0)]);
      const shot = r.state.shots.at(-1), spill = r.state.spills.at(-1);
      return { lob: !!shot?.lob, dir: shot?.dir, behindSpill: !!spill && spill.kind === item, u };
    };
    const last = go(false), near = go(true);
    if (item === 'formaggio') { assert.equal(last.dir, 1); assert.equal(near.dir, -1); } else { assert.equal(last.lob, true); assert.equal(near.lob, false); assert.equal(near.behindSpill, true); }
  });
}

test('a behind item from last lands in front of the kart ahead, even far ahead', async () => {
  const W = await world('antelao');
  const r = createRace({ track: W.track, terrain: W.terrain, seed: 11, laps: 9, players: racers(2), difficulty: 'medium', countdown: 0 });
  const gap = 120;
  r.teleport(0, 0.2, 0, { speed: 26, lap: 2 }); r.teleport(1, 0.2 + gap / W.track.length, 0, { speed: 26, lap: 2 });
  r.give(0, 'polenta');
  const p0 = r.internals.priv[0].f;
  r.step([press(0), r.autopilot(1)]);
  const shot = r.state.shots.find((s) => s.lob);
  const along = ((shot.f - p0) % W.track.n + W.track.n) % W.track.n * W.track.step;
  assert.ok(along > gap, `lands ${along.toFixed(0)} m ahead, the kart ahead is ${gap} m ahead`);
});

test('razzo from first: the leader is untouchable for 3 s, and from second it gives neither', async () => {
  const W = await world('antelao');
  const r = createRace({ track: W.track, terrain: W.terrain, seed: 5, laps: 9, players: racers(2), difficulty: 'medium', countdown: 0 });
  r.teleport(0, 0.2, 0, { speed: 26, lap: 2 }); r.teleport(1, 0.2 - 40 / W.track.length, 0, { speed: 26, lap: 2 });
  r.give(0, 'razzo'); r.give(1, 'razzo');
  r.step([press(), { ...forward }]);
  assert.ok(r.state.karts[0].safeT > 2.9);
  assert.ok(r.state.karts[0].boostT > 0);
  r.step([forward, press()]);
  assert.ok(r.state.karts[1].safeT <= 0);
});

test('rendang from first takes a crate within 60 m and not one further off', async () => {
  const W = await world('antelao'), T = W.track, band = T.bands[1];
  const go = (m) => {
    const r = createRace({ track: T, terrain: W.terrain, seed: 5, laps: 9, players: racers(1), difficulty: 'medium', countdown: 0 });
    r.teleport(0, band.u - m / T.length, 0, { speed: 0, lap: 2 });
    r.give(0, 'rendang');
    r.step([press()]);
    let took = false;
    for (let f = 0; f < 10; f++) { r.step([{ ...forward, throttle: -1 }]); took = took || r.state.karts[0].rouletteT > 0 || !!r.state.karts[0].item; }
    return took;
  };
  assert.equal(go(50), true);
  assert.equal(go(100), false);
});

test('the leader\'s frana never hits the leader, and hits the second', async () => {
  const W = await world('antelao');
  const r = createRace({ track: W.track, terrain: W.terrain, seed: 21, laps: 9, players: racers(2), difficulty: 'medium', countdown: 0 });
  r.teleport(0, 0.2, 0, { speed: 26, lap: 2 }); r.teleport(1, 0.2 - 8 / W.track.length, 0, { speed: 26, lap: 2 });
  r.give(0, 'frana');
  r.step([press(), forward]);
  const rocks = r.state.spills.filter((s) => s.kind === 'frana');
  assert.ok(rocks.length > 0 && rocks.every((s) => s.fromLead));
  const K = r.state.karts;
  for (const s of rocks) s.t = s.warn;
  const rock = rocks[0];
  K[0].x = rock.x; K[0].z = rock.z; K[0].y = rock.y;
  r.step([forward, forward]);
  assert.equal(K[0].hitT, 0, 'the thrower drives through');
  K[1].x = rock.x; K[1].z = rock.z; K[1].y = rock.y; K[1].safeT = 0;
  r.step([forward, forward]);
  assert.ok(K[1].hitT > 0, 'the second is hit');
});

test('frana and rendang skip a kart that has finished: the first still racing is the leader', async () => {
  const W = await world('antelao'), T = W.track;
  const r = createRace({ track: T, terrain: W.terrain, seed: 22, laps: 1, players: racers(3, 3), difficulty: 'medium', countdown: 0 });
  const K = r.state.karts, R = r.internals;
  r.teleport(1, 0.4, 0, { speed: 26, lap: 0 }); r.teleport(2, 0.3, 0, { speed: 26, lap: 0 }); r.teleport(0, 0.1, 0, { speed: 26, lap: 0 });
  R.finishKart(K[1]);
  r.step([forward, forward, forward]);
  r.give(2, 'frana');
  r.step([forward, forward, press()]);
  const rock = r.state.spills.find((s) => s.kind === 'frana');
  const fromFirstRacing = ((rock.i - R.priv[2].i) % T.n + T.n) % T.n * T.step;
  assert.ok(rock.fromLead, 'kart 2 is the first still racing');
  assert.ok(fromFirstRacing > T.length / 2, 'the rocks fall on the kart still racing behind it, not in front of it');
  r.step([forward, forward, forward]);
  r.give(2, 'rendang');
  r.step([forward, forward, press()]);
  assert.ok(R.priv[1].slowT <= 0, 'the pot does not pull at the finished kart');
  assert.equal(r.state.shots.find((s) => s.kind === 'rendang')?.target ?? -1, -1);
  assert.ok(r.state.karts[2].rendangT > 0 || r.state.karts[2].rouletteT > 0, 'it works as a leader\'s pot: still smelling, or a crate already taken');
});

test('a slow person: the autopilot takes the kart home after the limit, with an event and a HUD flag, and only then', async () => {
  const W = await world('antelao');
  const r = createRace({ track: W.track, terrain: W.terrain, seed: 31, laps: 1, players: racers(4), difficulty: 'medium', countdown: 0 });
  const K = r.state.karts[0];
  let leader = null, at = null, phase;
  for (let f = 0; f < 60 * 600 && r.state.phase !== 'done'; f++) {
    r.step([{ ...forward, throttle: -1 }]);
    for (const e of r.drainEvents()) {
      if (e.type === 'finish' && leader === null) leader = r.state.t;
      if (e.type === 'autoHome') { assert.equal(e.kart, 0); at = r.state.t; assert.equal(hudOf(K, 1).auto, true); }
    }
    if (at === null) assert.equal(hudOf(K, 1).auto, undefined);
    phase = r.state.phase;
  }
  assert.ok(at !== null, 'it fired');
  assert.ok(at - leader <= AUTO_HOME.afterLeader + 0.1 && at - leader > 1, `${at - leader} s after the leader`);
  assert.equal(K.finished, true, 'home');
  assert.equal(phase, 'done');
});

test('a person who gets home in time never sees the autopilot; time trial and the hunt have none', async () => {
  const W = await world('antelao');
  const r = createRace({ track: W.track, terrain: W.terrain, seed: 32, laps: 1, players: racers(4), difficulty: 'easy', countdown: 0 });
  let n = 0;
  for (let f = 0; f < 60 * 300 && r.state.phase !== 'done'; f++) { r.step([r.autopilot(0)]); for (const e of r.drainEvents()) if (e.type === 'autoHome') n++; }
  assert.equal(n, 0);
  assert.equal(r.state.karts[0].finished, true);
  const tt = createRace({ track: W.track, terrain: W.terrain, seed: 33, laps: 1, players: racers(1), difficulty: 'medium', countdown: 0, timeTrial: true });
  for (let f = 0; f < 60 * 200; f++) { tt.step([{ ...forward, throttle: -1 }]); for (const e of tt.drainEvents()) assert.notEqual(e.type, 'autoHome'); }
});

test('a bot with an empty slot moves over for a crate, one with an item does not', async () => {
  const W = await world('antelao'), T = W.track, band = T.bands[1];
  const go = (item) => {
    const r = createRace({ track: T, terrain: W.terrain, seed: 41, laps: 9, players: [{ slot: -1, kart: 'tabia', human: false }], difficulty: 'hard', countdown: 0 });
    const R = r.internals, k = r.state.karts[0], B = R.priv[0].bot;
    B.cfg = { ...B.cfg, mistakeAmp: 0, avoid: 0, crate: 1 };
    r.teleport(0, band.u - 38 / T.length, 0, { speed: 26, lap: 2 });
    // only the crate furthest from the line stays up
    const line = T.racingLine.d[band.i];
    const mine = r.state.boxes.filter((b) => b.band === band.band).map((b) => ({ b, d: (b.x - T.samples.x[band.i]) * T.samples.nx[band.i] + (b.z - T.samples.z[band.i]) * T.samples.nz[band.i] }));
    const far = mine.reduce((a, c) => (Math.abs(c.d - line) > Math.abs(a.d - line) ? c : a));
    for (const m of mine) if (m !== far) m.b.up = false;
    if (item) r.give(0, 'mici');
    for (let f = 0; f < 60; f++) { r.step([]); r.drainEvents(); if (((band.i - R.priv[0].i) % T.n + T.n) % T.n * T.step < 4) break; }
    return Math.abs(k.d - far.d);
  };
  const seeking = go(false), full = go(true);
  assert.ok(seeking < full, `with an empty slot ${seeking.toFixed(1)} m from the crate, with an item ${full.toFixed(1)} m`);
});

test('each item keeps what makes it itself, and the roll stays uniform', () => {
  assert.equal(ITEMS.find((i) => i.id === 'uova').bigT, 5);
  for (const b of ['grappa', 'sambal', 'zuica']) assert.ok(BOOST[b].mul >= 1.3);
  assert.ok(BOOST.uova.mul > 1 && BOOST.uova.t > 0);
  const count = {};
  for (let i = 0; i < 1100; i++) { const id = rollItem(i / 1100); count[id] = (count[id] || 0) + 1; }
  for (const it of ITEMS) assert.equal(count[it.id], 100);
  assert.ok(BOX_RESPAWN > 0);
});

test('karts: stats narrow, still each kart its own', () => {
  const top = (id) => kartPhysics(id).top;
  assert.ok(top('mocanita') > top('tabia') && top('tabia') > top('becak'));
  assert.ok(top('mocanita') - top('becak') < 1.2);
  assert.ok(kartPhysics('gatto').keep > kartPhysics('seggiovia').keep);
  assert.ok(kartPhysics('seggiovia').yawFast > kartPhysics('gatto').yawFast);
  assert.ok(DIFFICULTY.easy.cap < DIFFICULTY.medium.cap && DIFFICULTY.medium.cap < DIFFICULTY.hard.cap);
});
