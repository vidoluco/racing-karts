// A clumsy, stubborn thumb on every track, in the sim, with bots around it: review of 06/11, finding 13. Whatever it does, the road
// stays reachable, the rescue animal stays an exception and nothing in the state goes bad. Stalls are not reset by a hit or a rescue.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack } from '../src/world/track.js';
import { buildTerrain } from '../src/world/terrain.js';
import { createRace } from '../src/sim/index.js';
import { KART_IDS } from '../src/data/karts.js';
import { loadTrackDef, TRACK_IDS } from '../src/data/tracks.js';
import { fuzzThumb, fuzzRun } from './helpers/fuzz-thumb.mjs';
import { ITEM_IDS } from '../src/data/items.js';
import { sacredPoints } from '../src/sim/disasters.js';
import { wallsFor } from '../src/sim/kart.js';
import { createFlow, resultRows, POINTS } from '../src/game/flow.js';
import { TRACKS } from '../src/data/tracks.js';
import { AUTO_HOME, DT, LEADER_GRACE } from '../src/sim/tuning.js';

const STALL = 40;       // s without new ground for a thumb that plays the fool at most 7 s at a stretch; measured worst 29, 24 seeds a track
const BOT_STALL = 12;   // s, a bot beside the fool
const RESCUES = { free: 2, perLap: 3, in30s: 4 }; // measured worst: 4 in 2 laps, Bâlea's lake on Transfăgărășan, where the water is real
const worlds = {};
const world = async (id) => {
  if (worlds[id]) return worlds[id];
  const def = await loadTrackDef(id), track = buildTrack(def);
  return (worlds[id] = { track, terrain: buildTerrain(track), long: !!def.long });
};

function fuzzRace(W, seed) {
  const players = [];
  for (let i = 0; i < 8; i++) players.push(i < 4 ? { slot: i, kart: KART_IDS[(i + seed) % KART_IDS.length], human: true, name: 'x' } : { slot: -1, kart: KART_IDS[(i + seed) % KART_IDS.length], human: false });
  const race = createRace({ track: W.track, terrain: W.terrain, seed: 700 + seed, laps: W.long ? 1 : 3, players, difficulty: 'medium', countdown: 0 });
  // a long track is seen in pieces, or the fool would only ever know its first kilometres
  if (W.long) [0, 1, 2, 3].forEach((i) => race.teleport(i, (seed * 0.13 + i * 0.21) % 1, 0, { speed: 10 }));
  return race;
}

describe('a clumsy thumb on every track', () => {
  for (const id of TRACK_IDS) {
    test(`${id}: no kart wanders off from its progress, rescues stay rare`, async () => {
      const W = await world(id);
      for (let seed = 0; seed < 4; seed++) {
        const race = fuzzRace(W, seed), K = race.state.karts, start = K.map((k) => k.progress);
        const M = fuzzRun(race, [0, 1, 2, 3].map((i) => fuzzThumb(W.track, 900 + seed, i)), 200);
        M.forEach((m, i) => {
          const where = `${id} seed ${seed} kart ${i}`;
          assert.equal(m.bad, null, where);
          if (i >= 4) { assert.ok(m.stallMax <= BOT_STALL, `${where}: a bot stalled ${m.stallMax.toFixed(1)} s at u ${m.stallAt.toFixed(3)}`); return; }
          assert.ok(m.stallMax <= STALL, `${where}: ${m.stallMax.toFixed(1)} s without new ground at u ${m.stallAt.toFixed(3)}`);
          const laps = Math.max(0, K[i].progress - start[i]);
          assert.ok(m.rescues <= RESCUES.free + RESCUES.perLap * laps, `${where}: ${m.rescues} rescues in ${laps.toFixed(2)} laps at ${m.rescueAt}`);
          for (let a = 0; a + RESCUES.in30s < m.rescueAt.length; a++) assert.ok(m.rescueAt[a + RESCUES.in30s] - m.rescueAt[a] > 30, `${where}: a rescue loop at ${m.rescueAt}`);
        });
      }
    });
  }

  test('the measure is not blind: a thumb that only reverses is caught', async () => {
    const W = await world('antelao'), race = fuzzRace(W, 0), m = fuzzRun(race, [() => ({ steer: 0, throttle: -1, item: false, drift: false })], 60)[0];
    assert.ok(m.stallMax > STALL);
  });
});

describe('the room and the fool', () => {
  test('a long track: one good driver, one who never moves: the room waits a bounded time, and the sleeper is placed, with no time', async () => {
    const W = await world('batur'), players = [];
    for (let i = 0; i < 8; i++) players.push(i < 2 ? { slot: i, kart: KART_IDS[i], human: true, name: 'x' } : { slot: -1, kart: KART_IDS[i], human: false });
    const race = createRace({ track: W.track, terrain: W.terrain, seed: 42, laps: 1, players, difficulty: 'medium', countdown: 0 }), s = race.state;
    let winner = null;
    for (let f = 0; f < 900 / DT && s.phase !== 'done'; f++) {
      race.step([race.autopilot(0), { steer: 0, throttle: -1, item: false, drift: false }]);
      for (const e of race.drainEvents()) if (e.type === 'finish' && winner === null) winner = s.t;
    }
    assert.equal(s.phase, 'done');
    assert.ok(s.t - winner <= AUTO_HOME.afterLeader + AUTO_HOME.drive + 1, `waited ${(s.t - winner).toFixed(0)} s`);
    const sleeper = s.karts[1];
    assert.equal(sleeper.finished, false);
    assert.equal(sleeper.place, s.karts.filter((k) => k.finished).length + s.karts.filter((k) => !k.finished && k.progress > sleeper.progress).length + 1);
    const row = resultRows(s.karts).find((r) => r.i === 1);
    assert.equal(row.time, null);
  });

  // past the limit the autopilot takes over, and past a further limit the race is over: on any track, long ones at two laps too
  for (const id of TRACK_IDS) {
    test(`${id}: the race ends, the room does not wait for ever`, async () => {
      const W = await world(id), players = [];
      for (let i = 0; i < 8; i++) players.push(i < 2 ? { slot: i, kart: KART_IDS[i], human: true, name: 'x' } : { slot: -1, kart: KART_IDS[i], human: false });
      const race = createRace({ track: W.track, terrain: W.terrain, seed: 41, laps: 2, players, difficulty: 'medium', countdown: 0 }), s = race.state;
      const thumbs = [fuzzThumb(W.track, 5, 0), fuzzThumb(W.track, 5, 1)];
      const limit = W.long ? 1100 : 300; // the bots wait for the fools: 985 s measured on Batur at two laps
      for (let f = 0; f < limit / DT && s.phase !== 'done'; f++) { race.step(s.karts.map((k, i) => (i < 2 ? thumbs[i](k) : undefined))); race.drainEvents(); }
      assert.equal(s.phase, 'done', `${id}: still racing after ${limit} s`);
      const leader = Math.min(...s.karts.filter((k) => k.finished).map((k) => k.finishT));
      assert.ok(s.t - leader <= AUTO_HOME.afterLeader + AUTO_HOME.drive + LEADER_GRACE, `${id}: the room waited ${(s.t - leader).toFixed(0)} s after the winner`);
    });
  }
});

// ---------- the eleven items, each from a human slot, on every track, from first and from last ----------
const HUMAN = 5, PRESSES = { zuica: [0, 90, 180], mici: [0, 90, 180] };
function itemRun(W, item, place, seed) {
  const L = W.track.length, Q = sacredPoints(W.track), players = [];
  for (let i = 0; i < 8; i++) players.push(i === HUMAN ? { slot: 0, kart: KART_IDS[seed % 9], human: true, name: 'x' } : { slot: -1, kart: KART_IDS[(i + seed + 1) % 9], human: false });
  const r = createRace({ track: W.track, terrain: W.terrain, seed: 4000 + seed * 7, laps: 9, players, difficulty: 'medium', countdown: 0 }), s = r.state, K = s.karts, k = K[HUMAN];
  const u0 = (seed * 0.137 + ITEM_IDS.indexOf(item) * 0.021 + 0.05) % 1;
  K.forEach((o, i) => r.teleport(i, (u0 + ((i === HUMAN ? 3 : i) * -9) / L + 1) % 1, (i % 3 - 1) * 2, { speed: 15, lap: 2 }));
  for (let f = 0; f < 60 * 8; f++) { const inp = []; inp[HUMAN] = { ...r.autopilot(HUMAN), item: false }; r.step(inp); }
  r.drainEvents();
  const rest = K.filter((o) => o !== k).map((o) => o.progress), edge = place === 1 ? Math.max(...rest) + 12 / L : Math.min(...rest) - 12 / L;
  r.teleport(HUMAN, ((edge % 1) + 1) % 1, 0, { speed: Math.max(15, k.speed), lap: Math.floor(edge) });
  s.spills.length = 0; s.shots.length = 0;
  for (const o of K) { o.item = null; o.itemCharges = 0; o.orbit = 0; o.rouletteT = 0; }
  r.give(HUMAN, item);
  const out = { place: k.place, hit: false, did: false, self: [], sacred: [] };
  const presses = PRESSES[item] ?? [0, 30, 60]; // a thumb that was spinning when it first pressed presses again
  for (let f = 0; f < 60 * 25; f++) {
    const inp = [];
    inp[HUMAN] = { ...r.autopilot(HUMAN), item: presses.includes(f), throttle: presses.includes(f) && seed % 2 ? 1 : 0 };
    r.step(inp);
    if (k.boostKind === item || k.bigT > 0 || (item === 'razzo' && k.safeT > 0.5 && place === 1)) out.did = true;
    for (const e of r.drainEvents()) {
      if (e.type === 'hit' && e.by === HUMAN) { if (e.kart === HUMAN) out.self.push(e.cause); else if (e.cause === item) out.hit = true; }
      if ((e.type === 'steal' || e.type === 'boxTake') && e.kart === HUMAN && item === 'rendang' && f < 60 * 22) out.did = true;
      if (e.type === 'boom') for (const q of Q) if (Math.hypot(e.x - q.x, e.z - q.z) < q.r) out.sacred.push(`boom ${e.kind}`);
    }
    for (const P of s.spills) for (const q of Q) if (Math.hypot(P.x - q.x, P.z - q.z) < q.r + P.r) out.sacred.push(`spill ${P.kind}`);
    for (const S of s.shots) if (!Number.isFinite(S.x + S.y + S.z)) throw new Error(`${S.kind} not finite`);
    if (!Number.isFinite(k.x + k.y + k.z + k.progress)) throw new Error('kart not finite');
  }
  return out;
}

describe('every item, every track, first and last', () => {
  // what counts as worth a press, as far as the sim can say. The share is over all tracks and seeds: a rocket may lose its target to a rescue.
  const worth = (o) => o.hit || o.did;
  const tally = {};
  for (const id of TRACK_IDS) {
    test(`${id}: no crash, no self hit, nothing on a church or a temple`, async () => {
      const W = await world(id);
      for (const item of ITEM_IDS) for (const place of [1, 8]) for (let seed = 0; seed < 3; seed++) {
        const o = itemRun(W, item, place, seed), where = `${id} ${item} from ${place}, seed ${seed}`;
        assert.equal(o.place, place, where);
        assert.deepEqual(o.self, [], `${where}: hit by its own throw`);
        assert.deepEqual(o.sacred, [], `${where}: touched a protected place`);
        const t = (tally[`${item} from ${place}`] ||= [0, 0]);
        t[1]++; if (worth(o)) t[0]++;
      }
    });
  }
  test('no item is a dud from first or from last', () => {
    assert.equal(Object.keys(tally).length, ITEM_IDS.length * 2);
    for (const [key, [good, all]] of Object.entries(tally)) assert.ok(good / all >= 0.6, `${key}: worth the press ${good} of ${all}`);
  });
});

// ---------- churches and temples ----------
describe('nothing touches a church or a temple', () => {
  const sacredTracks = TRACK_IDS;
  for (const id of sacredTracks) {
    test(`${id}: the shoulder stops short of it, and what is thrown lands clear, at every point of the road`, async () => {
      const W = await world(id), T = W.track, S = T.samples, Q = sacredPoints(T);
      if (!Q.length) return;
      const walls = wallsFor(T, W.terrain);
      for (let i = 0; i < T.n; i++) for (const [side, lim] of [[1, walls.left[i]], [-1, walls.right[i]]]) {
        const hw = S.w[i] / 2, x = S.x[i] + S.nx[i] * side * lim, z = S.z[i] + S.nz[i] * side * lim;
        // a road that itself passes under the circle's edge: the barrier stands right at the road, no further
        for (const q of Q) if (Math.hypot(x - q.x, z - q.z) < q.r) assert.ok(lim <= hw + 1.01, `${id} sample ${i}: the shoulder runs ${(lim - hw).toFixed(1)} m into a protected place`);
      }
      const race = createRace({ track: T, terrain: W.terrain, seed: 3, laps: 9, players: [{ slot: 0, kart: 'jeep', human: true, name: 'x' }], difficulty: 'medium', countdown: 0 }), s = race.state;
      const STEPS = 240;
      for (const item of ['frana', 'polenta', 'durian']) for (let a = 0; a < STEPS; a++) {
        s.spills.length = 0; s.shots.length = 0;
        // close-up on the road near a protected place: half the points go there
        const near = Q[a % Q.length], nearU = a % 2 ? nearestU(T, near) - ((a / STEPS - 0.5) * 400 + (item === 'polenta' ? 0 : 66)) / T.length : a / STEPS;
        race.teleport(0, ((nearU % 1) + 1) % 1, 0, { speed: 20 });
        const k = s.karts[0];
        k.hitT = 0; k.hitKind = null; k.rescueT = 0; k.safeT = 9; // an animal met on the last stretch is not what this looks at
        race.give(0, item);
        race.step([{ steer: 0, throttle: a % 4 === 1 ? 1 : 0, item: true, drift: false }]);
        for (let f = 0; f < 50; f++) race.step([{ steer: 0, throttle: 0, item: false, drift: false }]);
        race.drainEvents();
        assert.ok(s.spills.length > 0, `${id} ${item}: nothing landed`);
        for (const P of s.spills) for (const q of Q) assert.ok(Math.hypot(P.x - q.x, P.z - q.z) >= q.r + P.r, `${id} ${item} at u ${nearU.toFixed(3)}: landed ${Math.hypot(P.x - q.x, P.z - q.z).toFixed(1)} m from a place of radius ${q.r}`);
      }
    });
  }
  function nearestU(T, q) {
    let best = 1e12, u = 0;
    for (let i = 0; i < T.n; i += 2) { const e = (T.samples.x[i] - q.x) ** 2 + (T.samples.z[i] - q.z) ** 2; if (e < best) { best = e; u = i / T.n; } }
    return u;
  }
});

// ---------- Gran Premio ----------
describe('Gran Premio, through the flow and the sim as main.js wires them', () => {
  const REGIONS = Object.fromEntries(TRACKS.map((t) => [t.id, t.region]));
  const scripted = () => { let v = 0.37; return () => (v = ((v * 9301 + 49297) % 233280) / 233280); };
  const all = POINTS.reduce((a, b) => a + b, 0);
  async function runGp(flow, seed) {
    let races = 0;
    while (flow.phase === 'loading' || flow.phase === 'race') {
      const id = flow.state.track, W = await world(id), field = flow.field();
      flow.loaded();
      const players = field.map((p, i) => ({ slot: p.human ? p.slot : -1, kart: p.kart, human: p.human, name: 'x', i }));
      const race = createRace({ track: W.track, terrain: W.terrain, seed: seed + races, laps: 2, players, difficulty: flow.opts.difficulty, countdown: 0 }), s = race.state;
      const limit = W.long ? 800 : 200;
      for (let f = 0; f < limit / DT && s.phase !== 'done'; f++) { const inp = []; s.karts.forEach((k, i) => { if (k.human) inp[i] = race.autopilot(i); }); race.step(inp); race.drainEvents(); }
      assert.equal(s.phase, 'done', `${id} at 2 laps: not over in ${limit} s`);
      const rows = resultRows(s.karts);
      assert.equal(rows.filter((r) => r.time !== null).length, rows.length, `${id} at 2 laps: every kart home`);
      flow.raceDone(rows);
      races++;
      assert.equal(flow.phase, 'results');
      if (flow.gpMore) assert.ok(flow.next(races % 2 ? 'rematch' : 'track'), 'the next race');
    }
    return races;
  }
  for (const [label, choose, expect] of [
    ['one track chosen: the draw fills it to three, the chosen one first', ['bali'], 3],
    ['two tracks, one of them long', ['antelao', 'jakarta'], 2],
    ['four tracks', ['pelmo', 'batur', 'bali', 'bran'], 4],
    ['every track', TRACK_IDS, TRACK_IDS.length],
  ]) {
    test(`${label}, 2 laps, then rematch and change of track`, async () => {
      const flow = createFlow({ karts: KART_IDS, tracks: TRACK_IDS, regions: REGIONS, rng: scripted() });
      flow.join(0); flow.join(1);
      flow.setOpts({ mode: 'gp', laps: 2, difficulty: 'medium' });
      flow.go();
      flow.pick(0, KART_IDS[0], true); flow.pick(1, KART_IDS[1], true);
      flow.step(1);
      for (const c of choose) flow.gpToggle(c);
      assert.ok(flow.gpStart());
      const list = [...flow.state.gp.tracks];
      assert.equal(list.length, expect);
      assert.equal(list[0], choose[0]);
      assert.equal(new Set(list).size, expect);
      assert.equal(await runGp(flow, 11), expect);
      assert.equal(flow.gpTable().reduce((a, e) => a + e.points, 0), expect * all);
      flow.step(100);
      assert.equal(flow.phase, 'podium');
      assert.equal(flow.top3().length, 3);
      // the whole list again, from an empty table: not its last track on its own
      assert.ok(flow.next('rematch'));
      assert.equal(flow.state.gp.index, 0);
      assert.equal(flow.state.gp.finished, false);
      assert.deepEqual(flow.state.gp.tracks, list);
      assert.deepEqual(Object.keys(flow.state.gp.table), []);
      assert.equal(flow.state.track, list[0]);
      if (expect <= 2) {
        assert.equal(await runGp(flow, 99), expect);
        assert.equal(flow.gpTable().reduce((a, e) => a + e.points, 0), expect * all, 'the second round counts alone');
        flow.step(100);
        assert.ok(flow.next('track'));
        assert.equal(flow.phase, 'vote');
        assert.equal(flow.state.gp, null);
      }
    });
  }
});

// ---------- each root cause, on its own ----------
describe('the throws a stubborn thumb found', () => {
  const pair = async (id = 'bali') => {
    const W = await world(id), race = createRace({ track: W.track, terrain: W.terrain, seed: 8, laps: 9, players: [{ slot: 0, kart: 'jeep', human: true, name: 'a' }, { slot: 1, kart: 'tabia', human: true, name: 'b' }], difficulty: 'medium', countdown: 0 });
    return { W, race };
  };
  const still = { steer: 0, throttle: 0, item: false, drift: false }, press = (throttle = 0) => ({ ...still, item: true, throttle });
  test('mici from first goes back at the chaser, and hits; from behind it still goes ahead', async () => {
    const { race } = await pair(), [a] = race.state.karts;
    race.teleport(0, 0.3, 0); race.teleport(1, 0.3 - 25 / race.internals.track.length, 0);
    const [, c] = race.state.karts; // dead behind it, whatever the road does: the sausage flies straight
    c.x = a.x - Math.sin(a.yaw) * 25; c.z = a.z - Math.cos(a.yaw) * 25; c.y = a.y; c.vx = c.vz = 0;
    race.give(0, 'mici');
    const yaw = a.yaw;
    race.step([press(), still]);
    const S = race.state.shots.find((x) => x.kind === 'mici');
    assert.ok(Math.abs(Math.atan2(Math.sin(S.yaw - yaw), Math.cos(S.yaw - yaw))) > 3, 'it flies backward');
    let hit = false;
    for (let f = 0; f < 120; f++) { race.step([still, still]); for (const e of race.drainEvents()) if (e.type === 'hit' && e.by === 0 && e.kart === 1) hit = true; }
    assert.ok(hit, 'the chaser is hit');
    const b = await pair();
    b.race.teleport(0, 0.3, 0, { speed: 20 }); b.race.teleport(1, 0.3 + 40 / b.race.internals.track.length, 0, { speed: 20 });
    b.race.step([still, still]);
    b.race.give(0, 'mici');
    const y2 = b.race.state.karts[0].yaw;
    b.race.step([press(), still]);
    const T = b.race.state.shots.find((x) => x.kind === 'mici');
    assert.ok(Math.abs(Math.atan2(Math.sin(T.yaw - y2), Math.cos(T.yaw - y2))) < 0.2, 'it flies ahead');
  });
  test('formaggio from first with the stick up goes back all the same: forward it would hit nobody', async () => {
    const { race } = await pair();
    race.teleport(0, 0.3, 0, { speed: 20 }); race.teleport(1, 0.3 - 40 / race.internals.track.length, 0, { speed: 20 });
    race.step([still, still]);
    race.give(0, 'formaggio');
    race.step([press(1), still]);
    assert.equal(race.state.shots.find((x) => x.kind === 'formaggio').dir, -1);
  });
  for (const item of ['polenta', 'durian', 'frana']) {
    test(`${item}: the thrower drives through its own and nothing happens`, async () => {
      const { race } = await pair('bali'), k = race.state.karts[0];
      race.teleport(0, 0.1, 0, { speed: 20 }); race.teleport(1, 0.8, 0);
      race.step([still, still]);
      race.give(0, item);
      race.step([press(1), still]);
      for (let f = 0; f < 120; f++) race.step([still, still]); // landed, and fallen
      race.drainEvents();
      const P = race.state.spills.find((x) => x.owner === 0);
      assert.ok(P, 'it is on the road');
      race.teleport(0, P.i / race.internals.track.n, P.d, { speed: 10 });
      k.x = P.x; k.z = P.z; k.y = P.y;
      for (let f = 0; f < 6; f++) { race.step([still, still]); for (const e of race.drainEvents()) assert.ok(!(e.type === 'hit' && e.kart === 0), `${e.cause} hit its thrower`); }
      assert.equal(k.stinkT, 0);
      assert.equal(k.hitT, 0);
    });
  }
  test('a sausage bounced off a wall flies through its thrower', async () => {
    const { race } = await pair(), s = race.state, k = s.karts[0];
    race.teleport(0, 0.3, 0, { speed: 0 }); race.teleport(1, 0.8, 0);
    race.give(0, 'mici');
    race.step([press(), still]);
    const S = s.shots[0];
    S.bounced = 1; S.x = k.x; S.z = k.z; S.y = k.y + 0.9;
    race.step([still, still]);
    for (const e of race.drainEvents()) assert.ok(!(e.type === 'hit' && e.kart === 0));
  });
});

