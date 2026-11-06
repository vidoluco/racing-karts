// What the evening must survive on the TV, on the real page and the real server process: a reload in mid-race, a server
// restart with four phones attached, a runtime error in the race, a lost GPU context. Each ends in a state someone can read.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launch, headlessShell, buildDist, startServerProcess, openPad, freePort } from '../tools/harness.mjs';
import { en } from '../src/i18n/en.js';

const skip = headlessShell() ? false : 'no browser';
let dist, browser;
after(async () => { await browser?.close(); if (dist) rmSync(dist, { recursive: true, force: true }); });
async function prepare() {
  if (browser) return;
  dist = mkdtempSync(join(tmpdir(), 'rk-recovery-'));
  await buildDist(dist);
  browser = await launch('metal').catch(() => launch('swiftshader'));
}
async function tvPage(t, url, init = null) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'en-US' });
  t.after(() => ctx.close().catch(() => {}));
  const tv = await ctx.newPage();
  if (init) await tv.addInitScript(init);
  await tv.goto(url);
  return { ctx, tv };
}
const card = (tv) => tv.evaluate(() => {
  const e = document.querySelector('.errcard');
  if (!e || e.classList.contains('hide')) return null;
  const r = e.getBoundingClientRect();
  return { text: e.querySelector('p').textContent, visible: r.width > 100 && r.height > 40 && r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight };
});
const toRace = async (tv) => {
  await tv.evaluate(() => { const f = window.__game.flowApi; f.setOpts({ bots: 0, laps: 2 }); f.go(); });
  await tv.waitForFunction(() => window.__game.phase === 'pick');
  await tv.evaluate(() => {
    const f = window.__game.flowApi;
    const list = f.menuFor(0).karts;
    f.seats.forEach((s, i) => { if (s.present) f.pick(i, list[i].id ?? list[i], true); });
  });
  await tv.waitForFunction(() => window.__game.phase === 'vote', null, { timeout: 30000 });
  await tv.evaluate(() => { const f = window.__game.flowApi; f.seats.forEach((s, i) => { if (s.present) f.vote(i, 'antelao', true); }); });
  await tv.waitForFunction(() => window.__game.phase === 'race' && window.__game.state, null, { timeout: 120000 });
};
const allBack = (pads, phase) => Promise.all(pads.map((p) => p.page.waitForFunction((q) => window.__pad.joined && window.__pad.phase === q, phase, { timeout: 30000 })));

test('four phones: a TV reload in mid-race and a server restart both end in the lobby, with every phone seated and told', { skip, timeout: 420000 }, async (t) => {
  await prepare();
  const port = await freePort();
  let srv = await startServerProcess({ port, dist });
  t.after(() => srv.close());
  // keeps the page's sockets at hand, to drop the TV's own for a moment
  const keepSockets = () => { const W = window.WebSocket; window.__ws = []; window.WebSocket = class extends W { constructor(...a) { super(...a); window.__ws.push(this); } }; };
  const { tv } = await tvPage(t, `${srv.base}/?lang=en`, keepSockets);
  const pads = [];
  t.after(async () => { for (const p of pads) await p.ctx.close().catch(() => {}); });
  for (let i = 0; i < 4; i++) { const p = await openPad(browser, srv.base, { label: `pad${i}` }); assert.equal(p.slot, i); pads.push(p); }
  await tv.waitForFunction(() => window.__game.seats?.filter((s) => s.present).length === 4, null, { timeout: 30000 });

  await toRace(tv);
  await allBack(pads, 'race');

  // the TV loses the server for a moment, and the server is the same one: the race goes on
  await tv.evaluate(() => window.__ws.at(-1).close());
  await tv.waitForFunction(() => !window.__game.pads[0], null, { timeout: 15000 });
  await tv.waitForFunction(() => window.__game.pads.every(Boolean), null, { timeout: 30000 });
  assert.equal(await tv.evaluate(() => window.__game.phase), 'race', 'a blip is not a restart');

  // TV reload in mid-race: a clear return to the lobby on both sides, the seats as they were
  await tv.reload();
  await tv.waitForFunction(() => window.__game?.phase === 'lobby' && window.__game.seats?.filter((s) => s.present).length === 4, null, { timeout: 30000 });
  await allBack(pads, 'lobby');
  assert.deepEqual(await Promise.all(pads.map((p) => p.page.evaluate(() => window.__pad.slot))), [0, 1, 2, 3], 'the phones keep their seats');
  assert.equal(await tv.evaluate(() => window.__game.error), null);

  // server restart with the race on and four phones attached
  await toRace(tv);
  await allBack(pads, 'race');
  await srv.close();
  await tv.waitForFunction(() => !window.__game.pads[0], null, { timeout: 15000 });
  srv = await startServerProcess({ port, dist });
  await tv.waitForFunction(() => window.__game.phase === 'lobby' && window.__game.pads.every(Boolean), null, { timeout: 45000 });
  await allBack(pads, 'lobby');
  const slots = await Promise.all(pads.map((p) => p.page.evaluate(() => window.__pad.slot)));
  assert.deepEqual([...slots].sort(), [0, 1, 2, 3], `each phone has a seat of its own: ${slots}`);
  const toast = await tv.evaluate(() => document.querySelector('.toasts')?.textContent || '');
  assert.ok(toast.includes(en['err.restart']), `the TV says why: "${toast}"`);
  const seats = await tv.evaluate(() => window.__game.seats.map((s) => ({ present: s.present, away: s.away, kart: s.kart })));
  assert.ok(seats.every((s) => s.present && !s.away && !s.kart), `nothing kept from before: ${JSON.stringify(seats)}`);
  assert.equal(await tv.evaluate(() => window.__game.error), null);
  // and the evening goes on: the next race starts
  await toRace(tv);
  await allBack(pads, 'race');
});

test('slot 0 gone at the results: the next phone gets working buttons and a real tap goes on, a third still waits', { skip, timeout: 300000 }, async (t) => {
  await prepare();
  const srv = await startServerProcess({ dist });
  t.after(() => srv.close());
  const { tv } = await tvPage(t, `${srv.base}/?lang=en`);
  const pads = [];
  t.after(async () => { for (const p of pads) await p.ctx.close().catch(() => {}); });
  for (let i = 0; i < 3; i++) pads.push(await openPad(browser, srv.base, { label: `pad${i}` }));
  await tv.waitForFunction(() => window.__game.seats?.filter((s) => s.present).length === 3, null, { timeout: 30000 });
  await toRace(tv);
  await tv.evaluate(() => { const g = window.__game; g.skipFlyover(); g.setAuto(true); g.speed = 6; });
  await tv.waitForFunction(() => window.__game.phase === 'results', null, { timeout: 200000 });
  const [a, b, c] = pads;
  await Promise.all(pads.map((p) => p.page.waitForFunction(() => window.__pad.screen === 'sResults', null, { timeout: 10000 })));
  assert.equal(await a.page.locator('#resMoreBtn').isVisible(), true, 'slot 0 has the other ways out');
  assert.equal(await b.page.locator('#resMoreBtn').isVisible(), false, 'with slot 0 here, slot 1 has Continue alone');
  await a.ctx.close();
  await b.page.locator('#resMoreBtn').waitFor({ state: 'visible', timeout: 12000 });
  assert.equal(await c.page.locator('#resMoreBtn').isVisible(), false, 'slot 2 is not the lowest');
  assert.equal(await c.page.locator('#resNext').isVisible(), true);
  await b.page.waitForFunction(() => !document.getElementById('resNext').classList.contains('held')); // a new screen takes no choice for its first moment
  await b.page.locator('#resMoreBtn').tap();
  await b.page.locator('#resTrack').tap();
  await tv.waitForFunction(() => window.__game.phase === 'vote', null, { timeout: 8000 });
  assert.equal(await tv.evaluate(() => window.__game.error), null);
});

test('a runtime error in the race: a message on the TV, not a frozen picture', { skip, timeout: 180000 }, async (t) => {
  await prepare();
  const srv = await startServerProcess({ dist });
  t.after(() => srv.close());
  const { tv } = await tvPage(t, `${srv.base}/?lang=en&track=antelao&flyover=0&players=1&bots=0&countdown=0`);
  await tv.waitForFunction(() => window.__game.state?.phase === 'race', null, { timeout: 120000 });
  const frames = await tv.evaluate(() => window.__game.frames);
  await tv.waitForFunction((f) => window.__game.frames > f + 5, frames);
  assert.equal(await card(tv), null, 'a healthy race shows nothing');
  assert.equal(await tv.evaluate(() => window.__game.error), null);

  await tv.evaluate(() => window.__game.setScript(() => { throw new Error('boom in the race'); }));
  await tv.waitForFunction(() => window.__game.error);
  const c = await card(tv);
  assert.equal(c?.text, en['err.runtime']);
  assert.equal(c.visible, true, 'on the screen');
  assert.match(await tv.evaluate(() => window.__game.error), /boom in the race/);
  // the throw keeps coming, the message stays and nothing floods
  const n = await tv.evaluate(() => window.__game.frames);
  await tv.waitForFunction((f) => window.__game.frames > f + 10, n);
  assert.equal((await card(tv))?.text, en['err.runtime']);
});

test('a lost GPU context: a message while it is gone, the picture back when it returns', { skip, timeout: 180000 }, async (t) => {
  await prepare();
  const srv = await startServerProcess({ dist });
  t.after(() => srv.close());
  const { tv } = await tvPage(t, `${srv.base}/?lang=en&track=antelao&flyover=0&players=1&bots=0&countdown=0`);
  await tv.waitForFunction(() => window.__game.state?.phase === 'race', null, { timeout: 120000 });
  // How much of a picture there is: the distinct colours on a coarse grid of the canvas, just after a draw.
  const colours = () => tv.evaluate(() => {
    window.__game.draw();
    const src = document.getElementById('game');
    const c = document.createElement('canvas'); c.width = 64; c.height = 36;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(src, 0, 0, 64, 36);
    const d = g.getImageData(0, 0, 64, 36).data, set = new Set();
    for (let i = 0; i < d.length; i += 4) set.add((d[i] >> 3) << 10 | (d[i + 1] >> 3) << 5 | d[i + 2] >> 3);
    return set.size;
  });
  const healthy = await colours();
  assert.ok(healthy > 30, `a real picture before: ${healthy} colours`);
  assert.equal(await card(tv), null);

  await tv.evaluate(() => {
    const gl = document.getElementById('game').getContext('webgl2');
    window.__lose = gl.getExtension('WEBGL_lose_context');
    window.__lose.loseContext();
  });
  await tv.waitForFunction(() => window.__game.gpuLost === true, null, { timeout: 10000 });
  const c = await card(tv);
  assert.equal(c?.text, en['err.gpu']);
  assert.equal(c.visible, true);
  const during = await tv.evaluate(() => window.__game.frames);
  await tv.waitForFunction((f) => window.__game.frames > f + 10, during);
  assert.equal(await tv.evaluate(() => window.__game.error), null, 'drawing with no context throws nothing');

  await tv.evaluate(() => window.__lose.restoreContext());
  await tv.waitForFunction(() => window.__game.gpuLost === false, null, { timeout: 15000 });
  assert.equal(await card(tv), null, 'the message goes');
  await tv.waitForTimeout(500);
  const back = await colours();
  t.diagnostic(`colours before ${healthy}, after the context came back ${back}`);
  assert.ok(back > healthy * 0.5, `the picture is back: ${back} colours against ${healthy}`);
  assert.equal(await tv.evaluate(() => window.__game.error), null);
});
