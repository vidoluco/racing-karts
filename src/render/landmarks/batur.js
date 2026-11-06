// Dal Mare al Batur: Bali from the sea to the caldera. Facts in docs/references/bali-long.md. Placed by control point of the road and
// d, metres left of the centre, or in the plan's coordinates (a at Batur, b to its right), so a retuned road carries its villages along.
// Scenery only: temples stand clear of the road, nothing falls on them (def.sacred), no road enters a courtyard, offerings stay whole.
import * as THREE from 'three';
import { hash3, lerp, smooth, linear, vnoise } from '../math.js';
import { merge, paint, place, box, sphere, capsule, cylinder, cone, lathe, tube } from '../shapes.js';
import { blobAnimal } from '../props.js';
import { meru, bale, guardian, parasol, penjor, umbul, hut, shrine, lelakut, duck, banyan, canoe, offering } from './bali.js';
import { LAKE, lakeInside, lavaAt, cornerHills, abangAt, RICE, riceK } from '../../world/tracks/batur.js';

const WOOD_D = '#4a3020', WOOD_L = '#a77e4e', STONE_L = '#9a9284';
const BRICK = '#a8583c', BRICK_D = '#7c4230', STONE = '#7c7468', STONE_D = '#544c48', IJUK = '#2c2a2c', THATCH = '#8a7350', GOLD = '#e0b13c', WOOD = '#6f4a2e', BAMBOO = '#c9b268', ROCK = '#8a6c4c', ROCK_D = '#5f4836', ROCK_L = '#a98a62', LAVA = '#2f2a32', LAVA_L = '#4a4248', MOSS = '#6f8f4a', WHITE = '#f4efe0', LEAF = '#3f8c44', FOAM = '#fff4e4';
const ab = (a, b) => ({ x: b, z: -a });
const GATE_STONE = '#5c564e', IJUK_D = '#191719', TEAK = '#3c2a1e';

// A brick pier or wall piece: thin red courses, carved grey bands. All walls of this island share these two paints, so nothing is a plain box.
const brick = (w, h, d, p, c = BRICK) => paint(place(box(w, h, d), { p }), c, 16);
const paras = (w, h, d, p, c = STONE) => paint(place(box(w, h, d), { p }), c, 12);
// A small stone flame, what stands on every corner of a Balinese roof line: it is what breaks a straight edge against the sky.
const flame = (x, y, z, s = 1) => [paint(place(cone(0.24 * s, 0.5 * s, 6), { p: [x, y + 0.05 * s, z] }), STONE_L)];
const hipRoof = (w, l, y0, h, color, kind = 13, over = 1) => {
  // four straight planes, the long one meeting at a ridge, a slight sweep at the eaves: a lathe of four sides scaled to a plan reads as a dome
  const W = w * over / 2, L = l * over / 2, r = Math.max(0, Math.min(W, L) ), rx = W - r * 0.98, rz = L - r * 0.98, e = y0 + h * 0.2, E = 0.3;
  const ring = (a, b, y) => [[-a, y, -b], [a, y, -b], [a, y, b], [-a, y, b]];
  const R0 = ring(W, L, y0 - 0.1), R1 = ring(W + (rx - W) * E, L + (rz - L) * E, e), R2 = ring(Math.max(rx, 0.03), Math.max(rz, 0.03), y0 + h), pos = [];
  const tri = (A, B, C) => pos.push(...A, ...B, ...C);
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; for (const [U, V] of [[R0, R1], [R1, R2]]) { tri(U[i], V[j], U[j]); tri(U[i], V[i], V[j]); } }
  tri(R0[0], R0[1], R0[2]); tri(R0[0], R0[2], R0[3]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return paint(g, color, kind);
};

// A window with depth: a dark reveal, a frame proud of the wall, a sill, one mullion, and the shutters folded back. A flat lighter rectangle on a wall is a sticker.
function windowAt(w, h, x, y, z, ry, c = '#3f6c60') {
  const P = [paint(place(box(w, h, 0.12), { p: [0, 0, -0.02] }), '#1f2228'), paint(place(box(0.05, h, 0.05), { p: [0, 0, 0.06] }), WOOD), paint(place(box(w, 0.05, 0.05), { p: [0, h * 0.12, 0.06] }), WOOD)];
  for (const s of [-1, 1]) P.push(paint(place(box(0.12, h + 0.24, 0.2), { p: [s * (w / 2 + 0.06), 0, 0.04] }), WOOD_D), paint(place(box(w * 0.5, h + 0.04, 0.05), { p: [s * (w * 0.75 + 0.16), 0, 0.09] }), c, 2));
  P.push(paint(place(box(w + 0.24, 0.14, 0.2), { p: [0, h / 2 + 0.07, 0.04] }), WOOD_D), paint(place(box(w + 0.46, 0.12, 0.34), { p: [0, -h / 2 - 0.06, 0.1] }), STONE_L));
  return place(merge(P), { p: [x, y, z], r: [0, ry, 0] });
}

// A carved door: two leaves in old red in a heavy frame, the lintel with a line of gold. One small knob each, no strip of colour hung on it.
function doorAt(w, h, x, y, z, ry, c = '#6d2c20') {
  const P = [paint(place(box(w, h, 0.1), { p: [0, h / 2, 0] }), '#201a1a')];
  for (const s of [-1, 1]) P.push(paint(place(box(w / 2 - 0.05, h - 0.1, 0.1), { p: [s * w / 4, h / 2, 0.05] }), c, 2), paint(place(box(w / 2 - 0.24, h * 0.3, 0.05), { p: [s * w / 4, h * 0.7, 0.11] }), '#8a3c2a', 2), paint(place(box(w / 2 - 0.24, h * 0.3, 0.05), { p: [s * w / 4, h * 0.3, 0.11] }), '#8a3c2a', 2), paint(place(sphere(0.05, 5, 3), { p: [s * 0.1, h * 0.5, 0.14] }), GOLD));
  for (const s of [-1, 1]) P.push(paint(place(box(0.2, h + 0.2, 0.26), { p: [s * (w / 2 + 0.1), h / 2 + 0.1, 0.02] }), WOOD_D));
  P.push(paint(place(box(w + 0.6, 0.24, 0.3), { p: [0, h + 0.14, 0.02] }), WOOD_D), paint(place(box(w + 0.2, 0.05, 0.05), { p: [0, h + 0.14, 0.18] }), GOLD));
  return place(merge(P), { p: [x, y, z], r: [0, ry, 0] });
}

// A house of a compound: a plinth, cream paras walls with brick corners, a verandah on posts under a deep hip roof. Open and shadowed where a bungalow is blank.
function meten({ w = 8, l = 6, h = 2.7, roof = IJUK, roofKind = 13, wall = '#d6c4a0', seed = 1 } = {}) {
  const P = [brick(w + 0.6, 2.4, l + 2.2, [0, -0.6, 0.4], BRICK_D), paras(w + 0.9, 0.14, l + 2.5, [0, 0.62, 0.4], STONE_L)];
  P.push(paint(place(box(w, h, l), { p: [0, 0.6 + h / 2, -0.3] }), wall, 6, (x, y) => lerp(0.74, 1.02, smooth(0.6, 2.2, y))));
  for (const a of [-1, 1]) for (const b of [-1, 1]) P.push(brick(0.5, h, 0.5, [a * w / 2, 0.6 + h / 2, -0.3 + b * l / 2]));
  P.push(paras(w + 0.4, 0.22, l + 0.4, [0, 0.6 + h - 0.08, -0.3], STONE));
  const zf = -0.3 + l / 2 + 0.03;
  P.push(doorAt(1.5, 2.1, hash3(seed, 5, 2) < 0.5 ? -w * 0.1 : w * 0.1, 0.62, zf, 0), windowAt(1, 1.05, -w * 0.34, 1.9, zf, 0, ['#3f6c60', '#7a4a32', '#2f5c74'][seed % 3]), windowAt(1, 1.05, w * 0.34, 1.9, zf, 0, ['#3f6c60', '#7a4a32', '#2f5c74'][seed % 3]));
  P.push(windowAt(0.9, 1, w / 2 + 0.02, 1.9, -0.3, Math.PI / 2), windowAt(0.9, 1, -w / 2 - 0.02, 1.9, -0.3, -Math.PI / 2));
  for (const s of [-1, -0.33, 0.33, 1]) P.push(paint(place(cylinder(0.11, 0.14, h, 7), { p: [s * w / 2, 0.6 + h / 2, l / 2 + 1.1] }), WOOD), paint(place(cylinder(0.2, 0.22, 0.26, 8), { p: [s * w / 2, 0.75, l / 2 + 1.1] }), STONE));
  P.push(paint(place(box(w + 0.2, 0.26, 0.2), { p: [0, 0.6 + h - 0.06, l / 2 + 1.1] }), WOOD_D));
  P.push(hipRoof(w + 1.5, l + 3, 0.6 + h, 2.6 + 0.5 * hash3(seed, 7, 2), roof, roofKind));
  P.push(paint(place(sphere(0.2, 6, 4), { p: [0, 0.6 + h + 2.75, 0] }), '#b85a38'));
  return merge(P);
}

// A bale: a raised floor and posts under a true hip roof, no walls: the round roof of a lathe at house size reads as a dome.
function baleOpen(w, l, roof) {
  const P = [brick(w + 0.6, 1.8, l + 0.6, [0, -0.2, 0], BRICK_D), paras(w + 0.9, 0.14, l + 0.9, [0, 0.76, 0], STONE_L)];
  for (const a of [-1, 1]) for (const b of [-1, 0, 1]) P.push(paint(place(cylinder(0.1, 0.13, 2.3, 6), { p: [a * w / 2, 1.95, b * l / 2] }), WOOD));
  P.push(paint(place(box(w + 0.2, 0.2, l + 0.2), { p: [0, 3.1, 0] }), WOOD_D), hipRoof(w + 1.8, l + 1.8, 3.15, 2.4, roof, roof === '#8a3f2a' ? 3 : 13));
  return merge(P);
}

// A padmasana and two little meru: the family's temple in the corner of every compound.
function sanggah(seed = 1) {
  const P = [brick(1.5, 1.8, 1.5, [0, 0.5, 0]), paras(1.9, 0.2, 1.9, [0, 1.42, 0]), brick(1, 1, 1, [0, 2, 0]), paras(1.3, 0.16, 1.3, [0, 2.56, 0]), paint(place(box(0.86, 0.5, 0.2), { p: [0, 2.9, -0.34] }), GOLD), paras(0.9, 0.1, 0.8, [0, 2.7, 0], STONE_L)];
  P.push(place(meru(3, { base: 1.4, foot: 0.5 }), { p: [3, 0, -0.4], s: 1 }));
  P.push(place(hut2(), { p: [-2.8, 0, 0] }));
  return merge(P);
}
function hut2() {
  const P = [paras(1.4, 1.2, 1.2, [0, 0.5, 0], STONE_D)];
  for (const a of [-1, 1]) for (const b of [-1, 1]) P.push(paint(place(cylinder(0.05, 0.06, 1.2, 5), { p: [a * 0.5, 1.7, b * 0.42] }), WOOD_D));
  P.push(hipRoof(1.6, 1.4, 2.25, 1.1, IJUK));
  return merge(P);
}

// A compound behind its wall: the house, a bale, the family's shrines, a frangipani. Every plot its own plan, so a street is not one stamp.
function compound(seed, bamboo = false) {
  const r = (k) => hash3(seed, k, 77), P = [];
  const roofs = bamboo ? ['#6a5238', '#5c4630', '#74583c', '#624a34'] : [IJUK, '#7d6a4a', '#8a3f2a', IJUK, '#6f5a3e'];
  const roof = roofs[seed % roofs.length], kind = roof === '#8a3f2a' ? 3 : 13, wall = bamboo ? ['#c9b48e', '#bfa684', '#d2bf98'][seed % 3] : ['#d6c4a0', '#cdb68c', '#dccbaa', '#c8b08a'][seed % 4];
  const m = meten({ w: 6.5 + 2.5 * r(1), l: 4.5 + 1.5 * r(2), h: 2.4 + 0.5 * r(3), roof, roofKind: kind, wall, seed });
  P.push(place(m, { p: [(r(4) - 0.5) * 7, 0, -2 - 2 * r(5)], r: [0, (r(6) - 0.5) * 0.2, 0] }));
  const side = r(7) < 0.5 ? -1 : 1;
  P.push(place(baleOpen(3.4 + r(8), 4.2 + 1.2 * r(9), roofs[(seed + 1) % roofs.length]), { p: [side * (7 + 2 * r(10)), 0, 2.5 + 2 * r(11)], r: [0, side * 1.57 + (r(12) - 0.5) * 0.3, 0] }));
  P.push(place(sanggah(seed), { p: [-side * (7.5 + r(13)), 0, -6.5], r: [0, r(14) < 0.5 ? 0 : 0.2, 0], s: 0.95 + 0.3 * r(15) }));
  if (r(16) < 0.4) P.push(place(frangipani(seed), { p: [-side * (3.5 + 3 * r(17)), 0, 5 + r(18)], s: 1.2 }));
  return merge(P);
}
const compoundLow = (seed, bamboo) => merge([hipRoof(9, 7, 3, 2.8, bamboo ? '#6a5238' : IJUK), paint(place(box(7, 3.4, 5), { p: [0, 1.5, 0] }), '#c8b08a')]);

// An angkul-angkul, the gate of a compound: two stepped brick piers with bands of carving, a lintel with the guardian's face, a double roof with stone flames at its corners. Seen edge on from the road its stepped outline is what shows. Bamboo shingle at Penglipuran.
function kori({ roof = IJUK, seed = 0, w = 3.4, h = 3.0, penglipuran = false } = {}) {
  const P = [], r = (k) => hash3(seed, k, 31), body = penglipuran ? '#a88a68' : BRICK, h2 = h + 0.5 * r(1);
  P.push(paras(w + 1.3, 0.3, 2.3, [0, 0.15, 0.2], STONE_D), paras(w + 0.6, 0.26, 1.7, [0, 0.42, 0.1], STONE), paras(1.6, 0.14, 0.5, [0, 0.14, 1.5], STONE), paras(1.6, 0.28, 0.4, [0, 0.28, 1.15], STONE));
  for (const s of [-1, 1]) {
    const x = s * (w / 2 - 0.25);
    P.push(paint(place(box(1.2, h2 * 0.5, 1.5), { p: [x, 0.55 + h2 * 0.25, 0] }), body, penglipuran ? 6 : 16));
    P.push(paras(1.42, 0.22, 1.72, [x, 0.55 + h2 * 0.5, 0], STONE));
    P.push(paint(place(box(1, h2 * 0.32, 1.28), { p: [x, 0.66 + h2 * 0.66, 0] }), body, penglipuran ? 6 : 16));
    P.push(paras(1.24, 0.2, 1.52, [x, 0.66 + h2 * 0.82 + 0.1, 0], STONE_L));
    P.push(paras(0.72, 0.42, 1.0, [x, 0.66 + h2 * 0.82 + 0.4, 0], STONE));
    P.push(...flame(x, 0.66 + h2 * 0.82 + 0.76, 0.28), ...flame(x, 0.66 + h2 * 0.82 + 0.76, -0.28));
  }
  P.push(doorAt(w - 2.1, h2 * 0.72, 0, 0.54, 0.05, 0, ['#6d2c20', '#4d3524', '#3a5a50', '#7a4a2a'][seed % 4]));
  const ly = 0.6 + h2 * 0.76;
  P.push(paint(place(box(w - 1.3, 0.56, 1.3), { p: [0, ly + 0.2, 0] }), body, penglipuran ? 6 : 16), paras(w - 0.8, 0.26, 1.5, [0, ly + 0.58, 0], STONE));
  // the carved panel over the door
  P.push(paras(0.92, 0.5, 0.1, [0, ly + 0.2, 0.68], STONE_L), paint(place(box(0.6, 0.26, 0.05), { p: [0, ly + 0.2, 0.74] }), '#4a423c'), paint(place(sphere(0.07, 5, 3), { p: [0, ly + 0.2, 0.78] }), GOLD));
  const ry = ly + 0.7, kind = 13;
  P.push(hipRoof(w - 0.6, 2.4, ry, 0.95, roof, kind), hipRoof(w * 0.46, 1.3, ry + 0.8, 0.82, roof, kind), paint(place(sphere(0.14, 6, 4), { p: [0, ry + 1.66, 0] }), penglipuran ? '#8a6a44' : GOLD));
  return merge(P);
}

// The great split gate: one tower cut through and its halves pulled apart. Fine red courses, carved grey bands in two widths, a niche in each tier, stone flames all up the outer edge, moss low down.
function gateHalf(side, h = 13, foot = 5, depth = 4.6, body = BRICK) {
  const bk = body === BRICK ? 16 : 1;
  const P = [paras(foot + 1.6, 3.6, depth + 1.6, [side * (foot + 1.6) / 2, -0.9, 0], STONE_D), paras(foot + 0.9, 0.7, depth + 0.9, [side * (foot + 0.9) / 2, 1.05, 0], STONE)];
  let y = 1.4;
  const steps = 8;
  for (let i = 0; i < steps; i++) {
    const t = i / steps, w = lerp(foot, 0.9, t ** 0.9), d = lerp(depth, 1.5, t), sh = ((h - 1.4) / steps) * lerp(1.34, 0.66, t);
    P.push(paint(place(box(w, sh * 0.62, d), { p: [side * w / 2, y + sh * 0.31, 0] }), body, bk, (x, yy) => lerp(0.74, 1.04, smooth(y, y + sh * 0.6, yy))));
    if (w > 1.7) for (const q of [-1, 1]) {
      P.push(paint(place(box(w * 0.42, sh * 0.34, 0.12), { p: [side * w * 0.52, y + sh * 0.3, q * (d / 2 + 0.04)] }), STONE, 12), paint(place(box(w * 0.2, sh * 0.2, 0.05), { p: [side * w * 0.52, y + sh * 0.3, q * (d / 2 + 0.11)] }), '#3c3430'));
    }
    if (w > 1.2) P.push(paint(place(box(0.14, sh * 0.34, d * 0.42), { p: [side * (w + 0.04), y + sh * 0.3, 0] }), STONE, 12));
    P.push(paras(w + 0.34, sh * 0.1, d + 0.34, [side * (w + 0.34) / 2, y + sh * 0.68, 0], '#8e8a7e'));
    P.push(paras(w + 0.62, sh * 0.2, d + 0.62, [side * (w + 0.62) / 2, y + sh * 0.84, 0], STONE));
    if (i < steps - 1) for (const q of [-1, 0, 1]) P.push(...flame(side * (w + 0.3), y + sh + 0.08, q * (d / 2 + 0.22), lerp(1.5, 0.9, t)));
    y += sh;
  }
  P.push(paint(place(sphere(0.5, 8, 6), { p: [side * 0.42, y + 0.25, 0], s: [1, 0.7, 1] }), STONE), paint(place(sphere(0.32, 8, 6), { p: [side * 0.34, y + 0.7, 0], s: [1, 1.4, 1] }), STONE_L), paint(place(sphere(0.12, 6, 4), { p: [side * 0.26, y + 1.2, 0] }), GOLD));
  return merge(P);
}
const gate = (gap, h, body = BRICK) => merge([place(gateHalf(1, h, 5, 4.6, body), { p: [gap / 2, 0, 0] }), place(gateHalf(-1, h, 5, 4.6, body), { p: [-gap / 2, 0, 0] })]);

// The great palace gate of Ubud: a tall carved tower with a stair, red and grey, its wooden door in old gold and red; no way through for a kart.
function koriAgung() {
  const P = [];
  for (let i = 0; i < 7; i++) {
    const t = i / 7, w = lerp(11, 2.6, t), d = w * 0.6, y = i * 2.45;
    P.push(paint(place(box(w, 1.8, d), { p: [0, y + 0.9, 0] }), BRICK, 16, (x, yy) => lerp(0.76, 1.03, smooth(y, y + 1.8, yy))), paras(w + 0.5, 0.3, d + 0.5, [0, y + 1.96, 0], '#8e8a7e'), paras(w + 0.8, 0.34, d + 0.8, [0, y + 2.28, 0], STONE));
    if (w > 4) for (const q of [-1, 1]) P.push(paras(1.1, 1.3, 0.14, [q * w * 0.34, y + 0.9, d / 2 + 0.05], STONE));
    for (const a of [-1, 1]) for (const b of [-1, 1]) P.push(...flame(a * (w / 2 + 0.3), y + 2.55, b * (d / 2 + 0.3), 1.4));
  }
  P.push(place(doorAt(3, 5.8, 0, 0, 3.32, 0, '#7a2c1e'), {}), paint(place(cone(0.8, 3, 8), { p: [0, 18.6, 0] }), STONE_L), paint(place(sphere(0.34, 7, 5), { p: [0, 20.2, 0] }), GOLD));
  for (let i = 0; i < 5; i++) P.push(paras(4.4, 0.5, 1, [0, 0.25 + i * 0.5 - 0.1, 8 - i], STONE));
  for (const s of [-1, 1]) P.push(brick(13, 3.2, 1.2, [s * 12, 1.6, 0]), paras(13.4, 0.36, 1.5, [s * 12, 3.3, 0], STONE), place(guardian(), { p: [s * 3.4, 0, 6] }), place(parasol(s < 0 ? WHITE : '#e8c14a'), { p: [s * 7, 0, 4] }));
  return merge(P);
}

// A slim meru: a carved stone foot, a narrow timber frame you can see through, and an odd number of black ijuk roofs, each thick and shaggy, each smaller, on the one post. Never a stack of floors.
function meruSlim(tiers, { base = 6.4 } = {}) {
  const P = [paint(place(box(base * 0.86, 4, base * 0.86), { p: [0, -0.9, 0] }), STONE_D, 12), paint(place(box(base * 0.92, 0.2, base * 0.92), { p: [0, 1.15, 0] }), STONE, 12), paint(place(box(base * 0.66, 1.2, base * 0.66), { p: [0, 1.8, 0] }), '#4a453e', 12), paint(place(box(base * 0.74, 0.2, base * 0.74), { p: [0, 2.46, 0] }), STONE, 12)];
  P.push(paint(place(box(base * 0.2, 0.9, 0.1), { p: [0, 1.76, base * 0.34] }), '#6d2c20', 2));
  const fh = base * 0.34;
  for (const a of [-1, 1]) for (const b of [-1, 1]) P.push(paint(place(box(0.2, fh + 0.3, 0.2), { p: [a * base * 0.24, 2.56 + fh / 2, b * base * 0.24] }), TEAK));
  P.push(paint(place(box(base * 0.2, fh + 0.3, base * 0.2), { p: [0, 2.56 + fh / 2, 0] }), TEAK));
  let y = 2.56 + fh;
  for (let i = 0; i < tiers; i++) {
    const t = i / Math.max(1, tiers - 1), w = lerp(base, 0.95, t ** 0.78), hT = lerp(1.15, 0.72, t), gap = lerp(0.82, 0.42, t);
    // the hem, cut thick, then the skirt rising in a slight curve to the post
    P.push(paint(place(lathe([[w * 0.74, y - 0.2], [w * 0.74, y + 0.04], [w * 0.5, y + hT * 0.46], [w * 0.2, y + hT]], 4), { r: [0, Math.PI / 4, 0] }), IJUK_D, 13));
    y += hT;
    if (i < tiers - 1) { P.push(paint(place(box(Math.max(0.42, w * 0.2), gap + 0.1, Math.max(0.42, w * 0.2)), { p: [0, y + gap / 2, 0] }), TEAK), paint(place(box(Math.max(0.56, w * 0.28), 0.1, Math.max(0.56, w * 0.28)), { p: [0, y + gap * 0.5, 0] }), '#7a5a38')); y += gap; }
  }
  P.push(paint(place(cone(0.3, 1.1, 6), { p: [0, y + 0.5, 0] }), '#2a2628'), paint(place(sphere(0.14, 6, 4), { p: [0, y + 1.1, 0] }), GOLD));
  return merge(P);
}

// A leaf clump: broken facets, no ball. Thin foliage paint, so it never shines nor inks its creases.
function leafLump(seed, r, c, kind = 14) {
  const g = new THREE.IcosahedronGeometry(1, 1), Q = g.attributes.position;
  for (let i = 0; i < Q.count; i++) {
    const x = Q.getX(i), y = Q.getY(i), z = Q.getZ(i), k = 0.76 + 0.5 * hash3(Math.round(x * 9) + seed, Math.round(y * 9), Math.round(z * 9));
    Q.setXYZ(i, x * k * r, y * k * r * 0.78, z * k * r);
  }
  g.computeVertexNormals(); g.deleteAttribute('uv');
  return paint(g, c, kind, (x, y) => lerp(0.62, 1.16, smooth(-r * 0.7, r * 0.7, y)));
}
// A blade or leaf pointing out from a point, for the outline a clump has against the light.
function blade(px, py, pz, ang, tilt, L, w, c) {
  const g = cone(w, L, 3);
  place(g, { p: [0, L / 2, 0] }); place(g, { r: [tilt, 0, 0] }); place(g, { r: [0, ang, 0] }); place(g, { p: [px, py, pz] });
  return paint(g, c, 14, (x, y) => 1);
}

// The sea temple's rock: one great mass the tide has cut into level ledges, narrowed at its foot by the surf so that it overhangs the water. It is a solid: no hole through it, that is the other rock.
function rockLedges(rx, h, rz, seed = 2, segs = 56, rows = 46) {
  const pos = [], idx = [], nv = (a, b) => vnoise(a + seed * 3.1, b - seed * 1.7), BANDS = 5.2;
  for (let i = 0; i <= rows; i++) {
    const t = i / rows, y0 = -3 + (h + 3) * t;
    for (let s = 0; s <= segs; s++) {
      const a = (s / segs) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      // the plan is the same at every height, so the ledges run level all round; it wanders only a little on the way up
      const n1 = nv(ca * 1.35 + 3, sa * 1.35), n2 = nv(ca * 3.3 + 9, sa * 3.3), n3 = nv(ca * 1.6 + t * 1.6 + 5, sa * 1.6);
      let pr = 0.8 + 0.36 * n1 + 0.14 * (n2 - 0.5) + 0.1 * (n3 - 0.5);
      // the notch of the tide, then a ledge per band: narrow at its foot, a proud lip on top
      pr *= t < 0.24 ? lerp(0.68, 1, smooth(0.08, 0.24, t)) : 1;
      const f = t > 0.16 && t < 0.92 ? (((t - 0.16) * BANDS) % 1 + 1) % 1 : 1;
      pr *= 0.9 + 0.1 * smooth(0, 0.82, f);
      pr *= lerp(1, 0.88, t);
      if (t > 0.92) pr *= lerp(1, 0.08, ((t - 0.92) / 0.08) ** 1.5);
      pos.push(ca * rx * pr, y0 + (t < 0.92 ? (n2 - 0.5) * 0.7 : 0), sa * rz * pr);
    }
  }
  for (let i = 0; i < rows; i++) for (let s = 0; s < segs; s++) { const A = i * (segs + 1) + s, B = A + 1, C = A + segs + 1, D = C + 1; idx.push(A, C, B, B, C, D); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
const TL = { rx: 72, rz: 56, H: 34 };
function tanahLot() {
  const { rx, rz, H } = TL, P = [];
  // tide-dark at the foot, the old sand and limestone paler up each ledge
  P.push(paint(rockLedges(rx, H, rz), '#8a7660', 9, (x, y) => {
    const t = (y + 3) / (H + 3), f = (((t - 0.16) * 5.2) % 1 + 1) % 1;
    return lerp(0.34, 1, smooth(1, 8, y)) * lerp(0.58, 1.14, smooth(0.05, 0.86, f));
  }));
  // the caves the sea has cut, on the side the shore sees
  for (const [a, w] of [[1.1, 7], [1.5, 9], [1.95, 6], [0.62, 6], [2.5, 7]]) P.push(paint(place(sphere(1, 8, 6), { p: [Math.cos(a) * rx * 0.72, 2.2, Math.sin(a) * rz * 0.72], s: [w, 3.6, 4], r: [0, -a, 0] }), '#120e0c'));
  // the thick cap of old trees over the left of it, hanging down over the edge
  for (let k = 0; k < 52; k++) {
    const x = rx * (-0.84 + 0.92 * hash3(k, 1, 9)), z = rz * (-0.78 + 1.56 * hash3(k, 2, 9)), edge = Math.hypot(x / (rx * 0.9), z / (rz * 0.86)), r = 5.5 + 5 * hash3(k, 3, 9);
    if (edge > 1) continue;
    P.push(place(leafLump(k + 3, r, hash3(k, 5, 9) < 0.95 ? ['#123a26', '#184a2c', '#0e3222', '#205830', '#164028'][k % 5] : '#7c3050', 15), { p: [x, H - 2 + 5.5 * hash3(k, 4, 9) - 7 * Math.max(0, edge - 0.6) + (1 - edge) * 5, z], r: [0, k, 0] }));
  }
  // on its right the black thatch of the temple against the sky: meru and open pavilions behind a low wall, the stair up to them cut through the ledges
  const cx = rx * 0.46;
  P.push(paint(place(box(rx * 0.74, 3.6, rz * 0.9), { p: [cx, H - 1.6, -rz * 0.04] }), '#4e463c', 12), paint(place(box(rx * 0.76, 0.3, rz * 0.92), { p: [cx, H + 0.3, -rz * 0.04] }), STONE_D, 12));
  for (const [x, z, t, base, sc] of [[0.22, -0.26, 9, 6.2, 1.5], [0.56, -0.3, 7, 5.6, 1.45], [0.8, -0.04, 5, 5, 1.35], [0.34, 0.1, 3, 4.6, 1.25]]) P.push(place(meruSlim(t, { base }), { p: [rx * x, H - 0.4, rz * z], s: sc }));
  for (const [x, z, r] of [[0.58, 0.24, 0.2], [0.1, -0.02, 1.57]]) P.push(place(bale({ w: 7, l: 10, h: 2.7, rh: 3.6, plinth: 0.8, thatch: IJUK_D }), { p: [rx * x, H + 0.1, rz * z], r: [0, r, 0], s: 1.25 }));
  const n = 26, zb = rz * 1.02 + 9, zt = rz * 0.62;
  for (let i = 0; i < n; i++) { const y = lerp(0.6, H + 0.2, i / (n - 1)), z = lerp(zb, zt, i / (n - 1)); P.push(paint(place(box(8, y + 2, 2.6), { p: [cx, y / 2 - 1, z] }), i % 2 ? '#6a6054' : '#7c7264', 12)); }
  for (const q of [-1, 1]) { const m = lerp(zb, zt, 0.5), l = Math.hypot(H, zb - zt); P.push(paint(place(box(0.9, 1.1, l), { p: [cx + q * 4.2, H / 2 + 0.9, m], r: [Math.atan2(H, zb - zt), 0, 0] }), STONE_D, 12)); }
  P.push(place(gate(2.2, 8, GATE_STONE), { p: [cx, H + 0.2, zt - 1], s: 0.9 }));
  P.push(place(parasol(WHITE), { p: [cx - 7, 1.4, zb + 3] }), place(parasol('#e8c14a'), { p: [cx + 7, 1.4, zb + 3] }));
  return merge(P);
}
const tanahLotLow = () => { const { rx, rz, H } = TL; return merge([paint(place(sphere(1, 16, 8), { p: [0, H * 0.42, 0], s: [rx * 0.92, H * 0.62, rz * 0.92] }), '#5e4e3e'), paint(place(sphere(1, 12, 6), { p: [-rx * 0.34, H + 2, 0], s: [rx * 0.52, 9, rz * 0.7] }), '#245e3e'), ...[[0.22, -0.26, 22], [0.56, -0.3, 19], [0.8, -0.04, 14]].map(([x, z, h]) => paint(place(cone(5.2, h, 4), { p: [rx * x, H + h / 2 + 1, rz * z], r: [0, Math.PI / 4, 0] }), IJUK_D))]); };

// Bamboo: a clump thick at the root, tall culms leaning out, and the mass of feathery leaf hanging off its top third. A thin stick with sprigs reads as nothing.
function bambooClump(seed) {
  const P = [], G = ['#3f8444', '#4c9046', '#347a40', '#5c9a4a', '#44884a'];
  for (let k = 0; k < 9; k++) {
    const a = k * 2.4 + seed, r = 0.3 + 0.8 * hash3(k, seed, 1), h = 13 + 9 * hash3(k, seed, 2), lean = 2.5 + 4 * hash3(k, seed, 3), ca = Math.cos(a), sa = Math.sin(a);
    const at = (t) => { const o = lerp(0, 1, t ** 1.7) * lean + r; return [ca * o, h * t - 1.4 * t ** 4, sa * o]; };
    P.push(paint(tube([at(0), at(0.5), at(0.8), at(1)], [0.11, 0.09, 0.06, 0.03], 4), k % 3 ? '#7fa24a' : '#a3b552'));
    // a dozen narrow sprays hung off the upper half of the culm, pointing out and down: what makes a clump a plume and not a stack of plates
    for (let q = 0; q < 10; q++) {
      const t = lerp(0.38, 1, q / 9), p = at(t), b = a + (q % 2 ? 1 : -1) * (0.6 + 1.3 * hash3(k, q, seed)), L = lerp(3.2, 2, t) * (0.8 + 0.4 * hash3(q, k, seed)), tilt = 2.3 - 0.4 * t + 0.25 * hash3(q, seed, k);
      const g = cone(0.26 + 0.12 * hash3(k, q, 3), L, 3);
      place(g, { p: [0, -L / 2, 0] }); place(g, { r: [Math.PI - tilt, 0, 0] }); place(g, { r: [0, Math.PI / 2 - b, 0] }); place(g, { p });
      P.push(paint(g, G[(k + q) % 5], 0, () => 0.8 + 0.4 * hash3(k, q, 7)));
    }
  }
  return merge(P);
}

// Aa lava: broken clinker with hard edges, half sunk, each block its own dark. Fat smooth boulders on a flat plain read as pebbles on mud.
function clinker(seed, r = 1, detail = 0) {
  const g = new THREE.IcosahedronGeometry(1, detail), Pz = g.attributes.position;
  for (let i = 0; i < Pz.count; i++) {
    const x = Pz.getX(i), y = Pz.getY(i), z = Pz.getZ(i), k = 0.72 + 0.6 * hash3(Math.round(x * 11) + seed, Math.round(y * 11), Math.round(z * 11));
    Pz.setXYZ(i, x * k * r * (0.9 + 0.5 * hash3(seed, 1, 5)), y * k * r * (0.55 + 0.35 * hash3(seed, 2, 5)), z * k * r * (0.9 + 0.5 * hash3(seed, 3, 5)));
  }
  g.computeVertexNormals();
  g.deleteAttribute('uv');
  const q = hash3(seed, 6, 2), c = q < 0.5 ? '#2c2529' : q < 0.85 ? '#352c31' : '#42363a';
  return paint(g, c, 0, (x, y) => lerp(0.7, 1.05, smooth(-r * 0.3, r * 0.7, y)));
}

// The floating fish cages of the lake: a bamboo grid on blue barrels, a keeper's hut.
function fishCages(nx, nz) {
  const P = [], s = 7;
  for (let i = 0; i <= nx; i++) P.push(paint(place(box(0.5, 0.3, nz * s), { p: [(i - nx / 2) * s, 0.6, 0] }), BAMBOO));
  for (let j = 0; j <= nz; j++) P.push(paint(place(box(nx * s, 0.3, 0.5), { p: [0, 0.6, (j - nz / 2) * s] }), BAMBOO));
  for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) P.push(paint(place(cylinder(0.5, 0.5, 1.2, 7), { p: [(i - nx / 2) * s, 0.25, (j - nz / 2) * s], r: [0, 0, Math.PI / 2] }), (i + j) % 2 ? '#2d7fc4' : '#3a92d4'));
  P.push(place(hut(), { p: [0, -0.2, 0] }));
  return merge(P);
}

// A fisherman's jetty: a deck of thick planks on two rows of stout piles standing in the water, a rail on one side, a shelter at its end and a jukung tied to it.
function jetty(len, seed) {
  const P = [paint(place(box(3, 0.32, len), { p: [0, 1.5, 0] }), '#8a6c44', 2)];
  for (const q of [-1, 1]) P.push(paint(place(box(0.24, 0.2, len), { p: [q * 1.4, 1.24, 0] }), '#6a5234'));
  for (let k = 0; k <= len / 4.5; k++) for (const q of [-1, 1]) {
    P.push(paint(place(cylinder(0.17, 0.2, 4.6, 6), { p: [q * 1.42, -0.5, -len / 2 + k * 4.5] }), '#4e3c2a'));
    if (k % 2 === 0 && q > 0) P.push(paint(place(cylinder(0.05, 0.05, 1.1, 4), { p: [q * 1.42, 2.1, -len / 2 + k * 4.5] }), '#6a5234'));
  }
  P.push(paint(place(box(0.08, 0.08, len), { p: [1.42, 2.62, 0] }), '#6a5234'));
  P.push(place(bale({ w: 3, l: 3.4, h: 2.2, rh: 2, plinth: 0.1, thatch: IJUK }), { p: [0, 1.6, -len / 2 + 2] }));
  P.push(place(canoe(['#e0b13c', '#2d7fc4', '#d9483b'][seed % 3]), { p: [3.6, 0.4, -len * 0.2], s: 1.3 }));
  return merge(P);
}

// The penjor-lined viewing terrace of Penelokan: a stone balustrade with its balusters, parasols, the drop past it.
function terrace() {
  const P = [paint(place(box(46, 6, 18), { p: [0, -2.6, 0] }), STONE, 12), paint(place(box(46.6, 0.3, 18.6), { p: [0, 0.45, 0] }), '#a89478')];
  for (let k = 0; k < 24; k++) P.push(paras(0.5, 1.1, 0.5, [-23 + k * 2, 1.1, 9], STONE));
  P.push(paras(46.6, 0.3, 0.7, [0, 1.75, 9], STONE_L));
  for (const [x, c] of [[-16, '#d9483b'], [-8, '#e8c14a'], [0, '#d9483b'], [8, '#e8c14a'], [16, '#d9483b']]) P.push(place(parasol(c), { p: [x, 0.5, 4] }));
  return merge(P);
}
// A restaurant of the rim: open on every side, a dining floor on a brick plinth, tables and lanterns glowing in under a great double roof. All depth, no wall to be blank.
function restaurant(seed = 1) {
  const W = 16, L = 11, P = [brick(W + 1, 3.4, L + 1, [0, -0.7, 0], BRICK_D), paras(W + 1.5, 0.2, L + 1.5, [0, 1.05, 0], STONE_L), paint(place(box(W, 0.1, L), { p: [0, 1.2, 0] }), '#9c7a54', 2)];
  for (let a = -2; a <= 2; a++) for (const b of [-1, 1]) { P.push(paint(place(cylinder(0.18, 0.24, 3.4, 8), { p: [a * W / 4.2, 2.9, b * L / 2] }), WOOD_D)); P.push(paint(place(cylinder(0.3, 0.34, 0.3, 8), { p: [a * W / 4.2, 1.35, b * L / 2] }), STONE)); }
  for (const b of [-1, 1]) P.push(paint(place(cylinder(0.18, 0.24, 3.4, 8), { p: [b * W / 2, 2.9, 0] }), WOOD_D));
  P.push(paint(place(box(W + 0.4, 0.3, L + 0.4), { p: [0, 4.6, 0] }), WOOD));
  // a low carved rail, tables with their lanterns
  for (let a = -6; a <= 6; a++) if (a) P.push(paint(place(box(0.08, 0.7, 0.08), { p: [a * W / 13, 1.6, L / 2] }), WOOD_D));
  P.push(paint(place(box(W, 0.1, 0.12), { p: [0, 1.96, L / 2] }), WOOD_D));
  for (let a = -1; a <= 1; a++) for (const b of [-0.5, 0.5]) {
    P.push(paint(place(cylinder(0.75, 0.75, 0.08, 10), { p: [a * 4.6, 2.02, b * L * 0.7] }), '#c9a874'), paint(place(cylinder(0.08, 0.1, 0.8, 5), { p: [a * 4.6, 1.62, b * L * 0.7] }), WOOD_D));
    P.push(paint(place(sphere(0.3, 7, 5), { p: [a * 4.6, 3.8, b * L * 0.7] }), '#ffcc7a'), paint(place(cylinder(0.02, 0.02, 0.7, 3), { p: [a * 4.6, 4.2, b * L * 0.7] }), WOOD_D));
  }
  // a back wall with its counter, deep in the shade
  P.push(paint(place(box(W * 0.5, 3, 0.3), { p: [0, 2.8, -L * 0.42] }), '#7a6248', 2), doorAt(1.6, 2.2, -2, 1.26, -L * 0.42 + 0.18, 0), windowAt(1.4, 1, 2.2, 2.7, -L * 0.42 + 0.18, 0));
  P.push(hipRoof(W + 3, L + 3.6, 4.7, 2.8, IJUK), hipRoof(W * 0.56, L * 0.6, 7.1, 2.5, IJUK), paint(place(sphere(0.3, 7, 5), { p: [0, 9.7, 0] }), '#b85a38'));
  return merge(P);
}

// The roadside of the lanes, one kind per stretch: what a road has here in place of a racing kerb.
function laneWall(track, S, j0, j1, d, h, c, kind = 12, step = 0.14) {
  const parts = [], U = S.U;
  for (let f = j0; f < j1; f += step) {
    const a = S.at(U(f), d), b = S.at(U(f + step), d), l = Math.hypot(a.x - b.x, a.z - b.z), yb = track.pointAt(U(f + step)).y, y = (a.p.y + yb) / 2;
    // pitched with the road, or each piece stands a step above the last on a climb
    const piece = place(box(0.5 + 0.12 * h, h + 3, l + 0.08), { r: [-Math.atan2(yb - a.p.y, l), 0, 0] });
    parts.push(paint(place(piece, { p: [(a.x + b.x) / 2, y + h / 2 - 1.5, (a.z + b.z) / 2], r: [0, Math.atan2(b.x - a.x, b.z - a.z), 0] }), c, kind));
  }
  return parts.length ? merge(parts) : null;
}
const patok = () => merge([paint(place(box(0.26, 0.9, 0.26), { p: [0, 0.4, 0] }), '#e4dcc8', 12), paint(place(box(0.28, 0.24, 0.28), { p: [0, 0.68, 0] }), '#2c2a2c')]);
// A power pole: every road on the island has them.
const pole = () => merge([paint(place(cylinder(0.09, 0.15, 8, 6), { p: [0, 4, 0] }), '#74706a'), paint(place(box(1.2, 0.1, 0.1), { p: [0, 7.5, 0] }), '#3c3a38'), ...[-0.5, 0.5].map((q) => paint(place(cylinder(0.05, 0.06, 0.2, 5), { p: [q, 7.64, 0] }), '#d8d4c8')), paint(place(box(0.36, 0.52, 0.32), { p: [0.22, 6.5, 0] }), '#58565a')]);
// Pandan by the sea: a fountain of long blades on a short leg, where a ball of green reads as a garden bush.
function pandan(seed) {
  const P = [paint(place(cylinder(0.12, 0.2, 1, 5), { p: [0, 0.45, 0] }), '#6a5a3e')];
  for (let i = 0; i < 9; i++) { const t = i * 2.4 + seed, lean = 0.5 + 0.7 * hash3(seed, i, 3); P.push(paint(place(cone(0.17, 2 + hash3(seed, i, 4), 4), { p: [Math.cos(t) * 0.5 * lean, 1.6, Math.sin(t) * 0.5 * lean], r: [Math.sin(t) * lean, 0, -Math.cos(t) * lean] }), i % 3 ? '#5a7c3c' : '#7c8c44')); }
  return merge(P);
}
// Oranges for sale at the bend: a crate of slats and its heap, the road's own colour up here.
function crate(seed) {
  const P = [paint(place(box(0.9, 0.42, 0.6), { p: [0, 0.21, 0] }), WOOD_L)];
  for (let i = 0; i < 6; i++) P.push(paint(place(sphere(0.15, 6, 4), { p: [(i % 3 - 1) * 0.26, 0.46 + 0.06 * hash3(seed, i, 2), (i < 3 ? -1 : 1) * 0.13] }), i % 2 ? '#f2902a' : '#ee8a1e'));
  return merge(P);
}
// Fishing nets hung out to dry by the lake.
function netRack(seed) {
  const P = [];
  for (const x of [-1.6, 1.6]) P.push(paint(place(cylinder(0.06, 0.08, 2.2, 4), { p: [x, 1, 0] }), BAMBOO));
  P.push(paint(place(box(3.4, 0.07, 0.07), { p: [0, 2, 0] }), BAMBOO));
  // strips of net, each its own drop: a whole sheet reads as a blank sign
  for (let i = 0; i < 5; i++) { const h = 0.7 + 0.8 * hash3(seed, i, 7); P.push(paint(place(box(0.42, h, 0.05), { p: [-1.1 + i * 0.55, 2 - h / 2, 0], r: [0.12 * (hash3(seed, i, 8) - 0.5), 0, 0] }), i % 2 ? '#7a6a58' : '#5f7c74')); }
  return merge(P);
}
// A wall along the street on made ground: brick to the cap, carved grey under it, a pilaster with its flame every few metres. Level with the road, so no cap steps.
function streetWall(track, S, j0, j1, d, h = 2.1, body = BRICK, kind = 16) {
  const parts = [], U = S.U, step = 0.09;
  let n = 0;
  for (let f = j0; f < j1; f += step, n++) {
    const a = S.at(U(f), d), b = S.at(U(f + step), d), l = Math.hypot(a.x - b.x, a.z - b.z), ya = a.p.y, yb = track.pointAt(U(f + step)).y, y = (ya + yb) / 2 - 0.2, cx = (a.x + b.x) / 2, cz = (a.z + b.z) / 2, yaw = Math.atan2(b.x - a.x, b.z - a.z), R = [0, yaw, 0];
    parts.push(paint(place(box(0.55, h + 2.4, l + 0.06), { p: [cx, y - 1.2 + h / 2, cz], r: R }), body, kind), paint(place(box(0.72, 0.18, l + 0.06), { p: [cx, y + h - 0.32, cz], r: R }), STONE, 12), paint(place(box(0.86, 0.2, l + 0.06), { p: [cx, y + h - 0.12, cz], r: R }), STONE, 12));
    if (n % 2 === 0) { parts.push(paint(place(box(0.95, h + 0.42, 0.95), { p: [cx, y + h / 2 - 0.02, cz], r: R }), kind === 16 ? BRICK_D : body, kind), paint(place(box(1.2, 0.2, 1.2), { p: [cx, y + h + 0.26, cz], r: R }), STONE, 12)); parts.push(...flame(cx, y + h + 0.5, cz, 1.2)); }
  }
  return parts.length ? merge(parts) : null;
}



// Surf round a rock: a broken ring of foam lying on the water, thicker on the side the swell comes from, and a thin line further out.
function surf(rx, rz, y, seed) {
  const P = [];
  for (let k = 0; k < 40; k++) {
    const t = k / 40 * Math.PI * 2, r = 0.94 + 0.2 * hash3(k, seed, 2), w = 5 + 8 * hash3(k, seed, 3);
    P.push(paint(place(sphere(1, 7, 3), { p: [Math.cos(t) * rx * r, y, Math.sin(t) * rz * r], s: [w, 0.5, 2.4 + 2.4 * hash3(k, seed, 4)], r: [0, -t + Math.PI / 2, 0] }), FOAM));
    if (k % 2) P.push(paint(place(box(w * 0.9, 0.12, 0.9), { p: [Math.cos(t + 0.03) * rx * (r + 0.22), y - 0.05, Math.sin(t + 0.03) * rz * (r + 0.22)], r: [0, -t + Math.PI / 2, 0] }), FOAM));
  }
  return merge(P);
}

// A pond with lotus and a bale over it: the water garden of Saraswati, seen across its low wall.
function lotusPond() {
  const P = [paint(place(box(46, 1, 26), { p: [0, -0.2, 0] }), STONE, 12), paint(place(box(43, 1.2, 23), { p: [0, 0, 0] }), '#3a8a8a')];
  for (let k = 0; k < 60; k++) {
    const x = -20 + 40 * hash3(k, 1, 4), z = -10 + 20 * hash3(k, 2, 4);
    if (Math.abs(x) < 5 && z < 0) continue;
    P.push(paint(place(cylinder(1.1, 1.1, 0.12, 8), { p: [x, 0.66, z] }), k % 2 ? '#3f9a4a' : '#55a84c'));
    if (k % 3 === 0) P.push(paint(place(sphere(0.55, 6, 4), { p: [x, 1.1, z] }), k % 2 ? '#ec6c90' : '#f4b4c4'));
  }
  P.push(paint(place(box(4, 0.8, 12), { p: [0, 0.8, 6] }), STONE, 12));
  P.push(place(bale({ w: 9, l: 8, h: 3, rh: 3.4, plinth: 1.2, thatch: IJUK }), { p: [0, 0, -5] }));
  P.push(place(meru(3, { base: 6, foot: 1.2 }), { p: [14, 0, -8] }), place(guardian(), { p: [3, 0, 11] }), place(guardian(), { p: [-3, 0, 11] }));
  return merge(P);
}


// A market stall: a bright cloth over bamboo, a heap of what it sells.
function stall(seed, heap) {
  const AW = ['#d9483b', '#2d7fc4', '#f2b53a', '#39a05a', '#e8701f'][seed % 5], P = [paint(place(box(5, 0.14, 3.6), { p: [0, 2.7, 0], r: [0.1, 0, 0] }), AW), paint(place(box(4.4, 0.8, 2), { p: [0, 0.4, 0] }), '#7a5a3a')];
  for (const s of [-1, 1]) for (const q of [-1, 1]) P.push(paint(place(cylinder(0.06, 0.08, 2.8, 5), { p: [s * 2.2, 1.4, q * 1.5] }), BAMBOO));
  for (let k = 0; k < 10; k++) P.push(paint(place(sphere(0.22 + 0.06 * hash3(k, seed, 2), 7, 5), { p: [-1.8 + 3.6 * hash3(k, seed, 3), 0.95 + 0.34 * (k % 3), -0.7 + 1.4 * hash3(k, seed, 4)] }), heap[k % heap.length]));
  return merge(P);
}

// A motorbike on its side stand at the wall, as there always is, a helmet on the seat: leaned, its wheels on the ground, a blob of shadow under it where it is placed.
function scooter(c, seed = 0) {
  const wheel = (z) => [paint(place(cylinder(0.24, 0.24, 0.1, 12), { p: [0, 0.24, z], r: [0, 0, Math.PI / 2] }), '#17161a'), paint(place(cylinder(0.12, 0.12, 0.12, 8), { p: [0, 0.24, z], r: [0, 0, Math.PI / 2] }), '#a8a8a4')];
  const g = merge([
    ...wheel(0.66), ...wheel(-0.6),
    paint(place(capsule(0.17, 0.5, 3, 8), { p: [0, 0.54, -0.36], r: [Math.PI / 2, 0, 0] }), c),
    paint(place(box(0.28, 0.07, 0.56), { p: [0, 0.34, 0.12] }), '#2c2c32'),
    paint(place(box(0.34, 0.66, 0.09), { p: [0, 0.66, 0.46], r: [0.24, 0, 0] }), c),
    paint(place(box(0.14, 0.09, 0.42), { p: [0, 0.5, 0.66], r: [-0.15, 0, 0] }), c),
    paint(place(box(0.27, 0.11, 0.62), { p: [0, 0.76, -0.32] }), '#201e22'),
    paint(place(cylinder(0.024, 0.03, 0.6, 5), { p: [0, 0.74, 0.58], r: [0.26, 0, 0] }), '#3a3a3c'),
    paint(place(cylinder(0.022, 0.022, 0.6, 5), { p: [0, 1.04, 0.5], r: [0, 0, Math.PI / 2] }), '#2a2a2c'),
    paint(place(sphere(0.075, 7, 5), { p: [0, 0.98, 0.58] }), '#f4efe0'),
    paint(place(cylinder(0.02, 0.02, 0.3, 4), { p: [0.15, 0.13, -0.08], r: [0, 0, 0.5] }), '#2a2a2c'),
    paint(place(sphere(0.15, 8, 6), { p: [0, 0.96, -0.3] }), ['#d9483b', '#f4efe0', '#26242a', '#2d7fc4'][seed % 4]),
  ]);
  return place(g, { r: [0, 0, 0.13] });
}

// A rubber raft on the Ayung.
function raft(c) {
  return merge([paint(place(capsule(0.5, 3.4, 3, 8), { p: [0.9, 0.3, 0], r: [Math.PI / 2, 0, 0] }), c), paint(place(capsule(0.5, 3.4, 3, 8), { p: [-0.9, 0.3, 0], r: [Math.PI / 2, 0, 0] }), c), paint(place(box(2, 0.2, 3.4), { p: [0, 0.2, 0] }), '#3a3a42')]);
}





// A stone pool of the hot springs of Toya Bungkah: warm water. Steam is the road's own vents; solid white balls over a pool read as eggs.
function hotPool() {
  const P = [paint(place(cylinder(7.4, 7.8, 1.4, 16), { p: [0, 0.4, 0] }), STONE, 12), paint(place(cylinder(6.6, 6.6, 1.5, 16), { p: [0, 0.5, 0] }), '#6fc0b8')];
  return merge(P);
}

// The village temple of the lake: a meru of nine roofs in a walled court, the split gate facing the road. A smaller, simpler Pura Jati.
function lakeTemple() {
  const P = [paint(place(box(28, 2.6, 26), { p: [0, 0, 0] }), BRICK, 16), paint(place(box(28.4, 0.3, 26.4), { p: [0, 1.4, 0] }), STONE, 12), paint(place(box(26, 3, 24), { p: [0, 0, 0] }), '#7a9a50')];
  P.push(place(meru(9, { base: 8, foot: 2.2 }), { p: [-4, 1.2, -4] }), place(meru(5, { base: 6.5, foot: 1.6 }), { p: [7.5, 1.2, -5] }), place(bale({ w: 5, l: 6, h: 2.4, rh: 3, plinth: 1, thatch: IJUK }), { p: [8, 0.6, 6] }));
  P.push(place(gate(2.8, 12), { p: [0, 0, 13.4] }));
  return merge(P);
}

// Pura Ulun Danu Batur: the temple of the lake at Kalanganyar, moved up to the Penelokan road. A group of slim black meru over a low carved wall, set behind one candi bentar in grey stone: the sheer split faces frame the tallest. The meru are what you see from the road, not the wall.
function ulunDanuBatur() {
  const P = [paint(place(box(88, 3.4, 58), { p: [0, -0.7, 0] }), '#4a453e', 1), paint(place(box(88.6, 0.3, 58.6), { p: [0, 1.1, 0] }), '#6a645a'), paint(place(box(86.4, 3.4, 56.4), { p: [0, -0.5, 0] }), '#6e7c50')];
  for (let x = -44; x <= 44; x += 8) if (Math.abs(x) > 8) { P.push(paint(place(box(1, 2, 1), { p: [x, 1, 29.2] }), GATE_STONE, 1)); P.push(...flame(x, 2, 29.2, 1)); }
  for (const [x, z, t, base] of [[0, -6, 11, 7.2], [-19, -13, 11, 6.8], [20, -12, 9, 6.4], [-33, 2, 7, 5.4], [33, 4, 7, 5.4], [-11, 8, 5, 4.6], [12, 10, 3, 4.2]]) P.push(place(meruSlim(t, { base }), { p: [x, 1.6, z], s: 1.16 }));
  P.push(place(bale({ w: 6, l: 11, h: 2.7, rh: 3.2, plinth: 0.8, thatch: IJUK_D }), { p: [-27, 1.6, 17], r: [0, 1.57, 0] }), place(bale({ w: 6, l: 11, h: 2.7, rh: 3.2, plinth: 0.8, thatch: IJUK_D }), { p: [27, 1.6, 17], r: [0, 1.57, 0] }));
  P.push(place(gate(5, 9.5, GATE_STONE), { p: [0, 0, 30.5], s: 1 }));
  for (const s of [-1, 1]) P.push(place(guardian(), { p: [s * 4.6, 0, 34] }), place(parasol(s < 0 ? WHITE : '#e8c14a'), { p: [s * 9, 0, 33] }), place(parasol(s < 0 ? '#e8c14a' : WHITE), { p: [s * 15, 0, 32] }));
  return merge(P);
}
const ulunLow = () => merge([paint(place(box(88, 3.4, 58), { p: [0, 0, 0] }), '#4a453e'), ...[[0, -6, 27], [-19, -13, 27], [20, -12, 23], [-33, 2, 18], [33, 4, 18]].map(([x, z, h]) => paint(place(cone(4.4, h, 4), { p: [x, h / 2 + 2, z], r: [0, Math.PI / 4, 0] }), IJUK_D)), paint(place(box(12, 9.5, 4), { p: [0, 5, 30.5] }), GATE_STONE)]);

// Frangipani: a bare forked branch, and at each tip a rosette of long leaves round a clump, white and yellow flowers on it. The tree of every Balinese courtyard. Never a ball on a stick.
function frangipani(seed) {
  const P = [paint(place(cylinder(0.16, 0.26, 2.4, 6), { p: [0, 1.2, 0] }), '#7a6650')], G = ['#2f7a44', '#3a8a48', '#28683c'];
  for (let k = 0; k < 3; k++) {
    const a = k * 2.2 + seed, mid = [Math.cos(a) * 1, 3.1 + 0.3 * (k % 2), Math.sin(a) * 1];
    P.push(paint(tube([[0, 2.2, 0], mid], [0.13, 0.09], 4), '#7a6650'));
    for (const q of [-0.6, 0.55]) {
      const tip = [mid[0] + Math.cos(a + q) * 0.95, mid[1] + 0.75 + 0.35 * hash3(k, q * 10, seed), mid[2] + Math.sin(a + q) * 0.95];
      P.push(paint(tube([mid, tip], [0.08, 0.05], 3), '#7a6650'), place(leafLump(k * 7 + seed, 0.52, G[k % 3]), { p: tip }));
      for (let b = 0; b < 7; b++) { const t = b * 0.9 + k, n = 0.8 + 0.4 * hash3(k, b, seed); P.push(blade(tip[0], tip[1] + 0.05, tip[2], t, 1.05, 0.95 * n, 0.15, G[(k + b) % 3])); }
      for (let f = 0; f < 3; f++) P.push(paint(place(sphere(0.07, 4, 3), { p: [tip[0] + Math.cos(f * 2.1 + k) * 0.36, tip[1] + 0.44, tip[2] + Math.sin(f * 2.1 + k) * 0.36] }), f === 1 ? '#f6d65a' : '#fff8ec'));
    }
  }
  return merge(P);
}
// A shrub: clumps of broken leaf and blades standing out of them, its colour in small dots. A smooth ball of green is a toy.
const bush = (c, seed = 3) => {
  const G = ['#2c6e3c', '#3a7e42', '#265e36', '#46883f'], P = [];
  for (let k = 0; k < 3; k++) { const a = k * 2.2 + seed, r = k ? 0.55 : 0; P.push(place(leafLump(k + seed * 5, k ? 0.52 : 0.68, G[k]), { p: [Math.cos(a) * r, k ? 0.44 : 0.62, Math.sin(a) * r] })); }
  for (let k = 0; k < 12; k++) { const a = k * 2.4 + seed, r = 0.26 + 0.5 * hash3(k, seed, 1); P.push(blade(Math.cos(a) * r, 0.34 + 0.4 * hash3(k, seed, 2), Math.sin(a) * r, a, 0.8 + 0.4 * hash3(k, seed, 3), 0.6 + 0.4 * hash3(k, seed, 4), 0.08, G[k % 4])); }
  for (let k = 0; k < 6; k++) { const a = k * 2.4, r = 0.76 - 0.1 * k; P.push(paint(place(sphere(0.085, 3, 2), { p: [Math.cos(a) * r, 0.86 + 0.05 * k, Math.sin(a) * r] }), c)); }
  return merge(P);
};
// A warung: a house with its shop open to the road, a bright cloth on bamboo, a shelf of colour, a bench.
function warung(seed = 1) {
  const AW = ['#b5412f', '#2d6fa4', '#d89a2a', '#2f8a4e'][seed % 4], P = [meten({ w: 6.5, l: 4.5, h: 2.6, roof: seed % 2 ? '#8a3f2a' : IJUK, roofKind: seed % 2 ? 3 : 13, seed })];
  P.push(paint(place(box(7.2, 0.12, 3), { p: [0, 3, 4.4], r: [0.2, 0, 0] }), AW));
  for (const q of [-1, 1]) P.push(paint(place(cylinder(0.07, 0.09, 3, 6), { p: [q * 3.4, 1.5, 5.8] }), BAMBOO));
  P.push(paint(place(box(5, 0.14, 0.8), { p: [0, 1.05, 4.4] }), WOOD_L), paint(place(box(0.14, 1, 0.7), { p: [-2.2, 0.5, 4.4] }), WOOD), paint(place(box(0.14, 1, 0.7), { p: [2.2, 0.5, 4.4] }), WOOD));
  for (let i = 0; i < 7; i++) P.push(paint(place(box(0.5, 0.42 + 0.2 * (i % 2), 0.4), { p: [-2.1 + i * 0.7, 1.35, 4.4] }), ['#e8b23a', '#d9483b', '#2d7fc4', '#f4efe0'][i % 4]));
  return merge(P);
}
const pileCoconut = () => merge([0, 1, 2, 3, 4, 5, 6].map((k) => paint(place(sphere(0.32, 6, 4), { p: [Math.cos(k * 2.1) * 0.55 * (k > 3 ? 0.5 : 1), 0.3 + 0.4 * (k > 3), Math.sin(k * 2.1) * 0.55 * (k > 3 ? 0.5 : 1)] }), k % 2 ? '#5f7a34' : '#7a8c3c')));

const PLOT_A = linear('#8cac4c'), PLOT_B = linear('#8a6444'), PLOT_C = linear('#5f9044'), PLOT_D = linear('#b8b460'), SOIL = linear('#6f7c44'), ORCH = linear('#7e984a'),
  DRY = linear('#aaac5c'), DRY2 = linear('#869450'), YARD = linear('#ac9e64'), YARD2 = linear('#8e9654'), LITTER = linear('#507244'), LITTER2 = linear('#42623a'), ASH = linear('#848e5c'), ASH2 = linear('#6e8050'),
  NEEDLE = linear('#868048'), NEEDLE2 = linear('#62743e'), CULM = linear('#969c44'), CULM2 = linear('#74843c'), WEED = linear('#8aac50'), WEED2 = linear('#709448');
// The low far bank of the lake, wooded, in the olive of the repaint's near hills; the mountain itself is in the painting behind. The lava: plum black in large calm masses, with the rust of the last sun on the broad flows, as painted
const ABANG = linear('#5c7c46'), ABANG_L = linear('#7a9450'), ABANG_G = linear('#486a40');
const LAVA_C = linear('#46383f'), LAVA_C2 = linear('#524148'), LAVA_H = linear('#6c4a46'), SAND = linear('#4a4248'), SAND2 = linear('#564c52');

export function plan({ track, terrain, world }) {
  const P = (u) => track.pointAt(u), keep = world.keepOut;
  const U = (f) => { const j = Math.floor(f), g = f - j, n = track.pointU.length, a = track.pointU[j % n], b = track.pointU[(j + 1) % n]; return ((a + ((b - a + 1) % 1) * g) % 1 + 1) % 1; };
  const at = (u, d, along = 0) => { const p = P(u); return { x: p.x + p.nx * d + p.tx * along, z: p.z + p.nz * d + p.tz * along, p }; };
  world.buildings = [];
  world.S = { U, at };
  // the true road, sample by sample: roadDistAt is a coarse grid, and a stone or a palm on the asphalt is no scenery
  const Sm = track.samples, cells = new Map(), C = 24, key = (x, z) => Math.floor(x / C) * 100003 + Math.floor(z / C);
  for (let i = 0; i < track.n; i += 8) { const k = key(Sm.x[i], Sm.z[i]); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(i); }
  const onRoad = world.onRoad = (x, z, m) => {
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const q of cells.get(key(x + i * C, z + j * C)) ?? []) { const R = Sm.w[q] / 2 + m; if ((x - Sm.x[q]) ** 2 + (z - Sm.z[q]) ** 2 < R * R) return true; }
    return false;
  };
  const site = (kind, f, d, opts = {}) => {
    const u = U(f), { x, z, p } = at(u, d, opts.along || 0), yaw = Math.atan2(-p.nx * Math.sign(d || 1), -p.nz * Math.sign(d || 1)) + (opts.turn || 0);
    world.buildings.push({ kind, x, z, yaw, u, d, ...opts });
    keep.push({ x, z, r: opts.r ?? 8 });
  };

  // the sea temple, out in the surf
  world.tanahLot = ab(-2410, 195);
  keep.push({ ...world.tanahLot, r: 84 });
  world.groundDrop = (x, z) => cornerHills(-z, x);

  // Ubud: the street, compounds either side, the palace, the water garden, the market
  for (let f = 24.05, i = 0; f < 28.9; f += 0.28, i++) for (const side of [-1, 1]) {
    // the palace and the water garden have the plot
    if ((side > 0 && Math.abs(f - 25.5) < 0.7) || (side < 0 && Math.abs(f - 26.6) < 0.7)) continue;
    const g = i * 2 + (side + 1) / 2;
    if (hash3(g, 5, 7) < 0.34) site('warung', f, side * 16.5, { seed: g, r: 7 });
    else site('compound', f, side * (19.5 + 2 * hash3(g, 1, 7)), { seed: g + 100, r: 11, turn: 0.06 * (hash3(g, 2, 7) - 0.5) });
    if (i % 2) site('meten', f + 0.12, side * (37 + 6 * hash3(g, 3, 7)), { seed: g + 140, r: 8, turn: hash3(g, 4, 7) * 0.4 });
    site('kori', f + 0.02, side * 10, { r: 3, seed: g });
  }
  site('koriAgung', 25.5, 23, { r: 26 }); site('lotus', 26.6, -34, { r: 30 });
  for (let f = 27.05, i = 0; f < 27.9; f += 0.14, i++) site('stall', f, (i % 2 ? 1 : -1) * 9.2, { seed: i, r: 4, heap: i % 2 ? ['#f2902a', '#f7b23a', '#e8701f'] : ['#d9483b', '#e8c14a', '#39a05a'] });

  for (const [f, seed] of [[2.2, 400], [4.6, 401], [106.6, 402], [108.2, 403], [14.4, 404], [99.5, 405], [41.5, 406], [80.5, 407]]) site('warung', f, -14, { seed, r: 7 });
  // the banyans of the Monkey Forest
  for (const [f, d] of [[29.8, -32], [30.5, 34]]) site('banyan', f, d, { r: 18 });

  // the rim at Penelokan: terrace looking into the caldera, restaurants and fruit stalls along the road, and the temple of the lake
  site('ulun', 45.7, 56, { r: 56 });
  site('terrace', 47.2, -20, { r: 24, turn: Math.PI });
  site('restaurant', 45.5, -24, { r: 10 }); site('restaurant', 46.2, -26, { r: 10 });
  for (let f = 44.6, i = 0; f < 47.8; f += 0.22, i++) { if (i % 2) site('stall', f, f < 45.6 ? 9.6 : -9.6, { seed: i + 7, r: 4, heap: ['#f2902a', '#f7a02a', '#ee8a1e'] }); else if (i % 3 === 0 && f < 45.6) site('warung', f, 17.5, { seed: i + 40, r: 7 }); }

  // the lake: cages and the temple, Toya Bungkah's pools at the shore, the village
  world.cages = [[LAKE.a - 40, LAKE.b - 120, 6, 4], [LAKE.a + 40, LAKE.b + 60, 7, 3], [LAKE.a - 80, LAKE.b + 120, 5, 3]].map(([a, b, nx, nz]) => ({ ...ab(a, b), nx, nz }));
  world.boats = [[LAKE.a + 60, LAKE.b - 80], [LAKE.a - 60, LAKE.b - 10], [LAKE.a + 110, LAKE.b + 20], [LAKE.a + 20, LAKE.b + 190]].map(([a, b]) => ab(a, b));
  site('pool', 66.3, -26, { r: 9 }); site('pool', 66.8, 28, { r: 9 });
  site('lakeTemple', 68.6, 42, { r: 22 });
  for (const [f, d, s] of [[69.2, 26, 201], [69.6, 42, 202], [70.1, 28, 203], [70.5, 44, 204], [71, 26, 205], [71.5, 42, 206], [72, 30, 207], [72.5, 46, 208], [67.5, 26, 209], [68, 44, 210]]) site(hash3(s, 1, 1) < 0.3 ? 'warung' : 'meten', f, d, { seed: s, r: 8, turn: 0.2 * (hash3(s, 3, 1) - 0.5) });

  // Penglipuran: the village street, one gate after another up both sides, each with its garden wall; the bamboo behind
  for (let f = 88.6, i = 0; f < 92.2; f += 0.2, i++) for (const s of [-1, 1]) {
    site('koriP', f, s * 8.3, { r: 3, seed: i * 3 + (s + 1) * 50 });
    site('compoundP', f, s * 18.3, { seed: 300 + i * 2 + s, r: 9 });
  }
  site('lakeTemple', 88.1, 34, { r: 22 });

  // the woods. Jungle over the country between the two legs, thick by the gorge, open rice by the roads
  const grove = (a, b, r, cover, kinds) => { const q = ab(a, b); world.groves.push({ x: q.x, z: q.z, r, cover, kinds }); };
  for (const [a, b, r] of [[-1500, 300, 420], [-900, 300, 380], [-300, 420, 300], [-2000, 150, 260], [-1100, 620, 240], [-1500, 720, 180], [-500, 700, 200]]) grove(a, b, r, 0.8);
  grove(-640, -40, 240, 0.55, [['tall', 5], ['canopy', 5]]); grove(-750, -60, 120, 0.55, [['tall', 5], ['canopy', 5]]);
  grove(-680, -270, 170, 0.9, [['tall', 6], ['canopy', 4]]);
  // the rim: orange groves and pines on the crest, none toward the view
  for (const [a, b, r] of [[-180, 300, 240], [-200, 620, 220], [-200, -340, 220], [-420, -380, 200], [-30, 1260, 240], [-500, 1280, 240]]) grove(a, b, r, 0.7);
  // the far side of the lake, where the panorama's mountains stand: open, low, nothing tall in front of Batur or Abang
  for (let k = 0; k < 7; k++) grove(1050 + k * 100, -600 + k * 260, 340, -1.3);
  for (let k = 0; k < 5; k++) grove(100 + k * 220, -420 + k * 40, 280, -1.2);
  grove(980, 1040, 300, 0.5);
  // the caldera's wall, a dark forest all along it, thin only at the road's saddle
  for (let t = 96; t <= 264; t += 12) {
    const a0 = 620 + 680 * Math.cos(t * Math.PI / 180), b0 = 420 + 1000 * Math.sin(t * Math.PI / 180);
    if (Math.abs(b0 + 30) < 150) continue;
    for (const q of [0.84, 1.02]) grove(620 + (a0 - 620) * q, 420 + (b0 - 420) * q, 190, 1.25, [['tall', 5], ['canopy', 5]]);
  }
  // the pines of the caldera's inner wall, behind each hairpin, where they hide nothing
  for (const [a, b, r] of [[230, -320, 110], [120, -240, 100], [160, 150, 110], [230, 760, 120], [80, 880, 120]]) grove(a, b, r, 1.1, [['tall', 7], ['canopy', 3]]);
  // bamboo keeps the street of the village, then its forest
  for (const f of [89, 90, 91, 92]) { const q = at(U(f), 0); world.groves.push({ x: q.x, z: q.z, r: 44, cover: -1 }); }
  // the Monkey Forest is its banyans and walls: open under them, not one more ring of crowns
  for (const f of [29.3, 30.3, 31.3, 32.3]) { const q = at(U(f), 0); world.groves.push({ x: q.x, z: q.z, r: 110, cover: -0.9 }); }
  // the shore and the street of Ubud
  for (const f of [24.5, 25.5, 26.5, 27.5, 28.5]) { const q = at(U(f), 0); world.groves.push({ x: q.x, z: q.z, r: 60, cover: -1 }); }
  for (const f of [45, 46, 47, 47.8]) { const q = at(U(f), 0); world.groves.push({ x: q.x, z: q.z, r: 50, cover: -1 }); }

  // black lava: the flows of 1963 and 1974 down to the road and across it, thinning into the first gardens, a green kipuka left standing here and there
  const n01 = (x, z, s) => vnoise(x / s + 3.1, z / s - 7.7);
  world.lavaAt = lavaAt;
  world.keepLava = [];
  for (let k = 0; k < 40; k++) {
    const a = 520 + 500 * hash3(k, 1, 13), b = -640 + 660 * hash3(k, 2, 13);
    if (lavaAt(a, b) > 0.7 && terrain.roadDistAt(b, -a) > 5) world.keepLava.push({ a, b, k });
  }
  for (const [a, b, r] of [[720, -300, 58], [840, -380, 44], [640, -420, 36]]) grove(a, b, r, 1.2, [['canopy', 7], ['palm', 1]]);
  // Each stretch stands on its own ground, so that 9 km do not run on one lawn. Plots and litter are vertex paint, m wide at the least, under the pixel's grass.
  const mixC = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
  const inBox = (a, b, a0, a1, b0, b1, m = 50) => Math.min(smooth(a0 - m, a0 + m, a), 1 - smooth(a1 - m, a1 + m, a), smooth(b0 - m, b0 + m, b), 1 - smooth(b1 - m, b1 + m, b));
  const stretchGround = (x, z, a, b, s, y) => {
    if (world.terraceAt(x, z) > 0.25) return null;
    const n = n01(x, z, 28), n2 = n01(x, z, 74), d = smooth(0.3, 0.7, n * 0.6 + n2 * 0.4);
    const le = lakeInside(a, b);
    // the onion and chilli plots of Songan and Kedisan, on the black soil round the lake: the lake's own country
    const fields = y > 2.5 && le > 1.18 && le < 7 && (a > 700 || b > 700) ? 1 - smooth(5, 7, le) : 0;
    if (fields > 0.02) {
      const ca = Math.floor(a / 21 + 0.25 * n), cb = Math.floor(b / 14 + 0.2 * n2), r = hash3(ca, cb, 91);
      return [...mixC(r < 0.34 ? PLOT_A : r < 0.6 ? PLOT_B : r < 0.82 ? PLOT_C : PLOT_D, SOIL, 0.25 * n), 0.94 * fields];
    }
    let c = null, k = 0;
    const pick = (q, p0, p1) => { if (q > k) { k = q; c = mixC(p0, p1, d); } };
    pick(a < -1750 ? 0.8 * smooth(-150, -60, s) : 0, DRY, DRY2);                      // the coast: salt burnt grass over black stones
    pick(0.62 * inBox(a, b, -1210, -790, -405, -285), YARD, YARD2);                   // Ubud: swept yards
    pick(0.92 * inBox(a, b, -790, -610, -335, -150), LITTER, LITTER2);                // the Monkey Forest: moss and leaf litter
    pick(0.82 * inBox(a, b, -610, 140, -130, 265), SOIL, ORCH);                       // Kintamani: dark soil under the orange trees
    pick(0.82 * inBox(a, b, 140, 520, -300, 150), ASH, ASH2);                         // the inner wall: grey ash and scrub
    pick(0.86 * inBox(a, b, -330, 320, 860, 1130), NEEDLE, NEEDLE2);                  // the far wall: pine needles
    pick(0.74 * inBox(a, b, -1360, -950, 930, 1120), CULM, CULM2);                    // the bamboo: yellow leaf
    if (k > 0.02) return [...c, k];
    // anywhere else, the lawn is broken up by the country's own weeds
    return [...mixC(WEED, WEED2, d), 0.42];
  };
  world.paintAt = (x, z) => {
    const a = -z, b = x, y = terrain.heightAt(x, z), s = -0.781 * (a + 2050) + 0.625 * (b - 420);
    // black sand along the sea and the lake
    const shore = s > -20 || lakeInside(a, b) < 2.2 ? 1 - smooth(2, 6.5, y + 1.6 * (n01(x, z, 24) - 0.5)) : 0;
    const L = lavaAt(a, b);
    // the far bank: flat olive forest, with long soft gullies
    const WA = abangAt(a, b);
    if (WA > 0.02 && y > 2.5) {
      const st = vnoise(b / 40 + 4.1, a / 150), n = n01(x, z, 70), c = st < 0.3 ? ABANG_G : n > 0.55 ? ABANG_L : ABANG;
      return [c[0], c[1], c[2], WA];
    }
    if (L < 0.01 && shore < 0.01) return stretchGround(x, z, a, b, s, y);
    const n = n01(x, z, 42), n3 = n01(x + 300, z, 110);
    const c = L >= shore ? (n3 > 0.62 ? LAVA_H : n > 0.5 ? LAVA_C : LAVA_C2) : (n > 0.5 ? SAND : SAND2);
    return [c[0], c[1], c[2], Math.max(L, shore), L];
  };
  for (let a = 460; a < 1120; a += 90) for (let b = -720; b < 60; b += 90) if (lavaAt(a, b) > 0.5 && !(lakeInside(a, b) < 1)) { const q = ab(a, b); world.groves.push({ x: q.x, z: q.z, r: 70, cover: -1.5 }); }

  // where the ground is stepped rice fields: Tabanan on the way up, the country round the last run on the way down
  const nope = [];
  for (const f of [24.5, 25.5, 26.5, 27.5, 28.5, 89, 90, 91, 92]) { const q = at(U(f), 0); nope.push({ x: q.x, z: q.z, r: 58 }); }
  world.terraceAt = (x, z) => {
    const a = -z, b = x;
    const k = riceK(a, b);
    if (!k) return 0;
    const rd = terrain.roadDistAt(x, z), y = terrain.heightAt(x, z);
    if (rd < 1 || y < 4) return 0;
    for (const q of nope) if ((x - q.x) ** 2 + (z - q.z) ** 2 < q.r * q.r) return 0;
    return k * smooth(1, 3.2, rd) * smooth(4, 7, y);
  };
  world.riceIn = RICE;
  // the forest's paint wins over the rice in terrain.js: on the two rice stretches nothing may call the roadside wood, or it stays plain grass between the fields
  for (let f = 10; f < 23.6; f += 0.5) { const q = at(U(f), 0); world.groves.push({ x: q.x, z: q.z, r: 95, cover: -1.1 }); }
  for (let f = 97; f < 106; f += 0.5) { const q = at(U(f), 0); world.groves.push({ x: q.x, z: q.z, r: 95, cover: -1.1 }); }
  // Abang's wall is its own dark paint: no wood's lighter paint over it, no trees that would lift it into one more green hill
  for (let a = 100; a < 540; a += 70) for (let b = 180; b < 860; b += 70) if (abangAt(a, b) > 0.2) grove(a, b, 80, -1.6);

  // coconut palms on the bunds of the rice, and in a long belt down the coast
  const s0 = 34;
  for (let bz = 800; bz < 2700; bz += s0) for (let bx = -1050; bx < 1450; bx += s0) {
    // on the bunds and the edges of the fields, never in the middle of a wet plot
    const x = bx + (hash3(bx, bz, 3) - 0.5) * s0, z = bz + (hash3(bz, bx, 4) - 0.5) * s0;
    if (!world.riceIn.some(([ca, cb, ra, rb]) => ((-z - ca) / ra) ** 2 + ((x - cb) / rb) ** 2 < 1.5)) continue;
    if (hash3(bx, bz, 5) > 0.14 || world.terraceAt(x, z) > 0.2 || terrain.roadDistAt(x, z) > 90 || onRoad(x, z, 8)) continue;
    world.plant.push({ x, z, kind: 'palm', h: 12 + 12 * hash3(bx, bz, 6) });
  }
  for (let f = 96, i = 0; f < 109.9; f += 0.16, i++) for (const s of [-1, 1]) { if (hash3(i, s, 8) < 0.55 || (s > 0 && f > 104)) continue; const q = at(U(f), s * (15 + 26 * hash3(i, s, 9))); if (onRoad(q.x, q.z, 8)) continue; world.plant.push({ x: q.x, z: q.z, kind: 'palm', h: 13 + 11 * hash3(i, s, 10) }); }
  for (let f = 0, i = 0; f < 9; f += 0.12, i++) { const s = -1; const q = at(U(f), s * (15 + 34 * hash3(i, 4, 8))); if (terrain.heightAt(q.x, q.z) > 2.5 && !onRoad(q.x, q.z, 8)) world.plant.push({ x: q.x, z: q.z, kind: 'palm', h: 14 + 10 * hash3(i, 5, 10) }); }
  // the orange groves of Kintamani, the small trees that cover the rim's slopes by the road, in rows; they stand lower than any view
  for (const [f0, f1, d0] of [[38, 44.3, 15], [44.3, 47.9, 36], [47.9, 59, 15]]) for (let f = f0, i = 0; f < f1; f += 0.07, i++) for (const s of [-1, 1]) for (let r = 0; r < 4; r++) {
    if (hash3(i, s + r * 3, 41) < 0.55) continue;
    const q = at(U(f), s * (d0 + r * 11 + 5 * hash3(i, r, 42)));
    if (onRoad(q.x, q.z, 6) || terrain.heightAt(q.x, q.z) < 6 || lavaAt(-q.z, q.x) > 0.05 || keep.some((c) => (q.x - c.x) ** 2 + (q.z - c.z) ** 2 < (c.r + 3) ** 2)) continue;
    world.plant.push({ x: q.x, z: q.z, kind: 'banana', h: 2.8 + 1.4 * hash3(i, r, 43) });
  }
  // the pines of the far wall, right up to the lane on both sides: this climb is a wood, where everything else is open
  for (let f = 76.4, i = 0; f < 86.5; f += 0.08, i++) for (const s of [-1, 1]) for (let r = 0; r < 3; r++) {
    if (hash3(i, s + r * 3, 51) < 0.42) continue;
    const q = at(U(f), s * (P(U(f)).w / 2 + 3.5 + r * 8.5 + 6 * hash3(i, r, 52)));
    if (onRoad(q.x, q.z, 3.2)) continue;
    world.plant.push({ x: q.x, z: q.z, kind: hash3(i, r, 53) < 0.7 ? 'tall' : 'canopy', h: 10 + 8 * hash3(i, r, 54) });
  }
  // keep the sightline at Batur down the street and the run to the rim
  for (let j = 0; j < 6; j++) { const q = ab(-120 + j * 90, -40); world.groves.push({ x: q.x, z: q.z, r: 70 + j * 14, cover: -1.4 }); }
}

export function build({ track, terrain, batch, world }) {
  const groundAt = world.ground.groundAt, B = batch, { U, at } = world.S;
  const atRoad = (f, d, along = 0) => { const q = at(U(f), d, along); return { ...q, y: groundAt(q.x, q.z), yaw: Math.atan2(q.p.tx, q.p.tz) }; };

  for (const b of world.buildings) {
    const y = groundAt(b.x, b.z);
    let g = null, r = 8, low = null, far = false;
    if (b.kind === 'compound' || b.kind === 'compoundP') { const bam = b.kind === 'compoundP'; g = compound(b.seed, bam); r = 11; low = place(compoundLow(b.seed, bam), { p: [b.x, y, b.z], r: [0, b.yaw, 0] }); }
    else if (b.kind === 'meten') { g = meten({ w: 7 + 2 * hash3(b.seed, 1, 1), l: 5 + hash3(b.seed, 2, 1), roof: [IJUK, '#8a3f2a', '#7d6a4a'][b.seed % 3], roofKind: b.seed % 3 === 1 ? 3 : 13, seed: b.seed }); low = place(compoundLow(b.seed, false), { p: [b.x, y, b.z], r: [0, b.yaw, 0] }); }
    else if (b.kind === 'warung') { g = warung(b.seed); r = 6; }
    else if (b.kind === 'kori') { g = kori({ seed: b.seed, roof: hash3(b.seed, 1, 1) < 0.6 ? IJUK : '#7d6a4a' }); r = 3; }
    else if (b.kind === 'koriP') { g = kori({ seed: b.seed, roof: ['#6a5238', '#5c4630', '#74583c'][b.seed % 3], w: 3.1, h: 2.5 + 0.4 * hash3(b.seed, 2, 3), penglipuran: true }); r = 3; }
    else if (b.kind === 'koriAgung') { g = koriAgung(); r = 14; }
    else if (b.kind === 'lotus') { g = lotusPond(); r = 20; }
    else if (b.kind === 'stall') { g = stall(b.seed, b.heap); r = 3; }
    else if (b.kind === 'banyan') { g = banyan(); r = 14; low = merge([paint(place(cylinder(1.6, 2.3, 12, 5), { p: [b.x, y + 5, b.z] }), '#6d5a48'), paint(place(sphere(1, 8, 5), { p: [b.x, y + 16, b.z], s: [15, 9, 15] }), '#2f8a4c')]); }
    else if (b.kind === 'terrace') { g = terrace(); r = 14; }
    else if (b.kind === 'restaurant') { g = restaurant(); r = 11; }
    else if (b.kind === 'pool') { g = hotPool(); r = 6; }
    else if (b.kind === 'lakeTemple') { g = lakeTemple(); r = 18; }
    else if (b.kind === 'ulun') { g = ulunDanuBatur(); low = place(ulunLow(), { p: [b.x, y, b.z], r: [0, b.yaw, 0] }); far = true; r = 40; }
    if (!g) continue;
    place(g, { p: [b.x, y - 0.05, b.z], r: [0, b.yaw, 0] });
    if (far) B.add(g, { far: true, low }); else if (low) B.add(g, { low }); else B.add(g);
    B.blob(b.x, b.z, r, 0.45);
  }

  // the sea temple, with its surf and the reef you walk out on at low tide
  {
    // its trees to the left and its pavilions to the right as you come along the coast toward it
    const T = world.tanahLot, yaw = Math.atan2(0.53, -0.848);
    B.add(place(tanahLot(), { p: [T.x, 0, T.z], r: [0, yaw, 0] }), { far: true, low: place(tanahLotLow(), { p: [T.x, 0, T.z], r: [0, yaw, 0] }) });
    B.add(place(surf(TL.rx * 0.88, TL.rz * 0.88, 0.25, 4), { p: [T.x, 0, T.z], r: [0, yaw, 0] }), { far: true });
    // a reef of low rock from the shore to the temple's foot
    const parts = [], from = { a: -2310, b: 118 };
    for (let i = 0; i < 12; i++) { const t = (i + 2) / 12, a = lerp(from.a - 20, -2400, t), b = lerp(from.b + 20, 185, t), q = ab(a + 12 * (hash3(i, 1, 5) - 0.5), b + 12 * (hash3(i, 2, 5) - 0.5)); parts.push(paint(place(sphere(1, 7, 4), { p: [q.x, -0.2, q.z], s: [9 + 5 * hash3(i, 3, 5), 0.9, 8 + 4 * hash3(i, 4, 5)] }), i % 2 ? '#3a302a' : '#2e2622')); }
    B.add(merge(parts));
  }

  // jukung on the black sand, a line of them, painted eyes to the sea; a few fishing out on the water
  const sandBoats = [[1.4, -32], [2.2, -30], [3.0, -36], [4.8, -30], [5.5, -34], [6.2, -30], [106.8, -30], [107.6, -34], [108.4, -28], [109.2, -30]];
  sandBoats.forEach(([f, d], i) => { const a = atRoad(f, d), y = Math.max(groundAt(a.x, a.z), 0.2), g = canoe(['#e0b13c', '#2d7fc4', '#d9483b', '#f4efe0', '#39a05a'][i % 5]); place(g, { p: [a.x, y + 0.4, a.z], r: [0, a.yaw + 1.3 + 0.3 * hash3(i, 1, 2), 0], s: 1.5 }); B.add(g); });
  for (const [a, b, r] of [[-2520, 400, 0.3], [-2700, 200, 1.6], [-2480, 700, 2.4]]) { const q = ab(a, b), g = canoe('#e0b13c'); place(g, { p: [q.x, 0.2, q.z], r: [0, r, 0], s: 1.7 }); B.add(g, { far: true }); }

  // rice country: what it is for
  const lk = lelakut(), dk = duck(), cattle = blobAnimal('#c8905a', 1.05, '#8a5a34'), mac = blobAnimal('#a98f70', 0.72, '#e2b9a2');
  for (const [f, d, s] of [[12.4, 46, 1], [13.6, -44, 2], [15.5, 50, 3], [17.3, -42, 4], [18.6, 60, 5], [21.5, -46, 6], [22.5, 52, 7], [99.4, 40, 8], [100.5, -44, 9], [101.6, 50, 10], [102.8, -42, 11], [104.2, 46, 12], [105.2, -40, 13]]) {
    const a = atRoad(f, d), g = s % 3 ? hut() : shrine(); place(g, { p: [a.x, a.y - 0.05, a.z], r: [0, s, 0], s: 1.2 }); B.add(g); B.blob(a.x, a.z, 3, 0.4);
  }
  for (const [f, d] of [[11.5, 24], [13.2, -24], [14.6, 26], [16.1, -22], [18.2, 24], [21.2, -26], [99.8, 22], [101.2, -24], [103.3, 26], [104.6, -22]]) { const a = atRoad(f, d), g = lk.clone(); place(g, { p: [a.x, a.y - 0.05, a.z], r: [0, a.yaw + d, 0], s: 1.3 }); B.add(g); }
  for (const [f, d, n] of [[15.2, 28, 7], [17.6, -30, 6], [102.2, 28, 7]]) for (let i = 0; i < n; i++) { const a = atRoad(f, d + i * 0.2, i * 1.6), g = dk.clone(); place(g, { p: [a.x, a.y, a.z], r: [0, a.yaw + 1.2, 0], s: 1.35 }); B.add(g); }
  for (const [f, d, t] of [[13.4, 22, 0.4], [13.7, 26, 2], [16.4, -20, 1], [100.2, -20, 3], [100.6, 24, 0.7]]) { const a = atRoad(f, d), g = cattle.clone(); place(g, { p: [a.x, a.y - 0.05, a.z], r: [0, a.yaw + t, 0] }); B.add(g); B.blob(a.x, a.z, 2, 0.4); }

  // Ubud's walls, gates astride the street, banners and penjor all down it
  for (const s of [-1, 1]) { const w = streetWall(track, world.S, 24, 28.9, s * 10); if (w) B.add(w); }
  const gateAcross = (f, h = 14, body = BRICK) => { const a = atRoad(f, 0), g = gate(a.p.w + 7, h, body); place(g, { p: [a.x, a.p.y, a.z], r: [0, a.yaw, 0] }); B.add(g, { low: place(merge([-1, 1].map((s) => paint(place(cylinder(0.5, 3.2, h, 4), { p: [s * (a.p.w / 2 + 6), h / 2, 0], r: [0, Math.PI / 4, 0] }), body))), { p: [a.x, a.p.y, a.z], r: [0, a.yaw, 0] }) }); B.blob(a.x + a.p.nx * (a.p.w / 2 + 6), a.z + a.p.nz * (a.p.w / 2 + 6), 5, 0.4); B.blob(a.x - a.p.nx * (a.p.w / 2 + 6), a.z - a.p.nz * (a.p.w / 2 + 6), 5, 0.4); };
  gateAcross(24.2); gateAcross(28.6); gateAcross(88.4, 12); gateAcross(92.1, 12); gateAcross(44.6, 9.5, GATE_STONE); gateAcross(0.15, 13);
  const penjorAt = (f, side, h = 9, reach = 3) => { const q = at(U(f), side * (track.pointAt(U(f)).w / 2 + 3.6)), g = penjor(h + 1.5 * hash3(Math.round(f * 40), 3, 2), reach), yaw = Math.atan2(-q.p.nx * side, -q.p.nz * side); place(g, { p: [q.x, groundAt(q.x, q.z) - 0.1, q.z], r: [0, yaw, 0] }); B.add(g, { low: place(merge([paint(place(cylinder(0.05, 0.11, h, 4), { p: [0, h / 2, 0.4] }), BAMBOO), paint(place(box(0.5, 2.4, 0.2), { p: [0, h - 1.2, 2.2] }), '#ecdf8e')]), { p: [q.x, groundAt(q.x, q.z) - 0.1, q.z], r: [0, yaw, 0] }) }); };
  for (let f = 24.05; f < 28.9; f += 0.5) { penjorAt(f, 1); penjorAt(f + 0.06, -1); }
  for (let f = 88.5; f < 92.2; f += 0.34) { penjorAt(f, 1, 8); penjorAt(f + 0.08, -1, 8); }
  for (let f = 44.5; f < 47.9; f += 0.45) { penjorAt(f, 1); penjorAt(f + 0.08, -1); }
  for (let f = 0.02; f < 1.4; f += 0.3) { penjorAt(f, 1); penjorAt(f + 0.1, -1); }
  for (let f = 108.6; f < 109.9; f += 0.3) { penjorAt(f, 1); penjorAt(f + 0.1, -1); }
  const COLS = ['#e8c14a', '#d9483b', '#2d7fc4', '#f4efe0'];
  for (let f = 24.1, i = 0; f < 28.8; f += 0.5, i++) { const s = i % 2 ? 1 : -1, a = atRoad(f, s * (track.pointAt(U(f)).w / 2 + 2.2)), g = umbul(COLS[i % 4]); place(g, { p: [a.x, a.y, a.z], r: [0, a.yaw, 0] }); B.add(g); }
  for (let f = 24.3, i = 0; f < 28.7; f += 0.42, i++) { const s = i % 2 ? 1 : -1, a = atRoad(f, s * (track.pointAt(U(f)).w / 2 + 2.3)), g = scooter(['#b5412f', '#2d6fa4', '#c8c4b8', '#333'][i % 4], i); place(g, { p: [a.x, a.y + 0.02, a.z], r: [0, a.yaw + 0.8 * s, 0], s: 1.2 }); B.add(g); B.blob(a.x, a.z, 1.3, 0.55); }
  for (const [f, d] of [[24.4, 13.6], [25.2, -13.6], [26.2, 13.6], [27, -13.6], [46.2, -13], [47.2, -14], [89, 14], [91, -14]]) { const a = atRoad(f, d), g = offering(); place(g, { p: [a.x, a.y, a.z], r: [0, a.yaw, 0] }); B.add(g); }

  // the Monkey Forest: walls of mossy stone, statues deep in moss, macaques on everything
  const wall = (f0, f1, d) => { const parts = []; for (let f = f0; f < f1; f += 0.16) { const a = atRoad(f, d), b = atRoad(f + 0.16, d), l = Math.hypot(a.x - b.x, a.z - b.z); parts.push(paint(place(box(1, 3.4, l + 0.2), { p: [(a.x + b.x) / 2, (a.y + b.y) / 2 - 0.5, (a.z + b.z) / 2], r: [0, Math.atan2(b.x - a.x, b.z - a.z), 0] }), MOSS, 1)); } if (parts.length) B.add(merge(parts)); };
  wall(29.1, 31.8, 10.4); wall(29.1, 31.8, -10.4);
  for (const [f, d] of [[29.4, 12], [30.7, -12]]) { const a = atRoad(f, d), g = merge([paint(guardian(), MOSS)]); place(g, { p: [a.x, a.y, a.z], r: [0, a.yaw + 1.57 * Math.sign(-d), 0], s: 1.3 }); B.add(g); }
  for (const [f, d] of [[29.3, 10.6], [30.4, 10.6], [31.6, -10.6]]) { const a = atRoad(f, d), g = mac.clone(); place(g, { p: [a.x, a.y + 1.2, a.z], r: [0, Math.atan2(-a.p.nx * Math.sign(d), -a.p.nz * Math.sign(d)), 0] }); B.add(g); }

  // under the bridge: the river and its rafts
  { const r = ab(-700, -28), g = raft('#f2b53a'); place(g, { p: [r.x, 0.3, r.z], r: [0, 0.1, 0], s: 1.6 }); B.add(g); const r2 = ab(-540, -32), g2 = raft('#d9483b'); place(g2, { p: [r2.x, 0.3, r2.z], r: [0, 2.9, 0], s: 1.6 }); B.add(g2); }

  // the road's own stones through the Kintamani hairpins: offerings of oranges at every other bend
  for (const [f, d] of [[37.5, 12], [39.2, -12], [41.1, 12], [43.3, -12]]) { const a = atRoad(f, d), g = stall(Math.round(f), ['#f2902a', '#f7a02a', '#ee8a1e']); place(g, { p: [a.x, a.y, a.z], r: [0, a.yaw + 1.57 * Math.sign(-d), 0] }); B.add(g); }

  // the lava: clinker piled on the flow, thick by the road, a crag here and there, and it thins out where the gardens start
  {
    const onRoad = world.onRoad;
    let pack = [], tri = 0;
    const add = (g) => { pack.push(g); tri += g.attributes.position.count / 3; if (tri > 6000) { B.add(merge(pack)); pack = []; tri = 0; } };
    let n = 0;
    for (let f = 57.5; f < 65.5; f += 0.012) for (const s of [-1, 1]) {
      n++;
      if (hash3(n, 1, 11) < 0.72) continue;
      const t = hash3(n, 2, 12), d = s * (9.8 + 46 * t * t), a = atRoad(f, d), L = world.lavaAt(-a.z, a.x);
      const big = hash3(n, 3, 14), r = 0.3 + 0.9 * big * big + (big > 0.985 ? 1.1 : 0);
      if (L < 0.5 || onRoad(a.x, a.z, r + 1.6)) continue;
      add(place(clinker(n, r, r > 1.4 ? 1 : 0), { p: [a.x, a.y + r * 0.1, a.z], r: [hash3(n, 4, 1), n, hash3(n, 5, 1)] }));
    }
    for (const q of world.keepLava) {
      const c = ab(q.a, q.b);
      for (let i = 0; i < 26; i++) { const x = c.x + (hash3(i, q.k, 1) - 0.5) * 92, z = c.z + (hash3(i, q.k, 2) - 0.5) * 92, big = hash3(i, q.k, 3), r = 0.5 + 1.5 * big * big; if (onRoad(x, z, r + 1.6)) continue; add(place(clinker(i + q.k * 31, r, 0), { p: [x, groundAt(x, z) + r * 0.05, z], r: [big, i, hash3(i, q.k, 5)] })); }
    }
    if (pack.length) B.add(merge(pack));
  }

  // the country between the villages: nothing long without something a little alive at the roadside
  {
    const fr = [frangipani(1), frangipani(2)], so = shrine(), pc = pileCoconut(), bu = [bush('#d9508a'), bush('#e8701f'), bush('#4f7c4a'), bush('#a4a850')], pan = [pandan(1), pandan(2)], cr = crate(1), nets = [netRack(1), netRack(2)], fern = bush('#3c5e38');
    const skip = [[23.9, 36], [44.4, 48], [88.3, 92.3]];
    let pack = [], cx = 0;
    const flush = () => { if (pack.length) B.add(merge(pack)); pack = []; };
    for (let m = 15, i = 0; m < track.length - 15; m += 19, i++) {
      const u = m / track.length;
      let j = 0;
      while (j + 1 < track.pointU.length && track.pointU[j + 1] <= u) j++;
      if (skip.some(([q0, q1]) => j >= q0 && j < q1)) continue;
      const s = hash3(i, 1, 31) < 0.5 ? 1 : -1, w = track.pointAt(u).w, d = s * (w / 2 + 3.4 + 7 * hash3(i, 2, 31)), q = at(u, d), x = q.x, z = q.z, y = groundAt(x, z);
      if (terrain.roadDistAt(x, z) < 2.2 || y < 2.5 || world.lavaAt(-z, x) > 0.4) continue;
      // the sea side of the coast road stays open, it is what you came for
      if ((j < 8 || j >= 105) && s > 0) continue;
      const r = hash3(i, 3, 31), rot = { p: [x, y - 0.06, z], r: [0, i * 1.3, 0], s: 0.9 + 0.4 * hash3(i, 4, 31) };
      // each stretch has its own roadside
      if (j < 9 || j >= 105) { pack.push(place(r < 0.8 ? pan[i % 2].clone() : pc.clone(), rot)); if (++cx % 12 === 0) flush(); continue; }
      if (j >= 37 && j < 45) { pack.push(place(r < 0.45 ? cr.clone() : r < 0.7 ? so.clone() : bu[3].clone(), rot)); if (++cx % 12 === 0) flush(); continue; }
      if ((j >= 48 && j < 60) || (j >= 76 && j < 86)) { pack.push(place(fern.clone(), rot)); if (++cx % 12 === 0) flush(); continue; }
      if (j >= 65 && j < 76) { pack.push(place(r < 0.5 ? nets[i % 2].clone() : pc.clone(), { ...rot, r: [0, Math.atan2(q.p.tx, q.p.tz), 0], s: 1 })); if (++cx % 12 === 0) flush(); continue; }
      if (j >= 9 && j < 24) { if (r < 0.5) continue; }
      if (j >= 97 && j < 105) { if (r < 0.5) continue; }
      if (r < 0.2) pack.push(place(fr[i % 2].clone(), rot));
      else if (r < 0.72) pack.push(place(bu[i % 4].clone(), rot));
      else if (r < 0.87) pack.push(place(so.clone(), rot));
      else pack.push(place(pc.clone(), rot));
      if (++cx % 12 === 0) flush();
    }
    flush();
  }

  // What runs along the road instead of a kerb, a stretch at a time: drains in the rice, black stone at the coast and the lake, retaining walls on the climbs, bamboo fence in the bamboo
  {
    const hw = (j) => track.pointAt(U(j)).w / 2 + 1.1;
    for (const [j0, j1, s, h, c, kind] of [
      [0.5, 8, -1, 0.7, '#3a3638', 12], [105.5, 109.5, -1, 0.7, '#3a3638', 12],
      [10, 16.5, 1, 0.16, '#7c7a66', 12], [16, 23.4, -1, 0.16, '#7c7a66', 12], [97.5, 101, -1, 0.16, '#7c7a66', 12], [100.5, 104.6, 1, 0.16, '#7c7a66', 12],
      [37.5, 44, 1, 1.25, '#5c5446', 12], [48.2, 59.6, 1, 1.1, '#4a443e', 12], [66, 75.5, 1, 0.6, '#3a3638', 12], [76.5, 85.5, 1, 1.25, '#5c5446', 12], [85.5, 88, -1, 0.9, BRICK, 16],
      [93, 97, 1, 1.05, BAMBOO, 0], [93, 97, -1, 1.05, BAMBOO, 0],
    ]) { const w = laneWall(track, world.S, j0, j1, s * hw(Math.floor(j0)), h, c, kind); if (w) B.add(w); }
    // white and black posts on the open side of the descents, over the drop
    const pk = patok(); let pack = [];
    for (const [j0, j1, s] of [[48.2, 59.6, -1], [76.5, 85.5, -1], [60, 65, -1], [60, 65, 1]]) for (let f = j0; f < j1; f += 0.16) { const q = at(U(f), s * (track.pointAt(U(f)).w / 2 + 0.9)); pack.push(place(pk.clone(), { p: [q.x, q.p.y - 0.1, q.z], r: [0, 0, 0] })); if (pack.length > 40) { B.add(merge(pack)); pack = []; } }
    if (pack.length) B.add(merge(pack));
    // and the poles, out of the villages, all the way round
    const pl = pole(); pack = [];
    let last = null;
    for (let f = 1, i = 0; f < 108; f += 0.48, i++) {
      if (f > 33 && f < 37) { last = null; continue; }
      const s = f < 66 ? 1 : -1, q = at(U(f), s * (track.pointAt(U(f)).w / 2 + 4.6));
      if (terrain.roadDistAt(q.x, q.z) < 1.5 || world.lavaAt(-q.z, q.x) > 0.6 && i % 2) continue;
      const yaw = Math.atan2(q.p.tx, q.p.tz), y = groundAt(q.x, q.z) - 0.1;
      pack.push(place(pl.clone(), { p: [q.x, y, q.z], r: [0, yaw, 0] }));
      // two wires to the last pole, sagging, so that a pole is part of a line and not a post left standing
      const top = [-0.5, 0.5].map((e) => [q.x + Math.cos(yaw) * e, y + 7.72, q.z - Math.sin(yaw) * e]);
      if (last && Math.hypot(q.x - last[0][0], q.z - last[0][2]) < 95) for (const e of [0, 1]) {
        const A = last[e], Z = top[e], M = [0.25, 0.5, 0.75].map((t) => [lerp(A[0], Z[0], t), lerp(A[1], Z[1], t) - 0.62 * (1 - (2 * t - 1) ** 2), lerp(A[2], Z[2], t)]);
        pack.push(paint(tube([A, ...M, Z], 0.035, 3), '#26241f'));
      }
      last = top;
      if (pack.length > 40) { B.add(merge(pack)); pack = []; }
    }
    if (pack.length) B.add(merge(pack));
  }

  // Trunyan's side of the lake: a village at the water under the forest, seen across it; low models, from far away
  {
    let pack = [];
    for (let t = 112; t <= 236; t += 2.6) {
      const near = Math.abs(t - 160) < 22 || Math.abs(t - 212) < 15 || Math.abs(t - 126) < 9;
      if (!near) continue;
      for (const e of [1.14, 1.2, 1.26, 1.32]) {
        const g = Math.round(t * 10 + e * 100), a = LAKE.a + LAKE.ra * (e + 0.05 * hash3(g, 1, 5)) * Math.cos(t * Math.PI / 180), b = LAKE.b + LAKE.rb * (e + 0.05 * hash3(g, 2, 5)) * Math.sin(t * Math.PI / 180), q = ab(a, b), y = groundAt(q.x, q.z);
        if (y < 1.2 || y > 7) continue;
        pack.push(place(compoundLow(g, hash3(g, 3, 5) < 0.3), { p: [q.x, y - 0.1, q.z], r: [0, hash3(g, 4, 5) * 3, 0], s: 0.9 + 0.25 * hash3(g, 6, 5) }));
      }
      if (pack.length > 16) { B.add(merge(pack), { far: true }); pack = []; }
    }
    if (pack.length) B.add(merge(pack), { far: true });
    // the village's temple where the wall leaves it a shelf
    let lq = null;
    for (let t = 2.2; t < 4.4 && !lq; t += 0.05) for (const e of [1.3, 1.4, 1.5]) { const q = ab(LAKE.a + LAKE.ra * e * Math.cos(t), LAKE.b + LAKE.rb * e * Math.sin(t)), y = groundAt(q.x, q.z); if (y > 2 && y < 5 && !world.onRoad(q.x, q.z, 30)) { lq = q; break; } }
    if (lq) { const lt = lakeTemple(); place(lt, { p: [lq.x, groundAt(lq.x, lq.z) - 0.1, lq.z], r: [0, 1.5, 0] }); B.add(lt, { far: true }); }
  }

  // the lake's cages, boats out on the water, the hut in the middle
  for (const c of world.cages) { const g = fishCages(c.nx, c.nz); place(g, { p: [c.x, 0, c.z], r: [0, 0.4, 0] }); B.add(g, { far: true }); }
  // the fishermen's jetties at Toya Bungkah and Songan, bamboo out over the water
  for (const [f, s] of [[67.6, 0], [68.9, 1], [70.3, 2], [71.6, 0]]) {
    const a = atRoad(f, -18), g = jetty(36, s), yaw = Math.atan2(a.p.nx, a.p.nz);
    place(g, { p: [a.x - a.p.nx * 22, 0, a.z - a.p.nz * 22], r: [0, yaw, 0] }); B.add(g);
  }
  world.boats.forEach((q, i) => { const g = canoe(['#e0b13c', '#2d7fc4', '#d9483b', '#39a05a'][i % 4]); place(g, { p: [q.x, 0.2, q.z], r: [0, i * 1.7, 0], s: 1.4 }); B.add(g); });

  // Penglipuran: garden walls along the stone street; bamboo behind it and through the forest after it
  for (const s of [-1, 1]) {
    const w = streetWall(track, world.S, 88.5, 92.15, s * 7.7, 1.35, '#b49a78', 6);
    if (w) B.add(w);
    // the gardens in front of the walls: flowers, clipped green
    const parts = [];
    for (let f = 88.5; f < 92.15; f += 0.08) { const a = atRoad(f, s * 8.9); if (Math.abs(((f - 88.6) / 0.2 + 0.5) % 1 - 0.5) < 0.12) continue; const pick = hash3(Math.round(f * 50), s, 1); parts.push(place(pick < 0.25 ? bush('#e85a8a') : pick < 0.45 ? bush('#f0a03c') : bush('#f4efe0'), { p: [a.x, a.y - 0.1, a.z], s: 0.62 + 0.3 * pick })); }
    B.add(merge(parts));
  }
  for (let f = 88.5, i = 0; f < 97; f += 0.13, i++) for (const s of [-1, 1]) {
    const inVillage = f < 92.3, d = s * ((inVillage ? 38 : 11) + (inVillage ? 30 : 34) * hash3(i, s, 21));
    if (hash3(i, s, 22) < (inVillage ? 0.5 : 0.4)) continue;
    const a = atRoad(f, d), g = bambooClump(i * 3 + s); place(g, { p: [a.x, a.y - 0.2, a.z], s: 0.85 + 0.5 * hash3(i, s, 23) }); B.add(g, { low: paint(place(cone(7.5, 22, 6), { p: [a.x, a.y + 11, a.z] }), '#2f6c3e') });
  }
}

// Once all stands: the crater lake's mirror, captured from its middle. The wall, Batur and Abang upside down in it are what makes it a lake and not a bay.
export function ready({ renderer, scene, world }) {
  const W = world.waterMat;
  if (!W?.uniforms?.uCapture || !world.ground.water) return;
  const rt = new THREE.WebGLCubeRenderTarget(512, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  const q = ab(LAKE.a, LAKE.b), cam = new THREE.CubeCamera(1, 9000, rt);
  cam.position.set(q.x, 1.5, q.z);
  scene.add(cam);
  world.ground.water.visible = false;
  cam.update(renderer, scene);
  world.ground.water.visible = true;
  scene.remove(cam);
  W.uniforms.uCapture.value = rt.texture;
  W.uniforms.uCaptureC.value.set(q.x, 0, q.z);
  W.uniforms.uCaptureR.value = 900;
}
