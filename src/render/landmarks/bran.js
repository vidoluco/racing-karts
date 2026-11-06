// Bran sotto la Luna: the Bran pass on a friendly moonlit night. Facts in docs/references/bran.md and romania.md. Things are placed by u, the fraction of the lap,
// and d, metres to the left of the road's centre, so a retuned road carries its village with it. Scenery only: the castle and the fortified church are never hit by anything, and no road runs through them.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { hash3, lerp, smooth, linear } from '../math.js';
import { blobAnimal } from '../props.js';
import { merge, paint, place, box, sphere, capsule, cylinder, cone, gable, tube, quad, lathe } from '../shapes.js';

// Colours of the place in daylight: the night is the light's job, not the paint's. Roofs a little hotter than life, so that they still read as tile under a blue moon.
// the castle's walls take the floodlights it has at night: warmer and brighter than paint can be, numbers over 1 are that light
const FLOOD = (hex, k = 1.5) => linear(hex).map((v, i) => v * k * [1.12, 1, 0.8][i]);
const CREAM = FLOOD('#f3e7cf'), CREAM_D = FLOOD('#e2d0b0'), TILE = FLOOD('#e4602c', 1.18), TILE_D = FLOOD('#c24a24', 1.18), BARE = FLOOD('#d0813f', 1.4), ROUGH = FLOOD('#8b8170', 1.5);
const TILE_N = '#d9622f', TILE_ND = '#b84c27', TIMBER = '#4a3020', WOOD = '#7a5636', WOOD_D = '#54391f', WOOD_L = '#a98258', HAY = '#a8945c', WHITE = '#e8e2d2', PLINTH = '#8d877b', BAR = '#2a2420';
// faded limewash: at night a saturated pastel goes lilac under the moon
const PASTELS = ['#dcc48c', '#e4dac0', '#b4c2c4', '#d9ae96', '#b8c4a0', '#e0b98e'];

// A square-ish window in a wall that looks along `ry`, lit from inside: goes into the mesh of lights, unlit paint with values over 1 for the bloom. Not every room is lit and no two burn alike.
const GLOW = [[1.9, 1.14, 0.5], [1.45, 0.84, 0.36], [1.05, 0.56, 0.24], [2.1, 1.32, 0.62]], DARK = [0.035, 0.05, 0.085];
const lit = (out, x, y, z, ry = 0, w = 0.9, h = 1.2) => {
  const t = hash3(Math.round(x * 3), Math.round(y * 3), Math.round(z * 3));
  out.push(paint(place(box(w, h, 0.12), { p: [x, y, z], r: [0, ry, 0] }), t < 0.16 ? DARK : GLOW[Math.floor(t * 97) % 4], 0, (px, py) => (py > y ? 0.8 : 1)));
};
const ringWindows = (out, cx, cz, r, y, n, off = 0, w = 0.8, h = 1.15) => { for (let i = 0; i < n; i++) { const a = off + i / n * 6.2832; lit(out, cx + Math.sin(a) * (r + 0.02), y, cz + Math.cos(a) * (r + 0.02), a, w, h); } };
// A proper window: a pale frame, the lit panes, a cross of glazing bars, a sill. Four boxes, for the windows a driver passes close to.
const win = (parts, L, x, y, z, ry = 0, w = 1, h = 1.3, frame = '#e8e2d2') => {
  const sn = Math.sin(ry), cs = Math.cos(ry), at = (o, dy = 0) => [x + sn * o, y + dy, z + cs * o], r = [0, ry, 0];
  parts.push(paint(place(box(w + 0.3, h + 0.3, 0.07), { p: at(0), r }), frame));
  lit(L, ...at(0.02), ry, w, h);
  parts.push(paint(place(box(0.07, h, 0.05), { p: at(0.1), r }), BAR), paint(place(box(w, 0.07, 0.05), { p: at(0.1, h * 0.12), r }), BAR));
  parts.push(paint(place(box(w + 0.46, 0.1, 0.26), { p: at(0.09, -h / 2 - 0.17), r }), '#b4ae9e'));
};
// plaster dark and damp at the foot of the wall
const footShade = (x, y) => lerp(0.76, 1, smooth(0, 2.6, y));

// A hipped roof over a w by d footprint: y 0 at the eaves, the ridge h up and 2 rl long along x.
const hipRoof = (w, d, h, rl) => {
  const hw = w / 2, hd = d / 2, g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-hw, 0, hd, hw, 0, hd, rl, h, 0, -rl, h, 0, hw, 0, -hd, -hw, 0, -hd], 3));
  g.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 3, 4, 3, 2, 1, 4, 2, 5, 0, 3]);
  const n = g.toNonIndexed(); n.computeVertexNormals();
  n.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2));
  return mergeVertices(n, 1e-4);
};

// Bran Castle as it stands, squat and lopsided, plain cream plaster, left to right as the road sees it: one fat round tower with a skirt roof and a tall steep cone; low crenellated walls; the taller square keep
// with its steep hipped roof and a small lantern on the ridge; a lower gabled wing; a square tower at the far right, its top storey in bare stone. No two roofs alike: that is what makes it this castle and no other.
// Local: +x to the right of the road's view, +z toward whoever looks at it, y 0 on top of the rock; everything runs down into the rock.
export function castle() {
  const P = [], L = [];
  const shade = (x, y) => lerp(0.8, 1, smooth(-8, 8, y));
  const finial = (x, y, z) => { P.push(paint(place(capsule(0.2, 2.6, 2, 5), { p: [x, y, z] }), '#b9a35a')); };
  const pyramid = (x, y, z, w, d, h, col = TILE) => { const c = cone(1, 1, 4); c.rotateY(Math.PI / 4); P.push(paint(place(c, { p: [x, y + h / 2, z], s: [w / 1.414, h, d / 1.414] }), col, 3)); };
  const merlons = (x0, x1, z, y, n, zz = 1.3) => { for (let i = 0; i < n; i++) P.push(paint(place(box(1.5, 1.9, zz), { p: [lerp(x0, x1, n > 1 ? i / (n - 1) : 0.5), y + 0.95, z] }), CREAM_D, 5)); };
  const chimney = (x, y, z, h = 3.4) => { P.push(paint(place(box(1.5, h, 1.5), { p: [x, y + h / 2, z] }), CREAM_D, 5), paint(place(box(2, 0.5, 2), { p: [x, y + h + 0.1, z] }), ROUGH)); };
  // the fat round tower
  const bx = -31, bz = 2;
  P.push(paint(place(lathe([[14, -18], [12.6, 0], [12.1, 14], [12.7, 16]], 30), { p: [bx, 0, bz] }), CREAM, 5, shade));
  P.push(paint(place(lathe([[14.6, 15.2], [7.8, 22.8]], 30), { p: [bx, 0, bz] }), TILE_D, 3));
  P.push(paint(place(cylinder(7.5, 7.7, 7, 24), { p: [bx, 25, bz] }), CREAM, 5));
  P.push(paint(place(lathe([[9.8, 27.8], [7.2, 31.5], [3.5, 42], [0.12, 57]], 24), { p: [bx, 0, bz] }), TILE, 3));
  finial(bx, 58.4, bz);
  ringWindows(L, bx, bz, 12.2, 9, 6, 0.3, 1, 1.5); ringWindows(L, bx, bz, 7.6, 25, 5, 0.1, 0.9, 1.3);
  // the low crenellated walls between the tower and the keep, a long low roof behind them
  P.push(paint(place(box(20, 28, 5), { p: [-11, -2, 7] }), CREAM_D, 5, shade));
  merlons(-20, -2, 8.6, 12, 7);
  P.push(paint(place(box(20, 14, 12), { p: [-11, 5, -1.5] }), CREAM_D, 5));
  const rr = gable(12, 21, 12, 6, 0.6);
  P.push(paint(place(rr.roof, { p: [-11, 0, -1.5], r: [0, Math.PI / 2, 0] }), TILE_D, 3));
  chimney(-14, 15.5, -1, 3.2); chimney(-7, 15.5, -2, 3.2);
  for (const x of [-16, -6]) lit(L, x, 7, 9.56, 0, 1, 1.4);
  // the taller square keep, its overhanging battlement storey, the steep hipped roof and the small lantern on the ridge
  const kx = 6, kz = -2, kt = 38;
  P.push(paint(place(box(22, 52, 16), { p: [kx, kt - 26, kz] }), CREAM, 5, shade));
  P.push(paint(place(box(23.6, 2.4, 17.6), { p: [kx, kt + 0.6, kz] }), CREAM_D, 5));
  merlons(kx - 11, kx + 11, kz + 8.4, kt + 1.8, 8); merlons(kx - 11, kx + 11, kz - 8.4, kt + 1.8, 8);
  P.push(paint(place(hipRoof(21, 15, 18, 3.6), { p: [kx, kt + 1.6, kz] }), TILE, 3));
  const ly = kt + 19.6;
  P.push(paint(place(box(6.4, 0.7, 6.4), { p: [kx, ly, kz] }), WOOD_D));
  for (const [dx, dz] of [[-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5], [2.5, 2.5]]) P.push(paint(place(box(0.55, 4.2, 0.55), { p: [kx + dx, ly + 2.3, kz + dz] }), WOOD_D));
  lit(L, kx, ly + 2.2, kz, 0, 3.8, 3); lit(L, kx, ly + 2.2, kz, Math.PI / 2, 3.8, 3);
  pyramid(kx, ly + 4.4, kz, 7.6, 7.6, 6.4);
  finial(kx, ly + 11.8, kz);
  chimney(kx - 8, kt + 2, kz + 3, 8);
  for (const y of [13, 22, 31]) for (const x of [-6.5, 0.5, 6.5]) if (y + x !== 22.5) lit(L, kx + x, y, kz + 8.06, 0, 1.15, 1.6);
  for (const y of [14, 28]) { lit(L, kx - 11.06, y, kz, Math.PI / 2, 1.1, 1.5); lit(L, kx + 11.06, y, kz + 3, Math.PI / 2, 1.1, 1.5); }
  // the lower wing with its one gable
  const wx = 25, wz = 1, W1 = gable(14, 18, 15, 12, 0.8);
  P.push(paint(place(W1.walls, { p: [wx, 0, wz] }), CREAM, 5, shade), paint(place(W1.roof, { p: [wx, 0, wz] }), TILE_D, 3), paint(place(box(14, 24, 18), { p: [wx, -11, wz] }), CREAM_D, 5));
  for (const x of [-3.6, 3.6]) lit(L, wx + x, 9, wz + 9.06, 0, 1.1, 1.5);
  lit(L, wx, 19, wz + 9.06, 0, 1.2, 1.5);
  // the square tower at the far right: plaster below, bare stone above, a plain pyramid
  const rx = 39.5, rz = -2;
  P.push(paint(place(box(12.5, 40, 12.5), { p: [rx, 5, rz] }), CREAM, 5, shade));
  P.push(paint(place(box(13.3, 12, 13.3), { p: [rx, 29, rz] }), ROUGH, 1));
  pyramid(rx, 35, rz, 15.2, 15.2, 13);
  finial(rx, 49.2, rz);
  for (const y of [12, 29]) { lit(L, rx, y, rz + 6.72, 0, 1.2, 1.6); lit(L, rx + 6.72, y, rz, Math.PI / 2, 1.2, 1.6); lit(L, rx - 6.72, y, rz, Math.PI / 2, 1.2, 1.6); }
  return { solid: merge(P), lights: L.length ? merge(L) : null };
}

// Value noise, for the rock: nothing here runs per frame.
const vn = (x, y, s) => {
  const i = Math.floor(x), j = Math.floor(y), f = x - i, g = y - j, u = f * f * (3 - 2 * f), v = g * g * (3 - 2 * g);
  return lerp(lerp(hash3(i, j, s), hash3(i + 1, j, s), u), lerp(hash3(i, j + 1, s), hash3(i + 1, j + 1, s), u), v);
};

// A welded round lump for a bush or a boulder: a sphere has a seam, and its light breaks along it; `rough` is how far the shape strays from round.
const lump = (seed, rough = 0.5, detail = 2) => {
  const raw = new THREE.IcosahedronGeometry(1, detail);
  raw.deleteAttribute('normal'); raw.deleteAttribute('uv');
  const g = mergeVertices(raw, 1e-4), q = g.attributes.position;
  for (let v = 0; v < q.count; v++) { const m = 1 + rough * (vn(q.getX(v) * 1.4 + seed, q.getY(v) * 1.4 + q.getZ(v), 61) - 0.5); q.setXYZ(v, q.getX(v) * m, q.getY(v) * m, q.getZ(v) * m); }
  g.computeVertexNormals();
  return g;
};

// The surface of a limestone outcrop: bent, tilted beds that stand proud in shelves and recede in shadowed bands, broad buttresses, narrow at the top. a: angle round it; t: 0 at the foot, 1 on the rim. Local: y 0 is the top.
function outcropAt(a, t, { height, top, base, seed, max = 1e9 }) {
  const ca = Math.cos(a), sa = Math.sin(a), y = -height * (1 - t);
  const lobes = (vn(ca * 1.5 + 5, sa * 1.5 + 2, seed) - 0.5) * 0.42 + (vn(ca * 3.3 + 2, sa * 3.3 + 7, seed + 1) - 0.5) * 0.2;
  // joints: buttresses and gullies that run down the rock, leaning a little as they fall
  const gully = 1 - Math.abs(2 * vn(ca * 5.4 + 1.3 + y * 0.012, sa * 5.4 + 4, seed + 8) - 1), joints = (gully - 0.55) * 7 * (0.35 + 0.65 * vn(ca * 2 + 7, sa * 2 + 3 + y * 0.02, seed + 9));
  // the beds: thick and uneven, bent across the rock, proud only where a slow noise lets them be. Everywhere and even, they were the rings of a beehive
  const bed = (y + 4.4 * ca + 2.4 * sa + 7 * vn(ca * 2.1 + 3, sa * 2.1 + y * 0.03, seed + 2)) / 4.7, f = bed - Math.floor(bed), shelf = smooth(0, 0.2, f) * (1 - smooth(0.55, 1, f));
  const proud = smooth(0.42, 0.66, vn(ca * 3.3 + 9, sa * 3.3 + y * 0.05, seed + 5));
  const r = lerp(base, top, Math.pow(t, 0.72)) * (1 + lobes * (1 - 0.35 * t)) + (joints + (shelf - 0.5) * 2.8 * proud) * Math.min(1, height / 52) + (vn(ca * 19 + 4, t * 13 + sa * 19, seed + 4) - 0.5) * 1.3;
  const rr = Math.min(max, Math.max(top - 2, r));
  return { x: Math.sin(a) * rr, y, z: Math.cos(a) * rr, bed, f, gully };
}
function limestone({ height = 60, top = 31, base = 52, segs = 104, rings = 48, seed = 3 } = {}) {
  const O = { height, top, base, seed }, pos = [], idx = [], beds = [], gull = [];
  for (let j = 0; j <= rings; j++) for (let i = 0; i < segs; i++) {
    const q = outcropAt(i / segs * 6.2832, j / rings, O);
    pos.push(q.x, q.y, q.z); beds.push(q.bed, q.f, j / rings); gull.push(q.gully);
  }
  for (let j = 0; j < rings; j++) for (let i = 0; i < segs; i++) {
    const a = j * segs + i, b = j * segs + (i + 1) % segs, c = a + segs, d = b + segs;
    idx.push(a, c, b, b, c, d);
  }
  // the top, a little dome that nothing sees from below
  const cn = pos.length / 3;
  pos.push(0, 0.6, 0); beds.push(0, 0.5, 1); gull.push(0.5);
  for (let i = 0; i < segs; i++) idx.push(rings * segs + i, cn, rings * segs + (i + 1) % segs);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // the colour: grey tan stone by bed, dark in the joints, soil and moss on whatever faces up, darker toward the wooded foot
  const n = pos.length / 3, N = g.attributes.normal, col = new Float32Array(n * 3);
  const A = linear('#655f50'), B = linear('#575244'), D = linear('#322e26'), M = linear('#34482f'), W = linear('#202b25');
  for (let i = 0; i < n; i++) {
    const [bed, f, t] = [beds[i * 3], beds[i * 3 + 1], beds[i * 3 + 2]], x = pos[i * 3], z = pos[i * 3 + 2], ny = N.getY(i);
    const tone = hash3(Math.floor(bed), 3, seed + 6), joint = 1 - smooth(0, 0.14, f), blot = vn(x * 0.09 + 3, z * 0.09 + pos[i * 3 + 1] * 0.12, seed + 7);
    const c = [0, 1, 2].map((k) => {
      let v = lerp(A[k], B[k], tone) * (0.72 + 0.5 * blot);
      v = lerp(v, D[k], Math.max(joint * 0.55 * smooth(0.4, 0.7, gull[i] + blot * 0.3), smooth(0.72, 0.98, gull[i]) * 0.7));
      v = lerp(v, M[k], smooth(0.34, 0.62, ny + (blot - 0.5) * 0.5) * 0.85);
      v = lerp(v, W[k], (1 - smooth(0.02, 0.3, t + (blot - 0.5) * 0.2)) * 0.8);
      // the castle's floodlights spill over the lip of the rock, so that the walls grow out of lit stone
      return v * lerp(1, [2.5, 1.95, 1.35][k], smooth(0.68, 1, t + (blot - 0.5) * 0.08));
    });
    col.set(c, i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
  g.setAttribute('aPaint', new THREE.Float32BufferAttribute(new Float32Array(n).fill(9), 1));
  return g;
}

// The castle's rock as it is: modest, standing straight over the road and the village, clothed in beech to the walls, with pale limestone showing only in patches that stand out of the trees.
const palePatch = (a, t) => t > 0.3 && vn(Math.cos(a) * 3.4 + 3, Math.sin(a) * 3.4 + t * 2.6, 44) + 0.16 * t > 0.68;
function castleRock(O) {
  const segs = 112, rings = 34, pos = [], col = [], green = [], stone = [];
  const C1 = linear('#2f5e3e'), C2 = linear('#47794e'), C3 = linear('#274e38'), S1 = linear('#a8a08a'), S2 = linear('#8c8470');
  for (let j = 0; j <= rings; j++) for (let i = 0; i < segs; i++) {
    const a = i / segs * 6.2832, t = j / rings, q = outcropAt(a, t, O), pale = palePatch(a, t), k = pale ? 1.018 : 1;
    pos.push(q.x * k, q.y, q.z * k);
    const b = vn(Math.cos(a) * 7 + 1, Math.sin(a) * 7 + t * 6, 45), lift = lerp(1, 1.3, smooth(0.7, 1, t));
    const c = pale ? [0, 1, 2].map((m) => lerp(S2[m], S1[m], b) * lift) : [0, 1, 2].map((m) => (b < 0.5 ? lerp(C3[m], C1[m], b * 2) : lerp(C1[m], C2[m], b * 2 - 1)));
    col.push(...c);
  }
  for (let j = 0; j < rings; j++) for (let i = 0; i < segs; i++) {
    const a = j * segs + i, b = j * segs + (i + 1) % segs, c = a + segs, d = b + segs;
    (palePatch((i + 0.5) / segs * 6.2832, (j + 0.5) / rings) ? stone : green).push(a, c, b, b, c, d);
  }
  const make = (idx, kind) => {
    const g = new THREE.BufferGeometry(), n = pos.length / 3;
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
    g.setAttribute('aPaint', new THREE.Float32BufferAttribute(new Float32Array(n).fill(kind), 1));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  };
  return [make(green, 15), make(stone, 9)];
}

// A house of the Bran valley: limewash over a stone foot, a dark wooden gallery on the upper floor, a tall tile or shingle roof, warm windows, a door with its step.
function casa({ w = 8, l = 11, floors = 2, seed = 1, near = true }, L) {
  const parts = [], fh = 2.9, H = floors * fh, tile = seed % 3 !== 0;
  parts.push(paint(place(box(w + 0.3, 6.4, l + 0.3), { p: [0, -2.7, 0] }), PLINTH, 1));
  const { walls, roof } = gable(w, l, H, w * 0.62, 1);
  parts.push(paint(walls, seed % 4 === 2 ? '#e2d3b6' : WHITE, 6, footShade), paint(roof, tile ? (seed % 2 ? TILE_N : TILE_ND) : '#6d5a4c', 3));
  // the gallery
  const gy = fh + 0.15;
  parts.push(paint(place(box(w - 0.4, 0.2, 1.3), { p: [0, gy, l / 2 + 0.65] }), WOOD_D));
  for (let i = -4; i <= 4; i++) parts.push(paint(place(box(0.2, 1, 0.09), { p: [i * ((w - 0.9) / 8), gy + 0.55, l / 2 + 1.25] }), WOOD));
  parts.push(paint(place(box(w - 0.4, 0.14, 0.14), { p: [0, gy + 1.1, l / 2 + 1.25] }), WOOD_D));
  parts.push(paint(place(box(1.7, 2.5, 0.1), { p: [-w * 0.27, 1.2, l / 2 + 0.03] }), '#e8e2d2'), paint(place(box(1.4, 2.3, 0.14), { p: [-w * 0.27, 1.12, l / 2 + 0.05] }), WOOD_D, 2), paint(place(box(2, 0.22, 0.8), { p: [-w * 0.27, 0.02, l / 2 + 0.4] }), PLINTH));
  for (let f = 0; f < floors; f++) {
    const y = f * fh + 1.55;
    for (const x of [-w * 0.27, w * 0.27]) if (!(f === 0 && x < 0)) {
      if (near) {
        win(parts, L, x, y, l / 2 + 0.04, 0, 1, 1.25);
        for (const q of [-1, 1]) parts.push(paint(place(box(0.46, 1.5, 0.07), { p: [x + q * 0.86, y, l / 2 + 0.06] }), '#4e6470', 2));
      } else lit(L, x, y, l / 2 + 0.06, 0, 1, 1.25);
    }
    lit(L, -w * 0.27, y, -l / 2 - 0.06, 0, 1, 1.25); lit(L, w * 0.27, y, -l / 2 - 0.06, 0, 1, 1.25);
    for (const z of [-l * 0.25, l * 0.25]) for (const q of [1, -1]) { if (near) win(parts, L, q * (w / 2 + 0.04), y, z, q * Math.PI / 2, 1, 1.25); else lit(L, q * (w / 2 + 0.06), y, z, Math.PI / 2, 1, 1.25); }
  }
  parts.push(paint(place(box(0.9, 2.6, 0.9), { p: [w * 0.2, H + w * 0.4, -l * 0.2] }), '#a8a29a', 1));
  return merge(parts);
}

// A Saxon house as in Viscri and Hărman: long and low, gable to the street, a faded limewash front with moulded frames round three windows, a band under the gable, an attic hatch, a stone foot.
function saxon({ w = 8.5, l = 17, seed = 1 }, L) {
  const parts = [], H = 4;
  const c = PASTELS[seed % PASTELS.length], z = l / 2;
  parts.push(paint(place(box(w + 0.2, 5, l + 0.2), { p: [0, -2.1, 0] }), PLINTH, 1));
  const { walls, roof } = gable(w, l, H, 5.6, 0.7);
  parts.push(paint(walls, c, 5, footShade), paint(roof, seed % 2 ? TILE_N : TILE_ND, 3));
  // the moulded band under the gable, corner pilasters, and a darker painted foot
  parts.push(paint(place(box(w + 0.2, 0.3, 0.2), { p: [0, H + 0.1, z + 0.04] }), '#e6dfcd'));
  parts.push(paint(place(box(w + 0.1, 0.7, 0.07), { p: [0, 0.32, z + 0.02] }), '#8b8474', 1));
  for (const s of [-1, 1]) parts.push(paint(place(box(0.42, H, 0.12), { p: [s * (w / 2 - 0.2), H / 2, z + 0.03] }), '#e6dfcd'));
  for (const x of [-w * 0.28, 0, w * 0.28]) {
    win(parts, L, x, 2.25, z + 0.04, 0, 1.05, 1.4, '#ece6d6');
    // the cornice over a frame, the one flourish a farmhouse allows itself
    parts.push(paint(place(box(1.75, 0.16, 0.2), { p: [x, 3.16, z + 0.08] }), '#e6dfcd'));
  }
  win(parts, L, 0, H + 1.7, z + 0.04, 0, 0.8, 0.9, '#d8d0bc');
  for (const q of [-l * 0.3, -l * 0.1, l * 0.1, l * 0.3]) for (const f of [1, -1]) win(parts, L, f * (w / 2 + 0.04), 2.2, q, f * Math.PI / 2, 0.9, 1.2, '#ece6d6');
  // down the long side: a stone foot, pilasters between the windows, a band under the eaves
  for (const f of [1, -1]) {
    parts.push(paint(place(box(0.1, 0.8, l), { p: [f * (w / 2 + 0.03), 0.36, 0] }), '#8b8474', 1), paint(place(box(0.12, 0.26, l), { p: [f * (w / 2 + 0.04), H - 0.2, 0] }), '#e6dfcd'));
    for (const q of [-0.4, -0.2, 0, 0.2, 0.4]) parts.push(paint(place(box(0.1, H - 1, 0.42), { p: [f * (w / 2 + 0.04), H / 2 + 0.1, q * l] }), '#e6dfcd'));
  }
  return merge(parts);
}

// What makes a Saxon street: the plastered wall that closes the gap from one house's gable to the next, tiled along its top, and in it the great round arched cart gate, with a wicket in its boards. +z to the street, x along it, centred.
function streetWall({ len = 14, seed = 1 }) {
  const parts = [], H = 5.4, c = PASTELS[(seed + 2) % PASTELS.length], hw = len / 2, gw = 2.35, sp = 2.5;
  const s = new THREE.Shape();
  s.moveTo(-hw, -2.5); s.lineTo(hw, -2.5); s.lineTo(hw, H); s.lineTo(-hw, H); s.lineTo(-hw, -2.5);
  const hole = new THREE.Path();
  hole.moveTo(-gw, -0.05); hole.lineTo(-gw, sp); hole.absarc(0, sp, gw, Math.PI, 0, true); hole.lineTo(gw, -0.05); hole.lineTo(-gw, -0.05);
  s.holes.push(hole);
  const wall = new THREE.ExtrudeGeometry(s, { depth: 0.8, bevelEnabled: false, curveSegments: 10 });
  wall.translate(0, 0, -0.8);
  parts.push(paint(wall, c, 5, footShade));
  // the wall is built, not painted: a stone foot, pilasters, a moulding under the tiles, a small round window each side of the gate
  for (const q of [-1, 1]) {
    const x0 = q * (gw + 0.3), x1 = q * hw, mid = (x0 + x1) / 2, span = Math.abs(x1 - x0);
    if (span < 0.6) continue;
    parts.push(paint(place(box(span, 0.85, 0.12), { p: [mid, 0.4, 0.05] }), '#8b8474', 1));
    for (const f of [0, 0.5, 1]) parts.push(paint(place(box(0.42, H - 0.9, 0.14), { p: [lerp(x0, x1, f), (H + 0.8) / 2, 0.05] }), '#e6dfcd'));
    if (span > 3) { parts.push(paint(place(cylinder(0.55, 0.55, 0.1, 10), { p: [lerp(x0, x1, 0.25), 3.5, 0.03], r: [Math.PI / 2, 0, 0] }), '#e6dfcd'), paint(place(cylinder(0.36, 0.36, 0.12, 10), { p: [lerp(x0, x1, 0.25), 3.5, 0.06], r: [Math.PI / 2, 0, 0] }), BAR)); }
  }
  parts.push(paint(place(box(len, 0.24, 0.16), { p: [0, H - 0.28, 0.06] }), '#e6dfcd'));
  // the boards, set back in the arch, and the wicket
  const d = new THREE.Shape();
  d.moveTo(-gw, -0.05); d.lineTo(gw, -0.05); d.lineTo(gw, sp); d.absarc(0, sp, gw, 0, Math.PI, false); d.lineTo(-gw, -0.05);
  const door = new THREE.ExtrudeGeometry(d, { depth: 0.12, bevelEnabled: false, curveSegments: 10 });
  door.translate(0, 0, -0.5);
  parts.push(paint(door, WOOD, 2));
  parts.push(paint(place(box(0.1, sp + gw, 0.06), { p: [0, (sp + gw) / 2, -0.36] }), WOOD_D));
  for (const y of [0.7, 2.2]) parts.push(paint(place(box(gw * 1.86, 0.14, 0.06), { p: [0, y, -0.36] }), WOOD_D));
  parts.push(paint(place(box(0.95, 1.95, 0.06), { p: [gw * 0.5, 1, -0.35] }), WOOD_D, 2));
  // the ring of the arch, a pale moulding with its keystone
  const ring = [];
  for (let i = 0; i <= 12; i++) { const a = i / 12 * Math.PI; ring.push([Math.cos(a) * (gw + 0.14), sp + Math.sin(a) * (gw + 0.14), 0.03]); }
  parts.push(paint(tube(ring, 0.13, 5), '#e6dfcd'));
  parts.push(paint(place(box(0.5, 0.75, 0.2), { p: [0, sp + gw + 0.2, 0.06] }), '#d8d0bc'));
  for (const q of [-1, 1]) parts.push(paint(place(box(0.34, sp, 0.14), { p: [q * (gw + 0.14), sp / 2, 0.04] }), '#e6dfcd'));
  // its tiled top
  parts.push(paint(place(box(len + 0.3, 0.32, 1.5), { p: [0, H + 0.1, -0.4] }), TILE_N, 3));
  return merge(parts);
}

// A fortified church of the Brașov land, a cartoon of Prejmer: a low thick round wall under one long tile roof, with its rows of little store room shutters, and over it nothing but the one huge cross roof of the church, with a thin ridge turret. It must not read as a second castle: no tower, no cone, no cream. Stands well off the road, nothing touches it.
function fortified(L) {
  const P = [], R = 38, h = 13;
  // the wall, thick and battered, stone below and old lime above
  P.push(paint(lathe([[R + 2.6, -8], [R + 1.5, 3], [R + 0.8, h]], 60), '#b8ad98', 1, (x, y) => lerp(0.82, 1, smooth(-2, 6, y))));
  P.push(paint(lathe([[R + 3.4, h - 0.6], [R - 3.2, h + 6.4]], 60), TILE_D, 3));
  for (let i = 0; i < 40; i++) { const a = i / 40 * 6.2832; P.push(paint(place(box(0.8, 1.1, 0.14), { p: [Math.sin(a) * (R + 1.05), h - 2 - (i % 2) * 2.4, Math.cos(a) * (R + 1.05)], r: [0, a, 0] }), BAR)); }
  for (let i = 0; i < 12; i++) { const a = (i + 0.5) / 12 * 6.2832; lit(L, Math.sin(a) * (R + 1.3), 5.2, Math.cos(a) * (R + 1.3), a, 0.5, 1.4); }
  // the arched gate in the wall, facing the road
  P.push(paint(place(box(6, 7, 1.6), { p: [0, 3, R + 1.8] }), '#a89e8a', 1), paint(place(box(3.4, 5, 0.5), { p: [0, 2.2, R + 2.7] }), WOOD_D, 2));
  // the church: one huge steep roof each way, on low white walls
  for (const r of [0, Math.PI / 2]) {
    const G = gable(20, 42, 8, 21, 0.9);
    P.push(paint(place(G.walls, { p: [0, 2, 0], r: [0, r, 0] }), WHITE, 5), paint(place(G.roof, { p: [0, 2, 0], r: [0, r, 0] }), TILE, 3));
  }
  // the thin ridge turret on the crossing
  P.push(paint(place(box(3, 5, 3), { p: [0, 33, 0] }), WOOD_D, 2));
  const sp = cone(2.8, 9, 4); sp.rotateY(Math.PI / 4);
  P.push(paint(place(sp, { p: [0, 40, 0] }), TILE_D, 3), paint(place(capsule(0.14, 1.8, 2, 5), { p: [0, 45.2, 0] }), '#b9a35a'));
  for (const [x, z, a] of [[10.06, 13, Math.PI / 2], [-10.06, 13, Math.PI / 2], [10.06, -13, Math.PI / 2], [-10.06, -13, Math.PI / 2], [13, 10.06, 0], [-13, 10.06, 0], [13, -10.06, 0], [-13, -10.06, 0]]) lit(L, x, 7, z, a, 1, 3.4);
  return merge(P);
}

// A wooden gate of Maramureș, a gift from the Mocănița's country: oak uprights, a carved top beam with the sun and the rope, a shingled roof, standing across the road.
function maramuresGate(span, L) {
  const parts = [], H = 10.5, hw = span / 2, Oak = '#6a4a2c', OakD = '#4d341e', OakL = '#94704a';
  for (const s of [-1, 1]) {
    parts.push(paint(place(box(1.5, H + 4, 1.5), { p: [s * hw, (H + 4) / 2 - 2, 0] }), Oak, 2));
    parts.push(paint(place(box(1.3, H + 4, 1.3), { p: [s * (hw + 5.2), (H + 2.5) / 2 - 2, 0] }), Oak, 2));
    // the little side passage's own roof
    parts.push(paint(place(box(5.6, 0.7, 1), { p: [s * (hw + 2.6), H - 3.4, 0] }), Oak, 2));
    const q = gable(2.8, 6.8, 0.2, 1.1, 0.3);
    parts.push(paint(place(q.roof, { p: [s * (hw + 2.6), H - 3, 0], r: [0, Math.PI / 2, 0] }), '#4f4340', 3));
    // rope and sun cut into the uprights
    for (let y = 1; y < H; y += 1.5) for (const f of [-1, 1]) {
      parts.push(paint(place(cylinder(0.32, 0.32, 0.12, 8), { p: [s * hw, y, f * 0.76], r: [Math.PI / 2, 0, 0] }), OakL));
      parts.push(paint(place(box(0.14, 0.75, 0.1), { p: [s * hw, y + 0.75, f * 0.78], r: [0, 0, 0.5 * ((y | 0) % 2 ? 1 : -1)] }), OakD));
    }
    // the brace under the top beam: the gate's arch
    parts.push(paint(tube([[s * hw, H - 4, 0], [s * (hw - 1.4), H - 2, 0], [s * (hw - 3.8), H - 0.7, 0]], 0.3, 5), Oak));
  }
  // the top beam
  parts.push(paint(place(box(span + 2.4, 1.5, 1.2), { p: [0, H, 0] }), Oak, 2));
  parts.push(paint(place(box(span + 2.4, 0.2, 1.3), { p: [0, H - 0.5, 0] }), OakD));
  parts.push(paint(place(box(span + 2.4, 0.2, 1.3), { p: [0, H + 0.5, 0] }), OakD));
  for (const f of [-1, 1]) {
    for (let x = -hw + 1; x <= hw - 1; x += 2.1) {
      parts.push(paint(place(cylinder(0.42, 0.42, 0.1, 8), { p: [x, H, f * 0.63], r: [Math.PI / 2, 0, 0] }), OakL));
    }
    const sun = cylinder(1.25, 1.25, 0.14, 16); sun.rotateX(Math.PI / 2);
    parts.push(paint(place(sun, { p: [0, H + 0.1, f * 0.68] }), OakL));
    for (let k = 0; k < 8; k++) { const a = k / 8 * 6.2832; parts.push(paint(place(box(0.14, 0.75, 0.08), { p: [Math.sin(a) * 0.72, H + 0.1 + Math.cos(a) * 0.72, f * 0.76], r: [0, 0, -a] }), OakD)); }
  }
  // the long shingled roof with its upturned ends
  const r = gable(4.4, span + 14.5, 0.1, 2.1, 0.3);
  parts.push(paint(place(r.roof, { p: [0, H + 0.9, 0], r: [0, Math.PI / 2, 0] }), '#463a36', 3));
  for (const x of [-hw * 0.5, hw * 0.5]) lit(L, x, H - 0.85, 0, Math.PI / 2, 0.5, 0.5);
  return merge(parts);
}

// Market stall: a counter, posts, a striped awning, and what Bran sells: wool, sheepskin, cheese in bark, pots.
function stall(seed, L) {
  const parts = [], w = 5.6, d = 2.8, A = ['#d9483b', '#3e74b8', '#e0a63a', '#3f9f7a'][seed % 4], B = '#f6efd8';
  parts.push(paint(place(box(w, 1.05, d * 0.8), { p: [0, 0.53, 0] }), WOOD, 2));
  parts.push(paint(place(box(w + 0.2, 0.12, d * 0.86), { p: [0, 1.1, 0] }), WOOD_L));
  for (const x of [-1, 1]) for (const z of [-1, 1]) parts.push(paint(place(cylinder(0.07, 0.08, z > 0 ? 3 : 3.5, 5), { p: [x * w / 2, z > 0 ? 1.5 : 1.75, z * d / 2] }), WOOD_D));
  const n = 7, sw = (w + 0.6) / n;
  for (let i = 0; i < n; i++) {
    const x0 = -w / 2 - 0.3 + i * sw;
    parts.push(paint(quad([x0, 3, d / 2 + 0.5], [x0 + sw, 3, d / 2 + 0.5], [x0 + sw, 3.6, -d / 2 - 0.1], [x0, 3.6, -d / 2 - 0.1]), i % 2 ? A : B));
    parts.push(paint(quad([x0, 2.65, d / 2 + 0.55], [x0 + sw, 2.65, d / 2 + 0.55], [x0 + sw, 3, d / 2 + 0.5], [x0, 3, d / 2 + 0.5]), i % 2 ? A : B));
  }
  if (seed % 3 === 0) for (const x of [-2, -1, 0, 1, 2]) parts.push(paint(place(cylinder(0.3, 0.32, 0.5 + (x & 1) * 0.1, 8), { p: [x * 0.95, 1.42, 0] }), '#b08a58', 4)); // cheese in bark
  else if (seed % 3 === 1) for (const x of [-2, -1, 0, 1, 2]) parts.push(paint(place(sphere(0.42, 8, 6), { p: [x * 0.95, 1.46, 0], s: [1, 0.7, 1] }), ['#d9483b', '#f6efd8', '#3e74b8', '#6d4a3a', '#e0a63a'][(x + 2 + seed) % 5])); // rolled wool
  else for (const x of [-2, -1, 0, 1, 2]) parts.push(paint(place(lathe([[0.22, 0], [0.32, 0.2], [0.18, 0.5], [0.22, 0.65]], 8), { p: [x * 0.95, 1.16, 0] }), '#a65b36')); // pots
  // a sheepskin and a jumper hanging at the front
  parts.push(paint(place(box(0.9, 1.15, 0.07), { p: [-1.5, 2.15, d / 2 + 0.3] }), '#efe6d6'), paint(place(box(0.9, 1.15, 0.07), { p: [1.4, 2.15, d / 2 + 0.3] }), A));
  lit(L, 0, 2.4, 0, 0, 0.5, 0.5);
  return merge(parts);
}

// A hay stack of the Rucăr-Bran pass: the căpiță, built round a pole with the tip left bare.
function capita(seed = 1) {
  // hay stacked round a tall pole, in courses, shaggy, with the pole standing well clear of the top and two prop sticks under it
  const prof = [[1.25, 0], [1.75, 0.5], [1.85, 1.2], [1.6, 2], [1.28, 2.8], [0.82, 3.6], [0.36, 4.2], [0.1, 4.5]], g = lathe(prof, 12), q = g.attributes.position;
  for (let i = 0; i < q.count; i++) {
    const x = q.getX(i), y = q.getY(i), z = q.getZ(i), a = Math.atan2(x, z), m = 1 + 0.2 * (vn(a * 2.1 + seed, y * 1.9, 83) - 0.5) + 0.07 * Math.sin(y * 7.5 + seed);
    q.setXYZ(i, x * m, y, z * m);
  }
  g.computeVertexNormals();
  const parts = [paint(g, HAY, 13, (x, y) => lerp(0.68, 1.04, smooth(0, 1.4, y)))];
  parts.push(paint(place(cylinder(0.075, 0.12, 6.3, 6), { p: [0.02, 3.15, 0], r: [0.03, 0, 0.02] }), WOOD_D));
  for (const a of [seed, seed + 2.5]) parts.push(paint(tube([[Math.sin(a) * 2.2, 0.02, Math.cos(a) * 2.2], [Math.sin(a) * 0.9, 2.3, Math.cos(a) * 0.9]], 0.05, 3), WOOD_D));
  return merge(parts);
}

// A troita, the roofed wayside cross of these valleys, as tall as a man on a horse: a stone foot, a dark carved cross, a broad shingle roof over the arms on its own, a pale painted panel, a lamp left burning.
function troita(L) {
  const q = gable(3, 1.5, 0.02, 1.15, 0.28);
  const parts = [paint(place(box(1.1, 0.5, 1.1), { p: [0, 0.25, 0] }), PLINTH, 1), paint(place(box(0.3, 4.6, 0.24), { p: [0, 2.5, 0] }), WOOD_D, 4), paint(place(box(2.5, 0.28, 0.22), { p: [0, 3.4, 0] }), WOOD_D, 4), paint(place(box(0.7, 1.1, 0.06), { p: [0, 2.9, 0.15] }), '#d8d0ba'), paint(place(box(0.14, 0.75, 0.05), { p: [0, 2.95, 0.19] }), '#7a2c26'), paint(place(box(0.48, 0.12, 0.05), { p: [0, 3.05, 0.19] }), '#7a2c26'), paint(place(q.roof, { p: [0, 4.3, 0] }), '#5c4a38', 3)];
  for (const x of [-1.25, 1.25]) parts.push(paint(place(box(0.12, 0.8, 0.12), { p: [x, 3.85, 0] }), WOOD_D));
  L.push(paint(place(box(0.24, 0.34, 0.16), { p: [0, 1.2, 0.2] }), [2.1, 1.32, 0.62]));
  return merge(parts);
}

// A stack of split firewood, stored along the road for the winter.
function logStack(seed) {
  const parts = [];
  for (let r = 0; r < 3; r++) for (let i = 0; i < 4 - r; i++) parts.push(paint(place(cylinder(0.2, 0.2, 2.5 + 0.3 * hash3(i, r, seed), 6), { p: [(i - (3 - r) / 2) * 0.42, 0.2 + r * 0.36, 0], r: [Math.PI / 2, 0, 0] }), r % 2 ? WOOD_L : '#94744c', 2));
  return merge(parts);
}

// A hay cart, the caruta of every village here: a plank bed on four wheels, the shafts down on the ground, a load of hay.
function caruta() {
  const parts = [paint(place(box(1.5, 0.16, 3.8), { p: [0, 1.02, 0] }), WOOD, 4)];
  // the ladder sides that lean out, the mark of a Romanian hay cart
  for (const s of [-1, 1]) {
    for (const y of [1.3, 1.95]) parts.push(paint(tube([[s * (0.75 + (y - 1) * 0.42), y, -1.95], [s * (0.75 + (y - 1) * 0.42), y, 1.95]], 0.045, 3), WOOD_L));
    for (const z of [-1.6, -0.8, 0, 0.8, 1.6]) parts.push(paint(tube([[s * 0.72, 1.02, z], [s * 1.2, 2.05, z]], 0.035, 3), WOOD_D));
  }
  // and its load, shaggy, heaped over the rails
  const h = lump(5, 0.3, 2); parts.push(paint(place(h, { p: [0, 2.25, 0], s: [1.2, 0.85, 2.05] }), HAY, 13));
  for (const [z, r] of [[-1.45, 0.72], [1.45, 0.58]]) for (const x of [-0.98, 0.98]) {
    parts.push(paint(place(cylinder(r, r, 0.09, 12), { p: [x, r, z], r: [0, 0, Math.PI / 2] }), WOOD_D));
    parts.push(paint(place(cylinder(r * 0.8, r * 0.8, 0.11, 12), { p: [x, r, z], r: [0, 0, Math.PI / 2] }), '#2a2420'));
    for (let k = 0; k < 4; k++) { const a = k / 4 * 3.1416; parts.push(paint(place(box(0.12, r * 1.6, 0.05), { p: [x, r, z], r: [a, 0, 0] }), WOOD_L)); }
  }
  // the pole down on the road, a yoke at its end
  parts.push(paint(tube([[0, 0.92, 1.9], [0, 0.32, 4.6]], 0.06, 3), WOOD_D), paint(place(box(1.3, 0.1, 0.1), { p: [0, 0.32, 4.6] }), WOOD_D));
  return merge(parts);
}

// A villager out to see the race, arms up, in the white shirt and dark waistcoat of a feast day, or a coloured apron. Six to a tile of triangles matters here, there are a hundred of them.
const SHIRT = ['#ece6d6', '#e4dcc8', '#f2ecdf'], VEST = ['#23304e', '#3a2a22', '#6c2a24', '#27413a', '#7c5a2c'], SKIN = ['#d8b090', '#c89c7c', '#e0bc9c'];
function villager(seed) {
  const h = 0.92 + 0.18 * hash3(seed, 1, 61), s = (k, n) => Math.floor(hash3(seed, k, 62) * n);
  const up = hash3(seed, 2, 61) < 0.5;
  const parts = [
    paint(place(capsule(0.1, 0.72, 1, 5), { p: [-0.13, 0.42 * h, 0] }), '#2a2630'), paint(place(capsule(0.1, 0.72, 1, 5), { p: [0.13, 0.42 * h, 0] }), '#2a2630'),
    paint(place(cylinder(0.22, 0.27, 0.72 * h, 7), { p: [0, 1.08 * h, 0] }), SHIRT[s(3, 3)]),
    paint(place(cylinder(0.25, 0.29, 0.42 * h, 7), { p: [0, 1.03 * h, 0] }), VEST[s(4, 5)]),
    paint(place(sphere(0.19, 7, 5), { p: [0, 1.62 * h, 0] }), SKIN[s(5, 3)]),
    paint(place(cone(0.26, 0.26, 7), { p: [0, 1.82 * h, 0] }), s(6, 2) ? '#2a2420' : '#b8342c'),
  ];
  for (const f of [-1, 1]) parts.push(paint(tube([[f * 0.24, 1.36 * h, 0], [f * (up ? 0.4 : 0.34), (up ? 1.72 : 1.0) * h, 0.04], [f * (up ? 0.36 : 0.3), (up ? 2.08 : 0.75) * h, 0.02]], 0.055, 3), SHIRT[s(3, 3)]));
  return merge(parts);
}

// The rock of Babele as it stands against the sky: a broad cap on a waisted stem, leaning, worn round, bedded. `s` scales it.
function babaStone(s = 1, seed = 1) {
  const prof = [[4.3, -2], [4.1, 0.6], [3.6, 2.2], [3.1, 3.6], [3, 4.6], [3.5, 5.5], [5.4, 6.1], [6.6, 6.7], [7.1, 7.5], [6.6, 8.3], [5, 8.9], [2.6, 9.3], [0.1, 9.5]].map(([r, y]) => [r * s, y * s]);
  const g = lathe(prof, 18), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(x, z), up = smooth(4 * s, 7 * s, y);
    const k = 1 + 0.42 * (vn(Math.cos(a) * 1.3 + seed, Math.sin(a) * 1.3, seed) - 0.5) + 0.16 * (vn(y * 0.7 / s, a * 1.8, seed + 1) - 0.5);
    // the cap overhangs one side, as the wind has worn it
    p.setXYZ(i, x * k * 1.2 + up * 1.5 * s * Math.cos(seed * 2.1), y + 0.5 * s * (vn(x * 0.3 / s + 4, z * 0.3 / s, seed + 2) - 0.5) * up, z * k * 0.88 + up * 1.5 * s * Math.sin(seed * 2.1));
  }
  g.computeVertexNormals();
  return paint(g, '#8f8672', 9);
}

// The Sphinx of the Bucegi as its famous side reads: a great blunt head with a flat cap, the heavy brow, the nose, the pushed out chin over a deep undercut, the rock falling away behind it, on a wider stepped base. Traced from the photo (Commons, Bucegi - Sphinx) and lofted across, smooth, in thin beds of conglomerate. +x is where it looks, y 0 its foot, about 13 m tall.
function sphinxRock() {
  const k = 14 / 467;
  // traced, then pushed: the brow out over the eye, the nose, the chin thrust forward over a neck cut well in. At the true proportion the face is gone at 60 m
  const trace = [[250, 622], [300, 628], [368, 650], [404, 692], [470, 728], [506, 790], [560, 815], [600, 838], [640, 878], [693, 925], [700, 1060], [560, 1095], [420, 1095], [300, 1090], [262, 1062], [250, 1020], [262, 985], [196, 972], [130, 958], [118, 925], [152, 905], [128, 872], [96, 850], [136, 815], [118, 778], [150, 740], [190, 700], [214, 655]].map(([x, y]) => [(300 - x) * k, (1095 - y) * k]);
  // an even chain round the profile, softened, so that the beds have vertices to live on
  const per = [];
  for (let i = 0; i < trace.length; i++) { const a = trace[i], b = trace[(i + 1) % trace.length], m = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.55)); for (let q = 0; q < m; q++) per.push([lerp(a[0], b[0], q / m), lerp(a[1], b[1], q / m)]); }
  const N = per.length, sm = per.map((_, i) => { let x = 0, y = 0; for (let o = -1; o <= 1; o++) { const q = per[(i + o + N) % N]; x += q[0]; y += q[1]; } return [x / 3, y / 3]; });
  const K = 14, cx = -2.6, cy = 5, pos = [], idx = [];
  for (let q = 0; q <= K; q++) {
    const t = q / K * 2 - 1, f = Math.sqrt(Math.max(0, 1 - t * t * 0.9));
    sm.forEach(([x, y], i) => {
      const n = (vn(i * 0.35, q * 0.9, 21) - 0.5) * 0.5;
      // the head narrower than the base
      const hw = lerp(6.4, 3.9, smooth(2, 7, y));
      pos.push(cx + (x - cx) * lerp(0.42, 1, f) + n, cy + (y - cy) * lerp(0.42, 1, f) + n * 0.3, t * hw);
    });
  }
  for (let q = 0; q < K; q++) for (let i = 0; i < N; i++) {
    const a = q * N + i, b = q * N + (i + 1) % N, c = a + N, d = b + N;
    idx.push(a, c, b, b, c, d);
  }
  const c0 = pos.length / 3; pos.push(cx, cy, -6, cx, cy, 6);
  for (let i = 0; i < N; i++) { idx.push(c0, i, (i + 1) % N); idx.push(c0 + 1, K * N + (i + 1) % N, K * N + i); }
  const head = new THREE.BufferGeometry();
  head.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  head.setIndex(idx);
  head.computeVertexNormals();
  return paint(head, '#857d6c', 9);
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

// a track's u by a world's a, b (the road carries everything): the nearest sample
const rockOptions = (R) => ({ height: R.top + 8, top: 56, base: 84, seed: 3, max: 86 });

export function plan({ track, terrain, world }) {
  const def = track.def, R = def.rock;
  const P = (u) => track.pointAt(u % 1), add = (u, r, cover, kinds) => { const p = P(u); world.groves.push({ x: p.x, z: p.z, r, cover, kinds }); };
  const uOf = (a, b) => track.nearest(a, -b).u;
  world.uOf = uOf;
  // the market and the village are open, the firs are thick, the pasture bare, and the sightline from the market to the castle and the Bucegi is clear
  for (const u of [0.975, 0.0, 0.03, 0.06, 0.09]) add(u, 75, -1.1);
  for (const u of [0.11, 0.13, 0.16]) add(u, 60, -0.5);
  for (const u of [0.87, 0.895, 0.92, 0.945, 0.965]) add(u, 82, -1.1);
  for (const u of [0.62, 0.645, 0.67, 0.695, 0.72, 0.745]) add(u, 92, -0.95);
  for (const u of [0.475, 0.5, 0.53, 0.56, 0.59, 0.61]) add(u, 90, 0.75, [['fir', 5], ['spruce', 5]]);
  { // the ground under the ring opens toward the market
    const clear = (u, d, r, cover = -1.2) => { const p = P(u); world.groves.push({ x: p.x + p.nx * d, z: p.z + p.nz * d, r, cover }); };
    clear(0.05, -40, 90); clear(0.08, 60, 110); clear(0.11, 90, 120); clear(0.13, 50, 90); clear(0.15, -60, 100); clear(0.2, -70, 110);
  }
  // nothing tall on the line from the street to the castle
  for (let t = 0; t <= 1; t += 0.125) world.groves.push({ x: lerp(95, R.a - 95, t), z: -lerp(6, R.b - 14, t), r: 52, cover: -1.3 });
  const keep = world.keepOut;
  keep.push({ x: R.a, z: -R.b, r: 88 });
  world.buildings = [];
  const site = (kind, u, d, opts = {}) => {
    const p = P(u), x = p.x + p.nx * d + p.tx * (opts.along || 0), z = p.z + p.nz * d + p.tz * (opts.along || 0);
    // a house needs its ground: on a real slope it would stand on a wedge of plinth, or sit in the hill up to its eaves
    if (kind === 'casa' || kind === 'saxon') {
      const hs = [[6, 6], [6, -6], [-6, 6], [-6, -6], [0, 0]].map(([a, b]) => terrain.heightAt(x + a, z + b));
      if (Math.max(...hs) - Math.min(...hs) > 3.4) return false;
    }
    // a model's +z faces the road, unless it says otherwise
    const yaw = Math.atan2(-p.nx * Math.sign(d), -p.nz * Math.sign(d)) + (opts.turn || 0);
    world.buildings.push({ kind, x, z, yaw, u, d, ...opts });
    keep.push({ x, z, r: opts.r ?? 11 });
    return world.buildings[world.buildings.length - 1];
  };
  // the market street: houses shoulder to shoulder, stalls in front of them
  for (const [u, d, floors, seed, turn] of [
    // on the castle's side the houses stop at u 0.04: from there to the arch the rock stands over the street with nothing in front of it
    [0.003, 18, 2, 1, 0], [0.018, 18, 2, 2, 0.05], [0.033, 19, 3, 3, -0.05],
    [0.008, -18, 2, 6, 0], [0.024, -19, 3, 7, 0.05], [0.04, -19, 2, 8, -0.05], [0.056, -19.5, 2, 9, 0.1], [0.072, -19.5, 2, 31, -0.06], [0.086, -21, 3, 32, 0.1],
    [0.985, 18, 2, 10, 0.05], [0.97, 19, 2, 11, -0.1], [0.988, -19, 2, 12, 0], [0.972, -19, 2, 13, 0.1],
  ]) site('casa', u, d, { seed, floors, turn, r: 10, near: true });
  for (const [u, d, floors, seed, turn] of [
    [0.01, 40, 2, 14, 0.2], [0.99, 40, 2, 18, -0.1],
    [0.015, -41, 2, 19, -0.2], [0.035, -43, 2, 20, 0.2], [0.055, -44, 2, 21, -0.1], [0.995, -42, 3, 23, 0.1],
  ]) if (terrain.roadDistAt(P(u).x + P(u).nx * d, P(u).z + P(u).nz * d) > 11) site('casa', u, d, { seed, floors, turn, r: 9, near: false });
  // the white house at the castle's foot
  site('casa', 0.165, 19, { seed: 28, floors: 2, turn: 0.2, r: 9, near: true });
  site('casa', 0.135, -19, { seed: 29, floors: 2, turn: -0.1, r: 9, near: true });
  // the Saxon village: one continuous front, long houses gable to the street with the wall and its great arched cart gate closing every gap, on both sides
  const row = [0.872, 0.885, 0.898, 0.911, 0.924, 0.937, 0.95], W2 = 8.5;
  for (const side of [1, -1]) {
    const hs = row.map((u, i) => site('saxon', u + (side < 0 ? 0.002 : 0), side * 18, { seed: i + (side > 0 ? 1 : 4), r: 10 }));
    hs.forEach((h, i) => {
      const n = hs[i + 1];
      if (!h || !n) return;
      const face = (q) => { const p = P(q.u); return [q.x - p.nx * side * 8.7, q.z - p.nz * side * 8.7]; };
      const [ax, az] = face(h), [bx, bz] = face(n), len = Math.hypot(bx - ax, bz - az) - W2 + 0.5, mx = (ax + bx) / 2, mz = (az + bz) / 2;
      world.buildings.push({ kind: 'wall', x: mx, z: mz, yaw: h.yaw, u: h.u, d: side * 9.3, seed: i + (side > 0 ? 0 : 3), len });
      keep.push({ x: mx, z: mz, r: 7 });
    });
  }
  // the limes of a Saxon street, on the grass between the road and the long walls: they break up the plaster and shade the benches
  for (const [u, side] of [[0.872, 1], [0.885, -1], [0.899, 1], [0.915, -1], [0.925, 1], [0.94, -1], [0.878 + 0.006, 1], [0.905 + 0.006, -1], [0.931 + 0.007, 1], [0.948, 1]]) {
    const p = P(u);
    world.plant.push({ x: p.x + p.nx * side * 7.9, z: p.z + p.nz * side * 7.9, kind: 'beech', h: 6.5 + 2 * hash3(u * 999, side, 97) });
  }
  // the farms of the Bran pass, scattered over the fields outside the ring: shingle roofs, each with its plum trees for the tuica
  for (const [u, d, seed] of [[0.118, -34, 33], [0.152, -54, 36], [0.2, -30, 39], [0.236, -58, 42], [0.272, -36, 45], [0.31, -52, 48], [0.345, -32, 51], [0.368, -60, 54], [0.628, -42, 63]]) {
    if (!site('casa', u, d, { seed, floors: 1 + (seed % 2), turn: seed * 0.37, r: 9, near: false })) continue;
    const p = P(u), cx = p.x + p.nx * d * 1.32, cz = p.z + p.nz * d * 1.32;
    for (let i = 0; i < 4; i++) {
      const x = cx + p.tx * (i - 1.5) * 6.5 + p.nx * ((i % 2) * 6 - 3), z = cz + p.tz * (i - 1.5) * 6.5 + p.nz * ((i % 2) * 6 - 3);
      if (terrain.roadDistAt(x, z) > 9) world.plant.push({ x, z, kind: 'beech', h: 4.5 + 2 * hash3(i, seed, 96) });
    }
  }
  // the fortified church stands back on its low hill, north of the street
  site('fortified', 0.915, 82, { r: 46, turn: 0.4 });
  // the rock is clothed: beech thick from the foot to the walls, and the pale stone stands out of it in its patches
  const O = rockOptions(R);
  for (let i = 0; i < 290; i++) {
    const a = hash3(i, 6, 91) * 6.2832, t = 0.04 + 0.86 * hash3(i, 7, 91) ** 0.9;
    if (palePatch(a, t)) continue;
    const q = outcropAt(a, t, O), x = R.a + q.x * 1.01, z = -R.b + q.z * 1.01;
    if (terrain.roadDistAt(x, z) < 7) continue;
    world.plant.push({ x, z, y: Math.max(R.top + q.y, terrain.heightAt(x, z)) - 0.6, kind: i % 7 ? 'beech' : 'fir', h: 7 + 7 * hash3(i, 8, 91) });
  }
  // firs up the cut bank above the road where it comes out of the wood
  for (let i = 0; i < 46; i++) {
    const u = 0.575 + 0.06 * hash3(i, 20, 92), p = P(u), d = p.w / 2 + 9 + 34 * hash3(i, 21, 92), x = p.x + p.nx * d, z = p.z + p.nz * d;
    if (terrain.roadDistAt(x, z) > 7) world.plant.push({ x, z, kind: i % 2 ? 'fir' : 'spruce', h: 12 + 10 * hash3(i, 22, 92) });
  }
  // a wood along both sides of the stone arch: the street goes through it, and only the arches that matter stand clear of the trees
  { const a0 = P(0.405), a1 = P(0.455);
    for (let i = 0; i < 70; i++) {
      const t = hash3(i, 9, 92), o = (hash3(i, 10, 92) < 0.5 ? -1 : 1) * (16 + 46 * hash3(i, 11, 92));
      const px = lerp(a0.x, a1.x, t) + (a1.z - a0.z === 0 ? 0 : o * 0.97) + 10 * (hash3(i, 12, 92) - 0.5), pz = lerp(a0.z, a1.z, t) + (hash3(i, 13, 92) - 0.5) * 16;
      if (terrain.roadDistAt(px, pz) < 7 || terrain.heightAt(px, pz) < (terrain.water ?? -99) + 1.2) continue;
      // the sightline to the castle stays open
      if (-pz > 34) continue;
      world.plant.push({ x: px, z: pz, kind: i % 2 ? 'fir' : 'spruce', h: 12 + 11 * hash3(i, 14, 92) });
    }
  }
  // no stray boulder under a fence: the rails would run through it
  for (const [a, b, d] of [[0.645, 0.7, 10], [0.655, 0.712, -10], [0.84, 0.862, 9.5], [0.84, 0.862, -9.5]]) for (let u = a; u <= b; u += 0.004) { const p = P(u); keep.push({ x: p.x + p.nx * d, z: p.z + p.nz * d, r: 5 }); }
  // the stones of Babele
  site('babele', 0.74, -27, { r: 12 });
  // the Sphinx on the outside of the hairpin, on the lip of the drop: you drive at its profile, with Piatra Craiului behind it
  site('sphinx', 0.742, 34, { r: 18 });
}

export function build({ track, batch, mat, world }) {
  setWorld(world);
  const groundAt = world.ground.groundAt, B = batch, def = track.def, R = def.rock;
  const P = (u) => track.pointAt(((u % 1) + 1) % 1);
  const atRoad = (u, d, along = 0) => { const p = P(u); const x = p.x + p.nx * d + p.tx * along, z = p.z + p.nz * d + p.tz * along; return { x, z, y: groundAt(x, z), yaw: Math.atan2(p.tx, p.tz), p }; };
  const lights = [];
  const LOCAL = (g, m) => { if (g) { const c = g.clone(); c.applyMatrix4(m); lights.push(c); } };
  const matOf = (x, y, z, yaw) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1));

  // the rock and the castle
  {
    const top = R.top, x = R.a, z = -R.b;
    for (const g of castleRock(rockOptions(R))) B.add(place(g, { p: [x, top, z] }));
    // the classic view looks along the market street, with the round tower on the left
    const c = castle(), yaw = -1.2, m = matOf(x, top - 0.5, z, yaw).multiply(new THREE.Matrix4().makeScale(1.22, 1.22, 1.22));
    c.solid.applyMatrix4(m);
    B.add(c.solid);
    LOCAL(c.lights, m);
    B.blob(x, z, 92, 0.3);
    // boulders broken off the foot
    for (let i = 0; i < 26; i++) {
      const a = hash3(i, 7, 13) * 6.2832, r = 84 + 5 * hash3(i, 8, 13), bx = x + Math.sin(a) * r, bz = z + Math.cos(a) * r;
      if (world.terrain?.roadDistAt?.(bx, bz) < 3) continue;
      const s = 0.8 + 1.8 * hash3(i, 9, 13), g = lump(i, 0.55);
      place(g, { p: [bx, groundAt(bx, bz) + s * 0.25, bz], s: [s * 1.3, s * 0.8, s], r: [0.3 * a, a, 0.2] });
      B.add(paint(g, '#7f7766', 9)); B.blob(bx, bz, s * 1.5, 0.4);
    }
  }

  for (const b of world.buildings) {
    const rr = b.kind === 'casa' || b.kind === 'saxon' ? 5.5 : 0;
    if (b.kind === 'wall') {
      // the wall takes the street's level: the road, not the slope behind it
      const g = streetWall({ len: b.len, seed: b.seed }), m = matOf(b.x, Math.max(groundAt(b.x, b.z), P(b.u).y) - 0.04, b.z, b.yaw);
      g.applyMatrix4(m); B.add(g); B.blob(b.x, b.z, b.len * 0.5, 0.35);
      continue;
    }
    const y0 = groundAt(b.x, b.z);
    let y = y0;
    if (rr) for (const [ax, az] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) y = Math.max(y, groundAt(b.x + ax * rr, b.z + az * rr));
    y = Math.min(y, y0 + 0.7) - 0.05;
    const L = [];
    let g, r = 8;
    if (b.kind === 'casa') { g = casa({ seed: b.seed, floors: b.floors, near: b.near }, L); r = 9; }
    else if (b.kind === 'saxon') { g = saxon({ seed: b.seed }, L); r = 9; }
    else if (b.kind === 'fortified') { g = fortified(L); r = 40; }
    else if (b.kind === 'babele') {
      // on a low pad of bare stone: they stand on rock, not in a meadow
      g = merge([place(limestone({ height: 2.8, top: 9, base: 13, segs: 28, rings: 6, seed: 31 }), { p: [0, 1.1, 0] }), place(babaStone(0.72, 1), { p: [-5.5, 0.6, 0] }), place(babaStone(0.6, 2), { p: [5.5, 0.6, 1.5], r: [0, 1.1, 0] })]); r = 14;
    } else if (b.kind === 'sphinx') {
      g = merge([place(limestone({ height: 3.2, top: 9, base: 14, segs: 30, rings: 7, seed: 33 }), { p: [-2, 1.2, 0] }), place(sphinxRock(), { p: [0, 0.9, 0] })]); r = 14; y = Math.max(y, P(b.u).y - 1.6);
    }
    if (!g) continue;
    // the Sphinx looks out across the road, so that whoever comes along the pasture has its profile
    const nq = P(b.u - 0.035), yaw = b.kind === 'sphinx' ? Math.atan2(nq.nz, -nq.nx) : b.yaw;
    const m = matOf(b.x, y, b.z, yaw);
    g.applyMatrix4(m);
    B.add(g);
    B.blob(b.x, b.z, r, 0.45);
    if (L.length) LOCAL(merge(L), m);
  }

  // stalls along the market, in front of the houses
  let sd = 0;
  for (const [u0, u1, d] of [[0.0, 0.062, 8.8], [0.0065, 0.058, -8.8], [0.975, 0.995, 8.8], [0.977, 0.995, -8.8]]) {
    for (let u = u0; u < u1; u += 0.0092) {
      const a = atRoad(u, d), L = [], g = stall(sd++, L), m = matOf(a.x, a.y, a.z, Math.atan2(-a.p.nx * Math.sign(d), -a.p.nz * Math.sign(d)));
      g.applyMatrix4(m); B.add(g); B.blob(a.x, a.z, 3.4, 0.4); LOCAL(merge(L), m);
    }
  }

  // the pasture: hay, a rail fence, a shepherd's hut, the flock asleep
  for (const [u, d, s] of [[0.648, 13.5, 1], [0.655, 20, 1.1], [0.66, -14, 0.95], [0.668, 15, 1.05], [0.675, -20, 1.1], [0.682, -13.5, 1], [0.69, 22, 1], [0.70, 14, 0.9], [0.712, -15, 1.1], [0.722, 18, 1], [0.73, 26, 1], [0.665, 36, 1], [0.68, 44, 1.1], [0.695, -38, 1]]) {
    const a = atRoad(u, d), g = capita(); place(g, { p: [a.x, a.y - 0.05, a.z], r: [0, u * 40, 0], s }); B.add(g); B.blob(a.x, a.z, 2.8, 0.42);
  }
  const fence = (u0, u1, d, step = 0.007) => {
    let last = null;
    for (let u = u0; u <= u1 + 1e-6; u += step) {
      const q = atRoad(u, d);
      if (last) {
        const parts = [];
        parts.push(paint(place(cylinder(0.08, 0.1, 1.5, 5), { p: [q.x, q.y + 0.7, q.z] }), WOOD_D));
        for (const h of [0.55, 1.1]) parts.push(paint(tube([[last.x, last.y + h, last.z], [q.x, q.y + h, q.z]], 0.05, 3), WOOD));
        B.add(merge(parts));
      }
      last = q;
    }
  };
  fence(0.645, 0.70, 10); fence(0.655, 0.712, -10); fence(0.84, 0.862, 9.5); fence(0.84, 0.862, -9.5);
  const sheep = blobAnimal('#ece8f2', 0.95, '#3a3448');
  for (const [u, d, turn] of [[0.676, 30, 1.1], [0.679, 33, 2.4], [0.683, 28, 0.2], [0.686, 35, -1], [0.689, 30, 3], [0.706, -28, 0.5], [0.71, -33, 2.1], [0.714, -27, 1.3]]) {
    const a = atRoad(u, d), g = sheep.clone(); place(g, { p: [a.x, a.y - 0.02, a.z], r: [0, a.yaw + turn, 0], s: 1.1 }); B.add(g); B.blob(a.x, a.z, 1.8, 0.42);
  }
  {
    const a = atRoad(0.70, 36), parts = [], L = [];
    const q = gable(5, 6.5, 2.6, 2.4, 0.6);
    parts.push(paint(q.walls, WOOD, 4), paint(q.roof, '#574a44', 3), paint(place(box(5.2, 3, 6.7), { p: [0, -1.4, 0] }), '#7c7c9c', 1));
    lit(L, 0, 1.5, 3.3, 0, 1.1, 1.1);
    const g = merge(parts), m = matOf(a.x, a.y, a.z, a.yaw + 2.6); g.applyMatrix4(m); B.add(g); B.blob(a.x, a.z, 5, 0.45); LOCAL(merge(L), m);
  }

  // Maramureș gate across the village street
  {
    const a = atRoad(0.893, 0), L = [], g = maramuresGate(a.p.w + 3.2, L), m = matOf(a.x, a.p.y - 0.1, a.z, a.yaw + Math.PI / 2 - Math.PI / 2);
    // its beam runs across the road: the model's x along the road's normal
    const m2 = matOf(a.x, a.p.y - 0.1, a.z, a.yaw);
    g.applyMatrix4(m2); B.add(g); LOCAL(merge(L), m2); void m;
    for (const s of [-1, 1]) B.blob(a.x + a.p.nx * s * (a.p.w / 2 + 1.6), a.z + a.p.nz * s * (a.p.w / 2 + 1.6), 2.2, 0.5);
  }

  // Lanterns. A post, an arm, and the lantern itself hanging free: they swing a little always, and hard in an earthquake. Two instanced meshes, frames and lit glass, updated per frame by the landmarks' update.
  const hang = [], pools = [];
  const post = (u, d, armTo = 1) => {
    const a = atRoad(u, d), side = -Math.sign(d) * armTo, parts = [], h = 5.4, nx = a.p.nx * side, nz = a.p.nz * side, deck = track.structureAt(a.p.i) === 'viaduct' || track.structureAt(a.p.i) === 'bridge';
    if (deck) a.y = a.p.y + 0.9;
    parts.push(paint(place(cylinder(0.11, 0.16, h, 6), { p: [a.x, a.y + h / 2, a.z] }), '#2f2e3e'));
    parts.push(paint(tube([[a.x, a.y + h - 0.2, a.z], [a.x + nx * 0.8, a.y + h + 0.1, a.z + nz * 0.8], [a.x + nx * 1.5, a.y + h - 0.05, a.z + nz * 1.5]], 0.05, 4), '#2f2e3e'));
    B.add(merge(parts));
    hang.push({ x: a.x + nx * 1.5, y: a.y + h - 0.05, z: a.z + nz * 1.5, s: 1, ph: hash3(u * 977, d, 3) * 6.28 });
    if (!deck) { pools.push({ x: a.x + nx * 1.5, z: a.z + nz * 1.5, r: 10, i: a.p.i }); B.blob(a.x, a.z, 0.9, 0.35); }
  };
  const line = (u0, u1, step, d) => { for (let u = u0; u < u1; u += step) post(u, d); };
  // the castle ring on its outer side, the bridge, the village, the way down, the start of the firs
  for (let u = 0.1; u < 0.385; u += 0.024) post(u, -(P(u).w / 2 + 2.6));
  for (const u of [0.79, 0.803, 0.815]) { post(u, P(u).w / 2 + 0.2); post(u + 0.005, -(P(u).w / 2 + 0.2)); }
  for (const u of [0.482, 0.525, 0.556, 0.752, 0.772, 0.83, 0.85]) post(u, u * 1000 % 2 < 1 ? P(u).w / 2 + 2.6 : -(P(u).w / 2 + 2.6));
  // strings of lanterns across the market and the village, a catenary between two houses' eaves
  const strings = [];
  const string = (u, hp = 7.2, n = 5) => {
    const p = P(u), wd = p.w / 2 + 3, ax = p.x + p.nx * wd, az = p.z + p.nz * wd, bx = p.x - p.nx * wd, bz = p.z - p.nz * wd, y0 = p.y + hp, pts = [];
    for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push([lerp(ax, bx, t), y0 - 1.3 * 4 * t * (1 - t), lerp(az, bz, t)]); }
    strings.push(paint(tube(pts, 0.03, 3), '#2f2e3e'));
    for (const s of [0, 14]) strings.push(paint(place(cylinder(0.08, 0.12, hp + 0.5, 5), { p: [pts[s][0], p.y + hp / 2, pts[s][2]] }), WOOD_D));
    for (let i = 1; i <= n; i++) {
      const t = i / (n + 1), x = lerp(ax, bx, t), z = lerp(az, bz, t), y = y0 - 1.3 * 4 * t * (1 - t);
      hang.push({ x, y, z, s: 0.8, ph: hash3(u * 977, i, 5) * 6.28 });
    }
    pools.push({ x: p.x, z: p.z, r: 11, i: p.i });
  };
  for (const u of [0.012, 0.03, 0.048, 0.066, 0.984, 0.965]) string(u);
  for (const u of [0.878, 0.905, 0.931, 0.953]) string(u);
  B.add(merge(strings));

  // the hanging lanterns: pivot at the top, hanging down
  const frame = merge([
    paint(place(cylinder(0.06, 0.26, 0.2, 6), { p: [0, -0.22, 0] }), '#22202e'), paint(place(cylinder(0.26, 0.26, 0.05, 6), { p: [0, -0.9, 0] }), '#22202e'),
    ...[0, 1, 2, 3].map((k) => paint(place(box(0.035, 0.6, 0.035), { p: [Math.sin(k * 1.5708 + 0.78) * 0.24, -0.62, Math.cos(k * 1.5708 + 0.78) * 0.24] }), '#22202e')),
  ]);
  const glass = paint(place(cylinder(0.19, 0.21, 0.55, 6), { p: [0, -0.62, 0] }), '#ffffff');
  const frames = new THREE.InstancedMesh(frame, mat('#ffffff', { vertexColors: true }), hang.length);
  const lamps = new THREE.InstancedMesh(glass, mat('#ffd28a', { emissive: '#ffb04a', emissiveIntensity: 2.6 }), hang.length);
  frames.frustumCulled = lamps.frustumCulled = false;
  frames.renderOrder = lamps.renderOrder = 1;
  world.staticGroup.add(frames, lamps);

  // a soft halo round each lantern
  {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const c = cv.getContext('2d'), gr = c.createRadialGradient(32, 32, 1, 32, 32, 31);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.28)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gr; c.fillRect(0, 0, 64, 64);
    const g = new THREE.BufferGeometry(), arr = new Float32Array(hang.length * 3);
    hang.forEach((q, i) => { arr[i * 3] = q.x; arr[i * 3 + 1] = q.y - 0.6 * q.s; arr[i * 3 + 2] = q.z; });
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ map: new THREE.CanvasTexture(cv), color: '#ff9f4a', size: 2.7, sizeAttenuation: true, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    pts.frustumCulled = false; pts.renderOrder = 3;
    world.staticGroup.add(pts);
  }

  // low round bushes along the verges, a little further off the road, never in the fence or the hay
  {
    const bush = (i) => { const n = 5, parts = []; for (let k = 0; k < n; k++) { const a = k * 2.4 + i, r = k ? 0.34 + 0.3 * hash3(i, k, 20) : 0; parts.push(paint(place(lump(i * 7 + k, 0.5, 1), { p: [Math.sin(a) * r, 0.34 + 0.34 * (k ? hash3(i, k, 24) : 1), Math.cos(a) * r], s: 0.3 + 0.2 * hash3(i, k, 21) }), ['#3c7650', '#478458', '#33684a', '#55925e'][(i + k) % 4], 0, (x, y) => lerp(0.7, 1.12, smooth(0.1, 0.9, y)))); } return merge(parts); };
    let count = 0;
    for (let i = 0; i < 420 && count < 76; i++) {
      const u = i / 420 + 0.003 * hash3(i, 1, 23), side = hash3(i, 2, 23) < 0.5 ? -1 : 1, p = P(u), dist = p.w / 2 + 4 + 12 * hash3(i, 3, 23);
      if (u > 0.955 || u < 0.09 || (u > 0.865 && u < 0.955) || track.structureAt(p.i)) continue;
      // the pasture: its fence and its hay stand close to the road
      if (u > 0.625 && u < 0.745 && dist < 26) continue;
      const a = atRoad(u, side * dist);
      if (world.ground.groundAt(a.x, a.z) < a.p.y - 3) continue;
      const g = bush(i); place(g, { p: [a.x, a.y, a.z], r: [0, u * 90, 0], s: 0.9 + 0.9 * hash3(i, 4, 23) }); B.add(g); B.blob(a.x, a.z, 1.3, 0.35);
      count++;
    }
  }

  // What makes the verge a verge: clumps of long grass, seed heads, stones half sunk, thicker near the road's edge and never on it
  {
    const clump = (c, tall) => { const parts = []; for (let k = 0; k < 5; k++) { const a = k * 1.257; parts.push(paint(place(cone(0.05, tall * (0.7 + 0.1 * (k % 3)), 3), { p: [Math.sin(a) * 0.13, tall * 0.34, Math.cos(a) * 0.13], r: [Math.cos(a) * 0.32, a, -Math.sin(a) * 0.32] }), c)); } return merge(parts); };
    const kinds = [clump('#4c6a4a', 0.5), clump('#55744e', 0.62), clump('#5e7a50', 0.42), clump('#6e7a52', 0.7)];
    const stone = paint(place(sphere(0.26, 6, 4), { s: [1.2, 0.6, 1] }), '#7c766a', 9);
    // the meadow flowers of the pass, pale under the moon: they are what makes the grass read as a meadow at speed
    const flower = merge([0, 1, 2, 3].map((k) => paint(place(cone(0.1, 0.16, 3), { p: [Math.sin(k * 2.4) * 0.34 * (k % 3 + 1) * 0.5, 0.26 + 0.06 * (k % 3), Math.cos(k * 2.4) * 0.34 * (k % 3 + 1) * 0.5], r: [Math.PI, 0, 0] }), k % 2 ? '#e6e4f2' : '#d8cc86')));
    for (let i = 0; i < 850; i++) {
      const u = (i / 850 + 0.002 * hash3(i, 1, 41)) % 1, p = P(u), side = hash3(i, 2, 41) < 0.5 ? -1 : 1, dist = p.w / 2 + 1.5 + 15 * hash3(i, 3, 41) ** 1.7;
      if (track.structureAt(p.i)) continue;
      const a = atRoad(u, side * dist), g = (i % 7 === 0 ? stone : i % 3 === 0 ? flower : kinds[i % 4]).clone();
      place(g, { p: [a.x, a.y, a.z], r: [0, i * 2.4, 0], s: 0.8 + 0.8 * hash3(i, 4, 41) });
      B.add(g);
    }
  }

  // The roadside of this valley: plank fences round the fields, hay on its poles, firewood stacked for the winter, carts, roofed crosses with a lamp, and white marker posts whose reflectors show the next bend in the dark
  {
    const LEN = track.length, gaps = (u) => { const i = P(u).i; return track.structureAt(i); };
    const gard = (u0, u1, side, off = 3.3) => {
      const step = 3.2 / LEN;
      let last = null;
      for (let u = u0; u <= u1; u += step) {
        const p = P(u), q = atRoad(u, side * (p.w / 2 + off));
        if (gaps(u) || q.y < p.y - 2.5) { last = null; continue; }
        if (last) {
          const dx = q.x - last.x, dz = q.z - last.z, yaw = Math.atan2(dx, dz), parts = [];
          parts.push(paint(place(box(0.14, 1.75, 0.14), { p: [q.x, q.y + 0.75, q.z] }), WOOD_D));
          for (const h of [0.5, 1.15]) parts.push(paint(tube([[last.x, last.y + h, last.z], [q.x, q.y + h, q.z]], 0.045, 3), WOOD_D));
          for (let k = 0; k < 3; k++) {
            const t = (k + 0.5) / 3, tall = 1.25 + 0.22 * hash3(u * 3000, k, 51);
            parts.push(paint(place(box(0.72, tall, 0.04), { p: [lerp(last.x, q.x, t), lerp(last.y, q.y, t) + tall / 2 + 0.12, lerp(last.z, q.z, t)], r: [0, yaw + Math.PI / 2, 0] }), k % 3 === 1 ? '#8a7458' : '#75614a', 4));
          }
          B.add(merge(parts));
        }
        last = q;
      }
    };
    for (const [u0, u1] of [[0.105, 0.165], [0.19, 0.238], [0.268, 0.312], [0.338, 0.376]]) gard(u0, u1, -1);
    gard(0.058, 0.09, -1); gard(0.072, 0.09, 1);
    gard(0.962, 0.973, -1); gard(0.955, 0.973, 1); gard(0.625, 0.642, 1); gard(0.625, 0.65, -1); gard(0.822, 0.838, 1); gard(0.822, 0.838, -1);
    // hay on the fields of the ring, the slopes above the village and past the gorge
    for (let i = 0; i < 34; i++) {
      const u = i < 24 ? 0.105 + 0.275 * (i + 0.5 * hash3(i, 1, 52)) / 24 : i < 30 ? 0.822 + 0.04 * (i - 24) / 6 : 0.956 + 0.018 * (i - 30) / 4, side = i < 24 ? -1 : i % 2 ? 1 : -1;
      const p = P(u), a = atRoad(u, side * (p.w / 2 + 6 + 20 * hash3(i, 2, 52)));
      if (Math.abs(a.y - p.y) > 7 || a.y < (world.ground.water ?? -99) + 1 || gaps(u)) continue;
      const g = capita(i * 3); place(g, { p: [a.x, a.y - 0.05, a.z], r: [0, i * 1.7, 0], s: 0.85 + 0.3 * hash3(i, 3, 52) }); B.add(g); B.blob(a.x, a.z, 2.6, 0.42);
    }
    for (const [u, d, turn, seed] of [[0.092, -8.6, 0, 1], [0.178, -9, 0.1, 2], [0.47, 8.8, 0.2, 3], [0.495, -8.8, -0.1, 4], [0.535, 9, 0.1, 5], [0.578, -8.8, 0, 6], [0.606, 9, -0.2, 7], [0.836, -9.4, 0, 8], [0.962, 9, 0, 9]]) {
      const a = atRoad(u, d), g = logStack(seed); place(g, { p: [a.x, a.y, a.z], r: [0, a.yaw + turn, 0] }); B.add(g); B.blob(a.x, a.z, 1.8, 0.4);
    }
    for (const [u, d, turn] of [[0.024, 7.4, 2], [0.044, -7.4, 0.1], [0.884, -7.4, 0.2], [0.942, 7.4, 3.1], [0.672, 8.8, 1.2], [0.14, -9, 0.3], [0.2, -9, -0.2], [0.33, -9, 0.25], [0.5, 9.2, 0.2], [0.61, -9.2, 0.1], [0.83, 9.2, -0.15]]) {
      const a = atRoad(u, d), g = caruta(); place(g, { p: [a.x, a.y, a.z], r: [0, a.yaw + turn, 0], s: 0.95 }); B.add(g); B.blob(a.x, a.z, 3, 0.42);
    }
    for (const [u, d] of [[0.101, -9], [0.17, -9], [0.235, -8.8], [0.29, -9], [0.36, -9], [0.462, 8.8], [0.53, -9.2], [0.614, -8.8], [0.655, 9.4], [0.705, -9.4], [0.838, 9], [0.86, -9], [0.748, 9.8], [0.96, -9]]) {
      const a = atRoad(u, d), L = [], g = troita(L), m = matOf(a.x, a.y, a.z, Math.atan2(-a.p.nx * Math.sign(d), -a.p.nz * Math.sign(d)));
      g.applyMatrix4(m); B.add(g); B.blob(a.x, a.z, 1.3, 0.45); LOCAL(merge(L), m);
    }
    // a bench in front of every Saxon house, where the village sits of an evening
    for (const [u, d] of [[0.876, 8.6], [0.89, -8.6], [0.904, 8.6], [0.92, -8.6], [0.934, 8.6], [0.946, -8.6], [0.882, -8.6], [0.912, 8.6]]) {
      const a = atRoad(u, d), m = matOf(a.x, a.y, a.z, Math.atan2(-a.p.nx * Math.sign(d), -a.p.nz * Math.sign(d)));
      const g = merge([paint(place(box(1.9, 0.08, 0.4), { p: [0, 0.46, 0] }), WOOD_L, 4), paint(place(box(1.9, 0.34, 0.06), { p: [0, 0.74, -0.2] }), WOOD, 4), paint(place(box(0.1, 0.46, 0.4), { p: [-0.8, 0.23, 0] }), WOOD_D), paint(place(box(0.1, 0.46, 0.4), { p: [0.8, 0.23, 0] }), WOOD_D)]);
      g.applyMatrix4(m); B.add(g); B.blob(a.x, a.z, 1.2, 0.4);
    }
    const marker = paint(place(box(0.13, 1.05, 0.09), { p: [0, 0.52, 0] }), '#d8d8d4');
    const band = paint(place(box(0.14, 0.24, 0.1), { p: [0, 0.8, 0] }), '#23232c');
    for (let i = 0; i < 2 * LEN / 26; i++) {
      const u = i / (2 * LEN / 26), p = P(u), side = i % 2 ? 1 : -1;
      if (u > 0.865 && u < 0.955 || u > 0.975 || u < 0.092 || gaps(u)) continue;
      const a = atRoad(u, side * (p.w / 2 + 1.5));
      if (a.y < p.y - 1.6) continue;
      const yaw = Math.atan2(p.tx, p.tz), parts = [marker.clone(), band.clone()], m = matOf(a.x, Math.min(a.y, p.y + 0.6), a.z, yaw);
      const g = merge(parts); g.applyMatrix4(m); B.add(g);
      const r = paint(place(box(0.08, 0.16, 0.12), { p: [0, 0.8, 0] }), side > 0 ? [2.4, 2.0, 1.4] : [2.6, 0.7, 0.35]); r.applyMatrix4(m); lights.push(r);
    }
  }

  // Race day: where the road is open the village has come out, behind a low barrier hung with woven cloth, with the tricolour and striped feast flags on tall poles. Nobody stands inside the barrier.
  {
    const CLOTH = ['#b8342c', '#e8e0cc', '#23304e', '#d8a73c'], LEN = track.length;
    const flag = (u, d) => {
      const a = atRoad(u, d), s = Math.sign(d), yaw = Math.atan2(a.p.tx, a.p.tz), parts = [paint(place(cylinder(0.07, 0.1, 8, 5), { p: [0, 4, 0] }), '#d6cdb6')];
      ['#1e3f8c', '#e4bc2c', '#c22a2a'].forEach((c, i) => parts.push(paint(place(box(0.6, 2.6, 0.04), { p: [0.4 + i * 0.6, 6.4, 0] }), c)));
      const g = merge(parts), m = matOf(a.x, a.y, a.z, yaw + Math.PI / 2 * s); g.applyMatrix4(m); B.add(g); B.blob(a.x, a.z, 0.7, 0.35);
    };
    const rally = (u0, u1, side, fill = 0.55) => {
      const step = 3.6 / LEN;
      let last = null, n = 0;
      for (let u = u0; u <= u1; u += step, n++) {
        const p = P(u), q = atRoad(u, side * (p.w / 2 + 2.4));
        if (track.structureAt(p.i) || q.y < p.y - 2.2 || q.y > p.y + 2.2) { last = null; continue; }
        if (last) {
          const parts = [paint(place(box(0.12, 1.15, 0.12), { p: [q.x, q.y + 0.57, q.z] }), WOOD_D), paint(tube([[last.x, last.y + 1.08, last.z], [q.x, q.y + 1.08, q.z]], 0.05, 3), WOOD_L)];
          const yw = Math.atan2(q.x - last.x, q.z - last.z);
          parts.push(paint(place(box(0.03, 0.62, 3.1), { p: [(q.x + last.x) / 2, (q.y + last.y) / 2 + 0.68, (q.z + last.z) / 2], r: [0, yw, 0] }), CLOTH[n % 4]));
          parts.push(paint(place(box(0.035, 0.1, 3.1), { p: [(q.x + last.x) / 2, (q.y + last.y) / 2 + 0.68, (q.z + last.z) / 2], r: [0, yw, 0] }), CLOTH[(n + 1) % 4]));
          B.add(merge(parts));
        }
        last = q;
        if (hash3(n, u0 * 100, 63) < fill) {
          const r = atRoad(u, side * (p.w / 2 + 3.5 + 1.8 * hash3(n, 2, 63)), 1.2 * hash3(n, 3, 63)), g = villager(n + Math.round(u0 * 1000));
          if (Math.abs(r.y - p.y) < 2.6) { place(g, { p: [r.x, r.y, r.z], r: [0, Math.atan2(-p.nx * side, -p.nz * side) + 0.5 * (hash3(n, 4, 63) - 0.5), 0] }); B.add(g); B.blob(r.x, r.z, 0.55, 0.32); }
        }
        if (n % 9 === 4) flag(u, side * (p.w / 2 + 3));
      }
    };
    rally(0.052, 0.09, 1, 0.6); rally(0.062, 0.09, -1, 0.5);
    rally(0.106, 0.13, -1); rally(0.18, 0.2, -1); rally(0.25, 0.268, -1); rally(0.316, 0.336, -1);
    rally(0.468, 0.488, -1, 0.5); rally(0.468, 0.488, 1, 0.4);
    rally(0.625, 0.645, 1, 0.5); rally(0.625, 0.645, -1, 0.5); rally(0.7, 0.722, 1, 0.5); rally(0.712, 0.726, -1, 0.5);
    rally(0.752, 0.775, 1, 0.5); rally(0.826, 0.84, 1, 0.5); rally(0.844, 0.862, -1, 0.5);
    rally(0.958, 0.975, 1, 0.6);
  }

  // A band of dressed stone across the road wherever its surface changes: a threshold, so that setts or dirt begin at a line somebody laid
  {
    const parts = [], S = track.samples;
    for (let i = 0; i < track.n; i++) {
      if (S.surface[i] === S.surface[(i + 1) % track.n] || (track.SURFACES[S.surface[i]] !== 'cobble' && track.SURFACES[S.surface[(i + 1) % track.n]] !== 'cobble')) continue;
      const hw = S.w[i] / 2 + 0.05, tx = S.tx[i], tz = S.tz[i], nx = S.nx[i], nz = S.nz[i], N = 6;
      for (const [c0, c1, tone] of [[-1.1, -0.35, 0.86], [-0.3, 0.45, 1], [0.5, 1.25, 0.9]]) for (let q = 0; q < N; q++) {
        const d0 = -hw + 2 * hw * q / N, d1 = -hw + 2 * hw * (q + 1) / N, at = (d, c) => [S.x[i] + nx * d + tx * c, track.heightAt(i + c / track.step, d) + 0.05, S.z[i] + nz * d + tz * c];
        parts.push(paint(quad(at(d1, c0), at(d0, c0), at(d0, c1), at(d1, c1)), '#6f6c62', 1, () => tone));
      }
    }
    if (parts.length) B.add(merge(parts));
  }

  // The moon, a sprite: painted in the panorama it stretched to an egg toward the edges of a wide lens. Screen aligned it is round wherever it stands in the frame; behind everything by depth, so that towers and trees cross it. The glow stays in the panorama.
  {
    const MOON = def.moon, NORTH = def.horizon.northDeg, th = (MOON.bearing - NORTH) * Math.PI / 180, el = MOON.elevation * Math.PI / 180;
    const cv = document.createElement('canvas'); cv.width = cv.height = 256;
    const c = cv.getContext('2d');
    const disc = c.createRadialGradient(108, 104, 8, 128, 128, 112);
    disc.addColorStop(0, '#fbf1cf'); disc.addColorStop(0.7, '#f4e8c4'); disc.addColorStop(1, '#d9d2bc');
    c.fillStyle = disc; c.beginPath(); c.arc(128, 128, 112, 0, 6.2832); c.fill();
    c.save(); c.clip();
    for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(150,158,168,${(0.08 + 0.12 * hash3(i, 1, 71)).toFixed(3)})`; const a = hash3(i, 2, 71) * 6.28, r = 90 * Math.sqrt(hash3(i, 3, 71)), q = 8 + 30 * hash3(i, 4, 71) ** 2; c.beginPath(); c.ellipse(128 + Math.cos(a) * r, 128 + Math.sin(a) * r, q * 1.3, q, a, 0, 6.2832); c.fill(); }
    c.restore();
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([Math.cos(el) * Math.sin(th), Math.sin(el), -Math.cos(el) * Math.cos(th)], 3));
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uMap: { value: tex }, uSize: { value: 100 } },
      vertexShader: 'uniform float uSize; void main(){ vec4 v = vec4(mat3(viewMatrix) * position * 100.0, 1.0); gl_Position = projectionMatrix * v; gl_Position.z = gl_Position.w * 0.99999; gl_PointSize = uSize; }',
      fragmentShader: 'uniform sampler2D uMap; void main(){ vec2 q = gl_PointCoord; vec4 c = texture2D(uMap, q); float r = length(q - 0.5) * 2.0; c.a *= 1.0 - smoothstep(0.86, 0.885, r); gl_FragColor = vec4(c.rgb, c.a); }',
    });
    const pts = new THREE.Points(g, m);
    pts.frustumCulled = false; pts.renderOrder = 1;
    const vp = new THREE.Vector4();
    // the size follows the view: the same angle of sky in one view or four
    pts.onBeforeRender = (renderer, scene, camera) => { renderer.getCurrentViewport(vp); m.uniforms.uSize.value = Math.min(500, (2 * MOON.radius / 0.885) / camera.fov * vp.w); };
    world.staticGroup.add(pts);
  }

  // the windows and everything else that is lit from inside
  if (lights.length) {
    const lm = new THREE.Mesh(merge(lights), new THREE.MeshBasicMaterial({ vertexColors: true }));
    world.staticGroup.add(lm);
  }

  // the warm pools of light on the ground, one quad per lantern, draped on the road
  {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const c = cv.getContext('2d'), gr = c.createRadialGradient(64, 64, 2, 64, 64, 62);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.3)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gr; c.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(cv), n = 6, pos = [], uv = [], idx = [];
    for (const q of pools) {
      const v0 = pos.length / 3;
      for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
        const x = q.x + (i / n - 0.5) * 2 * q.r, z = q.z + (j / n - 0.5) * 2 * q.r;
        // with the lantern's own road as the hint: under the arch, the nearest sample can be the deck 15 m overhead
        const hint = track.nearest(x, z, q.i), onRoad = Math.abs(hint.d) < track.pointAt(hint.u).w / 2 + 0.5;
        const y = onRoad ? Math.max(groundAt(x, z), track.heightAt(hint.f, hint.d)) : groundAt(x, z);
        pos.push(x, y + 0.22, z); uv.push(i / n, j / n);
      }
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = v0 + j * (n + 1) + i, b = a + 1, c2 = a + n + 1, d = c2 + 1; idx.push(a, c2, b, b, c2, d); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, color: '#ffae5e', transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.renderOrder = 2;
    world.staticGroup.add(m);
  }

  // the signs
  const SIGNS = [
    { text: 'START', bg: '#f6f0da', ink: '#26222a', size: 90 },
    { text: 'RÂUL TURCU', bg: '#2d6fb5', ink: '#f7f3e6', size: 88 },
    { text: '>>>>>>', bg: '#fbf7ea', ink: '#26222a', size: 110 },
    { text: 'LILIECI!', bg: '#fbf7ea', ink: '#c9382c', size: 96 },
    { text: 'BRAN', bg: '#2d6fb5', ink: '#f7f3e6', size: 96 },
  ];
  const atlas = signAtlas(SIGNS), planes = [];
  const sign = (u, d, row, w = 5, h = 1.1, hp = 2.2, turn = 0) => {
    const a = atRoad(u, d), yaw = a.yaw + Math.PI + turn;
    B.add(paint(place(box(0.2, hp + h, 0.2), { p: [a.x + Math.cos(yaw) * (w * 0.42), a.y + (hp + h) / 2, a.z - Math.sin(yaw) * (w * 0.42)] }), '#6e6770'));
    B.add(paint(place(box(0.2, hp + h, 0.2), { p: [a.x - Math.cos(yaw) * (w * 0.42), a.y + (hp + h) / 2, a.z + Math.sin(yaw) * (w * 0.42)] }), '#6e6770'));
    B.add(paint(place(box(w + 0.2, h + 0.18, 0.14), { p: [a.x - Math.sin(yaw) * 0.09, a.y + hp + h / 2, a.z - Math.cos(yaw) * 0.09], r: [0, yaw, 0] }), '#3b363c'));
    const g = signPlane(w, h, row, atlas.rows);
    place(g, { p: [a.x, a.y + hp + h / 2, a.z], r: [0, yaw, 0] });
    planes.push(g);
    B.blob(a.x, a.z, 1.5, 0.3);
  };
  sign(0.39, 7.8, 1); sign(0.515, -8, 3, 3.4, 0.95); sign(0.958, -9.5, 4, 3.6, 1);
  for (const m of track.markers.filter((q) => q.tag === 'hairpin')) {
    for (const off of [-0.012, 0, 0.012]) {
      const p = P(m.u + off), s = track.curvature[p.i] > 0 ? -1 : 1;
      sign(m.u + off, s * (p.w / 2 + 4), 2, 3.4, 1, 0.9, s * -0.3);
    }
  }
  const signMat = mat('#ffffff', { map: true });
  const signsMesh = new THREE.Mesh(mergeUV(planes), signMat);
  signMat.map = atlas.texture; signMat.needsUpdate = true;
  world.staticGroup.add(signsMesh);

  // the start gate: two big timber posts, the banner, lanterns
  {
    const a = atRoad(0.0, 0), wd = a.p.w / 2 + 2.6, yaw = a.yaw, parts = [], nx = a.p.nx, nz = a.p.nz;
    for (const s of [-1, 1]) {
      parts.push(place(paint(capsule(0.5, 8.4, 3, 9), WOOD, 4), { p: [a.x + nx * wd * s, a.y + 4.2, a.z + nz * wd * s] }));
      parts.push(place(paint(sphere(0.74, 10, 8), '#d7ad4a'), { p: [a.x + nx * wd * s, a.y + 9.1, a.z + nz * wd * s] }));
    }
    parts.push(place(paint(box(wd * 2 + 1, 1.9, 0.3), '#3b2a22'), { p: [a.x, a.y + 7.8, a.z], r: [0, yaw, 0] }));
    B.add(merge(parts));
    const ban = signPlane(wd * 2 - 0.2, 1.72, 0, atlas.rows), b2 = signPlane(wd * 2 - 0.2, 1.72, 0, atlas.rows);
    place(ban, { p: [a.x - a.p.tx * 0.17, a.y + 7.8, a.z - a.p.tz * 0.17], r: [0, yaw + Math.PI, 0] });
    place(b2, { p: [a.x + a.p.tx * 0.17, a.y + 7.8, a.z + a.p.tz * 0.17], r: [0, yaw, 0] });
    world.staticGroup.add(new THREE.Mesh(mergeUV([ban, b2]), signMat));
  }

  // the bats that live on the castle: they circle the towers against the moon and never come down. The ones that cross the road are the sim's hazard.
  const batGeo = merge([
    paint(place(sphere(0.5, 7, 5), { s: [0.7, 0.8, 1.2] }), '#2c2440'),
    paint(quad([0.2, 0, 0.4], [2.1, 0.3, 0.1], [2.1, 0.3, -0.4], [0.2, 0, -0.4]), '#3a3058'),
    paint(quad([-0.2, 0, -0.4], [-2.1, 0.3, -0.4], [-2.1, 0.3, 0.1], [-0.2, 0, 0.4]), '#3a3058'),
  ]);
  const bats = new THREE.InstancedMesh(batGeo, mat('#ffffff', { vertexColors: true, side: THREE.DoubleSide }), 16);
  bats.frustumCulled = false;
  world.staticGroup.add(bats);
  world.branHang = { hang, frames, lamps, bats, rock: R };
  // the first frame, before any update
  updateLanterns(world, 0, 0);
}

const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S = new THREE.Vector3(), ONE = new THREE.Vector3(1, 1, 1);
function updateLanterns(world, time, quake) {
  const H = world.branHang;
  if (!H) return;
  // a lantern is a pendulum: a breath of wind always, a real swing in an earthquake
  const amp = 0.05 + 0.6 * quake;
  H.hang.forEach((q, i) => {
    const w = 2.1 + (i % 5) * 0.14 + 2.2 * quake;
    E.set(Math.sin(time * w + q.ph) * amp, 0, Math.cos(time * (w * 0.87) + q.ph * 1.7) * amp * 0.8);
    Q.setFromEuler(E); V.set(q.x, q.y, q.z); S.setScalar(q.s);
    M.compose(V, Q, S);
    H.frames.setMatrixAt(i, M); H.lamps.setMatrixAt(i, M);
  });
  H.frames.instanceMatrix.needsUpdate = H.lamps.instanceMatrix.needsUpdate = true;
  const R = H.rock;
  for (let i = 0; i < H.bats.count; i++) {
    const ph = hash3(i, 2, 7) * 6.28, sp = 0.32 + 0.22 * hash3(i, 3, 7), rad = 24 + 34 * hash3(i, 4, 7), ang = time * sp + ph;
    const flap = Math.sin(time * 11 + ph * 5);
    V.set(R.a + Math.sin(ang) * rad, R.top + 40 + 16 * hash3(i, 5, 7) + Math.sin(time * 0.9 + ph) * 5, -R.b + Math.cos(ang) * rad);
    E.set(0.15 * flap, ang + Math.PI / 2, 0.25 * Math.sin(ang * 2));
    Q.setFromEuler(E); S.set(1 + 0.08 * flap, 1 + 0.7 * flap, 1);
    M.compose(V, Q, S);
    H.bats.setMatrixAt(i, M);
  }
  H.bats.instanceMatrix.needsUpdate = true;
}

let lastWorld = null;
export function setWorld(w) { lastWorld = w; }

// A disaster engine, when it runs, says how hard the ground is shaking through world.quake (0..1).
export function update(time, dt, karts, world) {
  const w = world || lastWorld;
  if (w) updateLanterns(w, time, w.quake || 0);
}
