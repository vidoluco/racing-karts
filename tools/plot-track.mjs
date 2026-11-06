// node tools/plot-track.mjs <trackId> [out.png]: the track from above on a hillshade, and in profile, to judge shape
// and flow without running the game. No dependencies: it writes the PNG itself.
import zlib from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { loadTrackDef } from '../src/data/tracks.js';
import { buildTrack } from '../src/world/track.js';
import { buildTerrain } from '../src/world/terrain.js';

const id = process.argv[2] || 'antelao', out = process.argv[3] || `/tmp/${id}.png`;
const track = buildTrack(await loadTrackDef(id)), terrain = buildTerrain(track), S = track.samples;

const W = 1500, TOP = 1000, PROF = 340, H = TOP + PROF;
const buf = new Uint8Array(W * H * 3).fill(255);
const put = (x, y, c) => {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const k = (y * W + x) * 3;
  buf[k] = c[0]; buf[k + 1] = c[1]; buf[k + 2] = c[2];
};
const disc = (x, y, r, c) => { for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (i * i + j * j <= r * r) put(x + i, y + j, c); };
const line = (a, b, c, d, col, r = 0) => {
  const s = Math.max(1, Math.ceil(Math.hypot(c - a, d - b)));
  for (let t = 0; t <= s; t++) (r ? disc(a + (c - a) * t / s, b + (d - b) * t / s, r, col) : put(a + (c - a) * t / s, b + (d - b) * t / s, col));
};
const FONT = { 0: '757', 1: '262', 2: '627', 3: '737', 4: '571', 5: '436', 6: '477', 7: '711', 8: '777', 9: '771', '.': '001', '-': '030', m: '575' };
function text(x, y, s, col = [0, 0, 0], k = 2) {
  const G = { 0: [7, 5, 5, 5, 7], 1: [2, 6, 2, 2, 7], 2: [7, 1, 7, 4, 7], 3: [7, 1, 7, 1, 7], 4: [5, 5, 7, 1, 1], 5: [7, 4, 7, 1, 7], 6: [7, 4, 7, 5, 7], 7: [7, 1, 1, 1, 1], 8: [7, 5, 7, 5, 7], 9: [7, 5, 7, 1, 7], '.': [0, 0, 0, 0, 2], '-': [0, 0, 7, 0, 0] };
  void FONT;
  let cx = x;
  for (const ch of String(s)) {
    const g = G[ch];
    if (g) for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (g[r] & (4 >> c)) for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) put(cx + c * k + a, y + r * k + b, col);
    cx += 4 * k;
  }
}

// Top view
let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
for (let i = 0; i < track.n; i++) { minX = Math.min(minX, S.x[i]); maxX = Math.max(maxX, S.x[i]); minZ = Math.min(minZ, S.z[i]); maxZ = Math.max(maxZ, S.z[i]); }
const pad = 70, scale = Math.min(W / (maxX - minX + 2 * pad), TOP / (maxZ - minZ + 2 * pad));
const ox = (W - (maxX - minX) * scale) / 2, oz = (TOP - (maxZ - minZ) * scale) / 2;
const sx = (x) => ox + (x - minX) * scale, sz = (z) => oz + (z - minZ) * scale;
const wx = (px) => minX + (px - ox) / scale, wz = (py) => minZ + (py - oz) / scale;
let ymin = 1e9, ymax = -1e9;
for (let i = 0; i < track.n; i++) { ymin = Math.min(ymin, S.y[i]); ymax = Math.max(ymax, S.y[i]); }
const nrm = {};
for (let py = 0; py < TOP; py++) for (let px = 0; px < W; px++) {
  const x = wx(px), z = wz(py), h = terrain.heightAt(x, z);
  terrain.normalAt(x, z, nrm);
  const shade = Math.max(0, nrm.x * -0.55 + nrm.y * 0.7 + nrm.z * -0.45);
  const t = Math.min(1, Math.max(0, (h - ymin + 15) / (ymax - ymin + 50)));
  let c = [120 + 120 * t, 175 + 40 * t, 110 + 60 * t];
  if (terrain.water !== null && h < terrain.water) c = [90, 180, 220];
  put(px, py, c.map((v) => Math.min(255, v * (0.45 + 0.75 * shade))));
}
const roadColor = (i) => {
  const st = track.structureAt(i);
  if (st === 'viaduct') return [190, 60, 200];
  if (st === 'bridge') return [240, 120, 40];
  if (st === 'tunnel') return [30, 30, 30];
  const s = track.surfaceAt(i);
  return s === 'dirt' ? [185, 140, 90] : s === 'cobble' ? [150, 140, 130] : [92, 88, 100];
};
for (const sc of track.shortcuts) for (let i = 0; i < sc.n; i++) {
  const hw = sc.samples.w[i] / 2;
  line(sx(sc.samples.x[i] - sc.samples.nx[i] * hw), sz(sc.samples.z[i] - sc.samples.nz[i] * hw), sx(sc.samples.x[i] + sc.samples.nx[i] * hw), sz(sc.samples.z[i] + sc.samples.nz[i] * hw), [230, 200, 80], 1);
}
// lower levels first, so a deck shows on top where they cross
const order = [...Array(track.n).keys()].sort((a, b) => S.y[a] - S.y[b]);
for (const i of order) {
  const hw = S.w[i] / 2, c = roadColor(i);
  line(sx(S.x[i] - S.nx[i] * hw), sz(S.z[i] - S.nz[i] * hw), sx(S.x[i] + S.nx[i] * hw), sz(S.z[i] + S.nz[i] * hw), c, 1);
}
for (let i = 0; i < track.n; i++) put(sx(track.racingLine.x[i]), sz(track.racingLine.z[i]), [255, 255, 255]);
for (const b of track.bands) for (const q of b.boxes) disc(sx(q.x), sz(q.z), 3, [250, 210, 40]);
for (const p of track.pads) disc(sx(p.x), sz(p.z), 5, [255, 90, 40]);
for (const j of track.jumps) disc(sx(j.x), sz(j.z), 7, [40, 220, 255]);
for (const h of track.def.hazards || []) { const P = track.pointAt(h.u); disc(sx(P.x), sz(P.z), 7, [255, 40, 110]); }
for (const g of track.startGrid(8)) disc(sx(g.x), sz(g.z), 2, [255, 255, 255]);
for (let k = 0; k < 20; k++) {
  const P = track.pointAt(k / 20), lx = sx(P.x + P.nx * (P.w / 2 + 12)), ly = sz(P.z + P.nz * (P.w / 2 + 12));
  disc(sx(P.x), sz(P.z), 2, [0, 0, 0]);
  text(lx - 8, ly - 5, (k / 20).toFixed(2).slice(1), k === 0 ? [255, 0, 0] : [0, 0, 0]);
}
const start = track.pointAt(0);
line(sx(start.x + start.nx * 10), sz(start.z + start.nz * 10), sx(start.x - start.nx * 10), sz(start.z - start.nz * 10), [255, 0, 0], 2);
// a north arrow: -z is up on this plot, and the Antelao lies about ENE
line(40, 70, 40, 25, [0, 0, 0], 1); line(40, 25, 32, 38, [0, 0, 0], 1); line(40, 25, 48, 38, [0, 0, 0], 1);

// Profile, with the slope under it
const py0 = TOP + 20, ph = PROF - 110, yspan = (ymax - ymin + 20);
const px = (i) => 20 + (W - 40) * i / track.n, ypix = (y) => py0 + ph - (y - ymin + 10) / yspan * ph;
for (let py = TOP; py < H; py++) for (let x = 0; x < W; x++) put(x, py, [250, 248, 242]);
for (let y = Math.ceil(ymin / 10) * 10; y <= ymax + 5; y += 10) { line(20, ypix(y), W - 20, ypix(y), [225, 222, 215]); text(2, ypix(y) - 5, y, [120, 120, 120], 1); }
if (terrain.water !== null) line(20, ypix(terrain.water), W - 20, ypix(terrain.water), [90, 180, 220]);
for (let i = 0; i < track.n; i++) {
  const t = terrain.heightAt(S.x[i], S.z[i]);
  line(px(i), ypix(t), px(i), py0 + ph + 10, [214, 222, 196]);
}
for (let i = 1; i < track.n; i++) line(px(i - 1), ypix(S.y[i - 1]), px(i), ypix(S.y[i]), roadColor(i), 1);
for (const b of track.bands) line(px(b.i), py0, px(b.i), py0 + ph, [250, 200, 40]);
for (const p of track.pads) line(px(p.i), py0, px(p.i), py0 + ph, [255, 90, 40]);
for (const j of track.jumps) line(px(j.i), py0, px(j.i), py0 + ph, [40, 200, 240]);
for (const m of track.markers) if (m.tag === 'hairpin') disc(px(m.i), ypix(S.y[m.i]), 4, [0, 120, 0]);
for (let k = 0; k <= 20; k++) text(px(k / 20 * track.n) - 8, py0 + ph + 14, (k / 20).toFixed(2), [80, 80, 80], 1);
const sBase = H - 40;
line(20, sBase, W - 20, sBase, [150, 150, 150]);
for (let i = 0; i < track.n; i++) {
  const a = (i - 1 + track.n) % track.n, b = (i + 1) % track.n, s = (S.y[b] - S.y[a]) / (2 * track.step);
  put(px(i), sBase - s * 120, Math.abs(s) > 0.16 ? [230, 40, 40] : [60, 60, 60]);
  put(px(i), H - 8 - Math.min(26, Math.abs(track.curvature[i]) * 500), [40, 90, 200]);
}

// PNG
const crc = (() => {
  const T = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; T[n] = c; }
  return (b) => { let c = -1; for (const v of b) c = T[(c ^ v) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
})();
const chunk = (type, data) => {
  const head = Buffer.from(type), len = Buffer.alloc(4), cc = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  cc.writeUInt32BE(crc(Buffer.concat([head, data])));
  return Buffer.concat([len, head, data, cc]);
};
const raw = Buffer.alloc((W * 3 + 1) * H);
for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; Buffer.from(buf.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1); }
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));

// The numbers an author needs to place bands, pads and zones by hand
let maxSlope = 0, maxSlopeAt = 0, minR = 1e9, minRAt = 0;
for (let i = 0; i < track.n; i++) {
  const b = (i + 1) % track.n, s = Math.abs(S.y[b] - S.y[i]) / track.step;
  if (s > maxSlope) { maxSlope = s; maxSlopeAt = i / track.n; }
  const r = 1 / Math.max(1e-6, Math.abs(track.curvature[i]));
  if (r < minR) { minR = r; minRAt = i / track.n; }
}
console.log(`${id}: length ${track.length.toFixed(0)} m, n ${track.n}, y ${ymin.toFixed(1)}..${ymax.toFixed(1)} (range ${(ymax - ymin).toFixed(1)}), max slope ${(maxSlope * 100).toFixed(1)}% at u ${maxSlopeAt.toFixed(3)}, min radius ${minR.toFixed(1)} m at u ${minRAt.toFixed(3)}`);
console.log('structures', track.structures.map((s) => `${s.kind} ${s.from.toFixed(3)}-${s.to.toFixed(3)} ${s.length.toFixed(0)} m`).join(', '));
console.log('points u', track.pointU.map((u, j) => `${j}:${u.toFixed(3)}`).join(' '));
console.log('terrain', terrain.w, 'x', terrain.h, 'written', out);
