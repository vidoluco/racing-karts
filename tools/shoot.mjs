#!/usr/bin/env node
// tools/shoot.mjs <track> [--views n] [--t seconds] [--at u] [--d lateral] [--out name] [--pose x,y,z,lx,ly,lz[,fov]] [--flyover 0..1]
//   [--size 1920x1080] [--no-others] [--give item] [--query kart0=jeep&seed=3]: more of the page's own query
// A real race from src/sim in a real headless Metal browser, screenshot into docs/shots/<track>-<name>.png.
//   --t 20: run the race to that time. --at 0.4: place view 0's kart there on the lap, driving, rivals around it.
//   --pose: a free camera, for looking at a landmark from anywhere. Several shots in one run: --shots file.json, a list of those options.
import { launch, gpuInfo } from './harness.mjs';
import { serveDev, ROOT } from './render-dev.mjs';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const has = (k) => argv.includes(`--${k}`);
const track = argv.find((a, i) => !a.startsWith('--') && (i === 0 || !argv[i - 1].startsWith('--'))) || 'antelao';
const [W, H] = opt('size', '1920x1080').split('x').map(Number);
const baseOut = opt('dir', join(ROOT, 'docs/shots'));
mkdirSync(baseOut, { recursive: true });

const shots = opt('shots', null) ? JSON.parse(readFileSync(opt('shots'), 'utf8')) : [{
  views: +opt('views', 1), t: opt('t', null), at: opt('at', null), d: +opt('d', 0), out: opt('out', null), pose: opt('pose', null), flyover: opt('flyover', null), others: !has('no-others'), give: opt('give', null), frames: +opt('frames', 0),
}];

const srv = await serveDev({ dist: process.env.DIST || null });
const browser = await launch('metal');
const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })).newPage();
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/GPU stall|swiftshader/i.test(m.text())) console.log(`[${m.type()}] ${m.text().slice(0, 400)}`); });

// group shots by view count: a page per view count, since setViews and the world live with it
const byViews = new Map();
for (const s of shots) { const v = s.views ?? 1; if (!byViews.has(v)) byViews.set(v, []); byViews.get(v).push(s); }
let first = true;
try {
  for (const [views, list] of byViews) {
    const t0 = Date.now();
    await page.goto(`${srv.base}/?track=${track}&views=${views}&quality=capture&countdown=${list[0].countdown ?? 3}${opt('query', null) ? `&${opt('query')}` : ''}`);
    await page.waitForFunction(() => window.__dev?.ready || window.__dev?.error, null, { timeout: 180000 });
    const err = await page.evaluate(() => window.__dev.error);
    if (err) throw new Error(err);
    if (first) { const g = await gpuInfo(page); console.log(`gpu: ${g.renderer}, loaded in ${((Date.now() - t0) / 1000).toFixed(1)} s (${(await page.evaluate(() => window.__dev.loadMs)).toFixed(0)} ms in the page)`); first = false; }
    for (const s of list) {
      const name = s.out || (s.at ? `u${s.at}` : s.pose ? 'pose' : s.flyover != null ? `fly${s.flyover}` : `t${s.t ?? 0}`);
      let st;
      if (s.pose) st = await page.evaluate((p) => window.__dev.pose(...p), String(s.pose).split(',').map(Number));
      else if (s.flyover != null) st = await page.evaluate((t) => window.__dev.flyover(t), +s.flyover);
      else {
        await page.evaluate(() => window.__dev.unpose());
        if (s.at != null) st = await page.evaluate(({ u, d, others, settle, spread }) => { window.__dev.at(u, { d, others, settle, spread }); return window.__dev.stats(); }, { u: +s.at, d: s.d || 0, others: s.others !== false, settle: s.settle ?? 70, spread: s.spread ?? null });
        else st = await page.evaluate((t) => window.__dev.advanceTo(t), +(s.t ?? 6));
        if (s.give) await page.evaluate((g) => window.__dev.give(0, g), s.give);
        if (s.frames) st = await page.evaluate((n) => window.__dev.frames(n), s.frames);
      }
      await page.evaluate(() => window.__dev.draw());
      const file = join(baseOut, `${track}-${name}.png`);
      await page.screenshot({ path: file });
      console.log(`${file}  views ${views}  calls ${st.drawCalls} (${st.perView?.toFixed(0)}/view)  tris ${(st.triangles / 1000).toFixed(0)}k (${(st.trianglesPerView / 1000).toFixed(0)}k/view)`);
    }
  }
} finally {
  await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 3000))]);
  srv.close();
}
process.exit(0);
