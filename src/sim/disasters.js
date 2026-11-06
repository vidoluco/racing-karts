// The real natural hazards of each place, as the big moment of a race. A track only says where and what (def.disasters);
// when, and which lane stays free, comes from a seeded stream of its own, so nothing else in the race changes because of it.
// Every disaster has three phases: warn (a shadow, a rumble and a sign, nothing can hurt yet), strike and after (what it left
// on the road). One lane stays free all the way through, and a hit is a tumble you get up from.
// See 'Natural disasters' in the spec for how to add one to a track.

import { clamp } from './tuning.js';
import { hitKart } from './items.js';
import { createRng, mixSeed } from './rng.js';

// warn, strike, after: s. arrive: s into the strike the kart it was timed for reaches the site. speed: m/s of a flow's front.
// len: m of road. source: m uphill the flow starts from, seen coming during the warning. ash, shake: 0..1 at the strike.
export const DISASTER_KINDS = {
  debris: { warn: 3, strike: 3.8, after: 55, arrive: 1.3, flow: true, speed: 11, len: 38, source: 90, stay: 'mud' },
  avalanche: { warn: 3.2, strike: 3.2, after: 50, arrive: 1, flow: true, speed: 17, len: 48, source: 120 },
  lahar: { warn: 3.4, strike: 9, after: 45, arrive: 1.6, flow: true, speed: 7, len: 40, source: 100, stay: 'mud', ash: 0.45, head: 4 },
  banjir: { warn: 3.6, strike: 9, after: 40, arrive: 1.6, flow: true, speed: 6.5, len: 46, source: 70, stay: 'mud', head: 3.2 },
  rockfall: { warn: 2.6, strike: 3.6, after: 40, arrive: 0.8, len: 46 },
  quake: { warn: 2.6, strike: 5.5, after: 8, arrive: 1.4, len: 120, shake: 1 },
  eruption: { warn: 3, strike: 8, after: 16, arrive: 1.2, len: 180, ash: 1, slalom: true },
  cloud: { warn: 3, strike: 14, after: 30, arrive: 0, len: 0, ash: 0.3, free: true },
};

const GAP_MIN = 5.5;       // m of road always left free, and at least 42% of it
const GAP_SHARE = 0.42;
const KART_SIDE = 1.1;     // m from a kart's centre to its flank
const AIR = 2.4;           // m over the ground: a kart that high jumps over a flow
const LEVEL = 6;           // m: a road above or below the site is not in it
const SHADOW_LEAD = 2.1;   // s every falling thing marks its spot on the road before it lands
const MIN_GAP_S = 14;      // s of quiet between the end of one strike and the next warning
const FIRST_PROGRESS = 0.3;// nothing while the pack is still sorting itself out
const LAST_PROGRESS = 0.04;// nor in the last few metres to the flag

const wrapI = (i, n) => ((i % n) + n) % n;
const wrapO = (o, n) => { o = ((o % n) + n) % n; return o > n / 2 ? o - n : o; };

// Where the free lane is, m left of the centre, `along` m past the middle of the site.
export function disasterGap(D, along = 0) {
  return D.gapAmp ? D.gapD + D.gapAmp * Math.sin((along / D.gapWave) * Math.PI * 2) : D.gapD;
}

// How many a race gets: a 3 lap race has two. A long track has one lap and several places.
export function disasterCount(track, laps) {
  if (track.long) return Math.min(3, Math.max(1, Math.round(track.length / 3500)));
  return laps >= 5 ? 3 : laps >= 3 ? 2 : 1;
}

// A def's protected places, as points: nothing is ever thrown at a church or a temple. { x, z, r } or { u, d, r }.
export function sacredPoints(track) {
  return (track.def.sacred || []).map((q) => {
    if (q.x !== undefined) return { x: q.x, z: q.z, r: q.r };
    const P = track.pointAt(q.u);
    return { x: P.x + P.nx * (q.d ?? 0), z: P.z + P.nz * (q.d ?? 0), r: q.r };
  });
}

// The entries of a track, checked and with their numbers filled in. Pure: the renderer reads them too, to build signs and gullies.
export function disasterEntries(track) {
  const sacred = sacredPoints(track), n = track.n, S = track.samples;
  return (track.def.disasters || []).map((e, index) => {
    const K = DISASTER_KINDS[e.kind];
    const where = `track ${track.def.id}, disaster ${e.name ?? index}`;
    if (!K) throw new Error(`${where}: unknown kind ${e.kind}`);
    if (!e.name) throw new Error(`${where}: needs its local name`);
    const c = wrapI(Math.round(((e.u % 1) + 1) % 1 * n), n), len = e.len ?? K.len, reach = Math.ceil((len / 2) / track.step);
    if (!K.free) {
      for (let o = -reach; o <= reach; o += 2) {
        const st = track.structureAt(wrapI(c + o, n));
        if (st === 'tunnel' || (K.flow && st)) throw new Error(`${where}: cannot come down on a ${st}`);
        const i = wrapI(c + o, n);
        for (const q of sacred) if (Math.hypot(S.x[i] - q.x, S.z[i] - q.z) < q.r + 6) throw new Error(`${where}: too close to a protected place`);
      }
    }
    const side = e.side ?? 0;
    // the flow's start, up the hill: it stops short of any protected place
    let source = e.source ?? K.source ?? 0;
    if (K.flow) {
      for (const s of side ? [side] : [-1, 1]) {
        for (let m = 0; m < source; m += 6) {
          const d = s * (S.w[c] / 2 + m), x = S.x[c] + S.nx[c] * d, z = S.z[c] + S.nz[c] * d;
          if (sacred.some((q) => Math.hypot(x - q.x, z - q.z) < q.r + len / 2 + 10)) { source = Math.max(10, m - 6); break; }
        }
      }
    }
    return { ...e, index, c, len, source, side, warn: e.warn ?? K.warn, strike: e.strike ?? K.strike, after: e.after ?? K.after };
  });
}

// When: the whole race cut into windows, one disaster in each, on a pass of the kart it is timed for past its place.
function planSlots(track, entries, laps, rng) {
  if (!entries.length) return [];
  const count = disasterCount(track, laps), from = FIRST_PROGRESS, to = laps - LAST_PROGRESS, span = (to - from) / count, slots = [];
  const order = entries.slice();
  for (let i = order.length - 1; i > 0; i--) { const j = rng.int(i + 1); [order[i], order[j]] = [order[j], order[i]]; }
  for (let s = 0; s < count; s++) {
    const a = from + s * span, b = a + span;
    for (let tries = 0; tries < order.length; tries++) {
      const e = order[(s + tries) % order.length], u = e.c / track.n, passes = [];
      for (let lap = 0; lap < laps; lap++) if (lap + u >= a && lap + u < b) passes.push(lap + u);
      if (!passes.length) continue;
      slots.push({ entry: e.index, pass: passes[rng.int(passes.length)], slot: s });
      break;
    }
  }
  return slots;
}

export function createDisasters(track, seed, laps) {
  const entries = disasterEntries(track), rng = createRng(mixSeed(seed, 7));
  return { entries, rng, slots: planSlots(track, entries, laps, rng), next: 0, nextId: 1, quietUntil: 0 };
}

function groundAt(R, i, d) {
  const T = R.track, S = T.samples, hw = S.w[i] / 2;
  if (Math.abs(d) <= hw) return T.heightAt(i, d);
  return R.terrain.heightAt(S.x[i] + S.nx[i] * d, S.z[i] + S.nz[i] * d);
}

// One falling or rolling thing. It is at fromD when its flight starts, at d at t0; it can hurt once it is down.
function addPiece(R, D, along, d, o) {
  const T = R.track, S = T.samples, n = T.n, i = wrapI(D.c + Math.round(along / T.step), n);
  if (T.structureAt(i) === 'tunnel') return null;
  const x = S.x[i] + S.nx[i] * d, z = S.z[i] + S.nz[i] * d;
  const P = {
    id: R.disasters.nextId++, role: o.role, i, along, d, fromD: o.fromD ?? d, r: o.r ?? 1.8, t0: o.t0, dur: o.dur ?? 2, arc: o.arc ?? 0, bounce: o.bounce ?? 0,
    gx: x, gy: groundAt(R, i, d), gz: z, x, y: 0, z, left: o.t0, a: 0, st: 0, yaw: (o.yaw ?? 0),
  };
  movePiece(R, D, P);
  D.pieces.push(P);
  return P;
}

function movePiece(R, D, P) {
  const T = R.track, S = T.samples, i = P.i, a = clamp((D.t - (P.t0 - P.dur)) / P.dur, 0, 1), d = P.fromD + (P.d - P.fromD) * a;
  const lift = P.bounce ? P.arc * Math.abs(Math.cos(a * Math.PI * (P.bounce + 0.5))) * (1 - a) : P.arc * (1 - a * a);
  P.a = a; P.left = P.t0 - D.t;
  P.x = S.x[i] + S.nx[i] * d; P.z = S.z[i] + S.nz[i] * d; P.y = groundAt(R, i, d) + lift;
}

// A free lane wherever it says, at most this far off the middle of the road.
const laneRoom = (hw, gapW) => Math.max(0, hw - gapW / 2 - 0.4);

function fillPieces(R, D, K) {
  const T = R.track, S = T.samples, rng = R.disasters.rng, w = S.w[D.c], hw = w / 2, gw = D.gapW;
  const clear = (along, d, r) => Math.abs(d - disasterGap(D, along)) >= gw / 2 + r + 0.25;
  if (D.kind === 'debris' || D.kind === 'lahar' || D.kind === 'avalanche' || D.kind === 'banjir') {
    const covered = hw + 4, far = D.stop, count = D.kind === 'debris' ? 11 : D.kind === 'lahar' || D.kind === 'banjir' ? 7 : 9;
    const speed = D.speed;
    for (let q = 0; q < count; q++) {
      const along = (q / (count - 1) - 0.5) * D.len * 0.9 + rng.range(-2, 2), role = D.kind === 'avalanche' ? 'bank' : D.kind === 'banjir' || q % 5 === 2 ? 'log' : 'boulder';
      const r = role === 'bank' ? rng.range(1.9, 2.5) : role === 'log' ? 1.3 : rng.range(1.2, 2.1);
      // the lumps stay on the side the flow came from, spread so that bursting through always meets something
      const span = Math.abs(far - D.side * covered) - r, d = far + D.side * (r + 0.4 + rng.next() * span * 0.8);
      if (!clear(along, d, r) || Math.abs(d) > hw + 3) continue;
      const atEdge = D.warn + (Math.abs(D.side * hw - d) / speed) + rng.range(0, 0.25);
      addPiece(R, D, along, d, { role, r, fromD: D.side * (hw + 16), t0: atEdge, dur: 16 / speed + Math.abs(D.side * hw - d) / speed, arc: role === 'bank' ? 0.5 : 1.5, bounce: role === 'bank' ? 0 : 2, yaw: rng.range(0, 6.28) });
    }
  } else if (D.kind === 'rockfall') {
    [-17, 0, 17].forEach((al, j) => {
      const along = al + rng.range(-3, 3);
      for (const [x, r] of besideGap(D, along, hw, rng, 1.5, 2.2)) {
        if (rng.next() < 0.1) continue;
        const t0 = D.warn + j * 0.45 + rng.range(0, 1.4);
        addPiece(R, D, along, x, { role: 'boulder', r, fromD: D.side * (hw + rng.range(18, 34)), t0, dur: rng.range(1.6, 2.1), arc: rng.range(7, 11), bounce: 2, yaw: rng.range(0, 6.28) });
      }
    });
  } else if (D.kind === 'quake') {
    // roof tiles and rocks along the stretch, each with its shadow first; the crack has the middle of it
    for (let al = -D.len / 2 + 10; al < D.len / 2 - 6; al += 13) {
      if (Math.abs(al) < 7) continue;
      const along = al + rng.range(-2, 2);
      for (const [x, r] of besideGap(D, along, hw, rng, 1.05, 1.5)) {
        if (rng.next() < 0.3) continue;
        const role = r < 1.25 ? 'tile' : 'boulder', t0 = D.warn + rng.range(0.1, D.strike - 1);
        addPiece(R, D, along, x, { role, r, t0, dur: SHADOW_LEAD, arc: role === 'tile' ? 20 : 26, fromD: x + rng.range(-4, 4), yaw: rng.range(0, 6.28) });
      }
    }
  } else if (D.kind === 'eruption') {
    // the crater throws them from its side of the road; the shadow marks each spot well before
    const from = D.side || 1;
    for (let al = -D.len / 2 + 8; al < D.len / 2; al += 12) {
      const along = al + rng.range(-3, 3);
      for (const [x, r] of besideGap(D, along, hw, rng, 1.4, 2)) {
        if (rng.next() < 0.22) continue;
        const t0 = D.warn + rng.range(0, D.strike - 1.5);
        addPiece(R, D, along, x, { role: 'bomb', r, t0, dur: Math.max(SHADOW_LEAD, rng.range(2.1, 2.7)), arc: rng.range(42, 60), fromD: x + from * rng.range(26, 46), yaw: rng.range(0, 6.28) });
      }
    }
  }
}

// Spots on the road outside the free lane, as many as fit on each side of it: [lateral, radius]. A narrow road just gets smaller stones.
function besideGap(D, along, hw, rng, r0, r1) {
  const gap = disasterGap(D, along), out = [], half = D.gapW / 2 + 0.25;
  for (const s of [-1, 1]) {
    let from = gap + s * half;
    const edge = s * (hw + 0.4);
    for (let q = 0; q < 3; q++) {
      const room = (edge - from) * s, r = Math.min(rng.range(r0, r1), room / 2);
      if (r < r0 * 0.72) break;
      const x = from + s * r;
      out.push([x, r]);
      from = x + s * (r + rng.range(0.6, 1.6));
    }
  }
  return out;
}

// Sets one off now: the way the schedule does it, and the way tests and tools do (race.disaster(index)).
export function fireDisaster(R, entryIndex) {
  const P = R.disasters, e = P.entries[entryIndex], s = R.state, T = R.track, S = T.samples;
  if (!e) throw new Error(`no disaster ${entryIndex} on ${T.def.id}`);
  const K = DISASTER_KINDS[e.kind], rng = P.rng, hw = S.w[e.c] / 2, gapW = e.gapW ?? Math.min(S.w[e.c] - 2.6, Math.max(GAP_MIN, S.w[e.c] * GAP_SHARE));
  const side = e.side || (rng.next() < 0.5 ? -1 : 1), room = laneRoom(hw, gapW);
  const D = {
    id: P.nextId++, entry: e.index, kind: e.kind, name: e.name, say: e.say ?? null, phase: 'warn', t: 0, warn: e.warn, strike: e.strike, after: e.after,
    c: e.c, len: e.len, side, gapW, gapD: 0, gapAmp: 0, gapWave: 1, free: !!K.free, flow: !!K.flow, speed: e.speed ?? K.speed ?? 0, source: e.source,
    front: 0, stop: 0, open: 0, ash: 0, shake: 0, pieces: [], struck: [], stuck: [],
    x: S.x[e.c], y: S.y[e.c], z: S.z[e.c], lane: 0,
  };
  if (K.flow) {
    // the far lane stays free: the front stops short of it
    D.gapD = -side * room;
    D.stop = D.gapD + side * gapW / 2;
    D.front = side * (hw + e.source);
  } else if (K.slalom) {
    D.gapAmp = Math.max(0, room - 0.2);
    D.gapWave = e.wave ?? 130;
    D.gapD = 0;
  } else if (!K.free) {
    const lanes = [-room, 0, room];
    D.gapD = lanes[rng.int(3)];
    D.stop = D.gapD + side * gapW / 2;
  }
  D.lane = Math.abs(D.gapD) < 1 ? 0 : D.gapD > 0 ? 1 : -1;
  for (const k of s.karts) { D.struck[k.i] = 0; D.stuck[k.i] = -9; }
  fillPieces(R, D, K);
  s.disasters.push(D);
  P.quietUntil = s.t + D.warn + D.strike + MIN_GAP_S;
  R.emit({ type: 'disaster', phase: 'warn', id: D.id, entry: D.entry, kind: D.kind, name: D.name, say: D.say, lane: D.free ? null : D.lane, x: D.x, y: D.y, z: D.z, warn: D.warn });
  return D;
}

// The kart a disaster is timed for: humans first, so that every player gets to meet one head on.
function witnessOf(R, slot) {
  const open = R.order.filter((k) => !k.finished), humans = open.filter((k) => k.human);
  if (humans.length) return slot % 2 ? humans[humans.length - 1] : humans[0];
  return open[0] ?? null;
}

function schedule(R) {
  const P = R.disasters, s = R.state;
  if (s.phase !== 'race' || P.next >= P.slots.length || s.t < P.quietUntil) return;
  const slot = P.slots[P.next], e = P.entries[slot.entry], w = witnessOf(R, slot.slot);
  if (!w) return;
  // it has gone by: the next pass, if the race still has one
  if (w.progress > slot.pass + 0.01) {
    slot.pass += 1;
    if (slot.pass >= s.laps - LAST_PROGRESS) P.next++;
    return;
  }
  const K = DISASTER_KINDS[e.kind], lead = Math.max(w.speed, 20) * (e.warn + K.arrive);
  if (w.progress >= slot.pass - lead / R.track.length) { fireDisaster(R, slot.entry); P.next++; }
}

function stepFront(R, D, K, dt) {
  const hw = R.track.samples.w[D.c] / 2, side = D.side;
  if (D.phase === 'warn') {
    // down the hill, reaching the road's edge just as the warning ends
    const a = clamp(D.t / D.warn, 0, 1);
    D.front = side * (hw + D.source * (1 - a * a * (3 - 2 * a) * 0.5 - a * 0.5));
  } else {
    const target = D.stop, step = D.speed * dt;
    D.front = side > 0 ? Math.max(target, D.front - step) : Math.min(target, D.front + step);
  }
}

// The flow's hits. Each kart is thrown once by each flow, or a slow kart in the mud would be thrown again for as long as it stays.
function collideFlow(R, D, K) {
  const T = R.track, n = T.n, s = R.state;
  for (const k of s.karts) {
    if (k.finished || k.rescueT > 0 || k.shortcut >= 0) continue;
    const p = R.priv[k.i], along = wrapO(p.f - D.c, n) * T.step;
    if (Math.abs(along) > D.len / 2 + 1 || Math.abs(k.y - S0(T, D)) > LEVEL || k.y - p.ground > AIR) continue;
    const reach = (k.d - D.front) * D.side;
    if (reach < -KART_SIDE) continue;
    if (D.phase === 'strike') {
      const head = K.head;
      if (head && reach > head) {
        // behind the head of a lahar: it pulls you along and sticks, it does not throw
        p.stickyT = Math.max(p.stickyT, 0.2);
        const nx = T.samples.nx[p.i], nz = T.samples.nz[p.i], push = -D.side * 3.4 / 60;
        k.x += nx * push; k.z += nz * push;
        continue;
      }
      if (!D.struck[k.i]) {
        D.struck[k.i] = 1;
        hitKart(R, k, -1, 'tumble', D.kind);
      }
    } else if (K.stay === 'mud' && k.bigT <= 0) {
      p.stickyT = Math.max(p.stickyT, 0.2);
      if (s.t - D.stuck[k.i] > 3) { D.stuck[k.i] = s.t; R.emit({ type: 'hit', kart: k.i, by: -1, kind: 'slide', cause: D.kind }); }
    }
  }
}
const S0 = (T, D) => T.samples.y[D.c];

// The crack opens under whoever is on it; the far lane has none.
function collideCrack(R, D) {
  const T = R.track, n = T.n;
  if (D.open < 0.3) return;
  for (const k of R.state.karts) {
    if (k.finished || k.rescueT > 0 || k.shortcut >= 0 || D.struck[k.i]) continue;
    const p = R.priv[k.i], along = wrapO(p.f - D.c, n) * T.step;
    if (Math.abs(along) > 3.2 || k.y - p.ground > AIR || Math.abs(k.y - S0(T, D)) > LEVEL) continue;
    if ((k.d - D.stop) * D.side < -KART_SIDE) continue;
    D.struck[k.i] = 1;
    hitKart(R, k, -1, 'tumble', D.kind);
  }
}

function collidePieces(R, D) {
  const s = R.state, T = R.track, n = T.n;
  let w = 0;
  for (let q = 0; q < D.pieces.length; q++) {
    const P = D.pieces[q];
    if (D.t < P.t0 - P.dur - SHADOW_LEAD) { D.pieces[w++] = P; continue; }
    movePiece(R, D, P);
    if (P.st === 0 && D.t >= P.t0) {
      P.st = 1;
      R.emit({ type: 'boom', x: P.gx, y: P.gy, z: P.gz, kind: P.role });
    }
    let keep = true;
    if (P.st === 1) {
      for (const k of s.karts) {
        if (k.finished || k.rescueT > 0 || k.shortcut >= 0) continue;
        const dx = k.x - P.x, dz = k.z - P.z, rr = P.r + 1;
        if (dx * dx + dz * dz > rr * rr || Math.abs(k.y - P.y) > 3) continue;
        if (Math.abs(wrapO(k.trackI - P.i, n)) > 40) continue;
        if (P.role === 'bank') {
          // a snow bank bursts: slower, covered in snow, still going
          if (k.bigT <= 0 && k.safeT <= 0) { k.vx *= 0.62; k.vz *= 0.62; k.safeT = 0.7; R.emit({ type: 'hit', kart: k.i, by: -1, kind: 'slide', cause: D.kind }); }
        } else hitKart(R, k, -1, 'tumble', D.kind);
        R.emit({ type: 'boom', x: P.x, y: P.y, z: P.z, kind: P.role === 'bank' ? 'snow' : 'rock' });
        keep = false;
        break;
      }
    }
    if (keep) D.pieces[w++] = P;
  }
  D.pieces.length = w;
}

export function stepDisasters(R, dt) {
  const s = R.state;
  schedule(R);
  let ash = 0, shake = 0, w = 0;
  for (let q = 0; q < s.disasters.length; q++) {
    const D = s.disasters[q], K = DISASTER_KINDS[D.kind];
    D.t += dt;
    if (D.phase === 'warn' && D.t >= D.warn) {
      D.phase = 'strike';
      R.emit({ type: 'disaster', phase: 'strike', id: D.id, kind: D.kind, x: D.x, y: D.y, z: D.z });
    } else if (D.phase === 'strike' && D.t >= D.warn + D.strike) {
      D.phase = 'after';
    }
    if (D.t >= D.warn + D.strike + D.after) {
      R.emit({ type: 'disaster', phase: 'end', id: D.id, kind: D.kind });
      continue;
    }
    const inStrike = clamp((D.t - D.warn) / 0.8, 0, 1), left = D.warn + D.strike - D.t, fading = clamp(left / 1.2, 0, 1);
    if (K.flow) stepFront(R, D, K, dt);
    if (D.kind === 'quake') {
      D.open = clamp((D.t - D.warn) / 0.5, 0, 1) * clamp(left / 0.8, 0, 1);
      collideCrack(R, D);
    }
    if (D.phase !== 'warn' && K.flow) collideFlow(R, D, K);
    if (D.pieces.length) collidePieces(R, D);
    // what the whole road feels: a rising shake on the warning, ash that builds and takes its time to clear
    const rise = clamp(D.t / D.warn, 0, 1);
    D.shake = K.shake ? (D.phase === 'warn' ? 0.28 * rise : D.phase === 'strike' ? 0.28 + 0.72 * inStrike * fading : 0) : 0;
    D.ash = K.ash ? K.ash * (D.phase === 'warn' ? 0.4 * rise : D.phase === 'strike' ? 0.4 + 0.6 * inStrike : clamp(1 - (D.t - D.warn - D.strike) / D.after * 1.4, 0, 1)) : 0;
    ash = Math.max(ash, D.ash); shake = Math.max(shake, D.shake);
    s.disasters[w++] = D;
  }
  s.disasters.length = w;
  s.ash = ash; s.quake = shake;
}

// The leader's rocket sweeps what is left on the road. The flow itself it cannot stop.
export function sweepDisasters(R, S, near) {
  for (const D of R.state.disasters) {
    let w = 0;
    for (let q = 0; q < D.pieces.length; q++) {
      const P = D.pieces[q];
      if (P.st === 1 && near(P, P.r * P.r)) { R.emit({ type: 'boom', x: P.x, y: P.y, z: P.z, kind: 'clear' }); continue; }
      D.pieces[w++] = P;
    }
    D.pieces.length = w;
  }
}
