// One chubby engine voice per view, each kart with its own character, plus a few cheap hums for whoever else is near.
// Nothing here allocates per frame beyond param ramps: the graph is built once per view and steered.
import { clamp, lerp, rng32, noise, samples } from './dsp.js';

const TOP = 34;

// base/span: Hz at idle and how far it climbs. wave: harmonic amps. cut: lowpass at rest and flat out.
// chuff: amplitude pulsing per m/s, the firing rate you can count. grit: noise layer in the engine body.
// tick: a small mechanical sound repeated with the wheels (name, per metre).
export const KART_SOUND = {
  // a little barn on a tractor engine: slow, thumpy, loose shingles
  tabia: { base: 44, span: 1.85, wave: [1, 0.95, 0.72, 0.6, 0.42, 0.34, 0.24, 0.16], sub: 0.5, cut: [520, 1800], chuff: { rate: 0.34, min: 7, depth: 0.5 }, grit: { f: 800, q: 1.1, g: 0.05 }, tick: { name: 'tickRattle', every: 7, gain: 0.3 } },
  // a groomer: a low diesel with the steel of its tracks clanking
  gatto: { base: 36, span: 1.6, wave: [1, 0.8, 0.86, 0.5, 0.52, 0.3, 0.3, 0.2, 0.16, 0.1], sub: 0.7, cut: [380, 1300], chuff: { rate: 0.22, min: 9, depth: 0.32 }, grit: { f: 420, q: 0.9, g: 0.09 }, tick: { name: 'tickClank', every: 2.6, gain: 0.34 } },
  // a chairlift: an electric hum that rises like a tram, and the bullwheel going over a pylon
  seggiovia: { base: 98, span: 1.6, wave: [1, 0.08, 0.5, 0.05, 0.28, 0.02, 0.1], sub: 0.3, cut: [1400, 3200], gain: 0.55, chuff: { rate: 0, min: 0, depth: 0 }, grit: { f: 2600, q: 3, g: 0.025 }, tick: { name: 'tickChunk', every: 11, gain: 0.4 }, whine: { ratio: 4.02, gain: 0.08 } },
  // a steam loco: hardly any tone, the whole voice is chuffs of hiss
  mocanita: { base: 34, span: 1.25, wave: [1, 0.5, 0.25, 0.1], sub: 0.5, cut: [240, 520], gain: 1, chuff: { rate: 0.25, min: 2.2, depth: 1, shape: 'puff' }, grit: { f: 1700, q: 0.7, g: 1.1 }, tick: null },
  // a wooden cart: a tiny motor hidden under the hay, and everything creaks
  caruta: { base: 66, span: 1.7, wave: [1, 0.55, 0.42, 0.26, 0.18, 0.1], sub: 0.2, cut: [800, 2400], chuff: { rate: 0.5, min: 6, depth: 0.36 }, grit: { f: 1100, q: 1.2, g: 0.04 }, tick: { name: 'tickCreak', every: 6, gain: 0.3 } },
  // a very old saloon with a hole in the exhaust: low, uneven, a lot of grit, and every panel answers
  logan: { base: 48, span: 1.9, wave: [1, 0.3, 0.9, 0.25, 0.7, 0.2, 0.55, 0.18, 0.4, 0.14, 0.3], sub: 0.34, cut: [1000, 2600], gain: 0.9, chuff: { rate: 0.26, min: 6, depth: 0.34 }, grit: { f: 720, q: 2.2, g: 0.2 }, tick: { name: 'tickRattle', every: 7, gain: 0.36 } },
  // a tired four-by-four: gritty, plenty of revs, shifts you can hear
  jeep: { base: 52, span: 2.3, wave: [1, 1, 0.82, 0.8, 0.62, 0.55, 0.44, 0.36, 0.28, 0.2, 0.15], sub: 0.32, cut: [700, 3000], chuff: { rate: 0.32, min: 12, depth: 0.2 }, grit: { f: 1300, q: 1.0, g: 0.08 }, tick: { name: 'tickRattle', every: 16, gain: 0.2 }, gears: 3 },
  // a pedal cab: a whirring chain, a small helper motor, a bell
  becak: { base: 140, span: 1.9, wave: [1, 0.3, 0.2, 0.1, 0.05], sub: 0, cut: [1300, 3600], gain: 0.6, chuff: { rate: 0.62, min: 5, depth: 0.28 }, grit: { f: 3800, q: 2, g: 0.05 }, tick: { name: 'tickChain', every: 1.3, gain: 0.3 } },
  // a longtail outboard: a nasal buzz, the sail snapping as it goes
  jukung: { base: 76, span: 2.1, wave: [1, 0.7, 0.92, 0.55, 0.72, 0.42, 0.5, 0.3, 0.3, 0.2, 0.18, 0.14], sub: 0.12, cut: [1100, 3400], chuff: { rate: 0.5, min: 18, depth: 0.16 }, grit: { f: 1900, q: 1.4, g: 0.05 }, tick: { name: 'tickFlap', every: 9, gain: 0.34 } },
  // the kennel: the engine is a purr, a low tone beating fast, and it never quite stops being pleased
  baileys: { base: 58, span: 1.75, wave: [1, 0.62, 0.4, 0.22, 0.12], sub: 0.42, cut: [620, 1900], gain: 0.8, chuff: { rate: 0.9, min: 5, depth: 0.5 }, grit: { f: 520, q: 1, g: 0.04 } },
  // the trolley: a small electric whine under casters rattling on every joint, and a loose lid
  fifi: { base: 92, span: 1.8, wave: [1, 0.46, 0.3, 0.16, 0.08], sub: 0.1, cut: [1000, 2800], gain: 0.6, chuff: { rate: 0.4, min: 8, depth: 0.16 }, grit: { f: 2600, q: 2, g: 0.03 }, tick: { name: 'tickRattle', every: 5, gain: 0.24 } },
};

const SURFACE = {
  asphalt: { f: 340, q: 0.5, g: 0.035 },
  dirt: { f: 820, q: 0.5, g: 0.13 },
  sand: { f: 1500, q: 0.4, g: 0.13 },
  snow: { f: 2700, q: 0.5, g: 0.09 },
  ice: { f: 5200, q: 1.1, g: 0.04 },
  wood: { f: 240, q: 0.9, g: 0.16 },
  cobble: { f: 480, q: 0.8, g: 0.18 },
};

const VIEW_PAN = { 1: [0], 2: [-0.4, 0.4], 3: [-0.4, 0.4, -0.4], 4: [-0.4, 0.4, -0.4, 0.4] };

function makeWave(ctx, amps) {
  const imag = new Float32Array(amps.length + 1), real = new Float32Array(amps.length + 1);
  amps.forEach((a, i) => { imag[i + 1] = a; });
  return ctx.createPeriodicWave(real, imag);
}

export function createEngines(ctx, mix, sfx) {
  const noiseBuf = ctx.createBuffer(1, samples(ctx.sampleRate, 2), ctx.sampleRate);
  noiseBuf.copyToChannel(noise(ctx.sampleRate, 2, rng32(77)), 0);
  const waves = {};
  const waveFor = (id) => (waves[id] ??= makeWave(ctx, (KART_SOUND[id] ?? KART_SOUND.jeep).wave));
  const puff = makeWave(ctx, [1, 0.72, 0.5, 0.34, 0.22, 0.14]);

  function makeVoice(kartId) {
    const s = KART_SOUND[kartId] ?? KART_SOUND.jeep;
    const out = ctx.createGain();
    out.gain.value = 0;
    const pan = ctx.createStereoPanner();
    out.connect(pan).connect(mix.engine);
    const sendG = ctx.createGain();
    sendG.gain.value = 0.03;
    pan.connect(sendG).connect(mix.sends.engine);

    const a = ctx.createOscillator(), b = ctx.createOscillator(), sub = ctx.createOscillator();
    a.setPeriodicWave(waveFor(kartId));
    b.setPeriodicWave(waveFor(kartId));
    b.detune.value = 9;
    sub.type = 'sine';
    // from the idle note, or every start of a race would swoop down from the oscillator's default 440 Hz
    a.frequency.value = s.base;
    b.frequency.value = s.base;
    sub.frequency.value = s.base / 2;
    const subG = ctx.createGain();
    subG.gain.value = s.sub;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 1.1;
    lp.frequency.value = s.cut[0];
    const body = ctx.createGain();
    body.gain.value = 0.34 * (s.gain ?? 1);
    a.connect(lp); b.connect(lp); sub.connect(subG).connect(lp);
    lp.connect(body);

    // The firing pulse: the same AM on the tone and on the grit, so an engine reads as one machine.
    const am = ctx.createGain();
    am.gain.value = 1;
    body.connect(am);
    const lfo = ctx.createOscillator();
    if (s.chuff.shape === 'puff') lfo.setPeriodicWave(puff); else lfo.type = 'triangle';
    lfo.frequency.value = Math.max(0.5, s.chuff.min);
    const lfoG = ctx.createGain();
    lfoG.gain.value = s.chuff.depth * 0.5;
    am.gain.value = 1 - s.chuff.depth * 0.5;
    lfo.connect(lfoG).connect(am.gain);
    am.connect(out);

    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const path = (type, f, q) => {
      const flt = ctx.createBiquadFilter();
      flt.type = type;
      flt.frequency.value = f;
      flt.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = 0;
      src.connect(flt).connect(g);
      return { flt, g };
    };
    const grit = path('bandpass', s.grit.f, s.grit.q);
    grit.g.connect(am);
    const surf = path('bandpass', 340, 0.5);
    surf.g.connect(out);
    const skid = path('bandpass', 1500, 2.4);
    skid.g.connect(out);
    const roar = path('lowpass', 620, 0.8);
    roar.g.connect(out);

    let whine = null;
    if (s.whine) {
      whine = ctx.createOscillator();
      whine.type = 'sine';
      whine.frequency.value = s.base * s.whine.ratio;
      const wg = ctx.createGain();
      wg.gain.value = s.whine.gain;
      whine.connect(wg).connect(out);
      whine.start();
    }

    a.start(); b.start(); sub.start(); lfo.start(); src.start();
    const nodes = [a, b, sub, lfo, src, ...(whine ? [whine] : [])];
    return {
      kartId, s, out, pan, a, b, sub, whine, lp, lfo, lfoG, am, grit, surf, skid, roar,
      smooth: 0, wheel: 0, tipsy: 0, lastSurface: '',
      dispose() {
        const t = ctx.currentTime;
        out.gain.cancelScheduledValues(t);
        out.gain.setTargetAtTime(0, t, 0.05);
        for (const n of nodes) { try { n.stop(t + 0.4); } catch { /* stopped */ } }
      },
    };
  }

  const voices = new Map(); // view slot -> voice

  // the others: a triangle each, panned and faded by where they are
  const blips = [];
  function blipPool() {
    if (blips.length) return blips;
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 900;
      const g = ctx.createGain();
      g.gain.value = 0;
      const p = ctx.createStereoPanner();
      o.connect(lp).connect(g).connect(p).connect(mix.engine);
      o.start();
      blips.push({ o, g, p });
    }
    return blips;
  }

  // what a held power sounds like from inside the kart, and a firework passing
  const loops = {};
  function loop(name) {
    if (loops[name]) return loops[name];
    const buf = sfx.get(name);
    if (!buf) return null;
    const s = ctx.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    const g = ctx.createGain();
    g.gain.value = 0;
    const p = ctx.createStereoPanner();
    s.connect(g).connect(p).connect(mix.sfx);
    s.start();
    loops[name] = { s, g, p };
    return loops[name];
  }

  let lastUpdate = -1;
  let silenced = true;

  function silence() {
    if (silenced) return;
    silenced = true;
    const t = ctx.currentTime;
    for (const v of voices.values()) v.out.gain.setTargetAtTime(0, t, 0.12);
    for (const b of blips) b.g.gain.setTargetAtTime(0, t, 0.1);
    for (const l of Object.values(loops)) l.g.gain.setTargetAtTime(0, t, 0.08);
  }

  function steer(v, kart, viewPan, n, dt, racing) {
    const t = ctx.currentTime;
    const s = v.s;
    const speed = Math.abs(Number(kart.speed) || 0);
    const sn = clamp(speed / TOP, 0, 1.3);
    v.smooth = lerp(v.smooth, sn, clamp(dt * 9, 0, 1));
    const boosting = (kart.boostT ?? 0) > 0;
    const air = kart.grounded === false;
    const throttle = kart.throttle ?? 1;
    // an engine in gears: a small sag and climb inside each gear, more if the kart has a lot of them
    const gears = s.gears ?? 2;
    const inGear = (v.smooth * gears) % 1;
    const rpm = 0.08 + v.smooth * 0.86 + inGear * 0.06 + (boosting ? 0.07 + 0.03 * (kart.boostTier || 1) : 0) + (air ? 0.09 : 0) + Math.max(0, throttle) * 0.03;
    let f = s.base * (1 + (s.span - 1) * 2.2 * Math.max(0, rpm) ** 0.85);
    if ((kart.tipsyT ?? 0) > 0) { v.tipsy += dt * 7.2; f *= 1 + 0.045 * Math.sin(v.tipsy); }
    if ((kart.stinkT ?? 0) > 0) { v.tipsy += dt * 11; f *= 1 + 0.03 * Math.sin(v.tipsy); }
    const tc = 0.045;
    v.a.frequency.setTargetAtTime(f, t, tc);
    v.b.frequency.setTargetAtTime(f, t, tc);
    v.sub.frequency.setTargetAtTime(f / 2, t, tc);
    if (v.whine) v.whine.frequency.setTargetAtTime(f * s.whine.ratio, t, tc);
    v.lp.frequency.setTargetAtTime(lerp(s.cut[0], s.cut[1], Math.min(1, rpm)) * (boosting ? 1.25 : 1), t, 0.06);
    if (s.chuff.depth > 0) v.lfo.frequency.setTargetAtTime(Math.max(0.5, s.chuff.min + speed * s.chuff.rate * (s.chuff.shape === 'puff' ? 1 : 4)), t, 0.05);
    v.grit.g.gain.setTargetAtTime(s.grit.g * (0.45 + 0.75 * v.smooth), t, 0.05);

    // the road under the wheels
    const sf = SURFACE[kart.surface] ?? SURFACE.asphalt;
    if (kart.surface !== v.lastSurface) {
      v.lastSurface = kart.surface;
      v.surf.flt.frequency.setTargetAtTime(sf.f, t, 0.03);
      v.surf.flt.Q.setTargetAtTime(sf.q, t, 0.03);
    }
    const off = kart.offroad ? 1.5 : 1;
    v.surf.g.gain.setTargetAtTime(air ? 0 : sf.g * off * Math.min(1, v.smooth * 1.6), t, 0.05);

    const drifting = (kart.drift ?? 0) !== 0 && !air;
    const tier = kart.driftTier ?? 0;
    v.skid.flt.frequency.setTargetAtTime(1300 + 500 * tier + 180 * Math.sin(t * 13), t, 0.03);
    v.skid.g.gain.setTargetAtTime(drifting ? 0.18 + 0.03 * tier : 0, t, drifting ? 0.03 : 0.07);

    const big = boosting ? 0.14 + 0.1 * (kart.boostTier || 1) : 0;
    v.roar.g.gain.setTargetAtTime(big, t, boosting ? 0.03 : 0.14);

    const target = racing ? (kart.finished ? 0.55 : 1) / Math.sqrt(Math.max(1, n)) : 0.6 / Math.sqrt(Math.max(1, n));
    v.out.gain.setTargetAtTime(target, t, 0.08);
    v.pan.pan.setTargetAtTime(viewPan, t, 0.1);

    // the kart's own little noise, in time with how far it has rolled
    if (s.tick && speed > 1 && !air) {
      v.wheel += speed * dt;
      if (v.wheel >= s.tick.every) {
        v.wheel = 0;
        sfx.fire(s.tick.name, { gain: s.tick.gain * (0.6 + 0.5 * v.smooth) * (racing ? 1 : 0.5) / Math.sqrt(Math.max(1, n)), pan: viewPan, rate: 0.94 + ((t * 37) % 1) * 0.12, wet: 0 });
      }
    }
  }

  function update(state, dt, views, listener) {
    lastUpdate = ctx.currentTime;
    const karts = state?.karts;
    if (!Array.isArray(karts) || !karts.length) { silence(); return; }
    silenced = false;
    const racing = state.phase !== 'countdown';
    const list = (views?.length ? views : karts.filter((k) => k?.human).map((k) => k.i)).filter((i) => karts[i]);
    if (!list.length && !views?.length) list.push(0);
    const n = list.length;
    const pans = VIEW_PAN[Math.min(4, n)] ?? VIEW_PAN[4];

    const used = new Set();
    list.slice(0, 4).forEach((idx, slot) => {
      const kart = karts[idx];
      if (!kart) return;
      used.add(slot);
      let v = voices.get(slot);
      if (!v || v.kartId !== kart.kart) {
        v?.dispose();
        v = makeVoice(kart.kart);
        voices.set(slot, v);
      }
      steer(v, kart, pans[slot] ?? 0, n, dt, racing);
    });
    for (const [slot, v] of voices) if (!used.has(slot)) { v.dispose(); voices.delete(slot); }

    updateBlips(karts, list, listener);
    updateLoops(state, list, listener);
  }

  function updateBlips(karts, list, listener) {
    const pool = blipPool();
    const near = [];
    for (let i = 0; i < karts.length; i++) {
      const k = karts[i];
      if (!k || list.includes(i)) continue;
      const pos = listener(k.x, k.z);
      if (pos.gain > 0.03) near.push({ k, pos });
    }
    near.sort((a, b) => b.pos.gain - a.pos.gain);
    const t = ctx.currentTime;
    pool.forEach((b, i) => {
      const hit = near[i];
      if (!hit) { b.g.gain.setTargetAtTime(0, t, 0.08); return; }
      const s = KART_SOUND[hit.k.kart] ?? KART_SOUND.jeep;
      const sn = clamp(Math.abs(hit.k.speed ?? 0) / TOP, 0, 1.2);
      b.o.frequency.setTargetAtTime(s.base * 1.6 * (1 + (s.span - 1) * 1.3 * sn), t, 0.08);
      b.g.gain.setTargetAtTime(0.16 * Math.min(1, hit.pos.gain) * Math.min(1, sn * 2), t, 0.08);
      b.p.pan.setTargetAtTime(hit.pos.pan, t, 0.08);
    });
  }

  function updateLoops(state, list, listener) {
    const t = ctx.currentTime;
    const karts = state.karts;
    const n = Math.max(1, list.length);
    let sizzle = 0, flame = 0;
    for (const i of list) {
      const k = karts[i];
      if (!k) continue;
      if ((k.bigT ?? 0) > 0 || k.boostKind === 'uova') sizzle = Math.max(sizzle, 0.34 / Math.sqrt(n));
      if (k.boostKind === 'sambal' && (k.boostT ?? 0) > 0) flame = Math.max(flame, 0.4 / Math.sqrt(n));
    }
    if (sizzle || loops.sizzleLoop) loop('sizzleLoop')?.g.gain.setTargetAtTime(sizzle, t, 0.06);
    if (flame || loops.flameLoop) loop('flameLoop')?.g.gain.setTargetAtTime(flame, t, 0.06);
    // a city with traffic has its roar, and sometimes its rain
    if (state.traffic) {
      loop('cityLoop')?.g.gain.setTargetAtTime(state.phase === 'race' ? 0.16 : 0.08, t, 0.5);
      loop('rainLoop')?.g.gain.setTargetAtTime((state.traffic.rain || 0) * 0.3, t, 0.5);
    } else {
      if (loops.cityLoop) loops.cityLoop.g.gain.setTargetAtTime(0, t, 0.3);
      if (loops.rainLoop) loops.rainLoop.g.gain.setTargetAtTime(0, t, 0.3);
    }
    // the chosen sky: the road's roar is the same, the air around it is not. In a tunnel it stays outside.
    const WX = state.weather;
    if (WX || loops.windLoop || loops.nightLoop) {
      const under = list.length > 0 && list.every((i) => WX?.cover?.[i]) ? 0.25 : 1, kind = WX?.kind;
      if (kind === 'rain') loop('rainLoop')?.g.gain.setTargetAtTime(0.34 * under, t, 0.5);
      if (kind === 'snow' || kind === 'fog' || loops.windLoop) loop('windLoop')?.g.gain.setTargetAtTime((kind === 'snow' ? 0.2 : kind === 'fog' ? 0.1 : 0) * under, t, 0.5);
      if (WX?.night || loops.nightLoop) loop('nightLoop')?.g.gain.setTargetAtTime((WX?.night && kind !== 'rain' ? 0.075 : 0) * under, t, 0.5);
    }
    let best = 0, bestPan = 0;
    for (const s of state.shots ?? []) {
      if (s?.kind !== 'razzo') continue;
      const pos = listener(s.x, s.z);
      if (pos.gain > best) { best = pos.gain; bestPan = pos.pan; }
    }
    if (best > 0.02 || loops.razzoLoop) {
      const l = loop('razzoLoop');
      if (l) { l.g.gain.setTargetAtTime(0.36 * Math.min(1, best), t, 0.05); l.p.pan.setTargetAtTime(bestPan, t, 0.05); }
    }
  }

  return {
    update,
    silence,
    tick() { if (lastUpdate >= 0 && ctx.currentTime - lastUpdate > 0.5) silence(); },
    dispose() {
      for (const v of voices.values()) v.dispose();
      voices.clear();
      for (const b of blips) { try { b.o.stop(); } catch { /* stopped */ } }
      for (const l of Object.values(loops)) { try { l.s.stop(); } catch { /* stopped */ } }
    },
  };
}
