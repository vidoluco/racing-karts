// Trees: soft, rounded conifers (a lathe per tier with a few branch lobes and a domed top), golden larches, round
// beeches, tall pines with a crown of lumps. They grow in clumps, each kind by share; a grove from the landmark changes
// the mix. Four levels of detail per shape, gathered per view in front of its camera into that view's own instanced
// meshes, and only refilled when the camera has moved on: no re-upload between views.
import * as THREE from 'three';
import { lerp, smooth, hash3, linear, vnoise, D2R } from './math.js';

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 0.999 : x);

export const SHAPES = ['conifer', 'round', 'pine', 'shrub', 'palm', 'larch'];
export const BANDS = [
  { r: 58, cap: 90 },
  { r: 170, cap: 340 },
  { r: 460, cap: 1300 },
  { r: 1400, cap: 6600 },
];

function fromArrays(pos, col, idx) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// One unit tree (height 1, base at the origin). under: rows under each tier's skirt, the drop shadow of its edge.
export function coniferGeometry({ tiers, segs, rings, under = 3, seed = 1, lobe = 0.13, slim = 0.27, fill = 1, trunk = 0.22, noTrunk = false, soft = false }) {
  const pos = [], col = [], idx = [];
  const lathe = (pts, ts) => {
    const base = pos.length / 3, lob = 6 + Math.floor(hash3(ts, 1, 2) * 4), ph = hash3(ts, 2, 3) * 6.28, ph2 = hash3(ts, 3, 4) * 6.28;
    for (let s = 0; s <= segs; s++) {
      // a pointed hem: boughs alternate out and in, with a slow wander so no two tiers match
      const a = ((s + 0.5 * hash3(ts, s % segs, 5)) / segs) * Math.PI * 2, sl = s % segs, lo = (sl % 2 ? 1.5 : -0.9) + 0.5 * Math.sin(lob * a + ph) + 0.25 * Math.sin((lob * 2 - 1) * a + ph2);
      const tone = 0.93 + 0.14 * hash3(ts, sl, 8);
      for (const [r, y, sh, wl] of pts) {
        const rr = r * (1 + lobe * lo * wl), yy = y - 0.035 * Math.max(lo, 0) * wl;
        const t2 = sh * tone;
        pos.push(Math.cos(a) * rr, yy, Math.sin(a) * rr); col.push(t2, t2, t2);
      }
    }
    const n = pts.length;
    for (let s = 0; s < segs; s++) for (let q = 0; q < n - 1; q++) {
      const a = base + s * n + q, b = a + 1, c = a + n, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  };
  if (!noTrunk) lathe([[0.03, -0.06, 0.35, 0], [0.024, trunk, 0.35, 0]], seed * 97);
  const y0 = 0.1 + 0.04 * hash3(seed, 9, 9), wide = slim + 0.05 * hash3(seed, 5, 6);
  let yb = y0;
  for (let i = 0; i < tiers; i++) {
    const f = i / tiers, ts = seed * 31 + i;
    const step = ((1 - y0) / tiers) * (0.82 + 0.3 * hash3(ts, 7, 1)) * (1 - 0.25 * f);
    const th = ((1 - y0) / tiers) * (i === tiers - 1 ? 2.4 : (1.7 + 0.3 * hash3(ts, 7, 2)) * fill);
    const yt = i === tiers - 1 ? 1.0 : Math.min(yb + th, 0.97);
    const R = wide * Math.pow(1 - f * 0.86, 1.02) * (0.9 + 0.2 * hash3(ts, 8, 3));
    const prof = [];
    // a domed profile: the top of every tier is round, and so is the tip of the tree
    for (let q = 0; q < rings; q++) { const p = q / (rings - 1); prof.push([R * p, yt - (yt - yb) * Math.pow(p, 1.25), (0.76 + 0.26 * f) * (0.86 + 0.26 * p), p ** 2]); }
    if (under >= 3) prof.push([R * 0.98, yb - 0.022, 0.5, 1], [R * 0.78, yb - 0.016, 0.32, 0.7], [R * 0.25, yb + (yt - yb) * 0.32, 0.28, 0]);
    else if (under === 2) prof.push([R * 0.8, yb - 0.018, 0.4, 0.7], [R * 0.25, yb + (yt - yb) * 0.32, 0.28, 0]);
    else if (under === 1) prof.push([R * 0.2, yb + (yt - yb) * 0.28, 0.3, 0]);
    lathe(prof, ts);
    yb = Math.min(yb + step, 0.93);
  }
  // no shared vertices: every bough catches the sun as its own plane, the faceted cut of the reference
  // soft: smooth over each tier, for the trees seen up close: big flat planes there read as low poly beside the painted mountains
  const g = soft ? fromArrays(pos, col, idx) : fromArrays(pos, col, idx).toNonIndexed();
  g.computeVertexNormals();
  return g;
}

function lump(pos, col, idx, cx, cy, cz, rx, ry, segs, rings, seed, dark = 0.62) {
  const base = pos.length / 3, lob = 5 + Math.floor(hash3(seed, 1, 2) * 3), ph = hash3(seed, 2, 3) * 6.28;
  for (let s = 0; s <= segs; s++) {
    const a = (s / segs) * Math.PI * 2, lo = 1 + 0.12 * Math.sin(lob * a + ph);
    for (let q = 0; q <= rings; q++) {
      const v = q / rings, th = v * Math.PI, sr = Math.sin(th), cy2 = -Math.cos(th), r = rx * sr * lo;
      pos.push(cx + Math.cos(a) * r, cy + ry * cy2, cz + Math.sin(a) * r);
      const sh = lerp(dark, 1.04, smooth(-0.6, 0.8, cy2)); col.push(sh, sh, sh);
    }
  }
  const n = rings + 1;
  for (let s = 0; s < segs; s++) for (let q = 0; q < rings; q++) {
    const a = base + s * n + q, b = a + 1, c = a + n, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
}

// A broadleaf: a short trunk and a crown of overlapping round lumps. Its trunk comes out dark through the shade attribute.
export function roundGeometry({ lumps, segs, rings, seed = 1 }) {
  const pos = [], col = [], idx = [];
  const ts = Math.max(5, segs >> 1), tb = pos.length / 3;
  for (let s = 0; s <= ts; s++) {
    const a = (s / ts) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    pos.push(ca * 0.034, -0.12, sa * 0.034, ca * 0.026, 0.5, sa * 0.026); col.push(0.3, 0.3, 0.3, 0.36, 0.36, 0.36);
  }
  for (let s = 0; s < ts; s++) { const a = tb + s * 2, c = a + 2; idx.push(a, a + 1, c, a + 1, c + 1, c); }
  lump(pos, col, idx, 0, 0.66, 0, 0.3, 0.26, segs, rings, seed * 11);
  for (let i = 0; i < lumps; i++) {
    const a = (i / lumps) * Math.PI * 2 + hash3(seed, i, 4) * 0.8, r = 0.17 + 0.05 * hash3(seed, i, 5), y = 0.52 + 0.24 * hash3(seed, i, 6), s = 0.17 + 0.06 * hash3(seed, i, 7);
    lump(pos, col, idx, Math.cos(a) * r, y, Math.sin(a) * r, s, s * 0.85, segs, rings, seed * 13 + i);
  }
  return fromArrays(pos, col, idx);
}

// A broad tropical shade tree (look.trees.roundLods with canopy: true): a stem that forks, limbs out, and an umbrella of many small flat clumps in two layers, dark under each and lit on top.
export function canopyGeometry({ lumps, segs, rings, seed = 1 }) {
  const pos = [], col = [], idx = [];
  const limb = (x0, y0, z0, x1, y1, z1, r0, r1, n) => {
    const b = pos.length / 3;
    for (let s = 0; s <= n; s++) {
      const a = (s / n) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      pos.push(x0 + ca * r0, y0, z0 + sa * r0, x1 + ca * r1, y1, z1 + sa * r1); col.push(0.3, 0.3, 0.3, 0.36, 0.36, 0.36);
    }
    for (let s = 0; s < n; s++) { const a = b + s * 2, c = a + 2; idx.push(a, a + 1, c, a + 1, c + 1, c); }
  };
  const n = Math.max(5, segs >> 1), fork = lumps > 4;
  limb(0, -0.12, 0, 0, fork ? 0.36 : 0.56, 0, 0.036, 0.028, n);
  if (fork) for (let i = 0; i < 4; i++) { const a = i * 1.57 + hash3(seed, i, 21); limb(0, 0.34, 0, Math.cos(a) * 0.24, 0.6, Math.sin(a) * 0.24, 0.022, 0.012, 4); }
  const puff = (x, y, z, rx, ry, tone, s2) => { const v = col.length; lump(pos, col, idx, x, y, z, rx, ry, segs, rings, s2, 0.54); for (let q = v; q < col.length; q++) col[q] *= tone; };
  puff(0, 0.76, 0, 0.42, 0.17, 0.9, seed * 7);
  const inner = Math.ceil(lumps * 0.38);
  for (let i = 0; i < lumps; i++) {
    const out = i >= inner, nn = out ? lumps - inner : inner, a = ((out ? i - inner : i) / nn) * Math.PI * 2 + hash3(seed, i, 4) * 0.7, r = (out ? 0.36 : 0.16) + 0.05 * hash3(seed, i, 5);
    const y = (out ? 0.72 : 0.86) + 0.07 * hash3(seed, i, 6), s = (lumps > 4 ? (out ? 0.19 : 0.23) : 0.33) * (0.9 + 0.25 * hash3(seed, i, 7));
    puff(Math.cos(a) * r, y, Math.sin(a) * r, s, s * 0.72, 0.9 + 0.2 * hash3(seed, i, 8), seed * 13 + i);
  }
  return fromArrays(pos, col, idx);
}

// A tall pine: a long bare stem and a high crown, the woods of the Gellner village.
export function pineGeometry({ lumps, segs, rings, seed = 1 }) {
  const pos = [], col = [], idx = [];
  lump(pos, col, idx, 0, 0.32, 0, 0.03, 0.46, Math.max(5, segs >> 1), 3, seed * 31, 0.3);
  lump(pos, col, idx, 0, 0.76, 0, 0.2, 0.2, segs, rings, seed * 37, 0.5);
  for (let i = 0; i < lumps; i++) {
    const a = (i / lumps) * Math.PI * 2 + hash3(seed, i, 41) * 1.3, r = 0.12 + 0.06 * hash3(seed, i, 42), y = 0.66 + 0.2 * hash3(seed, i, 43), s = 0.11 + 0.05 * hash3(seed, i, 44);
    lump(pos, col, idx, Math.cos(a) * r, y, Math.sin(a) * r, s * 1.2, s * 0.8, segs, rings, seed * 43 + i, 0.5);
  }
  return fromArrays(pos, col, idx);
}

export function shrubGeometry({ lumps, segs, rings, seed = 1 }) {
  const pos = [], col = [], idx = [];
  lump(pos, col, idx, 0, 0.42, 0, 0.42, 0.58, segs, rings, seed * 17, 0.55);
  for (let i = 0; i < lumps; i++) {
    const a = (i / lumps) * Math.PI * 2 + hash3(seed, i, 8), r = 0.3 + 0.08 * hash3(seed, i, 9), s = 0.2 + 0.08 * hash3(seed, i, 10);
    lump(pos, col, idx, Math.cos(a) * r, s * 1.1, Math.sin(a) * r, s, s * 1.6, segs, rings, seed * 19 + i, 0.55);
  }
  return fromArrays(pos, col, idx);
}

// A coconut palm: a thin leaning trunk with its rings and a crown of arching fronds, each a folded strip with a saw edge up close. Trunk tone brown through the shade attribute, whatever the green of its instance.
export function palmGeometry({ fronds, segs, across, trunkSegs, rings, seed = 1 }) {
  const pos = [], col = [], idx = [];
  const lean = 0.05 + 0.1 * hash3(seed, 1, 7), la = hash3(seed, 2, 7) * 6.28, lx = Math.cos(la) * lean, lz = Math.sin(la) * lean;
  const tp = (t) => [lx * t * t, t * 0.9, lz * t * t];
  const tb = 0;
  for (let i = 0; i <= rings; i++) {
    const t = i / rings, [cx, cy, cz] = tp(t), r = lerp(0.028, 0.014, t), ring = i % 2 ? 0.86 : 1;
    for (let s = 0; s <= trunkSegs; s++) { const a = (s / trunkSegs) * 6.2832; pos.push(cx + Math.cos(a) * r, cy - 0.04 * (1 - t), cz + Math.sin(a) * r); col.push(2.6 * ring, 0.34 * ring, 0.95 * ring); }
  }
  for (let i = 0; i < rings; i++) for (let s = 0; s < trunkSegs; s++) { const a = tb + i * (trunkSegs + 1) + s, c = a + trunkSegs + 1; idx.push(a, c, a + 1, a + 1, c, c + 1); }
  const [hx, hy, hz] = tp(1);
  for (let f = 0; f < fronds; f++) {
    const a = (f / fronds) * 6.2832 + 0.5 * hash3(seed, f, 3), ca = Math.cos(a), sa = Math.sin(a), up = 0.1 + 0.16 * hash3(seed, f, 4), L = 0.27 + 0.08 * hash3(seed, f, 5), droop = 0.2 + 0.1 * hash3(seed, f, 6);
    const base = pos.length / 3;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs, d = L * t, y = hy + up * Math.sin(t * 1.5) - droop * t * t * t, w0 = 0.048 * Math.sin(Math.min(1, t * 1.25 + 0.06) * Math.PI) ** 0.7, saw = across > 2 && i % 2 ? 0.72 : 1, w = w0 * saw;
      const shade = lerp(0.8, 1.14, t);
      for (let q = 0; q < across; q++) {
        const k = across === 1 ? 0 : (q / (across - 1)) * 2 - 1, fold = -Math.abs(k) * w * 0.55;
        pos.push(hx + ca * d - sa * k * w, y + fold, hz + sa * d + ca * k * w); const sh = shade * (q === (across - 1) / 2 ? 1.12 : 0.94); col.push(sh, sh, sh);
      }
    }
    for (let i = 0; i < segs; i++) for (let q = 0; q < across - 1; q++) {
      const A = base + i * across + q, B = A + 1, C = A + across, D = C + 1;
      idx.push(A, C, B, B, C, D, A, B, C, B, D, C); // both faces
    }
  }
  return fromArrays(pos, col, idx);
}

// A larch in needle: no closed cone, you see through it. A bare trunk, a thin dark core, and whorls of drooping feathered boughs with air between them; each bough a low tent with a saw edge, dark at the stem and bright at the tip.
// Only a kind with shape 'larch' in look.trees grows one; no other track draws any.
const LARCH_LODS = [{ whorls: 12, boughs: 6, segs: 3, faces: 2 }, { whorls: 9, boughs: 4, segs: 2, faces: 2, fat: 1.1, core: 0.05 }, { whorls: 4, boughs: 3, segs: 2, faces: 1, fat: 2, core: 0.14 }];
export function larchGeometry({ whorls, boughs, segs, faces, seed = 1, fat = 1, core = 0.075 }) {
  const pos = [], col = [], idx = [];
  const tri = (a, b, c) => { const base = pos.length / 3; for (const v of [a, b, c]) { pos.push(v[0], v[1], v[2]); col.push(v[3], v[3], v[3]); } idx.push(base, base + 1, base + 2); if (faces > 1) { const b2 = pos.length / 3; for (const v of [a, c, b]) { pos.push(v[0], v[1], v[2]); col.push(v[3] * 0.82, v[3] * 0.82, v[3] * 0.82); } idx.push(b2, b2 + 1, b2 + 2); } };
  // the trunk and the core: narrow cones with their own shades, seen through the boughs
  const cone = (r0, y0, r1, y1, sh, n) => {
    for (let s = 0; s < n; s++) {
      const a0 = (s / n) * 6.2832, a1 = ((s + 1) / n) * 6.2832, c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      const base = pos.length / 3;
      for (const v of [[c0 * r0, y0, s0 * r0], [c1 * r0, y0, s1 * r0], [c1 * r1, y1, s1 * r1], [c0 * r1, y1, s0 * r1]]) { pos.push(...v); col.push(sh, sh, sh); }
      idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
    }
  };
  cone(0.026, -0.06, 0.008, 0.9, 0.32, faces > 1 ? 6 : 4);
  cone(core, 0.24, 0.012, 0.98, core > 0.12 ? 0.85 : 0.55, faces > 1 ? 6 : 4);
  for (let i = 0; i < whorls; i++) {
    const f = i / (whorls - 1), y = lerp(0.24, 0.96, f), L = 0.27 * Math.pow(1 - f, 0.85) + 0.035, droop = 0.1 + 0.06 * (1 - f), W = (0.034 + 0.04 * (1 - f)) * fat, lift = lerp(0.72, 1.06, f);
    for (let j = 0; j < boughs; j++) {
      const a = ((j + 0.7 * hash3(seed, i, j)) / boughs) * 6.2832 + i * 2.4, ca = Math.cos(a), sa = Math.sin(a), LL = L * (0.72 + 0.5 * hash3(seed, j, i + 7)), yy = y + 0.03 * (hash3(seed, i + 3, j) - 0.5), tone = (0.88 + 0.24 * hash3(seed, i + 5, j)) * lift;
      const at = (t, side) => {
        // a saw edge: every other step of the bough stands out wider, so the outline is feathers and not a blade
        const wob = W * Math.sin(Math.min(1, t * 1.12 + 0.05) * Math.PI) ** 0.7 * (Math.round(t * segs) % 2 ? 1.4 : 0.9), r = LL * t, yb = yy - droop * LL / 0.3 * t * t;
        return [ca * r - sa * wob * side, yb - 0.45 * wob * Math.abs(side), sa * r + ca * wob * side, tone * lerp(0.74, 1.3, t) * (side ? 0.92 : 1)];
      };
      for (let s = 0; s < segs; s++) {
        const t0 = s / segs, t1 = (s + 1) / segs, A = at(t0, 0), B = at(t1, 0), Al = at(t0, -1), Bl = at(t1, -1), Ar = at(t0, 1), Br = at(t1, 1);
        tri(A, Bl, Al); tri(A, B, Bl); tri(A, Ar, Br); tri(A, Br, B);
      }
    }
  }
  const g = fromArrays(pos, col, idx).toNonIndexed();
  g.computeVertexNormals();
  return g;
}

const CONIFER_LODS = [{ tiers: 7, segs: 18, rings: 4, under: 2, soft: true }, { tiers: 5, segs: 12, rings: 3, under: 1, soft: true }, { tiers: 3, segs: 8, rings: 2, under: 0 }, { tiers: 2, segs: 4, rings: 2, under: 0, noTrunk: true }];
const ROUND_LODS = [{ lumps: 5, segs: 12, rings: 7 }, { lumps: 4, segs: 9, rings: 5 }, { lumps: 3, segs: 7, rings: 3 }, { lumps: 1, segs: 5, rings: 2 }];
const PINE_LODS = [{ lumps: 5, segs: 10, rings: 6 }, { lumps: 4, segs: 8, rings: 4 }, { lumps: 3, segs: 6, rings: 3 }, { lumps: 1, segs: 5, rings: 2 }];
const PALM_LODS = [{ fronds: 11, segs: 6, across: 3, trunkSegs: 6, rings: 6 }, { fronds: 9, segs: 4, across: 3, trunkSegs: 5, rings: 3 }, { fronds: 7, segs: 3, across: 2, trunkSegs: 4, rings: 2 }, { fronds: 5, segs: 2, across: 2, trunkSegs: 3, rings: 1 }];
const SHRUB_LODS = [{ lumps: 3, segs: 8, rings: 4 }, { lumps: 2, segs: 6, rings: 3 }, { lumps: 1, segs: 5, rings: 2 }, { lumps: 0, segs: 4, rings: 2 }];
// look.trees.roundLods: [{ lumps, segs, rings }] per band for the broadleaf, default ROUND_LODS: finer crowns where a far hexagon shows
export function treeGeometry(shape, li, seed = 5, roundLods = null) {
  if (shape === 1) return roundLods?.[li]?.canopy ? canopyGeometry({ ...roundLods[li], seed: seed + li }) : roundGeometry({ ...(roundLods?.[li] ?? ROUND_LODS[li]), seed: seed + li });
  if (shape === 2) return pineGeometry({ ...PINE_LODS[li], seed: seed + li });
  if (shape === 3) return shrubGeometry({ ...SHRUB_LODS[li], seed: seed + li });
  if (shape === 4) return palmGeometry({ ...PALM_LODS[li], seed: seed + li });
  if (shape === 5) return li < LARCH_LODS.length ? larchGeometry({ ...LARCH_LODS[li], seed: seed + li }) : coniferGeometry({ ...CONIFER_LODS[li], seed: seed + li, slim: 0.22 });
  return coniferGeometry({ ...CONIFER_LODS[li], seed: seed + li });
}

// Places the forest. world: { terrain, ground (groundAt, far), keepOut: [{x, z, r}], groves, plant: [{x, z, h, kind}] }.
// Returns plain arrays, so the placement is pure and deterministic given the same inputs.
export function placeTrees(track, world, look, forestOf) {
  const T = look.trees, { terrain, ground } = world, kinds = T.kinds, water = terrain.water;
  const S = T.spacing ?? 9, maxFar = T.far ?? 1050, maxSlope = T.maxSlope ?? 38, density = T.density ?? 0.6, keep = world.keepOut || [], groves = world.groves || [];
  const x0 = terrain.x0, z0 = terrain.z0, x1 = x0 + (terrain.w - 1) * terrain.step, z1 = z0 + (terrain.h - 1) * terrain.step;
  const out = [], norm = {};
  const pickKind = (list, u) => {
    let tot = 0, acc = 0;
    for (const k of list) tot += k.share;
    for (const k of list) { acc += k.share / tot; if (u < acc) return k; }
    return list[list.length - 1];
  };
  // look.trees.drift: kinds grow in groves of about this size, not as salt and pepper
  const driftAt = T.drift ? (x, z, u) => clamp01(u + (vnoise(x / T.drift, z / T.drift, 91) - 0.5) * 1.5) : (x, z, u) => u;
  const kindAt = (x, z, u0) => {
    const u = driftAt(x, z, u0);
    for (const g of groves) if (g.kinds && Math.hypot(x - g.x, z - g.z) < g.r) return pickKind(g.kinds.map((name) => kinds.find((k) => k.name === name[0]) ? { ...kinds.find((k) => k.name === name[0]), share: name[1] } : null).filter(Boolean), u);
    return pickKind(kinds, u);
  };
  for (const p of world.plant || []) {
    const k = kinds.find((q) => q.name === p.kind) || kinds[0];
    out.push({ x: p.x, y: p.y ?? ground.groundAt(p.x, p.z), z: p.z, k, h: p.h ?? lerp(k.height[0], k.height[1], hash3(p.x * 7, p.z * 3, 19)) });
  }
  let ix = 0;
  for (let z = z0 + S / 2; z < z1; z += S) {
    ix++;
    let jx = 0;
    for (let x = x0 + S / 2; x < x1; x += S) {
      jx++;
      const far0 = ground.far(x, z);
      if (far0 > maxFar) continue;
      // beyond 500 m a wider net: the far slopes need the mass, not the count
      if (far0 > 480 && (ix % 2 || jx % 2)) continue;
      const sp = far0 > 480 ? 2 * S : S;
      const px = x + (hash3(jx, ix, 1) - 0.5) * sp * 1.1, pz = z + (hash3(ix, jx, 2) - 0.5) * sp * 1.1;
      if (px < x0 + 2 || pz < z0 + 2 || px > x1 - 2 || pz > z1 - 2) continue;
      const far = ground.far(px, pz), rd = terrain.roadDistAt(px, pz);
      // roadGap: a crown is wide; the chase camera swings over the inside of a hairpin and must not end up in one
      if (rd < (T.roadGap ?? 4.5) + 2 * hash3(jx, ix, 12)) continue;
      const u = hash3(jx, ix, 3), forest = forestOf(px, pz, far);
      if (u > density * forest * (far0 > 480 ? 2.2 : 1)) continue;
      const y = ground.groundAt(px, pz);
      if (water !== null && water !== undefined && y < water + 1.2) continue;
      // the slope as drawn: far off the display lowers the rim, and a wood refused for how steep the sim's grid is there leaves a bald flank
      if (far0 > 170) {
        const e = 8, gx = (ground.groundAt(px + e, pz) - ground.groundAt(px - e, pz)) / (2 * e), gz = (ground.groundAt(px, pz + e) - ground.groundAt(px, pz - e)) / (2 * e);
        if (1 / Math.hypot(gx, 1, gz) < Math.cos(maxSlope * D2R)) continue;
      } else {
        terrain.normalAt(px, pz, norm);
        if (norm.y < Math.cos(maxSlope * D2R)) continue;
      }
      let blocked = false;
      for (const c of keep) if ((px - c.x) ** 2 + (pz - c.z) ** 2 < c.r * c.r) { blocked = true; break; }
      if (blocked) continue;
      const k = kindAt(px, pz, hash3(jx, ix, 11));
      // kind.maxRoad: m from the road a kind stops growing by itself: a fine far silhouette repeated along a skyline reads as a comb; default anywhere
      if (k.maxRoad && rd > k.maxRoad) continue;
      // near the road smaller trees, so nothing towers over a hairpin; on the far slopes taller, to read at distance
      const hh = lerp(k.height[0], k.height[1], hash3(jx, ix, 4) ** 1.5) * (far0 > 480 ? 1.35 : lerp(T.nearScale ?? 1, 1, smooth(6, 70, rd)));
      out.push({ x: px, y, z: pz, k, h: hh, far: far0 > 480 });
    }
  }
  const n = out.length, matrix = new Float32Array(n * 16), color = new Float32Array(n * 3), pos = new Float32Array(n * 3), shape = new Uint8Array(n), height = new Float32Array(n);
  const lin = new Map(), colorsOf = (k) => { let l = lin.get(k.name); if (!l) lin.set(k.name, (l = k.colors.map(linear))); return l; };
  // look.trees.farGold: how much of its colour a golden kind keeps on the far slopes; bright single trees far off are confetti
  const farGold = T.farGold ?? 1, farDark = linear(kinds[0].colors[0]);
  out.forEach(({ x, y, z, k, h, far }, i) => {
    const r1 = hash3(i, 5, 2), wd = h * (k.width ?? 0.95) * (0.88 + 0.28 * r1), a = hash3(i, 6, 3) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    const sink = 0.3;
    matrix.set([ca * wd, 0, -sa * wd, 0, 0, h, 0, 0, sa * wd, 0, ca * wd, 0, x, y - sink, z, 1], i * 16);
    const cols = colorsOf(k), base = cols[Math.floor(hash3(i, 9, 6) * cols.length)], kk = 0.9 + 0.2 * hash3(i, 10, 7);
    color[i * 3] = base[0] * kk; color[i * 3 + 1] = base[1] * kk; color[i * 3 + 2] = base[2] * kk;
    if (far) for (let e = 0; e < 3; e++) color[i * 3 + e] = lerp(farDark[e], color[i * 3 + e], farGold);
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    shape[i] = Math.max(0, SHAPES.indexOf(k.shape)); height[i] = h;
  });
  return { count: n, matrix, color, pos, shape, height, grid: bucket(pos, n, 64) };
}

function bucket(pos, n, cell) {
  const map = new Map();
  for (let i = 0; i < n; i++) {
    const k = Math.floor(pos[i * 3] / cell) * 65536 + Math.floor(pos[i * 3 + 2] / cell);
    let l = map.get(k);
    if (!l) map.set(k, (l = []));
    l.push(i);
  }
  for (const [k, l] of map) map.set(k, Int32Array.from(l));
  return { map, cell };
}

const ORDERS = new Map();
function cellOrder(R) {
  let o = ORDERS.get(R);
  if (o) return o;
  const cells = [];
  for (let b = -R; b <= R; b++) for (let a = -R; a <= R; a++) cells.push([a, b, a * a + b * b]);
  cells.sort((p, q) => p[2] - q[2]);
  o = Int16Array.from(cells.flatMap(([a, b]) => [a, b]));
  ORDERS.set(R, o);
  return o;
}

// The instanced meshes of one view, refilled nearest first when asked.
export function createTreeView(trees, material, geoCache) {
  const meshes = [], counts = new Int32Array(SHAPES.length * BANDS.length);
  for (let s = 0; s < SHAPES.length; s++) for (let b = 0; b < BANDS.length; b++) {
    // the newest shape takes no memory on a track that grows none
    const cap = s === 5 && !trees.shape.includes(5) ? 1 : BANDS[b].cap;
    const m = new THREE.InstancedMesh(geoCache[s][b], material, cap);
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.instanceColor.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false; m.count = 0; m.visible = false;
    meshes.push(m);
  }
  const { map, cell } = trees.grid, P = trees.pos, M = trees.matrix, C = trees.color, SH = trees.shape;
  const rMax = BANDS[BANDS.length - 1].r, R = Math.ceil(rMax / cell), order = cellOrder(R), nb = BANDS.length;
  // setDensity: a long track's budget at work, the two far bands thin out when a view is full of other things (render/index.js)
  let density = 1;
  // look.trees.farCap: the furthest band's own limit, nearest first, for a track whose forest would spend the budget where a tree is two pixels
  const capOf = (k) => (k >= 2 ? Math.round((k === nb - 1 && trees.farCap ? Math.min(trees.farCap, BANDS[k].cap) : BANDS[k].cap) * density) : BANDS[k].cap);
  // look.trees.nearBand: m, where this track's trees drop to their second level, if its near wood spends too much
  const near2 = (trees.nearBand ?? BANDS[0].r) ** 2;
  function gather(cx, cz, fx, fz, cone) {
    counts.fill(0);
    const ci = Math.floor(cx / cell), cj = Math.floor(cz / cell);
    for (let c = 0; c < order.length; c += 2) {
      const a = order[c], b = order[c + 1];
      const ox = (a + 0.5) * cell + (ci * cell - cx), oz = (b + 0.5) * cell + (cj * cell - cz), od = Math.sqrt(ox * ox + oz * oz);
      if (od > rMax + cell) continue;
      if (od > 2 * cell && (ox * fx + oz * fz) / od < cone - 0.25) continue;
      const l = map.get((ci + a) * 65536 + cj + b);
      if (!l) continue;
      for (let q = 0; q < l.length; q++) {
        const i = l[q], dx = P[i * 3] - cx, dz = P[i * 3 + 2] - cz, d2 = dx * dx + dz * dz;
        if (d2 >= rMax * rMax) continue;
        if (d2 > 900 && dx * fx + dz * fz < cone * Math.sqrt(d2)) continue;
        let k = 0;
        if (d2 >= near2) { k = 1; while (k < nb - 1 && d2 >= BANDS[k].r * BANDS[k].r) k++; }
        const s = SH[i], slot = s * nb + k, n = counts[slot];
        if (n >= capOf(k)) continue;
        const dst = meshes[slot], A = dst.instanceMatrix.array, CA = dst.instanceColor.array;
        for (let e = 0; e < 16; e++) A[n * 16 + e] = M[i * 16 + e];
        CA[n * 3] = C[i * 3]; CA[n * 3 + 1] = C[i * 3 + 1]; CA[n * 3 + 2] = C[i * 3 + 2];
        counts[slot] = n + 1;
      }
    }
    for (let k = 0; k < meshes.length; k++) {
      const m = meshes[k], n = counts[k];
      m.count = n;
      if (n) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
      m.instanceMatrix.clearUpdateRanges(); m.instanceColor.clearUpdateRanges();
      m.instanceMatrix.addUpdateRange(0, n * 16); m.instanceColor.addUpdateRange(0, n * 3);
    }
  }
  return { meshes, gather, setDensity(v) { density = v; }, get density() { return density; }, show(on) { for (const m of meshes) m.visible = on && m.count > 0; }, dispose() { for (const m of meshes) m.dispose(); } };
}

// All trees at the cheap level, once, for the sun's depth pass.
export function casterMesh(trees, geoCache, material, lod = 1) {
  const out = [];
  for (let s = 0; s < SHAPES.length; s++) {
    const ids = [];
    for (let i = 0; i < trees.count; i++) if (trees.shape[i] === s) ids.push(i);
    if (!ids.length) continue;
    const m = new THREE.InstancedMesh(geoCache[s][lod], material, ids.length);
    ids.forEach((i, q) => { for (let e = 0; e < 16; e++) m.instanceMatrix.array[q * 16 + e] = trees.matrix[i * 16 + e]; });
    m.frustumCulled = false;
    out.push(m);
  }
  return out;
}
