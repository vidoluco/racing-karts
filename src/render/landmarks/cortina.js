// Cortina e il Giau: the Corso and its bell tower, the Trampolino Italia at Zuel over the road, Pocol, the ladder of the Giau with its cyclists, the meadows and the Malga, the rifugio on the pass, the Cinque Torri beside the descent. Facts: docs/references/cortina.md.
// Scenery only: the basilica and the tower stand clear of the road and nothing is ever thrown at them (def.sacred). Flat clean colours, soft big shapes, as the paintings.
import * as THREE from 'three';
import { hash3, lerp, smooth, linear, vnoise } from '../math.js';
import { merge, paint, place, box, sphere, capsule, cylinder, cone, gable, tube, torus } from '../shapes.js';
import { cowGeometry } from '../props.js';
import { tabia, house, hayBale, hayRack, woodPile, fenceRun } from './antelao.js';
import { cornerHills } from '../../world/tracks/cortina.js';

const STONE_W = '#efe6d6', STONE_C = '#d9cdb9', STONE_D = '#a79c8e', COPPER = '#5f9a7e', CONCRETE = '#e6e0d4', CONCRETE_D = '#b4aca0', WOOD = '#8a5f3c', WOOD_D = '#5f4029', ROOF = '#6c645f', RED = '#c9402e';
const ROCK = ['#f3d2ad', '#e3ac97', '#c9929e', '#9c7a9c', '#6f6a93'];

// The campanile of Cortina: white stone, 69 m in truth, square shaft in storeys, belfry with arches and a clock, a slim green spire.
function belltower() {
  const P = [], W = 4.4;
  P.push(paint(place(box(W + 1.4, 3, W + 1.4), { p: [0, 1.5, 0] }), STONE_D, 1));
  for (let i = 0; i < 6; i++) {
    const y = 3 + i * 5.2, w = W - i * 0.05;
    P.push(paint(place(box(w, 5.2, w), { p: [0, y + 2.6, 0] }), i % 2 ? STONE_W : '#f4ecde', 1));
    P.push(paint(place(box(w + 0.5, 0.4, w + 0.5), { p: [0, y + 5.2, 0] }), STONE_C, 1));
    if (i >= 1 && i < 5) for (const [sx, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) P.push(paint(place(box(sz ? 0.7 : 0.1, 1.9, sx ? 0.7 : 0.1), { p: [sx * (w / 2 + 0.02), y + 2.8, sz * (w / 2 + 0.02)] }), '#5a5a72', 0));
  }
  const by = 34.2;
  // the clock
  for (const [sx, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    P.push(paint(place(cylinder(1.45, 1.45, 0.14, 16), { p: [sx * 2.2, by + 2, sz * 2.2], r: sz ? [Math.PI / 2, 0, 0] : [0, 0, Math.PI / 2] }), '#fbf6e8', 0));
    P.push(paint(place(box(sz ? 0.14 : 0.08, 1, sx ? 0.14 : 0.08), { p: [sx * 2.3, by + 2.3, sz * 2.3] }), '#2c2a30', 0));
  }
  P.push(paint(place(box(W + 0.1, 4, W + 0.1), { p: [0, by + 2, 0] }), STONE_W, 1));
  // the belfry: four piers, open arches, a balustrade
  const fy = by + 4;
  P.push(paint(place(box(W + 0.9, 0.5, W + 0.9), { p: [0, fy + 0.25, 0] }), STONE_C, 1));
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) P.push(paint(place(box(1.05, 6.2, 1.05), { p: [sx * 1.75, fy + 3.5, sz * 1.75] }), STONE_W, 1));
  for (const [sx, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    P.push(paint(place(box(sx ? 0.6 : 2.6, 1.3, sz ? 0.6 : 2.6), { p: [sx * 1.85, fy + 5.9, sz * 1.85] }), STONE_W, 1));
    P.push(paint(place(cylinder(1.25, 1.25, 0.6, 12, false), { p: [sx * 1.85, fy + 5.2, sz * 1.85], r: sz ? [Math.PI / 2, 0, 0] : [0, 0, Math.PI / 2], s: [1, 1, 1] }), STONE_W, 1));
    P.push(paint(place(box(sx ? 0.3 : 2.5, 1, sz ? 0.3 : 2.5), { p: [sx * 2, fy + 0.95, sz * 2] }), STONE_C, 1));
  }
  P.push(paint(place(box(2.6, 5, 2.6), { p: [0, fy + 3.2, 0] }), '#4d4a5e', 0));
  P.push(paint(place(cylinder(0.75, 1, 1.5, 8), { p: [0, fy + 2.8, 0] }), '#b38a3e', 0));
  // the octagon and the spire
  const oy = fy + 6.6;
  P.push(paint(place(box(W + 0.7, 0.5, W + 0.7), { p: [0, oy, 0] }), STONE_C, 1));
  P.push(paint(place(cylinder(1.85, 2.1, 3.4, 8), { p: [0, oy + 1.9, 0] }), STONE_W, 1));
  P.push(paint(place(cone(1.95, 14, 8), { p: [0, oy + 10.6, 0] }), COPPER, 0));
  P.push(paint(place(sphere(0.42, 8, 6), { p: [0, oy + 17.7, 0] }), '#e6b84c', 0));
  return merge(P);
}
// The basilica's nave, cream with a dark roof, behind the tower: the church is scenery, it stands clear of the road.
function basilica() {
  const P = [], W = 15, L = 34, H = 13;
  P.push(paint(place(box(W, H, L), { p: [0, H / 2, 0] }), '#f2e6d0', 1));
  P.push(paint(gable(W + 1, L + 1, H, 6.5, 0.6).roof, '#7c7078', 13));
  for (let i = 0; i < 5; i++) for (const s of [-1, 1]) P.push(paint(place(capsule(0.8, 3.6, 2, 8), { p: [s * (W / 2 + 0.02), 7.4, -L * 0.36 + i * L * 0.18], s: [0.14, 1, 1] }), '#6a6a84', 0));
  return merge(P);
}
const lamp = () => merge([paint(place(cylinder(0.07, 0.1, 4.2, 6), { p: [0, 2.1, 0] }), '#3a3a42'), paint(place(sphere(0.3, 8, 6), { p: [0, 4.4, 0] }), '#fff0c4', 0)]);
const flowerbox = () => merge([paint(place(box(1.6, 0.5, 0.6), { p: [0, 0.25, 0] }), WOOD_D), paint(place(sphere(0.5, 7, 5), { p: [-0.35, 0.65, 0], s: [1, 0.7, 0.9] }), '#d9503c', 0), paint(place(sphere(0.5, 7, 5), { p: [0.35, 0.65, 0], s: [1, 0.7, 0.9] }), '#e9a33c', 0)]);

// What the Corso is for: a shop window and an awning on the road side of a house. Its +z faces the road.
const AWN = ['#b5473a', '#3f6e55', '#2f4f7c', '#c9903a', '#7c3b52'];
function shopfront(seed) {
  const z = 6.05, c = AWN[seed % AWN.length];
  return merge([
    paint(place(box(6.2, 2.3, 0.14), { p: [0, 1.75, z] }), '#3e4258', 0),
    paint(place(box(6.6, 0.3, 0.2), { p: [0, 3.05, z] }), '#f0e6d2', 0),
    paint(place(box(0.2, 2.5, 0.2), { p: [0, 1.75, z + 0.04] }), '#f0e6d2', 0),
    paint(place(box(6.8, 0.14, 1.5), { p: [0, 3.25, z + 0.7], r: [0.3, 0, 0] }), c, 0),
    paint(place(box(6.2, 0.6, 0.5), { p: [0, 0.3, z] }), '#a79c8e', 1),
  ]);
}

// The Trampolino Italia of 1956: in local metres, +x is left of the road, y over the road. The in-run on its concrete legs crosses over the road, the table stops just past it, the landing hill goes down into the meadow the road then rounds.
const INRUN = (x) => 10.5 + 46 * Math.pow(Math.max(0, x + 15) / 135, 1.5);
function trampolino(groundLocal) {
  const P = [];
  // the deck in pieces along its curve: white concrete parapets, the track between them
  const N = 18, W = 4.1;
  for (let i = 0; i < N; i++) {
    const x0 = -15 + i * (135 / N), x1 = x0 + 135 / N, y0 = INRUN(x0), y1 = INRUN(x1), a = Math.atan2(y1 - y0, x1 - x0), L = Math.hypot(x1 - x0, y1 - y0) + 0.3, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    P.push(paint(place(box(L, 1.6, W * 2), { p: [cx, cy - 0.8, 0], r: [0, 0, a] }), CONCRETE, 1));
    for (const s of [-1, 1]) P.push(paint(place(box(L, 1.2, 0.5), { p: [cx, cy + 0.35, s * W], r: [0, 0, a] }), s > 0 ? CONCRETE : '#f2ece0', 1));
    P.push(paint(place(box(L, 0.04, W * 2 - 0.9), { p: [cx, cy + 0.03, 0], r: [0, 0, a] }), '#9eb4c4', 0));
    // the service stair down its north side
    P.push(paint(place(box(L, 0.16, 0.8), { p: [cx, cy + 0.55, -W - 0.6], r: [0, 0, a] }), CONCRETE_D, 1));
  }
  // the legs: tall portal frames, slim and tapering, closer as it nears the road
  for (const x of [8.2, 22, 37, 52, 67, 82, 97, 112]) {
    const top = INRUN(x) - 0.8, g = Math.min(groundLocal(x, -W), groundLocal(x, W)) - 1;
    for (const s of [-1, 1]) P.push(paint(place(box(1.9, top - g, 1.7), { p: [x, (top + g) / 2, s * (W + 0.1)] }), CONCRETE, 1));
    P.push(paint(place(box(1.9, 1.6, W * 2 + 1.6), { p: [x, top - 0.8, 0] }), CONCRETE, 1));
    if (top - g > 13) P.push(paint(place(box(1.2, 1.1, W * 2 + 1.2), { p: [x, g + (top - g) * 0.5, 0] }), CONCRETE_D, 1));
    if (top - g > 24) P.push(paint(place(box(1.2, 1.1, W * 2 + 1.2), { p: [x, g + (top - g) * 0.26, 0] }), CONCRETE_D, 1));
  }
  // the table over the far kerb, the piers on the right of the road
  for (const s of [-1, 1]) P.push(paint(place(box(2.4, 10.8, 1.8), { p: [-10, 5, s * (W - 0.6)] }), CONCRETE, 1));
  P.push(paint(place(box(8.6, 2.2, W * 2 + 0.8), { p: [-12.6, 9.4, 0], r: [0, 0, 0.05] }), CONCRETE, 1));
  // the top: the start hut with its gallery and a flagpole
  const ty = INRUN(120);
  P.push(paint(place(box(12, 7, 11), { p: [122, ty + 1.5, 0] }), '#f2ece0', 1));
  P.push(paint(place(box(13, 0.7, 12), { p: [122, ty + 5.3, 0] }), CONCRETE_D, 1));
  P.push(paint(place(box(0.15, 2, 8), { p: [116, ty + 2.2, 0] }), '#58607c', 0));
  P.push(paint(place(cylinder(0.08, 0.1, 9, 5), { p: [127, ty + 9.5, 4.5] }), '#e9e4d8'));
  // the judges' tower, right of the table, stepped windows toward the hill
  const P2 = [[3.8, 5], [3.6, 11.5], [3.2, 16.8]];
  for (const [w, h] of P2) P.push(paint(place(box(w * 1.8, 6, w * 2), { p: [-23, h, 14] }), CONCRETE, 1));
  P.push(paint(place(box(5.8, 2.6, 7), { p: [-23, 19.8, 14] }), '#58607c', 0));
  P.push(paint(place(box(6.8, 0.6, 8), { p: [-23, 21.4, 14] }), CONCRETE_D, 1));
  return merge(P);
}

// The landing hill: a long tongue of mown meadow with pale slope boards, a lip at the top under the table, the flat of the out-run at the bottom.
function landing(O, groundAt, right) {
  const P = [], NX = 14, NZ = 6, verts = [], idx = [], cols = [], c1 = new THREE.Color('#d6b65a'), c2 = new THREE.Color('#e8cd72');
  c1.convertSRGBToLinear?.(); c2.convertSRGBToLinear?.();
  for (let i = 0; i <= NX; i++) for (let j = 0; j <= NZ; j++) {
    const t = i / NX, x = -14 - t * 70, z = (j / NZ - 0.5) * lerp(22, 42, t), wx = O.x + right.x * -x + O.tx * z, wz = O.z + right.z * -x + O.tz * z;
    const h = lerp(7.2, 0, Math.pow(t, 0.62)), g = groundAt(wx, wz);
    verts.push(x, Math.max(g + 0.25, O.y + h), z);
    const k = (i + (j === 0 || j === NZ ? 0 : 0)) % 2 ? c1 : c2; cols.push(k.r, k.g, k.b);
  }
  for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) { const a = i * (NZ + 1) + j, b = a + 1, c = a + NZ + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const flat = g.toNonIndexed(); flat.computeVertexNormals();
  P.push(paint(flat, '#dcc069', 0));
  // red marks and boards along the sides
  for (let i = 1; i < 7; i++) for (const s of [-1, 1]) {
    const t = i / 7, x = -14 - t * 70, z = s * lerp(11.6, 21.6, t), wx = O.x + right.x * -x + O.tx * z, wz = O.z + right.z * -x + O.tz * z, y = Math.max(groundAt(wx, wz) + 0.25, O.y + lerp(7.2, 0, Math.pow(t, 0.62)));
    P.push(paint(place(box(4.2, 0.8, 0.12), { p: [x, y + 0.6, z] }), i % 2 ? RED : '#f5efe2'));
    P.push(paint(place(box(0.14, 0.9, 0.14), { p: [x, y + 0.3, z] }), WOOD_D));
  }
  return merge(P);
}

// A rider climbing out of the saddle: two thin wheels, a frame, a bright jersey. Facing +z.
const JERSEYS = ['#d63c3c', '#2b6fd0', '#f0c22f', '#1f9e70', '#e9692c', '#f4f0e8', '#7a4cc0'];
function cyclist(seed) {
  const c = JERSEYS[seed % JERSEYS.length], P = [];
  for (const z of [-0.55, 0.55]) P.push(paint(place(torus(0.34, 0.035, 4, 12), { p: [0, 0.36, z], r: [0, Math.PI / 2, 0] }), '#26262c', 0));
  P.push(paint(tube([[0, 0.36, -0.55], [0, 0.85, -0.2], [0, 0.82, 0.38], [0, 0.36, 0.55]], 0.03, 3), seed % 2 ? '#e8e4dc' : '#c23a3a', 0));
  P.push(paint(place(capsule(0.17, 0.42, 2, 7), { p: [0, 1.22, 0.02], r: [0.85, 0, 0] }), c, 0));
  for (const s of [-1, 1]) {
    P.push(paint(tube([[s * 0.13, 1.03, -0.18], [s * 0.13, 0.72, 0.03], [s * 0.1, 0.42, -0.08]], 0.055, 3), '#2c2a34', 0));
    P.push(paint(tube([[s * 0.15, 1.38, 0.22], [s * 0.2, 1.04, 0.42]], 0.04, 3), c, 0));
  }
  P.push(paint(place(sphere(0.13, 7, 5), { p: [0, 1.52, 0.33] }), '#f0c8a0', 0));
  P.push(paint(place(sphere(0.15, 7, 4), { p: [0, 1.56, 0.32], s: [0.95, 0.75, 1.2] }), seed % 3 ? '#f4f0e8' : '#20242c', 0));
  return merge(P);
}
// The Cinque Torri: towers of pale rock on a grass shoulder. Faceted, soft and few, lit like the painted Dolomites.
function tower(h, r, seed) {
  // one tall block, seven sided, its faces broken only a little: pale at the top where the sun is, rose then mauve toward the foot
  const g = cylinder(r * 0.78, r, h, 7, false), pos = g.attributes.position, ramp = (y) => (y > 0.62 ? 1.08 : y > 0.3 ? 0.96 : 0.84);
  const ids = new Map();
  for (let i = 0; i < pos.count; i++) {
    const a = Math.round(Math.atan2(pos.getZ(i), pos.getX(i)) * 8), k = hash3(seed, a, 2);
    pos.setX(i, pos.getX(i) * (0.84 + 0.32 * k)); pos.setZ(i, pos.getZ(i) * (0.84 + 0.32 * hash3(seed, a, 3)));
    ids.set(i, a);
  }
  const f = g.toNonIndexed(); f.computeVertexNormals(); place(f, { p: [0, h / 2, 0], r: [0, seed, 0] });
  const parts = [paint(f, ROCK[seed % 2 ? 0 : 1], 0, (x, y) => ramp(y / h))];
  // a stepped shoulder and a flat broken top: the real towers are blocks, never spires
  const c = cylinder(r * 0.42, r * 0.6, h * 0.22, 6).toNonIndexed(); c.computeVertexNormals();
  place(c, { p: [r * 0.16, h + h * 0.1, r * 0.1], r: [0, seed * 2, 0] });
  parts.push(paint(c, ROCK[0], 0));
  return merge(parts);
}
// A boulder of the talus under the walls, as the painting has them: pale, soft, few facets.
function boulder(seed) {
  const g = sphere(1, 6, 4).toNonIndexed(), pos = g.attributes.position;
  const r = (i, k) => 0.82 + 0.36 * hash3(seed, Math.round((pos.getX(i) + 1) * 9) + Math.round((pos.getY(i) + 1) * 9) * 31 + Math.round((pos.getZ(i) + 1) * 9) * 77, k);
  for (let i = 0; i < pos.count; i++) { const q = r(i, 1); pos.setXYZ(i, pos.getX(i) * q, pos.getY(i) * q * 0.72, pos.getZ(i) * q); }
  g.computeVertexNormals();
  return paint(g, ['#efe0cc', '#e6d2c0', '#d9c2b8'][seed % 3], 0);
}
function rifugio() {
  const P = [], W = 12, L = 22, H = 9;
  P.push(paint(place(box(W, 4, L), { p: [0, 2, 0] }), '#cfc4b0', 1));
  P.push(paint(place(box(W + 0.3, 5, L + 0.3), { p: [0, 6.4, 0] }), WOOD, 8));
  P.push(paint(gable(W + 2.4, L + 2, H, 6, 0.6).roof, '#5c5560', 13));
  for (const s of [-1, 1]) {
    for (let i = 0; i < 5; i++) { for (const y of [2.2, 6.6]) P.push(paint(place(box(0.1, 1.4, 1.5), { p: [s * (W / 2 + 0.2), y, -8 + i * 4] }), '#3e4258', 0)); }
    P.push(paint(place(box(1.2, 0.2, L - 2), { p: [s * (W / 2 + 0.6), 5, 0] }), WOOD_D));
    P.push(paint(place(box(0.14, 1, L - 2), { p: [s * (W / 2 + 1.1), 5.5, 0] }), WOOD_D));
    for (let i = 0; i < 6; i++) P.push(paint(place(sphere(0.4, 6, 4), { p: [s * (W / 2 + 1.25), 6.15, -8.5 + i * 3.4], s: [0.7, 0.8, 1.3] }), '#d9503c', 0));
  }
  return merge(P);
}

export function plan({ track, terrain, world }) {
  const P = (u) => track.pointAt(u), add = (u, r, cover, kinds) => { const p = P(u); world.groves.push({ x: p.x, z: p.z, r, cover, kinds }); };
  world.groundDrop = (x, z) => cornerHills(x, z);
  const keep = world.keepOut;
  world.buildings = [];
  const site = (kind, u, d, opts = {}) => {
    const p = P(u), x = p.x + p.nx * d + p.tx * (opts.along || 0), z = p.z + p.nz * d + p.tz * (opts.along || 0);
    const yaw = Math.atan2(-p.nx * Math.sign(d), -p.nz * Math.sign(d)) + (opts.turn || 0);
    world.buildings.push({ kind, x, z, yaw, u, d, ...opts });
    keep.push({ x, z, r: opts.r ?? 11 });
  };
  // open ground. Town and the Zuel meadows: no wood
  for (let u = 0.94; u < 1.135; u += 0.012) add(u % 1, 90, -1);
  // the landing hill's meadow, seen twice, and the view up the in-run
  for (const u of [0.1, 0.11, 0.12, 0.13, 0.14]) add(u, 130, -1.3);
  // the meadows over the tree line, from the top of the ladder to the first of the descent
  for (let u = 0.555; u < 0.74; u += 0.012) add(u, 150, -1.3);
  // Pocol
  for (const u of [0.25, 0.26, 0.27]) add(u, 80, -0.8);
  // the woods are larch and spruce together, more gold the higher the road
  for (let u = 0.172; u < 0.56; u += 0.016) if (u < 0.24 || u > 0.275) add(u, 170, 0.75, u < 0.33 ? [['spruce', 6], ['larch', 4]] : u < 0.44 ? [['larch', 5], ['spruce', 5]] : [['larch', 7], ['spruce', 3]]);
  for (let u = 0.745; u < 0.9; u += 0.016) add(u, 170, 0.7, u < 0.82 ? [['larch', 7], ['spruce', 3]] : [['larch', 4], ['spruce', 6]]);
  // the wood stands aside along the line of sight wherever the road runs at Ra Gusela or the Tofane
  const seen = new Set();
  for (const az of [230.3, 312, 332].map((v) => v * Math.PI / 180)) {
    const dx = Math.sin(az), dz = -Math.cos(az);
    for (let u = 0; u < 1; u += 0.01) {
      const p = P(u);
      if (p.tx * dx + p.tz * dz < 0.93) continue;
      for (const dist of [60, 110]) {
        const x = p.x + dx * dist, z = p.z + dz * dist, key = `${Math.round(x / 70)},${Math.round(z / 70)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        world.groves.push({ x, z, r: dist * 0.2 + 12, cover: -1.1 });
      }
    }
  }
  // lone larches in the open meadows
  for (let i = 0; i < 90; i++) {
    const u = 0.57 + 0.17 * hash3(i, 7, 51), s = i % 2 ? 1 : -1, d = s * (20 + 110 * hash3(i, 8, 51)), p = P(u), x = p.x + p.nx * d, z = p.z + p.nz * d;
    if (terrain.roadDistAt(x, z) > 14) world.plant.push({ x, z, kind: 'larch', h: 7 + 9 * hash3(i, 9, 51) });
  }
  // and along Zuel's and the Ronco's meadows
  for (let i = 0; i < 40; i++) {
    const u = (i % 2 ? 0.15 : 0.95) + 0.05 * hash3(i, 17, 51), s = i % 4 < 2 ? 1 : -1, d = s * (24 + 70 * hash3(i, 18, 51)), p = P(u), x = p.x + p.nx * d, z = p.z + p.nz * d;
    if (terrain.roadDistAt(x, z) > 14) world.plant.push({ x, z, kind: i % 3 ? 'larch' : 'spruce', h: 10 + 10 * hash3(i, 19, 51) });
  }

  // Corso Italia: tight, three floors, shoulder to shoulder, the tower on the left
  site('tower', 0.0135, 19, { r: 8, far: true });
  site('basilica', 0.0135, 41, { r: 26, turn: Math.PI / 2 });
  let seed = 1;
  for (let u = 0.9835, i = 0; u < 1.036; u += 0.00165, i++) {
    const v = u % 1, deep = hash3(i, 1, 9);
    if (!(Math.abs(v - 0.0135) < 0.012)) site('house', v, 10.6 + deep * 0.8, { seed: seed++, floors: 2 + (i % 3 ? 1 : 0), r: 6, near: true, shop: true, turn: 0.04 * (hash3(i, 2, 9) - 0.5) });
    site('house', v, -10.6 - hash3(i, 3, 9) * 0.8, { seed: seed++, floors: 3 - (i % 3 ? 0 : 1), r: 6, near: true, shop: true, turn: 0.04 * (hash3(i, 4, 9) - 0.5) });
  }
  for (let u = 0.985, i = 0; u < 1.036; u += 0.004, i++) {
    const v = u % 1;
    if (Math.abs(v - 0.0135) > 0.03) site('house', v, 25, { seed: seed++, floors: 3, r: 7, near: false });
    site('house', v, -25, { seed: seed++, floors: 3, r: 7, near: false });
  }
  // Via Roma and Via La Riva: hotels and chalets, further between, going thin toward Zuel
  for (let u = 0.036, i = 0; u < 0.104; u += 0.0028, i++) {
    const s = i % 2 ? 1 : -1, d = s * (11.5 + 5 * hash3(i, 5, 9));
    site('house', u, d, { seed: seed++, floors: 2 + (i % 3 === 0 ? 1 : 0), r: 8, near: i % 2 === 0 });
    if (i % 3 === 0) site('house', u, d + s * 16, { seed: seed++, floors: 2, r: 8, near: false });
    if (i % 6 === 0) site('tabia', u, d * 2.6, { seed: i, r: 8 });
  }
  // the last of the valley before the descent ends: Ronco's barns and chalets
  for (let u = 0.9, i = 0; u < 0.982; u += 0.0066, i++) {
    const s = i % 2 ? 1 : -1, d = s * (17 + 9 * hash3(i, 25, 9));
    site(i % 3 === 0 ? 'tabia' : 'house', u, d, { seed: seed++, floors: 2, r: 8, near: false });
  }
  // the Bar Trampolino, at the foot of the out-run; barns on the Zuel meadows
  site('house', 0.1215, 24, { seed: 90, floors: 2, r: 9 });
  site('tabia', 0.1305, -22, { seed: 91, r: 9 });
  site('tabia', 0.142, 20, { seed: 92, r: 9 });
  site('tabia', 0.158, -22, { seed: 93, r: 9 });
  // Pocol: hotels on the shelf
  for (const [u, d, f] of [[0.246, 18, 3], [0.2505, -19, 3], [0.256, 20, 3], [0.261, -21, 2], [0.266, 18, 2], [0.272, -20, 2], [0.253, 34, 2], [0.263, -38, 2]]) site('house', u, d, { seed: seed++, floors: f, r: 9, near: Math.abs(d) < 25 });
  // hay huts all the way up
  for (const [u, d] of [[0.29, 24], [0.312, -20], [0.335, 19], [0.42, -24], [0.432, 22], [0.575, -24], [0.59, 21], [0.605, 32], [0.625, -22], [0.635, 28], [0.685, 22], [0.70, -24], [0.72, 28], [0.742, -22], [0.77, 20], [0.82, -22], [0.86, 22], [0.885, -24]]) site('tabia', u, d, { seed: Math.round(u * 997), r: 9, turn: 0.5 * (hash3(u * 97, d, 1) - 0.5) });
  // Malga Giau, in the meadow the shortcut crosses
  site('tabia', 0.598, 42, { seed: 5, r: 14, big: true });
  site('tabia', 0.603, 66, { seed: 6, r: 10 });
  // the rifugio on the pass, on the left, and the barn behind it
  site('rifugio', 0.6455, 32, { r: 22, turn: 0.2 });
  site('tabia', 0.654, 30, { seed: 7, r: 9 });
  // The ground in a few big masses of colour, as the paintings: the stone of the town, olive gold on the valley's meadows, the dark floor of the woods. Over the tree line the terrain's own gold stays.
  const PAVE = linear('#c6b9a2'), PAVE2 = linear('#b7a990'), OLIVE = linear('#b6a85a'), OLIVE2 = linear('#a39c54'), FLOOR = linear('#6e6e44'), FLOOR2 = linear('#7f7646');
  const c0 = P(0.982), c1 = P(0.0005), c2 = P(0.037), sx = (x, z, a, b) => { const ax = b.x - a.x, az = b.z - a.z, t = Math.max(0, Math.min(1, ((x - a.x) * ax + (z - a.z) * az) / (ax * ax + az * az))); return Math.hypot(x - a.x - ax * t, z - a.z - az * t); };
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  world.paintAt = (x, z) => {
    const town = 1 - smooth(13, 19, Math.min(sx(x, z, c0, c1), sx(x, z, c1, c2)));
    if (town > 0) { const c = vnoise(x / 18, z / 18) > 0.5 ? PAVE : PAVE2; return [c[0], c[1], c[2], town]; }
    const y = terrain.heightAt(x, z), n = vnoise(x / 95 + 3, z / 95 + 8), wood = smooth(60, 112, y) * (1 - smooth(236, 262, y));
    if (wood > 0.01) { const c = mix(FLOOR, FLOOR2, smooth(0.35, 0.65, n)); return [c[0], c[1], c[2], wood * 0.92]; }
    const m = 1 - smooth(50, 70, y);
    if (m <= 0.01) return null;
    const c = mix(OLIVE, OLIVE2, smooth(0.35, 0.65, n));
    return [c[0], c[1], c[2], m * 0.9];
  };
  // the Cinque Torri to the north of the descent, at their true place on the map
  world.torri = { x: -1169, z: 427, r: 90 };
  keep.push(world.torri);
}

export function build({ track, terrain, batch, world }) {
  const groundAt = world.ground.groundAt, B = batch, P = (u) => track.pointAt(u);
  const atRoad = (u, d, along = 0) => { const p = P(u), x = p.x + p.nx * d + p.tx * along, z = p.z + p.nz * d + p.tz * along; return { x, z, y: groundAt(x, z), yaw: Math.atan2(p.tx, p.tz), p }; };
  for (const b of world.buildings) {
    const rr = b.kind === 'basilica' || b.kind === 'tower' ? 0 : 5.5, y0 = groundAt(b.x, b.z);
    let y = y0;
    if (rr) for (const [ax, az] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) y = Math.max(y, groundAt(b.x + ax * rr, b.z + az * rr));
    y = Math.min(y, y0 + 1.6) - 0.05;
    let g, r = 9, low = null;
    if (b.kind === 'tabia') { g = tabia({ ...b, w: b.big ? 10 : 7, l: b.big ? 13 : 9, h: b.big ? 7 : 5.2, rh: b.big ? 5.6 : 4.2 }); low = merge([paint(place(box(b.big ? 10 : 7, 5, b.big ? 13 : 9), { p: [0, 2.5, 0] }), WOOD), paint(gable(b.big ? 11 : 8, b.big ? 14 : 10, 5, 4, 0.2).roof, ROOF, 13)]); }
    else if (b.kind === 'house') { const w = b.floors >= 3 ? 10 : 8, l = b.floors >= 3 ? 12 : 10; g = house({ seed: b.seed, floors: Math.min(3, b.floors), w, l, rh: b.floors >= 3 ? 5 : 4.2, near: b.near }); r = 10; low = merge([paint(place(box(w, b.floors * 3, l), { p: [0, b.floors * 1.5, 0] }), '#efe3cf'), paint(gable(w + 1, l + 1, b.floors * 3, 4, 0.2).roof, ROOF, 13)]); }
    else if (b.kind === 'tower') { g = belltower(); r = 7; }
    else if (b.kind === 'basilica') { g = basilica(); r = 20; }
    else if (b.kind === 'rifugio') { g = rifugio(); r = 16; }
    place(g, { p: [b.x, y, b.z], r: [0, b.yaw, 0] });
    if (low) place(low, { p: [b.x, y, b.z], r: [0, b.yaw, 0] });
    B.add(g, b.far ? { far: true } : low ? { low } : undefined);
    if (b.shop) { const f = shopfront(b.seed); place(f, { p: [b.x, y, b.z], r: [0, b.yaw, 0] }); B.add(f); }
    B.blob(b.x, b.z, r, 0.5);
  }

  // Corso: lamps, flower boxes, a line of benches
  for (let u = 0.986, i = 0; u < 1.034; u += 0.0042, i++) for (const s of [-1, 1]) {
    const a = atRoad(u % 1, s * 7), g = i % 2 ? lamp() : flowerbox();
    place(g, { p: [a.x, a.y, a.z], r: [0, a.yaw, 0] }); B.add(g);
  }

  // The Trampolino: O where the road goes under it. Local +x is left of the road, as d.
  const uO = 0.1089, O = atRoad(uO, 0), right = { x: O.p.nx, z: O.p.nz }, cosy = Math.cos(O.yaw), siny = Math.sin(O.yaw);
  const local = (lx, lz) => [O.x + lx * cosy + lz * siny, O.z - lx * siny + lz * cosy];
  const groundLocal = (lx, lz) => { const [x, z] = local(lx, lz); return groundAt(x, z) - O.y; };
  const tram = trampolino(groundLocal), yRoad = track.samples.y[Math.round(uO * track.samples.y.length)];
  O.y = yRoad;
  place(tram, { p: [O.x, O.y, O.z], r: [0, O.yaw, 0] });
  B.add(tram, { far: true });
  { const L = landing({ x: O.x, y: O.y, z: O.z, tx: siny, tz: cosy }, groundAt, right); place(L, { p: [O.x, O.y - O.y + O.y, O.z], r: [0, O.yaw, 0] }); L.translate(0, -O.y, 0); B.add(L); }

  // The Cinque Torri, big enough to read from the road: the true towers stand on the grass where they stand on the map
  {
    const T = world.torri, y = groundAt(T.x, T.z) - 2;
    for (const [dx, dz, h, r, s] of [[0, 0, 62, 24, 1], [42, -10, 46, 17, 2], [-40, 14, 40, 16, 3], [58, 30, 30, 12, 4], [-10, 48, 26, 12, 5], [-64, -18, 22, 10, 6]]) {
      const g = tower(h, r, s); place(g, { p: [T.x + dx, y, T.z + dz] }); B.add(g, { far: true });
    }
  }

  // The talus of the upper meadows: pale boulders scattered in the gold with little larches among them, as in the painting
  for (let i = 0; i < 70; i++) {
    const u = 0.6 + 0.09 * hash3(i, 1, 41), s = hash3(i, 2, 41) < 0.6 ? 1 : -1, a = atRoad(u, s * (12 + 70 * hash3(i, 3, 41) ** 1.3));
    if (terrain.roadDistAt(a.x, a.z) < 9) continue;
    const r = 0.8 + 3.2 * hash3(i, 4, 41) ** 2, g = boulder(i);
    place(g, { p: [a.x, a.y + r * 0.1, a.z], r: [0, hash3(i, 5, 41) * 6, 0], s: r }); B.add(g); B.blob(a.x, a.z, r * 1.3, 0.55);
  }
  // hay, racks, wood along the road
  for (const [u, d, n] of [[0.135, 17, 3], [0.15, -17, 3], [0.595, 16, 3], [0.615, -17, 3], [0.69, 15, 3], [0.73, -16, 2], [0.76, 15, 2], [0.91, -15, 2]]) for (let i = 0; i < n; i++) {
    const a = atRoad(u + i * 0.0022, d + (i % 2) * 3), g = hayBale(false);
    place(g, { p: [a.x, Math.min(a.y, groundAt(a.x + 0.6, a.z), groundAt(a.x - 0.6, a.z), groundAt(a.x, a.z + 0.6), groundAt(a.x, a.z - 0.6)) - 0.03, a.z], r: [0, a.yaw + 0.6 * hash3(i, 3, 3), 0] });
    B.add(g); B.blob(a.x, a.z, 1.55, 0.8);
  }
  for (const [u, d, turn] of [[0.145, -19, 0.2], [0.292, 15, -0.2], [0.585, 18, 0.1], [0.70, 19, -0.3], [0.75, -18, 0.3], [0.885, 17, 0.2], [0.93, -17, 0.1]]) {
    const a = atRoad(u, d), g = hayRack(); place(g, { p: [a.x, a.y, a.z], r: [0, a.yaw + turn, 0] }); B.add(g); B.blob(a.x, a.z, 4.5, 0.5);
  }
  for (const [u, d] of [[0.178, 12], [0.29, -12], [0.34, 13], [0.81, 13], [0.84, -13], [0.905, 13]]) {
    const a = atRoad(u, d), g = woodPile(); place(g, { p: [a.x, a.y, a.z], r: [0, a.yaw + Math.PI / 2, 0] }); B.add(g); B.blob(a.x, a.z, 3.2, 0.7);
  }
  // larch rail fences by the meadows
  for (const [u0, u1, d] of [[0.126, 0.146, 13], [0.15, 0.165, -13], [0.56, 0.585, -11], [0.59, 0.625, 11], [0.68, 0.72, 11], [0.725, 0.76, -11], [0.87, 0.91, 12], [0.26, 0.272, 11]]) {
    let last = atRoad(u0, d);
    for (let u = u0 + 0.0035; u <= u1; u += 0.0035) { const a = atRoad(u, d); if (terrain.roadDistAt(a.x, a.z) > 7.5 && terrain.roadDistAt(last.x, last.z) > 7.5) B.add(fenceRun([last.x, last.z], [a.x, a.z], groundAt)); last = a; }
  }
  // Cows in the pastures of the Giau, looking at you
  const cow = cowGeometry();
  for (let i = 0; i < 26; i++) {
    const u = (i < 18 ? 0.57 + 0.17 * hash3(i, 1, 77) : 0.135 + 0.03 * hash3(i, 1, 77)), s = i % 2 ? 1 : -1, a = atRoad(u, s * (16 + 60 * hash3(i, 2, 77)));
    if (terrain.roadDistAt(a.x, a.z) < 11) continue;
    const g = cow.clone(); place(g, { p: [a.x, a.y, a.z], r: [0, hash3(i, 3, 77) * 6.28, 0], s: 1.15 }); B.add(g); B.blob(a.x, a.z, 2.2, 0.6);
  }
  // Cyclists on the hairpins, on the inside of the road, grinding up: the road is theirs too
  for (let i = 0; i < 34; i++) {
    const ranges = [[0.175, 0.24], [0.345, 0.405], [0.445, 0.56]], r = ranges[i % 3], u = lerp(r[0], r[1], hash3(i, 1, 33)), s = hash3(i, 2, 33) < 0.5 ? 1 : -1, p = P(u), half = (p.w ?? 8.4) / 2, a = atRoad(u, s * (half + 1.1));
    const g = cyclist(i); place(g, { p: [a.x, a.y, a.z], r: [0, a.yaw, 0], s: 1.12 }); B.add(g); B.blob(a.x, a.z, 1, 0.5);
  }
  // Snow poles and wooden rails where the road hangs: red and white, the mark of a high pass
  for (let u = 0.17, i = 0; u < 0.76; u += 0.0058, i++) {
    if (u > 0.245 && u < 0.34) continue;
    for (const s of [-1, 1]) {
      const p = P(u), a = atRoad(u, s * ((p.w ?? 8.4) / 2 + 1.3));
      if (terrain.roadDistAt(a.x, a.z) < 4.6) continue;
      B.add(merge([paint(place(cylinder(0.055, 0.055, 1.3, 5), { p: [a.x, a.y + 0.65, a.z] }), '#f4efe4', 0), paint(place(cylinder(0.06, 0.06, 0.42, 5), { p: [a.x, a.y + 1.12, a.z] }), i % 2 ? RED : '#e9692c', 0)]));
    }
  }
  // the outside of each hairpin: a low dry wall
  for (const m of track.markers.filter((q) => q.tag === 'hairpin')) {
    const u = m.u ?? m.at ?? 0;
    for (let k = -3; k <= 3; k++) {
      const v = u + k * 3.4 / track.length;
      for (const s of [-1, 1]) {
        const p = P(v), a = atRoad(v, s * ((p.w ?? 10) / 2 + 1.6));
        if (terrain.roadDistAt(a.x, a.z) < 6) continue;
        B.add(paint(place(box(1.8, 0.8, 3.3), { p: [a.x, a.y + 0.28, a.z], r: [0, a.yaw, 0] }), '#b8ad9c', 1));
      }
    }
  }
  // the pass sign, the one that really stands there, is left to the rifugio's own wall: no name on the road
}
export function ready() {}
