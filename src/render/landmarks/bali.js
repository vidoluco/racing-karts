// Terrazze di Bali: a village on the terraces under Gunung Agung, the temple of the lake on its two islets. Facts in docs/references/bali.md.
// Everything is placed by road point (track.pointU) and d, metres left of the centre, so a retuned road carries its village along.
// Scenery only: temples and shrines stand clear of the road, nothing here is ever hit, offerings and penjor are left whole, no road enters a courtyard.
import { hash3, lerp, smooth, vnoise, linear } from '../math.js';
import * as THREE from 'three';
import { merge, paint, place, box, sphere, capsule, cylinder, cone, lathe, tube } from '../shapes.js';
import { blobAnimal } from '../props.js';

const BRICK = '#ab5a3e', BRICK_D = '#7f4230', STONE = '#7c7a74', STONE_D = '#55544f', THATCH = '#8a7350', IJUK = '#2c2a2c', GOLD = '#e0b13c', WOOD = '#6f4a2e', WOOD_L = '#a77e4e', TILE = '#b5553a', BAMBOO = '#c9b268', JANUR = '#ecdf8e', WHITE = '#f4efe0', BLACK = '#26242a', LEAF = '#3f9a4a';

// A frustum of a square roof, in plan a square: lathe with four sides, turned to sit square.
const squareTier = (r0, r1, y0, y1, color, kind = 3) => paint(place(lathe([[r0, y0], [r1, y1]], 4), { r: [0, Math.PI / 4, 0] }), color, kind);

// A meru: a stepped foot of carved grey paras and red brick, then an odd number of black ijuk roofs, wide at the bottom and tiny at the top, on short dark posts, with a gold finial.
export function meru(tiers, { base = 7.5, foot = 3.6 } = {}) {
  const P = [];
  // three steps of carved stone, each proud of the one above, so the brick never meets the water's stone at a hard line
  P.push(paint(place(box(base + 2.4, foot * 0.8 + 3, base + 2.4), { p: [0, foot * 0.4 - 1.5, 0] }), STONE_D, 12));
  P.push(paint(place(box(base + 1.5, foot * 0.5, base + 1.5), { p: [0, foot * 1.05, 0] }), STONE, 12));
  P.push(paint(place(box(base + 2, 0.22, base + 2), { p: [0, foot * 1.32, 0] }), '#a8a498'));
  P.push(paint(place(box(base + 0.5, foot * 0.55, base + 0.5), { p: [0, foot * 1.6, 0] }), BRICK, 16));
  P.push(paint(place(box(base + 0.9, 0.26, base + 0.9), { p: [0, foot * 1.9, 0] }), '#a8a498'));
  // a door each side, carved and gilded
  for (const a of [0, Math.PI]) P.push(place(merge([paint(place(box(2, 2.6, 0.2), { p: [0, foot * 1.42, base / 2 + 0.34] }), STONE, 12), paint(place(box(1.2, 2, 0.22), { p: [0, foot * 1.38, base / 2 + 0.38] }), '#7c3a2c', 2), paint(place(box(1.2, 0.14, 0.26), { p: [0, foot * 1.38 + 1.05, base / 2 + 0.38] }), GOLD)]), { r: [0, a, 0] }));
  let y = foot * 1.9 + 0.1;
  for (let i = 0; i < tiers; i++) {
    const t = i / Math.max(1, tiers - 1), w = lerp(base * 1.02, 1.2, t ** 0.82), hT = lerp(1.25, 0.72, t), gap = lerp(0.62, 0.3, t);
    P.push(paint(place(box(w * 0.46, gap + 0.1, w * 0.46), { p: [0, y + gap / 2, 0] }), '#5a3026'));
    y += gap;
    // the skirt: flares out at its hem, a pale cut edge of fibre, and a thick soft top
    P.push(squareTier(w * 1.0, w * 0.5, y, y + hT, IJUK, 13));
    P.push(squareTier(w * 1.04, w * 1.0, y - 0.12, y, '#4a4440', 13));
    y += hT;
  }
  P.push(paint(place(capsule(0.2, 0.7, 3, 7), { p: [0, y + 0.45, 0] }), GOLD), paint(place(sphere(0.32, 8, 6), { p: [0, y + 0.1, 0] }), GOLD));
  return merge(P);
}

// A bale: carved posts under a deep thatch hip roof, on a plinth of brick and carved paras with steps up to it. Open sided.
function bale({ w = 6, l = 8, h = 2.7, rh = 3.2, plinth = 1, thatch = THATCH } = {}) {
  const P = [];
  P.push(paint(place(box(w + 1.3, 0.5 + 2, l + 1.3), { p: [0, -0.75, 0] }), STONE_D, 12));
  P.push(paint(place(box(w + 0.8, plinth + 0.2, l + 0.8), { p: [0, plinth / 2, 0] }), BRICK, 16));
  P.push(paint(place(box(w + 1.05, 0.16, l + 1.05), { p: [0, plinth + 0.02, 0] }), '#a8a498'));
  for (let i = 0; i < 3; i++) P.push(paint(place(box(1.6, plinth * (1 - i / 3), 0.42), { p: [0, plinth * (1 - i / 3) / 2, (l + 0.8) / 2 + 0.2 + i * 0.42] }), STONE, 12));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { P.push(paint(place(cylinder(0.16, 0.2, h, 7), { p: [sx * w * 0.42, plinth + h / 2, sz * l * 0.42] }), WOOD), paint(place(cylinder(0.26, 0.28, 0.5, 8), { p: [sx * w * 0.42, plinth + 0.25, sz * l * 0.42] }), STONE)); }
  P.push(paint(place(box(w * 0.86, 0.34, l * 0.86), { p: [0, plinth + 0.5, 0] }), WOOD_L, 2));
  const y = plinth + h;
  const roof = lathe([[Math.hypot(w, l) * 0.62, y - 0.15], [Math.hypot(w, l) * 0.52, y + rh * 0.34], [Math.hypot(w, l) * 0.2, y + rh * 0.86], [0.1, y + rh]], 4);
  place(roof, { r: [0, Math.PI / 4, 0] });
  roof.scale(w / Math.max(w, l) * 1.08, 1, l / Math.max(w, l) * 1.08);
  P.push(paint(roof, thatch, 13));
  P.push(paint(place(sphere(0.26, 6, 5), { p: [0, y + rh + 0.05, 0] }), '#c85a3a'));
  return merge(P);
}

// A house of a village compound: red brick and paras under a red tile hip roof, a warm doorway, carved gold on the eaves.
function house({ w = 7, l = 9, h = 3, seed = 1 } = {}) {
  const P = [];
  P.push(paint(place(box(w, h + 5, l), { p: [0, (h - 5) / 2, 0] }), hash3(seed, 2, 1) < 0.5 ? '#cdb693' : '#bc9672', 5, (x, y) => lerp(0.62, 1, smooth(0, 1.6, y))));
  // carved paras: the plinth round the house and a band under the eaves
  P.push(paint(place(box(w + 0.5, 0.9, l + 0.5), { p: [0, 0.3, 0] }), '#8b877c', 12), paint(place(box(w + 0.3, 0.55, l + 0.3), { p: [0, h - 0.42, 0] }), '#928e82', 12));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.push(paint(place(box(0.7, h + 5, 0.7), { p: [sx * w / 2, (h - 5) / 2, sz * l / 2] }), BRICK, 16));
  const roof = lathe([[Math.hypot(w, l) * 0.62, h - 0.05], [Math.hypot(w, l) * 0.26, h + 2.5], [0.2, h + 3.2]], 4);
  place(roof, { r: [0, Math.PI / 4, 0] }); roof.scale(w / Math.max(w, l) * 1.1, 1, l / Math.max(w, l) * 1.1);
  P.push(paint(roof, hash3(seed, 3, 1) < 0.5 ? '#9c4a30' : hash3(seed, 3, 1) < 0.78 ? THATCH : IJUK, hash3(seed, 3, 1) < 0.5 ? 3 : 13));
  // the ridge ornaments every Balinese roof ends in
  P.push(paint(place(sphere(0.3, 6, 5), { p: [0, h + 3.35, 0], s: [1, 1.5, 1] }), '#8b877c'));
  P.push(paint(place(box(1.9, 2.6, 0.16), { p: [0, 1.25, l / 2 + 0.02] }), GOLD), paint(place(box(1.5, 2.3, 0.2), { p: [0, 1.15, l / 2 + 0.03] }), '#7a2f22', 2));
  for (const s of [-1, 1]) P.push(paint(place(box(1.2, 1.1, 0.14), { p: [s * w * 0.3, 1.7, l / 2 + 0.03] }), '#ffd590'), paint(place(box(w, 0.14, 0.2), { p: [0, h - 0.06, s * l / 2] }), GOLD));
  return merge(P);
}

// A warung: a shop open to the road, a bright awning on bamboo posts, a bench, shelves of colour.
function warung(seed = 1) {
  const AW = ['#d9483b', '#2d7fc4', '#f2b53a', '#39a05a'][seed % 4], P = [house({ w: 6, l: 5, h: 2.8, seed })];
  P.push(paint(place(box(6.6, 0.16, 3.4), { p: [0, 2.7, 4], r: [0.16, 0, 0] }), AW));
  for (const s of [-1, 1]) P.push(paint(place(cylinder(0.08, 0.1, 2.6, 6), { p: [s * 3, 1.3, 5.5] }), BAMBOO));
  P.push(paint(place(box(4, 0.14, 0.7), { p: [0, 0.62, 4.4] }), WOOD_L));
  for (const s of [-1, 1]) P.push(paint(place(box(0.14, 0.6, 0.6), { p: [s * 1.7, 0.3, 4.4] }), WOOD));
  for (let i = 0; i < 6; i++) P.push(paint(place(box(0.6, 0.5, 0.4), { p: [-1.8 + i * 0.72, 1.3 + 0.2 * (i % 2), 2.72] }), ['#e8b23a', '#d9483b', '#2d7fc4', '#f4efe0'][i % 4]));
  return merge(P);
}

// The split gate: one temple tower cut down the middle and its halves pulled apart, as if by a knife. The inner face is sheer and plain; the outer steps back in tiers of red brick between carved grey paras, a niche in each, a little stone flame at each corner, a lotus bud on top.
function gateHalf(side, h = 13, foot = 4.8, depth = 4.4) {
  const P = [], k = h / 13, steps = h < 8 ? 5 : 7;
  // one tower cut in two: every course starts at x = 0, so the inner face is one sheer plane from the ground to the bud, and the steps are all on the outer side
  P.push(paint(place(box(foot + 1.3 * k, 4, depth + 1.3 * k), { p: [side * (foot + 1.3 * k) / 2, 0.8 * k - 2, 0] }), STONE_D, 12));
  P.push(paint(place(box(foot + 0.7 * k, 0.8 * k, depth + 0.7 * k), { p: [side * (foot + 0.7 * k) / 2, 1.1 * k, 0] }), STONE, 12));
  let y = 1.5 * k;
  for (let i = 0; i < steps; i++) {
    const t = i / steps, w = lerp(foot, 0.8 * k, t ** 0.85), d = lerp(depth, 1.5 * k, t), sh = ((h - 1.5 * k) / steps) * lerp(1.32, 0.68, t);
    P.push(paint(place(box(w, sh * 0.66, d), { p: [side * w / 2, y + sh * 0.33, 0] }), BRICK, 16, (x, yy) => lerp(0.7, 1.08, smooth(y, y + sh * 0.66, yy)) * lerp(0.82, 1, smooth(1.5 * k, 6 * k, yy))));
    // a carved panel set in the middle of each tier, on the faces the road sees
    if (w > 1.6 * k) for (const q of [-1, 1]) P.push(paint(place(box(w * 0.5, sh * 0.42, 0.14), { p: [side * w * 0.5, y + sh * 0.34, q * (d / 2 + 0.05)] }), '#928e82', 12));
    // the cornice of grey stone, in two courses, proud on the outer side and along the depth, flush on the cut face
    P.push(paint(place(box(w + 0.3 * k, sh * 0.12, d + 0.3 * k), { p: [side * (w + 0.3 * k) / 2, y + sh * 0.72, 0] }), '#8b877c', 12));
    P.push(paint(place(box(w + 0.56 * k, sh * 0.2, d + 0.56 * k), { p: [side * (w + 0.56 * k) / 2, y + sh * 0.88, 0] }), STONE, 12));
    // antefixes: a soft stone flame on the outer corners and the middle of the outer edge
    if (i < steps - 1) for (const q of [-1, 0, 1]) {
      const ax = side * (w + 0.34 * k), az = q * (d / 2 + 0.2 * k);
      P.push(paint(place(sphere(0.2 * k, 5, 4), { p: [ax, y + sh + 0.1 * k, az], s: [1, 1.7, 1] }), '#a29e92'), paint(place(sphere(0.09 * k, 4, 3), { p: [ax, y + sh + 0.46 * k, az] }), '#a29e92'));
    }
    y += sh;
  }
  // the bud, half of it on each side of the cut
  P.push(paint(place(sphere(0.5 * k, 8, 6), { p: [side * 0.5 * k, y + 0.25 * k, 0], s: [1, 0.7, 1] }), STONE), paint(place(sphere(0.34 * k, 8, 6), { p: [side * 0.34 * k, y + 0.7 * k, 0], s: [1, 1.4, 1] }), '#a29e92'), paint(place(sphere(0.12 * k, 6, 5), { p: [side * 0.12 * k, y + 1.2 * k, 0] }), GOLD));
  return merge(P);
}

// A pair facing +z, the opening `gap` wide: the two halves of one tower, mirror images, with low wing walls. Scale by h.
function candiBentar({ gap = 1.8, h = 8, wings = 7 } = {}) {
  const k = h / 13, foot = 4.8 * k, depth = 4.4 * k;
  const P = [place(gateHalf(1, h, foot, depth), { p: [gap / 2, 0, 0] }), place(gateHalf(-1, h, foot, depth), { p: [-gap / 2, 0, 0] })];
  if (wings) for (const s of [-1, 1]) {
    P.push(paint(place(box(wings, 5, 1), { p: [s * (gap / 2 + foot + wings / 2), 0, 0] }), BRICK, 16));
    P.push(paint(place(box(wings + 0.3, 0.2, 1.3), { p: [s * (gap / 2 + foot + wings / 2), 2.54, 0] }), STONE, 12));
    P.push(paint(place(box(wings + 0.1, 0.5, 1.1), { p: [s * (gap / 2 + foot + wings / 2), 2.3, 0] }), '#928e82', 12));
  }
  return merge(P);
}

// A guardian on a plinth, wrapped in poleng: scenery, carved in soft stone, the black and white cloth on him in rings.
function guardian() {
  const P = [paint(place(box(1.2, 1.4, 1.2), { p: [0, 0.7, 0] }), STONE_D, 1), paint(place(capsule(0.42, 0.7, 3, 8), { p: [0, 2.1, 0] }), STONE), paint(place(sphere(0.44, 9, 7), { p: [0, 3.1, 0.04] }), STONE)];
  for (let i = 0; i < 4; i++) P.push(paint(place(cylinder(0.52, 0.56, 0.22, 10), { p: [0, 1.5 + i * 0.22, 0] }), i % 2 ? BLACK : WHITE));
  P.push(paint(place(sphere(0.1, 6, 4), { p: [0.16, 3.14, 0.42] }), BLACK), paint(place(sphere(0.1, 6, 4), { p: [-0.16, 3.14, 0.42] }), BLACK));
  return merge(P);
}

// A tedung: the tall parasol of a temple.
function parasol(color = WHITE) {
  return merge([paint(place(cylinder(0.06, 0.07, 4.6, 6), { p: [0, 2.3, 0] }), GOLD), paint(lathe([[1.5, 3.9], [1.22, 4.32], [0.3, 4.72], [0, 4.82]], 12), color), paint(place(cylinder(1.52, 1.52, 0.3, 12, true), { p: [0, 3.78, 0] }), GOLD)]);
}

// A thin hanging strip of young palm leaf, curling at its end: the stuff of every Balinese decoration. Two faces, so it costs little and never reads as a card.
function strip(x, y, z, len, wide, dx, dz, color, curl = 0.25, segs = 4) {
  const pos = [], nor = [], idx = [], ca = dx, sa = dz, px = -dz, pz = dx;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, o = curl * t * t * len, yy = y - len * t, w = wide * (1 - 0.72 * t * t);
    pos.push(x + ca * o - px * w, yy, z + sa * o - pz * w, x + ca * o + px * w, yy, z + sa * o + pz * w);
    nor.push(ca * 0.2, 1, sa * 0.2, ca * 0.2, 1, sa * 0.2);
    if (i < segs) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return paint(g, color, 14, (_, yy) => lerp(1.08, 0.86, clamp01((y - yy) / len)));
}
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// A penjor: a tall bamboo bent over in one long arc like a fishing rod, a fringe of woven janur down the whole bend, a great tassel (the sampian) at its tip, and at its foot the cloth, the leaves and the little offering shelf. Its curve leans out over the verge, toward +z.
function penjor(h = 10, reach = 4, seed = 1) {
  const P = [], pts = [], N = 18;
  for (let i = 0; i <= N; i++) { const t = i / N, e = Math.sin(t * Math.PI * 0.56) / Math.sin(Math.PI * 0.56); pts.push([0, -0.2 + (h + 0.2) * e - 0.5 * t ** 6, reach * t ** 2.6]); }
  P.push(paint(tube(pts, pts.map((_, i) => lerp(0.1, 0.018, i / N)), 6), BAMBOO));
  // the foot: bound leaves, a band of cloth, the shelf for the offering with its small roof
  P.push(paint(place(cylinder(0.2, 0.26, 1.5, 9), { p: [0, 0.7, 0] }), '#8fa84e'), paint(place(cylinder(0.17, 0.17, 0.7, 9), { p: [0, 1.75, 0] }), '#f4efe0'), paint(place(cylinder(0.18, 0.18, 0.14, 9), { p: [0, 2.15, 0] }), '#e8c14a'));
  P.push(paint(place(box(0.5, 0.06, 0.5), { p: [0, 2.5, -0.26] }), BAMBOO), paint(place(lathe([[0.42, 2.92], [0.04, 3.2]], 4), { r: [0, Math.PI / 4, 0] }), '#b9a25c'), paint(place(box(0.2, 0.14, 0.2), { p: [0, 2.6, -0.26] }), '#e8485a'));
  for (let i = 0; i < 6; i++) { const a = i * 1.05; P.push(strip(Math.cos(a) * 0.18, 1.5, Math.sin(a) * 0.18, 1.1, 0.06, Math.cos(a), Math.sin(a), JANUR, 0.3, 2)); }
  // the fringe: janur hanging all down the bend, longer toward the tip
  for (let i = 6; i < N; i++) for (const s of [-1, 1]) {
    const [, y, z] = pts[i], t = i / N, len = lerp(0.5, 1.35, t) * (0.8 + 0.4 * hash3(i, s, seed));
    P.push(strip(s * 0.05, y, z, len, 0.05, s * 0.5, 0.3, hash3(i, s, seed + 3) < 0.3 ? '#f5edae' : JANUR, 0.34, 3));
  }
  // the sampian: a sheaf of long curling strips round a woven heart, a touch of red and gold
  const [, ty, tz] = pts[N];
  P.push(paint(place(sphere(0.2, 7, 5), { p: [0, ty - 0.2, tz], s: [1, 1.5, 1] }), '#e8d986'), paint(place(sphere(0.09, 6, 4), { p: [0, ty - 0.5, tz] }), '#d9483b'));
  for (let i = 0; i < 12; i++) { const a = i * 0.524; P.push(strip(Math.cos(a) * 0.12, ty - 0.1, tz + Math.sin(a) * 0.12, 1.7 + 0.5 * hash3(i, 7, seed), 0.055, Math.cos(a), Math.sin(a), i % 3 ? JANUR : '#f5edae', 0.42, 4)); }
  return merge(P);
}

// An umbul-umbul: a long curved banner on a pole, along the village street. Plain colours, no words.
function umbul(color) {
  const P = [paint(tube([[0, 0, 0], [0, 7, 0], [0.02, 8, 0.28], [0.04, 8.5, 0.8]], [0.06, 0.05, 0.035, 0.02], 5), BAMBOO)];
  // the cloth hangs off the bent tip in one long tapering tail that waves, two colours split down its length
  for (const [c, off] of [[color, 0.14], [WHITE, -0.14]]) {
    const pos = [], nor = [], idx = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12, y = 8.3 - t * 6.4, z = 0.42 + 0.34 * Math.sin(t * 5.2) * t + 0.3 * t, w = 0.3 * (1 - 0.82 * t);
      pos.push(0.03 * Math.sin(i), y, z + off * (1 - t) - w * 0.5, 0.03 * Math.sin(i), y, z + off * (1 - t) + w * 0.5);
      nor.push(0, 1, 0, 0, 1, 0);
      if (i < 12) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setIndex(idx);
    P.push(paint(g, c, 14));
  }
  return merge(P);
}

// A subak hut in the paddies, on stilts, thatch over a platform.
function hut() {
  const P = [paint(place(box(3, 0.16, 3), { p: [0, 1.3, 0] }), WOOD_L)];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.push(paint(place(cylinder(0.08, 0.1, 3.4, 5), { p: [sx * 1.25, 1.7, sz * 1.25] }), BAMBOO));
  P.push(paint(place(lathe([[2.7, 3.0], [1.6, 3.9], [0.1, 4.8]], 4), { r: [0, Math.PI / 4, 0] }), THATCH, 3));
  return merge(P);
}

// A shrine of the field: a little throne on a stepped foot, cloth and an offering. Out in the rice, on its own bund.
function shrine() {
  const P = [paint(place(box(1.5, 2, 1.5), { p: [0, 0.4, 0] }), STONE_D, 1), paint(place(box(1.1, 1.2, 1.1), { p: [0, 1.8, 0] }), STONE, 1), paint(place(box(1.3, 0.2, 1.3), { p: [0, 2.46, 0] }), GOLD), paint(place(box(0.8, 0.7, 0.8), { p: [0, 2.9, 0] }), BRICK, 1)];
  P.push(paint(place(lathe([[1, 3.2], [0.1, 4.2]], 4), { r: [0, Math.PI / 4, 0] }), IJUK, 3));
  for (let i = 0; i < 3; i++) P.push(paint(place(cylinder(0.78, 0.78, 0.18, 8), { p: [0, 1.36 + i * 0.18, 0], s: [1, 1, 1] }), i % 2 ? BLACK : WHITE));
  return merge(P);
}

function sanggah(seed = 1) {
  const P = [paint(place(box(11, 3, 5), { p: [0, -1.1, 0] }), STONE_D, 12)];
  for (const [x, t, hh] of [[-4, 3, 7.5], [0, 1, 6], [4, 2, 7], [-1.9, 1, 4.8]]) {
    P.push(paint(place(box(1.5, 2, 1.5), { p: [x, 0.8, 0] }), BRICK, 16), paint(place(box(1.8, 0.24, 1.8), { p: [x, 1.86, 0] }), '#928e82', 12), paint(place(box(1.1, 0.9, 1.1), { p: [x, 2.4, 0] }), GOLD));
    for (let k = 0; k < t; k++) { const y = 2.85 + k * 1.05, r = 1.55 - k * 0.32; P.push(paint(place(lathe([[r, y], [r * 0.32, y + 1]], 4), { r: [0, Math.PI / 4, 0] }), IJUK, 13)); }
    P.push(paint(place(sphere(0.16, 5, 4), { p: [x, 2.95 + t * 1.05, 0], s: [1, 1.6, 1] }), GOLD));
  }
  for (const x of [-5.4, 5.4]) P.push(paint(place(cylinder(0.05, 0.06, 7 + 2 * hash3(x, seed, 2), 5), { p: [x, 3.5, 1.5] }), BAMBOO), paint(place(box(0.5, 2.2, 0.03), { p: [x + 0.26, 5.6, 1.5] }), x < 0 ? '#e8c14a' : WHITE));
  return merge(P);
}

// A lelakut: a scarecrow of straw with a farmer's hat, ribbons on a line.
function lelakut() {
  return merge([paint(place(cylinder(0.05, 0.05, 2.4, 4), { p: [0, 1.2, 0] }), BAMBOO), paint(place(box(1.5, 0.07, 0.07), { p: [0, 1.7, 0] }), BAMBOO), paint(place(capsule(0.26, 0.46, 2, 7), { p: [0, 1.5, 0] }), '#d8c070'), paint(place(sphere(0.22, 7, 5), { p: [0, 2.14, 0] }), '#e4d090'), paint(place(lathe([[0.62, 2.28], [0.1, 2.6], [0, 2.62]], 10)), '#c49c50'), paint(place(box(0.24, 0.5, 0.03), { p: [0.62, 1.42, 0] }), '#d9483b'), paint(place(box(0.24, 0.5, 0.03), { p: [-0.62, 1.42, 0] }), '#e8c14a')]);
}

// A white duck, as herded through the flooded plots.
function duck() {
  return merge([paint(place(sphere(0.34, 8, 6), { p: [0, 0.3, 0], s: [0.85, 0.8, 1.2] }), '#fbf8ee'), paint(place(sphere(0.18, 7, 5), { p: [0, 0.62, 0.34] }), '#fbf8ee'), paint(place(cone(0.08, 0.2, 5), { p: [0, 0.6, 0.54], r: [Math.PI / 2, 0, 0] }), '#e89a3a')]);
}

// The tourist swing on its frame of palm trunks and a bird's nest of woven bamboo, as they stand over every terraced valley on the island.
function swing() {
  const P = [];
  for (const s of [-1, 1]) P.push(paint(tube([[s * 3.4, -1, -1.4], [s * 2.2, 9, 0]], 0.24, 6), '#8a6a44'), paint(tube([[s * 3.4, -1, 1.4], [s * 2.2, 9, 0]], 0.24, 6), '#8a6a44'));
  P.push(paint(tube([[-2.6, 9, 0], [2.6, 9, 0]], 0.26, 6), '#8a6a44'));
  for (const s of [-0.5, 0.5]) P.push(paint(tube([[s, 9, 0], [s * 0.9, 3.2, 1.4]], 0.035, 3), '#d7c08a'));
  P.push(paint(place(box(1.5, 0.12, 0.42), { p: [0, 3.2, 1.4] }), '#d9483b'));
  return merge(P);
}
function nest() {
  const P = [];
  for (let i = 0; i < 3; i++) P.push(paint(place(cylinder(0.14, 0.14, 4.6, 5), { p: [Math.cos(i * 2.1) * 1.4, 1.8, Math.sin(i * 2.1) * 1.4] }), '#8a6a44'));
  P.push(paint(lathe([[0.9, 3.8], [2.4, 4.3], [3, 5.4], [2.6, 5.4], [1.7, 4.6], [0, 4.5]], 14), '#b48f58', 4));
  return merge(P);
}

// A banyan: a great trunk with its curtains of aerial roots and a dome of a crown, wrapped in poleng as sacred trees are.
function banyan() {
  const P = [paint(place(cylinder(1.6, 2.3, 9, 10), { p: [0, 3.6, 0] }), '#6d5a48', 4)];
  // buttress roots spreading over the ground
  for (let i = 0; i < 7; i++) { const a = i * 0.9 + 0.3, L = 4.5 + 2.5 * hash3(i, 5, 7); P.push(paint(tube([[Math.cos(a) * 1.5, 2.2, Math.sin(a) * 1.5], [Math.cos(a) * 3, 0.6, Math.sin(a) * 3], [Math.cos(a + 0.2) * L, -0.15, Math.sin(a + 0.2) * L]], [0.5, 0.34, 0.1], 5), '#75604c')); }
  for (let i = 0; i < 5; i++) P.push(paint(place(cylinder(2.42, 2.48, 0.4, 12), { p: [0, 1.2 + i * 0.4, 0] }), i % 2 ? BLACK : WHITE));
  for (let i = 0; i < 16; i++) {
    const a = hash3(i, 2, 7) * 6.28, r = 3 + 8 * hash3(i, 3, 7);
    P.push(paint(tube([[Math.cos(a) * r, 13, Math.sin(a) * r], [Math.cos(a + 0.1) * r * 0.98, 6, Math.sin(a + 0.1) * r * 0.98], [Math.cos(a) * r * 1.02, -0.3, Math.sin(a) * r * 1.02]], [0.1, 0.13, 0.22], 4), '#7a6650'));
  }
  P.push(paint(place(sphere(11, 16, 10), { p: [0, 15.5, 0], s: [1.25, 0.72, 1.25] }), '#2a7a45', 15));
  for (let i = 0; i < 14; i++) { const a = i * 2.4, r = 5 + 8 * hash3(i, 9, 3); P.push(paint(place(sphere(4 + 2.2 * hash3(i, 4, 2), 9, 6), { p: [Math.cos(a) * r, 13 + 7 * hash3(i, 5, 2), Math.sin(a) * r], s: [1.1, 0.74, 1.1] }), i % 3 ? '#2f8a4c' : '#237042', 15)); }
  return merge(P);
}

// A jukung drawn up by the water, the prow's painted eye toward the temple's lake; out of use, no sail.
function canoe(color = '#e0b13c') {
  const hull = lathe([[0.02, -2.6], [0.42, -1.6], [0.52, 0], [0.42, 1.6], [0.02, 2.8]], 8);
  hull.rotateX(Math.PI / 2); hull.scale(1, 0.7, 1);
  const P = [paint(hull, color), paint(place(sphere(0.12, 6, 4), { p: [0.34, 0.18, 2.1] }), WHITE), paint(place(sphere(0.12, 6, 4), { p: [-0.34, 0.18, 2.1] }), WHITE)];
  for (const s of [-1, 1]) { P.push(paint(tube([[0, 0.3, 0.9], [s * 1.2, 0.5, 0.9], [s * 1.7, 0.1, 0.9]], 0.04, 3), '#d9483b'), paint(tube([[0, 0.3, -0.9], [s * 1.2, 0.5, -0.9], [s * 1.7, 0.1, -0.9]], 0.04, 3), '#d9483b'), paint(tube([[s * 1.7, 0.08, -1.6], [s * 1.7, 0.08, 1.6]], 0.07, 4), WHITE)); }
  return merge(P);
}

// A canang sari on a low stone: a little palm tray of petals, scenery, set well back from the kerb.
function offering() {
  const P = [paint(place(cylinder(0.42, 0.52, 0.5, 9), { p: [0, 0.16, 0] }), '#85827a', 12), paint(place(cylinder(0.5, 0.46, 0.08, 9), { p: [0, 0.44, 0] }), '#a8a498'), paint(place(cylinder(0.34, 0.28, 0.12, 8), { p: [0, 0.54, 0] }), '#b9c56a')];
  for (let i = 0; i < 7; i++) { const a = i * 0.9, r = i ? 0.2 : 0; P.push(paint(place(sphere(0.085, 5, 4), { p: [Math.cos(a) * r, 0.64, Math.sin(a) * r] }), ['#f4e15a', '#e8485a', '#f8f4e8', '#e87a30'][i % 4])); }
  // a thin stick of incense and its leaf
  P.push(paint(place(cylinder(0.008, 0.008, 0.5, 3), { p: [0.1, 0.86, 0.05] }), '#6a4a30'));
  return merge(P);
}

// The islet of a meru: a retaining wall of dark wet stone rising from the water, a course of carved paras, a coping, a paved top with small shrubs at its rim. No lawn: the stone is what you see from the shore.
function islet(r, level) {
  const P = [paint(place(cylinder(r, r + 1.2, 8, 10), { p: [0, level - 3.2, 0] }), '#3f3f3c', 1), paint(place(cylinder(r - 0.1, r - 0.1, 0.8, 10), { p: [0, level + 1.15, 0] }), '#74716a', 12), paint(place(cylinder(r + 0.2, r + 0.2, 0.22, 10), { p: [0, level + 1.6, 0] }), '#9a968a'), paint(place(cylinder(r - 0.1, r - 0.1, 0.1, 10), { p: [0, level + 1.72, 0] }), '#85827a', 1)];
  for (let i = 0; i < 10; i++) { const a = (i + 0.5) * 0.628 * 1 + 0.2 * hash3(i, 3, 3); P.push(paint(place(sphere(0.9 + 0.5 * hash3(i, 2, 3), 7, 5), { p: [Math.cos(a) * (r - 1.6), level + 2.1, Math.sin(a) * (r - 1.6)], s: [1, 0.72, 1] }), i % 2 ? '#2f7f46' : '#3e9450')); }
  return merge(P);
}

// Detail that only counts close to: a view draws this mesh only within `reach` m of its edge. The draw range is read per draw, so each view of a split screen decides for itself, and a zero range costs no draw call.
function nearOnly(mesh, reach) {
  const g = mesh.geometry, s = g.boundingSphere;
  mesh.onBeforeRender = (r, sc, cam) => { g.setDrawRange(0, cam.position.distanceTo(s.center) - s.radius > reach ? 0 : Infinity); };
  return mesh;
}

// ---------- the stepped rice fields ----------
// Real steps, not paint: the slope is cut along its own contours (a marching triangle per cell of TCELL m, split at every TSTEP m of height and then into plots), each plot a level plate with a pale bund on its lip, a dark earth riser down to the next one, and shade at the riser's foot. The drawn ground goes under them (world.groundDrop) and the sim's shoulder ends before they start (def.wall), so a kart never meets them.
const TSTEP = 0.62, TNEAR = 6.2, TMID = 20, TFAR = 70, TDROP = 1.3;
// a third of the plots under water, as in planting season, the rest every age of rice at once, a plot just ploughed: the terraces of Bali are never one green
const PLOTS = [['#5f8f8c', 17, 0.3], ['#84b846', 18, 0.16], ['#6fb642', 18, 0.18], ['#4a9c3c', 18, 0.14], ['#2f8038', 18, 0.08], ['#c6bb50', 18, 0.1], ['#6a5236', 18, 0.04]];

function terraceField(terrain) {
  const warp = (x, z, k) => [x + k * (11 * (vnoise(x / 58, z / 58, 11) - 0.5) + 3 * (vnoise(x / 16, z / 16, 12) - 0.5)), z + k * (11 * (vnoise(x / 58, z / 58, 13) - 0.5) + 3 * (vnoise(x / 16, z / 16, 14) - 0.5))];
  // the mean of five heights: the ground is bilinear with a kink every 4 m, and a contour straight off it is a zigzag with ink on it
  // by the road the wander dies away and the first plate rides a little over the ground, so the fields start in one low step at the edge of the shoulder and never drop away behind a lip of verge
  const level = (x, z, step) => { const rd = terrain.roadDistAt(x, z), k = smooth(7, 30, rd), e = 2 + 4 * k, q = warp(x, z, k), h = terrain.heightAt, X = q[0], Z = q[1]; return (h(X, Z) * 2 + h(X + e, Z) + h(X - e, Z) + h(X, Z + e) + h(X, Z - e)) / (6 * step) + 0.55 * (1 - smooth(TNEAR, TNEAR + 9, rd)); };
  return { level, topAt: (x, z) => { const st = terrain.roadDistAt(x, z) < TMID ? TSTEP : 2 * TSTEP; return (Math.floor(level(x, z, st)) + 0.5) * st + 0.02; } };
}

function buildPlates({ terrain, world, mat }) {
  const F = world.field, sets = new Map();
  let STEP = TSTEP, FINE = true;
  const plateY = (L) => (L + 0.5) * STEP;
  const put = (cx, cz, rice = false) => {
    const size = rice ? 320 : 220, k = `${rice ? 'r' : ''}${Math.floor(cx / size)},${Math.floor(cz / size)}`;
    let o = sets.get(k);
    if (!o) sets.set(k, (o = { p: [], n: [], c: [], k: [], rice }));
    return o;
  };
  const LIP = linear('#868a50'), LIP2 = linear('#6f7a44'), RISE_T = linear('#5a6a3a'), RISE_B = linear('#343c22'), EARTH_T = linear('#55703a'), EARTH_B = linear('#4c7a30'), FOOT_T = linear('#8c8870'), FOOT_B = linear('#6c7052');
  const vert = (o, x, y, z, nx, ny, nz, c, ck, kind) => { o.p.push(x, y, z); o.n.push(nx, ny, nz); o.c.push(c[0] * ck, c[1] * ck, c[2] * ck); o.k.push(kind); };
  const quad = (o, a, b, c, d, nor, ca, cb, kind = 0) => { // a b top, d c bottom
    vert(o, ...a, ...nor, ca, 1, kind); vert(o, ...b, ...nor, ca, 1, kind); vert(o, ...c, ...nor, cb, 1, kind);
    vert(o, ...a, ...nor, ca, 1, kind); vert(o, ...c, ...nor, cb, 1, kind); vert(o, ...d, ...nor, cb, 1, kind);
  };
  // a bank leans back and the sky lights it: with a true sideways normal half the hills, those with their back to the sun, go black from the road
  const BANK = (nx, nz) => [-nx * 0.5, 0.86, -nz * 0.5];
  const WALLN = (nx, nz) => [-nx * 0.92, 0.38, -nz * 0.92];
  // Where the fields stop: a short bank, leaning back from the road over `run` m, its top a soft wandering line. Over knee height its foot is low dark dry stone, as the retaining walls here are; ferns stand along its top (see the verge).
  const softBank = (o, A, B, y, nx, nz, run) => {
    const G = world.ground.groundAt, ax = A.x - nx * run, az = A.z - nz * run, bx = B.x - nx * run, bz = B.z - nz * run;
    const ta = y + 0.08 + 0.16 * vnoise(A.x / 1.9, A.z / 1.9, 31), tb = y + 0.08 + 0.16 * vnoise(B.x / 1.9, B.z / 1.9, 31), ga = G(ax, az) - 0.1, gb = G(bx, bz) - 0.1;
    if (Math.max(ta - ga, tb - gb) > 0.8) {
      const ma = Math.max(ga + 0.5, lerp(ta, ga, 0.45)), mb = Math.max(gb + 0.5, lerp(tb, gb, 0.45)), f = 0.72;
      quad(o, [A.x, ta, A.z], [B.x, tb, B.z], [B.x - nx * run * f, mb, B.z - nz * run * f], [A.x - nx * run * f, ma, A.z - nz * run * f], BANK(nx, nz), EARTH_T, EARTH_B);
      quad(o, [A.x - nx * run * f, ma, A.z - nz * run * f], [B.x - nx * run * f, mb, B.z - nz * run * f], [bx, gb, bz], [ax, ga, az], WALLN(nx, nz), FOOT_T, FOOT_B, 31);
    } else quad(o, [A.x, ta, A.z], [B.x, tb, B.z], [bx, gb, bz], [ax, ga, az], BANK(nx, nz), EARTH_T, EARTH_B);
  };
  // rice up close: three thin blades from one foot, dark at the foot and lit at the tip
  const riceTuft = (o, x, y, z, c, h, s) => {
    for (let q = 0; q < 3; q++) {
      const a = s * 6.28 + q * 2.1, ca = Math.cos(a), sa = Math.sin(a), w = 0.08;
      vert(o, x - sa * w, y, z + ca * w, 0, 1, 0, c, 0.58, 0); vert(o, x + sa * w, y, z - ca * w, 0, 1, 0, c, 0.58, 0); vert(o, x + ca * 0.16, y + h, z + sa * 0.16, 0, 1, 0, c, 1.28, 0);
    }
  };
  const plotOf = (L, C) => {
    const h = hash3(L * 1.31 + 2, C * 0.77 + 5, 9);
    let e = 0, pick = PLOTS[0];
    for (const q of PLOTS) { e += q[2]; if (h < e) { pick = q; break; } pick = q; }
    return pick;
  };
  const cutOf = (x, z, L) => (x * 0.72 + z * 0.69) / 24 + L * 0.37 + vnoise(x / 41 + L * 0.21, z / 41, 5) * 3.2;
  // Sutherland-Hodgman with a tag per edge. g >= 0 stays; the new edge takes newTag.
  const clip = (poly, g, newTag) => {
    const out = [], n = poly.length;
    for (let i = 0; i < n; i++) {
      const A = poly[i], B = poly[(i + 1) % n], ga = g(A), gb = g(B);
      if (ga >= 0) {
        out.push(A);
        if (gb < 0) { const t = ga / (ga - gb); out.push({ x: A.x + (B.x - A.x) * t, z: A.z + (B.z - A.z) * t, f: A.f + (B.f - A.f) * t, m: A.m + (B.m - A.m) * t, tag: newTag }); }
      } else if (gb >= 0) {
        const t = ga / (ga - gb);
        out.push({ x: A.x + (B.x - A.x) * t, z: A.z + (B.z - A.z) * t, f: A.f + (B.f - A.f) * t, m: A.m + (B.m - A.m) * t, tag: A.tag });
      }
    }
    return out;
  };
  const emit = (poly, L) => {
    const y = plateY(L);
    let cx = 0, cz = 0;
    for (const q of poly) { cx += q.x; cz += q.z; }
    cx /= poly.length; cz /= poly.length;
    const o = put(cx, cz);
    // the plots of this band
    let cMin = 1e9, cMax = -1e9;
    const withC = poly.map((q) => ({ ...q, c: cutOf(q.x, q.z, L) }));
    for (const q of withC) { cMin = Math.min(cMin, q.c); cMax = Math.max(cMax, q.c); }
    for (let C = Math.floor(cMin); C <= Math.floor(cMax); C++) {
      const gc = (q) => q.c ?? cutOf(q.x, q.z, L);
      let part = clip(withC, (q) => gc(q) - C, 4);
      if (part.length >= 3) part = clip(part, (q) => C + 1 - gc(q), 5);
      if (part.length < 3) continue;
      const [hex, kind] = plotOf(L, C), col = linear(hex), ck = 0.94 + 0.12 * hash3(C, L, 3), tn = kind === 17 ? 1 : ck;
      // the rice thicker in one corner of a plot, thinner in another: one flat colour reads as a plate
      const tone = (q) => (kind === 17 ? 1 : tn * (0.72 + 0.56 * vnoise(q.x / 9, q.z / 9, 21)));
      for (let i = 1; i < part.length - 1; i++) {
        vert(o, part[0].x, y, part[0].z, 0, 1, 0, col, tone(part[0]), kind);
        vert(o, part[i + 1].x, y, part[i + 1].z, 0, 1, 0, col, tone(part[i + 1]), kind);
        vert(o, part[i].x, y, part[i].z, 0, 1, 0, col, tone(part[i]), kind);
        if (FINE && kind === 18 && hex !== '#6a5236') {
          const P0 = part[0], P1 = part[i], P2 = part[i + 1], area = Math.abs((P1.x - P0.x) * (P2.z - P0.z) - (P2.x - P0.x) * (P1.z - P0.z)) / 2, cnt = Math.floor(area * 0.28 + hash3(P1.x, P1.z, 71));
          for (let q = 0; q < cnt; q++) {
            let r1 = hash3(P1.x + q, P2.z, 72), r2 = hash3(P2.x - q, P1.z, 73);
            if (r1 + r2 > 1) { r1 = 1 - r1; r2 = 1 - r2; }
            const tx = P0.x + (P1.x - P0.x) * r1 + (P2.x - P0.x) * r2, tz = P0.z + (P1.z - P0.z) * r1 + (P2.z - P0.z) * r2;
            if (terrain.roadDistAt(tx, tz) < 14) riceTuft(put(tx, tz, true), tx, y, tz, col, 0.26 + 0.2 * hash3(tx, tz, 74), hash3(tz, tx, 75));
          }
        }
      }
      let px = 0, pz = 0;
      for (const q of part) { px += q.x; pz += q.z; }
      px /= part.length; pz /= part.length;
      for (let i = 0; i < part.length; i++) {
        const A = part[i], B = part[(i + 1) % part.length];
        if (!A.tag) continue;
        const ex = B.x - A.x, ez = B.z - A.z, l = Math.hypot(ex, ez);
        if (l < 0.05) continue;
        let nx = -ez / l, nz = ex / l;
        if ((px - A.x) * nx + (pz - A.z) * nz < 0) { nx = -nx; nz = -nz; }
        if (A.tag === 1) {
          // where the fields stop: by the road a short bank, out in the fields a longer one that melts into the ground; between the fine plots and the coarse ones a hidden lip
          const rd = terrain.roadDistAt(A.x, A.z);
          if (Math.abs(rd - TMID) < 1.6) quad(o, [A.x, y + 0.08, A.z], [B.x, y + 0.08, B.z], [B.x, y - 1.2, B.z], [A.x, y - 1.2, A.z], BANK(nx, nz), RISE_T, RISE_B);
          else softBank(o, A, B, y, nx, nz, rd < TNEAR + 11 ? 1.2 : 3);
        } else if (A.tag === 2) {
          // the riser down to the plate below, the bund on the lip, shade at the foot of the riser on the lower plate
          const y0 = plateY(L - 1), mx = (A.x + B.x) / 2, mz = (A.z + B.z) / 2, Cb = Math.floor(cutOf(mx, mz, L - 1));
          // by the road, with the plate under it cut away, a riser ends in the same short bank; a field's own riser is a thin wet lip of earth, far lower than the plot is deep
          const lipC = hash3(Math.floor(mx / 7), Math.floor(mz / 7), 37) < 0.5 ? LIP : LIP2;
          if (world.plateMask(mx - nx * 2, mz - nz * 2) < 0.5 && terrain.roadDistAt(A.x, A.z) < TNEAR + 11) softBank(o, A, B, y, nx, nz, 1.2);
          else if (FINE) {
            // from the road below a field is all risers: the rice of the plate above hangs over its top, then the earth
            const mid = y - 0.14, [hp] = plotOf(L, Math.floor(cutOf(mx, mz, L))), cp = linear(hp === PLOTS[0][0] ? '#7f9c50' : hp);
            quad(o, [A.x, y + 0.12, A.z], [B.x, y + 0.12, B.z], [B.x, mid, B.z], [A.x, mid, A.z], BANK(nx, nz), cp, cp, 0);
            quad(o, [A.x, mid, A.z], [B.x, mid, B.z], [B.x, y0, B.z], [A.x, y0, A.z], BANK(nx, nz), RISE_T, RISE_B);
          } else quad(o, [A.x, y + 0.12, A.z], [B.x, y + 0.12, B.z], [B.x, y0, B.z], [A.x, y0, A.z], BANK(nx, nz), RISE_T, RISE_B);
          quad(o, [A.x, y + 0.12, A.z], [B.x, y + 0.12, B.z], [B.x + nx * 0.3, y + 0.02, B.z + nz * 0.3], [A.x + nx * 0.3, y + 0.02, A.z + nz * 0.3], [0, 1, 0], lipC, lipC);
          if (!FINE) continue;
          const [hb, kb] = plotOf(L - 1, Cb), cb = linear(hb);
          if (kb !== 17) {
            vert(o, A.x, y0 + 0.03, A.z, 0, 1, 0, cb, 0.5, kb); vert(o, B.x, y0 + 0.03, B.z, 0, 1, 0, cb, 0.5, kb); vert(o, B.x - nx * 0.8, y0 + 0.03, B.z - nz * 0.8, 0, 1, 0, cb, 0.96, kb);
            vert(o, A.x, y0 + 0.03, A.z, 0, 1, 0, cb, 0.5, kb); vert(o, B.x - nx * 0.8, y0 + 0.03, B.z - nz * 0.8, 0, 1, 0, cb, 0.96, kb); vert(o, A.x - nx * 0.8, y0 + 0.03, A.z - nz * 0.8, 0, 1, 0, cb, 0.96, kb);
          }
        } else if (A.tag === 4 && FINE) {
          // a low bund across the band, between two plots
          quad(o, [A.x - nx * 0.16, y + 0.02, A.z - nz * 0.16], [B.x - nx * 0.16, y + 0.02, B.z - nz * 0.16], [B.x, y + 0.12, B.z], [A.x, y + 0.12, A.z], [0, 1, 0], LIP, LIP);
          quad(o, [A.x + nx * 0.16, y + 0.02, A.z + nz * 0.16], [B.x + nx * 0.16, y + 0.02, B.z + nz * 0.16], [B.x, y + 0.12, B.z], [A.x, y + 0.12, A.z], [0, 1, 0], LIP, LIP);
        }
      }
    }
  };
  const tri = (a, b, c) => {
    if (a.m < 0.5 && b.m < 0.5 && c.m < 0.5) return;
    let poly = [{ ...a, tag: 0 }, { ...b, tag: 0 }, { ...c, tag: 0 }];
    poly = clip(poly, (q) => q.m - 0.5, 1);
    if (poly.length < 3) return;
    let lo = 1e9, hi = -1e9;
    for (const q of poly) { lo = Math.min(lo, q.f); hi = Math.max(hi, q.f); }
    for (let L = Math.floor(lo); L <= Math.floor(hi); L++) {
      // tag 2: this plate's low edge, the one with a riser under it; tag 3: its high edge, whose riser the plate above draws
      let part = clip(poly, (q) => q.f - L, 2);
      if (part.length >= 3) part = clip(part, (q) => L + 1 - q.f, 3);
      if (part.length >= 3) emit(part, L);
    }
  };
  const { x0, z0, w, h, step } = terrain, W = (w - 1) * step, D = (h - 1) * step;
  // near the road plots of TSTEP in fine cells, every bund drawn; further out twice the step in coarse cells: seen from there a riser is a line
  for (const [cell, st, fine, lo, hi] of [[4.2, TSTEP, true, -1e9, TMID], [10, 2 * TSTEP, false, TMID, 1e9]]) {
    STEP = st; FINE = fine;
    const nx = Math.ceil(W / cell), nz = Math.ceil(D / cell);
    let A = new Array(nx + 1), Bq = new Array(nx + 1);
    const node = (i, j) => {
      const x = x0 + i * cell, z = z0 + j * cell, rd = terrain.roadDistAt(x, z);
      let m = Math.min(world.plateMask(x, z), (rd - lo) / 3 + 0.5, (hi - rd) / 3 + 0.5);
      if (m < 0) m = 0;
      return { x, z, m, f: F.level(x, z, st) };
    };
    for (let i = 0; i <= nx; i++) A[i] = node(i, 0);
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i <= nx; i++) Bq[i] = node(i, j + 1);
      for (let i = 0; i < nx; i++) {
        const a = A[i], b = A[i + 1], c = Bq[i], d = Bq[i + 1];
        if (a.m < 0.5 && b.m < 0.5 && c.m < 0.5 && d.m < 0.5) continue;
        if ((i + j) % 2) { tri(a, c, b); tri(b, c, d); } else { tri(a, c, d); tri(a, d, b); }
      }
      [A, Bq] = [Bq, A];
    }
  }
  const material = mat('#ffffff', { vertexColors: true, paint: true, shade: true, side: THREE.DoubleSide });
  let tris = 0;
  for (const o of sets.values()) {
    // each triangle wound so that its front is the side its normal says: a double sided material flips the normal of a back face, and a plate wound the wrong way came out lit from below, half as bright as the far fields
    for (let t = 0; t + 8 < o.p.length; t += 9) {
      const P = o.p, ax = P[t + 3] - P[t], ay = P[t + 4] - P[t + 1], az = P[t + 5] - P[t + 2], bx = P[t + 6] - P[t], by = P[t + 7] - P[t + 1], bz = P[t + 8] - P[t + 2];
      if ((ay * bz - az * by) * o.n[t] + (az * bx - ax * bz) * o.n[t + 1] + (ax * by - ay * bx) * o.n[t + 2] >= 0) continue;
      for (const A of [o.p, o.n, o.c]) for (let q = 0; q < 3; q++) { const v = A[t + 3 + q]; A[t + 3 + q] = A[t + 6 + q]; A[t + 6 + q] = v; }
      const K = o.k, kk = t / 3, v = K[kk + 1]; K[kk + 1] = K[kk + 2]; K[kk + 2] = v;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(o.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(o.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(o.c, 3));
    g.setAttribute('aPaint', new THREE.Float32BufferAttribute(o.k, 1));
    g.computeBoundingSphere();
    // past this the ground's own painted terraces carry the same fields, and rice blades are for the verge of the view only
    world.staticGroup.add(nearOnly(new THREE.Mesh(g, material), o.rice ? 12 : 45));
    tris += o.p.length / 9;
  }
  world.plateTris = tris;
}

export function plan({ track, terrain, world }) {
  const U = (j, f = 0) => { const a = track.pointU[j], b = track.pointU[(j + 1) % track.pointU.length]; return ((a + ((b - a + 1) % 1) * f) % 1 + 1) % 1; };
  const P = (u) => track.pointAt(u), keep = world.keepOut;
  const at = (u, d, along = 0) => { const p = P(u); return { x: p.x + p.nx * d + p.tx * along, z: p.z + p.nz * d + p.tz * along, p }; };
  const def = track.def, water = terrain.water;
  world.buildings = [];
  const site = (kind, u, d, opts = {}) => {
    const { x, z, p } = at(u, d, opts.along || 0), yaw = Math.atan2(-p.nx * Math.sign(d || 1), -p.nz * Math.sign(d || 1)) + (opts.turn || 0);
    world.buildings.push({ kind, x, z, yaw, u, d, ...opts });
    keep.push({ x, z, r: opts.r ?? 8 });
  };
  // world coordinates of the plan: a runs at Agung, b to its right
  const ab = (a, b) => ({ x: b, z: -a });

  // the village street, a compound either side, as Balinese villages run along one road
  const street = [[0.1, -15.5, 1], [0.35, 16, 2], [0.7, -17, 3], [1.1, 16.5, 4], [1.45, -15.5, 5], [1.75, 17, 6], [41.2, -16, 7], [41.7, 16.5, 8], [42.1, -17, 9], [42.6, 16, 10]];
  for (const [j, d, seed] of street) site(seed % 3 === 0 ? 'warung' : 'house', U(Math.floor(j), j % 1), d, { seed, r: 8, turn: 0.1 * (hash3(seed, 1, 5) - 0.5) });
  for (const [j, d, seed] of [[0.25, -31, 11], [0.6, 31, 12], [1.2, -33, 13], [1.6, 33, 14], [2.1, -29, 15], [41.5, 33, 16], [42.3, -35, 17], [42.8, 33, 18]]) site('house', U(Math.floor(j), j % 1), d, { seed, r: 8, turn: hash3(seed, 2, 4) * 0.5 - 0.25 });
  for (const [j, d, seed] of [[0.5, -24, 21], [1.3, 25, 22], [42.5, 26, 23]]) site('bale', U(Math.floor(j), j % 1), d, { seed, r: 7, turn: 0.2 });
  // the family temples, at the mountain end of each compound, as every house here has one: black roofs over the wall
  for (const [j, d, seed] of [[0.32, 22.5, 81], [0.85, -23, 82], [1.5, 24, 83], [2.3, -22, 84], [41.45, -23, 85], [42.0, 23.5, 86], [42.8, -24, 87]]) site('sanggah', U(Math.floor(j), j % 1), d, { seed, r: 7 });

  // the gate of the village's own temple: small, beside the street, facing it, one tower split in two: nothing a road drives through
  site('villageGate', U(1, 0.4), 10.5, { r: 7, gate: true, turn: 0 });
  site('villageGate', U(41, 0.4), -10.5, { r: 7, gate: true, turn: 0 });

  // the temple of the lake: two islets, an 11 tier meru and a 3 tier one, and the shore gate facing them across the water
  world.temple = { big: ab(-122, 28), small: ab(-110, -14), water };
  for (const q of [world.temple.big, world.temple.small]) keep.push({ x: q.x, z: q.z, r: 18 });
  site('shoreGate', U(36, 0.1), 19, { r: 15, gate: true, turn: 0 });
  site('bale', U(36, 0.55), 24, { seed: 31, r: 7, turn: 0.3 });
  site('bale', U(35, 0.6), 25, { seed: 32, r: 7, turn: -0.2 });

  // what the terraces are for, in the fields
  for (const [j, d, seed] of [[11.4, 44, 41], [12.3, -46, 42], [19.5, 60, 43], [20.5, 34, 44], [26.5, -40, 45], [28.2, 52, 46], [7.5, 60, 47], [4.4, 62, 48]]) site('hut', U(Math.floor(j), j % 1), d, { seed, r: 5 });
  for (const [j, d, seed] of [[10.5, -30, 51], [18.5, 28, 52], [27.4, -30, 53], [29.3, 36, 54], [3.4, 44, 55]]) site('shrine', U(Math.floor(j), j % 1), d, { seed, r: 4 });
  // and by the road itself, as the Rendang road has them every few hundred metres: a little throne on the verge, cloth on it, an offering at its foot
  for (const [j, s, seed] of [[3.6, 1, 61], [5.5, -1, 62], [11.7, 1, 63], [18.3, -1, 64], [19.6, 1, 65], [23.3, -1, 66], [26.4, -1, 67], [28.6, 1, 68], [30.3, -1, 69], [31.6, 1, 70], [33.2, -1, 71]]) site('shrine', U(Math.floor(j), j % 1), s * (track.pointAt(U(Math.floor(j), j % 1)).w / 2 + 3.4), { seed, r: 3, roadside: true });
  // the swing and the nest, hanging over the first valley
  site('swing', U(26, 0.5), 30, { r: 6, turn: Math.PI });
  site('nest', U(25, 0.2), 34, { r: 5 });
  // the banyans of the macaques
  site('banyan', U(39, 0.3), -26, { r: 12 });
  site('banyan', U(40, 0.5), 27, { r: 12 });
  site('banyan', U(38, 0.45), 28, { r: 12 });
  site('banyan', U(40, 0.1), -30, { r: 12 });
  site('banyan', U(37, 0.75), -27, { r: 12 });
  // the old temple of the wood, under the trees, its gate toward the road
  site('forestGate', U(39, 0.8), 18.5, { r: 9, gate: true, turn: 0 });
  site('sanggah', U(38, 0.8), -21, { seed: 88, r: 7 });

  // the woods: jungle on the hills beside the lap, open fields where the terraces are, nothing tall between the first straight and Agung
  const grove = (a, b, r, cover, kinds) => { const q = ab(a, b); world.groves.push({ x: q.x, z: q.z, r, cover, kinds }); };
  grove(200, -470, 280, 0.9); grove(-120, -480, 260, 0.9); grove(420, -440, 240, 0.9);
  grove(220, 800, 320, 0.9); grove(-60, 760, 300, 0.9); grove(-560, 120, 260, 0.75);
  grove(-120, -90, 80, 0.7, [['canopy', 7], ['palm', 3]]);
  grove(640, -200, 200, 0.5); grove(640, 480, 200, 0.5);
  // the street and its gardens
  for (const j of [0.3, 1, 1.7, 41.7, 42.5]) { const a0 = at(U(Math.floor(j), j % 1), 0); world.groves.push({ x: a0.x, z: a0.z, r: 60, cover: -0.4 }); }
  // the sightline up the first straight
  for (let j = 0; j < 3; j++) { const q = ab(160 + j * 70, -10 + j * 8); world.groves.push({ x: q.x, z: q.z, r: 90 + j * 12, cover: -1.4 }); }

  // where the ground is stepped rice fields
  const nope = [], rv = def.ground.ravine;
  // clumps of trees in the fields, with open ground between them: a tree does not stand alone at an even spacing here; none across the first straight's line to Agung
  for (let bz = -640; bz < 760; bz += 110) for (let bx = -520; bx < 780; bx += 110) {
    const x = bx + (hash3(bx, bz, 42) - 0.5) * 70, z = bz + (hash3(bz, bx, 43) - 0.5) * 70, a = -z, b = x;
    if (hash3(bx, bz, 44) > 0.62 || terrain.roadDistAt(x, z) < 70 || (a > -40 && a < 430 && Math.abs(b + 6 - (a - 140) * 0.06) < 60 + Math.max(0, a - 60) * 0.3)) continue;
    world.groves.push({ x, z, r: 26 + 22 * hash3(bx, bz, 45), cover: 0.74, kinds: [['canopy', 7], ['palm', 3]] });
  }
  // real trees in the near end of each ravine, as far as the 3D wood reaches; past that the masses of the build
  for (let bz = -640; bz < 760; bz += 60) for (let bx = -520; bx < 780; bx += 60) {
    const rd = terrain.roadDistAt(bx, bz);
    if (rd > 60 && rv(bx, bz) > 0.5) world.groves.push({ x: bx, z: bz, r: 34, cover: 0.62, kinds: [['canopy', 8], ['palm', 2]] });
  }
  const hole = (x, z, r) => nope.push({ x, z, r });
  for (const j of [0.3, 1, 1.7, 41.8, 42.6]) { const q = at(U(Math.floor(j), j % 1), 0); hole(q.x, q.z, 50); }
  { const q = at(U(36), 21); hole(q.x, q.z, 26); }
  for (const f of [37.4, 37.9, 38.4, 38.9, 39.4, 39.9, 40.4, 40.9]) { const q = at(U(Math.floor(f), f % 1), 0); hole(q.x, q.z, 58); }
  world.terraceAt = (x, z) => {
    const rd = terrain.roadDistAt(x, z), y = terrain.heightAt(x, z);
    if (rd < 3 || y < water + 2.6) return 0;
    // a ravine is wood, never field
    if (rv(x, z) > 0.32 + 0.2 * vnoise(x / 60, z / 60, 39) && rd > 60) return 0;
    for (const q of nope) if ((x - q.x) ** 2 + (z - q.z) ** 2 < q.r * q.r) return 0;
    return smooth(3, 7, rd) * smooth(water + 2.6, water + 3, y);
  };
  // The plates: a soft 0..1 whose 0.5 line is their edge. The gullies of the lahar stay open, so that it comes down in plain sight: planDisasters adds them to keepOut after this plan.
  const keepN = world.keepOut.length;
  for (const g of world.groves) if (g.cover >= 0.7) hole(g.x, g.z, g.r * 0.72);
  world.field = terraceField(terrain);
  world.plateMask = (x, z) => {
    const rd = terrain.roadDistAt(x, z);
    if (rd >= 110) return 0;
    let m = Math.min((rd - TNEAR) / 3 + 0.5, (TFAR - rd) / 6 + 0.5, (terrain.heightAt(x, z) - water - 3.4) / 2 + 0.5);
    if (m < -1) return 0;
    for (const q of nope) { const e = (Math.hypot(x - q.x, z - q.z) - q.r) / 5 + 0.5; if (e < m) m = e; }
    for (let i = keepN; i < world.keepOut.length; i++) { const q = world.keepOut[i], e = (Math.hypot(x - q.x, z - q.z) - q.r) / 6 + 0.5; if (e < m) m = e; }
    return m < 0 ? 0 : m > 1 ? 1 : m;
  };
  // wide and only well inside the plates: a sharp drop on a 4 m grid is a saw of dark shards along the edge of the fields
  world.groundDrop = (x, z) => { const rd = terrain.roadDistAt(x, z); return TDROP * smooth(0.5, 0.95, world.plateMask(x, z)) * smooth(TNEAR + 0.5, TNEAR + 6, rd) * smooth(TFAR - 1, TFAR - 9, rd); };

  // gardens behind the street walls: coconut, banana, the big shade trees, never in the road's first metres
  const garden = (j0, j1, step, d0, d1, seed, kinds) => {
    for (let f = j0, n = 0; f < j1; f += step, n++) for (const s of [1, -1]) {
      const r = hash3(n, s + 3, seed), d = s * (P(U(Math.floor(f), f % 1)).w / 2 + d0 + (d1 - d0) * hash3(n, s + 5, seed)), q = at(U(Math.floor(f), f % 1), d);
      if (terrain.roadDistAt(q.x, q.z) < d0 - 0.5 || (world.keepOut.some((k) => (k.x - q.x) ** 2 + (k.z - q.z) ** 2 < (k.r + 1) ** 2))) continue;
      const kind = kinds[Math.floor(r * kinds.length)];
      world.plant.push({ x: q.x, z: q.z, kind: kind[0], h: kind[1] + kind[2] * hash3(n, s + 7, seed) });
    }
  };
  const VILLAGE = [['palm', 13, 8], ['palm', 13, 8], ['canopy', 8, 5]];
  garden(0.05, 2.6, 0.14, 14, 34, 31, VILLAGE); garden(40.9, 42.95, 0.17, 14, 34, 32, VILLAGE);
  // the wood of the macaques: tall dark crowns right up to the road, both sides, so this stretch is a tunnel of shade after the open terraces
  const WOOD_K = [['canopy', 11, 6], ['canopy', 15, 8], ['canopy', 15, 8], ['canopy', 11, 6], ['palm', 14, 7]];
  garden(36.9, 40.4, 0.08, 12, 18, 33, WOOD_K); garden(36.9, 40.4, 0.09, 18, 34, 34, WOOD_K); garden(36.9, 40.4, 0.18, 34, 60, 35, WOOD_K);

  // coconut palms in clumps on the bunds, a handful close together with open fields between the clumps, as the photographs of Muncan and Bandem have them; none across the sightline to Agung
  const s0 = 62;
  for (let bz = -640; bz < 640; bz += s0) for (let bx = -420; bx < 720; bx += s0) {
    if (hash3(bx, bz, 5) > 0.3 || vnoise(bx / 150, bz / 150, 41) < 0.42) continue;
    const cx = bx + (hash3(bx, bz, 3) - 0.5) * s0, cz = bz + (hash3(bz, bx, 4) - 0.5) * s0, n = 3 + Math.floor(5 * hash3(bx, bz, 7));
    for (let i = 0; i < n; i++) {
      const x = cx + (hash3(i, bx, 8) - 0.5) * 16, z = cz + (hash3(i, bz, 9) - 0.5) * 16, a = -z, b = x;
      const inSight = Math.abs(b + 6 - (a - 140) * 0.06) < 22 + Math.max(0, a - 60) * 0.26 && a > -40 && a < 430;
      if (inSight || world.terraceAt(x, z) < 0.5) continue;
      world.plant.push({ x, z, kind: i % 4 === 3 ? 'canopy' : 'palm', h: (i % 4 === 3 ? 8 : 11) + 10 * hash3(i, bx + bz, 6) });
    }
  }
}

// A scooter on its stand, as every village street has them.
function scooter(color) {
  const P = [];
  for (const z of [-0.55, 0.55]) P.push(paint(place(cylinder(0.24, 0.24, 0.12, 9), { p: [0, 0.24, z], r: [0, 0, Math.PI / 2] }), BLACK));
  P.push(paint(place(capsule(0.2, 1, 4, 7), { p: [0, 0.45, 0], r: [Math.PI / 2, 0, 0] }), color));
  P.push(paint(place(box(0.36, 0.2, 0.7), { p: [0, 0.74, -0.25] }), BLACK));
  P.push(paint(place(box(0.34, 0.8, 0.12), { p: [0, 0.8, 0.5], r: [-0.25, 0, 0] }), color));
  P.push(paint(place(cylinder(0.03, 0.03, 0.7, 5), { p: [0, 1.2, 0.58], r: [0, 0, Math.PI / 2] }), BLACK));
  return merge(P);
}

// The little roofed gate of a family compound, in the wall along the street.
function angkul() {
  return merge([
    paint(place(box(0.8, 5, 0.9), { p: [-1.1, 0.9, 0] }), BRICK, 16), paint(place(box(0.8, 5, 0.9), { p: [1.1, 0.9, 0] }), BRICK, 16),
    paint(place(box(3.2, 0.5, 1.2), { p: [0, 3.5, 0] }), STONE, 12), paint(place(box(3.6, 0.16, 1.5), { p: [0, 3.82, 0] }), '#928e82'),
    paint(place(lathe([[2.6, 3.86], [1.5, 4.7], [0.2, 5.9]], 4), { r: [0, Math.PI / 4, 0] }), IJUK, 13),
    paint(place(sphere(0.24, 6, 5), { p: [0, 6, 0], s: [1, 1.4, 1] }), GOLD),
    paint(place(box(1.42, 2.7, 0.12), { p: [0, 1.34, 0] }), '#7a2f22', 2), paint(place(box(0.08, 2.7, 0.16), { p: [0, 1.34, 0] }), GOLD),
  ]);
}

// A great Balinese kite, the bebean: a fish of bamboo and cloth in red, white and black, flying from the fields at midday, its string down to a bund.
function kite(a, b) {
  const diamond = (w, h, y, c, z = 0) => paint(place(box(w, h, 0.25), { p: [0, y, z], r: [0, 0, Math.PI / 4] }), c);
  const P = [diamond(11, 11, 0, a), diamond(7, 7, 0.2, b, 0.2), diamond(3.2, 3.2, 0.4, BLACK, 0.4), diamond(6.5, 6.5, -11, a), diamond(3.5, 3.5, -11.5, b, 0.2)];
  P.push(paint(place(box(0.3, 26, 0.3), { p: [0, -4, -0.2] }), BAMBOO), paint(place(box(19, 0.3, 0.3), { p: [0, 1, -0.2] }), BAMBOO));
  for (const s of [-1, 1]) {
    const q = [];
    for (let i = 0; i <= 8; i++) q.push([s * (2 + i * 0.5) + Math.sin(i * 0.9) * 1.2, -15 - i * 3.1, 0]);
    P.push(paint(tube(q, 0.36, 4), s > 0 ? b : a));
  }
  return merge(P);
}

export function build({ track, terrain, batch, world, mat }) {
  const groundAt = world.ground.groundAt, B = batch, water = terrain.water;
  buildPlates({ terrain, world, mat });
  const U = (j, f = 0) => { const a = track.pointU[j], b = track.pointU[(j + 1) % track.pointU.length]; return ((a + ((b - a + 1) % 1) * f) % 1 + 1) % 1; };
  const P = (u) => track.pointAt(u);
  const atRoad = (u, d, along = 0) => { const p = P(u), x = p.x + p.nx * d + p.tx * along, z = p.z + p.nz * d + p.tz * along; return { x, z, y: groundAt(x, z), yaw: Math.atan2(p.tx, p.tz), p }; };

  for (const b of world.buildings) {
    // what stands in the fields stands on its plate, not on the ground under it
    let y = (b.kind === 'hut' || b.kind === 'shrine') && !b.roadside && world.plateMask(b.x, b.z) > 0.5 ? world.field.topAt(b.x, b.z) : groundAt(b.x, b.z);
    let g = null, r = 8;
    if (b.kind === 'house') { g = house({ seed: b.seed, w: 6.5 + 2 * hash3(b.seed, 1, 1), l: 8 + 2 * hash3(b.seed, 2, 1), h: 3 }); }
    else if (b.kind === 'warung') { g = warung(b.seed); r = 6; }
    else if (b.kind === 'bale') { g = bale({ seed: b.seed }); r = 6; }
    else if (b.kind === 'hut') { g = hut(); r = 3; }
    else if (b.kind === 'shrine') { g = shrine(); r = 2; }
    else if (b.kind === 'swing') { g = swing(); r = 4; }
    else if (b.kind === 'nest') { g = nest(); r = 3; }
    else if (b.kind === 'banyan') { g = banyan(); r = 14; }
    else if (b.kind === 'sanggah') { g = sanggah(b.seed); r = 6; }
    else if (b.kind === 'villageGate') { g = candiBentar({ gap: 1.5, h: 6.4, wings: 6 }); r = 7; }
    else if (b.kind === 'forestGate') {
      // a gate of the wood, black with moss, guardians in their cloth, parasols
      g = merge([candiBentar({ gap: 1.7, h: 8, wings: 7 }), place(guardian(), { p: [-2.2, 0, 2.6] }), place(guardian(), { p: [2.2, 0, 2.6] }), place(parasol(WHITE), { p: [-2.2, 0, -2.6] }), place(parasol('#e8c14a'), { p: [2.2, 0, -2.6] })]);
      const C = g.attributes.color; for (let k = 0; k < C.count; k++) { const t = 0.62; C.setX(k, C.getX(k) * t * 0.92); C.setY(k, C.getY(k) * t * 1.05); C.setZ(k, C.getZ(k) * t * 0.88); }
      r = 10;
    }
    else if (b.kind === 'shoreGate') {
      // the shore gate of the temple: split tower, guardians, parasols, steps down to the lake, set back from the kerb
      g = merge([candiBentar({ gap: 2.2, h: 9.5, wings: 8 }),
        place(guardian(), { p: [-3, 0, 3.2] }), place(guardian(), { p: [3, 0, 3.2] }),
        place(parasol(WHITE), { p: [-3, 0, -3] }), place(parasol('#e8c14a'), { p: [3, 0, -3] }), place(parasol('#e8c14a'), { p: [-10, 0, 2.5] }), place(parasol(WHITE), { p: [10, 0, 2.5] })]);
      r = 14;
    }
    if (!g) continue;
    place(g, { p: [b.x, y - 0.05, b.z], r: [0, b.yaw, 0] });
    B.add(g); B.blob(b.x, b.z, r, 0.45);
  }

  // Pura Ulun Danu: the 11 tier meru and its round roofed shrine on one islet, the 3 tier one on the other
  {
    const T = world.temple, L = water;
    const a = merge([islet(16, L), place(meru(11, { base: 10, foot: 3 }), { p: [0, L + 1.2, 0], s: 1.08 }), place(bale({ w: 4.6, l: 4.6, h: 2.4, rh: 2.8, plinth: 1.2, thatch: IJUK }), { p: [9.5, L + 1, 4.5] }), place(parasol(WHITE), { p: [-7, L + 1.2, 6] }), place(parasol('#e8c14a'), { p: [6, L + 1.2, 10] }), place(guardian(), { p: [-11, L + 1.2, 1] })]);
    place(a, { p: [T.big.x, 0, T.big.z] }); B.add(a); B.blob(T.big.x, T.big.z, 22, 0.3);
    const c = merge([islet(10, L), place(meru(3, { base: 8, foot: 2.4 }), { p: [0, L + 1.2, 0] }), place(parasol('#e8c14a'), { p: [5, L + 1.2, 4] })]);
    place(c, { p: [T.small.x, 0, T.small.z] }); B.add(c);
    // a jukung on the water, a duck family
    for (const [k, dz, col] of [[0, 34, '#e0b13c'], [1, -30, '#2d7fc4']]) { const g = canoe(col); place(g, { p: [T.big.x + 20 + k * 40, L + 0.25, T.big.z + dz], r: [0, 0.4 + k * 2, 0] }); B.add(g); }
  }

  // Far off: what fills the ravines and stands in dark clumps in the fields, and the wooded ridge between the fields and Agung. Lumps of crown, too far for a single tree to read, by cells of ground so a view draws what it sees.
  {
    const rv = track.def.ground.ravine, TONES = ['#163f26', '#1b4e2a', '#21592c', '#2b6a30'], cells = new Map();
    const boxD = (x, z) => { const a = -z, b = x; return Math.hypot(Math.max(0, a - 424, -178 - a), Math.max(0, b - 346, -88 - b)); };
    const lump = (x, z, r, sq = 0.82) => {
      const y = groundAt(x, z);
      if (y < water + 1) return;
      const k = `${Math.floor(x / 700)},${Math.floor(z / 700)}`;
      if (!cells.has(k)) cells.set(k, []);
      const list = cells.get(k), tone = TONES[Math.floor(hash3(x, z, 81) * 4)], turn = 6.28 * hash3(z, x, 88), wide = 0.85 + 0.4 * hash3(x, z, 89);
      list.push(paint(place(sphere(r, 6, 4), { p: [x, y + r * 0.55, z], r: [0, turn, 0], s: [wide, sq, 2 - wide] }), tone, 15));
      // a second crown leaning on it: no ball stands alone on a skyline
      if (hash3(x, z, 90) < 0.35) list.push(paint(place(sphere(r * 0.62, 6, 3), { p: [x + Math.cos(turn) * r * 0.7, y + r * (0.6 + 0.5 * hash3(z, x, 91)), z + Math.sin(turn) * r * 0.7] }), TONES[Math.floor(hash3(z, x, 92) * 4)], 15));
    };
    const clear = (x, z) => { const a = -z, b = x; return a > -40 && a < 430 && Math.abs(b + 6 - (a - 140) * 0.06) < 34 + Math.max(0, a - 60) * 0.3; };
    for (let bz = -1200; bz < 960; bz += 30) for (let bx = -880; bx < 1140; bx += 30) {
      const x = bx + (hash3(bx, bz, 82) - 0.5) * 26, z = bz + (hash3(bz, bx, 83) - 0.5) * 26;
      // inside this the 3D wood of the groves stands: a lump seen closer than this is a ball
      if (boxD(x, z) < 170 || terrain.roadDistAt(x, z) < 96 || clear(x, z)) continue;
      const v = rv(x, z), hard = hash3(bx, bz, 84);
      // the ravines, solid; the clumps of the fields, in drifts
      // near the lap a lump is one crown and must not read as a ball; far off it is a whole clump of them
      const big = smooth(60, 300, boxD(x, z));
      if (v > 0.5 && hard < 0.8) lump(x, z, lerp(6, 10, big) + lerp(4, 8, big) * hash3(bx, bz, 85), lerp(1.15, 0.82, big));
      else if (vnoise(x / 120, z / 120, 41) > 0.66 && hard < 0.4) lump(x, z, lerp(4, 7, big) + lerp(3, 6, big) * hash3(bx, bz, 86), lerp(1.2, 0.85, big));
    }
    // the dark treeline between the paddies and the cone, two rows that wander, and the ridge in the south
    for (let b = -700; b < 1000; b += 15) {
      const a0 = 610 + 40 * Math.sin(b / 190) + 22 * Math.sin(b / 53), a1 = 740 + 60 * Math.sin(b / 230 + 2);
      lump(b + 8 * hash3(b, 1, 87), -a0, 10 + 8 * hash3(b, 2, 87));
      if (hash3(b, 3, 87) < 0.8) lump(b + 8 * hash3(b, 4, 87), -a1, 12 + 9 * hash3(b, 5, 87));
      const s0 = -560 + 50 * Math.sin(b / 170 + 1);
      if (hash3(b, 6, 87) < 0.85) lump(b, -s0, 11 + 9 * hash3(b, 7, 87));
    }
    for (const parts of cells.values()) B.add(merge(parts));
  }

  // penjor along the street and the shore: never at a metronome's beat, some alone, some in pairs across the road, each its own height and reach, bending over the verge
  const penjorAt = (u, side, h, reach, seed) => {
    const a = atRoad(u, side * (P(u).w / 2 + 3.1)), g = penjor(h, reach, seed);
    const yaw = Math.atan2(-a.p.nx * side, -a.p.nz * side);
    place(g, { p: [a.x, a.y - 0.1, a.z], r: [0, yaw, 0] }); B.add(g);
    B.blob(a.x, a.z, 0.9, 0.45);
  };
  {
    let n = 0;
    for (const [f0, f1, mean] of [[0.05, 2.5, 0.27], [40.9, 42.9, 0.42], [34.4, 37, 0.6]]) {
      for (let f = f0; f < f1; n++) {
        const j = Math.floor(f), u = U(j, f - j), r = hash3(n, 3, 21), side = r < 0.5 ? 1 : -1, h = 9.5 + 3.5 * hash3(n, 4, 21), reach = 3 + 2.2 * hash3(n, 5, 21);
        penjorAt(u, f1 === 37 ? -1 : side, h, reach, n);
        if (hash3(n, 6, 21) < 0.35 && f1 !== 37) penjorAt(u + 0.002, -side, h - 1, reach, n + 50);
        f += mean * (0.45 + 1.1 * hash3(n, 7, 21));
      }
    }
  }

  // the crest that throws you at the volcano: harvest sheaves stacked along its lip and a woven board each side, for where to fly from
  for (const j of track.jumps) {
    const yaw = Math.atan2(j.tx, j.tz), sheaf = merge([paint(lathe([[0.62, 0], [0.74, 0.5], [0.3, 1.1], [0.5, 1.7], [0.16, 2.2], [0, 2.3]], 10), '#d8b860', 13), paint(place(cylinder(0.33, 0.33, 0.14, 10), { p: [0, 1.1, 0] }), '#8a6a34')]);
    for (const s of [-1, 1]) {
      for (let k = 0; k < 4; k++) {
        const a = atRoad(j.u, s * (j.w / 2 + 1.5 + 0.5 * hash3(k, s, 3)), -k * 2.6 + 2), g = sheaf.clone();
        place(g, { p: [a.x, a.y - 0.08, a.z], r: [0, k, 0], s: 0.85 + 0.3 * hash3(k, s, 4) }); B.add(g); B.blob(a.x, a.z, 1.5, 0.45);
      }
      const b = atRoad(j.u, s * (j.w / 2 + 3.6), 1), P2 = [];
      for (const q of [-1.5, 1.5]) P2.push(paint(place(cylinder(0.09, 0.11, 4.8, 6), { p: [q, 2.3, 0] }), BAMBOO));
      P2.push(paint(place(box(3.4, 1.5, 0.1), { p: [0, 3.7, 0] }), '#e8c14a', 4), paint(place(box(3.6, 0.12, 0.14), { p: [0, 4.5, 0] }), BAMBOO), paint(place(box(3.6, 0.12, 0.14), { p: [0, 2.9, 0] }), BAMBOO));
      for (const q of [-1, 1]) P2.push(paint(place(box(1.4, 0.34, 0.14), { p: [q * 0.5, 3.6 - q * 0 , 0.02], r: [0, 0, q * -0.7] }), '#c8362c'), paint(place(box(1.4, 0.34, 0.14), { p: [q * 0.5, 3.6, -0.02], r: [0, 0, q * -0.7] }), '#c8362c'));
      const g = merge(P2); place(g, { p: [b.x, b.y - 0.1, b.z], r: [0, yaw, 0] }); B.add(g);
    }
  }

  // the long banners of the street, only here and there
  const COLS = ['#e8c14a', '#d9483b', '#2d7fc4', '#f4efe0'];
  for (let f = 0.25, i = 0; f <= 2.2; f += 0.45 + 0.3 * hash3(i, 1, 9), i++) { const j = Math.floor(f), u = U(j, f - j), s = i % 2 ? 1 : -1, a = atRoad(u, s * (P(u).w / 2 + 2.6)), g = umbul(COLS[i % 4]); place(g, { p: [a.x, a.y, a.z], r: [0, a.yaw, 0] }); B.add(g); }

  // ducks in a line on a plate, scarecrows with their ribbons, Bali cattle on the verges, macaques on the walls
  const dk = duck(), lk = lelakut(), cattle = blobAnimal('#c8905a', 1.05, '#8a5a34'), mac = blobAnimal('#a98f70', 0.72, '#e2b9a2');
  const onPlate = (x, z, fall) => (world.plateMask(x, z) > 0.5 ? world.field.topAt(x, z) : fall);
  for (const [j, d, n] of [[11.6, 26, 7], [19.2, 24, 6], [28.4, -26, 8], [7.3, 40, 6]]) {
    for (let i = 0; i < n; i++) { const a = atRoad(U(Math.floor(j), j % 1), d + i * 0.2, i * 1.6), g = dk.clone(); place(g, { p: [a.x, onPlate(a.x, a.z, a.y), a.z], r: [0, a.yaw + 1.2, 0], s: 1.35 }); B.add(g); }
  }
  for (const [j, d] of [[3.2, 28], [11.1, -22], [18.2, 22], [20.1, -24], [26.2, -22], [29.5, 26], [31.2, 24], [12.2, 30]]) { const a = atRoad(U(Math.floor(j), j % 1), d), g = lk.clone(); place(g, { p: [a.x, onPlate(a.x, a.z, a.y) - 0.05, a.z], r: [0, a.yaw + d, 0], s: 1.3 }); B.add(g); }
  for (const [j, d, t] of [[27.3, 9.5, 0.4], [27.6, 10, 2], [10.4, -9, 1], [30.3, -9.5, 3]]) { const a = atRoad(U(Math.floor(j), j % 1), d), g = cattle.clone(); place(g, { p: [a.x, a.y - 0.05, a.z], r: [0, a.yaw + t, 0] }); B.add(g); B.blob(a.x, a.z, 2, 0.5); }
  // along the low wall of the macaque bend
  const hw = (j) => P(U(Math.floor(j), j % 1)).w / 2;
  for (const [j, s] of [[38.6, 1], [39.2, 1], [39.7, 1], [40.1, 1], [38.9, -1], [39.5, -1], [40.3, -1]]) { const d = s * (hw(j) + 3.9), a = atRoad(U(Math.floor(j), j % 1), d), g = mac.clone(); place(g, { p: [a.x, a.y + 0.98, a.z], r: [0, Math.atan2(-a.p.nx * s, -a.p.nz * s), 0] }); B.add(g); }
  // a wall along that bend, unbroken, that stops short of any other stretch of road; the offerings well back from the kerb
  const runOfWall = (j0, j1, side, step, build) => {
    const parts = [];
    for (let f = j0; f < j1; f += step) {
      const d = side * (hw(f) + 3.8), a = atRoad(U(Math.floor(f), f % 1), d), b = atRoad(U(Math.floor(f + step), (f + step) % 1), d), l = Math.hypot(a.x - b.x, a.z - b.z);
      if (terrain.roadDistAt((a.x + b.x) / 2, (a.z + b.z) / 2) < 2.4 || l > 30) continue;
      build(parts, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, l, Math.atan2(b.x - a.x, b.z - a.z));
    }
    if (parts.length) B.add(merge(parts));
  };
  const stoneRun = (parts, x, y, z, l, r) => { parts.push(paint(place(box(0.9, 2.9, l + 0.2), { p: [x, y - 0.55, z], r: [0, r, 0] }), '#6d6a5c', 31), paint(place(box(1.1, 0.16, l + 0.2), { p: [x, y + 0.92, z], r: [0, r, 0] }), '#5f7040')); };
  for (const s of [1, -1]) runOfWall(38.3, 40.5, s, 0.12, stoneRun);
  for (const [j, s] of [[0.4, 1], [1.2, -1], [36.3, -1], [38.8, 1], [2.05, 1]]) { const a = atRoad(U(Math.floor(j), j % 1), s * (hw(j) + 2)), g = offering(); place(g, { p: [a.x, a.y, a.z], r: [0, a.yaw, 0] }); B.add(g); }

  // the compound walls along the street, the little gates in them, the scooters parked well clear of the penjor
  const brickRun = (parts, x, y, z, l, r) => { parts.push(paint(place(box(0.6, 3.4, l + 0.15), { p: [x, y - 0.5, z], r: [0, r, 0] }), BRICK, 16), paint(place(box(0.86, 0.14, l + 0.15), { p: [x, y + 1.22, z], r: [0, r, 0] }), '#c3b99e'), paint(place(box(0.7, 0.3, l + 0.15), { p: [x, y + 1.0, z], r: [0, r, 0] }), '#8b877c', 12)); };
  for (const [j0, j1] of [[0.15, 1.55], [1.95, 2.5], [41.1, 42.7]]) for (const s of [1, -1]) runOfWall(j0, j1, s, 0.1, brickRun);
  for (const [j, s] of [[0.5, 1], [0.9, -1], [1.3, 1], [2.2, -1], [41.4, 1], [41.9, -1], [42.4, 1]]) { const a = atRoad(U(Math.floor(j), j % 1), s * (hw(j) + 3.8)), g = angkul(); place(g, { p: [a.x, a.y - 0.05, a.z], r: [0, a.yaw + Math.PI / 2, 0] }); B.add(g); B.blob(a.x, a.z, 2.2, 0.4); }
  for (const [j, s, c] of [[0.62, 1, '#d9483b'], [0.66, 1, '#2d7fc4'], [1.08, -1, '#26a38a'], [1.42, 1, '#e8c14a'], [2.36, -1, '#d9483b'], [41.6, 1, '#2d7fc4'], [42.25, 1, '#d9483b'], [42.3, 1, '#26a38a']]) { const a = atRoad(U(Math.floor(j), j % 1), s * (hw(j) + 3)), g = scooter(c); place(g, { p: [a.x, a.y, a.z], r: [0, a.yaw + 1.3, 0], s: 1.12 }); B.add(g); B.blob(a.x, a.z, 1.5, 0.6); }

  // the kites of the fields: off to the sides, never across the line to Agung, or over the temple
  for (const [a, b, h, c1, c2, turn] of [[120, 470, 62, '#d9483b', WHITE, 0.4], [430, 150, 58, WHITE, '#d9483b', -0.7], [90, -130, 50, BLACK, '#e8c14a', 1.1]]) {
    const x = b, z = -a, y = groundAt(x, z), g = kite(c1, c2);
    place(g, { p: [x, y + h, z], r: [0.2, turn, 0.08] }); B.add(g);
    const st2 = merge([paint(tube([[x + 14, y + 0.2, z + 14], [x + 8, y + h * 0.45, z + 8], [x, y + h - 1, z]], 0.07, 4), '#f4efe0')]); B.add(st2);
  }

  // What grows along the verge: tufts, young banana, taro, stones. By road stretches, each merged, so a view draws only what it sees and no part of the shoulder is a lit plane.
  {
    // a clump of grass: thin tapered blades of many heights fanning from one foot, dark at the foot, lit at the tip; no blade reads alone
    const tuftOf = (c, seed = 1, blades = 6) => {
      const pos = [], nor = [], shade = [], idx = [];
      for (let i = 0; i < blades; i++) {
        const a = i * 2.4 + 6 * hash3(i, seed, 91), ca = Math.cos(a), sa = Math.sin(a), h = 0.2 + 0.26 * hash3(i, seed, 92), lean = 0.08 + 0.2 * hash3(i, seed, 93), w = 0.028, o0 = 0.07 * hash3(i, seed, 94), v0 = pos.length / 3;
        pos.push(ca * o0 + sa * w, 0, sa * o0 - ca * w, ca * o0 - sa * w, 0, sa * o0 + ca * w, ca * (o0 + lean * 0.45) + sa * w * 0.7, h * 0.6, sa * (o0 + lean * 0.45) - ca * w * 0.7, ca * (o0 + lean * 0.45) - sa * w * 0.7, h * 0.6, sa * (o0 + lean * 0.45) + ca * w * 0.7, ca * (o0 + lean), h, sa * (o0 + lean));
        for (let q = 0; q < 5; q++) nor.push(0, 1, 0);
        shade.push(0.5, 0.5, 0.95, 0.95, 1.3);
        idx.push(v0, v0 + 1, v0 + 2, v0 + 1, v0 + 3, v0 + 2, v0 + 2, v0 + 3, v0 + 4);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setIndex(idx);
      paint(g, c, 14);
      const C = g.attributes.color; for (let k = 0; k < C.count; k++) { C.setX(k, C.getX(k) * shade[k]); C.setY(k, C.getY(k) * shade[k]); C.setZ(k, C.getZ(k) * shade[k]); }
      return g;
    };
    const tufts = ['#5f9440', '#6ea046', '#4f863c', '#7ca648'].map((c, i) => tuftOf(c, i + 1));
    const lawn = ['#568a3a', '#669a40', '#467e36', '#7a9a44'].map((c, i) => tuftOf(c, i + 5, 4));
    // a banana: a soft pale stem and long paddle leaves that rise and droop, folded on a light midrib, torn a little at the edge
    const bananaOf = (c, seed) => {
      const top = 1.7, q = [paint(tube([[0, -0.1, 0], [0.03, 0.9, 0], [0, top, 0]], [0.2, 0.15, 0.09], 5), '#8ea44f')];
      for (let i = 0; i < 7; i++) {
        const a = i * 2.4 + hash3(i, seed, 2), L = 2 + 0.9 * hash3(i, seed, 3), rise = i < 2 ? 1.5 : 0.5 + 0.8 * hash3(i, seed, 4), droop = i < 2 ? 0.2 : 0.8 + 0.7 * hash3(i, seed, 5), ca = Math.cos(a), sa = Math.sin(a), pos = [], nor = [], idx = [], shade = [];
        for (let t = 0; t <= 4; t++) {
          const v = t / 4, d = L * v ** 1.1, y = top - 0.1 + rise * Math.sin(v * 2.1) - droop * v ** 3, w = (0.08 + 0.34 * Math.sin(Math.min(1, v * 0.96 + 0.04) * Math.PI) ** 0.6) * (t === 4 ? 0.05 : 0.86 + 0.28 * hash3(i, t, seed)), fold = 0.12 + 0.3 * w;
          pos.push(ca * d + sa * w, y - fold, sa * d - ca * w, ca * d, y, sa * d, ca * d - sa * w, y - fold, sa * d + ca * w);
          nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
          shade.push(0.92, 1.3, 1.02);
          if (t < 4) { const b = t * 3; idx.push(b, b + 3, b + 1, b + 1, b + 3, b + 4, b + 1, b + 4, b + 2, b + 2, b + 4, b + 5); }
        }
        const lg = new THREE.BufferGeometry();
        lg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        lg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
        lg.setIndex(idx);
        paint(lg, c, 14);
        const C = lg.attributes.color; for (let k = 0; k < C.count; k++) { C.setX(k, C.getX(k) * shade[k]); C.setY(k, C.getY(k) * shade[k]); C.setZ(k, C.getZ(k) * shade[k]); }
        q.push(lg);
      }
      return merge(q);
    };
    const bananas = [bananaOf('#3f9a46', 1), bananaOf('#4ea84a', 2), bananaOf('#368c42', 3)];
    // a fern: a dozen arcs from one crown, low and dark, the wet side of a verge
    const fernOf = (c) => {
      const pos = [], nor = [], idx = [];
      for (let i = 0; i < 7; i++) {
        const a = i * 2.4, ca = Math.cos(a), sa = Math.sin(a), L = 0.95 + 0.5 * hash3(i, 3, 8), H = 0.5 + 0.35 * hash3(i, 4, 8), v0 = pos.length / 3;
        for (let t = 0; t <= 2; t++) { const v = t / 2, d = L * v, y = 0.05 + H * Math.sin(v * 2.5), w = 0.1 * (1 - v * 0.92); pos.push(ca * d + sa * w, y, sa * d - ca * w, ca * d - sa * w, y, sa * d + ca * w); nor.push(0, 1, 0, 0, 1, 0); if (t < 2) { const q = v0 + t * 2; idx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); } }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setIndex(idx);
      return paint(g, c, 14);
    };
    const ferns = [fernOf('#2f8644'), fernOf('#3c9648')];
    // hibiscus: a dark round bush with its red flowers, and the yellow one
    const hibiscusOf = (fl) => { const q = []; for (let i = 0; i < 3; i++) q.push(paint(place(sphere(0.62 + 0.14 * i, 7, 5), { p: [Math.cos(i * 2.1) * 0.42, 0.6 + 0.1 * i, Math.sin(i * 2.1) * 0.42], s: [1, 0.86, 1] }), i % 2 ? '#256f40' : '#2c7c44', 15)); for (let i = 0; i < 9; i++) { const a = i * 2.4, e = 0.7 + 0.5 * hash3(i, 7, 3), r = 0.72 * Math.cos(e); q.push(paint(place(sphere(0.11, 4, 3), { p: [Math.cos(a) * r * 1.2, 0.68 + 0.72 * Math.sin(e), Math.sin(a) * r * 1.2], s: [1, 0.55, 1] }), fl)); } return merge(q); };
    const hibs = [hibiscusOf('#e0363c'), hibiscusOf('#e8483c'), hibiscusOf('#f2c23a')];
    const stoneG = paint(place(sphere(0.4, 6, 4), { s: [1, 0.6, 0.8] }), '#8a877c');
    const fineMat = mat('#ffffff', { vertexColors: true, paint: true, shade: true, side: THREE.DoubleSide });
    const n = track.n;
    let fine = [];
    for (let c = 0, kc = 0; c < n; c += 40, kc++) {
      const parts = [];
      for (let i = c; i < Math.min(n, c + 40); i++) {
        const S = track.samples, hwi = S.w[i] / 2;
        if (S.struct[i]) continue;
        for (const side of [1, -1]) {
          // what breaks the edge of the road: grass hard against the tarmac, unevenly, never a ruled line
          for (let t = 0; t < 3; t++) {
            if (hash3(i, side + t * 9, 61) < 0.35) continue;
            const e = 0.12 + 1.3 * hash3(i, side * 3 + t, 62) ** 1.5, d = side * (hwi + e), along = 2 * hash3(i, side * 7 + t, 63), x = S.x[i] + S.nx[i] * d + S.tx[i] * along, z = S.z[i] + S.nz[i] * d + S.tz[i] * along;
            fine.push(place(tufts[Math.floor(hash3(i, side + t, 64) * 4)].clone(), { p: [x, groundAt(x, z) - 0.03, z], r: [0, 6.28 * hash3(i, side, 65 + t), 0], s: 0.7 + 0.7 * hash3(i, side + t, 67) }));
          }
          // the grass of the verge itself: small clumps close together, layered in depth
          for (let t = 0; t < 4; t++) {
            const e = 0.7 + 5.4 * hash3(i, side * 11 + t, 102), d = side * (hwi + e), along = 2 * hash3(i, side * 13 + t, 103), x = S.x[i] + S.nx[i] * d + S.tx[i] * along, z = S.z[i] + S.nz[i] * d + S.tz[i] * along;
            if (world.plateMask(x, z) > 0.2 || terrain.roadDistAt(x, z) < 0.3) continue;
            const y = groundAt(x, z);
            if (y >= water + 0.6) fine.push(place(lawn[Math.floor(hash3(i, side + t, 104) * 4)].clone(), { p: [x, y - 0.03, z], r: [0, 6.28 * hash3(i, t, 105), 0], s: 0.9 + 0.8 * hash3(i, side + t, 106) }));
          }
          // ferns along the top of the bank where the fields stop: they break its line, so it has no edge to read
          for (let t = 0; t < 2; t++) {
            if (hash3(i, side + t * 3, 95) < 0.22) continue;
            const e = TNEAR - 1.6 + 2.6 * hash3(i, side * 3 + t, 96), d = side * (hwi + e), along = 2 * hash3(i, side * 7 + t, 97), x = S.x[i] + S.nx[i] * d + S.tx[i] * along, z = S.z[i] + S.nz[i] * d + S.tz[i] * along, mk = world.plateMask(x, z);
            if (mk <= 0.02 || terrain.roadDistAt(x, z) < 3) continue;
            const y = Math.max(groundAt(x, z), mk > 0.5 ? world.field.topAt(x, z) : -1e9);
            fine.push(place((t ? ferns : tufts)[Math.floor(hash3(i, side + t, 98) * 2)].clone(), { p: [x, y - 0.04, z], r: [0, 6.28 * hash3(i, side + t, 99), 0], s: t ? 0.8 + 0.7 * hash3(i, side, 100) : 1.4 + 0.8 * hash3(i, side, 101) }));
          }
          const uF = S.u ? S.u[i] : i / n, thick = uF > U(36, 0.9) && uF < U(40, 0.4);
          for (let t = 0; t < 3; t++) {
            if (thick && hash3(i, side + t, 47) > 0.55) continue;
            if (!thick && t === 1 && i % 2) continue;
            if (!thick && t === 2 && i % 2) continue;
            const r = thick ? 0.62 + 0.16 * hash3(i, side * 3 + t, 41) : hash3(i, side * 3 + t, 41), e = t >= 2 ? 4 + 26 * hash3(i, side * 5, 49) : 1.2 + 4.6 * hash3(i, side * 5 + t, 42) ** 1.4, d = side * (hwi + e), along = 2 * hash3(i, side * 7 + t, 43);
            const x = S.x[i] + S.nx[i] * d + S.tx[i] * along, z = S.z[i] + S.nz[i] * d + S.tz[i] * along, rd = terrain.roadDistAt(x, z);
            if (rd < 1 || world.plateMask(x, z) > 0.2) continue;
            const y = groundAt(x, z);
            if (y < water + 0.6) continue;
            const turn = 6.28 * hash3(i, side, 45), pick = hash3(i, side + t * 5, 46);
            let g, sc = 0.55 + 0.7 * hash3(i, side, 44);
            if (r < 0.62) { if (t >= 2) continue; g = tufts[Math.floor(pick * 4)]; sc = 0.8 + 0.8 * hash3(i, side + t, 44); }
            else if (r < 0.71) g = ferns[Math.floor(pick * 2)];
            else if (r < 0.745 && rd > 3.6) { g = bananas[Math.floor(pick * 3)]; sc = 0.6 + 0.4 * hash3(i, side, 44); B.blob(x, z, 1.6, 0.4); }
            else if (r < 0.763 && rd > 3) { g = hibs[Math.floor(pick * 3)]; sc = 0.5 + 0.3 * hash3(i, side, 44); B.blob(x, z, 0.8, 0.45); }
            else if (r < 0.84) { g = stoneG; B.blob(x, z, 0.7, 0.4); }
            else continue;
            (g === tufts[0] || g === tufts[1] || g === tufts[2] || g === tufts[3] ? fine : parts).push(place(g.clone(), { p: [x, y - 0.04, z], r: [0, turn, 0], s: sc }));
          }
        }
      }
      if (parts.length) B.add(merge(parts));
      // a few stretches to a mesh: a draw call is dearer than some blades behind the camera
      if (fine.length && (kc % 3 === 2 || c + 40 >= n)) {
        const fg = merge(fine);
        fg.computeBoundingSphere();
        world.staticGroup.add(nearOnly(new THREE.Mesh(fg, fineMat), 26));
        fine = [];
      }
    }
  }

  // the floor of the wood: deep shade, no bright lawn under a tree
  for (let f = 36.9, n = 0; f < 41; f += 0.05, n++) for (const s of [1, -1]) { const a = atRoad(U(Math.floor(f), f % 1), s * (hw(f) + 7 + 26 * hash3(n, s, 77))); B.blob(a.x, a.z, 11 + 5 * hash3(n, s, 78), 0.5); }

  // bamboo on the bridge: rails, and bundles of poles lashed to its face
  const st = track.structures.find((s) => s.kind === 'bridge');
  if (st) {
    const count = ((st.i1 - st.i0 + track.n) % track.n) + 1, S = track.samples, parts = [];
    for (const side of [-1, 1]) {
      const pts = (h) => { const o = []; for (let q = 0; q <= count; q += 2) { const i = (st.i0 + q) % track.n; o.push([S.x[i] + S.nx[i] * side * (S.w[i] / 2 + 0.2), S.y[i] + h, S.z[i] + S.nz[i] * side * (S.w[i] / 2 + 0.2)]); } return o; };
      parts.push(paint(tube(pts(1.5), 0.13, 5), BAMBOO), paint(tube(pts(0.8), 0.1, 5), BAMBOO));
      for (let q = 0; q <= count; q += 3) {
        const i = (st.i0 + q) % track.n, x = S.x[i] + S.nx[i] * side * (S.w[i] / 2 + 0.28), z = S.z[i] + S.nz[i] * side * (S.w[i] / 2 + 0.28);
        parts.push(paint(place(cylinder(0.11, 0.13, 8.4, 5), { p: [x, S.y[i] - 2.6, z] }), q % 6 ? '#b9a25c' : BAMBOO));
        parts.push(paint(place(sphere(0.17, 5, 4), { p: [x, S.y[i] + 1.55, z] }), '#6b5c38'));
      }
    }
    B.add(merge(parts));
  }

  // posts and stringers under the plank over the paddies
  for (const sc of track.shortcuts) {
    const parts = [];
    for (const side of [-1, 1]) for (let i = 2; i < sc.n - 2; i += 3) {
      const s = sc.samples, x = s.x[i] + s.nx[i] * side * (s.w[i] / 2 + 0.2), z = s.z[i] + s.nz[i] * side * (s.w[i] / 2 + 0.2);
      const main = track.nearest(x, z);
      if (Math.abs(main.d) < track.samples.w[main.i] / 2 + 1.5) continue;
      parts.push(paint(place(cylinder(0.08, 0.1, 2.2, 5), { p: [x, s.y[i] - 0.1, z] }), BAMBOO));
      if (i % 6 === 2) parts.push(paint(place(sphere(0.14, 5, 4), { p: [x, s.y[i] + 1.02, z] }), '#d9483b'));
    }
    if (parts.length) B.add(merge(parts));
  }
}

// Shared with the long Bali track.
export { sanggah, bale, house, warung, candiBentar, guardian, parasol, penjor, umbul, hut, shrine, lelakut, duck, banyan, canoe, offering };
