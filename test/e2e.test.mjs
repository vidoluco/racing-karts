// The whole game as a person meets it: the real server as its own process, the TV page, real pad pages in Chromium with touch
// emulation, driven with touch events by a simple driver that only reads the host's state. Four phones from the lobby to the
// podium and a rematch; a phone that drops out and returns; one player against seven bots at each difficulty; the keyboard alone.
import { test, after } from 'node:test';
import { TRACK_IDS } from '../src/data/tracks.js';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launch, headlessShell, buildDist, startServerProcess, openPad, thumbFor, nonFinite } from '../tools/harness.mjs';
import { en as padEn } from '../controller/i18n.js';

const hasBrowser = !!headlessShell();
const skip = !hasBrowser && 'no chromium';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dist = mkdtempSync(join(tmpdir(), 'rk-e2e-'));
let browser = null;


async function setup(t, { query = '' } = {}) {
  if (!browser) { await buildDist(dist); browser = await launch('metal'); }
  const srv = await startServerProcess({ dist });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'en-US' });
  const tv = await ctx.newPage();
  const errors = [];
  tv.on('pageerror', (e) => errors.push(`tv: ${e.message}`));
  tv.on('console', (m) => { if (m.type() === 'error') errors.push(`tv: ${m.text()}`); });
  await tv.addInitScript(DRIVER);
  await tv.goto(`${srv.base}/?lang=en${query}`);
  await tv.waitForFunction(() => window.__game?.ready || window.__game?.error, null, { timeout: 120000 });
  assert.equal(await tv.evaluate(() => window.__game.error), null);
  const pads = [];
  const open = async (label) => { const p = await openPad(browser, srv.base, { label }); pads.push(p); return p; };
  t.after(async () => { for (const p of pads) await p.ctx.close().catch(() => {}); await ctx.close().catch(() => {}); await srv.close(); });
  return { srv, tv, errors, pads, open };
}

// Runs in the TV page. Looks at the road ahead and answers with a stick and two buttons, the way a casual player would: nothing
// from the bots' brain, only the sim's public state and the track's samples.
const DRIVER = () => {
  const mem = {};
  window.__drive = (slot) => {
    const g = window.__game, st = g?.state;
    if (!st || !g.renderer?.world) return null;
    const k = st.karts.find((x) => x.human && x.slot === slot);
    if (!k) return null;
    const T = g.renderer.world.track, S = T.samples, n = T.n, K = T.curvature, sp = Math.hypot(k.vx, k.vz), m = (mem[slot] ||= { still: 0, back: 0, lastUse: 0, t: st.t });
    const dt = st.t - m.t; m.t = st.t;
    const look = 7 + sp * 0.42, a = (k.trackI + Math.round(look / T.step)) % n;
    let err = Math.atan2(S.x[a] - k.x, S.z[a] - k.z) - k.yaw;
    err = Math.atan2(Math.sin(err), Math.cos(err));
    let bend = 0;
    for (let d = 10; d < 40 + sp; d += 6) bend = Math.max(bend, Math.abs(K[(k.trackI + Math.round(d / T.step)) % n]));
    const x = Math.max(-1, Math.min(1, -err * 2.6));
    let y = bend > 0.03 && sp > 18 ? -0.5 : 0;
    // going nowhere: back out for a moment
    m.still = sp < 2 && st.phase === 'race' ? m.still + dt : 0;
    if (m.still > 1.2) { m.back = 1; m.still = 0; }
    if (m.back > 0) { m.back -= dt; y = -1; }
    const useIt = !!k.item && k.rouletteT <= 0 && st.t - m.lastUse > 2.5 && st.phase === 'race';
    if (useIt) m.lastUse = st.t;
    return { x: m.back > 0 ? -x : x, y, item: useIt, drift: st.phase === 'race' && bend > 0.018 && bend < 0.05 && sp > 20 && Math.abs(err) < 0.6, phase: st.phase, finished: k.finished, lap: k.lap };
  };
};

// ---------- thumbs ----------
const touch = (p, type, points) => p.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
async function tap(p, sel) {
  // Wait for the real touch target to settle after menu updates before pressing it.
  await p.page.locator(sel).tap();
}
async function swipe(p, from, dx) {
  await touch(p, 'touchStart', [{ ...from, id: 1 }]);
  for (let i = 1; i <= 5; i++) await touch(p, 'touchMove', [{ x: from.x + (dx * i) / 5, y: from.y, id: 1 }]);
  await touch(p, 'touchEnd', [{ x: from.x + dx, y: from.y, id: 1 }]);
}
const padIs = (p, phase, ms = 8000) => p.page.waitForFunction((q) => window.__pad.phase === q, phase, { timeout: ms });
const tvIs = (tv, phase, ms = 120000) => tv.waitForFunction((q) => window.__game.phase === q || window.__game.error, phase, { timeout: ms });

// Thumbs on one pad: the stick held, USE ITEM tapped, DRIFT held, as the driver says.
function thumbs(p) {
  const s = { stick: null, item: false, drift: false };
  const pts = () => [
    ...(s.stick ? [{ ...s.stick, id: 1 }] : []),
    ...(s.item ? [{ x: p.geo.bx, y: p.geo.by, id: 2 }] : []),
    ...(s.drift ? [{ x: p.geo.dx, y: p.geo.dy, id: 3 }] : []),
  ];
  return {
    async apply(want) {
      const at = thumbFor(p.geo, want.x, want.y);
      if (!s.stick) { s.stick = thumbFor(p.geo, 0, 0); await touch(p, 'touchStart', pts()); }
      s.stick = at;
      await touch(p, 'touchMove', pts());
      if (s.item) { const lift = [{ x: p.geo.bx, y: p.geo.by, id: 2 }]; s.item = false; await touch(p, 'touchEnd', lift); }
      else if (want.item) { s.item = true; await touch(p, 'touchStart', pts()); }
      if (s.drift !== !!want.drift) {
        const pt = [{ x: p.geo.dx, y: p.geo.dy, id: 3 }];
        s.drift = !!want.drift;
        if (s.drift) await touch(p, 'touchStart', pts()); else await touch(p, 'touchEnd', pt);
      }
    },
    async lift() { if (s.stick || s.item || s.drift) await touch(p, 'touchEnd', []); s.stick = null; s.item = false; s.drift = false; },
  };
}

// The driver at about 20 Hz until `done` says stop. Returns how many ticks ran.
async function drive(tv, pads, done) {
  const hands = pads.map(thumbs);
  let ticks = 0;
  const failed = []; // a broken touch path must fail here, not as a timeout much later
  const count = (e) => { failed.push(e.message); };
  while (!(await done())) {
    const t0 = Date.now();
    const plan = await tv.evaluate((slots) => slots.map((s) => window.__drive(s)), pads.map((p) => p.slot));
    await Promise.all(pads.map((p, i) => (plan[i] ? hands[i].apply(plan[i]).catch(count) : null)));
    ticks++;
    await sleep(Math.max(0, 50 - (Date.now() - t0)));
  }
  await Promise.all(hands.map((h) => h.lift().catch(count)));
  assert.deepEqual(failed, [], `every thumb landed, in ${ticks} ticks`);
  return ticks;
}

// A phone sets the options with its own buttons, starts, picks, votes: everything by touch.
async function lobbyToRace(tv, pads, { difficulty, bots, laps }) {
  const first = pads[0];
  await padIs(first, 'lobby');
  if (difficulty) { await tap(first, `.seg[data-key="difficulty"] button[data-v="${difficulty}"]`); await tv.waitForFunction((d) => window.__game.flowApi.opts.difficulty === d, difficulty, { timeout: 4000 }); }
  if (laps) { await tap(first, `.seg[data-key="laps"] button[data-v="${laps}"]`); await tv.waitForFunction((d) => window.__game.flowApi.opts.laps === d, laps, { timeout: 4000 }); }
  if (bots !== undefined) {
    for (let guard = 0; guard < 8 && (await tv.evaluate(() => window.__game.flowApi.opts.bots)) !== bots; guard++) {
      const now = await tv.evaluate(() => window.__game.flowApi.opts.bots);
      await tap(first, `.step button[data-d="${now > bots ? -1 : 1}"]`);
      await tv.waitForFunction((n) => window.__game.flowApi.opts.bots === n, now + (now > bots ? -1 : 1), { timeout: 4000 });
    }
  }
  await tap(first, '#goBtn');
  await tvIs(tv, 'pick');
  for (const p of pads) await padIs(p, 'pick');
}
async function pickAll(tv, pads) {
  const chosen = [];
  for (const p of pads) {
    await p.page.waitForFunction(() => window.__pad.carousel?.focus, null, { timeout: 4000 });
    const before = await p.page.evaluate(() => window.__pad.carousel.focus);
    const c = await p.page.evaluate(() => { const r = window.__pad.carousel.rect(window.__pad.carousel.focus); return { x: r.x, y: r.y }; });
    await swipe(p, c, -90);
    await p.page.waitForFunction((k) => window.__pad.carousel.focus !== k, before, { timeout: 3000 });
    const kart = await p.page.evaluate(() => window.__pad.carousel.focus);
    chosen.push(kart);
    // the card is real: the rendered picture, the name and the stat bars
    const card = await p.page.waitForFunction((k) => {
      const c = document.querySelector(`#kartCar .vc[data-id="${k}"]`), img = c?.querySelector('img');
      return img?.classList.contains('ok') && img.naturalWidth > 100 && c.querySelectorAll('.bars .bar').length === 5 && c.querySelector('.nm').textContent.length > 2 && c;
    }, kart, { timeout: 6000 });
    assert.ok(card);
    await tv.waitForFunction(([s, k]) => window.__game.seats[s].kart === k, [p.slot, kart], { timeout: 4000 });
    await tap(p, '#readyBtn');
  }
  return chosen;
}
async function voteAll(tv, pads) {
  for (const p of pads) await padIs(p, 'vote', 10000);
  await tvIs(tv, 'vote');
  const available = await tv.evaluate(() => window.__game.flowApi.tracks);
  assert.deepEqual(available, TRACK_IDS, 'every implemented track is on offer');
  for (const p of pads) {
    await p.page.waitForFunction(() => window.__pad.carousel?.focus, null, { timeout: 4000 });
    assert.deepEqual(await p.page.evaluate(() => window.__pad.carousel.ids), [...TRACK_IDS, 'random']);
  }
  assert.equal(await tv.evaluate(() => [...document.querySelectorAll('.vote .tc:not(.hide)')].length), TRACK_IDS.length + 1, 'on the TV: every track and the random card');
  for (const p of pads) {
    await p.page.evaluate(() => window.__pad.carousel.show?.('antelao'));
    if (await p.page.evaluate(() => window.__pad.carousel.focus) !== 'antelao') {
      const r = await p.page.evaluate(() => { const c = window.__pad.carousel.rect('antelao'); return { x: c.x, y: c.y }; });
      await p.page.touchscreen.tap(r.x, r.y);
    }
    await tap(p, '#voteBtn');
  }
}
// Past the flyover, by a press on the first phone, and on to the countdown.
async function intoRace(tv, pads) {
  await tvIs(tv, 'race');
  for (const p of pads) {
    await padIs(p, 'race', 8000);
    p.geo = await p.page.evaluate(() => window.__pad.geometry());
  }
  await tv.waitForFunction(() => window.__game.flyover || window.__game.state?.t >= 0, null, { timeout: 10000 });
  if (await tv.evaluate(() => window.__game.flyover)) {
    await sleep(600);
    await touch(pads[0], 'touchStart', [{ x: pads[0].geo.bx, y: pads[0].geo.by, id: 2 }]);
    await sleep(120);
    await touch(pads[0], 'touchEnd', []);
    await tv.waitForFunction(() => !window.__game.flyover, null, { timeout: 4000 });
  }
  await tv.waitForFunction(() => window.__game.state?.phase === 'countdown' || window.__game.state?.phase === 'race', null, { timeout: 8000 });
}
const checkResults = (rows, field) => {
  assert.equal(rows.length, field);
  assert.deepEqual(rows.map((r) => r.place), Array.from({ length: field }, (_, i) => i + 1));
};

test('a fifth phone hears the room is full, and takes the seat the TV gives up', { skip, timeout: 120000 }, async (t) => {
  const { srv, tv, errors, pads, open } = await setup(t);
  for (let i = 0; i < 4; i++) assert.equal((await open(`pad${i}`)).slot, i);
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, locale: 'en-US' });
  t.after(() => ctx.close().catch(() => {}));
  const fifth = await ctx.newPage();
  const fifthErrors = [];
  fifth.on('pageerror', (e) => fifthErrors.push(e.message));
  await fifth.goto(`${srv.base}/pad`);
  await fifth.waitForFunction((s) => document.getElementById('ovTitle').textContent === s, padEn['pad.full'], { timeout: 8000 });
  assert.equal(await fifth.evaluate(() => document.getElementById('overlay').classList.contains('hide')), false, 'the message is showing');
  assert.equal(await fifth.evaluate(() => window.__pad.joined), false);
  const waitingNow = async () => (await (await fetch(`${srv.base}/api/info`)).json()).waiting;
  assert.equal(await waitingNow(), 1);
  // its phone gone, the seat is held for it: the fifth still waits
  await pads[3].ctx.close();
  await tv.waitForFunction(() => !window.__game.pads[3], null, { timeout: 9000 });
  await sleep(400);
  assert.equal(await fifth.evaluate(() => window.__pad.joined), false, 'a held seat is not free');
  // the TV gives the seat up
  assert.equal(await tv.evaluate(() => window.__game.flowApi.free(3)), true);
  await fifth.waitForFunction(() => window.__pad.joined && window.__pad.slot === 3, null, { timeout: 4000 });
  await tv.waitForFunction(() => window.__game.pads[3] && window.__game.seats[3].present, null, { timeout: 4000 });
  assert.equal(await waitingNow(), 0);
  assert.deepEqual(errors, []);
  assert.deepEqual(fifthErrors, []);
});

test('four phones by touch, four bots: join, karts, vote, three laps, results, podium, rematch', { skip, timeout: 720000 }, async (t) => {
  const { tv, errors, pads, open } = await setup(t);
  for (let i = 0; i < 4; i++) { const p = await open(`pad${i}`); assert.equal(p.slot, i); }
  await tv.waitForFunction(() => window.__game.seats.filter((s) => s.present).length === 4);

  await lobbyToRace(tv, pads, { difficulty: 'medium', bots: 4, laps: 3 });
  const karts = await pickAll(tv, pads);
  await voteAll(tv, pads);
  await intoRace(tv, pads);
  const race = await tv.evaluate(() => ({ karts: window.__game.state.karts.map((k) => [k.human, k.slot, k.kart]), views: window.__game.views, laps: window.__game.laps }));
  assert.equal(race.karts.length, 8);
  assert.equal(race.views.length, 4);
  assert.equal(race.laps, 3);
  for (let s = 0; s < 4; s++) assert.equal(race.karts.find((k) => k[0] && k[1] === s)[2], karts[s], 'the kart picked on the phone');

  // the phones hear the race: place, lap and, once a box is taken, the icon on USE ITEM
  let sawIcon = false;
  const ticks = await drive(tv, pads, async () => {
    if (!sawIcon) sawIcon = (await Promise.all(pads.map((p) => p.page.evaluate(() => !!document.querySelector('#item.held #itemIcon svg')))).then((a) => a.some(Boolean)));
    return tv.evaluate(() => window.__game.phase !== 'race' || !!window.__game.error);
  });
  assert.ok(ticks > 200, `the driver ran: ${ticks}`);
  await tvIs(tv, 'results', 5000);
  assert.ok(sawIcon, 'an item icon showed on a phone');
  const g = await tv.evaluate(() => ({ results: window.__game.results, counts: window.__game.counts, error: window.__game.error }));
  assert.equal(g.error, null);
  checkResults(g.results, 8);
  for (const r of g.results.filter((x) => x.human)) assert.ok(r.time > 60, `slot ${r.slot} finished, in ${r.time}`);
  for (const key of ['go', 'boxTake', 'itemUse', 'lap', 'lastLap', 'finish', 'overtake']) assert.ok(g.counts[key] > 0, `no ${key} event in a whole race: ${JSON.stringify(g.counts)}`);
  assert.deepEqual(await nonFinite(tv), []);
  t.diagnostic(`race: ${g.results.map((r) => `${r.place}.${r.human ? 'P' + (r.slot + 1) : r.kart}${r.time ? ' ' + r.time.toFixed(1) : ''}`).join(', ')}`);
  t.diagnostic(`events: ${JSON.stringify(g.counts)}`);

  for (const p of pads) {
    await padIs(p, 'results', 4000);
    const row = g.results.find((r) => r.slot === p.slot);
    await p.page.waitForFunction((n) => (document.getElementById('resPlace').textContent || '').startsWith(String(n)), row.place, { timeout: 4000 });
  }
  // the podium comes by itself, the phones stay on their results and start the rematch
  await tvIs(tv, 'podium', 15000);
  const top = await tv.evaluate(() => window.__game.podium);
  assert.equal(top.length, 3);
  assert.deepEqual(top.map((r) => r.place), [1, 2, 3]);
  assert.equal(await pads[0].page.evaluate(() => window.__pad.phase), 'results');
  await sleep(600);
  // nobody gets up: each phone presses Continue, and the last press starts it
  for (const p of pads) {
    await p.page.waitForFunction(() => window.__pad.menu.advance && !document.getElementById('resNext').classList.contains('held'), null, { timeout: 4000 });
    await tap(p, '#resNext');
  }
  await tvIs(tv, 'race', 30000);
  await tv.waitForFunction(() => window.__game.state && window.__game.state.t < 30 && window.__game.results === null, null, { timeout: 8000 });
  assert.equal(await tv.evaluate(() => window.__game.state.karts.filter((k) => k.human).length), 4);
  for (const p of pads) { await padIs(p, 'race'); assert.deepEqual(p.errors, [], p.label); }
  assert.deepEqual(errors, []);
});

test('a phone drops out mid-race and returns: the TV says so at once, the autopilot keeps the kart moving, the phone takes it back', { skip, timeout: 360000 }, async (t) => {
  const { tv, errors, pads, open } = await setup(t);
  await open('pad0');
  await lobbyToRace(tv, pads, { difficulty: 'medium', bots: 3, laps: 2 });
  await pickAll(tv, pads);
  await voteAll(tv, pads);
  await intoRace(tv, pads);
  const p = pads[0];
  const started = Date.now();
  // it drops out at speed, whenever that is after the opening
  await drive(tv, pads, async () => Date.now() - started > 14000 && (await tv.evaluate(() => window.__game.state.karts.find((x) => x.human).speed > 15) || Date.now() - started > 40000));
  const k0 = await tv.evaluate(() => { const k = window.__game.state.karts.find((x) => x.human); return { speed: k.speed, progress: k.progress }; });
  assert.ok(k0.speed > 10 && k0.progress > 0.05, `driving by touch: ${JSON.stringify(k0)}`);

  await p.ctx.setOffline(true);
  await tv.waitForFunction(() => !window.__game.pads[0], null, { timeout: 9000 });
  await tv.waitForFunction(() => { const e = document.querySelector('.hv .miss'); return e && !e.classList.contains('hide'); }, null, { timeout: 2000 });
  await tv.waitForFunction(() => /P1 offline, 1:5\d left/.test(document.querySelector('.offline')?.textContent || ''), null, { timeout: 2000 });
  // no dead kart in the road: a bot drives it from the start, for as long as the phone is away
  await tv.waitForFunction(() => { const e = document.querySelector('.hv .miss span'); return e && /drives|guida|bot/i.test(e.textContent); }, null, { timeout: 2000 });
  const slowest = await tv.evaluate(async () => {
    let least = 1e9;
    const until = performance.now() + 6000;
    while (performance.now() < until) { const k = window.__game.state.karts.find((x) => x.human); if (k.hitT <= 0 && k.rescueT <= 0) least = Math.min(least, k.speed); await new Promise(requestAnimationFrame); }
    return least;
  });
  assert.ok(slowest > 8, `it kept moving for 6 s, slowest ${slowest}`);
  await p.ctx.setOffline(false);
  await tv.waitForFunction(() => window.__game.pads[0], null, { timeout: 12000 });
  await p.page.waitForFunction(() => window.__pad.joined && window.__pad.slot === 0 && window.__pad.phase === 'race', null, { timeout: 6000 });
  await tv.waitForFunction(() => document.querySelector('.hv .miss').classList.contains('hide') && document.querySelector('.offline').classList.contains('hide'), null, { timeout: 3000 });
  // the host tells a phone that came back everything again
  await p.page.waitForFunction(() => !document.getElementById('hud').classList.contains('hide'), null, { timeout: 3000 });
  p.geo = await p.page.evaluate(() => window.__pad.geometry());

  // the thumb has the kart again: full lock left turns it left, and the input source is the phone
  const yaw = () => tv.evaluate(() => window.__game.state.karts.find((x) => x.human).yaw);
  const hand = thumbs(p);
  await hand.apply({ x: -1, y: 0 });
  await tv.waitForFunction(() => window.__game.state.karts.find((x) => x.human).steer < -0.5, null, { timeout: 3000 });
  const before = await yaw();
  await sleep(350);
  const after = await yaw();
  const turned = Math.atan2(Math.sin(after - before), Math.cos(after - before)); // yaw is + to the left
  await hand.lift();
  t.diagnostic(`full lock left for 350 ms: yaw ${turned.toFixed(3)} rad`);
  assert.ok(turned > 0.02, `the kart turned left: ${turned}`);

  await tv.evaluate(() => { window.__game.setAuto(true); window.__game.speed = 6; });
  await tvIs(tv, 'results', 120000);
  checkResults(await tv.evaluate(() => window.__game.results), 4);
  assert.deepEqual(errors, []);
  assert.deepEqual(p.errors.filter((e) => !/ERR_INTERNET_DISCONNECTED|WebSocket/.test(e)), []);
});

const MAX_STUCK_S = 8;
for (const difficulty of ['easy', 'medium', 'hard']) {
  test(`one phone against seven bots on ${difficulty}: the race is at that level and everyone gets home`, { skip, timeout: 240000 }, async (t) => {
    const { tv, errors, pads, open } = await setup(t);
    await open('pad0');
    await lobbyToRace(tv, pads, { difficulty, bots: 7, laps: 2 });
    await pickAll(tv, pads);
    await voteAll(tv, pads);
    await intoRace(tv, pads);
    const started = Date.now();
    await drive(tv, pads, async () => Date.now() - started > 12000);
    // the opening by touch, the rest on fast forward with the autopilot in the human's seat
    // How long, in race seconds, any kart stood still with nothing to excuse it.
    const stillSince = {};
    let stuck = 0;
    await tv.evaluate(() => { const g = window.__game; g.setAuto(true); g.speed = 6; });
    while (await tv.evaluate(() => window.__game.phase === 'race' && !window.__game.error)) {
      const now = await tv.evaluate(() => { const r = window.__game.state; return r ? { t: r.t, still: r.karts.map((k) => !k.finished && Math.hypot(k.vx, k.vz) < 0.5 && k.hitT <= 0 && k.rescueT <= 0 && r.phase === 'race') } : null; });
      if (now) now.still.forEach((s, i) => { if (!s) delete stillSince[i]; else { stillSince[i] ??= now.t; stuck = Math.max(stuck, now.t - stillSince[i]); } });
      await sleep(250);
    }
    await tvIs(tv, 'results', 60000);
    const g = await tv.evaluate(() => ({ results: window.__game.results, opts: window.__game.flowApi.opts, error: window.__game.error }));
    assert.equal(g.error, null);
    assert.equal(g.opts.difficulty, difficulty);
    checkResults(g.results, 8);
    const home = g.results.filter((r) => r.time !== null);
    assert.equal(home.length, 8, `the whole field home: ${JSON.stringify(g.results.filter((r) => r.time === null))}`);
    assert.ok(stuck < MAX_STUCK_S, `no kart stood still for ${MAX_STUCK_S} s of race: ${stuck.toFixed(1)} s`);
    const winner = Math.min(...home.map((r) => r.time));
    // the bots' pace, not the winner's: on easy the person in the seat now wins, so the winner's time is theirs
    results[difficulty] = Math.min(...home.filter((r) => !r.human).map((r) => r.time));
    t.diagnostic(`${difficulty}: winner in ${winner.toFixed(1)} s, best bot ${results[difficulty].toFixed(1)} s, ${home.length} of 8 home, longest still ${stuck.toFixed(1)} s`);
    assert.ok(winner > 60 && winner < 260, `${winner}`);
    assert.deepEqual(errors, []);
    assert.deepEqual(pads[0].errors, []);
  });
}
const results = {};
test('the hardest bots win faster than the easiest', { skip }, () => {
  assert.ok(results.easy > results.hard, JSON.stringify(results));
});

test('the keyboard alone: from the lobby to the podium and a rematch, with no phone at all', { skip, timeout: 240000 }, async (t) => {
  const { tv, errors } = await setup(t);
  const key = (code) => tv.keyboard.press(code, { delay: 40 });
  await tvIs(tv, 'lobby');
  await sleep(700);
  await tv.evaluate(() => window.__game.flowApi.setOpts({ laps: 2, bots: 3 }));
  await key('KeyE');
  await tvIs(tv, 'pick', 5000);
  await sleep(700);
  const first = await tv.evaluate(() => window.__game.seats[0].kart);
  await key('KeyD');
  await tv.waitForFunction((k) => window.__game.seats[0].kart !== k, first, { timeout: 3000 });
  await key('KeyE');
  await tvIs(tv, 'vote', 5000);
  await sleep(700);
  assert.equal(await tv.evaluate(() => window.__game.seats[0].track), 'antelao');
  await key('KeyE');
  await tvIs(tv, 'race', 60000);
  await tv.waitForFunction(() => window.__game.flyover, null, { timeout: 5000 });
  await key('KeyE');
  await tv.waitForFunction(() => !window.__game.flyover, null, { timeout: 4000 });
  await tv.waitForFunction(() => window.__game.state.phase === 'race', null, { timeout: 8000 });

  // steer with A and D as the driver says, tapping E whenever there is something to use
  const down = { KeyA: false, KeyD: false };
  const started = Date.now();
  while (Date.now() - started < 15000) {
    const want = await tv.evaluate(() => window.__drive(0));
    const left = want.x < -0.2, right = want.x > 0.2;
    for (const [code, on] of [['KeyA', left], ['KeyD', right]]) {
      if (on !== down[code]) { down[code] = on; if (on) await tv.keyboard.down(code); else await tv.keyboard.up(code); }
    }
    if (want.item) await key('KeyE');
    await sleep(40);
  }
  for (const code of Object.keys(down)) if (down[code]) await tv.keyboard.up(code);
  const st = await tv.evaluate(() => { const k = window.__game.state.karts[0], me = window.__game.state.karts.find((x) => x.human); return { progress: me.progress, k: !!k }; });
  assert.ok(st.progress > 0.1, `the keyboard drove it round: ${st.progress}`);

  await tv.evaluate(() => { const g = window.__game; g.setAuto(true); g.speed = 6; });
  await tvIs(tv, 'results', 120000);
  await tv.evaluate(() => { window.__game.speed = 1; });
  checkResults(await tv.evaluate(() => window.__game.results), 4);
  await sleep(700);
  await key('KeyE');
  await tvIs(tv, 'podium', 4000);
  await sleep(700);
  await key('KeyE');
  await tvIs(tv, 'race', 30000);
  assert.deepEqual(errors, []);
});

after(async () => { await browser?.close().catch(() => {}); rmSync(dist, { recursive: true, force: true }); });
