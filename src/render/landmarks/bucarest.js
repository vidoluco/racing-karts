// Bucharest: its real mix, street by street. Belle Epoque on Calea Victoriei, the cream walls of Unirii, interwar white on Magheru, blocks with balconies behind, villas under the chestnuts of Kiseleff and Aviatorilor.
// Flat clean colours in few big masses, so that the foreground goes with the paintings. The Parliament and the Ateneu wear the Gemini paintings themselves (tools/panoramas/bucarest-paint.py). Hand modelled: the Arc,
// the Fountains, the CEC, the Royal Palace, Cercul Militar, a white Belle Epoque hotel, the tall wedge at Universitate, Palatul Victoria, Unirea. Churches and the memorial stand clear and nothing touches them. Facts: docs/references/bucarest.md.
import * as THREE from 'three';
import { hash3, lerp, linear } from '../math.js';
import { Raw, Blocks } from './jakarta.js';

const c = (hex) => linear(hex);
const mul = (col, k) => [col[0] * k, col[1] * k, col[2] * k];
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const TAU = Math.PI * 2;
const say = (R, word, x, y, z, yaw, h, col, out) => R.text(word, x + Math.sin(yaw) * out, y, z + Math.cos(yaw) * out, yaw, h, col);

// the colours of the paintings: warm cream in the sun, lavender in the shade
const CREAM = c('#f3dfae'), CREAM2 = c('#ecd29c'), PEACH = c('#f0c79a'), ROSE = c('#e8b49c'), OCHRE = c('#e2b868'), SAGE = c('#c9c79c'), LILAC = c('#c4b2bc'), STONE = c('#e8dcc0'), WHITE = c('#f8f2e2');
const SHADE = c('#a6a0c2'), WIN = c('#6e6f9a'), WINL = c('#f8d48e'), ROOF = c('#6c6a78'), ROOFG = c('#7f9a8c'), DARK = c('#4c4750'), CONC = c('#c8bea8'), CONC2 = c('#b6ad9e'), BALC = c('#8f8b92'), SHOP = c('#8496a8'), AWN = [c('#c4503f'), c('#3f7f66'), c('#d9a23c'), c('#4f78a8')];
const WINS = c('#f7dc9e');
const BELLE = [CREAM, PEACH, ROSE, OCHRE, SAGE, LILAC, CREAM2, WHITE];
const LOW_BOX = (r, x, z, w, h, d, yaw, col) => { r.hasLow = true; r.low.box(x, 0, z, w, h, d, yaw, col, mul(ROOF, 1.1)); };

// ---------- buildings: y0 is the foot, yaw looks at the road ----------
function shopfront(R, x, y0, z, w, yaw, seed, h = 3.6) {
  const sn = Math.sin(yaw), cs = Math.cos(yaw), n = Math.max(1, Math.round(w / 5.5)), col = AWN[Math.floor(hash3(seed, 2, 9) * AWN.length)];
  R.panel(x, y0, z, w * 0.98, h, yaw, mul(STONE, 0.86), 0.06);
  for (let i = 0; i < n; i++) {
    const a = (i + 0.5) / n - 0.5, lx = x + cs * a * w, lz = z - sn * a * w, g = hash3(seed, i, 4) < 0.45 ? SHOP : WINS;
    R.panel(lx, y0 + 0.5, lz, w / n * 0.74, h * 0.56, yaw, g, 0.1);
    R.panel(lx, y0 + 0.5 + h * 0.56 * 0.5, lz, w / n * 0.74, 0.08, yaw, mul(g, 0.7), 0.13);
    if (hash3(seed, i, 5) < 0.55) {
      // an awning, a sloped flat colour
      const hw = w / n * 0.42, ax = lx + sn * 0.12, az = lz + cs * 0.12, bx = lx + sn * 1.3, bz = lz + cs * 1.3, yt = y0 + h * 0.95, yb = y0 + h * 0.72;
      R.quad([bx - cs * hw, yb, bz + sn * hw], [bx + cs * hw, yb, bz - sn * hw], [ax + cs * hw, yt, az - sn * hw], [ax - cs * hw, yt, az + sn * hw], col, mul(col, 1.1));
    }
  }
}

// a window with its surround, flat
function bay(R, x, y, z, yaw, w, h, surround, glass, out = 0.08) {
  R.panel(x, y - 0.2, z, w + 0.42, h + 0.5, yaw, surround, out);
  R.panel(x, y, z, w, h, yaw, glass, out + 0.03);
}

// Belle Epoque: three to five floors, a tall ground floor of shops, stone bands, a cornice and a mansard
function belle(F, x, y0, z, yaw, w, d, seed, { floors = 0 } = {}) {
  const r = F.at(x, z), R = r.full, col = BELLE[Math.floor(hash3(seed, 1, 3) * BELLE.length)], fl = floors || 3 + Math.floor(hash3(seed, 2, 3) * 3), H = 4.6 + fl * 3.7, sn = Math.sin(yaw), cs = Math.cos(yaw);
  const fx = x + sn * d / 2, fz = z + cs * d / 2;
  R.box(x, y0, z, w, H, d, yaw, col, mul(col, 0.92), 0.92);
  shopfront(R, fx, y0, fz, w, yaw, seed, 4.2);
  const lit = mul(col, 1.08), cols = Math.max(2, Math.round(w / 4.6)), arched = hash3(seed, 3, 3) < 0.5;
  for (let f = 0; f < fl; f++) {
    const yy = y0 + 5.2 + f * 3.7;
    R.panel(fx, yy - 0.72, fz, w * 0.99, 0.22, yaw, lit, 0.05); // the stone band of the floor
    for (let k = 0; k < cols; k++) {
      const a = (k + 0.5) / cols - 0.5, wx = fx + cs * a * w, wz = fz - sn * a * w, glow = hash3(seed, f * 7 + k, 6) < 0.13;
      bay(R, wx, yy, wz, yaw, 1.5, 2.2, lit, glow ? WINL : WIN);
      if (arched && f === fl - 1) R.blob(wx + sn * 0.1, yy + 2.3, wz + cs * 0.1, 1.05, 0.5, 0.12, lit, lit, 6, 2);
    }
  }
  for (const q of [-0.5, 0.5]) R.panel(fx + cs * q * (w - 0.8), y0 + 4.4, fz - sn * q * (w - 0.8), 0.8, H - 4.6, yaw, lit, 0.1);
  { const bal = Math.max(1, cols - (cols > 3 ? 2 : 1)); R.box(fx + sn * 0.5, y0 + 4.92, fz + cs * 0.5, bal * w / cols, 0.14, 1, yaw, lit); R.panel(fx + sn * 0.5, y0 + 5.05, fz + cs * 0.5, bal * w / cols, 0.82, yaw, DARK, 0.5); }
  for (let k = 0; k < cols; k++) { const a = (k + 0.5) / cols - 0.5, wx = fx + cs * a * w, wz = fz - sn * a * w, yy = y0 + 5.2 + 2.6; R.box(wx + sn * 0.16, yy, wz + cs * 0.16, 2.1, 0.18, 0.34, yaw, lit); }
  // the cornice, the mansard, its dormers
  R.box(fx - sn * 0.35, y0 + H - 0.1, fz - cs * 0.35, w + 0.5, 0.55, 0.9, yaw, mul(col, 1.1));
  const yr = y0 + H + 0.42;
  R.roof(x, yr, z, w * 0.98, d * 0.98, 3.2, yaw, hash3(seed, 4, 3) < 0.6 ? ROOF : ROOFG);
  if (hash3(seed, 6, 3) < 0.28) { const tx = fx + cs * w * 0.42 - sn * 1.2, tz = fz - sn * w * 0.42 - cs * 1.2; R.cyl(tx, y0 + H, y0 + H + 4.6, tz, 2.1, 1.9, mul(col, 1.05), col, 8); R.blob(tx, y0 + H + 4.6, tz, 2.1, 1.9, 2.1, ROOFG, mul(ROOFG, 1.15), 8, 3); }
  LOW_BOX(r, x, z, w, H + 1.4, d, yaw, col);
}

// a block of the seventies: ten floors of concrete, balconies, a row of shops, washing and aerials
function block(F, x, y0, z, yaw, w, d, seed, { floors = 0 } = {}) {
  const r = F.at(x, z), R = r.full, tone = hash3(seed, 1, 5), col = mix(CONC, tone < 0.5 ? c('#d6c4a4') : c('#c2bcb0'), 0.6), fl = floors || 8 + Math.floor(tone * 3), H = 4 + fl * 2.9, sn = Math.sin(yaw), cs = Math.cos(yaw);
  const fx = x + sn * d / 2, fz = z + cs * d / 2;
  R.box(x, y0, z, w, H, d, yaw, col, mul(col, 0.88), 0.9);
  shopfront(R, fx, y0, fz, w, yaw, seed, 3.8);
  const cols = Math.max(3, Math.round(w / 3.8));
  for (let f = 0; f < fl; f++) {
    const yy = y0 + 4.4 + f * 2.9;
    for (let k = 0; k < cols; k++) {
      const a = (k + 0.5) / cols - 0.5, wx = fx + cs * a * w, wz = fz - sn * a * w, e = hash3(seed, f * 13 + k, 7);
      R.panel(wx, yy, wz, 1.5, 1.5, yaw, e < 0.14 ? WINL : WIN, 0.05);
      if (k % 2 === 0) {
        // a balcony: its front, in a tone of its own; some closed in with whatever came to hand
        const bx = wx + sn * 0.55 + cs * 0.9, bz = wz + cs * 0.55 - sn * 0.9;
        R.box(bx, yy - 0.5, bz, 3.1, 1, 1.1, yaw, e > 0.72 ? mix(col, AWN[Math.floor(e * 40) % 4], 0.25) : BALC, mul(col, 0.8));
      }
    }
  }
  // aerials on the roof
  for (let k = 0; k < 2; k++) { const a = hash3(seed, k, 8) - 0.5, ax = x + cs * a * w, az = z - sn * a * w; R.bar([ax, y0 + H, az], [ax, y0 + H + 2.6, az], 0.09, DARK); R.bar([ax - 0.7, y0 + H + 2.1, az], [ax + 0.7, y0 + H + 2.1, az], 0.06, DARK); }
  LOW_BOX(r, x, z, w, H, d, yaw, col);
}

// Bulevardul Unirii's own wall: nine floors, cream, one long front with its row of arches along the top and its stone ground floor
function unirii(F, x, y0, z, yaw, w, d, seed) {
  const r = F.at(x, z), R = r.full, H = 34, sn = Math.sin(yaw), cs = Math.cos(yaw), fx = x + sn * d / 2, fz = z + cs * d / 2, col = hash3(seed, 1, 5) < 0.5 ? CREAM : CREAM2;
  R.box(x, y0, z, w, H, d, yaw, col, mul(col, 0.9), 0.94);
  shopfront(R, fx, y0, fz, w, yaw, seed, 5);
  const cols = Math.round(w / 3.9), lit = mul(col, 1.08);
  R.panel(fx, y0 + 5.2, fz, w, 0.7, yaw, lit, 0.05);
  for (let f = 0; f < 8; f++) {
    const yy = y0 + 7 + f * 3.15;
    for (let k = 0; k < cols; k++) {
      const a = (k + 0.5) / cols - 0.5, wx = fx + cs * a * w, wz = fz - sn * a * w, e = hash3(seed, f * 11 + k, 9);
      R.panel(wx, yy, wz, 1.9, 2.1, yaw, f === 7 ? SHADE : e < 0.12 ? WINL : WIN, 0.05);
      if (f === 7) R.blob(wx + sn * 0.08, yy + 2.1, wz + cs * 0.08, 0.98, 0.7, 0.1, SHADE, SHADE, 6, 2);
      else if (k % 4 === 1) R.box(wx + sn * 0.4, yy - 0.3, wz + cs * 0.4, 2.6, 0.5, 0.8, yaw, lit);
    }
  }
  R.box(fx - sn * 0.4, y0 + H - 0.1, fz - cs * 0.4, w + 0.3, 0.7, 1, yaw, lit);
  LOW_BOX(r, x, z, w, H, d, yaw, col);
}

// Magheru's interwar white: twelve floors, long horizontal bands of window and rounded corners, a roof sign in neon
const NEON = ['PATRIA', 'SCALA', 'LUCEAFARUL', 'BIS', 'TIMPURI NOI'];
function modern(F, x, y0, z, yaw, w, d, seed) {
  const r = F.at(x, z), R = r.full, fl = 9 + Math.floor(hash3(seed, 1, 6) * 4), H = 6 + fl * 3, sn = Math.sin(yaw), cs = Math.cos(yaw), fx = x + sn * d / 2, fz = z + cs * d / 2, col = hash3(seed, 2, 6) < 0.6 ? WHITE : c('#efe2c8');
  R.box(x, y0, z, w, H, d, yaw, col, mul(col, 0.9), 0.95);
  shopfront(R, fx, y0, fz, w, yaw, seed, 5.2);
  for (let f = 0; f < fl; f++) {
    const yy = y0 + 6.6 + f * 3;
    R.panel(fx, yy, fz, w * 0.88, 1.5, yaw, hash3(seed, f, 8) < 0.2 ? mix(WIN, WINL, 0.6) : WIN, 0.06);
    if (f % 3 === 1) R.box(fx + sn * 0.4, yy - 0.4, fz + cs * 0.4, w * 0.88, 0.32, 0.9, yaw, mul(col, 1.05));
  }
  // the setback top floors
  R.box(x - sn * 1.5, y0 + H, z - cs * 1.5, w * 0.72, 6, d * 0.66, yaw, mul(col, 0.97), mul(col, 0.9));
  if (hash3(seed, 3, 6) < 0.26) { R.box(fx + sn * 0.18, y0 + 5.3, fz + cs * 0.18, w * 0.5, 2.4, 0.2, yaw, c('#3a3744')); say(R, NEON[Math.floor(hash3(seed, 4, 6) * NEON.length)], fx, y0 + 5.7, fz, yaw, 1.5, c('#ff8a78'), 0.32); }
  LOW_BOX(r, x, z, w, H + 5, d, yaw, col);
}

// a villa of the Kiseleff and Aviatorilor quarter: stucco, a tiled hip roof, a bow window, an iron fence along the pavement
function villa(F, x, y0, z, yaw, w, d, seed) {
  const r = F.at(x, z), R = r.full, col = BELLE[Math.floor(hash3(seed, 1, 7) * BELLE.length)], H = 8 + hash3(seed, 2, 7) * 4, sn = Math.sin(yaw), cs = Math.cos(yaw), fx = x + sn * d / 2, fz = z + cs * d / 2;
  R.box(x, y0, z, w, H, d, yaw, col, mul(col, 0.92), 0.92);
  R.roof(x, y0 + H, z, w + 0.8, d + 0.8, 3.6, yaw, c('#b7694c'));
  const cols = Math.max(2, Math.round(w / 3.6));
  for (let f = 0; f < 2; f++) for (let k = 0; k < cols; k++) {
    const a = (k + 0.5) / cols - 0.5;
    bay(R, fx + cs * a * w, y0 + 1.5 + f * 3.4, fz - sn * a * w, yaw, 1.3, 2, mul(col, 1.1), hash3(seed, f + k * 3, 8) < 0.22 ? WINL : WIN);
  }
  LOW_BOX(r, x, z, w, H + 1, d, yaw, col);
}

// ---------- street furniture ----------
// the ornate lamp of the boulevards, the one in the painting: a dark pole, curved arms, three white globes
function lamp(R, x, y, z, yaw, tall = 7.5) {
  const K = DARK, sn = Math.sin(yaw), cs = Math.cos(yaw);
  R.cyl(x, y, y + tall, z, 0.13, 0.07, K, K, 5);
  for (const s of [-1, 1]) {
    const ax = x + cs * s * 0.7, az = z - sn * s * 0.7;
    R.bar([x, y + tall - 1, z], [ax, y + tall - 0.1, az], 0.07, K);
    R.blob(ax, y + tall + 0.14, az, 0.25, 0.28, 0.25, WHITE, WHITE, 5, 2);
  }
  R.blob(x, y + tall + 0.45, z, 0.25, 0.28, 0.25, WHITE, WHITE, 5, 2);
}
function pole(R, x, y, z) { R.cyl(x, y, y + 7.2, z, 0.14, 0.09, c('#8c8680'), c('#8c8680'), 5); }
function wire(R, a, b, sag = 0.5, t = 0.035, col = DARK) {
  const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - sag, (a[2] + b[2]) / 2];
  R.bar(a, mid, t, col); R.bar(mid, b, t, col);
}
// a kiosk: ziare, tutun, flori
function kiosk(R, x, y, z, yaw, kind, seed) {
  const col = [c('#4f8a6c'), c('#d9b04c'), c('#c8604a'), c('#5a84b4')][Math.floor(hash3(seed, 2, 2) * 4)], sn = Math.sin(yaw), cs = Math.cos(yaw);
  R.box(x, y, z, 3.6, 2.6, 2.4, yaw, col, mul(col, 0.85));
  R.box(x, y + 2.6, z, 4.2, 0.28, 3, yaw, WHITE);
  const fx = x + sn * 1.2, fz = z + cs * 1.2;
  R.panel(fx, y + 1, fz, 3, 1.2, yaw, WINL, 0.03);
  say(R, kind, fx, y + 2.74, fz + 0, yaw, 0.42, DARK, 0.32);
}
// the covrigi stall: warm window, the rings hung in rows, the smell of the street
function covrigi(R, x, y, z, yaw) {
  const sn = Math.sin(yaw), cs = Math.cos(yaw), W = c('#b77b3e');
  R.box(x, y, z, 3.2, 2.5, 2, yaw, W, mul(W, 0.86));
  R.box(x, y + 2.5, z, 3.8, 0.24, 2.7, yaw, c('#fff0c8'));
  const fx = x + sn * 1, fz = z + cs * 1;
  R.panel(fx, y + 0.9, fz, 2.8, 1.3, yaw, c('#ffe5a8'), 0.03);
  for (let i = 0; i < 6; i++) { const a = (i - 2.5) * 0.44; R.blob(fx + cs * a + sn * 0.1, y + 1.5 + (i % 2) * 0.28, fz - sn * a + cs * 0.1, 0.2, 0.2, 0.05, c('#d79a4e'), c('#e6b468'), 6, 2); }
  say(R, 'COVRIGI', fx, y + 2.6, fz, yaw, 0.38, c('#6a3c1e'), 0.3);
}
// an old saloon parked at the kerb: a box with a nose, in the colours they came in
const OLD_SALOONS = [c('#efe7d4'), c('#c64a3c'), c('#d9b75e'), c('#4f7a9a'), c('#74966a')];
function parked(R, x, y, z, yaw, seed) {
  const col = OLD_SALOONS[Math.floor(hash3(seed, 1, 1) * OLD_SALOONS.length)], cs = Math.cos(yaw), sn = Math.sin(yaw);
  R.box(x, y + 0.3, z, 1.6, 0.62, 4.2, yaw, col, mul(col, 1.05));
  R.box(x - sn * 0.2, y + 0.92, z - cs * 0.2, 1.42, 0.52, 2.2, yaw, c('#6e7c90'), col);
  for (const a of [-1, 1]) for (const b of [-1.3, 1.3]) R.box(x + cs * a * 0.75 + sn * b, y, z - sn * a * 0.75 + cs * b, 0.2, 0.52, 0.6, yaw, DARK);
}
// a chestnut in a pot, an acacia in a tin: no. A clipped topiary cone, as along the fountains in the painting
function topiary(R, x, y, z, h = 3.4) {
  const G0 = c('#3f7a3a'), G1 = c('#8fb84f');
  for (let i = 0; i < 3; i++) R.blob(x, y + h * (0.22 + i * 0.3), z, h * (0.32 - i * 0.08), h * 0.24, h * (0.32 - i * 0.08), G0, G1, 7, 2);
}

// ---------- the wearing of a painting ----------
function paintedMaterial(mat, world, file, key) {
  const m = mat('#000000', { map: true, emissive: '#ffffff', emissiveIntensity: key, side: THREE.DoubleSide });
  const tex = new THREE.TextureLoader().load(`${world.backdropBase || 'assets/backdrops/'}${file}`);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  m.emissiveMap = tex; m.needsUpdate = true;
  return m;
}
function uvMesh(tris, material, group) {
  const P = [], U = [], N = [];
  for (const [a, b, d, e, ua, ub, ud, ue] of tris) {
    const ax = b[0] - a[0], ay = b[1] - a[1], az = b[2] - a[2], bx = d[0] - a[0], by = d[1] - a[1], bz = d[2] - a[2];
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    for (const [p, u] of [[a, ua], [b, ub], [d, ud], [a, ua], [d, ud], [e, ue]]) { P.push(...p); U.push(...u); N.push(nx, ny, nz); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  const mesh = new THREE.Mesh(g, material); mesh.frustumCulled = true; group.add(mesh);
  return mesh;
}

// The Parliament: the painted facade standing on its real footprint with the real silhouette in steps, wings and central block behind it wearing the same painting. Facade faces +x, its axis on the boulevard.
function parliament(ctx, x, y, z) {
  const { mat, world } = ctx, group = new THREE.Group(); world.staticGroup.add(group); // a group, not a mesh: never streamed out, it stands at the end of the boulevard from the far side of Piata Unirii
  const M = paintedMaterial(mat, world, 'bucarest-parliament.jpg', 0.999), W = 290, H = 290 * 366 / 856, D = 230, hw = W / 2, Q = [];
  const STEPS = [[0, 0.626, 0], [0.626, 0.85, 0.385], [0.85, 1, 0.355]];
  const V = (v) => 1 - v, UU = (u) => 0.5 + u / 2;
  // the front, step by step, both sides of the axis
  for (const [a, b, top] of STEPS) for (const s of [1, -1]) {
    const y1 = y + H * (1 - top), z0 = z + s * a * hw, z1 = z + s * b * hw;
    const A = [x, y, z0], B = [x, y, z1], C = [x, y1, z1], E = [x, y1, z0];
    const ua = UU(s * a), ub = UU(s * b);
    if (s > 0) Q.push([A, B, C, E, [ua, 0], [ub, 0], [ub, V(top)], [ua, V(top)]]);
    else Q.push([B, A, E, C, [ub, 0], [ua, 0], [ua, V(top)], [ub, V(top)]]);
  }
  // the flanks and the back: the wing's own piece of the painting, again and again down a side a kart only ever sees at a slant
  const wing = (x0, x1, z0, z1, y1, u0, u1, vtop, reps) => {
    for (let i = 0; i < reps; i++) {
      const a = i / reps, b = (i + 1) / reps, A = [lerp(x0, x1, a), y, lerp(z0, z1, a)], B = [lerp(x0, x1, b), y, lerp(z0, z1, b)], C = [B[0], y1, B[2]], E = [A[0], y1, A[2]];
      Q.push([A, B, C, E, [u0, 0], [u1, 0], [u1, vtop], [u0, vtop]]);
    }
  };
  const wy = y + H * (1 - 0.36), cy = y + H, wall = [0.8, 0.965], topW = hw * 0.626, wallTop = 1 - 0.36;
  wing(x, x - D, z - hw, z - hw, wy, wall[0], wall[1], wallTop, 7); // north flank
  wing(x - D, x, z + hw, z + hw, wy, wall[0], wall[1], wallTop, 7); // south flank
  wing(x - D, x - D, z + hw, z - hw, wy, wall[0], wall[1], wallTop, 8); // back
  // the central block behind the front: its flanks
  wing(x, x - D * 0.62, z - topW, z - topW, cy, 0.56, 0.72, 1, 4);
  wing(x - D * 0.62, x, z + topW, z + topW, cy, 0.56, 0.72, 1, 4);
  wing(x - D * 0.62, x - D * 0.62, z + topW, z - topW, cy, 0.56, 0.72, 1, 5);
  uvMesh(Q, M, group);
  // the flat roofs, in the painting's own shade
  const R = new Raw(), RC = c('#cdb890');
  R.quad([x, wy, z + hw], [x, wy, z - hw], [x - D, wy, z - hw], [x - D, wy, z + hw], RC);
  R.quad([x, cy, z + topW], [x, cy, z - topW], [x - D * 0.62, cy, z - topW], [x - D * 0.62, cy, z + topW], mul(RC, 1.05));
  ctx.batch.add(R.geometry(), { far: true });
}

// The Ateneu: drum, dome and portico, the painting projected on them from the front, so that from the road it IS the painting, and from the side it is a building.
function ateneu(ctx, x, y, z, yaw) {
  const { mat, world } = ctx, M = paintedMaterial(mat, world, 'bucarest-ateneu.jpg', 0.998), group = new THREE.Group(); world.staticGroup.add(group);
  const S = 0.1, ax = Math.cos(yaw), az = -Math.sin(yaw), fx = Math.sin(yaw), fz = Math.cos(yaw), PX = 430 * S / 2, IMG_H = 505 * S; // the crop is 430 by 505 of the thousand wide painting, its middle 215 from the left
  const CX = (505 - 290 - 215) * S;
  const pt = (lat, h, out) => [x + ax * lat + fx * out, y + h, z + az * lat + fz * out];
  const uv = (lat, h) => [0.5 + (lat - CX) / (PX * 2), h / IMG_H];
  const Q = [];
  // the silhouette as the painting has it, height over the foot and radius, in painting pixels
  const PROF = [[0, 195], [250, 195], [255, 200], [340, 188], [346, 174], [375, 130], [395, 72], [405, 68], [425, 36], [465, 12], [485, 3]].map(([h, r]) => [h * S, r * S]);
  const SEG = 28;
  for (let i = 0; i + 1 < PROF.length; i++) for (let k = 0; k < SEG; k++) {
    const a0 = (k / SEG) * TAU, a1 = ((k + 1) / SEG) * TAU, [h0, r0] = PROF[i], [h1, r1] = PROF[i + 1];
    const L = (r, a) => r * Math.sin(a), O = (r, a) => r * Math.cos(a);
    Q.push([pt(0, 0, 0).map(() => 0), null]); Q.pop();
    Q.push([pt(L(r0, a1), h0, O(r0, a1)), pt(L(r0, a0), h0, O(r0, a0)), pt(L(r1, a0), h1, O(r1, a0)), pt(L(r1, a1), h1, O(r1, a1)), uv(L(r0, a1), h0), uv(L(r0, a0), h0), uv(L(r1, a0), h1), uv(L(r1, a1), h1)]);
  }
  // the portico: its front and pediment, proud of the drum, the sides in the same stone
  const PW = 190 * S, PD = 195 * S + 7, PH = 225 * S, GH = 295 * S;
  Q.push([pt(-PW, 0, PD), pt(PW, 0, PD), pt(PW, PH, PD), pt(-PW, PH, PD), uv(-PW, 0), uv(PW, 0), uv(PW, PH), uv(-PW, PH)]);
  Q.push([pt(-PW, PH, PD), pt(PW, PH, PD), pt(0, GH, PD), pt(0, GH, PD), uv(-PW, PH), uv(PW, PH), uv(0, GH), uv(0, GH)]);
  uvMesh(Q, M, group);
  const R = new Raw(), ST = CREAM, top = c('#a79cac'), P = (l, h, o) => pt(l, h, o);
  for (const s of [-1, 1]) {
    R.quad(P(s > 0 ? PW : -PW, 0, PD), P(s > 0 ? PW : -PW, 0, 8), P(s > 0 ? PW : -PW, PH, 8), P(s > 0 ? PW : -PW, PH, PD), mul(ST, 0.86));
    R.quad(P(s * PW, PH, PD), P(s * PW, PH, 8), P(0, GH, 8), P(0, GH, PD), top);
    R.quad(P(s * PW, PH, 8), P(s * PW, PH, PD), P(0, GH, PD), P(0, GH, 8), top);
  }
  ctx.batch.add(R.geometry());
}

// the Arc de Triumf: one great arch, its attic, reliefs and winged victories on the top: stone in two flat tones. Stands on z, faces (sin yaw, cos yaw)
function arc(R, x, y, z, yaw) {
  const cs = Math.cos(yaw), sn = Math.sin(yaw), W = 25, H = 27, D = 11.5, A = CREAM, L = mul(CREAM, 1.08), O = SHADE;
  const piers = 7.6, open = W - piers * 2, hArch = 12.5, top = hArch + open / 2;
  for (const s of [-1, 1]) {
    const px = x + cs * s * (open / 2 + piers / 2), pz = z - sn * s * (open / 2 + piers / 2);
    R.box(px, y, pz, piers, top + 3, D, yaw, A, L, 0.9);
    for (const fsign of [-1, 1]) {
      const fx = px + sn * fsign * D / 2, fz = pz + cs * fsign * D / 2, y2 = fsign > 0 ? yaw : yaw + Math.PI;
      // double columns and a relief panel on each pier
      R.panel(fx, y + 5, fz, piers * 0.55, 7, y2, mul(A, 0.84), 0.05);
      R.blob(fx, y + 8.2, fz, 1.3, 1.9, 0.14, L, L, 7, 2);
      for (const q of [-1, 1]) R.cyl(fx + cs * q * (piers / 2 - 0.5) + sn * fsign * 0.45, y, y + top + 2.2, fz - sn * q * (piers / 2 - 0.5) + cs * fsign * 0.45, 0.45, 0.4, L, L, 6);
    }
  }
  // the arch: the vault in steps, and its inner shade
  const SEG = 9;
  for (let i = 0; i < SEG; i++) {
    const a0 = (i / SEG) * Math.PI, a1 = ((i + 1) / SEG) * Math.PI, rr = open / 2, x0 = rr * Math.cos(a0), x1 = rr * Math.cos(a1), y0 = hArch + rr * Math.sin(a0), y1 = hArch + rr * Math.sin(a1);
    const P = (lat, h, o) => [x + cs * lat + sn * o, y + h, z - sn * lat + cs * o];
    R.quad(P(x0, y0, -D / 2), P(x0, y0, D / 2), P(x1, y1, D / 2), P(x1, y1, -D / 2), O);
    for (const [o, facing] of [[D / 2, 1], [-D / 2, -1]]) {
      const tl = top + 3;
      if (facing > 0) { R.quad(P(x0, y0, o), P(x1, y1, o), P(x1, tl, o), P(x0, tl, o), A); } else { R.quad(P(x1, y1, o), P(x0, y0, o), P(x0, tl, o), P(x1, tl, o), A); }
    }
  }
  // the entablature, the attic and its top
  R.box(x, y + top + 3, z, W + 1, 1.1, D + 1, yaw, L);
  R.box(x, y + top + 4.1, z, W - 1, H - top - 4.1, D - 1, yaw, A, L);
  R.box(x, y + H, z, W - 4, 0.8, D - 3.4, yaw, L);
  for (const fsign of [-1, 1]) for (const k of [-0.28, 0.28]) {
    const px = x + cs * k * W + sn * fsign * (D / 2 - 0.45), pz = z - sn * k * W + cs * fsign * (D / 2 - 0.45);
    R.blob(px, y + H - 0.8, pz, 2.2, 1.4, 0.3, L, L, 7, 2);
  }
}

// a long palace of pale stone: wings, a central front with columns, a pediment or a dome
function palace(R, x, y, z, yaw, W, H, D, { col = CREAM, dome = 0, columns = 6, sign = null, pedestal = 1.1, roof = ROOF } = {}) {
  const cs = Math.cos(yaw), sn = Math.sin(yaw), fx = x + sn * D / 2, fz = z + cs * D / 2, lit = mul(col, 1.08);
  R.box(x, y, z, W, H, D, yaw, col, mul(col, 0.9), 0.92);
  R.panel(fx, y, fz, W, 3.4, yaw, mul(col, 0.84), 0.04);
  const fl = Math.max(2, Math.floor((H - 4) / 4.4)), cols = Math.round(W / 4.4);
  for (let f = 0; f < fl; f++) {
    const yy = y + 4.2 + f * 4.4;
    R.panel(fx, yy - 0.9, fz, W, 0.3, yaw, lit, 0.05);
    for (let k = 0; k < cols; k++) { const a = (k + 0.5) / cols - 0.5; if (Math.abs(a) * W < columns * 1.6) continue; bay(R, fx + cs * a * W, yy, fz - sn * a * W, yaw, 1.8, 2.6, lit, hash3(f, k, 11) < 0.1 ? WINL : WIN); }
  }
  for (const q of [-1, 1]) { const y2 = yaw + q * Math.PI / 2, sx = x + cs * q * W / 2, sz = z - sn * q * W / 2, nd = Math.max(1, Math.floor(D / 5)); for (let f = 0; f < fl; f++) for (let k = 0; k < nd; k++) { const a = (k + 0.5) / nd - 0.5; bay(R, sx + sn * a * D, y + 4.2 + f * 4.4, sz + cs * a * D, y2, 1.7, 2.5, lit, WIN, 0.06); } }
  R.box(fx - sn * 0.5, y + H - 0.2, fz - cs * 0.5, W + 0.7, 0.8, 1.2, yaw, lit);
  R.roof(x, y + H + 0.5, z, W, D, 3.4, yaw, roof);
  // the central front
  const cw = columns * 3.2, cy = y + H - 0.2;
  R.box(fx + sn * 1.8, y, fz + cs * 1.8, cw + 2, pedestal, 5, yaw, mul(col, 0.9));
  R.panel(fx + sn * 3.6, y + pedestal, fz + cs * 3.6, cw, H - pedestal - 2, yaw, SHADE, 0);
  for (let i = 0; i < columns; i++) { const a = (i + 0.5) / columns - 0.5; R.cyl(fx + cs * a * cw + sn * 4, y + pedestal, cy - 1.5, fz - sn * a * cw + cs * 4, 0.56, 0.48, WHITE, WHITE, 7); }
  R.box(fx + sn * 3.6, cy - 1.6, fz + cs * 3.6, cw + 1.4, 1.5, 3, yaw, lit);
  const P = (lat, h, o) => [fx + cs * lat + sn * o, cy - 0.1 + h, fz - sn * lat + cs * o];
  R.quad(P(-cw / 2 - 0.7, 0, 5.1), P(cw / 2 + 0.7, 0, 5.1), P(0, 3.2, 5.1), P(0, 3.2, 5.1), lit);
  R.quad(P(cw / 2 + 0.7, 0, 5.1), P(cw / 2 + 0.7, 0, 0), P(0, 3.2, 0), P(0, 3.2, 5.1), roof);
  R.quad(P(0, 3.2, 5.1), P(0, 3.2, 0), P(-cw / 2 - 0.7, 0, 0), P(-cw / 2 - 0.7, 0, 5.1), roof);
  if (dome) { R.cyl(x, y + H, y + H + dome * 0.6, z, dome * 0.72, dome * 0.68, col, lit, 12); R.blob(x, y + H + dome * 0.6, z, dome * 0.7, dome * 0.72, dome * 0.7, ROOFG, mul(ROOFG, 1.25), 12, 4); R.cyl(x, y + H + dome * 1.2, y + H + dome * 1.2 + 2.2, z, 0.5, 0.2, DARK, DARK, 6); }
  if (sign) say(R, sign, fx + sn * 3.6, cy - 1.15, fz + cs * 3.6, yaw, 0.82, DARK, 1.55);
}

// a small church in brick and white, stood well back: Cretulescu, Zlatari, Domnita Balasa and their like
function church(R, x, y, z, yaw) {
  const RED = c('#c0694c'), W = WHITE, cs = Math.cos(yaw), sn = Math.sin(yaw);
  R.box(x, y, z, 10, 8, 20, yaw, RED, mul(RED, 0.9));
  R.roof(x, y + 8, z, 10.6, 20.6, 3, yaw, ROOFG);
  for (const q of [-1, 1]) { const y2 = yaw + q * Math.PI / 2; for (const k of [-6, 0, 6]) { const sx = x + cs * q * 5 + sn * k, sz = z - sn * q * 5 + cs * k; R.panel(sx, y + 3.4, sz, 1.4, 3, y2, WIN, 0.05); R.blob(sx + sn * 0, y + 6.4, sz, 0.7, 0.7, 0.7, WIN, WIN, 6, 2); } }
  R.panel(x + sn * 10, y + 2.4, z + cs * 10, 10, 0.55, yaw, W, 0.03); R.panel(x + sn * 10, y, z + cs * 10, 3, 2.8, yaw, WIN, 0.05);
  for (const off of [-6, 5]) {
    const tx = x + sn * off, tz = z + cs * off, h = off < 0 ? 16 : 19;
    R.cyl(tx, y + 9, y + h, tz, 2.3, 2.1, RED, RED, 8);
    R.panel(tx + cs * 0, y + h - 3, tz + 2.1, 1, 2, 0, W, 0.2);
    R.blob(tx, y + h, tz, 2.4, 2.2, 2.4, ROOFG, mul(ROOFG, 1.2), 8, 3);
    R.bar([tx, y + h + 1.8, tz], [tx, y + h + 3.9, tz], 0.12, c('#d7b75c'));
    R.bar([tx - cs * 0.55, y + h + 3.2, tz + sn * 0.55], [tx + cs * 0.55, y + h + 3.2, tz - sn * 0.55], 0.1, c('#d7b75c'));
  }
}

// the Memorial of Rebirth, plainly: a white spire and flowers at its foot, and a low railing. Nothing else stands near it.
function memorial(R, x, y, z) {
  const G = c('#f4efe4');
  R.box(x, y, z, 15, 0.6, 15, 0.3, c('#ccc2ae'));
  R.box(x, y + 0.6, z, 9, 0.5, 9, 0.3, c('#dcd2bd'));
  const seg = 4; for (let i = 0; i < 4; i++) { const a = i / seg * TAU + 0.3 + Math.PI / 4, b = (i + 1) / seg * TAU + 0.3 + Math.PI / 4, r = 1.55; R.quad([x + Math.cos(b) * r, y + 1.1, z + Math.sin(b) * r], [x + Math.cos(a) * r, y + 1.1, z + Math.sin(a) * r], [x, y + 25, z], [x, y + 25, z], mul(G, 0.9 + (i % 2) * 0.12), G); }
  for (let i = 0; i < 16; i++) { const a = i / 16 * TAU, r = 4.5; R.blob(x + Math.cos(a) * r, y + 1.28, z + Math.sin(a) * r, 0.42, 0.28, 0.42, i % 3 ? c('#c8423c') : c('#f4f0e4'), i % 3 ? c('#e85a50') : WHITE, 5, 2); }
}

// ---------- the fountains: a white plume with its falling fans, ribbons crossed so that it has body from any side ----------
function jet(R, x, y, z, h, spread, n) {
  const JET = c('#dff2f2'), TOP = c('#ffffff');
  const arc = (a, H, S, t0) => {
    const N = 7, ca = Math.cos(a), sa = Math.sin(a);
    for (let k = 0; k < N; k++) {
      const u0 = k / N, u1 = (k + 1) / N, h0 = H * (u0 * 1.65 - 0.65 * u0 * u0 * u0 - 0.0 * u0) * (u0 > 0.62 ? 1 - (u0 - 0.62) * 0.6 : 1), h1 = H * (u1 * 1.65 - 0.65 * u1 * u1 * u1) * (u1 > 0.62 ? 1 - (u1 - 0.62) * 0.6 : 1), r0 = S * u0 * u0, r1 = S * u1 * u1, t = (u) => t0 * (1 - 0.65 * u);
      const P0 = [x + ca * r0, y + h0, z + sa * r0], P1 = [x + ca * r1, y + h1, z + sa * r1];
      for (const [sx, sy] of [[-sa, ca], [ca, sa]]) {
        const A0 = [P0[0] - sx * t(u0), P0[1], P0[2] - sy * t(u0)], A1 = [P0[0] + sx * t(u0), P0[1], P0[2] + sy * t(u0)], B0 = [P1[0] - sx * t(u1), P1[1], P1[2] - sy * t(u1)], B1 = [P1[0] + sx * t(u1), P1[1], P1[2] + sy * t(u1)];
        R.quad(A0, A1, B1, B0, mix(JET, TOP, u0), mix(JET, TOP, u1)); R.quad(A1, A0, B0, B1, mix(JET, TOP, u0), mix(JET, TOP, u1));
      }
    }
  };
  arc(0, h, 0.2, 0.55);
  for (let i = 0; i < n; i++) { const a = i / n * TAU + h; arc(a, h * (0.82 + 0.16 * (i % 2)), spread * (0.75 + 0.3 * (i % 3) / 2), 0.26); }
  R.blob(x, y + 0.2, z, spread * 0.8, 0.35, spread * 0.8, JET, TOP, 7, 2);
}

// the long basins of Unirii: pale stone ring, flat water, three steps of jets
function basin(R, J, x, y, z, yaw, len, wide) {
  const cs = Math.cos(yaw), sn = Math.sin(yaw), SEG = 16, ST = c('#e6dcc4'), ST2 = c('#c9bea4'), WAT = c('#8cc4cc'), WAT2 = c('#c4e4dc');
  const ring = (k, h, col, col2) => { const o = []; for (let i = 0; i < SEG; i++) { const a = i / SEG * TAU, l = Math.cos(a) * (len / 2) * k, w = Math.sin(a) * (wide / 2) * k, b = Math.pow(Math.abs(Math.sin(a)), 0.5) * Math.sign(Math.sin(a)) * (wide / 2) * k; o.push([x + cs * b + sn * l, y + h, z - sn * b + cs * l]); void w; } return o; };
  const out0 = ring(1, 0, ST2), out1 = ring(1, 0.9, ST), in1 = ring(0.92, 0.9, ST), in0 = ring(0.92, 0.46, WAT);
  for (let i = 0; i < SEG; i++) {
    const j = (i + 1) % SEG;
    R.quad(out0[j], out0[i], out1[i], out1[j], ST2, ST);
    R.quad(out1[j], out1[i], in1[i], in1[j], ST);
    R.quad(in1[j], in1[i], in0[i], in0[j], ST2);
  }
  const mid = [x, y + 0.46, z];
  for (let i = 0; i < SEG; i++) { const j = (i + 1) % SEG; R.quad(in0[j], in0[i], mid, mid, WAT, WAT2); }
  jet(J, x, y + 0.46, z, 11 + wide * 0.32, 2.9, 7);
  for (const q of [-0.3, 0.3]) { const lx = x + sn * q * len, lz = z + cs * q * len; jet(J, lx, y + 0.46, lz, 5.5, 1.8, 5); }
  for (const q of [-0.3, 0.3]) for (const s of [-1, 1]) { const lx = x + sn * q * 0.6 * len + cs * s * wide * 0.26, lz = z + cs * q * 0.6 * len - sn * s * wide * 0.26; jet(J, lx, y + 0.46, lz, 3.2, 1.1, 3); }
}

// the silver heating main of the city, the real thing: lagged in foil, on trestles beside the road, and a portal over it where it crosses
function mainPipe(R, a, b) {
  const FOIL = c('#d4d6d2'), BAND = c('#aeb0ae');
  const dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz) || 1, up = Math.abs(b[1] - a[1]) > Math.hypot(dx, dz);
  R.bar(a, b, 0.72, FOIL);
  const n = Math.max(1, Math.floor(L / 7));
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = lerp(a[0], b[0], t), y = lerp(a[1], b[1], t), z = lerp(a[2], b[2], t);
    if (!up) R.bar([x - 0.14 * dx / L, y, z - 0.14 * dz / L], [x + 0.14 * dx / L, y, z + 0.14 * dz / L], 0.84, BAND);
    if (i % 2 === 0 && !up) R.bar([x, y - 0.3, z], [x, y - 2.4, z], 0.16, c('#6c6864'));
  }
}
function barrier(R, x, y, z, yaw) {
  const RD = c('#d8473a'), WH = c('#f4efe4'), cs = Math.cos(yaw), sn = Math.sin(yaw);
  for (const q of [-1.1, 1.1]) R.box(x + cs * q, y, z - sn * q, 0.18, 1.1, 0.5, yaw, DARK);
  R.box(x, y + 0.82, z, 2.8, 0.26, 0.1, yaw, RD);
  for (let i = 0; i < 3; i++) R.panel(x + cs * (i - 1) * 0.9, y + 0.82, z - sn * (i - 1) * 0.9, 0.42, 0.26, yaw, WH, 0.06);
}
function cone(R, x, y, z) { R.cyl(x, y, y + 0.72, z, 0.24, 0.05, c('#ec6a30'), c('#f7f3ea'), 6); }

let jetsMesh = null;

export function plan(ctx) {
  const { track, world } = ctx, def = track.def, MAP = def.mapScale, S = track.samples, K = world.keepOut, G = world.groves, Pl = world.plant;
  const m = (name, off = 0) => track.pointU[def.marks[name]] * track.length + off;
  const at = (mm) => { const i = ((Math.round(mm / track.step) % track.n) + track.n) % track.n; return { i, x: S.x[i], z: S.z[i], nx: S.nx[i], nz: S.nz[i], hw: S.w[i] / 2 }; };
  const RING = [['chestnut', 0.6], ['lime', 0.4]];
  const line = (a, b, every, off, kinds = ['chestnut'], sides = [-1, 1], h = 11) => {
    for (let mm = a; mm < b; mm += every) for (const s of sides) {
      const p = at(mm), j = (hash3(mm, s, 3) - 0.5) * 1.6, x = p.x + p.nx * s * (p.hw + off + j), z = p.z + p.nz * s * (p.hw + off + j);
      Pl.push({ x, z, kind: kinds[Math.floor(hash3(mm, s, 5) * kinds.length)], h: h + hash3(mm, s, 6) * 4 });
    }
  };
  // Unirii: chestnuts in ranks the whole way, thick on both sides of the far carriageway, as in the painting
  line(m('bulevard', 30), track.length - 6, 15, 4.6, ['chestnut', 'lime'], [-1], 12);
  line(6, m('constitutiei', -50), 15, 4.6, ['chestnut', 'lime'], [-1], 12);
  line(m('bulevard', 30), track.length - 6, 18, 7, ['chestnut', 'lime'], [1], 13);
  line(6, m('constitutiei', -50), 18, 7, ['chestnut', 'lime'], [1], 13);
  // Kiseleff: a tunnel of them. Aviatorilor: limes
  line(m('vest', 170), m('arc', -30), 15, 3.6, ['chestnut', 'lime'], [-1, 1], 14);
  line(m('gaulle', 170), m('est', -30), 17, 3.6, ['lime', 'chestnut'], [-1, 1], 13);
  line(m('est', 20), m('romana', -30), 28, 2.6, ['lime'], [-1, 1], 10);
  line(m('ateneu', 90), m('vest', -30), 42, 2, ['lime'], [-1, 1], 9);
  line(m('bratianu', 30), m('unirii', 60), 30, 2.4, ['lime'], [-1, 1], 10);
  // the park at the lake, and the far shore; the wood of the Kiseleff park behind the villas; Cismigiu's far side
  const scale = (x, z) => [x * MAP, z * MAP];
  for (const [x, z, r] of [[-950, -2650, 230], [-720, -2600, 200], [-470, -2500, 170], [-300, -2650, 140], [-1250, -2900, 240], [-620, -3530, 300], [-1120, -3380, 240], [-180, -3250, 220], [-950, -1250, 110], [-400, -1400, 150], [-300, -1900, 130], [-780, 1100, 180]]) { const [a, b] = scale(x, z); G.push({ x: a, z: b, r: r * MAP * 1.2, cover: 1.3, kinds: RING }); }
  // the alley and the shore: limes in rank, right up to the path, and a thick wood behind them
  line(m('arc', 110), m('gaulle', 30), 13, 3.4, ['lime', 'chestnut'], [1, -1], 11);
  line(m('arc', 120), m('gaulle', 20), 15, 12, ['chestnut', 'lime'], [-1], 13);
  // the lake has no trees in it; the Parliament stands on open ground, the boulevard's view of it stays clear; the square before the memorial and the Ateneu's own air stay open
  K.push({ x: -350, z: -1765, r: 170 });
  for (let t = -1; t <= 1; t += 0.14) K.push({ x: -350 + t * 240, z: -1765 + (1 - t * t) * 50 - 25, r: 118 });
  for (const [x, z, r] of [[-360, 1200, 175], [-205, 1210, 60], [-205, 1130, 50], [-205, 1290, 50], [-120, 1228, 60], [-60, 1228, 60], [-641, -1253, 42]]) K.push({ x, z, r });
  K.push({ x: 225, z: 500, r: 62 });
  // the city is paved; only the park, the Kiseleff gardens, the Parliament's lawn and Piata Unirii's are green
  const GREEN = [[-540, -1465, 260], [-250, -1560, 140], [-850, -1650, 120], [-641, -1253, 30], [-300, 1200, 230], [465, 1270, 80], [-560, -760, 90]];
  const PV = [c('#c9bea8'), c('#c2b7a2'), c('#cfc4ae')];
  world.paintAt = (x, z) => {
    let g = 1;
    for (const [a, b, r] of GREEN) { const d = Math.hypot(x - a, z - b) - r; if (d < 22) { g = Math.min(g, Math.max(0, d / 22)); if (!g) return null; } }
    const t = PV[Math.abs(Math.floor(x / 15) + Math.floor(z / 17)) % 3];
    return [t[0], t[1], t[2], 0.95 * g];
  };
}

export function build(ctx) {
  const { track, terrain, batch, world, mat } = ctx, def = track.def, S = track.samples, n = track.n, ground = world.ground;
  const m = (name, off = 0) => track.pointU[def.marks[name]] * track.length + off;
  const at = (mm) => { const i = ((Math.round(mm / track.step) % n) + n) % n; return { i, x: S.x[i], y: S.y[i], z: S.z[i], tx: S.tx[i], tz: S.tz[i], nx: S.nx[i], nz: S.nz[i], w: S.w[i], hw: S.w[i] / 2 }; };
  const gy = (x, z) => ground.groundAt(x, z);
  const F = new Blocks(300), X = new Blocks(300);
  const faceRoad = (p, s) => Math.atan2(-p.nx * s, -p.nz * s);
  const free = (x, z, r) => terrain.roadDistAt(x, z) > r;

  // ---- pavements: a slab and its kerb, with one flat colour of paving ----
  const PAVE = c('#d4c8b0'), KERB = c('#a89e8a');
  const pave = new Blocks(300);
  for (let mm = 0; mm < track.length; mm += 8) {
    const p = at(mm), q = at(mm + 8), inPark = mm > m('arc', 120) && mm < m('gaulle', 40);
    if (track.structureAt(p.i) === 'bridge') continue;
    const R = pave.at(p.x, p.z).full, wide = inPark ? 3.4 : 4.6;
    for (const s of [-1, 1]) {
      const a0 = s * (p.hw + 0.02), a1 = s * (p.hw + wide), b0 = s * (q.hw + 0.02), b1 = s * (q.hw + wide), y = p.y + 0.16, y2 = q.y + 0.16;
      const A0 = [p.x + p.nx * a0, y, p.z + p.nz * a0], A1 = [p.x + p.nx * a1, y, p.z + p.nz * a1], B1 = [q.x + q.nx * b1, y2, q.z + q.nz * b1], B0 = [q.x + q.nx * b0, y2, q.z + q.nz * b0];
      const low0 = [A0[0], y - 0.5, A0[2]], low1 = [B0[0], y2 - 0.5, B0[2]];
      if (s > 0) { R.quad(A0, A1, B1, B0, PAVE); R.quad(low1, low0, A0, B0, KERB); } else { R.quad(A1, A0, B0, B1, PAVE); R.quad(low0, low1, B0, A0, KERB); }
    }
  }
  pave.flush(batch);

  // ---- streets: what stands along each stretch ----
  const walk = (a, b, s, style, setback, stepMin, stepMax, depth, seedBase, opts = {}) => {
    let mm = a;
    while (mm < b) {
      const w = stepMin + hash3(mm, s, seedBase) * (stepMax - stepMin), p = at(mm + w / 2);
      const off = p.hw + setback + depth / 2, x = p.x + p.nx * s * off, z = p.z + p.nz * s * off;
      if (free(x, z, depth / 2 + 1)) style(F, x, gy(x, z) - 0.1, z, faceRoad(p, s), w - 0.3, depth, Math.floor(mm) + s * 7, opts);
      mm += w;
    }
  };
  // what fills behind the front: taller plain masses, so the sky over a street stands on something; each only one box, cheap
  const behind = (a, b, s, setback, every, depth, hMin, hMax, col, seedBase) => {
    for (let mm = a; mm < b; mm += every) {
      const p = at(mm), off = p.hw + setback + depth / 2, x = p.x + p.nx * s * off, z = p.z + p.nz * s * off;
      if (!free(x, z, depth / 2 + 3)) continue;
      const h = hMin + hash3(mm, s, seedBase) * (hMax - hMin), r = F.at(x, z);
      r.full.box(x, gy(x, z), z, every * 0.94, h, depth, faceRoad(p, s), col, mul(ROOF, 1.1), 0.9);
      const yaw = faceRoad(p, s), sn = Math.sin(yaw), cs = Math.cos(yaw), floors = Math.floor(h / 4);
      // windows, not one long band: where the front row leaves a gap, this is the wall the driver sees
      const cols = Math.max(3, Math.round(every * 0.8 / 4.4));
      for (let f = 1; f < floors; f += 1) for (let k = 0; k < cols; k++) {
        const a = ((k + 0.5) / cols - 0.5) * every * 0.82;
        r.full.panel(x + sn * depth / 2 + cs * a, gy(x, z) + f * 4 - 1.2, z + cs * depth / 2 - sn * a, 1.7, 1.9, yaw, hash3(mm, f * 17 + k, s) < 0.12 ? WINL : WIN, 0.05);
      }
      LOW_BOX(r, x, z, every * 0.94, h, depth, yaw, col);
    }
  };
  const L = 1, Rr = -1; // the road's left and right as driven
  // a palace is placed from the road at one point, and the road bends: back it off until no part of its footprint stands on the carriageway or the pavement
  const CLEAR_ROAD = 5; // the pavement, and the steps and columns the front wears
  const clearPalace = (a, W, H, D, o) => {
    const sn = Math.sin(a.yaw), cs = Math.cos(a.yaw);
    let back = 0;
    const clear = () => {
      for (let i = -1; i <= 1; i += 0.25) for (const j of [-1, 0, 1]) {
        const px = a.x - sn * back + cs * i * W / 2 + sn * j * D / 2, pz = a.z - cs * back - sn * i * W / 2 + cs * j * D / 2;
        if (!free(px, pz, CLEAR_ROAD)) return false;
      }
      return true;
    };
    while (back < 60 && !clear()) back += 2;
    palace(V, a.x - sn * back, a.y, a.z - cs * back, a.yaw, W, H, D, o);
  };
  // Unirii: cream walls both sides. Left is across the fountains and the far carriageway
  for (const [a, b] of [[20, m('constitutiei', -70)], [m('bulevard', 40), track.length - 20]]) {
    walk(a, b, Rr, unirii, 6.5, 44, 62, 18, 21);
    walk(a, b, L, unirii, 40, 44, 62, 18, 22);
    behind(a, b, Rr, 34, 54, 22, 26, 42, c('#d9c9ae'), 23);
    behind(a, b, L, 70, 54, 22, 26, 42, c('#d9c9ae'), 24);
  }
  // past Constitutiei: blocks along the Natiunile Unite, the river on the left
  walk(m('constitutiei', 24), m('splai', 40), Rr, unirii, 6, 40, 56, 18, 25);
  walk(m('splai', 20), m('victoriei', -30), Rr, block, 5, 26, 34, 14, 26);
  behind(m('splai', 20), m('victoriei', -20), Rr, 30, 42, 22, 26, 40, CONC2, 27);
  // across the Dambovita: the far quay's blocks
  walk(m('splai', -6), m('victoriei', -96), L, block, 30, 30, 40, 14, 29);
  // Calea Victoriei: Belle Epoque, tight to the pavement
  walk(m('victoriei', 0), m('elisabeta', 40), L, belle, 4.6, 15, 24, 14, 31);
  walk(m('victoriei', 0), m('elisabeta', -40), Rr, belle, 4.6, 15, 24, 14, 32);
  walk(m('elisabeta', 60), m('revolutiei', 20), L, belle, 4.8, 14, 22, 14, 33);
  walk(m('elisabeta', 76), m('revolutiei', 20), Rr, belle, 4.8, 14, 22, 14, 34);
  behind(m('victoriei', 0), m('revolutiei', 20), L, 26, 34, 20, 18, 30, c('#d3c0a8'), 35);
  behind(m('victoriei', 0), m('revolutiei', 20), Rr, 26, 34, 20, 18, 30, c('#d3c0a8'), 36);
  walk(m('ateneu', 100), m('stirbey', 40), L, belle, 4.8, 15, 24, 14, 37);
  walk(m('ateneu', 96), m('stirbey', 40), Rr, belle, 4.8, 15, 24, 14, 38);
  walk(m('stirbey', 60), m('vest', -10), L, belle, 7, 15, 24, 14, 39);
  walk(m('stirbey', 60), m('cantacuzino', 40), Rr, block, 5.5, 22, 30, 14, 40);
  behind(m('ateneu', 96), m('vest', -10), L, 30, 34, 20, 20, 42, c('#d3c0a8'), 41);
  behind(m('ateneu', 96), m('vest', -10), Rr, 26, 34, 20, 20, 48, CONC2, 42);
  // Kiseleff and Aviatorilor: villas in their gardens, the wood behind
  walk(m('vest', 180), m('arc', -40), L, villa, 16, 26, 44, 14, 43);
  walk(m('vest', 180), m('arc', -40), Rr, villa, 15, 26, 44, 14, 44);
  walk(m('gaulle', 160), m('est', -24), L, villa, 15, 28, 44, 14, 45);
  walk(m('gaulle', 160), m('est', -24), Rr, villa, 15, 28, 44, 14, 46);
  // Catargiu: the old block with the new, blocks behind
  walk(m('est', 20), m('romana', -16), L, belle, 5, 16, 26, 14, 47, { floors: 5 });
  walk(m('est', 20), m('romana', -16), Rr, block, 5, 24, 32, 14, 48);
  behind(m('est', 20), m('romana', -6), L, 28, 40, 22, 22, 44, CONC2, 49);
  behind(m('est', 20), m('romana', -6), Rr, 28, 40, 22, 22, 44, CONC2, 50);
  // Magheru and Balcescu: the interwar white wall, the block behind, the neon
  walk(m('romana', 24), m('universitate', -6), L, modern, 5.5, 22, 34, 16, 51);
  walk(m('romana', 24), m('universitate', -6), Rr, modern, 5.5, 22, 34, 16, 52);
  behind(m('romana', 24), m('universitate', 20), L, 32, 40, 22, 28, 54, c('#cbbfae'), 53);
  behind(m('romana', 24), m('universitate', 20), Rr, 32, 40, 22, 28, 54, c('#cbbfae'), 54);
  // Bratianu: Belle Epoque and blocks, down to the square
  walk(m('universitate', 40), m('unirii', 30), L, belle, 5, 16, 24, 14, 55, { floors: 6 });
  walk(m('universitate', 40), m('unirii', 30), Rr, block, 5, 24, 34, 14, 56);
  behind(m('universitate', 30), m('unirii', 60), L, 28, 36, 20, 24, 40, CONC2, 57);
  behind(m('universitate', 30), m('unirii', 60), Rr, 28, 36, 20, 24, 40, CONC2, 58);

  // ---- furniture along every stretch: lamps, poles and the wires that are Bucharest, kiosks, covrigi, parked saloons ----
  const fur = new Blocks(300);
  const KINDS = ['ZIARE', 'TUTUN', 'FLORI', 'BILETE'];
  const inSquare = (mm) => mm > m('elisabeta', 60) && mm < m('ateneu', 20); // quiet before the memorial: no stalls, no parked cars
  const parkZone = (mm) => mm > m('arc', 110) && mm < m('gaulle', 60);
  for (let mm = 10; mm < track.length; mm += 30) {
    const p = at(mm), R = fur.at(p.x, p.z).full, y = p.y + 0.16, yaw0 = Math.atan2(p.tx, p.tz);
    if (track.structureAt(p.i) === 'bridge') continue;
    const fine = mm < m('constitutiei', -20) || mm > m('bulevard') || (mm > m('vest', 170) && mm < m('arc', -20)) || (mm > m('gaulle', 150) && mm < m('est'));
    for (const s of [-1, 1]) {
      const x = p.x + p.nx * s * (p.hw + 1.1), z = p.z + p.nz * s * (p.hw + 1.1);
      if (fine) lamp(R, x, y, z, yaw0 + Math.PI / 2, 7.6);
      else if (!parkZone(mm)) pole(R, x, y, z);
      else if (Math.floor(mm / 30) % 2) lamp(R, x, y, z, yaw0 + Math.PI / 2, 5);
    }
    // the wires: across the street at each pole, and along it between them, in bundles, as only this city has them
    if (!fine && !parkZone(mm) && !inSquare(mm)) {
      const q = at(mm + 30), ay = y + 7, A = [p.x + p.nx * (p.hw + 1.1), ay, p.z + p.nz * (p.hw + 1.1)], B = [p.x - p.nx * (p.hw + 1.1), ay, p.z - p.nz * (p.hw + 1.1)];
      wire(R, A, B, 0.55);
      const qy = q.y + 7.16;
      for (const s of [-1, 1]) for (const o of [0, 0.32]) wire(R, [p.x + p.nx * s * (p.hw + 1.1), ay - o, p.z + p.nz * s * (p.hw + 1.1)], [q.x + q.nx * s * (q.hw + 1.1), qy - o, q.z + q.nz * s * (q.hw + 1.1)], 0.7 + o);
    }
    if (inSquare(mm) || parkZone(mm)) continue;
    // parked cars by the kerb on the narrow stretches
    const h = hash3(mm, 1, 77);
    if (h < 0.34 && mm > m('victoriei') && mm < m('vest') && p.w <= 11) { const s = h < 0.17 ? 1 : -1, d = p.hw - 1.0; /* tight to the kerb */ parked(R, p.x + p.nx * s * (d + 3.6), y - 0.16, p.z + p.nz * s * (d + 3.6), yaw0, Math.floor(mm)); }
    const h2 = hash3(mm, 2, 77);
    if (h2 < 0.32) {
      const s = h2 < 0.16 ? 1 : -1, d = p.hw + 3.4, x = p.x + p.nx * s * d, z = p.z + p.nz * s * d, yw = faceRoad(p, s);
      if (h2 < 0.08 || h2 > 0.26) covrigi(R, x, y, z, yw); else kiosk(R, x, y, z, yw, KINDS[Math.floor(mm) % 4], Math.floor(mm));
    }
  }
  // people on the pavements: a stroke of colour with a head. And in the park, benches, flower beds and the people on them
  const COATS = [c('#c8503c'), c('#4f78a8'), c('#e2b44c'), c('#5f8a68'), c('#8a6a9c'), c('#efe6d4'), c('#3c3f4c')], SKIN = c('#e8b98f');
  for (let mm = 12; mm < track.length; mm += 9) {
    const h = hash3(mm, 3, 88); if (h > 0.34) continue;
    const p = at(mm), s = h < 0.17 ? 1 : -1, d = p.hw + 1.8 + hash3(mm, 4, 88) * 2.4, x = p.x + p.nx * s * d, z = p.z + p.nz * s * d, y = p.y + 0.16, R = fur.at(x, z).full, col = COATS[Math.floor(hash3(mm, 5, 88) * COATS.length)];
    if (track.structureAt(p.i) === 'bridge') continue;
    R.cyl(x, y, y + 1.2, z, 0.26, 0.2, col, mul(col, 1.1), 5); R.blob(x, y + 1.42, z, 0.17, 0.2, 0.17, SKIN, SKIN, 5, 2);
  }
  for (let mm = m('arc', 120); mm < m('gaulle', 20); mm += 26) {
    const p = at(mm), R = fur.at(p.x, p.z).full, y = p.y + 0.05, s = Math.floor(mm / 26) % 2 ? 1 : -1, x = p.x + p.nx * s * (p.hw + 1.8), z = p.z + p.nz * s * (p.hw + 1.8), yaw = Math.atan2(-p.nx * s, -p.nz * s), BE = c('#8a6a4a');
    R.box(x, y + 0.38, z, 1.7, 0.1, 0.5, yaw, BE); R.box(x - Math.sin(yaw) * 0.26, y + 0.5, z - Math.cos(yaw) * 0.26, 1.7, 0.42, 0.08, yaw, BE);
    const bx = p.x + p.nx * s * (p.hw + 7), bz = p.z + p.nz * s * (p.hw + 7), F0 = [c('#d94f5a'), c('#f0b83c'), c('#c05aa8')][Math.floor(mm / 26) % 3];
    R.blob(bx, y, bz, 3.2, 0.5, 2, c('#6a9a44'), F0, 8, 2);
  }
  // zebra crossings: two white blocks wide, at every corner of the city
  const zebra = new Raw();
  const paintRoad = (mm, d0, d1, len, col) => { const p = at(mm), q = at(mm + len), yy = track.heightAt(p.i, (d0 + d1) / 2) + 0.05, y2 = track.heightAt(q.i, (d0 + d1) / 2) + 0.05; zebra.quad([p.x + p.nx * d0, yy, p.z + p.nz * d0], [q.x + q.nx * d0, y2, q.z + q.nz * d0], [q.x + q.nx * d1, y2, q.z + q.nz * d1], [p.x + p.nx * d1, yy, p.z + p.nz * d1], col); };
  for (let mm = 46; mm < track.length; mm += 170) {
    const p = at(mm); if (track.structureAt(p.i) === 'bridge' || (mm > m('arc', 120) && mm < m('gaulle', 40))) continue;
    for (let d = -p.hw + 0.5; d < p.hw - 1; d += 1.5) paintRoad(mm, d, d + 0.9, 3.8, c('#f1ebd8'));
  }
  // the tram's rails across Unirii, and the plates and patches of the works
  { const mm = m('bulevard', 34), p = at(mm); for (const off of [-3.4, -2, 2, 3.4]) paintRoad(mm + off, -p.hw - 3, p.hw + 3, 0.3, c('#4d4a4c')); }
  batch.add(zebra.geometry());

  // ---- the fountains of Unirii: the median on the driver's left, and beyond it the far carriageway ----
  const Yard = new Blocks(300), J = new Raw();
  const hedgeG = c('#6e9e4a');
  for (const [a, b] of [[m('bulevard', 44), track.length + m('constitutiei', -74)]]) {
    let k = 0;
    for (let mm = a; mm < b; mm += 56, k++) {
      const p = at(mm), off = p.hw + 16, x = p.x + p.nx * off, z = p.z + p.nz * off, y = gy(x, z), yaw = Math.atan2(p.tx, p.tz), R = Yard.at(x, z).full;
      // the lawn of the median and its stone edge, a strip the whole span
      const q = at(mm + 56), lawn = (d0, d1, col, h) => { const yy = p.y + h, y2 = q.y + h; R.quad([p.x + p.nx * (p.hw + d1), yy, p.z + p.nz * (p.hw + d1)], [p.x + p.nx * (p.hw + d0), yy, p.z + p.nz * (p.hw + d0)], [q.x + q.nx * (q.hw + d0), y2, q.z + q.nz * (q.hw + d0)], [q.x + q.nx * (q.hw + d1), y2, q.z + q.nz * (q.hw + d1)], col); };
      lawn(4.6, 27.4, c('#8fae52'), 0.1);
      // the far carriageway, for the eye
      lawn(27.4, 38, c('#6a6570'), 0.04);
      basin(R, J, x, p.y + 0.15, z, yaw, 42, 13.5);
      if (k % 2 === 0) for (const s of [-1, 1]) { const tx = p.x + p.nx * (p.hw + 7.4) + p.tx * s * 24, tz = p.z + p.nz * (p.hw + 7.4) + p.tz * s * 24; topiary(R, tx, p.y + 0.1, tz, 3.2); topiary(R, tx + p.nx * 17.5, p.y + 0.1, tz + p.nz * 17.5, 3.2); }
      lamp(R, p.x + p.nx * (p.hw + 26), p.y + 0.1, p.z + p.nz * (p.hw + 26), yaw + Math.PI / 2, 8);
    }
  }
  Yard.flush(batch);
  {
    const jets = new THREE.Mesh(J.geometry(), mat('#ffffff', { vertexColors: true, transparent: true, opacity: 0.82, depthWrite: false }));
    jets.frustumCulled = true; world.staticGroup.add(jets); jetsMesh = jets;
  }

  // ---- set pieces, all at their real end of the road ----
  const V = new Raw(), SIDE = (mm, s, d) => { const p = at(mm), off = p.hw + d, x = p.x + p.nx * s * off, z = p.z + p.nz * s * off; return { x, z, y: gy(x, z), yaw: faceRoad(p, s), p }; };
  // The Parliament, axis on the boulevard, on its rise
  {
    const fx = -212, axis = at(m('constitutiei', -46)), fz = axis.z + 8, y = gy(fx, fz);
    parliament(ctx, fx, y - 0.4, fz);
    // the plaza before it: a lawn, a clipped hedge, flower beds, the broad steps in stone
    const R = new Raw(), HH = c('#e8dcc0');
    R.quad([fx + 2, y + 0.3, fz + 150], [fx + 2, y + 0.3, fz - 150], [fx + 34, y + 0.2, fz - 150], [fx + 34, y + 0.2, fz + 150], c('#a2bb58'));
    for (let i = -6; i <= 6; i++) { if (Math.abs(i) < 1) continue; const zz = fz + i * 22; for (let q = 0; q < 2; q++) R.blob(fx + 4 + q * 13, y + 1.2, zz, 5.6, 1.4 + q * 0.4, 8.5, c('#3f7a3a'), c('#8fb84f'), 7, 2); }
    R.box(fx + 6, y + 0.1, fz, 12, 0.8, 34, Math.PI / 2 * 0, HH);
    batch.add(R.geometry(), { far: true });
  }
  // Piata Unirii: the great round basin in its square, the Unirea store on the corner with its own real sign
  {
    const px = 465, pz = 1270, y = gy(px, pz);
    const R = new Raw(), J2 = new Raw();
    basin(R, J2, px, y, pz, 0.9, 50, 34);
    for (let i = 0; i < 18; i++) { const a = i / 18 * TAU; topiary(R, px + Math.cos(a) * 42, y, pz + Math.sin(a) * 42, 3); }
    batch.add(R.geometry());
    const jets2 = new THREE.Mesh(J2.geometry(), mat('#ffffff', { vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false })); jets2.frustumCulled = true; world.staticGroup.add(jets2);
    const s = SIDE(m('unirii', 90), L, 42);
    V.box(s.x, s.y, s.z, 96, 26, 52, s.yaw, c('#e2cca8'), mul(ROOF, 1.1), 0.92);
    const sn = Math.sin(s.yaw), cs = Math.cos(s.yaw), fx = s.x + sn * 26, fz = s.z + cs * 26;
    for (let f = 0; f < 5; f++) V.panel(fx, s.y + 2 + f * 4.8, fz, 90, 2.2, s.yaw, f === 0 ? WINL : WIN, 0.06);
    say(V, 'UNIREA', fx, s.y + 18.6, fz, s.yaw, 3.8, c('#c8392c'), 0.3);
    // the hotel across the square, and the long fronts that close it
    const b = SIDE(m('bulevard', -40), Rr, 40);
    unirii(F, b.x, b.y, b.z, b.yaw, 70, 20, 901);
    const e = SIDE(m('unirii', 200), L, 150); block(F, e.x, e.y, e.z, e.yaw, 100, 20, 902, { floors: 11 });
    // on the hill beyond the boulevard, as from every street here: the Patriarchate's towers, far and in peace
    church(V, 75, gy(75, 1450), 1450, 0.3);
    { const d = SIDE(m('bulevard', 60), L, 72); church(V, d.x, d.y, d.z + 5, d.yaw); }
  }
  // Calea Victoriei: the CEC with its dome on the left, its arch; the Muzeul National de Istorie facing it
  {
    const a = SIDE(m('cec', -70), L, 24); clearPalace(a, 62, 20, 34, { col: c('#efe0c0'), dome: 11, columns: 4, sign: 'CASA DE ECONOMII' });
    const b = SIDE(m('cec', -70), Rr, 24); clearPalace(b, 80, 18, 30, { col: c('#e6d8b8'), columns: 6, sign: 'MUZEUL DE ISTORIE' });
    // Cercul Militar: the French front, at the corner of Elisabeta, on the right
    const c1 = SIDE(m('elisabeta', 16), Rr, 18); clearPalace(c1, 56, 21, 30, { col: c('#d8c8a8'), columns: 8, sign: 'CERCUL MILITAR', roof: ROOFG });
    // the Zlatari church on the right, in its little yard
    const z0 = SIDE(m('cec', 40), Rr, 26); church(V, z0.x, z0.y, z0.z, z0.yaw);
  }
  // Piata Revolutiei: the Royal Palace on the left, the memorial alone in the open on the right, and Cretulescu beyond. Nothing else, and no stalls.
  {
    const a = SIDE(m('revolutiei', -10), L, 34); clearPalace(a, 120, 19, 30, { col: c('#eee0c2'), columns: 8, roof: ROOFG });
    const s = SIDE(m('revolutiei', -24), Rr, 40); memorial(V, s.x, s.y, s.z);
    const cr = SIDE(m('revolutiei', 96), L, 34); church(V, cr.x, cr.y, cr.z, cr.yaw);
    const u = SIDE(m('revolutiei', -24), Rr, 80); clearPalace(u, 74, 22, 22, { col: c('#d8cab2'), columns: 0, roof: ROOF });
    const u2 = SIDE(m('revolutiei', 80), Rr, 64); clearPalace(u2, 64, 24, 22, { col: c('#efe4cc'), columns: 0, roof: ROOF });
  }
  // a white Belle Epoque hotel on the right; the Ateneu itself past it, in its garden, its front turned to who comes up the street
  {
    const a = SIDE(m('ateneu', -44), Rr, 12); clearPalace(a, 60, 32, 30, { col: WHITE, columns: 6, roof: c('#8a8a90') });
    const s = SIDE(m('ateneu', 32), Rr, 30), road = at(m('ateneu', 32)), yaw = Math.atan2(-0.72, 0.69);
    ateneu(ctx, s.x, s.y, s.z, yaw);
    const R = new Raw();
    // a clipped bush of the garden row stays in the garden: one of them stood in the middle of the road and karts drove through it
    for (let i = -3; i <= 3; i++) if (i) { const sn = Math.sin(yaw), cs = Math.cos(yaw), x = s.x + sn * 34 + cs * i * 10, z = s.z + cs * 34 - sn * i * 10; if (free(x, z, 2.5)) topiary(R, x, s.y, z, 3.6); }
    // its lawn in 4 m squares, on its own side of the street and none on it: one flat square of it once lay over the road, and karts drove on grass
    const side = Math.sign((s.x - road.x) * road.nx + (s.z - road.z) * road.nz);
    for (let gx = -44; gx < 44; gx += 4) for (let gz = -44; gz < 44; gz += 4) {
      const x0 = s.x + gx, z0 = s.z + gz;
      if (free(x0 + 2, z0 + 2, 3) && ((x0 + 2 - road.x) * road.nx + (z0 + 2 - road.z) * road.nz) * side > 0) R.quad([x0, s.y + 0.12, z0], [x0, s.y + 0.12, z0 + 4], [x0 + 4, s.y + 0.12, z0 + 4], [x0 + 4, s.y + 0.12, z0], c('#94b256'));
    }
    batch.add(R.geometry());
  }
  // Stirbey and Cantacuzino on the left, ornate; Palatul Victoria in the fork of the square, with its fountain
  {
    const a = SIDE(m('stirbey', 12), L, 14); clearPalace(a, 44, 15, 24, { col: c('#efd9c4'), columns: 4 });
    const b = SIDE(m('cantacuzino', -40), L, 12); clearPalace(b, 38, 15, 26, { col: PEACH, dome: 5, columns: 4 });
    const vx = -305, vz = -345, y = gy(vx, vz); palace(V, vx, y, vz, Math.PI, 64, 18, 44, { col: c('#efdeb8'), columns: 12, roof: ROOFG, sign: 'PALATUL VICTORIA' });
  }
  // the Arc in its roundabout, on the Kiseleff axis
  {
    const p = at(m('arc', 50)), ax = -641, az = -1253;
    arc(V, ax, gy(ax, az), az, 0.34);
    const R = new Raw(); R.blob(ax, gy(ax, az) - 0.5, az, 26, 1.4, 26, c('#7c9c4a'), c('#a6c05a'), 16, 3); batch.add(R.geometry(), { far: true });
    void p;
  }
  // Universitate: the tall thin white wedge of the seventies; the Teatrul National in its low bulk across from it
  {
    const a = SIDE(m('universitate', -6), L, 30), R = V, H = 80, sn = Math.sin(a.yaw), cs = Math.cos(a.yaw), fx = a.x + sn * 8, fz = a.z + cs * 8;
    R.box(a.x, a.y, a.z, 36, H, 16, a.yaw, WHITE, c('#c8c8cc'), 0.95);
    for (let f = 0; f < 22; f++) R.panel(fx, a.y + 4 + f * 3.4, fz, 34, 1.6, a.yaw, f < 2 ? WINL : WIN, 0.06);
    const b = SIDE(m('universitate', 10), Rr, 24); clearPalace(b, 74, 20, 42, { col: c('#e5d0ae'), columns: 8, sign: 'TEATRUL NATIONAL', roof: ROOFG });
  }
  batch.add(V.geometry(), { far: false });

  // ---- the lake of Herastrau: flat water with the evening on it, boats, a pier ----
  {
    const lx = -350, lz = -1765, rx = 277, rz = 185, level = gy(-350, -1540) - 0.9, WR = new Raw(), seg = 48, far0 = c('#f2ddab'), near0 = c('#75b4b8'), mid = c('#a8cfc0');
    for (let i = 0; i < seg; i++) {
      const a = i / seg * TAU, b = (i + 1) / seg * TAU, P = (t, k) => [lx + Math.cos(t) * rx * k, level, lz + Math.sin(t) * rz * k];
      // the water is pale gold far off and clear green at your feet, one sweep over the whole lake
      const tone = (t, k) => { const zz = Math.sin(t) * k; return mix(far0, mix(mid, near0, Math.max(0, zz)), Math.min(1, (zz + 1) * 0.9)); };
      for (const [k0, k1] of [[0, 0.55], [0.55, 1]]) WR.quad(P(b, k0), P(a, k0), P(a, k1), P(b, k1), tone(a, k0), tone(a, k1));
    }
    batch.add(WR.geometry(), { far: true });
    const R = new Raw(), BOAT = [c('#f2e8d4'), c('#d96a4c'), c('#4f8ab0')];
    for (let i = 0; i < 8; i++) { const a = hash3(i, 3, 3) * TAU, k = 0.3 + hash3(i, 5, 3) * 0.55, x = lx + Math.cos(a) * rx * k, z = lz + Math.sin(a) * rz * k; R.blob(x, level + 0.2, z, 1.2, 0.45, 3, BOAT[i % 3], mul(BOAT[i % 3], 1.1), 7, 2); R.bar([x, level + 0.3, z], [x, level + 5, z], 0.08, c('#6e5a44')); R.quad([x, level + 1, z + 0.2], [x, level + 1, z + 2.4], [x, level + 5, z + 0.2], [x, level + 5, z + 0.2], WHITE); }
    // the white balustrade along the shore road
    for (let mm = m('parc', 110); mm < m('gaulle', -60); mm += 5) { const q = at(mm), x = q.x + q.nx * (q.hw + 2.4), z = q.z + q.nz * (q.hw + 2.4), yaw = Math.atan2(q.tx, q.tz); R.box(x, q.y - 0.8, z, 0.3, 1.8, 0.3, yaw, WHITE); if (Math.floor(mm / 5) % 2 === 0) R.box(x, q.y + 0.95, z, 0.22, 0.16, 5.1, yaw, STONE); }
    // the pier off the shore road, and the lake's restaurant on stilts
    const s = SIDE(m('lac', 50), L, 3);
    R.box(s.x + s.p.nx * 12, level + 0.5, s.z + s.p.nz * 12, 3.2, 0.3, 28, Math.atan2(s.p.nx, s.p.nz), c('#a88c62'));
    for (let t = 0; t < 4; t++) R.cyl(s.x + s.p.nx * (t * 8 + 2), level - 1, level + 0.6, s.z + s.p.nz * (t * 8 + 2), 0.2, 0.2, c('#6e5a44'), c('#6e5a44'), 5);
    const u = SIDE(m('lac', 130), L, 26);
    R.box(u.x, level + 2, u.z, 22, 5, 12, u.yaw, c('#f0e0c0'), c('#b7694c')); R.roof(u.x, level + 7, u.z, 24, 14, 3, u.yaw, c('#b7694c'));
    batch.add(R.geometry());
  }

  // ---- the heating main: the real silver pipe, a portal over the street where a steam vent blows; at the jump, the trench, plates and barriers ----
  {
    const W = new Raw();
    for (const h of def.hazards || []) {
      if (h.kind !== 'steam') continue;
      const mm = h.u * track.length, p = at(mm), y = p.y + 0.16;
      for (const s of [-1, 1]) { const a = at(mm - 40), b = at(mm + 40), off = (q) => [q.x + q.nx * s * (q.hw + 3.6), q.y + 2.8, q.z + q.nz * s * (q.hw + 3.6)]; if (s < 0) mainPipe(W, off(a), off(p)); if (s < 0) mainPipe(W, off(p), off(b)); }
      // up, over and down: the expansion loop every Bucuresti driver knows
      const A = [p.x - p.nx * (p.hw + 3.6), p.y + 2.8, p.z - p.nz * (p.hw + 3.6)], A2 = [A[0], p.y + 6.8, A[2]], B2 = [p.x + p.nx * (p.hw + 3.6), p.y + 6.8, p.z + p.nz * (p.hw + 3.6)], B = [B2[0], p.y + 2.8, B2[2]];
      mainPipe(W, A, A2); mainPipe(W, A2, B2); mainPipe(W, B2, B);
      for (const s of [-1, 1]) for (const t of [-7, 7]) { const q = at(mm + t); barrier(W, q.x + q.nx * s * (q.hw - 0.6), y, q.z + q.nz * s * (q.hw - 0.6), Math.atan2(q.tx, q.tz) + Math.PI / 2); cone(W, q.x + q.nx * s * (q.hw - 2), y, q.z + q.nz * s * (q.hw - 2)); }
      // the hole they dug: its rim of asphalt and dirt, on the pavement
      for (const s of [-1, 1]) W.blob(p.x + p.nx * s * (p.hw + 2.2), y - 0.1, p.z + p.nz * s * (p.hw + 2.2), 2.6, 0.5, 3.4, c('#9c7a54'), c('#b89670'), 7, 2);
    }
    for (const j of def.jumps || []) {
      const mm = j.u * track.length, p = at(mm), q = at(mm - 7), yaw = Math.atan2(p.tx, p.tz);
      // steel plates laid up over the lip of the trench, in the colours of the works
      for (const s of [-1, 1]) for (const t of [-3, 3]) { const b = at(mm + t); barrier(W, b.x + b.nx * s * (b.hw + 0.7), b.y + 0.16, b.z + b.nz * s * (b.hw + 0.7), yaw + Math.PI / 2); }
      const Pq = (o, d, h) => { const r = o; return [r.x + r.nx * d, r.y + h, r.z + r.nz * d]; };
      W.quad(Pq(q, p.hw - 0.3, 0.05), Pq(q, -p.hw + 0.3, 0.05), Pq(p, -p.hw + 0.3, 0.09), Pq(p, p.hw - 0.3, 0.09), c('#7f8488'));
    }
    batch.add(W.geometry());
  }
  // the bridge over the Dambovita: real railings in the river's walled channel run with the river
  F.flush(batch); fur.flush(batch); X.flush(batch);
}

export function update(time) { if (jetsMesh) jetsMesh.scale.y = 1 + 0.03 * Math.sin(time * 1.4); }
