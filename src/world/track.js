// buildTrack(def) -> Track: the closed road as uniform samples, pure and deterministic. Sim, bots, terrain and
// renderer all read this one object. Conventions:
//   (tx, tz) unit tangent in the driving direction, (nx, nz) = (tz, -tx) unit normal to the driver's left.
//   d is lateral, + left. yaw = atan2(tx, tz): forward is (sin yaw, cos yaw), so a model built facing +z takes
//   rotation.y = yaw. curvature is 1/m, + when the road turns left.
//   samples.bank is degrees, + when the left edge is lower: y(d) = y - d * tan(bank). A def's `bank` is how much the
//   road leans INTO its turn, whichever way it turns (negative: off camber); the builder signs and fades it by the
//   local curvature, so an S bend goes through level on its own.

export const SURFACES = ['asphalt', 'dirt', 'sand', 'snow', 'ice', 'wood', 'cobble'];
export const STRUCTS = ['none', 'bridge', 'viaduct', 'tunnel'];
const STRUCT_TAGS = new Set(['bridge', 'viaduct', 'tunnel']);

const STEP = 2;
const D2R = Math.PI / 180;
const BOX_LIFT = 1.1;       // centre of a crate above the road
const NEAR_WINDOW = 32;     // samples each way (64 m): far less than the arc between two levels of a crossing
const LOST_M = 70;          // past this much off the hinted window the hint is stale (a rescue): search everywhere
const BANK_FULL_RADIUS = 30; // m, a turn this tight takes all of the def's bank
const BAND_EVERY = 500;     // m between bands of crates on a long track (def.long)
const INDEX_CELL = 64;      // m, cells of the spatial index of a long track
const LEVEL_SLACK = 12;     // m: a stale hint's search takes the stretch nearest along the road among those this close, so a crossing keeps its level

const smooth = (t) => t * t * (3 - 2 * t);
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const surfaceIndex = (s) => {
  const k = SURFACES.indexOf(s ?? 'asphalt');
  if (k < 0) throw new Error(`track: unknown surface ${s}`);
  return k;
};

// Centripetal Catmull-Rom (Barry and Goldman): no cusps or loops however unevenly the hand placed points are spaced.
function segment(p0, p1, p2, p3, out, t) {
  const pw = (a, b) => Math.sqrt(Math.max(1e-6, Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])));
  const t1 = pw(p0, p1), t2 = t1 + pw(p1, p2), t3 = t2 + pw(p2, p3);
  const s = t1 + (t2 - t1) * t;
  for (let c = 0; c < 3; c++) {
    const a1 = p0[c] + (p1[c] - p0[c]) * (s / t1);
    const a2 = p1[c] + (p2[c] - p1[c]) * ((s - t1) / (t2 - t1));
    const a3 = p2[c] + (p3[c] - p2[c]) * ((s - t2) / (t3 - t2));
    const b1 = a1 + (a2 - a1) * (s / t2);
    const b2 = a2 + (a3 - a2) * ((s - t1) / (t3 - t1));
    out[c] = b1 + (b2 - b1) * ((s - t1) / (t2 - t1));
  }
}

// ctrl: [{ p, w, bank, surface }]; ghosts: the neighbours just outside an open polyline's ends.
// Returns the polyline resampled to about `step` m by 3D arc length, with the source param of each sample.
function sampleSpline(ctrl, closed, ghosts) {
  const m = ctrl.length, segs = closed ? m : m - 1, SUB = 48;
  const lens = new Float64Array(segs * SUB + 1), px = new Float64Array(segs * SUB + 1), py = new Float64Array(segs * SUB + 1), pz = new Float64Array(segs * SUB + 1);
  const o = [0, 0, 0], at = (j) => (closed ? ctrl[(j + m) % m].p : j < 0 ? ghosts[0] : j >= m ? ghosts[1] : ctrl[j].p);
  let L = 0, q = 0;
  for (let s = 0; s < segs; s++) {
    for (let k = s === 0 ? 0 : 1; k <= SUB; k++) {
      segment(at(s - 1), at(s), at(s + 1), at(s + 2), o, k / SUB);
      if (q > 0) L += Math.hypot(o[0] - px[q - 1], o[1] - py[q - 1], o[2] - pz[q - 1]);
      px[q] = o[0]; py[q] = o[1]; pz[q] = o[2]; lens[q] = L; q++;
    }
  }
  const n = Math.max(2, Math.round(L / STEP)), step = L / n, count = closed ? n : n + 1;
  const X = new Float64Array(count), Y = new Float64Array(count), Z = new Float64Array(count), P = new Float64Array(count);
  for (let i = 0, w = 0; i < count; i++) {
    const s = Math.min(i * step, L);
    while (w < q - 2 && lens[w + 1] < s) w++;
    const f = (s - lens[w]) / Math.max(1e-9, lens[w + 1] - lens[w]);
    X[i] = px[w] + (px[w + 1] - px[w]) * f;
    Y[i] = py[w] + (py[w + 1] - py[w]) * f;
    Z[i] = pz[w] + (pz[w + 1] - pz[w]) * f;
    P[i] = (w + f) / SUB;
  }
  // where each control point landed along the arc, for structures and for whoever places things by hand
  const pointS = [];
  for (let j = 0; j < m; j++) pointS.push(lens[Math.min(j * SUB, q - 1)]);
  return { X, Y, Z, P, length: L, count, step, pointS };
}

function fillDerived(S, count, step, closed) {
  const { x, z, tx, tz, nx, nz } = S;
  for (let i = 0; i < count; i++) {
    const a = closed ? (i - 1 + count) % count : Math.max(0, i - 1), b = closed ? (i + 1) % count : Math.min(count - 1, i + 1);
    const dx = x[b] - x[a], dz = z[b] - z[a], l = Math.hypot(dx, dz) || 1;
    tx[i] = dx / l; tz[i] = dz / l; nx[i] = tz[i]; nz[i] = -tx[i];
  }
  const k = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const a = closed ? (i - 1 + count) % count : Math.max(0, i - 1), b = closed ? (i + 1) % count : Math.min(count - 1, i + 1);
    k[i] = ((tx[b] - tx[a]) * nx[i] + (tz[b] - tz[a]) * nz[i]) / (2 * step);
  }
  return k;
}

const boxBlur = (src, radius, closed) => {
  const n = src.length, out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0, c = 0;
    for (let o = -radius; o <= radius; o++) {
      const j = closed ? (i + o + n) % n : i + o;
      if (j < 0 || j >= n) continue;
      sum += src[j]; c++;
    }
    out[i] = sum / c;
  }
  return out;
};

// A long track's samples by map cell, so that a search with no good hint costs a few cells and never the whole lap.
function sampleIndex(S, count) {
  let ax = Infinity, az = Infinity, bx = -Infinity, bz = -Infinity;
  for (let i = 0; i < count; i++) { if (S.x[i] < ax) ax = S.x[i]; if (S.x[i] > bx) bx = S.x[i]; if (S.z[i] < az) az = S.z[i]; if (S.z[i] > bz) bz = S.z[i]; }
  const cols = Math.floor((bx - ax) / INDEX_CELL) + 1, rows = Math.floor((bz - az) / INDEX_CELL) + 1;
  const start = new Int32Array(cols * rows + 1), ids = new Int32Array(count), cellOf = (i) => Math.floor((S.z[i] - az) / INDEX_CELL) * cols + Math.floor((S.x[i] - ax) / INDEX_CELL);
  for (let i = 0; i < count; i++) start[cellOf(i) + 1]++;
  for (let c = 0; c < cols * rows; c++) start[c + 1] += start[c];
  const fill = start.slice();
  for (let i = 0; i < count; i++) ids[fill[cellOf(i)]++] = i;
  // calls visit(sample) over the cells rings out from (x, z) until reach() m is closer than the next ring can be
  function rings(x, z, reach, visit) {
    const px = clamp(x, ax, bx), pz = clamp(z, az, bz), ci = Math.floor((px - ax) / INDEX_CELL), cj = Math.floor((pz - az) / INDEX_CELL), most = Math.max(cols, rows);
    for (let r = 0; r <= most; r++) {
      if (r > 1 && ((r - 1) * INDEX_CELL) ** 2 > reach()) return;
      for (let j = cj - r; j <= cj + r; j++) {
        if (j < 0 || j >= rows) continue;
        const edge = j === cj - r || j === cj + r, inc = edge || r === 0 ? 1 : 2 * r;
        for (let i = ci - r; i <= ci + r; i += inc) {
          if (i < 0 || i >= cols) continue;
          const c = j * cols + i;
          for (let q = start[c]; q < start[c + 1]; q++) visit(ids[q]);
        }
      }
    }
  }
  return {
    // the nearest sample; with a hint, of the stretches about as near the one nearest along the road, which is the kart's own level at a crossing
    nearest(x, z, hint) {
      let best = -1, bd = Infinity;
      rings(x, z, () => bd, (k) => { const dx = x - S.x[k], dz = z - S.z[k], e = dx * dx + dz * dz; if (e < bd || (e === bd && k < best)) { bd = e; best = k; } });
      if (hint === undefined || hint === null || hint < 0) return best;
      const lim = (Math.sqrt(bd) + LEVEL_SLACK) ** 2, h = Math.round(hint);
      let pick = best, pickArc = Infinity;
      rings(x, z, () => lim, (k) => {
        const dx = x - S.x[k], dz = z - S.z[k];
        if (dx * dx + dz * dz > lim) return;
        const o = Math.abs(k - h) % count, arc = Math.min(o, count - o);
        if (arc < pickArc || (arc === pickArc && k < pick)) { pickArc = arc; pick = k; }
      });
      return pick;
    },
  };
}

// The methods a closed lap and an open shortcut share. index: a long track's sampleIndex.
function polylineApi(S, count, length, step, closed, index = null) {
  const wrap = closed ? (i) => ((i % count) + count) % count : (i) => clamp(i, 0, count - 1);
  const sample = (fi) => {
    const f0 = Math.floor(fi), a = wrap(f0), b = wrap(f0 + 1);
    return [a, b, fi - f0];
  };
  const api = {
    pointAt(u) {
      const span = closed ? count : count - 1;
      const fi = wrap(closed ? u * span : clamp(u, 0, 1) * span);
      const [a, b, f] = sample(fi);
      const mix = (arr) => arr[a] + (arr[b] - arr[a]) * f;
      const tx = mix(S.tx), tz = mix(S.tz), l = Math.hypot(tx, tz) || 1;
      return { x: mix(S.x), y: mix(S.y), z: mix(S.z), tx: tx / l, tz: tz / l, nx: tz / l, nz: -tx / l, w: mix(S.w), i: wrap(Math.round(fi)) };
    },
    // Takes a fractional i too (u * n), and a kart should pass one: integer samples step 0.2 m apiece on a 10% grade.
    heightAt(i, d = 0) {
      const [a, b, f] = sample(wrap(i));
      const y = S.y[a] + (S.y[b] - S.y[a]) * f, bank = S.bank[a] + (S.bank[b] - S.bank[a]) * f, hw = (S.w[a] + (S.w[b] - S.w[a]) * f) / 2;
      return y - clamp(d, -hw, hw) * Math.tan(bank * D2R);
    },
    surfaceAt(i) { return SURFACES[S.surface[wrap(Math.round(i))]]; },
    // { i nearest sample, f fractional sample (use it for heightAt), d lateral m + left, u fraction of the lap }
    nearest(x, z, hint) {
      let best = -1, bd = Infinity;
      if (hint !== undefined && hint !== null && hint >= 0) {
        const h = Math.round(hint);
        for (let o = -NEAR_WINDOW; o <= NEAR_WINDOW; o++) {
          const k = closed ? (h + o + count) % count : h + o;
          if (k < 0 || k >= count) continue;
          const dx = x - S.x[k], dz = z - S.z[k], e = dx * dx + dz * dz;
          if (e < bd) { bd = e; best = k; }
        }
      }
      if (best < 0 || bd > (S.w[best] / 2 + LOST_M) ** 2) {
        if (index) best = index.nearest(x, z, hint);
        else {
        best = 0; bd = Infinity;
        for (let k = 0; k < count; k++) {
          const dx = x - S.x[k], dz = z - S.z[k], e = dx * dx + dz * dz;
          if (e < bd) { bd = e; best = k; }
        }
        }
      }
      const dx = x - S.x[best], dz = z - S.z[best];
      const along = clamp((dx * S.tx[best] + dz * S.tz[best]) / step, -1, 1);
      const span = closed ? count : count - 1;
      const f = closed ? (best + along + count) % count : clamp(best + along, 0, span);
      return { i: best, f, d: dx * S.nx[best] + dz * S.nz[best], u: f / span };
    },
  };
  return api;
}

// A short kicker on the road surface at a jump's lip: rises over 14 m, drops back over 10 m. Karts get their launch
// from the sim; this is so the ribbon shows what is about to happen.
function applyKickers(def, S, n, step) {
  for (const j of def.jumps || []) {
    const c = Math.round(j.u * n), h = 0.8 * (j.strength ?? 1), up = Math.round(14 / step), down = Math.round(10 / step);
    for (let o = -up; o <= down; o++) {
      const t = o < 0 ? 1 + o / up : 1 - o / down;
      S.y[(c + o + n) % n] += h * smooth(t);
    }
  }
}

// Pull the line taut across the width: each point moves toward the middle of its neighbours and stops at the margin.
// What is left hugs the apexes and uses the whole road in between, cheaply and deterministically.
function computeRacingLine(S, n, step) {
  const stride = 4, m = Math.floor(n / stride), MARGIN = 2.2;
  const px = new Float64Array(m), pz = new Float64Array(m), nx = new Float64Array(m), nz = new Float64Array(m), lim = new Float64Array(m), d = new Float64Array(m);
  for (let j = 0; j < m; j++) {
    const i = j * stride;
    px[j] = S.x[i]; pz[j] = S.z[i]; nx[j] = S.nx[i]; nz[j] = S.nz[i]; lim[j] = Math.max(0, S.w[i] / 2 - MARGIN);
  }
  for (let it = 0; it < 900; it++) {
    for (let j = 0; j < m; j++) {
      const a = (j - 1 + m) % m, b = (j + 1) % m;
      const ax = px[a] + nx[a] * d[a], az = pz[a] + nz[a] * d[a], bx = px[b] + nx[b] * d[b], bz = pz[b] + nz[b] * d[b];
      const mx = (ax + bx) / 2 - px[j], mz = (az + bz) / 2 - pz[j];
      d[j] = clamp(d[j] + 0.7 * (mx * nx[j] + mz * nz[j] - d[j]), -lim[j], lim[j]);
    }
  }
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const f = i / stride, a = Math.floor(f) % m, b = (a + 1) % m, t = f - Math.floor(f);
    out[i] = d[a] + (d[b] - d[a]) * t;
  }
  const D = boxBlur(boxBlur(out, 3, true), 3, true);
  const x = new Float32Array(n), z = new Float32Array(n), k = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const lm = S.w[i] / 2 - MARGIN + 0.4;
    D[i] = clamp(D[i], -lm, lm);
    x[i] = S.x[i] + S.nx[i] * D[i]; z[i] = S.z[i] + S.nz[i] * D[i];
  }
  // curvature of the line itself, what a bot should read to choose its speed
  for (let i = 0; i < n; i++) {
    const a = (i - 3 + n) % n, b = (i + 3) % n;
    const ax = x[i] - x[a], az = z[i] - z[a], bx = x[b] - x[i], bz = z[b] - z[i];
    const la = Math.hypot(ax, az) || 1, lb = Math.hypot(bx, bz) || 1;
    // the cross product of (tx, tz) then its turn, signed so that + is left as everywhere else
    k[i] = (ax * bz - az * bx) / (la * lb) * -1 / ((la + lb) / 2);
  }
  return { d: D, x, z, k: boxBlur(k, 2, true) };
}

// def.long: a band about every bandEvery m, evenly from half a gap past the line, stepped off a jump's lip: a kart is in the air there.
function autoBands(def, length) {
  const every = (typeof def.long === 'object' ? def.long.bandEvery : null) ?? BAND_EVERY, count = Math.max(4, Math.round(length / every));
  const clear = 45 / length, lips = (def.jumps || []).map((j) => j.u);
  return Array.from({ length: count }, (_, b) => {
    let u = (b + 0.5) / count;
    for (const lip of lips) { const o = ((u - lip + 0.5) % 1 + 1) % 1 - 0.5; if (Math.abs(o) < clear) u = (lip + clear + 1) % 1; }
    return u;
  });
}

function buildShortcut(sc, index, main) {
  const a = main.pointAt(sc.from), b = main.pointAt(sc.to), w = sc.w ?? 7;
  const pts = (sc.points || []).map((q) => (Array.isArray(q) ? { p: q } : q));
  const ctrl = [{ p: [a.x, a.y, a.z], w: Math.max(w, a.w * 0.8) }, ...pts.map((q) => ({ p: q.p, w: q.w ?? w })), { p: [b.x, b.y, b.z], w: Math.max(w, b.w * 0.8) }];
  // ghosts along the main road's tangent, so the path leaves and joins it without a kink
  const gap = 12;
  const ghosts = [[a.x - a.tx * gap, a.y, a.z - a.tz * gap], [b.x + b.tx * gap, b.y, b.z + b.tz * gap]];
  const R = sampleSpline(ctrl, false, ghosts), count = R.count;
  const S = {
    x: Float32Array.from(R.X), y: Float32Array.from(R.Y), z: Float32Array.from(R.Z),
    tx: new Float32Array(count), tz: new Float32Array(count), nx: new Float32Array(count), nz: new Float32Array(count),
    w: new Float32Array(count), bank: new Float32Array(count), surface: new Uint8Array(count),
  };
  const si = surfaceIndex(sc.surface ?? 'dirt');
  for (let i = 0; i < count; i++) {
    const seg = Math.min(ctrl.length - 2, Math.floor(R.P[i])), f = smooth(R.P[i] - seg);
    S.w[i] = ctrl[seg].w + (ctrl[seg + 1].w - ctrl[seg].w) * f;
    S.surface[i] = si;
  }
  const curvature = fillDerived(S, count, R.step, false);
  return {
    index, from: sc.from, to: sc.to, surface: sc.surface ?? 'dirt', w, n: count, length: R.length, step: R.step,
    samples: S, curvature, ...polylineApi(S, count, R.length, R.step, false),
  };
}

export function buildTrack(def) {
  const ctrl = def.points;
  if (!ctrl || ctrl.length < 4) throw new Error(`track ${def.id}: needs at least 4 points`);
  const R = sampleSpline(ctrl, true), n = R.count, step = R.step, length = R.length, m = ctrl.length;
  const S = {
    x: Float32Array.from(R.X), y: Float32Array.from(R.Y), z: Float32Array.from(R.Z),
    tx: new Float32Array(n), tz: new Float32Array(n), nx: new Float32Array(n), nz: new Float32Array(n),
    w: new Float32Array(n), bank: new Float32Array(n), surface: new Uint8Array(n), struct: new Uint8Array(n),
  };
  const defBank = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const seg = Math.floor(R.P[i]) % m, nxt = (seg + 1) % m, f = smooth(R.P[i] - Math.floor(R.P[i]));
    const A = ctrl[seg], B = ctrl[nxt];
    S.w[i] = (A.w ?? 14) + ((B.w ?? 14) - (A.w ?? 14)) * f;
    defBank[i] = (A.bank ?? 0) + ((B.bank ?? 0) - (A.bank ?? 0)) * f;
    S.surface[i] = surfaceIndex(A.surface);
  }
  for (const zone of def.zones || []) {
    const si = surfaceIndex(zone.surface), a = Math.round(zone.from * n), b = Math.round(zone.to * n);
    const len = ((b - a) % n + n) % n;
    for (let o = 0; o <= len; o++) S.surface[(a + o) % n] = si;
  }

  applyKickers(def, S, n, step);
  const curvature = fillDerived(S, n, step, true);
  const soft = boxBlur(curvature, 6, true);
  for (let i = 0; i < n; i++) S.bank[i] = defBank[i] * clamp(soft[i] * BANK_FULL_RADIUS, -1, 1);

  const pointU = R.pointS.map((s) => s / length);
  const iAtPoint = (j) => Math.round(pointU[j] * n) % n;

  // Structures come from runs of consecutive tagged points; every other tag is a marker
  const structures = [], markers = [];
  for (let j = 0; j < m; j++) {
    const tag = ctrl[j].tag;
    if (!tag) continue;
    if (!STRUCT_TAGS.has(tag)) { markers.push({ tag, u: pointU[j], i: iAtPoint(j), point: j }); continue; }
    if (ctrl[(j - 1 + m) % m].tag === tag) continue;
    let e = j;
    while (ctrl[(e + 1) % m].tag === tag && (e + 1) % m !== j) e = (e + 1) % m;
    const i0 = iAtPoint(j), i1 = iAtPoint(e), kind = STRUCTS.indexOf(tag);
    const len = ((i1 - i0) % n + n) % n;
    for (let o = 0; o <= len; o++) S.struct[(i0 + o) % n] = kind;
    structures.push({ kind: tag, i0, i1, from: i0 / n, to: i1 / n, length: len * step });
    j = e < j ? m : e;
  }

  const api = polylineApi(S, n, length, step, true, def.long ? sampleIndex(S, n) : null);
  const yawAt = (tx, tz) => Math.atan2(tx, tz);
  const placeAt = (u) => {
    const P = api.pointAt(u);
    return { u: ((u % 1) + 1) % 1, i: P.i, x: P.x, y: P.y, z: P.z, tx: P.tx, tz: P.tz, nx: P.nx, nz: P.nz, w: P.w, yaw: yawAt(P.tx, P.tz) };
  };

  const bands = (def.itemBands || (def.long ? autoBands(def, length) : [])).map((u, band) => {
    const P = placeAt(u), fi = P.u * n, boxes = [];
    // 5 crates across the road (def.boxesAcross, for a narrow road), a kart's width of margin at the edges
    const across = def.boxesAcross ?? 5;
    for (let b = 0; b < across; b++) {
      const d = (b - (across - 1) / 2) * (P.w - 3) / (across - 1);
      boxes.push({ x: P.x + P.nx * d, y: api.heightAt(fi, d) + BOX_LIFT, z: P.z + P.nz * d });
    }
    return { u: P.u, i: P.i, band, boxes };
  });
  const pads = (def.boostPads || []).map((p) => {
    const P = placeAt(p.u), offset = p.offset ?? 0, d = offset * P.w / 2;
    return { ...P, offset, d, x: P.x + P.nx * d, z: P.z + P.nz * d, y: api.heightAt(P.u * n, d) };
  });
  const jumps = (def.jumps || []).map((j) => ({ ...placeAt(j.u), strength: j.strength ?? 1 }));

  const track = {
    def, n, length, step, samples: S, SURFACES, curvature, pointU, structures, markers, ...api, bands, pads, jumps, long: !!def.long,
  };
  track.shortcuts = (def.shortcuts || []).map((sc, k) => buildShortcut(sc, k, track));
  track.racingLine = computeRacingLine(S, n, step);
  track.structureAt = (i) => {
    const k = S.struct[((Math.round(i) % n) + n) % n];
    return k ? STRUCTS[k] : null;
  };
  // Two staggered columns behind the line, pole first, so array order is grid order.
  track.startGrid = (count = 8) => {
    const out = [];
    for (let k = 0; k < count; k++) {
      const P = api.pointAt(1 - (6 + k * 3.6) / length), side = k % 2 ? -1 : 1, d = side * P.w * 0.22;
      out.push({
        x: P.x + P.nx * d, y: api.heightAt(((1 - (6 + k * 3.6) / length) % 1) * n, d), z: P.z + P.nz * d,
        yaw: yawAt(P.tx, P.tz), d, i: P.i,
      });
    }
    return out;
  };
  return track;
}
