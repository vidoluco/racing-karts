// The results and the podium with a phone lost: the rejoin QR card must never cover a step, a name, a table or a button, in any
// mode, with one to four phones, on the TV (1920x1080) and smaller screens. And a team podium says the step is the side's, with
// each driver's own points, best scorer first. The real screens and rules on a page of their own (test/helpers/results-fixture.mjs),
// no race and no server: a bounding box check in a headless browser.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, headlessShell } from '../tools/harness.mjs';
import { en, it as IT } from '../src/i18n/index.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const skip = !headlessShell() && 'no chromium';
const MODES = ['race', 'gp', 'time', 'teams', 'forma'];
const SIZES = [[1920, 1080], [1280, 720], [1280, 800]];
const area = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

let browser, code;
before(async () => {
  if (skip) return;
  const esbuild = createRequire(import.meta.url)('esbuild');
  const out = await esbuild.build({ absWorkingDir: ROOT, entryPoints: [join(ROOT, 'test/helpers/results-fixture.mjs')], bundle: true, format: 'esm', target: 'es2022', write: false, logLevel: 'warning' });
  code = out.outputFiles[0].text;
  browser = await launch('swiftshader');
});
after(async () => { await browser?.close(); });

async function page(w, h) {
  const p = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  // the boxes where things end up, not where an entrance animation has them for a moment
  await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%;overflow:hidden}
    *, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition: none !important; }</style></head><body></body></html>`);
  await p.addScriptTag({ type: 'module', content: code });
  await p.waitForFunction(() => !!window.__fx);
  return { p, errors };
}

test('the rejoin card, the ready bar and the offline pill cover no step, name, title, table or button on the results and the podium, every mode, 1 to 4 phones', { skip, timeout: 240000 }, async () => {
  const bad = [];
  let checked = 0;
  for (const [w, h] of SIZES) {
    const { p, errors } = await page(w, h);
    for (const lang of w === 1920 ? ['en', 'it'] : ['en']) {
      for (const mode of MODES) for (let phones = 1; phones <= 4; phones++) for (const screen of mode === 'time' ? ['results'] : ['results', 'podium']) {
        const shown = await p.evaluate((a) => window.__fx.show(a), { mode, phones, screen, lang });
        assert.equal(shown, mode === 'time' ? 'results' : screen);
        const b = await p.evaluate(() => window.__fx.boxes());
        assert.ok(b.card, `${w}x${h} ${mode} ${phones}p ${screen}: the rejoin card is up`);
        assert.ok(b.card.x >= 0 && b.card.y >= 0 && b.card.x + b.card.w <= b.view.w + 0.5 && b.card.y + b.card.h <= b.view.h + 0.5, `${w}x${h} ${mode} ${phones}p ${screen}: the card is on screen`);
        assert.ok(b.keep.some((k) => k.sel.includes(screen === 'podium' && mode !== 'time' ? '.stp' : '.tcard')), `${w}x${h} ${mode} ${phones}p ${screen}: the boxes were measured`);
        for (const k of b.keep) if (area(b.card, k) > 0) bad.push(`${w}x${h} ${lang} ${mode} ${phones}p ${screen}: covers ${k.sel} "${k.text}"`);
        // the bar of who pressed Continue and the pill of who is offline: on screen, and clear of everything, the card included
        for (const [name, o] of [['ready bar', b.ready], ['offline pill', b.off]]) {
          if (!o) { if (name === 'offline pill' || phones > 1) bad.push(`${w}x${h} ${lang} ${mode} ${phones}p ${screen}: no ${name}`); continue; } // one phone, and it is away: nobody to wait for
          if (!(o.x >= 0 && o.y >= 0 && o.x + o.w <= b.view.w + 0.5 && o.y + o.h <= b.view.h + 0.5)) bad.push(`${w}x${h} ${lang} ${mode} ${phones}p ${screen}: the ${name} is off screen`);
          for (const k of [...b.keep, { sel: 'the rejoin card', text: '', ...b.card }]) {
            if (k.x === o.x && k.y === o.y && k.w === o.w && k.h === o.h) continue; // itself
            if (area(o, k) > 0) bad.push(`${w}x${h} ${lang} ${mode} ${phones}p ${screen}: the ${name} covers ${k.sel} "${k.text}"`);
          }
        }
        checked++;
      }
    }
    assert.deepEqual(errors, []);
    await p.close();
  }
  assert.equal(checked, 36 * 4);
  assert.deepEqual(bad, []);
});

test('a team podium: the step is the side\'s ("1st team"), and each driver shows their own points, best scorer first', { skip, timeout: 60000 }, async () => {
  const { p, errors } = await page(1920, 1080);
  for (const [lang, D] of [['en', en], ['it', IT]]) {
    for (const phones of [1, 4]) {
      await p.evaluate((a) => window.__fx.show(a), { mode: 'teams', phones, screen: 'podium', lang });
      const steps = await p.evaluate(() => [...document.querySelectorAll('.podscr .steps.teams .stp')].map((s) => ({
        p: s.dataset.p, num: s.querySelector('.num').textContent, team: s.querySelector('.nameplate span').textContent,
        names: [...s.querySelectorAll('.tnames > span')].map((n) => ({ text: n.textContent, pts: n.querySelector('em')?.textContent })),
        karts: [...s.querySelectorAll('.kartc')].map((k) => k.dataset.kart),
      })));
      assert.deepEqual(steps.map((s) => s.p), ['1', '2']);
      assert.deepEqual(steps.map((s) => s.num), [D['pod.teamFirst'], D['pod.teamSecond']], 'no bare number two karts seem to share');
      for (const s of steps) {
        assert.equal(s.names.length, 2);
        const pts = s.names.map((n) => Number(n.pts.match(/\d+/)[0]));
        for (const n of s.names) assert.match(n.pts, new RegExp(`^\\d+ ${lang === 'it' ? 'punti' : 'points'}$`));
        assert.ok(pts[0] >= pts[1], `best scorer first: ${s.names.map((n) => n.text).join(', ')}`);
        assert.equal(pts[0] + pts[1], Number(s.team.match(/\d+/)[0]), 'the two add up to the side\'s points');
        assert.equal(s.karts.length, 2);
      }
    }
  }
  assert.ok(IT['pod.teamFirst'].includes('ª'), 'the Italian ordinal is feminine, as squadra is');
  assert.deepEqual(errors, []);
  await p.close();
});

test('on the lobby, the kart pick and the track vote the offline pills leave the titles free, with the sound sticker up or not', { skip, timeout: 120000 }, async () => {
  const bad = [];
  let checked = 0;
  for (const [w, h] of SIZES) {
    const { p, errors } = await page(w, h);
    for (const lang of ['en', 'it']) for (const screen of ['lobby', 'pick', 'vote']) for (const sticker of [false, true]) {
      const b = await p.evaluate((a) => window.__fx.menu(a), { screen, lang, sticker });
      const tag = `${w}x${h} ${lang} ${screen}${sticker ? ' sticker' : ''}`;
      assert.equal(b.current, screen);
      assert.ok(b.keep.some((k) => k.sel === (screen === 'lobby' ? '.logo' : '.tbar h1')), `${tag}: the title was measured`);
      assert.ok(b.off.w > 0 && b.off.x >= 0 && b.off.y >= 0 && b.off.x + b.off.w <= b.view.w + 0.5, `${tag}: the pills are on screen`);
      for (const k of b.keep) if (area(b.off, k) > 0) bad.push(`${tag}: covers ${k.sel} "${k.text}"`);
      checked++;
    }
    assert.deepEqual(errors, []);
    await p.close();
  }
  assert.equal(checked, 3 * 2 * 3 * 2);
  assert.deepEqual(bad, []);
});

test('the TV lobby\'s options fit their card: every label and chip whole, none past the edge or touching its label, five languages of commentary, en and it', { skip, timeout: 120000 }, async () => {
  const bad = [];
  let rows = 0;
  for (const [w, h] of SIZES) {
    const { p, errors } = await page(w, h);
    for (const lang of ['en', 'it']) {
      await p.evaluate((a) => window.__fx.menu(a), { screen: 'lobby', lang, sticker: false });
      const r = await p.evaluate(async () => {
        await document.fonts.ready;
        const card = document.querySelector('.scr:not(.hide) .opts'), cb = card.getBoundingClientRect(), pad = parseFloat(getComputedStyle(card).paddingRight);
        const issues = [], voice = card.querySelectorAll('.chips[data-key="voice"] .chip').length;
        const list = [...card.querySelectorAll('.optrow')];
        for (const row of list) {
          const lab = row.querySelector('label'), lr = lab.getBoundingClientRect();
          if (lab.scrollWidth > lab.clientWidth + 0.5) issues.push(`label "${lab.textContent}" cut`);
          for (const c of row.querySelectorAll('.chip, .stepper > button')) {
            const b = c.getBoundingClientRect();
            if (c.scrollWidth > c.clientWidth + 0.5) issues.push(`"${c.textContent}" cut`);
            if (b.right > cb.right - pad + 1) issues.push(`"${c.textContent}" past the card`);
            if (b.left < lr.left + lab.scrollWidth + 6) issues.push(`"${c.textContent}" touches "${lab.textContent}"`);
          }
        }
        return { issues, rows: list.length, voice };
      });
      assert.equal(r.voice, 5, 'off and four languages');
      rows += r.rows;
      for (const i of r.issues) bad.push(`${w}x${h} ${lang}: ${i}`);
    }
    assert.deepEqual(errors, []);
    await p.close();
  }
  assert.equal(rows, SIZES.length * 2 * 6);
  assert.deepEqual(bad, []);
});
