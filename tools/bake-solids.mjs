#!/usr/bin/env node
// What stands by the road and cannot be driven through. The renderer's landmark modules stay the one source of where a
// building is: this tool runs their own plan and build with no browser, reads the geometry they hand to the batch and to
// world.staticGroup, and takes the slice a kart would run into, from just above the ground to the height of its roof, on the
// ground a kart can actually reach. What is left is cut into oriented boxes and written to src/world/solids/<id>.js, which the
// sim reads and the renderer never does. test/solids.test.mjs extracts again and fails if a landmark moved without a new bake.
//   node tools/bake-solids.mjs [--track bran] [--png dir] [--audit]
// No window, no three in the sim, nothing rendered moves.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { wallsFor, wallPush } from '../src/sim/kart.js';
import { SOLID } from '../src/sim/tuning.js';

const CELL = 0.5;            // m, the raster the geometry falls on
const BAND = [0.35, 2.2];    // m above the ground under a kart: what a kart's body would meet
const STEEP = 0.72;          // |normal.y| over this is a floor or a roof, never something to run into
const MIN_TOP = 2.05;        // m above the ground: a structure stands higher than this. A fence, a plinth or a kerb does not
const MIN_AREA = 3.5;        // m2 of footprint: a post, a lamp or a sign has less
const PILLAR = [1.5, 0.9];   // m2 and m: less footprint, but a mass at least this wide all round, a gate's pier or a shrine and not a post, is a structure too
const CLOSE = 1.0;           // m: parts this close are one thing, a kart does not fit between them
const REACH_MARGIN = 2.5;    // m: a footprint this close to where a kart can be counts as reachable
const LEVEL_GAP = 3;         // m between two levels of ground at one spot, a crossing
const EXTRA = 9;             // m of ground kept past the barrier, so that the footprint of what stands on it is whole
const MAX_HOLE = 2500;       // m2: a wall round more than this is a yard, not a building
const OWN_MASONRY = 1.6;     // m more that a bridge's own masonry keeps off a lane
// a tunnel's gallery in road.js is not one of them: its portal is boxed to the edge, and the barrier is brought in to its margin
const GALLERY = (() => { const t = readFileSync(fileURLToPath(new URL('../src/render/road.js', import.meta.url)), 'utf8').split('\n'), a = t.findIndex((l) => /^function gallery\(/.test(l)) + 1; let b = t.findIndex((l, i) => i >= a && /^(export )?function /.test(l)); if (b < 0) b = t.length; return [a, b]; })();
const deckMasonry = (src) => { const m = /^road\.js:(\d+)$/.exec(src); return !!m && !(+m[1] >= GALLERY[0] && +m[1] <= GALLERY[1]); };
const PAD = 0.05;             // m of slack on the margin when a box is checked against the centres of lane cells
const SHORTCUT_CLEAR = 1;    // m past a shortcut's edge: a bot takes one at speed and cuts inside its bends, and a legal way through stays one
const LANE_IN = 1.5;         // m inside the road's edge: no box, grown by a kart's margin, ever reaches further onto a road. A house whose front stands on the road's edge holds a kart's centre this far in, as a deck's parapet does, and the racing line, 1.8 m in, stays clear

// What the eye takes for soft or light, by the words on the line of the landmark module that adds it: hay gives way, a cart is a prop. The brief: trees, signs and small props stay as they are.
const SOFT = {
  all: /hayRack|woodPile|cow\.clone|box\(w \+ 0\.2, h \+ 0\.18, 0\.14\)/,
  bran: /capita|caruta|logStack|bush\(|sheep/,
  bromo: /hardtop|ponyGeometry|casu\[/,
  bali: /tufts/,
  jakarta: /ondel|crowds/,
  batur: /bambooClump/,
};

// ---------- a browser, as much of one as the landmark modules ask for ----------
function stubBrowser() {
  if (globalThis.document) return;
  const gradient = { addColorStop() {} };
  const ctx = (cv) => new Proxy({}, {
    get(_, k) {
      if (k === 'canvas') return cv;
      if (k === 'measureText') return () => ({ width: 10 });
      if (k === 'createImageData' || k === 'getImageData') return (a = 1, b = 1, w = a, h = b) => ({ data: new Uint8ClampedArray(4 * Math.max(1, w) * Math.max(1, h)), width: w, height: h });
      if (k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern' || k === 'createConicGradient') return () => gradient;
      return () => {};
    },
    set() { return true; },
  });
  const canvas = () => { const cv = { width: 1, height: 1, style: {}, addEventListener() {}, removeEventListener() {}, toDataURL: () => '' }; const c = ctx(cv); cv.getContext = () => c; return cv; };
  globalThis.document = { createElement: canvas, createElementNS: canvas };
  globalThis.window ??= globalThis;
  globalThis.Image ??= class { addEventListener() {} removeEventListener() {} set src(v) {} };
}

// The same order as loadTrack in src/render/index.js, up to what stands in the world. buildJumpRamps stays out: bales and boards are props.
export async function buildScenery(id) {
  stubBrowser();
  const THREE = await import('three');
  const { buildTrack } = await import('../src/world/track.js');
  const { buildTerrain } = await import('../src/world/terrain.js');
  const { loadTrackDef } = await import('../src/data/tracks.js');
  const { createMat, createShared, resolveLook, setLook } = await import('../src/render/toon.js');
  const { buildGround, createForest } = await import('../src/render/terrain.js');
  const { buildRoad, buildStructures } = await import('../src/render/road.js');
  const { createBatch } = await import('../src/render/props.js');
  const { planDisasters } = await import('../src/render/disasters.js');
  const shapes = await import('../src/render/shapes.js');
  // the barrier as it stands with no buildings: where a kart could get to is what decides which of them are solid
  const def = { ...(await loadTrackDef(id)), solids: [] }, track = buildTrack(def), terrain = buildTerrain(track);
  const look = resolveLook(def), shared = createShared(look);
  setLook(shared, look);
  const mat = createMat(shared);
  const world = { track, terrain, look, def, keepOut: [], groves: [], plant: [], casters: [], blobs: [], staticGroup: new THREE.Group(), backdropBase: 'assets/backdrops/' };
  const batch = track.long ? createBatch(320) : createBatch(), add0 = batch.add, parts = [];
  world.batch = batch;
  const origin = () => (new Error().stack.split('\n').find((l) => /landmarks\/|render\/road\.js/.test(l))?.match(/(\w+\.js):(\d+)/) ?? []).slice(1, 3).join(':');
  const lines = new Map(), textOf = (from) => {
    const [file, line] = from.split(':');
    if (!file) return '';
    if (!lines.has(file)) lines.set(file, readFileSync(fileURLToPath(new URL(`../src/render/${file === 'road.js' ? '' : 'landmarks/'}${file}`, import.meta.url)), 'utf8').split('\n'));
    return lines.get(file).slice(Math.max(0, +line - 4), +line).join('\n'); // and the lines just before: a generic B.add takes its meaning from them
  };
  batch.add = (g, o) => { const from = origin(), text = textOf(from); if (!SOFT.all.test(text) && !SOFT[id]?.test(text)) parts.push({ g, from }); return add0(g, o); };
  const ctx = { THREE, track, terrain, look, batch, mat, shapes, world };
  const land = await import(`../src/render/landmarks/${id}.js`);
  land.plan?.(ctx);
  planDisasters(world);
  world.forestOf = createForest(look, world);
  world.ground = buildGround(track, terrain, look, mat, world.forestOf, world);
  world.road = buildRoad(track, look, shared);
  land.build?.(ctx);
  buildStructures(track, world, batch, look, mat);
  world.staticGroup.updateMatrixWorld(true);
  world.staticGroup.traverse((o) => { if (o.isMesh && !o.material?.transparent) parts.push({ g: o.geometry, matrix: o.matrixWorld.clone(), mesh: o, from: 'staticGroup' }); });
  return { THREE, track, terrain, world, parts, def };
}

// ---------- where a kart can be: every 0.5 m cell near the road, with the height of the ground under a kart there ----------
function createField(track, terrain) {
  const walls = wallsFor(track, terrain), R = { track, walls }, S = track.samples, n = track.n;
  const heads = new Map(), N = { cell: [], next: [], y: [], flags: [], depth: [] }, edges = new Map(); // edges: the true line where each strip's lane ends, by 2 m bucket
  const key = (ix, iz) => (ix + 40000) * 100000 + (iz + 40000);
  const REACH = 1, ROAD = 2, LANE = 4, SOLID = 8;
  const nodeAt = (ix, iz, y) => {
    const c = key(ix, iz);
    let q = heads.get(c);
    while (q !== undefined && q >= 0) {
      if (Math.abs(N.y[q] - y) < LEVEL_GAP) return q;
      q = N.next[q];
    }
    const id = N.y.length;
    N.cell.push(c); N.y.push(y); N.flags.push(0); N.depth.push(-1); N.next.push(heads.get(c) ?? -1);
    heads.set(c, id);
    return id;
  };
  const DL = CELL * 0.6, SUB = 8;
  // one strip across a road, out from (x, z) along the normal; reach(x, z, e): may a kart stand there?
  const across = (x0, z0, nx, nz, side, hw, out, level, reach, lane = hw - LANE_IN) => {
    { const ex = x0 + nx * side * lane, ez = z0 + nz * side * lane, k = `${Math.floor(ex / 2)},${Math.floor(ez / 2)}`; let b = edges.get(k); if (!b) edges.set(k, (b = [])); b.push(ex, ez, level(side * Math.min(lane, hw))); }
    for (let e = 0; e <= out + EXTRA; e += DL) {
      const x = x0 + nx * side * e, z = z0 + nz * side * e, on = e <= hw, y = on ? level(side * e) : terrain.heightAt(x, z), q = nodeAt(Math.floor(x / CELL), Math.floor(z / CELL), y);
      // a cell is road or lane by where its centre stands, not by any point of it: the checks below then measure from true positions, and a
      // house front at the road's edge keeps a box instead of losing a raster's worth of slack on every side
      if (e <= Math.max(hw, lane) + CELL) {
        const dc = Math.abs(((Math.floor(x / CELL) + 0.5) * CELL - x0) * nx + ((Math.floor(z / CELL) + 0.5) * CELL - z0) * nz);
        if (dc <= hw) { N.flags[q] |= ROAD; if (hw - dc > N.depth[q]) N.depth[q] = hw - dc; } // depth: m inside the road's edge, on this level
        if (dc <= lane) N.flags[q] |= LANE;
      }
      if (!(N.flags[q] & REACH) && reach(x, z, e)) N.flags[q] |= REACH;
    }
  };
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    for (let t = 0; t < SUB; t++) {
      const f = t / SUB, fi = i + f, mix = (A) => A[i] + (A[j] - A[i]) * f, hw = mix(S.w) / 2;
      let nx = mix(S.nx), nz = mix(S.nz);
      const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
      for (const side of [1, -1]) {
        const lim = Math.max(side > 0 ? walls.left[i] : walls.right[i], side > 0 ? walls.left[j] : walls.right[j]);
        across(mix(S.x), mix(S.z), nx, nz, side, hw, lim, (d) => track.heightAt(fi, d), (x, z) => !wallPush(R, x, z, i));
      }
    }
  }
  for (const sc of track.shortcuts) {
    const SC = sc.samples;
    for (let i = 0; i + 1 < sc.n; i++) {
      for (let t = 0; t < SUB; t++) {
        const f = t / SUB, fi = i + f, mix = (A) => A[i] + (A[i + 1] - A[i]) * f, hw = mix(SC.w) / 2;
        let nx = mix(SC.nx), nz = mix(SC.nz);
        const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
        for (const side of [1, -1]) across(mix(SC.x), mix(SC.z), nx, nz, side, hw, hw + 2, (d) => sc.heightAt(fi, d), (x, z, e) => e <= hw + 2, hw + SHORTCUT_CLEAR);
      }
    }
  }
  // Does B, grown by pad, take in a point of a lane's true edge between heights lo and hi? The lane cells are tested by their centres; this is
  // what keeps a box's corner from slipping between two centres onto the lane.
  const edgeIn = (B, pad, lo, hi) => {
    const r = Math.hypot(B.hu, B.hv) + pad;
    for (let a = Math.floor((B.x - r) / 2); a <= Math.floor((B.x + r) / 2); a++) for (let b = Math.floor((B.z - r) / 2); b <= Math.floor((B.z + r) / 2); b++) {
      const P = edges.get(`${a},${b}`);
      if (P) for (let i = 0; i < P.length; i += 3) {
        if (P[i + 2] < lo || P[i + 2] > hi) continue;
        const dx = P[i] - B.x, dz = P[i + 1] - B.z;
        if (Math.abs(dx * B.ux + dz * B.uz) < B.hu + pad && Math.abs(-dx * B.uz + dz * B.ux) < B.hv + pad) return true;
      }
    }
    return false;
  };
  return { heads, N, key, REACH, ROAD, LANE, SOLID, edgeIn };
}

// ---------- the geometry falls on the field ----------
function rasterize(F, scene) {
  const { THREE, parts } = scene, { heads, N, key, SOLID } = F;
  const coarse = new Set();
  for (const c of heads.keys()) { const ix = Math.floor(c / 100000) - 40000, iz = c % 100000 - 40000; coarse.add(`${ix >> 5},${iz >> 5}`); }
  const top = new Float32Array(N.y.length).fill(-1e9), from = new Map();
  const v = new THREE.Vector3(), M = new THREE.Matrix4(), IM = new THREE.Matrix4();
  // a floor or a roof is nothing to run into, but over a counter it says how high the thing stands
  const hit = (x, y, z, src, flat) => {
    const c = key(Math.floor(x / CELL), Math.floor(z / CELL));
    let q = heads.get(c);
    while (q !== undefined && q >= 0) {
      const h = y - N.y[q];
      if (h >= BAND[0]) {
        if (h <= BAND[1] && !flat) { N.flags[q] |= SOLID; if (!from.has(q)) from.set(q, src); }
        if (y > top[q]) top[q] = y;
      }
      q = N.next[q];
    }
  };
  const tri = (ax, ay, az, bx, by, bz, cx, cy, cz, src) => {
    const ux = bx - ax, uy = by - ay, uz = bz - az, wx = cx - ax, wy = cy - ay, wz = cz - az;
    const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx, l = Math.hypot(nx, ny, nz);
    if (l < 1e-7) return;
    const flat = Math.abs(ny) / l > STEEP;
    const x0 = Math.floor(Math.min(ax, bx, cx) / CELL) >> 5, x1 = Math.floor(Math.max(ax, bx, cx) / CELL) >> 5, z0 = Math.floor(Math.min(az, bz, cz) / CELL) >> 5, z1 = Math.floor(Math.max(az, bz, cz) / CELL) >> 5;
    let near = false;
    for (let i = x0; i <= x1 && !near; i++) for (let j = z0; j <= z1; j++) if (coarse.has(`${i},${j}`)) { near = true; break; }
    if (!near) return;
    const e = Math.max(Math.hypot(ux, uy, uz), Math.hypot(wx, wy, wz), Math.hypot(cx - bx, cy - by, cz - bz)), steps = Math.min(1200, Math.ceil(e / (CELL * 0.5)));
    for (let i = 0; i <= steps; i++) for (let j = 0; j <= steps - i; j++) {
      const s = i / steps, t = j / steps;
      hit(ax + ux * s + wx * t, ay + uy * s + wy * t, az + uz * s + wz * t, src, flat);
    }
  };
  const run = (g, m, src) => {
    const P = g.attributes.position;
    if (!P) return;
    const idx = g.index, count = idx ? idx.count : P.count, A = [0, 0, 0], B = [0, 0, 0], C = [0, 0, 0];
    const get = (i, out) => { const k = idx ? idx.getX(i) : i; v.fromBufferAttribute(P, k); if (m) v.applyMatrix4(m); out[0] = v.x; out[1] = v.y; out[2] = v.z; };
    for (let i = 0; i + 2 < count; i += 3) { get(i, A); get(i + 1, B); get(i + 2, C); tri(A[0], A[1], A[2], B[0], B[1], B[2], C[0], C[1], C[2], src); }
  };
  for (const p of parts) {
    if (p.mesh?.isInstancedMesh) {
      for (let i = 0; i < p.mesh.count; i++) { p.mesh.getMatrixAt(i, IM); M.multiplyMatrices(p.matrix, IM); run(p.g, M, p.from); }
    } else run(p.g, p.matrix ?? null, p.from);
  }
  return { top, from };
}

// ---------- one box round a set of cells ----------
function fitBox(cells) {
  const pts = [];
  for (const [x, z] of cells) pts.push([x, z], [x + CELL, z], [x, z + CELL], [x + CELL, z + CELL]);
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), hull = [];
  for (const p of pts) { while (hull.length >= 2 && cross(hull[hull.length - 2], hull[hull.length - 1], p) <= 0) hull.pop(); hull.push(p); }
  const low = hull.length + 1;
  for (let i = pts.length - 2; i >= 0; i--) { const p = pts[i]; while (hull.length >= low && cross(hull[hull.length - 2], hull[hull.length - 1], p) <= 0) hull.pop(); hull.push(p); }
  hull.pop();
  let best = null;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i], b = hull[(i + 1) % hull.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, ux = (b[0] - a[0]) / l, uz = (b[1] - a[1]) / l;
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const p of hull) { const u = p[0] * ux + p[1] * uz, w = -p[0] * uz + p[1] * ux; if (u < u0) u0 = u; if (u > u1) u1 = u; if (w < v0) v0 = w; if (w > v1) v1 = w; }
    const area = (u1 - u0) * (v1 - v0);
    if (!best || area < best.area - 1e-6) best = { area, ux, uz, u0, u1, v0, v1 };
  }
  const { ux, uz, u0, u1, v0, v1 } = best, cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
  return { x: cu * ux - cv * uz, z: cu * uz + cv * ux, hu: (u1 - u0) / 2, hv: (v1 - v0) / 2, ux, uz, area: best.area };
}
const coordsIn = (B, x, z) => { const dx = x - B.x, dz = z - B.z; return [dx * B.ux + dz * B.uz, -dx * B.uz + dz * B.ux]; };

// Cut a set of cells into boxes that follow its shape; a box may never reach onto a driving lane.
function carve(cells, onLane, out, depth = 0) {
  if (!cells.length) return;
  const B = fitBox(cells), fill = cells.length * CELL * CELL / B.area, lane = onLane(B);
  if (!lane && (fill >= 0.6 || B.area <= 18 || depth > 12)) { out.push({ ...B, cells }); return; }
  if (cells.length < 3 || depth > 12) { if (!lane) out.push({ ...B, cells }); return; }
  // along the long side, at the widest gap in the cells or else in the middle
  const axis = B.hu >= B.hv ? 0 : 1, vals = cells.map(([x, z]) => coordsIn(B, x + CELL / 2, z + CELL / 2)[axis]).sort((a, b) => a - b);
  let cut = vals[vals.length >> 1], gap = 0;
  for (let i = Math.floor(vals.length * 0.15); i < vals.length * 0.85; i++) { const g = vals[i + 1] - vals[i]; if (g > gap && g > CELL * 1.2) { gap = g; cut = (vals[i] + vals[i + 1]) / 2; } }
  const a = [], b = [];
  for (const c of cells) (coordsIn(B, c[0] + CELL / 2, c[1] + CELL / 2)[axis] < cut ? a : b).push(c);
  if (!a.length || !b.length) { if (!lane) out.push({ ...B, cells }); return; }
  carve(a, onLane, out, depth + 1); carve(b, onLane, out, depth + 1);
}

// ---------- from the raster to labelled things to boxes ----------
export async function extractSolids(id, { margin = SOLID.margin, scene = null } = {}) {
  scene ??= await buildScenery(id);
  const { track, terrain, world } = scene, F = createField(track, terrain), { heads, N, key, REACH, LANE, SOLID: HIT } = F;
  const { top, from } = rasterize(F, scene);
  const ixOf = (c) => Math.floor(c / 100000) - 40000, izOf = (c) => c % 100000 - 40000;
  const nodesAt = (ix, iz, fn) => { let q = heads.get(key(ix, iz)); while (q !== undefined && q >= 0) { fn(q); q = N.next[q]; } };
  // the road and the shortcuts stay open at any cost: nothing there is solid, on that level. And what is lower than a kart's roof is no wall
  const lanes = [];
  for (let q = 0; q < N.y.length; q++) {
    if ((N.flags[q] & HIT) && top[q] < N.y[q] + MIN_TOP) N.flags[q] &= ~HIT;
    if (N.flags[q] & F.ROAD) { if (N.flags[q] & HIT) lanes.push(q); N.flags[q] &= ~HIT; }
  }
  // label: solid nodes joined over gaps of CLOSE, on the same level
  const rad = Math.ceil(CLOSE / CELL), label = new Int32Array(N.y.length).fill(-1), groups = [];
  for (let s = 0; s < N.y.length; s++) {
    if (!(N.flags[s] & HIT) || label[s] >= 0) continue;
    const g = groups.length, stack = [s], list = [];
    label[s] = g;
    while (stack.length) {
      const q = stack.pop(), ix = ixOf(N.cell[q]), iz = izOf(N.cell[q]);
      list.push(q);
      for (let a = -rad; a <= rad; a++) for (let b = -rad; b <= rad; b++) {
        nodesAt(ix + a, iz + b, (o) => {
          if (label[o] >= 0 || !(N.flags[o] & HIT) || Math.abs(N.y[o] - N.y[q]) > LEVEL_GAP + 1) return;
          label[o] = g; stack.push(o);
        });
      }
    }
    groups.push(list);
  }
  const buildings = world.buildings || [];
  const things = [], boxes = [], dropped = [];
  for (const list of groups) {
    // what the walls enclose counts as the footprint: fill the holes in the slice
    let ax = Infinity, az = Infinity, bx = -Infinity, bz = -Infinity, topY = -1e9, y0 = 1e9, y1 = -1e9;
    for (const q of list) { const ix = ixOf(N.cell[q]), iz = izOf(N.cell[q]); ax = Math.min(ax, ix); bx = Math.max(bx, ix); az = Math.min(az, iz); bz = Math.max(bz, iz); topY = Math.max(topY, top[q]); y0 = Math.min(y0, N.y[q]); y1 = Math.max(y1, N.y[q]); }
    const edge = 1 + rad, w = bx - ax + 2 * edge + 1, h = bz - az + 2 * edge + 1, raw = new Uint8Array(w * h), grid = new Uint8Array(w * h);
    for (const q of list) raw[(izOf(N.cell[q]) - az + edge) * w + ixOf(N.cell[q]) - ax + edge] = 1;
    // closed over gaps of CLOSE: a slice of posts, sills and walls with windows becomes one footprint, with faces worth bouncing off
    { const near = new Uint8Array(w * h);
      for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) { if (!raw[z * w + x]) continue; for (let a = -rad; a <= rad; a++) for (let b = -rad; b <= rad; b++) { const X = x + a, Z = z + b; if (X >= 0 && Z >= 0 && X < w && Z < h) near[Z * w + X] = 1; } }
      for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) {
        let all = near[z * w + x];
        for (let a = -rad; a <= rad && all; a++) for (let b = -rad; b <= rad && all; b++) { const X = x + a, Z = z + b; if (X >= 0 && Z >= 0 && X < w && Z < h && !near[Z * w + X]) all = 0; }
        grid[z * w + x] = all;
      }
      // a road stays clear of it, closed or not
      for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) if (grid[z * w + x] && !raw[z * w + x]) { let road = false; nodesAt(x + ax - edge, z + az - edge, (o) => { if (N.flags[o] & F.ROAD) road = true; }); if (road) grid[z * w + x] = 0; }
    }
    const stack = [0], seen = new Uint8Array(w * h); seen[0] = 1;
    while (stack.length) { const c = stack.pop(), x = c % w, z = (c - x) / w; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Z = z + dz; if (X < 0 || Z < 0 || X >= w || Z >= h) continue; const o = Z * w + X; if (seen[o] || grid[o]) continue; seen[o] = 1; stack.push(o); } }
    // a court a road runs through is no hole
    const isRoad = (x, z) => { let on = false; nodesAt(x + ax - edge, z + az - edge, (o) => { if (N.flags[o] & F.ROAD) on = true; }); return on; };
    for (let c = 0; c < w * h; c++) {
      if (seen[c] || grid[c]) continue;
      const region = [c], st = [c];
      let road = false;
      seen[c] = 2;
      while (st.length) { const e = st.pop(), x = e % w, z = (e - x) / w; if (isRoad(x, z)) road = true; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Z = z + dz; if (X < 0 || Z < 0 || X >= w || Z >= h) continue; const o = Z * w + X; if (seen[o] || grid[o]) continue; seen[o] = 2; st.push(o); region.push(o); } }
      if (!road && region.length * CELL * CELL <= MAX_HOLE) for (const e of region) seen[e] = 3;
    }
    const cells = [];
    let holes = 0;
    for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) {
      const o = z * w + x;
      if (grid[o]) cells.push([(x + ax - edge) * CELL, (z + az - edge) * CELL]);
      else if (seen[o] === 3) { cells.push([(x + ax - edge) * CELL, (z + az - edge) * CELL]); holes++; }
    }
    const area = cells.length * CELL * CELL, height = topY - y0, cx = cells.reduce((s, c) => s + c[0], 0) / cells.length + CELL / 2, cz = cells.reduce((s, c) => s + c[1], 0) / cells.length + CELL / 2;
    const counts = {}; for (const q of list) { const f = from.get(q); if (f) counts[f] = (counts[f] || 0) + 1; }
    const source = Object.entries(counts).sort((p, q) => q[1] - p[1])[0]?.[0] ?? '?';
    let kind = null, bd = 1e9;
    for (const b of buildings) { const d = Math.hypot(b.x - cx, b.z - cz); if (d < bd && d < Math.max(14, b.r ?? 14)) { bd = d; kind = b.kind ?? b.type ?? null; } }
    const pier = area >= PILLAR[0] && area < MIN_AREA && (() => { const B = fitBox(cells); return Math.min(B.hu, B.hv) * 2 >= PILLAR[1]; })();
    const big = height >= MIN_TOP && (area >= MIN_AREA || pier);
    // is it where a kart can be, on this level?
    const near = Math.ceil(REACH_MARGIN / CELL);
    let reachable = false;
    for (const q of list) {
      if (reachable) break;
      const ix = ixOf(N.cell[q]), iz = izOf(N.cell[q]);
      for (let a = -near; a <= near && !reachable; a++) for (let b = -near; b <= near && !reachable; b++) nodesAt(ix + a, iz + b, (o) => { if ((N.flags[o] & REACH) && Math.abs(N.y[o] - N.y[q]) < LEVEL_GAP + 1) reachable = true; });
    }
    const thing = { source, kind, x: cx, z: cz, area, height, holes, big, reachable, boxes: 0 };
    things.push(thing);
    if (!big || !reachable) continue;
    // no box may reach onto a lane of this level, once it has grown by the kart's margin
    const onLane = (B) => {
      const pad = margin + PAD, r = Math.hypot(B.hu, B.hv) + pad, x0 = Math.floor((B.x - r) / CELL), x1 = Math.floor((B.x + r) / CELL), z0 = Math.floor((B.z - r) / CELL), z1 = Math.floor((B.z + r) / CELL);
      for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
        let q = heads.get(key(ix, iz));
        while (q !== undefined && q >= 0) {
          if ((N.flags[q] & LANE) && N.y[q] > y0 - LEVEL_GAP && N.y[q] < y1 + LEVEL_GAP) {
            const [u, v] = coordsIn(B, (ix + 0.5) * CELL, (iz + 0.5) * CELL);
            if (Math.abs(u) < B.hu + pad && Math.abs(v) < B.hv + pad) return true;
          }
          q = N.next[q];
        }
      }
      return F.edgeIn(B, pad, y0 - LEVEL_GAP, y1 + LEVEL_GAP);
    };
    // The footprint stops a kart's margin short of any lane of its level before it is cut, so that a house whose front stands by the road
    // gets its box right up to that front. Cut first and checked after, every box touching the front row was dropped, and the whole front with it.
    // a bridge's own masonry (road.js: parapets, abutments) is held by the deck's barrier: a box at the road's edge would stand square on
    // to a kart at the bridge's mouth, so it keeps the clearance of old, a metre and more off the edge
    const TRIM = margin + CELL / 2 + PAD + (deckMasonry(source) ? OWN_MASONRY : 0), tr = Math.ceil(TRIM / CELL); // a cell centre this far from a lane cell's: the face of its box, at the cell's edge, clears the lane check below
    const free = cells.filter(([cx, cz]) => {
      const ix = Math.round(cx / CELL), iz = Math.round(cz / CELL);
      let lane = false;
      for (let a = -tr; a <= tr && !lane; a++) for (let b = -tr; b <= tr && !lane; b++) {
        if (Math.hypot(a, b) * CELL >= TRIM) continue;
        nodesAt(ix + a, iz + b, (o) => { if ((N.flags[o] & LANE) && N.y[o] > y0 - LEVEL_GAP && N.y[o] < y1 + LEVEL_GAP) lane = true; });
      }
      return !lane;
    });
    const out = [];
    carve(free, onLane, out);
    for (const B of out) {
      // only the boxes a kart can touch go in the file
      const r = Math.hypot(B.hu, B.hv) + REACH_MARGIN, x0 = Math.floor((B.x - r) / CELL), x1 = Math.floor((B.x + r) / CELL), z0 = Math.floor((B.z - r) / CELL), z1 = Math.floor((B.z + r) / CELL);
      let touch = false, ceiling = Infinity, floor = Infinity, ground = -Infinity;
      for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
        let q = heads.get(key(ix, iz));
        while (q !== undefined && q >= 0) {
          const [u, v] = coordsIn(B, (ix + 0.5) * CELL, (iz + 0.5) * CELL);
          if (Math.abs(u) < B.hu + REACH_MARGIN && Math.abs(v) < B.hv + REACH_MARGIN) {
            const reach = N.flags[q] & REACH, same = N.y[q] > y0 - LEVEL_GAP && N.y[q] < y1 + LEVEL_GAP;
            if (reach && same) { touch = true; floor = Math.min(floor, N.y[q]); ground = Math.max(ground, N.y[q]); }
            // a road passing over this: a kart up there flies clear of what stands below
            if (reach && N.y[q] >= y1 + LEVEL_GAP) ceiling = Math.min(ceiling, N.y[q]);
          }
          q = N.next[q];
        }
      }
      if (!touch) continue;
      const lo = floor - 1.5, hi = Math.max(Math.min(topY, ceiling - 1), ground + 2);
      // the last word, as the sim will read it: at this height range, grown by the margin, no lane of any level under it
      const pad = margin + PAD, grown = Math.hypot(B.hu, B.hv) + pad;
      let clear = true;
      for (let ix = Math.floor((B.x - grown) / CELL); ix <= Math.floor((B.x + grown) / CELL) && clear; ix++) for (let iz = Math.floor((B.z - grown) / CELL); iz <= Math.floor((B.z + grown) / CELL) && clear; iz++) {
        nodesAt(ix, iz, (q) => { if (!(N.flags[q] & LANE) || N.y[q] < lo || N.y[q] > hi) return; const [u, v] = coordsIn(B, (ix + 0.5) * CELL, (iz + 0.5) * CELL); if (Math.abs(u) < B.hu + pad && Math.abs(v) < B.hv + pad) clear = false; });
      }
      if (!clear || F.edgeIn(B, pad, lo, hi)) continue;
      boxes.push({ x: B.x, z: B.z, hu: B.hu, hv: B.hv, ux: B.ux, uz: B.uz, y0: lo, y1: hi });
      thing.boxes++;
    }
  }
  for (const b of boxes) { b.yaw = Math.atan2(b.uz, b.ux); }
  const R2 = (x) => Math.round(x * 100) / 100, R3 = (x) => Math.round(x * 1000) / 1000;
  const rows = boxes.map((b) => [R2(b.x), R2(b.z), R2(b.hu), R2(b.hv), R3(b.yaw), R2(b.y0), R2(b.y1)]).sort((p, q) => p[0] - q[0] || p[1] - q[1] || p[2] - q[2]);
  const reach = []; for (let q = 0; q < N.y.length; q++) if (N.flags[q] & REACH) reach.push(q);
  const roadBySource = {};
  for (const q of lanes) { const f = from.get(q) ?? '?', g = roadBySource[f] ||= { cells: 0, x: ixOf(N.cell[q]) * CELL, z: izOf(N.cell[q]) * CELL }; g.cells++; }
  return { id, rows, things, onRoad: lanes.length, roadBySource, lanes, from, field: F, scene, reachCells: reach.length, top };
}

export function solidsSource(id, rows) {
  const lines = rows.map((r) => `  [${r.join(', ')}],`);
  return `// Baked by tools/bake-solids.mjs from what src/render/landmarks/${id}.js and road.js build, do not edit: a kart bounces off these. x, z, half u, half v, yaw of u, y from, y to.\nexport default [\n${lines.join('\n')}\n];\n`;
}

// ---------- a picture of the result, for a person ----------
function png(w, h, rgb) {
  const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc = (b) => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const b = Buffer.concat([Buffer.from(t), d]), c = Buffer.alloc(4); c.writeUInt32BE(crc(b)); return Buffer.concat([l, b, c]); };
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  const head = Buffer.alloc(13); head.writeUInt32BE(w, 0); head.writeUInt32BE(h, 4); head[8] = 8; head[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
export function picture(res, file, { px = 2048, region = null } = {}) {
  const { field: F } = res, { N, REACH, ROAD, SOLID: HIT } = F;
  let ax = Infinity, az = Infinity, bx = -Infinity, bz = -Infinity;
  for (const c of F.heads.keys()) { const x = (Math.floor(c / 100000) - 40000) * CELL, z = (c % 100000 - 40000) * CELL; if (x < ax) ax = x; if (x > bx) bx = x; if (z < az) az = z; if (z > bz) bz = z; }
  if (region) [ax, az, bx, bz] = region;
  const s = Math.min(px / (bx - ax + 8), px / (bz - az + 8)), w = Math.ceil((bx - ax + 8) * s), h = Math.ceil((bz - az + 8) * s), rgb = Buffer.alloc(w * h * 3, 24);
  const put = (x, z, r, g, b) => { const X = Math.floor((x - ax + 4) * s), Z = Math.floor((z - az + 4) * s); if (X < 0 || Z < 0 || X >= w || Z >= h) return; const o = (Z * w + X) * 3; rgb[o] = r; rgb[o + 1] = g; rgb[o + 2] = b; };
  for (let q = 0; q < N.y.length; q++) {
    const x = (Math.floor(N.cell[q] / 100000) - 40000 + 0.5) * CELL, z = (N.cell[q] % 100000 - 40000 + 0.5) * CELL, f = N.flags[q];
    const X0 = x - CELL / 2, Z0 = z - CELL / 2, col = f & ROAD ? [120, 120, 130] : f & REACH ? [60, 90, 60] : [40, 44, 44];
    for (let a = 0; a < CELL * s + 1; a++) for (let b = 0; b < CELL * s + 1; b++) put(X0 + a / s, Z0 + b / s, ...col);
  }
  for (let q = 0; q < N.y.length; q++) {
    if (!(N.flags[q] & HIT)) continue;
    const x = (Math.floor(N.cell[q] / 100000) - 40000 + 0.5) * CELL, z = (N.cell[q] % 100000 - 40000 + 0.5) * CELL;
    put(x, z, 230, 170, 60);
  }
  for (const r of res.rows) {
    const [x, z, hu, hv, yaw] = r, ux = Math.cos(yaw), uz = Math.sin(yaw), step = 0.5 / Math.max(1, s);
    for (const [a, b, c, d] of [[-hu, -hv, hu, -hv], [hu, -hv, hu, hv], [hu, hv, -hu, hv], [-hu, hv, -hu, -hv]]) {
      const l = Math.hypot(c - a, d - b), m = Math.ceil(l / step);
      for (let i = 0; i <= m; i++) { const u = a + (c - a) * i / m, v = b + (d - b) * i / m; put(x + u * ux - v * uz, z + u * uz + v * ux, 240, 40, 60); }
    }
  }
  writeFileSync(file, png(w, h, rgb));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), opt = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : null; };
  const { TRACK_IDS } = await import('../src/data/tracks.js');
  const ids = opt('track') ? [opt('track')] : TRACK_IDS, dir = fileURLToPath(new URL('../src/world/solids/', import.meta.url)), noWrite = args.includes('--dry');
  if (!noWrite) mkdirSync(dir, { recursive: true });
  for (const id of ids) {
    const t0 = performance.now(), res = await extractSolids(id);
    if (!noWrite) writeFileSync(`${dir}${id}.js`, solidsSource(id, res.rows));
    if (opt('png')) picture(res, `${opt('png')}/${id}.png`, { region: opt('region')?.split(',').map(Number) ?? null, px: opt('region') ? 1400 : 2048 });
    const big = res.things.filter((t) => t.big), hit = big.filter((t) => t.reachable && t.boxes);
    console.log(`${id.padEnd(15)} structures ${String(big.length).padStart(4)}  reachable ${String(hit.length).padStart(4)}  boxes ${String(res.rows.length).padStart(4)}  road cells cleared ${String(res.onRoad).padStart(5)}  ${Math.round(performance.now() - t0)} ms`);
    if (args.includes('--audit')) {
      const groups = new Map();
      for (const t of big) { const k = `${t.kind ?? t.source}${!t.reachable ? ' (out of reach)' : t.boxes ? '' : ' (on the road edge: no box)'}`; const g = groups.get(k) || { n: 0, area: 0, h: 0, boxes: 0 }; g.n++; g.area += t.area; g.h = Math.max(g.h, t.height); g.boxes += t.boxes; groups.set(k, g); }
      for (const [k, g] of [...groups].sort()) console.log(`   ${k.padEnd(36)} ${String(g.n).padStart(4)}  area ${String(Math.round(g.area)).padStart(6)} m2  top ${g.h.toFixed(1).padStart(6)} m  boxes ${g.boxes}`);
    }
    if (args.includes('--audit')) for (const [k, g] of Object.entries(res.roadBySource).sort((a, b) => b[1].cells - a[1].cells)) console.log(`   on the road, cleared: ${k.padEnd(26)} ${String(g.cells).padStart(5)} cells (${(g.cells * CELL * CELL).toFixed(0)} m2) first at ${g.x.toFixed(0)}, ${g.z.toFixed(0)}`);
  }
}
