// Bucarest: the owner's home city on a warm golden evening, on its true streets squeezed to 0.56 so that a good hour's drive fits in a lap. x east, z south, the origin at 44.447, 26.0925; the points
// come from tools/bucarest-route.mjs, OpenStreetMap's own ways and the DEM's own heights (src/data/bucarest-route.js). The road runs west down Bulevardul Unirii past its fountains at the huge Parliament, round
// Piata Constitutiei, along the Dambovita, over the Podul Natiunile Unite, up the whole of Calea Victoriei past the CEC, Piata Revolutiei, and the Ateneu to Piata Victoriei, out along the
// chestnuts of Soseaua Kiseleff, round the Arc de Triumf, through the park by the lake of Herastrau, back down Aviatorilor past the embassies, then Catargiu, Piata Romana, Magheru, Balcescu, Bratianu and Piata
// Unirii. Facts: docs/references/bucarest.md. Never an earthquake, here or anywhere: the hazard is the city's own heating main, and it only ever steams.
import { ROUTE } from '../../data/bucarest-route.js';

const MAP = 0.56, POINTS = [], MARK = {};
// the Dambovita, from its own OSM way, as far as Piata Unirii where it goes under the square
const RIVER = [[-1700, 1200], [-1169, 1360], [-1059, 1417], [-812, 1460], [-272, 1513], [-122, 1527], [13, 1558], [95, 1624], [302, 1895], [366, 1935], [549, 1952], [626, 1977]];
// Where the road crosses it: Podul Natiunile Unite
const onBridge = (x, z) => x > 90 && x < 280 && z > 1640 && z < 1860;
for (const q of ROUTE) {
  if (q.mark) MARK[q.mark] = POINTS.length;
  const b = onBridge(q.x, q.z);
  POINTS.push({ p: [q.x * MAP, Math.max(q.y, 1.2) + (b ? 0.8 : 0), q.z * MAP], w: q.w, bank: q.w >= 12 ? 3 : 2, surface: q.surface || 'asphalt', tag: b ? 'bridge' : null });
}
// a junction is wider than the streets that meet in it: at a real corner the road opens by a car's width, and that is where the good line comes from
{
  const N = POINTS.length, wide = new Set(), head = (a, b) => Math.atan2(b.p[2] - a.p[2], b.p[0] - a.p[0]);
  for (let i = 0; i < N; i++) {
    const turn = Math.abs(((head(POINTS[(i - 1 + N) % N], POINTS[i]) - head(POINTS[i], POINTS[(i + 1) % N])) * 180 / Math.PI + 540) % 360 - 180);
    if (turn > 30) for (let k = -1; k <= 1; k++) wide.add((i + k + N) % N);
  }
  for (const i of wide) POINTS[i].w += 2;
}
// from a mark and metres along it to a share of the lap, on the polyline: close enough for what the player sees
const cum = [0];
for (let i = 0; i < POINTS.length; i++) { const a = POINTS[i].p, b = POINTS[(i + 1) % POINTS.length].p; cum.push(cum[i] + Math.hypot(b[0] - a[0], b[2] - a[2])); }
const LAP = cum[POINTS.length], U = (name, off = 0) => (((cum[MARK[name]] + off) / LAP) % 1 + 1) % 1;

// the mix of the city: old saloons everywhere, boulevard buses, vans, and a courier on a scooter here and there. Lively, not Jakarta.
const CARS = { saloon: 5, car: 3, mpv: 1 }, OLD = { saloon: 6, car: 1.5 }, BOULEVARD = { saloon: 3, car: 3, mpv: 1.2, bus: 0.8 }, BIKE = { motor: 1 };
const lanes = [];
const L = (from, to, d, mix, o = {}) => lanes.push({ from, to, d, mix, speed: 10, gap: 42, fill: 0.46, weave: 0.08, ...o });
// a boulevard: two car lanes, a courier between them
const bvd = (from, to, off = 4, o = {}) => {
  L(from, to, -off, BOULEVARD, { speed: 11, gap: 44, fill: 0.42, ...o });
  L(from, to, off, CARS, { speed: 9.5, gap: 50, fill: 0.42, ...o });
  L(from, to, 0.4, BIKE, { speed: 14, gap: 90, fill: 0.34, weave: 0.5 });
};
bvd(['start', 40], ['constitutiei', -50], 4.4, { fill: 0.28 });
L(['splai', 30], ['victoriei', -40], -2.6, CARS, { speed: 10, gap: 48, fill: 0.4 });
// Calea Victoriei: one lane's worth of old cars, slow, and a bus you must get round. Past the square as past everything else, at a walk
L(['victoriei', 10], ['elisabeta', -10], -2, OLD, { speed: 7.5, gap: 56, fill: 0.34 });
L(['ateneu', 40], ['cantacuzino', 180], 2, OLD, { speed: 8, gap: 60, fill: 0.34 });
L(['stirbey', 30], ['vest', -30], -2.2, { saloon: 4, bus: 0.5 }, { speed: 8, gap: 70, fill: 0.3 });
bvd(['kiseleff', 20], ['arc', -40], 3.4, { fill: 0.36 });
bvd(['gaulle', 170], ['est', -20], 3.4, { fill: 0.36 });
bvd(['est', 40], ['romana', -30], 3.4, { fill: 0.4 });
bvd(['romana', 40], ['universitate', -24], 3.8, { fill: 0.46 });
bvd(['universitate', 30], ['unirii', -30], 3.8, { fill: 0.5 });
bvd(['bulevard', 44], ['bulevard', 80], 4.4, { fill: 0.26 }); // the fountains want to be seen

const TRAFFIC = {
  jams: [
    { from: ['lucrari', 80], to: ['magheru', 120], k: 0.6 },
    { from: ['universitate', -80], to: ['universitate', 60], k: 0.55 }, // everyone at the lights of Universitate
    { from: ['bratianu', 80], to: ['unirii', -20], k: 0.6 },
  ],
  lanes,
  // the tram across Bulevardul Unirii at Bulevardul Regina Maria: lines 7, 27 and 47 go under the arch of nothing and stop for no one
  crossings: [{ at: ['bulevard', 34], period: 30, warn: 4.5, pass: 4.5, half: 9, trainLen: 28 }],
  train: 'tram',
};

const DEF = {
  id: 'bucarest', region: 'romania',
  long: { statics: 700, detail: 240, groundNear: 230, roadNear: 250 },
  roadRange: [7, 20],
  names: { it: 'Bucarest Sera d\'Oro', en: 'Bucharest Golden Evening' },
  blurb: {
    it: 'Sette chilometri di Bucarest vera al tramonto: le fontane di Unirii verso il Parlamento, Calea Victoriei, l\'Arco di Trionfo, il lago di Herăstrău, e le tubature del riscaldamento che sbuffano.',
    en: 'Seven kilometres of the real Bucharest at sunset: the Unirii fountains toward the Parliament, Calea Victoriei, the Arch of Triumph, the Herăstrău lake, and the heating mains letting off steam.',
  },
  points: POINTS,
  marks: MARK,
  mapScale: MAP,
  traffic: TRAFFIC,
  // the left lane of Unirii under the fountains, Kiseleff under the chestnuts, Magheru with its neon
  boostPads: [{ u: U('kiseleff', 90), offset: 0 }, { u: U('aviatorilor', 120), offset: -0.3 }, { u: U('bulevard', 90), offset: -0.35 }, { u: U('romana', 50), offset: 0.3 }],
  // the plates over the trench where the heating main is being dug up (Aviatorilor), the hump of the Podul Natiunile Unite, and the park's service road over the old sluice by the lake
  jumps: [{ u: U('aviatorilor2', -70), strength: 1.1 }, { u: U('splai', 150), strength: 0.7 }, { u: U('parc', 60), strength: 0.8 }],
  zones: [],
  boxesAcross: 3,
  // bands by hand, in the shape of the auto ones: every 500 m, none in Piata Revolutiei: nothing is thrown about at the memorial, and no crate stands before it
  itemBands: Array.from({ length: 14 }, (_, b) => (b + 0.5) / 14).map((u) => { const a = U('elisabeta', 50), z = U('ateneu', 40); return u > a && u < z ? (u - a < z - u ? a - 0.003 : z + 0.003) : u; }),
  // through the park: the straight alley that leaves out the shore of the lake; gravel, narrow, under the limes. And one by the Ateneu's own garden? No: the Ateneu keeps its garden.
  shortcuts: [{ from: U('parc', 20), to: U('gaulle', 90), points: [[-700, -2640, 19], [-560, -2620, 18.5], [-400, -2600, 18]].map(([x, z, y]) => [x * MAP, y, z * MAP]), surface: 'dirt', w: 6.5 }],
  // the city's heating mains: a burst in Catargiu, one on Magheru, one on Bratianu. Big, loud, a cartoon: a geyser of steam, and no one is ever hurt
  hazards: [
    { kind: 'steam', u: U('catargiu', 120), width: 1, period: 7, phase: 0 },
    { kind: 'steam', u: U('lucrari', 40), width: 1, period: 8, phase: 0.35 },
    { kind: 'steam', u: U('bratianu', 60), width: 1, period: 7, phase: 0.7 },
  ],
  disasters: [
    { kind: 'banjir', u: U('balcescu', 90), side: 1, name: 'Magistrala RADET', say: { it: 'Salta la magistrale del riscaldamento: acqua calda e vapore, resta sul lato libero!', en: 'The heating main has gone: hot water and steam, keep to the free side!' } },
  ],
  // Nothing is ever thrown at a church, nor at the memorial: Cretulescu, Zlatari, Domnita Balasa, Sfantul Gheorghe, the Patriarchate, the Memorial of Rebirth
  sacred: [[44.4398, 26.0955, 40], [44.4338, 26.0975, 40], [44.42824, 26.10025, 50], [44.4325, 26.1045, 40], [44.42357, 26.09557, 80], [44.43889, 26.09745, 70]].map(([la, lo, r]) => ({ x: (lo - 26.0925) * 79467 * MAP, z: -(la - 44.447) * 110950 * MAP, r })),
  ground: {
    base: 0, hills: 0.03, hillScale: 300, rimHeight: 64, rimFrom: 1150, rimTo: 1200, water: -4.2, dry: true, displayRise: 0.02,
    river: { w: 30, depth: 2.5, walled: true, points: RIVER.map(([x, z]) => [x * MAP, z * MAP]) },
    // the basin of the lake of Herastrau, whose water is in the landmarks at its own level; and the Dealul Spirii, the hill the Parliament was built on
    shape: (x, z) => {
      const lx = (x + 350) / 277, lz = (z + 1765) / 185, q = lx * lx + lz * lz;
      const lake = q < 1.14 ? -3 * Math.min(1, (1.14 - q) / 0.2) : 0;
      const hx = (x + 330) / 220, hz = (z - 1110) / 200;
      return lake + 6 * Math.exp(-(hx * hx + hz * hz));
    },
  },
  grid: { spacing: 4 },
  horizon: { center: [44.447, 26.0925], northDeg: 0, exaggerate: 1, peak: 1, scale: 18, altitude: 85, panelDistance: 16000 },
  // tools/panoramas/bucarest-paint.py
  backdrops: [
    {"file": "bucarest-pano-000.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#ecd4ac", "bearing": 0, "elevation": 0, "row": 0.92},
    {"file": "bucarest-pano-060.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#ecd4ac", "bearing": 60, "elevation": 0, "row": 0.92},
    {"file": "bucarest-pano-120.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#ecd4ac", "bearing": 120, "elevation": 0, "row": 0.92},
    {"file": "bucarest-pano-180.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#ecd4ac", "summit": {"name": "Palatul Parlamentului", "lat": 44.4275, "lon": 26.0843, "altitude": 170, "u": 0.77035, "row": 0.67446}, "elevation": 9.1, "compressed": "true 2.3 deg from the middle of the lap: a long lens over the roofs from the southbound half, the size it fills down a straight street"},
    {"file": "bucarest-pano-240.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#ecd4ac", "bearing": 240, "elevation": 0, "row": 0.92},
    {"file": "bucarest-pano-300.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#ecd4ac", "bearing": 300, "elevation": 0, "row": 0.92}
  ],
  look: {
    // an hour before sunset, the sun low behind the Parliament: warm on every east west street, long shadows along the boulevards
    sun: { azimuth: 258, elevation: 17, color: '#ffd9a2', intensity: 3.1, wrap: [-0.24, 0.66] },
    hemi: { sky: '#d6e2ee', ground: '#c4ab8e', intensity: 2.3 },
    sky: {
      stops: [[-8, '#f7dcab'], [0, '#f8dfb0'], [5, '#f8e2ba'], [9, '#f3e6c8'], [14, '#dfe6d8'], [20, '#bfdbe2'], [30, '#9fcbe2'], [45, '#82b9dd'], [65, '#6fa9d6']],
      glow: '#ffe6b8', glowStrength: 0.6, glowWidth: 0.42,
      clouds: { amount: 0.4, scale: 1.1, lit: '#fff0d8', shade: '#d5c0c4', speed: 0.004 },
    },
    shadeFine: { bias: 0.5 },
    kartShadow: [0.08, 0.05, 0.1, 0.6], trafficShadow: [0.07, 0.05, 0.09, 0.6],
    fog: { color: '#f6dcb2', density: 0.00038, heightFalloff: 0.004, max: 0.66 },
    mist: { from: 480, to: 1150, amount: 0.86, ring: 0.9 },
    terrain: {
      meadowY: '#a3b45a', meadow: '#8aaa52', meadowF: '#7a9e4c', meadowD: '#6c9248', forest: '#3f7a48', forestMix: 0.75, verge: '#b8a88a',
      facetTone: 0.03, facetTilt: 0.04, patch: { size: 34, tone: 0.05 }, grass: [0.05, 0.03],
      rock: '#a8a094', rockB: '#968e82', rockSlope: [55, 70],
      bank: '#b9b2a2', bankD: '#9e9788', bankWet: '#7d786a', bed: '#6f8f6f', bankHeight: 3.4,
    },
    stone: { color: '#d8cfba', dark: '#aca38f', wall: '#bcb39e' },
    water: { deep: '#5f8f96', base: '#78a8a6', light: '#a6c8b4', far: '#d8cfa8', foam: '#f4ecd4', flow: 0.25, facetTone: 0.03 },
    horizon: { rock: '#9c98ac', rockB: '#8c8aa2', scree: '#a4a0b4', grass: '#8ca49a', forest: '#7c9490', gold: '#8ca49a', haze: '#f6dcb2', hazeNear: 1500, hazeFar: 26000, hazeMax: 0.85, shade: '#a4aec0', strataTone: 0.02, ink: 0.08 },
    trees: {
      kinds: [
        { name: 'chestnut', shape: 'round', share: 0.5, height: [10, 16], width: 1.05, colors: ['#6fa448', '#7cae4c', '#5f9842', '#8ab850'] },
        { name: 'lime', shape: 'round', share: 0.34, height: [8, 14], width: 1, colors: ['#9abb50', '#88b04c', '#a8c258'] },
        { name: 'poplar', shape: 'conifer', share: 0.16, height: [13, 22], width: 0.36, colors: ['#5a9048', '#6a9c4c', '#4e8444'] },
      ],
      density: 0.6, spacing: 14, cover: -1, far: 620, maxSlope: 50, nearScale: 0.9, roadGap: 6, mottle: 0.1, trunk: '#6e5642', roundLods: [{ lumps: 9, segs: 10, rings: 5 }, { lumps: 5, segs: 7, rings: 3 }, { lumps: 3, segs: 6, rings: 3 }, null],
    },
    rocks: { color: '#8a8a84', count: 0 },
    road: { repair: 0, wear: 0.55, cracks: 0.5, grit: 0.2, glare: ['#ffdca8', 0.55], sett: 3.4, noKerbOn: 'asphalt', jumpMarks: false, asphalt: '#6a6570', dirt: '#c9b48a', cobble: '#958b7c', wood: '#a88c62', line: '#fbf3dc', kerb: ['#b8ae9c', '#b8ae9c'], shoulder: '#c2b8a2', verge: '#ad9f88', kerbW: 0 },
    outline: { color: '#4a3c40', strength: 0.42, width: 1.2, threshold: [0.06, 0.14], minGap: 0.6, fade: [120, 620] },
    softPuff: 1,
    camera: { fov: 54, fovFast: 68, near: 0.5, far: 7000 },
  },
  music: 'romania',
  landmarks: 'bucarest',
};

export default DEF;
