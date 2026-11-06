// Cadore: three original dances for the valley bands of the Dolomites, each in the idiom of its band. The Ländler is a
// Tanzlmusi, a button box with its helikon basses, a clarinet in thirds, a guitar. The polka is a Blasmusik, Flügelhorns in
// thirds, a Tenorhorn answering, afterbeat horns and a tuba, in the flat keys brass lives in. The mazurka is the bright one,
// clarinet and trumpet over a Hackbrett, with the weight of each bar on its second beat. Only I, IV and V, as a diatonic box
// allows, parallel thirds, the yodel's leap of a sixth. Everything here was composed for this game.
import { diatonic } from './idiom.js';

const G = [0, 2, 4, 6, 7, 9, 11], D = [1, 2, 4, 6, 7, 9, 11], C = [0, 2, 4, 5, 7, 9, 11];
const Bb = [0, 2, 3, 5, 7, 9, 10], F = [0, 2, 4, 5, 7, 9, 10], Eb = [0, 2, 3, 5, 7, 8, 10], A = [1, 2, 4, 6, 8, 9, 11];

const TANZL = {
  lead: { inst: 'steirische', gain: 0.92, pan: -0.1, send: 0.12, jitter: 0.06, loose: 0.006, breath: 0.27 },
  counter: { inst: 'klarinette', gain: 0.5, pan: 0.22, send: 0.16, jitter: 0.06, loose: 0.008 },
  comp: { inst: 'steirischeLH', gain: 0.5, pan: -0.14, send: 0.05, low: 55, high: 69, jitter: 0.05, loose: 0.004 },
  guitar: { inst: 'gitarre', gain: 0.56, pan: 0.3, send: 0.07, low: 52, high: 67, strum: 0.012, jitter: 0.07, loose: 0.004 },
  bass: { inst: 'helikon', gain: 0.8, pan: 0.02, send: 0.04, bassTop: 50, jitter: 0.05, loose: 0.004 },
  hack: { inst: 'hackbrett', gain: 0.42, pan: 0.36, send: 0.16, arpTop: 84, jitter: 0.1, loose: 0.006 },
  cowbell: { inst: 'perc', map: { x: 'cowHi', l: 'cowLo' }, gain: 0.2, pan: 0.42, send: 0.28, loose: 0.03 },
  slap: { inst: 'perc', voice: 'plattler', gain: 0.6, pan: -0.24, send: 0.1, jitter: 0.14 },
};

// ---------- Giro dell'Antelao: a Ländler that yodels up to the top of its range ----------
const ANT_A = `d5q b5 g5 | d5q b5e a5 g5q | c5q a5 f#5 | d5e e5 f#5 a5 c6q |
               c6q a5e f#5 d5q | f#5e a5 c6 a5 f#5q | g5q b5e g5 d5q | g5e f#5 g5 a5 b5q |
               d6q b5 g5 | d6q b5e c6 d6q | e6q c6 g5 | e6e d6 c6 b5 c6q |
               b5q d6e b5 g5q | a5q c6e a5 f#5q | g5e b5 a5 f#5 g5q | g5q d5 g4`;
const ANT_B = `a5q f#5e a5 d6q | f#6q d6 a5 | c#6e e6 a6q g6 | e6e c#6 a5 c#6 e6q |
               g6q e6e c#6 a5q | c#6e d6 e6 g6 a6q | f#6q a6e f#6 d6q | a5e b5 c#6 d6 e6 f#6 |
               g6q b5 d6 | g6e f#6 e6 d6 b5q | a5q d6 f#6 | a6e g6 f#6 e6 d6q |
               e6q g6 e6 | c#6e e6 a5 c#6 e6q | d6e f#6 a6 f#6 d6q | d6q c6 a5`;
const ANT_T = `e5q g5 c6 | e6h c6q | d6q b5 g5 | f6h d6q |
               b5q d6 f6 | g6e f6 d6 b5 g5q | c6q e6 g6 | e6e d6 c6 b5 c6q |
               f5q a5 c6 | f6h a5q | g5q c6 e6 | g6e e6 c6 g5 e5q |
               d6q f6 b5 | d6e c6 b5 a5 g5q | c6e g5 e5 g5 c6q | d6q c6 a5`;

export const antelao = {
  name: 'antelao', tempo: 160, beats: 3, level: 0.9, feel: [0, -0.014, 0.008], pcs: G,
  parts: TANZL,
  auto: { bass: 'laendlerBass', comp: 'laendlerComp', guitar: 'laendlerComp' },
  sections: {
    A: {
      bars: 16,
      harm: 'G | G | D7 | D7 | D7 | D7 | G | G | G | G | C | C | G | D7 | G | G',
      lead: ANT_A,
      counter: diatonic(ANT_A, -2, G),
      bass: '@|@|@|@|@|@|@|g2q a2 b2|@|@|@|@|@|@|@|g2q d2 f#2',
      perc: { cowbell: 'x.....|......|l..x..|......', slap: '......|......|......|..x.x.' },
      fill: { cowbell: 'x.x.lx', slap: 'x.x.xx' },
    },
    B: {
      bars: 16,
      harm: 'D | D | A7 | A7 | A7 | A7 | D | D | G | G | D | D | A7 | A7 | D | D7',
      lead: ANT_B,
      counter: diatonic(ANT_B, -2, D),
      bass: '@|@|@|@|@|@|@|d3q e3 f#3|@|@|@|@|@|@|@|d3q f#2 a2',
      auto: { hack: 'hackbrettWalz' },
      perc: { cowbell: '......|x.....|......|l.....', slap: '......|......|......|x.x.x.' },
      fill: { slap: 'x.xxxx', cowbell: 'l.x.x.' },
    },
    // the trio goes to the subdominant, the clarinet takes the song and the box follows a sixth below
    T: {
      bars: 16,
      harm: 'C | C | G7 | G7 | G7 | G7 | C | C | F | F | C | C | G7 | G7 | C | D7',
      lead: diatonic(ANT_T, -5, C, { octave: 0 }),
      counter: ANT_T,
      bass: '@|@|@|@|@|@|@|c3q d3 e3|@|@|@|@|@|@|@|d3q a2 f#2',
      auto: { hack: 'hackbrettWalz' },
      perc: { cowbell: '......|......|......|......|......|......|......|x.....', slap: '......' },
      fill: { slap: 'x.x.xX', cowbell: 'x.l.x.' },
    },
  },
  form: [
    { s: 'A', label: 'A', mute: ['counter'] },
    { s: 'B', label: 'B', dyn: 0.94 },
    { s: 'A', label: "A'", dyn: 0.92 },
    { s: 'T', label: 'Trio', dyn: 0.86, vel: { counter: 1.15 } },
    { s: 'A', label: 'A last', dyn: 1.05, vel: { cowbell: 1.2, slap: 1.2 } },
  ],
};

// ---------- Pelmo d'Inverno: a Blasmusik polka in the snow, sleigh bells on the road ----------
const BLAS = {
  lead: { inst: 'fluegel', gain: 0.88, pan: -0.12, send: 0.14, jitter: 0.05, loose: 0.005 },
  counter: { inst: 'fluegel', gain: 0.56, pan: 0.14, send: 0.14, jitter: 0.06, loose: 0.007 },
  tenor: { inst: 'tenorhorn', gain: 0.5, pan: 0.28, send: 0.14, jitter: 0.06, loose: 0.008 },
  clarino: { inst: 'klarinette', gain: 0.44, pan: -0.3, send: 0.18, jitter: 0.07, loose: 0.006 },
  comp: { inst: 'begleit', gain: 0.5, pan: -0.28, send: 0.08, low: 58, high: 70, jitter: 0.05, loose: 0.004 },
  bass: { inst: 'basstuba', gain: 0.95, pan: 0.03, send: 0.05, bassTop: 46, jitter: 0.04, loose: 0.004 },
  grosse: { inst: 'perc', voice: 'grosse', gain: 0.46, pan: 0, send: 0.06, jitter: 0.08, loose: 0.003 },
  tschin: { inst: 'perc', voice: 'tschin', gain: 0.4, pan: 0.2, send: 0.08, jitter: 0.12, loose: 0.003 },
  snare: { inst: 'perc', voice: 'stickSnare', gain: 0.55, pan: -0.1, send: 0.06, jitter: 0.14, loose: 0.004 },
  jingle: { inst: 'perc', voice: 'jingle', gain: 0.24, pan: 0.32, send: 0.12, jitter: 0.25, loose: 0.02 },
  cowbell: { inst: 'perc', map: { x: 'cowHi', l: 'cowLo' }, gain: 0.18, pan: -0.4, send: 0.26, loose: 0.03 },
};

const PEL_A = `d5e f5 bb5 d6 | d6e. c6s bb5e f5 | c6e a5 f5 a5 | eb6e. c6s a5e f5 |
               a5e c6 f6 eb6 | c6e. a5s f5e a5 | bb5e d6 f6 d6 | bb5q f5 |
               d5e f5 bb5 d6 | eb6e. d6s eb6e g6 | f6e d6 bb5 f5 | d6e c6 bb5 a5 |
               g5e bb5 e6 g6 | f6e eb6 c6 a5 | bb5e f5 d5 f5 | >bb5e bb5 >bb5q`;
const PEL_B = `c6q a5 | f5e a5 c6 f6 | e6e c6 g5 c6 | bb5e. a5s g5e e5 |
               g5e bb5 e6 g6 | bb6e g6 e6 c6 | a5e c6 f6 a6 | f6q c6 |
               c6q a5 | f5e a5 c6 f6 | g6e bb5 c6 d6 | a5e. g5s f5e a5 |
               d6e bb5 g5 bb5 | a5e c6 f6 c6 | g5s a5 bb5 c6 e6e g6 | >f6e c6 >f6q`;
const PEL_T = `bb5q. g5e | eb5q g5 | bb5q. g5e | f5q bb5 |
               ab5q. f5e | d5q f5 | bb5e ab5 f5 d5 | g5q eb5 |
               bb5q. g5e | eb6q bb5 | c6q. ab5e | eb6q c6 |
               bb5e g5 eb5 g5 | d6e c6 bb5 ab5 | g5e bb5 ab5 f5 | >eb5e bb4 >eb5q`;
const TEN_A = `bb3q d4 | f4e d4 bb3q | c4q f4 | a4e f4 c4q |
               f4q a4 | c5e a4 f4q | d4q f4 | bb3e c4 d4 f4 |
               bb3q d4 | g4e eb4 bb3q | d4q f4 | f4e d4 bb3q |
               c4q e4 | a4e f4 c4q | d4q bb3 | f4e d4 bb3q`;
const TEN_B = `f4e g4 a4 c5 | a4q f4 | g4e a4 bb4 c5 | bb4q g4 |
               e4e f4 g4 bb4 | c5q e4 | f4e a4 c5 f5 | a4q c5 |
               f4e g4 a4 c5 | a4q f4 | bb4e a4 g4 bb4 | c5q f4 |
               g4e a4 bb4 d5 | c5q a4 | c5e bb4 g4 e4 | f4e a4 f4q`;

export const pelmo = {
  name: 'pelmo', tempo: 130, beats: 2, level: 0.66, pcs: Bb,
  parts: BLAS,
  auto: { bass: 'polkaBass', comp: 'polkaComp' },
  sections: {
    A: {
      bars: 16,
      harm: 'Bb | Bb | F7 | F7 | F7 | F7 | Bb | Bb | Bb | Eb | Bb | Bb | C7 | F7 | Bb | Bb',
      lead: PEL_A,
      counter: diatonic(PEL_A, -2, Bb, { flat: true }),
      tenor: TEN_A,
      bass: '@|@|@|@|@|@|@|bb2e c3 d3 f3|@|@|@|@|@|@|@|bb2e f2 d2 f2',
      perc: { grosse: 'x.x.', tschin: '.x.x', snare: '.o.o', jingle: 'x.o.o.o.', cowbell: 'x...|....|....|....' },
      fill: { snare: 'xxxxxXX.', grosse: 'x.xx', cowbell: 'x.lx' },
    },
    B: {
      bars: 16,
      harm: 'F | F | C7 | C7 | C7 | C7 | F | F | F | F | C7 | F | Bb | F | C7 | F',
      lead: PEL_B,
      counter: diatonic(PEL_B, -2, F, { flat: true }),
      tenor: TEN_B,
      bass: '@|@|@|@|@|@|@|f2e g2 a2 c3|@|@|@|@|@|@|@|f2e c3 a2 f2',
      perc: { grosse: 'x.x.', tschin: '.x.x', snare: '.o.o', jingle: 'x.o.x.o.' },
      fill: { snare: 'xxx.xxXX', grosse: 'x.xx' },
    },
    // the trio: down to the subdominant, the tune sung broad and the clarinet playing above it, as a band does
    T: {
      bars: 16,
      harm: 'Eb | Eb | Eb | Bb7 | Bb7 | Bb7 | Bb7 | Eb | Eb | Eb | Ab | Ab | Eb | Bb7 | Bb7 | Eb',
      lead: PEL_T,
      counter: diatonic(PEL_T, -2, Eb, { flat: true }),
      clarino: `g5s bb5 eb6 g6 bb6e g6 | eb6s g6 bb6 g6 eb6e bb5 | g5s bb5 eb6 g6 bb6e g6 | f6s d6 bb5 d6 f6e ab6 |
                ab6s f6 d6 f6 ab6e f6 | d6s f6 ab6 f6 d6e bb5 | ab5s bb5 d6 f6 ab6e f6 | g6s eb6 bb5 eb6 g6e bb6 |
                g5s bb5 eb6 g6 bb6e g6 | eb6s g6 bb6 g6 eb6e bb5 | ab5s c6 eb6 ab6 c7e ab6 | eb6s ab6 c7 ab6 eb6e c6 |
                g5s bb5 eb6 g6 bb6e g6 | f6s ab6 f6 d6 bb5e d6 | f6s ab6 f6 d6 bb5e ab5 | g5s bb5 eb6 g6 >eb6q`,
      bass: '@|@|@|@|@|@|@|eb3e f3 g3 bb3|@|@|@|@|@|@|@|eb3e bb2 g2 bb2',
      perc: { grosse: 'x.x.', tschin: '.o.o', jingle: 'x.o.o.o.', cowbell: '....|....|....|....|....|....|....|x...' },
      fill: { snare: 'x.x.xXxX', cowbell: 'x..l' },
    },
  },
  form: [
    { s: 'A', label: 'A' },
    { s: 'B', label: 'B', dyn: 0.92 },
    { s: 'A', label: "A'", dyn: 0.96, mute: ['cowbell'] },
    { s: 'T', label: 'Trio', dyn: 0.88 },
    { s: 'A', label: 'A last', dyn: 1.05, vel: { cowbell: 1.2 } },
  ],
};

// ---------- Cortina e il Giau: a mazurka in the sun, higher, brighter, a trumpet on top ----------
const SONNE = {
  lead: { inst: 'klarinette', gain: 0.62, pan: 0.16, send: 0.14, jitter: 0.06, loose: 0.006 },
  mid: { inst: 'klarinette', gain: 0.5, pan: 0.2, send: 0.14, jitter: 0.06, loose: 0.007 },
  counter: { inst: 'steirische', gain: 0.62, pan: -0.18, send: 0.12, jitter: 0.06, loose: 0.007, breath: 0.33 },
  tromba: { inst: 'trompete', gain: 0.5, pan: 0.04, send: 0.18, jitter: 0.06, loose: 0.006 },
  comp: { inst: 'begleit', gain: 0.44, pan: -0.26, send: 0.08, low: 57, high: 71, jitter: 0.05, loose: 0.004 },
  guitar: { inst: 'gitarre', gain: 0.5, pan: 0.32, send: 0.07, low: 52, high: 67, strum: 0.012, jitter: 0.07, loose: 0.004 },
  bass: { inst: 'basstuba', gain: 0.76, pan: 0.02, send: 0.05, bassTop: 50, jitter: 0.04, loose: 0.004 },
  hack: { inst: 'hackbrett', gain: 0.36, pan: 0.38, send: 0.16, arpTop: 88, jitter: 0.1, loose: 0.006 },
  grosse: { inst: 'perc', voice: 'grosse', gain: 0.34, send: 0.05, jitter: 0.08, loose: 0.003 },
  tschin: { inst: 'perc', voice: 'tschin', gain: 0.3, pan: 0.22, send: 0.08, jitter: 0.12, loose: 0.003 },
  cowbell: { inst: 'perc', map: { x: 'cowHi', l: 'cowLo' }, gain: 0.16, pan: -0.42, send: 0.28, loose: 0.03 },
};

const COR_A = `a5e. b5s >d6q f#6 | f#6e e6 >d6q a5 | g5e. a5s >c#6q e6 | e6e d6 >c#6q a5 |
               a5e. b5s >c#6q g6 | g6e f#6 >e6q c#6 | d6e. e6s >f#6q a6 | f#6e e6 >d6q a5 |
               a5e. b5s >d6q a6 | g6e f#6 >g6q b6 | a6e. g6s >f#6q d6 | f#6e e6 >d6q a5 |
               g#5e. a5s >b5q e6 | e6e d6 >c#6q a5 | d6e f#6 a6 f#6 d6q | d6q a5 f#5`;
const COR_B = `e6e. f#6s >a6q e6 | c#6e d6 >e6q c#6 | d6e. e6s >g#6q e6 | b5e c#6 >d6q b5 |
               e6e. f#6s >g#6q e6 | d6e c#6 >b5q g#5 | a5e. b5s >c#6q e6 | a6e g#6 >a6q e6 |
               e6e. f#6s >a6q e6 | c#6e d6 >e6q a6 | f#6e. g#6s >a6q f#6 | d6e c#6 >d6q f#6 |
               e6e. c#6s >a5q c#6 | b5e c#6 >d6q g#5 | a5e c#6 e6 c#6 a5q | a5q e5 c#5`;
const COR_T = `b5q d6 g6 | >g6e. f#6s e6q d6 | c6q e6 a6 | >a6e. g6s f#6q d6 |
               c6q f#6 a6 | >a6e. g6s f#6q e6 | d6q g6 b6 | >b6e. a6s g6q d6 |
               b5q d6 g6 | >g6e. f#6s g6q b6 | c6q e6 g6 | >g6e. f#6s e6q c6 |
               d6q f#6 a6 | c6e d6 f#6 a6 c6q | b5q d6 g6 | a5q c#6 e6`;

export const cortina = {
  name: 'cortina', tempo: 150, beats: 3, level: 0.72, feel: [0, 0.012, -0.004], pcs: D,
  parts: SONNE,
  auto: { bass: 'mazurkaBass', comp: 'mazurkaComp', guitar: 'mazurkaComp', hack: 'hackbrettWalz' },
  sections: {
    A: {
      bars: 16,
      harm: 'D | D | A7 | A7 | A7 | A7 | D | D | D | G | D | D | E7 | A7 | D | D',
      lead: COR_A,
      counter: diatonic(COR_A, -2, D),
      bass: '@|@|@|@|@|@|@|d3q e3 f#3|@|@|@|@|@|@|@|d3q a2 c#3',
      perc: { grosse: 'x.....', tschin: '..x...', cowbell: 'x.....|......|......|......' },
      fill: { cowbell: 'x.l.x.', grosse: 'x.x.x.' },
    },
    B: {
      bars: 16,
      harm: 'A | A | E7 | E7 | E7 | E7 | A | A | A | A | D | D | A | E7 | A | A',
      lead: COR_B,
      mid: diatonic(COR_B, -2, A),
      counter: diatonic(COR_B, -5, A),
      bass: '@|@|@|@|@|@|@|a2q b2 c#3|@|@|@|@|@|@|@|a2q e2 c#2',
      perc: { grosse: 'x.....', tschin: '..x...' },
      fill: { grosse: 'x.x.x.' },
    },
    T: {
      bars: 16,
      harm: 'G | G | C | D7 | D7 | D7 | G | G | G | G | C | C | D7 | D7 | G | A7',
      lead: COR_T,
      counter: diatonic(COR_T, -2, G),
      bass: '@|@|@|@|@|@|@|g2q a2 b2|@|@|@|@|@|@|@|a2q c#3 e3',
      perc: { tschin: '..x...', grosse: 'x.....', cowbell: '......|......|......|......|......|......|......|x.....' },
      fill: { grosse: 'x.x.xx', cowbell: 'x.l.x.' },
    },
  },
  form: [
    { s: 'A', label: 'A' },
    { s: 'B', label: 'B', dyn: 0.96, route: { lead: 'tromba' } },
    { s: 'A', label: "A'", dyn: 0.94, mute: ['hack'] },
    { s: 'T', label: 'Trio', dyn: 0.88 },
    { s: 'B', label: "B'", dyn: 0.98, route: { lead: 'tromba' } },
    { s: 'A', label: 'A last', dyn: 1.05, vel: { cowbell: 1.2 } },
  ],
};
