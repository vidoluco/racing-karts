// Screenshots of the real game with the items in use: 1, 2 and 4 views, each item on the road, through the real page and server.
// node tools/shoot-race.mjs [scene names] [--dir docs/shots] [--size 1920x1080]. Writes race-<views>v-<scene>.png.
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { launch, startServerProcess, ROOT } from './harness.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const dir = join(ROOT, opt('--dir', 'docs/shots'));
const [W, H] = opt('--size', '1920x1080').split('x').map(Number);
const only = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
const dist = mkdtempSync(join(tmpdir(), 'rk-race-'));
mkdirSync(dir, { recursive: true });
execFileSync(process.execPath, ['build.mjs'], { cwd: ROOT, env: { ...process.env, DIST: dist }, stdio: 'inherit' });
const srv = await startServerProcess({ dist });
const browser = await launch('metal');

// Runs in the page. u: where on the lap; ahead: metres from view 0's kart to the helper; item: what happens.
async function stage(page, spec) {
  return page.evaluate((s) => {
    const g = window.__game, L = g.track && g.renderer.world.track.length, me = g.views[s.who ?? 0];
    const humans = g.players.map((p, i) => (p.human ? i : -1)).filter((i) => i >= 0);
    const bots = g.players.map((p, i) => (p.human ? -1 : i)).filter((i) => i >= 0);
    const pressed = new Set();
    g.setScript((i) => { const a = g.drive(i); a.item = false; if (s.stick?.[i] !== undefined) a.throttle = s.stick[i]; if (pressed.has(i)) { pressed.delete(i); a.item = true; } return a; });
    window.__press = (i, on) => pressed.add(i);
    // the field in a tidy line around the viewer, far from anything left by the previous scene
    g.state.shots.length = 0; g.state.spills.length = 0;
    for (const k of g.state.karts) { k.hitT = 0; k.hitKind = null; k.safeT = 0; k.bigT = 0; k.boostT = 0; k.boostKind = null; k.stinkT = 0; k.sootT = 0; k.tipsyT = 0; k.item = null; k.orbit = 0; k.itemCharges = 0; k.rendangT = 0; }
    bots.forEach((b, n) => g.teleport(b, s.u - (55 + n * 16) / L, (n % 2 ? 3 : -3), { speed: 26 }));
    g.views.forEach((v, n) => { if (v !== me) g.teleport(v, s.u + (n + 1) * 7 / L, n % 2 ? 3.5 : -3.5, { speed: 26 }); });
    g.teleport(me, s.u, s.d ?? 0, { speed: s.speed ?? 27 });
    if (s.helper != null) {
      const who = humans.find((i) => i !== me && !g.views.includes(i)) ?? bots[0];
      g.teleport(who, s.u + s.helper / L, s.helperD ?? 0, { speed: 26 });
      window.__helper = who;
    }
    g.advance(s.settle ?? 20);
    return { me, humans, bots, helper: window.__helper };
  }, spec);
}
const act = (page, fn, arg) => page.evaluate(fn, arg);
const frames = (page, n) => page.evaluate((c) => window.__game.advance(c).t, n);
const shot = async (page, views, name) => {
  await new Promise((r) => setTimeout(r, 120));
  await page.screenshot({ path: join(dir, `race-${views}v-${name}.png`) });
  console.log(`race-${views}v-${name}.png`, JSON.stringify(await page.evaluate(() => { const s = window.__game.renderer.stats(); return { calls: s.perView, tris: Math.round(s.trianglesPerView), fps: Math.round(s.fps) }; })));
};
const want = (n) => !only.length || only.includes(n);

async function open(views, players) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, locale: 'it-IT' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text().slice(0, 300)); });
  const url = `${srv.base}/?track=antelao&views=${views}&players=${players}&bots=${8 - players}&difficulty=medium&manual=1&quality=capture&seed=11&countdown=0&laps=3`;
  await page.goto(url);
  await page.waitForFunction(() => window.__game?.ready || window.__game?.error, null, { timeout: 120000 });
  const err = await page.evaluate(() => window.__game.error);
  if (err) throw new Error(err);
  return { ctx, page };
}
const give = (page, i, item) => act(page, ([k, it]) => window.__game.give(k, it), [i, item]);
const press = (page, i) => act(page, (k) => window.__press(k), i);

async function single() {
  const { ctx, page } = await open(1, 2);
  const U = 0.2;
  if (want('razzo')) {
    const s = await stage(page, { u: U, helper: 70, speed: 28 });
    await give(page, s.me, 'razzo'); await press(page, s.me); await frames(page, 26);
    await shot(page, 1, 'razzo');
  }
  if (want('uova')) {
    const s = await stage(page, { u: U + 0.03 });
    await give(page, s.me, 'uova'); await press(page, s.me); await frames(page, 50);
    await shot(page, 1, 'uova');
  }
  if (want('mici')) {
    const s = await stage(page, { u: U + 0.05 });
    await give(page, s.me, 'mici'); await frames(page, 26);
    await shot(page, 1, 'mici');
  }
  if (want('durian')) {
    const s = await stage(page, { u: U + 0.07, helper: 32 });
    await give(page, s.helper, 'durian'); await press(page, s.helper); await frames(page, 30);
    await shot(page, 1, 'durian');
  }
  if (want('sambal')) {
    let s = await stage(page, { u: U + 0.09, helper: 26 });
    await give(page, s.helper, 'sambal'); await press(page, s.helper); await frames(page, 9);
    await shot(page, 1, 'sambal-blast');
    await frames(page, 24);
    await shot(page, 1, 'sambal-flames');
  }
  if (want('rendang')) {
    const s = await stage(page, { u: U + 0.14, helper: 36, helperD: 3 });
    await give(page, s.me, 'rendang'); await give(page, s.helper, 'zuica'); await press(page, s.me); await frames(page, 45);
    await shot(page, 1, 'rendang');
  }
  if (want('frana')) {
    const s = await stage(page, { u: U + 0.18 });
    await act(page, (me) => window.__game.teleport(me, 0.38, 0, { speed: 27, lap: 1 }), s.me);
    await give(page, s.humans.find((i) => i !== s.me), 'frana'); await press(page, s.humans.find((i) => i !== s.me)); await frames(page, 66);
    await shot(page, 1, 'frana-warning');
    await frames(page, 80);
    // to the rocks, as if arriving at them
    await act(page, (me) => { const g = window.__game, T = g.renderer.world.track, r = g.state.spills.find((x) => x.kind === 'frana'); if (r) g.teleport(me, r.i / T.n - 40 / T.length, -r.d * 0.3, { speed: 22, lap: 1 }); }, s.me);
    await frames(page, 34);
    await shot(page, 1, 'frana-rocks');
  }
  if (want('formaggio')) {
    const s = await stage(page, { u: U + 0.22 });
    await give(page, s.me, 'formaggio');
    await page.evaluate((me) => { const g = window.__game, drive = g.drive; g.setScript((i) => { const a = drive(i); a.item = false; if (i === me && window.__once !== 1) { window.__once = 1; a.item = true; a.throttle = 1; } return a; }); }, s.me);
    await frames(page, 22);
    await shot(page, 1, 'formaggio');
  }
  if (want('polenta')) {
    const s = await stage(page, { u: U + 0.25, helper: 30 });
    await give(page, s.helper, 'polenta'); await press(page, s.helper); await frames(page, 22);
    await shot(page, 1, 'polenta');
  }
  if (want('stork')) {
    const s = await stage(page, { u: U + 0.28 });
    await act(page, (me) => window.__game.rescue(me), s.me);
    await frames(page, 50);
    await shot(page, 1, 'stork');
  }
  await ctx.close();
}

async function two() {
  if (!want('2v')) return;
  const { ctx, page } = await open(2, 2);
  const s = await stage(page, { u: 0.2 });
  const [a, b] = await page.evaluate(() => window.__game.views);
  await act(page, ([x, y]) => { const g = window.__game, L = g.renderer.world.track.length; g.teleport(y, 0.2 + 26 / L, 3, { speed: 26 }); g.teleport(x, 0.2, -3, { speed: 28 }); }, [a, b]);
  await give(page, a, 'razzo'); await give(page, b, 'mici'); await press(page, a); await frames(page, 24);
  await shot(page, 2, 'razzo-mici');
  const s2 = await stage(page, { u: 0.25 });
  await give(page, a, 'uova'); await give(page, b, 'sambal'); await press(page, a); await press(page, b); await frames(page, 40);
  await shot(page, 2, 'uova-sambal');
  await ctx.close();
  return [s, s2];
}

async function four() {
  if (!want('4v')) return;
  const { ctx, page } = await open(4, 4);
  await stage(page, { u: 0.2 });
  const v = await page.evaluate(() => window.__game.views);
  await give(page, v[0], 'razzo'); await give(page, v[1], 'uova'); await give(page, v[2], 'mici'); await give(page, v[3], 'sambal');
  await act(page, (list) => { const g = window.__game, L = g.renderer.world.track.length; list.forEach((k, n) => g.teleport(k, 0.2 + (n * 12) / L, n % 2 ? 3.5 : -3.5, { speed: 27 })); }, v);
  await press(page, v[0]); await press(page, v[1]); await press(page, v[3]); await frames(page, 26);
  await shot(page, 4, 'items');
  await stage(page, { u: 0.42 });
  await give(page, v[0], 'durian'); await give(page, v[1], 'frana'); await give(page, v[2], 'rendang'); await give(page, v[3], 'polenta');
  await press(page, v[0]); await press(page, v[1]); await press(page, v[2]); await press(page, v[3]); await frames(page, 70);
  await shot(page, 4, 'items2');
  await ctx.close();
}

try {
  await single();
  await two();
  await four();
} finally {
  await browser.close();
  await srv.close();
  rmSync(dist, { recursive: true, force: true });
}
