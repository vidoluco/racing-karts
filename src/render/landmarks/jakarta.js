// Jakarta: a whole city along one road. What can be counted in hundreds (towers, shophouses, kampung houses, a roofscape in the
// thousands) goes into plain arrays per block with no BufferGeometry per building, so that a district loads in milliseconds.
// What is unique (the Monas, Selamat Datang, Arjuna Wijaya, the mosque and the cathedral, the stadium) is modelled by hand.
// Scenery only: the mosque and the cathedral stand clear of the road and nothing ever touches them. Facts: docs/references/jakarta.md.
import * as THREE from 'three';
import { hash3, lerp, linear, smooth } from '../math.js';
import { merge, paint, place, box, sphere, capsule, cylinder, cone, lathe, torus, roundedBox } from '../shapes.js';
import { blobAnimal } from '../props.js';
import { crossingGates } from '../vehicles.js';
import { writeText } from '../signwriter.js';

const c = (hex) => linear(hex);
const mul = (col, k) => [col[0] * k, col[1] * k, col[2] * k];
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

// ---------- plain arrays: many boxes, one geometry ----------
export class Raw {
  constructor() { this.P = []; this.N = []; this.C = []; this.I = []; this.K = []; this.v = 0; this.kind = 0; }
  // a, b, c, d in order round the face, colours per bottom and top pair
  quad(a, b, d, e, col, colTop = col) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    this.P.push(...a, ...b, ...d, ...e);
    this.N.push(nx, ny, nz, nx, ny, nz, nx, ny, nz, nx, ny, nz);
    this.C.push(...col, ...col, ...colTop, ...colTop);
    this.K.push(this.kind, this.kind, this.kind, this.kind);
    const v = this.v;
    this.I.push(v, v + 1, v + 2, v, v + 2, v + 3);
    this.v += 4;
  }
  // A box on the ground plane at x, z, turned by yaw. Walls are always shaded darker at the foot; no underside.
  box(x, y0, z, w, h, d, yaw, side, top = null, foot = 0.82) {
    const cs = Math.cos(yaw), sn = Math.sin(yaw), hw = w / 2, hd = d / 2;
    const px = (a, b) => x + a * cs + b * sn, pz = (a, b) => z - a * sn + b * cs, y1 = y0 + h;
    const cor = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([a, b]) => [px(a, b), pz(a, b)]);
    const bot = mul(side, foot);
    for (let i = 0; i < 4; i++) {
      const A = cor[i], B = cor[(i + 1) % 4];
      this.quad([B[0], y0, B[1]], [A[0], y0, A[1]], [A[0], y1, A[1]], [B[0], y1, B[1]], bot, side);
    }
    const t = top || mul(side, 1.06);
    this.quad([cor[3][0], y1, cor[3][1]], [cor[2][0], y1, cor[2][1]], [cor[1][0], y1, cor[1][1]], [cor[0][0], y1, cor[0][1]], t);
  }
  // A hipped roof of four faces over a footprint.
  roof(x, y0, z, w, d, rise, yaw, col) {
    const cs = Math.cos(yaw), sn = Math.sin(yaw), hw = w / 2, hd = d / 2;
    const px = (a, b) => x + a * cs + b * sn, pz = (a, b) => z - a * sn + b * cs;
    const cor = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([a, b]) => [px(a, b), y0, pz(a, b)]);
    const r = Math.max(0, d - w) / 2, R0 = [px(0, -r), y0 + rise, pz(0, -r)], R1 = [px(0, r), y0 + rise, pz(0, r)];
    const dark = mul(col, 0.86);
    this.quad(cor[1], cor[0], R0, R0, dark);
    this.quad(cor[0], cor[3], R1, R0, col);
    this.quad(cor[3], cor[2], R1, R1, mul(col, 1.08));
    this.quad(cor[2], cor[1], R0, R1, dark);
  }
  // A flat panel facing outward at distance along the normal of yaw: for windows, signs, doors.
  panel(x, y0, z, w, h, yaw, col, out = 0) {
    const cs = Math.cos(yaw), sn = Math.sin(yaw), ax = x + sn * out, az = z + cs * out;
    this.quad([ax - cs * w / 2, y0, az + sn * w / 2], [ax + cs * w / 2, y0, az - sn * w / 2], [ax + cs * w / 2, y0 + h, az - sn * w / 2], [ax - cs * w / 2, y0 + h, az + sn * w / 2], col);
  }
  // A box with a dark underside: anything a kart drives under.
  boxU(x, y0, z, w, h, d, yaw, side, top = null, foot = 0.82, under = null) {
    this.box(x, y0, z, w, h, d, yaw, side, top, foot);
    const cs = Math.cos(yaw), sn = Math.sin(yaw), hw = w / 2, hd = d / 2, u = under || mul(side, 0.42);
    const p = (a, b) => [x + a * cs + b * sn, y0, z - a * sn + b * cs];
    this.quad(p(-hw, -hd), p(hw, -hd), p(hw, hd), p(-hw, hd), u);
  }
  // A round thing with soft shading: a bush, a tank, a dome. Few triangles and smooth normals, so the toon ramp does the rest.
  blob(x, y, z, rx, ry, rz, col, colTop = col, seg = 6, rings = 3) {
    const v0 = this.v;
    for (let j = 0; j <= rings; j++) {
      const t = j / rings, el = -Math.PI / 2 + t * Math.PI, ce = Math.cos(el), se = Math.sin(el);
      for (let i = 0; i < seg; i++) {
        const a = (i / seg) * Math.PI * 2, nx = ce * Math.cos(a), nz = ce * Math.sin(a);
        this.P.push(x + rx * nx, y + ry * se, z + rz * nz);
        const l = Math.hypot(nx / rx, se / ry, nz / rz) || 1;
        this.N.push(nx / rx / l, se / ry / l, nz / rz / l);
        const q = lerp(col[0], colTop[0], t), q1 = lerp(col[1], colTop[1], t), q2 = lerp(col[2], colTop[2], t);
        this.C.push(q, q1, q2); this.K.push(this.kind);
      }
    }
    for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) {
      const a = v0 + j * seg + i, b = v0 + j * seg + (i + 1) % seg, c2 = a + seg, d = b + seg;
      this.I.push(a, c2, b, b, c2, d);
    }
    this.v += (rings + 1) * seg;
  }
  // A clipped hedge between two points: one lofted body with a wandering top and foot, its front and top toward (side) of the line, smooth normals. A row of separate blobs at this size is a row of wedges.
  hedge(x0, z0, x1, z1, side, seed) {
    const L = Math.hypot(x1 - x0, z1 - z0) || 1, tx = (x1 - x0) / L, tz = (z1 - z0) / L, nx = -tz * side, nz = tx * side, steps = Math.max(2, Math.round(L / 1.1)), v0 = this.v;
    const PR = [[0.92, 0, -0.1, 1], [1, 0.72, 0.28, 0.96], [0.72, 1.32, 0.72, 0.68], [0, 1.56, 1, 0], [-0.72, 1.32, 0.72, -0.68]];
    for (let i = 0; i <= steps; i++) {
      const u = i / steps, h = 0.94 + 0.05 * hash3(seed, i, 5) + 0.07 * Math.sin(i * 0.7 + seed), wd = 0.94 + 0.1 * hash3(seed, i, 6), tone = hash3(seed, i, 7);
      const a = [lerp(x0, x1, u), lerp(z0, z1, u)], G0 = mix(c('#245f33'), c('#2f7038'), tone), G1 = mix(c('#5aaa4c'), c('#7cc05a'), hash3(seed, i, 8));
      for (const [o, y, ny, no] of PR) {
        const t = y / 1.56;
        this.P.push(a[0] + nx * o * wd, y * h + 0.25, a[1] + nz * o * wd);
        const l = Math.hypot(no, ny) || 1; this.N.push(nx * no / l, ny / l, nz * no / l);
        this.C.push(lerp(G0[0], G1[0], t), lerp(G0[1], G1[1], t), lerp(G0[2], G1[2], t)); this.K.push(this.kind);
      }
    }
    const K = PR.length;
    for (let i = 0; i < steps; i++) for (let j = 0; j < K - 1; j++) {
      const a = v0 + i * K + j, b = a + 1, d = a + K, e = d + 1;
      if (side > 0) this.I.push(a, b, d, b, e, d); else this.I.push(a, d, b, b, d, e);
    }
    this.v += (steps + 1) * K;
  }
  // An upright round post or tank, smooth, no cap below. r1 at the top.
  cyl(x, y0, y1, z, r0, r1, col, colTop = col, seg = 8, cap = false) {
    const v0 = this.v;
    for (let j = 0; j < 2; j++) for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2, r = j ? r1 : r0, nx = Math.cos(a), nz = Math.sin(a), c2 = j ? colTop : col;
      this.P.push(x + nx * r, j ? y1 : y0, z + nz * r); this.N.push(nx, 0, nz); this.C.push(...c2); this.K.push(this.kind);
    }
    for (let i = 0; i < seg; i++) { const a = v0 + i, b = v0 + (i + 1) % seg, c2 = a + seg, d = b + seg; this.I.push(a, c2, b, b, c2, d); }
    this.v += seg * 2;
    if (cap) for (let i = 1; i + 1 < seg; i++) {
      const a0 = 0, a1 = (i / seg) * Math.PI * 2, a2 = ((i + 1) / seg) * Math.PI * 2;
      this.quad([x + r1, y1, z], [x + Math.cos(a2) * r1, y1, z + Math.sin(a2) * r1], [x + Math.cos(a1) * r1, y1, z + Math.sin(a1) * r1], [x + Math.cos(a1) * r1, y1, z + Math.sin(a1) * r1], colTop);
    }
  }
  // A square bar between two points in space: a strut, a stair rail, a brace.
  bar(a, b, t, col, colEnd = col) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], l = Math.hypot(dx, dy, dz) || 1;
    // two axes across the bar
    let ux = dz, uy = 0, uz = -dx, m = Math.hypot(ux, uz);
    if (m < 1e-4) { ux = 1; uz = 0; m = 1; }
    ux *= t / 2 / m; uz *= t / 2 / m;
    const vx = (dy * uz - dz * uy) / l, vy = (dz * ux - dx * uz) / l, vz = (dx * uy - dy * ux) / l;
    const A = [[ux + vx, uy + vy, uz + vz], [-ux + vx, -uy + vy, -uz + vz], [-ux - vx, -uy - vy, -uz - vz], [ux - vx, uy - vy, uz - vz]];
    for (let i = 0; i < 4; i++) {
      const p = A[i], q = A[(i + 1) % 4];
      this.quad([a[0] + q[0], a[1] + q[1], a[2] + q[2]], [a[0] + p[0], a[1] + p[1], a[2] + p[2]], [b[0] + p[0], b[1] + p[1], b[2] + p[2]], [b[0] + q[0], b[1] + q[1], b[2] + q[2]], col, colEnd);
    }
  }
  // Lettering on the plane of a panel, faces (sin yaw, cos yaw): y is the baseline.
  text(word, x, y, z, yaw, h, col, opts) { writeText((a, b, c2, d) => this.quad(a, b, c2, d, col), word, x, y, z, yaw, h, opts); }
  // A board you can read from the road: it has thickness, a band of colour along its foot and strokes for letters.
  sign(word, x, y, z, yaw, w, h, bg, fg, out = 0.15, band = null) {
    const sn = Math.sin(yaw), cs = Math.cos(yaw), fx = x + sn * out, fz = z + cs * out;
    this.boxU(fx, y, fz, w, h, 0.2, yaw, bg, mul(bg, 1.06), 0.96);
    const front = 0.112;
    if (band) this.panel(fx, y + 0.04, fz, w * 0.97, h * 0.14, yaw, band, front);
    const cap = h * 0.54, baseY = y + h * (band ? 0.26 : 0.23);
    this.text(word, fx + sn * (front + 0.02), baseY, fz + cs * (front + 0.02), yaw, cap, fg, { fit: w * 0.9 });
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.P), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(this.N), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.C), 3));
    g.setAttribute('aPaint', new THREE.BufferAttribute(new Float32Array(this.K), 1));
    g.setIndex(new THREE.BufferAttribute(this.v > 65535 ? new Uint32Array(this.I) : new Uint16Array(this.I), 1));
    return g;
  }
}

// Blocks of 320 m, so each goes to one cell of the long track batch.
export class Blocks {
  constructor(size = 300) { this.size = size; this.map = new Map(); }
  at(x, z) {
    const k = `${Math.floor(x / this.size)},${Math.floor(z / this.size)}`;
    let r = this.map.get(k);
    if (!r) this.map.set(k, (r = { full: new Raw(), low: new Raw(), hasLow: false }));
    return r;
  }
  flush(batch) {
    for (const r of this.map.values()) {
      if (!r.full.v) continue;
      batch.add(r.full.geometry(), r.hasLow ? { low: r.low.geometry() } : undefined);
    }
  }
}

// ---------- colours ----------
const skyGlass = (g, k) => mix(g, c('#a9cbdc'), k);
const DARKGLASS = ['#2a3b47', '#23343f', '#30414c', '#26404a', '#2d3944'].map(c);
const GLASS = [['#5fb2c4', '#3f8ea6'], ['#6aa8d8', '#4279b4'], ['#7fcac8', '#4f9aa0'], ['#8fb8d8', '#5a86ad'], ['#4f9fc0', '#2f7898'], ['#b6d0d8', '#7f9db0']].map((q) => q.map(c));
const STONE = ['#e9dcc4', '#d9c8ae', '#f1ece0', '#cfa890', '#e4d2b8', '#c9c2b6'].map(c);
const WIN = ['#3f5f78', '#4c7088', '#35546e', '#5a7c90'].map(c);
const PAINT = ['#f2719a', '#3fc1c9', '#f7c948', '#8fd14f', '#f58a3c', '#b794e8', '#5aa9e6', '#ff6f61', '#f4f1de', '#48c78e'].map(c);
const ROOFS = ['#b5583a', '#c46a3f', '#a34e38', '#8a4c3c', '#c97b4c', '#7c8a96', '#a8aeb4', '#4d7fa8'].map(c);
const AWNING = ['#d9483b', '#2d7fc4', '#f2b53a', '#39a05a', '#e87ba4', '#35b0ac'].map(c);
const SHOPS = ['BAKSO', 'SATE', 'NASI GORENG', 'WARTEG', 'ES CENDOL', 'TAMBAL BAN', 'PULSA', 'KOPI', 'MARTABAK', 'PECEL LELE', 'SOTO', 'GADO GADO', 'WARKOP', 'PANGKAS RAMBUT', 'LAUNDRY', 'ES TEH', 'BENGKEL', 'NASI UDUK', 'RUJAK', 'TOKO', 'SEMBAKO', 'BUBUR AYAM'];
const CONCRETE = c('#c9c4b8'), CONC_D = c('#9c988f'), PAVE = c('#d4cbb8'), TYRE = c('#2a2830'), STEEL = c('#7c8088'), YELLOW = c('#f2c23a'), RED = c('#d9483b'), WHITE = c('#f6f4ec'), DARK = c('#34323a'), GREEN = c('#3c8f58'), TEAL = c('#2f9c98');

// ---------- buildings ----------
const MALL = ['BANK', 'KOPI', 'APOTEK', 'RESTO', 'BUKU', 'SEPATU', 'BATIK', 'ROTI', 'GADGET', 'SALON', 'KANTOR POS', 'TOKO EMAS', 'OPTIK', 'MIE AYAM', 'NASI PADANG'];
// One face of a big building's podium: shop glass, a canopy you could stand under, a storey of offices, a few signs. Never one strip of paint on a blank wall.
function podiumFace(R, fx, fz, fy, W, pod, st, g, B, band, seed) {
  const cs = Math.cos(fy), sn = Math.sin(fy), glass = mix(g[0], c('#fff0c8'), 0.25);
  const alongX = (u) => fx + cs * u, alongZ = (u) => fz - sn * u;
  R.panel(fx, 0.5, fz, W - 1, 4.2, fy, glass, 0.06);
  const n = Math.max(3, Math.round(W / 6.5));
  for (let q = 0; q <= n; q++) { const u = (q / n - 0.5) * (W - 1); R.box(alongX(u) + sn * 0.2, 0, alongZ(u) + cs * 0.2, 0.7, 5.1, 0.5, fy, mul(st, 1.04), null, 0.9); }
  // each bay a shop of its own: a dark interior with something warm lit in it and a door, so that the street floor is not one pale band of glass
  for (let q = 0; q < n; q++) {
    const u = ((q + 0.5) / n - 0.5) * (W - 1), bw = (W - 1) / n - 1.1, tone = hash3(seed, q, 11), dark = mix(g[1], c('#20303a'), 0.55 + tone * 0.3), warm = mix(c('#ffd98a'), c('#f4a26a'), tone);
    R.panel(alongX(u), 0.7, alongZ(u), bw, 3.5, fy, dark, 0.08);
    R.panel(alongX(u), 2.9, alongZ(u), bw * 0.92, 0.9, fy, warm, 0.1);
    for (const v of [-0.3, 0.05, 0.32]) R.panel(alongX(u + v * bw), 0.7, alongZ(u + v * bw), bw * 0.14, 1.2 + hash3(seed, q + v * 9, 13) * 0.7, fy, mix(warm, AWNING[(q * 3 + Math.floor(v * 9 + 9)) % AWNING.length], 0.6), 0.11);
  }
  // the canopy: depth and an underside
  R.boxU(fx + sn * 1.2, 4.7, fz + cs * 1.2, W + 0.6, 0.34, 2.6, fy, band, mul(band, 1.08), 1, mul(band, 0.45));
  // over it, offices: a row of windows with a sill, and a soffit line at the top
  if (pod > 8) {
    const rows = pod > 13 ? 2 : 1;
    for (let k = 0; k < rows; k++) {
      const y = 6 + k * 3.6;
      R.panel(fx, y, fz, W * 0.96, 2.2, fy, B, 0.05);
      R.panel(fx, y - 0.22, fz, W * 0.97, 0.2, fy, mul(st, 1.08), 0.07);
      for (let q = 0; q <= n; q++) { const u = (q / n - 0.5) * W * 0.96; R.panel(alongX(u), y, alongZ(u), 0.22, 2.2, fy, mul(st, 0.98), 0.08); }
    }
    R.panel(fx, pod - 0.8, fz, W + 0.2, 0.8, fy, mul(st, 1.1), 0.1);
  }
  // signs over the canopy, each board its own
  const signs = Math.max(1, Math.floor(W / 16));
  for (let q = 0; q < signs; q++) {
    const u = ((q + 0.5) / signs - 0.5) * W * 0.9, word = MALL[Math.floor(hash3(seed, q, 3) * MALL.length)], bg = hash3(seed, q, 5) < 0.5 ? WHITE : YELLOW;
    R.sign(word, alongX(u), 5.05, alongZ(u), fy, Math.min(W / signs * 0.8, 9), 1.5, bg, hash3(seed, q, 7) < 0.5 ? RED : c('#23405c'), 1.6, band);
  }
}
// Far off a tower is still floors and glass: a few bands in place of the near model's many, or it is a grey monolith at the end of the street.
function towerLow(R, x, z, yaw, w, d, y, A, B) {
  const bands = Math.max(3, Math.min(10, Math.round(y / 13))), fh = y / bands;
  for (let i = 0; i < bands; i++) {
    const t = i / bands;
    R.box(x, i * fh, z, w, fh * 0.62, d, yaw, mul(B, lerp(0.9, 1.12, t)), null, 1);
    R.box(x, i * fh + fh * 0.62, z, w + 0.4, fh * 0.38, d + 0.4, yaw, mul(A, lerp(0.95, 1.1, t)), mul(A, 1.1), 1);
  }
}
function tower(F, x, z, yaw, w, d, h, seed, { low = true, plain = false, side = 0, back = false, dark = false } = {}) {
  const r = (q) => hash3(seed, q, 13);
  const glassy = r(1) < 0.72, g = GLASS[Math.floor(r(2) * GLASS.length)], st = STONE[Math.floor(r(3) * STONE.length)];
  const D0 = DARKGLASS[Math.floor(r(2) * DARKGLASS.length)], A = dark ? mul(D0, 1.5) : glassy ? g[0] : st, B = dark ? D0 : glassy ? g[1] : WIN[Math.floor(r(4) * WIN.length)];
  const fh = lerp(7.5, 11, r(5)) * (back ? 1.6 : 1), floors = Math.ceil(h / fh), R = F.full;
  const pod = 10 + r(6) * 6, csP = Math.cos(yaw), snP = Math.sin(yaw), band = AWNING[Math.floor(r(14) * AWNING.length)], pst = mix(st, c('#e8d8b8'), 0.4);
  R.box(x, 0, z, w + 8, pod, d + 8, yaw, pst);
  // plain: a tower in a back row, whose foot the front row hides
  // side: which way the road is along the normal; its street face and the end the traffic comes towards are dressed, the two no one on the road ever sees are not
  if (!plain) for (const s of [-1, 1]) {
    const fx = x + snP * s * (d / 2 + 4), fz = z + csP * s * (d / 2 + 4), fy = s > 0 ? yaw : yaw + Math.PI;
    if (!side || s < 0) podiumFace(R, fx, fz, fy, w + 8, pod, pst, g, B, band, seed + s);
    const sx = x + csP * s * (w / 2 + 4), sz = z - snP * s * (w / 2 + 4), sy = yaw + s * Math.PI / 2;
    if (!side || s === side) podiumFace(R, sx, sz, sy, d + 8, pod, pst, g, B, band, seed + s * 3);
  }
  // the shaft in bands: glass and spandrel, darker toward the foot
  let y = pod;
  // a dark curtain wall: one sheet of glass that takes the sky toward its top, a thin joint every few floors. Bands would read as a stack of plates
  if (dark) {
    const H = fh * floors, Lit = skyGlass(D0, 0.34 + 0.2 * r(10)), J = mix(D0, c('#a9cbdc'), 0.62);
    R.box(x, pod, z, w, H, d, yaw, Lit, mul(D0, 1.2), 0.46);
    if (!back) for (let i = 1; i * 10 < H; i++) R.box(x, pod + i * 10, z, w + 0.3, 0.28, d + 0.3, yaw, J, J, 1);
    y += H;
  } else for (let i = 0; i < floors; i++) {
    const t = i / floors, taper = r(7) < 0.3 ? lerp(1, 0.86, smooth(0.6, 1, t)) : 1;
    R.box(x, y, z, w * taper, fh * 0.62, d * taper, yaw, mul(B, lerp(0.85, 1.12, t)), mul(B, 1.1), 1);
    R.box(x, y + fh * 0.62, z, w * taper + 0.5, fh * 0.38, d * taper + 0.5, yaw, mul(A, lerp(0.92, 1.1, t)), mul(A, 1.1), 1);
    y += fh;
  }
  // upright fins so the bands do not read as a stack of plates
  const fins = dark ? (back ? 0 : 2 + Math.floor(r(9) * 2)) : plain ? (back ? 0 : 2) : 3 + Math.floor(r(9) * 3);
  for (let q = 0; q < fins; q++) {
    const u = (q + 0.5) / fins - 0.5;
    for (const s of [-1, 1]) {
      const cs = Math.cos(yaw), sn = Math.sin(yaw), ax = u * w, az = s * (d / 2 + 0.3);
      if (!side || s < 0) R.box(x + ax * cs + az * sn, pod, z - ax * sn + az * cs, 0.55, y - pod, 0.5, yaw, mul(A, 1.1), null, 1);
      const bz = u * d, bx = s * (w / 2 + 0.3);
      if (!side || s === side) R.box(x + bx * cs + bz * sn, pod, z - bx * sn + bz * cs, 0.5, y - pod, 0.55, yaw, mul(A, 1.1), null, 1);
    }
  }
  // what it has on top
  const crown = r(11);
  if (crown < 0.3) { R.box(x, y, z, w * 0.5, 7, d * 0.5, yaw, mul(A, 1.05)); R.box(x, y + 7, z, 0.8, 12, 0.8, yaw, WHITE); }
  else if (crown < 0.55) { R.box(x, y, z, w * 1.02, 2, d * 1.02, yaw, WHITE); R.box(x, y + 2, z, w * 0.3, 4, d * 0.3, yaw, RED); }
  else if (crown < 0.8) R.roof(x, y, z, w, d, 10 + r(12) * 8, yaw, mul(A, 1.05));
  else { R.box(x, y, z, w * 0.7, 5, d * 0.7, yaw, WHITE); R.box(x, y + 5, z, w * 0.4, 5, d * 0.4, yaw, mul(A, 1.05)); }
  if (low) { F.hasLow = true; towerLow(F.low, x, z, yaw, w + 2, d + 2, y, A, B); }
  return y;
}

// A shophouse: tall narrow, roller shutter below, a sign, a tin awning. face: yaw towards the road.
function ruko(F, x, z, yaw, w, seed, text = true) {
  const r = (q) => hash3(seed, q, 29), R = F.full, floors = 2 + Math.floor(r(1) * 2.4), fh = 3.5, h = floors * fh, d = 11;
  const pick = r(2) < 0.45 ? mix(PAINT[Math.floor(r(3) * PAINT.length)], c('#d8d0c0'), 0.3) : STONE[Math.floor(r(3) * STONE.length)];
  const wall = pick, cs = Math.cos(yaw), sn = Math.sin(yaw), fx = x + sn * d / 2, fz = z + cs * d / 2;
  R.kind = 6; R.box(x, 0, z, w, h, d, yaw, wall, null, 0.76); R.kind = 0;
  R.kind = 7; R.roof(x, h, z, w + 0.6, d + 0.6, 2 + r(4) * 1.6, yaw, ROOFS[Math.floor(r(5) * ROOFS.length)]); R.kind = 0;
  // the shutter: dark, with its ribs and a bit of shop showing
  const open = r(6) < 0.55, sh = open ? c('#3a3838') : c('#7a8088');
  R.panel(fx, 0, fz, w * 0.84, 2.9, yaw, sh, 0.05);
  if (!open) for (let q = 1; q < 6; q++) R.panel(fx, q * 0.48, fz, w * 0.84, 0.06, yaw, mul(sh, 0.72), 0.07);
  else { R.panel(fx, 0.8, fz, w * 0.72, 0.1, yaw, c('#c9a24a'), 0.08); R.panel(fx, 1.5, fz, w * 0.72, 0.1, yaw, c('#c9a24a'), 0.08); }
  for (let f = 1; f < floors; f++) {
    for (let a = 0; a < 2; a++) {
      const u = (a - 0.5) * w * 0.5, cx = fx + cs * u, cz = fz - sn * u;
      R.panel(cx, f * fh + 0.62, cz, w * 0.38, 2.1, yaw, mul(wall, 1.1), 0.04);
      R.panel(cx, f * fh + 0.8, cz, w * 0.3, 1.74, yaw, WIN[a % 4], 0.06);
      R.panel(cx, f * fh + 1.62, cz, w * 0.3, 0.08, yaw, mul(wall, 1.1), 0.075);
      R.panel(cx, f * fh + 0.58, cz, w * 0.42, 0.14, yaw, WHITE, 0.09);
    }
  }
  // the awning over the pavement, with its posts
  const col = AWNING[Math.floor(r(7) * AWNING.length)], ax = fx + sn * 1.6, az = fz + cs * 1.6;
  R.quad([fx - cs * w * 0.5, 3.1, fz + sn * w * 0.5], [fx + cs * w * 0.5, 3.1, fz - sn * w * 0.5], [ax + sn * 0.6 + cs * w * 0.5, 2.6, az + cs * 0.6 - sn * w * 0.5], [ax + sn * 0.6 - cs * w * 0.5, 2.6, az + cs * 0.6 + sn * w * 0.5], col, mul(col, 0.88));
  R.quad([ax + sn * 0.6 - cs * w * 0.5, 2.6, az + cs * 0.6 + sn * w * 0.5], [ax + sn * 0.6 + cs * w * 0.5, 2.6, az + cs * 0.6 - sn * w * 0.5], [fx + cs * w * 0.5, 3.1, fz - sn * w * 0.5], [fx - cs * w * 0.5, 3.1, fz + sn * w * 0.5], mul(col, 0.5));
  if (text) {
    const word = SHOPS[Math.floor(r(8) * SHOPS.length)], bw = w * 0.94, bg = r(9) < 0.5 ? WHITE : YELLOW;
    R.sign(word, fx, 3.25, fz, yaw, bw, 1.45, bg, r(10) < 0.5 ? RED : c('#23405c'), 0.14, AWNING[Math.floor(r(11) * AWNING.length)]);
  }
  // somebody's water tank, because the mains are a rumour
  if (r(12) < 0.3) { const tx = x - sn * 2 + cs * w * 0.2, tz = z - cs * 2 - sn * w * 0.2; R.cyl(tx, h + 1, h + 2.5, tz, 0.62, 0.62, c('#e87f2c'), c('#f29a44'), 7, true); }
  F.low.box(x, 0, z, w, h, d, yaw, wall, null, 0.8); F.low.roof(x, h, z, w + 0.6, d + 0.6, 2, yaw, ROOFS[Math.floor(r(5) * ROOFS.length)]); F.hasLow = true;
  return h;
}

// A kampung house: built one room at a time by whoever could afford the bricks that year. Bare brick, tired plaster, a room of planks and tin on top, a blue tarp where the money ran out, a rusty roof, an orange water tank.
const BRICK = c('#a8624a'), PLANK = c('#8a7058'), TARP = c('#2f6fc0'), RUST = ['#8e5a3a', '#a8683f', '#7a5238', '#8b8780', '#a39c90', '#6f7478', '#b57a4c'].map(c);
// old paint with years of rain and exhaust on it
const OLDWALL = ['#d9cfb8', '#c9d4c0', '#e0c8b0', '#c4c8cc', '#d8b8a8', '#b8ccd0', '#e4dcc0', '#c8b49c'].map(c).map((q) => mix(q, c('#7f7566'), 0.3));
function rumah(F, x, z, yaw, w, d, seed, { front = true, base = 0 } = {}) {
  const r = (q) => hash3(seed, q, 41), R = F.full, cs = Math.cos(yaw), sn = Math.sin(yaw), fx = x + sn * d / 2, fz = z + cs * d / 2;
  const brick = r(4) < 0.32, wall = brick ? BRICK : OLDWALL[Math.floor(r(5) * OLDWALL.length)], h = 2.7 + r(3) * 0.5;
  R.kind = brick ? 0 : 6;
  // on the river bank a house stands on what the bank will give it
  if (base < -0.4) { R.kind = 0; for (const a of [-1, 1]) for (const b of [-1, 1]) R.cyl(x + a * w * 0.4 * cs + b * d * 0.4 * sn, base, 0.2, z - a * w * 0.4 * sn + b * d * 0.4 * cs, 0.14, 0.14, c('#6a5a48'), c('#7a6a58'), 5); R.boxU(x, 0, z, w + 0.3, 0.3, d + 0.3, yaw, PLANK); R.kind = brick ? 0 : 6; }
  R.box(x, base < -0.4 ? 0.3 : 0, z, w, h, d, yaw, wall, null, brick ? 0.86 : 0.66);
  R.kind = 0;
  if (front) {
    const col = OLDWALL[Math.floor(r(6) * OLDWALL.length)];
    // damp up the foot of the wall, a streak from the gutter
    R.panel(fx, 0, fz, w * 0.99, 0.5 + r(23) * 0.5, yaw, mul(wall, 0.62), 0.03);
    R.panel(fx + cs * w * (r(24) - 0.5) * 0.7, 0.6, fz - sn * w * (r(24) - 0.5) * 0.7, 0.3 + r(25) * 0.5, h - 0.6, yaw, mul(wall, 0.76), 0.025);
    R.panel(fx - cs * w * 0.24, 0, fz + sn * w * 0.24, 1, 2.15, yaw, r(7) < 0.5 ? c('#5a4432') : c('#3f6a8a'), 0.05);
    R.panel(fx + cs * w * 0.22, 0.95, fz - sn * w * 0.22, 1.45, 1.15, yaw, mul(col, 1.05), 0.04);
    R.panel(fx + cs * w * 0.22, 1.02, fz - sn * w * 0.22, 1.25, 1, yaw, WIN[1], 0.06);
    for (let q = 0; q < 3; q++) R.panel(fx + cs * (w * 0.22 + (q - 1) * 0.4), 1.02, fz - sn * (w * 0.22 + (q - 1) * 0.4), 0.05, 1, yaw, DARK, 0.08);
  }
  let top = h, w2 = w, d2 = d, ox = 0;
  // the room on top, often leaning out over the lane
  if (r(8) < 0.72) {
    w2 = w * (0.82 + r(9) * 0.2); d2 = d * 0.86; const over = front ? 0.5 + r(10) * 0.5 : 0, ax = sn * over, az = cs * over, kind = r(11);
    const up = kind < 0.28 ? PLANK : kind < 0.42 ? c('#8b8780') : OLDWALL[Math.floor(r(12) * OLDWALL.length)], h2 = 2.4 + r(13) * 0.3;
    R.kind = kind < 0.42 ? 0 : 6; R.boxU(x + ax, top, z + az, w2, h2, d2, yaw, up, null, 0.88, mul(up, 0.4)); R.kind = 0;
    if (front) {
      const fx2 = x + ax + sn * d2 / 2, fz2 = z + az + cs * d2 / 2;
      R.panel(fx2, top + 0.8, fz2, w2 * 0.46, 1.05, yaw, WIN[2], 0.05);
      R.panel(fx2, top + 0.68, fz2, w2 * 0.56, 0.12, yaw, WHITE, 0.07);
      if (r(14) < 0.28) R.panel(fx2 + cs * w2 * 0.28, top + 0.1, fz2 - sn * w2 * 0.28, w2 * 0.44, h2 * 0.8, yaw, TARP, 0.09);
    }
    top += h2; ox = over;
    // and now and then one more
    if (r(15) < 0.3) { const h3 = 2.2; R.kind = 6; R.box(x + ax * 0.4, top, z + az * 0.4, w2 * 0.7, h3, d2 * 0.72, yaw, OLDWALL[Math.floor(r(16) * OLDWALL.length)], null, 0.9); R.kind = 0; top += h3; w2 *= 0.7; d2 *= 0.72; ox *= 0.4; }
  }
  const col = RUST[Math.floor(r(17) * RUST.length)], rx = x + sn * ox, rz = z + cs * ox;
  R.kind = 7;
  if (r(18) < 0.5) R.roof(rx, top, rz, w2 + 1, d2 + 1, 1 + r(19) * 0.9, yaw, col);
  else {
    // a one way slope of corrugated sheet, thrown on and held with stones
    const hw = (w2 + 0.9) / 2, hd = (d2 + 1.1) / 2, rise = 0.9, P = (a, b, y) => [rx + a * cs + b * sn, y, rz - a * sn + b * cs];
    R.quad(P(-hw, hd, top + 0.1), P(hw, hd, top + 0.1), P(hw, -hd, top + rise), P(-hw, -hd, top + rise), col, mul(col, 1.08));
    R.quad(P(hw, hd, top + 0.08), P(-hw, hd, top + 0.08), P(-hw, -hd, top + rise - 0.02), P(hw, -hd, top + rise - 0.02), mul(col, 0.45));
  }
  R.kind = 0;
  if (front && r(20) < 0.5) {
    // laundry across the front, someone's whole week
    const n = 3 + Math.floor(r(21) * 3), ly = Math.min(top, h + 1.2) - 0.1;
    for (let q = 0; q < n; q++) {
      const u = (q + 0.5) / n - 0.5, col2 = PAINT[Math.floor(hash3(seed, q, 77) * PAINT.length)];
      R.panel(fx + sn * (ox + 0.2) + cs * u * w, ly - 0.72, fz + cs * (ox + 0.2) - sn * u * w, 0.5, 0.72, yaw, col2, 0);
    }
  }
  const e = r(22);
  if (e < 0.26) { const tx = x + cs * w * 0.15, tz = z - sn * w * 0.15; R.cyl(tx, top + 0.3, top + 1.5, tz, 0.56, 0.56, c('#e87f2c'), c('#f29a44'), 7, true); for (const q of [-1, 1]) R.bar([tx + q * 0.4, top, tz], [tx + q * 0.4, top + 0.5, tz], 0.08, STEEL); }
  else if (e < 0.4) { const tx = x - cs * w * 0.2, tz = z + sn * w * 0.2; R.bar([tx, top, tz], [tx, top + 0.9, tz], 0.06, STEEL); R.blob(tx, top + 1.1, tz, 0.5, 0.5, 0.14, c('#c8ccd0'), c('#e8ecee'), 7, 2); }
  F.low.box(x, 0, z, w, top, d, yaw, wall, null, 0.8); F.low.roof(x, top, z, w + 1, d + 1, 1.2, yaw, col); F.hasLow = true;
  return top;
}

// The little roofs that make the city go on for ever: walls and hips only, twelve triangles.
function hutRoof(F, x, z, yaw, w, d, h, wall, col, toRoad = null) {
  const R = F.full, cs = Math.cos(yaw), sn = Math.sin(yaw), hw = w / 2, hd = d / 2;
  const cor = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([a, b]) => [x + a * cs + b * sn, z - a * sn + b * cs]), bot = mul(wall, 0.8);
  for (let i = 0; i < 4; i++) { const A = cor[i], B = cor[(i + 1) % 4]; R.quad([B[0], 0, B[1]], [A[0], 0, A[1]], [A[0], h, A[1]], [B[0], h, B[1]], bot, wall); }
  R.roof(x, h, z, w + 0.6, d + 0.6, 1.8, yaw, col);
  F.low.box(x, 0, z, w, h + 1, d, yaw, wall, col, 0.8); F.hasLow = true;
  if (!toRoad) return;
  // the two faces that look at the road get windows, floor by floor: a blank box beside a road reads as a crate
  const floors = Math.max(1, Math.round((h - 0.6) / 3.3)), fh = h / floors;
  for (let i = 0; i < 4; i++) {
    const A = cor[i], B = cor[(i + 1) % 4], ax = B[0] - A[0], az = B[1] - A[1], L = Math.hypot(ax, az), ux = ax / L, uz = az / L, nx = uz, nz = -ux;
    if (nx * toRoad[0] + nz * toRoad[1] <= 0) continue;
    const n = Math.min(3, Math.max(1, Math.floor(L / 5))), o = 0.06;
    for (let f = 0; f < floors; f++) {
      const y0 = f * fh + fh * 0.36, y1 = f * fh + fh * 0.8;
      for (let k = 0; k < n; k++) {
        const c = ((k + 0.5) / n) * L, q = (t) => [A[0] + ux * (c + t) + nx * o, A[1] + uz * (c + t) + nz * o];
        const p0 = q(-0.8), p1 = q(0.8);
        R.quad([p1[0], y0, p1[1]], [p0[0], y0, p0[1]], [p0[0], y1, p0[1]], [p1[0], y1, p1[1]], HUTGLASS, HUTGLASS);
      }
    }
  }
}

const HUTGLASS = c('#3c4852');
const TAU = Math.PI * 2;
let jakartaJets = null;

// ---------- the Monas ----------
const MONAS_S = 1; // its true 132 m: it has to fit the frame from the road beside the square
// A square section lifted through a profile, flat faces and hard corners: [half side, height, colour?]. The monument is cut stone, not turned on a lathe.
function squareStack(R, x, z, prof, col, yaw = 0, tone = null) {
  const cs = Math.cos(yaw), sn = Math.sin(yaw), P = (a, b, y) => [x + a * cs + b * sn, y, z - a * sn + b * cs];
  for (let i = 0; i + 1 < prof.length; i++) {
    const [h0, y0] = prof[i], [h1, y1] = prof[i + 1], c0 = tone ? mul(col, tone(y0)) : col, c1 = tone ? mul(col, tone(y1)) : col;
    if (h0 === h1 && y0 === y1) continue;
    R.quad(P(h0, h0, y0), P(-h0, h0, y0), P(-h1, h1, y1), P(h1, h1, y1), mul(c0, 1.02), mul(c1, 1.02));
    R.quad(P(-h0, -h0, y0), P(h0, -h0, y0), P(h1, -h1, y1), P(-h1, -h1, y1), mul(c0, 0.96), mul(c1, 0.96));
    R.quad(P(h0, -h0, y0), P(h0, h0, y0), P(h1, h1, y1), P(h1, -h1, y1), c0, c1);
    R.quad(P(-h0, h0, y0), P(-h0, -h0, y0), P(-h1, -h1, y1), P(-h1, h1, y1), mul(c0, 0.98), mul(c1, 0.98));
  }
}
function monasFlame(R, s, seg, rings) {
  // the flame: 14 m of gold, 6 across, rugged as beaten metal: flat facets at no two angles alike, three tongues gathering to one point
  const H = 13.6, W = 3.05, Y0 = 118.4, pts = [];
  for (let j = 0; j <= rings; j++) {
    const t = j / rings, ring = (j === rings ? 0 : Math.sin(Math.PI * Math.pow(t, 0.55)) ** 0.8 * W * (1 - t * 0.24)) + 0.12, row = [];
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * TAU + t * 1.5, lobe = 1 + 0.2 * Math.sin(a * 3) * Math.min(1, t * 2) + 0.34 * (hash3(i, j, 71) - 0.5), r = ring * lobe;
      row.push([Math.cos(a) * r * s, (Y0 + t * H + (j && j < rings ? (hash3(i, j, 72) - 0.5) * 1.1 : 0)) * s, Math.sin(a) * r * s]);
    }
    pts.push(row);
  }
  const G = [c('#c8922a'), c('#e8b838'), c('#f6cc4e'), c('#ffe07a')];
  for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) {
    const k = (i + 1) % seg, a = pts[j][i], b = pts[j][k], d = pts[j + 1][k], e = pts[j + 1][i], t0 = G[Math.floor(hash3(i, j, 73) * 4)];
    R.quad(a, b, d, a === d ? e : d, t0, mul(t0, 1.1));
    R.quad(a, d, e, e, t0, mul(t0, 1.1));
  }
}
function monas() {
  const R = new Raw(), s = MONAS_S, M = c('#f6f1e4'), CUP = c('#f2ecdc'), MS = c('#b4aa94'), G = c('#d8a830');
  const S = (q) => q.map(([h, y]) => [h * s, y * s]);
  // the yard, then the Cawan: a wide square saucer on a narrow waist, 17 m high and six shaft widths across. Its underside goes into shade, so that it reads from a long way off.
  squareStack(R, 0, 0, S([[35, 0], [35, 1.3], [32, 1.3], [32, 2.8], [15, 3.4]]), c('#ddd5c0'));
  const under = (y) => (y < 5 ? 0.66 : y < 12 ? lerp(0.62, 0.74, (y - 5) / 7) : y < 16.6 ? lerp(0.74, 0.98, (y - 12) / 4.6) : 1.04);
  squareStack(R, 0, 0, S([[15, 3.4], [13, 5], [13.4, 8], [16.5, 11.5], [21.5, 14.6], [25.5, 16.6], [26.8, 17.4], [26.8, 18.6], [24.4, 19], [10, 20.6], [5, 22.4]]), CUP, 0, under);
  // grooves round the bowl, so it has a surface and the sun has something to do
  for (let i = -4; i <= 4; i++) {
    const a = i * 5 * s;
    for (const [, ca, sa] of [[0, 1, 0], [Math.PI, -1, 0], [Math.PI / 2, 0, 1], [-Math.PI / 2, 0, -1]]) {
      const q = [[13.8, 8], [25.8, 16.8]];
      const fx = (h) => (ca ? ca * h * s : a), fz = (h) => (sa ? sa * h * s : a);
      R.quad([fx(q[0][0]) + (ca ? 0.1 * ca : 0), q[0][1] * s, fz(q[0][0]) + (sa ? 0.1 * sa : 0)], [fx(q[0][0]) + (ca ? 0.1 * ca : 0.5), q[0][1] * s, fz(q[0][0]) + (sa ? 0.1 * sa : 0.5)], [fx(q[1][0]) + (ca ? 0.1 * ca : 0.5), q[1][1] * s, fz(q[1][0]) + (sa ? 0.1 * sa : 0.5)], [fx(q[1][0]) + (ca ? 0.1 * ca : 0), q[1][1] * s, fz(q[1][0]) + (sa ? 0.1 * sa : 0)], MS);
    }
  }
  // the shaft: slim and nearly parallel, ten to one and more
  squareStack(R, 0, 0, S([[5, 22.4], [4.55, 60], [4.15, 100], [3.95, 112.6]]), M, 0, (y) => lerp(0.93, 1.05, y / (113 * s)));
  // the look-out: it flares out of the shaft like the top of a pillar, wider than the shaft, then draws back in under the flame
  squareStack(R, 0, 0, S([[3.95, 112.6], [5.2, 114], [6.7, 115.4], [6.7, 116.4], [5.6, 116.8], [3.2, 117.3], [2.5, 118.2]]), M, 0, (y) => (y < 115.4 * s ? 0.8 : 1));
  squareStack(R, 0, 0, S([[2.5, 118.2], [2.7, 118.7]]), G);
  for (const a of [-1, 1]) for (const b of [-1, 1]) R.bar([a * 6.5 * s, 116.4 * s, b * 6.5 * s], [a * 6.5 * s, 117.5 * s, b * 6.5 * s], 0.12, STEEL);
  monasFlame(R, s, 9, 7);
  return R.geometry();
}

// ---------- Selamat Datang: a man and a woman waving a welcome, in dark bronze, high on a slim pedestal in the round fountain ----------
function figure(woman, B) {
  const P = [], BL = '#6f5a44';
  // shoulders to hips; the man square, the woman narrower
  P.push(paint(place(capsule(woman ? 0.6 : 0.72, 2.7, 3, 9), { p: [0, 6.5, 0], s: woman ? [0.92, 1, 0.74] : [1.06, 1, 0.76] }), B));
  P.push(paint(place(sphere(0.66, 12, 9), { p: [0, 9.5, 0.04] }), BL));
  if (woman) {
    // a long kain to the feet and her hair in a knot
    P.push(paint(lathe([[0.98, 0.2], [0.84, 2.2], [0.68, 4.2], [0.58, 5.4]], 11), B));
    P.push(paint(place(sphere(0.46, 8, 6), { p: [0, 10.2, -0.5] }), B));
  } else {
    // trousers, two clear legs
    for (const s of [-1, 1]) P.push(paint(place(capsule(0.34, 3.7, 2, 7), { p: [s * 0.4, 2.5, 0], r: [0, 0, s * 0.05] }), B));
  }
  // the raised arm: straight up and out, the hand open; the other at the waist or, for her, up with the flowers
  const side = woman ? 1 : -1, up = (x0, y0, ang, L, r) => paint(place(capsule(r, L, 2, 7), { p: [x0 + Math.sin(ang) * L / 2, y0 + Math.cos(ang) * L / 2, 0.1], r: [0, 0, -ang] }), B);
  P.push(up(side * 0.72, 8.1, side * 0.42, 4, 0.24));
  P.push(paint(place(sphere(0.46, 7, 5), { p: [side * (0.72 + Math.sin(0.42) * 4.4), 8.1 + Math.cos(0.42) * 4.4, 0.1] }), BL));
  if (woman) {
    // the bouquet, a fat bunch held out
    P.push(up(-0.8, 8, -0.72, 2.6, 0.3));
    for (const [x, y, r] of [[-2.9, 10.8, 0.62], [-3.5, 10.4, 0.5], [-2.5, 11.4, 0.5], [-3.2, 11.3, 0.56], [-2.4, 10.3, 0.44]]) P.push(paint(place(sphere(r, 7, 5), { p: [x, y, 0.18] }), BL));
  } else P.push(paint(place(capsule(0.34, 3, 2, 7), { p: [0.98, 6.6, 0.2], r: [0.2, 0, 0.18] }), B));
  return merge(P);
}
function selamatDatang() {
  const R = new Raw(), P = [], B = '#463629', COL = c('#3a2d27'), CAP = c('#4a382e');
  // the column: slender, dark and open, two thin fins with the sky between them, tied by three rungs. Twenty metres up the pair stand against the air.
  R.boxU(0, 0.6, 0, 5.6, 0.9, 5.6, 0, c('#cfc8b8'));
  for (const s of [-1, 1]) R.box(s * 0.98, 1.5, 0, 0.56, 20.2, 2.2, 0, COL, mul(COL, 1.2), 0.82);
  for (const y of [6.5, 12, 17.5]) R.box(0, y, 0, 1.4, 0.3, 1.1, 0, COL, null, 1);
  R.box(0, 21.7, 0, 3.4, 0.6, 2.6, 0, CAP, mul(CAP, 1.2), 0.9);
  P.push(R.geometry());
  const a = figure(false, B), b = figure(true, B);
  place(a, { p: [-1.05, 22.3, 0], r: [0, 0.12, 0], s: 1.02 });
  place(b, { p: [1.05, 22.3, 0], r: [0, -0.12, 0], s: 0.96 });
  P.push(a, b);
  return merge(P);
}
// The pool: a low rim, still green water, rings of jets that arc inward and fall. The jets are what the place is known for by night and by day.
function hiPool(R, x, z, r0) {
  const WATER = c('#3f8f86'), WATERL = c('#5fb0a4'), RIM = c('#e4ddcc'), JET = c('#e8f6f8'), JETT = c('#ffffff');
  const seg = 48, ring = (r, y, col, colD, r2 = r, y2 = y) => { for (let i = 0; i < seg; i++) { const a0 = i / seg * TAU, a1 = (i + 1) / seg * TAU; R.quad([x + Math.cos(a0) * r, y, z + Math.sin(a0) * r], [x + Math.cos(a1) * r, y, z + Math.sin(a1) * r], [x + Math.cos(a1) * r2, y2, z + Math.sin(a1) * r2], [x + Math.cos(a0) * r2, y2, z + Math.sin(a0) * r2], col, colD); } };
  // the lotus of pale stone round the pool, and its kerb
  ring(r0 + 15, 0.34, c('#d9d2c0'), c('#d9d2c0'), r0 + 1.2, 0.34);
  for (let i = 0; i < 24; i++) {
    const a = (i + 0.5) / 24 * TAU, m0 = a - 0.11, m1 = a + 0.11, rr = r0 + 2, rO = r0 + 12;
    R.quad([x + Math.cos(m0) * rr, 0.37, z + Math.sin(m0) * rr], [x + Math.cos(m1) * rr, 0.37, z + Math.sin(m1) * rr], [x + Math.cos(a) * rO, 0.37, z + Math.sin(a) * rO], [x + Math.cos(a) * rO, 0.37, z + Math.sin(a) * rO], c('#b8ae98'));
  }
  ring(r0 + 15.2, 0, c('#c4bca8'), c('#d9d2c0'), r0 + 15, 0.34);
  ring(r0 + 1.2, 1.1, RIM, RIM, r0, 1.1);
  ring(r0 + 1.2, 0.34, mul(RIM, 0.86), RIM, r0 + 1.2, 1.1);
  ring(r0, 0.86, WATER, WATER, r0 * 0.45, 0.86);
  ring(r0 * 0.45, 0.86, WATERL, WATERL, 0.5, 0.86);
  // soft rings on the water where the jets come down
  for (const [ra, w] of [[r0 * 0.62, 2.6], [r0 * 0.8, 1.6], [r0 * 0.36, 1.6]]) ring(ra + w, 0.875, mix(WATERL, c('#c8e8e0'), 0.3), mix(WATERL, c('#c8e8e0'), 0.3), ra, 0.875);
}
// The water of the jets, its own see-through mesh that writes no depth: so the pen draws no line round it, and it is water and not a cage of wire.
function hiJets(x, z, r0) {
  const R = new Raw(), JET = c('#cfeef2'), JETT = c('#ffffff');
  // a fat ribbon up and over, thinning towards its top, turned to face out from the middle and crossed by a second so that it has body from any side
  const arc = (r1, r2, h, a, t0) => {
    const N = 8, ca = Math.cos(a), sa = Math.sin(a);
    for (let k = 0; k < N; k++) {
      const u0 = k / N, u1 = (k + 1) / N, rr0 = lerp(r1, r2, u0), rr1 = lerp(r1, r2, u1), y0 = 0.9 + h * 4 * u0 * (1 - u0), y1 = 0.9 + h * 4 * u1 * (1 - u1), t = (u) => t0 * (1 - 0.5 * Math.sin(u * Math.PI)) * (u > 0.75 ? 1.3 : 1);
      const P0 = [x + ca * rr0, y0, z + sa * rr0], P1 = [x + ca * rr1, y1, z + sa * rr1], tu0 = t(u0), tu1 = t(u1);
      const A = (p, tt, sx, sy) => [p[0] - sa * tt * sx, p[1] + tt * sy, p[2] + ca * tt * sx];
      for (const [sx, sy] of [[1, 0], [0, 1]]) {
        const a0 = A(P0, tu0, sx, sy), a1 = A(P0, tu0, -sx, -sy), b0 = A(P1, tu1, sx, sy), b1 = A(P1, tu1, -sx, -sy), mixc = mix(JET, JETT, u0);
        R.quad(a0, a1, b1, b0, mixc, mix(JET, JETT, u1));
        R.quad(a1, a0, b0, b1, mixc, mix(JET, JETT, u1));
      }
    }
    // the foam where it lands
    R.blob(x + ca * r2, 1.12, z + sa * r2, t0 * 3.4, 0.34, t0 * 3.4, JET, JETT, 7, 2);
  };
  // the outer ring shoots high and in, the middle ring out to meet it, and a crown of straight jets round the pedestal
  // the outer ring shoots high and in; the middle throws fans, three ribbons each, out over the wide water, tall enough to clear the traffic
  for (let i = 0; i < 24; i++) arc(r0 * 0.97, r0 * 0.7, 8.4 + (i % 2) * 1.6, i / 24 * TAU, 0.34);
  for (let i = 0; i < 16; i++) for (const q of [-1, 0, 1]) arc(r0 * 0.3, r0 * (0.8 - Math.abs(q) * 0.06), 10.5 - Math.abs(q) * 2, (i + 0.5) / 16 * TAU + q * 0.1, 0.26);
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, rr = r0 * 0.3, X = x + Math.cos(a) * rr, Z = z + Math.sin(a) * rr, H = 5.5 + 3.5 * (i % 2); R.cyl(X, 0.9, H, Z, 0.42, 0.14, JET, JETT, 6); R.blob(X, 1.1, Z, 1.1, 0.3, 1.1, JET, JETT, 7, 2); }
  return R.geometry();
}

// ---------- Arjuna Wijaya: a chariot and eight galloping horses in a fountain ----------
function horse(z, x) {
  const C = '#e9e4d6', P = [];
  P.push(paint(place(capsule(0.9, 1.9, 3, 8), { p: [0, 2.9, 0], r: [Math.PI / 2 + 0.22, 0, 0] }), C));
  P.push(paint(place(capsule(0.5, 1.5, 2, 7), { p: [0, 4.1, 1.8], r: [0.6, 0, 0] }), C));
  P.push(paint(place(capsule(0.45, 0.9, 2, 7), { p: [0, 5, 2.5], r: [1.3, 0, 0] }), C));
  for (const [a, b, rx] of [[-0.5, 1.4, -0.9], [0.5, 1.4, -0.5], [-0.5, -1.4, 0.5], [0.5, -1.4, 0.8]]) P.push(paint(place(capsule(0.22, 1.5, 2, 5), { p: [a, 1.6, b], r: [rx, 0, 0] }), C));
  const g = merge(P);
  return place(g, { p: [x, 2.6, z] });
}
function arjuna() {
  const P = [paint(place(cylinder(17, 17.6, 1.2, 28), { p: [0, 0.6, 0] }), '#d8d2c4'), paint(place(cylinder(16, 16, 0.2, 28), { p: [0, 1.2, 0] }), '#49c6d2')];
  P.push(paint(place(roundedBox(7, 2.4, 12, 0.5, 2), { p: [0, 2.3, 0] }), '#c9bd9f'));
  for (let i = 0; i < 8; i++) P.push(horse(6 + (i >> 1) * 4.6, ((i & 1) ? 1 : -1) * (0.9 + (i & 1) * 0.6 + ((i >> 1) % 2) * 1.2)));
  // the chariot, the charioteer and the archer
  P.push(paint(place(roundedBox(6, 3.2, 5, 1, 2), { p: [0, 5.2, -3.6] }), '#e9e4d6'));
  for (const s of [-1, 1]) P.push(paint(place(torus(2.3, 0.3, 6, 14), { p: [s * 3.3, 4.4, -4], r: [0, Math.PI / 2, 0] }), '#c9a648'));
  P.push(paint(place(capsule(1, 2.2, 3, 8), { p: [0, 8.6, -4.4] }), '#e9e4d6'), paint(place(sphere(0.92, 9, 7), { p: [0, 11.1, -4.4] }), '#e9e4d6'));
  P.push(paint(place(capsule(0.8, 1.6, 3, 8), { p: [0, 7.8, -1.5] }), '#e9e4d6'), paint(place(sphere(0.8, 9, 7), { p: [0, 9.8, -1.5] }), '#e9e4d6'));
  P.push(paint(place(torus(2.8, 0.12, 4, 20, ), { p: [1.8, 8.9, -3.2], r: [0, Math.PI / 2, 0] }), '#c9a648'));
  return merge(P);
}

// ---------- ondel-ondel: the giant Betawi street puppets, a red-faced one and a white-faced one, two heads taller than a bus ----------
function ondel(red) {
  const P = [], face = red ? '#d8472f' : '#f4efe6', batik = red ? '#2d7f6a' : '#d9482f', sash = red ? '#f2c23a' : '#f2c23a';
  P.push(paint(lathe([[1.5, 0], [1.42, 1.4], [1.1, 3], [0.96, 3.9], [0.6, 4.3]], 12), batik, 0, (x, y) => 0.86 + 0.14 * Math.sin(y * 5)));
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; P.push(paint(place(box(0.18, 1.3, 0.05), { p: [Math.cos(a) * 1.3, 1.2, Math.sin(a) * 1.3], r: [0, -a, 0] }), sash)); }
  P.push(paint(place(torus(1.02, 0.1, 5, 16), { p: [0, 3.5, 0], r: [Math.PI / 2, 0, 0] }), sash));
  P.push(paint(place(sphere(1.05, 12, 9), { p: [0, 5.1, 0], s: [1, 1.15, 0.95] }), face));
  for (const s of [-1, 1]) {
    P.push(paint(place(sphere(0.24, 8, 6), { p: [s * 0.4, 5.34, 0.88] }), '#fbfaf2'), paint(place(sphere(0.12, 6, 4), { p: [s * 0.4, 5.34, 1.08] }), '#1d1f2b'));
    if (red) P.push(paint(place(capsule(0.05, 0.4, 1, 4), { p: [s * 0.32, 4.86, 0.98], r: [0, 0, s * 1.3] }), '#1d1f2b'));
  }
  P.push(paint(place(sphere(0.16, 6, 4), { p: [0, 5.06, 1.02] }), red ? '#b5361f' : '#eaa78f'));
  // the crown of coconut fronds and paper that shakes as it walks
  P.push(paint(place(cylinder(1, 1.06, 0.4, 12), { p: [0, 6.12, 0] }), sash));
  const K = ['#f2c23a', '#e87ba4', '#3fc1c9', '#8fd14f', '#f58a3c'];
  for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; P.push(paint(place(capsule(0.09, 1.3, 1, 4), { p: [Math.cos(a) * 0.7, 6.9, Math.sin(a) * 0.7], r: [Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5] }), K[i % 5])); }
  return merge(P);
}

// ---------- the great mosque and the cathedral: treated with care, well away from the road ----------
function istiqlal() {
  const P = [], W = '#f4f1e8', G = '#c7c9c6', S = '#dad5c6';
  P.push(paint(place(roundedBox(90, 28, 90, 2, 1), { p: [0, 14, 0] }), W, 0, (x, y) => lerp(0.78, 1, y / 28)));
  for (let f = 0; f < 3; f++) for (let i = 0; i < 9; i++) for (const s of [-1, 1]) {
    P.push(paint(place(box(5.4, 5.4, 0.5), { p: [(i - 4) * 9.6, 5 + f * 8.4, s * 45.1] }), '#a9c1cb'));
    P.push(paint(place(box(0.5, 5.4, 5.4), { p: [s * 45.1, 5 + f * 8.4, (i - 4) * 9.6] }), '#a9c1cb'));
  }
  // the dome
  P.push(paint(place(cylinder(30, 32, 5, 30), { p: [0, 30, 0] }), S));
  P.push(paint(lathe(Array.from({ length: 9 }, (_, i) => { const a = i / 8 * Math.PI / 2; return [Math.cos(a) * 29 + 0.04, 32 + Math.sin(a) * 26]; }), 30), G, 0, (x, y) => lerp(0.92, 1.1, (y - 32) / 26)));
  P.push(paint(place(cylinder(0.3, 0.6, 7, 8), { p: [0, 61, 0] }), '#d7dbde'), paint(place(sphere(1.5, 8, 6), { p: [0, 65, 0] }), '#e6c75a'));
  // the single minaret, slim and very tall, a little apart
  P.push(paint(place(cylinder(4.4, 5.6, 96, 14), { p: [70, 48, 40] }), W, 0, (x, y) => lerp(0.86, 1.04, y / 96)));
  for (const y of [36, 72, 92]) P.push(paint(place(cylinder(6, 5.6, 1.6, 14), { p: [70, y, 40] }), S));
  P.push(paint(place(cone(4.4, 14, 14), { p: [70, 103, 40] }), '#c7c9c6'), paint(place(sphere(0.9, 7, 5), { p: [70, 110.8, 40] }), '#e6c75a'));
  return merge(P);
}
function istiqlalLow() {
  return merge([
    paint(place(box(90, 28, 90), { p: [0, 14, 0] }), '#e8e3d6'),
    paint(lathe([[31, 28], [29, 36], [20, 50], [8, 57], [0.1, 59]], 12), '#c7c9c6'),
    paint(place(cylinder(4, 5.6, 100, 6), { p: [70, 50, 40] }), '#f4f1e8'),
    paint(place(cone(4.2, 13, 6), { p: [70, 106, 40] }), '#c7c9c6'),
  ]);
}
function cathedral() {
  const P = [], W = '#e7e2d6', S = '#c9c4b8', SP = '#6f7078';
  P.push(paint(place(box(22, 22, 52), { p: [0, 11, 0] }), W, 0, (x, y) => lerp(0.8, 1, y / 22)));
  // a steep roof
  const roof = lathe([[17, 22], [0.5, 34]], 4);
  place(roof, { r: [0, Math.PI / 4, 0], s: [0.78, 1, 2] });
  P.push(paint(roof, '#7d6f66'));
  // the rose and tall lancet windows
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) P.push(paint(place(box(0.4, 11, 3), { p: [s * 11.05, 11, (i - 2.5) * 8] }), '#6d86b0'));
  // two spires at the west front, one more over the crossing
  for (const s of [-1, 1]) {
    P.push(paint(place(box(9, 44, 9), { p: [s * 8.5, 22, 27] }), W, 0, (x, y) => lerp(0.8, 1.02, y / 44)));
    P.push(paint(place(lathe([[6, 44], [0.15, 76]], 8), {}), SP));
    place(P[P.length - 1], { p: [s * 8.5, 0, 27] });
    P.push(paint(place(box(3.4, 10, 0.3), { p: [s * 8.5, 30, 31.6] }), '#6d86b0'));
  }
  P.push(paint(place(lathe([[3, 34], [0.1, 60]], 6), { p: [0, 0, -6] }), SP));
  P.push(paint(place(torus(4, 0.5, 5, 18), { p: [0, 26, 26.2] }), S), paint(place(cylinder(3.6, 3.6, 0.3, 18), { p: [0, 26, 26.2], r: [Math.PI / 2, 0, 0] }), '#c86f6f'));
  return merge(P);
}
function cathedralLow() {
  return merge([paint(place(box(22, 24, 52), { p: [0, 12, 0] }), '#e7e2d6'), ...[-1, 1].map((s) => paint(place(lathe([[6, 40], [0.2, 76]], 4), { p: [s * 8.5, 0, 27] }), '#6f7078')), ...[-1, 1].map((s) => paint(place(box(9, 42, 9), { p: [s * 8.5, 21, 27] }), '#e7e2d6'))]);
}

// ---------- towers worth naming, in cartoon: the shapes people point at ----------
// Wisma 46: the tall shaft in dark blue glass with pale ribs, under the nib of a fountain pen: a long curved cut up to one side.
function penTower(R, x, z, yaw, h = 170, low = false) {
  const W = c('#dfe3e2'), G = c('#35607f'), GD = c('#2a4e6a'), cs = Math.cos(yaw), sn = Math.sin(yaw), w = 32, d = 22;
  R.box(x, 0, z, w, h, d, yaw, skyGlass(G, 0.42), mul(G, 1.1), 0.6);
  const P = (a, b, y) => [x + a * cs + b * sn, y, z - a * sn + b * cs];
  if (!low) for (const b of [-1, 1]) for (let q = 0; q < 7; q++) { const [fx, , fz] = P((q / 6 - 0.5) * w, b * (d / 2 + 0.3), 0); R.box(fx, 0, fz, 0.6, h, 0.6, yaw, W, W, 1); }
  const steps = low ? 5 : 10, nib = 62;
  for (let i = 0; i < steps; i++) {
    const t = i / steps, t1 = (i + 1) / steps, w0 = w * Math.cos(t * 1.36), w1 = w * Math.cos(t1 * 1.36), y0 = h + nib * t, y1 = h + nib * t1;
    for (const b of [-1, 1]) {
      const q = [P(-w / 2, b * d / 2, y0), P(-w / 2 + w0, b * d / 2, y0), P(-w / 2 + w1, b * d / 2, y1), P(-w / 2, b * d / 2, y1)];
      if (b > 0) R.quad(q[0], q[1], q[2], q[3], mul(G, 1.3), mul(G, 1.5)); else R.quad(q[1], q[0], q[3], q[2], mul(GD, 1.3), mul(GD, 1.5));
    }
    R.quad(P(-w / 2 + w0, d / 2, y0), P(-w / 2 + w0, -d / 2, y0), P(-w / 2 + w1, -d / 2, y1), P(-w / 2 + w1, d / 2, y1), mul(W, 0.96));
    R.quad(P(-w / 2, -d / 2, y0), P(-w / 2, d / 2, y0), P(-w / 2, d / 2, y1), P(-w / 2, -d / 2, y1), mul(G, 1.2));
  }
  R.cyl(P(-w / 2, 0, 0)[0], h + nib, h + nib + 26, P(-w / 2, 0, 0)[2], 0.8, 0.1, W, W, 5);
  if (!low) R.box(x, 0, z, w + 12, 13, d + 12, yaw, c('#d8d2c2'), null, 0.8);
}
// The city's tallest, slim dark glass with a stepped crown and a spire.
function needleTower(R, x, z, h = 245, low = false) {
  const G = c('#2f5468'), W = c('#d4e4ea');
  for (const [y0, y1, hw] of [[0, h * 0.55, 40], [h * 0.55, h * 0.82, 35], [h * 0.82, h, 28]]) R.box(x, y0, z, hw, y1 - y0, hw, Math.PI / 4, skyGlass(G, 0.42), mul(G, 1.2), 0.6);
  R.box(x, h, z, 16, 10, 16, Math.PI / 4, W);
  R.box(x, h + 10, z, 8, 10, 8, Math.PI / 4, W);
  R.cyl(x, h + 20, h + 54, z, 1.2, 0.1, W, c('#ffffff'), low ? 4 : 6);
}
// The dark bank slab, end on to nobody: broad, flat, nearly black, with its pale crown of stepped fins standing clear of the roof.
function darkSlab(R, x, z, yaw, h = 150, low = false) {
  const G = c('#1f2a33'), W = c('#d9d6cc'), cs = Math.cos(yaw), sn = Math.sin(yaw), w = 62, d = 20;
  R.box(x, 0, z, w, h, d, yaw, skyGlass(G, 0.3), mul(G, 1.2), 0.42);
  if (!low) { R.box(x, 0, z, w + 10, 16, d + 10, yaw, c('#cfc8b8'), null, 0.8); for (let i = 1; i * 9 < h; i++) R.box(x, i * 9, z, w + 0.3, 0.26, d + 0.3, yaw, mix(G, c('#a9cbdc'), 0.5), mix(G, c('#a9cbdc'), 0.5), 1); }
  // the crown: a pale band, then fins that step up to the middle
  R.box(x, h, z, w + 1, 3, d + 1, yaw, W);
  for (let q = -3; q <= 3; q++) { const u = q * 8.2, hh = 20 - Math.abs(q) * 5; R.box(x + u * cs, h + 3, z - u * sn, 3, hh, d * 0.7, yaw, W, W, 0.9); }
}
// Twin slim towers in dark glass, tied at the top by a portal and half way up by a bridge in the sky: the gateway of the south end of the avenue.
function twinPortal(R, x, z, yaw, h = 190, low = false) {
  const G = c('#27414f'), W = c('#e4e6e2'), cs = Math.cos(yaw), sn = Math.sin(yaw), w = 24, d = 24, gap = 15;
  for (const s of [-1, 1]) {
    const X = x + s * (w + gap) / 2 * cs, Z = z - s * (w + gap) / 2 * sn;
    R.box(X, 0, Z, w, h, d, yaw, skyGlass(G, 0.42), mul(G, 1.2), 0.46);
    if (!low) for (const b of [-1, 1]) R.box(X + b * (d / 2 + 0.2) * sn, 0, Z + b * (d / 2 + 0.2) * cs, 0.9, h, 0.5, yaw, W, W, 1);
  }
  R.box(x, h - 4, z, 2 * w + gap + 2, 7, d * 0.7, yaw, W, W, 1);
  R.box(x, h * 0.56, z, gap + 2, 6, 7, yaw, mul(G, 2.2), W, 1);
}
// Slim glass with its top cut on a long slant and a white blade up its edge.
function wedgeTower(R, x, z, yaw, h = 200, low = false) {
  const G = c('#33566a'), W = c('#e8eaea'), cs = Math.cos(yaw), sn = Math.sin(yaw), w = 30, d = 26, cut = 46, P = (a, b, y) => [x + a * cs + b * sn, y, z - a * sn + b * cs];
  R.box(x, 0, z, w, h, d, yaw, skyGlass(G, 0.42), mul(G, 1.2), 0.5);
  for (const b of [-1, 1]) { const q = [P(-w / 2, b * d / 2, h), P(w / 2, b * d / 2, h), P(w / 2, b * d / 2, h + cut), P(w / 2, b * d / 2, h + cut)]; if (b > 0) R.quad(q[0], q[1], q[2], q[3], mul(G, 1.9)); else R.quad(q[1], q[0], q[3], q[2], mul(G, 1.5)); }
  R.quad(P(-w / 2, d / 2, h), P(-w / 2, -d / 2, h), P(w / 2, -d / 2, h + cut), P(w / 2, d / 2, h + cut), mul(G, 2.2));
  R.quad(P(w / 2, -d / 2, h), P(w / 2, d / 2, h), P(w / 2, d / 2, h + cut), P(w / 2, -d / 2, h + cut), mul(G, 1.6));
  const [bx, , bz] = P(w / 2 + 0.6, 0, 0); R.box(bx, 0, bz, 1.4, h + cut + 10, d * 0.3, yaw, W, W, 1);
}
// A tower of curved glass: an ellipse in plan, its top sliced on a slant.
function curvedGlass(R, x, z, yaw, rx, rz, h, col, low = false) {
  const seg = low ? 10 : 22, cs = Math.cos(yaw), sn = Math.sin(yaw), Pt = (a, y) => { const u = Math.cos(a) * rx, v = Math.sin(a) * rz; return [x + u * cs + v * sn, y, z - u * sn + v * cs]; }, top = (a) => h + Math.sin(a) * rz * 0.5;
  const A = skyGlass(col, 0.46), B = mul(col, 1.05), v0 = [x, h, z];
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * TAU, a1 = ((i + 1) / seg) * TAU;
    R.quad(Pt(a1, 0), Pt(a0, 0), Pt(a0, top(a0)), Pt(a1, top(a1)), B, A);
    R.quad(Pt(a0, top(a0)), v0, v0, Pt(a1, top(a1)), mul(col, 1.3));
    R.quad(Pt(a1, top(a1)), v0, v0, Pt(a0, top(a0)), mul(col, 1.3));
  }
}
// A slab with a real grid of windows: the cream hotels and banks of the sixties and seventies round the roundabout.
function gridSlab(R, x, z, yaw, w, d, h, wall, win, cols, rows, { base = 0, crown = true, low = false } = {}) {
  const cs = Math.cos(yaw), sn = Math.sin(yaw);
  R.box(x, base, z, w, h, d, yaw, wall, mul(wall, 1.05), 0.94);
  if (low) { const fh = (h - base) / Math.min(rows, 8); for (let i = 0; i < Math.min(rows, 8); i++) { R.box(x, base + i * fh + fh * 0.25, z, w + 0.3, fh * 0.45, d + 0.3, yaw, mul(win, lerp(0.95, 1.1, i / rows)), mul(wall, 1.05), 1); } return; }
  const ch = (h - base - 2) / rows, cw = w / cols, dw = d / Math.max(2, Math.round(d / cw));
  for (const s of [-1, 1]) {
    const fy = s > 0 ? yaw : yaw + Math.PI, fx = x + sn * s * d / 2, fz = z + cs * s * d / 2;
    for (let i = 0; i < rows; i++) R.panel(fx, base + 1 + i * ch + ch * 0.2, fz, w * 0.96, ch * 0.56, fy, mul(win, lerp(0.92, 1.1, i / rows)), 0.06);
    for (let q = 0; q <= cols; q++) { const u = (q / cols - 0.5) * w * 0.96; R.panel(fx + Math.cos(fy) * u, base, fz - Math.sin(fy) * u, cw * 0.26, h - base, fy, mul(wall, 1.03), 0.09); }
    const gx = x + cs * s * w / 2, gz = z - sn * s * w / 2, gy = yaw + s * Math.PI / 2, nd = Math.max(2, Math.round(d / cw));
    for (let i = 0; i < rows; i += 1) R.panel(gx, base + 1 + i * ch + ch * 0.2, gz, d * 0.9, ch * 0.56, gy, mul(win, lerp(0.86, 1.02, i / rows)), 0.06);
    for (let q = 0; q <= nd; q++) { const u = (q / nd - 0.5) * d * 0.9; R.panel(gx + Math.cos(gy) * u, base, gz - Math.sin(gy) * u, dw * 0.28, h - base, gy, mul(wall, 1.0), 0.09); }
  }
  if (crown) R.box(x, h, z, w * 0.5, 3.4, d * 0.5, yaw, mul(wall, 0.96));
}
// Hotel Indonesia: the long low teal glass front with the scalloped roof, right on the roundabout. It has been called the first thing the country showed the world.
function hotelIndonesia(R, x, z, yaw, low = false) {
  const G = c('#2f8f86'), GL = c('#4fb0a2'), W = c('#eef2ec'), cs = Math.cos(yaw), sn = Math.sin(yaw), L = 116, d = 26, H = 34, P = (a, b, y) => [x + a * cs + b * sn, y, z - a * sn + b * cs];
  R.box(x, 0, z, L, 6.5, d + 6, yaw, c('#e4ddcc'), null, 0.85);
  const rows = low ? 4 : 8, fh = (H - 7) / rows;
  for (let i = 0; i < rows; i++) {
    R.box(x, 7 + i * fh, z, L, fh * 0.72, d, yaw, mul(G, lerp(0.92, 1.12, i / rows)), null, 1);
    R.box(x, 7 + i * fh + fh * 0.72, z, L + 0.5, fh * 0.28, d + 0.5, yaw, GL, GL, 1);
  }
  // the wave along the top: a row of low arches
  const arches = low ? 8 : 16, seg = low ? 2 : 5, AW = L / arches;
  for (let i = 0; i < arches; i++) {
    for (let k = 0; k < seg; k++) {
      const u0 = k / seg, u1 = (k + 1) / seg, a0 = -L / 2 + (i + u0) * AW, a1 = -L / 2 + (i + u1) * AW, y0 = H + 4.6 * Math.sin(u0 * Math.PI), y1 = H + 4.6 * Math.sin(u1 * Math.PI);
      R.quad(P(a0, d / 2 + 0.3, H), P(a1, d / 2 + 0.3, H), P(a1, d / 2 + 0.3, y1), P(a0, d / 2 + 0.3, y0), W);
      R.quad(P(a1, -d / 2 - 0.3, H), P(a0, -d / 2 - 0.3, H), P(a0, -d / 2 - 0.3, y0), P(a1, -d / 2 - 0.3, y1), W);
      R.quad(P(a1, d / 2 + 0.3, y1), P(a1, -d / 2 - 0.3, y1), P(a0, -d / 2 - 0.3, y0), P(a0, d / 2 + 0.3, y0), mul(W, 0.94));
    }
  }
  R.box(x, 6.4, z, L + 1.2, 0.8, d + 7, yaw, WHITE);
  if (!low) { const fx = x + sn * (d / 2 + 3), fz = z + cs * (d / 2 + 3); R.sign('HOTEL', fx, 2.6, fz, yaw, 46, 3, WHITE, c('#23705f'), 0.2); }
}
// The stadium in Senayan: white steel ribs raking up to a great floating ring of a roof, the temu gelang, all in pale metal, in its own wood.
function stadium(low = false) {
  const R = new Raw(), seg = low ? 28 : 84, A = 1, Bz = 0.82, W = c('#eeece4'), WD = c('#c8c6be'), DK = c('#7c7e84'), RF = c('#d8dcda'), RF2 = c('#bcc4c4'), UN = c('#6a6e74');
  const P = (a, r, y) => [Math.cos(a) * r * A, y, Math.sin(a) * r * Bz];
  for (let i = 0; i < seg; i++) {
    const a0 = i / seg * TAU, a1 = (i + 1) / seg * TAU;
    // the base: a dark concourse behind the columns, then the back of the stands, pale, rising in
    R.quad(P(a1, 134, 0), P(a0, 134, 0), P(a0, 134, 13), P(a1, 134, 13), DK, mul(DK, 1.1));
    R.quad(P(a1, 134, 13), P(a0, 134, 13), P(a0, 126, 40), P(a1, 126, 40), mul(WD, i % 2 ? 0.98 : 0.92), W);
    // the concourse balcony, a clean white line round the whole bowl
    R.quad(P(a1, 140, 11.6), P(a0, 140, 11.6), P(a0, 140, 13.2), P(a1, 140, 13.2), WD, W);
    R.quad(P(a1, 140, 13.2), P(a0, 140, 13.2), P(a0, 134, 13.2), P(a1, 134, 13.2), W);
    R.quad(P(a0, 140, 11.6), P(a1, 140, 11.6), P(a1, 134, 11.6), P(a0, 134, 11.6), mul(DK, 0.8));
    // the ring: eave, top in long ribbed plates, inner lip; the underside dark
    const tone = i % 2 ? RF : RF2;
    R.quad(P(a1, 156, 38), P(a0, 156, 38), P(a0, 156, 41.5), P(a1, 156, 41.5), WD, W);
    R.quad(P(a1, 156, 41.5), P(a0, 156, 41.5), P(a0, 120, 51), P(a1, 120, 51), mul(tone, 1.02), tone);
    R.quad(P(a1, 120, 51), P(a0, 120, 51), P(a0, 94, 47), P(a1, 94, 47), tone, mul(tone, 0.96));
    R.quad(P(a0, 156, 38), P(a1, 156, 38), P(a1, 94, 46), P(a0, 94, 46), UN);
  }
  // the raking ribs, in pairs, and the diagonals between them that give the great wheel its lace
  const ribs = low ? 14 : 42;
  for (let i = 0; i < ribs; i++) {
    const a = i / ribs * TAU, a2 = (i + 1) / ribs * TAU, t = low ? 3 : 2.1;
    R.bar(P(a, 150, 0), P(a, 148, 39), t, WD, W);
    if (!low) {
      R.bar(P(a, 150, 13), P(a2, 144, 26), 0.8, W);
      R.bar(P(a2, 150, 13), P(a, 144, 26), 0.8, W);
      R.bar(P(a, 148, 26), P(a2, 142, 38), 0.7, W);
      R.bar(P(a2, 148, 26), P(a, 142, 38), 0.7, W);
    }
    for (let k = 0; k < (low ? 1 : 2); k++) { const b = a + (k / 2) * (TAU / ribs); R.bar(P(b, 148, 39), P(b, 126, 44), 0.8, W); }
  }
  // a flag or two on the ring
  return R.geometry();
}
// Pancoran: a tall arched column with a bronze flying figure leaning into the wind.
function dirgantara() {
  const P = [], S = '#d9d6cc', B = '#7f5f3a';
  const pts = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector3(-12 + 26 * t ** 1.5, 62 * t, 0)); }
  P.push(paint(lathe([[7, 0], [5.6, 6], [4, 8]], 12), S));
  for (let i = 0; i < 12; i++) {
    const a = pts[i], b = pts[i + 1], m = a.clone().add(b).multiplyScalar(0.5), L = a.distanceTo(b), ang = Math.atan2(b.x - a.x, b.y - a.y);
    P.push(paint(place(cylinder(1.6, 2.8 - i * 0.1, L + 0.6, 8), { p: [m.x, m.y, m.z], r: [0, 0, -ang] }), S));
  }
  P.push(paint(place(capsule(1.4, 6, 3, 8), { p: [17, 66, 0], r: [0, 0, -1.1] }), B), paint(place(sphere(1.5, 8, 6), { p: [21.6, 69, 0] }), B));
  for (const s of [-1, 1]) P.push(paint(place(capsule(0.5, 4.4, 2, 6), { p: [19, 68, s * 2.6], r: [s * 0.8, 0, -0.9] }), B));
  return merge(P);
}

// ---------- the city on the two sides of the road ----------
const SEMANGGI = [-860, 2680];
// The view from the start: the whole race starts by looking down this line at the Monas, so nothing built stands in it.
function monasView(x, z, MAP) {
  const ax = 340 * MAP, az = 510 * MAP, dx = -ax, dz = -az, L2 = dx * dx + dz * dz, t = ((x - ax) * dx + (z - az) * dz) / L2;
  if (t < 0 || t > 1.1) return false;
  const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
  return d < lerp(26, 92, t);
}
export function plan(ctx) {
  const { track, world } = ctx, def = track.def, MAP = def.mapScale, S = track.samples;
  const at = (x, z) => [x * MAP, z * MAP];
  const K = world.keepOut, G = world.groves, F = world.plant;
  const RAIN = [['rain', 0.55], ['angsana', 0.25], ['palm', 0.2]];
  // Monas square: lawns with trees of every province, clear round the monument
  G.push({ x: 0, z: 0, r: 330 * MAP, cover: 0.55, kinds: [['rain', 0.3], ['cemara', 0.3], ['angsana', 0.2], ['palm', 0.2]] });
  K.push({ x: 0, z: 0, r: 150 * MAP });
  // Three streets look across the lawn at it. Only the quarter that no street looks through, the south west, keeps its wood; a monument behind a grove is any boulevard next to a park.
  for (let x = -280; x <= 280; x += 36) for (let z = -300; z <= 300; z += 36) if (!(x < -20 && z > 20)) K.push({ x, z, r: 30 });
  // Menteng, leafy all the way
  for (const [x, z, r] of [[620, 720, 190], [420, 880, 210], [720, 860, 170], [260, 760, 170], [640, 1040, 170], [480, 610, 110]]) { const [a, b] = at(x, z); G.push({ x: a, z: b, r, cover: 1.4, kinds: RAIN }); }
  // inside the clover of Semanggi the city leaves a wood, and Senayan has its own round the stadium
  { const [a, b] = at(...SEMANGGI); G.push({ x: a, z: b, r: 70, cover: 1.6, kinds: [['rain', 0.5], ['angsana', 0.3], ['palm', 0.2]] }); }
  { const [a, b] = at(-1250, 2820); G.push({ x: a, z: b, r: 200, cover: 1.2, kinds: [['rain', 0.6], ['angsana', 0.2], ['cemara', 0.2]] }); K.push({ x: a, z: b, r: 150 }); }
  // tree cover in the wide city: from above Jakarta is greener than anyone expects
  const coverAt = [];
  for (let i = 0; i < 60; i++) {
    const x = (hash3(i, 3, 7) - 0.5) * 3600 + 100, z = hash3(i, 4, 7) * 4000 - 400, r = 50 + hash3(i, 5, 7) * 90;
    if (track.long && world.terrain.roadDistAt(x, z) < 60) continue;
    G.push({ x, z, r, cover: 1.2, kinds: RAIN }); coverAt.push({ x, z, r });
  }
  // the avenues have their rain trees and royal palms, in lines on the pavements
  // the lean of the two streets, on the lawn's side: the x at which the road's centre runs, by z
  const inSquare = (z) => (z > 0 ? lerp(240, 283, Math.min(1, z / 352)) : lerp(240, 300, Math.min(1, -z / 300)));
  const lineTrees = (a, b, every, off, kind = 'rain', sides = [-1, 1]) => {
    for (let m = a; m < b; m += every) {
      const i = Math.round(m / track.step) % track.n, hw = S.w[i] / 2;
      for (const s of sides) {
        const jit = (hash3(m, s, 3) - 0.5) * 2, x = S.x[i] + S.nx[i] * s * (hw + off + jit), z = S.z[i] + S.nz[i] * s * (hw + off + jit);
        if (monasView(x, z, MAP)) continue;
        // along the square, only on its far side: none between the road and the monument
        if (Math.abs(x) < inSquare(z) && Math.abs(z) < 300) continue;
        F.push({ x, z, kind, h: (kind === 'palm' ? 14 : 8) + hash3(m, s, 5) * 5 });
      }
    }
  };
  const m = (name, off = 0) => track.pointU[def.marks[name]] * track.length + off;
  lineTrees(m('thamrin'), m('hi', -30), 34, 8);
  lineTrees(m('thamrin', 17), m('hi', -30), 68, 8, 'palm');
  lineTrees(m('sudirman'), m('semanggi', -30), 40, 8);
  lineTrees(m('merdeka'), m('thamrin'), 88, 8);
  lineTrees(m('merdeka', 44), m('thamrin'), 88, 8, 'palm');
  lineTrees(30, m('merdeka'), 26, 7);
  lineTrees(m('menteng'), track.length - 10, 26, 7);
  // the way the road looks at the Monas from the start stays open
  for (let t = 0.2; t < 1; t += 0.06) { const [a, b] = at(530 * t, 780 * t); K.push({ x: a, z: b, r: 34 + 46 * (1 - t) }); }
  const B = hi(track, def);
  K.push({ x: B.x, z: B.z, r: 56 });
  // no crown in the chase camera's face as it swings round the fountain
  for (let mm = m('hi', -60); mm < m('sudirman', 160); mm += 14) {
    const i = Math.round(mm / track.step) % track.n, hw = S.w[i] / 2;
    for (const s of [-1, 1]) K.push({ x: S.x[i] + S.nx[i] * s * (hw + 10), z: S.z[i] + S.nz[i] * s * (hw + 10), r: 13 });
  }
  // nothing grows up through the toll road's deck or into the face of a chase camera up there
  for (let mm = m('semanggi', 60); mm < m('saharjo', 0); mm += 16) {
    const i = Math.round(mm / track.step) % track.n;
    K.push({ x: S.x[i], z: S.z[i], r: S.w[i] / 2 + 15 });
  }
  world.mapAt = at;
  // The city is paved. Only the square, the leafy streets of Menteng, the clover and Senayan are green; all else is worn concrete and old asphalt, and there is no lawn in a kampung.
  const inKampung = (x, z) => { const ka = m('kampung'), kb = m('menteng', -10), Z = track.nearest(x, z); const mm = Z.u * track.length; return mm > ka - 20 && mm < kb + 20 && Math.abs(Z.d) < 160; };
  const greens = [{ x: 0, z: 0, r: 318 * MAP }, { x: SEMANGGI[0] * MAP, z: SEMANGGI[1] * MAP, r: 52 }, { x: -1250 * MAP, z: 2820 * MAP, r: 240 }, ...[[620, 720, 190], [420, 880, 210], [720, 860, 170], [260, 760, 170], [640, 1040, 170], [480, 610, 110]].map(([x, z, r]) => ({ x: x * MAP, z: z * MAP, r: r * 0.92 })), ...coverAt.filter((g) => g.r > 60 && g.r < 150 && !inKampung(g.x, g.z)).map((g) => ({ x: g.x, z: g.z, r: g.r * 0.7 }))];
  const CON = [c('#7f7b74'), c('#77736d'), c('#86827a')];
  world.paintAt = (x, z) => {
    let g = 1;
    // the square is a square: lawn out to the railing on all four sides
    { const dd = Math.max(Math.abs(x) - inSquare(z), Math.abs(z) - 290); if (dd < 12) { g = Math.max(0, dd / 12); if (!g) return null; } }
    for (const q of greens) { const dd = Math.hypot(x - q.x, z - q.z) - q.r; if (dd < 18) { g = Math.min(g, Math.max(0, dd / 18)); if (!g) return null; } }
    const t = CON[Math.abs(Math.floor(x / 11) + Math.floor(z / 13)) % 3];
    return [t[0], t[1], t[2], 0.94 * g];
  };
}

function hi(track, def) { const M = def.mapScale; return { x: -248 * M, z: 1192 * M }; }

export function build(ctx) {
  const { THREE: _T, track, terrain, batch, world, look, mat } = ctx, def = track.def, S = track.samples, n = track.n, MAP = def.mapScale;
  const m = (name, off = 0) => track.pointU[def.marks[name]] * track.length + off, ground = world.ground;
  const F = new Blocks(300);
  const at = (mm) => { const i = ((Math.round(mm / track.step) % n) + n) % n; return { i, x: S.x[i], y: S.y[i], z: S.z[i], tx: S.tx[i], tz: S.tz[i], nx: S.nx[i], nz: S.nz[i], w: S.w[i], hw: S.w[i] / 2 }; };
  const roadYaw = (p) => Math.atan2(p.tx, p.tz);
  const off = (p, d) => [p.x + p.nx * d, p.z + p.nz * d];
  // a clear lot: nothing but open ground for this footprint, away from every other stretch of road
  const clear = (x, z, r) => terrain.roadDistAt(x, z) > r && !monasView(x, z, MAP);
  const zone = (mm) => (mm < m('merdeka') ? 'menteng' : mm < m('thamrin') ? 'square' : mm < m('hi') ? 'tower' : mm < m('sudirman') ? 'hi' : mm < m('semanggi') ? 'canyon' : mm < m('ramp') ? 'tol' : mm < m('saharjo') ? 'ramp' : mm < m('crossing') ? 'ruko' : mm < m('menteng') ? 'kampung' : 'menteng');
  const hx = -248 * MAP, hz = 1192 * MAP;
  // where Sudirman has its slip roads: clear of the malls of the roundabout, the underpass and the spiral
  const SLIP_OUT = 7.4, slipAt = (mm) => zone(mm) === 'canyon' && mm > m('sudirman', 170) && (mm < m('dukuh', -80) || mm > m('dukuh', 225)) && mm < m('semanggi', -30);
  // how far a spot is from the Ciliwung, by its own points
  const rv = terrain.river, riverD = (x, z) => { let b = 1e9; if (rv) for (let i = 0; i < rv.xs.length; i += 6) { const q = (rv.xs[i] - x) ** 2 + (rv.zs[i] - z) ** 2; if (q < b) b = q; } return Math.sqrt(b); };

  // ---- pavements and kerbs: paving down each side of every road on the ground, standing on a real kerb. A kampung has a gutter, not a pavement ----
  const pave = new Blocks(300);
  for (let mm = 0; mm < track.length; mm += 6) {
    const p = at(mm), q = at(mm + 6);
    if (track.structureAt(p.i) === 'viaduct' || track.structureAt(p.i) === 'bridge') continue;
    const z2 = zone(mm), kampung = z2 === 'kampung', wide = kampung ? 1.15 : z2 === 'canyon' || z2 === 'tower' ? 8 : 5, slip = slipAt(mm), in0 = slip ? SLIP_OUT : 0.05, out0 = slip ? SLIP_OUT + 5.6 : wide;
    // Sudirman in section: the carriageway, a planted separator, a slip road of its own, then the pavement
    if (slip) for (const s of [-1, 1]) {
      const R0 = pave.at(p.x, p.z).full, Pa = (d, h) => [p.x + p.nx * s * (p.hw + d), p.y + h, p.z + p.nz * s * (p.hw + d)], Pb = (d, h) => [q.x + q.nx * s * (q.hw + d), q.y + h, q.z + q.nz * s * (q.hw + d)];
      const strip = (d0, d1, h, col) => { if (s > 0) R0.quad(Pa(d0, h), Pa(d1, h), Pb(d1, h), Pb(d0, h), col); else R0.quad(Pa(d1, h), Pa(d0, h), Pb(d0, h), Pb(d1, h), col); };
      // the separator: a low kerb round a green bed, and clipped bushes with gaps between
      strip(0.05, 0.28, 0.22, c('#c8c2b2')); strip(0.28, 1.72, 0.2, c('#3c6636')); strip(1.72, 1.95, 0.22, c('#c8c2b2'));
      if (s > 0) { R0.quad(Pa(0.05, 0), Pa(0.05, 0.22), Pb(0.05, 0.22), Pb(0.05, 0), c('#8f8a7c')); } else { R0.quad(Pa(0.05, 0.22), Pa(0.05, 0), Pb(0.05, 0), Pb(0.05, 0.22), c('#8f8a7c')); }
      if (Math.floor(mm / 6) % 3 !== 2) { const a = Pa(1, 0), b = Pb(1, 0); R0.hedge(a[0], a[2], b[0], b[2], s, Math.floor(mm)); }
      // the slip road: worn tar, its edge line, its own wandering stain
      strip(1.95, SLIP_OUT, 0.03, mul(c('#4c4950'), 0.97 + 0.08 * hash3(mm, s, 301)));
      if (Math.floor(mm / 6) % 2) strip(SLIP_OUT - 0.4, SLIP_OUT - 0.28, 0.04, c('#b8b4a4'));
    }
    const R = pave.at(p.x, p.z).full, lift = kampung ? 0.05 : 0.16;
    for (const s of [-1, 1]) {
      const a0 = s * (p.hw + in0), a1 = s * (p.hw + out0), b0 = s * (q.hw + in0), b1 = s * (q.hw + out0), y = p.y + lift, y2 = q.y + lift, col = kampung ? mul(c('#a8a498'), (Math.floor(mm / 18) & 1) ? 1 : 0.94) : (Math.floor(mm / 12) & 1) ? PAVE : mul(PAVE, 0.95);
      const A0 = [p.x + p.nx * a0, y, p.z + p.nz * a0], A1 = [p.x + p.nx * a1, y, p.z + p.nz * a1], B1 = [q.x + q.nx * b1, y2, q.z + q.nz * b1], B0 = [q.x + q.nx * b0, y2, q.z + q.nz * b0], side = s > 0 ? mul(col, 0.97) : col;
      if (s > 0) R.quad(A0, A1, B1, B0, side); else R.quad(A1, A0, B0, B1, side);
      // the kerb and the outer face, so a pavement is a slab with thickness all round and never a sheet floating over the ground
      const low0 = [A0[0], y - 0.5, A0[2]], low1 = [B0[0], y2 - 0.5, B0[2]], lowa = [A1[0], y - 0.5, A1[2]], lowb = [B1[0], y2 - 0.5, B1[2]], KC = mul(col, 0.74), KO = mul(col, 0.82);
      if (s > 0) { R.quad(low1, low0, A0, B0, KC); R.quad(lowa, lowb, B1, A1, KO); } else { R.quad(low0, low1, B0, A0, KC); R.quad(lowb, lowa, A1, B1, KO); }
      // the outer kerbstone, in a tone between the paving and what lies past it, so that the last edge of the pavement is not a hard line against the grass
      if (!kampung) {
        // the paving itself: a guide line of yellow blocks, as every Indonesian pavement has, and the joint at the end of each run of slabs
        const lay = 0.012, Dq = (r0, r1, tone) => { const qa = [p.x + p.nx * r0, y + lay, p.z + p.nz * r0], qb = [p.x + p.nx * r1, y + lay, p.z + p.nz * r1], qc = [q.x + q.nx * r1, y2 + lay, q.z + q.nz * r1], qd = [q.x + q.nx * r0, y2 + lay, q.z + q.nz * r0]; if (s > 0) R.quad(qa, qb, qc, qd, tone); else R.quad(qb, qa, qd, qc, tone); };
        Dq(s * (p.hw + in0 + 1.2), s * (p.hw + in0 + 1.55), c('#c9ae58'));
        { const j = (w0) => [p.x + p.nx * w0, y + lay, p.z + p.nz * w0], t = 0.07, J = mul(col, 0.78), ja = j(a0), jb = j(a1), jc = [jb[0] + p.tx * t, y + lay, jb[2] + p.tz * t], jd = [ja[0] + p.tx * t, y + lay, ja[2] + p.tz * t]; if (s > 0) R.quad(ja, jb, jc, jd, J); else R.quad(jb, ja, jd, jc, J); }
        const K0 = [p.x + p.nx * (a1 + s * 0.42), y, p.z + p.nz * (a1 + s * 0.42)], K1 = [q.x + q.nx * (b1 + s * 0.42), y2, q.z + q.nz * (b1 + s * 0.42)], KT = mul(col, 0.72);
        if (s > 0) R.quad(A1, K0, K1, B1, KT); else R.quad(K0, A1, B1, K1, KT);
      }
    }
  }
  pave.flush(batch);

  // ---- busway lines on Thamrin and Sudirman, and the painted zebra crossings ----
  const lines = new Blocks(300);
  const paint2 = (mm, d0, d1, len, col, lay = 0.05) => {
    const p = at(mm), q = at(mm + len), y = track.heightAt(p.i, (d0 + d1) / 2) + lay, y2 = track.heightAt(q.i, (d0 + d1) / 2) + lay, R = lines.at(p.x, p.z).full;
    R.quad([p.x + p.nx * d0, y, p.z + p.nz * d0], [q.x + q.nx * d0, y2, q.z + q.nz * d0], [q.x + q.nx * d1, y2, q.z + q.nz * d1], [p.x + p.nx * d1, y, p.z + p.nz * d1], col);
  };
  const BUSC = c('#55535a'), SEPA = c('#d8d2c2'), BUSD = c('#3a383e');
  for (const [a, b] of [[m('thamrin', 10), m('hi', -40)], [m('sudirman', 6), m('semanggi', -6)]]) {
    for (let mm = a; mm < b; mm += 7) for (const s of [-1, 1]) {
      // the busway: a lane laid in pale concrete, its joints, and a separator of low blocks either side with a gap every so often
      paint2(mm, s * 0, s * 1.85, 7, mul(BUSC, 0.97 + 0.06 * hash3(mm, s, 303)), 0.035);
      paint2(mm, s * 1.85, s * 2.2, 5.6, SEPA, 0.06);
      paint2(mm + 5.6, s * 1.85, s * 2.2, 1.4, BUSD, 0.06);
      if (Math.floor(mm / 7) % 2) { paint2(mm, s * 6, s * 6.14, 4, WHITE); paint2(mm, s * 2.7, s * 2.84, 4, WHITE); }
    }
    for (let mm = a + 240; mm < b; mm += 420) for (let d = -9; d < 9; d += 2) paint2(mm, d, d + 1.1, 5, WHITE);
  }
  // What a real road has on it, all flat on the asphalt: BUSWAY in the bus lane, arrows, manholes, the snakes of tar where a crack was sealed, oil down the middle of each lane. No patch with a square edge.
  {
    // the road's own shader lights asphalt lower than a plain lit quad: these colours are set by eye against it, not from it
    const TAR = c('#47444d'), OIL = c('#403e46'), DARKIRON = c('#4f4d53'), RIM = c('#6c6a70'), PATCHD = c('#46434a'), PATCHL = c('#504d55'), GANG = [c('#5c584e'), c('#55514a'), c('#625e54'), c('#47443e')];
    const flatQuad = (R, a, b, d, e, col) => {
      const ux = b[0] - a[0], uz = b[2] - a[2], vx = d[0] - a[0], vz = d[2] - a[2];
      if (uz * vx - ux * vz > 0) R.quad(a, b, d, e, col); else if (d[0] === e[0] && d[2] === e[2]) R.quad(a, d, b, b, col); else R.quad(a, e, d, b, col);
    };
    const flatWord = (word, mm, dc, h, stretch, col) => {
      const p = at(mm), y = track.heightAt(p.i, dc) + 0.055, R = lines.at(p.x, p.z).full, M = (q) => { const X = q[0], Y = q[1] * stretch; return [p.x + p.nx * (dc - X) + p.tx * Y, y, p.z + p.nz * (dc - X) + p.tz * Y]; };
      writeText((a, b, d, e) => flatQuad(R, M(a), M(b), M(d), M(e), col), word, 0, 0, 0, 0, h, { weight: 0.2, slant: 0, fit: 3.2 });
    };
    const arrow = (mm, dc, col) => {
      const p = at(mm), y = track.heightAt(p.i, dc) + 0.055, R = lines.at(p.x, p.z).full, P = (a, b) => [p.x + p.nx * (dc + a) + p.tx * b, y, p.z + p.nz * (dc + a) + p.tz * b];
      flatQuad(R, P(-0.14, 0), P(0.14, 0), P(0.14, 2.6), P(-0.14, 2.6), col);
      flatQuad(R, P(-0.52, 2.6), P(0.52, 2.6), P(0, 4.4), P(0, 4.4), col);
    };
    const disc = (R, x, y, z, r, col, seg = 12) => { for (let i = 1; i + 1 < seg; i++) { const A = (q) => [x + Math.cos(q / seg * TAU) * r, y, z + Math.sin(q / seg * TAU) * r]; flatQuad(R, A(0), A(i), A(i + 1), A(i + 1), col); } };
    for (let mm = 12; mm < track.length; mm += 26) {
      const p = at(mm), z2 = zone(mm), r = (q) => hash3(mm, q, 41), R = lines.at(p.x, p.z).full, kampung = z2 === 'kampung', hw = p.hw - 1.4;
      // an uneven polygon of other tar, the mark of a trench dug and filled: stretched along the road, no two alike
      const poly = (d0, ra, rb, col, lay = 0.045, seed = 0) => {
        const y = track.heightAt(p.i, d0) + lay, N = 7, A = (q) => { const a = q / N * TAU, k = 0.72 + 0.5 * hash3(mm + seed, q, 43); return [p.x + p.nx * (d0 + Math.cos(a) * ra * k) + p.tx * Math.sin(a) * rb * k, y, p.z + p.nz * (d0 + Math.cos(a) * ra * k) + p.tz * Math.sin(a) * rb * k]; };
        for (let i = 1; i + 1 < N; i++) flatQuad(R, A(0), A(i), A(i + 1), A(i + 1), col);
      };
      if (kampung) {
        // the gang is worn out: concrete poured over it, mud, damp along both edges
        for (let q = 0; q < 9; q++) poly((hash3(mm, q, 44) * 2 - 1) * (p.hw - 0.6), 0.16 + hash3(mm, q, 45) * 0.42, 0.25 + hash3(mm, q, 46) * 0.8, GANG[Math.floor(hash3(mm, q, 47) * 4)], 0.045, q * 13);
        for (const e of [-1, 1]) for (let q = 0; q < 8; q++) { const a = at(mm + q * 3.25), b = at(mm + (q + 1) * 3.25), wa = 0.55 + 0.4 * hash3(mm, q + e, 48), wb = 0.55 + 0.4 * hash3(mm, q + 1 + e, 48), ya = track.heightAt(a.i, e * a.hw) + 0.04, yb = track.heightAt(b.i, e * b.hw) + 0.04; flatQuad(R, [a.x + a.nx * e * a.hw, ya, a.z + a.nz * e * a.hw], [a.x + a.nx * e * (a.hw - wa), ya, a.z + a.nz * e * (a.hw - wa)], [b.x + b.nx * e * (b.hw - wb), yb, b.z + b.nz * e * (b.hw - wb)], [b.x + b.nx * e * b.hw, yb, b.z + b.nz * e * b.hw], GANG[3]); }
        continue;
      }
      if (r(9) < 0.4) poly((r(10) * 2 - 1) * hw, 0.35 + r(11) * 0.6, 0.7 + r(12) * 1.5, r(13) < 0.6 ? PATCHD : PATCHL);
      // tar snakes, wandering
      if (r(1) < 0.62) {
        let d = (r(2) * 2 - 1) * hw, q = p;
        const len = 3 + Math.floor(r(3) * 4);
        for (let k = 0; k < len; k++) {
          const q2 = at(mm + (k + 1) * 3.2), d2 = d + (hash3(mm, k, 42) - 0.5) * 1.1, y = track.heightAt(q.i, d) + 0.05, y2 = track.heightAt(q2.i, d2) + 0.05;
          flatQuad(R, [q.x + q.nx * (d - 0.035), y, q.z + q.nz * (d - 0.035)], [q.x + q.nx * (d + 0.035), y, q.z + q.nz * (d + 0.035)], [q2.x + q2.nx * (d2 + 0.035), y2, q2.z + q2.nz * (d2 + 0.035)], [q2.x + q2.nx * (d2 - 0.035), y2, q2.z + q2.nz * (d2 - 0.035)], TAR);
          d = d2; q = q2;
        }
      }
      // a manhole now and then
      if (r(4) < 0.12) { const d = (r(5) * 2 - 1) * hw, x = p.x + p.nx * d, z = p.z + p.nz * d, y = track.heightAt(p.i, d) + 0.05; disc(R, x, y, z, 0.62, RIM); disc(R, x, y + 0.004, z, 0.5, DARKIRON); }
      // oil, where everything stands in the queue
      if (r(6) < 0.35) { const d = (r(7) * 2 - 1) * hw, x = p.x + p.nx * d, z = p.z + p.nz * d, y = track.heightAt(p.i, d) + 0.05; disc(R, x, y, z, 0.3 + r(8) * 0.4, OIL, 8); }
    }
    for (const [a, b] of [[m('thamrin', 10), m('hi', -40)], [m('sudirman', 6), m('semanggi', -6)]]) {
      for (let mm = a + 70; mm < b - 10; mm += 150) if (!track.structureAt(at(mm).i)) flatWord('BUSWAY', mm, 0, 0.66, 3.2, WHITE);
      for (let mm = a + 110; mm < b - 10; mm += 150) for (const dc of [-4.4, 4.4]) if (!track.structureAt(at(mm).i)) arrow(mm, dc, WHITE);
    }
  }
  lines.flush(batch);

  // ---- towers on Thamrin and Sudirman, in rows set back behind the pavement ----
  // The shapes people point at, each standing right behind the front row where the road looks at it: Sudirman and the toll road are known by these and by nothing else.
  const NAMED = [
    [penTower, m('sudirman', 330), 1, 48, 170], [darkSlab, m('sudirman2', 40), -1, 46, 150], [twinPortal, m('sudirman2', 260), 1, 52, 190], [wedgeTower, m('sudirman2', 470), -1, 46, 200], [darkSlab, m('sudirman2', 660), 1, 50, 165],
    [darkSlab, m('tol', 200), 1, 66, 140], [twinPortal, m('tolgate', 60), -1, 66, 175], [wedgeTower, m('tolgate', 330), 1, 66, 185],
  ].map(([fn, mm, s0, away, h]) => { const p = at(mm), [x, z] = off(p, s0 * (p.hw + away)); return { fn, x, z, yaw: roadYaw(p) + (fn === penTower ? 0.5 : 0), h }; });
  const row = (from, to, every, off0, seed, hMin, hMax, rows = 2, darkShare = 0.72) => {
    for (let mm = from; mm < to; mm += every) {
      const p = at(mm);
      for (const s of [-1, 1]) for (let q = 0; q < rows; q++) {
        const sd = hash3(mm, s * 2 + q, seed), w = 24 + sd * 18, d = 22 + hash3(mm, q, seed + 1) * 16, dist = p.hw + off0 + q * 62 + hash3(s, mm, seed + 2) * 12;
        const [x, z] = off(p, s * dist);
        if (!clear(x, z, Math.max(w, d) * 0.72 + 2)) continue;
        if (Math.hypot(x - hx, z - hz) < 165 || NAMED.some((q) => Math.hypot(x - q.x, z - q.z) < 66)) continue;
        const h = lerp(hMin, hMax, hash3(mm, s + q, seed + 3) ** (q ? 1 : 1.4)) * (q ? 1.15 : 1);
        tower(F.at(x, z), x, z, roadYaw(p), w, d, h, Math.floor(mm) + s * 3 + q, { plain: q > 0, back: q > 1, side: -s, dark: hash3(mm, s + q, seed + 9) < darkShare });
        batch.blob(x, z, Math.max(w, d) * 0.75, 0.5);
      }
    }
  };
  row(m('thamrin', 40), m('hi', -40), 58, 25, 3, 34, 120);
  row(m('sudirman', 20), m('sudirman2', 0), 60, 25, 5, 50, 170, 3);
  row(m('sudirman2', 0), m('semanggi', -60), 112, 25, 6, 50, 170, 2);
  row(m('tolgate', -260), m('ramp', 40), 110, 40, 7, 30, 120, 1, 0.55);

  // ---- shophouses all along the lower roads ----
  const rukoRow = (from, to, seed) => {
    for (const s of [-1, 1]) {
      for (let mm = from; mm < to;) {
        const p = at(mm), w = 5.6 + hash3(mm, seed, s) * 3.2;
        const [x, z] = off(p, s * (p.hw + 5 + 6));
        if (clear(x, z, 8)) ruko(F.at(x, z), x, z, roadYaw(p) + (s > 0 ? -Math.PI / 2 : Math.PI / 2), w, Math.floor(mm) + s, hash3(mm, s, 3) < 0.7);
        mm += w + 0.1;
      }
    }
  };
  rukoRow(m('ramp', 90), m('crossing', -24), 4);

  // ---- the kampung: stacked up against the lane on both sides, three rows deep, and on the river side they lean out over the water ----
  for (const s of [-1, 1]) {
    for (let mm = m('kampung', 4); mm < m('menteng', -6);) {
      const pp = at(mm), st = track.structureAt(pp.i), w = 4.4 + hash3(mm, s, 11) * 2.6;
      if (st) { mm += 6; continue; }
      for (let q = 0; q < 2; q++) {
        const d = 6.5 + hash3(mm, q, 12) * 2, dist = pp.hw + 1.25 + d / 2 + q * (d + 0.6) + (q ? hash3(mm, q, 13) * 0.8 : 0), [x, z] = off(pp, s * dist);
        if (terrain.roadDistAt(x, z) < d / 2 + 0.6) continue;
        const rd = riverD(x, z);
        if (rd < def.ground.river.w / 2 + 9.5 + d / 2) continue;
        // windows on the river: on the near bank a house gives way now and then, so that the lane sees the water
        if (q === 0 && rd < 34 && Math.floor(mm / 38) % 3 === 0) continue;
        rumah(F.at(x, z), x, z, roadYaw(pp) + (s > 0 ? -Math.PI / 2 : Math.PI / 2), w, d, Math.floor(mm * 3) + s * (q + 1), { front: q === 0, base: 0 });
      }
      mm += w + 0.08;
    }
  }
  // The Ciliwung: a canal between concrete walls, the ramshackle backs of the kampung built right up to the top of them, and now and then leaning out over the water.
  const RIVER_Y = -1.05;
  if (rv) {
    const bank = new Blocks(300), W0 = def.ground.river.w / 2, WL = terrain.waterLevel, TOP = 0.3, seen = new Set();
    for (let i = 0; i + 8 < rv.xs.length; i += 8) {
      const x0 = rv.xs[i], z0 = rv.zs[i], x1 = rv.xs[i + 8], z1 = rv.zs[i + 8], L = Math.hypot(x1 - x0, z1 - z0) || 1, tx = (x1 - x0) / L, tz = (z1 - z0) / L, nx = tz, nz = -tx;
      if (terrain.roadDistAt(x0, z0) > 420) continue;
      // The water itself, brown and slow, high in its bed where the lane can see it: strips with the current's streaks, and what floats down it. The sim's water lies far below this, so that the underpass stays dry.
      {
        const Rw = bank.at(x0, z0).full, N = 5, nxw = tz, nzw = -tx, Pw = (x, z, o, up = 0) => [x + nxw * o, RIVER_Y + up, z + nzw * o];
        for (let k = 0; k < N; k++) {
          const WW = W0 + 3.6, a = -WW + (k / N) * 2 * WW, b = -WW + ((k + 1) / N) * 2 * WW, t0 = 0.86 + 0.26 * hash3(i >> 8, k, 311), col = mul(k === 2 ? c('#a68d62') : k % 2 ? c('#8a6f47') : c('#6e5637'), t0);
          Rw.quad(Pw(x0, z0, b), Pw(x1, z1, b), Pw(x1, z1, a), Pw(x0, z0, a), col);
        }
        // the low sky lying on it in long thin glints down the current, and the dark of each bank mirrored at its edge
        for (let k = 0; k < 3; k++) { const o0 = (hash3(i, k, 313) - 0.5) * 2 * (W0 + 1), w2 = 0.18 + hash3(i, k, 314) * 0.5; Rw.quad(Pw(x0, z0, o0 + w2), Pw(x1, z1, o0 + w2), Pw(x1, z1, o0 - w2), Pw(x0, z0, o0 - w2), mix(c('#b9a57c'), c('#d8d4c4'), hash3(i, k, 315))); }
        for (const e of [-1, 1]) Rw.quad(Pw(x0, z0, e > 0 ? W0 + 3.6 : -W0 + 0.4), Pw(x1, z1, e > 0 ? W0 + 3.6 : -W0 + 0.4), Pw(x1, z1, e > 0 ? W0 - 0.4 : -W0 - 3.6), Pw(x0, z0, e > 0 ? W0 - 0.4 : -W0 - 3.6), c('#4f3f2a'));
        const hh = hash3(i, 9, 312);
        if (hh < 0.5) { const o = (hash3(i, 10, 312) - 0.5) * W0 * 1.4, [X, , Z] = Pw(x0, z0, o); Rw.blob(X, RIVER_Y + 0.04, Z, 0.34, 0.1, 0.5, hh < 0.2 ? c('#e8e4d8') : hh < 0.35 ? c('#3f78b8') : c('#c8562e'), c('#f4f0e4'), 5, 2); }
      }
      for (const s of [-1, 1]) {
        const R = bank.at(x0, z0).full, o = s * W0, tone = 0.92 + 0.12 * hash3(i, s, 5), col = mul(c('#7f7a6c'), tone), wet = mul(c('#5f5a4c'), tone), cap = mul(c('#8a8474'), tone);
        const P = (x, z, off, y) => [x + nx * off, y, z + nz * off];
        // the sloped revetment the city built after the floods, tide-marked, then a flat coping that covers the ground grid's teeth. A slope and not a wall: a kart on the lane can see the water
        const a0 = P(x0, z0, o, WL - 0.3), a1 = P(x1, z1, o, WL - 0.3), b0 = P(x0, z0, o + s * 6.4, TOP), b1 = P(x1, z1, o + s * 6.4, TOP), e0 = P(x0, z0, o + s * 9, TOP), e1 = P(x1, z1, o + s * 9, TOP);
        const mid = P((x0 + x1) / 2, (z0 + z1) / 2, o + s * 7, 0);
        if (terrain.roadDistAt(mid[0], mid[2]) < 3.5) { if (terrain.roadDistAt((b0[0] + a0[0]) / 2, (b0[2] + a0[2]) / 2) < 0.5) continue; }
        else if (s > 0) R.quad(b0, b1, e1, e0, cap, mul(cap, 0.96)); else R.quad(b1, b0, e0, e1, cap, mul(cap, 0.96));
        if (s > 0) R.quad(a0, a1, b1, b0, wet, col); else R.quad(a1, a0, b0, b1, wet, col);
      }
    }
    bank.flush(batch);
    // the houses on both banks, one row against the path and one behind
    for (let i = 0; i + 4 < rv.xs.length; i += 3) {
      const x0 = rv.xs[i], z0 = rv.zs[i], x1 = rv.xs[i + 3] ?? x0, z1 = rv.zs[i + 3] ?? z0, L = Math.hypot(x1 - x0, z1 - z0) || 1, tx = (x1 - x0) / L, tz = (z1 - z0) / L, nx = tz, nz = -tx;
      if (terrain.roadDistAt(x0, z0) > 240) continue;
      for (const s of [-1, 1]) for (let q = 0; q < 2; q++) {
        const seed = i * 7 + (s > 0 ? 1 : 0) + q * 3, d = 6.5 + hash3(seed, 1, 13) * 2, w = 4.6 + hash3(seed, 2, 13) * 2.4;
        if (hash3(seed, 3, 13) < 0.14) continue;
        const dist = W0 + 9.2 + d / 2 + q * (d + 0.5), x = x0 + nx * s * dist, z = z0 + nz * s * dist;
        const key = `${Math.round(x / 5)},${Math.round(z / 5)}`;
        if (seen.has(key) || terrain.roadDistAt(x, z) < d / 2 + w / 2 + 1 || monasView(x, z, MAP)) continue;
        seen.add(key);
        // its windows and its washing on the water
        rumah(F.at(x, z), x, z, Math.atan2(-nx * s, -nz * s), w, d, seed + 100, { front: true, base: 0 });
      }
    }
  }

  // ---- food stalls, plastic chairs and the mess of a real pavement ----
  const stall = (x, z, yaw, seed) => {
    const R = F.at(x, z).full, r = (q) => hash3(seed, q, 53), col = AWNING[Math.floor(r(1) * AWNING.length)], cs = Math.cos(yaw), sn = Math.sin(yaw);
    // the tarp, sagging a little, on four thin poles
    const w = 3.8, d = 3, h = 2.5;
    R.boxU(x, h, z, w, 0.12, d, yaw, col, mul(col, 1.1), 1, mul(col, 0.5));
    for (const a of [-1, 1]) for (const b of [-1, 1]) R.cyl(x + a * w * 0.46 * cs + b * d * 0.46 * sn, 0, h, z - a * w * 0.46 * sn + b * d * 0.46 * cs, 0.05, 0.05, STEEL, STEEL, 5);
    // the cart: red body, a glass case with its pots, two wheels
    R.box(x, 0.35, z, 2.1, 0.62, 0.9, yaw, c('#c8332f'), null, 0.84);
    R.box(x, 0.97, z, 2.1, 0.52, 0.9, yaw, c('#bfe2ea'), c('#e8f4f4'), 1);
    R.box(x, 0.46, z, 2.14, 0.14, 0.94, yaw, YELLOW, null, 1);
    R.blob(x - cs * 0.5, 1.2, z + sn * 0.5, 0.26, 0.2, 0.26, c('#b8bcc2'), c('#e0e2e4'), 6, 2);
    R.blob(x + cs * 0.4, 1.2, z - sn * 0.4, 0.22, 0.18, 0.22, c('#e8c070'), c('#f4dca0'), 6, 2);
    for (const a of [-1, 1]) R.cyl(x + a * 0.8 * cs, 0, 0.5, z - a * 0.8 * sn, 0.24, 0.24, TYRE, TYRE, 6);
    // stools, red and blue, round
    for (let q = 0; q < 4; q++) {
      const a = (q - 1.5) * 0.95, b = 1.3 + 0.12 * (q % 2), col2 = q % 2 ? c('#2d7fc4') : RED, hx2 = x + a * cs + b * sn, hz2 = z - a * sn + b * cs;
      R.cyl(hx2, 0, 0.45, hz2, 0.2, 0.15, col2, mul(col2, 1.15), 6, true);
    }
    const word = ['BAKSO', 'SATE', 'NASI GORENG', 'ES CENDOL', 'MARTABAK', 'SOTO', 'GADO GADO', 'PECEL LELE', 'AYAM BAKAR'][Math.floor(r(2) * 9)];
    R.sign(word, x - sn * d * 0.05, 1.82, z - cs * d * 0.05, yaw, 3.3, 0.62, WHITE, RED, d * 0.46);
  };
  for (let mm = m('saharjo', 30); mm < m('crossing', -10); mm += 34) {
    const p = at(mm), s = hash3(mm, 1, 61) < 0.5 ? -1 : 1, st = track.structureAt(p.i);
    if (st) continue;
    const [x, z] = off(p, s * (p.hw + 2.6));
    stall(x, z, roadYaw(p) + (s > 0 ? -Math.PI / 2 : Math.PI / 2), Math.floor(mm));
  }
  for (let mm = m('thamrin', 30); mm < m('semanggi', -80); mm += 84) {
    const p = at(mm), s = hash3(mm, 1, 63) < 0.5 ? -1 : 1, [x, z] = off(p, s * (p.hw + (slipAt(mm) ? 10 : 5.8)));
    if (track.structureAt(p.i) || (mm > m('dukuh', -70) && mm < m('dukuh', 215)) || Math.hypot(x - hx, z - hz) < 120) continue;
    stall(x, z, roadYaw(p) + (s > 0 ? -Math.PI / 2 : Math.PI / 2), Math.floor(mm));
  }
  // parked bikes in rows on every pavement: they are the pavement
  const parked = (mm, s, n, away) => {
    const p = at(mm), yaw = roadYaw(p) + Math.PI / 2 + 0.28;
    for (let q = 0; q < n; q++) {
      const pp = at(mm + q * 1.15), [x, z] = off(pp, s * (pp.hw + away)), R = F.at(x, z).full, col = PAINT[Math.floor(hash3(mm, q, 67) * PAINT.length)];
      R.box(x, 0.16, z, 0.42, 0.62, 1.7, yaw, col, null, 0.9);
      R.box(x - Math.sin(yaw) * 0.2, 0.78, z - Math.cos(yaw) * 0.2, 0.36, 0.16, 0.8, yaw, DARK, null, 1);
      R.box(x + Math.sin(yaw) * 0.62, 0.78, z + Math.cos(yaw) * 0.62, 0.72, 0.1, 0.1, yaw, STEEL, null, 1);
    }
  };
  for (let mm = m('thamrin', 60); mm < m('hi', -30); mm += 92) parked(mm, hash3(mm, 3, 1) < 0.5 ? 1 : -1, 8, 6.4);
  for (let mm = m('sudirman', 60); mm < m('semanggi', -40); mm += 118) if (mm < m('dukuh', -70) || mm > m('dukuh', 215)) parked(mm, hash3(mm, 4, 1) < 0.5 ? 1 : -1, 9, slipAt(mm) ? 8.2 : 6.4);
  for (let mm = m('saharjo', 40); mm < m('crossing', -20); mm += 40) parked(mm, hash3(mm, 5, 1) < 0.5 ? 1 : -1, 6, 3.6);
  // Menteng and the square have their carts too, and every corner its ojek drivers waiting
  for (const [a, b, every] of [[30, m('merdeka', -6), 46], [m('menteng', 10), track.length - 30, 46], [m('merdeka', 30), m('thamrin', -10), 92]]) {
    for (let mm = a; mm < b; mm += every) {
      const p = at(mm), sq = mm > m('merdeka'), s = sq ? (mm > m('barat') ? 1 : -1) * -1 : hash3(mm, 2, 62) < 0.5 ? -1 : 1, [x, z] = off(p, s * (p.hw + 2.8));
      if (track.structureAt(p.i) || monasView(x, z, MAP)) continue;
      stall(x, z, roadYaw(p) + (s > 0 ? -Math.PI / 2 : Math.PI / 2), Math.floor(mm));
      parked(mm + 8, s, 4, 1.2);
    }
  }
  for (let mm = m('saharjo', 47); mm < m('crossing', -10); mm += 68) {
    const p = at(mm), s = hash3(mm, 3, 61) < 0.5 ? -1 : 1, [x, z] = off(p, s * (p.hw + 2.6));
    if (!track.structureAt(p.i)) stall(x, z, roadYaw(p) + (s > 0 ? -Math.PI / 2 : Math.PI / 2), Math.floor(mm) + 5);
  }
  // The kampung lives in its lane: tin awnings, pots, bird cages and water gallons against every house; where the bank is open, washing, benches and a pipe rail above the canal.
  {
    const TIN = [c('#9aa0a4'), c('#b0714c'), c('#3f79a8'), c('#c8c2b0')], POT = [c('#b4613c'), c('#d8d0c0'), c('#3b78b8')], LEAF = [c('#3f8f46'), c('#58a84c'), c('#2f7a4a')], CLOTHES = [c('#d9483b'), c('#f4f1e8'), c('#2d7fc4'), c('#f2b53a'), c('#e87ba4'), c('#39a05a')], W0 = def.ground.river.w / 2;
    for (const s of [-1, 1]) for (let mm = m('kampung', 8); mm < m('menteng', -8); mm += 5.5) {
      const p = at(mm), r = (q) => hash3(mm, s * 7 + q, 91), yaw = roadYaw(p), u = r(1);
      if (track.structureAt(p.i)) continue;
      const [x0, z0] = off(p, s * (p.hw + 3.2)), openBank = riverD(x0, z0) < 34 && Math.floor(mm / 38) % 3 === 0;
      if (openBank) {
        // how far the ground goes before the canal wall
        let edge = p.hw + 2; while (edge < p.hw + 20 && riverD(...off(p, s * (edge + 1))) > W0 + 1.5) edge += 1;
        { const q = at(mm + 5.5), [a, b] = off(p, s * edge), [d, e] = off(q, s * edge), R = F.at(a, b).full; R.bar([a, 0.95, b], [d, 0.95, e], 0.05, c('#c84a3c')); R.bar([a, 0, b], [a, 0.95, b], 0.05, c('#c84a3c')); }
        const dd = p.hw + 1.4 + r(2) * Math.max(0.2, edge - p.hw - 2.6), [x, z] = off(p, s * dd), R = F.at(x, z).full;
        if (u < 0.3) {   // a washing line
          const cs = Math.cos(yaw), sn = Math.sin(yaw), A = [x + sn * 2, 2.3, z + cs * 2], B = [x - sn * 2, 2.3, z - cs * 2];
          R.bar([A[0], 0, A[2]], A, 0.05, c('#7a7468')); R.bar([B[0], 0, B[2]], B, 0.05, c('#7a7468')); R.bar(A, B, 0.015, c('#44464e'));
          for (let q = 0; q < 5; q++) { const t = (q + 0.5) / 5 - 0.5; R.box(x + sn * t * 4, 1.45, z + cs * t * 4, 0.05, 0.78, 0.62, yaw, CLOTHES[Math.floor(r(10 + q) * 6)], null, 1); }
        } else if (u < 0.55) {   // a bench, for those who watch the lane
          R.box(x, 0.42, z, 0.4, 0.08, 1.8, yaw, c('#8a6a48')); for (const q of [-0.7, 0.7]) R.box(x + Math.sin(yaw) * q, 0, z + Math.cos(yaw) * q, 0.36, 0.42, 0.08, yaw, c('#6a5038'), null, 1);
        } else if (u < 0.8) {   // a banana clump
          for (let q = 0; q < 3; q++) { const a = r(20 + q) * 6.28, X = x + Math.cos(a) * 0.5, Z = z + Math.sin(a) * 0.5, h = 2 + r(30 + q) * 0.9; R.cyl(X, 0, h, Z, 0.11, 0.08, c('#7c9a4c'), undefined, 5); for (let k = 0; k < 4; k++) { const b = a + k * 1.57; R.bar([X, h, Z], [X + Math.cos(b) * 1, h + 0.25, Z + Math.sin(b) * 1], 0.14, LEAF[k % 3]); } }
        } else parked(mm, s, 3, dd - p.hw);
        continue;
      }
      const [x, z] = off(p, s * (p.hw + 0.8)), R = F.at(x, z).full;
      if (u < 0.38) {   // a tin awning, a post and whatever hangs under it
        const col = TIN[Math.floor(r(2) * 4)], l = 1.6 + r(3) * 1.4, [xa, za] = off(p, s * (p.hw + 0.55));
        R.box(xa, 2.5, za, 1.5, 0.07, l * 2, yaw, col, mul(col, 1.08), 1);
        R.bar([xa + Math.sin(yaw) * l, 0, za + Math.cos(yaw) * l], [xa + Math.sin(yaw) * l, 2.5, za + Math.cos(yaw) * l], 0.04, c('#5a5a58'));
        if (r(4) < 0.5) { R.bar([xa, 2.5, za], [xa, 1.9, za], 0.012, c('#44464e')); R.cyl(xa, 1.55, 1.89, za, 0.16, 0.14, c('#d8b070'), undefined, 6, true); }   // a bird cage
      } else if (u < 0.72) {   // pots against the wall
        for (let q = 0; q < 3; q++) { const t = (q - 1) * 0.62, X = x + Math.sin(yaw) * t, Z = z + Math.cos(yaw) * t; R.cyl(X, 0.03, 0.3, Z, 0.13, 0.17, POT[Math.floor(r(q + 3) * 3)], undefined, 6, true); R.cyl(X, 0.32, 0.62 + r(q + 6) * 0.3, Z, 0.26, 0.08, LEAF[q], undefined, 6); }
      } else if (u < 0.86) {   // the water seller's gallons, stacked
        for (let q = 0; q < 3; q++) R.cyl(x + Math.sin(yaw) * (q - 1) * 0.36, 0.03, 0.42, z + Math.cos(yaw) * (q - 1) * 0.36, 0.16, 0.16, c('#6ab2d8'), c('#3b78b8'), 6, true);
      } else parked(mm, s, 2, 0.75);
    }
  }
  for (let mm = m('merdeka', 200); mm < m('utara', -30); mm += 120) parked(mm, -1, 8, 3.2);

  // the people of the pavement, in clumps: round, friendly, waiting for something that may not come
  {
    const CLOTH = ['#d9483b', '#2d7fc4', '#f2b53a', '#39a05a', '#e87ba4', '#f4f1e8', '#44464e', '#35b0ac'], HEAD = ['#d8a878', '#c99468', '#e0b184', '#b98258'], VEIL = ['#e87ba4', '#35b0ac', '#b794e8', '#f2b53a', '#f4f1e8'];
    const crowds = new Map(), crowdsLow = new Map();
    const person = (x, z, seed, y0 = 0.16) => {
      const k = `${Math.floor(x / 300)},${Math.floor(z / 300)}`, r = (q) => hash3(seed, q, 83), y = y0, list = crowds.get(k) || crowds.set(k, []).get(k), veil = r(3) < 0.4;
      if (!crowdsLow.has(k)) crowdsLow.set(k, new Raw());
      crowdsLow.get(k).box(x, y, z, 0.6, 1.8, 0.6, 0, c(CLOTH[Math.floor(r(1) * CLOTH.length)]), null, 0.8);
      const cloth = CLOTH[Math.floor(r(1) * CLOTH.length)], yaw = r(5) * 6.28, ax = Math.cos(yaw) * 0.3, az = Math.sin(yaw) * 0.3, skin = HEAD[Math.floor(r(2) * HEAD.length)];
      // facing: (fx, fz); across the shoulders: (ax, az)
      const fx0 = -az / 0.3, fz0 = ax / 0.3, phone = r(6) < 0.3;
      for (const q of [-1, 1]) {
        list.push(paint(place(capsule(0.1, 0.46, 1, 6), { p: [x + ax * q * 0.42, y + 0.34, z + az * q * 0.42] }), r(7) < 0.5 ? '#3f4250' : '#5a5448'));
        list.push(paint(place(box(0.16, 0.09, 0.3), { p: [x + ax * q * 0.42 + fx0 * 0.05, y + 0.05, z + az * q * 0.42 + fz0 * 0.05], r: [0, Math.atan2(fx0, fz0), 0] }), '#2a2830'));
        const up = phone && q > 0;
        list.push(paint(place(capsule(0.075, 0.4, 1, 6), { p: [x + ax * q * 1.08 + (up ? fx0 * 0.12 : 0), y + (up ? 1.08 : 0.94), z + az * q * 1.08 + (up ? fz0 * 0.12 : 0)], r: up ? [0.9 * fz0, 0, -0.9 * fx0] : [0, 0, 0] }), cloth));
        list.push(paint(place(sphere(0.075, 4, 2), { p: [x + ax * q * 1.08 + (up ? fx0 * 0.26 : 0), y + (up ? 1.26 : 0.68), z + az * q * 1.08 + (up ? fz0 * 0.26 : 0)] }), skin));
        // two dots of eyes, on the face's own side
        list.push(paint(place(sphere(0.028, 4, 2), { p: [x + fx0 * 0.2 + ax * q * 0.26, y + 1.58, z + fz0 * 0.2 + az * q * 0.26] }), '#1d1f2b'));
      }
      list.push(paint(place(capsule(0.235, 0.42, 2, 9), { p: [x, y + 0.98, z] }), cloth));
      list.push(paint(place(sphere(0.21, 9, 6), { p: [x, y + 1.55, z] }), skin));
      // hair or a coloured veil: a shell a little behind the head and over it, so that the face stays clear
      list.push(veil
        ? paint(place(sphere(0.25, 9, 6), { p: [x - fx0 * 0.05, y + 1.54, z - fz0 * 0.05], s: [1, 1.12, 1] }), VEIL[Math.floor(r(4) * VEIL.length)])
        : paint(place(sphere(0.225, 9, 5), { p: [x - fx0 * 0.045, y + 1.62, z - fz0 * 0.045], s: [1, 0.8, 1] }), '#2b2730'));
    };
    const clump = (mm, s, away, n, y0) => {
      for (let q = 0; q < n; q++) {
        const seed = Math.floor(mm) * 7 + q + (s > 0 ? 3 : 0), pp = at(mm + (hash3(seed, 1, 5) - 0.5) * 9), [x, z] = off(pp, s * (pp.hw + away + hash3(seed, 2, 5) * 1.6));
        person(x, z, seed, y0);
      }
    };
    for (let mm = 40; mm < track.length - 20; mm += 32) {
      const p = at(mm), z2 = zone(mm);
      if (track.structureAt(p.i) || z2 === 'tol' || z2 === 'ramp' || (mm > m('dukuh', -70) && mm < m('dukuh', 215))) continue;
      const wide = z2 === 'canyon' || z2 === 'tower', s = hash3(mm, 9, 1) < 0.5 ? 1 : -1, n = wide ? 3 : z2 === 'kampung' ? 2 : z2 === 'square' ? 2 : 3;
      clump(mm, s, slipAt(mm) ? 8.6 : wide ? 5.2 : z2 === 'kampung' ? 0.15 : 1.5, n, z2 === 'kampung' ? 0.05 : 0.16);
    }
    for (const [k, list] of crowds) batch.add(merge(list), { low: crowdsLow.get(k).geometry() });
  }

  // ---- the old Dutch city round the square, and the villas of Menteng: real walls all round, a roof on a real cornice, a portico, a railing and a hedge in front ----
  const fence = (R, x0, z0, x1, z1, plinth, hedge, seed) => {
    const L = Math.hypot(x1 - x0, z1 - z0), tx = (x1 - x0) / L, tz = (z1 - z0) / L, yaw = Math.atan2(tz, -tx) * 0 + Math.atan2(tx, tz), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    R.box(mx, 0.1, mz, 0.5, 0.55, L, yaw, plinth, mul(plinth, 1.08), 0.9);
    const IRON = c('#2f5f4c');
    R.bar([x0, 1.75, z0], [x1, 1.75, z1], 0.07, IRON); R.bar([x0, 0.7, z0], [x1, 0.7, z1], 0.07, IRON);
    const posts = Math.max(1, Math.round(L / 3.1));
    for (let i = 0; i <= posts; i++) { const u = i / posts, px = lerp(x0, x1, u), pz = lerp(z0, z1, u); R.box(px, 0.1, pz, 0.32, 1.95, 0.32, yaw, plinth, c('#e8c56a'), 0.9); }
    // bars between the posts: fine enough to be a railing, few enough to be cheap
    const bars = Math.max(2, Math.round(L / 1.5));
    for (let i = 0; i < bars; i++) { const u = (i + 0.5) / bars, px = lerp(x0, x1, u), pz = lerp(z0, z1, u); R.quad([px - tx * 0.05, 0.65, pz - tz * 0.05], [px + tx * 0.05, 0.65, pz + tz * 0.05], [px + tx * 0.05, 1.8, pz + tz * 0.05], [px - tx * 0.05, 1.8, pz - tz * 0.05], IRON); R.quad([px + tx * 0.05, 0.65, pz + tz * 0.05], [px - tx * 0.05, 0.65, pz - tz * 0.05], [px - tx * 0.05, 1.8, pz - tz * 0.05], [px + tx * 0.05, 1.8, pz + tz * 0.05], IRON); }
    // and clipped bushes behind it, round and full, each a little different
    if (hedge) {
      R.kind = 15; R.hedge(x0 - tz * hedge * 1.3, z0 + tx * hedge * 1.3, x1 - tz * hedge * 1.3, z1 + tx * hedge * 1.3, -hedge, seed); R.kind = 0;
    }
  };
  // style 'old': Dutch colonial white, tall windows; 'palace': a long low front with a great portico; 'office': the 1970s government block with sun fins; 'villa': a bungalow of Menteng
  const gedung = (x, z, yaw, w, d, floors, seed, style = 'old') => {
    const f = F.at(x, z), R = f.full, r = (q) => hash3(seed, q, 97), cs = Math.cos(yaw), sn = Math.sin(yaw), villa = style === 'villa', office = style === 'office', fh = villa ? 3.8 : office ? 4 : 5.2, h = floors * fh;
    const wall = office ? c('#d8d0bc') : r(1) < 0.7 ? c('#f6f1e4') : c('#f0e2c6'), trim = office ? c('#8f9aa2') : c('#ffffff'), win = villa ? c('#3a5a58') : office ? WIN[2] : c('#3a5266'), roofCol = villa ? ROOFS[Math.floor(r(2) * 3)] : office ? c('#9a9ca0') : ROOFS[Math.floor(r(2) * 5)];
    R.box(x, 0, z, w, 0.9, d, yaw, c('#cfc8b6'), null, 0.9);
    R.box(x, 0.9, z, w - 0.6, h, d - 0.6, yaw, wall, null, 0.88);
    // the cornice carries the roof: its underside is what you see from the road
    R.boxU(x, 0.9 + h, z, w + 1, 0.6, d + 1, yaw, trim, trim, 1, mul(wall, 0.55));
    if (office) { R.box(x, 1.5 + h, z, w * 0.5, 2.4, d * 0.5, yaw, mul(wall, 0.9)); }
    else { R.kind = 7; R.roof(x, 1.5 + h, z, w + 0.8, d + 0.8, villa ? 3 : 3.4 + floors, yaw, roofCol); R.kind = 0; }
    // all four walls have their windows, and the front a door and a portico
    const faces = [[yaw, w, d / 2 - 0.3, 0], [yaw + Math.PI, w, d / 2 - 0.3, 1], [yaw + Math.PI / 2, d, w / 2 - 0.3, 2], [yaw - Math.PI / 2, d, w / 2 - 0.3, 3]];
    for (const [fy, L, dist, which] of faces) {
      // the back of a building faces the next plot: nobody on the road ever sees it
      if (which === 1 && !villa) continue;
      const csF = Math.cos(fy), snF = Math.sin(fy), fx = x + snF * dist, fz = z + csF * dist, bay = villa ? 3.4 : office ? 3 : 4.4, cnt = Math.max(2, Math.floor((L - 2) / bay));
      // a seventies office: ribbon windows between sun fins, one long pane a floor
      if (office) for (let fl = 0; fl < floors; fl++) R.panel(fx, 1.9 + fl * fh, fz, L - 1.2, 2.2, fy, mix(win, c('#6f96a8'), hash3(seed + fl, which, 3) * 0.5), 0.08);
      if (!office) for (let q = 0; q < cnt; q++) {
        const u = ((q + 0.5) / cnt - 0.5) * (L - 2), ax = fx + csF * u, az = fz - snF * u;
        for (let fl = 0; fl < floors; fl++) {
          const y = 1.9 + fl * fh, wh = office ? 2.2 : villa ? 2 : 3, wd = villa ? 1.3 : office ? 2.2 : 1.7;
          // a raised surround, the dark glass, a white sill, a light from the top for the mullion
          if (!office) R.panel(ax, y - 0.16, az, wd + 0.36, wh + 0.42, fy, trim, 0.05);
          R.panel(ax, y, az, wd, wh, fy, mix(win, c('#6f96a8'), hash3(seed + fl, q, which) * 0.5), 0.08);
          R.panel(ax, y + wh * 0.62, az, wd, 0.07, fy, trim, 0.1);
          if (!office) R.panel(ax, y, az, 0.07, wh, fy, trim, 0.1);
          // shutters on a villa
          if (villa) for (const a of [-1, 1]) R.panel(ax + csF * a * (wd / 2 + 0.3), y, az - snF * a * (wd / 2 + 0.3), 0.5, wh, fy, mix(c('#2f6a58'), c('#6a5038'), r(20)), 0.07);
        }
        // pilasters: every other bay, standing proud
        if (!office && !villa && q % 2 === 0) R.box(ax + csF * (L - 2) / cnt / 2 + snF * 0.2, 0.9, az - snF * (L - 2) / cnt / 2 + csF * 0.2, 0.7, h, 0.42, fy, mul(wall, 1.03), null, 0.92);
      }
      // string courses between the floors
      for (let fl = 1; fl < floors; fl++) R.panel(fx, 0.9 + fl * fh - 0.18, fz, L - 0.4, 0.32, fy, trim, 0.12);
      if (office) for (let q = 0; q <= cnt * 2; q++) { const u = (q / (cnt * 2) - 0.5) * (L - 1); R.box(fx + csF * u + snF * 0.35, 0.9, fz - snF * u + csF * 0.35, 0.22, h, 0.7, fy, mul(wall, 1.05), null, 0.92); }
    }
    const fx = x + sn * (d / 2), fz = z + cs * (d / 2);
    // the portico: round columns, a beam, a pediment; or for a villa a little porch
    const pw = style === 'palace' ? w * 0.42 : villa ? 6.4 : w * 0.3, cols = style === 'palace' ? 8 : villa ? 3 : 5, pd = villa ? 2.6 : 4.6, ph = villa ? 3.4 : Math.min(h, 2 * fh + 0.2) + 0.2;
    if (!office) {
      const P = (a, b, y) => [fx + a * cs + b * sn, y, fz - a * sn + b * cs];
      for (let q = 0; q < cols; q++) { const a = (q / (cols - 1) - 0.5) * (pw - 0.8), [px, py, pz] = P(a, pd - 0.6, 0.9); R.cyl(px, py, py + ph, pz, 0.42, 0.34, trim, trim, 7); }
      R.boxU(fx + sn * pd / 2, 0.9 + ph, fz + cs * pd / 2, pw, 0.7, pd, yaw, trim, trim, 1, mul(wall, 0.6));
      const top = 0.9 + ph + 0.7, rise = pw * 0.14;
      R.quad(P(-pw / 2, pd, top), P(pw / 2, pd, top), P(0, pd, top + rise), P(0, pd, top + rise), trim);
      R.quad(P(pw / 2, pd, top), P(pw / 2, 0, top), P(0, 0, top + rise), P(0, pd, top + rise), roofCol);
      R.quad(P(-pw / 2, 0, top), P(-pw / 2, pd, top), P(0, pd, top + rise), P(0, 0, top + rise), mul(roofCol, 0.9));
      R.panel(fx, 0.9, fz, Math.min(3, pw * 0.3), 3, yaw, c('#4a3a2c'), 0.1);
      // steps up to it
      R.box(fx + sn * pd * 0.5, 0, fz + cs * pd * 0.5, pw + 1.6, 0.9, pd + 0.6, yaw, c('#ddd6c6'), null, 0.92);
    } else {
      R.panel(fx, 0.9, fz, w * 0.24, 3.2, yaw, WIN[1], 0.48);
      R.boxU(fx + sn * 1.6, 4.3, fz + cs * 1.6, w * 0.3, 0.3, 3.2, yaw, trim, trim, 1, mul(trim, 0.5));
    }
    // the flag at the door of anything official
    if (!villa) {
      const px = fx + sn * 8 + cs * (w * 0.32), pz = fz + cs * 8 - sn * (w * 0.32);
      R.cyl(px, 0, 11, pz, 0.08, 0.05, c('#f0f0ee'), c('#f0f0ee'), 5);
      R.panel(px, 9.6, pz, 2.1, 0.68, yaw + Math.PI / 2, RED, 0); R.panel(px, 9.6, pz, 2.1, 0.68, yaw - Math.PI / 2, RED, 0);
      R.panel(px, 8.92, pz, 2.1, 0.68, yaw + Math.PI / 2, WHITE, 0); R.panel(px, 8.92, pz, 2.1, 0.68, yaw - Math.PI / 2, WHITE, 0);
    }
    f.low.box(x, 0, z, w, h + 1.5, d, yaw, wall, null, 0.88);
    const lf = Math.max(2, floors * 2);
    for (const s of [-1, 1]) { f.low.panel(fx - (s < 0 ? sn * d : 0), 2, fz - (s < 0 ? cs * d : 0), w * 0.9, h - 1.5, s > 0 ? yaw : yaw + Math.PI, mix(wall, win, 0.4), 0.05); }
    if (!office) f.low.roof(x, 1.5 + h, z, w + 0.8, d + 0.8, 3.4 + floors, yaw, roofCol);
    f.hasLow = true;
  };
  const face = (p, s) => roadYaw(p) + (s > 0 ? -Math.PI / 2 : Math.PI / 2);
  // The row is told by a pattern of plots: one building, then a gap with its trees, each of its own width, height and kind, so no street is one long wall.
  const gedungRow = (from, to, s, every, away, w0, d0, floors, seed, styles = ['old', 'old', 'office']) => {
    for (let mm = from; mm < to;) {
      const p = at(mm), j = hash3(mm, seed, 1), w = w0 * (0.7 + j * 0.62), d = d0 * (0.9 + hash3(mm, seed, 2) * 0.3), style = styles[Math.floor(hash3(mm, seed, 3) * styles.length)], fl = Math.max(1, floors + (hash3(mm, seed, 4) < 0.34 ? -1 : hash3(mm, seed, 4) > 0.8 ? 1 : 0)) + (style === 'office' ? 1 : 0);
      const here = at(mm + w / 2), [x, z] = off(here, s * (here.hw + away + d / 2));
      if (clear(x, z, Math.min(w, d) * 0.5 + 2) && Math.hypot(x - hx, z - hz) > 140) {
        const yaw = face(here, s), R = F.at(x, z).full;
        gedung(x, z, yaw, w, d, fl, Math.floor(mm) + seed, style);
        batch.blob(x, z, w * 0.55, 0.4);
        const FY = away - 4, [ax, az] = off(at(mm - 1), s * (here.hw + FY)), [bx, bz] = off(at(mm + w + 1), s * (here.hw + FY));
        if (style !== 'office') fence(R, ax, az, bx, bz, c('#e4ddcc'), s > 0 ? -1 : 1, Math.floor(mm));
      }
      mm += w + every * (0.5 + hash3(mm, seed, 6));
    }
  };
  // Merdeka Timur and Utara: the palace side; Merdeka Barat: the museum side, outward of the road. The road runs round the square, the outside is on the right of a clockwise lap
  gedungRow(m('merdeka', 14), m('utara', -40), -1, 20, 13, 42, 22, 2, 11, ['old', 'office', 'old']);
  gedungRow(m('utara', 0), m('barat', -50), -1, 26, 15, 54, 24, 2, 13, ['palace', 'old']);
  gedungRow(m('barat', 0), m('thamrin', -30), -1, 22, 13, 46, 24, 2, 17, ['palace', 'old', 'office']);
  // round Semanggi: low offices, of the kind the seventies left everywhere
  gedungRow(m('sudirman2', 480), m('semanggi', 30), -1, 46, 16, 34, 20, 4, 29, ['office']);
  gedungRow(m('sudirman2', 480), m('semanggi', 30), 1, 46, 16, 34, 20, 4, 31, ['office']);
  // Menteng: villas behind low walls, one after the next, with trees between
  gedungRow(40, m('merdeka', -30), 1, 8, 7, 16, 11, 1, 37, ['villa']);
  gedungRow(40, m('merdeka', -30), -1, 8, 7, 16, 11, 1, 41, ['villa']);
  gedungRow(m('menteng', 30), track.length - 10, 1, 8, 7, 16, 11, 1, 43, ['villa']);
  gedungRow(m('menteng', 30), track.length - 10, -1, 8, 7, 16, 11, 1, 47, ['villa']);
  // the square's own railing on its inner side: the park is fenced, with gates
  {
    const R = new Raw();
    for (let mm = m('merdeka', 10); mm < m('thamrin', -30); mm += 42) {
      const p = at(mm), q = at(mm + 34), [ax, az] = off(p, p.hw + 6), [bx, bz] = off(q, q.hw + 6);
      if (track.structureAt(p.i)) continue;
      if (R.v > 12000) { batch.add(R.geometry()); R.P = []; R.N = []; R.C = []; R.I = []; R.K = []; R.v = 0; }
      fence(R, ax, az, bx, bz, c('#e4ddcc'), -1, Math.floor(mm));
    }
    if (R.v) batch.add(R.geometry());
  }

  // ---- the street's own furniture: lamps on the avenues, poles and the famous tangle of cables on the small roads ----
  for (let mm = 40; mm < track.length; mm += 45) {
    const p = at(mm), z2 = zone(mm);
    if (track.structureAt(p.i) || z2 === 'kampung' || z2 === 'tol' || z2 === 'menteng') continue;
    const R = F.at(p.x, p.z).full;
    for (const s of [-1, 1]) {
      const [x, z] = off(p, s * (p.hw + 1.4)), [x2, z2b] = off(p, s * (p.hw - 1.8));
      // a slim tapered pole, an arm with a curve to it, a shallow lamp
      R.cyl(x, 0.1, 11.2, z, 0.14, 0.08, STEEL, mul(STEEL, 1.1), 6);
      R.cyl(x, 0, 0.9, z, 0.24, 0.2, DARK, DARK, 6);
      R.bar([x, 10.9, z], [(x + x2) / 2, 11.75, (z + z2b) / 2], 0.1, STEEL);
      R.bar([(x + x2) / 2, 11.75, (z + z2b) / 2], [x2, 11.95, z2b], 0.1, STEEL);
      R.box(x2, 11.8, z2b, 0.32, 0.14, 1, roadYaw(p) + Math.PI / 2, c('#d8d8d4'), c('#fff0b0'), 1);
      // red and white on the avenues: a little pennant on each post. August never quite comes down
      if (z2 === 'square' || z2 === 'tower' || z2 === 'canyon') {
        const y = roadYaw(p), ox = x + (x2 - x) * -0.14, oz = z + (z2b - z) * -0.14, sl = 0.34, cs = Math.cos(y), sn = Math.sin(y);
        R.bar([x, 8.9, z], [x + (x2 - x) * 0.26, 8.9, z + (z2b - z) * 0.26], 0.05, STEEL);
        const qx = x + (x2 - x) * 0.13, qz = z + (z2b - z) * 0.13, nx = (x2 - x) * 0.13, nz = (z2b - z) * 0.13;
        for (const b of [0, 1]) {
          const col = b ? WHITE : RED, top = 8.86 - b * 0.82, bot = top - 0.82;
          R.quad([qx - nx, bot, qz - nz], [qx + nx, bot, qz + nz], [qx + nx, top, qz + nz], [qx - nx, top, qz - nz], col);
          R.quad([qx + nx, bot, qz + nz], [qx - nx, bot, qz - nz], [qx - nx, top, qz - nz], [qx + nx, top, qz + nz], col);
        }
      }
    }
  }
  const cable = (R, a, b, sag, col) => {
    const seg = 3;
    for (let i = 0; i < seg; i++) {
      const t0 = i / seg, t1 = (i + 1) / seg, y0 = lerp(a[1], b[1], t0) - sag * 4 * t0 * (1 - t0), y1 = lerp(a[1], b[1], t1) - sag * 4 * t1 * (1 - t1);
      const x0 = lerp(a[0], b[0], t0), z0 = lerp(a[2], b[2], t0), x1 = lerp(a[0], b[0], t1), z1 = lerp(a[2], b[2], t1);
      R.quad([x0, y0, z0], [x1, y1, z1], [x1, y1 + 0.07, z1], [x0, y0 + 0.07, z0], col);
    }
  };
  let prev = [null, null];
  for (let mm = m('saharjo', 20); mm < m('menteng'); mm += 38) {
    const p = at(mm), st = track.structureAt(p.i);
    if (st) { prev = [null, null]; continue; }
    const R = F.at(p.x, p.z).full;
    [-1, 1].forEach((s, side) => {
      const [x, z] = off(p, s * (p.hw + 0.75));
      R.cyl(x, 0, 9, z, 0.18, 0.12, CONC_D, CONC_D, 5);
      R.box(x, 8.2, z, 1.8, 0.12, 0.12, roadYaw(p), TYRE);
      if (Math.floor(mm) % 3 === 0) R.box(x, 6, z, 0.7, 1, 0.6, 0, c('#7d8288'), null, 1);
      const top = [x, 8.1, z];
      if (prev[side]) for (let w = 0; w < 4; w++) cable(R, [prev[side][0] + w * 0.1, 8.1 - w * 0.3, prev[side][2]], [top[0] + w * 0.1, 8.1 - w * 0.3, top[2]], 0.5 + w * 0.22, TYRE);
      // and one strung across the road, just to make the point
      if (side === 1 && Math.floor(mm / 38) % 3 === 0) { const [xa, za] = off(p, -(p.hw + 0.75)); cable(R, [xa, 8, za], [x, 8, z], 1.1, TYRE); cable(R, [xa, 7.6, za], [x, 7.6, z], 1.4, TYRE); }
      prev[side] = top;
    });
  }
  // the lane's flags for the seventeenth of August, strung from roof to roof, and the painted gates at each end of the kampung
  for (let mm = m('kampung', 18); mm < m('menteng', -10); mm += 21) {
    const p = at(mm), st = track.structureAt(p.i);
    if (st) continue;
    const R = F.at(p.x, p.z).full, [xa, za] = off(p, -(p.hw + 1.4)), [xb, zb] = off(p, p.hw + 1.4), flags = 11, y0 = 6.6 + hash3(mm, 1, 8) * 1.2;
    const cs = p.tx, sn = p.tz;
    cable(R, [xa, y0, za], [xb, y0, zb], 0.8, TYRE);
    for (let q = 1; q < flags; q++) {
      const u = q / flags, sag = 0.8 * 4 * u * (1 - u), px = lerp(xa, xb, u), pz = lerp(za, zb, u), py = y0 - sag, col = q % 2 ? RED : WHITE;
      R.quad([px - p.nx * 0.32, py, pz - p.nz * 0.32], [px + p.nx * 0.32, py, pz + p.nz * 0.32], [px, py - 0.62, pz], [px, py - 0.62, pz], col);
      R.quad([px + p.nx * 0.32, py, pz + p.nz * 0.32], [px - p.nx * 0.32, py, pz - p.nz * 0.32], [px, py - 0.62, pz], [px, py - 0.62, pz], col);
    }
  }
  for (const mm of [m('kampung', 8), m('bridge2', -40)]) {
    const p = at(mm), yaw = roadYaw(p), R = F2Local(batch), [ax, az] = off(p, p.hw + 0.5), [bx, bz] = off(p, -(p.hw + 0.5));
    for (const [x, z] of [[ax, az], [bx, bz]]) { R.box(x, 0, z, 1, 6, 1, yaw, RED, WHITE, 0.9); R.box(x, 6, z, 1.5, 0.5, 1.5, yaw, WHITE); }
    const cxx = p.x, czz = p.z;
    R.boxU(cxx, 5.6, czz, p.w + 2, 1.9, 0.5, yaw + Math.PI / 2 * 0, RED, WHITE, 1);
    R.sign('DIRGAHAYU RI', cxx, 5.75, czz, yaw + Math.PI, p.w * 0.84, 1.6, WHITE, RED, 0.34);
    R.flush();
  }

  // ---- the gang closes in: lean-to roofs over the lane, shacks on stilts on the river side, washing and wires across it, and everything people own stood outside ----
  {
    const TIN = [c('#8f8a80'), c('#a0683f'), c('#7a4e36'), c('#6f7a80'), c('#3f6f9a'), c('#b0a48c')], CL = [c('#d9483b'), c('#f4f1e8'), c('#2d7fc4'), c('#f2b53a'), c('#e87ba4'), c('#39a05a'), c('#4a4a58')];
    const K0 = m('kampung', 10), K1 = m('menteng', -10);
    for (let mm = K0; mm < K1; mm += 3.6) {
      const p = at(mm); if (track.structureAt(p.i)) continue;
      const yaw = roadYaw(p), cs = Math.cos(yaw), sn = Math.sin(yaw);
      for (const s of [-1, 1]) {
        const r = (q) => hash3(mm, s * 11 + q, 121), [x0, z0] = off(p, s * (p.hw + 3.2)), river = riverD(x0, z0) < 26 + def.ground.river.w / 2, face = yaw + (s > 0 ? -Math.PI / 2 : Math.PI / 2);
        const open = riverD(x0, z0) < 34 && Math.floor(mm / 38) % 3 === 0;
        if (open) continue;
        // on the river side there is no room for a house: a shack on stilts with its back over the bank
        if (river && r(1) < 0.62 && Math.floor(mm / 3.6) % 2 === 0) { const w = 3.2 + r(2) * 2, d = 3.6 + r(3) * 1.4, [x, z] = off(p, s * (p.hw + 1.3 + d / 2)); if (terrain.roadDistAt(x, z) > d / 2) rumah(F.at(x, z), x, z, face, w, d, Math.floor(mm * 5) + s, { front: true, base: -1.3 }); }
        const R = F.at(p.x, p.z).full;
        // a lean-to from the wall out over the gutter: low, crooked, no two the same tin
        if (r(4) < 0.5) {
          const col = TIN[Math.floor(r(5) * TIN.length)], l = 1.2 + r(6) * 1.6, d0 = p.hw + 1.25, d1 = p.hw - 0.55 - r(7) * 0.5, y0 = 3.15 + r(8) * 0.35, y1 = 2.62 + r(9) * 0.2, tilt = (r(10) - 0.5) * 0.3;
          const Q = (a, d2, y) => { const [X, Z] = off(p, s * d2); return [X + sn * a, y, Z + cs * a]; };
          const a = Q(-l, d0, y0 + tilt), b = Q(l, d0, y0 - tilt), e = Q(l, d1, y1 - tilt), g = Q(-l, d1, y1 + tilt);
          R.quad(a, b, e, g, col, mul(col, 0.92)); R.quad(b, a, g, e, mul(col, 0.5));
          for (let q = -1; q <= 1; q++) { const t = q / 1.5 * l; R.bar(Q(t, d0, y0 + 0.03), Q(t, d1, y1 + 0.03), 0.018, mul(col, 0.74)); }
          for (const t of [-l, l]) if (r(11) < 0.6) { const [X, , Z] = Q(t * 0.9, d1 + 0.1, 0); R.bar([X, 0, Z], [X, y1, Z], 0.045, c('#6a5a48')); }
        }
        // what is stood outside: barrels, crates, a sack, a chair
        const u = r(12), [xx, zz] = off(p, s * (p.hw + 0.35 + r(13) * 0.5));
        if (u < 0.14) R.cyl(xx, 0.03, 0.82, zz, 0.27, 0.27, c('#2d6fb8'), c('#4a8ad0'), 7, true);
        else if (u < 0.26) R.box(xx, 0.03, zz, 0.62, 0.42 + r(14) * 0.4, 0.5, yaw + r(15), c('#b8905c'), null, 0.8);
        else if (u < 0.34) R.blob(xx, 0.24, zz, 0.36, 0.26, 0.28, c('#d8ceb4'), c('#ece4ce'), 6, 2);
        else if (u < 0.42) { R.box(xx, 0.42, zz, 0.42, 0.05, 0.42, yaw, c('#d9483b')); for (const q of [-1, 1]) R.bar([xx + q * 0.17, 0, zz], [xx + q * 0.17, 0.42, zz], 0.02, c('#d9483b')); }
      }
      // washing and wires right across the lane, above the camera
      const ri = (q) => hash3(mm, 77 + q, 122);
      if (Math.floor(mm / 3.6) % 7 === 0 && ri(1) < 0.8) {
        const [xa, za] = off(p, p.hw + 1.1), [xb, zb] = off(p, -(p.hw + 1.1)), y = 4.7 + ri(2) * 0.8, R = F.at(p.x, p.z).full;
        R.bar([xa, y, za], [xb, y - 0.15, zb], 0.016, c('#3a3a42'));
        const n = 4 + Math.floor(ri(3) * 5);
        for (let q = 0; q < n; q++) { const t = (q + 0.5 + (ri(10 + q) - 0.5) * 0.5) / n, X = lerp(xa, xb, t), Z = lerp(za, zb, t), hh = 0.55 + ri(20 + q) * 0.45; R.box(X, y - hh - 0.02, Z, 0.5 + ri(30 + q) * 0.3, hh, 0.03, yaw + Math.PI / 2 + Math.PI / 2, CL[Math.floor(ri(40 + q) * CL.length)], null, 0.86); }
      }
      if (Math.floor(mm / 3.6) % 5 === 2) {
        const R = F.at(p.x, p.z).full, [xa, za] = off(p, p.hw + 1.1), [xb, zb] = off(at(mm + 6 + ri(5) * 9), -(p.hw + 1.1));
        for (let w = 0; w < 3; w++) cable(R, [xa, 5.8 + w * 0.22 + ri(6) * 0.3, za], [xb, 5.4 + w * 0.3 + ri(7) * 0.4, zb], 0.5 + ri(8 + w) * 0.5, TYRE);
      }
    }
  }

  // ---- the roofscape to the horizon: small houses on all the land not otherwise taken ----
  const parks = [{ x: 0, z: 0, r: 340 * MAP }, { x: hx, z: hz, r: 215 }, { x: SEMANGGI[0] * MAP, z: SEMANGGI[1] * MAP, r: 86 }, { x: -1250 * MAP, z: 2820 * MAP, r: 230 }];
  for (const g of world.groves) if (g.r > 90) parks.push({ x: g.x, z: g.z, r: g.r * 0.5 });
  const CELL = 18;
  // the roofs in blocks of their own: a block with a tall tower in it is drawn to the horizon, and ten thousand roofs must not go with it
  const H = new Blocks(300);
  for (let zz = terrain.z0 + 200; zz < terrain.z0 + (terrain.h - 1) * terrain.step - 200; zz += CELL) {
    for (let xx = terrain.x0 + 200; xx < terrain.x0 + (terrain.w - 1) * terrain.step - 200; xx += CELL) {
      const j = hash3(xx, zz, 71), x = xx + (j - 0.5) * 5, z = zz + (hash3(xx, zz, 72) - 0.5) * 5;
      const rdd = terrain.roadDistAt(x, z);
      if (rdd < 11 || (rdd < 26 + j * 6 && !track.structureAt(track.nearest(x, z).i)) || hash3(xx, zz, 73) < 0.05 || monasView(x, z, MAP)) continue;
      let inPark = false;
      for (const q of parks) if ((x - q.x) ** 2 + (z - q.z) ** 2 < q.r * q.r) { inPark = true; break; }
      if (inPark) continue;
      if (riverD(x, z) < 34) continue;
      const w = 11 + j * 6, d = 11 + hash3(xx, zz, 74) * 6, tall = hash3(xx, zz, 75);
      const yaw = 0.2 + (Math.floor(hash3(Math.floor(xx / 180), Math.floor(zz / 180), 76) * 4) * Math.PI) / 2, wall = OLDWALL[Math.floor(tall * 97) % OLDWALL.length], roof = ROOFS[Math.floor(hash3(xx, zz, 77) * ROOFS.length)];
      const rd6 = (ax, az) => terrain.roadDistAt(ax, az);
      const toRoad = rdd < 74 ? [rd6(x - 6, z) - rd6(x + 6, z), rd6(x, z - 6) - rd6(x, z + 6)] : null;
      hutRoof(H.at(x, z), x, z, yaw, w, d, tall > 0.965 ? 20 : tall > 0.84 ? 11 : tall > 0.5 ? 7 : 4, wall, roof, toRoad);
      // the kampung is contiguous: toward the Ciliwung every other plot has a neighbour jammed against it
      const rdNear = riverD(x, z);
      if (rdNear < 120) for (const [ox, oz] of [[9, 9]]) {
        const x2 = x + ox, z2 = z + oz;
        if (terrain.roadDistAt(x2, z2) < 16 || riverD(x2, z2) < 34 || monasView(x2, z2, MAP)) continue;
        const k = hash3(x2, z2, 78);
        hutRoof(H.at(x2, z2), x2, z2, yaw, 8 + k * 5, 8 + k * 4, k > 0.7 ? 7 : 4, OLDWALL[Math.floor(k * 71) % OLDWALL.length], RUST[Math.floor(k * 37) % RUST.length]);
      }
    }
  }
  F.flush(batch);
  H.flush(batch);

  // ---- the great landmarks ----
  const yawTo = (x0, z0, x1, z1) => Math.atan2(x1 - x0, z1 - z0);
  const addFar = (g, lowG, x, z, y = 0, yaw = 0, sc = 1) => {
    place(g, { p: [x, y, z], r: [0, yaw, 0], s: sc });
    place(lowG, { p: [x, y, z], r: [0, yaw, 0], s: sc });
    batch.add(g, { far: true, low: lowG });
    batch.blob(x, z, 40 * sc, 0.4);
  };
  // The Monas in the world and the Monas in the repaint (panorama, flame at 15 deg) are one: past MONAS_FAR, where this one is the size of the painted one, this one is gone from that view, and within it the painted one is (def.backdrops showWithin). Per view, at draw time.
  {
    const mon = new THREE.Mesh(monas(), mat('#ffffff', { vertexColors: true })), MONAS_FAR = 797;
    mon.frustumCulled = false; mon.matrixAutoUpdate = false; // in a group of its own: the stream only cuts plain meshes of staticGroup, at def.long.statics
    mon.onBeforeRender = (r, sc, cam) => { mon.matrixWorld.makeTranslation(0, Math.hypot(cam.position.x, cam.position.z) <= MONAS_FAR ? 0 : -1e5, 0); };
    const holder = new THREE.Group(); holder.add(mon); world.staticGroup.add(holder);
    batch.blob(0, 0, 40, 0.4);
  }
  // the great paved court at its feet, and the walks that cross the lawn to it
  const yard = new Raw();
  {
    const seg = 44, stone = c('#ddd6c4'), band = c('#c8c0ac');
    for (let i = 0; i < seg; i++) {
      const a0 = i / seg * TAU, a1 = (i + 1) / seg * TAU, ring = (r0, r1, col) => yard.quad([Math.cos(a0) * r0, 0.14, Math.sin(a0) * r0], [Math.cos(a0) * r1, 0.14, Math.sin(a0) * r1], [Math.cos(a1) * r1, 0.14, Math.sin(a1) * r1], [Math.cos(a1) * r0, 0.14, Math.sin(a1) * r0], col);
      ring(30, 58, i % 2 ? stone : mul(stone, 0.97)); ring(58, 62, band);
    }
    const walk = (a, r0, r1, w) => { const ca = Math.cos(a), sa = Math.sin(a), nx = -sa * w, nz = ca * w; yard.quad([ca * r0 + nx, 0.12, sa * r0 + nz], [ca * r1 + nx, 0.12, sa * r1 + nz], [ca * r1 - nx, 0.12, sa * r1 - nz], [ca * r0 - nx, 0.12, sa * r0 - nz], c('#d3cbb6')); };
    for (let i = 0; i < 8; i++) walk(i / 8 * TAU + 0.39, 60, 240, 4);
    // a ring of low posts and lamps at the edge of the court, and nothing higher: the monument stands alone
    for (let i = 0; i < 16; i++) { const a = i / 16 * TAU, x = Math.cos(a) * 62, z = Math.sin(a) * 62; yard.cyl(x, 0, 3.6, z, 0.16, 0.1, DARK, DARK, 5); yard.blob(x, 3.9, z, 0.36, 0.36, 0.36, c('#f4efd8'), c('#fff8e8'), 6, 2); }
  }
  batch.add(yard.geometry());
  batch.blob(0, 0, 54, 0.25);
  // spotted deer on the lawn, the real herd of the square
  for (let i = 0; i < 9; i++) {
    const a = 0.8 + i * 0.5, r = 108 + 14 * (i % 3), x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (terrain.roadDistAt(x, z) < 6) continue;
    const g = blobAnimal('#b98a55', 1.15, '#7d5a3a');
    place(g, { p: [x, ground.groundAt(x, z), z], r: [0, a * 2, 0] });
    batch.add(g);
  }

  // Bundaran HI: the round pool and its jets; the pair stand on their pedestal, facing up Thamrin; modern glass all round.
  const pool = new Raw(); hiPool(pool, hx, hz, 40); batch.add(pool.geometry());
  {
    const jets = new THREE.Mesh(hiJets(hx, hz, 40), mat('#ffffff', { vertexColors: true, transparent: true, opacity: 0.74, depthWrite: false }));
    jets.frustumCulled = true; world.staticGroup.add(jets); jakartaJets = jets;
    // The half of the roundabout the lap does not take: the same carriageway, its lines, and a queue that never moves
    const W = new Raw(), seg = 64, r0 = 62, r1 = 82, ASP = c('#5e5a64'), LINE = c('#fbf6e2');
    for (let i = 0; i < seg; i++) {
      const a0 = 1.05 + (i / seg) * 3.5, a1 = 1.05 + ((i + 1) / seg) * 3.5, P = (r, a, y = 0.1) => [hx + Math.cos(a) * r, y, hz + Math.sin(a) * r];
      W.quad(P(r0, a1), P(r1, a1), P(r1, a0), P(r0, a0), ASP);
      if (i % 2) W.quad(P(71.9, a1, 0.12), P(72.1, a1, 0.12), P(72.1, a0, 0.12), P(71.9, a0, 0.12), LINE);
      W.quad(P(r1 + 7, a1, 0.2), P(r1 + 0.2, a1, 0.2), P(r1 + 0.2, a0, 0.2), P(r1 + 7, a0, 0.2), PAVE);
      W.quad(P(r1 + 0.2, a1, 0.2), P(r1 + 0.2, a1, 0.04), P(r1 + 0.2, a0, 0.04), P(r1 + 0.2, a0, 0.2), mul(PAVE, 0.74));
      if (i % 5 === 0) for (const rr of [66, 78]) { const X = hx + Math.cos(a0) * rr, Z = hz + Math.sin(a0) * rr, ya = -a0, col = PAINT[(i * 3 + rr) % PAINT.length]; W.box(X, 0.1, Z, 4, 1.05, 1.9, ya, col, null, 0.86); W.box(X, 1.15, Z, 2.2, 0.72, 1.7, ya, c('#3f6a88'), col); }
    }
    batch.add(W.geometry());
  }
  const sd = selamatDatang();
  place(sd, { p: [hx, 0.9, hz], r: [0, Math.PI, 0], s: 1.32 });
  const sdR = new Raw(); sdR.cyl(hx, 0, 1.1, hz, 40, 40, c('#3f8f86'), c('#3f8f86'), 18, true);
  for (const s of [-1, 1]) sdR.box(hx + s * 1.3, 0.9, hz, 0.74, 28.5, 2.9, 0, c('#3a2d27'));
  sdR.box(hx, 29.4, hz, 4.5, 0.8, 3.4, 0, c('#4a382e'));
  const sdFig = merge([paint(place(capsule(0.95, 5.6, 2, 6), { p: [hx - 1.4, 35, hz] }), '#463629'), paint(place(capsule(0.85, 5.4, 2, 6), { p: [hx + 1.4, 35, hz] }), '#463629'), paint(place(capsule(0.34, 4, 1, 4), { p: [hx - 3, 41, hz], r: [0, 0, 0.4] }), '#463629'), paint(place(capsule(0.34, 4, 1, 4), { p: [hx + 3, 41, hz], r: [0, 0, -0.4] }), '#463629')]);
  batch.add(sd, { far: true, low: merge([sdR.geometry(), sdFig]) });
  batch.blob(hx, hz, 30, 0.35);

  const arj = arjuna(), pa = at(m('thamrin', -24)), [ax, az] = off(pa, -(pa.hw + 24));
  place(arj, { p: [ax, 0, az], r: [0, roadYaw(pa) + Math.PI, 0] });
  batch.add(arj);
  batch.blob(ax, az, 18, 0.35);

  // the buildings the roundabout is known by, each where the road leaves it a lot
  const lot = (ang, dist) => [hx + Math.sin(ang) * dist, hz - Math.cos(ang) * dist];
  // The road round the fountain has a wall of malls and hotels on its outer side, shoulder to shoulder, shops on the street, as the real junction has: no lot and no low roof.
  {
    const STs = ['#e6dcc8', '#dfe4e4', '#ece4d4', '#d9d4c8'].map(c);
    for (let mm = m('hi', -150); mm < m('sudirman', 150);) {
      const w = 38 + hash3(mm, 3, 91) * 26, here = at(mm + w / 2);
      for (const s of [-1, 1]) {
        const dep = 26 + hash3(mm, s, 92) * 10, h = 14 + Math.floor(hash3(mm, s, 93) * 3) * 6, [x, z] = off(here, s * (here.hw + 8.6 + dep / 2));
        if (Math.hypot(x - hx, z - hz) < 96 || !clear(x, z, Math.min(w, dep) * 0.5 - 1)) continue;
        const yaw = roadYaw(here) + (s > 0 ? -Math.PI / 2 : Math.PI / 2), seed = Math.floor(mm) + s, st = STs[Math.floor(hash3(mm, s, 94) * STs.length)], g = GLASS[Math.floor(hash3(mm, s, 95) * GLASS.length)], f = F.at(x, z);
        f.full.box(x, 0, z, w, h, dep, yaw, st);
        // the street face and its two sides have shops and offices; the roof has plant on it
        const cs = Math.cos(yaw), sn = Math.sin(yaw);
        podiumFace(f.full, x + sn * dep / 2, z + cs * dep / 2, yaw, w, h, st, g, WIN[Math.floor(hash3(mm, s, 96) * WIN.length)], AWNING[Math.floor(hash3(mm, s, 97) * AWNING.length)], seed);
        for (const e of [-1, 1]) podiumFace(f.full, x + cs * e * w / 2, z - sn * e * w / 2, yaw + e * Math.PI / 2, dep, h, st, g, WIN[0], AWNING[0], seed + e);
        f.full.box(x, h, z, w * 0.4, 2.4, dep * 0.4, yaw, mul(st, 0.9));
        f.low.box(x, 0, z, w, h, dep, yaw, st); f.low.panel(x + sn * dep / 2, 1, z + cs * dep / 2, w * 0.96, 4, yaw, g[0], 0.1); f.hasLow = true;
        batch.blob(x, z, w * 0.5, 0.4);
      }
      mm += w + 0.6;
    }
    F.flush(batch); F.map.clear();
  }
  // the ring's far towers share one draw, as they stand together
  const ring = { full: new Raw(), low: new Raw(), hasLow: true };
  const named = (fn, x, z, far = true, r = 60, shared = null) => {
    if (shared) { fn(shared.full, false, x, z); fn(shared.low, true, x, z); batch.blob(x, z, r, 0.45); return; }
    const full = new Raw(), low = new Raw(); fn(full, false, x, z); fn(low, true, x, z);
    batch.add(full.geometry(), far ? { far: true, low: low.geometry() } : { low: low.geometry() });
    batch.blob(x, z, r, 0.45);
  };
  // west: Hotel Indonesia, straight across the pool from the road, with Menara BCA over its shoulder
  { const [x, z] = lot(-1.4, 118), yaw = yawTo(x, z, hx, hz); named((R, low) => hotelIndonesia(R, x, z, yaw, low), x, z, false, 70); }
  { const [x, z] = lot(-1.75, 238), yaw = yawTo(x, z, hx, hz); named((R, low) => { towerLow(R, x, z, yaw, 42, 30, 230, c('#6f94ac'), c('#3f6a88')); R.box(x, 230, z, 18, 5, 12, yaw, c('#d4dee4')); if (!low) { R.box(x, 0, z, 62, 20, 52, yaw, c('#ddd6c6'), null, 0.84); R.sign('GRAND', x + Math.sin(yaw) * 26, 12, z + Math.cos(yaw) * 26, yaw, 46, 4, c('#f4efe4'), c('#3a4a5a'), 0.2); } }, x, z, true, 50, ring); }
  // south east: the great cream hotel with its grid
  { const [x, z] = lot(2.2, 152), yaw = yawTo(x, z, hx, hz); named((R, low) => gridSlab(R, x, z, yaw, 50, 22, 92, c('#f0e8d2'), c('#4a6478'), 13, 20, { low }), x, z, true, 44, ring); }
  // north east: the plaza and its hotel tower
  { const [x, z] = lot(0.72, 158), yaw = yawTo(x, z, hx, hz); named((R, low) => { R.box(x, 0, z, 72, 22, 34, yaw, c('#e6dcc8'), null, 0.86); gridSlab(R, x, z, yaw, 44, 22, 104, c('#e9dfca'), c('#567a90'), 11, 22, { base: 22, low }); if (!low) { R.panel(x + Math.sin(yaw) * 17, 2, z + Math.cos(yaw) * 17, 66, 13, yaw, c('#6f96aa'), 0.06); R.sign('PLAZA', x + Math.sin(yaw) * 17, 16, z + Math.cos(yaw) * 17, yaw, 40, 3.6, WHITE, c('#a04a3a'), 0.2); } }, x, z, true, 46, ring); }
  // east: a blue glass office, and north west another old slab
  { const [x, z] = lot(1.55, 176), yaw = yawTo(x, z, hx, hz); tower(ring, x, z, yaw, 34, 28, 150, 7041, { plain: true }); }
  { const [x, z] = lot(-0.72, 170), yaw = yawTo(x, z, hx, hz); named((R, low) => gridSlab(R, x, z, yaw, 34, 24, 118, c('#e8e4da'), c('#55707f'), 8, 26, { low }), x, z, true, 40, ring); }
  // Behind the pair as the avenue comes down on them: the pale slab of the great hotel with its round ends, two towers of curved glass, and in front of them a long low block in green glass.
  { const [x, z] = lot(2.62, 190), yaw = yawTo(x, z, hx, hz); named((R, low) => { const P0 = c('#efe6d4'); gridSlab(R, x, z, yaw, 58, 18, 92, P0, c('#6f8796'), 15, 20, { low }); for (const e of [-1, 1]) R.cyl(x + e * 29 * Math.cos(yaw), 0, 92, z - e * 29 * Math.sin(yaw), 9, 9, P0, mul(P0, 1.05), low ? 8 : 16, true); }, x, z, true, 44, ring); }
  { const [x, z] = lot(3.05, 205), yaw = yawTo(x, z, hx, hz) + 0.5; named((R, low) => curvedGlass(R, x, z, yaw, 27, 14, 158, c('#2c5a68'), low), x, z, true, 36, ring); }
  { const [x, z] = lot(2.8, 275), yaw = yawTo(x, z, hx, hz) - 0.4; named((R, low) => curvedGlass(R, x, z, yaw, 23, 17, 196, c('#2f4c6a'), low), x, z, true, 36, ring); }
  { const [x, z] = lot(2.95, 122), yaw = yawTo(x, z, hx, hz); if (clear(x, z, 26)) named((R, low) => { const GG = c('#3f8f76'); R.box(x, 0, z, 66, 22, 26, yaw, mul(GG, 1.35), mul(GG, 1.1), 0.7); if (!low) for (let i = 0; i < 5; i++) R.box(x, 2 + i * 4.2, z, 66.3, 0.5, 26.3, yaw, c('#dfe4dc'), c('#dfe4dc'), 1); R.box(x, 22, z, 40, 2.4, 16, yaw, c('#cfd2cc')); }, x, z, true, 40, ring); }
  // the far side of the pool has its own wall of offices behind the hotel, or the eye goes straight through to open ground
  for (const [a0, dd, h, sd] of [[-2.5, 196, 62, 7051], [-2.05, 186, 84, 7052], [-1.05, 182, 48, 7053], [-0.72, 214, 96, 7054], [-0.3, 200, 58, 7055], [-2.9, 210, 74, 7056]]) {
    const [x, z] = lot(a0, dd), yaw = yawTo(x, z, hx, hz);
    if (clear(x, z, 26)) tower(ring, x, z, yaw, 34, 26, h, sd, { plain: true });
  }
  batch.add(ring.full.geometry(), { far: true, low: ring.low.geometry() });

  // The city's tallest and the pen on the Sudirman skyline, seen from most of the lap.
  {
    const skyline = { full: new Raw(), low: new Raw(), hasLow: true };
    const pn = at(m('hi', -180)), [nx, nz] = off(pn, -(pn.hw + 96));
    named((R, low) => needleTower(R, nx, nz, 245, low), nx, nz, true, 40, skyline);
    for (const q of NAMED) named((R, low) => q.fn(R, q.x, q.z, q.yaw, q.h, low), q.x, q.z, true, 44, skyline);
    batch.add(skyline.full.geometry(), { far: true, low: skyline.low.geometry() });
  }
  // a cluster of SCBD on the east side of Sudirman: tall glass, what the skyline photo promises
  const scbd = { full: new Raw(), low: new Raw(), hasLow: true };
  for (const [q, mm, s, h] of [[0, 900, -1, 200], [1, 1000, -1, 170], [2, 1080, -1, 230], [3, 1190, 1, 190], [4, 1290, 1, 210]]) {
    const pa2 = at(m('sudirman', mm)), [x, z] = off(pa2, s * (pa2.hw + 130));
    tower(scbd, x, z, roadYaw(pa2), 34, 30, h, 4000 + q, { plain: true });
  }
  batch.add(scbd.full.geometry(), { far: true, low: scbd.low.geometry() });
  // the great mosque and the cathedral across from it, past the north east corner of the square, with their own lawns
  const mx = 470 * MAP, mz = -520 * MAP;
  addFar(istiqlal(), istiqlalLow(), mx + 40, mz - 40, 0, -0.1);
  addFar(cathedral(), cathedralLow(), mx + 150, mz + 110, 0, -Math.PI / 2 + 0.1);
  batch.add(paint(place(cylinder(120, 122, 0.3, 28), { p: [mx + 50, 0.14, mz - 30] }), '#7cb860'));
  // Gambir station on the east side of the square, its green roofs
  const gambir = [];
  const gp = at(m('merdeka', 290)), [gx, gz] = off(gp, -(gp.hw + 38));
  gambir.push(paint(place(box(36, 12, 110), { p: [0, 6, 0] }), '#7ec28f'), paint(place(box(42, 2, 116), { p: [0, 13, 0] }), '#3f9a63'), paint(place(box(24, 4, 94), { p: [0, 16, 0] }), '#f0ece0'));
  for (let i = 0; i < 9; i++) gambir.push(paint(place(box(0.4, 6, 8), { p: [18.1, 7, (i - 4) * 11.5] }), '#e8f0d8'));
  const gam = merge(gambir); place(gam, { p: [gx, 0, gz], r: [0, roadYaw(gp), 0] }); batch.add(gam);
  // the stadium west of Semanggi and the flying figure at Pancoran
  const sx = -1250 * MAP, sz = 2820 * MAP;
  addFar(stadium(), stadium(true), sx, sz, 0, 0.3);
  const dir = dirgantara(), dp = [560 * MAP, 3520 * MAP];
  place(dir, { p: [dp[0], 0, dp[1]], r: [0, -0.4, 0], s: 1.2 });
  batch.add(dir);

  // ---- the footbridge over the avenue: a steel truss in the blue of the buses with its glass sides and its roof, on real legs, and a long zigzag of ramps down to the pavement ----
  const ramp = (R, a, b, w, under) => {
    // a flight with thickness: top, two faces, the dark underside, a rail each side, and a leg at its lower end
    const dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz) || 1, nx = -dz / L * w / 2, nz = dx / L * w / 2, t = 0.34;
    const q = (o, y0, y1) => [[a[0] + nx * o, a[1] + y0, a[2] + nz * o], [b[0] + nx * o, b[1] + y1, b[2] + nz * o]];
    const [l0, l1] = q(1, 0, 0), [r0, r1] = q(-1, 0, 0), [lu0, lu1] = q(1, -t, -t), [ru0, ru1] = q(-1, -t, -t);
    R.quad(r0, l0, l1, r1, CONCRETE);
    R.quad(lu0, l0, l1, lu1, CONC_D); R.quad(r0, ru0, ru1, r1, CONC_D);
    R.quad(lu0, ru0, ru1, lu1, under);
    for (const [p0, p1] of [[l0, l1], [r0, r1]]) { R.bar([p0[0], p0[1] + 1.05, p0[2]], [p1[0], p1[1] + 1.05, p1[2]], 0.09, c('#2a70c8')); for (let i = 0; i <= 4; i++) { const u = i / 4, X = lerp(p0[0], p1[0], u), Y = lerp(p0[1], p1[1], u), Z = lerp(p0[2], p1[2], u); R.bar([X, Y, Z], [X, Y + 1.05, Z], 0.06, STEEL); } }
  };
  for (const [from, to, step0] of [[m('thamrin', 120), m('hi', -80), 380], [m('sudirman', 40), m('dukuh', -20), 300], [m('sudirman2', 120), m('semanggi', -120), 320]]) {
    for (let mm = from; mm < to; mm += step0) {
      const p = at(mm), yaw = roadYaw(p), y = track.heightAt(p.i, 0), R = F2Local(batch);
      const cs = Math.cos(yaw), sn = Math.sin(yaw), span = p.hw + (slipAt(mm) ? 12 : 9), BLUE = c('#2a70c8'), BLUED = c('#1f5aa8'), D = 6.5, W2 = 1.6, under = c('#4a4a52');
      // yaw is along the road, so across it is (cs, -sn)
      const P = (a, b, h) => [p.x + cs * a + sn * b, y + h, p.z - sn * a + cs * b];
      R.quad(P(-span, W2, D), P(span, W2, D), P(span, -W2, D), P(-span, -W2, D), CONCRETE);
      R.quad(P(-span, -W2, D - 0.5), P(span, -W2, D - 0.5), P(span, W2, D - 0.5), P(-span, W2, D - 0.5), under);
      for (const s of [-1, 1]) {
        const fa = s > 0 ? [P(-span, W2, D - 0.5), P(span, W2, D - 0.5), P(span, W2, D), P(-span, W2, D)] : [P(span, -W2, D - 0.5), P(-span, -W2, D - 0.5), P(-span, -W2, D), P(span, -W2, D)];
        R.quad(fa[0], fa[1], fa[2], fa[3], BLUED, BLUE);
        // top and bottom chords, diagonals, glass between
        R.bar(P(-span, s * W2, D + 3), P(span, s * W2, D + 3), 0.16, BLUE);
        const glassC = c('#a8d8e0');
        const gq = s > 0 ? [P(-span, W2, D + 0.05), P(span, W2, D + 0.05), P(span, W2, D + 2.4), P(-span, W2, D + 2.4)] : [P(span, -W2, D + 0.05), P(-span, -W2, D + 0.05), P(-span, -W2, D + 2.4), P(span, -W2, D + 2.4)];
        R.quad(gq[0], gq[1], gq[2], gq[3], glassC, mul(glassC, 1.12));
        const bays = 10;
        for (let i = 0; i < bays; i++) {
          const a0 = -span + (i / bays) * 2 * span, a1 = -span + ((i + 1) / bays) * 2 * span;
          R.bar(P(a0, s * (W2 + 0.04), D), P(a0, s * (W2 + 0.04), D + 3), 0.12, BLUE);
          R.bar(P(a0, s * (W2 + 0.04), i % 2 ? D : D + 3), P(a1, s * (W2 + 0.04), i % 2 ? D + 3 : D), 0.09, BLUE);
        }
        // its legs on the pavement, round and thick, with a head that takes the deck
        for (const b of [-1, 1]) { const [lx, ly, lz] = P(s * (span - 3), b * 1.5, 0); R.cyl(lx, ly, ly + D - 0.5, lz, 0.5, 0.42, CONC_D, CONCRETE, 8); }
        const [hx1, hy1, hz1] = P(s * (span - 3), 0, D - 1); R.boxU(hx1, hy1, hz1, 1.4, 0.6, 4.4, yaw + Math.PI / 2 * 0, CONCRETE, CONCRETE, 1, under);
        // the zigzag down, along the pavement: two flights and a landing
        const A = P(s * span, 0, D), B2 = P(s * span, 13, 3.4), C2 = P(s * (span + 2.6), 13, 3.4), D2 = P(s * (span + 2.6), 0, 0.2);
        ramp(R, A, B2, 2.1, under); ramp(R, C2, D2, 2.1, under);
        R.quad(P(s * (span - 1.1) , 14.2, 3.4), P(s * (span + 3.8), 14.2, 3.4), P(s * (span + 3.8), 11.9, 3.4), P(s * (span - 1.1), 11.9, 3.4), CONCRETE);
        const [leg1, lyy, leg2] = P(s * (span + 1.3), 13.4, 0); R.cyl(leg1, lyy, lyy + 3.3, leg2, 0.26, 0.26, CONC_D, CONC_D, 6);
        const [leg3, lyy3, leg4] = P(s * span, 6.5, 0); R.cyl(leg3, lyy3, lyy3 + 4.9, leg4, 0.2, 0.2, CONC_D, CONC_D, 6);
      }
      // A halte beside the bridge: the raised glass shelter of the bus lanes, on its platform, one side open to the road, and the sloping link that climbs to the footbridge.
      if (slipAt(mm + 40)) {
        const H0 = p.hw + 2.7, L0 = 7, L1 = 44, B1 = 1.25, RED2 = c('#c8362e'), BL2 = c('#2a5fb0'), GL2 = c('#8fc6cf'), ST = c('#d9dcdc'), Q = (a, b, h) => P(a, b, h);
        for (const s2 of [-1]) {
          const a0 = s2 * (H0 - 1.75), a1 = s2 * (H0 + 1.75), sq = (A0, A1, b0, b1, h, col, top = col) => { R.quad(Q(A0, b0, h), Q(A1, b0, h), Q(A1, b1, h), Q(A0, b1, h), col, top); R.quad(Q(A1, b0, h), Q(A0, b0, h), Q(A0, b1, h), Q(A1, b1, h), col, top); };
          // the platform on its posts, under it the shade of the road
          sq(a0, a1, L0, L1, B1, c('#b8b4a8'));
          for (const e of [a0, a1]) { R.quad(Q(e, L0, 0), Q(e, L1, 0), Q(e, L1, B1), Q(e, L0, B1), c('#6a6a68')); R.quad(Q(e, L1, 0), Q(e, L0, 0), Q(e, L0, B1), Q(e, L1, B1), c('#6a6a68')); }
          // glass both sides, a red and blue band, and a long curved white roof
          for (const e of [a0, a1]) { R.quad(Q(e, L0, B1 + 0.5), Q(e, L1, B1 + 0.5), Q(e, L1, B1 + 2.6), Q(e, L0, B1 + 2.6), GL2, mul(GL2, 1.15)); R.quad(Q(e, L1, B1 + 0.5), Q(e, L0, B1 + 0.5), Q(e, L0, B1 + 2.6), Q(e, L1, B1 + 2.6), GL2, mul(GL2, 1.15)); R.quad(Q(e, L0, B1), Q(e, L1, B1), Q(e, L1, B1 + 0.5), Q(e, L0, B1 + 0.5), RED2); R.quad(Q(e, L1, B1), Q(e, L0, B1), Q(e, L0, B1 + 0.5), Q(e, L1, B1 + 0.5), RED2); }
          for (let i = 0; i < 6; i++) { const t0 = (i / 6 - 0.5) * Math.PI * 0.82, t1 = ((i + 1) / 6 - 0.5) * Math.PI * 0.82, X = (t) => s2 * H0 + Math.sin(t) * 2.2, Y = (t) => B1 + 2.6 + Math.cos(t) * 0.9 - 0.3; R.quad(Q(X(t1), L0 - 1, Y(t1)), Q(X(t0), L0 - 1, Y(t0)), Q(X(t0), L1 + 1, Y(t0)), Q(X(t1), L1 + 1, Y(t1)), i < 3 ? ST : mul(ST, 0.94)); R.quad(Q(X(t0), L0 - 1, Y(t0) - 0.04), Q(X(t1), L0 - 1, Y(t1) - 0.04), Q(X(t1), L1 + 1, Y(t1) - 0.04), Q(X(t0), L1 + 1, Y(t0) - 0.04), c('#7a7c7e')); }
          for (let i = 0; i <= 8; i++) { const [lx, ly, lz] = Q(a0 + (a1 - a0) * 0.02, lerp(L0, L1, i / 8), 0); R.cyl(lx, ly, ly + B1 + 3, lz, 0.1, 0.1, BL2, BL2, 5); const [mx2, my2, mz2] = Q(a1 - (a1 - a0) * 0.02, lerp(L0, L1, i / 8), 0); R.cyl(mx2, my2, my2 + B1 + 3, mz2, 0.1, 0.1, BL2, BL2, 5); }
          // the link: up from the platform to the deck over the road
          const ax = s2 * H0, r0 = Q(ax, L0, B1), r1 = Q(ax, 1.6, D);
          ramp(R, r0, r1, 2.2, under);
          for (const e of [-1.1, 1.1]) { R.bar(Q(ax + e, L0, B1 + 1.2), Q(ax + e, 1.6, D + 1.2), 0.07, BLUE); }
        }
      }
      // the roof, thin and curved at the edges
      R.boxU(p.x, y + D + 3.05, p.z, span * 2 + 1, 0.16, 4, yaw + Math.PI / 2 * 0, c('#f0f2f2'), c('#d8dcde'), 1, c('#6a6e74'));
      R.flush();
    }
  }

  // ---- a pair of ondel-ondel working the pavement, where a real pair would ----
  for (const [mm, s, d] of [[m('thamrin', 150), 1, 5], [m('merdeka', 400), -1, 3.4], [m('saharjo', 700), -1, 3.2], [m('kampung', 180), 1, 1.3], [m('sudirman2', 230), -1, 5]]) {
    const p = at(mm), q = at(mm + 4), [a, b] = off(p, s * (p.hw + d)), [a2, b2] = off(q, s * (q.hw + d)), yaw = roadYaw(p) + (s > 0 ? -1 : 1) * Math.PI / 2 * 0.5;
    const o1 = ondel(true), o2 = ondel(false);
    place(o1, { p: [a, 0.16, b], r: [0, yaw, 0] }); place(o2, { p: [a2, 0.16, b2], r: [0, yaw, 0] });
    batch.add(merge([o1, o2])); batch.blob(a, b, 2, 0.4); batch.blob(a2, b2, 2, 0.4);
  }

  // ---- where the road jumps: no hay in this city. Stacks of old tyres, painted red and white, and the sign that names the bump for what it is ----
  for (const j of track.jumps) {
    const R = F2Local(batch), yaw = Math.atan2(j.tx, j.tz), fi = j.u * n;
    for (const s of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const dd = s * (j.w / 2 + 1 + k * 0.08), a = -k * 2.6, x = j.x + j.nx * dd + j.tx * a, z = j.z + j.nz * dd + j.tz * a, y = track.heightAt(fi + a / track.step, s * j.w / 2);
        for (let q = 0; q < 3; q++) R.cyl(x, y + q * 0.34, y + q * 0.34 + 0.32, z, 0.5, 0.5, q % 2 ? WHITE : RED, q % 2 ? WHITE : RED, 9, true);
      }
      const dd = s * (j.w / 2 + 1.6), x = j.x + j.nx * dd + j.tx * 3, z = j.z + j.nz * dd + j.tz * 3, y = track.heightAt(fi + 3 / track.step, s * j.w / 2);
      R.cyl(x, y, y + 3, z, 0.05, 0.05, STEEL, STEEL, 5);
      R.sign('POLISI TIDUR', x, y + 2.2, z, yaw + Math.PI, 3, 0.8, c('#f2c23a'), DARK, 0.04);
    }
    R.flush();
  }

  // ---- the flyover over Dr Saharjo: another road, at another level, just as full ----
  {
    const p = at(m('saharjo', 480)), yaw = roadYaw(p) + 0.45, cs = Math.cos(yaw), sn = Math.sin(yaw), R = F2Local(batch), span = 260, y = 9;
    R.boxU(p.x, y, p.z, span, 1.2, 15, yaw + Math.PI / 2 * 0, CONCRETE, c('#6a6670'));
    R.box(p.x + sn * 7.6, y + 1.2, p.z + cs * 7.6, span, 1, 0.4, yaw, CONC_D);
    R.box(p.x - sn * 7.6, y + 1.2, p.z - cs * 7.6, span, 1, 0.4, yaw, CONC_D);
    for (let a = -130; a <= 130; a += 26) { if (Math.abs(a) < 18) continue; R.box(p.x + cs * a, 0, p.z - sn * a, 3, y, 8, yaw, CONC_D); }
    for (const a of [-20, 20]) R.box(p.x + cs * a, 0, p.z - sn * a, 2.2, y, 8, yaw, CONC_D);
    // what is stuck up there is never going to come down
    for (let a = -120, q = 0; a < 120; a += 7.5, q++) {
      const col = [WHITE, c('#c9ccd2'), c('#46494f'), c('#b53b34'), c('#6fc2e8')][q % 5], off2 = (q % 2 ? 3.4 : -3.4);
      R.box(p.x + cs * a + sn * off2, y + 1.3, p.z - sn * a + cs * off2, 3.8, 1.4, 1.8, yaw, col);
    }
    R.flush();
  }

  // ---- the abandoned monorail columns, stumps in a row on the Sudirman end of the road: nobody ever finished them ----
  for (let mm = m('sudirman2', 40); mm < m('sudirman2', 560); mm += 44) {
    const p = at(mm), [x, z] = off(p, p.hw + 6.5), R = F2Local(batch);
    R.cyl(x, 0, 12 + hash3(mm, 2, 2) * 3, z, 1.3, 1.2, mix(CONCRETE, c('#8f8878'), 0.5), mix(CONCRETE, c('#8f8878'), 0.3), 8, true);
    R.flush();
  }

  // ---- the rail viaduct over the underpass at Dukuh Atas ----
  {
    const p = at(m('dukuh', 72)), yaw = roadYaw(p), R = new Raw();
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    R.boxU(p.x, 2.4, p.z, 700, 1.6, 9, yaw, CONCRETE);
    // beams under the deck, and the shadow between them
    for (let a = -36; a <= 36; a += 4.5) R.boxU(p.x + cs * a, 1.9, p.z - sn * a, 0.9, 0.5, 8.4, yaw, mul(CONCRETE, 0.8), null, 1, mul(CONCRETE, 0.5));
    R.box(p.x, 4, p.z, 700, 0.8, 9.4, yaw, CONC_D);
    for (let a = -340; a <= 340; a += 34) { if (Math.abs(a) < 26) continue; R.box(p.x + cs * a, -2, p.z - sn * a, 3, 5, 6, yaw, CONC_D); }
    for (const s of [-1, 1]) R.box(p.x + sn * s * 3.2, 4.8, p.z + cs * s * 3.2, 700, 0.2, 0.2, yaw, STEEL);
    for (let a = -340; a <= 340; a += 40) R.box(p.x + cs * a, 4.8, p.z - sn * a, 0.3, 6, 0.3, yaw, STEEL);
    batch.add(R.geometry());
    // walls of the cutting
    const W2 = new Raw();
    for (let mm = m('dukuh', -60); mm < m('dukuh', 200); mm += 12) {
      const q = at(mm), q2 = at(mm + 12);
      for (const s of [-1, 1]) {
        const d = s * (q.hw + 1.1), a = [q.x + q.nx * d, q.y - 0.5, q.z + q.nz * d], b = [q2.x + q2.nx * d, q2.y - 0.5, q2.z + q2.nz * d];
        W2.quad(a, b, [b[0], 0.8, b[2]], [a[0], 0.8, a[2]], mul(CONCRETE, 0.9), CONCRETE);
      }
    }
    batch.add(W2.geometry());
  }

  // ---- the toll road: sound walls on some stretches, the gantry, huge billboards ----
  {
    const gate = at(m('tolgate', 40)), yaw = roadYaw(gate), cs = Math.cos(yaw), sn = Math.sin(yaw), y = track.heightAt(gate.i, 0);
    const R2 = new Raw();
    R2.boxU(gate.x, y + 6.4, gate.z, gate.w + 9, 1.8, 7, yaw + Math.PI / 2 * 0, c('#2a70c8'), WHITE);
    R2.box(gate.x, y + 8.2, gate.z, gate.w + 9, 0.4, 8, yaw, WHITE);
    for (const s of [-1, 1]) R2.box(gate.x + cs * s * (gate.hw + 2.6), y, gate.z - sn * s * (gate.hw + 2.6), 2.2, 6.4, 5, yaw, c('#f2c23a'));
    const ou = 3.7;
    R2.sign('GERBANG TOL', gate.x - sn * ou, y + 6.5, gate.z - cs * ou, yaw + Math.PI, 15, 1.6, c('#2a70c8'), WHITE, 0.12);
    batch.add(R2.geometry());
    // the green direction gantries of the toll road, on steel legs: real exits, big white letters
    {
      const words = [['SEMANGGI', 'TOMANG'], ['KUNINGAN', 'CAWANG'], ['TEBET', 'PANCORAN'], ['MANGGARAI', 'CIKINI']], GR = c('#1f7a4f'), GRD = c('#17603e');
      let j = 0;
      for (let mm = m('tol', 170); mm < m('ramp', -60); mm += 340, j++) {
        const g = at(mm), yw = roadYaw(g), csG = Math.cos(yw), snG = Math.sin(yw), yy = track.heightAt(g.i, 0), span = g.hw + 1.2, Gn = new Raw(), P = (a, h) => [g.x + csG * a, yy + h, g.z - snG * a];
        if (mm > m('tolgate', -40) && mm < m('tolgate', 110)) continue;
        for (const s of [-1, 1]) { const q = P(s * span, 0); Gn.cyl(q[0], q[1], q[1] + 7.6, q[2], 0.22, 0.2, STEEL, STEEL, 8); }
        for (const h of [6.5, 7.4]) Gn.bar(P(-span, h), P(span, h), 0.14, STEEL);
        for (let q = 0; q < 7; q++) { const a0 = -span + (q / 7) * 2 * span, a1 = -span + ((q + 1) / 7) * 2 * span; Gn.bar(P(a0, q % 2 ? 6.5 : 7.4), P(a1, q % 2 ? 7.4 : 6.5), 0.09, STEEL); }
        const [A, B] = words[j % words.length], back = yw + Math.PI, W = span * 0.86;
        for (const [o, word] of [[-W / 2, A], [W / 2, B]]) {
          const q = P(o, 5.4), bx = q[0] - snG * 0.2, bz = q[2] - csG * 0.2;
          Gn.boxU(bx, q[1], bz, W * 0.94, 3.2, 0.2, yw, GR, GR, 1, GRD);
          Gn.panel(bx, q[1] + 0.08, bz, W * 0.9, 0.12, back, WHITE, 0.112); Gn.panel(bx, q[1] + 3, bz, W * 0.9, 0.12, back, WHITE, 0.112);
          Gn.text(word, bx - snG * 0.13, q[1] + 0.86, bz - csG * 0.13, back, 1.5, WHITE, { fit: W * 0.82, weight: 0.16 });
        }
        batch.add(Gn.geometry());
      }
    }
    const W3 = new Blocks(300);
    for (let mm = m('tol', 30); mm < m('ramp', -30); mm += 58) {
      const q = at(mm), yq = track.heightAt(q.i, 0), R = W3.at(q.x, q.z).full;
      for (const s of [-1, 1]) {
        const x = q.x + q.nx * s * (q.hw + 0.6), z = q.z + q.nz * s * (q.hw + 0.6), x2 = q.x + q.nx * s * (q.hw - 2.2), z2 = q.z + q.nz * s * (q.hw - 2.2);
        R.cyl(x, yq + 0.8, yq + 11, z, 0.13, 0.08, STEEL, mul(STEEL, 1.1), 6);
        R.bar([x, yq + 10.8, z], [x2, yq + 11.5, z2], 0.1, STEEL);
        R.box(x2, yq + 11.3, z2, 0.32, 0.14, 1, roadYaw(q) + Math.PI / 2, c('#d8d8d4'), c('#fff0b0'), 1);
      }
    }
    for (let mm = m('tol', 60); mm < m('ramp', -50); mm += 16) {
      const q = at(mm), q2 = at(mm + 16);
      if (Math.floor(mm / 500) % 2) continue;
      for (const s of [-1, 1]) {
        const d = s * (q.hw + 0.5), yq = track.heightAt(q.i, 0), yq2 = track.heightAt(q2.i, 0), a = [q.x + q.nx * d, yq + 0.9, q.z + q.nz * d], b = [q2.x + q2.nx * d, yq2 + 0.9, q2.z + q2.nz * d];
        W3.at(a[0], a[2]).full.quad(a, b, [b[0], yq2 + 3.5, b[2]], [a[0], yq + 3.5, a[2]], c('#b8c7c4'), c('#d7e0da'));
        // now and then the city has let a school paint it: bands of batik parang, the diagonal that says Java from any distance
        if (Math.floor(mm / 16) % 3 === 1) {
          const W = W3.at(a[0], a[2]).full, off = 0.1, ox = q.nx * -s * off, oz = q.nz * -s * off, seed = Math.floor(mm), base = PAINT[Math.floor(hash3(seed, s, 3) * PAINT.length)], ink = mix(base, c('#3a2a2a'), 0.55), pale = mix(base, WHITE, 0.72), LO = 1.5, HI = 3.4;
          const Pm = (u, v) => { const k = u / 16; return s > 0 ? [lerp(a[0], b[0], k) + ox, lerp(a[1], b[1], k) - 0.9 + v, lerp(a[2], b[2], k) + oz] : [lerp(a[0], b[0], k) + ox, lerp(a[1], b[1], k) - 0.9 + v, lerp(a[2], b[2], k) + oz]; };
          const face = (A, B, C, D, col) => { const ux = B[0] - A[0], uz = B[2] - A[2], fx = -q.nx * s, fz = -q.nz * s; if ((uz * 1 * fx - ux * fz) > 0) W.quad(A, B, C, D, col); else W.quad(D, C, B, A, col); };
          face(Pm(0, LO), Pm(16, LO), Pm(16, HI), Pm(0, HI), base);
          for (let u = 0; u < 15.2; u += 1.7) {
            face(Pm(u, LO + 0.06), Pm(u + 0.52, LO + 0.06), Pm(u + 1.5, HI - 0.06), Pm(u + 0.98, HI - 0.06), ink);
            face(Pm(u + 0.66, LO + 0.06), Pm(u + 0.86, LO + 0.06), Pm(u + 1.72, HI - 0.06), Pm(u + 1.52, HI - 0.06), pale);
          }
        }
        // its panels: an H post every span and a darker band along the foot, so that it reads as a wall and not as the edge of the world
        { const W = W3.at(a[0], a[2]).full, off = 0.12, px = q.nx * -s * off, pz = q.nz * -s * off, PC = c('#7f8c8a'), BD = c('#8ea09c');
          W.quad([a[0] + px, a[1], a[2] + pz], [b[0] + px, b[1], b[2] + pz], [b[0] + px, b[1] + 0.7, b[2] + pz], [a[0] + px, a[1] + 0.7, a[2] + pz], BD);
          W.quad([a[0] + px - q.tx * 0.2, a[1], a[2] + pz - q.tz * 0.2], [a[0] + px + q.tx * 0.2, a[1], a[2] + pz + q.tz * 0.2], [a[0] + px + q.tx * 0.2, a[1] + 2.75, a[2] + pz + q.tz * 0.2], [a[0] + px - q.tx * 0.2, a[1] + 2.75, a[2] + pz - q.tz * 0.2], PC); }
      }
    }
    W3.flush(batch);
    for (let mm = m('tol', 200), j = 0; mm < m('ramp', -200); mm += 360, j++) {
      const q = at(mm), s = j % 2 ? 1 : -1, [x, z] = off(q, s * (q.hw + 14)), yy = track.heightAt(q.i, 0);
      const B = new Raw(), col = PAINT[(j * 3) % PAINT.length], words = ['KOPI MANTAP', 'ES TEH MANIS', 'KECAP ASLI', 'MIE GORENG', 'SAMBAL PEDAS', 'KRUPUK UDANG'];
      B.cyl(x, 0, yy + 10, z, 0.7, 0.6, STEEL, STEEL, 6);
      const face2 = roadYaw(q) + Math.PI;
      B.box(x, yy + 10, z, 26, 11, 0.6, roadYaw(q), WHITE);
      B.panel(x, yy + 10.4, z, 25, 10.2, face2, col, 0.34);
      B.text(words[j % words.length], x + Math.sin(face2) * 0.4, yy + 13, z + Math.cos(face2) * 0.4, face2, 4, WHITE, { fit: 23, weight: 0.17 });
      batch.add(B.geometry());
    }
  }

  // ---- Manggarai: the railway across the road, gates and bell ----
  {
    const c0 = at(m('crossing', 2)), yaw = roadYaw(c0), R = new Raw(), cs = Math.cos(yaw), sn = Math.sin(yaw), L = 900;
    for (const a of [-1.2, 1.2]) {
      const pa2 = [c0.x + c0.tx * a, c0.z + c0.tz * a];
      R.box(pa2[0], 0.05, pa2[1], L, 0.12, 0.2, yaw, c('#6f7078'), null, 1);
    }
    R.box(c0.x, 0.03, c0.z, L, 0.05, 4.6, yaw, c('#574f4a'), null, 1);
    for (let d = -L / 2; d < L / 2; d += 2.2) {
      R.box(c0.x + cs * d, 0.07, c0.z - sn * d, 0.4, 0.05, 3.4, yaw, c('#3f3a36'), null, 1);
    }
    batch.add(R.geometry());
    const gates = crossingGates(track.samples.w[c0.i] / 2 + 1.2, 7);
    place(gates, { p: [c0.x, 0, c0.z], r: [0, yaw, 0] });
    batch.add(gates);
    // Manggarai station beyond the rails: the old long roof and its new tower, closing the end of Dr Saharjo
    const St = new Raw(), sx2 = c0.x + c0.tx * 150, sz2 = c0.z + c0.tz * 150;
    St.box(sx2, 0, sz2, 150, 9, 24, yaw, c('#e4dcc4'), null, 0.84);
    St.roof(sx2, 9, sz2, 158, 30, 6, yaw + Math.PI / 2 * 0, c('#9a5a3a'));
    // tall arched windows and doors along both long sides; a blank wall this size is the first thing the eye would stop on
    for (const sd of [-1, 1]) for (let q = -11; q <= 11; q++) {
      const fx3 = sx2 + cs * q * 6.4 + sn * sd * 12, fz3 = sz2 - sn * q * 6.4 + cs * sd * 12, fy3 = sd > 0 ? yaw : yaw + Math.PI;
      St.panel(fx3, 1.2, fz3, 3.4, 6.6, fy3, c('#f4eedc'), 0.05);
      St.panel(fx3, 1.6, fz3, 2.6, 5.6, fy3, q % 4 ? c('#46647a') : c('#5a4432'), 0.1);
    }
    gridSlab(St, sx2 + cs * 60, sz2 - sn * 60, yaw, 46, 30, 42, c('#dfe4e4'), c('#5f88a0'), 12, 8, {});
    batch.add(St.geometry());
  }

  // ---- the river: moored boats, the only thing in it that is meant to be ----
  if (rv) {
    const B = new Raw();
    for (let i = 60; i < rv.xs.length; i += 90) {
      const x = rv.xs[i], z = rv.zs[i], r0 = terrain.roadDistAt(x, z);
      if (r0 > 120) continue;
      const a = hash3(i, 1, 3) * 6, col = AWNING[i % AWNING.length];
      B.blob(x, -0.85, z, 0.9, 0.34, 3, c('#6a4a30'), col, 8, 3);
    }
    if (B.v) batch.add(B.geometry());
  }
  world.jakarta = { update: null };
}

// One small Raw into the batch at a time, for things that must not be held in the big district blocks.
function F2Local(batch) {
  const R = new Raw();
  R.flush = () => batch.add(R.geometry());
  return R;
}

// The jets of Bundaran HI rise and fall a little, out of step with nothing else in the city.
export function update(time) { if (jakartaJets) jakartaJets.scale.y = 1 + 0.07 * Math.sin(time * 1.7); }
