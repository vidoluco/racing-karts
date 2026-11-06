// The ears of the project: tools/audio-check.mjs renders everything in a real OfflineAudioContext, this holds it to account.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { runCheck } from '../tools/audio-check.mjs';
import { createAudio } from '../src/audio/index.js';
import { TUNES, LOOPING } from '../src/audio/music/index.js';
import { lint, compile } from '../src/audio/score.js';

let report;
before(async () => {
  report = await runCheck({ wav: false, images: false, log: () => {} });
}, { timeout: 300000 });

test('with no audio at all (node, no gesture) the API is harmless', () => {
  const a = createAudio();
  assert.deepEqual(Object.keys(a).sort(), ['dispose', 'hush', 'lastLap', 'music', 'onEvents', 'say', 'setVolume', 'unlock', 'update', 'voice', 'voiceBusy', 'voiceStats']);
  assert.equal(a.unlock(), false);
  a.music('bali');
  a.onEvents([{ type: 'go' }, null], null, null);
  a.update(null, 0);
  a.setVolume('music', 0.2);
  a.lastLap(true);
  // and the commentary, with no pack and no context: silent, never a throw
  assert.equal(a.say({ id: 'nothing' }), false);
  a.hush();
  assert.equal(a.voiceBusy(), false);
  assert.equal(a.voiceStats().played, 0);
  a.dispose();
});

test('every tune: real length, real form, real range', () => {
  const needed = ['antelao', 'pelmo', 'transfagarasan', 'bran', 'bromo', 'bali', 'menu', 'results', 'podium'];
  for (const name of needed) assert.ok(TUNES[name], `${name} exists`);
  for (const name of LOOPING) {
    const tune = TUNES[name];
    const c = compile(tune);
    assert.ok(c.bars >= 32, `${name} has ${c.bars} bars`);
    assert.ok(new Set(c.marks.map((m) => m.name.replace(/[' ].*/, ''))).size >= 3, `${name} has an A, a B and something else`);
    const l = lint(tune);
    const lead = l.parts.lead;
    assert.ok(lead.high - lead.low >= 12, `${name}: lead spans ${lead.high - lead.low} semitones`);
    assert.ok(l.parts.bass, `${name} has a bass line`);
    assert.ok(Object.keys(l.parts).length >= 4, `${name}: at least four pitched parts`);
  }
});

test('the composer did not slip: strong beats sit on the chord, the small exceptions are chosen', () => {
  for (const [name, l] of Object.entries(report.lint)) {
    if (!l.strongTotal) continue;
    assert.ok(l.strongOffChord / l.strongTotal <= 0.12, `${name}: ${l.strongOffChord}/${l.strongTotal} off the chord: ${l.problems.join('; ')}`);
  }
});

test('no tune clips, none is silent, none clicks at the loop point, none stays in one register', () => {
  for (const [name, t] of Object.entries(report.tunes)) {
    assert.deepEqual(t.errors, [], `${name}: page errors`);
    assert.equal(t.over, 0, `${name}: ${t.over} clipped samples`);
    assert.ok(t.peak < 0.99, `${name}: peak ${t.peak}`);
    assert.ok(t.hot < 0.002, `${name}: limiter busy ${t.hot}`);
    assert.ok(t.rmsDb > -26 && t.rmsDb < -14, `${name}: rms ${t.rmsDb} dB`);
    assert.ok(t.silenceS < 0.3, `${name}: a hole of ${t.silenceS} s`);
    if (t.seam) {
      assert.ok(t.seam.ratio < 1.5, `${name}: seam jump ${t.seam.jump} against ${t.seam.norm} elsewhere`);
      assert.ok(t.seam.after > 0.25 * t.seam.before && t.seam.before > 0.25 * t.seam.after, `${name}: seam level ${t.seam.before} to ${t.seam.after}`);
    }
    if (TUNES[name] && !TUNES[name].once) {
      const [lo, hi] = t.barCentroid;
      assert.ok(hi / lo > 1.18, `${name}: brightness stays between ${lo} and ${hi} Hz`);
    }
  }
});

test('every effect sounds, and none clips', () => {
  for (const [name, s] of Object.entries(report.sfx)) {
    assert.equal(s.over, 0, `${name} clips`);
    assert.ok(s.peak < 0.99, `${name}: peak ${s.peak}`);
    assert.ok(s.peak > 0.2, `${name}: peak ${s.peak}, too quiet`);
    assert.ok(s.centroid < 8000, `${name}: centroid ${s.centroid} Hz, a hiss with no body`);
  }
  assert.ok(Object.keys(report.sfx).length >= 50, 'the catalogue is complete');
  assert.deepEqual(report.sfxErrors, []);
});

test('the music leaves room: each game effect stands out of every tune somewhere in its own spectrum', () => {
  const texture = /^tick[A-Z]/; // the kart's own rattles live under the mix on purpose
  for (const [name, m] of Object.entries(report.masking)) {
    if (texture.test(name) || name === 'move') continue;
    for (const [tune, r] of Object.entries(m)) assert.ok(r.bestMarginDb >= 1, `${name} over ${tune}: ${r.bestMarginDb} dB at best`);
  }
});

test('the whole game on one master does not clip', () => {
  for (const [name, r] of Object.entries(report.race)) {
    assert.equal(r.over, 0, `${name}: clipped ${r.over}`);
    assert.ok(r.peak < 0.99, `${name}: peak ${r.peak}`);
    assert.ok(r.rmsDb < -10, `${name}: too loud ${r.rmsDb}`);
  }
});

test('each kart sounds its own way', () => {
  assert.equal(Object.keys(report.engines).length, 11, 'the nine and the family');
  assert.ok(report.engineClosest.d >= 2, `${report.engineClosest.a} and ${report.engineClosest.b} are only ${report.engineClosest.d} dB apart`);
  for (const [id, e] of Object.entries(report.engines)) {
    assert.ok(e.peak < 0.95 && e.rmsDb > -32 && e.rmsDb < -14, `${id}: peak ${e.peak} rms ${e.rmsDb}`);
  }
});

test('a choking main thread never makes a note late, and last lap is quicker', () => {
  const l = report.live;
  assert.equal(l.state, 'running');
  assert.ok(l.minLead > 0.02, `a note was placed only ${l.minLead} s ahead of the clock`);
  assert.ok(l.placed >= l.expected * 0.95, `${l.placed} notes placed, ${l.expected} expected`);
  assert.ok(Math.abs(l.beatPerSec / l.tempoBps - 1) < 0.02, `tempo drifted: ${l.beatPerSec} against ${l.tempoBps}`);
  assert.ok(Math.abs(l.fastRate / l.tempoBps - 1.07) < 0.02, `last lap rate ${l.fastRate} against ${l.tempoBps}`);
});

test('changing tune is smooth, the volume groups work, the API takes any nonsense', () => {
  const c = report.change;
  assert.ok(c.jumpNear < c.jumpAll * 1.8, `the change jumped ${c.jumpNear}, the tune ${c.jumpAll}`);
  assert.ok(c.quietMusic < c.full * 0.02, `music at 0 still ${c.quietMusic} of ${c.full}`);
  assert.ok(c.quietMaster < c.full * 0.02, `master at 0 still ${c.quietMaster} of ${c.full}`);
  assert.deepEqual(report.robust.problems, []);
  assert.deepEqual(report.robust.apiKeys, ['dispose', 'hush', 'lastLap', 'music', 'onEvents', 'say', 'setVolume', 'unlock', 'update', 'voice', 'voiceBusy', 'voiceStats']);
});
