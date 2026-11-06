// The race HUD: one sticker layer per view, scaled with the view. Place, lap, the item crate with its roulette, the trail map,
// the wrong way and last lap banners, the countdown and the finish. It is fed the sim's state each frame and writes the DOM only
// when something it shows has changed.
import { crate, flag, phone, ghostIcon } from './art.js';
import { SEAT_COLORS } from '../style.js';
import { ordinal, formatTime, formatDelta, pickLabel } from '../../i18n/index.js';
import { itemInfo, itemName } from '../../data/items.js';
import { createLongMap } from './longmap.js';
import { formaView, formaMark } from './forma.js';
import { teamIcon } from '../icons.js';

const INK = '#1d1f2b';
const K_BY_VIEWS = { 1: 1, 2: 0.82, 3: 0.64, 4: 0.64 };
const ROULETTE = 1.2;

// [x, y, w, h] of a view in 0..1 of the screen, y from the top. The renderer's layout is the same with y from the bottom.
export function viewRect(q, n) {
  if (n <= 1) return [0, 0, 1, 1];
  if (n === 2) return [q * 0.5, 0, 0.5, 1];
  return [(q % 2) * 0.5, q < 2 ? 0 : 0.5, 0.5, 0.5];
}

const DIS_COLOR = { debris: '#f6c23e', avalanche: '#9ad4f6', lahar: '#f6b35e', banjir: '#8ad4f2', rockfall: '#f6c23e', quake: '#ffa97a', eruption: '#ff8f6a', cloud: '#d6c6e6' };
const dangerSign = () => `<svg viewBox="0 0 100 100"><path d="M50 8 L94 88 L6 88 Z" fill="#fff8e6" stroke="#d43d2c" stroke-width="10" stroke-linejoin="round"/><path d="M50 34 L50 62" stroke="${INK}" stroke-width="10" stroke-linecap="round"/><circle cx="50" cy="75" r="6" fill="${INK}"/></svg>`;
const arrowSign = (lane) => `<svg viewBox="0 0 100 100"><g transform="rotate(${lane > 0 ? -90 : lane < 0 ? 90 : 0} 50 50)"><path d="M50 10 L88 54 L66 54 L66 90 L34 90 L34 54 L12 54 Z" fill="#fff" stroke="${INK}" stroke-width="9" stroke-linejoin="round"/></g></svg>`;

// The trail map: the route painted once to an offscreen canvas, the dots over it.
function createMap(track, canvas, size) {
  // a long track's map follows the kart instead of showing the whole route
  if (track.long) return createLongMap(track, canvas, size);
  const S = track.samples, n = track.n;
  let ax = 1e9, az = 1e9, bx = -1e9, bz = -1e9;
  for (let i = 0; i < n; i += 4) { ax = Math.min(ax, S.x[i]); bx = Math.max(bx, S.x[i]); az = Math.min(az, S.z[i]); bz = Math.max(bz, S.z[i]); }
  const pad = size * 0.11, span = Math.max(bx - ax, bz - az) || 1, sc = (size - pad * 2) / span;
  const cx = (ax + bx) / 2, cz = (az + bz) / 2;
  // +z is drawn up, and x stays on the right-hand side, so the map reads the way the road turns from above
  const fitX = (x) => size / 2 - (x - cx) * sc, fitY = (z) => size / 2 - (z - cz) * sc;
  canvas.width = size; canvas.height = size;
  const g = canvas.getContext('2d');
  const trace = (ctx, step, X, Y, from = 0, to = n) => {
    ctx.beginPath();
    for (let i = from; i <= to; i += step) { const k = ((i % n) + n) % n; if (i === from) ctx.moveTo(X(S.x[k]), Y(S.z[k])); else ctx.lineTo(X(S.x[k]), Y(S.z[k])); }
  };
  const stroke = (ctx, w, c) => { ctx.lineWidth = w; ctx.strokeStyle = c; ctx.stroke(); };
  const base = document.createElement('canvas');
  base.width = size; base.height = size;
  const b = base.getContext('2d');
  b.lineCap = 'round'; b.lineJoin = 'round';
  trace(b, 3, fitX, fitY); b.closePath();
  stroke(b, size * 0.082, INK);
  stroke(b, size * 0.05, '#fff6e6');
  // the bands of crates as small gold marks, so a glance says where the next one is
  for (const bd of track.bands || []) {
    const k = bd.i ?? Math.round(bd.u * n);
    b.beginPath(); b.arc(fitX(S.x[k]), fitY(S.z[k]), size * 0.016, 0, 7); b.fillStyle = '#e8a924'; b.fill();
  }
  const tx = S.tx[0], tz = S.tz[0], nx = -tz * sc, nz = tx * sc, ex = fitX(S.x[0]), ey = fitY(S.z[0]), m0 = 5.6 / sc;
  b.beginPath(); b.moveTo(ex + nx * m0, ey - nz * m0); b.lineTo(ex - nx * m0, ey + nz * m0);
  stroke(b, size * 0.03, INK); b.setLineDash([size * 0.018, size * 0.018]); stroke(b, size * 0.02, '#fff');
  return {
    draw(state, me, colors) {
      g.clearRect(0, 0, size, size);
      const X = fitX, Y = fitY;
      g.drawImage(base, 0, 0);
      for (const s of state.shots || []) {
        if (s.kind !== 'razzo') continue;
        g.beginPath(); g.arc(X(s.x), Y(s.z), size * 0.02, 0, 7); g.fillStyle = '#e0483d'; g.fill(); g.lineWidth = size * 0.008; g.strokeStyle = INK; g.stroke();
      }
      for (const D of state.disasters || []) {
        if (D.free || D.phase === 'after') continue;
        const X0 = X(D.x), Y0 = Y(D.z), r = size * 0.05 * (1 + 0.18 * Math.sin(state.t * 9));
        g.beginPath(); g.moveTo(X0, Y0 - r); g.lineTo(X0 + r, Y0 + r * 0.8); g.lineTo(X0 - r, Y0 + r * 0.8); g.closePath();
        g.fillStyle = '#ffd23f'; g.fill(); g.lineWidth = size * 0.012; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke();
      }
      const K = state.karts;
      const dot = (k, r, ring) => {
        g.beginPath(); g.arc(X(k.x), Y(k.z), r, 0, 7);
        g.fillStyle = colors[k.i] || '#fff'; g.fill();
        g.lineWidth = ring; g.strokeStyle = INK; g.stroke();
      };
      for (const k of K) if (k.i !== me && !k.human) dot(k, size * 0.024, size * 0.009);
      for (const k of K) if (k.i !== me && k.human) dot(k, size * 0.034, size * 0.011);
      const m = K[me];
      if (state.forma) formaMark(g, X(state.forma.wheel.x), Y(state.forma.wheel.z), size, state.t);
      if (m) {
        g.beginPath(); g.arc(X(m.x), Y(m.z), size * 0.06, 0, 7); g.fillStyle = 'rgba(255,255,255,0.75)'; g.fill();
        dot(m, size * 0.042, size * 0.014);
      }
    },
  };
}

export function createHud(C) {
  const { el, t } = C;
  const root = el('section', 'scr hudscr hide');
  const viewsEl = el('div', 'views');
  const flyEl = el('div', 'flywrap');
  const pauseBtn = el('button', 'pausebtn');
  pauseBtn.type = 'button';
  pauseBtn.innerHTML = C.pauseIcon();
  pauseBtn.addEventListener('click', () => C.emit('pause'));
  root.append(viewsEl, flyEl, pauseBtn);
  let V = [], info = null, showDetails = true;
  let roulettePool = [], time = 0, mapAt = 0;

  // ---------- views ----------
  function mkView(q, n, v) {
    const [x, y, w, h] = viewRect(q, n);
    const e = el('div', info.tt ? 'hv tt' : 'hv');
    e.style.cssText = `left:${x * 100}%;top:${y * 100}%;width:${w * 100}%;height:${h * 100}%;--k:${K_BY_VIEWS[n] || 1}`;
    e.dataset.seat = v.slot >= 0 ? v.slot : 0;
    e.innerHTML = `<div class="boostv"></div><div class="tagrow"><div class="ptag"></div><div class="lap"><small></small><b></b></div></div>
      <div class="map"><canvas></canvas></div>
      <div class="crate">${crate()}<div class="icn"></div><div class="pips"></div></div>
      <div class="inm hide"></div>
      <div class="iaim hide"><svg viewBox="0 0 20 20" fill="none" stroke="#1d1f2b" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 13 L10 6 L16 13"/></svg><span></span></div>
      <div class="plc"><span class="n"></span><span class="sfx"></span></div>
      <div class="wrong hide"></div>
      <div class="bannerz"></div><div class="toastz"></div>
      <div class="cdn"></div>
      <div class="fin card hide">${flag()}<div class="pl"><span class="n"></span><span class="sfx"></span></div><div><b></b><span></span></div></div>
      <div class="miss card hide">${phone()}<div><b></b><span></span></div></div>`;
    // against the clock the place and the crate have nothing to say: the same corners hold the clock and the laps
    if (info.tt) e.insertAdjacentHTML('beforeend', `<div class="ttref">${ghostIcon()}<span></span></div><div class="ttclock"><b></b></div><div class="ttlaps"></div><div class="ttsplit hide"><small></small><b></b><i class="ttdelta"></i></div>`);
    // two sides: what each would have if the race ended now, right under the player's tag
    if (info.teams) e.insertAdjacentHTML('beforeend', `<div class="tscore"><div class="ts" data-team="a">${teamIcon('a')}<b></b></div><div class="ts" data-team="b"><b></b>${teamIcon('b')}</div></div>`);
    const $ = (s) => e.querySelector(s);
    const mapSize = Math.round(250 * (K_BY_VIEWS[n] || 1) * Math.min(innerWidth / 1920, innerHeight / 1080) * Math.min(devicePixelRatio || 1, 2));
    const o = {
      e, $, kart: v.kart, slot: v.slot, q,
      // no crates on the road, no crate marks on the map
      map: createMap(info.tt ? Object.create(info.track, { bands: { value: [] } }) : info.track, $('.map canvas'), Math.max(120, mapSize)),
      last: { place: 0, lap: 0, item: undefined, charges: -1, wrong: false, spinning: false, boost: false, fin: false, cd: null, name: null },
      nextWarnAt: 0, lastIcon: null,
      forma: null,
    };
    C.text($('.ptag'), v.slot >= 0 ? t('res.you', { n: v.slot + 1 }) : '');
    $('.ptag').classList.toggle('hide', v.slot < 0);
    C.text($('.lap small'), t('hud.lap'));
    return o;
  }

  function setup(d) {
    info = d;
    viewsEl.innerHTML = '';
    flyEl.innerHTML = '';
    const n = d.views.length;
    V = d.views.map((v, q) => mkView(q, n, v));
    for (const o of V) viewsEl.append(o.e);
    if (n === 3) {
      const [x, y, w, h] = viewRect(3, 4);
      const e = el('div', 'hv');
      e.style.cssText = `left:${x * 100}%;top:${y * 100}%;width:${w * 100}%;height:${h * 100}%;--k:${K_BY_VIEWS[3]}`;
      e.innerHTML = `<div class="ovlab pill">${t('hud.overview')}</div>`;
      viewsEl.append(e);
    }
    showDetails = true;
    roulettePool = (C.itemIds || []).slice();
  }

  // ---------- fly over title ----------
  function flyover(on) {
    flyEl.innerHTML = '';
    viewsEl.style.visibility = on ? 'hidden' : '';
    if (!on) return;
    const d = info;
    const pills = [`<div class="pill">${d.regionName}</div>`, `<div class="pill">${d.laps === 1 ? t('fly.lapsOne') : t('fly.laps', { n: d.laps })}</div>`];
    if (d.gp) pills.push(`<div class="pill">${t(d.teams ? 'fly.teams' : 'fly.gp', { n: d.gp.n, of: d.gp.of })}</div>`);
    if (d.tt) pills.push(`<div class="pill">${t('tt.fly')}</div>`);
    if (d.weather?.kind && d.weather.kind !== 'clear') pills.push(`<div class="pill wxp">${t(`fly.wx.${d.weather.kind}`)}</div>`);
    if (d.weather?.night) pills.push(`<div class="pill wxp">${t('fly.wx.night')}</div>`);
    if (d.forma) { pills.splice(1, 1, `<div class="pill">${t('forma.title')}</div>`, `<div class="pill">${t('forma.fly')}</div>`); }
    flyEl.innerHTML = `<div class="fly"><h1 class="ink">${d.trackName}</h1><div class="row">${pills.join('')}</div>${d.blurb ? `<div class="bl card">${d.blurb}</div>` : ''}</div><div class="skip pill">${t('fly.skip')}</div>`;
  }

  // ---------- item face ----------
  function iconHtml(id) {
    const svg = C.icon?.(id);
    if (svg) return svg;
    return `<div class="tx">${itemName(id, C.lang(), info?.region)}</div>`;
  }
  function paintItem(o, k, dt) {
    const crateEl = o.$('.crate'), icn = o.$('.icn'), last = o.last;
    const spinning = k.rouletteT > 0;
    if (spinning) {
      // fast, then slowing onto the item: the same rhythm as the phone's
      const elapsed = ROULETTE - k.rouletteT;
      const step = Math.floor(14 * (1 - (1 - Math.min(1, elapsed / ROULETTE)) ** 2.4));
      if (o.rstep !== step && roulettePool.length) {
        o.rstep = step;
        icn.innerHTML = iconHtml(roulettePool[(step * 3 + o.q) % roulettePool.length]);
      }
    }
    if (spinning !== last.spinning) {
      crateEl.classList.toggle('spin', spinning);
      last.spinning = spinning;
      if (spinning) { o.$('.inm').classList.add('hide'); o.$('.iaim').classList.add('hide'); o.$('.pips').innerHTML = ''; }
      if (!spinning) {
        o.rstep = null;
        last.item = undefined;
        crateEl.classList.remove('landed'); void crateEl.offsetWidth; crateEl.classList.add('landed');
      }
    }
    if (!spinning && (k.item !== last.item || k.itemCharges !== last.charges)) {
      const changed = k.item !== last.item;
      last.item = k.item; last.charges = k.itemCharges;
      if (changed) icn.innerHTML = k.item ? iconHtml(k.item) : '';
      crateEl.classList.toggle('holding', !!k.item);
      const nameEl = o.$('.inm');
      nameEl.classList.toggle('hide', !k.item);
      if (k.item && changed) { C.text(nameEl, itemName(k.item, C.lang(), info?.region)); }
      // an item that drops behind unless the stick is up: said next to the crate, where the eyes are
      const aimEl = o.$('.iaim');
      aimEl.classList.toggle('hide', !itemInfo(k.item)?.aim);
      if (itemInfo(k.item)?.aim) aimEl.querySelector('span').textContent = t('hud.aimUp');
      const pips = k.item && k.itemCharges > 1 ? k.itemCharges : 0;
      o.$('.pips').innerHTML = '<i></i>'.repeat(Math.min(5, pips));
    }
  }

  function toast(o, text, cls, ttl = 2200) {
    const box = o.$('.toastz');
    box.innerHTML = '';
    const d = el('div', `toast ${cls || ''}`);
    d.textContent = text;
    box.append(d);
    setTimeout(() => d.remove(), ttl);
  }

  // The local name in big type on a road sign, what it is in the player's language, and which way the free lane is.
  function disasterBanner(o, e) {
    const box = o.$('.bannerz');
    box.querySelector('.dis')?.remove();
    const d = el('div', 'dis');
    const ttl = Math.max(4.6, (e.warn ?? 3) + 2.2);
    d.style.setProperty('--dis', DIS_COLOR[e.kind] || '#f6c23e');
    d.style.setProperty('--dis-t', `${ttl}s`);
    const lane = e.lane, say = pickLabel(C.lang(), e.say) || t(`dis.${e.kind}`), way = lane === null || lane === undefined ? '' : t(lane > 0 ? 'dis.left' : lane < 0 ? 'dis.right' : 'dis.centre');
    d.innerHTML = `<div class="pic">${dangerSign()}</div><div class="tx"><b></b><span></span></div>${lane === null || lane === undefined ? '' : `<div class="arrow" style="--dx:${lane > 0 ? -1 : lane < 0 ? 1 : 0};--dy:${lane ? 0 : -1}">${arrowSign(lane)}</div>`}`;
    C.text(d.querySelector('b'), e.name);
    C.text(d.querySelector('span'), way ? `${say} ${way}` : say);
    box.append(d);
    // In split views the banner is as wide as the screen's top: it moves over, and shrinks if it must, to leave the map alone.
    const map = o.$('.map'), room = map ? map.offsetLeft - 8 : 0, all = d.parentElement.offsetWidth;
    if (room > 0 && (all + d.offsetWidth) / 2 > room) {
      const u0 = getComputedStyle(d).getPropertyValue('--u');
      let k = 1;
      // the small line has a floor in pixels, so it does not shrink in proportion: measure again until it fits
      for (let i = 0; i < 4 && d.offsetWidth > room - 16; i++) { k *= (room - 16) / d.offsetWidth; d.style.setProperty('--u', `calc(${u0} * ${k.toFixed(3)})`); }
      d.style.left = `${Math.max(8 + d.offsetWidth / 2, room - d.offsetWidth / 2)}px`;
    }
    setTimeout(() => d.remove(), ttl * 1000);
  }

  // ---------- against the clock ----------
  const deltaClass = (d) => (d < 0 ? 'ttdelta ahead' : 'ttdelta behind');
  function paintTrial(o, state, k) {
    const v = info.tt.view(o.kart);
    if (!v) return;
    const lang = C.lang(), clock = formatTime(lang, k.finished ? k.finishT : v.lapT);
    if (clock !== o.ttClock) { o.ttClock = clock; o.$('.ttclock b').textContent = clock; }
    if (v.best !== o.ttBest || !o.ttRefOn) {
      o.ttBest = v.best; o.ttRefOn = true;
      C.text(o.$('.ttref span'), v.best === null ? t('tt.noRecord') : t('tt.record', { time: formatTime(lang, v.best) }));
    }
    if (v.laps.length !== o.ttLaps) {
      o.ttLaps = v.laps.length;
      // the last four are enough on a split view's corner: five laps never hide the road
      o.$('.ttlaps').innerHTML = v.laps.slice(-4).map((l) => `<div class="${l.record ? 'rec' : ''}"><span>${l.n}</span><span>${formatTime(lang, l.time)}</span><span class="${l.delta === null ? '' : deltaClass(l.delta)}">${formatDelta(lang, l.delta)}</span></div>`).join('');
    }
  }
  function showSplit(o, label, time, delta) {
    const box = o.$('.ttsplit');
    C.text(box.querySelector('small'), label);
    box.querySelector('b').textContent = formatTime(C.lang(), time);
    const i = box.querySelector('i');
    i.textContent = formatDelta(C.lang(), delta);
    i.className = delta === null || delta === undefined ? 'ttdelta' : deltaClass(delta);
    box.classList.remove('hide', 'pop'); void box.offsetWidth; box.classList.add('pop');
    clearTimeout(o.ttSplitT);
    o.ttSplitT = setTimeout(() => box.classList.add('hide'), 3200);
  }
  function trialBanner(o, text) {
    const b = el('div', 'banner');
    b.textContent = text;
    o.$('.bannerz').append(b);
    setTimeout(() => b.remove(), 2700);
  }

  function paintTeams(o, k, score) {
    if (o.teamMine !== k.team) {
      o.teamMine = k.team;
      for (const s of o.e.querySelectorAll('.ts')) s.classList.toggle('mine', s.dataset.team === k.team);
    }
    for (const id of ['a', 'b']) {
      if (o.teamShown?.[id] === score[id]) continue;
      const box = o.e.querySelector(`.ts[data-team="${id}"]`);
      box.querySelector('b').textContent = score[id];
      if (o.teamShown) { box.classList.remove('bump'); void box.offsetWidth; box.classList.add('bump'); }
    }
    o.teamShown = score;
  }

  function frame(state, dt) {
    time += dt;
    if (!V.length) return;
    const karts = state.karts;
    const score = info.teams ? info.teams.score(karts, info.teams.base) : null;
    for (const o of V) {
      const k = karts[o.kart], last = o.last;
      if (!k) continue;
      if (info.tt) paintTrial(o, state, k);
      if (info.forma) (o.forma ||= formaView(o, C, info)).frame(state, k, dt);
      // the hunt's place is its place in the table of seconds held, not on the road
      const place = info.forma ? state.forma.rank[k.i] : k.place;
      if (score) paintTeams(o, k, score);
      if (place !== last.place) {
        const plc = o.$('.plc');
        const [n, s] = ordinal(C.lang(), place);
        o.$('.plc .n').textContent = n;
        const sfx = o.$('.plc .sfx');
        sfx.textContent = s;
        sfx.classList.toggle('deg', s === '°');
        plc.dataset.p = place;
        if (last.place) { plc.classList.remove('bump'); void plc.offsetWidth; plc.classList.add('bump'); }
        last.place = place;
      }
      // a long track's one lap: the kilometres to the flag, not "1/1"
      const toGo = info.track.long && state.laps === 1 && !k.finished ? Math.max(0, Math.ceil((1 - Math.max(0, k.progress)) * info.track.length / 100) / 10) : null;
      if (toGo !== null && toGo !== last.toGo) {
        last.toGo = toGo;
        if (!last.kmOn) { last.kmOn = true; C.text(o.$('.lap small'), t('hud.toGo')); }
        o.$('.lap b').textContent = `${toGo.toFixed(1)} km`;
        const le = o.$('.lap'), final = toGo <= 1;
        if (final && !le.classList.contains('last')) { le.classList.add('last'); le.classList.remove('pulse'); void le.offsetWidth; le.classList.add('pulse'); }
      }
      const lap = Math.min(state.laps, k.lap + 1);
      if (!info.forma && toGo === null && !last.kmOn && lap !== last.lap) {
        o.$('.lap b').textContent = `${lap}/${state.laps}`;
        const le = o.$('.lap');
        le.classList.toggle('last', lap === state.laps);
        if (last.lap) { le.classList.remove('pulse'); void le.offsetWidth; le.classList.add('pulse'); }
        last.lap = lap;
      }
      paintItem(o, k, dt);
      const wrong = !!k.wrongWay && !k.finished && state.phase === 'race' && !(info.forma && state.forma.gaps[k.i] <= 0);
      if (wrong !== last.wrong) { const w = o.$('.wrong'); w.classList.toggle('hide', !wrong); if (wrong) C.text(w, t('hud.wrong')); last.wrong = wrong; }
      const boost = k.boostT > 0;
      if (boost !== last.boost) { o.e.classList.toggle('boost', boost); last.boost = boost; }
      // countdown
      let cd = null;
      if (state.phase === 'countdown') cd = Math.max(1, Math.ceil(state.countdown));
      if (cd !== last.cd) {
        last.cd = cd;
        const box = o.$('.cdn');
        if (cd !== null) box.innerHTML = `<span class="n tick">${cd}</span>`;
        else if (state.phase === 'race' && state.t - (info.goT ?? 0) < 1.2) {
          box.innerHTML = `<span class="n go tick">${t('hud.go')}</span>`;
          last.goOn = true;
        } else box.innerHTML = '';
      }
      // on the sim's clock, not the wall's: a paused race keeps its "Go!"
      if (last.goOn && state.t - (info.goT ?? 0) >= 1.1) { last.goOn = false; o.$('.cdn').innerHTML = ''; }
      // finished
      if (k.finished && !last.fin) {
        last.fin = true;
        const f = o.$('.fin');
        f.classList.remove('hide');
        const [n, s] = ordinal(C.lang(), k.place);
        o.$('.fin .pl .n').textContent = n;
        const sfx = o.$('.fin .pl .sfx');
        sfx.textContent = s;
        sfx.classList.toggle('deg', s === '°');
        o.$('.fin b').textContent = t(info.forma ? 'forma.over' : 'hud.finish');
        o.$('.fin div span:not(.n):not(.sfx)').textContent = info.forma ? t('forma.podHeld', { time: formatTime(C.lang(), state.forma.held[k.i]).replace(/[.,]\d+$/, '') }) : formatTime(C.lang(), k.finishT);
        o.$('.plc').classList.add('hide');
        o.$('.crate').classList.add('hide');
        o.$('.inm').classList.add('hide');
        o.$('.iaim').classList.add('hide');
      }
    }
    // maps at 20 Hz, one view after the other
    mapAt += dt;
    if (mapAt >= 0.05 / Math.max(1, V.length) || V.length === 1) {
      mapAt = 0;
      const o = V[(o0 = (o0 + 1) % V.length)];
      // the ghost is one more dot on the map, a pale one, for its own driver alone
      const ghost = info.tt && o ? info.tt.poses(1).find((p) => p.owner === o.kart && p.visible) : null;
      if (ghost) o.map.draw({ ...state, karts: [...state.karts, { i: state.karts.length, human: false, x: ghost.x, z: ghost.z, progress: state.karts[o.kart].progress }] }, o.kart, [...info.colors, '#e6f4ff']);
      else o?.map.draw(state, o.kart, info.colors);
    }
  }
  let o0 = 0;

  const nameOf = (i, state) => { const k = state.karts[i]; return k.human ? t('res.you', { n: k.slot + 1 }) : C.kartDriver(k.kart); };

  // What the sim said this frame, in words on the view it concerns.
  function events(evts, state) {
    for (const e of evts) {
      switch (e.type) {
        case 'formaGrab':
          for (const o of V) {
            if (o.kart === e.kart) trialBanner(o, t('forma.grabbed'));
            else toast(o, t('forma.other', { who: nameOf(e.kart, state) }), '', 1500);
          }
          break;
        case 'formaDrop':
          for (const o of V) if (o.kart === e.kart) trialBanner(o, t('forma.lost'));
          break;
        case 'formaFetch':
          for (const o of V) if (o.kart === e.kart) toast(o, t('forma.fetch'), 'warn', 2200);
          break;
        case 'formaLast':
          for (const o of V) trialBanner(o, t('forma.last'));
          break;
        case 'ttSplit':
          for (const o of V) if (o.kart === e.kart) showSplit(o, t('tt.sector', { n: e.n, of: e.of }), e.time, e.delta);
          break;
        case 'ttLap':
          for (const o of V) if (o.kart === e.kart) {
            showSplit(o, t('tt.lap', { n: e.n }), e.time, e.delta);
            if (e.record) trialBanner(o, t(e.first ? 'tt.firstTime' : 'tt.newRecord'));
          }
          break;
        case 'ttFinish':
          for (const o of V) if (o.kart === e.kart && e.record && !e.lapRecord) trialBanner(o, t('tt.totalRecord'));
          break;
        case 'bite':
          for (const o of V) if (o.kart === e.kart) toast(o, t('hud.bit'), 'good', 1100);
          break;
        case 'lastLap':
          for (const o of V) if (o.kart === e.kart) {
            const b = el('div', 'banner');
            b.textContent = t(info.track.long && state.laps === 1 ? 'hud.lastKm' : 'hud.lastLap');
            o.$('.bannerz').append(b);
            setTimeout(() => b.remove(), 2700);
          }
          break;
        case 'hit':
          for (const o of V) if (o.kart === e.kart) {
            const by = state.karts[e.by];
            const who = by ? (by.human ? t('res.you', { n: by.slot + 1 }) : C.kartDriver(by.kart)) : null;
            let text = null;
            if (e.kind === 'steal') text = t('hit.steal', { who: who || t(`near.${e.cause}`) });
            else if (e.cause === 'bite') text = t('hit.bite');
            else if (e.kind === 'slide') text = t('hit.slide');
            else if (e.kind === 'stink') text = t('hit.stink');
            else if (itemInfo(e.cause)) {
              const item = itemName(e.cause, C.lang(), info?.region);
              text = who ? t('hud.byKart', { item, who }) : t('hud.byItem', { item });
            }
            else if (state.disasters) {
              const D = state.disasters.find((q) => q.kind === e.cause);
              if (D) text = D.name;
            }
            if (text) toast(o, text, 'hit');
          }
          break;
        case 'disaster':
          if (e.phase === 'warn') for (const o of V) disasterBanner(o, e);
          break;
        case 'hazardNear':
          for (const o of V) if (o.kart === e.kart && time >= o.nextWarnAt) {
            o.nextWarnAt = time + 7;
            toast(o, t(`near.${e.kind}`), 'warn');
          }
          break;
        default: break;
      }
    }
  }

  function setMissing(slot, kind) {
    for (const o of V) if (o.slot === slot) {
      const m = o.$('.miss');
      m.classList.toggle('hide', !kind);
      if (kind) {
        C.text(o.$('.miss b'), t('hud.missing'));
        C.text(o.$('.miss div span'), t(kind === 'bot' ? 'hud.takeover' : 'hud.missingText', { n: slot + 1 }));
      }
    }
  }

  return { el: root, setup, flyover, frame, events, setMissing, enter() {}, relabel() {} };
}
