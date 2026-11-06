// Interlocking parts are a recipe, not a list of notes: written out by hand they would be pages of typos. From a line of
// target notes (one every two beats) these build the two halves of a kotekan: neither makes sense alone, together they
// run an unbroken stream of sixteenths that lands on each target.

const bars = (text) => text.split('|').map((b) => b.trim().split(/\s+/).filter(Boolean));

function indexIn(scale, tok) {
  const i = scale.indexOf(tok);
  if (i < 0) throw new Error(`${tok} is not in the kotekan scale`);
  return i;
}

// Three tones above the target, a syncopated 3-3-2 on the upper one.
const TELU = { polos: ['a', null, 'a', 'b', null, 'a', null, 'a'], sangsih: [null, 'c', null, null, 'c', null, 'c', null] };
// Four tones around the target, strictly alternating.
const NYOG = { polos: ['b', null, 'a', null, 'b', null, 'z', null], sangsih: [null, 'c', null, 'b', null, 'a', null, 'a'] };
// Two tones rocking on the target, for the calm passages.
const NOROT = { polos: ['b', null, 'b', 'a', null, 'b', null, 'a'], sangsih: [null, 'c', null, null, 'c', null, 'a', null] };
const STYLES = { telu: TELU, nyog: NYOG, norot: NOROT };

export function kotekan(targets, scale, style = 'telu') {
  const cell = STYLES[style];
  const line = (who) => bars(targets).map((bar) => bar.flatMap((t) => {
    const i = indexIn(scale, t);
    const pick = { a: scale[i], b: scale[Math.min(scale.length - 1, i + 1)], c: scale[Math.min(scale.length - 1, i + 2)], z: scale[Math.max(0, i - 1)] };
    return cell[who].map((k) => (k ? pick[k] : 'r'));
  }).map((t, k) => (k ? t : `${t}s`)).join(' ')).join(' | ');
  return { polos: line('polos'), sangsih: line('sangsih') };
}

// The slow keys walk through the same targets an octave group lower, each with its own rhythm cell.
export function slowKeys(targets, cell = 'h') {
  return bars(targets).map((bar) => bar.map((t) => (cell === 'h' ? `${t}h` : cell === 'push' ? `${t}q. ${t}e` : `${t}q ${t}`)).join(' ')).join(' | ');
}

// Two keys a kempyung apart, the gamelan's idea of a chord, stabbed in a long-short.
export function kempyung(targets, scale, cell = 'long') {
  return bars(targets).map((bar) => bar.map((t) => {
    const i = indexIn(scale, t);
    const pair = `${t}+${scale[Math.min(scale.length - 1, i + 2)]}`;
    return cell === 'long' ? `${pair}q. ${pair}e` : `re ${pair}e ${pair}q`;
  }).join(' ')).join(' | ');
}
