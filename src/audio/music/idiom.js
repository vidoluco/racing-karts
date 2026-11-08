// Recipes for how a band plays around a tune, the same idea as the kotekan in lib.js: written out by hand they would be
// pages of typos. Parallel thirds for Alpine winds, and for Java the whole frame around a balungan.
const NOTE = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
const NAMES = ['c', 'c#', 'd', 'eb', 'e', 'f', 'f#', 'g', 'g#', 'a', 'bb', 'b'];
const FLATS = { 1: 'db', 3: 'eb', 6: 'gb', 8: 'ab', 10: 'bb' };
const midiOf = (n) => { const m = /^([a-g])(#|b)?(\d)$/.exec(n); return 12 * (Number(m[3]) + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); };
const nameOf = (m, flat) => { const pc = ((m % 12) + 12) % 12; return `${flat && FLATS[pc] ? FLATS[pc] : NAMES[pc]}${Math.floor(m / 12) - 1}`; };

// The same rhythm a number of scale steps away, for the second voice of a duet. Only for lanes of note names.
// Steps are diatonic: -2 is a third below. `flat` spells the black keys as flats for the flat keys of a band.
export function diatonic(lane, steps, pcs, { flat = false, octave = 0 } = {}) {
  return lane.split('|').map((bar) => bar.trim().split(/\s+/).filter(Boolean).map((tok) => {
    const m = /^([>?/~^%<=_]*)((?:[a-g](?:#|b)?\d)(?:\+[a-g](?:#|b)?\d)*)([whqeszt]?\.?)$/.exec(tok);
    if (!m) return tok;
    const out = m[2].split('+').map((p) => {
      let x = midiOf(p);
      // off the scale, as a chromatic neighbour is: stay parallel by the same distance from the note below it
      let off = 0;
      while (!pcs.includes(((x % 12) + 12) % 12)) { x -= 1; off += 1; }
      let idx = pcs.indexOf(((x % 12) + 12) % 12);
      let oct = Math.floor(x / 12);
      idx += steps;
      oct += Math.floor(idx / pcs.length) - (pcs[0] > pcs[pcs.length - 1] ? 0 : 0);
      idx = ((idx % pcs.length) + pcs.length) % pcs.length;
      let y = oct * 12 + pcs[idx] + off + octave * 12;
      // keep the movement downward when asked to go down, across a scale written from a pitch class above zero
      if (steps < 0 && y >= midiOf(p)) y -= 12;
      if (steps > 0 && y <= midiOf(p)) y += 12;
      return nameOf(y, flat);
    }).join('+');
    return `${m[1]}${out}${m[3]}`;
  }).join(' ')).join(' | ');
}

// Notes joined under one bow or one breath: every note after the first of a bar slides on from the one before, unless it
// already has a way of starting of its own or follows a rest.
export function slur(lane) {
  return lane.split('|').map((bar) => {
    let prev = null;
    return bar.trim().split(/\s+/).filter(Boolean).map((tok) => {
      const isRest = /^r[whqeszt]?\.?$/.test(tok);
      const out = prev && !isRest && !/^[>?/~^%<=_]/.test(tok) ? `_${tok}` : tok;
      prev = isRest ? null : tok;
      return out;
    }).join(' ');
  }).join(' | ');
}

// ---------- Java: a balungan in kepatihan degrees, four to the gatra, and everything hung on it ----------
const gatras = (text) => text.split('|').map((g) => g.trim().split(/\s+/));
const step = (scale, tok, by) => { const i = scale.indexOf(tok); if (i < 0) throw new Error(`${tok} not in ${scale}`); return scale[Math.max(0, Math.min(scale.length - 1, i + by))]; };

// peking: each balungan note twice, in eighths, or four times in the battle pieces
export function peking(text, per = 2) {
  const dur = per === 4 ? 's' : 'e';
  return gatras(text).map((g) => g.flatMap((t) => Array(per).fill(t)).map((t, i) => (i ? t : `${t}${dur}`)).join(' ')).join(' | ');
}

// Two bonangs in imbal: one takes the note and the kempyung over it, the other sits in the holes. Then both settle on the goal
// of the gatra, the seleh, the way a sekaran lands. barung and panerus only make sense together.
export function imbal(text, scale) {
  const a = [], b = [];
  for (const g of gatras(text)) {
    const seleh = g[3], up = step(scale, seleh, 2), lo = step(scale, seleh, 1);
    a.push(`${seleh}s r ${seleh} r ${up} r ${seleh} r ${lo} r ${seleh} r ${seleh}q`);
    b.push(`rs ${up} r ${lo} r ${up} r ${lo} r ${up} r ${lo} rq`);
  }
  return { barung: a.join(' | '), panerus: b.join(' | ') };
}

// Walking bonang, pipilan: the pair of notes of each half gatra, alternating, an octave above the balungan.
export function pipilan(text) {
  return gatras(text).map((g) => [g[0], g[1], g[0], g[1], g[2], g[3], g[2], g[3]].map((t, i) => (i ? t : `${t}e`)).join(' ')).join(' | ');
}

// The colotomy of a lancaran, TWTN TPTN TPTN TPTG: four gatras to a gong, kempul silent on the first one (the wela).
export function lancaran(text) {
  const g = gatras(text);
  const kenong = g.map((x) => `rq r r ${x[3]}`).join(' | ');
  const kempul = g.map((x, i) => (i % 4 === 0 ? 'rw' : `rq ${x[1]} rq r`)).join(' | ');
  return { kenong, kempul, kethuk: 'x...x...', gong: '....|....|....|...x' };
}

// Ladrang frame: thirty two beats to the gong, kenong each eight, so here each pair of gatras.
export function ladrang(text) {
  const g = gatras(text);
  const kenong = g.map((x, i) => (i % 2 ? `rq r r ${x[3]}` : 'rw')).join(' | ');
  const kempul = g.map((x, i) => (i % 2 ? 'rw' : `rq r r ${x[3]}`)).join(' | ');
  return { kenong, kempul, kethuk: '..x...x.', gong: '....|....|....|....|....|....|....|...x' };
}

// Sampak, the battle piece of the wayang: kenong on every beat, kempul every other, gong at each second gatra.
export function sampak(text) {
  const g = gatras(text);
  const kenong = g.map((x) => x.join(' ').replace(/^(\S+)/, '$1q')).join(' | ');
  const kempul = g.map((x) => `rq ${x[1]} rq ${x[3]}`).join(' | ');
  return { kenong, kempul, kethuk: 'x.x.x.x.', gong: '....|...x' };
}
