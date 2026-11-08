// A bot writes the same input a phone would and goes through the same physics, so it can never cheat on handling.
// Pure pursuit on the racing line gives the desired turn, a PID on lateral error trims it, and a slip controller maps it
// to the stick, because a drifting kart's velocity lags its nose.

import { DIFFICULTY, PACK, BOT_BRAKE, DRIFT_GRIP, GRIP, DRIFT_MIN_V, DRIFT_RANGE, DRIFT_OPEN, SOLID, SURFACE, clamp, wrapAngle, yawRateAt, mates } from './tuning.js';
import { createRng, mixSeed } from './rng.js';
import { disasterGap } from './disasters.js';
import { trafficAvoid } from './traffic.js';
import { patchesAhead } from './weather.js';
import { solidPush } from './solids.js';

const CORNER_R = 62;         // m: tighter than this is a corner worth drifting
const SCAN_STEP = 6;         // m between curvature samples ahead
const AVOID_M = 55;          // m ahead a bot starts moving over for something on the road
const CORNER_SEARCH = 70;    // m ahead to look for the next corner
const CORNER_MAX = 240;
const CRATE_SEE = 40;        // m ahead a bot with an empty slot starts moving over for a crate

// The next real corner on the line: which way (+1 left), how far off, how long.
function readCorner(T, i, off) {
  const out = { dir: 0, at: 0, len: 0 }, K = T.racingLine.k, n = T.n, step = T.step;
  if (off) return out;
  for (let m = 0; m < CORNER_SEARCH; m += step) {
    const a = K[(i + Math.round(m / step)) % n];
    if (Math.abs(a) < 1 / CORNER_R) continue;
    out.dir = a > 0 ? 1 : -1; out.at = m;
    for (let l = m; l < m + CORNER_MAX; l += step) {
      const b = K[(i + Math.round(l / step)) % n];
      if (b * out.dir < 1 / (2 * CORNER_R)) break;
      out.len = l - m;
    }
    return out;
  }
  return out;
}

// The speed at which yawRateAt(v) just covers curvature ak, in closed form for the piecewise line.
function cornerSpeed(ph, ak) {
  const B = (ph.yawFast - ph.yawSlow) / 20, v = (ph.yawSlow - 8 * B) / (ak - B);
  return v > 28 ? ph.yawFast / ak : v;
}

export function createBrain(R, k, difficulty) {
  let cfg = DIFFICULTY[difficulty] || DIFFICULTY.medium;
  const rng = createRng(mixSeed(R.seed, 100 + k.i));
  // in fog or at night a bot sees a disaster's lane later, as you do
  if (R.weather) cfg = { ...cfg, see: cfg.see * (R.weather.cfg?.see ?? 1) * (R.weather.night ? 0.8 : 1) };
  return {
    cfg, rng, off: 0, mistake: 0, mistakeT: rng.range(...cfg.mistakeEvery) * rng.next(), mistakeLeft: 0,
    itemT: 0, seen: null, driftWanted: false, driftOver: 0, cornerRoll: rng.next(), cornerDir: 0,
    latI: 0, latPrev: 0, reverseT: 0, route: -1, routeRoll: rng.next(), routeFor: -1, avoidOn: true, avoidT: 0,
    scFaster: null,
  };
}

// Does this kart gain on the shortcut, with its offroad stat? Decided once, the way a driver knows their own machine.
function shortcutPays(R, k, p, B, sc) {
  if (!B.scFaster) B.scFaster = {};
  if (B.scFaster[sc.index] === undefined) {
    const T = R.track, mainLen = ((sc.to - sc.from + 1) % 1) * T.length, s = SURFACE[sc.surface] || SURFACE.dirt;
    const f = 1 - (1 - s.speed) * p.ph.rough;
    B.scFaster[sc.index] = sc.length / f < mainLen * 0.97;
  }
  return B.scFaster[sc.index];
}

function routeChoice(R, k, p, B, f) {
  const T = R.track, n = T.n, cfg = B.cfg;
  if (B.route >= 0) {
    const sc = T.shortcuts[B.route], end = ((sc.to * n - f) % n + n) % n;
    if (end < 4 || end > n * 0.6) B.route = -1;
    return;
  }
  for (const sc of T.shortcuts) {
    const to = ((sc.from * n - f) % n + n) % n;
    if (to * T.step > 30) { if (B.routeFor === sc.index) B.routeFor = -1; continue; }
    if (B.routeFor === sc.index) continue;
    B.routeFor = sc.index;
    if (B.rng.next() < cfg.shortcuts && shortcutPays(R, k, p, B, sc)) B.route = sc.index;
    break;
  }
}

// How far off its line the bot must run to clear what is on the road ahead, judged at the obstacle's own sample: the
// line itself may be elsewhere by then. Measured from the plain line, so that dodging does not cancel its own reason.
function avoidance(R, k, B, i, base) {
  const s = R.state, T = R.track, n = T.n, RL = T.racingLine, W = T.samples.w, v = Math.max(k.speed, 10);
  let best = 0;
  const consider = (e, r, vd) => {
    let o = e.i - i;
    if (o > n / 2) o -= n; else if (o < -n / 2) o += n;
    const ahead = o * T.step;
    if (ahead < 2 || ahead > AVOID_M) return;
    const lane = RL.d[e.i] + base, dh = e.d + vd * (ahead / v), gap = lane - dh, clear = r + 2.1, room = W[e.i] / 2 - 1.4;
    if (Math.abs(gap) >= clear) return;
    let shift = (gap >= 0 ? 1 : -1) * (clear - Math.abs(gap));
    if (Math.abs(lane + shift) > room) shift = (gap >= 0 ? -1 : 1) * (clear + Math.abs(gap));
    if (Math.abs(shift) > Math.abs(best)) best = shift;
  };
  for (const e of s.hazards) if (e.kind !== 'ice' && (e.active || e.warn || e.vd) && !(e.kind === 'bats' && e.h > 3.5)) consider(e, e.r, e.vd);
  for (const e of s.spills) consider(e, e.r, 0);
  // a puddle or a drift: the good drivers go round it
  if (R.weather?.patches.length && B.cfg.avoid >= 0.7) patchesAhead(R.weather, i, n, Math.ceil(AVOID_M / T.step), (q) => consider(q, q.rz - 0.6, 0));
  // a disaster on the road: read the sign and take the free lane, from as far off as this driver looks
  for (const D of s.disasters) {
    if (D.free) continue;
    let o = D.c - i;
    if (o > n / 2) o -= n; else if (o < -n / 2) o += n;
    const ahead = o * T.step, half = D.len / 2 + 8;
    if (ahead < -half || ahead > B.cfg.see + half) continue;
    const along = Math.max(-half, Math.min(half, -ahead + Math.max(18, v * 0.7))), j = ((D.c + Math.round(along / T.step)) % n + n) % n;
    const lane = RL.d[j] + base, gap = disasterGap(D, along), off = gap - lane;
    if (Math.abs(off) > D.gapW / 2 - 1.5 && Math.abs(off) > Math.abs(best)) best = off;
  }
  return best;
}

// The lane, off the line, of the nearest crate still up in the band coming: a bot with an empty slot goes for it, or the front of the pack would take them all.
function crateLane(R, k, B, i, lineD) {
  const T = R.track, n = T.n, S = T.samples;
  for (const b of T.bands) {
    const ahead = ((b.i - i) % n + n) % n * T.step;
    if (ahead < 1 || ahead > CRATE_SEE) continue;
    if (B.crateBand !== b.band) { B.crateBand = b.band; B.crateGo = B.rng.next() < B.cfg.crate; }
    if (!B.crateGo) return null;
    let best = null, bd = Infinity;
    for (const q of R.state.boxes) {
      if (q.band !== b.band || !q.up) continue;
      const d = (q.x - S.x[b.i]) * S.nx[b.i] + (q.z - S.z[b.i]) * S.nz[b.i], e = Math.abs(d - lineD - B.off);
      if (e < bd) { bd = e; best = d; }
    }
    return best === null ? null : best - lineD;
  }
  return null;
}

function nearestFoes(R, k) {
  const s = R.state, L = R.track.length, out = { ahead: null, aheadD: Infinity, behind: null, behindD: Infinity, within: 0 };
  for (const o of s.karts) {
    if (o === k || o.finished || mates(o, k)) continue;
    const m = (o.progress - k.progress) * L;
    if (m > 0 && m < out.aheadD) { out.ahead = o; out.aheadD = m; }
    if (m < 0 && -m < out.behindD) { out.behind = o; out.behindD = -m; }
    if ((o.x - k.x) ** 2 + (o.z - k.z) ** 2 < 20 * 20 && Math.abs(o.y - k.y) < 8) out.within++;
  }
  return out;
}

function wantsItem(R, k, B, straight, dt, inp) {
  const cfg = B.cfg, id = k.item;
  if (!id || k.hitT > 0) { B.itemT = 0; B.seen = null; return false; }
  if (B.seen !== id) { B.seen = id; B.itemT = B.rng.range(...cfg.itemDelay); B.heldT = 0; }
  B.itemT -= dt; B.heldT = (B.heldT || 0) + dt;
  if (B.itemT > 0) return false;
  if (!cfg.smart) return true; // easy: late and whatever the moment
  const F = nearestFoes(R, k), hard = cfg.minTier >= 2, last = k.place >= R.state.karts.length - 1, late = B.heldT > (hard ? 22 : 12);
  if (R.forma) { const v = R.forma.botItem(k, R.priv[k.i], id, inp, late); if (v !== null) return v; }
  switch (id) {
    case 'razzo': return k.place > 1 ? F.aheadD < (hard ? 75 : 130) || late : late;
    case 'grappa': return straight || late;
    case 'zuica': return k.boostT <= 0.05 && (straight || late);
    case 'mici':
      if (F.aheadD < 26 && k.orbit >= (hard ? 2 : 1) && straight) return true;
      return !hard && late;
    case 'uova': return hard ? last || k.place > 3 || late : straight || late;
    case 'polenta':
      if (F.aheadD < 34 && F.behindD > 30) { inp.throttle = 1; return true; }
      return F.behindD < (hard ? 22 : 34) || (F.behindD > 150 && F.aheadD < 150) || late;
    case 'formaggio':
      if (F.aheadD < 45 && F.behindD > 45) { inp.throttle = 1; return true; }
      return F.behindD < 70 || (F.behindD > 150 && F.aheadD < 150) || late;
    case 'durian':
      if (F.aheadD < 80 && F.behindD > 50 && last) { inp.throttle = 1; return true; }
      return F.behindD < (hard ? 26 : 36) || (F.behindD > 150 && F.aheadD < 150) || late;
    case 'sambal': return F.behindD < 14 || (!hard && straight) || late;
    case 'rendang': return k.place > 1 ? F.aheadD < (hard ? 45 : 60) || late : R.track.bands.some((b) => { const o = ((b.i - k.trackI) % R.track.n + R.track.n) % R.track.n; return o * R.track.step < 50; }) || late;
    case 'frana': return k.place > 1 || F.behindD < 90 || late;
    default: return true;
  }
}

export function botInput(R, k, p, dt) {
  const B = p.bot, cfg = B.cfg, T = R.track, n = T.n, S = T.samples, RL = T.racingLine, ph = p.ph;
  const inp = { steer: 0, throttle: 0, item: false, drift: false };
  if (R.state.phase === 'countdown' || k.hitT > 0 || k.rescueT > 0) return inp;

  const f = p.f, i = Math.round(f) % n, v = Math.max(0, k.speed), speed = Math.hypot(k.vx, k.vz);
  if (!k.finished && cfg.shortcuts > 0) routeChoice(R, k, p, B, f); else if (k.finished) B.route = -1;

  // mistakes: a moment of inattention that drifts the lane
  if (!k.finished && (B.mistakeT -= dt) <= 0) {
    B.mistakeT = B.rng.range(...cfg.mistakeEvery);
    B.mistakeLeft = cfg.mistakeT;
    B.mistake = (B.rng.next() < 0.5 ? -1 : 1) * cfg.mistakeAmp;
  }
  if (B.mistakeLeft > 0) B.mistakeLeft -= dt; else B.mistake = 0;
  if ((B.avoidT -= dt) <= 0) { B.avoidT = 1.2; B.avoidOn = B.rng.next() < cfg.avoid; }

  // where to aim
  const look = 7 + speed * 0.33, ai = (i + Math.round(look / T.step)) % n, lineD = RL.d[i], hw = S.w[i] / 2;
  let want = B.mistake * hw;
  if (!k.finished && !k.item && k.rouletteT <= 0 && B.route < 0 && !R.forma) { const c = crateLane(R, k, B, i, lineD); if (c !== null) want = c; }
  if (B.avoidOn) want += avoidance(R, k, B, i, want);
  if (R.traffic && (B.avoidOn || B.cfg.avoid >= 0.15)) want = trafficAvoid(R, k, p, B, i, lineD + want) + want;
  // room for the kart in front: pass it instead of pushing it
  for (const o of R.state.karts) {
    if (o === k || o.finished) continue;
    const dx = o.x - k.x, dz = o.z - k.z, along = dx * Math.sin(k.yaw) + dz * Math.cos(k.yaw);
    if (along < 1 || along > 12 || Math.abs(o.y - k.y) > 3 || o.speed > k.speed + 1) continue;
    const lat = o.d - (lineD + B.off);
    if (Math.abs(lat) < 2.8) { want += (lat >= 0 ? -1 : 1) * (2.8 - Math.abs(lat)); break; }
  }
  if (R.forma && !k.finished) want = R.forma.botLane(k, p, B, lineD, want);
  B.off += clamp(want - B.off, -9 * dt, 9 * dt);

  let tx, tz;
  if (B.route >= 0) {
    const sc = T.shortcuts[B.route], q = sc.nearest(k.x, k.z, p.scHint[sc.index]), a = Math.min(sc.n - 1, q.i + Math.round(look / sc.step));
    tx = sc.samples.x[a]; tz = sc.samples.z[a];
    B.latI = 0; B.latPrev = q.d;
  } else {
    const hwA = S.w[ai] / 2 - 1.3, dA = clamp(RL.d[ai] + B.off, -hwA, hwA);
    tx = S.x[ai] + S.nx[ai] * dA; tz = S.z[ai] + S.nz[ai] * dA;
  }

  // off its lane with a building coming: head back for the road now, along its nearest stretch and not the far point of the line. A lane itself is always clear of them.
  if (R.solids && (B.route < 0 || (k.shortcut < 0 && R.state.t - p.solidAt < 0.5)) && Math.abs(k.d) > hw - 2.5) {
    const m = 4 + speed * SOLID.see, fx = Math.sin(k.yaw), fz = Math.cos(k.yaw);
    let seen = false;
    for (let q = 0.25; q <= 1 && !seen; q += 0.25) seen = !!solidPush(R.solids, k.x + fx * m * q, k.y, k.z + fz * m * q);
    if (seen) {
      B.route = -1; // bumped off the shortcut it was making for, with stones between: the road, this time
      const a = (i + Math.round(9 / T.step)) % n, hwN = S.w[a] / 2 - 2.5, dN = clamp(k.d * 0.3, -Math.max(0, hwN), Math.max(0, hwN));
      tx = S.x[a] + S.nx[a] * dN; tz = S.z[a] + S.nz[a] * dN;
    }
  }

  // pursuit in terms of where the kart is actually going, not where its nose points
  const heading = speed > 5 ? Math.atan2(k.vx, k.vz) : k.yaw;
  const err = wrapAngle(Math.atan2(tx - k.x, tz - k.z) - heading), L = Math.max(4, Math.hypot(tx - k.x, tz - k.z));
  let desired = 2 * Math.sin(err) * Math.max(speed, 6) / L;
  if (B.route < 0) {
    const lat = k.d - (lineD + B.off), latRate = (lat - B.latPrev) / dt;
    B.latPrev = lat; B.latI = clamp(B.latI + lat * dt, -3, 3);
    desired += -(0.035 * lat + 0.006 * B.latI + 0.004 * clamp(latRate, -20, 20)) * Math.max(speed, 6) / 12;
  }

  // corners ahead: how fast may we arrive, and is there a drift in it?
  const surf = SURFACE[k.surface] || SURFACE.asphalt, grip = surf.grip;
  const C = readCorner(T, i, B.route >= 0);
  if (C.dir !== B.cornerDir) { B.cornerDir = C.dir; if (C.dir) B.cornerRoll = B.rng.next(); }
  const shaky = k.tipsyT > 0 || k.stinkT > 0 || k.offroad || p.stickyT > 0 || grip < 0.3 || k.finished;
  const tCorner = C.len / Math.max(speed, 12), plan = !shaky && C.dir && B.cornerRoll < cfg.driftChance && tCorner >= cfg.minCorner && B.route < 0;
  const useDrift = k.drift || B.driftWanted || plan;
  const gripCap = clamp(grip * 1.3, 0.55, 1);
  const driftRate = ph.drift * (1 + DRIFT_RANGE) * cfg.corner * gripCap;
  let allow = 99;
  const reach = Math.min(120, speed * 1.1 + 18);
  for (let m = 0; m <= reach; m += SCAN_STEP) {
    const j = (i + Math.round(m / T.step)) % n, ak = B.route < 0 ? Math.abs(RL.k[j]) : 0;
    if (ak < 0.002) continue;
    const vm = useDrift ? driftRate / ak : cornerSpeed(ph, ak) * cfg.corner * gripCap, a = Math.sqrt(vm * vm + 2 * BOT_BRAKE * cfg.corner * m);
    if (a < allow) allow = a;
  }

  // the drift itself: start as the corner arrives, let go as it ends
  if (k.drift) {
    const stillTurning = C.dir === -k.drift && C.at < Math.max(10, speed * 0.35);
    if (stillTurning) B.driftOver = 0; else B.driftOver += dt;
    const earned = k.driftTier >= cfg.minTier, roomy = Math.abs(k.d) < hw - 2.5;
    if (!stillTurning && (earned || !roomy || B.driftOver > 0.6)) B.driftWanted = false;
    if (Math.abs(k.d) > hw + 2.5 || Math.abs(wrapAngle(k.yaw - heading)) > 1.2) B.driftWanted = false;
  } else if (B.driftWanted) {
    if (!plan && k.grounded && !p.hopArmed) B.driftWanted = false;
    if (p.hopArmed && k.grounded && Math.abs(k.speed) < DRIFT_MIN_V) B.driftWanted = false;
  } else if (plan && C.at < speed * 0.34 && speed > DRIFT_MIN_V + 3) {
    B.driftWanted = true; B.driftOver = 0;
  }
  inp.drift = B.driftWanted;
  const turn = C.dir;

  // what the stick must do to get that turn
  const slip = wrapAngle(k.yaw - heading), g = (k.drift ? DRIFT_GRIP : GRIP) * Math.max(0.2, grip);
  const slipWant = Math.atan(clamp(desired / g, -1.2, 1.2));
  const yawCmd = desired + 4.5 * (slipWant - slip);
  if (k.drift) {
    // yaw rate is -dir * drift * (1 + range * steer * dir), with one range to tighten and one to open
    const need = -yawCmd * k.drift / ph.drift - 1, x = need / (need > 0 ? DRIFT_RANGE : DRIFT_OPEN);
    inp.steer = clamp(x * k.drift, -1, 1);
  } else {
    inp.steer = clamp(-yawCmd / Math.max(0.3, yawRateAt(ph, speed)), -1, 1);
    // on the hop, commit the stick to the corner so the drift takes the right side
    if (B.driftWanted && turn && (!k.grounded || Math.abs(inp.steer) < 0.3)) inp.steer = turn > 0 ? -0.6 : 0.6;
  }

  if (v > allow + 1.5) inp.throttle = v > allow + 6 ? -0.7 : -0.3;
  if (R.traffic && B.tfBrake) inp.throttle = Math.min(inp.throttle, -0.5);
  if (R.forma && !k.finished) R.forma.botThrottle(k, p, inp);

  // going nowhere: back out, then point down the road
  // and if backing out got it nowhere either, its tail is against something: forward for a moment before it tries again
  B.forwardT = (B.forwardT ?? 0) - dt;
  if (p.stillT > 0.7 && B.reverseT <= 0 && B.forwardT <= 0) { B.reverseT = 0.8; B.forwardT = 1.6; }
  if (B.reverseT > 0) {
    B.reverseT -= dt;
    inp.throttle = -1; inp.drift = false;
    inp.steer = clamp(-err * 1.5, -1, 1) * -1;
  }

  if (k.finished) return inp;
  const straight = !turn || C.at > 40;
  if (wantsItem(R, k, B, straight, dt, inp)) { inp.item = true; B.seen = null; }
  return inp;
}

export function updateRubber(R, k, p) {
  const cfg = p.bot.cfg, L = R.track.length;
  // on easy the band waits for the slowest person still racing, not the best one
  const gap = ((cfg.waitLast ? R.lastProgress : R.refProgress) - k.progress) * L;
  // the last stretch is where a race should still be open, so the band pulls harder there
  const s = R.state, finale = k.progress > s.laps - (R.track.long ? PACK.finaleLong : 1) ? cfg.finale ?? PACK.finale : 1;
  p.rubber = gap > 0 ? finale * cfg.back * clamp(gap / cfg.reach, 0, 1) : cfg.front * clamp(-gap / cfg.reach, 0, 1);
  // The race among the bots stays a race: the ones off the back of the pack gain a little, the ones ahead of the pack and of every person give a little, and a lead bot alone gives more. A person in the lead is never handed anything.
  const pack = (R.fieldMean - k.progress) * L;
  if (pack > 0 || gap < 0) p.rubber += finale * cfg.pack * clamp(pack / PACK.reach, -1, 1);
  if (gap < 0 && R.order[0] === k && R.order[1]) p.rubber -= finale * cfg.leadEase * clamp(((k.progress - R.order[1].progress) * L - PACK.leadFrom) / PACK.leadReach, 0, 1);
  // a bot already ahead of the person is never helped to get further away
  if (gap < 0 && p.rubber > 0) p.rubber = 0;
}

