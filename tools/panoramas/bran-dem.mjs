#!/usr/bin/env node
// The ground the two great mountains of Bran are painted from: Copernicus GLO-30 on a plain metre grid, round the track's real place. tools/panoramas/bran-paint.py renders it.
// node tools/panoramas/bran-dem.mjs. Writes data/raw/backdrop-photos/bran-dem-paint/dem.bin (float32, row 0 at the north) and dem.json.
import { writeFileSync } from 'node:fs';
import { loadDem, localFrame } from '../dem.mjs';

const [LAT, LON] = [45.505, 25.3175], R = 36000, STEP = 30, OUT = 'data/raw/backdrop-photos/bran-dem-paint';
const dem = await loadDem('data/raw/dem', { only: (f) => /N45_00_E02[45]/.test(f) && f.includes('COG_10') });
const f = localFrame(LAT, LON), n = Math.round(2 * R / STEP) + 1, a = new Float32Array(n * n);
for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
  const [lon, lat] = f.toLonLat(-R + i * STEP, -R + j * STEP);
  a[j * n + i] = dem.elevation(lon, lat);
}
writeFileSync(`${OUT}/dem.bin`, Buffer.from(a.buffer));
writeFileSync(`${OUT}/dem.json`, JSON.stringify({ n, step: STEP, radius: R, center: [LAT, LON] }));
console.log(n, a[Math.floor(n * n / 2)]);
