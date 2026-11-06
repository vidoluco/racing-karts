// Romania: an original sârbă and an original night hora, in the Romanian minor (the raised fourth is the whole colour).
// A taraf: fiddle, nai, țambal, the kontra sawing offbeats, a string bass. Everything here was composed for this game.

const TARAF = {
  lead: { inst: 'fiddle', gain: 0.84, pan: 0.13, send: 0.15, jitter: 0.07, loose: 0.006 },
  counter: { inst: 'nai', gain: 0.42, pan: -0.24, send: 0.26, jitter: 0.06 },
  arp: { inst: 'tambal', gain: 0.46, pan: -0.32, send: 0.13, arpTop: 84, jitter: 0.1, loose: 0.006 },
  comp: { inst: 'kontra', gain: 0.7, pan: 0.32, send: 0.05, low: 57, high: 69, jitter: 0.06, loose: 0.006 },
  bass: { inst: 'bassPluck', gain: 0.52, pan: 0, send: 0.03, bassTop: 52, jitter: 0.05, loose: 0.004 },
  kick: { inst: 'perc', voice: 'kick', gain: 0.32, send: 0.01, loose: 0.002 },
  snare: { inst: 'perc', voice: 'snare', gain: 0.36, pan: -0.08, send: 0.05 },
  hat: { inst: 'perc', voice: 'shaker', gain: 0.3, pan: 0.2, send: 0.02, jitter: 0.2 },
  // the țambal as a soloist in the interludes
  tambal: { inst: 'tambal', gain: 1, pan: -0.14, send: 0.16, jitter: 0.07, loose: 0.005 },
};

const A_RO = [9, 11, 0, 3, 4, 6, 7];

// ---------- Transfăgărășan: a sârbă up the hairpins, running sixteenths and a stamp at the end of every phrase ----------
export const transfagarasan = {
  name: 'transfagarasan', tempo: 150, beats: 2, pcs: A_RO,
  parts: TARAF,
  auto: { bass: 'sarbaBass', comp: 'sarbaKontra', arp: 'arp16' },
  sections: {
    A: {
      bars: 16,
      harm: 'Am | Am | D7 | D7 | Am | Am | E7 | Am | Am | Am | D7 | D7 | F | E7 | Am | Am',
      lead: `a5s b5 c6 a5 e6e c6 | d#6s e6 f#6 e6 d#6e c6 | d6s e6 f#6 d6 a5e f#5 | c6s a5 f#5 a5 d6q |
             a5s b5 c6 a5 e6e c6 | a5s c6 d#6 e6 c6e a5 | g#5s a5 b5 d6 e6e b5 | c6s b5 a5 g#5 a5q |
             e5s a5 c6 e6 >a6q | a6s g6 f#6 e6 d#6e c6 | f#6s e6 d6 c6 a5e d6 | f#5s a5 c6 d6 >f#6q |
             f6e e6 d6 c6 | b5e g#5 e5 g#5 | a5s c6 e6 c6 a5e e5 | >a5e e5 >a4q`,
      counter: `e5h | d#5q e5 | f#5h | d5q a4 |
                e5h | d#5q e5 | g#5q b5 | a5q e5 |
                a5q c6 | b5q a5 | a5q f#5 | a5q c6 |
                a5h | g#5q b5 | a5q e5 | a4e c5 d#5 e5`,
      perc: { kick: 'x.x.', snare: '.o.x', hat: 'x.o.x.o.' },
      fill: { snare: 'x.xxxXXX', kick: 'x.xx' },
    },
    B: {
      bars: 16,
      harm: 'C | C | G7 | G7 | G7 | G7 | C | E7 | F | C | G7 | C | Am | D7 | E7 | E7',
      lead: `/e5q g5 | c6e b5 a5 g5 | f5q. g5e | d5q b4 |
             b4e d5 f5 g5 | a5e g5 f5 d5 | e5e g5 c6 e6 | e6q. d6e |
             c6q a5 | g5e e5 c5 e5 | f5e g5 b5 d6 | c6q e5 |
             a5e c6 e6 c6 | f#6e d6 a5 f#5 | g#5s a5 b5 d6 e6q | ~e6h`,
      counter: `rq g4s c5 e5 g5 | e5q c5 | b4q. g4e | rq d5s f5 g5 b5 |
                d5q g4 | f4e g4 b4 d5 | c5q g5 | g#5q e5 |
                a4q c5 | c5q e5 | d5q f5 | e5q g5 |
                c5q e5 | d5q f#5 | e5q g#5 | b5s g#5 e5 d5 b4 g#4 e4 g#4`,
      bass: '@|@|@|@|@|@|@|e3e d3 c3 b2|@|@|@|@|@|@|@|e3e b2 g#2 e2',
      perc: { kick: 'x.x.', snare: '.o.o', hat: 'x.o.x.o.' },
      fill: { snare: 'x.x.xXXX', kick: 'x.xx' },
    },
    // the fiddle steps back and the țambal runs
    C: {
      bars: 8,
      harm: 'Am | Dm | E7 | Am | F | Dm | E7 | E7',
      tambal: `a4s c5 e5 a5 g#5 a5 e5 c5 | d5s f5 a5 d6 c#6 d6 a5 f5 | e5s g#5 b5 e6 d6 b5 g#5 b5 | a5s e5 c5 e5 >a5q |
               f5s a5 c6 f6 e6 c6 a5 c6 | d6s a5 f5 a5 >d5q | b4s d5 g#5 b5 d6 b5 g#5 d5 | e5s f5 g#5 a5 b5 c6 d6 e6`,
      lead: 'e5h | f5h | g#5h | a5h | a5h | a5q f5 | g#5h | b5h',
      auto: { arp: null },
      perc: { kick: 'x.x.', hat: 'x.o.x.o.' },
      fill: { snare: 'x.x.xxXX' },
    },
  },
  form: [
    { s: 'A', label: 'A', dyn: 0.96, mute: ['counter'] },
    { s: 'B', label: 'B', dyn: 0.92, route: { lead: 'counter', counter: 'lead' } },
    { s: 'A', label: "A'" },
    { s: 'C', label: 'Tambal', dyn: 0.9, vel: { lead: 0.6 } },
    { s: 'B', label: "B'", dyn: 0.96, route: { lead: 'counter', counter: 'lead' } },
    { s: 'A', label: 'A last', dyn: 1.06 },
  ],
};

const D_RO = [2, 4, 5, 8, 9, 11, 0];

// ---------- Bran sotto la Luna: a lilting hora in 6/8, the long-short of a friendly night walk ----------
const NIGHT = {
  ...TARAF,
  lead: { inst: 'nai', gain: 0.56, pan: -0.14, send: 0.3, jitter: 0.06 },
  counter: { inst: 'fiddle', gain: 0.55, pan: 0.24, send: 0.22, jitter: 0.06 },
  arp: { ...TARAF.arp, gain: 0.5, arpTop: 79 },
  comp: { ...TARAF.comp, gain: 0.62, low: 55, high: 67 },
  bass: { ...TARAF.bass, gain: 0.48, bassTop: 50 },
  tok: { inst: 'perc', voice: 'tok', gain: 0.3, pan: 0.36, send: 0.18, jitter: 0.2 },
};

export const bran = {
  name: 'bran', tempo: 150, beats: 3, pcs: D_RO, swing: 0,
  parts: NIGHT,
  auto: { bass: 'horaBass', comp: 'horaKontra', arp: 'arp68' },
  sections: {
    A: {
      bars: 16,
      harm: 'Dm | Dm | G7 | Dm | Bb | C | A7 | A7 | Dm | Dm | G7 | Dm | Bb | A7 | Dm | Dm',
      lead: `/a5q d6e f6q. | e6e d6 c6 a5q. | b5q d6e g6q. | f6e e6 d6 a5q. |
             bb5q d6e f6q f6e | e6q c6e g5q. | a5e c#6 e6 g6q e6e | c#6q. a5q. |
             /a5q d6e f6q. | g#6e a6 g#6 f6q d6e | g6q. f6e d6 b5 | a5q f5e d5q. |
             d6q bb5e f5q bb5e | c#6q e6e a6q. | f6e e6 d6 c#6 d6 e6 | >d6q. rq.`,
      counter: `f4q. a4q. | a4q. f4q. | g4q. b4q. | a4q f4e d4q. |
                f4q. bb4q. | g4q. e5q. | e5q. c#5q. | e5e c#5 a4 g4 a4 c#5 |
                a4q. f4q. | f4e a4 d5 f5q. | d5q. b4q. | d5q. f4q. |
                f4q. d5q. | e5q. g5q. | a4q. g#4q. | a4e c5 d5 e5 f5 g#5`,
      bass: '@|@|@|@|@|@|@|a2q. c#3e e3 g3|@|@|@|@|@|@|@|d3e c3 a2 f2 e2 c#2',
      perc: { kick: 'x.....', snare: '...o..', tok: '..x.xo' },
      fill: { snare: '...xxX', tok: 'x.xxxX' },
    },
    B: {
      bars: 16,
      harm: 'F | F | C7 | C7 | C7 | C7 | F | A7 | Bb | F | G7 | C7 | F | Dm | G7 | A7',
      lead: `a5q c6e f6q. | e6e f6 g6 f6q c6e | e5q g5e c6q. | bb5e a5 g5 e5q. |
             c5q e5e g5q bb5e | a5e g5 e5 c5q. | a5q c6e f6q f6e | e6q c#6e a5q. |
             bb5q d6e f6q. | f6e e6 c6 a5q. | b5q d6e f6q d6e | e6e c6 bb5 g5q. |
             a5e c6 f6 >a6q. | f6e d6 a5 f5q. | g5e b5 d6 f6 d6 b5 | c#6q. e6e g6 a6`,
      counter: `c5q. f5q. | a5q. f5q. | g5q. bb5q. | g5q. c5q. |
                e5q. g5q. | e5q. g5q. | f5q. c5q. | e5q. g5q. |
                d5q. f5q. | c5q. f5q. | d5q. g5q. | g5q. e5q. |
                c5q. f5q. | a5q. f5q. | b5q. g5q. | a5q. g5e e5 c#5`,
      bass: '@|@|@|@|@|@|@|a2e c#3 e3 g3 e3 c#3|@|@|@|@|@|@|@|a2e g2 e2 c#2 e2 g2',
      perc: { kick: 'x.....', snare: '...o..', tok: '..o.x.' },
      fill: { snare: 'x..xXX', tok: 'x.x.xx' },
    },
    // tiptoe: the țambal alone with the nai holding the moon above it
    C: {
      bars: 8,
      harm: 'Dm | Dm | Bb | A7 | Dm | Dm | G7 | A7',
      tambal: `d5e f5 a5 g#5 a5 f5 | d6q c6e a5q. | bb5e d6 f6 e6 d6 bb5 | a5e g5 e5 c#5q. |
               d5e f5 a5 d6 f6 a6 | g#6e a6 f6 d6q a5e | b5e d6 f6 g6q f6e | e6e c#6 a5 g5 e5 c#5`,
      lead: 'f5h. | a5h. | f5h. | e5h. | a5h. | f5h. | g5h. | a5h.',
      auto: { arp: null },
      perc: { tok: 'x..x..', kick: 'x.....' },
      fill: { tok: 'x.xxxx', snare: '....xX' },
    },
  },
  form: [
    { s: 'A', label: 'A', dyn: 0.95 },
    { s: 'B', label: 'B', dyn: 0.92, route: { lead: 'counter', counter: 'lead' } },
    { s: 'A', label: "A'", mute: ['kick'] },
    { s: 'C', label: 'Tiptoe', dyn: 0.82, mute: ['counter'] },
    { s: 'B', label: "B'", dyn: 0.96, route: { lead: 'counter', counter: 'lead' } },
    { s: 'A', label: 'A last', dyn: 1.05 },
  ],
};
