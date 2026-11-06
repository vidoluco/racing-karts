// buildTerrain(track) -> Terrain: the height grid the sim rolls on and the renderer draws, pure and deterministic.
// Natural ground first (the road's own heights spread out by distance, def.ground.shape, fbm hills, the rim, the
// river), then an envelope from every road sample: terrain may not rise above the road plus a cut slope, nor fall
// below it less a fill slope. Min and max of slope limited cones stay continuous however close two levels run, which
// a plain blend toward the nearest sample is not, and the cuts always win so no road is ever buried. Decks (bridge,
// viaduct) only cut: the valley stays open under them.
//
// def.ground: { base, hills, hillScale, rimHeight, rimFrom, rimTo, water,
//   shape?: (x, z) => m, a broad relief added to the natural ground (a valley side, a caldera),
//   river?: { points: [[x, z], ...], w, depth } a channel under `water`, which only decks may cross,
//   dry?: true keeps the natural ground above `water` outside the channel,
//   flats?: [{ from, to, w }] on these fractions of the lap (from > to wraps) the ground is level with the road for w m past its edge: the made ground of a street with houses }

const COARSE = 32;
const FLAT = 6;          // m of level shoulder past the road's edge: wider than a grid cell's diagonal, so bilinear never pokes up
const EASE = 10;         // m over which a shoulder's slope grows to full
const REACH = 112;       // m from the road's centre where the envelope lets go; the natural ground is within it by then
const CUT = 1.1, FILL = 0.75;
const SINK = 0.14;       // terrain under the road, so the ribbon never z-fights
const DECK_CLEAR = 2.5;  // terrain under a deck at least this far below it

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const shoulder = (t) => (t <= FLAT ? 0 : t - FLAT < EASE ? (t - FLAT) * (t - FLAT) / (2 * EASE) : t - FLAT - EASE / 2);

function hashId(id) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Table value noise in [-1, 1], one table per track: the same ground on every run, fast over half a million nodes.
function makeNoise(seed) {
  const perm = new Uint8Array(512), val = new Float32Array(256);
  let s = seed || 1;
  const next = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) { p[i] = i; val[i] = next() * 2 - 1; }
  for (let i = 255; i > 0; i--) { const j = Math.floor(next() * (i + 1)), t = p[i]; p[i] = p[j]; p[j] = t; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  return (x, z) => {
    const xf = Math.floor(x), zf = Math.floor(z), fx = x - xf, fz = z - zf, i = xf & 255, j = zf & 255;
    const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
    const a = val[perm[perm[i] + j]], b = val[perm[perm[(i + 1) & 255] + j]];
    const c = val[perm[perm[i] + ((j + 1) & 255)]], d = val[perm[perm[(i + 1) & 255] + ((j + 1) & 255)]];
    return a + (b - a) * sx + (c - a + (a - b + d - c) * sx) * sz;
  };
}

// Every road sample as one list, the main lap then each shortcut.
function collectRoads(track) {
  const parts = [{ S: track.samples, n: track.n, k: track.curvature, step: track.step, main: true }];
  for (const sc of track.shortcuts || []) parts.push({ S: sc.samples, n: sc.n, k: sc.curvature, step: sc.step, main: false });
  return parts;
}

function densifyRiver(river) {
  const xs = [], zs = [], P = river.points;
  for (let i = 0; i + 1 < P.length; i++) {
    const [ax, az] = P[Math.max(0, i - 1)], [bx, bz] = P[i], [cx, cz] = P[i + 1], [dx, dz] = P[Math.min(P.length - 1, i + 2)];
    const len = Math.hypot(cx - bx, cz - bz), m = Math.max(1, Math.ceil(len / 4));
    for (let k = 0; k < m; k++) {
      const t = k / m, t2 = t * t, t3 = t2 * t;
      xs.push(0.5 * (2 * bx + (cx - ax) * t + (2 * ax - 5 * bx + 4 * cx - dx) * t2 + (3 * bx - ax - 3 * cx + dx) * t3));
      zs.push(0.5 * (2 * bz + (cz - az) * t + (2 * az - 5 * bz + 4 * cz - dz) * t2 + (3 * bz - az - 3 * cz + dz) * t3));
    }
  }
  xs.push(P[P.length - 1][0]); zs.push(P[P.length - 1][1]);
  return { xs, zs };
}

export function buildTerrain(track) {
  const def = track.def, G = def.ground || {};
  const step = def.grid?.spacing ?? 4;
  const base = G.base ?? 0, hills = G.hills ?? 26, hillScale = G.hillScale ?? 240;
  const rimHeight = G.rimHeight ?? 140, rimFrom = G.rimFrom ?? 520, rimTo = G.rimTo ?? 1100;
  const water = G.water ?? null;
  const roads = collectRoads(track);

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const { S, n } of roads) for (let i = 0; i < n; i++) {
    if (S.x[i] < minX) minX = S.x[i];
    if (S.x[i] > maxX) maxX = S.x[i];
    if (S.z[i] < minZ) minZ = S.z[i];
    if (S.z[i] > maxZ) maxZ = S.z[i];
  }
  const x0 = Math.floor((minX - rimTo) / step) * step, z0 = Math.floor((minZ - rimTo) / step) * step;
  const w = Math.ceil((maxX + rimTo - x0) / step) + 1, h = Math.ceil((maxZ + rimTo - z0) / step) + 1;
  const data = new Float32Array(w * h);

  // Coarse layer: the slow fields, cheap to compute per node here and bilinear below.
  const cw = Math.ceil((w * step) / COARSE) + 2, ch = Math.ceil((h * step) / COARSE) + 2;
  const cMacro = new Float32Array(cw * ch), cFar = new Float32Array(cw * ch), cRiver = new Float32Array(cw * ch).fill(1e6);
  const ax = [], ay = [], az = [];
  for (const { S, n, main } of roads) {
    const stride = main ? 16 : 24;
    for (let i = 0; i < n; i += stride) {
      if (S.struct && (S.struct[i] === 1 || S.struct[i] === 2)) continue;
      ax.push(S.x[i]); ay.push(S.y[i]); az.push(S.z[i]);
    }
  }
  const river = G.river ? densifyRiver(G.river) : null;
  const riverW = G.river?.w ?? 0, riverDepth = G.river?.depth ?? 2.5;
  const rx = [], rz = [];
  if (river) for (let i = 0; i < river.xs.length; i += 8) { rx.push(river.xs[i]); rz.push(river.zs[i]); }
  const shape = typeof G.shape === 'function' ? G.shape : null;
  for (let j = 0, c = 0; j < ch; j++) {
    const z = z0 + j * COARSE;
    for (let i = 0; i < cw; i++, c++) {
      const x = x0 + i * COARSE;
      let sw = 0, sy = 0, far = 1e12;
      for (let q = 0; q < ax.length; q++) {
        const dx = x - ax[q], dz = z - az[q], e = dx * dx + dz * dz;
        if (e < far) far = e;
        const f = 1 / ((e + 900) * (e + 900));
        sw += f; sy += f * ay[q];
      }
      cMacro[c] = sy / sw + (shape ? shape(x, z) : 0);
      cFar[c] = Math.sqrt(far);
      let rd = 1e12;
      for (let q = 0; q < rx.length; q++) {
        const dx = x - rx[q], dz = z - rz[q], e = dx * dx + dz * dz;
        if (e < rd) rd = e;
      }
      if (rx.length) cRiver[c] = Math.sqrt(rd);
    }
  }

  const noise = makeNoise(hashId(def.id || 'track'));
  const noise2 = makeNoise((hashId(def.id || 'track') ^ 0x9e3779b9) >>> 0);
  const fs = 1 / hillScale, rs = 1 / 460, cs = step / COARSE, floor = water === null ? 0 : water + 2.2;
  for (let j = 0, k = 0; j < h; j++) {
    const z = z0 + j * step, cj = j * cs, cj0 = Math.floor(cj), cfz = cj - cj0;
    for (let i = 0; i < w; i++, k++) {
      const x = x0 + i * step, ci = i * cs, ci0 = Math.floor(ci), cfx = ci - ci0, c = cj0 * cw + ci0;
      const wa = (1 - cfx) * (1 - cfz), wb = cfx * (1 - cfz), wc = (1 - cfx) * cfz, wd = cfx * cfz;
      const macro = cMacro[c] * wa + cMacro[c + 1] * wb + cMacro[c + cw] * wc + cMacro[c + cw + 1] * wd;
      const far = cFar[c] * wa + cFar[c + 1] * wb + cFar[c + cw] * wc + cFar[c + cw + 1] * wd;
      const fx = x * fs, fz = z * fs;
      let n = noise(fx, fz) * 0.56 + noise(fx * 2.07 + 11.3, fz * 2.07 - 4.1) * 0.27 + noise(fx * 4.3 - 7.7, fz * 4.3 + 2.9) * 0.12;
      if (far < 420) n += noise(fx * 8.9 + 3.1, fz * 8.9 + 9.7) * 0.05;
      const rim = far <= rimFrom ? 0 : rimHeight * smooth(rimFrom, rimTo, far) * (0.74 + 0.5 * Math.abs(noise2(x * rs, z * rs)));
      let v = base + macro + hills * (0.3 + 0.7 * smooth(24, 190, far)) * n + rim;
      // def.ground.fine: relief too small for the coarse layer `shape` is read through (ledges, ribs), per node; default none
      if (G.fine) v += G.fine(x, z);
      // def.ground.dry: a shape may dig the valley out as far as it likes, but no lake opens where the land goes under `water`
      if (G.dry && v < floor) v = floor;
      // river.walled: a canal between walls in a flat city, no valley round it (default: the valley)
      if (rx.length && !G.river?.walled) {
        const rd = cRiver[c] * wa + cRiver[c + 1] * wb + cRiver[c + cw] * wc + cRiver[c + cw + 1] * wd;
        // the valley floor reaches well past the channel, so the rim opens where the river leaves the world
        v = floor + (v - floor) * smooth(24, 170, rd);
      }
      data[k] = v;
    }
  }

  // The channel, cut in before the roads so that only decks can carry a road across it.
  if (river) {
    const REACH_R = 66, hw = riverW / 2, bed = water - riverDepth;
    const rd = new Float32Array(w * h).fill(1e6), rn = Math.ceil(REACH_R / step);
    for (let q = 0; q < river.xs.length; q++) {
      const sx = river.xs[q], sz = river.zs[q];
      const ci = Math.round((sx - x0) / step), cj = Math.round((sz - z0) / step);
      for (let j = Math.max(0, cj - rn); j <= Math.min(h - 1, cj + rn); j++) {
        for (let i = Math.max(0, ci - rn), k = j * w + i; i <= Math.min(w - 1, ci + rn); i++, k++) {
          const dx = x0 + i * step - sx, dz = z0 + j * step - sz, e = dx * dx + dz * dz;
          if (e < rd[k]) rd[k] = e;
        }
      }
    }
    for (let k = 0; k < rd.length; k++) {
      if (rd[k] >= 1e6) continue;
      const t = Math.sqrt(rd[k]);
      if (t > REACH_R) continue;
      const cap = G.river.walled
        ? (t > hw + 3 ? Infinity : bed + (water + 0.5 - bed) * smooth(hw * 0.45, hw - 1, t))
        : bed + (water + 0.5 - bed) * smooth(hw * 0.45, hw + 2, t) + 0.3 * Math.max(0, t - hw - 2);
      if (cap < data[k]) data[k] = cap;
    }
  }

  // The road envelope. Each sample only speaks for the slab of ground square to it, or a node beside a steep road
  // would take the height of a sample ten metres further down and sit a metre under the surface.
  const caps = new Float32Array(w * h).fill(Infinity), floors = new Float32Array(w * h).fill(-Infinity);
  const roadDist = new Float32Array(w * h).fill(REACH);
  const rn = Math.ceil(REACH / step);
  const flats = G.flats || null;
  for (const { S, n, k: curv, step: sStep, main } of roads) {
    const half = sStep / 2 + 0.05;
    for (let q = 0; q < n; q++) {
      let flat = 0;
      if (flats && main) for (const F of flats) { const u = q / n; if (F.from > F.to ? u >= F.from || u <= F.to : u >= F.from && u <= F.to) flat = F.w; }
      const sx = S.x[q], sy = S.y[q], sz = S.z[q], tx = S.tx[q], tz = S.tz[q], nx = S.nx[q], nz = S.nz[q];
      const hw = S.w[q] / 2, kk = Math.abs(curv[q]), slope = -Math.tan(S.bank[q] * Math.PI / 180);
      const deck = S.struct ? S.struct[q] === 1 || S.struct[q] === 2 : false;
      const ci = Math.round((sx - x0) / step), cj = Math.round((sz - z0) / step);
      const j0 = Math.max(0, cj - rn), j1 = Math.min(h - 1, cj + rn), i0 = Math.max(0, ci - rn), i1 = Math.min(w - 1, ci + rn);
      for (let j = j0; j <= j1; j++) {
        const dz = z0 + j * step - sz;
        for (let i = i0, kn = j * w + i0; i <= i1; i++, kn++) {
          const dx = x0 + i * step - sx, along = dx * tx + dz * tz, lat = dx * nx + dz * nz, al = lat < 0 ? -lat : lat;
          // the slab fans out on the outside of a bend; a little overlap only means a slightly stricter min and max
          if ((along < 0 ? -along : along) > half * (1 + kk * al) + 0.6) continue;
          if (al > REACH) continue;
          const t = al - hw, edge = t > 0 ? t : 0;
          if (edge < roadDist[kn]) roadDist[kn] = edge;
          const y = sy + (lat < -hw ? -hw : lat > hw ? hw : lat) * slope;
          if (deck) {
            const cap = y - DECK_CLEAR + CUT * (t > 1 ? t - 1 : 0);
            if (cap < caps[kn]) caps[kn] = cap;
          } else {
            const s = shoulder(flat ? Math.max(0, edge - flat) : edge), cap = y - SINK + CUT * s, fl = y - SINK - FILL * s;
            if (cap < caps[kn]) caps[kn] = cap;
            if (fl > floors[kn]) floors[kn] = fl;
          }
        }
      }
    }
  }
  // Where a deck meets the ground the fill runs on past the road's end and falls away: an abutment, not a cliff.
  const ABUT = 0.9, an = Math.ceil(46 / step);
  for (const { S, n } of roads) {
    if (!S.struct) continue;
    const isDeck = (q) => S.struct[(q + n) % n] === 1 || S.struct[(q + n) % n] === 2;
    for (let q = 0; q < n; q++) {
      const dir = !isDeck(q) && isDeck(q + 1) ? 1 : !isDeck(q) && isDeck(q - 1) ? -1 : 0;
      if (!dir) continue;
      const sx = S.x[q], sy = S.y[q], sz = S.z[q], hw = S.w[q] / 2;
      const ci = Math.round((sx - x0) / step), cj = Math.round((sz - z0) / step);
      for (let j = Math.max(0, cj - an); j <= Math.min(h - 1, cj + an); j++) {
        const dz = z0 + j * step - sz;
        for (let i = Math.max(0, ci - an), kn = j * w + i; i <= Math.min(w - 1, ci + an); i++, kn++) {
          const dx = x0 + i * step - sx, ahead = (dx * S.tx[q] + dz * S.tz[q]) * dir;
          if (ahead < 0) continue;
          const side = Math.max(0, Math.abs(dx * S.nx[q] + dz * S.nz[q]) - hw), fl = sy - SINK - ABUT * Math.hypot(side, ahead);
          if (fl > floors[kn]) floors[kn] = fl;
        }
      }
    }
  }
  for (let k = 0; k < data.length; k++) {
    let v = data[k];
    if (v < floors[k]) v = floors[k];
    if (v > caps[k]) v = caps[k];
    data[k] = v;
  }
  // def.ground.relax: passes of a small blur away from the road. The cut cone meets the natural ground in a crease, a ruled line across a meadow; the shoulder itself stays exact (default 0)
  if (G.relax) {
    const tmp = new Float32Array(data.length);
    for (let pass = 0; pass < G.relax; pass++) {
      tmp.set(data);
      for (let j = 1; j < h - 1; j++) for (let i = 1, k = j * w + 1; i < w - 1; i++, k++) {
        const keep = Math.min(1, Math.max(0, (roadDist[k] - FLAT - 2) / 8));
        // a river bed stays where it was dug: a blur fills a channel in
        if (keep <= 0 || (water !== null && tmp[k] < water + 0.5)) continue;
        const v = (tmp[k] * 4 + (tmp[k - 1] + tmp[k + 1] + tmp[k - w] + tmp[k + w]) * 2 + tmp[k - w - 1] + tmp[k - w + 1] + tmp[k + w - 1] + tmp[k + w + 1]) / 16;
        data[k] = Math.min(caps[k], tmp[k] + (v - tmp[k]) * keep);
      }
    }
  }

  const X1 = w - 1, Z1 = h - 1;
  const heightAt = (x, z) => {
    const u = clamp((x - x0) / step, 0, X1), v = clamp((z - z0) / step, 0, Z1);
    const i = Math.min(Math.floor(u), X1 - 1), j = Math.min(Math.floor(v), Z1 - 1), fu = u - i, fv = v - j, k = j * w + i;
    return data[k] * (1 - fu) * (1 - fv) + data[k + 1] * fu * (1 - fv) + data[k + w] * (1 - fu) * fv + data[k + w + 1] * fu * fv;
  };
  const normalAt = (x, z, out = {}) => {
    const e = step, dx = heightAt(x + e, z) - heightAt(x - e, z), dz = heightAt(x, z + e) - heightAt(x, z - e);
    const l = Math.hypot(dx, 2 * e, dz);
    out.x = -dx / l; out.y = 2 * e / l; out.z = -dz / l;
    return out;
  };
  // m from the nearest road edge (0 on a road), capped at REACH: trees, rocks and props stay off the shoulder with it
  const roadDistAt = (x, z) => {
    const u = clamp((x - x0) / step, 0, X1), v = clamp((z - z0) / step, 0, Z1);
    const i = Math.min(Math.floor(u), X1 - 1), j = Math.min(Math.floor(v), Z1 - 1), fu = u - i, fv = v - j, k = j * w + i;
    return roadDist[k] * (1 - fu) * (1 - fv) + roadDist[k + 1] * fu * (1 - fv) + roadDist[k + w] * (1 - fu) * fv + roadDist[k + w + 1] * fu * fv;
  };
  // lake: def.ground.lake { x, z, rx, rz, level }, one body of water with a level of its own, for a lake that lies above the rest of the world; `water` would flood everything under it
  return { w, h, x0, z0, step, data, heightAt, normalAt, roadDist, roadDistAt, water, waterLevel: water, lake: G.lake ?? null, river: river ? { xs: Float32Array.from(river.xs), zs: Float32Array.from(river.zs), w: riverW } : null };
}
