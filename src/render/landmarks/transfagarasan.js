// Transfăgărășan: Bâlea Lac and the ladder under it. Facts in docs/references/transfagarasan.md. Placed in true compass metres from the middle of the
// lake (e east, n north), as the track file is drawn. Treeless above the dwarf pine: what fills the eye is the cirque, the lake and its cabana, the
// stalls at the top of the pass, the cable car coming up the valley, boulders, late snow and sheep. Scenery only: nothing here is ever hit.
import * as THREE from 'three';
import { hash3, lerp, linear, smooth, vnoise } from '../math.js';
import { shardGeometry } from '../rocks.js';
import { trough } from '../../world/tracks/transfagarasan.js';
import { merge, paint, place, box, roundedBox, sphere, capsule, cylinder, cone, gable, tube, lathe } from '../shapes.js';

// Colours of the place: dark red timber and red tin roofs, grey stone.
const TIMBER = '#66261c', TIMBER_D = '#451a14', TIMBER_L = '#7e3224', ROOF = '#a8362a', ROOF_D = '#862a22', STONE = '#8f8b84', STONE_D = '#6c6964', WHITE = '#efe9dc', STEEL = '#8b8d90', STEEL_D = '#5e6066', BOULDER = '#8f8e86', WOOL = '#f3ece0', SNOW = '#fbfaf6', GLASS = '#2e3a40', GLASS_L = '#4d5c64', TIN = 7;
const RAIL = '#a23a26', RAIL_D = '#7d2c1e';
const XZ = (e, n) => ({ x: e, z: -n });

// Cabana Bâlea Lac at the water's edge, as the photos have it: a stone ground floor standing in the lake, two floors of dark red-brown timber with rows of windows and long balconies, steep red tin roofs in three blocks with dormers, a terrace on posts over the water, cut wood stacked at its side. Long side along +x; +z faces the water; y = 0 is the water.
function cabana() {
  const P = [];
  const windows = (x0, x1, y, z, step) => { for (let x = x0; x <= x1 + 0.01; x += step) { P.push(paint(place(box(1.5, 1.6, 0.16), { p: [x, y, z] }), hash3(x | 0, y | 0, 3) > 0.5 ? GLASS_L : GLASS)); P.push(paint(place(box(1.8, 0.18, 0.3), { p: [x, y - 0.9, z] }), TIMBER_D)); } };
  const balcony = (x0, x1, y, z) => {
    const L = x1 - x0, c = (x0 + x1) / 2;
    P.push(paint(place(box(L + 0.4, 0.26, 1.8), { p: [c, y, z + 0.85] }), TIMBER_D));
    P.push(paint(place(box(L + 0.4, 0.16, 0.16), { p: [c, y + 1.2, z + 1.7] }), RAIL));
    for (let x = x0; x <= x1 + 0.01; x += 0.5) P.push(paint(place(box(0.13, 1.15, 0.08), { p: [x, y + 0.62, z + 1.7] }), hash3(x * 10 | 0, 1, 7) > 0.5 ? RAIL : TIMBER));
    for (let x = x0; x <= x1 + 0.01; x += 3.6) P.push(paint(place(box(0.22, 1.1, 0.22), { p: [x, y - 0.55, z + 1.2], r: [0.7, 0, 0] }), TIMBER_D));
  };
  // a block: stone under it, boards, a red roof. along: the ridge runs along x, else along z (a gable faces the water)
  const block = (x, z, w, l, y0, h, rh, along) => {
    const { walls, roof } = gable(along ? l : w, along ? w : l, y0 + h, rh, 1.3);
    if (along) { walls.rotateY(Math.PI / 2); roof.rotateY(Math.PI / 2); }
    place(walls, { p: [x, 0, z] }); place(roof, { p: [x, 0, z] });
    P.push(paint(walls, TIMBER, 2), paint(roof, ROOF, TIN));
  };
  const Y0 = 4.6;
  // the stone storey the whole house stands on, its foot in the lake
  P.push(paint(place(box(48, Y0 + 7, 19), { p: [-1, Y0 / 2 - 3.5, -1] }), STONE, 31));
  P.push(paint(place(box(48.6, 0.34, 19.6), { p: [-1, Y0 + 0.1, -1] }), STONE_D));
  // the long main house with its ridge along the water; the great gable at the middle, a second one west of it, the lower east wing with its own ridge turned
  block(-3, -2.5, 14, 34, Y0, 6.2, 5.6, true);
  block(6, 2.2, 14, 15, Y0, 8.6, 6.8, false);
  block(-11.5, 1.6, 10.5, 13, Y0, 6.6, 5, false);
  block(18, -1, 12, 12, Y0, 4.2, 4.2, false);
  block(-21, -3, 9, 9, Y0, 3.4, 3.4, false);
  // the fronts: rows of windows, long balconies on both floors, the top window of each gable
  for (const y of [7.2, 10.4]) { windows(0.6, 11.4, y, 9.36, 2.7); balcony(-0.6, 12.6, y - 1.7, 9.3); }
  windows(6, 6, 14.6, 9.36, 3);
  windows(-15, -8, 7.2, 8.2, 2.4); balcony(-16.2, -6.8, 5.5, 8.1); windows(-13, -10, 10.5, 8.2, 3);
  windows(14.4, 21.6, 7.1, 5.1, 2.4); balcony(13, 23, 5.4, 5.1);
  windows(-23, -18, 6.9, 1.6, 2.4);
  for (let x = -18; x <= 12; x += 2.8) P.push(paint(place(box(1.4, 1.5, 0.16), { p: [x, 7.4, -9.66] }), hash3(x | 0, 2, 3) > 0.6 ? GLASS_L : GLASS));
  // dormers in the back roof, chimneys of the same stone
  for (const x of [-14, -7, 0, 7]) { const d = gable(2.6, 3.2, 2, 1.4, 0.3); d.walls.rotateY(Math.PI); d.roof.rotateY(Math.PI); place(d.walls, { p: [x, 12.6, -6.8] }); place(d.roof, { p: [x, 12.6, -6.8] }); P.push(paint(d.walls, TIMBER, 2), paint(d.roof, ROOF_D, TIN), paint(place(box(1.2, 1.2, 0.12), { p: [x, 13.5, -8.5] }), GLASS_L)); }
  for (const [x, z, h] of [[-5, -5, 3], [10, -3, 3.2], [-16, -4, 2.6]]) P.push(paint(place(box(1.1, h + 2, 1.1), { p: [x, 15.6 + h / 2 - 0.6, z] }), STONE, 31), paint(place(box(1.45, 0.24, 1.45), { p: [x, 15.6 + h + 0.4, z] }), STONE_D));
  // small square windows in the stone storey, the arched door
  for (let x = -18; x <= 20; x += 4.2) P.push(paint(place(box(1.2, 1.3, 0.14), { p: [x, 2.6, 8.56] }), GLASS));
  // the terrace on the stone over the water, with the red rail of the photos, and the outside stair running up to it from the shore
  const ty = Y0 + 0.3;
  P.push(paint(place(box(19, 0.34, 7), { p: [15, ty, 11] }), TIMBER_D));
  P.push(paint(place(box(19, 6.6, 7), { p: [15, ty - 3.5, 11] }), STONE, 31));
  P.push(paint(place(box(19, 0.18, 0.2), { p: [15, ty + 1.2, 14.45] }), RAIL), paint(place(box(0.2, 0.18, 7), { p: [24.45, ty + 1.2, 11] }), RAIL));
  for (let i = 0; i <= 19; i++) P.push(paint(place(box(0.14, 1.15, 0.12), { p: [5.5 + i, ty + 0.64, 14.45] }), RAIL));
  for (const x of [9, 15, 21]) {
    P.push(paint(place(cylinder(0.08, 0.08, 3.2, 5), { p: [x, ty + 1.6, 11] }), TIMBER_D));
    P.push(paint(place(lathe([[2.4, 0], [1.6, 0.55], [0, 0.95]], 10), { p: [x, ty + 2.9, 11] }), '#c9483a'));
  }
  const stair = place(box(2, 0.3, 11), { p: [2.2, 2.3, 14], r: [0.56, 0, 0] });
  P.push(paint(stair, RAIL_D));
  for (const sd of [-1, 1]) P.push(paint(place(box(0.14, 0.14, 11), { p: [2.2 + sd * 0.95, 3.4, 14], r: [0.56, 0, 0] }), RAIL));
  for (let k = -4; k <= 4; k++) for (const sd of [-1, 1]) P.push(paint(place(box(0.1, 1.1, 0.1), { p: [2.2 + sd * 0.95, 2.82 + k * 0.56 * -0.97, 14 + k * 0.97 * 1.0] }), RAIL));
  // the stone wall along the water east of the house
  P.push(paint(place(box(14, 5, 2.4), { p: [32, -0.2, 3] }), STONE, 31));
  // the great pile of split logs on the shore at its west end, end grain to the water
  for (let y = 0; y < 5; y++) for (let x = 0; x < 26; x++) {
    const j = hash3(x, y, 9), r = 0.26 + 0.1 * j, px = -46 + x * 0.68 + (y % 2) * 0.34;
    P.push(paint(place(cylinder(r, r, 2.6, 6), { p: [px, 2.0 + y * 0.56, 2 + 0.2 * j], r: [Math.PI / 2, 0, 0] }), j > 0.5 ? '#c9a06a' : '#b58c58'));
  }
  P.push(paint(place(box(19, 3.2, 3), { p: [-37.4, 0.2, 2] }), STONE, 31));
  return merge(P);
}

// Low dark timber on a stone foot, a red tin roof: what else stands round the cabana in the photos. l: length along the ridge.
function chalet(w, l, h, rh) {
  const P = [];
  P.push(paint(place(box(l + 0.6, 7, w + 0.6), { p: [0, -2.2, 0] }), STONE, 31));
  const { walls, roof } = gable(l, w, h + 1.3, rh, 0.9);
  place(walls, { p: [0, 1.2, 0] }); place(roof, { p: [0, 1.2, 0] });
  P.push(paint(walls, TIMBER, 2), paint(roof, hash3(w | 0, l | 0, 3) > 0.5 ? ROOF : ROOF_D, TIN));
  for (const sd of [1, -1]) { for (let x = -l / 2 + 1.6; x < l / 2 - 0.8; x += 2.6) P.push(paint(place(box(1.2, 1.3, 0.14), { p: [x, 3.5, sd * (w / 2 + 0.06)] }), hash3(x | 0, sd, 5) > 0.6 ? GLASS_L : GLASS)); }
  P.push(paint(place(box(1.3, 2.3, 0.16), { p: [l / 2 - 1.2, 2.5, w / 2 + 0.06] }), TIMBER_D));
  return merge(P);
}

// A stall of the top of the pass: striped awning, a counter of what it sells. kind: cheese in bark rolls, honey jars, or mici on a smoking grill.
function stall(kind, tint) {
  const P = [], w = 6, d = 3.4, h = 3;
  for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) P.push(paint(place(cylinder(0.09, 0.11, h, 5), { p: [x, h / 2, z] }), TIMBER_D));
  // awning stripes
  for (let i = 0; i < 6; i++) {
    const g = box(w / 6 + 0.02, 0.1, d + 1.2);
    place(g, { p: [(i - 2.5) * w / 6, h + 0.12, 0.1], r: [-0.22, 0, 0] });
    P.push(paint(g, i % 2 ? WHITE : tint));
  }
  P.push(paint(place(roundedBox(w - 0.2, 1, 1.1, 0.08, 1), { p: [0, 0.5, d / 2 - 0.5] }), TIMBER_L, 2));
  P.push(paint(place(roundedBox(w - 0.2, 2.2, 0.2, 0.05, 1), { p: [0, 1.1, -d / 2 + 0.1] }), TIMBER, 2));
  const top = 1.05, z = d / 2 - 0.5;
  if (kind === 'cheese') for (let i = 0; i < 9; i++) {
    const x = -2.4 + (i % 5) * 1.2 + (i > 4 ? 0.6 : 0), y = top + 0.22 + (i > 4 ? 0.42 : 0);
    P.push(paint(place(capsule(0.2, 0.55, 2, 7), { p: [x, y, z], r: [0, 0, Math.PI / 2] }), i % 2 ? '#b98a54' : '#a0713f'));
  } else if (kind === 'honey') for (let i = 0; i < 12; i++) {
    const x = -2.5 + (i % 6) * 1, y = top + 0.22 + (i > 5 ? 0.44 : 0);
    P.push(paint(place(cylinder(0.17, 0.17, 0.42, 8), { p: [x, y, z] }), i % 3 ? '#e2a12e' : '#c98420'), paint(place(cylinder(0.18, 0.18, 0.1, 8), { p: [x, y + 0.26, z] }), '#e8d9b8'));
  } else {
    P.push(paint(place(box(3.6, 0.3, 0.9), { p: [0, top + 0.1, z] }), '#35302f'));
    for (let i = 0; i < 9; i++) P.push(paint(place(capsule(0.08, 0.3, 2, 6), { p: [-1.5 + i * 0.38, top + 0.3, z], r: [Math.PI / 2, 0, 0] }), '#8a4f30'));
    for (let i = 0; i < 4; i++) P.push(paint(place(sphere(0.3 + i * 0.1, 7, 5), { p: [0.3 * Math.sin(i * 2), top + 1 + i * 0.5, z - 0.3] }), '#e6dfd8'));
  }
  return merge(P);
}

// A tower of the cable car: a slim tapered steel box in pale grey, a yoke at the top with its saddles, a ladder up one leg. Set on a concrete footing.
function pylon(h = 24) {
  const P = [], c = 1.5, t = 0.42;
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (const [x, z] of corners) P.push(paint(tube([[x * c, -1, z * c], [x * t, h - 1.4, z * t]], 0.1, 5), STEEL));
  P.push(paint(place(roundedBox(c * 2 + 1.2, 1.2, c * 2 + 1.2, 0.1, 1), { p: [0, -0.2, 0] }), '#a9a69c', 1));
  const rungs = Math.floor(h / 5);
  for (let i = 1; i <= rungs; i++) {
    const f = i / (rungs + 1), a = lerp(c, t, f), y = lerp(-1, h - 1.4, f);
    for (let k = 0; k < 4; k++) { const [x0, z0] = corners[k], [x1, z1] = corners[(k + 1) % 4]; P.push(paint(tube([[x0 * a, y, z0 * a], [x1 * a, y, z1 * a]], 0.045, 3), STEEL_D)); }
  }
  P.push(paint(place(roundedBox(9.4, 0.42, 0.7, 0.08, 1), { p: [0, h - 1.1, 0] }), STEEL), paint(place(cylinder(0.3, 0.42, 1.4, 6), { p: [0, h - 1.9, 0] }), STEEL_D));
  for (const s of [-1, 1]) P.push(paint(place(roundedBox(0.34, 0.3, 2.4, 0.06, 1), { p: [s * 3.8, h - 0.72, 0] }), '#3a3c42'));
  return merge(P);
}

// The upper station by the lake: long and low, stone foot, timber upper floor, a tin roof, the big open mouth the cabins come into.
function station() {
  const P = [];
  P.push(paint(place(box(14.6, 9, 20), { p: [0, -2.6, -2] }), STONE, 31));
  const { walls, roof } = gable(14, 19, 4.4, 2.6, 1);
  place(walls, { p: [0, 0, -2] }); place(roof, { p: [0, 0, -2] });
  P.push(paint(walls, TIMBER, 4), paint(roof, '#6f7176', TIN));
  P.push(paint(place(box(10, 3.4, 0.3), { p: [0, 2.3, 7.56] }), '#26282c'));
  P.push(paint(place(box(14, 0.5, 0.5), { p: [0, 4.3, 7.6] }), TIMBER_D));
  return merge(P);
}
function cabin() {
  const P = [];
  P.push(paint(place(roundedBox(3.4, 2.5, 2, 0.5, 2), {}), '#d9483b'));
  P.push(paint(place(roundedBox(3.5, 0.9, 2.08, 0.2, 1), { p: [0, 0.24, 0] }), '#d5e8ec'));
  P.push(paint(place(roundedBox(3.5, 0.3, 2.1, 0.1, 1), { p: [0, -0.9, 0] }), WHITE));
  P.push(paint(tube([[0, 1.1, 0], [0, 2.9, 0]], 0.09, 4), STEEL_D));
  P.push(paint(place(roundedBox(1.7, 0.4, 0.5, 0.1, 1), { p: [0, 3, 0] }), STEEL_D));
  return merge(P);
}

// A stână, the shepherd's summer fold: a low hut of rough boards with a shingle roof, a thin smoke, wattle pens beside it.
function stana() {
  const P = [];
  P.push(paint(place(box(7, 6, 6), { p: [0, -1, 0] }), STONE_D, 1));
  const { walls, roof } = gable(6.6, 5.6, 2.8, 2.4, 0.8);
  P.push(paint(walls, '#6b5240', 4), paint(roof, '#5a5148', 3));
  P.push(paint(place(box(1.3, 2, 0.14), { p: [0, 1, 2.86] }), '#2a2320'));
  for (let i = 0; i < 4; i++) P.push(paint(place(sphere(0.34 + i * 0.13, 7, 5), { p: [1.6 + 0.4 * Math.sin(i * 1.7), 5.6 + i * 0.9, 0] }), '#e8e2dc'));
  // the pens
  for (const [a, b] of [[[4, -3], [12, -3]], [[12, -3], [12, 6]], [[12, 6], [4, 6]]]) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.round(L / 1.6);
    for (let i = 0; i <= n; i++) { const t = i / n; P.push(paint(place(cylinder(0.06, 0.08, 1.5, 4), { p: [lerp(a[0], b[0], t), 0.75, lerp(a[1], b[1], t)] }), '#7a5c40')); }
    P.push(paint(tube([[a[0], 0.6, a[1]], [b[0], 0.6, b[1]]], 0.09, 3), '#9a7a58'), paint(tube([[a[0], 1.15, a[1]], [b[0], 1.15, b[1]]], 0.09, 3), '#8a6c4c'));
  }
  return merge(P);
}

// Țurcană: long rough wool, in clumps, a dark face.
function sheepGeo(dark = false) {
  const P = [], wool = dark ? '#6a5d58' : WOOL;
  for (const [x, y, z, r] of [[0, 0.8, 0, 0.56], [0, 0.82, -0.44, 0.48], [0, 0.82, 0.38, 0.46], [0.26, 0.92, -0.05, 0.36], [-0.26, 0.92, -0.05, 0.36], [0, 1.12, 0, 0.38]]) P.push(paint(place(sphere(r, 8, 6), { p: [x, y, z] }), wool));
  P.push(paint(place(sphere(0.25, 8, 6), { p: [0, 0.98, 0.78], s: [0.8, 1, 1.1] }), '#3c3230'));
  for (const s of [-1, 1]) {
    P.push(paint(place(sphere(0.07, 5, 4), { p: [s * 0.13, 1.06, 0.98] }), '#fff'));
    P.push(paint(place(capsule(0.07, 0.15, 2, 5), { p: [s * 0.28, 1.06, 0.68], r: [0, 0, s * 1.2] }), '#3c3230'));
    for (const z of [-0.4, 0.4]) P.push(paint(place(capsule(0.07, 0.24, 2, 5), { p: [s * 0.24, 0.26, z] }), '#3c3230'));
  }
  return merge(P);
}
// A big Carpathian dog, brindled, sitting up and watching the flock.
function dogGeo() {
  const P = [], c = '#a07c50', d = '#6a4e34';
  P.push(paint(place(capsule(0.42, 0.7, 3, 8), { p: [0, 0.75, -0.1], r: [-0.5, 0, 0] }), c));
  P.push(paint(place(sphere(0.38, 9, 7), { p: [0, 1.52, 0.28] }), c), paint(place(sphere(0.2, 7, 5), { p: [0, 1.42, 0.62] }), '#e6d4b4'), paint(place(sphere(0.08, 5, 4), { p: [0, 1.46, 0.8] }), '#1c1616'));
  for (const s of [-1, 1]) {
    P.push(paint(place(capsule(0.12, 0.26, 2, 5), { p: [s * 0.32, 1.52, 0.12], r: [0, 0, s * 0.3] }), d));
    P.push(paint(place(sphere(0.06, 5, 4), { p: [s * 0.15, 1.6, 0.6] }), '#1c1616'));
    P.push(paint(place(capsule(0.1, 0.5, 2, 5), { p: [s * 0.2, 0.34, 0.26] }), c));
    P.push(paint(place(sphere(0.22, 6, 5), { p: [s * 0.26, 0.26, -0.4] }), c));
  }
  P.push(paint(tube([[0, 0.5, -0.56], [0, 0.34, -1], [0, 0.56, -1.3]], 0.1, 4), d));
  return merge(P);
}

// A wayside cross of the Romanian mountains (a troiță): dark timber with a small shingle roof over it. Treated with care, set back from the road.
function troita() {
  const P = [];
  P.push(paint(place(box(0.34, 4.2, 0.3), { p: [0, 2.1, 0] }), TIMBER_D, 2));
  P.push(paint(place(box(2, 0.3, 0.26), { p: [0, 3.1, 0] }), TIMBER_D, 2));
  const { walls, roof } = gable(0.5, 2.6, 4.1, 0.8, 0.5);
  roof.rotateY(Math.PI / 2);
  P.push(paint(roof, '#5a5148', 3));
  P.push(paint(place(box(1.3, 0.5, 1.3), { p: [0, 0.2, 0] }), STONE_D, 1));
  return merge(P);
}

// Fractured schist: flat faces, each its own tone, a few seeds turned and stretched, so no two lie alike. Sunk a little into the ground.
function boulder(r, seed) {
  const g = shardGeometry(seed % 11 + 1), base = linear(BOULDER), t = 0.82 + 0.34 * hash3(seed, 2, 5), warm = 0.97 + 0.08 * hash3(seed, 6, 5), C = g.attributes.color;
  for (let i = 0; i < C.count; i++) { const k = C.getX(i) * t; C.setXYZ(i, base[0] * k * warm, base[1] * k, base[2] * k / warm); }
  place(g, { p: [0, r * 0.2, 0], r: [(hash3(seed, 7, 5) - 0.5) * 0.5, seed * 1.7, (hash3(seed, 8, 5) - 0.5) * 0.5], s: [r * (0.85 + 0.5 * hash3(seed, 3, 5)), r * (0.6 + 0.5 * hash3(seed, 4, 4)), r * (0.8 + 0.5 * hash3(seed, 5, 5))] });
  return g;
}

// A big stone is a broken lump: a shard this size is a flat slab with a straight edge. Small ones stay shards.
const rockOf = (R, seed) => (R > 2.1 ? place(crag(seed, 1), { p: [0, R * 0.1, 0], r: [0, seed * 1.7, 0], s: [R * 1.1, R * 0.85, R * 1.1] }) : boulder(R, seed));

// A crag: a lump broken by ridged noise into planes, flat faces, grey schist with a dark crack here and there and dry grass on the faces that look up. Radius 1 about, scaled by whoever places it.
function crag(seed, detail = 2) {
  const src = new THREE.IcosahedronGeometry(1, detail), p = src.attributes.position, pos = [], nor = [], col = [];
  const rock = linear('#7e7e7b'), crack = linear('#55565a'), grass = linear('#6d7244'), tan = linear('#8c8850');
  const bent = new Map();
  const at = (i) => {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
    if (!bent.has(k)) {
      const n = 1 - Math.abs(2 * vnoise(x * 1.7 + seed, z * 1.7 - y * 1.3, seed % 17) - 1), m = vnoise(x * 4.1 + y * 3.1, z * 4.1 + seed, seed % 13 + 3), r = 0.84 + 0.26 * n + 0.14 * (m - 0.5);
      bent.set(k, [x * r, y * r * (y < 0 ? 0.9 : 1), z * r]);
    }
    return bent.get(k);
  };
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), nv = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    const A = at(i), B = at(i + 1), C = at(i + 2);
    a.fromArray(A); b.fromArray(B); c.fromArray(C);
    nv.copy(b).sub(a).cross(c.clone().sub(a)).normalize();
    const t = hash3(i, seed, 44), tone = 0.9 + 0.2 * t, up = nv.y > 0.5 && hash3(i, seed, 46) > 0.2;
    const base = up ? (hash3(i, seed, 47) > 0.5 ? grass : tan) : t < 0.05 ? crack : rock;
    // half the face's own normal, half the lump's: so the planes stay and the triangles of the mesh do not shout
    const cx = (A[0] + B[0] + C[0]) / 3, cy = (A[1] + B[1] + C[1]) / 3, cz = (A[2] + B[2] + C[2]) / 3, cl = Math.hypot(cx, cy, cz) || 1;
    nv.set(nv.x * 0.55 + cx / cl * 0.45, nv.y * 0.55 + cy / cl * 0.45, nv.z * 0.55 + cz / cl * 0.45).normalize();
    pos.push(...A, ...B, ...C);
    for (let k = 0; k < 3; k++) { nor.push(nv.x, nv.y, nv.z); col.push(base[0] * tone, base[1] * tone, base[2] * tone); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

// A clump of mountain grass: a few blades, dark at the foot and light at the tip, up and out. Colours linear.
function tuft(pos, nor, col, x, y, z, seed, h, base, tip) {
  for (let b = 0; b < 6; b++) {
    const a = hash3(seed, b, 61) * 6.283, ca = Math.cos(a), sa = Math.sin(a), w = 0.022 + 0.04 * hash3(seed, b, 62), H = h * (0.55 + 0.6 * hash3(seed, b, 63)), lean = 0.12 + 0.5 * hash3(seed, b, 64), r = 0.03 + 0.2 * hash3(seed, b, 65), t = 0.8 + 0.5 * hash3(seed, b, 66);
    const ox = x + ca * r, oz = z + sa * r, tipX = ox + ca * lean * H, tipZ = oz + sa * lean * H;
    // both faces wound, each lit as ground: a flipped normal turns a blade black
    pos.push(ox - sa * w, y, oz + ca * w, ox + sa * w, y, oz - ca * w, tipX, y + H, tipZ, ox + sa * w, y, oz - ca * w, ox - sa * w, y, oz + ca * w, tipX, y + H, tipZ);
    for (let k = 0; k < 6; k++) nor.push(0, 1, 0);
    const tc = tip.map((v) => v * t);
    col.push(...base, ...base, ...tc, ...base, ...base, ...tc);
  }
}

function signAtlas(list) {
  const W = 1024, rowH = 128, cv = document.createElement('canvas');
  cv.width = W; cv.height = rowH * list.length;
  const g = cv.getContext('2d');
  list.forEach((s, i) => {
    const y = i * rowH;
    g.fillStyle = s.bg; g.fillRect(0, y, W, rowH);
    g.strokeStyle = s.ink; g.lineWidth = 8; g.strokeRect(10, y + 10, W - 20, rowH - 20);
    g.fillStyle = s.ink; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `bold ${s.size || 78}px Arial Rounded MT Bold, Helvetica, Arial, sans-serif`;
    g.fillText(s.text, W / 2, y + rowH / 2 + 4);
  });
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return { texture: t, rows: list.length };
}
function signPlane(w, h, row, rows) {
  const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - (row + (1 - uv.getY(i))) / rows);
  return g;
}
function mergeUV(list) {
  const out = new THREE.BufferGeometry(), P = [], N = [], UV = [], X = [];
  let v = 0;
  for (const g of list) {
    P.push(...g.attributes.position.array); N.push(...g.attributes.normal.array); UV.push(...g.attributes.uv.array);
    for (let i = 0; i < g.index.count; i++) X.push(g.index.getX(i) + v);
    v += g.attributes.position.count;
  }
  out.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  out.setIndex(X);
  return out;
}

// The cable car's line up the valley: pylons at true-ish spacing, from the station by the lake north until the valley drops out of sight.
const CABLE = [[-140, 134], [-128, 262], [-118, 452], [-98, 590], [-84, 790], [-70, 1010]];
const CABANA = [84, 73]; // e, n: its front in the water, turned toward the road coming along the shore

// The torrents, in true e, n: out of the lake's north end under the road and on down past the ladder, and the one under the viaduct.
const STREAMS = [
  [[60, 70], [66, 130], [52, 160], [10, 205], [6, 250], [8, 270], [20, 310], [40, 400], [30, 520], [20, 700]],
  [[-480, 150], [-380, 172], [-300, 190], [-230, 205], [-180, 215], [-120, 300], [-90, 420], [-40, 620]],
];
const denseStream = (pts, wig = 2.2) => {
  const dense = [];
  for (let i = 0; i + 1 < pts.length; i++) for (let k = 0; k < 8; k++) { const t = k / 8, q = wig * Math.sin((i * 8 + k) * 0.8) * Math.min(1, Math.min(i + t, pts.length - 1 - i - t)); dense.push([lerp(pts[i][0], pts[i + 1][0], t) + q, lerp(pts[i][1], pts[i + 1][1], t)]); }
  dense.push(pts[pts.length - 1]);
  return dense;
};
// m to the nearest point of a torrent's bed, for the paint: a hash of cells, since the ground asks at every node
const streamCells = new Map();
for (const st of STREAMS) { const dn = denseStream(st); for (let i = 0; i + 1 < dn.length; i++) for (let k = 0; k <= 4; k++) { const e = lerp(dn[i][0], dn[i + 1][0], k / 4), N = lerp(dn[i][1], dn[i + 1][1], k / 4), c = `${Math.floor(e / 24)},${Math.floor(N / 24)}`; (streamCells.get(c) ?? streamCells.set(c, []).get(c)).push(e, N); } }
function streamDist(e, N) {
  let best = 99;
  const ci = Math.floor(e / 24), cj = Math.floor(N / 24);
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = streamCells.get(`${ci + a},${cj + b}`); if (l) for (let i = 0; i < l.length; i += 2) best = Math.min(best, Math.hypot(l[i] - e, l[i + 1] - N)); }
  return best;
}

export function plan({ track, terrain, world }) {
  const keep = world.keepOut, L = track.def.ground.lake;
  keep.push({ x: L.x, z: L.z, r: Math.max(L.rx, L.rz) * 0.92 });
  world.buildings = [];
  const site = (kind, e, n, r, opts = {}) => {
    const { x, z } = XZ(e, n);
    world.buildings.push({ kind, x, z, r, ...opts });
    keep.push({ x, z, r });
  };
  // the cabana with its feet in the lake, right under the wall; the low timber buildings behind the road; the station; the shepherds' fold
  site('cabana', CABANA[0], CABANA[1], 28, { yaw: -0.78 });
  site('chalet1', -40, 128, 11, { yaw: 0.2, sink: 0.4 });
  site('chalet2', 8, 124, 9, { yaw: -0.1, sink: 0.4 });
  site('chalet3', 58, 124, 9, { yaw: 0.35, sink: 0.4 });
  site('station', CABLE[0][0], CABLE[0][1] - 8, 13, { yaw: 0 });
  site('stana', -175, 262, 13, { yaw: 2.2 });
  for (const [e, n] of CABLE.slice(1)) { const { x, z } = XZ(e, n); keep.push({ x, z, r: 6 }); }
  // the open grass: only the dark spruce low in the valley, planted, and the jneapăn in scattered mats on the rough ground; none on the walls
  const G = world.groves;
  const add = (e, n, r, cover, kinds) => { const { x, z } = XZ(e, n); G.push({ x, z, r, cover, kinds }); };
  add(-10, 100, 260, -0.9);
  add(0, 250, 240, -0.25);
  add(-200, 340, 150, -0.3);
  add(-280, 120, 110, -0.2);
  // spruce: where the real treeline starts, low on the flanks past the bottom of the stack
  for (let i = 0; i < 150; i++) {
    const side = i % 2 ? 1 : -1, n = 620 + 680 * hash3(i, 1, 21) ** 0.7, e = -70 + side * (120 + 300 * hash3(i, 2, 21) + (n - 620) * 0.1);
    const { x, z } = XZ(e, n);
    world.plant.push({ x, z, kind: 'vale', h: 12 + 9 * hash3(i, 3, 21) });
  }
  // what the walls and the floor are made of, by the node. Grey scree in fans at the foot of the walls and stone on the shore; bare dark rock in ribs; grass on the benches between them
  const SCREE = linear('#b2ac9a'), SCREE_D = linear('#98958a'), GRASSW = linear('#7c9339'), GRASST = linear('#b4ae52'), OCHRE = linear('#c6b476');
  const out = [0, 0, 0, 0, 0];
  world.paintAt = (x, z) => {
    const e = x, n = -z, { d, along } = trough(e, n);
    const y = terrain.heightAt(x, z), overLake = y - L.level, nearLake = ((x - L.x) / L.rx) ** 2 + ((z - L.z) / L.rz) ** 2 < 2.2;
    const a = along / 46;
    // fans widen as they come down, spill over the foot onto the floor
    const fan = smooth(0.56, 0.68, vnoise(a * 0.3 + 3, d / 260 + 1, 5) + 0.14 * (1 - smooth(-30, 110, d)));
    const onWall = smooth(-26, 8, d);
    // bare rock in bands and ribs up the wall, thick toward the top: grass only on the benches between
    const nor = terrain.normalAt(x, z), slope = Math.acos(Math.min(1, nor[1] ?? nor.y)) * 57.3;
    const band = vnoise(a * 0.5, y / 22, 8), rib = Math.max(smooth(0.68, 0.84, band) * smooth(24, 60, d) * 0.8, smooth(60, 74, slope + 12 * (band - 0.5)) * smooth(10, 30, d));
    const bench = smooth(0.52, 0.66, vnoise(along / 64 + 9, d / 34, 3));
    const shore = nearLake ? 1 - smooth(1.0, 2.6, overLake) : 0;
    // stony patches on the moraine of the floor too
    const moraine = smooth(0.74, 0.84, vnoise(x / 80, z / 80, 11)) * 0.9;
    // the torrents' beds: pale washed gravel a few metres wide, ragged at its edge
    const bedW = 3.4 + 2.4 * vnoise(x / 60, z / 60, 15), bedOf = 1 - smooth(bedW - 1, bedW + 1, streamDist(e, n));
    // the spur the tunnel goes through is a buttress of the wall: broken rock and scree on it, no lawn
    const sa = -164, sb = -234, sl = sa * sa + sb * sb, st = Math.max(0, Math.min(1, ((e + 196) * sa + (n - 44) * sb) / sl)), spurIn = 1 - smooth(30, 84, Math.hypot(e + 196 - sa * st, n - 44 - sb * st));
    const spurRock = spurIn * smooth(0.34, 0.54, vnoise(x / 40, z / 40, 23));
    let scree = Math.max(fan * onWall * (1 - bench * smooth(50, 110, d) * 0.9), shore, moraine, bedOf, spurRock);
    const roadGap = terrain.roadDistAt(x, z);
    // big soft rock shapes out on the grass, in the charcoal of the painting, never by the kerb
    const crag = smooth(0.74, 0.92, vnoise(x / 58 + 4, z / 44, 31)) * smooth(50, 110, roadGap);
    // the ladder is the feature of the place: each rung runs in a band of pale ochre cut bank, so from above and from below the zigzag reads against the green at any distance
    const ladder = e > -112 && e < 92 && n > 148 && n < 345 ? 1 - smooth(7, 10, roadGap) : 0;
    if (roadGap < 3) scree *= 0.4;
    if (ladder > 0.02) { for (let c = 0; c < 3; c++) out[c] = OCHRE[c]; out[3] = Math.max(ladder * 0.95, 0.001); out[4] = 0; return out; }
    // the grass is never one green: olive and dry tan by patches, as in every photo of the place
    const t = vnoise(x / 70, z / 70, 13), tan = smooth(0.4, 0.66, vnoise(x / 75, z / 75, 21)), grass = Math.max(d > 10 ? smooth(10, 50, d) * 0.5 : 0, 0.25 + tan * 0.45);
    if (scree < 0.02 && grass < 0.02 && rib < 0.02 && crag < 0.02) return null;
    const S = t > 0.5 ? SCREE : SCREE_D;
    for (let c = 0; c < 3; c++) out[c] = scree > 0.5 ? S[c] : lerp(GRASSW[c], GRASST[c], tan);
    out[3] = Math.max(scree > 0.5 ? scree : grass, 0.001);
    out[4] = Math.max(rib, crag);
    return out;
  };
}

export function build({ track, batch, mat, world, terrain, look }) {
  const groundAt = world.ground.groundAt, B = batch, S = track.samples, n = track.n;
  const at = (e, N) => ({ x: e, z: -N, y: groundAt(e, -N) });
  const P = (u) => track.pointAt(u);
  const atRoad = (u, d, along = 0) => { const p = P(u); const x = p.x + p.nx * d + p.tx * along, z = p.z + p.nz * d + p.tz * along; return { x, z, y: groundAt(x, z), yaw: Math.atan2(p.tx, p.tz), p }; };

  for (const b of world.buildings) {
    const y = groundAt(b.x, b.z);
    const g = { cabana, chalet1: () => chalet(9, 16, 3.4, 3.2), chalet2: () => chalet(7, 11, 2.9, 2.4), chalet3: () => chalet(8, 13, 3.1, 2.8), station, stana }[b.kind]();
    place(g, { p: [b.x, b.kind === 'cabana' ? track.def.ground.lake.level + 0.1 : y - (b.sink ?? 0.05), b.z], r: [0, b.yaw ?? 0, 0] });
    B.add(g);
    B.blob(b.x, b.z, b.r * 0.8, 0.4);
  }

  // the stalls at the top, in a line on the north side of the straight, smoke from the grill, the sellers' flags
  const TINTS = ['#d9483b', '#2f6fb5', '#e8b63a', '#3a8a5a'], KINDS = ['mici', 'cheese', 'honey', 'cheese', 'mici', 'honey', 'cheese'];
  KINDS.forEach((k, i) => {
    const a = atRoad(0.035 + i * 0.0105, 15.5), g = stall(k, TINTS[i % 4]);
    place(g, { p: [a.x, a.y - 0.02, a.z], r: [0, a.yaw + Math.PI / 2 * 0 - Math.PI / 2 + Math.PI, 0] });
    B.add(g); B.blob(a.x, a.z, 4.4, 0.35);
  });
  // the cable car: pylons up the valley, two cables, cabins that keep moving
  const cableY = [];
  CABLE.forEach(([e, N], i) => {
    const a = at(e, N), h = i === 0 ? 8 : 24;
    if (i) { const g = pylon(h); place(g, { p: [a.x, a.y, a.z], r: [0, 0.06, 0] }); B.add(g); B.blob(a.x, a.z, 4, 0.3); }
    cableY.push(a.y + h - 0.2);
  });
  const lineAt = (t) => {
    const f = Math.min(CABLE.length - 1.0001, Math.max(0, t * (CABLE.length - 1))), i = Math.floor(f), k = f - i;
    const [e0, n0] = CABLE[i], [e1, n1] = CABLE[i + 1], y = lerp(cableY[i], cableY[i + 1], k) - 7 * 4 * k * (1 - k) * (Math.hypot(e1 - e0, n1 - n0) / 220);
    return [lerp(e0, e1, k), y, -lerp(n0, n1, k)];
  };
  for (const s of [-3.8, 3.8]) {
    const pts = [];
    for (let i = 0; i <= 90; i++) { const [x, y, z] = lineAt(i / 90); pts.push([x + s, y, z]); }
    B.add(paint(tube(pts, 0.035, 3), '#54565c'));
  }
  const cabins = [], cabGeo = cabin(), cabMat = mat('#ffffff', { vertexColors: true });
  for (let i = 0; i < 2; i++) {
    const m = new THREE.Mesh(cabGeo, cabMat);
    m.frustumCulled = false;
    world.staticGroup.add(m); cabins.push(m);
  }

  // the boulder fields of the moraine: dense, fractured, the big ones back from the road; on the floor and along the shore
  let seed = 3;
  const L = track.def.ground.lake;
  const rockField = (e, N, rad, count, big = 1) => {
    const list = [];
    for (let i = 0; i < count; i++) {
      const a = hash3(i, seed, 31) * 6.283, r = rad * Math.sqrt(hash3(i, seed, 32));
      const x = e + Math.cos(a) * r, z = -N + Math.sin(a) * r;
      const gap = terrain.roadDistAt(x, z);
      if (gap < 4.5) continue;
      if (((x - L.x) / L.rx) ** 2 + ((z - L.z) / L.rz) ** 2 < 0.96 && groundAt(x, z) < L.level - 0.2) continue;
      const R = Math.min((0.45 + 3 * hash3(i, seed, 33) ** 3) * big, 0.8 + gap * 0.16, 3);
      { const ny = terrain.normalAt(x, z), up = ny[1] ?? ny.y; list.push(place(rockOf(R, seed * 7 + i), { p: [x, groundAt(x, z) - R * (0.12 + 0.9 * (1 - up)), z] })); }
      if (R > 0.9) B.blob(x, z, R * 1.5, 0.4);
      if (list.length === 40) { B.add(merge(list)); list.length = 0; }
    }
    if (list.length) B.add(merge(list));
    seed++;
  };
  rockField(45, 128, 40, 60, 1.2); rockField(140, 200, 50, 40); rockField(-30, 225, 18, 22); rockField(-110, 225, 30, 40, 1.1); rockField(-160, 30, 48, 60, 1.2);
  // rock round the tunnel's two mouths: the hill is a buttress of the wall, no lawn on a vault
  rockField(-296, -34, 26, 22, 1.5); rockField(-262, -46, 20, 18, 1.5); rockField(-176, 46, 18, 22, 1.5); rockField(-226, 66, 20, 16, 1.4);
  rockField(-230, 170, 35, 40); rockField(-330, 80, 40, 70, 1.3); rockField(10, 395, 60, 50, 1.2); rockField(-300, 330, 50, 40); rockField(190, 320, 50, 70, 1.3);
  // the buttress round each mouth: crags of the same schist against the portal's wall and over the vault, with grass on their ledges, so the road goes into the mountain and no hill of lawn is seen
  for (const st of track.structures.filter((q) => q.kind === 'tunnel')) for (const [i, dir] of [[st.i0, -1], [st.i1, 1]]) {
    const tx = S.tx[i] * dir, tz = S.tz[i] * dir, nx = S.nx[i], nz = S.nz[i], hw = S.w[i] / 2, cy = S.y[i], list = [], yaw = Math.atan2(tx, tz);
    const put = (lat, up, out, w, h, d, seedC) => { const x = S.x[i] + nx * lat + tx * out, z = S.z[i] + nz * lat + tz * out; list.push(place(crag(seedC, 3), { p: [x, cy + up, z], r: [0, yaw + seedC, 0], s: [w, h, d] })); };
    const sB = dir > 0 ? 40 : 70;
    for (const sd of [-1, 1]) {
      put(sd * (hw + 10), 6, -9, 8.5, 13, 10, sB + sd);
      put(sd * (hw + 21), 5, -14, 11, 15, 13, sB + sd + 3);
      put(sd * (hw + 34), 3, -20, 13, 13, 14, sB + sd + 5);
    }
    put(0, 20, -16, 22, 11, 14, sB + 7);
    put(-13, 19, -22, 17, 12, 13, sB + 8);
    put(14, 20, -24, 17, 11, 13, sB + 9);
    B.add(merge(list));
  }
  // scree on the fans under the walls, thick where the paint says stone: what makes a wall of the bare grey
  {
    const list = [], paintAt = world.paintAt;
    for (let i = 0; i < 700; i++) {
      const e = -520 + 1040 * hash3(i, 1, 71), N = -300 + 1000 * hash3(i, 2, 71), x = e, z = -N, { d } = trough(e, N);
      if (d < -24 || d > 210) continue;
      if (terrain.roadDistAt(x, z) < 7) continue;
      const pa = paintAt(x, z);
      if (!pa || pa[3] < 0.5 || (pa[0] + pa[1] + pa[2]) > 0 && Math.abs(pa[0] - pa[1]) > 0.02) continue;
      const R = (1.2 + 3.4 * hash3(i, 3, 71) ** 2.2) * (1 + d / 220);
      const ny = terrain.normalAt(x, z), up = ny[1] ?? ny.y;
      list.push(place(rockOf(R, i), { p: [x, groundAt(x, z) - R * (0.1 + 0.9 * (1 - up)), z] })); // sunk by the slope: on a steep fan a flat stone would hang out over its downhill side
      if (list.length === 60) { B.add(merge(list)); list.length = 0; }
    }
    if (list.length) B.add(merge(list));
  }
  // the shore: stones in and out of the water all round, a low broken edge, and the little grassy peninsula with its rocks
  {
    const list = [];
    for (let i = 0; i < 620; i++) {
      const a = (i / 620) * 6.283 + hash3(i, 1, 81) * 0.02, q = 0.92 + 0.26 * hash3(i, 2, 81), x = L.x + Math.cos(a) * L.rx * q, z = L.z + Math.sin(a) * L.rz * q, y = groundAt(x, z), over = y - L.level;
      if (over < -1.6 || over > 3.4 || terrain.roadDistAt(x, z) < 6) continue;
      if (Math.hypot(x - CABANA[0], z + CABANA[1]) < 30) continue;
      if (-z > 60 && x < 70) { if (hash3(i, 5, 81) > 0.25) continue; } // the road's side of the lake stays open: the water must be seen from the road
      const R = 0.5 + 1.8 * hash3(i, 3, 81) ** 2.2;
      list.push(place(boulder(R, i + 900), { p: [x, Math.max(y, L.level - 0.3) - R * 0.14, z] }));
      if (list.length === 60) { B.add(merge(list)); list.length = 0; }
    }
    if (list.length) B.add(merge(list));
    rockField(62, -8, 12, 16, 0.9);
  }
  // grass tufts and small stones along the road's edges and out on the meadow, what the near ground is made of
  {
    const flowers = [], stones = [], Tb = linear(look.terrain.meadow), Ty = linear(look.terrain.meadowY), Tt = Ty.map((v) => v * 1.2), Td = Tb.map((v) => v * 0.8), Tp = [], Tn = [], Tc = [];
    let qs = 0;
    for (let i = 0; i < n; i += 1) {
      if (track.structureAt(i)) continue;
      for (let c = 0; c < 5; c++) {
        const side = hash3(i, c, 91) < 0.5 ? 1 : -1, d = (S.w[i] / 2 + 1.2 + 9 * hash3(i, c, 92) ** 1.9) * side, x = S.x[i] + S.nx[i] * d, z = S.z[i] + S.nz[i] * d, gap = terrain.roadDistAt(x, z);
        if (gap < 1.4) continue;
        const y = groundAt(x, z);
        if (y < L.level + 0.5 && ((x - L.x) / L.rx) ** 2 + ((z - L.z) / L.rz) ** 2 < 1.4) continue;
        const pa = world.paintAt(x, z);
        if (pa && pa[3] > 0.5 && Math.abs(pa[0] - pa[1]) < 0.02) continue;
        tuft(Tp, Tn, Tc, x, y - 0.04, z, i * 5 + c, (0.3 + 0.4 * hash3(i, c, 93)) * (c % 7 === 0 ? 1.7 : 1), Td, Tt);
        // flowers of the alpine grass, a dot of colour here and there
        if (c % 5 === 2 && flowers.length < 2200) flowers.push(place(box(0.11, 0.09, 0.11), { p: [x + 0.2, y + 0.26, z - 0.1] }));
      }
      for (let q = 0; q < (i % 3 === 0 ? 1 : 0); q++) {
        const side = hash3(i, 5 + q, 91) < 0.5 ? 1 : -1, d = (S.w[i] / 2 + 1 + 9 * hash3(i, 5 + q, 92) ** 2) * side, x = S.x[i] + S.nx[i] * d, z = S.z[i] + S.nz[i] * d;
        if (terrain.roadDistAt(x, z) < 1) continue;
        const R = 0.08 + 0.36 * hash3(i, 5 + q, 93) ** 2;
        stones.push(place(boulder(R, i + 3000 + q), { p: [x, groundAt(x, z) - R * 0.1, z] }));
        if (R > 0.2) B.blob(x, z, R * 2.2, 0.35);
        if (++qs % 60 === 0) { B.add(merge(stones)); stones.length = 0; }
      }
    }
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.Float32BufferAttribute(Tp, 3)); tg.setAttribute('normal', new THREE.Float32BufferAttribute(Tn, 3)); tg.setAttribute('color', new THREE.Float32BufferAttribute(Tc, 3));
    const tm = new THREE.Mesh(tg, mat('#ffffff', { vertexColors: true, side: THREE.FrontSide }));
    tm.frustumCulled = false;
    world.staticGroup.add(tm);
    if (stones.length) B.add(merge(stones));
    if (flowers.length) { const fl = merge(flowers.slice(0, 900)); paint(fl, '#e8d24a'); B.add(fl); const fw = merge(flowers.slice(900, 1500)); paint(fw, '#f4f2ea'); B.add(fw); const fv = merge(flowers.slice(1500, 2200)); paint(fv, '#8a6ac8'); B.add(fv); }
  }
  // the retaining walls under every rung of the ladder, pale dry stone on the downhill edge with a broken parapet: a flat road on a slope cannot be seen from below, these walls are what draws the stack
  {
    const pos = [];
    const i0 = Math.floor(0.19 * n), i1 = Math.floor(0.575 * n);
    for (let i = i0; i < i1; i += 2) {
      const j = i + 2;
      if (track.structureAt(i) || track.structureAt(j)) continue;
      const hw = S.w[i] / 2 + 0.9, gp = groundAt(S.x[i] + S.nx[i] * (hw + 5), S.z[i] + S.nz[i] * (hw + 5)), gm = groundAt(S.x[i] - S.nx[i] * (hw + 5), S.z[i] - S.nz[i] * (hw + 5));
      if (Math.abs(gp - gm) < 1) continue;
      const sd = gp < gm ? 1 : -1, hj = S.w[j] / 2 + 0.9;
      const ax = S.x[i] + S.nx[i] * sd * hw, az = S.z[i] + S.nz[i] * sd * hw, bx = S.x[j] + S.nx[j] * sd * hj, bz = S.z[j] + S.nz[j] * sd * hj;
      const top = hash3(i, 3, 97) < 0.22 ? 0.18 : 0.55, a0 = S.y[i] - 5, b0 = S.y[j] - 5, a1 = S.y[i] + top, b1 = S.y[j] + top;
      pos.push(ax, a0, az, bx, b0, bz, bx, b1, bz, ax, a0, az, bx, b1, bz, ax, a1, az);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    B.add(paint(g, '#b9b5a8', 31));
  }
  // the crest over the culvert: the road's own red and white snow poles and a cairn each side, the way this road marks anything
  for (const j of track.jumps) for (const sd of [-1, 1]) {
    const d = sd * (j.w / 2 + 1.4), x = j.x + j.nx * d, z = j.z + j.nz * d, y = groundAt(x, z), c = [];
    for (let k = 0; k < 5; k++) { const ky = 0.3 + k * 0.5; c.push(paint(place(box(0.14, 0.5, 0.14), { p: [x, y + ky, z] }), k % 2 ? '#f2efe6' : '#c9382c')); }
    B.add(merge(c)); B.add(place(boulder(0.7, 40 + sd), { p: [x + j.tx * 1.4, y + 0.2, z + j.tz * 1.4] })); B.blob(x, z, 1.2, 0.4);
  }

  // the late snow: patches lying in the gullies under the great wall and at the back of the lake, as in every summer photo
  const snowPatch = (e, N, rx, rz, seedS, turn = 0) => {
    const seg = 26, rings = 3, pos = [], idx = [], c = Math.cos(turn), s = Math.sin(turn);
    pos.push(e, groundAt(e, -N) + 0.25, -N);
    for (let r = 1; r <= rings; r++) for (let i = 0; i < seg; i++) {
      const a = (i / seg) * 6.283, rag = 0.72 + 0.5 * hash3(i, seedS, 7), f = (r / rings) * (r === rings ? rag : 1), lx = Math.cos(a) * rx * f, lz = Math.sin(a) * rz * f;
      const x = e + lx * c - lz * s, z = -N + lx * s + lz * c;
      pos.push(x, groundAt(x, z) + 0.25 - (r === rings ? 0.2 : 0), z);
    }
    for (let i = 0; i < seg; i++) idx.push(0, 1 + (i + 1) % seg, 1 + i);
    for (let r = 0; r < rings - 1; r++) for (let i = 0; i < seg; i++) {
      const a = 1 + r * seg + i, b = 1 + r * seg + (i + 1) % seg, d = a + seg, f = b + seg;
      idx.push(a, b, d, b, f, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    return paint(g, SNOW);
  };
  for (const [e, N, rx, rz, t] of [[-18, -190, 16, 4, 1.5], [36, -205, 4, 12, 0.05], [-64, -180, 4, 11, -0.1], [-120, -176, 7, 4, 0.4], [300, 8, 4, 12, 0.1], [320, 110, 4, 12, 0.15], [-470, 130, 12, 4, 1.5], [-450, 40, 10, 3, -1.2]]) B.add(snowPatch(e, N, rx, rz, Math.round(e + N), t));

  // the torrents: a bed cut in the ground (ground.shape) and painted as washed gravel, dark thin water with white over its stones, boulders and cobbles in and along it
  const stream = (pts, w) => {
    const dense = denseStream(pts);
    const WATER = linear('#3a5052'), MID = linear('#4f6564'), FOAM = linear('#d6dedc'), banks = [], rows = [];
    dense.forEach(([e, N], i) => {
      const gy = groundAt(e, -N);
      // water only where the bed lies flat and now and then between its stones: on a steep moraine it is a dark line drawn on the slope, so there the bed stays gravel and cobbles
      const nx = dense[Math.min(i + 3, dense.length - 1)], px = dense[Math.max(i - 3, 0)], steep = Math.abs(groundAt(nx[0], -nx[1]) - groundAt(px[0], -px[1])) / (Math.hypot(nx[0] - px[0], nx[1] - px[1]) || 1);
      rows.push(terrain.roadDistAt(e, -N) < 3 || steep > 0.1 || vnoise(i * 0.22, 3.3, 41) < 0.36 ? null : { e, N, y: gy + 0.14, i });
      if (terrain.roadDistAt(e, -N) > 5) for (let q = 0; q < 5; q++) {
        const sd = hash3(i, q, 50) < 0.5 ? 1 : -1, R = 0.14 + 0.85 * hash3(i, q, 51) ** 2.6, o = (w + 0.2 + hash3(i, q, 52) * 3.4) * sd, a = i + 1 < dense.length ? Math.atan2(dense[i + 1][1] - N, dense[i + 1][0] - e) : 0, along = (hash3(i, q, 54) - 0.5) * 7, x = e - Math.sin(a) * o + Math.cos(a) * along, z = -(N + Math.cos(a) * o + Math.sin(a) * along);
        banks.push(place(boulder(R, i * 7 + q + 2000), { p: [x, groundAt(x, z) - R * 0.1, z] }));
      }
    });
    const pos = [], col = [], idx = [];
    let v = 0, prev = null;
    rows.forEach((r) => {
      if (!r) { prev = null; return; }
      const a = dense[Math.min(r.i + 1, dense.length - 1)], b = dense[Math.max(r.i - 1, 0)], tx = a[0] - b[0], tz = a[1] - b[1], l = Math.hypot(tx, tz) || 1, nx = tz / l, nz = tx / l;
      const across = [-1, -0.4, 0.4, 1], wv = 0.75 + 0.5 * hash3(r.i, 9, 53);
      for (let k = 0; k < 4; k++) {
        const c = across[k], gx = r.e + nx * c * w * wv, gz = r.N + nz * c * w * wv, sp = hash3(r.i, k, 53), f = sp > 0.9 ? 0.7 : 0, sh = Math.abs(c) === 1 ? MID : WATER;
        pos.push(gx, r.y, -gz);
        col.push(...sh.map((q, ci) => lerp(q, FOAM[ci], f)));
      }
      if (prev !== null) for (let k = 0; k < 3; k++) { const A = prev + k, C = v + k; idx.push(A, C, A + 1, A + 1, C, C + 1); }
      prev = v; v += 4;
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    B.add(g);
    for (let i = 0; i < banks.length; i += 40) B.add(merge(banks.slice(i, i + 40)));
  };
  stream(STREAMS[0], 0.75);
  stream(STREAMS[1], 0.7);
  // the culverts where the road goes over the stream: a low stone headwall each side
  for (const [e, N] of [[64.5, 102], [59, 150]]) {
    const near = track.nearest(e, -N), i = near.i, hw = S.w[i] / 2 + 3.2, parts = [];
    for (const s of [-1, 1]) { const x = S.x[i] + S.nx[i] * hw * s, z = S.z[i] + S.nz[i] * hw * s, y = S.y[i]; parts.push(paint(place(box(7, 2.4, 0.9), { p: [x, y - 0.9, z], r: [0, Math.atan2(S.tx[i], S.tz[i]) + Math.PI / 2, 0] }), STONE, 31)); }
    B.add(merge(parts));
  }
  // the gullies of the walls: stairs of stones down to the lake. The white threads are in the painting; a ribbon laid on the 3D slope only ever read as a ribbon
  const gully = (e0, N0, e1, N1) => {
    const stones = [];
    for (let i = 0; i <= 60; i++) {
      const t = i / 60, q = Math.sin(t * 19) * 2.2 * (1 - t * 0.5) + Math.sin(t * 47) * 0.7, e = lerp(e0, e1, t) + q, N = lerp(N0, N1, t);
      for (const sd of [-1, 1]) if (hash3(i, sd + 8, 56) > 0.45) { const R = 0.3 + 1.1 * hash3(i, sd + 2, 56) ** 2, x = e + sd * (0.5 + hash3(i, sd + 2, 57) * 3.5); stones.push(place(boulder(R, i + 4000 + (sd > 0 ? 200 : 0)), { p: [x, groundAt(x, -N) - R * 0.3, -N] })); }
    }
    B.add(merge(stones));
  };
  gully(-22, -172, -24, -60);
  gully(250, 12, 150, 20);

  // the road's furniture: white guard posts with a red band along every outer edge that falls away, snow poles on the other side
  const posts = [], poles = [];
  for (let i = 0; i < n; i += 4) {
    if (track.structureAt(i)) continue;
    const hw = S.w[i] / 2, yaw = Math.atan2(S.tx[i], S.tz[i]);
    for (const side of [-1, 1]) {
      const d = hw + 5.2, x = S.x[i] + S.nx[i] * d * side, z = S.z[i] + S.nz[i] * d * side, g = groundAt(x, z);
      if (terrain.roadDistAt(x, z) < 4.5) continue;
      if (g < S.y[i] - 0.7) posts.push(place(paint(roundedBox(0.34, 1.1, 0.34, 0.08, 1), WHITE), { p: [x, g + 0.55, z], r: [0, yaw, 0] }), place(paint(box(0.36, 0.26, 0.36), '#d9483b'), { p: [x, g + 0.8, z], r: [0, yaw, 0] }));
      else if (i % 28 === 0) poles.push(paint(place(cylinder(0.06, 0.08, 3, 5), { p: [x, g + 1.5, z] }), '#ec8a2c'), paint(place(cylinder(0.065, 0.065, 0.5, 5), { p: [x, g + 2.6, z] }), '#26222a'));
    }
  }
  // grouped by the batch's cells, so the far stack can be culled
  for (let i = 0; i < posts.length; i += 40) B.add(merge(posts.slice(i, i + 40)));
  for (let i = 0; i < poles.length; i += 30) B.add(merge(poles.slice(i, i + 30)));

  // sheep on the meadow of the bottom bend and the first stack, the dogs with them; marmots on the rocks; chamois up by the tunnel's spur
  const sheep = sheepGeo(), blackSheep = sheepGeo(true), dog = dogGeo();
  const flock = (e, N, count, rad) => {
    for (let i = 0; i < count; i++) {
      const a = hash3(i, N, 41) * 6.283, r = rad * Math.sqrt(hash3(i, N, 42)), x = e + Math.cos(a) * r, z = -N + Math.sin(a) * r;
      if (terrain.roadDistAt(x, z) < 5) continue;
      const g = (i % 11 === 5 ? blackSheep : sheep).clone(); place(g, { p: [x, groundAt(x, z) - 0.02, z], r: [0, a * 5, 0], s: 1.2 }); B.add(g); B.blob(x, z, 1.7, 0.55);
    }
  };
  flock(-150, 280, 32, 40); flock(-185, 240, 16, 24); flock(150, 225, 18, 32); flock(-30, 395, 22, 40);
  for (const [e, N, t] of [[-120, 262, 2], [-200, 300, 4], [132, 245, 1], [-10, 372, 3]]) { const a = at(e, N), g = dog.clone(); place(g, { p: [a.x, a.y, a.z], r: [0, t, 0], s: 1.3 }); B.add(g); B.blob(a.x, a.z, 1.6, 0.4); }
  // the wayside cross by the tunnel's mouth, set well back, on the lake side
  { const a = at(-160, 48), g = troita(); place(g, { p: [a.x, a.y, a.z], r: [0, 0.8, 0] }); B.add(g); B.blob(a.x, a.z, 1.4, 0.4); }

  // the signs, on real posts; the chevrons round the hairpins
  const SIGNS = [
    { text: 'ATENȚIE, URȘI!', bg: '#f6c92e', ink: '#26222a', size: 84 },
    { text: 'OI PE DRUM', bg: '#fbf7ea', ink: '#c9382c', size: 96 },
    { text: '', bg: '#f4ecdf', ink: '#f4ecdf', size: 96 },
    { text: '>>>>>>', bg: '#fbf7ea', ink: '#26222a', size: 110 },
    { text: 'MICI  BRÂNZĂ  MIERE', bg: '#7b4a2a', ink: '#f7e9c8', size: 76 },
  ];
  const atlas = signAtlas(SIGNS), planes = [];
  const sign = (u, d, row, w = 5, h = 1.1, hp = 2.2, turn = 0) => {
    const a = atRoad(u, d), yaw = a.yaw + Math.PI + turn, cx = Math.cos(yaw), sx = Math.sin(yaw);
    B.add(paint(place(box(0.2, hp + h, 0.2), { p: [a.x + cx * (w * 0.42), a.y + (hp + h) / 2, a.z - sx * (w * 0.42)] }), '#6e6770'));
    B.add(paint(place(box(0.2, hp + h, 0.2), { p: [a.x - cx * (w * 0.42), a.y + (hp + h) / 2, a.z + sx * (w * 0.42)] }), '#6e6770'));
    B.add(paint(place(box(w + 0.2, h + 0.18, 0.14), { p: [a.x - sx * 0.09, a.y + hp + h / 2, a.z - cx * 0.09], r: [0, yaw, 0] }), '#3b363c'));
    const g = signPlane(w, h, row, atlas.rows);
    place(g, { p: [a.x, a.y + hp + h / 2, a.z], r: [0, yaw, 0] });
    planes.push(g);
    B.blob(a.x, a.z, 1.5, 0.3);
  };
  sign(0.86, -11, 0, 5.2, 1); sign(0.69, 13, 1, 5, 1.1); sign(0.074, 13, 4, 7, 1.1, 2.4);
  for (const m of track.markers.filter((q) => q.tag === 'hairpin')) {
    for (const off of [-0.011, 0, 0.011]) {
      const p = P(m.u + off), s = track.curvature[p.i] > 0 ? -1 : 1;
      sign(m.u + off, s * (p.w / 2 + 5.5), 3, 3.4, 1, 0.9, s * -0.3);
    }
  }
  // the start gate: timber posts and an embroidered band in the red and black of the village blouses, a banner in the middle
  {
    const a = atRoad(0, 0), wd = a.p.w / 2 + 2.6, yaw = a.yaw, nx = a.p.nx, nz = a.p.nz, parts = [];
    for (const s of [-1, 1]) {
      parts.push(place(paint(capsule(0.5, 8.4, 3, 9), TIMBER, 4), { p: [a.x + nx * wd * s, a.y + 4.2, a.z + nz * wd * s] }));
      parts.push(place(paint(sphere(0.74, 10, 8), '#e8b63a'), { p: [a.x + nx * wd * s, a.y + 9.1, a.z + nz * wd * s] }));
    }
    parts.push(place(paint(box(wd * 2 + 1, 2.2, 0.3), '#f4ecdf'), { p: [a.x, a.y + 7.8, a.z], r: [0, yaw, 0] }));
    // the embroidery: a row of red and black lozenges, top and bottom
    for (let i = -12; i <= 12; i++) for (const q of [-0.84, 0.84]) {
      const L = box(0.5, 0.5, 0.34);
      place(L, { p: [a.x + nx * i * 0.72, a.y + 7.8 + q, a.z + nz * i * 0.72], r: [0, yaw, 0] });
      L.rotateZ(0);
      parts.push(paint(L, i % 2 ? '#c9382c' : '#26222a'));
    }
    B.add(merge(parts));
    const ban = signPlane(wd * 1.3, 1.2, 2, atlas.rows), b2 = signPlane(wd * 1.3, 1.2, 2, atlas.rows);
    place(ban, { p: [a.x - a.p.tx * 0.18, a.y + 7.8, a.z - a.p.tz * 0.18], r: [0, yaw + Math.PI, 0] });
    place(b2, { p: [a.x + a.p.tx * 0.18, a.y + 7.8, a.z + a.p.tz * 0.18], r: [0, yaw, 0] });
    planes.push(ban, b2);
    B.blob(a.x + nx * wd, a.z + nz * wd, 1.5, 0.4); B.blob(a.x - nx * wd, a.z - nz * wd, 1.5, 0.4);
  }
  const signsMesh = new THREE.Mesh(mergeUV(planes), mat('#ffffff', { map: true }));
  signsMesh.material.map = atlas.texture;
  signsMesh.material.needsUpdate = true;
  world.staticGroup.add(signsMesh);

  // up one cable, down the other, a minute end to end
  moveCabins = (time) => {
    cabins.forEach((m, i) => {
      const T = 60, ph = ((time + i * 30) % (2 * T)) / T, t = ph < 1 ? ph : 2 - ph, [x, y, z] = lineAt(0.04 + 0.92 * t), s = ph < 1 ? -3.8 : 3.8;
      m.position.set(x + s, y - 3.1, z);
    });
  };
  moveCabins(0);
}

let moveCabins = null;
export function update(time) { moveCabins?.(time); }

// Once all stands: the lake's mirror, captured from its middle. One capture is enough, nothing here moves but the cabins and the karts, too small in a mirror to miss.
export function ready({ renderer, scene, world, track }) {
  const W = world.waterMat, L = track.def.ground.lake;
  if (!W?.uniforms?.uCapture || !world.ground.water) return;
  const rt = new THREE.WebGLCubeRenderTarget(1024, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  const cam = new THREE.CubeCamera(0.5, 7000, rt);
  cam.position.set(L.x, L.level + 1, L.z);
  scene.add(cam);
  world.ground.water.visible = false;
  cam.update(renderer, scene);
  world.ground.water.visible = true;
  scene.remove(cam);
  W.uniforms.uCapture.value = rt.texture;
  W.uniforms.uCaptureC.value.set(L.x, L.level, L.z);
  W.uniforms.uCaptureR.value = 420;
}
