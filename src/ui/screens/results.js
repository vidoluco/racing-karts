// Results over the live track, the podium in its own little world, the loading card and the pause menu.
import { backdrop, clouds, trackArt, wheelIcon, ghostIcon } from './art.js';
import { ordinal, formatTime, formatGap, formatDelta, pickLabel } from '../../i18n/index.js';
import { teamIcon } from '../icons.js';
import { paintFormaResults } from './forma.js';
import { teamInfo, teamName } from '../../data/teams.js';

const posHtml = (lang, n) => { const [a, b] = ordinal(lang, n); return `${a}<small>${b}</small>`; };

export function createLoading(C) {
  const { el, t } = C;
  const root = el('section', 'scr loadscr hide');
  root.innerHTML = `<div class="bg"></div><div class="stage"><div class="lc card pop"><div class="rg pill"></div><h1 class="ink"></h1><p></p><div class="road"><div class="fill"></div>${wheelIcon()}</div><div class="tip"></div></div></div>`;
  const $ = (s) => root.querySelector(s);
  let tipAt = 0, tipN = Math.floor(Math.random() * 6), artKey = '';
  const tips = () => t(`load.tip${(tipN % 6) + 1}`);
  return {
    el: root,
    enter(d) {
      if (artKey !== d.track) { artKey = d.track; $('.bg').innerHTML = trackArt(d.track); }
      C.text($('.rg'), d.regionName || '');
      C.text($('h1'), d.trackName || t('load.title'));
      C.text($('p'), d.blurb || t('load.title'));
      C.text($('.tip'), tips());
      this.progress(0);
    },
    progress(v) {
      const p = Math.round(Math.max(0, Math.min(1, v)) * 100);
      $('.fill').style.width = `${p}%`;
      $('.wheel').style.left = `${p}%`;
    },
    tick(dt) {
      tipAt += dt;
      if (tipAt > 5) { tipAt = 0; tipN++; C.text($('.tip'), tips()); }
    },
    relabel() {},
  };
}

export function createPause(C) {
  const { el, t } = C;
  const root = el('section', 'scr pausescr hide');
  root.innerHTML = `<div class="stage"><div class="pc card pop"><h1 class="ink"></h1><button type="button" class="bigbtn green" data-a="resume"><b class="ink"></b></button><button type="button" class="bigbtn" data-a="restart"><b></b></button><button type="button" class="bigbtn" data-a="quit"><b></b></button><div class="hint"></div></div></div>`;
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    C.sound('click');
    C.emit('pauseAction', b.dataset.a);
  });
  const paint = () => {
    C.text(root.querySelector('h1'), t('pause.title'));
    C.text(root.querySelector('[data-a="resume"] b'), t('pause.resume'));
    C.text(root.querySelector('[data-a="restart"] b'), t('pause.restart'));
    C.text(root.querySelector('[data-a="quit"] b'), t('pause.quit'));
    C.text(root.querySelector('.hint'), t('pause.hint'));
  };
  return { el: root, enter: paint, relabel: paint };
}

export function createResults(C) {
  const { el, t } = C;
  const root = el('section', 'scr results hide');
  root.innerHTML = `<div class="stage">
    <div class="tbar"><h1 class="ink"></h1><div class="sub pill"></div></div>
    <div class="ttnew"></div>
    <div class="tcard card"><div class="rt rhead"><span class="h0"></span><span></span><span class="h2"></span><span class="h3"></span><span class="h4"></span><span class="gaph"></span><span class="ptsh"></span></div><div class="rows" style="display:contents"></div></div>
    <div class="gcard card"><h3></h3><div class="grows" style="display:contents"></div></div>
    <div class="rfoot"></div>
  </div>`;
  const $ = (s) => root.querySelector(s);
  let data = null, lastCount = null;
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    C.sound('confirm');
    C.emit('next', b.dataset.a);
  });

  function whoHtml(r) {
    const k = C.karts.find((x) => x.id === r.kart);
    const tag = r.slot >= 0 && r.human ? `<i>${t('res.you', { n: r.slot + 1 })}</i>` : '';
    return `${tag}<b>${k?.driver?.name || r.kart}</b><small>${k?.name || ''}</small>`;
  }
  const thumb = (id) => { const u = C.thumb(id); return u ? `<img class="th" src="${u}" alt="">` : ''; };

  // A time trial: each driver's total, best lap and how it stands to the record, their laps in a row below; beside it the track's
  // records by kart, the same card a Gran Premio uses for its table.
  function paintTrial() {
    const lang = C.lang(), { rows, tt } = data;
    const delta = (d) => (Number.isFinite(d) ? `<i class="ttdelta ${d < 0 ? 'ahead' : 'behind'}">${formatDelta(lang, d)}</i>` : '');
    C.text($('.tbar h1'), t('tt.title'));
    C.text($('.sub'), data.trackName);
    C.text($('.h3'), t('res.time')); C.text($('.h4'), t('res.best')); C.text($('.gaph'), t('tt.vs'));
    const news = rows.some((r) => r.tt?.record) ? (rows.some((r) => r.tt?.record && !r.tt.first) ? 'tt.newRecord' : 'tt.firstTime') : rows.some((r) => r.tt?.totalRecord) ? 'tt.totalRecord' : null;
    $('.ttnew').classList.toggle('on', !!news);
    if (news) C.text($('.ttnew'), t(news));
    $('.rows').innerHTML = rows.map((r, n) => `<div class="rt rrow head2 me" data-seat="${r.slot}" style="--dl:${(n * 0.05).toFixed(2)}s">
        <span class="pos"></span><span>${thumb(r.kart)}</span><span class="who">${whoHtml(r)}</span>
        <span class="tm">${Number.isFinite(r.time) ? formatTime(lang, r.time) : t('res.noTime')}</span>
        <span class="bl">${Number.isFinite(r.bestLap) ? formatTime(lang, r.bestLap) : ''}</span><span class="gapv">${delta(r.tt?.delta)}</span></div>
      <div class="ttrun">${(r.tt?.laps || []).map((l, q) => `<div class="${l.record ? 'rec' : ''}" style="--dl:${(0.1 + q * 0.06).toFixed(2)}s"><small>${t('tt.lap', { n: l.n })}</small><b>${formatTime(lang, l.time)}</b>${delta(l.delta)}</div>`).join('')}</div>`).join('')
      + (rows.length === 1 && Number.isFinite(rows[0].tt?.best) ? `<div class="tthint">${ghostIcon()}<span>${t('tt.hint', { time: formatTime(lang, rows[0].tt.best) })}</span></div>` : '');
    root.classList.toggle('solo', rows.length === 1);
    C.text($('.gcard h3'), t('tt.table'));
    const mine = new Map(rows.map((r) => [r.kart, r.slot]));
    $('.grows').innerHTML = tt.table.slice(0, 9).map((e, n) => {
      const k = C.karts.find((x) => x.id === e.kart), seat = mine.get(e.kart);
      return `<div class="rt rrow${seat === undefined ? '' : ' me'}" data-p="${n + 1}" ${seat === undefined ? '' : `data-seat="${seat}"`} style="--dl:${(0.1 + n * 0.05).toFixed(2)}s">
        <span class="pos">${posHtml(lang, n + 1)}</span><span>${thumb(e.kart)}</span><span class="who"><b>${k?.driver?.name || e.kart}</b></span><span class="tm">${formatTime(lang, e.lap)}</span></div>`;
    }).join('');
    const btn = (a, cls, title, sub) => `<button type="button" class="bigbtn ${cls}" data-a="${a}"><b class="${cls.includes('green') ? 'ink' : ''}">${title}</b><span>${sub}</span></button>`;
    $('.rfoot').innerHTML = btn('rematch', 'green', t('res.rematch'), t('res.rematchSub')) + btn('track', '', t('res.track'), t('res.trackSub')) + btn('lobby', 'soft', t('res.lobby'), t('res.lobbySub'));
  }

  function paint() {
    if (!data) return;
    const lang = C.lang();
    root.classList.toggle('tt', !!data.tt);
    root.classList.toggle('forma', !!data.forma);
    root.classList.toggle('withgp', !!data.gp || !!data.tt);
    if (data.tt) { paintTrial(); return; }
    if (data.forma) { paintFormaResults(C, root, data, thumb, whoHtml); paintButtons(); return; }
    const sides = data.gp?.teams;
    root.classList.toggle('teams', !!sides);
    C.text($('.tbar h1'), sides ? (data.gp.finished ? t('res.teamsFinal') : t('res.teamsTitle', { n: data.gp.n, of: data.gp.of })) : data.gp ? (data.gp.finished ? t('res.gpFinal') : t('res.gpTitle', { n: data.gp.n, of: data.gp.of })) : t('res.title'));
    C.text($('.sub'), data.trackName);
    C.text($('.h0'), '');
    C.text($('.h2'), '');
    C.text($('.h3'), t('res.time'));
    C.text($('.h4'), t('res.best'));
    C.text($('.gaph'), t('res.gap'));
    C.text($('.ptsh'), t('res.points'));
    const rows = data.rows;
    const first = rows.find((r) => Number.isFinite(r.time))?.time ?? null;
    $('.rows').innerHTML = rows.map((r, n) => {
      const gap = Number.isFinite(r.time) && first !== null && r.place > 1 ? formatGap(lang, r.time - first) : '';
      return `<div class="rt rrow${r.human ? ' me' : ''}" data-p="${r.place}" ${r.human ? `data-seat="${r.slot}"` : ''} ${r.team ? `data-team="${r.team}"` : ''} style="--dl:${(n * 0.05).toFixed(2)}s">
        <span class="pos">${posHtml(lang, r.place)}</span><span>${thumb(r.kart)}</span><span class="who">${whoHtml(r)}</span>
        <span class="tm">${Number.isFinite(r.time) ? formatTime(lang, r.time) : t('res.noTime')}</span>
        <span class="bl">${r.bestLap > 0 && Number.isFinite(r.bestLap) ? formatTime(lang, r.bestLap) : ''}</span><span class="gapv">${gap}</span><span class="ptsv">${data.gp && (!sides || r.team) ? `+${r.points}` : ''}</span></div>`;
    }).join('');
    if (sides) {
      // the two sides, each with what this race gave it, its two karts under it
      C.text($('.gcard h3'), t('res.teamsTable'));
      $('.grows').innerHTML = sides.map((T, q) => `<div class="tblock" data-team="${T.team}" style="--tc:${teamInfo(T.team).color};--tl:${teamInfo(T.team).light};--dl:${(0.1 + q * 0.12).toFixed(2)}s">
        <div class="thd">${teamIcon(T.team)}<b>${teamName(T.team, lang)}</b><i>+${T.race}</i><strong>${T.points}</strong></div>
        ${T.members.map((e) => `<div class="rt rrow${e.human ? ' me' : ''}" ${e.human ? `data-seat="${e.slot}"` : ''}><span></span><span>${thumb(e.kart)}</span><span class="who">${whoHtml(e)}</span><span class="pts">${e.points}</span></div>`).join('')}
      </div>`).join('');
    } else if (data.gp) {
      C.text($('.gcard h3'), t('res.table'));
      $('.grows').innerHTML = data.gp.table.map((e, n) => `<div class="rt rrow${e.human ? ' me' : ''}" data-p="${e.rank}" ${e.human ? `data-seat="${e.slot}"` : ''} style="--dl:${(0.1 + n * 0.05).toFixed(2)}s">
        <span class="pos">${posHtml(lang, e.rank)}</span><span>${thumb(e.kart)}</span><span class="who">${whoHtml(e)}</span><span class="pts">${e.points}</span></div>`).join('');
    }
    paintButtons();
  }

  function paintButtons() {
    const f = $('.rfoot');
    const more = data.gp && !data.gp.finished;
    const btn = (a, cls, title, sub) => `<button type="button" class="bigbtn ${cls}" data-a="${a}"><b class="${cls.includes('green') ? 'ink' : ''}">${title}</b>${sub ? `<span>${sub}</span>` : ''}</button>`;
    if (more) {
      f.innerHTML = btn('lobby', 'soft', t('res.lobby'), t('res.lobbySub')) + btn('rematch', 'green', t('res.next'), data.nextName || '');
    } else {
      f.innerHTML = btn('podium', 'gold', t('res.podium'), '<span class="podc"></span>') + btn('rematch', 'green', t('res.rematch'), t(data.gp?.teams ? 'res.rematchTeams' : data.gp ? 'res.rematchGp' : 'res.rematchSub')) + btn('track', '', t('res.track'), t('res.trackSub')) + btn('lobby', 'soft', t('res.lobby'), t('res.lobbySub'));
    }
    lastCount = null;
  }

  return {
    el: root,
    enter(d) { data = d; paint(); },
    update(d) { data = { ...data, ...d }; paint(); },
    // the seconds left before the podium takes over
    countdown(s) {
      const v = Math.ceil(s);
      if (v === lastCount) return;
      lastCount = v;
      const c = root.querySelector('.podc');
      if (c) c.textContent = v > 0 ? t('res.podiumSub', { s: v }) : '';
    },
    relabel() { paint(); },
  };
}

const CHEER = { pose: 'cheer' };
const SAD = { pose: 'sad' };

export function createPodium(C) {
  const { el, t } = C;
  const root = el('section', 'scr podscr hide');
  root.innerHTML = `<div class="bg">${backdrop({ road: false, seed: 43 })}${clouds(5, 44)}</div>
    <canvas class="confetti"></canvas>
    <div class="stage">
      <div class="tbar"><h1 class="ink"></h1><div class="sub pill"></div></div>
      <div class="steps"></div>
      <div class="rfoot"></div>
    </div>`;
  const $ = (s) => root.querySelector(s);
  let data = null, live = [], cheerAt = 0;
  const cv = $('.confetti');
  const parts = [];
  const COLORS = ['#e0483d', '#f6c23e', '#4aa6f2', '#62c56e', '#f28bbd', '#fff4d8', '#ff9d3f'];
  function seedConfetti() {
    parts.length = 0;
    const W = innerWidth, H = innerHeight;
    cv.width = W; cv.height = H;
    // a side that won throws its own colours
    const won = data?.teams ? teamInfo(data.teams[0].team) : null, list = won ? [won.color, won.light, '#fff4d8', '#ffd23f'] : COLORS;
    for (let i = 0; i < 200; i++) parts.push({ x: Math.random() * W, y: -Math.random() * H * 1.4, vx: (Math.random() - 0.5) * 60, vy: 90 + Math.random() * 130, r: 6 + Math.random() * 8, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 7, c: list[i % list.length], kind: i % 3 });
  }
  function drawConfetti(dt) {
    const g = cv.getContext('2d'), W = cv.width, H = cv.height;
    g.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.y += p.vy * dt; p.x += (p.vx + Math.sin(p.y * 0.012 + p.rot) * 46) * dt; p.rot += p.vr * dt;
      if (p.y > H + 20) { p.y = -20; p.x = Math.random() * W; }
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.scale(1, 0.55 + 0.45 * Math.sin(p.rot * 1.7));
      g.fillStyle = p.c; g.strokeStyle = '#1d1f2b'; g.lineWidth = 1.6;
      g.beginPath();
      if (p.kind === 0) g.rect(-p.r, -p.r * 0.6, p.r * 2, p.r * 1.2);
      else if (p.kind === 1) g.arc(0, 0, p.r * 0.75, 0, 7);
      else { g.moveTo(-p.r, p.r * 0.7); g.lineTo(0, -p.r); g.lineTo(p.r, p.r * 0.7); g.closePath(); }
      g.fill(); g.stroke();
      g.restore();
    }
  }

  const steps0 = () => $('.steps');
  // A team championship ends with two steps: the two karts that won on the high one, cheering, their rivals on the low one, sulking.
  // A step is the side's, and says so ("1st team"), so that two karts on it never read as first and second tied; under the side's
  // points each driver shows their own, best scorer first.
  async function paintTeams(lang) {
    const sides = data.teams.map((T) => ({ ...T, members: [...T.members].sort((a, b) => b.points - a.points) }));
    const [first] = sides;
    C.text($('.tbar h1'), t('pod.teamsTitle', { team: teamName(first.team, lang) }));
    const steps = steps0();
    steps.classList.add('teams');
    steps.innerHTML = sides.map((T) => {
      const info = teamInfo(T.team), names = T.members.map((m) => `<span>${m.human && m.slot >= 0 ? `<i data-seat="${m.slot}">${t('res.you', { n: m.slot + 1 })}</i>` : ''}${C.karts.find((x) => x.id === m.kart)?.driver?.name || m.kart}<em>${t('pod.points', { n: m.points })}</em></span>`).join('');
      return `<div class="stp" data-p="${T.rank}" data-team="${T.team}" style="--tc:${info.color};--tl:${info.light}"><div class="duo">${T.members.map((m, n) => `<div class="kartc" data-kart="${m.kart}" style="--d:${(-(T.rank * 2 + n) * 0.21).toFixed(2)}s"></div>`).join('')}</div>
        <div class="block"><div class="nameplate card">${teamIcon(T.team)}<b>${teamName(T.team, lang)}</b><span>${t('pod.points', { n: T.points })}</span></div><div class="tnames">${names}</div><div class="num">${t(T.rank === 1 ? 'pod.teamFirst' : 'pod.teamSecond')}</div></div></div>`;
    }).join('');
    const f = $('.rfoot');
    const btn = (a, cls, title, sub) => `<button type="button" class="bigbtn ${cls}" data-a="${a}"><b class="${cls.includes('green') ? 'ink' : ''}">${title}</b><span>${sub}</span></button>`;
    f.innerHTML = btn('rematch', 'green', t('res.rematch'), t('res.rematchTeams')) + btn('track', '', t('res.track'), t('res.trackSub')) + btn('lobby', 'soft', t('res.lobby'), t('res.lobbySub'));
    live = [];
    const used = new Map();
    for (const T of sides) {
      const boxes = steps.querySelectorAll(`.stp[data-team="${T.team}"] .kartc`);
      for (let n = 0; n < T.members.length; n++) {
        const m = T.members[n], c = used.get(m.kart) || 0;
        used.set(m.kart, c + 1);
        const s = await C.stage(m.kart, c).catch(() => null);
        if (!s || !boxes[n]) continue;
        boxes[n].append(s.canvas);
        const won = T.rank === 1;
        live.push({ s, yaw: n === 0 ? 0.42 : -0.42, t: Math.random() * 4, id: m.kart, pose: won ? CHEER : SAD, won });
        s.draw(0, live.at(-1).yaw, live.at(-1).pose);
      }
    }
  }
  async function paint() {
    if (!data) return;
    const lang = C.lang();
    C.text($('.tbar h1'), data.gp ? t('pod.gpTitle') : t('pod.title'));
    C.text($('.sub'), data.trackName);
    // a Gran Premio won by a player has just opened a family kart
    root.querySelector('.unlockc')?.remove();
    const won = data.unlocked && C.karts.find((k) => k.id === data.unlocked);
    if (won) {
      const u = C.el('div', 'unlockc');
      u.innerHTML = `<b class="ul"></b><img alt="" src="assets/ui/karts/${won.id}.png"><strong></strong><span></span>`;
      u.querySelector('.ul').textContent = t('pod.unlocked');
      u.querySelector('strong').textContent = won.driver.name;
      u.querySelector('span').textContent = t('pod.unlockedHow');
      root.querySelector('.stage').append(u);
    }
    root.classList.toggle('hasunlock', !!won);
    if (data.teams) { await paintTeams(lang); return; }
    steps0().classList.remove('teams');
    const order = [2, 1, 3];
    const steps = $('.steps');
    steps.innerHTML = order.map((p) => {
      const r = data.top.find((x) => x.place === p);
      if (!r) return '<div class="stp"></div>';
      const k = C.karts.find((x) => x.id === r.kart);
      const sub = data.gp ? t('pod.points', { n: r.points }) : (Number.isFinite(r.time) ? (data.forma ? t('forma.podHeld', { time: formatTime(lang, r.time).replace(/[.,]\d+$/, '') }) : t('pod.time', { time: formatTime(lang, r.time) })) : (k?.name || ''));
      const tag = r.human && r.slot >= 0 ? `<i>${t('res.you', { n: r.slot + 1 })}</i>` : '';
      return `<div class="stp" data-p="${p}" ${r.human ? `data-seat="${r.slot}"` : ''}><div class="kartc" data-kart="${r.kart}" style="--d:${(-p * 0.28).toFixed(2)}s"></div><div class="block"><div class="nameplate card"><b>${tag}${k?.driver?.name || r.kart}</b><span>${sub}</span></div><div class="num">${p}</div></div></div>`;
    }).join('');
    const f = $('.rfoot');
    const btn = (a, cls, title, sub) => `<button type="button" class="bigbtn ${cls}" data-a="${a}"><b class="${cls.includes('green') ? 'ink' : ''}">${title}</b><span>${sub}</span></button>`;
    f.innerHTML = btn('rematch', 'green', t('res.rematch'), t(data.gp ? 'res.rematchGp' : 'res.rematchSub')) + btn('track', '', t('res.track'), t('res.trackSub')) + btn('lobby', 'soft', t('res.lobby'), t('res.lobbySub'));
    live = [];
    const used = new Map();
    for (const p of [1, 2, 3]) {
      const r = data.top.find((x) => x.place === p);
      if (!r) continue;
      const n = used.get(r.kart) || 0;
      used.set(r.kart, n + 1);
      const s = await C.stage(r.kart, n).catch(() => null);
      const box = steps.querySelector(`.stp[data-p="${p}"] .kartc`);
      if (!s || !box) continue;
      box.append(s.canvas);
      live.push({ s, yaw: p === 1 ? 0.25 : p === 2 ? 0.55 : -0.55, t: Math.random() * 4, id: r.kart });
      s.draw(0, live.at(-1).yaw, CHEER);
    }
  }
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    C.sound('confirm');
    C.emit('next', b.dataset.a);
  });

  return {
    el: root,
    enter(d) { data = d; seedConfetti(); paint(); cheerAt = 0.4; },
    tick(dt) {
      drawConfetti(dt);
      for (const l of live) {
        l.t += dt;
        l.s.draw(dt, l.yaw + Math.sin(l.t * 1.8) * (l.pose === SAD ? 0.08 : 0.26), l.pose || CHEER);
      }
      cheerAt -= dt;
      if (cheerAt <= 0 && live.length) {
        cheerAt = 1.2 + Math.random() * 1.2;
        const glad = live.filter((l) => l.pose !== SAD), voices = glad.length ? glad : live;
        C.emit('cheer', voices[Math.floor(Math.random() * voices.length)].id);
      }
    },
    relabel() { paint(); },
  };
}

export { pickLabel };
