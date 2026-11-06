// La telecronaca: the lines, the director's manners over real races on real roads, the packs, the option through flow and room. Then the
// real path: a phone and the TV from the lobby to the results with the voices playing and the music ducked, the switch off, and a normal
// race on a fresh page that never asks for a byte of it.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildTrack } from '../src/world/track.js';
import { buildTerrain } from '../src/world/terrain.js';
import { createRace, DT } from '../src/sim/index.js';
import { loadTrackDef, TRACK_IDS } from '../src/data/tracks.js';
import { ROSTER } from '../src/data/karts.js';
import { POOLS, VOICE_LANGS, DRIVERS, COMMENTARY_TRACKS, clipsFor, BOOTH } from '../src/data/commentary.js';
import { createCommentary, PRI, TALK_MINOR, TALK_WINDOW } from '../src/game/commentary.js';
import { createFlow } from '../src/game/flow.js';
import { sanitizeOpt } from '../server/room.js';
import { it as IT, en as EN } from '../src/i18n/index.js';
import { launch, headlessShell, buildDist, startServerProcess, openPad, ROOT } from '../tools/harness.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const KARTS = ['tabia', 'gatto', 'seggiovia', 'mocanita', 'caruta', 'logan', 'jeep', 'becak'];
const worlds = new Map();
async function world(id) {
  if (!worlds.has(id)) { const track = buildTrack(await loadTrackDef(id)); worlds.set(id, { track, terrain: buildTerrain(track) }); }
  return worlds.get(id);
}
const raceOn = async (id, { seed = 7, humans = 1, laps = 3 } = {}) => {
  const { track, terrain } = await world(id);
  return createRace({ track, terrain, seed, laps: track.long ? 1 : laps, difficulty: 'medium', countdown: 3,
    players: KARTS.map((kart, i) => ({ slot: i < humans ? i : -1, kart, human: i < humans, name: kart, difficulty: i < humans ? 'ace' : undefined })) });
};
const pack = (lang) => {
  const p = join(ROOT, 'assets/voice', `${lang}.json`);
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null;
};
const durationsOf = (lang) => { const p = pack(lang); return p ? (id) => p.clips[id]?.[2] ?? null : null; };

// A whole race with a commentator listening, and what was said, in sim time as a player would hear it.
async function commentated(id, lang, { seed = 7, humans = 1, laps = 3, duration = durationsOf(lang) } = {}) {
  const race = await raceOn(id, { seed, humans, laps });
  const C = createCommentary({ lang, seed, duration });
  C.begin({ track: id, views: Array.from({ length: humans }, (_, i) => i), karts: KARTS });
  const said = [];
  let guard = 0;
  while (race.state.phase !== 'done' && guard++ < 60 * 60 * 15) {
    const inputs = [];
    for (let i = 0; i < humans; i++) inputs[i] = race.autopilot(i);
    race.step(inputs);
    const ev = race.drainEvents();
    C.events(ev, race.state);
    const cue = C.next(race.state.t, false);
    if (cue) said.push({ t: race.state.t, ...cue });
  }
  return { said, t: race.state.t, stats: C.stats, race };
}

describe('the lines', () => {
  test('every pool has the same lines in the three languages, and every track its own', () => {
    for (const [id, P] of Object.entries(POOLS)) {
      const n = P.it.length;
      assert.ok(n >= 1, id);
      for (const l of VOICE_LANGS) {
        assert.equal(P[l].length, n, `${id} ${l}`);
        assert.equal(new Set(P[l]).size, n, `${id} ${l}: two lines the same`);
        if (P.who) for (const s of P[l]) assert.ok(s.includes('{who}'), `${id}: ${s}`);
      }
    }
    assert.deepEqual([...COMMENTARY_TRACKS].sort(), [...TRACK_IDS].filter((t) => COMMENTARY_TRACKS.includes(t)).sort());
    for (const t of TRACK_IDS) { assert.ok(POOLS[`intro.${t}`], `no intro for ${t}`); assert.ok(POOLS[`col.${t}`], `no colour for ${t}`); }
    for (const k of ROSTER) assert.ok(DRIVERS[k.id] === k.driver?.name, `driver of ${k.id}`);
  });

  test('the words: no em dash, Romanian with the right marks, nothing about deaths, victims, religion or real people', () => {
    const all = VOICE_LANGS.flatMap((l) => clipsFor(l).map((c) => [l, c.text]));
    const banned = /\bmort[io]\b|vittim|cadaver|strage|tragedi|preghi|\bdio\b|madonna|gesù|\bmorți|victim|moarte|dumnezeu|\bmati\b|korban|tewas|\btuhan\b|—|allah|dracula|\bvlad\b/i;
    for (const [l, s] of all) {
      assert.doesNotMatch(s, banned, `${l}: ${s}`);
      assert.doesNotMatch(s, /[şţŞŢ]/, `cedilla instead of comma below: ${s}`);
      assert.ok(s.length < 110, `too long to say in a race: ${s}`);
    }
    // the words that must carry their accents
    const it = clipsFor('it').map((c) => c.text).join(' ');
    assert.match(it, /già/); assert.match(it, /più/); assert.match(it, /Transfăgărășan/); assert.match(it, /Bâlea/);
    const ro = clipsFor('ro').map((c) => c.text).join(' ');
    assert.match(ro, /mămăligă/); assert.match(ro, /țuică/); assert.match(ro, /Transfăgărășan/);
    // Fifi is spoken of as anyone, and never in a line of her own
    for (const l of VOICE_LANGS) for (const [id, P] of Object.entries(POOLS)) if (!P.who) for (const s of P[l]) assert.doesNotMatch(s, /Fifi/, `${id}`);
  });

  test('both commentators work: a man and a woman in every language, Alina and Emil in Romanian', () => {
    assert.deepEqual(BOOTH.ro, { a: 'ro-RO-EmilNeural', b: 'ro-RO-AlinaNeural' });
    for (const l of VOICE_LANGS) {
      const voices = new Set(clipsFor(l).map((c) => c.name));
      assert.equal(voices.size, 2, l);
      const ids = clipsFor(l).map((c) => c.id);
      assert.equal(new Set(ids).size, ids.length, `${l} clip ids clash`);
    }
  });

  test('the packs, where they exist, match the lines: a changed line is a stale pack', { skip: !existsSync(join(ROOT, 'assets/voice/it.json')) && 'no packs on this checkout' }, () => {
    for (const l of VOICE_LANGS) {
      const p = pack(l);
      assert.ok(p, l);
      const clips = clipsFor(l);
      assert.equal(Object.keys(p.clips).length, clips.length, l);
      let end = 0;
      for (const c of clips) {
        const at = p.clips[c.id];
        assert.ok(at, `${l} ${c.id}`);
        assert.ok(at[2] > 0.15 && at[2] < 7, `${l} ${c.id} lasts ${at[2]}`);
        end = Math.max(end, at[0] + at[1]);
      }
      const bin = readFileSync(join(ROOT, 'assets/voice', `${l}.bin`));
      assert.equal(bin.length, end, `${l} pack size`);
      assert.ok(bin.length < 5.5e6, `${l} is ${bin.length} bytes`);
    }
  });
});

describe('the director', () => {
  test('it changes nothing in the sim: the same seed steps byte for byte with a commentator listening', async () => {
    const run = async (listen) => {
      const race = await raceOn('antelao', { seed: 11, laps: 2 });
      const C = listen ? createCommentary({ lang: 'it', seed: 3 }) : null;
      C?.begin({ track: 'antelao', views: [0], karts: KARTS });
      for (let f = 0; f < 60 * 50; f++) {
        race.step([race.autopilot(0)]);
        const ev = race.drainEvents();
        if (C) { C.events(ev, race.state); C.next(race.state.t, false); }
      }
      return JSON.stringify(race.state);
    };
    assert.equal(await run(true), await run(false));
  });

  for (const id of ['antelao', 'transfagarasan', 'bromo', 'jakarta']) {
    test(`a real race on ${id}: it talks, leaves room, says the big things, no line twice before the others, never over itself`, { timeout: 300000 }, async () => {
      const { said, t, stats } = await commentated(id, 'ro');
      assert.ok(said.length >= Math.min(10, t / 12), `${said.length} lines in ${t.toFixed(0)} s`);
      assert.ok(stats.seconds / t < 0.55, `talking ${(100 * stats.seconds / t).toFixed(0)}% of the race`);
      assert.ok(said.some((c) => c.pool === 'start'), 'the start');
      assert.ok(said.some((c) => c.pool === 'win'), 'the winner');
      // nobody talks over anybody, unless something big cut in on something small
      for (let i = 1; i < said.length; i++) {
        const a = said[i - 1], b = said[i];
        if (b.t < a.t + a.dur) { assert.ok(b.cut && b.pri >= PRI.major && a.pri <= PRI.minor, `${b.pool} over ${a.pool} at ${b.t.toFixed(1)}`); }
      }
      // a line comes back only when its whole pool has been heard
      const byPool = new Map();
      for (const c of said) {
        const first = c.parts.find((p) => !p.id.startsWith('who.') && !p.id.startsWith('reply.'));
        const line = first.id.split('.').slice(0, first.id.startsWith(c.pool) ? c.pool.split('.').length + 1 : 2).join('.');
        const seen = byPool.get(c.pool) ?? new Set();
        const size = POOLS[c.pool].it.length;
        assert.ok(!seen.has(line) || seen.size >= size, `${line} again after ${seen.size} of ${size}`);
        if (seen.size >= size) seen.clear();
        seen.add(line);
        byPool.set(c.pool, seen);
      }
      // the talk budget: in any minute, what is minor stops being said once a lot has been said
      for (const c of said) {
        if (c.pri > PRI.minor) continue;
        const before = said.filter((x) => x !== c && x.t < c.t && x.t > c.t - TALK_WINDOW).reduce((s, x) => s + x.dur, 0);
        assert.ok(before <= TALK_MINOR + 0.01, `${c.pool} at ${c.t.toFixed(0)}: ${before.toFixed(1)} s already`);
      }
    });
  }

  test('variety: over a whole evening of races the same words do not keep coming back', { timeout: 600000 }, async () => {
    // the same head through five races, as on one evening: it remembers what it said
    const C = createCommentary({ lang: 'it', seed: 5, duration: durationsOf('it') });
    const lines = [];
    for (const [n, id] of ['antelao', 'pelmo', 'bran', 'bromo', 'bali'].entries()) {
      const race = await raceOn(id, { seed: 20 + n, laps: 3 });
      C.begin({ track: id, views: [0], karts: KARTS });
      let guard = 0;
      while (race.state.phase !== 'done' && guard++ < 60 * 60 * 12) {
        race.step([race.autopilot(0)]);
        C.events(race.drainEvents(), race.state);
        const cue = C.next(race.state.t, false);
        if (cue) lines.push(cue.parts[cue.parts.length > 1 && cue.parts[0].id.startsWith('who.') ? 1 : 0].text);
      }
    }
    const count = new Map();
    for (const l of lines) count.set(l, (count.get(l) ?? 0) + 1);
    const worst = Math.max(...count.values());
    const distinct = count.size;
    console.log(`  ${lines.length} lines, ${distinct} different, the most repeated ${worst} times`);
    assert.ok(lines.length > 60, `${lines.length} lines`);
    assert.ok(distinct / lines.length > 0.6, `${distinct} of ${lines.length} different`);
    assert.ok(worst <= 3, `one line ${worst} times`);
  });

  test('a disaster\'s warning is said at once, even cutting off small talk; a stale joke is dropped, not said late', () => {
    const C = createCommentary({ lang: 'it', seed: 1 });
    C.begin({ track: 'antelao', views: [0], karts: KARTS });
    const state = { t: 30, karts: KARTS.map((kart, i) => ({ i, kart, place: i + 1, human: !i })) };
    // something small is being said
    C.events([{ type: 'wall', kart: 0, force: 9 }], state);
    const small = C.next(30);
    assert.equal(small.pool, 'wall');
    state.t = 30.2;
    C.events([{ type: 'disaster', phase: 'warn', kind: 'debris' }], state);
    const big = C.next(30.2);
    assert.equal(big.pool, 'dis.debris');
    assert.equal(big.cut, true);
    // a joke that waited too long
    const C2 = createCommentary({ lang: 'it', seed: 1 });
    C2.begin({ track: 'antelao', views: [0], karts: KARTS });
    state.t = 40;
    C2.events([{ type: 'finish', kart: 3, place: 1 }], state);
    assert.equal(C2.next(40).pool, 'win');
    C2.events([{ type: 'driftEnd', kart: 0, tier: 3 }], state);
    assert.equal(C2.next(40.1, true), null, 'still talking');
    assert.notEqual(C2.next(70)?.pool, 'drift', 'too late for that');
    assert.ok(C2.stats.dropped >= 1);
  });

  test('two bots at the back are nobody\'s news; your own kart, the leader and a change at the front are', () => {
    const state = { t: 60, karts: KARTS.map((kart, i) => ({ i, kart, place: i + 1, human: !i })) };
    const say = (ev) => {
      const C = createCommentary({ lang: 'ro', seed: 9 });
      C.begin({ track: 'bran', views: [0], karts: KARTS });
      C.events([ev], state);
      const pool = C.next(60)?.pool ?? null;
      return pool === 'idle' || pool?.startsWith('col.') ? null : pool; // a long silence gets filled anyway
    };
    assert.equal(say({ type: 'hit', kart: 6, by: 5, kind: 'spin', cause: 'razzo' }), null);
    assert.ok(say({ type: 'hit', kart: 0, by: 5, kind: 'spin', cause: 'razzo' }));
    assert.ok(['hitLeader', 'razzo'].includes(say({ type: 'hit', kart: 0, by: 5, kind: 'spin', cause: 'razzo' })));
    assert.equal(say({ type: 'overtake', kart: 5, place: 1 }), 'lead');
    assert.equal(say({ type: 'overtake', kart: 5, place: 4 }), null);
  });

  test('Fifi\'s name is never said on a mishap; everyone else\'s can be', () => {
    const names = (kart) => {
      const karts = [kart, ...KARTS.slice(1)];
      const out = [];
      for (let s = 0; s < 80; s++) {
        const C = createCommentary({ lang: 'it', seed: s });
        C.begin({ track: 'bran', views: [0, 1], karts });
        C.events([{ type: 'hit', kart: 0, by: -1, kind: 'spin', cause: 'polenta' }], { t: 60, karts: karts.map((k, i) => ({ i, kart: k, place: i + 1 })) });
        const cue = C.next(60);
        if (cue) out.push(cue.parts[0].id);
      }
      return out.filter((id) => id.startsWith('who.')).length;
    };
    assert.equal(names('fifi'), 0);
    assert.ok(names('tabia') > 0);
  });
});

describe('words that are true for the race being run', () => {
  const pools = (mode, events, { karts = KARTS, laps = 3 } = {}) => {
    const C = createCommentary({ lang: 'it', seed: 2 });
    C.begin({ track: 'bran', views: [0], karts, mode });
    const out = [];
    let t = 40;
    for (const e of events) {
      C.events([e], { t, laps, phase: 'race', karts: karts.map((kart, i) => ({ i, kart, place: i + 1 })) });
      const cue = C.next(t);
      out.push(cue?.pool ?? null);
      t += 30;
    }
    return out;
  };
  test('a race: go, last lap, win', () => {
    assert.deepEqual(pools('race', [{ type: 'go' }, { type: 'lastLap', kart: 0 }, { type: 'finish', kart: 0, place: 1 }]), ['start', 'lastLap', 'win']);
  });
  test('a long road races one lap: the event is its last kilometre, never a last lap', () => {
    assert.deepEqual(pools('race', [{ type: 'lastLap', kart: 0 }], { laps: 1 }), ['lastKm']);
    for (const l of VOICE_LANGS) for (const s of POOLS.lastKm[l]) assert.doesNotMatch(s, /giro|tur\b|putaran/i);
  });
  test('alone against the ghost nobody wins and nobody is told to throw anything', () => {
    assert.deepEqual(pools('time', [{ type: 'go' }, { type: 'lastLap', kart: 0 }]), ['ttStart', 'ttLast']);
    const [none] = pools('time', [{ type: 'finish', kart: 0, place: 1 }]);
    assert.ok(none !== 'win', `said ${none}`);
    assert.deepEqual(pools('time', [{ type: 'ttFinish', kart: 0, record: true, delta: -1.2 }]), ['ttRecord']);
    assert.deepEqual(pools('time', [{ type: 'ttFinish', kart: 0, record: true, delta: null }]), ['ttDone'], 'the first run beats nothing');
    assert.deepEqual(pools('time', [{ type: 'ttFinish', kart: 0, record: false, delta: 2 }]), ['ttDone']);
  });
  test('a verdict still waiting when the results come up is said instead of the goodbye; otherwise the goodbye', () => {
    const state = { t: 90, laps: 2, phase: 'done', karts: [{ i: 0, kart: 'tabia', place: 1 }] };
    const C = createCommentary({ lang: 'it', seed: 3 });
    C.begin({ track: 'bran', views: [0], karts: ['tabia'], mode: 'time' });
    C.events([{ type: 'ttFinish', kart: 0, record: false, delta: 3 }], state);
    assert.equal(C.closing().pool, 'ttDone');
    assert.equal(C.closing().pool, 'results', 'and only once');
  });
  test('the hunt for the cheese has its own start and its own end', () => {
    assert.deepEqual(pools('forma', [{ type: 'go' }, { type: 'formaEnd', winner: 2 }]), ['formaStart', 'formaWin']);
  });
  test('small talk alone on the road is about being alone', () => {
    const C = createCommentary({ lang: 'it', seed: 4 });
    C.begin({ track: 'nowhere', views: [0], karts: ['tabia'], mode: 'time' });
    const cue = C.next(60);
    assert.equal(cue.pool, 'ttIdle');
  });
  test('no line counts the field, none makes a driver a he: a grid can be any size, and Oița and Fifi race too', () => {
    for (const s of POOLS.start.it) assert.doesNotMatch(s, /\botto\b/i);
    for (const s of POOLS.start.ro) assert.doesNotMatch(s, /\bopt\b/i);
    for (const s of POOLS.start.id) assert.doesNotMatch(s, /delapan/i);
    for (const [id, P] of Object.entries(POOLS)) if (P.who) {
      for (const s of P.it) assert.doesNotMatch(s, /\b(per primo|primo|lui)\b/, `${id}: ${s}`);
      for (const s of P.ro) assert.doesNotMatch(s, /\b(primul(?! loc)|el)\b/, `${id}: ${s}`);
    }
  });
  test('every kind of disaster and hazard on any track has words, and a warning stays a warning: no joke in it', async () => {
    const { DISASTER_KINDS } = await import('../src/sim/disasters.js');
    for (const k of Object.keys(DISASTER_KINDS)) assert.ok(POOLS[`dis.${k}`]?.it.length >= 2, `no words for ${k}`);
    for (const id of TRACK_IDS) {
      const def = await loadTrackDef(id);
      for (const h of def.hazards ?? []) assert.ok(POOLS[`haz.${h.kind}`], `${id}: no words for ${h.kind}`);
      for (const d of def.disasters ?? []) assert.ok(POOLS[`dis.${d.kind}`], `${id}: no words for ${d.kind}`);
    }
  });
  test('a change at the front waits out what is being said, and two karts swapping every corner do not get a line each', () => {
    const state = (t) => ({ t, laps: 3, phase: 'race', karts: KARTS.map((kart, i) => ({ i, kart, place: i + 1 })) });
    const C = createCommentary({ lang: 'it', seed: 1 });
    C.begin({ track: 'bran', views: [0], karts: KARTS });
    C.events([{ type: 'disaster', phase: 'warn', kind: 'quake' }], state(50));
    const warn = C.next(50);
    assert.equal(warn.pool, 'dis.quake');
    C.events([{ type: 'overtake', kart: 4, place: 1 }], state(50.1));
    assert.equal(C.next(50.1, true), null, 'not over a warning');
    assert.equal(C.next(50 + warn.dur + 0.6)?.pool, 'lead', 'said once the warning is over');
    const at = 50 + warn.dur + 1;
    C.events([{ type: 'overtake', kart: 5, place: 1 }], state(at + 3));
    assert.equal(C.next(at + 3, true), null);
    assert.notEqual(C.next(at + 5)?.pool, 'lead', 'too soon after the last one');
  });
});

describe('the option', () => {
  test('flow and room: off by default with no key at all, a language when chosen, off again, nonsense ignored', () => {
    const f = createFlow({ karts: KARTS, tracks: ['antelao'] });
    assert.equal('voice' in f.opts, false);
    assert.equal(f.setOpts({ voice: 'klingon' }), false);
    assert.equal(f.setOpts({ voice: 'ro' }), true);
    assert.equal(f.opts.voice, 'ro');
    assert.equal(f.menuFor(0).opts.voice, 'ro');
    assert.equal(f.setOpts({ voice: 'off' }), true);
    assert.equal('voice' in f.opts, false);
    assert.deepEqual(sanitizeOpt({ t: 'opt', voice: 'id' }), { voice: 'id' });
    assert.equal(sanitizeOpt({ t: 'opt', voice: 'x' }), null);
  });
  test('words in both languages of the screens', () => {
    for (const k of ['lobby.voice', 'lobby.voiceOff']) { assert.ok(IT[k], k); assert.ok(EN[k], k); }
  });
});

// ---------- the real path ----------
const hasBrowser = !!headlessShell();
const hasPacks = existsSync(join(ROOT, 'assets/voice/ro.json')) && existsSync(join(ROOT, 'assets/voice/it.json')) && existsSync(join(ROOT, 'assets/voice/id.json'));

test('by phone and TV, from the lobby to the results: voices, captions, ducking; the switch off; and a fresh normal race with none of it', { skip: (!hasBrowser && 'no browser') || (!hasPacks && 'no packs'), timeout: 600000 }, async (t) => {
  const dist = mkdtempSync(join(tmpdir(), 'rk-voice-'));
  t.after(() => rmSync(dist, { recursive: true, force: true }));
  await buildDist(dist);
  const srv = await startServerProcess({ dist });
  t.after(() => srv.close());
  const browser = await launch('metal', { extra: ['--autoplay-policy=no-user-gesture-required'] });
  t.after(() => browser.close());
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'it-IT' });
  const tv = await ctx.newPage();
  const errors = [], asked = [];
  tv.on('pageerror', (e) => errors.push(e.message));
  tv.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  tv.on('request', (r) => { if (r.url().includes('/assets/voice/')) asked.push(r.url().split('/assets/voice/')[1]); });
  await tv.goto(`${srv.base}/?lang=it&quality=low`);
  await tv.waitForFunction(() => window.__game?.ready || window.__game?.error, null, { timeout: 120000 });
  await tv.mouse.click(640, 30); // the gesture the page asks for
  assert.deepEqual(asked, [], 'off: nothing asked for');

  const phone = await openPad(browser, srv.base, { label: 'voice', locale: 'it-IT' });
  t.after(() => phone.ctx.close().catch(() => {}));
  const tap = (sel) => phone.page.locator(sel).tap();
  const padIs = (ph) => phone.page.waitForFunction((q) => window.__pad.phase === q, ph, { timeout: 30000 });
  const tvIs = (ph) => tv.waitForFunction((q) => window.__game.phase === q, ph, { timeout: 120000 });
  const toRace = async () => {
    await tap('#goBtn');
    await tvIs('pick');
    await padIs('pick');
    await sleep(350);
    await tap('#readyBtn');
    await tvIs('vote');
    await padIs('vote');
    await sleep(350);
    await phone.page.evaluate(() => window.__pad.carousel.show?.('antelao'));
    await sleep(150);
    await tap('#voteBtn');
    await tvIs('race');
    await tv.waitForFunction(() => window.__game.state, null, { timeout: 120000 });
  };

  // the phone's row: off is lit, Romanian is a tap away, and the TV agrees
  await phone.page.waitForFunction(() => window.__pad.phase === 'lobby', null, { timeout: 15000 });
  const seg = '.seg[data-key="voice"]';
  assert.equal(await phone.page.locator(`${seg} button.on`).getAttribute('data-v'), 'off');
  await tap(`${seg} button[data-v="ro"]`);
  await tv.waitForFunction(() => window.__game.voice.lang === 'ro' && window.__game.voice.packReady, null, { timeout: 20000 });
  assert.ok(asked.includes('ro.bin') && asked.includes('ro.json'), asked.join());
  assert.ok(!asked.some((a) => a.startsWith('it.') || a.startsWith('id.')), 'only the chosen language');
  assert.equal(await tv.locator('.lobby .chips[data-key="voice"] .chip.on').getAttribute('data-v'), 'ro');
  await tv.waitForFunction(() => window.__game.voice.log.some((l) => l.pool === 'preview'), null, { timeout: 8000 });

  // lobby, kart, track, race
  await toRace();

  // the intro speaks over the drone, with its caption
  await tv.waitForFunction(() => window.__game.voice.log.some((l) => l.pool === 'intro.antelao'), null, { timeout: 20000 });
  await tv.waitForFunction(() => document.querySelector('.vcap.on span')?.textContent.length > 5, null, { timeout: 6000 });
  const sample = async () => tv.evaluate(() => { const a = window.__game.voice.audio; return { duck: a.duck, level: a.level, speaking: a.speaking }; });
  await tv.waitForFunction(() => window.__game.voice.audio.speaking && window.__game.voice.audio.level > 0.02, null, { timeout: 8000 });
  const talking = await sample();
  assert.ok(talking.duck < 0.5, `the music held down while they talk: ${talking.duck}`);

  await tv.evaluate(() => { const g = window.__game; g.setScript((i) => g.drive(i)); });
  await tv.waitForFunction(() => window.__game.state?.phase === 'race' && window.__game.state.t > 4, null, { timeout: 60000 });
  await tv.waitForFunction(() => window.__game.voice.log.some((l) => l.pool === 'start'), null, { timeout: 8000 });
  // when they stop the music comes back up
  await tv.waitForFunction(() => !window.__game.voice.audio.speaking, null, { timeout: 12000 });
  await tv.waitForFunction(() => !window.__game.voice.audio.speaking && window.__game.voice.audio.duck > 0.8, null, { timeout: 15000, polling: 100 });

  // a disaster on the real page: the warning is said
  const before = await tv.evaluate(() => window.__game.voice.log.length);
  await tv.evaluate(() => window.__game.disaster(0));
  await tv.waitForFunction((n) => window.__game.voice.log.slice(n).some((l) => l.pool.startsWith('dis.')), before, { timeout: 8000 });
  // a change at the front: the name of who did it, once the warning has been said
  await tv.waitForFunction(() => !window.__game.voice.audio.speaking, null, { timeout: 12000 });
  await tv.evaluate(() => { const g = window.__game, K = g.state.karts, back = K.find((k) => k.place === K.length); g.teleport(back.i, (K.find((k) => k.place === 1).u + 0.02) % 1, 0, { speed: 26, lap: K.find((k) => k.place === 1).lap }); });
  await tv.waitForFunction(() => window.__game.voice.log.some((l) => l.pool === 'lead' || l.pool === 'chaos'), null, { timeout: 20000 });

  // on to the end, fast: winner, closing words, and it stays quiet after
  await tv.evaluate(() => { window.__game.speed = 10; });
  await tv.waitForFunction(() => window.__game.phase === 'results', null, { timeout: 240000 });
  const log = await tv.evaluate(() => window.__game.voice.log);
  // the goodbye, or the verdict that was still waiting when the results came up
  assert.ok(/^(results|win|finish)/.test(log[log.length - 1].pool), `closed on ${log[log.length - 1].pool}`);
  assert.ok(log.every((l) => !/[şţ]/.test(l.text)));
  assert.ok(new Set(log.map((l) => l.text)).size >= log.length * 0.6, 'variety on a real page');
  const played = await tv.evaluate(() => window.__game.voice.audio.played);
  assert.ok(played >= 5, `${played} clips really played`);
  await tv.waitForFunction(() => !window.__game.voice.audio.speaking, null, { timeout: 12000 });
  assert.equal(await tv.evaluate(() => document.querySelector('.vcap.on')), null, 'no caption on the results');

  // off from the options: on the same page, the next race says nothing. The TV's own chips work as the phone's row
  await tv.evaluate(() => window.__game.next('lobby'));
  await padIs('lobby');
  await tv.locator('.lobby .chips[data-key="voice"] .chip[data-v="it"]').click();
  await tv.waitForFunction(() => window.__game.voice.lang === 'it', null, { timeout: 8000 });
  await phone.page.waitForFunction((s) => document.querySelector(`${s} button.on`)?.dataset.v === 'it', seg, { timeout: 8000 });
  await tap(`${seg} button[data-v="off"]`);
  await tv.waitForFunction(() => window.__game.voice.lang === 'off', null, { timeout: 8000 });
  assert.equal(await tv.evaluate(() => localStorage.getItem('racing-karts.voice')), null);
  await toRace();
  await tv.evaluate(() => { const g = window.__game; g.skipFlyover(); g.setScript((i) => g.drive(i)); g.speed = 4; });
  await tv.waitForFunction(() => window.__game.state?.t > 25, null, { timeout: 60000 });
  const off = await tv.evaluate(() => { const v = window.__game.voice; return { log: v.log.filter((l) => l.pool === 'start').length, stats: v.stats, duck: v.audio.duck, caption: !!document.querySelector('.vcap.on') }; });
  assert.equal(off.stats, null, 'no commentator');
  assert.equal(off.caption, false);
  assert.ok(off.duck > 0.8);

  // a fresh page: a normal race asks for no pack, makes no voice, shows no caption, and the choice is not remembered
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'it-IT' });
  t.after(() => ctx2.close().catch(() => {}));
  const clean = await ctx2.newPage();
  const asked2 = [];
  clean.on('request', (r) => { if (r.url().includes('/assets/voice/')) asked2.push(r.url()); });
  await clean.goto(`${srv.base}/?lang=it&quality=low&track=antelao&kart=jeep&bots=7&auto=1&flyover=0&laps=2`);
  await clean.waitForFunction(() => window.__game?.ready || window.__game?.error, null, { timeout: 120000 });
  await clean.mouse.click(640, 420); // the top of the race screen holds the pause button
  await clean.evaluate(() => { window.__game.speed = 4; });
  await clean.waitForFunction(() => window.__game.state?.t > 20, null, { timeout: 60000 });
  const none = await clean.evaluate(() => { const v = window.__game.voice; return { lang: v.lang, log: v.log.length, played: v.audio.played, cap: document.querySelectorAll('.vcap').length, opts: window.__game.flowApi.opts }; });
  assert.equal(none.lang, 'off');
  assert.equal(none.log, 0);
  assert.equal(none.played, 0);
  assert.equal(none.cap, 0, 'not even the element');
  assert.equal('voice' in none.opts, false);
  assert.deepEqual(asked2, [], 'not one byte of a pack');

  assert.deepEqual(errors, []);
});

test('a fresh clone has no packs: the commentary shows its captions, no sound, no error, and the race runs', { skip: !hasBrowser && 'no browser', timeout: 240000 }, async (t) => {
  // assets/voice is git ignored: this is the dist a clone builds
  const dist = mkdtempSync(join(tmpdir(), 'rk-voice-'));
  t.after(() => rmSync(dist, { recursive: true, force: true }));
  await buildDist(dist);
  rmSync(join(dist, 'assets/voice'), { recursive: true, force: true });
  const srv = await startServerProcess({ dist });
  t.after(() => srv.close());
  const browser = await launch('metal', { extra: ['--autoplay-policy=no-user-gesture-required'] });
  t.after(() => browser.close());
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'it-IT' })).newPage();
  const errors = [], missing = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // the browser's own line for a 404 is the one thing a missing pack may leave in the console
  page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push(m.text()); });
  page.on('response', (r) => { if (r.url().includes('/assets/voice/')) missing.push(r.status()); });
  await page.goto(`${srv.base}/?lang=it&quality=low&track=antelao&kart=jeep&bots=7&auto=1&flyover=0&laps=2&voice=it`);
  await page.waitForFunction(() => window.__game?.ready || window.__game?.error, null, { timeout: 120000 });
  assert.equal(await page.evaluate(() => window.__game.error ?? null), null);
  await page.mouse.click(640, 420);
  await page.evaluate(() => { window.__game.speed = 4; });
  await page.waitForFunction(() => window.__game.state?.t > 30, null, { timeout: 120000 });
  const got = await page.evaluate(() => { const v = window.__game.voice; return { lang: v.lang, ready: v.packReady, log: v.log.length, played: v.audio.played, cap: document.querySelectorAll('.vcap').length }; });
  assert.ok(missing.length > 0 && missing.every((c) => c === 404), `asked for the pack and got ${missing}`);
  assert.equal(got.lang, 'it');
  assert.equal(got.ready, false);
  assert.ok(got.log > 0, 'the commentary still writes its lines');
  assert.ok(got.cap > 0, 'and shows them');
  assert.equal(got.played, 0, 'no sound without a pack');
  assert.deepEqual(errors, []);
});

test('on the real page each mode gets its own words: alone against the ghost nobody wins, the Forma has its own start and end', { skip: (!hasBrowser && 'no browser') || (!hasPacks && 'no packs'), timeout: 400000 }, async (t) => {
  const dist = mkdtempSync(join(tmpdir(), 'rk-voice-'));
  t.after(() => rmSync(dist, { recursive: true, force: true }));
  await buildDist(dist);
  const srv = await startServerProcess({ dist });
  t.after(() => srv.close());
  const browser = await launch('metal', { extra: ['--autoplay-policy=no-user-gesture-required'] });
  t.after(() => browser.close());
  const run = async (query) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'it-IT' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${srv.base}/?lang=it&quality=low&track=antelao&kart=jeep&auto=1&flyover=0&voice=it&${query}`);
    await page.waitForFunction(() => window.__game?.ready || window.__game?.error, null, { timeout: 120000 });
    await page.mouse.click(640, 420);
    // fast forward, but the end of the hunt in real time: sim seconds at speed 8 run out while a voice is still on its first word
    await page.evaluate(() => { const g = window.__game; g.speed = 8; setInterval(() => { if (g.state?.forma && g.state.forma.left < 34) g.speed = 1; }, 50); });
    await page.waitForFunction(() => window.__game.phase === 'results', null, { timeout: 240000 });
    const pools = await page.evaluate(() => window.__game.voice.log.map((l) => l.pool));
    await ctx.close();
    assert.deepEqual(errors, []);
    return pools;
  };
  const time = await run('mode=time&laps=2');
  assert.ok(time.includes('ttStart'), time.join());
  assert.ok(time.includes('ttDone') || time.includes('ttRecord'), time.join());
  for (const no of ['start', 'win', 'lastLap', 'lead', 'pass']) assert.ok(!time.includes(no), `${no} in a time trial: ${time.join()}`);
  const forma = await run('mode=forma&bots=3');
  assert.ok(forma.includes('formaStart'), forma.join());
  assert.ok(forma.includes('formaWin'), forma.join());
  assert.ok(forma.includes('formaLast'), forma.join());
  for (const no of ['start', 'win', 'lastLap']) assert.ok(!forma.includes(no), `${no} in the Forma: ${forma.join()}`);
});
