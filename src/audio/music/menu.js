// The menu theme carries the whole trip in one tune: accordion, then țambal, then gamelan bells over the same bouncing
// band. The two stingers quote its opening rise. All composed for this game.
import { kotekan } from './lib.js';

const G_PENTA = ['g4', 'a4', 'b4', 'd5', 'e5', 'g5', 'a5', 'b5', 'd6', 'e6', 'g6', 'a6', 'b6', 'd7'];

const FRIENDS = {
  lead: { inst: 'accordion', gain: 1, pan: -0.08, send: 0.13, width: 0.42, jitter: 0.06 },
  tambal: { inst: 'tambal', gain: 1.15, pan: 0.12, send: 0.17, jitter: 0.07, loose: 0.005 },
  bells: { inst: 'bell', gain: 0.75, pan: 0.04, send: 0.2, jitter: 0.06 },
  counter: { inst: 'clarinet', gain: 0.25, pan: 0.28, send: 0.18, jitter: 0.06 },
  polos: { inst: 'gangsa', gain: 0.32, pan: -0.34, send: 0.12, jitter: 0.08 },
  sangsih: { inst: 'gangsa', gain: 0.32, pan: 0.34, send: 0.12, jitter: 0.08 },
  arp: { inst: 'tambal', gain: 0.42, pan: -0.34, send: 0.14, arpTop: 79, jitter: 0.08, loose: 0.005 },
  comp: { inst: 'squeeze', gain: 0.36, pan: -0.18, send: 0.07, low: 55, high: 69, width: 0.3, breath: 0.2 },
  bass: { inst: 'bassPluck', gain: 0.48, send: 0.03, bassTop: 50, jitter: 0.05, loose: 0.004 },
  kick: { inst: 'perc', voice: 'kick', gain: 0.24, send: 0.01, loose: 0.002 },
  snare: { inst: 'perc', voice: 'snare', gain: 0.3, pan: -0.05, send: 0.06 },
  hat: { inst: 'perc', voice: 'shaker', gain: 0.26, pan: 0.2, send: 0.02, jitter: 0.2 },
  gong: { inst: 'perc', voice: 'kempur', gain: 0.3, send: 0.2, flat: true, loose: 0 },
  kendang: { inst: 'perc', map: { d: 'dag', t: 'tut', p: 'pak', k: 'ket', x: 'dag' }, gain: 0.34, pan: 0.16, send: 0.06, jitter: 0.12 },
};

const BELL_T = 'g5 g5 | e5 d5 | e5 a5 | g5 d6 | e5 b5 | e5 g5 | a5 d5 | g5 g5';
const bellKot = kotekan(BELL_T, G_PENTA, 'norot');

export const menu = {
  name: 'menu', tempo: 118, beats: 4, swing: 0.045, level: 1.22,
  parts: FRIENDS,
  auto: { bass: 'bounceBass', comp: 'bounceComp' },
  sections: {
    A: {
      bars: 8,
      harm: 'G | Em | C | D7 | G | Em | Am D7 | G',
      lead: `d5e g5 b5q a5e g5 e5q | b4q e5e g5 e5q b4 | c5e e5 g5q c6q. b5e | a5q f#5 d5h |
             d5e g5 b5q d6e c6 b5q | g5q b5e e6 b5q g5 | c6e b5 a5 c6 a5q f#5 | g5q d5 g5h`,
      counter: `g4h d5h | g4h e5h | e5h g5h | f#5h a4q d5 |
                g4h b4h | e5h b4h | a4q c5 d5 c5 | b4e c5 d5 e5 d5q b4`,
      auto: { arp: 'arpBells' },
      perc: { kick: 'x...x...', snare: '..o...o.', hat: 'x.o.x.o.' },
      fill: { snare: '..o.xxxX' },
    },
    B: {
      bars: 8,
      harm: 'C | G | Am | Em | F | C | D7 | D7',
      tambal: `e5s g5 c6 e6 g6e e6 c6q g5 | b5e d6 g6q d6e b5 g5q | a5s c6 e6 a6 g6e e6 c6q a5 | b5e e6 g6q e6e b5 g5q |
               a5s c6 f6 a6 g6e f6 c6q a5 | g5e c6 e6q c6e g5 e5q | f#5e a5 d6 f#6 e6 d6 c6 a5 | f#5q a5 c6 >d6`,
      counter: `g4h c5h | d5h b4h | c5h e5h | b4h g4h |
                a4h c5h | c5h g4h | a4q c5 d5 f#5 | a5q f#5 d5 a4`,
      perc: { kick: 'x...x...', snare: '..o...o.', hat: 'x.o.x.o.' },
      fill: { snare: 'x.x.xxXX' },
    },
    C: {
      bars: 8,
      harm: 'G | G | C | G | Em | C | D7 | G',
      bells: `g5e a5 b5 d6 e6q d6e b5 | a5q b5e a5 g5q e5 | e5e g5 a5 b5 d6q b5e a5 | >g5h d6q b5 |
              e6e d6 b5 a5 b5q g5 | e5e g5 a5 g5 e5q g5 | a5e b5 d6 e6 d6q a5 | >g5h. d5q`,
      polos: bellKot.polos,
      sangsih: bellKot.sangsih,
      perc: {
        gong: 'x...............|................|................|................',
        kendang: 'd..t.p..d..t.pt.|d..t.p..d.tt.pk.',
        hat: 'o.o.o.o.',
      },
      fill: { kendang: 'ddttppkkdtpkdtpk' },
    },
  },
  form: [
    { s: 'A', label: 'Accordion', mute: ['counter'] },
    { s: 'A', label: "Accordion'" },
    { s: 'B', label: 'Tambal' },
    { s: 'C', label: 'Bells' },
    { s: 'B', label: "Tambal'", mute: ['counter'] },
    { s: 'A', label: 'All' },
  ],
};

// A short flourish, then done: the screen is what carries on.
export const results = {
  name: 'results', tempo: 132, beats: 4, once: true, level: 1.5,
  parts: FRIENDS,
  auto: { bass: 'bounceBass', comp: 'bounceComp' },
  sections: {
    S: {
      bars: 4,
      harm: 'G | C D7 | Em C | G',
      lead: 'd5e g5 b5 d6 g6q d6e b5 | c6e e6 g6q f#6e a6 d6q | e6e g6 b6 g6 c6 e6 g6 e6 | >g6h rh',
      tambal: 'b4s d5 g5 b5 d6 g6 b6 g6 d6 b5 g5 d5 b4 d5 g5 b5 | c5s e5 g5 c6 e6 g6 c6 e6 d5 f#5 a5 d6 f#6 a6 d6 f#6 | e5s g5 b5 e6 g6 b6 e6 g6 c5 e5 g5 c6 e6 g6 c6 e6 | %d6+g6h rh',
      bells: 'rw | rw | rw | >g6q b6 d6h',
      perc: { kick: 'x...x...', snare: '..o...o.', hat: 'x.o.x.o.', gong: '....|....|....|x...' },
    },
  },
  form: ['S'],
};

export const podium = {
  name: 'podium', tempo: 112, beats: 4, once: true, swing: 0, level: 1.2,
  parts: {
    ...FRIENDS,
    lead: { ...FRIENDS.lead, gain: 1.05 },
    counter: { ...FRIENDS.counter, gain: 0.3 },
    tuba: { inst: 'tuba', gain: 0.48, send: 0.05, bassTop: 48, jitter: 0.05 },
    cowbell: { inst: 'perc', map: { x: 'cowHi', l: 'cowLo' }, gain: 0.28, pan: 0.4, send: 0.2 },
    bigGong: { inst: 'perc', voice: 'gong', gain: 0.5, send: 0.24, flat: true, loose: 0 },
    tambal: { ...FRIENDS.tambal, gain: 0.8 },
  },
  auto: { comp: 'bounceComp', tuba: 'bounceBass' },
  sections: {
    S: {
      bars: 8,
      harm: 'C | F | G | C | Am | F | G7 | C',
      lead: `g5q c6e e6 g6q. e6e | f6q a6e f6 c6q a5 | g5e a5 b5 d6 g6q f6 | e6h c6h |
             e6q. e6e a6q e6 | f6q c6e f6 a6q f6 | g6e f6 e6 d6 b5q g5 | c6e g5 c6 e6 >c7h`,
      counter: `e5h c5q g5 | c5h f5q a4 | d5q b4 g4 b4 | c5e e5 g5 e5 c5q g4 |
                c5h e5q c5 | a4h c5q f5 | d5q f5 g5 f5 | e5e g5 e5 c5 >g4h`,
      tambal: `c5s e5 g5 c6 e5 g5 c6 e6 g5 c6 e6 g6 c6 e6 g6 c7 | a4s c5 f5 a5 c5 f5 a5 c6 f5 a5 c6 f6 a5 c6 f6 a6 | g4s b4 d5 g5 b4 d5 g5 b5 d5 g5 b5 d6 g5 b5 d6 g6 | %c6+e6h %g5+c6h |
               a4s c5 e5 a5 c5 e5 a5 c6 e5 a5 c6 e6 a5 c6 e6 a6 | a4s c5 f5 a5 c5 f5 a5 c6 f5 a5 c6 f6 a5 c6 f6 a6 | g4s b4 d5 f5 g5 b5 d6 f6 g6 f6 d6 b5 g5 f5 d5 b4 | %c6+e6+g6w`,
      bells: 'rw | rw | rw | rw | rw | rw | rw | >c7q e6 g6h',
      perc: {
        kick: 'x...x...', snare: '..x...x.', hat: 'x.o.x.o.',
        cowbell: 'x.......|........|x...l...|........',
        bigGong: '....|....|....|....|....|....|....|..x.',
      },
      fill: { snare: 'xxxxx...', cowbell: 'x.x.x...' },
    },
  },
  form: ['S'],
};
