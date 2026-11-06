// Traffic: hundreds of vehicles and no agents. Every vehicle is a pure function of time. A stream is one lane along one stretch of
// road; its vehicles sit in slots a fixed distance apart on a stretched road coordinate K, where a jam (a low speed factor of the
// stretch) is long, so that slots bunch up in it and spread out past it, as real traffic does, without any car ever following any
// other. A slow wave through the slots gives stop and go. Nothing here is stepped, so a vehicle costs nothing until a kart or a
// camera asks where it is, and only slots near the question are ever looked at: the cost does not grow with the lap.
// The little state there is (who has been knocked aside) is in state.traffic and comes back through the same functions.
// def.traffic: { jams: [{ from, to, k }], lanes: [{ from, to, d, dir, speed, gap, fill, mix, weave, wave, swarm, seed }], crossings: [...] }
// from and to: metres, or a mark name, or [mark, metres]. See docs/long-tracks-howto.md.

import { clamp } from './tuning.js';
import { hitKart } from './items.js';

// len and wid: m. h: m, what a jump clears. heavy: 0 scatters when hit, 1 spins you, 2 stops you dead and does not care. honk: which horn.
// load: a light vehicle too loaded to swerve. A plain scooter sees you coming and parts; these do not, and their load goes everywhere.
export const VEHICLES = {
  motor: { len: 2, wid: 0.9, h: 2.1, heavy: 0, honk: 'beep' },
  ojek: { len: 2, wid: 0.9, h: 2.1, heavy: 0, honk: 'beep' },
  krupuk: { len: 2, wid: 1.5, h: 2, heavy: 0, honk: 'beep', load: '#f5e6b8' },
  family: { len: 2.1, wid: 0.9, h: 2.1, heavy: 0, honk: 'beep', load: '#f4c542' },
  galon: { len: 2, wid: 1.3, h: 2.1, heavy: 0, honk: 'beep', load: '#7fd0f2' },
  ayam: { len: 2, wid: 1.5, h: 2.1, heavy: 0, honk: 'beep', load: '#fbfaf2' },
  melon: { len: 2, wid: 1.4, h: 2, heavy: 0, honk: 'beep', load: '#6cc452' },
  sofa: { len: 2.1, wid: 2, h: 2.6, heavy: 0, honk: 'beep', load: '#d9604f' },
  gerobak: { len: 2.1, wid: 1.1, h: 2.2, heavy: 0, honk: 'bell', load: '#f0d9a0' },
  bajaj: { len: 2.6, wid: 1.4, h: 1.9, heavy: 1, honk: 'toot' },
  car: { len: 3.9, wid: 1.8, h: 1.6, heavy: 1, honk: 'horn' },
  saloon: { len: 4.3, wid: 1.65, h: 1.45, heavy: 1, honk: 'horn' },
  mpv: { len: 4.2, wid: 1.8, h: 1.9, heavy: 1, honk: 'horn' },
  angkot: { len: 3.9, wid: 1.8, h: 2.1, heavy: 1, honk: 'horn' },
  truck: { len: 6, wid: 2.2, h: 3, heavy: 2, honk: 'air' },
  metromini: { len: 7.2, wid: 2.3, h: 2.9, heavy: 2, honk: 'air' },
  bus: { len: 10.5, wid: 2.5, h: 3.3, heavy: 2, honk: 'air' },
};
export const VEHICLE_KINDS = Object.keys(VEHICLES);

const KART_SIDE = 0.8, KART_LEN = 1.05;  // generous: a pass that looks clean is clean
const EDGE = 16;          // K metres at each end of a stream over which a vehicle grows or shrinks away, turning off down a side street
const WAVE_A = 2.4;       // s the stop and go wave moves a slot; A * omega under 1 keeps every vehicle going forward
const WAVE_W = 0.3;       // rad/s
const CUT_SPEED = 9;      // m/s closing on a heavy thing from behind before it is a real crash and not a nudge
const AFTER_SPIN_SAFE = 3; // s more than the usual grace, against traffic only: a spin in the thick of it is never followed by another
const STUCK_THROUGH = 2.8; // s standing still before a kart may slip through what holds it
const SPIN_GAP = 16;       // s after a spin in which a truck or a bus only stops you short: bad luck comes once, not all the way down the road
const SHORT_KEEP = 0.35;   // what a truck or a bus leaves of your speed in that time
const LIGHT_KEEP = 0.6;    // what a car, a bajaj or an angkot leaves of your speed when you run into the back of it
const KNOCK = { 0: 3.2, 1: 1.9, 2: 1.2 }; // s a knocked vehicle stays out of play
const HONK_GAP = 0.28;    // s between chances of a horn near a human
const PART_T = 0.26, PART_W = 1.9; // s ahead of a kart and m to its side: a scooter there swerves out of the way, the swarm opens like water

const frac = (x) => x - Math.floor(x);
export const slotHash = (a, b) => frac(Math.sin(a * 127.1 + b * 311.7) * 43758.5453);

function atMetres(def, track, q) {
  if (typeof q === 'number') return q;
  const [name, off] = Array.isArray(q) ? q : [q, 0];
  const j = def.marks?.[name];
  if (j === undefined) throw new Error(`track ${def.id}: traffic names an unknown mark ${name}`);
  return track.pointU[j] * track.length + (off || 0);
}

// Built by the sim and again, identically, by the renderer: nothing in here changes during a race.
export function createTraffic(track) {
  const cfg = track.def.traffic;
  if (!cfg) return null;
  const n = track.n, step = track.step, K = new Float32Array(n + 1), kAt = new Float32Array(n).fill(1);
  for (const j of cfg.jams || []) {
    const a = Math.round(atMetres(track.def, track, j.from) / step), b = Math.round(atMetres(track.def, track, j.to) / step), ramp = Math.round((j.ramp ?? 70) / step);
    for (let i = Math.max(0, a - ramp); i < Math.min(n, b + ramp); i++) {
      const e = Math.min(1, (i - a + ramp) / ramp, (b + ramp - i) / ramp), s = e * e * (3 - 2 * e);
      kAt[i] = Math.min(kAt[i], 1 + (j.k - 1) * s);
    }
  }
  for (let i = 0; i < n; i++) K[i + 1] = K[i] + step / kAt[i];

  const streams = [];
  (cfg.lanes || []).forEach((L, index) => {
    const a = clamp(atMetres(track.def, track, L.from) / step, 0, n - 1), b = clamp(atMetres(track.def, track, L.to) / step, 0, n - 1);
    if (b <= a) throw new Error(`track ${track.def.id}: traffic lane ${index} runs backward`);
    const mix = L.mix, kinds = Object.keys(mix), weights = kinds.map((q) => mix[q]);
    for (const q of kinds) if (!VEHICLES[q]) throw new Error(`track ${track.def.id}: unknown vehicle ${q}`);
    const sum = weights.reduce((x, y) => x + y, 0);
    const K0 = kAtF(K, a), K1 = kAtF(K, b), v = L.speed ?? 11, gap = L.gap ?? 26;
    streams.push({
      index, a, b, K0, K1, v, gap, d: L.d, dir: L.dir ?? 1, fill: L.fill ?? 0.8, kinds, weights, sum, weave: L.weave ?? 0.15, wave: L.wave ?? 1,
      seed: L.seed ?? (index * 7.13 + 1.7), swarm: L.swarm ?? 0, swap: L.swap ?? null, lift: L.lift ?? 0, jit: (L.jit ?? 0) * gap,
      kappa: 0.25 * gap / (v * WAVE_A), phase: (L.phase ?? index * 1.37),
    });
  });
  // which streams to look at around a sample
  const CELL = 64, cells = Array.from({ length: (n >> 6) + 2 }, () => []);
  streams.forEach((st) => {
    for (let c = Math.max(0, (st.a >> 6) - 1), z = Math.min(cells.length - 1, (st.b >> 6) + 1); c <= z; c++) cells[c].push(st);
  });
  return { n, step, K, kAt, streams, cells, CELL, knocked: new Map(), crossings: buildCrossings(track, cfg), track };
}

function kAtF(K, f) {
  const i = Math.floor(f), t = f - i;
  return K[i] + (K[Math.min(K.length - 1, i + 1)] - K[i]) * t;
}
// Sample coordinate of a K position, by bisection from a table that only rises.
function fOfK(K, q) {
  let a = 0, b = K.length - 1;
  while (b - a > 1) { const m = (a + b) >> 1; if (K[m] <= q) a = m; else b = m; }
  return a + (q - K[a]) / Math.max(1e-6, K[b] - K[a]);
}

// A slot's kind, or null if the slot is empty. The swarm is a pulse in the fill: packs and gaps go by together.
function slotKind(st, id) {
  const r = slotHash(st.seed, id), f = st.swarm ? clamp(st.fill + st.swarm * Math.sin(id * 0.19 + st.seed), 0, 1) : st.fill;
  if (r > f) return null;
  let x = slotHash(st.seed + 3.3, id) * st.sum;
  for (let i = 0; i < st.kinds.length; i++) { x -= st.weights[i]; if (x <= 0) return st.kinds[i]; }
  return st.kinds[st.kinds.length - 1];
}

// jit: a slot sits a little off its place, so that a rank of bikes is a rabble and not a parade
const slotQ = (st, id, t) => st.v * (t + st.wave * WAVE_A * Math.sin(WAVE_W * t - st.kappa * id + st.phase)) - id * st.gap + (st.jit ? slotHash(st.seed + 6.6, id) * st.jit : 0);

// Sideways: a wobble, a slow wander, and for a marked slot a lane change. A pure function of time, so a bot can look ahead by asking.
function slotD(st, id, t) {
  let d = st.d;
  if (st.weave) {
    const a = slotHash(st.seed + 5.1, id), b = slotHash(st.seed + 9.7, id);
    d += st.weave * (Math.sin(t * (0.5 + a * 0.9) + a * 40) * 0.75 + Math.sin(t * (1.3 + b) + b * 40) * 0.25);
  }
  if (st.swap !== null) {
    // every so often a slot of this lane spends a while over the way: cars change lanes, and a bajaj changes them for no reason
    const c = t / 17 + slotHash(st.seed + 1.1, id) * 7, u = frac(c);
    if (Math.floor(c) % 3 === 0 && slotHash(st.seed + 2.2, id + Math.floor(c) * 13) < 0.5) {
      const e = u < 0.2 ? u / 0.2 : u > 0.8 ? (1 - u) / 0.2 : 1;
      d += st.swap * e * e * (3 - 2 * e);
    }
  }
  return d;
}

// One vehicle's pose. `out` is reused; returns false for an empty or finished slot.
function pose(T, st, id, t, out, knocked) {
  const q = slotQ(st, id, t), span = st.K1 - st.K0;
  if (q < 0 || q > span) return false;
  const kind = slotKind(st, id);
  if (!kind) return false;
  const Kv = st.dir > 0 ? st.K0 + q : st.K1 - q, f = fOfK(T.K, Kv);
  out.stream = st; out.id = id; out.kind = kind; out.f = f; out.d = slotD(st, id, t);
  out.scale = Math.min(1, Math.min(q, span - q) / EDGE);
  const rate = 1 + st.wave * WAVE_A * WAVE_W * Math.cos(WAVE_W * t - st.kappa * id + st.phase);
  out.rate = rate;
  out.v = st.v * rate * T.kAt[Math.min(T.n - 1, Math.floor(f))] * st.dir;
  out.knock = null;
  if (knocked) {
    const e = knocked.get(st.index * 1e6 + id);
    if (e && t < e.t0 + e.dur) {
      const a = (t - e.t0) / e.dur, out0 = a < 0.25 ? a / 0.25 : a > 0.65 ? (1 - a) / 0.35 : 1;
      out.d += e.side * e.far * out0 * out0 * (3 - 2 * out0);
      out.knock = e; out.knockA = a;
    }
  }
  return true;
}

// Every vehicle whose sample is between f0 and f1, oldest stream first. cb(pose) may not keep the object.
const P = { stream: null, id: 0, kind: '', f: 0, d: 0, scale: 1, rate: 1, v: 0, knock: null, knockA: 0 };
export function forEachVehicle(T, f0, f1, t, cb, list = null) {
  const K0 = kAtF(T.K, clamp(f0, 0, T.n)), K1 = kAtF(T.K, clamp(f1, 0, T.n)), A = WAVE_A * 1.05;
  const seen = list || (T.cells[clamp(Math.round((f0 + f1) / 2) >> 6, 0, T.cells.length - 1)]);
  for (const st of seen) {
    if (st.b < f0 || st.a > f1) continue;
    const q0 = st.dir > 0 ? K0 - st.K0 : st.K1 - K1, q1 = st.dir > 0 ? K1 - st.K0 : st.K1 - K0, base = st.v * t, amp = st.v * A * st.wave;
    // q = base + wave - id * gap, so these ids can be in the window
    const lo = Math.floor((base - amp - q1) / st.gap), hi = Math.ceil((base + amp + st.jit - q0) / st.gap);
    for (let id = lo; id <= hi; id++) {
      // the road coordinate first: it costs one sine, and most ids of a dense lane fall outside the window
      const q = slotQ(st, id, t);
      if (q < q0 - 1 || q > q1 + 1) continue;
      if (!pose(T, st, id, t, P, T.knocked)) continue;
      if (P.f < f0 || P.f > f1) continue;
      cb(P);
    }
  }
}

// How many vehicles are on the lap right now, for tests and the HUD's brag.
export function countVehicles(T, t) {
  let c = 0;
  for (const st of T.streams) {
    const span = st.K1 - st.K0, lo = Math.floor((st.v * t - st.v * WAVE_A - span) / st.gap), hi = Math.ceil((st.v * t + st.v * WAVE_A + st.jit) / st.gap);
    for (let id = lo; id <= hi; id++) if (pose(T, st, id, t, P, null)) c++;
  }
  return c;
}

export const vehicleSpeed = (e) => e.v;

// ---------- the railway crossing ----------
function buildCrossings(track, cfg) {
  const out = [];
  for (const c of cfg.crossings || []) {
    const m = atMetres(track.def, track, c.at), i = Math.round(m / track.step);
    out.push({ i, f: m / track.step, period: c.period ?? 34, warn: c.warn ?? 4.5, pass: c.pass ?? 5, half: c.half ?? 5.5, phase: c.phase ?? 0, yaw: c.yaw ?? 0, trainLen: c.trainLen ?? 72 });
  }
  return out;
}
// 0 quiet; warn: the bell and the barrier; pass: the train is on the road. A pure function of time.
export function crossingState(c, t) {
  const u = frac(t / c.period + c.phase) * c.period;
  if (u < c.warn) return { phase: 'warn', a: u / c.warn };
  if (u < c.warn + c.pass) return { phase: 'pass', a: (u - c.warn) / c.pass };
  return { phase: 'quiet', a: 0 };
}

// ---------- the race ----------
// Rain may come, or may not: a seed decides, and when. It greases the road a little and darkens the sky; the streets flood on their own schedule (def.disasters).
export function createTrafficState(track, seed = 1) {
  const R = track.def.traffic?.rain, hit = R ? slotHash(seed + 0.31, 7.7) : 1;
  const on = !!R && hit < (R.chance ?? 0.7), from = on ? (R.first ?? 50) + slotHash(seed + 0.77, 3.1) * (R.spread ?? 90) : 1e9, len = R?.len ?? 90;
  return { knocked: [], rain: 0, rainFrom: from, rainTo: from + len };
}
export function rainAt(tr, t) {
  if (!tr) return 0;
  const a = (t - tr.rainFrom) / 7, b = (tr.rainTo - t) / 9;
  return clamp(Math.min(a, b), 0, 1);
}

function knock(R, e, k, side, big = false, part = false) {
  const T = R.traffic, st = e.stream, V = VEHICLES[e.kind], key = st.index * 1e6 + e.id, s = R.state;
  if (T.knocked.has(key) && s.t < T.knocked.get(key).t0 + T.knocked.get(key).dur) return false;
  const dur = part ? 1.7 : KNOCK[V.heavy] * (big ? 1.5 : 1), far = part ? 2.5 : V.heavy === 0 ? 3.4 : V.heavy === 1 ? 1.6 : 0.5;
  const item = { stream: st.index, id: e.id, t0: s.t, dur, side, far: big ? far * 1.8 : far, hop: part ? 0.03 : V.heavy === 0 ? 1.7 : V.heavy === 1 ? 0.5 : 0.12, spin: V.heavy === 0 ? (side > 0 ? 1 : -1) * (part ? 0.2 : 1) : 0, kind: e.kind };
  T.knocked.set(key, item);
  s.traffic.knocked.push(item);
  return true;
}

function dropOld(R) {
  const T = R.traffic, s = R.state, L = s.traffic.knocked;
  while (L.length && s.t >= L[0].t0 + L[0].dur) {
    const q = L.shift();
    T.knocked.delete(q.stream * 1e6 + q.id);
  }
}

export function collideTraffic(R) {
  const T = R.traffic, s = R.state;
  if (!T) return;
  dropOld(R);
  const t = s.t, TR = R.track, S = TR.samples;
  s.traffic.rain = rainAt(s.traffic, t);
  for (const k of s.karts) {
    if (k.finished || k.rescueT > 0 || k.shortcut >= 0) continue;
    const p = R.priv[k.i], f = p.f, i = k.trackI, hw = S.w[i] / 2;
    if (p.tfCd > 0) p.tfCd -= 1 / 60;
    if (k.hitT > 0) p.tfSafe = t + k.safeT + AFTER_SPIN_SAFE;
    // boxed in and going nowhere: nobody stays stuck for more than a few seconds, it squeezes through
    if (p.stillT > STUCK_THROUGH) p.tfSafe = Math.max(p.tfSafe || 0, t + 1);
    if (Math.abs(k.d) > hw + 2) continue;
    const air = k.y - TR.heightAt(f, k.d);
    const cands = T.cells[clamp(i >> 6, 0, T.cells.length - 1)];
    const fa = k.vx * S.tx[i] + k.vz * S.tz[i];
    forEachVehicle(T, f - 9, f + 9, t, (e) => {
      if (e.scale < 0.7 || e.knock) return;
      const V = VEHICLES[e.kind], ds = (e.f - f) * T.step, dd = e.d - k.d;
      // a plain scooter just ahead sees you coming and swerves: no crash, no lost speed, only an opinion
      if (V.heavy === 0 && !V.load && ds > -2.2 && Math.abs(dd) < PART_W && air < V.h * 0.72 && ds < V.len / 2 + KART_LEN + Math.max(0, fa - e.v) * PART_T) {
        if (knock(R, e, k, dd >= 0 ? 1 : -1, false, true) && (p.tfCd || 0) <= 0) { p.tfCd = 0.25; R.emit({ type: 'traffic', kart: k.i, veh: e.kind, kind: 'part', x: S.x[i] + S.nx[i] * e.d + S.tx[i] * ds, y: k.y + 0.6, z: S.z[i] + S.nz[i] * e.d + S.tz[i] * ds }); }
        return;
      }
      const big = k.bigT > 0 ? 1.45 : 1, ox = V.wid / 2 + KART_SIDE * big - Math.abs(dd), oz = V.len / 2 + KART_LEN * big - Math.abs(ds);
      if (ox <= 0 || oz <= 0 || air > V.h * 0.72) return;
      const side = dd >= 0 ? -1 : 1, x = S.x[i] + S.nx[i] * e.d + S.tx[i] * ds, z = S.z[i] + S.nz[i] * e.d + S.tz[i] * ds;
      const say = (kind) => { if ((p.tfCd || 0) <= 0) { p.tfCd = 0.25; R.emit({ type: 'traffic', kart: k.i, veh: e.kind, kind, x, y: k.y + 0.6, z }); } };
      // eggs and speck: everything goes flying, even the bus has to hop
      if (k.bigT > 0) { if (knock(R, e, k, -side, true)) { R.emit({ type: 'boom', x, y: k.y + 1, z, kind: 'clear' }); say('plow'); } return; }
      if (V.heavy === 0) {
        // a motorbike is never a crash: it wobbles off, the rider shakes a fist, a little speed goes
        if (knock(R, e, k, -side)) {
          k.vx *= 0.9; k.vz *= 0.9;
          say('scatter');
        }
        return;
      }
      if (k.safeT > 0 || t < (p.tfSafe || 0)) return;
      const relV = fa - e.v;
      const lateral = ox < oz * 0.7 || ox < 1.15;
      if (lateral) {
        // a scrape along its flank: it pushes you off, sparks and a horn, the race goes on
        k.x += S.nx[i] * -Math.sign(dd || 1) * Math.min(ox, 0.5); k.z += S.nz[i] * -Math.sign(dd || 1) * Math.min(ox, 0.5);
        const vn = k.vx * S.nx[i] + k.vz * S.nz[i];
        if (vn * dd > 0) { k.vx -= S.nx[i] * vn * 1.3; k.vz -= S.nz[i] * vn * 1.3; }
        k.vx *= 0.995; k.vz *= 0.995;
        say('scrape');
        return;
      }
      if (ds > 0) {
        // into the back of it
        k.x -= S.tx[i] * oz; k.z -= S.tz[i] * oz;
        const spunLately = t - (p.tfSpun ?? -99) < SPIN_GAP;
        if (relV > CUT_SPEED && (V.heavy === 1 || spunLately)) {
          // a light vehicle is shoved aside, sparks and a lot of opinions, and the kart goes on with a fifth less speed; the spin is for a truck or a bus
          if (knock(R, e, k, -side)) {
            const keep = V.heavy === 1 ? LIGHT_KEEP : SHORT_KEEP;
            k.vx *= keep; k.vz *= keep;
            k.vx += S.nx[i] * side * 2.5; k.vz += S.nz[i] * side * 2.5;
            say('scrape');
          }
        } else if (relV > CUT_SPEED) {
          const res = hitKart(R, k, -1, 'spin', 'traffic');
          if (res === 'hit') {
            p.tfSpun = t;
            const keep = Math.max(0, e.v), vx = S.tx[i] * keep, vz = S.tz[i] * keep, kick = (side || 1) * 5;
            k.vx = vx + S.nx[i] * kick; k.vz = vz + S.nz[i] * kick;
            say('crash');
          } else if (res === 'blocked') {
            knock(R, e, k, -side);
            say('scrape');
          }
        } else if (relV > 0) {
          // a nudge in a queue
          k.vx -= S.tx[i] * relV; k.vz -= S.tz[i] * relV;
          say('nudge');
        }
      } else if (ds < 0 && fa < e.v) {
        // it caught you up: it bumps you along, and it has views on the matter
        k.vx += S.tx[i] * (e.v - fa); k.vz += S.tz[i] * (e.v - fa);
        k.x += S.tx[i] * oz * 0.5; k.z += S.tz[i] * oz * 0.5;
        say('nudge');
      }
    }, cands);
    // the train at the crossing is a real tumble, and the bell has been ringing for seconds
    for (const c of T.crossings) {
      const away = Math.abs(f - c.f) * T.step;
      if (away < 130 && k.human) {
        // the bell, for whoever is near enough to hear it
        const ph = crossingState(c, t).phase;
        if (ph !== 'quiet' && (p.bellT = (p.bellT || 0) - 1 / 60) <= 0) { p.bellT = ph === 'warn' ? 0.6 : 2.6; R.emit({ type: 'crossing', kart: k.i, phase: ph }); }
      }
      if (away > c.half) continue;
      if (crossingState(c, t).phase === 'pass') hitKart(R, k, -1, 'tumble', 'train');
    }
    // a horn near you, from someone with an opinion
    if (k.human && (p.honkT = (p.honkT || 0) - 1 / 60) <= 0) {
      p.honkT = HONK_GAP;
      let best = null, bestD = 1e9;
      forEachVehicle(T, f - 8, f + 20, t, (e) => {
        const ds = (e.f - f) * T.step, dd = e.d - k.d, q = Math.abs(ds) + Math.abs(dd) * 1.5;
        if (q < bestD && slotHash(e.id + Math.floor(t * 2.2), e.stream.index + 0.5) < 0.55) { bestD = q; best = { kind: e.kind, f: e.f, d: e.d, id: e.id, ahead: ds > 7 }; }
      }, cands);
      if (best) {
        const j = clamp(Math.round(best.f), 0, T.n - 1);
        R.emit({ type: 'honk', kart: k.i, veh: best.kind, horn: VEHICLES[best.kind].honk, x: S.x[j] + S.nx[j] * best.d, y: S.y[j] + 1, z: S.z[j] + S.nz[j] * best.d, seed: best.id, word: best.ahead });
      }
    }
  }
}

// What a leader's rocket does on its way: traffic dives aside.
export function sweepTraffic(R, f, reach = 14) {
  const T = R.traffic;
  if (!T) return;
  forEachVehicle(T, f - reach / T.step, f + reach / T.step, R.state.t, (e) => { if (!e.knock && e.scale > 0.5) knock(R, e, null, e.d >= 0 ? 1 : -1); });
}

// ---------- the bots ----------
// The whole width of the road ahead as a row of cells, each costed by what will be there when the kart gets there. Asking where a
// vehicle will be is a function call, so a bot sees the bajaj's swerve as well as you do from the camera. Light things cost little:
// a good driver goes through a motorbike rather than into a bus.
const WIN = { c: new Float32Array(64), half: new Float32Array(64), when: new Float32Array(64), cost: new Float32Array(64) };
export function trafficAvoid(R, k, p, B, i, lane) {
  const T = R.traffic;
  if ((B.tfTimer = (B.tfTimer || 0) - 1) > 0) return B.tfShift || 0;
  B.tfTimer = 3;
  const t = R.state.t, TR = R.track, S = TR.samples, hw = S.w[i] / 2, f = p.f, vk = Math.max(k.speed, 8);
  const see = Math.min(B.cfg.see, 74), cells = T.cells[clamp(i >> 6, 0, T.cells.length - 1)];
  let m = 0;
  forEachVehicle(T, f + 0.5, f + see / T.step, t, (e) => {
    if (e.knock || e.scale < 0.6 || m >= 64) return;
    const V = VEHICLES[e.kind];
    // a scooter gets out of your way by itself, a loaded one is worth a look only when close
    if (V.heavy === 0 && !V.load) return;
    const ds = (e.f - f) * T.step - V.len / 2 - KART_LEN, rel = Math.max(3.5, vk - e.v);
    const when = Math.max(0, ds) / rel;
    if (when > (V.heavy === 0 ? 1.1 : 2.5)) return;
    const st = e.stream, future = slotD(st, e.id, t + when);
    WIN.c[m] = future; WIN.half[m] = V.wid / 2 + KART_SIDE + 0.35; WIN.when[m] = when;
    WIN.cost[m] = (V.heavy === 0 ? 8 : V.heavy === 1 ? 60 : 90) * (2.6 - when);
    m++;
  }, cells);
  if (!m) { B.tfShift = 0; B.tfBrake = 0; return 0; }
  const room = hw - 1.25;
  let best = k.d, bestC = 1e12, here = 0;
  const costAt = (c) => {
    let a = 0;
    for (let q = 0; q < m; q++) if (Math.abs(c - WIN.c[q]) < WIN.half[q]) {
      // a gap too far to reach by then does not count as free
      a += WIN.cost[q];
    }
    return a;
  };
  here = costAt(k.d);
  for (let c = -room; c <= room + 1e-3; c += 0.7) {
    const reach = Math.abs(c - k.d);
    let a = costAt(c) + reach * 0.55 + Math.abs(c - lane) * 0.14;
    // a target past where the wheel can get to in time also has to be clear on the way
    if (reach > 1) a += costAt((c + k.d) / 2) * 0.5;
    if (a < bestC) { bestC = a; best = c; }
  }
  const stuck = here > 55 && costAt(best) > 40;
  // a bot in the thick of it pushes on at a walk: braking to a stop behind a stopped bus would only leave it there
  B.tfBrake = stuck && k.speed > 9 ? 1 : 0;
  B.tfShift = best - lane;
  return B.tfShift;
}
