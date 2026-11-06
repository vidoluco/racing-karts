// The commentators' voices: one pack per language, fetched when the option is chosen and never before, each clip decoded the first time it
// is needed. Their bus goes straight to the master and while they talk the music is held down through mix.duck, the engines a little.
const DUCK_MUSIC = 0.3;     // of the music's own level, while someone talks
const DUCK_ENGINE = 0.72;
const DUCK_ATTACK = 0.05;   // s, time constant: well under the first word
const DUCK_RELEASE = 0.28;
const LEAD_IN = 0.12;       // s between the music going down and the first word
const VOICE_LEVEL = 1.25;
const DECODED_MAX = 48e6;   // bytes of decoded audio kept, each is about 50 times its mp3

export async function loadVoicePack(lang, { base = 'assets/voice/', fetchFn = globalThis.fetch } = {}) {
  const [index, bin] = await Promise.all([fetchFn(`${base}${lang}.json`), fetchFn(`${base}${lang}.bin`)]);
  if (!index.ok || !bin.ok) throw new Error(`no voice pack for ${lang}`);
  return { lang, clips: (await index.json()).clips, bytes: await bin.arrayBuffer() };
}

export function createVoice(ctx, mix, { engineLevel = () => 0.42 } = {}) {
  let pack = null, token = 0, speaking = false, endT = 0, sources = [], gate = null;
  const decoded = new Map();
  let decodedBytes = 0;
  const stats = { played: 0, clips: [], failed: 0, decodes: 0 };

  // Everything here exists only once someone speaks: a race with no commentary has none of these nodes.
  let bus = null, low = null, meter = null, meterBuf = null;
  function ensure() {
    if (bus) return;
    bus = ctx.createGain();
    bus.gain.value = VOICE_LEVEL;
    low = ctx.createBiquadFilter();
    low.type = 'highpass'; low.frequency.value = 110;
    const air = ctx.createBiquadFilter();
    air.type = 'peaking'; air.frequency.value = 2800; air.Q.value = 0.8; air.gain.value = 3.5; // cuts through a screaming engine
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -22; comp.ratio.value = 3.5; comp.attack.value = 0.004; comp.release.value = 0.14;
    meter = ctx.createAnalyser();
    meter.fftSize = 2048;
    meterBuf = new Float32Array(meter.fftSize);
    low.connect(air).connect(comp).connect(bus).connect(meter);
    bus.connect(mix.master);
  }

  function duck(down) {
    const t = ctx.currentTime;
    const music = mix.duck.gain, engine = mix.engine.gain;
    music.cancelScheduledValues(t);
    engine.cancelScheduledValues(t);
    if (down) {
      music.setTargetAtTime(DUCK_MUSIC, t, DUCK_ATTACK);
      engine.setTargetAtTime(engineLevel() * DUCK_ENGINE, t, DUCK_ATTACK);
    } else {
      music.setTargetAtTime(1, t, DUCK_RELEASE);
      engine.setTargetAtTime(engineLevel(), t, DUCK_RELEASE);
    }
  }

  async function bufferOf(id) {
    if (decoded.has(id)) {
      const b = decoded.get(id);
      decoded.delete(id); decoded.set(id, b); // the most recent goes last, the oldest is the first to go
      return b;
    }
    const at = pack?.clips[id];
    if (!at) return null;
    const b = await ctx.decodeAudioData(pack.bytes.slice(at[0], at[0] + at[1]));
    stats.decodes++;
    decoded.set(id, b);
    decodedBytes += b.length * 4;
    for (const [k, v] of decoded) {
      if (decodedBytes <= DECODED_MAX || k === id) break;
      decoded.delete(k);
      decodedBytes -= v.length * 4;
    }
    return b;
  }

  function stop(fade = 0.08) {
    token++;
    const t = ctx.currentTime;
    // each cue has its own fader, so what cuts in is not cut with what it cut off
    if (gate) { gate.gain.cancelScheduledValues(t); gate.gain.setTargetAtTime(0, t, fade / 3); }
    for (const s of sources) { try { s.stop(t + fade); } catch { /* it had ended */ } }
    sources = [];
    gate = null;
    if (speaking) duck(false);
    speaking = false;
  }

  async function say(cue) {
    if (!pack || !cue?.parts?.length) return false;
    ensure();
    if (speaking) stop(0.06);
    const mine = ++token;
    speaking = true;
    let buffers;
    try {
      buffers = await Promise.all(cue.parts.map((p) => bufferOf(p.id)));
    } catch (e) {
      stats.failed++;
      if (mine === token) speaking = false;
      return false;
    }
    if (mine !== token) return false; // someone else spoke first, or the race is gone
    if (buffers.some((b) => !b)) { stats.failed++; speaking = false; return false; }
    duck(true);
    let at = ctx.currentTime + LEAD_IN;
    gate = ctx.createGain();
    gate.connect(low);
    sources = [];
    cue.parts.forEach((p, i) => {
      at += p.gap ?? 0;
      const s = ctx.createBufferSource();
      s.buffer = buffers[i];
      s.connect(gate);
      s.start(at);
      sources.push(s);
      stats.played++;
      stats.clips.push(p.id);
      if (stats.clips.length > 300) stats.clips.shift();
      at += buffers[i].duration;
    });
    endT = at;
    // the last word ends the talking on the audio clock, a timer would drift against a page in the background
    sources[sources.length - 1].onended = () => {
      if (mine !== token) return;
      speaking = false;
      sources = [];
      duck(false);
    };
    return true;
  }

  return {
    setPack(p) { stop(0.05); pack = p; decoded.clear(); decodedBytes = 0; },
    say,
    stop,
    busy: () => speaking,
    get lang() { return pack?.lang ?? null; },
    level() {
      if (!meter) return 0;
      meter.getFloatTimeDomainData(meterBuf);
      let peak = 0;
      for (let i = 0; i < meterBuf.length; i++) peak = Math.max(peak, Math.abs(meterBuf[i]));
      return peak;
    },
    stats: () => ({ ...stats, clips: [...stats.clips], speaking, duck: mix.duck.gain.value, endT }),
    dispose() { stop(0.02); try { bus?.disconnect(); } catch { /* gone */ } },
  };
}
