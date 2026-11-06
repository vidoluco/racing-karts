// The game's only door to the sound. Nothing here may take the game down with it: every call is guarded, unknown names
// and missing fields are ignored, and before the first gesture every call is a silent no-op that only remembers what
// was asked, so the music the screen wanted is there as soon as the browser allows it.
import { createMix, createSynth } from './synth.js';
import { createPlayer, HORIZONS } from './player.js';
import { resolveTune } from './music/index.js';
import { createSfx, hazardSounds, DISASTER_SOUND } from './sfx.js';
import { createEngines } from './engine.js';
import { clamp } from './dsp.js';
import { createVoice, loadVoicePack } from './voice.js';

const LAST_LAP_RATE = 1.07;
const ROULETTE = 1.2;
const DEFAULT_VOLUME = { master: 1, music: 1, sfx: 1, engine: 1 };
const GROUP_LEVEL = { master: 1, music: 0.44, sfx: 1, engine: 0.42 };

// opts.context and opts.hooks exist for tools/audio-check.mjs: an OfflineAudioContext, and a way to drive the clock.
export function createAudio(opts = {}) {
  let rt = null;
  let wanted = null;
  let fast = false;
  let views = null;
  const places = {};
  const volume = { ...DEFAULT_VOLUME };

  const guard = (fn, fallback) => (...args) => {
    try { return fn(...args); } catch (e) {
      if (typeof console !== 'undefined') console.warn('[audio]', e?.message ?? e);
      return fallback;
    }
  };

  function boot() {
    const Ctor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    const ctx = opts.context ?? (Ctor ? new Ctor({ latencyHint: 'interactive' }) : null);
    if (!ctx) return null;
    const mix = createMix(ctx);
    const synth = createSynth(ctx, mix);
    const sfx = createSfx(ctx, mix);
    const engines = createEngines(ctx, mix, sfx);
    const r = { ctx, mix, synth, sfx, engines, player: null, pending: [], timer: null };
    for (const g of Object.keys(volume)) applyVolume(r, g);
    if (!opts.context) {
      r.timer = setInterval(() => guard(pump)(), 40);
      warm(r, sfx.warmList());
    }
    return r;
  }

  // Render the buffers a little at a time: at most a few ms per slice, the rest of the frame stays the game's.
  function warm(r, list, done, first = false) {
    // the music goes to the front: a late effect costs one effect, late music is a silent start
    if (first) r.pending.unshift({ list, done }); else r.pending.push({ list, done });
    if (r.warming) return;
    r.warming = true;
    const slice = () => {
      const t0 = performance.now();
      while (r.pending.length && performance.now() - t0 < 4) {
        const job = r.pending[0];
        const step = job.list.shift();
        if (step) guard(step)();
        if (!job.list.length) { r.pending.shift(); guard(() => job.done?.())(); }
      }
      if (r.pending.length) setTimeout(slice, 6); else r.warming = false;
    };
    setTimeout(slice, 0);
  }

  function pump() {
    if (!rt) return;
    const hidden = typeof document !== 'undefined' && document.hidden;
    rt.player?.pump(opts.horizon ?? (hidden ? HORIZONS.HORIZON_HIDDEN : HORIZONS.HORIZON));
    rt.engines.tick();
  }

  function startMusic() {
    if (!rt) return;
    const old = rt.player;
    const tune = resolveTune(wanted);
    if (old && old.tune === tune) return;
    old?.stop();
    rt.player = null;
    if (!tune) return;
    const p = createPlayer(rt.synth, tune, { rate: !tune.once && fast ? LAST_LAP_RATE : 1, offline: !!opts.context, solo: opts.solo });
    p.tune = tune;
    rt.player = p;
    const begin = () => {
      if (rt?.player !== p) return;
      p.start(rt.ctx.currentTime + (opts.context ? 0 : 0.06));
      pump();
    };
    const list = p.warmList();
    if (opts.context) { for (const step of list) step(); begin(); } else warm(rt, list, begin, true);
  }

  function applyVolume(r, group) {
    const t = r.ctx.currentTime;
    const v = clamp(Number(volume[group]) || 0, 0, 1);
    const node = group === 'master' ? r.mix.master : r.mix[group];
    if (!node) return;
    node.gain.setTargetAtTime(v * GROUP_LEVEL[group], t, 0.02);
    r.mix.sends[group]?.gain.setTargetAtTime(v * GROUP_LEVEL[group], t, 0.02);
  }

  // ---------- where a sound is, from the nearest view ----------
  function listenerFor(state, list) {
    const karts = state?.karts ?? [];
    const ears = (list ?? []).map((i) => karts[i]).filter(Boolean);
    return (x, z) => {
      let best = null, bd = Infinity;
      for (const k of ears) {
        const d = Math.hypot((x ?? 0) - (k.x ?? 0), (z ?? 0) - (k.z ?? 0));
        if (d < bd) { bd = d; best = k; }
      }
      if (!best) return { gain: 0.5, pan: 0, d: 0 };
      const dx = (x ?? 0) - best.x, dz = (z ?? 0) - best.z;
      // the right-hand side of the way the kart is going; the velocity is the safest idea of that while spinning
      let fx = best.vx ?? 0, fz = best.vz ?? 0;
      if (Math.hypot(fx, fz) < 1) { fx = -Math.sin(best.yaw ?? 0); fz = -Math.cos(best.yaw ?? 0); }
      const fl = Math.hypot(fx, fz) || 1;
      const side = (-fz * dx + fx * dz) / fl / Math.max(1, bd);
      return { gain: 1 / (1 + (bd / 22) ** 2), pan: clamp(side * 0.75, -0.8, 0.8), d: bd };
    };
  }

  // ---------- events ----------
  const USE = {
    razzo: [['razzo', 1]],
    grappa: [['grappa', 1]],
    zuica: [['zuica', 1]],
    mici: [['miciThrow', 0.9]],
    uova: [['uova', 1]],
    polenta: [['polenta', 1]],
    formaggio: [['formaggio', 1]],
    durian: [['durian', 1]],
    sambal: [['sambal', 1]],
    rendang: [['rendang', 1]],
    frana: [['frana', 0.7]],
  };

  const BOOM_RATE = { razzo: 1, rock: 0.85, clear: 1.5, polenta: 1.7, durian: 1.5, boulder: 0.72, log: 1.5, bomb: 0.9 };
  const BOOM_GAIN = { clear: 0.55, polenta: 0.4, durian: 0.4, rock: 0.8, boulder: 0.85, log: 0.5, bomb: 0.8 };

  // A disaster is heard by everyone, even from across the map: FAR is the floor of its level.
  const DISASTER_FAR = { cloud: 0.7, quake: 0.8, eruption: 0.6 };
  // The small things a disaster throws around: named boom kinds that have a sound of their own, the others go through 'boom'.
  const BOOM_OWN = { snow: ['disasterSnow', 0.8], bank: ['disasterSnow', 0.9], tile: ['disasterTile', 0.7] };

  function onEvent(e, state, list, here) {
    const r = rt;
    const karts = state?.karts ?? [];
    const isMine = list.includes(e.kart);
    const kart = karts[e.kart];
    const at = kart ? here(kart.x, kart.z) : { gain: 0.6, pan: 0 };
    const local = (name, opt = {}) => r.sfx.fire(name, opt);
    const heard = (name, g = 1, opt = {}) => {
      if (isMine) r.sfx.fire(name, { gain: g, pan: viewPan(list, e.kart), ...opt });
      else if (at.gain > 0.03) r.sfx.fire(name, { gain: g * at.gain * 0.8, pan: at.pan, ...opt });
    };
    const voice = (kind, g = 0.8) => { if (kart?.kart) heard(`voice:${kart.kart}:${kind}`, g, { rate: 1 }); };

    switch (e.type) {
      case 'countdown': return local('countdown', { gain: 0.95, rate: e.n === 1 ? 1.06 : 1 });
      case 'go': return local('go', { gain: 1 });
      case 'boxTake':
        if (e.item) {
          heard('box', 0.86);
          if (isMine) {
            const t = r.ctx.currentTime;
            // the wheel of items spins and slows down, then the prize rings out as the HUD lands on it
            let at2 = 0.09, step = 0.055, k = 0;
            while (at2 < ROULETTE - 0.02 && k < 18) {
              r.sfx.fire('tick', { gain: 0.62, when: t + at2, rate: 1 + (k % 2) * 0.12, wet: 0, pan: viewPan(list, e.kart) });
              at2 += step;
              step *= 1.1;
              k += 1;
            }
            r.sfx.fire('itemGet', { gain: 0.7, when: t + ROULETTE, pan: viewPan(list, e.kart) });
            // sausages arrive already on the grill
            if (e.item === 'mici') r.sfx.fire('miciReady', { gain: 0.6, when: t + ROULETTE + 0.05, pan: viewPan(list, e.kart) });
          }
        } else heard('boxFull', 0.7);
        return undefined;
      case 'itemUse':
        for (const [name, g] of USE[e.item] ?? []) heard(name, g);
        if ((e.item === 'grappa' || e.item === 'zuica') && isMine) {
          // the hic! comes after the swallow, and more surely after the stronger drink
          const late = e.item === 'grappa' ? 2.7 : 0.72;
          r.sfx.fire('hic', { gain: 0.72, when: r.ctx.currentTime + late, rate: e.item === 'grappa' ? 1 : 1.12, pan: viewPan(list, e.kart) });
          if (e.item === 'grappa') r.sfx.fire('hic', { gain: 0.6, when: r.ctx.currentTime + 3.35, rate: 0.92, pan: viewPan(list, e.kart) });
        }
        return undefined;
      case 'boost':
        if (e.kind === 'pad') heard('boostPad', 0.8);
        else if (e.kind === 'drift') { const t = clamp(e.tier | 0, 1, 3); heard('boostDrift', 0.58 + 0.14 * t, { rate: 0.82 + 0.13 * t }); }
        return undefined;
      case 'driftStart': return heard('driftStart', 0.6);
      case 'driftTier': if (isMine) { const name = `tier${clamp(e.tier | 0, 1, 3)}`; heard(name, 0.72); } return undefined;
      case 'hit':
        heard(e.kind === 'tumble' ? 'hitTumble' : 'hitSpin', 0.95);
        voice(e.kind === 'tumble' ? 'ouch' : 'hit', 0.8);
        return undefined;
      case 'steal': return heard('itemGet', 0.9);
      case 'shield': return heard('shield', 0.9);
      // Baileys, loud for the one who did it and the one who got it
      case 'bite':
        if (list.includes(e.victim)) r.sfx.fire('biteChomp', { gain: 0.95, pan: viewPan(list, e.victim) });
        else heard('biteChomp', 0.9);
        return undefined;
      case 'bump': {
        const a = karts[e.a], mine = list.includes(e.a) || list.includes(e.b);
        // Fifi's pans answer every knock
        if (mine && [karts[e.a], karts[e.b]].some((q) => q?.kart === 'fifi')) r.sfx.fire('panClank', { gain: 0.6, pan: 0 });
        if (!a) return undefined;
        const g = clamp((Number(e.force) || 4) / 10, 0.25, 0.9);
        const pos = here(a.x, a.z);
        if (mine) r.sfx.fire('bump', { gain: g, pan: viewPan(list, list.includes(e.a) ? e.a : e.b) });
        else if (pos.gain > 0.1) r.sfx.fire('bump', { gain: g * pos.gain * 0.5, pan: pos.pan });
        return undefined;
      }
      case 'wall': return heard('wall', clamp((Number(e.force) || 4) / 10, 0.25, 0.85));
      case 'splash': return heard(e.kind === 'snow' ? 'splashSnow' : 'splashWater', clamp((Number(e.speed) || 20) / 30, 0.4, 0.95));
      // the flash first, then the sound, as far as the storm is
      case 'thunder': r.sfx.fire('thunder', { gain: 0.8, when: r.ctx?.currentTime ? r.ctx.currentTime + (Number(e.delay) || 0.5) : 0 }); return undefined;
      case 'jump': return heard('jump', 0.62);
      case 'land': return heard('land', clamp((Number(e.force) || 5) / 10, 0.3, 0.9));
      case 'lap':
        if (isMine && (e.lap ?? 0) > 0) { heard('lap', 0.72); if (kart?.kart === 'mocanita') heard('whistle', 0.5); }
        return undefined;
      // who has the cheese is news for everyone, wherever they are on the road
      case 'formaGrab':
        if (isMine) { r.sfx.fire('formaGrab', { gain: 0.95, pan: viewPan(list, e.kart) }); voice('cheer', 0.7); }
        else r.sfx.fire('formaOther', { gain: 0.6 });
        return undefined;
      case 'formaDrop':
        if (isMine) r.sfx.fire('formaDrop', { gain: 0.95, pan: viewPan(list, e.kart) }); else heard('formaDrop', 0.7);
        { const pos = here(e.x, e.z); if (pos.gain > 0.05) r.sfx.fire('formaggio', { gain: 0.5 * pos.gain, pan: pos.pan }); }
        return undefined;
      case 'formaLead': if (isMine) r.sfx.fire('formaLead', { gain: 0.7 }); return undefined;
      case 'formaFetch': return heard('whistle', 0.3);
      case 'formaLast': r.sfx.fire('lastLap', { gain: 0.9 }); lastLap(true); return undefined;
      case 'formaTick': return local('formaTick', { gain: e.n <= 5 ? 0.9 : 0.5, rate: e.n <= 3 ? 1.12 : 1 });
      case 'formaEnd': return local('formaEnd', { gain: 0.95 });
      case 'lastLap':
        if (isMine) { r.sfx.fire('lastLap', { gain: 0.9 }); lastLap(true); }
        return undefined;
      case 'finish':
        if (isMine) { r.sfx.fire('finish', { gain: 0.95, pan: viewPan(list, e.kart) }); voice('cheer', 0.8); }
        return undefined;
      case 'boom': {
        const pos = here(e.x, e.z);
        // the sambal's blast has its own trumpet in itemUse, a clear is only a pop
        if (e.kind === 'sambal' || pos.gain <= 0.03) return undefined;
        if (BOOM_OWN[e.kind]) { const [name, g] = BOOM_OWN[e.kind]; r.sfx.fire(name, { gain: pos.gain * g, pan: pos.pan }); return undefined; }
        if (e.kind === 'bomb') r.sfx.fire('disasterBomb', { gain: pos.gain * 0.6, pan: pos.pan });
        if (e.kind === 'frana') { r.sfx.fire('boom', { gain: pos.gain, pan: pos.pan, rate: 0.62 }); r.sfx.fire('frana', { gain: pos.gain * 0.9, pan: pos.pan }); return undefined; }
        r.sfx.fire('boom', { gain: pos.gain * (BOOM_GAIN[e.kind] ?? 1), pan: pos.pan, rate: BOOM_RATE[e.kind] ?? 1.2 });
        return undefined;
      }
      case 'hazardNear':
        if (isMine) {
          for (const [i, name] of hazardSounds(e.kind).entries()) {
            r.sfx.fire(name, { gain: i ? 0.5 : 0.72, when: r.ctx.currentTime + i * 0.4, pan: viewPan(list, e.kart) });
          }
        }
        return undefined;
      case 'disaster': {
        const pos = here(e.x, e.z);
        if (e.phase === 'warn') {
          // the alarm is the game talking, so it sits in the middle of the room; the rumble comes from the place
          local('disasterAlarm', { gain: 0.72, wet: 0.5 });
          r.sfx.fire('disasterRumble', { gain: Math.max(0.5, pos.gain), pan: pos.pan });
        } else if (e.phase === 'strike') {
          const name = DISASTER_SOUND[e.kind];
          if (name) r.sfx.fire(name, { gain: Math.max(DISASTER_FAR[e.kind] ?? 0.5, pos.gain), pan: pos.pan });
        }
        return undefined;
      }
      // the traffic of a city track
      case 'honk': {
        const pos = here(e.x, e.z), name = { beep: 'hornBeep', toot: 'hornToot', horn: 'hornCar', air: 'hornAir', bell: 'hornBell' }[e.horn] || 'hornCar', rate = 0.92 + ((Number(e.seed) || 0) % 7) * 0.03;
        if (pos.gain > 0.05) r.sfx.fire(name, { gain: pos.gain * 0.62, pan: pos.pan, rate, wet: 0.6 });
        return undefined;
      }
      case 'traffic':
        if (e.kind === 'part') { heard('hornBeep', 0.35, { rate: 0.95 + ((e.kart | 0) % 4) * 0.06 }); return undefined; }
        if (e.kind === 'crash') heard('trafficCrash', 0.92);
        else if (e.kind === 'scatter' || e.kind === 'plow') heard('trafficScatter', 0.8, { rate: 0.9 + ((e.kart | 0) % 5) * 0.05 });
        else if (e.kind === 'scrape') heard('wall', 0.5);
        else heard('bump', 0.45);
        return undefined;
      case 'crossing':
        if (e.phase === 'warn') r.sfx.fire('crossingBell', { gain: at.gain * 0.7, pan: at.pan }); else if (e.phase === 'pass') r.sfx.fire('trainPass', { gain: at.gain * 0.9, pan: at.pan });
        return undefined;
      case 'rescue': return heard('rescue', 0.8);
      case 'overtake':
        if (isMine) { heard('overtake', 0.55); if (kart?.kart === 'becak') heard('bellTing', 0.5); }
        return undefined;
      // the podium's cheers, by kart id, with no race around them
      case 'cheer': return e.id ? local(`voice:${e.id}:cheer`, { gain: 0.8 }) : undefined;
      // the menus use the same door
      case 'click': case 'move': case 'back': case 'confirm':
        return local(e.type, { gain: 0.9, wet: 0.5 });
      default:
        return undefined;
    }
  }

  const viewPan = (list, kart) => {
    const n = list.length;
    if (n < 2) return 0;
    const i = list.indexOf(kart);
    return i < 0 ? 0 : i % 2 ? 0.36 : -0.36;
  };

  // ---------- the API ----------
  function unlock() {
    if (!rt) { rt = boot(); if (rt && wanted) startMusic(); }
    if (!rt) return false;
    if (rt.ctx.state === 'suspended' && rt.ctx.resume && !opts.context) {
      const p = rt.ctx.resume();
      p?.catch?.(() => {});
    }
    return true;
  }

  function music(name) {
    wanted = name ?? null;
    fast = false;
    if (!rt) return;
    startMusic();
  }

  function onEvents(events, state, nextViews) {
    if (Array.isArray(nextViews)) views = nextViews;
    if (!rt || !Array.isArray(events)) return;
    const list = views ?? (state?.karts ?? []).filter((k) => k?.human).map((k) => k.i);
    const here = listenerFor(state, list);
    let budget = 12;
    for (const e of events) {
      if (!e || budget-- <= 0) break;
      guard(onEvent)(e, state, list, here);
    }
  }

  function update(state, dt) {
    if (!rt) return;
    const list = views ?? (state?.karts ?? []).filter((k) => k?.human).map((k) => k.i);
    rt.engines.update(state, clamp(Number(dt) || 1 / 60, 0, 0.25), views, listenerFor(state, list));
    // the sim only reports who overtook; being overtaken has to be seen from the place itself
    if (state?.phase === 'race') {
      for (const i of list) {
        const place = state.karts?.[i]?.place;
        if (place === undefined) continue;
        if (places[i] !== undefined && place > places[i]) rt.sfx.fire('overtaken', { gain: 0.5, pan: viewPan(list, i), wet: 0.4 });
        places[i] = place;
      }
    }
    pump();
  }

  function setVolume(group, v) {
    if (typeof group === 'number' && v === undefined) { v = group; group = 'master'; }
    if (!(group in volume)) return;
    volume[group] = clamp(Number(v) || 0, 0, 1);
    if (rt) applyVolume(rt, group);
  }

  function lastLap(on = true) {
    const next = !!on;
    if (next === fast) return;
    fast = next;
    if (rt?.player && !rt.player.tune?.once) rt.player.setRate(fast ? LAST_LAP_RATE : 1);
  }

  // ---------- the commentary: a pack is fetched only when a language is asked for, the voice's nodes only exist once it speaks ----------
  let voicePack = null, voiceAsked = null;
  const voiceRt = () => {
    if (!rt) return null;
    if (!rt.voice) rt.voice = createVoice(rt.ctx, rt.mix, { engineLevel: () => clamp(Number(volume.engine) || 0, 0, 1) * GROUP_LEVEL.engine });
    if (rt.voice.lang !== voicePack?.lang) rt.voice.setPack(voicePack);
    return rt.voice;
  };
  // -> the pack, or null with no such files: the game then shows the captions alone
  async function voice(lang) {
    voiceAsked = lang;
    voicePack = null;
    rt?.voice?.setPack(null);
    if (!lang) return null;
    let pack = null;
    try { pack = await (opts.loadPack ?? loadVoicePack)(lang); } catch (e) { console.warn('[audio]', e?.message ?? e); }
    if (voiceAsked !== lang) return null;
    voicePack = pack;
    return pack;
  }

  function dispose() {
    if (!rt) return;
    const r = rt;
    rt = null;
    if (r.timer) clearInterval(r.timer);
    r.voice?.dispose();
    r.player?.stop(0.1);
    r.engines.dispose();
    r.mix.dispose();
    if (!opts.context) r.ctx.close?.().catch?.(() => {});
  }

  if (opts.hooks) {
    opts.hooks.pump = guard(pump);
    Object.defineProperty(opts.hooks, 'rt', { get: () => rt, configurable: true });
  }

  return {
    unlock: guard(unlock, false),
    music: guard(music),
    onEvents: guard(onEvents),
    update: guard(update),
    setVolume: guard(setVolume),
    lastLap: guard(lastLap),
    voice: async (lang) => { try { return await voice(lang); } catch { return null; } },
    say: guard((cue) => (voicePack ? voiceRt()?.say(cue) ?? false : false), false),
    hush: guard(() => { rt?.voice?.stop(); }),
    voiceBusy: guard(() => !!rt?.voice?.busy(), false),
    voiceStats: guard(() => (rt?.voice ? { ...rt.voice.stats(), level: rt.voice.level(), pack: voicePack?.lang ?? null } : { played: 0, clips: [], speaking: false, duck: rt ? rt.mix.duck.gain.value : 1, level: 0, pack: voicePack?.lang ?? null }), null),
    dispose: guard(dispose),
  };
}
