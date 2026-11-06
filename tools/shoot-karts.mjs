#!/usr/bin/env node
// tools/shoot-karts.mjs [--sheets large,small,back,poses,react,gait,items,spills] [--png] [--only id,id] [--pose name] [--dir path]
// Karts and items through the real toon pipeline, in a headless Metal browser. With no option: every sheet into docs/shots/ and
// each kart's 512 px transparent picture into assets/ui/karts/<id>.png, the picture the phone carousel and the TV line-up show.
//   large   each kart from the front at 480 px, what the pick screen shows
//   back    each kart from behind at 480 px
//   small   each kart from the race camera at its true size in a 4-way split of a 1080p TV, what you see while racing
//   poses   each kart's driver through lean, drift, boost, hit, cheer, sad, and what the items do to a face
//   react   the pan on the head from the race camera, and the burnt face, kart by kart
//   gait    the horse of the caruta over one stride, from the side and the chase camera
//   items   each item model; spills: the ones that lie on the road, as they lie there
import { launch } from './harness.mjs';
import { serveDev, ROOT } from './render-dev.mjs';
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const SECRET = ['baileys', 'fifi'];
export const KARTS = ['tabia', 'gatto', 'seggiovia', 'mocanita', 'caruta', 'logan', 'jeep', 'becak', 'jukung', ...SECRET];
export const ITEMS = ['razzo', 'grappa', 'zuica', 'mici', 'uova', 'polenta', 'formaggio', 'durian', 'sambal', 'rendang', 'frana'];
const POSES = ['idle', 'leanL', 'drift', 'boost', 'hit', 'cheer', 'sad', 'tipsy', 'stink', 'mici', 'soot', 'lick', 'sip', 'big', 'air'];

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const has = (k) => argv.includes(`--${k}`);
const dir = opt('dir', join(ROOT, 'docs/shots'));
const only = opt('only', null)?.split(',') || null;
const karts = only ? KARTS.filter((k) => only.includes(k)) : KARTS, items = only ? ITEMS.filter((k) => only.includes(k)) : ITEMS;
const sheets = opt('sheets', null)?.split(',') || (has('png') ? [] : ['large', 'back', 'small', 'poses', 'react', 'gait', 'items', 'spills', 'icons']);
const pngs = has('png') || !opt('sheets', null);
mkdirSync(dir, { recursive: true });

const srv = await serveDev({ entry: 'dev/karts-dev.js' });
const browser = await launch('metal');
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })).newPage();
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/GPU stall|swiftshader/i.test(m.text())) console.log(`[${m.type()}] ${m.text().slice(0, 500)}`); });

const save = (file, url) => { writeFileSync(file, Buffer.from(url.split(',')[1], 'base64')); return file; };
async function sheet(name, cells, opts) {
  if (!cells.length) return;
  const r = await page.evaluate(([c, o]) => window.__karts.sheet(c, o), [cells, opts]);
  console.log(`${save(join(dir, `${name}.png`), r.url)}  ${r.report.map((q) => `${q.id}:${q.tris ?? ''}${q.placeholder ? '(placeholder)' : ''}`).join(' ')}`);
}

try {
  await page.goto(`${srv.base}/`);
  await page.waitForFunction(() => window.__karts?.ready || window.__karts?.error, null, { timeout: 60000 });
  const err = await page.evaluate(() => window.__karts.error);
  if (err) throw new Error(err);
  if (sheets.includes('large')) await sheet('karts-front', karts.map((id) => ({ id, cam: 'hero' })), { cols: Math.min(5, karts.length), w: 480, h: 480 });
  if (sheets.includes('back')) await sheet('karts-back', karts.map((id) => ({ id, cam: 'back' })), { cols: Math.min(5, karts.length), w: 480, h: 480 });
  if (sheets.includes('small')) {
    // one cell of a 4-way split of a 1080p TV is 960 x 540; the crop is what the kart fills of it
    const crop = [960 / 2 - 170, 200, 340, 300];
    await sheet('karts-small', karts.map((id) => ({ id, cam: 'chase', crop })), { cols: Math.min(5, karts.length), w: 960, h: 540, label: false });
    await sheet('karts-small-quarter', karts.map((id) => ({ id, cam: 'chase', yaw: 0.55, crop })), { cols: Math.min(5, karts.length), w: 960, h: 540, label: false });
  }
  // the iron pan and the burnt face as the race camera sees them, on every kart
  if (sheets.includes('react')) {
    const crop = [960 / 2 - 170, 200, 340, 300];
    await sheet('karts-big-chase', karts.map((id) => ({ id, pose: 'big', cam: 'chase', crop })), { cols: Math.min(5, karts.length), w: 960, h: 540, label: false });
    await sheet('karts-soot', karts.map((id) => ({ id, pose: 'soot', cam: 'hero', yaw: 0.4 })), { cols: Math.min(5, karts.length), w: 360, h: 360 });
  }
  if (sheets.includes('poses')) {
    const chosen = opt('pose', null)?.split(',') || POSES;
    for (const id of karts) await sheet(`karts-pose-${id}`, chosen.map((pose) => ({ id, pose, cam: 'hero', yaw: 0.4 })), { cols: 5, w: 360, h: 360 });
  }
  // a galloper over one stride, a frame every few steps, from the side and from the chase camera
  if (sheets.includes('gait')) {
    for (const [name, pose] of [['run', 'run'], ['boost', 'boost']]) await sheet(`karts-gait-${name}`, Array.from({ length: 8 }, (_, i) => ({ id: 'caruta', pose, cam: 'side', steps: i ? 2 : 60 })), { cols: 4, w: 400, h: 340 });
    await sheet('karts-gait-chase', Array.from({ length: 4 }, (_, i) => ({ id: 'caruta', pose: 'run', cam: 'chase', steps: i ? 3 : 60, crop: [310, 200, 340, 300] })), { cols: 4, w: 960, h: 540, label: false });
  }
  if (sheets.includes('items')) await sheet('items', items.map((id) => ({ id, kind: 'item' })), { cols: 4, w: 420, h: 420 });
  if (sheets.includes('spills')) {
    const spill = { polenta: { r: 4.2, ttl: 16, t: 3 }, durian: { r: 6, ttl: 7, t: 1 }, sambal: { r: 1.7, ttl: 2.6, t: 0.6 } };
    await sheet('items-spills', Object.entries(spill).filter(([id]) => items.includes(id)).map(([id, pose]) => ({ id, kind: 'item', pose })), { cols: 3, w: 420, h: 420 });
  }
  if (sheets.includes('icons')) {
    const { itemIcon, flag, uiIcon, ITEM_ICON_IDS, UI_ICON_NAMES } = await import('../src/ui/icons.js');
    const svg = [...ITEM_ICON_IDS.map(itemIcon), ...['cadore', 'romania', 'indonesia'].map(flag), ...UI_ICON_NAMES.map(uiIcon)];
    const html = `<body style="margin:0;background:#3b6ea8;display:flex;flex-wrap:wrap;gap:10px;padding:12px;width:1120px">${svg.map((v) => `<div style="width:96px;height:96px">${v}</div>`).join('')}<div style="width:100%;background:#7fae5e;display:flex;flex-wrap:wrap;gap:6px;padding:6px">${ITEM_ICON_IDS.map(itemIcon).map((v) => `<div style="width:40px;height:40px">${v}</div>`).join('')}</div></body>`;
    const p2 = await browser.newContext({ viewport: { width: 1144, height: 600 }, deviceScaleFactor: 1 }).then((c) => c.newPage());
    await p2.setContent(html);
    const file = join(dir, 'icons.png');
    await p2.screenshot({ path: file, fullPage: true });
    console.log(file);
  }
  if (pngs) {
    const out = join(ROOT, 'assets/ui/karts');
    mkdirSync(out, { recursive: true });
    for (const id of karts) {
      const file = save(join(out, `${id}.png`), await page.evaluate((k) => window.__karts.png(k, 512), id));
      console.log(`${file}  ${(statSync(file).size / 1024).toFixed(0)} KB`);
    }
  }
} finally {
  await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 3000))]);
  srv.close();
}
process.exit(0);
