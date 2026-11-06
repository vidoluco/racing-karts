#!/usr/bin/env node
// The composed pictures of the README, laid out as a web page over real captures, screenshotted in headless Chromium.
// node tools/compose-readme.mjs [--raw docs/shots/readme] [how] [karts] [items] [gp] [logo] [stills] [gif]. Needs the raw files of tools/shoot-readme.mjs, and
// items.png from tools/shoot-karts.mjs --sheets items --dir <raw>. Writes into docs/media.
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import { execFileSync } from 'node:child_process';
import { launch, ROOT } from './harness.mjs';
import { KARTS, SECRET_KARTS } from '../src/data/karts.js';
import { ITEMS } from '../src/data/items.js';
import { logo } from '../src/ui/screens/art.js';
import { FREDOKA_WOFF2 } from '../src/ui/font-data.js';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv.splice(i, 2)[1] : d; };
const rawArg = opt('raw', 'docs/shots/readme');
const RAW = isAbsolute(rawArg) ? rawArg : join(ROOT, rawArg);
const OUT = join(ROOT, 'docs/media');
mkdirSync(OUT, { recursive: true });
const want = (n) => !argv.length || argv.includes(n);
const url = (file) => `data:image/${/png$/.test(file) ? 'png' : 'jpeg'};base64,${readFileSync(file).toString('base64')}`;
const raw = (name) => url(join(RAW, name));
const head = `<!doctype html><meta charset="utf-8"><style>
@font-face { font-family: F; src: url(data:font/woff2;base64,${FREDOKA_WOFF2}); font-weight: 300 700; }
* { box-sizing: border-box; margin: 0; }
body { font-family: F, sans-serif; color: #1d1f2b; width: var(--w); height: var(--h); overflow: hidden; background: linear-gradient(180deg, #bda3e6 0%, #ecbfd6 62%, #f6dcc0 100%); position: relative; }
.sticker { background: #fffaf0; border: 3px solid #1d1f2b; border-radius: 16px; box-shadow: 0 4px 0 #1d1f2b; font-weight: 600; }
</style>`;

const browser = await launch('metal');
async function render(name, w, h, body, quality = 88) {
  const page = await (await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })).newPage();
  await page.setContent(`${head}<style>:root { --w: ${w}px; --h: ${h}px; }</style>${body}`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  await page.screenshot({ path: join(OUT, name), type: 'jpeg', quality });
  console.log(name);
}

// The name a public page shows: the two karts named after real car makers go by what they are.
const PUBLIC_NAME = { logan: 'Logan Vecchia', jeep: 'Bromo 4x4' };

if (want('how')) await render('tv-and-phone.jpg', 1280, 620, `<style>
.tv { position: absolute; left: 26px; top: 24px; width: 900px; padding: 14px 14px 18px; background: #1d1f2b; border-radius: 18px; box-shadow: 0 18px 40px #1d1f2b66; }
.tv img { width: 100%; display: block; border-radius: 6px; }
.foot { position: absolute; left: 376px; top: 548px; width: 200px; height: 16px; background: #1d1f2b; border-radius: 0 0 14px 14px; }
.phone { position: absolute; padding: 11px 15px; background: #15161f; border-radius: 30px; box-shadow: 0 16px 34px #1d1f2b80; }
.phone img { width: 100%; display: block; border-radius: 15px; }
.tag { position: absolute; padding: 7px 14px; font-size: 21px; }
.tag b { display: inline-grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; background: #ffc83d; border: 2px solid #1d1f2b; margin-right: 8px; font-size: 18px; }
</style>
<div class="tv"><img src="${raw('tv-lobby.png')}"></div><div class="foot"></div>
<div class="phone" style="left: 860px; top: 56px; width: 396px;"><img src="${raw('pad-lobby.png')}"></div>
<div class="phone" style="left: 690px; top: 306px; width: 566px;"><img src="${raw('pad-race.png')}"></div>
<div class="tag sticker" style="left: 42px; top: 568px;"><b>1</b>The TV shows a QR</div>
<div class="tag sticker" style="left: 912px; top: 16px;"><b>2</b>Each phone scans it</div>
<div class="tag sticker" style="left: 912px; top: 568px;"><b>3</b>The phone is your wheel</div>`);

if (want('karts')) {
  const card = (k, secret) => `<div class="k"><img src="${url(join(ROOT, `assets/ui/karts/${k.id}.png`))}"><div class="n sticker">${PUBLIC_NAME[k.id] ?? k.name}${secret ? ' <i>secret</i>' : ''}</div><div class="d">${k.driver.name}, ${k.driver.species.en}</div></div>`;
  await render('karts.jpg', 1280, 640, `<style>
.row { position: absolute; left: 0; right: 0; display: flex; justify-content: center; gap: 4px; }
.k { width: 208px; text-align: center; }
.k img { width: 200px; height: 200px; object-fit: contain; display: block; margin: 0 auto -8px; filter: drop-shadow(0 8px 6px #1d1f2b55); }
.n { display: inline-block; padding: 3px 12px; font-size: 18px; white-space: nowrap; box-shadow: 0 3px 0 #1d1f2b; }
.n i { font-style: normal; font-size: 14px; background: #ffc83d; border-radius: 8px; padding: 0 6px; margin-left: 4px; }
.d { margin-top: 6px; font-size: 16px; font-weight: 500; }
</style>
<div class="row" style="top: 14px;">${KARTS.slice(0, 6).map((k) => card(k)).join('')}</div>
<div class="row" style="top: 318px;">${[...KARTS.slice(6), ...SECRET_KARTS].map((k) => card(k, k.secret)).join('')}</div>`);
}

if (want('items')) {
  const sheet = raw('items.png'), S = 190;
  const cell = (it, n) => { const c = n % 4, r = (n - c) / 4, f = S / 420; return `<div class="it"><div class="p" style="background: url(${sheet}) ${-(c * 430 + 5) * f}px ${-(r * 456.67 + 5) * f}px / ${1720 * f}px ${1370 * f}px;"></div><div class="n">${it.name.en}</div></div>`; };
  await render('items.jpg', 1280, 560, `<style>
.row { position: absolute; left: 0; right: 0; display: flex; justify-content: center; gap: 16px; }
.it { width: ${S}px; background: #fffaf0; border: 3px solid #1d1f2b; border-radius: 18px; box-shadow: 0 4px 0 #1d1f2b; overflow: hidden; text-align: center; }
.p { width: 100%; height: ${S - 16}px; }
.n { height: 56px; display: grid; place-items: center; font-size: 18px; font-weight: 600; line-height: 1.1; padding: 0 6px; }
</style>
<div class="row" style="top: 20px;">${ITEMS.slice(0, 6).map((it, n) => cell(it, n)).join('')}</div>
<div class="row" style="top: 288px;">${ITEMS.slice(6).map((it, n) => cell(it, n + 6)).join('')}</div>`);
}

// The Grand Prix builder: its track cards, framed to 16:9 next to the other modes.
if (want('gp')) await render('mode-grand-prix.jpg', 1280, 720, `<style>
.c { position: absolute; left: 70px; top: 0; width: 1140px; height: 720px; overflow: hidden; }
.c img { position: absolute; left: 0; top: -109px; width: 1602px; }
</style><div class="c"><img src="${raw('ui-gp-build.png')}"></div>`);

// The logo of the lobby on nothing, for a light or a dark page.
if (want('logo')) {
  const page = await (await browser.newContext({ viewport: { width: 1000, height: 224 }, deviceScaleFactor: 1 })).newPage();
  await page.setContent(`${head}<style>:root { --w: 1000px; --h: 224px; } body { background: none; } svg { width: 1000px; font-family: F; display: block; }</style>${logo()}`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  await page.screenshot({ path: join(OUT, 'logo.png'), omitBackground: true });
  console.log('logo.png');
}

// Plain captures, 1280 wide. [file in docs/media, file in the raw folder]
const STILLS = [
  ...['antelao', 'pelmo', 'transfagarasan', 'bran', 'bromo', 'bali', 'jakarta', 'batur', 'cortina', 'bucarest'].map((t) => [`track-${t}`, `track-${t}`]),
  ['four-players', 'four-players'], ['chaos-eruption', 'chaos-eruption'], ['chaos-rocket', 'chaos-rocket'], ['jakarta-traffic', 'jakarta-traffic'],
  ['sky-rain-night', 'sky-rain-night'], ['sky-snow', 'sky-snow'], ['sky-night', 'sky-night'],
  ['mode-cheese', 'forma-road-mine'], ['mode-ghost', 'tempo-ghost'], ['mode-teams', 'teams-podium'],
];
if (want('stills')) for (const [out, from] of STILLS) {
  const file = join(RAW, `${from}.png`);
  if (!existsSync(file)) { console.log(`missing ${from}.png`); continue; }
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', file, '-vf', 'scale=1280:-2:flags=lanczos', '-q:v', '4', join(OUT, `${out}.jpg`)]);
}

// The hero: 7 s at 15 fps and 800 wide from the 20 fps film of tools/shoot-readme.mjs. Under 8 MB only with no dither and gifsicle's lossy pass.
if (want('gif')) {
  const tmp = join(RAW, 'race-raw.gif');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '20', '-pattern_type', 'glob', '-i', join(RAW, 'film/*.png'), '-filter_complex',
    '[0:v]trim=start_frame=4:end_frame=145,setpts=PTS-STARTPTS,fps=15,scale=800:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=full[p];[b][p]paletteuse=dither=none:diff_mode=rectangle', '-loop', '0', tmp]);
  execFileSync('gifsicle', ['-O3', '--lossy=110', tmp, '-o', join(OUT, 'race.gif')]);
}

await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 3000))]);
process.exit(0);
