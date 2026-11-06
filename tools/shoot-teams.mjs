// Screenshots of a team championship through the real game and real phone pages: lobby, line-up, vote, the road at 1, 2 and 4 views,
// results, podium, and the phone's screens. Into docs/shots/teams-*.png, or --dir. node tools/shoot-teams.mjs [--track antelao] [--dir path] [--lang it] [--size 1920x1080] [--suffix -x] [menus] [road] [2v] [4v]
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launch, buildDist, startServerProcess, openPad, ROOT } from './harness.mjs';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv.splice(i, 2)[1] : d; };
const TRACK = opt('track', 'antelao'), DIR = opt('dir', join(ROOT, 'docs/shots')), LANG = opt('lang', 'it'), SUFFIX = opt('suffix', '');
const [W, H] = opt('size', '1920x1080').split('x').map(Number);
const scenes = argv.length ? argv : ['menus', '2v', 'road', '4v'];
mkdirSync(DIR, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dist = mkdtempSync(join(tmpdir(), 'rk-teams-shot-'));
await buildDist(dist);
let srv = null; // one per scene: a closed phone keeps its seat for a minute
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
const shot = async (page, name) => { await audit(page, name); await page.screenshot({ path: join(DIR, `teams-${name}${SUFFIX}.png`) }); };
const errors = [];

// The race seen from behind and ahead: a mate and a rival put a little in front of the first kart, so that their banners are in frame.
async function road(tv, name) {
  await tv.waitForFunction(() => window.__game.phase === 'race' && window.__game.state, null, { timeout: 180000 });
  await tv.evaluate(() => window.__game.skipFlyover());
  await tv.waitForFunction(() => !window.__game.flyover && window.__game.state?.phase === 'race', null, { timeout: 40000 });
  await tv.evaluate(() => { const g = window.__game; g.setScript((i) => g.drive(i)); });
  await sleep(4000);
  await tv.evaluate(() => {
    const g = window.__game, K = g.state.karts, me = K[g.views[0]], list = K.filter((k) => k !== me);
    const at = (n) => (me.progress % 1 + n + 1) % 1;
    list.forEach((k, n) => g.teleport(k.i, at(0.0065 * (n + 1)), n % 2 ? 2.5 : -2.5, { speed: me.speed, lap: me.lap }));
  });
  await sleep(450);
  await shot(tv, `road-${name}`);
  console.log(name, JSON.stringify(await tv.evaluate(() => { const g = window.__game, s = g.renderer.stats(); return { fps: Math.round(s.fps), perView: Math.round(s.perView), tris: Math.round(s.trianglesPerView), teams: g.state.karts.map((k) => k.team ?? null) }; })));
}
async function open() {
  const tv = await ctx.newPage();
  tv.on('pageerror', (e) => errors.push(e.message));
  await tv.goto(`${srv.base}/?lang=${LANG}`);
  await tv.waitForFunction(() => window.__game?.ready || window.__game?.error, null, { timeout: 120000 });
  return tv;
}
const phones = async (n) => {
  const list = [];
  for (let q = 0; q < n; q++) {
    const p = await openPad(browser, srv.base, { locale: LANG === 'it' ? 'it-IT' : 'en-US', label: `p${q}` });
    list.push(p);
  }
  return list;
};

for (const scene of scenes) {
  const views = scene === '4v' ? 4 : scene === '2v' ? 2 : scene === 'road' ? 1 : 3;
  srv = await startServerProcess({ dist });
  const tv = await open();
  const pads = await phones(views);
  await tv.waitForFunction((k) => window.__game.flowApi.present().length === k, views, { timeout: 15000 });
  const P0 = pads[0];
  await tv.evaluate(() => { const f = window.__game.flowApi; f.setOpts({ mode: 'teams', laps: 2 }); window.__game.next?.('none'); });
  await P0.page.locator('.seg[data-key="laps"] button[data-v="2"]').tap();
  await sleep(900);
  if (scene === 'menus') {
    await shot(tv, 'lobby');
    await shot(P0.page, 'phone-lobby');
    await shot(pads[1].page, 'phone-lobby-guest');
  }
  await P0.page.locator('#goBtn').tap();
  await tv.waitForFunction(() => window.__game.phase === 'pick', null, { timeout: 15000 });
  for (const p of pads) {
    await p.page.waitForFunction(() => window.__pad.carousel?.focus, null, { timeout: 8000 });
    if (scene === 'menus' && p === pads[1]) { await sleep(1500); await shot(tv, 'pick'); await shot(p.page, 'phone-pick'); }
    await p.page.locator('#readyBtn').tap();
  }
  await tv.waitForFunction(() => window.__game.phase === 'vote', null, { timeout: 15000 });
  await sleep(600);
  await tv.evaluate((id) => { const f = window.__game.flowApi; f.gpToggle(id); if (id !== 'pelmo') f.gpToggle('pelmo'); window.__game.ui.C.emit('gpList'); }, TRACK);
  if (scene === 'menus') { await sleep(500); await shot(tv, 'vote'); }
  await tv.evaluate(() => window.__game.ui.C.emit('gpGo'));
  if (scene === 'menus') {
    const race = async () => {
      await tv.waitForFunction(() => window.__game.phase === 'race' && window.__game.state, null, { timeout: 180000 });
      await tv.evaluate(() => window.__game.skipFlyover());
      await tv.waitForFunction(() => !window.__game.flyover && window.__game.state?.phase === 'race', null, { timeout: 40000 });
      await tv.evaluate(() => { const g = window.__game; g.setAuto(true); g.speed = 40; });
      await sleep(2000);
      await shot(P0.page, 'phone-race');
      await tv.waitForFunction(() => window.__game.phase === 'results', null, { timeout: 400000 });
      await tv.evaluate(() => { const g = window.__game; g.setAuto(false); g.speed = 1; });
    };
    await race();
    await sleep(2200);
    await shot(tv, 'results-1');
    await shot(P0.page, 'phone-results');
    await sleep(900); // past the moment a screen takes no press
    for (const p of pads) await p.page.locator('#resNext').tap();
    await race();
    await sleep(2200);
    await shot(tv, 'results-final');
    await tv.waitForFunction(() => window.__game.phase === 'podium', null, { timeout: 20000 });
    await sleep(3200);
    await shot(tv, 'podium');
    await shot(P0.page, 'phone-podium');
    await shot(pads[1].page, 'phone-podium-guest');
  } else {
    await road(tv, scene === 'road' ? '1v' : scene);
  }
  for (const p of pads) await p.ctx.close().catch(() => {});
  await tv.close();
  await srv.close();
}
console.log('errors', errors);
await browser.close();
rmSync(dist, { recursive: true, force: true });
