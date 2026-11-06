// createRace: the whole race, pure and deterministic. No DOM, no three, no Date, no Math.random.
// See docs/specs/2026-11-04-racing-karts-design.md for the state shape and the events.

import { AUTO_HOME, DT, DIFFICULTY, FINISHED_CRUISE, FORMA, LEADER_GRACE, kartPhysics } from './tuning.js';
import { createRng, mixSeed } from './rng.js';
import { createKart, createPriv, stepKart, collideKarts, wallsFor, startRescue } from './kart.js';
import { createBoxes, hitKart, stepItemsForKart, stepBoxes, stepShots, stepSpills } from './items.js';
import { createHazards, stepHazards, collideHazards } from './hazards.js';
import { createDisasters, stepDisasters, fireDisaster } from './disasters.js';
import { createTraffic, createTrafficState, collideTraffic } from './traffic.js';
import { botInput, createBrain, updateRubber } from './bot.js';
import { createBiters, stepBites } from './bite.js';
import { createForma, formaPlannedLaps, FORMA_LAPS } from './forma.js';
import { createWeather, stepWeather } from './weather.js';
import { itemInfo } from '../data/items.js';

export { DT, kartPhysics };

export function createRace({ track, terrain, seed = 1, laps = 3, players, difficulty = 'medium', countdown = 3, timeTrial = false, forma = false, weather = null }) {
  // the hunt runs on a clock, no kart ever finishes on laps; the sky still plans its disasters for the road the pack will cover
  const plannedLaps = forma ? formaPlannedLaps(track, forma.duration ?? FORMA.duration) : laps;
  if (forma) laps = FORMA_LAPS;
  const grid = track.startGrid(players.length);
  const state = {
    t: 0, phase: countdown > 0 ? 'countdown' : 'race', countdown, laps,
    karts: players.map((pl, i) => createKart(i, pl, grid[i], track)),
    boxes: timeTrial ? [] : createBoxes(track),
    shots: [],
    spills: [],
    hazards: [],
    disasters: [],
    quake: 0,
    ash: 0,
  };
  const R = {
    track, terrain, state, seed, difficulty,
    walls: wallsFor(track, terrain),
    events: [],
    emit: (e) => { R.events.push(e); },
    priv: [],
    order: state.karts.slice(),
    rngItems: createRng(mixSeed(seed, 1)),
    nextId: 1,
    bumpAt: {},
    refProgress: 0,
    finishers: 0,
    goT: countdown,
    leaderT: null,
    hazards: createHazards(track),
    traffic: createTraffic(track),
    // against the clock a disaster would make two times not comparable: animals and traffic keep their rhythm, the sky stays calm
    disasters: timeTrial ? { entries: [], rng: createRng(mixSeed(seed, 7)), slots: [], next: 0, nextId: 1, quietUntil: 0 } : createDisasters(track, seed, plannedLaps),
    hitKart: (k, by, kind, cause) => hitKart(R, k, by, kind, cause),
    finishKart(k) {
      k.finished = true;
      k.finishT = state.t - R.goT;
      k.place = ++R.finishers;
      k.drift = 0; k.driftT = 0; k.driftTier = 0;
      R.priv[k.i].cruise = FINISHED_CRUISE;
      R.priv[k.i].rubber = 0;
      if (R.leaderT === null) R.leaderT = state.t;
      if (!k.human && state.karts.every((o) => o.human || o.finished)) R.lastBotT = state.t;
      R.emit({ type: 'finish', kart: k.i, place: k.place, time: k.finishT });
    },
  };
  state.hazards = R.hazards.list;
  if (timeTrial) state.timeTrial = true;
  if (R.traffic) state.traffic = createTrafficState(track, seed);
  // weather: null, or { kind, night } (data/weather.js). A chosen sky replaces the one a city's seed would have drawn
  if (weather) {
    R.weather = createWeather(R, weather, seed);
    state.weather = { kind: R.weather.kind, night: R.weather.night, flash: 0, cover: state.karts.map(() => 0) }; // cover[i]: 1 in a tunnel, out of the rain
    if (state.traffic) state.traffic.rainFrom = 1e9;
  }

  // A human's kart sets what "the player's kart" means for the bots' speed cap; with no human each bot uses its own.
  const humans = state.karts.filter((k) => k.human);
  const refTop = humans.length ? humans.reduce((a, k) => a + kartPhysics(k.kart).top, 0) / humans.length : 0;
  state.karts.forEach((k, i) => {
    const p = createPriv(k, track), pl = players[i];
    R.priv.push(p);
    const diff = pl.difficulty || difficulty;
    p.bot = createBrain(R, k, diff);
    const hunt = forma ? DIFFICULTY[diff].hunt : null;
    if (hunt) p.bot.cfg = { ...p.bot.cfg, ...hunt };
    if (k.human) { p.capMul = 1; return; }
    const own = p.ph.top, ref = refTop ? (refTop + own) / 2 : own;
    p.capMul = (hunt?.cap ?? DIFFICULTY[diff].cap) * ref / own;
  });
  const biters = createBiters(R, state.karts);
  if (forma) R.forma = createForma(R, forma);
  if (countdown > 0) R.emit({ type: 'countdown', n: Math.ceil(countdown) });
  stepHazards(R);

  function stepCountdown() {
    const before = Math.ceil(state.countdown);
    state.countdown = Math.max(0, state.countdown - DT);
    const now = Math.ceil(state.countdown);
    if (now !== before && now > 0) R.emit({ type: 'countdown', n: now });
    if (state.countdown <= 0) {
      state.phase = 'race';
      for (const p of R.priv) p.lapStart = state.t;
      R.emit({ type: 'go' });
    }
  }

  function updatePlaces() {
    const O = R.order;
    // insertion sort: the order barely changes from one step to the next
    const before = (a, b) => (a.finished !== b.finished ? a.finished : a.finished ? a.place < b.place : a.progress !== b.progress ? a.progress > b.progress : a.i < b.i);
    for (let i = 1; i < O.length; i++) {
      const x = O[i];
      let j = i - 1;
      while (j >= 0 && before(x, O[j])) { O[j + 1] = O[j]; j--; }
      O[j + 1] = x;
    }
    for (let i = 0; i < O.length; i++) {
      const k = O[i], place = i + 1, p = R.priv[k.i];
      if (k.place !== place) {
        if (place < k.place && state.phase === 'race' && p.overtakeCd <= 0) { R.emit({ type: 'overtake', kart: k.i, place }); p.overtakeCd = 0.6; }
        k.place = place;
      }
    }
  }

  // Nobody waits for ever for a slow driver: past the limit the autopilot takes the kart home. Not against the clock, where a person is racing nobody, nor in the hunt, which has its own clock.
  function sendSlowHome() {
    if (R.leaderT === null || timeTrial || forma) return;
    const late = state.t - R.leaderT >= AUTO_HOME.afterLeader || (R.lastBotT !== undefined && state.t - R.lastBotT >= AUTO_HOME.afterLastBot);
    if (!late) return;
    for (const k of state.karts) {
      if (!k.human || k.finished || k.autoHome) continue;
      k.autoHome = true;
      R.homeT ??= state.t;
      R.emit({ type: 'autoHome', kart: k.i });
    }
  }

  function updateReference() {
    let sum = 0, c = 0, best = -Infinity;
    for (const k of state.karts) {
      if (k.human) { if (k.progress > best) best = k.progress; }
      sum += k.progress; c++;
    }
    R.refProgress = humans.length ? best : sum / c;
    R.fieldMean = sum / c;
  }

  const race = {
    state,
    step(inputs = []) {
      state.t += DT;
      if (state.phase === 'countdown') stepCountdown();
      stepHazards(R);
      if (R.weather) stepWeather(R);
      const racing = state.phase !== 'countdown';
      if (racing) { updateReference(); sendSlowHome(); }
      for (const k of state.karts) {
        const p = R.priv[k.i];
        let inp;
        if (!k.human || k.finished || k.autoHome) {
          if (!k.human && !k.finished && racing && !forma) updateRubber(R, k, p);
          inp = botInput(R, k, p, DT);
        } else inp = inputs[k.i];
        stepKart(R, k, inp, DT);
        stepItemsForKart(R, k, inp, DT);
      }
      if (racing) {
        if (!timeTrial) collideKarts(R);
        if (biters.length && !timeTrial) stepBites(R, biters);
        stepShots(R, DT);
        stepSpills(R, DT);
        if (!timeTrial) stepBoxes(R, DT);
        collideHazards(R);
        collideTraffic(R);
        stepDisasters(R, DT);
        if (forma) R.forma.step();
        updatePlaces();
        if (state.phase === 'race') {
          const open = state.karts.filter((k) => !k.finished);
          // a long track: on the way home on autopilot, past the time the room waits, the race is over, in the place it was in, with no time
          const humansOpen = open.some((k) => k.human && !(track.long && k.autoHome && state.t - R.homeT >= AUTO_HOME.drive));
          const over = open.length === 0 || (humans.length > 0 && !humansOpen && state.t - R.leaderT >= LEADER_GRACE);
          if (over) state.phase = 'done';
        }
      }
    },
    get patches() { return R.weather?.patches ?? []; }, // puddles and drifts: they never move, so they stay out of the state that gets cloned each step
    drainEvents() {
      const e = R.events;
      R.events = [];
      return e;
    },
    // What a good driver would do this step, from the bot's brain, for tools and tests that fill a human slot.
    autopilot(i) { return botInput(R, state.karts[i], R.priv[i], DT); },
    // Scripted setups in tests and tools: put a kart somewhere on the road, as if it had driven there.
    teleport(i, u, d = 0, { speed = 0, lap = 0, yawOffset = 0 } = {}) {
      const k = state.karts[i], p = R.priv[i], f = (((u % 1) + 1) % 1) * track.n, S = track.samples, s = Math.round(f) % track.n;
      k.x = S.x[s] + S.nx[s] * d; k.z = S.z[s] + S.nz[s] * d; k.y = track.heightAt(f, d);
      k.yaw = Math.atan2(S.tx[s], S.tz[s]) + yawOffset; k.vy = 0; k.grounded = true; k.airT = 0;
      k.vx = Math.sin(k.yaw) * speed; k.vz = Math.cos(k.yaw) * speed; k.speed = speed; k.d = d;
      p.f = f; p.i = s; p.locF = f; p.ground = k.y; p.lastGoodF = f; p.slope = 0;
      p.cont = (lap + f / track.n) * track.n; p.bestLaps = lap;
      k.progress = p.cont / track.n; k.u = f / track.n; k.trackI = s; k.lap = lap;
      updatePlaces();
    },
    give(i, item) {
      const k = state.karts[i], info = itemInfo(item);
      k.item = item; k.itemCharges = info.charges; k.rouletteT = 0; R.priv[i].pendingItem = null;
      k.orbit = item === 'mici' ? info.charges : 0;
    },
    rescue(i) { startRescue(R, state.karts[i], R.priv[i]); },
    disaster(entry = 0) { return fireDisaster(R, entry); },
    get walls() { return R.walls; },
    internals: R,
  };
  for (const p of R.priv) { p.slope = 0; p.locF = p.f; p.ground = 0; }
  state.karts.forEach((k, i) => { R.priv[i].ground = k.y; });
  return race;
}
