// The instruments and the mix. Sustained instruments are live nodes, so the audio thread does the work and the game
// thread only places notes. Struck and plucked ones are rendered once per pitch into a buffer, because a physical
// string or an inharmonic bar is cheap as a loop in JS and impossible as a node graph.
import { TAU, rng32, hash, samples, clamp, lerp, fade, normalize, mixInto, svf, noise, applyEnv, perc, tone, karplus, hammer, metalVoice, dcBlock } from './dsp.js';

const CACHE_BYTES = 160 * 1024 * 1024;

export function softClipCurve(n = 8193) {
  // The shaper clamps input outside [-1, 1], so the graph feeds it at half level and this curve maps that back.
  const c = new Float32Array(n);
  const knee = 0.68, room = 0.92 - knee; // the ceiling leaves room for the overshoot of the oversampling filter
  for (let i = 0; i < n; i++) {
    const x = ((i / (n - 1)) * 2 - 1) * 2;
    const m = Math.abs(x);
    c[i] = Math.sign(x) * (m < knee ? m : knee + room * Math.tanh((m - knee) / room));
  }
  return c;
}

function makeImpulse(ctx, seconds = 1.9) {
  const sr = ctx.sampleRate, len = samples(sr, seconds);
  const buf = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const rand = rng32(1234 + ch * 77);
    const d = new Float32Array(len);
    const pre = samples(sr, 0.016);
    let lo = 0;
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / sr;
      // highs die sooner than lows, as in a wooden room or a valley, never a tin can
      const k = lerp(0.62, 0.07, Math.min(1, t / 1.1));
      lo += k * (rand() * 2 - 1 - lo);
      d[i] = lo * Math.exp(-t / 0.42) * (t < 0.008 ? t / 0.008 : 1);
    }
    for (const [ms, a] of ch ? [[13, 0.5], [29, 0.33], [47, 0.2]] : [[17, 0.48], [23, 0.34], [41, 0.22]]) d[samples(sr, ms / 1000)] += a;
    buf.copyToChannel(d, ch);
  }
  return buf;
}

// ---------- wave tables ----------
const sharp = (n, slope, extra = () => 1) => Array.from({ length: n }, (_, i) => (1 / (i + 1) ** slope) * extra(i + 1));
const WAVES = {
  // free reed: nearly a pulse, rich, a ripple from the reed chamber
  reed: sharp(22, 0.72, (h) => 1 + 0.35 * Math.sin(h * 1.3)),
  reedSoft: sharp(12, 1.0, (h) => 1 + 0.25 * Math.sin(h * 1.1)),
  // cylinder bore: the even harmonics nearly vanish in the low register, less so above the break
  clarLow: sharp(19, 0.9, (h) => (h % 2 ? 1 : 0.06)),
  clarHigh: sharp(13, 1.2, (h) => (h % 2 ? 1 : 0.28)),
  tuba: [1, 0.72, 0.5, 0.33, 0.22, 0.14, 0.09, 0.06, 0.04, 0.025],
  // Helmholtz motion of a bowed string is a saw; the small dips are the bowing point
  bow: sharp(40, 1, (h) => Math.abs(Math.sin((h * Math.PI) / 7.3)) * 0.6 + 0.4),
  flute: [1, 0.14, 0.07, 0.025],
};

// ---------- buffer instruments ----------
function renderTambal(sr, f) {
  const rand = rng32(hash(`tam${Math.round(f)}`));
  const t60 = clamp(lerp(3.2, 0.95, Math.log2(f / 130) / 3.5), 0.8, 3.4);
  const dur = clamp(t60 * 1.15, 1, 3.4);
  const damp = clamp(0.08 + 0.1 * Math.log2(f / 130), 0.06, 0.34);
  const hit = (w) => hammer(sr, w, 0.3, rand, sr / f / 7);
  const a = karplus(sr, f * 2 ** (-1.5 / 1200), dur, { t60, damp, excite: hit(0.0011) });
  const b = karplus(sr, f * 2 ** (0.4 / 1200), dur, { t60: t60 * 0.92, damp, excite: hit(0.0013) });
  const c = karplus(sr, f * 2 ** (1.7 / 1200), dur, { t60: t60 * 1.06, damp, excite: hit(0.001) });
  // undamped neighbours ring along faintly: the halo that makes a real cimbalom sound big
  const exSoft = hammer(sr, 0.003, 0.2, rand);
  const s1 = karplus(sr, f * 2, dur, { t60: t60 * 1.5, damp: 0.1, excite: exSoft, gain: 0.05 });
  const s2 = karplus(sr, f * 1.5, dur, { t60: t60 * 1.3, damp: 0.1, excite: exSoft, gain: 0.035 });
  const L = new Float32Array(a.length), R = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) {
    L[i] = a[i] + 0.65 * b[i] + s1[i] + 0.4 * s2[i];
    R[i] = c[i] + 0.65 * b[i] + 0.4 * s1[i] + s2[i];
  }
  // the beater on the wood: a dull knock under the string
  const knock = applyEnv(svf(noise(sr, 0.03, rand), sr, 420, 1.2), sr, perc(0.0004, 0.006));
  mixInto(L, knock, 0, 0.5);
  mixInto(R, knock, 0, 0.5);
  dcBlock(L, sr, 70);
  dcBlock(R, sr, 70);
  normalize([L, R], 0.82);
  fade(L, sr, 0.0002, 0.03);
  fade(R, sr, 0.0002, 0.03);
  return [L, R];
}

function renderBassPluck(sr, f) {
  const rand = rng32(hash(`bass${Math.round(f)}`));
  const ex = hammer(sr, 0.0065, 0.1, rand, sr / f / 5);
  const x = karplus(sr, f, 1.4, { t60: 1.5, damp: 0.42, excite: ex });
  // string bass has its energy an octave up from the fundamental on small speakers: a little growl helps it read
  const y = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) y[i] = Math.tanh(1.4 * x[i]);
  dcBlock(y, sr, 32);
  normalize([y], 0.85);
  fade(y, sr, 0.0005, 0.08);
  return [y];
}

const BAR = {
  // bronze bars over bamboo: a strong fundamental, a thin 2.76 mode, a very quick clang
  gangsa: { decay: 0.62, mod: 2.76, index: 1.5, indexDecay: 0.011, partials: [[2.76, 0.16, 0.34], [5.4, 0.05, 0.14]], ombak: 6.5, dur: 1.5, peak: 0.8 },
  // kettle gongs: nearly harmonic modes, a nasal attack, a shorter tail
  reyong: { decay: 0.34, mod: 2.02, index: 1.8, indexDecay: 0.012, partials: [[2.01, 0.26, 0.6], [3.03, 0.1, 0.32], [4.2, 0.05, 0.2]], ombak: 4.5, dur: 1.1, peak: 0.8 },
  // the slow low keys
  jegogan: { decay: 1.1, mod: 1.0, index: 0.9, indexDecay: 0.025, partials: [[2.0, 0.38, 0.5], [2.76, 0.2, 0.3], [4.0, 0.1, 0.2]], ombak: 2.6, dur: 2.2, peak: 0.86 },
  // a sweet high bell for the menu
  bell: { decay: 0.58, mod: 3.51, index: 1.2, indexDecay: 0.014, partials: [[2.76, 0.12, 0.3], [5.4, 0.04, 0.12]], ombak: 3.2, dur: 1.6, peak: 0.78 },
};

function renderBar(kind, sr, f) {
  const p = BAR[kind];
  const a = metalVoice(sr, f - p.ombak / 2, p.dur, p);
  const b = metalVoice(sr, f + p.ombak / 2, p.dur, { ...p, index: p.index * 0.9 });
  const L = new Float32Array(a.length), R = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) { L[i] = a[i] + 0.7 * b[i]; R[i] = b[i] + 0.7 * a[i]; }
  // the wooden mallet, there and gone
  const rand = rng32(hash(`${kind}${Math.round(f)}`));
  const tick = applyEnv(svf(noise(sr, 0.012, rand), sr, Math.min(4200, f * 3), 1.4), sr, perc(0.0002, 0.0016));
  mixInto(L, tick, 0, 0.3);
  mixInto(R, tick, 0, 0.3);
  dcBlock(L, sr, f * 0.5);
  dcBlock(R, sr, f * 0.5);
  normalize([L, R], p.peak);
  fade(L, sr, 0.0002, 0.05);
  fade(R, sr, 0.0002, 0.05);
  return [L, R];
}

function gongVoice(sr, f, dur, { decay, ombak, wah = 0, modes = [] }) {
  const len = samples(sr, dur);
  const L = new Float32Array(len), R = new Float32Array(len);
  let pa = 0, pb = 0;
  const ph = modes.map(() => [0, 0]);
  for (let n = 0; n < len; n++) {
    const t = n / sr;
    // the bronze bends down a touch as it settles: the note a gong is remembered for
    const bend = 1 + wah * Math.exp(-t / 0.18);
    pa += (TAU * (f - ombak / 2) * bend) / sr;
    pb += (TAU * (f + ombak / 2) * bend) / sr;
    const e = Math.exp(-t / decay) * (t < 0.01 ? t / 0.01 : 1);
    let l = Math.sin(pa) * e, r = Math.sin(pb) * e;
    for (let m = 0; m < modes.length; m++) {
      const [rt, a, d, delay] = modes[m];
      ph[m][0] += (TAU * (f - ombak / 2) * rt) / sr;
      ph[m][1] += (TAU * (f + ombak / 2) * rt) / sr;
      const em = a * Math.exp(-t / (decay * d)) * (delay ? Math.min(1, t / delay) : 1);
      l += Math.sin(ph[m][0]) * em;
      r += Math.sin(ph[m][1]) * em;
    }
    L[n] = l + 0.65 * r;
    R[n] = r + 0.65 * l;
  }
  return [L, R];
}

export function renderGong(sr, f, opts, seed) {
  const rand = rng32(seed);
  const [L, R] = gongVoice(sr, f, opts.dur, opts);
  const thump = applyEnv(svf(noise(sr, 0.09, rand), sr, f * 3, 0.9, 'low'), sr, perc(0.002, 0.02));
  mixInto(L, thump, 0, opts.thump ?? 0.5);
  mixInto(R, thump, 0, opts.thump ?? 0.5);
  normalize([L, R], opts.peak ?? 0.9);
  fade(L, sr, 0.0005, 0.25);
  fade(R, sr, 0.0005, 0.25);
  return [L, R];
}

function metallicNoise(sr, dur, ratios, base) {
  const x = new Float32Array(samples(sr, dur));
  for (const r of ratios) {
    const w = base * r / sr;
    let p = r * 0.137;
    for (let i = 0; i < x.length; i++) { p += w; x[i] += p - Math.floor(p) < 0.5 ? 1 : -1; }
  }
  return x;
}

// Percussion voices: name -> (sr, rand) -> channels. All rendered once, all short.
const PERC = {
  kick(sr) {
    const x = tone(sr, 0.32, (t) => 48 + 95 * Math.exp(-t / 0.028), { env: (t) => Math.exp(-t / 0.11) * (t < 0.0015 ? t / 0.0015 : 1) });
    const click = tone(sr, 0.01, 1900, { env: (t) => Math.exp(-t / 0.0015), gain: 0.16 });
    return [fade(mixInto(x, click), sr, 0.0002, 0.02)];
  },
  snare(sr, rand) {
    // a wire brush on a small snare: a light tap with a long fizz, nothing like a rock backbeat
    const body = tone(sr, 0.16, (t) => 190 + 40 * Math.exp(-t / 0.02), { env: perc(0.001, 0.035), gain: 0.5 });
    const fizz = applyEnv(svf(noise(sr, 0.2, rand), sr, 3400, 0.7, 'band'), sr, perc(0.001, 0.05));
    return [fade(mixInto(fizz, body, 0, 1), sr, 0.0002, 0.02)];
  },
  hat(sr, rand) {
    const x = metallicNoise(sr, 0.07, [2, 3, 4.16, 5.43, 6.79, 8.21], 400);
    const hi = svf(x, sr, 8000, 1, 'high');
    const n = noise(sr, 0.07, rand);
    mixInto(hi, svf(n, sr, 9000, 1, 'high'), 0, 1);
    return [fade(applyEnv(hi, sr, perc(0.0004, 0.014)), sr, 0.0002, 0.006)];
  },
  shaker(sr, rand) {
    const x = svf(noise(sr, 0.06, rand), sr, 6500, 1.1, 'band');
    return [fade(applyEnv(x, sr, (t) => (t < 0.012 ? t / 0.012 : Math.exp(-(t - 0.012) / 0.012))), sr, 0.0002, 0.006)];
  },
  rim(sr) {
    const a = tone(sr, 0.05, 1720, { env: perc(0.0002, 0.006) });
    mixInto(a, tone(sr, 0.05, 480, { env: perc(0.0002, 0.012) }), 0, 0.7);
    return [fade(a, sr, 0.0001, 0.004)];
  },
  clap(sr, rand) {
    const n = svf(noise(sr, 0.14, rand), sr, 1500, 1.2);
    const bursts = (t) => (t < 0.03 ? (Math.floor(t / 0.0105) % 2 ? 0.25 : 1) : 1) * Math.exp(-Math.max(0, t - 0.03) / 0.03);
    return [fade(applyEnv(n, sr, bursts), sr, 0.0002, 0.008)];
  },
  tok(sr) {
    const a = tone(sr, 0.07, 820, { env: perc(0.0003, 0.012) });
    mixInto(a, tone(sr, 0.07, 1650, { env: perc(0.0002, 0.005), gain: 0.5 }));
    return [fade(a, sr, 0.0001, 0.006)];
  },
  jingle(sr, rand) {
    // sleigh bells: a handful of tiny bells that never strike quite together
    const x = new Float32Array(samples(sr, 0.22));
    for (let b = 0; b < 7; b++) {
      const f = 3200 + rand() * 3800, off = samples(sr, rand() * 0.024);
      mixInto(x, tone(sr, 0.18, f, { env: perc(0.0004, 0.022 + rand() * 0.03), gain: 0.32 }), off);
    }
    return [fade(x, sr, 0.0002, 0.015)];
  },
  // the Alpine bell: bent sheet iron, a low clank with partials nowhere near a chord, and the clapper
  cowHi(sr, rand) { return cowbell(sr, rand, 640); },
  cowLo(sr, rand) { return cowbell(sr, rand, 430); },
  ceng(sr, rand) {
    const x = metallicNoise(sr, 0.13, [1, 1.47, 2.11, 2.83, 3.67, 4.77], 1180);
    const hi = svf(x, sr, 4800, 0.9, 'high');
    mixInto(hi, svf(noise(sr, 0.13, rand), sr, 6000, 1, 'high'), 0, 1.2);
    return [fade(applyEnv(hi, sr, perc(0.0005, 0.024)), sr, 0.0002, 0.01)];
  },
  // kendang: a tuned head that drops when struck, opened with the palm or slapped with the fingers
  dag(sr, rand) { return kendang(sr, rand, 128, 0.09, 0.05, 0.16); },
  tut(sr, rand) { return kendang(sr, rand, 226, 0.06, 0.08, 0.1); },
  pak(sr, rand) { return kendang(sr, rand, 410, 0.018, 0.9, 0.05); },
  ket(sr, rand) { return kendang(sr, rand, 640, 0.012, 0.55, 0.035); },
  gong(sr) { return renderGong(sr, 62, { dur: 5.5, decay: 1.5, ombak: 2.4, wah: 0.02, thump: 0.42, modes: [[2.02, 0.42, 0.6, 0.02], [2.71, 0.2, 0.38], [4.13, 0.09, 0.18], [5.36, 0.05, 0.1]] }, 11); },
  kempur(sr) { return renderGong(sr, 168, { dur: 2.6, decay: 0.72, ombak: 3.2, wah: 0.012, thump: 0.28, modes: [[1.98, 0.3, 0.5], [2.71, 0.16, 0.3], [4.2, 0.06, 0.16]] }, 12); },
  kemong(sr) { return renderGong(sr, 470, { dur: 1.2, decay: 0.3, ombak: 4, wah: 0, thump: 0.12, modes: [[2.03, 0.22, 0.5], [3.1, 0.08, 0.3]] }, 13); },
};

function cowbell(sr, rand, f) {
  const x = new Float32Array(samples(sr, 0.5));
  for (const [r, a, d] of [[1, 1, 0.12], [1.51, 0.72, 0.09], [2.27, 0.45, 0.05], [3.13, 0.3, 0.03], [4.34, 0.14, 0.018]]) {
    mixInto(x, tone(sr, 0.5, f * r, { env: perc(0.0006, d) }), 0, a);
  }
  const clap = applyEnv(svf(noise(sr, 0.02, rand), sr, 2600, 1.4), sr, perc(0.0002, 0.003));
  mixInto(x, clap, 0, 1.1);
  for (let i = 0; i < x.length; i++) x[i] = Math.tanh(x[i] * 1.2);
  normalize([x], 0.85);
  return [fade(x, sr, 0.0002, 0.02)];
}

function kendang(sr, rand, f, decay, slap, dur) {
  const x = tone(sr, dur + 0.05, (t) => f * (1 + 0.32 * Math.exp(-t / 0.014)), { harmonics: [1, 0.25, 0.1], env: perc(0.0008, decay) });
  const n = applyEnv(svf(noise(sr, 0.04, rand), sr, f * 4.2, 1.6), sr, perc(0.0002, 0.007));
  mixInto(x, n, 0, slap);
  normalize([x], 0.86);
  return [fade(x, sr, 0.0002, 0.012)];
}

// ---------- the synth object ----------
export const VOICE_INSTRUMENTS = ['accordion', 'squeeze', 'clarinet', 'tuba', 'fiddle', 'kontra', 'nai', 'suling'];
export const BUFFER_INSTRUMENTS = ['tambal', 'bassPluck', 'gangsa', 'reyong', 'jegogan', 'bell'];
export const PERC_VOICES = Object.keys(PERC);
export const renderPerc = (name, sr) => PERC[name](sr, rng32(hash(name)));

export function createMix(ctx) {
  const master = ctx.createGain();
  const pre = ctx.createGain();
  pre.gain.value = 0.5; // the shaper's input domain, see softClipCurve
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -5;
  comp.knee.value = 6;
  comp.ratio.value = 6;
  comp.attack.value = 0.005;
  comp.release.value = 0.18;
  const shaper = ctx.createWaveShaper();
  shaper.curve = softClipCurve();
  shaper.oversample = '2x';
  master.connect(comp).connect(pre).connect(shaper).connect(ctx.destination);

  const reverb = ctx.createConvolver();
  reverb.buffer = makeImpulse(ctx);
  const wet = ctx.createGain();
  wet.gain.value = 1.8;
  reverb.connect(wet).connect(master);

  const group = (v) => { const g = ctx.createGain(); g.gain.value = v; g.connect(master); return g; };
  // each group has its own door into the reverb that moves with its fader, or music at zero would leave its echo behind
  const door = (v) => { const g = ctx.createGain(); g.gain.value = v; g.connect(reverb); return g; };
  const duck = ctx.createGain();
  const music = group(0.44), sfx = group(1), engine = group(0.42);
  duck.connect(music);
  const sends = { music: door(0.44), sfx: door(1), engine: door(0.42) };
  return { master, music, musicIn: duck, duck, sfx, engine, reverb, wet, comp, sends, dispose() { try { master.disconnect(); shaper.disconnect(); } catch { /* already gone */ } } };
}

export function createSynth(ctx, mix) {
  const sr = ctx.sampleRate;
  const waves = {};
  const wave = (name) => {
    if (waves[name]) return waves[name];
    const amps = WAVES[name];
    const imag = new Float32Array(amps.length + 1), real = new Float32Array(amps.length + 1);
    for (let i = 0; i < amps.length; i++) imag[i + 1] = amps[i];
    waves[name] = ctx.createPeriodicWave(real, imag);
    return waves[name];
  };
  const noiseBuf = ctx.createBuffer(1, samples(sr, 2.2), sr);
  noiseBuf.copyToChannel(noise(sr, 2.2, rng32(99)), 0);
  let seq = 0;

  // ---------- buffers, by pitch, kept until the budget runs out ----------
  const cache = new Map();
  let cacheBytes = 0;
  const toBuffer = (chans) => {
    const b = ctx.createBuffer(chans.length, chans[0].length, sr);
    chans.forEach((c, i) => b.copyToChannel(c, i));
    return b;
  };
  function store(key, chans) {
    const b = toBuffer(chans);
    cache.set(key, b);
    cacheBytes += b.length * b.numberOfChannels * 4;
    for (const [k, v] of cache) {
      if (cacheBytes <= CACHE_BYTES) break;
      if (k === key) continue;
      cacheBytes -= v.length * v.numberOfChannels * 4;
      cache.delete(k);
    }
    return b;
  }
  const keyOf = (inst, f, voice) => (voice ? `p:${voice}` : `${inst}:${Math.round(f * 8)}`);
  function bufferFor(inst, f, voice) {
    const key = keyOf(inst, f, voice);
    const got = cache.get(key);
    if (got) { cache.delete(key); cache.set(key, got); return got; }
    if (voice) {
      const fn = PERC[voice];
      if (!fn) return null;
      return store(key, fn(sr, rng32(hash(voice))));
    }
    if (inst === 'tambal') return store(key, renderTambal(sr, f));
    if (inst === 'bassPluck') return store(key, renderBassPluck(sr, f));
    if (BAR[inst]) return store(key, renderBar(inst, sr, f));
    return null;
  }

  // ---------- a part: stereo reed sides, a body, a pan, a reverb send ----------
  const BODIES = {
    accordion: [['peaking', 950, 1.0, 3.5], ['peaking', 2300, 1.4, 1.5], ['highshelf', 4800, 0.7, -9], ['lowpass', 7500, 0.7, 0]],
    squeeze: [['highpass', 170, 0.7, 0], ['peaking', 800, 0.9, 2], ['highshelf', 3000, 0.7, -9], ['lowpass', 5200, 0.7, 0]],
    clarinet: [['highpass', 140, 0.7, 0], ['peaking', 1450, 1.1, 3], ['peaking', 2900, 1.6, -2], ['lowpass', 6200, 0.7, 0]],
    tuba: [['peaking', 240, 1.1, 3], ['lowpass', 2400, 0.7, 0]],
    // the fiddle's character is its box: the air mode, the wood mode, the bridge hill
    fiddle: [['highpass', 190, 0.9, 0], ['peaking', 285, 3.2, 5], ['peaking', 480, 3, 3.5], ['peaking', 1150, 1.3, -2.5], ['peaking', 2750, 1.2, 5], ['highshelf', 5200, 0.7, -9], ['lowpass', 8200, 0.7, 0]],
    kontra: [['highpass', 180, 0.8, 0], ['peaking', 340, 2, 4], ['peaking', 900, 1, -2], ['peaking', 2300, 1.2, 2], ['lowpass', 4600, 0.7, 0]],
    nai: [['highpass', 220, 0.7, 0], ['highshelf', 6000, 0.7, -3]],
    suling: [['highpass', 260, 0.7, 0], ['peaking', 3000, 1, 1.5]],
    tambal: [['peaking', 300, 1.1, 1.5], ['highshelf', 6500, 0.7, -3]],
    bassPluck: [['peaking', 110, 1.2, 3], ['lowpass', 1900, 0.7, 0]],
    gangsa: [['peaking', 3000, 1, -1], ['highshelf', 7000, 0.7, -5]],
    reyong: [['highshelf', 6000, 0.7, -4]],
    jegogan: [['lowpass', 2600, 0.7, 0]],
    bell: [['highshelf', 8000, 0.7, -3]],
  };

  function makePart(cfg, out) {
    const inst = cfg.inst;
    const input = ctx.createGain();
    let head = input;
    for (const [type, f, q, g] of BODIES[inst] ?? []) {
      const b = ctx.createBiquadFilter();
      b.type = type;
      b.frequency.value = f;
      b.Q.value = q;
      b.gain.value = g;
      head.connect(b);
      head = b;
    }
    const level = ctx.createGain();
    level.gain.value = cfg.gain ?? 0.5;
    const pan = ctx.createStereoPanner();
    pan.pan.value = cfg.pan ?? 0;
    head.connect(level).connect(pan).connect(out);
    const send = ctx.createGain();
    send.gain.value = cfg.send ?? 0.12;
    pan.connect(send).connect(mix.sends.music);
    const width = cfg.width ?? 0.5;
    const L = ctx.createStereoPanner(); L.pan.value = -width; L.connect(input);
    const R = ctx.createStereoPanner(); R.pan.value = width; R.connect(input);
    // a bellows never holds still: the whole hand breathes, slower than any note
    let bellows = null;
    if (inst === 'accordion' || inst === 'squeeze') {
      bellows = ctx.createOscillator();
      bellows.frequency.value = cfg.breath ?? 0.31;
      const depth = ctx.createGain();
      depth.gain.value = (cfg.gain ?? 0.5) * 0.07;
      bellows.connect(depth).connect(level.gain);
      bellows.start();
    }
    return {
      inst, cfg, input, L, R, level, pan, send, bellows,
      dispose(when = 0) {
        try { bellows?.stop(when); } catch { /* already stopped */ }
      },
      disconnect() {
        for (const n of [input, L, R, level, pan, send]) { try { n.disconnect(); } catch { /* gone */ } }
      },
    };
  }

  // ---------- voice helpers ----------
  function amp(t, attack, peak, sustainLevel, decay, off, release) {
    const g = ctx.createGain();
    const p = g.gain;
    p.setValueAtTime(0, t);
    p.linearRampToValueAtTime(peak, t + attack);
    const after = t + attack + decay;
    if (decay > 0 && after < off) p.linearRampToValueAtTime(peak * sustainLevel, after);
    p.setValueAtTime(after < off ? peak * sustainLevel : peak, off);
    p.linearRampToValueAtTime(0, off + release);
    return g;
  }
  function osc(type, f, t, stop, detune = 0) {
    const o = ctx.createOscillator();
    if (WAVES[type]) o.setPeriodicWave(wave(type)); else o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (detune) o.detune.setValueAtTime(detune, t);
    o.start(t);
    o.stop(stop);
    return o;
  }
  function breath(t, stop, fc, q, peakEnv) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    s.loop = true;
    const b = ctx.createBiquadFilter();
    b.type = 'bandpass';
    b.frequency.value = fc;
    b.Q.value = q;
    s.connect(b).connect(peakEnv);
    s.start(t, (seq++ * 0.137) % 2);
    s.stop(stop);
    return s;
  }
  function vibrato(o, t, stop, rate, cents, delay) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = rate * (1 + ((seq++ * 7) % 11) * 0.006);
    const d = ctx.createGain();
    d.gain.setValueAtTime(0, t);
    d.gain.setValueAtTime(0, t + delay);
    d.gain.linearRampToValueAtTime(cents, t + delay + 0.25);
    lfo.connect(d);
    for (const x of Array.isArray(o) ? o : [o]) d.connect(x.detune);
    lfo.start(t);
    lfo.stop(stop);
  }

  // ---------- sustained voices ----------
  const VOICES = {
    accordion(part, n) {
      const { t, dur, f, vel, slide } = n;
      const off = t + Math.max(0.05, dur * 0.94);
      const stop = off + 0.08;
      const lvl = vel * 0.3;
      const held = off - t > 0.2;
      // the reeds speak, then the bellows settle and push again: the dip after the attack is what reads as breath
      const bellowsEnv = (k) => {
        const g = ctx.createGain();
        const p = g.gain;
        p.setValueAtTime(0, t);
        p.linearRampToValueAtTime(lvl * k, t + 0.012);
        if (held) {
          p.linearRampToValueAtTime(lvl * k * 0.84, t + 0.09);
          p.linearRampToValueAtTime(lvl * k * (0.92 + 0.08 * vel), off);
        } else {
          p.setValueAtTime(lvl * k, off);
        }
        p.linearRampToValueAtTime(0, off + 0.05);
        return g;
      };
      const a = osc('reed', f, t, stop, -7), b = osc('reed', f, t, stop, 8), c = osc('reedSoft', f / 2, t, stop, 1);
      if (slide) for (const o of [a, b]) { o.frequency.setValueAtTime(f * 0.96, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.05); }
      // the two reeds sit apart in the stereo field, so the musette shimmer becomes space and not only beating
      a.connect(bellowsEnv(1)).connect(part.L);
      b.connect(bellowsEnv(1)).connect(part.R);
      c.connect(bellowsEnv(0.34)).connect(part.input);
      if (off - t > 0.5) vibrato([a, b], t, stop, 4.6, 3, 0.25);
    },
    squeeze(part, n) {
      const { t, dur, f, vel } = n;
      const off = t + Math.max(0.05, Math.min(dur * 0.72, 0.42));
      const stop = off + 0.06;
      const g = amp(t, 0.008, vel * 0.25, 0.75, 0.05, off, 0.04);
      const a = osc('reedSoft', f, t, stop, -6), b = osc('reedSoft', f, t, stop, 6);
      a.connect(g); b.connect(g);
      g.connect(part.input);
    },
    clarinet(part, n) {
      const { t, dur, f, vel, slide } = n;
      const off = t + Math.max(0.05, dur * 0.96);
      const stop = off + 0.1;
      const g = ctx.createGain();
      const lvl = vel * 0.48;
      const p = g.gain;
      p.setValueAtTime(0, t);
      p.linearRampToValueAtTime(lvl * 1.08, t + 0.024);
      p.linearRampToValueAtTime(lvl * 0.94, Math.min(off, t + 0.07));
      p.setValueAtTime(lvl * 0.94, off);
      p.linearRampToValueAtTime(0, off + 0.05);
      const o = osc(f < 480 ? 'clarLow' : 'clarHigh', f, t, stop);
      o.frequency.setValueAtTime(f * (slide ? 0.94 : 0.992), t);
      o.frequency.exponentialRampToValueAtTime(f, t + (slide ? 0.09 : 0.03));
      o.connect(g);
      // the air through the reed: mostly at the front of the note, a little all along
      const bg = ctx.createGain();
      const bp = bg.gain;
      bp.setValueAtTime(0, t);
      bp.linearRampToValueAtTime(lvl * 0.34, t + 0.012);
      bp.linearRampToValueAtTime(lvl * 0.075, t + 0.06);
      bp.setValueAtTime(lvl * 0.075, off);
      bp.linearRampToValueAtTime(0, off + 0.05);
      breath(t, stop, Math.min(4200, f * 4), 1.1, bg);
      bg.connect(part.input);
      g.connect(part.input);
      if (off - t > 0.32) vibrato(o, t, stop, 5.1, 11, 0.16);
    },
    tuba(part, n) {
      const { t, dur, f, vel } = n;
      const off = t + Math.max(0.08, Math.min(dur * 0.82, 0.9));
      const stop = off + 0.1;
      const g = amp(t, 0.022, vel * 0.8, 0.72, 0.09, off, 0.07);
      const o = osc('tuba', f, t, stop);
      o.frequency.setValueAtTime(f * 0.975, t);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.035);
      // the lips open with the note: the blat at the front is most of what says brass
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.value = 0.9;
      lp.frequency.setValueAtTime(f * 2.5, t);
      lp.frequency.linearRampToValueAtTime(f * 8.5, t + 0.035);
      lp.frequency.exponentialRampToValueAtTime(f * 4.2, t + 0.17);
      o.connect(lp).connect(g);
      g.connect(part.input);
    },
    fiddle(part, n) {
      const { t, dur, f, vel, slide } = n;
      const off = t + Math.max(0.04, dur * 0.97);
      const stop = off + 0.1;
      const short = dur < 0.2;
      const lvl = vel * (short ? 0.33 : 0.38);
      const g = ctx.createGain();
      const p = g.gain;
      p.setValueAtTime(0, t);
      p.linearRampToValueAtTime(lvl, t + (short ? 0.009 : 0.03));
      if (!short) p.linearRampToValueAtTime(lvl * 0.9, Math.min(off, t + 0.1));
      p.setValueAtTime(short ? lvl : lvl * 0.9, off);
      p.linearRampToValueAtTime(0, off + (short ? 0.025 : 0.05));
      const a = osc('bow', f, t, stop), b = osc('bow', f, t, stop, 5);
      const bg = ctx.createGain();
      bg.gain.value = 0.42;
      if (slide) for (const o of [a, b]) { o.frequency.setValueAtTime(f * 0.93, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.075); }
      a.connect(g);
      b.connect(bg).connect(g);
      // the hair on the string: a burst at the attack and a hush behind every long note
      const ng = ctx.createGain();
      const np = ng.gain;
      np.setValueAtTime(0, t);
      np.linearRampToValueAtTime(lvl * 0.3, t + 0.006);
      np.linearRampToValueAtTime(lvl * (short ? 0.03 : 0.045), t + 0.04);
      np.setValueAtTime(lvl * (short ? 0.03 : 0.045), off);
      np.linearRampToValueAtTime(0, off + 0.03);
      breath(t, stop, Math.min(5200, f * 3.3), 0.9, ng);
      ng.connect(part.input);
      g.connect(part.input);
      if (off - t > 0.26) vibrato([a, b], t, stop, 5.9, 21, 0.13);
    },
    kontra(part, n) {
      const { t, dur, f, vel } = n;
      const off = t + Math.max(0.05, Math.min(dur * 0.68, 0.22));
      const stop = off + 0.06;
      const g = amp(t, 0.006, vel * 0.26, 0.55, 0.055, off, 0.035);
      const o = osc('bow', f, t, stop, ((seq++ % 5) - 2) * 2);
      o.connect(g);
      g.connect(part.input);
    },
    nai(part, n) { flute(part, n, 0.36, 5, 12, 0.5, 0.06, 0.05); },
    suling(part, n) { flute(part, n, 0.34, 6.2, 15, 0.42, 0.04, 0.03); },
  };

  function flute(part, n, level, vibHz, vibCents, air, scoop, attack) {
    const { t, dur, f, vel, slide } = n;
    const off = t + Math.max(0.06, dur * 0.97);
    const stop = off + 0.14;
    const lvl = vel * level;
    const g = ctx.createGain();
    const p = g.gain;
    p.setValueAtTime(0, t);
    p.linearRampToValueAtTime(lvl, t + attack);
    p.setValueAtTime(lvl, off);
    p.linearRampToValueAtTime(0, off + 0.08);
    const o = osc('flute', f, t, stop);
    // a pan flute note arrives from below as the lip finds the pipe
    o.frequency.setValueAtTime(f * (slide ? 0.9 : 0.985), t);
    o.frequency.exponentialRampToValueAtTime(f, t + (slide ? 0.13 : scoop));
    o.connect(g);
    g.connect(part.input);
    // breath tuned to the pipe, plus a wide hiss, plus a chiff that speaks the note
    const pipe = ctx.createGain();
    const pp = pipe.gain;
    pp.setValueAtTime(0, t);
    pp.linearRampToValueAtTime(lvl * air * 1.3, t + 0.018);
    pp.linearRampToValueAtTime(lvl * air, t + 0.09);
    pp.setValueAtTime(lvl * air, off);
    pp.linearRampToValueAtTime(0, off + 0.08);
    breath(t, stop, f, 9, pipe);
    pipe.connect(part.input);
    const hiss = ctx.createGain();
    const hp = hiss.gain;
    hp.setValueAtTime(0, t);
    hp.linearRampToValueAtTime(lvl * 0.14, t + 0.01);
    hp.linearRampToValueAtTime(lvl * 0.035, t + 0.06);
    hp.setValueAtTime(lvl * 0.035, off);
    hp.linearRampToValueAtTime(0, off + 0.06);
    breath(t, stop, Math.min(6200, f * 5), 0.8, hiss);
    hiss.connect(part.input);
    if (off - t > 0.34) vibrato(o, t, stop, vibHz, vibCents, 0.2);
  }

  // How long a struck voice keeps ringing past its written note: gamelan players damp with the other hand.
  const DAMP = { gangsa: [2.1, 0.12], reyong: [2.4, 0.09], jegogan: [3, 0.4], bell: [5, 0.3], tambal: [9, 0.5], bassPluck: [1.15, 0.16] };

  // ---------- one note ----------
  function note(part, ev, t) {
    const inst = part.inst;
    const when = Math.max(t, ctx.currentTime);
    const n = { t: when, dur: ev.durS, f: ev.f, vel: ev.vel, slide: ev.slide };
    const v = VOICES[inst];
    if (v) { v(part, n); return; }
    const buf = bufferFor(inst, ev.f, ev.voice);
    if (!buf) return;
    const s = ctx.createBufferSource();
    s.buffer = buf;
    const g = ctx.createGain();
    const gain = ev.vel * (ev.voice ? 0.9 : 0.8);
    g.gain.setValueAtTime(gain, when);
    const damp = !ev.voice && DAMP[inst];
    let end = when + buf.duration;
    if (damp) {
      const off = when + Math.max(damp[1], ev.durS * damp[0]);
      if (off < end - 0.05) {
        g.gain.setValueAtTime(gain, off);
        g.gain.linearRampToValueAtTime(0, off + 0.045);
        end = off + 0.05;
      }
    }
    s.connect(g).connect(part.input);
    s.start(when);
    s.stop(end);
  }

  return {
    ctx, mix, wave, noiseBuf, makePart, note, bufferFor,
    warmKey: (ev, inst) => (VOICES[inst] ? null : keyOf(inst, ev.f, ev.voice)),
    warm: (ev, inst) => { if (!VOICES[inst]) bufferFor(inst, ev.f, ev.voice); },
    hasKey: (key) => cache.has(key),
    cacheBytes: () => cacheBytes,
  };
}

