// Indonesia: two original pieces for an imagined gamelan with kart energy. Bromo sits in a slendro with a slow beating
// ombak and a suling over the sand; Bali is a quick kebyar in pelog that changes mode in its second part. The degrees are
// the kepatihan numbers, the tunings are measured-style unequal scales, not a piano.
import { kotekan, slowKeys, kempyung } from './lib.js';

// slendro: five nearly equal steps, just uneven enough to stay alive
const SLENDRO = { base: 277, cents: { 1: 0, 2: 232, 3: 476, 5: 724, 6: 958 } };
const SL = ["1,", "2,", "3,", "5,", "6,", '1', '2', '3', '5', '6', "1'", "2'", "3'", "5'", "6'", "1''", "2''", "3''"];

const SARON = {
  lead: { inst: 'reyong', gain: 1, pan: 0.05, send: 0.14, jitter: 0.07 },
  counter: { inst: 'suling', gain: 0.62, pan: -0.22, send: 0.3, jitter: 0.05 },
  polos: { inst: 'gangsa', gain: 0.42, pan: -0.36, send: 0.11, oct: 1, jitter: 0.08, loose: 0.004 },
  sangsih: { inst: 'gangsa', gain: 0.42, pan: 0.36, send: 0.11, oct: 1, jitter: 0.08, loose: 0.004 },
  gender: { inst: 'bell', gain: 0.32, pan: 0.2, send: 0.2, jitter: 0.06 },
  bass: { inst: 'jegogan', gain: 0.54, pan: 0, send: 0.08, oct: -2, jitter: 0.05, loose: 0.004 },
  gong: { inst: 'perc', voice: 'gong', gain: 0.42, send: 0.22, flat: true, loose: 0 },
  kempur: { inst: 'perc', voice: 'kempur', gain: 0.42, pan: -0.12, send: 0.16, flat: true, loose: 0 },
  kemong: { inst: 'perc', voice: 'kemong', gain: 0.25, pan: 0.2, send: 0.12, flat: true, loose: 0 },
  kendang: { inst: 'perc', map: { d: 'dag', t: 'tut', p: 'pak', k: 'ket', x: 'dag' }, gain: 0.5, pan: 0.08, send: 0.07, jitter: 0.12 },
  ceng: { inst: 'perc', voice: 'ceng', gain: 0.1, pan: -0.28, send: 0.05, jitter: 0.2 },
  kick: { inst: 'perc', voice: 'kick', gain: 0.23, send: 0.01, loose: 0.002 },
};

// ---------- Mare di Sabbia: dawn over the caldera ----------
const BROMO_A_T = "3 5 | 5 1 | 5 6 | 6 6 | 3 5 | 6 2 | 1 3 | 1 2 | 5 1' | 1' 5 | 5 6 | 1' 3 | 3 6 | 5 5 | 3 2 | 6, 2";
const BROMO_B_T = "5 1' | 2' 6 | 5 2 | 3 3 | 5 1' | 3' 1' | 6 3 | 2 2 | 3 6 | 1' 1' | 5 2' | 3' 3' | 2' 5 | 3 3 | 2 3 | 6, 6,";
const aKot = kotekan(BROMO_A_T, SL, 'telu');
const bKot = kotekan(BROMO_B_T, SL, 'nyog');

const STRUCT = {
  gong: '................|................|................|............x...',
  kempur: '................|........x.......|................|................',
  kemong: '....x.......x...|....x...........|....x.......x...|....x...........',
};

export const bromo = {
  name: 'bromo', tempo: 150, beats: 4, scale: SLENDRO,
  parts: SARON,
  sections: {
    A: {
      bars: 16,
      lead: `6,e 1 2 3 5q 3e 5 | 6q 5e 3 2q 1 | 2e 3 5 6 1'q 6e 5 | >6h 3e 5 6q |
             6,e 1 2 3 5q 3e 5 | 1'q 6e 5 3q 2 | 3e 5 3 2 1q 2e 3 | >1h 6,e 1 2q |
             3q 5e 6 1'q 2' | 3'q 2'e 1' 6q 5 | 6e 1' 6 5 3q 5e 6 | >1'h 6e 5 3q |
             2q 3e 5 6q 1' | 2'e 1' 6 5 6q 5e 3 | 2e 3 5 3 2q 1e 2 | >6,h 6,q 1e 2`,
      polos: aKot.polos,
      sangsih: aKot.sangsih,
      bass: slowKeys(BROMO_A_T, 'h'),
      perc: {
        ...STRUCT,
        kendang: 'd..t.pt.d..t.pk.|d..t.pt.d.tt.pk.',
        ceng: 'x.x.x.x.x.x.x.x.',
        kick: 'x...x...x...x...',
      },
      fill: { kendang: 'ttppttppdtpkdtpk', ceng: 'x.x.x.x.xxxxxxxx' },
    },
    // the sand sea opens: long suling lines, the kotekan drops to a walk, stabs of two keys instead of a chord
    B: {
      bars: 16,
      counter: `5h 6q 1' | 2'h. 1'e 6 | 5q 6 5e 3 2q | 3w |
                5h 6q 1' | 3'h 2'q 1' | 6q 1'e 6 5q 3 | 2w |
                3h 5q 6 | 1'h. 2'e 1' | 6q 5e 6 1'q 2' | 3'w |
                2'q 1' 6 5 | 3h 5e 6 5 3 | 2q 3 5 3 | 6,w`,
      polos: bKot.polos,
      sangsih: bKot.sangsih,
      gender: kempyung(BROMO_B_T.replaceAll("1'", '1').replaceAll("2'", '2').replaceAll("3'", '3'), SL, 'long'),
      bass: slowKeys(BROMO_B_T, 'push'),
      perc: {
        gong: '................|................|................|............x...|................|................|................|............x...',
        kempur: '................|........x.......',
        kemong: '........x.......',
        kendang: 'd.......t..p..t.|d.....t.t..p.kt.',
        ceng: '....x.......x...',
        kick: 'x.......x.......',
      },
      fill: { kendang: 'dttpdttpkkppttdd', ceng: 'x.x.x.x.xxxxxxxx' },
    },
    // the vents: everyone together, sudden stops, the kendang alone in the gaps
    C: {
      bars: 8,
      lead: `1'e 1' rq 2'e 1' rq | 3'e r 3' r 2'e 1' 6 5 | 1'e 1' rq 2'e 1' rq | 5'e r 5' r 3'e 2' 1' 6 |
             5e 6 1' 2' 3' 5' 3' 2' | 1'q 6 5 3 | 2e 3 5 6 1' 2' 3' 5' | >6'h rh`,
      bass: "1e 1 rq 2e 1 rq | 3e r 3 r 2e 1 6, 5, | 1e 1 rq 2e 1 rq | 5e r 5 r 3e 2 1 6, | 5h 2h | 1h 5,h | 2h 5h | >6h rh",
      perc: {
        gong: 'x...............|................|x...............|................|x...............|................|................|x...............',
        kempur: '................|........x.......',
        kendang: '....tpkt....tpkk|.t.t.t.tdtpkdtpk|....tpkt....ttkk|.t.t.t.tdtpkdtpk|d.tpd.tpd.tpd.tp|d.tpd.tpdtpkdtpk|ddttppkkddttppkk|X.......dtpkdtpk',
        ceng: 'x.x.....x.x.....|................|x.x.....x.x.....|................|x.x.x.x.x.x.x.x.',
      },
    },
  },
  form: [
    { s: 'A', label: 'A', dyn: 0.96 },
    { s: 'B', label: 'B', dyn: 0.88 },
    { s: 'A', label: "A'" },
    { s: 'C', label: 'Vents', dyn: 1.06 },
    { s: 'B', label: "B'", dyn: 0.9 },
    { s: 'A', label: 'A last', dyn: 1.05 },
  ],
};

// ---------- Terrazze di Bali: a kebyar that bursts, runs and changes mode ----------
// saih pitu, seven unequal tones. Selisir uses 1 2 3 5 6, the second part moves to 1 2 4 5 7, a brighter and stranger mode.
const PELOG = { base: 311, cents: { 1: 0, 2: 122, 3: 274, 4: 538, 5: 676, 6: 788, 7: 1046 } };
const SELISIR = ["1,", "2,", "3,", "5,", "6,", '1', '2', '3', '5', '6', "1'", "2'", "3'", "5'", "6'", "1''", "2''", "3''"];
const TEMBUNG = ["1,", "2,", "4,", "5,", "7,", '1', '2', '4', '5', '7', "1'", "2'", "4'", "5'", "7'", "1''", "2''", "4''"];

const KEBYAR = {
  ...SARON,
  lead: { ...SARON.lead, gain: 1, send: 0.15 },
  polos: { ...SARON.polos, gain: 0.44, send: 0.13 },
  sangsih: { ...SARON.sangsih, gain: 0.44, send: 0.13 },
  counter: { inst: 'gangsa', gain: 0.46, pan: -0.14, send: 0.18, jitter: 0.06 },
  ceng: { ...SARON.ceng, gain: 0.1 },
  kendang: { ...SARON.kendang, gain: 0.54 },
};

const BALI_A_T = "3 5 | 5 1' | 2' 1' | 6 1' | 3 5 | 5 6 | 2 5 | 1' 3 | 6 2' | 6 1' | 2' 5 | 6 3' | 1' 6 | 6 3 | 3 2 | 1 1";
const BALI_B_T = "7 2' | 5 7 | 2' 5 | 4 7 | 2' 5' | 1' 1' | 4 1' | 2' 2' | 7 2' | 1' 4 | 4 1' | 2' 7 | 1' 4' | 1' 5 | 2 4 | 5 5";
const baliA = kotekan(BALI_A_T, SELISIR, 'telu');
const baliB = kotekan(BALI_B_T, TEMBUNG, 'nyog');

export const bali = {
  name: 'bali', tempo: 166, beats: 4, scale: PELOG,
  parts: KEBYAR,
  sections: {
    K: {
      bars: 8,
      lead: `>1'e 1' rq >2'e 1' rq | >3'e r 3' r 2'e 1' 6 5 | >1'e 1' rq >2'e 1' rq | >5'e r 5' r 3'e 2' 1' 6 |
             5e 6 1' 2' 3' 5' 3' 2' | 1'q 6 5 3 | 2e 3 5 6 1' 2' 3' 5' | >6'h rh`,
      counter: `1e 1 rq 2e 1 rq | 3e r 3 r 2e 1 6, 5, | 1e 1 rq 2e 1 rq | 5e r 5 r 3e 2 1 6, |
                5,e 6, 1 2 3 5 3 2 | 1q 6, 5, 3, | 2,e 3, 5, 6, 1 2 3 5 | >6h rh`,
      bass: '1e 1 rq 2e 1 rq | 3e r 3 r 2h | 1e 1 rq 2e 1 rq | 5e r 5 r 3h | 5h 2h | 1h 5,h | 2h 5h | >6h rh',
      perc: {
        gong: 'x...............|................|x...............|................|x...............|................|................|x...............',
        kempur: '................|........x.......',
        kendang: '....tpkt....tpkk|.t.t.t.tdtpkdtpk|....tpkt....ttkk|.t.t.t.tdtpkdtpk|d.tpd.tpd.tpd.tp|d.tpd.tpdtpkdtpk|ddttppkkddttppkk|X.......dtpkdtpk',
        ceng: 'x.x.....x.x.....|................|x.x.....x.x.....|................|x.x.x.x.x.x.x.x.',
      },
    },
    A: {
      bars: 16,
      lead: `1e 2 3 5 6q 5e 3 | 2q 3e 5 1'q. 6e | 5e 6 1' 2' 3'q 2'e 1' | >6h 5e 6 1'q |
             1e 2 3 5 6q 5e 3 | 2q 3e 5 6q. 5e | 3e 2 1 2 3q 5e 6 | >1'h 6e 5 3q |
             5q 6e 1' 2'q 3' | 2'e 1' 6 5 6q 1' | 3'e 5' 3' 2' 1'q 6e 5 | >6h 1'e 2' 3'q |
             5'q 3'e 2' 1'q 6 | 5e 6 1' 6 5q 3 | 2e 3 5 3 2q 1e 2 | >1h 1q 5,e 6,`,
      polos: baliA.polos,
      sangsih: baliA.sangsih,
      bass: slowKeys(BALI_A_T, 'h'),
      perc: {
        ...STRUCT,
        kendang: 'd.tp.kt.d.tp.ktk|d.tp.kt.dttp.kpk',
        ceng: 'x.xx.xx.x.xx.xx.',
        kick: 'x...x...x...x...',
      },
      fill: { kendang: 'dtpkdtpkddttppkk', ceng: 'x.x.x.x.xxxxxxxx' },
    },
    B: {
      bars: 16,
      lead: `4q 5e 7 1'q. 2'e | 1'e 7 5 4 5q 7 | >2'h 1'e 7 5q | 4h rq 5e 7 |
             1'q 2'e 4' 5'q. 4'e | 2'e 1' 7 1' 2'q 1' | 7e 5 4 5 7q 1' | >2'w |
             4q 5e 7 1'q. 2'e | 4'e 2' 1' 7 5q 4 | 2q 4e 5 7q 1' | >2'h. 1'e 7 |
             5q 7e 1' 2'q 4' | 5'e 4' 2' 1' 7q 5 | 4e 5 4 2 1q 2e 4 | >5w`,
      polos: baliB.polos,
      sangsih: baliB.sangsih,
      gender: kempyung(BALI_B_T.replaceAll("1'", '1').replaceAll("2'", '2').replaceAll("4'", '4').replaceAll("5'", '5'), TEMBUNG, 'long'),
      bass: slowKeys(BALI_B_T, 'push'),
      perc: {
        ...STRUCT,
        kendang: 'd..t..p.d..t.ptk|d..t..p.dt.t.ptk',
        ceng: '....x.......x...',
        kick: 'x.....x...x.....',
      },
      fill: { kendang: 'tktktktkdtpkdtpk', ceng: 'x.x.x.x.xxxxxxxx' },
    },
  },
  form: [
    { s: 'K', label: 'Kebyar', dyn: 1.06 },
    { s: 'A', label: 'A', dyn: 0.96 },
    { s: 'B', label: 'B', dyn: 0.88 },
    { s: 'A', label: "A'" },
    { s: 'K', label: 'Kebyar 2', dyn: 1.06 },
    { s: 'B', label: "B'", dyn: 0.9 },
    { s: 'A', label: 'A last', dyn: 1.04 },
  ],
};
