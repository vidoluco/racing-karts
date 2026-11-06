// The rules of the evening, in node: seats, options, kart pick, track vote, Gran Premio, results, what each phone hears. Then the
// whole thing in a real browser on the real server: a real phone page and scripted ones, from the lobby to the podium and back,
// with a phone leaving and returning.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AWAY_CRUISE, awayDrive, createFlow, createHudFeed, hudOf, offlineList, padFx, resultRows, FLOW, POINTS, RANDOM } from '../src/game/flow.js';
import { createRace, DT } from '../src/sim/index.js';
import { buildTrack } from '../src/world/track.js';
import { buildTerrain } from '../src/world/terrain.js';
import { loadTrackDef } from '../src/data/tracks.js';
import { viewRect } from '../src/ui/screens/hud.js';
import { viewLayout } from '../src/render/index.js';
import { launch, headlessShell, ROOT } from '../tools/harness.mjs';
import { startServer, pad, sleep } from '../server/testing.js';

const KARTS = ['tabia', 'gatto', 'seggiovia', 'mocanita', 'caruta', 'logan', 'jeep', 'becak', 'jukung'];
const TRACKS = ['antelao', 'pelmo', 'bran', 'bali'];
const REGIONS = { antelao: 'cadore', pelmo: 'cadore', bran: 'romania', bali: 'indonesia' };
// Scripted randomness: the values cycle, so a coin's result is part of the test.
const script = (...v) => { let i = 0; return () => v[i++ % v.length]; };
const make = (rng = script(0.1, 0.6, 0.3, 0.9)) => createFlow({ karts: KARTS, tracks: TRACKS, regions: REGIONS, rng });
const toPick = (f, ...slots) => { for (const s of slots) f.join(s); f.go(); f.drain(); };
const toVote = (f, ...slots) => {
  toPick(f, ...slots);
  for (const s of slots) f.pick(s, KARTS[s], true);
  f.step(FLOW.allReady + 0.01);
  f.drain();
};
const rows = (field) => field.map((p, n) => ({ i: n, slot: p.slot, kart: p.kart, human: p.human, place: n + 1, time: 100 + n, bestLap: 30 }));

describe('lobby', () => {
  test('options are validated and clamped', () => {
    const f = make();
    assert.equal(f.setOpts({ difficulty: 'nope', laps: 4, mode: 'x' }), false);
    f.setOpts({ difficulty: 'hard', bots: 99, laps: 5, mode: 'gp' });
    assert.deepEqual(f.opts, { difficulty: 'hard', bots: 7, laps: 5, mode: 'gp' });
    f.setOpts({ bots: -3 });
    assert.equal(f.opts.bots, 0);
  });
  test('the start button works with nobody seated: the keyboard takes seat one', () => {
    const f = make();
    assert.equal(f.go(), true);
    assert.equal(f.phase, 'pick');
    assert.equal(f.seats[0].source, 'keyboard');
    assert.equal(f.seats[0].present, true);
  });
  test('options only change in the lobby', () => {
    const f = make();
    toPick(f, 0);
    assert.equal(f.setOpts({ bots: 1 }), false);
  });
});

describe('kart pick', () => {
  test('moves on once everyone is ready, a beat later', () => {
    const f = make();
    toPick(f, 0, 1);
    f.pick(0, 'jeep', true);
    f.step(5);
    assert.equal(f.phase, 'pick');
    f.pick(1, 'jeep', true);
    f.step(FLOW.allReady / 2);
    assert.equal(f.phase, 'pick');
    f.step(FLOW.allReady);
    assert.equal(f.phase, 'vote');
  });
  test('taking "ready" back holds the screen', () => {
    const f = make();
    toPick(f, 0);
    f.pick(0, 'jeep', true);
    f.pick(0, 'jeep', false);
    f.step(5);
    assert.equal(f.phase, 'pick');
  });
  test('refuses karts it does not know', () => {
    const f = make();
    toPick(f, 0);
    assert.equal(f.pick(0, 'gong', true), false);
    assert.equal(f.seats[0].kart, null);
  });
  test('a phone gone does not hold the others up', () => {
    const f = make();
    toPick(f, 0, 1);
    f.pick(0, 'jeep', true);
    f.leave(1);
    f.step(FLOW.allReady + 0.1);
    assert.equal(f.phase, 'vote');
  });
  test('a click on the TV gives the kart to the first seat not ready', () => {
    const f = make();
    toPick(f, 0, 1);
    f.pickFromTV('jeep');
    f.pickFromTV('gatto');
    assert.equal(f.seats[0].kart, 'jeep');
    assert.equal(f.seats[1].kart, 'gatto');
    assert.equal(f.seats[1].ready, true);
  });
});

describe('track vote', () => {
  test('the same track goes straight through', () => {
    const f = make();
    toVote(f, 0, 1);
    f.vote(0, 'bali', true);
    assert.equal(f.state.vote.phase, 'open');
    f.vote(1, 'bali', true);
    assert.equal(f.state.vote.phase, 'agree');
    f.step(FLOW.agree + 0.01);
    assert.equal(f.phase, 'loading');
    assert.equal(f.state.track, 'bali');
  });
  test('differing votes: the coin spins over them and lands on one', () => {
    const f = make(script(0.9, 0.1));
    toVote(f, 0, 1);
    f.vote(0, 'bali', true);
    f.vote(1, 'pelmo', true);
    const v = f.state.vote;
    assert.equal(v.phase, 'roll');
    assert.deepEqual([...v.candidates].sort(), ['bali', 'pelmo']);
    const seen = new Set();
    for (let t = 0; t < FLOW.roll; t += 0.05) { f.step(0.05); seen.add(v.spin); }
    assert.equal(seen.size, 2, 'the spin shows both cards');
    assert.equal(v.spin, v.pick);
    assert.equal(v.landed, true);
    assert.ok(['bali', 'pelmo'].includes(v.pick));
    f.step(FLOW.land + 0.1);
    assert.equal(f.state.track, v.pick);
  });
  test('a random ballot spins over every track', () => {
    const f = make();
    toVote(f, 0);
    f.vote(0, RANDOM, true);
    assert.deepEqual(f.state.vote.candidates, TRACKS);
    assert.ok(TRACKS.includes(f.state.vote.pick));
  });
  test('a vote for a track that does not exist is ignored', () => {
    const f = make();
    toVote(f, 0);
    assert.equal(f.vote(0, 'jakarta', true), false);
    assert.equal(f.state.vote.phase, 'open');
  });
  test('a track that fails to load leaves the list and the vote opens again', () => {
    const f = make();
    toVote(f, 0);
    f.forceTrack('bali');
    f.step(FLOW.solo + 0.1);
    assert.equal(f.phase, 'loading');
    assert.equal(f.failed('bali'), true);
    assert.equal(f.phase, 'vote');
    assert.equal(f.tracks.includes('bali'), false);
  });
});

describe('Gran Premio', () => {
  const gp = (rng) => { const f = make(rng); f.setOpts({ mode: 'gp' }); toVote(f, 0, 1); return f; };
  test('phones add and remove tracks in the order picked; the random card starts it', () => {
    const f = gp();
    f.vote(0, 'bali', true);
    f.vote(1, 'antelao', true);
    f.vote(0, 'pelmo', true);
    assert.deepEqual(f.state.list, ['bali', 'antelao', 'pelmo']);
    f.vote(1, 'antelao', true);
    assert.deepEqual(f.state.list, ['bali', 'pelmo']);
    assert.ok(f.drain().some((e) => e.type === 'unlock'), 'the phone hears its lock is released');
    f.vote(0, RANDOM, true);
    assert.equal(f.phase, 'loading');
    assert.deepEqual(f.state.gp.tracks, ['bali', 'pelmo']);
    assert.equal(f.state.track, 'bali');
  });
  test('presets: a region, all, a random draw', () => {
    const f = gp();
    f.gpPreset('cadore');
    assert.deepEqual(f.state.list, ['antelao', 'pelmo']);
    f.gpPreset('all');
    assert.deepEqual(f.state.list, TRACKS);
    f.gpPreset('random3');
    assert.equal(f.state.list.length, 3);
    assert.equal(new Set(f.state.list).size, 3);
    f.gpPreset('clear');
    assert.deepEqual(f.state.list, []);
  });
  test('starting with too few tracks draws the rest', () => {
    const f = gp();
    f.gpToggle('bali');
    f.gpStart();
    assert.equal(f.state.gp.tracks.length, FLOW.gpRandom);
    assert.equal(f.state.gp.tracks[0], 'bali');
  });
  test('the table adds up race after race, the field stays, the grid turns over, the final podium comes from the table', () => {
    const f = gp();
    f.gpPreset('cadore');
    f.gpStart();
    const field1 = f.field();
    f.loaded();
    assert.equal(f.phase, 'race');
    f.raceDone(rows(field1));
    assert.equal(f.phase, 'results');
    assert.equal(f.gpMore, true);
    const t1 = f.gpTable();
    assert.equal(t1[0].points, POINTS[0]);
    assert.equal(f.nextTrack, 'pelmo');
    f.step(FLOW.results + 1);
    assert.equal(f.phase, 'results', 'between races the table waits for a press');
    assert.equal(f.next('rematch'), true);
    assert.equal(f.phase, 'loading');
    assert.equal(f.state.track, 'pelmo');
    const field2 = f.field();
    assert.deepEqual(field2.map((p) => p.kart).sort(), field1.map((p) => p.kart).sort(), 'same entrants');
    assert.equal(field2.at(-1).kart, field1[0].kart, 'the leader of the table starts last');
    f.loaded();
    f.raceDone(rows(field2).reverse().map((r, n) => ({ ...r, place: n + 1 })));
    assert.equal(f.state.gp.finished, true);
    const t2 = f.gpTable();
    for (const e of t2) assert.ok(e.points >= 0);
    assert.equal(t2.reduce((a, e) => a + e.points, 0), 2 * POINTS.slice(0, field1.length).reduce((a, b) => a + b, 0));
    f.step(FLOW.results + 0.1);
    assert.equal(f.phase, 'podium');
    const top = f.top3();
    assert.deepEqual(top.map((e) => e.place), [1, 2, 3]);
    assert.equal(top[0].points, t2[0].points);
    assert.equal(f.phoneFor(), 'podium');
    assert.equal(f.next('lobby'), true);
    assert.equal(f.state.gp, null);
  });
  test('a rematch of a finished Gran Premio is the whole list again, from a clean table; a rematch of a single race stays one race', () => {
    const f = gp();
    f.gpPreset('cadore');
    f.gpStart();
    const list = [...f.state.gp.tracks];
    for (let n = 0; n < list.length; n++) { const field = f.field(); f.loaded(); f.raceDone(rows(field)); if (n < list.length - 1) f.next('rematch'); }
    assert.equal(f.state.gp.finished, true);
    assert.equal(f.next('rematch'), true);
    assert.equal(f.phase, 'loading');
    assert.deepEqual(f.state.gp.tracks, list);
    assert.equal(f.state.gp.index, 0);
    assert.equal(f.state.gp.finished, false);
    assert.equal(f.state.track, list[0]);
    assert.ok(f.gpTable().every((e) => e.points === 0));
    const single = make();
    single.setOpts({ bots: 3 });
    toVote(single, 0);
    single.forceTrack('bali');
    single.step(FLOW.solo + 0.1);
    single.loaded();
    single.raceDone(rows(single.field()));
    assert.equal(single.next('rematch'), true);
    assert.equal(single.state.gp, null);
    assert.equal(single.state.track, 'bali');
  });
});

describe('results and after', () => {
  const race = () => {
    const f = make();
    f.setOpts({ bots: 3 });
    toVote(f, 0);
    f.forceTrack('bali');
    f.step(FLOW.solo + 0.1);
    const field = f.field();
    f.loaded();
    f.raceDone(rows(field));
    return f;
  };
  test('the table leads to the podium by itself, or at a press', () => {
    const f = race();
    assert.equal(f.phase, 'results');
    f.step(FLOW.results - 0.5);
    assert.equal(f.phase, 'results');
    f.step(1);
    assert.equal(f.phase, 'podium');
    assert.equal(f.top3().length, 3);
  });
  test('under the TV\'s podium of a single race the phone stays on its results: rematch and change track stay in reach', () => {
    const f = race();
    f.toPodium();
    assert.equal(f.phoneFor(), 'results');
    assert.equal(typeof f.menuFor(0).place, 'number');
  });
  test('rematch keeps track and karts, change track votes again, the lobby keeps the seats and clears the picks', () => {
    let f = race();
    f.next('rematch');
    assert.equal(f.phase, 'loading');
    assert.equal(f.state.track, 'bali');
    assert.equal(f.seats[0].kart, KARTS[0]);
    f = race();
    f.next('track');
    assert.equal(f.phase, 'vote');
    assert.equal(f.seats[0].track, null);
    f = race();
    f.next('lobby');
    assert.equal(f.phase, 'lobby');
    assert.equal(f.seats[0].present, true);
    assert.equal(f.seats[0].kart, null);
  });
  test('points are only for a Gran Premio', () => {
    assert.ok(race().state.results.rows.every((r) => r.points === 0));
  });
  test('a phone past its grace gives its seat up on the way to the lobby, one that only blinked keeps it', () => {
    const f = make();
    f.join(0); f.join(1); f.join(2);
    f.go();
    f.leave(1);
    f.leave(2);
    f.pick(0, 'jeep', true);
    f.step(FLOW.allReady + 0.1);
    f.forceTrack('bali');
    f.step(FLOW.solo + 0.1);
    f.field(); f.loaded();
    f.expire(1);
    f.raceDone(rows(f.state.field));
    f.next('lobby');
    assert.equal(f.seats[1].present, false);
    assert.equal(f.seats[2].present, true);
    assert.equal(f.seats[2].away, true);
    assert.equal(f.free(2), true, 'and it goes when the room says its grace is over');
    assert.equal(f.seats[2].present, false);
  });
  test('quit and restart from the pause menu', () => {
    const f = make();
    toVote(f, 0);
    f.forceTrack('bali');
    f.step(FLOW.solo + 0.1);
    f.field(); f.loaded();
    assert.equal(f.restart(), true);
    assert.equal(f.phase, 'loading');
    f.loaded();
    assert.equal(f.quit(), true);
    assert.equal(f.phase, 'lobby');
  });
});

describe('the field', () => {
  const field = (humans, bots) => {
    const f = make();
    f.setOpts({ bots });
    for (let i = 0; i < humans; i++) f.join(i);
    f.go();
    for (let i = 0; i < humans; i++) f.pick(i, KARTS[i], true);
    return f.field();
  };
  test('one player with bots, four with none, four with seven asked for', () => {
    assert.equal(field(1, 7).length, 8);
    assert.equal(field(4, 0).length, 4);
    assert.equal(field(4, 7).length, 8);
    assert.equal(field(1, 0).length, 1);
  });
  test('bots avoid the karts the humans took while there are others', () => {
    const list = field(3, 5);
    const taken = list.filter((p) => p.human).map((p) => p.kart);
    assert.ok(list.filter((p) => !p.human).every((p) => !taken.includes(p.kart)));
    assert.equal(new Set(list.map((p) => p.kart)).size, list.length);
  });
  test('humans start in the back half but not dead last', () => {
    const list = field(1, 7);
    const at = list.findIndex((p) => p.human);
    assert.ok(at >= 4 && at < 7, `grid position ${at}`);
  });
  test('a phone gone a moment before the start races under the autopilot; one past its grace sits it out and keeps its seat', () => {
    const f = make();
    f.join(0); f.join(1);
    f.go();
    f.pick(0, 'jeep', true);
    f.leave(1);
    assert.deepEqual(f.field().filter((p) => p.human).map((p) => p.slot), [0, 1]);
    f.expire(1);
    assert.deepEqual(f.field().filter((p) => p.human).map((p) => p.slot), [0]);
    assert.equal(f.seats[1].present, true);
    f.join(1);
    assert.deepEqual(f.field().filter((p) => p.human).map((p) => p.slot), [0, 1], 'back: in the next race');
  });
});

describe('a phone away', () => {
  const inRace = (f, ...slots) => {
    toVote(f, ...slots);
    f.forceTrack('bali');
    f.step(FLOW.solo + 0.1);
    f.field(); f.loaded();
    f.drain();
    assert.equal(f.phase, 'race');
  };
  const gpInRace = (f, mode, ...slots) => {
    f.setOpts({ mode });
    toVote(f, ...slots);
    f.gpToggle('bali'); f.gpToggle('pelmo'); f.gpToggle('antelao');
    f.gpStart();
    f.field(); f.loaded();
    f.drain();
    assert.equal(f.phase, 'race');
  };
  const finish = (f, order) => f.raceDone(rows(f.state.field).map((r, n) => ({ ...r, team: f.state.field[n].team, place: order(r) })));
  const seatOf = (f, slot) => f.state.gp.table[`p${slot}`];

  test('the TV\'s list: at once with the whole time left, counting down, no clock past the grace, gone on return', () => {
    const f = make();
    f.join(0); f.join(1); f.join(3, 'keyboard');
    const since = [];
    assert.deepEqual(offlineList(f.seats, since, 0, 120000), []);
    f.leave(1);
    since[1] = 1000;
    assert.deepEqual(offlineList(f.seats, since, 1000, 120000), [{ slot: 1, left: 120 }], 'the moment it left');
    assert.deepEqual(offlineList(f.seats, since, 31500, 120000), [{ slot: 1, left: 90 }]);
    assert.deepEqual(offlineList(f.seats, since, 121000, 120000), [{ slot: 1, left: null }], 'the clock ran out, the seat did not');
    f.leave(3);
    assert.deepEqual(offlineList(f.seats, since, 1000, 120000).map((o) => o.slot), [1], 'a keyboard seat has no phone to lose');
    f.expire(1);
    assert.deepEqual(offlineList(f.seats, since, 2000, 120000), [{ slot: 1, left: null }]);
    f.join(1);
    assert.deepEqual(offlineList(f.seats, since, 2000, 120000), []);
  });
  test('who is online: offline seats never count, and leaving releases whoever waited for them', () => {
    const f = make();
    f.join(0); f.join(1);
    assert.deepEqual(f.online(), [0, 1]);
    f.leave(1);
    assert.deepEqual(f.online(), [0]);
    assert.equal(f.isOnline(0), true);
    assert.equal(f.isOnline(1), false);
    assert.equal(f.isOnline(2), false);
    f.join(1);
    assert.equal(f.isOnline(1), true);
    f.go();
    f.pick(1, 'jeep', true);
    f.leave(0);
    f.step(FLOW.allReady + 0.1);
    assert.equal(f.phase, 'vote', 'the pick did not wait');
    f.vote(1, 'bali', true);
    f.leave(1);
    assert.equal(f.state.vote.phase, 'agree', 'nor the vote');
  });
  test('every phone gone on the pick: the TV can still move on, the phones do not do it by themselves', () => {
    const f = make();
    toPick(f, 0);
    f.leave(0);
    f.step(5);
    assert.equal(f.phase, 'pick');
    f.pickFromTV('jeep');
    f.step(FLOW.allReady + 0.1);
    assert.equal(f.phase, 'vote');
  });
  test('a seat is only freed in the lobby, whatever the phase', () => {
    const f = make();
    f.join(0); f.join(1);
    f.go();
    assert.equal(f.free(1), false, 'pick');
    f.pick(0, 'jeep', true); f.leave(1);
    f.step(FLOW.allReady + 0.1);
    assert.equal(f.free(1), false, 'vote');
    f.forceTrack('bali');
    f.step(FLOW.solo + 0.1);
    assert.equal(f.free(1), false, 'loading');
    f.field(); f.loaded();
    assert.equal(f.free(1), false, 'race');
    finish(f, (r) => r.i + 1);
    assert.equal(f.free(1), false, 'results');
    f.toPodium();
    assert.equal(f.free(1), false, 'podium');
    assert.equal(f.seats[1].present, true);
    f.expire(1);
    f.next('lobby');
    assert.equal(f.seats[1].present, false);
  });
  for (const expired of [false, true]) {
    const when = expired ? 'after' : 'before';
    test(`a race: back ${when} the grace, the same seat, kart and results row, and the next race has it`, () => {
      const f = make();
      inRace(f, 0, 1);
      const kart = f.seats[1].kart;
      f.leave(1);
      if (expired) { assert.equal(f.expire(1), true); assert.equal(f.seats[1].expired, true); }
      assert.equal(f.seats[1].present, true);
      f.join(1);
      assert.deepEqual([f.seats[1].away, f.seats[1].expired, f.seats[1].kart], [false, false, kart]);
      assert.deepEqual(f.drain().filter((e) => e.slot === 1 && e.type !== 'leave' && e.type !== 'expired'), [{ type: 'back', slot: 1 }]);
      finish(f, (r) => (r.slot === 1 ? 1 : r.i + 2));
      assert.equal(f.menuFor(1).place, 1, 'its row, and its place on the phone');
      f.next('rematch');
      assert.equal(f.field().find((p) => p.slot === 1).kart, kart);
    });
    test(`a championship: back ${when} the grace between two races, same points, same kart, still on the grid`, () => {
      const f = make();
      gpInRace(f, 'gp', 0, 1);
      const kart = f.seats[1].kart;
      f.leave(1);
      if (expired) f.expire(1);
      finish(f, (r) => (r.slot === 1 ? 1 : r.i + 2)); // a bot took it home, and the win is the seat's
      assert.equal(seatOf(f, 1).points, POINTS[0]);
      assert.equal(f.free(1), false);
      assert.equal(f.seats[1].present, true);
      f.next('rematch');
      assert.equal(f.phase, 'loading');
      assert.ok(f.field().some((p) => p.human && p.slot === 1 && p.kart === kart), 'gone or not, the kart is on the grid: the autopilot drives it');
      f.loaded();
      f.join(1);
      finish(f, (r) => (r.slot === 1 ? 2 : r.i + 3));
      assert.equal(seatOf(f, 1).points, POINTS[0] + POINTS[1], 'the points of both races, on one line');
      assert.equal(f.gpTable().filter((e) => e.human && e.slot === 1).length, 1);
      assert.equal(f.seats[1].kart, kart);
    });
  }
  test('teams: a seat past its grace keeps its side, and the side keeps the points', () => {
    const f = make();
    f.join(0); f.join(1);
    gpInRace(f, 'teams', 0, 1);
    const side = f.seats[1].team;
    assert.ok(side);
    f.leave(1); f.expire(1);
    finish(f, (r) => (r.slot === 1 ? 1 : r.i + 2));
    f.next('rematch');
    assert.equal(f.field().find((p) => p.slot === 1).team, side);
    assert.equal(f.state.gp.teams[side].points >= POINTS[0], true);
    f.join(1);
    assert.equal(f.seats[1].team, side);
  });
  test('a new phone on an offline seat: to the game it is that seat, with its points', () => {
    const f = make();
    gpInRace(f, 'gp', 0, 1);
    f.leave(1); f.expire(1);
    finish(f, (r) => (r.slot === 1 ? 1 : r.i + 2));
    const kart = f.seats[1].kart;
    f.join(1); // the room says it took the seat; here it looks like any return
    assert.deepEqual([f.seats[1].away, f.seats[1].kart, seatOf(f, 1).points], [false, kart, POINTS[0]]);
    assert.equal(f.menuFor(1).place, 1);
  });
  test('sat the first race of a championship out and came back: a bot gives up its place, on the right side', () => {
    const f = make();
    f.join(0); f.join(1);
    f.setOpts({ mode: 'gp', bots: 3 });
    f.go();
    f.pick(0, 'jeep', true);
    f.leave(1); f.expire(1);
    f.step(FLOW.allReady + 0.1);
    f.gpToggle('bali'); f.gpToggle('pelmo');
    f.gpStart();
    const first = f.field();
    assert.deepEqual(first.filter((p) => p.human).map((p) => p.slot), [0]);
    assert.equal(first.length, 4);
    f.loaded();
    finish(f, (r) => r.i + 1);
    f.join(1);
    f.next('rematch');
    const second = f.field();
    assert.deepEqual(second.filter((p) => p.human).map((p) => p.slot).sort(), [0, 1]);
    assert.equal(second.length, 4, 'the same field size');
  });
});

describe('the kart of a phone away', () => {
  // the seat's kart in the middle of the grid, the way main.js drives it, or (full) on the plain brain of a bot
  async function run(id, full) {
    const def = await loadTrackDef(id);
    const track = buildTrack(def), terrain = buildTerrain(track);
    const players = KARTS.slice(0, 8).map((kart, i) => ({ slot: i === 4 ? 0 : -1, kart, human: i === 4, i, name: 'x' }));
    const race = createRace({ track, terrain, seed: 7, laps: 2, players, difficulty: 'medium', countdown: 1 });
    const k = race.state.karts[4];
    let still = 0, worst = 0;
    for (let n = 0; race.state.phase !== 'done' && n < 60 * 500; n++) {
      if (!k.finished && !full) race.internals.priv[4].cruise = AWAY_CRUISE;
      const a = race.autopilot(4);
      race.step({ 4: full ? a : awayDrive(a) });
      race.drainEvents();
      still = race.state.phase === 'race' && !k.finished && Math.hypot(k.vx, k.vz) < 1 && k.hitT <= 0 && k.rescueT <= 0 ? still + DT : 0;
      worst = Math.max(worst, still);
    }
    return { finished: k.finished, time: k.finishT, worst, item: k.item };
  }
  for (const id of ['bran', 'antelao', 'bali']) {
    test(`${id}: it never stops in the road, it gets home, slower than a bot would`, async () => {
      const away = await run(id, false), full = await run(id, true);
      assert.equal(away.finished, true);
      assert.ok(away.worst < 1, `stood still for ${away.worst} s`);
      assert.ok(away.time > full.time, `away ${away.time}, a bot ${full.time}`);
    });
  }
});

describe('what a phone hears', () => {
  test('at the results the lowest phone connected has the buttons, and they move when it leaves or returns', () => {
    const f = make();
    f.join(0); f.join(1); f.join(2);
    assert.equal(f.authority(), 0);
    f.leave(0);
    assert.equal(f.authority(), 1);
    f.state.phase = 'results';
    assert.deepEqual([f.menuFor(0).edit, f.menuFor(1).edit, f.menuFor(2).edit], [false, true, false]);
    f.leave(1);
    assert.deepEqual([f.menuFor(1).edit, f.menuFor(2).edit], [false, true]);
    f.join(0);
    assert.deepEqual([f.menuFor(0).edit, f.menuFor(2).edit], [true, false]);
    f.join(3, 'keyboard');
    f.leave(0); f.leave(2);
    assert.equal(f.authority(), -1, 'a keyboard seat has no phone to tap');
  });
  test('reset: back to the lobby with no seats, from any phase', () => {
    const f = make();
    f.join(0); f.join(1);
    f.go();
    f.drain();
    f.reset();
    assert.equal(f.phase, 'lobby');
    assert.deepEqual(f.seats.filter((s) => s.present), []);
    const ev = f.drain();
    assert.ok(ev.some((e) => e.type === 'phase' && e.phase === 'lobby'));
    assert.deepEqual(ev.filter((e) => e.type === 'free').map((e) => e.slot), [0, 1]);
  });
  test('its menu for each phase', () => {
    const f = make();
    f.join(0); f.join(1);
    assert.deepEqual(f.menuFor(0).opts, f.opts);
    assert.equal(f.menuFor(1).edit, true);
    f.go();
    f.pick(1, 'jeep', true);
    let m = f.menuFor(0);
    assert.deepEqual(m.karts, KARTS);
    assert.deepEqual(m.others, [{ slot: 1, kart: 'jeep', ready: true }]);
    f.pick(0, 'gatto', true);
    f.step(FLOW.allReady + 0.1);
    f.vote(1, 'bali', true);
    m = f.menuFor(0);
    assert.deepEqual(m.tracks, TRACKS);
    assert.deepEqual(m.others, [{ slot: 1, track: 'bali', lock: true }]);
    assert.equal(m.pick, null);
    f.vote(0, 'bali', true);
    assert.equal(f.menuFor(0).pick, 'bali');
  });
  test('a phone that comes back takes its seat back, with its pick', () => {
    const f = make();
    f.join(0);
    f.go();
    f.pick(0, 'jeep', false);
    f.leave(0);
    assert.equal(f.seats[0].away, true);
    f.join(0);
    assert.equal(f.seats[0].away, false);
    assert.equal(f.menuFor(0).kart, 'jeep');
  });
  test('sim events become vibrations for humans only', () => {
    const karts = [{ i: 0, slot: 1, human: true }, { i: 1, slot: -1, human: false }];
    const out = padFx([
      { type: 'boxTake', kart: 0, item: 'razzo' }, { type: 'boxTake', kart: 0, item: null }, { type: 'boxTake', kart: 1, item: 'razzo' },
      { type: 'hit', kart: 0, kind: 'tumble' }, { type: 'hit', kart: 0, kind: 'slide' }, { type: 'boost', kart: 0 }, { type: 'shield', kart: 0 },
      { type: 'lap', kart: 0 }, { type: 'lastLap', kart: 0 }, { type: 'finish', kart: 0, place: 3 }, { type: 'bump', a: 0, b: 1 },
    ], karts);
    assert.deepEqual(out.map((m) => m.kind), ['roulette', 'box', 'hit', 'bump', 'boost', 'shield', 'lap', 'lastLap', 'finish', 'bump']);
    assert.equal(out[0].item, 'razzo');
    assert.equal(out[8].place, 3);
    assert.ok(out.every((m) => m.slot === 1));
  });
  test('the phone feels the turbo by its tier, charging a drift, a landing and an item; bots feel nothing', () => {
    const karts = [{ i: 0, slot: 1, human: true }, { i: 1, slot: -1, human: false }];
    const of = (e) => padFx([e], karts).map(({ slot, ...m }) => m);
    assert.deepEqual(of({ type: 'boost', kart: 0, kind: 'drift', tier: 3 }), [{ kind: 'boost', tier: 3 }]);
    assert.deepEqual(of({ type: 'boost', kart: 0, kind: 'pad' }), [{ kind: 'boost', tier: 1 }]);
    assert.deepEqual(of({ type: 'driftStart', kart: 0, dir: 1 }), [{ kind: 'drift' }]);
    assert.deepEqual(of({ type: 'driftTier', kart: 0, tier: 2 }), [{ kind: 'charge', tier: 2 }]);
    assert.deepEqual(of({ type: 'driftTier', kart: 0, tier: 0 }), []);
    assert.deepEqual(of({ type: 'land', kart: 0, force: 14 }), [{ kind: 'land', big: true }]);
    assert.deepEqual(of({ type: 'land', kart: 0, force: 5 }), [{ kind: 'land', big: false }]);
    assert.deepEqual(of({ type: 'itemUse', kart: 0, item: 'razzo' }), [{ kind: 'use' }]);
    assert.deepEqual(of({ type: 'traffic', kart: 0, kind: 'scrape' }), [{ kind: 'bump' }]);
    assert.deepEqual(of({ type: 'traffic', kart: 0, kind: 'part' }), [], 'a scooter parting is only an opinion');
    for (const type of ['boost', 'driftStart', 'driftTier', 'land', 'itemUse', 'traffic']) assert.deepEqual(of({ type, kart: 1, tier: 2, kind: 'scrape' }), [], type);
  });
  test('the HUD: the item is hidden while it spins, laps are 1 based and capped', () => {
    const k = { place: 2, lap: 1, item: null, itemCharges: 0, rouletteT: 0.4, boostT: 1 };
    assert.deepEqual(hudOf(k, 3), { place: 2, lap: 2, laps: 3, item: null, charges: 0, boost: true });
    assert.equal(hudOf({ ...k, lap: 3, rouletteT: 0, item: 'mici', itemCharges: 3 }, 3).lap, 3);
    assert.equal(hudOf({ ...k, rouletteT: 0, item: 'mici' }, 3).item, 'mici');
  });
  test('about five HUDs a second, and at once on a change', () => {
    const feed = createHudFeed();
    const h = { place: 1, lap: 1, item: null, charges: 0, boost: false };
    assert.equal(feed.due(0, h, 0), true);
    assert.equal(feed.due(0, h, 0.1), false);
    assert.equal(feed.due(0, h, 0.21), true);
    assert.equal(feed.due(0, { ...h, place: 2 }, 0.22), true);
    feed.forget(0);
    assert.equal(feed.due(0, { ...h, place: 2 }, 0.23), true);
  });
  test('results rows sort by place and a kart still out has no time', () => {
    const r = resultRows([{ i: 0, slot: 0, kart: 'a', human: true, place: 2, finished: false, finishT: 0, bestLapT: null }, { i: 1, slot: -1, kart: 'b', human: false, place: 1, finished: true, finishT: 90, bestLapT: 29 }]);
    assert.deepEqual(r.map((x) => x.place), [1, 2]);
    assert.equal(r[0].time, 90);
    assert.equal(r[1].time, null);
  });
});

test('the HUD views sit where the renderer draws them', () => {
  for (const n of [1, 2, 3, 4]) {
    const L = viewLayout(n);
    for (let q = 0; q < Math.min(n, L.length); q++) {
      const [x, y, w, h] = L[q], [a, b, c, d] = viewRect(q, n);
      assert.deepEqual([a, b, c, d], [x, 1 - y - h, w, h], `view ${q} of ${n}`);
    }
  }
});

// ---------- in the browser ----------
const hasBrowser = !!headlessShell();
test('a whole evening in the browser: lobby to podium, a phone leaving and returning, rematch, change track, Gran Premio', { skip: !hasBrowser && 'no browser', timeout: 280000 }, async (t) => {
  const dist = mkdtempSync(join(tmpdir(), 'rk-flow-'));
  execFileSync(process.execPath, ['build.mjs'], { cwd: ROOT, env: { ...process.env, DIST: dist }, stdio: 'ignore' });
  const srv = await startServer({ distDir: dist, padSilentMs: 1e9, reserveMs: 60000 });
  const browser = await launch('metal');
  t.after(async () => { await browser.close(); await srv.close(); rmSync(dist, { recursive: true, force: true }); });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'en-US' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${srv.base}/?quality=capture&laps=2`);
  await page.waitForFunction(() => window.__game?.ready || window.__game?.error, null, { timeout: 60000 });
  const phase = (p, ms = 90000) => page.waitForFunction((q) => window.__game.phase === q || window.__game.error, p, { timeout: ms });
  const g = (fn, arg) => page.evaluate(fn, arg);
  assert.equal(await g(() => window.__game.error), null);
  assert.equal(await g(() => window.__game.phase), 'lobby');

  // a real phone page in the first seat, a scripted one in the second
  const phoneCtx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, locale: 'en-US' });
  const real = await phoneCtx.newPage();
  await real.goto(`${srv.base}/pad`);
  await real.waitForFunction(() => window.__pad?.joined && window.__pad.slot === 0, null, { timeout: 15000 });
  await real.waitForFunction(() => window.__pad.phase === 'lobby', null, { timeout: 5000 });
  const p2 = await pad(srv, 'phone-two');
  await page.waitForFunction(() => window.__game.seats?.filter((s) => s.present).length === 2);

  // options from the phone reach the TV, the TV's reach the phone
  p2.send({ t: 'opt', bots: 3, laps: 2 });
  await page.waitForFunction(() => window.__game.flowApi.opts.bots === 3);
  await real.waitForFunction(() => window.__pad.menu.opts?.bots === 3, null, { timeout: 3000 });

  await real.click('#goBtn');
  await phase('pick');
  await real.waitForFunction(() => window.__pad.phase === 'pick', null, { timeout: 3000 });
  // the phone says which card is in front before anyone confirms
  await page.waitForFunction(() => window.__game.seats[0].kart);
  p2.send({ t: 'pick', kart: 'jeep', ready: false });
  await page.waitForFunction(() => window.__game.seats[1].kart === 'jeep');
  await real.waitForFunction(() => (window.__pad.menu.others || []).some((o) => o.slot === 1 && o.kart === 'jeep'), null, { timeout: 3000 });
  await real.click('#readyBtn');
  p2.send({ t: 'pick', kart: 'jeep', ready: true });
  await phase('vote');
  await real.waitForFunction(() => window.__pad.phase === 'vote', null, { timeout: 3000 });
  const track = await g(() => window.__game.flowApi.tracks[0]);
  p2.send({ t: 'vote', track, lock: true });
  await real.evaluate((id) => { window.__pad.carousel.show?.(id); }, track);
  await real.click('#voteBtn');
  await page.waitForFunction(() => window.__game.phase === 'loading' || window.__game.flowApi.state.vote.phase !== 'open');
  await phase('race');
  await page.waitForFunction(() => window.__game.flyover || window.__game.state?.phase);
  // a phone press skips the flyover
  await page.evaluate(() => window.__game.skipFlyover());
  await page.waitForFunction(() => !window.__game.flyover);
  await real.waitForFunction(() => window.__pad.phase === 'race', null, { timeout: 3000 });

  // a phone leaves: the seat stays, the TV says so; it comes back and hears everything again
  await p2.close();
  await page.waitForFunction(() => window.__game.seats[1].away === true);
  const missing = await page.waitForFunction(() => [...document.querySelectorAll('.hv .miss')].some((e) => !e.classList.contains('hide')), null, { timeout: 10000 });
  assert.ok(missing);
  const back = await pad(srv, 'phone-two');
  const heard = await back.next((m) => m.t === 'phase');
  assert.equal(heard.phase, 'race');
  const hud = await back.next((m) => m.t === 'hud');
  assert.ok(hud.laps === 2);
  await page.waitForFunction(() => window.__game.seats[1].away === false);
  await page.waitForFunction(() => [...document.querySelectorAll('.hv .miss')].every((e) => e.classList.contains('hide')), null, { timeout: 3000 });

  // the rest of the race on autopilot, at speed
  await g(() => { window.__game.setAuto(true); window.__game.advance(40000); });
  await phase('results');
  const results = await g(() => window.__game.results);
  assert.equal(results.length, 5);
  assert.deepEqual(results.map((r) => r.place), [1, 2, 3, 4, 5]);
  await real.waitForFunction(() => window.__pad.phase === 'results', null, { timeout: 3000 });
  await real.waitForFunction(() => window.__pad.menu.place > 0, null, { timeout: 3000 });
  // nothing is left of the HUD under the results, and the TV goes to the podium by itself
  assert.equal(await g(() => document.querySelector('.hudscr').classList.contains('hide')), true);
  await g(() => window.__game.next('podium'));
  await phase('podium');
  assert.equal(await real.evaluate(() => window.__pad.phase), 'results', 'the phone keeps its buttons');
  assert.equal((await g(() => window.__game.podium)).length, 3);

  // rematch from the phone, behind its second tap, once the new screen stops holding: straight back, same track, no reload of the world
  const settled = (kind) => real.waitForFunction((kind) => { const a = window.__pad.menu.advance; return window.__pad.screen === 'sResults' && a?.kind === kind && !document.getElementById('resNext').classList.contains('held'); }, kind, { timeout: 5000 });
  await settled('rematch');
  await real.click('#resMoreBtn');
  await real.click('#resAgain');
  await phase('race');
  assert.equal(await g(() => window.__game.track), track);
  await g(() => { window.__game.manual = true; window.__game.skipFlyover(); });
  await page.waitForFunction(() => !window.__game.flyover);
  await g(() => window.__game.advance(40000));
  await phase('results');
  // change track from the phone
  await settled('podium');
  await real.click('#resMoreBtn');
  await real.click('#resTrack');
  await phase('vote');
  await real.waitForFunction(() => window.__pad.phase === 'vote', null, { timeout: 3000 });
  assert.equal(await g(() => window.__game.seats[0].track), null, 'a fresh ballot');
  // back to the lobby from the TV: click-through by the menu's own wiring
  await g(() => { const f = window.__game.flowApi; f.forceTrack(f.tracks[0]); });
  await phase('race');
  await g(() => { window.__game.manual = true; window.__game.skipFlyover(); });
  await page.waitForFunction(() => !window.__game.flyover);
  await g(() => window.__game.advance(40000));
  await phase('results');
  await page.click('.results .bigbtn[data-a="lobby"]', { force: true });
  await phase('lobby');
  await real.waitForFunction(() => window.__pad.phase === 'lobby', null, { timeout: 3000 });

  // a Gran Premio of two races from the phone's menus and a cumulative table
  back.send({ t: 'opt', mode: 'gp' });
  await page.waitForFunction(() => window.__game.flowApi.opts.mode === 'gp');
  await g(() => window.__game.flowApi.setOpts({ mode: 'gp', laps: 2, bots: 2 }));
  await g(() => { const f = window.__game.flowApi; f.go(); });
  await phase('pick');
  await g(() => { const f = window.__game.flowApi; f.pick(0, 'tabia', true); f.pick(1, 'gatto', true); });
  await phase('vote');
  // Keep one short and one long track in this regression: a random GP can miss Batur.
  await g(() => { const f = window.__game.flowApi; f.gpPreset('clear'); f.gpToggle('antelao'); f.gpToggle('batur'); });
  back.send({ t: 'vote', track: 'random', lock: true });
  await phase('race');
  const races = await g(() => window.__game.flowApi.state.gp.tracks.length);
  for (let i = 0; i < races; i++) {
    await g(() => { window.__game.manual = true; window.__game.skipFlyover(); });
    await page.waitForFunction(() => !window.__game.flyover);
    // Two laps of a long track can exceed 40000 ticks. Advance until the race ends,
    // with a finite 2000 s simulation budget so a stuck kart still fails the test.
    for (let ticks = 0; ticks < 120000 && await g(() => window.__game.phase === 'race'); ticks += 2000) {
      await g(() => window.__game.advance(2000));
    }
    const raceEnd = await g(() => ({ phase: window.__game.phase, track: window.__game.track, t: window.__game.state.t, laps: window.__game.state.karts.map((k) => k.lap) }));
    assert.equal(raceEnd.phase, 'results', JSON.stringify(raceEnd));
    t.diagnostic(`GP race ${i + 1}: ${raceEnd.track}, ${raceEnd.t.toFixed(1)} s`);
    assert.equal((await g(() => window.__game.gp)).n, i + 1);
    if (i < races - 1) { await g(() => window.__game.next('rematch')); await phase('race'); }
  }
  const table = await g(() => window.__game.gp.table);
  assert.equal(table.length, 4);
  assert.ok(table[0].points >= table[3].points);
  await g(() => window.__game.next('podium'));
  await phase('podium');
  await real.waitForFunction(() => window.__pad.phase === 'podium', null, { timeout: 3000 });
  await g(() => window.__game.next('lobby'));
  await phase('lobby');

  assert.deepEqual(errors, []);
  await back.close();
  await sleep(50);
});

test('the keyboard alone, in real time: from the lobby to a moving kart, to the pause and out', { skip: !hasBrowser && 'no browser', timeout: 120000 }, async (t) => {
  const dist = mkdtempSync(join(tmpdir(), 'rk-keys-'));
  execFileSync(process.execPath, ['build.mjs'], { cwd: ROOT, env: { ...process.env, DIST: dist }, stdio: 'ignore' });
  const srv = await startServer({ distDir: dist });
  const browser = await launch('metal');
  t.after(async () => { await browser.close(); await srv.close(); rmSync(dist, { recursive: true, force: true }); });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'it-IT' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${srv.base}/?quality=capture&laps=2&bots=3`);
  await page.waitForFunction(() => window.__game?.ready, null, { timeout: 60000 });
  const phase = (p) => page.waitForFunction((q) => window.__game.phase === q, p, { timeout: 60000 });
  const tap = async (code) => { await page.keyboard.down(code); await sleep(90); await page.keyboard.up(code); await sleep(90); };
  await sleep(700); // past the guard that stops a held key running through the menus

  await tap('KeyE');
  await phase('pick');
  assert.equal(await page.evaluate(() => window.__game.seats[0].source), 'keyboard');
  await sleep(600);
  await tap('KeyD');
  const kart = await page.evaluate(() => window.__game.seats[0].kart);
  assert.ok(kart);
  await tap('KeyD');
  assert.notEqual(await page.evaluate(() => window.__game.seats[0].kart), kart, 'D moves to the next kart');
  await tap('KeyE');
  await phase('vote');
  await sleep(600);
  await tap('KeyE');
  await tap('KeyE');
  await page.waitForFunction(() => window.__game.seats[0].lock || window.__game.phase !== 'vote', null, { timeout: 5000 }).catch(() => {});
  await phase('race');
  // the flyover goes at any key, and the clock runs by itself from there
  await page.waitForFunction(() => window.__game.flyover);
  await sleep(300);
  await tap('Space');
  await page.waitForFunction(() => !window.__game.flyover && window.__game.state.phase === 'race', null, { timeout: 15000 });
  const before = await page.evaluate(() => { const k = window.__game.state.karts[window.__game.views[0]]; return { x: k.x, z: k.z, y: k.y, frames: window.__game.frames }; });
  await page.keyboard.down('KeyW');
  await sleep(1500);
  await page.keyboard.up('KeyW');
  const after = await page.evaluate(() => { const k = window.__game.state.karts[window.__game.views[0]]; return { x: k.x, z: k.z, y: k.y, frames: window.__game.frames }; });
  assert.ok(Math.hypot(after.x - before.x, after.z - before.z) > 3, 'the kart drives');
  assert.ok(after.frames > before.frames + 5, 'frames are drawn');

  await tap('Escape');
  assert.equal(await page.evaluate(() => window.__game.paused), true);
  const frozen = await page.evaluate(() => window.__game.state.t);
  await sleep(300);
  assert.equal(await page.evaluate(() => window.__game.state.t), frozen, 'the pause stops the race');
  await page.click('.pausescr button[data-a="quit"]', { timeout: 3000 });
  await phase('lobby');
  assert.deepEqual(errors, []);
});


test('every track has a picture of its own on the vote card; only the random card is the mosaic', async () => {
  const { trackArt } = await import('../src/ui/screens/art.js');
  const { TRACK_IDS } = await import('../src/data/tracks.js');
  for (const id of TRACK_IDS) assert.doesNotMatch(trackArt(id), /mosaic/, `${id} falls back to the surprise card`);
  assert.match(trackArt('random'), /mosaic/);
});

test('a phone away, on the real TV page: told at once in any phase, back with no reload, past the grace in a championship, a new phone takes the seat, the numbers land in the file', { skip: !hasBrowser && 'no browser', timeout: 280000 }, async (t) => {
  const dist = mkdtempSync(join(tmpdir(), 'rk-away-'));
  const dir = mkdtempSync(join(tmpdir(), 'rk-away-tm-'));
  execFileSync(process.execPath, ['build.mjs'], { cwd: ROOT, env: { ...process.env, DIST: dist }, stdio: 'ignore' });
  const GRACE = 1500;
  const srv = await startServer({ distDir: dist, reserveMs: GRACE, telemetryDir: dir });
  const browser = await launch('swiftshader');
  t.after(async () => { await browser.close(); await srv.close(); rmSync(dist, { recursive: true, force: true }); rmSync(dir, { recursive: true, force: true }); });
  const phoneCtx = () => browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, locale: 'en-US' });
  const tv = await (await browser.newContext({ viewport: { width: 640, height: 360 }, locale: 'en-US' })).newPage();
  const errors = [];
  tv.on('pageerror', (e) => errors.push(e.message));
  await tv.goto(`${srv.base}/?lang=en&manual=1&flyover=0&countdown=0`);
  await tv.waitForFunction(() => window.__game?.ready || window.__game?.error, null, { timeout: 60000 });
  await tv.evaluate(() => { window.__game.renderer.frame = () => {}; }); // this test is about seats, and the CPU rasteriser is slow: no picture of the race
  // polling on a clock, not on frames: on the CPU rasteriser a frame can take seconds
  const says = (re, ms = 8000) => tv.waitForFunction((src) => new RegExp(src).test(document.querySelector('.offline')?.textContent || ''), re.source, { timeout: ms, polling: 50 });
  const clear = () => tv.waitForFunction(() => document.querySelector('.offline').classList.contains('hide'), null, { timeout: 8000, polling: 50 });
  const f = (fn, arg) => tv.evaluate(fn, arg);

  // the lobby. A real phone page leaves the browser: the TV knows in a moment, not after the silence runs out
  const phone = await (await phoneCtx()).newPage();
  await phone.goto(`${srv.base}/pad`);
  await phone.waitForFunction(() => window.__pad?.joined && window.__pad.slot === 0, null, { timeout: 15000 });
  await phone.evaluate(() => { window.__sameLoad = true; });
  const setVisible = (page, state) => page.evaluate((v) => { Object.defineProperty(document, 'visibilityState', { value: v, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); }, state);
  const t0 = Date.now();
  await setVisible(phone, 'hidden');
  await says(/P1 offline, 0:0[12] left/, 2500);
  assert.ok(Date.now() - t0 < 2500, `told in ${Date.now() - t0} ms, well before the 4 s of silence could have said it`);
  assert.equal(await phone.evaluate(() => window.__pad.joined), false);
  await sleep(300);
  assert.equal(srv.room.status().slots[0].connected, false, 'it did not sneak back while hidden');
  // the foreground again: back by itself, no reload, same seat, the warning gone
  await setVisible(phone, 'visible');
  await phone.waitForFunction(() => window.__pad.joined && window.__pad.slot === 0, null, { timeout: 3000 });
  assert.equal(await phone.evaluate(() => window.__sameLoad), true, 'the same page: nothing reloaded');
  await clear();
  assert.deepEqual(await phone.evaluate(() => document.getElementById('toast').classList.contains('show')), false, 'nothing to tell: its own seat');

  // in the lobby a seat past its grace really goes
  let p2 = await pad(srv, 'phone-two');
  assert.equal((await p2.next('welcome')).slot, 1);
  await tv.waitForFunction(() => window.__game.seats[1].present);
  await p2.close();
  await says(/P2 offline/);
  await tv.waitForFunction(() => !window.__game.seats[1].present, null, { timeout: GRACE + 2000 });
  await clear();

  // a championship of two races. The pick: a seat going away is told there too, and holds nobody up
  p2 = await pad(srv, 'phone-two');
  assert.equal((await p2.next('welcome')).slot, 1);
  await tv.waitForFunction(() => window.__game.seats[1].present && !window.__game.seats[1].away);
  await f(() => { const fl = window.__game.flowApi; fl.setOpts({ mode: 'gp', bots: 1, laps: 2 }); fl.go(); });
  await tv.waitForFunction(() => window.__game.phase === 'pick');
  await p2.close();
  await says(/P2 offline/);
  p2 = await pad(srv, 'phone-two');
  await clear();
  await f(() => { const fl = window.__game.flowApi; fl.pick(0, 'jeep', true); fl.pick(1, 'tabia', true); });
  await tv.waitForFunction(() => window.__game.phase === 'vote', null, { timeout: 10000 });
  await f(() => { const fl = window.__game.flowApi; fl.gpToggle('antelao'); fl.gpToggle('pelmo'); fl.gpStart(); });
  await tv.waitForFunction(() => window.__game.phase === 'race' && window.__game.state, null, { timeout: 150000 });
  const kartOf = (slot) => f((s) => window.__game.state.karts.find((k) => k.human && k.slot === s), slot);
  await f(() => { window.__game.advance(240); });

  // gone in the race: at once on the TV, in its view and over everything; no dead kart in the road
  await p2.close();
  await says(/P2 offline, 0:0[12] left/);
  await tv.waitForFunction(() => [...document.querySelectorAll('.hv .miss')].some((e) => !e.classList.contains('hide')), null, { timeout: 8000, polling: 50 });
  const before = await kartOf(1);
  await f(() => { window.__game.advance(240); });
  const moved = await kartOf(1);
  assert.ok(moved.speed > 8, `the autopilot is driving, at ${moved.speed}`);
  assert.ok(Math.hypot(moved.x - before.x, moved.z - before.z) > 20, 'and it went somewhere');

  // past the grace: no clock, and the seat stands
  await says(/P2 offline, can still come back/, GRACE + 15000);
  assert.equal(srv.room.status().slots[1].expired, true);
  assert.equal(await f(() => window.__game.seats[1].present), true);
  // back, after the grace, in the race: the same seat, and the next word from the phone drives
  p2 = await pad(srv, 'phone-two');
  const w = await p2.next('welcome');
  assert.equal(w.slot, 1);
  assert.equal(w.took, undefined);
  await clear();
  assert.equal(await tv.evaluate(() => [...document.querySelectorAll('.hv .miss')].every((e) => e.classList.contains('hide'))), true);
  assert.equal((await p2.next('phase')).phase, 'race');
  for (let seq = 1; seq <= 8; seq++) { // the input's smoothing runs on real time: a few real moments, a few steps
    p2.send({ t: 'in', x: -1, y: 0, b: 0, d: 0, seq });
    await sleep(25);
    await f(() => { window.__game.advance(2); });
  }
  const driven = await kartOf(1);
  assert.ok(driven.steer < -0.5, `the phone drives again: ${driven.steer}`);

  // gone again, past the grace, and the race ends: the win is in the table under its seat
  await p2.close();
  await says(/can still come back/, GRACE + 15000);
  await f(() => { window.__game.setAuto(true); window.__game.advance(40000); });
  await tv.waitForFunction(() => window.__game.phase === 'results', null, { timeout: 60000 });
  await f(() => { window.__game.setAuto(false); });
  const seatBefore = await f(() => ({ kart: window.__game.seats[1].kart, points: window.__game.flowApi.gpTable().find((e) => e.key === 'p1').points }));
  assert.ok(seatBefore.points > 0);
  assert.equal(await f(() => window.__game.flowApi.free(1)), false);

  // a new phone scans the QR at the results: it takes that seat and is told, and the points and kart stay
  const fresh = await (await phoneCtx()).newPage();
  await fresh.goto(`${srv.base}/pad`);
  await fresh.waitForFunction(() => window.__pad?.joined, null, { timeout: 15000 });
  assert.equal(await fresh.evaluate(() => window.__pad.slot), 1);
  assert.equal(await fresh.evaluate(() => document.getElementById('toast').classList.contains('show')), true);
  assert.match(await fresh.textContent('#toastBig'), /You took Player 2's seat/);
  await clear();
  await fresh.waitForFunction(() => window.__pad.phase === 'results', null, { timeout: 3000 });
  assert.deepEqual(await f(() => ({ kart: window.__game.seats[1].kart, points: window.__game.flowApi.gpTable().find((e) => e.key === 'p1').points })), seatBefore);

  // the second race: on the grid, with that kart and that seat
  await f(() => window.__game.next('rematch'));
  await tv.waitForFunction(() => window.__game.phase === 'race' && window.__game.state?.t < 5 && window.__game.flowApi.state.track === 'pelmo', null, { timeout: 150000 });
  assert.equal((await kartOf(1)).kart, seatBefore.kart);

  // back to the lobby: the seat past its grace goes, the numbers are in the file
  await fresh.context().close();
  await says(/P2 offline/);
  await says(/can still come back/, GRACE + 15000);
  await f(() => { window.__game.flowApi.quit(); });
  await tv.waitForFunction(() => window.__game.phase === 'lobby' || window.__game.flowApi.phase === 'lobby', null, { timeout: 5000 });
  await tv.waitForFunction(() => !window.__game.flowApi.seats[1].present, null, { timeout: 3000 });
  await clear();
  await sleep(200);
  assert.equal(srv.room.status().slots[1], null, 'and the room gave it up too');
  const lines = readFileSync(join(dir, readdirSync(dir)[0]), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const race = lines.find((l) => l.e === 'race');
  assert.ok(lines.some((l) => l.e === 'session' && l.mode === 'gp' && l.laps === 2));
  assert.deepEqual([race.track, race.mode, race.gpRace, race.gpOf], ['antelao', 'gp', 1, 2]);
  assert.equal(race.karts.filter((k) => k.human).length, 2);
  assert.equal(race.karts.find((k) => k.slot === 0).input, 'stick', 'the real phone said how it steers');
  for (const k of race.karts) assert.ok(Number.isFinite(k.place) && Number.isFinite(k.bestLap) && Number.isFinite(k.wall) && typeof k.kart === 'string', JSON.stringify(k));
  assert.ok(lines.filter((l) => l.e === 'drop').length >= 5 && lines.some((l) => l.e === 'back' && l.took === true) && lines.some((l) => l.e === 'back' && l.expired === true));
  assert.deepEqual(errors, []);
});

test('the way back in stays off the race: the QR covers no one\'s kart, road, map or place, with the seat on the grid or not', { skip: !hasBrowser && 'no chromium', timeout: 300000 }, async (t) => {
  const dist = mkdtempSync(join(tmpdir(), 'rk-qr-'));
  execFileSync(process.execPath, ['build.mjs'], { cwd: ROOT, env: { ...process.env, DIST: dist }, stdio: 'ignore' });
  const srv = await startServer({ distDir: dist, reserveMs: 600 });
  const browser = await launch('swiftshader');
  t.after(async () => { await browser.close(); await srv.close(); rmSync(dist, { recursive: true, force: true }); });
  const tv = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'en-US' })).newPage();
  await tv.goto(`${srv.base}/?lang=en&manual=1&flyover=0&countdown=0`);
  await tv.waitForFunction(() => window.__game?.ready || window.__game?.error, null, { timeout: 60000 });
  await tv.evaluate(() => { window.__game.renderer.frame = () => {}; });
  const f = (fn, arg) => tv.evaluate(fn, arg);
  // the QR's box and, for each view on the TV, what it must leave alone: the middle of the view (the kart and the road ahead), the map, the place
  const clear = async (views) => {
    await tv.waitForFunction(() => { const e = document.querySelector('.rejoin'); return e && !e.classList.contains('hide'); }, null, { timeout: 8000, polling: 50 });
    const m = await f(() => {
      const box = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
      const seen = [...document.querySelectorAll('.hv')].filter((e) => e.querySelector('.plc'));
      return {
        qr: box(document.querySelector('.rejoin')), img: document.querySelector('.rejoin img').getBoundingClientRect().width,
        views: seen.map((e) => { const v = box(e), mid = (v.l + v.r) / 2, half = (v.r - v.l) / 8; return [{ l: mid - half, t: v.t, r: mid + half, b: v.b }, box(e.querySelector('.map')), box(e.querySelector('.plc'))]; }),
      };
    });
    assert.equal(m.views.length, views);
    assert.ok(m.qr.r <= 1280 && m.qr.b <= 720 && m.qr.l >= 0 && m.qr.t >= 0, `on screen: ${JSON.stringify(m.qr)}`);
    assert.ok(m.img > 100, `still something a phone can read: ${m.img}`);
    for (const parts of m.views) for (const p of parts) {
      assert.ok(m.qr.r <= p.l || m.qr.l >= p.r || m.qr.b <= p.t || m.qr.t >= p.b, `the QR ${JSON.stringify(m.qr)} sits on ${JSON.stringify(p)}`);
    }
  };
  const a = await pad(srv, 'phone-a');
  let b = await pad(srv, 'phone-b');
  await tv.waitForFunction(() => window.__game.seats[0].present && window.__game.seats[1].present);
  await f(() => { const fl = window.__game.flowApi; fl.setOpts({ mode: 'race', bots: 1, laps: 2 }); fl.go(); });
  await tv.waitForFunction(() => window.__game.phase === 'pick');
  await f(() => { const fl = window.__game.flowApi; fl.pick(0, 'jeep', true); fl.pick(1, 'gatto', true); });
  await tv.waitForFunction(() => window.__game.phase === 'vote', null, { timeout: 15000 });
  await f(() => window.__game.flowApi.forceTrack('antelao'));
  await tv.waitForFunction(() => window.__game.phase === 'race' && window.__game.state, null, { timeout: 180000, polling: 100 });

  // two views: the phone goes, its kart stays on the grid
  await b.close();
  await clear(2);
  // past the grace the race ends, and the next one is run without that seat: one view, the whole TV for Player 1
  await tv.waitForFunction(() => window.__game.seats[1].expired, null, { timeout: 8000, polling: 50 });
  await f(() => { window.__game.setAuto(true); window.__game.advance(40000); });
  await tv.waitForFunction(() => window.__game.phase === 'results', null, { timeout: 60000 });
  await f(() => { window.__game.setAuto(false); window.__game.next('rematch'); });
  await tv.waitForFunction(() => window.__game.phase === 'race' && window.__game.state?.t < 5, null, { timeout: 180000, polling: 100 });
  assert.deepEqual(await f(() => window.__game.state.karts.filter((k) => k.human).map((k) => k.slot)), [0]);
  await clear(1);
  // and the way back in still is one: the phone returns, the QR goes
  b = await pad(srv, 'phone-b');
  assert.equal((await b.next('welcome')).slot, 1);
  await tv.waitForFunction(() => document.querySelector('.rejoin').classList.contains('hide'), null, { timeout: 4000, polling: 50 });
  await a.close();
  await b.close();
});

test('the numbers of a race tell a barrier from a building, on the real TV page and in the report', { skip: !hasBrowser && 'no browser', timeout: 240000 }, async (t) => {
  const dist = mkdtempSync(join(tmpdir(), 'rk-hits-'));
  const dir = mkdtempSync(join(tmpdir(), 'rk-hits-tm-'));
  execFileSync(process.execPath, ['build.mjs'], { cwd: ROOT, env: { ...process.env, DIST: dist }, stdio: 'ignore' });
  const srv = await startServer({ distDir: dist, telemetryDir: dir });
  const browser = await launch('swiftshader');
  t.after(async () => { await browser.close(); await srv.close(); rmSync(dist, { recursive: true, force: true }); rmSync(dir, { recursive: true, force: true }); });
  const tv = await (await browser.newContext({ viewport: { width: 640, height: 360 }, locale: 'en-US' })).newPage();
  await tv.goto(`${srv.base}/?lang=en&manual=1&flyover=0&countdown=0`);
  await tv.waitForFunction(() => window.__game?.ready || window.__game?.error, null, { timeout: 60000 });
  await tv.evaluate(() => { window.__game.renderer.frame = () => {}; });
  const phase = (ph) => tv.waitForFunction((p) => window.__game.flowApi.phase === p && (p !== 'race' || window.__game.state), ph, { timeout: 150000, polling: 100 });
  const phone = await pad(srv, 'phone-hits');
  t.after(() => phone.close());
  await phone.next('welcome');
  await tv.evaluate(() => { const fl = window.__game.flowApi; fl.setOpts({ mode: 'race', bots: 1, laps: 2, difficulty: 'easy' }); fl.go(); });
  await phase('pick');
  await tv.evaluate(() => window.__game.flowApi.pick(0, 'tabia', true));
  await phase('vote');
  await tv.evaluate(() => window.__game.flowApi.forceTrack('bran'));
  await phase('race');
  // Aimed from the road, at speed: at the houses standing by it, then across a stretch with none within reach, at the barrier.
  const def = await loadTrackDef('bran'), track = buildTrack(def), S = track.samples;
  const near = def.solids.map((r) => ({ r, loc: track.nearest(r[0], r[1]) })).filter((q) => Math.abs(q.loc.d) < 14 && q.r[2] > 1.5 && q.r[3] > 1.5 && q.r[6] - q.r[5] > 4 && !track.structureAt(q.loc.i));
  const shots = near.map(({ r, loc }) => {
    const d = loc.d > 0 ? 1 : -1, x = S.x[loc.i] + S.nx[loc.i] * d, z = S.z[loc.i] + S.nz[loc.i] * d;
    return { u: loc.u, d, yawOffset: Math.atan2(r[0] - x, r[1] - z) - Math.atan2(S.tx[loc.i], S.tz[loc.i]) };
  });
  const clear = [];
  for (let i = 0; i < track.n && clear.length < 12; i += 40) {
    if (track.structureAt(i) || def.solids.some((r) => Math.hypot(r[0] - S.x[i], r[1] - S.z[i]) < 60)) continue;
    clear.push({ u: i / track.n, d: 0, yawOffset: 1.2 });
  }
  assert.ok(shots.length && clear.length, `${shots.length} at houses, ${clear.length} at barriers`);
  await tv.evaluate((all) => {
    const g = window.__game;
    g.setScript(() => ({ steer: 0, throttle: 1, item: false, drift: false }));
    for (const s of all) { g.teleport(0, s.u, s.d, { speed: 25, lap: 0, yawOffset: s.yawOffset }); g.advance(50); }
    g.setScript(null); g.setAuto(true);
  }, [...shots, ...clear]);
  await tv.evaluate(() => window.__game.advance(60000));
  await phase('results');
  await sleep(300);
  const lines = readFileSync(join(dir, readdirSync(dir)[0]), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const mine = lines.find((l) => l.e === 'race').karts.find((k) => k.slot === 0);
  assert.ok(mine.wall > 0, `barriers counted: ${JSON.stringify(mine)}`);
  assert.ok(mine.building > 0, `buildings counted: ${JSON.stringify(mine)}`);
  const report = execFileSync(process.execPath, ['tools/telemetry-report.mjs', dir], { cwd: ROOT, encoding: 'utf8' });
  assert.ok(report.includes(`${mine.wall}w ${mine.building}b`), report);
  console.log(`# ${mine.wall} on barriers, ${mine.building} on buildings`);
});
