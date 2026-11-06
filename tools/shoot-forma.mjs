// Screenshots of Caccia alla Forma through the real game: the lobby, the wheel loose ahead, in your hands and in someone else's, at 1, 2 and 4
// views, the last seconds, the results and the podium, and the phone's screens. Into docs/shots/forma-*.png, or --dir.
// node tools/shoot-forma.mjs [--track antelao] [--kart jeep] [--lang it] [--dir path] [--size 1920x1080] [menus] [pad] [road] [2v] [4v] [end]
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launch, buildDist, startServerProcess, openPad, ROOT } from './harness.mjs';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv.splice(i, 2)[1] : d; };
const TRACK = opt('track', 'antelao'), KART = opt('kart', 'jeep'), DIR = opt('dir', join(ROOT, 'docs/shots')), LANG = opt('lang', 'it');
const [W, H] = opt('size', '1920x1080').split('x').map(Number);
const scenes = argv.length ? argv : ['menus', 'pad', 'road', '2v', '4v', 'end'];
mkdirSync(DIR, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dist = mkdtempSync(join(tmpdir(), 'rk-forma-'));
await buildDist(dist);
const srv = await startServerProcess({ dist });
const browser = await launch('metal');
const ctx = await browser.newContext({ viewport: { width: W, height: H }, locale: LANG === 'it' ? 'it-IT' : 'en-US' });
// Text under the floor or cut off is a bug on any screen, the same audit as tools/shoot-ui.mjs.
const audit = async (page, name) => {
  const bad = await page.evaluate(() => {
    const out = [], root = document.querySelector('.rk') || document.body, w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const text = n.textContent.trim(), e = n.parentElement;
      if (!text || !e.offsetParent) continue;
      const r = e.getBoundingClientRect(), s = getComputedStyle(e), size = parseFloat(s.fontSize);
      if (s.visibility === 'hidden' || r.width === 0) continue;
      if (size < 13) out.push(`small ${size.toFixed(1)}: ${text.slice(0, 30)}`);
      if (r.right > innerWidth + 1 || r.left < -1 || r.bottom > innerHeight + 1) out.push(`off: ${text.slice(0, 30)}`);
      if (e.scrollWidth > e.clientWidth + 2 && s.overflow !== 'visible') out.push(`cut: ${text.slice(0, 30)}`);
    }
    return out;
  });
  if (bad.length) console.log(`[audit ${name}]`, [...new Set(bad)].join(' | '));
};
const shot = async (page, name) => { await audit(page, name); await page.screenshot({ path: join(DIR, `forma-${name}.png`) }); };
const errors = [];

const open = async (query, base = srv.base) => {
  const tv = await ctx.newPage();
  tv.on('pageerror', (e) => errors.push(e.message));
  tv.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await tv.goto(`${base}/?lang=${LANG}&quality=capture&${query}`);
  await tv.waitForFunction(() => window.__game?.ready || window.__game?.error, null, { timeout: 180000 });
  return tv;
};
// a driver for each view from the bot's brain, so that the road looks like a race; fast forward until the condition holds, then one real second
async function until(tv, fn, name, { ms = 90000, wait = 0 } = {}) {
  await tv.evaluate(() => { const g = window.__game; g.setScript((i) => g.drive(i)); g.speed = 6; });
  await tv.waitForFunction(fn, null, { timeout: ms });
  await tv.evaluate(() => { window.__game.speed = 1; });
  if (wait) await sleep(wait);
  await shot(tv, name);
}
// the first view's kart parked on the wheel until it is in its hands: the autopilot alone may not get it in a whole match
async function seize(tv, name) {
  await tv.evaluate(() => {
    const g = window.__game, i = g.views[0], F = g.state.forma;
    g.setScript((j) => g.drive(j));
    g.__hold = setInterval(() => { const k = g.state.karts[i], w = F.wheel; if (F.holder !== i) { k.x = w.x; k.z = w.z; k.y = w.y - 1; k.hitT = 0; } }, 16);
  });
  await tv.waitForFunction(() => { const g = window.__game; return g.state.forma.holder === g.views[0]; }, null, { timeout: 30000 });
  await tv.evaluate(() => clearInterval(window.__game.__hold));
  await sleep(1400);
  await shot(tv, name);
}
const road = (views, extra = '') => open(`track=${TRACK}&mode=forma&players=${views}&kart=${KART}&bots=7&flyover=0&countdown=1${extra}`);

if (scenes.includes('menus')) {
  const tv = await open('');
  const phone = await openPad(browser, srv.base, { label: 'forma', locale: LANG === 'it' ? 'it-IT' : 'en-US' });
  await tv.waitForFunction(() => window.__game.seats[0]?.present, null, { timeout: 20000 });
  await phone.page.locator('.seg[data-key="mode"] button[data-v="forma"]').tap();
  await tv.waitForFunction(() => window.__game.flowApi.opts.mode === 'forma', null, { timeout: 5000 });
  await sleep(500);
  const edge = await tv.evaluate(() => { const c = document.querySelector('.lobby .opts').getBoundingClientRect(), g = [...document.querySelectorAll('.lobby .chips[data-key="mode"] .chip')].map((b) => b.getBoundingClientRect().right); return { card: c.right, last: Math.max(...g) }; });
  console.log('mode chips', edge);
  await shot(tv, 'lobby');
  await phone.page.screenshot({ path: join(DIR, 'forma-pad-lobby.png') });
  await phone.ctx.close();
  await tv.close();
}

// the whole evening by phone, on a short clock: the vote and what the phone shows on the road, with and without the wheel, and at the end
if (scenes.includes('pad')) {
  // a room of its own: the phone that just left still has its seat reserved in the other
  const srv2 = await startServerProcess({ dist });
  const tv = await open('formaT=30', srv2.base);
  const phone = await openPad(browser, srv2.base, { label: 'forma', locale: LANG === 'it' ? 'it-IT' : 'en-US' });
  const pshot = (name) => phone.page.screenshot({ path: join(DIR, `forma-pad-${name}.png`) });
  await tv.waitForFunction(() => window.__game.seats[0]?.present, null, { timeout: 20000 });
  await phone.page.locator('.seg[data-key="mode"] button[data-v="forma"]').tap();
  await tv.waitForFunction(() => window.__game.flowApi.opts.mode === 'forma', null, { timeout: 5000 });
  await phone.page.locator('#goBtn').tap();
  await phone.page.waitForFunction(() => window.__pad.phase === 'pick', null, { timeout: 8000 });
  await sleep(350);
  await phone.page.locator('#readyBtn').tap();
  await tv.waitForFunction(() => window.__game.phase === 'vote', null, { timeout: 8000 });
  await sleep(900);
  await shot(tv, 'vote');
  await sleep(350);
  await phone.page.locator('#voteBtn').tap();
  await tv.waitForFunction(() => window.__game.state, null, { timeout: 180000 });
  await sleep(1200);
  await shot(tv, 'flyover');
  await tv.evaluate(() => window.__game.skipFlyover());
  await tv.waitForFunction(() => window.__game.state?.phase === 'race', null, { timeout: 30000 });
  await tv.evaluate(() => { const g = window.__game; g.setScript((i) => g.drive(i)); });
  await sleep(2500);
  await pshot('road');
  await tv.evaluate(() => {
    const g = window.__game, i = g.state.karts.findIndex((k) => k.human), F = g.state.forma;
    g.__hold = setInterval(() => { const k = g.state.karts[i], w = F.wheel; if (F.holder !== i) { k.x = w.x; k.z = w.z; k.y = w.y - 1; k.hitT = 0; } }, 16);
  });
  await tv.waitForFunction(() => { const g = window.__game; return g.state.forma.holder === g.views[0]; }, null, { timeout: 20000 });
  await tv.evaluate(() => clearInterval(window.__game.__hold));
  await sleep(600);
  await pshot('mine');
  await tv.evaluate(() => { window.__game.speed = 5; });
  await tv.waitForFunction(() => window.__game.phase === 'results', null, { timeout: 90000 });
  await phone.page.waitForFunction(() => window.__pad.phase === 'results', null, { timeout: 8000 });
  await sleep(700);
  await pshot('results');
  await phone.ctx.close();
  await tv.close();
  await srv2.close();
}

if (scenes.includes('road')) {
  const tv = await road(1);
  await tv.evaluate(() => { window.__game.draw(); });
  await tv.waitForFunction(() => window.__game.state?.phase === 'race', null, { timeout: 30000 });
  await sleep(1500);
  await shot(tv, 'road-start');
  await until(tv, () => { const g = window.__game, F = g.state.forma; return F.holder >= 0 && F.holder !== g.views[0] && F.gaps[g.views[0]] > 6 && F.gaps[g.views[0]] < 40; }, 'road-other');
  await until(tv, () => { const g = window.__game, F = g.state.forma; return F.holder < 0 && F.gaps[g.views[0]] > 4 && F.gaps[g.views[0]] < 90; }, 'road-loose', { ms: 180000 });
  await tv.close();
  const t3 = await road(1);
  await t3.waitForFunction(() => window.__game.state?.phase === 'race', null, { timeout: 30000 });
  await seize(t3, 'road-mine');
  await t3.close();
}

for (const [scene, n] of [['2v', 2], ['4v', 4]]) {
  if (!scenes.includes(scene)) continue;
  const tv = await road(n);
  await tv.waitForFunction(() => window.__game.state?.phase === 'race', null, { timeout: 30000 });
  await seize(tv, `${scene}-mine`);
  await until(tv, () => { const g = window.__game, F = g.state.forma; return F.holder < 0; }, `${scene}-loose`, { ms: 180000 });
  await tv.close();
}

if (scenes.includes('end')) {
  const t2 = await road(1, '&formaT=24');
  await t2.waitForFunction(() => window.__game.state?.phase === 'race', null, { timeout: 30000 });
  await t2.evaluate(() => { const g = window.__game; g.setScript((i) => g.drive(i)); g.speed = 4; });
  await t2.waitForFunction(() => window.__game.state.forma.left < 6, null, { timeout: 60000 });
  await t2.evaluate(() => { window.__game.speed = 1; });
  await t2.waitForFunction(() => window.__game.state.forma.left < 3.5, null, { timeout: 20000 });
  await shot(t2, 'last-seconds');
  await t2.waitForFunction(() => window.__game.state.phase === 'done', null, { timeout: 20000 });
  await sleep(1600);
  await shot(t2, 'time-up');
  await t2.waitForFunction(() => window.__game.phase === 'results', null, { timeout: 30000 });
  await sleep(1500);
  await shot(t2, 'results');
  await t2.waitForFunction(() => window.__game.phase === 'podium', null, { timeout: 20000 });
  await sleep(1500);
  await shot(t2, 'podium');
  await t2.close();
}

await browser.close();
await srv.close();
rmSync(dist, { recursive: true, force: true });
if (errors.length) console.log('page errors:', [...new Set(errors)].slice(0, 12));
console.log('done');
