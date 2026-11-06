// Game-side input per the network contract: createInput(transport) -> { get(slot), send(slot, msg) }.
// transport is any {onMessage(fn), send(msg)}: the WebSocket one or a test stub.
// get(slot) -> { x, y, item, drift, connected, source }: x in [-1,1] right positive, y in [-1,1] up positive (up =
// forward), item and drift booleans, source 'pad' | 'keyboard' | null. Call it once per sim step: it drains the
// queued presses. on(fn) observes join/leave/full; color(slot); dispose().
// Test hook: with globalThis.__netTrace = { rx: [], read: [] } set before the page loads, every pad input is
// logged when it arrives (rx) and when a get() first hands it to the game (read), in epoch ms, so the browser
// tests can measure touch to host latency.
import { createKeyboard } from './keyboard.js';
import { SLOT_COLORS } from '../../server/room.js';

export const DEFAULT_COLORS = SLOT_COLORS;
const SLOTS = 4;
const MAX_PRESSES = 8;
const clamp1 = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0);
const validSlot = (s) => Number.isInteger(s) && s >= 0 && s < SLOTS;
const isOn = (v) => v === 1 || v === true;

// What a stick on the phone means for the throttle. The stick reports direction times size, and a thumb swings on an
// arc: at full lock a little under horizontal it has a large negative y and means only "turn". Only a stick that really
// points down (within 35 degrees of straight down) and far enough down brakes; anything else is the automatic throttle.
export const STICK_BRAKE_FROM = 0.35; // the sim's own full brake starts here, so under it there is nothing to slow by
export const STICK_BRAKE_CONE = 0.7;  // |x| over |y|: tan(35 degrees)
export function stickThrottle(x, y) {
  if (y >= 0) return y;
  if (Math.abs(x) > -y * STICK_BRAKE_CONE || y > -STICK_BRAKE_FROM) return 0;
  return y;
}

// Wi-Fi power save delivers inputs in bursts: count every press so a quick tap is not merged with the next one.
const button = () => ({ held: false, presses: 0, out: false });
function feed(btn, held) {
  if (held && !btn.held) btn.presses = Math.min(MAX_PRESSES, btn.presses + 1);
  btn.held = held;
}
// One frame per queued press, with a released frame between presses so the sim sees each edge.
function drain(btn, stale) {
  let out;
  if (btn.presses > 0) {
    out = !btn.out;
    if (out) btn.presses--;
  } else {
    out = btn.held && !stale;
  }
  btn.out = out;
  return out;
}

export function createInput(transport, {
  keyboard = typeof window !== 'undefined' ? createKeyboard(window) : null,
  now = () => (globalThis.performance?.now?.() ?? Date.now()),
  staleMs = 1000,
  smoothMs = 30, // the stick arrives at 30 to 60 Hz and in bursts, the sim steps at 60 Hz: without this the kart twitches
} = {}) {
  const fresh = () => ({ x: 0, y: 0, sx: 0, sy: 0, readAt: now(), item: button(), drift: button() });
  const pads = Array.from({ length: SLOTS }, (_, i) => ({ connected: false, seq: -1, at: 0, color: DEFAULT_COLORS[i], ...fresh() }));
  const listeners = new Set();
  const trace = globalThis.__netTrace?.rx && globalThis.__netTrace?.read ? globalThis.__netTrace : null;
  const epoch = () => (globalThis.performance ? performance.timeOrigin + performance.now() : Date.now());
  const read = pads.map(() => -1); // last seq a get() handed out, per slot (traced only)
  const log = (list, rec) => { if (list.length > 20000) list.splice(0, 10000); list.push(rec); };

  const off = transport.onMessage((m) => {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'in') {
      if (!validSlot(m.slot)) return;
      const p = pads[m.slot];
      if (!p.connected) return;
      if (Number.isSafeInteger(m.seq)) {
        if (m.seq < p.seq) return;
        p.seq = m.seq;
      }
      p.x = clamp1(m.x);
      p.y = clamp1(m.y);
      feed(p.item, isOn(m.b));
      feed(p.drift, isOn(m.d));
      p.at = now();
      if (trace) log(trace.rx, { slot: m.slot, seq: p.seq, x: p.x, y: p.y, b: p.item.held ? 1 : 0, d: p.drift.held ? 1 : 0, at: epoch() });
      return;
    }
    if (m.t === 'join' && validSlot(m.slot)) {
      const p = pads[m.slot];
      Object.assign(p, fresh(), { connected: true, seq: -1, at: now() });
      if (typeof m.color === 'string') p.color = m.color;
    } else if (m.t === 'leave' && validSlot(m.slot)) {
      const p = pads[m.slot];
      if (!p.connected) return;
      Object.assign(p, fresh(), { connected: false });
    } else if (m.t !== 'full') {
      return;
    }
    for (const fn of listeners) { try { fn(m); } catch (e) { console.error(e); } }
  });

  function smooth(p, tx, ty) {
    const t = now();
    const k = smoothMs > 0 ? 1 - Math.exp(-(t - p.readAt) / smoothMs) : 1;
    p.readAt = t;
    p.sx += (tx - p.sx) * k;
    p.sy += (ty - p.sy) * k;
    if (Math.abs(tx - p.sx) < 0.002) p.sx = tx;
    if (Math.abs(ty - p.sy) < 0.002) p.sy = ty;
  }

  return {
    get(slot) {
      if (!validSlot(slot)) return { x: 0, y: 0, item: false, drift: false, connected: false, source: null };
      const p = pads[slot];
      if (p.connected) {
        const stale = now() - p.at > staleMs;
        const item = drain(p.item, stale);
        const drift = drain(p.drift, stale);
        if (trace && p.seq !== read[slot]) { read[slot] = p.seq; log(trace.read, { slot, seq: p.seq, at: epoch() }); }
        smooth(p, stale ? 0 : p.x, stale ? 0 : p.y);
        return { x: p.sx, y: p.sy, item, drift, connected: true, source: 'pad' };
      }
      const k = keyboard?.get(slot);
      if (k) return { x: clamp1(k.x), y: clamp1(k.y), item: !!k.item, drift: !!k.drift, connected: true, source: 'keyboard' };
      return { x: 0, y: 0, item: false, drift: false, connected: false, source: null };
    },
    send(slot, msg) {
      if (!validSlot(slot) || !msg || typeof msg !== 'object') return false;
      return transport.send({ ...msg, slot }) !== false;
    },
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    color(slot) { return validSlot(slot) ? pads[slot].color : null; },
    padConnected(slot) { return validSlot(slot) && pads[slot].connected; },
    dispose() { if (typeof off === 'function') off(); keyboard?.dispose?.(); },
  };
}
