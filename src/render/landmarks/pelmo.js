// Pelmo d'Inverno: the snow under the Caregón at the end of a winter afternoon. Facts in docs/references/pelmo.md. Placed by u, the fraction of the lap, and d, metres to
// the left of the road's centre, so a retuned road carries its things with it. Scenery only: the little chapel is treated with care, nothing here is ever hit by anything.
import * as THREE from 'three';
import { hash3, lerp, smooth } from '../math.js';
import { blobAnimal } from '../props.js';
import { merge, paint, place, box, sphere, capsule, cylinder, cone, gable, tube, lathe, roundedBox, torus } from '../shapes.js';

const WOOD = '#6a4a33', WOOD_D = '#46322a', WOOD_L = '#8e6c4c', SHINGLE = '#5a5152', STONE = '#8f8a8c', PLASTER = '#e9dfd0', LARCH = '#4b3629', LARCH_L = '#6d4f3b', HAY = '#a8925e', DOLOMIA = '#a8968a', DOLOMIA_D = '#7e7884', SNOW = '#fbfaff', SNOW_S = '#cdd8ee', ORANGE = '#f26b2b', RED = '#d43d33', BLUE = '#2d62b5';
// windows are the lights of the hour: a touch over 1 so they glow against the blue of the shade
const RUBBLE = '#a39a8f', LIT = [1.5, 0.98, 0.5], GLOW = [1.12, 0.74, 0.4];

// Soft noise along one line, 0..1.
const vn = (x, seed = 1) => { const i = Math.floor(x), f = x - i, t = f * f * (3 - 2 * f); return lerp(hash3(i, seed, 3), hash3(i + 1, seed, 3), t); };

// The snow on a roof: a sheet that lies on the slope and thickens toward the ridge in slow humps. It stops short of the eaves in a scalloped lip and thins out at the gables, so the shingles show under it and the roof never reads as one flat white plate.
function snowRoof(w, l, h, rh, over, seed = Math.round(w * 7 + l * 13 + rh * 5), nu = 12, nv = 5) {
  const hw = w / 2, hl = l / 2 + over + 0.02, ex = hw + over, sl = rh / hw, e = h - over * sl, top = h + rh, parts = [];
  for (const s of [-1, 1]) {
    const pos = [], idx = [], k = nv + 1;
    for (let a = 0; a <= nu; a++) {
      const fu = a / nu, gableLip = 1 - smooth(0, 0.05, Math.min(fu, 1 - fu)), lip = 0.03 * vn(fu * 9 + s * 3, seed);
      for (let b = 0; b <= nv; b++) {
        const q = b / nv, t = lerp(lip, 1, q), edge = b === 0;
        // a metre of old snow settled to a good hand: thick at once behind the lip, rolled over the eave and hanging past it in slow scallops, curled down over the gable boards
        const thick = edge ? -0.34 - 0.2 * vn(fu * 7 + s, seed + 3) : (0.42 + 0.26 * vn(fu * 4 + q * 3 + s, seed + 2)) * (1 - 0.35 * q);
        const out = edge ? 0.22 + 0.16 * vn(fu * 5 + s, seed + 5) : b === 1 ? 0.2 : 0;
        const zEnd = gableLip * (edge ? 0.1 : 0.22);
        pos.push(s * ((1 - t) * ex + out), lerp(e, top, t) + 0.03 + thick - gableLip * (edge ? 0 : 0.34), (fu * 2 - 1) * (hl + zEnd) * (0.985 + 0.015 * vn(q * 5, seed + a)));
      }
    }
    for (let a = 0; a < nu; a++) for (let b = 0; b < nv; b++) {
      const i0 = a * k + b, i1 = i0 + 1, i2 = i0 + k, i3 = i2 + 1;
      if (s > 0) idx.push(i0, i1, i2, i1, i3, i2); else idx.push(i0, i2, i1, i1, i2, i3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx); g.computeVertexNormals();
    parts.push(paint(g, SNOW, 0, (x, y, z) => 0.92 + 0.08 * Math.sin(x * 1.3 + z * 0.7 + seed)));
  }
  parts.push(paint(place(capsule(0.2, l + over * 1.2, 3, 7), { p: [0, top + 0.26, 0], r: [Math.PI / 2, 0, 0], s: [1.3, 1, 0.8] }), SNOW));
  return merge(parts);
}

// What a real eave has under it and hanging from it: rafter ends, dark barge boards up the gables, icicles where the snow melts and freezes again.
function eaves(W, L, H, R, over, seed) {
  const parts = [], sl = R / (W / 2), n = Math.round(L / 1.15), e = H - over * sl;
  for (const s of [-1, 1]) {
    for (let i = 0; i <= n; i++) {
      const z = (i / n - 0.5) * (L + over);
      parts.push(paint(place(box(over + 0.3, 0.13, 0.13), { p: [s * (W / 2 + over / 2 - 0.05), H - over * sl * 0.5 - 0.22, z], r: [0, 0, -s * Math.atan(sl)] }), WOOD_D));
    }
    for (let i = 0; i < 9; i++) {
      const len = 0.25 + 0.75 * hash3(i, seed, s + 9);
      if (hash3(i, seed, s + 5) > 0.6) continue;
      parts.push(paint(place(cylinder(0.07, 0.012, len, 4), { p: [s * (W / 2 + over - 0.04), e - 0.14 - len / 2, (i / 8 - 0.5) * (L + over * 1.3)] }), '#dbe4f6'));
    }
    const sx = W / 2 + over, b = Math.hypot(sx, sx * sl);
    for (const z of [L / 2 + over + 0.03, -L / 2 - over - 0.03]) parts.push(paint(place(box(b, 0.3, 0.07), { p: [s * sx / 2, e + (H + R - e) / 2 - 0.1, z], r: [0, 0, -s * Math.atan(sl)] }), WOOD_D));
  }
  return merge(parts);
}

// A window as they are in a thick wall: a stone frame standing proud, the glass set deep behind it, the shutters folded back, a bar of snow on the sill.
function window4(x, y, z, ry, w = 0.95, h = 1.2) {
  const m = [paint(place(box(w + 0.36, h + 0.36, 0.1), { p: [0, 0, 0.02] }), '#c9c2b8'), paint(place(box(w + 0.1, h + 0.1, 0.09), { p: [0, 0, 0.03] }), '#2c2230'), paint(place(box(w, h, 0.08), { p: [0, 0, 0.035] }), GLOW)];
  // curtains drawn to the sides: what makes a lit pane a room
  for (const q of [-1, 1]) m.push(paint(place(box(w * 0.24, h, 0.03), { p: [q * w * 0.36, 0, 0.08] }), '#e8d3b0'));
  m.push(paint(place(box(0.08, h, 0.1), { p: [0, 0, 0.09] }), '#3b2c26'), paint(place(box(w, 0.08, 0.1), { p: [0, h * 0.12, 0.09] }), '#3b2c26'));
  // the reveal: top and sides stand out in front of the glass, so they shade it
  m.push(paint(place(box(w + 0.42, 0.18, 0.34), { p: [0, h / 2 + 0.1, 0.17] }), '#7f776f'));
  for (const q of [-1, 1]) m.push(paint(place(box(0.16, h + 0.2, 0.3), { p: [q * (w / 2 + 0.1), 0, 0.15] }), '#a39b92'), paint(place(box(0.44, h + 0.1, 0.07), { p: [q * (w / 2 + 0.42), 0, 0.09], r: [0, q * 0.25, 0] }), '#553324', 2));
  m.push(paint(place(capsule(0.1, w + 0.16, 2, 5), { p: [0, -h / 2 - 0.14, 0.2], r: [0, 0, Math.PI / 2] }), SNOW));
  return place(merge(m), { p: [x, y, z], r: [0, ry, 0] });
}

// A long balcony of dark larch on brackets, sawn boards with the sky between them, a rail of snow.
function balcony(len, y, z, depth = 1.5, hay = false) {
  const parts = [paint(place(box(len + 0.3, 0.18, depth), { p: [0, y, z + depth / 2] }), WOOD_D)];
  const n = Math.max(4, Math.round(len / 0.62));
  for (let i = 0; i <= n; i++) parts.push(paint(place(box(0.3, 1.05, 0.06), { p: [-len / 2 + (i / n) * len, y + 0.6, z + depth - 0.04] }), i % 2 ? LARCH_L : LARCH));
  for (let i = 0; i <= 3; i++) parts.push(paint(place(box(0.14, 0.14, depth), { p: [-len / 2 + (i / 3) * len, y - 0.15, z + depth / 2] }), LARCH));
  parts.push(paint(place(capsule(0.13, len, 2, 5), { p: [0, y + 1.2, z + depth - 0.04], r: [0, 0, Math.PI / 2] }), SNOW));
  // the racks of the hay: a rod under the eave, the hay hanging from it in tufts that end in a point, shoulder to shoulder, so it reads as one ragged curtain and never as a row of blocks
  if (hay) {
    const m = Math.round(len * 2.6), L = len - 0.5, top = y + 1.82;
    parts.push(paint(place(box(L, 0.16, 0.24), { p: [0, top - 0.06, z + depth * 0.46] }), HAY, 0, () => 0.8));
    for (let i = 0; i < m; i++) {
      const ln = 0.55 + 0.6 * hash3(i, 7, 3), tone = 0.72 + 0.3 * hash3(i, 2, 3);
      parts.push(paint(place(cone(0.3, ln, 4), { p: [-L / 2 + (i / (m - 1)) * L, top - ln / 2, z + depth * 0.46], r: [Math.PI, 0.7 * i, 0] }), HAY, 0, () => tone));
    }
  }
  return merge(parts);
}

// The rifugio: a big stone ground floor, two floors of dark larch with long balconies, a broad shingled roof under a metre of snow, a smoking chimney, skis stuck in the snow by the door.
function rifugio() {
  const parts = [], w = 15, l = 22, h = 8.6, rh = 5.6;
  parts.push(paint(place(box(w + 0.5, 12, l + 0.5), { p: [0, -3.0, 0] }), RUBBLE, 6));
  const { walls, roof } = gable(w, l, h, rh, 1.7);
  parts.push(paint(place(walls, { p: [0, 3, 0] }), WOOD, 4), paint(place(roof, { p: [0, 3, 0] }), SHINGLE, 3));
  parts.push(place(snowRoof(w, l, h, rh, 1.7), { p: [0, 3, 0] }));
  for (const x of [-4.6, -1.6, 1.6, 4.6]) { parts.push(window4(x, 1.6, l / 2 + 0.3, 0, 1.2, 1.5)); parts.push(window4(x, 5.1, l / 2 + 0.05, 0)); parts.push(window4(x, 8.2, l / 2 + 0.05, 0)); }
  for (const z of [-8, -4, 0, 4, 8]) for (const s of [-1, 1]) { parts.push(window4(s * (w / 2 + 0.3), 1.6, z, s * Math.PI / 2, 1.2, 1.5)); parts.push(window4(s * (w / 2 + 0.05), 5.1, z, s * Math.PI / 2)); }
  // the balcony across the front
  parts.push(paint(place(box(w + 0.4, 0.2, 1.8), { p: [0, 3.6, l / 2 + 0.9] }), WOOD_D));
  for (let i = -8; i <= 8; i++) parts.push(paint(place(box(0.34, 1, 0.08), { p: [i * 0.92, 4.2, l / 2 + 1.74] }), i % 2 ? WOOD_L : WOOD));
  parts.push(paint(place(capsule(0.16, w, 2, 5), { p: [0, 4.82, l / 2 + 1.74], r: [0, 0, Math.PI / 2] }), SNOW));
  // the door under its porch
  parts.push(paint(place(box(2, 2.7, 0.2), { p: [0, 0.3, l / 2 + 0.3] }), '#4d2c1e', 2));
  parts.push(paint(place(cylinder(0.2, 0.2, 0.3, 8), { p: [-2.6, 2.2, l / 2 + 0.5], r: [Math.PI / 2, 0, 0] }), LIT));
  // the chimney and what comes out of it
  parts.push(paint(place(box(1.5, 5, 1.5), { p: [3.6, 16, -3] }), STONE, 1), paint(place(box(1.9, 0.3, 1.9), { p: [3.6, 18.6, -3] }), SNOW));
  for (const [dy, r, dx] of [[20, 0.9, 0.1], [21.6, 1.25, 0.8], [23.5, 1.6, 1.8], [25.8, 2, 3.2]]) parts.push(paint(place(sphere(r, 8, 6), { p: [3.6 + dx, dy, -3 - dx * 0.5] }), '#e9e4ee'));
  return merge(parts);
}

// A village house as they stand above Vodo. Four hands, by seed: plaster with a larch top floor and a balcony; all of stone with a wooden gable; a tall ochre house with an arched door; a low one with its barn built on.
function house({ w = 8, l = 10, floors = 2, rh = 4.4, seed = 2, near = true }) {
  const parts = [], fh = 2.9, H = floors * fh, style = seed % 4, tones = ['#e9dfd0', '#dcc7a4', '#d8b9a0', '#d4d0c8'], plaster = tones[(seed >> 2) % 4];
  const W = w + (hash3(seed, 1, 3) - 0.5) * 2, L = l + (hash3(seed, 2, 3) - 0.5) * 2.4, R = rh + (hash3(seed, 3, 3) - 0.3) * 1.6;
  parts.push(paint(place(box(W + 0.3, 9.4, L + 0.3), { p: [0, -4.1, 0] }), RUBBLE, 6));
  const { walls, roof } = gable(W, L, H, R, 1.15);
  // rough lime plaster over rubble on every house, its flakes showing the stone; dressed block is what a town has, not these valleys
  parts.push(paint(walls, style === 1 ? '#b7ab9b' : plaster, 6), paint(roof, SHINGLE, 3), snowRoof(W, L, H, R, 1.15, 31 + seed, near ? 12 : 6, near ? 5 : 3));
  // the gable: boards on all but the stone house's
  const topWood = style !== 2;
  if (topWood) parts.push(paint(place(box(W + 0.12, fh, L + 0.12), { p: [0, H - fh / 2, 0] }), LARCH, 2));
  if (style !== 3) parts.push(paint(place(box(W * 0.62, R * 0.6, 0.12), { p: [0, H + R * 0.3, L / 2 + 0.02] }), LARCH, 2));
  // a stone foot under the plaster, as they have against the wet
  if (style !== 1) parts.push(paint(place(box(W + 0.14, 0.95, L + 0.14), { p: [0, 0.42, 0] }), RUBBLE, 6));
  if (near) {
    parts.push(eaves(W, L, H, R, 1.15, seed));
    // the corners of the old plastered houses are bare stone, big and small in turn
    // the larch floor is laid as a blockbau: the logs cross and stand out at the corners
    if (topWood) for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (let q = 0; q < 8; q++) {
      const y = H - fh + 0.18 + q * 0.34, along = q % 2 === 0;
      parts.push(paint(place(cylinder(0.14, 0.14, 0.9, 5), { p: [sx * (W / 2 + (along ? 0.28 : 0.02)), y, sz * (L / 2 + (along ? 0.02 : 0.28))], r: along ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0] }), LARCH_L));
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (let q = 0; q < 4; q++) {
      const big = q % 2 === 0;
      parts.push(paint(place(box(big ? 0.74 : 0.5, 0.42, big ? 0.5 : 0.74), { p: [sx * (W / 2 - 0.16), 1.25 + q * 0.46, sz * (L / 2 - 0.16)] }), '#a8a2a4'));
    }
    if (style === 0 || style === 1) parts.push(balcony(W - 0.4, H - fh - 0.05, L / 2 + 0.06, 1.4, style === 1));
    if (style === 3) parts.push(place(balcony(L * 0.7, H - fh - 0.05, W / 2 + 0.06, 1.2, true), { r: [0, Math.PI / 2, 0] }));
    // the chimney and its thread of smoke
    parts.push(paint(place(box(0.9, 2.6, 0.9), { p: [W * 0.2, H + R * 0.7, -L * 0.2] }), STONE, 1), paint(place(box(1.2, 0.2, 1.2), { p: [W * 0.2, H + R * 0.7 + 1.35, -L * 0.2] }), SNOW));
  }
  for (let f = 0; f < floors; f++) {
    const y = f * fh + 1.5, wn = W > 8 ? [-W * 0.32, 0, W * 0.32] : [-W * 0.27, W * 0.27];
    for (const x of wn) {
      if (f === 0 && Math.abs(x) < 0.5) continue;
      if (near) parts.push(window4(x, y, L / 2 + 0.04, 0));
      else parts.push(paint(place(box(1, 1.2, 0.1), { p: [x, y, L / 2 + 0.04] }), LIT));
      parts.push(paint(place(box(1, 1.2, 0.1), { p: [x, y, -L / 2 - 0.04] }), LIT));
    }
    for (const z of [-L * 0.25, L * 0.25]) for (const s of [-1, 1]) {
      // the flanks are seen in passing: a frame, the glass, a sill of snow
      if (near) parts.push(window4(s * (W / 2 + 0.04), y, z, (s * Math.PI) / 2));
      else parts.push(paint(place(box(0.1, 1.2, 1), { p: [s * (W / 2 + 0.04), y, z] }), LIT));
    }
  }
  // the door, an arch of stone round it on the old ones
  parts.push(paint(place(box(1.5, 2.3, 0.14), { p: [0, 0.95, L / 2 + 0.05] }), '#4e3122', 2));
  if (style === 2) parts.push(paint(place(box(2.5, 0.34, 0.22), { p: [0, 2.3, L / 2 + 0.08] }), '#b5ada0'), paint(place(box(0.34, 2.2, 0.2), { p: [-1.05, 1.15, L / 2 + 0.08] }), '#b5ada0'), paint(place(box(0.34, 2.2, 0.2), { p: [1.05, 1.15, L / 2 + 0.08] }), '#b5ada0'));
  return merge(parts);
}

// The tabià of these valleys: a stone byre under a hay loft of dark larch, the sun has burnt it almost black. A steep roof far over the walls, deep balconies round the loft with hay on the racks. Never painted.
function tabia({ w = 7.5, l = 9.5, h = 5.8, rh = 4.8, seed = 1, near = true }) {
  const parts = [], tint = 0.9 + 0.22 * hash3(seed, 1, 3), hs = h * 0.42;
  parts.push(paint(place(box(w + 0.5, hs + 9, l + 0.5), { p: [0, hs / 2 - 4.5, 0] }), RUBBLE, 6));
  // the byre's small shuttered openings, deep in the wall: a blank flank at the roadside reads as a box
  if (near) for (const z of [-l * 0.26, l * 0.26]) for (const q of [-1, 1]) parts.push(window4(q * (w / 2 + 0.28), hs * 0.56, z, (q * Math.PI) / 2, 0.62, 0.72));
  // the byre door and two slits
  parts.push(paint(place(box(1.5, 2.1, 0.14), { p: [0, 1.0, l / 2 + 0.28] }), WOOD_D, 2));
  for (const x of [-w * 0.32, w * 0.32]) parts.push(paint(place(box(0.42, 0.7, 0.1), { p: [x, 1.6, l / 2 + 0.27] }), '#241b18'));
  // the loft, in logs, then boards up the gable with air between them
  parts.push(paint(place(box(w + 0.14, h - hs, l + 0.14), { p: [0, hs + (h - hs) / 2, 0] }), LARCH, 4, () => tint));
  const { walls, roof } = gable(w, l, h, rh, 1.5);
  parts.push(paint(walls, LARCH, 2, () => tint * 1.1), paint(roof, SHINGLE, 3), snowRoof(w, l, h, rh, 1.5, 11 + seed, near ? 12 : 7, near ? 5 : 3), near ? eaves(w, l, h, rh, 1.5, seed) : paint(place(box(0.2, 0.2, 0.2), { p: [0, h, 0] }), LARCH));
  for (const z of [l / 2 + 0.05, -l / 2 - 0.05]) for (let i = 0; i < 6; i++) parts.push(paint(place(box(0.12, rh * (1 - Math.abs(i - 2.5) / 3.2), 0.05), { p: [(i - 2.5) * 0.72, h + rh * 0.36 * (1 - Math.abs(i - 2.5) / 3.2), z] }), '#1e1612'));
  // deep balconies, front and side, the hay out to dry
  parts.push(balcony(w + 0.3, hs + 0.3, l / 2 + 0.08, 1.5, true));
  parts.push(place(balcony(l + 0.2, hs + 0.3, w / 2 + 0.08, 1.4, true), { r: [0, Math.PI / 2, 0] }));
  return merge(parts);
}

// A small white chapel with its little shingled spire: the kind every hamlet here has.
function chapel() {
  const parts = [], w = 7, l = 11, h = 5.4, rh = 3.6;
  parts.push(paint(place(box(w + 0.3, 6, l + 0.3), { p: [0, -2.7, 0] }), RUBBLE, 6));
  const { walls, roof } = gable(w, l, h, rh, 0.5);
  parts.push(paint(walls, '#f4eee2', 5), paint(roof, SHINGLE, 3), snowRoof(w, l, h, rh, 0.5));
  parts.push(paint(place(box(2, 3, 0.16), { p: [0, 1.3, l / 2 + 0.05] }), '#5c3b28', 2));
  parts.push(paint(place(cylinder(0.75, 0.75, 0.2, 14), { p: [0, 5.8, l / 2 + 0.05], r: [Math.PI / 2, 0, 0] }), LIT));
  for (const z of [-3, 1, 4]) for (const s of [-1, 1]) parts.push(paint(place(capsule(0.34, 1.1, 2, 7), { p: [s * (w / 2 + 0.02), 3, z], s: [0.2, 1, 1] }), LIT));
  // the belfry on the front gable
  parts.push(paint(place(box(2.2, 3.4, 2.2), { p: [0, 9.8, l / 2 - 2] }), '#f4eee2', 5));
  parts.push(paint(place(capsule(0.5, 1.1, 2, 7), { p: [0, 10.2, l / 2 - 0.88], s: [1, 1, 0.2] }), '#2b2428'));
  parts.push(paint(place(cone(1.8, 4, 8), { p: [0, 13.4, l / 2 - 2], r: [0, Math.PI / 8, 0] }), SNOW_S));
  return merge(parts);
}

// The campanile that says Cadore from any bend: a slim square shaft of dressed stone standing apart from the church, a belfry with paired arches, a tall shingled spire with a dusting of snow.
function campanile(H = 24) {
  const parts = [], c = '#c8c0b2', W = 3.6;
  parts.push(paint(place(box(W + 0.5, 4, W + 0.5), { p: [0, 0, 0] }), STONE, 1));
  parts.push(paint(place(box(W, H, W), { p: [0, H / 2, 0] }), c, 1));
  for (const y of [H * 0.33, H * 0.62]) parts.push(paint(place(box(W + 0.24, 0.24, W + 0.24), { p: [0, y, 0] }), '#b0a89a'));
  parts.push(paint(place(box(W + 0.2, 4.2, W + 0.2), { p: [0, H + 1.9, 0] }), '#d4ccbe'));
  for (const q of [0, 1, 2, 3]) {
    const a = (q * Math.PI) / 2, g = [];
    for (const x of [-0.72, 0.72]) g.push(paint(place(capsule(0.48, 1.7, 2, 8), { p: [x, H + 1.9, W / 2 + 0.1], s: [1, 1, 0.12] }), '#231d20'));
    parts.push(place(merge(g), { r: [0, a, 0] }));
  }
  parts.push(paint(place(box(W + 0.6, 0.3, W + 0.6), { p: [0, H + 4.1, 0] }), '#a89f92'));
  parts.push(paint(place(cone(W * 0.74, 9, 4), { p: [0, H + 8.7, 0], r: [0, Math.PI / 4, 0] }), SHINGLE, 3));
  for (const s of [-1, 1]) parts.push(paint(place(capsule(0.2, W, 2, 5), { p: [0, H + 4.34, s * (W / 2 + 0.16)], r: [0, 0, Math.PI / 2] }), SNOW), paint(place(capsule(0.2, W, 2, 5), { p: [s * (W / 2 + 0.16), H + 4.34, 0], r: [Math.PI / 2, 0, 0] }), SNOW));
  parts.push(paint(place(capsule(0.1, 1.5, 2, 5), { p: [0, H + 13.4, 0] }), '#3b3438'));
  return merge(parts);
}

// A round local out on the snow: coat, scarf, bobble hat, ears, a real face. Faces +z, feet at y = 0.
function folk({ fur = '#9a6b43', coat = '#2d62b5', scarf = RED, hat = RED, arms = 0.5, skates = false }) {
  const parts = [paint(place(capsule(0.46, 0.5, 3, 10), { p: [0, 0.82, 0], s: [1, 1.02, 0.92] }), coat)];
  parts.push(paint(place(sphere(0.42, 12, 9), { p: [0, 1.62, 0.04] }), fur), paint(place(sphere(0.25, 9, 7), { p: [0, 1.52, 0.33], s: [1, 0.8, 0.7] }), '#f0e6d8'));
  for (const s of [-1, 1]) {
    parts.push(paint(place(sphere(0.13, 7, 5), { p: [s * 0.32, 1.98, 0.02] }), fur));
    parts.push(paint(place(sphere(0.085, 7, 5), { p: [s * 0.17, 1.7, 0.39] }), '#fbfaff'), paint(place(sphere(0.05, 6, 4), { p: [s * 0.17, 1.71, 0.46] }), '#1e1a22'));
    // an arm: out for balance on skates, or by the side
    parts.push(paint(place(capsule(0.12, 0.5, 2, 6), { p: [s * (0.46 + arms * 0.26), 1.08 + arms * 0.1, 0.02], r: [0, 0, s * (0.35 + arms * 0.85)] }), coat), paint(place(sphere(0.12, 6, 5), { p: [s * (0.56 + arms * 0.55), 0.9 + arms * 0.38, 0.03] }), scarf));
    parts.push(paint(place(capsule(0.15, 0.26, 2, 6), { p: [s * 0.2, 0.26, 0] }), '#2d2a34'), paint(place(sphere(0.17, 7, 5), { p: [s * 0.2, 0.09, 0.08], s: [1, 0.6, 1.5] }), skates ? '#efe9dd' : '#3b2a24'));
    if (skates) parts.push(paint(place(box(0.05, 0.05, 0.56), { p: [s * 0.2, 0.01, 0.08] }), '#c9d4e6'));
  }
  parts.push(paint(place(torus(0.3, 0.1, 5, 10), { p: [0, 1.28, 0.03], r: [Math.PI / 2, 0, 0] }), scarf), paint(place(roundedBox(0.2, 0.42, 0.08, 0.02, 1), { p: [0.2, 1.03, 0.36], r: [0.14, 0, 0.1] }), scarf));
  parts.push(paint(place(sphere(0.38, 9, 6), { p: [0, 1.88, 0.02], s: [1, 0.66, 1] }), hat), paint(place(sphere(0.14, 6, 4), { p: [0, 2.17, 0.02] }), SNOW), paint(place(torus(0.34, 0.06, 4, 10), { p: [0, 1.75, 0.02], r: [Math.PI / 2, 0, 0] }), SNOW));
  return merge(parts);
}

// A block of dolomia as the walls here break into: dead level beds of ochre and grey, a ledge of snow on each bed, a cap of snow on top. Faces +z.
function rockFace(w, h, d, seed = 3) {
  const parts = [], beds = Math.max(3, Math.round(h / 1.25)), bh = h / beds;
  for (let i = 0; i < beds; i++) {
    const inset = 0.45 * hash3(i, seed, 3), W = w * (1 - 0.1 * hash3(i, seed, 5)) - inset, D = d - inset * 2, y = i * bh + bh / 2, dx = (hash3(i, seed, 7) - 0.5) * 0.9, tone = hash3(i, seed, 11);
    parts.push(paint(place(roundedBox(W, bh * 1.06, D, 0.28, 1), { p: [dx, y, 0] }), tone > 0.5 ? DOLOMIA : DOLOMIA_D, 0, (x, q) => 0.88 + 0.18 * Math.sin(q * 3.1 + x * 0.2 + seed)));
    if (i % 2) parts.push(paint(place(roundedBox(W * (0.42 + 0.5 * hash3(i, seed, 13)), 0.14, 0.8, 0.06, 1), { p: [dx + (hash3(i, seed, 17) - 0.5) * w * 0.2, i * bh + bh + 0.02, D / 2 - 0.3] }), SNOW));
  }
  parts.push(paint(place(sphere(1, 12, 7), { p: [0, h + 0.1, 0], s: [w * 0.52, 0.7, d * 0.56] }), SNOW));
  return merge(parts);
}

// A loose block on the white, half buried, a drift against it. Its blob of shade is the landmark's to add.
function boulder(r, seed = 1) {
  const g = new THREE.IcosahedronGeometry(1, 1), P = g.attributes.position;
  for (let i = 0; i < P.count; i++) { const k = 1 + 0.2 * (hash3(Math.round(P.getX(i) * 9), Math.round(P.getY(i) * 9), seed) - 0.5); P.setXYZ(i, P.getX(i) * k * r * 1.2, Math.max(P.getY(i), -0.3) * k * r * 0.8, P.getZ(i) * k * r); }
  g.computeVertexNormals();
  return merge([paint(g, DOLOMIA_D, 0, (x, y) => 0.9 + 0.18 * Math.sin((y * 4) / r + seed)), paint(place(sphere(r * 0.62, 9, 6), { p: [0.1 * r, r * 0.68, 0], s: [1, 0.26, 0.9] }), SNOW), paint(place(sphere(r * 1.1, 9, 6), { p: [0, -r * 0.16, r * 0.3], s: [1.2, 0.26, 0.8] }), SNOW)]);
}

// A rail fence as they run across the fields: crooked larch posts, three long rails, snow on the top one. Faces +z, centred.
// A capitello: the little roadside shrine of these valleys, a plastered pier with a niche, a lamp in it, a shingled roof under the snow.
function capitello() {
  const { walls, roof } = gable(1.5, 1.3, 2.6, 0.75, 0.4);
  return merge([
    paint(place(box(1.9, 0.5, 1.7), { p: [0, 0.2, 0] }), STONE, 1), paint(walls, '#e6dccb', 6), paint(roof, SHINGLE, 3), snowRoof(1.5, 1.3, 2.6, 0.75, 0.4, 7, 6, 3),
    paint(place(box(0.86, 1.1, 0.1), { p: [0, 1.75, 0.65] }), '#3a4a78'), paint(place(sphere(0.12, 6, 4), { p: [0, 1.45, 0.7] }), LIT),
    paint(place(box(0.14, 0.72, 0.06), { p: [0, 1.82, 0.72] }), '#d8c8a8'), paint(place(box(0.42, 0.1, 0.06), { p: [0, 2, 0.72] }), '#d8c8a8'),
    paint(place(box(1.04, 0.09, 0.2), { p: [0, 1.2, 0.68] }), SNOW),
  ]);
}

// A crucifix on a larch post, under its own small pitched roof, at a field's corner.
function crucifix() {
  return merge([
    paint(place(box(0.2, 3.6, 0.2), { p: [0, 1.75, 0] }), WOOD_D, 2), paint(place(box(1.5, 0.15, 0.13), { p: [0, 2.72, 0.02] }), WOOD_D),
    paint(place(capsule(0.06, 0.8, 2, 5), { p: [0, 2.35, 0.16] }), '#c9b08a'), paint(place(sphere(0.1, 6, 5), { p: [0, 2.86, 0.17] }), '#c9b08a'),
    paint(place(box(1.2, 0.05, 0.6), { p: [-0.42, 3.42, 0], r: [0, 0, 0.42] }), SHINGLE), paint(place(box(1.2, 0.05, 0.6), { p: [0.42, 3.42, 0], r: [0, 0, -0.42] }), SHINGLE),
    paint(place(box(1.1, 0.12, 0.54), { p: [-0.4, 3.51, 0], r: [0, 0, 0.42] }), SNOW), paint(place(box(1.1, 0.12, 0.54), { p: [0.4, 3.51, 0], r: [0, 0, -0.42] }), SNOW),
  ]);
}

// Bare alder and willow poking through the white: the only thing that grows along a winter field's ditch.
function shrub(seed) {
  const parts = [], m = 5 + (seed % 3);
  for (let i = 0; i < m; i++) {
    const a = hash3(i, seed, 3) * 6.28, lean = 0.12 + 0.3 * hash3(i, seed, 5), h = 0.7 + 1.2 * hash3(i, seed, 7);
    parts.push(paint(place(cylinder(0.012, 0.04, h, 3), { p: [Math.cos(a) * lean * h * 0.5, h / 2 - 0.05, Math.sin(a) * lean * h * 0.5], r: [Math.sin(a) * lean, 0, -Math.cos(a) * lean] }), i % 2 ? '#6d4438' : '#4d3a38'));
  }
  return merge(parts);
}

// A fan snow gun on its tower, as every Dolomite piste has: yellow drum, grey mast, cable down the snow.
function snowGun() {
  return merge([
    paint(place(cylinder(0.08, 0.13, 3.6, 6), { p: [0, 1.75, 0] }), '#7c8090'), paint(place(box(0.9, 0.2, 0.9), { p: [0, 0.05, 0] }), '#5e6270'),
    paint(place(cylinder(0.56, 0.56, 0.9, 12), { p: [0, 3.75, 0.1], r: [Math.PI / 2 - 0.3, 0, 0] }), '#e9c423'),
    paint(place(cylinder(0.44, 0.44, 0.92, 12), { p: [0, 3.75, 0.1], r: [Math.PI / 2 - 0.3, 0, 0] }), '#27283a'),
    paint(place(sphere(0.3, 8, 6), { p: [0, 4.35, 0.26], s: [1.5, 0.45, 1.2] }), SNOW),
  ]);
}

// A rack of hay under its little roof in the field, the kind that stands alone all winter.
function hayRack() {
  const parts = [];
  for (const x of [-2.6, 2.6]) parts.push(paint(place(box(0.2, 3.4, 0.2), { p: [x, 1.7, 0] }), WOOD_D), paint(place(box(0.5, 0.14, 0.5), { p: [x, 3.3, 0] }), WOOD));
  for (const y of [0.8, 1.5, 2.2]) parts.push(paint(place(box(5.4, 0.1, 0.1), { p: [0, y, 0] }), WOOD_L));
  parts.push(paint(place(box(4.8, 1.7, 0.42), { p: [0, 1.65, 0] }), HAY, 0, (x, y) => 0.84 + 0.22 * hash3(Math.round(x * 2), Math.round(y * 3), 3)));
  const { roof } = gable(1.4, 6, 3.4, 0.7, 0.3);
  parts.push(place(paint(roof, SHINGLE, 3), { r: [0, Math.PI / 2, 0] }), place(snowRoof(1.4, 6, 3.4, 0.7, 0.3), { r: [0, Math.PI / 2, 0] }));
  return merge(parts);
}

// The lift's two station huts and pylons. The chairs move: see build.
function pylon(h = 11) {
  const parts = [paint(place(cylinder(0.32, 0.42, h, 8), { p: [0, h / 2, 0] }), '#c2c6d0'), paint(place(cylinder(0.75, 0.9, 0.5, 8), { p: [0, 0.2, 0] }), SNOW)];
  parts.push(paint(place(box(5.2, 0.34, 0.46), { p: [0, h + 0.1, 0] }), '#d9b23f'));
  for (const s of [-1, 1]) {
    parts.push(paint(place(box(0.4, 0.6, 1.8), { p: [s * 2.4, h - 0.1, 0] }), '#555868'));
    for (const q of [-1, 1]) parts.push(paint(place(cylinder(0.2, 0.2, 0.2, 8), { p: [s * 2.4, h - 0.3, q * 0.7], r: [0, 0, Math.PI / 2] }), '#262833'));
  }
  return merge(parts);
}

function station() {
  const parts = [], { walls, roof } = gable(9, 11, 4.6, 2.6, 1);
  parts.push(paint(place(box(9.3, 9, 11.3), { p: [0, -4, 0] }), RUBBLE, 6));
  parts.push(paint(walls, WOOD, 2), paint(roof, SHINGLE, 3), snowRoof(9, 11, 4.6, 2.6, 1));
  for (const z of [-3, 0, 3]) for (const s of [-1, 1]) parts.push(window4(s * 4.56, 2.6, z, s * Math.PI / 2));
  parts.push(paint(place(cylinder(3.0, 3.0, 0.5, 16), { p: [0, 8.2, 0] }), '#d9b23f'));
  parts.push(paint(place(cylinder(0.5, 0.7, 3.2, 8), { p: [0, 7.4, 0] }), '#c2c6d0'));
  return merge(parts);
}

// A chair for two, with or without a little passenger on it: scarf, bobble hat.
function chair(rider) {
  const parts = [paint(place(box(0.14, 2.5, 0.14), { p: [0, -1.2, 0] }), '#555868'), paint(place(roundedBox(2.2, 0.26, 0.9, 0.1, 1), { p: [0, -2.5, 0] }), RED), paint(place(roundedBox(2.2, 0.9, 0.2, 0.08, 1), { p: [0, -2, -0.4] }), RED)];
  parts.push(paint(tube([[-1.05, -2.3, 0.45], [-1.05, -1.6, 0.6], [1.05, -1.6, 0.6], [1.05, -2.3, 0.45]], 0.05, 4), '#c2c6d0'));
  if (rider) for (const [x, c, hat] of rider) {
    const a = blobAnimal(c, 0.62, c); place(a, { p: [x, -2.52, 0.04] }); parts.push(a);
    parts.push(paint(place(sphere(0.24, 7, 5), { p: [x, -1.3, 0.1], s: [1, 0.7, 1] }), hat));
  }
  return merge(parts);
}

// Avalanche fence: a timber grid on the slope, leaning out of it.
function snowFence(len = 9) {
  const parts = [];
  for (const x of [-len / 2, 0, len / 2]) parts.push(paint(place(cylinder(0.12, 0.16, 3.4, 5), { p: [x, 1.5, -0.2], r: [-0.34, 0, 0] }), WOOD_D));
  for (const y of [0.7, 1.4, 2.1, 2.8]) parts.push(paint(place(box(len + 0.8, 0.2, 0.1), { p: [0, y, -0.3 + (y - 1.5) * 0.34] }), WOOD_L));
  parts.push(paint(place(capsule(0.34, len * 0.8, 3, 7), { p: [0, 3.02, 0.14], r: [0, 0, Math.PI / 2], s: [1, 0.7, 1] }), SNOW));
  return merge(parts);
}

// A wooden sled, the old kind: two curled runners, slats.
function sled() {
  const parts = [];
  for (const s of [-1, 1]) parts.push(paint(tube([[s * 0.42, 0.42, 1.3], [s * 0.42, 0.14, 0.9], [s * 0.42, 0.04, 0], [s * 0.42, 0.04, -0.9], [s * 0.42, 0.1, -1.05]], 0.05, 4), WOOD_D));
  for (const z of [-0.8, -0.35, 0.1, 0.55]) parts.push(paint(place(box(0.92, 0.07, 0.34), { p: [0, 0.42, z] }), z % 2 ? WOOD_L : '#c49a68'));
  for (const z of [-0.6, 0.4]) for (const s of [-1, 1]) parts.push(paint(place(box(0.07, 0.38, 0.07), { p: [s * 0.42, 0.22, z] }), WOOD_D));
  return merge(parts);
}

function woodPile(n = 18) {
  const parts = [], rows = Math.ceil(Math.sqrt(n));
  let c = 0;
  for (let r = 0; r < rows; r++) for (let i = 0; i < rows - r && c < n; i++, c++) {
    const log = cylinder(0.3, 0.3, 3.2, 7); log.rotateX(Math.PI / 2);
    place(log, { p: [(i - (rows - r - 1) / 2) * 0.62, 0.3 + r * 0.53, 0] });
    parts.push(paint(log, hash3(i, r, 3) < 0.5 ? '#a98250' : '#96703e'));
    const end = cylinder(0.26, 0.26, 0.06, 7); end.rotateX(Math.PI / 2);
    place(end, { p: [(i - (rows - r - 1) / 2) * 0.62, 0.3 + r * 0.53, 1.62] });
    parts.push(paint(end, '#e8cfa0'));
  }
  parts.push(paint(place(capsule(0.34, rows * 0.5, 3, 7), { p: [0, 0.2 + rows * 0.53, 0], r: [Math.PI / 2, 0, 0], s: [1.8, 0.7, 1] }), SNOW));
  return merge(parts);
}

// A snowman: he has a carrot, a scarf and an opinion.
function snowman(scarf = RED) {
  const parts = [paint(place(sphere(1, 12, 9), { p: [0, 0.8, 0] }), SNOW), paint(place(sphere(0.72, 12, 9), { p: [0, 1.95, 0] }), SNOW), paint(place(sphere(0.5, 10, 8), { p: [0, 2.85, 0] }), SNOW)];
  parts.push(paint(place(cone(0.1, 0.62, 6), { p: [0, 2.85, 0.68], r: [Math.PI / 2, 0, 0] }), ORANGE));
  for (const s of [-1, 1]) parts.push(paint(place(sphere(0.07, 6, 4), { p: [s * 0.2, 3, 0.44] }), '#1e1a22'));
  parts.push(paint(place(torus(0.42, 0.12, 5, 12), { p: [0, 2.46, 0], r: [Math.PI / 2, 0, 0] }), scarf));
  parts.push(paint(place(cylinder(0.46, 0.5, 0.5, 10), { p: [0, 3.36, -0.02], r: [-0.1, 0, 0.06] }), '#2a2630'), paint(place(cylinder(0.66, 0.66, 0.06, 12), { p: [0, 3.1, 0.0], r: [-0.1, 0, 0.06] }), '#2a2630'));
  for (const s of [-1, 1]) parts.push(paint(tube([[s * 0.6, 2.05, 0], [s * 1.2, 2.4, 0.1], [s * 1.5, 2.8, 0.1]], 0.05, 4), WOOD_D));
  return merge(parts);
}

// The Pelmetto boulder, as it lies under the Pelmetto: a huge pale slab of Dolomia tilted out of the snow, its face crossed by a line of three-toed prints. A cartoon: the real ones are small, and an hour's walk from any road.
function pelmettoBoulder() {
  const parts = [], W = 19, H = 12;
  // one lump of limestone, no box: a grid bent over a rough outline, thickest in the middle, closing on itself at the rim. The bedding is painted (kind 9), and the snow lies where it faces the sky.
  const faceZ = (x, y) => 0.32 * Math.sin(x * 0.55 + y * 0.3) + 0.2 * Math.sin(y * 1.1 - x * 0.27 + 1.3) + 0.11 * Math.sin(x * 1.7 + y * 1.9);
  const NX = 20, NY = 14, pos = [], idx = [], k = NY + 1;
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    for (let a = 0; a <= NX; a++) for (let b = 0; b <= NY; b++) {
      const u = a / NX * 2 - 1, v = b / NY * 2 - 1, an = Math.atan2(v, u), crag = 1 + 0.07 * Math.sin(an * 5 + 0.7) + 0.05 * Math.sin(an * 9 + 2.1) + 0.035 * Math.sin(an * 17);
      // the square of the grid onto a rough rounded slab: the corners pull in, the long edges keep their run
      const x = u * Math.sqrt(1 - 0.5 * v * v) * 1.2 * crag * W / 2, y = v * Math.sqrt(1 - 0.5 * u * u) * 1.2 * crag * H / 2, r = Math.max(Math.abs(u), Math.abs(v));
      pos.push(x, y, side * (1.85 * Math.sqrt(Math.max(0, 1 - r ** 6)) + (side > 0 ? faceZ(x, y) * (1 - r ** 4) : 0)));
    }
    for (let a = 0; a < NX; a++) for (let b = 0; b < NY; b++) {
      const i0 = base + a * k + b, i1 = i0 + 1, i2 = i0 + k, i3 = i2 + 1;
      if (side > 0) idx.push(i0, i2, i1, i1, i2, i3); else idx.push(i0, i1, i2, i1, i3, i2);
    }
  }
  const body = new THREE.BufferGeometry();
  body.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  body.setIndex(idx); body.computeVertexNormals();
  paint(body, '#cfc3b6', 9);
  { const P = body.attributes.position, C = body.attributes.color, K = body.attributes.aPaint, sn = [0.96, 0.95, 1];
    for (let q = 0; q < P.count; q++) { const x = P.getX(q), y = P.getY(q); if (y > 3.9 + 0.8 * Math.sin(x * 0.7) + 0.5 * Math.sin(x * 1.9 + 1)) { C.setXYZ(q, sn[0], sn[1], sn[2]); K.setX(q, 0); } } }
  parts.push(body);
  // the prints: a pad and three fat toes, walking up the slab
  const print = (x, y, s, a) => {
    const P = [paint(place(sphere(0.8, 10, 7), { p: [0, -0.1, 0], s: [1, 1.05, 0.18] }), '#6e6170')];
    for (const q of [-1, 0, 1]) P.push(paint(place(capsule(0.3, 0.86, 3, 7), { p: [q * 0.68, 1.02 - Math.abs(q) * 0.16, 0], r: [0, 0, -q * 0.48], s: [1, 1, 0.3] }), '#6e6170'));
    for (const q of [-1, 0, 1]) P.push(paint(place(cone(0.17, 0.42, 6), { p: [q * 1.02, 1.74 - Math.abs(q) * 0.3, 0], r: [0, 0, -q * 0.48], s: [1, 1, 0.3] }), '#57495a'));
    const g = merge(P); return place(g, { p: [x, y, 1.9 + faceZ(x, y)], r: [0, 0, a], s });
  };
  for (const [x, y, s, a] of [[-7, -3.6, 0.95, -0.5], [-4.4, -1.2, 0.95, -0.2], [-1.1, -2.4, 1.05, -0.55], [1.6, 0.1, 1.05, -0.2], [4.8, -0.8, 1.1, -0.55], [6.7, 2.4, 1.1, -0.1]]) parts.push(print(x, y, s, a));
  return merge(parts);
}

// A friendly wooden cut out of the little biped that walked there, for the children: round, green, proud of its footprints.
function dino() {
  const parts = [], G = '#6fae5a', D = '#4c8a4a';
  parts.push(paint(place(sphere(1.15, 12, 9), { p: [0, 2.0, 0], s: [1, 0.95, 1.35] }), G));
  parts.push(paint(tube([[0, 2, -1.1], [0, 1.5, -2.2], [0, 1.1, -3.2], [0, 0.95, -3.9]], [0.7, 0.5, 0.3, 0.08], 8), G));
  parts.push(paint(tube([[0, 2.7, 0.9], [0, 3.6, 1.4], [0, 4.2, 1.6]], [0.68, 0.56, 0.5], 8), G));
  parts.push(paint(place(sphere(0.76, 12, 9), { p: [0, 4.5, 1.9], s: [1, 0.9, 1.2] }), G));
  for (const s of [-1, 1]) {
    parts.push(paint(place(sphere(0.25, 9, 7), { p: [s * 0.44, 4.84, 2.34] }), '#ffffff'), paint(place(sphere(0.13, 7, 5), { p: [s * 0.46, 4.86, 2.54] }), '#1e1a22'));
    parts.push(paint(place(capsule(0.34, 1.3, 3, 7), { p: [s * 0.74, 0.92, 0.1] }), D));
    parts.push(paint(place(sphere(0.46, 8, 6), { p: [s * 0.74, 0.18, 0.28], s: [1, 0.45, 1.5] }), D));
    parts.push(paint(place(capsule(0.14, 0.5, 2, 5), { p: [s * 1.02, 2.5, 0.88], r: [0.8, 0, s * -0.3] }), D));
  }
  for (const z of [-2.6, -1.6, -0.5, 0.5]) parts.push(paint(place(cone(0.22, 0.56, 5), { p: [0, 2.6 + (z > -1 ? 0.5 : -0.4 + z * 0.14), z], s: [0.5, 1, 1] }), '#e6a744'));
  parts.push(paint(place(torus(0.56, 0.13, 5, 10), { p: [0, 3.2, 1.28], r: [Math.PI / 2 - 0.5, 0, 0] }), RED));
  return merge(parts);
}

// The little fishing hut on the ice and the bench beside it.
function iceHut() {
  const parts = [], { walls, roof } = gable(3.2, 3.6, 2.2, 1.4, 0.4);
  parts.push(paint(walls, LARCH, 2), paint(roof, SHINGLE, 3), snowRoof(3.2, 3.6, 2.2, 1.4, 0.4));
  parts.push(paint(place(box(1, 1.8, 0.1), { p: [0, 0.9, 1.84] }), '#3a2a26'), paint(place(box(0.7, 0.7, 0.1), { p: [1.63, 1.4, 0], r: [0, Math.PI / 2, 0] }), LIT));
  return merge(parts);
}

// A groomer resting after its shift: round, red, under a dab of snow. Not the kart: it has no driver and its blade is down.
function groomer() {
  const parts = [paint(place(roundedBox(3.8, 2, 5.2, 0.5, 2), { p: [0, 1.9, 0] }), RED), paint(place(roundedBox(3, 1.6, 2.6, 0.4, 2), { p: [0, 3.5, 0.4] }), '#28324a'), paint(place(roundedBox(3.3, 0.22, 3, 0.1, 1), { p: [0, 4.4, 0.4] }), SNOW)];
  for (const s of [-1, 1]) {
    parts.push(paint(place(roundedBox(1, 1.5, 6.3, 0.6, 2), { p: [s * 2.1, 0.74, 0] }), '#25252e'));
    for (const z of [-2.1, -0.7, 0.7, 2.1]) parts.push(paint(place(cylinder(0.5, 0.5, 1.04, 10), { p: [s * 2.1, 0.74, z], r: [0, 0, Math.PI / 2] }), '#6e7180'));
  }
  parts.push(paint(place(roundedBox(5.2, 1.4, 0.34, 0.1, 1), { p: [0, 0.7, 3.9] }), '#e8e4d8'));
  parts.push(paint(place(roundedBox(3.5, 0.5, 1.4, 0.2, 1), { p: [0, 0.6, -3.5] }), '#555868'));
  for (const s of [-1, 1]) parts.push(paint(place(cylinder(0.24, 0.24, 0.16, 10), { p: [s * 1, 2.2, 2.62], r: [Math.PI / 2, 0, 0] }), [1.6, 1.3, 0.8]));
  return merge(parts);
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
  let nv = 0, ni = 0;
  for (const g of list) { nv += g.attributes.position.count; ni += g.index.count; }
  const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), UV = new Float32Array(nv * 2), X = new Uint32Array(ni);
  let v = 0, x = 0;
  for (const g of list) {
    const c = g.attributes.position.count;
    P.set(g.attributes.position.array, v * 3); N.set(g.attributes.normal.array, v * 3); UV.set(g.attributes.uv.array, v * 2);
    for (let i = 0; i < g.index.count; i++) X[x + i] = g.index.getX(i) + v;
    x += g.index.count; v += c;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(P, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(UV, 2));
  out.setIndex(new THREE.BufferAttribute(X, 1));
  return out;
}

// The ice, painted once, into the ground (world.groundPaint), so there is one surface and no sheet for the snow to come through. Blue where it is clear, milky where it froze slowly, the sky's rose lying on it toward the Pelmo, long skate lines going round, cracks that run straight and fork; its edge is alpha, snow blown over in tongues. u, v: the rect, shore near radius 0.42.
function lakeTexture() {
  const S = 1024, cv = document.createElement('canvas'), g = cv.getContext('2d');
  cv.width = cv.height = S;
  const rnd = (a, b = 3) => hash3(a, b, 77), C = S / 2;
  g.fillStyle = '#7fafcb'; g.fillRect(0, 0, S, S);
  // milky and clear, in big soft shapes
  for (let i = 0; i < 70; i++) {
    const x = rnd(i, 1) * S, y = rnd(i, 2) * S, r = 40 + 130 * rnd(i, 4), q = g.createRadialGradient(x, y, 0, x, y, r), c = rnd(i, 5) < 0.5 ? '52,96,140' : '200,226,238';
    q.addColorStop(0, `rgba(${c},${0.1 + 0.2 * rnd(i, 6)})`); q.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = q; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // the mountains and the sky lying on it: a long rose reflection, and pale streaks under it as a polished surface has
  const refl = g.createLinearGradient(0, 0, 0, S * 0.8);
  refl.addColorStop(0, 'rgba(255,186,168,0.62)'); refl.addColorStop(0.55, 'rgba(240,190,206,0.3)'); refl.addColorStop(1, 'rgba(240,190,200,0)');
  g.fillStyle = refl; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 40; i++) { const x = rnd(i, 30) * S, w = 8 + 40 * rnd(i, 31); g.fillStyle = `rgba(255,236,226,${0.05 + 0.1 * rnd(i, 32)})`; g.fillRect(x, 0, w, S * (0.3 + 0.5 * rnd(i, 33))); }
  // cracks
  g.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    let x = rnd(i, 7) * S, y = rnd(i, 8) * S, a = rnd(i, 9) * 6.28;
    const steps = 4 + Math.floor(rnd(i, 10) * 6);
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < steps; k++) { a += (rnd(i * 13 + k, 11) - 0.5) * 0.9; x += Math.cos(a) * 34; y += Math.sin(a) * 34; g.lineTo(x, y); }
    g.strokeStyle = 'rgba(232,246,252,0.8)'; g.lineWidth = 1.6; g.stroke();
    g.strokeStyle = 'rgba(40,76,116,0.28)'; g.lineWidth = 3.4; g.stroke();
  }
  // skate lines: long arcs round the middle
  for (let i = 0; i < 90; i++) {
    const r = 70 + 330 * rnd(i, 12), a0 = rnd(i, 13) * 6.28, da = 0.3 + 1.1 * rnd(i, 14), ox = C + (rnd(i, 15) - 0.5) * 120, oy = C + (rnd(i, 16) - 0.5) * 120;
    g.beginPath(); g.arc(ox, oy, r, a0, a0 + da);
    g.strokeStyle = `rgba(238,246,252,${0.16 + 0.34 * rnd(i, 17)})`; g.lineWidth = 0.8 + 1.2 * rnd(i, 18); g.stroke();
  }
  // the shore and the blown snow are holes in the paint: the ground's own snow shows through them, with its drifts, and no edge is ever drawn
  g.globalCompositeOperation = 'destination-in';
  const rim = g.createRadialGradient(C, C, C * 0.62, C, C, C * 0.86);
  rim.addColorStop(0, 'rgba(0,0,0,1)'); rim.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = rim; g.fillRect(0, 0, S, S);
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 90; i++) {
    const a = rnd(i, 40) * 6.283, near = i < 60, rr = near ? C * (0.58 + 0.22 * rnd(i, 41)) : C * 0.62 * Math.sqrt(rnd(i, 42)), x = C + Math.cos(a) * rr, y = C + Math.sin(a) * rr, r = near ? 22 + 60 * rnd(i, 21) : 10 + 28 * rnd(i, 21);
    g.save(); g.translate(x, y); g.rotate(0.5 + 0.3 * rnd(i, 22)); g.scale(2.8, 0.5);
    const q = g.createRadialGradient(0, 0, 0, 0, 0, r), o = near ? 0.9 : 0.55;
    q.addColorStop(0, `rgba(0,0,0,${o})`); q.addColorStop(0.6, `rgba(0,0,0,${o * 0.45})`); q.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = q; g.beginPath(); g.arc(0, 0, r, 0, 6.3); g.fill(); g.restore();
  }
  g.globalCompositeOperation = 'source-over';
  return cv;
}

// The lift: from the valley station over the road and up to the top of the sweepers. In metres of world, -z is the Pelmo.
const LIFT_A = [-170, -70], LIFT_B = [190, -262], LIFT_SEP = 4.6, LIFT_H = 10.5;
const LAKE = { x: 497, z: -203, r: 44 };

let liftState = null, skaters = null;

export function plan({ track, terrain, world }) {
  // the ice goes into the ground's own paint: one surface, nothing for the terrain to come through
  if (typeof document !== 'undefined') { const q = LAKE.r + 14; world.groundPaint = { canvas: lakeTexture(), rect: [LAKE.x - q, LAKE.z - q, LAKE.x + q, LAKE.z + q] }; }
  const P = (u) => track.pointAt(u), keep = world.keepOut;
  const add = (u, r, cover, kinds) => { const p = P(u); world.groves.push({ x: p.x, z: p.z, r, cover, kinds }); };
  const clearAt = (x, z, r, cover = -1.3) => world.groves.push({ x, z, r, cover });
  // the throne stands at the end of the start straight: no wood stands in that line, out to where the belts of the painting take over
  clearAt(0, -250, 62, -0.9); clearAt(0, -360, 70, -0.9); clearAt(40, -500, 170); clearAt(40, -720, 220); clearAt(40, -960, 260);
  // the rifugio's fields, the hamlet's fields
  add(0.0, 110, -1.2); add(0.03, 90, -1); add(0.95, 110, -1.1); add(0.9, 100, -1.1); add(0.86, 90, -0.8);
  // the white slope over the balcony, bare, and what it looks out on, open
  clearAt(250, -500, 170); clearAt(170, -470, 110); clearAt(300, -430, 90);
  add(0.3, 80, -0.8); clearAt(200, -330, 120, -0.6); clearAt(350, -180, 110, -0.6);
  // the piste, a lane cut through the wood; the bowl; the lake
  add(0.43, 70, -1); add(0.47, 70, -1); add(0.5, 70, -1); add(0.53, 90, -1); add(0.57, 90, -0.9);
  clearAt(LAKE.x, LAKE.z, 105); add(0.65, 90, -1); add(0.69, 80, -0.9);
  // the boulder's clearing and the sled run
  add(0.735, 70, -0.8); add(0.795, 80, -0.9); clearAt(320, 60, 90, -0.8);
  // the wood is thick by the sweepers: firs close on both sides, then the top bend opens at the Pelmo
  add(0.13, 110, 0.5, [['fir', 5], ['spruce', 5]]); add(0.17, 90, 0.45, [['spruce', 7], ['fir', 3]]);
  add(0.215, 70, 0.1);

  // the wood is never one even cover: clearings and stands, a seeded scatter round the lap, wide enough to show from the road
  for (let i = 0; i < 46; i++) {
    const a = hash3(i, 3, 41) * Math.PI * 2, r = 180 + 620 * hash3(i, 5, 41), x = 240 + Math.cos(a) * r, z = -120 + Math.sin(a) * r * 0.9;
    world.groves.push({ x, z, r: 26 + 56 * hash3(i, 7, 41), cover: hash3(i, 9, 41) < 0.62 ? -1.1 : 0.5 });
  }

  // young firs in small stands near the road where the fields were bare: something always passes close
  for (const [u, d, r] of [[0.03, -24, 12], [0.06, 24, 14], [0.105, -22, 12], [0.395, 26, 12], [0.42, -26, 14], [0.49, 24, 14], [0.515, 30, 14], [0.585, 26, 14], [0.7, -24, 12], [0.76, 24, 12], [0.775, -26, 14], [0.815, 26, 14], [0.835, -28, 14], [0.985, 24, 12]]) {
    const p = P(u); world.groves.push({ x: p.x + p.nx * d, z: p.z + p.nz * d, r, cover: 1.9, kinds: [['young', 6], ['spruce', 3], ['fir', 1]] });
  }
  world.buildings = [];
  const site = (kind, u, d, opts = {}) => {
    const p = P(u), x = p.x + p.nx * d + p.tx * (opts.along || 0), z = p.z + p.nz * d + p.tz * (opts.along || 0);
    const yaw = Math.atan2(-p.nx * Math.sign(d), -p.nz * Math.sign(d)) + (opts.turn || 0);
    world.buildings.push({ kind, x, z, yaw, u, d, ...opts });
    keep.push({ x, z, r: opts.r ?? 11 });
  };
  // the rifugio by the start, its annexe across the road
  site('rifugio', 0.012, 36, { r: 26, turn: 0.15 });
  site('tabia', 0.04, 17, { seed: 2, r: 9, turn: 0.3 });
  site('tabia', 0.984, -18, { seed: 3, r: 9, turn: -0.3 });
  site('house', 0.03, -19, { seed: 5, floors: 2, r: 10, turn: -0.15 });
  site('tabia', 0.07, -18, { seed: 6, r: 9, turn: 0.4 });
  // the hamlet on the last bend: houses shoulder to shoulder, the chapel in the middle of the bend
  // not a row: fronts and flanks in turn, set back by different amounts, each turned its own way, a barn built in among them
  for (const [u, d, floors, seed, turn] of [
    [0.872, 15.5, 2, 1, 0.22], [0.888, 19, 3, 2, -1.45], [0.905, 16, 2, 3, 0.3], [0.94, 20, 2, 5, 1.5], [0.957, 16, 2, 6, 0.14],
    [0.878, -16.5, 2, 7, 0.3], [0.894, -20, 3, 8, 1.45], [0.945, -16, 2, 9, 0.2], [0.961, -20, 2, 10, -1.5],
  ]) site('house', u, d, { seed, floors, turn, r: 9.5, near: true });
  site('tabia', 0.922, 17, { seed: 21, r: 9, turn: 0.42 });
  site('tabia', 0.91, -17, { seed: 22, r: 9, turn: -0.3 });
  for (const [u, d, floors, seed, turn] of [
    [0.88, 34, 3, 11, 0.2], [0.9, 36, 2, 12, -0.2], [0.92, 35, 3, 13, 0.1], [0.94, 36, 2, 14, -0.3], [0.96, 34, 2, 15, 0.2], [0.885, 50, 2, 16, 0.3], [0.915, 52, 2, 17, -0.2], [0.95, 51, 3, 18, 0.1],
    [0.88, -34, 2, 19, 0.2], [0.895, -36, 2, 20, -0.2], [0.955, -36, 2, 21, 0.3],
  ]) if (terrain.roadDistAt(P(u).x + P(u).nx * d, P(u).z + P(u).nz * d) > 10) site('house', u, d, { seed, floors, turn, r: 9, near: false });
  site('chapel', 0.92, -38, { r: 14, turn: 0.2 });
  // the bell tower stands by itself in the churchyard, on the road's side: it is what you see over the roofs
  site('campanile', 0.905, -36, { r: 6 });
  site('tabia', 0.846, 17, { seed: 7, r: 9, turn: 0.3 });
  site('tabia', 0.84, -18, { seed: 8, r: 9, turn: -0.3 });
  // a barn at the head of the piste, the rental hut below the trestle
  site('tabia', 0.405, -19, { seed: 9, r: 9, turn: 0.3 });
  site('tabia', 0.745, -46, { seed: 10, r: 9, turn: -0.2 });
  // the boulder faces the road on its way home
  site('boulder', 0.742, 25, { r: 16, turn: -0.18 });
  site('dino', 0.728, 16, { r: 5, turn: 0.4 });
  keep.push({ x: LAKE.x, z: LAKE.z, r: LAKE.r + 2 });
  // what stands in the fields, kept for build: rail fences, hay racks, a barn on its own, the rock by the portal
  world.field = [
    ['fence', 0.022, -10.5, 44], ['fence', 0.052, 10.5, 40], ['fence', 0.082, -10.5, 40], ['fence', 0.968, 10.5, 36], ['fence', 0.828, 10.5, 40], ['fence', 0.81, -10.5, 44], ['fence', 0.762, 10.5, 40], ['fence', 0.695, 10.5, 36], ['fence', 0.53, 26, 34], ['fence', 0.395, 12, 26], ['fence', 0.62, 40, 24],
    ['rack', 0.058, -15], ['rack', 0.81, 15], ['rack', 0.76, -15], ['rack', 0.43, 22], ['rack', 0.99, -16], ['rack', 0.56, 30],
    ['barn', 0.1, -26], ['barn', 0.8, -24], ['barn', 0.68, -26], ['barn', 0.455, 30],
  ];
  for (const f of world.field) { const p = P(f[1]); keep.push({ x: p.x + p.nx * f[2], z: p.z + p.nz * f[2], r: f[0] === 'barn' ? 9 : 5 }); }
  // the lift's line
  const n = 8;
  world.lift = { pylons: [] };
  for (let i = 1; i < n; i++) {
    const t = i / n, x = lerp(LIFT_A[0], LIFT_B[0], t), z = lerp(LIFT_A[1], LIFT_B[1], t);
    if (terrain.roadDistAt(x, z) < 4) continue;
    world.lift.pylons.push({ x, z });
    keep.push({ x, z, r: 5 });
  }
  for (const [x, z] of [LIFT_A, LIFT_B]) keep.push({ x, z, r: 12 });
  // a corridor under the cable
  const L = Math.hypot(LIFT_B[0] - LIFT_A[0], LIFT_B[1] - LIFT_A[1]);
  for (let s = 0; s <= L; s += 16) { const t = s / L; keep.push({ x: lerp(LIFT_A[0], LIFT_B[0], t), z: lerp(LIFT_A[1], LIFT_B[1], t), r: 7 }); }
}

export function build({ track, terrain, batch, mat, world }) {
  const groundAt = world.ground.groundAt, B = batch, S = track.samples, n = track.n;
  const P = (u) => track.pointAt(u);
  const atRoad = (u, d, along = 0) => { const p = P(u); const x = p.x + p.nx * d + p.tx * along, z = p.z + p.nz * d + p.tz * along; return { x, z, y: groundAt(x, z), yaw: Math.atan2(p.tx, p.tz), p }; };

  // A drift that lies on the ground as it is: every vertex takes the ground's height, the rim goes under it. No disc on a slope, no ink ring round it.
  const drifts = [];
  const driftOn = (x, z, rx, rz, h, yaw = 0, seed = 1, seg = 14, rings = 5) => {
    const pos = [], idx = [], cy = Math.cos(yaw), sy = Math.sin(yaw);
    for (let r = 0; r <= rings; r++) for (let q = 0; q < seg; q++) {
      const a = (q / seg) * Math.PI * 2, t = r / rings, k = 1 + 0.22 * Math.sin(3 * a + seed) + 0.12 * Math.sin(5 * a + seed * 2.3), lx = Math.cos(a) * rx * t * k, lz = Math.sin(a) * rz * t * k;
      const px = x + lx * cy + lz * sy, pz = z - lx * sy + lz * cy;
      pos.push(px, groundAt(px, pz) + h * (1 - t * t) ** 1.3 * (0.8 + 0.2 * Math.sin(a * 2 + seed)) - (t > 0.99 ? 0.25 : 0.02), pz);
    }
    for (let r = 0; r < rings; r++) for (let q = 0; q < seg; q++) { const a = r * seg + q, b = r * seg + (q + 1) % seg, c = a + seg, d = b + seg; idx.push(a, b, c, b, d, c); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx); g.computeVertexNormals();
    drifts.push(paint(g, [0.84, 0.82, 0.92]));
  };

  for (const b of world.buildings) {
    const rr = b.kind === 'rifugio' || b.kind === 'boulder' || b.kind === 'dino' || b.kind === 'campanile' ? 0 : 5;
    const y0 = groundAt(b.x, b.z);
    let y = y0;
    if (rr) for (const [ax, az] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) y = Math.max(y, groundAt(b.x + ax * rr, b.z + az * rr));
    y = Math.min(y, y0 + 1.6) - 0.05;
    let g, r = 9;
    if (b.kind === 'rifugio') { g = rifugio(); r = 20; }
    else if (b.kind === 'house') { g = house({ seed: b.seed, floors: b.floors, near: b.near }); r = 10; }
    else if (b.kind === 'tabia') { g = tabia({ seed: b.seed }); }
    else if (b.kind === 'chapel') { g = chapel(); r = 10; }
    else if (b.kind === 'campanile') { g = campanile(); r = 4; }
    else if (b.kind === 'dino') { g = dino(); r = 3; }
    else if (b.kind === 'boulder') {
      // tilted back as it really lies, about fifty degrees, half sunk in the snow
      g = place(pelmettoBoulder(), { r: [-0.62, 0, 0.06] }); y = y0 + 3.4; r = 13;
    }
    place(g, { p: [b.x, y, b.z], r: [0, b.yaw, 0] });
    B.add(g);
    B.blob(b.x, b.z, r, 0.42);
  }
  // a little plinth of drift round the boulder's foot
  { const a = world.buildings.find((q) => q.kind === 'boulder');
    for (let i = 0; i < 9; i++) { const t = i / 8 - 0.5, x = a.x + Math.cos(a.yaw) * t * 22, z = a.z - Math.sin(a.yaw) * t * 22, R = 3 + 1.2 * hash3(i, 2, 3); driftOn(x + Math.sin(a.yaw) * 1.8, z + Math.cos(a.yaw) * 1.8, R * 1.3, R, 1, a.yaw, i, 10, 4); } }

  // ploughed banks and marker poles: the winter road. Chunks, because a bank runs the whole lap and a cell must stay a cell
  const SKIP = (u) => (u > 0.34 && u < 0.4) || (u > 0.435 && u < 0.472) || (u > 0.598 && u < 0.69);
  const zone = (u, a, b) => 1 - smooth(a - 0.008, a, u) * (1 - smooth(b, b + 0.008, u));
  const roadBank = (i0, side) => {
    const pos = [], col = [], idx = [], ring = 5, snow = [0.95, 0.93, 1], shade = [0.6, 0.62, 0.84], slush = [0.36, 0.36, 0.44];
    let rows = 0;
    for (let q = 0; q <= 40; q++) {
      const i = (i0 + q) % n, u = i / n, hw = S.w[i] / 2;
      // a plough leaves a broken berm, thrown in heaps; in the hamlet it is shovelled low, on the piste the groomer rolls it soft
      const hamlet = u > 0.862 && u < 0.965, piste = u > 0.4 && u < 0.7;
      const fade = zone(u, 0.34, 0.4) * zone(u, 0.435, 0.472) * zone(u, 0.598, 0.69), big = vn(i / 9, 3 + side), lump = vn(i / 2.4, 5 + side);
      const h0 = (hamlet ? 0.2 + 0.3 * big : piste ? 0.18 + 0.22 * big : 0.28 + 0.55 * big * big + 0.2 * lump) * (0.86 + 0.28 * lump), wd = (hamlet ? 1 : 2) + 1.5 * vn(i / 7, 7 + side), ins = (hamlet ? 1.3 : 2.1) + 0.5 * vn(i / 3.6, 9 + side), dirty = piste ? 0 : 0.35 + 0.65 * vn(i / 5, 11 + side);
      for (let k = 0; k <= ring; k++) {
        const t = k / ring, d = side * (hw + ins + wd * t), x = S.x[i] + S.nx[i] * d, z = S.z[i] + S.nz[i] * d, bump = (piste ? 0.1 : 0.34) * (hash3(i, k, side + 3) - 0.5) * Math.sin(t * Math.PI);
        const y = Math.max(groundAt(x, z), track.heightAt(i, side * hw) - 0.1) + (Math.sin(t * Math.PI) ** 0.7 * h0 + bump) * fade - 0.05;
        const c = smooth(0, 0.7, t + 0.1), sl = dirty * (1 - smooth(0.12, 0.6, t)) * (0.6 + 0.4 * lump);
        pos.push(x, y, z);
        for (let e = 0; e < 3; e++) col.push(lerp(lerp(shade[e], snow[e], c), slush[e], sl));
      }
      rows++;
    }
    const w = ring + 1;
    for (let r = 0; r < rows - 1; r++) for (let k = 0; k < ring; k++) {
      const a = r * w + k, b = a + 1, c = a + w, d = c + 1;
      if (side > 0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('aPaint', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3), 1));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  };
  const banks = [];
  for (let i = 0; i < n; i += 40) for (const s of [-1, 1]) banks.push(roadBank(i, s));
  const bankMesh = new THREE.Mesh(merge(banks), mat('#ffffff', { vertexColors: true, ground: true, shade: true }));
  bankMesh.frustumCulled = false; world.staticGroup.add(bankMesh);

  // the poles: every 16 m on both sides of the ploughed road, an orange tip that is what you steer by in a white out
  const pole = (x, y, z, c = ORANGE, h = 2.4) => {
    const parts = [paint(place(cylinder(0.05, 0.06, h, 5), { p: [0, h / 2, 0] }), '#f2eee6')];
    parts.push(paint(place(cylinder(0.065, 0.065, h * 0.28, 5), { p: [0, h * 0.86, 0] }), c));
    return place(merge(parts), { p: [x, y, z] });
  };
  for (let i = 0; i < n; i += 8) {
    const u = i / n, s = S.surface[i];
    if (SKIP(u)) continue;
    // the piste has its own markers and the hamlet its own lamps
    const onPiste = u >= 0.4 && u < 0.6;
    if (u > 0.862 && u < 0.965) continue;
    for (const side of [-1, 1]) {
      const d = side * (S.w[i] / 2 + 2.7), x = S.x[i] + S.nx[i] * d, z = S.z[i] + S.nz[i] * d;
      B.add(pole(x, Math.max(groundAt(x, z), track.heightAt(i, side * S.w[i] / 2)), z, onPiste ? (side > 0 ? RED : BLUE) : ORANGE, onPiste ? 2.8 : 2.4));
    }
  }
  void terrain;

  // the lift: pylons, stations, cable, and chairs that really go round
  const lx = LIFT_B[0] - LIFT_A[0], lz = LIFT_B[1] - LIFT_A[1], L = Math.hypot(lx, lz), dirx = lx / L, dirz = lz / L, nx = -dirz, nz = dirx, yawL = Math.atan2(dirx, dirz);
  const cableY = (t) => {
    // the cable sags between pylons and clears everything under it: it follows a smooth ground, plus its height
    const x = LIFT_A[0] + lx * t, z = LIFT_A[1] + lz * t;
    let g = -1e9; for (let q = -2; q <= 2; q++) { const s = t + q * 8 / L; g = Math.max(g, groundAt(LIFT_A[0] + lx * s, LIFT_A[1] + lz * s)); }
    void x; void z;
    return g + LIFT_H;
  };
  for (const q of world.lift.pylons) {
    const t = ((q.x - LIFT_A[0]) * dirx + (q.z - LIFT_A[1]) * dirz) / L, g = pylon(cableY(t) - groundAt(q.x, q.z));
    place(g, { p: [q.x, groundAt(q.x, q.z), q.z], r: [0, yawL + Math.PI / 2, 0] });
    B.add(g); B.blob(q.x, q.z, 1.6, 0.4);
  }
  for (const [x, z, a] of [[LIFT_A[0], LIFT_A[1], yawL], [LIFT_B[0], LIFT_B[1], yawL + Math.PI]]) {
    const g = place(station(), { p: [x, groundAt(x, z) - 0.1, z], r: [0, a + Math.PI / 2, 0] }); B.add(g); B.blob(x, z, 8, 0.45);
  }
  for (const s of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 26; i++) { const t = i / 26; pts.push([LIFT_A[0] + lx * t + nx * s * LIFT_SEP / 2, cableY(t) + 0.05, LIFT_A[1] + lz * t + nz * s * LIFT_SEP / 2]); }
    B.add(paint(tube(pts, 0.05, 4), '#2d2c36'));
  }
  // chairs: one instanced mesh, one draw call, moved each frame
  const PAIRS = [[[-0.5, '#9a6b43', RED]], null, [[-0.5, '#e3e0d6', '#f2c544']], null, null, [[0.5, '#7b6b5d', RED]], [[0.5, '#9a6b43', '#f2c544']], null];
  const chairs = PAIRS.map((r) => chair(r)), spacing = 33, count = Math.floor((2 * L) / spacing);
  const bodies = chairs.map(() => null);
  const material = mat('#ffffff', { vertexColors: true, gloss: [40, 0.1] });
  liftState = { meshes: [], lists: [], L, count, spacing, cableY, lx, lz, nx, nz, yawL };
  chairs.forEach((g, k) => {
    const list = []; for (let i = 0; i < count; i++) if (i % chairs.length === k) list.push(i);
    const m = new THREE.InstancedMesh(g, material, list.length);
    m.frustumCulled = false;
    world.staticGroup.add(m);
    liftState.meshes.push(m); liftState.lists.push(list);
    bodies[k] = m;
  });
  placeChairs(0);

  // the lake's ice is in the ground's paint (plan); here what stands on it
  {
    const hut = (x, z, a) => { const q = place(iceHut(), { p: [x, groundAt(x, z) + 0.1, z], r: [0, a, 0] }); B.add(q); B.blob(x, z, 3.2, 0.34); };
    hut(LAKE.x + 12, LAKE.z + 21, 0.8); hut(LAKE.x - 16, LAKE.z + 24, -0.6);
    // low drifts and reeds on the bank, so the shore is a place and not a line
    for (let i = 0; i < 26; i++) {
      const a = hash3(i, 2, 61) * Math.PI * 2, rr = LAKE.r + 2 + 5 * hash3(i, 4, 61), x = LAKE.x + Math.cos(a) * rr, z = LAKE.z + Math.sin(a) * rr, w = 2 + 3.4 * hash3(i, 6, 61);
      if (Math.abs(track.nearest(x, z).d) < P(0.65).w / 2 + 3) continue;
      driftOn(x, z, w, w * 0.6, 0.45 + 0.4 * hash3(i, 8, 61), a, i, 10, 3);
      if (i % 3 === 0) for (let k = 0; k < 5; k++) B.add(paint(place(cylinder(0.02, 0.05, 1.2, 4), { p: [x + (k - 2) * 0.4, groundAt(x, z) + 0.6, z + (k % 2) * 0.4], r: [0.1 * (k - 2), 0, 0.14 * (k - 2)] }), '#8a7450'));
    }
    // skaters: the round folk going round the rink in coats and scarves, one instanced mesh per kind of local, moved each frame, for whoever looks on the third lap
    const kinds = [['#9a6b43', '#2d62b5', RED, RED], ['#c9a678', '#b5362c', BLUE, BLUE], ['#e3e0d6', '#3f7d5a', '#f2c544', '#f2c544'], ['#7b6b5d', '#c98a2e', '#3f9c6a', RED]];
    const skMat = mat('#ffffff', { vertexColors: true, gloss: [40, 0.1] });
    skaters = kinds.map(([fur, coat, scarf, hat], k) => {
      const mesh = new THREE.InstancedMesh(folk({ fur, coat, scarf, hat, arms: 1, skates: true }), skMat, 2);
      mesh.frustumCulled = false; world.staticGroup.add(mesh);
      const list = [0, 1].map((q) => ({ r: 9 + ((k * 3 + q * 7) % 20), a: (k * 1.7 + q * 2.4) % 6.28, w: 0.28 + 0.05 * ((k + q) % 3), dir: (k + q) % 2 ? 1 : -1 }));
      return { mesh, list, groundAt };
    });
    placeSkaters(0);
  }

  // the balcony's slope: long rows of avalanche fence stepped up the white, the gully left bare between them, bands of rock where the slope is steepest, blocks that came down
  for (let row = 0; row < 3; row++) for (let i = 0; i < 7; i++) {
    const u = 0.264 + i * 0.0122 + row * 0.004, d = 30 + row * 24 + 3 * hash3(i, row, 2);
    const a = atRoad(u, d), gullyX = Math.abs(a.x - 190);
    if (gullyX < 24) continue;
    B.add(place(snowFence(12), { p: [a.x, a.y - 0.9, a.z], r: [0, a.yaw + Math.PI, 0], s: 1.2 }));
    driftOn(a.x, a.z, 9, 1.8, 0.6, a.yaw + Math.PI / 2, i + row * 7, 12, 3);
    B.blob(a.x, a.z, 4, 0.2);
  }
  for (const [u, d, w, h, seed, turn] of [[0.272, 44, 24, 6, 2, 0.1], [0.3, 66, 34, 8, 3, -0.1], [0.322, 42, 26, 6.5, 4, 0.2], [0.336, 72, 26, 9, 5, 0], [0.284, 88, 30, 9, 6, 0.1]]) {
    // set by its foot: the ground at its downhill face, deep, so the slope comes out of the rock and the top goes back into the hill
    const a = atRoad(u, d), f = atRoad(u, d - 3.6), g = place(rockFace(w, h, 7, seed), { p: [a.x, f.y - 2.4, a.z], r: [0, a.yaw - Math.PI / 2 + turn, 0] });
    B.add(g);
    for (let q = 0; q < 6; q++) { const t = ((q + 0.5) / 6 - 0.5) * w; driftOn(f.x + Math.sin(a.yaw) * t, f.z + Math.cos(a.yaw) * t, w / 6 + 1.6, 2.2, 0.9 + 0.6 * hash3(q, seed, 9), a.yaw, q + seed, 10, 3); }
  }
  for (const [u, d, r, seed] of [[0.268, 15, 1.5, 1], [0.283, 18, 2.2, 2], [0.296, 14.5, 1.2, 3], [0.312, 20, 2.6, 4], [0.33, 16, 1.6, 5], [0.34, 19, 1.3, 6]]) {
    const a = atRoad(u, d); B.add(place(boulder(r, seed), { p: [a.x, a.y, a.z], r: [0, seed * 1.3, 0] })); B.blob(a.x, a.z, r * 1.9, 0.5);
  }
  // The slanted rail fence of the Dolomite meadows: crossed posts every few metres and long rails laid on the slant between them, each post set on the ground where it stands, running along the road. Snow lies on the rails.
  const zigzag = (u0, d, len) => {
    const parts = [], m = Math.max(2, Math.round(len / 3.6)), du = (len / m) / track.length;
    let prev = null;
    for (let i = 0; i <= m; i++) {
      const a = atRoad(u0 + i * du, d + 0.25 * Math.sin(i * 1.3)), up = 0.05 * (hash3(i, Math.round(u0 * 1000), 3) - 0.5);
      for (const s of [-1, 1]) parts.push(paint(tube([[a.x - a.p.nx * s * 0.2, a.y - 0.2, a.z - a.p.nz * s * 0.2], [a.x + a.p.nx * s * 0.17, a.y + 1.42 + up, a.z + a.p.nz * s * 0.17]], 0.055, 4), WOOD_D));
      if (prev) for (let q = 0; q < 3; q++) {
        const y0 = 0.32 + q * 0.34, y1 = y0 + 0.5, seg = [[prev.x, prev.y + y0, prev.z], [a.x, a.y + y1, a.z]];
        parts.push(paint(tube(seg, 0.05, 4), q === 2 ? WOOD_L : WOOD));
        if (q === 2) parts.push(paint(tube([[prev.x, prev.y + y0 + 0.07, prev.z], [a.x, a.y + y1 + 0.07, a.z]], 0.075, 4), SNOW));
      }
      prev = a;
    }
    return merge(parts);
  };
  // the field furniture
  for (const f of world.field) {
    const a = atRoad(f[1], f[2]), sg = Math.sign(f[2]);
    if (f[0] === 'fence') B.add(zigzag(f[1], f[2], f[3]));
    else if (f[0] === 'rack') { B.add(place(hayRack(), { p: [a.x, a.y - 0.05, a.z], r: [0, a.yaw + Math.PI / 2 + 0.3 * sg, 0] })); B.blob(a.x, a.z, 3.6, 0.35); }
    else { B.add(place(tabia({ seed: 30 + Math.round(f[1] * 100), w: 6, l: 7.6, h: 5, rh: 3.8, near: false }), { p: [a.x, a.y - 0.05, a.z], r: [0, Math.atan2(-a.p.nx * sg, -a.p.nz * sg) + 0.5 * sg, 0] })); B.blob(a.x, a.z, 7, 0.42); }
  }
  // The bridge's ends: a stone seat under the deck and wing walls that run back along the road following its curve, falling into the bank, capped with snow. Built from the road's own samples, so nothing sticks out at an angle.
  const strip = (rows, kind, color) => {
    const pos = [], idx = [];
    rows.forEach(([a, b]) => pos.push(...a, ...b));
    for (let r = 0; r < rows.length - 1; r++) { const q = r * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx); g.computeVertexNormals();
    return paint(g, color, kind);
  };
  for (const st of track.structures) {
    if (st.kind !== 'bridge') continue;
    for (const [i0, out] of [[st.i0, -1], [st.i1, 1]]) {
      const hw = S.w[i0] / 2, nx = S.nx[i0], nz = S.nz[i0], tx = S.tx[i0] * out, tz = S.tz[i0] * out, y = S.y[i0], yaw = Math.atan2(tx, tz);
      // the seat: from under the deck down into the ground, a little wider than the road, stepped at its foot
      const low = Math.min(groundAt(S.x[i0] - tx * 5, S.z[i0] - tz * 5), groundAt(S.x[i0] + tx, S.z[i0] + tz)) - 1.5, H = Math.max(2, y - 0.25 - low);
      B.add(paint(place(box(hw * 2 + 2, H, 3.2), { p: [S.x[i0] - tx * 0.4, low + H / 2, S.z[i0] - tz * 0.4], r: [0, yaw, 0] }), STONE, 1));
      B.add(paint(place(box(hw * 2 + 2.6, 1.3, 4.1), { p: [S.x[i0] - tx * 0.4, low + 0.65 + Math.max(0, H - 4) * 0.2, S.z[i0] - tz * 0.4], r: [0, yaw, 0] }), DOLOMIA_D, 1));
      for (const sd of [-1, 1]) {
        const out0 = [], in0 = [], cap = [], m = 8;
        for (let k = 0; k <= m; k++) {
          const i = ((i0 + out * k) % n + n) % n, w = S.w[i] / 2, f = k / m, ax = S.nx[i] * sd, az = S.nz[i] * sd;
          const px = (d) => [S.x[i] + ax * d, S.z[i] + az * d], [ix, iz] = px(w + 0.25), [ox, oz] = px(w + 1.05);
          const road = track.heightAt(i, sd * w), g0 = Math.min(groundAt(ix, iz), groundAt(ox, oz)) - 1.2, top = road + lerp(0.62, -0.25, smooth(0.45, 1, f));
          out0.push([[ox, top, oz], [ox, g0, oz]]); in0.push([[ix, g0, iz], [ix, top, iz]]);
          const lump = 0.14 + 0.1 * hash3(k, sd, i0) * (1 - f);
          cap.push([[ix - ax * 0.1, top + 0.02, iz - az * 0.1], [ix + ax * 0.4, top + lump, iz + az * 0.4]], [[ix + ax * 0.4, top + lump, iz + az * 0.4], [ox + ax * 0.1, top + 0.02, oz + az * 0.1]]);
        }
        B.add(merge([strip(out0, 1, STONE), strip(in0, 1, STONE), strip(cap.filter((_, q) => q % 2 === 0), 0, SNOW), strip(cap.filter((_, q) => q % 2 === 1), 0, SNOW)]));
        // and the snow lies against the outside of the wall and over the seat's shoulder
        for (let q = 0; q < 3; q++) {
          const i = ((i0 + out * (2 + q * 3)) % n + n) % n, d = S.w[i] / 2 + 3.2 + q * 0.6, x = S.x[i] + S.nx[i] * sd * d, z = S.z[i] + S.nz[i] * sd * d;
          driftOn(x, z, 4.2, 2.8, 0.8, Math.atan2(S.tx[i], S.tz[i]), q + sd + 3, 10, 4);
        }
      }
    }
  }
  // the avalanche shed: it goes into living rock, not a heap of snow. Beds of dolomia either side of each portal and over it, stepping back up the mound, the road walled in on the way in
  for (const st of track.structures) {
    if (st.kind !== 'tunnel') continue;
    for (const [i0, out] of [[st.i0, -1], [st.i1, 1]]) {
      const x = S.x[i0], z = S.z[i0], hw = S.w[i0] / 2, yawF = Math.atan2(S.tx[i0] * out, S.tz[i0] * out), nx = S.nx[i0], nz = S.nz[i0], tx = S.tx[i0] * out, tz = S.tz[i0] * out, y = S.y[i0];
      const rock = (side, fore, w, h, seed, up = -1.2) => { const px = x + nx * side + tx * fore, pz = z + nz * side + tz * fore; B.add(place(rockFace(w, h, 7, seed), { p: [px, y + up, pz], r: [0, yawF, 0] })); if (up < 0) B.blob(px, pz, w * 0.5, 0.4); };
      for (const s2 of [-1, 1]) { rock(s2 * (hw + 6), 1.5, 11, 12, 11 + s2); rock(s2 * (hw + 15), -1, 14, 17, 14 + s2); rock(s2 * (hw + 26), -4, 16, 13, 16 + s2); rock(s2 * (hw + 2.4), 7, 4.6, 3.4, 18 + s2); }
      // the brow over the arch
      rock(0, 0.4, hw * 2 + 12, 9, 21, 7.6);
      // and the snow comes down over the skirts of the mound in soft heaps
      for (const s2 of [-1, 1]) for (let q = 0; q < 6; q++) {
        const sw = hw + 22 + q * 7, f = -6 + q * 3.5 + 7 * hash3(q, s2, 3), px = x + nx * s2 * sw + tx * f, pz = z + nz * s2 * sw + tz * f, R = 8 + 6 * hash3(q, s2, 5);
        driftOn(px, pz, R * 1.3, R, R * 0.2, q, q + s2, 10, 4);
      }
    }
  }

  for (let u = 0.25; u < 0.345; u += 0.0065) {
    const a = atRoad(u, -(P(u).w / 2 + 1.1)), b = atRoad(u + 0.0065, -(P(u).w / 2 + 1.1)), parts = [];
    parts.push(paint(place(cylinder(0.11, 0.14, 1.5, 6), { p: [a.x, a.y + 0.7, a.z] }), WOOD_D));
    for (const h of [0.75, 1.3]) parts.push(paint(tube([[a.x, a.y + h, a.z], [b.x, b.y + h, b.z]], 0.06, 4), WOOD_L));
    parts.push(paint(tube([[a.x, a.y + 1.41, a.z], [b.x, b.y + 1.41, b.z]], 0.11, 5), SNOW));
    B.add(merge(parts));
  }

  // the piste: orange nets on the outside of the lines you might miss, slalom flags, a snowman judging the jump
  const net = (u0, u1, side) => {
    const X = new THREE.Vector3(1, 0, 0), strand = (x0, y0, z0, x1, y1, z1, r, c) => {
      const dir = new THREE.Vector3(x1 - x0, y1 - y0, z1 - z0), l = dir.length(), g = box(l, r, r);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(X, dir.normalize())); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      return paint(g, c);
    };
    for (let u = u0; u < u1; u += 0.005) {
      const a = atRoad(u, side * (P(u).w / 2 + 3.6)), b = atRoad(u + 0.005, side * (P(u + 0.005).w / 2 + 3.6)), parts = [];
      // a larch post with a hat of snow
      parts.push(paint(place(cylinder(0.06, 0.08, 2.1, 6), { p: [a.x, a.y + 1, a.z] }), LARCH_L), paint(place(sphere(0.13, 6, 5), { p: [a.x, a.y + 2.1, a.z], s: [1, 0.6, 1] }), SNOW));
      // the ropes sag between the posts, the mesh hangs off them: darker low down, where the snow has wet it
      const at = (t, y) => { const sag = 0.2 * 4 * t * (1 - t); return [lerp(a.x, b.x, t), lerp(a.y, b.y, t) + y - sag * (y / 1.9), lerp(a.z, b.z, t)]; };
      for (const [y, c] of [[0.45, '#b4582c'], [0.95, '#c8632f'], [1.45, '#d56e36'], [1.9, '#df7c44']]) for (let q = 0; q < 2; q++) parts.push(strand(...at(q / 2, y), ...at((q + 1) / 2, y), y > 1.8 ? 0.05 : 0.03, c));
      for (let q = 1; q < 8; q++) parts.push(strand(...at(q / 8, 0.1), ...at(q / 8, 1.9), 0.022, '#c8632f'));
      B.add(merge(parts));
      driftOn(a.x, a.z, 3.6, 1, 0.4, a.yaw + Math.PI / 2, Math.round(u * 997), 10, 3);
    }
  };
  net(0.51, 0.575, -1);
  // flags down the fall line, red and blue by turns, big enough to read
  for (let i = 0; i < 8; i++) {
    const u = 0.41 + i * 0.012, s = i % 2 ? 1 : -1, c = i % 2 ? RED : BLUE;
    if (SKIP(u)) continue;
    const a = atRoad(u, s * (P(u).w / 2 + 0.9)), parts = [paint(place(cylinder(0.06, 0.06, 2.8, 5), { p: [a.x, a.y + 1.4, a.z] }), '#f4efe4')];
    // a real gate panel: two poles, the cloth between them bellied by the wind
    const px = a.x - P(u).nx * s * 1.2, pz = a.z - P(u).nz * s * 1.2;
    parts.push(paint(place(cylinder(0.05, 0.05, 2.6, 5), { p: [px, a.y + 1.3, pz] }), '#f4efe4'));
    const cloth = new THREE.BufferGeometry(), cv = [];
    for (let q = 0; q <= 4; q++) for (const h of [1.6, 2.45]) { const t = q / 4, b = Math.sin(t * Math.PI) * 0.16; cv.push(lerp(a.x, px, t) + P(u).tx * b, a.y + h - t * 0.05, lerp(a.z, pz, t) + P(u).tz * b); }
    cloth.setAttribute('position', new THREE.Float32BufferAttribute(cv, 3));
    const ci = []; for (let q = 0; q < 4; q++) { const e = q * 2; ci.push(e, e + 2, e + 1, e + 1, e + 2, e + 3, e, e + 1, e + 2, e + 1, e + 3, e + 2); }
    cloth.setIndex(ci); cloth.computeVertexNormals();
    parts.push(paint(cloth, c));
    B.add(merge(parts));
  }
  // who is watching: the same round folk, in hats, on the bank of the bowl and by the jump
  for (const [u, d, c, turn] of [[0.53, -18, '#9a6b43', 0], [0.535, -20, '#c9a678', 0.3], [0.54, -18.5, '#e3e0d6', -0.2], [0.548, -20, '#7b6b5d', 0.2], [0.555, -18.5, '#9a6b43', 0], [0.49, 17, '#c9a678', 0], [0.495, 19, '#e3e0d6', 0.3], [0.48, -17, '#9a6b43', 0.1]]) {
    const a = atRoad(u, d), sg = Math.sign(d), hat = hash3(u * 1000, 1, 4) < 0.5 ? RED : BLUE;
    const g = folk({ fur: c, coat: hat === RED ? '#2d62b5' : '#b5362c', scarf: hat, hat, arms: 0.15 });
    place(g, { p: [a.x, a.y, a.z], r: [0, Math.atan2(-a.p.nx * sg, -a.p.nz * sg) + turn, 0] }); B.add(g); B.blob(a.x, a.z, 0.9, 0.35);
  }
  { const a = atRoad(0.545, -26), g = place(groomer(), { p: [a.x, a.y, a.z], r: [0, a.yaw + 2.2, 0], s: 1.1 }); B.add(g); B.blob(a.x, a.z, 5, 0.42); }
  for (const [u, d, turn, sc] of [[0.42, 15, 0.4, RED], [0.5, -16, -0.5, BLUE], [0.07, 14, 0.6, '#3f9c6a'], [0.715, 15, -0.3, RED], [0.86, -13, 0.3, BLUE], [0.2, -15, 2.8, '#f2c544'], [0.585, -15, 0.8, RED]]) {
    const a = atRoad(u, d), sg = Math.sign(d), g = place(snowman(sc), { p: [a.x, a.y + 0.05, a.z], r: [0, Math.atan2(-a.p.nx * sg, -a.p.nz * sg) + turn, 0], s: 1.1 });
    B.add(g); B.blob(a.x, a.z, 1.3, 0.34);
  }

  // the sled run: a chute of packed snow down to the road, timber gates at the crossing, the queue up the bank with their sleds
  for (const s of [-1, 1]) {
    for (const off of [-9.5, 9.5]) {
      const a = atRoad(0.795, s * (P(0.795).w / 2 + 2), off), parts = [paint(place(cylinder(0.16, 0.2, 1.8, 7), { p: [0, 0.9, 0] }), WOOD_D), paint(place(sphere(0.34, 8, 6), { p: [0, 1.95, 0] }), SNOW)];
      for (const h of [0.55, 1.2]) parts.push(paint(place(box(0.12, 0.2, 6), { p: [0, h, s * 3 * Math.sign(off) * 0], r: [0, 0, 0] }), h > 1 ? RED : '#f4efe4'));
      B.add(place(merge(parts), { p: [a.x, a.y, a.z], r: [0, a.yaw + Math.PI / 2, 0] }));
    }
  }
  for (const [u, d, turn, c, hat] of [[0.793, -20, 0.2, '#e58a4a', RED], [0.797, -23, -0.3, '#9a6b43', BLUE], [0.801, -21, 0.4, '#c9a678', '#f2c544'], [0.789, 19, 0.2, '#e3e0d6', RED], [0.8, 18, -0.2, '#7b6b5d', BLUE]]) {
    const a = atRoad(u, d), sg = Math.sign(d), yaw = Math.atan2(-a.p.nx * sg, -a.p.nz * sg) + turn;
    const g = merge([blobAnimal(c, 0.8, c), paint(place(sphere(0.3, 8, 6), { p: [0, 1.62, 0.08], s: [1, 0.7, 1] }), hat)]);
    place(g, { p: [a.x, a.y, a.z], r: [0, yaw, 0] }); B.add(g); B.blob(a.x, a.z, 0.8, 0.34);
    const q = place(sled(), { p: [a.x + Math.sin(yaw) * 1.3, a.y, a.z + Math.cos(yaw) * 1.3], r: [0, yaw + 0.9, 0], s: 1.2 }); B.add(q);
  }
  // sleds and firewood along the walls of the hamlet and by the rifugio, the way they stand
  for (const [u, d, turn] of [[0.018, 13.5, 0.4], [0.03, 12.5, -0.2], [0.88, 9.8, 1.2], [0.9, -9.6, 0.6], [0.945, 9.7, -0.6], [0.96, -9.8, 0.2], [0.72, 12.6, 0.4]]) {
    const a = atRoad(u, d), g = place(sled(), { p: [a.x, a.y, a.z], r: [0, a.yaw + turn, 0], s: 1.2 }); B.add(g); B.blob(a.x, a.z, 1, 0.3);
  }
  for (const [u, d] of [[0.025, -13.5], [0.91, 10.2], [0.89, -10.2], [0.955, 10.2], [0.405, -12], [0.845, 11.2], [0.72, -15]]) {
    const a = atRoad(u, d), g = place(woodPile(), { p: [a.x, a.y, a.z], r: [0, a.yaw + Math.PI / 2, 0] }); B.add(g); B.blob(a.x, a.z, 3.2, 0.4);
  }

  // street lamps through the hamlet, already lit, and a string of lights over the road
  for (let u = 0.868; u < 0.965; u += 0.0125) for (const s of [-1, 1]) {
    const k = (Math.round(u * 80) + (s > 0 ? 0 : 1)) % 2; if (k) continue;
    const a = atRoad(u, s * (P(u).w / 2 + 1.5)), parts = [paint(place(cylinder(0.07, 0.1, 4.6, 6), { p: [0, 2.3, 0] }), '#2f3038'), paint(place(sphere(0.3, 8, 6), { p: [0, 4.75, 0] }), [2.2, 1.5, 0.75]), paint(place(cylinder(0.05, 0.42, 0.2, 8), { p: [0, 5.05, 0] }), '#2f3038'), paint(place(sphere(0.2, 6, 4), { p: [0, 5.2, 0], s: [1.2, 0.5, 1.2] }), SNOW)];
    B.add(place(merge(parts), { p: [a.x, a.y, a.z] })); B.blob(a.x, a.z, 1.2, 0.3);
  }
  for (const [u, hp] of [[0.885, 6.6], [0.935, 6.8], [0.015, 7.2]]) {
    const p = P(u), wd = p.w / 2 + 3.2, parts = [], m = 14;
    const ax = p.x + p.nx * wd, az = p.z + p.nz * wd, bx = p.x - p.nx * wd, bz = p.z - p.nz * wd, y0 = p.y + hp;
    parts.push(paint(place(cylinder(0.07, 0.1, hp + 0.5, 5), { p: [ax, p.y + hp / 2, az] }), WOOD_D), paint(place(cylinder(0.07, 0.1, hp + 0.5, 5), { p: [bx, p.y + hp / 2, bz] }), WOOD_D));
    const pts = [];
    for (let i = 0; i <= m; i++) { const t = i / m; pts.push([lerp(ax, bx, t), y0 - 1.1 * 4 * t * (1 - t), lerp(az, bz, t)]); }
    parts.push(paint(tube(pts, 0.03, 3), '#2f2a30'));
    for (let i = 1; i < m; i++) parts.push(paint(place(sphere(0.17, 6, 4), { p: [pts[i][0], pts[i][1] - 0.2, pts[i][2]] }), i % 3 === 0 ? [2.2, 0.7, 0.5] : i % 3 === 1 ? [2.2, 1.7, 0.7] : [0.7, 1.4, 2.2]));
    B.add(merge(parts));
  }

  // the ice patches the sim knows about: glazed road you can see coming, with the shine of the hour on it
  for (const h of track.def.hazards || []) {
    if (h.kind !== 'ice') continue;
    const len = 40 * (h.width ?? 1), c = Math.round(h.u * n), half = Math.round(len / 2 / track.step), pos = [], col = [], idx = [], C = 9, ice = [0.34, 0.56, 0.72], pale = [0.6, 0.76, 0.86];
    for (let o = -half; o <= half; o++) {
      const i = ((c + o) % n + n) % n, t = o / half, hw = S.w[i] / 2 * (1 - 0.1 * Math.sin(o * 0.7 + 1)) * Math.min(1, (1 - Math.abs(t)) * 6);
      for (let q = 0; q <= C; q++) {
        const d = (q / C * 2 - 1) * hw, x = S.x[i] + S.nx[i] * d, z = S.z[i] + S.nz[i] * d, sw = smooth(0.35, 0.8, Math.sin(o * 0.31 + q * 0.5 + Math.sin(o * 0.13) * 2) * 0.5 + 0.5);
        pos.push(x, track.heightAt(i, d) + 0.05, z); col.push(lerp(ice[0], pale[0], sw), lerp(ice[1], pale[1], sw), lerp(ice[2], pale[2], sw));
      }
    }
    const rows = half * 2 + 1, w = C + 1;
    for (let r = 0; r < rows - 1; r++) for (let q = 0; q < C; q++) { const a = r * w + q, b = a + 1, e = a + w, f = e + 1; idx.push(a, e, b, b, e, f); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('aPaint', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3), 1));
    g.setIndex(idx); g.computeVertexNormals();
    B.add(g);
  }

  // the signs
  const SIGNS = [
    { text: 'PERICOLO VALANGHE', bg: '#fbf7ea', ink: '#c9382c', size: 76 },
    { text: 'PISTA', bg: '#2d62b5', ink: '#f7f3e6', size: 96 },
    { text: 'GHIACCIO!', bg: '#fbf7ea', ink: '#2d62b5', size: 90 },
    { text: 'IMPRONTE DI DINOSAURI', bg: '#7b4a2a', ink: '#f7e9c8', size: 60 },
    { text: 'SLITTE', bg: '#fbf7ea', ink: '#c9382c', size: 96 },
    { text: 'RIFUGIO', bg: '#7b4a2a', ink: '#f7e9c8', size: 90 },
    { text: 'VIA', bg: '#ffffff', ink: '#26222a', size: 96 },
    { text: "PELMO D'INVERNO", bg: '#2d62b5', ink: '#fff6dc', size: 80 },
    { text: '>>>>>>', bg: '#fbf7ea', ink: '#26222a', size: 110 },
    { text: 'SCUOLA SCI', bg: '#c9382c', ink: '#fff6dc', size: 92 },
    { text: 'NOLEGGIO SLITTE', bg: '#fbf7ea', ink: '#2d62b5', size: 76 },
    { text: 'TRATTORIA', bg: '#3f6a48', ink: '#fbf0d8', size: 92 },
    { text: 'ALIMENTARI', bg: '#7b4a2a', ink: '#f7e9c8', size: 86 },
    { text: 'SS 347', bg: '#2d62b5', ink: '#ffffff', size: 104 },
    { text: 'ALBERGO', bg: '#e6d8b8', ink: '#5a2c20', size: 96 },
  ];
  const atlas = signAtlas(SIGNS), planes = [];
  const sign = (u, d, row, w = 5, h = 1.1, hp = 2.2, turn = 0) => {
    const a = atRoad(u, d), yaw = a.yaw + Math.PI + turn;
    B.add(paint(place(box(0.2, hp + h, 0.2), { p: [a.x + Math.cos(yaw) * (w * 0.42), a.y + (hp + h) / 2, a.z - Math.sin(yaw) * (w * 0.42)] }), WOOD_D));
    B.add(paint(place(box(0.2, hp + h, 0.2), { p: [a.x - Math.cos(yaw) * (w * 0.42), a.y + (hp + h) / 2, a.z + Math.sin(yaw) * (w * 0.42)] }), WOOD_D));
    B.add(paint(place(box(w + 0.2, h + 0.18, 0.14), { p: [a.x - Math.sin(yaw) * 0.09, a.y + hp + h / 2, a.z - Math.cos(yaw) * 0.09], r: [0, yaw, 0] }), '#3b363c'));
    B.add(paint(place(capsule(0.14, w * 0.9, 2, 5), { p: [a.x, a.y + hp + h + 0.12, a.z], r: [0, yaw, Math.PI / 2] }), SNOW));
    planes.push(place(signPlane(w, h, row, atlas.rows), { p: [a.x, a.y + hp + h / 2, a.z], r: [0, yaw, 0] }));
    B.blob(a.x, a.z, 1.5, 0.3);
  };
  sign(0.255, 11, 0, 9.5, 1.5, 2.6); sign(0.398, 11.5, 1, 4.6, 1.4); sign(0.59, 15, 2, 6.4, 1.5); sign(0.718, 11, 3, 9.6, 1.4); sign(0.777, -11, 4, 4.6, 1.4); sign(0.988, 12, 5, 5.2, 1.4);
  sign(0.06, -12, 9, 5.6, 1.3, 2.2, 0.2); sign(0.77, 12, 10, 8, 1.2, 2.2, -0.2); sign(0.15, 11, 13, 3.2, 1.2, 2.4, 0.15); sign(0.64, 15, 13, 3.2, 1.2, 2.4, 0.15); sign(0.855, -11, 11, 5.6, 1.3, 2.3, 0.2);
  for (const m of [0.205, 0.525, 0.545]) {
    const p = P(m), s = track.curvature[p.i] > 0 ? -1 : 1;
    sign(m, s * (p.w / 2 + 5), 8, 3.4, 1, 0.9, s * -0.3);
  }
  // over the doors of the hamlet, on the fronts that face the road
  { let k = 0; for (const b of world.buildings) { if (b.kind !== 'house' || !b.near) continue; const row = [14, 12, 14, 11][k % 4]; k++; if (k % 2) continue;
    const y = groundAt(b.x, b.z) + 3.05, g = signPlane(4.2, 0.8, row, atlas.rows), L0 = 10 + (hash3(b.seed, 2, 3) - 0.5) * 2.4;
    place(g, { p: [b.x + Math.sin(b.yaw) * (L0 / 2 + 0.2), y, b.z + Math.cos(b.yaw) * (L0 / 2 + 0.2)], r: [0, b.yaw, 0] }); planes.push(g); } }
  const signsMesh = new THREE.Mesh(mergeUV(planes), mat('#ffffff', { map: true }));
  signsMesh.material.map = atlas.texture;
  signsMesh.material.needsUpdate = true;
  world.staticGroup.add(signsMesh);

  // what stands by a road up here and nowhere else: the shrines at the field corners, snow guns along the piste
  for (const [u, d] of [[0.112, -12.5], [0.752, -12.5], [0.605, 14]]) { const a = atRoad(u, d), sg = Math.sign(d); B.add(place(capitello(), { p: [a.x, a.y - 0.08, a.z], r: [0, Math.atan2(-a.p.nx * sg, -a.p.nz * sg) + 0.25 * sg, 0] })); B.blob(a.x, a.z, 1.8, 0.35); }
  for (const [u, d] of [[0.075, 12.5], [0.705, -12.5], [0.85, -12.5]]) { const a = atRoad(u, d), sg = Math.sign(d); B.add(place(crucifix(), { p: [a.x, a.y - 0.1, a.z], r: [0, Math.atan2(-a.p.nx * sg, -a.p.nz * sg) + 0.3 * sg, 0] })); B.blob(a.x, a.z, 0.8, 0.3); }
  for (const [u, d] of [[0.418, -10.5], [0.482, 11], [0.525, 11.5], [0.578, 10.5]]) { const a = atRoad(u, d), sg = Math.sign(d); B.add(place(snowGun(), { p: [a.x, a.y - 0.05, a.z], r: [0, Math.atan2(-a.p.nx * sg, -a.p.nz * sg), 0], s: 1.15 })); B.blob(a.x, a.z, 1.2, 0.3); }
  // the white is never one plane: long wind drifts lying on the ground as it is, alder through the snow by the road, a cross-country track alongside
  for (let i = 0; i < 64; i++) {
    const u = hash3(i, 1, 71), side = hash3(i, 2, 71) < 0.5 ? -1 : 1;
    if ((u > 0.87 && u < 0.965) || (u > 0.33 && u < 0.4)) continue;
    const a = atRoad(u, side * (P(u).w / 2 + 5 + 26 * hash3(i, 3, 71) ** 1.5));
    if (Math.hypot(a.x - LAKE.x, a.z - LAKE.z) < LAKE.r + 8 || Math.abs(track.nearest(a.x, a.z).d) < P(u).w / 2 + 4) continue;
    driftOn(a.x, a.z, 3 + 6 * hash3(i, 4, 71), 1.5 + 2.2 * hash3(i, 5, 71), 0.22 + 0.34 * hash3(i, 6, 71), a.yaw + 1.2 * (hash3(i, 7, 71) - 0.5), i, 10, 3);
  }
  for (let i = 0; i < 56; i++) {
    const u = hash3(i, 1, 73), side = hash3(i, 2, 73) < 0.5 ? -1 : 1;
    if ((u > 0.33 && u < 0.4) || (u > 0.435 && u < 0.472)) continue;
    const a = atRoad(u, side * (P(u).w / 2 + 4.5 + 20 * hash3(i, 3, 73)));
    if (Math.hypot(a.x - LAKE.x, a.z - LAKE.z) < LAKE.r + 4 || Math.abs(track.nearest(a.x, a.z).d) < P(u).w / 2 + 3.5) continue;
    B.add(place(shrub(i), { p: [a.x, a.y, a.z], r: [0, i, 0], s: 0.9 + 0.7 * hash3(i, 4, 73) }));
  }
  for (const [u0, u1, d] of [[0.012, 0.095, -15.5], [0.735, 0.858, 16.5], [0.47, 0.598, 17]]) {
    for (const off of [-0.2, 0.2]) {
      const rows = [];
      for (let u = u0; u < u1; u += 0.0018) { const w = d + 2.4 * Math.sin(u * 130) + off, a = atRoad(u, w - 0.06), b = atRoad(u, w + 0.06); rows.push([[a.x, a.y + 0.05, a.z], [b.x, b.y + 0.05, b.z]]); }
      B.add(strip(rows, 0, '#bcc0df'));
    }
  }

  { const dm = new THREE.Mesh(merge(drifts), bankMesh.material); dm.frustumCulled = false; world.staticGroup.add(dm); }

  // the start gate: two timber posts, the banner, a heap of snow at each foot
  {
    const a = atRoad(0.0, 0), wd = a.p.w / 2 + 2.6, yaw = a.yaw, parts = [], nx2 = a.p.nx, nz2 = a.p.nz;
    for (const s of [-1, 1]) {
      parts.push(place(paint(capsule(0.5, 8.4, 3, 9), '#6e4528', 4), { p: [a.x + nx2 * wd * s, a.y + 4.2, a.z + nz2 * wd * s] }));
      parts.push(place(paint(sphere(0.78, 10, 8), SNOW), { p: [a.x + nx2 * wd * s, a.y + 9.1, a.z + nz2 * wd * s] }));
      parts.push(place(paint(sphere(1.5, 9, 6), SNOW), { p: [a.x + nx2 * wd * s, a.y + 0.1, a.z + nz2 * wd * s], r: [0, 0, 0], s: [1.2, 0.5, 1.2] }));
    }
    parts.push(place(paint(box(wd * 2 + 1, 1.9, 0.3), '#3b2a22'), { p: [a.x, a.y + 7.8, a.z], r: [0, yaw, 0] }));
    parts.push(place(paint(capsule(0.2, wd * 2, 2, 6), SNOW), { p: [a.x, a.y + 8.86, a.z], r: [0, yaw, Math.PI / 2] }));
    B.add(merge(parts));
    const ban = signPlane(wd * 2 - 0.2, 1.72, 7, atlas.rows), b2 = signPlane(wd * 2 - 0.2, 1.72, 7, atlas.rows);
    place(ban, { p: [a.x - a.p.tx * 0.17, a.y + 7.8, a.z - a.p.tz * 0.17], r: [0, yaw + Math.PI, 0] });
    place(b2, { p: [a.x + a.p.tx * 0.17, a.y + 7.8, a.z + a.p.tz * 0.17], r: [0, yaw, 0] });
    world.staticGroup.add(new THREE.Mesh(mergeUV([ban, b2]), signsMesh.material));
  }

  // chamois on the slope and marmots that should be asleep at this time of year, keeping an eye on the race from the wood
  const chamois = blobAnimal('#7b6248', 1.05, '#2e2620');
  for (const [u, d, turn] of [[0.655, -20, 0.2], [0.12, -12, 0.5], [0.165, 12, -0.3], [0.77, -13, 0.3]]) {
    const a = atRoad(u, d), sg = Math.sign(d), g = chamois.clone();
    place(g, { p: [a.x, a.y, a.z], r: [0, Math.atan2(-a.p.nx * sg, -a.p.nz * sg) + turn, 0] }); B.add(g); B.blob(a.x, a.z, 0.9, 0.34);
  }
}

const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), ONE = new THREE.Vector3(1, 1, 1);
function placeChairs(time) {
  const T = liftState;
  if (!T) return;
  const loop = 2 * T.L, v = 2.6, phase = (time * v) % loop;
  T.meshes.forEach((m, k) => {
    const list = T.lists[k];
    for (let q = 0; q < list.length; q++) {
      const s = (list[q] * T.spacing + phase) % loop, up = s < T.L, t = up ? s / T.L : (loop - s) / T.L, side = up ? 1 : -1;
      V.set(LIFT_A[0] + T.lx * t + T.nx * side * LIFT_SEP / 2, T.cableY(t), LIFT_A[1] + T.lz * t + T.nz * side * LIFT_SEP / 2);
      E.set(0, T.yawL + (up ? 0 : Math.PI), 0.03 * Math.sin(time * 0.9 + q));
      Q.setFromEuler(E);
      m.setMatrixAt(q, M.compose(V, Q, ONE));
    }
    m.instanceMatrix.needsUpdate = true;
  });
}

function placeSkaters(time) {
  if (!skaters) return;
  for (const K of skaters) {
    K.list.forEach((q, i) => {
      const t = q.a + time * q.w * q.dir, x = LAKE.x + Math.cos(t) * q.r, z = LAKE.z + 6 + Math.sin(t) * q.r;
      V.set(x, K.groundAt(x, z) + 0.12, z);
      E.set(0, Math.atan2(-Math.sin(t) * q.dir, Math.cos(t) * q.dir), -0.14 * q.dir);
      Q.setFromEuler(E);
      K.mesh.setMatrixAt(i, M.compose(V, Q, ONE));
    });
    K.mesh.instanceMatrix.needsUpdate = true;
  }
}

export function update(time) {
  placeChairs(time);
  placeSkaters(time);
}
