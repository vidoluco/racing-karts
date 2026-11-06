// The dictionaries: the same keys in both languages, real diacritics, no em dash anywhere, every key the code asks for exists.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { en, it, DICTS, LANGS, translator, ordinal, formatTime, formatGap, pickLang, detectLang, saveLang, LANG_KEY, pickLabel } from '../src/i18n/index.js';
import { KARTS } from '../src/data/karts.js';
import { TRACKS } from '../src/data/tracks.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EM = '\u2014';
const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const CODE = [...walk(join(ROOT, 'src/ui/screens')), ...walk(join(ROOT, 'src/i18n')), join(ROOT, 'src/ui/index.js'), join(ROOT, 'src/ui/style.js'), join(ROOT, 'src/main.js'), join(ROOT, 'src/game/flow.js')];

test('both languages have the same keys', () => {
  assert.deepEqual(Object.keys(it).sort(), Object.keys(en).sort());
});
test('no empty strings, and the same placeholders on both sides', () => {
  const vars = (s) => (s.match(/\{\w+\}/g) || []).sort();
  for (const k of Object.keys(en)) {
    assert.ok(en[k].trim() && it[k].trim(), k);
    assert.deepEqual(vars(it[k]), vars(en[k]), k);
  }
});
test('no em dash anywhere in the strings or in the code of the screens', () => {
  for (const d of [it, en]) for (const v of Object.values(d)) assert.ok(!v.includes(EM), v);
  for (const f of [...CODE, join(ROOT, 'README.md'), join(ROOT, 'docs/testing.md'), join(ROOT, 'index.template.html'), join(ROOT, 'build.mjs')]) assert.ok(!readFileSync(f, 'utf8').includes(EM), f);
});
test('Italian keeps its accents, Romanian its diacritics', () => {
  assert.match(it['lobby.difficulty'], /Difficoltà/);
  assert.match(it['stat.speed'], /Velocità/);
  assert.match(it['lobby.full'], /è/);
  assert.match(it['load.tip6'], /Țuică/);
  assert.match(en['load.tip6'], /Țuică/);
  assert.ok(!/ e' |a' |perche'/.test(Object.values(it).join(' ')), 'no apostrophes standing in for accents');
  assert.ok(TRACKS.some((t) => t.names.it.includes('Transfăgărășan')));
  assert.ok(KARTS.some((k) => k.name === 'Mocănița'));
  assert.ok(KARTS.some((k) => k.name === 'Căruța'));
});
test('every key the code asks for exists', () => {
  const missing = new Set();
  for (const f of CODE) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/\bt\('([a-z]+\.[A-Za-z0-9]+)'/g)) if (!(m[1] in en)) missing.add(`${m[1]} (${f})`);
    for (const m of src.matchAll(/ui\.(?:t|error)\('([a-z]+\.[A-Za-z0-9]+)'/g)) if (!(m[1] in en)) missing.add(`${m[1]} (${f})`);
  }
  assert.deepEqual([...missing], []);
  // the families built at runtime
  for (const k of ['speed', 'accel', 'handling', 'weight', 'offroad']) assert.ok(`stat.${k}` in en, k);
  for (const k of ['easy', 'medium', 'hard']) assert.ok(`lobby.${k}` in en, k);
  for (const k of ['cows', 'sheep', 'bear', 'sledders', 'ice', 'bats', 'steam', 'ponies', 'macaques']) assert.ok(`near.${k}` in en, k);
  for (const k of ['cadore', 'romania', 'indonesia']) assert.ok(`region.${k}` in en, k);
  for (let i = 1; i <= 6; i++) assert.ok(`load.tip${i}` in en);
});
test('translator fills in values and falls back', () => {
  const t = translator('it');
  assert.equal(t('lobby.seat', { n: 3 }), 'Giocatore 3');
  assert.equal(translator('xx')('lobby.seat', { n: 1 }), 'Player 1');
  assert.equal(t('no.such.key'), 'no.such.key');
  assert.equal(t('lobby.seat'), 'Giocatore {n}');
});
test('ordinals', () => {
  assert.deepEqual(ordinal('it', 3), ['3', '°']);
  assert.deepEqual([1, 2, 3, 4, 8].map((n) => ordinal('en', n)[1]), ['st', 'nd', 'rd', 'th', 'th']);
});
test('times by language', () => {
  assert.equal(formatTime('en', 62.5), '1:02.50');
  assert.equal(formatTime('it', 62.5), '1:02,50');
  assert.equal(formatTime('it', -1), '');
  assert.equal(formatTime('it', NaN), '');
  assert.equal(formatGap('en', 4.25), '+4.25');
  assert.equal(formatGap('it', 64.25), '+1:04,25');
});
test('language choice: stored, then browser, then English', () => {
  assert.equal(pickLang('en', 'it-IT'), 'en');
  assert.equal(pickLang(null, 'it-IT'), 'it');
  assert.equal(pickLang(null, 'ro-RO'), 'en');
  const box = new Map();
  const storage = { getItem: (k) => box.get(k) ?? null, setItem: (k, v) => box.set(k, v) };
  assert.equal(detectLang(storage, { language: 'de' }), 'en');
  saveLang('it', storage);
  assert.equal(box.get(LANG_KEY), 'it');
  assert.equal(detectLang(storage, { language: 'de' }), 'it');
  assert.equal(detectLang({ getItem() { throw new Error('blocked'); } }, { language: 'it' }), 'it');
});
test('labels of the data files', () => {
  assert.equal(pickLabel('it', { it: 'a', en: 'b' }), 'a');
  assert.equal(pickLabel('en', 'plain'), 'plain');
  assert.equal(pickLabel('it', null), '');
  assert.deepEqual(LANGS, Object.keys(DICTS));
});
