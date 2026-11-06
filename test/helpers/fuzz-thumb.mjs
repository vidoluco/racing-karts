// A clumsy, stubborn thumb: seeded bursts of random steering, reversing, turning back, seeking the wall, drift mashing, with
// spells of honestly trying to get on with it. Not a good driver and not a bot: it is what the phone sends in a child's hands.
import { createRng, mixSeed } from '../../src/sim/rng.js';
import { DT } from '../../src/sim/tuning.js';

const CHAOS = ['wander', 'reverse', 'turnback', 'wall', 'mash'];

export function fuzzThumb(track, seed, i) {
  const rng = createRng(mixSeed(seed, 1000 + i)), S = track.samples, n = track.n;
  let mode = 'try', left = 1 + rng.next() * 3, steer = 0, side = 1, chaos = 0, itemHeld = false;
  const aim = (k, u, d) => { // steer that turns the kart towards a point u samples up the road, d off its centre
    const a = ((k.trackI + u) % n + n) % n, x = S.x[a] + S.nx[a] * d, z = S.z[a] + S.nz[a] * d;
    const e = Math.atan2(x - k.x, z - k.z) - k.yaw;
    return Math.max(-1, Math.min(1, -Math.atan2(Math.sin(e), Math.cos(e)) * 2.4));
  };
  const thumb = (k) => {
    if ((left -= DT) <= 0) {
      // at most 7 s of foolery in a row, then the same thumb tries for a while: the limit below is about what happens then
      if (mode !== 'try' && chaos > 7) { mode = 'try'; left = 9 + rng.next() * 5; chaos = 0; }
      else if (mode === 'try' || rng.next() < 0.75) { mode = CHAOS[Math.floor(rng.next() * CHAOS.length)]; left = 0.3 + rng.next() * 2.7; chaos += left; }
      else { mode = 'try'; left = 9 + rng.next() * 5; chaos = 0; }
      steer = -1 + rng.next() * 2;
      if (rng.next() < 0.4) steer = Math.sign(steer);
      side = rng.next() < 0.5 ? -1 : 1;
    }
    const look = Math.round((6 + Math.abs(k.speed) * 0.3) / track.step);
    const press = rng.next() < 0.01; itemHeld = press;
    switch (mode) {
      case 'wander': return { steer, throttle: 0, item: itemHeld, drift: false };
      case 'reverse': return { steer, throttle: -1, item: itemHeld, drift: false };
      case 'turnback': return { steer: aim(k, -look, 0), throttle: 0, item: itemHeld, drift: false };
      case 'wall': return { steer: aim(k, Math.round(look * 0.6), side * 40), throttle: 0, item: itemHeld, drift: false };
      case 'mash': return { steer: Math.sign(steer) || 1, throttle: 0, item: itemHeld, drift: true };
      default: return { steer: aim(k, look, 0) + (rng.next() - 0.5) * 0.15, throttle: 0, item: itemHeld, drift: false };
    }
  };
  thumb.mode = () => mode;
  return thumb;
}

// Runs the thumbs for `secs` of race and reports, for each kart, what a person would notice.
export function fuzzRun(race, thumbs, secs) {
  const s = race.state, K = s.karts, T = race.internals.track, L = T.length;
  const M = K.map(() => ({ rescues: 0, rescueAt: [], stallMax: 0, stall: 0, best: -Infinity, jump: 0, jumpAt: 0, maxD: 0, tryStall: 0, tryStallMax: 0, tryStart: 0, stallAt: 0, tryAt: 0, bad: null, wallStill: 0 }));
  K.forEach((k, i) => { M[i].best = k.progress * L; });
  const prev = K.map((k) => k.progress);
  for (let f = 0; f < secs / DT && s.phase !== 'done'; f++) {
    const inp = [];
    K.forEach((k, i) => { if (k.human && thumbs[i]) inp[i] = thumbs[i](k); });
    race.step(inp);
    for (const e of race.drainEvents()) if (e.type === 'rescue') { M[e.kart].rescues++; M[e.kart].rescueAt.push(+s.t.toFixed(1)); }
    K.forEach((k, i) => {
      const m = M[i];
      if (!Number.isFinite(k.x + k.y + k.z + k.vx + k.vz + k.yaw + k.progress)) m.bad ||= `not finite at t ${s.t.toFixed(1)}`;
      if (k.finished) return;
      const metres = k.progress * L, dm = Math.abs(k.progress - prev[i]) * L;
      if (dm > m.jump && !(k.rescueT > 0) && !(race.internals.priv[i].resc)) { m.jump = dm; m.jumpAt = k.u; }
      prev[i] = k.progress;
      if (Math.abs(k.d) > m.maxD && k.shortcut < 0) m.maxD = Math.abs(k.d);
      if (metres > m.best + 3) { m.best = metres; m.stall = 0; m.tryStall = 0; }
      else {
        m.stall += DT;
        if (m.stall > m.stallMax) { m.stallMax = m.stall; m.stallAt = k.u; }
        // the time an honest try at it goes without a new best: a turn and a spin are in here, foolery is not
        if (thumbs[i]?.mode?.() === 'try') { m.tryStall += DT; if (m.tryStall > m.tryStallMax) { m.tryStallMax = m.tryStall; m.tryAt = k.u; } }
        else m.tryStall = 0;
      }
    });
  }
  return M;
}
