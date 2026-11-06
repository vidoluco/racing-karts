// Romania, three bands. Transfăgărășan: a taraf of lăutari playing a sârbă, the running 2/4 of the south, in the mode with the
// raised fourth; fiddle, nai, țambal, the cobza's țiitură, a bass fiddle. Bran: a Transylvanian string band, a primás, a contră
// sawing major triads under a minor tune in dűvő, a gordun and a struck gardon, and no nai, because there is none up there.
// Bucarest: the old town's courtyard music, a geampara in 7/8 (2+2+3) in the Hijaz mode, accordion and țambal. All original.
import { slur } from './idiom.js';

const TARAF = {
  lead: { inst: 'vioara', gain: 0.84, pan: 0.14, send: 0.15, jitter: 0.07, loose: 0.005 },
  counter: { inst: 'naiPipe', gain: 0.56, pan: -0.24, send: 0.26, jitter: 0.06, loose: 0.006 },
  arp: { inst: 'cimbalom', gain: 0.58, pan: -0.34, send: 0.13, arpTop: 84, jitter: 0.1, loose: 0.005 },
  comp: { inst: 'cobza', gain: 0.6, pan: 0.32, send: 0.05, low: 52, high: 65, strum: 0.018, jitter: 0.07, loose: 0.004 },
  squeeze: { inst: 'acordeon', gain: 0.26, pan: -0.14, send: 0.1, low: 57, high: 69, jitter: 0.05, loose: 0.005, breath: 0.33 },
  bass: { inst: 'contrabas', gain: 0.62, pan: 0, send: 0.03, bassTop: 52, jitter: 0.05, loose: 0.003 },
  tambal: { inst: 'cimbalom', gain: 1.1, pan: -0.14, send: 0.16, jitter: 0.07, loose: 0.004 },
  toba: { inst: 'perc', voice: 'toba', gain: 0.26, send: 0.04, jitter: 0.08, loose: 0.002 },
  stick: { inst: 'perc', voice: 'tobaStick', gain: 0.4, pan: 0.2, send: 0.04, jitter: 0.14, loose: 0.003 },
};

const A_RO = [9, 11, 0, 3, 4, 6, 7];

// ---------- Transfăgărășan: a sârbă up the hairpins, running sixteenths and a stamp at the end of every phrase ----------
export const transfagarasan = {
  name: 'transfagarasan', tempo: 152, beats: 2, level: 0.8, pcs: A_RO,
  parts: TARAF,
  auto: { bass: 'sarbaBass', comp: 'sarbaCobza', arp: 'arp16' },
  sections: {
    A: {
      bars: 16,
      harm: 'Am | Am | D7 | D7 | Am | Am | E7 | Am | Am | Am | D7 | D7 | F | E7 | Am | Am',
      lead: `e5s a5 b5 c6 d#6 e6 c6 a5 | =e6e c6 d#6s e6 c6 a5 | d6s f#6 a6 f#6 d6 c6 a5 f#5 | a5s d6 c6 a5 >^d6q |
             e5s a5 b5 c6 e6 d#6 e6 f#6 | >=e6e d#6 c6s d#6 c6 b5 | g#5s a5 b5 d6 e6 d6 b5 g#5 | a5s e5 a5 c6 >^a5q |
             /a6q e6e c6 | a5s c6 d#6 e6 f#6 e6 d#6 c6 | /f#6q d6e a5 | c6s d6 f#6 d6 c6 a5 f#5 a5 |
             f5s a5 c6 f6 a6 f6 c6 a5 | g#5s b5 e6 g#6 b6 g#6 e6 b5 | c6s a5 e6 c6 a6 e6 c6 a5 | >a5e e5 >a4q`,
      counter: `e5h | c5q e5 | f#5h | d5q a4 |
                e5h | c5q e5 | g#5q b5 | a5q e5 |
                a5q c6 | a5q e5 | a5q f#5 | a5q c6 |
                a5h | g#5q b5 | a5q e5 | a4e c5 d#5 e5`,
      perc: { toba: 'x...', stick: '..x.' },
      fill: { stick: 'x.xxxXXX', toba: 'x.x.' },
    },
    // the nai takes the tune up into the major, the fiddle answers under it
    B: {
      bars: 16,
      harm: 'C | C | G7 | G7 | G7 | G7 | C | E7 | F | C | G7 | C | Am | D7 | E7 | E7',
      lead: slur(`/e5q g5 | c6e. b5s a5e g5 | /f5q d5 | b4e d5 f5 g5 |
             /g5q. a5e | f5e e5 d5 b4 | c5e e5 g5 c6 | /b5q. g#5e |
             /a5q c6 | g5e. a5s g5e e5 | f5e g5 a5 b5 | c6q e5 |
             a5e c6 e6 c6 | /f#6q d6 | g#5s a5 b5 d6 ^e6q | ~e6h`),
      counter: `rq g4s c5 e5 g5 | e5q c5 | b4q. g4e | rq d5s f5 g5 b5 |
                d5q g4 | f4e g4 b4 d5 | c5q g5 | g#5q e5 |
                a4q c5 | c5q e5 | d5q f5 | e5q g5 |
                c5q e5 | d5q f#5 | e5q g#5 | b5s g#5 e5 d5 b4 g#4 e4 g#4`,
      bass: '@|@|@|@|@|@|@|e3e d3 c3 b2|@|@|@|@|@|@|@|e3e b2 g#2 e2',
      auto: { squeeze: 'sarbaKontra' },
      perc: { toba: 'x...', stick: '..o.' },
      fill: { stick: 'x.x.xXXX' },
    },
    // the fiddle steps back and the țambal runs, rolling on its long notes
    C: {
      bars: 8,
      harm: 'Am | Dm | E7 | Am | F | Dm | E7 | E7',
      tambal: `a4s c5 e5 a5 g#5 a5 e5 c5 | d5s f5 a5 d6 c#6 d6 a5 f5 | e5s g#5 b5 e6 d6 b5 g#5 b5 | a5s e5 c5 e5 >%a5q |
               f5s a5 c6 f6 e6 c6 a5 c6 | d6s a5 f5 a5 >%d5q | b4s d5 g#5 b5 d6 b5 g#5 d5 | e5s f5 g#5 a5 b5 c6 d6 e6`,
      lead: 'e5h | f5h | g#5h | a5h | a5h | a5q f5 | g#5h | b5h',
      auto: { arp: null },
      perc: { stick: '..o.' },
      fill: { stick: 'x.x.xxXX' },
    },
  },
  form: [
    { s: 'A', label: 'A', dyn: 0.96, mute: ['counter'] },
    { s: 'B', label: 'B', dyn: 0.92, route: { lead: 'counter', counter: 'lead' } },
    { s: 'A', label: "A'" },
    { s: 'C', label: 'Tambal', dyn: 0.9, vel: { lead: 0.55 } },
    { s: 'B', label: "B'", dyn: 0.96, route: { lead: 'counter', counter: 'lead' } },
    { s: 'A', label: 'A last', dyn: 1.05 },
  ],
};

// ---------- Bran sotto la Luna: night in a Transylvanian dance house, a minor tune over major chords ----------
const D_DOR = [2, 4, 5, 7, 9, 11, 0];
const CETERA = {
  lead: { inst: 'primas', gain: 0.9, pan: 0.12, send: 0.2, jitter: 0.07, loose: 0.006 },
  counter: { inst: 'primas', gain: 0.46, pan: -0.28, send: 0.26, jitter: 0.06, loose: 0.008 },
  comp: { inst: 'kontraBow', gain: 0.34, pan: -0.16, send: 0.1, low: 55, high: 69, jitter: 0.06, loose: 0.005 },
  bass: { inst: 'gordun', gain: 0.7, pan: 0.04, send: 0.06, bassTop: 50, jitter: 0.05, loose: 0.004 },
  gardon: { inst: 'gardon', gain: 0.6, pan: 0.26, send: 0.07, bassTop: 52, jitter: 0.1, loose: 0.004 },
  hand: { inst: 'perc', voice: 'plattler', gain: 0.34, pan: -0.32, send: 0.14, jitter: 0.2, loose: 0.006 },
};

export const bran = {
  name: 'bran', tempo: 136, beats: 4, pcs: D_DOR, swing: 0.018, chordsClash: true,
  parts: CETERA,
  auto: { bass: 'esztamBass', comp: 'duvo' },
  sections: {
    // the slow-walking tune, dűvő under it
    A: {
      bars: 16,
      harm: 'D | D | G | D | C | F | A | A | D | D | G | C | F | A | D | D',
      lead: `>a5e. f5s d5e f5 /a5q. c6e | =d6q c6e a5 f5q e5 | d5e. f5s g5e a5 /b5q a5e g5 | a5e f5 d5 e5 f5q d5 |
             c6e. a5s g5e e5 c5q e5e g5 | a5e c6 /f6q e6e c6 a5q | g5e. a5s c#6e e6 =d6q c#6 | a5e g5 f5 e5 d5q a4 |
             /d6e. f6s a6q f6e d6 c6q | a5e c6 d6 f6 /e6q. c6e | b5e. d6s g6e f6 d6q b5 | c6e e6 g6 e6 c6q g5 |
             a5e. c6s f6e e6 c6q a5 | e5e a5 c#6 e6 /g6q e6 | f6e e6 d6 c6 a5 f5 d5 e5 | >d5q a4 >d5 a4`,
      counter: `d5h. f5q | a4h d5 | d5h. b4q | a4h d5 |
                g4h. c5q | c5h a4 | a4h c#5 | e5h c#5 |
                f5h a5 | f5h g5 | d5h. g5q | e5h g5 |
                c5h f5 | e5h a5 | a4h f5 | d5h a4`,
      perc: { hand: '....x.......x...' },
      fill: { hand: '....x...x.x.x.xx' },
    },
    // the fast turn: the primás runs, the gardon comes in and hits
    B: {
      bars: 16,
      harm: 'D | D | C | C | G | D | A | A | D | D | F | C | G | D | A | D',
      lead: `d5s f5 a5 d6 c6 a5 f5 a5 d5e f5 a5 c6 | d6s c6 a5 f5 d6 c6 a5 f5 g5e a5 c6 d6 | c6s e6 g6 e6 c6 g5 e5 g5 c6e e6 g6 e6 | f6s e6 d6 c6 e6 d6 c6 a5 g5q c6 |
             b5s d6 g6 d6 b5 g5 d5 g5 b5e d6 g6 f6 | a6s f6 d6 a5 f6 d6 a5 f5 a5q d6 | e6s g6 a6 g6 e6 c#6 a5 c#6 e6e g6 a6 g6 | f6s e6 d6 c#6 e6 d6 c#6 a5 e5q a5 |
             /a5q. d6e f6s e6 d6 c6 a5e f5 | d5e f5 a5 d6 =f6q d6 | c6e f6 a6 f6 c6q a5 | g5e c6 e6 c6 g5q e5 |
             d6e g6 b6 g6 d6q b5 | a5e d6 f6 d6 a5q f5 | e5s a5 c#6 e6 a6 e6 c#6 a5 g6e e6 c#6 a5 | d6e a5 f5 a5 >d6q d5`,
      auto: { comp: 'esztam', gardon: 'gardonBeat' },
      perc: { hand: '....x...x...x...' },
      fill: { hand: 'x.x.x.x.x.x.xxxx' },
    },
    // down low on two strings, the kontra only after the beat
    C: {
      bars: 8,
      harm: 'D | D | G | D | F | C | A | A',
      lead: `a4e d5 f5 a5 f5q d5 | e5e f5 g5 a5 f5q d5 | b4e d5 g5 b5 a5q g5 | f5e e5 d5 e5 f5q a5 |
             c5e f5 a5 c6 a5q f5 | e5e g5 c6 e6 d6q c6 | c#6e e6 g6 e6 c#6q a5 | e5e g5 a5 c#6 e6 g5 a5 c#6`,
      counter: 'd4+a4w | d4+a4w | d4+g4w | d4+a4w | c4+f4w | c4+g4w | c#4+e4w | e4+a4w',
      auto: { comp: 'esztam' },
      perc: { hand: '....x.......x...' },
    },
  },
  form: [
    { s: 'A', label: 'Purtata', dyn: 0.94 },
    { s: 'B', label: 'Turn', dyn: 1 },
    { s: 'A', label: "Purtata'", dyn: 0.98 },
    { s: 'C', label: 'Low', dyn: 0.84 },
    { s: 'B', label: "Turn'", dyn: 1 },
    { s: 'A', label: 'Purtata last', dyn: 1.02 },
  ],
};

// ---------- Bucarest Sera d'Oro: a geampara from the old town, 2+2+3, the bar always a beat short of settling ----------
const A_HIJ = [9, 10, 1, 2, 4, 5, 7];
const CURTE = {
  lead: { inst: 'acordeon', gain: 0.82, pan: -0.12, send: 0.15, jitter: 0.06, loose: 0.005, breath: 0.38 },
  counter: { inst: 'taragot', gain: 0.56, pan: 0.2, send: 0.18, jitter: 0.07, loose: 0.006 },
  fiddle: { inst: 'vioara', gain: 0.44, pan: 0.34, send: 0.2, jitter: 0.07, loose: 0.006 },
  arp: { inst: 'cimbalom', gain: 0.6, pan: -0.34, send: 0.14, arpTop: 84, jitter: 0.1, loose: 0.005 },
  tambal: { inst: 'cimbalom', gain: 1.1, pan: -0.12, send: 0.16, jitter: 0.07, loose: 0.004 },
  comp: { inst: 'cobza', gain: 0.58, pan: 0.3, send: 0.06, low: 52, high: 65, strum: 0.018, jitter: 0.07, loose: 0.004 },
  bass: { inst: 'contrabas', gain: 0.58, send: 0.03, bassTop: 52, jitter: 0.05, loose: 0.003 },
  toba: { inst: 'perc', voice: 'toba', gain: 0.24, send: 0.04, jitter: 0.08, loose: 0.002 },
  stick: { inst: 'perc', voice: 'tobaStick', gain: 0.34, pan: 0.18, send: 0.04, jitter: 0.14, loose: 0.003 },
};
const GEAMP = 'x.x.x..';
const GEAMP_S = '.x.x.xx';

const BUC_A = `a5e bb5 c#6 d6 e6q. | e6e f6 e6 d6 c#6 bb5 a5 | =a5q bb5 c#6e d6 e6 | f6e g6 f6 e6 d6 c#6 d6 |
               a6e f6 e6 d6 e6 d6 c#6 | d6q a5 f5e g5 a5 | a5e g5 f5 e5 f5 g5 a5 | a5q e5 >a5q. |
               g5e bb5 d6 g6 f6 e6 d6 | bb5e d6 g6 f6 e6 d6 c#6 | c#6e e6 a6 g6 f6 e6 d6 | c#6q a5 e5e f5 g5 |
               bb5e d6 f6 d6 bb5 a5 g5 | a5e c#6 e6 g6 f6 e6 d6 | d6e f6 e6 d6 c#6 bb5 a5 | a5q e5 >a4q.`;

export const bucarest = {
  name: 'bucarest', tempo: 152, beats: 3.5, level: 0.84, pcs: A_HIJ,
  parts: CURTE,
  auto: { bass: 'geampBass', comp: 'geampComp', arp: 'geampArp' },
  sections: {
    A: {
      bars: 16,
      harm: 'A | A | A | Dm | Dm | Dm | A | A | Gm | Gm | A | A | Bb | A | Dm | A',
      lead: BUC_A,
      counter: `rh rq. | rh rq. | rh rq. | rh rq. | rh rq. | rh rq. | e5h f5e g5 a5 | /a5h e5q. |
                rh rq. | rh rq. | rh rq. | rh rq. | d5h d5q. | /e5h g5q. | f5h e5q. | /e5h a4q.`,
      perc: { toba: GEAMP, stick: GEAMP_S },
      fill: { stick: 'xxxxXXX' },
    },
    // the clarinet, in the relative minor, with the fiddle a third under it
    B: {
      bars: 16,
      harm: 'Dm | Dm | A7 | A7 | A7 | A7 | Dm | Dm | Gm | Gm | Dm | Dm | Bb | A7 | Dm | A7',
      lead: slur(`/f5q a5 d6e c#6 d6 | a5q f5 d5e e5 f5 | e5q g5 c#6e bb5 a5 | g5e a5 bb5 a5 g5 f5 e5 |
             /c#6q e6 g6e f6 e6 | e6e d6 c#6 bb5 a5 g5 a5 | d6e f6 a6 f6 d6 a5 f5 | d6q a5 d5q. |
             g5e bb5 d6 g6 f6 d6 bb5 | d6e c6 bb5 a5 g5 a5 bb5 | a5e d6 f6 a6 f6 d6 a5 | f5q a5 d6q. |
             bb5e d6 f6 d6 bb5 g5 f5 | a5e c#6 e6 g6 e6 c#6 a5 | d6e f6 a6 g6 f6 e6 d6 | c#6q e6 a6q.`),
      fiddle: `d5q f5 a5e g5 f5 | f5q d5 a4e c#5 d5 | c#5q e5 g5e g5 f5 | e5e f5 g5 f5 e5 d5 c#5 |
               a5q c#6 e6e d6 c#6 | c#6e bb5 a5 g5 f5 e5 f5 | a5e d6 f6 d6 a5 f5 d5 | a5q f5 a4q. |
               d5e g5 bb5 d6 c6 bb5 g5 | bb5e a5 g5 f5 e5 f5 g5 | f5e a5 d6 f6 d6 a5 f5 | d5q f5 a5q. |
               f5e bb5 d6 bb5 f5 d5 d5 | e5e a5 c#6 e6 c#6 a5 e5 | a5e d6 f6 e6 d6 c#6 a5 | a5q c#6 e6q.`,
      perc: { toba: GEAMP, stick: GEAMP_S },
      fill: { stick: 'xxxxXXX' },
    },
    // the țambal alone in front, the hammers rolling on the last note
    C: {
      bars: 8,
      harm: 'A | Bb | Dm | A | Gm | A | Bb | A',
      tambal: `a4s c#5 e5 a5 c#6 e6 a6 e6 c#6 a5 e5 c#5 a4e | bb4s d5 f5 bb5 a5 g5 f5 e5 d5 c#5 bb4 a4 %a4e | d5s f5 a5 d6 f6 a6 f6 d6 a5 f5 d5 a4 d5e | e5s a5 c#6 e6 a6 e6 c#6 a5 g5 f5 e5 d5 c#5e |
               g4s bb4 d5 g5 bb5 d6 g6 d6 bb5 g5 d5 bb4 g4e | a4s c#5 e5 a5 c#6 e6 g6 e6 c#6 a5 g5 e5 c#5e | bb4s d5 f5 bb5 d6 f6 bb6 f6 d6 bb5 f5 d5 bb4e | %a5+e6h %e5+a5q.`,
      lead: 'e5h rq. | d5h rq. | f5h rq. | e5h rq. | d5h rq. | e5h rq. | d5h rq. | e5h rq.',
      auto: { arp: null },
      perc: { toba: 'x...x..', stick: '.x.x.xx' },
      fill: { stick: 'xxxxXXX' },
    },
  },
  form: [
    { s: 'A', label: 'A', dyn: 0.96, mute: ['counter'] },
    { s: 'B', label: 'B', dyn: 0.92, route: { lead: 'counter', counter: 'lead' } },
    { s: 'A', label: "A'" },
    { s: 'C', label: 'Tambal', dyn: 0.92 },
    { s: 'B', label: "B'", dyn: 0.96, route: { lead: 'counter', counter: 'lead' } },
    { s: 'A', label: 'A last', dyn: 1.04 },
  ],
};
