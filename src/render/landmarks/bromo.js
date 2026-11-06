// Mare di Sabbia: the Tengger caldera at dawn. Facts in docs/references/bromo.md. Placed by u, the fraction of the lap, and d, metres
// to the left of the road's centre, so a retuned road carries its things with it. Pura Luhur Poten is scenery, treated with care:
// no road runs through it, nothing falls on it, and its ground is kept clear. The hero is the painted panorama: Bromo with its plume, Semeru, Batok and the wall. The cone the road climbs is
// the ground with a torn crown on it, in the painting's colours, a foothill in front of it. What moves here is the vents' steam, the far jeeps' dust and the mist on the floor.
import * as THREE from 'three';
import { hash3, lerp, smooth, linear, D2R } from '../math.js';
import { ponyGeometry } from '../props.js';
import { merge, paint, place, box, roundedBox, sphere, capsule, cylinder, cone, gable, tube, quad } from '../shapes.js';
import { SHOULDER, STAIR, WALL, rimR, rimY, bromoCone, wallRho } from '../../world/tracks/bromo.js';

// The temple's stone is black lava, its roofs black palm fibre; the only colour on it is what people bring.
const LAVA = '#6e5a68', LAVA_L = '#94808a', LAVA_D = '#4e3e50', IJUK = '#3c3040', LIME = '#8a7a7c';
const TIN = '#9aa0a6', TIN_R = '#8f5f48', PLANK = '#6a5240', BAMBOO = '#b69c5e', TARP = '#3a6f9c';
const NORTH = -80;


const frustum = (r0, r1, y, h) => place(cylinder(r1 * Math.SQRT2, r0 * Math.SQRT2, h, 4), { p: [0, y + h / 2, 0], r: [0, Math.PI / 4, 0] });

// One half of a candi bentar: a tall tapering flame of black stone in courses, each with its projecting moulding, rounded at the top, the inner face cut sheer as with a knife. s is the side the outer flank falls toward.
function candiHalf(H, W, s) {
  const parts = [], n = 8, D = W * 0.72;
  const P = (g, c, k = 1) => parts.push(paint(g, c, k));
  P(place(roundedBox(W * 1.2, H * 0.08, D * 1.3, 0.1, 1), { p: [(s * W * 1.2) / 2, H * 0.04, 0] }), LAVA_L);
  for (let i = 0; i < n; i++) {
    const t = i / n, h = (H * 0.84) / n, y = H * 0.08 + i * h, k = 1 - t * t * 0.62 - t * 0.2, w = W * k, d = D * (0.55 + 0.45 * k), x = (s * w) / 2;
    P(place(box(w, h * 0.82, d), { p: [x, y + h * 0.41, 0] }), i % 2 ? LAVA : LAVA_D);
    P(place(roundedBox(w + 0.24, h * 0.17, d + 0.24, 0.06, 1), { p: [x + s * 0.06, y + h * 0.9, 0] }), LAVA_L);
    // the carved rows: a darker recess on each face of the course
    if (i < n - 2) for (const q of [-1, 1]) P(place(box(w * 0.56, h * 0.38, 0.06), { p: [x, y + h * 0.4, q * (d / 2 + 0.02)] }), '#1e1b22', 0);
    // the corners of each course flick up in carved points: this, more than the mass, is what a split gate looks like against the sky
    for (const q of [-1, 1]) {
      P(place(cone(0.11 * W * (1 - t * 0.5), h * 0.62, 5), { p: [s * (w + 0.04), y + h * 1.2, q * (d / 2 + 0.06)], r: [q * 0.14, 0, -s * 0.2] }), LAVA_L);
      P(place(cone(0.08 * W * (1 - t * 0.5), h * 0.42, 5), { p: [s * w * 0.5, y + h * 1.12, q * (d / 2 + 0.06)] }), LAVA_L);
    }
  }
  // no ball on top: it ends in a small stepped point
  P(place(cone(W * 0.13, H * 0.1, 6), { p: [(s * W * 0.2) / 1.4, H * 0.98, 0] }), LAVA_L);
  return merge(parts);
}

function splitGate(H, W, gap) {
  return merge([place(candiHalf(H, W, -1), { p: [-gap / 2, 0, 0] }), place(candiHalf(H, W, 1), { p: [gap / 2, 0, 0] })]);
}

// A meru: a stone base and an odd number of black palm fibre roofs, broad and low at the bottom, soft at the corners. Slim and dark, seen from the sand it is a flame among the gates.
function meru(tiers, H, W) {
  const parts = [], base = H * 0.22;
  parts.push(paint(place(roundedBox(W * 1.5, base * 0.5, W * 1.5, 0.1, 1), { p: [0, base * 0.25, 0] }), LAVA_L, 1), paint(place(box(W, base * 0.6, W), { p: [0, base * 0.8, 0] }), LAVA, 1));
  const y0 = base * 1.05, h = (H - base) / tiers;
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers, r = W * (0.96 - t * 0.76), y = y0 + i * h;
    parts.push(paint(frustum(r, r * 0.34, y + h * 0.18, h * 0.82), IJUK, 3));
    parts.push(paint(place(box(r * 0.58, h * 0.22, r * 0.58), { p: [0, y + h * 0.1, 0] }), LAVA_D));
  }
  parts.push(paint(place(sphere(W * 0.09, 6, 5), { p: [0, y0 + tiers * h + W * 0.05, 0] }), LAVA_L));
  return merge(parts);
}

// A long open hall, as they stand along the yard: stone plinth, a line of dark posts, a broad low hipped roof of dark grey.
function hall(w, l, h) {
  const parts = [paint(place(box(w + 1, 0.9, l + 1), { p: [0, 0.35, 0] }), LAVA_L, 1)];
  const nx = Math.round(l / 3.4);
  for (let i = 0; i <= nx; i++) for (const z of [-1, 1]) parts.push(paint(place(box(0.32, h, 0.32), { p: [(z * w) / 2.15, 0.8 + h / 2, -l / 2.1 + (i * l) / (nx * 1.05)] }), '#27211e'));
  const hip = (w0, l0, w1, l1, y, hh, col) => {
    const g = cylinder(Math.SQRT1_2, Math.SQRT1_2 * 1.0, 1, 4); // unit frustum, then scaled: a rectangular hip
    const f = place(cylinder(0.5, 1, 1, 4), { r: [0, Math.PI / 4, 0] }); g.dispose();
    const P = f.attributes.position;
    for (let i = 0; i < P.count; i++) { const top = P.getY(i) > 0, ax = (top ? w1 : w0) / Math.SQRT2 / (top ? 0.5 : 1), az = (top ? l1 : l0) / Math.SQRT2 / (top ? 0.5 : 1); P.setXYZ(i, P.getX(i) * ax, (P.getY(i) + 0.5) * hh + y, P.getZ(i) * az); }
    f.computeVertexNormals();
    return paint(f, col, 3);
  };
  parts.push(hip(w * 1.28, l * 1.14, w * 0.5, l * 0.72, 0.8 + h, 2.4, '#2d2b32'));
  parts.push(hip(w * 0.52, l * 0.74, w * 0.12, l * 0.42, 3.2 + h, 1.4, IJUK));
  return merge(parts);
}

// A square hall with thick dark walls and a tall steep roof: the one bulky thing at the end of the yard.
function towerHall(W) {
  const parts = [paint(place(box(W + 1.4, 1, W + 1.4), { p: [0, 0.4, 0] }), LAVA_L, 1), paint(place(box(W, 6, W), { p: [0, 3.8, 0] }), LAVA, 1)];
  for (const x of [-1, 1]) parts.push(paint(place(box(W * 0.26, 3.2, 0.08), { p: [(x * W) / 4, 3.8, W / 2 + 0.03] }), LIME));
  parts.push(paint(frustum(W * 0.68, W * 0.32, 6.8, 3.4), IJUK, 3), paint(place(box(W * 0.46, 1.4, W * 0.46), { p: [0, 10.8, 0] }), LAVA, 1), paint(frustum(W * 0.42, W * 0.04, 11.4, 3.8), IJUK, 3));
  return merge(parts);
}

// Pura Luhur Poten, a cartoon of it with respect, and in the black stone it is built of. A long low wall on a plinth rising from the sand, its long side toward +z: the stair up to the great split gate in the middle, the pairs of dark flame towers along the yard, a slim meru, the broad halls behind the wall.
function temple(L, D) {
  const parts = [], H = 3.1, T = 1, PL = 1.5, seg = L / 25;
  // the plinth the whole thing stands on, sand drifted against it
  parts.push(paint(place(box(L + 3, PL, D + 3), { p: [0, PL / 2 - 0.2, 0] }), LAVA_D, 1));
  parts.push(paint(place(box(L + 5, 0.5, D + 5), { p: [0, 0.05, 0] }), '#5a4c56'));
  for (let i = -12; i <= 12; i++) {
    if (Math.abs(i) < 2) continue;
    parts.push(paint(place(box(seg - 0.05, H, T), { p: [i * seg, PL + H / 2 - 0.2, D / 2] }), i % 2 ? LAVA : LAVA_D, 1));
    parts.push(paint(place(roundedBox(0.8, H + 1, T + 0.5, 0.08, 1), { p: [(i - 0.5 * Math.sign(i)) * seg, PL + (H + 1) / 2 - 0.2, D / 2] }), LAVA_L, 1));
    parts.push(paint(place(roundedBox(seg, 0.3, T + 0.34, 0.06, 1), { p: [i * seg, PL + H - 0.1, D / 2] }), LAVA_L));
  }
  parts.push(paint(place(box(L, H, T), { p: [0, PL + H / 2 - 0.2, -D / 2] }), LAVA, 1));
  for (const s of [-1, 1]) parts.push(paint(place(box(T, H, D), { p: [(s * L) / 2, PL + H / 2 - 0.2, 0] }), LAVA, 1));
  parts.push(paint(place(box(L - 1, 0.2, D - 1), { p: [0, PL, 0] }), '#58535a'));
  // the stair and the great gate at its top
  for (let i = 0; i < 6; i++) parts.push(paint(place(box(4.6, 0.3, 0.7), { p: [0, 0.15 + i * 0.3, D / 2 + 5.6 - i * 0.7] }), '#6a6468', 1));
  for (const s of [-1, 1]) parts.push(paint(place(box(0.7, 1.9, 4.4), { p: [s * 2.7, 1.0, D / 2 + 3.8] }), LAVA_L, 1));
  parts.push(place(splitGate(15, 6.2, 4.4), { p: [0, PL, D / 2 + 0.6] }));
  // pairs of flame towers along the yard, and the meru among them
  for (const [x, z, h] of [[-0.3, 0.2, 11], [-0.16, 0.2, 12.5], [0.16, 0.2, 12.5], [0.3, 0.2, 11]]) parts.push(place(splitGate(h, 3.2, 1.6), { p: [x * L, PL, z * D] }));
  for (const [x, z, tiers, h, w] of [[-0.23, -0.1, 5, 15, 3.4], [0.05, -0.3, 3, 10, 3.2]]) parts.push(place(meru(tiers, h, w), { p: [L * x, PL, D * z] }));
  // the broad low halls, as the photo from the sand shows them, and the square one at the end
  parts.push(place(hall(10, 26, 3), { p: [L * 0.26, PL, -D * 0.12], r: [0, Math.PI / 2, 0] }));
  parts.push(place(hall(6, 15, 2.6), { p: [L * 0.42, PL, D * 0.14], r: [0, Math.PI / 2, 0] }));
  parts.push(place(towerHall(9), { p: [-L * 0.42, PL, -D * 0.1] }));
  // pennants on bamboo at the gate, as they stand for a ceremony: never a joke, only colour
  for (const s of [-1, 1]) {
    parts.push(paint(place(cylinder(0.08, 0.11, 10, 5), { p: [s * 8, 5, D / 2 + 3.4] }), BAMBOO));
    parts.push(paint(quad([s * 8, 9.8, D / 2 + 3.4], [s * 8 + s * 0.05, 5.6, D / 2 + 3.4], [s * 8 + s * 0.7, 7.4, D / 2 + 3.4], [s * 8 + s * 0.7, 9.6, D / 2 + 3.4]), s > 0 ? '#d9b23e' : '#e6dfd0'));
    // umbul umbul along the wall, tall curved poles with long cloths: what the eye finds from far across the sand
    for (let i = 0; i < 6; i++) {
      const x = s * (15 + i * (L / 2 - 16) / 5), h = 10.5 + 1.6 * hash3(i, s + 2, 9), z = D / 2 + 3;
      parts.push(paint(tube([[x, 0, z], [x, h * 0.6, z], [x + s * 0.5, h, z], [x + s * 1.3, h + 0.9, z]], 0.07, 4), BAMBOO));
      parts.push(paint(quad([x + s * 0.06, h - 0.1, z], [x + s * 0.06, h - 4.6, z], [x + s * 1.0, h - 3.8, z], [x + s * 1.0, h, z]), ['#d9b23e', '#e6dfd0', '#b8443c'][(i + (s > 0 ? 1 : 0)) % 3]));
    }
  }
  return merge(parts);
}

// A Bromo hardtop, rounded and heavy on its wheels: a short old 4x4, a pale roof over a faded body, volcanic sand up its flanks, round lamps, roof rack and the spare on its back. Generic, no badge.
function hardtop(body, seed) {
  const parts = [], W = '#23212a', roofC = ['#e6dfd0', '#d9d2c2', '#c9c3b6'][seed % 3];
  parts.push(paint(place(roundedBox(1.9, 0.9, 3.9, 0.2, 2), { p: [0, 1.0, 0] }), body));
  // the sand it has been through
  parts.push(paint(place(roundedBox(1.96, 0.3, 3.96, 0.1, 1), { p: [0, 0.66, 0] }), '#5e5a62'));
  parts.push(paint(place(roundedBox(1.74, 0.82, 2.4, 0.2, 2), { p: [0, 1.82, -0.46] }), roofC));
  parts.push(paint(place(roundedBox(1.78, 0.44, 2.12, 0.1, 1), { p: [0, 1.8, -0.46] }), '#343c48'));
  parts.push(paint(place(box(1.5, 0.48, 0.1), { p: [0, 1.82, 0.74] }), '#6f8796'));
  parts.push(paint(place(roundedBox(2.0, 0.2, 0.34, 0.08, 1), { p: [0, 0.74, 1.98] }), '#2e2c32'));
  for (const s of [-1, 1]) {
    parts.push(paint(place(cylinder(0.17, 0.17, 0.08, 10), { p: [s * 0.62, 1.1, 1.96], r: [Math.PI / 2, 0, 0] }), '#f6e6b8'));
    // fat wheels under flared arches
    parts.push(paint(place(roundedBox(0.28, 0.5, 1.2, 0.1, 1), { p: [s * 0.94, 0.94, 1.14] }), body), paint(place(roundedBox(0.28, 0.5, 1.2, 0.1, 1), { p: [s * 0.94, 0.94, -1.14] }), body));
    for (const z of [-1.14, 1.14]) {
      parts.push(paint(place(cylinder(0.5, 0.5, 0.42, 14), { p: [s * 0.9, 0.5, z], r: [0, 0, Math.PI / 2] }), W));
      parts.push(paint(place(cylinder(0.22, 0.22, 0.44, 8), { p: [s * 0.9, 0.5, z], r: [0, 0, Math.PI / 2] }), '#a8a096'));
    }
  }
  parts.push(paint(place(cylinder(0.46, 0.46, 0.3, 14), { p: [0, 1.16, -2.1], r: [Math.PI / 2, 0, 0] }), W));
  parts.push(paint(place(box(1.46, 0.08, 1.9), { p: [0, 2.3, -0.46] }), '#3e3a42'));
  parts.push(paint(place(roundedBox(1.1, 0.36, 0.9, 0.1, 1), { p: [0, 2.5, -0.1 - (seed % 3) * 0.3] }), ['#a8875a', '#6f7f5a', '#8a5a4a'][seed % 3]));
  return merge(parts);
}

// A warung of the sand sea: square timber posts and a real plank back with thickness, a ribbed tin roof with a sag and a blue tarp, and what they really sell up here: woollen hats and scarves on a line, bunches of edelweiss, hot drinks.
function warung(seed = 0) {
  const parts = [], w = 6.4, l = 4.4, roof = seed % 2 ? TIN : TIN_R, cloth = ['#b8483c', '#2f7a6a', '#c9983c', '#2f5a9c'][seed % 4];
  const P = (g, c, k = 0) => parts.push(paint(g, c, k));
  for (const [x, z, h] of [[-1, -1, 2.3], [0, -1, 2.3], [1, -1, 2.3], [-1, 1, 3], [1, 1, 3]]) {
    P(place(box(0.2, h, 0.2), { p: [(x * w) / 2.15, h / 2, (z * l) / 2.15] }), '#4d3a2c', 2);
    P(place(box(0.34, 0.2, 0.34), { p: [(x * w) / 2.15, 0.1, (z * l) / 2.15] }), '#3a3838');
  }
  // the back wall, boards with depth, and a brace
  for (let i = 0; i < 9; i++) P(place(box(w / 9 - 0.03, 2.1, 0.14), { p: [-w / 2 + (i + 0.5) * (w / 9), 1.06, -l / 2.15] }), i % 3 ? PLANK : '#5a4636', 2);
  P(place(box(w, 0.14, 0.2), { p: [0, 2.2, -l / 2.15] }), '#3a2c22');
  // the roof: ribs of tin over its rafters, tilted, not one flat sheet
  const rafter = -0.17;
  for (let i = 0; i < 18; i++) P(place(box((w + 1) / 18 - 0.02, 0.1 + 0.05 * (i % 2), l + 1.3), { p: [-(w + 1) / 2 + (i + 0.5) * ((w + 1) / 18), 2.84, 0.1], r: [rafter, 0, 0] }), i % 2 ? roof : '#7f8488');
  P(place(box(w * 0.5, 0.03, l * 0.6), { p: [-w * 0.2, 2.98, -0.2], r: [rafter, 0, 0] }), TARP);
  // the counter with its cloth, and things on it
  P(place(roundedBox(w * 0.86, 1, 1, 0.06, 1), { p: [0, 0.5, -l * 0.12] }), '#74563e', 2);
  P(place(roundedBox(w * 0.92, 0.1, 1.2, 0.04, 1), { p: [0, 1.04, -l * 0.12] }), cloth);
  for (let i = -3; i <= 3; i++) P(place(capsule(0.1, 0.22, 2, 6), { p: [i * 0.72, 1.28, -l * 0.12] }), ['#d8c8a4', '#a8483c', '#3f7a8a'][(i + 3 + seed) % 3]);
  // a thermos and a kettle
  P(place(cylinder(0.14, 0.16, 0.5, 8), { p: [w * 0.34, 1.34, -l * 0.04] }), '#c04038');
  // the line of hats and scarves across the front
  P(tube([[-w / 2.1, 2.46, l / 2.2], [0, 2.26, l / 2.2], [w / 2.1, 2.46, l / 2.2]], 0.015, 4), '#2a2a2e');
  const C = ['#b8483c', '#2f5a9c', '#c9983c', '#3f7a5a', '#8a4a7a', '#d8d0c0'];
  for (let i = 0; i < 9; i++) {
    const x = -w / 2.4 + (i * w) / 10.4, y = 2.26 + Math.abs(i - 4) * 0.04;
    if (i % 3 === 2) P(place(box(0.3, 0.9, 0.05), { p: [x, y - 0.46, l / 2.2] }), C[(i + seed) % 6]);
    else { P(place(sphere(0.18, 7, 5), { p: [x, y - 0.2, l / 2.2], s: [1, 1.2, 1] }), C[(i + seed) % 6]); P(place(sphere(0.06, 5, 4), { p: [x, y + 0.02, l / 2.2] }), '#e6dfd0'); }
  }
  // bunches of edelweiss in a bucket by the post, standing on the sand
  const bx = w * 0.46, bz = l * 0.34;
  P(place(cylinder(0.24, 0.18, 0.42, 8), { p: [bx, 0.21, bz] }), '#6f7a84');
  for (let i = 0; i < 7; i++) { const a = i * 2.4, r = 0.13; P(place(sphere(0.13, 5, 4), { p: [bx + Math.cos(a) * r, 0.58 + (i % 3) * 0.06, bz + Math.sin(a) * r] }), i % 2 ? '#dcd8c4' : '#c8ceb4'); }
  // two low plastic stools on the sand
  for (const x of [-1.5, 0.2]) { P(place(cylinder(0.2, 0.17, 0.05, 8), { p: [x, 0.38, l * 0.3] }), seed % 2 ? '#b8483c' : '#3f7ab0'); P(place(cylinder(0.16, 0.2, 0.36, 8, true), { p: [x, 0.18, l * 0.3] }), seed % 2 ? '#983c32' : '#32668e'); }
  return merge(parts);
}

// A little house of Cemoro Lawang on the lip of the wall: bright plaster, a tin roof, a retaining course of stone where the ground falls away under it.
function rimHouse(seed) {
  const C = ['#b8a49c', '#98a4a8', '#a8a48c', '#c0ac8c', '#c8c2b4', '#a09aa4', '#d0cabc'][seed % 7], w = 6 + (seed % 4) * 1.5, l = 7 + (seed % 5) * 1.5, h = 3 + (seed % 3) * 1.7;
  const { walls, roof } = gable(w, l, h, 2.2, 0.5);
  return merge([paint(place(box(w + 0.4, 9, l + 0.4), { p: [0, -4.4, 0] }), '#544c50', 1), paint(walls, C, 5), paint(roof, seed % 3 ? TIN_R : TIN, 3), paint(place(box(1.2, 1.2, 0.1), { p: [w * 0.2, h * 0.5, l / 2 + 0.03] }), '#ffcf88'), paint(place(box(1.1, 2, 0.1), { p: [-w * 0.2, 1, l / 2 + 0.03] }), '#4e3324')]);
}

// The route marker of the sand sea, so a driver can read the track across the grey in the mist: a low cairn of lava with a whitewashed cap.
function marker(seed) {
  const r = (i) => hash3(i, seed, 11), parts = [];
  for (let i = 0; i < 3; i++) parts.push(paint(place(sphere(0.34 - i * 0.05, 6, 4), { p: [(r(i) - 0.5) * 0.3, 0.16 + i * 0.28, (r(i + 4) - 0.5) * 0.3], s: [1.1, 0.8, 1] }), i === 2 ? '#fff0da' : '#8e6c7c'));
  return merge(parts);
}
// Bamboo wand with a faded flag, on the outside of a bend.
function wand() {
  return merge([paint(place(cylinder(0.05, 0.07, 3.8, 5), { p: [0, 1.9, 0] }), BAMBOO), paint(quad([0, 3.7, 0], [1, 3.5, 0], [1, 2.9, 0], [0, 2.9, 0]), '#a8483c')]);
}
// A lump of dark lava with pale ash on its top.
function lava(r, seed) {
  const g = r > 1.4 ? sphere(r, 14, 10) : sphere(r, 7, 5), P = g.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i), q = 3 / r, k = 0.72 + 0.56 * hash3(Math.round(x * q), Math.round(y * q) + seed, Math.round(z * q));
    P.setXYZ(i, x * k, y * k * 0.78, z * k);
  }
  g.computeVertexNormals();
  return paint(g, '#a07c84', 0, (x, y) => lerp(0.78, 1.45, smooth(-r * 0.2, r * 0.8, y)));
}
// A tuft of the tan grass of the savanna: thin cones leaning out.
// A person of the place, small and plain, seen across the sand: legs, a body with the Tenggerese sarong slung over one shoulder or a visitor's parka, arms, a head with its cloth. Thin enough to read as a person and not a skittle.
function figure(seed) {
  const local = hash3(seed, 1, 77) < 0.6, cloth = local ? ['#7a3a3c', '#2f5a6c', '#5a6a3c', '#a8743c', '#3c3a5c'][seed % 5] : ['#3c6a96', '#b8563a', '#c8a23e', '#4c8a78', '#e0d8c8'][seed % 5], skin = '#a8704c', dark = '#2c2430';
  const parts = [];
  for (const s of [-1, 1]) {
    parts.push(paint(place(capsule(0.07, 0.62, 1, 5), { p: [s * 0.1, 0.38, 0] }), dark));
    parts.push(paint(place(capsule(0.055, 0.5, 1, 5), { p: [s * 0.25, 1.1, 0.02], r: [0, 0, s * 0.16] }), cloth));
  }
  parts.push(paint(place(capsule(0.17, 0.42, 2, 7), { p: [0, 1.12, 0], s: [1, 1, 0.75] }), cloth));
  if (local) parts.push(paint(place(capsule(0.2, 0.26, 1, 6), { p: [0, 1.02, 0], r: [0, 0, 0.5], s: [1, 1, 0.8] }), ['#c8a23e', '#b8443c', '#2f7a6a'][seed % 3]));
  parts.push(paint(place(sphere(0.135, 7, 5), { p: [0, 1.58, 0] }), skin));
  parts.push(paint(place(sphere(0.155, 7, 4), { p: [0, 1.65, -0.02], s: [1, 0.6, 1] }), local ? dark : cloth));
  return merge(parts);
}
// A heap of loose ash the jeeps have thrown up: soft, wider than high, no two alike by the way they are scaled.
function mound(seed) {
  const g = sphere(1, 9, 5), P = g.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i), k = 0.86 + 0.3 * (0.5 + 0.5 * Math.sin(x * 2.3 + seed) * Math.cos(z * 2.9 + seed * 2));
    P.setXYZ(i, x * k, Math.max(y, -0.2) * k, z * k);
  }
  g.computeVertexNormals();
  return paint(g, '#ecb498', 0, (x, y) => lerp(0.84, 1.14, smooth(-0.1, 0.8, y)));
}
// A clump of casuarina as it grows up here: a few tall thin dark crowns that droop, leaning apart, of different heights. Never one spike.
function casuarina(seed) {
  const parts = [], r = (i, q) => hash3(i, seed, q), n = 2 + (seed % 3), C = ['#55663e', '#647244', '#4a5a3c', '#70784a'];
  for (let i = 0; i < n; i++) {
    const a = r(i, 1) * 6.283, o = i ? 1.2 + 2.4 * r(i, 2) : 0, h = 7 + 8 * r(i, 3), w = h * (0.11 + 0.08 * r(i, 4)), x = Math.cos(a) * o, z = Math.sin(a) * o, lean = (r(i, 5) - 0.5) * 0.24;
    parts.push(paint(place(cylinder(0.08, 0.16, h * 0.5, 3), { p: [x, h * 0.25, z] }), '#2a2422'));
    const col = C[(seed + i) % 4], shade = (px, py) => lerp(0.72, 1.18, smooth(-1, 1, py));
    parts.push(paint(place(sphere(1, 5, 3), { p: [x, h * 0.5, z], r: [lean, a, lean * 0.6], s: [w * 1.1, h * 0.34, w * 1.1] }), col, 0, shade));
    parts.push(paint(place(sphere(1, 5, 3), { p: [x + lean * h * 0.3, h * 0.8, z], r: [lean, a * 2, 0], s: [w * 0.66, h * 0.26, w * 0.66] }), col, 0, shade));
  }
  return merge(parts);
}
// The dark scrub on the wall: one low lump, in masses.
function scrubLump(seed) {
  return paint(place(sphere(1, 5, 3), { s: [1, 0.72, 1] }), ['#5e6c40', '#54643e', '#6c7446', '#4c5a3c'][seed % 4], 0, (x, y) => lerp(0.76, 1.2, smooth(-0.6, 0.6, y)));
}
// The top of Bromo over the ground's cone: the torn lip, pale where the ash lies dry on its edge, and the dark inside going down into the throat. Only this draws the crater sharp at any distance, the ground's grid being coarse.
function crown(groundAt) {
  const N = 150, pos = [], col = [], idx = [], c = (h) => new THREE.Color(h);
  const flank = c('#c79a9c'), flankD = c('#957a98'), pale = c('#f4d6c0'), paleD = c('#d6aca6'), wall0 = c('#6c5478'), wall1 = c('#54446c'), sulph = c('#8e7a60'), floor = c('#3a2e4c');
  const tmp = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 - Math.PI, R = rimR(a), Y = rimY(a), tear = (hash3(i, 1, 91) - 0.5) * 1.5 + (hash3(i >> 1, 2, 91) - 0.5) * 1.6 + (hash3(i >> 3, 3, 91) - 0.5) * 1.4, g = hash3(i, 4, 91), cx = Math.cos(a), sz = Math.sin(a);
    // the crest is bitten in, so the torn edge is what the eye finds; and the grooves run from it down the flank
    const rows = [[17, null, flank, flankD], [9, null, flank, flankD], [3.4, Y - 2.2 + tear * 0.4, flank, flankD], [1.6, Y - 0.8 + tear * 0.7, pale, flank], [0.5 + (hash3(i, 5, 91) - 0.5) * 2, Y + tear, pale, paleD], [-2.4, Y + tear * 0.5 - 1.3, paleD, wall0], [-9, Y - 8 + tear, wall0, wall1], [-24, Y - 17, wall1, sulph], [-52, Y - 27, floor, floor]];
    for (const [dr, y0, c0, c1] of rows) {
      const r = R + dr, x = SHOULDER.x + cx * r, z = SHOULDER.z + sz * r, G = groundAt(x, z) + 0.3;
      pos.push(x, y0 === null ? G : Math.max(G, y0), z);
      tmp.copy(c0).lerp(c1, g * g); col.push(tmp.r, tmp.g, tmp.b);
    }
  }
  const M = 9;
  for (let i = 0; i < N; i++) for (let k = 0; k < M - 1; k++) { const a0 = i * M + k, a1 = ((i + 1) % N) * M + k; idx.push(a0, a0 + 1, a1, a1, a0 + 1, a1 + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  let up = 0; const NN = g.attributes.normal; for (let i = 0; i < NN.count; i++) up += NN.getY(i);
  if (up < 0) { const I = g.index.array; for (let i = 0; i < I.length; i += 3) { const t = I[i + 1]; I[i + 1] = I[i + 2]; I[i + 2] = t; } g.computeVertexNormals(); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aPaint', new THREE.BufferAttribute(new Float32Array(pos.length / 3), 1));
  return g;
}
function tuft(seed) {
  const parts = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * 6.28 + seed, h = 0.34 + 0.4 * hash3(i, seed * 7, 3), r = 0.1 + 0.16 * hash3(i, seed * 5, 4);
    parts.push(paint(place(cone(0.045, h, 3), { p: [Math.sin(a) * r, h / 2, Math.cos(a) * r], r: [Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5] }), ['#7a6f58', '#6e644e', '#84795e', '#65604a'][(i + seed) % 4], 0, (x, y) => lerp(0.62, 1.05, smooth(0, h, y + h / 2))));
  }
  return merge(parts);
}

// Soft sprites, one draw call: Bromo's smoke and Semeru's puff, moving a little over the painted ones, and the dust the far jeeps raise. Depth test on, no depth write, so the ink pass and the world's edges are never touched.
function softSprites(count, stream = false, sun = null) {
  const quadGeo = new THREE.PlaneGeometry(1, 1), g = new THREE.InstancedBufferGeometry();
  g.index = quadGeo.index; g.setAttribute('position', quadGeo.attributes.position); g.setAttribute('uv', quadGeo.attributes.uv); g.instanceCount = count;
  const pos = new Float32Array(count * 4), col = new Float32Array(count * 4), size = new Float32Array(count * 2);
  g.setAttribute('iPos', new THREE.InstancedBufferAttribute(pos, 4).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('iCol', new THREE.InstancedBufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('iSize', new THREE.InstancedBufferAttribute(size, 2).setUsage(THREE.DynamicDrawUsage));
  const noise = /* glsl */`
    float h12(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vn(vec2 p){ vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f); return mix(mix(h12(i), h12(i + vec2(1.0, 0.0)), u.x), mix(h12(i + vec2(0.0, 1.0)), h12(i + vec2(1.0, 1.0)), u.x), u.y); }
    float fbm(vec2 p){ return vn(p) * 0.55 + vn(p * 2.1 + 3.0) * 0.28 + vn(p * 4.3 + 7.0) * 0.17; }`;
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { uSun: { value: sun ?? new THREE.Vector3(0, 0.2, 1) }, uShade: { value: new THREE.Color('#9c90a8') } },
    vertexShader: /* glsl */`
      uniform vec3 uSun; attribute vec4 iPos, iCol; attribute vec2 iSize; varying vec2 vU, vS; varying vec4 vC; varying float vZ;
      void main(){ vU = uv; vC = iCol; vec4 mv = viewMatrix * vec4(iPos.xyz, 1.0); vZ = -mv.z; vS = normalize((viewMatrix * vec4(uSun, 0.0)).xy + vec2(0.0, 0.5));
        float c = cos(iPos.w), s = sin(iPos.w); vec2 q = position.xy * iSize; mv.xy += vec2(c * q.x - s * q.y, s * q.x + c * q.y);
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: stream ? /* glsl */`
      varying vec2 vU, vS; varying vec4 vC; varying float vZ; ${noise}
      void main(){
        // a sheet of mist: long soft streams, no edge of its own anywhere; vC.a holds a seed in its integer part and the density in its fraction
        float sd = floor(vC.a); vec2 q = vec2(vU.x * 4.0 + sd * 0.37, vU.y * 2.6 + sd * 0.91);
        float n = fbm(q + vec2(fbm(q * 0.7) * 0.8, 0.0));
        float env = smoothstep(0.0, 0.3, vU.x) * smoothstep(1.0, 0.7, vU.x) * smoothstep(0.0, 0.35, vU.y) * smoothstep(1.0, 0.45, vU.y);
        // and it stays out there: a sheet driven through would wash the whole frame to one flat grey
        float a = smoothstep(0.34, 0.72, n) * env * fract(vC.a) * smoothstep(140.0, 380.0, vZ);
        if (a < 0.004) discard;
        gl_FragColor = vec4(vC.rgb, a);
        #include <colorspace_fragment>
      }` : /* glsl */`
      varying vec2 vU, vS; varying vec4 vC; varying float vZ; uniform vec3 uShade; ${noise}
      void main(){ vec2 d = (vU - 0.5) * 2.0; float r = length(d), sd = floor(vC.a);
        // steam: no edge of its own, eaten away by its own noise, lit on the side of the low sun and mauve in its shade; it thins out when you stand in it
        float n = fbm(vU * 2.6 + sd * 0.73), n2 = fbm(vU * 6.0 + sd * 1.9);
        float alpha = smoothstep(1.0, 0.18, r + (n - 0.5) * 0.95) * smoothstep(0.2, 0.62, n * 0.7 + n2 * 0.3 + 0.22) * fract(vC.a) * smoothstep(30.0, 110.0, vZ);
        if (alpha < 0.004) discard;
        float lit = clamp(0.5 + dot(d, vS) * 0.62 + (n2 - 0.5) * 0.5, 0.0, 1.0);
        gl_FragColor = vec4(mix(uShade, vC.rgb, lit), alpha);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false; mesh.renderOrder = 4;
  return { mesh, pos, col, size, attrs: g.attributes };
}

// Tracks on the plain: what sells its size. Jeep trails fan out from the park and the temple and fade into the distance, wind has combed the sand in long drifts, dry grass lies in patches as in the photos.
function paintGround(track, rect) {
  const SIZE = 4096, canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  let c = canvas.getContext('2d'); const main = c, [x0, z0, x1, z1] = rect, sx = SIZE / (x1 - x0), sz = SIZE / (z1 - z0);
  // a blurred layer is drawn sharp on a smaller canvas and laid down once: a filter on every shape costs seconds
  const layer = (px, draw) => { const k = 4, o = document.createElement('canvas'); o.width = o.height = SIZE / k; const q = o.getContext('2d'); q.scale(1 / k, 1 / k); c = q; draw(); c = main; main.filter = `blur(${px}px)`; main.drawImage(o, 0, 0, SIZE, SIZE); main.filter = 'none'; };
  const X = (x) => (x - x0) * sx, Z = (z) => (z - z0) * sz;
  c.clearRect(0, 0, SIZE, SIZE);
  // A few big soft masses, lying across the wind like the repaint's own floor: long violet shadows, drifts of gold where the first light rests, rose between them. Nothing small, nothing dark.
  const mass = (i, seed, size, tone) => { const x = lerp(x0, x1, hash3(i, 1, seed)), z = lerp(z0, z1, hash3(i, 2, seed)), w = size * (0.55 + hash3(i, 3, seed)); c.fillStyle = tone; c.beginPath(); c.ellipse(X(x), Z(z), w * sx, w * 0.24 * sz, 0.6 + 0.3 * hash3(i, 4, seed), 0, 6.283); c.fill(); };
  layer(46, () => { for (let i = 0; i < 74; i++) mass(i, 51, 230, 'rgba(255,214,140,0.5)'); });
  layer(46, () => { for (let i = 0; i < 60; i++) mass(i, 52, 200, 'rgba(250,150,150,0.36)'); });
  layer(38, () => { for (let i = 0; i < 90; i++) mass(i, 53, 170, 'rgba(150,108,186,0.5)'); });
  // dry grass, between the shoulder and the walls, as the sand gives way to the savanna
  layer(28, () => { for (let i = 0; i < 44; i++) {
    const a = hash3(i, 6, 51) * 6.283, r = 40 + 170 * Math.sqrt(hash3(i, 7, 51)), x = -70 + Math.sin(a) * r * 1.2, z = 290 + Math.cos(a) * r * 0.7, w = 12 + 34 * hash3(i, 8, 51);
    c.fillStyle = 'rgba(212,186,112,0.34)';
    c.beginPath(); c.ellipse(X(x), Z(z), w * sx, w * 0.5 * sz, a, 0, 6.283); c.fill();
  } });
  // nothing on Bromo's flank: drawn from above, it would run down the slope in streaks
  c.globalCompositeOperation = 'destination-out';
  const fg = c.createRadialGradient(X(SHOULDER.x), Z(SHOULDER.z), (SHOULDER.r - 24) * sx, X(SHOULDER.x), Z(SHOULDER.z), (SHOULDER.r + 16) * sx);
  fg.addColorStop(0, 'rgba(0,0,0,1)'); fg.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = fg; c.beginPath(); c.arc(X(SHOULDER.x), Z(SHOULDER.z), (SHOULDER.r + 16) * sx, 0, 6.283); c.fill();
  c.globalCompositeOperation = 'source-over';
  return canvas;
}

export function plan({ track, terrain, world }) {
  const P = (u) => track.pointAt(u);
  world.buildings = [];
  const place2 = (kind, u, d, opts = {}) => {
    const p = P(u), x = p.x + p.nx * d + p.tx * (opts.along || 0), z = p.z + p.nz * d + p.tz * (opts.along || 0);
    const yaw = Math.atan2(-p.nx * Math.sign(d), -p.nz * Math.sign(d)) + (opts.turn || 0);
    world.buildings.push({ kind, x, z, yaw, u, d, ...opts });
    world.keepOut.push({ x, z, r: opts.r ?? 8 });
  };
  // The temple: on the right of the leg up to the shoulder, its long wall toward the road and the great gate facing it. Well clear of the road.
  place2('temple', 0.24, -72, { r: 58, turn: 0.1, L: 96, D: 40 });
  // the warungs of the jeep park, in a loose straggling line and not in step
  for (const [u, d, s, along, turn] of [[0.962, 21, 0, 0, 0.2], [0.976, -19, 1, 3, -0.15], [0.993, 25, 2, -2, 0.3], [0.012, -23, 3, 0, 0.1], [0.038, 22, 4, 4, -0.25], [0.056, -28, 5, 0, 0.35]]) place2('warung', u, d, { seed: s, r: 7, along, turn });
  // the floor is open, and the planted forest stays out of it: the casuarina is the landmark's own
  world.groves.push({ x: 0, z: 0, r: 2600, cover: -1.6 });
  // vegetable plots on the slope just under the lip, below Cemoro Lawang
  world.terraceAt = (x, z) => {
    const ex = (x - WALL.x) / WALL.rx, ez = (z - WALL.z) / WALL.rz, rho = wallRho(x, z), deg = (Math.atan2(ex, -ez) / D2R + 360) % 360;
    return smooth(0.955, 0.98, rho) * smooth(1.11, 1.03, rho) * smooth(96, 106, deg) * smooth(172, 160, deg);
  };
  const rect = [-1250, -650, 750, 1350];
  if (typeof document !== 'undefined') world.groundPaint = { canvas: paintGround(track, rect), rect };
}

export function build({ track, terrain, batch: B, mat, world }) {
  const groundAt = world.ground.groundAt, P = (u) => track.pointAt(((u % 1) + 1) % 1);
  const atRoad = (u, d, along = 0) => { const p = P(u), x = p.x + p.nx * d + p.tx * along, z = p.z + p.nz * d + p.tz * along; return { x, z, y: groundAt(x, z), yaw: Math.atan2(p.tx, p.tz), p }; };

  for (const b of world.buildings) {
    if (b.kind === 'temple') {
      const y = groundAt(b.x, b.z), g = temple(b.L, b.D);
      place(g, { p: [b.x, y, b.z], r: [0, b.yaw, 0] }); B.add(g); B.blob(b.x, b.z, 46, 0.34);
    } else if (b.kind === 'warung') {
      const g = warung(b.seed); place(g, { p: [b.x, groundAt(b.x, b.z), b.z], r: [0, b.yaw, 0] }); B.add(g); B.blob(b.x, b.z, 6, 0.55);
    }
  }

  // Hardtops scattered at dawn, as drivers leave them: in loose knots at all angles, some nosed together, some alone far out on the sand with their trail behind them. Faded colours, as the sun leaves them up here.
  const BODY = ['#b8563a', '#3f7a5a', '#c9743e', '#3c6a96', '#b8a67e', '#a0403a', '#4c8a78', '#c89a44', '#e0d8c8', '#567090'];
  const dust = [];
  let jn = 0;
  const jeep = (x, z, yaw) => {
    if (terrain.roadDistAt(x, z) < 6) return;
    const g = hardtop(BODY[jn % BODY.length], jn); jn++;
    place(g, { p: [x, groundAt(x, z) + 0.02, z], r: [0, yaw, 0] }); B.add(g); B.blob(x, z, 3.8, 0.72);
  };
  for (const [u, d, n, spread, seed] of [[0.955, 34, 5, 16, 1], [0.0, 42, 4, 22, 2], [0.02, -40, 6, 18, 3], [0.075, 36, 3, 14, 4], [0.1, -48, 4, 26, 5], [0.205, -36, 3, 10, 6], [0.16, 60, 2, 18, 7], [0.92, -46, 3, 20, 8]]) {
    const c0 = atRoad(u, d), base = hash3(seed, 1, 7) * 6.283;
    for (let i = 0; i < n; i++) jeep(c0.x + (hash3(i, seed, 1) - 0.5) * spread * 2.2, c0.z + (hash3(i, seed, 2) - 0.5) * spread * 1.4, base + (hash3(i, seed, 3) - 0.5) * 2.6);
  }
  // The ranks: at dawn they stand in long files nose to tail out on the sand, what every picture from the rim shows. Two files in view of the road, slightly out of true.
  for (const [u, d0, count, seed] of [[0.165, 34, 9, 21], [0.075, -42, 8, 22], [0.68, 44, 6, 23]]) {
    const c0 = atRoad(u, d0), dir = Math.atan2(c0.p.tx, c0.p.tz) + (hash3(seed, 1, 9) - 0.5) * 0.3, dx = Math.sin(dir), dz = Math.cos(dir);
    for (let i = 0; i < count; i++) { const k = (i - count / 2) * 6.4, o = (hash3(i, seed, 9) - 0.5) * 1.6; jeep(c0.x + dx * k + dz * o, c0.z + dz * k - dx * o, dir + (hash3(i, seed, 10) - 0.5) * 0.14); }
  }
  // alone, far out, a plume of dust behind each: these are what make the plain as big as it is
  for (const [u, d, a] of [[0.03, 170, 2.3], [0.07, 260, 3.4], [0.12, 210, 4.2], [0.2, -240, 5.2], [0.0, -200, 2.0], [0.6, 150, 1.1], [0.72, 190, 0.2], [0.46, -170, 4.4]]) {
    const c0 = atRoad(u, d);
    jeep(c0.x, c0.z, a);
    dust.push([c0.x - Math.sin(a) * 9, c0.y + 2.4, c0.z - Math.cos(a) * 9, a]);
  }

  // Route markers where the track meets the plain, irregular and not in step; flags on the outside of each real bend.
  const markers = [marker(1), marker(2), marker(3)], wandG = wand(), n = track.n, kk = track.curvature;
  for (let i = 0, c = 0; i < n; i += 15, c++) {
    const u = i / n, p = P(u), hw = p.w / 2;
    if (u > 0.992 || u < 0.008) continue;
    const s = hash3(c, 1, 19) < 0.5 ? -1 : 1, a = atRoad(u, s * (hw + 3.5 + 2.5 * hash3(c, 2, 19)), 4 * hash3(c, 3, 19)), g = markers[c % 3].clone();
    place(g, { p: [a.x, a.y - 0.04, a.z], s: 0.9 + 0.7 * hash3(c, 4, 19) }); B.add(g); B.blob(a.x, a.z, 0.9, 0.5);
    if (Math.abs(kk[i]) > 0.012 && c % 2 === 0) {
      const so = kk[i] > 0 ? -1 : 1, w = atRoad(u, so * (hw + 5.5)), wg = wandG.clone();
      place(wg, { p: [w.x, w.y, w.z], r: [0, w.yaw + Math.PI / 2, 0] }); B.add(wg);
    }
  }

  // The stair of Bromo: a railed concrete flight running straight up its own gully to a platform at the top. On the east face, so it is seen square from the long straight. The ponies wait on the flat at its foot.
  {
    const zc = STAIR.z, N = 62, parts = [], railL = [], railR = [], hw = 2.6, X = (t) => lerp(STAIR.x0, STAIR.x1, t);
    for (let i = 0; i <= N; i++) {
      const t = i / N, x = X(t), y = Math.max(groundAt(x, zc), bromoCone(x, zc) + 0.3), dx = (STAIR.x1 - STAIR.x0) / N;
      // a step: a tread and a shadowed riser, so the flight reads as steps and not as a white ladder lying on the ground
      parts.push(place(paint(box(Math.abs(dx) * 1.05, 0.34, hw * 2), i % 12 === 0 ? '#a29c94' : '#d0c8ba', 0, (Xq, Y) => (Y > 0 ? 1.03 : 0.66)), { p: [x, y + 0.05, zc] }));
      railL.push([x, y + 1.25, zc + hw]); railR.push([x, y + 1.25, zc - hw]);
      if (i % 6 === 0) for (const s of [-1, 1]) parts.push(place(paint(cylinder(0.08, 0.08, 1.25, 5), '#59606a'), { p: [x, y + 0.62, zc + s * hw] }));
    }
    parts.push(paint(tube(railL, 0.08, 4), '#59606a'), paint(tube(railR, 0.08, 4), '#59606a'));
    B.add(merge(parts));
    // it ends on the lip itself, at a small railed landing
    const xt = STAIR.x1, y = rimY(Math.atan2(zc - SHOULDER.z, xt - SHOULDER.x)) + 0.6;
    B.add(place(merge([paint(place(box(7, 0.6, 7.4), { p: [0, 0, 0] }), '#c0b8aa'), paint(place(cylinder(0.08, 0.08, 1.3, 5), { p: [-3.4, 0.9, 3.5] }), '#59606a'), paint(place(cylinder(0.08, 0.08, 1.3, 5), { p: [-3.4, 0.9, -3.5] }), '#59606a'), paint(tube([[-3.4, 1.5, 3.5], [-3.4, 1.5, -3.5]], 0.07, 4), '#59606a')]), { p: [xt - 1.5, y, zc] }));
    // the ponies, on the sand by the foot, with their grooms' cloths on
    const cloths = ['#2f5a9c', '#2f7a6a', '#a8443c', '#2f5a9c'], coats = ['#b0946c', '#6d503c', '#d8cdb8', '#8f6c4a'];
    for (const [i, x, z, turn] of [[0, -408, 196, 0.6], [1, -402, 188, 2.1], [2, -394, 204, 4.0], [3, -386, 192, 1.2]]) {
      if (terrain.roadDistAt(x, z) < 4) continue;
      const g = ponyGeometry(false, coats[i], cloths[i]);
      place(g, { p: [x, groundAt(x, z), z], r: [0, turn, 0], s: 0.95 }); B.add(g); B.blob(x, z, 2.6, 0.6);
    }
  }
  for (const [u, d, turn, c] of [[0.1, 22, 0.8, 1], [0.12, 26, -1.4, 2], [0.16, -24, 0.6, 3]]) {
    const a = atRoad(u, d), g = ponyGeometry(false, ['#b0946c', '#6d503c', '#d8cdb8', '#8f6c4a'][c], ['#2f5a9c', '#2f7a6a', '#a8443c'][c % 3]);
    place(g, { p: [a.x, a.y, a.z], r: [0, a.yaw + turn, 0], s: 0.95 }); B.add(g); B.blob(a.x, a.z, 2.6, 0.6);
  }

  // The lava outcrop inside the bulge, and the two lines of boulders that make the shortcut's gap.
  const rock = (x, z, r, seed) => { const g = lava(r, seed), y = groundAt(x, z); place(g, { p: [x, y + r * 0.22, z], r: [0, seed, 0] }); B.add(g); B.blob(x, z, r * 1.6, 0.72); };
  const mid = [-470 * 0.7, 452 * 0.7];
  for (let i = 0; i < 30; i++) {
    const a = hash3(i, 1, 13) * 6.28, r = 62 * Math.sqrt(hash3(i, 2, 13)), x = mid[0] + Math.sin(a) * r * 1.5, z = mid[1] + Math.cos(a) * r * 0.5;
    if (terrain.roadDistAt(x, z) > 2.5) rock(x, z, 1.8 + 3.6 * hash3(i, 3, 13) ** 2, i);
  }
  const sc = track.shortcuts[0];
  if (sc) for (let i = 8; i < sc.n - 6; i += 7) {
    const p = sc.pointAt(i / sc.n), s = i % 2 ? 1 : -1, hw = sc.samples.w[p.i] / 2 + 2.4 + 1.4 * hash3(i, 5, 13);
    rock(p.x + p.nx * s * hw, p.z + p.nz * s * hw, 1.1 + 1.9 * hash3(i, 6, 13), i + 40);
    if (i % 3 === 0) rock(p.x - p.nx * s * hw, p.z - p.nz * s * hw, 1 + 1.2 * hash3(i, 7, 13), i + 80);
  }
  // Volcanic stones thrown over the whole floor, thicker round Bromo, small and in drifts: the plain is never a blank sheet at the road's edge.
  const stones = [lava(0.32, 1), lava(0.5, 2), lava(0.8, 3), lava(1.2, 4)];
  for (let i = 0; i < 200; i++) {
    const u = hash3(i, 1, 31), d = (hash3(i, 2, 31) < 0.5 ? -1 : 1) * (9 + 150 * hash3(i, 3, 31) ** 1.5), a = atRoad(u, d, (hash3(i, 4, 31) - 0.5) * 12);
    if (terrain.roadDistAt(a.x, a.z) < 2.2 || Math.sin(a.x * 0.021 + 1.1) + Math.cos(a.z * 0.027) + 0.6 * Math.sin((a.x - a.z) * 0.05) < -0.7) continue;
    const q = Math.min(3, Math.floor(hash3(i, 5, 31) ** 2.4 * 4)), g = stones[q].clone();
    place(g, { p: [a.x, a.y + 0.03, a.z], r: [0, i, 0], s: 0.7 + 0.8 * hash3(i, 6, 31) }); B.add(g);
    B.blob(a.x, a.z, 0.5 + q * 0.55, 0.6);
  }

  // Loose ash the wheels have thrown up, in drifts along the road and thinning out from it.
  const mounds = [mound(1), mound(2), mound(3)];
  for (let i = 0; i < 60; i++) {
    const u = hash3(i, 1, 37), p0 = P(u), side = hash3(i, 2, 37) < 0.5 ? -1 : 1, d = side * (p0.w / 2 + 1.5 + 34 * hash3(i, 3, 37) ** 2), a = atRoad(u, d);
    if (terrain.roadDistAt(a.x, a.z) < 1.2 || a.y > 14 || Math.sin(a.x * 0.017 + 0.4) + Math.cos(a.z * 0.023 + 1.9) < -0.5) continue;
    const w = 0.7 + 1.5 * hash3(i, 4, 37) ** 1.6, g = mounds[i % 3].clone();
    place(g, { p: [a.x, a.y - 0.03, a.z], r: [0, i * 1.3, 0], s: [w, 0.14 + 0.16 * w * hash3(i, 5, 37), w * (0.6 + 0.5 * hash3(i, 6, 37))] }); B.add(g); B.blob(a.x, a.z, w * 1.2, 0.5);
  }

  // People going about their dawn: a file climbing the stair, knots of them out on the sand toward the temple, grooms with their ponies.
  const folk = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(figure);
  const stand = (x, z, seed, k = 1) => { if (terrain.roadDistAt(x, z) < 3) return; const g = folk[seed % 10].clone(); place(g, { p: [x, groundAt(x, z) - 0.04, z], r: [0, seed * 1.7, 0], s: k }); B.add(g); B.blob(x, z, 0.8, 0.45); };
  for (let i = 0; i < 26; i++) { const t = (i + hash3(i, 1, 81) * 0.7) / 26, x = lerp(STAIR.x0 + 4, STAIR.x1 + 6, t); const q = folk[i % 10].clone(); place(q, { p: [x, Math.max(groundAt(x, STAIR.z), bromoCone(x, STAIR.z) + 0.3) + 0.12, STAIR.z + (hash3(i, 2, 81) - 0.5) * 3.2], r: [0, -Math.PI / 2, 0] }); B.add(q); }
  for (let i = 0; i < 18; i++) { const t = i / 18, x = lerp(STAIR.x0 + 8, STAIR.x0 + 74, t) + (hash3(i, 3, 81) - 0.5) * 7, z = STAIR.z + (hash3(i, 4, 81) - 0.5) * 12 + 4 * Math.sin(t * 6); stand(x, z, i + 3); }
  for (const [u, d, n, seed] of [[0.21, -40, 7, 31], [0.26, -38, 6, 32], [0.14, 24, 3, 33], [0.03, 18, 4, 34], [0.97, -16, 3, 35]]) {
    const c0 = atRoad(u, d);
    for (let i = 0; i < n; i++) stand(c0.x + (hash3(i, seed, 1) - 0.5) * 12, c0.z + (hash3(i, seed, 2) - 0.5) * 12, seed + i);
  }
  // riders crossing the sand, and grooms waiting by the road with theirs
  for (const [u, d, turn, c] of [[0.09, 30, 1.2, 0], [0.095, 36, 1.1, 1], [0.1, 41, 1.3, 2], [0.31, 16, 0.4, 3], [0.62, -22, 2.2, 1], [0.8, 20, -0.8, 0], [0.9, -24, 1.9, 2]]) {
    const a = atRoad(u, d), g = ponyGeometry(u > 0.09 && u < 0.11, ['#b0946c', '#6d503c', '#d8cdb8', '#8f6c4a'][c], ['#2f5a9c', '#2f7a6a', '#a8443c', '#c8a23e'][c]);
    place(g, { p: [a.x, a.y, a.z], r: [0, a.yaw + turn, 0], s: 0.95 }); B.add(g); B.blob(a.x, a.z, 2.6, 0.6);
    if (!(u > 0.09 && u < 0.11)) stand(a.x + 1.6, a.z + 0.8, c + 11);
  }

  // Tan grass: the savanna leg and the patches the jeeps have not worn off, in drifts.
  const tufts = [tuft(0), tuft(1), tuft(2)];
  for (let i = 0; i < 330; i++) {
    const u = 0.68 + 0.17 * hash3(i, 1, 17), d = (hash3(i, 2, 17) - 0.5) * 2 * (15 + 110 * hash3(i, 3, 17) ** 1.6), p = P(u), hw = p.w / 2;
    if (Math.abs(d) < hw + 3) continue;
    const x = p.x + p.nx * d, z = p.z + p.nz * d;
    if (Math.sin(x * 0.03 + 1.4) + Math.cos(z * 0.04) + Math.sin((x + z) * 0.013) < -0.3) continue;
    const g = tufts[i % 3].clone(); place(g, { p: [x, groundAt(x, z) - 0.05, z], r: [0, i, 0], s: 0.6 + 0.6 * hash3(i, 4, 17) }); B.add(g);
  }
  for (let i = 0; i < 160; i++) {
    const u = hash3(i, 5, 17), d = (hash3(i, 6, 17) < 0.5 ? -1 : 1) * (9 + 40 * hash3(i, 7, 17)), a = atRoad(u, d);
    if (terrain.roadDistAt(a.x, a.z) < 3) continue;
    const g = tufts[i % 3].clone(); place(g, { p: [a.x, a.y - 0.05, a.z], r: [0, i, 0], s: 0.55 + 0.6 * hash3(i, 8, 17) }); B.add(g);
  }

  // How far out the wall tops out, by the angle round it: walking out along each bearing to where the ground stops climbing fast.
  const lipAt = (deg) => {
    const r = deg * D2R, sx = Math.sin(r) * WALL.rx, sz = -Math.cos(r) * WALL.rz;
    let rho = 0.8, y0 = groundAt(WALL.x + sx * rho, WALL.z + sz * rho);
    for (; rho < 1.35; rho += 0.012) { const y1 = groundAt(WALL.x + sx * (rho + 0.012), WALL.z + sz * (rho + 0.012)); if (y1 - y0 < 0.6 && y0 > 60) break; y0 = y1; }
    return { rho, sx, sz };
  };
  const casu = [0, 1, 2, 3, 4, 5, 6, 7].map(casuarina);
  const tree = (x, z, seed, k = 1) => { const g = casu[seed % 8].clone(), q = k * (0.8 + 0.7 * hash3(seed, 8, 3)); place(g, { p: [x, groundAt(x, z) - 0.3, z], r: [0, seed * 2.1, 0], s: [q, q * (0.85 + 0.4 * hash3(seed, 9, 3)), q] }); B.add(g); };

  // Cemoro Lawang: not a row but knots of houses of every size stepping down and back along the lip, thick here and thin there, with trees among them, over the vegetable plots.
  for (const [dc, n, seed] of [[106, 7, 1], [113, 11, 2], [121, 9, 3], [128, 15, 4], [134, 12, 5], [143, 9, 6], [150, 13, 7], [160, 7, 8], [168, 5, 9]]) {
    for (let i = 0; i < n; i++) {
      const deg = dc + (hash3(i, seed, 1) + hash3(i, seed, 7) - 1) * 4.2, L = lipAt(deg), k = L.rho + (hash3(i, seed, 2) ** 1.4) * 0.07 - 0.012, xx = WALL.x + L.sx * k, zz = WALL.z + L.sz * k, g = rimHouse(seed * 5 + i * 3);
      place(g, { p: [xx, groundAt(xx, zz) - 0.2, zz], r: [0, Math.atan2(L.sx, L.sz) + (hash3(i, seed, 6) - 0.5) * 1.1, 0], s: 1.5 + 0.7 * hash3(i, seed, 8) }); B.add(g);
    }
    for (let i = 0; i < 4; i++) { const L = lipAt(dc + (hash3(i, seed, 11) - 0.5) * 9), k = L.rho + 0.02 + 0.05 * hash3(i, seed, 12); tree(WALL.x + L.sx * k, WALL.z + L.sz * k, i + seed * 3, 1.3); }
  }
  // The wall is dark with growth: casuarina along the crest in straggling lines, and scrub in masses down the gullies, thickest low on the wall.
  for (let i = 0; i < 190; i++) {
    const deg = WALL.from + 8 + (WALL.to - WALL.from - 16) * hash3(i, 1, 47);
    if (Math.sin(deg * 0.31) + Math.sin(deg * 0.83 + 2) < -0.9) continue;
    const L = lipAt(deg), k = L.rho - 0.012 + 0.06 * hash3(i, 2, 47);
    tree(WALL.x + L.sx * k, WALL.z + L.sz * k, i, 1.1 + 0.6 * hash3(i, 3, 47));
  }
  const lumps = [0, 1, 2, 3].map(scrubLump);
  for (let m = 0; m < 130; m++) {
    const dc = WALL.from + 6 + (WALL.to - WALL.from - 12) * hash3(m, 1, 53), L0 = lipAt(dc), kc = L0.rho - 0.02 - 0.15 * hash3(m, 2, 53) ** 0.8, n = 5 + Math.floor(11 * hash3(m, 3, 53));
    for (let i = 0; i < n; i++) {
      const deg = dc + (hash3(i, m, 4) - 0.5) * 3.4, r = deg * D2R, k = kc + (hash3(i, m, 5) - 0.5) * 0.05, x = WALL.x + Math.sin(r) * WALL.rx * k, z = WALL.z - Math.cos(r) * WALL.rz * k, y = groundAt(x, z);
      if (y < 7) continue;
      const q = 4 + 8 * hash3(i, m, 6), g = lumps[(m + i) % 4].clone();
      place(g, { p: [x, y - q * 0.2, z], r: [0, i, 0], s: [q, q * (0.6 + 0.5 * hash3(i, m, 7)), q] }); B.add(g);
    }
  }
  // the temple yard, the savanna, and the foot of the wall: clumps with room between them
  const tb = world.buildings[0];
  for (let i = 0; i < 7; i++) { const a = hash3(i, 2, 5) * 6.28, r = 8 + 10 * hash3(i, 3, 5); tree(tb.x + Math.sin(a) * r * 2.2, tb.z + Math.cos(a) * r * 0.8, i + 40, 0.9); }
  for (let i = 0; i < 44; i++) {
    const u = 0.68 + 0.25 * hash3(i, 1, 57), side = hash3(i, 2, 57) < 0.5 ? -1 : 1, a = atRoad(u, side * (22 + 130 * hash3(i, 3, 57) ** 1.3));
    if (terrain.roadDistAt(a.x, a.z) < 14 || Math.sin(a.x * 0.019) + Math.cos(a.z * 0.016 + 1) < -0.2) continue;
    tree(a.x, a.z, i + 60, 0.9); B.blob(a.x, a.z, 4.5, 0.5);
  }

  // The top of the road's cone, in its own draw call.
  const sun = new THREE.Vector3(Math.sin(world.look.sun.azimuth * D2R) * Math.cos(world.look.sun.elevation * D2R), Math.sin(world.look.sun.elevation * D2R), -Math.cos(world.look.sun.azimuth * D2R) * Math.cos(world.look.sun.elevation * D2R));
  B.add(crown(groundAt));

  // The start gate: two bamboo towers bound with palm thatch and a plain banner, nothing that names the place.
  {
    const a = atRoad(0, 0), wd = a.p.w / 2 + 3, nx = a.p.nx, nz = a.p.nz, parts = [];
    for (const s of [-1, 1]) {
      for (const q of [-0.45, 0, 0.45]) parts.push(place(paint(cylinder(0.18, 0.22, 9, 6), BAMBOO), { p: [a.x + nx * (wd + q) * s, a.y + 4.5, a.z + nz * (wd + q) * s] }));
      parts.push(place(paint(cone(1.5, 1.9, 7), IJUK, 3), { p: [a.x + nx * wd * s, a.y + 10, a.z + nz * wd * s] }));
    }
    parts.push(place(paint(box(wd * 2, 1.6, 0.2), '#a8483c'), { p: [a.x, a.y + 7.8, a.z], r: [0, a.yaw, 0] }));
    for (let i = -6; i <= 6; i++) parts.push(place(paint(box(1.1, 0.5, 0.26), i % 2 ? '#e6dfd0' : '#2c2a34'), { p: [a.x + nx * i * 1.3, a.y + 7.8, a.z + nz * i * 1.3], r: [0, a.yaw, 0] }));
    B.add(merge(parts));
    B.blob(a.x + nx * wd, a.z + nz * wd, 1.8, 0.5); B.blob(a.x - nx * wd, a.z - nz * wd, 1.8, 0.5);
  }

  // The moving things, and the mist on the floor. Bearings are true: the game's azimuth is the bearing less north.
  const ND = dust.length * 3, spr = softSprites(ND, false, sun);
  const c = (h) => new THREE.Color(h);
  // the plumes are the painting's: only the dust is live. smokeLit and smokeLow stay for the sky's grade, which walks these three
  world.bromoSprites = { spr, ND, smokeLit: c('#fff0e0'), smokeLow: c('#f6dcd0'), dustC: c('#ecc4ac'), dust };
  world.staticGroup.add(spr.mesh);
  fillSprites(world.bromoSprites, 0);
  // The mist: sheets lying on the floor in soft streams, standing around the feet of the walls and the shoulder, each drifting slowly. They never make a band with a top edge.
  const NM = 32, ms = softSprites(NM, true), tone = c('#f2c8b4'), warm = c('#f8d8b8');
  for (let i = 0; i < NM; i++) {
    // on the open floor, short of the walls and the shoulder: a sheet that stands into a slope ends in a hard line
    let a = 0, r = 0, x = 0, z = 0;
    for (let q = 0; q < 24; q++) {
      a = hash3(i, 1 + q * 7, 23) * 6.283; r = 300 + 760 * hash3(i, 2 + q * 7, 23); x = -280 + Math.sin(a) * r; z = 160 + Math.cos(a) * r * 0.85;
      if (Math.hypot((x - WALL.x) / WALL.rx, (z - WALL.z) / WALL.rz) < 0.74 || Math.atan2(x - WALL.x, -(z - WALL.z)) < 0 && z < 0) { if (Math.hypot(x - SHOULDER.x, z - SHOULDER.z) > SHOULDER.r + 90) break; }
    }
    // and the last ten pool round the foot of the shoulder
    if (i >= 22) { const fb = SHOULDER, fr = SHOULDER.r + 14, fa = hash3(i, 7, 23) * 6.283; x = fb.x + Math.cos(fa) * fr; z = fb.z + Math.sin(fa) * fr; }
    const w = (i >= 22 ? 170 : 300) + 340 * hash3(i, 3, 23), h = 12 + 22 * hash3(i, 4, 23);
    const y = groundAt(Math.max(-1200, Math.min(700, x)), Math.max(-650, Math.min(1300, z))) * 0.3 + 6 + h * 0.3, k = i * 4;
    ms.pos[k] = x; ms.pos[k + 1] = y; ms.pos[k + 2] = z; ms.pos[k + 3] = 0;
    ms.size[i * 2] = w; ms.size[i * 2 + 1] = h;
    const col = hash3(i, 5, 23) < 0.5 ? tone : warm;
    ms.col[k] = col.r; ms.col[k + 1] = col.g; ms.col[k + 2] = col.b; ms.col[k + 3] = (i * 3) + 0.26 + 0.24 * hash3(i, 6, 23);
  }
  ms.attrs.iPos.needsUpdate = ms.attrs.iCol.needsUpdate = ms.attrs.iSize.needsUpdate = true;
  ms.mesh.renderOrder = 3;
  world.staticGroup.add(ms.mesh);
  update.sprites = world.bromoSprites;
}

function fillSprites(W, t) {
  const { spr, dustC, dust } = W, { pos, col, size } = spr;
  let k = 0;
  const put = (x, y, z, w, h, rot, c, a, seed) => {
    pos[k * 4] = x; pos[k * 4 + 1] = y; pos[k * 4 + 2] = z; pos[k * 4 + 3] = rot;
    size[k * 2] = w; size[k * 2 + 1] = h;
    col[k * 4] = c.r; col[k * 4 + 1] = c.g; col[k * 4 + 2] = c.b; col[k * 4 + 3] = Math.floor(seed * 40) + Math.min(0.999, Math.max(0, a));
    k++;
  };
  // the dust hanging behind the far jeeps
  dust.forEach(([x, y, z, a], q) => {
    for (let i = 0; i < 3; i++) {
      const s = i * 8 + 4 * Math.sin(t * 0.3 + q), wd = 7 + i * 6;
      put(x - Math.sin(a) * s, y + i * 0.7, z - Math.cos(a) * s, wd, wd * 0.6, q + i, dustC, 0.42 - i * 0.1, hash3(q, i, 43));
    }
  });
  spr.attrs.iPos.needsUpdate = spr.attrs.iCol.needsUpdate = spr.attrs.iSize.needsUpdate = true;
}

export function update(time) {
  if (update.sprites) fillSprites(update.sprites, time);
}
