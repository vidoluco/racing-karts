#!/usr/bin/env node
// The ground the Batur caldera is painted from: Copernicus GLO-30 on a plain metre grid, round the floor of the caldera. tools/panoramas/batur-paint.py renders it.
// node tools/panoramas/batur-dem.mjs. Writes data/raw/backdrop-photos/batur-dem-paint/dem.bin (float32, row 0 at the north) and dem.json.
import { writeFileSync } from 'node:fs';
import { loadDem, localFrame } from '../dem.mjs';

const [LAT, LON] = [-8.2488, 115.3599], R = 34000, STEP = 30, OUT = 'data/raw/backdrop-photos/batur-dem-paint';
const dem = await loadDem('data/raw/dem', { only: (f) => /S0[89]_00_E115/.test(f) && f.includes('COG_10') });
const f = localFrame(LAT, LON), n = Math.round(2 * R / STEP) + 1, a = new Float32Array(n * n);
for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
  const [lon, lat] = f.toLonLat(-R + i * STEP, -R + j * STEP);
  a[j * n + i] = dem.elevation(lon, lat);
}
writeFileSync(`${OUT}/dem.bin`, Buffer.from(a.buffer));
writeFileSync(`${OUT}/dem.json`, JSON.stringify({ n, step: STEP, radius: R, center: [LAT, LON] }));
console.log(n, a[Math.floor(n * n / 2)]);
