// Terrazze di Bali: the rice terraces of the Muncan road on the south flank of Gunung Agung, at midday. The road is drawn in
// valley coordinates, because the volcano is what it looks at: `a` runs straight at the summit of Agung, `b` to its right.
// World -z is `a`, so `horizon.northDeg` is the true bearing of Agung from here, and every +a leg has the mountain dead ahead.
//
// The lap, in the order it is driven:
//   The village street under the penjor, straight at Agung, up to the crest where the road throws you at the volcano.
//   Down the long right into the valley, a dirt subak track above the river, the bamboo bridge, then back up the far bank
//   through the terraces with the mountain ahead again. A right hairpin at the top, or the plank across the paddies.
//   The long run south with the plain and the sea in front, the lake, the road along its shore past the temple on its
//   islets, and up through the banyans and the macaques into the village.
// Facts: docs/references/bali.md. Licence: the real Pura Ulun Danu Beratan is 30 km west of here, at its true bearing.

const NORTH = 37.6;
const xz = (a, b) => [b, -a];
const end = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const P = (a, b, y, w, surface = 'asphalt', tag = null, bank = 0) => {
  const [x, z] = xz(a, b);
  return { p: [x, y, z], w, bank, surface, tag };
};
const LAKE = { a: -92, b: 70, ra: 70, rb: 124 };

// The fall of the land across the road, [point index from which it holds, left, right] in m per m: the road is cut into a hillside, as real roads here are, so the terraces climb from one kerb and drop from the other.
const SIDES = [[0, 0.1, -0.1], [3, 0.2, -0.26], [10, -0.2, 0.16], [14, 0, 0], [17, -0.2, 0.2], [22, -0.14, 0.14], [25, 0.3, -0.24], [32, 0.24, 0], [38, 0.2, 0.1], [41, 0.08, -0.08]];

// The fall of every stretch of road at this point, weighted toward the nearest: one nearest segment alone made a cliff wherever it changed, and a cliff under the stepped fields is a tower of plates. It dies away with distance, so that two legs of the road meet in a soft valley.
let nearD = 0, roadY = 0, roadWide = 0;
// The ravines: cuts down the fall line of the volcano, full of coconut, bamboo and forest, 230 m apart and wandering, as the south flank is from the air. 1 on the axis of one, 0 between them.
const ravine = (a, b) => { const r = (b + 46 * Math.sin(a / 170) + 16 * Math.sin(a / 59 + 1.3) + 0.12 * a + 40) / 230, f = r - Math.floor(r) - 0.5; return Math.exp(-1 * ((f * 230 / 42) ** 2)); };
function sideFall(x, z) {
  const P = DEF.points, n = P.length;
  let sum = 0, tot = 0, ry = 0, wsum = 0, wtot = 0;
  nearD = 1e9;
  for (let j = 0; j < n; j++) {
    const A = P[j].p, B = P[(j + 1) % n].p, ex = B[0] - A[0], ez = B[2] - A[2], l2 = ex * ex + ez * ez, t = Math.max(0, Math.min(1, ((x - A[0]) * ex + (z - A[2]) * ez) / l2));
    const dx = x - A[0] - ex * t, dz = z - A[2] - ez * t, e = dx * dx + dz * dz, side = ez * dx - ex * dz, d = Math.sqrt(e), k = 1 / (e + 90) ** 2;
    let row = SIDES[0];
    for (const q of SIDES) if (q[0] <= j) row = q;
    if (d < nearD) nearD = d;
    // gentle by the road, so a plot is many times deeper than its riser and no cut stands over the kart; the amphitheatre steepens out in the fields
    sum += k * (side > 0 ? row[1] : row[2]) * (0.28 * Math.min(d, 50) + 0.7 * Math.max(0, Math.min(d, 130) - 50)) * (1 - 0.5 * end(130, 260, d));
    tot += k;
    ry += k * (A[1] + (B[1] - A[1]) * t);
    const kw = 1 / (e + 900) ** 2;
    wsum += kw * (A[1] + (B[1] - A[1]) * t); wtot += kw;
  }
  roadY = ry / tot; roadWide = wsum / wtot;
  return sum / tot;
}

const DEF = {
  id: 'bali', region: 'indonesia',
  names: { it: 'Terrazze di Bali', en: 'Bali Terraces' },
  blurb: {
    it: 'Tra le risaie a gradoni sotto il Gunung Agung: il salto verso il vulcano, il ponte di bambù, la tavola sui campi allagati e il lago del tempio.',
    en: 'Through the stepped rice fields under Gunung Agung: the leap at the volcano, the bamboo bridge, the plank over the flooded paddies and the temple lake.',
  },
  // old tarmac one and a half lanes wide, wider only where a corner needs it: a road of these villages, not a circuit
  roadRange: [9.5, 15.5],
  boxesAcross: 4,
  points: [
    // the village street, wide and level, Agung at the end of it
    P(0, 0, 0, 9.8),
    P(62, 0, 1, 9.8),
    P(128, 3, 2.6, 9.8),
    // a gentle left, climbing to the crest
    P(190, -8, 4.2, 9.8, 'asphalt', null, 4),
    P(244, -22, 6.2, 9.8, 'asphalt', null, 4),
    // the crest: nothing but the volcano in the air
    P(292, -26, 7.4, 9.8, 'asphalt', 'jump'),
    P(338, -22, 1.8, 9.8),
    // the long right down into the valley
    P(372, -2, -3, 11.2, 'asphalt', null, 6),
    P(388, 32, -7, 12.2, 'asphalt', null, 9),
    P(382, 68, -11, 14, 'asphalt', 'hairpin', 9),
    P(354, 94, -14.5, 12.2, 'dirt', null, 8),
    // the subak track along the river
    P(312, 104, -17, 9.8, 'dirt', null, 4),
    P(266, 100, -19, 9.8, 'dirt', null, 4),
    P(226, 112, -20.5, 12.2, 'dirt', null, 8),
    // the bamboo bridge
    P(206, 140, -20.5, 9.6, 'wood', 'bridge'),
    P(204, 166, -20.5, 9.6, 'wood', 'bridge'),
    P(208, 192, -20.5, 9.6, 'wood', 'bridge'),
    // back up the far bank through the terraces, Agung ahead again
    P(228, 222, -19.5, 12.2, 'asphalt', null, 8),
    P(268, 234, -17, 9.8, 'asphalt', null, 4),
    P(316, 226, -13.5, 9.8, 'asphalt', null, 4),
    P(362, 232, -9.5, 9.8, 'asphalt', null, 4),
    P(402, 250, -6, 11.2, 'asphalt', null, 7),
    // the top hairpin; the plank over the paddies cuts inside it
    P(424, 282, -3.6, 12.2, 'asphalt', null, 9),
    P(418, 318, -2, 14, 'asphalt', 'hairpin', 9),
    P(388, 340, -0.8, 12.2, 'asphalt', null, 8),
    // the long run south: plain and sea ahead, the terraces falling away
    P(340, 344, 0.2, 9.8),
    P(282, 332, 0.6, 9.8, 'asphalt', null, 4),
    P(222, 332, -1.5, 9.8, 'asphalt', null, 4),
    P(160, 346, -6, 9.8, 'asphalt', null, 5),
    P(100, 346, -12, 9.8, 'asphalt', null, 5),
    P(44, 330, -17.5, 9.8, 'asphalt', null, 5),
    P(-6, 300, -22, 11.2, 'asphalt', null, 6),
    // right, down onto the lake shore
    P(-52, 256, -25.4, 11.2, 'asphalt', null, 7),
    P(-96, 214, -26.8, 11.2, 'asphalt', null, 6),
    P(-144, 170, -27, 9.6, 'cobble', null, 4),
    // the shore: the temple on its islets across the water, the far range behind it
    P(-172, 110, -27, 9.6, 'cobble', null, 3),
    P(-178, 44, -27, 9.6, 'cobble'),
    P(-170, -22, -26.2, 9.6, 'cobble', null, 3),
    // the banyans, and up into the village
    P(-146, -72, -22, 11.2, 'asphalt', null, 7),
    P(-108, -88, -17.2, 11.2, 'asphalt', null, 7),
    P(-74, -64, -12.5, 11.2, 'asphalt', null, 7),
    P(-52, -26, -7.8, 11.2, 'asphalt', null, 6),
    P(-30, -3, -3.5, 9.6, 'cobble', null, 4),
  ],
  itemBands: [0.075, 0.3, 0.55, 0.8],
  boostPads: [{ u: 0.12, offset: 0 }, { u: 0.74, offset: -0.3 }],
  jumps: [{ u: 0.137, strength: 1.25 }],
  zones: [],
  shortcuts: [
    // the plank over the flooded paddies, 6 m wide with water each side
    { from: 0.425, to: 0.525, points: [[...xz(372, 268), -6.6], [...xz(368, 300), -3.2]].map(([x, z, y]) => [x, y, z]), surface: 'wood', w: 6 },
  ],
  hazards: [{ kind: 'macaques', u: 0.93, width: 1, period: 8, phase: 0 }],
  // The temples on the lake's islets: nothing is ever thrown at them. They stand at a -122, b 28 and a -110, b -14.
  sacred: [{ x: 28, z: 122, r: 34 }, { x: -14, z: 110, r: 28 }],
  // The real thing: Agung's lahars ran down these south flank valleys in 1963, and the valleys still carry them. Two places where it can come: on the climb with the volcano dead ahead, from its side, and on the run south, down the terraces on the left.
  disasters: [
    { kind: 'lahar', u: 0.39, name: 'Lahar del Gunung Agung', say: { it: 'Un fiume di fango dal vulcano!', en: 'A river of mud off the volcano!' }, side: -1, source: 70, gully: { color: ['#6f6b64', '#57544e'], lump: '#74706a', rocks: 70, wobble: 3.2, rows: 44, cols: 10 } },
    { kind: 'lahar', u: 0.625, name: 'Lahar del Gunung Agung', say: { it: 'Un fiume di fango dal vulcano!', en: 'A river of mud off the volcano!' }, side: 1, gully: { color: ['#6f6b64', '#57544e'], lump: '#74706a', rocks: 70, wobble: 3.2, rows: 44, cols: 10 } },
  ],
  ground: {
    // no rim round the road: only the far corners of the world close it. Agung's slope stands to the north east, the plain falls away to the sea in the south: a real rim would stand across them. The display keeps all of it low, so the painted skyline is what you see
    base: 0, hills: 9, hillScale: 210, rimHeight: 70, rimFrom: 120, rimTo: 800, water: -30, displayRise: 0.03,
    shape: (x, z) => {
      const a = -z, b = x;
      const lk = Math.exp(-1 * (((a - LAKE.a) / LAKE.ra) ** 2 + ((b - LAKE.b) / LAKE.rb) ** 2) ** 1.6);
      // the rim cancelled on the four axes, by a little less than it rises, so no second lake opens
      const da = Math.max(0, a - 425, -180 - a), db = Math.max(0, b - 345, -90 - b), corner = end(160, 420, Math.min(da, db)), rim = 0.72 * 70 * end(120, 800, Math.max(da, db));
      // the hills the terraces climb: east of the long run south and west of the street, as high as the valley is deep; none between the road and Agung or the lake's far shore
      const east = 62 * end(372, 600, b) * end(-260, -60, a) * (1 - end(620, 900, a)), west = 44 * end(-44, -230, b) * end(-30, 130, a) * (1 - end(560, 800, a));
      // the low ground between the river and the far bank is fields, not a second pond
      const fields = 9 * Math.exp(-1 * (((a - 31) / 76) ** 2 + ((b - 226) / 46) ** 2));
      const fall = sideFall(x, z);
      // a long wooded ridge across the south, past the lake: what the eye stops at when the road runs at the plain, and what the panorama's ridges stand behind
      const ridge = 30 * end(-250, -600, a);
      // the macro ground is the mean of the road's heights over hundreds of metres, so a street on high ground stood on a fill 25 m tall and a low road ran in a cutting: here it follows the road next to it, and lets go in the fields
      const follow = (roadY - roadWide) * (1 - end(34, 130, nearD));
      const S = fields - 58 * lk - rim * (1 - corner) - 6 * end(450, 1000, a) * (1 - corner) + east + west + ridge + fall + follow;
      // the cut of a ravine, as deep as the ground allows: no pond ever opens in one (water is -30)
      return S - Math.min(16 * ravine(a, b) * end(70, 170, nearD), Math.max(0, roadWide + S + 19));
    },
    ravine: (x, z) => ravine(-z, x),
    river: { w: 16, depth: 2.5, points: [[1400, 150], [1100, 130], [760, 165], [480, 150], [330, 165], [210, 165], [120, 150], [40, 130], [-30, 110], [-70, 96]].map(([a, b]) => xz(a, b)) },
  },
  grid: { spacing: 4 },
  // the shoulder ends at the village walls and the first bund: the fields are stepped real geometry the sim does not know about (render/landmarks/bali.js)
  wall: { max: 3.4 },
  // altitude: Copernicus GLO-30 at the center. Above Muncan, on the Rendang road: Agung 13.9 deg at 37.6, 9.6 km, and over the rim to the north Abang and the top of Batur still show; Tegallalang has Agung at only 5.4
  horizon: { center: [-8.41, 115.45], northDeg: NORTH, exaggerate: 1, peak: 1, scale: 18, altitude: 651 },
  // One painted panorama, closed all round, cut into tiles: tools/compose-panorama.py with tools/panoramas/bali.json writes the files and these lines.
  backdrops: [
    {"file": "bali-pano-000.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#7f9a84", "bearing": 0, "elevation": 0, "row": 0.92},
    {"file": "bali-pano-060.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#7f9a84", "summit": {"name": "Gunung Agung", "lat": -8.3415, "lon": 115.5033, "altitude": 3031, "u": 0.1386, "row": 0.39203}, "elevation": 19, "compressed": "true 13.9 deg, the whole cone scaled by 1.37 at its true proportions: the shape from Muncan, but it has to loom over every terrace in a chase frame"},
    {"file": "bali-pano-120.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#7f9a84", "bearing": 120, "elevation": 0, "row": 0.92},
    {"file": "bali-pano-180.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#7f9a84", "bearing": 180, "elevation": 0, "row": 0.92},
    {"file": "bali-pano-240.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#7f9a84", "bearing": 240, "elevation": 0, "row": 0.92},
    {"file": "bali-pano-300.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#7f9a84", "bearing": 300, "elevation": 0, "row": 0.92},
  ],
  look: {
    // the repaint's hour, read off it: late warm light from the true north west on Agung's rose flank (bearing 290), a clean blue going to cream on the horizon
    sun: { azimuth: 290 - NORTH, elevation: 38, color: '#ffdfae', intensity: 3.6, wrap: [-0.16, 0.66] },
    hemi: { sky: '#d4e8ec', ground: '#a8a860', intensity: 1.7 },
    sky: {
      stops: [[-8, '#d8e8de'], [0, '#d8e8de'], [3.8, '#d4e8e0'], [6.2, '#cae7e4'], [8.6, '#bde4e8'], [11.1, '#aee0ec'], [13.5, '#a0dcee'], [16, '#90d7ef'], [18.4, '#81d2f1'], [23.3, '#6dcbf2'], [28.2, '#66c8f2'], [38, '#4fb6ec'], [52, '#3aa2e4']],
      glow: '#fff5d8', glowStrength: 0.34, glowWidth: 0.4,
      clouds: { amount: 0 },
    },
    fog: { color: '#c6d6cc', density: 0.00018, heightFalloff: 0.004, max: 0.28 },
    mist: { from: 480, to: 1500, amount: 0.22, ring: 0 },
    outline: { fade: [90, 380] },
    terrain: {
      meadowY: '#73953a', meadow: '#538030', meadowF: '#46762d', meadowD: '#33682a', forest: '#1c5a24', forestMix: 0.9, facetTone: 0.03, facetTilt: 0.05, patch: { size: 11, tone: 0.16 }, grass: [0.03, 0.2], verge: '#6a8038',
      // the ground up close: clumps of grass with a shaded foot, in world size, so it never stretches into streaks
      detail: { stone: 0.08, stones: 0.12, tufts: 0.3 },
      wood: { from: 170, to: 420, amount: 0.92, dark: '#174f22', light: '#2f7f30', gold: '#5f9e36' },
      rock: '#6f6d68', rockB: '#55544f', rockStrata: { spacing: 2.2, tone: 0.2, wobble: 0.8 }, coverNoise: [7, 0.8], rockSlope: [58, 72],
      bank: '#8f9a68', bankD: '#7c8a5e', bankWet: '#4f5a48', bed: '#2f6c70', bankHeight: 1.6,
      // past the plates (landmarks/bali.js) the same fields, seen from far, on the true contours
      terraces: { step: 1.5, wobble: 3, rows: 4, young: '#6ea440', green: '#4f9038', dark: '#357830', gold: '#a6a84a', water: '#9cc4c2', riser: '#33512a' },
    },
    stone: { color: '#7c7a74', dark: '#55544f', wall: '#6a675f' },
    deck: { span: 15 },
    // Beratan is dark, still and high: it takes the sky at a low angle and the temple stands on its own reflection. The foam of a river has no place on it
    water: {
      deep: '#123c48', base: '#1a4c58', light: '#2a6066', far: '#6f9aa4', foam: '#cfe4e4', foamAmount: 0.0, flow: 0.25, facetTone: 0.015,
      sky: { amount: 0.78, high: '#3f8caa', low: '#eef0dc' }, mirrorColor: '#0e1a20', mirrorTones: { roof: '#1a1c22', hem: '#6a5a4c', foot: '#6f4436' },
      mirror: [{ x: 28, z: 122, h: 28, r: 8.6, tiers: 11, foot: 0.26 }, { x: -14, z: 110, h: 14, r: 5.4, tiers: 3, foot: 0.4 }],
    },
    horizon: { rock: '#8f7078', rockB: '#6f5768', scree: '#a0807c', grass: '#7cb060', forest: '#3f8a50', gold: '#7cb060', haze: '#dcede4', hazeNear: 1500, hazeFar: 26000, hazeMax: 0.8, shade: '#6f8fb0', strataTone: 0.04, ink: 0.1 },
    trees: {
      kinds: [
        { name: 'palm', shape: 'palm', share: 0.12, height: [12, 21], width: 1, colors: ['#4c9a38', '#5ea83c', '#7cba44', '#428c36'] },
        { name: 'canopy', shape: 'round', share: 0.74, height: [9, 20], width: 0.95, colors: ['#226a2c', '#2b7830', '#3a8e34', '#1d5e2a', '#1d622c', '#246e2e'] },
                { name: 'banana', shape: 'shrub', share: 0.14, height: [3, 6], width: 1.1, colors: ['#6cb83e', '#80c644', '#5aa63c'] },
      ],
      density: 0.19, spacing: 12, cover: -0.42, far: 260, mottle: 0.14, maxSlope: 50, drift: 30, nearScale: 0.72, roadGap: 13, roundLods: [{ lumps: 4, segs: 8, rings: 4 }, { lumps: 3, segs: 6, rings: 3 }, { lumps: 2, segs: 5, rings: 2 }, { lumps: 1, segs: 5, rings: 2 }],
    },
    rocks: { color: '#5e5c58', count: 24 },
    softPuff: true,
    kartShadow: [0.02, 0.015, 0.01, 0.86],
    flowTone: 0.42,
    // a road of the Rendang side: one and a half lanes of old tarmac, no paint to speak of, a stone gutter where racing kerbs would be
    road: { jumpMarks: false, asphalt: '#7a6f66', dirt: '#a87c50', cobble: '#7c7468', wood: '#b48c58', line: '#7a6f66', kerb: ['#8a8068', '#7c7460'], kerbW: 0.34, repair: 0.25, wear: 0.3, grit: 0, crown: 0, crownColor: '#7f9a4c', wobble: 1, pebble: 0.25, shoulder: '#6a7240', verge: '#527c32', joint: '#4f4c44' },
  },
  music: 'indonesia',
  landmarks: 'bali',
};

export default DEF;
