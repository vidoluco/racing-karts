// The world contract, on every track that exists so far.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildTrack, SURFACES } from '../src/world/track.js';
import { buildTerrain } from '../src/world/terrain.js';
import { TRACKS, TRACK_IDS, loadTrackDef, trackInfo } from '../src/data/tracks.js';
import { KARTS, KART_IDS } from '../src/data/karts.js';
import { ITEMS, ITEM_IDS, rollItem } from '../src/data/items.js';
import { heroSight } from '../tools/transfagarasan-sight.mjs';

const rel = (p) => fileURLToPath(new URL(p, import.meta.url));
const ids = TRACK_IDS.filter((id) => existsSync(rel(`../src/world/tracks/${id}.js`)));
const worlds = new Map();
for (const id of ids) {
  const def = await loadTrackDef(id), track = buildTrack(def);
  worlds.set(id, { def, track, terrain: buildTerrain(track) });
}
const arc = (i, j, n) => { const a = Math.abs(i - j); return Math.min(a, n - a); };
const hash = (arr) => createHash('sha256').update(Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength)).digest('hex');

test('tracks.js lists the six tracks in order and loads defs lazily', async () => {
  assert.deepEqual(TRACK_IDS.slice(0, 6), ['antelao', 'pelmo', 'transfagarasan', 'bran', 'bromo', 'bali']); // the long tracks of phase 3 follow
  for (const t of TRACKS) {
    assert.ok(t.names.it && t.names.en, t.id);
    assert.ok(['cadore', 'romania', 'indonesia'].includes(t.region), t.id);
  }
  assert.equal(trackInfo('bran').region, 'romania');
  assert.ok(ids.includes('antelao'));
  await assert.rejects(loadTrackDef('nowhere'), /unknown track/);
});

test('esbuild bundles tracks.js with some track files missing', async () => {
  const esbuild = await import('esbuild');
  const r = await esbuild.build({ entryPoints: [rel('../src/data/tracks.js')], bundle: true, format: 'esm', platform: 'neutral', write: false, logLevel: 'silent' });
  assert.equal(r.errors.length, 0);
  assert.ok(r.outputFiles[0].text.includes('Giro dell'));
});

test('karts: nine, stats 1..5 summing to 15, none strictly best', () => {
  assert.equal(KARTS.length, 9);
  assert.equal(new Set(KART_IDS).size, 9);
  const keys = ['speed', 'accel', 'handling', 'weight', 'offroad'];
  for (const k of KARTS) {
    let sum = 0;
    for (const s of keys) {
      assert.ok(k.stats[s] >= 1 && k.stats[s] <= 5, `${k.id}.${s}`);
      sum += k.stats[s];
    }
    assert.equal(sum, 15, k.id);
    assert.ok(k.name && k.driver.name && k.driver.line.it && k.driver.line.en && k.driver.pitch > 0 && /^#/.test(k.color), k.id);
  }
});

test('items: roster, a uniform deterministic roll', () => {
  assert.deepEqual(ITEM_IDS, ['razzo', 'grappa', 'zuica', 'mici', 'uova', 'polenta', 'formaggio', 'durian', 'sambal', 'rendang', 'frana']);
  assert.equal(ITEMS.length, 11);
  const counts = {};
  for (let r = 0; r < 1; r += 1 / 1100) counts[rollItem(r)] = (counts[rollItem(r)] || 0) + 1;
  for (const id of ITEM_IDS) assert.ok(Math.abs(counts[id] - 100) <= 1, `${id}: ${counts[id]}`);
  assert.equal(rollItem(0.42), rollItem(0.42));
  assert.equal(rollItem(0.999999), 'frana');
});

for (const id of ids) {
  const { def, track, terrain } = worlds.get(id), S = track.samples, n = track.n;

  test(`${id}: samples are a closed, uniform loop`, () => {
    assert.ok(Math.abs(track.step - 2) < 0.01, `step ${track.step}`);
    assert.equal(S.x.length, n);
    assert.equal(S.surface.length, n);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, d3 = Math.hypot(S.x[j] - S.x[i], S.y[j] - S.y[i], S.z[j] - S.z[i]);
      assert.ok(Math.abs(d3 - track.step) < 0.1, `gap ${d3} at ${i}`);
      const dot = S.tx[i] * S.tx[j] + S.tz[i] * S.tz[j];
      assert.ok(dot > 0.97, `tangent kink ${dot} at ${i}`);
    }
    const a = track.pointAt(0), b = track.pointAt(1);
    assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 1e-3);
    assert.ok(Math.hypot(a.x - def.points[0].p[0], a.z - def.points[0].p[2]) < 0.5, 'first point on the start line');
  });

  test(`${id}: normal points left, u and i agree`, () => {
    for (let i = 0; i < n; i += 37) {
      assert.ok(Math.abs(Math.hypot(S.tx[i], S.tz[i]) - 1) < 1e-4);
      assert.ok(Math.abs(S.nx[i] - S.tz[i]) < 1e-6 && Math.abs(S.nz[i] + S.tx[i]) < 1e-6);
      const P = track.pointAt(i / n);
      assert.ok(Math.hypot(P.x - S.x[i], P.z - S.z[i]) < 0.01);
    }
  });

  test(`${id}: lap length in range`, () => {
    if (def.long) assert.ok(track.length >= 5000 && track.length <= 10500, `length ${track.length}`);
    else assert.ok(track.length >= 1400 && track.length <= 2200, `length ${track.length}`);
  });

  test(`${id}: no self intersection on the same level, overlaps at least 6 m apart`, () => {
    let crossings = 0;
    for (let i = 0; i < n; i += 2) for (let j = i + 2; j < n; j += 2) {
      if (arc(i, j, n) * track.step < 90) continue;
      const clear = (S.w[i] + S.w[j]) / 2 + 1.5;
      if (Math.hypot(S.x[i] - S.x[j], S.z[i] - S.z[j]) >= clear) continue;
      const dy = Math.abs(S.y[i] - S.y[j]);
      assert.ok(dy >= 6, `same level overlap at u ${(i / n).toFixed(3)} and ${(j / n).toFixed(3)}, dy ${dy.toFixed(1)}`);
      crossings++;
    }
    if (id === 'antelao') assert.ok(crossings > 0, 'the viaduct must cross the SS51');
  });

  test(`${id}: width and turns are drivable`, () => {
    let minR = Infinity;
    for (let i = 0; i < n; i++) {
      const [wMin, wMax] = def.roadRange || [12, 18]; // a city track says so: avenues for lanes of traffic, alleys for motorbikes
      assert.ok(S.w[i] >= wMin - 1e-3 && S.w[i] <= wMax + 1e-3, `width ${S.w[i]} at ${i}`);
      const r = 1 / Math.max(1e-6, Math.abs(track.curvature[i]));
      assert.ok(r > S.w[i] / 2 + 3, `radius ${r} at u ${i / n} folds the inner edge`);
      minR = Math.min(minR, r);
    }
    assert.ok(minR >= 11, `tightest radius ${minR}`);
  });

  test(`${id}: slopes and banks are drivable`, () => {
    const nearJump = (i) => track.jumps.some((j) => arc(i, j.i, n) * track.step < 30);
    for (let i = 0; i < n; i++) {
      const s = Math.abs(S.y[(i + 1) % n] - S.y[i]) / track.step;
      assert.ok(s <= (nearJump(i) ? 0.24 : 0.15), `slope ${(s * 100).toFixed(1)}% at u ${(i / n).toFixed(3)}`);
      assert.ok(Math.abs(S.bank[i]) <= 14, `bank ${S.bank[i]}`);
      assert.ok(SURFACES[S.surface[i]], `surface at ${i}`);
    }
  });

  test(`${id}: bank leans into the turn and heightAt follows it`, () => {
    let checked = 0;
    for (let i = 0; i < n; i++) {
      if (Math.abs(S.bank[i]) < 3) continue;
      const hw = S.w[i] / 2, left = track.heightAt(i, hw), right = track.heightAt(i, -hw);
      assert.equal(left < right, S.bank[i] > 0, `at ${i}`);
      if (Math.abs(track.curvature[i]) > 0.012) assert.equal(Math.sign(S.bank[i]), Math.sign(track.curvature[i]), `sign at ${i}`);
      checked++;
    }
    assert.ok(id !== 'antelao' || checked > 100, `banked samples ${checked}`);
    assert.equal(track.heightAt(5, 0), S.y[5]);
    assert.ok(Math.abs(track.heightAt(5.5, 0) - (S.y[5] + S.y[6]) / 2) < 1e-4, 'fractional i interpolates');
  });

  test(`${id}: nearest finds the road and a hint keeps a kart on its level`, () => {
    for (let i = 0; i < n; i += 3) {
      const d = 3.3, x = S.x[i] + S.nx[i] * d, z = S.z[i] + S.nz[i] * d;
      const r = track.nearest(x, z, i);
      assert.ok(arc(r.i, i, n) <= 1, `hinted ${r.i} vs ${i}`);
      assert.ok(Math.abs(r.d - d) < 0.05, `d ${r.d}`);
      assert.ok(Math.abs(r.u - i / n) < 2 / n || Math.abs(r.u - i / n) > 1 - 2 / n, `u ${r.u} vs ${i / n}`);
      assert.ok(Math.abs(r.f - r.u * n) < 1e-6);
    }
    // driving the whole lap with only the last result as the hint never jumps to another part of the road
    let hint = 0;
    for (let i = 0; i < n * 2; i++) {
      const k = i % n, r = track.nearest(S.x[k], S.z[k], hint);
      assert.ok(arc(r.i, k, n) <= 1, `walked to ${r.i} at ${k}`);
      hint = r.i;
    }
    // the no hint search returns a real sample on the road, one of the levels
    const free = track.nearest(S.x[0] + 1, S.z[0], undefined);
    assert.ok(Math.abs(free.d) < S.w[0] / 2 + 2);
    // a stale hint (a rescue, far away) falls back to the whole lap
    const far = Math.floor(n / 2), lost = track.nearest(S.x[far], S.z[far], 0);
    assert.ok(arc(lost.i, far, n) <= 1 || Math.abs(lost.d) < S.w[far] / 2);
  });

  test(`${id}: bands, pads, jumps`, () => {
    if (def.long) assert.ok(Math.abs(track.bands.length - track.length / 500) <= 3, `${track.bands.length} bands on ${track.length} m`);
    else {
      assert.ok(track.bands.length === 3 || track.bands.length === 4, `${track.bands.length} bands`);
      assert.equal(track.bands.length, def.itemBands.length);
    }
    for (const b of track.bands) {
      assert.equal(b.boxes.length, def.boxesAcross ?? 5);
      const hw = S.w[b.i] / 2;
      for (const q of b.boxes) {
        const r = track.nearest(q.x, q.z, b.i);
        assert.ok(Math.abs(r.d) < hw - 1, `box at ${r.d}`);
        const up = q.y - track.heightAt(r.f, r.d);
        assert.ok(up > 0.5 && up < 2, `box lift ${up}`);
      }
      assert.ok(Math.hypot(b.boxes[0].x - b.boxes[1].x, b.boxes[0].z - b.boxes[1].z) > 2, 'boxes spread across');
    }
    const us = track.bands.map((b) => b.u).sort((a, b) => a - b);
    for (let i = 0; i < us.length; i++) assert.ok(((us[(i + 1) % us.length] - us[i] + 1) % 1) * track.length > (def.long ? 250 : 0.12 * track.length), 'bands spread along the lap');
    for (const p of track.pads) assert.ok(Math.abs(p.d) <= S.w[p.i] / 2 && Number.isFinite(p.yaw));
    for (const j of track.jumps) assert.ok(j.strength > 0 && j.w > 0 && Number.isFinite(j.y));
  });

  test(`${id}: start grid`, () => {
    const G = track.startGrid(8);
    assert.equal(G.length, 8);
    for (let i = 0; i < 8; i++) {
      const g = G[i], r = track.nearest(g.x, g.z, n - 1);
      assert.ok(r.u > 0.9, `behind the line, u ${r.u}`);
      assert.ok(Math.abs(r.d) < S.w[r.i] / 2 - 1, `on the road, d ${r.d}`);
      assert.ok(Math.abs(g.y - track.heightAt(r.f, r.d)) < 0.05);
      const fwd = Math.sin(g.yaw) * S.tx[r.i] + Math.cos(g.yaw) * S.tz[r.i];
      assert.ok(fwd > 0.98, `facing the road, ${fwd}`);
      for (let j = 0; j < i; j++) assert.ok(Math.hypot(g.x - G[j].x, g.z - G[j].z) > 3, `karts ${i} and ${j} apart`);
      if (i) assert.ok(track.nearest(g.x, g.z, n - 1).u <= track.nearest(G[i - 1].x, G[i - 1].z, n - 1).u, 'array order is grid order');
    }
  });

  test(`${id}: racing line stays on the road and is shorter than the middle`, () => {
    const L = track.racingLine;
    let len = 0, widest = 0;
    for (let i = 0; i < n; i++) {
      assert.ok(Math.abs(L.d[i]) <= S.w[i] / 2 - 1, `line off the road at ${i}: ${L.d[i]}`);
      widest = Math.max(widest, Math.abs(L.d[i]));
      const j = (i + 1) % n;
      len += Math.hypot(L.x[j] - L.x[i], L.z[j] - L.z[i]);
      assert.ok(Math.abs(L.k[i]) < 0.09, `line curvature ${L.k[i]}`);
    }
    let mid = 0;
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; mid += Math.hypot(S.x[j] - S.x[i], S.z[j] - S.z[i]); }
    assert.ok(len < mid * 0.985, `line ${len} vs middle ${mid}`);
    assert.ok(widest > Math.min(3, (def.roadRange?.[1] ?? 18) * 0.25), 'the line uses the width'); // a narrow road has less of it to use
  });

  test(`${id}: shortcuts join the road and are worth taking`, () => {
    for (const sc of track.shortcuts) {
      const a = track.pointAt(sc.from), b = track.pointAt(sc.to), s = sc.samples;
      assert.ok(Math.hypot(s.x[0] - a.x, s.z[0] - a.z) < 0.5, 'starts on the road');
      assert.ok(Math.hypot(s.x[sc.n - 1] - b.x, s.z[sc.n - 1] - b.z) < 0.5, 'ends on the road');
      assert.ok(sc.length < ((sc.to - sc.from + 1) % 1) * track.length - 10, 'shorter than the road it skips');
      for (let i = 0; i + 1 < sc.n; i++) {
        const gr = Math.abs(s.y[i + 1] - s.y[i]) / sc.step;
        assert.ok(gr < 0.2, `shortcut slope ${gr}`);
        assert.ok(terrain.heightAt(s.x[i], s.z[i]) <= s.y[i] + 0.02, 'shortcut above ground');
      }
      assert.ok(SURFACES.includes(sc.surface));
      const r = sc.nearest(s.x[10], s.z[10], 10);
      assert.equal(r.i, 10);
      assert.ok(Math.abs(sc.heightAt(10, 0) - s.y[10]) < 1e-5);
      assert.equal(sc.surfaceAt(10), sc.surface);
      assert.ok(sc.pointAt(0.5).w > 0);
    }
    // the main road's progress keeps counting along a shortcut, or a lap through it would not count
    for (const sc of track.shortcuts) {
      let hint = Math.round(sc.from * n), prev = sc.from;
      for (let i = 0; i < sc.n; i += 4) {
        const r = track.nearest(sc.samples.x[i], sc.samples.z[i], hint);
        assert.ok(r.u >= prev - 0.002, `progress went back: ${r.u} after ${prev}`);
        prev = r.u; hint = r.i;
      }
      assert.ok(prev > sc.to - 0.01);
    }
  });

  test(`${id}: the road is above the terrain, the shoulders are level`, () => {
    let under = 0, worst = 0, tested = 0;
    for (let i = 0; i < n; i++) for (let f = 0; f < 2; f++) {
      const fi = i + f / 2, P = track.pointAt(fi / n), hw = P.w / 2;
      for (let d = -hw; d <= hw + 1e-3; d += 1) {
        const x = P.x + P.nx * d, z = P.z + P.nz * d, gap = track.heightAt(fi, d) - terrain.heightAt(x, z);
        tested++;
        if (gap < 0) { under++; worst = Math.min(worst, gap); }
      }
    }
    assert.equal(under, 0, `${under} of ${tested} road points under terrain, worst ${worst.toFixed(2)} m`);
    // 4 m past the edge the ground is still near road level, so a tree free shoulder exists and a kart can use it
    for (let i = 0; i < n; i += 3) {
      if (track.structureAt(i) === 'bridge' || track.structureAt(i) === 'viaduct') continue;
      const hw = S.w[i] / 2;
      for (const side of [-1, 1]) {
        const d = side * (hw + 4), x = S.x[i] + S.nx[i] * d, z = S.z[i] + S.nz[i] * d;
        if (terrain.roadDistAt(x, z) < 3) continue; // another leg of the road is right there
        const drop = terrain.heightAt(x, z) - track.heightAt(i, side * hw);
        assert.ok(drop <= 0.5, `shoulder rises ${drop.toFixed(2)} at u ${(i / n).toFixed(3)}`);
      }
      assert.ok(terrain.roadDistAt(S.x[i], S.z[i]) < 0.5, 'roadDist is zero on the road');
    }
  });

  test(`${id}: decks clear the ground, water stays out from under the wheels`, () => {
    for (let i = 0; i < n; i++) {
      const st = track.structureAt(i);
      if (st === 'bridge' || st === 'viaduct') {
        // the ends rest on their abutments, one grid cell or so of the deck meets the ground there
        if (track.structures.some((q) => arc(i, q.i0, n) < 5 || arc(i, q.i1, n) < 5)) continue;
        assert.ok(S.y[i] - terrain.heightAt(S.x[i], S.z[i]) >= 2.2, `deck clearance at ${i}`);
      } else if (terrain.water !== null) {
        assert.ok(S.y[i] > terrain.water + 2, `road near water at u ${i / n}`);
        assert.ok(terrain.heightAt(S.x[i], S.z[i]) > terrain.water, `road in water at u ${i / n}`);
      }
    }
    if (terrain.river) {
      const R = terrain.river;
      let inside = 0;
      for (let q = 0; q < R.xs.length; q++) {
        const r = track.nearest(R.xs[q], R.zs[q]), near = Math.hypot(R.xs[q] - S.x[r.i], R.zs[q] - S.z[r.i]) < 400;
        if (!near) continue;
        inside++;
        assert.ok(terrain.heightAt(R.xs[q], R.zs[q]) < terrain.water, `river blocked at ${R.xs[q].toFixed(0)}, ${R.zs[q].toFixed(0)}`);
      }
      assert.ok(inside > 50);
    }
  });

  test(`${id}: terrain contract`, () => {
    const G = def.ground;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < n; i++) { minX = Math.min(minX, S.x[i]); maxX = Math.max(maxX, S.x[i]); minZ = Math.min(minZ, S.z[i]); maxZ = Math.max(maxZ, S.z[i]); }
    assert.equal(terrain.step, def.grid.spacing);
    assert.equal(terrain.data.length, terrain.w * terrain.h);
    assert.ok(terrain.x0 <= minX - G.rimTo && terrain.z0 <= minZ - G.rimTo);
    assert.ok(terrain.x0 + (terrain.w - 1) * terrain.step >= maxX + G.rimTo - terrain.step);
    assert.ok(terrain.z0 + (terrain.h - 1) * terrain.step >= maxZ + G.rimTo - terrain.step);
    for (const v of terrain.data) assert.ok(Number.isFinite(v));
    const k = 31 * terrain.w + 44;
    assert.ok(Math.abs(terrain.heightAt(terrain.x0 + 44 * terrain.step, terrain.z0 + 31 * terrain.step) - terrain.data[k]) < 1e-3);
    const m = terrain.normalAt(S.x[0], S.z[0]);
    assert.ok(Math.abs(Math.hypot(m.x, m.y, m.z) - 1) < 1e-6 && m.y > 0.5);
    assert.equal(terrain.water, G.water ?? null);
    // the rim: the corners of the world stand well over the road
    let top = -Infinity;
    for (let i = 0; i < n; i++) top = Math.max(top, S.y[i]);
    const corners = [[0, 0], [terrain.w - 1, 0], [0, terrain.h - 1], [terrain.w - 1, terrain.h - 1]].map(([a, b]) => terrain.data[b * terrain.w + a]);
    // a dug valley (ground.dry) opens at both ends along its axis: two corners may be low
    if (id === 'transfagarasan') {
      // The painted cirque has low sculpted walls on three sides and an open north valley,
      // rather than a raised generic rim. Test the built terrain, not just its shape callback.
      const basin = terrain.heightAt(0, 0);
      for (const [x, z] of [[350, 0], [-500, 0], [0, 240]]) {
        assert.ok(terrain.heightAt(x, z) > basin + 30, `cirque wall missing at ${x},${z}`);
      }
      assert.ok(terrain.heightAt(0, -650) < basin - 30, 'the north valley must fall away');
      // the great wall is the painting: on the start straight the ground stands under it, not in front of it
      for (const u of [0, 0.04, 0.08]) {
        const r = heroSight(def, track, terrain, u);
        assert.ok(r.n > 10 && r.max < 6, `at u ${u} the ground stands ${r.max?.toFixed(1)} deg over the hero's bearings (${r.n} in frame)`);
      }
    } else {
      assert.ok(corners.filter((h) => h > top + 30).length >= (G.dry ? 2 : 3), `rim ${corners.map((h) => h.toFixed(0))} vs top ${top.toFixed(0)}`);
    }
    // no cliff bigger than a cartoon slope near the road, away from the abutments
    let steep = 0, count = 0;
    for (let j = 1; j < terrain.h - 1; j += 3) for (let i = 1; i < terrain.w - 1; i += 3) {
      const q = j * terrain.w + i;
      if (terrain.roadDist[q] >= 100) continue;
      count++;
      const gx = (terrain.data[q + 1] - terrain.data[q - 1]) / (2 * terrain.step), gz = (terrain.data[q + terrain.w] - terrain.data[q - terrain.w]) / (2 * terrain.step);
      if (Math.hypot(gx, gz) > 1.6) steep++;
    }
    assert.ok(steep / count < 0.01, `${steep} of ${count} nodes near the road steeper than 1.6`);
  });

  test(`${id}: terrain builds in under 300 ms`, () => {
    let best = Infinity;
    for (let r = 0; r < 3; r++) {
      const t0 = performance.now();
      buildTerrain(track);
      best = Math.min(best, performance.now() - t0);
    }
    assert.ok(best < 300, `${best.toFixed(0)} ms`);
  });

  test(`${id}: deterministic`, () => {
    const a = buildTrack(def), b = buildTrack(def);
    for (const key of ['x', 'y', 'z', 'tx', 'tz', 'nx', 'nz', 'w', 'bank', 'surface']) assert.equal(hash(a.samples[key]), hash(b.samples[key]), key);
    assert.equal(hash(a.racingLine.d), hash(b.racingLine.d));
    assert.deepEqual(a.startGrid(8), b.startGrid(8));
    assert.equal(hash(buildTerrain(a).data), hash(terrain.data));
  });
}

test('antelao: the design: length, height, levels, set pieces', () => {
  const { track, terrain, def } = worlds.get('antelao'), S = track.samples, n = track.n;
  assert.ok(track.length >= 1800 && track.length <= 2200, `length ${track.length}`);
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < n; i++) { lo = Math.min(lo, S.y[i]); hi = Math.max(hi, S.y[i]); }
  assert.ok(hi - lo >= 50, `height range ${hi - lo}`);
  assert.equal(track.bands.length, 4);
  assert.deepEqual(track.structures.map((s) => s.kind), ['bridge', 'viaduct', 'tunnel']);
  assert.equal(track.markers.filter((m) => m.tag === 'hairpin').length, 3);
  assert.equal(track.jumps.length, 1);
  assert.equal(track.shortcuts.length, 1);
  assert.equal(def.hazards[0].kind, 'cows');
  // the low point is at the stone bridge, the top at the jump, and the river runs under both decks
  const [bridge, viaduct] = track.structures;
  const lowAt = S.y.indexOf(lo) / n;
  assert.ok(lowAt > bridge.from - 0.08 && lowAt < bridge.to + 0.02, `low point at u ${lowAt}`);
  const under = (s) => {
    for (let i = s.i0; i !== s.i1; i = (i + 1) % n) if (terrain.heightAt(S.x[i], S.z[i]) < terrain.water) return true;
    return false;
  };
  assert.ok(under(bridge), 'water under the bridge');
  assert.ok(under(viaduct), 'water under the viaduct');
  // the viaduct really flies over the SS51: walk both levels through the crossing with their hints
  let cross = null;
  for (let i = viaduct.i0; i !== viaduct.i1; i = (i + 1) % n) {
    for (let j = 0; j < bridge.i0; j++) {
      if (Math.hypot(S.x[i] - S.x[j], S.z[i] - S.z[j]) < 3) cross = { i, j };
    }
  }
  assert.ok(cross, 'no crossing found');
  const x = S.x[cross.i], z = S.z[cross.i];
  assert.ok(arc(track.nearest(x, z, cross.i).i, cross.i, n) < 4, 'upper level stays upper');
  assert.ok(arc(track.nearest(x, z, cross.j).i, cross.j, n) < 4, 'lower level stays lower');
  assert.ok(S.y[cross.i] - S.y[cross.j] >= 6, `clearance ${S.y[cross.i] - S.y[cross.j]}`);
  // and the kart under the viaduct is on the ground, not on the deck
  assert.ok(track.heightAt(cross.j, 0) - terrain.heightAt(S.x[cross.j], S.z[cross.j]) < 1);
});

test('world sources stay pure', () => {
  for (const f of ['../src/world/track.js', '../src/world/terrain.js', '../src/data/karts.js', '../src/data/items.js', '../src/data/tracks.js', ...ids.map((id) => `../src/world/tracks/${id}.js`)]) {
    const src = readFileSync(rel(f), 'utf8');
    assert.ok(!/Math\.random|Date\.now|new Date|document\.\w|window\.\w/.test(src), f);
    assert.ok(!src.includes(String.fromCharCode(0x2014)), `${f} has an em dash`);
  }
});
