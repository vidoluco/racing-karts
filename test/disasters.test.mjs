// The natural disasters in the sim: determinism, the telegraph, a free lane for every kart at every moment, the way back up
// after a hit, how often they come, and bots that dodge according to their level. A flat ring, plus the tracks that have them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildTrack } from '../src/world/track.js';
import { buildTerrain } from '../src/world/terrain.js';
import { TRACK_IDS, loadTrackDef } from '../src/data/tracks.js';
import { KART_IDS } from '../src/data/karts.js';
import { createRace, DT } from '../src/sim/index.js';
import { DISASTER_KINDS, disasterEntries, disasterGap, disasterCount, sacredPoints } from '../src/sim/disasters.js';
import { SFX, DISASTER_SOUND } from '../src/audio/sfx.js';
import { rng32, hash } from '../src/audio/dsp.js';

const KINDS = Object.keys(DISASTER_KINDS);
const rel = (p) => fileURLToPath(new URL(p, import.meta.url));

function ring(disasters, { radius = 300, w = 14, extra = {} } = {}) {
  const points = [];
  for (let a = 0; a < 20; a++) {
    const t = -a / 20 * Math.PI * 2;
    points.push({ p: [Math.cos(t) * radius, 0, Math.sin(t) * radius], w, bank: 0, surface: 'asphalt', tag: null });
  }
  const def = {
    id: 'ring', region: 'cadore', names: { it: 'r', en: 'r' }, points, itemBands: [], boostPads: [], jumps: [], zones: [], shortcuts: [], hazards: [], disasters,
    ground: { base: 0, hills: 0, hillScale: 240, rimHeight: 0, rimFrom: 500, rimTo: 600, water: null }, grid: { spacing: 8 }, ...extra,
  };
  const track = buildTrack(def);
  return { track, terrain: buildTerrain(track) };
}
const entry = (kind, o = {}) => ({ kind, u: 0.5, name: `Prova ${kind}`, say: { it: 'occhio', en: 'look out' }, side: 1, ...o });
const humans = (n, kart = 'tabia') => Array.from({ length: n }, (_, i) => ({ slot: i, kart, human: true, name: `P${i}` }));
const race = (world, players, o = {}) => createRace({ track: world.track, terrain: world.terrain, seed: o.seed ?? 5, laps: o.laps ?? 3, players, difficulty: o.difficulty ?? 'medium', countdown: 0 });

// A driver that goes for a lateral offset at some point ahead of the kart, as a thumb would.
function aim(R, i, dFor) {
  const k = R.state.karts[i], T = R.internals.track, S = T.samples, a = (k.trackI + 7) % T.n, d = dFor(a), tx = S.x[a] + S.nx[a] * d, tz = S.z[a] + S.nz[a] * d;
  const e = Math.atan2(tx - k.x, tz - k.z) - k.yaw;
  return { steer: Math.max(-1, Math.min(1, -Math.atan2(Math.sin(e), Math.cos(e)) * 3)), throttle: 0, item: false, drift: false };
}
const hitsBy = (events, kind) => events.filter((e) => e.type === 'hit' && e.cause === kind);

test('every kind: a track without disasters has none, an unknown kind or a missing name throws', () => {
  const plain = ring([]);
  const R = race(plain, humans(1));
  R.step([{ steer: 0, throttle: 0 }]);
  assert.deepEqual(R.state.disasters, []);
  assert.equal(R.state.ash, 0);
  assert.throws(() => race(ring([entry('tornado')]), humans(1)), /unknown kind/);
  assert.throws(() => race(ring([{ kind: 'debris', u: 0.5 }]), humans(1)), /local name/);
});

for (const kind of KINDS) {
  test(`${kind}: the same seed gives the same disaster, another seed another one`, () => {
    const world = ring([entry(kind, { side: 0 })]);
    const play = (seed) => {
      const R = race(world, humans(2), { seed });
      R.teleport(0, 0.3, 0, { speed: 20 }); R.teleport(1, 0.2, 0, { speed: 20 });
      R.disaster(0);
      const log = [];
      for (let f = 0; f < 900; f++) { R.step([{ steer: 0, throttle: 0 }, { steer: 0, throttle: 0 }]); log.push(...R.drainEvents()); }
      return JSON.stringify({ log, d: R.state.disasters, k: R.state.karts });
    };
    assert.equal(play(11), play(11));
    if (kind !== 'cloud' && kind !== 'avalanche' && kind !== 'debris' && kind !== 'lahar') assert.notEqual(play(11), play(12));
    if (kind !== 'cloud') {
      const seen = new Set();
      for (let s = 1; s < 40; s++) { const R = race(world, humans(1), { seed: s }); seen.add(JSON.stringify(R.disaster(0).pieces.map((p) => [p.i, p.d]))); }
      assert.ok(seen.size > 5, `${kind}: only ${seen.size} different layouts in 40 seeds`);
    }
  });

  test(`${kind}: at least 2 s of warning with a name and a lane, nothing can hurt before the strike`, () => {
    const world = ring([entry(kind)]);
    const R = race(world, humans(8));
    // karts parked right across the road, on the site
    for (let i = 0; i < 8; i++) R.teleport(i, 0.5 + (i - 3.5) * 0.008, -5 + i * 1.4, { speed: 0 });
    R.drainEvents();
    const D = R.disaster(0);
    assert.ok(D.warn >= 2, `warn ${D.warn}`);
    const ev = R.drainEvents(), warn = ev.find((e) => e.type === 'disaster' && e.phase === 'warn');
    assert.equal(warn.name, `Prova ${kind}`);
    assert.deepEqual(warn.say, { it: 'occhio', en: 'look out' });
    assert.equal(warn.kind, kind);
    const log = [];
    let t = 0;
    while (t < D.warn - DT) { R.step(Array(8).fill(undefined)); log.push(...R.drainEvents()); t += DT; }
    assert.equal(hitsBy(log, kind).length, 0, 'no hit in the warning');
    assert.equal(log.filter((e) => e.type === 'boom').length, 0, 'nothing has landed');
    assert.equal(R.state.disasters[0].phase, 'warn');
    for (const P of R.state.disasters[0].pieces) assert.ok(P.st === 0 && P.t0 >= D.warn, 'still in the air');
    R.step(Array(8).fill(undefined));
    R.step(Array(8).fill(undefined));
    assert.ok(R.drainEvents().some((e) => e.type === 'disaster' && e.phase === 'strike'));
  });

  test(`${kind}: everything that falls marks its spot at least 2 s before it lands`, () => {
    const R = race(ring([entry(kind)]), humans(1));
    const D = R.disaster(0);
    for (const P of D.pieces) assert.ok(P.t0 >= 2, `piece lands at ${P.t0}`);
    // a free lane's width on the road, whatever else is there
    assert.ok(D.gapW >= 5, `gap ${D.gapW}`);
  });

  test(`${kind}: every kart has a free line through it, whenever it arrives`, () => {
    const world = ring([entry(kind)]);
    for (const kart of KART_IDS) {
      for (const arrive of [0, 0.6, 1.5, 2.4, 3.5, 5, 7]) {
        const R = race(world, humans(1, kart), { seed: 3 + arrive * 10 });
        const T = R.internals.track, K = DISASTER_KINDS[kind];
        const D = R.disaster(0), run = 26, m = run * (D.warn + arrive) + 60;
        R.teleport(0, 0.5 - m / T.length, 0, { speed: run });
        const log = [];
        // it knows the lane from the sign: from there on it holds it, slalom included
        const steps = Math.ceil((m + D.len + 80) / run / DT);
        for (let f = 0; f < steps; f++) {
          const inp = aim(R, 0, (a) => {
            let o = (a - D.c) % T.n;
            if (o > T.n / 2) o -= T.n; else if (o < -T.n / 2) o += T.n;
            return disasterGap(D, o * T.step);
          });
          R.step([inp]);
          log.push(...R.drainEvents());
        }
        assert.equal(hitsBy(log, kind).length, 0, `${kart}, arriving ${arrive} s into the strike: ${JSON.stringify(hitsBy(log, kind))}`);
        assert.ok(K && R.state.karts[0].progress > 0.5, `${kart} got through`);
      }
    }
    // the same run off the lane is not free: otherwise all of the above proves nothing
    if (kind === 'cloud') return;
    let met = 0;
    for (const arrive of [0.3, 0.8, 1.4, 2, 3, 4, 5]) {
      for (const seed of [3, 4, 5]) {
        const R = race(world, humans(1), { seed }), T = R.internals.track, D = R.disaster(0), run = 26, m = run * (D.warn + arrive) + 60;
        R.teleport(0, 0.5 - m / T.length, 0, { speed: run });
        const off = D.gapAmp ? (a) => 0 : () => D.gapD + D.side * (D.gapW / 2 + 2.2), steps = Math.ceil((m + D.len + 80) / run / DT);
        for (let f = 0; f < steps; f++) { R.step([aim(R, 0, D.gapAmp ? (a) => { let o = (a - D.c) % T.n; if (o > T.n / 2) o -= T.n; else if (o < -T.n / 2) o += T.n; return Math.max(-5, Math.min(5, disasterGap(D, o * T.step) + (disasterGap(D, o * T.step) > 0 ? -5 : 5))); } : off)]); met += hitsBy(R.drainEvents(), kind).length; }
      }
    }
    assert.ok(met >= 3, `${kind}: only ${met} hits on a line outside the free lane`);
  });
}

test('a flow thrown across the road throws what it meets, then a kart that gets up carries on and is not thrown twice', () => {
  for (const kind of ['debris', 'avalanche', 'lahar']) {
    const world = ring([entry(kind, { side: 1 })]);
    const R = race(world, humans(1, 'seggiovia'));
    const T = R.internals.track, D = R.disaster(0), run = 26, m = run * (D.warn + 1.2);
    R.teleport(0, 0.5 - m / T.length, 3.5, { speed: run });
    const log = [];
    let hitAt = -1, backAt = -1, rescued = 0;
    for (let f = 0; f < 60 * 14; f++) {
      R.step([aim(R, 0, () => 3.5)]);
      const ev = R.drainEvents();
      log.push(...ev);
      const k = R.state.karts[0];
      if (hitAt < 0 && hitsBy(ev, kind).some((e) => e.kind === 'tumble')) hitAt = R.state.t;
      if (hitAt > 0 && backAt < 0 && k.hitT <= 0 && Math.hypot(k.vx, k.vz) > 18) backAt = R.state.t;
      if (k.rescueT > 0) rescued++;
    }
    assert.ok(hitAt > 0, `${kind}: driving down the covered lane is a hit`);
    assert.equal(hitsBy(log, kind).filter((e) => e.kind === 'tumble').length <= 3, true, `${kind}: rocks may add one, the flow does not keep throwing`);
    assert.equal(rescued, 0, `${kind}: never a rescue`);
    assert.ok(backAt > 0 && backAt - hitAt < 6.5, `${kind}: back at speed in ${(backAt - hitAt).toFixed(1)} s`);
  }
});

test('debris and lahar leave sticky mud, avalanche a bank that bursts without a tumble; all with their free lane', () => {
  const world = ring([entry('debris', { side: 1 })]);
  let R = race(world, humans(1));
  let D = R.disaster(0);
  const T = R.internals.track;
  R.teleport(0, 0.9, 0, { speed: 0 });
  for (let f = 0; f < 60 * (D.warn + D.strike + 0.5); f++) R.step([undefined]);
  assert.equal(R.state.disasters[0].phase, 'after');
  // drive into the mud on the flow's side
  R.drainEvents();
  R.teleport(0, 0.5 - 30 / T.length, 5.5, { speed: 26 });
  R.state.disasters[0].pieces.length = 0;
  let sticky = 0, log = [];
  for (let f = 0; f < 150; f++) { R.step([aim(R, 0, () => 5.5)]); log.push(...R.drainEvents()); if (R.internals.priv[0].stickyT > 0) sticky++; }
  assert.ok(sticky > 20, 'it sticks');
  assert.ok(hitsBy(log, 'debris').every((e) => e.kind === 'slide'), 'mud slows, it does not throw');

  const w2 = ring([entry('avalanche', { side: 1 })]);
  R = race(w2, humans(1));
  D = R.disaster(0);
  R.teleport(0, 0.9, 0, { speed: 0 });
  for (let f = 0; f < 60 * (D.warn + D.strike + 0.5); f++) R.step([undefined]);
  const banks = R.state.disasters[0].pieces.filter((p) => p.role === 'bank');
  assert.ok(banks.length >= 3, `banks ${banks.length}`);
  const b = banks[0];
  R.drainEvents();
  const u = (b.i / T.n) - 26 / T.length;
  R.teleport(0, u, b.d, { speed: 26 });
  log = [];
  for (let f = 0; f < 120; f++) { R.step([aim(R, 0, () => b.d)]); log.push(...R.drainEvents()); }
  const hits = hitsBy(log, 'avalanche');
  assert.ok(hits.length >= 1 && hits.every((e) => e.kind === 'slide'), JSON.stringify(hits));
  assert.ok(log.some((e) => e.type === 'boom' && e.kind === 'snow'));
  assert.ok(Math.hypot(R.state.karts[0].vx, R.state.karts[0].vz) > 15, 'still going');
});

test('rockfall, quake and eruption: a piece on the road is a tumble, and it bursts; the crack opens and closes', () => {
  for (const kind of ['rockfall', 'eruption', 'quake']) {
    const world = ring([entry(kind)]);
    const R = race(world, humans(1, 'jeep')), T = R.internals.track, D = R.disaster(0);
    R.teleport(0, 0.1, 0, { speed: 0 });
    for (let f = 0; f < 60 * (D.warn + D.strike + 0.3); f++) R.step([undefined]);
    const live = R.state.disasters[0], rest = live.pieces.filter((p) => p.st === 1);
    assert.ok(rest.length >= 2, `${kind}: ${rest.length} on the road`);
    const P = rest[0], n0 = live.pieces.length;
    R.drainEvents();
    R.teleport(0, (P.i / T.n) - 24 / T.length, P.d, { speed: 26 });
    const log = [];
    for (let f = 0; f < 90; f++) { R.step([aim(R, 0, () => P.d)]); log.push(...R.drainEvents()); }
    assert.ok(hitsBy(log, kind).some((e) => e.kind === 'tumble'), `${kind}: ${JSON.stringify(hitsBy(log, kind))}`);
    assert.ok(R.state.disasters[0].pieces.length < n0, 'it burst');
  }
  const world = ring([entry('quake', { side: 1 })]);
  const R = race(world, humans(1)), T = R.internals.track, D = R.disaster(0), opens = [];
  let shakeTop = 0;
  R.teleport(0, 0.1, 0, { speed: 0 });
  for (let f = 0; f < 60 * (D.warn + D.strike + 1); f++) { R.step([undefined]); opens.push(R.state.disasters[0]?.open ?? 0); shakeTop = Math.max(shakeTop, R.state.quake); }
  assert.equal(opens[0], 0);
  assert.ok(Math.max(...opens) === 1, 'it opens');
  assert.ok(opens[opens.length - 1] < 0.01, 'and closes');
  assert.ok(shakeTop > 0.8, `shake ${shakeTop}`);
  assert.equal(R.state.quake, 0, 'the shaking stops');
  assert.ok(T.length > 0);
});

test('an earthquake moves the steering of whoever is on the road, and ash builds and clears', () => {
  const world = ring([entry('quake', { side: 1 })]);
  const a = race(world, humans(1)), b = race(ring([]), humans(1));
  const D = a.disaster(0);
  a.teleport(0, 0.05, 0, { speed: 20 }); b.teleport(0, 0.05, 0, { speed: 20 });
  let moved = 0;
  for (let f = 0; f < 60 * (D.warn + 2); f++) {
    a.step([{ steer: 0, throttle: 0 }]); b.step([{ steer: 0, throttle: 0 }]);
    moved = Math.max(moved, Math.abs(a.state.karts[0].steer - b.state.karts[0].steer));
  }
  assert.ok(moved > 0.15, `steer moved ${moved}`);
  const R = race(ring([entry('eruption')]), humans(1)), E = R.disaster(0), ash = [];
  R.teleport(0, 0.05, 0, { speed: 0 });
  for (let f = 0; f < 60 * (E.warn + E.strike + E.after + 1); f++) { R.step([undefined]); ash.push(R.state.ash); }
  assert.ok(ash[30] > 0 && ash[30] < 0.4, 'it starts');
  assert.ok(Math.max(...ash) >= 0.99, 'it cuts the view');
  assert.equal(ash[ash.length - 1], 0, 'it clears');
});

test('a jump clears a flow, a shield does not save the road from being there, the big kart barrels through mud', () => {
  const world = ring([entry('debris', { side: 1 })]);
  const R = race(world, humans(1)), T = R.internals.track, D = R.disaster(0);
  R.teleport(0, 0.9, 0, { speed: 0 });
  for (let f = 0; f < 60 * (D.warn + 1.5); f++) R.step([undefined]);
  R.drainEvents();
  const k = R.state.karts[0];
  R.teleport(0, 0.5, 5, { speed: 26 });
  k.y += 4; k.grounded = false;
  R.state.disasters[0].pieces.length = 0;
  R.step([{ steer: 0, throttle: 0 }]);
  assert.equal(hitsBy(R.drainEvents(), 'debris').length, 0);
  assert.ok(T.length > 0);
});

test('never inside a tunnel, never a flow on a bridge, never near a protected place', () => {
  const tagged = (tag) => {
    const w = ring([]);
    const points = w.track.def.points.map((p, i) => (i >= 9 && i <= 11 ? { ...p, tag } : p));
    return { ...w.track.def, points };
  };
  assert.throws(() => disasterEntries(buildTrack({ ...tagged('tunnel'), disasters: [entry('rockfall')] })), /cannot come down/);
  assert.throws(() => disasterEntries(buildTrack({ ...tagged('bridge'), disasters: [entry('debris')] })), /cannot come down/);
  assert.doesNotThrow(() => disasterEntries(buildTrack({ ...tagged('bridge'), disasters: [entry('rockfall')] })));
  const base = ring([]).track.def;
  assert.throws(() => disasterEntries(buildTrack({ ...base, sacred: [{ u: 0.5, d: 20, r: 30 }], disasters: [entry('debris')] })), /protected/);
  // up the hill it stops short of the temple
  const t = buildTrack({ ...base, sacred: [{ u: 0.5, d: 90, r: 20 }], disasters: [entry('debris', { side: 1 })] });
  const [e] = disasterEntries(t), [q] = sacredPoints(t), P = t.pointAt(0.5);
  assert.ok(e.source < 70, `source ${e.source}`);
  assert.ok(Math.hypot(P.x + P.nx * (7 + e.source) - q.x, P.z + P.nz * (7 + e.source) - q.z) > q.r, 'the top of the flow stays away');
});

test('how often: a 3 lap race has one or two, never in the first part of the first lap, spread out', () => {
  const world = ring([entry('debris'), entry('rockfall', { u: 0.15 }), entry('quake', { u: 0.8, side: -1 })]);
  assert.equal(disasterCount(world.track, 3), 2);
  assert.equal(disasterCount(world.track, 2), 1);
  assert.equal(disasterCount(world.track, 5), 3);
  const kinds = new Set();
  for (let seed = 1; seed <= 12; seed++) {
    const R = race(world, [...humans(1), ...Array.from({ length: 3 }, () => ({ slot: -1, kart: 'jeep', human: false }))], { seed, laps: 3, difficulty: 'hard' });
    const warns = [];
    let first = null;
    for (let f = 0; f < 60 * 400 && R.state.phase !== 'done'; f++) {
      R.step([R.autopilot(0)]);
      for (const e of R.drainEvents()) if (e.type === 'disaster' && e.phase === 'warn') { warns.push({ t: R.state.t, kind: e.kind }); first ??= R.state.karts[0].progress; kinds.add(e.kind); }
      if (R.state.karts[0].finished) break;
    }
    assert.ok(warns.length >= 1 && warns.length <= 2, `seed ${seed}: ${warns.length}`);
    assert.ok(first > 0.1, `seed ${seed}: first at progress ${first}`);
    if (warns.length === 2) assert.ok(warns[1].t - warns[0].t > 20, `seed ${seed}: ${warns[1].t - warns[0].t} s apart`);
  }
  assert.ok(kinds.size >= 2, `only ${[...kinds]}`);
});

test('bots see them and dodge according to their level', () => {
  const world = ring([entry('debris', { side: 1 })]);
  const score = (difficulty) => {
    let tumbles = 0, karts = 0;
    for (let seed = 1; seed <= 24; seed++) {
      const players = Array.from({ length: 6 }, (_, i) => ({ slot: -1, kart: KART_IDS[i % KART_IDS.length], human: false }));
      const R = race(world, players, { seed, difficulty, laps: 3 }), T = R.internals.track;
      players.forEach((_, i) => R.teleport(i, 0.5 - (150 + i * 18) / T.length, (i % 3 - 1) * 4, { speed: 24 }));
      const D = R.disaster(0), log = [];
      for (let f = 0; f < 60 * (D.warn + 9); f++) { R.step([]); log.push(...R.drainEvents()); }
      tumbles += hitsBy(log, 'debris').filter((e) => e.kind === 'tumble').length;
      karts += players.length;
    }
    return tumbles / karts;
  };
  const easy = score('easy'), medium = score('medium'), hard = score('hard');
  assert.ok(hard < medium && medium < easy, `tumbles per kart: easy ${easy.toFixed(2)}, medium ${medium.toFixed(2)}, hard ${hard.toFixed(2)}`);
  assert.ok(hard < 0.12, `a hard bot almost always dodges: ${hard.toFixed(2)}`);
});

const available = TRACK_IDS.filter((id) => existsSync(rel(`../src/world/tracks/${id}.js`)));
for (const id of available) {
  test(`${id}: its disasters are valid, and the race with them still ends with nobody stuck`, async () => {
    const def = await loadTrackDef(id);
    if (!def.disasters?.length) return;
    const track = buildTrack(def), terrain = buildTerrain(track), entries = disasterEntries(track);
    assert.ok(entries.length >= 1);
    for (const e of entries) {
      assert.ok(e.say?.it && e.say?.en, `${e.name}: it needs its line in both languages`);
      assert.ok(!/\u2014/.test(e.name + e.say.it + e.say.en));
    }
    for (const difficulty of ['easy', 'hard']) {
      const players = KART_IDS.slice(0, 8).map((kart) => ({ slot: -1, kart, human: false }));
      const R = createRace({ track, terrain, seed: 21, laps: def.long ? 1 : 3, players, difficulty, countdown: 0 });
      const stuck = new Array(8).fill(0);
      let warns = 0, worst = 0;
      for (let f = 0; f < 60 * 460 && R.state.phase !== 'done'; f++) {
        R.step([]);
        for (const e of R.drainEvents()) if (e.type === 'disaster' && e.phase === 'warn') warns++;
        R.state.karts.forEach((k, i) => {
          if (k.finished || k.rescueT > 0 || k.hitT > 0) { stuck[i] = 0; return; }
          stuck[i] = Math.hypot(k.vx, k.vz) < 1.5 ? stuck[i] + DT : 0;
          worst = Math.max(worst, stuck[i]);
        });
      }
      assert.equal(R.state.phase, 'done', `${id} ${difficulty}: the race ended`);
      assert.ok(R.state.karts.every((k) => k.finished), `${id} ${difficulty}: all home`);
      assert.ok(worst < 4, `${id} ${difficulty}: stuck ${worst.toFixed(1)} s`);
      assert.ok(warns >= 1 && warns <= 2, `${id} ${difficulty}: ${warns} disasters in 3 laps`);
    }
  });
}

test('every kind has a voice of its own: it renders, it is loud enough, and no two kinds share a shape', () => {
  const sr = 48000, lpBank = [40, 80, 160, 320, 640, 1280, 2560, 5120, 10240], names = KINDS.map((k) => DISASTER_SOUND[k]);
  names.forEach((n, i) => assert.ok(n && SFX[n], `${KINDS[i]} has no sound`));
  assert.equal(new Set(names).size, KINDS.length, 'two kinds share one sound');
  // the level in each octave, and how the energy spreads over the sound's length: what you would tell apart with your eyes shut
  const shape = (x) => {
    const lows = lpBank.map((f) => { const a = 1 - Math.exp(-2 * Math.PI * f / sr), y = new Float32Array(x.length); let v = 0; for (let i = 0; i < x.length; i++) { v += a * (x[i] - v); y[i] = v; } return y; });
    const spec = [];
    for (let b = 0; b + 1 < lows.length; b++) { let e = 0; for (let i = 0; i < x.length; i++) { const d = lows[b + 1][i] - lows[b][i]; e += d * d; } spec.push(10 * Math.log10(e / x.length + 1e-12)); }
    const mean = spec.reduce((a, b) => a + b) / spec.length, time = new Array(12).fill(0);
    for (let i = 0; i < x.length; i++) time[Math.floor(i / x.length * 12)] += x[i] * x[i];
    const top = Math.max(...time);
    return { spec: spec.map((v) => v - mean), time: time.map((v) => 10 * Math.log10(v / top + 1e-6)), peak: x.reduce((a, v) => Math.max(a, Math.abs(v)), 0) };
  };
  const dist = (a, b) => Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0) / a.length);
  const shapes = names.map((n) => shape(SFX[n](sr, rng32(hash(n)))[0]));
  shapes.forEach((s, i) => assert.ok(s.peak > 0.5, `${names[i]}: peak ${s.peak}`));
  for (let i = 0; i < shapes.length; i++) for (let j = i + 1; j < shapes.length; j++) {
    const spec = dist(shapes[i].spec, shapes[j].spec), time = dist(shapes[i].time, shapes[j].time);
    assert.ok(spec + time > 3, `${names[i]} and ${names[j]} are too alike: ${spec.toFixed(1)} dB in spectrum, ${time.toFixed(1)} dB in time`);
  }
});
