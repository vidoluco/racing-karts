// Phone controller: floating joystick (right 2/3), USE ITEM and DRIFT under the left thumb, and the menus the host
// asks for: options, kart carousel, track vote, results.
// Sends {t:'in', x, y, b, d, seq} at 30 Hz and on every change. x right positive, y up (forward) positive.
// Test hooks: window.__pad (see the spec); with window.__padTrace = [] set before load, every input sent is logged
// with the time of the touch behind it.
import { webm, mp4 } from 'nosleep.js/src/media.js';
import { FREDOKA_WOFF2 } from '../src/ui/font-data.js';
import { SLOT_COLORS } from '../server/room.js';
import { pickLang, translator, ordinal, LANG_KEY } from './i18n.js';
import { KARTS, ROSTER } from '../src/data/karts.js';
import { TRACKS, loadTrackDef } from '../src/data/tracks.js';
import { ITEMS, ITEM_IDS } from '../src/data/items.js';
import { itemIcon, teamIcon } from '../src/ui/icons.js';
import { TEAMS, teamInfo, teamName } from '../src/data/teams.js';

const $ = (id) => document.getElementById(id);
const SEND_MS = 1000 / 30;
const DEAD = 0.12;
const PING_MS = 1000;
const SILENT_MS = 3500; // no word from the server this long: the socket is dead even if it says open
// Past a blip the Mac has probably moved and only a new scan helps: five refused tries (about 8 s), or 10 s of tries that
// hang, which is what an address that went away really does.
const RESCAN_AFTER = 5;
const RESCAN_MS = 10000;
const ROULETTE_MS = 1200;
const RANDOM = 'random';
const trace = Array.isArray(window.__padTrace) ? window.__padTrace : null;
const epoch = (ts = performance.now()) => performance.timeOrigin + ts;

const font = document.createElement('style');
font.textContent = `@font-face { font-family: "RK Fredoka"; font-weight: 500 700; font-display: block; src: url(data:font/woff2;base64,${FREDOKA_WOFF2}) format("woff2"); }`;
document.head.append(font);

// ---------- rosters: the game's own data, bundled in ----------
const karts = KARTS;
const tracks = TRACKS.map((k) => ({ ...k }));
const itemNames = Object.fromEntries(ITEMS.map((i) => [i.id, i.name]));
const TRACK_SKY = {
  antelao: ['#ffb46b', '#ffe2a8', '#e0a23a', '#b9692e'], pelmo: ['#7fc4f2', '#e6f6ff', '#ffffff', '#b8d8ee'],
  transfagarasan: ['#9fdcf2', '#eefbe0', '#7cc25e', '#8e9aa0'], bran: ['#2a2a6a', '#5a3f8f', '#2f6f78', '#1f3a58'],
  bromo: ['#ff9db0', '#ffd39a', '#a7a2a6', '#7f7780'], bali: ['#7ad4f2', '#e8fbff', '#58bd5e', '#2f8f62'],
  cortina: ['#8fd0f2', '#fff0cf', '#7fc765', '#e0bba8'], jakarta: ['#ff9d7a', '#ffe9b8', '#8d8fb0', '#5f5d7c'], batur: ['#6fd0f0', '#fff4c8', '#4ec2c9', '#6b6a78'],
  [RANDOM]: ['#cfaee6', '#ffdcae', '#f6c23e', '#62c56e'],
};
const label = (v) => (typeof v === 'string' ? v : v?.[lang] ?? v?.en ?? v?.it ?? '');
// the one line under each card lives in the track's own file; a track not written yet just has none
Promise.allSettled(tracks.map((k) => loadTrackDef(k.id))).then((defs) => {
  defs.forEach((d, i) => { if (d.value?.blurb) tracks[i].blurb = d.value.blurb; });
  rebuild();
});

// ---------- identity ----------
function uuid() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b); // randomUUID is missing on plain http LAN pages
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((v) => v.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
function store(key, val) {
  try {
    if (val === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, val);
  } catch {}
  return val ?? null;
}
const ID_KEY = 'racing-karts.padId';
let padId = store(ID_KEY);
if (!padId || !/^[A-Za-z0-9_-]{1,64}$/.test(padId)) padId = store(ID_KEY, uuid());

// ---------- language: per phone, stored choice or the browser language ----------
let lang = pickLang(store(LANG_KEY), navigator.language);
let t = translator(lang);
let lastOverlay = null;
function applyLang() {
  t = translator(lang);
  document.documentElement.lang = lang;
  document.title = t('pad.title');
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  updateWho();
  updateBanner();
  if (lastOverlay) overlay(...lastOverlay);
  paintItem();
  showHud();
  rebuild();
}

// ---------- state ----------
const st = { x: 0, y: 0, b: 0, d: 0, seq: 0 };
let ws = null;
let joined = false;
let slot = -1;
let hostOn = false;
let retry = 0;
let retryTimer = 0;
let lastRx = 0;
let lastTx = 0;
let pendingTx = 0;
let replaced = false;
let gestured = false;
let phase = null;
let screenName = null;
let menu = {}; // the host's menu fields, merged
let hud = null;

// ---------- view ----------
function shade(hex, k) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = (v) => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k).toString(16).padStart(2, '0');
  return `#${ch((n >> 16) & 255)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}
function setAccent(color) {
  const root = document.documentElement.style;
  root.setProperty('--accent', color);
  root.setProperty('--accent-d', shade(color, -0.32));
  root.setProperty('--accent-l', shade(color, 0.62));
}
// title and text are i18n keys; vars fill their {placeholders}.
function overlay(title, text, opts = {}, vars) {
  const ov = $('overlay');
  lastOverlay = title ? [title, text, opts, vars] : null;
  if (!title) { ov.classList.add('hide'); return; }
  $('ovTitle').textContent = t(title);
  $('ovText').textContent = text ? t(text, vars) : '';
  ov.classList.toggle('action', !!opts.action);
  ov.classList.remove('hide');
}
function banner(text) {
  const el = $('banner');
  if (text) el.textContent = text;
  el.classList.toggle('show', !!text);
}
function setNet(on) { $('net').classList.toggle('on', on); }

let toastTimer = 0;
function toast(big, small, ms = 1400) {
  $('toastBig').textContent = big;
  $('toastSmall').textContent = small || '';
  const el = $('toast');
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}
function flash(color = '#fff', strength = 0.65) {
  const el = $('flash');
  el.style.background = color;
  el.style.setProperty('--flash', strength);
  el.classList.add('on');
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('on')));
}
// Chrome blocks (and logs) vibrate before the first tap, and a touch counts as one only when the finger lifts.
// iOS Safari has no vibrate: since iOS 18 a tap on a switch's label gives a haptic tick, so a press of the pad's
// own buttons is still felt there (it works inside a touch handler only: the host's buzzes stay silent on iOS).
const activated = () => (navigator.userActivation ? navigator.userActivation.hasBeenActive : gestured);
let tick = null;
if (!navigator.vibrate) {
  const box = document.createElement('label');
  const sw = document.createElement('input');
  sw.type = 'checkbox';
  sw.setAttribute('switch', '');
  sw.tabIndex = -1;
  box.setAttribute('aria-hidden', 'true');
  box.style.display = 'none';
  box.append(sw);
  document.body.append(box);
  tick = () => box.click();
}
function vibrate(p, { touch = false } = {}) {
  if (navigator.vibrate) {
    if (!activated()) return;
    try { navigator.vibrate(p); } catch {}
  } else if (touch && tick) {
    try { tick(); } catch {}
  }
}

// What cannot be felt is shown: a phone with no vibrate (an iPhone) gets a pulse of colour for what the others feel.
const pulses = { n: 0, last: null };
function pulse(color, strength) {
  if (navigator.vibrate) return;
  pulses.n++;
  pulses.last = { color, strength };
  flash(color, strength);
}
// by tier: the turbo in the hand and on the glass grows with what was earned
const BOOST_BUZZ = [null, [30], [35, 25, 60], [45, 25, 70, 25, 130]];
const TIER_COLOR = [null, '#68c6ff', '#ff9c3a', '#e668ff'];
const tierOf = (m) => Math.max(1, Math.min(3, m.tier | 0));

function updateWho() {
  const side = slot >= 0 && menu.team && menu.opts?.mode === 'teams' ? teamName(menu.team, lang) : '';
  $('who').textContent = slot < 0 ? t('pad.waiting') : side ? t('pad.playerTeam', { n: slot + 1, team: side }) : t('pad.player', { n: slot + 1 });
}
// You first, your rival second, on your side's colour: the phone says how you stand, the TV says the rest.
function paintTeamScore(el, team, score) {
  const rival = TEAMS.find((T) => T.id !== team)?.id;
  el.style.setProperty('--tc', teamInfo(team)?.color || '#888');
  const key = `${team}|${score?.[team]}|${score?.[rival]}`;
  if (el.dataset.key !== key) {
    el.dataset.key = key;
    el.innerHTML = `${teamIcon(team)}${score?.[team] ?? 0} : ${score?.[rival] ?? 0}`;
  }
}
function updateBanner() {
  if (!joined) return banner('');
  if (!hostOn) return banner(t('pad.noHost'));
  banner(phase === 'loading' ? t('pad.loading') : '');
}

// ---------- network ----------
function wsUrl() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/ws?role=pad&id=${encodeURIComponent(padId)}`;
}
function send(msg) {
  if (ws && ws.readyState === 1) { ws.send(JSON.stringify(msg)); return true; }
  return false;
}
// The epoch ms of the oldest touch whose change has not been sent yet (traced pages only).
let touchAt = null;
const touched = (e) => { if (trace && touchAt === null) touchAt = epoch(e?.timeStamp); };
function sendInput() {
  clearTimeout(pendingTx);
  pendingTx = 0;
  if (!joined) return;
  lastTx = performance.now();
  const m = { t: 'in', x: Math.round(st.x * 1000) / 1000, y: Math.round(st.y * 1000) / 1000, b: st.b, d: st.d, seq: st.seq++ };
  if (!send(m) || !trace) return;
  if (trace.length > 20000) trace.splice(0, 10000);
  trace.push({ seq: m.seq, x: m.x, y: m.y, b: m.b, d: m.d, tx: epoch(), touch: touchAt });
  touchAt = null;
}
function changed(urgent) {
  const wait = SEND_MS / 2 - (performance.now() - lastTx);
  if (urgent || wait <= 0) return sendInput();
  if (!pendingTx) pendingTx = setTimeout(sendInput, wait);
}
// The 30 Hz repeat fills the gaps only: while the thumb moves, the moves themselves go out (up to 60 Hz), and a
// repeat sent just before one would hold that move back for half a period.
setInterval(() => { if (performance.now() - lastTx >= SEND_MS - 4) sendInput(); }, SEND_MS);

let lostAt = null;
const pastBlip = () => retry >= RESCAN_AFTER || (lostAt !== null && performance.now() - lostAt > RESCAN_MS);
function connect() {
  clearTimeout(retryTimer);
  if (ws) return;
  replaced = false;
  setNet(false);
  if (!joined) {
    if (pastBlip()) overlay('pad.rescan', 'pad.rescanText');
    else overlay('pad.connecting', 'pad.sameWifi');
  }
  let sock;
  try { sock = new WebSocket(wsUrl()); } catch { return reconnectLater(); }
  ws = sock;
  lastRx = performance.now();
  sock.onopen = () => { retry = 0; lostAt = null; lastRx = performance.now(); setNet(true); };
  sock.onmessage = (ev) => {
    lastRx = performance.now();
    let m;
    try { m = JSON.parse(ev.data); } catch { return; }
    if (m && typeof m === 'object') onMessage(m);
    window.__padRx = (window.__padRx || 0) + 1;
  };
  sock.onerror = () => {};
  sock.onclose = (ev) => {
    if (ws !== sock) return;
    ws = null;
    joined = false;
    setNet(false);
    banner('');
    if (ev.code === 4001) {
      replaced = true;
      overlay('pad.elsewhere', 'pad.elsewhereText', { action: true });
      return;
    }
    reconnectLater();
  };
}
function reconnectLater() {
  if (replaced) return;
  const delay = Math.min(5000, 500 * 2 ** retry++) * (0.8 + Math.random() * 0.4);
  lostAt ??= performance.now();
  if (pastBlip()) overlay('pad.rescan', 'pad.rescanText'); // it keeps trying underneath, for a long blip
  else overlay('pad.lost', 'pad.retry', {}, { s: Math.max(1, Math.round(delay / 1000)) });
  clearTimeout(retryTimer);
  retryTimer = setTimeout(connect, delay);
}
// Wi-Fi drops often leave the socket half open (and a handshake can hang): ping every second, the server pongs,
// and silence for SILENT_MS means the socket is dead.
function dropSocket() {
  const s = ws;
  ws = null;
  joined = false;
  try { s?.close(); } catch {}
  setNet(false);
  banner('');
}
setInterval(() => {
  if (!ws) return;
  if (ws.readyState === 1) send({ t: 'ping', ts: Date.now() });
  if (performance.now() - lastRx > SILENT_MS) {
    dropSocket();
    reconnectLater();
  }
}, PING_MS);
// The Wi-Fi came back: try now instead of at the end of the backoff.
addEventListener('online', () => { if (!ws && !replaced) { retry = 0; connect(); } });

function onMessage(m) {
  switch (m.t) {
    case 'welcome':
      joined = true;
      slot = Number.isInteger(m.slot) ? m.slot : -1;
      hostOn = !!m.host;
      if (typeof m.id === 'string' && m.id !== padId) padId = store(ID_KEY, m.id);
      if (typeof m.color === 'string') setAccent(m.color);
      updateWho();
      overlay(null);
      vibrate(30);
      sendInput();
      break;
    case 'full':
      joined = false;
      overlay('pad.full', 'pad.fullText');
      break;
    case 'host':
      hostOn = !!m.on;
      if (!hostOn) { phase = null; hud = null; showHud(); }
      break;
    case 'hud':
      hud = m;
      showHud();
      break;
    case 'phase': {
      const next = typeof m.phase === 'string' ? m.phase : null;
      if (next !== phase) onPhase(next);
      break;
    }
    case 'fx':
      onFx(m.kind, m);
      break;
    case 'menu': {
      const { t: _t, slot: _s, ...fields } = m;
      menu = { ...menu, ...fields };
      paintScreen();
      break;
    }
  }
  if (m.t === 'welcome' || m.t === 'host' || m.t === 'phase') { updateBanner(); paintScreen(); }
}

function onPhase(next) {
  phase = next;
  if (phase === 'lobby') { kartSel.fresh(); trackSel.fresh(); }
  if (phase === 'pick') { kartSel.fresh(); Object.assign(menu, { kart: null, ready: false, others: [] }); }
  if (phase === 'vote') { trackSel.fresh(); Object.assign(menu, { track: null, lock: false, spin: null, pick: null, landed: false, others: [] }); }
  if (phase !== 'race') { hud = null; held = { item: null, charges: 0 }; stopRoulette(); paintItem(); showHud(); }
  if (phase !== 'results' && phase !== 'podium') { menu.forma = null; menu.tt = null; menu.score = null; menu.won = null; } // merged fields stay: the next race's results must not show this trial's
}

// ---------- hud and effects ----------
function placeNodes(el, n) {
  const [num, suffix] = ordinal(lang, n);
  // the Italian degree sign is already raised: as a superscript it would float off the number
  if (suffix === '°') { el.replaceChildren(num + suffix); return; }
  const sup = document.createElement('sup');
  sup.textContent = suffix;
  el.replaceChildren(num, sup);
}
// The hunt: the clock in the lap's place, and beside it what the wheel is doing, as far as a thumb's glance goes.
function paintForma(f) {
  const left = Math.max(0, f.left | 0), clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  $('lap').textContent = clock(left);
  const tag = $('formaTag');
  const where = f.gap >= 0 ? t('pad.formaAhead', { m: Math.max(10, Math.round(f.gap / 10) * 10) }) : t('pad.formaBack', { m: Math.max(10, Math.round(-f.gap / 10) * 10) });
  tag.textContent = f.mine ? `${t('pad.formaMine')} ${clock(f.held | 0)}` : `${f.loose ? t('pad.formaLoose') : t('pad.formaHeld')} ${where}`;
  tag.classList.toggle('mine', !!f.mine);
  tag.classList.toggle('loose', !f.mine && !!f.loose);
}
function showHud() {
  const on = !!hud && (phase === 'race' || phase === 'loading');
  $('hud').classList.toggle('hide', !on);
  // against the clock: nothing to throw, no place to hold; the last split takes the place's spot
  document.body.classList.toggle('tt', on && !!hud.tt);
  document.body.classList.toggle('formaMine', on && !!hud.forma?.mine);
  $('formaTag').classList.toggle('hide', !on || !hud.forma);
  if (!on) { document.body.classList.remove('boosting'); $('place').classList.remove('ahead', 'behind'); return; }
  const place = Number.isInteger(hud.place) && hud.place > 0 ? hud.place : 0;
  if (hud.tt) {
    const d = Number.isFinite(hud.delta) ? hud.delta : null;
    $('place').textContent = d === null ? '' : `${d < 0 ? '-' : '+'}${Math.abs(d).toFixed(2)}`.replace('.', lang === 'it' ? ',' : '.');
    $('place').classList.toggle('ahead', d !== null && d < 0);
    $('place').classList.toggle('behind', d !== null && d >= 0);
  } else if (place) placeNodes($('place'), place); else $('place').replaceChildren();
  const laps = Number.isInteger(hud.laps) ? hud.laps : 0;
  $('lap').classList.toggle('hide', !laps && !hud.forma);
  if (hud.forma) paintForma(hud.forma);
  if (laps) $('lap').textContent = t('pad.lap', { lap: Math.max(1, Math.min(laps, hud.lap || 1)), laps });
  document.body.classList.toggle('boosting', !!hud.boost);
  $('autoTag').classList.toggle('hide', !on || !hud.auto);
  if (hud.auto) $('autoTag').textContent = t('pad.autoHome');
  $('teamTag').classList.toggle('hide', !hud.team);
  if (hud.team) paintTeamScore($('teamTag'), hud.team, hud.score);
  if (hud.item !== held.item || (hud.charges || 0) !== held.charges) {
    held = { item: hud.item || null, charges: hud.charges || 0 };
    if (!rolling) paintItem();
  }
}

// USE ITEM's face: the held item's icon, the name alone until the icons exist, a faint crate when empty.
let held = { item: null, charges: 0 };
let rolling = null;
const CRATE = '<svg viewBox="0 0 64 64" fill="none" stroke="#1d1f2b" stroke-width="5" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><rect x="9" y="26" width="46" height="31" rx="5"/><rect x="5" y="18" width="54" height="11" rx="4"/><path d="M32 18v39M9 42h46"/><path d="M32 17c-5-11-16-11-15-4 1 5 9 5 15 4zM32 17c5-11 16-11 15-4-1 5-9 5-15 4z"/></svg>';
function face(id, { tickIt = false, name = true } = {}) {
  const itemEl = $('item');
  const icon = $('itemIcon');
  const svg = id ? itemIcon(id) : '';
  itemEl.classList.toggle('empty', !id);
  itemEl.classList.toggle('named', !!id && !svg);
  icon.innerHTML = id ? svg : CRATE;
  if (tickIt && icon.firstElementChild) icon.firstElementChild.classList.add('tick');
  $('itemName').textContent = id ? (name ? label(itemNames[id]) || t(`item.${id}`) : '') : t('pad.item');
}
function paintItem() {
  if (rolling) return;
  const { item, charges } = held;
  face(item);
  $('item').classList.toggle('held', !!item);
  const n = item && charges > 1 ? Math.min(charges, 5) : 0;
  $('pips').innerHTML = '<i></i>'.repeat(n);
  $('hintItem').textContent = t(item ? 'pad.hintUse' : 'pad.hintItem');
  paintAim();
}
// An item that goes behind, or ahead with the stick up: the stick shows the way up and the button says, live, where it would go.
// AIM_UP is the sim's own line (throttle above 0.5, src/sim/items.js).
const AIM_UP = 0.5;
const AIMED = new Set(ITEMS.filter((i) => i.aim).map((i) => i.id));
function paintAim() {
  const on = !rolling && AIMED.has(held.item), fwd = on && st.y > AIM_UP;
  document.body.classList.toggle('aimable', on);
  document.body.classList.toggle('aimfwd', fwd);
  const text = on ? t(fwd ? 'pad.dirAhead' : 'pad.dirBehind') : '';
  const span = $('itemDir').lastElementChild;
  if (span.textContent !== text) span.textContent = text;
}
function stopRoulette() {
  if (rolling) clearTimeout(rolling.timer);
  rolling = null;
}
// Fast, then slowing down onto the item: the same 1.2 s as the TV's.
function startRoulette(item, ms = ROULETTE_MS) {
  stopRoulette();
  const start = performance.now();
  const r = { timer: 0, n: 0, item: item || null };
  rolling = r;
  paintAim();
  $('item').classList.remove('held', 'landed');
  $('pips').innerHTML = '';
  const step = () => {
    if (rolling !== r) return;
    const u = (performance.now() - start) / ms;
    if (u >= 1) {
      rolling = null;
      if (r.item && !held.item) held = { item: r.item, charges: held.charges };
      paintItem();
      const el = $('item');
      void el.offsetWidth;
      el.classList.add('landed');
      setTimeout(() => el.classList.remove('landed'), 450);
      vibrate(22);
      return;
    }
    r.n = (r.n + 1 + (r.n % 3 === 0 ? 3 : 0)) % ITEM_IDS.length;
    face(ITEM_IDS[r.n], { tickIt: true });
    r.timer = setTimeout(step, 55 + u * u * 170);
  };
  step();
}

let hitTimer = 0;
function onFx(kind, m) {
  switch (kind) {
    case 'roulette':
      startRoulette(typeof m.item === 'string' ? m.item : null, Number.isFinite(m.ms) ? m.ms : ROULETTE_MS);
      vibrate(14);
      pulse('#ffd24a', 0.3);
      break;
    case 'box':
      vibrate(25);
      pulse('#ffd24a', 0.3);
      break;
    case 'hit':
      vibrate([60, 40, 120]);
      flash('#ff3b3b', 0.7);
      toast(t('pad.hit'), '', 900);
      document.body.classList.add('hit');
      clearTimeout(hitTimer);
      hitTimer = setTimeout(() => document.body.classList.remove('hit'), 450);
      break;
    case 'bump':
      vibrate(30);
      pulse('#ff8a3a', 0.25);
      break;
    case 'boost': {
      const tier = tierOf(m);
      vibrate(BOOST_BUZZ[tier]);
      pulse(TIER_COLOR[tier], 0.3 + tier * 0.12);
      break;
    }
    case 'drift':
      vibrate(10);
      break;
    case 'charge': {
      const tier = tierOf(m);
      vibrate(10 + tier * 10);
      pulse(TIER_COLOR[tier], 0.2);
      break;
    }
    case 'land':
      vibrate(m.big ? [50, 20, 30] : 25);
      pulse('#fff', m.big ? 0.35 : 0.2);
      break;
    case 'use':
      vibrate(15);
      break;
    case 'shield':
      vibrate(40);
      flash();
      break;
    case 'lap':
      vibrate([30, 40, 30]);
      break;
    case 'lastLap':
      vibrate([40, 40, 40, 40, 80]);
      toast(t(m.forma ? 'pad.formaLast' : 'pad.lastLap'), '', 1600);
      break;
    case 'formaGrab':
      vibrate([30, 30, 30, 30, 120]);
      flash();
      toast(t('pad.formaGot'), '', 1300);
      break;
    case 'formaDrop':
      vibrate([120, 40, 60]);
      toast(t('pad.formaLost'), '', 1300);
      break;
    case 'finish': {
      vibrate([80, 60, 80, 60, 300]);
      const p = Number.isInteger(m.place) && !hud?.tt ? m.place : null; // alone against the clock a place means nothing
      toast(t(hud?.forma ? 'pad.formaOver' : 'pad.finish'), p ? t('pad.finishPlace', { place: ordinal(lang, p).join('') }) : '', 3000);
      break;
    }
    case 'buzz':
      vibrate(40);
      flash();
      break;
    default:
      vibrate(20);
  }
}

// ---------- joystick ----------
const stickEl = $('stick');
const baseEl = $('base');
const knobEl = $('knob');
let stickId = null;
let ox = 0;
let oy = 0;
let R = 80;

function radius() {
  const r = stickEl.getBoundingClientRect();
  return Math.max(56, Math.min(100, Math.min(r.width * 0.36, r.height * 0.24)));
}
function restPoint() {
  const r = stickEl.getBoundingClientRect();
  return [r.width * 0.5, r.height * (r.height > r.width * 1.3 ? 0.66 : 0.56)];
}
function place(el, x, y) { el.style.transform = `translate3d(${x}px, ${y}px, 0)`; }
function eyes(dx, dy) {
  knobEl.style.setProperty('--lx', String(dx / R));
  knobEl.style.setProperty('--ly', String(dy / R));
}
// The stick stands visible where a thumb would land, and floats to where it really lands.
function layoutStick() {
  R = radius();
  const [x, y] = restPoint();
  stickEl.style.setProperty('--r', `${R}px`);
  stickEl.style.setProperty('--ry', `${y}px`);
  if (stickId === null) { place(baseEl, x, y); place(knobEl, x, y); eyes(0, 0); }
}

function stickMove(px, py, e) {
  let dx = px - ox;
  let dy = py - oy;
  let d = Math.hypot(dx, dy);
  // Dynamic origin: dragging past the rim pulls the base along with the thumb.
  if (d > R) {
    const k = (d - R) / d;
    ox += dx * k;
    oy += dy * k;
    dx = px - ox;
    dy = py - oy;
    d = R;
    place(baseEl, ox, oy);
  }
  place(knobEl, ox + dx, oy + dy);
  eyes(dx, dy);
  const mag = d / R;
  let nx = 0;
  let ny = 0;
  if (mag > DEAD) {
    const m = (mag - DEAD) / (1 - DEAD);
    nx = (dx / d) * m;
    ny = (-dy / d) * m;
  }
  nx = Math.max(-1, Math.min(1, nx));
  ny = Math.max(-1, Math.min(1, ny));
  if (Math.abs(nx - st.x) > 0.004 || Math.abs(ny - st.y) > 0.004) {
    st.x = nx;
    st.y = ny;
    paintAim();
    touched(e);
    changed(false);
  }
}
function local(e) {
  const r = stickEl.getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top];
}
stickEl.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  keepAwake();
  // One thumb owns the stick; a second finger on it is ignored. A thumb whose lift never arrived (the capture is
  // gone with it) does not lock the stick: the new one takes over.
  if (stickId !== null && stickEl.hasPointerCapture?.(stickId) !== false) return;
  stickId = e.pointerId;
  try { stickEl.setPointerCapture(e.pointerId); } catch {}
  R = radius();
  stickEl.style.setProperty('--r', `${R}px`);
  [ox, oy] = local(e);
  stickEl.classList.remove('rest');
  place(baseEl, ox, oy);
  place(knobEl, ox, oy);
  stickEl.classList.add('active');
  $('hint').classList.add('gone');
  stickMove(ox, oy, e);
});
stickEl.addEventListener('pointermove', (e) => {
  if (e.pointerId !== stickId) return;
  e.preventDefault();
  const evs = e.getCoalescedEvents?.() || [];
  const last = evs.length ? evs[evs.length - 1] : e;
  const [x, y] = local(last);
  stickMove(x, y, evs[0] || e);
});
function stickRest() {
  stickEl.classList.remove('active');
  stickEl.classList.add('rest');
  layoutStick();
}
function stickEnd(e) {
  if (e && e.pointerId !== stickId) return;
  stickId = null;
  stickRest();
  if (st.x || st.y) { st.x = 0; st.y = 0; paintAim(); touched(e); changed(true); }
}
stickEl.addEventListener('pointerup', stickEnd);
stickEl.addEventListener('pointercancel', stickEnd);
stickEl.addEventListener('lostpointercapture', stickEnd);
addEventListener('resize', () => { layoutStick(); });

// ---------- ITEM and DRIFT ----------
// The whole column answers, a thumb goes to the nearer button: nobody looks at the phone while racing.
const btnsEl = $('btns');
const itemEl = $('item');
const driftEl = $('drift');
const owners = new Map(); // pointerId -> 'b' | 'd'
const BTN = { b: itemEl, d: driftEl };
function nearest(e) {
  const reach = (el) => {
    const r = el.getBoundingClientRect();
    return Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) / (r.width / 2);
  };
  return reach(driftEl) < reach(itemEl) ? 'd' : 'b';
}
function setButton(key, down, e) {
  const v = down ? 1 : 0;
  if (st[key] === v) return;
  st[key] = v;
  BTN[key].classList.toggle('down', down);
  if (down) {
    if (key === 'd') $('hintDrift').classList.add('gone');
    else if (held.item) $('hintItem').classList.add('gone');
    vibrate(key === 'b' ? 14 : 8, { touch: true });
    if (key === 'b' && (held.item || rolling)) {
      const ring = document.createElement('div');
      ring.className = 'burst';
      itemEl.append(ring);
      setTimeout(() => ring.remove(), 450);
    }
  }
  touched(e);
  changed(true);
}
btnsEl.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  keepAwake();
  const key = nearest(e);
  owners.set(e.pointerId, key);
  try { btnsEl.setPointerCapture(e.pointerId); } catch {}
  setButton(key, true, e);
});
function btnEnd(e) {
  const key = owners.get(e.pointerId);
  if (!key) return;
  owners.delete(e.pointerId);
  if (![...owners.values()].includes(key)) setButton(key, false, e);
}
btnsEl.addEventListener('pointerup', btnEnd);
btnsEl.addEventListener('pointercancel', btnEnd);
btnsEl.addEventListener('lostpointercapture', btnEnd);

function releaseAll() {
  stickId = null;
  owners.clear();
  stickRest();
  itemEl.classList.remove('down');
  driftEl.classList.remove('down');
  const was = st.x || st.y || st.b || st.d;
  st.x = 0; st.y = 0; st.b = 0; st.d = 0;
  if (was) sendInput();
}

// ---------- carousels: kart pick and track vote ----------
// Swipe to browse, tap a side card to bring it in front. Each card change tells the host which one is in front.
function createCarousel({ root, dots, cardOf, onFocus }) {
  let ids = [];
  let index = 0;
  let locked = false;
  let swipe = null;
  const cards = () => [...root.querySelectorAll('.vc')];
  function layout() {
    cards().forEach((el, i) => {
      el.style.setProperty('--i', String(i - index));
      el.classList.toggle('on', i === index);
      el.classList.toggle('far', Math.abs(i - index) > 2);
      // pictures load for the card in front and its neighbours only: a phone on the Wi-Fi fetches a few, not all
      if (Math.abs(i - index) <= 1) for (const img of el.querySelectorAll('img[data-src]')) { img.src = img.dataset.src; img.removeAttribute('data-src'); }
    });
    [...dots.children].forEach((d, i) => d.classList.toggle('on', i === index));
  }
  function move(to, user) {
    const next = Math.max(0, Math.min(ids.length - 1, to));
    const moved = next !== index;
    index = next;
    layout();
    if (moved && user) { vibrate(8, { touch: true }); onFocus(ids[index]); }
  }
  root.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    keepAwake();
    if (swipe || locked) return;
    swipe = { id: e.pointerId, x: e.clientX, dx: 0 };
    try { root.setPointerCapture(e.pointerId); } catch {}
  });
  root.addEventListener('pointermove', (e) => {
    if (!swipe || e.pointerId !== swipe.id) return;
    swipe.dx = e.clientX - swipe.x;
    if (Math.abs(swipe.dx) > 6) {
      root.classList.add('dragging');
      // past the ends the card resists
      const end = (index === 0 && swipe.dx > 0) || (index === ids.length - 1 && swipe.dx < 0);
      for (const c of cards()) c.style.setProperty('--drag', `${end ? swipe.dx * 0.25 : swipe.dx}px`);
    }
  });
  function end(e) {
    if (!swipe || e.pointerId !== swipe.id) return;
    const { dx } = swipe;
    swipe = null;
    root.classList.remove('dragging');
    for (const c of cards()) c.style.removeProperty('--drag');
    if (e.type === 'pointerup' && Math.abs(dx) <= 12) {
      const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('.vc');
      const i = hit ? cards().indexOf(hit) : -1;
      if (i >= 0) return move(i, true);
    } else if (Math.abs(dx) > 34) {
      const w = cards()[index]?.getBoundingClientRect().width || 300;
      return move(index - Math.sign(dx) * Math.max(1, Math.round(Math.abs(dx) / (w * 0.9))), true);
    }
    layout();
  }
  root.addEventListener('pointerup', end);
  root.addEventListener('pointercancel', end);
  return {
    build(list) {
      const keep = ids[index];
      ids = list;
      for (const c of cards()) c.remove();
      for (const id of ids) root.append(cardOf(id));
      dots.innerHTML = ids.map(() => '<i></i>').join('');
      const i = ids.indexOf(keep);
      index = i >= 0 ? i : Math.min(index, Math.max(0, ids.length - 1));
      layout();
    },
    show(id) { const i = ids.indexOf(id); if (i >= 0) move(i, false); },
    showIndex(i) { move(i, false); },
    lock(v) { locked = v; },
    get ids() { return ids; },
    get focus() { return ids[index] ?? null; },
    card(id) { return root.querySelector(`.vc[data-id="${id}"]`); },
    rect(id) {
      const r = this.card(id)?.getBoundingClientRect();
      return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height } : null;
    },
  };
}

function kartArt(color) {
  return `<svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="200" height="200" fill="${color}"/><circle cx="100" cy="88" r="84" fill="#fff" opacity="0.2"/><ellipse cx="100" cy="164" rx="76" ry="10" fill="#1d1f2b" opacity="0.2"/>
<g stroke="#1d1f2b" stroke-width="6" stroke-linejoin="round"><path d="M34 132c-6-30 18-48 42-48h48c24 0 48 18 42 48z" fill="#fffdf9"/><path d="M64 88c0-24 16-36 36-36s36 12 36 36z" fill="${shade(color, 0.45)}"/><circle cx="58" cy="142" r="22" fill="#2c2f3f"/><circle cx="142" cy="142" r="22" fill="#2c2f3f"/><circle cx="58" cy="142" r="8" fill="${shade(color, 0.45)}"/><circle cx="142" cy="142" r="8" fill="${shade(color, 0.45)}"/><circle cx="86" cy="74" r="11" fill="#fff" stroke-width="5"/><circle cx="114" cy="74" r="11" fill="#fff" stroke-width="5"/></g><circle cx="88" cy="75" r="5" fill="#1d1f2b"/><circle cx="116" cy="75" r="5" fill="#1d1f2b"/></svg>`;
}
function trackArt(id) {
  const [a, b, c, d] = TRACK_SKY[id] || TRACK_SKY[RANDOM];
  const uid = `ts-${id}`;
  return `<svg viewBox="0 0 400 200" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><defs><linearGradient id="${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="400" height="200" fill="url(#${uid})"/>
<circle cx="322" cy="74" r="22" fill="#fff6c8"/><path d="M40 176 L146 84 L190 116 L240 72 L362 176Z" fill="${d}" stroke="#1d1f2b" stroke-width="4" stroke-linejoin="round"/><path d="M240 72 L262 92 L246 90 L234 102 L224 86Z M146 84 L164 100 L148 98 L134 95Z" fill="#fff"/><path d="M-10 170 C80 136 170 152 240 160 C300 168 350 144 420 152 V210 H-10Z" fill="${c}" stroke="#1d1f2b" stroke-width="4"/><path d="M60 210 C110 184 170 180 200 172 C200 180 240 192 300 210Z" fill="#fffdf9" opacity="0.8"/></svg>`;
}
function seatsOf(el, key, markKey) {
  let box = el.querySelector('.seats');
  if (!box) { box = document.createElement('div'); box.className = 'seats'; el.append(box); }
  const id = el.dataset.id;
  const who = [...(Array.isArray(menu.others) ? menu.others : [])].filter((o) => o && o.slot !== slot && o[key] === id);
  box.innerHTML = '';
  for (const o of who) {
    const i = document.createElement('i');
    i.textContent = String(o.slot + 1);
    i.style.background = SLOT_COLORS[o.slot] || '#ccc';
    i.classList.toggle('ok', !!o[markKey]);
    box.append(i);
  }
}
const statKeys = ['speed', 'accel', 'handling', 'weight', 'offroad'];
const driverOf = (k) => (k.driver ? [label(k.driver.name), label(k.driver.species)].filter(Boolean).join(' ') : '');
function kartCard(id) {
  const k = ROSTER.find((m) => m.id === id) || { id };
  const color = k.color || '#c58a4f';
  const el = document.createElement('div');
  el.className = 'vc kc';
  el.dataset.id = id;
  el.style.setProperty('--kc', color);
  const { stats } = k;
  el.innerHTML = `<div class="pic">${kartArt(color)}<img alt="" data-src="assets/ui/karts/${id}.png"></div>
<div class="info"><div class="nm"></div><div class="dr"></div><div class="ln"></div>${stats ? `<div class="bars">${statKeys.map((n) => `<span>${t(`pad.stat.${n}`)}</span><div class="bar">${[1, 2, 3, 4, 5].map((v) => `<i class="${v <= stats[n] ? 'f' : ''}"></i>`).join('')}</div>`).join('')}</div>` : ''}</div>`;
  el.querySelector('.nm').textContent = label(k.name) || id;
  const dr = driverOf(k);
  el.querySelector('.dr').textContent = dr;
  el.querySelector('.ln').textContent = label(k.driver?.line);
  const img = el.querySelector('img');
  img.addEventListener('load', () => { if (img.naturalWidth) img.classList.add('ok'); });
  return el;
}
function trackCard(id) {
  const k = tracks.find((m) => m.id === id) || { id };
  const el = document.createElement('div');
  el.className = 'vc tc';
  el.dataset.id = id;
  el.innerHTML = `<div class="pic">${trackArt(id)}${id === RANDOM ? '' : `<img alt="" data-src="assets/ui/tracks/${id}.png">`}<div class="cap"><div class="nm"></div><div class="rg"></div></div></div><div class="bl"></div>`;
  el.querySelector('.nm').textContent = id === RANDOM ? t('pad.random') : trackName(id);
  el.querySelector('.rg').textContent = k.region ? t(`region.${k.region}`) : '';
  el.querySelector('.bl').textContent = id === RANDOM ? t('pad.randomText') : label(k.blurb);
  const img = el.querySelector('img');
  img?.addEventListener('load', () => { if (img.naturalWidth) img.classList.add('ok'); });
  return el;
}
const trackName = (id) => {
  if (id === RANDOM) return t('pad.random');
  const k = tracks.find((m) => m.id === id);
  return label(k?.names) || id || '';
};

const kartCar = createCarousel({ root: $('kartCar'), dots: $('kartDots'), cardOf: kartCard, onFocus: (id) => { kartSel.touched = true; sendPick(id); } });
const trackCar = createCarousel({ root: $('trackCar'), dots: $('trackDots'), cardOf: trackCard, onFocus: (id) => { trackSel.touched = true; sendVote(id); } });

// What this phone chose on a screen, for one visit to it. The host's word is taken until the player has touched it,
// because the host's echo of an older card would yank the carousel back under the thumb.
const selection = () => ({ touched: false, ready: false, entered: false, first: true, timer: 0, fresh() { clearTimeout(this.timer); this.touched = false; this.ready = false; this.entered = false; } });
const kartSel = selection();
const trackSel = selection();
function sendPick(id, ready = kartSel.ready) { if (id) send({ t: 'pick', kart: id, ready }); }
function sendVote(id, lock = trackSel.ready) { if (id) send({ t: 'vote', track: id, lock }); }

const kartIds = () => (Array.isArray(menu.karts) && menu.karts.length ? menu.karts : karts.map((k) => k.id));
const trackIds = () => [...(Array.isArray(menu.tracks) && menu.tracks.length ? menu.tracks : tracks.map((k) => k.id)), RANDOM];
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

function rebuild() {
  kartCar.build(kartIds());
  trackCar.build(trackIds());
  buildOptions();
  paintScreen();
}

// ---------- options (lobby) ----------
const OPT_ROWS = [
  { key: 'difficulty', label: 'pad.difficulty', vals: [['easy', 'pad.easy'], ['medium', 'pad.medium'], ['hard', 'pad.hard']] },
  { key: 'bots', label: 'pad.bots' },
  { key: 'laps', label: 'pad.laps', vals: [[2, '2'], [3, '3'], [5, '5']] },
  { key: 'mode', label: 'pad.mode', vals: [['race', 'pad.race'], ['gp', 'pad.gp'], ['time', 'pad.modeTime'], ['teams', 'pad.teams'], ['forma', 'pad.modeForma']] },
  { key: 'voice', label: 'pad.voice', vals: [['off', 'pad.voiceOff'], ['it', 'Italiano'], ['ro', 'Română'], ['id', 'Indonesia']] },
  { key: 'weather', label: 'pad.weather', vals: [['clear', 'pad.wxClear'], ['rain', 'pad.wxRain'], ['snow', 'pad.wxSnow'], ['fog', 'pad.wxFog'], ['surprise', 'pad.wxSurprise']] },
  { key: 'night', label: 'pad.hour', vals: [[false, 'pad.wxDay'], [true, 'pad.wxNight']] },
];
const localOpts = { difficulty: 'medium', bots: 7, laps: 3, mode: 'race', voice: 'off', weather: 'clear', night: false };
// off is no key at all in the host's options, so what the host says wins over the last thing this phone sent
const opts = () => ({ ...localOpts, ...(menu.opts ? { voice: 'off', weather: 'clear', night: false } : {}), ...(menu.opts || {}) });
const canEdit = () => slot === 0 || menu.edit === true;
function setOpt(key, value) {
  localOpts[key] = value;
  if (menu.opts) menu.opts[key] = value;
  vibrate(10, { touch: true });
  send({ t: 'opt', [key]: value });
  paintOptions();
}
function buildOptions() {
  const card = $('optCard');
  card.innerHTML = '';
  const title = document.createElement('div');
  title.className = 'optTtl';
  title.id = 'optTitle';
  card.append(title);
  for (const row of OPT_ROWS) {
    const el = document.createElement('div');
    el.className = 'opt';
    const lab = document.createElement('label');
    lab.textContent = t(row.label);
    el.append(lab);
    if (row.vals) {
      const seg = document.createElement('div');
      seg.className = 'seg';
      seg.dataset.key = row.key;
      for (const [v, text] of row.vals) {
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.v = String(v);
        b.textContent = text.startsWith('pad.') ? t(text) : text;
        b.addEventListener('click', () => { if (canEdit()) setOpt(row.key, v); });
        seg.append(b);
      }
      el.append(seg);
    } else {
      const step = document.createElement('div');
      step.className = 'step';
      step.innerHTML = '<button type="button" data-d="-1">-</button><b id="botsN"></b><button type="button" data-d="1">+</button>';
      step.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
        if (canEdit()) setOpt('bots', Math.max(0, Math.min(7, opts().bots + Number(b.dataset.d))));
      }));
      el.append(step);
    }
    card.append(el);
  }
  // Your own choice, whoever holds the options: this row never goes read-only. The host answers with the line-up.
  const sideRow = document.createElement('div');
  sideRow.className = 'opt hide';
  sideRow.id = 'sideRow';
  const sideLab = document.createElement('label');
  sideLab.textContent = t('pad.side');
  const sides = document.createElement('div');
  sides.className = 'seg side';
  for (const T of TEAMS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.team = T.id;
    b.style.setProperty('--tc', T.color);
    b.innerHTML = `${teamIcon(T.id)}<span>${teamName(T.id, lang)}</span><small></small>`;
    b.addEventListener('click', () => { vibrate(14, { touch: true }); send({ t: 'team', team: T.id }); });
    sides.append(b);
  }
  sideRow.append(sideLab, sides);
  card.append(sideRow);
  paintOptions();
}
function paintOptions() {
  const o = opts();
  const edit = canEdit();
  const title = $('optTitle');
  if (!title) return;
  title.textContent = edit ? t('pad.opts') : t('pad.you', { n: slot + 1 });
  $('optCard').classList.toggle('ro', !edit);
  const teamsOn = o.mode === 'teams';
  $('sideRow')?.classList.toggle('hide', !teamsOn);
  $('optCard').classList.toggle('sided', teamsOn);
  if (teamsOn) for (const b of $('optCard').querySelectorAll('.side button')) {
    b.classList.toggle('on', menu.team === b.dataset.team);
    b.querySelector('small').textContent = (menu.lineup || []).filter((p) => p.team === b.dataset.team).map((p) => t('pad.seatTag', { n: p.slot + 1 })).join(' ');
  }
  updateWho();
  for (const seg of $('optCard').querySelectorAll('.seg:not(.side)')) {
    seg.classList.toggle('ro', !edit);
    for (const b of seg.children) b.classList.toggle('on', b.dataset.v === String(o[seg.dataset.key]));
  }
  $('optCard').querySelector('.step')?.classList.toggle('ro', !edit);
  // alone against the clock: no bots to count and no one to be hard on
  const trial = o.mode === 'time';
  $('optCard').querySelector('.seg[data-key="difficulty"]')?.parentElement.classList.toggle('off', trial);
  $('optCard').querySelector('.step')?.parentElement.classList.toggle('off', trial);
  // the clock ends the hunt, not the laps
  $('optCard').querySelector('.seg[data-key="laps"]')?.parentElement.classList.toggle('off', o.mode === 'forma');
  const n = $('botsN');
  if (n) n.textContent = String(o.bots);
  $('goBtn').classList.toggle('ro', !edit);
  $('goWait').classList.toggle('hide', edit);
}
$('goBtn').addEventListener('click', () => {
  if (!canEdit()) return;
  vibrate(25, { touch: true });
  send({ t: 'opt', go: true });
});

// ---------- which screen ----------
const SCREENS = { lobby: 'sLobby', pick: 'sKart', vote: 'sTrack', results: 'sResults', podium: 'sResults' };
function paintScreen() {
  const id = joined && hostOn ? SCREENS[phase] || null : null;
  if (id !== screenName) {
    screenName = id;
    for (const name of new Set(Object.values(SCREENS))) $(name).classList.toggle('hide', name !== id);
    $('menu').classList.toggle('hide', !id);
    document.body.classList.toggle('menu', !!id);
    if (id) releaseAll();
    else layoutStick();
  }
  if (id === 'sLobby') paintOptions();
  else updateWho();
  if (id === 'sKart') paintKart();
  if (id === 'sTrack') paintTrack();
  if (id === 'sResults') paintResults();
}
function enter(sel, car, hostId, sendIt, start) {
  // The host knows this phone's card: it is a phone that came back, or the host chose. Nothing to tell it then.
  if (hostId) clearTimeout(sel.timer);
  if (sel.entered) return;
  sel.entered = true;
  if (!hostId && sel.first) car.showIndex(start); // players start apart; on a later visit the last card stays
  sel.first = false;
  // A phone that came back gets its phase and then its menu: wait a moment so its old choice is not overwritten.
  clearTimeout(sel.timer);
  if (!hostId) sel.timer = setTimeout(() => { if (!sel.touched) sendIt(car.focus); }, 80);
}
function paintKart() {
  if (!same(kartCar.ids, kartIds())) kartCar.build(kartIds());
  enter(kartSel, kartCar, menu.kart, sendPick, Math.max(0, slot));
  if (typeof menu.kart === 'string' && !kartSel.touched) kartCar.show(menu.kart);
  if (typeof menu.ready === 'boolean') kartSel.ready = menu.ready;
  kartCar.lock(kartSel.ready);
  for (const id of kartCar.ids) {
    const el = kartCar.card(id);
    el.classList.toggle('mine', kartSel.ready && id === kartCar.focus);
    seatsOf(el, 'kart', 'ready');
  }
  const btn = $('readyBtn');
  btn.textContent = kartSel.ready ? t('pad.notReady') : t('pad.ready');
  btn.classList.toggle('done', kartSel.ready);
}
$('readyBtn').addEventListener('click', () => {
  kartSel.ready = !kartSel.ready;
  menu.ready = kartSel.ready;
  kartSel.touched = true;
  vibrate(kartSel.ready ? [20, 30, 40] : 12, { touch: true });
  sendPick(kartCar.focus);
  paintKart();
});
function paintTrack() {
  if (!same(trackCar.ids, trackIds())) trackCar.build(trackIds());
  enter(trackSel, trackCar, menu.track, sendVote, 0);
  if (typeof menu.track === 'string' && !trackSel.touched) trackCar.show(menu.track);
  if (typeof menu.lock === 'boolean') trackSel.ready = menu.lock;
  const landed = !!menu.landed || (!!menu.pick && !menu.spin);
  const deciding = !!menu.spin || !!menu.pick;
  // the verdict: the carousel follows the coin and says where it landed
  if (deciding) trackCar.show(landed ? menu.pick : menu.spin);
  trackCar.lock(trackSel.ready || deciding);
  for (const id of trackCar.ids) {
    const el = trackCar.card(id);
    el.classList.toggle('mine', trackSel.ready && !deciding && id === trackCar.focus);
    el.classList.toggle('spin', deciding && !landed && id === menu.spin);
    el.classList.toggle('picked', landed && id === menu.pick);
    seatsOf(el, 'track', 'lock');
  }
  $('verdict').textContent = landed ? t('pad.verdict', { name: trackName(menu.pick) }) : deciding ? t('pad.roll') : '';
  paintWxVote();
  const btn = $('voteBtn');
  btn.textContent = trackSel.ready ? t('pad.unvote') : t('pad.vote');
  btn.classList.toggle('done', trackSel.ready);
  btn.disabled = deciding;
}
// the sky can still change on the vote, by whoever holds the options
const WX_LABEL = { clear: 'pad.wxClear', rain: 'pad.wxRain', snow: 'pad.wxSnow', fog: 'pad.wxFog', surprise: 'pad.wxSurprise' }, WX_ORDER = Object.keys(WX_LABEL);
function paintWxVote() {
  const on = menu.weather !== undefined && canEdit() && !menu.spin && !menu.pick;
  $('wxVote').classList.toggle('hide', !on);
  if (!on) return;
  $('wxCycle').textContent = `${t('pad.weather')}: ${t(WX_LABEL[menu.weather] || 'pad.wxClear')}`;
  $('wxCycle').classList.toggle('on', menu.weather !== 'clear');
  $('wxNight').textContent = t('pad.wxNight');
  $('wxNight').classList.toggle('on', !!menu.night);
}
$('wxCycle').addEventListener('click', () => {
  const next = WX_ORDER[(WX_ORDER.indexOf(menu.weather) + 1) % WX_ORDER.length];
  menu.weather = next;
  vibrate(10, { touch: true });
  send({ t: 'opt', weather: next });
  paintTrack();
});
$('wxNight').addEventListener('click', () => {
  menu.night = !menu.night;
  vibrate(10, { touch: true });
  send({ t: 'opt', night: !!menu.night });
  paintTrack();
});
$('voteBtn').addEventListener('click', () => {
  if (menu.spin || menu.pick) return;
  trackSel.ready = !trackSel.ready;
  menu.lock = trackSel.ready;
  trackSel.touched = true;
  vibrate(trackSel.ready ? [20, 30, 40] : 12, { touch: true });
  sendVote(trackCar.focus);
  paintTrack();
});
function paintResults() {
  // a won Gran Premio opened a family kart: the phone says which, with its picture
  const won = menu.unlocked ? ROSTER.find((m) => m.id === menu.unlocked) : null;
  $('resUnlock').classList.toggle('hide', !won);
  if (won) {
    $('resUnlock').querySelector('img').src = `assets/ui/karts/${won.id}.png`;
    $('resUnlock').querySelector('span').textContent = t('pad.unlocked', { name: label(won.driver.name) });
  }
  const place = Number.isInteger(menu.place) ? menu.place : 0;
  if (place) placeNodes($('resPlace'), place); else $('resPlace').replaceChildren();
  const time = Number.isFinite(menu.time) ? menu.time : null;
  const mm = time === null ? 0 : Math.floor(time / 60);
  $('resTime').textContent = time === null ? '' : menu.forma ? t('pad.formaResult', { time: `${mm}:${String(Math.floor(time - mm * 60)).padStart(2, '0')}` }) : t('pad.time', { time: `${mm}:${(time - mm * 60).toFixed(1).padStart(4, '0')}` });
  if (menu.tt) {
    // alone on the road there is no place to show: the time is the result
    const clock = (s) => { const m = Math.floor(s / 60); return `${m}:${(s - m * 60).toFixed(2).padStart(5, '0')}`.replace('.', lang === 'it' ? ',' : '.'); };
    $('resPlace').textContent = time === null ? '' : clock(time);
    $('resTime').textContent = menu.tt.record ? t('pad.ttRecord') : Number.isFinite(menu.tt.best) ? t('pad.ttBest', { time: clock(menu.tt.best) }) : '';
  }
  // a team championship: how the sides stand, and at the end who took it
  const stands = !!menu.score && !!menu.team;
  $('resTeam').classList.toggle('hide', !stands);
  if (stands) {
    paintTeamScore($('resTeam'), menu.team, menu.score);
    $('resTeam').querySelector('span')?.remove();
    if (menu.won) { const s = document.createElement('span'); s.textContent = menu.won === menu.team ? t('pad.teamWon') : t('pad.teamLost', { team: teamName(menu.won, lang) }); $('resTeam').append(s); }
  }
  const edit = canEdit();
  $('resBtns').classList.toggle('hide', !edit);
  $('resWait').classList.toggle('hide', edit);
  const podium = phase === 'podium';
  $('resAgain').textContent = podium ? t('pad.toLobby') : t('pad.rematch');
  $('resTrack').classList.toggle('hide', podium);
}
$('resAgain').addEventListener('click', () => {
  vibrate(25, { touch: true });
  send({ t: 'opt', next: phase === 'podium' ? 'lobby' : 'rematch' });
});
$('resTrack').addEventListener('click', () => {
  vibrate(25, { touch: true });
  send({ t: 'opt', next: 'track' });
});

// ---------- page hygiene: no zoom, no scroll, screen awake ----------
for (const ev of ['gesturestart', 'gesturechange', 'dblclick', 'contextmenu', 'selectstart']) {
  document.addEventListener(ev, (e) => e.preventDefault());
}
// but a card too tall for a small phone scrolls
document.addEventListener('touchmove', (e) => { const card = e.target.closest?.('#optCard'); if (!card || card.scrollHeight <= card.clientHeight) e.preventDefault(); }, { passive: false });
document.addEventListener('touchstart', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });

// Screen awake: the Wake Lock API where the page may use it (https or localhost). The pad is served over plain
// http on the LAN, which is not a secure context, so there a muted inline video that never ends keeps the screen
// on instead (the NoSleep.js trick and its two tiny clips, MIT). Both need the page to be visible; the video
// also needs a tap.
let wakeLock = null;
let sleepVideo = null;
let awake = null; // 'lock' | 'video' | null, for the tests
function noSleepVideo() {
  const v = document.createElement('video');
  v.muted = true;
  v.setAttribute('muted', '');
  v.setAttribute('playsinline', '');
  v.setAttribute('aria-hidden', 'true');
  v.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
  for (const [type, src] of [['webm', webm], ['mp4', mp4]]) {
    const s = document.createElement('source');
    s.type = `video/${type}`;
    s.src = src;
    v.append(s);
  }
  // the webm clip loops; the mp4 one would end on iOS with a flash of media controls, so it seeks back instead
  v.addEventListener('loadedmetadata', () => {
    if (v.duration <= 1) v.loop = true;
    else v.addEventListener('timeupdate', () => { if (v.currentTime > 0.5) v.currentTime = Math.random(); });
  });
  document.body.append(v);
  return v;
}
async function keepAwake() {
  if (document.visibilityState !== 'visible') return;
  if (navigator.wakeLock) {
    if (wakeLock) return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      awake = 'lock';
      wakeLock.addEventListener('release', () => { wakeLock = null; awake = sleepVideo && !sleepVideo.paused ? 'video' : null; });
      return;
    } catch { wakeLock = null; } // refused (battery saver, a policy): fall back to the video
  }
  if (!activated()) return;
  sleepVideo ||= noSleepVideo();
  if (!sleepVideo.paused) return;
  try { await sleepVideo.play(); awake = 'video'; } catch { awake = null; }
}
// A tap is a user gesture only once the finger lifts: the screen lock, full screen and landscape wait for that.
function activate() {
  keepAwake();
  if (gestured) return;
  gestured = true;
  const el = document.documentElement;
  try { el.requestFullscreen?.({ navigationUI: 'hide' })?.catch?.(() => {}); } catch {}
  try { screen.orientation?.lock?.('landscape')?.catch?.(() => {}); } catch {}
}
document.addEventListener('pointerup', activate, true);
document.addEventListener('touchend', activate, true);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    keepAwake();
    if (replaced) return;
    // Back from a lock or another app: a socket that heard nothing all that time is gone even if it says open.
    if (ws && performance.now() - lastRx > PING_MS * 2) dropSocket();
    if (!ws) { retry = 0; connect(); }
  } else {
    releaseAll();
  }
});
window.addEventListener('pagehide', releaseAll);

$('ovBtn').addEventListener('click', () => { replaced = false; retry = 0; connect(); });
$('lang').addEventListener('pointerdown', (e) => e.stopPropagation());
$('lang').addEventListener('click', () => {
  lang = lang === 'it' ? 'en' : 'it';
  store(LANG_KEY, lang);
  applyLang();
});

// Where a thumb rests on the stick and where the two buttons are (viewport px), with the stick radius and dead zone.
function geometry() {
  const s = stickEl.getBoundingClientRect();
  const [rx, ry] = restPoint();
  const b = itemEl.getBoundingClientRect();
  const d = driftEl.getBoundingClientRect();
  return {
    sx: s.left + rx, sy: s.top + ry, R: radius(), dead: DEAD,
    bx: b.left + b.width / 2, by: b.top + b.height / 2, br: b.width / 2,
    dx: d.left + d.width / 2, dy: d.top + d.height / 2, dr: d.width / 2,
  };
}
const carouselApi = (car, sel, btn) => ({
  get ids() { return car.ids; }, get focus() { return car.focus; }, get ready() { return sel.ready; },
  rect: (id) => car.rect(id),
  readyRect: () => { const r = $(btn).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; },
});
window.__pad = {
  state: st, geometry,
  get slot() { return slot; }, get joined() { return joined; }, get lang() { return lang; }, get phase() { return phase; },
  get pulses() { return pulses; }, get awake() { return awake; }, get screen() { return screenName; }, get menu() { return menu; },
  get item() { return { held: held.item, charges: held.charges, rolling: !!rolling, name: $('itemName').textContent }; },
  get carousel() {
    if (screenName === 'sKart') return carouselApi(kartCar, kartSel, 'readyBtn');
    if (screenName === 'sTrack') return carouselApi(trackCar, trackSel, 'voteBtn');
    return null;
  },
};
applyLang();
layoutStick();
connect();
