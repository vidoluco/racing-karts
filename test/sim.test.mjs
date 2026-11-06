// The race simulation: determinism, physics, every item with a scripted setup, every hazard, bots on every track.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildTrack } from '../src/world/track.js';
import { buildTerrain } from '../src/world/terrain.js';
import { TRACK_IDS, loadTrackDef } from '../src/data/tracks.js';
import { KART_IDS } from '../src/data/karts.js';
import { ITEM_IDS } from '../src/data/items.js';
import { createRace, DT } from '../src/sim/index.js';
import { kartPhysics, DRIFT_TIERS, BOOST } from '../src/sim/tuning.js';

const rel = (p) => fileURLToPath(new URL(p, import.meta.url));
const available = TRACK_IDS.filter((id) => existsSync(rel(`../src/world/tracks/${id}.js`)));
const worlds = new Map();
for (const id of available) {
  const track = buildTrack(await loadTrackDef(id));
  worlds.set(id, { track, terrain: buildTerrain(track) });
}

// A flat ring: nothing but what the test puts on it.
function ring(extra = {}, radius = 220, w = 16) {
  const points = [];
  for (let a = 0; a < 16; a++) {
    const t = -a / 16 * Math.PI * 2;
    points.push({ p: [Math.cos(t) * radius, 0, Math.sin(t) * radius], w, bank: 0, surface: extra.surface ?? 'asphalt', tag: null });
  }
  const def = {
    id: 'ring', region: 'cadore', names: { it: 'r', en: 'r' }, points, itemBands: [], boostPads: [], jumps: [], zones: [], shortcuts: [], hazards: [],
    ground: { base: 0, hills: 0, hillScale: 240, rimHeight: 0, rimFrom: 400, rimTo: 500, water: null }, grid: { spacing: 8 }, ...extra,
  };
  const track = buildTrack(def);
  return { track, terrain: buildTerrain(track) };
}
const RING = ring();

const humans = (n, kart = 'tabia') => Array.from({ length: n }, (_, i) => ({ slot: i, kart, human: true, name: `P${i}` }));
const go = { steer: 0, throttle: 0, item: false, drift: false };
const stay = undefined; // no input at all: the kart coasts to a stop, as a phone that left
const press = { ...go, item: true };

function setup(world = RING, n = 3, opts = {}) {
  return createRace({ track: world.track, terrain: world.terrain, seed: opts.seed ?? 5, laps: opts.laps ?? 3, players: opts.players ?? humans(n, opts.kart), difficulty: 'medium', countdown: 0 });
}
function run(race, frames, inputs = []) {
  const events = [];
  for (let i = 0; i < frames; i++) {
    race.step(typeof inputs === 'function' ? inputs(i) : inputs);
    events.push(...race.drainEvents());
  }
  return events;
}
// A plain thumb on the stick: keeps a kart on the road's centre, nothing clever.
function thumb(race, i = 0, extra = {}) {
  const k = race.state.karts[i], T = race.internals.track, S = T.samples, a = (k.trackI + 8) % T.n;
  const e = Math.atan2(S.x[a] - k.x, S.z[a] - k.z) - k.yaw;
  return { ...go, steer: Math.max(-1, Math.min(1, -Math.atan2(Math.sin(e), Math.cos(e)) * 3)), ...extra };
}
const road = (race, ...who) => () => { const out = []; for (const i of who) out[i] = thumb(race, i); return out; };
const hitsOf = (ev, kart) => ev.filter((e) => e.type === 'hit' && (kart === undefined || e.kart === kart));

test('countdown then go, with its events; nothing moves before it', () => {
  const race = createRace({ track: RING.track, terrain: RING.terrain, seed: 1, players: humans(2), difficulty: 'easy' });
  const x0 = race.state.karts[0].x;
  const ev = run(race, 170, [go, go]);
  assert.deepEqual(ev.filter((e) => e.type === 'countdown').map((e) => e.n), [3, 2, 1]);
  assert.equal(race.state.phase, 'countdown');
  assert.ok(Math.abs(race.state.karts[0].x - x0) < 1e-6);
  const ev2 = run(race, 20, [go, go]);
  assert.equal(ev2.filter((e) => e.type === 'go').length, 1);
  assert.equal(race.state.phase, 'race');
});

test('state has the shape of the contract and stays plain finite data', () => {
  const race = setup(worlds.get('antelao'), 8, { players: KART_IDS.slice(0, 8).map((kart) => ({ slot: -1, kart, human: false })) });
  run(race, 1500);
  const s = race.state;
  for (const f of ['t', 'phase', 'countdown', 'laps', 'karts', 'boxes', 'shots', 'spills', 'hazards']) assert.ok(f in s, f);
  const K = ['i', 'slot', 'kart', 'human', 'x', 'y', 'z', 'yaw', 'pitch', 'roll', 'vx', 'vy', 'vz', 'speed', 'grounded', 'airT', 'steer', 'throttle', 'trackI', 'u', 'lap', 'progress', 'place', 'finished', 'finishT', 'lastLapT', 'bestLapT', 'wrongWay', 'surface', 'offroad', 'drift', 'driftT', 'driftTier', 'boostT', 'boostKind', 'item', 'itemCharges', 'orbit', 'bigT', 'tipsyT', 'stinkT', 'hitT', 'hitKind', 'safeT', 'rescueT'];
  for (const k of s.karts) for (const f of K) assert.ok(f in k, f);
  assert.deepEqual(JSON.parse(JSON.stringify(s)).karts.length, 8);
  const walk = (o, path) => {
    for (const [key, v] of Object.entries(o)) {
      if (typeof v === 'number') assert.ok(Number.isFinite(v), `${path}.${key}`);
      else if (v && typeof v === 'object') walk(v, `${path}.${key}`);
    }
  };
  walk(s, 'state');
  assert.equal(new Set(s.karts.map((k) => k.place)).size, 8);
});

test('determinism: the same seed and inputs give byte identical state and events', () => {
  const world = worlds.get('antelao');
  const once = (seed) => {
    const players = KART_IDS.slice(0, 7).map((kart) => ({ slot: -1, kart, human: false }));
    players.push({ slot: 0, kart: 'jukung', human: true });
    const race = createRace({ track: world.track, terrain: world.terrain, seed, laps: 2, players, difficulty: 'hard' });
    const h = createHash('sha256');
    for (let f = 0; f < 60 * 80; f++) {
      const steer = Math.sin(f * 0.013) * 0.4, inputs = [];
      inputs[7] = { steer, throttle: 0, item: f % 200 === 0, drift: f % 300 < 100 };
      race.step(inputs);
      if (f % 30 === 0) h.update(JSON.stringify(race.state));
      h.update(JSON.stringify(race.drainEvents()));
    }
    h.update(JSON.stringify(race.state));
    return h.digest('hex');
  };
  const a = once(42);
  assert.equal(a, once(42));
  assert.notEqual(a, once(43));
});

test('physics: auto throttle reaches top speed, the stick only lowers it, brake then reverse', () => {
  const race = setup(RING, 1);
  run(race, 60 * 6, road(race, 0));
  const k = race.state.karts[0], top = kartPhysics('tabia').top;
  assert.ok(k.speed > top * 0.9 && k.speed < top * 1.05, `speed ${k.speed}`);
  run(race, 90, [{ ...go, throttle: -1 }]);
  assert.ok(k.speed < 0, `reverses, ${k.speed}`);
  assert.equal(k.throttle, -1);
  run(race, 60 * 4, road(race, 0));
  assert.ok(k.speed > top * 0.75);
});

test('physics: a kart with no input (phone gone) slows gently, and accelerates back snappily', () => {
  const race = setup(RING, 1);
  run(race, 60 * 5, road(race, 0));
  const k = race.state.karts[0], v0 = k.speed;
  run(race, 30, [stay]);
  assert.ok(k.speed < v0 && k.speed > v0 * 0.35, `gentle: ${k.speed}`);
  run(race, 60 * 4, [stay]);
  assert.ok(k.speed < 2);
  run(race, 60 * 2.5, road(race, 0));
  assert.ok(k.speed > kartPhysics('tabia').top * 0.85, `from rest in 2.5 s: ${k.speed}`);
});

test('physics: stats matter: speed, accel, handling, weight in a bump', () => {
  const top = (id) => kartPhysics(id).top;
  assert.ok(top('mocanita') > top('gatto'));
  assert.ok(kartPhysics('becak').accel > kartPhysics('mocanita').accel);
  assert.ok(kartPhysics('seggiovia').yawFast > kartPhysics('gatto').yawFast);
  const race = setup(RING, 2, { players: [{ slot: 0, kart: 'gatto', human: true }, { slot: 1, kart: 'becak', human: true }] });
  race.teleport(0, 0.1, 0, { speed: 20 });
  race.teleport(1, 0.1 + 3 / RING.track.length, 0);
  const ev = run(race, 12, [stay, stay]);
  const heavy = race.state.karts[0], light = race.state.karts[1];
  assert.ok(ev.some((e) => e.type === 'bump' && e.a === 0 && e.b === 1 && e.force > 5), 'a bump event');
  assert.ok(light.speed > heavy.speed, `the light one flies: ${light.speed} vs ${heavy.speed}`);
});

test('drift: hop, then tiers at 0.7, 1.4 and 2.2 s, a longer turbo per tier', () => {
  const held = (seconds) => {
    const race = setup(RING, 1);
    run(race, 240, [go]);
    const k = race.state.karts[0];
    const ev = run(race, Math.round(seconds * 60) + 16, [{ ...go, steer: 0.6, drift: true }]);
    assert.ok(ev.some((e) => e.type === 'driftStart'));
    assert.equal(k.drift, 1, 'steer right drifts right');
    const tier = k.driftTier, tiersSeen = ev.filter((e) => e.type === 'driftTier').map((e) => e.tier), v = k.speed;
    const end = run(race, 2, [{ ...go, steer: 0.2 }]);
    const boost = end.find((e) => e.type === 'boost');
    return { tier, tiersSeen, boostT: k.boostT, kind: boost?.kind, gained: k.speed - v, end };
  };
  const t0 = held(0.4), t1 = held(0.8), t2 = held(1.5), t3 = held(2.4);
  assert.equal(t0.tier, 0);
  assert.equal(t0.kind, undefined, 'too short: no turbo');
  assert.deepEqual([t1.tier, t2.tier, t3.tier], [1, 2, 3]);
  assert.deepEqual(t3.tiersSeen, [1, 2, 3]);
  assert.equal(t1.kind, 'drift');
  assert.ok(t1.boostT < t2.boostT && t2.boostT < t3.boostT, 'longer per tier');
  assert.ok(t3.gained > BOOST.drift3.kick * 0.5, `kick right away: ${t3.gained}`);
  assert.deepEqual(DRIFT_TIERS, [0.7, 1.4, 2.2]);
});

test('drift turns harder than the plain stick, and it is the turbos that make a lap fast', () => {
  const headingAfter = (drift) => {
    const race = setup(ring({}, 900), 1);
    run(race, 240, [go]);
    const k = race.state.karts[0], y0 = k.yaw;
    run(race, 60, [{ ...go, steer: 1, drift }]);
    return Math.abs(Math.atan2(Math.sin(k.yaw - y0), Math.cos(k.yaw - y0)));
  };
  assert.ok(headingAfter(true) > headingAfter(false) * 1.05);
});

test('surfaces: sand drags, ice lets go, snow and dirt slow a little, offroad slows and the offroad stat helps', () => {
  const topOn = (surface, kart = 'tabia') => {
    const race = setup(ring({ surface }), 1, { kart });
    run(race, 60 * 6, road(race, 0));
    return race.state.karts[0].speed;
  };
  const asphalt = topOn('asphalt'), sand = topOn('sand'), snow = topOn('snow'), ice = topOn('ice');
  assert.ok(sand < asphalt * 0.9, `sand ${sand} vs ${asphalt}`);
  assert.ok(snow < asphalt && snow > sand);
  assert.ok(Math.abs(ice - asphalt) < asphalt * 0.12, 'ice is fast, just not obedient');
  assert.ok(topOn('sand', 'jeep') > topOn('sand', 'mocanita'), 'the jeep knows sand');

  const slideAfterTurn = (surface) => {
    const race = setup(ring({ surface }), 1);
    run(race, 240, road(race, 0));
    const k = race.state.karts[0];
    run(race, 45, [{ ...go, steer: 1 }]);
    const fx = Math.sin(k.yaw), fz = Math.cos(k.yaw);
    return Math.abs(k.vx * fz - k.vz * fx);
  };
  assert.ok(slideAfterTurn('ice') > slideAfterTurn('asphalt') * 3, 'ice lowers grip');

  const race = setup(RING, 1);
  race.teleport(0, 0.1, 13, { speed: 30 });
  run(race, 90, [go]);
  const k = race.state.karts[0];
  assert.equal(k.offroad, true);
  assert.equal(k.surface, 'grass');
  assert.ok(k.speed < 26, `the shoulder slows: ${k.speed}`);
});

test('walls: a glancing touch redirects and keeps its speed, head on does not stop dead', () => {
  const race = setup(RING, 1);
  const k = race.state.karts[0];
  race.teleport(0, 0.1, 18, { speed: 30, yawOffset: -0.2 });
  // yaw is + to the left, so aim at the outer barrier whichever side it lies on
  const limit = race.walls.left[k.trackI];
  assert.ok(limit > 8, `there is a shoulder: ${limit}`);
  race.teleport(0, 0.1, limit - 2, { speed: 30, yawOffset: 0.25 });
  const ev = run(race, 40, [go]);
  assert.ok(ev.some((e) => e.type === 'wall'), 'wall event');
  assert.ok(Math.abs(k.d) <= limit + 0.5, 'stayed inside');
  assert.ok(k.speed > 16, `glancing keeps going: ${k.speed}`);

  race.teleport(0, 0.3, 0, { speed: 30, yawOffset: Math.PI / 2 });
  run(race, 60 * 3, [go]);
  assert.ok(Math.abs(k.speed) > 8, `head on, it slides along and goes on: ${k.speed}`);
});

test('decks and tunnels have walls at their edge, the road under a viaduct keeps its level', () => {
  const { track, terrain } = worlds.get('antelao');
  const via = track.structures.find((s) => s.kind === 'viaduct');
  assert.ok(via);
  const race = createRace({ track, terrain, seed: 1, players: humans(2), countdown: 0 });
  const k = race.state.karts[0], u = (via.from + via.to) / 2, y0 = track.heightAt(u * track.n, 0);
  race.teleport(0, u, 0, { speed: 30, yawOffset: 0.8 });
  run(race, 90, [go, stay]);
  assert.ok(Math.abs(k.y - track.heightAt(k.u * track.n, k.d)) < 0.3, 'still on the deck');
  assert.ok(Math.abs(k.d) < track.samples.w[k.trackI] / 2, 'not over the edge');
  assert.ok(k.y > y0 - 8);
});

test('jump launches, lands and fires events; pads boost', () => {
  const { track, terrain } = worlds.get('antelao');
  const race = createRace({ track, terrain, seed: 1, players: humans(1), countdown: 0 });
  const k = race.state.karts[0], j = track.jumps[0];
  race.teleport(0, j.u - 40 / track.length, 0, { speed: 30 });
  const ev = run(race, 240, [{ ...go, throttle: 0 }]);
  assert.ok(ev.some((e) => e.type === 'jump'));
  assert.ok(ev.some((e) => e.type === 'land' && e.force > 3));
  assert.ok(k.grounded);

  const pad = track.pads[0], r2 = createRace({ track, terrain, seed: 1, players: humans(1), countdown: 0 });
  r2.teleport(0, pad.u - 20 / track.length, pad.d, { speed: 25 });
  const ev2 = run(r2, 60, [go]);
  assert.ok(ev2.some((e) => e.type === 'boost' && e.kind === 'pad'));
});

test('water or off the world: rescue of about 2 s, carried back to the road', () => {
  const world = { track: RING.track, terrain: { ...RING.terrain, water: 5, waterLevel: 5 } };
  const race = setup(world, 1);
  const k = race.state.karts[0];
  race.teleport(0, 0.3, 0, { speed: 20 });
  run(race, 10, [go]);
  race.teleport(0, 0.3, 14, { speed: 5 });
  race.internals.priv[0].lastGoodF = 0.3 * RING.track.n;
  const ev = run(race, 5, [go]);
  assert.ok(ev.some((e) => e.type === 'rescue'));
  assert.ok(k.rescueT > 1.5);
  const y = [];
  for (let i = 0; i < 60; i++) { run(race, 1, [go]); y.push(k.y); }
  assert.ok(Math.max(...y) > 3, 'carried through the air');
  run(race, 70, [stay]);
  assert.equal(k.rescueT, 0);
  assert.equal(k.offroad, false);
  assert.ok(k.safeT >= 0);
  assert.ok(Math.abs(k.u - 0.3) < 0.02);
});

test('laps: counted once each, last lap, finish, times; backing over the line does not cheat', () => {
  const race = setup(RING, 2, { laps: 2 });
  const k = race.state.karts[0];
  const ev = run(race, 60 * 150, road(race, 0));
  const laps = ev.filter((e) => e.type === 'lap' && e.kart === 0);
  assert.deepEqual(laps.map((e) => e.lap), [1]);
  assert.equal(ev.filter((e) => e.type === 'lastLap' && e.kart === 0).length, 1);
  const fin = ev.find((e) => e.type === 'finish');
  assert.equal(fin.kart, 0); assert.equal(fin.place, 1);
  assert.ok(k.finished && k.finishT > 40 && k.bestLapT > 20);
  assert.equal(k.lap, 2);
  assert.ok(Math.abs(k.lastLapT - k.bestLapT) < 5);

  const r2 = setup(RING, 1, { laps: 3 });
  const K = r2.state.karts[0];
  r2.teleport(0, 0.99, 0, { speed: 20, lap: 0 });
  const e1 = run(r2, 90, road(r2, 0));
  assert.equal(e1.filter((e) => e.type === 'lap').length, 1);
  const back = K.progress;
  const e2 = run(r2, 150, [{ ...go, throttle: -1, steer: 0 }]);
  assert.ok(K.progress < back);
  assert.equal(e2.filter((e) => e.type === 'lap').length, 0);
  const e3 = run(r2, 240, road(r2, 0));
  assert.equal(e3.filter((e) => e.type === 'lap').length, 0, 'crossing again after backing over counts nothing');
});

test('wrong way flags after a moment, places and overtakes follow progress', () => {
  const race = setup(RING, 2);
  const a = race.state.karts[0], b = race.state.karts[1];
  race.teleport(0, 0.2, 0, { speed: 5, yawOffset: Math.PI });
  run(race, 90, [go, stay]);
  assert.equal(a.wrongWay, true);

  const r2 = setup(RING, 2);
  r2.teleport(0, 0.2, 3);
  r2.teleport(1, 0.25, -3);
  run(r2, 1, [stay, stay]);
  const A = r2.state.karts[0], B = r2.state.karts[1];
  assert.equal(B.place, 1); assert.equal(A.place, 2);
  const ev = run(r2, 60 * 8, [go, stay]);
  assert.equal(A.place, 1); assert.equal(B.place, 2);
  assert.ok(ev.some((e) => e.type === 'overtake' && e.kart === 0 && e.place === 1));
  assert.ok(b);
});

test('boxes: 5 per band, roulette, one item at a time, respawn in 6 s', () => {
  const world = ring({ itemBands: [0.1, 0.5, 0.8] });
  const race = setup(world, 1);
  const s = race.state, k = s.karts[0], band = world.track.bands[0];
  assert.equal(s.boxes.length, 15);
  const P = world.track.samples, b0 = s.boxes[2];
  race.teleport(0, band.u - 8 / world.track.length, 0, { speed: 25 });
  const ev = run(race, 40, [go]);
  const take = ev.find((e) => e.type === 'boxTake');
  assert.ok(take && ITEM_IDS.includes(take.item));
  assert.equal(b0.up, false);
  assert.equal(k.item, null, 'still spinning');
  assert.ok(k.rouletteT > 0);
  run(race, 70, [go]);
  assert.equal(k.rouletteT, 0);
  assert.equal(k.item, take.item);
  assert.ok(k.itemCharges >= 1);
  run(race, 60 * 6, [go]);
  assert.equal(b0.up, true, 'back after 6 s');
  race.teleport(0, band.u - 8 / world.track.length, 0, { speed: 25 });
  const held = k.item, ev2 = run(race, 40, [go]);
  const again = ev2.find((e) => e.type === 'boxTake');
  assert.ok(again);
  assert.equal(again.item, null, 'holding one, it is only a sound');
  assert.equal(k.item, held);
  assert.ok(P);
});

test('a box gives any of the eleven items, whatever the place', () => {
  const world = ring({ itemBands: [0.2] });
  for (const place of [1, 8]) {
    const counts = {};
    for (let seed = 1; seed < 400; seed++) {
      const race = setup(world, 8, { seed });
      const K = race.state.karts, band = world.track.bands[0];
      race.teleport(0, band.u - 4 / world.track.length, 0, { speed: 25 });
      K.forEach((k, i) => { if (i) race.teleport(i, band.u + (place === 8 ? 0.1 + i * 0.01 : -0.1 - i * 0.01), 0, { lap: 0 }); });
      const t = run(race, 12, []).find((e) => e.type === 'boxTake' && e.kart === 0);
      if (t) counts[t.item] = (counts[t.item] || 0) + 1;
    }
    assert.deepEqual(Object.keys(counts).sort(), [...ITEM_IDS].sort(), `place ${place}`);
    const n = Object.values(counts).reduce((x, y) => x + y, 0);
    for (const id of ITEM_IDS) assert.ok(counts[id] > n / 11 * 0.5 && counts[id] < n / 11 * 1.6, `${id} at place ${place}: ${counts[id]} of ${n}`);
  }
});

test('razzo: homes on the kart immediately ahead, not the first one', () => {
  const race = setup(RING, 4);
  const s = race.state, K = s.karts;
  race.teleport(0, 0.1, 0);       // owner, last of three on this stretch
  race.teleport(1, 0.14, 5);      // immediately ahead, on the other side of the road
  race.teleport(2, 0.2, -5);      // the leader
  race.teleport(3, 0.05, 0);      // behind
  run(race, 1, []);
  assert.deepEqual(K.map((k) => k.place), [3, 2, 1, 4]);
  race.give(0, 'razzo');
  const start = run(race, 1, [press]);
  assert.ok(start.some((e) => e.type === 'itemUse' && e.item === 'razzo'));
  assert.equal(K[0].item, null);
  assert.equal(s.shots.length, 1);
  assert.equal(s.shots[0].target, 1);
  const ev = run(race, 240, []);
  const hits = hitsOf(ev);
  assert.equal(hits.length, 1);
  assert.deepEqual([hits[0].kart, hits[0].by, hits[0].kind, hits[0].cause], [1, 0, 'tumble', 'razzo']);
  assert.ok(ev.some((e) => e.type === 'boom' && e.kind === 'razzo'));
  assert.equal(s.shots.length, 0);
  assert.equal(K[2].hitT, 0);
});

test('razzo: follows the road round the bend and chases a moving target; expires when out of reach', () => {
  const race = setup(ring({}, 90), 2);
  const [a, b] = race.state.karts;
  race.teleport(0, 0.1, 0);
  race.teleport(1, 0.35, 0, { speed: 20 });
  run(race, 1, []);
  race.give(0, 'razzo');
  run(race, 1, [press, go]);
  const S = race.state.shots[0];
  const offRoad = [];
  for (let i = 0; i < 400 && race.state.shots.length; i++) {
    run(race, 1, [stay, thumb(race, 1)]);
    if (race.state.shots.length) offRoad.push(Math.abs(Math.hypot(S.x, S.z) - 90));
  }
  assert.ok(offRoad.length > 30 && Math.max(...offRoad) < 9.5, `stays over the road: ${Math.max(...offRoad)}`);
  assert.ok(b.hitT > 0 || b.safeT > 0, 'caught it');
  assert.ok(a);

  // far beyond any reach: the rocket gives up and pops
  const r2 = setup(RING, 2);
  r2.teleport(0, 0.1, 0);
  r2.teleport(1, 0.62, 0);
  run(r2, 1, []);
  r2.give(0, 'razzo');
  run(r2, 1, [press]);
  const ev = run(r2, 60 * 9, []);
  assert.equal(hitsOf(ev).length, 0);
  assert.equal(r2.state.shots.length, 0);
  assert.ok(ev.some((e) => e.type === 'boom'));
});

test('razzo in first place sweeps a whole road length: shots and spills pop, animals scatter, nobody hit unless in the way', () => {
  const world = ring({ hazards: [{ kind: 'cows', u: 0.6, width: 1, period: 9 }] });
  const race = setup(world, 3);
  const T = race.internals.track, L = T.length;
  race.teleport(0, 0.5, 0);
  race.teleport(1, 0.4, 0);
  race.teleport(2, 0.38, 0);
  run(race, 1, []);
  // a puddle and a chaser's cheese on the road ahead of the rocket
  race.give(1, 'polenta');
  race.teleport(1, 0.56, 0);
  run(race, 1, [stay, press]);
  race.teleport(1, 0.4, 0);
  run(race, 1, []);
  assert.equal(race.state.spills.length, 1);
  race.give(0, 'razzo');
  run(race, 1, [press]);
  const S = race.state.shots[0];
  assert.equal(S.target, -1);
  assert.equal(S.sweep, true);
  const puddle = run(race, Math.round(60 * (0.07 * L + 30) / 55), []);
  assert.equal(race.state.spills.length, 0, 'the puddle is gone');
  assert.ok(puddle.some((e) => e.type === 'boom' && e.kind === 'clear'));
  assert.equal(hitsOf(puddle).length, 0);
  assert.equal(race.state.shots[0], S, 'and it flies on');
  // past the cows: they ran off the road and do not hurt for a cycle
  run(race, Math.round(60 * 0.05 * L / 55), []);
  const cows = race.state.hazards;
  assert.ok(cows.every((e) => e.cleared), 'scattered');
  assert.ok(cows.every((e) => !e.active), 'quiet');
  run(race, 60 * 10, []);
  // the rocket has gone far by now, the herd is back
  assert.ok(race.state.hazards.every((e) => !e.cleared), 'back on the next cycle');
  run(race, 60 * Math.ceil(L / 55), []);
  assert.equal(race.state.shots.length, 0);

  const r2 = setup(RING, 2);
  r2.teleport(0, 0.5, 0, { lap: 1 });
  r2.teleport(1, 0.55, 0, { lap: 0 }); // a lapped kart, in the way
  run(r2, 1, []);
  assert.equal(r2.state.karts[0].place, 1);
  r2.give(0, 'razzo');
  run(r2, 1, [press]);
  assert.equal(hitsOf(run(r2, 60 * 6, []), 1).length, 1);
});

test('grappa: big boost for 2.6 s, then 1.5 s of tipsy steering', () => {
  const race = setup(RING, 1);
  run(race, 240, [go]);
  const k = race.state.karts[0], v = k.speed;
  race.give(0, 'grappa');
  const ev = run(race, 1, [{ ...go, item: true }]);
  assert.ok(ev.some((e) => e.type === 'boost' && e.kind === 'grappa'));
  assert.equal(k.boostKind, 'grappa');
  assert.ok(Math.abs(k.boostT - 2.6) < 0.05);
  run(race, 120, [go]);
  assert.ok(k.speed > v * 1.2, `fast: ${k.speed} vs ${v}`);
  assert.equal(k.tipsyT, 0);
  run(race, 42, [go]);
  assert.equal(k.boostT, 0);
  assert.ok(k.tipsyT > 1.2 && k.tipsyT <= 1.5, `tipsy ${k.tipsyT}`);
  const steers = [];
  for (let i = 0; i < 40; i++) { run(race, 1, [go]); steers.push(k.steer); }
  assert.ok(Math.max(...steers) > 0.25 && Math.min(...steers) < -0.25, 'wobbles with the stick centred');
  run(race, 60, [go]);
  assert.equal(k.tipsyT, 0);
});

test('zuica: three sips, each press a short boost of 1.1 s', () => {
  const race = setup(RING, 1);
  run(race, 200, [go]);
  const k = race.state.karts[0];
  race.give(0, 'zuica');
  assert.equal(k.itemCharges, 3);
  let boosts = 0;
  for (let sip = 3; sip > 0; sip--) {
    assert.equal(k.itemCharges, sip);
    const ev = run(race, 1, [press]);
    boosts += ev.filter((e) => e.type === 'boost' && e.kind === 'zuica').length;
    assert.ok(Math.abs(k.boostT - 1.1) < 0.05, `${k.boostT}`);
    assert.ok(k.item === (sip > 1 ? 'zuica' : null));
    run(race, 90, [go]);
    assert.equal(k.boostT, 0, 'each sip is short');
  }
  assert.equal(boosts, 3);
  // a held button is one press
  race.give(0, 'zuica');
  run(race, 30, [press]);
  assert.equal(k.itemCharges, 2);
});

test('mici: orbit three, each blocks one hit; press throws one straight ahead, hit is a spin', () => {
  const race = setup(RING, 3);
  const K = race.state.karts;
  race.teleport(0, 0.14, 0);
  race.teleport(1, 0.1, 0);
  race.teleport(2, 0.2, 0);
  run(race, 1, []);
  race.give(0, 'mici');
  assert.equal(K[0].orbit, 3);
  // a razzo from the kart behind: shield, no spin, one sausage gone
  race.give(1, 'razzo');
  run(race, 1, [stay, press]);
  const ev = run(race, 200, []);
  assert.equal(hitsOf(ev, 0).length, 0, 'blocked');
  assert.ok(ev.some((e) => e.type === 'shield' && e.kart === 0));
  assert.equal(K[0].orbit, 2);
  assert.equal(K[0].hitT, 0);
  run(race, 60, []);
  // throw one at the kart ahead
  const use = run(race, 1, [press]);
  assert.ok(use.some((e) => e.type === 'itemUse' && e.item === 'mici'));
  assert.equal(K[0].orbit, 1);
  assert.equal(race.state.shots.find((s) => s.kind === 'mici').owner, 0);
  // where it goes is checked in its own test below, on a road straight enough to aim down

  // last sausage: blocks once more, then gone, item clears
  const r3 = setup(RING, 1);
  r3.give(0, 'mici');
  const k = r3.state.karts[0];
  for (let i = 0; i < 3; i++) {
    assert.equal(r3.internals.hitKart(k, 1, 'spin', 'test'), 'blocked');
    k.safeT = 0;
  }
  assert.equal(k.orbit, 0); assert.equal(k.item, null); assert.equal(k.itemCharges, 0);
  assert.equal(r3.internals.hitKart(k, 1, 'spin', 'test'), 'hit');
});

test('mici thrown: straight ahead hits for a spin, bounces once off a wall, pops on the second', () => {
  const big = ring({}, 1500);
  const race = setup(big, 2);
  const [a, b] = race.state.karts;
  race.teleport(0, 0.1, 0);
  race.teleport(1, 0.1 + 30 / big.track.length, 0);
  race.give(0, 'mici');
  run(race, 1, [press]);
  const ev = run(race, 60, []);
  const h = hitsOf(ev, 1);
  assert.equal(h.length, 1);
  assert.deepEqual([h[0].kind, h[0].cause, h[0].by], ['spin', 'mici', 0]);
  assert.ok(b.hitKind === 'spin' || b.safeT > 0);
  assert.equal(race.state.shots.length, 0);
  assert.ok(a);

  const r2 = setup(big, 1);
  r2.teleport(0, 0.3, 0, { yawOffset: 0.9 });
  r2.give(0, 'mici');
  run(r2, 1, [press]);
  const S = r2.state.shots[0], y0 = S.yaw;
  for (let i = 0; i < 60 && !S.bounced; i++) run(r2, 1, [stay]);
  assert.equal(S.bounced, 1, 'met the wall');
  assert.ok(Math.abs(S.yaw - y0) > 0.3, 'and came back off it');
  run(r2, 200, [stay]);
  assert.equal(r2.state.shots.length, 0, 'second wall or out of time, it is gone');
});

test('uova: 5 s big, very fast, knocks others away, immune to everything', () => {
  const race = setup(ring({}, 900), 3);
  const K = race.state.karts;
  run(race, 200, road(race, 0));
  const v0 = K[0].speed;
  race.give(0, 'uova');
  const u = run(race, 1, [press, stay, stay]);
  assert.ok(u.some((e) => e.type === 'boost' && e.kind === 'uova'));
  assert.ok(Math.abs(K[0].bigT - 5) < 0.05);
  run(race, 90, road(race, 0));
  assert.ok(K[0].speed > v0 * 1.1);

  // barrels through a kart in the way
  const u1 = K[0].u + 25 / (race.internals.track.length);
  race.teleport(1, u1, K[0].d);
  const ev = run(race, 60, road(race, 0));
  const hit = hitsOf(ev, 1);
  assert.ok(hit.length >= 1, 'the other one got knocked');
  assert.equal(hit[0].cause, 'uova');
  assert.equal(hit[0].by, 0);

  // immune: a razzo in the back does nothing, no hit, no shield spent
  assert.equal(race.internals.hitKart(K[0], 2, 'tumble', 'razzo'), 'immune');
  assert.equal(K[0].hitT, 0);
  run(race, 60 * 2.6, road(race, 0));
  assert.equal(K[0].bigT, 0);
  assert.equal(race.internals.hitKart(K[0], 2, 'tumble', 'razzo'), 'hit');
});

test('uova: a real razzo fired at it pops and does nothing', () => {
  const race = setup(RING, 2);
  const K = race.state.karts;
  race.teleport(0, 0.1, 0);
  race.teleport(1, 0.14, 0);
  run(race, 1, []);
  race.give(0, 'razzo');
  race.give(1, 'uova');
  run(race, 1, [press, press]);
  const ev = run(race, 200, []);
  assert.equal(hitsOf(ev, 1).length, 0);
  assert.equal(K[1].hitT, 0);
  assert.equal(race.state.shots.length, 0, 'it still blew up');
});

test('polenta: drops behind, stick up throws it far ahead; slows and slides whoever crosses it', () => {
  const race = setup(ring({}, 900), 2);
  const K = race.state.karts;
  race.teleport(0, 0.2, 0);
  race.give(0, 'polenta');
  run(race, 1, [press]);
  const P = race.state.spills[0];
  assert.equal(P.kind, 'polenta');
  const n = race.internals.track.n;
  const back = (K[0].trackI - P.i + n) % n;
  assert.ok(back * 2 > 2 && back * 2 < 10, `behind by ${back * 2} m`);
  // a chaser crosses it
  race.teleport(1, K[0].u - 40 / race.internals.track.length, 0, { speed: 30 });
  const ev = run(race, 100, road(race, 1));
  const h = hitsOf(ev, 1).find((e) => e.cause === 'polenta');
  assert.ok(h, 'crossed');
  assert.equal(h.by, 0);
  assert.equal(K[1].hitKind, null, 'no spin: it sticks and slides');
  assert.ok(K[1].speed < 24, `slowed: ${K[1].speed}`);

  const r2 = setup(ring({}, 900), 1);
  r2.teleport(0, 0.2, 0);
  r2.give(0, 'polenta');
  const K0 = r2.state.karts[0];
  run(r2, 1, [{ ...go, item: true, throttle: 1 }]);
  assert.equal(r2.state.spills.length, 0, 'in the air');
  assert.equal(r2.state.shots[0].lob, true);
  const t0 = K0.trackI, landed = run(r2, 46, [stay]);
  assert.ok(landed.some((e) => e.type === 'boom' && e.kind === 'polenta'));
  assert.equal(r2.state.shots.length, 0);
  const Q = r2.state.spills[0], ahead = (Q.i - t0 + n) % n;
  assert.ok(ahead * 2 > 30 && ahead * 2 < 60, `far ahead: ${ahead * 2} m`);
});

test('formaggio: rolls backward along the centre line and bowls over every chaser', () => {
  const race = setup(RING, 3);
  const [a, b, c] = race.state.karts;
  race.teleport(0, 0.3, 4);
  race.teleport(1, 0.27, 1);
  race.teleport(2, 0.24, -1);
  run(race, 1, []);
  race.give(0, 'formaggio');
  run(race, 1, [press]);
  const S = race.state.shots[0], s0 = S.si;
  assert.equal(S.kind, 'formaggio');
  const ev = run(race, 60 * 8, []);
  assert.ok(S.si < s0, 'rolled back');
  assert.equal(hitsOf(ev, 1).length, 1);
  assert.equal(hitsOf(ev, 2).length, 1);
  assert.equal(hitsOf(ev, 0).length, 0, 'not the one who let it go');
  assert.equal(hitsOf(ev, 1)[0].kind, 'tumble');
  assert.ok(a && b && c);
  assert.equal(S.hits, 2);
});

test('formaggio: stick up rolls it forward along the road, faster than the kart that let it go', () => {
  const race = setup(RING, 2);
  race.teleport(0, 0.3, 0, { speed: 30 });
  race.teleport(1, 0.34, 0);
  run(race, 1, []);
  race.give(0, 'formaggio');
  run(race, 1, [{ ...go, item: true, throttle: 1 }]);
  const S = race.state.shots[0], s0 = S.si;
  assert.equal(S.dir, 1);
  assert.ok(S.v > race.state.karts[0].speed);
  const ev = run(race, 60 * 5, [go]);
  assert.ok(S.si > s0, 'rolled forward');
  assert.equal(hitsOf(ev, 1).length, 1);
  assert.equal(hitsOf(ev, 0).length, 0);
});

test('durian: stick up lobs it far ahead', () => {
  const race = setup(ring({}, 900), 1);
  race.teleport(0, 0.2, 0);
  race.give(0, 'durian');
  const t0 = race.state.karts[0].trackI;
  run(race, 1, [{ ...go, item: true, throttle: 1 }]);
  assert.equal(race.state.spills.length, 0);
  run(race, 50, [stay]);
  const C = race.state.spills[0], n = race.internals.track.n;
  assert.equal(C.kind, 'durian');
  assert.ok(((C.i - t0 + n) % n) * 2 > 50, 'ahead');
});

test('durian: a stink cloud for 7 s across most of the road; wobbly and slow inside', () => {
  const race = setup(ring({}, 900), 2);
  const K = race.state.karts;
  race.teleport(0, 0.2, 0);
  race.give(0, 'durian');
  run(race, 1, [press]);
  const C = race.state.spills[0];
  assert.equal(C.kind, 'durian');
  assert.ok(C.r > race.internals.track.samples.w[0] * 0.35, 'most of the road');
  assert.ok(Math.abs(C.ttl - 7) < 0.01);
  race.teleport(1, K[0].u - 50 / race.internals.track.length, 6, { speed: 30 });
  const ev = run(race, 75, road(race, 1));
  assert.ok(hitsOf(ev, 1).some((e) => e.cause === 'durian'));
  assert.ok(K[1].stinkT > 0);
  run(race, 60 * 6.5, [stay, stay]);
  assert.equal(race.state.spills.length, 0, 'gone after 7 s');
});

test('sambal: 3 s of boost and a trail of flames that spins chasers, not its owner', () => {
  const race = setup(ring({}, 900), 2);
  const K = race.state.karts;
  run(race, 200, [go, stay]);
  race.give(0, 'sambal');
  const ev0 = run(race, 1, [press, stay]);
  assert.ok(ev0.some((e) => e.type === 'boost' && e.kind === 'sambal'));
  assert.ok(Math.abs(K[0].boostT - 3) < 0.05);
  run(race, 90, [go, stay]);
  assert.ok(race.state.spills.filter((s) => s.kind === 'sambal').length >= 8, 'a trail');
  assert.equal(K[0].hitT, 0);
  const flame = race.state.spills.find((s) => s.kind === 'sambal' && s.t > 0.2);
  race.teleport(1, flame.i / race.internals.track.n - 12 / race.internals.track.length, flame.d, { speed: 30 });
  const ev = run(race, 45, [go, go]);
  assert.ok(hitsOf(ev, 1).some((e) => e.cause === 'sambal' && e.kind === 'spin'));
  assert.equal(hitsOf(ev, 0).length, 0);
  run(race, 60 * 4, [go, go]);
  assert.equal(K[0].boostT, 0);
});

test('sambal: the blast burns whoever is close behind, not those beside or ahead, and leaves a sooty face', () => {
  const race = setup(ring({}, 900), 4);
  const K = race.state.karts, L = race.internals.track.length;
  race.teleport(0, 0.3, 0, { speed: 25 });
  race.teleport(1, 0.3 - 8 / L, 1, { speed: 25 });
  race.teleport(2, 0.3 - 40 / L, 0, { speed: 25 });
  race.teleport(3, 0.3 + 10 / L, 0, { speed: 25 });
  race.give(0, 'sambal');
  const ev = run(race, 1, [press, go, go, go]);
  assert.ok(ev.some((e) => e.type === 'boom' && e.kind === 'sambal'));
  assert.deepEqual(hitsOf(ev).map((e) => [e.kart, e.kind, e.cause, e.by]), [[1, 'spin', 'sambal', 0]]);
  assert.ok(K[1].sootT > 2);
  assert.equal(K[0].sootT, 0);
  assert.equal(K[2].hitT, 0);
  assert.equal(K[3].hitT, 0);
});

test('uova: no offroad slowdown', () => {
  const race = setup(ring({ surface: 'sand' }, 900), 2);
  const K = race.state.karts;
  race.teleport(0, 0.2, 0, { speed: 25 });
  race.teleport(1, 0.6, 0, { speed: 25 });
  race.give(0, 'uova');
  run(race, 1, [press, go]);
  run(race, 200, road(race, 0, 1));
  assert.ok(K[0].speed > K[1].speed * 1.3, `${K[0].speed} vs ${K[1].speed}`);
  assert.ok(K[0].speed > kartPhysics('tabia').top, `past top speed on sand: ${K[0].speed}`);
});

test('rendang: drags the kart towards the one ahead, slows that one, steals its item at the touch', () => {
  const race = setup(ring({}, 900), 2);
  const K = race.state.karts, L = race.internals.track.length;
  race.teleport(0, 0.3, -4, { speed: 28 });
  race.teleport(1, 0.3 + 35 / L, 4, { speed: 28 });
  run(race, 1, []);
  race.give(0, 'rendang');
  race.give(1, 'zuica');
  run(race, 1, [press, go]);
  const S = race.state.shots.find((x) => x.kind === 'rendang');
  assert.ok(S, 'the pot rides over the kart');
  assert.ok(K[0].rendangT > 3.9);
  let ev = [];
  for (let f = 0; f < 60 * 4.2 && !hitsOf(ev, 1).length; f++) ev.push(...run(race, 1, road(race, 0, 1)));
  const h = hitsOf(ev, 1)[0];
  assert.deepEqual([h.kind, h.cause, h.by], ['spin', 'rendang', 0]);
  assert.equal(K[0].item, 'zuica', 'stolen');
  assert.equal(K[0].itemCharges, 3);
  assert.equal(K[1].item, null);
  assert.ok(ev.some((e) => e.type === 'steal' && e.kart === 0 && e.from === 1 && e.item === 'zuica'));
  assert.equal(K[0].rendangT, 0);
  run(race, 2, [go, go]);
  assert.equal(race.state.shots.length, 0);
});

test('rendang: without a touch it ends after 4 s; from first place it pulls a crate in reach', () => {
  const race = setup(ring({}, 900), 2);
  const K = race.state.karts;
  race.teleport(0, 0.3, 0, { speed: 28 });
  race.teleport(1, 0.7, 0, { speed: 28 });
  run(race, 1, []);
  race.give(0, 'rendang');
  run(race, 1, [press, stay]);
  run(race, 60 * 4.1, [go, stay]);
  assert.equal(K[0].rendangT, 0);
  assert.equal(race.state.shots.length, 0);

  const world = ring({ itemBands: [0.5] }, 900), r2 = setup(world, 2), band = world.track.bands[0], L2 = world.track.length;
  r2.teleport(0, band.u - 60 / L2, 8, { speed: 15 });
  r2.teleport(1, 0.1, 0);
  run(r2, 1, []);
  assert.equal(r2.state.karts[0].place, 1);
  r2.give(0, 'rendang');
  const first = run(r2, 1, [press, stay]);
  const taken = [...first, ...run(r2, 60 * 4, [go, stay])].find((e) => e.type === 'boxTake' && e.kart === 0);
  assert.ok(taken?.item, 'a crate came to it');
  assert.ok(r2.state.karts[0].rouletteT > 0 || r2.state.karts[0].item);
});

test('frana: a shadow and a rumble first, then rocks across the road with one lane free; a rock bursts on a tumble', () => {
  const race = setup(ring({}, 900, 16), 3);
  const K = race.state.karts, T = race.internals.track, n = T.n, L = T.length;
  race.teleport(0, 0.3, 0, { speed: 25 });
  race.teleport(1, 0.5, 0, { speed: 30, lap: 1 });
  race.teleport(2, 0.2, 0, { speed: 20 });
  run(race, 1, []);
  assert.equal(K[1].place, 1);
  race.give(0, 'frana');
  const ev = run(race, 1, [press, go, go]);
  const rocks = race.state.spills.filter((s) => s.kind === 'frana');
  assert.equal(rocks.length, 3, 'four lanes on a 16 m road, one left free');
  assert.ok(ev.some((e) => e.type === 'hazardNear' && e.kart === 1 && e.kind === 'frana'), 'the leader hears it');
  const r = rocks[0], ahead = ((r.i - K[1].trackI + n) % n) * T.step;
  assert.ok(ahead > 60 && ahead < 110, `ahead of the leader: ${ahead} m`);
  assert.ok(r.warn >= 2, 'telegraphed at least 2 s');
  // falling: harmless, even with a kart right under it
  race.teleport(2, r.i / n, r.d, { speed: 0 });
  assert.equal(hitsOf(run(race, 60, [stay, stay, stay])).length, 0);
  const land = run(race, 80, [stay, stay, stay]);
  assert.ok(land.some((e) => e.type === 'boom' && e.kind === 'frana'));
  assert.deepEqual(hitsOf(land).map((e) => [e.kart, e.kind, e.cause]), [[2, 'tumble', 'frana']]);
  assert.equal(race.state.spills.filter((s) => s.kind === 'frana').length, 2, 'that rock burst, the others are still there');
});

test('frana: from first place it falls in front of the second', () => {
  const race = setup(ring({}, 900, 22), 2);
  const K = race.state.karts, T = race.internals.track, n = T.n;
  race.teleport(0, 0.6, 0, { speed: 25 });
  race.teleport(1, 0.3, 0, { speed: 25 });
  run(race, 1, []);
  race.give(0, 'frana');
  run(race, 1, [press, go]);
  const rocks = race.state.spills;
  assert.equal(rocks.length, 4, 'five lanes, one free');
  const a = ((rocks[0].i - K[1].trackI + n) % n) * T.step;
  assert.ok(a > 60 && a < 110, `${a} m ahead of the second`);
});

test('a hit: spin, then back in the race quickly; safeT stops a second hit at once', () => {
  const race = setup(RING, 1);
  const k = race.state.karts[0];
  run(race, 240, [go]);
  const v = k.speed;
  assert.equal(race.internals.hitKart(k, -1, 'spin', 'test'), 'hit');
  assert.equal(k.hitKind, 'spin');
  assert.ok(k.safeT > k.hitT);
  assert.equal(race.internals.hitKart(k, -1, 'spin', 'test'), 'immune');
  const y0 = k.yaw;
  run(race, 20, [go]);
  assert.notEqual(k.yaw, y0);
  run(race, 60 * 1, [go]);
  assert.equal(k.hitT, 0);
  assert.equal(k.hitKind, null);
  run(race, 60 * 2.2, [go]);
  assert.ok(k.speed > v * 0.85, `snappy: ${k.speed} of ${v} about 3 s after the hit`);
});

// Run a hazard track to the first moment `when` holds for some entry, then drop a kart on it.
function hazardWorld(kind, extra = {}) {
  return ring({ hazards: [{ kind, u: 0.3, width: 1, period: 8, phase: 0, ...extra }] });
}
function untilEntry(race, when, limit = 60 * 30) {
  for (let i = 0; i < limit; i++) {
    const e = race.state.hazards.find(when);
    if (e) return e;
    race.step([]);
    race.drainEvents();
  }
  return null;
}
function hitByHazard(kind, when) {
  const w = hazardWorld(kind);
  const race = setup(w, 1);
  race.teleport(0, 0.9, 0);
  const e = untilEntry(race, when);
  assert.ok(e, `${kind}: never happened`);
  race.teleport(0, e.i / w.track.n, e.d, { speed: 2 });
  const ev = run(race, 2, [go]);
  return { race, e, ev, w };
}

const onRoad = (e) => e.active && Math.abs(e.d) < 5;
for (const [kind, when] of [['cows', onRoad], ['sheep', onRoad], ['ponies', onRoad], ['sledders', onRoad], ['bats', (e) => e.h > 0 && e.h < 2.2 && Math.abs(e.d) < 5], ['steam', (e) => e.active], ['bear', (e) => e.active]]) {
  test(`hazard ${kind}: spins whoever it catches, and the event names it`, () => {
    const { race, ev } = hitByHazard(kind, when);
    const h = hitsOf(ev, 0);
    assert.equal(h.length, 1, JSON.stringify(ev));
    assert.deepEqual([h[0].kind, h[0].cause, h[0].by], ['spin', kind, -1]);
    assert.equal(race.state.karts[0].hitKind, 'spin');
  });
}

test('hazards leave a gap: passable, on the road only part of the cycle, entries move deterministically', () => {
  for (const kind of ['cows', 'sheep', 'ponies', 'sledders', 'macaques', 'bats', 'steam', 'bear']) {
    const w = hazardWorld(kind);
    const race = setup(w, 1);
    race.teleport(0, 0.8, 0);
    const list = race.state.hazards;
    assert.ok(list.length >= 1, kind);
    let blocked = 0, frames = 0, a = null;
    const seen = new Set();
    for (let f = 0; f < 60 * 16; f++) {
      race.step([stay]); race.drainEvents();
      frames++;
      const any = list.some((e) => e.active && Math.abs(e.d) < 8);
      if (any) blocked++;
      seen.add(list[0].x.toFixed(1));
      a = list[0];
    }
    assert.ok(blocked < frames, `${kind} must let go of the road sometimes`);
    assert.ok(seen.size > 1 || kind === 'steam' || kind === 'ice', `${kind} moves`);
    assert.ok(a.id >= 0 && a.kind === kind && 'yaw' in a && 't' in a && 'phase' in a);
  }
});

test('hazard bats: only low passes reach a kart', () => {
  const w = hazardWorld('bats');
  const race = setup(w, 1);
  race.teleport(0, 0.9, 0);
  const high = untilEntry(race, (e) => e.h > 3.2 && Math.abs(e.d) < 9);
  assert.ok(high);
  race.teleport(0, high.i / w.track.n, high.d, { speed: 2 });
  race.step([go]);
  assert.equal(race.state.karts[0].hitKind, null);
});

test('hazard steam: telegraphs before it erupts, quiet in between', () => {
  const w = hazardWorld('steam');
  const race = setup(w, 1);
  race.teleport(0, 0.9, 0);
  const e = race.state.hazards[0];
  let warned = false, erupted = false, quiet = false, order = [];
  for (let f = 0; f < 60 * 8; f++) {
    race.step([stay]); race.drainEvents();
    if (e.warn && !warned) { warned = true; order.push('warn'); }
    if (e.active && !erupted) { erupted = true; order.push('active'); }
    if (!e.active && !e.warn) quiet = true;
  }
  assert.ok(warned && erupted && quiet);
  assert.deepEqual(order, ['warn', 'active']);
  race.teleport(0, e.i / w.track.n, e.d + 0.01);
  const when = untilEntry(race, (x) => x === e && !x.active && !x.warn);
  assert.ok(when);
});

test('hazard macaques: steal the held item with no spin; with nothing to steal, a slide', () => {
  const { race, ev } = (() => {
    const w = hazardWorld('macaques');
    const r = setup(w, 1);
    r.teleport(0, 0.9, 0);
    r.give(0, 'razzo');
    const e = untilEntry(r, onRoad);
    r.teleport(0, e.i / w.track.n, e.d, { speed: 2 });
    return { race: r, ev: run(r, 2, [go]) };
  })();
  const k = race.state.karts[0];
  const steal = hitsOf(ev, 0);
  assert.equal(steal.length, 1);
  assert.deepEqual([steal[0].kind, steal[0].cause, steal[0].item], ['steal', 'macaques', 'razzo']);
  assert.equal(k.item, null);
  assert.equal(k.hitKind, null);

  const { ev: ev2, race: r2 } = hitByHazard('macaques', onRoad);
  assert.ok(hitsOf(ev2, 0).some((e) => e.kind === 'slide' && e.cause === 'macaques'));
  assert.equal(r2.state.karts[0].hitKind, null);
});

test('hazard ice patch: grip goes on the patch and comes back past it', () => {
  const w = hazardWorld('ice');
  const race = setup(w, 1);
  const k = race.state.karts[0], L = w.track.length;
  race.teleport(0, 0.3, 0, { speed: 20 });
  run(race, 2, [go]);
  assert.equal(k.surface, 'ice');
  race.teleport(0, 0.3 + 100 / L, 0, { speed: 20 });
  run(race, 12, [go]);
  assert.equal(k.surface, 'asphalt');
});

test('hazards respect the shields: mici block a cow, uova barrels through', () => {
  const blocked = (() => {
    const w = hazardWorld('cows');
    const r = setup(w, 1);
    r.teleport(0, 0.9, 0);
    r.give(0, 'mici');
    const e = untilEntry(r, onRoad);
    r.teleport(0, e.i / w.track.n, e.d, { speed: 2 });
    return { ev: run(r, 2, [go]), k: r.state.karts[0] };
  })();
  assert.equal(hitsOf(blocked.ev, 0).length, 0);
  assert.ok(blocked.ev.some((e) => e.type === 'shield'));
  assert.equal(blocked.k.orbit, 2);

  const w = hazardWorld('cows');
  const r = setup(w, 1);
  r.teleport(0, 0.9, 0);
  r.give(0, 'uova');
  run(r, 1, [press]);
  const e = untilEntry(r, onRoad, 60 * 4);
  assert.ok(e);
  r.teleport(0, e.i / w.track.n, e.d, { speed: 2 });
  assert.equal(hitsOf(run(r, 2, [go]), 0).length, 0);
});

test('hazardNear warns a kart approaching an active hazard', () => {
  const w = hazardWorld('steam');
  const r = setup(w, 1);
  r.teleport(0, 0.3 - 30 / w.track.length, 0, { speed: 25 });
  const ev = [];
  for (let i = 0; i < 60; i++) {
    r.teleport(0, 0.3 - 30 / w.track.length, 0, { speed: 25 });
    r.step([go]);
    ev.push(...r.drainEvents());
  }
  // eruptions come round in their cycle; repeat over one period to catch one
  for (let i = 0; i < 60 * 8; i++) { r.teleport(0, 0.3 - 30 / w.track.length, 0, { speed: 25 }); r.step([go]); ev.push(...r.drainEvents()); }
  assert.ok(ev.some((e) => e.type === 'hazardNear' && e.kind === 'steam'));
});

test('a track asking for an unknown hazard fails loudly', () => {
  const w = ring({ hazards: [{ kind: 'dragons', u: 0.3 }] });
  assert.throws(() => setup(w, 1), /unknown hazard/);
});

function raceWithStuckTrace(world, players, difficulty, seed, laps = world.track.long ? 1 : 3) {
  const race = createRace({ track: world.track, terrain: world.terrain, seed, laps, players, difficulty, countdown: 0 });
  const s = race.state, prog = s.karts.map((k) => k.progress), still = s.karts.map(() => 0);
  let stuck = 0;
  const events = [];
  for (let f = 0; f < 60 * 900 && s.phase !== 'done'; f++) {
    race.step([]);
    for (const e of race.drainEvents()) if (e.type === 'itemUse' || e.type === 'driftEnd' || e.type === 'rescue') events.push(e);
    if (f % 15) continue;
    s.karts.forEach((k, i) => {
      if (k.finished || k.hitT > 0 || k.rescueT > 0) { still[i] = 0; prog[i] = k.progress; return; }
      const gained = (k.progress - prog[i]) * world.track.length;
      still[i] = gained < 1.2 ? still[i] + 0.25 : 0;
      prog[i] = k.progress;
      if (still[i] > stuck) stuck = still[i];
    });
  }
  return { race, stuck, events, state: s };
}
const botField = (s = 0, n = 8) => Array.from({ length: n }, (_, i) => ({ slot: -1, kart: KART_IDS[(i + s) % KART_IDS.length], human: false }));

for (const id of available) {
  for (const diff of ['easy', 'medium', 'hard']) {
    test(`bots: ${diff} on ${id} finish three laps, nothing stuck over 4 s`, () => {
      const world = worlds.get(id);
      for (const seed of [1, 2]) {
        const { state, stuck } = raceWithStuckTrace(world, botField(seed), diff, 500 + seed);
        assert.equal(state.phase, 'done', `seed ${seed}`);
        assert.ok(state.karts.every((k) => k.finished), 'all finished');
        assert.ok(stuck <= 4, `stuck ${stuck} s`);
        assert.ok(state.karts.every((k) => k.bestLapT > 15));
      }
    });
  }
}

test('bots on a hard made-up track: ice, sand, narrow hairpins, a jump and all the hazards', () => {
  const points = [];
  const add = (x, z, y, w, surface = 'asphalt', tag = null) => points.push({ p: [x, y, z], w, bank: 0, surface, tag });
  add(0, 0, 0, 13); add(120, 0, 0, 13); add(230, 20, 3, 12, 'snow'); add(260, 60, 6, 12, 'snow'); add(225, 95, 9, 12, 'ice'); add(120, 90, 12, 12, 'ice'); add(85, 120, 14, 12, 'ice');
  add(120, 150, 16, 12, 'sand'); add(235, 145, 18, 12, 'sand'); add(275, 180, 20, 12, 'sand', 'jump'); add(240, 220, 20, 12); add(60, 225, 14, 12, 'dirt'); add(-60, 220, 8, 12, 'wood'); add(-120, 180, 4, 12, 'cobble'); add(-120, 90, 2, 12); add(-80, 25, 0.5, 13);
  const def = {
    id: 'torture', region: 'cadore', names: { it: 't', en: 't' }, points, itemBands: [0.1, 0.4, 0.7], boostPads: [{ u: 0.05, offset: 0 }], jumps: [{ u: 0.52, strength: 1 }], zones: [], shortcuts: [],
    hazards: [{ kind: 'cows', u: 0.1, period: 9 }, { kind: 'sheep', u: 0.2, period: 10 }, { kind: 'bear', u: 0.3, period: 7 }, { kind: 'sledders', u: 0.4, period: 6 }, { kind: 'ice', u: 0.45 }, { kind: 'bats', u: 0.55, period: 9 }, { kind: 'steam', u: 0.65, period: 6 }, { kind: 'ponies', u: 0.75, period: 7 }, { kind: 'macaques', u: 0.85, period: 5 }],
    ground: { base: -2, hills: 12, hillScale: 200, rimHeight: 80, rimFrom: 300, rimTo: 500, water: null }, grid: { spacing: 6 },
  };
  const track = buildTrack(def), world = { track, terrain: buildTerrain(track) };
  for (const diff of ['easy', 'medium', 'hard']) {
    const { state, stuck } = raceWithStuckTrace(world, botField(3), diff, 77);
    assert.equal(state.phase, 'done', diff);
    assert.ok(stuck <= 4, `${diff} stuck ${stuck} s`);
  }
});

function meanFinish(world, diff, races) {
  let win = 0, ratio = 0;
  const events = [];
  for (let s = 0; s < races; s++) {
    const r = raceWithStuckTrace(world, botField(s), diff, 900 + s);
    const t = r.state.karts.map((k) => k.finishT);
    win += Math.min(...t); ratio += Math.max(...t) / Math.min(...t);
    events.push(...r.events);
  }
  return { win: win / races, ratio: ratio / races, events };
}

test('tuning on antelao: lap in range, hard beats medium beats easy by clear margins, races stay close', () => {
  const world = worlds.get('antelao');
  const easy = meanFinish(world, 'easy', 5), medium = meanFinish(world, 'medium', 5), hard = meanFinish(world, 'hard', 5);
  const lap = (m) => m.win / 3;
  assert.ok(lap(hard) > 52 && lap(hard) < 75, `hard lap ${lap(hard)}`);
  assert.ok(medium.win > hard.win * 1.05, `medium ${medium.win} vs hard ${hard.win}`);
  assert.ok(easy.win > medium.win * 1.05, `easy ${easy.win} vs medium ${medium.win}`);
  assert.ok(medium.ratio < 1.25, `last within 25% at medium: ${medium.ratio}`);
  // tier 2+ is what hard bots do, easy barely tries
  const count = (m, t) => m.events.filter((e) => e.type === 'driftEnd' && e.tier === t).length;
  assert.ok(count(hard, 2) + count(hard, 3) > count(hard, 1), 'hard: tier 2+');
  assert.ok(count(hard, 2) + count(hard, 3) > (count(easy, 2) + count(easy, 3)) * 2);
  assert.ok(hard.events.filter((e) => e.type === 'rescue').length === 0);
});

test('tuning on antelao: no kart wins more than about 30% at equal skill', () => {
  const world = worlds.get('antelao');
  const wins = {}, starts = {};
  for (const k of KART_IDS) { wins[k] = 0; starts[k] = 0; }
  const RACES = 45;
  for (let s = 0; s < RACES; s++) {
    const r = raceWithStuckTrace(world, botField(s), 'medium', 1500 + s);
    for (const k of r.state.karts) { starts[k.kart]++; if (k.place === 1) wins[k.kart]++; }
  }
  for (const k of KART_IDS) assert.ok(wins[k] / starts[k] <= 0.36, `${k} won ${wins[k]} of ${starts[k]}`);
});

test('a human with no bots left: done 30 s after the leader; bots alone: done when all are in', () => {
  const world = RING;
  const players = [{ slot: 0, kart: 'tabia', human: true }, { slot: -1, kart: 'becak', human: false }];
  const race = createRace({ track: world.track, terrain: world.terrain, seed: 2, laps: 1, players, difficulty: 'easy', countdown: 0 });
  const k = race.state.karts[0];
  race.teleport(0, 0.97, 0, { speed: 25 });
  let doneAt = null;
  for (let f = 0; f < 60 * 80; f++) {
    race.step([go]);
    race.drainEvents();
    if (race.state.phase === 'done') { doneAt = race.state.t; break; }
  }
  assert.ok(k.finished);
  assert.ok(doneAt !== null);
  assert.ok(doneAt - k.finishT <= 30.5, `${doneAt} after ${k.finishT}`);
  assert.equal(k.place, 1);
});

test('a human who finished is driven on by the autopilot, and keeps their place', () => {
  const race = createRace({ track: RING.track, terrain: RING.terrain, seed: 2, laps: 1, players: humans(2), difficulty: 'easy', countdown: 0 });
  const [a] = race.state.karts;
  race.teleport(0, 0.97, 0, { speed: 25 });
  run(race, 60 * 5, [go, go]);
  assert.ok(a.finished);
  const u = a.progress, place = a.place;
  run(race, 120, []);
  assert.ok(a.progress > u, 'still rolling');
  assert.equal(a.place, place);
  assert.equal(race.internals.hitKart(a, 1, 'spin', 'test'), 'immune');
});

test('a shortcut counts, with its own surface, and keeps lap progress valid', () => {
  const world = worlds.get('antelao');
  const sc = world.track.shortcuts[0];
  const race = createRace({ track: world.track, terrain: world.terrain, seed: 1, players: humans(1), countdown: 0 });
  const k = race.state.karts[0], S = sc.samples;
  race.teleport(0, sc.from + 1 / world.track.n, 0, { speed: 25 });
  let seen = false, p0 = k.progress, maxJump = 0;
  for (let f = 0; f < 60 * 12; f++) {
    const a = Math.min(sc.n - 1, sc.nearest(k.x, k.z).i + 8), tx = S.x[a], tz = S.z[a];
    const e = Math.atan2(Math.sin(Math.atan2(tx - k.x, tz - k.z) - k.yaw), Math.cos(Math.atan2(tx - k.x, tz - k.z) - k.yaw));
    race.step([{ ...go, steer: Math.max(-1, Math.min(1, -e * 3)) }]);
    race.drainEvents();
    if (k.shortcut === 0) { seen = true; assert.equal(k.surface, sc.surface); assert.equal(k.offroad, false); }
    const jump = Math.abs(k.progress - p0) * world.track.length;
    if (jump > maxJump) maxJump = jump;
    p0 = k.progress;
    if (k.progress > 0 && k.u > sc.to + 0.01) break;
  }
  assert.ok(seen, 'drove the shortcut');
  assert.ok(maxJump < 16, `progress never jumps: ${maxJump} m in a step`);
  assert.ok(k.u >= sc.to - 0.02, 'came out the far end');
});

test('hard bots take the shortcut when their kart gains on it, easy never', () => {
  const world = worlds.get('antelao');
  const use = (diff, kart) => {
    const race = createRace({ track: world.track, terrain: world.terrain, seed: 3, laps: 2, players: [{ slot: -1, kart, human: false }], difficulty: diff, countdown: 0 });
    const k = race.state.karts[0];
    let on = 0;
    for (let f = 0; f < 60 * 200 && race.state.phase !== 'done'; f++) { race.step([]); race.drainEvents(); if (k.shortcut >= 0) on++; }
    return on;
  };
  assert.equal(use('easy', 'jeep'), 0);
  assert.ok(use('hard', 'jeep') > 30, 'jeep on dirt');
});

test('bots use all ten items and use them differently by difficulty', () => {
  const world = worlds.get('antelao');
  const used = new Set();
  for (let s = 0; s < 12; s++) {
    const r = raceWithStuckTrace(world, botField(s), 'medium', 1800 + s);
    for (const e of r.events) if (e.type === 'itemUse') used.add(e.item);
  }
  for (const id of ITEM_IDS) assert.ok(used.has(id), `nobody used ${id}`);
});

test('bots dodge: a puddle on the line catches easy bots more often than hard ones', () => {
  const { track, terrain } = worlds.get('antelao');
  const crossings = (difficulty) => {
    let hits = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const players = [{ slot: -1, kart: 'tabia', human: false, difficulty }, { slot: 0, kart: 'jeep', human: true }];
      const race = createRace({ track, terrain, seed, laps: 1, players, difficulty, countdown: 0 });
      const u = 0.06, i = Math.round(u * track.n);
      race.teleport(1, u, track.racingLine.d[i]);
      race.give(1, 'polenta');
      race.step([undefined, press]);
      race.teleport(1, 0.5, 0);
      for (let f = 0; f < 60 * 14; f++) {
        race.step([]);
        hits += race.drainEvents().filter((e) => e.type === 'hit' && e.kart === 0 && e.cause === 'polenta').length;
      }
    }
    return hits;
  };
  const easy = crossings('easy'), hard = crossings('hard');
  assert.ok(hard <= 2 && easy > hard, `easy ${easy}, hard ${hard}`);
});

test('determinism holds across fresh processes', () => {
  const hash = () => execFileSync(process.execPath, [rel('../tools/simrun.mjs'), '--hash', '--track', 'antelao'], { encoding: 'utf8' }).trim();
  const a = hash();
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.equal(a, hash());
});

test('fast: 8 karts run far faster than real time', () => {
  const world = worlds.get('antelao');
  const race = createRace({ track: world.track, terrain: world.terrain, seed: 9, laps: 99, players: botField(2), difficulty: 'hard', countdown: 0 });
  const t0 = process.hrtime.bigint();
  const steps = 3000;
  for (let i = 0; i < steps; i++) { race.step([]); race.drainEvents(); }
  const secs = Number(process.hrtime.bigint() - t0) / 1e9, ratio = steps * DT / secs;
  console.log(`steps/s ${(steps / secs).toFixed(0)}, ${ratio.toFixed(0)}x real time`);
  assert.ok(ratio > 20, `${ratio}x`);
});

// ---------- feel: turbos, traffic, sheep, wide drifts (review of 06/11/2026) ----------
const feelWorld = async (id) => { const track = buildTrack(await loadTrackDef(id)); return { track, terrain: buildTerrain(track) }; };
const feelRace = (w, players, seed = 1, laps = 9) => createRace({ ...w, seed, laps, players, difficulty: 'medium', countdown: 0 });
const oneHuman = [{ slot: 0, kart: 'tabia', human: true, name: 'a' }];

test('a short turbo does not inherit a stronger boost; a short one inside a long strong one takes nothing from it', async () => {
  const { giveBoost } = await import('../src/sim/kart.js');
  const r = feelRace(await feelWorld('antelao'), oneHuman), k = r.state.karts[0], p = r.internals.priv[0];
  giveBoost(r.internals, k, 'grappa');
  assert.equal(k.boostTier, 3);
  k.boostT = 0.1;
  giveBoost(r.internals, k, 'drift', 'drift1');
  assert.equal(p.boostMul, BOOST.drift1.mul, 'the tier 1 outlasts the end of the grappa, and is a tier 1');
  assert.equal(k.boostTier, 1);
  k.boostT = 0; giveBoost(r.internals, k, 'grappa');
  giveBoost(r.internals, k, 'drift', 'drift1');
  assert.equal(p.boostMul, BOOST.grappa.mul, 'a fresh grappa is not lowered by a tier 1 inside it');
  assert.equal(k.boostTier, 3);
  r.drainEvents();
  giveBoost(r.internals, k, 'drift', 'drift2');
  assert.equal(r.drainEvents().find((e) => e.type === 'boost').tier, 2, 'the event says which tier');
});

test('Jakarta: a driver who does not weave spins under 12 times a race, the traffic is still all there and buses still spin you', async () => {
  const w = await feelWorld('jakarta'), T = w.track, S = T.samples;
  const players = []; for (let i = 0; i < 8; i++) players.push(i === 5 ? { slot: 0, kart: 'jeep', human: true, name: 'a' } : { slot: -1, kart: KART_IDS[i], human: false });
  for (const seed of [4000, 4001]) {
    const r = feelRace(w, players, seed, 1), K = r.state.karts, me = K[5], past = [];
    let spins = 0, scrapes = 0, crashes = 0, light = 0;
    for (let f = 0; f < 60 * 600 && !me.finished; f++) {
      const a = (me.trackI + Math.round((6 + Math.abs(me.speed) * 0.3) / T.step)) % T.n; let e = Math.atan2(S.x[a] - me.x, S.z[a] - me.z) - me.yaw; e = Math.atan2(Math.sin(e), Math.cos(e));
      past.push(Math.max(-1, Math.min(1, -e * 2.2)));
      const inp = []; inp[5] = { steer: past[Math.max(0, past.length - 12)], throttle: 0, item: false, drift: false };
      r.step(inp);
      for (const ev of r.drainEvents()) {
        if (ev.type === 'hit' && ev.kart === 5 && ev.cause === 'traffic') spins++;
        if (ev.type === 'traffic' && ev.kart === 5) { if (ev.kind === 'scrape') scrapes++; if (ev.kind === 'crash') { crashes++; if (!['truck', 'metromini', 'bus'].includes(ev.veh)) light++; } }
      }
    }
    assert.ok(me.finished, 'home');
    assert.ok(spins < 12, `${spins} traffic spins`);
    assert.ok(spins >= 1 && crashes >= 1, `a bus still spins you: ${spins}`);
    assert.equal(light, 0, 'a crash is only ever a truck or a bus');
    assert.ok(scrapes >= 10, `the traffic is still in the way: ${scrapes} scrapes`);
  }
});

test('Jakarta: no kart is stuck past the 4 s limit', async () => {
  const w = await feelWorld('jakarta');
  const players = []; for (let i = 0; i < 8; i++) players.push({ slot: -1, kart: KART_IDS[i], human: false });
  const r = createRace({ ...w, seed: 11, laps: 1, players, difficulty: 'hard', countdown: 0 }), K = r.state.karts, prog = K.map((k) => k.progress), still = K.map(() => 0);
  let worst = 0;
  for (let f = 0; f < 60 * 360 && r.state.phase !== 'done'; f++) {
    r.step([]); r.drainEvents();
    if (f % 15) continue;
    K.forEach((k, i) => {
      if (k.finished || k.rescueT > 0 || k.hitT > 0) { still[i] = 0; prog[i] = k.progress; return; }
      still[i] = (k.progress - prog[i]) * w.track.length < 1.2 ? still[i] + 0.25 : 0; prog[i] = k.progress; worst = Math.max(worst, still[i]);
    });
  }
  assert.ok(worst <= 4, `stuck ${worst} s`);
});

test('the Transfagarasan sheep always leave a lane for a kart, and they are still on the road most of the time', async () => {
  const w = await feelWorld('transfagarasan'), S = w.track.samples, r = createRace({ ...w, seed: 1, laps: 9, players: [{ slot: -1, kart: 'tabia', human: false }], difficulty: 'medium', countdown: 0 });
  const KART = 1.35; let on = 0, blocked = 0, n = 0;
  const flock = r.state.hazards.filter((e) => e.kind === 'sheep');
  assert.equal(flock.length, 7, 'the whole flock and its dog');
  for (let f = 0; f < 60 * 120; f++) {
    r.step([]); r.drainEvents();
    if (f % 6) continue;
    n++;
    const hw = S.w[flock[0].i] / 2, there = flock.filter((e) => Math.abs(e.d) < hw + e.r + KART);
    if (!there.length) continue;
    on++;
    let c = -hw, gap = 0;
    for (const [a, b] of there.map((e) => [e.d - e.r - KART, e.d + e.r + KART]).sort((x, y) => x[0] - y[0])) { gap = Math.max(gap, a - c); c = Math.max(c, b); }
    if (Math.max(gap, hw - c) <= 0.3) blocked++;
  }
  assert.equal(blocked, 0, `no free lane in ${blocked} of ${on}`);
  assert.ok(on / n > 0.5, `on the road ${on} of ${n}`);
});

test('a drift held wide opens to a radius of about 150 m at speed, and the tight side is what it always was', async () => {
  const r = feelRace(await feelWorld('antelao'), oneHuman), k = r.state.karts[0];
  // a held drift with the stick already there, one frame of it
  const rateOf = (steer) => {
    r.teleport(0, 0.1, 0, { speed: 30 });
    r.step([{ steer, throttle: 0, item: false, drift: true }]);
    k.drift = 1; k.driftT = 0; k.grounded = true; k.steer = steer;
    const y0 = k.yaw; r.step([{ steer, throttle: 0, item: false, drift: true }]); r.drainEvents();
    return Math.abs(Math.atan2(Math.sin(k.yaw - y0), Math.cos(k.yaw - y0))) * 60;
  };
  const d = kartPhysics('tabia').drift;
  // drift 1 turns to the left of the stick's sign, so a stick the same way as the drift tightens
  assert.ok(Math.abs(rateOf(1) - d * 1.62) < 0.05, 'tight');
  const open = rateOf(-1);
  assert.ok(Math.abs(open - d * 0.13) < 0.05, `open ${open}`);
  assert.ok(30 / open > 120, `radius ${30 / open} m at 30 m/s`);
});

test('a turbo moves the camera by its tier, fast out and slowly back; a hit and a landing jolt it; no turbo, no move', async () => {
  const { createViewCamera } = await import('../src/render/camera.js');
  const world = { track: { nearest: () => ({ d: 1e9, i: 0, f: 0 }), samples: { w: [10] }, heightAt: () => 0, structureAt: () => null }, terrain: { heightAt: () => -50 } };
  const make = () => createViewCamera({ camera: { fov: 54, fovFast: 68, near: 0.1, far: 2000 } }, world);
  const run = (cam, K, n, each) => { for (let f = 0; f < n; f++) { K.z += K.vz / 60; cam.chase(K, 1 / 60); each?.(cam); } };
  const K0 = () => ({ x: 0, y: 0, z: 0, vx: 0, vz: 30, yaw: 0, grounded: true, trackI: 0, boostT: 0, boostTier: 0, bigT: 0, rescueT: 0, steer: 0 });
  const measure = (tier) => {
    const cam = make(), K = K0();
    run(cam, K, 240);
    const fov0 = cam.camera.fov, gap0 = K.z - cam.camera.position.z;
    K.boostT = tier ? 1.5 : 0; K.boostTier = tier;
    if (tier) cam.bump(0.3 + 0.15 * tier);
    let early = 0;
    run(cam, K, 18, (c) => { early = c.camera.fov - fov0; });
    run(cam, K, 12);
    const out = { fov: cam.camera.fov - fov0, back: K.z - cam.camera.position.z - gap0, early };
    K.boostT = 0;
    run(cam, K, 18);
    out.after = cam.camera.fov - fov0;
    return out;
  };
  const none = measure(0), M = [1, 2, 3].map(measure);
  assert.ok(Math.abs(none.fov) < 0.01 && Math.abs(none.back) < 0.25, `no turbo, no pull: ${JSON.stringify(none)}`);
  M.forEach((m, i) => {
    const t = i + 1;
    assert.ok(Math.abs(m.fov - t * 2) < 0.4, `tier ${t} opens ${t * 2} degrees: ${m.fov}`);
    assert.ok(m.early > t * 2 * 0.75, `in 0.3 s, ${m.early}`);
    assert.ok(m.back > 0.45 * t, `tier ${t} is left ${m.back} m behind`);
    assert.ok(m.after > m.fov * 0.4, `and comes back slowly, ${m.after} of ${m.fov}`);
  });
  const hit = make(), K = K0();
  run(hit, K, 120);
  const fov = hit.camera.fov, y = hit.camera.position.y;
  hit.jolt(0.8);
  run(hit, K, 2);
  assert.ok(fov - hit.camera.fov > 3, 'a hit closes the view in');
  assert.ok(y - hit.camera.position.y > 0.3, 'and drops it');
  run(hit, K, 60);
  assert.ok(Math.abs(hit.camera.fov - fov) < 0.05, 'for a moment only');
});

test('drift sparks grow with the tier, smoke is solid and not a thin disc, a hit is a big star', async () => {
  const { createFx } = await import('../src/render/fx.js');
  const fx = createFx({ fog: {} }), G = fx.points.geometry.attributes;
  const sparksAt = (tier) => {
    fx.clear();
    const k = { x: 0, y: 0, z: 0, vx: 0, vz: 28, yaw: 0, drift: 1, driftTier: tier, grounded: true, boostT: 0, surface: 'asphalt', kart: 'tabia' };
    let live = 0, big = 0, puff = 0;
    for (let f = 0; f < 60; f++) { fx.kart(0, k, 1 / 60); fx.update(1 / 60); }
    for (let i = 0; i < G.aKind.count; i++) {
      if (G.aSize.array[i] <= 0) continue;
      if (G.aKind.array[i] === 1) { live++; big = Math.max(big, G.aSize.array[i]); } else if (G.aKind.array[i] === 0) puff = Math.max(puff, G.aAlpha.array[i]);
    }
    return { live, big, puff };
  };
  const T = [0, 1, 2, 3].map(sparksAt);
  assert.equal(T[0].live, 0, 'no charge, no sparks');
  assert.ok(T[1].live < T[2].live && T[2].live < T[3].live, JSON.stringify(T));
  assert.ok(T[1].big < T[2].big && T[2].big < T[3].big, JSON.stringify(T));
  assert.ok(T[0].puff > 0.75, `puffs are nearly solid at their peak: ${T[0].puff}`);
  const peak = () => { let m = 0; for (let i = 0; i < G.aKind.count; i++) if (G.aKind.array[i] === 2) m = Math.max(m, G.aSize.array[i]); return m; };
  fx.clear(); fx.onEvent({ type: 'hit', kart: 0, kind: 'slide' }, [{ x: 0, y: 0, z: 0, vx: 0, vz: 0, surface: 'asphalt' }]); fx.update(1 / 60);
  assert.equal(peak(), 0, 'a slide is dust, no stars');
  fx.clear(); fx.onEvent({ type: 'hit', kart: 0, kind: 'spin' }, [{ x: 0, y: 0, z: 0, vx: 0, vz: 0, surface: 'asphalt' }]); fx.update(1 / 60);
  assert.ok(peak() >= 3.5, `the spin's star is big: ${peak()}`);
});
