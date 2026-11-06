// Lookahead scheduler. The timer only places notes on the audio clock, a safe distance ahead, so a frame the game
// spends on something heavy delays the placing and never the sound. If it does overrun the horizon, what is already
// late gets skipped instead of arriving in a clump.
import { compile } from './score.js';

const HORIZON = 0.45;
const HORIZON_HIDDEN = 2.4;
const FADE_OUT = 0.7;

export function createPlayer(synth, tune, opts = {}) {
  const ctx = synth.ctx;
  const score = compile(tune);
  const bus = ctx.createGain();
  bus.gain.value = 0;
  bus.connect(opts.out ?? synth.mix.musicIn);
  const parts = {};
  const partFor = (name) => (parts[name] ??= synth.makePart(tune.parts[name], bus));
  for (const name of Object.keys(tune.parts)) partFor(name);

  const secPerBeat = 60 / tune.tempo;
  let rate = opts.rate ?? 1;
  let started = false, stopped = false, done = false;
  let anchorT = 0, anchorB = 0;
  let cursor = 0, loopBeat = 0;
  let lastPlaced = 0;

  const events = score.events;
  const once = !!tune.once;

  const timeAt = (beat) => anchorT + ((beat - anchorB) * secPerBeat) / rate;

  // The buffers this tune needs, in score order, so a slow start plays what comes first.
  function warmList() {
    const seen = new Set(), list = [];
    for (const ev of events) {
      const inst = tune.parts[ev.part].inst;
      const key = synth.warmKey(ev, inst);
      if (!key || seen.has(key) || synth.hasKey(key)) continue;
      seen.add(key);
      list.push(() => synth.warm(ev, inst));
    }
    return list;
  }

  function start(t) {
    anchorT = t;
    anchorB = 0;
    started = true;
    lastPlaced = t;
    const g = bus.gain;
    g.setValueAtTime(0, t);
    g.linearRampToValueAtTime(tune.level ?? 1, t + (opts.fadeIn ?? 0.04));
  }

  function pump(horizon = HORIZON) {
    if (!started || stopped || done) return;
    const now = ctx.currentTime;
    const until = now + horizon;
    for (;;) {
      if (cursor >= events.length) {
        if (once) { done = true; return; }
        cursor = 0;
        loopBeat += score.totalBeats;
      }
      const ev = events[cursor];
      const t = timeAt(loopBeat + ev.beat);
      if (t > until) break;
      cursor += 1;
      if (t < now - 0.02) continue;
      if (opts.solo && !opts.solo.includes(ev.part)) continue;
      const durS = (ev.dur * secPerBeat) / rate;
      synth.note(parts[ev.part], { f: ev.f, vel: ev.vel, voice: ev.voice, slide: ev.slide, durS }, t);
      lastPlaced = t;
    }
  }

  return {
    score,
    warmList,
    start,
    pump,
    get done() { return done; },
    get started() { return started; },
    get beat() {
      if (!started) return 0;
      return anchorB + ((ctx.currentTime - anchorT) * rate) / secPerBeat;
    },
    setRate(next) {
      if (next === rate) return;
      // re-anchor at the first unplaced moment, so notes already on the clock stay where they are
      const t = Math.max(lastPlaced, ctx.currentTime);
      const b = started ? anchorB + ((t - anchorT) * rate) / secPerBeat : 0;
      anchorT = t;
      anchorB = b;
      rate = next;
    },
    stop(fade = FADE_OUT) {
      if (stopped) return;
      stopped = true;
      const t = ctx.currentTime;
      const g = bus.gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(0, t + fade);
      for (const p of Object.values(parts)) p.dispose(t + fade + 0.1);
      const cleanup = () => {
        for (const p of Object.values(parts)) p.disconnect();
        try { bus.disconnect(); } catch { /* gone */ }
      };
      if (typeof setTimeout === 'function' && !opts.offline) setTimeout(cleanup, (fade + 3.2) * 1000);
    },
  };
}

export const HORIZONS = { HORIZON, HORIZON_HIDDEN };
