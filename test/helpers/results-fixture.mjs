// A page with the TV's real screens (src/ui) and the real rules (src/game/flow.js), for layout checks of the results and the
// podium without a race: test/podium-layout.test.mjs bundles it. The karts on the steps are flat stand-ins, not the 3D ones.
// window.__fx.show({ mode, phones, screen, lang }) paints a scenario with the last phone away, so the rejoin QR card is up;
// window.__fx.boxes() returns the card's box and every box it must leave free.
import { createUI } from '../../src/ui/index.js';
import { ROSTER, KART_IDS, SECRET_IDS, kartInfo } from '../../src/data/karts.js';
import { TRACKS, TRACK_IDS } from '../../src/data/tracks.js';
import { ITEM_IDS } from '../../src/data/items.js';
import { itemIcon } from '../../src/ui/icons.js';
import { createFlow } from '../../src/game/flow.js';
import { formaRows } from '../../src/game/forma.js';

const seeded = (s) => () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
const LIST = TRACK_IDS.slice(0, 3);

// A flat kart for the steps: a disc in the kart's colour, so the box is filled where the real one would be.
function stage(id) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const g = canvas.getContext('2d');
  g.fillStyle = kartInfo(id)?.color || '#888';
  g.strokeStyle = '#1d1f2b'; g.lineWidth = 14;
  g.beginPath(); g.ellipse(256, 330, 190, 120, 0, 0, 7); g.fill(); g.stroke();
  g.fillStyle = '#1d1f2b'; g.font = 'bold 64px sans-serif'; g.textAlign = 'center'; g.fillText(id, 256, 350);
  return Promise.resolve({ canvas, draw() {} });
}

let ui = null;
function mount(lang) {
  if (ui && ui.lang === lang) return ui;
  document.body.replaceChildren();
  ui = createUI(document.body, { lang, karts: ROSTER, tracks: TRACKS, itemIds: ITEM_IDS, stage, thumb: () => '', has: (id) => !!kartInfo(id), icon: itemIcon });
  ui.lang = lang;
  return ui;
}

// The race as the flow sees it: phones seated, karts picked, the track or the championship chosen, then races with the people up front.
function played(mode, phones) {
  const f = createFlow({ karts: KART_IDS, tracks: LIST, rng: seeded(7) });
  f.setOpts({ mode, ...(mode === 'race' || mode === 'gp' ? { bots: 5 } : {}) });
  for (let s = 0; s < phones; s++) f.join(s);
  f.go();
  for (let s = 0; s < phones; s++) f.pick(s, KART_IDS[s], true);
  f.step(5);
  if (mode === 'gp' || mode === 'teams') { f.gpPreset('all'); f.gpStart(); } else { f.forceTrack(LIST[0]); f.step(10); }
  const races = mode === 'gp' || mode === 'teams' ? LIST.length : 1;
  for (let r = 0; r < races; r++) {
    const field = f.field();
    // people first, then bots, the order turning a little each race so that teammates differ in points
    const order = [...field.filter((p) => p.human), ...field.filter((p) => !p.human)];
    for (let k = 0; k < r; k++) order.push(order.splice(1, 1)[0]);
    let rows = order.map((p, n) => ({ i: field.indexOf(p), slot: p.slot, kart: p.kart, human: p.human, place: n + 1, time: 64 + n * 1.7, bestLap: 20.5 + n * 0.3, ...(p.team ? { team: p.team } : {}) }));
    if (mode === 'forma') {
      const F = { held: [], best: [], grabs: [], drops: [] };
      for (const row of rows) { F.held[row.i] = 95 - row.place * 9; F.best[row.i] = 40 - row.place * 3; F.grabs[row.i] = 6 - Math.min(5, row.place); F.drops[row.i] = 1; }
      rows = formaRows(rows, F);
    }
    f.loaded();
    f.raceDone(rows);
    if (r < races - 1) f.next('rematch');
  }
  return f;
}

function timeTrial(phones) {
  const rows = Array.from({ length: phones }, (_, n) => ({
    i: n, slot: n, kart: KART_IDS[n], human: true, place: n + 1, time: 95.4 + n * 3.1, bestLap: 31.2 + n,
    tt: { delta: n ? 1.2 * n : -0.4, record: n === 0, first: false, totalRecord: false, best: 31.0,
      laps: [1, 2, 3].map((q) => ({ n: q, time: 31.5 + q * 0.3 + n, record: n === 0 && q === 1, delta: n === 0 && q === 1 ? -0.4 : 0.3 * q })) },
  }));
  return { rows, trackName: 'Antelao', gp: null, nextName: '', tt: { table: KART_IDS.slice(0, 9).map((kart, n) => ({ kart, lap: 30.4 + n * 0.6 })) }, forma: false };
}

function resultsData(f) {
  const r = f.state.results, gp = f.state.gp;
  return {
    rows: r.rows, trackName: 'Antelao',
    gp: gp ? { n: gp.index, of: gp.tracks.length, finished: gp.finished, table: f.gpTable(), ...(gp.teams ? { teams: f.teamTable() } : {}) } : null,
    nextName: '', tt: null, forma: r.rows.some((x) => x.forma),
  };
}

function podiumData(f) {
  const top = f.top3(), gp = f.state.gp;
  // a championship won by a person opens a family kart, and its card sits on the podium too
  const champ = gp?.finished ? (gp.teams ? f.teamTable()[0].members.find((m) => m.human) : f.gpTable()[0]?.human) : null;
  return { top, gp: !!gp?.finished, trackName: gp?.finished ? '' : 'Antelao', unlocked: champ ? SECRET_IDS[0] : null, forma: top.some((x) => x.forma), teams: gp?.finished && gp.teams ? f.teamTable() : null };
}

const settle = () => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));

window.__fx = {
  async show({ mode, phones, screen, lang = 'en' }) {
    const u = mount(lang);
    const away = phones - 1, present = Array.from({ length: phones }, (_, s) => s).filter((s) => s !== away);
    if (mode === 'time') u.show('results', timeTrial(phones));
    else {
      const f = played(mode, phones);
      if (screen === 'podium') u.show('podium', podiumData(f));
      else u.show('results', resultsData(f));
    }
    u.rejoin('http://192.168.100.173:5191/pad'); // a long address, the widest the card meets on a home network
    u.offline([{ slot: away, left: phones % 2 ? 74 : null }]); // the clock, or the longer words past the grace
    u.advance(present.length ? { ready: present.slice(0, 1), of: present } : null);
    // the podium puts its karts on the steps after their stages resolve
    for (let i = 0; i < 6; i++) await settle();
    return u.current;
  },
  // What the QR card must never cover, by selector, each with its text for the report.
  boxes() {
    const box = (e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
    const card = document.querySelector('.rk .rejoin');
    const keep = [
      '.podscr:not(.hide) .stp .block', '.podscr:not(.hide) .stp .nameplate', '.podscr:not(.hide) .stp .tnames > span', '.podscr:not(.hide) .stp .kartc',
      '.podscr:not(.hide) .tbar h1', '.podscr:not(.hide) .tbar .sub', '.podscr:not(.hide) .unlockc', '.podscr:not(.hide) .rfoot .bigbtn',
      '.results:not(.hide) .tcard', '.results:not(.hide) .gcard', '.results:not(.hide) .ttnew', '.results:not(.hide) .tbar h1', '.results:not(.hide) .tbar .sub', '.results:not(.hide) .rfoot .bigbtn',
      '.rk .readybar', '.rk .toasts .offline',
    ];
    const out = [];
    for (const sel of keep) {
      for (const e of document.querySelectorAll(sel)) {
        const b = box(e);
        if (b.w > 0 && b.h > 0) out.push({ sel, text: e.textContent.trim().replace(/\s+/g, ' ').slice(0, 60), ...b });
      }
    }
    const shown = (sel) => { const e = document.querySelector(sel); return e && !e.closest('.hide') ? box(e) : null; };
    return { card: card && !card.classList.contains('hide') ? box(card) : null, ready: shown('.rk .readybar'), off: shown('.rk .toasts .offline'), keep: out, view: { w: innerWidth, h: innerHeight } };
  },
  // The menus with a title, a phone away: { screen: 'lobby' | 'pick' | 'vote', lang, sticker }. Returns the offline pill's box and
  // the titles it must leave free.
  async menu({ screen, lang = 'en', sticker = false }) {
    const u = mount(lang);
    const f = createFlow({ karts: KART_IDS, tracks: LIST, rng: seeded(7) });
    for (let s = 0; s < 3; s++) f.join(s);
    const seats = () => f.seats.map((x) => ({ ...x }));
    if (screen === 'lobby') u.show('lobby', { seats: seats(), opts: { ...f.opts }, padUrl: 'http://192.168.100.173:5191/pad', waiting: false });
    else {
      f.go();
      if (screen === 'pick') u.show('pick', { karts: f.pickable, locked: [], teams: false, seats: seats(), allReady: false, hasKeyboard: false });
      else {
        for (let s = 0; s < 3; s++) f.pick(s, KART_IDS[s], true);
        f.step(5);
        u.show('vote', { seats: seats(), vote: { ...f.state.vote }, available: LIST, blurbs: {}, mode: f.opts.mode, opts: { ...f.opts }, list: [...f.state.list], gpMin: f.gpMin, gpFill: 3, regions: [...new Set(LIST.map((id) => TRACKS.find((t) => t.id === id)?.region).filter(Boolean))], records: null });
      }
    }
    u.sticker(sticker);
    u.offline([{ slot: 1, left: 74 }, { slot: 2, left: null }]);
    for (let i = 0; i < 3; i++) await settle();
    const box = (e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
    const keep = [];
    for (const sel of ['.tbar h1', '.tbar .sub', '.logo', '.secret', '.langs', '.grid', '.seats', '.join', '.opts', '.wxvote']) {
      for (const e of document.querySelectorAll(`.scr:not(.hide) ${sel}`)) {
        const b = box(e);
        if (b.w > 0 && b.h > 0 && getComputedStyle(e).visibility !== 'hidden') keep.push({ sel, text: e.textContent.trim().replace(/\s+/g, ' ').slice(0, 40), ...b });
      }
    }
    const st = document.querySelector('.rk .sticker');
    if (sticker && st && !st.classList.contains('hide')) keep.push({ sel: '.sticker', text: '', ...box(st) });
    return { current: u.current, off: box(document.querySelector('.rk .toasts .offline')), keep, view: { w: innerWidth, h: innerHeight } };
  },
};
