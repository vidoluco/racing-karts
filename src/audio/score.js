// The score language. A lane is a string of bars separated by `|`, each bar a list of tokens:
//
//   [mods]pitch[dur][.]    pitch: c5, f#4, bb3, or a scale degree 1..7 with ' (up) or , (down) marks
//                          several pitches at once: c4+e4+g4
//                          r is a rest, - holds the previous note on, @ asks the section's auto style for this bar
//   dur                    w h q e s (16th) z (32nd) t (triplet eighth); sticky until it changes
//   mods                   > accent, ? soft, / slide in from below, ~ trill, ^ grace from above, % tremolo
//
// A bar that does not add up to the meter throws: that is the whole point of the bars.
// Percussion lanes are step patterns, one per bar: 'x...x...' (x hit, X accent, o soft, . rest), or a table of letters
// for several voices. 'a|b|c' cycles per bar and `fill` replaces the last bar of a section.
import { hash, rng32, midiHz } from './dsp.js';

const NOTE = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
const DUR = { w: 4, h: 2, q: 1, e: 0.5, s: 0.25, z: 0.125, t: 1 / 3 };
const PITCH = "(?:[a-g](?:#|b)?\\d|[1-7][',]*)";
const TOKEN = new RegExp(`^([>?/~^%]*)(${PITCH}(?:\\+${PITCH})*|r|-)([whqeszt])?(\\.)?$`);

export function nameToMidi(n) {
  const m = /^([a-g])(#|b)?(\d)$/.exec(n);
  if (!m) throw new Error(`bad note ${n}`);
  return 12 * (Number(m[3]) + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

const degree = (tok, scale) => {
  const m = /^([1-7])([',]*)$/.exec(tok);
  if (!scale) throw new Error(`degree ${tok} in a tune without a scale`);
  const oct = [...m[2]].reduce((s, c) => s + (c === "'" ? 1 : -1), 0);
  const cents = scale.cents[m[1]];
  if (cents === undefined) throw new Error(`degree ${m[1]} not in the scale`);
  return scale.base * 2 ** (oct + cents / 1200);
};

const pitchHz = (tok, scale, shift = 0) => (/^[1-7]/.test(tok) ? degree(tok, scale) : midiHz(nameToMidi(tok))) * 2 ** shift;

export function parseLane(text, { beats, scale, name = 'lane' }) {
  const bars = text.split('|').map((b) => b.trim());
  const out = [];
  let dur = 1;
  bars.forEach((bar, i) => {
    if (bar === '@') { out.push({ bar: i, auto: true }); return; }
    let pos = 0;
    for (const raw of bar.split(/\s+/).filter(Boolean)) {
      const m = TOKEN.exec(raw);
      if (!m) throw new Error(`${name}: bad token "${raw}" in bar ${i + 1}`);
      if (m[3]) dur = DUR[m[3]];
      const d = dur * (m[4] ? 1.5 : 1);
      out.push({ bar: i, at: pos, d, mods: m[1], pitch: m[2] });
      pos += d;
    }
    if (bar && Math.abs(pos - beats) > 1e-3) throw new Error(`${name}: bar ${i + 1} has ${pos} beats, not ${beats}: "${bar}"`);
  });
  return { bars: bars.length, items: out };
}

// ---------- chords ----------
const QUALITY = {
  '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], 6: [0, 4, 7, 9], dim: [0, 3, 6],
};
export function chordTones(sym) {
  const m = /^([A-G])(#|b)?(.*)$/.exec(sym);
  if (!m || !QUALITY[m[3]]) throw new Error(`bad chord ${sym}`);
  const root = (NOTE[m[1].toLowerCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
  return { root, pcs: QUALITY[m[3]].map((x) => (root + x) % 12), fifth: (root + 7) % 12 };
}

// Close voicing in a window, picked so the top moves as little as possible from the last chord: how a left hand plays.
function voiceLead(pcs, prev, low, high) {
  const opts = [];
  for (let inv = 0; inv < pcs.length; inv++) {
    const v = [];
    let m = low - 1;
    for (let k = 0; k < Math.min(pcs.length, 3); k++) {
      const pc = pcs[(inv + k) % pcs.length];
      m += 1;
      while ((m % 12 + 12) % 12 !== pc) m += 1;
      v.push(m);
    }
    if (v[v.length - 1] <= high) opts.push(v);
  }
  if (!opts.length) return [low, low + 4, low + 7];
  if (!prev) return opts[0];
  const cost = (v) => v.reduce((s, x, i) => s + Math.abs(x - prev[Math.min(i, prev.length - 1)]), 0);
  return opts.sort((a, b) => cost(a) - cost(b))[0];
}

const below = (pc, top) => { let m = top; while ((m % 12 + 12) % 12 !== pc) m -= 1; return m; };

// ---------- auto styles: what the hands do when nobody wrote it out ----------
// Each returns [{ at, d, midi: [...], vel }] for one bar, given the chord at each beat.
export const STYLES = {
  // Ländler: bass, then the two chords, the second a hair lighter
  laendlerBass: (c, s) => [{ at: 0, d: 1, midi: [s.bar % 2 ? below(c(0).fifth, s.bassTop) : below(c(0).root, s.bassTop)], vel: 1 }],
  laendlerComp: (c, s) => [1, 2].map((at, i) => ({ at, d: 0.6, midi: s.voice(c(at).pcs), vel: i ? 0.72 : 0.9 })),
  // polka: bass on the beats alternating root and fifth, chords on the offbeats
  polkaBass: (c, s) => [
    { at: 0, d: 0.5, midi: [below(c(0).root, s.bassTop)], vel: 1 },
    { at: 1, d: 0.5, midi: [below(c(1).fifth, s.bassTop)], vel: 0.86 },
  ],
  polkaComp: (c, s) => [0.5, 1.5].map((at) => ({ at, d: 0.32, midi: s.voice(c(at).pcs), vel: 0.82 })),
  // the taraf's kontra: a bowed chord on every offbeat, with a short pair before the barline to pull forward
  sarbaBass: (c, s) => [
    { at: 0, d: 0.5, midi: [below(c(0).root, s.bassTop)], vel: 1 },
    { at: 1, d: 0.5, midi: [below(s.bar % 2 ? c(1).fifth : c(1).root, s.bassTop)], vel: 0.88 },
  ],
  sarbaKontra: (c, s) => [0.5, 1.5, 1.75].map((at, i) => ({ at, d: 0.25, midi: s.voice(c(at).pcs), vel: i === 2 ? 0.55 : 0.85 })),
  // the țambal's running broken chord, up and over
  arp16: (c, s) => {
    const cells = [];
    const steps = Math.round(s.beats * 4);
    let dir = s.bar % 2;
    for (let k = 0; k < steps; k++) {
      const at = k / 4;
      const pcs = c(at).pcs;
      const pc = pcs[(dir ? pcs.length * 8 - k : k) % pcs.length];
      const oct = k % 8 >= 4 ? 12 : 0;
      cells.push({ at, d: 0.25, midi: [below(pc, s.arpTop - 12 + oct)], vel: k % 4 === 0 ? 0.95 : k % 2 ? 0.55 : 0.72 });
      if (k % 8 === 7) dir = 1 - dir;
    }
    return cells;
  },
  // 6/8: the long-short of a slow hora, bass on 1 and a soft pickup, kontra on the 3rd and 5th eighths
  horaBass: (c, s) => [
    { at: 0, d: 1, midi: [below(c(0).root, s.bassTop)], vel: 1 },
    { at: 1.5, d: 0.5, midi: [below(c(1.5).fifth, s.bassTop)], vel: 0.74 },
    { at: 2.5, d: 0.5, midi: [below(c(2.5).root, s.bassTop)], vel: 0.6 },
  ],
  horaKontra: (c, s) => [1, 2].map((at, i) => ({ at, d: 0.4, midi: s.voice(c(at).pcs), vel: i ? 0.78 : 0.88 })),
  // the țambal in 6/8: rolling eighths
  arp68: (c, s) => {
    const shape = [0, 2, 1, 2, 0, 1];
    return shape.map((ix, k) => {
      const at = k * 0.5;
      const pcs = c(at).pcs;
      const pc = pcs[ix % pcs.length];
      return { at, d: 0.5, midi: [below(pc, s.arpTop - (k % 3 === 0 ? 12 : 0))], vel: k % 3 === 0 ? 0.9 : 0.62 };
    });
  },
  // a bouncy 4/4 for the menu
  bounceBass: (c, s) => [0, 1, 2, 3].map((at) => ({
    at, d: 0.7, midi: [below(at % 2 ? c(at).fifth : c(at).root, s.bassTop)], vel: at % 2 ? 0.8 : 1,
  })),
  bounceComp: (c, s) => [1, 3, 3.5].map((at, i) => ({ at, d: 0.4, midi: s.voice(c(at).pcs), vel: i === 2 ? 0.62 : 0.86 })),
  arpBells: (c, s) => [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].map((at, k) => {
    const pcs = c(at).pcs;
    return { at, d: 0.5, midi: [below(pcs[[0, 1, 2, 1][k % 4] % pcs.length], s.arpTop)], vel: k % 2 ? 0.55 : 0.8 };
  }),
};

// ---------- compile ----------
const FEEL_PREROLL = 0.02;

export function compile(tune) {
  const beats = tune.beats;
  const events = [];
  const rand = rng32(hash(tune.name));
  const scale = tune.scale ?? null;
  let barNo = 0;
  const voices = {};
  let prevNote = {};
  let dyn = 1;
  const push = (part, beat, dur, f, vel, extra = {}) => {
    const cfg = tune.parts[part];
    if (!cfg) throw new Error(`${tune.name}: no part ${part}`);
    // A bar's feel: hand-placed offsets per beat plus a little human jitter, late only, so nothing lands before zero.
    const onBeat = Math.abs(beat - Math.round(beat)) < 1e-6;
    const ph = ((beat % beats) + beats) % beats;
    const metric = ph < 1e-6 ? 1 : onBeat ? 0.92 : 0.84;
    const swing = tune.swing && Math.abs((beat * 2) % 2 - 1) < 1e-6 ? tune.swing : 0;
    const feel = (tune.feel?.[Math.floor(ph + 1e-6)] ?? 0) * (onBeat ? 1 : 0);
    const loose = cfg.loose ?? 0.012;
    events.push({
      part, f, dur, beat: beat + swing + feel + FEEL_PREROLL + rand() * loose,
      vel: Math.min(1.15, vel * dyn * (cfg.flat ? 1 : metric) * (1 - (cfg.jitter ?? 0.08) + rand() * (cfg.jitter ?? 0.08) * 2)),
      ...extra,
    });
  };

  const addItems = (partName, items, startBar, ctx) => {
    let last = prevNote[partName] ?? null;
    const shift = (ctx.oct?.[partName] ?? 0) + (tune.parts[partName]?.oct ?? 0);
    const gainK = ctx.vel?.[partName] ?? 1;
    for (const it of items) {
      if (it.auto) continue;
      const beat = (startBar + it.bar) * beats + it.at;
      if (it.pitch === 'r') { last = null; continue; }
      if (it.pitch === '-') { if (last) for (const e of last) e.dur += it.d; continue; }
      const accent = it.mods.includes('>') ? 1.2 : it.mods.includes('?') ? 0.66 : 1;
      const made = [];
      for (const tok of it.pitch.split('+')) {
        const f = pitchHz(tok, scale, shift);
        if (it.mods.includes('%')) {
          // the țambal's roll and the lăutar's bow tremolo
          const step = 0.125;
          for (let k = 0; k * step < it.d - 1e-6; k++) push(partName, beat + k * step, step, f, 0.72 * accent * gainK * (k % 2 ? 0.8 : 1));
          continue;
        }
        if (it.mods.includes('~')) {
          const up = neighbour(f, tune);
          const step = Math.min(0.125, it.d / 4);
          const n = Math.floor(it.d * 0.75 / step);
          for (let k = 0; k < n; k++) push(partName, beat + k * step, step, k % 2 ? up : f, 0.82 * accent * gainK);
          const rest = n * step;
          push(partName, beat + rest, it.d - rest, f, 0.9 * accent * gainK);
          continue;
        }
        if (it.mods.includes('^')) {
          push(partName, beat, 0.1, neighbour(f, tune), 0.6 * accent * gainK);
          push(partName, beat + 0.1, it.d - 0.1, f, 0.9 * accent * gainK);
          continue;
        }
        push(partName, beat, it.d, f, 0.9 * accent * gainK, it.mods.includes('/') ? { slide: true } : {});
        made.push(events[events.length - 1]);
      }
      last = made.length ? made : last;
    }
    prevNote[partName] = last;
  };

  const sections = tune.sections;
  const marks = [];
  for (const entry of tune.form) {
    const spec = typeof entry === 'string' ? { s: entry } : entry;
    const sec = sections[spec.s];
    if (!sec) throw new Error(`${tune.name}: no section ${spec.s}`);
    const bars = sec.bars;
    const mute = new Set(spec.mute ?? []);
    const route = spec.route ?? {};
    const ctx = { oct: spec.oct, vel: spec.vel };
    dyn = spec.dyn ?? 1;
    marks.push({ name: spec.label ?? spec.s, bar: barNo, bars });
    const harm = sec.harm ? sec.harm.split('|').map((b) => b.trim().split(/\s+/).map(chordTones)) : null;
    if (harm && harm.length !== bars) throw new Error(`${tune.name}/${spec.s}: harm has ${harm.length} bars, not ${bars}`);

    // written lanes
    const autoBars = {};
    for (const [key, val] of Object.entries(sec)) {
      if (['bars', 'harm', 'perc', 'auto', 'fill'].includes(key) || mute.has(key)) continue;
      const parsed = parseLane(val, { beats, scale, name: `${tune.name}/${spec.s}/${key}` });
      if (parsed.bars !== bars) throw new Error(`${tune.name}/${spec.s}/${key}: ${parsed.bars} bars, not ${bars}`);
      autoBars[key] = new Set(parsed.items.filter((x) => x.auto).map((x) => x.bar));
      addItems(route[key] ?? key, parsed.items, barNo, ctx);
    }

    // auto lanes: every bar unless the lane is written out and does not say @
    for (const [key, style] of Object.entries({ ...tune.auto, ...sec.auto, ...spec.auto })) {
      if (mute.has(key) || !style) continue;
      if (!harm) throw new Error(`${tune.name}/${spec.s}: auto ${key} needs harm`);
      const written = sec[key] !== undefined;
      const fn = STYLES[style];
      if (!fn) throw new Error(`no style ${style}`);
      const partName = route[key] ?? key;
      const cfg = tune.parts[partName];
      if (!cfg) throw new Error(`${tune.name}: no part ${partName}`);
      const shift = (ctx.oct?.[key] ?? 0) + (cfg.oct ?? 0);
      const gainK = ctx.vel?.[key] ?? 1;
      const low = cfg.low ?? 55, high = cfg.high ?? 72;
      for (let i = 0; i < bars; i++) {
        if (written && !autoBars[key]?.has(i)) continue;
        const chords = harm[i];
        const at = (b) => chords[Math.min(chords.length - 1, Math.floor((b / beats) * chords.length + 1e-6))];
        const helper = {
          bar: barNo + i, beats, bassTop: cfg.bassTop ?? 55, arpTop: cfg.arpTop ?? 84,
          voice: (pcs) => { voices[partName] = voiceLead(pcs, voices[partName], low, high); return voices[partName]; },
        };
        for (const c of fn(at, helper)) {
          for (const m of c.midi) push(partName, (barNo + i) * beats + c.at, c.d, midiHz(m) * 2 ** shift, 0.9 * c.vel * gainK);
        }
      }
    }

    // percussion
    const perc = { ...sec.perc, ...spec.perc };
    // a part that only plays the fill still needs a lane to hang it on
    for (const part of Object.keys(sec.fill ?? {})) perc[part] ??= '.';
    for (const [part, pat] of Object.entries(perc)) {
      if (mute.has(part) || !pat) continue;
      const cfg = tune.parts[part];
      if (!cfg) throw new Error(`${tune.name}: no part ${part}`);
      const cycle = pat.split('|');
      for (let i = 0; i < bars; i++) {
        let bar = cycle[i % cycle.length];
        if (i === bars - 1 && sec.fill?.[part] !== undefined && !spec.nofill) bar = sec.fill[part];
        const steps = bar.length;
        for (let k = 0; k < steps; k++) {
          const ch = bar[k];
          if (ch === '.' || ch === ' ') continue;
          const lower = ch.toLowerCase();
          const accent = ch !== lower ? 1.12 : ch === 'o' ? 0.5 : 0.8;
          const voice = cfg.map?.[lower] ?? cfg.voice;
          if (!voice) throw new Error(`${tune.name}: ${part} has no voice for ${ch}`);
          push(part, (barNo + i) * beats + (k / steps) * beats, beats / steps, 0, accent, { voice });
        }
      }
    }
    barNo += bars;
  }
  events.sort((a, b) => a.beat - b.beat);
  return { name: tune.name, tune, events, bars: barNo, beats, totalBeats: barNo * beats, marks };
}

function neighbour(f, tune) {
  if (tune.scale) {
    const all = Object.values(tune.scale.cents).sort((a, b) => a - b);
    const here = 1200 * Math.log2(f / tune.scale.base);
    const inOct = ((here % 1200) + 1200) % 1200;
    const next = all.find((c) => c > inOct + 5) ?? all[0] + 1200;
    return f * 2 ** ((next - inOct) / 1200);
  }
  const m = Math.round(69 + 12 * Math.log2(f / 440));
  const pcs = tune.pcs ?? [0, 2, 4, 5, 7, 9, 11];
  for (let k = 1; k <= 3; k++) if (pcs.includes((m + k) % 12)) return midiHz(m + k);
  return midiHz(m + 2);
}

// Numbers a deaf composer can check: the range and the movement of each part, and how often the tune's strong beats
// land on a note of the chord under them (a typo in a melody shows up here long before anyone hears it).
export function lint(tune) {
  const beats = tune.beats;
  const out = { name: tune.name, parts: {}, sections: {}, strongOffChord: 0, strongTotal: 0, problems: [] };
  const compiled = compile(tune);
  for (const ev of compiled.events) {
    if (ev.voice) continue;
    const m = 69 + 12 * Math.log2(ev.f / 440);
    const p = out.parts[ev.part] ??= { n: 0, low: 1e9, high: -1e9, sum: 0 };
    p.n += 1;
    p.low = Math.min(p.low, m);
    p.high = Math.max(p.high, m);
    p.sum += m;
  }
  for (const p of Object.values(out.parts)) { p.mean = +(p.sum / p.n).toFixed(1); p.low = Math.round(p.low); p.high = Math.round(p.high); delete p.sum; }
  for (const [name, sec] of Object.entries(tune.sections)) {
    if (!sec.harm || !sec.lead) continue;
    const harm = sec.harm.split('|').map((b) => b.trim().split(/\s+/).map(chordTones));
    const parsed = parseLane(sec.lead, { beats, scale: tune.scale, name });
    let sum = 0, n = 0, off = 0, total = 0;
    for (const it of parsed.items) {
      if (it.auto || it.pitch === 'r' || it.pitch === '-') continue;
      for (const tok of it.pitch.split('+')) {
        if (/^[1-7]/.test(tok)) continue;
        const m = nameToMidi(tok);
        sum += m; n += 1;
        const chords = harm[it.bar];
        const c = chords[Math.min(chords.length - 1, Math.floor((it.at / beats) * chords.length + 1e-6))];
        const strong = Math.abs(it.at - Math.round(it.at)) < 1e-6 && (it.at === 0 || (beats === 4 && it.at === 2) || (beats === 3 && it.d >= 1));
        if (strong) {
          total += 1;
          if (!c.pcs.includes(m % 12)) { off += 1; out.problems.push(`${name} bar ${it.bar + 1}: ${tok} over a chord without it`); }
        }
      }
    }
    out.sections[name] = { meanPitch: n ? +(sum / n).toFixed(1) : null, notes: n };
    out.strongOffChord += off;
    out.strongTotal += total;
  }
  out.bars = compiled.bars;
  out.seconds = compiled.totalBeats * (60 / tune.tempo);
  return out;
}
