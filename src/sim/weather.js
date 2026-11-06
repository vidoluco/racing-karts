// The weather as the road feels it: grip and speed per surface (WEATHER in tuning.js), puddles in the rain and drifts in the snow as patches on the road,
// thunder. Only a race created with `weather` has any of this: it has its own random stream, so the rest of the race draws what it always drew.
import { WEATHER, DT } from './tuning.js';
import { createRng, mixSeed } from './rng.js';

// No patch in a tunnel, on the start, on a jump or a boost pad: a slide there would feel like a cheat.
function placePatches(track, cfg, rng) {
  const out = [], S = track.samples, n = track.n, step = track.step, keep = [];
  for (const j of track.jumps || []) keep.push(j.i);
  for (const q of track.pads || []) keep.push(q.i);
  const near = (i, m) => keep.some((k) => { let o = Math.abs(k - i); if (o > n / 2) o = n - o; return o * step < m; });
  let at = (70 + rng.next() * 60);
  const len = track.length - 60;
  while (at < len) {
    const i = Math.round(at / step) % n;
    if (track.structureAt(i) !== 'tunnel' && !near(i, 34)) {
      const hw = S.w[i] / 2, rz = cfg.rz[0] + rng.next() * (cfg.rz[1] - cfg.rz[0]), rx = cfg.rx[0] + rng.next() * (cfg.rx[1] - cfg.rx[0]);
      const room = Math.max(0, hw - rz - 0.6), d = (rng.next() * 2 - 1) * room;
      const f = i, yaw = Math.atan2(S.tx[i], S.tz[i]);
      out.push({ id: out.length, i, d, rx, rz, x: S.x[i] + S.nx[i] * d, y: track.heightAt(f, d), z: S.z[i] + S.nz[i] * d, yaw, bank: S.bank[i] });
    }
    at += cfg.every[0] + rng.next() * (cfg.every[1] - cfg.every[0]);
  }
  return out;
}

export function createWeather(R, w, seed) {
  const cfg = WEATHER[w.kind] || null, rng = createRng(mixSeed(seed, 23)), T = R.track;
  const patches = cfg?.patch ? placePatches(T, cfg.patch, rng) : [];
  // which patch a sample of the road belongs to: a kart asks in one step, on a lap of any length
  const at = new Int16Array(T.n).fill(-1);
  for (const q of patches) {
    const h = Math.ceil(q.rx / T.step);
    for (let o = -h; o <= h; o++) at[((q.i + o) % T.n + T.n) % T.n] = q.id;
  }
  return { kind: w.kind, night: !!w.night, cfg, patches, at, rng, thunderIn: cfg?.thunder ? cfg.thunder[0] * 0.6 + rng.next() * cfg.thunder[1] : 1e9 };
}

export const weatherGrip = (W, k) => W.cfg?.grip?.[k.surface] ?? 1;
export const weatherSpeed = (W, k) => W.cfg?.speed?.[k.surface] ?? 1;

// The patch under this kart, -1 for none: on the main road, on the ground, in the ellipse.
function patchUnder(W, R, k, p) {
  if (!k.grounded || k.shortcut >= 0 || k.bigT > 0) return -1;
  const id = W.at[p.i];
  if (id < 0) return -1;
  const q = W.patches[id];
  let o = p.i - q.i;
  if (o > R.track.n / 2) o -= R.track.n; else if (o < -R.track.n / 2) o += R.track.n;
  const a = (o * R.track.step) / q.rx, b = (k.d - q.d) / q.rz;
  return a * a + b * b <= 1 ? id : -1;
}

// Once per kart per step, before it moves: the slide lasts a moment after the patch, and the entry is one event.
export function stepWeatherKart(R, k, p, dt) {
  const W = R.weather;
  if (!W.cfg?.patch) return;
  const id = patchUnder(W, R, k, p);
  // one splash a patch: grazing its edge goes in and out of it, and that is not a second puddle
  if (p.wxSplash >= 0 && W.at[p.i] !== p.wxSplash) p.wxSplash = -1;
  if (id >= 0) {
    if (p.wxSplash !== id) {
      p.wxSplash = id;
      if (Math.abs(k.speed) > 6) R.emit({ type: 'splash', kart: k.i, kind: W.kind, x: k.x, y: k.y, z: k.z, speed: Math.abs(k.speed) });
    }
    p.wxT = W.cfg.patch.linger;
  } else p.wxT = Math.max(0, (p.wxT || 0) - dt);
}

export function stepWeather(R) {
  const W = R.weather, s = R.state.weather;
  s.flash = Math.max(0, s.flash - DT / 0.32);
  for (const k of R.state.karts) s.cover[k.i] = R.track.structureAt(k.trackI ?? 0) === 'tunnel' ? 1 : 0;
  if (W.cfg?.thunder && (W.thunderIn -= DT) <= 0) {
    W.thunderIn = W.cfg.thunder[0] + W.rng.next() * (W.cfg.thunder[1] - W.cfg.thunder[0]);
    s.flash = 0.55 + W.rng.next() * 0.45;
    R.emit({ type: 'thunder', delay: 0.25 + W.rng.next() * 1.1, flash: s.flash });
  }
}

// Bots dodge a patch like any spill, by the road sample in front of them, so a lap of 10 km costs no more than one of 2.
export function patchesAhead(W, i, n, reachSamples, fn) {
  let last = -1;
  for (let o = 2; o < reachSamples; o += 2) {
    const id = W.at[(i + o) % n];
    if (id >= 0 && id !== last) { fn(W.patches[id]); last = id; }
  }
}
