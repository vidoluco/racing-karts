// The secret family karts: Baileys and Fifi. Rules in node (the stats, what a win opens, what is saved, the bots never get them, the bite
// and that a race without Baileys has none of it), then the real path: the server as its own process, the TV page, a real pad page by touch,
// from a locked line-up through a won Gran Premio to the unlocked kart picked on the phone and raced to the results.
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KARTS, KART_IDS, SECRET_KARTS, SECRET_IDS, ROSTER, kartInfo } from '../src/data/karts.js';
import { createUnlocks, UNLOCK_KEY } from '../src/game/unlocks.js';
import { createFlow, padFx } from '../src/game/flow.js';
import { kartPhysics, createRace } from '../src/sim/index.js';
import { BITE, DT } from '../src/sim/tuning.js';
import { buildTrack } from '../src/world/track.js';
import { buildTerrain } from '../src/world/terrain.js';
import { loadTrackDef } from '../src/data/tracks.js';
import { DRIVERS, SFX } from '../src/audio/sfx.js';
import { rng32 } from '../src/audio/dsp.js';
import { KART_SOUND } from '../src/audio/engine.js';
import { launch, headlessShell, buildDist, startServerProcess, openPad } from '../tools/harness.mjs';
import { ROOT } from '../tools/render-dev.mjs';

const memory = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };

describe('the two karts in the roster', () => {
  test('stats inside the roster: sum 15, none strictly better than a kart of the nine', () => {
    assert.deepEqual(SECRET_IDS, ['baileys', 'fifi']);
    assert.equal(KARTS.length, 9, 'the nine stay nine');
    assert.ok(!KART_IDS.some((id) => SECRET_IDS.includes(id)));
    for (const k of SECRET_KARTS) {
      const s = k.stats, names = ['speed', 'accel', 'handling', 'weight', 'offroad'];
      assert.equal(names.reduce((a, n) => a + s[n], 0), 15, k.id);
      for (const n of names) assert.ok(s[n] >= 1 && s[n] <= 5, `${k.id} ${n}`);
      for (const o of KARTS) assert.ok(names.some((n) => s[n] < o.stats[n]) || names.every((n) => s[n] === o.stats[n]), `${k.id} beats ${o.id} everywhere`);
      for (const n of names) assert.ok(Math.min(...KARTS.map((o) => o.stats[n])) <= s[n] && s[n] <= Math.max(...KARTS.map((o) => o.stats[n])), `${k.id} ${n} out of the roster's range`);
      assert.equal(kartInfo(k.id), k);
      assert.ok(Number.isFinite(kartPhysics(k.id).top));
      assert.ok(DRIVERS[k.id] > 0 && KART_SOUND[k.id], 'its own voice and engine');
      for (const t of [k.driver.species, k.driver.line, k.concept]) { assert.ok(t.it && t.en); assert.ok(!`${t.it}${t.en}`.includes(String.fromCodePoint(0x2014))); }
      assert.ok(existsSync(join(ROOT, `assets/ui/karts/${k.id}.png`)), 'its picture for the phone');
    }
    assert.equal(ROSTER.length, 11);
  });
});

test('the sounds render, with a voice in them, and the engines name real ticks', () => {
  for (const name of ['biteChomp', 'panClank']) {
    const b = SFX[name](44100, rng32(7)), L = b.left ?? b.l ?? b[0] ?? b;
    let peak = 0;
    for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]));
    assert.ok(L.length > 8000 && peak > 0.2 && peak <= 1.01, `${name}: ${L.length} samples, peak ${peak}`);
  }
  assert.ok(SFX[KART_SOUND.fifi.tick.name]);
});

describe('unlocks', () => {
  test('nothing at first, the first Gran Premio opens Baileys, the second Fifi, the third nothing new; all saved', () => {
    const store = memory(), u = createUnlocks(store);
    assert.deepEqual(u.open, []);
    assert.equal(u.locked, 2);
    assert.equal(u.winGp(), 'baileys');
    assert.equal(store.getItem(UNLOCK_KEY), '1');
    assert.deepEqual(createUnlocks(store).open, ['baileys'], 'it is there next evening');
    assert.equal(u.winGp(), 'fifi');
    assert.equal(u.locked, 0);
    assert.equal(u.winGp(), null);
    assert.deepEqual(createUnlocks(store).open, ['baileys', 'fifi']);
  });
  test('rubbish or a browser that refuses storage: locked, and the evening goes on', () => {
    for (const bad of ['', 'x', '-3', '1.5']) assert.deepEqual(createUnlocks(memory({ [UNLOCK_KEY]: bad })).open, [], bad);
    const refuses = { getItem() { throw new Error('no'); }, setItem() { throw new Error('no'); } }, u = createUnlocks(refuses);
    assert.deepEqual(u.open, []);
    assert.equal(u.winGp(), 'baileys');
    assert.deepEqual(u.open, ['baileys']);
    assert.deepEqual(createUnlocks(null).open, []);
  });
});

describe('the flow', () => {
  const TRACKS = ['a', 'b'];
  const make = (secret = []) => createFlow({ karts: KART_IDS, secret, tracks: TRACKS, rng: () => 0.3 });
  test('locked: refused, and the phone is offered the nine', () => {
    const f = make();
    f.join(0); f.go();
    assert.deepEqual(f.menuFor(0).karts, KART_IDS);
    for (const id of SECRET_IDS) assert.equal(f.pick(0, id, true), false, id);
    assert.equal(f.seats[0].kart, null);
  });
  test('unlocked: a player can pick it, the bots still never take one, even over many fields', () => {
    const f = make(SECRET_IDS);
    f.join(0); f.go();
    assert.deepEqual(f.menuFor(0).karts, [...KART_IDS, ...SECRET_IDS]);
    assert.equal(f.pick(0, 'baileys', true), true);
    f.step(5); f.vote(0, 'a', true); f.step(5); f.step(5);
    const field = f.field();
    assert.equal(field.find((p) => p.human).kart, 'baileys');
    assert.equal(field.length, 8);
    for (const p of field) if (!p.human) assert.ok(KART_IDS.includes(p.kart), p.kart);
  });
  const gp = (winnerHuman) => {
    const f = make();
    f.join(0); f.setOpts({ mode: 'gp' }); f.go(); f.pick(0, 'jeep', true); f.step(5);
    f.gpToggle('a'); f.gpToggle('b'); f.gpStart();
    const rows = (hPlace) => [{ i: 0, slot: 0, kart: 'jeep', human: true, place: hPlace, time: 1, bestLap: 1 }, { i: 1, slot: -1, kart: 'tabia', human: false, place: hPlace === 1 ? 2 : 1, time: 1, bestLap: 1 }];
    f.loaded(); f.raceDone(rows(winnerHuman ? 1 : 2));
    const mid = f.drain().filter((e) => e.type === 'gpWon');
    assert.equal(mid.length, 0, 'not before the last race');
    f.next('rematch'); f.loaded(); f.raceDone(rows(winnerHuman ? 1 : 2));
    return { f, won: f.drain().filter((e) => e.type === 'gpWon') };
  };
  test('a Gran Premio won by a player counts; one won by a bot does not', () => {
    const a = gp(true);
    assert.deepEqual(a.won.map((e) => e.slot), [0]);
    assert.equal(gp(false).won.length, 0);
  });
  test('a single race never counts, and until something is won a phone hears nothing of it', () => {
    const f = make();
    f.join(0); f.go(); f.pick(0, 'jeep', true); f.step(5); f.vote(0, 'a', true); f.step(5); f.step(5); f.loaded();
    f.raceDone([{ i: 0, slot: 0, kart: 'jeep', human: true, place: 1, time: 1, bestLap: 1 }]);
    assert.equal(f.drain().filter((e) => e.type === 'gpWon').length, 0);
    assert.ok(!('unlocked' in f.menuFor(0)));
    f.announce('baileys');
    assert.equal(f.menuFor(0).unlocked, 'baileys');
    f.next('rematch'); f.loaded(); f.raceDone([{ i: 0, slot: 0, kart: 'jeep', human: true, place: 1, time: 1, bestLap: 1 }]);
    assert.equal(f.menuFor(0).unlocked, null, 'said once, and the phone is told to forget it');
  });
  test('a bite shakes the phone of the one who bit', () => {
    assert.deepEqual(padFx([{ type: 'bite', kart: 0, victim: 1 }], [{ slot: 2, human: true }, { slot: -1, human: false }]), [{ slot: 2, kind: 'bump' }]);
  });
});

describe('the bite', () => {
  let world = null;
  const getWorld = async () => { if (!world) { const track = buildTrack(await loadTrackDef('antelao')); world = { track, terrain: buildTerrain(track) }; } return world; };
  // kart 1 three metres to the left of kart 0, going the same way: close, not touching
  const beside = (r) => { const a = r.state.karts[0], b = r.state.karts[1]; b.x = a.x + Math.cos(a.yaw) * 3; b.z = a.z - Math.sin(a.yaw) * 3; b.y = a.y; b.yaw = a.yaw; b.vx = a.vx; b.vz = a.vz; b.vy = 0; };
  const race = async (kart0, opts = {}) => {
    const { track, terrain } = await getWorld();
    const players = [{ slot: 0, kart: kart0, human: true }, { slot: 1, kart: 'jeep', human: true }, { slot: 2, kart: 'tabia', human: true }];
    const r = createRace({ track, terrain, seed: 5, laps: 3, players, countdown: 0, ...opts });
    // past the first moments of a race, when the grid is close and he leaves everyone alone
    for (let f = 0; f < Math.ceil(BITE.grace / DT) + 2; f++) r.step([{ steer: 0, throttle: 1 }, { steer: 0, throttle: 1 }, { steer: 0, throttle: 1 }]);
    r.teleport(0, 0.3, 0, { speed: 20 }); beside(r); r.teleport(2, 0.6, 0, { speed: 20 });
    r.state.karts.forEach((k) => { k.safeT = 0; });
    r.drainEvents();
    return r;
  };
  const go = (r, n, fn) => { const all = []; for (let f = 0; f < n; f++) { r.step([{ steer: 0, throttle: 1 }, { steer: 0, throttle: 1 }, { steer: 0, throttle: 1 }]); fn?.(); all.push(...r.drainEvents()); } return all; };

  test('stay close: ears first, then a short slide; the cooldown holds', async () => {
    const r = await race('baileys'), K = r.state.karts;
    const hold = () => beside(r);
    let wound = 0;
    const seen = go(r, Math.ceil(BITE.wind / DT) + 2, () => { hold(); wound = Math.max(wound, K[0].biteWind); });
    const bites = seen.filter((e) => e.type === 'bite');
    assert.ok(wound > 0.4, `the windup shows: ${wound}`);
    assert.equal(bites.length, 1);
    assert.equal(bites[0].victim, 1);
    assert.equal(bites[0].side, 1, 'on his left');
    assert.ok(seen.some((e) => e.type === 'hit' && e.kart === 1 && e.by === 0 && e.kind === 'slide' && e.cause === 'bite'));
    assert.ok(r.internals.priv[1].stickyT > 0 && r.internals.priv[1].stickyT <= BITE.t, 'a short one');
    assert.equal(K[1].hitT, 0, 'a nibble, no spin');
    const more = go(r, Math.floor((BITE.cooldown - 0.3) / DT), hold);
    assert.equal(more.filter((e) => e.type === 'bite').length, 0, 'he has had enough for now');
    const later = go(r, Math.ceil((BITE.wind + 0.8) / DT), hold);
    assert.ok(later.filter((e) => e.type === 'bite').length >= 1, 'and then he has not');
  });
  test('a clean pass is safe, sausages take it, a big kart cannot be bitten', async () => {
    const pass = await race('baileys'), K = pass.state.karts;
    const n = Math.ceil(BITE.wind / DT) - 6;
    assert.equal(go(pass, n, () => beside(pass)).filter((e) => e.type === 'bite').length, 0);
    go(pass, 20, () => { pass.teleport(1, 0.8, 0, { speed: 20 }); });
    assert.equal(K[0].biteWind, 0, 'it passes');

    const mici = await race('baileys');
    mici.give(1, 'mici');
    const out = go(mici, 30, () => beside(mici));
    assert.ok(out.some((e) => e.type === 'bite'));
    assert.ok(out.some((e) => e.type === 'shield' && e.kart === 1 && e.cause === 'bite'));
    assert.equal(mici.state.karts[1].orbit, 2);

    const big = await race('baileys');
    big.state.karts[1].bigT = 5;
    assert.equal(go(big, 30, () => { big.state.karts[1].bigT = 5; beside(big); }).filter((e) => e.type === 'bite').length, 0);
  });
  test('not at the start: the grid is close and he leaves it alone for the first moments', async () => {
    const { track, terrain } = await getWorld();
    const r = createRace({ track, terrain, seed: 5, laps: 3, countdown: 0, players: [{ slot: 0, kart: 'baileys', human: true }, { slot: 1, kart: 'jeep', human: true }, { slot: 2, kart: 'tabia', human: true }] });
    let n = 0;
    for (let f = 0; f < Math.floor(BITE.grace / DT) - 1; f++) { beside(r); r.step([{ steer: 0, throttle: 1 }, { steer: 0, throttle: 1 }, { steer: 0, throttle: 1 }]); n += r.drainEvents().filter((e) => e.type === 'bite').length; }
    assert.equal(n, 0);
  });
  test('deterministic with him in the race', async () => {
    const run = async () => { const r = await race('baileys'); go(r, 500); return JSON.stringify(r.state); };
    assert.equal(await run(), await run());
  });
  test('NEGATIVE: a race without him has no bite, no field for it, and no state for it', async () => {
    for (const kart of ['tabia', 'fifi']) {
      const r = await race(kart), K = r.state.karts;
      const ev = go(r, 400, () => beside(r));
      assert.equal(ev.filter((e) => e.type === 'bite' || e.cause === 'bite').length, 0, kart);
      for (const k of K) assert.ok(!('biteWind' in k), `${kart}: no bite state`);
    }
  });
});

test('the model answers: the head goes round to the side of the victim, the fangs show, and it settles', async () => {
  const THREE = await import('three');
  const { createMat, createShared, resolveLook } = await import('../src/render/toon.js');
  const shapes = await import('../src/render/shapes.js');
  const { createKartPool } = await import('../src/render/models.js');
  const ctx = { THREE, mat: createMat(createShared(resolveLook({}))), shapes };
  const pool = createKartPool(new THREE.Scene(), ctx, { time: { value: 0 } });
  await pool.set([{ kart: 'baileys', color: '#fff' }, { kart: 'fifi', color: '#fff' }]);
  assert.ok(!pool.karts[0].model.placeholder && !pool.karts[1].model.placeholder, 'the real models, through the loader');
  const m = pool.karts[0].model, K = { speed: 25, steer: 0, throttle: 1, grounded: true, vy: 0, yaw: 0, drift: 0, boostT: 0, hitT: 0, tipsyT: 0, stinkT: 0, bigT: 0, finished: false, place: 1, orbit: 0, biteWind: 0 };
  const run = (n, k = K) => { for (let i = 0; i < n; i++) m.update(k, 1 / 60); };
  run(40);
  const head = m.bones.get('head'), mouth = m.bones.get('mouth'), yaw0 = head.rotation.y, ear0 = m.bones.get('earL').rotation.z;
  assert.ok(mouth.scale.x < 0.9, 'mouth not wide open at speed');
  run(12, { ...K, biteWind: 1 });
  assert.ok(m.bones.get('earL').rotation.z < ear0 - 0.3, 'the ears go flat on the windup');
  pool.onEvent({ type: 'bite', kart: 0, victim: 1, side: 1 });
  run(9);
  assert.ok(head.rotation.y > yaw0 + 0.6, `left: ${head.rotation.y}`);
  assert.ok(mouth.scale.x > 1, 'mouth wide');
  run(60);
  assert.ok(Math.abs(head.rotation.y - yaw0) < 0.15, 'and back');
  pool.onEvent({ type: 'bite', kart: 0, victim: 1, side: -1 });
  run(9);
  assert.ok(head.rotation.y < yaw0 - 0.6, `right: ${head.rotation.y}`);
  // Fifi's pans swing with the turn, the pot's lid dances, the ladle only comes out to win
  const f = pool.karts[1].model, st = { ...K, steer: 1 };
  for (let i = 0; i < 50; i++) f.update(st, 1 / 60);
  assert.ok(Math.abs(f.bones.get('panL').rotation.z) > 0.1 && f.bones.get('lid').position.y !== f.bones.get('lid').userData.rest.y);
  assert.ok(f.bones.get('ladle').scale.x < 0.01);
  for (let i = 0; i < 60; i++) f.update({ ...K, speed: 0, finished: true, place: 1 }, 1 / 60);
  assert.ok(f.bones.get('ladle').scale.x > 0.8);
});

// ---------- the real path ----------
const skip = !headlessShell() && 'no chromium';
const dist = mkdtempSync(join(tmpdir(), 'rk-family-'));
let browser = null;
after(async () => { await browser?.close().catch(() => {}); rmSync(dist, { recursive: true, force: true }); });

const padIs = (p, phase, ms = 15000) => p.page.waitForFunction((q) => window.__pad.phase === q, phase, { timeout: ms });
const tvIs = (tv, phase, ms = 180000) => tv.waitForFunction((q) => window.__game.phase === q || window.__game.error, phase, { timeout: ms });
const tap = (p, sel) => p.page.locator(sel).tap();
const ids = (p) => p.page.evaluate(() => window.__pad.carousel.ids);

async function setup(t, state) {
  if (!browser) { await buildDist(dist); browser = await launch('metal'); }
  const srv = await startServerProcess({ dist });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'en-US' });
  if (state) await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch { /* */ } }, [UNLOCK_KEY, String(state)]);
  const tv = await ctx.newPage(), errors = [];
  tv.on('pageerror', (e) => errors.push(e.message));
  await tv.goto(`${srv.base}/?lang=en`);
  await tv.waitForFunction(() => window.__game?.ready || window.__game?.error, null, { timeout: 120000 });
  assert.equal(await tv.evaluate(() => window.__game.error), null);
  const pad = await openPad(browser, srv.base, { label: 'phone' });
  t.after(async () => { await pad.ctx.close().catch(() => {}); await ctx.close().catch(() => {}); await srv.close(); });
  return { srv, tv, pad, errors, ctx };
}
// A phone swipes the carousel to a card, in the direction a thumb would.
async function carouselTo(p, id) {
  for (let guard = 0; guard < 14; guard++) {
    const now = await p.page.evaluate(() => window.__pad.carousel.focus);
    if (now === id) return;
    const list = await ids(p), dir = list.indexOf(id) > list.indexOf(now) ? -1 : 1;
    await new Promise((res) => setTimeout(res, 450)); // the cards are still sliding from the last swipe
    const c = await p.page.evaluate(() => { const r = window.__pad.carousel.rect(window.__pad.carousel.focus); return { x: r.x, y: r.y }; });
    const touch = (type, points) => p.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
    await touch('touchStart', [{ ...c, id: 1 }]);
    for (let i = 1; i <= 5; i++) await touch('touchMove', [{ x: c.x + (dir * 90 * i) / 5, y: c.y, id: 1 }]);
    await touch('touchEnd', [{ x: c.x + dir * 90, y: c.y, id: 1 }]);
    await p.page.waitForFunction((k) => window.__pad.carousel.focus !== k, now, { timeout: 3000 });
  }
  throw new Error(`never reached ${id}`);
}
const setOpt = async (tv, pad, key, v) => { await tap(pad, `.seg[data-key="${key}"] button[data-v="${v}"]`); await tv.waitForFunction(([k, q]) => String(window.__game.flowApi.opts[k]) === String(q), [key, v], { timeout: 4000 }); };
const setBots = async (tv, pad, bots) => {
  for (let guard = 0; guard < 8 && (await tv.evaluate(() => window.__game.flowApi.opts.bots)) !== bots; guard++) {
    const now = await tv.evaluate(() => window.__game.flowApi.opts.bots);
    await tap(pad, `.step button[data-d="${now > bots ? -1 : 1}"]`);
    await tv.waitForFunction((n) => window.__game.flowApi.opts.bots === n, now + (now > bots ? -1 : 1), { timeout: 4000 });
  }
};
// Past the flyover and the countdown, then the human kart is taken to its last metres so that a win takes seconds and the rest of the path is real.
async function winRace(tv, pad, { speed = 8 } = {}) {
  await tvIs(tv, 'race');
  await tv.waitForFunction(() => window.__game.state, null, { timeout: 15000 });
  await tv.evaluate(() => window.__game.skipFlyover());
  await tv.waitForFunction(() => !window.__game.flyover && window.__game.state?.phase === 'race', null, { timeout: 25000 });
  await tv.evaluate((sp) => {
    const g = window.__game; g.speed = sp; g.setAuto(true);
    const me = g.state.karts.find((k) => k.human);
    g.teleport(me.i, 0.985, 0, { speed: 28, lap: g.laps - 1 });
  }, speed);
  await tvIs(tv, 'results', 240000);
  await padIs(pad, 'results', 15000);
  await tv.evaluate(() => { window.__game.speed = 1; window.__game.setAuto(false); });
}
const resultsOf = (tv) => tv.evaluate(() => window.__game.results.map((r) => ({ kart: r.kart, human: r.human, place: r.place })));

test('NEGATIVE, a fresh browser: nine karts on the TV and the phone, a hint on the TV, the secret ones refused, bots without them', { skip, timeout: 420000 }, async (t) => {
  const { tv, pad, errors } = await setup(t);
  await padIs(pad, 'lobby');
  await setBots(tv, pad, 3);
  await setOpt(tv, pad, 'laps', 2);
  await tap(pad, '#goBtn');
  await tvIs(tv, 'pick');
  await padIs(pad, 'pick');
  await pad.page.waitForFunction(() => window.__pad.carousel?.focus, null, { timeout: 5000 });
  assert.deepEqual(await ids(pad), KART_IDS);
  const tvCards = await tv.evaluate(() => [...document.querySelectorAll('.pick .kc')].map((c) => c.dataset.id));
  assert.deepEqual(tvCards, KART_IDS);
  const hint = await tv.evaluate(() => { const h = document.querySelector('.pick .secret'); return { hidden: h.classList.contains('hide'), text: h.textContent }; });
  assert.equal(hint.hidden, false);
  assert.match(hint.text, /two secret karts/);
  // a phone that sends the id all the same gets nowhere
  assert.equal(await tv.evaluate(() => window.__game.flowApi.pick(0, 'baileys', true)), false);
  assert.equal(await tv.evaluate(() => window.__game.flowApi.pick(0, 'fifi', true)), false);
  const first = await pad.page.evaluate(() => window.__pad.carousel.focus);
  await tv.waitForFunction((k) => window.__game.seats[0].kart === k, first, { timeout: 5000 }).catch(() => {});
  await tap(pad, '#readyBtn');
  await tvIs(tv, 'vote');
  await padIs(pad, 'vote');
  await tv.evaluate(() => { window.__game.flowApi.forceTrack('antelao'); });
  await tvIs(tv, 'race');
  await tv.waitForFunction(() => window.__game.players?.length === 4, null, { timeout: 20000 });
  const field = await tv.evaluate(() => window.__game.players.map((p) => p.kart));
  for (const k of field) assert.ok(KART_IDS.includes(k), k);
  await winRace(tv, pad);
  // a single race won: still locked, nothing announced, nothing saved
  assert.equal(await tv.evaluate((k) => localStorage.getItem(k), UNLOCK_KEY), null);
  assert.equal(await pad.page.evaluate(() => document.getElementById('resUnlock').classList.contains('hide')), true);
  assert.deepEqual(await tv.evaluate(() => window.__game.counts.bite || 0), 0);
  assert.deepEqual(errors, []);
});

test('a Gran Premio won on the phone opens Baileys: told on TV and phone, saved, picked on the phone, raced to the results, and he bites', { skip, timeout: 720000 }, async (t) => {
  const { tv, pad, errors } = await setup(t);
  await padIs(pad, 'lobby');
  await setBots(tv, pad, 1);
  await setOpt(tv, pad, 'laps', 2);
  await setOpt(tv, pad, 'mode', 'gp');
  await tap(pad, '#goBtn');
  await tvIs(tv, 'pick');
  await pad.page.waitForFunction(() => window.__pad.carousel?.focus, null, { timeout: 5000 });
  await tap(pad, '#readyBtn');
  await tvIs(tv, 'vote');
  await padIs(pad, 'vote');
  // the phone composes the list: confirming a card adds it, confirming the random card starts
  await pad.page.waitForFunction(() => window.__pad.carousel?.focus, null, { timeout: 5000 });
  for (const id of ['antelao', 'pelmo']) {
    await carouselTo(pad, id);
    await tap(pad, '#voteBtn');
    await tv.waitForFunction((k) => window.__game.flowApi.state.list.includes(k), id, { timeout: 4000 });
  }
  await carouselTo(pad, 'random');
  await tap(pad, '#voteBtn');
  await tv.waitForFunction(() => window.__game.flowApi.state.gp?.tracks.join() === 'antelao,pelmo', null, { timeout: 5000 });
  await winRace(tv, pad);
  assert.equal(await tv.evaluate((k) => localStorage.getItem(k), UNLOCK_KEY), null, 'one race of two: nothing yet');
  await tap(pad, '#resAgain');
  await tv.waitForFunction(() => window.__game.phase === 'loading' || window.__game.phase === 'race', null, { timeout: 20000 });
  await winRace(tv, pad);

  // told, on the phone straight away and on the TV's podium
  await pad.page.waitForFunction(() => !document.getElementById('resUnlock').classList.contains('hide'), null, { timeout: 8000 });
  assert.match(await pad.page.textContent('#resUnlock span'), /Baileys/);
  await pad.page.waitForFunction(() => document.querySelector('#resUnlock img').naturalWidth > 100, null, { timeout: 8000 });
  assert.equal(await tv.evaluate((k) => localStorage.getItem(k), UNLOCK_KEY), '1');
  await tv.evaluate(() => window.__game.next('podium'));
  await tvIs(tv, 'podium', 20000);
  await tv.waitForFunction(() => document.querySelector('.podscr .unlockc img')?.naturalWidth > 100, null, { timeout: 8000 });
  assert.match(await tv.textContent('.podscr .unlockc'), /Baileys/);
  if (process.env.FAMILY_SHOTS) { await new Promise((r) => setTimeout(r, 900)); await tv.screenshot({ path: join(process.env.FAMILY_SHOTS, 'family-podium.png') }); await pad.page.screenshot({ path: join(process.env.FAMILY_SHOTS, 'family-pad-won.png') }); }

  // a new evening on the same browser: saved
  await tv.reload();
  await tv.waitForFunction(() => window.__game?.ready, null, { timeout: 120000 });
  assert.deepEqual(await tv.evaluate(() => window.__game.unlocks.open), ['baileys'], 'saved through a reload');
  await pad.page.waitForFunction(() => window.__pad.joined, null, { timeout: 15000 }).catch(() => {});
  await tv.waitForFunction(() => window.__game.seats[0]?.present, null, { timeout: 20000 });
  await padIs(pad, 'lobby', 20000);

  // the phone offers him, the line-up shows him, and the phone picks him
  await setOpt(tv, pad, 'laps', 2);
  await setBots(tv, pad, 1);
  await setOpt(tv, pad, 'mode', 'race');
  await tap(pad, '#goBtn');
  await tvIs(tv, 'pick');
  await padIs(pad, 'pick');
  await pad.page.waitForFunction(() => window.__pad.carousel?.ids?.includes('baileys'), null, { timeout: 5000 });
  assert.deepEqual(await ids(pad), [...KART_IDS, 'baileys'], 'Fifi still locked');
  assert.deepEqual(await tv.evaluate(() => [...document.querySelectorAll('.pick .kc')].map((c) => c.dataset.id)), [...KART_IDS, 'baileys']);
  assert.match(await tv.textContent('.pick .secret'), /One secret kart left/);
  await tv.waitForFunction(() => document.querySelector('.pick .kc[data-id="baileys"] canvas'), null, { timeout: 30000 });
  await carouselTo(pad, 'baileys');
  await pad.page.waitForFunction(() => {
    const c = document.querySelector('#kartCar .vc[data-id="baileys"]'), img = c?.querySelector('img');
    return img?.classList.contains('ok') && img.naturalWidth > 100 && c.querySelector('.nm').textContent === 'La Cuccia' && /Baileys/.test(c.querySelector('.dr').textContent) && c.querySelectorAll('.bars .bar').length === 5;
  }, null, { timeout: 8000 });
  await tv.waitForFunction(() => window.__game.seats[0].kart === 'baileys', null, { timeout: 5000 });
  if (process.env.FAMILY_SHOTS) await tv.screenshot({ path: join(process.env.FAMILY_SHOTS, 'family-pick.png') });
  if (process.env.FAMILY_SHOTS) await pad.page.screenshot({ path: join(process.env.FAMILY_SHOTS, 'family-pad.png') });
  await tap(pad, '#readyBtn');
  await tvIs(tv, 'vote');
  await tv.evaluate(() => { window.__game.flowApi.forceTrack('antelao'); });
  await tvIs(tv, 'race');
  await tv.waitForFunction(() => window.__game.state, null, { timeout: 15000 });
  await tv.evaluate(() => window.__game.skipFlyover());
  await tv.waitForFunction(() => !window.__game.flyover && window.__game.state?.phase === 'race', null, { timeout: 25000 });
  const race = await tv.evaluate(() => window.__game.players);
  assert.equal(race.find((p) => p.human).kart, 'baileys');
  assert.ok(race.filter((p) => !p.human).every((p) => p.kart !== 'baileys' && p.kart !== 'fifi'), 'no bot has a family kart');
  // the bot alongside: he bites it, the HUD and the sim agree, and the model snaps
  await tv.evaluate(() => {
    const g = window.__game, me = g.state.karts.find((k) => k.human), bot = g.state.karts.find((k) => !k.human);
    window.__keep = setInterval(() => { if (g.state?.phase === 'race' && !me.finished) { bot.x = me.x + Math.cos(me.yaw) * 3; bot.z = me.z - Math.sin(me.yaw) * 3; bot.y = me.y; bot.vx = me.vx; bot.vz = me.vz; } }, 8);
  });
  await tv.waitForFunction(() => (window.__game.counts.bite || 0) >= 1, null, { timeout: 30000 });
  await tv.evaluate(() => clearInterval(window.__keep));
  assert.ok(await tv.evaluate(() => (window.__game.counts.hit || 0) >= 1 || (window.__game.counts.shield || 0) >= 1));
  await winRace(tv, pad);
  const rows = await resultsOf(tv);
  assert.equal(rows.find((r) => r.human).kart, 'baileys');
  // the results table knows his name and shows a thumbnail
  const row = await tv.evaluate(() => document.querySelector('.results')?.textContent || '');
  assert.match(row, /Baileys|Player 1|You/i);
  assert.deepEqual(errors, []);
});

test('two wins already saved: both family karts on the phone and in two rows on the TV, Fifi races', { skip, timeout: 420000 }, async (t) => {
  const { tv, pad, errors } = await setup(t, 2);
  await padIs(pad, 'lobby');
  await setBots(tv, pad, 1);
  await setOpt(tv, pad, 'laps', 2);
  await tap(pad, '#goBtn');
  await tvIs(tv, 'pick');
  await pad.page.waitForFunction(() => window.__pad.carousel?.ids?.includes('fifi'), null, { timeout: 5000 });
  assert.deepEqual(await ids(pad), [...KART_IDS, ...SECRET_IDS]);
  assert.equal(await tv.evaluate(() => document.querySelector('.pick .secret').classList.contains('hide')), true, 'no more hint');
  // eleven cards in the same space: nothing off screen, nothing under the panel
  await tv.waitForFunction(() => document.querySelector('.pick .kc[data-id="fifi"] canvas'), null, { timeout: 40000 });
  const layout = await tv.evaluate(() => { const r = (e) => e.getBoundingClientRect(), cards = [...document.querySelectorAll('.pick .kc')].map(r), bar = r(document.querySelector('.pick .pbar')); return { n: cards.length, rows: new Set(cards.map((c) => Math.round(c.top))).size, bottom: Math.max(...cards.map((c) => c.bottom)), right: Math.max(...cards.map((c) => c.right)), left: Math.min(...cards.map((c) => c.left)), barTop: bar.top, W: innerWidth }; });
  assert.equal(layout.n, 11);
  assert.equal(layout.rows, 2);
  assert.ok(layout.bottom <= layout.barTop + 1, `cards ${layout.bottom}, panel ${layout.barTop}`);
  assert.ok(layout.left >= 0 && layout.right <= layout.W);
  await carouselTo(pad, 'fifi');
  await tv.waitForFunction(() => window.__game.seats[0].kart === 'fifi', null, { timeout: 5000 });
  if (process.env.FAMILY_SHOTS) await tv.screenshot({ path: join(process.env.FAMILY_SHOTS, 'family-pick2.png') });
  await tap(pad, '#readyBtn');
  await tvIs(tv, 'vote');
  await tv.evaluate(() => { window.__game.flowApi.forceTrack('antelao'); });
  await tvIs(tv, 'race');
  await winRace(tv, pad);
  assert.equal((await resultsOf(tv)).find((r) => r.human).kart, 'fifi');
  assert.equal(await tv.evaluate(() => window.__game.counts.bite || 0), 0, 'she does not bite');
  assert.deepEqual(errors, []);
});
