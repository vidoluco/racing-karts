// Single room with four slots. No game logic: it assigns slots, sanitises what phones say and relays messages.
// The karts' seat colours on the TV: the pad paints its stick and buttons with them.
export const SLOT_COLORS = ['#4aa6f2', '#f28bbd', '#f6c23e', '#62c56e']; // blue, pink, yellow, green
export const SLOT_NAMES = ['azzurro', 'rosa', 'giallo', 'verde'];

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const OPEN = 1;

export function validId(id) {
  return typeof id === 'string' && ID_RE.test(id);
}

const clamp1 = (v) => (Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0);
const on = (v) => (v === 1 || v === true ? 1 : 0);

// Returns a sanitised 'in' message without slot, or null when the payload is not a usable input.
export function sanitizeInput(m) {
  if (!m || m.t !== 'in') return null;
  if (typeof m.x !== 'number' || typeof m.y !== 'number') return null;
  const seq = Number.isSafeInteger(m.seq) && m.seq >= 0 ? m.seq : 0;
  return { x: clamp1(m.x), y: clamp1(m.y), b: on(m.b), d: on(m.d), seq };
}

// Kart and track ids: only their shape here, the host checks them against its roster.
const CARD_RE = /^[a-z0-9_-]{1,32}$/;

export function sanitizePick(m) {
  if (!m || m.t !== 'pick' || typeof m.kart !== 'string' || !CARD_RE.test(m.kart)) return null;
  return { kart: m.kart, ready: m.ready === true };
}

export function sanitizeVote(m) {
  if (!m || m.t !== 'vote' || typeof m.track !== 'string' || !CARD_RE.test(m.track)) return null;
  return { track: m.track, lock: m.lock === true };
}

// Which side of a team championship this seat wants: its own choice, whoever holds the options.
export function sanitizeTeam(m) {
  if (!m || m.t !== 'team' || (m.team !== 'a' && m.team !== 'b')) return null;
  return { team: m.team };
}

const DIFFICULTIES = ['easy', 'medium', 'hard'];
const LAPS = [2, 3, 5];
const MODES = ['race', 'gp', 'time', 'teams', 'forma'];
const NEXTS = ['rematch', 'track', 'lobby'];
const VOICES = ['off', 'it', 'ro', 'id'];
const WEATHERS = ['clear', 'rain', 'snow', 'fog', 'surprise'];

// Keeps the fields that are valid, as a phone may send one at a time; null when none is.
export function sanitizeOpt(m) {
  if (!m || m.t !== 'opt') return null;
  const out = {};
  if (DIFFICULTIES.includes(m.difficulty)) out.difficulty = m.difficulty;
  if (Number.isInteger(m.bots)) out.bots = Math.max(0, Math.min(7, m.bots));
  if (LAPS.includes(m.laps)) out.laps = m.laps;
  if (MODES.includes(m.mode)) out.mode = m.mode;
  if (VOICES.includes(m.voice)) out.voice = m.voice;
  if (WEATHERS.includes(m.weather)) out.weather = m.weather;
  if (typeof m.night === 'boolean') out.night = m.night;
  if (m.go === true) out.go = true;
  if (NEXTS.includes(m.next)) out.next = m.next;
  return Object.keys(out).length ? out : null;
}

// "I am done with this screen", or taking it back; skip: the authority does not wait for the rest. turn: the screen it saw.
export function sanitizeAdvance(m) {
  if (!m || m.t !== 'advance') return null;
  return { on: m.on === true, ...(m.skip === true ? { skip: true } : {}), ...(Number.isSafeInteger(m.turn) ? { turn: m.turn } : {}) };
}

// How long a seat without a phone is held for that phone before the TV stops counting. In the lobby the seat then goes;
// during a game it stays, for the same phone or a new one, until the game is back in the lobby.
export const GRACE_MS = 120000;

export function createRoom({ reserveMs = GRACE_MS, log = () => {}, telemetry = () => {} } = {}) {
  // slots[i] = { id, ws, timer, awayAt, expired } ; ws null while the slot is held after a leave, expired once the grace is over
  const slots = [null, null, null, null];
  const waiting = []; // pads that got {t:'full'}: [{ id, ws }]
  let host = null;
  let picked = false; // someone picked a kart since the lobby: from now on the options are the authority's
  let session = false; // the TV says a game is on (anything but the lobby): a seat is then never freed
  let phase = 'lobby'; // only for what the telemetry writes next to a drop
  const boot = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`; // the TV tells a restarted server by this

  // Who decides for the room: the lowest seat with a phone connected. A dead battery in slot 0 must not lock the evening.
  const authority = () => slots.findIndex((s) => s?.ws);

  const send = (ws, msg) => {
    if (ws && ws.readyState === OPEN) ws.send(JSON.stringify(msg));
  };
  const toHost = (msg) => send(host, msg);

  // took: this phone is not the one that sat here, it inherits the kart, the side and the points. Both ends are told.
  function seat(slot, id, ws, { took = false } = {}) {
    const prev = slots[slot];
    if (prev?.timer) clearTimeout(prev.timer);
    slots[slot] = { id, ws, timer: null, awayAt: null, expired: false };
    ws._slot = slot;
    const mark = took ? { took: true } : {};
    send(ws, { t: 'welcome', slot, color: SLOT_COLORS[slot], id, host: !!host, ...mark });
    toHost({ t: 'join', slot, color: SLOT_COLORS[slot], ...mark });
    log(`pad ${id.slice(0, 8)} -> slot ${slot}${took ? ' (took a seat with no phone)' : ''}`);
    if (prev?.awayAt) telemetry({ e: 'back', slot, ms: Date.now() - prev.awayAt, took, expired: prev.expired, phase });
  }

  // A seat with no phone, for a phone that has no seat: the one least likely to be missed first.
  function offlineSeat() {
    let best = -1, rank = Infinity;
    for (let s = 0; s < slots.length; s++) {
      const e = slots[s];
      if (!e || e.ws) continue;
      const r = e.expired ? -1 : e.awayAt;
      if (r < rank) { best = s; rank = r; }
    }
    return best;
  }

  // The queue waits out the grace of a phone that may be blinking: it takes empty seats, and seats past their grace.
  function promoteWaiting() {
    const before = waiting.length;
    for (let s = 0; s < slots.length && waiting.length; s++) {
      const held = slots[s];
      if (held && (held.ws || !held.expired)) continue;
      // A socket that is already closing would be seated and then hold the slot for the whole grace.
      let w = waiting.shift();
      while (w && w.ws.readyState !== OPEN) w = waiting.shift();
      if (w) seat(s, w.id, w.ws, { took: !!held });
    }
    if (waiting.length !== before) toHost({ t: 'full', waiting: waiting.length });
  }

  function addPad(ws, id) {
    ws._role = 'pad';
    ws._id = id;
    ws._slot = -1;
    // Same id comes back (reload, network blip): take its slot, kicking a stale socket if any.
    const mine = slots.findIndex((s) => s && s.id === id);
    if (mine >= 0) {
      const old = slots[mine].ws;
      if (old && old !== ws) {
        old._slot = -1;
        old._replaced = true;
        try { old.close(4001, 'replaced'); } catch {}
      }
      seat(mine, id, ws);
      return;
    }
    // An id already queued: replace the queued socket.
    const q = waiting.findIndex((w) => w.id === id);
    if (q >= 0) {
      const old = waiting[q].ws;
      old._replaced = true;
      try { old.close(4001, 'replaced'); } catch {}
      waiting.splice(q, 1);
    }
    // Not with people in the queue before it: it would pass them all.
    const off = waiting.length ? -1 : offlineSeat();
    if (off >= 0) {
      seat(off, id, ws, { took: true });
      return;
    }
    const free = slots.findIndex((s) => !s);
    if (free >= 0) {
      seat(free, id, ws);
      return;
    }
    waiting.push({ id, ws });
    send(ws, { t: 'full' });
    toHost({ t: 'full', waiting: waiting.length }); // the TV shows "the room is full" too
    log(`pad ${id.slice(0, 8)} waiting (room full)`);
  }

  // A reservation given up: never a seat with a phone on it. The TV hears it so that its seat goes too.
  function freeSlot(slot) {
    const entry = slots[slot];
    if (!entry || entry.ws) return false;
    if (entry.timer) clearTimeout(entry.timer);
    slots[slot] = null;
    log(`slot ${slot} free`);
    toHost({ t: 'free', slot });
    return true;
  }

  // The grace is over: nobody waits for it any more. In the lobby the seat goes. During a game it stays, because results,
  // a table and a kart on the road still have that player's name on them: the TV hears it, and the queue may take it.
  function expire(slot) {
    const entry = slots[slot];
    if (!entry || entry.ws) return false;
    if (entry.timer) clearTimeout(entry.timer);
    entry.timer = null;
    entry.expired = true;
    if (!session) return freeSlot(slot);
    log(`slot ${slot} past its grace, kept until the lobby`);
    toHost({ t: 'expired', slot });
    return true;
  }

  // The Mac moved to another network: a phone can only come back with a new id, so nobody is coming back for a
  // reservation. Every seat without a phone stops waiting at once, and the queue takes them lowest first.
  function releaseAway() {
    let freed = 0;
    for (let s = 0; s < slots.length; s++) if (expire(s)) freed++;
    if (freed) promoteWaiting();
    return freed;
  }

  function setSession(on, name) {
    session = on;
    if (typeof name === 'string') phase = name;
    if (on) return;
    picked = false;
    let freed = 0;
    for (let s = 0; s < slots.length; s++) if (slots[s]?.expired && freeSlot(s)) freed++;
    if (freed) promoteWaiting();
  }

  function removePad(ws, why = 'closed') {
    if (ws._replaced) return;
    const wi = waiting.findIndex((w) => w.ws === ws);
    if (wi >= 0) {
      waiting.splice(wi, 1);
      toHost({ t: 'full', waiting: waiting.length });
    }
    const slot = ws._slot;
    if (slot < 0 || !slots[slot] || slots[slot].ws !== ws) return;
    const entry = slots[slot];
    entry.ws = null;
    entry.awayAt = Date.now();
    toHost({ t: 'leave', slot });
    log(`pad ${entry.id.slice(0, 8)} left slot ${slot} (${why}), reserved ${reserveMs} ms`);
    telemetry({ e: 'drop', slot, why, phase });
    entry.timer = setTimeout(() => {
      if (slots[slot] !== entry || entry.ws) return;
      if (expire(slot)) promoteWaiting();
    }, reserveMs);
    entry.timer.unref?.();
  }

  function addHost(ws) {
    ws._role = 'host';
    send(ws, { t: 'hello', boot, reserveMs }); // before the joins: a TV that sees a new boot starts again from these
    if (host && host !== ws) {
      const old = host;
      old._replaced = true;
      try { old.close(4000, 'replaced'); } catch {}
      log('host replaced by a newer tab');
    }
    host = ws;
    for (let s = 0; s < slots.length; s++) {
      if (slots[s]?.ws) {
        send(ws, { t: 'join', slot: s, color: SLOT_COLORS[s] });
        send(slots[s].ws, { t: 'host', on: true });
      }
    }
    if (waiting.length) send(ws, { t: 'full', waiting: waiting.length });
    log('host connected');
  }

  function removeHost(ws) {
    if (host !== ws) return;
    host = null;
    for (const s of slots) if (s?.ws) send(s.ws, { t: 'host', on: false });
    log('host disconnected');
  }

  function fromPad(ws, m) {
    if (m.t === 'ping') {
      ws._pings = true; // it speaks the pad page's keep-alive: the server may hold it to padSilentMs
      send(ws, { t: 'pong', ts: Number.isFinite(m.ts) ? m.ts : 0 });
      return;
    }
    const slot = ws._slot;
    if (slot < 0 || slots[slot]?.ws !== ws) return;
    if (m.t === 'pick') {
      const pick = sanitizePick(m);
      if (!pick) return;
      picked = true;
      toHost({ t: 'pick', slot, ...pick });
      return;
    }
    if (m.t === 'vote') {
      const vote = sanitizeVote(m);
      if (vote) toHost({ t: 'vote', slot, ...vote });
      return;
    }
    if (m.t === 'team') {
      const team = sanitizeTeam(m);
      if (team) toHost({ t: 'team', slot, ...team });
      return;
    }
    if (m.t === 'mode') {
      if (m.input === 'stick' || m.input === 'gyro') toHost({ t: 'mode', slot, input: m.input }); // what the telemetry calls this phone's way of steering
      return;
    }
    if (m.t === 'advance') {
      toHost({ t: 'advance', slot, ...sanitizeAdvance(m) }); // every phone has this one: the TV knows who may skip
      return;
    }
    if (m.t === 'opt') {
      if (slot !== authority() && picked) return;
      const opt = sanitizeOpt(m);
      if (opt) toHost({ t: 'opt', slot, ...opt });
      return;
    }
    const input = sanitizeInput(m);
    if (!input) return;
    toHost({ t: 'in', slot, ...input });
  }

  function fromHost(ws, m) {
    if (ws !== host) return;
    if (m.t === 'game') { setSession(m.on === true, m.phase); return; }
    if (m.t === 'tm') { telemetry(m.d); return; }
    if (typeof m.t !== 'string' || !Number.isInteger(m.slot)) return;
    if (m.t === 'release') {
      if (freeSlot(m.slot)) promoteWaiting();
      return;
    }
    if (m.t === 'phase' && m.phase === 'lobby') picked = false;
    const entry = slots[m.slot];
    if (entry?.ws) send(entry.ws, m);
  }

  function message(ws, raw) {
    if (raw.length > 4096) return;
    let m;
    try { m = JSON.parse(raw.toString()); } catch { return; }
    if (!m || typeof m !== 'object' || Array.isArray(m)) return;
    if (ws._role === 'pad') fromPad(ws, m);
    else if (ws._role === 'host') fromHost(ws, m);
  }

  function close() {
    for (const s of slots) if (s?.timer) clearTimeout(s.timer);
  }

  const status = () => ({
    host: !!host,
    slots: slots.map((s) => (s ? { id: s.id, connected: !!s.ws, expired: !!s.expired } : null)),
    waiting: waiting.length,
  });

  return { addPad, removePad, addHost, removeHost, releaseAway, message, close, status };
}
