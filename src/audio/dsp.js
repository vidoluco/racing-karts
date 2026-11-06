// Small offline DSP kit: everything that is too expensive or too fiddly as live nodes is rendered once into a
// Float32Array and played back as a buffer. Deterministic: its own PRNG, never Math.random, so the checks repeat.
export const TAU = Math.PI * 2;

export function rng32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const hash = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

export const samples = (sr, s) => Math.max(1, Math.round(sr * s));
export const midiHz = (m) => 440 * 2 ** ((m - 69) / 12);
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, k) => a + (b - a) * k;

export function fade(x, sr, inS = 0.0008, outS = 0.012) {
  const a = Math.min(x.length, samples(sr, inS)), b = Math.min(x.length, samples(sr, outS));
  for (let i = 0; i < a; i++) x[i] *= i / a;
  for (let i = 0; i < b; i++) x[x.length - 1 - i] *= i / b;
  return x;
}

export function normalize(chans, peak = 0.9) {
  let m = 0;
  for (const c of chans) for (let i = 0; i < c.length; i++) { const v = Math.abs(c[i]); if (v > m) m = v; }
  if (m > 1e-6) { const g = peak / m; for (const c of chans) for (let i = 0; i < c.length; i++) c[i] *= g; }
  return chans;
}

export function mixInto(dst, src, offset = 0, gain = 1) {
  const n = Math.min(src.length, dst.length - offset);
  for (let i = 0; i < n; i++) dst[i + offset] += src[i] * gain;
  return dst;
}

// Trapezoidal state variable filter with a moving cutoff; `fn(t)` returns Hz. The textbook Chamberlin form rings near
// Nyquist above a few kHz, which is exactly where the hisses in this game live.
export function svf(x, sr, fn, q = 1, mode = 'band') {
  const out = new Float32Array(x.length);
  const k = 1 / Math.max(0.3, q);
  let ic1 = 0, ic2 = 0;
  const fixed = typeof fn === 'number' ? fn : null;
  let g = fixed === null ? 0 : Math.tan((Math.PI * Math.min(fixed, sr * 0.45)) / sr);
  let a1 = 1 / (1 + g * (g + k)), a2 = g * a1, a3 = g * a2;
  for (let i = 0; i < x.length; i++) {
    if (fixed === null) {
      g = Math.tan((Math.PI * Math.min(fn(i / sr), sr * 0.45)) / sr);
      a1 = 1 / (1 + g * (g + k));
      a2 = g * a1;
      a3 = g * a2;
    }
    const v3 = x[i] - ic2;
    const v1 = a1 * ic1 + a2 * v3;
    const v2 = ic2 + a2 * ic1 + a3 * v3;
    ic1 = 2 * v1 - ic1;
    ic2 = 2 * v2 - ic2;
    out[i] = mode === 'band' ? v1 : mode === 'low' ? v2 : x[i] - k * v1 - v2;
  }
  return out;
}

export function noise(sr, dur, rand) {
  const x = new Float32Array(samples(sr, dur));
  for (let i = 0; i < x.length; i++) x[i] = rand() * 2 - 1;
  return x;
}

export function applyEnv(x, sr, fn) {
  for (let i = 0; i < x.length; i++) x[i] *= fn(i / sr);
  return x;
}

export const perc = (attack, decay) => (t) => (t < attack ? t / attack : Math.exp(-(t - attack) / decay));
export const hold = (attack, sustain, release) => (t) => {
  if (t < attack) return t / attack;
  if (t < attack + sustain) return 1;
  const k = 1 - (t - attack - sustain) / release;
  return k > 0 ? k : 0;
};

// A tone with a moving pitch: fn(t) in Hz. Shapes are soft on purpose, this is a cartoon, not a chiptune.
export function tone(sr, dur, fn, { shape = 'sine', env = null, gain = 1, harmonics = null } = {}) {
  const x = new Float32Array(samples(sr, dur));
  const fixed = typeof fn === 'number' ? fn : null;
  let ph = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / sr;
    ph += (fixed ?? fn(t)) / sr;
    let v;
    const p = ph - Math.floor(ph);
    if (harmonics) { v = 0; for (let h = 0; h < harmonics.length; h++) v += harmonics[h] * Math.sin(TAU * (h + 1) * p); }
    else if (shape === 'sine') v = Math.sin(TAU * p);
    else if (shape === 'tri') v = 4 * Math.abs(p - 0.5) - 1;
    else if (shape === 'saw') v = 2 * p - 1;
    else v = Math.tanh(4 * Math.sin(TAU * p));
    x[i] = v * gain * (env ? env(t) : 1);
  }
  return x;
}

// Karplus-Strong with an allpass for the fractional delay, or the top of the țambal goes audibly out of tune.
export function karplus(sr, f, dur, { t60 = 2, damp = 0.2, excite, gain = 1 } = {}) {
  const len = samples(sr, dur);
  const out = new Float32Array(len);
  const period = sr / f;
  const b = clamp(damp, 0.001, 0.49);
  let N = Math.floor(period - b - 1e-4), frac = period - b - N;
  if (frac < 0.1) { N -= 1; frac += 1; }
  N = Math.max(2, N);
  const C = (1 - frac) / (1 + frac);
  const line = new Float32Array(N);
  const g = 10 ** (-3 / (t60 * f));
  let idx = 0, prev = 0, apx = 0, apy = 0;
  const elen = excite.length;
  for (let n = 0; n < len; n++) {
    const read = line[idx];
    const lp = (1 - b) * read + b * prev;
    prev = read;
    const ap = C * lp + apx - C * apy;
    apx = lp;
    apy = ap;
    const y = ap * g + (n < elen ? excite[n] : 0);
    line[idx] = y;
    idx = idx + 1 === N ? 0 : idx + 1;
    out[n] = y * gain;
  }
  return out;
}

// A soft hammer: raised cosine pulse with some felt noise, then combed for the strike position along the string.
export function hammer(sr, width, noiseAmt, rand, combSamples = 0) {
  const n = Math.max(4, Math.round(sr * width));
  const pad = Math.max(0, Math.round(combSamples));
  const x = new Float32Array(n + pad);
  for (let i = 0; i < n; i++) x[i] = (0.5 - 0.5 * Math.cos((TAU * i) / n)) * (1 - noiseAmt + noiseAmt * (rand() * 2 - 1));
  if (pad) for (let i = x.length - 1; i >= pad; i--) x[i] -= 0.9 * x[i - pad];
  return x;
}

// One struck bar or kettle: FM for the inharmonic strike, sine partials for the body. `side` carries the ombak detune.
export function metalVoice(sr, f, dur, { decay = 1, mod = 1.41, index = 2, indexDecay = 0.02, partials = [], attack = 0.0012 } = {}) {
  const len = samples(sr, dur);
  const out = new Float32Array(len);
  const w = (TAU * f) / sr;
  for (let n = 0; n < len; n++) {
    const t = n / sr;
    const I = index * Math.exp(-t / indexDecay);
    let v = Math.sin(w * n + I * Math.sin(w * mod * n)) * Math.exp(-t / decay);
    for (let p = 0; p < partials.length; p++) {
      const [r, a, d] = partials[p];
      v += a * Math.sin(w * r * n) * Math.exp(-t / (decay * d));
    }
    out[n] = v * (t < attack ? t / attack : 1);
  }
  return out;
}

// Parallel formants, how the sheep, the cows and the little voices get a mouth.
export function formants(x, sr, list) {
  const out = new Float32Array(x.length);
  for (const [f, q, g] of list) mixInto(out, svf(x, sr, f, q, 'band'), 0, g);
  return out;
}

// Strike transients carry energy below the note that no instrument body would radiate.
export function dcBlock(x, sr, fc = 45) {
  const k = Math.exp((-TAU * fc) / sr);
  let px = 0, py = 0;
  for (let i = 0; i < x.length; i++) {
    const y = x[i] - px + k * py;
    px = x[i];
    py = y;
    x[i] = y;
  }
  return x;
}

// A seamless loop: the tail fades in over the head, so the buffer's two ends are the same signal.
export function loopify(x, sr, seconds = 0.08) {
  const n = Math.min(samples(sr, seconds), Math.floor(x.length / 3));
  const out = x.slice(0, x.length - n);
  for (let i = 0; i < n; i++) {
    const k = i / n;
    out[i] = out[i] * Math.sqrt(k) + x[x.length - n + i] * Math.sqrt(1 - k);
  }
  return out;
}
