// The Mac changes network (Wi-Fi to the phone's hotspot). On the real server with an injected ifaces(), real sockets and,
// for the TV, the real page and the real /api/info. Nobody has a real phone here: the hotspot is SIMULATED, an iPhone or
// Android network has never carried these tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildDist, launch, headlessShell } from '../tools/harness.mjs';
import { startServer, host, pad, sleep } from '../server/testing.js';
import { lanAddress } from '../server/index.js';

const iface = (address) => [{ family: 'IPv4', address, internal: false }];
// The test's sockets really arrive on 127.0.0.1: here it plays the Wi-Fi address that goes away, so the server has real
// sockets on a vanished address. A real loopback address is internal and never counts.
const WIFI = { en0: iface('127.0.0.1') };
const IPHONE = { en0: iface('172.20.10.2') };
const OFF = 3600000; // no polling: whatever happens, happens because of the connection itself

const ids = (srv) => srv.room.status().slots.map((s) => s?.id ?? null);

async function seatFour(srv, names = ['old0', 'old1', 'old2', 'old3']) {
  const out = [];
  for (const [i, id] of names.entries()) {
    const p = await pad(srv, id);
    assert.equal((await p.next('welcome')).slot, i);
    out.push(p);
  }
  return out;
}

test('four pads connected, the Mac switches network: four new ids are seated at once, in the same order', async (t) => {
  let nets = WIFI;
  const srv = await startServer({ ifaces: () => nets, netPollMs: OFF });
  t.after(() => srv.close());
  const h = await host(srv);
  const old = await seatFour(srv);
  assert.equal(srv.urls().padUrl, `http://127.0.0.1:${srv.port}/pad`);

  nets = IPHONE;
  for (let i = 0; i < 4; i++) {
    const p = await pad(srv, `new${i}`);
    const first = await p.next();
    assert.equal(first.t, 'welcome', 'its first word is a seat, not "full"');
    assert.equal(first.slot, i);
  }
  assert.deepEqual(ids(srv), ['new0', 'new1', 'new2', 'new3']);
  assert.equal(srv.room.status().waiting, 0);
  assert.equal(srv.urls().padUrl, `http://172.20.10.2:${srv.port}/pad`, 'the address the QR is made of');
  const info = await (await fetch(`${srv.base}/api/info`)).json();
  assert.equal(info.padUrl, `http://172.20.10.2:${srv.port}/pad`);
  for (const p of old) await p.closed(); // the sockets on the address that went away are gone
  for (let s = 0; s < 4; s++) assert.ok(await h.next((m) => m.t === 'free' && m.slot === s), 'the TV hears each seat go');
});

test('the server notices by itself, with no phone connecting: dead sockets out, the TV told, the seats free', async (t) => {
  let nets = WIFI;
  const srv = await startServer({ ifaces: () => nets, netPollMs: 20 });
  t.after(() => srv.close());
  const h = await host(srv);
  const old = await seatFour(srv);
  await sleep(100);
  assert.deepEqual(ids(srv), ['old0', 'old1', 'old2', 'old3'], 'no change, no one is touched');
  nets = IPHONE;
  for (const p of old) await p.closed();
  assert.deepEqual(ids(srv), [null, null, null, null]);
  for (let s = 0; s < 4; s++) {
    assert.ok(await h.next((m) => m.t === 'leave' && m.slot === s));
    assert.ok(await h.next((m) => m.t === 'free' && m.slot === s));
  }
});

test('not a network change: a blip with no address, or the same address, keeps the seats', async (t) => {
  let nets = { en0: iface('192.168.0.107') };
  const srv = await startServer({ ifaces: () => nets, netPollMs: 10 });
  t.after(() => srv.close());
  const old = await seatFour(srv);
  await old[1].close();
  await sleep(30);
  assert.equal(srv.room.status().slots[1].connected, false);
  nets = {};
  await sleep(60);
  nets = { en0: iface('192.168.0.107') };
  await sleep(60);
  assert.deepEqual(ids(srv), ['old0', 'old1', 'old2', 'old3'], 'the seat stays reserved through the blip');
  const back = await pad(srv, 'old1');
  assert.equal((await back.next('welcome')).slot, 1, 'the same phone comes back to it');
});

test('a second network appears and the old one stays (USB tether): a live phone keeps its seat, only the absent one goes', async (t) => {
  let nets = WIFI;
  const srv = await startServer({ ifaces: () => nets, netPollMs: OFF });
  t.after(() => srv.close());
  const old = await seatFour(srv);
  await old[2].close();
  await sleep(30);
  nets = { en0: iface('127.0.0.1'), en7: iface('172.20.10.2') };
  const p = await pad(srv, 'new');
  assert.equal((await p.next('welcome')).slot, 2, 'the free seat, at once');
  assert.deepEqual(ids(srv), ['old0', 'old1', 'new', 'old3']);
  assert.ok(await old[0].none(() => true, 100), 'a phone on the network that stayed hears nothing');
});

test('a phone queued when the Mac moves takes the first free seat', async (t) => {
  // The queue keeps its order. Here the sockets stay alive, so that only the reservations are in play.
  const srv = await startServer({ netPollMs: OFF, reserveMs: OFF });
  t.after(() => srv.close());
  const old = await seatFour(srv);
  const q = [await pad(srv, 'q0'), await pad(srv, 'q1')];
  for (const p of q) assert.deepEqual(await p.next(), { t: 'full' });
  await old[3].close();
  await old[1].close();
  await sleep(30);
  assert.ok(await q[0].none('welcome', 50), 'seats in their grace: the queue waits');
  assert.equal(srv.room.releaseAway(), 2);
  assert.equal((await q[0].next('welcome')).slot, 1);
  assert.equal((await q[1].next('welcome')).slot, 3);
  assert.equal(srv.room.releaseAway(), 0, 'nothing left to free, connected seats are never touched');
});

test('every hotspot range is followed: iPhone, Android classic and Android random', async (t) => {
  for (const address of ['172.20.10.2', '192.168.43.77', '192.168.120.4', '10.97.3.12', '172.24.16.5']) {
    let nets = { en0: iface('192.168.0.107') };
    const srv = await startServer({ ifaces: () => nets, netPollMs: OFF });
    t.after(() => srv.close());
    const a = await pad(srv, 'a');
    await a.next('welcome');
    await a.close();
    nets = { en0: iface(address) };
    const info = await (await fetch(`${srv.base}/api/info`)).json();
    assert.equal(info.padUrl, `http://${address}:${srv.port}/pad`);
    assert.deepEqual(ids(srv), [null, null, null, null], `${address}: the seat is free`);
  }
  // with a wired LAN too, the hotspot is where the players are; a plain home router does not beat the wire by accident
  const none = {};
  assert.equal(lanAddress({ en0: iface('192.168.1.20'), en7: iface('192.168.43.77') }, none), '192.168.43.77');
  assert.equal(lanAddress({ en0: iface('192.168.1.20'), en7: iface('172.20.10.2') }, none), '172.20.10.2');
  assert.equal(lanAddress({ en0: iface('192.168.1.20'), en7: iface('192.168.8.3') }, none), '192.168.1.20');
});

// ---------- the TV ----------
const skip = headlessShell() ? false : 'no browser';
const qrOf = (tv, sel) => tv.evaluate((s) => document.querySelector(s)?.dataset.src || '', sel);
const urlIn = (addr, port) => encodeURIComponent(`http://${addr}:${port}/pad`);
const rejoinShown = (tv) => tv.evaluate(() => { const e = document.querySelector('.rejoin'); return !!e && !e.classList.contains('hide') && e.getBoundingClientRect().width > 50; });

test('the TV: the lobby QR follows the real /api/info, and in a race a missing seat brings the QR out', { skip, timeout: 240000 }, async (t) => {
  const dist = mkdtempSync(join(tmpdir(), 'rk-net-'));
  t.after(() => rmSync(dist, { recursive: true, force: true }));
  await buildDist(dist);
  let nets = { en0: iface('192.168.0.107') };
  const srv = await startServer({ distDir: dist, ifaces: () => nets, netPollMs: OFF });
  t.after(() => srv.close());
  const b = await launch('metal').catch(() => launch('swiftshader'));
  t.after(() => b.close());
  const tv = await (await b.newContext({ viewport: { width: 1280, height: 720 }, locale: 'en-US' })).newPage();
  const errors = [];
  tv.on('pageerror', (e) => errors.push(e.message));
  await tv.goto(`${srv.base}/?lang=en`);
  const port = srv.port;

  // the lobby: nothing changed, same picture; the Mac moved, the picture and the address in words follow
  await tv.waitForFunction((w) => document.querySelector('.qr img')?.dataset.src?.includes(w), urlIn('192.168.0.107', port), { timeout: 30000 });
  const before = await qrOf(tv, '.qr img');
  await tv.waitForTimeout(3300);
  assert.equal(await qrOf(tv, '.qr img'), before, 'no change, no new QR');
  nets = { en0: iface('192.168.43.77') };
  await tv.waitForFunction((w) => document.querySelector('.qr img')?.dataset.src?.includes(w), urlIn('192.168.43.77', port), { timeout: 8000 });
  assert.ok(!(await qrOf(tv, '.qr img')).includes(urlIn('192.168.0.107', port)), 'the old address is gone');
  assert.match(await tv.evaluate(() => document.body.innerText), /192\.168\.43\.77:\d+\/pad/);
  assert.equal(await rejoinShown(tv), false, 'in the lobby the big QR is enough');

  // four phones on 127.0.0.1 playing the Wi-Fi, and into a race
  nets = WIFI;
  await tv.evaluate(() => fetch('/api/info'));
  const old = await seatFour(srv);
  await tv.waitForFunction(() => window.__game.seats.filter((s) => s.present).length === 4);
  await tv.evaluate(() => { const f = window.__game.flowApi; f.setOpts({ bots: 0, laps: 2 }); f.go(); });
  await tv.waitForFunction(() => window.__game.phase === 'pick');
  await tv.evaluate(() => { const f = window.__game.flowApi; f.menuFor(0).karts.slice(0, 4).forEach((k, s) => f.pick(s, k.id ?? k, true)); });
  await tv.waitForFunction(() => window.__game.phase === 'vote', null, { timeout: 30000 });
  await tv.evaluate(() => { const f = window.__game.flowApi; for (let s = 0; s < 4; s++) f.vote(s, 'antelao', true); });
  await tv.waitForFunction(() => window.__game.phase === 'race' && window.__game.state, null, { timeout: 120000 });
  const karts = await tv.evaluate(() => window.__game.state.karts.filter((k) => k.human).map((k) => [k.slot, k.kart]));
  assert.equal(karts.length, 4);
  assert.equal(await rejoinShown(tv), false, 'all four seated: no QR on the race');

  nets = { en0: iface('172.20.10.2') };
  const lost = old.map((p) => p.closed());
  // the TV asks /api/info every 3 s, which is what notices here: polling is off in this test
  await Promise.all(lost);
  await tv.waitForFunction(() => { const e = document.querySelector('.rejoin'); return e && !e.classList.contains('hide'); }, null, { timeout: 8000 });
  await tv.waitForFunction((w) => document.querySelector('.rejoin img')?.dataset.src?.includes(w), urlIn('172.20.10.2', port), { timeout: 8000 });
  assert.equal(await rejoinShown(tv), true);
  const box = await tv.evaluate(() => { const r = document.querySelector('.rejoin img').getBoundingClientRect(); return { w: r.width, r: r.right, b: r.bottom, ok: document.querySelector('.rejoin img').naturalWidth > 0 }; });
  assert.ok(box.ok && box.w > 100 && box.r <= 1280 && box.b <= 720, `the QR is drawn and on screen: ${JSON.stringify(box)}`);

  for (let i = 0; i < 4; i++) {
    const p = await pad(srv, `new${i}`);
    assert.equal((await p.next()).slot, i);
    await tv.waitForFunction((s) => window.__game.pads[s], i, { timeout: 4000 });
    assert.equal(await rejoinShown(tv), i < 3, `the QR stays until the last seat is back (${i})`);
    if (i === 0) {
      // the new phone drives the kart of slot 0
      await tv.evaluate(() => { const g = window.__game; g.skipFlyover(); });
      await tv.waitForFunction(() => window.__game.state.phase === 'race', null, { timeout: 30000 });
      for (let seq = 1; seq < 12; seq++) { p.send({ t: 'in', x: -1, y: 1, b: 0, d: 0, seq }); await sleep(40); }
      await tv.waitForFunction(() => window.__game.state.karts.find((k) => k.human && k.slot === 0).steer < -0.5, null, { timeout: 4000 });
    }
  }
  assert.deepEqual(await tv.evaluate(() => window.__game.state.karts.filter((k) => k.human).map((k) => [k.slot, k.kart])), karts, 'same karts on the same seats');
  assert.deepEqual(errors, []);
});
