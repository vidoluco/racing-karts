// Caccia alla Forma: one wheel of mountain cheese on the road, about three minutes, whoever has held it longest wins. The road is
// the arena whatever its length: a loose wheel rolls on ahead by itself, karts behind it are pulled on, karts ahead of it are held
// back, and a kart lost too far away is flown back by the stork, so eight karts stay one scrum round the wheel on 1.5 km and on 10 km
// alike. Only exists in a race that asked for it: no state, no cost and no effect on any other.
//
// It listens to the race's events instead of being called from the items: any way a kart can get hurt, today's or tomorrow's, drops it.
import { DT, FORMA, G, clamp } from './tuning.js';
import { startRescue } from './kart.js';

export const FORMA_LAPS = 9999;     // nobody ever finishes on laps here: the clock ends it

// What createDisasters plans with: as many laps as the pack covers in the time, at the road's cruising pace.
export const formaPlannedLaps = (track, duration) => Math.max(1, Math.round(duration * FORMA.pace / track.length));

const options = (o) => ({ duration: o && o !== true && o.duration > 0 ? o.duration : FORMA.duration });

export function createForma(R, opt) {
  const { duration } = options(opt);
  const s = R.state, T = R.track, n = T.n, S = T.samples, K = s.karts, N = K.length;
  const pole = R.priv[0];
  const f0 = (pole.f + FORMA.lead / T.step) % n;
  const strayAt = Math.min(FORMA.stray, T.length * FORMA.strayShare);
  const w = {
    x: 0, y: 0, z: 0, px: 0, py: 0, pz: 0, yaw: 0, roll: 0, f: f0, d: 0, v: 0, h: 0, vh: 0, t: 0,
    lockKart: -1, lockT: 0, lockAll: 0, last: -1, grace: 0,
  };
  const F = {
    duration, left: duration, holder: -1, over: false, wheel: w,
    held: new Array(N).fill(0), best: new Array(N).fill(0), streak: new Array(N).fill(0), grabs: new Array(N).fill(0), drops: new Array(N).fill(0),
    rank: K.map((_, i) => i + 1), gaps: new Array(N).fill(0),
  };
  const order = K.map((_, i) => i), strayT = new Array(N).fill(0), press = new Array(N).fill(0);
  let lastLead = -1, tick = 11, lastCalled = false, sway = 0;
  s.forma = F;

  // every event of the race goes past here: nobody has laps to chime for or places on the road to brag about
  const pending = [], emit = R.emit;
  R.emit = (e) => {
    if (e.type === 'lap' || e.type === 'overtake') return;
    emit(e);
    if ((e.type === 'hit' && e.kart === F.holder) || (e.type === 'rescue' && e.kart === F.holder) || (e.type === 'bump' && (e.a === F.holder || e.b === F.holder))) pending.push(e);
  };

  // m along the road from f to the wheel, + when the wheel is ahead
  const gapFrom = (f) => { let o = (w.f - f) % n; if (o < 0) o += n; if (o > n / 2) o -= n; return o * T.step; };

  function placeOnRoad() {
    const a = Math.floor(w.f) % n, b = (a + 1) % n, q = w.f - Math.floor(w.f);
    w.x = S.x[a] + (S.x[b] - S.x[a]) * q + S.nx[a] * w.d;
    w.z = S.z[a] + (S.z[b] - S.z[a]) * q + S.nz[a] * w.d;
    w.y = T.heightAt(w.f, w.d) + FORMA.radius + w.h;
    w.yaw = Math.atan2(S.tx[a], S.tz[a]);
  }

  function drop(cause, by) {
    const h = F.holder, k = K[h], p = R.priv[h];
    F.holder = -1;
    F.streak[h] = 0;
    F.drops[h]++;
    w.f = ((cause === 'rescue' ? p.lastGoodF : p.f) % n + n) % n;
    const i = Math.round(w.f) % n, hw = S.w[i] / 2 - FORMA.edge;
    w.d = clamp(k.d, -hw, hw);
    // it jumps off and runs ahead of whoever lost it, at least as fast as they were going, and comes down to its own pace
    w.v = clamp(Math.abs(k.speed), FORMA.roll, FORMA.popMax);
    w.h = 1.2; w.vh = FORMA.pop; w.t = 0;
    w.lockKart = h; w.lockT = FORMA.lockOwner; w.lockAll = FORMA.lockAll; w.last = h;
    placeOnRoad();
    R.emit({ type: 'formaDrop', kart: h, by: by ?? -1, cause, x: k.x, y: k.y + 1, z: k.z });
    R.emit({ type: 'boom', x: k.x, y: k.y + 1.6, z: k.z, kind: 'clear' });
  }

  function grab(k) {
    const from = w.last;
    F.holder = k.i;
    F.grabs[k.i]++;
    F.streak[k.i] = 0;
    w.grace = FORMA.ramGrace; w.t = 0; w.h = 0; w.vh = 0;
    k.safeT = Math.max(k.safeT, FORMA.grabSafe);
    R.emit({ type: 'formaGrab', kart: k.i, from, x: w.x, y: w.y, z: w.z });
  }

  function roll() {
    w.t += DT;
    w.lockT = Math.max(0, w.lockT - DT); w.lockAll = Math.max(0, w.lockAll - DT);
    const i = Math.round(w.f) % n, u = S.y[(i + 3) % n] - S.y[(i - 3 + n) % n], slope = u / (6 * T.step);
    // downhill it runs away, uphill it gives up: a thing that rolls, not a thing on rails
    const want = FORMA.roll * clamp(1 - slope * FORMA.rollHill, 0.72, 1.3);
    w.v += (want - w.v) * (1 - Math.exp(-FORMA.rollEase * DT));
    w.f = (w.f + w.v * DT / T.step) % n;
    w.roll += w.v * DT / FORMA.radius;
    sway += DT;
    const hw = S.w[i] / 2 - FORMA.edge, lane = Math.sin(sway * FORMA.swayRate) * hw * FORMA.sway;
    w.d += clamp(lane - w.d, -FORMA.swayV * DT, FORMA.swayV * DT);
    w.d = clamp(w.d, -hw, hw);
    w.vh -= G * DT; w.h += w.vh * DT;
    if (w.h <= 0) { w.h = 0; w.vh = w.vh < -FORMA.bounceMin ? -w.vh * FORMA.bounce : 0; }
    placeOnRoad();
  }

  function tryGrab() {
    if (w.lockAll > 0) return;
    let who = null, best = FORMA.reach * FORMA.reach;
    for (const k of K) {
      if (k.finished || k.rescueT > 0 || k.hitT > 0 || (k.i === w.lockKart && w.lockT > 0)) continue;
      if (Math.abs(k.y + 1 - w.y) > FORMA.level) continue;
      const dx = k.x - w.x, dz = k.z - w.z, e = dx * dx + dz * dz;
      if (e < best) { best = e; who = k; }
    }
    if (who) grab(who);
  }

  function ride() {
    const h = F.holder, k = K[h], p = R.priv[h];
    w.f = ((p.f % n) + n) % n; w.d = k.d;
    w.x = k.x; w.y = k.y + 2.2; w.z = k.z; w.yaw = k.yaw;
    if (F.over) return;
    w.grace = Math.max(0, w.grace - DT);
    F.held[h] += DT;
    F.streak[h] += DT;
    if (F.streak[h] > F.best[h]) F.best[h] = F.streak[h];
  }

  function listen() {
    while (pending.length) {
      const e = pending.shift(), h = F.holder;
      if (h < 0) break;
      if (e.type === 'hit' && e.kart === h) drop('hit', e.by);
      else if (e.type === 'rescue' && e.kart === h) drop('rescue', -1);
      else if (e.type === 'bump' && (e.a === h || e.b === h)) {
        const o = K[e.a === h ? e.b : e.a], k = K[h];
        // a shove from someone going much faster, or on a turbo: the wheel is heavy, not nailed down
        if (w.grace > 0 || k.safeT > 0 || k.bigT > 0) continue;
        if (e.force >= FORMA.ramForce || o.boostT > 0) drop('ram', o.i);
      }
    }
    pending.length = 0;
  }

  // Sitting on the holder's bumper works too: soft contact pushes without ever being a bump, so it is timed. Half a lap in a convoy is no chase.
  function shove() {
    const h = F.holder;
    if (h < 0) { press.fill(0); return; }
    const k = K[h], free = w.grace <= 0 && k.safeT <= 0 && k.bigT <= 0 && k.rescueT <= 0;
    for (const o of K) {
      if (o === k) continue;
      const dx = o.x - k.x, dz = o.z - k.z, on = free && o.hitT <= 0 && o.rescueT <= 0 && dx * dx + dz * dz < FORMA.touch * FORMA.touch && Math.abs(o.y - k.y) < 2.6;
      press[o.i] = on ? press[o.i] + DT : Math.max(0, press[o.i] - DT * 0.5);
      if (press[o.i] >= FORMA.pressT) { press.fill(0); drop('ram', o.i); return; }
    }
  }

  // Longest held first, then the longest single hold; a kart index only so that the order is total.
  function ranks() {
    const before = (a, b) => F.held[a] - F.held[b] || F.best[a] - F.best[b] || b - a;
    for (let i = 1; i < N; i++) {
      const x = order[i];
      let j = i - 1;
      while (j >= 0 && before(x, order[j]) > 0) { order[j + 1] = order[j]; j--; }
      order[j + 1] = x;
    }
    // nobody is sixth with nothing to show for it: all those with no time yet share the next place, until the end, where each has its own
    let had = 0;
    for (let i = 0; i < N; i++) { const q = order[i]; if (F.held[q] > 0) had = i + 1; F.rank[q] = F.over || F.held[q] > 0 ? i + 1 : had + 1; }
    if (F.held[order[0]] > 0 && order[0] !== lastLead) { lastLead = order[0]; R.emit({ type: 'formaLead', kart: lastLead }); }
  }

  // How much of its top speed a kart has now: stepKart reads p.rubber, for a human too.
  function pace() {
    for (const k of K) {
      const p = R.priv[k.i];
      if (k.finished) { p.rubber = 0; continue; }
      if (k.i === F.holder) {
        F.gaps[k.i] = 0;
        p.rubber = -(FORMA.heavy + FORMA.heavyMore * Math.min(FORMA.heavyCap, F.streak[k.i] / FORMA.heavyT) + (F.rank[k.i] === 1 ? FORMA.heavyLead : 0));
        continue;
      }
      const gap = gapFrom(p.f);
      F.gaps[k.i] = gap;
      p.rubber = gap >= 0
        ? FORMA.near + (FORMA.chase - FORMA.near) * clamp((gap - FORMA.chaseFrom) / FORMA.chaseReach, 0, 1)
        : -FORMA.leash * clamp((-gap - FORMA.leashFrom) / FORMA.leashReach, 0, 1);
    }
  }

  function strays() {
    for (const k of K) {
      if (k.i === F.holder || k.finished || k.rescueT > 0) { strayT[k.i] = 0; continue; }
      strayT[k.i] = Math.abs(F.gaps[k.i]) > strayAt ? strayT[k.i] + DT : 0;
      if (strayT[k.i] < FORMA.strayT) continue;
      strayT[k.i] = 0;
      const p = R.priv[k.i];
      p.lastGoodF = ((w.f - FORMA.strayBack / T.step) % n + n) % n;
      R.emit({ type: 'formaFetch', kart: k.i });
      startRescue(R, k, p);
    }
  }

  function clock() {
    F.left = Math.max(0, F.left - DT);
    if (!lastCalled && F.left <= FORMA.lastCall && duration > FORMA.lastCall * 1.5) { lastCalled = true; R.emit({ type: 'formaLast', left: FORMA.lastCall }); }
    const c = Math.ceil(F.left);
    if (c < tick && c > 0 && c <= 10) { tick = c; R.emit({ type: 'formaTick', n: c }); }
    if (F.left > 0) return;
    // time: the table is the finish, and the wheel goes to whoever earned it
    F.over = true;
    ranks();
    const winner = order[0];
    R.emit({ type: 'formaEnd', winner, held: F.held[winner] });
    F.holder = winner;
    for (const i of order) R.finishKart(K[i]);
  }

  placeOnRoad();
  w.px = w.x; w.py = w.y; w.pz = w.z;

  return {
    state: F,
    step() {
      w.px = w.x; w.py = w.y; w.pz = w.z;
      if (F.over) { ride(); return; }
      if (s.phase !== 'race') return;
      listen();
      shove();
      if (F.holder >= 0) ride(); else { roll(); tryGrab(); if (F.holder >= 0) ride(); }
      ranks();
      pace();
      strays();
      clock();
    },
    // ---------- what the items and the bots ask ----------
    // The razzo goes for the wheel: from anywhere near the scrum, also backwards through the air. Null: no holder to go for, the usual rules.
    razzoAim(k) {
      const h = F.holder;
      if (h < 0 || h === k.i) return null;
      const gap = gapFrom(R.priv[k.i].f);
      if (Math.abs(gap) > FORMA.razzoReach) return null;
      return { target: h, free: gap < 0 };
    },
    franaAim(k) { return F.holder >= 0 && F.holder !== k.i ? K[F.holder] : null; },
    // Where a bot wants to be across the road: into the wheel or into its holder once it is close, in front of it as well as behind.
    botLane(k, p, B, lineD, want) {
      if (k.i === F.holder || B.route >= 0) return want;
      const gap = gapFrom(p.f);
      if (Math.abs(gap) > FORMA.botSee) return want;
      const aim = (F.holder >= 0 ? K[F.holder].d : w.d) - lineD, share = B.cfg.corner * clamp(1.4 - Math.abs(gap) / FORMA.botSee, 0, 1);
      return want * (1 - share) + aim * share;
    },
    // Just ahead of the wheel the thing to do is lift, and let it come: it rolls slower than any kart.
    botThrottle(k, p, inp) {
      if (k.i === F.holder || (k.i === w.lockKart && w.lockT > 0)) return;
      const gap = gapFrom(p.f);
      if (gap >= 0 || gap < -FORMA.botWait) return;
      const v = F.holder >= 0 ? K[F.holder].speed : w.v;
      inp.throttle = k.speed > v * FORMA.botLift + 1 ? Math.min(inp.throttle, -0.4) : Math.min(inp.throttle, -0.2);
    },
    // Null: the usual reasons. What matters here is who has the cheese.
    botItem(k, p, id, inp, late) {
      const h = F.holder, mine = h === k.i, gap = mine ? 0 : gapFrom(p.f), chasing = !mine && h >= 0 && gap > 0, ahead = !mine && gap < 0;
      switch (id) {
        case 'razzo': return mine || h < 0 ? late : Math.abs(gap) < FORMA.razzoReach;
        case 'frana': return !mine && h >= 0 ? true : late;
        case 'mici': return mine ? false : null;
        case 'polenta': case 'durian': case 'formaggio':
          if (chasing && gap < 60) { inp.throttle = 1; return true; }
          if (ahead && gap > -40) { inp.throttle = 0; return true; }
          return null;
        case 'rendang': return chasing && gap < 50 ? true : null;
        default: return null;
      }
    },
  };
}
