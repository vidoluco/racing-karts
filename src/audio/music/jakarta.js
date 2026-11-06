// Jakarta: an original street tune for the traffic. Not a song anyone knows: a quick line on a suling over a hand-drum pattern that
// swings between a high slap and a deep drop, in the bent minor that the radios of the angkot play. Its opening is made of horns.
const MINOR = { base: 294, cents: { 1: 0, 2: 180, 3: 310, 4: 500, 5: 700, 6: 810, 7: 1090 } };

const PARTS = {
  lead: { inst: 'suling', gain: 0.9, pan: 0.04, send: 0.2, jitter: 0.05 },
  counter: { inst: 'reyong', gain: 0.5, pan: -0.22, send: 0.16, jitter: 0.06 },
  polos: { inst: 'gangsa', gain: 0.4, pan: 0.32, send: 0.1, oct: 1, jitter: 0.08, loose: 0.004 },
  bass: { inst: 'jegogan', gain: 0.6, pan: 0, send: 0.06, oct: -2, jitter: 0.05, loose: 0.003 },
  gong: { inst: 'perc', voice: 'gong', gain: 0.32, send: 0.2, flat: true, loose: 0 },
  kendang: { inst: 'perc', map: { d: 'dag', t: 'tut', p: 'pak', k: 'ket', x: 'dag' }, gain: 0.6, pan: 0.06, send: 0.06, jitter: 0.12 },
  ceng: { inst: 'perc', voice: 'ceng', gain: 0.09, pan: -0.26, send: 0.05, jitter: 0.2 },
  kick: { inst: 'perc', voice: 'kick', gain: 0.26, send: 0.01, loose: 0.002 },
};

// a bar of bass from its root: the long note, the pickup, the fifth under it, home
const FIFTH = { 1: '5,', 2: '6,', 3: '7,', 4: '1', 5: '1', 6: '3', "5,": '1', "6,": '3', "7,": '4' };
const bassBar = (r) => `${r}q. ${r}e ${FIFTH[r]}q ${r}`;
const bassLine = (roots) => roots.map(bassBar).join(' | ');
// the afterbeat that keeps it moving
const offBar = (a, b) => `re ${a} re ${a} re ${b} re ${b}`;
const offLine = (pairs) => pairs.map(([a, b]) => offBar(a, b)).join(' | ');

const A_ROOTS = ['1', '1', '5,', '5,', '1', '1', '5,', '1', '1', '6,', '3', '5,', '6,', '5,', '1', '5,'];
const A_OFF = [['3', '5'], ['3', '5'], ['2', '5'], ['2', '5'], ['3', '5'], ['3', '5'], ['2', '5'], ['3', '5'], ['3', '5'], ['3', '6'], ['3', '5'], ['2', '5'], ['3', '6'], ['2', '5'], ['3', '5'], ['2', '5']];
const B_ROOTS = ['6,', '5,', '3', '5,', '6,', '6,', '3', '3', '1', '6,', '1', '5,', '6,', '6,', '1', '5,'];
const B_OFF = [['3', '6'], ['2', '5'], ['3', '5'], ['2', '5'], ['3', '6'], ['3', '6'], ['3', '5'], ['3', '5'], ['3', '5'], ['3', '6'], ['3', '5'], ['2', '5'], ['3', '6'], ['3', '6'], ['3', '5'], ['2', '5']];

const GONG = '................|................|................|............x...';
const DRUM = 'k..d..t.k..d..t.|k..d..t.k.dd.pt.';

export const jakarta = {
  name: 'jakarta', tempo: 164, beats: 4, scale: MINOR,
  parts: PARTS,
  sections: {
    // horns stuck at a light
    I: {
      bars: 8,
      lead: `>1'e 1' rq >1'e 1' rq | >7e 7 rq >6e 6 rq | >5e 5 rq >6e 7 1'q | >5h rh |
             >3'e 3' rq >3'e 3' rq | >2'e 2' rq >1'e 1' rq | 7e 1' 2' 3' 5'q 3'e 2' | >1'h rh`,
      counter: `1e 1 rq 1e 1 rq | 7,e 7, rq 6,e 6, rq | 5,e 5, rq 6,e 7, 1q | >5,h rh |
                3e 3 rq 3e 3 rq | 2e 2 rq 1e 1 rq | 7,h 3h | >1h rh`,
      bass: '1e 1 rq 1e 1 rq | 5,e 5, rq 6,e 6, rq | 5,e 5, rq 6,e 7, 1q | >5,h rh | 3e 3 rq 3e 3 rq | 5,e 5, rq 1e 1 rq | 5,h 5,h | >1h rh',
      perc: {
        gong: 'x...............|................|................|x...............|................|................|................|x...............',
        kendang: 'k.k.....k.k.....|k.k.....k.k.....|k.k.....dtpkdtpk|X...............|k.k.....k.k.....|k.k.....k.k.....|ddttppkkddttppkk|X.......dtpkdtpk',
        ceng: 'x.x.....x.x.....',
      },
    },
    A: {
      bars: 16,
      lead: `5q 6e 5 3q 2e 1 | 2e 3 5 3 >2h | 5q 6e 7 1'q 7e 6 | 5e 6 5 3 >5h |
             1'q 7e 6 5q 6e 7 | 1'e 2' 3' 2' >1'h | 7e 6 5 3 2q 3e 5 | >1h rq 5,e 7, |
             1q 3e 5 1'q. 7e | 6e 5 3 5 6q 7 | 1'e 3' 5' 3' 2'q 1'e 7 | >6h 5e 6 7q |
             1'q 7e 6 5q 3 | 2e 3 5 6 5q 3e 2 | 1e 2 3 2 1q 7,e 6, | >7,h 1q 2e 3`,
      counter: `3h 2h | 7,h 5,h | 3h 5h | 2h 7,h | 3h 5h | 5h 3h | 2h 7,h | 1w |
                3h 5h | 3h 6h | 5h 7h | 3h 5h | 3h 2h | 7,h 6,h | 5,h 3,h | 5,w`,
      polos: offLine(A_OFF),
      bass: bassLine(A_ROOTS),
      perc: { gong: GONG, kendang: DRUM, ceng: 'x.x.x.x.x.x.x.x.', kick: 'x.....x.x.....x.' },
      fill: { kendang: 'dtpkdtpkddttppkk', ceng: 'x.x.x.x.xxxxxxxx' },
    },
    // the road opens for a moment: everything climbs, the drum doubles
    B: {
      bars: 16,
      lead: `>5'h 3'e 2' 1'q | 7e 1' 2' 1' 7q 6 | 5q. 6e 7q 1' | >2'h rq 1'e 2' |
             3'e 5' 3' 2' 1'q 7 | 6e 7 1' 7 6q 5 | 3q 5e 6 7q 6e 5 | >3h 2e 3 5q |
             5'e r 5' r 3'e 2' 1' 7 | 1'e r 1' r 6e 7 1' 2' | 3'e r 3' r 1'e 7 6 5 | 6q 7 1' 2' |
             >3'h 2'e 1' 7q | 1'e 7 6 5 3q 5 | 6e 5 3 2 1q 2e 3 | >5h rq 7,e 1`,
      counter: `1h 7,h | 5,h 3h | 3h 5h | 5h 2h | 6,h 1h | 3h 1h | 5h 3h | 3w |
                5h 3h | 3h 6,h | 5h 3h | 2h 5h | 6,h 3h | 6,h 1h | 3h 1h | 2w`,
      polos: offLine(B_OFF),
      bass: bassLine(B_ROOTS),
      perc: { gong: GONG, kendang: 'k.dd.pt.k.dd.pt.|k.dd.pt.kkddttpk', ceng: 'x...x...x...x...', kick: 'x...x...x...x...' },
      fill: { kendang: 'ttkkttkkdtpkdtpk', ceng: 'x.x.x.x.xxxxxxxx' },
    },
  },
  form: [
    { s: 'I', label: 'Horns', dyn: 1.04 },
    { s: 'A', label: 'A', dyn: 0.96 },
    { s: 'B', label: 'B', dyn: 0.9 },
    { s: 'A', label: "A'" },
    { s: 'I', label: 'Horns 2', dyn: 1.04 },
    { s: 'B', label: "B'", dyn: 0.94 },
    { s: 'A', label: 'A last', dyn: 1.02 },
  ],
};
