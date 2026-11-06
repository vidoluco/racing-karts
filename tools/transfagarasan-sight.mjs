// How much of the hero painting the 3D ground leaves in view, round the lap. node tools/transfagarasan-sight.mjs
// Each row: lap fraction, position, the road's true heading, then the median and the highest elevation in deg of the ground over the hero's bearings (73 to 157) in the chase frame.
import { buildTrack } from '../src/world/track.js';
import { buildTerrain } from '../src/world/terrain.js';
import { loadTrackDef } from '../src/data/tracks.js';
export function heroSight(def, track, terrain, u, eye = 2.6) {
  const N = def.horizon.northDeg ?? 0, i = Math.floor(u * track.n), S = track.samples;
  const x = S.x[i], z = S.z[i], y = S.y[i] + eye, h = (Math.atan2(S.tx[i], -S.tz[i]) * 180 / Math.PI + N + 360) % 360;
  const el = [];
  for (let b = 73; b <= 157; b += 3) {
    const off = ((b - h + 540) % 360) - 180;
    if (Math.abs(off) > 42) continue;
    const a = (b - N) * Math.PI / 180, dx = Math.sin(a), dz = -Math.cos(a);
    let top = -90;
    for (let r = 25; r < 1400; r += 12) {
      const px = x + dx * r, pz = z + dz * r;
      if (px < terrain.x0 || pz < terrain.z0 || px > terrain.x0 + (terrain.w - 1) * terrain.step || pz > terrain.z0 + (terrain.h - 1) * terrain.step) break;
      top = Math.max(top, Math.atan2(terrain.heightAt(px, pz) - y, r) * 180 / Math.PI);
    }
    el.push(top);
  }
  el.sort((p, q) => p - q);
  return { x, z, y, h, n: el.length, median: el.length ? el[el.length >> 1] : null, max: el.length ? el[el.length - 1] : null };
}
if (process.argv[1].endsWith('transfagarasan-sight.mjs')) {
  const def = await loadTrackDef('transfagarasan'), track = buildTrack(def), terrain = buildTerrain(track);
  let seen = 0, clear = 0;
  for (let u = 0; u < 1; u += 0.04) {
    const r = heroSight(def, track, terrain, u);
    if (r.n) { seen++; if (r.median < 10) clear++; }
    console.log(u.toFixed(2), `e ${r.x.toFixed(0)} n ${(-r.z).toFixed(0)} y ${r.y.toFixed(0)} head ${r.h.toFixed(0)}`, r.n ? `median ${r.median.toFixed(1)} max ${r.max.toFixed(1)}` : 'hero out of frame');
  }
  console.log(`hero in frame at ${seen} of 25 points, ground under 10 deg at ${clear}`);
}
