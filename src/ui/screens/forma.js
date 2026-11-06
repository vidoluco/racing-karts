// Caccia alla Forma on the TV: for each view where the wheel is and who has it, the clock in the lap's place, the table in the corner and
// your own seconds over your place; and the results. Fed by the sim's state.forma, writes the DOM only when something it shows has changed.
import { ordinal, formatTime } from '../../i18n/index.js';

const INK = '#1d1f2b';
export const formaIcon = (cls = 'foic') => `<svg class="${cls}" viewBox="0 0 64 64" aria-hidden="true"><path d="M32 6a26 26 0 1 0 26 26L32 32Z" fill="#f8e08c" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/><path d="M38 6.8a26 26 0 0 1 19.2 19.2L38 26Z" fill="#ffd23f" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/><circle cx="20" cy="24" r="4.4" fill="#e2bd5c"/><circle cx="33" cy="46" r="5" fill="#e2bd5c"/><circle cx="17" cy="42" r="3" fill="#e2bd5c"/><circle cx="46" cy="42" r="3.4" fill="#e2bd5c"/></svg>`;
const arrowIcon = () => `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 4 L36 22 L27 22 L27 36 L13 36 L13 22 L4 22 Z" fill="#fff" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round"/></svg>`;

const mmss = (s) => { const v = Math.max(0, Math.ceil(s)), m = Math.floor(v / 60); return `${m}:${String(v - m * 60).padStart(2, '0')}`; };
const held = (s) => { const v = Math.max(0, Math.floor(s)), m = Math.floor(v / 60); return `${m}:${String(v - m * 60).padStart(2, '0')}`; };
const nearM = (g) => Math.max(10, Math.round(Math.abs(g) / 10) * 10);

// The wheel on a map: a fat gold disc with a ring that breathes, the one thing a glance at the map must find.
export function formaMark(g, x, y, size, t) {
  const r = size * 0.05;
  g.beginPath(); g.arc(x, y, r * (1.5 + 0.35 * Math.sin(t * 7)), 0, 7); g.fillStyle = 'rgba(255, 210, 63, 0.42)'; g.fill();
  g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = '#ffd23f'; g.fill(); g.lineWidth = size * 0.016; g.strokeStyle = INK; g.stroke();
}

// Everything one view adds to the race HUD.
export function formaView(o, C, info) {
  const { t } = C;
  const e = o.e;
  e.classList.add('forma');
  e.insertAdjacentHTML('beforeend', `<div class="fo-where"><div class="fo-i">${formaIcon()}</div><div class="fo-tx"><b></b><span></span><i class="fo-kg"><u></u></i></div><div class="fo-arrow">${arrowIcon()}</div></div>
    <div class="fo-board"></div><div class="fo-mine">${formaIcon()}<b></b></div><div class="fo-count"></div>`);
  const $ = (s) => e.querySelector(s);
  const where = $('.fo-where');
  C.text($('.lap small'), t('forma.clock'));
  const lastW = { key: null }, name = (i, state) => { const k = state.karts[i]; return k.human ? t('res.you', { n: k.slot + 1 }) : C.kartDriver(k.kart); };
  let boardAt = 0, boardKey = null, clock = null, mineTxt = null, was = null, cd = null;

  function paintWhere(F, k, state) {
    const mine = F.holder === k.i, h = F.holder, g = F.gaps[k.i] ?? 0, near = Math.abs(g) < 12, behind = g < 0;
    let title, sub = '', cls;
    if (mine) { title = t('forma.mine'); sub = t('forma.mineSub'); cls = 'mine'; }
    else {
      title = h >= 0 ? t('forma.holder', { who: name(h, state) }) : behind && !near ? t('forma.behind') : t('forma.loose');
      sub = near ? t('forma.close') : behind ? t('forma.back', { m: nearM(g) }) : t('forma.ahead', { m: nearM(g) });
      cls = h >= 0 ? 'held' : 'loose';
    }
    const key = `${title}|${sub}|${cls}|${behind}|${near}`;
    if (key !== lastW.key) {
      lastW.key = key;
      where.className = `fo-where ${cls}${!mine && behind && !near ? ' back' : ''}${near ? ' near' : ''}`;
      C.text(where.querySelector('b'), title);
      C.text(where.querySelector('.fo-tx span'), sub);
    }
    if (h >= 0) where.dataset.seat = state.karts[h].human ? state.karts[h].slot : '';
    if (mine) where.querySelector('.fo-kg u').style.width = `${Math.min(100, F.streak[k.i] / 90 * 100).toFixed(0)}%`;
  }

  function paintBoard(F, k, state) {
    // the first three and you, if you are not one of them: no more than the corner can hold in a split
    const order = state.karts.map((x) => x.i).sort((a, b) => F.rank[a] - F.rank[b]), list = order.slice(0, 3);
    if (!list.includes(k.i)) list.push(k.i);
    const key = list.map((i) => `${i}:${F.rank[i]}:${Math.floor(F.held[i])}:${F.holder === i}`).join('|');
    if (key === boardKey) return;
    boardKey = key;
    $('.fo-board').innerHTML = list.map((i) => {
      const q = state.karts[i], [a, b] = ordinal(C.lang(), F.rank[i]);
      return `<div class="fo-row${i === k.i ? ' me' : ''}${F.holder === i ? ' has' : ''}"><span class="p">${a}${b}</span><span class="d" style="background:${info.colors[i] || '#fff'}"></span><span class="w">${name(i, state)}</span>${F.holder === i ? formaIcon() : ''}<b>${held(F.held[i])}</b></div>`;
    }).join('');
  }

  return {
    frame(state, k, dt) {
      const F = state.forma;
      boardAt -= dt;
      const c = mmss(F.left);
      if (c !== clock) {
        clock = c;
        $('.lap b').textContent = c;
        $('.lap').classList.toggle('last', F.left <= 30);
      }
      if (boardAt <= 0) { boardAt = 0.16; paintWhere(F, k, state); paintBoard(F, k, state); }
      const m = held(F.held[k.i]);
      if (m !== mineTxt) { mineTxt = m; $('.fo-mine b').textContent = m; }
      const mine = F.holder === k.i;
      if (mine !== was) { was = mine; e.classList.toggle('hasit', mine); $('.fo-mine').classList.toggle('on', mine); }
      // the last five seconds, over the road
      const n = !F.over && F.left <= 5.0 && state.phase === 'race' ? Math.ceil(F.left) : 0;
      if (n !== cd) { cd = n; $('.fo-count').innerHTML = n ? `<span class="tick">${n}</span>` : ''; }
    },
  };
}

// The results' table: seconds held, as a bar of cheese next to the time.
export function paintFormaResults(C, root, data, thumb, whoHtml) {
  const { t } = C, $ = (s) => root.querySelector(s), lang = C.lang(), rows = data.rows;
  C.text($('.tbar h1'), t('forma.title'));
  C.text($('.sub'), data.trackName);
  for (const [cl, key] of [['.h0', ''], ['.h2', ''], ['.h3', 'forma.held'], ['.h4', 'forma.bestHold'], ['.gaph', 'forma.grabs']]) C.text($(cl), key ? t(key) : '');
  const top = Math.max(1, rows[0]?.forma?.held ?? 1), first = rows[0];
  const wn = $('.ttnew');
  wn.classList.toggle('on', !!first?.forma?.held);
  if (first?.forma?.held) {
    const k = C.karts.find((x) => x.id === first.kart);
    C.text(wn, t('forma.winner', { who: first.human && first.slot >= 0 ? t('res.you', { n: first.slot + 1 }) : k?.driver?.name || first.kart, time: held(first.forma.held) }));
  }
  $('.rows').innerHTML = rows.map((r, n) => {
    const [a, b] = ordinal(lang, r.place), f = r.forma || { held: 0, best: 0, grabs: 0 };
    return `<div class="rt rrow${r.human ? ' me' : ''}" data-p="${r.place}" ${r.human ? `data-seat="${r.slot}"` : ''} style="--dl:${(n * 0.05).toFixed(2)}s">
      <span class="pos">${a}<small>${b}</small></span><span>${thumb(r.kart)}</span><span class="who">${whoHtml(r)}</span>
      <span class="tm">${formatTime(lang, f.held).replace(/[.,]\d+$/, '')}</span><span class="bl">${formatTime(lang, f.best).replace(/[.,]\d+$/, '')}</span><span class="gapv">${f.grabs}</span><i class="fo-bar"><u style="width:${(f.held / top * 100).toFixed(1)}%"></u></i></div>`;
  }).join('');
}

const u = (n) => `calc(var(--u) * ${n})`;

export const FORMA_CSS = `
.rk .lobby .opts .chips[data-key="mode"] { gap: ${u(5)}; }
.rk .lobby .opts .chips[data-key="mode"] .chip { padding: 0 ${u(3)}; font-size: ${u(21)}; }
.rk .hv.forma .tagrow { z-index: 2; }
.rk .hv.forma .banner { top: 27%; }
.rk .hv.forma .toast { top: ${u(132)}; }
.rk .hv.forma .dis { top: ${u(132)}; }
.rk .hv.forma .bannerz:has(.dis) + .toastz .toast { top: ${u(330)}; }
.rk .hv.forma .lap b { min-width: ${u(84)}; text-align: right; }
.rk .hv.forma .lap small { font-size: max(13px, ${u(26)}); }
.rk .hv .fo-where { position: absolute; left: 50%; top: ${u(18)}; transform: translateX(-50%); display: flex; align-items: center; gap: ${u(14)}; max-width: calc(100% - ${u(700)}); min-width: ${u(300)}; padding: ${u(8)} ${u(16)} ${u(8)} ${u(10)}; background: var(--paper); border: ${u(5)} solid var(--ink); border-radius: ${u(26)}; box-shadow: 0 ${u(5)} 0 rgba(29, 31, 43, 0.3); }
.rk .hv .fo-where .fo-i { flex: none; width: ${u(70)}; height: ${u(70)}; }
.rk .hv .fo-where .fo-i svg { display: block; width: 100%; height: 100%; }
.rk .hv .fo-where .fo-tx { display: flex; flex-direction: column; min-width: 0; line-height: 1.06; }
.rk .hv .fo-where b { font-size: max(15px, ${u(38)}); font-weight: 700; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rk .hv .fo-where .fo-tx span { font-size: max(13px, ${u(27)}); font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
.rk .hv .fo-where .fo-arrow { flex: none; width: ${u(62)}; height: ${u(62)}; transition: transform 0.25s; }
.rk .hv .fo-where .fo-arrow svg { display: block; width: 100%; height: 100%; }
.rk .hv .fo-where.back .fo-arrow { transform: rotate(180deg); }
.rk .hv .fo-where.near .fo-arrow, .rk .hv .fo-where.mine .fo-arrow { display: none; }
.rk .hv .fo-where.loose { background: #ffe9a8; animation: rk-fo-pulse 0.8s ease-in-out infinite alternate; }
.rk .hv .fo-where.held { background: var(--cl, var(--paper)); }
.rk .hv .fo-where.mine { background: #ffd23f; }
.rk .hv .fo-where .fo-kg { display: none; height: ${u(14)}; margin-top: ${u(5)}; background: rgba(29, 31, 43, 0.2); border-radius: ${u(8)}; overflow: hidden; }
.rk .hv .fo-where.mine .fo-kg { display: block; }
.rk .hv .fo-where .fo-kg u { display: block; height: 100%; width: 0; background: #d43d2c; border-radius: ${u(8)}; }
@keyframes rk-fo-pulse { from { transform: translateX(-50%) scale(1); } to { transform: translateX(-50%) scale(1.04); } }
.rk .hv .fo-board { position: absolute; left: ${u(26)}; top: ${u(96)}; display: flex; flex-direction: column; gap: ${u(5)}; font-variant-numeric: tabular-nums; }
.rk .hv .fo-row { display: flex; align-items: center; gap: ${u(8)}; height: ${u(44)}; padding: 0 ${u(12)}; background: rgba(255, 246, 230, 0.88); border: ${u(3)} solid var(--ink); border-radius: ${u(14)}; font-size: max(13px, ${u(27)}); font-weight: 600; white-space: nowrap; }
.rk .hv .fo-row.me { background: var(--cl, #fff); font-weight: 700; }
.rk .hv .fo-row.has { background: #ffe066; }
.rk .hv .fo-row .p { min-width: ${u(38)}; font-weight: 700; }
.rk .hv .fo-row .d { width: ${u(20)}; height: ${u(20)}; border-radius: 50%; border: ${u(3)} solid var(--ink); flex: none; }
.rk .hv .fo-row .w { min-width: ${u(70)}; max-width: ${u(150)}; overflow: hidden; text-overflow: ellipsis; }
.rk .hv .fo-row b { margin-left: auto; padding-left: ${u(8)}; font-weight: 700; }
.rk .hv .fo-row svg { width: ${u(30)}; height: ${u(30)}; flex: none; }
.rk .hv .fo-mine { position: absolute; right: ${u(34)}; bottom: ${u(208)}; display: flex; align-items: center; gap: ${u(10)}; color: #fff; }
.rk .hv .fo-mine svg { width: ${u(66)}; height: ${u(66)}; }
.rk .hv .fo-mine b { font-size: ${u(72)}; line-height: 1; font-weight: 700; font-variant-numeric: tabular-nums; -webkit-text-stroke: ${u(11)} var(--ink); paint-order: stroke fill; }
.rk .hv .fo-mine.on b { color: #ffe066; }
.rk .hv .fo-mine.on svg { animation: rk-bob 0.7s ease-in-out infinite; }
.rk .hv.hasit::after { content: ''; position: absolute; inset: 0; pointer-events: none; box-shadow: inset 0 0 ${u(60)} ${u(10)} rgba(255, 196, 40, 0.65); }
.rk .hv .fo-count { position: absolute; left: 0; right: 0; top: 16%; display: flex; justify-content: center; pointer-events: none; }
.rk .hv .fo-count span { font-size: ${u(220)}; line-height: 1; font-weight: 700; color: #ffe066; -webkit-text-stroke: ${u(18)} var(--ink); paint-order: stroke fill; }
.rk .hv .fo-count .tick { animation: rk-tick 0.95s cubic-bezier(0.2, 1.4, 0.4, 1) both; }
.rk .results.forma .ttnew.on { display: block; right: ${u(26)}; top: ${u(50)}; font-size: ${u(34)}; padding: ${u(5)} ${u(20)}; max-width: ${u(520)}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rk .results.forma .rrow { position: relative; }
.rk .results.forma .tcard .rt .ptsh, .rk .results.forma .tcard .rt .ptsv { display: none; }
.rk .results.forma .fo-bar { position: absolute; left: ${u(210)}; right: ${u(12)}; bottom: ${u(5)}; height: ${u(10)}; background: rgba(29, 31, 43, 0.12); border-radius: ${u(6)}; overflow: hidden; }
.rk .results.forma .fo-bar u { display: block; height: 100%; background: #e8a924; border-radius: ${u(7)}; }
`;
