// Cortina e il Giau: Cortina d'Ampezzo and the Passo Giau in autumn. Real places on their true bearings: x is east, -z is true north, the origin is Pocol.
// The lap is the real circuit (36 km of Corso Italia, SS51, SR48, SP638) squeezed to 0.25 of the map, with hairpins kept at driving size, so it folds to 8 km.
// y is the real altitude from the Copernicus DEM along that road, 0.28 m per metre over Zuel's 1120 m: 310 m of climb, the character of the place.
// Corso Italia under the bell tower, south down the Boite to Zuel, under the in-run of the Trampolino Italia, up the Pocol hairpins, the woods to Ru Curto,
// the ladder of the Giau to the pass at 2236 m under Ra Gusela, then fast through the meadows and the larch back down to the Corso, with the Tofane ahead.
// Facts: docs/references/cortina.md.
import { RELIEF } from '../cortina-relief.js';

const K = 0.9, G = 0.955, W = 8.4, BEND = 10.4;
// the real map (metres from Pocol) at this scale is the world; a real altitude is (h - level) * yScale
export const WORLD = { map: 0.29 * K * G, level: 1120, yScale: 0.28, origin: [46.5246, 12.1146] };
const POINTS = [], MARK = {};
const mark = (name) => { MARK[name] = POINTS.length; };
// abs metres
const A = (e, n, y, w = W, surface = 'asphalt', tag = null, bank = 0) => { POINTS.push({ p: [e * G, y, -n * G], w, bank, surface, tag }); };
// metres on the true map before the last squeeze
const P = (e, n, y, w, surface, tag, bank) => A(e * K, n * K, y, w, surface, tag, bank);
const dir = (b) => { const r = b * Math.PI / 180; return [Math.sin(r), Math.cos(r)]; };
// A ladder of legs on bearing `leg` and its opposite, climbing toward `up`, joined by half circles of radius r. Rise is shared by road length.
const ladder = (e0, n0, leg, up, lens, r, y0, y1) => {
  const [ue, un] = dir(up), [ve, vn] = dir(leg), arc = Math.PI * r;
  const total = lens.reduce((s, l) => s + l, 0) + arc * (lens.length - 1), rate = (y1 - y0) / total;
  let e = e0, n = n0, y = y0, sgn = 1;
  lens.forEach((len, i) => {
    A(e, n, y);
    if (len > 90) { A(e + ve * sgn * len * 0.5, n + vn * sgn * len * 0.5, y + rate * len * 0.5); }
    e += ve * sgn * len; n += vn * sgn * len; y += rate * len;
    if (i === lens.length - 1) { A(e, n, y); return; }
    const c = [e + ue * r, n + un * r];
    for (const t of [0, 45, 90, 135]) {
      const a = t * Math.PI / 180, w = t === 90 ? BEND : t === 0 ? 9 : 9.8;
      A(c[0] - ue * r * Math.cos(a) + ve * sgn * r * Math.sin(a), c[1] - un * r * Math.cos(a) + vn * sgn * r * Math.sin(a), y + rate * r * a, w, 'asphalt', t === 90 ? 'hairpin' : null, t === 90 ? 5 : 3.5);
    }
    e = c[0] + ue * r; n = c[1] + un * r; y += rate * arc; sgn = -sgn;
  });
};

// Corso Italia, south east: stone paving, the bell tower on the right
mark('start');
P(440, 500, 30, 9.6, 'cobble'); P(510, 417, 29.5, 9.6, 'cobble'); P(590, 322, 29, 9.6, 'cobble');
// Via Roma, Via La Riva, the SS51: down the Boite past the shops, the hotels, the stadium
mark('roma');
P(640, 262, 26); P(628, 170, 22, 9.4); P(676, 90, 17); P(658, -10, 12, 9.4); P(712, -100, 8); P(690, -210, 6, 9.4); P(722, -300, 4);
// Zuel: under the in-run of the Trampolino Italia, its landing hill on the right
mark('zuel');
P(715, -385, 3); P(730, -445, 3);
// round the foot of the out-run and away north west on the far bank
mark('turn');
P(716, -496, 3.5, 9.6, 'asphalt', null, 3); P(670, -516, 4, BEND, 'asphalt', null, 5); P(626, -486, 5, 9.6, 'asphalt', null, 3); P(600, -430, 6);
P(540, -372, 10); P(470, -332, 19); P(404, -286, 28);
// the Pocol hairpins
mark('pocolLadder');
ladder(306, -238, 218, 308, [78, 78, 78, 78], 22, 36, 88);
mark('pocol');
P(208, -136, 91); P(122, -78, 104); P(44, -28, 115);
// the woods: Pocol to Ru Curto, nearly level, bend after bend
mark('woods');
P(-40, -60, 118); P(-130, -90, 120); P(-190, -170, 121); P(-280, -190, 122); P(-340, -270, 123); P(-420, -290, 124);
// Ru Curto: the first stack of the Giau, the torrent under it
mark('rucurto');
A(-434, -296, 125); A(-460, -322, 125.5);
ladder(-462, -352, 132, 222, [30, 92, 92, 72], 24, 126, 160);
A(-616, -426, 162); A(-644, -458, 165); A(-654, -520, 171); A(-716, -590, 178);
// the great ladder under the Muraglia del Giau, cyclists and falling stones
mark('ladder');
ladder(-765, -666, 295, 205, [92, 105, 105, 105, 105, 105], 22, 184, 258);
// out over the tree line, the meadows of the Malga swing wide
mark('meadow');
A(-792, -920, 262); A(-800, -1010, 268); A(-868, -1078, 276); A(-960, -1100, 284); A(-1040, -1120, 291);
A(-1107, -1161, 298); A(-1150, -1225, 305); A(-1195, -1255, 310);
// the pass: 2236 m, the rifugio on the left, the road turns north
mark('pass');
A(-1240, -1238, 312, 9.6); A(-1268, -1180, 311, 9.6); A(-1285, -1110, 306);
// and down: the Tofane ahead, meadows, then larch, then spruce, each bend flowing into the next
mark('descent');
A(-1320, -1040, 298); A(-1305, -960, 288); A(-1350, -880, 278); A(-1320, -790, 268); A(-1255, -720, 258); A(-1230, -630, 246);
A(-1150, -575, 235); A(-1100, -470, 222); A(-985, -340, 200); A(-890, -300, 190); A(-840, -215, 180);
A(-745, -175, 168); A(-700, -80, 157); A(-590, -60, 146); A(-540, 45, 134); A(-430, 60, 122); A(-385, 175, 110);
A(-270, 180, 98); A(-210, 290, 84); A(-90, 300, 72); A(-40, 400, 62); A(90, 400, 52); A(170, 490, 44); A(250, 470, 40);
mark('ronco');
A(310, 510, 34);

const clamp = (t) => Math.max(0, Math.min(1, t));
const end = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// The sim's world keeps every kart in with its corners over the road; the panorama closes the view, so the landmarks take them off the drawn ground (world.groundDrop).
const X = [-2050, 1250], Z = [-750, 2000];
export const cornerHills = (x, z) => {
  let v = 0;
  for (const cx of X) for (const cz of Z) v += 560 * end(620, 240, Math.hypot(x - cx, z - cz));
  return v;
};
// the real land, DEM on the same squeeze, as relief over the road's own height (tools/panoramas/cortina-relief.mjs)
let reliefData = null;
const relief = (x, z) => {
  if (!RELIEF) return 0;
  if (!reliefData) { const b = atob(RELIEF.data), a = new Int16Array(b.length / 2); for (let i = 0; i < a.length; i++) a[i] = (b.charCodeAt(2 * i) | (b.charCodeAt(2 * i + 1) << 8)) << 16 >> 16; reliefData = a; }
  const u = (x - RELIEF.x0) / RELIEF.step, v = (z - RELIEF.z0) / RELIEF.step, i = Math.floor(u), j = Math.floor(v), { w, h } = RELIEF;
  if (i < 0 || j < 0 || i >= w - 1 || j >= h - 1) return 0;
  const f = u - i, g = v - j, k = j * w + i;
  return ((reliefData[k] * (1 - f) + reliefData[k + 1] * f) * (1 - g) + (reliefData[k + w] * (1 - f) + reliefData[k + w + 1] * f) * g) / 10;
};

const DEF = {
  id: 'cortina', region: 'cadore',
  long: { statics: 780, detail: 300 },
  roadRange: [8, 11],
  names: { it: 'Cortina e il Giau', en: 'Cortina and the Giau' },
  blurb: {
    it: "Otto chilometri d'autunno: dal Corso di Cortina sotto il campanile, sotto il vecchio trampolino di Zuel, su per i tornanti di Pocol e del Giau fino a 2236 metri, e giù di volata tra i larici d'oro.",
    en: 'Eight kilometres of autumn: from Cortina under the bell tower, beneath the old ski jump at Zuel, up the hairpins of Pocol and the Giau to 2236 metres, and flat out down through the golden larches.',
  },
  points: POINTS,
  marks: MARK,
  boostPads: [{ u: 0.022, offset: 0 }, { u: 0.292, offset: 0.3 }, { u: 0.595, offset: -0.2 }, { u: 0.728, offset: 0.2 }, { u: 0.815, offset: -0.2 }, { u: 0.925, offset: 0.2 }],
  // a hump over the Boite after the Trampolino, the crest over the meadow with the Tofane ahead
  jumps: [{ u: 0.1495, strength: 0.9 }, { u: 0.712, strength: 0.9 }],
  boxesAcross: 3,
  zones: [],
  // the cart track across the pasture of the Malga: the road swings wide round it, the track goes straight
  shortcuts: [{ from: 0.545, to: 0.595, points: [[-884, 265, 917]], surface: 'dirt', w: 7 }],
  hazards: [
    { kind: 'cows', u: 0.6, width: 1, period: 9, phase: 0 },
    { kind: 'cows', u: 0.738, width: 1, period: 10, phase: 0.5 },
  ],
  // friendly stones off the walls of the upper hairpins
  disasters: [
    { kind: 'rockfall', u: 0.478, name: 'Sassi sul Giau', say: { it: 'Cadono sassi sui tornanti!', en: 'Stones on the hairpins!' }, side: 1, gully: { color: ['#8f8078', '#7a6c6c'], lump: '#6a5f60' } },
    { kind: 'rockfall', u: 0.53, name: 'Sassi sul Giau', say: { it: 'Altri sassi dalla Muraglia!', en: 'More stones off the Muraglia!' }, side: -1, gully: { color: ['#8f8078', '#7a6c6c'], lump: '#6a5f60' } },
  ],
  // the basilica and its tower on the Corso, the ossuary above Pocol: nothing is ever thrown at them
  sacred: [{ u: 0.0135, d: 28, r: 44 }, { x: 44, z: -66, r: 40 }],
  ground: {
    base: 0, hills: 4, hillScale: 160, rimHeight: 0, rimFrom: 200, rimTo: 700, water: -30, displayRise: 0.3,
    shape: (x, z) => relief(x, z) + cornerHills(x, z),
  },
  grid: { spacing: 4 },
  horizon: { center: [46.513, 12.09], northDeg: 0, exaggerate: 1, peak: 1, scale: 18, altitude: 1565, panelDistance: 16000 },
  // written by tools/compose-panorama.py with tools/panoramas/cortina.json
  backdrops: [{"file": "cortina-pano-000.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#6d7aa0", "summit": {"name": "Tofana di Mezzo", "lat": 46.5456, "lon": 12.0655, "altitude": 3244, "u": 0.05916, "row": 0.25329}, "elevation": 23.5, "compressed": "true 22 deg, the top of the chase frame"}, {"file": "cortina-pano-060.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#6d7aa0", "bearing": 60, "elevation": 0, "row": 0.92}, {"file": "cortina-pano-120.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#6d7aa0", "summit": {"name": "Antelao", "lat": 46.4519, "lon": 12.2618, "altitude": 3264, "u": 0.45571, "row": 0.59408}, "elevation": 12, "compressed": "true 6.5 deg, raised so that it stands at the end of the Corso as it does from the town"}, {"file": "cortina-pano-180.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#6d7aa0", "summit": {"name": "Pelmo", "lat": 46.42, "lon": 12.1347, "altitude": 3168, "u": 0.20429, "row": 0.5377}, "elevation": 14, "compressed": "true 8.4 deg, raised so that it still stands over the woods of the Boite at the end of Via Roma"}, {"file": "cortina-pano-240.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#6d7aa0", "summit": {"name": "Ra Gusela", "lat": 46.4907, "lon": 12.051, "altitude": 2595, "u": 0.34351, "row": 0.23732}, "elevation": 24, "compressed": "true 14.7 deg from Ru Curto, the same mountain is 24 deg over the pass itself, and that is what the road sees it as"}, {"file": "cortina-pano-300.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#6d7aa0", "bearing": 300, "elevation": 0, "row": 0.92}],
  look: {
    // late October, the last sun low from the south west, the same hour as the paintings: rose on the rock, gold on the larch
    sun: { azimuth: 245, elevation: 18, color: '#ffd29c', intensity: 3.4, wrap: [-0.22, 0.62] },
    hemi: { sky: '#dcbcc6', ground: '#c4a878', intensity: 2.0 },
    staticRim: [0.022, 4],
    sky: {
      stops: [[-8, '#fbcfae'], [2, '#fbc4b2'], [9.4, '#fbc2b5'], [11.3, '#eec1bc'], [13.2, '#dfbfc6'], [15, '#cdbad0'], [16.8, '#b9b5d9'], [18.6, '#abafdd'], [20.3, '#9faae0'], [23.7, '#91a5e0'], [45, '#7d93de']],
      glow: '#ffc2a8', glowStrength: 0.5, glowWidth: 0.4,
      clouds: { amount: 0 },
    },
    fog: { color: '#a59cc0', density: 0.00014, heightFalloff: 0.002, max: 0.38 },
    mist: { from: 110, to: 800, amount: 0.6, ring: 0 },
    terrain: {
      // the mown gold of the painted meadows of the Giau
      meadowY: '#d2ab58', meadow: '#c79e50', meadowF: '#b88f4a', meadowD: '#a07e46', forest: '#3a5a60', forestMix: 0.9, facetTone: 0.02, facetTilt: 0.025, patch: { size: 70, tone: 0.06 }, verge: '#b59a56', grass: [0.1, 0.1], detail: { stone: 0, stones: 0, tufts: 0.4 },
      wood: { from: 420, to: 820, amount: 1, dark: '#2c4a5e', light: '#4f7476', gold: '#d09a44' },
      rock: '#c4a89c', rockB: '#a48c8c', rockStrata: { spacing: 2.2, tone: 0.35, wobble: 0.8 }, coverNoise: [7, 0.8], snow: '#fdf9f4', rockSlope: [52, 66],
      bank: '#c9c0ae', bankD: '#a39b8e', bankWet: '#7d7a72', bed: '#a6c3c4', bankHeight: 2.8,
    },
    stone: { color: '#b8ad9c', dark: '#8c867e', wall: '#8f8a84', scale: 1.7 },
    kartShadow: [0.035, 0.025, 0.06, 0.92], kartShadowScale: 1.22, shotShadow: true,
    deck: { span: 15, pier: 2.4, rail: '#3f6e55', weather: 1 },
    water: { deep: '#5f9490', base: '#7dafa8', light: '#a4cbc2', far: '#a8c8c0', foam: '#eef2ea', bar: '#d6cdb8', channel: 3 },
    horizon: { rock: '#d8c6bb', rockB: '#c6a0ac', scree: '#d2b4b4', grass: '#9c9aa0', forest: '#6d7c8e', gold: '#9a8f92', haze: '#e4c6c4', hazeNear: 1200, hazeFar: 17000, hazeMax: 0.8, shade: '#b0a0cc', strataTone: 0.05, ink: 0.12 },
    trees: {
      kinds: [
        { name: 'spruce', shape: 'conifer', share: 0.42, height: [13, 24], width: 0.8, colors: ['#2a5a4c', '#265348', '#214b43', '#336456'] },
        { name: 'fir', shape: 'conifer', share: 0.1, height: [14, 26], width: 0.62, colors: ['#25505a', '#2c5a62', '#204850'] },
        { name: 'larch', shape: 'larch', share: 0.48, height: [11, 21], width: 0.8, colors: ['#e0ae48', '#eabf58', '#cf9a40', '#e8b84c', '#dcb054'] },
      ],
      density: 0.76, cover: 0.2, far: 520, maxSlope: 56, drift: 45, nearScale: 0.72, roadGap: 8, farGold: 0.55,
    },
    rocks: { color: '#b8a69c', count: 60 },
    road: { asphalt: '#5f5e60', dirt: '#c2a878', cobble: '#9c9488', sett: 5, noKerbOn: 'cobble', line: '#ece5cf', kerb: ['#6a6868', '#6e6c6b'], kerbW: 0.3, shoulder: '#8f8466', verge: '#b59a56', wobble: 0.45, wear: 0.5, cracks: 0.08, moundRock: '#8f877b', moundColor: '#a08a50', gravel: 0.5, lineWear: 0.3, edgeSink: 0.18, repair: 0.4 },
  },
  music: 'cadore',
  landmarks: 'cortina',
};

export default DEF;
