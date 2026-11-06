#!/usr/bin/env node
// The real land under the Giau road: Copernicus GLO-30 on the track's squeeze, as relief over the road's own height (what terrain.js spreads from the road), capped so that the ground stays under the paintings.
// node tools/panoramas/cortina-relief.mjs. Writes src/world/cortina-relief.js. Run again when the road moves.
import { writeFileSync } from 'node:fs';
import { loadDem, localFrame } from '../dem.mjs';
import def, { WORLD } from '../../src/world/tracks/cortina.js';
import { buildTrack } from '../../src/world/track.js';

const dem = await loadDem('data/raw/dem', { only: (f) => /N46_00_E01[12]/.test(f) && f.includes('COG_10') });
const f = localFrame(...WORLD.origin), track = buildTrack(def), S = track.samples, ax = [], ay = [], az = [];
for (let i = 0; i < S.x.length; i += 16) { ax.push(S.x[i]); ay.push(S.y[i]); az.push(S.z[i]); }
const STEP = 32, PAD = 760;
let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
for (let i = 0; i < ax.length; i++) { x0 = Math.min(x0, ax[i]); x1 = Math.max(x1, ax[i]); z0 = Math.min(z0, az[i]); z1 = Math.max(z1, az[i]); }
x0 = Math.floor((x0 - PAD) / STEP) * STEP; z0 = Math.floor((z0 - PAD) / STEP) * STEP;
const w = Math.ceil((x1 + PAD - x0) / STEP) + 1, h = Math.ceil((z1 + PAD - z0) / STEP) + 1, a = new Int16Array(w * h);
const end = (p, q, v) => { const t = Math.max(0, Math.min(1, (v - p) / (q - p))); return t * t * (3 - 2 * t); };
let hi = -1e9, lo = 1e9;
for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
  const x = x0 + i * STEP, z = z0 + j * STEP;
  let sw = 0, sy = 0, near = 1e12;
  for (let q = 0; q < ax.length; q++) { const e = (x - ax[q]) ** 2 + (z - az[q]) ** 2; if (e < near) near = e; const k = 1 / ((e + 900) * (e + 900)); sw += k; sy += k * ay[q]; }
  const [lon, lat] = f.toLonLat(x / WORLD.map, z / WORLD.map);
  const real = (dem.elevation(lon, lat) - WORLD.level) * WORLD.yScale, d = Math.sqrt(near);
  // the real shape, close to the road; the higher it would stand the softer it rises, so that the mountains themselves stay in the paintings
  let r = real - sy / sw;
  r = r > 0 ? 70 * (1 - Math.exp(-r / 70)) : Math.max(r, -60);
  r *= end(24, 170, d);
  a[j * w + i] = Math.round(r * 10);
  hi = Math.max(hi, r); lo = Math.min(lo, r);
}
writeFileSync('src/world/cortina-relief.js', `// Written by tools/panoramas/cortina-relief.mjs: tenths of a metre, int16, base64.\nexport const RELIEF = ${JSON.stringify({ x0, z0, step: STEP, w, h, data: Buffer.from(a.buffer).toString('base64') })};\n`);
console.log(w, h, 'relief', lo.toFixed(0), hi.toFixed(0));
