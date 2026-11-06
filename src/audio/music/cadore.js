// Cadore: an original Ländler and an original polka. Accordion and clarinet trade the tune, the tuba stamps, the bells
// come down from the pasture. Everything here was composed for this game.

const BAND = {
  lead: { inst: 'accordion', gain: 1.05, pan: -0.1, send: 0.12, width: 0.42, jitter: 0.06 },
  counter: { inst: 'clarinet', gain: 0.3, pan: 0.24, send: 0.17, jitter: 0.07 },
  comp: { inst: 'squeeze', gain: 0.5, pan: -0.16, send: 0.07, low: 55, high: 69, width: 0.3, breath: 0.23 },
  bass: { inst: 'tuba', gain: 0.52, pan: 0.03, send: 0.05, bassTop: 50, jitter: 0.05, loose: 0.006 },
  cowbell: { inst: 'perc', map: { x: 'cowHi', l: 'cowLo' }, gain: 0.3, pan: 0.42, send: 0.25, loose: 0.03 },
  snare: { inst: 'perc', voice: 'snare', gain: 0.42, pan: -0.06, send: 0.06 },
  hat: { inst: 'perc', voice: 'shaker', gain: 0.34, pan: 0.2, send: 0.02, jitter: 0.2 },
};

// ---------- Giro dell'Antelao: golden autumn, a Ländler that yodels up to the top of its range ----------
export const antelao = {
  name: 'antelao', tempo: 166, beats: 3, feel: [0, -0.012, 0.006],
  parts: BAND,
  auto: { bass: 'laendlerBass', comp: 'laendlerComp' },
  sections: {
    A: {
      bars: 16,
      harm: 'G | G | D7 | D7 | D7 | D7 | G | G | G | C | G | A7 | D7 | D7 | G | G',
      lead: `b4e d5 g5q b5 | a5e g5 e5q g5 | f#5e a5 d6q c6e a5 | f#5q. e5e d5q |
             c5e d5 f#5q a5 | c6e b5 a5q f#5 | g5e a5 b5 g5 d5q | g5q d5 g4 |
             b4e d5 g5q b5 | c6q e6 c6 | d6e b5 g5q b5 | a5e b5 c#6 d6 e6q |
             d6q. c6e a5q | f#5e g5 a5 f#5 d5q | g5e b5 d6 b5 g5q | >g5h rq`,
      counter: `g4h b4q | c5h b4q | a4h c5q | d5q c5 a4 |
                a4h. | c5q d5 e5 | d5h. | rq b4e c5 d5 e5 |
                d5h g4q | e5h g5q | d5h g4q | c#5h g5q |
                f#5h d5q | a4q c5 d5 | b4q d5 b4 | d5e c5 b4 a4 g4 a4`,
      bass: '@|@|@|@|@|@|@|g2q a2 b2|@|@|@|@|@|@|@|g2q b2 c#3',
      perc: { cowbell: 'x.....|......|l..x..|......', snare: '..o.o.', hat: 'x.o.o.' },
      fill: { snare: '..xxxX', cowbell: 'x.x.lx' },
    },
    B: {
      bars: 16,
      harm: 'D | D | A7 | A7 | A7 | A7 | D | D7 | G | G | D | D | A7 | A7 | D | D7',
      lead: `f#5q a5e f#5 d6q | d6e c#6 b5 a5 f#5q | e5q g5e e5 c#6q | c#6e b5 a5 g5 e5q |
             a4e c#5 e5 g5 a5q | c#6e e6 d6 c#6 a5q | d6q a5e f#5 d5q | f#5q a5 c6 |
             b5q. a5e g5q | b5e d6 >g6q d6 | f#5q. e5e d5q | a5e f#5 d6q a5 |
             g5q. f#5e e5q | c#6e b5 a5 g5 f#5 e5 | d5q f#5 a5 | c6q. b5e a5q`,
      counter: `d5q f#5e d5 a4q | f#5h d5q | c#5q e5e c#5 a4q | g4h a4q |
                e4h g4q | a4q c#5 e5 | f#5h d5q | a4h c5q |
                d5h b4q | g4e b4 d5 g5 b4 d5 | a4h f#4q | d5q f#5 d5 |
                e5h c#5q | e5q d5 c#5 | a4q d5 f#5 | d5e c5 b4 a4 g4 f#4`,
      bass: '@|@|@|@|@|@|@|d3q c3 a2|@|@|@|@|@|@|@|d3q f#2 a2',
      perc: { cowbell: '......|x.....|......|l.....', snare: '..o.o.', hat: 'x.o.o.' },
      fill: { snare: 'x.xxxX', cowbell: 'l.x.x.' },
    },
    // the trio goes to the subdominant, the clarinet takes the song and the accordion answers
    T: {
      bars: 16,
      harm: 'C | C | G7 | G7 | G7 | G7 | C | C | C | F | C | A7 | Dm | G7 | C | D7',
      lead: `e5h g5q | c6h b5e a5 | g5q f5 d5 | b4h d5q |
             f5h e5e d5 | g5h. | e5q c5 e5 | g5h. |
             e5h g5q | a5h c6q | g5q e5 c5 | e5e g5 a5 c#6 e6q |
             d6q a5 f5 | d5e e5 f5 g5 b5q | c6h g5q | d5q f#5 a5`,
      counter: `rq c5e e5 g5 e5 | e5q f5 e5 | d5h b4q | rq g4e b4 d5 f5 |
                d5h c5e b4 | b4q d5 f5 | c5h g4q | rq e5e g5 c6 g5 |
                c5h e5q | f5h a5q | e5q g5 e5 | c#5h e5q |
                a4q f5 d5 | f5e e5 d5 f5 g5 f5 | e5q g5 e5 | c5e b4 a4 g4 f#4 a4`,
      bass: '@|@|@|@|@|@|@|c3q d3 e3|@|@|@|@|@|@|@|d3q a2 f#2',
      perc: { snare: '..o.o.', hat: 'o.o.o.', cowbell: '......|......|......|......|......|......|......|x.....' },
      fill: { snare: 'x.x.xX', cowbell: 'x.l.x.' },
    },
  },
  form: [
    { s: 'A', label: 'A' },
    { s: 'B', label: 'B', dyn: 0.94 },
    { s: 'A', label: "A'", dyn: 0.9, mute: ['cowbell'], route: { lead: 'counter', counter: 'lead' } },
    { s: 'T', label: 'Trio', dyn: 0.82, route: { lead: 'counter', counter: 'lead' } },
    { s: 'A', label: 'A last', dyn: 1.06, vel: { cowbell: 1.2 } },
  ],
};

// ---------- Pelmo d'Inverno: crisp and quick, a polka with sleigh bells and a shadow of minor in the second strain ----------
const POLKA = {
  ...BAND,
  lead: { ...BAND.lead, inst: 'clarinet', gain: 0.38, pan: 0.2, width: 0, send: 0.16 },
  counter: { ...BAND.counter, inst: 'accordion', gain: 0.78, pan: -0.18, width: 0.4, send: 0.12 },
  jingle: { inst: 'perc', voice: 'jingle', gain: 0.32, pan: 0.3, send: 0.12, jitter: 0.25, loose: 0.02 },
  comp: { ...BAND.comp, low: 57, high: 71 },
};

export const pelmo = {
  name: 'pelmo', tempo: 128, beats: 2,
  parts: POLKA,
  auto: { bass: 'polkaBass', comp: 'polkaComp' },
  sections: {
    A: {
      bars: 16,
      harm: 'D | D | A7 | A7 | A7 | A7 | D | D | D | G | D | B7 | Em | A7 | D | D',
      lead: `f#5e a5 d6q | b5e a5 f#5 d5 | e5e g5 c#6q | b5e a5 g5 e5 |
             g5s f#5 e5 f#5 g5e e5 | c#5e e5 a5q | f#5e a5 g5 e5 | d6q d5 |
             f#5e a5 d6q | d6e b5 g5 b5 | a5e f#5 d5 f#5 | d#5e f#5 b5q |
             g5s f#5 e5 f#5 g5e b5 | a5e c#6 e6 c#6 | d6e a5 f#5 a5 | >d6q re a4`,
      counter: `d5q f#5 | f#5e d5 a4q | c#5q e5 | e5e c#5 a4q |
                c#5q e5 | a4e c#5 e5 g5 | d5q e5 | f#5e a5 f#5 d5 |
                a4q d5 | g4e b4 d5 g5 | f#5q d5 | b4q d#5 |
                e5q g5 | g5q e5 | f#5q d5 | a4e b4 c#5 d5`,
      bass: '@|@|@|@|@|@|@|d3e e3 f#3 g3|@|@|@|@|@|@|@|d3e a2 b2 c#3',
      perc: { snare: '.o.o', jingle: 'x.o.o.o.', hat: 'x.x.x.x.', cowbell: 'x...|....|....|....' },
      fill: { snare: 'xxxxxXX.', jingle: 'x.x.x.X.', cowbell: 'x.lx' },
    },
    B: {
      bars: 16,
      harm: 'Bm | Bm | F#7 | F#7 | F#7 | F#7 | Bm | Bm | G | D | A7 | D | G | D | E7 | A7',
      lead: `b5q f#5e b5 | d6e c#6 b5 f#5 | a#5q c#6e a#5 | f#5e g#5 a#5 c#6 |
             e6q c#6e a#5 | f#5e e5 c#5 e5 | d5e f#5 b5 d6 | b5q. re |
             b5e g5 d5 g5 | a5e f#5 d5 f#5 | g5e e5 c#5 e5 | f#5e a5 d6q |
             d6e b5 g5 b5 | a5q f#5 | g#5e b5 e6 d6 | c#6e a5 e5 g5`,
      counter: `d5h | f#4q b4 | c#5h | a#4q c#5 |
                a#4q f#4 | c#5e a#4 f#4 a#4 | b4q f#5 | f#4e g4 a4 a#4 |
                b4q d5 | a4q d5 | c#5q a4 | d5q f#5 |
                g5q d5 | f#5e d5 a4 d5 | e5q g#4 | a4e c#5 e5 a5`,
      bass: '@|@|@|@|@|@|@|b2e c#3 d3 d#3|@|@|@|@|@|@|e3q e2|a2e b2 c#3 e3',
      perc: { snare: '.o.o', jingle: 'x.o.x.o.', hat: 'x.x.x.x.' },
      fill: { snare: 'xxx.xxXX', jingle: 'x.x.x.X.' },
    },
    T: {
      bars: 16,
      harm: 'G | G | D7 | D7 | G | G | A7 | D7 | G | G | D7 | D7 | C | G | A7 | A7',
      lead: `b5q. g5e | d5q g5 | a5q. f#5e | d5q c6 |
             b5e c6 d6 b5 | g5q d5 | e5e g5 c#6 e6 | d6e c6 a5 f#5 |
             b5q. g5e | d6q b5 | c6q. a5e | f#5e a5 c6 a5 |
             g5e c6 e6 c6 | b5q d6 | c#6e e6 a5 g5 | e5e g5 c#6 g5`,
      counter: `g4q d5 | b4q d5 | c5q a4 | f#4e a4 d5 f#5 |
                d5q b4 | b4e d5 g5 b4 | a4q c#5 | c5q a4 |
                d5q b4 | g4e b4 d5 g5 | a4q c5 | d5q f#5 |
                e5q g5 | d5q g5 | e5q c#5 | a4e c#5 e5 a5`,
      bass: '@|@|@|@|@|@|@|d3e c3 a2 f#2|@|@|@|@|@|@|@|a2e g2 e2 g2',
      perc: { snare: '.o.o', jingle: 'x.o.o.o.', hat: 'o.o.o.o.', cowbell: '....|....|....|....|....|....|....|x...' },
      fill: { snare: 'x.x.xXxX', jingle: 'x.x.x.x.', cowbell: 'x..l' },
    },
  },
  form: [
    { s: 'A', label: 'A' },
    { s: 'B', label: 'B', dyn: 0.92, route: { lead: 'counter', counter: 'lead' } },
    { s: 'A', label: "A'", dyn: 0.96, oct: { counter: 1 }, mute: ['cowbell'] },
    { s: 'T', label: 'Trio', dyn: 0.84 },
    { s: 'A', label: 'A last', dyn: 1.06, route: { lead: 'counter', counter: 'lead' }, vel: { cowbell: 1.2 } },
  ],
};
