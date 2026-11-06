// Racing Karts, the TV page: ties the phones (src/net), the rules of the evening (src/game/flow.js), the race (src/sim), the
// picture (src/render), the sound (src/audio) and the screens (src/ui) together. The sim steps at a fixed 1/60 s and the drawing
// interpolates between steps.
//
// Query params, for tools: ?track=bali&kart=jeep&bots=7&difficulty=hard&auto=1 skips the menus; ?players=n seats n humans,
// ?views=n does the same counted as views; ?laps=n, ?seed=n, ?lang=it, ?flyover=0, ?countdown=n, ?manual=1. window.__game: see the
// bottom of this file.
import { createWsTransport } from './net/ws-transport.js';
import { createInput, stickThrottle } from './net/input.js';
import { createRenderer } from './render/index.js';
import { createAudio } from './audio/index.js';
import { buildTrack } from './world/track.js';
import { buildTerrain } from './world/terrain.js';
import { createRace, DT } from './sim/index.js';
import { KART_IDS, ROSTER, SECRET_IDS, kartInfo } from './data/karts.js';
import { createUnlocks } from './game/unlocks.js';
import { TRACKS, TRACK_IDS, trackInfo, loadTrackDef } from './data/tracks.js';
import { ITEM_IDS } from './data/items.js';
import { createFlow, createHudFeed, hudOf, padFx, resultRows, teamScore, RANDOM, SLOTS } from './game/flow.js';
import { teamInfo, NEUTRAL_COLOR } from './data/teams.js';
import { weatherKey } from './data/weather.js';
import { createRecords, createTimeTrial, trackSeed } from './game/timetrial.js';
import { formaHud, formaRows } from './game/forma.js';
import { createUI } from './ui/index.js';
import { createBooth } from './game/booth.js';
import { createCaption } from './ui/screens/caption.js';
import { itemIcon } from './ui/icons.js';
import { detectLang, saveLang, pickLabel, LANGS } from './i18n/index.js';
import { SLOT_COLORS } from '../server/room.js';

const Q = new URLSearchParams(location.search);
const num = (k, d = null) => (Q.has(k) && Number.isFinite(+Q.get(k)) ? +Q.get(k) : d);
const P = {
  track: Q.get('track'), kart: Q.get('kart'), bots: num('bots'), difficulty: Q.get('difficulty'), auto: Q.get('auto') === '1',
  views: num('views'), players: num('players'), laps: num('laps'), seed: num('seed'), lang: LANGS.includes(Q.get('lang')) ? Q.get('lang') : null,
  flyover: Q.get('flyover') !== '0' && !Q.has('manual'), countdown: num('countdown', 3), manual: Q.get('manual') === '1', quality: Q.get('quality') || 'auto',
};

const FLYOVER_S = 6.5;
const AFTER_DONE = 2.6;   // s of the finish on the road before the results take the TV
const TAKEOVER_S = 15;    // s a gone phone's kart coasts, before a bot drives it so that the race can end
const FREE_SEAT_S = 60;   // the room keeps a seat this long: the same on this side
const MENU_GUARD = 0.5;   // s after a screen appears during which a held key does not count as a press

let lang = P.lang || detectLang();
document.documentElement.lang = lang;

// ---------- the window on the game ----------
const game = {
  phase: 'loading', mode: 'boot', ready: false, error: null, manual: P.manual, auto: P.auto, t: 0, fps: 0, track: null, views: [], laps: 0,
  pads: [false, false, false, false], seats: [], results: null, podium: null, flow: null, paused: false, flyover: false, frames: 0, speed: 1, counts: {},
  get state() { return race?.state ?? null; },
};
window.__game = game;

const canvas = document.getElementById('game');
const boot = document.getElementById('boot');
let showFailure = null; // set once the screens exist: an error nobody can see is a frozen TV
window.addEventListener('error', (e) => { game.error ||= e.message; showFailure?.(); });
window.addEventListener('unhandledrejection', (e) => { game.error ||= String(e.reason?.stack || e.reason); console.error(e.reason); });

let R = null;
try {
  R = createRenderer(canvas, { quality: P.quality });
} catch (e) {
  game.error = String(e?.message || e);
}

// ---------- the small rendered karts of the menus ----------
// One showcase per kart, kept for the whole session: each is a GL context, and a browser only gives so many.
const stageCache = new Map();
const thumbs = new Map();
const MAX_STAGES = 12;
function stage(id, n = 0) {
  const key = `${id}#${n}`;
  if (!stageCache.has(key)) {
    if (stageCache.size >= MAX_STAGES) return stageCache.get(`${id}#0`) || Promise.reject(new Error('too many stages'));
    stageCache.set(key, R.showcase(id, { size: 512, yaw: 2.5, color: kartInfo(id)?.color }));
  }
  return stageCache.get(key);
}
// Thumbnails for the results, taken once from a showcase and then free.
async function makeThumb(id) {
  if (thumbs.has(id)) return thumbs.get(id);
  const s = await stage(id, 0);
  const yaw = 2.5;
  s.draw(0, yaw);
  const c = document.createElement('canvas');
  c.width = 160; c.height = 160;
  // the kart fills the middle of its canvas: crop to it
  const w = s.canvas.width, m = w * 0.11;
  c.getContext('2d').drawImage(s.canvas, m, m * 0.35, w - m * 2, w - m * 2, 0, 0, 160, 160);
  const url = c.toDataURL('image/png');
  thumbs.set(id, url);
  return url;
}
// ---------- wiring ----------
const audio = createAudio();
const sound = (type) => audio.onEvents([{ type }]);
const ui = createUI(document.body, {
  lang, karts: ROSTER, tracks: TRACKS, itemIds: ITEM_IDS, sound,
  stage, thumb: (id) => thumbs.get(id) || '', has: (id) => !!kartInfo(id),
  icon: itemIcon,
});
// The family karts, won by winning Gran Premi and kept on this browser. ?unlock=all opens them for tools, for this page only.
const browserStore = () => { try { return localStorage; } catch { return null; } };
const unlocks = createUnlocks(Q.get('unlock') === 'all' ? null : browserStore());
if (Q.get('unlock') === 'all') for (const _ of SECRET_IDS) unlocks.winGp();
game.unlocks = unlocks;
const flow = createFlow({ karts: KART_IDS, secret: unlocks.open, tracks: TRACK_IDS, regions: Object.fromEntries(TRACKS.map((t) => [t.id, t.region])) });
// The commentary: off unless someone chose it, and the choice stays on this browser. ?voice=it for tools.
const VOICE_KEY = 'racing-karts.voice';
const booth = createBooth({ audio, caption: createCaption(ui.root) });
Object.defineProperty(game, 'voice', { get: () => booth.debug, enumerable: false });
function syncVoice() {
  const v = flow.opts.voice ?? 'off';
  if (v === booth.lang) return;
  booth.set(v);
  if (!Q.has('voice')) { try { if (v === 'off') localStorage.removeItem(VOICE_KEY); else localStorage.setItem(VOICE_KEY, v); } catch { /* memory for the evening */ } }
}
{
  let wanted = Q.get('voice');
  if (wanted === null) { try { wanted = localStorage.getItem(VOICE_KEY); } catch { /* no storage */ } }
  if (wanted) { flow.setOpts({ voice: wanted }); flow.drain(); syncVoice(); }
}
const pickData = () => ({ karts: flow.pickable, locked: unlocks.locked, teams: flow.teamMode });
// ?weather=rain|snow|fog|surprise and ?night=1 for tools; the lobby's chips otherwise
if (Q.has('weather') || Q.has('night')) { flow.setOpts({ ...(Q.has('weather') ? { weather: Q.get('weather') } : {}), ...(Q.has('night') ? { night: Q.get('night') === '1' } : {}) }); flow.drain(); }
Object.defineProperty(game, 'weather', { get: () => flow.weather, enumerable: false });
Object.defineProperty(game, 'flowApi', { value: flow, enumerable: false });
Object.defineProperty(game, 'ui', { value: ui, enumerable: false });
Object.defineProperty(game, 'renderer', { value: R, enumerable: false });
Object.defineProperty(game, 'audio', { value: audio, enumerable: false });

// A lost GPU context: three.js rebuilds what it holds when the browser gives the context back, this says what is going on.
showFailure = () => { if (mode === 'race' || mode === 'fly' || mode === 'after') ui.error('err.title', 'err.runtime'); };
canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); game.gpuLost = true; ui.error('err.title', 'err.gpu'); });
canvas.addEventListener('webglcontextrestored', () => { game.gpuLost = false; if (!tickError) ui.clearError(); });

const transport = createWsTransport();
const input = createInput(transport);
transport.onStatus?.((s) => { if (s === 'replaced') ui.error('err.title', 'err.replaced'); });

let padUrl = `${location.protocol}//${location.host}/pad`;
// The Mac can change network at any time (Wi-Fi to the phone's hotspot): keep asking, so the QR always shows an address
// that phones on the current network can reach.
const refreshPadUrl = () => fetch('/api/info').then((r) => (r.ok ? r.json() : null)).then((info) => {
  if (info?.padUrl && info.padUrl !== padUrl) { padUrl = info.padUrl; paintMenu(); paintRejoin(); }
}).catch(() => {});
refreshPadUrl();
setInterval(refreshPadUrl, 3000);

// Which tracks exist yet: a track file not written is not offered.
let available = [...TRACK_IDS];
const blurbs = {};
const trackDefs = new Map();
const tracksReady = Promise.allSettled(TRACK_IDS.map((id) => loadTrackDef(id).then((d) => { trackDefs.set(id, d); blurbs[id] = d.blurb; return id; }))).then((list) => {
  const ok = list.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  if (ok.length) { available = ok; flow.tracks = ok; }
});

// ---------- the race in hand ----------
let race = null, track = null, terrain = null, worldId = null;
let mode = 'menu';   // menu | fly | race | after | off
let paused = false;
let prev = null;
const prevKarts = [];
let acc = 0, pending = [], last = 0;
let doneT = null, goT = 0;
let colors = [], players = [], viewKarts = [];
const hudFeed = createHudFeed();
const awayT = [0, 0, 0, 0];
const freeTimer = [null, null, null, null];
let waiting = 0;
let menuGuard = 0;
let scripted = null;
let raceToken = 0;
let tt = null;       // the time trial in progress, null in every other race
const records = createRecords();
const ghostsAt = (alpha) => { if (tt) R.setGhostPoses(tt.poses(alpha)); };

function capturePrev() {
  const K = race.state.karts;
  for (let i = 0; i < K.length; i++) prevKarts[i] = Object.assign(prevKarts[i] || {}, K[i]);
  prevKarts.length = K.length;
  prev.karts = prevKarts;
}

function humanInputs() {
  const out = [];
  for (const k of race.state.karts) {
    if (!k.human) continue;
    if (game.auto) { tt?.taint(k.i); out[k.i] = race.autopilot(k.i); continue; }
    if (scripted) { const v = scripted(k.i, k); if (v !== undefined) { out[k.i] = v; continue; } }
    const g = input.get(k.slot);
    const seat = flow.seats[k.slot];
    if (g.source) {
      out[k.i] = { steer: g.x, throttle: g.source === 'pad' ? stickThrottle(g.x, g.y) : g.y, item: g.item, drift: g.drift };
      if (awayT[k.slot]) { awayT[k.slot] = 0; ui.screens.hud.setMissing(k.slot, null); }
    } else if (seat?.source !== 'pad') {
      // a keyboard seat before its first key: the throttle is automatic anyway
      out[k.i] = { steer: 0, throttle: 1, item: false, drift: false };
    } else {
      // the phone is gone: it coasts, the TV says who is missing, and then a bot takes it home
      const before = awayT[k.slot];
      awayT[k.slot] = before + DT;
      if (!before) ui.screens.hud.setMissing(k.slot, 'gone');
      if (awayT[k.slot] >= TAKEOVER_S) {
        if (before < TAKEOVER_S) ui.screens.hud.setMissing(k.slot, 'bot');
        tt?.taint(k.i); // a lap a bot drove is nobody's record
        out[k.i] = race.autopilot(k.i);
      }
    }
  }
  return out;
}

function stepOnce() {
  capturePrev();
  race.step(humanInputs());
  for (const e of race.drainEvents()) pending.push(e);
  if (tt) for (const e of tt.step(race.state)) pending.push(e);
}

function afterSteps(simDt) {
  if (race.state.phase === 'done' && flow.phase === 'race') {
    doneT = (doneT ?? 0) + simDt;
    if (doneT >= AFTER_DONE) {
      game.results = resultRows(race.state.karts);
      if (tt) for (const r of game.results) r.tt = tt.result(r.i);
      if (race.state.forma) formaRows(game.results, race.state.forma);
      flow.raceDone(game.results);
      pump();
    }
  }
}

function deliver(events, dt) {
  const st = race.state;
  if (events.length) {
    for (const e of events) { game.counts[e.type] = (game.counts[e.type] || 0) + 1; if (e.type === 'itemUse') game.counts[`use:${e.item}`] = (game.counts[`use:${e.item}`] || 0) + 1; }
    audio.onEvents(events, st, viewKarts);
    if (tt) for (const e of events) {
      if (e.type === 'ttSplit' && e.delta !== null) sound(e.delta < 0 ? 'confirm' : 'move');
      if (e.type === 'ttLap' && e.record && !e.first) audio.onEvents([{ type: 'cheer', id: st.karts[e.kart].kart }]);
    }
    for (const e of events) if (e.type === 'autoHome') ui.toast(ui.t('hud.autoHome', { n: st.karts[e.kart].slot + 1 }));
    ui.screens.hud.events(events, st);
    for (const m of padFx(events, st.karts)) {
      const { slot, ...fx } = m;
      input.send(slot, { t: 'fx', ...fx });
    }
    for (const e of events) if (e.type === 'go') goT = st.t;
  }
  booth.frame(events, st);
  audio.update(st, dt);
  sendHuds();
  game.t = st.t;
}

function sendHuds(force = false) {
  if (!race) return;
  const now = performance.now() / 1000;
  for (const k of race.state.karts) {
    if (!k.human || k.slot < 0 || !input.padConnected(k.slot)) continue;
    const h = hudOf(k, race.state.laps);
    if (tt) { h.tt = true; h.delta = tt.view(k.i)?.delta ?? null; }
    if (race.state.forma) formaHud(h, race.state.forma, k);
    if (k.team) { h.team = k.team; h.score = teamScore(race.state.karts, flow.state.gp?.teams); }
    if (force || hudFeed.due(k.slot, h, now)) input.send(k.slot, { t: 'hud', ...h });
  }
}

// ---------- the loop ----------
function loop(now) {
  requestAnimationFrame(loop);
  try { tick(now); } catch (e) { tickFailed(e); }
}
// It would throw again on every frame, so it says so once and on the TV: without this the picture just stops.
let tickError = false;
function tickFailed(e) {
  game.error ||= String(e?.stack || e?.message || e);
  if (tickError) return;
  tickError = true;
  console.error(e);
  ui.error('err.title', 'err.runtime');
}
function tick(now) {
  const real = Math.min(0.1, (now - last) / 1000 || 1 / 60);
  last = now;
  game.fps += (1 / Math.max(real, 0.001) - game.fps) * 0.05;
  game.frames++;
  flow.step(real);
  pump();
  menuInputs(real);
  ui.tick(real);
  if (flow.phase === 'results' && flow.state.resultsT > 0) ui.screens.results.countdown(flow.state.resultsT);
  if (!race || mode === 'off' || mode === 'menu') return;
  if (game.manual) return;
  if (mode === 'fly') {
    pollSkip();
    R.frame(prev, race.state, 1, real, []);
    return;
  }
  if (paused) { R.frame(prev, race.state, 1, 0, []); return; }
  // game.speed: tests run the race faster than real time
  acc += real * game.speed;
  const most = 8 * game.speed;
  let n = 0;
  while (acc >= DT && n < most) { stepOnce(); acc -= DT; n++; }
  if (n === most) acc = 0;
  afterSteps(n * DT);
  if (!race) return;
  const ev = pending;
  pending = [];
  deliver(ev, real);
  if (mode === 'race' || mode === 'after') {
    ui.screens.hud.frame(race.state, real);
    ghostsAt(Math.min(1, acc / DT));
    R.frame(prev, race.state, Math.min(1, acc / DT), real, ev);
  }
}

// ---------- flow: what happens when ----------
function pump() {
  let touched = false;
  for (const e of flow.drain()) {
    touched = true;
    switch (e.type) {
      case 'phase': onPhase(e.phase); break;
      case 'opts': syncVoice(); break;
      case 'join':
      case 'back':
        if (flow.phase === 'race' && !race?.state.karts.some((k) => k.human && k.slot === e.slot)) ui.toast(ui.t('hud.nextRace', { n: e.slot + 1 }));
        break;
      case 'unlock': input.send(e.slot, { t: 'menu', lock: false }); break;
      case 'free': input.send(e.slot, { t: 'release' }); break; // the room gives the seat up too, a newcomer may be waiting
      case 'spin': sound('move'); break;
      case 'landed': sound('confirm'); break;
      case 'gpWon': {
        const won = unlocks.winGp();
        flow.extra = unlocks.open;
        if (won) flow.announce(won);
        break;
      }
      default: break;
    }
  }
  if (touched) { paintMenu(); syncPhones(); paintRejoin(); }
}

// The QR only lives in the lobby: with a seat missing anywhere else, a phone that changed network must find it here.
function paintRejoin() {
  const missing = flow.phase !== 'lobby' && flow.seats.some((s) => s.present && s.away && s.source === 'pad');
  ui.rejoin(missing ? padUrl : null, flow.phase !== 'race' && flow.phase !== 'loading');
}

// On the way to the lobby a seat nobody is in is given up: the TV forgot it, the room must too. The room keeps any seat
// with a phone on it, whatever this says.
function releaseAbsent() {
  for (let s = 0; s < 4; s++) if (!input.padConnected(s)) input.send(s, { t: 'release' });
}

// The server restarted: an empty room, and phones that come back in whatever order they reconnect. Seats kept from before
// would hand the karts to the wrong phones, so everyone starts again from the lobby, and is told.
let serverBoot = null;
function onHello(id) {
  const restarted = serverBoot !== null && serverBoot !== id;
  serverBoot = id;
  if (restarted) {
    for (let s = 0; s < 4; s++) { clearTimeout(freeTimer[s]); ui.screens.hud.setMissing(s, null); awayT[s] = 0; }
    lastPhase.fill(null);
    flow.reset();
    pump();
    ui.toast(ui.t('err.restart'));
  }
  if (flow.phase === 'lobby') releaseAbsent();
}

function seatsSnapshot() { return flow.seats.map((s) => ({ ...s })); }

function paintMenu() {
  game.phase = flow.phase;
  game.seats = seatsSnapshot();
  const seats = game.seats;
  switch (flow.phase) {
    case 'lobby': ui.update('lobby', { seats, opts: { ...flow.opts }, padUrl, waiting }); break;
    case 'pick': ui.update('pick', { ...pickData(), seats, allReady: flow.state.readyT !== null, hasKeyboard: seats.some((s) => s.present && s.source === 'keyboard') }); break;
    case 'vote': ui.update('vote', voteData()); break;
    default: break;
  }
}

const voteData = () => ({
  seats: seatsSnapshot(), vote: { ...flow.state.vote }, available, blurbs, mode: flow.opts.mode, opts: { ...flow.opts }, list: [...flow.state.list], gpMin: flow.gpMin, gpFill: Math.max(flow.gpMin, Math.min(3, available.length)),
  regions: [...new Set(available.map((id) => trackInfo(id)?.region).filter(Boolean))],
  records: flow.opts.mode === 'time' ? trackRecords() : null,
});
// What the vote cards of a time trial show: the first driver's time with their kart, or else the track's best with any kart.
function trackRecords() {
  const kart = flow.seats.find((s) => s.present && s.kart)?.kart, out = {};
  for (const id of available) out[id] = { mine: records.best(id, kart)?.lap ?? null, best: records.trackBest(id)?.lap ?? null };
  return out;
}

function onPhase(phase) {
  game.phase = phase;
  menuGuard = MENU_GUARD;
  if (phase !== 'race' && phase !== 'loading' && paused) setPaused(false);
  switch (phase) {
    case 'lobby':
      stopRace();
      audio.music('menu');
      releaseAbsent();
      ui.show('lobby', { seats: seatsSnapshot(), opts: { ...flow.opts }, padUrl, waiting });
      break;
    case 'pick': {
      stopRace();
      audio.music('menu');
      for (const s of flow.present()) if (flow.seats[s].source === 'keyboard' && !flow.seats[s].kart) flow.pick(s, KART_IDS[s % KART_IDS.length], false);
      ui.show('pick', { ...pickData(), seats: seatsSnapshot(), allReady: false, hasKeyboard: flow.seats.some((s) => s.present && s.source === 'keyboard') });
      break;
    }
    case 'vote':
      stopRace();
      audio.music('menu');
      for (const s of flow.present()) if (flow.seats[s].source === 'keyboard') flow.vote(s, available[0], false);
      ui.show('vote', voteData());
      break;
    case 'loading': loadRace(flow.state.track); break;
    case 'race': break;
    case 'results': showResults(); break;
    case 'podium': showPodium(); break;
    default: break;
  }
  syncPhones();
}

// ---------- phones ----------
const lastPhase = [null, null, null, null];
const lastMenu = [{}, {}, {}, {}];
function syncPhones() {
  for (let s = 0; s < SLOTS; s++) {
    if (!input.padConnected(s)) continue;
    const ph = flow.phoneFor();
    if (lastPhase[s] !== ph) {
      lastPhase[s] = ph;
      lastMenu[s] = {};
      input.send(s, { t: 'phase', phase: ph });
    }
    const m = flow.menuFor(s);
    const diff = {};
    for (const [k, v] of Object.entries(m)) {
      const js = JSON.stringify(v);
      if (lastMenu[s][k] !== js) { lastMenu[s][k] = js; diff[k] = v; }
    }
    if (Object.keys(diff).length) input.send(s, { t: 'menu', ...diff });
  }
}

input.on((m) => {
  if (m.t === 'join') {
    clearTimeout(freeTimer[m.slot]);
    flow.join(m.slot, 'pad');
    awayT[m.slot] = 0;
    ui.screens.hud.setMissing(m.slot, null);
    lastPhase[m.slot] = null;
    pump();
    syncPhones();
    hudFeed.forget(m.slot);
    sendHuds(true);
  } else if (m.t === 'leave') {
    flow.leave(m.slot);
    clearTimeout(freeTimer[m.slot]);
    freeTimer[m.slot] = setTimeout(() => { flow.free(m.slot); pump(); }, FREE_SEAT_S * 1000);
    pump();
  } else if (m.t === 'full') {
    waiting = m.waiting ?? 1;
    paintMenu();
  }
  game.pads = [0, 1, 2, 3].map((s) => input.padConnected(s));
});

transport.onMessage((m) => {
  if (m?.t === 'hello') { onHello(m.boot); return; }
  if (!m || !Number.isInteger(m.slot)) return;
  if (m.t === 'free') { clearTimeout(freeTimer[m.slot]); flow.free(m.slot); pump(); return; }
  if (m.t === 'pick') { if (flow.pick(m.slot, m.kart, m.ready === true)) pump(); return; }
  if (m.t === 'vote') { if (flow.vote(m.slot, m.track, m.lock === true)) pump(); return; }
  if (m.t === 'team') { if (flow.setTeam(m.slot, m.team)) pump(); return; }
  if (m.t === 'opt') {
    flow.setOpts(m);
    if (m.go) flow.go();
    if (m.next) nextFrom(m.next);
    pump();
  }
});

function nextFrom(kind) {
  if (kind === 'podium') { flow.toPodium(); return; }
  flow.next(kind);
}

// ---------- TV: mouse ----------
ui.on('go', () => { flow.go(); pump(); });
ui.on('opt', (o) => { flow.setOpts(o); pump(); });
ui.on('team', ({ slot, team }) => { flow.setTeam(slot, team); pump(); });
ui.on('lang', (l) => { lang = l; saveLang(l); ui.setLang(l); paintMenu(); });
ui.on('pickKart', (id) => { flow.pickFromTV(id); pump(); });
ui.on('pickTrack', (id) => {
  if (flow.gpMode) { if (id === RANDOM) flow.gpStart(); else flow.gpToggle(id); } else flow.forceTrack(id);
  pump();
});
ui.on('gpGo', () => { flow.gpStart(); pump(); });
ui.on('gpPreset', (p) => { flow.gpPreset(p); pump(); });
ui.on('next', (kind) => { nextFrom(kind); pump(); });
ui.on('cheer', (id) => audio.onEvents([{ type: 'cheer', id }]));
ui.on('pause', () => setPaused(!paused));
ui.on('pauseAction', (a) => {
  setPaused(false);
  if (a === 'restart') { flow.restart(); pump(); }
  if (a === 'quit') { flow.quit(); pump(); }
});

function setPaused(on) {
  if (paused === on) return;
  paused = on;
  game.paused = on;
  ui.pause(on);
  audio.setVolume('music', on ? 0.4 : 1);
  if (on) booth.hush();
}

// ---------- TV: keys in the menus ----------
const kbPrev = [0, 0, 0, 0].map(() => ({ x: 0, item: false }));
function menuInputs(dt) {
  menuGuard = Math.max(0, menuGuard - dt);
  const ph = flow.phase;
  if (!['lobby', 'pick', 'vote', 'results', 'podium'].includes(ph)) return;
  for (let s = 0; s < SLOTS; s++) {
    if (input.padConnected(s)) continue;
    const g = input.get(s);
    if (g.source !== 'keyboard') continue;
    if (!flow.seats[s].present && (ph === 'lobby' || ph === 'pick')) { flow.join(s, 'keyboard'); if (ph === 'pick') flow.pick(s, KART_IDS[s % KART_IDS.length], false); }
    const p = kbPrev[s];
    const dir = Math.abs(g.x) > 0.5 ? Math.sign(g.x) : 0;
    const moved = dir && dir !== p.x;
    const pressed = g.item && !p.item;
    p.x = dir; p.item = g.item;
    if (menuGuard > 0) continue;
    if (ph === 'lobby' && moved && flow.teamMode && flow.seats[s].present) { flow.setTeam(s, dir < 0 ? 'a' : 'b'); sound('move'); }
    if (ph === 'lobby' && pressed) flow.go();
    else if (ph === 'pick' && flow.seats[s].present) {
      const seat = flow.seats[s], line = flow.pickable, at = Math.max(0, line.indexOf(seat.kart));
      if (moved && !seat.ready) { flow.pick(s, line[(at + dir + line.length) % line.length], false); sound('move'); }
      if (pressed) { flow.pick(s, seat.kart || KART_IDS[0], !seat.ready); sound('confirm'); }
    } else if (ph === 'vote' && flow.seats[s].present) {
      const list = [...available, RANDOM], seat = flow.seats[s], at = Math.max(0, list.indexOf(seat.track));
      if (moved && !seat.lock) { flow.vote(s, list[(at + dir + list.length) % list.length], false); sound('move'); }
      if (pressed) { flow.vote(s, seat.track || list[0], !seat.lock); sound('confirm'); }
    } else if ((ph === 'results' || ph === 'podium') && pressed) nextFrom(flow.gpMore || flow.opts.mode === 'time' ? 'rematch' : ph === 'results' ? 'podium' : 'rematch');
  }
  pump();
}
addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (flow.phase === 'race' && mode === 'race') setPaused(!paused);
  }
  if (mode === 'fly') skipFly();
  unlockAudio();
});
addEventListener('pointerdown', () => {
  unlockAudio();
  if (mode === 'fly') skipFly();
});

// ---------- sound ----------
let unlocked = false;
function unlockAudio() {
  if (unlocked) return;
  unlocked = true;
  audio.unlock();
  ui.sticker(false);
}

// ---------- loading and racing ----------
function stopRace() {
  race = null;
  mode = 'menu';
  doneT = null;
  scripted = null;
  tt = null; game.tt = null;
  raceToken++;
  booth.end();
  game.flyover = false;
}

const regionLabel = (id) => { const i = trackInfo(id); return pickLabel(lang, i?.regionNames) || ui.t(`region.${i?.region}`); };
const trackLabel = (id) => pickLabel(lang, trackInfo(id)?.names) || id;

async function loadRace(id) {
  const token = ++raceToken;
  mode = 'off';
  race = null;
  doneT = null;
  pending = [];
  paused = false;
  const def0 = trackDefs.get(id);
  ui.show('loading', { track: id, trackName: trackLabel(id), regionName: regionLabel(id), blurb: def0 ? pickLabel(lang, def0.blurb) : '' });
  audio.music('menu');
  const load = ui.screens.loading;
  const tick = (v) => { load.progress(v); return new Promise((r) => requestAnimationFrame(() => r())); };
  try {
    await tick(0.05);
    let def = def0 || await loadTrackDef(id);
    // tools/shoot-disasters.mjs: any disaster or hazard on any track
    if (Q.has('disasters')) def = { ...def, disasters: JSON.parse(Q.get('disasters')) };
    if (Q.has('hazards')) def = { ...def, hazards: JSON.parse(Q.get('hazards')) };
    // the sky is part of the world: the same road under another one is built again
    const wx = flow.weather, worldKey = `${id}|${weatherKey(wx)}`;
    if (worldId !== worldKey) {
      track = buildTrack(def);
      await tick(0.15);
      terrain = buildTerrain(track);
      await tick(0.3);
      // the slow part: the whole world, built in one go
      await R.loadTrack(track, terrain, { weather: wx });
      worldId = worldKey;
    }
    await tick(0.75);
    if (token !== raceToken) return;
    const field = flow.field();
    const limit = P.views ?? 4;
    players = field.map((p, i) => ({
      slot: p.human ? p.slot : -1, kart: p.kart, human: p.human, name: p.human ? ui.t('res.you', { n: p.slot + 1 }) : kartInfo(p.kart)?.driver?.name,
      difficulty: p.human && game.auto ? 'ace' : undefined, i, ...(p.team !== undefined ? { team: p.team } : {}),
    }));
    const timeTrial = flow.opts.mode === 'time';
    // against the clock the road must be the same road every try: same animals, same traffic
    const seed = P.seed ?? (timeTrial ? trackSeed(id) : ((Math.random() * 1e9) | 0));
    const laps = def.long ? (P.laps ?? 1) : flow.state.gp ? flow.opts.laps : (P.laps ?? flow.opts.laps); // a long track is one lap, whatever the lobby says for the others
    race = createRace({ track, terrain, seed, laps, players, difficulty: flow.opts.difficulty, countdown: P.countdown, timeTrial, forma: flow.opts.mode === 'forma' && !flow.state.gp ? (num('formaT') ? { duration: num('formaT') } : true) : false, ...(wx ? { weather: wx } : {}) });
    R.setPatches(race.patches);
    const drivers = players.filter((p) => p.human).map((p) => ({ i: p.i, kart: p.kart }));
    tt = timeTrial ? createTimeTrial({ track, trackId: id, laps, karts: drivers, records }) : null;
    game.tt = tt;
    await R.setGhosts(timeTrial ? drivers.map((d) => ({ kart: d.kart, owner: d.i })) : []);
    colors = players.map((p) => (p.human ? SLOT_COLORS[p.slot] : kartInfo(p.kart)?.color || '#c9513d'));
    // the map and the overview count two sides: everyone else goes pale
    if (flow.state.gp?.teams) colors = players.map((p) => teamInfo(p.team)?.color ?? NEUTRAL_COLOR);
    await R.setKarts(players.map((p, i) => ({ kart: p.kart, color: colors[i], ...(p.team ? { team: p.team } : {}) })));
    viewKarts = players.map((p, i) => (p.human ? i : -1)).filter((i) => i >= 0).slice(0, Math.max(1, limit));
    if (!viewKarts.length) viewKarts = [0];
    R.setViews(viewKarts);
    await tick(0.92);
    if (token !== raceToken) return;
    prev = { karts: [] };
    capturePrev();
    acc = 0;
    hudFeed.reset();
    awayT.fill(0);
    goT = P.countdown;
    game.track = id; game.laps = laps; game.views = [...viewKarts]; game.results = null; game.podium = null; game.counts = {};
    game.players = players.map((p) => ({ slot: p.slot, kart: p.kart, human: p.human }));
    Promise.all(ROSTER.map((k) => k.id).filter((k) => players.some((p) => p.kart === k)).map(makeThumb)).catch(() => {});
    const gp = flow.state.gp;
    const hud = ui.screens.hud;
    hud.setup({
      track, views: viewKarts.map((i) => ({ kart: i, slot: players[i].slot, kartId: players[i].kart })), colors, laps, region: def.region,
      trackName: trackLabel(id), regionName: regionLabel(id), blurb: pickLabel(lang, def.blurb),
      gp: gp ? { n: gp.index + 1, of: gp.tracks.length } : null, goT: P.countdown, tt, forma: !!race.state.forma, weather: wx,
      teams: gp?.teams ? { base: gp.teams, score: teamScore } : null,
    });
    await tick(1);
    audio.music(id);
    flow.loaded();
    ui.show('hud');
    pump();
    booth.begin({ track: id, views: viewKarts, karts: players.map((p) => p.kart), mode: timeTrial ? 'time' : race.state.forma ? 'forma' : 'race' });
    booth.intro();
    if (P.flyover && !game.manual) startFly(token); else startCountdown();
    game.ready = true;
  } catch (e) {
    console.error(e);
    ui.toast(ui.t('err.track'));
    game.lastLoadError = String(e?.stack || e);
    available = available.filter((t) => t !== id);
    if (!flow.failed(id)) game.error = game.lastLoadError;
    pump();
  }
}

function startFly(token) {
  mode = 'fly';
  game.flyover = true;
  const hud = ui.screens.hud;
  hud.flyover(true);
  // one drone over the whole screen, whatever the split: the track is the star of this moment
  if (viewKarts.length > 1) R.setViews([viewKarts[0]]);
  R.flyover({ duration: FLYOVER_S }).then(() => {
    if (token !== raceToken) return;
    if (viewKarts.length > 1) R.setViews(viewKarts);
    hud.flyover(false);
    game.flyover = false;
    startCountdown();
  });
}
function skipFly() { R.skipFlyover(); }
function pollSkip() {
  for (const k of race.state.karts) {
    if (!k.human) continue;
    if (input.get(k.slot).item) { skipFly(); return; }
  }
}
function startCountdown() {
  for (const e of race.drainEvents()) pending.push(e);
  acc = 0;
  mode = 'race';
}

function showResults() {
  mode = 'after';
  // the results are what the phones hear too
  const r = flow.state.results;
  const gp = flow.state.gp;
  game.results = r.rows;
  const data = {
    rows: r.rows, trackName: trackLabel(r.track),
    gp: gp ? { n: gp.index, of: gp.tracks.length, finished: gp.finished, table: flow.gpTable(), ...(gp.teams ? { teams: flow.teamTable() } : {}) } : null,
    nextName: flow.nextTrack ? trackLabel(flow.nextTrack) : '',
    tt: tt ? { table: records.table(r.track, track.length) } : null,
    forma: r.rows.some((x) => x.forma),
  };
  game.gp = data.gp;
  // bots' thumbnails may still be baking: paint now, again when they are ready
  ui.show('results', data);
  audio.music('results');
  booth.closing();
  Promise.all([...r.rows, ...(data.tt?.table || [])].map((x) => makeThumb(x.kart))).then(() => { if (ui.current === 'results') ui.update('results', {}); }).catch(() => {});
}

function showPodium() {
  mode = 'off';
  const top = flow.top3();
  const gp = flow.state.gp;
  game.podium = top;
  ui.show('podium', { top, gp: !!gp?.finished, trackName: gp?.finished ? '' : trackLabel(flow.state.track), unlocked: flow.state.unlocked || null, forma: top.some((x) => x.forma), teams: gp?.finished && gp.teams ? flow.teamTable() : null });
  audio.music('podium');
  if (flow.state.unlocked) audio.onEvents([{ type: 'cheer', id: flow.state.unlocked }]);
}

// ---------- tools ----------
game.advance = (n = 1) => {
  game.manual = true;
  if (!race) return game;
  if (mode === 'fly') { R.skipFlyover(); return game; }
  for (let f = 0; f < n; f++) {
    if (!race) break;
    stepOnce();
    afterSteps(DT);
    if (!race) break;
    const ev = pending;
    pending = [];
    deliver(ev, DT);
    if (mode === 'race' || mode === 'after') {
      ui.screens.hud.frame(race.state, DT);
      if (f >= n - 30 || ev.length || f % 12 === 0) { ghostsAt(1); R.frame(prev, race.state, 1, DT, ev); }
    }
  }
  return game;
};
game.draw = () => { if (race) { ghostsAt(1); R.frame(prev, race.state, 1, 0, []); } return R.stats(); };
game.skipFlyover = () => { if (mode === 'fly') R.skipFlyover(); };
game.setScript = (fn) => { scripted = fn; };
game.setAuto = (on) => { game.auto = !!on; };
game.setPaused = setPaused;
game.next = (kind) => { nextFrom(kind); pump(); };
game.give = (i, item) => race?.give(i, item);
game.teleport = (...a) => race?.teleport(...a);
game.rescue = (i) => race?.rescue(i);
game.disaster = (entry = 0) => race?.disaster(entry);
game.spinItem = (i, item, t = 0.7) => { const k = race?.state.karts[i]; if (k) { k.item = null; k.rouletteT = t; race.internals.priv[i].pendingItem = item; } };
// What a bot would do with this slot's kart right now: scripted phones in tests send it as their input.
game.botInput = (slot) => {
  const k = race?.state.karts.find((x) => x.human && x.slot === slot);
  if (!k) return { x: 0, y: 0, item: false, drift: false };
  const a = race.autopilot(k.i);
  return { x: a.steer, y: a.throttle, item: !!a.item, drift: !!a.drift };
};
game.drive = (i) => race.autopilot(i);
game.lang = () => lang;

// ---------- start ----------
async function main() {
  if (!R) {
    ui.error('err.title', 'err.webgl');
    boot?.remove();
    return;
  }
  await tracksReady;
  addEventListener('resize', () => R.resize());
  // tools: straight to the race
  if (P.track) {
    const seats = Math.max(1, Math.min(SLOTS, P.players ?? P.views ?? 1));
    if (P.bots !== null) flow.state.opts.bots = Math.max(0, Math.min(7, P.bots));
    if (['easy', 'medium', 'hard'].includes(P.difficulty)) flow.state.opts.difficulty = P.difficulty;
    if ([2, 3, 5].includes(P.laps)) flow.state.opts.laps = P.laps;
    if (Q.get('mode') === 'time') flow.state.opts.mode = 'time';
    if (Q.get('mode') === 'forma') flow.state.opts.mode = 'forma';
    if (Q.get('mode') === 'teams') flow.state.opts.mode = 'teams';
    for (let s = 0; s < seats; s++) {
      flow.join(s, 'keyboard');
      flow.seats[s].kart = kartInfo(P.kart) ? P.kart : KART_IDS[(s * 3) % KART_IDS.length];
    }
    flow.drain();
    flow.quick(P.track);
    game.phase = 'loading';
    boot?.remove();
    requestAnimationFrame(loop);
    loadRace(P.track);
    return;
  }
  onPhase('lobby');
  paintMenu();
  boot?.remove();
  if (!P.auto) ui.sticker(true);
  requestAnimationFrame(loop);
  game.ready = true;
}

main().catch((e) => { game.error = String(e?.stack || e); console.error(e); });
