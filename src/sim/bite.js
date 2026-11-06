// Baileys: a kart that stays too close gets bitten. The ears go flat first (`biteWind` 0..1, the model's and the player's warning), so a
// clean pass at speed is safe and sitting on his shoulder is not. A bite is a short slide, the sausages of a mici in orbit take it instead,
// and then he has had enough for a few seconds. Only exists in a race that has him in it: no state, no cost and no effect on any other.
import { BITE, DT, mates } from './tuning.js';
import { kartInfo } from '../data/karts.js';

export function createBiters(R, karts) {
  const list = karts.filter((k) => kartInfo(k.kart)?.bites);
  for (const k of list) { k.biteWind = 0; R.priv[k.i].biteCd = 0; }
  return list;
}

const biteable = (o, k) => o !== k && !mates(o, k) && !o.finished && o.rescueT <= 0 && o.safeT <= 0 && o.bigT <= 0 && Math.abs(o.y - k.y) < BITE.level;

export function stepBites(R, biters) {
  const K = R.state.karts;
  if (R.state.t - R.goT < BITE.grace) return;
  for (const k of biters) {
    const p = R.priv[k.i];
    p.biteCd = Math.max(0, p.biteCd - DT);
    let near = null, best = BITE.range * BITE.range;
    if (p.biteCd <= 0 && !k.finished && k.rescueT <= 0 && k.hitT <= 0) {
      for (const o of K) {
        if (!biteable(o, k)) continue;
        const dx = o.x - k.x, dz = o.z - k.z, e = dx * dx + dz * dz;
        if (e < best) { best = e; near = o; }
      }
    }
    k.biteWind = near ? Math.min(1, k.biteWind + DT / BITE.wind) : Math.max(0, k.biteWind - DT / (BITE.wind * 0.6));
    if (!near || k.biteWind < 1) continue;
    // + left of the way he faces, as everywhere: the model turns his head that way
    const side = (near.x - k.x) * Math.cos(k.yaw) - (near.z - k.z) * Math.sin(k.yaw) >= 0 ? 1 : -1;
    R.emit({ type: 'bite', kart: k.i, victim: near.i, side, x: near.x, y: near.y, z: near.z });
    if (R.hitKart(near, k.i, 'slide', 'bite') === 'hit') R.priv[near.i].stickyT = BITE.t;
    k.biteWind = 0;
    p.biteCd = BITE.cooldown;
  }
}
