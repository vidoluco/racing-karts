// Server protocol and game-side input: four slots, a fifth waits, reconnection, the new messages sanitised, the
// keyboard for four players. Real ws clients against the real server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer, host, pad, sleep } from '../server/testing.js';
import { createServer, lanAddress } from '../server/index.js';
import { createRoom, GRACE_MS, SLOT_COLORS, sanitizeInput, sanitizePick, sanitizeVote, sanitizeOpt } from '../server/room.js';
import { createTelemetry, telemetryLine } from '../server/telemetry.js';
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

test('leave keeps the slot for the same id, reconnection resumes it; someone already in the queue waits meanwhile', async (t) => {
  const srv = await startServer({ reserveMs: 60000 });
  t.after(() => srv.close());
  const h = await host(srv);
  const [, , c] = await fourPads(srv);
  const n = await pad(srv, 'nnnn');
  assert.equal((await n.next()).t, 'full');
  await c.close();
  assert.deepEqual(await h.next('leave'), { t: 'leave', slot: 2 });
  assert.ok(await n.none('welcome'), 'a phone that may be blinking keeps its seat from the queue');
  const c2 = await pad(srv, 'cccc');
  const w = await c2.next('welcome');
  assert.equal(w.slot, 2);
  assert.equal(w.color, SPEC_COLORS[2]);
  assert.equal(w.took, undefined, 'its own seat, nothing to tell');
  await h.next((m) => m.t === 'join' && m.slot === 2);
  c2.send({ t: 'in', x: 0.1, y: 0.2, b: 0, d: 1, seq: 0 });
  const got = await h.next('in');
  assert.equal(got.slot, 2);
  assert.equal(got.d, 1);
  assert.ok(await n.none('welcome'));
});

// ---------- a phone away: 120 s, and after them the seat still stands during a game ----------
const fakeWs = () => { const out = []; return { readyState: 1, out, send: (raw) => out.push(JSON.parse(raw)), close() {} }; };

test('the grace is 120000 ms, on the room and on a real server, and the TV hears the drop at once', async (t) => {
  assert.equal(GRACE_MS, 120000);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const room = createRoom();
  const tv = fakeWs(), a = fakeWs();
  room.addHost(tv);
  assert.equal(tv.out[0].reserveMs, 120000, 'the TV is told what to count down from');
  room.addPad(a, 'aaaa');
  tv.out.length = 0;
  room.removePad(a);
  assert.deepEqual(tv.out, [{ t: 'leave', slot: 0 }], 'at once, in the same tick');
  t.mock.timers.tick(119999);
  assert.equal(room.status().slots[0].id, 'aaaa', 'one ms before the end the seat is held');
  assert.equal(tv.out.length, 1);
  t.mock.timers.tick(1);
  assert.equal(room.status().slots[0], null, 'in the lobby it then goes');
  assert.deepEqual(tv.out.at(-1), { t: 'free', slot: 0 });
  room.close();
});

test('a seat past its grace during a game stays until the lobby: the same phone comes back to it, with nothing freed', async (t) => {
  const srv = await startServer({ reserveMs: 60 });
  t.after(() => srv.close());
  const h = await host(srv);
  h.send({ t: 'game', on: true, phase: 'race' });
  const a = await pad(srv, 'aaaa');
  await a.next('welcome');
  const b = await pad(srv, 'bbbb');
  assert.equal((await b.next('welcome')).slot, 1);
  await a.close();
  assert.deepEqual(await h.next('leave'), { t: 'leave', slot: 0 });
  assert.deepEqual(await h.next('expired'), { t: 'expired', slot: 0 });
  assert.ok(await h.none('free', 150), 'nothing is freed during a game');
  assert.equal(srv.room.status().slots[0].expired, true);
  const back = await pad(srv, 'aaaa');
  const w = await back.next('welcome');
  assert.equal(w.slot, 0, 'after the grace, the same seat');
  assert.equal(w.took, undefined);
  assert.deepEqual(await h.next((m) => m.t === 'join' && m.slot === 0), { t: 'join', slot: 0, color: SPEC_COLORS[0] });
  // gone again: back in the lobby is where an expired seat really goes
  await back.close();
  await h.next('expired');
  h.send({ t: 'game', on: false, phase: 'lobby' });
  assert.deepEqual(await h.next('free'), { t: 'free', slot: 0 });
  assert.equal(srv.room.status().slots[0], null);
});

test('a seat still in its grace is not touched by the way to the lobby, and goes when the grace does', async (t) => {
  const srv = await startServer({ reserveMs: 250 });
  t.after(() => srv.close());
  const h = await host(srv);
  h.send({ t: 'game', on: true, phase: 'results' });
  const a = await pad(srv, 'aaaa');
  await a.next('welcome');
  await a.close();
  await h.next('leave');
  h.send({ t: 'game', on: false, phase: 'lobby' });
  assert.ok(await h.none('free', 80));
  assert.equal(srv.room.status().slots[0].id, 'aaaa');
  assert.deepEqual(await h.next('free', 1000), { t: 'free', slot: 0 });
});

test('a new phone takes an offline seat rather than a new one and is told; the old id then gets what is left', async (t) => {
  const srv = await startServer();
  t.after(() => srv.close());
  const h = await host(srv);
  h.send({ t: 'game', on: true, phase: 'race' });
  const a = await pad(srv, 'aaaa');
  await a.next('welcome');
  const b = await pad(srv, 'bbbb');
  await b.next('welcome');
  await b.close();
  await h.next((m) => m.t === 'leave' && m.slot === 1);
  const tab = await pad(srv, 'newtab');
  const w = await tab.next('welcome');
  assert.equal(w.slot, 1, 'not slot 2, which is empty');
  assert.equal(w.took, true, 'the phone is told');
  assert.deepEqual(await h.next((m) => m.t === 'join' && m.took), { t: 'join', slot: 1, color: SPEC_COLORS[1], took: true });
  assert.equal(srv.room.status().slots[1].id, 'newtab');
  // the older of two offline seats goes first
  await a.close();
  await sleep(5);
  await tab.close();
  await h.next((m) => m.t === 'leave' && m.slot === 1);
  const c = await pad(srv, 'cccc');
  assert.equal((await c.next('welcome')).slot, 0);
  // nothing offline any more but seat 1: the phone that had seat 0 takes it, as a new phone would
  const old = await pad(srv, 'aaaa');
  assert.equal((await old.next('welcome')).slot, 1);
  // with no offline seat and an empty one, it is the empty one, with nothing to tell
  const d = await pad(srv, 'dddd');
  const wd = await d.next('welcome');
  assert.equal(wd.slot, 2);
  assert.equal(wd.took, undefined);
});

test('the queue takes a seat past its grace during a game, and a new phone does not pass the queue', async (t) => {
  const srv = await startServer({ reserveMs: 120 });
  t.after(() => srv.close());
  const h = await host(srv);
  h.send({ t: 'game', on: true, phase: 'race' });
  const [a] = await fourPads(srv);
  const q = await pad(srv, 'queued');
  await q.next('full');
  await a.close();
  const late = await pad(srv, 'late');
  assert.deepEqual(await late.next(), { t: 'full' }, 'behind the one already waiting');
  const w = await q.next('welcome', 1500);
  assert.equal(w.slot, 0);
  assert.equal(w.took, true);
  assert.ok(await h.none('free', 50), 'still no seat freed');
});

test('a network change during a game: no seat is freed, the new ids take them lowest first', async (t) => {
  let nets = { en0: [{ family: 'IPv4', address: '127.0.0.1', internal: false }] };
  const srv = await startServer({ ifaces: () => nets, netPollMs: 3600000 });
  t.after(() => srv.close());
  const h = await host(srv);
  h.send({ t: 'game', on: true, phase: 'race' });
  await h.next('hello');
  await fourPads(srv);
  nets = { en0: [{ family: 'IPv4', address: '172.20.10.2', internal: false }] };
  for (let s = 0; s < 4; s++) {
    const p = await pad(srv, `new${s}`);
    assert.equal((await p.next('welcome')).slot, s);
  }
  assert.ok(await h.none('free', 100));
});

test('a phone that merely blinks: the same socket id back at once loses nothing and frees nothing', async (t) => {
  const srv = await startServer({ reserveMs: 80 });
  t.after(() => srv.close());
  const h = await host(srv);
  const a = await pad(srv, 'aaaa');
  await a.next('welcome');
  await a.close();
  await h.next('leave');
  const a2 = await pad(srv, 'aaaa');
  assert.equal((await a2.next('welcome')).slot, 0);
  assert.ok(await h.none('free', 200), 'its timer is gone with its return');
  assert.equal(srv.room.status().slots[0].connected, true);
});

test('a phone says how it steers: relayed with its slot, anything else dropped', async (t) => {
  const srv = await startServer();
  t.after(() => srv.close());
  const h = await host(srv);
  const a = await pad(srv, 'aaaa');
  await a.next('welcome');
  a.send({ t: 'mode', input: 'telepathy', slot: 3 });
  a.send({ t: 'mode', input: 'gyro', slot: 3 });
  assert.deepEqual(await h.next('mode'), { t: 'mode', slot: 0, input: 'gyro' });
  assert.ok(await h.none('mode'));
});

test('a pad that stops talking is stale after a second, connected or not it is never stale when gone, a word clears it', () => {
  let t = 0;
  const handlers = new Set();
  const transport = { onMessage(fn) { handlers.add(fn); return () => handlers.delete(fn); }, send() { return true; } };
  const say = (m) => { for (const fn of handlers) fn(m); };
  const input = createInput(transport, { keyboard: null, now: () => t, staleMs: 1000 });
  assert.equal(input.padStale(0), false);
  say({ t: 'join', slot: 0 });
  assert.equal(input.padStale(0), false);
  t = 1001;
  assert.equal(input.padStale(0), true);
  say({ t: 'in', slot: 0, x: 0, y: 0, b: 0, d: 0, seq: 1 });
  assert.equal(input.padStale(0), false);
  t = 5000;
  say({ t: 'leave', slot: 0 });
  assert.equal(input.padStale(0), false);
  assert.equal(input.padStale(9), false);
});

// ---------- the evening's numbers ----------
test('telemetry: only well formed lines of a known kind, size capped; a server without a folder writes nothing; a failure is silent', async (t) => {
  const line = (m) => telemetryLine(m, new Date('2026-11-06T20:00:00Z'));
  const race = { e: 'race', track: 'bran', mode: 'teams', difficulty: 'easy', karts: [{ slot: 0, human: true, kart: 'gatto', place: 2, time: 201.4, bestLap: 70.1, wall: 3, botS: 0 }] };
  assert.deepEqual(JSON.parse(line(race)), { at: '2026-11-06T20:00:00.000Z', ...race });
  for (const bad of [null, 5, [], {}, { e: 'nope' }, { e: 'race', x: '<script>' }, { e: 'race', 'a b': 1 }, { e: 'race', t: NaN }, { e: 'race', a: { b: { c: { d: { f: 1 } } } } },
    { e: 'race', list: Array(17).fill(1) }, { e: 'race', s: 'x'.repeat(49) }, { e: 'race', f() {} }, { e: 'race', ...Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`k${i}`, 'v'])) }]) {
    assert.equal(line(bad), null, JSON.stringify(bad));
  }
  const dir = mkdtempSync(join(tmpdir(), 'rk-tm-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  // a blocked folder: a file where the folder should be
  const blocked = join(dir, 'blocked');
  writeFileSync(blocked, 'x');
  const said = [];
  const off = createTelemetry({ dir: blocked, log: (m) => said.push(m) });
  off.write(race);
  off.write(race);
  await off.flushed();
  assert.equal(said.length, 1, 'said once, and nothing thrown');
  const tm = createTelemetry({ dir: join(dir, 'deep', 'telemetry'), maxFile: 700 });
  for (let i = 0; i < 5; i++) tm.write({ ...race, n: i });
  await tm.flushed();
  const [file] = readdirSync(join(dir, 'deep', 'telemetry'));
  const lines = readFileSync(join(dir, 'deep', 'telemetry', file), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.deepEqual(lines.map((l) => l.n), [0, 1, 2], 'in order, and the day\'s file stops at its cap');
});

test('telemetry on a real server: what the TV sends and each drop and return land in the file; the report prints people against bots', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'rk-tm-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const srv = await startServer({ telemetryDir: dir });
  t.after(() => srv.close());
  const h = await host(srv);
  h.send({ t: 'game', on: true, phase: 'race' });
  h.send({ t: 'tm', d: { e: 'session', difficulty: 'easy', bots: 6, laps: 3, mode: 'race', weather: 'clear', night: false, humans: 2, lang: 'it' } });
  h.send({ t: 'tm', d: { e: 'nonsense', a: 1 } });
  h.send({ t: 'tm', d: { e: 'race', track: 'bran', mode: 'teams', difficulty: 'easy', laps: 3, weather: 'clear', night: true, karts: [
    { slot: -1, human: false, kart: 'tabia', place: 1, time: 200, bestLap: 65.2, wall: 0, botS: 0 },
    { slot: 0, human: true, kart: 'gatto', place: 2, time: 215, bestLap: 70.4, wall: 4, botS: 0 },
    { slot: 1, human: true, kart: 'jeep', place: 3, time: 230, bestLap: 74.1, wall: 7, building: 2, botS: 30, input: 'stick' },
  ] } });
  const a = await pad(srv, 'aaaa');
  await a.next('welcome');
  a.send('x'.repeat(5000));
  await a.close();
  await h.next('leave');
  const a2 = await pad(srv, 'aaaa');
  await a2.next('welcome');
  await sleep(150);
  const [file] = readdirSync(dir);
  const lines = readFileSync(join(dir, file), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.deepEqual(lines.map((l) => l.e), ['session', 'race', 'drop', 'back']);
  assert.match(lines[2].why, /closed/);
  assert.equal(lines[2].phase, 'race');
  assert.ok(lines[3].ms >= 0 && lines[3].took === false);
  assert.ok(!JSON.stringify(lines).includes('aaaa'), 'no phone id in the file');
  const out = execFileSync(process.execPath, ['tools/telemetry-report.mjs', dir], { cwd: new URL('..', import.meta.url), encoding: 'utf8' }).trim().split('\n');
  assert.match(out[0], /bran teams easy clear\+night: P1 1:10\.4 place 2, 4w, P2 1:14\.1\* place 3, 7w 2b stick \| bots best 1:05\.2 mean 1:05\.2, gap 5\.2 s/);
  assert.match(out[1], /^1 races, 1 phone drops, 1 returns/);
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
  const said = [];
  const srv = await startServer({ padSilentMs: 400, reserveMs: 60000, log: (m) => said.push(m) });
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
  assert.ok(said.some((l) => /left slot 0 \(silent \d+ ms\)/.test(l)), `the log tells a silence from a close: ${said}`);
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
