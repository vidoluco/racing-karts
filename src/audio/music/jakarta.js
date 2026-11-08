// Jakarta: an original street tune for the traffic, a dangdut with the city's own Betawi band sitting in. The gendang is the
// engine: the dut is the big head bent up with the heel of the hand on the one, the dang rings on the four, tak and tung in
// between in three, three and two. A suling and a tehyan bend the tune in the Malay minor, a mandolin trembles and answers,
// a gambang runs and the kromong kettles sit in its holes, a kecrek ticks. Its opening is made of horns stuck at a light.
import { slur } from './idiom.js';

const A_MIN = [9, 11, 0, 2, 4, 5, 8];

const PARTS = {
  lead: { inst: 'sulingBamboo', gain: 0.78, pan: 0.04, send: 0.2, jitter: 0.05, loose: 0.005 },
  tehyan: { inst: 'tehyan', gain: 0.5, pan: 0.26, send: 0.2, jitter: 0.06, loose: 0.006 },
  counter: { inst: 'mandolin', gain: 0.85, pan: -0.24, send: 0.14, jitter: 0.08, loose: 0.005 },
  gambang: { inst: 'gambang', gain: 0.44, pan: -0.36, send: 0.1, arpTop: 91, jitter: 0.1, loose: 0.004 },
  kromong: { inst: 'kromong', gain: 0.34, pan: 0.36, send: 0.12, arpTop: 79, jitter: 0.08, loose: 0.004 },
  comp: { inst: 'gitarre', gain: 0.44, pan: 0.18, send: 0.05, low: 57, high: 69, strum: 0.012, jitter: 0.07, loose: 0.003 },
  bass: { inst: 'contrabas', gain: 0.6, pan: 0, send: 0.03, bassTop: 52, jitter: 0.05, loose: 0.003 },
  horn: { inst: 'trompete', gain: 0.48, pan: -0.16, send: 0.2, jitter: 0.06, loose: 0.008 },
  horn2: { inst: 'trompete', gain: 0.36, pan: 0.32, send: 0.22, jitter: 0.06, loose: 0.012 },
  gong: { inst: 'perc', voice: 'gong', gain: 0.3, send: 0.2, flat: true, loose: 0 },
  // u dut, d dang, k tak, t tung, e tek
  gendang: { inst: 'perc', map: { u: 'gDut', d: 'gDang', k: 'gTak', t: 'gTung', e: 'gTek' }, gain: 0.76, pan: 0.05, send: 0.05, jitter: 0.1, loose: 0.005 },
  kecrek: { inst: 'perc', voice: 'kecrek', gain: 0.4, pan: -0.2, send: 0.04, jitter: 0.2, loose: 0.004 },
};

const GONG = '................|................|................|............x...';
const DANGDUT = 'u..k..t.k.t.d..k|u..k..t.k.t.d.tk';
const KOPLO = 'd.k.d.kkd.k.d.kk|d.k.d.ktd.k.dtkk';

export const jakarta = {
  name: 'jakarta', tempo: 136, beats: 4, pcs: A_MIN,
  parts: PARTS,
  sections: {
    // horns stuck at a light, none of them agrees for long
    I: {
      bars: 8,
      harm: 'Am | Am | E7 | E7 | Dm | Dm | E7 | Am',
      lead: `re e6 =e6q rh | rq re b5 =c6q rq | rw | rh rq /b5e d6 |
             rw | /f6q e6e d6 rh | e6e d6 b5 g#5 e5q b5 | >a5h rh`,
      horn: `>a5e a5 rq >a5e a5 rq | >c6e r rq >b5e b5 rq | >g#5e g#5 rq >g#5e g#5 rq | >b5e d6 rq >e6h |
             >f5e f5 rq >a5e a5 rq | >d6e r rq >c6e c6 rq | b5e d6 e6 r >e6q g#5 | >a5h rh`,
      horn2: `rq >e5e e5 rq >e5e e5 | rq >eb5e eb5 rq >e5e e5 | rq >e5e e5 rq >d5e d5 | rq >g#4e b4 rq >g#4 |
              rq >d5e d5 rq >f5e f5 | rq >a4e a4 rq >a4e a4 | rq >g#4e g#4 rq >b4 | >e5h rh`,
      bass: 'a2e a2 rq a2e a2 rq | a2e a2 rq e2e e2 rq | e2e e2 rq e2e e2 rq | e2e e2 rq e3q e2 | d3e d3 rq d3e d3 rq | d3e d3 rq d3e d3 rq | e2e e2 rq e2q e2 | >a2h rh',
      perc: {
        gong: 'x...............|................|................|x...............|................|................|................|x...............',
        gendang: 'k.k.....k.k.....|k.k.....u...t.k.|k.k.....k.k.....|d...........kttk|k.k.....k.k.....|k.k.....u...t.k.|ddttkkeeddttkkee|u.......d..k.tkk',
        kecrek: 'x.x.....x.x.....',
      },
    },
    // the verse: bare dangdut, the suling on top and the mandolin answering at the ends of its lines
    A: {
      bars: 16,
      harm: 'Am | Am | Dm | Am | Am | G | F | E7 | Am | Am | Dm | Am | F | G | Am | E7',
      lead: `/e5q a5e b5 c6q b5e a5 | =a5q g#5e a5 e5h | /f5q a5e c6 d6q c6e a5 | c6e b5 a5 g#5 a5h |
             e5e a5 c6 e6 /d6q. c6e | b5e a5 g5 b5 d6q g5 | a5e g5 f5 a5 c6q f5 | b5e g#5 e5 g#5 >e5h |
             /c6q b5e c6 /e6q d6e c6 | b5e a5 g#5 a5 e5h | d6q f6e e6 d6q c6e a5 | c6q. b5e a5h |
             a5e c6 f6 e6 /d6q c6 | b5e d6 g6 f6 e6q d6 | c6e b5 a5 b5 c6q e6 | e6e d6 b5 g#5 e5q g#5`,
      counter: `rw | rh rq %e6q | rw | rh %a5q %c6 | rw | rh %d6q %b5 | rw | %e5h %g#5q %b5 |
                rw | rh %a5q %e6 | rw | rh %c6q %e6 | rw | rh %b5q %d6 | rw | %g#5h %b5`,
      bass: '@|@|@|@|@|@|@|@|@|@|@|@|@|@|@|@',
      perc: { gong: GONG, gendang: DANGDUT, kecrek: '..x...x...x...x.' },
      fill: { gendang: 'u.k.t.k.ddttkkee', kecrek: '..x...x...x.xxxx' },
    },
    // the road opens for a moment: tehyan with the suling, the gambang and kromong in, the drum doubles
    B: {
      bars: 16,
      harm: 'C | G | Am | Em | F | C | Dm | E7 | C | G | Am | F | Dm | E7 | Am | E7',
      lead: `e6q. d6e c6q g5 | d6q. c6e b5q g5 | c6e b5 a5 c6 e6q a5 | g5e a5 b5 g5 e5h |
             f5e a5 c6 f6 /e6q d6 | e6e d6 c6 e6 g6q e6 | f6e e6 d6 f6 a6q f6 | e6h g#5q b5 |
             e6q. d6e c6q g5 | d6q. c6e b5q d6 | e6e d6 c6 e6 a6q e6 | f6e e6 c6 f6 a6q f6 |
             d6e c6 a5 c6 d6q f6 | e6e d6 b5 g#5 b5q e6 | c6e e6 a6 e6 c6q a5 | e5e g#5 b5 d6 e6h`,
      tehyan: slur(`/g5q. g5e e5q e5 | /b4q. a4e g4q b4 | a4e g#4 e4 a4 c5q e4 | e4e f4 g4 e4 b3h |
               c4e f4 a4 c5 /g4q f4 | c5e b4 a4 c5 e5q c5 | a4e g4 f4 a4 d5q a4 | /g#4h e4q g#4 |
               /g5q. g5e e5q e5 | /b4q. a4e g4q b4 | c5e b4 a4 c5 e5q c5 | c5e b4 a4 c5 f5q c5 |
               f4e e4 c4 e4 f4q a4 | g#4e f4 d4 e4 g#4q b4 | a4e c5 e5 c5 a4q e4 | /b3h g#4`),
      counter: 'rw | rw | rw | rh %e5q %b5 | rw | rw | rw | %e5h %b5 | rw | rw | rw | rh %c6q %f6 | rw | rw | rw | %b5h %e6',
      perc: { gong: GONG, gendang: KOPLO, kecrek: 'x.x.x.x.x.x.x.x.' },
      fill: { gendang: 'd.k.t.k.ddttkkee', kecrek: 'x.x.x.x.xxxxxxxx' },
      auto: { gambang: 'arp16', kromong: 'kromongOff' },
    },
  },
  auto: { bass: 'dangdutBass', comp: 'dangdutChop' },
  form: [
    { s: 'I', label: 'Horns', dyn: 1.02, auto: { bass: null, comp: null } },
    { s: 'A', label: 'A', dyn: 0.96 },
    { s: 'B', label: 'B', dyn: 0.94 },
    { s: 'A', label: "A'" },
    { s: 'I', label: 'Horns 2', dyn: 1.02, auto: { bass: null, comp: null } },
    { s: 'B', label: "B'", dyn: 0.96 },
    { s: 'A', label: 'A last', dyn: 1.02 },
  ],
};
