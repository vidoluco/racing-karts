// Giro dell'Antelao: Borca di Cadore in a golden late afternoon. The road is drawn in valley coordinates, because the
// valley is what it follows: `a` runs down the Boite, `b` runs across it. These are world bearings (140 is what the DEM measures at
// Borca); `horizon.northDeg` then turns them against the real mountains: driving +a looks at the Antelao, -a at the Pelmo.
//
// The lap, in the order it is driven:
//   Borca, the SS51 and the sweepers along the Boite, fast and downhill to the stone bridge (the low point).
//   Back up the far bank through the meadows, then a long right onto the old railway: the viaduct flies over the
//   Boite and over the SS51 you drove a minute ago, into the short gallery. Out of it at the Gellner village, three
//   hairpins up through the larches, the meadow crest with its jump, and the sprint down past the tabià into Borca.

const BEAR = 140 * Math.PI / 180;
const AX = Math.sin(BEAR), AZ = -Math.cos(BEAR), BX = Math.cos(BEAR) * -1, BZ = Math.sin(BEAR) * -1;
const xz = (a, b) => [a * AX + b * BX, a * AZ + b * BZ];
const end = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// The SS51 is a narrow road through a village: as narrow as a kart road goes, or the slab pushes the mountains and the houses away.
const NARROW = (w) => Math.max(11.1, w * 0.72);
const P = (a, b, y, w, surface = 'asphalt', tag = null, bank = 0) => {
  const [x, z] = xz(a, b);
  return { p: [x, y, z], w: NARROW(w), bank, surface, tag };
};

// Half a circle in five points, because a hand placed hairpin always comes out lopsided. Starts heading along +a or
// -a at (ca, cb - r) and leaves the other way at (ca, cb + r); dir +1 bulges toward +a, -1 toward -a.
const hairpin = (ca, cb, r, dir, y0, y1, surface = 'asphalt') => {
  const c = Math.SQRT1_2 * r, ym = (y0 + y1) / 2;
  return [
    P(ca, cb - r, y0, 14, surface, null, 5),
    P(ca + dir * c, cb - c, (y0 + ym) / 2, 15, surface, null, 8),
    P(ca + dir * r, cb, ym, 16, surface, 'hairpin', 8),
    P(ca + dir * c, cb + c, (ym + y1) / 2, 15, surface, null, 8),
    P(ca, cb + r, y1, 14, surface, null, 5),
  ];
};

const GALLERY_HILL = xz(186, 96);
const NORTH = -61;

export default {
  id: 'antelao', region: 'cadore',
  names: { it: "Giro dell'Antelao", en: 'Antelao Loop' },
  blurb: {
    it: 'Da Borca lungo il Boite, sul viadotto della vecchia ferrovia, su per i tornanti tra i larici del villaggio di Gellner e giù dritti in paese.',
    en: 'From Borca along the Boite, over the old railway viaduct, up the hairpins through the larches of the Gellner village and straight back down to town.',
  },
  points: [
    // Borca, the start: the SS51 runs level and wide
    P(0, 0, 0, 16),
    P(70, 3, -0.6, 16),
    // the sweepers along the Boite: left, right, left, each one a little tighter
    P(132, 28, -1.8, 15, 'asphalt', null, 5),
    P(186, 30, -2.8, 15, 'asphalt', null, 5),
    P(232, -8, -4, 15, 'asphalt', null, 6),
    P(266, -20, -5, 15, 'asphalt', null, 6),
    P(296, -2, -6, 14, 'asphalt', null, 7),
    // hard right down to the stone bridge, the low point of the lap
    P(326, 0, -6.6, 14, 'asphalt', null, 8),
    P(342, -26, -6.4, 13),
    P(344, -54, -5.8, 13, 'cobble', 'bridge'),
    P(342, -78, -5.2, 13, 'cobble', 'bridge'),
    P(340, -102, -5.6, 13, 'cobble', 'bridge'),
    // the far bank, meadows, climbing back upstream
    P(322, -130, -5, 14, 'asphalt', null, 8),
    P(288, -144, -4, 14, 'asphalt', null, 6),
    P(248, -134, -2, 14, 'asphalt', null, 4),
    P(210, -156, 1.5, 14, 'asphalt', null, 4),
    // the long right that lines you up with the railway
    P(178, -160, 4.5, 14, 'asphalt', null, 7),
    P(152, -136, 7.5, 13, 'asphalt', null, 7),
    // the old railway viaduct: straight, proud and high, over the Boite and then over the SS51
    P(146, -106, 9.5, 13, 'asphalt', 'viaduct'),
    P(140, -60, 11, 13, 'asphalt', 'viaduct'),
    P(137, -14, 12, 13, 'asphalt', 'viaduct'),
    P(136, 28, 12.8, 13, 'asphalt', 'viaduct'),
    P(138, 62, 13.4, 13, 'asphalt', 'viaduct'),
    // the short gallery, curving right inside the hill
    P(144, 92, 14, 12, 'asphalt', 'tunnel'),
    P(160, 118, 14.8, 12, 'asphalt', 'tunnel'),
    P(186, 132, 15.6, 12, 'asphalt', 'tunnel'),
    // Corte di Cadore, the Gellner village among the pines: a calm level moment before the climb
    P(218, 136, 16.6, 14, 'cobble'),
    // three hairpins up through the larches
    ...hairpin(246, 159, 23, 1, 19.5, 26.5),
    P(216, 182, 29.5, 14),
    ...hairpin(190, 205, 23, -1, 31, 38),
    P(220, 228, 40.5, 14),
    ...hairpin(246, 251, 23, 1, 42.5, 48, 'dirt'),
    // the meadow: open, flat out, the crest throws you off it
    P(206, 274, 50, 16, 'dirt'),
    P(160, 272, 52, 16, 'dirt', 'jump'),
    // the sprint down to Borca: fast, wide, with the Pelmo dead ahead
    P(104, 260, 47.5, 16),
    P(40, 262, 40.5, 16, 'asphalt', null, 5),
    P(-44, 236, 33.5, 16, 'asphalt', null, 6),
    // the farmyard bend round the tabià; the cart track cuts inside it
    P(-72, 204, 29.5, 15, 'asphalt', null, 6),
    P(-66, 172, 26, 15, 'asphalt', null, 7),
    P(-46, 138, 21.6, 15, 'asphalt', null, 7),
    P(-60, 106, 18, 15, 'asphalt', null, 7),
    P(-96, 84, 14.8, 15, 'asphalt', null, 6),
    P(-124, 60, 11, 15, 'asphalt', null, 5),
    P(-128, 22, 6, 15, 'asphalt', null, 6),
    P(-98, 0, 2.2, 16, 'cobble', null, 5),
    // into Borca under the bell tower
    P(-52, -2, 0.5, 16, 'cobble'),
  ],
  itemBands: [0.09, 0.285, 0.488, 0.785],
  boostPads: [{ u: 0.4, offset: 0 }, { u: 0.888, offset: 0.35 }],
  jumps: [{ u: 0.701, strength: 1 }],
  zones: [],
  shortcuts: [
    // the cart track through the tabià farmyard: shorter, but dirt and only 7 m wide
    { from: 0.822, to: 0.898, points: [[...xz(-82, 165), 25], [...xz(-88, 122), 19.5]].map(([x, z, y]) => [x, y, z]), surface: 'dirt', w: 7 },
  ],
  hazards: [{ kind: 'cows', u: 0.925, width: 1, period: 9, phase: 0 }],
  // Cancia, on the flank of the Antelao, is where the real debris flows of this valley come down. Here they cross the sprint after the crest, from the mountain side.
  disasters: [
    { kind: 'debris', u: 0.742, side: -1, name: 'Colata di Cancia', say: { it: 'Fango e massi giù dalla montagna!', en: 'Mud and boulders off the mountain!' } },
    { kind: 'rockfall', u: 0.122, side: 1, name: "Frana dall'Antelao", say: { it: 'Massi dal fianco della montagna!', en: 'Boulders off the side of the mountain!' } },
  ],
  sacred: [{ u: 0.97, d: 38, r: 30 }, { u: 0.512, d: -54, r: 34 }, { u: 0.093, d: 10, r: 6 }, { u: 0.838, d: 11, r: 6 }],
  ground: {
    // the Boite is a trench: steep forest walls rise close on both sides of the road, and it opens only along its axis, toward the two great mountains
    base: 0, hills: 22, hillScale: 240, rimHeight: 240, rimFrom: 110, rimTo: 850, water: -11.5, displayRise: 0.6, dry: true,
    shape: (x, z) => {
      const [gx, gz] = GALLERY_HILL, e = ((x - gx) ** 2 + (z - gz) ** 2) / (75 * 75), a = x * AX + z * AZ, b = x * BX + z * BZ;
      // the spur the gallery goes through, so it stands in a hillside and not on a lawn; and the valley's floor dug out toward each end, widening with distance, so each mountain stands at the end of its straights
      // its edge wanders in spurs: a straight one drew a ruled diagonal across the wood
      const open = (along, mid, from) => { const w = 150 + 0.55 * Math.max(0, along - from) + 70 * Math.sin(along / 173 + 1) + 42 * Math.sin(along / 71); return end(from, from + 420, along) * (1 - end(w, w + 460, Math.abs(b - mid))); };
      return 34 * Math.exp(-e) - 420 * Math.max(open(a, 130, 300), open(-a, 150, 120));
    },
    river: {
      w: 30, depth: 2.5,
      points: [[-1500, -40], [-900, -70], [-500, -50], [-220, -72], [-40, -56], [100, -62], [240, -82], [420, -76], [600, -64], [900, -90], [1500, -60], [2300, -100]].map(([a, b]) => xz(a, b)),
    },
  },
  // a state road through a village and not a circuit, narrower than the default range
  roadRange: [11, 18],
  grid: { spacing: 4 },
  // altitude: Copernicus GLO-30 at the center, the real height of y = 0
  // northDeg turns the road against the real mountains, nothing else: the valley axis (`a`) is laid along the line from the Pelmo to the
  // Antelao, so the start straight, the sweepers and every +a leg run at the Antelao, the sprint and the -a legs at the Pelmo,
  // and the viaduct (+b) at the Sorapiss. In reality the SS51 runs 140 here, with the Antelao on the left: the mountains keep their
  // true bearings from each other and from Borca, the road is what took the licence.
  horizon: { center: [46.437, 12.218], northDeg: NORTH, exaggerate: 0.85, peak: 1.12, scale: 18, altitude: 919 },
  // One painted panorama, closed all round, cut into tiles: tools/compose-panorama.py with tools/panoramas/antelao.json writes the files and these lines.
  // The heroes are hand repaints of real photos (data/raw/backdrop-photos/antelao-gemini2, pelmo-golden-gemini): the Antelao from San Vito, the Pelmo from San Vito. The sky, the far land and this file's colours are read off them.
  // Peaks: docs/references/cadore.md, OpenStreetMap for Croda Marcora and La Rocheta. Sources and licences: assets/backdrops/CREDITS.md.
  backdrops: [
    {"file": "antelao-pano-000.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#5d6c92", "bearing": 0, "elevation": 0, "row": 0.92},
    {"file": "antelao-pano-060.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#5d6c92", "summit": {"name": "Antelao", "lat": 46.4519, "lon": 12.2618, "altitude": 3264, "u": 0.55982, "row": 0.23732}, "elevation": 24, "compressed": "true 32 deg, top of the chase frame is 24.4 deg"},
    {"file": "antelao-pano-120.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#5d6c92", "bearing": 120, "elevation": 0, "row": 0.92},
    {"file": "antelao-pano-180.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#5d6c92", "bearing": 180, "elevation": 0, "row": 0.92},
    {"file": "antelao-pano-240.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#5d6c92", "summit": {"name": "Pelmo", "lat": 46.42, "lon": 12.1347, "altitude": 3168, "u": 0.71834, "row": 0.30049}, "elevation": 22, "compressed": "true 18.7 deg, raised and stretched because over the wooded ridge only the upper rock shows, and it must still read as the block it is from the road"},
    {"file": "antelao-pano-300.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#5d6c92", "bearing": 300, "elevation": 0, "row": 0.92},
  ],
  look: {
    // golden autumn, late sun low from the south-west (true bearing 225), so the Antelao and the Pelmo's east ledges take the light
    sun: { azimuth: 225 - NORTH, elevation: 18, color: '#ffd29c', intensity: 3.4, wrap: [-0.22, 0.62] },
    // the air of the hour in every shadow: mauve from the sky, so the ground is lit by the same evening as the mountains
    hemi: { sky: '#dcbcc6', ground: '#b49c78', intensity: 2.0 },
    // a warm edge on walls and roofs at a glancing angle: the sky's rose on everything built, so it stands in the same evening as the painting
    staticRim: [0.022, 4],
    sky: {
      // the sky of the hero repaint: violet high up, rose behind the crests, peach at the valley's end
      stops: [[-8, '#fbcfae'], [0, '#fbc8b0'], [8, '#fbbdb4'], [14, '#f8b4b3'], [19, '#faa4c1'], [23, '#d79cd4'], [27, '#9f93dd'], [50, '#7585df']],
      glow: '#ffc2a8', glowStrength: 0.55, glowWidth: 0.4,
      // the clouds are in the panorama's painting
      clouds: { amount: 0 },
    },
    fog: { color: '#9a94c0', density: 0.00016, heightFalloff: 0.004, max: 0.4 },
    // air: the far woods go blue and pale with distance, into the same slate as the foot of the painted panorama, so the slopes stand behind each other and the mountains stand far
    mist: { from: 90, to: 750, amount: 0.62, ring: 0 },
    terrain: {
      meadowY: '#aaa956', meadow: '#94a353', meadowF: '#7f9a53', meadowD: '#688650', forest: '#3a6066', forestMix: 0.92, facetTone: 0.02, facetTilt: 0.025, patch: { size: 60, tone: 0.07 }, verge: '#8e9c4e', grass: [0.12, 0.12], detail: { stone: 0, stones: 0, tufts: 0.5 },
      // the far slopes where the 3D trees thin out: what the forest of the panorama is painted with
      wood: { from: 420, to: 820, amount: 1, dark: '#2c4a5e', light: '#4f7476', gold: '#c88a3c' },
      rock: '#ac9e92', rockB: '#938779', rockStrata: { spacing: 2.2, tone: 0.42, wobble: 0.8 }, coverNoise: [7, 0.8], snow: '#fdf9f4', rockSlope: [58, 72],
      bank: '#c9c0ae', bankD: '#a39b8e', bankWet: '#7d7a72', bed: '#a6c3c4', bankHeight: 2.8,
    },
    stone: { color: '#aca69b', dark: '#8c867e', wall: '#7f7a74', scale: 1.7 },
    // a dark contact shadow under every kart, and under a rolling cheese
    kartShadow: [0.035, 0.025, 0.06, 0.92], kartShadowScale: 1.22, shotShadow: true,
    // the bridges of the old Dolomites railway: slim pale arches, pilasters, a thin green iron rail (photo: data/raw/backdrop-photos/rail-bridge)
    deck: { span: 15, pier: 2.4, rail: '#3f6e55', weather: 1 },
    // the Boite is a wide bed of pale gravel with thin milky green channels, no blue sheet
    water: { deep: '#5f9490', base: '#7dafa8', light: '#a4cbc2', far: '#a8c8c0', foam: '#eef2ea', bar: '#d6cdb8', channel: 3 },
    // the DEM ring between the panels: far ranges in the air of the hour, the same mauve rock as the paintings, no green and gold of its own
    horizon: { rock: '#d8c6bb', rockB: '#c6a0ac', scree: '#d2b4b4', grass: '#9c9aa0', forest: '#6d7c8e', gold: '#9a8f92', haze: '#e4c6c4', hazeNear: 1200, hazeFar: 17000, hazeMax: 0.8, shade: '#b0a0cc', strataTone: 0.05, ink: 0.12 },
    trees: {
      kinds: [
        // spruce near black, larch in groves: the woods of the Boite as they stand in autumn
        { name: 'spruce', shape: 'conifer', share: 0.52, height: [13, 24], width: 0.8, colors: ['#2a5a4c', '#265348', '#214b43', '#336456'] },
        { name: 'fir', shape: 'conifer', share: 0.16, height: [14, 26], width: 0.62, colors: ['#25505a', '#2c5a62', '#204850'] },
        { name: 'pale', shape: 'conifer', share: 0.1, height: [9, 16], width: 0.92, colors: ['#3a614e', '#446c52', '#345a4c'] },
        { name: 'larch', shape: 'larch', share: 0.22, height: [11, 21], width: 0.8, colors: ['#e0ae48', '#eabf58', '#cf9a40', '#e4b44c', '#d6b054'] },
        { name: 'pine', shape: 'conifer', share: 0, height: [20, 30], width: 0.62, colors: ['#23503c', '#2a5a42', '#1f4836'] },
      ],
      // the wood starts where the fields stop: only the hay meadows round the roads and Borca stay open
      // drift small: larch scattered all through the spruce as on the real slopes, not in blocks
      density: 0.85, cover: 0.22, far: 560, maxSlope: 56, drift: 45, nearScale: 0.72, roadGap: 9, farGold: 0.45,
    },
    rocks: { color: '#9a9088', count: 70 },
    // no circuit kerbs on the SS51: the asphalt frays into a thin stony edge and the meadow comes right up to it; delineators, larch rails and dry walls are what you steer by
    road: { asphalt: '#5f5e60', dirt: '#c2b197', cobble: '#8d8a86', sett: 6, line: '#ece5cf', kerb: ['#6a6868', '#6e6c6b'], kerbW: 0.3, shoulder: '#83806e', verge: '#8f9f4f', wobble: 0.45, wear: 0.5, cracks: 0.08, moundRock: '#8f877b', moundColor: '#6d7c46', gravel: 0.5, lineWear: 0.3, edgeSink: 0.18, repair: 0.4 },
  },
  music: 'cadore',
  landmarks: 'antelao',
};
