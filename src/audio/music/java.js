// Bromo, East Java: a gamelan, not a Balinese one. Bronze tuned singly with no paired beating, kept low and heavy: slenthem and
// demung underneath, sarons with the balungan, peking doubling it, two bonangs in imbal, a rebab and a suling floating over.
// The form is Javanese too: a lancaran on its TWTN TPTN TPTN TPTG cycle, a ladrang where the gong takes twice as long, and a
// sampak, the battle piece of the wayang, with its hammered repeated notes. The kendhang drives, in an East Javanese hand.
// An original balungan composed for this game, not a traditional gendhing.
import { peking, imbal, pipilan, lancaran, ladrang, sampak, slur } from './idiom.js';

// pelog as Javanese gamelans measure it, wide and uneven. Barang leaves out 1, nem leaves out 7, and 4 stays silent.
const PELOG_J = { base: 233, cents: { 1: 0, 2: 122, 3: 262, 4: 545, 5: 672, 6: 782, 7: 948 } };
const BARANG = ["2,", "3,", "5,", "6,", "7,", '2', '3', '5', '6', '7', "2'", "3'", "5'", "6'", "7'", "2''", "3''"];

const PARTS = {
  lead: { inst: 'saron', gain: 0.92, pan: -0.06, send: 0.13, jitter: 0.06, loose: 0.005 },
  demung: { inst: 'demung', gain: 0.56, pan: 0.12, oct: -1, send: 0.14, jitter: 0.05, loose: 0.004 },
  bass: { inst: 'slenthem', gain: 0.46, pan: 0, oct: -2, send: 0.1, jitter: 0.05, loose: 0.003 },
  peking: { inst: 'peking', gain: 0.38, pan: 0.3, oct: 1, send: 0.1, jitter: 0.08, loose: 0.006 },
  barung: { inst: 'bonang', gain: 0.6, pan: -0.32, send: 0.12, jitter: 0.08, loose: 0.004 },
  panerus: { inst: 'bonang', gain: 0.46, pan: 0.34, oct: 1, send: 0.12, jitter: 0.08, loose: 0.004 },
  rebab: { inst: 'rebab', gain: 0.5, pan: 0.2, oct: 1, send: 0.26, jitter: 0.05 },
  suling: { inst: 'sulingBamboo', gain: 0.34, pan: -0.24, oct: 1, send: 0.3, jitter: 0.05 },
  gender: { inst: 'gender', gain: 0.34, pan: -0.14, oct: 1, send: 0.2, jitter: 0.07 },
  kenong: { inst: 'kenong', gain: 0.5, pan: 0.2, oct: 1, send: 0.2, flat: true, jitter: 0.03, loose: 0 },
  kempul: { inst: 'kempul', gain: 0.6, pan: -0.2, oct: -1, send: 0.2, flat: true, jitter: 0.03, loose: 0 },
  kethuk: { inst: 'perc', voice: 'kethuk', gain: 0.34, pan: 0.28, send: 0.08, flat: true, loose: 0 },
  gong: { inst: 'perc', voice: 'gongAgeng', gain: 0.64, send: 0.2, flat: true, loose: 0 },
  // d dhah, o dhong, t thung, k tak, h dhet, l tlang
  kendhang: { inst: 'perc', map: { d: 'kDhah', o: 'kDhong', t: 'kThung', k: 'kTak', h: 'kDhet', l: 'kTlang' }, gain: 0.66, pan: 0.05, send: 0.07, jitter: 0.12, loose: 0.006 },
};

// A gong on 6, on 3, on 5, on 6: four gongan, each gatra walking to its seleh
const LAN = `2 3 5 6 | 7 6 5 3 | 5 6 7 2' | 7 6 5 6 |
             3 5 6 7 | 2' 7 6 5 | 3 2 3 5 | 6 7 5 3 |
             6 7 2' 3' | 2' 7 6 5 | 7 6 5 3 | 2 3 6 5 |
             6 5 3 2 | 3 5 7 6 | 2' 7 5 6 | 7 5 3 6`;
const lanFrame = lancaran(LAN);
const lanImbal = imbal(LAN, BARANG);

// pelog nem, a darker colour with 1 in it, in the long cycle
const LAD = `5 6 1' 6 | 5 3 2 3 | 5 3 2 1 | 2 3 5 6 |
             1' 2' 3' 2' | 1' 6 5 6 | 3 5 6 5 | 3 2 1 2 |
             3 2 1 2 | 3 5 6 5 | 1' 6 5 3 | 5 6 3 5 |
             6 5 3 2 | 1 2 3 5 | 6 1' 6 5 | 3 2 3 5`;
const ladFrame = ladrang(LAD);

const SAM = `6 6 6 6 | 5 5 5 5 | 3 3 3 3 | 6 6 6 6 |
             2' 2' 2' 2' | 7 7 7 7 | 5 5 6 6 | 7 7 6 6`;
const samFrame = sampak(SAM);
const samImbal = imbal(SAM, BARANG);

const DRUM_LAN = 'd..kt.kt.d.kt.k.|d.k.d.tkd..kt.kh|d..kt.kt.dtkt.k.|d.k.d.tkoo.kd.k.';
const DRUM_LAD = 'd.....t.o..k..t.|d.....tko..k.tkh';
const DRUM_SAM = 'd.tkd.tkd.tkd.tk|d.tkdktkdktkdktk';

export const bromo = {
  name: 'bromo', tempo: 126, beats: 4, level: 0.74, scale: PELOG_J,
  parts: PARTS,
  sections: {
    // the lancaran: loud, plain, the hammers together on the beat
    A: {
      bars: 16,
      lead: peking(LAN, 1).replace(/(\S+)e/g, '$1q'),
      demung: peking(LAN, 1).replace(/(\S+)e/g, '$1q'),
      bass: LAN.replace(/\s*\|\s*/g, ' | ').split(' | ').map((g) => { const x = g.trim().split(/\s+/); return `${x[1]}h ${x[3]}h`; }).join(' | '),
      peking: peking(LAN),
      barung: lanImbal.barung,
      panerus: lanImbal.panerus,
      kenong: lanFrame.kenong,
      kempul: lanFrame.kempul,
      perc: { kethuk: lanFrame.kethuk, gong: lanFrame.gong, kendhang: DRUM_LAN },
      fill: { kendhang: 'dtktdtktddttkkdk' },
    },
    // the ladrang: the same bronze twice as far apart, and over it a rebab and a suling in long lines
    B: {
      bars: 16,
      lead: peking(LAD, 1).replace(/(\S+)e/g, '$1q'),
      bass: LAD.split('|').map((g) => { const x = g.trim().split(/\s+/); return `${x[3]}h ${x[3]}h`; }).join(' | '),
      peking: peking(LAD),
      barung: pipilan(LAD),
      panerus: pipilan(LAD),
      gender: LAD.split('|').map((g) => { const x = g.trim().split(/\s+/); return `${x[0]}e ${x[1]} ${x[0]} ${x[1]} ${x[2]} ${x[3]} ${x[2]} ${x[3]}`; }).join(' | '),
      rebab: slur(`/5h. 6e 5 | 3h 2q 3 | /5q. 3e 2q 1 | 2q 3 5 6 |
              /1'h. 2'e 3' | 2'q 1' 6h | 3q 5 /6q. 5e | 3q 2 1 2 |
              3h. 2e 1 | 2q 3 /5h | 1'q 6 5 3 | 5q 6 3 5 |
              /6h 5q 3 | 2q 1 2 3 | /5q 6 1' 6 | 5w`),
      suling: `rw | rq 6e 1' 2'q 1' | rw | rh 2'e 3' 5'q |
               rw | 6'h 5'q 3' | rw | rq 2'e 1' 6q 5 |
               rw | rh 6e 1' 2'q | rw | rh 3'e 5' 6'q |
               rw | 5'q 3' 2' 1' | rw | rh 6e 1' 2' 3'`,
      kenong: ladFrame.kenong,
      kempul: ladFrame.kempul,
      perc: { kethuk: ladFrame.kethuk, gong: ladFrame.gong, kendhang: DRUM_LAD },
      fill: { kendhang: 'd.t.k.t.dtkt.kdk' },
    },
    // the sampak: everyone on one note at a time, the volcano talking back
    S: {
      bars: 8,
      lead: SAM.split('|').map((g) => { const x = g.trim().split(/\s+/); return `>${x[0]}q ${x[1]} ${x[2]} ${x[3]}`; }).join(' | '),
      demung: SAM.split('|').map((g) => { const x = g.trim().split(/\s+/); return `>${x[0]}e ${x[0]} ${x[1]} ${x[1]} ${x[2]} ${x[2]} ${x[3]} ${x[3]}`; }).join(' | '),
      bass: SAM.split('|').map((g) => { const x = g.trim().split(/\s+/); return `>${x[0]}h ${x[2]}h`; }).join(' | '),
      peking: peking(SAM, 4),
      barung: samImbal.barung,
      panerus: samImbal.panerus,
      kenong: samFrame.kenong,
      kempul: samFrame.kempul,
      perc: { kethuk: samFrame.kethuk, gong: samFrame.gong, kendhang: DRUM_SAM },
      fill: { kendhang: 'ddttkkddttkkdtkd' },
    },
  },
  form: [
    { s: 'A', label: 'Lancaran', dyn: 0.96 },
    { s: 'B', label: 'Ladrang', dyn: 0.88 },
    { s: 'A', label: "Lancaran'" },
    { s: 'S', label: 'Sampak', dyn: 1.06 },
    { s: 'B', label: "Ladrang'", dyn: 0.92 },
    { s: 'A', label: 'Lancaran last', dyn: 1.03 },
  ],
};
