#!/usr/bin/env node
// The pictures of the README, through the real page and the real server, frames stepped by hand so a slow capture cannot
// change what is shot. Raw PNGs go to --dir (default docs/shots/readme, git ignored); tools/compose-readme.mjs makes docs/media/ from them.
// node tools/shoot-readme.mjs sweep <track>...            16 places round the lap, rivals in front
// node tools/shoot-readme.mjs lap <track>                 where the hard autopilot drifts, as lap fractions
// node tools/shoot-readme.mjs stills tools/readme-stills.json   the chosen frames: [{ name, track, u, kart, rivals, item, fire, frames, ... }]
// node tools/shoot-readme.mjs film tools/readme-film.json       a stepped film, one PNG a frame: see film() for the timeline
// node tools/shoot-readme.mjs four tools/readme-four.json       four views: [{ name, track, karts, at, items, fire, frames }], through the real lobby
// LAN_IP=192.168.1.23 node tools/shoot-readme.mjs lobby          the TV lobby with its QR and a real phone page beside it
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, isAbsolute } from 'node:path';
import { launch, buildDist, startServerProcess, openPad, ROOT } from './harness.mjs';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv.splice(i, 2)[1] : d; };
const dirArg = opt('dir', 'docs/shots/readme');
const DIR = isAbsolute(dirArg) ? dirArg : join(ROOT, dirArg);
const [W, H] = opt('size', '1920x1080').split('x').map(Number);
const [cmd, ...rest] = argv;
mkdirSync(DIR, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const dist = mkdtempSync(join(tmpdir(), 'rk-readme-'));
await buildDist(dist);
const srv = await startServerProcess({ dist });
const browser = await launch('metal');

async function open(sc) {
  const ctx = await browser.newContext({ viewport: { width: sc.w ?? W, height: sc.h ?? H }, deviceScaleFactor: 1, locale: 'en-US' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) console.log('[console]', m.text().slice(0, 300)); });
  const views = sc.views ?? 1;
  const q = new URLSearchParams({ track: sc.track, views, players: sc.players ?? views, bots: 8 - (sc.players ?? views), difficulty: sc.difficulty ?? 'hard', manual: sc.query?.mode === 'time' ? 0 : 1, quality: 'capture', seed: sc.seed ?? 11, countdown: 0, laps: 3, lang: 'en', kart: sc.kart ?? 'tabia', ...(sc.query ?? {}) });
  await page.goto(`${srv.base}/?${q}`);
  await page.waitForFunction(() => window.__game?.ready || window.__game?.error, null, { timeout: 240000 });
  const err = await page.evaluate(() => window.__game.error);
  if (err) throw new Error(err);
  return { ctx, page };
}

// Runs in the page: view 0's kart at u, the rivals in front of it, everybody on the autopilot and holding their items.
const STAGE = (s) => {
  const g = window.__game, L = g.renderer.world.track.length, me = g.views[0];
  const others = g.state.karts.map((k) => k.i).filter((i) => i !== me && !g.views.includes(i));
  g.state.shots.length = 0; g.state.spills.length = 0;
  for (const k of g.state.karts) { k.hitT = 0; k.hitKind = null; k.safeT = 0; k.bigT = 0; k.boostT = 0; k.boostKind = null; k.stinkT = 0; k.sootT = 0; k.tipsyT = 0; k.item = null; k.orbit = 0; k.itemCharges = 0; k.rendangT = 0; }
  const pressed = window.__pressed = new Set();
  g.setScript((i) => { const a = g.drive(i); a.item = false; if (pressed.has(i)) { pressed.delete(i); a.item = true; } return a; });
  const rivals = s.rivals ?? [[9, -3], [16, 3], [26, 0], [38, -2], [52, 3], [-14, 3], [-26, -3]];
  others.forEach((b, n) => { const r = rivals[n % rivals.length]; g.teleport(b, s.u + r[0] / L, r[1], { speed: s.rivalSpeed ?? 25, lap: 1 }); });
  g.views.forEach((v, n) => { if (v !== me) g.teleport(v, s.u + (n + 1) * 8 / L, n % 2 ? 3.5 : -3.5, { speed: 26, lap: 1 }); });
  g.teleport(me, s.u, s.d ?? 0, { speed: s.speed ?? 26, lap: 1 });
  g.advance(s.settle ?? 45);
  return { me, others, L };
};

// A disaster as it reaches the kart: the warning starts, the field arrives `arrive` s later, the shot is at `at` s (tools/shoot-disasters.mjs).
const STAGE_DISASTER = (s) => {
  const g = window.__game, T = g.renderer.world.track, L = T.length, views = g.views, me = views[0];
  const e = T.def.disasters[s.entry ?? 0], run = 26;
  window.__pressed = new Set();
  g.setScript((i) => { const a = g.drive(i); a.item = false; return a; });
  const others = g.players.map((p, i) => i).filter((i) => !views.includes(i)), m = run * s.arrive;
  g.teleport(me, e.u - m / L, 0, { speed: run, lap: 1 });
  others.forEach((b, n) => g.teleport(b, e.u - (m + (n < 3 ? -18 - n * 14 : 26 + n * 12)) / L, n % 2 ? 3.2 : -3.2, { speed: run, lap: 1 }));
  g.disaster(s.entry ?? 0);
  g.advance(Math.round(s.at * 60));
  return { me, others, L };
};

async function still(page, sc, out) {
  const { me, others } = await page.evaluate(sc.arrive ? STAGE_DISASTER : STAGE, sc);
  const who = sc.helper ? others[0] : me;
  if (sc.item) await page.evaluate(([i, it]) => window.__game.give(i, it), [who, sc.item]);
  if (sc.give) await page.evaluate((list) => { const g = window.__game; list.forEach(([n, it]) => g.give(g.views[n], it)); }, sc.give);
  if (sc.fire) await page.evaluate((i) => window.__pressed.add(i), who);
  if (sc.fireViews) await page.evaluate((list) => { const g = window.__game; list.forEach((n) => window.__pressed.add(g.views[n])); }, sc.fireViews);
  if (sc.disaster != null) await page.evaluate((n) => window.__game.disaster(n), sc.disaster);
  await page.evaluate((n) => { const g = window.__game; g.advance(n); g.draw(); }, sc.frames ?? 20);
  await sleep(120);
  await page.screenshot({ path: out });
  console.log(out.split('/').pop(), JSON.stringify(await page.evaluate(() => { const g = window.__game, k = g.state.karts[g.views[0]]; return { u: +(k.u ?? 0).toFixed?.(3), speed: Math.round(k.speed), drift: k.drift, boost: +k.boostT.toFixed(2), item: k.item, kart: g.state.karts.filter((x) => x.human).map((x) => x.id ?? x.kart) }; })));
}

async function sweep(track) {
  const { ctx, page } = await open({ track, query: { disasters: '[]' } });
  for (let n = 0; n < 16; n++) await still(page, { u: (n + 0.5) / 16 }, join(DIR, `sweep-${track}-${String(n).padStart(2, '0')}.png`));
  await ctx.close();
}

// Where the hard autopilot drifts: first the stretches in lap fractions, then a corner can be picked for the film.
async function lap(track) {
  const { ctx, page } = await open({ track, kart: 'seggiovia', query: { disasters: '[]' } });
  const log = await page.evaluate(() => {
    const g = window.__game, me = g.views[0], L = g.renderer.world.track.length, out = [];
    g.setScript((i) => { const a = g.drive(i); a.item = false; return a; });
    let cur = null;
    for (let t = 0; t < 60 * 90; t++) {
      g.advance(1);
      const k = g.state.karts[me], u = +k.u.toFixed(3);
      if (k.drift && !cur) cur = { from: u, tier: 0, steps: 0 };
      if (cur && k.drift) { cur.steps++; cur.tier = Math.max(cur.tier, k.driftTier); cur.to = u; }
      if (cur && !k.drift) { out.push(cur); cur = null; }
    }
    return { L, keys: Object.keys(g.state.karts[me]).join(' '), out };
  });
  console.log(track, 'length', Math.round(log.L));
  console.log(log.keys);
  for (const d of log.out) console.log(`drift from ${d.from} to ${d.to} tier ${d.tier} for ${(d.steps / 60).toFixed(1)} s`);
  await ctx.close();
}

// film: one chase through a real race, frame by frame. timeline entries fire at a step: { at, do: 'fire'|'give'|'spin'|'drift'|'release'|'pressRival'|'giveRival', item, rival }.
async function film(sc) {
  const { ctx, page } = await open(sc);
  await page.evaluate(STAGE, sc);
  await page.evaluate((s) => {
    const g = window.__game, me = g.views[0], others = g.state.karts.map((k) => k.i).filter((i) => i !== me);
    const T = window.__film = { step: 0, drift: false, dir: 0, log: [] };
    const pressed = window.__pressed;
    g.setScript((i) => {
      const a = g.drive(i); a.item = false;
      if (pressed.has(i)) { pressed.delete(i); a.item = true; }
      if (i === me) {
        if (s.forceDrift) a.drift = T.drift;
        const k = g.state.karts[me];
        if (s.forceDrift && T.drift && !k.drift) a.steer = T.dir * 0.8; // on the hop the stick commits to the corner, as a thumb would
      }
      return a;
    });
    window.__tick = (n) => {
      for (let f = 0; f < n; f++) {
        for (const e of s.timeline) if (e.at === T.step) {
          if (e.do === 'drift') { T.drift = true; T.dir = e.dir; }
          if (e.do === 'release') T.drift = false;
          if (e.do === 'spin') g.spinItem(me, e.item, e.t ?? 0.9);
          if (e.do === 'give') g.give(me, e.item);
          if (e.do === 'fire') pressed.add(me);
          if (e.do === 'giveRival') g.give(others[e.rival], e.item);
          if (e.do === 'pressRival') pressed.add(others[e.rival]);
        }
        g.advance(1);
        T.step++;
        const k = g.state.karts[me];
        T.log.push([T.step, k.drift, k.driftTier, +k.boostT.toFixed(2), Math.round(k.speed), k.item ?? '', k.hitT > 0 ? 1 : 0]);
      }
      g.draw();
      return T.step;
    };
  }, sc);
  const out = join(DIR, sc.name);
  mkdirSync(out, { recursive: true });
  const stepsPerFrame = sc.stepsPerFrame ?? 3;
  for (let n = 0; n < sc.count; n++) {
    await page.evaluate((c) => window.__tick(c), stepsPerFrame);
    await page.screenshot({ path: join(out, `f${String(n).padStart(4, '0')}.png`) });
  }
  const log = await page.evaluate(() => window.__film.log);
  for (const l of log) if (l[0] % 15 === 0) console.log(`step ${l[0]} drift ${l[1]} tier ${l[2]} boost ${l[3]} v ${l[4]} item ${l[5]} hit ${l[6]}`);
  await ctx.close();
}

// Four seats through the real lobby, so four different karts, each on its own stretch of the lap with something going on.
async function four(spec) {
  const { startServer, pad } = await import('../server/testing.js');
  const own = await startServer({ distDir: dist, padSilentMs: 1e9 });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, locale: 'en-US' });
  const tv = await ctx.newPage();
  tv.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await tv.goto(`${own.base}/?lang=en&quality=capture`);
  await tv.waitForFunction(() => window.__game?.ready, null, { timeout: 120000 });
  const pads = [];
  for (const id of ['p-one', 'p-two', 'p-three', 'p-four']) pads.push(await pad(own, id));
  await sleep(500);
  const phase = (p, ms = 60000) => tv.waitForFunction((q) => window.__game.phase === q, p, { timeout: ms });
  pads[0].send({ t: 'opt', difficulty: 'hard', bots: 4 });
  pads[0].send({ t: 'opt', go: true });
  await phase('pick');
  pads.forEach((p, i) => p.send({ t: 'pick', kart: spec.karts[i], ready: true }));
  await phase('vote');
  await sleep(500);
  pads.forEach((p) => p.send({ t: 'vote', track: spec.track, lock: true }));
  await phase('race', 180000);
  await tv.evaluate(() => { const g = window.__game; g.manual = true; g.setAuto(true); g.skipFlyover(); });
  await sleep(300);
  await tv.evaluate(() => window.__game.advance(300));
  await tv.evaluate((s) => {
    const g = window.__game, L = g.renderer.world.track.length, others = g.state.karts.map((k) => k.i).filter((i) => !g.views.includes(i));
    const pressed = new Set();
    g.setScript((i) => { const a = g.drive(i); a.item = false; if (pressed.has(i)) { pressed.delete(i); a.item = true; } return a; });
    g.state.shots.length = 0; g.state.spills.length = 0;
    for (const k of g.state.karts) { k.hitT = 0; k.hitKind = null; k.item = null; k.orbit = 0; k.itemCharges = 0; k.boostT = 0; k.bigT = 0; k.safeT = 0; }
    g.views.forEach((v, n) => { g.teleport(v, s.at[n], 0, { speed: 26, lap: 1 }); g.teleport(others[n], s.at[n] + (s.gap ?? 22) / L, n % 2 ? 3 : -3, { speed: 24, lap: 1 }); });
    g.advance(20);
    g.views.forEach((v, n) => { if (s.items[n]) { g.give(v, s.items[n]); } });
    (s.fire ?? []).forEach((n) => pressed.add(g.views[n]));
    g.advance(s.frames ?? 16);
    g.draw();
  }, spec);
  await sleep(200);
  await tv.screenshot({ path: join(DIR, `${spec.name}.png`) });
  console.log(spec.name);
  for (const p of pads) await p.close();
  await ctx.close();
  await own.close();
}

// Time trial: a good first lap sets the record, a slower start on the second lets the ghost pull ahead into view.
async function ghost() {
  const { ctx, page } = await open({ track: 'antelao', kart: 'seggiovia', players: 1, query: { mode: 'time', flyover: 0, countdown: 1 } });
  await page.evaluate(() => { const g = window.__game; g.manual = false; g.setScript((i) => g.drive(i)); g.speed = 8; });
  await page.waitForFunction(() => window.__game.tt.view(window.__game.views[0]).laps.length >= 1 || window.__game.error, null, { timeout: 200000 });
  await page.evaluate(() => { const g = window.__game; g.setScript((i) => ({ ...g.drive(i), throttle: g.state.t % 2 < 1.1 ? -0.5 : 1, drift: false })); g.speed = 1; });
  await page.waitForFunction(() => window.__game.tt.view(window.__game.views[0]).lapT > 1.9, null, { timeout: 60000 });
  // the kart moves over a lane, so the ghost is not hidden right behind it
  await page.evaluate(() => { const g = window.__game, me = g.views[0], k = g.state.karts[me]; g.teleport(me, k.u, 3.4, { speed: k.speed, lap: k.lap }); g.setScript((i) => g.drive(i)); });
  await page.waitForFunction(() => window.__game.tt.view(window.__game.views[0]).lapT > 4, null, { timeout: 60000 });
  await page.evaluate(() => { const g = window.__game, me = g.views[0], k = g.state.karts[me], L = g.renderer.world.track.length; g.teleport(me, k.u - 20 / L, 2.6, { speed: k.speed, lap: k.lap }); });
  for (const at of [4.2, 4.6, 5, 6, 7, 8]) {
    await page.waitForFunction((t) => window.__game.tt.view(window.__game.views[0]).lapT > t, at, { timeout: 60000 });
    console.log(at, JSON.stringify(await page.evaluate(() => { const g = window.__game, k = g.state.karts[g.views[0]], p = g.tt.poses(1)[0]; return { d: p && +Math.hypot(p.x - k.x, p.z - k.z).toFixed(1), keys: p && Object.keys(p).join() }; })));
    await page.screenshot({ path: join(DIR, `ghost-${at}.png`) });
  }
  await ctx.close();
}

// The real lobby with its QR, with a real phone page joined, and that phone in the race.
async function lobby() {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, locale: 'en-US' });
  const tv = await ctx.newPage();
  await tv.goto(`${srv.base}/?lang=en&quality=capture`);
  await tv.waitForFunction(() => window.__game?.ready || window.__game?.error, null, { timeout: 120000 });
  await sleep(1500);
  await tv.mouse.click(300, 1000); // the sound sticker goes
  const phones = [];
  for (const label of ['one', 'two', 'three']) phones.push(await openPad(browser, srv.base, { label }));
  await sleep(1200);
  await tv.screenshot({ path: join(DIR, 'tv-lobby.png') });
  await phones[0].page.screenshot({ path: join(DIR, 'pad-lobby.png') });
  await phones[0].page.locator('#goBtn').tap();
  await phones[0].page.waitForFunction(() => window.__pad.phase === 'pick', null, { timeout: 8000 });
  await sleep(1200);
  await phones[0].page.screenshot({ path: join(DIR, 'pad-pick.png') });
  for (const p of phones) { await p.page.locator('#readyBtn').tap(); await sleep(150); }
  await tv.waitForFunction(() => window.__game.phase === 'vote', null, { timeout: 15000 });
  await sleep(900);
  await phones[0].page.screenshot({ path: join(DIR, 'pad-vote.png') });
  for (const p of phones) { await p.page.locator('#voteBtn').tap().catch((e) => console.log('vote', e.message.slice(0, 100))); await sleep(150); }
  await tv.waitForFunction(() => window.__game.phase === 'race', null, { timeout: 180000 });
  await tv.evaluate(() => window.__game.skipFlyover());
  await sleep(5500);
  await tv.evaluate(() => { const g = window.__game; g.give(g.views[0], 'razzo'); });
  await sleep(1800);
  await phones[0].page.screenshot({ path: join(DIR, 'pad-race.png') });
  await tv.screenshot({ path: join(DIR, 'tv-race.png') });
  for (const p of phones) await p.ctx.close();
  await ctx.close();
}

try {
  if (cmd === 'sweep') for (const t of rest) await sweep(t);
  if (cmd === 'lap') for (const t of rest) await lap(t);
  if (cmd === 'stills') {
    const list = JSON.parse(readFileSync(rest[0], 'utf8'));
    const only = rest.slice(1);
    for (const sc of list) {
      if (only.length && !only.includes(sc.name)) continue;
      const { ctx, page } = await open(sc);
      await still(page, sc, join(DIR, `${sc.name}.png`));
      await ctx.close();
    }
  }
  if (cmd === 'film') await film(JSON.parse(readFileSync(rest[0], 'utf8')));
  if (cmd === 'four') for (const f of JSON.parse(readFileSync(rest[0], 'utf8'))) await four(f);
  if (cmd === 'ghost') await ghost();
  if (cmd === 'lobby') await lobby();
} finally {
  await Promise.race([browser.close(), sleep(3000)]);
  await srv.close();
  rmSync(dist, { recursive: true, force: true });
}
process.exit(0);
