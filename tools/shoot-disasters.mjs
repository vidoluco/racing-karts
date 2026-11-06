#!/usr/bin/env node
// Screenshots of every natural disaster through the real game page, HUD and all: docs/shots/disaster-<scene>.png.
// node tools/shoot-disasters.mjs [scene names] [--size 1920x1080] [--dir docs/shots]. Each scene is a stage on a track,
// with its def.disasters given on the page's URL, so a kind can be shot before its track has it.
import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { launch, startServerProcess, ROOT } from './harness.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const dir = join(ROOT, opt('--dir', 'docs/shots'));
const [W, H] = opt('--size', '1920x1080').split('x').map(Number);
const only = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
mkdirSync(dir, { recursive: true });
const dist = mkdtempSync(join(tmpdir(), 'rk-dis-'));
execFileSync(process.execPath, ['build.mjs'], { cwd: ROOT, env: { ...process.env, DIST: dist }, stdio: 'inherit' });
const srv = await startServerProcess({ dist });
const browser = await launch('metal');

const SAY = (it, en) => ({ it, en });
// frames: how long after the warning to shoot (s). run: seconds of driving before the place the shot wants the kart at. pose: a free camera instead of the chase.
const SCENES = {
  'bromo-eruption': { track: 'bromo', use: true, entry: 0, at: 5.2, arrive: 6.5 },
  'bromo-cloud': { track: 'bromo', use: true, entry: 1, at: 10, arrive: 10.4 },
  'debris-warn': { track: 'antelao', use: true, entry: 0, at: 1.7, arrive: 4.4 },
  'debris-strike': { track: 'antelao', use: true, entry: 0, at: 3.5, arrive: 5 },
  'debris-after': { track: 'antelao', use: true, entry: 0, at: 9, arrive: 10.2 },
  'rockfall-warn': { track: 'antelao', use: true, entry: 1, at: 1.5, arrive: 2.9 },
  'rockfall-strike': { track: 'antelao', use: true, entry: 1, at: 3.6, arrive: 5 },
  avalanche: { track: 'antelao', list: [{ kind: 'avalanche', u: 0.742, side: -1, name: 'Valanga del Pelmo', say: SAY('Una valanga giù dal Pelmo!', 'An avalanche off the Pelmo!') }], at: 3.9, arrive: 5.0 },
  'avalanche-after': { track: 'antelao', list: [{ kind: 'avalanche', u: 0.742, side: -1, name: 'Valanga del Pelmo', say: SAY('Una valanga giù dal Pelmo!', 'An avalanche off the Pelmo!') }], at: 8, arrive: 8.7 },
  quake: { track: 'antelao', list: [{ kind: 'quake', u: 0.742, side: -1, name: 'Cutremur di Vrancea', say: SAY('La terra trema!', 'The ground is shaking!') }], at: 4.2, arrive: 4.9 },
  eruption: { track: 'antelao', list: [{ kind: 'eruption', u: 0.742, side: -1, name: 'Eruzione del Bromo', say: SAY('Bombe di lava, guarda le ombre!', 'Lava bombs, watch the shadows!'), bearing: 268 }], at: 6, arrive: 6.4 },
  cloud: { track: 'antelao', list: [{ kind: 'cloud', u: 0.742, name: 'Nube del Semeru', say: SAY('Il Semeru sbuffa, laggiù!', 'Semeru is puffing, far off!'), bearing: 275 }], at: 11, arrive: 13 },
  lahar: { track: 'antelao', list: [{ kind: 'lahar', u: 0.742, side: -1, name: 'Lahar del Gunung Agung', say: SAY('Un fiume di fango dal vulcano!', 'A river of mud off the volcano!') }], at: 5, arrive: 6 },
  'bali-lahar-warn': { track: 'bali', use: true, entry: 0, at: 1.6, arrive: 5 },
  'bali-lahar': { track: 'bali', use: true, entry: 0, at: 5, arrive: 6 },
  'bali-lahar-south': { track: 'bali', use: true, entry: 1, at: 5, arrive: 6 },
  'bali-lahar-after': { track: 'bali', use: true, entry: 1, at: 16, arrive: 17 },
  'debris-top': { track: 'antelao', use: true, entry: 0, at: 3.7, arrive: 12, pose: [-40, 40, 40, 0, -30, 50] },
  'debris-top2': { track: 'antelao', use: true, entry: 0, at: 9, arrive: 16, pose: [-40, 40, 40, 0, -30, 50] },
  ice: { track: 'antelao', hazards: [{ kind: 'ice', u: 0.14, width: 1 }], list: [], at: 2.5, plain: 0.14, arrive: 3.8 },
  'quake-2v': { track: 'antelao', views: 2, list: [{ kind: 'quake', u: 0.742, side: -1, name: 'Cutremur di Vrancea', say: SAY('La terra trema!', 'The ground is shaking!') }], at: 3.6, arrive: 4.9 },
  'lahar-4v': { track: 'antelao', views: 4, list: [{ kind: 'lahar', u: 0.742, side: -1, name: 'Lahar del Gunung Agung', say: SAY('Un fiume di fango dal vulcano!', 'A river of mud off the volcano!') }], at: 4.4, arrive: 5.6 },
  'tf-valanga': { track: 'transfagarasan', use: true, entry: 0, at: 3.9, arrive: 5 },
  'tf-valanga-after': { track: 'transfagarasan', use: true, entry: 0, at: 8, arrive: 8.7 },
  'tf-massi': { track: 'transfagarasan', use: true, entry: 1, at: 3.6, arrive: 5 },
  'steam-ice': { track: 'antelao', hazards: [{ kind: 'steam', u: 0.045, period: 7 }, { kind: 'ice', u: 0.075, width: 1 }], list: [], at: 2.5, plain: 0.03 },
};

async function open(sc, views = 1) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, locale: sc.lang === 'en' ? 'en-US' : 'it-IT' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) console.log('[console]', m.text().slice(0, 300)); });
  const q = new URLSearchParams({ track: sc.track, views, players: views, bots: 8 - views, difficulty: 'hard', manual: 1, quality: 'capture', seed: sc.seed ?? 11, countdown: 0, laps: 3 });
  if (!sc.use) q.set('disasters', JSON.stringify(sc.list || []));
  if (sc.hazards) q.set('hazards', JSON.stringify(sc.hazards));
  await page.goto(`${srv.base}/?${q}`);
  await page.waitForFunction(() => window.__game?.ready || window.__game?.error, null, { timeout: 180000 });
  const err = await page.evaluate(() => window.__game.error);
  if (err) throw new Error(err);
  return { ctx, page };
}

// The kart drives its own line in the free lane or not as asked, timed to reach the place `arrive` s after the warning starts.
async function stage(page, sc) {
  return page.evaluate((s) => {
    const g = window.__game, T = g.renderer.world.track, L = T.length, views = g.views, me = views[0];
    const list = T.def.disasters || [];
    const e = list[s.entry ?? 0], u = s.plain ?? e?.u ?? 0.5, run = 26;
    g.setScript((i) => { const a = g.drive(i); a.item = false; if (s.lane !== undefined && i === me) a.lane = s.lane; return a; });
    const others = g.players.map((p, i) => i).filter((i) => !views.includes(i));
    const m = s.arrive ? run * s.arrive : run * (s.at + 0.6);
    g.teleport(me, u - m / L, 0, { speed: run });
    views.slice(1).forEach((v, n) => g.teleport(v, u - (m + 10 + n * 8) / L, n % 2 ? 3.5 : -3.5, { speed: run }));
    others.forEach((b, n) => g.teleport(b, u - (m + (n < 3 ? -18 - n * 14 : 26 + n * 12)) / L, n % 2 ? 3.2 : -3.2, { speed: run }));
    if (e) g.disaster(s.entry ?? 0);
    const frames = Math.round(s.at * 60);
    g.advance(frames);
    if (s.pose) {
      const S = T.samples, c = Math.round((((u % 1) + 1) % 1) * T.n) % T.n, [al, lat, up, lookAl = 0, lookLat = 0, fov = 50] = s.pose, i = ((c + Math.round(al / T.step)) % T.n + T.n) % T.n, j = ((c + Math.round(lookAl / T.step)) % T.n + T.n) % T.n;
      const v = g.renderer.views[0];
      v.poseOn = true; v.gx = 1e9;
      v.cam.pose(S.x[i] + S.nx[i] * lat, S.y[i] + up, S.z[i] + S.nz[i] * lat, S.x[j] + S.nx[j] * lookLat, S.y[j], S.z[j] + S.nz[j] * lookLat, fov);
      g.advance(2);
    }
    return { t: g.state.t, ash: g.state.ash, quake: g.state.quake, d: g.state.disasters?.map((q) => [q.kind, q.phase, +q.t.toFixed(1), q.pieces.length, +q.front.toFixed(1), +q.stop.toFixed(1)]), kart: [g.state.karts[me].d, g.state.karts[me].u, g.state.karts[me].hitT] };
  }, sc);
}

const names = Object.keys(SCENES).filter((n) => !only.length || only.includes(n));
for (const name of names) {
  const sc = SCENES[name];
  const { ctx, page } = await open(sc, sc.views ?? 1);
  const info = await stage(page, sc);
  await page.evaluate(() => window.__game.draw());
  // the banner lands with an overshoot: let it settle, it is the rest of the time that counts
  await new Promise((r) => setTimeout(r, 900));
  await page.screenshot({ path: join(dir, `disaster-${name}.png`) });
  const st = await page.evaluate(() => { const s = window.__game.renderer.stats(); return { calls: s.perView, tris: Math.round(s.trianglesPerView) }; });
  console.log(`disaster-${name}.png`, JSON.stringify(info), JSON.stringify(st));
  await ctx.close();
}
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 3000))]);
srv.close?.();
process.exit(0);
