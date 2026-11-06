// Every effect is rendered once into a buffer: firing one costs a source and a gain, however busy the race is.
// The sounds are written, not sampled: wood, bronze, breath, a mouth made of formants.
import { rng32, hash, samples, fade, normalize, mixInto, svf, noise, applyEnv, perc, hold, tone, formants, clamp, TAU, loopify } from './dsp.js';
import { renderGong } from './synth.js';
import { ROSTER } from '../data/karts.js';

const sweep = (a, b, dur, curve = 1) => (t) => a * (b / a) ** Math.min(1, (t / dur) ** curve);
const blank = (sr, dur) => new Float32Array(samples(sr, dur));
// Plain noise has its energy at the very top, where it reads as an error, not a sound. Hiss here stops below 8 kHz.
const soften = (x, sr, fc = 6500) => svf(svf(x, sr, fc, 0.7, 'low'), sr, fc, 0.7, 'low');
const band = (sr, dur, f, q, env, rand, mode = 'band') => applyEnv(svf(noise(sr, dur, rand), sr, f, q, mode), sr, env);
const mono = (x, peak = 0.85) => { normalize([x], peak); return [fade(x, sr0(x), 0.0002, 0.01)]; };
// fade() only needs a rate for its millisecond lengths; at this level any common rate gives the same safety
const sr0 = () => 48000;

function layer(sr, dur, list) {
  const out = blank(sr, dur);
  for (const [at, sig, g = 1] of list) mixInto(out, sig, samples(sr, at), g);
  return out;
}

const ding = (sr, f, dur = 0.5, g = 1) => {
  const x = tone(sr, dur, f, { env: perc(0.001, dur * 0.3), gain: g });
  mixInto(x, tone(sr, dur, f * 2.76, { env: perc(0.0008, dur * 0.09), gain: g * 0.3 }));
  mixInto(x, tone(sr, dur, f * 5.4, { env: perc(0.0005, dur * 0.03), gain: g * 0.12 }));
  return x;
};
const knock = (sr, rand, f = 520, g = 1) => {
  const x = tone(sr, 0.09, (t) => f * (1 + 0.5 * Math.exp(-t / 0.006)), { env: perc(0.0005, 0.018), gain: g });
  mixInto(x, tone(sr, 0.09, f * 2.3, { env: perc(0.0003, 0.008), gain: g * 0.45 }));
  mixInto(x, band(sr, 0.03, f * 3, 1.2, perc(0.0002, 0.004), rand), 0, g * 0.5);
  return x;
};
const thud = (sr, f0 = 110, f1 = 48, dur = 0.26, g = 1) => tone(sr, dur, (t) => f1 + (f0 - f1) * Math.exp(-t / 0.03), { env: perc(0.002, dur * 0.34), gain: g });
const boing = (sr, f0, f1, dur, g = 1) => {
  const wob = (t) => (f0 + (f1 - f0) * Math.min(1, t / dur)) * (1 + 0.1 * Math.sin(TAU * 26 * t) * Math.exp(-t / (dur * 0.6)));
  const x = tone(sr, dur, wob, { harmonics: [1, 0.28, 0.1], env: perc(0.003, dur * 0.42), gain: g });
  return x;
};
const whoosh = (sr, rand, dur, f0, f1, q = 1.1, g = 1, attack = 0.3) => {
  const x = svf(noise(sr, dur, rand), sr, sweep(f0, f1, dur), q, 'band');
  return applyEnv(x, sr, (t) => {
    const k = t / dur;
    return g * (k < attack ? k / attack : ((1 - k) / (1 - attack)) ** 1.4);
  });
};
const sizzle = (sr, rand, dur, level = 1) => {
  // a hiss with fat drops popping in it, the sound of anything on a hot iron
  const x = band(sr, dur, 5200, 0.55, () => 0.42, rand);
  const pops = blank(sr, dur);
  const n = Math.round(dur * 70);
  for (let i = 0; i < n; i++) {
    const at = Math.floor(rand() * Math.max(1, pops.length - 900));
    mixInto(pops, band(sr, 0.012, 2500 + rand() * 5000, 2.5, perc(0.0002, 0.002), rand), at, 0.6 + rand());
  }
  mixInto(x, pops, 0, 0.9);
  return applyEnv(soften(x, sr), sr, (t) => level * (t < 0.03 ? t / 0.03 : 1) * (t > dur - 0.2 ? Math.max(0, (dur - t) / 0.2) : 1));
};

// a little mouth: a buzz through two or three formants, the vowel moving as it goes
function mouth(sr, dur, pitch, vowels, env, wobble = 0) {
  const src = tone(sr, dur, (t) => pitch(t) * (1 + wobble * Math.sin(TAU * 7 * t)), { shape: 'saw' });
  const seg = dur / Math.max(1, vowels.length);
  const out = blank(sr, dur);
  vowels.forEach((v, k) => {
    const part = src.slice(samples(sr, k * seg), samples(sr, (k + 1) * seg));
    const shaped = formants(part, sr, v);
    const fadeN = Math.min(200, Math.floor(shaped.length / 4));
    for (let i = 0; i < fadeN; i++) { shaped[i] *= i / fadeN; shaped[shaped.length - 1 - i] *= i / fadeN; }
    mixInto(out, shaped, samples(sr, k * seg));
  });
  return applyEnv(out, sr, env);
}
const V = {
  a: [[800, 7, 1], [1250, 8, 0.6], [2700, 9, 0.2]],
  e: [[480, 7, 1], [2000, 9, 0.5], [2800, 9, 0.2]],
  i: [[300, 7, 1], [2350, 10, 0.5], [3100, 9, 0.18]],
  o: [[480, 7, 1], [850, 8, 0.5], [2500, 9, 0.12]],
  u: [[330, 7, 1], [750, 8, 0.35], [2300, 9, 0.08]],
};

// ---------- the catalogue ----------
export const SFX = {
  // boxes and the roulette
  box(sr, r) {
    return mono(layer(sr, 0.6, [[0, knock(sr, r, 340), 0.8], [0.012, knock(sr, r, 610), 0.6], [0.03, ding(sr, 1174, 0.4), 0.55], [0.1, ding(sr, 1568, 0.45), 0.6]]));
  },
  boxFull(sr, r) { return mono(layer(sr, 0.2, [[0, knock(sr, r, 300), 1], [0.06, knock(sr, r, 240), 0.7]]), 0.5); },
  tick(sr, r) { return mono(knock(sr, r, 1250, 1), 0.6); },
  itemGet(sr) {
    return mono(layer(sr, 0.7, [[0, ding(sr, 880, 0.5), 0.6], [0.07, ding(sr, 1109, 0.5), 0.65], [0.14, ding(sr, 1319, 0.55), 0.8]]), 0.72);
  },

  // the items
  razzo(sr, r) {
    const x = layer(sr, 1, [
      [0, thud(sr, 180, 60, 0.3), 0.8],
      [0, whoosh(sr, r, 0.9, 400, 4200, 0.9, 1, 0.15), 0.9],
      [0.05, band(sr, 0.7, 5200, 0.7, perc(0.01, 0.2), r), 0.2],
    ]);
    return mono(x);
  },
  razzoLoop(sr, r) {
    // the whistle of a firework that has no plans to stop
    const d = 1.2;
    const x = tone(sr, d, (t) => 1680 + 170 * Math.sin((TAU * t) / d) + 28 * Math.sin((TAU * 9 * t) / d));
    mixInto(x, tone(sr, d, (t) => 840 + 85 * Math.sin((TAU * t) / d), { gain: 0.35 }));
    const roar = svf(noise(sr, d, r), sr, 1200, 0.7);
    mixInto(x, roar, 0, 0.7);
    normalize([x], 0.72);
    return [loopify(x, sr)];
  },
  boom(sr, r) {
    const x = layer(sr, 1.2, [
      [0, tone(sr, 0.7, (t) => 40 + 120 * Math.exp(-t / 0.05), { env: perc(0.001, 0.2) }), 1],
      [0, band(sr, 1.1, 900, 0.7, perc(0.002, 0.2), r, 'low'), 1.5],
      [0, band(sr, 0.2, 3400, 0.7, perc(0.0005, 0.03), r), 0.8],
    ]);
    // a cartoon explosion ends with a pop of stars, it does not leave a crater
    mixInto(x, ding(sr, 1320, 0.5), samples(sr, 0.14), 0.14);
    mixInto(x, ding(sr, 1760, 0.45), samples(sr, 0.22), 0.1);
    return mono(x);
  },
  grappa(sr, r) {
    const cork = layer(sr, 0.12, [[0, tone(sr, 0.08, (t) => 300 + 1300 * Math.min(1, t / 0.02), { env: perc(0.001, 0.016) }), 0.9], [0, band(sr, 0.04, 3200, 1, perc(0.0003, 0.006), r), 0.5]]);
    const list = [[0, cork, 1]];
    for (let i = 0; i < 6; i++) {
      const at = 0.14 + i * 0.1 + r() * 0.012;
      const f = 240 + i * 28;
      list.push([at, tone(sr, 0.09, (t) => f * (1 + 2.2 * t), { env: perc(0.006, 0.024) }), 0.7]);
    }
    list.push([0.8, mouth(sr, 0.32, (t) => 300 - 70 * t, [V.a], hold(0.03, 0.2, 0.09)), 0.75]);
    return mono(layer(sr, 1.2, list));
  },
  zuica(sr, r) {
    // a quick sip through the teeth, and a satisfied breath
    const sip = svf(noise(sr, 0.22, r), sr, sweep(1200, 3400, 0.22), 3.2);
    applyEnv(sip, sr, hold(0.02, 0.14, 0.06));
    const aah = mouth(sr, 0.2, () => 340, [V.e], hold(0.02, 0.12, 0.06));
    return mono(layer(sr, 0.5, [[0, sip, 1], [0.24, aah, 0.65]]));
  },
  hic(sr, r) {
    const up = mouth(sr, 0.14, (t) => 420 + 2600 * t, [V.e, V.i], (t) => (t < 0.01 ? t / 0.01 : Math.exp(-(t - 0.01) / 0.05)));
    const glot = band(sr, 0.03, 1200, 1.2, perc(0.0002, 0.005), r);
    return mono(layer(sr, 0.2, [[0, glot, 0.5], [0.006, up, 1]]));
  },
  miciReady(sr, r) {
    const k = knock(sr, r, 360);
    return mono(layer(sr, 1, [[0, k, 0.4], [0.015, sizzle(sr, r, 0.9), 1]]), 0.6);
  },
  miciThrow(sr, r) {
    return mono(layer(sr, 0.5, [[0, whoosh(sr, r, 0.3, 700, 2600, 1, 1), 0.9], [0.02, boing(sr, 300, 720, 0.2), 0.5], [0.1, sizzle(sr, r, 0.3), 0.26]]));
  },
  shield(sr, r) {
    return mono(layer(sr, 0.5, [[0, knock(sr, r, 700), 0.7], [0.003, ding(sr, 1460, 0.3), 0.6], [0.01, boing(sr, 620, 240, 0.28), 0.55], [0.04, sizzle(sr, r, 0.3), 0.2]]));
  },
  uova(sr, r) {
    // an iron pan struck on the stove, then the eggs hit it
    const pan = blank(sr, 1.4);
    for (const [f, a, d] of [[415, 1, 0.3], [1120, 0.6, 0.16], [1610, 0.46, 0.1], [2380, 0.3, 0.06], [3510, 0.18, 0.03]]) {
      mixInto(pan, tone(sr, 1.2, f, { env: perc(0.001, d) }), 0, a);
    }
    mixInto(pan, sizzle(sr, r, 1.3), samples(sr, 0.07), 0.55);
    return mono(pan);
  },
  sizzleLoop(sr, r) {
    const x = band(sr, 2.2, 5200, 0.55, () => 0.42, r);
    const pops = blank(sr, 2.2);
    for (let i = 0; i < 150; i++) mixInto(pops, band(sr, 0.012, 2500 + r() * 5000, 2.5, perc(0.0002, 0.002), r), Math.floor(r() * (pops.length - 900)), 0.6 + r());
    mixInto(x, pops, 0, 0.9);
    const y = soften(x, sr);
    normalize([y], 0.7);
    return [loopify(y, sr)];
  },
  polenta(sr, r) {
    const blob = tone(sr, 0.28, sweep(420, 110, 0.28), { harmonics: [1, 0.4, 0.14], env: perc(0.006, 0.1) });
    const splat = band(sr, 0.3, 1400, 0.8, perc(0.002, 0.05), r);
    const glop = tone(sr, 0.13, sweep(190, 340, 0.13), { env: perc(0.005, 0.04) });
    return mono(layer(sr, 0.6, [[0, blob, 1], [0.01, splat, 0.7], [0.3, glop, 0.5]]));
  },
  formaggio(sr, r) {
    // a heavy wheel on tarmac: a slow rolling thump and a boxy rumble
    const dur = 1.8;
    const rum = applyEnv(svf(noise(sr, dur, r), sr, 240, 0.9, 'low'), sr, (t) => (0.65 + 0.35 * Math.sin(TAU * 5.5 * t)) * Math.min(1, t / 0.12) * Math.min(1, (dur - t) / 0.4) * 1.8);
    const list = [[0, rum, 1], [0, knock(sr, r, 180), 0.9]];
    for (let i = 0; i < 9; i++) list.push([0.18 * i, thud(sr, 96, 56, 0.16), 0.55]);
    return mono(layer(sr, dur, list));
  },
  durian(sr, r) {
    // a long rude puff, then something wobbling in the air
    const pff = svf(noise(sr, 0.6, r), sr, sweep(2200, 500, 0.6), 1.1);
    applyEnv(pff, sr, hold(0.02, 0.25, 0.33));
    const blb = tone(sr, 0.7, (t) => 96 + 34 * Math.sin(TAU * 13 * t), { harmonics: [1, 0.55, 0.3, 0.14], env: hold(0.05, 0.3, 0.35) });
    return mono(layer(sr, 1, [[0, pff, 1], [0.1, blb, 0.5]]));
  },
  sambal(sr, r) {
    const flame = svf(noise(sr, 1.1, r), sr, sweep(420, 2100, 0.4), 0.8);
    applyEnv(flame, sr, (t) => Math.min(1, t / 0.04) * Math.exp(-t / 0.5));
    const crackle = blank(sr, 1.1);
    for (let i = 0; i < 40; i++) {
      mixInto(crackle, band(sr, 0.01, 1800 + r() * 3000, 2.5, perc(0.0002, 0.0014), r), Math.floor(r() * (crackle.length - 600)), 0.5 + r());
    }
    const yelp = mouth(sr, 0.22, sweep(460, 1020, 0.22), [V.a, V.i], hold(0.01, 0.15, 0.06));
    return mono(layer(sr, 1.1, [[0, flame, 1], [0, crackle, 0.6], [0.02, yelp, 0.34]]));
  },
  // the city from inside it: a low roar of engines, far horns that never quite stop
  cityLoop(sr, r) {
    const d = 7;
    const x = soften(svf(noise(sr, d, r), sr, (t) => 210 + 60 * Math.sin((TAU * 2 * t) / d), 0.5), sr, 1500);
    const m = band(sr, d, 620, 0.4, () => 0.16, r);
    mixInto(x, m, 0, 1);
    const hz = [392, 466, 523, 349, 622, 415, 554, 440, 494, 330];
    for (let i = 0; i < hz.length; i++) {
      const len = 0.12 + r() * 0.3, h = tone(sr, len, () => hz[i], { harmonics: [1, 0.7, 0.4, 0.2], env: hold(0.008, len - 0.05, 0.03), gain: 0.06 + r() * 0.05 });
      mixInto(x, h, Math.floor((i + 0.5 * r()) / hz.length * (x.length - sr)), 1);
    }
    normalize([x], 0.62);
    return [loopify(x, sr, 0.2)];
  },
  rainLoop(sr, r) {
    const d = 3.2, x = soften(band(sr, d, 4300, 0.42, () => 0.34, r), sr, 9000), drops = blank(sr, d);
    for (let i = 0; i < 260; i++) mixInto(drops, band(sr, 0.018, 1400 + r() * 3600, 2, perc(0.0004, 0.005), r), Math.floor(r() * (drops.length - 1200)), 0.3 + r() * 0.5);
    mixInto(x, drops, 0, 0.8);
    normalize([x], 0.6);
    return [loopify(x, sr, 0.15)];
  },
  // the weather's air: wind in the snow and the fog, sweeping slowly so that it never reads as hiss
  windLoop(sr, r) {
    const d = 5.2, x = soften(svf(noise(sr, d, r), sr, (t) => 520 + 320 * Math.sin((TAU * t) / d) + 170 * Math.sin((TAU * 3 * t) / d), 1.6), sr, 3000);
    applyEnv(x, sr, (t) => 0.62 + 0.38 * Math.sin((TAU * 2 * t) / d + 1));
    normalize([x], 0.6);
    return [loopify(x, sr, 0.3)];
  },
  // a summer night by the road: crickets in slow waves, and now and then an owl far off
  nightLoop(sr, r) {
    const d = 7.2, x = blank(sr, d);
    for (const [f, rate, off, g] of [[4300, 13.5, 0, 0.5], [4750, 11.7, 0.6, 0.36], [3950, 17.1, 1.4, 0.26]]) {
      const c = tone(sr, d, () => f, { env: (t) => { const p = (t * rate + off) % 1, wave = 0.45 + 0.55 * Math.sin((TAU * 2 * t) / d + off * 3); return p < 0.42 ? Math.sin((p / 0.42) * Math.PI) * Math.max(0, wave) : 0; }, gain: g });
      mixInto(x, c, 0, 1);
    }
    for (const [at, a] of [[2.1, 0.55], [2.7, 0.42]]) mixInto(x, tone(sr, 0.5, (t) => 330 - 26 * t, { env: hold(0.08, 0.2, 0.2) }), Math.floor(at * sr), a);
    normalize([x], 0.5);
    return [loopify(x, sr, 0.2)];
  },
  // through a puddle: a slap, then the sheet of water falling back
  splashWater(sr, r) {
    return mono(layer(sr, 0.55, [[0, band(sr, 0.12, 900, 0.8, perc(0.001, 0.05), r), 1], [0.02, soften(band(sr, 0.5, 2600, 0.5, perc(0.03, 0.2), r), sr, 7000), 0.7], [0.05, band(sr, 0.3, 1400, 1.4, perc(0.02, 0.1), r), 0.4]]), 0.8);
  },
  // through a drift: a soft whump and powder
  splashSnow(sr, r) {
    return mono(layer(sr, 0.5, [[0, thud(sr, 150, 60, 0.2), 0.9], [0.01, soften(band(sr, 0.45, 1500, 0.5, perc(0.02, 0.17), r), sr, 5000), 0.8]]), 0.75);
  },
  // far thunder: a crack through the air, then the long roll that gets lower
  thunder(sr, r) {
    const d = 4.4, roll = svf(noise(sr, d, r), sr, (t) => 150 - 22 * t, 0.9, 'low');
    applyEnv(roll, sr, (t) => Math.min(1, t / 0.12) * Math.exp(-t / 1.25) * (0.65 + 0.35 * Math.sin(t * 7.3 + Math.sin(t * 2.1) * 2)));
    return mono(layer(sr, d, [[0, band(sr, 0.5, 900, 0.7, perc(0.002, 0.12), r), 0.26], [0, roll, 1]]), 0.8);
  },
  flameLoop(sr, r) {
    const d = 1.6;
    const x = soften(svf(noise(sr, d, r), sr, (t) => 950 + 400 * Math.sin((TAU * 2 * t) / d), 0.6), sr, 4500);
    normalize([x], 0.72);
    return [loopify(x, sr)];
  },
  // a clay pot coming to the boil: fat slow bubbles, and a happy little sniff over them
  rendang(sr, r) {
    const d = 1.4, pot = svf(noise(sr, d, r), sr, () => 240, 1.4);
    applyEnv(pot, sr, (t) => Math.min(1, t / 0.1) * Math.exp(-t / 0.9) * 0.5);
    const bubbles = blank(sr, d);
    for (let i = 0; i < 14; i++) {
      const at = 0.05 + r() * (d - 0.3), f = 170 + r() * 240;
      mixInto(bubbles, tone(sr, 0.09, (t) => f * (1 + t * 7), { env: hold(0.02, 0.03, 0.04) }), Math.floor(at * sr), 0.5 + r() * 0.5);
    }
    const sniff = mouth(sr, 0.3, sweep(340, 640, 0.3), [V.i, V.u], hold(0.05, 0.16, 0.08));
    return mono(layer(sr, d, [[0, pot, 0.7], [0, bubbles, 0.9], [0.5, sniff, 0.3]]));
  },
  // the mountain letting go: a long rumble from far off, stones knocking on the way down
  frana(sr, r) {
    const d = 2.4, rumble = svf(noise(sr, d, r), sr, sweep(70, 150, d), 1.1);
    applyEnv(rumble, sr, (t) => Math.min(1, t / 0.7) * Math.min(1, (d - t) / 0.35));
    const stones = blank(sr, d);
    for (let i = 0; i < 26; i++) {
      const at = 0.2 + r() * (d - 0.5);
      mixInto(stones, knock(sr, r, 300 + r() * 900, 0.5 + r() * 0.5), Math.floor(at * sr), 0.2 + (at / d) * 0.6);
    }
    return mono(layer(sr, d, [[0, rumble, 1], [0, stones, 0.5]]));
  },

  // the natural disasters, one voice each, all of them big and none of them frightening
  // the warning every kart hears: an old wooden hand siren going up and down, then the ground starts to talk
  disasterAlarm(sr, r) {
    const wail = (at) => [at, tone(sr, 0.5, (t) => 560 + 340 * Math.sin((Math.PI * t) / 0.5), { harmonics: [1, 0.4, 0.14], env: hold(0.03, 0.34, 0.12) }), 0.6];
    return mono(layer(sr, 1.3, [[0, knock(sr, r, 400), 0.8], wail(0.02), [0.54, knock(sr, r, 400), 0.8], wail(0.56)]), 0.8);
  },
  disasterRumble(sr, r) {
    const d = 2.2, x = svf(noise(sr, d, r), sr, sweep(55, 120, d), 1.2);
    applyEnv(x, sr, (t) => Math.min(1, t / 1.1) * Math.min(1, (d - t) / 0.3));
    mixInto(x, tone(sr, d, (t) => 46 + 8 * t, { env: (t) => 0.5 * Math.min(1, t / 1.2) * Math.min(1, (d - t) / 0.3) }));
    return mono(x, 0.8);
  },
  // Cancia: a wet rumble with fat stones knocking and the mud slapping behind them
  disasterDebris(sr, r) {
    const d = 3.2, rumble = svf(noise(sr, d, r), sr, sweep(85, 190, d), 1);
    applyEnv(rumble, sr, (t) => Math.min(1, t / 0.25) * Math.min(1, (d - t) / 0.7));
    const stones = blank(sr, d), mud = blank(sr, d);
    for (let i = 0; i < 22; i++) mixInto(stones, knock(sr, r, 220 + r() * 520, 0.6 + r() * 0.4), Math.floor((0.05 + r() * (d - 0.7)) * sr), 0.5 + r() * 0.4);
    for (let i = 0; i < 16; i++) {
      const f = 150 + r() * 220, g = tone(sr, 0.14, (t) => f * (1 + 2.6 * t), { env: perc(0.006, 0.05) });
      mixInto(mud, g, Math.floor((0.1 + r() * (d - 0.6)) * sr), 0.5 + r() * 0.4);
    }
    return mono(layer(sr, d, [[0, thud(sr, 130, 44, 0.5), 0.7], [0, rumble, 0.55], [0, stones, 0.85], [0, mud, 0.95]]));
  },
  // a soft whumpf, then the powder rushing past, airy where the debris is wet
  disasterAvalanche(sr, r) {
    const d = 3, rush = svf(noise(sr, d, r), sr, sweep(420, 1500, d, 0.6), 0.7);
    applyEnv(rush, sr, (t) => Math.min(1, t / 0.5) * Math.min(1, (d - t) / 1.1) ** 1.2);
    const low = svf(noise(sr, d, r), sr, 110, 1);
    applyEnv(low, sr, (t) => Math.min(1, t / 0.2) * Math.min(1, (d - t) / 1.4));
    const air = soften(band(sr, d, 3200, 0.5, (t) => 0.35 * Math.min(1, t / 0.9) * Math.min(1, (d - t) / 1), r), sr, 5200);
    return mono(layer(sr, d, [[0, thud(sr, 170, 52, 0.42), 1], [0.02, rush, 0.9], [0, low, 0.9], [0.2, air, 0.8]]));
  },
  // big stones bouncing down in a slowing rhythm: wood-on-rock, a tune you can count
  disasterRockfall(sr, r) {
    const list = [];
    let at = 0, gap = 0.3, f = 210;
    for (let i = 0; i < 9; i++) {
      list.push([at, thud(sr, f * 0.9, 58, 0.26), 0.9 - i * 0.04], [at, knock(sr, r, f, 1), 0.85 - i * 0.05], [at + gap * 0.5, knock(sr, r, f * 1.7, 0.5), 0.34]);
      at += gap; gap *= 0.88; f *= 1.05;
    }
    list.push([at + 0.02, thud(sr, 150, 42, 0.5), 1], [at + 0.02, band(sr, 0.5, 500, 0.8, perc(0.002, 0.12), r, 'low'), 0.9]);
    return mono(layer(sr, 2.6, list));
  },
  // very low and shuddering, with the lanterns and the shutters rattling on top
  disasterQuake(sr, r) {
    const d = 3.6, low = svf(noise(sr, d, r), sr, 62, 1.5);
    applyEnv(low, sr, (t) => (0.72 + 0.28 * Math.sin(TAU * 7.5 * t)) * Math.min(1, t / 0.35) * Math.min(1, (d - t) / 0.8));
    mixInto(low, tone(sr, d, (t) => 38 + 3 * Math.sin(TAU * 4 * t), { harmonics: [1, 0.5], env: (t) => 0.55 * Math.min(1, t / 0.4) * Math.min(1, (d - t) / 0.8) }));
    const rattle = blank(sr, d);
    let at = 0.15;
    while (at < d - 0.5) { mixInto(rattle, knock(sr, r, 700 + r() * 800, 0.7), Math.floor(at * sr), 0.25 + r() * 0.4); at += 0.045 + r() * 0.07; }
    applyEnv(rattle, sr, (t) => Math.min(1, t / 0.5) * Math.min(1, (d - t) / 0.9));
    return mono(layer(sr, d, [[0, low, 1], [0, rattle, 0.38]]));
  },
  // the mountain clearing its throat: a deep bang, a long roar, and glowing drops plopping back down
  disasterEruption(sr, r) {
    const d = 3.8, roar = svf(noise(sr, d, r), sr, sweep(150, 55, d), 1.2);
    applyEnv(roar, sr, (t) => Math.min(1, t / 0.08) * Math.min(1, (d - t) / 1.8));
    const sub = tone(sr, d, (t) => 36 + 90 * Math.exp(-t / 0.12), { env: (t) => Math.min(1, t / 0.01) * (0.45 + 0.55 * Math.exp(-t / 0.5)) * Math.min(1, (d - t) / 1.4) });
    const list = [[0, sub, 1], [0, band(sr, 0.4, 2600, 0.7, perc(0.0006, 0.04), r), 0.4], [0.02, roar, 1.2], [1.1, sizzle(sr, r, d - 1.2, 0.5), 0.5]];
    for (let i = 0; i < 9; i++) {
      const f = 240 + r() * 260, at = 0.9 + r() * (d - 1.6);
      list.push([at, tone(sr, 0.2, (t) => f * (1 + 3.4 * t), { env: perc(0.008, 0.07) }), 0.3 + r() * 0.2]);
    }
    return mono(layer(sr, d, list));
  },
  // a lava bomb coming down, a descending whistle so short nobody minds it
  disasterBomb(sr) {
    return mono(tone(sr, 0.5, sweep(1500, 420, 0.5), { harmonics: [1, 0.22], env: hold(0.02, 0.42, 0.05) }), 0.5);
  },
  // Semeru, a long way off: thunder heard through a valley, no attack at all
  disasterCloud(sr, r) {
    const d = 3.4, roll = svf(noise(sr, d, r), sr, sweep(190, 72, d), 0.9);
    applyEnv(roll, sr, (t) => (t < 0.28 ? t / 0.28 : 1) * (0.68 + 0.32 * Math.sin(TAU * 1.9 * t + 1)) * Math.min(1, (d - t) / 1.7));
    return mono(layer(sr, d, [[0, band(sr, 0.6, 650, 0.8, perc(0.03, 0.14), r), 0.7], [0, roll, 1]]), 0.8);
  },
  // the Agung's mud: slow, thick, a river with big bubbles where the debris is all stones
  disasterLahar(sr, r) {
    const d = 4, river = svf(noise(sr, d, r), sr, (t) => 300 + 110 * Math.sin(TAU * 0.8 * t), 1.4);
    applyEnv(river, sr, (t) => Math.min(1, t / 0.7) * Math.min(1, (d - t) / 1.1));
    const list = [[0, thud(sr, 95, 38, 0.8), 0.9], [0, river, 0.75]];
    let at = 0.12;
    while (at < d - 0.45) {
      const f = 88 + r() * 120, up = 2.2 + r() * 2.2;
      list.push([at, tone(sr, 0.3, (t) => f * (1 + up * t), { harmonics: [1, 0.3], env: perc(0.012, 0.09) }), 0.6 + r() * 0.4]);
      at += 0.11 + r() * 0.2;
    }
    return mono(layer(sr, d, list));
  },
  // a street turning into a river: rushing water and big lazy slops
  disasterBanjir(sr, r) {
    const d = 4, rush = svf(noise(sr, d, r), sr, (t) => 900 + 420 * Math.sin(TAU * 0.5 * t), 0.7);
    applyEnv(rush, sr, (t) => Math.min(1, t / 0.5) * Math.min(1, (d - t) / 1));
    const list = [[0, rush, 0.8], [0, thud(sr, 70, 40, 0.6), 0.6]];
    let at = 0.15;
    while (at < d - 0.5) {
      const f = 240 + r() * 300;
      list.push([at, tone(sr, 0.22, (t) => f * (1 + 2.4 * t), { harmonics: [1, 0.2], env: perc(0.01, 0.07) }), 0.34 + r() * 0.26]);
      at += 0.09 + r() * 0.18;
    }
    return mono(layer(sr, d, list));
  },
  // the horns of Jakarta. A scooter's nasal double beep, a bajaj's flat little toot, a car's two tones, a bus's air horn with its rise
  hornBeep(sr, r) {
    const f = 620 + r() * 180, hit = (dur) => tone(sr, dur, () => f, { harmonics: [1, 0.7, 0.5, 0.35, 0.2], env: perc(0.004, dur * 0.8) });
    return mono(layer(sr, 0.4, [[0, hit(0.13), 0.9], [0.17, hit(0.18), 0.9]]));
  },
  hornToot(sr, r) {
    const f = 410 + r() * 60;
    return mono(layer(sr, 0.5, [[0, tone(sr, 0.42, (t) => f * (1 - 0.05 * t), { harmonics: [1, 0.9, 0.7, 0.5, 0.3, 0.2], env: perc(0.006, 0.3) }), 0.95]]));
  },
  hornCar(sr, r) {
    const a = 420 + r() * 30, b = a * 1.26, t = (f) => tone(sr, 0.5, () => f, { harmonics: [1, 0.6, 0.4, 0.25], env: perc(0.008, 0.36) });
    return mono(layer(sr, 0.55, [[0, t(a), 0.7], [0, t(b), 0.7]]));
  },
  hornAir(sr, r) {
    const f = 196 + r() * 16, t = (m) => tone(sr, 0.9, (x) => f * m * (1 + 0.05 * Math.min(1, x * 6)), { harmonics: [1, 0.8, 0.6, 0.45, 0.3, 0.2], env: perc(0.05, 0.6) });
    return mono(layer(sr, 1, [[0, t(1), 0.6], [0, t(1.5), 0.5], [0, t(2.02), 0.34]]));
  },
  hornBell(sr, r) {
    return mono(layer(sr, 0.5, [[0, ding(sr, 2300 + r() * 200, 0.3), 0.7], [0.14, ding(sr, 2300 + r() * 200, 0.32), 0.8]]));
  },
  // a motorbike seen off with a wobble and a clatter, no harm done
  trafficScatter(sr, r) {
    return mono(layer(sr, 0.5, [[0, thud(sr, 180, 70, 0.14), 0.7], [0.02, boing(sr, 340, 620, 0.26), 0.5], [0.05, soften(band(sr, 0.3, 2400, 1, perc(0.004, 0.1), r), sr, 5500), 0.6]]));
  },
  // into the back of a car: a big soft bonk, a tinkle, and its horn jammed for a moment
  trafficCrash(sr, r) {
    const horn = tone(sr, 0.6, () => 455, { harmonics: [1, 0.7, 0.5, 0.3], env: perc(0.01, 0.42) });
    return mono(layer(sr, 0.8, [[0, thud(sr, 150, 44, 0.3), 1], [0.01, knock(sr, r, 700), 0.8], [0.05, ding(sr, 3100, 0.2), 0.3], [0.09, ding(sr, 2700, 0.2), 0.26], [0.14, horn, 0.5]]));
  },
  // two bells of a railway crossing, and they do not stop until the train has gone
  crossingBell(sr, r) {
    const b = () => ding(sr, 1180, 0.34, 1), c = () => ding(sr, 1490, 0.34, 1);
    return mono(layer(sr, 1.2, [[0, b(), 0.9], [0.3, c(), 0.9], [0.6, b(), 0.9], [0.9, c(), 0.9]]));
  },
  trainPass(sr, r) {
    const d = 4.4, roll = svf(noise(sr, d, r), sr, 260, 0.9);
    applyEnv(roll, sr, (t) => Math.min(1, t / 0.5) * Math.min(1, (d - t) / 1) * (0.7 + 0.3 * Math.abs(Math.sin(TAU * 2.2 * t))));
    const horn = tone(sr, 1.1, (t) => 330 * (1 - 0.02 * t), { harmonics: [1, 0.8, 0.6, 0.4], env: perc(0.05, 0.8) });
    return mono(layer(sr, d, [[0, roll, 1], [0.1, horn, 0.6]]));
  },
  // a snow bank giving way against a bumper
  disasterSnow(sr, r) {
    return mono(layer(sr, 0.5, [[0, thud(sr, 210, 80, 0.16), 0.9], [0, soften(band(sr, 0.42, 1700, 0.6, perc(0.004, 0.13), r), sr, 5000), 1]]), 0.7);
  },
  // a roof tile from the quake: a bright clack on the road, and one bit skittering off
  disasterTile(sr, r) {
    return mono(layer(sr, 0.3, [[0, knock(sr, r, 880), 1], [0, knock(sr, r, 1460), 0.6], [0.09, knock(sr, r, 1800, 0.6), 0.5], [0.16, knock(sr, r, 2100, 0.4), 0.3]]), 0.6);
  },

  // what happens to karts
  hitSpin(sr, r) {
    const swirl = tone(sr, 0.7, (t) => 500 + 760 * Math.sin((TAU * t) / 0.34) ** 2 + t * 500, { harmonics: [1, 0.2], env: hold(0.02, 0.45, 0.22) });
    return mono(layer(sr, 0.9, [[0, knock(sr, r, 260), 1], [0, thud(sr, 150, 60, 0.2), 0.8], [0.04, swirl, 0.42]]));
  },
  hitTumble(sr, r) {
    const list = [[0, thud(sr, 160, 44, 0.34), 1], [0, knock(sr, r, 220), 1]];
    for (let i = 0; i < 6; i++) list.push([0.13 + i * (0.11 - i * 0.008), knock(sr, r, 260 + r() * 340), 0.8 - i * 0.09]);
    for (let i = 0; i < 4; i++) list.push([0.42 + i * 0.09, ding(sr, 1700 + i * 240, 0.3), 0.14]);
    return mono(layer(sr, 1.1, list));
  },
  wall(sr, r) { return mono(layer(sr, 0.26, [[0, thud(sr, 130, 70, 0.2), 1], [0, knock(sr, r, 360), 0.45]]), 0.62); },
  bump(sr, r) { return mono(layer(sr, 0.26, [[0, boing(sr, 240, 150, 0.2), 1], [0, knock(sr, r, 420), 0.4]]), 0.62); },
  jump(sr) { return mono(boing(sr, 240, 660, 0.26), 0.56); },
  land(sr, r) { return mono(layer(sr, 0.34, [[0, thud(sr, 120, 50, 0.3), 1], [0, boing(sr, 200, 130, 0.16), 0.4], [0, band(sr, 0.14, 2200, 0.8, perc(0.001, 0.03), r), 0.26]]), 0.7); },
  driftStart(sr, r) {
    const chirp = band(sr, 0.18, 2200, 2.2, perc(0.002, 0.05), r);
    return mono(layer(sr, 0.24, [[0, boing(sr, 320, 460, 0.12), 0.6], [0.015, chirp, 0.9]]), 0.48);
  },
  tier1(sr) { return mono(layer(sr, 0.3, [[0, ding(sr, 1320, 0.26), 1]]), 0.45); },
  tier2(sr) { return mono(layer(sr, 0.4, [[0, ding(sr, 1320, 0.2), 0.7], [0.06, ding(sr, 1760, 0.3), 1]]), 0.5); },
  tier3(sr) { return mono(layer(sr, 0.5, [[0, ding(sr, 1320, 0.2), 0.6], [0.05, ding(sr, 1760, 0.2), 0.75], [0.1, ding(sr, 2349, 0.36), 1]]), 0.56); },
  boostPad(sr, r) { return mono(layer(sr, 0.7, [[0, whoosh(sr, r, 0.65, 300, 3800, 0.9, 1, 0.2), 1], [0, thud(sr, 90, 170, 0.3), 0.5]]), 0.72); },
  boostDrift(sr, r) { return mono(layer(sr, 0.5, [[0, knock(sr, r, 840), 0.55], [0, whoosh(sr, r, 0.45, 500, 3000, 0.9, 1, 0.12), 1]]), 0.68); },
  rescue(sr) {
    // wings and a friendly up-and-away whistle
    const flaps = blank(sr, 1.1);
    for (let i = 0; i < 9; i++) mixInto(flaps, tone(sr, 0.08, 150, { harmonics: [1, 0.5, 0.2], env: perc(0.004, 0.018) }), samples(sr, i * 0.11), 0.5);
    const up = tone(sr, 0.95, (t) => 640 + 520 * t + 45 * Math.sin(TAU * 7 * t), { env: hold(0.05, 0.6, 0.3) });
    return mono(layer(sr, 1.1, [[0, flaps, 1], [0, up, 0.5]]), 0.64);
  },
  overtake(sr) { return mono(layer(sr, 0.3, [[0, tone(sr, 0.14, 988, { harmonics: [1, 0.2], env: perc(0.002, 0.04) }), 1], [0.07, tone(sr, 0.2, 1319, { harmonics: [1, 0.2], env: perc(0.002, 0.07) }), 1]]), 0.4); },
  overtaken(sr) { return mono(layer(sr, 0.3, [[0, tone(sr, 0.14, 740, { harmonics: [1, 0.2], env: perc(0.002, 0.04) }), 1], [0.08, tone(sr, 0.2, 554, { harmonics: [1, 0.2], env: perc(0.002, 0.07) }), 1]]), 0.34); },

  // the race itself
  lap(sr) { return mono(layer(sr, 1, [[0, ding(sr, 1047, 0.75), 1], [0.18, ding(sr, 1319, 0.8), 1]]), 0.68); },
  lastLap(sr) {
    // three stamped band chords, the last one held, the same reeds as the music
    const stab = (f, d) => {
      const x = blank(sr, d);
      for (const [r, a] of [[1, 1], [1.26, 0.85], [1.5, 0.85], [2, 0.55]]) {
        for (const c of [-0.006, 0.006]) mixInto(x, tone(sr, d, f * r * (1 + c), { harmonics: [1, 0.7, 0.5, 0.36, 0.25, 0.16], env: hold(0.012, d - 0.1, 0.08), gain: a * 0.4 }), 0);
      }
      return x;
    };
    return mono(layer(sr, 1.4, [[0, stab(392, 0.17), 1], [0.2, stab(392, 0.17), 1], [0.4, stab(440, 0.17), 1], [0.6, stab(523, 0.75), 1.15]]), 0.8);
  },
  finish(sr, r) {
    const list = [];
    [523, 659, 784, 1047, 1319].forEach((f, i) => list.push([i * 0.1, ding(sr, f, 0.8), 0.7]));
    const crowd = band(sr, 2, 1500, 0.5, (t) => Math.min(1, t / 0.3) * Math.max(0, 1 - t / 2) ** 1.2, r);
    list.push([0.1, crowd, 1.2]);
    return mono(layer(sr, 2.2, list), 0.82);
  },
  countdown(sr) { return mono(layer(sr, 0.36, [[0, ding(sr, 659, 0.3), 1], [0, knock(sr, rng32(3), 520), 0.3]]), 0.74); },
  go(sr) { return mono(layer(sr, 0.9, [[0, ding(sr, 1319, 0.8), 1], [0, ding(sr, 659, 0.8), 0.7], [0, ding(sr, 988, 0.7), 0.5]]), 0.82); },

  // menus
  click(sr, r) { return mono(knock(sr, r, 900, 1), 0.68); },
  move(sr, r) { return mono(knock(sr, r, 660, 0.8), 0.56); },
  back(sr, r) { return mono(layer(sr, 0.14, [[0, knock(sr, r, 700), 0.8], [0.05, knock(sr, r, 460), 0.8]]), 0.62); },
  confirm(sr) { return mono(layer(sr, 0.4, [[0, ding(sr, 880, 0.3), 0.8], [0.07, ding(sr, 1319, 0.35), 1]]), 0.6); },

  // the neighbours on the road
  cowbells(sr, r) {
    const list = [];
    for (let i = 0; i < 7; i++) {
      const f = i % 3 === 0 ? 430 : i % 3 === 1 ? 640 : 530;
      const bell = blank(sr, 0.4);
      for (const [k, a, d] of [[1, 1, 0.1], [1.51, 0.72, 0.08], [2.27, 0.45, 0.04], [3.13, 0.3, 0.025]]) mixInto(bell, tone(sr, 0.4, f * k, { env: perc(0.0008, d) }), 0, a);
      list.push([i * 0.2 + r() * 0.08, bell, 0.7 + r() * 0.3]);
    }
    return mono(layer(sr, 2, list), 0.68);
  },
  moo(sr) {
    const x = mouth(sr, 1.1, (t) => 118 + 38 * Math.sin(Math.min(1, t / 1.1) * Math.PI), [V.u, V.u, V.o, V.u], hold(0.14, 0.7, 0.26));
    return mono(x, 0.66);
  },
  sheep(sr) {
    const x = mouth(sr, 0.72, (t) => 310 + 40 * Math.exp(-t / 0.2), [V.e, V.a, V.a, V.e], hold(0.05, 0.45, 0.22), 0.06);
    return mono(x, 0.62);
  },
  dog(sr, r) {
    const woof = () => mouth(sr, 0.15, (t) => 320 - 900 * t, [V.a, V.o], (t) => (t < 0.012 ? t / 0.012 : Math.exp(-(t - 0.012) / 0.06)));
    return mono(layer(sr, 0.5, [[0, woof(), 1], [0.2, woof(), 0.9], [0.002, band(sr, 0.05, 1400, 1, perc(0.0005, 0.012), r), 0.1]]), 0.64);
  },
  bear(sr) {
    const x = mouth(sr, 0.9, (t) => 92 + 22 * Math.sin(TAU * 1.2 * t), [V.o, V.a, V.o], hold(0.08, 0.55, 0.27), 0.04);
    return mono(x, 0.68);
  },
  monkey(sr) {
    const list = [];
    [0, 0.13, 0.26, 0.4, 0.5].forEach((at, i) => {
      const up = i % 2 ? 1 : 1.3;
      list.push([at, mouth(sr, 0.11, sweep(620 * up, 1180 * up, 0.11), [V.u, V.a], hold(0.01, 0.07, 0.03)), 1]);
    });
    return mono(layer(sr, 0.7, list), 0.6);
  },
  bats(sr, r) {
    const list = [];
    for (let i = 0; i < 8; i++) {
      const f = 2800 + r() * 2400;
      list.push([r() * 0.5, tone(sr, 0.05, sweep(f, f * 0.6, 0.05), { env: hold(0.004, 0.03, 0.015) }), 0.8]);
      list.push([i * 0.075, tone(sr, 0.05, 210, { harmonics: [1, 0.4, 0.2], env: perc(0.003, 0.012) }), 0.4]);
    }
    return mono(layer(sr, 0.8, list), 0.5);
  },
  steam(sr, r) {
    const x = band(sr, 1.2, 3800, 0.55, hold(0.03, 0.75, 0.4), r);
    mixInto(x, band(sr, 1.2, 1100, 0.6, hold(0.05, 0.6, 0.5), r), 0, 0.8);
    return mono(soften(x, sr, 7000), 0.6);
  },
  pony(sr, r) {
    const clop = (f) => knock(sr, r, f);
    const list = [[0, clop(520), 0.8], [0.13, clop(420), 0.6], [0.28, clop(520), 0.8], [0.41, clop(420), 0.6]];
    list.push([0.1, mouth(sr, 0.5, (t) => 640 + 180 * Math.sin(TAU * 14 * t) * (1 - t), [V.i, V.e, V.a], hold(0.03, 0.34, 0.13)), 0.42]);
    return mono(layer(sr, 0.7, list), 0.62);
  },
  kids(sr) {
    const list = [];
    [[0, 720], [0.11, 880], [0.21, 780], [0.32, 980], [0.42, 860]].forEach(([at, f]) => {
      list.push([at, mouth(sr, 0.09, sweep(f, f * 1.14, 0.09), [V.i, V.e], hold(0.012, 0.05, 0.028)), 0.8]);
    });
    return mono(layer(sr, 0.65, list), 0.5);
  },
  whee(sr) { return mono(mouth(sr, 0.45, sweep(520, 1160, 0.45), [V.u, V.i, V.i], hold(0.03, 0.32, 0.1)), 0.5); },

  // the small mechanical ticks of each kart, fired from engine.js in time with the wheels
  tickClank(sr, r) { return mono(layer(sr, 0.09, [[0, knock(sr, r, 310), 0.8], [0, band(sr, 0.06, 2300, 2, perc(0.0003, 0.012), r), 0.45]]), 0.5); },
  tickChain(sr, r) { return mono(band(sr, 0.03, 4800, 2.2, perc(0.0002, 0.004), r), 0.42); },
  tickFlap(sr, r) { return mono(band(sr, 0.14, 720, 0.8, (t) => (t < 0.02 ? t / 0.02 : Math.exp(-(t - 0.02) / 0.03)), r), 0.5); },
  tickCreak(sr) { return mono(tone(sr, 0.14, (t) => 620 + 280 * Math.sin(TAU * 8 * t), { harmonics: [1, 0.5, 0.36, 0.2], env: hold(0.015, 0.08, 0.04) }), 0.32); },
  tickRattle(sr, r) { return mono(layer(sr, 0.1, [[0, knock(sr, r, 720), 0.8], [0.02, knock(sr, r, 980), 0.5]]), 0.42); },
  tickChunk(sr, r) { return mono(layer(sr, 0.22, [[0, knock(sr, r, 240), 1], [0.07, knock(sr, r, 430), 0.7], [0, thud(sr, 90, 50, 0.16), 0.6]]), 0.54); },
  tickStone(sr, r) { return mono(layer(sr, 0.12, [[0, knock(sr, r, 170), 1], [0.012, band(sr, 0.05, 900, 0.9, perc(0.0005, 0.016), r), 0.5]]), 0.52); },
  // the family: a short cross meow that ends on a snap of little teeth; pots and pans
  biteChomp(sr, r) { return mono(layer(sr, 0.34, [[0, mouth(sr, 0.2, sweep(780, 540, 0.2), [V.i, V.a, V.u], hold(0.015, 0.12, 0.06)), 0.9], [0.17, knock(sr, r, 430), 1], [0.2, knock(sr, r, 640), 0.7], [0.17, band(sr, 0.05, 2300, 1.4, perc(0.0005, 0.02), r), 0.4]]), 0.56); },
  panClank(sr, r) { return mono(layer(sr, 0.36, [[0, ding(sr, 1180, 0.2), 1], [0.035, ding(sr, 1730, 0.16), 0.7], [0, knock(sr, r, 640), 0.6]]), 0.42); },
  // the hunt: a fat wet plop and a little fanfare for the taking, a thud and a falling slide for the losing
  formaGrab(sr, r) { return mono(layer(sr, 0.72, [[0, thud(sr, 150, 70, 0.2), 0.9], [0.01, knock(sr, r, 300), 0.5], [0.08, ding(sr, 784, 0.3), 0.55], [0.17, ding(sr, 988, 0.3), 0.6], [0.26, ding(sr, 1319, 0.42), 0.75]]), 0.62); },
  formaDrop(sr, r) { return mono(layer(sr, 0.9, [[0, thud(sr, 120, 44, 0.3), 1], [0.02, knock(sr, r, 200), 0.8], [0.06, tone(sr, 0.5, sweep(620, 150, 0.5), { harmonics: [1, 0.4, 0.2], env: hold(0.01, 0.3, 0.15) }), 0.5], [0.28, thud(sr, 96, 56, 0.16), 0.5], [0.46, thud(sr, 96, 56, 0.14), 0.36], [0.62, thud(sr, 96, 56, 0.12), 0.24]]), 0.66); },
  formaOther(sr) { return mono(layer(sr, 0.36, [[0, ding(sr, 523, 0.24), 0.8], [0.09, ding(sr, 659, 0.26), 0.7]]), 0.42); },
  formaLead(sr) { return mono(layer(sr, 0.5, [[0, ding(sr, 880, 0.3), 0.7], [0.1, ding(sr, 1175, 0.36), 0.8]]), 0.44); },
  formaTick(sr, r) { return mono(layer(sr, 0.2, [[0, ding(sr, 1046, 0.14), 1], [0, knock(sr, r, 700), 0.4]]), 0.5); },
  formaEnd(sr) {
    // a cheesemaker's horn, three calls and a long one
    const horn = (f, d) => tone(sr, d, f, { harmonics: [1, 0.6, 0.42, 0.2, 0.1], env: hold(0.03, d * 0.7, d * 0.2) });
    return mono(layer(sr, 1.5, [[0, horn(392, 0.2), 0.8], [0.24, horn(392, 0.2), 0.8], [0.48, horn(392, 0.2), 0.8], [0.74, horn(523, 0.74), 1]]), 0.6);
  },
  bellTing(sr) { return mono(layer(sr, 0.5, [[0, ding(sr, 2090, 0.42), 1], [0.09, ding(sr, 2090, 0.42), 0.7]]), 0.5); },
  whistle(sr, r) {
    // the little loco clears its throat
    const a = tone(sr, 0.75, 940, { harmonics: [1, 0.35], env: hold(0.04, 0.55, 0.16) });
    mixInto(a, tone(sr, 0.75, 1186, { harmonics: [1, 0.3], env: hold(0.04, 0.55, 0.16), gain: 0.7 }));
    mixInto(a, band(sr, 0.75, 3400, 1.2, hold(0.02, 0.6, 0.13), r), 0, 0.2);
    return mono(a, 0.5);
  },
};

// Driver pitches come from the roster: small animals squeak, the bear rumbles, nobody says a word.
const VOICE_HZ = 400;
export const DRIVERS = Object.fromEntries(ROSTER.map((k) => [k.id, VOICE_HZ * (k.driver?.pitch ?? 1) ** 1.6]));
const SYLLABLE = {
  hit: [[[1.25, 0.8], [V.a, V.o], 0.2], [[0.95, 0.7], [V.u], 0.11]],
  cheer: [[[1, 1.35], [V.a, V.i], 0.15], [[1.1, 1.45], [V.e, V.i], 0.15], [[1.3, 1.75], [V.i, V.a], 0.24]],
  ouch: [[[1.5, 0.9], [V.i, V.u], 0.22]],
};

export function renderVoice(sr, kart, kind) {
  const f = DRIVERS[kart] ?? VOICE_HZ;
  const syll = SYLLABLE[kind] ?? SYLLABLE.hit;
  let at = 0;
  const list = [];
  for (const [[a, b], vowels, d] of syll) {
    list.push([at, mouth(sr, d, sweep(f * a, f * b, d), vowels, hold(0.012, d - 0.05, 0.038)), 1]);
    at += d + 0.015;
  }
  return mono(layer(sr, at + 0.05, list), 0.62);
}

// The rest of the game calls events by name; this table picks what to hear for each hazard kind the tracks name.
const HAZARD_SOUND = [
  [/cow/, ['cowbells', 'moo']], [/sheep|flock/, ['sheep', 'dog']], [/bear/, ['bear']], [/bat/, ['bats']],
  [/frana/, ['frana']], [/steam|vent|sulph/, ['steam']], [/pony|ponies|horse/, ['pony']], [/macaque|monkey/, ['monkey']], [/sled|kid/, ['kids', 'whee']],
];
// One voice for each kind of natural disaster, heard when it lets go. A new kind in sim/disasters.js needs its line here.
export const DISASTER_SOUND = { debris: 'disasterDebris', avalanche: 'disasterAvalanche', rockfall: 'disasterRockfall', quake: 'disasterQuake', eruption: 'disasterEruption', cloud: 'disasterCloud', lahar: 'disasterLahar', banjir: 'disasterBanjir' };
export function hazardSounds(kind) {
  const k = String(kind ?? '').toLowerCase();
  return HAZARD_SOUND.find(([re]) => re.test(k))?.[1] ?? [];
}

export const LOOPS = ['razzoLoop', 'sizzleLoop', 'flameLoop', 'cityLoop', 'rainLoop', 'windLoop', 'nightLoop'];

export function createSfx(ctx, mix) {
  const sr = ctx.sampleRate;
  const buffers = new Map();
  const lastFired = new Map();
  const live = new Map();

  const toBuf = (chans) => {
    const b = ctx.createBuffer(chans.length, chans[0].length, sr);
    chans.forEach((c, i) => b.copyToChannel(c, i));
    return b;
  };
  function get(name) {
    let b = buffers.get(name);
    if (b) return b;
    if (name.startsWith('voice:')) {
      const [, kart, kind] = name.split(':');
      b = toBuf(renderVoice(sr, kart, kind));
    } else {
      const fn = SFX[name];
      if (!fn) return null;
      b = toBuf(fn(sr, rng32(hash(name))));
    }
    buffers.set(name, b);
    return b;
  }

  const send = ctx.createGain();
  send.gain.value = 0.09;
  send.connect(mix.sends.sfx);

  // Bumps can arrive twenty to the second in a pile-up. Each name gets a minimum gap and a cap, or it turns to static.
  const GAP = { hornBeep: 0.08, hornToot: 0.14, hornCar: 0.16, hornAir: 0.5, hornBell: 0.3, trafficScatter: 0.09, crossingBell: 1.15, tick: 0.03, bump: 0.12, wall: 0.12, land: 0.1, tickChain: 0.02, default: 0.035 };
  const CAP = { hornBeep: 3, hornToot: 2, hornCar: 2, hornAir: 2, trafficCrash: 2, crossingBell: 1, trainPass: 1, default: 5, boom: 3, bump: 2, wall: 2, frana: 2, disasterRumble: 1, disasterBomb: 2, disasterSnow: 2, disasterTile: 2 };

  function fire(name, { gain = 1, pan = 0, rate = 1, when = 0, wet = 1 } = {}) {
    const buf = get(name);
    if (!buf) return null;
    const now = ctx.currentTime;
    const t = Math.max(now, when || now);
    const gap = GAP[name] ?? GAP.default;
    if (t - (lastFired.get(name) ?? -1) < gap) return null;
    const count = live.get(name) ?? 0;
    if (count >= (CAP[name] ?? CAP.default)) return null;
    lastFired.set(name, t);
    live.set(name, count + 1);
    const s = ctx.createBufferSource();
    s.buffer = buf;
    s.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = clamp(gain, 0, 1.4);
    const p = ctx.createStereoPanner();
    p.pan.value = clamp(pan, -1, 1);
    s.connect(g).connect(p).connect(mix.sfx);
    if (wet > 0) {
      const w = ctx.createGain();
      w.gain.value = wet;
      p.connect(w).connect(send);
    }
    s.onended = () => { live.set(name, Math.max(0, (live.get(name) ?? 1) - 1)); try { p.disconnect(); } catch { /* gone */ } };
    s.start(t);
    return s;
  }

  // Warm the catalogue in small slices so the first boom of a race does not cost a frame.
  const warmList = () => Object.keys(SFX).filter((n) => !buffers.has(n)).map((n) => () => get(n));

  return { fire, get, warmList };
}
