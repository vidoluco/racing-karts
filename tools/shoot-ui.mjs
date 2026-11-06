// Screenshots of every TV screen through the real game: its own build in a private folder, the real server, scripted phones
// over the WebSocket, Chromium on the Metal backend. node tools/shoot-ui.mjs [menus] [hud1] [hud2] [hud4] [--dir docs/shots] [--size 1920x1080]
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { launch, gpuInfo, ROOT } from './harness.mjs';
import { startServer, pad, sleep } from '../server/testing.js';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const dir = join(ROOT, opt('--dir', 'docs/shots'));
const [W, H] = opt('--size', '1920x1080').split('x').map(Number);
const suffix = opt('--suffix', '');
const only = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
const want = (n) => !only.length || only.includes(n);
const dist = mkdtempSync(join(tmpdir(), 'rk-ui-'));
mkdirSync(dir, { recursive: true });
execFileSync(process.execPath, ['build.mjs', '--dev'], { cwd: ROOT, env: { ...process.env, DIST: dist }, stdio: 'inherit' });
const srv = await startServer({ distDir: dist, padSilentMs: 1e9 });
const browser = await launch('metal');
const errors = [];

async function open(url) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, locale: opt('--locale', 'it-IT') });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', e.message); });
  page.on('response', (r) => { if (r.status() >= 400) console.log('[http]', r.status(), r.url()); });
  page.on('console', (m) => { if (m.type() === 'error') { errors.push(m.text()); console.log('[console]', m.text()); } });
  await page.goto(srv.base + url);
  await page.waitForFunction(() => window.__game && (window.__game.ready || window.__game.error), null, { timeout: 120000 });
  const err = await page.evaluate(() => window.__game.error);
  if (err) throw new Error(err);
  return { ctx, page };
}
// Text below the size floor, text that is cut off, and text that spills out of the window: all bugs on any screen.
const audit = (page) => page.evaluate(() => {
  const out = [];
  const seen = new Set();
  const walker = document.createTreeWalker(document.querySelector('.rk'), NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const n = walker.currentNode, e = n.parentElement, txt = n.textContent.trim();
    if (!txt || !e.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
    const cs = getComputedStyle(e), fs = parseFloat(cs.fontSize), r = e.getBoundingClientRect();
    if (!r.width) continue;
    const key = `${e.className}|${txt}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (fs < 12.9) out.push(`small ${fs.toFixed(1)}px: ${txt}`);
    if (cs.overflow !== 'visible' && e.scrollWidth > e.clientWidth + 1) out.push(`cut: ${txt}`);
    const box = e.closest('.bigbtn, .chip, [data-preset]');
    if (box && box.scrollWidth > box.clientWidth + 1) out.push(`spills out of its button: ${txt}`);
    // an SVG text's box is its em box, wider than the letters: the logo may be drawn right up to the edge
    if (!e.closest('svg') && (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1)) out.push(`off screen: ${txt} ${e.tagName} ${[r.left, r.top, r.right, r.bottom].map(Math.round)}`);
  }
  return out;
});
const snap = async (page, name) => {
  await page.screenshot({ path: join(dir, `ui-${name}${suffix}.png`) });
  const a = await audit(page);
  console.log('shot', name, a.length ? JSON.stringify(a) : '');
};
const phase = (page, p, ms = 60000) => page.waitForFunction((q) => window.__game.phase === q, p, { timeout: ms });

async function menus() {
  const { page, ctx } = await open('/?quality=capture');
  console.log('gpu', (await gpuInfo(page)).renderer);
  await sleep(1800);
  await snap(page, 'lobby-empty');
  await page.mouse.click(300, 1000); // the sound sticker goes
  const pads = [];
  for (const id of ['p-one', 'p-two', 'p-three', 'p-four']) pads.push(await pad(srv, id));
  await sleep(900);
  await snap(page, 'lobby-4');
  pads[0].send({ t: 'opt', difficulty: 'hard', bots: 4 });
  pads[0].send({ t: 'opt', go: true });
  await phase(page, 'pick');
  const karts = ['tabia', 'mocanita', 'jeep', 'jukung'];
  pads.forEach((p, i) => p.send({ t: 'pick', kart: karts[i], ready: i < 2 }));
  await sleep(4000);
  await snap(page, 'pick-4');
  pads.forEach((p, i) => p.send({ t: 'pick', kart: karts[i], ready: true }));
  await phase(page, 'vote');
  await sleep(700);
  const tracks = ['antelao', 'random', 'antelao', 'antelao'];
  pads.forEach((p, i) => p.send({ t: 'vote', track: tracks[i], lock: false }));
  await sleep(500);
  pads.slice(0, 2).forEach((p, i) => p.send({ t: 'vote', track: tracks[i], lock: true }));
  await sleep(500);
  await snap(page, 'vote-4');
  pads.forEach((p, i) => p.send({ t: 'vote', track: tracks[i], lock: true }));
  await sleep(700);
  await snap(page, 'vote-roll');
  await phase(page, 'loading');
  await sleep(150);
  // (see the end of this function for the loading card)
  await phase(page, 'race', 120000);
  await sleep(1800);
  await snap(page, 'flyover');
  await page.evaluate(() => { window.__game.manual = true; window.__game.setAuto(true); window.__game.skipFlyover(); });
  await sleep(300);
  await page.evaluate(() => window.__game.advance(3));
  await sleep(120);
  await snap(page, 'hud-4-countdown');
  await page.evaluate(() => { const g = window.__game; g.advance(1200); g.give(0, 'razzo'); g.give(1, 'mici'); g.advance(30); });
  await sleep(200);
  await snap(page, 'hud-4');
  // a phone goes and comes back: the banner is on its view only
  await pads[3].close();
  await page.waitForFunction(() => window.__game.seats[3].away === true, null, { timeout: 10000 });
  await page.evaluate(() => { const g = window.__game; g.setAuto(false); g.advance(2); });
  await sleep(700);
  await snap(page, 'hud-4-missing');
  await page.evaluate(() => window.__game.setAuto(true));
  pads[3] = await pad(srv, 'p-four');
  await page.waitForFunction(() => window.__game.seats[3].away === false, null, { timeout: 10000 });
  await page.evaluate(() => window.__game.advance(40000));
  await page.waitForFunction(() => ['results', 'podium'].includes(window.__game.phase), null, { timeout: 120000 });
  await sleep(1200);
  await page.evaluate(() => window.__game.draw());
  await sleep(100);
  await snap(page, 'results');
  await page.evaluate(() => window.__game.next('podium'));
  await phase(page, 'podium');
  await sleep(2500);
  await snap(page, 'podium');
  // the phones' way out: back to the lobby, with the game still whole
  pads[0].send({ t: 'opt', next: 'lobby' });
  await phase(page, 'lobby');
  await sleep(600);
  await snap(page, 'lobby-after');
  // one seat, on to the Gran Premio builder
  for (const p of pads.slice(1)) await p.close();
  await sleep(500);
  pads[0].send({ t: 'opt', mode: 'gp', laps: 2, bots: 7 });
  pads[0].send({ t: 'opt', go: true });
  await phase(page, 'pick');
  await sleep(1500);
  pads[0].send({ t: 'pick', kart: 'caruta', ready: false });
  await sleep(700);
  await snap(page, 'pick-1');
  pads[0].send({ t: 'pick', kart: 'caruta', ready: true });
  await phase(page, 'vote');
  await sleep(500);
  pads[0].send({ t: 'vote', track: 'antelao', lock: true });
  await sleep(500);
  await snap(page, 'gp-build');
  // the loading card goes by too fast on a fast machine: put it up by hand
  await page.evaluate(() => {
    const g = window.__game;
    g.ui.show('loading', { track: 'antelao', trackName: "Giro dell'Antelao", regionName: 'Cadore', blurb: "Da Borca lungo il Boite, sul viadotto della vecchia ferrovia." });
    g.ui.screens.loading.progress(0.62);
  });
  await sleep(700);
  await snap(page, 'loading');
  await pads[0].close();
  await ctx.close();
}

async function hud(n) {
  const { page, ctx } = await open(`/?track=antelao&views=${n}&bots=${8 - n}&difficulty=medium&auto=1&manual=1&quality=capture&seed=7&kart=becak`);
  await page.waitForFunction(() => window.__game.phase === 'race' && window.__game.state, null, { timeout: 120000 });
  await page.evaluate(() => window.__game.advance(40));
  await sleep(150);
  await snap(page, `hud-${n}-countdown`);
  // the humans hold what they are given: the script drives them straight along the line the bot would take
  await page.evaluate(() => {
    const g = window.__game;
    g.advance(1500);
    g.setAuto(false);
    g.setScript((i) => { const a = g.drive(i); return { ...a, item: false }; });
    g.views.forEach((v, q) => g.give(v, ['zuica', 'razzo', 'mici', 'sambal'][q]));
    g.advance(30);
  });
  await sleep(200);
  await snap(page, `hud-${n}`);
  if (n === 1) {
    await page.evaluate(() => { const g = window.__game; g.spinItem(g.views[0], 'razzo'); g.advance(1); });
    await sleep(100);
    await snap(page, 'hud-1-roulette');
    await page.evaluate(() => { const g = window.__game; g.setScript(() => ({ steer: 0, throttle: 1, item: false, drift: false })); g.teleport(g.views[0], 0.3, 0, { speed: 14, yawOffset: Math.PI }); g.advance(85); });
    await sleep(300);
    await snap(page, 'hud-1-wrong');
    await page.evaluate(() => window.__game.setPaused(true));
    await sleep(500);
    await snap(page, 'pause');
    await page.evaluate(() => window.__game.setPaused(false));
    await sleep(200);
    await page.evaluate(() => { const g = window.__game; g.setScript(null); g.setAuto(true); g.teleport(g.views[0], 0.985, 0, { speed: 24, lap: 1 }); g.advance(90); });
    await sleep(300);
    await snap(page, 'hud-1-lastlap');
    await page.evaluate(() => { const g = window.__game; g.teleport(g.views[0], 0.985, 0, { speed: 26, lap: 2 }); g.advance(150); });
    await sleep(300);
    await snap(page, 'hud-1-finish');
  }
  await ctx.close();
}

try {
  if (want('menus')) await menus();
  if (want('hud1')) await hud(1);
  if (want('hud2')) await hud(2);
  if (want('hud3')) await hud(3);
  if (want('hud4')) await hud(4);
} finally {
  await browser.close();
  await srv.close();
  rmSync(dist, { recursive: true, force: true });
  console.log(errors.length ? `${errors.length} page errors` : 'no page errors');
}
