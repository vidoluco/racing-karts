// Scripted people on a phone, for the difficulty ladder: tools/ladder.mjs measures with them, test/balance.test.mjs holds the targets.
// These are models, nobody's hands. Calibrated on one real number: two people on phones lapped Bran in 70 and 74 s (06/11/2026).
// 'casual' is about a person in their first hour with a stick: late on the stick, overshoots, looks away, hits walls, never drifts,
// presses an item whenever it comes to mind. 'beginner' is the same person in their first race. 'good' is the bot's own brain with no band.
import { createRace } from '../../src/sim/index.js';
import { createRng, mixSeed } from '../../src/sim/rng.js';
import { DT } from '../../src/sim/tuning.js';
import { KART_IDS } from '../../src/data/karts.js';

// late: s the thumb is behind the eyes; look: m ahead at rest plus s of speed; gain: stick per radian; dead: errors smaller than this go uncorrected;
// rate: stick travel per s; lane: share of the half road the kart wanders over; lapse: s between looks away, s of each, where the stick stays where it was; item: s between an item and the press.
export const PHONE = {
  casual: { late: 0.22, look: [5, 0.27], gain: 3.2, dead: 0.03, rate: 7, lane: 0.55, lapseEvery: [6, 11], lapseT: [0.35, 0.8], item: [2, 8] },
  beginner: { late: 0.24, look: [5, 0.27], gain: 3.2, dead: 0.03, rate: 7, lane: 0.6, lapseEvery: [5, 10], lapseT: [0.4, 0.9], item: [3, 12] },
  // the stick player of 07/11/2026: Batur on medium in 364 s with 6 wall and building hits, 3rd. This model takes about 374 s with 7.
  stick: { late: 0.225, look: [5, 0.27], gain: 3.2, dead: 0.03, rate: 7, lane: 0.55, lapseEvery: [6, 11], lapseT: [0.35, 0.8], item: [2, 8] },
  // the gyro player of 07/11/2026: Batur on medium in 391 s with 33 wall and building hits, last. This model takes about 410 s with 25, a little worse on purpose.
  struggler: { late: 0.25, look: [5, 0.27], gain: 3.2, dead: 0.03, rate: 7, lane: 0.62, lapseEvery: [5, 10], lapseT: [0.4, 0.9], item: [3, 12] },
};

export function phoneDriver(track, seed, i, kind = 'casual') {
  const cfg = PHONE[kind], rng = createRng(mixSeed(seed, 3000 + i)), S = track.samples, n = track.n, late = Math.max(1, Math.round(cfg.late / DT));
  const past = [];
  let stick = 0, lane = 0, laneT = 0, lapseIn = rng.range(...cfg.lapseEvery), lapse = 0, itemWait = -1, stuck = 0, back = 0, tries = 0;
  return (k) => {
    if ((laneT -= DT) <= 0) { laneT = rng.range(1.5, 4); lane = rng.range(-cfg.lane, cfg.lane); }
    if ((lapseIn -= DT) <= 0) { lapseIn = rng.range(...cfg.lapseEvery); lapse = rng.range(...cfg.lapseT); }
    const a = (k.trackI + Math.round((cfg.look[0] + Math.abs(k.speed) * cfg.look[1]) / track.step)) % n;
    const off = lane * (S.w[a] / 2 - 1.5), x = S.x[a] + S.nx[a] * off, z = S.z[a] + S.nz[a] * off;
    let e = Math.atan2(x - k.x, z - k.z) - k.yaw;
    e = Math.atan2(Math.sin(e), Math.cos(e));
    past.push(Math.abs(e) < cfg.dead ? 0 : Math.max(-1, Math.min(1, -e * cfg.gain)));
    if (past.length > late) past.shift();
    if (lapse > 0) lapse -= DT;
    else { const d = past[0] - stick, most = cfg.rate * DT; stick += d > most ? most : d < -most ? -most : d; }
    // nose in a wall: a person takes a moment to work out the brake backs up
    stuck = Math.abs(k.speed) < 3 && k.hitT <= 0 && k.rescueT <= 0 ? stuck + DT : 0;
    if (stuck > 1) { tries++; back = Math.min(3, 0.6 + tries * 0.6); stuck = 0; }
    if (Math.abs(k.speed) > 15) tries = 0;
    let item = false;
    if (k.item) { if (itemWait < 0) itemWait = rng.range(...cfg.item); else if ((itemWait -= DT) <= 0) { item = true; itemWait = -1; } } else itemWait = -1;
    if (back > 0) { back -= DT; return { steer: -stick, throttle: -1, item, drift: false }; }
    return { steer: stick, throttle: 0, item, drift: false };
  };
}

// A grid as the flow builds it: the bots ahead, the people, two bots behind. kinds: one driver per person.
export function ladderField(seed, kinds, { teams = false, at = null } = {}) {
  const humanKarts = ['tabia', 'mocanita', 'jeep', 'becak', 'logan', 'seggiovia'];
  const people = kinds.map((kind, s) => ({ slot: s, human: true, name: `P${s + 1}`, kart: humanKarts[(seed + s) % humanKarts.length], ...(kind === 'good' ? { difficulty: 'ace' } : {}), ...(teams ? { team: s % 2 ? 'b' : 'a' } : {}) }));
  const taken = new Set(people.map((p) => p.kart)), pool = KART_IDS.filter((k) => !taken.has(k)), nb = 8 - kinds.length;
  const open = teams ? ['a', 'b', 'a', 'b'].slice(kinds.length) : [];
  const bots = Array.from({ length: nb }, (_, c) => ({ slot: -1, human: false, kart: pool[(seed * 3 + c) % pool.length], ...(teams ? { team: open[(c + seed) % nb] ?? null } : {}) }));
  const n = at ?? Math.max(0, nb - 2); // at: bots ahead of the people, from a Gran Premio's upside down grid
  return [...bots.slice(0, n), ...people, ...bots.slice(n)];
}

// One race, stepped. What a person would notice: place, gap, laps against the bots', and whether the bots looked alive.
export function ladderRace(W, level, kinds, seed, { laps = 2, teams = false, at = null, weather = null } = {}) {
  const players = ladderField(seed, kinds, { teams, at });
  const race = createRace({ track: W.track, terrain: W.terrain, seed, laps: W.track.long ? 1 : laps, players, difficulty: level, countdown: 0, weather });
  const s = race.state, K = s.karts, L = W.track.length;
  const drive = K.map((k) => (k.human && players[k.i].difficulty !== 'ace' ? phoneDriver(W.track, seed, k.i, kinds[players[k.i].slot]) : null));
  const m = { walls: 0, hits: 0, rescues: 0, botRescues: 0, auto: 0 }, before = K.map((k) => k.progress), slowest = K.map(() => Infinity);
  let bursts = K.map(() => 0), lastPlaceSteps = 0, off = 0, offN = 0, topShare = 0, botSpread = null;
  for (let f = 0; f < 60 * 1500 && s.phase !== 'done'; f++) {
    const inp = [];
    K.forEach((k, i) => { if (k.human) inp[i] = drive[i] && !k.finished && !k.autoHome ? drive[i](k) : race.autopilot(i); });
    race.step(inp);
    for (const e of race.drainEvents()) {
      if (e.type === 'wall' && K[e.kart].human) m.walls++;
      if (e.type === 'hit' && K[e.kart].human && e.kind !== 'stink') m.hits++;
      if (e.type === 'rescue') { if (K[e.kart].human) m.rescues++; else m.botRescues++; }
      if (e.type === 'autoHome') m.auto++;
    }
    const hum = K.find((k) => k.human);
    if (!hum.finished && hum.place === K.length) lastPlaceSteps++;
    for (const k of K) {
      if (k.human || k.finished) continue;
      offN++;
      if (k.offroad || Math.abs(k.d) > W.track.samples.w[k.trackI] / 2 - 1.2) off++;
      topShare = Math.max(topShare, race.internals.priv[k.i].rubber);
    }
    // how strung out the bots are when the first of them gets home: m from it to the last bot
    if (botSpread === null && K.some((k) => !k.human && k.finished)) { const pr = K.filter((k) => !k.human).map((k) => k.progress); botSpread = (Math.max(...pr) - Math.min(...pr)) * L; }
    // the slowest 5 s of each bot: over 100 m if it is alive at all
    if (f % 300 === 299) K.forEach((k, i) => { if (!k.finished) slowest[i] = Math.min(slowest[i], (k.progress - before[i]) * L / 5); before[i] = k.progress; });
  }
  const times = K.filter((k) => k.finished && k.finishT > 0).map((k) => k.finishT).sort((a, b) => a - b);
  const people = K.filter((k) => k.human), bots = K.filter((k) => !k.human);
  const best = people.reduce((a, k) => (k.place < a.place ? k : a));
  const botLaps = bots.map((k) => k.bestLapT).filter((t) => t > 0), humLaps = people.map((k) => k.bestLapT).filter((t) => t > 0);
  const lastBotT = Math.max(...bots.map((k) => k.finishT || 0));
  return {
    done: s.phase === 'done', place: best.place, worst: Math.max(...people.map((k) => k.place)), won: best.place === 1,
    time: best.finishT, winT: times[0], last: people.some((k) => k.place === K.length), behindLastBot: Math.max(...people.map((k) => (k.finishT || 0) - lastBotT)),
    gap: (best.finishT || NaN) - times[0], lap: humLaps.length ? Math.min(...humLaps) : NaN, botLap: botLaps.length ? Math.min(...botLaps) : NaN,
    walls: m.walls, hits: m.hits, rescues: m.rescues, botRescues: m.botRescues, auto: m.auto, margin: best.place === 1 ? times[1] - times[0] : NaN, lastShare: lastPlaceSteps / Math.max(1, s.t * 60), botOff: off / Math.max(1, offN),
    slowestBot: Math.min(...slowest.filter((_, i) => !K[i].human)), band: topShare, botSpread: botSpread ?? NaN,
  };
}

export const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
