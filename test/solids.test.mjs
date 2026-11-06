// The buildings are solid. Every structure a kart can reach blocks it at any speed from any side, the road and the shortcuts stay
// open, the bots do not notice, and the footprints in src/world/solids are what the renderer's own landmarks build today.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack } from '../src/world/track.js';
import { buildTerrain } from '../src/world/terrain.js';
import { createRace } from '../src/sim/index.js';
import { solidPush, solidsFor } from '../src/sim/solids.js';
import { wallPush } from '../src/sim/kart.js';
import { SOLID } from '../src/sim/tuning.js';
import { KART_IDS } from '../src/data/karts.js';
import { TRACK_IDS, loadTrackDef } from '../src/data/tracks.js';
import { extractSolids, solidsSource } from '../tools/bake-solids.mjs';

const worlds = new Map();
const worldOf = async (id) => {
  if (!worlds.has(id)) { const def = await loadTrackDef(id), track = buildTrack(def); worlds.set(id, { def, track, terrain: buildTerrain(track) }); }
  return worlds.get(id);
};
const field = (seed) => Array.from({ length: 8 }, (_, i) => ({ kart: KART_IDS[(i + seed) % KART_IDS.length] }));

for (const id of TRACK_IDS) {
  test(`${id}: the baked footprints are what the landmarks build`, async () => {
    const { def } = await worldOf(id), res = await extractSolids(id);
    assert.ok(res.rows.length > 0, 'something stands by the road');
    // run tools/bake-solids.mjs after moving a building
    assert.equal(solidsSource(id, res.rows), solidsSource(id, def.solids));
  });

  test(`${id}: the road, the shortcuts and the grid stay open`, async () => {
    const { track, terrain } = await worldOf(id), S = solidsFor(track), T = track.samples;
    assert.ok(S, 'the track has solids');
    for (let i = 0; i < track.n; i++) {
      const hw = T.w[i] / 2 - 0.5;
      for (const d of [0, hw / 2, -hw / 2, hw, -hw]) {
        const x = T.x[i] + T.nx[i] * d, z = T.z[i] + T.nz[i] * d;
        assert.equal(solidPush(S, x, track.heightAt(i, d), z), null, `road at sample ${i}, d ${d}`);
      }
      const q = track.racingLine;
      assert.equal(solidPush(S, q.x[i], track.heightAt(i, q.d[i]), q.z[i]), null, `line at sample ${i}`);
    }
    for (const sc of track.shortcuts) for (let i = 0; i < sc.n; i++) {
      const hw = sc.samples.w[i] / 2 + 0.5;
      for (const d of [0, hw, -hw]) assert.equal(solidPush(S, sc.samples.x[i] + sc.samples.nx[i] * d, sc.heightAt(i, Math.max(-hw, Math.min(hw, d))), sc.samples.z[i] + sc.samples.nz[i] * d), null, `shortcut ${sc.index} at sample ${i}, d ${d}`);
    }
    for (const g of track.startGrid(8)) assert.equal(solidPush(S, g.x, g.y, g.z), null, 'a grid slot');
    void terrain;
  });

  test(`${id}: flat out at every building from all sides, a kart never ends inside and is never stopped for good`, async () => {
    const { def, track, terrain } = await worldOf(id);
    const race = createRace({ track, terrain, seed: 5, laps: 99, players: [{ kart: 'tabia', human: true }], countdown: 0, timeTrial: true });
    const s = race.state, R = race.internals, k = s.karts[0], p = R.priv[0], S = R.solids, rows = def.solids;
    let shots = 0, contacts = 0, walls = 0, dead = 0, top = 0, fetched = 0;
    const touched = new Set();
    for (let b = 0; b < rows.length; b++) {
      const [bx, bz, hu, hv] = rows[b], from = Math.hypot(hu, hv) + 13;
      for (let a = 0; a < 6; a++) {
        const ang = a * Math.PI / 3 + b * 0.37, x = bx + Math.cos(ang) * from, z = bz + Math.sin(ang) * from, loc = track.nearest(x, z);
        const gy = Math.abs(loc.d) <= track.samples.w[loc.i] / 2 ? track.heightAt(loc.f, loc.d) : terrain.heightAt(x, z);
        if (wallPush(R, x, z, loc.f) || solidPush(S, x, gy, z) || gy < rows[b][5] || gy > rows[b][6]) continue;
        race.teleport(0, loc.u, loc.d, { speed: 0, lap: 1 });
        k.x = x; k.z = z; k.y = gy; k.hitT = 0; k.rescueT = 0; p.resc = null; k.bigT = 0; k.grounded = true; k.vy = 0; k.pitch = 0; k.roll = 0;
        p.ground = gy; p.lastGoodF = loc.f; p.solidAt = -1e9; p.markT = s.t; p.markP = k.progress; p.markX = x; p.markZ = z; p.freeX = x; p.freeZ = z;
        const yaw = Math.atan2(bx - x, bz - z), v = 52; // past any boost: the top speed of the fastest kart with the best item on
        k.yaw = yaw; k.vx = Math.sin(yaw) * v; k.vz = Math.cos(yaw) * v; k.speed = v; k.boostT = 3; k.boostKind = 'grappa'; p.boostMul = 1.42;
        race.drainEvents();
        shots++;
        let hitAt = -1, moved = false, x0 = 0, z0 = 0;
        for (let step = 0; step < 300; step++) {
          race.step([{ steer: 0, throttle: 1, drift: false, item: false }]);
          if (k.rescueT > 0) { fetched++; moved = true; break; }
          assert.equal(solidPush(S, k.x, k.y, k.z, k.x, k.z, SOLID.margin - 0.02), null, `${id} box ${b} angle ${a} step ${step}: at ${k.x.toFixed(2)}, ${k.z.toFixed(2)}, y ${k.y.toFixed(2)}`);
          top = Math.max(top, Math.hypot(k.vx, k.vz));
          if (hitAt < 0 && solidPush(S, k.x, k.y, k.z, k.x, k.z, SOLID.margin + 0.05)) { hitAt = step; x0 = k.x; z0 = k.z; contacts++; touched.add(S.hit.box); if (R.events.some((e) => e.type === 'wall')) walls++; }
          if (hitAt >= 0 && Math.hypot(k.x - x0, k.z - z0) > 6) { moved = true; break; }
          if (hitAt < 0 && step > 90) break; // something else took it elsewhere: this angle never got there
        }
        if (hitAt >= 0 && !moved) {
          // pressing on still: the stick and the reverse gear get it out, or the fetch does
          for (let step = 0; step < 420 && !moved; step++) {
            race.step([step < 90 ? { steer: 0.5, throttle: -1 } : race.autopilot(0)]);
            if (k.rescueT > 0 || Math.hypot(k.x - x0, k.z - z0) > 6) moved = true;
          }
          if (!moved) dead++;
        }
        race.drainEvents();
        p.boostMul = 1; k.boostT = 0; k.boostKind = null;
      }
    }
    assert.equal(dead, 0, `${dead} karts stayed where they hit`);
    assert.ok(top > 30, 'they did come at speed');
    assert.ok(contacts > rows.length * 0.25, `${id}: ${contacts} contacts over ${shots} shots at ${rows.length} boxes`);
    assert.ok(walls > 0, 'a building fires the same feedback as a wall');
    console.log(`# ${id}: ${rows.length} boxes, ${touched.size} touched, ${shots} shots, ${contacts} contacts, ${walls} with a wall event, ${fetched} fetched, top ${top.toFixed(1)} m/s`);
  });

  test(`${id}: all bots race as before, with nobody stuck`, async () => {
    const { def, track, terrain } = await worldOf(id);
    const bare = buildTrack({ ...def, solids: [] }), bareT = buildTerrain(bare), laps = track.long ? 1 : 3;
    const race = (T, W, seed) => {
      const r = createRace({ track: T, terrain: W, seed, laps, players: field(seed), difficulty: 'hard', countdown: 0 });
      let stuck = 0;
      while (r.state.phase !== 'done' && r.state.t < 900) {
        r.step([]); r.drainEvents();
        for (const k of r.state.karts) { stuck = Math.max(stuck, r.internals.priv[k.i].stillT); if (r.internals.solids && k.rescueT <= 0) assert.equal(solidPush(r.internals.solids, k.x, k.y, k.z, k.x, k.z, SOLID.margin - 0.02), null, `a bot inside at ${k.x}, ${k.z}`); }
      }
      return { lap: r.state.karts.map((k) => k.bestLapT).filter(Boolean), done: r.state.karts.filter((k) => k.finished).length, stuck };
    };
    const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length, before = [], after = [];
    // one race of eight is chaos, three seconds either way on the same road: the comparison is over several
    for (const seed of track.long ? [2, 3] : [1, 2, 3, 5, 7, 8]) {
      const a = race(bare, bareT, seed), b = race(track, terrain, seed);
      assert.equal(b.done, 8, `seed ${seed}: every bot finishes`);
      assert.ok(b.stuck < 3, `seed ${seed}: stuck for ${b.stuck.toFixed(1)} s`);
      before.push(mean(a.lap)); after.push(mean(b.lap));
    }
    const ratio = mean(after) / mean(before);
    assert.ok(ratio < 1.03 && ratio > 0.97, `${id}: laps ${mean(before).toFixed(2)} s before, ${mean(after).toFixed(2)} s after`);
  });
}

test('the bundle carries the footprints', async () => {
  const esbuild = await import('esbuild'), { def } = await worldOf('bran');
  const r = await esbuild.build({ entryPoints: [new URL('../src/data/tracks.js', import.meta.url).pathname], bundle: true, format: 'esm', platform: 'neutral', write: false, logLevel: 'silent' });
  assert.ok(r.outputFiles[0].text.includes(String(def.solids[0][0])), 'a dynamic import the bundler can follow, as for the tracks');
});

test('a kart on a road above what stands below drives over it', async () => {
  // Bran's arch crosses its market: anything standing under the deck is a level down
  const { track } = await worldOf('bran'), S = solidsFor(track), T = track.samples;
  for (let i = 0; i < track.n; i++) {
    if (!T.struct[i]) continue;
    for (const d of [-3, 0, 3]) assert.equal(solidPush(S, T.x[i] + T.nx[i] * d, track.heightAt(i, d), T.z[i] + T.nz[i] * d), null, `deck at sample ${i}`);
  }
});

test('hitting a building says wall to the feedback and nothing about what it hit', async () => {
  const { def, track, terrain } = await worldOf('bran');
  const race = createRace({ track, terrain, seed: 3, laps: 9, players: [{ kart: 'tabia', human: true }], countdown: 0, timeTrial: true });
  const k = race.state.karts[0], S = race.internals.solids;
  // a house on the market street, from the road, at speed
  const rows = def.solids.map((r, b) => ({ r, b, loc: track.nearest(r[0], r[1]) })).filter((q) => Math.abs(q.loc.d) < 14 && q.r[2] > 1.5 && q.r[3] > 1.5 && q.r[6] - q.r[5] > 4 && !track.structureAt(q.loc.i));
  assert.ok(rows.length, 'a building near the road');
  let seen = null;
  for (const q of rows) {
    const d = q.loc.d > 0 ? 1 : -1;
    race.teleport(0, q.loc.u, d, { speed: 0, lap: 1 });
    const yaw = Math.atan2(q.r[0] - k.x, q.r[1] - k.z);
    k.yaw = yaw; k.vx = Math.sin(yaw) * 30; k.vz = Math.cos(yaw) * 30; k.hitT = 0; race.internals.priv[0].wallCd = 0;
    race.drainEvents();
    for (let i = 0; i < 40 && !seen; i++) { race.step([{ steer: 0, throttle: 1 }]); seen = race.drainEvents().find((e) => e.type === 'wall'); }
    if (seen) break;
  }
  assert.ok(seen, 'a wall event');
  assert.deepEqual(Object.keys(seen).sort(), ['force', 'kart', 'type'], 'no building, no name, no damage in it');
  assert.equal(solidPush(S, k.x, k.y, k.z, k.x, k.z, SOLID.margin - 0.02), null);
});

test('the count of hits tells a barrier from a building, and only the count does', async () => {
  const { def, track, terrain } = await worldOf('bran');
  const fresh = () => createRace({ track, terrain, seed: 3, laps: 9, players: [{ kart: 'tabia', human: true }], countdown: 0, timeTrial: true });
  // barriers and no buildings: a kart weaving at full throttle, every hit a barrier
  const barriers = fresh();
  barriers.internals.solids = null;
  let wall = 0, building = 0;
  for (let n = 0; n < 3600; n++) {
    barriers.step([{ steer: Math.sin(n / 40) > 0 ? 1 : -1, throttle: 1 }]);
    for (const e of barriers.drainEvents()) if (e.type === 'wall') { if (barriers.internals.priv[0].wallSolid) building++; else wall++; }
  }
  assert.ok(wall > 0, 'it did hit barriers');
  assert.equal(building, 0, `${building} barrier hits counted as buildings`);
  // buildings and no barriers, from the road, at speed, square on and at a slant: every hit a building, by both ways off one
  const solids = fresh(), k = solids.state.karts[0], p = solids.internals.priv[0];
  solids.internals.walls = null;
  const rows = def.solids.map((r) => ({ r, loc: track.nearest(r[0], r[1]) })).filter((q) => Math.abs(q.loc.d) < 14 && q.r[2] > 1.5 && q.r[3] > 1.5 && q.r[6] - q.r[5] > 4 && !track.structureAt(q.loc.i));
  const seen = { true: 0, false: 0 };
  for (const q of rows) {
    for (const slant of [0, 0.5, -0.5]) {
      solids.teleport(0, q.loc.u, q.loc.d > 0 ? 1 : -1, { lap: 1 });
      const yaw = Math.atan2(q.r[0] - k.x, q.r[1] - k.z) + slant;
      k.yaw = yaw; k.vx = Math.sin(yaw) * 30; k.vz = Math.cos(yaw) * 30; k.hitT = 0; p.wallCd = 0;
      solids.drainEvents();
      for (let i = 0; i < 40; i++) {
        p.wallSolid = false; // so that each event has to say it again, and none lives off the one before
        solids.step([{ steer: 0, throttle: 1 }]);
        for (const e of solids.drainEvents()) if (e.type === 'wall') seen[!!p.wallSolid]++;
      }
    }
  }
  assert.ok(seen.true > 0, 'it did hit buildings');
  assert.equal(seen.false, 0, `${seen.false} building hits counted as barriers`);
  console.log(`# barriers ${wall}, buildings ${seen.true}`);
});
