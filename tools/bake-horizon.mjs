#!/usr/bin/env node
// tools/bake-horizon.mjs <trackId> [--force]: the real skyline around a track, from Copernicus GLO-30 (tools/dem.mjs),
// as a polar grid in data/horizon/<id>.bin (Int16, little endian, azimuth by ring) with data/horizon/<id>.json.
// Azimuth 0 is true north, clockwise; rings run geometrically from r0 to r1, so the near massif gets the detail.
// Values are metres relative to def.horizon.altitude, in units of `unit` m. Each cell averages the DEM over its own
// footprint, or far ranges would alias into a comb of spikes along the skyline.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ensureTiles, loadDem, localFrame, tilesForBox } from './dem.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const NAZ = 1440, NR = 320, R0 = 1500, R1 = 42000, UNIT = 0.25;

export const ringRadius = (j, nr = NR, r0 = R0, r1 = R1) => r0 * (r1 / r0) ** (j / (nr - 1));

// lat, lon box of the disc of radius r around a centre, padded by a cell
function boxOf(lat, lon, r) {
  const dLat = (r + 500) / 111000, dLon = (r + 500) / (111320 * Math.cos(lat * Math.PI / 180));
  return [lat - dLat, lon - dLon, lat + dLat, lon + dLon];
}

export async function bakeHorizon(def, { offline = false, log = () => {} } = {}) {
  const { center: [lat, lon], altitude = 0 } = def.horizon;
  // def.horizon.near: where the ring starts, for a place whose walls stand closer than R0 (Bâlea's cirque is 1 km across)
  const R0x = def.horizon.near ?? R0;
  const dir = join(ROOT, 'data/raw/dem'), tiles = tilesForBox(boxOf(lat, lon, R1));
  const got = await ensureTiles(tiles, dir, { log, offline });
  const files = got.filter((g) => g.file).map((g) => g.file), sea = got.filter((g) => !g.file).map((g) => g.tile);
  const dem = await loadDem(dir, { files, sea, log });
  const frame = localFrame(lat, lon), out = new Int16Array(NAZ * NR), dAz = 2 * Math.PI / NAZ;
  const peak = new Float32Array(NAZ).fill(-90);
  for (let a = 0; a < NAZ; a++) {
    const az = a * dAz, sa = Math.sin(az), ca = Math.cos(az);
    for (let j = 0; j < NR; j++) {
      const r = ringRadius(j, NR, R0x), dr = r * ((R1 / R0x) ** (1 / (NR - 1)) - 1), wT = r * dAz;
      // cells wider than the DEM's 30 m average a few taps over their footprint
      const nt = Math.min(5, Math.max(1, Math.ceil(wT / 40))), nd = Math.min(5, Math.max(1, Math.ceil(dr / 40)));
      let s = 0, c = 0;
      for (let q = 0; q < nd; q++) for (let p = 0; p < nt; p++) {
        const rr = r + ((q + 0.5) / nd - 0.5) * dr, t = ((p + 0.5) / nt - 0.5) * wT;
        const x = sa * rr + ca * t, z = -ca * rr + sa * t, [lo, la] = frame.toLonLat(x, z);
        s += dem.elevation(lo, la); c++;
      }
      const h = s / c - altitude;
      out[a * NR + j] = Math.round(h / UNIT);
      const e = Math.atan2(h, r) * 180 / Math.PI;
      if (e > peak[a]) peak[a] = e;
    }
  }
  let hi = -1e9, lo = 1e9;
  for (let k = 0; k < out.length; k++) { const v = out[k] * UNIT; if (v > hi) hi = v; if (v < lo) lo = v; }
  const meta = {
    id: def.id, format: 'int16le', layout: 'az,ring', naz: NAZ, nr: NR, r0: R0x, r1: R1, unit: UNIT,
    center: [lat, lon], altitude, northDeg: def.horizon.northDeg ?? 0, min: lo, max: hi,
    source: 'Copernicus GLO-30', tiles: files,
  };
  return { meta, heights: out, peak };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2), id = args.find((a) => !a.startsWith('--'));
  if (!id) { console.error('usage: tools/bake-horizon.mjs <trackId>'); process.exit(2); }
  const { default: def } = await import(pathToFileURL(join(ROOT, `src/world/tracks/${id}.js`)).href);
  const bin = join(ROOT, `data/horizon/${id}.bin`), js = join(ROOT, `data/horizon/${id}.json`);
  if (existsSync(bin) && !args.includes('--force')) { console.log(`${bin} exists: --force to bake again`); process.exit(0); }
  const t0 = Date.now(), { meta, heights, peak } = await bakeHorizon(def, { log: console.log });
  mkdirSync(dirname(bin), { recursive: true });
  writeFileSync(bin, Buffer.from(heights.buffer, heights.byteOffset, heights.byteLength));
  writeFileSync(js, `${JSON.stringify(meta, null, 1)}\n`);
  // the skyline in the terminal: the bearing and elevation of the highest thing every 30 deg
  for (let b = 0; b < 360; b += 30) {
    let best = -90, at = b;
    for (let a = b * 4; a < (b + 30) * 4; a++) if (peak[a] > best) { best = peak[a]; at = a / 4; }
    console.log(`  ${String(b).padStart(3)}-${String(b + 30).padEnd(3)} top ${best.toFixed(1)} deg at ${at.toFixed(1)}`);
  }
  console.log(`${bin}: ${NAZ} x ${NR}, ${(heights.byteLength / 1e6).toFixed(2)} MB, ${meta.min.toFixed(0)}..${meta.max.toFixed(0)} m relative, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
