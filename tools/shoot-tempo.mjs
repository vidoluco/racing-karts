// Screenshots of the time trial through the real game: lobby, vote, the road with the ghost ahead at 1, 2 and 4 views, results, and
// the phone's screens. Into docs/shots/tempo-*.png, or --dir. node tools/shoot-tempo.mjs [--track antelao] [--kart jeep] [--dir path] [scenes]
// scenes: menus road 2v 4v
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launch, buildDist, startServerProcess, openPad, ROOT } from './harness.mjs';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv.splice(i, 2)[1] : d; };
const TRACK = opt('track', 'antelao'), KART = opt('kart', 'jeep'), DIR = opt('dir', join(ROOT, 'docs/shots')), LANG = opt('lang', 'it');
const scenes = argv.length ? argv : ['menus', 'road', '2v', '4v'];
mkdirSync(DIR, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dist = mkdtempSync(join(tmpdir(), 'rk-tempo-'));
await buildDist(dist);
const srv = await startServerProcess({ dist });
const browser = await launch('metal');
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: LANG === 'it' ? 'it-IT' : 'en-US' });
const shot = (page, name) => page.screenshot({ path: join(DIR, `tempo-${name}.png`) });
const errors = [];

// One lap on fast forward so that there is a ghost, then held back a little so that it pulls ahead, with the HUD alive.
async function road(tv, name, { views = 1 } = {}) {
  const K = await tv.evaluate(() => window.__game.views);
  await tv.evaluate(() => { const g = window.__game; g.setScript((i) => g.drive(i)); g.speed = 8; });
  await tv.waitForFunction(() => window.__game.tt.view(window.__game.views[0]).laps.length >= 1 || window.__game.error, null, { timeout: 200000 });
  // a slower lap: the record stays, the ghost pulls ahead
  await tv.evaluate(() => { const g = window.__game; g.setScript((i) => ({ ...g.drive(i), throttle: g.state.t % 2 < 1.1 ? -0.5 : 1, drift: false })); g.speed = 1; });
  await tv.waitForFunction(() => window.__game.tt.view(window.__game.views[0]).lapT > 7.5, null, { timeout: 60000 });
  await tv.evaluate(() => { const g = window.__game; g.setScript((i) => g.drive(i)); });
  await sleep(350);
  await shot(tv, `road-${name}`);
  await tv.waitForFunction(() => { const g = window.__game, v = g.tt.view(g.views[0]); return v.lapT > 30 || v.laps.length >= 2; }, null, { timeout: 60000 });
  await tv.waitForFunction(() => { const e = document.querySelector('.hudscr .ttsplit'); return e && !e.classList.contains('hide') && e.querySelector('i').textContent; }, null, { timeout: 60000 });
  await sleep(450);
  await shot(tv, `split-${name}`);
  return K;
}

const open = async (query) => {
  const tv = await ctx.newPage();
  tv.on('pageerror', (e) => errors.push(e.message));
  await tv.goto(`${srv.base}/?lang=${LANG}&quality=capture&${query}`);
  await tv.waitForFunction(() => window.__game?.ready || window.__game?.error, null, { timeout: 120000 });
  return tv;
};

if (scenes.includes('menus')) {
  const tv = await open('');
  const pad = await openPad(browser, srv.base, { label: 'tempo', locale: LANG === 'it' ? 'it-IT' : 'en-US' });
  await pad.page.waitForFunction(() => window.__pad.phase === 'lobby');
  await pad.page.locator('.seg[data-key="mode"] button[data-v="time"]').tap();
  await tv.waitForFunction(() => window.__game.flowApi.opts.mode === 'time');
  await pad.page.locator('.seg[data-key="laps"] button[data-v="2"]').tap();
  await sleep(1200);
  await shot(tv, 'lobby');
  await pad.page.screenshot({ path: join(DIR, 'tempo-pad-lobby.png') });
  await pad.page.locator('#goBtn').tap();
  await tv.waitForFunction(() => window.__game.phase === 'pick');
  await sleep(500);
  await pad.page.evaluate((id) => window.__pad.carousel.show?.(id), KART);
  await sleep(200);
  await pad.page.locator('#readyBtn').tap();
  await tv.waitForFunction(() => window.__game.phase === 'vote');
  await sleep(900);
  await shot(tv, 'vote-empty');
  await pad.page.waitForFunction(() => window.__pad.phase === 'vote');
  await sleep(400);
  await pad.page.evaluate((id) => window.__pad.carousel.show?.(id), TRACK);
  await sleep(200);
  await pad.page.locator('#voteBtn').tap();
  await tv.waitForFunction(() => window.__game.phase === 'race' && window.__game.state, null, { timeout: 200000 });
  await sleep(1800);
  await shot(tv, 'fly');
  await tv.evaluate(() => window.__game.skipFlyover());
  await tv.waitForFunction(() => window.__game.state?.phase === 'race', null, { timeout: 30000 });
  await sleep(600);
  await pad.page.screenshot({ path: join(DIR, 'tempo-pad-race.png') });
  await road(tv, '1v');
  await pad.page.screenshot({ path: join(DIR, 'tempo-pad-split.png') });
  await tv.evaluate(() => { window.__game.speed = 8; });
  await tv.waitForFunction(() => window.__game.phase === 'results' || window.__game.error, null, { timeout: 200000 });
  await sleep(1700);
  await shot(tv, 'results');
  await pad.page.waitForFunction(() => window.__pad.phase === 'results');
  await sleep(500);
  await pad.page.screenshot({ path: join(DIR, 'tempo-pad-results.png') });
  await tv.evaluate(() => window.__game.next('lobby'));
  await pad.page.waitForFunction(() => window.__pad.phase === 'lobby');
  await pad.page.locator('#goBtn').tap();
  await tv.waitForFunction(() => window.__game.phase === 'pick');
  await sleep(400);
  await pad.page.locator('#readyBtn').tap();
  await tv.waitForFunction(() => window.__game.phase === 'vote');
  await sleep(900);
  await shot(tv, 'vote-records');
  await pad.ctx.close();
  await tv.close();
}
for (const [scene, n] of [['road', 1], ['2v', 2], ['4v', 4]]) {
  if (!scenes.includes(scene)) continue;
  const c2 = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const tv = await c2.newPage();
  tv.on('pageerror', (e) => errors.push(e.message));
  await tv.goto(`${srv.base}/?lang=${LANG}&quality=capture&track=${TRACK}&kart=${KART}&mode=time&players=${n}&laps=3&flyover=0&countdown=1`);
  await tv.waitForFunction(() => window.__game?.ready || window.__game?.error, null, { timeout: 200000 });
  await road(tv, `${n}p`, { views: n });
  await c2.close();
}
await browser.close();
await srv.close();
rmSync(dist, { recursive: true, force: true });
console.log(errors.length ? `page errors: ${errors.join(' | ')}` : 'no page errors');
process.exit(0);
