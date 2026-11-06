// The ground as drawn: the sim's height grid (src/world/terrain.js) as chunked meshes with level of detail by distance
// from the road, so one mesh serves every view; river and lake water; and the sun mask baked once on the ground, so that
// long shadows of trees, the viaduct and the hills cost nothing per frame in any number of views.
// Beyond where a kart can ever go the display lowers the rim, so the real horizon stands above it: the sim's grid is
// untouched and the road's surroundings are exact.
import * as THREE from 'three';
import { clamp, lerp, smooth, linear, fbm, vnoise, sunVector } from './math.js';
import { FOG_GLSL, MIST_GLSL, NOISE_GLSL } from './toon.js';

const MACRO = 8;        // nodes per side of a macro cell (32 m at 4 m a node)
const CHUNK = 8;        // macro cells per side of a chunk
const FAR_CELL = 2;     // chunks per side of a long track's coarse ground mesh: about 1 km

const mix3 = (o, c, t) => { o[0] = lerp(o[0], c[0], t); o[1] = lerp(o[1], c[1], t); o[2] = lerp(o[2], c[2], t); };

// How far each node is from the roads (m), on a coarse grid; roadDist in the sim stops at 112 m.
function coarseFar(track, terrain, cell = 32) {
  const { w, h, x0, z0, step } = terrain, cw = Math.ceil((w * step) / cell) + 2, ch = Math.ceil((h * step) / cell) + 2;
  const far = new Float32Array(cw * ch), hy = new Float32Array(cw * ch), S = track.samples, n = track.n;
  const xs = [], ys = [], zs = [];
  for (let i = 0; i < n; i += 12) { xs.push(S.x[i]); ys.push(S.y[i]); zs.push(S.z[i]); }
  for (let j = 0, k = 0; j < ch; j++) for (let i = 0; i < cw; i++, k++) {
    const x = x0 + i * cell, z = z0 + j * cell;
    let b = 1e12, y = 0;
    for (let q = 0; q < xs.length; q++) { const dx = x - xs[q], dz = z - zs[q], e = dx * dx + dz * dz; if (e < b) { b = e; y = ys[q]; } }
    far[k] = Math.sqrt(b); hy[k] = y;
  }
  const sample = (A, x, z) => {
    const u = clamp((x - x0) / cell, 0, cw - 1.001), v = clamp((z - z0) / cell, 0, ch - 1.001), i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, k = j * cw + i;
    return A[k] * (1 - fu) * (1 - fv) + A[k + 1] * fu * (1 - fv) + A[k + cw] * (1 - fu) * fv + A[k + cw + 1] * fu * fv;
  };
  return { far: (x, z) => sample(far, x, z), roadY: (x, z) => sample(hy, x, z) };
}

function riverField(terrain) {
  const R = terrain.river;
  if (!R) return null;
  const n = R.xs.length, S = new Float32Array(n);
  for (let i = 1; i < n; i++) S[i] = S[i - 1] + Math.hypot(R.xs[i] - R.xs[i - 1], R.zs[i] - R.zs[i - 1]);
  // nearest sample, coarse then fine
  const nearest = (x, z) => {
    let bi = 0, b = 1e15;
    for (let i = 0; i < n; i += 16) { const e = (x - R.xs[i]) ** 2 + (z - R.zs[i]) ** 2; if (e < b) { b = e; bi = i; } }
    for (let i = Math.max(0, bi - 16); i <= Math.min(n - 1, bi + 16); i++) { const e = (x - R.xs[i]) ** 2 + (z - R.zs[i]) ** 2; if (e < b) { b = e; bi = i; } }
    return { i: bi, d: Math.sqrt(b), s: S[bi] };
  };
  return { nearest, w: R.w };
}

// The display height: the sim's grid, with the far rim brought under the real mountains. limit() rises gently from the
// nearest road's height with distance: a soft minimum, so ridges keep their shape and only get shorter.
function displayHeights(terrain, field, rise = 0.115) {
  const { w, h, x0, z0, step, data } = terrain, Y = Float32Array.from(data);
  for (let j = 0, k = 0; j < h; j++) {
    const z = z0 + j * step;
    for (let i = 0; i < w; i++, k++) {
      const x = x0 + i * step, far = field.far(x, z);
      if (far < 170) continue;
      const lim = field.roadY(x, z) + 26 + (far - 170) * rise + 22 * vnoise(x / 210, z / 210, 77), y = Y[k], t = (y - lim) / 40;
      // smooth minimum with a 40 m knee
      const soft = t <= -1 ? y : t >= 1 ? lim : y - 40 * (t + 1) * (t + 1) / 4;
      Y[k] = lerp(y, soft, smooth(170, 260, far));
    }
  }
  return Y;
}

// Levels: 0 is 4 m a cell, 1 is 8 m, 2 is 16 m, 3 is 32 m (a whole macro cell).
function macroLevels(terrain, field, rivers, mw, mh, long = false, lod = [28, 100, 420]) {
  const { w, x0, z0, step, roadDist } = terrain, L = new Uint8Array(mw * mh);
  for (let mj = 0; mj < mh; mj++) for (let mi = 0; mi < mw; mi++) {
    let rd = 1e9;
    for (let b = 0; b <= MACRO; b += MACRO / 2) for (let a = 0; a <= MACRO; a += MACRO / 2) {
      const v = roadDist[(mj * MACRO + b) * w + mi * MACRO + a];
      if (v < rd) rd = v;
    }
    const cx = x0 + (mi + 0.5) * MACRO * step, cz = z0 + (mj + 0.5) * MACRO * step, far = field.far(cx, cz);
    // a long track has far more road in the frame, and its near ground is drawn more often at a distance
    let lv = long ? (rd < 20 ? 0 : rd < 70 ? 1 : far < 300 ? 2 : 3) : rd < lod[0] ? 0 : rd < lod[1] ? 1 : far < lod[2] ? 2 : 3;
    if (rivers) {
      const rd2 = rivers.nearest(cx, cz).d - rivers.w / 2;
      if (rd2 < 40) lv = Math.min(lv, far < 500 ? 0 : 1); else if (rd2 < 90) lv = Math.min(lv, 2);
    }
    L[mj * mw + mi] = lv;
  }
  return L;
}

// Where a fine macro cell meets a coarser one, the fine side's edge nodes lie on the coarse edge, so no crack opens.
function snapEdges(Y, w, L, mw, mh) {
  const stride = [1, 2, 4, 8];
  const snap = (base, dir, st) => {
    for (let k = 1; k < MACRO; k++) {
      if (k % st === 0) continue;
      const a = Math.floor(k / st) * st, b = a + st;
      Y[base + k * dir] = lerp(Y[base + a * dir], Y[base + b * dir], (k - a) / st);
    }
  };
  // coarsest first, so a chain of levels stays consistent
  for (let lv = 3; lv >= 1; lv--) {
    for (let mj = 0; mj < mh; mj++) for (let mi = 0; mi < mw; mi++) {
      const here = L[mj * mw + mi];
      if (here >= lv) continue;
      const i0 = mi * MACRO, j0 = mj * MACRO;
      if (mj > 0 && L[(mj - 1) * mw + mi] === lv) snap(j0 * w + i0, 1, stride[lv]);
      if (mj + 1 < mh && L[(mj + 1) * mw + mi] === lv) snap((j0 + MACRO) * w + i0, 1, stride[lv]);
      if (mi > 0 && L[mj * mw + mi - 1] === lv) snap(j0 * w + i0, w, stride[lv]);
      if (mi + 1 < mw && L[mj * mw + mi + 1] === lv) snap(j0 * w + i0 + MACRO, w, stride[lv]);
    }
  }
}

function blurGrid(w, h, Y, passes) {
  const a = Float32Array.from(Y), b = new Float32Array(Y.length);
  const cl = (i, n) => (i < 0 ? 0 : i >= n ? n - 1 : i);
  for (let p = 0; p < passes; p++) {
    for (let j = 0; j < h; j++) { const r = j * w; for (let i = 0; i < w; i++) b[r + i] = (a[r + cl(i - 1, w)] + 2 * a[r + i] + a[r + cl(i + 1, w)]) / 4; }
    for (let j = 0; j < h; j++) { const r0 = cl(j - 1, h) * w, r = j * w, r2 = cl(j + 1, h) * w; for (let i = 0; i < w; i++) a[r + i] = (b[r0 + i] + 2 * b[r + i] + b[r2 + i]) / 4; }
  }
  return a;
}

// Forest cover in 0..1: clumps from noise, thicker on the far slopes, moved by the landmark's groves and clearings.
export function createForest(look, world) {
  const T = look.trees, clump = T.clump ?? 170, groves = world.groves || [], cover = T.cover ?? 0;
  return (x, z, far) => {
    let c = cover + smooth(150, 420, far) * 0.55 - (1 - smooth(20, 90, far)) * 0.1;
    for (const g of groves) {
      const d = Math.hypot(x - g.x, z - g.z);
      if (d < g.r) c += g.cover * smooth(g.r, g.r * 0.6, d);
    }
    return smooth(-0.08, 0.22, fbm(x / clump, z / clump, 8) + c - 0.08);
  };
}

export function buildGround(track, terrain, look, mat, forestOf, world = null) {
  const { w, h, x0, z0, step } = terrain, field = coarseFar(track, terrain), rivers = riverField(terrain);
  const mw = Math.floor((w - 1) / MACRO), mh = Math.floor((h - 1) / MACRO);
  const Y = displayHeights(terrain, field, track.def.ground?.displayRise), L = macroLevels(terrain, field, rivers, mw, mh, !!track.long, track.def.ground?.lod); // ground.lod [cell 4 m to, cell 8 m to (m from the road), cell 16 m to (m from the road's middle)], for a track whose near walls are seen whole
  // world.groundDrop(x, z) -> m: the drawn ground goes this far under what a landmark lays over it (stepped terraces); no hook, no change
  if (world?.groundDrop) for (let j = 0, k = 0; j < h; j++) for (let i = 0; i < w; i++, k++) Y[k] -= world.groundDrop(x0 + i * step, z0 + j * step);
  snapEdges(Y, w, L, mw, mh);
  const Yn = blurGrid(w, h, Y, 2), T = look.terrain, altitude = track.def.horizon?.altitude ?? 0, waterY = terrain.water;
  const C = Object.fromEntries(['meadowY', 'meadow', 'meadowF', 'meadowD', 'forest', 'bank', 'bankD', 'bankWet', 'bed', 'verge'].map((k) => [k, linear(T[k] || '#808080')]));
  const [ns1, ns2] = T.noiseScale, RS = T.rockSlope;
  const groundAt = (x, z) => {
    const u = clamp((x - x0) / step, 0, w - 1.001), v = clamp((z - z0) / step, 0, h - 1.001), i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, k = j * w + i;
    return Y[k] * (1 - fu) * (1 - fv) + Y[k + 1] * fu * (1 - fv) + Y[k + w] * (1 - fu) * fv + Y[k + w + 1] * fu * fv;
  };

  const o = [0, 0, 0];
  function vertexPaint(k, x, z, out, ci, cov, vi, wood, wi) {
    const l = Yn[k - 1 < 0 ? k : k - 1], r = Yn[k + 1 >= Yn.length ? k : k + 1], u = Yn[k - w < 0 ? k : k - w], d = Yn[k + w >= Yn.length ? k : k + w];
    const gx = (r - l) / (2 * step), gz = (d - u) / (2 * step), slope = Math.atan(Math.hypot(gx, gz)) * 57.2958, y = Y[k], alt = y + altitude;
    const n1 = fbm(x / ns1, z / ns1, 3), n2 = fbm(x / ns2, z / ns2, 5), far = field.far(x, z), rd = terrain.roadDist[k];
    o[0] = C.meadow[0]; o[1] = C.meadow[1]; o[2] = C.meadow[2];
    mix3(o, C.meadowY, clamp(0.5 + 0.7 * n1, 0, 1) * 0.75);
    mix3(o, C.meadowF, clamp(n2, 0, 1) * 0.55);
    mix3(o, C.meadowD, smooth(14, 30, slope) * 0.6);
    const forest = forestOf(x, z, far);
    wood[wi] = forest;
    // grass still shows under the road's own trees; the far slopes are all forest floor
    mix3(o, C.forest, forest * lerp(0.62, T.forestMix ?? 0.62, smooth(40, 170, far)));
    // the dry verge along the road
    const v = (1 - smooth(0.4, 2.2 + 1.5 * (n2 + 0.5), rd));
    mix3(o, C.verge, v * 0.3);
    let rock = smooth(RS[0], RS[1], slope + 5 * n2);
    let snow = T.snowOnGround ? clamp(T.snowOnGround, 0, 1) : 0;
    snow = Math.max(snow, smooth(T.snowAbove - 120, T.snowAbove + 60, alt + 120 * n1) * (1 - smooth(T.snowSlope - 6, T.snowSlope + 4, slope)));
    // river banks: pale gravel where the ground is low beside the water, wet at the line
    if (waterY !== null && waterY !== undefined) {
      const above = y - waterY;
      // the gravel itself is painted per pixel (toon.js, uBank): only the bed under the water stays here
      if (above < 3.4) {
        const band = 1 - smooth(1.4, 3.2 + 0.9 * n1, above);
        mix3(o, C.bed, 1 - smooth(-0.8, 0.0, above));
        rock *= 1 - band; snow *= 1 - band;
      }
    }
    // far slopes dim gently under their trees
    out[ci] = o[0]; out[ci + 1] = o[1]; out[ci + 2] = o[2];
    cov[vi] = rock; cov[vi + 1] = snow; cov[vi + 2] = 0;
  }

  const group = new THREE.Group(), material = mat('#ffffff', { vertexColors: true, facets: true, cover: true, ground: true, shade: true });
  let triangles = 0;
  const levelStep = [1, 2, 4, 8];
  // Meshes of one level of detail, a mesh per `size` macro cells. skirt: m its outer edges hang down, over the cracks where it meets a finer neighbour.
  const buildLevel = (Lv, Yv, size, skirt = 0) => {
    const out = [], cw = Math.ceil(mw / size), ch = Math.ceil(mh / size);
    for (let cj = 0; cj < ch; cj++) for (let ci = 0; ci < cw; ci++) {
      const map = new Map(), pos = [], idx = [], nodes = [];
      const vert = (i, j) => {
        const k = j * w + i;
        let v = map.get(k);
        if (v === undefined) {
          v = pos.length / 3; map.set(k, v);
          pos.push(x0 + i * step, Yv[k], z0 + j * step); nodes.push(k);
        }
        return v;
      };
      const hung = (i, j) => {
        const k = -1 - (j * w + i);
        let v = map.get(k);
        if (v === undefined) {
          v = pos.length / 3; map.set(k, v);
          pos.push(x0 + i * step, Yv[j * w + i] - skirt, z0 + j * step); nodes.push(j * w + i);
        }
        return v;
      };
      // both faces: it is seen from whichever side the fine ground is on
      const curtain = (ai, aj, bi, bj) => { const A = vert(ai, aj), B = vert(bi, bj), C = hung(ai, aj), D = hung(bi, bj); idx.push(A, C, B, B, C, D, A, B, C, B, D, C); };
      const m0 = ci * size, n0 = cj * size, m1 = Math.min(mw, (ci + 1) * size), n1 = Math.min(mh, (cj + 1) * size);
      for (let mj = n0; mj < n1; mj++) for (let mi = m0; mi < m1; mi++) {
        const lv = Lv[mj * mw + mi], st = levelStep[lv], i0 = mi * MACRO, j0 = mj * MACRO;
        for (let b = 0; b < MACRO; b += st) for (let a = 0; a < MACRO; a += st) {
          const A = vert(i0 + a, j0 + b), B = vert(i0 + a + st, j0 + b), D = vert(i0 + a, j0 + b + st), E = vert(i0 + a + st, j0 + b + st);
          idx.push(A, D, B, B, D, E); // counter clockwise seen from above
          if (skirt) {
            if (mi === m0 && a === 0) curtain(i0, j0 + b, i0, j0 + b + st);
            if (mi === m1 - 1 && a + st === MACRO) curtain(i0 + MACRO, j0 + b, i0 + MACRO, j0 + b + st);
            if (mj === n0 && b === 0) curtain(i0 + a, j0, i0 + a + st, j0);
            if (mj === n1 - 1 && b + st === MACRO) curtain(i0 + a, j0 + MACRO, i0 + a + st, j0 + MACRO);
          }
        }
      }
      if (!idx.length) continue;
      const n = nodes.length, P = new Float32Array(pos), N = new Float32Array(n * 3), Col = new Float32Array(n * 3), Cov = new Float32Array(n * 3), Wood = new Float32Array(n);
      const Terr = world?.terraceAt && look.terrain.terraces ? new Float32Array(n) : null;
      for (let q = 0; q < n; q++) {
        const k = nodes[q], x = P[q * 3], z = P[q * 3 + 2];
        const gx = (Yn[Math.min(k + 1, Yn.length - 1)] - Yn[Math.max(k - 1, 0)]) / (2 * step), gz = (Yn[Math.min(k + w, Yn.length - 1)] - Yn[Math.max(k - w, 0)]) / (2 * step), l = Math.hypot(gx, 1, gz);
        N[q * 3] = -gx / l; N[q * 3 + 1] = 1 / l; N[q * 3 + 2] = -gz / l;
        vertexPaint(k, x, z, Col, q * 3, Cov, q * 3, Wood, q);
        // world.terraceAt(x, z) -> 0..1, with look.terrain.terraces: where the ground is painted as stepped rice fields (a landmark's plan says)
        if (Terr) Terr[q] = world.terraceAt(x, z) * (1 - clamp((Wood[q] - 0.45) / 0.4, 0, 1));
        // world.paintAt(x, z) -> null or [r, g, b, amount], linear: ground of another colour a landmark's plan says (black lava, black sand); default none
        const pa = world?.paintAt?.(x, z);
        if (pa) { const k = pa[3]; for (let c = 0; c < 3; c++) Col[q * 3 + c] += (pa[c] - Col[q * 3 + c]) * k; Wood[q] *= 1 - k; Cov[q * 3] = pa[4] ?? Cov[q * 3] * (1 - k); if (Terr) Terr[q] *= 1 - k; } // pa[4]: the bare rock cover here, default what the slope said, faded
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(P, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
      g.setAttribute('color', new THREE.BufferAttribute(Col, 3));
      g.setAttribute('cover', new THREE.BufferAttribute(Cov, 3));
      g.setAttribute('aWood', new THREE.BufferAttribute(Wood, 1));
      if (Terr) g.setAttribute('aTerr', new THREE.BufferAttribute(Terr, 1));
      g.setIndex(new THREE.BufferAttribute(n > 65535 ? new Uint32Array(idx) : new Uint16Array(idx), 1));
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, material);
      m.userData.cell = [ci, cj];
      group.add(m); out.push(m);
      triangles += idx.length / 3;
    }
    return out;
  };
  const chunks = buildLevel(L, Y, track.long ? CHUNK * 2 : CHUNK); // a long track sees more of its ground at once: fewer, larger chunks keep the draw calls down
  // A long track: each cell of FAR_CELL chunks also has one coarse mesh, drawn in place of its chunks when no camera is near (render/stream.js).
  let cells = null;
  if (track.long) {
    const Lf = L.map((lv) => (lv <= 1 ? 2 : 3)), Yf = Float32Array.from(Y);
    snapEdges(Yf, w, Lf, mw, mh);
    const far = buildLevel(Lf, Yf, CHUNK * 2 * FAR_CELL, 14);
    cells = far.map((m) => ({ far: m, near: chunks.filter((c) => Math.floor(c.userData.cell[0] / FAR_CELL) === m.userData.cell[0] && Math.floor(c.userData.cell[1] / FAR_CELL) === m.userData.cell[1]) }));
  }
  const water = waterY !== null && waterY !== undefined ? buildWater(terrain, Y, L, mw, mh, rivers, look, mat) : terrain.lake ? buildWater(terrain, Y, L, mw, mh, rivers, look, mat, terrain.lake) : null;
  return { group, chunks, cells, water, groundAt, far: field.far, triangles, heights: Y };
}

// The water: a level sheet over every cell whose ground dips under it, with the depth at each vertex for the foam line.
function buildWater(terrain, Y, L, mw, mh, rivers, look, _mat, lake = null) {
  const { w, x0, z0, step } = terrain, level = lake ? lake.level : terrain.water, group = new THREE.Group(), material = waterMaterial(look);
  // look.water.capture: a still lake that shows what stands round it, captured once by the landmark into uCapture; the number is how much of it, default none
  if (look.water.capture) material.defines = { ...material.defines, WATER_CAPTURE: 1 };
  // a lake with its own level: only its own basin holds water, the ground under that level elsewhere stays dry
  const outside = lake ? (i, j) => ((x0 + i * step - lake.x) / lake.rx) ** 2 + ((z0 + j * step - lake.z) / lake.rz) ** 2 > 1.5 : null;
  const cw = Math.ceil(mw / CHUNK), ch = Math.ceil(mh / CHUNK), levelStep = [1, 1, 2, 4];
  for (let cj = 0; cj < ch; cj++) for (let ci = 0; ci < cw; ci++) {
    const map = new Map(), pos = [], dep = [], flow = [], idx = [];
    const vert = (i, j) => {
      const k = j * w + i;
      let v = map.get(k);
      if (v === undefined) {
        v = pos.length / 3; map.set(k, v);
        const x = x0 + i * step, z = z0 + j * step;
        pos.push(x, level, z); dep.push(level - Y[k]);
        if (rivers) { const R = rivers.nearest(x, z); flow.push(R.s, R.d); } else flow.push(x, z);
      }
      return v;
    };
    for (let mj = cj * CHUNK; mj < Math.min(mh, (cj + 1) * CHUNK); mj++) for (let mi = ci * CHUNK; mi < Math.min(mw, (ci + 1) * CHUNK); mi++) {
      const st = levelStep[L[mj * mw + mi]], i0 = mi * MACRO, j0 = mj * MACRO;
      for (let b = 0; b < MACRO; b += st) for (let a = 0; a < MACRO; a += st) {
        const k = (j0 + b) * w + i0 + a, s = st;
        if (Y[k] >= level + 0.4 && Y[k + s] >= level + 0.4 && Y[k + s * w] >= level + 0.4 && Y[k + s * w + s] >= level + 0.4) continue;
        if (outside && outside(i0 + a, j0 + b)) continue;
        const A = vert(i0 + a, j0 + b), B = vert(i0 + a + s, j0 + b), D = vert(i0 + a, j0 + b + s), E = vert(i0 + a + s, j0 + b + s);
        idx.push(A, D, B, B, D, E);
      }
    }
    if (!idx.length) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aDepth', new THREE.Float32BufferAttribute(dep, 1));
    g.setAttribute('aFlow', new THREE.Float32BufferAttribute(flow, 2));
    g.setIndex(idx);
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, material);
    m.renderOrder = 1;
    group.add(m);
  }
  group.userData.material = material;
  return group;
}

function waterMaterial(look) {
  const W = look.water, c = (h) => new THREE.Color(h);
  return new THREE.ShaderMaterial({
    uniforms: {
      uFogColor: { value: c(look.fog.color) }, uFogDensity: { value: look.fog.density }, uFogFalloff: { value: look.fog.heightFalloff }, uFogBase: { value: look.fog.base ?? 0 }, uFogMax: { value: look.fog.max ?? 0.82 },
      cDeep: { value: c(W.deep) }, cBase: { value: c(W.base) }, cLight: { value: c(W.light) }, cFoam: { value: c(W.foam) }, cFar: { value: c(W.far) },
      uTime: { value: 0 }, uFlowV: { value: W.flow ?? 1.6 }, uFacetTone: { value: W.facetTone ?? 0.06 }, uShadeMap: { value: null }, uShadeRect: { value: new THREE.Vector4() },
      uLight: { value: 1.0 }, cBar: { value: c(W.bar ?? '#000000') }, uChannel: { value: W.bar ? W.channel ?? 5 : 0 },
      uCapture: { value: null }, uCaptureK: { value: W.capture ?? 0 }, uCaptureC: { value: new THREE.Vector3() }, uCaptureR: { value: 400 }, uRipple: { value: W.ripple ?? 0.02 },
      uFoam: { value: W.foamAmount ?? 1 }, uSkyK: { value: W.sky?.amount ?? 0 }, cSkyHi: { value: c(W.sky?.high ?? '#000000') }, cSkyLo: { value: c(W.sky?.low ?? '#000000') },
      uMirrorN: { value: Math.min(3, W.mirror?.length ?? 0) }, cMirror: { value: c(W.mirrorColor ?? '#000000') },
      uMirrorA: { value: [0, 1, 2].map((i) => { const m = W.mirror?.[i]; return new THREE.Vector4(m?.x ?? 0, m?.z ?? 0, m?.h ?? 1, m?.r ?? 0); }) },
      uMirrorB: { value: [0, 1, 2].map((i) => { const m = W.mirror?.[i]; return new THREE.Vector2(m?.tiers ?? 1, m?.foot ?? 0.2); }) },
      // look.water.mirrorTones: { roof, hem, foot }: the reflected shrine in its own colours, tier by tier, torn into bands by the ripple more the further up it goes; none: the plain dark mirror
      uMirrorT: { value: W.mirrorTones ? 1 : 0 }, cMirrorR: { value: c(W.mirrorTones?.roof ?? '#000000') }, cMirrorH: { value: c(W.mirrorTones?.hem ?? '#000000') }, cMirrorF: { value: c(W.mirrorTones?.foot ?? '#000000') },
      // look.water.still { x, z, rx, rz, deep, base }: a crater lake on the same water plane as a sea: inside this ellipse no foam, its own dark colours, and the capture only here. None by default
      uStill: { value: new THREE.Vector4(W.still?.x ?? 0, W.still?.z ?? 0, W.still?.rx ?? 0, W.still?.rz ?? 1) }, cStillD: { value: c(W.still?.deep ?? '#000000') }, cStillB: { value: c(W.still?.base ?? '#000000') },
    },
    vertexShader: /* glsl */`
      attribute float aDepth; attribute vec2 aFlow; varying float vDepth; varying vec2 vFlow; varying vec3 vW; varying float vV;
      void main(){ vDepth = aDepth; vFlow = aFlow; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mv = viewMatrix * w; vV = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */`
      uniform vec3 cDeep, cBase, cLight, cFoam, cFar, cBar; uniform float uTime, uFlowV, uFacetTone, uLight, uChannel; uniform sampler2D uShadeMap; uniform vec4 uShadeRect;
      uniform float uFoam, uSkyK, uMirrorN, uMirrorT; uniform vec3 cSkyHi, cSkyLo, cMirror, cMirrorR, cMirrorH, cMirrorF; uniform vec4 uMirrorA[3]; uniform vec2 uMirrorB[3];
      uniform vec4 uStill; uniform vec3 cStillD, cStillB;
      varying float vDepth, vV; varying vec2 vFlow; varying vec3 vW;
      #ifdef WATER_CAPTURE
      uniform samplerCube uCapture; uniform float uCaptureK, uCaptureR, uRipple; uniform vec3 uCaptureC;
      #endif
      ${FOG_GLSL}
      ${MIST_GLSL}
      ${NOISE_GLSL}
      void main(){
        vec2 F = vec2(vFlow.x - uTime * uFlowV, vFlow.y);
        float n = cVn(F * vec2(0.09, 0.28)) * 0.6 + cVn(F * vec2(0.21, 0.7) + 3.7) * 0.4;
        float d = clamp(vDepth / 2.4, 0.0, 1.0);
        vec3 col = mix(cLight, mix(cBase, cDeep, smoothstep(0.42, 0.78, n)), smoothstep(0.08, 0.5, d));
        // low-poly hint, in the flow's own frame, as the painted river of the reference
        vec2 fa = cTri(F * vec2(0.17, 0.42) + 4.0);
        col *= 1.0 + uFacetTone * 2.0 * (fa.x - 0.5) + uFacetTone * (fa.y - 0.5);
        // foam: a ragged white band along the shore that swells and shrinks, and thin streaks in the current
        float e0 = 0.30 + 0.34 * cVn(F * vec2(0.28, 0.5)) + 0.18 * cVn(F * vec2(0.9, 1.3) + 9.0);
        float eW = max(fwidth(vDepth), 0.02);
        float foam = 1.0 - smoothstep(e0 - eW, e0 + eW, vDepth);
        // pushed about by a slow noise first: thresholded value noise left alone shows its square cells
        vec2 Fw = F + (vec2(cVn(F * 0.31), cVn(F * 0.37 + 4.0)) - 0.5) * 2.4;
        float st = cVn(Fw * vec2(0.22, 1.9) + 17.0), st2 = cVn(Fw * vec2(0.05, 0.7) + 5.0);
        foam = max(foam, smoothstep(0.81, 0.84, st) * smoothstep(0.45, 0.65, st2) * smoothstep(0.1, 0.5, d));
        float stillK = uStill.z > 0.0 ? 1.0 - smoothstep(1.0, 1.2, length((vW.xz - uStill.xy) / uStill.zw)) : 0.0;
        col = mix(mix(col, cFoam, foam * uFoam), mix(cStillB, cStillD, smoothstep(0.42, 0.78, n)) , stillK);
        // look.water.sky: the sky at a low angle. look.water.mirror: [{ x, z, h, r, tiers, foot }]: a tiered shrine standing in still water, the reflected ray tested against its silhouette, a dark mirror image that breaks up with the ripple. None by default
        if (uSkyK > 0.0 || uMirrorN > 0.5) {
          vec3 rv = normalize(vW - cameraPosition);
          float graze = pow(1.0 - abs(rv.y), 3.0);
          if (uSkyK > 0.0) col = mix(col, mix(cSkyHi, cSkyLo, graze), uSkyK * (0.3 + 0.7 * graze) * (0.92 + 0.16 * cVn(vW.xz * vec2(0.05, 0.9) + uTime * 0.05)));
          vec3 rr = vec3(rv.x, abs(rv.y), rv.z);
          for (int mi = 0; mi < 3; mi++) {
            if (float(mi) >= uMirrorN) break;
            vec4 M0 = uMirrorA[mi]; vec2 M1 = uMirrorB[mi];
            float tt = dot(M0.xy - vW.xz, rr.xz) / max(dot(rr.xz, rr.xz), 1e-4);
            if (tt <= 0.0) continue;
            float wob = (cVn(vW.xz * vec2(0.5, 2.6) + uTime * 0.35) - 0.5) * 0.8;
            float yy = rr.y * tt, ty = yy / M0.z;
            if (ty > 1.0) continue;
            // a tier's hem at the bottom of its band, wide low in the stack and tiny at its top; a mass of brick under them
            float hw = ty < M1.y ? M0.w * 0.72 : M0.w * mix(1.0, 0.1, pow((ty - M1.y) / (1.0 - M1.y), 0.85)) * mix(1.0, 0.55, fract((ty - M1.y) / (1.0 - M1.y) * M1.x));
            float mk = 1.0 - smoothstep(hw - 0.5, hw + 0.5, length(vW.xz + rr.xz * tt - M0.xy) + wob);
            if (uMirrorT > 0.5) {
              // the tiers one by one: a dark roof, the paler hem of its eave, brick under them; streaks across the view where the wind breaks the image, more of them higher up, and it fades toward its top
              float tierF = fract((ty - M1.y) / max(1.0 - M1.y, 0.01) * M1.x);
              vec3 mc = ty < M1.y ? cMirrorF * (0.85 + 0.3 * smoothstep(0.0, M1.y, ty)) : mix(cMirrorH, cMirrorR, smoothstep(0.08, 0.3, tierF));
              float rip = smoothstep(0.34, 0.62, cVn(vW.xz * vec2(0.18, 1.9) + uTime * vec2(0.05, 0.22)));
              float rwob = (cVn(vW.xz * vec2(0.3, 3.4) + uTime * 0.5) - 0.5) * (0.8 + 2.6 * ty);
              float mt = 1.0 - smoothstep(hw - 0.4, hw + 0.4, length(vW.xz + rr.xz * tt - M0.xy) + rwob);
              col = mix(col, mc, mt * mix(0.92, 0.48, ty) * mix(1.0, rip, 0.25 + 0.6 * ty));
            } else col = mix(col, cMirror, mk * 0.88);
          }
        }
        #ifdef WATER_CAPTURE
        // still water: the wall and the cabana upside down in it, broken only by a faint breath of wind; a thin wet line at the shore
        {
          vec3 mV = normalize(cameraPosition - vW);
          vec2 mr = vec2(cVn(vW.xz * vec2(0.09, 0.9) + uTime * vec2(0.03, 0.1)), cVn(vW.xz * vec2(0.14, 1.3) + 9.0 - uTime * vec2(0.02, 0.13))) - 0.5;
          vec3 mR = reflect(-mV, normalize(vec3(mr.x * uRipple, 1.0, mr.y * uRipple * 2.2)));
          mR.y = abs(mR.y);
          // onto a sphere round the lake: a capture from its middle, read from a kart on the shore
          vec3 mP = vW - uCaptureC; float mb = dot(mP, mR), mc = dot(mP, mP) - uCaptureR * uCaptureR, mt = -mb + sqrt(max(mb * mb - mc, 0.0));
          vec3 mC = textureCube(uCapture, mP + mR * mt).rgb;
          float mF = 0.45 + 0.55 * pow(1.0 - clamp(mV.y, 0.0, 1.0), 2.5);
          col = mix(col, mC * vec3(0.78, 0.88, 0.84), uCaptureK * mF * (uStill.z > 0.0 ? stillK : 1.0));
          col = mix(col, cFoam, (1.0 - smoothstep(0.0, 0.1, vDepth)) * 0.3 * (uStill.z > 0.0 ? stillK : 1.0));
        }
        #endif
        // look.water.bar: a braided alpine river, a broad bed of pale gravel with the water in thin channels that weave across it. d is the distance from the axis, so one curve mirrored makes the braids
        if (uChannel > 0.0) {
          vec2 G = vFlow;
          float off = 6.0 + 5.0 * sin(G.x * 0.017) + 5.0 * (cVn(vec2(G.x * 0.011, 2.0)) - 0.5);
          float half_ = uChannel * (0.55 + 0.8 * cVn(vec2(G.x * 0.029, 7.0)));
          float wet = half_ - abs(G.y - off) + (cVn(G * vec2(0.09, 0.3)) - 0.5) * 3.0;
          float ew = max(fwidth(wet), 0.05);
          // stones, in two sizes, and the driftwood-dark line of the last flood
          float big = cVn(G * vec2(0.34, 0.5) + 11.0), small = cVn(G * vec2(1.4, 1.7) + 23.0);
          vec3 bar = cBar * (0.84 + 0.2 * step(0.5, big) + 0.12 * step(0.56, small));
          bar *= 1.0 - 0.26 * smoothstep(0.72, 0.74, cVn(G * vec2(0.8, 1.1) + 31.0));
          bar = mix(bar, cBar * 0.68, 1.0 - smoothstep(0.0, 1.2, wet + 1.2));
          col = mix(bar, col, smoothstep(-ew, ew, wet));
          col = mix(col, cFoam, 0.8 * smoothstep(-ew, ew, wet) * (1.0 - smoothstep(0.1, 0.1 + ew * 2.0 + 0.3, wet)));
        }
        if (uShadeRect.z > 0.0) {
          vec2 suv = vec2((vW.x - uShadeRect.x) * uShadeRect.z, (vW.z - uShadeRect.y) * uShadeRect.w);
          if (suv.x > 0.0 && suv.x < 1.0 && suv.y > 0.0 && suv.y < 1.0) col *= mix(0.62, 1.0, texture2D(uShadeMap, suv).r);
        }
        gl_FragColor = vec4(mix(applyFog(col * uLight, vV, vW.y), mistColor(vW), mistAmount(vW)), 0.0);
      }`,
  });
}

// One blurred sun mask over the ground near the road, from a sun's-eye depth pass over the casters and soft blobs of
// contact shade at the foot of trees and walls. R: sun 0..1, G: contact shade 0..1. Done once at load.
export function bakeGroundShade(renderer, scene, world, look, shared, { size = 4096, margin = 300 } = {}) {
  const { track, ground, casters, blobs } = world, S = track.samples;
  let ax = 1e9, az = 1e9, bx = -1e9, bz = -1e9;
  for (let i = 0; i < track.n; i++) { ax = Math.min(ax, S.x[i]); bx = Math.max(bx, S.x[i]); az = Math.min(az, S.z[i]); bz = Math.max(bz, S.z[i]); }
  ax -= margin; az -= margin; bx += margin; bz += margin;
  const side = Math.max(bx - ax, bz - az), cx = (ax + bx) / 2, cz = (az + bz) / 2;
  ax = cx - side / 2; az = cz - side / 2;

  const LAYER_CASTER = 2, LAYER_GROUND = 3, LAYER_OBJECT = 4;
  // look.shadeFine { bias (m) }: a low sun on a long track. The ground as a caster needs a bias of metres, which starts every shadow metres from its foot and loses a wall altogether: what stands gets a depth pass of its own with this small bias, and the frustum hugs the ground, foreshortened by the low sun. Off by default
  const fine = look.shadeFine && track.long ? look.shadeFine : null;
  // a long track's world is far wider than it is tall: a depth range round the ground keeps the depth bias at the metres of a short one
  const sv = sunVector(look.sun), D = side * 1.2, sunV = fine ? side * 0.75 * Math.abs(sv[1]) + 170 : side * 0.8, sun = new THREE.OrthographicCamera(-side * 0.8, side * 0.8, sunV, -sunV, track.long ? D * 1.6 - side * 1.1 : 10, track.long ? D * 1.6 + side * 1.1 : D * 4);
  sun.position.set(cx + sv[0] * D * 1.6, 60 + sv[1] * D * 1.6, cz + sv[2] * D * 1.6);
  sun.lookAt(cx, 20, cz); sun.updateMatrixWorld(); sun.layers.set(LAYER_CASTER);
  const depthRT = new THREE.WebGLRenderTarget(size, size, { depthBuffer: true });
  depthRT.depthTexture = new THREE.DepthTexture(size, size); depthRT.depthTexture.type = THREE.FloatType;
  for (const m of casters) m.layers.enable(LAYER_CASTER);
  for (const m of ground.chunks) { m.layers.enable(LAYER_CASTER); m.layers.enable(LAYER_GROUND); }
  const prevOverride = scene.overrideMaterial, prevBg = scene.background, prevClear = renderer.getClearColor(new THREE.Color()), prevAlpha = renderer.getClearAlpha();
  const depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide });
  scene.overrideMaterial = depthOnly;
  renderer.setRenderTarget(depthRT);
  renderer.setClearColor(0xffffff, 1);
  renderer.clear();
  renderer.render(scene, sun);
  let depthO = null;
  if (fine) {
    depthO = new THREE.WebGLRenderTarget(size, size, { depthBuffer: true });
    depthO.depthTexture = new THREE.DepthTexture(size, size); depthO.depthTexture.type = THREE.FloatType;
    for (const m of casters) m.layers.enable(LAYER_OBJECT);
    sun.layers.set(LAYER_OBJECT);
    renderer.setRenderTarget(depthO);
    renderer.clear();
    renderer.render(scene, sun);
    for (const m of casters) m.layers.disable(LAYER_OBJECT);
  }

  // the mask, seen straight down: each ground fragment asks the depth pass whether the sun reaches it
  const vp = new THREE.Matrix4().multiplyMatrices(sun.projectionMatrix, sun.matrixWorldInverse);
  const maskMat = new THREE.ShaderMaterial({
    uniforms: { tD: { value: depthRT.depthTexture }, tO: { value: depthO?.depthTexture ?? null }, uFine: { value: fine ? (fine.bias ?? 0.6) / (side * 2.2) : -1 }, uVP: { value: vp }, uTexel: { value: 1 / size }, uBias: { value: track.long ? 9.5 / (side * 2.2) : 0.0009 } },
    vertexShader: 'varying vec4 vS; uniform mat4 uVP; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vS = uVP * w; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: /* glsl */`uniform sampler2D tD, tO; uniform float uTexel, uBias, uFine; varying vec4 vS;
      void main(){ vec3 p = vS.xyz / vS.w * 0.5 + 0.5; float s = 0.0, t = uTexel * 1.5;
        for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) s += step(p.z - uBias, texture2D(tD, p.xy + vec2(float(i), float(j)) * t).x);
        s /= 25.0;
        if (uFine >= 0.0) { float o = 0.0; for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) o += step(p.z - uFine, texture2D(tO, p.xy + vec2(float(i), float(j)) * uTexel * 0.9).x); s = min(s, o / 9.0); }
        gl_FragColor = vec4(s, 1.0, 0.0, 1.0); }`,
  });
  const top = new THREE.OrthographicCamera(-side / 2, side / 2, side / 2, -side / 2, 1, 4000);
  top.position.set(cx, 2000, cz); top.up.set(0, 0, -1); top.lookAt(cx, 0, cz); top.updateMatrixWorld(); top.layers.set(LAYER_GROUND);
  const maskRT = new THREE.WebGLRenderTarget(size, size, { depthBuffer: true });
  scene.overrideMaterial = maskMat;
  renderer.setRenderTarget(maskRT);
  renderer.setClearColor(0xffff00, 1);
  renderer.clear();
  renderer.render(scene, top);
  scene.overrideMaterial = prevOverride;

  // contact shade: soft dark blobs multiplied into G
  if (blobs.length) {
    const blobScene = new THREE.Scene();
    const quad = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
    const blobMat = new THREE.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
      blendSrc: THREE.ZeroFactor, blendDst: THREE.SrcColorFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
      vertexShader: 'varying vec2 vQ; varying float vS; attribute float aStrength; void main(){ vQ = position.xz; vS = aStrength; gl_Position = projectionMatrix * viewMatrix * instanceMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec2 vQ; varying float vS; void main(){ float r = length(vQ); float g = 1.0 - vS * (1.0 - smoothstep(0.2, 1.0, r)); gl_FragColor = vec4(1.0, g, 1.0, 1.0); }',
    });
    const inst = new THREE.InstancedMesh(quad, blobMat, blobs.length), M = new THREE.Matrix4(), St = new Float32Array(blobs.length);
    blobs.forEach((b, i) => { M.makeScale(b.r, 1, b.r); M.setPosition(b.x, 0, b.z); inst.setMatrixAt(i, M); St[i] = b.a ?? 0.45; });
    quad.setAttribute('aStrength', new THREE.InstancedBufferAttribute(St, 1));
    inst.frustumCulled = false;
    blobScene.add(inst);
    top.layers.enableAll();
    renderer.setRenderTarget(maskRT);
    renderer.render(blobScene, top);
    inst.dispose(); quad.dispose(); blobMat.dispose();
  }

  // a light blur: painted soft shadows, and no stairs at 0.4 m a texel
  const blurA = new THREE.WebGLRenderTarget(size, size, { depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  const out = new THREE.WebGLRenderTarget(size, size, { depthBuffer: false, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: true });
  const blur = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false, uniforms: { t: { value: null }, d: { value: new THREE.Vector2() } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'uniform sampler2D t; uniform vec2 d; varying vec2 vUv; void main(){ gl_FragColor = texture2D(t, vUv) * 0.28 + (texture2D(t, vUv + d) + texture2D(t, vUv - d)) * 0.24 + (texture2D(t, vUv + d * 2.2) + texture2D(t, vUv - d * 2.2)) * 0.12; }',
  });
  const qs = new THREE.Scene(), q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blur); q.frustumCulled = false; qs.add(q);
  const qc = new THREE.Camera();
  blur.uniforms.t.value = maskRT.texture; blur.uniforms.d.value.set(1.3 / size, 0); renderer.setRenderTarget(blurA); renderer.render(qs, qc);
  blur.uniforms.t.value = blurA.texture; blur.uniforms.d.value.set(0, 1.3 / size); renderer.setRenderTarget(out); renderer.render(qs, qc);
  renderer.setRenderTarget(null);
  renderer.setClearColor(prevClear, prevAlpha);
  scene.background = prevBg;
  if (depthO) { depthO.dispose(); depthO.depthTexture.dispose(); }
  depthRT.dispose(); depthRT.depthTexture.dispose(); maskRT.dispose(); blurA.dispose(); maskMat.dispose(); blur.dispose(); depthOnly.dispose(); q.geometry.dispose();
  for (const m of casters) m.layers.disable(LAYER_CASTER);
  for (const m of ground.chunks) { m.layers.disable(LAYER_CASTER); m.layers.disable(LAYER_GROUND); }
  out.texture.anisotropy = 4;
  shared.shadeMap.value = out.texture;
  // the top camera's image: u grows with x, v with -z (its up is -z): a negative scale from the far edge says just that
  shared.shadeRect.value.set(ax, az + side, 1 / side, -1 / side);
  return { texture: out.texture, target: out, rect: [ax, az, side] };
}
