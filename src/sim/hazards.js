// The living things and vents on the road, one pure function of time per kind, so a track only says where and how often.
// def.hazards: { kind, u, width, period, phase }. width scales the group (1 is the full herd, or the road for vents and
// the ice patch), period is seconds per cycle, phase is a fraction of a period.
// Kinds: cows, sheep (a flock and its dog), bear, sledders, ice, bats, steam, ponies, macaques.

import { clamp } from './tuning.js';
import { hitKart } from './items.js';

const SIDE_OUT = 3;      // m past the road's edge where a crossing starts and ends
const NEAR_M = 42;       // hazardNear fires this far ahead
const NEAR_GAP = 2.5;    // s between warnings to one kart
const WINDOW = 12;       // samples: only what is this close to a kart can touch it
const SCATTER = 16;      // m/s an animal runs off the road from the leader's rocket

const CROSSERS = {
  cows: { count: 3, speed: 3.8, r: 2.0, gap: 9, hit: 'spin' },
  // the flock crosses in pairs with a hole between them, so a 10 m road always has a lane for a kart while it is on it
  sheep: { count: 7, speed: 4.6, r: 1.15, gap: 2.4, bunch: 2, hole: 8, along: 3.4, hit: 'spin', lastRole: 'dog' },
  ponies: { count: 2, speed: 8.5, r: 1.9, gap: 8, hit: 'spin', role: 'pony' },
  macaques: { count: 4, speed: 8, r: 1.0, gap: 3.5, hit: 'steal' },
  sledders: { count: 3, speed: 10, r: 1.3, gap: 9, hit: 'spin' },
};
const BATS = { count: 5, cross: 2.6, r: 1.5, gap: 7, reach: 2.6, top: 7 };
const STEAM = { count: 3, gap: 16, r: 3.1, warnFrom: 0.2, from: 0.42, to: 0.72 };
const BEAR = { r: 2.5, warnFrom: 0.15, from: 0.3, to: 0.72, reach: 2.6 };
const ICE = { len: 40 };

const frac = (x) => x - Math.floor(x);
// how far behind the first of its group a crosser walks
const trail = (cr, j) => j * cr.gap + (cr.bunch ? Math.floor(j / cr.bunch) * (cr.hole - cr.gap) : 0);
const STEAM_LANES = [-0.55, 0.55, 0];

// One static group per def entry; each animal becomes one entry of state.hazards.
export function createHazards(track) {
  const groups = [], list = [], n = track.n, S = track.samples;
  let id = 0;
  (track.def.hazards || []).forEach((h, g) => {
    const kind = h.kind, width = h.width ?? 1, period = Math.max(2, h.period ?? 9), phase = h.phase ?? 0;
    const c = Math.round((((h.u % 1) + 1) % 1) * n) % n;
    const add = (o, extra = {}) => {
      const i = ((c + Math.round(o / track.step)) % n + n) % n;
      const e = { id: id++, kind, role: extra.role ?? null, x: S.x[i], y: S.y[i], z: S.z[i], yaw: 0, t: 0, phase: 0, active: false, warn: false, i, d: 0, vd: 0, r: extra.r ?? 1.5, h: 0, cleared: false };
      list.push(e);
      return e;
    };
    const G = { kind, c, period, phase, members: [], def: h, width, clearUntil: -1 };
    const cr = CROSSERS[kind];
    if (cr) {
      const count = Math.max(1, Math.round(cr.count * width));
      for (let j = 0; j < count; j++) {
        const role = cr.lastRole && j === count - 1 ? cr.lastRole : cr.role ?? null;
        G.members.push(add((j - (count - 1) / 2) * (cr.along ?? cr.gap) / 2.5, { r: cr.r, role }));
      }
      G.cross = cr;
    } else if (kind === 'bats') {
      const count = Math.max(1, Math.round(BATS.count * width));
      for (let j = 0; j < count; j++) G.members.push(add((j - (count - 1) / 2) * BATS.gap, { r: BATS.r }));
    } else if (kind === 'steam') {
      const count = Math.max(1, Math.round(STEAM.count * width));
      for (let j = 0; j < count; j++) G.members.push(add((j - (count - 1) / 2) * STEAM.gap, { r: STEAM.r }));
    } else if (kind === 'bear') {
      G.members.push(add(0, { r: BEAR.r }));
    } else if (kind === 'ice') {
      G.len = ICE.len * width;
      G.members.push(add(0, { r: G.len / 2 }));
    } else {
      throw new Error(`track ${track.def.id}: unknown hazard kind ${kind}`);
    }
    groups.push(G);
  });
  return { groups, list };
}

function place(R, e, d) {
  const T = R.track, S = T.samples, i = e.i, hw = S.w[i] / 2;
  e.x = S.x[i] + S.nx[i] * d; e.z = S.z[i] + S.nz[i] * d; e.d = d;
  e.y = Math.abs(d) <= hw ? T.heightAt(i, d) : R.terrain.heightAt(e.x, e.z);
}

export function stepHazards(R) {
  const t = R.state.t, T = R.track, S = T.samples;
  for (const G of R.hazards.groups) {
    const cyc = t / G.period + G.phase, tau = frac(cyc), which = Math.floor(cyc);
    const cleared = G.clearUntil > t;
    G.members.forEach((e, j) => {
      e.t = tau * G.period; e.phase = tau;
      const hw = S.w[e.i] / 2;
      e.cleared = cleared;
      if (cleared) {
        // scattered by the leader's rocket: off the road at a run, back on the next cycle
        const out = hw + SIDE_OUT + 2, side = e.d >= 0 ? 1 : -1;
        place(R, e, side * Math.min(out, Math.abs(e.d) + SCATTER / 60));
        e.vd = 0; e.active = false; e.warn = false; e.h = 0;
        return;
      }
      if (G.cross) {
        // each cycle the group crosses, and the next one it comes back the other way
        const span = 2 * (hw + SIDE_OUT), dir = which % 2 ? -1 : 1, cr = G.cross;
        const stagger = (trail(cr, j) / cr.speed) / G.period;
        const dur = Math.min(span / cr.speed / G.period, 0.8 - stagger);
        const a = clamp((tau - stagger) / Math.max(0.05, dur), 0, 1);
        place(R, e, dir * (-span / 2 + span * a));
        e.vd = a > 0 && a < 1 ? dir * span / (dur * G.period) : 0;
        e.active = a > 0 && a < 1;
        e.warn = tau > 0.85;
        e.yaw = Math.atan2(S.nx[e.i] * dir, S.nz[e.i] * dir);
      } else if (G.kind === 'bats') {
        const stagger = j * 0.05, a = clamp((tau - stagger) / (BATS.cross / G.period), 0, 1), dir = (which + j) % 2 ? -1 : 1;
        const span = 2 * (hw + 4), d = dir * (-span / 2 + span * a), lift = (2 * a - 1) ** 2;
        place(R, e, d);
        e.h = 1.1 + BATS.top * lift;
        e.y += e.h;
        e.vd = a > 0 && a < 1 ? dir * span / BATS.cross : 0;
        e.active = a > 0 && a < 1 && e.h < BATS.reach + 1;
        e.warn = a > 0 && a < 1;
        e.yaw = Math.atan2(S.nx[e.i] * dir, S.nz[e.i] * dir);
      } else if (G.kind === 'steam') {
        const local = frac(tau + j / G.members.length);
        place(R, e, STEAM_LANES[j % 3] * hw * G.width);
        e.vd = 0;
        e.warn = local >= STEAM.warnFrom && local < STEAM.from;
        e.active = local >= STEAM.from && local < STEAM.to;
        e.h = e.active ? 9 : e.warn ? 1.5 : 0;
        e.t = local * G.period; e.phase = local;
      } else if (G.kind === 'bear') {
        const side = (G.def.side ?? 1) >= 0 ? 1 : -1;
        const out = tau >= BEAR.from && tau < BEAR.to;
        place(R, e, side * (out ? hw - BEAR.reach : hw + 2.5));
        e.vd = 0;
        e.warn = tau >= BEAR.warnFrom && tau < BEAR.from;
        e.active = out;
        e.h = out ? 2.6 : e.warn ? 1.2 : 0;
        e.yaw = Math.atan2(-S.nx[e.i] * side, -S.nz[e.i] * side);
      } else if (G.kind === 'ice') {
        place(R, e, 0);
        e.active = true;
      }
    });
  }
}

export function collideHazards(R) {
  const s = R.state, T = R.track, n = T.n;
  const list = R.hazards.list;
  if (!list.length) return;
  for (const k of s.karts) {
    if (k.finished) continue;
    const p = R.priv[k.i];
    for (const e of list) {
      if (e.cleared) continue;
      let o = e.i - k.trackI;
      if (o > n / 2) o -= n; else if (o < -n / 2) o += n;
      if (e.kind === 'ice') {
        // the group's own length, so the patch ends where the renderer draws it
        if (Math.abs(o) * T.step <= e.r) p.iceT = 0.1;
        continue;
      }
      if (p.nearCd <= 0 && o > 0 && o * T.step < NEAR_M && (e.active || e.warn)) {
        R.emit({ type: 'hazardNear', kart: k.i, kind: e.kind });
        p.nearCd = NEAR_GAP;
      }
      if (o > WINDOW || o < -WINDOW || k.rescueT > 0) continue;
      const dx = k.x - e.x, dz = k.z - e.z, rr = e.r + 1.2;
      if (dx * dx + dz * dz > rr * rr) continue;
      switch (e.kind) {
        case 'cows': case 'sheep': case 'ponies': case 'sledders':
          if (Math.abs(k.y - e.y) < 3.5) hitKart(R, k, -1, 'spin', e.kind);
          break;
        case 'macaques':
          if (Math.abs(k.y - e.y) < 3.5) steal(R, k, e);
          break;
        case 'bats':
          if (e.h < BATS.reach && k.y + 1.6 > e.y - 1) hitKart(R, k, -1, 'spin', 'bats');
          break;
        case 'bear':
          if (e.active) hitKart(R, k, -1, 'spin', 'bear');
          break;
        case 'steam':
          if (e.active && hitKart(R, k, -1, 'spin', 'steam') === 'hit' && k.grounded) { k.vy = 8; k.grounded = false; k.airT = 0; }
          break;
      }
    }
  }
}

// A cheeky hand in the crate: no spin, the held item is simply gone. Mici orbit in plain sight and get the blame first.
function steal(R, k, e) {
  if (k.bigT > 0 || k.safeT > 0) return;
  const p = R.priv[k.i];
  if (k.item || k.rouletteT > 0) {
    const item = k.item || p.pendingItem;
    k.item = null; k.itemCharges = 0; k.orbit = 0; k.rouletteT = 0; p.pendingItem = null;
    k.safeT = 0.8;
    R.emit({ type: 'hit', kart: k.i, by: -1, kind: 'steal', cause: 'macaques', item });
  } else {
    hitKart(R, k, -1, 'slide', 'macaques');
    k.safeT = 0.8;
  }
  e.warn = false;
}
