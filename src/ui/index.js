// The TV's screens as DOM over the game canvas. main.js owns the logic: it calls show(), update() and hud.*, and hears what the
// player does through on(). Every visible string comes from src/i18n.
//
//   const ui = createUI(document.body, { lang, karts, tracks, stage, thumb, sound });
//   ui.show('lobby', {...}); ui.update('lobby', {...}); ui.on('go', fn); ui.tick(dt);
// Main screens are exclusive: lobby, pick, vote, loading, hud, results, podium. Pause, the sound sticker, the toasts and the
// error card go over them.
import { CSS } from './style.js';
import { translator } from '../i18n/index.js';
import { createLobby } from './screens/lobby.js';
import { createPick } from './screens/pick.js';
import { createVote } from './screens/vote.js';
import { createHud } from './screens/hud.js';
import { createLoading, createPause, createResults, createPodium } from './screens/results.js';
import { pauseIcon } from './screens/art.js';

const CSS_ID = 'rk-ui-style';

export function createUI(root, { lang = 'it', karts = [], tracks = [], itemIds = [], stage, thumb, has, icon, sound = () => {} } = {}) {
  const doc = root.ownerDocument;
  if (!doc.getElementById(CSS_ID)) {
    const style = doc.createElement('style');
    style.id = CSS_ID;
    style.textContent = CSS;
    doc.head.append(style);
  }
  let current = lang;
  let tr = translator(lang);
  const listeners = new Map();
  const el = (tag, cls, html) => {
    const e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (html) e.innerHTML = html;
    return e;
  };
  const C = {
    el,
    t: (k, v) => tr(k, v),
    lang: () => current,
    text(e, s) { if (e && e.textContent !== s) e.textContent = s; return e; },
    emit(name, arg) { for (const fn of listeners.get(name) || []) { try { fn(arg); } catch (e) { console.error(e); } } },
    sound,
    karts,
    tracks,
    itemIds,
    stage,
    thumb,
    has,
    icon,
    pauseIcon,
    kartDriver: (id) => karts.find((k) => k.id === id)?.driver?.name || id,
  };

  const ui = el('div', 'rk');
  ui.lang = lang;
  root.append(ui);

  const screens = {
    lobby: createLobby(C), pick: createPick(C), vote: createVote(C), loading: createLoading(C),
    hud: createHud(C), results: createResults(C), podium: createPodium(C),
  };
  const pause = createPause(C);
  for (const s of Object.values(screens)) ui.append(s.el);
  ui.append(pause.el);
  const toasts = el('div', 'toasts');
  const sticker = el('div', 'sticker hide');
  sticker.innerHTML = `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 18h8l11-9v30l-11-9H8z" fill="#fff" stroke="#1d1f2b" stroke-width="4" stroke-linejoin="round"/><path d="M33 17c3 4 3 10 0 14M38 12c6 7 6 17 0 24" fill="none" stroke="#1d1f2b" stroke-width="4" stroke-linecap="round"/></svg><span></span>`;
  const errCard = el('div', 'errcard card hide');
  errCard.innerHTML = '<h2></h2><p></p>';
  const rejoinCard = el('div', 'rejoin card hide');
  rejoinCard.innerHTML = '<img alt=""><b></b><span></span>';
  ui.append(toasts, sticker, errCard, rejoinCard);

  let shown = null;
  // A mouse that moves shows what only a mouse can use.
  let mouseTimer = 0;
  doc.addEventListener('mousemove', () => {
    ui.classList.add('mouse');
    clearTimeout(mouseTimer);
    mouseTimer = setTimeout(() => ui.classList.remove('mouse'), 2200);
  });

  const api = {
    root: ui,
    C,
    screens,
    get current() { return shown; },
    on(name, fn) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(fn);
      return () => listeners.get(name).delete(fn);
    },
    show(name, data) {
      if (shown !== name) {
        for (const [k, s] of Object.entries(screens)) if (k !== name) s.el.classList.add('hide');
        shown = name;
      }
      const s = screens[name];
      s.el.classList.remove('hide', 'enter');
      void s.el.offsetWidth;
      s.el.classList.add('enter');
      s.enter?.(data);
    },
    update(name, data) { if (shown === name) screens[name].update?.(data); },
    hideAll() { for (const s of Object.values(screens)) s.el.classList.add('hide'); shown = null; },
    setLang(l) {
      current = l;
      ui.lang = l;
      doc.documentElement.lang = l;
      tr = translator(l);
      for (const s of Object.values(screens)) s.relabel?.();
      sticker.querySelector('span').textContent = tr('audio.sticker');
    },
    sticker(on) {
      sticker.classList.toggle('hide', !on);
      if (on) sticker.querySelector('span').textContent = tr('audio.sticker');
    },
    pause(on) {
      pause.el.classList.toggle('hide', !on);
      if (on) pause.enter();
    },
    toast(text) {
      const p = el('div', 'pill');
      p.textContent = text;
      toasts.append(p);
      setTimeout(() => p.remove(), 4000);
    },
    error(titleKey, bodyKey) {
      errCard.classList.remove('hide');
      errCard.querySelector('h2').textContent = tr(titleKey);
      errCard.querySelector('p').textContent = tr(bodyKey);
    },
    clearError() { errCard.classList.add('hide'); },
    // The way back in for a phone that lost the game: url null hides it, corner keeps it out of a menu's way.
    rejoin(url, corner = false) {
      rejoinCard.classList.toggle('hide', !url);
      rejoinCard.classList.toggle('corner', !!corner);
      if (!url) return;
      const qr = `qr.svg?u=${encodeURIComponent(url)}`;
      const img = rejoinCard.querySelector('img');
      if (img.dataset.src !== qr) { img.dataset.src = qr; img.src = qr; }
      rejoinCard.querySelector('b').textContent = tr('rejoin.title');
      rejoinCard.querySelector('span').textContent = url.replace(/^https?:\/\//, '');
    },
    tick(dt) { if (shown) screens[shown].tick?.(dt); },
    t: (k, v) => tr(k, v),
  };
  return api;
}
