// The band's instruments, modelled and rendered once per pitch into a buffer, the way the gamelan of Bali already was.
// Nothing here is recorded: every note comes out of a small physical recipe (reeds that beat, a bow that slips, a lip that
// opens, a string, a bar, a skin) run in JS when the tune warms up, then played as one buffer source and one gain. That makes
// a note cheaper on the audio thread than the live oscillators, and it leaves room for the mess that makes a note sound
// played: a scoop into pitch, a wandering pressure, hair on the string, air in the pipe. Deterministic, see dsp.js.
import { TAU, rng32, hash, samples, clamp, lerp, fade, normalize, mixInto, svf, noise, applyEnv, perc, karplus, hammer, dcBlock } from './dsp.js';

const BLOCK = 32;

// ---------- small tools ----------
let WHITE = null;
const white = () => {
  if (WHITE) return WHITE;
  const r = rng32(424242);
  WHITE = new Float32Array(1 << 16);
  for (let i = 0; i < WHITE.length; i++) WHITE[i] = r() * 2 - 1;
  return WHITE;
};
const BANDS = new Map();
function bandNoise(sr, fc, q) {
  const key = `${sr}:${Math.round(fc)}:${q}`;
  let b = BANDS.get(key);
  if (!b) { b = svf(white(), sr, fc, q, 'band'); BANDS.set(key, b); }
  return b;
}
// Add looped noise under an envelope sampled once a block.
function addNoise(out, sr, src, env, offset = 0, gain = 1) {
  const n = src.length;
  let a = env(0);
  for (let b = 0; b < out.length; b += BLOCK) {
    const end = Math.min(out.length, b + BLOCK);
    const a2 = env(end / sr), da = (a2 - a) / (end - b);
    for (let i = b; i < end; i++) { out[i] += src[(i + offset) % n] * a * gain; a += da; }
  }
  return out;
}

// A slow random line through [-1, 1]: bellows, breath and bow arms never hold still.
function wander(rand, hz, dur) {
  const pts = new Float32Array(Math.ceil(dur * hz) + 3);
  for (let i = 0; i < pts.length; i++) pts[i] = rand() * 2 - 1;
  return (t) => { const x = Math.min(pts.length - 1.001, t * hz), i = x | 0, k = x - i; return pts[i] + (pts[i + 1] - pts[i]) * k * k * (3 - 2 * k); };
}

// One wave period as a table. The partials above the top of the audio are left out, so high notes do not fold back.
const TABLES = new Map();
function table(name, f, sr, amps, maxHarm = 40) {
  const nH = Math.max(1, Math.min(maxHarm, Math.floor((sr * 0.42) / f)));
  const key = `${name}:${sr}:${nH}`;
  let T = TABLES.get(key);
  if (T) return T;
  const N = 2048;
  T = new Float32Array(N + 1);
  for (let h = 1; h <= nH; h++) {
    const a = amps(h);
    if (!a) continue;
    const w = (TAU * h) / N, c = 2 * Math.cos(w);
    let s0 = 0, s1 = Math.sin(-w);
    for (let i = 0; i < N; i++) { const s = c * s0 - s1; T[i] += a * s0; s1 = s0; s0 = s; }
  }
  let m = 0;
  for (let i = 0; i < N; i++) m = Math.max(m, Math.abs(T[i]));
  for (let i = 0; i < N; i++) T[i] /= m || 1;
  T[N] = T[0];
  TABLES.set(key, T);
  return T;
}

// A table oscillator with pitch and level moving once a block.
function runTable(out, sr, T, f, pitch, amp, phase = 0, gain = 1) {
  const N = T.length - 1;
  let ph = phase, a = amp(0) * gain;
  for (let b = 0; b < out.length; b += BLOCK) {
    const end = Math.min(out.length, b + BLOCK);
    const t = b / sr;
    const w = (f * pitch(t)) / sr;
    const a2 = amp(end / sr) * gain, da = (a2 - a) / (end - b);
    for (let i = b; i < end; i++) {
      const x = ph * N, k = x | 0;
      out[i] += (T[k] + (T[k + 1] - T[k]) * (x - k)) * a;
      a += da;
      ph += w;
      if (ph >= 1) ph -= 1;
    }
  }
  return out;
}

// RBJ biquads in place, how the wood of a box or the air of a bell is painted on after the source.
function biquad(x, sr, type, f, q = 0.7, db = 0) {
  const w = (TAU * Math.min(f, sr * 0.45)) / sr, c = Math.cos(w), s = Math.sin(w), al = s / (2 * q), A = 10 ** (db / 40);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'p') { b0 = 1 + al * A; b1 = -2 * c; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * c; a2 = 1 - al / A; }
  else if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
  else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
  else {
    const r = 2 * Math.sqrt(A) * al, sign = type === 'hs' ? 1 : -1;
    b0 = A * (A + 1 + sign * (A - 1) * c + r); b1 = -sign * 2 * A * (A - 1 + sign * (A + 1) * c); b2 = A * (A + 1 + sign * (A - 1) * c - r);
    a0 = A + 1 - sign * (A - 1) * c + r; a1 = sign * 2 * (A - 1 - sign * (A + 1) * c); a2 = A + 1 - sign * (A - 1) * c - r;
  }
  b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
  let z1 = 0, z2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i], y = b0 * v + z1;
    z1 = b1 * v - a1 * y + z2;
    z2 = b2 * v - a2 * y;
    x[i] = y;
  }
  return x;
}
const paint = (x, sr, chain) => { for (const [type, f, q, db] of chain) biquad(x, sr, type, f, q, db); return x; };

// A one-pole whose cutoff follows a curve: the sound opening as the note speaks.
function opening(x, sr, fn) {
  let y = 0;
  for (let b = 0; b < x.length; b += BLOCK) {
    const c = 1 - Math.exp((-TAU * Math.min(fn(b / sr), sr * 0.45)) / sr);
    const end = Math.min(x.length, b + BLOCK);
    for (let i = b; i < end; i++) { y += c * (x[i] - y); x[i] = y; }
  }
  return x;
}

// Notes longer than the buffer loop a stretch of its sustain, its two ends crossfaded so the join is not a click.
function loopTail(x, sr, start, end, xf = 0.08) {
  const a = samples(sr, start), z = samples(sr, end), n = samples(sr, xf), span = z - a;
  for (let i = 0; i < n; i++) {
    const k = i / n, at = z - n + i;
    x[at] = x[at] * Math.sqrt(1 - k) + x[at - span] * Math.sqrt(k);
  }
  return x;
}

function finish(chans, sr, peak, loop, fadeOut = 0.03) {
  normalize(chans, peak);
  for (const c of chans) {
    if (loop) loopTail(c, sr, loop[0], loop[1]);
    fade(c, sr, 0.0003, fadeOut);
  }
  return chans;
}
const seedOf = (name, f) => hash(`${name}${Math.round(f * 8)}`);

// ---------- free reeds: the button box and the lăutar's accordion ----------
// A free reed is a beating tongue: its wave is a narrow pulse, even partials and all, and the dips in its spectrum move with the
// pulse's width. Two tongues a few cents apart give the shimmer. The pressure in the bellows moves level and, a little, pitch.
const reedAmps = (duty, slope) => (h) => (Math.abs(Math.sin(Math.PI * h * duty)) + 0.14) / h ** slope;

function reedNote(name, sr, f, o) {
  const rand = rng32(seedOf(name, f));
  const len = samples(sr, o.dur);
  const L = new Float32Array(len), R = new Float32Array(len);
  const press = wander(rand, o.waver ?? 2.6, o.dur);
  const atk = o.attack * clamp((440 / f) ** 0.4, 0.7, 1.7);
  const amp = (t) => (t < atk ? (t / atk) ** 1.4 : 1 + 0.09 * Math.exp(-(t - atk) / 0.045)) * (1 + 0.035 * press(t));
  const pitch = (t) => 2 ** ((-(o.scoop ?? 12) * Math.exp(-t / 0.016) - 1.2 * press(t)) / 1200);
  o.reeds.forEach((r, k) => {
    const T = table(`${name}${k}`, f, sr, reedAmps(r.duty, r.slope ?? 0.82), o.harm ?? 34);
    const fr = f * 2 ** (r.cents / 1200);
    const ph = rand();
    const one = new Float32Array(len);
    runTable(one, sr, T, fr, pitch, amp, ph, r.gain ?? 1);
    mixInto(L, one, 0, 1 - r.pan);
    mixInto(R, one, 0, 1 + r.pan);
  });
  // the valve opening, then the wind in the chamber
  const air = bandNoise(sr, o.airHz ?? 2300, 0.9);
  const airEnv = (t) => (o.air ?? 0.02) * (0.5 + 3.2 * Math.exp(-t / 0.02)) * (t < 0.002 ? t / 0.002 : 1);
  addNoise(L, sr, air, airEnv, Math.floor(rand() * 60000));
  addNoise(R, sr, air, airEnv, Math.floor(rand() * 60000));
  for (const c of [L, R]) {
    opening(c, sr, (t) => lerp(f * 3, o.open ?? 11000, Math.min(1, t / (atk * 2.2))));
    paint(c, sr, o.body);
    dcBlock(c, sr, Math.min(60, f * 0.5));
  }
  return finish([L, R], sr, o.peak ?? 0.84, o.loop);
}

// ---------- the bow: stick and slip on a string, then the box ----------
// The Helmholtz corner runs round the string: a saw with dips where the bow sits. It never repeats exactly (the period jitters,
// hardest at the first scrape before the string has caught), the hair hisses in time with each slip, and the vibrato drags
// every partial over the resonances of the box, which is most of why a fiddle shimmers instead of warbling.
const bowAmps = (beta, slope) => (h) => (Math.abs(Math.sin(Math.PI * h * beta)) * 0.75 + 0.25) / h ** slope;

function bowNote(name, sr, f, o) {
  const rand = rng32(seedOf(name, f));
  const len = samples(sr, o.dur);
  const x = new Float32Array(len);
  // the bow wanders along the string as the arm moves: two bow points, the sound leaning from one to the other
  const beta = o.beta ?? 0.137;
  const near = table(name, f, sr, bowAmps(beta, o.slope ?? 1.0), o.harm ?? 40);
  const far = table(`${name}F`, f, sr, bowAmps(beta * 1.42, (o.slope ?? 1.0) + 0.1), o.harm ?? 40);
  const arm = wander(rand, 3.4, o.dur), vibW = wander(rand, 1.3, o.dur), fine = wander(rand, 30, o.dur), lean = wander(rand, 2.3, o.dur);
  const vibHz = o.vibHz * (0.96 + rand() * 0.08), catchT = o.catch ?? 0.03;
  let vp = rand() * TAU, lastT = 0;
  const curve = new Float32Array(Math.ceil(len / BLOCK) + 2);
  const pitch = (t) => {
    vp += TAU * vibHz * (1 + 0.04 * vibW(t)) * (t - lastT);
    lastT = t;
    const onset = t < o.vibDelay ? 0 : Math.min(1, (t - o.vibDelay) / 0.18);
    const vib = o.vibCents * onset * (1 + 0.15 * vibW(t)) * Math.sin(vp);
    const scrape = (o.scrape ?? 16) * Math.exp(-t / catchT) * fine(t);
    const r = 2 ** ((vib + scrape + (o.drift ?? 1.2) * fine(t) + (o.scoop ?? 0) * -Math.exp(-t / 0.03)) / 1200);
    curve[Math.round((t * sr) / BLOCK)] = r;
    return r;
  };
  const amp = (t) => (t < o.attack ? t / o.attack : 1 + (o.bite ?? 0.18) * Math.exp(-(t - o.attack) / 0.05)) * (1 + 0.05 * arm(t));
  const ph = rand();
  runTable(x, sr, near, f, pitch, (t) => amp(t) * (0.62 + 0.3 * lean(t)), ph);
  runTable(x, sr, far, f, (t) => curve[Math.round((t * sr) / BLOCK)], (t) => amp(t) * (0.38 - 0.3 * lean(t)), ph);
  // hair: a hiss that pulses with each slip, plus the scrape at the start of the stroke
  const hair = bandNoise(sr, o.hairHz ?? 3200, 0.8);
  addNoise(x, sr, hair, (t) => (o.hair ?? 0.05) * (0.7 + 4 * Math.exp(-t / 0.018)) * (t < 0.002 ? t / 0.002 : 1), Math.floor(rand() * 60000));
  opening(x, sr, (t) => lerp(f * 3.2, o.open ?? 12000, Math.min(1, t / 0.05)));
  paint(x, sr, o.body);
  dcBlock(x, sr, Math.min(70, f * 0.6));
  return finish([x], sr, o.peak ?? 0.82, o.loop);
}

// ---------- reeds on a bore: the clarinet ----------
// A cylinder favours the odd partials under the register break and much less so above; the tone holes cut the top off.
function clarinetNote(name, sr, f, o) {
  const rand = rng32(seedOf(name, f));
  const len = samples(sr, o.dur);
  const x = new Float32Array(len);
  const high = f > 460;
  const T = table(`${name}${high ? 'H' : 'L'}`, f, sr, (h) => (h % 2 ? 1 / h ** (high ? 1.25 : 0.95) : (high ? 0.34 : 0.1) / h ** 0.9), 24);
  const press = wander(rand, 2.4, o.dur), vibW = wander(rand, 1.1, o.dur);
  let vp = rand() * TAU, lastT = 0;
  const pitch = (t) => {
    vp += TAU * (o.vibHz ?? 5) * (t - lastT);
    lastT = t;
    const onset = t < (o.vibDelay ?? 0.3) ? 0 : Math.min(1, (t - (o.vibDelay ?? 0.3)) / 0.25);
    return 2 ** (((o.vibCents ?? 6) * onset * (1 + 0.2 * vibW(t)) * Math.sin(vp) - (o.scoop ?? 12) * Math.exp(-t / 0.02) + 1.4 * press(t)) / 1200);
  };
  const atk = o.attack ?? 0.018;
  const amp = (t) => (t < atk ? t / atk : 1 + 0.14 * Math.exp(-(t - atk) / 0.035)) * (1 + 0.03 * press(t));
  runTable(x, sr, T, f, pitch, amp, rand());
  addNoise(x, sr, bandNoise(sr, clamp(f * 3.5, 1600, 4200), 1), (t) => (o.air ?? 0.04) * (0.5 + 3.5 * Math.exp(-t / 0.014)), Math.floor(rand() * 60000));
  opening(x, sr, (t) => lerp(f * 2.4, o.open ?? 7500, Math.min(1, t / 0.04)));
  paint(x, sr, o.body);
  dcBlock(x, sr, 70);
  return finish([x], sr, o.peak ?? 0.82, o.loop);
}

// ---------- lips on a bell: the band's brass ----------
// A lip reed is nonlinear: played softly it is almost a sine, played hard the wave steepens and the top comes in. So each note
// starts dark, flares for a moment as the lips catch, then settles. The two tables are that wave, soft and hard.
function brassNote(name, sr, f, o) {
  const rand = rng32(seedOf(name, f));
  const len = samples(sr, o.dur);
  const dark = new Float32Array(len), hard = new Float32Array(len);
  const Ts = table(`${name}S`, f, sr, (h) => o.soft ** (h - 1), 14);
  const Th = table(`${name}H`, f, sr, (h) => 1 / h ** o.hard, 26);
  const press = wander(rand, 2.1, o.dur);
  const atk = o.attack * clamp((300 / f) ** 0.35, 0.7, 1.6);
  const pitch = (t) => 2 ** ((-(o.scoop ?? 30) * Math.exp(-t / 0.016) + 1.5 * press(t) + (o.vibCents ?? 0) * (t > 0.35 ? Math.sin(TAU * 4.9 * t) : 0)) / 1200);
  const amp = (t) => (t < atk ? t / atk : 1 + 0.1 * Math.exp(-(t - atk) / 0.05)) * (1 + 0.025 * press(t));
  const ph = rand();
  runTable(dark, sr, Ts, f, pitch, amp, ph);
  runTable(hard, sr, Th, f, pitch, amp, ph);
  // the flare, as a level on the hard wave
  const flare = (t) => clamp(o.bright + (o.flare ?? 0.45) * Math.exp(-((t - atk) ** 2) / (2 * 0.03 ** 2)), 0, 1);
  const x = new Float32Array(len);
  for (let b = 0; b < len; b += BLOCK) {
    const e = Math.min(len, b + BLOCK), k = flare(b / sr);
    for (let i = b; i < e; i++) x[i] = dark[i] * (1 - k) + hard[i] * k;
  }
  addNoise(x, sr, bandNoise(sr, clamp(f * 5, 900, 3500), 1.1), (t) => (o.blat ?? 0.05) * Math.exp(-t / 0.014) * (t < 0.002 ? t / 0.002 : 1), Math.floor(rand() * 60000));
  paint(x, sr, o.body);
  dcBlock(x, sr, Math.min(50, f * 0.5));
  return finish([x], sr, o.peak ?? 0.82, o.loop);
}

// ---------- air on an edge: the nai and the suling ----------
function fluteNote(name, sr, f, o) {
  const rand = rng32(seedOf(name, f));
  const len = samples(sr, o.dur);
  const x = new Float32Array(len);
  const T = table(name, f, sr, (h) => o.partials[h - 1] ?? 0, o.partials.length);
  const breathW = wander(rand, 3.1, o.dur), wob = wander(rand, 1.2, o.dur);
  let vp = rand() * TAU, lastT = 0;
  const pitch = (t) => {
    vp += TAU * o.vibHz * (1 + 0.05 * wob(t)) * (t - lastT);
    lastT = t;
    const onset = t < o.vibDelay ? 0 : Math.min(1, (t - o.vibDelay) / 0.28);
    return 2 ** ((o.vibCents * onset * Math.sin(vp) - o.scoop * Math.exp(-t / o.scoopT) + 3 * breathW(t)) / 1200);
  };
  const amp = (t) => (t < o.attack ? (t / o.attack) ** 1.3 : 1) * (1 + 0.06 * breathW(t)) * (1 + (o.tremolo ?? 0.04) * (t > o.vibDelay ? Math.sin(vp) : 0));
  runTable(x, sr, T, f, pitch, amp, rand());
  // the air that does not become note: tuned to the pipe, a wide hiss, and the chiff as the jet finds the edge
  const pipe = svf(white().subarray(0, Math.min(len, 65536)), sr, f, 9, 'band');
  addNoise(x, sr, pipe, (t) => o.pipe * (0.8 + 0.2 * breathW(t)) * (t < 0.03 ? t / 0.03 : 1) * (1 + 2 * Math.exp(-t / 0.04)));
  addNoise(x, sr, bandNoise(sr, clamp(f * 4.5, 2000, 7000), 0.7), (t) => o.hiss * (0.5 + 4.5 * Math.exp(-t / 0.016)) * (t < 0.002 ? t / 0.002 : 1), Math.floor(rand() * 60000));
  paint(x, sr, o.body);
  dcBlock(x, sr, Math.min(100, f * 0.5));
  return finish([x], sr, o.peak ?? 0.8, o.loop);
}

// ---------- strings that are plucked or struck ----------
// Courses of strings a hair apart, a pick or a beater with a place on the string, then the small box they sit on.
function stringNote(name, sr, f, o) {
  const rand = rng32(seedOf(name, f));
  const t60 = clamp(o.t60 * (220 / f) ** (o.fall ?? 0.35), o.minT ?? 0.2, o.t60 * 2.6);
  const dur = Math.min(o.dur, t60 * 1.2 + 0.1);
  const cents = o.courses;
  const L = new Float32Array(samples(sr, dur)), R = o.stereo ? new Float32Array(L.length) : null;
  cents.forEach((c, k) => {
    const ex = hammer(sr, o.width * (0.9 + rand() * 0.25), o.pickNoise ?? 0.2, rand, (sr / f) * (o.place ?? 0.14));
    const s = karplus(sr, f * 2 ** (c / 1200), dur, { t60: t60 * (1 + k * 0.06), damp: o.damp, excite: ex });
    if (R) { mixInto(L, s, 0, k % 2 ? 0.55 : 1); mixInto(R, s, 0, k % 2 ? 1 : 0.55); } else mixInto(L, s, 0, 1);
  });
  // beater or pick on the wood
  const knock = applyEnv(svf(white().subarray(0, samples(sr, 0.03)), sr, o.knockHz ?? 500, 1.1), sr, perc(0.0004, o.knockT ?? 0.006));
  for (const c of R ? [L, R] : [L]) {
    mixInto(c, knock, 0, o.knock ?? 0.3);
    if (o.drive) for (let i = 0; i < c.length; i++) c[i] = Math.tanh(c[i] * o.drive);
    paint(c, sr, o.body);
    dcBlock(c, sr, Math.min(65, f * 0.45));
  }
  return finish(R ? [L, R] : [L], sr, o.peak ?? 0.84, null, 0.03);
}

// ---------- bars, kettles and hanging bronze, without the Balinese beating ----------
// Decaying modes, each a two-term recursion so a bar costs little. Java tunes its bars singly, there is no paired ombak: the
// sound is a calm bloom with a wooden or horn knock in front.
function modalNote(name, sr, f, o, seed = seedOf(name, f)) {
  const rand = rng32(seed);
  const len = samples(sr, o.dur);
  const x = new Float32Array(len);
  for (const [ratio, a, decay, delay] of o.modes) {
    const hz = f * ratio;
    if (hz > sr * 0.45) continue;
    const w = (TAU * hz) / sr, r = Math.exp(-1 / (decay * sr)), c = 2 * r * Math.cos(w), rr = r * r;
    let y1 = 0, y2 = -Math.sin(w) * a / r;
    const on = delay ? samples(sr, delay) : 0;
    for (let i = 0; i < len; i++) {
      const y = c * y1 - rr * y2;
      y2 = y1; y1 = y;
      x[i] += on && i < on ? y * (i / on) : y;
    }
  }
  if (o.attack) for (let i = 0, n = samples(sr, o.attack); i < n && i < len; i++) x[i] *= i / n;
  if (o.click) {
    const [hz, q, amt, dec] = o.click;
    const ck = applyEnv(svf(noise(sr, 0.02, rand), sr, Math.min(hz, f * 8), q), sr, perc(0.0002, dec));
    mixInto(x, ck, 0, amt);
  }
  if (o.lowpass) biquad(x, sr, 'lp', o.lowpass, 0.7);
  dcBlock(x, sr, Math.max(20, f * 0.35));
  return finish([x], sr, o.peak ?? 0.82, null, o.tail ?? 0.05);
}

// ---------- skins ----------
// The modes of a stretched head (1, 1.59, 2.14, 2.3, 2.65...), the place of the hand decides which ones speak, and the head goes
// tight for an instant when it is struck, or is pressed on purpose with the heel of the hand.
const HEAD = [1, 1.593, 2.135, 2.295, 2.653, 2.917];
function skin(sr, rand, o) {
  const dur = o.dur;
  const len = samples(sr, dur);
  const x = new Float32Array(len);
  const mix = o.mix ?? [1, 0.35, 0.15];
  for (let m = 0; m < mix.length; m++) {
    if (!mix[m]) continue;
    const ratio = HEAD[m];
    const decay = o.decay / (1 + m * (o.modeFall ?? 0.55));
    let ph = rand() * 0.2;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const hz = o.f * ratio * (1 + (o.tight ?? 0.14) * Math.exp(-t / (o.tightT ?? 0.012)) + (o.bend ? o.bend(t) : 0));
      ph += hz / sr;
      x[i] += mix[m] * Math.sin(TAU * ph) * Math.exp(-t / decay);
    }
  }
  const hit = applyEnv(svf(noise(sr, Math.min(dur, 0.05), rand), sr, o.hitHz ?? 1800, o.hitQ ?? 0.9), sr, perc(0.0002, o.hitT ?? 0.005));
  mixInto(x, hit, 0, o.hit ?? 0.5);
  if (o.lowpass) biquad(x, sr, 'lp', o.lowpass, 0.7);
  dcBlock(x, sr, Math.min(40, o.f * 0.4));
  normalize([x], o.peak ?? 0.86);
  return [fade(x, sr, 0.0002, 0.012)];
}

function clang(sr, rand, ratios, base, dur, env, fc, gain = 1) {
  const x = new Float32Array(samples(sr, dur));
  for (const r of ratios) {
    const w = (base * r) / sr;
    let p = rand();
    for (let i = 0; i < x.length; i++) { p += w; x[i] += p - Math.floor(p) < 0.5 ? gain : -gain; }
  }
  const out = svf(x, sr, fc, 0.9, 'high');
  return applyEnv(out, sr, env);
}

// ---------- the bodies ----------
const FIDDLE_BOX = [['hp', 180, 0.8], ['p', 280, 3, 7], ['p', 470, 2.6, 5], ['p', 1300, 1.2, -4], ['p', 2800, 1.1, 7], ['hs', 5600, 0.7, -9], ['lp', 9500, 0.7]];
const VIOLA_BOX = [['hp', 130, 0.8], ['p', 225, 2.4, 6], ['p', 390, 2.2, 5], ['p', 1100, 1.1, -4], ['p', 2200, 1.2, 3], ['hs', 3400, 0.7, -11], ['lp', 6000, 0.7]];

// inst -> { render, then how the note is played back }
//   hold, rel: the buffer plays for durS * hold, at least min, then closes in rel seconds
//   loop: the stretch of a sustained buffer to go round in, for notes longer than it
//   slide: start at this playback rate for that long when the score says /, skip: where a slurred note starts in the buffer
//   damp: [ring factor, shortest ring] for struck notes, as in the DAMP table of synth.js
export const MODELS = {
  // the Steirische: dry, forward, two reeds a mild beat apart. A wood box and open valves.
  steirische: {
    hold: 0.93, min: 0.06, rel: 0.035, loop: [0.62, 1.2], slide: [0.965, 0.05], skip: 0.035, bellows: true,
    render: (sr, f) => reedNote('steirische', sr, f, {
      dur: 1.3, attack: 0.02, loop: [0.62, 1.2], open: 12500, air: 0.018,
      reeds: [{ cents: -3.5, duty: 0.27, pan: -0.42 }, { cents: 4, duty: 0.32, pan: 0.42 }],
      body: [['hp', 150, 0.7], ['p', 1050, 1, 3], ['p', 2500, 1.4, 4], ['hs', 5200, 0.7, -5], ['lp', 9000, 0.7]],
    }),
  },
  // the left hand of the box: short chords on the afterbeats
  steirischeLH: {
    hold: 0.8, min: 0.08, rel: 0.03, loop: null, slide: null, skip: 0.02,
    render: (sr, f) => reedNote('steirischeLH', sr, f, {
      dur: 0.62, attack: 0.012, scoop: 7, open: 7000, air: 0.012,
      reeds: [{ cents: -2.5, duty: 0.3, slope: 0.95, pan: -0.3 }, { cents: 3, duty: 0.34, slope: 0.95, pan: 0.3 }],
      body: [['hp', 170, 0.7], ['p', 800, 1, 2.5], ['hs', 3000, 0.7, -8], ['lp', 5600, 0.7]],
    }),
  },
  // the helikon basses: long brassy tongues, the box's oom
  helikon: {
    hold: 0.74, min: 0.1, rel: 0.05, loop: null, slide: null, skip: 0.03,
    render: (sr, f) => reedNote('helikon', sr, f, {
      dur: 0.95, attack: 0.024, scoop: 10, open: 3800, air: 0.008, waver: 1.6,
      reeds: [{ cents: -1.5, duty: 0.24, slope: 0.9, pan: -0.12 }, { cents: 1.5, duty: 0.29, slope: 0.9, pan: 0.12 }],
      body: [['p', 150, 1, 3], ['p', 620, 1.1, 2], ['hs', 1800, 0.7, -7], ['lp', 3600, 0.7]],
    }),
  },
  // the lăutar's accordion: three reeds, wet musette, the shimmer you hear from a Bucharest courtyard
  acordeon: {
    hold: 0.95, min: 0.05, rel: 0.04, loop: [0.62, 1.2], slide: [0.95, 0.06], skip: 0.03, bellows: true,
    render: (sr, f) => reedNote('acordeon', sr, f, {
      dur: 1.3, attack: 0.016, scoop: 9, loop: [0.62, 1.2], open: 10000, air: 0.014,
      reeds: [{ cents: -11, duty: 0.3, pan: -0.5 }, { cents: 0, duty: 0.26, gain: 0.7, pan: 0 }, { cents: 12, duty: 0.33, pan: 0.5 }],
      body: [['hp', 150, 0.7], ['p', 850, 1, 3], ['p', 2100, 1.3, 2.5], ['hs', 4300, 0.7, -7], ['lp', 8000, 0.7]],
    }),
  },
  // the lăutar's fiddle: a wide fast vibrato and a strong bite
  vioara: {
    hold: 0.97, min: 0.05, rel: 0.05, loop: [0.8, 1.45], slide: [0.92, 0.08], skip: 0.035,
    render: (sr, f) => bowNote('vioara', sr, f, { dur: 1.55, attack: 0.018, vibHz: 6.2, vibCents: 26, vibDelay: 0.14, loop: [0.8, 1.45], body: FIDDLE_BOX, hair: 0.05, scrape: 20, bite: 0.26 }),
  },
  // the Transylvanian primás: gut in the sound, less vibrato and more arm, near the bridge
  primas: {
    hold: 0.96, min: 0.05, rel: 0.05, loop: [0.8, 1.45], slide: [0.93, 0.07], skip: 0.035,
    render: (sr, f) => bowNote('primas', sr, f, { dur: 1.55, attack: 0.022, vibHz: 5.2, vibCents: 13, vibDelay: 0.22, loop: [0.8, 1.45], beta: 0.1, slope: 0.92, body: [['hp', 200, 0.8], ['p', 290, 3, 5], ['p', 500, 2.4, 3], ['p', 1400, 1.1, -3], ['p', 3100, 1, 6], ['hs', 5200, 0.7, -8], ['lp', 8600, 0.7]], hair: 0.075, scrape: 26, bite: 0.3 }),
  },
  // kontra or contră: a viola with a flat bridge sawing three strings at once
  kontraBow: {
    hold: 0.92, min: 0.07, rel: 0.03, loop: null, slide: null, skip: 0.02,
    render: (sr, f) => bowNote('kontraBow', sr, f, { dur: 0.72, attack: 0.01, vibHz: 5, vibCents: 0, vibDelay: 1, beta: 0.18, slope: 0.96, body: VIOLA_BOX, hair: 0.08, scrape: 30, bite: 0.42, catch: 0.018, harm: 26, peak: 0.8 }),
  },
  // the gordun: a three stringed bass, bowed in short heavy strokes
  gordun: {
    hold: 0.86, min: 0.1, rel: 0.05, loop: null, slide: null, skip: 0.02,
    render: (sr, f) => bowNote('gordun', sr, f, { dur: 0.9, attack: 0.022, vibHz: 4, vibCents: 0, vibDelay: 1, beta: 0.2, slope: 0.94, harm: 28, hair: 0.05, hairHz: 900, scrape: 22, bite: 0.5, catch: 0.03, body: [['p', 95, 1.2, 5], ['p', 240, 1.4, 4], ['p', 700, 1.2, 2], ['hs', 1600, 0.7, -10], ['lp', 3000, 0.7]] }),
  },
  // rebab and tehyan: a spike fiddle on a thin skin or a coconut, nasal, no wood box to speak of
  rebab: {
    hold: 0.97, min: 0.07, rel: 0.05, loop: [0.8, 1.45], slide: [0.9, 0.11], skip: 0.03,
    render: (sr, f) => bowNote('rebab', sr, f, { dur: 1.55, attack: 0.03, vibHz: 4.6, vibCents: 16, vibDelay: 0.25, loop: [0.8, 1.45], beta: 0.08, slope: 0.86, harm: 30, hair: 0.05, hairHz: 2600, scrape: 12, bite: 0.1, body: [['hp', 240, 0.8], ['p', 620, 1.6, 7], ['p', 1450, 1.4, 6], ['p', 3200, 1.6, 3], ['hs', 4800, 0.7, -11], ['lp', 7000, 0.7]] }),
  },
  tehyan: {
    hold: 0.97, min: 0.06, rel: 0.05, loop: [0.8, 1.45], slide: [0.88, 0.1], skip: 0.03,
    render: (sr, f) => bowNote('tehyan', sr, f, { dur: 1.55, attack: 0.018, vibHz: 6.2, vibCents: 24, vibDelay: 0.16, loop: [0.8, 1.45], beta: 0.06, slope: 0.8, harm: 34, hair: 0.06, hairHz: 3600, scrape: 16, bite: 0.2, body: [['hp', 320, 0.8], ['p', 900, 1.8, 8], ['p', 2200, 1.5, 7], ['hs', 5200, 0.7, -8], ['lp', 8500, 0.7]] }),
  },
  // Klarinette of the valley band: clean, a little reedy, no vibrato to speak of
  klarinette: {
    hold: 0.96, min: 0.05, rel: 0.05, loop: [0.65, 1.2], slide: [0.95, 0.06], skip: 0.025,
    render: (sr, f) => clarinetNote('klarinette', sr, f, { dur: 1.3, loop: [0.65, 1.2], vibCents: 3, air: 0.035, body: [['hp', 150, 0.7], ['p', 1500, 1.1, 3], ['p', 3000, 1.4, -2], ['hs', 5000, 0.7, -6], ['lp', 7800, 0.7]] }),
  },
  // the lăutar's clarinet: bent, wide, with a cry at the top
  taragot: {
    hold: 0.97, min: 0.05, rel: 0.05, loop: [0.65, 1.2], slide: [0.9, 0.09], skip: 0.025,
    render: (sr, f) => clarinetNote('taragot', sr, f, { dur: 1.3, loop: [0.65, 1.2], vibHz: 5.8, vibCents: 22, vibDelay: 0.2, scoop: 26, air: 0.05, open: 9000, body: [['hp', 170, 0.7], ['p', 1250, 1, 4], ['p', 2600, 1.2, 3], ['hs', 5200, 0.7, -5], ['lp', 8600, 0.7]] }),
  },
  // Flügelhorn: conical and round, the voice of an Alpine brass band
  fluegel: {
    hold: 0.92, min: 0.08, rel: 0.05, loop: [0.65, 1.1], slide: [0.96, 0.05], skip: 0.03,
    render: (sr, f) => brassNote('fluegel', sr, f, { dur: 1.2, attack: 0.03, loop: [0.65, 1.1], soft: 0.42, hard: 1.5, bright: 0.2, flare: 0.5, vibCents: 4, blat: 0.04, body: [['hp', 170, 0.7], ['p', 950, 1, 4], ['p', 2200, 1.4, 2], ['hs', 3800, 0.7, -9], ['lp', 6500, 0.7]] }),
  },
  // Tenorhorn: the countermelody under the Flügelhorn, darker still
  tenorhorn: {
    hold: 0.9, min: 0.08, rel: 0.05, loop: [0.65, 1.1], slide: [0.96, 0.05], skip: 0.03,
    render: (sr, f) => brassNote('tenorhorn', sr, f, { dur: 1.2, attack: 0.034, loop: [0.65, 1.1], soft: 0.46, hard: 1.5, bright: 0.17, flare: 0.42, blat: 0.04, body: [['hp', 95, 0.7], ['p', 520, 1, 3.5], ['p', 1200, 1.3, 1.5], ['hs', 2400, 0.7, -9], ['lp', 4400, 0.7]] }),
  },
  // Trompete, for the bright top of the band
  trompete: {
    hold: 0.92, min: 0.06, rel: 0.04, loop: [0.65, 1.1], slide: [0.95, 0.05], skip: 0.03,
    render: (sr, f) => brassNote('trompete', sr, f, { dur: 1.2, attack: 0.02, loop: [0.65, 1.1], soft: 0.55, hard: 1.1, bright: 0.45, flare: 0.5, vibCents: 5, blat: 0.06, body: [['hp', 230, 0.7], ['p', 1300, 1, 4], ['p', 2800, 1.2, 4], ['hs', 5800, 0.7, -5], ['lp', 9000, 0.7]] }),
  },
  // the afterbeat horns of a band, short and round
  begleit: {
    hold: 0.7, min: 0.07, rel: 0.035, loop: null, slide: null, skip: 0.02,
    render: (sr, f) => brassNote('begleit', sr, f, { dur: 0.5, attack: 0.018, soft: 0.42, hard: 1.5, bright: 0.2, flare: 0.3, blat: 0.03, body: [['hp', 190, 0.7], ['p', 800, 1, 3], ['hs', 2600, 0.7, -9], ['lp', 4800, 0.7]] }),
  },
  // Bass tuba: the lips open with every note
  basstuba: {
    hold: 0.75, min: 0.1, rel: 0.06, loop: null, slide: null, skip: 0.03,
    render: (sr, f) => brassNote('basstuba', sr, f, { dur: 0.95, attack: 0.03, soft: 0.5, hard: 1.4, bright: 0.18, flare: 0.4, scoop: 26, blat: 0.03, body: [['p', 180, 1, 3], ['p', 460, 1.2, 2.5], ['hs', 1100, 0.7, -8], ['lp', 2300, 0.7]] }),
  },
  // the nai: stopped pipes, so odd partials, and a sigh of air bigger than the note
  naiPipe: {
    hold: 0.98, min: 0.06, rel: 0.07, loop: [0.8, 1.35], slide: [0.88, 0.12], skip: 0.04,
    render: (sr, f) => fluteNote('naiPipe', sr, f, { dur: 1.45, attack: 0.035, loop: [0.8, 1.35], partials: [1, 0.05, 0.33, 0.04, 0.12, 0.02, 0.05], vibHz: 5.4, vibCents: 14, vibDelay: 0.2, scoop: 34, scoopT: 0.035, pipe: 0.42, hiss: 0.03, body: [['hp', 240, 0.7], ['p', 2600, 1, 2], ['hs', 7000, 0.7, -2]] }),
  },
  // suling: bamboo with a ring mouth, open, breathy and quick
  sulingBamboo: {
    hold: 0.98, min: 0.05, rel: 0.06, loop: [0.8, 1.35], slide: [0.9, 0.09], skip: 0.03,
    render: (sr, f) => fluteNote('sulingBamboo', sr, f, { dur: 1.45, attack: 0.024, loop: [0.8, 1.35], partials: [1, 0.28, 0.14, 0.06, 0.03], vibHz: 6.4, vibCents: 17, vibDelay: 0.17, scoop: 22, scoopT: 0.022, pipe: 0.3, hiss: 0.034, tremolo: 0.07, body: [['hp', 300, 0.7], ['p', 3200, 1, 2.5]] }),
  },
  // cobza: a short lute, double courses, a quill, a hollow round back
  cobza: {
    damp: [1.1, 0.14], courses: [-2, 2.2], render: (sr, f) => stringNote('cobza', sr, f, { courses: [-2, 2.2], dur: 0.8, t60: 0.9, damp: 0.16, width: 0.0009, pickNoise: 0.2, place: 0.2, knock: 0.45, knockHz: 340, knockT: 0.008, peak: 0.84, body: [['hp', 110, 0.7], ['p', 230, 1.4, 6], ['p', 820, 1.2, 3], ['p', 2400, 1.4, 2], ['hs', 4800, 0.7, -8]] }),
  },
  // țambal: four strings to a course and a thin wooden beater, it rings on until the hand stops it
  cimbalom: {
    damp: [7, 0.45], render: (sr, f) => stringNote('cimbalom', sr, f, { stereo: true, courses: [-2.4, -0.4, 0.7, 2.6], dur: 1.5, t60: 2.1, fall: 0.5, minT: 0.55, damp: 0.14, width: 0.0007, pickNoise: 0.3, place: 0.12, knock: 0.3, knockHz: 620, peak: 0.84, body: [['hp', 95, 0.7], ['p', 320, 1, 2], ['p', 2700, 1.2, 2], ['hs', 6500, 0.7, -2]] }),
  },
  // the Hackbrett: the same family, lighter and higher, a mountain parlour
  hackbrett: {
    damp: [5, 0.3], render: (sr, f) => stringNote('hackbrett', sr, f, { stereo: true, courses: [-1.6, 1.8], dur: 1, t60: 1.5, fall: 0.5, minT: 0.45, damp: 0.1, width: 0.0005, pickNoise: 0.2, place: 0.1, knock: 0.22, knockHz: 900, peak: 0.82, body: [['hp', 200, 0.7], ['p', 3000, 1, 2.5], ['hs', 7500, 0.7, -2]] }),
  },
  // the band's guitar: bass string then a chord, nylon on a dance floor
  gitarre: {
    damp: [1.4, 0.16], render: (sr, f) => stringNote('gitarre', sr, f, { courses: [0], dur: 0.9, t60: 1.1, damp: 0.24, width: 0.0014, pickNoise: 0.12, place: 0.2, knock: 0.12, knockHz: 300, peak: 0.84, body: [['hp', 85, 0.7], ['p', 210, 1.4, 4], ['p', 950, 1.1, 1.5], ['hs', 3000, 0.7, -5]] }),
  },
  // mandolin: steel pairs, a hard pick, made for the tremolo
  mandolin: {
    damp: [1.6, 0.11], render: (sr, f) => stringNote('mandolin', sr, f, { courses: [-2.4, 2.4], dur: 0.7, t60: 0.75, damp: 0.05, width: 0.00045, pickNoise: 0.22, place: 0.13, knock: 0.18, knockHz: 1100, peak: 0.82, body: [['hp', 210, 0.7], ['p', 430, 1.4, 4], ['p', 2800, 1.3, 5], ['hs', 6200, 0.7, -4]] }),
  },
  // upright bass, plucked: the taraf's floor and the dangdut's walk
  contrabas: {
    damp: [1.2, 0.18], render: (sr, f) => stringNote('contrabas', sr, f, { courses: [0], dur: 1.05, t60: 1.2, fall: 0.2, damp: 0.42, width: 0.0065, pickNoise: 0.1, place: 0.22, knock: 0.2, knockHz: 170, knockT: 0.012, drive: 1.5, peak: 0.86, body: [['p', 95, 1.2, 3], ['p', 240, 1.4, 3], ['hs', 1100, 0.7, -8], ['lp', 2200, 0.7]] }),
  },
  // gardon: a rough cello struck with a stick, the string slapped back on the board. More drum than bass.
  gardon: {
    damp: [1, 0.12], render: (sr, f) => stringNote('gardon', sr, f, { courses: [-3, 3], dur: 0.62, t60: 0.5, fall: 0.2, minT: 0.2, damp: 0.34, width: 0.0028, pickNoise: 0.5, place: 0.09, knock: 1.6, knockHz: 240, knockT: 0.014, drive: 2.2, peak: 0.84, body: [['p', 120, 1.1, 4], ['p', 360, 1.4, 4], ['p', 1300, 1.6, 3], ['hs', 2400, 0.7, -7], ['lp', 4200, 0.7]] }),
  },
  // Java: bars over a trough, horn mallet, no paired detune. The full note is allowed to bloom.
  saron: {
    damp: [2, 0.14], render: (sr, f) => modalNote('saron', sr, f, { dur: 1.3, modes: [[1, 1, 0.5], [2.71, 0.1, 0.11], [5.1, 0.04, 0.04]], click: [3200, 1.4, 0.3, 0.0016], attack: 0.0015 }),
  },
  peking: {
    damp: [1.6, 0.09], render: (sr, f) => modalNote('peking', sr, f, { dur: 0.8, modes: [[1, 1, 0.3], [2.76, 0.1, 0.06], [5.2, 0.03, 0.02]], click: [4200, 1.4, 0.3, 0.0012], attack: 0.001 }),
  },
  demung: {
    damp: [2.4, 0.2], render: (sr, f) => modalNote('demung', sr, f, { dur: 1.8, modes: [[1, 1, 0.75], [2.68, 0.14, 0.14], [4.9, 0.04, 0.05]], click: [1900, 1.2, 0.34, 0.002], attack: 0.002, peak: 0.86 }),
  },
  slenthem: {
    damp: [3, 0.5], render: (sr, f) => modalNote('slenthem', sr, f, { dur: 2.2, modes: [[1, 1, 0.95], [2.02, 0.2, 0.3], [3.1, 0.05, 0.08]], attack: 0.006, click: [500, 1, 0.14, 0.006], peak: 0.86 }),
  },
  gender: {
    damp: [2.5, 0.25], render: (sr, f) => modalNote('gender', sr, f, { dur: 1.4, modes: [[1, 1, 0.65], [2.96, 0.07, 0.14], [4.1, 0.015, 0.04]], attack: 0.004, click: [800, 1, 0.06, 0.004] }),
  },
  // kettles: bonang and kromong are a row of small pots, nasal and quickly gone; a cord stick has no click to speak of
  bonang: {
    damp: [2.4, 0.13], render: (sr, f) => modalNote('bonang', sr, f, { dur: 0.75, modes: [[1, 1, 0.26], [1.52, 0.1, 0.1], [2.01, 0.42, 0.13], [2.97, 0.2, 0.08], [4.06, 0.08, 0.04]], attack: 0.002, click: [1500, 1.4, 0.16, 0.002] }),
  },
  kromong: {
    damp: [2.2, 0.1], render: (sr, f) => modalNote('kromong', sr, f, { dur: 0.6, modes: [[1, 1, 0.2], [2.03, 0.5, 0.09], [3.06, 0.26, 0.05], [4.2, 0.1, 0.03]], attack: 0.0012, click: [2400, 1.4, 0.2, 0.0014] }),
  },
  // gambang: teak over a box, wood not bronze. Just the knock and a short tone.
  gambang: {
    damp: [3, 0.2], render: (sr, f) => modalNote('gambang', sr, f, { dur: 0.42, modes: [[1, 1, 0.1], [3.92, 0.28, 0.024], [9.2, 0.07, 0.007]], attack: 0.0006, click: [2400, 1.4, 0.3, 0.001] }),
  },
  // hanging and lying bronze of the colotomy, each on the note of the phrase it marks
  kenong: {
    damp: [8, 0.8], render: (sr, f) => modalNote('kenong', sr, f, { dur: 1.5, modes: [[1, 1, 0.5], [1.004, 0.5, 0.42], [2.03, 0.26, 0.2], [2.74, 0.14, 0.1], [4.1, 0.05, 0.05]], attack: 0.003, click: [1100, 1.1, 0.2, 0.002] }),
  },
  kempul: {
    damp: [8, 1.1], render: (sr, f) => modalNote('kempul', sr, f, { dur: 2, modes: [[1, 1, 0.8], [1.006, 0.8, 0.7], [1.98, 0.3, 0.35], [2.72, 0.13, 0.18], [4.3, 0.04, 0.07]], attack: 0.006, click: [420, 1, 0.3, 0.008], peak: 0.86 }),
  },
};


// One-shot voices for the percussion lanes: name -> (sr, rand) -> channels, same contract as the table in synth.js.
export const MODEL_PERC = {
  // kendhang, East Javanese hand: the big head low and fat, the small head dry
  kDhah: (sr, r) => skin(sr, r, { f: 84, dur: 0.46, decay: 0.2, tight: 0.2, tightT: 0.03, mix: [1, 0.34, 0.14], hit: 0.3, hitHz: 500, peak: 0.88 }),
  kDhong: (sr, r) => skin(sr, r, { f: 118, dur: 0.36, decay: 0.15, tight: -0.1, tightT: 0.06, bend: (t) => 0.1 * Math.min(1, t / 0.07), mix: [1, 0.3, 0.1], hit: 0.3, hitHz: 700 }),
  kThung: (sr, r) => skin(sr, r, { f: 215, dur: 0.24, decay: 0.09, tight: 0.09, mix: [1, 0.4, 0.2], hit: 0.5, hitHz: 1200 }),
  kTak: (sr, r) => skin(sr, r, { f: 390, dur: 0.1, decay: 0.022, tight: 0.2, mix: [1, 0.8, 0.5, 0.3], hit: 1.2, hitHz: 2300, hitT: 0.006, peak: 0.84 }),
  kDhet: (sr, r) => skin(sr, r, { f: 150, dur: 0.1, decay: 0.03, tight: 0.2, mix: [1, 0.5, 0.2], hit: 0.8, hitHz: 900 }),
  kTlang: (sr, r) => skin(sr, r, { f: 300, dur: 0.2, decay: 0.08, tight: 0.05, mix: [0.3, 1, 0.7, 0.5], hit: 0.5, hitHz: 2600, peak: 0.8 }),
  // gendang of a dangdut band: the heel of the hand presses the big head, so the note slides up, and that is the dut
  gDut: (sr, r) => skin(sr, r, { f: 82, dur: 0.46, decay: 0.2, tight: 0.04, bend: (t) => 0.52 * Math.min(1, t / 0.13) * Math.min(1, 1.25 - t), mix: [1, 0.3, 0.1], hit: 0.3, hitHz: 500, peak: 0.88 }),
  gDang: (sr, r) => skin(sr, r, { f: 116, dur: 0.48, decay: 0.22, tight: 0.12, tightT: 0.03, bend: (t) => -0.07 * Math.min(1, t / 0.2), mix: [1, 0.35, 0.16], hit: 0.42, hitHz: 800, peak: 0.88 }),
  gTak: (sr, r) => skin(sr, r, { f: 610, dur: 0.1, decay: 0.03, tight: 0.12, mix: [1, 0.7, 0.45, 0.3], hit: 0.9, hitHz: 3200, peak: 0.84 }),
  gTung: (sr, r) => skin(sr, r, { f: 335, dur: 0.24, decay: 0.09, tight: 0.06, mix: [1, 0.55, 0.3], hit: 0.42, hitHz: 2000 }),
  gTek: (sr, r) => skin(sr, r, { f: 860, dur: 0.06, decay: 0.012, tight: 0.1, mix: [1, 0.8], hit: 1.2, hitHz: 4200, peak: 0.8 }),
  // the bronze that lands the cycle
  gongAgeng: (sr, r) => {
    const f = 46, len = 6;
    const a = modalNote('gongAgeng', sr, f, { dur: len, peak: 0.9, tail: 0.4, attack: 0.012, modes: [[1, 1, 2.2], [1.03, 0.7, 2], [2.02, 0.5, 1.1], [2.05, 0.3, 0.9], [2.74, 0.24, 0.55, 0.03], [4.1, 0.1, 0.3], [5.4, 0.05, 0.16]], click: [160, 0.8, 0.5, 0.02] }, 777)[0];
    const b = modalNote('gongAgeng', sr, f * 1.0015, { dur: len, peak: 0.9, tail: 0.4, attack: 0.012, modes: [[1, 1, 2.1], [1.032, 0.7, 2], [2.03, 0.5, 1], [2.71, 0.24, 0.5, 0.03], [4.15, 0.1, 0.3]], click: [160, 0.8, 0.5, 0.02] }, 778)[0];
    return [a, b];
  },
  kethuk: (sr) => [modalNote('kethuk', sr, 262, { dur: 0.22, modes: [[1, 1, 0.05], [2.1, 0.3, 0.02]], attack: 0.0015, click: [900, 1, 0.3, 0.003], tail: 0.02 }, 31)[0]],
  kempyang: (sr) => [modalNote('kempyang', sr, 860, { dur: 0.2, modes: [[1, 1, 0.06], [2.3, 0.2, 0.02]], attack: 0.001, click: [2400, 1, 0.14, 0.001], tail: 0.02 }, 32)[0]],
  // kecrek: a stack of iron plates under a wooden stick, the tick of a gambang kromong
  kecrek: (sr, r) => {
    const x = clang(sr, r, [1, 1.37, 1.93, 2.51, 3.2], 1530, 0.11, perc(0.0004, 0.018), 2600, 0.6);
    mixInto(x, applyEnv(svf(noise(sr, 0.04, r), sr, 1600, 1), sr, perc(0.0002, 0.004)), 0, 3);
    normalize([x], 0.8);
    return [fade(x, sr, 0.0002, 0.012)];
  },
  // the band's drums: a big felt-headed bass drum, hit in march time
  grosse: (sr, r) => skin(sr, r, { f: 62, dur: 0.5, decay: 0.2, tight: 0.2, tightT: 0.02, mix: [1, 0.5, 0.3, 0.15], hit: 0.36, hitHz: 300, hitT: 0.012, peak: 0.88 }),
  // a stick on a parade snare: wires for a short moment
  stickSnare: (sr, r) => {
    const x = skin(sr, r, { f: 192, dur: 0.14, decay: 0.05, tight: 0.1, mix: [1, 0.6, 0.3], hit: 0.8, hitHz: 2200, peak: 0.7 })[0];
    mixInto(x, applyEnv(svf(noise(sr, 0.14, r), sr, 3600, 0.7), sr, perc(0.001, 0.038)), 0, 2.2);
    normalize([x], 0.84);
    return [fade(x, sr, 0.0002, 0.012)];
  },
  // the small cymbals on top of the bass drum, tschin
  tschin: (sr, r) => {
    const x = clang(sr, r, [1, 1.47, 2.11, 2.83, 3.67, 4.77], 940, 0.28, (t) => (t < 0.001 ? t / 0.001 : Math.exp(-(t - 0.001) / 0.075)), 3600, 0.5);
    mixInto(x, applyEnv(svf(noise(sr, 0.28, r), sr, 6400, 0.8, 'high'), sr, perc(0.001, 0.05)), 0, 1.4);
    normalize([x], 0.8);
    return [fade(x, sr, 0.0002, 0.02)];
  },
  // hands on leather shorts: two palms, a thigh
  plattler: (sr, r) => {
    const x = applyEnv(svf(noise(sr, 0.08, r), sr, 1200, 0.9), sr, perc(0.0003, 0.012));
    mixInto(x, skin(sr, r, { f: 260, dur: 0.08, decay: 0.018, tight: 0.2, mix: [1, 0.5], hit: 0, peak: 0.8 })[0], 0, 0.8);
    normalize([x], 0.82);
    return [fade(x, sr, 0.0002, 0.012)];
  },
  // toba: the double-headed drum a village band keeps at the back, felt on one side and a thin stick on the other
  toba: (sr, r) => skin(sr, r, { f: 74, dur: 0.42, decay: 0.16, tight: 0.2, tightT: 0.018, mix: [1, 0.45, 0.25, 0.12], hit: 0.4, hitHz: 420, hitT: 0.01, peak: 0.86 }),
  tobaStick: (sr, r) => skin(sr, r, { f: 280, dur: 0.07, decay: 0.016, tight: 0.1, mix: [1, 0.8, 0.5], hit: 1, hitHz: 2400, peak: 0.8 }),
};

export const MODEL_NAMES = Object.keys(MODELS);
export const SUSTAIN_MODELS = MODEL_NAMES.filter((k) => MODELS[k].hold);

