// The Jakarta traffic: a pure function of time on a pure function of the road. Same seed, same race; hundreds on the road at once,
// and the road stays drivable; the crossing, the rain and the knocked list keep their word.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import def from '../src/world/tracks/jakarta.js';
import { buildTrack } from '../src/world/track.js';
import { buildTerrain } from '../src/world/terrain.js';
import { createRace } from '../src/sim/index.js';
import { createTraffic, countVehicles, crossingState, forEachVehicle, VEHICLES, rainAt, createTrafficState } from '../src/sim/traffic.js';
import { KART_IDS } from '../src/data/karts.js';

const track = buildTrack(def), terrain = buildTerrain(track), T = createTraffic(track);
const players = (humans = 0) => Array.from({ length: 8 }, (_, i) => ({ kart: KART_IDS[i % KART_IDS.length], human: i < humans }));
const race = (seed, difficulty = 'hard', humans = 0) => createRace({ track, terrain, seed, laps: 1, players: players(humans), difficulty, countdown: 0 });

test('a long track, on its real length, one band about every 500 m', () => {
  assert.ok(track.length >= 5000 && track.length <= 10000, `length ${track.length}`);
  assert.ok(track.long);
  const n = track.bands.length;
  assert.ok(n >= track.length / 700 && n <= track.length / 350, `${n} bands`);
});

test('hundreds of vehicles of every sort on the road at once', () => {
  let min = 1e9;
  for (const t of [0, 13, 60, 200, 413]) min = Math.min(min, countVehicles(T, t));
  assert.ok(min >= 3000, `only ${min} at the emptiest`);
  const seen = {};
  forEachVehicle(T, 0, T.n - 1, 50, (e) => { seen[e.kind] = (seen[e.kind] || 0) + 1; }, T.streams);
  for (const k of ['motor', 'ojek', 'angkot', 'bajaj', 'bus', 'car']) assert.ok(seen[k] > 0, `no ${k} on the road`);
  assert.ok(seen.motor + seen.ojek > 1500, `${seen.motor + seen.ojek} bikes`);
  for (const k of ['krupuk', 'family', 'galon', 'ayam', 'melon', 'sofa', 'gerobak', 'metromini', 'truck', 'mpv']) assert.ok(seen[k] > 0, `no ${k} on the road`);
});

test('where a vehicle is depends on nothing but the time', () => {
  const snap = (t) => { const out = []; forEachVehicle(T, 0, T.n - 1, t, (e) => out.push([e.stream.index, e.id, e.f.toFixed(4), e.d.toFixed(4)].join()), T.streams); return out.join(';'); };
  assert.equal(snap(77.5), snap(77.5));
  assert.equal(snap(77.5), (() => { const U = createTraffic(track), o = []; forEachVehicle(U, 0, U.n - 1, 77.5, (e) => o.push([e.stream.index, e.id, e.f.toFixed(4), e.d.toFixed(4)].join()), U.streams); return o.join(';'); })());
  assert.notEqual(snap(77.5), snap(78.5));
});

test('traffic flows: nothing runs backwards or stands still for good, and jams move in waves', () => {
  const pos = new Map();
  forEachVehicle(T, 0, T.n - 1, 100, (e) => pos.set(`${e.stream.index}/${e.id}`, e.f), T.streams);
  let moved = 0, stuck = 0, wrong = 0;
  forEachVehicle(T, 0, T.n - 1, 112, (e) => {
    const a = pos.get(`${e.stream.index}/${e.id}`);
    if (a === undefined) return;
    const s = (e.f - a) * T.step * e.stream.dir;
    if (s < -0.1) wrong++; else if (s < 1) stuck++; else moved++;
  }, T.streams);
  assert.equal(wrong, 0, `${wrong} went backwards`);
  assert.ok(moved > stuck * 3, `${moved} moved, ${stuck} did not`);
});

test('the road stays fair: past what can stop a kart, across every 6 m of road there is a gap for one, with rare short exceptions in the worst of the jam', () => {
  const ROW = 6, KART = 2.4;
  let bad = 0, total = 0, wall = 0;
  for (const t of [20, 47, 90, 151, 222]) {
    const rows = new Map();
    forEachVehicle(T, 0, T.n - 1, t, (e) => {
      const V = VEHICLES[e.kind], m = e.f * T.step;
      if (V.heavy === 0) return; // a bike scatters or swerves, it is never a wall
      for (let k = Math.floor((m - V.len / 2) / ROW); k <= Math.floor((m + V.len / 2) / ROW); k++) {
        if (!rows.has(k)) rows.set(k, []);
        rows.get(k).push([e.d - V.wid / 2, e.d + V.wid / 2]);
      }
    }, T.streams);
    let run = 0;
    for (let key = 0; key * ROW < track.length; key++) {
      const i = Math.min(T.n - 1, Math.round(key * ROW / T.step)), hw = track.samples.w[i] / 2, list = (rows.get(key) || []).sort((a, b) => a[0] - b[0]);
      let edge = -hw, gap = 0;
      for (const [a, b] of list) { gap = Math.max(gap, a - edge); edge = Math.max(edge, b); }
      gap = Math.max(gap, hw - edge);
      total++;
      if (gap < KART) { bad++; run++; wall = Math.max(wall, run); } else run = 0;
    }
  }
  assert.ok(bad / total < 0.025, `${bad} of ${total} rows have no gap for a kart`);
  assert.ok(wall * ROW <= 36, `a wall ${wall * ROW} m deep`);
});

test('a swarm parts: through the thick of the bikes plain scooters swerve at no cost, only a loaded bike is ever hit', () => {
  const r = race(9, 'hard', 1), u0 = track.pointU[def.marks.saharjo], kinds = {}, seen = new Set();
  r.teleport(0, u0 + 60 / track.length, 0, { speed: 26 });
  let parted = 0;
  for (let i = 0; i < 60 * 20; i++) {
    r.step([r.autopilot(0)]);
    for (const q of r.state.traffic.knocked) {
      const key = `${q.stream}/${q.id}/${q.t0}`;
      if (!seen.has(key)) { seen.add(key); if (q.hop < 0.1) parted++; }
    }
    for (const e of r.drainEvents()) if (e.type === 'traffic' && e.kind === 'scatter') kinds[e.veh] = 1;
  }
  assert.ok(parted >= 40, `only ${parted} riders parted`);
  assert.ok(Object.keys(kinds).every((q) => VEHICLES[q].load), `a plain scooter was hit: ${Object.keys(kinds)}`);
  assert.ok(r.state.traffic.knocked.length < 300, `${r.state.traffic.knocked.length} still swerving`);
});

test('every level of bot finishes the lap through the traffic; none is stuck for long', () => {
  for (const [difficulty, cap] of [['easy', 600], ['medium', 560], ['hard', 540]]) {
    const r = race(11, difficulty), last = r.state.karts.map(() => ({ p: 0, t: 0 }));
    let worst = 0;
    while (r.state.t < cap && !r.state.karts.every((k) => k.finished)) {
      r.step([]);
      for (const k of r.state.karts) {
        const L = last[k.i], p = k.progress ?? k.dist ?? 0;
        if (k.finished || Math.abs(p - L.p) > 4 / track.length) { L.p = p; L.t = r.state.t; }
        worst = Math.max(worst, r.state.t - L.t);
      }
      r.drainEvents();
    }
    const done = r.state.karts.filter((k) => k.finished).length;
    assert.equal(done, 8, `${difficulty}: ${done}/8 finished by ${r.state.t.toFixed(0)} s`);
    assert.ok(worst < 12, `${difficulty}: one stayed in place for ${worst.toFixed(1)} s`);
  }
});

test('deterministic: same seed, same race, hits and all; another seed differs', () => {
  const run = (seed) => {
    const r = race(seed), h = createHash('sha1');
    for (let i = 0; i < 60 * 80; i++) {
      r.step([]);
      for (const e of r.drainEvents()) if (e.type === 'traffic' || e.type === 'hit') h.update(`${i}:${e.type}:${e.kart}:${e.kind || e.cause};`);
      if (i % 300 === 0) for (const k of r.state.karts) h.update(`${k.x.toFixed(5)},${k.z.toFixed(5)};`);
    }
    h.update(`${r.state.traffic.knocked.length}`);
    return h.digest('hex');
  };
  assert.equal(run(5), run(5));
  assert.notEqual(run(5), run(6));
});

test('knocking a vehicle: events, a place in the state, and it gets back in line', () => {
  const r = race(3);
  let knocks = 0, seen = 0;
  for (let i = 0; i < 60 * 120; i++) {
    r.step([]);
    for (const e of r.drainEvents()) if (e.type === 'traffic') knocks++;
    seen = Math.max(seen, r.state.traffic.knocked.length);
  }
  assert.ok(knocks > 5, `${knocks} knocks`);
  assert.ok(seen > 0);
  assert.ok(r.state.traffic.knocked.length < 60, `${r.state.traffic.knocked.length} still knocked`);
});

test('the crossing: warns before the train, a pure clock; the train tumbles who is on the rails and spares who waits', () => {
  const c = T.crossings[0];
  assert.ok(c, 'there is a crossing');
  assert.equal(crossingState(c, c.period * 3 + 0.1).phase, 'warn');
  assert.equal(crossingState(c, c.period * 3 + c.warn + 0.1).phase, 'pass');
  assert.equal(crossingState(c, c.period * 3 + c.warn + c.pass + 0.1).phase, 'quiet');
  const r = race(4, 'hard', 1), u = c.f * T.step / track.length;
  while (crossingState(c, r.state.t).phase !== 'quiet' || crossingState(c, r.state.t + 1).phase !== 'quiet') { r.step([]); r.drainEvents(); }
  r.teleport(0, u, 0, { speed: 0 });
  let train = false;
  for (let i = 0; i < 60 * c.period && !train; i++) {
    r.teleport(0, u, 0, { speed: 0 });
    r.step([]);
    for (const e of r.drainEvents()) if (e.type === 'hit' && e.kart === 0 && e.cause === 'train') { train = true; assert.equal(crossingState(c, r.state.t).phase, 'pass'); }
  }
  assert.ok(train, 'the train went through a kart parked on the rails');
  const q = race(4, 'hard', 1);
  let hit = false;
  for (let i = 0; i < 60 * c.period * 1.2; i++) {
    q.teleport(0, u - 40 / track.length, 0, { speed: 0 });
    q.step([]);
    for (const e of q.drainEvents()) if (e.cause === 'train' && e.kart === 0) hit = true;
  }
  assert.ok(!hit, 'a kart waiting back from the rails was hit by the train');
});

test('rain comes or does not by the seed, greases the road a little, and dries', () => {
  const on = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => createTrafficState(track, s).rainFrom < 1e8);
  assert.ok(on.some(Boolean) && on.some((x) => !x), 'rain is a matter of luck');
  const st = createTrafficState(track, on.indexOf(true) + 1);
  assert.equal(rainAt(st, st.rainFrom - 1), 0);
  assert.equal(rainAt(st, st.rainFrom + 20), 1);
  assert.equal(rainAt(st, st.rainTo + 1), 0);
});
