// The team championship: sides in the flow, the sim's friendly fire and aim, the room. Then the real path in a browser: real phones
// and the TV from the lobby to the team podium and a rematch, and on the same page a Gran Premio with none of it.
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildTrack } from '../src/world/track.js';
import { buildTerrain } from '../src/world/terrain.js';
import { createRace, DT } from '../src/sim/index.js';
import { loadTrackDef } from '../src/data/tracks.js';
import { KART_IDS } from '../src/data/karts.js';
import { TEAMS, TEAM_IDS, teamName } from '../src/data/teams.js';
import { createFlow, resultRows, teamScore, POINTS } from '../src/game/flow.js';
import { createUnlocks } from '../src/game/unlocks.js';
import { sanitizeOpt, sanitizeTeam, createRoom } from '../server/room.js';
import { it as IT, en as EN } from '../src/i18n/index.js';
import { launch, headlessShell, buildDist, startServerProcess, openPad } from '../tools/harness.mjs';

const TRACKS = ['one', 'two', 'three'];
const flowWith = (n = 1, fields = {}) => {
  let seed = 7;
  const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const f = createFlow({ karts: KART_IDS, tracks: TRACKS, rng });
  f.setOpts({ mode: 'teams', ...fields });
  for (let s = 0; s < n; s++) f.join(s);
  return f;
};
const toField = (f, n) => {
  f.go();
  for (let s = 0; s < n; s++) f.pick(s, KART_IDS[s], true);
  f.step(5);
  f.gpPreset('all');
  f.gpStart();
  return f.field();
};
// The rows of a finished race: the karts in the order given are 1st, 2nd, ...
const rowsOf = (field, order = field) => order.map((p, n) => ({ i: field.indexOf(p), slot: p.slot, kart: p.kart, human: p.human, place: n + 1, time: 60 + n, bestLap: 20, ...(p.team ? { team: p.team } : {}) }));
const raced = (f, rows) => { f.loaded(); return f.raceDone(rows); };

describe('sides in the flow', () => {
  test('phones take the smaller side as they come, and a side has two', () => {
    const f = flowWith(4);
    assert.deepEqual(f.seats.map((s) => s.team), ['a', 'b', 'a', 'b']);
  });
  test('a seat changes side; into a full side it swaps with that side\'s last seat', () => {
    const f = flowWith(4);
    assert.equal(f.setTeam(0, 'b'), true);
    assert.deepEqual(f.seats.map((s) => s.team), ['b', 'b', 'a', 'a'], 'seat 3 goes to the side seat 0 left');
    assert.equal(f.setTeam(0, 'b'), false, 'already there');
    assert.equal(f.setTeam(0, 'x'), false);
    assert.equal(f.setTeam(3, 'nope'), false);
    const two = flowWith(2);
    two.setTeam(1, 'a');
    assert.deepEqual(two.seats.map((s) => s.team), ['a', 'a', null, null]);
  });
  test('only in the lobby, only in this mode, only a seat that is there', () => {
    const f = flowWith(1);
    assert.equal(f.setTeam(2, 'b'), false);
    const r = createFlow({ karts: KART_IDS, tracks: TRACKS });
    r.join(0);
    assert.equal(r.setTeam(0, 'b'), false);
    assert.equal(r.seats[0].team, null);
    f.go();
    assert.equal(f.setTeam(0, 'b'), false);
  });
  for (const [humans, bots, total, free] of [[1, 7, 8, 4], [1, 0, 4, 0], [2, 0, 4, 0], [2, 3, 5, 1], [4, 0, 4, 0], [4, 7, 8, 4]]) {
    test(`${humans} people, the option at ${bots} bots: ${total} karts, two a side, ${free} for nobody`, () => {
      const f = flowWith(humans, { bots });
      const field = toField(f, humans);
      assert.equal(field.length, total);
      for (const id of TEAM_IDS) assert.equal(field.filter((p) => p.team === id).length, 2, id);
      assert.equal(field.filter((p) => !p.team).length, free);
      assert.equal(new Set(field.map((p) => p.kart)).size, total, 'nobody on the same kart');
      assert.equal(field.filter((p) => p.human).length, humans);
      for (const p of field.filter((q) => q.human)) assert.equal(p.team, f.seats[p.slot].team);
    });
  }
  test('points: a side is its two karts, a free bot takes its place and gives its points to nobody', () => {
    const f = flowWith(2, { bots: 7 });
    const field = toField(f, 2);
    const A = field.filter((p) => p.team === 'a'), B = field.filter((p) => p.team === 'b'), N = field.filter((p) => !p.team);
    const order = [N[0], A[0], B[0], A[1], N[1], B[1], N[2], N[3]];
    const res = raced(f, rowsOf(field, order));
    const table = f.teamTable();
    assert.deepEqual(table.map((T) => [T.team, T.points, T.race, T.wins]), [['a', POINTS[1] + POINTS[3], POINTS[1] + POINTS[3], 0], ['b', POINTS[2] + POINTS[5], POINTS[2] + POINTS[5], 0]]);
    assert.equal(table[0].members.length, 2);
    assert.ok(table[0].members.every((m) => m.team === 'a'));
    assert.equal(res.rows[0].team, undefined);
    assert.equal(f.gpMore, true, 'three tracks');
    assert.equal(f.state.resultsT, 0, 'between races nothing moves by itself');
    // the second race adds to it; the wins count for the side
    f.next('rematch');
    const second = f.field();
    assert.deepEqual([...second].sort((a, b) => a.kart < b.kart ? -1 : 1), [...field].sort((a, b) => a.kart < b.kart ? -1 : 1), 'the same karts on the same sides');
    raced(f, rowsOf(second, [B[0], B[1], A[0], A[1], ...N]));
    const t2 = f.teamTable();
    const sum = (o, ...p) => p.reduce((s, q) => s + POINTS[q], o);
    assert.deepEqual(t2.map((T) => [T.team, T.points, T.wins, T.race]), [['b', sum(POINTS[2] + POINTS[5], 0, 1), 1, POINTS[0] + POINTS[1]], ['a', sum(POINTS[1] + POINTS[3], 2, 3), 0, POINTS[2] + POINTS[3]]]);
    assert.ok(!f.state.results.gp.finished);
  });
  test('level on points: wins, then first in the last race. There is always a winner', () => {
    const f = flowWith(1, { bots: 3 });
    const field = toField(f, 1);
    const [a0, a1] = field.filter((p) => p.team === 'a'), [b0, b1] = field.filter((p) => p.team === 'b');
    // 10 + 5 = 15 against 8 + 6 = 14: then the other way round, 29 each and one win each; b came first in the last race
    raced(f, rowsOf(field, [a0, b0, b1, a1]));
    f.next('rematch');
    raced(f, rowsOf(f.field(), [b0, a0, a1, b1]));
    const t = f.teamTable();
    assert.deepEqual(t.map((T) => T.points), [29, 29]);
    assert.deepEqual(t.map((T) => T.wins), [1, 1]);
    assert.equal(t[0].team, 'b');
    assert.deepEqual(t.map((T) => T.rank), [1, 2]);
  });
  test('the end: podium after the wait, a person on the winning side opens a family kart, rematch is the whole championship again', () => {
    const f = flowWith(1, { bots: 3 });
    const field = toField(f, 1);
    const me = field.find((p) => p.human), mine = field.filter((p) => p.team === me.team), theirs = field.filter((p) => p.team !== me.team);
    for (let r = 0; r < 3; r++) {
      f.drain();
      raced(f, rowsOf(f.field(), [mine[1], theirs[0], me, theirs[1]].map((p) => p)));
      if (r < 2) f.next('rematch');
    }
    assert.equal(f.state.gp.finished, true);
    assert.deepEqual(f.drain().filter((e) => e.type === 'gpWon'), [{ type: 'gpWon', slot: me.slot }], 'the bot on my side won it, and it counts for me');
    f.step(100);
    assert.equal(f.phase, 'podium');
    assert.equal(f.phoneFor(), 'podium');
    assert.equal(f.next('rematch'), true);
    assert.equal(f.phase, 'loading');
    assert.equal(f.state.track, TRACKS[0], 'from the first track');
    assert.deepEqual(f.state.gp.tracks, TRACKS);
    assert.equal(f.state.gp.index, 0);
    assert.deepEqual(f.teamTable().map((T) => T.points), [0, 0]);
    assert.equal(f.seats[me.slot].team, me.team, 'same sides');
  });
  test('a person on the losing side wins nothing', () => {
    const f = flowWith(1, { bots: 3 });
    const field = toField(f, 1);
    const me = field.find((p) => p.human), mine = field.filter((p) => p.team === me.team), theirs = field.filter((p) => p.team !== me.team);
    for (let r = 0; r < 3; r++) {
      f.drain();
      raced(f, rowsOf(f.field(), [theirs[0], me, theirs[1], mine[1]]));
      if (r < 2) f.next('rematch');
    }
    assert.equal(f.teamTable()[0].team, theirs[0].team, 'second place alone does not beat first and third');
    assert.deepEqual(f.drain().filter((e) => e.type === 'gpWon'), []);
    const unlocks = createUnlocks(null);
    assert.equal(unlocks.wins, 0);
  });
  test('a phone composes the list as in a Gran Premio: a confirmed card goes in, the random card starts', () => {
    const f = flowWith(1);
    f.go();
    f.pick(0, KART_IDS[0], true);
    f.step(5);
    assert.equal(f.phase, 'vote');
    f.vote(0, 'two', true);
    assert.deepEqual(f.state.list, ['two']);
    assert.equal(f.phase, 'vote', 'it does not run off with one card');
    f.vote(0, 'one', true);
    f.vote(0, 'random', true);
    assert.equal(f.phase, 'loading');
    assert.deepEqual(f.state.gp.tracks, ['two', 'one']);
    assert.ok(f.state.gp.teams);
  });
  test('what the phone hears: the side, the line-up, the score, who took it', () => {
    const f = flowWith(2, { bots: 3 });
    assert.deepEqual(f.menuFor(1).lineup, [{ slot: 0, team: 'a' }, { slot: 1, team: 'b' }]);
    assert.equal(f.menuFor(1).team, 'b');
    const field = toField(f, 2);
    assert.equal(f.menuFor(0).team, undefined, 'loading says nothing new');
    f.loaded();
    f.raceDone(rowsOf(field));
    const m = f.menuFor(0);
    assert.equal(m.team, 'a');
    assert.equal(m.won, null, 'not yet');
    assert.deepEqual(Object.keys(m.score).sort(), ['a', 'b']);
  });
});

describe('NEGATIVE: every other mode', () => {
  test('a field with no team key, the bots it always had, the same draw', () => {
    const run = (mode) => {
      let seed = 11;
      const f = createFlow({ karts: KART_IDS, tracks: TRACKS, rng: () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; } });
      f.setOpts({ mode, bots: 7 });
      f.join(0);
      return f;
    };
    const f = run('gp');
    const field = toField(f, 1);
    assert.equal(field.length, 8);
    for (const p of field) assert.ok(!('team' in p), 'no side');
    assert.equal(f.state.gp.teams, undefined);
    assert.deepEqual(f.teamTable(), []);
    assert.ok(!('team' in f.menuFor(0)));
    const zero = run('race');
    zero.setOpts({ bots: 0 });
    zero.go();
    zero.pick(0, KART_IDS[0], true);
    zero.step(5);
    zero.forceTrack(TRACKS[0]);
    assert.equal(zero.field().length, 1, 'zero bots is still zero outside this mode');
    assert.deepEqual(Object.keys(teamScore([])).sort(), ['a', 'b']);
    assert.equal(resultRows([{ i: 0, slot: 0, kart: 'jeep', human: true, place: 1, finished: false }])[0].team, undefined);
  });
});

// ---------- the sim ----------
describe('the sim', async () => {
  const worlds = new Map();
  const world = async (id = 'antelao') => {
    if (!worlds.has(id)) { const track = buildTrack(await loadTrackDef(id)); worlds.set(id, { track, terrain: buildTerrain(track) }); }
    return worlds.get(id);
  };
  const FOUR = [
    { slot: 0, kart: 'tabia', human: true, team: 'a' }, { slot: 1, kart: 'jeep', human: true, team: 'a' },
    { slot: 2, kart: 'gatto', human: true, team: 'b' }, { slot: 3, kart: 'logan', human: true, team: 'b' },
  ];
  const IDLE = [{ steer: 0, throttle: 0 }, { steer: 0, throttle: 0 }, { steer: 0, throttle: 0 }, { steer: 0, throttle: 0 }];
  const race4 = async (players = FOUR, extra = {}) => {
    const { track, terrain } = await world();
    const r = createRace({ track, terrain, seed: 9, laps: 3, countdown: 0, players, ...extra });
    r.step(IDLE); r.drainEvents();
    return r;
  };
  const go = (r, frames, each) => {
    const out = [];
    for (let f = 0; f < frames; f++) { each?.(f); r.step(IDLE); out.push(...r.drainEvents()); }
    return out;
  };
  const line = (r, order) => { order.forEach((i, n) => r.teleport(i, 0.3 - n * 0.012, 0, { speed: 0 })); };
  const fire = (r, i, item, up = false) => {
    r.give(i, item);
    const ins = IDLE.map((x, q) => (q === i ? { ...x, item: true, throttle: up ? 1 : 0 } : x));
    r.step(ins);
    return r.drainEvents();
  };

  test('a kart has its side; a player without one has no key at all', async () => {
    const r = await race4();
    assert.deepEqual(r.state.karts.map((k) => k.team), ['a', 'a', 'b', 'b']);
    const n = await race4(FOUR.map(({ team, ...p }) => p));
    for (const k of n.state.karts) assert.ok(!('team' in k));
  });
  test('the razzo flies past a team-mate to the first rival', async () => {
    const r = await race4();
    line(r, [2, 1, 0, 3]); // 2 in front, then my mate 1, then me 0
    const seen = fire(r, 0, 'razzo');
    assert.ok(seen.some((e) => e.type === 'itemUse'));
    const S = r.state.shots.find((s) => s.kind === 'razzo');
    assert.equal(S.target, 2);
    assert.equal(S.sweep, false);
    const out = go(r, 240, () => { line(r, [2, 1]); });
    const hits = out.filter((e) => e.type === 'hit');
    assert.ok(hits.some((e) => e.kart === 2 && e.cause === 'razzo'), 'the rival is hit');
    assert.ok(!hits.some((e) => e.kart === 1), 'the mate is not');
  });
  test('NEGATIVE: with no sides the same razzo goes for the kart right ahead', async () => {
    const r = await race4(FOUR.map(({ team, ...p }) => p));
    line(r, [2, 1, 0, 3]);
    fire(r, 0, 'razzo');
    assert.equal(r.state.shots.find((s) => s.kind === 'razzo').target, 1);
  });
  test('with only a team-mate ahead the razzo sweeps, like a leader\'s', async () => {
    const r = await race4();
    line(r, [1, 0, 2, 3]);
    fire(r, 0, 'razzo');
    const S = r.state.shots.find((s) => s.kind === 'razzo');
    assert.equal(S.sweep, true);
    assert.equal(S.target, -1);
  });
  test('a mate\'s hit does nothing, not even to the sausages; a rival\'s does', async () => {
    const r = await race4(), K = r.state.karts, R = r.internals;
    r.give(1, 'mici');
    assert.equal(R.hitKart(K[1], 0, 'tumble', 'razzo'), 'immune');
    assert.equal(K[1].orbit, 3);
    assert.equal(R.hitKart(K[1], 2, 'tumble', 'razzo'), 'blocked');
    assert.equal(K[1].orbit, 2);
    assert.equal(R.hitKart(K[2], 3, 'spin', 'sambal'), 'immune');
    assert.equal(R.hitKart(K[2], 0, 'spin', 'sambal'), 'hit');
    assert.equal(R.hitKart(K[0], -1, 'tumble', 'cows'), 'hit', 'the road hurts everyone');
  });
  test('polenta, durian and sambal fire leave a mate alone and catch a rival', async () => {
    for (const kind of ['polenta', 'durian', 'sambal']) {
      const r = await race4(), K = r.state.karts;
      r.teleport(1, 0.31, 0, { speed: 0 }); r.teleport(2, 0.31, 0, { speed: 0 });
      // the two stand either side of the spill's edge, on the same spot
      r.state.spills.push({ id: 900, kind, x: K[1].x, y: K[1].y, z: K[1].z, r: 3, t: 0, ttl: 5, owner: 0, i: K[1].trackI, d: 0 });
      r.state.karts[2].x += 1.2;
      const out = go(r, 3);
      const onMate = out.filter((e) => e.type === 'hit' && e.kart === 1), onRival = out.filter((e) => e.type === 'hit' && e.kart === 2);
      assert.equal(onMate.length, 0, `${kind}: the mate`);
      assert.ok(onRival.length >= 1, `${kind}: the rival`);
      assert.equal(K[1].stinkT, 0);
    }
  });
  test('a mici thrown ahead does not burst on a mate', async () => {
    const r = await race4(), K = r.state.karts;
    line(r, [3, 1, 0, 2]);
    fire(r, 0, 'mici');
    const out = go(r, 40, () => { K[1].vx = 0; K[1].vz = 0; K[1].speed = 0; });
    assert.ok(!out.some((e) => e.type === 'hit' && e.kart === 1));
  });
  test('rendang pulls past a mate towards the rival', async () => {
    const r = await race4();
    line(r, [2, 1, 0, 3]);
    fire(r, 0, 'rendang');
    go(r, 2);
    const S = r.state.shots.find((s) => s.kind === 'rendang');
    assert.equal(S.target, 2);
  });
  test('the frana goes for the first rival, not for a mate in the lead', async () => {
    const r = await race4();
    line(r, [1, 2, 0, 3]);
    const K = r.state.karts;
    fire(r, 0, 'frana');
    const rocks = r.state.spills.filter((s) => s.kind === 'frana');
    assert.ok(rocks.length);
    const near = (k) => rocks.reduce((best, s) => Math.min(best, Math.hypot(s.x - k.x, s.z - k.z)), 1e9);
    assert.ok(Number.isFinite(near(K[2])));
    // it falls ahead of the rival by the warning's distance, wherever the mate is
    const out = go(r, Math.ceil(2.4 / DT), () => { const P = rocks[0]; K[1].x = P.x; K[1].z = P.z; K[1].y = P.y; K[1].vx = 0; K[1].vz = 0; });
    assert.ok(!out.some((e) => e.type === 'hit' && e.kart === 1 && e.cause === 'frana'), 'a mate drives over them');
  });
  test('Baileys does not bite his own side', async () => {
    const { track, terrain } = await world();
    const mk = (team2) => createRace({ track, terrain, seed: 3, laps: 3, countdown: 0, players: [{ slot: 0, kart: 'baileys', human: true, team: 'a' }, { slot: 1, kart: 'jeep', human: true, team: team2 }] });
    const run = (r) => {
      const seen = [];
      for (let f = 0; f < 420; f++) { r.teleport(0, 0.5, 0, { speed: 0 }); r.teleport(1, 0.5, 2.2, { speed: 0 }); r.step([{ steer: 0, throttle: 0 }, { steer: 0, throttle: 0 }]); seen.push(...r.drainEvents()); }
      return seen.filter((e) => e.type === 'bite').length;
    };
    assert.equal(run(mk('a')), 0);
    assert.ok(run(mk('b')) > 0);
  });
  test('a whole race with sides is deterministic, everybody home, and a race without is not changed by the option being there', async () => {
    const { track, terrain } = await world();
    const players = [
      { slot: 0, kart: 'tabia', human: true, team: 'a', difficulty: 'ace' }, { slot: -1, kart: 'jeep', human: false, team: 'a' },
      { slot: -1, kart: 'gatto', human: false, team: 'b' }, { slot: -1, kart: 'logan', human: false, team: 'b' },
      { slot: -1, kart: 'becak', human: false, team: null }, { slot: -1, kart: 'jukung', human: false, team: null },
    ];
    const run = (list) => {
      const r = createRace({ track, terrain, seed: 21, laps: 2, countdown: 0, players: list });
      for (let f = 0; f < 60 * 400 && r.state.phase !== 'done'; f++) r.step([{ ...r.autopilot(0) }]);
      r.drainEvents();
      return r;
    };
    const a = run(players), b = run(players);
    assert.equal(JSON.stringify(a.state), JSON.stringify(b.state));
    assert.equal(a.state.phase, 'done');
    assert.ok(a.state.karts.every((k) => k.finished), 'all home');
    assert.deepEqual(a.state.karts.map((k) => k.team ?? null), ['a', 'a', 'b', 'b', null, null]);
    const plain = run(players.map(({ team, ...p }) => p)), same = run(players.map(({ team, ...p }) => ({ ...p, team: undefined })));
    assert.equal(JSON.stringify(plain.state), JSON.stringify(same.state));
    assert.ok(!JSON.stringify(plain.state).includes('"team"'));
  });
  test('teamScore: the table so far plus what the places would give now', () => {
    const K = [{ team: 'a', place: 1 }, { team: 'a', place: 8 }, { team: 'b', place: 2 }, { place: 3 }, { team: 'b', place: 4 }];
    assert.deepEqual(teamScore(K), { a: POINTS[0] + POINTS[7], b: POINTS[1] + POINTS[3] });
    assert.deepEqual(teamScore(K, { a: { points: 20 }, b: { points: 1 } }), { a: 20 + POINTS[0] + POINTS[7], b: 1 + POINTS[1] + POINTS[3] });
  });
});

describe('the room and the words', () => {
  test('a side passes sanitised, from any seat, and after the first pick too', () => {
    assert.deepEqual(sanitizeTeam({ t: 'team', team: 'a' }), { team: 'a' });
    assert.equal(sanitizeTeam({ t: 'team', team: 'c' }), null);
    assert.equal(sanitizeTeam({ t: 'team', team: 1 }), null);
    assert.equal(sanitizeTeam({ t: 'opt', team: 'a' }), null);
    assert.deepEqual(sanitizeOpt({ t: 'opt', mode: 'teams' }), { mode: 'teams' });
    const room = createRoom();
    const sock = () => { const q = { readyState: 1, sent: [], send(m) { q.sent.push(JSON.parse(m)); } }; return q; };
    const host = sock(), p0 = sock(), p1 = sock();
    room.addHost(host); room.addPad(p0, 'id0'); room.addPad(p1, 'id1');
    room.message(p0, JSON.stringify({ t: 'pick', kart: 'jeep' }));
    room.message(p1, JSON.stringify({ t: 'opt', mode: 'gp' }));
    room.message(p1, JSON.stringify({ t: 'team', team: 'a' }));
    room.message(p1, JSON.stringify({ t: 'team', team: 'zz' }));
    const said = host.sent.filter((m) => m.t === 'team' || m.t === 'opt');
    assert.deepEqual(said, [{ t: 'team', slot: 1, team: 'a' }]);
    room.close();
  });
  test('every word in Italian and in English, the sides named in each', () => {
    for (const k of ['lobby.teams', 'lobby.startTeams', 'lobby.startTeamsOnly', 'lobby.teamsHint', 'vote.teamsTitle', 'fly.teams', 'res.teamsTitle', 'res.teamsFinal', 'res.teamsTable', 'res.rematchTeams', 'pod.teamsTitle']) {
      assert.ok(IT[k] && EN[k], k);
      assert.ok(!IT[k].includes('\u2014') && !EN[k].includes('\u2014'), k);
    }
    assert.equal(teamName('b', 'it'), 'Genziana');
    assert.equal(teamName('b', 'en'), 'Gentian');
    assert.equal(TEAMS.length, 2);
  });
});

// ---------- the real path ----------
const skip = !headlessShell() && 'no chromium';
const dist = mkdtempSync(join(tmpdir(), 'rk-teams-'));
let browser = null;
after(async () => { await browser?.close().catch(() => {}); rmSync(dist, { recursive: true, force: true }); });

const padIs = (p, phase, ms = 20000) => p.page.waitForFunction((q) => window.__pad.phase === q, phase, { timeout: ms });
const tvIs = (tv, phase, ms = 240000) => tv.waitForFunction((q) => window.__game.phase === q || window.__game.error, phase, { timeout: ms });
const tap = (p, sel) => p.page.locator(sel).tap();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function setup(t, phones = 2) {
  if (!browser) { await buildDist(dist); browser = await launch('metal'); }
  const srv = await startServerProcess({ dist });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'en-US' });
  const tv = await ctx.newPage(), errors = [];
  tv.on('pageerror', (e) => errors.push(e.message));
  await tv.goto(`${srv.base}/?lang=en`);
  await tv.waitForFunction(() => window.__game?.ready || window.__game?.error, null, { timeout: 120000 });
  assert.equal(await tv.evaluate(() => window.__game.error), null);
  const pads = [];
  for (let n = 0; n < phones; n++) pads.push(await openPad(browser, srv.base, { label: `phone${n}` }));
  await tv.waitForFunction((k) => window.__game.flowApi.present().length === k, phones, { timeout: 15000 });
  t.after(async () => { for (const p of pads) await p.ctx.close().catch(() => {}); await ctx.close().catch(() => {}); await srv.close(); });
  return { srv, tv, pads, errors, ctx };
}
const setOpt = async (tv, pad, key, v) => {
  await tap(pad, `.seg[data-key="${key}"] button[data-v="${v}"]`);
  await tv.waitForFunction(([k, q]) => String(window.__game.flowApi.opts[k]) === String(q), [key, v], { timeout: 5000 });
};
const setBots = async (tv, pad, bots) => {
  for (let guard = 0; guard < 8 && (await tv.evaluate(() => window.__game.flowApi.opts.bots)) !== bots; guard++) {
    const now = await tv.evaluate(() => window.__game.flowApi.opts.bots);
    await tap(pad, `.step button[data-d="${now > bots ? -1 : 1}"]`);
    await tv.waitForFunction((n) => window.__game.flowApi.opts.bots === n, now + (now > bots ? -1 : 1), { timeout: 5000 });
  }
};
const ready = async (tv, pad) => {
  await padIs(pad, 'pick');
  await pad.page.waitForFunction(() => window.__pad.carousel?.focus, null, { timeout: 8000 });
  await tap(pad, '#readyBtn');
};
// Past the flyover and the countdown, the karts on autopilot on fast forward: what is being proved is the path round it, the sim's races are proved above.
async function runRace(tv) {
  await tvIs(tv, 'race');
  await tv.waitForFunction(() => window.__game.state, null, { timeout: 20000 });
  await tv.evaluate(() => window.__game.skipFlyover());
  await tv.waitForFunction(() => !window.__game.flyover && window.__game.state?.phase === 'race', null, { timeout: 30000 });
  const road = await tv.evaluate(() => {
    const g = window.__game, q = (s) => document.querySelector(s);
    return {
      teams: g.state.karts.map((k) => k.team ?? null), human: g.state.karts.map((k) => k.human),
      score: q('.hudscr .tscore') ? [...document.querySelectorAll('.hudscr .hv:first-child .ts')].map((e) => ({ team: e.dataset.team, n: e.querySelector('b').textContent, mine: e.classList.contains('mine') })) : null,
      flags: g.renderer.teamFlagCount(),
    };
  });
  await tv.evaluate(() => { const g = window.__game; g.speed = 40; g.setAuto(true); });
  return road;
}
async function endRace(tv) {
  await tv.waitForFunction(() => window.__game.phase === 'results' || window.__game.error, null, { timeout: 420000 });
  await tv.evaluate(() => { const g = window.__game; g.speed = 1; g.setAuto(false); });
  assert.equal(await tv.evaluate(() => window.__game.error), null);
}

test('a team championship through TV and two phones: sides in the lobby, two races, team points, the team podium, a rematch; then a Gran Premio with none of it', { skip, timeout: 1500000 }, async (t) => {
  const { tv, pads, errors } = await setup(t, 2);
  const [p0, p1] = pads;
  await padIs(p0, 'lobby');
  await padIs(p1, 'lobby');

  // ---------- NEGATIVE before the mode: no row, no badge ----------
  assert.equal(await p1.page.evaluate(() => document.getElementById('sideRow').classList.contains('hide')), true);
  assert.equal(await tv.evaluate(() => [...document.querySelectorAll('.lobby .seat .teamb')].every((b) => b.classList.contains('hide'))), true);

  // ---------- the lobby ----------
  await setBots(tv, p0, 3);
  await setOpt(tv, p0, 'laps', 2);
  await setOpt(tv, p0, 'mode', 'teams');
  await p1.page.waitForFunction(() => !document.getElementById('sideRow').classList.contains('hide'), null, { timeout: 5000 });
  assert.deepEqual(await tv.evaluate(() => window.__game.seats.slice(0, 2).map((s) => s.team)), ['a', 'b'], 'they start facing each other');
  await tv.waitForFunction(() => [...document.querySelectorAll('.lobby .seat')].slice(0, 2).every((s) => !s.querySelector('.teamb').classList.contains('hide')), null, { timeout: 5000 });
  assert.equal(await tv.evaluate(() => document.querySelector('.lobby .chips[data-key="mode"] [data-v="teams"]').classList.contains('on')), true);
  assert.equal(await p1.page.evaluate(() => document.querySelector('.side button.on')?.dataset.team), 'b');
  // the guest's own choice, though it may not touch the options; then a click on the TV sets it back apart
  await tap(p1, '.side button[data-team="a"]');
  await tv.waitForFunction(() => window.__game.seats[1].team === 'a', null, { timeout: 5000 });
  await p1.page.waitForFunction(() => document.querySelector('.side button.on')?.dataset.team === 'a', null, { timeout: 5000 });
  assert.match(await p1.page.evaluate(() => document.querySelector('.side button[data-team="a"] small').textContent), /P1 P2/);
  await tv.locator('.lobby .seat[data-seat="1"] .teamb').click();
  await tv.waitForFunction(() => window.__game.seats[1].team === 'b', null, { timeout: 5000 });
  await p1.page.waitForFunction(() => document.querySelector('.side button.on')?.dataset.team === 'b', null, { timeout: 5000 });
  assert.match(await tv.locator('.lobby .gobtn span').textContent(), /2 vs 2/);

  // ---------- kart, tracks ----------
  await tap(p0, '#goBtn');
  await tvIs(tv, 'pick');
  await ready(tv, p0);
  await ready(tv, p1);
  await tv.waitForFunction(() => document.querySelectorAll('.pick .sp .teamb:not(.hide)').length === 2, null, { timeout: 5000 });
  assert.match(await p1.page.locator('#who').textContent(), /Gentian/);
  await tvIs(tv, 'vote');
  assert.match(await tv.locator('.vote .tbar h1').textContent(), /team championship/);
  // the same composing as a Gran Premio: two tracks clicked on the TV, in order, then go
  await tv.locator('.vote .tc[data-id="antelao"]').click();
  await tv.locator('.vote .tc[data-id="pelmo"]').click();
  assert.deepEqual(await tv.evaluate(() => [...window.__game.flowApi.state.list]), ['antelao', 'pelmo']);
  await tv.locator('.vote .gpgo').click();

  // ---------- first race ----------
  await tvIs(tv, 'loading');
  const road = await runRace(tv);
  assert.equal(road.teams.length, 5, '2 people and 3 bots');
  assert.equal(road.teams.filter((x) => x === 'a').length, 2);
  assert.equal(road.teams.filter((x) => x === 'b').length, 2);
  assert.equal(road.teams.filter((x) => x === null).length, 1, 'the third bot races for nobody');
  assert.equal(road.flags, 4, 'a pennant on each kart with a side, none on the free bot');
  assert.deepEqual(road.score.map((s) => s.team), ['a', 'b']);
  assert.ok(road.score.every((s) => /^\d+$/.test(s.n)));
  assert.equal(road.score.filter((s) => s.mine).length, 1);
  await p0.page.waitForFunction(() => !document.getElementById('teamTag').classList.contains('hide'), null, { timeout: 8000 });
  assert.match(await p0.page.locator('#teamTag').textContent(), /^\d+ : \d+$/);
  await endRace(tv);
  await padIs(p0, 'results');
  const r1 = await tv.evaluate(() => {
    const g = window.__game;
    return { n: g.gp.n, finished: g.gp.finished, teams: g.gp.teams.map((T) => ({ team: T.team, points: T.points, race: T.race, members: T.members.map((m) => m.key) })), rows: g.results.map((r) => ({ team: r.team ?? null, place: r.place, points: r.points })), h1: document.querySelector('.results .tbar h1').textContent, blocks: document.querySelectorAll('.results .gcard .tblock').length, strong: [...document.querySelectorAll('.results .gcard .tblock strong')].map((e) => e.textContent), phase: g.phase };
  });
  assert.equal(r1.finished, false);
  assert.match(r1.h1, /Teams, race 1 of 2/);
  assert.equal(r1.blocks, 2);
  for (const T of r1.teams) {
    assert.equal(T.members.length, 2);
    assert.equal(T.points, r1.rows.filter((r) => r.team === T.team).reduce((s, r) => s + r.points, 0), `${T.team}: the side is its two karts`);
  }
  assert.deepEqual(r1.strong, r1.teams.map((T) => String(T.points)), 'what the TV says');
  await p0.page.waitForFunction(() => !document.getElementById('resTeam').classList.contains('hide'), null, { timeout: 5000 });
  const padScore = await p0.page.locator('#resTeam').textContent();
  assert.equal(padScore, `${r1.teams.find((T) => T.team === 'a').points} : ${r1.teams.find((T) => T.team === 'b').points}`, 'what the phone says');

  // ---------- second race, from the phone ----------
  await tap(p0, '#resAgain');
  await tvIs(tv, 'loading');
  await runRace(tv);
  await endRace(tv);
  const r2 = await tv.evaluate(() => { const g = window.__game; return { finished: g.gp.finished, teams: g.gp.teams.map((T) => ({ team: T.team, points: T.points, race: T.race, rank: T.rank })) }; });
  assert.equal(r2.finished, true);
  for (const T of r2.teams) {
    const before = r1.teams.find((q) => q.team === T.team);
    assert.equal(T.points, before.points + T.race, `${T.team}: it adds up over the Gran Premio`);
  }
  assert.ok(r2.teams[0].points >= r2.teams[1].points);

  // ---------- the podium ----------
  await tv.waitForFunction(() => window.__game.phase === 'podium', null, { timeout: 15000 });
  await padIs(p0, 'podium');
  await tv.waitForFunction(() => document.querySelectorAll('.podscr .steps.teams .kartc canvas').length === 4, null, { timeout: 15000 });
  const pod = await tv.evaluate(() => ({ h1: document.querySelector('.podscr .tbar h1').textContent, steps: [...document.querySelectorAll('.podscr .steps.teams .stp')].map((s) => ({ p: s.dataset.p, team: s.dataset.team, karts: s.querySelectorAll('.kartc').length, name: s.querySelector('.nameplate b').textContent, pts: s.querySelector('.nameplate span').textContent })) }));
  assert.deepEqual(pod.steps.map((s) => s.p), ['1', '2']);
  assert.deepEqual(pod.steps.map((s) => s.team), r2.teams.map((T) => T.team));
  assert.ok(pod.steps.every((s) => s.karts === 2));
  assert.ok(pod.h1.includes(pod.steps[0].name), pod.h1);
  assert.match(pod.steps[0].pts, new RegExp(`^${r2.teams[0].points} `));
  const said = await p0.page.locator('#resTeam').textContent(), mine = 'a';
  assert.match(said, r2.teams[0].team === mine ? /Your team won!/ : /wins/);

  // ---------- rematch: the whole championship again, same sides ----------
  await tv.locator('.podscr .rfoot [data-a="rematch"]').click();
  await tvIs(tv, 'loading');
  assert.deepEqual(await tv.evaluate(() => { const f = window.__game.flowApi; return { t: f.state.track, n: f.state.gp.index, p: f.teamTable().map((T) => T.points), s: f.seats.slice(0, 2).map((x) => x.team) }; }), { t: 'antelao', n: 0, p: [0, 0], s: ['a', 'b'] });
  await tvIs(tv, 'race');
  await tv.waitForFunction(() => window.__game.state, null, { timeout: 20000 });
  await tv.evaluate(() => window.__game.flowApi.quit());
  await tv.evaluate(() => window.__game.next('lobby'));

  // ---------- NEGATIVE: the same page, a plain Gran Premio, none of it anywhere ----------
  await tvIs(tv, 'lobby');
  await padIs(p0, 'lobby');
  await setOpt(tv, p0, 'mode', 'gp');
  await p1.page.waitForFunction(() => document.getElementById('sideRow').classList.contains('hide'), null, { timeout: 5000 });
  assert.equal(await tv.evaluate(() => [...document.querySelectorAll('.lobby .seat .teamb')].every((b) => b.classList.contains('hide'))), true);
  assert.equal(await p1.page.locator('#who').textContent(), 'Player 2');
  await tap(p0, '#goBtn');
  await tvIs(tv, 'pick');
  await ready(tv, p0);
  await ready(tv, p1);
  await tvIs(tv, 'vote');
  assert.equal(await tv.evaluate(() => document.querySelectorAll('.pick .sp .teamb:not(.hide)').length), 0);
  await tv.evaluate(() => { const f = window.__game.flowApi; f.gpToggle('antelao'); f.gpToggle('pelmo'); window.__game.ui.C.emit('gpGo'); });
  await tvIs(tv, 'loading');
  const plain = await runRace(tv);
  assert.ok(plain.teams.every((x) => x === null), 'no kart has a side');
  assert.equal(plain.score, null, 'no score on the HUD');
  assert.equal(plain.flags, 0, 'no pennants');
  assert.equal(await tv.evaluate(() => JSON.stringify(window.__game.state.karts).includes('"team"')), false);
  await sleep(600);
  assert.equal(await p0.page.evaluate(() => document.getElementById('teamTag').classList.contains('hide')), true);
  await endRace(tv);
  const res = await tv.evaluate(() => ({ teams: window.__game.gp.teams ?? null, blocks: document.querySelectorAll('.results .tblock').length, cls: document.querySelector('.results').classList.contains('teams'), rows: document.querySelectorAll('.results .gcard .grows .rrow, .results .gcard .rrow').length, h1: document.querySelector('.results .tbar h1').textContent, tagged: document.querySelectorAll('.results .rrow[data-team]').length }));
  assert.equal(res.teams, null);
  assert.equal(res.blocks, 0);
  assert.equal(res.cls, false);
  assert.equal(res.tagged, 0);
  assert.match(res.h1, /Grand Prix/);
  await padIs(p0, 'results');
  assert.equal(await p0.page.evaluate(() => document.getElementById('resTeam').classList.contains('hide')), true);
  assert.deepEqual(errors, []);
});

test('?mode=teams for tools: straight to a race with sides and pennants, drawn in budget', { skip, timeout: 240000 }, async (t) => {
  const { tv, srv } = await setup(t, 0);
  await tv.goto(`${srv.base}/?track=antelao&mode=teams&players=2&bots=7&flyover=0&lang=en&countdown=1&laps=2`);
  await tv.waitForFunction(() => window.__game.ready && window.__game.state, null, { timeout: 120000 });
  await tv.waitForFunction(() => window.__game.state.phase === 'race', null, { timeout: 30000 });
  await sleep(800);
  const got = await tv.evaluate(() => { const g = window.__game; g.draw(); const s = g.renderer.stats(); return { teams: g.state.karts.map((k) => k.team ?? null), flags: g.renderer.teamFlagCount(), perView: s.perView, tris: s.trianglesPerView, views: g.views.length }; });
  assert.equal(got.views, 2);
  assert.equal(got.flags, 4);
  assert.equal(got.teams.filter(Boolean).length, 4);
  assert.equal(got.teams.length, 8);
  assert.ok(got.perView < 150, `draw calls per view: ${got.perView}`);
  assert.ok(got.tris < 500000, `triangles per view: ${got.tris}`);
});

test('the keyboard alone: A and D choose the side in the lobby, the sides fill with bots', { skip, timeout: 300000 }, async (t) => {
  const { tv } = await setup(t, 0);
  await tv.evaluate(() => { window.__game.flowApi.setOpts({ mode: 'teams', bots: 0 }); });
  await tv.focus('body');
  await tv.keyboard.down('KeyW'); await sleep(120); await tv.keyboard.up('KeyW');
  await tv.waitForFunction(() => window.__game.flowApi.present().length === 1, null, { timeout: 8000 });
  await sleep(700);
  await tv.keyboard.down('KeyD'); await sleep(120); await tv.keyboard.up('KeyD');
  await tv.waitForFunction(() => window.__game.flowApi.seats[0].team === 'b', null, { timeout: 8000 });
  await tv.evaluate(() => { const f = window.__game.flowApi; f.go(); f.pick(0, 'jeep', true); });
  await tv.waitForFunction(() => window.__game.flowApi.phase === 'vote', null, { timeout: 8000 });
  await tv.evaluate(() => { const f = window.__game.flowApi; f.gpToggle('antelao'); f.gpStart(); window.__game.ui.C.emit('gpPreset', 'none'); });
  await tvIs(tv, 'race');
  await tv.waitForFunction(() => window.__game.state, null, { timeout: 20000 });
  const K = await tv.evaluate(() => window.__game.state.karts.map((k) => ({ team: k.team ?? null, human: k.human })));
  assert.equal(K.length, 4);
  assert.equal(K.find((k) => k.human).team, 'b');
  assert.equal(K.filter((k) => k.team === 'a').length, 2);
  assert.equal(K.filter((k) => k.team === 'b').length, 2);
});
