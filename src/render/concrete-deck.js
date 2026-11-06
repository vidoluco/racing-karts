// A modern elevated road: a concrete box girder on hammerhead piers, jersey barriers, a dark underside. The stone arches of the Alps on
// a Jakarta toll road read as Europe at once, so look.deck.style: 'concrete' asks for this instead (default: the arches).
import * as THREE from 'three';
import { linear, hash3 } from './math.js';

function builder() {
  const P = [], N = [], C = [], I = [];
  let v = 0;
  const quad = (a, b, c, d, col, colD = col) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], wx = d[0] - a[0], wy = d[1] - a[1], wz = d[2] - a[2];
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    P.push(...a, ...b, ...c, ...d);
    for (let i = 0; i < 4; i++) N.push(nx, ny, nz);
    C.push(...col, ...col, ...colD, ...colD);
    I.push(v, v + 1, v + 2, v, v + 2, v + 3); v += 4;
  };
  const geometry = () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    g.setAttribute('aPaint', new THREE.Float32BufferAttribute(new Float32Array(v), 1));
    g.setIndex(v > 65535 ? new THREE.BufferAttribute(new Uint32Array(I), 1) : new THREE.BufferAttribute(new Uint16Array(I), 1));
    return g;
  };
  return { quad, geometry, count: () => v };
}

export function concreteDeck(track, st, world, batch, look, onLowerRoad) {
  const S = track.samples, n = track.n, tall = st.kind === 'viaduct', D = look.deck || {};
  const base = linear(D.color ?? '#b9b5ab'), dark = base.map((q) => q * 0.42), mid = base.map((q) => q * 0.78), barrier = linear(D.barrier ?? '#d8d4c8'), stain = base.map((q) => q * 0.66);
  const count = ((st.i1 - st.i0 + n) % n) + 1, at = (q) => (st.i0 + q + n) % n, groundAt = world.ground?.groundAt ?? world.terrain.heightAt;
  const every = 4;   // samples per piece of deck, 8 m: a curve stays a curve
  const pieces = [builder()];
  const R = () => pieces[pieces.length - 1];
  const H = tall ? 1.3 : 0.7, inset = tall ? 1.7 : 0.8, bh = tall ? 0.95 : 0.55;
  const prof = (q) => {
    const i = at(q), hw = S.w[i] / 2 + 0.5, x = S.x[i], z = S.z[i], nx = S.nx[i], nz = S.nz[i], y = S.y[i];
    return { i, x, z, y, nx, nz, hw, L: (d) => [x + nx * d, y, z + nz * d], A: (d, dy) => [x + nx * d, y + dy, z + nz * d] };
  };
  for (let q = 0; q < count - 1; q += every) {
    // a merged piece stays small enough to be dropped with its cell
    if (R().count() > 4000) pieces.push(builder());
    const a = prof(q), b = prof(Math.min(count - 1, q + every)), r = R(), t = 0.97 + 0.06 * hash3(q, 3, st.i0);
    const c1 = base.map((v) => v * t), c2 = mid.map((v) => v * t);
    for (const s of [-1, 1]) {
      const qd = (p0, p1, p2, p3, col, colD) => (s > 0 ? r.quad(p1, p0, p3, p2, col, colD) : r.quad(p0, p1, p2, p3, col, colD));
      // fascia: a pale band at the deck edge, a stained face under it going in to the soffit
      qd(a.A(s * a.hw, -0.5), b.A(s * b.hw, -0.5), b.A(s * b.hw, 0.04), a.A(s * a.hw, 0.04), c2, c1);
      qd(a.A(s * (a.hw - inset), -H), b.A(s * (b.hw - inset), -H), b.A(s * b.hw, -0.5), a.A(s * a.hw, -0.5), stain, c2);
      // the jersey barrier: a sloped inner foot, a straight top, the outer face flush with the fascia
      const out = (p) => s * (p.hw + 0.02), in0 = (p) => s * (p.hw - 0.62), in1 = (p) => s * (p.hw - 0.26);
      qd(b.A(in0(b), 0.02), a.A(in0(a), 0.02), a.A(in1(a), 0.36), b.A(in1(b), 0.36), c2, barrier);
      qd(b.A(in1(b), 0.36), a.A(in1(a), 0.36), a.A(in1(a) + s * 0.08, bh), b.A(in1(b) + s * 0.08, bh), barrier, barrier);
      qd(b.A(in1(b) + s * 0.08, bh), a.A(in1(a) + s * 0.08, bh), a.A(out(a), bh), b.A(out(b), bh), barrier.map((v) => v * 1.05), barrier.map((v) => v * 1.05));
      qd(a.A(out(a), 0), b.A(out(b), 0), b.A(out(b), bh), a.A(out(a), bh), c1, barrier);
    }
    // the soffit, dark: seen from the road below, it is the shape of the bridge
    r.quad(b.A(-(b.hw - inset), -H), a.A(-(a.hw - inset), -H), a.A(a.hw - inset, -H), b.A(b.hw - inset, -H), dark);
  }
  // piers: hammerheads on tall decks, one round leg each. They keep off any road below.
  const span = tall ? (D.span ?? 30) : 18, len = (count - 1) * track.step, spans = Math.max(1, Math.round(len / span));
  const pier = builder(), SEG = 10;
  for (let k = tall ? 0 : 1; k <= spans - (tall ? 0 : 1); k++) {
    let q = Math.round((k / spans) * (count - 1));
    for (const o of [0, 2, -2, 4, -4, 6, -6, 8, -8]) { const j = at(Math.max(0, Math.min(count - 1, q + o))); if (!onLowerRoad(track, S.x[j], S.z[j], S.y[j])) { q = Math.max(0, Math.min(count - 1, q + o)); break; } }
    const i = at(q), x = S.x[i], z = S.z[i], y = S.y[i], hw = S.w[i] / 2, nx = S.nx[i], nz = S.nz[i], tx = S.tx[i], tz = S.tz[i], top = y - H, g = groundAt(x, z) - 0.4;
    if (top - g < 1.2) continue;
    const r0 = tall ? 1.15 : 0.5;
    for (let a = 0; a < SEG; a++) {
      const a0 = a / SEG * Math.PI * 2, a1 = (a + 1) / SEG * Math.PI * 2, c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1), lit = 0.82 + 0.18 * Math.max(0, c0 * 0.4 + s0 * 0.6);
      const col = mid.map((v) => v * lit * 1.12), colT = base.map((v) => v * lit);
      pier.quad([x + c1 * r0, g, z + s1 * r0], [x + c0 * r0, g, z + s0 * r0], [x + c0 * r0, top - 0.8, z + s0 * r0], [x + c1 * r0, top - 0.8, z + s1 * r0], col, colT);
    }
    if (tall) {
      // the head: flares up from the leg to carry the width of the girder
      const hx = hw - 1.5, d = 1.6, hh = 1.5;
      const c = (u, v, h) => [x + nx * u + tx * v, h, z + nz * u + tz * v];
      const hd = (a, b, cc, dd, col, colD) => pier.quad(a, b, cc, dd, col, colD);
      for (const s of [-1, 1]) {
        hd(c(s * 1.2, -s * d * 0.6, top - hh - 0.6), c(s * 1.2, s * d * 0.6, top - hh - 0.6), c(s * hx, s * d, top - 0.05), c(s * hx, -s * d, top - 0.05), stain, mid);
        hd(c(-s * hx, s * d, top - 0.05), c(s * hx, s * d, top - 0.05), c(s * 1.2, s * d * 0.6, top - hh - 0.6), c(-s * 1.2, s * d * 0.6, top - hh - 0.6), mid, mid);
      }
    }
    batch.blob(x, z, tall ? 3.4 : 1.6, 0.4);
  }
  for (const b of pieces) if (b.count()) batch.add(b.geometry(), true);
  if (pier.count()) batch.add(pier.geometry(), true);
  // the deck's shade on the ground, along its whole length: under a flyover it is always evening
  for (let q = 0; q < count; q += 6) { const i = at(q); batch.blob(S.x[i], S.z[i], S.w[i] * 0.62, 0.32); }
}
