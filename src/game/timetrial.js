// Time trial: the lap clock, the splits, the ghost and the records. Pure like the rest of src/game: it only reads the sim's state
// after each step and never writes to it, so a race with it steps exactly like a race without it. The one outside thing is the
// storage handed to createRecords, and that is allowed to fail.
//
// A ghost is the poses of a lap, not its inputs: a replay does not depend on the sim, so a later change of tuning cannot send an old
// ghost into a wall. Poses are kept at 10 Hz on the lap's own step count, delta coded in 16 bits (4 mm, a quarter of a milliradian).
import { DT } from '../sim/tuning.js';

export const GHOST_EVERY = 6;          // sim steps between two samples
export const TT_INDEX = 'racing-karts.tt.v1';
export const TT_GHOST = 'racing-karts.tt.ghost.v1.';

const CH = 9;                          // x y z yaw pitch roll speed steer flags
const SCALE = [256, 256, 256, 4096, 4096, 4096, 64, 127];
const B64_CHUNK = 0x6000;

const wrapPi = (a) => { const t = Math.PI * 2; return a - t * Math.round(a / t); };
const clamp16 = (v) => Math.max(-32768, Math.min(32767, v));

function toBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += B64_CHUNK) s += String.fromCharCode(...bytes.subarray(i, i + B64_CHUNK));
  return btoa(s);
}
function fromBase64(text) {
  const s = atob(text), out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

// The stable seed of a track's trials: the animals and the traffic of the first lap are the same every time you try.
export function trackSeed(id) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Where the splits fall on the lap: quarters, or about one a kilometre on a long lap.
export function sectorsOf(track) {
  const n = track.long ? Math.max(2, Math.round(track.length / 1000)) : 4;
  return Array.from({ length: n - 1 }, (_, i) => (i + 1) / n);
}

export function createRecorder() {
  const out = [];
  let first = null, last = null, rawYaw = 0, yaw = 0, n = 0;
  return {
    get count() { return n; },
    add(k) {
      yaw = first ? yaw + wrapPi(k.yaw - rawYaw) : k.yaw;
      rawYaw = k.yaw;
      const v = [k.x, k.y, k.z, yaw, k.pitch || 0, k.roll || 0, k.speed || 0, k.steer || 0];
      const q = v.map((x, j) => Math.round(x * SCALE[j]));
      if (!first) { first = q; last = [...q]; }
      for (let j = 0; j < q.length; j++) {
        // measured against what the decoder will have, so a clamp (a stork's lift) heals by itself on the next samples
        const d = clamp16(q[j] - last[j]);
        last[j] += d;
        out.push(d);
      }
      out.push(((Math.sign(k.drift || 0) + 1) & 3) | (k.boostT > 0 ? 4 : 0) | (k.grounded === false ? 8 : 0));
      n++;
    },
    finish() {
      return { v: 1, n, every: GHOST_EVERY, o: first, d: toBase64(new Uint8Array(Int16Array.from(out).buffer)) };
    },
  };
}

// null for anything that is not a good ghost: stored data can be from anywhere.
export function decodeGhost(rec) {
  try {
    if (!rec || rec.v !== 1 || !Number.isInteger(rec.n) || rec.n < 2 || !Array.isArray(rec.o) || rec.o.length !== SCALE.length) return null;
    const bytes = fromBase64(rec.d);
    if (bytes.length !== rec.n * CH * 2) return null;
    const raw = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.length >> 1), data = new Float32Array(rec.n * CH), cur = [...rec.o];
    for (let s = 0; s < rec.n; s++) {
      for (let j = 0; j < SCALE.length; j++) {
        cur[j] += raw[s * CH + j];
        data[s * CH + j] = cur[j] / SCALE[j];
      }
      data[s * CH + 8] = raw[s * CH + 8];
    }
    if (!data.every(Number.isFinite)) return null;
    return { n: rec.n, every: rec.every || GHOST_EVERY, data, length: (rec.n - 1) * (rec.every || GHOST_EVERY) * DT };
  } catch { return null; }
}

const smooth = (a, b, c, d, u) => 0.5 * (2 * b + (c - a) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (3 * b - a - 3 * c + d) * u * u * u);

// The ghost at t seconds into its lap: only a function of the record and t. Past the end of the record it is gone.
export function ghostPose(g, t, out = {}) {
  const f = t / (g.every * DT);
  if (!(f >= 0) || f > g.n - 1 + 1e-6) { out.visible = false; return out; }
  const i = Math.min(g.n - 2, Math.floor(f)), u = f - i, D = g.data;
  const at = (s, j) => D[Math.max(0, Math.min(g.n - 1, s)) * CH + j];
  const line = (j) => at(i, j) + (at(i + 1, j) - at(i, j)) * u;
  const curve = (j) => smooth(at(i - 1, j), at(i, j), at(i + 1, j), at(i + 2, j), u);
  const fl = at(i, 8);
  out.visible = true;
  out.x = curve(0); out.y = curve(1); out.z = curve(2);
  out.yaw = line(3); out.pitch = line(4); out.roll = line(5); out.speed = line(6); out.steer = line(7);
  out.drift = (fl & 3) - 1; out.boostT = fl & 4 ? 1 : 0; out.grounded = !(fl & 8);
  return out;
}

// ---------- records ----------
// One small index with the times, one key per ghost, so a full storage loses old ghosts and never a time. Everything is also kept in
// memory: with no storage at all (a private window) the ghost still works for the evening.
const goodTime = (t) => Number.isFinite(t) && t > 0;

export function createRecords(given, { now = () => Date.now() } = {}) {
  let storage = given;
  // the accessor itself can throw, in a sandbox or with site data blocked
  if (storage === undefined) try { storage = globalThis.localStorage; } catch { storage = null; }
  let index = {};
  const mem = new Map();
  try { const v = JSON.parse(storage?.getItem(TT_INDEX) ?? '{}'); if (v && typeof v === 'object') index = v; } catch {}
  const entry = (track, kart) => {
    const e = index[track]?.[kart];
    return e && goodTime(e.lap) ? e : null;
  };
  const persist = () => { try { storage?.setItem(TT_INDEX, JSON.stringify(index)); return true; } catch { return false; } };
  const keyOf = (track, kart) => `${track}/${kart}`;
  // a road that changed length makes old times meaningless, and an old ghost would drive in the fields
  const fits = (e, len) => !len || !goodTime(e.len) || Math.abs(e.len - len) <= 1;

  function putGhost(track, kart, text) {
    if (!storage) return false;
    for (let tries = 0; tries < 80; tries++) {
      try { storage.setItem(TT_GHOST + keyOf(track, kart), text); return true; } catch {}
      // full: the ghost not raced for the longest goes, its time stays
      let oldest = null;
      for (const [t, row] of Object.entries(index)) for (const [k, e] of Object.entries(row)) {
        if (e.ghost && !(t === track && k === kart) && (!oldest || e.at < oldest.e.at)) oldest = { t, k, e };
      }
      if (!oldest) return false;
      try { storage.removeItem(TT_GHOST + keyOf(oldest.t, oldest.k)); } catch {}
      oldest.e.ghost = false;
    }
    return false;
  }

  return {
    // { lap, splits, totals: { [laps]: t }, len, at, ghost }, or null
    best(track, kart, len) {
      const e = entry(track, kart);
      return e && fits(e, len) ? e : null;
    },
    ghost(track, kart) {
      const key = keyOf(track, kart);
      if (mem.has(key)) return mem.get(key);
      let g = null;
      try { g = JSON.parse(storage?.getItem(TT_GHOST + key) ?? 'null'); } catch {}
      if (g) mem.set(key, g);
      return g;
    },
    saveLap(track, kart, { lap, splits, ghost, len }) {
      const row = index[track] ||= {};
      const e = row[kart] && fits(row[kart], len) ? row[kart] : (row[kart] = { totals: {} });
      Object.assign(e, { lap, splits: [...splits], len, at: now() });
      mem.set(keyOf(track, kart), ghost);
      e.ghost = putGhost(track, kart, JSON.stringify(ghost));
      persist();
      return e;
    },
    // true when it is the best total for that number of laps; the previous best goes back with it
    saveTotal(track, kart, laps, total, len) {
      const row = index[track] ||= {};
      const e = row[kart] && fits(row[kart], len) ? row[kart] : (row[kart] = { totals: {} });
      const was = goodTime(e.totals?.[laps]) ? e.totals[laps] : null;
      const record = was === null || total < was;
      if (record) { (e.totals ||= {})[laps] = total; e.len = len; e.at = now(); persist(); }
      return { record, was };
    },
    // Every kart that has a time on this track, the fastest first.
    table(track, len) {
      return Object.keys(index[track] || {}).map((kart) => ({ kart, e: entry(track, kart) })).filter((r) => r.e && fits(r.e, len))
        .map((r) => ({ kart: r.kart, lap: r.e.lap, totals: { ...r.e.totals } })).sort((a, b) => a.lap - b.lap);
    },
    // The track's best lap with any kart, for the vote cards.
    trackBest(track, len) {
      return this.table(track, len)[0] ?? null;
    },
  };
}

// ---------- one run ----------
// karts: [{ i, kart }], the sim's index and kart id of each human. step(state) after every race.step, returns what happened:
// ttSplit { kart, n, of, time, delta }, ttLap { kart, n, time, delta, record, first }, ttFinish { kart, time, bestLap, delta, record }.
export function createTimeTrial({ track, trackId, laps, karts, records }) {
  const sectors = sectorsOf(track), len = track.length;
  const rows = karts.map(({ i, kart }) => {
    const ref = records.best(trackId, kart, len);
    return {
      i, kart, ref, ghost: ref ? decodeGhost(records.ghost(trackId, kart)) : null, ghostLap: ref?.lap ?? null,
      rec: createRecorder(), steps: 0, started: false, over: false, lap: 0, next: 0, splits: [],
      tainted: false, taintedRun: false, laps: [], delta: null,
    };
  });
  const byKart = (i) => rows.find((r) => r.i === i);
  function refresh(r) {
    r.ref = records.best(trackId, r.kart, len);
    if (r.ref && r.ref.lap !== r.ghostLap) { r.ghost = decodeGhost(records.ghost(trackId, r.kart)); r.ghostLap = r.ref.lap; }
  }

  function closeLap(r, k, events) {
    // read again: on the same kart in another view, someone may just have beaten it, and a slower lap must not overwrite that
    refresh(r);
    const time = k.lastLapT, ref = r.ref?.lap ?? null, delta = ref === null ? null : time - ref;
    const clean = !r.tainted;
    const record = clean && (ref === null || time < ref);
    if (record) {
      // a last sample only on the beat: a ghost's samples are evenly spaced, so it may end up to 0.1 s short of the line
      if (r.steps % GHOST_EVERY === 0) r.rec.add(k);
      const ghost = r.rec.finish();
      r.ref = records.saveLap(trackId, r.kart, { lap: time, splits: r.splits, ghost, len });
      r.ghost = decodeGhost(ghost);
      r.ghostLap = time;
    }
    r.laps.push({ n: r.lap + 1, time, delta, record });
    r.delta = delta;
    events.push({ type: 'ttLap', kart: r.i, n: r.lap + 1, time, delta, record, first: ref === null, clean });
    r.lap = k.lap; r.steps = 0; r.next = 0; r.splits = []; r.tainted = false;
    refresh(r);
    r.rec = createRecorder();
    if (k.finished) {
      r.over = true;
      const done = r.taintedRun ? { record: false, was: records.best(trackId, r.kart, len)?.totals?.[laps] ?? null } : records.saveTotal(trackId, r.kart, laps, k.finishT, len);
      r.total = { record: done.record, delta: done.was === null ? null : k.finishT - done.was };
      events.push({ type: 'ttFinish', kart: r.i, time: k.finishT, bestLap: k.bestLapT, record: done.record, delta: r.total.delta, lapRecord: r.laps.some((l) => l.record) });
    } else r.rec.add(k);
  }

  function checkSectors(r, k, events) {
    const inLap = k.progress - r.lap;
    while (r.next < sectors.length && inLap >= sectors[r.next]) {
      const time = r.steps * DT, ref = r.ref?.splits?.length === sectors.length ? r.ref.splits[r.next] : null;
      r.splits.push(time);
      r.delta = ref === null ? null : time - ref;
      r.next++;
      events.push({ type: 'ttSplit', kart: r.i, n: r.next, of: sectors.length + 1, time, delta: r.delta });
    }
  }

  return {
    sectors,
    step(state) {
      const events = [];
      if (state.phase === 'countdown') return events;
      for (const r of rows) {
        if (r.over) continue;
        const k = state.karts[r.i];
        if (!r.started) { r.started = true; r.rec.add(k); } else r.steps++;
        if (k.lap > r.lap) { closeLap(r, k, events); continue; }
        checkSectors(r, k, events);
        if (r.steps > 0 && r.steps % GHOST_EVERY === 0) r.rec.add(k);
      }
      return events;
    },
    // A lap some bot drove (a phone gone too long, an autopilot) is no one's record.
    taint(i) { const r = byKart(i); if (r) { r.tainted = true; r.taintedRun = true; } },
    // One pose per kart, between the last step and this one by alpha, as the race is drawn.
    poses(alpha = 1) {
      return rows.map((r) => {
        if (r.over || !r.ghost) return { owner: r.i, visible: false };
        const p = ghostPose(r.ghost, Math.max(0, r.steps - (r.started ? 1 - alpha : 0)) * DT);
        p.owner = r.i;
        return p;
      });
    },
    // What the HUD shows for this kart.
    view(i) {
      const r = byKart(i);
      if (!r) return null;
      return { lapT: r.steps * DT, best: r.ref?.lap ?? null, laps: r.laps, delta: r.delta, ghost: !!r.ghost, over: r.over };
    },
    // What the results say about this kart's run: plain data, a phone hears it too.
    result(i) {
      const r = byKart(i);
      if (!r) return null;
      return {
        record: r.laps.some((l) => l.record), first: r.laps.some((l) => l.record && l.delta === null), best: r.ref?.lap ?? null,
        totalRecord: !!r.total?.record, delta: r.total?.delta ?? null, laps: r.laps.map((l) => ({ ...l })),
      };
    },
  };
}
