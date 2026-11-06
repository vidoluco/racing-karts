// An agent cannot listen, so it measures. Renders every tune, every effect and every kart engine through the real code in
// a headless OfflineAudioContext (tools/harness.mjs), then reports peak, RMS, silence, clipping, the click at the loop
// seam, how each tune moves through register and section, whether the instruments are where they should be in the
// spectrum, and whether the music leaves room for the effects. Writes WAVs and spectrogram PNGs into docs/audio/.
//
//   node tools/audio-check.mjs                     everything, report on stdout, docs/audio/report.json
//   node tools/audio-check.mjs --only bran,menu    just these tunes (no effects, no engines)
//   node tools/audio-check.mjs --no-wav            skip writing the audio files
//   node tools/audio-check.mjs --stems bali        the level of each part against the whole band, then exit
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { launch } from './harness.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT = join(ROOT, 'docs/audio');
export const SR = 44100;
const AUTOPLAY = ['--autoplay-policy=no-user-gesture-required'];

// ---------- the page side ----------
const ENTRY = `
import { createAudio } from ${JSON.stringify(join(ROOT, 'src/audio/index.js'))};
import { TUNES, LOOPING } from ${JSON.stringify(join(ROOT, 'src/audio/music/index.js'))};
import { compile, lint } from ${JSON.stringify(join(ROOT, 'src/audio/score.js'))};
import { SFX, DRIVERS } from ${JSON.stringify(join(ROOT, 'src/audio/sfx.js'))};
import { KART_SOUND } from ${JSON.stringify(join(ROOT, 'src/audio/engine.js'))};

const SR = ${SR};

function floats(buffer) {
  return [buffer.getChannelData(0), buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : buffer.getChannelData(0)];
}

function stats(L, R) {
  let peak = 0, sum = 0, hot = 0, over = 0;
  for (let i = 0; i < L.length; i++) {
    const a = Math.abs(L[i]), b = Math.abs(R[i]);
    const m = a > b ? a : b;
    if (m > peak) peak = m;
    if (m > 0.9) hot++;
    if (m >= 0.999) over++;
    sum += L[i] * L[i] + R[i] * R[i];
  }
  return { peak, rms: Math.sqrt(sum / (2 * L.length)), hot: hot / L.length, over };
}

// 16 bit PCM as base64, in chunks small enough for the string builder
function pcm16(L, R) {
  const n = L.length;
  const out = new Int16Array(n * 2);
  for (let i = 0; i < n; i++) {
    out[i * 2] = Math.max(-1, Math.min(1, L[i])) * 32767;
    out[i * 2 + 1] = Math.max(-1, Math.min(1, R[i])) * 32767;
  }
  const bytes = new Uint8Array(out.buffer);
  let s = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return btoa(s);
}

async function renderWith(seconds, drive, opts = {}) {
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * SR), SR);
  const hooks = {};
  const audio = createAudio({ context: ctx, hooks, horizon: 1.2, ...opts });
  audio.unlock();
  await drive(audio, hooks, ctx);
  const buf = await ctx.startRendering();
  return floats(buf);
}

// Advance the offline clock in steps with a suspend at each: the same placing of notes the live timer does.
function everyStep(ctx, seconds, step, fn) {
  for (let t = step; t < seconds; t += step) {
    ctx.suspend(t).then(() => { try { fn(t); } finally { ctx.resume(); } });
  }
}

window.RK = {
  list() {
    return {
      tunes: Object.keys(TUNES), looping: LOOPING, sfx: Object.keys(SFX), karts: Object.keys(KART_SOUND), drivers: Object.keys(DRIVERS),
    };
  },
  lintAll() {
    const out = {};
    for (const [k, t] of Object.entries(TUNES)) out[k] = lint(t);
    return out;
  },
  async tune(name, { pcm = true } = {}) {
    const tune = TUNES[name];
    const score = compile(tune);
    const loop = (score.totalBeats * 60) / tune.tempo;
    const seconds = tune.once ? loop + 5.5 : loop + 8;
    const t0 = performance.now();
    const [L, R] = await renderWith(seconds, async (audio, hooks, ctx) => {
      audio.music(name);
      hooks.pump();
      everyStep(ctx, seconds, 0.5, () => hooks.pump());
    });
    return {
      name, seconds, loop, once: !!tune.once, tempo: tune.tempo, beats: tune.beats, marks: score.marks, bars: score.bars,
      notes: score.events.length, renderMs: performance.now() - t0,
      stats: stats(L, R), pcm: pcm16(L, R),
    };
  },
  // How loud each part is alone, against the whole band: a mix table for someone who cannot hear the mix.
  async stems(name) {
    const tune = TUNES[name];
    const score = compile(tune);
    const seconds = Math.min(34, (score.totalBeats * 60) / tune.tempo + 1);
    const parts = [...new Set(score.events.map((e) => e.part))];
    const rmsOf = async (solo) => {
      const [L, R] = await renderWith(seconds, async (audio, hooks, ctx) => {
        audio.music(name);
        hooks.pump();
        everyStep(ctx, seconds, 0.5, () => hooks.pump());
      }, solo ? { solo } : {});
      return stats(L, R).rms;
    };
    const all = await rmsOf(null);
    const out = {};
    for (const p of parts) out[p] = +(20 * Math.log10((await rmsOf([p])) / all + 1e-9)).toFixed(1);
    return out;
  },
  async sfx(name) {
    const dur = 5;
    let shot = false;
    const [L, R] = await renderWith(dur, async (audio, hooks) => {
      // not at zero: the master's compressor takes a moment to wake, and a click at t = 0 would measure quieter than it is
      hooks.rt.sfx.fire(name, { gain: 1, pan: 0, wet: 1, when: 0.4 });
      shot = true;
    });
    // trim the tail that is pure silence
    let end = L.length;
    while (end > 1 && Math.abs(L[end - 1]) < 1e-4 && Math.abs(R[end - 1]) < 1e-4) end--;
    const l = L.slice(0, Math.min(L.length, end + 200)), r = R.slice(0, Math.min(L.length, end + 200));
    return { name, fired: shot, seconds: l.length / SR, stats: stats(l, r), pcm: pcm16(l, r) };
  },
  // the same kart at rest, climbing, flat out and boosting, one voice, as in a one player race
  async engine(id) {
    const dur = 6;
    const [L, R] = await renderWith(dur, async (audio, hooks, ctx) => {
      const state = (t) => {
        const speed = Math.min(30, Math.max(0, (t - 0.8) * 9));
        return {
          t, phase: 'race',
          karts: [{ i: 0, kart: id, human: true, x: 0, z: 0, yaw: 0, vx: 0, vz: -speed, speed, grounded: true, throttle: 1, surface: 'asphalt', boostT: t > 4.5 ? 1 : 0, boostKind: t > 4.5 ? 'pad' : null }],
        };
      };
      audio.onEvents([], state(0), [0]);
      audio.update(state(0), 1 / 60);
      everyStep(ctx, dur, 1 / 30, (t) => audio.update(state(t), 1 / 30));
    });
    return { name: id, seconds: dur, stats: stats(L, R), pcm: pcm16(L, R) };
  },
  // One instrument alone, a slow scale over its range then a fast figure: what each one is made of, for the eye.
  async gallery(inst) {
    const notes = { accordion: 57, squeeze: 52, clarinet: 52, tuba: 36, fiddle: 57, kontra: 52, nai: 67, suling: 67, tambal: 57, bassPluck: 40, gangsa: 62, reyong: 62, jegogan: 40, bell: 72 };
    const dur = 7;
    const [L, R] = await renderWith(dur, async (audio, hooks) => {
      const r = hooks.rt;
      const part = r.synth.makePart({ inst, gain: 0.8, send: 0.1 }, r.mix.musicIn);
      r.mix.music.gain.value = 1;
      const m0 = notes[inst] ?? 60;
      const steps = [0, 4, 7, 12, 16, 19, 24];
      steps.forEach((k, i) => {
        r.synth.note(part, { f: 440 * 2 ** ((m0 + k - 69) / 12), vel: 0.9, durS: 0.5 }, 0.1 + i * 0.55);
      });
      for (let i = 0; i < 12; i++) {
        r.synth.note(part, { f: 440 * 2 ** ((m0 + 12 + (i % 4) * 2 - 69) / 12), vel: 0.8, durS: 0.12 }, 4.1 + i * 0.13);
      }
      r.synth.note(part, { f: 440 * 2 ** ((m0 + 7 - 69) / 12), vel: 1, durS: 1.1 }, 5.8);
    });
    return { name: inst, stats: stats(L, R), pcm: pcm16(L, R) };
  },
  // The whole game at once: a tune, an engine at speed and a busy race's worth of effects. Does the master hold?
  async race(name) {
    const dur = 24;
    const script = [
      [2, { type: 'boxTake', kart: 0, item: 'razzo' }], [3.4, { type: 'itemUse', kart: 0, item: 'razzo' }], [4.4, { type: 'boom', x: 12, z: -30, kind: 'razzo' }],
      [5, { type: 'hit', kart: 0, kind: 'tumble', cause: 'razzo' }], [6.2, { type: 'driftStart', kart: 0 }], [6.9, { type: 'driftTier', kart: 0, tier: 1 }],
      [7.6, { type: 'driftTier', kart: 0, tier: 2 }], [8.4, { type: 'boost', kart: 0, kind: 'drift' }], [9, { type: 'itemUse', kart: 0, item: 'rendang' }],
      [10, { type: 'jump', kart: 0 }], [10.8, { type: 'land', kart: 0, force: 7 }], [11.2, { type: 'wall', kart: 0, force: 8 }], [11.5, { type: 'bump', a: 0, b: 1, force: 7 }],
      [12, { type: 'itemUse', kart: 0, item: 'grappa' }], [13, { type: 'lap', kart: 0, lap: 1 }], [14, { type: 'boom', x: 2, z: -3, kind: 'razzo' }],
      [14.1, { type: 'itemUse', kart: 0, item: 'uova' }], [15, { type: 'hazardNear', kart: 0, kind: 'cows' }], [16, { type: 'lastLap', kart: 0 }], [18, { type: 'itemUse', kart: 0, item: 'formaggio' }],
      [19, { type: 'itemUse', kart: 0, item: 'sambal' }], [20, { type: 'overtake', kart: 0, place: 2 }], [21, { type: 'finish', kart: 0, place: 1, time: 90 }],
    ];
    const state = (t) => ({
      t, phase: 'race',
      karts: [
        { i: 0, kart: 'jeep', human: true, x: 0, z: -t * 28, yaw: 0, vx: 0, vz: -28, speed: 28, grounded: true, throttle: 1, surface: t > 12 ? 'dirt' : 'asphalt', drift: t > 6.2 && t < 8.4 ? 1 : 0, driftTier: t > 7.6 ? 2 : t > 6.9 ? 1 : 0, boostT: t > 14 && t < 16 ? 1 : 0, boostKind: t > 14 && t < 16 ? 'uova' : null, bigT: t > 14 && t < 16 ? 1 : 0 },
        { i: 1, kart: 'tabia', human: false, x: 4, z: -t * 28 - 12, yaw: 0, vx: 0, vz: -28, speed: 28, grounded: true, surface: 'asphalt' },
      ],
      shots: t > 3.4 && t < 4.4 ? [{ kind: 'razzo', x: 1, z: -t * 28 - 8 }] : [],
    });
    const [L, R] = await renderWith(dur, async (audio, hooks, ctx) => {
      audio.music(name);
      audio.onEvents([], state(0), [0]);
      hooks.pump();
      let next = 0;
      everyStep(ctx, dur, 1 / 30, (t) => {
        const s = state(t);
        const due = [];
        while (next < script.length && script[next][0] <= t) { const e = script[next++][1]; due.push(e); }
        if (due.length) audio.onEvents(due, s, [0]);
        audio.update(s, 1 / 30);
      });
    });
    return { name, stats: stats(L, R), pcm: pcm16(L, R) };
  },
  // The real thing on a live context with the main thread choking: blocks of 250 ms every 350 ms, far worse than any
  // game frame. Every note must still be placed ahead of the clock, and last lap must really be quicker.
  async live(name, seconds = 6) {
    const hooks = {};
    const audio = createAudio({ hooks });
    audio.unlock();
    audio.music(name);
    const t0 = performance.now();
    while (!hooks.rt?.player?.started && performance.now() - t0 < 6000) await new Promise((r) => setTimeout(r, 10));
    const warmMs = performance.now() - t0;
    const r = hooks.rt;
    if (r.ctx.state !== 'running') await r.ctx.resume().catch(() => {});
    const orig = r.synth.note;
    let placed = 0, minLead = Infinity;
    r.synth.note = (part, ev, t) => { placed++; minLead = Math.min(minLead, t - r.ctx.currentTime); orig(part, ev, t); };
    const start = performance.now();
    const beat0 = r.player.beat;
    let longestFrame = 0;
    while (performance.now() - start < seconds * 1000) {
      const b = performance.now();
      while (performance.now() - b < 250) { /* the game hogging the thread */ }
      audio.update({}, 0.016);
      await new Promise((res) => setTimeout(res, 100));
      longestFrame = Math.max(longestFrame, performance.now() - b);
    }
    const score = compile(TUNES[name]);
    const beats = r.player.beat - beat0;
    const elapsed = (performance.now() - start) / 1000;
    const beatPerSec = beats / elapsed;
    const expected = score.events.filter((e) => e.beat < beats).length;
    audio.lastLap(true);
    const b1 = r.player.beat, t1 = r.ctx.currentTime;
    await new Promise((res) => setTimeout(res, 1500));
    const fastRate = (r.player.beat - b1) / (r.ctx.currentTime - t1);
    const state = r.ctx.state;
    audio.dispose();
    return { warmMs, state, placed, expected, minLead, beatPerSec, tempoBps: TUNES[name].tempo / 60, fastRate };
  },
  // Changing tune mid bar: no gap, no click. Then the volume groups really do what they say.
  async change() {
    const [L, R] = await renderWith(9, async (audio, hooks, ctx) => {
      audio.music('menu');
      hooks.pump();
      everyStep(ctx, 9, 0.25, (t) => {
        if (Math.abs(t - 4) < 0.01) audio.music('bali');
        hooks.pump();
      });
    });
    const x = new Float32Array(L.length);
    for (let i = 0; i < x.length; i++) x[i] = 0.5 * (L[i] + R[i]);
    let jumpNear = 0, jumpAll = 0;
    const at = 4 * SR;
    for (let i = 1; i < x.length; i++) {
      const d = Math.abs(x[i] - x[i - 1]);
      if (i < at - 0.1 * SR) { if (d > jumpAll) jumpAll = d; } else if (i < at + 0.1 * SR && d > jumpNear) jumpNear = d;
    }
    const render = async (group) => {
      const [l] = await renderWith(6, async (audio, hooks, ctx) => {
        audio.music('antelao');
        hooks.pump();
        if (group) audio.setVolume(group, 0);
        everyStep(ctx, 6, 0.25, () => hooks.pump());
      });
      let s = 0;
      for (let i = SR; i < l.length; i++) s += l[i] * l[i];
      return Math.sqrt(s / (l.length - SR));
    };
    const dryWet = async (name) => {
      const once = async (wetOnly) => {
        const [l] = await renderWith(12, async (audio, hooks, ctx) => {
          audio.music(name);
          hooks.pump();
          if (wetOnly) hooks.rt.mix.music.disconnect(); else hooks.rt.mix.wet.disconnect();
          everyStep(ctx, 12, 0.25, () => hooks.pump());
        });
        let s = 0;
        for (let i = SR; i < l.length; i++) s += l[i] * l[i];
        return s;
      };
      return +(10 * Math.log10((await once(true)) / (await once(false)))).toFixed(1);
    };
    const wetDb = {};
    for (const n of ['antelao', 'transfagarasan', 'bali']) wetDb[n] = await dryWet(n);
    const full = await render(null);
    const quietMusic = await render('music');
    const quietMaster = await render('master');
    return { peak: stats(L, R).peak, jumpNear, jumpAll, full, quietMusic, quietMaster, wetDb };
  },
  // the API survives nonsense, and stays silent before unlock
  async robust() {
    const problems = [];
    const a = createAudio();
    const quietHooks = {};
    const c = createAudio({ hooks: quietHooks });
    c.music('bali');
    c.onEvents([{ type: 'go' }], {}, [0]);
    c.update({ karts: [{ i: 0, human: true, kart: 'jeep', speed: 20 }] }, 0.016);
    if (quietHooks.rt) problems.push('before unlock: an audio context exists');
    const tryIt = (label, fn) => { try { fn(); } catch (e) { problems.push(label + ': ' + e.message); } };
    tryIt('music before', () => a.music('bali'));
    tryIt('events before', () => a.onEvents([{ type: 'hit' }], {}, [0]));
    tryIt('update before', () => a.update({}, 0.016));
    tryIt('volume before', () => a.setVolume('music', 0.4));
    tryIt('lastLap before', () => a.lastLap(true));
    const offline = new OfflineAudioContext(2, SR, SR);
    const hooks = {};
    const b = createAudio({ context: offline, hooks });
    tryIt('unlock', () => b.unlock());
    const nasty = [null, undefined, 3, 'x', {}, { type: 'hit' }, { type: 'hit', kart: 99 }, { type: 'boom' }, { type: 'bump', a: 77 }, { type: 'itemUse', kart: 0, item: 'banana' }, { type: 'hazardNear', kart: 0 }, { type: 'finish', kart: 0 }, { type: 'nonsense' }];
    tryIt('events null state', () => b.onEvents(nasty, null, null));
    tryIt('events odd views', () => b.onEvents(nasty, { karts: [null, {}] }, [0, 5]));
    tryIt('update empty', () => b.update({}, NaN));
    tryIt('update odd', () => b.update({ karts: [{}, null, { kart: 'nobody', speed: 'fast' }] }, 1 / 60));
    tryIt('update null', () => b.update(null, null));
    tryIt('music unknown', () => b.music('no such tune'));
    tryIt('music null', () => b.music(null));
    tryIt('music region', () => b.music('romania'));
    tryIt('volume odd', () => { b.setVolume('nope', 3); b.setVolume('music', 'x'); b.setVolume(0.5); });
    tryIt('lastLap', () => { b.lastLap(true); b.lastLap(true); b.lastLap(false); });
    tryIt('dispose', () => { b.dispose(); b.dispose(); });
    tryIt('after dispose', () => { b.music('bali'); b.update({}, 0.1); b.onEvents([{ type: 'go' }], {}, []); });
    return { problems, apiKeys: Object.keys(a).sort() };
  },
};
`;

async function bundle() {
  const { build } = await import('esbuild');
  const r = await build({
    stdin: { contents: ENTRY, resolveDir: ROOT, loader: 'js' }, bundle: true, format: 'iife', write: false, logLevel: 'silent', target: 'es2022',
  });
  return r.outputFiles[0].text;
}

// ---------- the node side: analysis ----------
function decode(pcmB64) {
  const b = Buffer.from(pcmB64, 'base64');
  const pcm = new Int16Array(b.buffer, b.byteOffset, b.length >> 1);
  const n = pcm.length >> 1;
  const L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) { L[i] = pcm[i * 2] / 32768; R[i] = pcm[i * 2 + 1] / 32768; }
  return { L, R, n, bytes: b };
}

function writeWav(path, bytes) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + bytes.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(bytes.length, 40);
  writeFileSync(path, Buffer.concat([h, bytes]));
}

// iterative radix 2
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}

const N_FFT = 4096;
const WIN = Float32Array.from({ length: N_FFT }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N_FFT));
function frameMag(x, start) {
  const re = new Float64Array(N_FFT), im = new Float64Array(N_FFT);
  for (let i = 0; i < N_FFT; i++) re[i] = (x[start + i] ?? 0) * WIN[i];
  fft(re, im);
  const m = new Float64Array(N_FFT / 2);
  for (let i = 0; i < m.length; i++) m[i] = Math.hypot(re[i], im[i]);
  return m;
}

const mixDown = (L, R) => { const x = new Float32Array(L.length); for (let i = 0; i < L.length; i++) x[i] = 0.5 * (L[i] + R[i]); return x; };

// Average spectrum in 24 log bands from 50 Hz to 12.8 kHz (third octaves), as power.
const BANDS = Array.from({ length: 25 }, (_, i) => 50 * 2 ** (i / 3));
function bandPower(mag) {
  const out = new Float64Array(BANDS.length - 1);
  const hz = SR / N_FFT;
  for (let b = 0; b < out.length; b++) {
    const a = Math.max(1, Math.floor(BANDS[b] / hz)), c = Math.max(a + 1, Math.floor(BANDS[b + 1] / hz));
    let s = 0;
    for (let i = a; i < c && i < mag.length; i++) s += mag[i] * mag[i];
    out[b] = s;
  }
  return out;
}

function analyse(x, marks = [], secPerBar = 0) {
  const hop = 2048;
  const frames = Math.max(1, Math.floor((x.length - N_FFT) / hop));
  const hz = SR / N_FFT;
  let centroidSum = 0, weight = 0;
  const avgBands = new Float64Array(BANDS.length - 1);
  const perSection = marks.map((m) => ({ name: m.name, bar: m.bar, rms: 0, cent: 0, w: 0, n: 0, low: 0, mid: 0, high: 0 }));
  const barCent = [];
  for (let f = 0; f < frames; f++) {
    const start = f * hop;
    const m = frameMag(x, start);
    let s = 0, c = 0;
    for (let i = 1; i < m.length; i++) { const p = m[i] * m[i]; s += p; c += p * i * hz; }
    if (s > 1e-6) { centroidSum += c; weight += s; }
    const bp = bandPower(m);
    for (let b = 0; b < bp.length; b++) avgBands[b] += bp[b];
    if (marks.length && secPerBar) {
      const bar = (start / SR) / secPerBar;
      if (bar < marks[marks.length - 1].bar + marks[marks.length - 1].bars) {
        let k = marks.length - 1;
        while (k > 0 && marks[k].bar > bar) k--;
        const p = perSection[k];
        p.rms += s; p.cent += c; p.w += s; p.n += 1;
        for (let i = 1; i < m.length; i++) {
          const hzi = i * hz, q = m[i] * m[i];
          if (hzi < 250) p.low += q; else if (hzi < 2000) p.mid += q; else p.high += q;
        }
        const bi = Math.floor(bar);
        const bc = (barCent[bi] ??= { c: 0, w: 0 });
        bc.c += c; bc.w += s;
      }
    }
  }
  for (let b = 0; b < avgBands.length; b++) avgBands[b] /= frames;
  const sectionOut = perSection.map((p) => ({
    name: p.name,
    centroid: p.w ? Math.round(p.cent / p.w) : 0,
    rmsDb: p.n ? +(10 * Math.log10(p.rms / p.n / (N_FFT * N_FFT) + 1e-12)).toFixed(1) : -120,
    low: +(p.low / (p.low + p.mid + p.high + 1e-9)).toFixed(2),
    mid: +(p.mid / (p.low + p.mid + p.high + 1e-9)).toFixed(2),
    high: +(p.high / (p.low + p.mid + p.high + 1e-9)).toFixed(2),
  }));
  const bars = barCent.map((b) => (b?.w ? b.c / b.w : 0)).filter(Boolean);
  const out = { centroid: weight ? Math.round(centroidSum / weight) : 0, avgBands: [...avgBands], sections: sectionOut };
  if (bars.length) {
    const sorted = [...bars].sort((a, b) => a - b);
    out.barCentroidP10 = Math.round(sorted[Math.floor(sorted.length * 0.1)]);
    out.barCentroidP90 = Math.round(sorted[Math.floor(sorted.length * 0.9)]);
  }
  return out;
}

// Longest stretch quieter than -50 dBFS inside the tune, in seconds; a tune must never fall out of the speakers.
function longestSilence(x, end) {
  const win = Math.round(SR * 0.02);
  let run = 0, best = 0;
  for (let i = 0; i + win < end; i += win) {
    let s = 0;
    for (let k = 0; k < win; k += 4) s += x[i + k] * x[i + k];
    const rms = Math.sqrt(s / (win / 4));
    if (rms < 0.00316) { run += 0.02; if (run > best) best = run; } else run = 0;
  }
  return best;
}

// At the loop point the signal must look like anywhere else in the tune: compare its worst sample to sample jump with
// the jumps the tune makes everywhere (the 99.99th percentile), and its loudness on both sides.
function seamCheck(x, seam) {
  const windowS = Math.round(SR * 0.012);
  let jump = 0;
  for (let i = Math.max(1, seam - windowS); i < Math.min(x.length, seam + windowS); i++) {
    const d = Math.abs(x[i] - x[i - 1]);
    if (d > jump) jump = d;
  }
  const diffs = new Float32Array(Math.floor(x.length / 3));
  for (let i = 0; i < diffs.length; i++) { const k = i * 3 + 1; diffs[i] = Math.abs(x[k] - x[k - 1]); }
  diffs.sort();
  const norm = diffs[Math.floor(diffs.length * 0.9999)];
  const rms = (a, b) => { let s = 0; for (let i = a; i < b; i++) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, b - a)); };
  const span = Math.round(SR * 0.4);
  const before = rms(Math.max(0, seam - span), seam), after = rms(seam, Math.min(x.length, seam + span));
  return { jump: +jump.toFixed(4), norm: +norm.toFixed(4), ratio: +(jump / (norm + 1e-9)).toFixed(2), before: +before.toFixed(4), after: +after.toFixed(4) };
}

// ---------- a PNG writer and the spectrogram ----------
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc32(buf) { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function png(width, height, rgb) {
  const chunk = (type, data) => {
    const t = Buffer.from(type), len = Buffer.alloc(4), crc = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
    return Buffer.concat([len, t, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const o = y * (width * 3 + 1);
    raw[o] = 0;
    rgb.copy(raw, o + 1, y * width * 3, (y + 1) * width * 3);
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]);
}
function heat(v) {
  // dark blue, magenta, orange, pale yellow: enough steps to see single notes
  const stops = [[8, 10, 30], [64, 20, 110], [170, 40, 120], [240, 110, 40], [255, 225, 130]];
  const k = Math.max(0, Math.min(0.9999, v)) * (stops.length - 1);
  const i = Math.floor(k), f = k - i;
  return stops[i].map((c, j) => c + (stops[i + 1][j] - c) * f);
}
// Log frequency from 40 Hz to 12 kHz; each semitone gets the same height, so a melody draws as a melody.
export function spectrogram(x, { width = 1800, height = 620, marks = [], secPerBar = 0 } = {}) {
  const f0 = 40, f1 = 12000;
  const buf = Buffer.alloc(width * height * 3);
  const hz = SR / N_FFT;
  const octaves = Math.log2(f1 / f0);
  for (let col = 0; col < width; col++) {
    const start = Math.floor((col / width) * Math.max(0, x.length - N_FFT));
    const m = frameMag(x, start);
    for (let y = 0; y < height; y++) {
      const f = f0 * 2 ** ((octaves * (height - 1 - y)) / (height - 1));
      const pos = f / hz;
      const i = Math.floor(pos), fr = pos - i;
      const a = (m[i] ?? 0) * (1 - fr) + (m[i + 1] ?? 0) * fr;
      // tilt up the highs a little so the top of the picture does not read as empty
      const db = 20 * Math.log10(a / (N_FFT / 4) + 1e-7) + 3.5 * Math.log2(f / 200);
      const [r, g, b] = heat((db + 62) / 58);
      const o = (y * width + col) * 3;
      buf[o] = r; buf[o + 1] = g; buf[o + 2] = b;
    }
  }
  // section marks in white, octave lines at the As
  const dur = x.length / SR;
  for (const mk of marks) {
    const px = Math.round(((mk.bar * secPerBar) / dur) * width);
    for (let y = 0; y < height; y++) { const o = (y * width + Math.min(width - 1, px)) * 3; buf[o] = 255; buf[o + 1] = 255; buf[o + 2] = 255; }
  }
  for (let a = 55; a < f1; a *= 2) {
    const y = height - 1 - Math.round((Math.log2(a / f0) / octaves) * (height - 1));
    for (let px = 0; px < width; px += 6) { const o = (y * width + px) * 3; buf[o] = 170; buf[o + 1] = 190; buf[o + 2] = 190; }
  }
  return png(width, height, buf);
}

const db = (v) => +(20 * Math.log10(v + 1e-9)).toFixed(1);

// ---------- the check ----------
export async function runCheck({ only = null, wav = true, images = true, log = console.log } = {}) {
  mkdirSync(OUT, { recursive: true });
  const code = await bundle();
  const browser = await launch('swiftshader', { extra: AUTOPLAY });
  const report = { tunes: {}, sfx: {}, engines: {}, instruments: {}, race: {}, masking: {}, lint: {}, robust: null };
  const open = async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
    await page.goto('about:blank');
    await page.addScriptTag({ content: code });
    return { page, errors, close: () => ctx.close() };
  };

  try {
    const first = await open();
    const names = await first.page.evaluate(() => window.RK.list());
    report.lint = await first.page.evaluate(() => window.RK.lintAll());
    report.robust = await first.page.evaluate(() => window.RK.robust());
    report.names = names;
    report.live = await first.page.evaluate(() => window.RK.live('bali'));
    report.change = await first.page.evaluate(() => window.RK.change());
    await first.close();

    const tunes = only ?? names.tunes;
    const pool = async (items, n, fn) => {
      const queue = [...items];
      await Promise.all(Array.from({ length: n }, async () => { while (queue.length) await fn(queue.shift()); }));
    };

    const spectra = {};
    await pool(tunes, 4, async (name) => {
      const p = await open();
      const r = await p.page.evaluate((n) => window.RK.tune(n), name);
      const { L, R, bytes } = decode(r.pcm);
      const x = mixDown(L, R);
      const secPerBar = (r.beats * 60) / r.tempo;
      if (images) {
        // the first 16 bars close up: here the single notes and the interlocking are readable
        const zoom = x.slice(0, Math.min(x.length, Math.round(secPerBar * 16 * SR)));
        writeFileSync(join(OUT, `music-${name}-zoom.png`), spectrogram(zoom, { width: 1800, height: 620 }));
      }
      const a = analyse(x, r.marks, secPerBar);
      const seamAt = Math.round(r.loop * SR);
      const seam = r.once ? null : seamCheck(x, seamAt);
      const body = r.once ? Math.round(r.loop * SR) : Math.min(x.length, seamAt);
      const silence = longestSilence(x, body);
      if (wav) writeWav(join(OUT, `music-${name}.wav`), bytes);
      if (images) writeFileSync(join(OUT, `music-${name}.png`), spectrogram(x, { marks: r.marks, secPerBar }));
      spectra[name] = a.avgBands;
      report.tunes[name] = {
        seconds: +r.seconds.toFixed(1), loop: +r.loop.toFixed(2), bars: r.bars, notes: r.notes, renderS: +(r.renderMs / 1000).toFixed(1),
        peak: +r.stats.peak.toFixed(3), peakDb: db(r.stats.peak), rmsDb: db(r.stats.rms), hot: +r.stats.hot.toFixed(5), over: r.stats.over,
        silenceS: +silence.toFixed(2), seam, centroid: a.centroid, barCentroid: [a.barCentroidP10, a.barCentroidP90], sections: a.sections, errors: p.errors.slice(0, 5),
      };
      log(`tune ${name.padEnd(15)} ${String(r.bars).padStart(3)} bars ${r.loop.toFixed(1).padStart(6)} s  peak ${r.stats.peak.toFixed(3)}  rms ${db(r.stats.rms)} dB  centroid ${a.centroid} (bars ${a.barCentroidP10}..${a.barCentroidP90})  silence ${silence.toFixed(2)} s  seam x${seam?.ratio ?? '-'}  errors ${p.errors.length}`);
      await p.close();
    });

    if (!only) {
      const p = await open();
      for (const name of names.sfx) {
        const r = await p.page.evaluate((n) => window.RK.sfx(n), name);
        const { L, R, bytes } = decode(r.pcm);
        const x = mixDown(L, R);
        const a = analyse(x);
        if (wav) writeWav(join(OUT, `sfx-${name}.wav`), bytes);
        report.sfx[name] = { seconds: +r.seconds.toFixed(2), peak: +r.stats.peak.toFixed(3), rmsDb: db(r.stats.rms), over: r.stats.over, centroid: a.centroid };
        // how loud is the effect against the tunes, band by band, over its loudest part?
        const masks = {};
        const step = 2048;
        let bestStart = 0, bestE = -1;
        for (let i = 0; i + 8192 < x.length; i += step) {
          let e = 0;
          for (let k = 0; k < 8192; k += 8) e += x[i + k] * x[i + k];
          if (e > bestE) { bestE = e; bestStart = i; }
        }
        const fx = new Float64Array(BANDS.length - 1);
        for (let j = 0; j < 4; j++) {
          const bp = bandPower(frameMag(x, bestStart + j * 1024));
          for (let b = 0; b < fx.length; b++) fx[b] += bp[b] / 4;
        }
        for (const [tune, music] of Object.entries(spectra)) {
          let above = 0, best = -200;
          for (let b = 0; b < fx.length; b++) {
            const margin = 10 * Math.log10((fx[b] + 1e-12) / (music[b] + 1e-12));
            if (margin > 3 && fx[b] > 1e-3) above += 1;
            if (fx[b] > 1e-3 && margin > best) best = margin;
          }
          masks[tune] = { bandsAbove: above, bestMarginDb: +best.toFixed(1) };
        }
        report.masking[name] = masks;
      }
      const engineBands = {};
      for (const id of names.karts) {
        const r = await p.page.evaluate((n) => window.RK.engine(n), id);
        const { L, R, bytes } = decode(r.pcm);
        const x = mixDown(L, R);
        if (wav) writeWav(join(OUT, `engine-${id}.wav`), bytes);
        if (images) writeFileSync(join(OUT, `engine-${id}.png`), spectrogram(x, { width: 900, height: 360 }));
        const a = analyse(x);
        engineBands[id] = a.avgBands;
        // the firing rate: the strongest amplitude modulation between 2 and 50 Hz, flat out
        report.engines[id] = { peak: +r.stats.peak.toFixed(3), rmsDb: db(r.stats.rms), centroid: a.centroid, fluctuation: fluctuation(x) };
      }
      // every pair of karts should differ: distance between their spectra, in dB per band
      let closest = { a: null, b: null, d: Infinity };
      const ids = Object.keys(engineBands);
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          let s = 0;
          const A = engineBands[ids[i]], B = engineBands[ids[j]];
          for (let b = 0; b < A.length; b++) s += Math.abs(10 * Math.log10((A[b] + 1e-9) / (B[b] + 1e-9)));
          const d = +(s / A.length).toFixed(1);
          if (d < closest.d) closest = { a: ids[i], b: ids[j], d };
        }
      }
      report.engineClosest = closest;
      // each instrument alone
      for (const inst of ['accordion', 'squeeze', 'clarinet', 'tuba', 'fiddle', 'kontra', 'nai', 'suling', 'tambal', 'bassPluck', 'gangsa', 'reyong', 'jegogan', 'bell']) {
        const r = await p.page.evaluate((n) => window.RK.gallery(n), inst);
        const { L, R, bytes } = decode(r.pcm);
        const x = mixDown(L, R);
        if (wav) writeWav(join(OUT, `inst-${inst}.wav`), bytes);
        if (images) writeFileSync(join(OUT, `inst-${inst}.png`), spectrogram(x, { width: 1100, height: 520 }));
        report.instruments[inst] = { peak: +r.stats.peak.toFixed(3), rmsDb: db(r.stats.rms), centroid: analyse(x).centroid };
      }
      // the whole game on the same master
      for (const name of ['bali', 'antelao']) {
        const r = await p.page.evaluate((n) => window.RK.race(n), name);
        const { L, R, bytes } = decode(r.pcm);
        const x = mixDown(L, R);
        if (wav) writeWav(join(OUT, `race-${name}.wav`), bytes);
        if (images) writeFileSync(join(OUT, `race-${name}.png`), spectrogram(x, { width: 1500, height: 520 }));
        report.race[name] = { peak: +r.stats.peak.toFixed(3), rmsDb: db(r.stats.rms), hot: +r.stats.hot.toFixed(4), over: r.stats.over };
      }
      report.sfxErrors = p.errors.slice(0, 10);
      await p.close();
    }
  } finally {
    await browser.close();
  }
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 1));
  return report;
}

function fluctuation(x) {
  // envelope from 3.5 s to 4.4 s, the flat out stretch before the boost
  const a = Math.round(3.5 * SR), b = Math.round(4.4 * SR);
  const win = 128;
  const env = [];
  for (let i = a; i + win < b; i += win) { let s = 0; for (let k = 0; k < win; k++) s += Math.abs(x[i + k]); env.push(s / win); }
  const mean = env.reduce((s, v) => s + v, 0) / env.length;
  const rate = SR / win;
  let best = 0, bestHz = 0;
  for (let hz = 2; hz <= 50; hz += 0.5) {
    let re = 0, im = 0;
    env.forEach((v, i) => { const ph = (2 * Math.PI * hz * i) / rate; re += (v - mean) * Math.cos(ph); im += (v - mean) * Math.sin(ph); });
    const m = Math.hypot(re, im) / env.length;
    if (m > best) { best = m; bestHz = hz; }
  }
  return { hz: bestHz, depth: +(best / (mean + 1e-9)).toFixed(2) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const oi = args.indexOf('--only');
  const only = oi >= 0 ? args[oi + 1].split(',') : null;
  const si = args.indexOf('--stems');
  if (si >= 0) {
    const code = await bundle();
    const browser = await launch('swiftshader');
    const page = await (await browser.newContext()).newPage();
    await page.goto('about:blank');
    await page.addScriptTag({ content: code });
    for (const name of args[si + 1].split(',')) console.log(name, JSON.stringify(await page.evaluate((n) => window.RK.stems(n), name)));
    await browser.close();
    process.exit(0);
  }
  const report = await runCheck({ only, wav: !args.includes('--no-wav') });
  if (!only) {
    console.log('\nrobust:', JSON.stringify(report.robust));
    console.log('live:', JSON.stringify(report.live));
    console.log('change:', JSON.stringify(report.change));
    console.log('race mix:', JSON.stringify(report.race));
    console.log('instruments:', JSON.stringify(report.instruments));
    console.log('engines closest pair:', JSON.stringify(report.engineClosest));
    for (const [k, e] of Object.entries(report.engines)) console.log(`engine ${k.padEnd(10)} peak ${e.peak} rms ${e.rmsDb} centroid ${e.centroid} pulse ${e.fluctuation.hz} Hz depth ${e.fluctuation.depth}`);
    for (const [k, s] of Object.entries(report.sfx)) console.log(`sfx ${k.padEnd(12)} ${String(s.seconds).padStart(5)} s  peak ${s.peak}  rms ${s.rmsDb}  centroid ${s.centroid}  over ${s.over}`);
  }
  if (!only) {
    for (const [k, m] of Object.entries(report.masking)) {
      const v = Object.values(m);
      console.log(`mask ${k.padEnd(12)} worst tune margin ${Math.min(...v.map((x) => x.bestMarginDb))} dB, bands above in the worst tune ${Math.min(...v.map((x) => x.bandsAbove))}`);
    }
  }
  for (const [k, l] of Object.entries(report.lint)) if (!only || only.includes(k)) console.log(`lint ${k.padEnd(15)} strong beats off the chord ${l.strongOffChord}/${l.strongTotal}: ${l.problems.slice(0, 6).join('; ')}`);
}

export { ROOT, OUT };
