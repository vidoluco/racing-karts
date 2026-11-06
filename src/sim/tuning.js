// Every number that decides how the game feels. tools/simrun.mjs measures what these produce.

import { kartInfo } from '../data/karts.js';

export const DT = 1 / 60;
export const G = 24;              // cartoon gravity: jumps are floaty on the way up and land with a thump
export const KART_R = 1.35;
export const BIG_SCALE = 1.45;

export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
// On the same side of a team championship: no kart has a side in any other race.
export const mates = (a, b) => !!a.team && a.team === b.team;
export const wrapAngle = (a) => { a %= Math.PI * 2; return a > Math.PI ? a - Math.PI * 2 : a < -Math.PI ? a + Math.PI * 2 : a; };
export const easeInOut = (t) => t * t * (3 - 2 * t);

// Stats run 1..5, sum 15. Spreads are narrow on purpose: a kart should change how a race feels, not who wins it.
export function kartPhysics(id) {
  const s = (kartInfo(id) || kartInfo('tabia')).stats;
  return {
    top: 30.5 + (s.speed - 3) * 0.22 + (s.weight - 3) * 0.06, // a heavy kart holds its speed
    accel: 16 + (s.accel - 3) * 3.4,        // m/s2 from rest
    yawFast: 1.52 + (s.handling - 3) * 0.08, // rad/s at top speed
    yawSlow: 2.5 + (s.handling - 3) * 0.08, // rad/s around 10 m/s
    drift: 1.5 + (s.handling - 3) * 0.07,
    keep: (s.weight - 3) * 0.03,            // speed a hit leaves on top of the table: a heavy kart loses less
    mass: 0.7 + s.weight * 0.2,
    rough: 1.25 - s.offroad * 0.09,         // scales every surface's speed penalty, 0.8 at 5, 1.16 at 1
    shove: 1.1 - s.weight * 0.08,           // how far a hit throws it
  };
}

export const yawRateAt = (ph, v) => {
  const a = v < 0 ? -v : v;
  if (a < 8) return ph.yawSlow * Math.min(1, a / 3);
  return ph.yawSlow + (ph.yawFast - ph.yawSlow) * Math.min(1, (a - 8) / 20);
};

// speed: share of top speed; grip: share of normal cornering grip.
export const SURFACE = {
  asphalt: { speed: 1, grip: 1 },
  wood: { speed: 1, grip: 1 },
  cobble: { speed: 0.985, grip: 0.95 },
  dirt: { speed: 0.95, grip: 0.85 },
  snow: { speed: 0.93, grip: 0.7 },
  sand: { speed: 0.82, grip: 0.72 },
  ice: { speed: 1, grip: 0.14 },
  grass: { speed: 0.66, grip: 0.8 },
};
export const OFFROAD_FACTOR = 0.82;  // sand or snow off the road is worse than on the piste

export const GRIP = 9.5;
export const DRIFT_GRIP = 4.2;
export const STEER_RATE = 10;        // /s: how fast applied steering follows the stick
export const STEER_SCRUB = 0.08;     // top speed lost at full lock with no drift
export const DRIFT_SCRUB = 0.012;
export const HOP_V = 3.4;
export const DRIFT_MIN_V = 9;
export const DRIFT_RANGE = 0.62;     // the stick into the bend tightens a drift by this share
export const DRIFT_OPEN = 0.87;      // and out of the bend opens it by this one: wide enough to hold a drift through a 150 m sweeper at speed
export const DRIFT_TIERS = [0.7, 1.4, 2.2];

export const BOOST = {
  // tier: how big it feels, 1 to 3, in the camera, the sound, the flames and the phone
  pad: { mul: 1.3, t: 1.3, kick: 6, tier: 2 },
  drift1: { mul: 1.22, t: 0.7, kick: 3.5, tier: 1 },
  drift2: { mul: 1.28, t: 1.15, kick: 5, tier: 2 },
  drift3: { mul: 1.36, t: 1.7, kick: 7, tier: 3 },
  grappa: { mul: 1.42, t: 2.6, kick: 8, tier: 3 },
  zuica: { mul: 1.3, t: 1.1, kick: 5, tier: 2 },
  uova: { mul: 1.2, t: 3.5, kick: 6, tier: 3 }, // the pan's 5 s of size and immunity are its real power: on top of a full boost it was worth twice any other item
  sambal: { mul: 1.32, t: 3, kick: 6, tier: 3 },
};

export const HIT = {
  spin: { t: 0.95, keep: 0.42, turns: 2, safe: 1.0 },
  tumble: { t: 1.4, keep: 0.22, flips: 1, pop: 7.5, safe: 1.2 },
};
export const RECOVER_T = 1.6;        // s of extra pull after a hit, so it never feels like a punishment twice
export const RECOVER_MUL = 1.8;
export const SHIELD_SAFE = 0.5;
export const RESCUE_T = 2;
export const RESCUE_SAFE = 1.4;
export const FLOOR_Y = -400;        // below this, or this far off the road, the kart is off the world
export const LOST_D = 90;

export const WALL = {
  max: 13,          // m of shoulder past the road's edge at most
  min: 4,           // and at least, where the ground is not a deck
  slope: 0.62,      // rise per metre where the ground counts as too steep to drive
  deckIn: 0.9,      // keeps a kart's flank on a deck or inside a tunnel
  taper: 0.55,      // m of width per m along: walls funnel into a deck instead of stepping
  restitution: 0.15,
};

export const RAZZO = { v: 55, ttl: 8, r: 2.7, seek: 26, lateral: 16, near: 30, clear: 4.5, sweepLong: 2400, leadSafe: 3 }; // sweepLong: m the leader's razzo flies on a long track, not 10 km of it; leadSafe: s the leader is untouchable after firing it
export const MICI_SHOT = { v: 24, minV: 46, ttl: 3.5, r: 2.2 };
export const FORMAGGIO = { v: 36, ttl: 9, r: 2.8, overtake: 14 };
// Baileys' bite, src/sim/bite.js: m centre to centre (two karts touch at 2.7), s of warning, s of sliding for the victim, s until the next one, s after the start when the grid is close.
export const BITE = { range: 3.3, level: 2.6, wind: 0.32, t: 0.5, cooldown: 9, grace: 3 };
// Weather, off unless a race asks (`createRace({ weather })`). grip and speed scale the SURFACE table of the surface under the kart; patch: puddles in the rain, drifts in the snow.
// Wet sand is firmer, so it drags less; snow on a road of snow changes little. Night changes nothing here: it is only hard to see.
export const WEATHER = {
  rain: {
    grip: { asphalt: 0.78, cobble: 0.72, wood: 0.68, dirt: 0.74, sand: 1.05, snow: 0.92, ice: 0.85, grass: 0.8 },
    speed: { asphalt: 0.99, cobble: 0.985, wood: 0.985, dirt: 0.945, sand: 1.05, snow: 0.98, ice: 1, grass: 0.92 },
    patch: { every: [55, 125], rx: [5, 9.5], rz: [2.3, 3.6], grip: 0.42, speed: 0.9, linger: 0.32 },
    thunder: [16, 38],
  },
  snow: {
    grip: { asphalt: 0.66, cobble: 0.64, wood: 0.62, dirt: 0.72, sand: 0.9, snow: 0.94, ice: 0.9, grass: 0.74 },
    speed: { asphalt: 0.965, cobble: 0.965, wood: 0.965, dirt: 0.94, sand: 0.98, snow: 0.985, ice: 1, grass: 0.88 },
    patch: { every: [70, 150], rx: [6, 11], rz: [2.4, 3.8], grip: 0.6, speed: 0.8, linger: 0.26 },
  },
  fog: {
    grip: { asphalt: 0.95, cobble: 0.92, wood: 0.92, dirt: 0.94, sand: 1, snow: 0.97, ice: 0.95, grass: 0.94 },
    speed: {},
    see: 0.55, // how far a bot looks, against the table
  },
};

export const POLENTA = { r: 4.2, ttl: 16, ahead: 45, behind: 4.5, t: 1.25, mul: 0.5, grip: 0.3 };
export const DURIAN = { ttl: 7, width: 0.42, behind: 8, ahead: 70, t: 2.6, mul: 0.76 };
export const LOB_T = 0.75;           // s a thrown puddle or fruit is in the air, on its way to its spot
// clearBehind: m with no rival behind, and a behind item goes forward by itself; reach: m at most of a throw; lead: s of road kept in front of the kart it is thrown at.
export const LOB = { clearBehind: 150, reach: 170, lead: 1.1 };
export const SAMBAL_FIRE = { every: 0.13, r: 1.7, ttl: 2.6 };
export const SAMBAL_BURST = { reach: 16, width: 5.5, level: 4, soot: 3 };   // the blast behind the kart; soot: s of a black face
export const RENDANG = { t: 4, reach: 52, touch: 3.5, pull: 0.4, slow: 0.93, lateral: 6, level: 4, boxReach: 60, leadT: 20 };
export const FRANA = { warn: 2.2, ahead: 22, rockR: 2, ttl: 14, spacing: 4 };

export const TIPSY_WOBBLE = 0.62;
export const STINK_WOBBLE = 0.5;
export const QUAKE_WOBBLE = 0.34;    // the road moves under you: steering this far off at the height of an earthquake

// One row per difficulty. Measured with docs/progress/gioco-exp/bal.mjs against scripted drivers, see docs/progress/balance.md; caps replace the spec's first guess of 0.84, 0.94, 1.02.
export const DIFFICULTY = {
  easy: {
    cap: 0.91, corner: 0.55, driftChance: 0.12, minTier: 1, minCorner: 1.2, mistakeEvery: [4, 9], mistakeT: 2, mistakeAmp: 0.62,
    itemDelay: [6, 15], smart: false, shortcuts: 0, avoid: 0.25, see: 34, crate: 0.35, pack: 0.02, leadEase: 0.02, back: 0.15, front: -0.13, reach: 60,
    hunt: { cap: 0.97, corner: 0.62 }, // in Caccia alla Forma there is no band to wait for you, and at the easy table's pace a good driver kept the wheel for most of the match
  },
  medium: {
    cap: 0.94, corner: 0.75, driftChance: 0.5, minTier: 1, minCorner: 1.0, mistakeEvery: [11, 24], mistakeT: 1.4, mistakeAmp: 0.34,
    itemDelay: [1.2, 3.5], smart: true, shortcuts: 0.35, avoid: 0.7, see: 72, crate: 0.5, pack: 0.03, leadEase: 0.05, back: 0.14, front: -0.2, reach: 55,
  },
  hard: {
    cap: 0.965, corner: 0.84, driftChance: 1, minTier: 2, minCorner: 1, mistakeEvery: [45, 90], mistakeT: 0.7, mistakeAmp: 0.1,
    itemDelay: [0.2, 0.7], smart: true, shortcuts: 1, avoid: 1, see: 120, crate: 0.7, pack: 0.05, leadEase: 0.12, back: 0.06, front: 0, reach: 100,
  },
  // the brain tools and tests lend to a human slot, a good driver with no rubber band
  ace: {
    cap: 1, corner: 0.9, driftChance: 1, minTier: 2, minCorner: 1, mistakeEvery: [60, 120], mistakeT: 0.5, mistakeAmp: 0.08,
    itemDelay: [0.2, 0.7], smart: true, shortcuts: 1, avoid: 1, see: 120, crate: 1, pack: 0, leadEase: 0, back: 0, front: 0, reach: 140,
  },
};
// Caccia alla Forma, src/sim/forma.js. duration: s of a match; lead: m ahead of the pole the wheel waits at the start; pace: m/s the pack covers, to plan disasters.
// A loose wheel: radius (m), roll (m/s on the flat), rollHill (share per unit of grade), rollEase (1/s), popMax (m/s at most off a kart), pop (m/s up), edge (m kept from the road's edge), sway (share of the half road), swayRate (rad/s), swayV (m/s across), bounce, bounceMin.
// Taking it: reach, level (m), lockOwner (s the one who lost it cannot retake it), lockAll (s nobody can), grabSafe (s of immunity), ramGrace (s no shove counts), ramForce (m/s of closing speed that is a shove), touch (m) and pressT (s): staying on the holder's bumper that long is one too.
// How heavy it is: top speed given up by the holder, heavy at once, heavyMore more per heavyT s in hand up to heavyCap times, heavyLead on top for the leader of the table.
// Who is pulled: near right behind it; up to chase from chaseFrom over chaseReach m behind; ahead of it, up to leash from leashFrom over leashReach m. stray: m or strayShare of the lap, whichever is less, for strayT s, and the stork brings the kart to strayBack m behind the wheel.
export const FORMA = {
  duration: 180, lead: 110, pace: 27, radius: 1.75,
  roll: 21, rollHill: 2.4, rollEase: 0.9, popMax: 30, pop: 7.5, edge: 2.2, sway: 0.42, swayRate: 0.62, swayV: 2.6, bounce: 0.52, bounceMin: 2.2,
  reach: 3.7, level: 4.4, lockOwner: 1.7, lockAll: 0.22, grabSafe: 1.3, ramGrace: 3, ramForce: 5.5, touch: 3.4, pressT: 0.9,
  heavy: 0.045, heavyMore: 0.09, heavyT: 35, heavyCap: 2.6, heavyLead: 0.025,
  near: 0.05, chase: 0.24, chaseFrom: 22, chaseReach: 150, leash: 0.55, leashFrom: 25, leashReach: 70,
  stray: 360, strayShare: 0.3, strayT: 1.5, strayBack: 80,
  lastCall: 30, razzoReach: 320, botSee: 70, botWait: 220, botLift: 0.8,
};
export const PACK = { reach: 120, leadFrom: 20, leadReach: 60, finale: 1.8, finaleLong: 0.25 }; // the bots' band against each other: m to its full size; m of lead before a lead bot starts giving, and m more to give all it gives; how much harder every band pulls on the last lap, or the last share of a long track's
export const BOT_BRAKE = 24;         // m/s2 a bot plans its corners with
export const FINISHED_CRUISE = 0.72; // share of top speed on the lap of honour
export const LEADER_GRACE = 30;      // s after the leader, with only bots left, the race is over
export const AUTO_HOME = { afterLeader: 90, afterLastBot: 45, drive: 75 }; // s a person still on the road has, before the autopilot takes the kart home; drive: on a long track, s the room then waits for it, the road home could be minutes more
