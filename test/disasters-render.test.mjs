// Each natural disaster on the real game page: it draws without an error and inside the frame budget, the HUD names it in big
// type with the right way to go, and the sound of its kind really is fired. Whether it looks and sounds good is not for a test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { launch, startServerProcess, ROOT } from '../tools/harness.mjs';
import { SFX, DISASTER_SOUND } from '../src/audio/sfx.js';
import { DISASTER_KINDS } from '../src/sim/disasters.js';
import { rng32, hash } from '../src/audio/dsp.js';

const seconds = (name) => SFX[name](48000, rng32(hash(name)))[0].length / 48000;

test('each kind draws, is named on the HUD and is heard', { timeout: 600000 }, async () => {
  const dist = mkdtempSync(join(tmpdir(), 'rk-dis-t-'));
  execFileSync(process.execPath, ['build.mjs'], { cwd: ROOT, env: { ...process.env, DIST: dist }, stdio: 'ignore' });
  const srv = await startServerProcess({ dist });
  const browser = await launch('metal');
  try {
    for (const kind of Object.keys(DISASTER_KINDS)) {
      const name = `Prova ${kind}`, def = { kind, u: 0.742, name, say: { it: 'Occhio!', en: 'Look out!' } };
      if (DISASTER_KINDS[kind].free) def.bearing = 270; else def.side = -1;
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, locale: 'it-IT' });
      const page = await ctx.newPage(), errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text()); });
      const q = new URLSearchParams({ track: 'antelao', views: 1, players: 1, bots: 7, difficulty: 'hard', manual: 1, quality: 'capture', seed: 11, countdown: 0, laps: 3, disasters: JSON.stringify([def]) });
      await page.goto(`${srv.base}/?${q}`);
      await page.waitForFunction(() => window.__game?.ready || window.__game?.error, null, { timeout: 180000 });
      assert.equal(await page.evaluate(() => window.__game.error ?? null), null);
      const got = await page.evaluate((warn) => {
        const g = window.__game, T = g.renderer.world.track, L = T.length;
        g.audio.unlock();
        const heard = [], real = AudioBufferSourceNode.prototype.start;
        AudioBufferSourceNode.prototype.start = function (...a) { heard.push(+this.buffer.duration.toFixed(2)); return real.apply(this, a); };
        g.setScript((i) => { const a = g.drive(i); a.item = false; return a; });
        g.teleport(g.views[0], 0.742 - 26 * (warn + 1.8) / L, 0, { speed: 26 });
        g.disaster(0);
        g.advance(30);
        g.draw();
        const banner = document.querySelector('.dis b')?.textContent ?? null, arrow = !!document.querySelector('.dis .arrow');
        g.advance(Math.round((warn + 0.8) * 60) - 30);
        g.draw();
        const s = g.renderer.stats();
        AudioBufferSourceNode.prototype.start = real;
        return { banner, arrow, heard, phase: g.state.disasters?.[0]?.phase, calls: s.perView, tris: s.trianglesPerView };
      }, DISASTER_KINDS[kind].warn);
      assert.deepEqual(errors, [], kind);
      assert.equal(got.banner, name, `${kind}: banner`);
      assert.equal(got.arrow, !DISASTER_KINDS[kind].free, `${kind}: the arrow to the free lane`);
      assert.equal(got.phase, 'strike', `${kind}: phase`);
      assert.ok(got.calls <= 150, `${kind}: ${got.calls} draw calls`);
      assert.ok(got.tris <= 500000, `${kind}: ${got.tris} triangles`);
      const want = [seconds('disasterAlarm'), seconds('disasterRumble'), seconds(DISASTER_SOUND[kind])];
      for (const w of want) assert.ok(got.heard.some((h) => Math.abs(h - w) < 0.02), `${kind}: nothing of ${w} s among ${got.heard}`);
      await ctx.close();
    }
  } finally {
    await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 3000))]);
    srv.close?.();
  }
});
