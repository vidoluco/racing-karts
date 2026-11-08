// Rounded geometry helpers for karts, items, props and landmarks. Everything gives an indexed BufferGeometry with
// position and normal; paint() adds colour and a painted kind, merge() joins any mix of them into one mesh.
import * as THREE from 'three';
import { linear } from './math.js';

const V = new THREE.Vector3(), I = new THREE.Vector3();

// A box with soft edges: w, h, d full sizes, r edge radius, k bands per corner. Faces stay flat, edges round.
// A plain box, 12 triangles: what buildings are made of in quantity. A rounded box at its cheapest is 108.
export function box(w = 1, h = 1, d = 1) { return new THREE.BoxGeometry(w, h, d); }

export function roundedBox(w = 1, h = 1, d = 1, r = 0.1, k = 2) {
  r = Math.min(r, w / 2, h / 2, d / 2);
  const seg = 2 * k + 1, g = new THREE.BoxGeometry(w, h, d, seg, seg, seg), P = g.attributes.position, N = g.attributes.normal;
  // the uniform grid becomes k narrow bands at each end for the curve and one wide cell for the flat face
  const remap = (c, half) => {
    const t = Math.round(((c + half) / (2 * half)) * seg);
    if (t <= k) return -half + r * (t / k);
    if (t >= seg - k) return half - r * ((seg - t) / k);
    return c;
  };
  const hx = w / 2, hy = h / 2, hz = d / 2;
  for (let i = 0; i < P.count; i++) {
    V.set(remap(P.getX(i), hx), remap(P.getY(i), hy), remap(P.getZ(i), hz));
    I.set(Math.max(-(hx - r), Math.min(hx - r, V.x)), Math.max(-(hy - r), Math.min(hy - r, V.y)), Math.max(-(hz - r), Math.min(hz - r, V.z)));
    V.sub(I);
    const l = V.length();
    if (l > 1e-6) {
      V.multiplyScalar(1 / l);
      N.setXYZ(i, V.x, V.y, V.z);
      P.setXYZ(i, I.x + V.x * r, I.y + V.y * r, I.z + V.z * r);
    } else P.setXYZ(i, I.x, I.y, I.z);
  }
  return clean(g);
}

// Along y, centred, total length len + 2r.
export const capsule = (r = 0.5, len = 1, cap = 4, seg = 10) => clean(new THREE.CapsuleGeometry(r, len, cap, seg));
export const sphere = (r = 0.5, ws = 12, hs = 8) => clean(new THREE.SphereGeometry(r, ws, hs));
export const cylinder = (rTop = 0.5, rBottom = 0.5, h = 1, seg = 12, open = false) => clean(new THREE.CylinderGeometry(rTop, rBottom, h, seg, 1, open));
export const cone = (r = 0.5, h = 1, seg = 12) => clean(new THREE.ConeGeometry(r, h, seg));
export const torus = (r = 0.5, t = 0.15, rs = 6, ts = 14) => clean(new THREE.TorusGeometry(r, t, rs, ts));

// Revolved profile [[r, y], ...] bottom to top, about y. Smooth normals across the seam.
export function lathe(profile, seg = 14) {
  const m = profile.length, pos = [], idx = [];
  for (let s = 0; s <= seg; s++) {
    const a = (s / seg) * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
    for (const [r, y] of profile) pos.push(c * r, y, sn * r);
  }
  for (let s = 0; s < seg; s++) for (let q = 0; q < m - 1; q++) {
    const a = s * m + q, b = a + 1, d = a + m, e = d + 1;
    idx.push(a, b, d, b, e, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // the seam column appears twice: both copies take the same normal
  const N = g.attributes.normal;
  for (let q = 0; q < m; q++) {
    const a = q, b = seg * m + q, x = N.getX(a) + N.getX(b), y = N.getY(a) + N.getY(b), z = N.getZ(a) + N.getZ(b), l = Math.hypot(x, y, z) || 1;
    N.setXYZ(a, x / l, y / l, z / l); N.setXYZ(b, x / l, y / l, z / l);
  }
  return g;
}

// A round tube along pts [[x, y, z], ...]; r a number or one per point; capped with soft ends. Parallel transport frames.
export function tube(pts, r = 0.1, seg = 8, closed = false) {
  const n = pts.length, pos = [], nor = [], idx = [], P = pts.map((p) => new THREE.Vector3(...p));
  const radius = (i) => (Array.isArray(r) ? r[i] : r);
  const T = [], up = new THREE.Vector3(0, 1, 0), N0 = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const a = closed ? P[(i - 1 + n) % n] : P[Math.max(0, i - 1)], b = closed ? P[(i + 1) % n] : P[Math.min(n - 1, i + 1)];
    T.push(new THREE.Vector3().subVectors(b, a).normalize());
  }
  N0.crossVectors(T[0], Math.abs(T[0].y) > 0.9 ? new THREE.Vector3(1, 0, 0) : up).normalize();
  const B = new THREE.Vector3(), q = new THREE.Quaternion();
  const ring = (c, nn, t, rr) => {
    B.crossVectors(t, nn).normalize();
    for (let s = 0; s < seg; s++) {
      const a = (s / seg) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const x = nn.x * ca + B.x * sa, y = nn.y * ca + B.y * sa, z = nn.z * ca + B.z * sa;
      pos.push(c.x + x * rr, c.y + y * rr, c.z + z * rr); nor.push(x, y, z);
    }
  };
  const frames = [N0.clone()];
  for (let i = 1; i < n; i++) { q.setFromUnitVectors(T[i - 1], T[i]); frames.push(frames[i - 1].clone().applyQuaternion(q).normalize()); }
  for (let i = 0; i < n; i++) ring(P[i], frames[i], T[i], radius(i));
  const rows = closed ? n : n - 1;
  for (let i = 0; i < rows; i++) for (let s = 0; s < seg; s++) {
    const a = i * seg + s, b = i * seg + (s + 1) % seg, c = ((i + 1) % n) * seg + s, d = ((i + 1) % n) * seg + (s + 1) % seg;
    idx.push(a, c, b, b, c, d);
  }
  if (!closed) {
    const cap = (i, t, flip) => {
      const c = pos.length / 3;
      pos.push(P[i].x + t.x * radius(i) * 0.6 * flip, P[i].y + t.y * radius(i) * 0.6 * flip, P[i].z + t.z * radius(i) * 0.6 * flip);
      nor.push(t.x * flip, t.y * flip, t.z * flip);
      for (let s = 0; s < seg; s++) {
        const a = i * seg + s, b = i * seg + (s + 1) % seg;
        if (flip > 0) idx.push(a, c, b); else idx.push(a, b, c);
      }
    };
    cap(0, T[0], -1); cap(n - 1, T[n - 1], 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

// Keeps position, normal and any colour or painted kind; drops the rest; always indexed.
function clean(g) {
  const out = g.index ? g : mergeVerts(g);
  for (const k of Object.keys(out.attributes)) if (!['position', 'normal', 'color', 'aPaint'].includes(k)) out.deleteAttribute(k);
  return out;
}
function mergeVerts(g) {
  const n = g.attributes.position.count, idx = new Uint32Array(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

// Moves a geometry in place: { p: [x, y, z], r: [rx, ry, rz], s: number or [sx, sy, sz] }. Returns it.
const M = new THREE.Matrix4(), E = new THREE.Euler(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), T = new THREE.Vector3();
export function place(g, { p = [0, 0, 0], r = [0, 0, 0], s = 1 } = {}) {
  E.set(r[0], r[1], r[2]); Q.setFromEuler(E);
  if (Array.isArray(s)) S.set(s[0], s[1], s[2]); else S.set(s, s, s);
  g.applyMatrix4(M.compose(T.set(p[0], p[1], p[2]), Q, S));
  return g;
}

// Colours a geometry with a flat vertex colour and a painted kind: 0 plain, 1 stone, 2 boards, 3 shingles, 4 logs, 5 plaster.
// Colour is '#rrggbb'; an optional shade(x, y, z) -> multiplier darkens toward the foot, AO in the vertex.
export function paint(g, color, kind = 0, shade = null) {
  const c = Array.isArray(color) ? color : linear(color), n = g.attributes.position.count, C = new Float32Array(n * 3), K = new Float32Array(n);
  const P = g.attributes.position;
  for (let i = 0; i < n; i++) {
    const k = shade ? shade(P.getX(i), P.getY(i), P.getZ(i)) : 1;
    C[i * 3] = c[0] * k; C[i * 3 + 1] = c[1] * k; C[i * 3 + 2] = c[2] * k; K[i] = kind;
  }
  g.setAttribute('color', new THREE.BufferAttribute(C, 3));
  g.setAttribute('aPaint', new THREE.BufferAttribute(K, 1));
  return g;
}

// Joins geometries into one. Missing colours become white, missing painted kinds plain; the sources stay untouched.
export function merge(list) {
  let nv = 0, ni = 0;
  for (const g of list) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), C = new Float32Array(nv * 3).fill(1), K = new Float32Array(nv);
  const X = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  let v = 0, x = 0;
  for (const g of list) {
    const c = g.attributes.position.count, pa = g.attributes.position, na = g.attributes.normal, ca = g.attributes.color, ka = g.attributes.aPaint;
    for (let i = 0; i < c; i++) {
      P[(v + i) * 3] = pa.getX(i); P[(v + i) * 3 + 1] = pa.getY(i); P[(v + i) * 3 + 2] = pa.getZ(i);
      if (na) { N[(v + i) * 3] = na.getX(i); N[(v + i) * 3 + 1] = na.getY(i); N[(v + i) * 3 + 2] = na.getZ(i); }
      if (ca) { C[(v + i) * 3] = ca.getX(i); C[(v + i) * 3 + 1] = ca.getY(i); C[(v + i) * 3 + 2] = ca.getZ(i); }
      if (ka) K[v + i] = ka.getX(i);
    }
    if (g.index) { const q = g.index; for (let i = 0; i < q.count; i++) X[x + i] = q.getX(i) + v; x += q.count; }
    else { for (let i = 0; i < c; i++) X[x + i] = v + i; x += c; }
    v += c;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(P, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  out.setAttribute('color', new THREE.BufferAttribute(C, 3));
  out.setAttribute('aPaint', new THREE.BufferAttribute(K, 1));
  out.setIndex(new THREE.BufferAttribute(X, 1));
  return out;
}

// A quad patch from four corners (flat normal), for walls and roofs that are not boxes.
export function quad(a, b, c, d) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...d], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  return g;
}

// A simple closed polyhedron from a footprint prism with a ridge: walls under a gabled roof, the house of every landmark.
// w across the ridge, l along it (z), h walls, rh roof rise, over: eaves overhang. Returns { walls, roof }, each a geometry.
export function gable(w, l, h, rh, over = 0.4) {
  const hw = w / 2, hl = l / 2;
  const tri = (a, b, c) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c], 3)); g.setIndex([0, 1, 2]); g.computeVertexNormals(); return g; };
  const walls = merge([
    quad([-hw, 0, hl], [hw, 0, hl], [hw, h, hl], [-hw, h, hl]), quad([hw, 0, -hl], [-hw, 0, -hl], [-hw, h, -hl], [hw, h, -hl]),
    quad([hw, 0, hl], [hw, 0, -hl], [hw, h, -hl], [hw, h, hl]), quad([-hw, 0, -hl], [-hw, 0, hl], [-hw, h, hl], [-hw, h, -hl]),
    tri([-hw, h, hl], [hw, h, hl], [0, h + rh, hl]), tri([hw, h, -hl], [-hw, h, -hl], [0, h + rh, -hl]),
  ]);
  const ex = hw + over, sl = rh / hw, e = h - over * sl, L = hl + over, t = 0.14;
  const plate = (s) => [ // thick enough for the outline to read it as a roof with an edge
    quad([s * ex, e, L], [s * ex, e, -L], [0, h + rh, -L], [0, h + rh, L]),
    quad([s * ex, e - t, L], [s * ex, e, L], [0, h + rh, L], [0, h + rh - t, L]),
    quad([s * ex, e, -L], [s * ex, e - t, -L], [0, h + rh - t, -L], [0, h + rh, -L]),
    quad([s * ex, e - t, -L], [s * ex, e - t, L], [0, h + rh - t, L], [0, h + rh - t, -L]),
  ];
  // the second slope winds the other way
  const fix = (arr) => arr.map((g) => { const X = g.index; for (let i = 0; i < X.count; i += 3) { const a = X.getX(i + 1), b = X.getX(i + 2); X.setX(i + 1, b); X.setX(i + 2, a); } g.computeVertexNormals(); return g; });
  const roof = merge([...fix(plate(1)), ...plate(-1)]);
  return { walls, roof };
}

export const shapes = { box, roundedBox, capsule, sphere, cylinder, cone, torus, lathe, tube, place, paint, merge, quad, gable };

// The arch of a tunnel's gallery (road.js): half the road and this much more each side, this high over the road, its side a sine to the power 0.8.
export const VAULT = { side: 1.1, h: 8.2 };

// The bore stays open: a vertex of rock inside the arch of a tunnel's gallery, or inside the same arch past a mouth, goes out to the arch. The
// rock meets the vault, and no kart drives through stone that stood in the road. hint: a sample near the mouth, so the road found is this one.
// The arch is the gallery's own, 8.2 m high and not a circle as wide as the road: a crag kept only out of the circle still stood inside the vault.
export function keepBore(g, track, hint) {
  const P = g.attributes.position, S = track.samples, GROW = 0.5; // GROW: past the arch, also where the vault's flat panels cut inside its curve
  // how high the arch at sample i stands d m off the road's axis, grown by m all round; below 0 past its side
  const arch = (i, d, m) => { const hw = S.w[i] / 2 + VAULT.side + m, f = 1 - (d / hw) ** 2; return f > 0 ? (VAULT.h + m) * f ** 0.4 : -1; };
  for (let k = 0; k < P.count; k++) {
    const x = P.getX(k), y = P.getY(k), z = P.getZ(k), L = track.nearest(x, z, hint), i = L.i, hw = S.w[i] / 2 + VAULT.side + GROW, cy = S.y[i] - 0.2, dy = y - cy;
    if (dy < -16) continue;
    let d2 = L.d, y2 = y;
    if (dy < 0) {
      // below the road too: an edge from under it to over it would cross the bore. Out to the side
      if (Math.abs(L.d) >= hw) continue;
      d2 = L.d < 0 ? -hw : hw;
    } else {
      if (dy >= arch(i, L.d, GROW)) continue;
      // out along the line from the foot of the axis, to where it meets the arch
      const d0 = L.d, h0 = Math.max(dy, 0.05);
      let lo = 1, hi = 2;
      while (h0 * hi < arch(i, d0 * hi, GROW)) hi *= 2;
      for (let n = 0; n < 24; n++) { const mid = (lo + hi) / 2; if (h0 * mid < arch(i, d0 * mid, GROW)) lo = mid; else hi = mid; }
      d2 = d0 * hi; y2 = cy + h0 * hi;
    }
    P.setXYZ(k, x + S.nx[i] * (d2 - L.d), y2, z + S.nz[i] * (d2 - L.d));
  }
  // a face that still spans the bore, from a vertex under the road to one past the far wall, goes: the vault hides where it was
  const I = g.index, inBore = (x, y, z) => { const L = track.nearest(x, z, hint), dy = y - S.y[L.i] + 0.2; return dy > 0.05 && dy < arch(L.i, L.d, -0.05); };
  // points across each face, not only its middle: a thin sliver from one wall to the other has none of its few points in the bore
  const AT = [];
  for (let p = 0; p <= 5; p++) for (let q = 0; p + q <= 5; q++) if (p + q > 0 && p < 5 && q < 5) AT.push([p / 5, q / 5]);
  if (I) for (let t = 0; t + 2 < I.count; t += 3) {
    const a = I.getX(t), b = I.getX(t + 1), c = I.getX(t + 2);
    for (const [u, v] of AT) {
      const w = 1 - u - v, x = P.getX(a) * w + P.getX(b) * u + P.getX(c) * v, y = P.getY(a) * w + P.getY(b) * u + P.getY(c) * v, z = P.getZ(a) * w + P.getZ(b) * u + P.getZ(c) * v;
      if (inBore(x, y, z)) { I.setX(t + 1, a); I.setX(t + 2, a); break; }
    }
  }
  P.needsUpdate = true;
  if (I) I.needsUpdate = true;
  return g;
}
