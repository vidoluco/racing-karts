// The lobby: a cartoon mountain morning with karts parked on the road, the QR big enough to scan across a room, the four seats
// and the race options. Everything is usable by mouse here, by phone there.
import { backdrop, clouds, logo, helmet, phone, wifi, keycap, check } from './art.js';
import { SEAT_COLORS } from '../style.js';
import { LANGS } from '../../i18n/index.js';
import { teamIcon } from '../icons.js';
import { teamName } from '../../data/teams.js';
import { VOICE_LANGS, VOICE_NAMES } from '../../data/commentary.js';
import { WEATHER_CHOICES } from '../../data/weather.js';

// [kart, x, y of the bottom edge, size, yaw] on the 1920x1080 stage
const PARKED = [['tabia', 790, 1096, 300, 2.5], ['mocanita', 1730, 1076, 310, -2.5], ['jukung', 1090, 1096, 290, 2.7], ['jeep', 1410, 1086, 300, -2.7], ['seggiovia', 480, 1100, 262, -2.3], ['caruta', 170, 1104, 262, 2.3]];

// the bots that really race: the option, capped by the grid of eight once the humans are in
const seatsLeft = (d) => {
  const n = Math.max(1, (d?.seats || []).filter((s) => s.present).length), asked = Math.max(0, Math.min(d?.opts?.bots ?? 7, 8 - n));
  if (d?.opts?.mode === 'forma' && n === 1) return Math.max(asked, 3); // nobody hunts a wheel alone
  return d?.opts?.mode === 'teams' ? Math.max(asked, 4 - n) : asked; // two a side, whatever the option says
};

export function createLobby(C) {
  const { el, t } = C;
  const root = el('section', 'scr lobby hide');
  root.innerHTML = `
  <div class="bg">${backdrop()}${clouds(6, 11)}<div class="parked"></div></div>
  <div class="stage">
    <div class="logoHold"></div>
    <div class="tag pill slide"></div>
    <div class="langs">${LANGS.map((l) => `<button type="button" data-lang="${l}">${l.toUpperCase()}</button>`).join('')}</div>
    <div class="join card pop">
      <h2>${phone()}<span class="jt"></span></h2>
      <div class="qr"><img alt="QR"></div>
      <div class="url"></div>
      <div class="small">${wifi()}<span class="jw"></span></div>
      <div class="small"><span class="jk"></span></div>
    </div>
    <div class="seats">${[0, 1, 2, 3].map((s) => `<div class="seat" data-seat="${s}"><div class="num">${s + 1}</div><div class="hm"></div><div class="sn ink"></div><div class="st">${phone()}${keycap()}${check()}<span class="stx"></span></div><button type="button" class="teamb hide" data-team-seat="${s}"></button></div>`).join('')}</div>
    <div class="opts card pop">
      <div class="optrow"><label class="ld"></label><div class="chips" data-key="difficulty">${['easy', 'medium', 'hard'].map((v) => `<button type="button" class="chip" data-v="${v}"></button>`).join('')}</div></div>
      <div class="optrow"><label class="lb"></label><div class="stepper"><button type="button" data-d="-1">-</button><b class="botsN"></b><button type="button" data-d="1">+</button><div class="botrow"></div></div></div>
      <div class="optrow"><label class="ll"></label><div class="chips" data-key="laps">${[2, 3, 5].map((v) => `<button type="button" class="chip" data-v="${v}">${v}</button>`).join('')}</div></div>
      <div class="optrow"><label class="lm"></label><div class="chips" data-key="mode">${['race', 'gp', 'time', 'teams', 'forma'].map((v) => `<button type="button" class="chip" data-v="${v}"></button>`).join('')}</div></div>
      <div class="optrow"><label class="lv"></label><div class="chips" data-key="voice"><button type="button" class="chip" data-v="off"></button>${VOICE_LANGS.map((v) => `<button type="button" class="chip" data-v="${v}">${VOICE_NAMES[v]}</button>`).join('')}</div></div>
      <div class="optrow wxrow"><label class="lw"></label><div class="wxchips"><div class="chips" data-key="weather">${WEATHER_CHOICES.map((v) => `<button type="button" class="chip" data-v="${v}"></button>`).join('')}</div><div class="chips" data-key="night"><button type="button" class="chip moon" data-v="night"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" fill="currentColor"/></svg><span></span></button></div></div></div>
    </div>
    <button type="button" class="bigbtn green gobtn pop"><b class="ink"></b><span></span></button>
    <div class="wait pill hide"></div>
  </div>`;
  const $ = (s) => root.querySelector(s);
  const stage = $('.stage');
  const logoHold = $('.logoHold');
  logoHold.outerHTML = logo(t('game.title'));

  const helmets = [0, 1, 2, 3].map((s) => ({ on: helmet(SEAT_COLORS[s].main), off: helmet('#d9d5cf', { mood: 'asleep', visor: '#f4f1ea' }), sad: helmet(SEAT_COLORS[s].main, { mood: 'sad' }) }));
  const botOn = helmet('#b7a78a');
  let data = null, lastHm = ['', '', '', ''];

  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    C.sound('click');
    if (b.dataset.lang) return C.emit('lang', b.dataset.lang);
    if (b.classList.contains('gobtn')) return C.emit('go');
    if (b.dataset.teamSeat) return C.emit('team', { slot: Number(b.dataset.teamSeat), team: b.dataset.team === 'a' ? 'b' : 'a' });
    const chips = b.closest('.chips');
    if (chips) {
      const key = chips.dataset.key, raw = b.dataset.v;
      if (key === 'night') return C.emit('opt', { night: !data?.opts?.night });
      return C.emit('opt', { [key]: key === 'laps' ? Number(raw) : raw });
    }
    if (b.dataset.d) return C.emit('opt', { bots: seatsLeft(data) + Number(b.dataset.d) });
  });

  function paint() {
    if (!data) return;
    const { seats, opts, padUrl, waiting } = data;
    C.text($('.tag'), t('game.tag'));
    C.text($('.jt'), t('lobby.join'));
    C.text($('.jw'), t('lobby.wifi'));
    C.text($('.jk'), opts.mode === 'teams' ? t('lobby.teamsHint') : t('lobby.keys'));
    const short = (padUrl || '').replace(/^https?:\/\//, '');
    C.text($('.url'), short);
    const img = $('.qr img');
    const qr = padUrl ? `qr.svg?u=${encodeURIComponent(padUrl)}` : '';
    if (qr && img.dataset.src !== qr) { img.dataset.src = qr; img.src = qr; }
    root.querySelectorAll('.langs button').forEach((b) => b.classList.toggle('on', b.dataset.lang === C.lang()));
    C.text($('.ld'), t('lobby.difficulty')); C.text($('.lb'), t('lobby.bots')); C.text($('.ll'), t('lobby.laps')); C.text($('.lm'), t('lobby.mode'));
    root.querySelector('[data-v="easy"]').textContent = t('lobby.easy');
    root.querySelector('[data-v="medium"]').textContent = t('lobby.medium');
    root.querySelector('[data-v="hard"]').textContent = t('lobby.hard');
    root.querySelector('[data-v="race"]').textContent = t('lobby.race');
    root.querySelector('[data-v="gp"]').textContent = t('lobby.gp');
    root.querySelector('[data-v="time"]').textContent = t('lobby.time');
    root.querySelector('[data-v="teams"]').textContent = t('lobby.teams');
    root.querySelector('[data-v="forma"]').textContent = t('lobby.forma');
    C.text($('.lv'), t('lobby.voice'));
    C.text($('.lw'), t('lobby.weather'));
    for (const v of WEATHER_CHOICES) root.querySelector(`[data-key="weather"] [data-v="${v}"]`).textContent = t(`lobby.wx.${v}`);
    root.querySelector('[data-key="night"] [data-v="night"] span').textContent = t('lobby.wx.night');
    root.querySelector('[data-v="off"]').textContent = t('lobby.voiceOff');
    // the clock ends the hunt, not the laps
    $('.ll').parentElement.classList.toggle('off', opts.mode === 'forma');
    const teams = opts.mode === 'teams';
    root.classList.toggle('teams', teams);
    // alone against the clock: no bots to count and no one to be hard on
    const trial = opts.mode === 'time';
    $('.ld').parentElement.classList.toggle('off', trial);
    $('.lb').parentElement.classList.toggle('off', trial);
    $('.lw').parentElement.classList.toggle('off', trial);
    root.querySelectorAll('.chips').forEach((c) => {
      const cur = c.dataset.key === 'voice' ? (opts.voice ?? 'off') : c.dataset.key === 'weather' ? (opts.weather ?? 'clear') : c.dataset.key === 'night' ? (opts.night ? 'night' : '') : String(opts[c.dataset.key]);
      c.querySelectorAll('.chip').forEach((b) => b.classList.toggle('on', b.dataset.v === cur));
    });
    const n = seats.filter((s) => s.present).length;
    const realBots = seatsLeft(data);
    C.text($('.botsN'), String(realBots));
    const row = $('.botrow');
    if (row.dataset.n !== String(realBots)) { row.dataset.n = String(realBots); row.innerHTML = Array.from({ length: 7 }, (_, i) => botOn.replace('class="helmet"', `class="helmet${i < realBots ? '' : ' off'}"`)).join(''); }
    seats.forEach((s, i) => {
      const e = root.querySelector(`.seat[data-seat="${i}"]`);
      const was = e.classList.contains('on');
      e.classList.toggle('on', s.present && !s.away);
      e.classList.toggle('away', s.present && s.away);
      e.classList.toggle('pad', s.present && s.source === 'pad');
      e.classList.toggle('kb', s.present && s.source === 'keyboard');
      const kind = s.present ? (s.away ? 'sad' : 'on') : 'off';
      if (lastHm[i] !== kind) { lastHm[i] = kind; e.querySelector('.hm').innerHTML = helmets[i][kind]; }
      C.text(e.querySelector('.sn'), t('lobby.seat', { n: i + 1 }));
      const tb = e.querySelector('.teamb'), side = teams && s.present ? s.team : null;
      tb.classList.toggle('hide', !side);
      if (side && tb.dataset.team + C.lang() !== side + tb.dataset.l) { tb.dataset.team = side; tb.dataset.l = C.lang(); tb.innerHTML = `${teamIcon(side)}<span>${teamName(side, C.lang())}</span><svg class="swap" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h13m-4-4 4 4-4 4M20 16H7m4-4-4 4 4 4" fill="none" stroke="#1d1f2b" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 8h13m-4-4 4 4-4 4M20 16H7m4-4-4 4 4 4" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`; }
      C.text(e.querySelector('.stx'), !s.present ? t('lobby.freeHint') : s.away ? t('lobby.away') : s.source === 'keyboard' ? t('lobby.keyboard') : t('lobby.here'));
      if (!was && s.present && !s.away) {
        e.classList.remove('just'); void e.offsetWidth; e.classList.add('just');
        hop(i);
      }
    });
    C.text($('.gobtn b'), t('lobby.start'));
    C.text($('.gobtn span'), opts.mode === 'forma' ? t('lobby.startForma') : teams ?(realBots > Math.max(0, 4 - Math.max(1, n)) ? t('lobby.startTeams', { b: realBots - (4 - Math.max(1, n)) }) : t('lobby.startTeamsOnly')) : trial ? t('lobby.startTime') : n === 0 ? t('lobby.startSolo') : n === 1 ? t('lobby.startOne', { b: realBots }) : t('lobby.startN', { n, b: realBots }));
    $('.gobtn').classList.toggle('ready', n > 0);
    const w = $('.wait');
    w.classList.toggle('hide', !waiting);
    if (waiting) C.text(w, t('lobby.full', { n: waiting }));
  }

  // karts on the road: real models, added one at a time so the first frame of the lobby never waits on them
  const parked = root.querySelector('.parked');
  const parkedEls = [];
  let parkedDone = false, live = [];
  async function park() {
    if (parkedDone) return;
    parkedDone = true;
    for (const [id, x, y, w, yaw] of PARKED) {
      if (!C.has?.(id)) continue;
      const d = document.createElement('div');
      d.className = 'pk';
      d.style.cssText = `left:calc(var(--u0) * ${x} + 50% - var(--u0) * 960);top:calc(var(--u0) * ${y} + 50% - var(--u0) * 540);--w:${w};--d:${(Math.random() * 0.9).toFixed(2)}s`;
      parked.append(d);
      parkedEls.push(d);
      const s = await C.stage(id, 0).catch(() => null);
      if (!s) continue;
      d.append(s.canvas);
      s.draw(0, yaw);
      live.push({ s, yaw, id, d });
    }
  }
  // the stage canvases are shared with the pick screen: put them back when we return here
  function restore() {
    for (const p of live) { if (p.s.canvas.parentElement !== p.d) p.d.append(p.s.canvas); p.s.draw(0, p.yaw); }
  }
  function hop(i) {
    const p = parkedEls[i % parkedEls.length];
    if (!p) return;
    p.classList.remove('hop'); void p.offsetWidth; p.classList.add('hop');
    setTimeout(() => p.classList.remove('hop'), 800);
  }
  let idleAt = 0;
  return {
    el: root,
    enter(d) { data = d; paint(); park(); restore(); },
    update(d) { data = { ...data, ...d }; paint(); },
    tick(dt) {
      // a slow breath of the model at a low rate: most of the charm is in the CSS bob
      idleAt += dt;
      if (idleAt > 0.25) { idleAt = 0; for (const p of live) p.s.draw(0.25, p.yaw); }
    },
    relabel() { paint(); },
  };
}
