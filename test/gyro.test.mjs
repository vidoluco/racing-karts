// Steering by turning the phone: the numbers in node, the server's https address and its link on real sockets, the pad page
// in headless Chromium with a stubbed or emulated sensor. No real phone has run this: see docs/gyro-phone-test.md.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import https from 'node:https';
import tlsNet from 'node:tls';
import { build } from 'esbuild';
import WebSocket from 'ws';
import { launch, headlessShell, startServerProcess, freePort } from '../tools/harness.mjs';
import { startServer, host, sleep } from '../server/testing.js';
import { ensureCert, readCert, CERT_FILE } from '../server/tls.js';
import { upVector, rollDegrees, pickFrame, steerCurve, createTilt, screenAngle, FULL_LOCK, DEAD_ZONE } from '../controller/tilt.js';
import { mergeable } from '../controller/link.js';
import { en, it as itDict } from '../controller/i18n.js';
import { stickThrottle } from '../src/net/input.js';

const ROOT = new URL('..', import.meta.url).pathname;
const hasBrowser = !!headlessShell();
const PAD_ID = '11111111-2222-4333-8444-555555555555';
const tempDir = (t, name) => { const d = mkdtempSync(join(tmpdir(), `racing-karts-${name}-`)); t.after(() => rmSync(d, { recursive: true, force: true })); return d; };

// The DeviceOrientation angles of a phone on its side: side 90 has its top to the left, roll is degrees to the right,
// pitch 0 is the glass upright facing you and 90 lying flat, face up.
function pose(side, roll, pitch = 30) {
  const r = roll * Math.PI / 180, p = pitch * Math.PI / 180, s = side === 90 ? 1 : -1;
  const u = [s * Math.cos(r) * Math.cos(p), s * Math.sin(r), Math.cos(r) * Math.sin(p)];
  let beta = Math.asin(u[1]) * 180 / Math.PI, gamma = Math.atan2(-u[0], u[2]) * 180 / Math.PI;
  if (gamma >= 90) { gamma -= 180; beta = 180 - beta; } else if (gamma < -90) { gamma += 180; beta = 180 - beta; }
  if (beta >= 180) beta -= 360;
  return { beta, gamma };
}
const close = (a, b, eps = 0.5, what = '') => assert.ok(Math.abs(a - b) <= eps, `${what} ${a} is not ${b} within ${eps}`);

// ---------- the numbers ----------
test('the pose helper really is the sensor convention: beta and gamma give back the way up', () => {
  const { beta, gamma } = pose(90, 0, 0);
  assert.deepEqual(upVector(beta, gamma).map((v) => Math.round(v * 1000) / 1000 + 0), [1, 0, 0]);
  close(upVector(90, 0)[1], 1, 1e-9, 'held upright, the top of the phone is up');
  close(upVector(0, 0)[2], 1, 1e-9, 'flat on a table, the glass faces up');
});

test('the right end down is steering right, on both sides, whichever way up the phone came to the race', () => {
  for (const side of [90, 270]) {
    for (const roll of [-35, -10, 0, 10, 35]) {
      const { beta, gamma } = pose(side, roll);
      close(rollDegrees(upVector(beta, gamma), side), roll, 0.01, `side ${side}`);
    }
  }
});

test('pitch and how flat it is held do not move the steering', () => {
  for (const side of [90, 270]) {
    for (const roll of [-30, 0, 12]) {
      for (const pitch of [-20, 0, 15, 45, 70, 85]) {
        const { beta, gamma } = pose(side, roll, pitch);
        close(rollDegrees(upVector(beta, gamma), side), roll, 0.01, `side ${side} pitch ${pitch}`);
      }
    }
  }
});

test('the curve: a dead zone, small corrections stay small, the whole wheel at 35 to 45 degrees', () => {
  assert.ok(FULL_LOCK >= 35 && FULL_LOCK <= 45);
  assert.equal(steerCurve(0), 0);
  assert.equal(steerCurve(DEAD_ZONE), 0);
  assert.equal(steerCurve(-DEAD_ZONE), 0);
  assert.ok(steerCurve(DEAD_ZONE + 0.5) > 0, 'just past the dead zone it answers');
  assert.ok(steerCurve(5) < 0.08, `5 degrees is a correction, ${steerCurve(5)}`);
  assert.ok(steerCurve(10) < 0.2);
  assert.ok(steerCurve(30) > 0.5);
  close(steerCurve(FULL_LOCK), 1, 1e-9);
  assert.equal(steerCurve(70), 1);
  assert.equal(steerCurve(-70), -1);
  for (let d = 2; d < 40; d++) assert.ok(steerCurve(d + 1) > steerCurve(d), `rises at ${d}`);
  for (let d = 0; d < 60; d++) close(steerCurve(-d), -steerCurve(d), 1e-12);
});

test('smoothing: a turn of the wrist arrives in a few sensor frames, a shaky hand on a straight does not steer', () => {
  const tilt = createTilt();
  let ms = 0;
  const feed = (roll) => { ms += 16; return tilt.feed(pose(90, roll).beta, pose(90, roll).gamma, { angle: 90, t: ms }); };
  for (let i = 0; i < 20; i++) feed(0);
  // straight to full lock: most of it within 50 ms, all of it within 100 ms
  const steps = [];
  for (let i = 0; i < 6; i++) steps.push(feed(FULL_LOCK + 5));
  assert.ok(steps[2] > 0.7, `three frames in it is at ${steps[2]}`);
  assert.ok(steps[5] > 0.98, `six frames in it is at ${steps[5]}`);
  for (let i = 0; i < 30; i++) feed(0);
  let worst = 0;
  for (let i = 0; i < 200; i++) worst = Math.max(worst, Math.abs(feed(Math.sin(i * 2.1) * 0.8)));
  assert.equal(worst, 0, 'a tremor of under a degree stays in the dead zone');
});

test('centre: re-centring moves straight ahead, with a limit; at a race start it follows the settling hand, then stays', () => {
  const tilt = createTilt();
  let ms = 0;
  const feed = (roll, n = 12) => { let x; for (let i = 0; i < n; i++) { ms += 16; x = tilt.feed(pose(90, roll).beta, pose(90, roll).gamma, { angle: 90, t: ms }); } return x; };
  assert.ok(feed(10) > 0.05);
  tilt.recenter();
  close(feed(10), 0, 1e-9, 'where the hand is now is straight ahead');
  assert.ok(feed(25) > 0.1 && feed(-5) < -0.1, 'and it steers around that');
  feed(60);
  const before = tilt.centre;
  tilt.recenter();
  assert.equal(tilt.centre, before, 'a phone turned this far is not asking for this to be straight ahead');
  feed(0);

  tilt.follow(500, ms);
  assert.equal(feed(30), 0, 'nothing steers while it settles');
  feed(8);
  const held = tilt.centre;
  close(held, 8, 1.5, 'the last of the settling is the centre');
  ms += 600;
  close(feed(8), 0, 1e-9, 'after it, that is straight ahead');
  assert.ok(feed(30) > 0.3);
  assert.equal(tilt.following, false);

  tilt.follow(500, ms);
  feed(35); // waving it about at the start: no such centre
  assert.equal(Math.abs(tilt.centre) <= 20, true);
});

test('the phone flips: the sign follows gravity at once, even before the page turns, and the centre stays the player\'s', () => {
  const tilt = createTilt();
  let ms = 0;
  const feed = (side, roll, angle, n = 12) => { let x; for (let i = 0; i < n; i++) { ms += 16; x = tilt.feed(pose(side, roll).beta, pose(side, roll).gamma, { angle, t: ms }); } return x; };
  const right = feed(90, 25, 90);
  assert.ok(right > 0.2);
  close(feed(270, 25, 90), right, 1e-6, 'upside down, the page has not turned yet: still right');
  close(feed(270, 25, 270), right, 1e-6, 'and when it has');
  assert.ok(feed(270, -25, 270) < -0.2);
  assert.equal(tilt.frame, 270);

  // too flat for gravity to tell: the page's word
  const flat = createTilt();
  assert.ok(flat.feed(pose(270, 20, 89).beta, pose(270, 20, 89).gamma, { angle: 270, t: 16 }) > 0.1);
  assert.equal(flat.frame, 270);
});

test('a page stuck upright: a rotation lock is read from gravity, and a phone really upright turns like a wheel', () => {
  for (const side of [90, 270]) {
    const u = upVector(pose(side, 15, 10).beta, pose(side, 15, 10).gamma);
    const frame = pickFrame(u, 0, true, null);
    assert.equal(frame, side);
    close(rollDegrees(u, frame), 15, 0.01);
  }
  // upright, turned clockwise by 20 degrees: the top goes right, the way up leans towards the phone's left
  const a = 20 * Math.PI / 180, u = [-Math.sin(a), Math.cos(a), 0];
  const frame = pickFrame(u, 0, true, null);
  assert.equal(frame, 0);
  close(rollDegrees(u, frame), 20, 0.01);
  // no hopping between the two around 45 degrees
  const at45 = [-Math.sin(Math.PI / 4), Math.cos(Math.PI / 4), 0];
  assert.equal(pickFrame(at45, 0, true, 0), 0);
  assert.equal(pickFrame(at45, 0, true, 270), 270);
});

test('the page\'s angle: window.orientation first, screen.orientation otherwise', () => {
  assert.equal(screenAngle({ orientation: -90 }), 270);
  assert.equal(screenAngle({ orientation: 90, screen: { orientation: { angle: 270 } } }), 90);
  assert.equal(screenAngle({ screen: { orientation: { angle: 270 } } }), 270);
  assert.equal(screenAngle({}), 0);
});

test('the link keeps every press: only a newer position with the same buttons replaces one not sent yet', () => {
  const m = (x, b = 0, d = 0, seq = 1) => JSON.stringify({ t: 'in', x, y: 0, b, d, seq });
  assert.ok(mergeable(m(0.1), m(0.2)));
  assert.ok(!mergeable(m(0.1), m(0.2, 1)), 'an item press');
  assert.ok(!mergeable(m(0.1, 0, 1), m(0.2)), 'a drift let go');
  assert.ok(!mergeable(JSON.stringify({ t: 'ping', ts: 1 }), m(0.2)));
  assert.ok(!mergeable(JSON.stringify({ t: 'opt', go: true }), JSON.stringify({ t: 'opt', go: true })));
});

test('braking while turned: the wheel gives up just enough lock for the host to read a brake', () => {
  assert.ok(stickThrottle(0.69, -1) < 0);
  assert.equal(stickThrottle(1, -1), 0, 'which is why it has to');
});

// ---------- the certificate ----------
test('the certificate: made by openssl with the addresses, kept while it fits, made again when the address changes', async (t) => {
  const dir = tempDir(t, 'cert');
  const first = await ensureCert({ dir, must: '192.168.1.20', want: ['192.168.1.20', '10.0.0.7'] });
  assert.deepEqual(first.names.sort(), ['10.0.0.7', '127.0.0.1', '192.168.1.20']);
  const file = readFileSync(join(dir, CERT_FILE), 'utf8');
  assert.match(file, /PRIVATE KEY/);
  const again = await ensureCert({ dir, must: '192.168.1.20', want: ['192.168.1.20', '172.16.0.9'] });
  assert.equal(readFileSync(join(dir, CERT_FILE), 'utf8'), file, 'a Wi-Fi address it has: not a new warning for anybody');
  assert.equal(again.cert, first.cert);
  const moved = await ensureCert({ dir, must: '172.20.10.2', want: ['172.20.10.2'] });
  assert.notEqual(moved.cert, first.cert);
  assert.ok(moved.names.includes('172.20.10.2') && moved.names.includes('192.168.1.20'), `the hotspot, and home too: ${moved.names}`);
  assert.deepEqual((await readCert(dir)).names, moved.names);
  const soon = await ensureCert({ dir, must: '172.20.10.2', now: Date.now() + 390 * 86400000 });
  assert.notEqual(soon.cert, moved.cert, 'a month from its end it is renewed');
});

test('what iPhones insist on: SHA-256, RSA 2048, serverAuth, the names in subjectAltName, under 825 days', async (t) => {
  const dir = tempDir(t, 'cert');
  const pem = await ensureCert({ dir, must: '192.168.1.20' });
  const { execFileSync } = await import('node:child_process');
  const text = execFileSync('/usr/bin/openssl', ['x509', '-noout', '-text'], { input: pem.cert }).toString();
  assert.match(text, /sha256WithRSAEncryption/);
  assert.match(text, /2048 bit/);
  assert.match(text, /TLS Web Server Authentication/);
  assert.match(text, /IP Address:192\.168\.1\.20/);
  assert.match(text, /CA:FALSE/);
  const { X509Certificate } = await import('node:crypto');
  const x = new X509Certificate(pem.cert);
  assert.ok((new Date(x.validTo) - new Date(x.validFrom)) / 86400000 <= 825);
});

test('no openssl: one line in the log, http only, and the pad is told there is no https', async (t) => {
  const lines = [];
  const srv = await startServer({ tls: { dir: tempDir(t, 'cert'), port: 0, bins: ['/nonexistent/openssl'] }, log: (m) => lines.push(m) });
  t.after(() => srv.close());
  assert.equal(srv.tlsPort, null);
  assert.equal(lines.filter((l) => /openssl/.test(l)).length, 1);
  const info = await (await fetch(`${srv.base}/api/info`)).json();
  assert.equal(info.tlsPort, null);
  assert.equal(info.httpPort, srv.port);
  assert.equal((await fetch(`${srv.base}/pad`)).status, 200);
});

// ---------- the https address on real sockets ----------
const agent = new https.Agent({ rejectUnauthorized: false });
function httpsGet(port, path) {
  return new Promise((ok, fail) => {
    https.get({ host: '127.0.0.1', port, path, agent }, (res) => { let body = ''; res.on('data', (d) => { body += d; }); res.on('end', () => ok({ status: res.statusCode, body })); }).on('error', fail);
  });
}
function wssPad(port, id) {
  const ws = new WebSocket(`wss://127.0.0.1:${port}/ws?role=pad&id=${id}`, { rejectUnauthorized: false });
  const inbox = [];
  ws.on('message', (raw) => inbox.push(JSON.parse(raw.toString())));
  return { ws, inbox, open: () => new Promise((ok, fail) => { ws.once('open', ok); ws.once('error', fail); }) };
}
// A link pad as the page's EventSource and fetch would be: one long response, POSTs up.
function linkPad(port, id) {
  const inbox = [];
  const p = { inbox, sid: null, code: null, closed: false, send: null };
  const req = https.get({ host: '127.0.0.1', port, path: `/link/down?id=${id}`, agent: false, rejectUnauthorized: false }, (res) => {
    let buf = '';
    res.on('data', (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const chunk = buf.slice(0, i);
        buf = buf.slice(i + 2);
        const ev = /^event: (.*)$/m.exec(chunk)?.[1];
        const data = /^data: (.*)$/m.exec(chunk)?.[1];
        if (ev === 'link') p.sid = data;
        else if (ev === 'bye') p.code = Number(data);
        else if (data) inbox.push(JSON.parse(data));
      }
    });
    res.on('close', () => { p.closed = true; });
  });
  req.on('error', () => { p.closed = true; });
  p.destroy = () => req.destroy();
  p.post = (list) => new Promise((ok, fail) => {
    const r = https.request({ host: '127.0.0.1', port, path: `/link/up?sid=${p.sid}`, method: 'POST', agent, headers: { 'Content-Type': 'text/plain' } }, (res) => { res.resume(); res.on('end', () => ok(res.statusCode)); });
    r.on('error', fail);
    r.end(JSON.stringify(list));
  });
  p.until = async (pred, ms = 2000) => { for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(5)) { const m = inbox.find(pred); if (m) return m; } throw new Error('timeout'); };
  return p;
}
async function tlsRoom(t, opts = {}) {
  const srv = await startServer({ tls: { dir: tempDir(t, 'cert'), port: 0 }, ...opts });
  t.after(() => srv.close());
  const h = await host(srv);
  return { srv, h };
}

test('https: the same pages, and a pad on wss joins the very room the TV is in', async (t) => {
  const { srv, h } = await tlsRoom(t);
  assert.ok(srv.tlsPort > 0 && srv.tlsPort !== srv.port);
  assert.match((await httpsGet(srv.tlsPort, '/pad')).body, /pad/);
  const info = JSON.parse((await httpsGet(srv.tlsPort, '/api/info')).body);
  assert.equal(info.tlsPort, srv.tlsPort);
  assert.equal(info.httpPort, srv.port);
  const a = wssPad(srv.tlsPort, 'phoneA');
  await a.open();
  assert.equal((await h.next('join')).slot, 0);
  a.ws.send(JSON.stringify({ t: 'in', x: 0.5, y: 0, b: 0, d: 0, seq: 1 }));
  assert.equal((await h.next('in')).x, 0.5);
  t.after(() => a.ws.terminate());
});

test('an http seat keeps its id over wss and over the link: same slot, the old socket told to give way', async (t) => {
  const { srv, h } = await tlsRoom(t);
  const http0 = new WebSocket(`${srv.wsBase}?role=pad&id=seat0`);
  await new Promise((ok) => http0.once('open', ok));
  const closed = new Promise((ok) => http0.once('close', ok));
  await h.next('join');
  const a = wssPad(srv.tlsPort, 'seat0');
  await a.open();
  assert.equal(await closed, 4001);
  await h.next('join');
  assert.equal(srv.room.status().slots.filter(Boolean).length, 1);

  const l = linkPad(srv.tlsPort, 'seat0');
  t.after(() => l.destroy());
  assert.equal((await l.until((m) => m.t === 'welcome')).slot, 0);
  assert.equal(srv.room.status().slots.filter(Boolean).length, 1);
  a.ws.terminate();
});

test('the link: welcome first, inputs and pings in order up, host messages down, the same fields as a socket', async (t) => {
  const { srv, h } = await tlsRoom(t);
  const l = linkPad(srv.tlsPort, 'linked');
  t.after(() => l.destroy());
  const w = await l.until((m) => m.t === 'welcome');
  assert.equal(w.id, 'linked');
  assert.ok(l.sid);
  await h.next('join');
  assert.equal(await l.post([JSON.stringify({ t: 'ping', ts: 7 }), JSON.stringify({ t: 'in', x: -0.25, y: 0, b: 1, d: 0, seq: 1 }), JSON.stringify({ t: 'in', x: -0.5, y: 0, b: 0, d: 1, seq: 2 })]), 204);
  assert.equal((await l.until((m) => m.t === 'pong')).ts, 7);
  const one = await h.next('in'), two = await h.next('in');
  assert.deepEqual([one.x, one.b, two.x, two.d], [-0.25, 1, -0.5, 1]);
  h.send({ t: 'phase', phase: 'race', slot: 0 });
  assert.equal((await l.until((m) => m.t === 'phase')).phase, 'race');
  assert.equal(await l.post('not a list'), 400);
  const old = l.sid;
  l.destroy();
  await h.next('leave');
  assert.equal(srv.room.status().slots[0].connected, false, 'the seat is held like any other');
  const late = linkPad(srv.tlsPort, 'other');
  t.after(() => late.destroy());
  await late.until((m) => m.t === 'welcome');
  late.sid = old;
  assert.equal(await late.post([]), 410, 'a link that is gone says so');
});

test('the link: a pad gone silent is dropped by the same clock as a socket', async (t) => {
  const { srv, h } = await tlsRoom(t, { padSilentMs: 200, pingMs: 50 });
  const l = linkPad(srv.tlsPort, 'quiet');
  t.after(() => l.destroy());
  await l.until((m) => m.t === 'welcome');
  await h.next('join');
  await l.post([JSON.stringify({ t: 'ping', ts: 1 })]);
  await h.next('leave', 2000);
  assert.ok(await (async () => { for (let i = 0; i < 100 && !l.closed; i++) await sleep(10); return l.closed; })(), 'its response ends');
});

test('the Mac changes network: pads on wss and on the link on the old address are out, and the certificate carries the new one', async (t) => {
  let nets = { en0: [{ family: 'IPv4', address: '127.0.0.1', internal: false }] };
  const dir = tempDir(t, 'cert');
  const srv = await startServer({ tls: { dir, port: 0 }, ifaces: () => nets, netPollMs: 3600000 });
  t.after(() => srv.close());
  const h = await host(srv);
  const a = wssPad(srv.tlsPort, 'onWss');
  await a.open();
  const gone = new Promise((ok) => a.ws.once('close', ok));
  const l = linkPad(srv.tlsPort, 'onLink');
  t.after(() => l.destroy());
  await l.until((m) => m.t === 'welcome');
  assert.deepEqual((await readCert(dir)).names, ['127.0.0.1']);

  nets = { en0: [{ family: 'IPv4', address: '172.20.10.2', internal: false }] };
  await fetch(`${srv.base}/api/info`); // what notices it
  await gone;
  for (let i = 0; i < 300 && !l.closed; i++) await sleep(10);
  assert.ok(l.closed, 'the link is out too');
  for (let s = 0; s < 2; s++) await h.next((m) => m.t === 'free' && m.slot === s);
  assert.deepEqual(srv.room.status().slots.filter(Boolean), []);
  let names = [];
  for (let i = 0; i < 500 && !names.includes('172.20.10.2'); i++) { await sleep(20); names = (await readCert(dir))?.names || []; }
  assert.ok(names.includes('172.20.10.2'), `on disk: ${names}`);
  // and served, without a restart
  let served = '';
  for (let i = 0; i < 200 && !served.includes('172.20.10.2'); i++) {
    await sleep(20);
    served = await new Promise((ok) => { const s = tlsNet.connect({ host: '127.0.0.1', port: srv.tlsPort, rejectUnauthorized: false }, () => { const c = s.getPeerCertificate(); s.destroy(); ok(c.subjectaltname || ''); }); s.on('error', () => ok('')); });
  }
  assert.match(served, /172\.20\.10\.2/);
});

test('the real server process: https on the next port, one line says where, TLS=0 turns it off', async (t) => {
  const dist = tempDir(t, 'dist');
  const port = await freePort();
  const srv = await startServerProcess({ port, dist, tls: true, tlsDir: tempDir(t, 'cert') });
  t.after(() => srv.close());
  assert.ok(srv.out.some((l) => l.includes(`:${port + 1}/pad`)), srv.out.join('\n'));
  const info = await (await fetch(`${srv.base}/api/info`)).json();
  assert.equal(info.tlsPort, port + 1);
  assert.equal((await httpsGet(port + 1, '/api/info')).status, 200);
  const off = await startServerProcess({ dist });
  t.after(() => off.close());
  assert.equal((await (await fetch(`${off.base}/api/info`)).json()).tlsPort, null);
});

// ---------- the pad page ----------
let dist, browser, cert;
before(async () => {
  dist = mkdtempSync(join(tmpdir(), 'racing-karts-gyro-'));
  cert = mkdtempSync(join(tmpdir(), 'racing-karts-gyro-cert-'));
  copyFileSync(join(ROOT, 'controller/pad.html'), join(dist, 'pad.html'));
  await build({ absWorkingDir: ROOT, entryPoints: ['controller/pad.js'], bundle: true, format: 'esm', outfile: join(dist, 'pad.js'), logLevel: 'error' });
  if (hasBrowser) browser = await launch('swiftshader', { extra: ['--host-resolver-rules=MAP pad.test 127.0.0.1'] });
});
after(async () => {
  await browser?.close();
  rmSync(dist, { recursive: true, force: true });
  rmSync(cert, { recursive: true, force: true });
});
const skip = !hasBrowser && 'no chromium';

async function pageRoom(t) {
  const srv = await startServer({ distDir: dist, tls: { dir: cert, port: 0 } });
  srv.https = `https://pad.test:${srv.tlsPort}`;
  srv.http = `http://pad.test:${srv.port}`;
  t.after(() => srv.close());
  return { srv, h: await host(srv) };
}
// Chromium 151 and later have requestPermission too, and it answers "denied" in a headless shell: every phone here says
// yes unless its init says otherwise, or sensors: true grants it the real way.
const ALLOWED = 'if (window.DeviceOrientationEvent) DeviceOrientationEvent.requestPermission = () => Promise.resolve("granted");';
// A phone: its own storage. init runs before the page does.
async function phone(t, url, { init = null, width = 844, height = 390, locale = 'en-US', stored = null, sensors = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, locale, ignoreHTTPSErrors: true });
  t.after(() => ctx.close());
  if (sensors) await ctx.grantPermissions(['accelerometer', 'gyroscope', 'magnetometer']);
  else await ctx.addInitScript(ALLOWED);
  if (init) await ctx.addInitScript(init);
  if (stored) await ctx.addInitScript((kv) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v); } }, stored);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  const joined = () => page.waitForFunction(() => window.__pad?.joined && window.__pad.slot >= 0, null, { timeout: 15000 });
  return { ctx, page, errors, joined, cdp: await ctx.newCDPSession(page), steer: () => page.evaluate(() => window.__pad.steer) };
}
// Holds the phone in a pose for a moment, sensor frames at about 60 Hz; returns what the pad sends as x.
const hold = (p, { beta, gamma }, ms = 180) => p.page.evaluate(([b, g, m]) => new Promise((ok) => {
  const t0 = performance.now();
  const id = setInterval(() => {
    dispatchEvent(new DeviceOrientationEvent('deviceorientation', { beta: b, gamma: g }));
    if (performance.now() - t0 > m) { clearInterval(id); ok(window.__pad.state.x); }
  }, 16);
}), [beta, gamma, ms]);
const tap = async (p, sel) => { await p.page.locator(sel).click({ timeout: 5000 }); };
const lobby = async (p, h, slot = 0) => { h.send({ t: 'phase', phase: 'lobby', slot }); await p.page.waitForFunction(() => window.__pad.screen === 'sLobby'); };
const race = async (p, h, slot = 0) => { h.send({ t: 'phase', phase: 'race', slot }); await p.page.waitForFunction(() => window.__pad.phase === 'race' && !window.__pad.screen); };
const lastX = async (h, want, eps = 0.03) => { for (;;) { const m = await h.next('in', 2000); if (Math.abs(m.x - want) <= eps) return m; } };
const landscape = (p, angle) => p.cdp.send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 2, mobile: true, screenOrientation: { type: angle === 90 ? 'landscapePrimary' : 'landscapeSecondary', angle } });

test('over https: the choice in the lobby, then the steering follows the tilt on both sides, reaches the TV, and centre and dead zone hold', { skip, timeout: 60000 }, async (t) => {
  const { srv, h } = await pageRoom(t);
  const p = await phone(t, `${srv.https}/pad`);
  await p.joined();
  await lobby(p, h);
  assert.equal(await p.page.evaluate(() => isSecureContext), true);
  assert.equal(await p.page.locator('#steerSeg button.on').getAttribute('data-steer'), 'stick');
  await tap(p, '#steerSeg [data-steer="gyro"]');
  assert.equal(await p.page.locator('#steerCard').isVisible(), false, 'already secure: no card');
  await hold(p, pose(90, 0));
  assert.equal(await p.page.evaluate(() => localStorage.getItem('racing-karts.steer')), 'gyro');
  assert.equal((await h.next('mode')).input, 'stick');
  assert.equal((await h.next('mode', 3000)).input, 'gyro', 'the telemetry hears it');
  await race(p, h);
  assert.equal(await p.page.locator('#recenter').isVisible(), true);

  for (const side of [90, 270]) {
    await landscape(p, side);
    await hold(p, pose(side, 0));
    assert.equal(await hold(p, pose(side, 0)), 0, `level is straight, side ${side}`);
    const right = await hold(p, pose(side, 30));
    close(right, steerCurve(30), 0.02, `right, side ${side}`);
    await lastX(h, right);
    const left = await hold(p, pose(side, -30));
    close(left, -steerCurve(30), 0.02, `left, side ${side}`);
    await lastX(h, left);
    close(await hold(p, pose(side, 50)), 1, 1e-9, `full lock, side ${side}`);
    await hold(p, pose(side, 0));
    assert.equal(await hold(p, pose(side, DEAD_ZONE - 0.5)), 0, `dead zone, side ${side}`);
    assert.ok(await hold(p, pose(side, 6)) > 0, `past it, side ${side}`);
    // pitch does nothing
    const steep = await hold(p, pose(side, 20, 5)), flat = await hold(p, pose(side, 20, 75));
    close(steep, flat, 0.01, `pitch, side ${side}`);
    assert.equal((await p.steer()).frame, side);
  }
  await landscape(p, 90);
  // re-centre: held at 10 degrees, that is straight
  await hold(p, pose(90, 10));
  assert.ok(await hold(p, pose(90, 10)) > 0);
  await p.page.locator('#recenter').dispatchEvent('pointerdown');
  assert.equal(await hold(p, pose(90, 10)), 0, 'the button makes this straight ahead');
  assert.ok(await hold(p, pose(90, 25)) > 0.1);
  await lastX(h, await hold(p, pose(90, 10)));
  assert.deepEqual(p.errors, []);
  assert.equal(srv.room.status().slots[0].id.length > 0, true);
});

test('over https: the emulated sensor itself (CDP override, the real event path) steers', { skip, timeout: 30000 }, async (t) => {
  const { srv, h } = await pageRoom(t);
  const p = await phone(t, `${srv.https}/pad`, { sensors: true });
  await p.joined();
  await lobby(p, h);
  await tap(p, '#steerSeg [data-steer="gyro"]');
  const set = (o) => p.cdp.send('DeviceOrientation.setDeviceOrientationOverride', { alpha: 0, ...o });
  // the browser only fires on a change: a hand is never still either
  const jiggle = setInterval(() => { set(pose(90, jiggle.roll + (jiggle.flip = !jiggle.flip ? 0.05 : -0.05))).catch(() => {}); }, 40);
  jiggle.roll = 0;
  t.after(() => clearInterval(jiggle));
  await p.page.waitForFunction(() => window.__pad.steer.on, null, { timeout: 5000 });
  await race(p, h);
  jiggle.roll = 30;
  await p.page.waitForFunction((x) => Math.abs(window.__pad.state.x - x) < 0.03, steerCurve(30), { timeout: 3000 });
  jiggle.roll = -30;
  await p.page.waitForFunction((x) => Math.abs(window.__pad.state.x + x) < 0.03, steerCurve(30), { timeout: 3000 });
  clearInterval(jiggle);
  await lastX(h, -steerCurve(30));
  assert.deepEqual(p.errors, []);
});

test('the thumb still brakes and aims while the phone steers; drift and item stay; the thumb does not steer', { skip, timeout: 30000 }, async (t) => {
  const { srv, h } = await pageRoom(t);
  const p = await phone(t, `${srv.https}/pad`);
  await p.joined();
  await lobby(p, h);
  await tap(p, '#steerSeg [data-steer="gyro"]');
  await hold(p, pose(90, 0));
  await race(p, h);
  const geo = await p.page.evaluate(() => window.__pad.geometry());
  const touch = (type, points) => p.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  const R = geo.R, at = (dx, dy) => ({ x: geo.sx + dx * R * 0.9, y: geo.sy + dy * R * 0.9, id: 1 });
  await hold(p, pose(90, 50)); // full lock right
  await touch('touchStart', [at(0, 0)]);
  await touch('touchMove', [at(0, 1)]); // straight down
  const braking = await p.page.evaluate(() => ({ ...window.__pad.state }));
  assert.equal(braking.y, -1);
  assert.ok(stickThrottle(braking.x, braking.y) < 0, `the host reads a brake at ${braking.x}, ${braking.y}`);
  assert.ok(braking.x > 0.6, 'still turned hard');
  await touch('touchMove', [at(1, 0)]); // the thumb to the side: it does not steer, the phone does
  assert.equal(await hold(p, pose(90, -50), 60), -1);
  const side = await p.page.evaluate(() => ({ ...window.__pad.state }));
  assert.equal(side.y, 0);
  await touch('touchMove', [at(0, -1)]); // up aims
  assert.ok((await p.page.evaluate(() => window.__pad.state.y)) > 0.5);
  await touch('touchEnd', []);
  const free = await p.page.evaluate(() => ({ ...window.__pad.state }));
  assert.equal(free.y, 0);
  assert.equal(free.x, -1, 'letting go of the stick does not let go of the wheel');
  // the left thumb's buttons
  await p.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: geo.dx, y: geo.dy, id: 2 }] });
  assert.equal(await p.page.evaluate(() => window.__pad.state.d), 1);
  await p.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await p.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: geo.bx, y: geo.by, id: 3 }] });
  assert.equal(await p.page.evaluate(() => window.__pad.state.b), 1);
  await p.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.deepEqual(p.errors, []);
});

test('a race that starts: the countdown settles the centre, the wheel works straight after', { skip, timeout: 30000 }, async (t) => {
  const { srv, h } = await pageRoom(t);
  const p = await phone(t, `${srv.https}/pad`);
  await p.joined();
  await lobby(p, h);
  await tap(p, '#steerSeg [data-steer="gyro"]');
  await hold(p, pose(90, 0));
  h.send({ t: 'phase', phase: 'loading', slot: 0 });
  await p.page.waitForFunction(() => window.__pad.phase === 'loading');
  h.send({ t: 'phase', phase: 'race', slot: 0 });
  await p.page.waitForFunction(() => window.__pad.phase === 'race');
  assert.equal(await hold(p, pose(90, 12), 2700), 0, 'held a bit off level through the countdown');
  close((await p.steer()).centre, 12, 1);
  assert.equal(await hold(p, pose(90, 12)), 0, 'that is straight ahead for this race');
  assert.ok(await hold(p, pose(90, 30)) > 0.2);
});

test('fallback: silent for 2 s goes to the stick with a word, and the stick steers again', { skip, timeout: 30000 }, async (t) => {
  const { srv, h } = await pageRoom(t);
  const p = await phone(t, `${srv.https}/pad`);
  await p.joined();
  await lobby(p, h);
  await tap(p, '#steerSeg [data-steer="gyro"]');
  // a phone that never says a word
  assert.equal((await p.steer()).listening, true);
  await sleep(1000);
  assert.equal((await p.steer()).want, 'gyro', 'not before its time');
  await p.page.waitForFunction(() => window.__pad.steer.want === 'stick', null, { timeout: 2500 });
  assert.equal(await p.page.locator('#toastBig').textContent(), en['pad.gyroOff']);
  assert.equal(await p.page.locator('#toastSmall').textContent(), en['pad.gyroSilent']);
  assert.equal(await p.page.evaluate(() => localStorage.getItem('racing-karts.steer')), 'stick');
  assert.equal(await p.page.locator('#steerSeg button.on').getAttribute('data-steer'), 'stick');
  await race(p, h);
  assert.equal(await p.page.locator('#recenter').isVisible(), false);
  const geo = await p.page.evaluate(() => window.__pad.geometry());
  await p.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: geo.sx, y: geo.sy, id: 1 }] });
  await p.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: geo.sx + geo.R * 0.9, y: geo.sy, id: 1 }] });
  assert.ok((await p.page.evaluate(() => window.__pad.state.x)) > 0.7, 'the thumb steers');
  await p.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.deepEqual(p.errors, []);
});

test('sensors that fall silent during a race: the stick for now, the wheel again when they speak; not on a menu', { skip, timeout: 30000 }, async (t) => {
  const { srv, h } = await pageRoom(t);
  const p = await phone(t, `${srv.https}/pad`);
  await p.joined();
  await lobby(p, h);
  await tap(p, '#steerSeg [data-steer="gyro"]');
  await hold(p, pose(90, 0));
  await sleep(2400); // lying still on the table in the lobby, as Android goes quiet then
  assert.equal((await p.steer()).on, true, 'a menu does not care');
  await race(p, h);
  await hold(p, pose(90, 30));
  await p.page.waitForFunction(() => !window.__pad.steer.on, null, { timeout: 4000 });
  assert.equal(await p.page.evaluate(() => window.__pad.state.x), 0, 'no wheel stuck turned');
  assert.equal((await p.steer()).want, 'gyro', 'the choice stands');
  assert.equal(await p.page.locator('#toastSmall').textContent(), en['pad.gyroSilent']);
  assert.ok(await hold(p, pose(90, 30)) > 0.2, 'it speaks again, it steers again');
  assert.equal((await p.steer()).on, true);
  assert.deepEqual(p.errors, []);
});

test('the choice is remembered: a reload on https comes back on the gyroscope, and choosing the stick goes back to http for good', { skip, timeout: 30000 }, async (t) => {
  const { srv, h } = await pageRoom(t);
  const p = await phone(t, `${srv.https}/pad`);
  await p.joined();
  await lobby(p, h);
  await tap(p, '#steerSeg [data-steer="gyro"]');
  await hold(p, pose(90, 0));
  await p.page.reload();
  await p.joined();
  await hold(p, pose(90, 0));
  const s = await p.steer();
  assert.deepEqual([s.want, s.on], ['gyro', true]);
  const id = await p.page.evaluate(() => localStorage.getItem('racing-karts.padId'));

  await lobby(p, h);
  await tap(p, '#steerSeg [data-steer="stick"]');
  await p.page.waitForURL(`${srv.http}/pad`, { timeout: 5000 });
  await p.joined();
  assert.equal((await p.steer()).want, 'stick');
  assert.equal(await p.page.evaluate(() => localStorage.getItem('racing-karts.padId')), id, 'the same seat');
  assert.equal(await p.page.evaluate(() => localStorage.getItem('racing-karts.steer')), 'stick');
  assert.equal(srv.room.status().slots.filter(Boolean).length, 1);
  assert.deepEqual(p.errors, []);
});

test('from http: a short word first, then https with the same seat, the same language, and the next scan goes there by itself', { skip, timeout: 45000 }, async (t) => {
  const { srv, h } = await pageRoom(t);
  const other = new WebSocket(`${srv.wsBase}?role=pad&id=before`);
  await new Promise((ok) => other.once('open', ok));
  t.after(() => other.terminate());
  const p = await phone(t, `${srv.http}/pad`, { locale: 'it-IT' });
  await p.joined();
  assert.equal(await p.page.evaluate(() => isSecureContext), false, 'a LAN address: the real situation');
  await lobby(p, h, 1);
  const id = await p.page.evaluate(() => localStorage.getItem('racing-karts.padId'));
  assert.equal(await p.page.evaluate(() => window.__pad.slot), 1);
  await tap(p, '#steerSeg [data-steer="gyro"]');
  assert.equal(await p.page.locator('#steerCard').isVisible(), true);
  const card = await p.page.locator('#scText').textContent();
  assert.equal(card, itDict['pad.moveText']);
  assert.match(card, /Safari/);
  assert.match(card, /Chrome/);
  // it fits
  const box = await p.page.locator('#steerCard .box').boundingBox();
  assert.ok(box.y >= 0 && box.y + box.height <= 390, `card ${JSON.stringify(box)}`);
  // changing one's mind stays put
  await tap(p, '#scStay');
  assert.equal(await p.page.locator('#steerCard').isVisible(), false);
  assert.equal((await p.steer()).want, 'stick');
  assert.equal(p.page.url(), `${srv.http}/pad`);

  await tap(p, '#steerSeg [data-steer="gyro"]');
  await tap(p, '#scGo');
  await p.page.waitForURL(`${srv.https}/pad`, { timeout: 10000 });
  assert.equal(new URL(p.page.url()).search, '', 'the id does not stay in the address');
  await p.joined();
  assert.equal(await p.page.evaluate(() => window.__pad.slot), 1, 'the same seat');
  assert.equal(await p.page.evaluate(() => localStorage.getItem('racing-karts.padId')), id);
  assert.equal(await p.page.evaluate(() => window.__pad.lang), 'it');
  assert.equal(srv.room.status().slots.filter(Boolean).length, 2, 'not a third seat');
  assert.ok(await hold(p, pose(90, 0)) === 0 && (await p.steer()).on);
  await race(p, h, 1);
  assert.ok(await hold(p, pose(90, 30)) > 0.2);
  await lastX(h, await hold(p, pose(90, 30)));

  // the QR again, in a new tab of the same phone: http remembers, and sends it on before taking a seat
  const again = await p.ctx.newPage();
  await again.goto(`${srv.http}/pad`);
  await again.waitForURL(`${srv.https}/pad`, { timeout: 10000 });
  assert.deepEqual(p.errors, []);
  await again.close();
});

test('the warning was too much: back on http it is the stick, with a word, and no going round again', { skip, timeout: 30000 }, async (t) => {
  const { srv, h } = await pageRoom(t);
  const p = await phone(t, `${srv.http}/pad`);
  await p.joined();
  await lobby(p, h);
  await tap(p, '#steerSeg [data-steer="gyro"]');
  await tap(p, '#scGo');
  await p.page.waitForURL(`${srv.https}/pad`, { timeout: 10000 });
  await p.page.goBack();
  await p.joined();
  assert.equal(new URL(p.page.url()).protocol, 'http:');
  await sleep(300);
  assert.equal(new URL(p.page.url()).protocol, 'http:', 'it stays');
  assert.equal((await p.steer()).want, 'stick');
  assert.equal(await p.page.evaluate(() => localStorage.getItem('racing-karts.steer')), 'stick');
  assert.equal(srv.room.status().slots.filter(Boolean).length, 1);
});

test('the http stick flow as it was: no card, no sensor, no https, no warnings', { skip, timeout: 30000 }, async (t) => {
  const { srv, h } = await pageRoom(t);
  const urls = [];
  const ctxInit = `window.__listened = 0; const add = window.addEventListener; window.addEventListener = function (k, ...a) { if (k === 'deviceorientation') window.__listened++; return add.call(this, k, ...a); };`;
  const p = await phone(t, `${srv.http}/pad`, { init: ctxInit });
  p.page.on('request', (r) => urls.push(r.url()));
  await p.joined();
  await lobby(p, h);
  assert.equal(await p.page.locator('#steerCard').isVisible(), false);
  assert.equal(await p.page.locator('#steerSeg button.on').getAttribute('data-steer'), 'stick');
  await race(p, h);
  assert.equal(await p.page.locator('#recenter').isVisible(), false);
  const geo = await p.page.evaluate(() => window.__pad.geometry());
  await p.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: geo.sx, y: geo.sy, id: 1 }] });
  await p.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: geo.sx - geo.R * 0.9, y: geo.sy, id: 1 }] });
  const m = await lastX(h, await p.page.evaluate(() => window.__pad.state.x));
  assert.ok(m.x < -0.7);
  await p.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.equal(await p.page.evaluate(() => window.__pad.state.x), 0);
  assert.equal(await p.page.evaluate(() => window.__listened), 0, 'nothing asks for the sensors');
  assert.equal(urls.some((u) => u.startsWith('https:')), false);
  assert.equal(new URL(p.page.url()).protocol, 'http:');
  assert.equal((await p.steer()).link, false);
  assert.deepEqual(p.errors, []);
});

// As the reports say of Safari on an iPhone (SIMULATED here: this is Chromium): wss:// refused, while requests go through.
const NO_WSS = `const Real = window.WebSocket; window.WebSocket = function (url, ...a) { if (String(url).startsWith('wss:')) { window.__wssTried = (window.__wssTried || 0) + 1; return new Real('ws://127.0.0.1:9/refused'); } return new Real(url, ...a); }; Object.assign(window.WebSocket, Real);`;

test('wss refused as on an iPhone: the pad goes over the link by itself, keeps its seat, the steering reaches the TV, and it reconnects', { skip, timeout: 45000 }, async (t) => {
  const { srv, h } = await pageRoom(t);
  const p = await phone(t, `${srv.http}/pad`, { init: NO_WSS });
  await p.joined();
  await lobby(p, h);
  const id = await p.page.evaluate(() => localStorage.getItem('racing-karts.padId'));
  await tap(p, '#steerSeg [data-steer="gyro"]');
  await tap(p, '#scGo');
  await p.page.waitForURL(`${srv.https}/pad`, { timeout: 10000 });
  await p.joined();
  assert.equal(await p.page.evaluate(() => window.__wssTried), 1);
  assert.equal((await p.steer()).link, true);
  assert.equal(srv.room.status().slots[0].id, id);
  await hold(p, pose(90, 0));
  await race(p, h);
  const x = await hold(p, pose(90, 30), 300);
  assert.ok(x > 0.2);
  await lastX(h, x);
  // down too: the phone's menus work
  h.send({ t: 'phase', phase: 'lobby', slot: 0 });
  await p.page.waitForFunction(() => window.__pad.screen === 'sLobby');

  // the Wi-Fi drops the link: the phone comes back to the same seat
  const before = await p.page.evaluate(() => window.__padRx);
  await p.ctx.setOffline(true);
  await p.page.waitForFunction(() => !window.__pad.joined, null, { timeout: 8000 });
  await p.ctx.setOffline(false);
  await p.joined();
  assert.ok((await p.page.evaluate(() => window.__padRx)) > before);
  assert.equal(srv.room.status().slots[0].id, id);
  assert.equal(srv.room.status().slots.filter(Boolean).length, 1);
  assert.equal(await p.page.evaluate(() => localStorage.getItem('racing-karts.link')), '1', 'the next visit does not try wss again');
});

test('the link answers quickly: from the phone sending to the TV hearing is a matter of milliseconds on this machine', { skip, timeout: 30000 }, async (t) => {
  const { srv, h } = await pageRoom(t);
  const p = await phone(t, `${srv.https}/pad`, { stored: { 'racing-karts.link': '1' }, init: 'window.__padTrace = [];' });
  await p.joined();
  assert.equal((await p.steer()).link, true);
  await race(p, h);
  await sleep(100);
  const heard = [];
  for (const t0 = Date.now(); Date.now() - t0 < 2000;) { const m = await h.next('in', 2000); heard.push([m.seq, Date.now()]); } // the first page of a browser can stall a second, on any transport
  const sent = new Map((await p.page.evaluate(() => window.__padTrace)).map((r) => [r.seq, r.tx]));
  const late = heard.filter(([seq]) => sent.has(seq)).map(([seq, at]) => at - sent.get(seq)).sort((a, b) => a - b);
  t.diagnostic(`${heard.length} inputs in 2 s over the link, median ${late[late.length >> 1]} ms, worst ${late.at(-1)} ms (loopback TLS, not Wi-Fi)`);
  assert.ok(heard.length >= 30, `the 30 Hz repeat, at least half of it through a stall: ${heard.length}`);
  assert.ok(late[late.length >> 1] < 40, `median ${late[late.length >> 1]} ms`);
});

test('an iPhone: a tap on the card calls requestPermission, allowed it steers; denied it is the stick with a word', { skip, timeout: 30000 }, async (t) => {
  const { srv, h } = await pageRoom(t);
  const grant = `window.__asked = 0; if (window.DeviceOrientationEvent) DeviceOrientationEvent.requestPermission = () => { if (!navigator.userActivation.isActive) return Promise.reject(new DOMException('needs a gesture', 'NotAllowedError')); window.__asked++; return Promise.resolve('granted'); };`;
  const p = await phone(t, `${srv.http}/pad`, { init: grant });
  await p.joined();
  await lobby(p, h);
  await tap(p, '#steerSeg [data-steer="gyro"]');
  assert.equal(await p.page.evaluate(() => window.__asked), 0, 'on http it would refuse: it is not asked there');
  await tap(p, '#scGo');
  await p.page.waitForURL(`${srv.https}/pad`, { timeout: 10000 });
  await p.joined();
  // over the secure page, the tap the phone wants
  await p.page.waitForFunction(() => window.__pad.steer.card === 'perm', null, { timeout: 5000 });
  await sleep(2300);
  assert.equal((await p.steer()).want, 'gyro', 'a person who has not tapped yet is not a silent sensor');
  assert.equal(await p.page.evaluate(() => window.__asked), 0);
  assert.equal(await p.page.locator('#scText').textContent(), en['pad.permText']);
  await tap(p, '#scGo');
  await p.page.waitForFunction(() => window.__asked === 1 && !window.__pad.steer.card, null, { timeout: 5000 });
  await hold(p, pose(90, 0));
  assert.equal((await p.steer()).on, true);

  assert.deepEqual(p.errors, []);

  // a phone that said yes before does not ask again
  await p.page.reload();
  await p.joined();
  await p.page.waitForFunction(() => window.__pad.steer.card === 'perm', null, { timeout: 5000 });
  assert.equal(await p.page.evaluate(() => window.__asked), 0, 'nobody tapped: this one wants its tap again');
  const r = await phone(t, `${srv.https}/pad`, { stored: { 'racing-karts.steer': 'gyro' } });
  await r.joined();
  await sleep(200);
  assert.equal((await r.steer()).card, null, 'this one needs no tap');
  assert.equal((await r.steer()).listening, true);

  // denied, from the lobby of a secure page
  const q = await phone(t, `${srv.https}/pad`, { init: 'DeviceOrientationEvent.requestPermission = () => Promise.resolve("denied");' });
  await q.joined();
  await lobby(q, h, await q.page.evaluate(() => window.__pad.slot));
  await tap(q, '#steerSeg [data-steer="gyro"]');
  await q.page.waitForFunction(() => document.getElementById('toastSmall').textContent.length > 0, null, { timeout: 5000 });
  assert.equal(await q.page.locator('#toastSmall').textContent(), en['pad.gyroDenied']);
  assert.equal((await q.steer()).want, 'stick');
});

test('an iPhone that already allowed it in this session: the first event takes the card away by itself', { skip, timeout: 30000 }, async (t) => {
  const { srv } = await pageRoom(t);
  const p = await phone(t, `${srv.https}/pad`, { init: 'DeviceOrientationEvent.requestPermission = () => Promise.reject(new DOMException("needs a gesture", "NotAllowedError"));', stored: { 'racing-karts.steer': 'gyro' } });
  await p.joined();
  await p.page.waitForFunction(() => window.__pad.steer.card === 'perm');
  await hold(p, pose(90, 0));
  const s = await p.steer();
  assert.equal(s.card, null);
  assert.equal(s.on, true);
});

test('no sensor API, and no https on the server: a word and the stick, in both languages', { skip, timeout: 30000 }, async (t) => {
  const { srv, h } = await pageRoom(t);
  const p = await phone(t, `${srv.https}/pad`, { init: 'delete window.DeviceOrientationEvent;' });
  await p.joined();
  await lobby(p, h);
  await tap(p, '#steerSeg [data-steer="gyro"]');
  assert.equal(await p.page.locator('#toastSmall').textContent(), en['pad.gyroMissing']);
  assert.equal((await p.steer()).want, 'stick');

  const plain = await startServer({ distDir: dist });
  t.after(() => plain.close());
  const h2 = await host(plain);
  const q = await phone(t, `http://pad.test:${plain.port}/pad`, { locale: 'it-IT' });
  await q.joined();
  await lobby(q, h2);
  await tap(q, '#steerSeg [data-steer="gyro"]');
  await tap(q, '#scGo');
  await q.page.waitForFunction(() => document.getElementById('toastSmall').textContent === 'Sul Mac manca la pagina https.');
  assert.equal(await q.page.locator('#toastBig').textContent(), itDict['pad.gyroOff']);
  assert.equal((await q.steer()).want, 'stick');
  assert.equal(new URL(q.page.url()).protocol, 'http:');
});

test('it fits: the centre button in a race and both cards, on every phone size, in both languages', { skip, timeout: 120000 }, async (t) => {
  const { srv, h } = await pageRoom(t);
  const rect = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  const hits = (a, b) => Math.min(a.r, b.r) - Math.max(a.l, b.l) > 1 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 1;
  const SIZES = [[844, 390], [667, 375], [568, 320], [390, 844], [320, 568], [360, 780]];
  for (const [width, height] of SIZES) {
    for (const locale of ['it-IT', 'en-US']) {
      const where = `${width}x${height} ${locale}`;
      const p = await phone(t, `${srv.http}/pad`, { width, height, locale });
      await p.joined();
      const slot = await p.page.evaluate(() => window.__pad.slot);
      await lobby(p, h, slot);
      await tap(p, '#steerSeg [data-steer="gyro"]');
      const move = await p.page.evaluate((rectFn) => { const f = eval(rectFn); return { box: f(document.querySelector('#steerCard .box')), go: f(document.getElementById('scGo')), stay: f(document.getElementById('scStay')), w: innerWidth, h: innerHeight }; }, rect.toString());
      assert.ok(move.box.l >= 0 && move.box.t >= 0 && move.box.r <= move.w && move.box.b <= move.h, `${where} move card ${JSON.stringify(move.box)}`);
      assert.ok(move.go.h >= 40 && move.stay.h >= 40 && move.go.w >= 40 && !hits(move.go, move.stay), `${where} its buttons`);
      assert.ok(move.stay.r <= move.box.r && move.stay.b <= move.box.b, `${where} its buttons stay on the card`);
      await tap(p, '#scGo');
      await p.page.waitForURL(`${srv.https}/pad`, { timeout: 10000 });
      await p.joined();
      await hold(p, pose(90, 0));
      h.send({ t: 'phase', phase: 'race', slot });
      h.send({ t: 'hud', place: 8, lap: 3, laps: 5, item: null, charges: 0, boost: false, slot });
      await p.page.waitForFunction(() => window.__pad.phase === 'race' && !window.__pad.screen && !document.getElementById('hud').classList.contains('hide'));
      const r = await p.page.evaluate((rectFn) => { const f = eval(rectFn); return { c: f(document.getElementById('recenter')), hud: f(document.getElementById('hud')), lang: f(document.getElementById('lang')), chip: f(document.querySelector('#top .chip')), hint: f(document.getElementById('hint')), base: f(document.getElementById('base')), w: innerWidth, h: innerHeight, hintText: document.getElementById('hint').textContent, font: parseFloat(getComputedStyle(document.getElementById('recenter')).fontSize) }; }, rect.toString());
      assert.ok(r.c.w >= 40 && r.c.h >= 40 && r.font >= 13, `${where} centre button ${JSON.stringify(r.c)}`);
      for (const k of ['hud', 'lang', 'chip']) assert.ok(!hits(r.c, r[k]), `${where} centre button x ${k}: ${JSON.stringify([r.c, r[k]])}`);
      assert.ok(r.c.r <= r.w && r.c.l >= 0, `${where} centre button on screen`);
      assert.equal(r.hintText, (locale === 'it-IT' ? itDict : en)['pad.hintGyro']);
      assert.ok(r.hint.b <= r.h + 0.5 && !hits(r.hint, r.base), `${where} the hint ${JSON.stringify([r.hint, r.base])}`);
      assert.deepEqual(p.errors, []);
      await p.ctx.close();
    }
  }
});

test('every word of it is in both languages, with no em dash', () => {
  const keys = ['pad.steer', 'pad.steerGyro', 'pad.steerStick', 'pad.hintGyro', 'pad.recenter', 'pad.recentered', 'pad.moveTitle', 'pad.moveText', 'pad.moveGo', 'pad.moveStay', 'pad.permTitle', 'pad.permText', 'pad.permGo', 'pad.gyroOff', 'pad.gyroMissing', 'pad.gyroDenied', 'pad.gyroSilent', 'pad.gyroNoHttps', 'pad.gyroBack'];
  for (const k of keys) {
    assert.ok(itDict[k], `it ${k}`);
    assert.ok(en[k], `en ${k}`);
    assert.ok(!itDict[k].includes('\u2014') && !en[k].includes('\u2014'), k);
  }
});
