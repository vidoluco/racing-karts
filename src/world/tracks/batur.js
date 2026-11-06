// Dal Mare al Batur: the journey across Bali, from the black sand and the sea temple of Tanah Lot, up through the rice of Tabanan
// and the street of Ubud, over the Ayung gorge, onto the rim of the Batur caldera at Kintamani, down onto the black lava and round
// the lake, out by the far wall, through Penglipuran and the bamboo, and down to the sea again into the sunset. One lap, 9 km.
// It is the island folded onto 4 km: every leg runs where it really runs. The sea lies to the south west of the volcano, and the
// road climbs at the volcano: `a` runs at bearing 66 from the coast toward Batur, `b` to its right. World -z is `a`.
// horizon.center is the viewpoint of the photos, on the west rim above Kintamani. y = 0 is the level of the lake, 1031 m, and the
// sea shares that one water plane: the true figures are elevations from the lake's level, the climb itself is told in 80 m.
// Facts: docs/references/bali-long.md.

const NORTH = 66;
const xz = (a, b) => [b, -a];
const end = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// the island's roads are lanes through villages, not a highway: narrow on the straights, opened a little where they bend so that a line still pays. The figures below are from before they were cut
const LANE = (w, bank) => (w <= 13 ? 10 : bank >= 8 ? 14.8 : bank >= 5 ? 13.2 : 11.2);
const P = (a, b, y, w = 14, surface = 'asphalt', tag = null, bank = 0) => {
  const [x, z] = xz(a, b);
  return { p: [x, y, z], w: LANE(w, bank), bank, surface, tag };
};
// the coast: s metres seaward of the line of the first straight. The sea, then, is all of what lies past it
const seaward = (a, b) => -0.781 * (a + 2050) + 0.625 * (b - 420);
export const LAKE = { a: 640, b: 500, ra: 225, rb: 330 };
const GORGE = { b: -35, a0: -1050, a1: -130 };

// The double caldera, as the driver must feel it: a wall of forest closes the sea side, from the far end of the lava round behind the rim to the far wall.
// The other side is painted, in the one repaint that holds the rim, the cone, the lake and Abang (tools/panoramas/batur-recipe.py).
const CALDERA = { a: 620, b: 420, ra: 680, rb: 1000, h: 66 };
const calderaWall = (a, b) => {
  const u = (a - CALDERA.a) / CALDERA.ra, v = (b - CALDERA.b) / CALDERA.rb, q = Math.hypot(u, v) + 0.03 * Math.sin(a * 0.017 + b * 0.009) + 0.02 * Math.sin(b * 0.031 - a * 0.013);
  const west = end(-0.3, 0.3, -u / Math.max(q, 0.01)), profile = q < 1 ? end(0.6, 1, q) ** 1.2 : 1 - end(1, 1.28, q);
  // the saddle of Penelokan, the road's own notch
  const saddle = 1 - 0.8 * Math.exp(-(((b + 30) / 170) ** 2));
  return CALDERA.h * west * profile * saddle;
};
// Value noise for the rough ground of the flows.
const hash2 = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
const vn = (x, z) => { const i = Math.floor(x), j = Math.floor(z), f = x - i, g = z - j, u = f * f * (3 - 2 * f), v = g * g * (3 - 2 * g); return (hash2(i, j) * (1 - u) + hash2(i + 1, j) * u) * (1 - v) + (hash2(i, j + 1) * (1 - u) + hash2(i + 1, j + 1) * u) * v; };
// The black flows of 1963 and 1974: they come down from the cone in tongues, and 1 is bare lava. Shared with the landmarks, which paint and litter it.
export const lavaAt = (a, b) => {
  const q = ((a - 780) / 300) ** 2 + ((b + 300) / 360) ** 2 + 0.9 * (vn(b / 170 + 3, a / 120 - 7) - 0.5) + 0.25 * (vn(b / 41, a / 37 + 4) - 0.5);
  return 1 - end(0.82, 1.02, q);
};
// The coast road's own line, in a and b: the cliff follows it, so the sea comes close however the road bends.
const COAST = [[-1932, 700], [-1978, 610], [-2012, 516], [-2050, 420], [-2102, 345], [-2165, 268], [-2232, 188], [-2305, 112], [-2380, 40], [-2442, -40], [-2492, -130]];
const coastD = (a, b) => {
  let best = 1e9;
  for (let i = 0; i + 1 < COAST.length; i++) {
    const [a0, b0] = COAST[i], [a1, b1] = COAST[i + 1], da = a1 - a0, db = b1 - b0, t = Math.min(1, Math.max(0, ((a - a0) * da + (b - b0) * db) / (da * da + db * db))), e = (a - a0 - t * da) ** 2 + (b - b0 - t * db) ** 2;
    if (e < best) best = e;
  }
  return Math.sqrt(best);
};
// The far corners of the grid stand over the road for the sim's world, which keeps every kart in; the panorama closes the view, so the landmarks take them off the drawn ground (world.groundDrop).
export const cornerHills = (a, b) => {
  let v = 0;
  for (const [ca, cb] of [[1725, -1202], [1725, 1860], [-3305, -1202]]) v += 150 * end(420, 180, Math.hypot(a - ca, b - cb));
  return v;
};
// The lake's far bank is Gunung Abang's wall: past a shelf for Trunyan it stands straight up out of the water, tall, steep and dark, with shoulders along its crest, the far side of the caldera at the end of every look across the lake.
const abangMask = (a, b) => (1 - end(LAKE.a - 110, LAKE.a + 70, a)) * end(-80, 120, a) * end(170, 330, b) * (1 - end(790, 885, b));
const abangE = (a, b) => Math.sqrt(((a - LAKE.a) / LAKE.ra) ** 2 + ((b - LAKE.b) / LAKE.rb) ** 2) + 0.07 * (vn(a / 60 + 2, b / 44 + 5) - 0.5);
const farBank = (a, b) => {
  const m = abangMask(a, b);
  if (m <= 0) return 0;
  const e = abangE(a, b), crest = 66 + 26 * Math.exp(-(((b - 690) / 170) ** 2)) + 14 * (vn(b / 52 + 9, 3.7) - 0.5) + 6 * Math.sin(b * 0.043);
  const rise = end(1.11, 1.46, e) ** 0.72, back = 1 - 0.6 * end(1.7, 2.9, e);
  const flutes = (1 - Math.abs(2 * vn(b / 21 + 4, e * 2.2) - 1)) * 7 * end(1.18, 1.34, e) * (1 - end(1.5, 1.9, e));
  return m * (crest * rise * back + flutes);
};
// Where the wall stands: 1 on its face, for the paint of the landmarks.
export const abangAt = (a, b) => end(0, 0.22, abangMask(a, b)) * end(1.09, 1.13, abangE(a, b));
// Where the ground is stepped rice fields, as ellipses in a and b. Shared with the landmarks, which plant and paint them.
export const RICE = [[-1800, -420, 760, 520], [-1520, 960, 620, 560], [-2250, -300, 300, 420], [-1100, -640, 340, 360], [-1900, 420, 280, 340], [-860, 1280, 320, 300], [-300, -520, 300, 260], [-1300, 90, 300, 260], [-640, 560, 200, 200], [-1250, 1320, 300, 240]];
export const riceK = (a, b) => {
  let k = 0;
  for (const [ca, cb, ra, rb] of RICE) { const e = ((a - ca) / ra) ** 2 + ((b - cb) / rb) ** 2; if (e < 1.2) k = Math.max(k, 1 - end(0.82, 1.15, e)); }
  return k;
};
// The rice stands on real hillsides: the steps are cut along the contours of these, so that they curve round each spur as at Jatiluwih, and the slope is what keeps each one narrow.
// 0 by the road, 1 well off it: the hills lie down there, so that the road never runs in a pit or on a dyke. A coarse grid of the distance to the control line, filled the first time it is asked.
const FAR_G = { n: 0, g: null, s: 24, a0: -2800, b0: -800, w: 220, h: 110 };
const roadFar = (a, b) => {
  if (!FAR_G.g) {
    const { s, a0, b0, w, h } = FAR_G, g = FAR_G.g = new Float32Array(w * h).fill(90), pts = DEF.points.map((q) => [-q.p[2], q.p[0]]);
    for (let i = 0; i < pts.length; i++) {
      const [pa, pb] = pts[i], [qa, qb] = pts[(i + 1) % pts.length], L = Math.ceil(Math.hypot(qa - pa, qb - pb) / 12);
      for (let t = 0; t <= L; t++) {
        const ca = pa + (qa - pa) * t / L, cb = pb + (qb - pb) * t / L, ia = (ca - a0) / s, ib = (cb - b0) / s;
        for (let j = Math.max(0, Math.floor(ib - 4)); j <= Math.min(h - 1, Math.ceil(ib + 4)); j++) for (let k = Math.max(0, Math.floor(ia - 4)); k <= Math.min(w - 1, Math.ceil(ia + 4)); k++) { const d = Math.hypot(k - ia, j - ib) * s; if (d < g[j * w + k]) g[j * w + k] = d; }
      }
    }
  }
  const { s, a0, b0, w, h, g } = FAR_G, x = (a - a0) / s, y = (b - b0) / s, i = Math.floor(x), j = Math.floor(y);
  if (i < 0 || j < 0 || i >= w - 1 || j >= h - 1) return 1;
  const u = x - i, v = y - j, d = (g[j * w + i] * (1 - u) + g[j * w + i + 1] * u) * (1 - v) + (g[(j + 1) * w + i] * (1 - u) + g[(j + 1) * w + i + 1] * u) * v;
  return end(16, 72, d);
};
const riceHills = (a, b) => {
  const k = riceK(a, b);
  if (!k) return 0;
  return k * roadFar(a, b) * (11 * Math.sin(a * 0.0193 + 1.6 * Math.sin(b * 0.0117)) * Math.cos(b * 0.0171 + 1.1 * Math.sin(a * 0.0089)) + 4.5 * (vn(a / 46 + 11, b / 58 + 3) - 0.5));
};
const lakeK = (a, b) => Math.exp(-1 * (((a - LAKE.a) / LAKE.ra) ** 2 + ((b - LAKE.b) / LAKE.rb) ** 2) ** 1.6);
export const lakeInside = (a, b) => ((a - LAKE.a) / LAKE.ra) ** 2 + ((b - LAKE.b) / LAKE.rb) ** 2;

const DEF = {
  id: 'batur', region: 'indonesia', long: { statics: 800, detail: 325 },
  roadRange: [9.5, 15.5],
  // every 500 m as a long track has them, except off the two narrowest stretches, the bridge and the stone street, where five crates would not fit across
  itemBands: Array.from({ length: 20 }, (_, b) => ({ 6: 0.3046, 16: 0.8005 })[b] ?? (b + 0.5) / 20),
  names: { it: 'Dal Mare al Batur', en: 'Sea to Batur' },
  blurb: {
    it: "Nove chilometri attraverso Bali: da Tanah Lot sul mare, tra le risaie e per le vie di Ubud, oltre la gola dell'Ayung, fino alla caldera del Batur, e di nuovo giù al tramonto.",
    en: 'Nine kilometres across Bali: from Tanah Lot on the sea, through the rice and the streets of Ubud, over the Ayung gorge to the Batur caldera, and back down into the sunset.',
  },
  points: [
    // the coast road on its low cliff, the temple on its rock out in the surf to the left, the sun ahead
    P(-2050, 420, 9, 15),
    P(-2102, 345, 10, 15),
    P(-2165, 268, 11, 15),
    P(-2232, 188, 10, 15, 'asphalt', null, 3),
    P(-2305, 112, 9.5, 15),
    P(-2380, 40, 10, 15),
    P(-2442, -40, 11, 15, 'asphalt', null, 3),
    P(-2492, -130, 13, 14, 'asphalt', null, 5),
    // right, inland: Batur straight ahead for the first time
    P(-2505, -232, 15, 14, 'asphalt', null, 8),
    P(-2452, -330, 18, 14, 'asphalt', null, 8),
    P(-2372, -382, 21.5, 14, 'asphalt', null, 6),
    // the rice of Tabanan, long easy bends between the terraces
    P(-2285, -396, 25, 14),
    P(-2200, -360, 28, 14, 'asphalt', null, 5),
    P(-2118, -300, 30, 14, 'asphalt', null, 5),
    P(-2030, -280, 32, 14),
    P(-1942, -310, 35, 14, 'asphalt', null, 5),
    P(-1852, -370, 38, 14, 'asphalt', null, 6),
    P(-1762, -402, 40, 14, 'asphalt', null, 6),
    P(-1672, -372, 42, 14, 'asphalt', null, 6),
    P(-1600, -302, 44, 14, 'asphalt', null, 5),
    // the crest over the subak: everyone in the air, the volcano in front
    P(-1530, -262, 47, 15, 'asphalt', 'jump'),
    P(-1440, -268, 46.5, 14),
    P(-1350, -310, 49, 14, 'asphalt', null, 4),
    P(-1262, -340, 51, 14, 'asphalt', null, 3),
    // Ubud: one long street straight at Batur, gates and walls either side
    P(-1172, -346, 53, 15),
    P(-1080, -346, 54, 15),
    P(-990, -341, 55, 15),
    P(-900, -336, 56, 15),
    P(-810, -330, 56, 15),
    // the Monkey Forest, right under the banyans
    P(-730, -305, 56, 14, 'asphalt', null, 7),
    P(-672, -250, 55, 14, 'asphalt', null, 8),
    P(-628, -182, 54, 14, 'asphalt', null, 5),
    // the Ayung gorge, on the tall bridge
    P(-604, -122, 53.5, 13, 'asphalt', 'viaduct'),
    P(-594, -62, 53.5, 13, 'asphalt', 'viaduct'),
    P(-592, -2, 53.5, 13, 'asphalt', 'viaduct'),
    P(-602, 58, 53.5, 13, 'asphalt', 'viaduct'),
    // and up the far side, hairpins through the orange groves of Kintamani
    P(-590, 122, 54, 14, 'asphalt', null, 6),
    P(-542, 172, 56, 14, 'asphalt', null, 8),
    P(-470, 192, 59, 14, 'asphalt', null, 7),
    P(-392, 176, 62, 14, 'asphalt', null, 7),
    P(-322, 130, 65, 14, 'asphalt', null, 8),
    P(-284, 60, 68, 14, 'asphalt', null, 7),
    P(-258, 0, 70.5, 14, 'asphalt', null, 6),
    P(-208, -48, 72.5, 14, 'asphalt', null, 6),
    P(-140, -60, 74.5, 15, 'asphalt', null, 4),
    // the rim at Penelokan, "the place to look": the whole caldera opens at the end of the straight
    P(-70, -44, 76, 15),
    P(0, -24, 76, 15),
    P(72, -30, 75, 15),
    // down the wall
    P(142, -72, 71.5, 14, 'asphalt', null, 7),
    P(198, -140, 66.5, 14, 'asphalt', null, 8),
    P(258, -210, 60.5, 14, 'asphalt', null, 8),
    P(322, -248, 54.5, 14, 'asphalt', null, 9),
    P(382, -226, 49, 14, 'asphalt', 'hairpin', 10),
    P(394, -160, 43.5, 14, 'asphalt', null, 9),
    P(358, -96, 38.5, 14, 'asphalt', null, 7),
    P(330, -20, 33.5, 14, 'asphalt', null, 6),
    P(354, 54, 29, 14, 'asphalt', null, 8),
    P(414, 88, 25, 14, 'asphalt', 'hairpin', 10),
    P(476, 56, 21, 14, 'asphalt', null, 9),
    P(506, -20, 17.5, 14, 'asphalt', null, 7),
    // the lava of 1963 and 1974, black to the horizon, the road laid across it
    P(554, -96, 14, 15, 'asphalt', null, 4),
    P(620, -152, 11.5, 15, 'asphalt', null, 4),
    P(704, -176, 9.5, 15),
    P(792, -160, 8, 15, 'asphalt', null, 4),
    P(862, -100, 7, 15, 'asphalt', null, 5),
    // the lake shore, Toya Bungkah's hot springs, the fish cages
    P(905, -20, 6, 15, 'asphalt', null, 4),
    P(922, 80, 5, 15),
    P(925, 190, 5, 15),
    P(916, 300, 5, 15, 'asphalt', null, 3),
    P(895, 410, 5, 15, 'asphalt', null, 3),
    P(872, 520, 5, 15, 'asphalt', null, 3),
    P(845, 625, 5, 15, 'asphalt', null, 4),
    P(790, 740, 5, 15, 'asphalt', null, 5),
    P(700, 835, 5.5, 15, 'asphalt', null, 5),
    P(590, 895, 6.5, 15, 'asphalt', null, 4),
    P(480, 925, 8.5, 15, 'asphalt', null, 4),
    // and out by the far wall
    P(390, 930, 12.5, 14, 'asphalt', null, 4),
    P(304, 906, 19, 14, 'asphalt', null, 6),
    P(226, 930, 26, 14, 'asphalt', null, 7),
    P(164, 998, 32, 14, 'asphalt', null, 8),
    P(92, 1040, 38, 14, 'asphalt', null, 8),
    P(14, 1022, 44, 14, 'asphalt', null, 7),
    P(-54, 964, 50, 14, 'asphalt', null, 6),
    P(-130, 950, 56, 14, 'asphalt', null, 5),
    P(-210, 980, 61, 14, 'asphalt', null, 5),
    P(-292, 1010, 64, 14),
    // the long way down to the sea, the sun in your eyes
    P(-380, 1000, 64.5, 14, 'asphalt', null, 4),
    P(-470, 962, 62.5, 14, 'asphalt', null, 4),
    P(-560, 940, 60.5, 14),
    // Penglipuran: the village street, stone setts, a gate every few metres
    P(-650, 935, 58, 13, 'cobble'),
    P(-740, 935, 56, 13, 'cobble'),
    P(-830, 935, 54, 13, 'cobble'),
    P(-920, 940, 52, 13, 'cobble'),
    // the bamboo forest behind it
    P(-1000, 970, 50, 14, 'asphalt', null, 6),
    P(-1072, 1030, 48, 14, 'asphalt', null, 7),
    P(-1152, 1060, 46, 14, 'asphalt', null, 6),
    P(-1240, 1040, 43.5, 14, 'asphalt', null, 6),
    P(-1322, 990, 41, 14, 'asphalt', null, 5),
    // a last crest, then coconut palms and rice all the way to the shore
    P(-1402, 960, 39.5, 15, 'asphalt', 'jump'),
    P(-1490, 980, 35, 14),
    P(-1570, 1030, 32.5, 14, 'asphalt', null, 6),
    P(-1642, 1062, 30, 14, 'asphalt', null, 6),
    P(-1722, 1032, 27, 14, 'asphalt', null, 6),
    P(-1790, 962, 24, 14, 'asphalt', null, 5),
    P(-1842, 872, 21, 14, 'asphalt', null, 4),
    P(-1884, 782, 18, 14),
    P(-1932, 700, 15, 14),
    P(-1978, 610, 12.5, 15),
    P(-2012, 516, 10.5, 15),
  ],
  boostPads: [{ u: 0.03, offset: 0.3 }, { u: 0.138, offset: -0.3 }, { u: 0.25, offset: 0 }, { u: 0.405, offset: 0 }, { u: 0.542, offset: 0.3 }, { u: 0.645, offset: -0.2 }, { u: 0.79, offset: 0 }, { u: 0.905, offset: 0.3 }, { u: 0.975, offset: 0 }],
  jumps: [{ u: 0.201, strength: 1.2 }, { u: 0.893, strength: 1 }],
  zones: [],
  shortcuts: [
    // a dirt ramp straight down the inside of the first hairpins of the wall, narrow and rough, between the lava boulders
    { from: 0.443, to: 0.472, points: [[...xz(310, -150), 49.5]].map(([x, z, y]) => [x, y, z]), surface: 'dirt', w: 7 },
    // the subak track across the paddies where the last run swings wide
    { from: 0.902, to: 0.939, points: [[...xz(-1640, 972), 29.5]].map(([x, z, y]) => [x, y, z]), surface: 'dirt', w: 7 },
  ],
  hazards: [
    // Bali cattle on their way across the rice, the macaques of the Monkey Forest, the hot springs of Toya Bungkah under the road
    { kind: 'cows', u: 0.155, width: 1, period: 9, phase: 0 },
    { kind: 'macaques', u: 0.293, width: 1, period: 8, phase: 0.3 },
    { kind: 'steam', u: 0.578, width: 1, period: 7, phase: 0 },
    { kind: 'cows', u: 0.925, width: 1, period: 10, phase: 0.5 },
  ],
  disasters: [
    { kind: 'rockfall', u: 0.478, name: 'Longsor Penelokan', say: { it: 'Cadono massi dalla parete!', en: 'Rocks off the caldera wall!' }, side: 1, gully: { color: ['#4a4044', '#3c3438'], lump: '#2c282c' } },
    { kind: 'eruption', u: 0.535, name: 'Letusan Batur', say: { it: 'Il Batur erutta! Schiva le bombe!', en: 'Batur is erupting! Dodge the bombs!' }, side: 1 },
    { kind: 'lahar', u: 0.725, name: 'Lahar Batur', say: { it: 'Scende il fango dal vulcano!', en: 'Mud coming down the volcano!' }, side: -1, gully: { color: ['#4a4044', '#3c3438'], lump: '#2c282c' } },
  ],
  // Tanah Lot out in the surf; Pura Ulun Danu Batur on the rim, the lake's temple, the head of Penglipuran; the palace gate and the water garden of Ubud
  sacred: [{ x: 195, z: 2410, r: 92 }, { u: 0.405, d: 56, r: 56 }, { u: 0.606, d: 42, r: 24 }, { u: 0.802, d: 34, r: 24 }, { u: 0.254, d: 26, r: 18 }, { u: 0.262, d: -34, r: 24 }],
  ground: {
    // no rim round the road: the panorama is what closes the world. Only the far corners stand, the one over the sea does not
    base: 3, hills: 9, hillScale: 220, rimHeight: 0, rimFrom: 200, rimTo: 800, water: 0, displayRise: 0.5,
    // the made ground of the street of Ubud, of the rim and of Penglipuran: walls and gates on the level, no slope behind them
    flats: [{ from: 0.236, to: 0.288, w: 44 }, { from: 0.392, to: 0.423, w: 26 }, { from: 0.804, to: 0.84, w: 34 }],
    shape: (x, z) => {
      const a = -z, b = x, s = seaward(a, b);
      // and the land between the coast road and its cliff lies low, so that the sea is what you see
      const sea = -30 * end(30, 120, s) - 230 * end(120, 420, s) - 9 * end(-70, -15, s) * (1 - end(-1900, -1720, a));
      const lake = -56 * lakeK(a, b);
      const gz = Math.abs(b - GORGE.b - 26 * Math.sin(a * 0.011)), gorge = -74 * (1 - end(24, 118, gz)) * end(GORGE.a0, GORGE.a0 + 240, a) * (1 - end(GORGE.a1 - 240, GORGE.a1, a));
      // the shelf the rim's temple stands on, to the left of the road: the hill off it
      const shelf = -16 * Math.exp(-(((a + 10) / 170) ** 2 + ((b + 130) / 110) ** 2));
      // the flows lie low, so that the road crosses them on a causeway and sees over them
      const flow = -9 * Math.exp(-(((a - 780) / 260) ** 2 + ((b + 300) / 320) ** 2));
      return sea + lake + gorge + Math.max(calderaWall(a, b), farBank(a, b)) + shelf + flow + cornerHills(a, b) + riceHills(a, b);
    },
    // per node: the low black cliff of the coast, and the torn, ridged skin of the flows
    fine: (x, z) => {
      const a = -z, b = x;
      let v = 0;
      if (a < -1800 && seaward(a, b) > -90) {
        const d = coastD(a, b), sw = seaward(a, b), at = sw > -40 ? 1 : 0;
        if (at) v -= (19 + 5 * Math.sin(a * 0.05 + b * 0.03)) * end(9, 27, d) * end(-40, -8, sw);
      }
      // the reef Tanah Lot stands on, awash: the sea's foam comes from how shallow it is
      for (const [ra, rb, r0, r1, by] of [[-2410, 195, 150, 84, 38.4]]) {
        const dd = Math.hypot(a - ra, b - rb);
        if (dd < r0) v += by * end(r0, r1, dd + 8 * Math.sin(Math.atan2(a - ra, b - rb) * 5));
      }
      if (a > 380 && b < 120) {
        const L = lavaAt(a, b);
        if (L > 0.01) {
          // the flow's ropes run down from the cone, and there is a crag every few metres
          const r1 = 1 - Math.abs(2 * vn(b / 19, a / 42) - 1), r2 = 1 - Math.abs(2 * vn(b / 7 + 9, a / 11) - 1);
          v += L * (1.7 * r1 + 1.3 * r2 - 1.2 + 2.4 * (vn(b / 63 + 5, a / 88) - 0.5));
        }
      }
      return v;
    },
  },
  grid: { spacing: 4 },
  // the viewpoint, at the foot of the west rim above Kintamani, altitude that of the lake (see the head of this file): Batur 11 deg at 55, Abang 7 at 108, Agung 6 at 120
  horizon: { center: [-8.255, 115.351], northDeg: NORTH, exaggerate: 1, peak: 1, scale: 18, altitude: 1031, panelDistance: 7000 },
  // mist by hand after compose: the far ground fades into what stands at each foot, the black lava under Batur, the forest of the walls, the beige of the coast
  backdrops: [
    {"file": "batur-pano-000.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#7f8c5c", "bearing": 0, "elevation": 0, "row": 0.89525},
    {"file": "batur-pano-060.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#6e5664", "summit": {"name": "Gunung Batur", "lat": -8.2369, "lon": 115.3773, "altitude": 1717, "u": 0.42237, "row": 0.41044}, "elevation": 18, "compressed": "true 11 from the floor of the caldera; raised whole with its width, so it keeps its true low broad proportions"},
    {"file": "batur-pano-120.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#a8a0a8", "summit": {"name": "Gunung Agung", "lat": -8.3415, "lon": 115.5033, "altitude": 3031, "u": 0.49783, "row": 0.52323}, "elevation": 14, "compressed": "true 5.9: the great cone as a long lens brings it up over the rim, its whole outline as painted, and kept under Batur"},
    {"file": "batur-pano-180.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#7f8c5c", "bearing": 180, "elevation": 0, "row": 0.89525},
    {"file": "batur-pano-240.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#a89a84", "bearing": 240, "elevation": 0, "row": 0.89525},
    {"file": "batur-pano-300.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#7f8c5c", "bearing": 300, "elevation": 0, "row": 0.89525},
  ],
  look: {
    // the last hour of the day: the sun low in the true west south west, over the sea, on Batur's face when you climb at it and in your eyes when you come down
    sun: { azimuth: 250 - NORTH, elevation: 17, color: '#ffd7a2', intensity: 3.3, wrap: [-0.22, 0.72] },
    hemi: { sky: '#eed4d4', ground: '#a89c68', intensity: 2.05 },
    sky: {
      stops: [[-8, '#ffd8a8'], [0, '#ffd8a8'], [6, '#ffd0b0'], [12.3, '#fec5be'], [14.4, '#fdc0c3'], [16.4, '#f8bfc8'], [18.3, '#edbfce'], [20.2, '#e1c0d5'], [22.1, '#d0c0da'], [23.9, '#bfc0df'], [27.3, '#a6bde4'], [30.6, '#98bae6'], [35, '#92bce6'], [50, '#7fb0e4']],
      glow: '#ffbe7a', glowStrength: 0.5, glowWidth: 0.5,
      clouds: { amount: 0 },
    },
    fog: { color: '#f0d0b0', density: 0.00024, heightFalloff: 0.004, max: 0.5 },
    mist: { from: 800, to: 2700, amount: 0.42, ring: 0 },
    terrain: {
      meadowY: '#b6c05c', meadow: '#92b250', meadowF: '#73a04a', meadowD: '#5a8c46', forest: '#3a5c3a', forestMix: 0.95, wood: { from: 120, to: 420, amount: 0.9, dark: '#34503a', light: '#55784a', gold: '#9a9c50' }, facetTone: 0, facetTilt: 0, patch: { size: 60, tone: 0.05 }, grass: [0.03, 0.05], detail: { stone: 0.1, stones: 0.1, tufts: 0.2 }, verge: '#8c9458',
      rock: '#3c3238', rockB: '#30282f', rockStrata: { spacing: 1.6, tone: 0.03, wobble: 0.8 }, scree: [6, 0.1], coverNoise: [24, 0.3], rockSlope: [44, 58],
      bank: '#4c4248', bankD: '#3e353c', bankWet: '#2e2830', bed: '#3a7f88', bankHeight: 2.4,
      // many narrow steps along the contours of riceHills, dark mud at each bund, paddies grouped by the farmer's plot, the flooded ones mirroring the high sky
      terraces: { step: 0.44, wobble: 0.42, rows: 3, young: '#8cb24c', green: '#5f9a42', dark: '#3f7c3c', gold: '#9aa64a', water: '#5a9ab2', riser: '#2c2618', sky: '#9ccde4', yMix: 1, tilt: 1, group: 5 },
    },
    stone: { color: '#7c7468', dark: '#544c48', wall: '#6a6058' },
    deck: { span: 28, pier: 4 },
    // the sea and the lake catch the sky
    water: { deep: '#2c7f92', base: '#4f9faa', light: '#6fa8a6', far: '#f2c9a4', foam: '#fff4e4', flow: 0.5, facetTone: 0.05, capture: 0.72, ripple: 0.012, still: { x: LAKE.b, z: -LAKE.a, rx: 470, rz: 340, deep: '#4c7f9c', base: '#82a4bc' } },
    vent: { crust: '#2c2830', throat: '#141218', ring: '#3a3438', puff: '#e6e0da', puffB: '#f4eee8', size: 1.3 },
    shadeFine: { bias: 0.5 },
    horizon: { rock: '#7b6f6c', rockB: '#6a5f68', scree: '#8d8078', grass: '#7ca060', forest: '#3f7a58', gold: '#8ca050', haze: '#dcbcb4', hazeNear: 1500, hazeFar: 26000, hazeMax: 0.8, shade: '#8a7f9c', strataTone: 0.04, ink: 0.1 },
    trees: {
      kinds: [
        { name: 'palm', shape: 'palm', share: 0.08, maxRoad: 70, height: [14, 24], width: 1, colors: ['#5c9a46', '#70a84a', '#90b04c', '#508a42'] },
        { name: 'canopy', shape: 'round', share: 0.6, height: [10, 22], width: 1.05, colors: ['#3c7444', '#4c8448', '#669448', '#346a42'] },
        { name: 'tall', shape: 'round', share: 0.1, height: [17, 28], width: 1, colors: ['#346242', '#3e6e44', '#507e46'] },
        { name: 'banana', shape: 'shrub', share: 0, height: [3, 6], width: 1.1, colors: ['#3a6a3c', '#467a40', '#305e38'] },
      ],
      density: 0.38, roundLods: [null, null, { lumps: 3, segs: 8, rings: 3 }], spacing: 12, cover: 0.04, far: 900, maxSlope: 50, drift: 30, nearScale: 0.8, roadGap: 7, mottle: 0.6,
    },
    rocks: { color: '#4a4442', count: 26, scale: 0.7 },
    // a lane: no edge lines, no painted kerb, a clean centre dash; a cool grey tar, because the low sun warms it, and it must stand pale on the black lava
    road: { asphalt: '#767a8a', dirt: '#a07c5a', cobble: '#8e8c80', sett: 0.92, wood: '#b48c58', line: '#f6ecd2', kerb: ['#767a8a', '#767a8a'], noKerbOn: 'asphalt', sideLine: 0, centreLine: 0.085, shoulder: '#a89a6c', kerbW: 0.3, verge: '#8c9458', repair: 0.35, wear: 0.4, lineWear: 0.5, gravel: 0.15, wobble: 1.8 },
    // no sparkle of the water may bloom into a disc over the sea: only what really burns, the eruption, glows here
    bloom: { threshold: 4, strength: 0.2 },
    kartShadow: [0.05, 0.03, 0.08, 0.78],
    staticRim: [0.04, 3.2],
  },
  music: 'indonesia',
  landmarks: 'batur',
};

export default DEF;
