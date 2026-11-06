// The kart line-up: every kart on its turntable, each player's card ringed in their colour, and for each player a panel with
// the driver and the stats of the kart in front of them. The phones hold the carousel; a mouse click works too.
import { backdrop, clouds, helmet, check } from './art.js';
import { SEAT_COLORS } from '../style.js';
import { pickLabel } from '../../i18n/index.js';
import { teamIcon } from '../icons.js';
import { teamName } from '../../data/teams.js';

const STATS = ['speed', 'accel', 'handling', 'weight', 'offroad'];

export function createPick(C) {
  const { el, t } = C;
  const root = el('section', 'scr pick hide');
  root.innerHTML = `<div class="bg">${backdrop({ road: false, seed: 19 })}${clouds(5, 21)}</div>
  <div class="stage">
    <div class="tbar"><h1 class="ink"></h1><div class="sub pill"></div></div>
    <div class="secret pill hide"></div>
    <div class="grid"></div>
    <div class="pbar"></div>
  </div>`;
  const $ = (s) => root.querySelector(s);
  const grid = $('.grid'), bar = $('.pbar');
  const pinFor = (s) => `<div class="pin" data-s="${s}">${helmet(SEAT_COLORS[s].main)}${check()}</div>`;
  let data = null;
  const cards = new Map();
  const stages = new Map();
  let spin = 0, order = [], next = 0;
  // the line-up: the nine, plus the family karts this browser has won; everything but this screen knows them all
  const shown = () => (data?.karts ? C.karts.filter((k) => data.karts.includes(k.id)) : C.karts.filter((k) => !k.secret));

  function build() {
    for (const k of shown()) {
      if (cards.has(k.id)) continue;
      const c = el('button', 'kc');
      c.classList.toggle('family', !!k.secret);
      c.type = 'button';
      c.dataset.id = k.id;
      c.dataset.region = k.region;
      c.innerHTML = `<div class="turn"></div><div class="awn"></div><div class="cap"><div class="kn"></div><div class="kd"></div></div><div class="pins">${[0, 1, 2, 3].map(pinFor).join('')}</div>`;
      c.addEventListener('click', () => { C.sound('confirm'); C.emit('pickKart', k.id); });
      grid.append(c);
      cards.set(k.id, c);
    }
  }

  // Turntables arrive one at a time: creating a GL context takes a moment, and the screen has to answer at once.
  async function loadStages() {
    for (const k of shown()) {
      const cardEl = cards.get(k.id);
      if (!cardEl) continue;
      const s = await C.stage(k.id, 0).catch(() => null);
      if (!s || !root.isConnected) continue;
      if (!stages.has(k.id)) { stages.set(k.id, s); order.push(k.id); }
      cardEl.querySelector('.turn').append(s.canvas);
      s.draw(0, spin);
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  function paintPanels() {
    const seats = data.seats.map((s, i) => ({ ...s, i })).filter((s) => s.present);
    bar.classList.toggle('wide', seats.length <= 2);
    const key = seats.map((s) => s.i).join(',');
    if (bar.dataset.key !== key) {
      bar.dataset.key = key;
      bar.innerHTML = seats.map((s) => `<div class="sp" data-seat="${s.i}">${helmet(SEAT_COLORS[s.i].main)}<div class="pn"></div><div class="kname"></div><div class="line"></div><div class="stats">${STATS.map((st) => `<div class="stat" data-st="${st}"><span></span><div class="bars">${'<i></i>'.repeat(5)}</div></div>`).join('')}</div><div class="stamp"></div><div class="teamb hide"></div></div>`).join('');
    }
    for (const s of seats) {
      const p = bar.querySelector(`.sp[data-seat="${s.i}"]`);
      const k = C.karts.find((x) => x.id === s.kart);
      C.text(p.querySelector('.pn'), t('lobby.seat', { n: s.i + 1 }));
      const tb = p.querySelector('.teamb'), side = data.teams ? s.team : null;
      tb.classList.toggle('hide', !side);
      if (side && tb.dataset.team !== side) { tb.dataset.team = side; tb.innerHTML = `${teamIcon(side)}<span>${teamName(side, C.lang())}</span>`; }
      C.text(p.querySelector('.kname'), k ? k.name : t('pick.choosing'));
      C.text(p.querySelector('.line'), k ? `${k.driver.name}, ${pickLabel(C.lang(), k.driver.species)}. ${pickLabel(C.lang(), k.driver.line)}` : '');
      for (const st of STATS) {
        const row = p.querySelector(`.stat[data-st="${st}"]`);
        C.text(row.querySelector('span'), t(`stat.${st}`));
        const v = k?.stats?.[st] || 0;
        row.querySelectorAll('i').forEach((b, n) => b.classList.toggle('on', n < v));
      }
      C.text(p.querySelector('.stamp'), t('pick.ready'));
      const was = p.classList.contains('ready');
      p.classList.toggle('ready', !!s.ready);
      p.classList.toggle('away', !!s.away);
      if (!was && s.ready) C.sound('confirm');
    }
  }

  function paint() {
    if (!data) return;
    C.text($('.tbar h1'), t('pick.title'));
    C.text($('.sub'), data.allReady ? t('pick.everyone') : data.hasKeyboard ? t('pick.keys') : t('pick.sub'));
    const hint = $('.secret');
    hint.classList.toggle('hide', !data.locked);
    if (data.locked) C.text(hint, t(data.locked > 1 ? 'pick.secretTwo' : 'pick.secretOne'));
    grid.classList.toggle('many', shown().length > 10);
    for (const k of shown()) {
      const c = cards.get(k.id);
      C.text(c.querySelector('.kn'), k.name);
      C.text(c.querySelector('.kd'), `${k.driver.name}, ${pickLabel(C.lang(), k.driver.species)}`);
      const mine = data.seats.map((s, i) => (s.present && s.kart === k.id ? i : -1)).filter((i) => i >= 0);
      for (let i = 0; i < 4; i++) {
        c.classList.toggle(`f${i}`, mine.includes(i));
        const pin = c.querySelector(`.pin[data-s="${i}"]`);
        pin.classList.toggle('on', mine.includes(i));
        pin.classList.toggle('done', mine.includes(i) && !!data.seats[i].ready);
      }
      c.classList.toggle('fx', mine.length > 0);
    }
    paintPanels();
  }

  return {
    el: root,
    enter(d) {
      data = d;
      build();
      paint();
      loadStages();
    },
    update(d) { data = { ...data, ...d }; build(); paint(); },
    tick(dt) {
      if (!order.length) return;
      spin = (spin + dt * 0.75) % (Math.PI * 2);
      // the karts somebody is looking at turn every frame, the others take turns: nine contexts at 60 Hz buy nothing
      const focused = new Set((data?.seats || []).map((s) => s.kart).filter(Boolean));
      for (const id of focused) stages.get(id)?.draw(dt, spin);
      for (let n = 0; n < 3; n++) {
        const id = order[next = (next + 1) % order.length];
        if (!focused.has(id)) stages.get(id)?.draw(dt, spin);
      }
    },
    relabel() { paint(); },
  };
}
