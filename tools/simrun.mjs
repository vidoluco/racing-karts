#!/usr/bin/env node
// Headless races with numbers: how the tuning actually plays out.
//   node tools/simrun.mjs [--track antelao] [--races 24] [--laps 3] [--kart-races 135] [--quick] [--no-karts] [--hash]
// Prints per difficulty: lap times, spread, place changes, items, stuck time, speed range; a mixed field to show who beats
// whom; a good driver (the 'ace' brain in a human slot) against each difficulty; a newcomer with no drift; per kart at each
// difficulty: wins, place histogram, lap, items, stuck, speed range. --hash prints only a digest of one full race.

import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildTrack } from '../src/world/track.js';
import { buildTerrain } from '../src/world/terrain.js';
import { createRace, DT } from '../src/sim/index.js';
import { KART_IDS } from '../src/data/karts.js';
import { TRACK_IDS, loadTrackDef } from '../src/data/tracks.js';

const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : dflt; };
const quick = args.includes('--quick');
const LAPS = +opt('laps', 3), RACES = +opt('races', quick ? 6 : 24), KART_RACES = +opt('kart-races', quick ? 36 : 135);
const only = opt('track', null);
const rel = (p) => fileURLToPath(new URL(p, import.meta.url));
const trackIds = only ? [only] : TRACK_IDS.filter((id) => existsSync(rel(`../src/world/tracks/${id}.js`)));

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : '-');
const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);

function grid(seed, field = 8) {
  // the roster rotates through the seats, so no kart owns pole
  const out = [];
  for (let i = 0; i < field; i++) out.push(KART_IDS[(i + seed) % KART_IDS.length]);
  return out;
}

function runRace(world, players, difficulty, seed, opts = {}) {
  const race = createRace({ track: world.track, terrain: world.terrain, seed, laps: opts.laps ?? LAPS, players, difficulty, countdown: 0 });
  const s = race.state, n = s.karts.length, m = {
    stuckMax: 0, minV: Infinity, maxV: 0, items: {}, placeChanges: 0, hits: 0, shields: 0, walls: 0, rescues: 0, boxes: 0, boosts: {}, tiers: [0, 0, 0, 0], drifts: 0,
    laps: [], finish: new Array(n).fill(null), steps: 0, leadChanges: 0,
    perKart: s.karts.map(() => ({ stuck: 0, minV: Infinity, maxV: 0, items: 0 })),
  };
  const prog = s.karts.map((k) => k.progress), still = new Array(n).fill(0), lastPlace = s.karts.map((k) => k.place);
  let leader = 0;
  const limit = 60 * 60 * 15;
  for (let f = 0; f < limit && s.phase !== 'done'; f++) {
    const inputs = [];
    for (let i = 0; i < n; i++) if (s.karts[i].human) inputs[i] = race.autopilot(i);
    race.step(inputs);
    m.steps++;
    for (let i = 0; i < n; i++) {
      const k = s.karts[i];
      if (!k.finished && f > 300) {
        if (k.speed < m.minV) m.minV = k.speed;
        if (k.speed < m.perKart[i].minV) m.perKart[i].minV = k.speed;
      }
      if (k.speed > m.maxV) m.maxV = k.speed;
      if (k.speed > m.perKart[i].maxV) m.perKart[i].maxV = k.speed;
      if (k.finished || k.rescueT > 0 || k.hitT > 0) { still[i] = 0; prog[i] = k.progress; continue; }
      if (f % 15 === 0) {
        const gained = (k.progress - prog[i]) * world.track.length;
        if (gained < 1.2) still[i] += 0.25; else still[i] = 0;
        if (still[i] > m.stuckMax) m.stuckMax = still[i];
        if (still[i] > m.perKart[i].stuck) m.perKart[i].stuck = still[i];
        prog[i] = k.progress;
      }
      if (k.place !== lastPlace[i]) { m.placeChanges++; lastPlace[i] = k.place; }
      if (k.place === 1 && leader !== i) { leader = i; m.leadChanges++; }
    }
    for (const e of race.drainEvents()) {
      if (e.type === 'itemUse') { m.items[e.item] = (m.items[e.item] || 0) + 1; m.perKart[e.kart].items++; }
      else if (e.type === 'hit') m.hits++;
      else if (e.type === 'shield') m.shields++;
      else if (e.type === 'wall') m.walls++;
      else if (e.type === 'rescue') m.rescues++;
      else if (e.type === 'boxTake') m.boxes++;
      else if (e.type === 'boost') m.boosts[e.kind] = (m.boosts[e.kind] || 0) + 1;
      else if (e.type === 'driftEnd') { m.tiers[e.tier]++; m.drifts++; }
      else if (e.type === 'lap') m.laps.push({ kart: e.kart, t: s.karts[e.kart].lastLapT });
      else if (e.type === 'finish') { m.finish[e.kart] = e.time; m.laps.push({ kart: e.kart, t: s.karts[e.kart].lastLapT }); }
    }
  }
  m.order = s.karts.slice().sort((a, b) => a.place - b.place).map((k) => k.i);
  m.done = s.phase === 'done';
  m.karts = s.karts.map((k) => ({ kart: k.kart, place: k.place, finishT: k.finishT, bestLapT: k.bestLapT, human: k.human }));
  return m;
}

function perDifficulty(world, id) {
  console.log(`\n== ${id}: ${world.track.length.toFixed(0)} m, ${RACES} races of ${LAPS} laps, 8 bots per difficulty`);
  console.log(`${pad('diff', 8)}${lpad('lap best', 9)}${lpad('avg', 7)}${lpad('win s', 7)}${lpad('last/w', 8)}${lpad('swaps', 7)}${lpad('leads', 7)}${lpad('items', 7)}${lpad('hits', 6)}${lpad('walls', 6)}${lpad('resc', 6)}${lpad('stuck', 7)}${lpad('minV', 6)}${lpad('maxV', 6)}  tiers 0/1/2/3`);
  const rows = {};
  for (const diff of ['easy', 'medium', 'hard']) {
    const R = [];
    for (let s = 0; s < RACES; s++) {
      const karts = grid(s);
      R.push(runRace(world, karts.map((kart) => ({ slot: -1, kart, human: false })), diff, 1000 + s));
    }
    const laps = R.flatMap((m) => m.laps.map((l) => l.t)), wins = R.map((m) => Math.min(...m.finish)), lastRatio = R.map((m) => Math.max(...m.finish) / Math.min(...m.finish));
    const tiers = [0, 1, 2, 3].map((t) => R.reduce((a, m) => a + m.tiers[t], 0));
    const items = mean(R.map((m) => Object.values(m.items).reduce((a, b) => a + b, 0)));
    rows[diff] = { win: mean(wins), lastRatio: mean(lastRatio), best: Math.min(...laps), avg: mean(laps) };
    console.log(`${pad(diff, 8)}${lpad(f1(Math.min(...laps)), 9)}${lpad(f1(mean(laps)), 7)}${lpad(f1(mean(wins)), 7)}${lpad(mean(lastRatio).toFixed(2), 8)}${lpad(f1(mean(R.map((m) => m.placeChanges))), 7)}${lpad(f1(mean(R.map((m) => m.leadChanges))), 7)}${lpad(f1(items), 7)}${lpad(f1(mean(R.map((m) => m.hits))), 6)}${lpad(f1(mean(R.map((m) => m.walls))), 6)}${lpad(f1(mean(R.map((m) => m.rescues))), 6)}${lpad(Math.max(...R.map((m) => m.stuckMax)).toFixed(2), 7)}${lpad(f1(Math.min(...R.map((m) => m.minV))), 6)}${lpad(f1(Math.max(...R.map((m) => m.maxV))), 6)}  ${tiers.join('/')}`);
    const items2 = {};
    for (const m of R) for (const [k, v] of Object.entries(m.items)) items2[k] = (items2[k] || 0) + v;
    console.log(`         items used: ${Object.entries(items2).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  }
  return rows;
}

// Everyone in one field. Same kart everywhere, so the only difference is the difficulty.
function mixedField(world) {
  const avg = { easy: [], medium: [], hard: [] };
  const wins = { easy: 0, medium: 0, hard: 0 };
  for (let s = 0; s < RACES; s++) {
    const kart = KART_IDS[s % KART_IDS.length], diffs = ['hard', 'medium', 'easy', 'hard', 'medium', 'easy', 'hard', 'medium'];
    const m = runRace(world, diffs.map((difficulty) => ({ slot: -1, kart, human: false, difficulty })), 'medium', 2000 + s);
    m.karts.forEach((k, i) => avg[diffs[i]].push(k.place));
    wins[diffs[m.order[0]]]++;
  }
  console.log(`mixed field avg place: easy ${f1(mean(avg.easy))}, medium ${f1(mean(avg.medium))}, hard ${f1(mean(avg.hard))}; wins ${JSON.stringify(wins)}`);
}

function goodDriver(world) {
  console.log(`good driver (ace brain in a human slot, tabia, grid slot 8) against each difficulty:`);
  for (const diff of ['easy', 'medium', 'hard']) {
    const places = [], laps = [];
    for (let s = 0; s < Math.max(6, RACES / 2); s++) {
      const karts = grid(s).map((kart) => ({ slot: -1, kart, human: false }));
      karts[7] = { slot: 0, kart: 'tabia', human: true, name: 'P1', difficulty: 'ace' };
      const m = runRace(world, karts, diff, 3000 + s);
      places.push(m.karts[7].place);
      laps.push(m.karts[7].bestLapT);
    }
    const hist = new Array(9).fill(0);
    for (const p of places) hist[p]++;
    console.log(`  ${pad(diff, 8)} avg place ${f1(mean(places))}, best lap ${f1(Math.min(...laps))}, typical best lap ${f1(mean(laps))}, places ${hist.slice(1).join(' ')}`);
  }
}

// No drift, no brake, no items, late reactions, a thumb on a stick: how forgiving is the road for a newcomer?
function newcomer(world) {
  const { track } = world, S = track.samples, n = track.n;
  const race = createRace({ track, terrain: world.terrain, seed: 11, laps: 3, players: [{ slot: 0, kart: 'tabia', human: true, name: 'P1' }], difficulty: 'easy', countdown: 0 });
  const s = race.state, k = s.karts[0];
  const past = [];
  let walls = 0, off = 0, steps = 0, rescues = 0;
  for (let f = 0; f < 60 * 400 && !k.finished; f++) {
    const a = (k.trackI + Math.round((6 + Math.abs(k.speed) * 0.3) / track.step)) % n;
    const tx = S.x[a], tz = S.z[a];
    let e = Math.atan2(tx - k.x, tz - k.z) - k.yaw;
    e = Math.atan2(Math.sin(e), Math.cos(e));
    past.push(Math.max(-1, Math.min(1, -e * 2.2)));
    race.step([{ steer: past[Math.max(0, past.length - 12)], throttle: 0, item: false, drift: false }]);
    steps++; if (k.offroad) off++;
    for (const ev of race.drainEvents()) { if (ev.type === 'wall') walls++; if (ev.type === 'rescue') rescues++; }
  }
  console.log(`newcomer (no drift, 0.2 s late): best lap ${f1(k.bestLapT)}, finished ${k.finished}, walls ${walls}, offroad ${(off / steps * 100).toFixed(0)}%, rescues ${rescues}`);
}

function perKart(world, diff, races) {
  const T = {};
  for (const k of KART_IDS) T[k] = { wins: 0, places: 0, n: 0, hist: new Array(8).fill(0), best: Infinity, lapSum: 0, laps: 0, stuck: 0, minV: Infinity, maxV: 0, items: 0 };
  for (let s = 0; s < races; s++) {
    const karts = grid(s), shift = s % 8, seats = karts.map((_, i) => karts[(i + shift) % 8]);
    const m = runRace(world, seats.map((kart) => ({ slot: -1, kart, human: false })), diff, 5000 + s);
    T[m.karts[m.order[0]].kart].wins++;
    m.karts.forEach((k, i) => {
      const t = T[k.kart], q = m.perKart[i];
      t.places += k.place; t.n++; t.hist[k.place - 1]++;
      if (k.bestLapT && k.bestLapT < t.best) t.best = k.bestLapT;
      t.stuck = Math.max(t.stuck, q.stuck); t.minV = Math.min(t.minV, q.minV); t.maxV = Math.max(t.maxV, q.maxV); t.items += q.items;
    });
    for (const l of m.laps) { const t = T[m.karts[l.kart].kart]; t.lapSum += l.t; t.laps++; }
  }
  console.log(`per kart, ${races} races at equal skill (${diff}):`);
  console.log(`  ${pad('kart', 11)}${lpad('wins%', 6)}${lpad('place', 7)}${lpad('best', 7)}${lpad('avg', 7)}${lpad('items', 7)}${lpad('stuck', 7)}${lpad('minV', 6)}${lpad('maxV', 6)}  places 1..8`);
  let worst = 0;
  for (const k of KART_IDS) {
    const t = T[k], w = (t.wins / t.n) * 100;
    if (w > worst) worst = w;
    console.log(`  ${pad(k, 11)}${lpad(w.toFixed(0), 6)}${lpad(f1(t.places / t.n), 7)}${lpad(f1(t.best), 7)}${lpad(f1(t.lapSum / t.laps), 7)}${lpad(f1(t.items / t.n), 7)}${lpad(t.stuck.toFixed(2), 7)}${lpad(f1(t.minV), 6)}${lpad(f1(t.maxV), 6)}  ${t.hist.join(' ')}`);
  }
  console.log(`  highest win share: ${worst.toFixed(0)}% (target: about 30 at most)`);
}

function throughput(world) {
  const karts = grid(0).map((kart) => ({ slot: -1, kart, human: false }));
  const race = createRace({ track: world.track, terrain: world.terrain, seed: 7, laps: 99, players: karts, difficulty: 'hard', countdown: 0 });
  const t0 = process.hrtime.bigint(), steps = 6000;
  for (let i = 0; i < steps; i++) { race.step([]); race.drainEvents(); }
  const secs = Number(process.hrtime.bigint() - t0) / 1e9, sps = steps / secs;
  console.log(`speed: ${sps.toFixed(0)} steps/s with 8 karts = ${(sps * DT).toFixed(0)}x real time`);
}

if (args.includes('--hash')) {
  const track = buildTrack(await loadTrackDef(trackIds[0])), terrain = buildTerrain(track), h = createHash('sha256');
  const race = createRace({ track, terrain, seed: 42, laps: 1, players: grid(3).map((kart) => ({ slot: -1, kart, human: false })), difficulty: 'hard', countdown: 0 });
  for (let f = 0; f < 60 * 30; f++) { race.step([]); h.update(JSON.stringify(race.drainEvents())); }
  h.update(JSON.stringify(race.state));
  console.log(h.digest('hex'));
  process.exit(0);
}

for (const id of trackIds) {
  const def = await loadTrackDef(id), track = buildTrack(def), world = { track, terrain: buildTerrain(track) };
  perDifficulty(world, id);
  mixedField(world);
  goodDriver(world);
  newcomer(world);
  if (!args.includes('--no-karts')) {
    perKart(world, 'medium', KART_RACES);
    for (const diff of ['easy', 'hard']) perKart(world, diff, Math.ceil(KART_RACES / 3));
  }
  throughput(world);
}
