// No phase needs the computer once a phone is in. The rules in node: every mode through every screen, undo, a phone going
// offline, any phone skipping the wait, a solo player, keyboard seats, the keyboard that took a seat by itself. Then the real TV
// page on the CPU rasteriser with two real phone pages: a whole team championship without touching the TV.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFlow, FLOW, RANDOM } from '../src/game/flow.js';
import { createKeyboard } from '../src/net/keyboard.js';
import { createInput } from '../src/net/input.js';
import { sanitizeAdvance } from '../server/room.js';
import { launch, headlessShell, ROOT, buildDist, startServerProcess } from '../tools/harness.mjs';
import { startServer, host, pad } from '../server/testing.js';

const KARTS = ['tabia', 'gatto', 'seggiovia', 'mocanita', 'caruta', 'logan', 'jeep', 'becak', 'jukung'];
const TRACKS = ['antelao', 'pelmo', 'bran', 'bali'];
const make = () => createFlow({ karts: KARTS, tracks: TRACKS, regions: {}, rng: () => 0.3 });
const rows = (field) => field.map((p, n) => ({ i: n, slot: p.slot, kart: p.kart, human: p.human, place: n + 1, time: 100 + n, bestLap: 30, ...(p.team ? { team: p.team } : {}) }));

// Through the lobby, the pick and the vote by what a phone can send, to the results of the first race.
function toResults(mode, slots = [0, 1]) {
  const f = make();
  for (const s of slots) f.join(s);
  f.setOpts({ mode, bots: 3 });
  assert.equal(f.go(), true);
  for (const s of slots) f.pick(s, KARTS[s], true);
  f.step(FLOW.allReady + 0.01);
  assert.equal(f.phase, 'vote');
  if (mode === 'gp' || mode === 'teams') {
    f.vote(slots[0], 'bali', true);
    f.vote(slots[0], 'pelmo', true);
    f.vote(slots[0], RANDOM, true); // what the phone's Go button sends
    assert.equal(f.phase, 'loading');
  } else {
    for (const s of slots) f.vote(s, 'bali', true);
    f.step(FLOW.agree + 0.01);
    assert.equal(f.phase, 'loading');
  }
  raceThrough(f);
  return f;
}
function raceThrough(f) {
  const field = f.field();
  f.loaded();
  f.raceDone(rows(field));
  assert.equal(f.phase, 'results');
  f.drain();
}
const pressAll = (f, slots = [0, 1]) => { for (const s of slots) assert.equal(f.advance(s, true), true, `slot ${s} pressed`); };

describe('every mode, from the phones alone', () => {
  for (const mode of ['race', 'forma']) {
    test(`${mode}: results, then the podium, then the same again`, () => {
      const f = toResults(mode);
      assert.equal(f.advanceKind, 'podium');
      pressAll(f);
      assert.equal(f.phase, 'podium');
      assert.equal(f.phoneFor(), 'results', 'the phone keeps its screen under the TV\'s podium');
      assert.equal(f.menuFor(0).advance.mine, false, 'a new screen, nobody has pressed');
      assert.equal(f.advanceKind, 'rematch');
      pressAll(f);
      assert.equal(f.phase, 'loading');
      assert.equal(f.state.track, 'bali');
    });
  }
  test('time trial: no podium, one press goes round again', () => {
    const f = toResults('time');
    assert.equal(f.advanceKind, 'rematch');
    pressAll(f);
    assert.equal(f.phase, 'loading');
  });
  for (const mode of ['gp', 'teams']) {
    test(`${mode}: the next race, the final table, the podium, the whole list again`, () => {
      const f = toResults(mode);
      assert.equal(f.gpMore, true);
      const m = f.menuFor(0).advance;
      assert.deepEqual([m.kind, m.next, m.more], ['rematch', 'pelmo', false], 'it says where it leads');
      pressAll(f);
      assert.equal(f.phase, 'loading');
      assert.equal(f.state.track, 'pelmo');
      raceThrough(f);
      assert.equal(f.state.gp.finished, true);
      assert.equal(f.advanceKind, 'podium');
      pressAll(f);
      assert.equal(f.phase, 'podium');
      assert.equal(f.phoneFor(), 'podium');
      assert.deepEqual([f.menuFor(1).advance.kind, f.menuFor(1).advance.more], ['rematch', true]);
      pressAll(f);
      assert.equal(f.phase, 'loading');
      assert.deepEqual(f.state.gp.tracks, ['bali', 'pelmo']);
      assert.equal(f.state.gp.index, 0);
    });
  }
  test('the podium that comes by itself starts a new screen: a press does not carry over', () => {
    const f = toResults('race');
    f.advance(0, true);
    f.step(FLOW.results + 0.1);
    assert.equal(f.phase, 'podium');
    assert.deepEqual(f.advanceState(), { ready: [], of: [0, 1] });
  });
  test('the lobby is any phone\'s, and the Gran Premio list tells the phones how it stands', () => {
    const f = make();
    f.join(0); f.join(1);
    assert.equal(f.menuFor(1).edit, true);
    f.setOpts({ mode: 'gp' });
    f.go();
    f.pick(0, KARTS[0], true); f.pick(1, KARTS[1], true);
    f.step(FLOW.allReady + 0.01);
    assert.deepEqual(f.menuFor(0).gp, { list: [], races: 3 }, 'nothing chosen: the draw makes three');
    f.vote(1, 'bali', true);
    assert.deepEqual(f.menuFor(0).gp, { list: ['bali'], races: 3 }, 'one is too few: the draw fills it');
    f.vote(0, 'bran', true);
    assert.deepEqual(f.menuFor(1).gp, { list: ['bali', 'bran'], races: 2 });
    f.vote(1, RANDOM, true);
    assert.equal(f.phase, 'loading');
    assert.deepEqual(f.state.gp.tracks, ['bali', 'bran']);
  });
  test('a plain race says nothing about a list', () => {
    const f = toResults('race');
    f.next('track');
    assert.equal(f.menuFor(0).gp, undefined);
  });
});

describe('pressing and taking it back', () => {
  test('the count is on the TV and on each phone; a second press undoes it; nothing moves until all are in', () => {
    const f = toResults('gp');
    assert.deepEqual(f.advanceState(), { ready: [], of: [0, 1] });
    f.advance(0, true);
    assert.deepEqual(f.advanceState(), { ready: [0], of: [0, 1] });
    assert.deepEqual([f.menuFor(0).advance.mine, f.menuFor(0).advance.ready, f.menuFor(0).advance.of], [true, 1, 2]);
    assert.deepEqual([f.menuFor(1).advance.mine, f.menuFor(1).advance.ready], [false, 1]);
    assert.equal(f.phase, 'results');
    f.advance(0, false);
    assert.deepEqual(f.advanceState().ready, []);
    f.advance(1, true);
    assert.equal(f.phase, 'results', 'the one who took it back is still waited for');
    f.advance(0, true);
    assert.equal(f.phase, 'loading');
  });
  test('a press repeated changes nothing, one from a screen gone by counts for nothing', () => {
    const f = toResults('race');
    const { turn } = f.menuFor(0).advance;
    assert.equal(f.advance(0, true, turn), true);
    assert.equal(f.advance(0, true, turn), false);
    f.advance(1, true, turn);
    assert.equal(f.phase, 'podium');
    assert.equal(f.advance(0, true, turn), false, 'late, from the results');
    assert.deepEqual(f.advanceState().ready, []);
  });
  test('only the results and the podium listen, only for a phone that is here', () => {
    const f = make();
    f.join(0); f.join(1, 'keyboard');
    assert.equal(f.advance(0, true), false, 'the lobby has its own Go');
    const g = toResults('race');
    g.leave(1);
    assert.equal(g.advance(1, true), false, 'a phone that left');
  });
  test('one person: a single press', () => {
    const f = toResults('race', [0]);
    f.advance(0, true);
    assert.equal(f.phase, 'podium');
    f.advance(0, true);
    assert.equal(f.phase, 'loading');
  });
});

describe('a phone going offline', () => {
  test('the one everybody was waiting for leaves: on at once', () => {
    const f = toResults('gp', [0, 1, 2]);
    f.advance(0, true); f.advance(2, true);
    assert.equal(f.phase, 'results');
    f.leave(1);
    assert.equal(f.phase, 'loading');
    assert.equal(f.state.track, 'pelmo');
  });
  test('its own press goes with it, and back it is just one more to wait for', () => {
    const f = toResults('race');
    f.advance(0, true);
    f.leave(0);
    assert.deepEqual(f.advanceState(), { ready: [], of: [1] });
    f.join(0);
    assert.equal(f.phase, 'results', 'coming back moves nothing');
    assert.equal(f.menuFor(0).advance.mine, false);
    f.advance(1, true);
    assert.equal(f.phase, 'results');
    f.advance(0, true);
    assert.equal(f.phase, 'podium');
  });
  test('all of them gone: nobody pressed, and the screen stays for whoever comes back', () => {
    const f = toResults('gp');
    f.leave(0); f.leave(1);
    assert.equal(f.phase, 'results');
    assert.deepEqual(f.advanceState(), { ready: [], of: [] });
    f.join(1);
    f.advance(1, true);
    assert.equal(f.phase, 'loading');
  });
  test('a phone that went away never blocks the pick or the vote either', () => {
    const f = make();
    f.join(0); f.join(1);
    f.go();
    f.pick(0, KARTS[0], true);
    f.leave(1);
    f.step(FLOW.allReady + 0.01);
    assert.equal(f.phase, 'vote');
    f.vote(0, 'bali', true);
    assert.equal(f.menuFor(0).pick, 'bali');
  });
});

// The players asked for it with two phones in hand: "il controllo deve essere dai telefoni", every phone, not only Player 1's.
describe('every phone after a race', () => {
  test('any phone at the table may skip the wait, a guest too; a phone that is away may not, nor the keyboard', () => {
    const f = toResults('gp', [0, 1, 2]);
    f.leave(2);
    assert.equal(f.skipWait(2), false, 'away: it is not looking at this screen');
    assert.equal(f.phase, 'results');
    assert.equal(f.skipWait(1), true, 'Player 1 is here, and Player 2 need not wait for anyone either');
    assert.equal(f.phase, 'loading');
    assert.equal(f.state.track, 'pelmo');
    const k = make();
    k.join(0); k.join(1, 'keyboard');
    k.setOpts({ mode: 'race', bots: 3 });
    k.go(); k.pick(0, KARTS[0], true); k.pick(1, KARTS[1], true);
    k.step(FLOW.allReady + 0.01);
    k.vote(0, 'bali', true); k.vote(1, 'bali', true);
    k.step(FLOW.agree + 0.01);
    raceThrough(k);
    assert.equal(k.skipWait(1), false, 'a keyboard seat speaks through the TV keys, not this way');
  });
  for (const mode of ['race', 'gp', 'time', 'teams', 'forma']) {
    test(`${mode}: a guest phone takes each way on, on results and on the podium`, () => {
      // rematch
      let f = toResults(mode);
      const { turn } = f.menuFor(1).advance;
      assert.equal(f.next('rematch', turn), true);
      assert.equal(f.phase, 'loading');
      // change track: in a championship under way it is the next race, as the phone's button is hidden there anyway
      f = toResults(mode);
      assert.equal(f.next('track', f.menuFor(1).advance.turn), true);
      assert.equal(f.phase, f.gpMore ? 'loading' : 'vote');
      // back to the lobby
      f = toResults(mode);
      assert.equal(f.next('lobby', f.menuFor(1).advance.turn), true);
      assert.equal(f.phase, 'lobby');
      // from the podium, where there is one
      f = toResults(mode);
      if (f.advanceKind === 'podium') {
        f.toPodium();
        assert.equal(f.menuFor(1).advance.more, true);
        assert.equal(f.next('track', f.menuFor(1).advance.turn), true);
        assert.equal(f.phase, 'vote');
      }
    });
  }
  test('a way on chosen on a screen gone by does not count on the next one', () => {
    const f = toResults('race');
    const { turn } = f.menuFor(1).advance;
    f.toPodium();
    assert.equal(f.next('lobby', turn), false, 'the results it saw are gone');
    assert.equal(f.phase, 'podium');
    assert.equal(f.next('lobby', f.menuFor(1).advance.turn), true, 'the positive case, on the screen it sees');
    assert.equal(f.phase, 'lobby');
  });
  test('a skip from a screen gone by does not skip the next one', () => {
    const f = toResults('race');
    const { turn } = f.menuFor(0).advance;
    f.toPodium();
    assert.equal(f.skipWait(0, turn), false);
    assert.equal(f.phase, 'podium');
  });
  test('the race options stay with the lowest phone, the ways out are everyone\'s, and rematch and change track only where the mode has them', () => {
    const f = toResults('gp');
    assert.deepEqual([f.menuFor(0).edit, f.menuFor(1).edit], [true, false]);
    assert.deepEqual(f.menuFor(1).advance, f.menuFor(0).advance, 'the guest is offered the same');
    assert.equal(f.menuFor(0).advance.more, false, 'in a championship under way both would mean the next race');
    assert.equal(toResults('race').menuFor(0).advance.more, true);
    assert.equal(toResults('time').menuFor(0).advance.more, true);
    assert.equal(toResults('forma').menuFor(0).advance.more, true);
  });
});

describe('keyboard seats', () => {
  const mixed = () => {
    const f = make();
    f.join(0); f.join(2, 'keyboard');
    f.go();
    return f;
  };
  test('at a table with phones nobody has to get up for one: not on the pick, not on the vote, not on the results', () => {
    const f = mixed();
    f.pick(0, KARTS[0], true);
    f.step(FLOW.allReady + 0.01);
    assert.equal(f.phase, 'vote', 'the pick');
    f.vote(0, 'bali', true);
    f.step(FLOW.solo + 0.01);
    assert.equal(f.phase, 'loading', 'the vote');
    const field = f.field();
    assert.deepEqual(field.filter((p) => p.human).map((p) => p.slot), [0, 2], 'it still races');
    f.loaded();
    f.raceDone(rows(field));
    assert.deepEqual(f.advanceState(), { ready: [], of: [0] });
    f.advance(0, true);
    assert.equal(f.phase, 'podium', 'the results');
  });
  test('with no phone the keyboard is still waited for, and what it presses is the same way forward', () => {
    const f = make();
    f.join(0, 'keyboard'); f.join(1, 'keyboard');
    f.go();
    f.pick(0, KARTS[0], true);
    f.step(FLOW.allReady + 0.01);
    assert.equal(f.phase, 'pick');
    f.pick(1, KARTS[1], true);
    f.step(FLOW.allReady + 0.01);
    assert.equal(f.phase, 'vote');
    f.vote(0, 'bali', true);
    assert.equal(f.state.vote.phase, 'open');
    f.vote(1, 'bali', true);
    f.step(FLOW.agree + 0.01);
    const field = f.field();
    f.loaded();
    f.raceDone(rows(field));
    assert.equal(f.advance(0, true), false, 'a key is not a phone: main.js takes it to the way forward at once');
    assert.equal(f.advanceKind, 'podium');
    assert.deepEqual(f.advanceState().of, []);
  });
  test('the TV and the mouse still decide at once, whoever has pressed', () => {
    const f = toResults('gp');
    f.advance(0, true);
    assert.equal(f.next('lobby'), true);
    assert.equal(f.phase, 'lobby');
    assert.deepEqual(f.seats.map((s) => s.go), [false, false, false, false]);
  });
});

describe('the keyboard that took a seat by itself', () => {
  const target = () => {
    const ls = {}, doc = {};
    const on = (box) => ({ addEventListener(t, h) { (box[t] ||= []).push(h); }, removeEventListener(t, h) { box[t] = (box[t] || []).filter((g) => g !== h); } });
    const docBox = {};
    Object.assign(doc, on(docBox), { fire: (type) => { for (const h of docBox[type] || []) h({}); } });
    return {
      ...on(ls), document: doc,
      fire(type, code, mods = {}) { for (const h of ls[type] || []) h({ code, preventDefault() {}, ...mods }); },
      blur() { for (const h of ls.blur || []) h({}); },
    };
  };
  const CMD_CTRL = { metaKey: true, ctrlKey: true };
  test('nothing held with Cmd, Ctrl or Option wakes a seat: Cmd+Ctrl+F, and every other key of the map', () => {
    const k = target(), kb = createKeyboard(k);
    // the shortcut itself, then every key in the map under each modifier
    k.fire('keydown', 'ControlLeft', { ctrlKey: true });
    k.fire('keydown', 'MetaLeft', CMD_CTRL);
    k.fire('keydown', 'KeyF', CMD_CTRL);
    for (const code of ['KeyW', 'KeyE', 'ArrowUp', 'Enter', 'KeyI', 'KeyO', 'KeyU', 'Numpad8', 'Numpad9']) {
      for (const mods of [{ metaKey: true }, { ctrlKey: true }, { altKey: true }, CMD_CTRL]) {
        k.fire('keydown', code, mods);
        k.fire('keyup', code, mods);
      }
    }
    for (const s of [0, 1, 2, 3]) {
      assert.equal(kb.active(s), false, `slot ${s}`);
      assert.equal(kb.get(s), null, `slot ${s}`);
    }
  });
  test('a modifier on its own wakes nobody either, while Shift and right Ctrl still drift for whoever is driving', () => {
    const k = target(), kb = createKeyboard(k);
    k.fire('keydown', 'ShiftLeft', { shiftKey: true });
    k.fire('keydown', 'ControlRight', { ctrlKey: true });
    assert.deepEqual([kb.active(0), kb.active(1)], [false, false]);
    k.fire('keyup', 'ShiftLeft'); k.fire('keyup', 'ControlRight');
    k.fire('keydown', 'KeyW');
    k.fire('keydown', 'ShiftLeft', { shiftKey: true });
    assert.equal(kb.get(0).drift, true);
    k.fire('keydown', 'ArrowUp');
    k.fire('keydown', 'ControlRight', { ctrlKey: true });
    k.fire('keydown', 'ArrowLeft', { ctrlKey: true }); // steering with the drift held is a Ctrl+arrow to the browser
    const g = kb.get(1);
    assert.equal(g.drift, true);
    assert.ok(g.x < 0, 'player 2 still steers while drifting');
  });
  test('a shortcut from a player already on the keyboard does not count as a press', () => {
    const k = target(), kb = createKeyboard(k);
    k.fire('keydown', 'KeyW');
    kb.get(0);
    k.fire('keydown', 'KeyE', { metaKey: true });
    assert.equal(kb.get(0).item, false);
    k.fire('keydown', 'KeyS', { altKey: true });
    assert.equal(kb.get(0).y, 1, 'only the W');
  });
  test('right Ctrl with a player 2 key wakes nobody: the exception is for a player already driving on those keys', () => {
    const k = target(), kb = createKeyboard(k);
    k.fire('keydown', 'ControlRight', { ctrlKey: true });
    for (const code of ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown', 'Enter', 'NumpadEnter']) {
      k.fire('keydown', code, { ctrlKey: true });
      k.fire('keyup', code, { ctrlKey: true });
    }
    k.fire('keyup', 'ControlRight');
    assert.equal(kb.active(1), false);
    assert.equal(kb.get(1), null);
    k.fire('keydown', 'ArrowUp'); // the plain key does it
    assert.equal(kb.active(1), true);
  });
  // The phone holds the slot and the game reads the phone: a key touched in the meantime waits in the keyboard for the first read,
  // and the first read comes when the phone drops. That read is not somebody pressing a key now.
  const withPad = () => {
    const k = target(), kb = createKeyboard(k);
    let say;
    const input = createInput({ onMessage(f) { say = f; return () => {}; }, send: () => true }, { keyboard: kb, smoothMs: 0 });
    return { k, kb, input, say: (m) => say(m) };
  };
  for (const [slot, item] of [[0, 'KeyE'], [1, 'Enter'], [2, 'KeyO'], [3, 'Numpad9']]) {
    test(`${item} pressed while a phone holds slot ${slot} is gone when the phone goes, and pressed after it counts`, () => {
      const { k, input, say } = withPad();
      say({ t: 'join', slot });
      k.fire('keydown', item); k.fire('keyup', item);
      assert.equal(input.get(slot).source, 'pad');
      assert.equal(input.get(slot).item, false, 'nothing to the phone');
      say({ t: 'leave', slot });
      assert.equal(input.get(slot).item, false, 'nothing later either');
      k.fire('keydown', item); k.fire('keyup', item);
      assert.equal(input.get(slot).item, true, 'a key pressed now is a key');
    });
  }
  test('a key still held when the phone goes is not a press either, and the other slots keep what they hold', () => {
    const { k, input, say } = withPad();
    say({ t: 'join', slot: 0 });
    k.fire('keydown', 'KeyW'); k.fire('keydown', 'KeyE');
    k.fire('keydown', 'KeyI');
    say({ t: 'leave', slot: 0 });
    const g = input.get(0);
    assert.deepEqual([g.y, g.item], [0, false]);
    assert.equal(input.get(2).y, 1, 'slot 2 is somebody else');
  });
  test('a plain key still takes the seat', () => {
    const k = target(), kb = createKeyboard(k);
    k.fire('keydown', 'KeyO');
    k.fire('keyup', 'KeyO');
    assert.equal(kb.active(2), true);
    assert.equal(kb.get(2).item, true);
  });
  for (const [what, leave] of [
    ['the window losing focus', (k) => k.blur()],
    ['a change to full screen', (k) => k.document.fire('fullscreenchange')],
    ['the page being hidden', (k) => k.document.fire('visibilitychange')],
    ['Cmd lifted, since the Mac sends no key-up for what it covered', (k) => k.fire('keyup', 'MetaLeft', { key: 'Meta' })],
  ]) {
    test(`nothing stays held after ${what}`, () => {
      const k = target(), kb = createKeyboard(k);
      k.fire('keydown', 'KeyW');
      k.fire('keydown', 'KeyD');
      k.fire('keydown', 'KeyE');
      leave(k);
      const g = kb.get(0);
      assert.deepEqual([g.x, g.y, g.item], [0, 0, false]);
    });
  }
  test('dispose takes the page listeners away too', () => {
    const k = target(), kb = createKeyboard(k);
    k.fire('keydown', 'KeyW');
    kb.dispose();
    k.document.fire('fullscreenchange');
    assert.equal(kb.get(0).y, 1);
  });
});

describe('the room', () => {
  test('sanitizeAdvance keeps what it knows', () => {
    assert.deepEqual(sanitizeAdvance({ t: 'advance', on: true, turn: 4, junk: 1 }), { on: true, turn: 4 });
    assert.deepEqual(sanitizeAdvance({ t: 'advance', on: 1, skip: 'yes', turn: 'x' }), { on: false });
    assert.deepEqual(sanitizeAdvance({ t: 'advance', on: true, skip: true }), { on: true, skip: true });
    assert.equal(sanitizeAdvance({ t: 'opt' }), null);
  });
  test('a guest\'s press and its ways on reach the TV after the picks, where its race options no longer do', async (t) => {
    const srv = await startServer();
    t.after(() => srv.close());
    const h = await host(srv);
    const a = await pad(srv, 'aaaa'), b = await pad(srv, 'bbbb');
    await a.next('welcome'); await b.next('welcome');
    b.send({ t: 'pick', kart: 'tabia', ready: true });
    await h.next('pick');
    b.send({ t: 'opt', bots: 2, laps: 5 });
    assert.equal(await h.none('opt', 150), true, 'the race options are still slot 0\'s');
    for (const next of ['rematch', 'track', 'lobby']) {
      b.send({ t: 'opt', next, turn: 3, bots: 2 });
      assert.deepEqual(await h.next('opt'), { t: 'opt', slot: 1, next, turn: 3 }, `${next}, without the options riding along`);
    }
    b.send({ t: 'advance', on: true, turn: 3 });
    assert.deepEqual(await h.next('advance'), { t: 'advance', slot: 1, on: true, turn: 3 });
    a.send({ t: 'advance', on: true, skip: true, turn: 3 });
    assert.deepEqual(await h.next('advance'), { t: 'advance', slot: 0, on: true, skip: true, turn: 3 });
  });
});

test('a whole team championship on the real TV page, nobody touching the TV: Continue, undo, a phone leaving, Player 1\'s way back, and the keyboard ghost', { skip: !headlessShell() && 'no browser', timeout: 280000 }, async (t) => {
  const dist = mkdtempSync(join(tmpdir(), 'rk-advance-'));
  execFileSync(process.execPath, ['build.mjs'], { cwd: ROOT, env: { ...process.env, DIST: dist }, stdio: 'ignore' });
  const srv = await startServer({ distDir: dist });
  const browser = await launch('swiftshader');
  t.after(async () => { await browser.close(); await srv.close(); rmSync(dist, { recursive: true, force: true }); });
  const tv = await (await browser.newContext({ viewport: { width: 640, height: 360 }, locale: 'en-US' })).newPage();
  const errors = [];
  tv.on('pageerror', (e) => errors.push(e.message));
  await tv.goto(`${srv.base}/?lang=en&manual=1&flyover=0&countdown=0`);
  await tv.waitForFunction(() => window.__game?.ready || window.__game?.error, null, { timeout: 60000 });
  await tv.evaluate(() => { window.__game.renderer.frame = () => {}; }); // this test is about who presses what: no picture of the race
  const phaseIs = (...want) => tv.waitForFunction((list) => list.includes(window.__game.phase), want, { timeout: 120000, polling: 50 });
  const bar = () => tv.evaluate(() => { const e = document.querySelector('.readybar'); return e.classList.contains('hide') ? null : e.textContent; });
  const open = async () => {
    const page = await (await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, locale: 'en-US' })).newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${srv.base}/pad`);
    await page.waitForFunction(() => window.__pad?.joined, null, { timeout: 15000 });
    return page;
  };
  const p1 = await open(), p2 = await open();
  await tv.waitForFunction(() => window.__game.seats.filter((s) => s.present).length === 2, null, { timeout: 15000 });

  // the keyboard ghost, in the lobby: a shortcut sent to the TV page seats nobody
  await tv.keyboard.down('Control'); await tv.keyboard.down('Meta');
  await tv.keyboard.press('KeyF'); await tv.keyboard.press('KeyO');
  await tv.keyboard.up('Meta'); await tv.keyboard.up('Control');
  await tv.waitForTimeout(250);
  assert.equal(await tv.evaluate(() => window.__game.seats.filter((s) => s.present).length), 2, 'no third kart');

  // a stray plain key past the lobby, with phones at the table, is nobody's kart
  const stray = async (code = 'KeyO') => { await tv.waitForTimeout(600); await tv.keyboard.press(code, { delay: 40 }); await tv.waitForTimeout(200); };
  // from the phones: the mode, Go from the guest, the karts, the list, off
  await tv.evaluate(() => window.__game.flowApi.setOpts({ laps: 2, bots: 0 }));
  await p1.locator('.seg[data-key="mode"] button[data-v="teams"]').tap();
  await tv.waitForFunction(() => window.__game.flowApi.opts.mode === 'teams', null, { polling: 50 });
  await p2.locator('#goBtn').tap();
  await phaseIs('pick');
  await stray();
  assert.equal(await tv.evaluate(() => window.__game.seats[2].present), false, 'no seat from a key on the pick, with phones in');
  for (const p of [p1, p2]) { await p.waitForFunction(() => window.__pad.screen === 'sKart'); await p.locator('#readyBtn').tap(); }
  await phaseIs('vote');
  await p1.waitForFunction(() => window.__pad.screen === 'sTrack' && window.__pad.menu.gp, null, { polling: 50 });
  assert.equal(await p1.textContent('#voteBtn'), 'Add');
  await p1.locator('#voteBtn').tap();
  await p1.waitForFunction(() => window.__pad.menu.gp.list.length === 1, null, { polling: 50 });
  await tv.evaluate(() => { window.__game.flowApi.gpToggle('pelmo'); });
  await p2.waitForFunction(() => /Races: 2/.test(document.getElementById('gpGoBtn').textContent), null, { polling: 50 });
  await p2.locator('#gpGoBtn').tap();
  await phaseIs('race');

  const finishRace = async () => {
    await tv.evaluate(() => { const g = window.__game; g.setAuto(true); g.advance(40000); });
    await phaseIs('results');
    for (const p of [p1, p2]) await p.waitForFunction(() => window.__pad.screen === 'sResults' && window.__pad.menu.advance, null, { polling: 50 });
  };
  await finishRace();
  await stray();
  assert.equal(await tv.evaluate(() => window.__game.phase), 'results', 'nor does it move everyone on');
  assert.match(await p1.textContent('#resWait'), /Next race: /);
  assert.match(await bar(), /P1.*P2.*0 of 2 ready/);
  assert.equal(await p2.locator('#resMoreBtn').isVisible(), true, 'every phone has the ways out');
  assert.equal(await p1.locator('#resMoreBtn').isVisible(), true);
  assert.equal(await p1.locator('#resBtns').isVisible(), false, 'behind a second tap');

  // a tap right as the screen comes up is a thumb still racing
  const unheld = (p) => p.waitForFunction(() => !document.getElementById('resNext').classList.contains('held'), null, { polling: 50 });
  await unheld(p1); await unheld(p2);
  await p1.locator('#resNext').tap();
  await tv.waitForFunction(() => /1 of 2 ready/.test(document.querySelector('.readybar').textContent), null, { polling: 50 });
  assert.equal(await tv.evaluate(() => document.querySelector('.readybar i[data-slot="0"]').classList.contains('on')), true, 'the tick on Player 1');
  assert.equal(await p1.textContent('#resNext'), 'Undo');
  assert.match(await p1.textContent('#resWait'), /Waiting for the others: 1 of 2/);
  await p1.locator('#resNext').tap();
  await tv.waitForFunction(() => /0 of 2 ready/.test(document.querySelector('.readybar').textContent), null, { polling: 50 });
  await p1.locator('#resNext').tap();
  await p2.waitForFunction(() => window.__pad.menu.advance?.ready === 1, null, { polling: 50 });
  assert.equal(await tv.evaluate(() => window.__game.phase), 'results', 'still waiting for the second');
  await p2.locator('#resNext').tap();
  await phaseIs('loading', 'race');
  await phaseIs('race');
  assert.equal(await tv.evaluate(() => window.__game.track), 'pelmo', 'the next race, as the green button would');
  assert.equal(await bar(), null);

  // the last race: one presses, the other leaves the browser, and it moves on at once
  await finishRace();
  await unheld(p1);
  await p1.locator('#resNext').tap();
  await p2.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await phaseIs('podium');
  await p1.waitForFunction(() => window.__pad.phase === 'podium' && window.__pad.menu.advance?.of === 1, null, { polling: 50 });
  await p2.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await p2.waitForFunction(() => window.__pad.joined && window.__pad.phase === 'podium' && window.__pad.menu.advance?.of === 2, null, { polling: 50, timeout: 8000 });

  // Player 1 takes everyone back to the lobby, from the phone, once the podium has held its moment
  await unheld(p1);
  await p1.locator('#resMoreBtn').tap();
  assert.equal(await p1.locator('#resNext').isVisible(), false, 'the big button is out of the way while the choices are open');
  await p1.locator('#resLobby').tap();
  await phaseIs('lobby');

  // a key touched earlier in the evening takes no seat by itself on the way back here; a key pressed now does
  await tv.waitForTimeout(600);
  assert.equal(await tv.evaluate(() => window.__game.seats[2].present), false, 'the O of an hour ago');
  await tv.keyboard.press('KeyO', { delay: 40 });
  await tv.waitForFunction(() => window.__game.seats[2].present && window.__game.seats[2].source === 'keyboard', null, { timeout: 3000, polling: 50 });
  await tv.waitForTimeout(150);
  assert.equal(await tv.evaluate(() => window.__game.phase), 'lobby', 'that press took a seat, it did not start everyone');
  // and with that key still in the room, the phones go on without it
  await p2.locator('#goBtn').tap();
  await phaseIs('pick');
  for (const p of [p1, p2]) { await p.waitForFunction(() => window.__pad.screen === 'sKart'); await p.locator('#readyBtn').tap(); }
  await phaseIs('vote');
  assert.equal(await tv.evaluate(() => window.__game.seats[2].ready), false, 'nobody waited for the keyboard');
  assert.deepEqual(errors, []);
});

test('keys pressed earlier stay earlier, a phone seat is not a keyboard seat, and a double tap on the way out leaves the podium alone, on the real TV page', { skip: !headlessShell() && 'no browser', timeout: 280000 }, async (t) => {
  const dist = mkdtempSync(join(tmpdir(), 'rk-advance-'));
  execFileSync(process.execPath, ['build.mjs'], { cwd: ROOT, env: { ...process.env, DIST: dist }, stdio: 'ignore' });
  const srv = await startServer({ distDir: dist });
  const browser = await launch('swiftshader');
  t.after(async () => { await browser.close(); await srv.close(); rmSync(dist, { recursive: true, force: true }); });
  const tv = await (await browser.newContext({ viewport: { width: 640, height: 360 }, locale: 'en-US' })).newPage();
  const errors = [];
  tv.on('pageerror', (e) => errors.push(e.message));
  await tv.goto(`${srv.base}/?lang=en&manual=1&flyover=0&countdown=0`);
  await tv.waitForFunction(() => window.__game?.ready || window.__game?.error, null, { timeout: 60000 });
  await tv.evaluate(() => { window.__game.renderer.frame = () => {}; });
  const phaseIs = (...want) => tv.waitForFunction((list) => list.includes(window.__game.phase), want, { timeout: 120000, polling: 50 });
  const phase = () => tv.evaluate(() => window.__game.phase);
  const seats = () => tv.evaluate(() => window.__game.seats.map((s, i) => (s.present ? `${i}:${s.source}` : null)).filter(Boolean).join(' '));
  const open = async () => {
    const page = await (await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, locale: 'en-US' })).newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${srv.base}/pad`);
    await page.waitForFunction(() => window.__pad?.joined, null, { timeout: 15000 });
    return page;
  };
  const visible = (p, on) => p.evaluate((on) => { Object.defineProperty(document, 'visibilityState', { value: on ? 'visible' : 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); }, on);
  const gone = async (p, slot) => { await visible(p, false); await tv.waitForFunction((s) => window.__game.seats[s].away, slot, { polling: 50 }); await tv.waitForTimeout(300); };
  const back = async (p, slot) => { await visible(p, true); await tv.waitForFunction((s) => !window.__game.seats[s].away, slot, { polling: 50, timeout: 10000 }); await p.waitForFunction(() => window.__pad.joined, null, { polling: 50 }); };
  const toLobby = async (phones) => { await tv.evaluate(() => window.__game.next('lobby')); await phaseIs('lobby'); await tv.waitForTimeout(700); for (const p of phones) await p.waitForFunction(() => window.__pad.screen === 'sLobby', null, { polling: 50 }); };
  const toResults = async (phones, mode) => {
    await phones[0].locator(`.seg[data-key="mode"] button[data-v="${mode}"]`).tap();
    await tv.waitForFunction((m) => window.__game.flowApi.opts.mode === m, mode, { polling: 50 });
    await phones[1].locator('#goBtn').tap();
    await phaseIs('pick');
    for (const p of phones) { await p.waitForFunction(() => window.__pad.screen === 'sKart', null, { polling: 50 }); await p.waitForTimeout(150); await p.locator('#readyBtn').tap(); }
    await phaseIs('vote');
    if (mode === 'gp') {
      await phones[0].waitForFunction(() => window.__pad.screen === 'sTrack' && window.__pad.menu.gp, null, { polling: 50 });
      await tv.evaluate(() => { const f = window.__game.flowApi; f.gpToggle('bran'); f.gpToggle('pelmo'); });
      await phones[1].waitForFunction(() => /2/.test(document.getElementById('gpGoBtn').textContent), null, { polling: 50 });
      await phones[1].locator('#gpGoBtn').tap();
    } else {
      for (const p of phones) { await p.waitForFunction(() => window.__pad.screen === 'sTrack', null, { polling: 50 }); await p.waitForTimeout(150); await p.locator('#voteBtn').tap(); }
    }
    await phaseIs('race');
    return async () => {
      await tv.evaluate(() => { const g = window.__game; g.setAuto(true); g.advance(60000); });
      await phaseIs('results', 'podium');
      for (const p of phones) await p.waitForFunction(() => window.__pad.screen === 'sResults' && window.__pad.menu.advance, null, { polling: 50, timeout: 20000 });
    };
  };

  const p1 = await open();
  await tv.waitForFunction(() => window.__game.seats[0].present, null, { timeout: 15000 });
  await tv.evaluate(() => window.__game.flowApi.setOpts({ laps: 2, bots: 0 }));
  await tv.waitForTimeout(800);
  // right Ctrl with a player 2 key seats nobody, on a keyboard that has never been used and on one that has
  const ctrlKeys = async () => {
    for (const k of ['ArrowLeft', 'ArrowUp', 'Enter']) { await tv.keyboard.down('ControlRight'); await tv.keyboard.press(k, { delay: 20 }); await tv.keyboard.up('ControlRight'); await tv.waitForTimeout(120); }
  };
  await ctrlKeys();
  assert.equal(await seats(), '0:pad', 'right Ctrl, keyboard never used');
  await tv.keyboard.press('ArrowUp', { delay: 40 }); // the positive case: the plain key does take it
  await tv.waitForFunction(() => window.__game.seats[1].source === 'keyboard', null, { polling: 50, timeout: 3000 });
  await tv.evaluate(() => window.__game.flowApi.free(1));
  await tv.waitForTimeout(150);
  await ctrlKeys();
  assert.equal(await seats(), '0:pad', 'right Ctrl, player 2 was on these keys earlier');
  assert.equal(await phase(), 'lobby');

  // the only phone blinks, with a key from before on its slot: with no phone left the keyboard counts, so that key must be gone
  await tv.keyboard.press('KeyE', { delay: 30 });
  await tv.waitForTimeout(200);
  await gone(p1, 0);
  assert.equal(await phase(), 'lobby', 'the key from before starts nobody, alone either');
  await back(p1, 0);
  await tv.waitForTimeout(300);

  const p2 = await open();
  await tv.waitForFunction(() => window.__game.seats[1].source === 'pad', null, { timeout: 15000 });
  await tv.waitForTimeout(800);
  const phones = [p1, p2];

  // the lobby: E pressed on Player 1's slot, then that phone blinks. Nobody pressed anything now
  await tv.keyboard.press('KeyE', { delay: 30 });
  await tv.waitForTimeout(200);
  await gone(p1, 0);
  assert.equal(await phase(), 'lobby', 'the key from before starts nobody');
  // and one pressed now on the seat of a phone that is away is nobody's while the other phone is at the table
  await tv.keyboard.press('KeyE', { delay: 30 });
  await tv.waitForTimeout(200);
  assert.equal(await phase(), 'lobby', 'that seat is a phone\'s, not the keyboard\'s');
  await back(p1, 0);

  // a championship's results: Enter on Player 2's slot back in the lobby, nobody presses Continue, Player 2's phone blinks
  await tv.keyboard.press('Enter', { delay: 30 });
  await tv.waitForTimeout(200);
  assert.equal(await phase(), 'lobby');
  let finish = await toResults(phones, 'gp');
  await finish();
  await tv.waitForTimeout(700);
  await gone(p2, 1);
  assert.equal(await phase(), 'results', 'nobody pressed, nobody moved on');
  assert.deepEqual(await tv.evaluate(() => window.__game.seats.map((s) => s.go)), [false, false, false, false]);
  await tv.keyboard.press('Enter', { delay: 30 });
  await tv.waitForTimeout(200);
  assert.equal(await phase(), 'results', 'a key on the seat of a phone that is away does not speak for everyone');
  // the positive case on the same screen: the phone that is here is enough, alone
  await back(p2, 1);
  await gone(p2, 1);
  await p1.waitForFunction(() => window.__pad.menu.advance?.of === 1 && !document.getElementById('resNext').classList.contains('held'), null, { polling: 50 });
  await p1.locator('#resNext').tap();
  await phaseIs('loading', 'race');
  await phaseIs('race');
  // a key on a free slot during the race is nobody's in the next lobby
  await back(p2, 1);
  const before = await tv.evaluate(() => window.__game.frames);
  await tv.keyboard.press('KeyO', { delay: 30 });
  await tv.waitForFunction((n) => window.__game.frames >= n + 3, before, { polling: 50 }); // the start of a race can hold the frames up for a second
  await tv.evaluate(() => window.__game.flowApi.quit());
  await phaseIs('lobby');
  await tv.waitForTimeout(700);
  assert.equal(await seats(), '0:pad 1:pad', 'the O from the race');
  for (const p of phones) await p.waitForFunction(() => window.__pad.screen === 'sLobby', null, { polling: 50 });

  // a single race: Player 1 skips to the podium, and the second tap of a double tap lands on nothing
  finish = await toResults(phones, 'race');
  await finish();
  await p1.waitForFunction(() => !document.getElementById('resNext').classList.contains('held'), null, { polling: 50 });
  await p1.locator('#resMoreBtn').tap();
  const box = await p1.locator('#resSkip').boundingBox();
  const spot = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await p1.touchscreen.tap(spot.x, spot.y);
  await phaseIs('podium');
  await p1.waitForFunction(() => window.__pad.menu.advance?.kind === 'rematch', null, { polling: 20 });
  assert.equal(await p1.locator('#resBtns').isVisible(), false, 'the choices of the screen before are gone from under the finger');
  await p1.touchscreen.tap(spot.x, spot.y); // the same finger, the same place
  await tv.waitForTimeout(400);
  assert.equal(await phase(), 'podium', 'the podium stays');
  await p1.evaluate(() => { if (document.getElementById('resBtns').checkVisibility()) document.getElementById('resClose').click(); });
  // the positive case: once it has held its moment, the same tap does what it says
  await p1.waitForFunction(() => !document.getElementById('resNext').classList.contains('held'), null, { polling: 50 });
  await p1.locator('#resMoreBtn').tap();
  await p1.locator('#resSkip').tap();
  await phaseIs('loading', 'race');
  assert.deepEqual(errors, []);
});

test('the keyboard alone on the real TV page: it takes a seat, goes through every screen and on from the results, and a shortcut does nothing', { skip: !headlessShell() && 'no browser', timeout: 200000 }, async (t) => {
  const dist = mkdtempSync(join(tmpdir(), 'rk-advance-kb-'));
  execFileSync(process.execPath, ['build.mjs'], { cwd: ROOT, env: { ...process.env, DIST: dist }, stdio: 'ignore' });
  const srv = await startServer({ distDir: dist });
  const browser = await launch('swiftshader');
  t.after(async () => { await browser.close(); await srv.close(); rmSync(dist, { recursive: true, force: true }); });
  const tv = await (await browser.newContext({ viewport: { width: 640, height: 360 }, locale: 'en-US' })).newPage();
  const errors = [];
  tv.on('pageerror', (e) => errors.push(e.message));
  await tv.goto(`${srv.base}/?lang=en&manual=1&flyover=0&countdown=0`);
  await tv.waitForFunction(() => window.__game?.ready || window.__game?.error, null, { timeout: 60000 });
  // the menu guard counts in capped frames: on the CPU rasteriser nothing here may cost a frame
  await tv.evaluate(() => { const g = window.__game; g.renderer.frame = () => {}; g.ui.tick = () => {}; g.flowApi.setOpts({ laps: 2, bots: 1 }); });
  const phaseIs = (...want) => tv.waitForFunction((list) => list.includes(window.__game.phase), want, { timeout: 120000, polling: 50 });
  // a screen's first moment takes no key, and on the CPU rasteriser that moment can be long: press until it has counted
  const pressUntil = async (done, arg) => {
    for (let n = 0; n < 40 && !(await tv.evaluate(done, arg)); n++) { await tv.keyboard.press('KeyE', { delay: 40 }); await tv.waitForTimeout(300); }
    assert.ok(await tv.evaluate(done, arg), String(done));
  };
  await tv.waitForTimeout(1500); // the lobby's own first moment
  await tv.keyboard.down('Meta');
  await tv.keyboard.press('KeyE', { delay: 40 });
  await tv.keyboard.up('Meta');
  await tv.waitForTimeout(300);
  assert.equal(await tv.evaluate(() => window.__game.seats.some((s) => s.present)), false, 'Cmd+E is not a player');
  assert.equal(await tv.evaluate(() => window.__game.phase), 'lobby');
  await pressUntil(() => window.__game.phase === 'pick');
  assert.equal(await tv.evaluate(() => window.__game.seats[0].source), 'keyboard');
  await pressUntil(() => window.__game.seats[0].ready || window.__game.phase === 'vote');
  await phaseIs('vote');
  await pressUntil(() => window.__game.seats[0].lock || window.__game.phase !== 'vote');
  await phaseIs('race');
  await tv.evaluate(() => { const g = window.__game; g.setAuto(true); g.advance(40000); });
  await phaseIs('results');
  assert.equal(await tv.evaluate(() => document.querySelector('.readybar').classList.contains('hide')), true, 'no phones: nothing to count');
  await pressUntil(() => window.__game.phase === 'podium');
  await pressUntil(() => window.__game.phase === 'loading' || window.__game.phase === 'race');
  assert.deepEqual(errors, []);
});

// What the players asked for with an iPhone and an Android in hand: "dopo una gara deve anche permettermi di uscire dal telefono".
// Two phone pages and nobody at the TV: not a key, not a click on it. Player 2, who does not hold the options, takes the evening
// on from the results: More, Change track, a new race on another track, then More, Back to the lobby.
test('two phones and nobody at the TV: race, results, Player 2\'s More, Change track, a new race, then Player 2 back to the lobby', { skip: !headlessShell() && 'no browser', timeout: 280000 }, async (t) => {
  const dist = mkdtempSync(join(tmpdir(), 'rk-guest-ways-'));
  await buildDist(dist);
  const srv = await startServerProcess({ dist });
  const browser = await launch('swiftshader');
  t.after(async () => { await browser.close(); await srv.close(); rmSync(dist, { recursive: true, force: true }); });
  const tv = await (await browser.newContext({ viewport: { width: 640, height: 360 }, locale: 'en-US' })).newPage();
  const errors = [];
  tv.on('pageerror', (e) => errors.push(e.message));
  await tv.goto(`${srv.base}/?lang=en&manual=1&flyover=0&countdown=0`);
  await tv.waitForFunction(() => window.__game?.ready || window.__game?.error, null, { timeout: 60000 });
  // the race runs stepped and unpainted; the TV page counts every key and pointer it gets, to show there were none
  await tv.evaluate(() => {
    window.__game.renderer.frame = () => {};
    window.__touched = 0;
    for (const ev of ['keydown', 'pointerdown', 'mousedown', 'click']) addEventListener(ev, () => { window.__touched++; }, true);
  });
  const phaseIs = (...want) => tv.waitForFunction((list) => list.includes(window.__game.phase), want, { timeout: 120000, polling: 50 });
  const open = async (width, height) => {
    const page = await (await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true, locale: 'en-US' })).newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${srv.base}/pad`);
    await page.waitForFunction(() => window.__pad?.joined, null, { timeout: 15000 });
    return page;
  };
  const p1 = await open(844, 390); // an iPhone on its side
  const p2 = await open(915, 412); // an Android on its side
  await tv.waitForFunction(() => window.__game.seats.filter((s) => s.present).length === 2, null, { timeout: 15000 });
  assert.deepEqual([await p1.evaluate(() => window.__pad.slot), await p2.evaluate(() => window.__pad.slot)], [0, 1]);
  const phones = [p1, p2];

  // lobby: Player 1 sets two laps and no bots, Player 2 starts
  await p1.locator('.seg[data-key="laps"] button[data-v="2"]').tap();
  for (let n = 0; n < 7; n++) { await p1.locator('.step button[data-d="-1"]').tap(); }
  await tv.waitForFunction(() => window.__game.flowApi.opts.laps === 2 && window.__game.flowApi.opts.bots === 0, null, { polling: 50 });
  await p2.locator('#goBtn').tap();
  await phaseIs('pick');
  for (const p of phones) { await p.waitForFunction(() => window.__pad.screen === 'sKart', null, { polling: 50 }); await p.waitForTimeout(150); await p.locator('#readyBtn').tap(); }
  const vote = async (other) => {
    await phaseIs('vote');
    for (const p of phones) {
      await p.waitForFunction(() => window.__pad.screen === 'sTrack' && window.__pad.carousel, null, { polling: 50 });
      await p.waitForTimeout(400); // the cards settle before a finger aims at one
      if (other) {
        // the card next to the one in front: another road than the one just raced
        const id = await p.evaluate((was) => { const c = window.__pad.carousel; const i = c.ids.indexOf(c.focus); const next = c.ids[(i + 1) % c.ids.length]; return next === was ? c.ids[(i + 2) % c.ids.length] : next; }, other);
        if (await p.evaluate((id) => window.__pad.carousel.focus !== id, id)) {
          const r = await p.evaluate((id) => window.__pad.carousel.rect(id), id);
          await p.touchscreen.tap(r.x - r.w / 2 + 8, r.y);
          await p.waitForFunction((id) => window.__pad.carousel.focus === id, id, { polling: 50, timeout: 5000 });
        }
      }
      await p.locator('#voteBtn').tap();
    }
    await phaseIs('race');
    return tv.evaluate(() => window.__game.track);
  };
  const finish = async () => {
    await tv.evaluate(() => { const g = window.__game; g.setAuto(true); g.advance(40000); });
    await phaseIs('results');
    for (const p of phones) await p.waitForFunction(() => window.__pad.screen === 'sResults' && window.__pad.menu.advance && !document.getElementById('resNext').classList.contains('held'), null, { polling: 50, timeout: 20000 });
  };
  const first = await vote(null);
  await finish();
  assert.equal(await tv.evaluate(() => window.__game.flowApi.authority()), 0, 'Player 1 is at the table and holds the options');
  assert.equal(await p2.evaluate(() => window.__pad.menu.edit), false, 'Player 2 does not');
  assert.equal(await p2.locator('#resMoreBtn').isVisible(), true, 'and still has the ways out');
  assert.match(await p2.textContent('#resMoreBtn'), /More choices.*Rematch, track, lobby/);

  // Player 2: More, then Change track
  await p2.locator('#resMoreBtn').tap();
  assert.equal(await p2.locator('#resNext').isVisible(), false, 'the big button is out of the way while the choices are open');
  await p2.locator('#resTrack').tap();
  const second = await vote(first);
  assert.notEqual(second, first, `a new race on another track: ${first}, then ${second}`);
  t.diagnostic(`first race ${first}, after Player 2's Change track ${second}`);
  await finish();

  // Player 2: More, then Back to the lobby, one tap with no championship to lose
  await p2.locator('#resMoreBtn').tap();
  await p2.locator('#resLobby').tap();
  await phaseIs('lobby');
  for (const p of phones) await p.waitForFunction(() => window.__pad.screen === 'sLobby', null, { polling: 50, timeout: 10000 });
  assert.equal(await tv.evaluate(() => window.__touched), 0, 'nobody touched the TV: no key, no click');
  assert.deepEqual(errors, []);
});
