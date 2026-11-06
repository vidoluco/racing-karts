// Server protocol and game-side input: four slots, a fifth waits, reconnection, the new messages sanitised, the
// keyboard for four players. Real ws clients against the real server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { startServer, host, pad, sleep } from '../server/testing.js';
import { createServer, lanAddress } from '../server/index.js';
import { SLOT_COLORS, sanitizeInput, sanitizePick, sanitizeVote, sanitizeOpt } from '../server/room.js';
import { createInput, DEFAULT_COLORS } from '../src/net/input.js';
import { createKeyboard } from '../src/net/keyboard.js';
import { createWsTransport } from '../src/net/ws-transport.js';

const SPEC_COLORS = ['#4aa6f2', '#f28bbd', '#f6c23e', '#62c56e'];

async function fourPads(srv) {
  const out = [];
  for (const id of ['aaaa', 'bbbb', 'cccc', 'dddd']) {
    const p = await pad(srv, id);
    await p.next('welcome');
    out.push(p);
  }
  return out;
}

test('four pads get slots 0 to 3 with the four colours, the host is told, the fifth waits', async (t) => {
  const srv = await startServer();
  t.after(() => srv.close());
  assert.deepEqual(SLOT_COLORS, SPEC_COLORS);
  assert.deepEqual(DEFAULT_COLORS, SPEC_COLORS);
  const h = await host(srv);
  for (let s = 0; s < 4; s++) {
    const p = await pad(srv, `pad${s}`);
    const w = await p.next('welcome');
    assert.equal(w.slot, s);
    assert.equal(w.color, SPEC_COLORS[s]);
    assert.equal(w.host, true);
    assert.deepEqual(await h.next('join'), { t: 'join', slot: s, color: SPEC_COLORS[s] });
  }
  const fifth = await pad(srv, 'pad4');
  assert.deepEqual(await fifth.next(), { t: 'full' });
  assert.deepEqual(await h.next('full'), { t: 'full', waiting: 1 });
  fifth.send({ t: 'in', x: 1, y: 1, b: 1, d: 1, seq: 0 });
  assert.ok(await h.none('in'), 'a waiting pad cannot drive anyone');
  assert.equal(srv.room.status().waiting, 1);
});

test('the fifth phone takes the slot when a reservation runs out, the late one waits', async (t) => {
  const srv = await startServer({ reserveMs: 150 });
  t.after(() => srv.close());
  const h = await host(srv);
  const [, b] = await fourPads(srv);
  const e = await pad(srv, 'eeee');
  await e.next('full');
  await b.close();
  assert.deepEqual(await h.next('leave'), { t: 'leave', slot: 1 });
  const w = await e.next('welcome', 2000);
  assert.equal(w.slot, 1);
  assert.equal(w.color, SPEC_COLORS[1]);
  assert.deepEqual(await h.next((m) => m.t === 'join' && m.slot === 1, 2000), { t: 'join', slot: 1, color: SPEC_COLORS[1] });
  const b2 = await pad(srv, 'bbbb');
  assert.deepEqual(await b2.next(), { t: 'full' });
});

test('input carries item and drift, is stamped with the slot and clamped', async (t) => {
  const srv = await startServer();
  t.after(() => srv.close());
  const h = await host(srv);
  const [a, , , d] = await fourPads(srv);
  d.send({ t: 'in', x: 0.5, y: -0.25, b: 1, d: 1, seq: 7, slot: 0 }); // a forged slot is overwritten
  assert.deepEqual(await h.next('in'), { t: 'in', slot: 3, x: 0.5, y: -0.25, b: 1, d: 1, seq: 7 });
  a.send({ t: 'in', x: 3, y: -9, b: 0, d: true, seq: 1 });
  assert.deepEqual(await h.next('in'), { t: 'in', slot: 0, x: 1, y: -1, b: 0, d: 1, seq: 1 });
  a.send({ t: 'in', x: 0, y: 0, b: 'yes', d: 7, seq: 2, evil: 'x' });
  assert.deepEqual(await h.next('in'), { t: 'in', slot: 0, x: 0, y: 0, b: 0, d: 0, seq: 2 });
});

test('sanitizers keep only what the contract allows', () => {
  assert.equal(sanitizeInput({ t: 'in', x: 'a', y: 0 }), null);
  assert.deepEqual(sanitizeInput({ t: 'in', x: NaN, y: Infinity, seq: -4 }), { x: 0, y: 0, b: 0, d: 0, seq: 0 });
  assert.deepEqual(sanitizePick({ t: 'pick', kart: 'tabia', ready: true, x: 1 }), { kart: 'tabia', ready: true });
  assert.deepEqual(sanitizePick({ t: 'pick', kart: 'jeep', ready: 'yes' }), { kart: 'jeep', ready: false });
  for (const kart of ['', 'A B', '<img>', 'x'.repeat(33), 5, null]) assert.equal(sanitizePick({ t: 'pick', kart }), null, String(kart));
  assert.deepEqual(sanitizeVote({ t: 'vote', track: 'bali', lock: true }), { track: 'bali', lock: true });
  assert.deepEqual(sanitizeVote({ t: 'vote', track: 'random' }), { track: 'random', lock: false });
  assert.equal(sanitizeVote({ t: 'vote', world: 'bali' }), null, 'the old game\'s field is gone');
  assert.deepEqual(sanitizeOpt({ t: 'opt', difficulty: 'hard', bots: 3, laps: 5, mode: 'gp' }), { difficulty: 'hard', bots: 3, laps: 5, mode: 'gp' });
  assert.deepEqual(sanitizeOpt({ t: 'opt', bots: 99 }), { bots: 7 });
  assert.deepEqual(sanitizeOpt({ t: 'opt', bots: -3 }), { bots: 0 });
  assert.deepEqual(sanitizeOpt({ t: 'opt', difficulty: 'nightmare', laps: 4, bots: 1.5, go: true }), { go: true });
  assert.deepEqual(sanitizeOpt({ t: 'opt', next: 'rematch' }), { next: 'rematch' });
  assert.equal(sanitizeOpt({ t: 'opt', difficulty: 'nightmare', next: 'quit', go: 1, laps: '3' }), null);
});

test('pick, vote and opt reach the host sanitised with the sender\'s slot; bad ones are dropped', async (t) => {
  const srv = await startServer();
  t.after(() => srv.close());
  const h = await host(srv);
  const [a, b] = await fourPads(srv);
  b.send({ t: 'pick', kart: 'BAD KART' });
  b.send({ t: 'vote', track: '../x' });
  b.send({ t: 'opt', laps: 99 });
  assert.ok(await h.none((m) => ['pick', 'vote', 'opt'].includes(m.t)));
  b.send({ t: 'pick', kart: 'jukung', ready: true, slot: 0 });
  assert.deepEqual(await h.next('pick'), { t: 'pick', slot: 1, kart: 'jukung', ready: true });
  b.send({ t: 'vote', track: 'bromo', lock: true, slot: 2 });
  assert.deepEqual(await h.next('vote'), { t: 'vote', slot: 1, track: 'bromo', lock: true });
  a.send({ t: 'opt', difficulty: 'hard', go: true, junk: 1 });
  assert.deepEqual(await h.next('opt'), { t: 'opt', slot: 0, difficulty: 'hard', go: true });
});

test('opt: anyone before the first pick, then slot 0 only, and again after the host goes back to the lobby', async (t) => {
  const srv = await startServer();
  t.after(() => srv.close());
  const h = await host(srv);
  const [a, b, c] = await fourPads(srv);
  b.send({ t: 'opt', bots: 2 });
  assert.deepEqual(await h.next('opt'), { t: 'opt', slot: 1, bots: 2 });
  c.send({ t: 'pick', kart: 'tabia' });
  await h.next('pick');
  b.send({ t: 'opt', bots: 3 });
  assert.ok(await h.none('opt'), 'a guest cannot change the options after the first pick');
  a.send({ t: 'opt', next: 'rematch' });
  assert.deepEqual(await h.next('opt'), { t: 'opt', slot: 0, next: 'rematch' });
  h.send({ t: 'phase', slot: 0, phase: 'lobby' });
  await a.next('phase');
  b.send({ t: 'opt', laps: 5 });
  assert.deepEqual(await h.next('opt'), { t: 'opt', slot: 1, laps: 5 });
});

test('slot 0 gone at the results: the lowest connected slot decides for the room, the others still do not', async (t) => {
  const srv = await startServer({ reserveMs: 80 });
  t.after(() => srv.close());
  const h = await host(srv);
  const [a, b, c] = await fourPads(srv);
  a.send({ t: 'pick', kart: 'tabia' });
  await h.next('pick');
  b.send({ t: 'opt', next: 'rematch' });
  assert.ok(await h.none('opt'), 'slot 0 is here: slot 1 has no say');
  await a.close();
  await h.next((m) => m.t === 'leave' && m.slot === 0);
  // while its seat is held too: a phone that is not there decides nothing
  b.send({ t: 'opt', next: 'rematch' });
  assert.deepEqual(await h.next('opt'), { t: 'opt', slot: 1, next: 'rematch' });
  assert.deepEqual(await h.next('free'), { t: 'free', slot: 0 }, 'the reservation ran out, and the TV hears it');
  assert.equal(srv.room.status().slots[0], null);
  b.send({ t: 'opt', next: 'lobby' });
  assert.deepEqual(await h.next('opt'), { t: 'opt', slot: 1, next: 'lobby' });
  c.send({ t: 'opt', next: 'rematch' });
  assert.ok(await h.none('opt'), 'slot 2 is not the lowest: nothing');
  // slot 0's phone returns as a new one, and takes the seat and the say
  const again = await pad(srv, 'again');
  assert.equal((await again.next('welcome')).slot, 0);
  b.send({ t: 'opt', next: 'lobby' });
  assert.ok(await h.none('opt'));
  again.send({ t: 'opt', next: 'lobby' });
  assert.deepEqual(await h.next('opt'), { t: 'opt', slot: 0, next: 'lobby' });
});

test('release: the TV gives up a held seat and the first in the queue takes it; a seat with a phone on it is never released', async (t) => {
  const srv = await startServer();
  t.after(() => srv.close());
  const h = await host(srv);
  const pads = await fourPads(srv);
  const q = await pad(srv, 'queued');
  assert.deepEqual(await q.next(), { t: 'full' });
  h.send({ t: 'release', slot: 1 });
  assert.ok(await q.none('welcome'), 'slot 1 has a phone on it');
  assert.equal(srv.room.status().slots[1].id, 'bbbb');
  await pads[1].close();
  await h.next((m) => m.t === 'leave' && m.slot === 1);
  assert.ok(await q.none('welcome'), 'held for its phone: the queue waits');
  for (const slot of [9, -1, 1.5]) h.send({ t: 'release', slot });
  h.send({ t: 'release', slot: 1 });
  assert.equal((await q.next('welcome')).slot, 1);
  assert.deepEqual(await h.next('free'), { t: 'free', slot: 1 });
  assert.deepEqual(await h.next('full'), { t: 'full', waiting: 1 });
  assert.deepEqual(await h.next('full'), { t: 'full', waiting: 0 });
  const back = await pad(srv, 'bbbb');
  assert.deepEqual(await back.next(), { t: 'full' }, 'its old phone is a newcomer now');
  pads[0].send({ t: 'release', slot: 3 });
  assert.equal(srv.room.status().slots[3].connected, true, 'and a phone cannot release anything');
});

test('the server says who it is first thing, the same to a TV that returns and another after a restart', async (t) => {
  const srv = await startServer();
  t.after(() => srv.close());
  const p = await pad(srv, 'aaaa');
  await p.next('welcome');
  const a = await host(srv);
  const first = await a.next();
  assert.equal(first.t, 'hello', 'before the joins');
  assert.equal((await a.next()).t, 'join');
  const b = await host(srv);
  assert.equal((await b.next('hello')).boot, first.boot);
  const other = await startServer();
  t.after(() => other.close());
  const c = await host(other);
  assert.notEqual((await c.next('hello')).boot, first.boot);
});

test('host messages reach only the pad in that slot, the fields pass through', async (t) => {
  const srv = await startServer();
  t.after(() => srv.close());
  const h = await host(srv);
  const [a, b, c, d] = await fourPads(srv);
  h.send({ t: 'hud', slot: 2, place: 3, lap: 1, laps: 3, item: 'razzo', charges: 1, boost: true });
  h.send({ t: 'fx', slot: 3, kind: 'roulette', item: 'mici', ms: 1200 });
  h.send({ t: 'phase', slot: 1, phase: 'race' });
  h.send({ t: 'menu', slot: 0, opts: { difficulty: 'easy', bots: 7, laps: 3 } });
  assert.deepEqual(await c.next('hud'), { t: 'hud', slot: 2, place: 3, lap: 1, laps: 3, item: 'razzo', charges: 1, boost: true });
  assert.deepEqual(await d.next('fx'), { t: 'fx', slot: 3, kind: 'roulette', item: 'mici', ms: 1200 });
  assert.deepEqual(await b.next('phase'), { t: 'phase', slot: 1, phase: 'race' });
  assert.equal((await a.next('menu')).opts.bots, 7);
  for (const p of [a, b, d]) assert.ok(await p.none('hud', 50));
  h.send({ t: 'fx', slot: 7, kind: 'buzz' });
  h.send({ t: 'fx', kind: 'buzz' });
  for (const p of [a, b, c, d]) assert.ok(await p.none('fx', 50));
});

test('leave keeps the slot for the same id, reconnection resumes it; a newcomer waits meanwhile', async (t) => {
  const srv = await startServer({ reserveMs: 60000 });
  t.after(() => srv.close());
  const h = await host(srv);
  const [, , c] = await fourPads(srv);
  await c.close();
  assert.deepEqual(await h.next('leave'), { t: 'leave', slot: 2 });
  const n = await pad(srv, 'nnnn');
  assert.equal((await n.next()).t, 'full');
  const c2 = await pad(srv, 'cccc');
  const w = await c2.next('welcome');
  assert.equal(w.slot, 2);
  assert.equal(w.color, SPEC_COLORS[2]);
  await h.next((m) => m.t === 'join' && m.slot === 2);
  c2.send({ t: 'in', x: 0.1, y: 0.2, b: 0, d: 1, seq: 0 });
  const got = await h.next('in');
  assert.equal(got.slot, 2);
  assert.equal(got.d, 1);
  assert.ok(await n.none('welcome'));
});

test('reloading a pad with the same id takes over its slot without a leave', async (t) => {
  const srv = await startServer();
  t.after(() => srv.close());
  const h = await host(srv);
  const a = await pad(srv, 'aaaa');
  await a.next('welcome');
  await h.next('join');
  const a2 = await pad(srv, 'aaaa');
  assert.equal((await a2.next('welcome')).slot, 0);
  assert.equal(await a.closed(), 4001);
  assert.ok(await h.none('leave'));
  a2.send({ t: 'in', x: 0, y: 1, b: 0, d: 0, seq: 1 });
  assert.equal((await h.next('in')).y, 1);
});

test('a waiting pad that disconnects leaves the queue, the host hears the count', async (t) => {
  const srv = await startServer({ reserveMs: 100 });
  t.after(() => srv.close());
  const h = await host(srv);
  const [a] = await fourPads(srv);
  const e = await pad(srv, 'eeee');
  await e.next('full');
  const f = await pad(srv, 'ffff');
  await f.next('full');
  await e.close();
  assert.deepEqual(await h.next((m) => m.t === 'full' && m.waiting === 1), { t: 'full', waiting: 1 });
  await a.close();
  assert.equal((await f.next('welcome', 2000)).slot, 0);
  assert.equal(srv.room.status().waiting, 0);
});

test('last host wins and gets the current pads and the queue; pads hear host on/off', async (t) => {
  const srv = await startServer();
  t.after(() => srv.close());
  const pads = await fourPads(srv);
  const e = await pad(srv, 'eeee');
  await e.next('full');
  const h1 = await host(srv);
  for (let s = 0; s < 4; s++) assert.equal((await h1.next('join')).slot, s);
  assert.deepEqual(await h1.next('full'), { t: 'full', waiting: 1 });
  assert.deepEqual(await pads[3].next('host'), { t: 'host', on: true });
  const h2 = await host(srv);
  assert.equal(await h1.closed(), 4000);
  await h2.next('join');
  pads[1].send({ t: 'in', x: 0.3, y: 0, b: 0, d: 0, seq: 3 });
  assert.equal((await h2.next('in')).x, 0.3);
  await h2.close();
  assert.deepEqual(await pads[2].next((m) => m.t === 'host' && m.on === false), { t: 'host', on: false });
});

test('malformed messages are ignored and the connection survives', async (t) => {
  const srv = await startServer();
  t.after(() => srv.close());
  const h = await host(srv);
  const a = await pad(srv, 'aaaa');
  await a.next('welcome');
  for (const m of ['not json', '[1,2]', 'null', { t: 'nope' }, { t: 'in' }, { t: 'pick' }, { t: 'vote' }, { t: 'opt' }]) a.send(m);
  a.send('x'.repeat(5000));
  assert.ok(await h.none((m) => m.t !== 'join' && m.t !== 'hello'));
  h.send('garbage');
  a.send({ t: 'in', x: 1, y: 0, b: 0, d: 0, seq: 1 });
  assert.equal((await h.next('in')).x, 1);
});

test('silent clients are dropped by the heartbeat', async (t) => {
  const srv = await startServer({ pingMs: 300, reserveMs: 60000 });
  t.after(() => srv.close());
  const h = await host(srv);
  const a = await pad(srv, 'aaaa');
  await a.next('welcome');
  a.ws._socket.pause();
  a.ws.pong = () => {};
  assert.deepEqual(await h.next('leave', 3000), { t: 'leave', slot: 0 });
});

test('a pad that goes silent is dropped within padSilentMs and comes back to its slot; one that never pinged is not', async (t) => {
  const srv = await startServer({ padSilentMs: 400, reserveMs: 60000 });
  t.after(() => srv.close());
  const h = await host(srv);
  const a = await pad(srv, 'aaaa');
  await a.next('welcome');
  await h.next('join');
  const quiet = await pad(srv, 'qqqq');
  await quiet.next('welcome');
  a.send({ t: 'ping', ts: 1 });
  assert.equal((await a.next('pong')).ts, 1);
  const t0 = Date.now();
  assert.deepEqual(await h.next('leave', 3000), { t: 'leave', slot: 0 });
  assert.ok(Date.now() - t0 < 1500, `dropped after ${Date.now() - t0} ms`);
  assert.ok(await h.none((m) => m.t === 'leave' && m.slot === 1, 600), 'a client that never pinged stays');
  const a2 = await pad(srv, 'aaaa');
  assert.equal((await a2.next('welcome')).slot, 0);
});

test('http: pages, static files, qr, info, traversal, a kart picture nobody rendered', async (t) => {
  const srv = await startServer();
  t.after(() => srv.close());
  const get = (p) => fetch(srv.base + p);
  assert.match(await (await get('/')).text(), /host/);
  assert.match(await (await get('/pad')).text(), /pad/);
  assert.deepEqual([...new Uint8Array(await (await get('/data/h.bin')).arrayBuffer())], [1, 2, 3, 4]);
  const qr = await get('/qr.svg?u=' + encodeURIComponent('http://192.168.1.5:5191/pad'));
  assert.equal(qr.headers.get('content-type'), 'image/svg+xml');
  const info = await (await get('/api/info')).json();
  assert.equal(info.padUrl, info.lanUrl + 'pad');
  assert.equal(info.slots.length, 4);
  for (const p of ['/../package.json', '/%2e%2e/package.json', '/..%2f..%2fetc/passwd', '/nope.js', '/%00']) {
    assert.equal((await get(p)).status, 404, p);
  }
  assert.equal((await get('/assets/ui/karts/never-rendered.png')).status, 204, 'the phone draws its placeholder, no console error');
  assert.equal((await get('/assets/ui/..%2f..%2f..%2fpackage.json')).status, 404);
  assert.equal((await get('/favicon.ico')).status, 204);
  assert.equal((await fetch(srv.base + '/pad/?x=1', { redirect: 'manual' })).headers.get('location'), '/pad?x=1');
  assert.equal((await fetch(srv.base + '/', { method: 'POST' })).status, 405);
});

test('listen fails cleanly when the port is taken; PORT=0 picks a free one', async (t) => {
  const srv = await startServer();
  t.after(() => srv.close());
  const other = createServer({ port: srv.port, host: '127.0.0.1' });
  await assert.rejects(other.listen(), { code: 'EADDRINUSE' });
  const free = createServer({ port: 0, host: '127.0.0.1', distDir: '/nonexistent' });
  await free.listen();
  assert.ok(free.port > 0);
  await free.close();
});

test('lan address prefers Wi-Fi over a VPN tunnel, LAN_IP overrides', () => {
  const v4 = (address, internal = false) => ({ family: 'IPv4', address, internal });
  const ifaces = { lo0: [v4('127.0.0.1', true)], utun7: [v4('10.5.0.2')], bridge100: [v4('192.168.64.1')], en0: [v4('192.168.1.20')] };
  assert.equal(lanAddress(ifaces, {}), '192.168.1.20');
  assert.equal(lanAddress({ lo0: [v4('127.0.0.1', true)] }, {}), null);
  assert.equal(lanAddress(ifaces, { LAN_IP: '192.168.9.9' }), '192.168.9.9');
});

test('lan address: an iPhone hotspot wins over a wired LAN and over a tunnel', () => {
  const v4 = (address, internal = false) => ({ family: 'IPv4', address, internal });
  assert.equal(lanAddress({ en5: [v4('192.168.1.20')], en0: [v4('172.20.10.9')] }, {}), '172.20.10.9');
  assert.equal(lanAddress({ utun7: [v4('10.5.0.2')], en0: [v4('172.20.10.9')] }, {}), '172.20.10.9');
  assert.equal(lanAddress({ en0: [v4('192.168.0.107')] }, {}), '192.168.0.107', 'no hotspot: the Wi-Fi as before');
});

test('the server banner names the game, with PORT=0 and a private dist', async () => {
  const proc = spawn(process.execPath, ['server/index.js'], {
    cwd: new URL('..', import.meta.url).pathname,
    env: { ...process.env, PORT: '0', DIST: '/nonexistent-racing-karts' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  proc.stdout.on('data', (b) => { out += b; });
  proc.stderr.on('data', (b) => { out += b; });
  try {
    for (let i = 0; i < 100 && !/phone pad:/.test(out); i++) await sleep(50);
    assert.match(out, /Racing Karts/);
    assert.doesNotMatch(out, /Summit Descent/);
    assert.doesNotMatch(out, /:0\/pad/);
  } finally {
    proc.kill('SIGTERM');
  }
});

test('no old branding, no old mechanics, no em dash left in the network files', () => {
  const files = ['server/index.js', 'server/room.js', 'server/testing.js', 'src/net/input.js', 'src/net/keyboard.js', 'src/net/ws-transport.js', 'controller/pad.html', 'controller/pad.js', 'controller/i18n.js'];
  for (const f of files) {
    const src = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /summit|SCATTO|cooldown|frozen|\bmass\b|\u2014/i, f);
  }
});

// ---------- game side input ----------
function stub() {
  let fn = null;
  const sent = [];
  return { sent, onMessage(f) { fn = f; }, send(m) { sent.push(m); }, push(m) { fn(m); } };
}
function fakeTarget() {
  const ls = {};
  return {
    addEventListener(t, f) { (ls[t] ||= []).push(f); },
    removeEventListener(t, f) { ls[t] = (ls[t] || []).filter((g) => g !== f); },
    key(type, code) { for (const f of ls[type] || []) f({ code, preventDefault() {} }); },
  };
}
const NONE = { x: 0, y: 0, item: false, drift: false, connected: false, source: null };

test('input: neutral before any pad, all four slots work, leave goes back to neutral', () => {
  const tr = stub();
  const input = createInput(tr, { keyboard: null, smoothMs: 0, now: () => 0 });
  for (const s of [0, 3, 4, -1, 0.5, 'x']) assert.deepEqual(input.get(s), NONE);
  for (let s = 0; s < 4; s++) {
    tr.push({ t: 'join', slot: s, color: SPEC_COLORS[s] });
    assert.equal(input.color(s), SPEC_COLORS[s]);
    tr.push({ t: 'in', slot: s, x: 5, y: -7, b: 1, d: 1, seq: 1 });
    assert.deepEqual(input.get(s), { x: 1, y: -1, item: true, drift: true, connected: true, source: 'pad' });
  }
  tr.push({ t: 'leave', slot: 2 });
  assert.deepEqual(input.get(2), NONE);
  tr.push({ t: 'in', slot: 2, x: 1, y: 1, b: 1, d: 1, seq: 9 });
  tr.push({ t: 'in', slot: 9, x: 1, y: 1, b: 1, d: 1, seq: 9 });
  assert.deepEqual(input.get(2), NONE);
});

test('input: a burst of presses is replayed as separate presses, on both buttons', () => {
  const tr = stub();
  const input = createInput(tr, { keyboard: null, smoothMs: 0, now: () => 0 });
  tr.push({ t: 'join', slot: 1 });
  let seq = 0;
  for (const [b, d] of [[1, 1], [0, 0], [1, 0], [0, 0], [1, 0], [0, 0]]) tr.push({ t: 'in', slot: 1, x: 0, y: 0, b, d, seq: seq++ });
  const frames = Array.from({ length: 7 }, () => input.get(1));
  assert.deepEqual(frames.map((f) => f.item), [true, false, true, false, true, false, false]);
  assert.deepEqual(frames.map((f) => f.drift), [true, false, false, false, false, false, false]);
});

test('input: a tap between two frames is not lost, a held drift stays held, stale decays both', () => {
  const tr = stub();
  let now = 0;
  const input = createInput(tr, { keyboard: null, smoothMs: 0, staleMs: 1000, now: () => now });
  tr.push({ t: 'join', slot: 0 });
  tr.push({ t: 'in', slot: 0, x: 0.5, y: 0.5, b: 1, d: 1, seq: 1 });
  tr.push({ t: 'in', slot: 0, x: 0.5, y: 0.5, b: 0, d: 1, seq: 2 });
  let g = input.get(0);
  assert.equal(g.item, true);
  assert.equal(g.drift, true);
  g = input.get(0);
  assert.equal(g.item, false);
  assert.equal(g.drift, true, 'drift is a hold');
  now = 1500;
  g = input.get(0);
  assert.deepEqual(g, { x: 0, y: 0, item: false, drift: false, connected: true, source: 'pad' });
});

test('input: out of order seq is dropped, a rejoin resets the sequence and the buttons', () => {
  const tr = stub();
  const input = createInput(tr, { keyboard: null, smoothMs: 0, now: () => 0 });
  tr.push({ t: 'join', slot: 0 });
  tr.push({ t: 'in', slot: 0, x: 0.5, y: 0, b: 0, d: 1, seq: 10 });
  tr.push({ t: 'in', slot: 0, x: -0.5, y: 0, b: 0, d: 0, seq: 4 });
  assert.equal(input.get(0).x, 0.5);
  tr.push({ t: 'join', slot: 0 });
  assert.equal(input.get(0).drift, false);
  tr.push({ t: 'in', slot: 0, x: -0.5, y: 0, b: 0, d: 0, seq: 0 });
  assert.equal(input.get(0).x, -0.5);
});

test('input: the stick is smoothed over a few frames and settles exactly on the value', () => {
  const tr = stub();
  let now = 0;
  const input = createInput(tr, { keyboard: null, smoothMs: 30, now: () => now });
  tr.push({ t: 'join', slot: 0 });
  tr.push({ t: 'in', slot: 0, x: 1, y: -1, b: 0, d: 0, seq: 1 });
  const xs = [];
  for (let i = 0; i < 40; i++) { now += 1000 / 60; xs.push(input.get(0).x); }
  assert.ok(xs[0] > 0.3 && xs[0] < 0.6, `first frame ${xs[0]}`);
  for (let i = 1; i < xs.length; i++) assert.ok(xs[i] >= xs[i - 1]);
  assert.equal(xs.at(-1), 1);
  now += 5000;
  assert.equal(input.get(0).x, 0, 'stale goes back to the centre');
});

test('input: send stamps the slot, on() observes join, leave and full', () => {
  const tr = stub();
  const input = createInput(tr, { keyboard: null });
  const seen = [];
  input.on((m) => seen.push(m.t));
  input.send(3, { t: 'fx', kind: 'hit' });
  assert.deepEqual(tr.sent, [{ t: 'fx', kind: 'hit', slot: 3 }]);
  assert.equal(input.send(4, { t: 'fx' }), false);
  tr.push({ t: 'join', slot: 3 });
  tr.push({ t: 'leave', slot: 3 });
  tr.push({ t: 'full', waiting: 1 });
  assert.deepEqual(seen, ['join', 'leave', 'full']);
});

test('keyboard: the four mappings of the spec, a slot wakes with its own keys, a pad takes over', () => {
  const k = fakeTarget();
  const kb = createKeyboard(k);
  const tr = stub();
  const input = createInput(tr, { keyboard: kb, smoothMs: 0 });
  const maps = [
    { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', drift: 'ShiftLeft', item: 'KeyE' },
    { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', drift: 'ControlRight', item: 'Enter' },
    { up: 'KeyI', down: 'KeyK', left: 'KeyJ', right: 'KeyL', drift: 'KeyU', item: 'KeyO' },
    { up: 'Numpad8', down: 'Numpad5', left: 'Numpad4', right: 'Numpad6', drift: 'Numpad7', item: 'Numpad9' },
  ];
  maps.forEach((m, s) => {
    assert.deepEqual(input.get(s), NONE, `slot ${s} sleeps until pressed`);
    k.key('keydown', m.right);
    let g = input.get(s);
    assert.deepEqual([g.x, g.y, g.item, g.drift, g.source], [1, 0, false, false, 'keyboard']);
    k.key('keyup', m.right);
    k.key('keydown', m.left);
    k.key('keydown', m.up);
    g = input.get(s);
    assert.ok(Math.abs(g.x + Math.SQRT1_2) < 1e-9 && Math.abs(g.y - Math.SQRT1_2) < 1e-9, 'a diagonal stays inside the circle');
    k.key('keyup', m.left);
    k.key('keyup', m.up);
    k.key('keydown', m.down);
    assert.equal(input.get(s).y, -1);
    k.key('keyup', m.down);
    k.key('keydown', m.drift);
    assert.equal(input.get(s).drift, true);
    k.key('keyup', m.drift);
    assert.equal(input.get(s).drift, false);
    // a tap shorter than a frame counts once
    k.key('keydown', m.item);
    k.key('keyup', m.item);
    assert.equal(input.get(s).item, true);
    assert.equal(input.get(s).item, false);
  });
  tr.push({ t: 'join', slot: 2 });
  assert.equal(input.get(2).source, 'pad');
  tr.push({ t: 'leave', slot: 2 });
  assert.equal(input.get(2).source, 'keyboard');
});

test('ws-transport talks to the real server, reports leave for all four on drop, stops when replaced', async (t) => {
  const srv = await startServer();
  t.after(() => srv.close());
  const { default: WebSocket } = await import('ws');
  const tr = createWsTransport({ url: `${srv.wsBase}?role=host`, WebSocketImpl: WebSocket });
  t.after(() => tr.close());
  const got = [];
  tr.onMessage((m) => got.push(m));
  for (let i = 0; i < 100 && tr.status !== 'open'; i++) await sleep(20);
  assert.equal(tr.status, 'open');
  const a = await pad(srv, 'aaaa');
  await a.next('welcome');
  a.send({ t: 'in', x: 0.5, y: 0, b: 1, d: 1, seq: 1 });
  for (let i = 0; i < 100 && !got.some((m) => m.t === 'in'); i++) await sleep(10);
  assert.deepEqual(got.find((m) => m.t === 'in'), { t: 'in', slot: 0, x: 0.5, y: 0, b: 1, d: 1, seq: 1 });
  assert.equal(tr.send({ t: 'fx', slot: 0, kind: 'box' }), true);
  assert.equal((await a.next('fx')).kind, 'box');
  got.length = 0;
  const h2 = await host(srv);
  for (let i = 0; i < 100 && tr.status !== 'replaced'; i++) await sleep(20);
  assert.equal(tr.status, 'replaced');
  assert.deepEqual(got.filter((m) => m.t === 'leave').map((m) => m.slot), [0, 1, 2, 3]);
  await h2.close();
});
