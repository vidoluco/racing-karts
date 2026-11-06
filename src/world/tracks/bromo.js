// Mare di Sabbia: the Tengger caldera at dawn, East Java. Facts and bearings in docs/references/bromo.md.
// The place is the north of the sand sea, under the wall, looking south: from here Bromo, Semeru and Batok stand together, as in every picture of them.
// horizon.northDeg -80 turns the road on it, so -x is true bearing 190 and the long legs run straight at the three cones; +x is the north wall, +z the east wall.
//
// The lap, in the order it is driven:
//   The jeep park under the wall, then the long packed track with the whole postcard ahead: Bromo smoking, Semeru over it, Batok.
//   Past Pura Luhur Poten, well clear of its wall, up the ash shoulder of Bromo beside its stair, off the crest, down over the gullies, across the
//   fumaroles and the soft sand, back through the tan grass of the savanna into the sunrise, and along the foot of the wall to the jeeps.

const S = 0.7;
// A jeep track over the sand, not a motorway: the widths below are the old ones, cut to 0.79
const P = (x, z, y, w, surface = 'dirt', tag = null, bank = 0) => ({ p: [x * S, y, z * S], w: w * 0.79, bank, surface, tag });
const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
const end = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const D2R = Math.PI / 180;

// One smooth value noise along a line, for what must not repeat: seed picks the line.
const vn1 = (x, seed) => {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f), h = (k) => { const q = Math.sin((k + seed * 17.3) * 127.1) * 43758.5453; return q - Math.floor(q); };
  return h(i) * (1 - u) + h(i + 1) * u;
};
const ridged = (x, seed) => 1 - Math.abs(2 * vn1(x, seed) - 1);

// Bromo: one broad, low, truncated ash cone, its skirt flaring out to the sand, its top a wide torn crater. The road goes round its flank; the stair runs up its east face straight to the lip. Nothing else on the circle is Bromo.
export const SHOULDER = { x: -564, z: 175, r: 190, h: 54, rim: 80 };
export const STAIR = { x0: -420, x1: -485, z: 176 };
// Where the lip stands, and how high, by the angle round the crater (atan2 of dz, dx: 0 is the stair's side). It is torn: lower toward the sand sea, with a breach you can see into from the long straight, and higher on the far side, so the dark inside of the far wall shows over the near lip.
export const rimR = (a) => SHOULDER.rim + 5 * Math.sin(2 * a + 1) + 3 * Math.sin(5 * a + 0.3);
const notch = (a, c, w) => { const q = Math.abs(((a - c + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI) / w; return q >= 1 ? 0 : 1 - q * q * (3 - 2 * q); };
export const rimY = (a) => SHOULDER.h - 6 * Math.cos(a) + 1.2 * Math.sin(3 * a + 1) + 1.1 * Math.sin(5 * a + 2.1) + 0.9 * Math.sin(8 * a + 0.7) + 0.7 * Math.sin(13 * a + 4) - 9 * notch(a, -0.42, 0.17) - 5 * notch(a, 0.74, 0.1) - 4 * notch(a, 2.5, 0.2);
export const bromoCone = (x, z) => {
  const dx = x - SHOULDER.x, dz = z - SHOULDER.z, r = Math.hypot(dx, dz);
  if (r >= SHOULDER.r) return 0;
  const a = Math.atan2(dz, dx), R = rimR(a), Y = rimY(a);
  if (r < R) { const q = (R - r) / R; return Y - 36 * Math.pow(q, 0.62); }
  return Y * Math.pow(clamp01((SHOULDER.r - r) / (SHOULDER.r - R)), 1.7);
};
const shoulder = (x, z) => {
  const dx = x - SHOULDER.x, dz = z - SHOULDER.z, r = Math.hypot(dx, dz);
  if (r >= SHOULDER.r) return 0;
  const a = Math.atan2(dz, dx), t = clamp01((SHOULDER.r - r) / (SHOULDER.r - SHOULDER.rim));
  const flute = Math.sin(a * 23 + 1.2) * 0.46 + Math.sin(a * 41 + 0.4) * 0.34 + Math.sin(a * 67 + 2.3) * 0.2;
  // the stair's gully
  const g = x > STAIR.x1 - 12 && x < STAIR.x0 + 20 ? (1 - end(3, 15, Math.abs(z - STAIR.z))) * 2.4 * end(STAIR.x0 + 20, STAIR.x0 - 20, x) * end(0, 8, x - STAIR.x1) : 0;
  return bromoCone(x, z) + 2.2 * flute * end(0, 0.3, t) * end(1, 0.7, t) - g;
};

// The caldera wall on the north and east: dark, thick with scrub, nothing level about it. Its plan is scalloped into amphitheatres with spurs between them, its crest rises and falls by tens of metres, and its gullies are of every width and spacing.
export const WALL = { x: -300, z: 130, rx: 650, rz: 560, from: 28, to: 218, fade: 26 };
export const wallRho = (x, z) => {
  const ex = (x - WALL.x) / WALL.rx, ez = (z - WALL.z) / WALL.rz, th = Math.atan2(ex, -ez);
  return Math.hypot(ex, ez) + 0.11 * (vn1(th * 2.6 + 7, 1) - 0.5) + 0.05 * ridged(th * 8.5 + 3, 2) ** 2 + 0.018 * vn1(th * 31, 3);
};
const wall = (x, z) => {
  const ex = (x - WALL.x) / WALL.rx, ez = (z - WALL.z) / WALL.rz, th = Math.atan2(ex, -ez), deg = (th / D2R + 360) % 360;
  const sector = end(WALL.from, WALL.from + WALL.fade, deg) * end(WALL.to, WALL.to - WALL.fade, deg);
  if (sector <= 0) return 0;
  const rho = wallRho(x, z);
  if (rho < 0.68) return 0;
  const H = 80 + 56 * vn1(th * 2.2 + 11, 4) + 22 * vn1(th * 7.3, 5) + 15 * ridged(th * 19, 6) ** 2, cliff = end(0.87, 0.995, rho), skirt = end(0.7, 0.9, rho) * 0.1;
  // gullies: a warped ridged noise, some of it deep, some of it hardly there
  const w = th + 0.05 * Math.sin(th * 6.1 + 1) + 0.025 * Math.sin(th * 17 + 2), band = end(0.84, 0.93, rho) * end(1.05, 0.98, rho);
  const flutes = (ridged(w * 23, 7) - 0.5) * (5 + 15 * vn1(th * 9, 8) ** 2) + (ridged(w * 61, 9) - 0.5) * (2 + 5 * vn1(th * 15, 10));
  return sector * (H * (skirt + cliff * 0.9) * (1 + 0.12 * end(1, 1.45, rho)) + flutes * band);
};

// The sea of sand is never a sheet: long low crests, sharp on top, running across the wind and dying away in places. Under 2 m: from the road they break the plain and give it scale.
const dunes = (x, z) => {
  const a = x * 0.82 + z * 0.57, b = -x * 0.57 + z * 0.82;
  const c = 1 - Math.abs(Math.sin((a / 46 + 0.9 * Math.sin(b / 70) + 0.5 * Math.sin(b / 23 + a / 90)) * Math.PI));
  const m = 1.5 * end(0.1, 0.75, 0.5 + 0.5 * Math.sin(x / 170 + 1.1) * Math.cos(z / 130 + 0.4)) * c * c;
  if (m < 0.01) return 0;
  // they die away before the track: its own banks are what edge it
  let d2 = 1e12;
  const pts = DEF.points;
  for (let i = 0, n = pts.length; i < n; i++) {
    const a0 = pts[i].p, a1 = pts[(i + 1) % n].p, ex = a1[0] - a0[0], ez = a1[2] - a0[2], t = clamp01(((x - a0[0]) * ex + (z - a0[2]) * ez) / (ex * ex + ez * ez)), qx = a0[0] + ex * t - x, qz = a0[2] + ez * t - z;
    d2 = Math.min(d2, qx * qx + qz * qz);
  }
  return m * end(16, 42, Math.sqrt(d2));
};

const DEF = {
  id: 'bromo', region: 'indonesia',
  roadRange: [10.5, 13.8],
  names: { it: 'Mare di Sabbia', en: 'Sea of Sand' },
  blurb: {
    it: "All'alba nella caldera del Tengger: il mare di sabbia si accende di rosa e d'oro, il Bromo fuma, il Batok scanalato e il Semeru lontano. Su per la spalla di cenere e giù nel mare di sabbia.",
    en: 'Dawn in the Tengger caldera: the sand sea glowing rose and gold, Bromo smoking, fluted Batok and Semeru far off. Up the ash shoulder and back down into the sea of sand.',
  },
  points: [
    // the jeep park: the start, wide and packed
    P(-150, -20, 0, 17),
    // the track west, the whole postcard ahead
    P(-240, 10, 0.2, 16),
    P(-330, 45, 0.5, 15, 'dirt', null, 3),
    // left off the line round the first drift of ash, then a long right on soft sand toward the temple's wall
    P(-378, 95, 0.9, 15, 'dirt', null, 7),
    P(-395, 165, 1.2, 15, 'sand', null, 6),
    P(-400, 235, 1.4, 15, 'sand', null, 6),
    P(-420, 285, 1.6, 15, 'sand', null, 9),
    P(-465, 306, 1.9, 15, 'sand', null, 10),
    P(-530, 290, 2.2, 15, 'sand', null, 9),
    P(-585, 240, 2.8, 15, 'sand', null, 6),
    P(-635, 185, 3.6, 15, 'dirt', null, 5),
    // the carousel: hard left, banked, spiralling up the ash shoulder beside the stair
    P(-672, 128, 5.5, 14, 'dirt', null, 8),
    P(-725, 75, 9.5, 14, 'dirt', null, 11),
    P(-795, 50, 14, 14, 'dirt', null, 12),
    P(-865, 60, 19.5, 14, 'dirt', null, 12),
    P(-925, 105, 25, 14, 'dirt', null, 12),
    P(-955, 170, 30, 14, 'dirt', null, 8),
    // the crest: over it, in the air, Semeru dead ahead
    P(-958, 240, 33.5, 15, 'dirt', 'jump'),
    P(-948, 325, 27, 16, 'dirt', null, 2),
    // down the gullies into the long left at the bottom
    P(-942, 395, 20, 15, 'dirt', null, 6),
    P(-905, 450, 13.5, 15, 'dirt', null, 10),
    P(-845, 478, 9, 15, 'dirt', null, 10),
    P(-770, 478, 5.5, 15, 'dirt', null, 6),
    P(-705, 448, 3.5, 15, 'dirt', null, 8),
    P(-640, 450, 2.8, 15, 'dirt', null, 8),
    // the vents: a bulge round the lava outcrop; the soft sand cuts across it
    P(-575, 410, 2, 15, 'dirt', null, 8),
    P(-500, 380, 1.5, 15, 'dirt', null, 9),
    P(-420, 390, 1.2, 15, 'dirt', null, 9),
    P(-365, 440, 1.5, 15, 'dirt', null, 9),
    P(-300, 480, 2.2, 15, 'dirt', null, 7),
    // the savanna, into the sunrise: three dune rollers, the middle one throws you
    P(-235, 482, 3, 15, 'sand', null, 7),
    P(-175, 442, 5.5, 16, 'sand', null, 2),
    P(-120, 387, 1.5, 16, 'sand'),
    P(-70, 327, 6, 16, 'dirt', 'jump'),
    P(-25, 264, 1.5, 16, 'dirt'),
    P(20, 207, 4.5, 15, 'dirt', null, 2),
    // along the foot of the wall: right, left, right, then the hairpin back into the jeep park
    P(75, 160, 2.8, 14, 'dirt', null, 7),
    P(108, 105, 2.05, 14, 'dirt', null, 8),
    P(78, 48, 1.5, 14, 'dirt', null, 10),
    P(82, -15, 1.1, 14, 'dirt', null, 9),
    P(50, -72, 0.9, 15, 'dirt', 'hairpin', 8),
    P(-18, -70, 0.3, 16, 'dirt', null, 8),
    P(-85, -46, 0.1, 16, 'dirt', null, 3),
  ],
  itemBands: [0.045, 0.2, 0.515, 0.815],
  boostPads: [{ u: 0.3, offset: 0 }],
  jumps: [{ u: 0.396, strength: 1.2 }, { u: 0.778, strength: 0.7 }],
  zones: [],
  shortcuts: [
    // the soft sand across the bulge: no vents, shorter, but it drags and it is narrow
    { from: 0.558, to: 0.683, points: [[-585, 1.8, 495], [-470, 1.4, 520], [-365, 1.6, 515]].map(([x, y, z]) => [x * S, y, z * S]), surface: 'sand', w: 7 },
  ],
  hazards: [
    { kind: 'ponies', u: 0.22, width: 1, period: 9, phase: 0 },
    { kind: 'steam', u: 0.607, width: 1.34, period: 7, phase: 0 },
  ],
  // Bromo's own ash and lava bombs on the run out of the gullies, Semeru's column far off while you are in the air at the crest. Never the temple.
  disasters: [
    { kind: 'eruption', u: 0.514, name: 'Eruzione del Bromo', say: { it: 'Il Bromo erutta, occhio alle ombre!', en: 'Bromo is erupting, watch the shadows!' }, bearing: 172.8, far: 590, baseY: 44, height: 520 },
    { kind: 'cloud', u: 0.42, name: 'Nube del Semeru', say: { it: 'Il Semeru sbuffa, là in fondo', en: 'Semeru is puffing, far away' }, bearing: 189.2, far: 3400, baseY: 1310, height: 1300 },
  ],
  sacred: [{ u: 0.24, d: -72, r: 54 }],
  ground: {
    base: 0, hills: 2.4, hillScale: 150, rimHeight: 0, rimFrom: 520, rimTo: 980, water: null, dry: true, displayRise: 1.25, surface: 'sand',
    shape: (x, z) => wall(x, z) + shoulder(x, z) + dunes(x, z),
  },
  grid: { spacing: 4 },
  horizon: { center: [-7.916, 112.953], northDeg: -80, exaggerate: 1, peak: 1, scale: 18, altitude: 2124 },
  // One painted panorama, closed all round, cut into tiles: tools/panoramas/bromo-paint.py with the recipe tools/panoramas/bromo.json writes the files and these lines. The hero is the hand repaint bromo-dawn.
  backdrops: [
    {"file": "bromo-pano-000.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#f0ba9c", "bearing": 0, "elevation": 0, "row": 0.92028},
    {"file": "bromo-pano-060.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#f0ba9c", "bearing": 60, "elevation": 0, "row": 0.92028},
    {"file": "bromo-pano-120.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#f0ba9c", "bearing": 120, "elevation": 0, "row": 0.92028},
    {"file": "bromo-pano-180.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#f0ba9c", "summit": {"name": "Semeru", "lat": -8.1078, "lon": 112.9225, "altitude": 3676, "u": 0.6443, "row": 0.33264}, "elevation": 20.96, "compressed": "true 4.1 deg: Semeru stands as the classic views of the caldera show it, filling the skyline behind Bromo and Batok, which is what names the place"},
    {"file": "bromo-pano-240.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#f0ba9c", "bearing": 240, "elevation": 0, "row": 0.92028},
    {"file": "bromo-pano-300.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#f0ba9c", "bearing": 300, "elevation": 0, "row": 0.92028},
  ],
  look: {
    // The repaint's dawn on everything: the sand glows peach and gold with soft violet shadows, the road a plain plum band with a cream edge you read at once.
    sun: { azimuth: 180, elevation: 11, color: '#ffc4a0', intensity: 2.6, wrap: [-0.2, 0.72] },
    hemi: { sky: '#e9cfd6', ground: '#c49a90', intensity: 2.5 },
    sky: {
      stops: [[-8, '#f2c4ac'], [0, '#f6c6aa'], [4, '#f2bdb0'], [9, '#dcb0c0'], [16, '#b2a6d0'], [26, '#9099d2'], [50, '#7f88c8']],
      glow: '#ffd6a0', glowStrength: 0.3, glowWidth: 0.42,
      clouds: { amount: 0 },
    },
    fog: { color: '#f0c0a4', density: 0.00042, heightFalloff: 0.012, max: 0.6 },
    // it lies on the floor: the walls and the cones stand out of it with their own colours
    mist: { from: 300, to: 1400, amount: 0.75, ring: 0, high: [4, 75, 0.25] },
    terrain: {
      meadowY: '#ecb49a', meadow: '#e8ac9c', meadowF: '#e4a4a0', meadowD: '#c08c98', forest: '#7a7a4c', forestMix: 0.5, facetTone: 0, facetTilt: 0, facetSize: 12, patch: { size: 90, tone: 0.02 }, verge: '#e8ac9c', grass: [0, 0],
      rock: '#a87f92', rockB: '#8c6c90', coverNoise: [7, 0.7], rockSlope: [86, 89], rockStrata: { spacing: 3, tone: 0, wobble: 0 }, noiseScale: [160, 55],
      // Bromo's ash is plain grey and only its lit ribs warm; the wall is dark scrub over dark rock, wide gullies and no comb
      rills: { a: [SHOULDER.x, SHOULDER.z, 64, 0.16, 0, SHOULDER.r + 8], b: [WALL.x, WALL.z, 60, 0.26, 380, 1000], rib: '#f0b49a', gully: '#8e6c94', ribB: '#e2a488', gullyB: '#6e5a7c', height: [5, 12] },
      detail: { stone: 0, stones: 0, tufts: 0 },
      // the wind's long swells in the sand, wide and soft: [wavelength m, tone], look.terrain.ripple
      ripple: [15, 0.06, 1],
      terraces: { step: 4.5, wobble: 3, rows: 5, young: '#8a9a58', green: '#66803e', dark: '#4e6638', gold: '#a48f54', water: '#7c8a50', riser: '#5a4a3c' },
    },
    stone: { color: '#9a7a84', dark: '#6e5670', wall: '#84687a' },
    horizon: { rock: '#c09088', rockB: '#a07c8c', scree: '#c09088', grass: '#a89a70', forest: '#7a7a4c', haze: '#eebca4', hazeNear: 1200, hazeFar: 17000, hazeMax: 0.8, shade: '#7c76a0', strataTone: 0.05, ink: 0.12 },
    // no planted forest: the casuarina is drawn by the landmark in clumps of many shapes, along the crest, in the temple yard and in the savanna
    trees: {
      kinds: [{ name: 'cemara', shape: 'conifer', share: 1, height: [9, 15], width: 0.5, colors: ['#5a6a40', '#6a7646', '#4c5c3c'] }],
      density: 0, cover: -0.2, far: 1200, maxSlope: 50, nearScale: 0.85, roadGap: 14,
    },
    rocks: { color: '#a07c84', count: 24 },
    road: { bale: '#8a7c60', asphalt: '#9c86a8', dirt: '#9c86a8', sand: '#ab96b0', cobble: '#9c86a8', line: '#fff0d4', kerb: ['#fbe6c2', '#fbe6c2'], kerbW: 0.55, shoulder: '#fff0da', verge: '#e8ac9c', edgeSink: 0.25, pebble: 30, wobble: 0.5 },
    kartShadow: [0.3, 0.16, 0.36, 0.5],
    softPuff: 1,
    dust: { dirt: '#a58fae', sand: '#ad98b2', grass: '#d0b49e' },
    vent: { crust: '#8a6a7c', throat: '#3a2c44', ring: '#a88490', puff: '#f6e6dc', puffB: '#fbf2ec', shade: '#a49cb0', size: 1.5, rock: '#7a5c76', sulphur: '#b8a860', lit: true },
    outline: { color: '#2e2436', strength: 0.7, width: 1.4, threshold: [0.06, 0.14], minGap: 0.6, fade: [120, 420] },
  },
  music: 'bromo',
  landmarks: 'bromo',
};
export default DEF;
