// Boxes, the eleven items, shots and spills, and the one door every hit goes through.

import { ROULETTE_T, BOX_RESPAWN, rollItem, itemInfo } from '../data/items.js';
import {
  HIT, RAZZO, MICI_SHOT, FORMAGGIO, POLENTA, DURIAN, LOB, LOB_T, SAMBAL_FIRE, SAMBAL_BURST, RENDANG, FRANA, SHIELD_SAFE, clamp, wrapAngle, mates,
} from './tuning.js';
import { giveBoost, endDrift, wallPush } from './kart.js';
import { sweepDisasters, sacredPoints } from './disasters.js';
import { sweepTraffic } from './traffic.js';

const PICK_R = 2.4, PICK_Y = 3.2, BAND_WINDOW = 8, SPILL_CAP = 72;
const GRAPPA = itemInfo('grappa'), UOVA = itemInfo('uova');

export function createBoxes(track) {
  const out = [];
  let id = 0;
  for (const b of track.bands) for (const q of b.boxes) out.push({ id: id++, x: q.x, y: q.y, z: q.z, up: true, band: b.band, respawn: 0 });
  return out;
}

// The only way to hurt a kart. 'blocked' means mici took it, 'immune' means nothing happened.
export function hitKart(R, k, by, kind, cause) {
  const p = R.priv[k.i];
  if (k.finished || k.rescueT > 0) return 'immune';
  if (by >= 0 && by !== k.i && mates(k, R.state.karts[by])) return 'immune'; // nothing a team-mate throws can hurt you, or cost you a sausage
  if (k.bigT > 0 || k.safeT > 0) return 'immune';
  if (k.orbit > 0) {
    k.orbit--; k.itemCharges = k.orbit;
    if (k.orbit === 0) k.item = null;
    k.safeT = SHIELD_SAFE;
    R.emit({ type: 'shield', kart: k.i, by, cause });
    return 'blocked';
  }
  if (kind === 'slide') {
    p.stickyT = POLENTA.t;
    endDrift(R, k, false);
    R.emit({ type: 'hit', kart: k.i, by, kind, cause });
    return 'hit';
  }
  const h = HIT[kind];
  endDrift(R, k, false);
  k.hitKind = kind; k.hitT = h.t; p.hitDur = h.t; p.hitYaw = k.yaw;
  if (cause === 'sambal') k.sootT = SAMBAL_BURST.soot;
  k.safeT = h.t + h.safe;
  k.boostT = 0; k.boostKind = null; p.boostMul = 1; p.tipsyDelay = 0;
  k.vx *= h.keep + p.ph.keep; k.vz *= h.keep + p.ph.keep;
  if (h.pop && k.grounded) { k.vy = h.pop * p.ph.shove; k.grounded = false; k.airT = 0; }
  R.emit({ type: 'hit', kart: k.i, by, kind, cause });
  return 'hit';
}

// Churches and temples are never touched: no fire, flash or rock inside a protected place, and whatever lies on the road rolls clear of it.
const sacredOf = (R) => (R.sacred ??= R.track.def?.sacred?.length ? sacredPoints(R.track) : []);
const inSacred = (R, x, z) => sacredOf(R).some((q) => Math.hypot(x - q.x, z - q.z) < q.r);
// does anything of radius pad, anywhere across the road at this sample, touch a protected place?
function roadTouchesSacred(R, i, pad) {
  const S = R.track.samples, hw = S.w[i] / 2;
  return sacredOf(R).some((q) => {
    const dx = q.x - S.x[i], dz = q.z - S.z[i], c = clamp(dx * S.nx[i] + dz * S.nz[i], -hw, hw);
    return Math.hypot(dx - S.nx[i] * c, dz - S.nz[i] * c) < q.r + pad;
  });
}
// how far along the road a throw must go, from where it was aimed, to lie clear: dir 1 further on, -1 back
function clearAlong(R, k, along, pad, dir) {
  const T = R.track, f0 = R.priv[k.i].f;
  for (let tries = 0; tries < 200 && roadTouchesSacred(R, Math.round((((f0 + along / T.step) % T.n) + T.n) % T.n) % T.n, pad); tries++) along += dir * T.step * 4;
  return along;
}

function boom(R, s, kind) { if (!inSacred(R, s.x, s.z)) R.emit({ type: 'boom', x: s.x, y: s.y, z: s.z, kind }); }

const roadPoint = (R, si, d) => {
  const T = R.track, n = T.n, f = ((si % n) + n) % n, a = Math.floor(f) % n, b = (a + 1) % n, t = f - Math.floor(f), S = T.samples;
  const nx = S.nx[a], nz = S.nz[a];
  const x = S.x[a] + (S.x[b] - S.x[a]) * t + nx * d, z = S.z[a] + (S.z[b] - S.z[a]) * t + nz * d;
  return { x, z, y: T.heightAt(f, d), tx: S.tx[a], tz: S.tz[a] };
};

// Who a kart's razzo and rendang go for: the kart just ahead, or in a team championship the first rival ahead. Null: nobody.
// A kart that has finished is cruising, out of the race: the first still racing counts as the leader.
function rivalAhead(R, k) {
  for (let n = k.place - 2; n >= 0; n--) if (!R.order[n].finished && !mates(k, R.order[n])) return R.order[n];
  return null;
}

// A puddle, a cloud or a wheel left behind for nobody is a wasted press: with no rival in reach behind and one ahead, it goes forward by itself.
function throwsForward(R, k, inp) {
  if ((inp?.throttle ?? 0) > 0.5) return true;
  if (R.forma || !rivalAhead(R, k)) return false;
  const L = R.track.length;
  for (const o of R.state.karts) {
    if (o === k || o.finished || mates(k, o)) continue;
    const m = (k.progress - o.progress) * L;
    if (m >= 0 && m < LOB.clearBehind) return false;
  }
  return true;
}

// How far to throw: at least its usual reach, and if the kart ahead is further than that, onto the road just in front of it.
function lobReach(R, k, base) {
  const a = rivalAhead(R, k);
  if (!a) return base;
  const gap = (a.progress - k.progress) * R.track.length;
  return gap > LOB.reach ? base : clamp(gap + a.speed * LOB.lead, base, LOB.reach);
}

// A spill sits at a spot on the road a little behind or ahead of a kart.
function spillAt(R, k, kind, along, r, ttl) {
  along = clearAlong(R, k, along, r, -1);
  const T = R.track, p = R.priv[k.i], n = T.n, f = ((p.f + along / T.step) % n + n) % n, i = Math.round(f) % n;
  const hw = T.samples.w[i] / 2, d = kind === 'durian' ? 0 : clamp(k.d, -hw + 1, hw - 1);
  const P = roadPoint(R, f, d);
  const sp = { id: R.nextId++, kind, x: P.x, y: P.y, z: P.z, r, t: 0, ttl, owner: k.i, i, d };
  R.state.spills.push(sp);
  return sp;
}

// Stick up: the item goes up in an arc, and lands as its spill a moment later on the spot it was thrown at.
function lob(R, k, kind, along, r, ttl, lane = k.d) {
  along = clearAlong(R, k, along, r, 1);
  const T = R.track, p = R.priv[k.i], f = ((p.f + along / T.step) % T.n + T.n) % T.n, i = Math.round(f) % T.n;
  const hw = T.samples.w[i] / 2, d = kind === 'durian' ? 0 : clamp(lane, -hw + 1, hw - 1), P = roadPoint(R, f, d);
  R.state.shots.push({
    id: R.nextId++, kind, x: k.x, y: k.y + 1.2, z: k.z, yaw: k.yaw, vy: 0, owner: k.i, t: 0, target: -1, lob: true,
    x0: k.x, y0: k.y + 1.2, z0: k.z, x1: P.x, y1: P.y, z1: P.z, f, d, r, life: ttl, i,
  });
}

function stepLob(R, S, dt) {
  S.t += dt;
  const a = Math.min(1, S.t / LOB_T), arc = Math.sin(a * Math.PI) * 11;
  S.x = S.x0 + (S.x1 - S.x0) * a; S.z = S.z0 + (S.z1 - S.z0) * a; S.y = S.y0 + (S.y1 - S.y0) * a + arc;
  if (a < 1) return true;
  R.state.spills.push({ id: R.nextId++, kind: S.kind, x: S.x1, y: S.y1, z: S.z1, r: S.r, t: 0, ttl: S.life, owner: S.owner, i: S.i, d: S.d, lobbed: true });
  R.emit({ type: 'boom', x: S.x1, y: S.y1, z: S.z1, kind: S.kind });
  return false;
}

// The rude fire: whoever is close behind, in a cone along the kart's axis, is burnt.
function sambalBurst(R, k) {
  const B = SAMBAL_BURST, fx = Math.sin(k.yaw), fz = Math.cos(k.yaw);
  if (!inSacred(R, k.x - fx * 2, k.z - fz * 2)) R.emit({ type: 'boom', x: k.x - fx * 2, y: k.y, z: k.z - fz * 2, kind: 'sambal', yaw: k.yaw });
  for (const o of R.state.karts) {
    if (o === k || Math.abs(o.y - k.y) > B.level) continue;
    const dx = o.x - k.x, dz = o.z - k.z, back = -(dx * fx + dz * fz), side = Math.abs(dx * fz - dz * fx);
    if (back > 0 && back < B.reach && side < 2 + (B.width - 2) * (back / B.reach)) hitKart(R, o, k.i, 'spin', 'sambal');
  }
}

// Rocks across the road with one lane left free, and a shadow for the time they take to fall.
function dropFrana(R, k) {
  // the leader is the first still racing; a kart that has finished is not worth a landslide
  const T = R.track, s = R.state, F = FRANA, lead = R.order.find((o) => !o.finished) || k, others = (o) => o !== k && !o.finished;
  const tgt = R.forma?.franaAim(k) ?? (k.team ? R.order.find((o) => others(o) && !mates(k, o)) || k : lead === k ? R.order.find(others) || k : lead), tp = R.priv[tgt.i];
  let along = Math.max(tgt.speed, 18) * F.warn + F.ahead, f = (tp.f + along / T.step) % T.n, i = Math.round(f) % T.n;
  // never inside a tunnel, never on a church or a temple: it comes down just past it
  for (let tries = 0; tries < 200 && (T.structureAt(i) === 'tunnel' || roadTouchesSacred(R, i, F.rockR)); tries++) { along += T.step * 4; f = (tp.f + along / T.step) % T.n; i = Math.round(f) % T.n; }
  const w = T.samples.w[i], lanes = Math.max(2, Math.floor(w / F.spacing)), gap = Math.floor(R.rngItems.next() * lanes), hw = w / 2;
  let lead0 = true;
  for (let j = 0; j < lanes; j++) {
    if (j === gap) continue;
    const d = -hw + (j + 0.5) * (w / lanes), P = roadPoint(R, f, d);
    s.spills.push({ id: R.nextId++, kind: 'frana', x: P.x, y: P.y, z: P.z, r: F.rockR, t: 0, ttl: F.ttl, owner: k.i, i, d, warn: F.warn, lead: lead0, fromLead: lead === k });
    lead0 = false;
  }
  // the rumble reaches whoever is on that stretch of road
  for (const o of s.karts) {
    if (o.finished) continue;
    const ahead = ((f - R.priv[o.i].f) % T.n + T.n) % T.n;
    if (ahead * T.step < along + 40) R.emit({ type: 'hazardNear', kart: o.i, kind: 'frana' });
  }
}

export function useItem(R, k, inp) {
  const p = R.priv[k.i], item = k.item, s = R.state;
  if (!item) return;
  R.emit({ type: 'itemUse', kart: k.i, item });
  const fx = Math.sin(k.yaw), fz = Math.cos(k.yaw);
  switch (item) {
    case 'razzo': {
      const ahead = rivalAhead(R, k), aim = R.forma?.razzoAim(k) ?? null;
      const target = aim ? aim.target : ahead && !ahead.finished ? ahead.i : -1;
      const si = p.f + 3 / R.track.step;
      const P = roadPoint(R, si, k.d);
      // from first place there is nobody to chase: it sweeps a whole road length, clearing what it meets
      const sweep = !aim && !ahead;
      s.shots.push({
        id: R.nextId++, kind: 'razzo', x: P.x, y: P.y + 1, z: P.z, yaw: k.yaw, vy: 0, owner: k.i, t: 0, target, si, d: k.d, free: !!aim?.free,
        sweep, ttl: sweep ? (R.track.long ? Math.min(R.track.length, RAZZO.sweepLong) : R.track.length) / RAZZO.v : RAZZO.ttl,
      });
      // the kick of the launch, and nothing from behind touches the leader for a moment: a first place razzo is worth a press
      if (sweep) { k.safeT = Math.max(k.safeT, RAZZO.leadSafe); giveBoost(R, k, 'drift', 'drift1'); }
      break;
    }
    case 'grappa':
      giveBoost(R, k, 'grappa');
      p.tipsyDelay = GRAPPA.boostT;
      break;
    case 'zuica':
      giveBoost(R, k, 'zuica');
      break;
    case 'mici': {
      k.orbit = Math.max(0, k.orbit - 1);
      // with nobody ahead a sausage thrown forward is thrown at nobody: from first it goes back, at whoever is chasing
      const dir = R.forma || rivalAhead(R, k) ? 1 : -1;
      s.shots.push({
        id: R.nextId++, kind: 'mici', x: k.x + dir * fx * 2.4, y: k.y + 0.9, z: k.z + dir * fz * 2.4, yaw: dir > 0 ? k.yaw : wrapAngle(k.yaw + Math.PI), vy: 0, owner: k.i, t: 0, target: -1,
        v: dir > 0 ? Math.max(MICI_SHOT.minV, k.speed + MICI_SHOT.v) : MICI_SHOT.minV, bounced: 0, f: p.f,
      });
      break;
    }
    case 'uova':
      k.bigT = UOVA.bigT;
      k.boostT = 0;
      giveBoost(R, k, 'uova');
      break;
    case 'polenta': {
      // stick up throws it far ahead; otherwise it drops behind
      if (throwsForward(R, k, inp)) lob(R, k, 'polenta', lobReach(R, k, POLENTA.ahead), POLENTA.r, POLENTA.ttl, rivalAhead(R, k)?.d ?? k.d);
      else spillAt(R, k, 'polenta', -POLENTA.behind, POLENTA.r, POLENTA.ttl);
      break;
    }
    case 'formaggio': {
      // backward along the centre line; stick up, forward, and always quicker than the kart that let it go
      // with nobody ahead, stick up or not, it goes back at the chasers: forward it would roll away from everyone
      const fwd = throwsForward(R, k, inp) && (R.forma || !!rivalAhead(R, k)), dir = fwd ? 1 : -1, si = p.f + dir * 3 / R.track.step, P = roadPoint(R, si, 0);
      s.shots.push({
        id: R.nextId++, kind: 'formaggio', x: P.x, y: P.y + 1.2, z: P.z, yaw: Math.atan2(P.tx * dir, P.tz * dir), vy: 0, owner: k.i, t: 0, target: -1, si, d: k.d, hits: 0,
        dir, v: fwd ? Math.max(FORMAGGIO.v, k.speed + FORMAGGIO.overtake) : FORMAGGIO.v,
      });
      break;
    }
    case 'durian': {
      const r = R.track.samples.w[p.i] * DURIAN.width;
      if (throwsForward(R, k, inp)) lob(R, k, 'durian', lobReach(R, k, DURIAN.ahead), r, DURIAN.ttl);
      else spillAt(R, k, 'durian', -DURIAN.behind, r, DURIAN.ttl);
      break;
    }
    case 'sambal':
      giveBoost(R, k, 'sambal');
      p.fireT = SAMBAL_FIRE.every;
      sambalBurst(R, k);
      break;
    case 'rendang':
      s.shots.push({ id: R.nextId++, kind: 'rendang', x: k.x, y: k.y + 2.4, z: k.z, yaw: k.yaw, vy: 0, owner: k.i, t: 0, target: -1 });
      k.rendangT = !R.forma && !rivalAhead(R, k) ? RENDANG.leadT : RENDANG.t; // a leader's pot keeps smelling until the next band of crates comes in reach
      break;
    case 'frana':
      dropFrana(R, k);
      break;
  }
  if (--k.itemCharges <= 0) { k.item = null; k.itemCharges = 0; }
}

export function stepItemsForKart(R, k, inp, dt) {
  const p = R.priv[k.i];
  if (k.rouletteT > 0 && (k.rouletteT -= dt) <= 0) {
    k.rouletteT = 0;
    k.item = p.pendingItem; p.pendingItem = null;
    k.itemCharges = itemInfo(k.item).charges;
    if (k.item === 'mici') k.orbit = k.itemCharges;
  }
  const press = !!(inp && inp.item);
  if (press && !p.prevItem && k.item && k.hitT <= 0 && k.rescueT <= 0 && R.state.phase === 'race' && !k.finished) useItem(R, k, inp);
  p.prevItem = press;
  if (k.boostKind === 'sambal' && k.boostT > 0 && (p.fireT -= dt) <= 0) {
    p.fireT = SAMBAL_FIRE.every;
    if (k.grounded && !k.offroad && R.state.spills.length < SPILL_CAP && !roadTouchesSacred(R, p.i, SAMBAL_FIRE.r)) spillAt(R, k, 'sambal', -2.6, SAMBAL_FIRE.r, SAMBAL_FIRE.ttl);
  }
}

export function stepBoxes(R, dt) {
  const s = R.state, T = R.track, n = T.n;
  for (const b of s.boxes) if (!b.up && (b.respawn -= dt) <= 0) { b.up = true; b.respawn = 0; }
  for (const k of s.karts) {
    if (k.finished || k.rescueT > 0) continue;
    for (const band of T.bands) {
      let o = Math.abs(k.trackI - band.i);
      if (o > n / 2) o = n - o;
      if (o > BAND_WINDOW) continue;
      for (let q = band.band * band.boxes.length, e = q + band.boxes.length; q < e; q++) {
        const b = s.boxes[q];
        if (!b.up) continue;
        const dx = b.x - k.x, dz = b.z - k.z;
        if (dx * dx + dz * dz > PICK_R * PICK_R || Math.abs(b.y - k.y) > PICK_Y) continue;
        b.up = false; b.respawn = BOX_RESPAWN;
        takeBox(R, k);
      }
    }
  }
}

function takeBox(R, k) {
  const p = R.priv[k.i];
  if (k.item || k.rouletteT > 0) { R.emit({ type: 'boxTake', kart: k.i, item: null }); return; }
  let item = rollItem(R.rngItems.next());
  while (R.forma && item === 'formaggio') item = rollItem(R.rngItems.next()); // the hunt has one wheel on the road, and it is not a weapon
  p.pendingItem = item; k.rouletteT = ROULETTE_T;
  R.emit({ type: 'boxTake', kart: k.i, item });
}

function stepRazzo(R, S, dt) {
  const T = R.track, s = R.state, K = s.karts;
  S.t += dt;
  if (S.target >= 0 && (K[S.target].finished || K[S.target].rescueT > 0)) S.target = -1;
  // nobody to chase: it flies on, and only picks up someone who ends up right in front of it
  if (S.target < 0) {
    const f = ((S.si % T.n) + T.n) % T.n;
    for (const k of K) {
      if (k.i === S.owner || k.finished || k.rescueT > 0 || mates(k, K[S.owner])) continue;
      const o = ((R.priv[k.i].f - f) % T.n + T.n) % T.n;
      if (o * T.step < RAZZO.near && Math.abs(k.y + 1 - S.y) < 4) { S.target = k.i; break; }
    }
  }
  const tgt = S.target >= 0 ? K[S.target] : null, step = T.step, n = T.n;
  let ahead = Infinity;
  if (tgt) {
    let o = R.priv[tgt.i].f - S.si % n;
    o = ((o % n) + n) % n;
    if (o > n / 2) o -= n;
    ahead = o * step;
  }
  if (tgt && !S.free && Math.abs(ahead) < RAZZO.seek) S.free = true;
  if (S.free && tgt) {
    const dx = tgt.x - S.x, dy = tgt.y + 1 - S.y, dz = tgt.z - S.z, l = Math.hypot(dx, dy, dz) || 1, v = RAZZO.v * dt;
    S.x += dx / l * v; S.y += dy / l * v; S.z += dz / l * v;
    S.yaw = Math.atan2(dx, dz);
    S.si = R.priv[tgt.i].f;
  } else {
    S.free = false;
    S.si += RAZZO.v * dt / step;
    // well ahead it holds the racing line; closing in it slides over to the target's side of the road
    const f = ((S.si % n) + n) % n, want = tgt && ahead < 90 ? tgt.d : T.racingLine.d[Math.round(f) % n];
    const hw = T.samples.w[Math.round(f) % n] / 2;
    S.d += clamp(clamp(want, -hw, hw) - S.d, -RAZZO.lateral * dt, RAZZO.lateral * dt);
    const P = roadPoint(R, f, S.d);
    S.yaw = Math.atan2(P.x - S.x, P.z - S.z);
    S.x = P.x; S.z = P.z; S.y = P.y + 1;
  }
  for (const k of K) {
    if (k.i === S.owner || k.finished || k.rescueT > 0 || mates(k, K[S.owner])) continue;
    if (tgt && k !== tgt) continue;
    const dx = k.x - S.x, dz = k.z - S.z;
    if (dx * dx + dz * dz <= RAZZO.r * RAZZO.r && Math.abs(k.y + 1 - S.y) < 3.5) {
      hitKart(R, k, S.owner, 'tumble', 'razzo');
      boom(R, S, 'razzo');
      return false;
    }
  }
  if (S.sweep) sweepRoad(R, S);
  if (S.t >= S.ttl) { boom(R, S, 'razzo'); return false; }
  return true;
}

// The leader's rocket clears the road as it goes: other shots and spills pop, the animals scatter.
function sweepRoad(R, S) {
  const s = R.state, r2 = RAZZO.clear * RAZZO.clear, near = (o, pad = 0) => (o.x - S.x) ** 2 + (o.z - S.z) ** 2 <= r2 + pad && Math.abs(o.y - S.y) < 5;
  const pop = (o) => { R.emit({ type: 'boom', x: o.x, y: o.y, z: o.z, kind: 'clear' }); };
  for (let i = s.shots.length - 1; i >= 0; i--) {
    const o = s.shots[i];
    if (o === S || o.kind === 'rendang' || !near(o)) continue;
    o.dead = true;
    pop(o);
  }
  for (let i = s.spills.length - 1; i >= 0; i--) {
    const o = s.spills[i];
    if (!near(o, o.r * o.r) || (o.kind === 'frana' && o.t < o.warn)) continue;
    s.spills.splice(i, 1);
    pop(o);
  }
  sweepDisasters(R, S, near);
  // the whole width of the road: a rocket passing the herd scares all of it
  const T = R.track, n = T.n, f = ((S.si % n) + n) % n, reach = RAZZO.clear / T.step + 2;
  if (R.traffic) sweepTraffic(R, f, RAZZO.clear);
  for (const G of R.hazards.groups) {
    if (G.kind === 'ice' || G.clearUntil > s.t) continue;
    const met = G.members.some((e) => { const o = Math.abs(e.i - f); return (o > n / 2 ? n - o : o) <= reach; });
    if (met) { G.clearUntil = s.t + G.period; R.emit({ type: 'boom', x: S.x, y: S.y, z: S.z, kind: 'clear' }); }
  }
}

// The pot rides over the kart. The smell drags it into the lane and up the road towards the kart ahead; at the touch it takes
// that kart's item and the victim spins. With nobody ahead, it pulls the crates in reach instead and fills the slot.
function stepRendang(R, S, dt) {
  const s = R.state, k = s.karts[S.owner], p = R.priv[S.owner], F = RENDANG;
  S.t += dt;
  S.x = k.x; S.y = k.y + 2.4; S.z = k.z; S.yaw = k.yaw;
  k.rendangT = Math.max(0, F.t - S.t);
  p.pullMul = 1;
  if (k.rendangT <= 0 || k.finished || k.rescueT > 0 || k.hitT > 0) { k.rendangT = 0; return false; }
  const ahead = rivalAhead(R, k);
  if (!ahead) {
    S.target = -1;
    if (k.item || k.rouletteT > 0) return true;
    let best = null, bd = F.boxReach * F.boxReach;
    for (const b of s.boxes) {
      if (!b.up || Math.abs(b.y - k.y) > PICK_Y * 2) continue;
      const e = (b.x - k.x) ** 2 + (b.z - k.z) ** 2;
      if (e < bd) { bd = e; best = b; }
    }
    if (!best) return true;
    best.up = false; best.respawn = BOX_RESPAWN;
    takeBox(R, k);
    k.rendangT = 0;
    return false;
  }
  if (k.rendangT > F.t) k.rendangT = F.t; // overtaken with the pot still on: it goes back to being the pot of a kart that chases
  const gap = (ahead.progress - k.progress) * R.track.length;
  if (ahead.finished || ahead.rescueT > 0 || gap > F.reach || Math.abs(ahead.y - k.y) > F.level * 3) { S.target = -1; return true; }
  S.target = ahead.i;
  const ap = R.priv[ahead.i], T = R.track;
  p.pullMul = 1 + F.pull;
  ap.slowT = 0.1;
  const push = clamp(ahead.d - k.d, -1, 1) * F.lateral * dt, i = p.i;
  k.x += T.samples.nx[i] * push; k.z += T.samples.nz[i] * push;
  if (Math.hypot(ahead.x - k.x, ahead.z - k.z) > F.touch || Math.abs(ahead.y - k.y) > F.level) return true;
  const item = ahead.rouletteT > 0 ? ap.pendingItem : ahead.item, charges = ahead.rouletteT > 0 ? itemInfo(item)?.charges ?? 0 : ahead.itemCharges;
  const res = hitKart(R, ahead, k.i, 'spin', 'rendang');
  if (res === 'immune') return true;
  if (res === 'hit' && item && !k.item && k.rouletteT <= 0) {
    k.item = item; k.itemCharges = charges;
    if (item === 'mici') k.orbit = charges;
    ahead.item = null; ahead.itemCharges = 0; ahead.orbit = 0; ahead.rouletteT = 0; ap.pendingItem = null;
    R.emit({ type: 'steal', kart: k.i, from: ahead.i, item });
  }
  k.rendangT = 0;
  p.pullMul = 1;
  return false;
}

function stepMici(R, S, dt) {
  const T = R.track;
  S.t += dt;
  S.x += Math.sin(S.yaw) * S.v * dt; S.z += Math.cos(S.yaw) * S.v * dt;
  const w = wallPush(R, S.x, S.z, S.f);
  if (w) {
    if (S.bounced) { boom(R, S, 'mici'); return false; }
    S.bounced = 1;
    S.x += w.nx * w.pen; S.z += w.nz * w.pen;
    const vx = Math.sin(S.yaw), vz = Math.cos(S.yaw), dot = vx * w.nx + vz * w.nz;
    S.yaw = Math.atan2(vx - 2 * dot * w.nx, vz - 2 * dot * w.nz);
  }
  const loc = T.nearest(S.x, S.z, S.f);
  S.f = loc.f;
  const onRoad = Math.abs(loc.d) <= T.samples.w[loc.i] / 2;
  S.y = (onRoad ? T.heightAt(loc.f, loc.d) : R.terrain.heightAt(S.x, S.z)) + 0.9;
  for (const k of R.state.karts) {
    if (k.finished || k.rescueT > 0 || k.i === S.owner) continue; // what you throw never comes back on you
    if (mates(k, R.state.karts[S.owner])) continue; // it flies past a team-mate instead of bursting on them
    const dx = k.x - S.x, dz = k.z - S.z;
    if (dx * dx + dz * dz <= MICI_SHOT.r * MICI_SHOT.r && Math.abs(k.y + 0.9 - S.y) < 3) {
      hitKart(R, k, S.owner, 'spin', 'mici');
      boom(R, S, 'mici');
      return false;
    }
  }
  if (S.t >= MICI_SHOT.ttl) return false;
  return true;
}

function stepFormaggio(R, S, dt) {
  const T = R.track, n = T.n;
  S.t += dt;
  S.si += S.dir * S.v * dt / T.step;
  S.d += clamp(-S.d, -6 * dt, 6 * dt);
  const f = ((S.si % n) + n) % n, P = roadPoint(R, f, S.d);
  S.x = P.x; S.z = P.z; S.y = P.y + 1.2; S.yaw = Math.atan2(P.tx * S.dir, P.tz * S.dir);
  for (const k of R.state.karts) {
    if (k.i === S.owner || k.finished || k.rescueT > 0) continue;
    const dx = k.x - S.x, dz = k.z - S.z;
    if (dx * dx + dz * dz <= FORMAGGIO.r * FORMAGGIO.r && Math.abs(k.y + 1 - S.y) < 3.5) {
      if (hitKart(R, k, S.owner, 'tumble', 'formaggio') === 'hit') S.hits++;
    }
  }
  return S.t < FORMAGGIO.ttl;
}

const STEP = { razzo: stepRazzo, mici: stepMici, formaggio: stepFormaggio, rendang: stepRendang };

export function stepShots(R, dt) {
  const s = R.state;
  let w = 0;
  for (let i = 0; i < s.shots.length; i++) {
    const S = s.shots[i];
    const alive = !S.dead && (S.lob ? stepLob(R, S, dt) : STEP[S.kind](R, S, dt));
    if (alive) s.shots[w++] = S;
  }
  s.shots.length = w;
}

export function stepSpills(R, dt) {
  const s = R.state;
  let w = 0;
  for (let i = 0; i < s.spills.length; i++) {
    const P = s.spills[i], was = P.t;
    P.t += dt;
    if (P.t >= P.ttl) continue;
    if (P.kind === 'frana' && P.t < P.warn) { s.spills[w++] = P; continue; }
    if (P.kind === 'frana' && was < P.warn && P.lead) R.emit({ type: 'boom', x: P.x, y: P.y, z: P.z, kind: 'frana' });
    let keep = true;
    for (const k of s.karts) {
      if (k.finished || k.rescueT > 0) continue;
      const dx = k.x - P.x, dz = k.z - P.z, rr = P.r + 1;
      if (dx * dx + dz * dz > rr * rr || Math.abs(k.y - P.y) > 3) continue;
      if (k.i === P.owner) continue; // nobody is ever hurt by their own throw, wherever they drive
      if (k.team && P.owner >= 0 && mates(k, s.karts[P.owner])) continue; // your side's puddle and rocks leave you alone
      if (P.kind === 'frana') {
        // nothing gets stuck on a rock: it bursts on whoever meets it, and the pan goes straight through
        hitKart(R, k, P.owner, 'tumble', 'frana');
        keep = false;
        R.emit({ type: 'boom', x: P.x, y: P.y, z: P.z, kind: 'rock' });
        break;
      }
      if (!k.grounded) continue;
      if (P.kind === 'polenta') {
        if (R.priv[k.i].stickyT <= 0) {
          if (hitKart(R, k, P.owner, 'slide', 'polenta') === 'hit') k.vx *= 0.82, k.vz *= 0.82;
        }
      } else if (P.kind === 'durian') {
        if (k.bigT > 0) continue;
        if (k.stinkT <= 0) R.emit({ type: 'hit', kart: k.i, by: P.owner, kind: 'stink', cause: 'durian' });
        k.stinkT = DURIAN.t;
      } else if (P.kind === 'sambal') {
        hitKart(R, k, P.owner, 'spin', 'sambal');
      }
    }
    if (keep) s.spills[w++] = P;
  }
  s.spills.length = w;
}
