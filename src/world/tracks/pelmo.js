// Pelmo d'Inverno: the eastern slope under the Monte Pelmo, above Vodo di Cadore on a winter afternoon going to dusk. -z runs straight at the Pelmo (horizon.northDeg),
// so x runs across its face and the road is drawn in plain world coordinates.
//
// The lap, in the order it is driven:
//   The rifugio and the start, a long ploughed climb and sweepers through the snowy firs with the throne dead ahead.
//   The top bend, then the balcony: a traverse under the white gully of the Valanga, into the avalanche shed.
//   Out of it the road becomes the piste: wide, white, downhill at the Antelao, over the trestle and off the kicker.
//   The bowl, and the Pelmo fills the screen again. Round the frozen lake on ice (or straight across it, if you dare).
//   Under the trestle you flew over, past the Pelmetto boulder and the sled run, through the hamlet and home.

const NORTH = 268;
const end = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// A mountain road, not a motorway: as narrow as a kart road goes, or the slab pushes the banks, the wood and the houses away.
const NARROW = (w) => Math.max(11.1, w * 0.72);
const P = (x, z, y, w = 15, surface = 'asphalt', tag = null, bank = 0) => ({ p: [x, y, z], w: NARROW(w), bank, surface, tag });

export default {
  id: 'pelmo', region: 'cadore',
  names: { it: "Pelmo d'Inverno", en: 'Pelmo in Winter' },
  blurb: {
    it: 'Sotto il Caregón del Pelmo, su neve e ghiaccio al tramonto: la valanga, la pista, il lago gelato e le impronte dei dinosauri.',
    en: 'Under the great throne of the Pelmo, on snow and ice at dusk: the avalanche, the piste, the frozen lake and the dinosaur footprints.',
  },
  roadRange: [11, 18],
  points: [
    // the rifugio and the start, ploughed
    P(0, 0, 0, 16),
    P(0, -55, 0.6, 16),
    P(-4, -110, 2, 16),
    // the sweepers through the firs, the Pelmo over the bonnet
    P(-22, -160, 4.5, 15, 'asphalt', null, 4),
    P(-16, -210, 7.5, 15, 'asphalt', null, 5),
    P(16, -250, 11, 15, 'asphalt', null, 5),
    P(18, -295, 14.5, 15, 'asphalt', null, 5),
    P(-6, -330, 17.5, 15, 'asphalt', null, 6),
    // the top bend
    P(-8, -372, 21, 15, 'asphalt', null, 8),
    P(18, -404, 23.5, 15, 'asphalt', null, 9),
    P(60, -414, 25, 14, 'asphalt', null, 7),
    // the balcony, under the gully
    P(120, -410, 26.5, 14),
    P(180, -398, 27.2, 14),
    P(240, -382, 27.8, 14),
    // the avalanche shed, curving right
    P(285, -362, 28, 13, 'asphalt', 'tunnel'),
    P(315, -330, 27.6, 13, 'asphalt', 'tunnel'),
    P(330, -290, 26.4, 13, 'asphalt', 'tunnel'),
    // the piste: wide, white, downhill at the Antelao
    P(345, -245, 22.5, 17, 'snow'),
    P(375, -200, 16.5, 16, 'snow', 'bridge'),
    P(412, -160, 11.5, 16, 'snow', 'bridge'),
    P(450, -125, 6.6, 17, 'snow', 'jump'),
    P(485, -92, 0, 18, 'snow'),
    // the bowl: a banked left you can hold a drift through
    P(517, -79, -3, 18, 'snow', null, 12),
    P(549, -92, -4, 18, 'snow', null, 13),
    P(562, -124, -4, 18, 'snow', null, 10),
    // the Pelmo again, and the frozen lake
    P(558, -165, -3.2, 16, 'snow'),
    P(550, -200, -2.5, 16, 'snow', null, 2),
    P(534, -238, -2.2, 16, 'ice', null, 4),
    P(495, -255, -2, 16, 'ice', null, 4),
    P(456, -239, -2, 16, 'snow', null, 2),
    // under the trestle
    P(420, -205, -1.5, 15, 'snow'),
    P(385, -170, -0.5, 15, 'snow'),
    P(345, -130, 0.6, 15, 'asphalt'),
    // the long run home past the boulder, with the sled run across it
    P(300, -95, 1.8, 15, 'asphalt', null, 4),
    P(265, -40, 2.6, 15, 'asphalt', null, 5),
    P(215, -10, 3, 15, 'asphalt', null, 5),
    P(190, 45, 2.6, 15, 'asphalt', null, 5),
    P(140, 92, 1.8, 15, 'cobble', null, 4),
    // the hamlet, and the last right
    P(82, 110, 1, 15, 'cobble', null, 6),
    P(32, 92, 0.4, 15, 'cobble', null, 8),
    P(4, 48, 0, 16, 'asphalt', null, 4),
  ],
  itemBands: [0.09, 0.31, 0.585, 0.83],
  boostPads: [{ u: 0.455, offset: 0 }, { u: 0.75, offset: -0.35 }],
  jumps: [{ u: 0.487, strength: 1.05 }],
  zones: [],
  shortcuts: [
    // straight across the frozen lake: shorter, narrow, and all ice
    { from: 0.606, to: 0.682, points: [[520, -2.1, -222], [478, -2, -226]], surface: 'ice', w: 8 },
  ],
  hazards: [
    { kind: 'sledders', u: 0.795, width: 1, period: 8, phase: 0 },
    { kind: 'ice', u: 0.72, width: 0.7 },
    { kind: 'ice', u: 0.2, width: 0.8 },
  ],
  // the avalanche comes down the white gully over the balcony, on the driver's left; the local name goes on the sign and the HUD
  sacred: [{ u: 0.92, d: -38, r: 14 }],
  disasters: [{ kind: 'avalanche', u: 0.3, name: 'Valanga del Pelmo', say: { it: 'Valanga! Tieniti sul lato libero', en: 'Avalanche! Keep to the free lane' }, side: 1 }],
  ground: {
    base: 0, hills: 16, hillScale: 240, rimHeight: 150, rimFrom: 120, rimTo: 900, water: null, displayRise: 0.5,
    shape: (x, z) => {
      // the valley's floor dug out toward the two great mountains, widening with distance, so each stands at the end of its straights
      const open = (along, b, from) => { const w = 120 + 0.34 * Math.max(0, along - from); return end(from, from + 380, along) * (1 - end(w, w + 420, Math.abs(b))); };
      const pelmo = open(-z, x - 40, 470), antelao = open(0.52 * x + 0.85 * z, 0.85 * x - 0.52 * z - 300, 520);
      // the white slope over the balcony, with the gully the Valanga comes down, and the mound the shed is cut into
      const a = (x - 250) / 170, b = (z + 500) / 80, slope = 62 * Math.exp(-a * a) * end(-385, -470, z) * (1 + 0.15 * Math.sin(x / 40)), gully = 16 * Math.exp(-(((x - 190) / 26) ** 2)) * end(-400, -470, z);
      const mound = 20 * Math.exp(-(((x - 345) / 70) ** 2 + ((z + 345) / 60) ** 2));
      // the lake's flat floor
      const lake = Math.exp(-(((x - 498) / 90) ** 2 + ((z + 215) / 80) ** 2));
      return slope - gully + mound - 340 * Math.max(pelmo, antelao) - 2 * lake - 0 * b;
    },
  },
  grid: { spacing: 4 },
  horizon: { center: [46.4215, 12.195], northDeg: NORTH, exaggerate: 1, peak: 1.05, scale: 18, altitude: 1467 },
  // One painted panorama, closed all round: tools/compose-panorama.py with tools/panoramas/pelmo.json writes the files and these lines.
  // Peaks: docs/references/cadore.md and pelmo.md. Sources and licences: assets/backdrops/CREDITS.md.
  backdrops: [
    {"file": "pelmo-pano-000.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#7f8cb8", "summit": {"name": "Punta Sorapiss", "lat": 46.5069, "lon": 12.2117, "altitude": 3205, "u": 0.62363, "row": 0.50915}, "elevation": 15, "compressed": "true 10.3 deg from the track's slope: the real skyline seen from the floor of the valley and raised by one factor, because the valley is deep and walled and over its wooded sides only the upper rock shows"},
    {"file": "pelmo-pano-060.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#7f8cb8", "summit": {"name": "Antelao", "lat": 46.4519, "lon": 12.2618, "altitude": 3264, "u": 0.44414, "row": 0.30049}, "elevation": 22, "compressed": "true 16.3 deg, raised as the Pelmo is: the valley is deep, over its wooded sides only the upper rock shows, and the Antelao must dominate the sky as it does from the Boite; the top of the chase frame is 24.4 deg"},
    {"file": "pelmo-pano-120.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#7f8cb8", "summit": {"name": "Sasso di Bosconero", "lat": 46.3366, "lon": 12.2682, "altitude": 2469, "u": 0.97143, "row": 0.49477}, "elevation": 15.5, "compressed": "true 5.2 deg from the track's slope: the real skyline seen from the floor of the valley and raised by one factor, because the valley is deep and walled and over its wooded sides only the upper rock shows"},
    {"file": "pelmo-pano-180.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#7f8cb8", "summit": {"name": "Sasso di Bosconero", "lat": 46.3366, "lon": 12.2682, "altitude": 2469, "u": 0.00369, "row": 0.49477}, "elevation": 15.5, "compressed": "true 5.2 deg from the track's slope: the real skyline seen from the floor of the valley and raised by one factor, because the valley is deep and walled and over its wooded sides only the upper rock shows"},
    {"file": "pelmo-pano-240.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#7f8cb8", "summit": {"name": "Pelmo", "lat": 46.42, "lon": 12.1347, "altitude": 3168, "u": 0.95089, "row": 0.26914}, "elevation": 23, "compressed": "true 20.2 deg, raised because over the wooded ridge only the upper rock shows; the top of the chase frame is 24.4 deg"},
    {"file": "pelmo-pano-300.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#7f8cb8", "bearing": 300, "elevation": 0, "row": 0.92}
  ],
  look: {
    // the sun of a winter afternoon going down, true bearing 220: it rakes the Pelmo's south-east face and lights the snow rose
    sun: { azimuth: 220 - NORTH, elevation: 13, color: '#ffc8a6', intensity: 3.5, wrap: [-0.15, 0.42] },
    hemi: { sky: '#b9c0ee', ground: '#e8dcea', intensity: 2.05 },
    sky: {
      stops: [[-8, '#fdc4a9'], [0, '#fdc4a9'], [3.7, '#fdc4a9'], [5.7, '#fdbdac'], [9.7, '#f9c3bf'], [13.6, '#ebb5b7'], [17.4, '#d0adc6'], [21, '#b4a5d0'], [24.5, '#a09fd6'], [27.1, '#959cd8'], [33, '#8b96da'], [48, '#7f8fd8']],
      glow: '#ffc9a8', glowStrength: 0.45, glowWidth: 0.4,
      clouds: { amount: 0 },
    },
    fog: { color: '#bfb6dc', density: 0.0003, heightFalloff: 0.004, max: 0.6 },
    mist: { from: 160, to: 1050, amount: 0.78, ring: 0 },
    terrain: {
      meadowY: '#f8eff2', meadow: '#f0ebf4', meadowF: '#e9e7f4', meadowD: '#d7d8ee', forest: '#ccd0e8', forestMix: 0.7, verge: '#d8deed',
      // no facets: on snow they read as wedges of flat polygon. Wind, in long soft strokes, and the long shade of the low sun, do the work
      facetTone: 0.006, facetTilt: 0.012, patch: { size: 44, tone: 0 }, grass: [0, 0], sculpt: { tone: 0.8, lines: 0.13, ink: 0.3, scale: 0.8 },
      wood: { from: 380, to: 760, amount: 0.8, dark: '#2c3d56', light: '#7d8cb8', gold: '#8c90b0' },
      rock: '#8d8ca6', rockB: '#77788f', rockStrata: { spacing: 2.2, tone: 0.42, wobble: 0.8 }, coverNoise: [9, 0.8], snow: '#fbfaff', snowOnGround: 0, rockSlope: [52, 66],
    },
    stone: { color: '#c0b8c2', dark: '#8a8496', wall: '#7f7a88', scale: 1.9 },
    deck: { span: 12, pier: 2.2, rail: '#6a4a33' },
    horizon: { rock: '#c7a7bb', rockB: '#a48fb4', scree: '#d6cfe4', grass: '#c9cfe6', forest: '#5d7290', gold: '#7f8ca8', snow: '#fff2ec', haze: '#d2c6de', hazeNear: 1200, hazeFar: 17000, hazeMax: 0.8, shade: '#8f9acc', strataTone: 0.05, ink: 0.12 },
    trees: {
      kinds: [
        { name: 'spruce', shape: 'conifer', share: 0.62, height: [10, 20], width: 0.8, colors: ['#22354a', '#263b52', '#1c2f42', '#2c4258'] },
        { name: 'fir', shape: 'conifer', share: 0.28, height: [12, 22], width: 0.62, colors: ['#1c2c40', '#203248', '#18283a'] },
        { name: 'young', shape: 'conifer', share: 0.1, height: [5, 10], width: 0.85, colors: ['#2e4560', '#344c68'] },
        // the larches stand bare: thin, tawny, what breaks the wood's one colour on a winter slope
        { name: 'larch', shape: 'conifer', share: 0.1, height: [12, 20], width: 0.5, colors: ['#6d5848', '#7a6452', '#5e4c40'] },
      ],
      // boughs under snow (toon code in render/index.js): the tops of the tiers go white, the undersides stay dark
      snow: { color: '#f4eef6', amount: 0.9, clump: 0.2, edge: [0.38, 0.52] },
      density: 0.52, cover: 0.1, far: 680, farCap: 3000, nearBand: 46, maxSlope: 54, drift: 60, nearScale: 0.72, roadGap: 9,
    },
    rocks: { color: '#e4e4f4', count: 0 },
    // no circuit kerbs on a mountain road: a low ploughed edge; the poles are what you steer by
    road: { asphalt: '#62637c', snow: '#9298c0', corduroy: 0.07, ice: '#8fb4cd', iceSoft: 1, cobble: '#8c7f78', sett: 1.75, settRough: 1, wood: '#a87f55', line: '#f2efe8', kerb: ['#d9d9e8', '#dfdfec'], kerbW: 0.45, shoulder: '#dcdbec', noKerbOn: 'snow', edgeSink: 0.22, snowSpray: 'all', wobble: 1.5, repair: 0.5, wear: 0.4, winter: { grain: 0.2, ruts: 1.9, scratches: 0.2, dust: 0.3 } },
    outline: { fade: [170, 520] },
    bloom: { threshold: 1.1, strength: 0.26 },
  },
  music: 'cadore',
  landmarks: 'pelmo',
  // the ploughed bank stands where the shoulder ends: a kart runs along it and throws snow, it does not drive into a heap that has no ground under it for the sim
  wall: { max: 1.6 },
};
