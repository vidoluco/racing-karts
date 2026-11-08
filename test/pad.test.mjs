import { TRACK_IDS } from '../src/data/tracks.js';
// The phone pad in headless Chromium with touch: stick, item, drift and the menus reach the host; four phones and a
// fifth waiting; reconnection; every screen fits at both orientations. SHOTS=<dir> saves pad-*.png screenshots.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer as createNet } from 'node:net';
import { build } from 'esbuild';
import { launch, openPad, headlessShell, thumbFor } from '../tools/harness.mjs';
import { startServer, host, pad, sleep } from '../server/testing.js';
import { en, it as itDict } from '../controller/i18n.js';
import { stickThrottle } from '../src/net/input.js';
import { buildTrack } from '../src/world/track.js';
import { buildTerrain } from '../src/world/terrain.js';
import { loadTrackDef } from '../src/data/tracks.js';
import { createRace } from '../src/sim/index.js';

const ROOT = new URL('..', import.meta.url).pathname;
const SIZES = [['landscape', 844, 390], ['portrait', 390, 844]];
const hasBrowser = !!headlessShell();
let dist, browser;

before(async () => {
  dist = mkdtempSync(join(tmpdir(), 'racing-karts-pad-'));
  copyFileSync(join(ROOT, 'controller/pad.html'), join(dist, 'pad.html'));
  await build({ absWorkingDir: ROOT, entryPoints: ['controller/pad.js'], bundle: true, format: 'esm', outfile: join(dist, 'pad.js'), logLevel: 'error' });
  if (hasBrowser) browser = await launch('swiftshader');
});
after(async () => {
  await browser?.close();
  rmSync(dist, { recursive: true, force: true });
});



async function room(t, opts = {}) {
  const srv = await startServer({ distDir: dist, ...opts });
  const h = await host(srv);
  t.after(() => srv.close());
  return { srv, h };
}
// A phone of any size; openPad from the harness is the landscape one the e2e tests use.
async function phone(srv, { width = 844, height = 390, locale = 'en-US', init = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, locale });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${srv.base}/pad`);
  await page.waitForFunction(() => window.__pad?.joined && window.__pad.slot >= 0, null, { timeout: 15000 });
  const cdp = await ctx.newCDPSession(page);
  const slot = await page.evaluate(() => window.__pad.slot);
  return { ctx, page, cdp, errors, slot, geo: await page.evaluate(() => window.__pad.geometry()) };
}
const touch = (p, type, points) => p.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
async function swipe(p, from, dx) {
  await touch(p, 'touchStart', [{ ...from, id: 1 }]);
  for (let i = 1; i <= 5; i++) await touch(p, 'touchMove', [{ x: from.x + (dx * i) / 5, y: from.y, id: 1 }]);
  await touch(p, 'touchEnd', [{ x: from.x + dx, y: from.y, id: 1 }]);
}
const tap = async (p, at) => { await p.page.touchscreen.tap(at.x, at.y); };
const tapEl = async (p, sel) => {
  const r = await p.page.locator(sel).boundingBox();
  await tap(p, { x: r.x + r.width / 2, y: r.y + r.height / 2 });
};
const inFrom = (slot, pred) => (m) => m.t === 'in' && m.slot === slot && pred(m);

test('the stick sits on the right two thirds and drives x and y; dead zone, rim and release', { skip: !hasBrowser && 'no chromium' }, async (t) => {
  const { srv, h } = await room(t);
  for (const [, width, height] of SIZES) {
    const p = await openOrPhone(srv, width, height);
    const g = p.geo;
    if (width > height) assert.ok(g.sx > width / 3, `stick at ${g.sx} of ${width}`);
    assert.ok(g.bx < g.sx && g.dx < g.sx, 'both buttons are left of the stick');
    const first = await h.next('in', 3000);
    assert.deepEqual([first.x, first.y, first.b, first.d], [0, 0, 0, 0]);
    const start = { x: g.sx, y: g.sy, id: 1 };
    await touch(p, 'touchStart', [start]);
    // a nudge inside the dead zone stays at zero
    await touch(p, 'touchMove', [{ ...start, x: g.sx + g.R * 0.06 }]);
    await sleep(80);
    assert.equal(await p.page.evaluate(() => window.__pad.state.x), 0);
    // full right, past the rim: clamped
    await touch(p, 'touchMove', [{ ...start, x: g.sx + g.R * 3 }]);
    const right = await h.next(inFrom(p.slot, (m) => m.x > 0.95), 2000);
    assert.ok(Math.abs(right.y) < 0.05);
    // the base followed the thumb: coming back a little is already less than full
    const up = thumbFor({ ...g, sx: g.sx + g.R * 2 }, 0, 1);
    await touch(p, 'touchMove', [{ ...start, x: up.x, y: up.y }]);
    const m = await h.next(inFrom(p.slot, (i) => i.y > 0.3), 2000);
    assert.ok(Math.hypot(m.x, m.y) <= 1.0001, 'inside the unit circle');
    await touch(p, 'touchEnd', [{ ...start, x: up.x, y: up.y }]);
    await h.next(inFrom(p.slot, (i) => i.seq > m.seq && i.x === 0 && i.y === 0), 2000);
    // brake: stick down gives a negative y
    await touch(p, 'touchStart', [start]);
    await touch(p, 'touchMove', [{ ...start, y: g.sy + g.R }]);
    await h.next(inFrom(p.slot, (i) => i.y < -0.9), 2000);
    await touch(p, 'touchEnd', [{ ...start, y: g.sy + g.R }]);
    assert.deepEqual(p.errors, []);
    await p.ctx.close();
    await sleep(60);
  }
});
function openOrPhone(srv, width, height) {
  return width === 844 ? openPad(browser, srv.base).then((p) => ({ ...p, errors: p.errors })) : phone(srv, { width, height });
}

// Finding 1 of the game review: the only control in the game. The real pad, the real thumb, then the host's rule and the sim.
const thumbAt = (g, deg, size = 1) => ({ x: g.sx + Math.cos(deg * Math.PI / 180) * g.R * size, y: g.sy + Math.sin(deg * Math.PI / 180) * g.R * size, id: 1 });
async function straightSpeed(stick) {
  const def = await loadTrackDef('antelao'), track = buildTrack(def), terrain = buildTerrain(track);
  let best = 0, len = 0, cur = 0;
  for (let i = 0; i < track.n * 2; i++) { if (Math.abs(track.curvature[i % track.n]) < 0.004) { cur++; if (cur > len) { len = cur; best = ((i - cur) % track.n) / track.n; } } else cur = 0; }
  const race = createRace({ track, terrain, seed: 1, laps: 9, players: [{ slot: 0, kart: 'tabia', human: true, name: 'a' }], difficulty: 'medium', countdown: 0 });
  race.teleport(0, best, 0, { speed: 30 });
  for (let i = 0; i < 240; i++) { const a = race.autopilot(0); race.step([{ steer: a.steer, throttle: stick, item: false, drift: false }]); }
  return race.state.karts[0].speed;
}

test('a thumb at full lock 30 degrees under horizontal does not slow the kart; a stick pointing down still brakes', { skip: !hasBrowser && 'no chromium' }, async (t) => {
  const { srv, h } = await room(t);
  const p = await openOrPhone(srv, 844, 390), g = p.geo;
  await h.next('in', 3000);
  const send = async (deg, size, pred) => {
    const at = thumbAt(g, deg, size);
    await touch(p, 'touchStart', [{ x: g.sx, y: g.sy, id: 1 }]);
    await touch(p, 'touchMove', [at]);
    const m = await h.next(inFrom(p.slot, pred), 2000);
    await touch(p, 'touchEnd', [at]);
    await h.next(inFrom(p.slot, (i) => i.seq > m.seq && i.x === 0 && i.y === 0), 2000);
    return m;
  };
  // the screen's y grows downward: 30 degrees past horizontal, to the right and to the left
  const right = await send(30, 1, (i) => i.x > 0.7 && i.y < -0.3), left = await send(150, 1, (i) => i.x < -0.7 && i.y < -0.3);
  assert.ok(Math.abs(right.y + 0.5) < 0.08, `the raw y is a real arc, ${right.y}`);
  assert.equal(stickThrottle(right.x, right.y), 0);
  assert.equal(stickThrottle(left.x, left.y), 0);
  const flat = await straightSpeed(0), arc = await straightSpeed(stickThrottle(right.x, right.y));
  assert.ok(arc >= flat - 0.01, `the kart keeps its speed: ${arc} of ${flat}`);
  // negative: the raw y the review measured takes the kart backwards, so this test can tell the rule from no rule
  assert.ok(await straightSpeed(right.y) < 1, 'without the rule that thumb stops the kart');
  // straight down, and a thumb a little off it, still brakes through the same rule
  const down = await send(90, 1, (i) => i.y < -0.9), nearly = await send(70, 1, (i) => i.y < -0.8);
  assert.ok(stickThrottle(down.x, down.y) < -0.9);
  assert.ok(stickThrottle(nearly.x, nearly.y) < -0.8, 'twenty degrees off straight down is still a brake');
  assert.ok(await straightSpeed(stickThrottle(down.x, down.y)) < 1, 'and it stops the kart');
  // a light touch near the centre, or a stick at 45 degrees, is not a brake
  assert.equal(stickThrottle(0, -0.2), 0);
  assert.equal(stickThrottle(0.7, -0.7), 0);
  // up keeps its meaning, the forward throw of an item
  assert.equal(stickThrottle(0.3, 0.8), 0.8);
  assert.deepEqual(p.errors, []);
  await p.ctx.close();
});

// Finding 7: a turbo in the hand grows with its tier, and what cannot be felt on an iPhone is shown.
test('vibration grows with the turbo tier; a phone with no vibrate gets a colour pulse instead', { skip: !hasBrowser && 'no chromium' }, async (t) => {
  const { srv, h } = await room(t);
  const felt = await phone(srv, { init: () => { window.__buzz = []; navigator.vibrate = (x) => { window.__buzz.push(x); return true; }; } });
  await tap(felt, { x: felt.geo.sx, y: felt.geo.sy });
  const silent = await phone(srv, { init: () => { delete Navigator.prototype.vibrate; delete navigator.vibrate; } });
  const fx = (slot, m) => h.send({ t: 'fx', slot, ...m });
  for (const tier of [1, 2, 3]) { fx(felt.slot, { kind: 'boost', tier }); fx(silent.slot, { kind: 'boost', tier }); await sleep(120); }
  for (const kind of ['charge', 'land', 'box']) { fx(felt.slot, { kind, tier: 2 }); fx(silent.slot, { kind, tier: 2 }); await sleep(60); }
  const buzz = await felt.page.evaluate(() => window.__buzz.filter(Boolean)), total = (x) => [x].flat().reduce((a, b) => a + b, 0);
  const boosts = buzz.filter((x) => Array.isArray(x) || x === 30).slice(0, 3);
  assert.ok(total(boosts[0]) < total(boosts[1]) && total(boosts[1]) < total(boosts[2]), `grows: ${JSON.stringify(boosts)}`);
  assert.ok(buzz.length >= 6, 'charge, land and box are felt too');
  assert.equal((await felt.page.evaluate(() => window.__pad.pulses)).n, 0, 'a phone that can vibrate does not flash on a turbo');
  const pulses = await silent.page.evaluate(() => window.__pad.pulses);
  assert.ok(pulses.n >= 6, `six pulses on the phone with no vibrate, ${pulses.n}`);
  assert.deepEqual(silent.errors, []);
  assert.deepEqual(felt.errors, []);
  await felt.ctx.close(); await silent.ctx.close();
});

test('without being told: the buttons say what they do until used, and an item the stick can aim says where it goes, live', { skip: !hasBrowser && 'no chromium' }, async (t) => {
  const { srv, h } = await room(t);
  const p = await phone(srv, { locale: 'it-IT' });
  const g = p.geo;
  const seen = (sel) => p.page.evaluate((q) => { const e = document.querySelector(q); return e.checkVisibility({ opacityProperty: true }) && getComputedStyle(e).opacity !== '0'; }, sel);
  const dir = () => p.page.textContent('#itemDir span');
  h.send({ t: 'phase', phase: 'race', slot: p.slot });
  h.send({ t: 'hud', place: 2, lap: 1, laps: 3, item: null, charges: 0, boost: false, slot: p.slot });
  await p.page.waitForFunction(() => window.__pad.phase === 'race');
  assert.match(await p.page.textContent('#hintDrift'), /curva/);
  assert.match(await p.page.textContent('#hintItem'), /cassetta/);
  assert.ok(await seen('#hintDrift') && await seen('#hintItem'));
  // NEGATIVE: an item that is not aimed, and no item, show no way up
  assert.equal(await seen('#upTag'), false);
  assert.equal(await seen('#itemDir'), false);
  h.send({ t: 'hud', place: 2, lap: 1, laps: 3, item: 'zuica', charges: 3, boost: false, slot: p.slot });
  await p.page.waitForFunction(() => window.__pad.item.held === 'zuica');
  assert.equal(await seen('#upTag'), false);
  // pressing with nothing to use did not teach anything: the item hint stays
  h.send({ t: 'hud', place: 2, lap: 1, laps: 3, item: null, charges: 0, boost: false, slot: p.slot });
  await p.page.waitForFunction(() => window.__pad.item.held === null);
  await touch(p, 'touchStart', [{ x: g.bx, y: g.by, id: 2 }]);
  await touch(p, 'touchEnd', [{ x: g.bx, y: g.by, id: 2 }]);
  assert.equal(await p.page.locator('#hintItem.gone').count(), 0);
  // POSITIVE: the cheese wheel, every state of the stick
  h.send({ t: 'hud', place: 2, lap: 1, laps: 3, item: 'formaggio', charges: 1, boost: false, slot: p.slot });
  await p.page.waitForFunction(() => window.__pad.item.held === 'formaggio');
  assert.ok(await seen('#upTag') && await seen('#itemDir'));
  assert.equal(await p.page.textContent('#upTag'), 'Su: avanti');
  assert.equal(await dir(), 'Dietro');
  const up = thumbFor(g, 0, 1), flat = thumbFor(g, 0, 0.3);
  await touch(p, 'touchStart', [{ x: g.sx, y: g.sy, id: 1 }]);
  await touch(p, 'touchMove', [{ ...flat, id: 1 }]);
  assert.equal(await dir(), 'Dietro', 'a little up is not up: the line is the same as the sim');
  await touch(p, 'touchMove', [{ ...up, id: 1 }]);
  await p.page.waitForFunction(() => window.__pad.state.y > 0.5);
  assert.equal(await dir(), 'Avanti');
  // and the input it shows is the one the sim reads as forward
  const m = await h.next(inFrom(p.slot, (i) => i.y > 0.5), 2000);
  assert.ok(stickThrottle(m.x, m.y) > 0.5);
  await touch(p, 'touchEnd', [{ ...up, id: 1 }]);
  await p.page.waitForFunction(() => window.__pad.state.y === 0);
  assert.equal(await dir(), 'Dietro', 'back when the thumb lifts');
  // used once, each hint is done
  await touch(p, 'touchStart', [{ x: g.bx, y: g.by, id: 2 }]);
  await touch(p, 'touchEnd', [{ x: g.bx, y: g.by, id: 2 }]);
  assert.equal(await p.page.locator('#hintItem.gone').count(), 1);
  assert.equal(await p.page.locator('#hintDrift.gone').count(), 0);
  await touch(p, 'touchStart', [{ x: g.dx, y: g.dy, id: 3 }]);
  await touch(p, 'touchEnd', [{ x: g.dx, y: g.dy, id: 3 }]);
  assert.equal(await p.page.locator('#hintDrift.gone').count(), 1);
  // gone with the item
  h.send({ t: 'hud', place: 2, lap: 1, laps: 3, item: null, charges: 0, boost: false, slot: p.slot });
  await p.page.waitForFunction(() => window.__pad.item.held === null);
  assert.equal(await seen('#upTag'), false);
  assert.deepEqual(p.errors, []);
  await p.ctx.close();
});

test('item and drift under the left thumb, together with the stick; the whole column answers', { skip: !hasBrowser && 'no chromium' }, async (t) => {
  const { srv, h } = await room(t);
  const p = await phone(srv);
  const g = p.geo;
  const stick = { x: g.sx, y: g.sy, id: 1 };
  const held = { x: g.sx + g.R, y: g.sy, id: 1 };
  await touch(p, 'touchStart', [stick]);
  await touch(p, 'touchMove', [held]);
  await touch(p, 'touchStart', [held, { x: g.bx, y: g.by, id: 2 }]);
  let m = await h.next(inFrom(p.slot, (i) => i.b === 1 && i.x > 0.9), 2000);
  assert.equal(m.d, 0);
  assert.ok(await p.page.locator('#item.down').count());
  await touch(p, 'touchEnd', [{ x: g.bx, y: g.by, id: 2 }]);
  m = await h.next(inFrom(p.slot, (i) => i.seq > m.seq && i.b === 0), 2000);
  assert.ok(m.x > 0.9, 'the stick stays down while the item lifts');
  await touch(p, 'touchStart', [held, { x: g.dx, y: g.dy, id: 3 }]);
  m = await h.next(inFrom(p.slot, (i) => i.d === 1 && i.b === 0), 2000);
  // drift is a hold: still on half a second later
  await sleep(500);
  assert.equal(await p.page.evaluate(() => window.__pad.state.d), 1);
  assert.ok(await p.page.locator('#drift.down').count());
  if (process.env.SHOTS) await p.page.screenshot({ path: join(process.env.SHOTS, 'pad-race-drift-844x390.png') });
  // the second left finger presses the item while drift is held
  await touch(p, 'touchStart', [held, { x: g.dx, y: g.dy, id: 3 }, { x: g.bx, y: g.by, id: 4 }]);
  await h.next(inFrom(p.slot, (i) => i.d === 1 && i.b === 1), 2000);
  await touch(p, 'touchEnd', []);
  await h.next(inFrom(p.slot, (i) => i.d === 0 && i.b === 0 && i.x === 0), 2000);
  // a thumb that misses still lands on the nearer button
  await touch(p, 'touchStart', [{ x: 12, y: 90, id: 5 }]);
  const missed = await p.page.evaluate(() => ({ ...window.__pad.state }));
  assert.equal(missed.b + missed.d, 1);
  await touch(p, 'touchEnd', []);
  assert.deepEqual(p.errors, []);
  await p.ctx.close();
});

test('four real pad pages join with four colours, the fifth waits and takes a freed slot, a reload keeps the slot', { skip: !hasBrowser && 'no chromium' }, async (t) => {
  const { srv, h } = await room(t, { reserveMs: 700 });
  const phones = [];
  for (let s = 0; s < 4; s++) phones.push(await openPad(browser, srv.base));
  assert.deepEqual(phones.map((p) => p.slot), [0, 1, 2, 3]);
  const colors = await Promise.all(phones.map((p) => p.page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim())));
  assert.deepEqual(colors, ['#4aa6f2', '#f28bbd', '#f6c23e', '#62c56e']);
  for (let s = 0; s < 4; s++) assert.match(await phones[s].page.textContent('#who'), new RegExp(`Player ${s + 1}`));
  // all four drive at once
  await Promise.all(phones.map((p) => touch(p, 'touchStart', [{ x: p.geo.bx, y: p.geo.by, id: 1 }])));
  for (let s = 0; s < 4; s++) await h.next(inFrom(s, (i) => i.b === 1), 2000);
  await Promise.all(phones.map((p) => touch(p, 'touchEnd', [])));

  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, locale: 'en-US' });
  const fifth = await ctx.newPage();
  await fifth.goto(`${srv.base}/pad`);
  await fifth.waitForFunction((s) => document.getElementById('ovTitle').textContent === s, en['pad.full']);
  assert.equal(await fifth.evaluate(() => window.__pad.joined), false);
  assert.deepEqual(await h.next('full', 2000), { t: 'full', waiting: 1 });

  // a reload is the same phone: same slot, the fifth keeps waiting
  await phones[2].page.reload();
  await phones[2].page.waitForFunction(() => window.__pad?.joined);
  assert.equal(await phones[2].page.evaluate(() => window.__pad.slot), 2);
  assert.equal(await fifth.evaluate(() => window.__pad.joined), false);

  // the phone in slot 1 walks away: its slot is kept for a while, then the fifth sits down in that colour
  await phones[1].ctx.close();
  await h.next((m) => m.t === 'leave' && m.slot === 1, 6000);
  assert.equal(await fifth.evaluate(() => window.__pad.joined), false, 'the seat is reserved at first');
  await fifth.waitForFunction(() => window.__pad.joined && window.__pad.slot === 1, null, { timeout: 5000 });
  assert.equal(await fifth.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()), '#f28bbd');
  for (const p of [phones[0], phones[2], phones[3]]) { assert.deepEqual(p.errors, []); await p.ctx.close(); }
  await ctx.close();
});

test('a page out of the browser holds no seat as online, not while connecting and not from the queue', { skip: !hasBrowser && 'no chromium' }, async (t) => {
  const { srv, h } = await room(t, { reserveMs: 500 });
  h.send({ t: 'game', on: true, phase: 'results' }); // a seat past its grace stands, as at the results where it was seen
  const slots = () => srv.room.status().slots;
  const setVisible = (page, ...states) => page.evaluate((list) => { for (const v of list) { Object.defineProperty(document, 'visibilityState', { value: v, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); } }, states);
  const p = await phone(srv);
  await setVisible(p.page, 'hidden');
  await p.page.waitForFunction(() => !window.__pad.joined);
  // a quick flick through the apps: back and away again in one breath, so it leaves in the middle of the handshake
  await setVisible(p.page, 'visible', 'hidden');
  await sleep(600);
  assert.deepEqual(await p.page.evaluate(() => [document.visibilityState, window.__pad.joined]), ['hidden', false]);
  assert.equal(slots()[0].connected, false, 'the TV is told it is offline, and no screen waits for it');
  await setVisible(p.page, 'visible');
  await p.page.waitForFunction(() => window.__pad.joined && window.__pad.slot === 0, null, { timeout: 3000 });
  assert.equal(slots()[0].connected, true);

  // the queue: it steps out when the page goes, a seat running out does not go to a pocket, and on return it has that seat
  const others = [];
  for (const id of ['two', 'three', 'four']) others.push(await pad(srv, id));
  const fifth = await (await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, locale: 'en-US' })).newPage();
  t.after(() => fifth.context().close());
  await fifth.goto(`${srv.base}/pad`);
  await fifth.waitForFunction((s) => document.getElementById('ovTitle').textContent === s, en['pad.full']);
  assert.equal(srv.room.status().waiting, 1);
  await setVisible(fifth, 'hidden');
  for (let i = 0; i < 40 && srv.room.status().waiting; i++) await sleep(25);
  assert.equal(srv.room.status().waiting, 0, 'out of the queue while away');
  await others[2].close();
  await sleep(800);
  assert.equal(await fifth.evaluate(() => window.__pad.joined), false, 'the seat that ran out was not given to a hidden page');
  assert.equal(slots()[3].connected, false);
  await setVisible(fifth, 'visible');
  await fifth.waitForFunction(() => window.__pad.joined && window.__pad.slot === 3, null, { timeout: 3000 });
  assert.equal(slots()[3].connected, true);
  assert.match(await fifth.textContent('#toastBig'), /You took Player 4's seat/);
  assert.deepEqual(p.errors, []);
  await p.ctx.close();
});

test('a dead connection: the phone says so, reconnects by itself and keeps its slot; pings keep it alive', { skip: !hasBrowser && 'no chromium' }, async (t) => {
  const { srv, h } = await room(t);
  const first = await phone(srv);
  const p = await phone(srv);
  assert.equal(p.slot, 1);
  // pings flow: the server treats it as a phone that is held to the silence limit
  await sleep(1300);
  assert.equal(srv.room.status().slots[1].connected, true);
  await p.ctx.setOffline(true);
  await h.next((m) => m.t === 'leave' && m.slot === 1, 9000);
  await p.page.waitForFunction((s) => !window.__pad.joined || document.getElementById('ovTitle').textContent === s, en['pad.lost'], { timeout: 6000 });
  await p.ctx.setOffline(false);
  await h.next((m) => m.t === 'join' && m.slot === 1, 12000);
  await p.page.waitForFunction(() => window.__pad.joined && window.__pad.slot === 1, null, { timeout: 5000 });
  assert.equal(await p.page.evaluate(() => document.getElementById('overlay').classList.contains('hide')), true);
  // a second tab of the same phone takes over and the old page offers the way back
  const tab = await p.ctx.newPage();
  await tab.goto(`${srv.base}/pad`);
  await tab.waitForFunction(() => window.__pad?.joined);
  assert.equal(await tab.evaluate(() => window.__pad.slot), 1);
  await p.page.waitForFunction((s) => document.getElementById('ovTitle').textContent === s, en['pad.elsewhere'], { timeout: 4000 });
  assert.equal(await p.page.locator('#ovBtn').isVisible(), true);
  await p.ctx.close();
  await first.ctx.close();
});

test('the address went away: after the failed retries the phone says to scan again, keeps trying, and a server that returns clears it', { skip: !hasBrowser && 'no chromium' }, async (t) => {
  let srv = await startServer({ distDir: dist });
  const port = srv.port;
  t.after(() => srv.close());
  const p = await phone(srv);
  t.after(() => p.ctx.close());
  const title = () => p.page.evaluate(() => document.getElementById('ovTitle').textContent);
  await srv.close();
  // An address that went away does not refuse: it hangs. Here: a port that accepts and never answers.
  const hole = createNet((s) => s.on('error', () => {}));
  await new Promise((ok) => hole.listen(port, '127.0.0.1', ok));
  const lost = Date.now();
  await p.page.waitForFunction((s) => document.getElementById('ovTitle').textContent === s, en['pad.lost'], { timeout: 6000 });
  assert.notEqual(await title(), en['pad.rescan'], 'a blip does not ask for a scan');
  await p.page.waitForFunction((s) => document.getElementById('ovTitle').textContent === s, en['pad.rescan'], { timeout: 20000, polling: 100 });
  const took = Date.now() - lost;
  t.diagnostic(`scan again after ${took} ms of an address that hangs`);
  assert.ok(took >= 8000, `not before the retries have failed: ${took} ms`);
  assert.equal(await p.page.evaluate(() => getComputedStyle(document.getElementById('overlay')).opacity), '1', 'on top, not faded out (a hidden overlay is opacity 0)');
  assert.equal(await p.page.textContent('#ovText'), en['pad.rescanText']);
  for (let i = 0; i < 40; i++) { assert.equal(await title(), en['pad.rescan'], 'it stays through the retries, no flicker'); await sleep(100); }
  hole.close();
  srv = await startServer({ distDir: dist, port });
  await p.page.waitForFunction(() => window.__pad.joined, null, { timeout: 15000 });
  await p.page.waitForFunction(() => document.getElementById('overlay').classList.contains('hide'), null, { timeout: 3000 }); // back in, the message is gone
});

test('the race: place and lap show, the item button rolls the roulette and lands, fx do not crash', { skip: !hasBrowser && 'no chromium' }, async (t) => {
  const { srv, h } = await room(t);
  const p = await phone(srv, { locale: 'it-IT' });
  h.send({ t: 'phase', slot: 0, phase: 'race' });
  h.send({ t: 'hud', slot: 0, place: 3, lap: 2, laps: 3, item: null, charges: 0, boost: false });
  await p.page.waitForFunction(() => document.getElementById('place').textContent === '3°');
  assert.equal(await p.page.textContent('#lap'), 'Giro 2/3');
  assert.equal(await p.page.evaluate(() => window.__pad.item.name), 'Oggetto');
  assert.equal(await p.page.locator('#item.empty').count(), 1);

  h.send({ t: 'fx', slot: 0, kind: 'roulette', item: 'zuica', ms: 900 });
  await p.page.waitForFunction(() => window.__pad.item.rolling);
  const seen = new Set();
  const t0 = Date.now();
  while (Date.now() - t0 < 500) { seen.add(await p.page.evaluate(() => window.__pad.item.name)); await sleep(30); }
  assert.ok(seen.size >= 3, `the roulette shows several items: ${[...seen]}`);
  // the host's hud during the roll does not spoil the result
  h.send({ t: 'hud', slot: 0, place: 3, lap: 2, laps: 3, item: 'zuica', charges: 3, boost: true });
  await sleep(60);
  assert.equal(await p.page.evaluate(() => window.__pad.item.rolling), true);
  await p.page.waitForFunction(() => !window.__pad.item.rolling, null, { timeout: 2000 });
  assert.equal(await p.page.evaluate(() => window.__pad.item.name), 'Țuică');
  assert.equal(await p.page.locator('#pips i').count(), 3);
  assert.equal(await p.page.locator('body.boosting').count(), 1);
  h.send({ t: 'hud', slot: 0, place: 3, lap: 2, laps: 3, item: 'zuica', charges: 2, boost: false });
  await p.page.waitForFunction(() => document.querySelectorAll('#pips i').length === 2);
  h.send({ t: 'hud', slot: 0, place: 1, lap: 3, laps: 3, item: null, charges: 0, boost: false });
  await p.page.waitForFunction(() => document.getElementById('itemName').textContent === 'Oggetto');
  for (const kind of ['box', 'hit', 'bump', 'boost', 'shield', 'lap', 'lastLap', 'buzz', 'whatever']) h.send({ t: 'fx', slot: 0, kind });
  h.send({ t: 'fx', slot: 0, kind: 'finish', place: 2 });
  await p.page.waitForFunction(() => document.getElementById('toastSmall').textContent === '2° posto');
  // out of the race the hud is gone
  h.send({ t: 'phase', slot: 0, phase: 'loading' });
  await p.page.waitForFunction(() => document.getElementById('hud').classList.contains('hide'));
  assert.deepEqual(p.errors, []);
  await p.ctx.close();
});

test('with the icons written the item button shows the icon, and without a TV the phone says so', { skip: !hasBrowser && 'no chromium' }, async (t) => {
  const iconDist = mkdtempSync(join(tmpdir(), 'racing-karts-pad-icons-'));
  t.after(() => rmSync(iconDist, { recursive: true, force: true }));
  copyFileSync(join(ROOT, 'controller/pad.html'), join(iconDist, 'pad.html'));
  const stub = { name: 'icons', setup(b) {
    b.onResolve({ filter: /ui\/icons\.js$/ }, () => ({ path: 'icons', namespace: 'stub' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const itemIcon = (id) => `<svg data-item="${id}" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5"/></svg>`; export const teamIcon = () => "";' }));
  } };
  await build({ absWorkingDir: ROOT, entryPoints: ['controller/pad.js'], bundle: true, format: 'esm', outfile: join(iconDist, 'pad.js'), logLevel: 'error', plugins: [stub] });
  const srv = await startServer({ distDir: iconDist });
  t.after(() => srv.close());
  const p = await phone(srv);
  // no host yet: the controller stands and a banner asks for the TV
  await p.page.waitForFunction((s) => document.getElementById('banner').classList.contains('show') && document.getElementById('banner').textContent === s, en['pad.noHost']);
  const h = await host(srv);
  await p.page.waitForFunction(() => !document.getElementById('banner').classList.contains('show'));
  h.send({ t: 'phase', slot: 0, phase: 'race' });
  h.send({ t: 'hud', slot: 0, place: 4, lap: 1, laps: 3, item: 'rendang', charges: 1, boost: false });
  await p.page.waitForFunction(() => document.querySelector('#itemIcon svg[data-item="rendang"]'));
  assert.equal(await p.page.locator('#item.named').count(), 0);
  h.send({ t: 'fx', slot: 0, kind: 'roulette', item: 'razzo', ms: 500 });
  const seen = new Set();
  const t0 = Date.now();
  while (Date.now() - t0 < 350) { seen.add(await p.page.evaluate(() => document.querySelector('#itemIcon svg')?.dataset.item)); await sleep(25); }
  assert.ok(seen.size >= 2, `icons roll: ${[...seen]}`);
  await h.close();
  await p.page.waitForFunction(() => document.getElementById('hud').classList.contains('hide') && !window.__pad.phase);
  assert.deepEqual(p.errors, []);
  await p.ctx.close();
});

test('screen wake, no zoom, no scroll, and the iOS haptic trick', { skip: !hasBrowser && 'no chromium' }, async (t) => {
  const { srv } = await room(t);
  const p = await phone(srv, { init: () => { Object.defineProperty(Navigator.prototype, 'vibrate', { value: undefined }); } });
  await p.page.evaluate(() => {
    window.__ticks = 0;
    document.querySelector('input[switch]').addEventListener('click', () => { window.__ticks++; });
  });
  await tap(p, { x: p.geo.bx, y: p.geo.by });
  await p.page.waitForFunction(() => window.__pad.awake);
  assert.ok(['lock', 'video'].includes(await p.page.evaluate(() => window.__pad.awake)));
  assert.ok(await p.page.evaluate(() => window.__ticks) >= 1, 'a press gives a switch tick where vibrate does not exist');
  const hygiene = await p.page.evaluate(() => ({
    viewport: document.querySelector('meta[name=viewport]').content,
    action: getComputedStyle(document.body).touchAction,
    scroll: [document.documentElement.scrollHeight <= innerHeight, document.documentElement.scrollWidth <= innerWidth],
  }));
  assert.match(hygiene.viewport, /user-scalable=no/);
  assert.equal(hygiene.action, 'none');
  assert.deepEqual(hygiene.scroll, [true, true]);
  await p.ctx.close();
});

test('options: slot 0 edits and starts, a guest only reads until the host hands them over', { skip: !hasBrowser && 'no chromium' }, async (t) => {
  const { srv, h } = await room(t);
  const a = await phone(srv);
  const b = await phone(srv);
  for (const s of [0, 1]) {
    h.send({ t: 'phase', slot: s, phase: 'lobby' });
    h.send({ t: 'menu', slot: s, opts: { difficulty: 'medium', bots: 7, laps: 3, mode: 'race' } });
  }
  await a.page.waitForFunction(() => window.__pad.screen === 'sLobby');
  await b.page.waitForFunction(() => window.__pad.screen === 'sLobby');
  assert.equal(await a.page.locator('#goBtn').isVisible(), true);
  assert.equal(await b.page.locator('#goBtn').isVisible(), false);
  assert.equal(await b.page.locator('.step button').first().isVisible(), false);
  await tapEl(a, '.seg[data-key="difficulty"] button[data-v="hard"]');
  assert.deepEqual(await h.next('opt', 2000), { t: 'opt', slot: 0, difficulty: 'hard' });
  await tapEl(a, '.step button[data-d="-1"]');
  assert.deepEqual(await h.next('opt', 2000), { t: 'opt', slot: 0, bots: 6 });
  await tapEl(a, '.seg[data-key="laps"] button[data-v="5"]');
  assert.deepEqual(await h.next('opt', 2000), { t: 'opt', slot: 0, laps: 5 });
  await tapEl(a, '.seg[data-key="mode"] button[data-v="gp"]');
  assert.deepEqual(await h.next('opt', 2000), { t: 'opt', slot: 0, mode: 'gp' });
  await tapEl(a, '#goBtn');
  assert.deepEqual(await h.next('opt', 2000), { t: 'opt', slot: 0, go: true });
  // the host hands the options to a guest (slot 0 left)
  h.send({ t: 'menu', slot: 1, edit: true });
  await b.page.waitForFunction(() => document.getElementById('goBtn').checkVisibility());
  await a.ctx.close();
  await b.ctx.close();
});

test('kart carousel: swipe, name, driver, stats, placeholder picture, ready; the host hears each step', { skip: !hasBrowser && 'no chromium' }, async (t) => {
  const { srv, h } = await room(t);
  const p = await phone(srv, { locale: 'it-IT' });
  h.send({ t: 'phase', slot: 0, phase: 'pick' });
  h.send({ t: 'menu', slot: 0, others: [{ slot: 1, kart: 'gatto', ready: true }] });
  await p.page.waitForFunction(() => window.__pad.screen === 'sKart');
  const car = () => p.page.evaluate(() => { const c = window.__pad.carousel; return { ids: c.ids, focus: c.focus, ready: c.ready, r: c.rect(c.focus) }; });
  let c = await car();
  assert.deepEqual(c.ids, ['tabia', 'gatto', 'seggiovia', 'mocanita', 'caruta', 'logan', 'jeep', 'becak', 'jukung']);
  assert.equal(c.focus, 'tabia');
  assert.deepEqual(await h.next('pick', 2000), { t: 'pick', slot: 0, kart: 'tabia', ready: false }, 'the TV learns which card is in front');

  const front = p.page.locator('.kc.on');
  assert.match(await front.locator('.nm').textContent(), /Il Tabià/);
  assert.match(await front.locator('.dr').textContent(), /Bepi/);
  assert.equal(await front.locator('.bars .bar').count(), 5, 'five chunky stat bars');
  const filled = await front.locator('.bar i.f').count();
  assert.equal(filled, 15, 'the stats of a kart sum to 15');
  await sleep(100);
  // no picture yet: the placeholder shows, the img is not painted over it
  assert.equal(await front.locator('.pic > svg').isVisible(), true);

  // cards animate: swipe from the same point of the carousel each time, the middle of the card in front at rest
  const mid = { x: c.r.x, y: c.r.y };
  await swipe(p, mid, -180);
  c = await car();
  assert.equal(c.focus, 'gatto');
  assert.deepEqual(await h.next('pick', 2000), { t: 'pick', slot: 0, kart: 'gatto', ready: false });
  assert.equal(await p.page.locator('.kc.on .seats i').count(), 1, 'the other player\'s pick shows on the card');
  assert.match(await p.page.locator('.kc.on .nm').textContent(), /Gatto delle Nevi/);

  await swipe(p, mid, 180);
  assert.equal((await car()).focus, 'tabia');
  await h.next('pick', 2000);
  // past the first card nothing moves
  await swipe(p, mid, 180);
  assert.equal((await car()).focus, 'tabia');
  assert.ok(await h.none('pick', 150));

  // a tap on the side card brings it in front
  await sleep(350);
  const side = await p.page.evaluate(() => window.__pad.carousel.rect('gatto'));
  await tap(p, { x: side.x - side.w / 2 + 8, y: side.y });
  await p.page.waitForFunction(() => window.__pad.carousel.focus === 'gatto');
  await h.next('pick', 2000);

  await tapEl(p, '#readyBtn');
  assert.deepEqual(await h.next('pick', 2000), { t: 'pick', slot: 0, kart: 'gatto', ready: true });
  assert.equal((await car()).ready, true);
  assert.equal(await p.page.textContent('#readyBtn'), itDict['pad.notReady']);
  // ready locks the carousel
  await swipe(p, mid, -180);
  assert.equal((await car()).focus, 'gatto');
  await tapEl(p, '#readyBtn');
  assert.deepEqual(await h.next('pick', 2000), { t: 'pick', slot: 0, kart: 'gatto', ready: false });
  // the host's word on where a phone that came back was
  const q = await phone(srv);
  h.send({ t: 'phase', slot: 1, phase: 'pick' });
  h.send({ t: 'menu', slot: 1, kart: 'jeep', ready: true });
  await q.page.waitForFunction(() => window.__pad.carousel?.focus === 'jeep' && window.__pad.carousel.ready);
  assert.ok(await h.none((m) => m.t === 'pick' && m.slot === 1), 'it does not overwrite what the host remembers');
  assert.deepEqual(p.errors, []);
  await p.ctx.close();
  await q.ctx.close();
});

test('track vote: carousel, random card, lock, the verdict follows the coin', { skip: !hasBrowser && 'no chromium' }, async (t) => {
  const { srv, h } = await room(t);
  const p = await phone(srv, { width: 390, height: 844, locale: 'it-IT' });
  h.send({ t: 'phase', slot: 0, phase: 'vote' });
  await p.page.waitForFunction(() => window.__pad.screen === 'sTrack');
  const ids = await p.page.evaluate(() => window.__pad.carousel.ids);
  assert.deepEqual(ids, [...TRACK_IDS, 'random']);
  assert.deepEqual(await h.next('vote', 2000), { t: 'vote', slot: 0, track: 'antelao', lock: false });
  const r = await p.page.evaluate(() => window.__pad.carousel.rect('antelao'));
  await swipe(p, { x: r.x, y: r.y }, -160);
  assert.deepEqual(await h.next('vote', 2000), { t: 'vote', slot: 0, track: 'pelmo', lock: false });
  await swipe(p, { x: r.x, y: r.y }, -160);
  assert.deepEqual(await h.next('vote', 2000), { t: 'vote', slot: 0, track: 'transfagarasan', lock: false });
  assert.match(await p.page.locator('.tc.on .nm').textContent(), /Transfăgărășan/);
  await tapEl(p, '#voteBtn');
  assert.deepEqual(await h.next('vote', 2000), { t: 'vote', slot: 0, track: 'transfagarasan', lock: true });
  h.send({ t: 'menu', slot: 0, spin: 'bali' });
  await p.page.waitForFunction(() => window.__pad.carousel.focus === 'bali');
  assert.equal(await p.page.textContent('#verdict'), itDict['pad.roll']);
  h.send({ t: 'menu', slot: 0, spin: 'pelmo', pick: 'pelmo', landed: true });
  await p.page.waitForFunction(() => window.__pad.carousel.focus === 'pelmo' && document.querySelector('.tc.picked'));
  assert.match(await p.page.textContent('#verdict'), /Pelmo d'Inverno/);
  // a new vote starts clean
  h.send({ t: 'phase', slot: 0, phase: 'lobby' });
  h.send({ t: 'phase', slot: 0, phase: 'vote' });
  await p.page.waitForFunction(() => window.__pad.screen === 'sTrack' && !document.querySelector('.tc.picked') && !window.__pad.carousel.ready);
  await p.ctx.close();
});

test('results: everyone has one big Continue, a second press undoes it; and every phone the other ways out, behind a second tap and far from it', { skip: !hasBrowser && 'no chromium' }, async (t) => {
  const { srv, h } = await room(t);
  const a = await phone(srv);
  const b = await phone(srv);
  const adv = (over = {}) => ({ turn: 5, mine: false, ready: 0, of: 2, kind: 'rematch', more: true, next: 'bran', ...over });
  for (const s of [0, 1]) {
    h.send({ t: 'phase', slot: s, phase: 'results' });
    h.send({ t: 'menu', slot: s, place: s + 1, time: 125.25, edit: s === 0, advance: adv() });
  }
  await a.page.waitForFunction(() => window.__pad.screen === 'sResults' && document.getElementById('resPlace').textContent);
  await b.page.waitForFunction(() => window.__pad.screen === 'sResults' && document.getElementById('resPlace').textContent);
  assert.equal(await a.page.textContent('#resPlace'), '1st');
  assert.match(await a.page.textContent('#resTime'), /2:05\.[23]/);
  for (const p of [a, b]) {
    assert.equal(await p.page.textContent('#resNext'), 'Continue');
    assert.match(await p.page.textContent('#resWait'), /^Next race: /);
  }
  // the players, with two phones in hand: "il controllo deve essere dai telefoni", every phone and not only Player 1's
  for (const p of [a, b]) {
    assert.equal(await p.page.locator('#resMoreBtn').isVisible(), true, 'every phone has the ways out');
    assert.equal(await p.page.textContent('#resMoreBtn'), 'More choicesRematch, track, lobby', 'and says what is in them');
    assert.equal(await p.page.locator('#resBtns').isVisible(), false, 'behind a second tap');
  }
  // a thumb still racing when the screen came up: the first tap counts for nothing. A new screen, and the tap in the very moment
  // it is seen held: on a busy machine the steps above take longer than the hold itself
  h.send({ t: 'menu', slot: 1, advance: adv({ turn: 4 }) });
  await b.page.waitForFunction(() => {
    const btn = document.getElementById('resNext');
    if (window.__pad.menu.advance.turn !== 4 || !btn.classList.contains('held')) return false;
    btn.click();
    return true;
  }, null, { polling: 5 });
  assert.equal(await h.none('advance', 150), true, 'a press in the first moment is dropped');
  h.send({ t: 'menu', slot: 1, advance: adv() });
  await b.page.waitForFunction(() => window.__pad.menu.advance.turn === 5 && !document.getElementById('resNext').classList.contains('held'));
  await tapEl(b, '#resNext');
  assert.deepEqual(await h.next('advance', 2000), { t: 'advance', slot: 1, on: true, turn: 5 });
  assert.equal(await b.page.textContent('#resNext'), 'Undo');
  h.send({ t: 'menu', slot: 1, advance: adv({ mine: true, ready: 1 }) });
  await b.page.waitForFunction(() => /Waiting for the others: 1 of 2/.test(document.getElementById('resWait').textContent));
  h.send({ t: 'menu', slot: 0, advance: adv({ ready: 1 }) });
  await a.page.waitForFunction(() => /1 of 2 ready/.test(document.getElementById('resWait').textContent));
  await tapEl(b, '#resNext');
  assert.deepEqual(await h.next('advance', 2000), { t: 'advance', slot: 1, on: false, turn: 5 });
  // Player 1's second tap: the big button is gone while the choices are open
  await tapEl(a, '#resMoreBtn');
  assert.equal(await a.page.locator('#resNext').isVisible(), false);
  await tapEl(a, '#resSkip');
  assert.deepEqual(await h.next('advance', 2000), { t: 'advance', slot: 0, on: true, skip: true, turn: 5 });
  await tapEl(a, '#resAgain');
  assert.deepEqual(await h.next('opt', 2000), { t: 'opt', slot: 0, next: 'rematch', turn: 5 });
  await tapEl(a, '#resTrack');
  assert.deepEqual(await h.next('opt', 2000), { t: 'opt', slot: 0, next: 'track', turn: 5 });
  await tapEl(a, '#resLobby');
  assert.deepEqual(await h.next('opt', 2000), { t: 'opt', slot: 0, next: 'lobby', turn: 5 });
  await tapEl(a, '#resClose');
  assert.equal(await a.page.locator('#resNext').isVisible(), true);
  // the guest, the same: each choice reaches the host with the screen it was made on
  await tapEl(b, '#resMoreBtn');
  assert.equal(await b.page.locator('#resNext').isVisible(), false);
  await tapEl(b, '#resSkip');
  assert.deepEqual(await h.next('advance', 2000), { t: 'advance', slot: 1, on: true, skip: true, turn: 5 });
  for (const [id, next] of [['#resAgain', 'rematch'], ['#resTrack', 'track'], ['#resLobby', 'lobby']]) {
    await tapEl(b, id);
    assert.deepEqual(await h.next('opt', 2000), { t: 'opt', slot: 1, next, turn: 5 }, `the guest's ${next}`);
  }
  await tapEl(b, '#resClose');
  assert.equal(await b.page.locator('#resNext').isVisible(), true);
  // alone there is nobody to skip; a championship under way has neither a rematch nor another track to offer
  await tapEl(a, '#resMoreBtn');
  h.send({ t: 'menu', slot: 0, advance: adv({ of: 1, more: false }) });
  await a.page.waitForFunction(() => !document.getElementById('resSkip').checkVisibility());
  assert.equal(await a.page.locator('#resAgain').isVisible(), false);
  assert.equal(await a.page.locator('#resTrack').isVisible(), false);
  assert.equal(await a.page.locator('#resLobby').isVisible(), true);
  assert.equal(await a.page.textContent('#resMoreWhat'), 'Back to the lobby', 'the button says what is left in it');
  // the next screen coming under a thumb (a skip tapped twice, the podium by itself): the choices of the screen before close, and
  // the new one holds for its moment, the choices as much as the big button
  h.send({ t: 'menu', slot: 0, advance: adv({ turn: 6 }) });
  const atOnce = await a.page.waitForFunction(() => {
    const next = document.getElementById('resNext'), panel = document.getElementById('resBtns');
    if (window.__pad.menu.advance.turn !== 6 || !next.classList.contains('held')) return false;
    const seen = { next: next.checkVisibility(), panel: panel.checkVisibility() };
    document.getElementById('resMoreBtn').click();
    for (const id of ['resSkip', 'resAgain', 'resTrack', 'resLobby']) document.getElementById(id).click();
    return { ...seen, reopened: panel.checkVisibility() };
  }, null, { polling: 5 });
  assert.deepEqual(await atOnce.jsonValue(), { next: true, panel: false, reopened: true }, 'nothing of the screen before stays under the finger; the choices may open, but take nothing yet');
  assert.equal(await h.none('advance', 150), true, 'a skip in the first moment is dropped');
  assert.equal(await h.none('opt', 50), true, 'and so is a way out');
  await a.page.waitForFunction(() => !document.getElementById('resNext').classList.contains('held'));
  await tapEl(a, '#resSkip');
  assert.deepEqual(await h.next('advance', 2000), { t: 'advance', slot: 0, on: true, skip: true, turn: 6 });
  await tapEl(a, '#resClose');
  h.send({ t: 'phase', slot: 0, phase: 'podium' });
  h.send({ t: 'menu', slot: 0, edit: true, advance: adv({ turn: 8, kind: 'rematch', next: undefined }) });
  await a.page.waitForFunction(() => window.__pad.menu.advance.turn === 8 && document.getElementById('resNext').checkVisibility() && document.getElementById('resNext').classList.contains('held'));
  assert.match(await a.page.textContent('#resWait'), /^Playing it again/);
  assert.deepEqual(a.errors, []);
  await a.ctx.close();
  await b.ctx.close();
});

// Who holds the race options (edit) moves when Player 1 blips. The ways out no longer follow it: they are every phone's, and a
// change of holder neither opens nor shuts them under somebody's finger.
test('results: the choices are a guest\'s as much as Player 1\'s, and a change of who holds the options neither opens nor shuts them', { skip: !hasBrowser && 'no chromium' }, async (t) => {
  const { srv, h } = await room(t);
  const a = await phone(srv);
  const b = await phone(srv);
  const advance = { turn: 5, mine: false, ready: 0, of: 3, kind: 'rematch', more: false, next: 'bran' };
  const guest = (edit) => h.send({ t: 'menu', slot: b.slot, edit, advance });
  guest(false);
  h.send({ t: 'phase', slot: b.slot, phase: 'results' });
  await b.page.waitForFunction(() => window.__pad.screen === 'sResults' && !document.getElementById('resNext').classList.contains('held'));
  const big = await b.page.locator('#resNext').boundingBox();
  const spot = { x: big.x + big.width / 2, y: big.y + big.height / 2 };
  assert.equal(await b.page.locator('#resMoreBtn').isVisible(), true, 'a guest has the ways out');
  // a finger opens them; Player 1 blips and comes back: they stay open, they are this phone's either way
  await tapEl(b, '#resMoreBtn');
  assert.equal(await b.page.locator('#resBtns').isVisible(), true);
  guest(true);
  await b.page.waitForFunction(() => window.__pad.menu.edit === true);
  guest(false);
  await b.page.waitForFunction(() => window.__pad.menu.edit === false);
  assert.equal(await b.page.locator('#resBtns').isVisible(), true, 'nobody closed them');
  await tapEl(b, '#resClose');
  // and with nobody touching this phone they stay shut
  guest(true);
  await b.page.waitForFunction(() => window.__pad.menu.edit === true);
  guest(false);
  await b.page.waitForFunction(() => window.__pad.menu.edit === false);
  assert.equal(await b.page.locator('#resBtns').isVisible(), false, 'the choices stay shut until a finger opens them');
  assert.equal(await b.page.locator('#resNext').isVisible(), true);
  await b.page.waitForTimeout(500); // the second tap of Close is not a press: wait it out
  assert.equal(await b.page.evaluate(({ x, y }) => document.elementFromPoint(x, y).id, spot), 'resNext', 'under the finger is still Continue');
  await tap(b, spot);
  assert.deepEqual(await h.next('advance', 2000), { t: 'advance', slot: b.slot, on: true, turn: 5 });
  assert.equal(await h.none('opt', 150), true, 'and nobody went to the lobby');
  // Close comes off the spot of Continue: its second tap is not a press, and a later tap is
  await tapEl(b, '#resMoreBtn');
  const twice = await b.page.evaluate(() => { document.getElementById('resClose').click(); document.getElementById('resNext').click(); return document.getElementById('resNext').checkVisibility(); });
  assert.equal(twice, true);
  assert.equal(await h.none('advance', 150), true, 'a double tap on Close presses nothing');
  await b.page.waitForTimeout(500);
  await tap(b, spot);
  assert.deepEqual(await h.next('advance', 2000), { t: 'advance', slot: b.slot, on: false, turn: 5 });
  // a guest ends a championship under way too, with the same two taps as Player 1
  await tapEl(b, '#resMoreBtn');
  await tapEl(b, '#resLobby');
  assert.equal(await h.none('opt', 150), true, 'the first tap asks again');
  await b.page.waitForTimeout(600); // past the 500 ms of a double tap
  await tapEl(b, '#resLobby');
  assert.deepEqual(await h.next('opt', 2000), { t: 'opt', slot: b.slot, next: 'lobby', turn: 5 });
  await tapEl(b, '#resClose');
  // the positive case: a tap still opens them, and an advance that goes away shuts them just the same
  await tapEl(b, '#resMoreBtn');
  assert.equal(await b.page.locator('#resLobby').isVisible(), true);
  h.send({ t: 'menu', slot: b.slot, advance: null });
  await b.page.waitForFunction(() => document.getElementById('resBtns').classList.contains('hide'));
  h.send({ t: 'menu', slot: b.slot, advance });
  await b.page.locator('#resMoreBtn').waitFor({ state: 'visible' });
  assert.equal(await b.page.locator('#resBtns').isVisible(), false);
  assert.deepEqual(b.errors, []);
  await a.ctx.close();
  await b.ctx.close();
});

test('results: on every phone the spot of Continue says Close when the choices open, and no choice lies on it or on the spot of More', { skip: !hasBrowser && 'no chromium', timeout: 120000 }, async (t) => {
  const { srv, h } = await room(t);
  const READ = () => {
    const box = (id) => { const e = document.getElementById(id), r = e.getBoundingClientRect(); return e.checkVisibility({ visibilityProperty: true }) ? { id, l: r.left, t: r.top, r: r.right, b: r.bottom, text: e.textContent } : null; };
    return { next: box('resNext'), more: box('resMoreBtn'), close: box('resClose'), choices: ['resSkip', 'resAgain', 'resTrack', 'resLobby'].map(box).filter(Boolean) };
  };
  const hits = (a, b) => Math.min(a.r, b.r) - Math.max(a.l, b.l) > 0 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 0;
  const quiet = { place: 0, time: null, team: null, score: null, won: null, unlocked: null };
  const full = { place: 2, time: 187.4, team: 'a', score: { a: 18, b: 14 }, won: 'a', unlocked: 'baileys' };
  const every = { turn: 5, mine: false, ready: 1, of: 2, kind: 'rematch', more: true, next: 'transfagarasan' };
  const underWay = { ...every, more: false };
  for (const locale of ['en-US', 'it-IT']) {
    const p = await phone(srv, { locale });
    const say = (m) => h.send({ ...m, slot: p.slot });
    say({ t: 'phase', phase: 'results' });
    say({ t: 'menu', edit: true, ...quiet, advance: every });
    await p.page.waitForFunction(() => window.__pad.screen === 'sResults' && window.__pad.menu.advance && !document.getElementById('resNext').classList.contains('held'));
    for (const [w, h2] of [[844, 390], [844, 340], [812, 375], [812, 330], [932, 430], [932, 380], [667, 375], [667, 331], [568, 320], [390, 844], [390, 664], [320, 568], [360, 780], [412, 915], [1024, 768]]) {
      await p.page.setViewportSize({ width: w, height: h2 });
      for (const [info, advance, what] of [[quiet, every, 'nothing to show'], [full, every, 'everything to show'], [quiet, underWay, 'races to come']]) {
        const where = `${w}x${h2} ${locale}, ${what}`;
        say({ t: 'menu', ...info, advance });
        await p.page.waitForFunction((more) => window.__pad.menu.advance?.more === more && document.getElementById('resMoreBtn').checkVisibility(), advance.more, { polling: 20 });
        await p.page.waitForTimeout(30);
        const shut = await p.page.evaluate(READ);
        await p.page.evaluate(() => document.getElementById('resMoreBtn').click());
        const look = async (step) => {
          const open = await p.page.evaluate(READ);
          assert.equal(open.next, null, `${where}: Continue is out of the way ${step}`);
          for (const k of ['l', 't', 'r', 'b']) assert.ok(Math.abs(open.close[k] - shut.next[k]) < 1, `${where}: Close sits where Continue was ${step}, ${k} ${open.close[k]} against ${shut.next[k]}`);
          assert.equal(await p.page.evaluate((n) => document.elementFromPoint((n.l + n.r) / 2, (n.t + n.b) / 2).id, shut.next), 'resClose', `${where}: under the finger ${step}`);
          assert.ok(open.choices.some((c) => c.id === 'resLobby'), `${where}: the lobby is on offer`);
          for (const c of open.choices) {
            assert.ok(!hits(c, shut.next), `${where}: ${c.id} lies on Continue ${step}`);
            assert.ok(!hits(c, shut.more), `${where}: ${c.id} lies on More, the second tap of a double tap ${step}`);
            assert.ok(c.l >= 0 && c.t >= 0 && c.r <= w && c.b <= h2, `${where}: ${c.id} is on screen ${step}`);
          }
        };
        await look('when they open');
        if (!advance.more) { // the longer words of the second step need the same room
          await p.page.evaluate(() => document.getElementById('resLobby').click());
          assert.equal(await p.page.evaluate(() => document.getElementById('resLobby').classList.contains('sure')), true, `${where}: asks again`);
          await look('when it asks again');
        }
        await p.page.evaluate(() => document.getElementById('resClose').click());
      }
    }
    assert.equal(await h.none('opt', 50), true, 'looking changed nothing');
    assert.deepEqual(p.errors, []);
    await p.ctx.close();
  }
});

test('results: with races still to run the lobby takes a second tap, which a double tap is not; with nothing to lose it takes one', { skip: !hasBrowser && 'no chromium', timeout: 60000 }, async (t) => {
  const { srv, h } = await room(t);
  const p = await phone(srv, { width: 667, height: 375 });
  const advance = { turn: 5, mine: false, ready: 0, of: 2, kind: 'rematch', more: false, next: 'bran' };
  h.send({ t: 'phase', slot: p.slot, phase: 'results' });
  h.send({ t: 'menu', slot: p.slot, edit: true, advance });
  await p.page.waitForFunction(() => window.__pad.screen === 'sResults' && window.__pad.menu.advance && !document.getElementById('resNext').classList.contains('held'));
  const opened = async () => { await tapEl(p, '#resMoreBtn'); await p.page.locator('#resLobby').waitFor({ state: 'visible' }); };
  const text = () => p.page.textContent('#resLobby');
  await opened();
  assert.equal(await text(), 'Back to the lobby');
  // a double tap, as fast as a thumb
  const fast = await p.page.evaluate(() => { const b = document.getElementById('resLobby'); b.click(); const first = b.textContent; b.click(); return first; });
  assert.notEqual(fast, 'Back to the lobby', 'the first tap asks again');
  assert.equal(await h.none('opt', 150), true, 'the second tap of a double tap counts for nothing');
  // left alone, the question goes away
  await p.page.waitForFunction(() => document.getElementById('resLobby').textContent === 'Back to the lobby', null, { timeout: 8000, polling: 50 });
  assert.equal(await h.none('opt', 50), true, 'nor does asking go anywhere by itself');
  // so does closing the choices: opening them again asks from the start
  await tapEl(p, '#resLobby');
  assert.notEqual(await text(), 'Back to the lobby');
  await tapEl(p, '#resClose');
  await opened();
  assert.equal(await text(), 'Back to the lobby');
  // a new screen too
  await tapEl(p, '#resLobby');
  h.send({ t: 'menu', slot: p.slot, advance: { ...advance, turn: 6 } });
  await p.page.waitForFunction(() => window.__pad.menu.advance.turn === 6 && !document.getElementById('resNext').classList.contains('held'));
  await opened();
  assert.equal(await text(), 'Back to the lobby');
  // the positive case: two deliberate taps go
  await tapEl(p, '#resLobby');
  assert.equal(await h.none('opt', 700), true);
  await tapEl(p, '#resLobby');
  assert.deepEqual(await h.next('opt', 2000), { t: 'opt', slot: p.slot, next: 'lobby', turn: 6 });
  // the last race is run: one tap, nothing is lost
  await tapEl(p, '#resClose');
  h.send({ t: 'menu', slot: p.slot, advance: { ...advance, turn: 7, more: true, kind: 'podium', next: undefined } });
  await p.page.waitForFunction(() => window.__pad.menu.advance.turn === 7 && !document.getElementById('resNext').classList.contains('held'));
  await opened();
  await tapEl(p, '#resLobby');
  assert.deepEqual(await h.next('opt', 2000), { t: 'opt', slot: p.slot, next: 'lobby', turn: 7 });
  // the lobby comes up under that same finger: its second tap chooses nothing, and a tap that means it does
  h.send({ t: 'menu', slot: p.slot, opts: { difficulty: 'normal', bots: 3, laps: 3, mode: 'race' }, edit: true });
  h.send({ t: 'phase', slot: p.slot, phase: 'lobby' });
  const asThumb = await p.page.waitForFunction(() => {
    if (window.__pad.screen !== 'sLobby') return false;
    document.querySelector('.seg[data-key="mode"] button[data-v="gp"]').click();
    document.getElementById('goBtn').click();
    return true;
  }, null, { polling: 5 });
  assert.equal(await asThumb.jsonValue(), true);
  assert.equal(await h.none('opt', 150), true, 'no option changed, nobody started');
  await p.page.waitForTimeout(500);
  await p.page.locator('.seg[data-key="mode"] button[data-v="gp"]').tap();
  assert.deepEqual(await h.next('opt', 2000), { t: 'opt', slot: p.slot, mode: 'gp' });
  assert.deepEqual(p.errors, []);
  await p.ctx.close();
});

// What the eye checks on the screenshots, measured: nothing below 13 px, nothing off screen, nothing on top of
// something else, on every screen, in both languages, at both orientations and on smaller phones.
const LAYOUT = () => {
  // a guest's chips only say what was chosen: no finger needs them
  const TARGET_EXCEPT = ['.seg.ro button'];
  const shown = (el) => el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
  const small = [];
  const walk = (el) => {
    if (!shown(el)) return;
    for (const n of el.childNodes) {
      if (n.nodeType === 3 && n.textContent.trim() && parseFloat(getComputedStyle(el).fontSize) < 13) small.push(`${n.textContent.trim()} ${getComputedStyle(el).fontSize}`);
    }
    for (const c of el.children) if (!['SCRIPT', 'STYLE'].includes(c.tagName) && c.id !== 'scene') walk(c);
  };
  walk(document.body);
  const boxes = [];
  const box = (sel) => {
    for (const el of document.querySelectorAll(sel)) {
      if (!shown(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width && r.height) boxes.push({ sel, l: r.left, t: r.top, r: r.right, b: r.bottom });
    }
  };
  for (const sel of ['#wxVote', '#top .chip', '#lang', '#net', '#item', '#drift', '#base', '#hud', '#hint', '#hintDrift', '#hintItem', '#upTag', '#optCard', '#goBtn', '#goWait', '#steerBox', '#recenter', '#readyBtn', '#voteBtn', '.ttl', '#resPlace', '#resTime', '#resTeam', '#resUnlock', '#resNext', '#resClose', '#resMoreBtn', '#resBtns button', '#resWait', '#gpGoBtn', '.kc.on', '.tc.on', '.dots']) box(sel);
  const off = boxes.filter((b) => b.l < -0.5 || b.t < -0.5 || b.r > innerWidth + 0.5 || b.b > innerHeight + 0.5).map((b) => b.sel);
  const overlaps = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      // the two round buttons nest: what counts is the circles, with their lip
      if (a.sel === '#item' && b.sel === '#drift') {
        const d = Math.hypot((a.l + a.r - b.l - b.r) / 2, (a.t + a.b - b.t - b.b) / 2);
        if (d < (a.r - a.l + b.r - b.l) / 2 + 6) overlaps.push(`circles ${a.sel} x ${b.sel} ${d}`);
        continue;
      }
      if (Math.min(a.r, b.r) - Math.max(a.l, b.l) > 1 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 1) overlaps.push(`${a.sel} x ${b.sel}`);
    }
  }
  // text must fit inside its card
  const spill = [];
  for (const el of document.querySelectorAll('.kc.on .nm, .kc.on .dr, .kc.on .bars span, .seg, .seg button, .tc.on .nm, #resBtns button, #resClose')) {
    if (shown(el) && (el.scrollWidth > el.clientWidth + 1)) spill.push(el.textContent);
  }
  const nameEl = document.getElementById('itemName'), itemBox = document.getElementById('item');
  if (shown(itemBox) && nameEl.textContent) {
    const rng = document.createRange(); rng.selectNodeContents(nameEl);
    const w = rng.getBoundingClientRect().width, paper = itemBox.getBoundingClientRect().width * 0.86;
    if (w > paper) spill.push(`item name ${nameEl.textContent} ${Math.round(w)} > ${Math.round(paper)}`);
  }
  const card = document.querySelector('.kc.on .info');
  if (card && shown(card) && card.scrollHeight > card.clientHeight + 1) spill.push(`kart info ${card.scrollHeight} > ${card.clientHeight}`);
  const opts = document.getElementById('optCard');
  // the one exception: a phone under 380 px on its side or 640 px upright scrolls the card, and every row can be reached
  const scrolls = (innerWidth > innerHeight ? innerHeight <= 380 : innerHeight <= 640) && getComputedStyle(opts).overflowY === 'auto';
  if (shown(opts) && opts.scrollHeight > opts.clientHeight + 1 && !scrolls) spill.push(`options ${opts.scrollHeight} > ${opts.clientHeight}`);
  if (shown(opts) && scrolls) {
    const keep = opts.scrollTop;
    opts.scrollTop = 1e6;
    const last = [...opts.querySelectorAll('.opt')].filter(shown).pop()?.getBoundingClientRect(), c = opts.getBoundingClientRect();
    if (last && last.bottom > c.bottom + 1) spill.push(`options: the last row stays ${last.bottom - c.bottom} px out of reach`);
    opts.scrollTop = keep;
  }
  // every button a thumb can reach is a target of 40 px at least, or it is named here with its reason
  const tiny = [];
  for (const el of document.querySelectorAll('button')) {
    if (!shown(el) || TARGET_EXCEPT.some((q) => el.matches(q))) continue;
    const r = el.getBoundingClientRect();
    if (r.right <= 0 || r.bottom <= 0 || r.left >= innerWidth || r.top >= innerHeight) continue; // a carousel's card waiting off screen
    if (r.width < 40 - 0.5 || r.height < 40 - 0.5) tiny.push(`${el.id || el.closest('[data-key]')?.dataset.key || el.className || el.textContent} ${Math.round(r.width)}x${Math.round(r.height)}`);
  }
  return { small, off, overlaps, spill, tiny };
};

test('every screen fits: text at least 13 px, no overlap, nothing off screen, both orientations and small phones', { skip: !hasBrowser && 'no chromium' }, async (t) => {
  const { srv, h } = await room(t, { reserveMs: 20 });
  const shots = process.env.SHOTS;
  const saved = new Set(['landscape', 'portrait']);
  const combos = [];
  for (const [name, width, height] of [...SIZES, ['s', 667, 375], ['xs', 568, 320], ['xn', 320, 568], ['n360', 360, 780], ['tall', 412, 915], ['tablet', 1024, 768]]) {
    combos.push([name, width, height, 'it-IT']);
    if (saved.has(name) || name === 'xs' || name === 'xn') combos.push([name, width, height, 'en-US']);
  }
  let turn = 0;
  const tooSmall = [];
  for (const [name, width, height, locale] of combos) {
    {
      // each turn another colour, and a guest's lobby when it is not slot 0
      const others = [];
      for (let k = 0; k < turn % 4; k++) { const o = await pad(srv, `other${k}`); await o.next('welcome'); others.push(o); }
      turn++;
      const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, locale });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(`${srv.base}/pad`);
      await page.waitForFunction(() => window.__pad?.joined);
      const slot = await page.evaluate(() => window.__pad.slot);
      let sent = 0;
      const rx0 = await page.evaluate(() => window.__padRx || 0);
      const say = (m) => { sent++; h.send({ ...m, slot }); };
      // not a fixed wait: what was sent has arrived, then two reads in a row find every box where it was
      const settled = async () => {
        await page.waitForFunction((n) => (window.__padRx || 0) >= n, rx0 + sent, { timeout: 5000, polling: 20 }).catch(() => {});
        return page.evaluate(async () => {
          // the transitions and one-off animations under way run to their end first: two equal reads alone also come from a
          // page whose frames are late (the timeline stands still), and caught a card at the start of its slide
          const moving = document.getAnimations().filter((a) => a.playState === 'running' && a.effect?.getTiming().iterations !== Infinity);
          await Promise.race([Promise.all(moving.map((a) => a.finished.catch(() => {}))), new Promise((res) => setTimeout(res, 2500))]);
          // every box the layout check looks at, the card that pops included, is where it was on two reads in a row
          const read = () => JSON.stringify([...document.querySelectorAll('button, .sticker, .ttl, .tc.on, .kc.on, #hud, #item, #drift, #base')].filter((el) => el.checkVisibility()).map((el) => { const q = el.getBoundingClientRect(); return [q.left, q.top, q.width, q.height].map(Math.round); }));
          let last = read(), calm = 0;
          for (const t0 = performance.now(); calm < 2 && performance.now() - t0 < 2500;) { await new Promise((res) => setTimeout(res, 90)); const now = read(); calm = now === last ? calm + 1 : 0; last = now; }
          return calm >= 2;
        });
      };
      const check = async (screen) => {
        const calm = await settled();
        const r = await page.evaluate(LAYOUT);
        const where = `${name} ${locale} ${screen}`;
        if (!calm) t.diagnostic(`${where}: still moving after 2.5 s`);
        for (const x of r.tiny) tooSmall.push(`${where}: ${x}`);
        assert.deepEqual(r.small, [], `${where}: text below 13 px`);
        assert.deepEqual(r.off, [], `${where}: off screen`);
        assert.deepEqual(r.overlaps, [], `${where}: overlaps`);
        assert.deepEqual(r.spill, [], `${where}: text spills`);
        if (shots && saved.has(name) && locale === 'it-IT') await page.screenshot({ path: join(shots, `pad-${screen}-${name === 'landscape' ? '844x390' : '390x844'}.png`) });
      };
      say({ t: 'phase', phase: 'race' });
      say({ t: 'hud', place: 2, lap: 2, laps: 3, item: null, charges: 0, boost: false });
      await check('race');
      say({ t: 'hud', place: 8, lap: 3, laps: 5, item: 'zuica', charges: 3, boost: false });
      await check('race-item');
      say({ t: 'hud', place: 8, lap: 3, laps: 5, item: 'uova', charges: 1, boost: true });
      await check('race-boost');
      say({ t: 'hud', place: 8, lap: 3, laps: 5, item: 'formaggio', charges: 1, boost: false });
      await check('race-aim');
      say({ t: 'hud', place: 8, lap: 3, laps: 5, item: null, charges: 0, boost: false, auto: true });
      await check('race-autopilot');
      assert.ok(await page.evaluate(() => { const e = document.getElementById('autoTag'); return !e.classList.contains('hide') && e.textContent.length > 5; }), 'the phone says the autopilot took over');
      say({ t: 'hud', place: 1, lap: 3, laps: 5, item: null, charges: 0, boost: false });
      say({ t: 'fx', kind: 'roulette', item: 'mici', ms: 700 });
      await check('race-roulette');
      await sleep(400);
      say({ t: 'phase', phase: 'lobby' });
      say({ t: 'menu', opts: { difficulty: 'hard', bots: 7, laps: 3, mode: 'gp' }, edit: true });
      await check('lobby');
      say({ t: 'menu', edit: false });
      if (slot !== 0) await check('lobby-guest');
      say({ t: 'phase', phase: 'pick' });
      say({ t: 'menu', others: [{ slot: 1, kart: 'tabia', ready: true }, { slot: 2, kart: 'tabia', ready: false }, { slot: 3, kart: 'tabia', ready: false }] });
      await check('kart');
      // the kart with the longest name, the longest driver line
      for (const id of ['gatto', 'mocanita', 'jukung']) {
        say({ t: 'menu', kart: id });
        await sleep(350);
        const longest = await page.evaluate(LAYOUT);
        assert.deepEqual(longest.spill, [], `${name} ${locale} kart ${id}`);
      }
      say({ t: 'menu', ready: true });
      await check('kart-ready');
      say({ t: 'phase', phase: 'vote' });
      say({ t: 'menu', others: [{ slot: 1, track: 'antelao', lock: true }] });
      await check('track');
      // the sky's two buttons, for whoever holds the options
      say({ t: 'menu', edit: true, weather: 'surprise', night: true });
      await check('track-sky');
      assert.ok(await page.evaluate(() => { const w = document.getElementById('wxVote'); return w.checkVisibility() && document.getElementById('wxCycle').checkVisibility() && document.getElementById('wxNight').checkVisibility(); }), `${name} ${locale}: the sky buttons show`);
      say({ t: 'menu', spin: 'transfagarasan', pick: 'transfagarasan', landed: true });
      await check('track-verdict');
      say({ t: 'menu', edit: true, weather: 'clear', night: false, spin: null, pick: null, landed: false, gp: { list: ['bali'], races: 3 } });
      await check('track-gp');
      assert.ok(await page.evaluate(() => document.getElementById('gpGoBtn').checkVisibility()), `${name} ${locale}: a Gran Premio can start from here`);
      say({ t: 'menu', edit: false });
      await check('track-gp-guest');
      say({ t: 'phase', phase: 'results' });
      const advance = { turn: 7, mine: false, ready: 1, of: 2, kind: 'rematch', more: true, next: 'transfagarasan' };
      say({ t: 'menu', place: 2, time: 187.4, edit: true, advance });
      await check('results');
      // the big button and the corner one: a thumb on one does not touch the other
      const gap = await page.evaluate(() => { const a = document.getElementById('resNext').getBoundingClientRect(), b = document.getElementById('resMoreBtn').getBoundingClientRect(); return Math.max(a.left - b.right, b.left - a.right, a.top - b.bottom, b.top - a.bottom); });
      assert.ok(gap >= 24, `${name} ${locale}: ${gap} px between Continue and More`);
      // everything the screen can hold at once: a team score at the end and a family kart won
      say({ t: 'menu', team: 'a', score: { a: 18, b: 14 }, won: 'a', unlocked: 'baileys' });
      await check('results-full');
      say({ t: 'menu', team: null, score: null, won: null, unlocked: null, advance: { ...advance, mine: true } });
      await check('results-waiting');
      assert.ok(await page.evaluate(() => { document.getElementById('resMoreBtn').click(); return document.getElementById('resLobby').checkVisibility(); }), `${name} ${locale}: the choices open`);
      await check('results-more');
      await page.evaluate(() => document.getElementById('resClose').click());
      say({ t: 'menu', edit: false });
      await check('results-guest');
      assert.deepEqual(errors, []);
      await ctx.close();
      await Promise.all(others.map((o) => o.close()));
      await sleep(80);
    }
  }
  assert.deepEqual(tooSmall, [], 'targets under 40 px');
});

test('a phone too low for seven rows scrolls the card under a thumb, and nothing else moves', { skip: !hasBrowser && 'no chromium' }, async (t) => {
  const { srv, h } = await room(t, { reserveMs: 20 });
  const ctx = await browser.newContext({ viewport: { width: 568, height: 320 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, locale: 'it-IT' });
  t.after(() => ctx.close());
  const page = await ctx.newPage();
  await page.goto(`${srv.base}/pad`);
  await page.waitForFunction(() => window.__pad?.joined);
  const slot = await page.evaluate(() => window.__pad.slot);
  h.send({ t: 'phase', phase: 'lobby', slot });
  h.send({ t: 'menu', opts: { difficulty: 'hard', bots: 7, laps: 3, mode: 'gp' }, edit: true, slot });
  await page.waitForFunction(() => { const o = document.getElementById('optCard'); return o.checkVisibility() && o.scrollHeight > o.clientHeight + 20; });
  const cdp = await ctx.newCDPSession(page);
  const box = await page.locator('#optCard').boundingBox();
  await cdp.send('Input.synthesizeScrollGesture', { x: box.x + box.width / 2, y: box.y + box.height / 2, yDistance: -80, gestureSourceType: 'touch', speed: 800 });
  const card = await page.evaluate(() => ({ top: document.getElementById('optCard').scrollTop, page: scrollY }));
  assert.ok(card.top > 20, `the card moved ${card.top} px`);
  assert.equal(card.page, 0);
  // and a swipe outside the card moves nothing
  const go = await page.locator('#goSide').boundingBox();
  await cdp.send('Input.synthesizeScrollGesture', { x: go.x + go.width / 2, y: go.y + go.height / 2, yDistance: -80, gestureSourceType: 'touch', speed: 800 });
  assert.deepEqual(await page.evaluate(() => [scrollX, scrollY, document.body.scrollTop]), [0, 0, 0]);
});

test('the strings: Italian and English match, with the accents, no em dash', () => {
  assert.deepEqual(Object.keys(itDict).sort(), Object.keys(en).sort());
  for (const [k, v] of Object.entries(itDict)) {
    assert.doesNotMatch(v, /\u2014/, k);
    assert.equal((v.match(/\{\w+\}/g) || []).sort().join(), (en[k].match(/\{\w+\}/g) || []).sort().join(), k);
  }
  assert.equal(itDict['pad.difficulty'], 'Difficoltà');
  assert.equal(itDict['item.zuica'], 'Țuică');
});
