// Weather and night through the real game: the lobby's chips and the vote's on the TV and on a real phone page, then the road under each sky at 1, 2 and 4 views, with the text audit. Into docs/shots/meteo-*.png, or --dir.
// node tools/shoot-weather.mjs [--track antelao] [--kart jeep] [--lang it] [--dir path] [--size 1920x1080] [--skies rain,snow,fog,night,rain+night] [--at u] [menus] [road] [2v] [4v]
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launch, buildDist, startServerProcess, openPad, ROOT } from './harness.mjs';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv.splice(i, 2)[1] : d; };
const TRACK = opt('track', 'antelao'), KART = opt('kart', 'jeep'), DIR = opt('dir', join(ROOT, 'docs/shots')), LANG = opt('lang', 'it'), AT = +opt('at', 0.3);
const SKIES = opt('skies', 'rain,snow,fog,night,rain+night').split(',');
const [W, H] = opt('size', '1920x1080').split('x').map(Number);
const scenes = argv.length ? argv : ['menus', 'road', '2v', '4v'];
mkdirSync(DIR, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dist = mkdtempSync(join(tmpdir(), 'rk-wx-'));
await buildDist(dist);
const srv = await startServerProcess({ dist });
const browser = await launch('metal');
const locale = LANG === 'it' ? 'it-IT' : 'en-US';
const ctx = await browser.newContext({ viewport: { width: W, height: H }, locale });
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
const shot = async (page, name) => { await audit(page, name); await page.screenshot({ path: join(DIR, `meteo-${name}.png`) }); };
const errors = [];
const open = async (query, base = srv.base) => {
  const tv = await ctx.newPage();
  tv.on('pageerror', (e) => errors.push(e.message));
  tv.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await tv.goto(`${base}/?lang=${LANG}&quality=capture&${query}`);
  await tv.waitForFunction(() => window.__game?.ready || window.__game?.error, null, { timeout: 180000 });
  return tv;
};
const skyQuery = (s) => { const [k, n] = s.split('+'); return k === 'night' ? 'night=1' : `weather=${k}${n ? '&night=1' : ''}`; };

if (scenes.includes('menus')) {
  const tv = await open('');
  const phone = await openPad(browser, srv.base, { label: 'wx', locale });
  await tv.waitForFunction(() => window.__game.seats[0]?.present, null, { timeout: 20000 });
  await phone.page.locator('.seg[data-key="weather"] button[data-v="rain"]').tap();
  await phone.page.locator('.seg[data-key="night"] button[data-v="true"]').tap();
  await tv.waitForFunction(() => window.__game.flowApi.opts.weather === 'rain' && window.__game.flowApi.opts.night === true, null, { timeout: 5000 });
  await sleep(500);
  await shot(tv, 'lobby');
  await phone.page.screenshot({ path: join(DIR, 'meteo-pad-lobby.png') });
  await phone.page.locator('#goBtn').tap();
  await phone.page.waitForFunction(() => window.__pad.phase === 'pick', null, { timeout: 8000 });
  await sleep(350);
  await phone.page.locator('#readyBtn').tap();
  await tv.waitForFunction(() => window.__game.phase === 'vote', null, { timeout: 8000 });
  await sleep(900);
  await shot(tv, 'vote');
  await phone.page.screenshot({ path: join(DIR, 'meteo-pad-vote.png') });
  await phone.ctx.close();
  await tv.close();
}
const road = async (name, views, sky) => {
  const tv = await open(`track=${TRACK}&${skyQuery(sky)}&players=${views}&kart=${KART}&bots=7&flyover=0&countdown=1`);
  await tv.evaluate(({ at }) => {
    const g = window.__game;
    g.setScript((i) => g.drive(i));
    g.speed = 1;
    g.views.forEach((v, n) => g.teleport(v, at + n * 0.004, 0, { speed: 22 }));
  }, { at: AT });
  await tv.waitForFunction(() => window.__game.state?.phase === 'race', null, { timeout: 30000 });
  await sleep(2600);
  const st = await tv.evaluate(() => { const s = window.__game.renderer.stats(); return { calls: s.perView, tris: s.trianglesPerView, wx: window.__game.renderer.weatherStats() }; });
  console.log(name, sky, `calls ${st.calls?.toFixed(0)} tris ${(st.tris / 1000).toFixed(0)}k`, JSON.stringify(st.wx));
  await shot(tv, name);
  await tv.close();
};
if (scenes.includes('road')) for (const s of SKIES) await road(`road-${TRACK}-${s}`, 1, s);
if (scenes.includes('2v')) await road(`2v-${TRACK}-${SKIES[0]}`, 2, SKIES[0]);
if (scenes.includes('4v')) await road(`4v-${TRACK}-${SKIES[0]}`, 4, SKIES[0]);
if (errors.length) console.log('[errors]', [...new Set(errors)].slice(0, 6).join(' | '));
await browser.close();
await srv.close();
rmSync(dist, { recursive: true, force: true });
process.exit(0);
