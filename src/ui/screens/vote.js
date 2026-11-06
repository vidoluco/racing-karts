// The track vote: big painted cards, the phones' pins on them, and the coin when the votes differ. In Gran Premio the same cards
// build the list of races, with quick presets beside it.
import { backdrop, clouds, trackArt, helmet, check, coin, die } from './art.js';
import { SEAT_COLORS } from '../style.js';
import { pickLabel, formatTime } from '../../i18n/index.js';
import { WEATHER_CHOICES } from '../../data/weather.js';

const RANDOM = 'random';

export function createVote(C) {
  const { el, t } = C;
  const root = el('section', 'scr vote hide');
  root.innerHTML = `<div class="bg">${backdrop({ road: false, seed: 31 })}${clouds(5, 33)}</div>
  <div class="stage">
    <div class="tbar"><h1 class="ink"></h1><div class="sub pill"></div></div>
    <div class="wxvote"><button type="button" class="chip wxc"></button><button type="button" class="chip moon wxn"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" fill="currentColor"/></svg><span></span></button></div>
    <div class="verdict card hide">${coin()}<b class="ink"></b></div>
    <div class="grid"></div>
    <div class="vbar"></div>
    <div class="gpp card hide"><h3></h3><div class="help"></div><div class="list"></div><div class="presets"></div><button type="button" class="bigbtn green gpgo"><b class="ink"></b></button></div>
  </div>`;
  const $ = (s) => root.querySelector(s);
  const grid = $('.grid'), bar = $('.vbar');
  const cards = new Map();
  let data = null, built = false, info = null;

  function build() {
    built = true;
    for (const tr of [...C.tracks, { id: RANDOM }]) {
      const c = el('button', `tc${tr.id === RANDOM ? ' random' : ''}`);
      c.type = 'button';
      c.dataset.id = tr.id;
      c.innerHTML = `<div class="pic">${trackArt(tr.id)}${tr.id === RANDOM ? die() : `<div class="region"></div>`}</div><div class="tn"></div><div class="tb"></div><div class="pins">${[0, 1, 2, 3].map((s) => `<div class="pin" data-s="${s}">${helmet(SEAT_COLORS[s].main)}${check()}</div>`).join('')}</div><div class="badge hide"></div>`;
      c.addEventListener('click', () => { C.sound('confirm'); C.emit('pickTrack', tr.id); });
      grid.append(c);
      cards.set(tr.id, c);
    }
    info = el('div', 'vinfo');
    info.innerHTML = `${coin()}<div class="ttl"></div><div class="pill vd"></div><div class="pill vl"></div>`;
    grid.append(info);
    $('.gpp').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      C.sound('click');
      if (b.classList.contains('gpgo')) return C.emit('gpGo');
      if (b.dataset.preset) C.emit('gpPreset', b.dataset.preset);
    });
  }

  // the sky can still change here, once you know the road
  $('.wxvote').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    C.sound('click');
    if (b.classList.contains('wxn')) return C.emit('opt', { night: !data?.opts?.night });
    const at = WEATHER_CHOICES.indexOf(data?.opts?.weather ?? 'clear');
    C.emit('opt', { weather: WEATHER_CHOICES[(at + 1) % WEATHER_CHOICES.length] });
  });
  function paintWx() {
    const w = $('.wxvote'), O = data.opts || {};
    w.classList.toggle('hide', data.mode === 'time' || data.vote.phase !== 'open');
    C.text($('.wxc'), `${t('lobby.weather')}: ${t(`lobby.wx.${O.weather ?? 'clear'}`)}`);
    $('.wxc').classList.toggle('on', (O.weather ?? 'clear') !== 'clear');
    C.text($('.wxn span'), t('lobby.wx.night'));
    $('.wxn').classList.toggle('on', !!O.night);
  }

  function paintBar() {
    const seats = data.seats.map((s, i) => ({ ...s, i })).filter((s) => s.present);
    const key = seats.map((s) => s.i).join(',');
    if (bar.dataset.key !== key) {
      bar.dataset.key = key;
      bar.innerHTML = seats.map((s) => `<div class="vp" data-seat="${s.i}">${helmet(SEAT_COLORS[s.i].main)}<div class="vtx"><div class="pn"></div><div class="vn"></div><div class="vs"></div></div></div>`).join('');
    }
    for (const s of seats) {
      const p = bar.querySelector(`.vp[data-seat="${s.i}"]`);
      const k = C.karts.find((x) => x.id === s.kart);
      C.text(p.querySelector('.pn'), t('lobby.seat', { n: s.i + 1 }) + (k ? `, ${k.driver.name}` : ''));
      C.text(p.querySelector('.vn'), s.track ? trackName(s.track) : '...');
      C.text(p.querySelector('.vs'), s.lock ? t('vote.voted') : t('vote.looking'));
      p.classList.toggle('ready', !!s.lock);
    }
  }
  const trackName = (id) => (id === RANDOM ? t('vote.random') : pickLabel(C.lang(), C.tracks.find((x) => x.id === id)?.names) || id);

  function paintGp(gp) {
    root.classList.toggle('gp', gp);
    $('.gpp').classList.toggle('hide', !gp);
    bar.classList.toggle('hide', gp);
    info.classList.toggle('hide', gp);
    if (!gp) return;
    C.text($('.gpp h3'), t('vote.list'));
    C.text($('.gpp .help'), t('vote.gpPhone'));
    const list = data.list || [];
    const L = $('.gpp .list');
    const key = list.join(',') + C.lang();
    if (L.dataset.key !== key) {
      L.dataset.key = key;
      L.innerHTML = list.length ? list.map((id, n) => `<div class="li"><i>${n + 1}</i><span>${trackName(id)}</span></div>`).join('') : `<div class="empty">${t('vote.listEmpty', { n: data.gpMin })}</div>`;
    }
    const P = $('.gpp .presets');
    const pkey = (data.regions || []).join(',') + C.lang();
    if (P.dataset.key !== pkey) {
      P.dataset.key = pkey;
      P.innerHTML = [...(data.regions || []).map((r) => [r, t(`region.${r}`)]), ['all', t('vote.all')], ['random3', t('vote.draw', { n: 3 })], ['clear', t('vote.clear')]].map(([p, label]) => `<button type="button" data-preset="${p}">${label}</button>`).join('');
    }
    // too short a list is filled by a draw, and the button says how many races that makes
    const races = list.length >= data.gpMin && list.length ? list.length : data.gpFill;
    C.text($('.gpgo b'), races === 1 ? t('vote.goOne') : t('vote.go', { n: races }));
  }

  function paint() {
    if (!data) return;
    paintWx();
    const gp = data.mode === 'gp' || data.mode === 'teams';
    C.text($('.tbar h1'), data.mode === 'teams' ? t('vote.teamsTitle') : gp ? t('vote.gpTitle') : t('vote.title'));
    C.text($('.sub'), gp ? t('vote.gpSub') : t('vote.sub'));
    const v = data.vote;
    const deciding = v.phase !== 'open';
    $('.tbar').classList.toggle('hide', deciding && !gp);
    const verdict = $('.verdict');
    verdict.classList.toggle('hide', !deciding);
    verdict.classList.toggle('landed', !!v.landed);
    if (deciding) C.text(verdict.querySelector('b'), v.landed ? t('vote.verdict', { name: trackName(v.pick) }) : t('vote.roll'));
    if (info && data.opts) {
      C.text(info.querySelector('.ttl'), t('vote.tonight'));
      C.text(info.querySelector('.vd'), data.mode === 'time' ? t('lobby.time') : t(`lobby.${data.opts.difficulty}`));
      C.text(info.querySelector('.vl'), data.opts.mode === 'forma' ? t('forma.minutes') : data.opts.laps === 1 ? t('fly.lapsOne') : t('fly.laps', { n: data.opts.laps }));
    }

    for (const [id, c] of cards) {
      // a track not built yet is not on offer at all
      c.classList.toggle('hide', id !== RANDOM && !data.available.includes(id));
      const tr = C.tracks.find((x) => x.id === id);
      C.text(c.querySelector('.tn'), trackName(id));
      const rec = id !== RANDOM && data.records ? data.records[id] : null; // a time trial's cards say what there is to beat, not the blurb
      c.querySelector('.tb').classList.toggle('ttvote', !!data.records && id !== RANDOM);
      C.text(c.querySelector('.tb'), id === RANDOM ? t('vote.randomText') : data.records ? (rec?.mine ? t('tt.voteMine', { time: formatTime(C.lang(), rec.mine) }) : rec?.best ? t('tt.voteBest', { time: formatTime(C.lang(), rec.best) }) : t('tt.voteNone')) : pickLabel(C.lang(), data.blurbs?.[id]) || '');
      if (tr) C.text(c.querySelector('.region'), pickLabel(C.lang(), tr.regionNames) || t(`region.${tr.region}`));
      const looking = [], locked = [];
      data.seats.forEach((s, i) => { if (s.present && s.track === id) (s.lock ? locked : looking).push(i); });
      for (let i = 0; i < 4; i++) {
        c.classList.toggle(`f${i}`, looking.includes(i) || locked.includes(i));
        const pin = c.querySelector(`.pin[data-s="${i}"]`);
        pin.classList.toggle('on', looking.includes(i) || locked.includes(i));
        pin.classList.toggle('done', locked.includes(i));
      }
      c.classList.toggle('dim', deciding && id !== v.spin && id !== v.pick);
      c.classList.toggle('spin', v.phase === 'roll' && !v.landed && id === v.spin);
      c.classList.toggle('picked', !!v.landed && id === v.pick);
      const at = (data.list || []).indexOf(id);
      const badge = c.querySelector('.badge');
      badge.classList.toggle('hide', !(gp && at >= 0));
      c.classList.toggle('inlist', gp && at >= 0);
      if (gp && at >= 0) C.text(badge, String(at + 1));
      if (gp && id === RANDOM) C.text(c.querySelector('.tn'), t('vote.random'));
    }
    paintBar();
    paintGp(gp);
  }

  return {
    el: root,
    enter(d) { data = d; if (!built) build(); paint(); },
    update(d) { data = { ...data, ...d }; paint(); },
    relabel() { paint(); },
  };
}
