// Bran sotto la Luna: a friendly moonlit night in the Bran pass. The road is drawn in valley coordinates: `a` runs at Omu, the top of the Bucegi wall, `b` is to its left.
// The great mountains are painted from their real ground, tools/panoramas/bran-paint.py and bran.json: Omu at 121, La Om at 286.5, each at its true bearing. A road turned to north 31 keeps one of them ahead on 64% of the lap, and no other north beats it.
// horizon.northDeg turns them against the real mountains: driving +a looks at the Bucegi with the castle in front of them, as in the classic photo from the hill behind the
// castle, driving -a at the long ridge of Piatra Craiului. The real order holds: the castle stands between the road and the Bucegi. The distances are a cartoon, see docs/references/bran.md.
//
// The lap, in the order it is driven:
//   Bran's market street, straight at the castle and the moon, and under a stone arch you will cross a minute later. Round the foot of the castle rock, climbing all the way
//   with the castle over your left shoulder, out over that arch and over the Turcu. Up through the dark firs where the bats live, along the high pasture with its hay and its
//   crest, past the rocks of Babele and the Sphinx, the far hairpin, down over the gorge bridge and through the Saxon village under the great carved gate, home to the market.

const NORTH = 31, SHORT_FROM = 0.725, SHORT_TO = 0.785;
const end = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const xz = (a, b) => [a, -b];
const P = (a, b, y, w, surface = 'asphalt', tag = null, bank = 0) => ({ p: [a, y, -b], w, bank, surface, tag });
// the castle rock
// a: where it stands along the valley, b: across it, r: how far its foot reaches, top: y of its top, on which the castle stands; h: how high the ground under it climbs, the rest is the crag in the landmarks
const CHURCH = [-148, 106];
const ROCK = { a: 340, b: 100, r: 112, top: 42, h: 8 };

export default {
  id: 'bran', region: 'romania',
  rock: ROCK,
  // the disc of the moon, a sprite in the landmarks; its glow is in the panorama, at the same place
  moon: { bearing: 96, elevation: 18.5, radius: 3.3 },
  names: { it: 'Bran sotto la Luna', en: 'Bran under the Moon' },
  blurb: {
    it: 'Dal mercato di Bran attorno alla rupe del castello, sopra il tuo stesso arco, su tra gli abeti e i pipistrelli, oltre Babele e la Sfinge e giù nel villaggio sassone.',
    en: "From Bran's market round the castle rock, over your own arch, up through the firs and the bats, past Babele and the Sphinx and down into the Saxon village.",
  },
  points: [
    // the market street: straight at the castle and the moon, under the arch
    P(0, 0, 0, 11.5),
    P(80, 1, 0.2, 11.5),
    P(150, -2, 0.6, 11.5),
    P(215, -8, 1, 11.5),
    // the castle ring: always turning left, always climbing, the rock on your left hand
    P(275, -6, 1.6, 11, 'asphalt', null, 4),
    P(330, 3, 2.6, 11, 'asphalt', null, 6),
    P(395, 22, 4, 11, 'asphalt', null, 8),
    P(432, 75, 5.6, 11, 'asphalt', null, 8),
    P(428, 135, 7.2, 11, 'asphalt', null, 8),
    P(385, 183, 8.8, 11, 'asphalt', null, 8),
    P(325, 195, 10.4, 11, 'asphalt', null, 8),
    P(268, 165, 12, 11, 'asphalt', null, 7),
    P(240, 110, 13.6, 11.5, 'asphalt', null, 5),
    P(225, 58, 15, 11.5),
    // the arch: over the market street you started on, and over the Turcu
    P(212, 20, 16, 10.5, 'cobble', 'viaduct'),
    P(207, -12, 16.6, 10.5, 'cobble', 'viaduct'),
    P(205, -42, 17, 10.5, 'cobble', 'viaduct'),
    P(204, -72, 17.4, 10.5, 'cobble', 'viaduct'),
    P(202, -94, 18, 10.5, 'asphalt'),
    // the firs: long sweepers, up and over a dip, Piatra Craiului comes up ahead between the trunks
    P(182, -124, 20.4, 11, 'asphalt', null, 6),
    P(150, -148, 22.6, 11, 'asphalt', null, 7),
    P(105, -162, 25, 11, 'asphalt', null, 6),
    P(40, -146, 27, 11, 'asphalt', null, 6),
    P(-25, -128, 22.5, 11, 'asphalt', null, 6),
    P(-85, -146, 26, 11, 'asphalt', null, 6),
    P(-130, -176, 29.5, 11, 'asphalt', null, 5),
    // the high pasture: open, flat out, hay on both sides, the crest throws you off it
    P(-175, -178, 31.5, 12.5, 'dirt'),
    P(-222, -160, 33, 12.5, 'dirt', 'jump'),
    P(-270, -170, 30.5, 12.5, 'dirt'),
    P(-312, -178, 29.5, 11, 'dirt', null, 6),
    // Babele and the far hairpin, with the track between the stones cutting inside it
    P(-360, -170, 28, 11, 'dirt', null, 8),
    P(-388, -130, 24.5, 12, 'asphalt', 'hairpin', 8),
    // the gorge: a tall stone bridge over the Turcu
    P(-374, -96, 21.8, 10.5, 'cobble', 'bridge'),
    P(-368, -60, 19.6, 10.5, 'cobble', 'bridge'),
    P(-356, -20, 17.6, 10.5, 'cobble', 'bridge'),
    P(-338, 8, 15.4, 11, 'asphalt', null, 7),
    P(-302, 36, 13, 11, 'asphalt', null, 7),
    // the Saxon village: long pastel houses gable to the street, the great carved gate across the road, the street bends round the fortified church
    P(-252, 48, 11, 11.5, 'cobble'),
    P(-205, 40, 9, 11.5, 'cobble'),
    P(-155, 22, 6.5, 11.5, 'cobble', null, 4),
    P(-105, 18, 4, 11.5, 'cobble', null, 4),
    // down to the market
    P(-55, 6, 1.6, 11.5),
  ],
  itemBands: [0.075, 0.385, 0.665, 0.865],
  boostPads: [{ u: 0.335, offset: 0 }, { u: 0.598, offset: 0.3 }],
  jumps: [{ u: 0.633, strength: 1 }],
  zones: [],
  shortcuts: [
    // the track between the stones of Babele: inside the hairpin, narrow, dirt
    { from: SHORT_FROM, to: SHORT_TO, points: [[-332, 29, 150], [-356, 27, 122]], surface: 'dirt', w: 7 },
  ],
  hazards: [{ kind: 'bats', u: 0.54, width: 1, period: 8, phase: 0 }],
  // Cutremur di Vrancea: the real earthquakes come from the Vrancea bend, 100 km east. Here, cartoon: tiles off the market roofs, a crack in the street that shuts again, every lantern in the valley swinging. The castle and the church stand through all of it.
  disasters: [{ kind: 'quake', u: 0.045, name: 'Cutremur di Vrancea', say: { it: 'Terremoto! Evita la crepa', en: 'Earthquake! Mind the crack', ro: 'Cutremur! Ocolește crăpătura' } }],
  sacred: [{ u: 0.915, d: 82, r: 46 }],
  ground: {
    // flats: the market and the village stand on made ground, level with their street
    flats: [{ from: 0.83, to: 0.03, w: 32 }, { from: 0.03, to: 0.05, w: 26 }, { from: 0.05, to: 0.07, w: 16 }, { from: 0.07, to: 0.082, w: 10 }],
    base: 0, hills: 16, hillScale: 230, rimHeight: 200, rimFrom: 120, rimTo: 800, water: -9, displayRise: 0.6, dry: true, relax: 3,
    shape: (x, z) => {
      const a = x, b = -z, r = Math.hypot(a - ROCK.a, b - ROCK.b);
      // the castle's spur: the ground climbs under the crag of the landmarks, which stands on it
      const rock = ROCK.h * (1 - end(26, ROCK.r, r));
      // the low hill of the fortified church, so that its ring wall stands over the roofs
      const hill = 16 * (1 - end(34, 92, Math.hypot(a - CHURCH[0], b - CHURCH[1])));
      // the south flank the firs and the pasture climb
      const flank = 34 * end(-70, -190, b) * (1 - end(120, 420, a)) * end(-170, -40, a);
      // the valley floor dug out toward each great mountain, so that each stands at the end of its straights
      const open = (along, from) => { const w = 170 + 0.55 * Math.max(0, along - from); return end(from, from + 420, along) * (1 - end(w, w + 460, Math.abs(b - 40))); };
      // the pasture is a shelf: past it to the south-west the ground falls away, and the whole of Piatra Craiului stands over the drop
      const drop = end(10, 220, -(b + 190)) * end(0, 240, -(a + 90));
      return rock + hill + flank - 400 * Math.max(open(a, 560), open(-a, 620)) - (95 + 0.42 * Math.max(0, -(b + 190) - a * 0.3)) * drop;
    },
    river: {
      w: 20, depth: 2.2,
      points: [[1500, -260], [900, -170], [560, -110], [330, -56], [206, -42], [60, -64], [-120, -58], [-280, -66], [-368, -60], [-720, -40], [-1400, -130]].map(([a, b]) => xz(a, b)),
    },
  },
  grid: { spacing: 4 },
  // a pass road and a village street, with room for a pass and no more
  roadRange: [10.5, 13],
  // altitude: Copernicus GLO-30 at the center, the real height of y = 0. The hill west of Bran that sees both massifs (docs/references/romania.md).
  horizon: { center: [45.505, 25.3175], northDeg: NORTH, exaggerate: 1.6, peak: 1.1, scale: 18, altitude: 943 },
  // One painted panorama, closed all round, cut into tiles: tools/compose-panorama.py with tools/panoramas/bran.json writes the files and these lines. Sources and licences: assets/backdrops/CREDITS.md.
  backdrops: [
    {"file": "bran-pano-000.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#2e6a70", "bearing": 0, "elevation": 0, "row": 0.92},
    {"file": "bran-pano-060.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#2e6a70", "bearing": 60, "elevation": 0, "row": 0.92},
    {"file": "bran-pano-120.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#2e6a70", "summit": {"name": "Omu (Bucegi)", "lat": 45.4456, "lon": 25.4563, "altitude": 2505, "u": 0.52171, "row": 0.49477}, "elevation": 15.5, "compressed": "true 7 deg from the hill west of Bran, 9.5 from the castle itself: the real skyline raised by one factor and widened, as the long lens of the photo along the Rucar-Bran corridor"},
    {"file": "bran-pano-180.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#2e6a70", "bearing": 180, "elevation": 0, "row": 0.92},
    {"file": "bran-pano-240.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#2e6a70", "bearing": 240, "elevation": 0, "row": 0.92},
    {"file": "bran-pano-300.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#2e6a70", "summit": {"name": "La Om (Piatra Craiului)", "lat": 45.527, "lon": 25.2117, "altitude": 2238, "u": 0.28333, "row": 0.52346}, "elevation": 14.5, "compressed": "true 8.5 deg from the hill west of Bran: the real skyline raised by one factor, 1.7, as the long lens the massif is always photographed with"},
  ],
  look: {
    // the light of the moon, across the road on both its long legs; the light falls from the side of the moon, a little round from it, a licence a cartoon can take: fully backlit walls would show none of their windows
    sun: { azimuth: 152 - NORTH, elevation: 40, color: '#cfdaf0', intensity: 3.2, wrap: [-0.12, 0.66] },
    hemi: { sky: '#8498bc', ground: '#34443e', intensity: 1.5 },
    sky: {
      stops: [[-8, '#8ac4c0'], [0, '#8ac4c0'], [6, '#84c0bf'], [11, '#70b0ba'], [15, '#5f9fb0'], [19, '#44809f'], [22.5, '#2c6494'], [25.5, '#1c4c80'], [28.5, '#153a6c'], [35, '#102c5a'], [50, '#0c1f48']],
      glow: '#c8e4e6', glowStrength: 0.0, glowWidth: 0.4,
      clouds: { amount: 0 },
    },
    fog: { color: '#3a7078', density: 0.00052, heightFalloff: 0.004, max: 0.66 },
    mist: { from: 220, to: 1300, amount: 0.6, ring: 0 },
    staticRim: [0.035, 3],
    terrain: {
      meadowY: '#6f9068', meadow: '#5a8462', meadowF: '#4c745c', meadowD: '#3c6254', forest: '#163c40', forestMix: 0.92, facetTone: 0.015, facetTilt: 0.012, patch: { size: 34, tone: 0.15 }, grass: [0.05, 0.2], verge: '#70885e', detail: { stone: 0.9, stones: 0, tufts: 0.8 },
      wood: { from: 170, to: 520, amount: 0.8, dark: '#142f44', light: '#21505e', gold: '#2e6068' },
      rock: '#9c988a', rockB: '#797669', rockStrata: { spacing: 2.6, tone: 0.3, wobble: 1.1 }, coverNoise: [7, 0.8], snow: '#e8f2fa', rockSlope: [46, 60],
      bank: '#85857c', bankD: '#6e6e68', bankWet: '#4f5560', bed: '#2f5f7c', bankHeight: 2.4,
    },
    stone: { color: '#3d3c37', dark: '#2b2a26', wall: '#34332e' },
    deck: { span: 30, pier: 4.5 },
    water: { deep: '#1d4c6c', base: '#2c6484', light: '#7fb4cc', far: '#3f6f94', foam: '#dcecf6' },
    horizon: { rock: '#7f8cb8', rockB: '#5f6a9c', scree: '#7482ac', grass: '#3f6a78', forest: '#1c4252', gold: '#3f6a78', haze: '#4f6ea4', hazeNear: 1200, hazeFar: 17000, hazeMax: 0.8, shade: '#2c2c70', strataTone: 0.05, ink: 0.12, snow: '#e6f0f8' },
    trees: {
      kinds: [
        // the firs and spruces of the Bran pass in the moon, and the beeches in lower, rounder masses between them
        { name: 'spruce', shape: 'conifer', share: 0.52, height: [13, 24], width: 0.8, colors: ['#1f4a48', '#1c4244', '#183a40', '#265450'] },
        { name: 'fir', shape: 'conifer', share: 0.28, height: [14, 26], width: 0.62, colors: ['#173e42', '#1c4648', '#13363c'] },
        { name: 'beech', shape: 'round', share: 0.2, height: [7, 12], width: 0.9, colors: ['#4c8a5c', '#5a9868', '#417c54', '#6aa870'] },
      ],
      density: 0.23, cover: 0.2, far: 430, maxSlope: 50, drift: 46, nearScale: 0.72, roadGap: 6,
    },
    rocks: { color: '#8a8678', count: 14 },
    road: { asphalt: '#5e6268', dirt: '#8e8270', cobble: '#8c8880', line: '#d6d2bf', kerb: ['#87857c', '#a29f94'], kerbW: 0.55, noKerbOn: 'asphalt', sideLine: 0.3, centreLine: 0.1, shoulder: '#6c675c', verge: '#5a7f5c', wobble: 0.55, wear: 0.35, gravel: 0.45, crown: 0.12, pebble: 1.5, crownColor: '#5c7a5c' },
    // a boost pad at night: a dark mat, stripes that do not out shout the castle
    pad: { mat: '#5e5e64', stripe: '#e6a43c', band: '#6a6a6e' },
    outline: { color: '#121428', strength: 0.75, width: 1.4, threshold: [0.06, 0.14], minGap: 0.6, fade: [170, 520] },
    // dust is unlit paint in fx.js: at night it is the colour of the night
    dust: { dirt: '#5f5c5e', grass: '#47607c', cobble: '#5f6068', asphalt: '#5f6068', wood: '#5f5a60' },
    kartShadow: [0.006, 0.008, 0.016, 0.8],
    bloom: { threshold: 1.05, strength: 0.3 },
    exposure: 1.24,
    // a higher chase camera: the rivals ahead and the road stand clear over the kart's head
    camera: { fov: 54, fovFast: 68, near: 0.5, far: 6000, chaseUp: 3.1, chaseBack: 6.3, chaseLook: 2.5 },
  },
  music: 'romania',
  landmarks: 'bran',
};
