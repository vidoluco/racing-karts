// Time trial: the sim's option, the ghost's codec and replay, the splits, the records, what the flow does with the mode. Then the
// real path in a browser: a real phone page and the TV from the lobby to the results, twice, against the ghost of the first run,
// and a normal race on the same page with none of it.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildTrack } from '../src/world/track.js';
import { buildTerrain } from '../src/world/terrain.js';
import { createRace, DT } from '../src/sim/index.js';
import { loadTrackDef, TRACK_IDS } from '../src/data/tracks.js';
import { createRecorder, createRecords, createTimeTrial, decodeGhost, ghostPose, sectorsOf, trackSeed, GHOST_EVERY, TT_INDEX, TT_GHOST } from '../src/game/timetrial.js';
import { createFlow, FLOW, padFx } from '../src/game/flow.js';
import { sanitizeOpt } from '../server/room.js';
import { it as IT, en as EN, formatDelta } from '../src/i18n/index.js';
import { launch, headlessShell, buildDist, startServerProcess, openPad, thumbFor } from '../tools/harness.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const KARTS = ['tabia', 'gatto', 'seggiovia', 'mocanita', 'caruta', 'logan', 'jeep', 'becak', 'jukung'];
const memStore = (fail = () => false) => {
  const m = new Map();
  return {
    m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { if (fail(k, v)) throw new Error('quota'); m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
};

let world = null;
async function antelao() {
  if (!world) {
    const track = buildTrack(await loadTrackDef('antelao'));
    world = { track, terrain: buildTerrain(track) };
  }
  return world;
}
const solo = (kart = 'jeep') => [{ slot: 0, kart, human: true, name: 'P1', difficulty: 'ace' }];
const hash = (s) => {
  const text = JSON.stringify(s);
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};

describe('the sim option', () => {
  test('a time trial has no bots of its own to fight: no boxes, no disasters, no contact, and it still counts laps', async () => {
    const { track, terrain } = await antelao();
    const r = createRace({ track, terrain, seed: 5, laps: 1, countdown: 0, timeTrial: true, players: solo() });
    assert.equal(r.state.timeTrial, true);
    assert.equal(r.state.boxes.length, 0);
    const kinds = new Set();
    for (let s = 0; s < 60 * 150 && !r.state.karts[0].finished; s++) {
      r.step([r.autopilot(0)]);
      for (const e of r.drainEvents()) kinds.add(e.type);
    }
    assert.equal(r.state.karts[0].finished, true);
    assert.ok(!kinds.has('boxTake'), 'no crate was taken');
    assert.ok(!kinds.has('disaster'), 'no disaster fired');
    assert.equal(r.state.karts[0].item, null);
    assert.equal(r.state.disasters.length, 0);
  });
  test('two humans drive through each other', async () => {
    const { track, terrain } = await antelao();
    const players = [{ slot: 0, kart: 'jeep', human: true }, { slot: 1, kart: 'tabia', human: true }];
    const r = createRace({ track, terrain, seed: 5, laps: 1, countdown: 0, timeTrial: true, players });
    const crash = (race) => {
      race.teleport(0, 0.1, 0, { speed: 30 });
      race.teleport(1, 0.1 + 7 / track.length, 0, { speed: 2 });
      const out = [];
      for (let s = 0; s < 40; s++) { race.step([{ steer: 0, throttle: 1 }, { steer: 0, throttle: -0.2 }]); out.push(...race.drainEvents().map((e) => e.type)); }
      return out;
    };
    assert.ok(!crash(r).includes('bump'));
    const n = createRace({ track, terrain, seed: 5, laps: 1, countdown: 0, players });
    const normal = crash(n);
    assert.ok(normal.includes('bump'), 'the same two in a normal race do bump');
  });
  test('a normal race is the old race: boxes on the road, the option absent, the same bytes with it spelled false', async () => {
    const { track, terrain } = await antelao();
    const players = [...solo(), { slot: -1, kart: 'tabia', human: false }, { slot: -1, kart: 'gatto', human: false }];
    const a = createRace({ track, terrain, seed: 9, laps: 1, players });
    const b = createRace({ track, terrain, seed: 9, laps: 1, players, timeTrial: false });
    assert.ok(a.state.boxes.length > 0);
    assert.ok(!('timeTrial' in a.state));
    for (let s = 0; s < 900; s++) { a.step([a.autopilot(0)]); b.step([b.autopilot(0)]); }
    assert.equal(hash(a.state), hash(b.state));
  });
});

describe('the ghost', () => {
  test('a record comes back from its text sample by sample, within the quantisation, on every step in between too', async () => {
    const { track, terrain } = await antelao();
    const r = createRace({ track, terrain, seed: 3, laps: 1, countdown: 0, timeTrial: true, players: solo() });
    const rec = createRecorder(), truth = [];
    for (let s = 0; s < 900; s++) {
      r.step([r.autopilot(0)]);
      r.drainEvents();
      const k = r.state.karts[0];
      truth.push({ x: k.x, y: k.y, z: k.z, yaw: k.yaw, speed: k.speed });
      if (s % GHOST_EVERY === 0) rec.add(k);
    }
    const text = JSON.stringify(rec.finish());
    const g = decodeGhost(JSON.parse(text));
    assert.equal(g.n, 150);
    assert.ok(text.length < 900 * 6, `about 3 kB per 15 s of lap, got ${text.length}`);
    let worst = 0, worstYaw = 0;
    for (let s = 0; s < truth.length - GHOST_EVERY; s++) {
      const p = ghostPose(g, s * DT), q = truth[s];
      assert.equal(p.visible, true);
      worst = Math.max(worst, Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z));
      worstYaw = Math.max(worstYaw, Math.abs(Math.atan2(Math.sin(p.yaw - q.yaw), Math.cos(p.yaw - q.yaw))));
    }
    assert.ok(worst < 0.4, `worst position error ${worst.toFixed(3)} m`);
    assert.ok(worstYaw < 0.2, `worst yaw error ${worstYaw.toFixed(3)} rad`);
  });
  test('a replay is a function of the record and the time, and it never touches the sim', async () => {
    const { track, terrain } = await antelao();
    const run = (withTrial) => {
      const records = createRecords(memStore());
      const r = createRace({ track, terrain, seed: 3, laps: 2, countdown: 1, timeTrial: true, players: solo() });
      const tt = withTrial ? createTimeTrial({ track, trackId: 'antelao', laps: 2, karts: [{ i: 0, kart: 'jeep' }], records }) : null;
      const poses = [];
      for (let s = 0; s < 60 * 200 && r.state.phase !== 'done'; s++) {
        r.step([r.autopilot(0)]);
        r.drainEvents();
        if (tt) { tt.step(r.state); const p = tt.poses(0.5)[0]; if (p.visible) poses.push(p.x, p.z, p.yaw); }
      }
      return { state: hash(r.state), poses: hash(poses), count: poses.length, finished: r.state.karts[0].finished };
    };
    const a = run(true), b = run(true), c = run(false);
    assert.equal(a.finished, true);
    assert.ok(a.count > 1000, 'the ghost of the first lap drove the second');
    assert.equal(a.poses, b.poses, 'same run, same replay');
    assert.equal(a.state, c.state, 'the sim steps the same with the clock watching it or not');
  });
  test('bad data is no ghost, not a crash', () => {
    for (const bad of [null, {}, { v: 2 }, { v: 1, n: 5, o: [1], d: 'AAAA' }, { v: 1, n: 3, o: [0, 0, 0, 0, 0, 0, 0, 0], d: '%%%' }, { v: 1, n: 3, o: [0, 0, 0, 0, 0, 0, 0, 0], d: 'AAAA' }]) assert.equal(decodeGhost(bad), null);
  });
  test('past its end a ghost is gone, and a kart lifted far by a stork heals the record', () => {
    const rec = createRecorder();
    const k = { x: 0, y: 0, z: 0, yaw: 3.1, pitch: 0, roll: 0, speed: 0, steer: 0, drift: 1, boostT: 1, grounded: false };
    rec.add(k);
    rec.add({ ...k, x: 400, yaw: -3.1 });
    for (let i = 0; i < 4; i++) rec.add({ ...k, x: 400, yaw: -3.1 });
    const g = decodeGhost(rec.finish());
    assert.equal(ghostPose(g, 99).visible, false);
    const end = ghostPose(g, g.length);
    assert.ok(Math.abs(end.x - 400) < 0.01, `healed to ${end.x}`);
    assert.ok(Math.abs(end.yaw - 3.183) < 0.01, 'yaw is unwrapped: it went the short way');
    assert.equal(end.drift, 1);
    assert.equal(end.boostT, 1);
    assert.equal(end.grounded, false);
  });
});

describe('splits and laps', () => {
  const fakeTrack = (length = 1000, long = false) => ({ length, long });
  const kartAt = (progress, lap, extra = {}) => ({ x: progress * 100, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, speed: 20, steer: 0, drift: 0, boostT: 0, grounded: true, progress, lap, finished: false, lastLapT: 0, finishT: 0, bestLapT: 0, ...extra });
  // drives a lap of `secs`, at an even pace
  function lap(tt, n, secs, laps = 2) {
    const steps = Math.round(secs / DT), events = [];
    for (let s = 1; s <= steps; s++) {
      const p = n + s / steps;
      const closing = s === steps, finished = closing && n + 1 >= laps;
      const k = kartAt(p, closing ? n + 1 : n, { lastLapT: secs, finished, finishT: (n + 1) * secs, bestLapT: secs });
      events.push(...tt.step({ phase: 'race', karts: [k] }));
    }
    return events;
  }
  test('sectors: quarters on a short lap, about one a kilometre on a long one', () => {
    assert.deepEqual(sectorsOf(fakeTrack()), [0.25, 0.5, 0.75]);
    assert.equal(sectorsOf(fakeTrack(9800, true)).length, 9);
  });
  test('the first lap sets the time; the next compares against it at each split and at the line', () => {
    const records = createRecords(memStore());
    const tt = createTimeTrial({ track: fakeTrack(), trackId: 'x', laps: 3, karts: [{ i: 0, kart: 'jeep' }], records });
    tt.step({ phase: 'race', karts: [kartAt(0, 0)] });
    const a = lap(tt, 0, 40, 3);
    assert.deepEqual(a.map((e) => e.type), ['ttSplit', 'ttSplit', 'ttSplit', 'ttLap']);
    assert.equal(a[0].delta, null, 'nothing to compare the first time');
    assert.equal(a[3].record, true);
    assert.equal(a[3].first, true);
    assert.equal(records.best('x', 'jeep').lap, 40);
    assert.equal(records.best('x', 'jeep').splits.length, 3);
    assert.equal(tt.view(0).ghost, true, 'the lap just driven is the ghost of the next');
    const b = lap(tt, 1, 44, 3);
    assert.ok(Math.abs(b[0].delta - 1) < 0.05, `first split ${b[0].delta}`);
    assert.ok(Math.abs(b[3].delta - 4) < 1e-9);
    assert.equal(b[3].record, false);
    assert.equal(records.best('x', 'jeep').lap, 40, 'a slower lap changes nothing');
    const c = lap(tt, 2, 36, 3);
    assert.ok(c[3].delta < 0);
    assert.equal(c[3].record, true);
    assert.equal(records.best('x', 'jeep').lap, 36);
    const f = c.at(-1);
    assert.equal(f.type, 'ttFinish');
    assert.equal(f.record, true);
    assert.equal(records.best('x', 'jeep').totals[3], 108);
    assert.deepEqual(tt.view(0).laps.map((l) => l.time), [40, 44, 36]);
    assert.equal(tt.poses()[0].visible, false, 'at the flag the ghost is done');
  });
  test('a lap a bot drove is no record', () => {
    const records = createRecords(memStore());
    const tt = createTimeTrial({ track: fakeTrack(), trackId: 'x', laps: 1, karts: [{ i: 0, kart: 'jeep' }], records });
    tt.step({ phase: 'race', karts: [kartAt(0, 0)] });
    tt.taint(0);
    const a = lap(tt, 0, 40, 1);
    assert.equal(a.at(-2).record, false);
    assert.equal(a.at(-1).record, false);
    assert.equal(records.best('x', 'jeep'), null);
  });
  test('the clock waits for the countdown', () => {
    const records = createRecords(memStore());
    const tt = createTimeTrial({ track: fakeTrack(), trackId: 'x', laps: 1, karts: [{ i: 0, kart: 'jeep' }], records });
    assert.deepEqual(tt.step({ phase: 'countdown', karts: [kartAt(-0.01, 0)] }), []);
    assert.equal(tt.view(0).lapT, 0);
  });
  test('two drivers on the same kart share the record: a slower first lap does not overwrite a faster one', () => {
    const records = createRecords(memStore());
    const tt = createTimeTrial({ track: fakeTrack(), trackId: 'x', laps: 3, karts: [{ i: 0, kart: 'jeep' }, { i: 1, kart: 'jeep' }], records });
    tt.step({ phase: 'race', karts: [kartAt(0, 0), kartAt(0, 0)] });
    const out = tt.step({ phase: 'race', karts: [kartAt(1, 1, { lastLapT: 30 }), kartAt(1, 1, { lastLapT: 33 })] }).filter((e) => e.type === 'ttLap');
    assert.deepEqual(out.map((e) => e.record), [true, false]);
    assert.ok(Math.abs(out[1].delta - 3) < 1e-9, 'it compares with the lap just set');
    assert.equal(records.best('x', 'jeep').lap, 30);
    assert.equal(tt.view(1).best, 30);
  });
  test('each kart has its own ghost and its own clock', () => {
    const records = createRecords(memStore());
    const tt = createTimeTrial({ track: fakeTrack(), trackId: 'x', laps: 2, karts: [{ i: 0, kart: 'jeep' }, { i: 1, kart: 'tabia' }], records });
    const k0 = kartAt(1, 1, { lastLapT: 30, bestLapT: 30 }), k1 = kartAt(0.3, 0);
    tt.step({ phase: 'race', karts: [kartAt(0, 0), kartAt(0, 0)] });
    tt.step({ phase: 'race', karts: [k0, k1] });
    assert.equal(records.best('x', 'jeep').lap, 30);
    assert.equal(records.best('x', 'tabia'), null);
    assert.equal(tt.view(1).best, null);
  });
});

describe('records', () => {
  const ghost = (n = 3) => { const r = createRecorder(); for (let i = 0; i < n; i++) r.add({ x: i, y: 0, z: 0, yaw: 0 }); return r.finish(); };
  test('per track and kart, the fastest first, and they survive a new page', () => {
    const store = memStore();
    const a = createRecords(store);
    a.saveLap('antelao', 'jeep', { lap: 70, splits: [1, 2, 3], ghost: ghost(), len: 1800 });
    a.saveLap('antelao', 'tabia', { lap: 65, splits: [1, 2, 3], ghost: ghost(), len: 1800 });
    a.saveLap('bali', 'jeep', { lap: 90, splits: [1, 2, 3], ghost: ghost(), len: 2000 });
    a.saveTotal('antelao', 'jeep', 3, 215, 1800);
    const b = createRecords(store);
    assert.deepEqual(b.table('antelao', 1800).map((r) => [r.kart, r.lap]), [['tabia', 65], ['jeep', 70]]);
    assert.equal(b.trackBest('antelao', 1800).kart, 'tabia');
    assert.equal(b.best('antelao', 'jeep', 1800).totals[3], 215);
    assert.equal(b.best('bali', 'tabia', 2000), null);
    assert.ok(decodeGhost(b.ghost('antelao', 'jeep')));
  });
  test('a total only moves when it is better', () => {
    const r = createRecords(memStore());
    r.saveLap('a', 'jeep', { lap: 70, splits: [], ghost: ghost(), len: 100 });
    assert.deepEqual(r.saveTotal('a', 'jeep', 3, 210, 100), { record: true, was: null });
    assert.deepEqual(r.saveTotal('a', 'jeep', 3, 220, 100), { record: false, was: 210 });
    assert.deepEqual(r.saveTotal('a', 'jeep', 5, 400, 100), { record: true, was: null });
  });
  test('a road that changed length forgets its times: an old ghost would drive in the fields', () => {
    const store = memStore();
    const a = createRecords(store);
    a.saveLap('a', 'jeep', { lap: 70, splits: [], ghost: ghost(), len: 1800 });
    assert.ok(a.best('a', 'jeep', 1800.5));
    assert.equal(a.best('a', 'jeep', 1810), null);
    assert.equal(a.table('a', 1810).length, 0);
  });
  test('broken storage, no storage, a full storage: the evening goes on', () => {
    const broken = memStore();
    broken.setItem(TT_INDEX, '{not json');
    assert.equal(createRecords(broken).best('a', 'jeep'), null);
    const none = createRecords(null);
    none.saveLap('a', 'jeep', { lap: 50, splits: [], ghost: ghost(), len: 10 });
    assert.equal(none.best('a', 'jeep').lap, 50);
    assert.ok(none.ghost('a', 'jeep'), 'the ghost stays in memory for this evening');
    const refusing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } };
    const closed = createRecords(refusing);
    closed.saveLap('a', 'jeep', { lap: 50, splits: [], ghost: ghost(), len: 10 });
    assert.equal(closed.best('a', 'jeep').lap, 50);
    // room for one ghost: the older one goes, its time stays
    let t = 0;
    const small = memStore((k, v) => k.startsWith(TT_GHOST) && [...small.m.keys()].some((q) => q.startsWith(TT_GHOST) && q !== k));
    const r = createRecords(small, { now: () => ++t });
    r.saveLap('a', 'jeep', { lap: 50, splits: [], ghost: ghost(), len: 10 });
    r.saveLap('b', 'jeep', { lap: 60, splits: [], ghost: ghost(), len: 10 });
    assert.equal(small.m.has(`${TT_GHOST}a/jeep`), false);
    assert.equal(small.m.has(`${TT_GHOST}b/jeep`), true);
    const after = createRecords(small);
    assert.equal(after.best('a', 'jeep').lap, 50);
    assert.equal(after.best('a', 'jeep').ghost, false);
    assert.equal(after.ghost('a', 'jeep'), null);
  });
  test('the seed of a track is stable and differs by track', () => {
    assert.equal(trackSeed('antelao'), trackSeed('antelao'));
    assert.notEqual(trackSeed('antelao'), trackSeed('pelmo'));
  });
});

test('every track: a lap against the clock with no crate, no disaster, the splits in order and a ghost that replays it', async () => {
  for (const id of TRACK_IDS) {
    const def = await loadTrackDef(id), track = buildTrack(def), terrain = buildTerrain(track), records = createRecords(memStore());
    const r = createRace({ track, terrain, seed: trackSeed(id), laps: 1, countdown: 0, timeTrial: true, players: solo() });
    const tt = createTimeTrial({ track, trackId: id, laps: 1, karts: [{ i: 0, kart: 'jeep' }], records });
    const seen = [];
    for (let s = 0; s < 60 * 900 && !r.state.karts[0].finished; s++) {
      r.step([r.autopilot(0)]);
      for (const e of r.drainEvents()) assert.ok(e.type !== 'boxTake' && e.type !== 'disaster', `${id}: ${e.type}`);
      seen.push(...tt.step(r.state));
    }
    assert.equal(r.state.karts[0].finished, true, `${id} finished`);
    const splits = seen.filter((e) => e.type === 'ttSplit');
    assert.equal(splits.length, tt.sectors.length, `${id} splits`);
    assert.ok(splits.every((e, n) => n === 0 || e.time >= splits[n - 1].time), `${id} in order`);
    assert.equal(seen.at(-1).type, 'ttFinish');
    const best = records.best(id, 'jeep', track.length), g = decodeGhost(records.ghost(id, 'jeep'));
    assert.ok(Math.abs(best.lap - r.state.karts[0].finishT) < 0.05, `${id} lap ${best.lap}`);
    assert.ok(Math.abs(g.length - best.lap) <= 0.2, `${id}: the ghost lasts the lap: ${g.length} of ${best.lap}`);
    const end = ghostPose(g, g.length), S = track.samples;
    assert.ok(Math.hypot(end.x - S.x[0], end.z - S.z[0]) < 12, `${id}: it ends at the line`);
  }
});

describe('the mode in the flow', () => {
  const make = () => createFlow({ karts: KARTS, tracks: ['antelao', 'pelmo'], rng: () => 0.3 });
  const toRace = (f, ...slots) => {
    for (const s of slots) f.join(s);
    f.setOpts({ mode: 'time' });
    f.go();
    for (const s of slots) f.pick(s, KARTS[s], true);
    f.step(FLOW.allReady + 0.01);
    f.forceTrack('antelao');
    f.step(5);
    f.loaded();
  };
  test('the room lets it through, a mode that does not exist it does not', () => {
    assert.deepEqual(sanitizeOpt({ t: 'opt', mode: 'time' }), { mode: 'time' });
    assert.equal(sanitizeOpt({ t: 'opt', mode: 'nope' }), null);
  });
  test('alone on the road however many bots the lobby asks for', () => {
    const f = make();
    f.setOpts({ bots: 7 });
    toRace(f, 0);
    assert.equal(f.phase, 'race');
    assert.deepEqual(f.field().map((p) => p.human), [true]);
  });
  test('two phones: two humans and still no bot', () => {
    const f = make();
    toRace(f, 0, 1);
    assert.deepEqual(f.field().map((p) => p.slot), [0, 1]);
  });
  test('no podium: the results stay until someone chooses, and rematch runs it again', () => {
    const f = make();
    toRace(f, 0);
    const rows = [{ i: 0, slot: 0, kart: KARTS[0], human: true, place: 1, time: 100, bestLap: 30 }];
    f.raceDone(rows);
    assert.equal(f.state.resultsT, 0);
    f.step(FLOW.results + 1);
    assert.equal(f.phase, 'results');
    assert.equal(f.toPodium(), false);
    assert.equal(f.phoneFor(), 'results');
    assert.equal(f.next('rematch'), true);
    assert.equal(f.phase, 'loading');
  });
  test('a normal race still goes to the podium and keeps its bots', () => {
    const f = make();
    f.join(0);
    f.go();
    f.pick(0, KARTS[0], true);
    f.step(FLOW.allReady + 0.01);
    f.forceTrack('antelao');
    f.step(5);
    f.loaded();
    assert.equal(f.field().length, 8);
    f.raceDone(f.state.field.map((p, n) => ({ i: n, slot: p.slot, kart: p.kart, human: p.human, place: n + 1, time: 100 + n, bestLap: 30 })));
    f.step(FLOW.results + 1);
    assert.equal(f.phase, 'podium');
  });
  test('a phone feels a split won and a new record', () => {
    const K = [{ i: 0, slot: 0, human: true }];
    assert.deepEqual(padFx([{ type: 'ttSplit', kart: 0, delta: -0.2 }], K), [{ slot: 0, kind: 'box' }]);
    assert.deepEqual(padFx([{ type: 'ttSplit', kart: 0, delta: 0.2 }], K), []);
    assert.deepEqual(padFx([{ type: 'ttLap', kart: 0, record: true }], K), [{ slot: 0, kind: 'shield' }]);
  });
});

test('words in both languages, and a delta with its sign', () => {
  const keys = Object.keys(IT).filter((k) => k.startsWith('tt.') || k === 'lobby.time');
  assert.ok(keys.length > 8);
  for (const k of keys) assert.ok(EN[k], `${k} in English`);
  assert.equal(formatDelta('it', -0.314), '-0,31');
  assert.equal(formatDelta('en', 1.5), '+1.50');
  assert.equal(formatDelta('en', 65.25), '+1:05.25');
  assert.equal(formatDelta('en', null), '');
});

// ---------- the real path ----------
const hasBrowser = !!headlessShell();
const touch = (p, type, points) => p.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
const lastRow = (tv) => tv.evaluate(() => window.__game.results?.[0] ?? null);

test('from the lobby to the results by phone, twice: a time, a ghost that drives, splits on the TV, a record that stays; then a normal race with none of it', { skip: !hasBrowser && 'no browser', timeout: 420000 }, async (t) => {
  const dist = mkdtempSync(join(tmpdir(), 'rk-tt-'));
  await buildDist(dist);
  const srv = await startServerProcess({ dist });
  const browser = await launch('metal');
  t.after(async () => { await browser.close(); await srv.close(); rmSync(dist, { recursive: true, force: true }); });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'it-IT' });
  const tv = await ctx.newPage();
  const errors = [];
  tv.on('pageerror', (e) => errors.push(e.message));
  await tv.goto(`${srv.base}/?lang=it`);
  await tv.waitForFunction(() => window.__game?.ready || window.__game?.error, null, { timeout: 120000 });
  assert.equal(await tv.evaluate(() => window.__game.error), null);
  const phone = await openPad(browser, srv.base, { label: 'tt', locale: 'it-IT' });
  t.after(() => phone.ctx.close().catch(() => {}));
  const tvIs = (ph, ms = 150000) => tv.waitForFunction((q) => window.__game.phase === q || window.__game.error, ph, { timeout: ms });
  const padIs = (ph, ms = 20000) => phone.page.waitForFunction((q) => window.__pad.phase === q, ph, { timeout: ms });
  const tap = (sel) => phone.page.locator(sel).tap();

  async function chooseTrial() {
    await padIs('lobby');
    await tv.waitForFunction(() => window.__game.seats[0]?.present, null, { timeout: 20000 });
    await tap('.seg[data-key="mode"] button[data-v="time"]');
    await tv.waitForFunction(() => window.__game.flowApi.opts.mode === 'time', null, { timeout: 5000 });
    await tv.waitForFunction(() => document.querySelector('.lobby .chips[data-key="mode"] .chip[data-v="time"]').classList.contains('on'), null, { timeout: 5000 });
    await tv.waitForFunction(() => document.querySelector('.lobby .lb').parentElement.classList.contains('off'), null, { timeout: 5000 });
    await tap('.seg[data-key="laps"] button[data-v="2"]');
    await tv.waitForFunction(() => window.__game.flowApi.opts.laps === 2, null, { timeout: 5000 });
  }
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
  // the stick by touch for a while: the phone drives this kart, and nothing is in the way of it
  async function byTouch(ms) {
    const start = thumbFor(phone.geo, 0, 0);
    await touch(phone, 'touchStart', [{ ...start, id: 1 }]);
    const begun = Date.now();
    while (Date.now() - begun < ms) {
      const want = await tv.evaluate(() => window.__game.botInput(0));
      await touch(phone, 'touchMove', [{ ...thumbFor(phone.geo, want.x, Math.min(0, want.y)), id: 1 }]);
      await sleep(50);
    }
    await touch(phone, 'touchEnd', []);
  }
  const roadFacts = () => tv.evaluate(() => {
    const g = window.__game, s = g.state, q = (c) => document.querySelector(`.hudscr ${c}`);
    return { karts: s.karts.length, boxes: s.boxes.length, tt: s.timeTrial, trial: !!g.tt, clock: !!q('.ttclock'), hv: q('.hv').classList.contains('tt'), crate: getComputedStyle(q('.crate')).display, place: getComputedStyle(q('.plc')).display, ghost: g.tt?.view(0).ghost ?? null, models: g.renderer.ghostStats().count, ref: q('.ttref span')?.textContent };
  });

  // ---------- the first run: nothing to chase ----------
  await chooseTrial();
  await toTheRoad();
  let road = await roadFacts();
  assert.equal(road.karts, 1, 'alone on the road, though the lobby says seven bots');
  assert.equal(road.boxes, 0, 'no crates');
  assert.equal(road.tt, true);
  assert.equal(road.clock, true, 'the clock is on the TV');
  assert.equal(road.crate, 'none');
  assert.equal(road.place, 'none');
  assert.equal(road.ghost, false, 'no ghost yet');
  assert.equal(road.ref, 'Nessun tempo: stabiliscilo tu!');
  await phone.page.waitForFunction(() => document.body.classList.contains('tt'), null, { timeout: 8000 });
  assert.equal(await phone.page.evaluate(() => getComputedStyle(document.getElementById('item')).visibility), 'hidden', 'nothing to throw');
  const u0 = await tv.evaluate(() => window.__game.state.karts[0].progress);
  await byTouch(5000);
  const moved = await tv.evaluate(() => { const k = window.__game.state.karts[0]; return { p: k.progress, clock: document.querySelector('.hudscr .ttclock b').textContent }; });
  assert.ok(moved.p > u0 + 0.01, `the phone drove it: ${u0} to ${moved.p}`);
  assert.match(moved.clock, /^0:0\d,\d\d$/, 'the clock runs, in Italian');
  await tv.evaluate(() => { const g = window.__game; g.setScript((i) => g.drive(i)); g.speed = 6; });
  await tv.waitForFunction(() => document.querySelector('.hudscr .ttsplit b')?.textContent, null, { timeout: 60000 });
  const firstSplit = await tv.evaluate(() => ({ what: document.querySelector('.hudscr .ttsplit small').textContent, delta: document.querySelector('.hudscr .ttsplit i').textContent }));
  assert.match(firstSplit.what, /^Settore \d di 4$/);
  assert.equal(firstSplit.delta, '', 'nothing to compare the first time');
  // the lap just driven is at once the ghost of the next
  await tv.waitForFunction(() => window.__game.tt?.view(0).laps.length >= 1, null, { timeout: 120000 });
  await tv.waitForFunction(() => window.__game.renderer.ghostStats().visible === 1, null, { timeout: 8000 });
  await tvIs('results');
  await padIs('results');
  const one = await tv.evaluate(() => ({ rows: window.__game.results, screen: !!document.querySelector('.results.tt'), podium: !!document.querySelector('.results button[data-a="podium"]'), table: document.querySelectorAll('.results .grows .rrow').length, news: document.querySelector('.results .ttnew').textContent, stored: JSON.parse(localStorage.getItem('racing-karts.tt.v1')), ghost: Object.keys(localStorage).filter((k) => k.startsWith('racing-karts.tt.ghost')) }));
  assert.equal(one.rows.length, 1);
  assert.equal(one.screen, true);
  assert.equal(one.podium, false, 'no podium for one driver');
  assert.equal(one.table, 1, 'the records of the track');
  assert.equal(one.news, 'Primo tempo!');
  const kart = one.rows[0].kart, best1 = one.stored.antelao[kart].lap;
  assert.ok(best1 > 20 && best1 < 200, `a real lap: ${best1}`);
  assert.ok(Math.abs(one.stored.antelao[kart].totals[2] - one.rows[0].time) < 1e-6, 'the total is stored');
  assert.equal(one.stored.antelao[kart].splits.length, 3);
  assert.deepEqual(one.ghost, [`racing-karts.tt.ghost.v1.antelao/${kart}`]);
  // the time on the phone instead of a place, and no podium however long the screen stays
  await phone.page.waitForFunction(() => /^\d:\d\d[.,]\d\d$/.test(document.getElementById('resPlace').textContent), null, { timeout: 5000 });
  assert.match(await phone.page.evaluate(() => document.getElementById("resTime").textContent), /record/i);
  assert.equal(await tv.evaluate(() => window.__game.flowApi.state.resultsT), 0);
  await sleep(1500);
  assert.equal(await tv.evaluate(() => window.__game.phase), 'results');

  // ---------- a new page: the record and the ghost came from the storage ----------
  await tv.reload();
  await tv.waitForFunction(() => window.__game?.ready || window.__game?.error, null, { timeout: 120000 });
  await phone.page.waitForFunction(() => window.__pad.phase === 'lobby', null, { timeout: 30000 });
  await chooseTrial();
  await tap('#goBtn');
  await tvIs('pick', 8000);
  await padIs('pick');
  await sleep(350);
  await phone.page.evaluate((id) => window.__pad.carousel.show?.(id), kart);
  await sleep(150);
  await tap('#readyBtn');
  await tvIs('vote', 8000);
  await tv.waitForFunction((want) => document.querySelector('.vote .tc[data-id="antelao"] .tb')?.textContent === want, `Il tuo record: ${await tv.evaluate((v) => { const m = Math.floor(v / 60); const c = Math.round(v * 100) % 6000; return `${m}:${String(Math.floor(c / 100)).padStart(2, '0')},${String(c % 100).padStart(2, '0')}`; }, best1)}`, { timeout: 5000 });
  await padIs('vote');
  await sleep(350);
  await phone.page.evaluate(() => window.__pad.carousel.show?.('antelao'));
  await sleep(150);
  await tap('#voteBtn');
  await tvIs('race');
  await tv.waitForFunction(() => window.__game.state, null, { timeout: 120000 });
  await tv.evaluate(() => window.__game.skipFlyover());
  await tv.waitForFunction(() => window.__game.state?.phase === 'race', null, { timeout: 30000 });
  road = await roadFacts();
  assert.equal(road.ghost, true, 'the ghost is back from the storage');
  assert.equal(road.models, 1);
  assert.match(road.ref, /^Record \d:\d\d,\d\d$/);
  await byTouch(1500);
  // it drives by itself, and it is not in the sim
  const g0 = await tv.evaluate(() => { const g = window.__game; return { ...g.renderer.ghostStats(), karts: g.state.karts.length }; });
  await sleep(1000);
  const g1 = await tv.evaluate(() => window.__game.renderer.ghostStats());
  assert.equal(g0.visible, 1);
  assert.equal(g0.karts, 1);
  assert.ok(Math.hypot(g1.x - g0.x, g1.z - g0.z) > 5, `the ghost drives: ${JSON.stringify([g0, g1])}`);
  await tv.evaluate(() => { const g = window.__game; g.setScript((i) => g.drive(i)); g.speed = 6; });
  await tv.waitForFunction(() => /^[+-]\d/.test(document.querySelector('.hudscr .ttsplit i')?.textContent || ''), null, { timeout: 60000 });
  await phone.page.waitForFunction(() => /^[+-]\d/.test(document.getElementById('place').textContent), null, { timeout: 8000 });
  await tvIs('results');
  const two = await tv.evaluate(() => ({ rows: window.__game.results, stored: JSON.parse(localStorage.getItem('racing-karts.tt.v1')) }));
  assert.equal(two.rows[0].kart, kart);
  assert.ok(two.stored.antelao[kart].lap <= best1 + 1e-6, 'the record never gets worse');
  assert.ok(two.rows[0].tt.laps.every((l) => Number.isFinite(l.delta) || l.n === 1), 'each lap against the record');

  // ---------- rematch from the phone: same road, same record ----------
  await padIs('results');
  await phone.page.waitForFunction(() => window.__pad.menu.advance && !document.getElementById('resNext').classList.contains('held'), null, { timeout: 5000 });
  await tap('#resNext');
  await tv.waitForFunction(() => window.__game.phase === 'race' && window.__game.tt?.view(0).ghost, null, { timeout: 120000 });

  // ---------- the negative: the same page, a normal race, nothing of the mode anywhere ----------
  await tv.evaluate(() => { window.__game.flowApi.quit(); });
  await padIs('lobby');
  await tap('.seg[data-key="mode"] button[data-v="race"]');
  await tv.waitForFunction(() => window.__game.flowApi.opts.mode === 'race', null, { timeout: 5000 });
  await toTheRoad();
  road = await roadFacts();
  assert.equal(road.karts, 8, 'the field is back');
  assert.ok(road.boxes > 0, 'the crates are back');
  assert.equal(road.tt, undefined);
  assert.equal(road.trial, false);
  assert.equal(road.clock, false);
  assert.equal(road.hv, false);
  assert.notEqual(road.crate, 'none');
  assert.notEqual(road.place, 'none');
  assert.equal(road.models, 0, 'no ghost model');
  await tv.evaluate(() => { const g = window.__game; g.setScript((i) => g.drive(i)); g.speed = 8; });
  await phone.page.waitForFunction(() => !document.body.classList.contains('tt') && document.getElementById('hud') && !document.getElementById('place').classList.contains('ahead'), null, { timeout: 8000 });
  await tvIs('results', 200000);
  const end = await tv.evaluate(() => ({ screen: !!document.querySelector('.results.tt'), podium: !!document.querySelector('.results button[data-a="podium"]'), count: window.__game.flowApi.state.resultsT, rows: window.__game.results.length, tt: window.__game.results.some((r) => r.tt) }));
  assert.equal(end.screen, false);
  assert.equal(end.podium, true, 'a race has its podium');
  assert.ok(end.count > 0, 'and goes there by itself');
  assert.equal(end.rows, 8);
  assert.equal(end.tt, false);
  await padIs('results');
  await phone.page.waitForFunction(() => /\d/.test(document.getElementById('resPlace').textContent) && /[°a-z]/.test(document.getElementById('resPlace').textContent), null, { timeout: 8000 });
  assert.deepEqual(errors, []);
  assert.deepEqual(phone.errors, []);
});

test('the keyboard alone: the chip on the TV, a run, and a key at the results is a rematch, never a dead end', { skip: !hasBrowser && 'no browser', timeout: 240000 }, async (t) => {
  const dist = mkdtempSync(join(tmpdir(), 'rk-tt-kb-'));
  await buildDist(dist);
  const srv = await startServerProcess({ dist });
  const browser = await launch('metal');
  t.after(async () => { await browser.close(); await srv.close(); rmSync(dist, { recursive: true, force: true }); });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'en-US' });
  const tv = await ctx.newPage();
  const errors = [];
  tv.on('pageerror', (e) => errors.push(e.message));
  await tv.goto(`${srv.base}/?lang=en`);
  await tv.waitForFunction(() => window.__game?.ready || window.__game?.error, null, { timeout: 120000 });
  const tvIs = (ph, ms = 150000) => tv.waitForFunction((q) => window.__game.phase === q || window.__game.error, ph, { timeout: ms });
  await tv.locator('.lobby .chip[data-v="time"]').click();
  await tv.locator('.lobby .chip[data-v="2"]').click();
  assert.equal(await tv.evaluate(() => window.__game.flowApi.opts.mode), 'time');
  await tv.locator('.lobby .gobtn').click();
  await tvIs('pick', 8000);
  await sleep(700);
  await tv.keyboard.press('KeyE', { delay: 40 });
  await tvIs('vote', 8000);
  await sleep(700);
  await tv.keyboard.press('KeyE', { delay: 40 });
  await tvIs('race');
  await tv.waitForFunction(() => window.__game.state, null, { timeout: 120000 });
  await tv.evaluate(() => { const g = window.__game; g.skipFlyover(); g.setScript((i) => g.drive(i)); g.speed = 8; });
  await tvIs('results');
  assert.equal(await tv.evaluate(() => document.querySelector('.results .tbar h1').textContent), 'Time trial');
  await sleep(700);
  await tv.keyboard.press('KeyE', { delay: 40 });
  await tv.waitForFunction(() => window.__game.phase === 'loading' || window.__game.phase === 'race', null, { timeout: 8000 });
  await tvIs('race');
  await tv.waitForFunction(() => window.__game.tt?.view(0).ghost, null, { timeout: 60000 });
  assert.deepEqual(errors, []);
});
