// One kart's physics: arcade and generous. Yaw is + to the left and steer + to the right, so steer lowers yaw.
// Velocity is split into forward and lateral each step: grip eats the lateral part and hands most of it back to the
// forward part, which is what lets a kart slide through a corner without feeling like it hit glue.

import {
  G, GRIP, DRIFT_GRIP, STEER_RATE, STEER_SCRUB, DRIFT_SCRUB, HOP_V, DRIFT_MIN_V, DRIFT_RANGE, DRIFT_OPEN, DRIFT_TIERS, BOOST, HIT,
  RECOVER_T, RECOVER_MUL, RESCUE_T, RESCUE_SAFE, WALL, SURFACE, OFFROAD_FACTOR, KART_R, BIG_SCALE, TIPSY_WOBBLE, STINK_WOBBLE, QUAKE_WOBBLE,
  POLENTA, DURIAN, RENDANG, FLOOR_Y, LOST_D, kartPhysics, clamp, wrapAngle, easeInOut, yawRateAt,
} from './tuning.js';
import { itemInfo } from '../data/items.js';
import { stepWeatherKart, weatherGrip, weatherSpeed } from './weather.js';
import { sacredPoints } from './disasters.js';

const TIPSY_T = itemInfo('grappa').tipsyT;

const LAST_KM = 1000;
const WALL_EVENT_MIN = 2.5, WALL_EVENT_GAP = 0.3, BUMP_GAP = 0.35, SNAP_DROP = 0.45;
const wallCache = new WeakMap();

// Lateral limits per sample: where the invisible soft barrier stands on each side of the road. A walk out from the
// edge stops where the ground gets steep or another stretch of road starts to come close.
export function wallsFor(track, terrain) {
  let w = wallCache.get(track);
  if (w && w.terrain === terrain) return w;
  const { n, samples: S, curvature: K } = track;
  const L = new Float32Array(n), Rt = new Float32Array(n), nearSc = new Uint8Array(n), sacred = track.def?.sacred?.length ? sacredPoints(track) : [];
  for (const sc of track.shortcuts) {
    const a = Math.round((sc.from - 0.012) * n), len = Math.round(((sc.to - sc.from + 1) % 1 + 0.024) * n);
    for (let o = 0; o <= len; o++) nearSc[((a + o) % n + n) % n] = 1;
  }
  for (let i = 0; i < n; i++) {
    const hw = S.w[i] / 2;
    if (S.struct[i]) { L[i] = Rt[i] = hw - WALL.deckIn; continue; }
    let kk = 0;
    for (let o = -5; o <= 5; o++) kk += K[(i + o + n) % n] / 11;
    for (const side of [1, -1]) {
      // def.wall.max: a track whose shoulder ends sooner (a retaining wall along the road), default the one of all tracks
      const wMax = track.def?.wall?.max ?? WALL.max;
      let lim = hw + wMax, prev = terrain.heightAt(S.x[i] + S.nx[i] * side * hw, S.z[i] + S.nz[i] * side * hw), peak = 0;
      for (let e = 1; e <= wMax; e++) {
        const t = hw + e, x = S.x[i] + S.nx[i] * side * t, z = S.z[i] + S.nz[i] * side * t, g = terrain.heightAt(x, z);
        if (e > WALL.min && Math.abs(g - prev) > WALL.slope) { lim = t - 1; break; }
        // the shoulder ends at a church or a temple: nobody drives through one
        if (sacred.some((q) => Math.hypot(x - q.x, z - q.z) < q.r)) { lim = Math.max(hw + 1, t - 1); break; }
        prev = g;
        if (!nearSc[i]) {
          const rd = terrain.roadDistAt(x, z);
          if (rd > peak) peak = rd;
          else if (rd < peak - 1.5) { lim = t - 1.5; break; }
        }
      }
      // the inside of a tight bend: no driving round the hairpin's pivot
      if (kk * side > 0) lim = Math.min(lim, Math.max(hw + 1, 0.8 / Math.abs(kk)));
      if (side > 0) L[i] = lim; else Rt[i] = lim;
    }
  }
  const taper = WALL.taper * track.step;
  for (const A of [L, Rt]) for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < n; i++) { const b = A[(i - 1 + n) % n] + taper; if (b < A[i]) A[i] = b; }
    for (let i = n - 1; i >= 0; i--) { const b = A[(i + 1) % n] + taper; if (b < A[i]) A[i] = b; }
  }
  w = { terrain, left: L, right: Rt };
  wallCache.set(track, w);
  return w;
}

const inSpan = (u, a, b) => { const len = ((b - a) % 1 + 1) % 1; return ((u - a) % 1 + 1) % 1 <= len; };

export function createKart(i, pl, g, track) {
  return {
    ...(pl.team ? { team: pl.team } : null), // a side exists only in a team championship: every other race keeps the state it always had
    i, slot: pl.slot ?? -1, kart: pl.kart, human: !!pl.human, name: pl.name ?? null,
    x: g.x, y: g.y, z: g.z, yaw: g.yaw, pitch: 0, roll: 0, vx: 0, vy: 0, vz: 0, speed: 0, grounded: true, airT: 0,
    steer: 0, throttle: 0,
    trackI: g.i, u: g.i / track.n, lap: 0, progress: g.i / track.n - 1, d: g.d,
    place: i + 1, finished: false, finishT: 0, lastLapT: 0, bestLapT: 0, wrongWay: false,
    surface: track.surfaceAt(g.i), offroad: false, shortcut: -1,
    drift: 0, driftT: 0, driftTier: 0,
    boostT: 0, boostKind: null, boostTier: 0,
    item: null, itemCharges: 0, rouletteT: 0,
    orbit: 0,
    bigT: 0, tipsyT: 0, stinkT: 0, sootT: 0, rendangT: 0, hitT: 0, hitKind: null,
    safeT: 0,
    rescueT: 0,
  };
}

export function createPriv(k, track) {
  return {
    ph: kartPhysics(k.kart), capMul: 1, rubber: 0, cruise: 1,
    f: k.u * track.n, cont: k.u * track.n - track.n, bestLaps: -1, lapStart: 0,
    i: k.trackI, lastGoodF: k.u * track.n,
    scHint: track.shortcuts.map(() => -1),
    prevItem: false, prevDrift: false, hopArmed: false,
    tipsyDelay: 0, stickyT: 0, recoverT: 0, boostMul: 1, iceT: 0, hitYaw: 0, hitDur: 0,
    fireT: 0, wallCd: 0, wrongT: 0, nearCd: 0, pendingItem: null, overtakeCd: 0, pullMul: 1, slowT: 0,
    resc: null, moved: 0, stillT: 0, bot: null,
  };
}

export function giveBoost(R, k, kind, boostKey = kind) {
  const b = BOOST[boostKey], p = R.priv[k.i];
  // a boost that outlasts the one running replaces it, and a short one never inherits a stronger one's multiplier
  const outlasts = k.boostT <= 0 || b.t > k.boostT;
  if (outlasts || b.mul >= p.boostMul) k.boostKind = kind;
  p.boostMul = outlasts ? b.mul : Math.max(b.mul, p.boostMul);
  k.boostTier = outlasts ? b.tier : Math.max(b.tier, k.boostTier);
  k.boostT = Math.max(k.boostT, b.t);
  // a kick right away, so the press answers at once and not after the speed has crept up
  const f = Math.sin(k.yaw), c = Math.cos(k.yaw);
  k.vx += f * b.kick; k.vz += c * b.kick;
  R.emit({ type: 'boost', kart: k.i, kind, tier: b.tier });
}

export function endDrift(R, k, award) {
  if (!k.drift) return;
  const tier = k.driftTier;
  k.drift = 0; k.driftT = 0; k.driftTier = 0;
  R.emit({ type: 'driftEnd', kart: k.i, tier });
  if (award && tier > 0) giveBoost(R, k, 'drift', `drift${tier}`);
}

// Is (x, z) past the barrier? Returns how far, and the way back, or null.
export function wallPush(R, x, z, f) {
  const T = R.track, S = T.samples, loc = T.nearest(x, z, f), i = loc.i, W = R.walls;
  const lim = loc.d >= 0 ? W.left[i] : W.right[i], pen = Math.abs(loc.d) - lim;
  if (pen <= 0) return null;
  for (const sc of T.shortcuts) {
    if (!inSpan(loc.u, sc.from - 0.015, sc.to + 0.015)) continue;
    const q = sc.nearest(x, z);
    if (Math.abs(q.d) <= sc.samples.w[q.i] / 2 + 2) return null;
  }
  const s = loc.d >= 0 ? -1 : 1;
  return { pen, nx: S.nx[i] * s, nz: S.nz[i] * s, tx: S.tx[i], tz: S.tz[i], f: loc.f };
}

export function startRescue(R, k, p) {
  const T = R.track, f = p.lastGoodF, i = Math.round(f) % T.n, d = T.racingLine.d[i];
  const P = T.samples, x = P.x[i] + P.nx[i] * d, z = P.z[i] + P.nz[i] * d;
  p.resc = { x0: k.x, y0: k.y, z0: k.z, x, z, y: T.heightAt(f, d), f, yaw: Math.atan2(P.tx[i], P.tz[i]), yaw0: k.yaw };
  k.rescueT = RESCUE_T;
  endDrift(R, k, false);
  k.boostT = 0; k.boostKind = null; k.hitT = 0; k.hitKind = null; k.vx = k.vy = k.vz = 0; k.speed = 0;
  R.emit({ type: 'rescue', kart: k.i });
}

function stepRescue(R, k, p, dt) {
  k.rescueT -= dt;
  const r = p.resc, a = easeInOut(clamp(1 - k.rescueT / RESCUE_T, 0, 1));
  k.x = r.x0 + (r.x - r.x0) * a; k.z = r.z0 + (r.z - r.z0) * a;
  k.y = r.y0 + (r.y - r.y0) * a + Math.sin(a * Math.PI) * 9;
  k.yaw = r.yaw0 + wrapAngle(r.yaw - r.yaw0) * a;
  k.grounded = false; k.pitch = 0; k.roll = 0;
  if (k.rescueT > 0) return;
  k.rescueT = 0; k.x = r.x; k.y = r.y; k.z = r.z; k.yaw = r.yaw; k.grounded = true;
  k.safeT = RESCUE_SAFE; p.recoverT = RECOVER_T; k.airT = 0; p.resc = null; p.stillT = 0;
  setProgress(R, k, p, r.f);
}

function setProgress(R, k, p, f) {
  const n = R.track.n;
  let df = f - p.f;
  if (df > n / 2) df -= n; else if (df < -n / 2) df += n;
  p.cont += df; p.f = f;
  const prog = p.cont / n, done = Math.floor(prog);
  k.progress = prog; k.u = f / n; k.trackI = Math.round(f) % n;
  if (done > p.bestLaps) crossLine(R, k, p, done);
  // a long track raced in one lap has no last lap to announce: its last kilometre stands in for it, in the HUD, the music and on the phone
  if (R.track.long && R.state.laps === 1 && !p.lastKm && !k.finished && prog > 1 - LAST_KM / R.track.length && prog < 1) { p.lastKm = true; R.emit({ type: 'lastLap', kart: k.i }); }
}

function crossLine(R, k, p, done) {
  const s = R.state;
  p.bestLaps = done;
  if (done < 1 || k.finished) return;
  const now = s.t, lapT = now - p.lapStart;
  k.lastLapT = lapT;
  if (!k.bestLapT || lapT < k.bestLapT) k.bestLapT = lapT;
  p.lapStart = now;
  k.lap = Math.min(done, s.laps);
  if (done >= s.laps) { R.finishKart(k); return; }
  R.emit({ type: 'lap', kart: k.i, lap: done });
  if (done === s.laps - 1) R.emit({ type: 'lastLap', kart: k.i });
}

// Where the kart is: main road, a shortcut or the shoulder. Fills p.* and returns the ground height.
function locate(R, k, p) {
  const T = R.track, S = T.samples, loc = T.nearest(k.x, k.z, p.f), i = loc.i, hw = S.w[i] / 2;
  p.i = i; k.d = loc.d;
  let f = loc.f, onMain = Math.abs(loc.d) <= hw, sc = null, q = null;
  if (!onMain) {
    for (const c of T.shortcuts) {
      if (!inSpan(loc.u, c.from - 0.015, c.to + 0.015)) continue;
      const qq = c.nearest(k.x, k.z, p.scHint[c.index]);
      p.scHint[c.index] = qq.i;
      if (Math.abs(qq.d) <= c.samples.w[qq.i] / 2) { sc = c; q = qq; break; }
    }
  }
  k.shortcut = sc ? sc.index : -1;
  let ground, surface;
  if (onMain) {
    ground = T.heightAt(loc.f, loc.d); surface = T.surfaceAt(i);
    p.lastGoodF = loc.f;
  } else if (sc) {
    ground = sc.heightAt(q.f, q.d); surface = sc.surface;
    f = ((sc.from + (((sc.to - sc.from) % 1 + 1) % 1) * q.u) % 1) * T.n;
    p.lastGoodF = f;
  } else {
    ground = R.terrain.heightAt(k.x, k.z);
    const road = T.surfaceAt(i);
    surface = T.def.ground?.surface ?? (road === 'sand' || road === 'snow' || road === 'ice' ? road : 'grass');
  }
  k.offroad = !onMain && !sc;
  k.surface = p.iceT > 0 ? 'ice' : surface;
  p.locF = f;
  p.ground = ground;
  return ground;
}

function surfaceSpeed(k, ph) {
  const s = SURFACE[k.surface] || SURFACE.asphalt;
  let m = 1 - (1 - s.speed) * ph.rough;
  if (k.offroad && k.surface !== 'grass') m *= OFFROAD_FACTOR;
  return m;
}

function stepHit(R, k, p, dt) {
  const def = HIT[k.hitKind], a = easeInOut(clamp(1 - k.hitT / p.hitDur, 0, 1));
  if (k.hitKind === 'spin') k.yaw = p.hitYaw + a * def.turns * Math.PI * 2;
  else k.pitch = a * def.flips * Math.PI * 2;
  const decay = Math.exp(-1.9 * dt);
  k.vx *= decay; k.vz *= decay;
  if (k.hitT <= dt) {
    k.hitT = 0; k.hitKind = null; k.yaw = p.hitYaw; k.pitch = 0; p.recoverT = RECOVER_T;
    // facing the road again, whatever the hit did to it: back in the race at once
    const S = R.track.samples, i = p.i, ry = Math.atan2(S.tx[i], S.tz[i]);
    if (Math.abs(wrapAngle(ry - k.yaw)) > 0.5) k.yaw = ry + clamp(wrapAngle(k.yaw - ry), -0.5, 0.5);
  }
}

function applyWall(R, k, p, dt) {
  const w = wallPush(R, k.x, k.z, p.f);
  if (!w) return;
  k.x += w.nx * w.pen; k.z += w.nz * w.pen;
  const into = -(k.vx * w.nx + k.vz * w.nz), before = Math.hypot(k.vx, k.vz);
  if (into <= 0) return;
  k.vx += w.nx * into * (1 + WALL.restitution); k.vz += w.nz * into * (1 + WALL.restitution);
  // Along the barrier, the way the kart was going, with most of its speed: a nudge and never a stop.
  const fx = Math.sin(k.yaw), fz = Math.cos(k.yaw);
  let tx = -w.nz, tz = w.nx;
  const roadDot = tx * w.tx + tz * w.tz, headDot = tx * fx + tz * fz;
  if ((Math.abs(headDot) > 0.25 ? headDot : roadDot) < 0) { tx = -tx; tz = -tz; }
  const along = k.vx * tx + k.vz * tz, keep = before * (0.72 - 0.3 * Math.min(1, into / Math.max(1, before)));
  if (along < keep) { k.vx += tx * (keep - along); k.vz += tz * (keep - along); }
  if (fx * w.nx + fz * w.nz < 0.05 && k.hitT <= 0) {
    k.yaw += wrapAngle(Math.atan2(tx, tz) - k.yaw) * Math.min(1, 10 * dt);
  }
  if (into > WALL_EVENT_MIN && p.wallCd <= 0) {
    R.emit({ type: 'wall', kart: k.i, force: into }); p.wallCd = WALL_EVENT_GAP;
  }
}

export function stepKart(R, k, inp, dt) {
  const p = R.priv[k.i], ph = p.ph, s = R.state;
  if (k.rescueT > 0) { stepRescue(R, k, p, dt); return; }

  // timers
  const lose = (key) => { if (k[key] > 0) k[key] = Math.max(0, k[key] - dt); };
  lose('bigT'); lose('tipsyT'); lose('stinkT'); lose('sootT'); lose('safeT');
  p.stickyT = Math.max(0, p.stickyT - dt); p.recoverT = Math.max(0, p.recoverT - dt);
  p.slowT = Math.max(0, p.slowT - dt);
  p.iceT = Math.max(0, p.iceT - dt); p.wallCd -= dt; p.nearCd -= dt; p.overtakeCd -= dt;
  if (k.boostT > 0 && (k.boostT -= dt) <= 0) { k.boostT = 0; k.boostKind = null; p.boostMul = 1; }
  if (p.tipsyDelay > 0 && (p.tipsyDelay -= dt) <= 0) { p.tipsyDelay = 0; k.tipsyT = TIPSY_T; }

  const racing = s.phase === 'race', hit = k.hitT > 0;
  let steer = 0, thr = 0, coast = !inp;
  if (inp && racing && !hit) { steer = clamp(inp.steer ?? 0, -1, 1); thr = clamp(inp.throttle ?? 0, -1, 1); }
  if (k.tipsyT > 0) steer = steer * 0.8 + Math.sin(s.t * 6.3 + k.i * 1.7) * TIPSY_WOBBLE * Math.min(1, k.tipsyT * 2);
  if (k.stinkT > 0) steer = steer * 0.85 + Math.sin(s.t * 8.7 + k.i * 2.9) * STINK_WOBBLE * Math.min(1, k.stinkT * 2);
  if (s.quake > 0.02 && k.grounded) steer = steer * 0.94 + Math.sin(s.t * 9.1 + k.i * 2.3) * QUAKE_WOBBLE * s.quake;
  k.steer += clamp(clamp(steer, -1, 1) - k.steer, -STEER_RATE * dt, STEER_RATE * dt);
  k.throttle = !racing || hit || coast ? 0 : thr < 0 ? thr : 1;

  const fx0 = Math.sin(k.yaw), fz0 = Math.cos(k.yaw);
  const vF0 = k.vx * fx0 + k.vz * fz0, v0 = Math.hypot(k.vx, k.vz);

  // drift: hop on the press, slide when it lands with the stick over, turbo on the release
  const btn = !!(inp && inp.drift) && racing && !hit;
  if (btn && !p.prevDrift && k.grounded && v0 > 4) {
    k.vy = HOP_V; k.y += 0.02; k.grounded = false; k.airT = 0; p.hopArmed = true;
  }
  p.prevDrift = btn;
  if (!btn) { p.hopArmed = false; if (k.drift) endDrift(R, k, true); }
  if (btn && p.hopArmed && k.grounded && !k.drift && Math.abs(k.steer) > 0.25 && v0 > DRIFT_MIN_V) {
    k.drift = k.steer > 0 ? 1 : -1; k.driftT = 0; k.driftTier = 0;
    R.emit({ type: 'driftStart', kart: k.i, dir: k.drift });
  }
  if (R.weather) stepWeatherKart(R, k, p, dt);
  if (k.drift && (v0 < DRIFT_MIN_V * 0.6 || hit)) endDrift(R, k, false);
  if (k.drift && k.grounded) {
    k.driftT += dt;
    const tier = k.driftT >= DRIFT_TIERS[2] ? 3 : k.driftT >= DRIFT_TIERS[1] ? 2 : k.driftT >= DRIFT_TIERS[0] ? 1 : 0;
    if (tier !== k.driftTier) { k.driftTier = tier; R.emit({ type: 'driftTier', kart: k.i, tier }); }
  }

  if (hit) {
    stepHit(R, k, p, dt);
    k.hitT = Math.max(0, k.hitT - dt);
  } else {
    // steering
    const sgn = vF0 < -0.5 ? -1 : 1;
    let rate;
    if (k.drift) { const s = k.steer * k.drift; rate = -k.drift * ph.drift * (1 + s * (s > 0 ? DRIFT_RANGE : DRIFT_OPEN)); }
    else rate = -k.steer * yawRateAt(ph, v0) * sgn;
    k.yaw = wrapAngle(k.yaw + rate * (k.grounded ? 1 : 0.5) * dt);
  }

  const fx = Math.sin(k.yaw), fz = Math.cos(k.yaw), lx = fz, lz = -fx;
  let vF = k.vx * fx + k.vz * fz, vL = k.vx * lx + k.vz * lz;

  if (k.grounded && !hit) {
    // grip takes the slide away and gives most of it back as forward speed
    const surf = SURFACE[k.surface] || SURFACE.asphalt;
    let grip = (k.drift ? DRIFT_GRIP : GRIP) * (k.drift ? Math.max(0.45, surf.grip) : surf.grip);
    if (R.state.traffic?.rain) grip *= 1 - 0.14 * R.state.traffic.rain; // the rain on a city's road
    if (R.weather) { grip *= weatherGrip(R.weather, k); if (p.wxT > 0) grip *= R.weather.cfg.patch.grip; }
    if (p.stickyT > 0) grip *= POLENTA.grip;
    const after = vL * Math.exp(-grip * dt);
    if (vF > 0.5) vF = Math.sqrt(vF * vF + (vL * vL - after * after) * 0.86);
    vL = after;

    // automatic throttle; the stick only ever lowers it
    let top = ph.top * p.capMul * (1 + p.rubber) * p.cruise;
    // the pan does not care what it drives on
    let m = k.bigT > 0 ? 1 : surfaceSpeed(k, ph);
    if (R.weather && k.bigT <= 0) { m *= weatherSpeed(R.weather, k); if (p.wxT > 0) m *= R.weather.cfg.patch.speed; }
    if (k.boostT > 0) { m = Math.max(m, 0.94) * p.boostMul; }
    if (k.rendangT > 0) m *= p.pullMul;
    if (p.slowT > 0) m *= RENDANG.slow;
    if (k.stinkT > 0) m *= DURIAN.mul;
    if (p.stickyT > 0) m *= POLENTA.mul;
    m *= k.drift ? 1 - DRIFT_SCRUB : 1 - STEER_SCRUB * Math.abs(k.steer) * Math.min(1, (v0 / top) ** 2);
    m *= clamp(1 - p.slope * 0.55, 0.9, 1.1);
    let target = top * m;
    let accel = ph.accel * (p.recoverT > 0 ? RECOVER_MUL : 1);
    if (k.boostT > 0 || k.rendangT > 0) accel = Math.max(accel, 26);

    if (coast || !racing) target = 0;
    if (thr < 0 && thr > -0.35) target *= 1 + thr;
    if (thr <= -0.35) {
      if (vF > 1) { vF = Math.max(0, vF - 34 * -thr * dt); target = -1; }
      else target = -11 * -thr;
    }
    if (target >= 0 && vF < target) {
      const r = vF / Math.max(1, target), a = accel * (1 - (r > 0 ? r * r * r : 0)) + (r < 1 ? 1 : 0);
      vF = Math.min(target, vF + a * dt);
    } else if (target > 0 || coast || !racing) {
      const rate = coast || !racing ? 1.5 : p.stickyT > 0 ? 4.5 : k.boostT > 0 ? 3.2 : k.offroad ? 2.6 : 1.3;
      vF += (target - vF) * (1 - Math.exp(-rate * dt));
    } else if (target < 0) {
      if (vF > target) vF = Math.max(target, vF - 16 * dt);
    }
    k.vx = fx * vF + lx * vL; k.vz = fz * vF + lz * vL;
  }

  // move
  k.x += k.vx * dt; k.z += k.vz * dt;
  locateWalls(R, k, p, dt);
  stepVertical(R, k, p, dt);

  if (k.hitT <= 0 && !k.rescueT) stepAttitude(R, k, p, dt);
  if (k.rescueT > 0) return;

  // signed forward speed; spinning, the nose says nothing, so it is the plain speed
  k.speed = hit ? Math.hypot(k.vx, k.vz) : Math.sin(k.yaw) * k.vx + Math.cos(k.yaw) * k.vz;

  crossMarks(R, k, p);
  setProgress(R, k, p, p.locF);

  // Off the world or in the water: a friendly animal fetches the kart.
  const W = R.terrain.water;
  const LK = R.terrain.lake;
  const inWater = (W !== null && W !== undefined && k.offroad && p.ground < W && k.y <= W + 0.2 && k.grounded)
    || (!!LK && k.offroad && k.grounded && p.ground < LK.level - 0.3 && ((k.x - LK.x) / LK.rx) ** 2 + ((k.z - LK.z) / LK.rz) ** 2 < 1.3);
  // a shortcut may run far from the main road: on one, k.d says nothing about being lost
  if (inWater || k.y < FLOOR_Y || (k.shortcut < 0 && Math.abs(k.d) > LOST_D)) startRescue(R, k, p);

  // wrong way
  const S = R.track.samples, i = p.i, along = Math.sin(k.yaw) * S.tx[i] + Math.cos(k.yaw) * S.tz[i];
  if (k.shortcut < 0 && along < -0.25 && racing && !hit) p.wrongT += dt; else p.wrongT = Math.max(0, p.wrongT - dt * 3);
  k.wrongWay = p.wrongT > 1;

  // how long has it been going nowhere? Bots read this; the tests measure it.
  // A kart with no input is not stuck, it is waiting: a bot taking over a gone phone's kart goes forward at once.
  if (racing && !coast && !k.finished && !hit && Math.hypot(k.vx, k.vz) < 1.5) p.stillT += dt; else p.stillT = 0;
}

function locateWalls(R, k, p, dt) {
  locate(R, k, p);
  if (R.walls) applyWall(R, k, p, dt);
  locate(R, k, p);
}

function stepVertical(R, k, p, dt) {
  const gy = p.ground;
  if (k.grounded) {
    if (gy < k.y - SNAP_DROP) {
      k.grounded = false; k.airT = 0;
    } else {
      k.vy = clamp((gy - k.y) / dt, -30, 30);
      k.y = gy;
    }
  }
  if (!k.grounded) {
    k.vy -= G * dt; k.y += k.vy * dt; k.airT += dt;
    if (k.y <= gy) {
      const force = -k.vy;
      k.y = gy; k.grounded = true;
      if (k.airT > 0.4 || force > 6) R.emit({ type: 'land', kart: k.i, force });
      k.airT = 0; k.vy = 0;
    }
  }
}

function stepAttitude(R, k, p, dt) {
  const T = R.track, S = T.samples, i = p.i, fx = Math.sin(k.yaw), fz = Math.cos(k.yaw), lx = fz, lz = -fx;
  let pitchT, rollT, slopeF = 0;
  if (!k.grounded) {
    pitchT = Math.atan2(k.vy, Math.max(10, Math.abs(k.speed))) * 0.7; rollT = 0;
  } else if (k.offroad) {
    const N = R.terrain.normalAt(k.x, k.z, p.nrm || (p.nrm = {})), ny = Math.max(0.3, N.y);
    slopeF = -(N.x * fx + N.z * fz) / ny;
    pitchT = Math.atan(slopeF); rollT = Math.atan((N.x * lx + N.z * lz) / ny);
  } else {
    const a = (i - 2 + T.n) % T.n, b = (i + 2) % T.n, along = fx * S.tx[i] + fz * S.tz[i];
    const side = lx * S.nx[i] + lz * S.nz[i];
    slopeF = (S.y[b] - S.y[a]) / (4 * T.step) * along;
    pitchT = Math.atan(slopeF);
    rollT = S.bank[i] * Math.PI / 180 * side;
  }
  p.slope = slopeF;
  if (k.grounded) rollT += -k.steer * 0.07 - k.drift * 0.16;
  const a = Math.min(1, 12 * dt);
  k.pitch += wrapAngle(pitchT - k.pitch) * a; k.roll += (rollT - k.roll) * a;
}

// Jumps and pads sit at a sample on the main road: the kart fires them on crossing it.
function crossMarks(R, k, p) {
  const T = R.track, n = T.n, f0 = p.f, f1 = p.locF;
  let df = f1 - f0;
  if (df > n / 2) df -= n; else if (df < -n / 2) df += n;
  if (df <= 0 || k.shortcut >= 0) return;
  const crossed = (i) => { const o = ((i - f0) % n + n) % n; return o <= df; };
  for (const j of T.jumps) {
    if (k.grounded && !k.offroad && k.speed > 8 && crossed(j.i)) {
      k.vy = j.strength * (5 + 0.13 * Math.max(0, k.speed));
      k.grounded = false; k.airT = 0;
      R.emit({ type: 'jump', kart: k.i });
    }
  }
  for (const b of T.pads) {
    if (crossed(b.i) && Math.abs(k.d - b.d) < 3.6) giveBoost(R, k, 'pad');
  }
}

// Kart against kart: momentum by weight, soft overlap. The pan barrels through and sends others flying.
export function collideKarts(R) {
  const K = R.state.karts, n = K.length;
  for (let a = 0; a < n; a++) {
    const A = K[a];
    if (A.finished || A.rescueT > 0) continue;
    for (let b = a + 1; b < n; b++) {
      const B = K[b];
      if (B.finished || B.rescueT > 0) continue;
      const ra = KART_R * (A.bigT > 0 ? BIG_SCALE : 1), rb = KART_R * (B.bigT > 0 ? BIG_SCALE : 1), rr = ra + rb;
      const dx = B.x - A.x, dz = B.z - A.z;
      if (dx > rr || dx < -rr || dz > rr || dz < -rr) continue;
      if (Math.abs(A.y - B.y) > 2.6) continue;
      const e = dx * dx + dz * dz;
      if (e >= rr * rr) continue;
      const dist = Math.sqrt(e) || 0.01, nx = dx / dist, nz = dz / dist, pa = R.priv[a], pb = R.priv[b];
      const ma = A.bigT > 0 ? 6 : pa.ph.mass, mb = B.bigT > 0 ? 6 : pb.ph.mass, im = 1 / ma + 1 / mb, pen = rr - dist;
      A.x -= nx * pen * (1 / ma) / im; A.z -= nz * pen * (1 / ma) / im;
      B.x += nx * pen * (1 / mb) / im; B.z += nz * pen * (1 / mb) / im;
      const rel = (B.vx - A.vx) * nx + (B.vz - A.vz) * nz;
      if (rel >= 0) continue;
      const j = -(1 + 0.45) * rel / im;
      A.vx -= nx * j / ma; A.vz -= nz * j / ma; B.vx += nx * j / mb; B.vz += nz * j / mb;
      const key = a * n + b, t = R.state.t;
      if ((R.bumpAt[key] ?? -9) + BUMP_GAP < t && -rel > 1.5) {
        R.bumpAt[key] = t;
        R.emit({ type: 'bump', a, b, force: -rel });
      }
      if (A.bigT > 0 && B.bigT <= 0) R.hitKart(B, a, 'spin', 'uova');
      if (B.bigT > 0 && A.bigT <= 0) R.hitKart(A, b, 'spin', 'uova');
    }
  }
}

