// Transfăgărășan: the top of the DN7C on a clear summer late morning, Bâlea Lac and the ladder of hairpins under it. Drawn in true compass
// metres from the middle of the lake (`e` east, `n` north, `horizon.center` is that spot, y = 0 its altitude), compressed from the
// real road (docs/references/transfagarasan.md): the real stack falls north from the lake in long legs running east and west.
//
// The lap, in the order it is driven:
//   Out of the tunnel's mouth along the north shore, flat out, the dark lake on your right and the green wall rising straight out of it, the cabana at the water's edge ahead.
//   The lip: a long left round the end of the shore, and the road faces north over the edge: the whole ladder under the bonnet, the trough, the plain in the haze.
//   The ladder: five legs down, four hairpins, one leg with its concrete bridge over a gully. Steep at the top, easing at the bottom, so that from above the rungs stand apart.
//   The bottom of the valley, the sheep's meadow: out north round a long left and back south east, face on to the whole ladder. The long climb up the trench on the west flank over the arched viaduct.
//   Into the Capra-Bâlea tunnel, curving left in the dark, and out into the whole cirque at once.

const W = 7.6; // the DN7C is a two lane mountain road: narrow enough that the rock goes by fast
const P = (e, n, y, w = W, surface = 'asphalt', tag = null, bank = 0) => ({ p: [e, y, -n], w, bank, surface, tag });
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const end = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// Half a circle in five points. Leaves heading along +e (dir 1) or -e (dir -1) at (ce, cn - r), bulges that way, comes back at (ce, cn + r) heading the other way.
const hairpin = (ce, cn, r, dir, y0, y1, surface = 'asphalt') => {
  const c = Math.SQRT1_2 * r, ym = (y0 + y1) / 2;
  return [
    P(ce, cn - r, y0, W, surface, null, 3),
    P(ce + dir * c, cn - c, (y0 + ym) / 2, 9.2, surface, null, 4.5),
    P(ce + dir * r, cn, ym, 10, surface, 'hairpin', 5),
    P(ce + dir * c, cn + c, (ym + y1) / 2, 9.2, surface, null, 4.5),
    P(ce, cn + r, y1, W, surface, null, 3),
  ];
};

// The stack is compressed anyway; 15 deg round brings all of the cirque, both summits and the saddle, into the frame on the start straight and every east leg.
const NORTH = 15;

// A little value noise of its own: the walls need ribs running down the fall line, which the terrain's own hills do not have.
const hash = (i, j) => { const q = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return q - Math.floor(q); };
const vn = (x, y) => { const i = Math.floor(x), j = Math.floor(y), f = x - i, g = y - j, u = f * f * (3 - 2 * f), v = g * g * (3 - 2 * g); return (hash(i, j) * (1 - u) + hash(i + 1, j) * u) * (1 - v) + (hash(i, j + 1) * (1 - u) + hash(i + 1, j + 1) * u) * v; };
const line = (e, n, a0, b0, a1, b1, w) => { const ax = a1 - a0, ay = b1 - b0, t = clamp01(((e - a0) * ax + (n - b0) * ay) / (ax * ax + ay * ay)); return 1 - end(0, w, Math.hypot(e - a0 - ax * t, n - b0 - ay * t)); };

const table = (T, x) => {
  if (x <= T[0][0]) return T[0][1];
  for (let i = 1; i < T.length; i++) if (x <= T[i][0]) { const k = (x - T[i - 1][0]) / (T[i][0] - T[i - 1][0]); return T[i - 1][1] + (T[i][1] - T[i - 1][1]) * k; }
  return T[T.length - 1][1];
};
// terrain.js already lays the natural ground on the road's own height nearby: this is only what lies past the last rung, the trough going on down north, far under the plain's horizon. RIDGE: how far the flanks must stand above that road height to stay flanks.
const VALLEY_FALL = [[340, 0], [420, -8], [600, -68], [900, -180], [1400, -360]];
const RIDGE_FALL = [[110, 0], [135, -6], [160, -20], [200, -40], [245, -62], [290, -75], [340, -81], [420, -90], [600, -150], [900, -262], [1400, -440]];
export const valleyFloor = (n) => table(VALLEY_FALL, n);

// The glacial trough: the floor the road and the lake lie on, open to the north, walled east, south and west. Foot lines wander; what stands on them rises steep and concave from the water's edge, as the real cirque does.
// d: m out from the foot; along: m round the wall, so that ribs and gullies run down the fall line; H: how high this stretch stands over the floor (low to the east, where the hero stands behind it).
export function trough(e, n) {
  const w1 = vn(n / 90, 3.1) - 0.5, w2 = vn(e / 80, 7.7) - 0.5;
  // the walls of the trough are low moraine: the great wall itself is the painting, and this ground must not stand in front of it
  const eastFoot = (n < 30 ? 190 : n < 100 ? 190 + 50 * end(30, 100, n) : 240 + (n - 100) * 0.09) + 30 * w1;
  // the west wall comes in to the lake's own end, as the real one does: the sweepers and the tunnel run in the rock behind it
  // ...and stands well back from the viaduct, where the side valley opens the drop on the left of the road
  const westFoot = (n < 300 ? -176 - 140 * end(30, 170, n) - 60 * end(60, 170, n) * (1 - end(230, 300, n)) : -316 - (n - 300) * 0.12) + 26 * w1;
  const southFoot = -72 + 22 * w2;
  const dE = Math.max(0, e - eastFoot), dW = Math.max(0, westFoot - e), dS = Math.max(0, southFoot - n);
  const d = Math.hypot(dE, dW, dS);
  const along = dS > Math.max(dE, dW) ? e : dE > dW ? n + 40 : -n - 900;
  // over the falling valley the ridges keep their own height: from the floor they grow into the two big flanks of the trough
  const H = 30 + 16 * clamp01((dS - Math.max(dE, dW)) / 60 + 0.5) + 22 * clamp01((dW - dE) / 60) + 14 * end(130, 360, n) - 0.15 * table(RIDGE_FALL, n);
  return { d, along, H };
}
const wallHeight = (e, n) => {
  const { d, along, H } = trough(e, n);
  if (d <= 0) return 0;
  // ribs and gullies down the fall line, faint at the foot; the crest cut into teeth
  const a = along / 46, rib = 1 - Math.abs(2 * vn(a + d / 500, 2.2) - 1), rib2 = 1 - Math.abs(2 * vn(a * 2.7 + 5, d / 300 + 8) - 1), up = end(8, 90, d);
  const crest = H * (0.85 + 0.3 * vn(a * 0.25, 11.3)) + 9 * rib * rib2;
  // the west flank by the climb is laid back: the road runs under it, no cliff over the kerb
  const lay = e < -250 && n > 40 && n < 320 ? 0.5 : 1;
  const h = 0.4 * d * (0.5 + 0.5 * lay) + 0.0008 * d * d + up * lay * (rib * 8 + rib2 * 3 - 5);
  // a soft cap: the top of the 3D wall stands low on the painting, the painting goes on above it
  const t = (h - crest) / 26, soft = t <= -1 ? h : t >= 1 ? crest : h - 26 * (t + 1) * (t + 1) / 4;
  return Math.max(0, soft);
};

// written by tools/compose-panorama.py with tools/panoramas/transfagarasan.json
const PANELS = [{"file": "transfagarasan-pano-000.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#8c8d68", "bearing": 0, "elevation": 0, "row": 0.68164}, {"file": "transfagarasan-pano-060.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#8c8d68", "summit": {"name": "V\u0103iuga", "lat": 45.6037178, "lon": 24.6258732, "altitude": 2443, "u": 0.95469, "row": 0.17583}, "elevation": 24, "compressed": "true 28 deg, top of the chase frame is 24.4 deg"}, {"file": "transfagarasan-pano-120.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#8c8d68", "bearing": 120, "elevation": 0, "row": 0.68164}, {"file": "transfagarasan-pano-180.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#8c8d68", "bearing": 180, "elevation": 0, "row": 0.68164}, {"file": "transfagarasan-pano-240.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#8c8d68", "summit": {"name": "Paltinu", "lat": 45.5983307, "lon": 24.6070724, "altitude": 2399, "u": 0.34504, "row": 0.24555}, "elevation": 21, "compressed": "true 22 deg"}, {"file": "transfagarasan-pano-300.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#8c8d68", "bearing": 300, "elevation": 0, "row": 0.68164}];

// The lake: real one 360 by 190 m; drawn 300 by 156. Its north shore comes right up to the road: from the road dark water fills the lower third of the view.
const LAKE = { e: -10, n: 16, re: 150, rn: 78, level: -1.6 };

export default {
  id: 'transfagarasan', region: 'romania',
  roadRange: [7.4, 10.2], // narrow straights, widened hairpins
  names: { it: 'Transfăgărășan', en: 'Transfăgărășan' },
  blurb: {
    it: 'Dal Lago Bâlea giù per la scala di tornanti del Făgăraș, e su di nuovo fino al buio del tunnel Capra-Bâlea.',
    en: 'From Bâlea Lake down the ladder of Făgăraș hairpins, and back up into the dark of the Capra-Bâlea tunnel.',
  },
  points: [
    // the north shore, the start: level, the great wall dead ahead
    P(-120, 96, 0.6, 8.2),
    P(-40, 100, 0.2, 8.2),
    P(40, 102, -0.4, 8.2),
    P(92, 100, -0.8, 8, 'asphalt', null, 4),
    // the lip: a long left round the end of the shore, and for a moment the road points north over the edge at the whole of the ladder
    P(114, 103, 0.2, 9.6, 'asphalt', null, 5),
    P(130, 115, 1.6, 10, 'asphalt', 'hairpin', 5),
    P(133, 133, 3.4, 9.4, 'asphalt', null, 3),
    P(126, 152, 2.2, 9, 'asphalt', null, 2),
    P(110, 168, -0.7, 9.2, 'asphalt', null, 4),
    P(84, 176, -4.6, W, 'asphalt', null, 4),
    // leg 1, west at Paltinu, with a kink round a boulder field and a jump over the culvert
    P(35, 160, -11.5, W, 'asphalt', null, 5),
    P(-20, 158, -18.4, W),
    P(-62, 156, -24.4, W),
    // leg 2, east, short. The rungs fall 18 m apart at the top and 8 at the bottom: on an even slope they would all collapse into one line from above
    ...hairpin(-72, 178, 22, -1, -25.4, -33),
    P(-20, 202, -39, W),
    P(15, 199, -43.5, W),
    P(42, 200, -47, W),
    // leg 3, west, the concrete bridge over the gully
    ...hairpin(50, 222, 22, 1, -48, -54.5),
    P(15, 245, -58.5, W, 'asphalt', 'bridge'),
    P(-8, 246, -61, W, 'asphalt', 'bridge'),
    P(-34, 243, -64, W, 'asphalt', 'bridge'),
    P(-62, 244, -67, W),
    // leg 4, east
    ...hairpin(-72, 266, 22, -1, -67.5, -72),
    P(-20, 289, -75, W),
    P(15, 291, -77, W, 'asphalt', null, 4),
    P(40, 288, -78, W),
    // leg 5, west, long and fast: the last hairpin throws you out into the open valley
    ...hairpin(50, 312, 24, 1, -78, -78.8),
    P(5, 340, -79.2, 9),
    P(-45, 350, -79.6, 9, 'asphalt', null, 3),
    // the bottom of the valley, the shepherd's ground: out north past the fold and round a long left...
    P(-85, 380, -80, 9, 'asphalt', null, 4),
    P(-105, 408, -80, 9.4, 'asphalt', null, 5),
    P(-132, 420, -80, 9.8, 'asphalt', null, 7),
    P(-152, 405, -80, 9.8, 'asphalt', null, 7),
    P(-148, 372, -78, 9.4, 'asphalt', null, 5),
    // ...and down the far side heading south east: the whole ladder you came down stands up ahead, rung over rung, face on
    P(-132, 345, -74.9, 9, 'asphalt', null, 5),
    P(-148, 316, -70.6, 9, 'asphalt', null, 5),
    P(-190, 295, -64.4, 9, 'asphalt', null, 4),
    P(-232, 270, -58.2, 9, 'asphalt', null, 3),
    P(-262, 240, -52.2, 9, 'asphalt', null, 3),
    // the arched viaduct over the torrent, climbing south up the trench between the ladder's slope and the west wall
    P(-272, 205, -47.1, W, 'asphalt', 'viaduct', 0),
    P(-276, 174, -43.0, W, 'asphalt', 'viaduct', 0),
    P(-278, 142, -38.9, W, 'asphalt', 'viaduct', 0),
    // sweepers cut into the flank
    P(-268, 100, -33.3, 9, 'asphalt', null, 5),
    P(-276, 50, -26.7, 9, 'asphalt', null, 6),
    P(-272, 0, -20.2, 9, 'asphalt', null, 5),
    // into the spur: the tunnel curves left in the dark
    P(-255, -24, -16.4, W, 'asphalt', 'tunnel', 0),
    P(-232, -20, -13.4, W, 'asphalt', 'tunnel', 0),
    P(-210, 6, -9.0, W, 'asphalt', 'tunnel', 0),
    P(-204, 38, -4.8, W, 'asphalt', 'tunnel', 0),
    // out of the mouth, and the whole cirque at once
    P(-188, 74, 0.3, 9, 'asphalt', null, 5),
  ],
  itemBands: [0.201, 0.395, 0.609, 0.859],
  boxesAcross: 3,
  boostPads: [{ u: 0.583, offset: 0 }, { u: 0.828, offset: 0.3 }],
  jumps: [{ u: 0.223, strength: 0.75 }],
  zones: [],
  shortcuts: [
    // the shepherds' path straight across the second hairpin: much shorter, but dirt, 7 m wide, and a sharp way in
    { from: 0.24, to: 0.272, points: [[-76, -27.6, -167], [-78, -29.4, -178], [-76, -31.3, -189]], surface: 'dirt', w: 6 },
  ],
  hazards: [
    { kind: 'sheep', u: 0.655, width: 1, period: 13, phase: 0 },
    { kind: 'bear', u: 0.881, width: 1, period: 11, phase: 0.3, side: -1 },
  ],
  // The real hazards of this cirque: snow lies in the couloirs over Bâlea into summer, and the road's own cuttings shed stones onto the hairpins.
  disasters: [
    { kind: 'avalanche', u: 0.855, side: 1, source: 55, gully: { color: ['#a6a49d', '#8d8b85'], lump: '#8a8986' }, name: 'Valanga di Bâlea', say: { it: 'Neve dal circo di Bâlea!', en: 'Snow off the Bâlea cirque!', ro: 'Avalanșă din căldarea Bâlea!' } },
    { kind: 'rockfall', u: 0.337, side: -1, name: 'Caduta massi', say: { it: 'Massi sui tornanti!', en: 'Rocks on the hairpins!', ro: 'Pietre pe serpentine!' } },
  ],
  // the roadside cross above the tunnel's mouth
  sacred: [{ x: -160, z: -48, r: 14 }],
  ground: {
    base: 0, hills: 8, hillScale: 170, rimHeight: 0, rimFrom: 400, rimTo: 900, displayRise: 1.8, lod: [34, 170, 900],
    lake: { x: LAKE.e, z: -LAKE.n, rx: LAKE.re, rz: LAKE.rn, level: LAKE.level },
    shape: (x, z) => {
      const e = x, n = -z;
      // the basin of the lake: it comes right up to the foot of the wall on the south and east. The little rock islet of the photos; the point of made ground the cabana stands on, its front in the water
      const q = ((e - LAKE.e) / (LAKE.re + 14)) ** 2 + ((n - LAKE.n) / (LAKE.rn + 10)) ** 2;
      const basin = -10 * (1 - end(0.5, 1.12, q));
      const peninsula = 11 * Math.exp(-(((e - 62) / 15) ** 2 + ((n + 8) / 8) ** 2)) + 12 * Math.exp(-(((e - 86) / 26) ** 2 + ((n - 88) / 18) ** 2));
      // the valley falls away to the north as it does below the real stack: from the top the painted valley goes on beyond it, under the plain's horizon
      const fall = valleyFloor(n) - 22 * line(e, n, -450, 176, -300, 178, 80);
      // the gully of the bridge on leg 3, the torrent under the arched viaduct, the moraine knolls between the lake and the first leg, the bed of the stream out of the lake
      const gully = -7 * line(e, n, 8, 214, 4, 272, 22);
      const torrent = -14 * line(e, n, -470, 150, -180, 215, 42);
      const bed = -2.6 * line(e, n, 60, 72, 66, 130, 9) - 2.8 * line(e, n, 66, 130, 52, 160, 9) - 2.6 * line(e, n, 52, 160, 10, 205, 9);
      const knoll = 5 * Math.exp(-(((e - 150) / 46) ** 2 + ((n - 64) / 34) ** 2)) + 7 * Math.exp(-(((e + 110) / 60) ** 2 + ((n - 150) / 30) ** 2));
      // the moraine lip north of the lake, so that the water ends on a shore; the spur the tunnel is bored through, running back into the mountain
      const lip = 3 * end(1.5, 1.9, q) * (1 - end(2.2, 3.4, q)) * end(100, 130, n);
      const spur = 34 * line(e, n, -196, 44, -360, -190, 84);
      // the trench the climb runs up: the ground falls away from the ladder's slope to the torrent, so the ladder stands clear over its far side
      const trench = -13 * line(e, n, -226, 300, -258, 80, 74);
      return basin + peninsula + fall + gully + torrent + bed + knoll + lip + spur + trench + wallHeight(e, n);
    },
    // ledges and lumps on the walls, too small for the coarse layer: what makes rock of a smooth slope
    fine: (x, z) => {
      const e = x, n = -z;
      // no floor is a plate: the hummocks and sheep terraces of an alpine pasture, too small to see on the map
      const q = ((e - LAKE.e) / LAKE.re) ** 2 + ((n - LAKE.n) / LAKE.rn) ** 2, hum = q < 1.25 ? 0 : end(1.25, 1.8, q) * (1.5 * (vn(e / 19, n / 15) - 0.5) + 1.0 * (vn(e / 8, n / 7 + 40) - 0.5) + 0.3 * Math.sin(n / 6.5 + e / 40));
      if (e > -150 && e < 120 && n > -40) return hum;
      const { d, along } = trough(e, n);
      if (d < 6) return hum;
      const up = end(6, 60, d), a = along / 15, lump = 1 - Math.abs(2 * vn(a, d / 18) - 1), lump2 = vn(a * 2.3 + 4, d / 8 + 3) - 0.5;
      const t = (d + 18 * vn(along / 70, 1.7)) / 34, ledge = (t - Math.floor(t)) ** 4;
      return hum + up * (e < -250 && n > 40 && n < 320 ? 0.35 : 1) * (lump * 7 + lump2 * 4 + ledge * 6 - 4);
    },
  },
  grid: { spacing: 4 },
  // horizon.center is Bâlea Lac itself, not the ridge north of it: both repaints look out from the lake, and at 1 km its walls stand 28 deg high. Moldoveanu is really hidden from here.
  // near: the ring starts at 300 m, because Văiuga and Iezerul Caprei stand well inside the usual 1500.
  horizon: { center: [45.6035, 24.6160], northDeg: NORTH, near: 300, exaggerate: 1, peak: 1, scale: 18, altitude: 2034 },
  // One painted panorama, closed all round: tools/compose-panorama.py with tools/panoramas/transfagarasan.json writes the files and these lines.
  // Peaks: OpenStreetMap, docs/references/transfagarasan.md. Sources and licences: assets/backdrops/CREDITS.md.
  backdrops: PANELS,
  look: {
    // late morning of a summer day, as the photos have it: lush green grass up the walls, grey schist in bands, a blue sky with cumulus over the ridges
    sun: { azimuth: 135 - NORTH, elevation: 48, color: '#fff2dc', intensity: 3.1, wrap: [-0.22, 0.72] },
    hemi: { sky: '#cfdcdc', ground: '#8a8a4e', intensity: 2.2 },
    sky: {
      stops: [[-25, '#c8dcd8'], [0, '#c8dcd8'], [12, '#c3dcda'], [17.3, '#bbd9db'], [19.3, '#abcfde'], [21.7, '#8bbadd'], [24.8, '#6da6db'], [30, '#5a9ad8'], [45, '#4a8ad2']],
      glow: '#fff6e4', glowStrength: 0.25, glowWidth: 0.3,
      clouds: { amount: 0 },
    },
    fog: { color: '#c6dae6', density: 0.00011, heightFalloff: 0.004, max: 0.4 },
    mist: { from: 700, to: 2600, amount: 0.12, ring: 0 },
    terrain: {
      // the greens of the painting, in big flat masses: no grain, no speckle
      meadowY: '#b0b354', meadow: '#8fa242', meadowF: '#7c9339', meadowD: '#667f33', forest: '#4e6d33', forestMix: 0.2, facetTone: 0, facetTilt: 0, patch: { size: 90, tone: 0.05 }, verge: '#94a544',
      rock: '#a29f8f', rockB: '#928f80', rockStrata: { spacing: 3, tone: 0, wobble: 1.2 }, coverNoise: [60, 0.3], coverEdge: 0.5, snow: '#fbfaf6', rockSlope: [66, 80],
    },
    stone: { color: '#b5ad98', dark: '#6d6a66', wall: '#a8a08c' },
    // the concrete of the DN7C's bridges
    deck: { span: 17, pier: 3, parapet: { h: 0.5, kind: 31, broken: 0.3 } },
    water: { deep: '#14503f', base: '#1c6450', light: '#2f7f66', far: '#4a917a', foam: '#b7bdb0', flow: 0.2, facetTone: 0, foamAmount: 0, capture: 0.74, ripple: 0.016 },
    horizon: { rock: '#7d7f82', rockB: '#666a70', scree: '#a8a596', grass: '#8fa242', forest: '#4e6d33', gold: '#b0b354', haze: '#c4d6e2', hazeNear: 1200, hazeFar: 17000, hazeMax: 0.8, shade: '#6a7a90', strataTone: 0.05, ink: 0.12 },
    trees: {
      kinds: [
        // jneapăn, the dwarf mountain pine, is all that grows up here; the dark spruce only stands low in the valley, where the landmark plants it
        { name: 'jneapan', shape: 'shrub', share: 1, height: [1.2, 2.6], width: 1.3, colors: ['#4d6f30', '#5a7c36', '#46662e', '#6a8a3c'] },
        { name: 'vale', shape: 'conifer', share: 0, height: [12, 21], width: 0.8, colors: ['#22503f', '#1f483a', '#2a5a48'] },
      ],
      noPlant: ['spruce', 'larch'], density: 0.2, cover: -0.1, spacing: 11, clump: 70, far: 700, maxSlope: 38, roadGap: 6,
    },
    rocks: { color: '#9c9a8e', count: 90, angular: true, scale: 0.8 },
    // a pass road, not a motorway: no edge lines, a thin worn dash, a warm ochre shoulder
    road: { asphalt: '#55545c', dirt: '#a08d68', line: '#e6e0c8', kerb: ['#b5a67e', '#b5a67e'], kerbW: 0.12, shoulder: '#b5a67e', verge: '#94a544', wobble: 0.55, wear: 0, jumpMarks: false, moundColor: '#7c9339', moundRock: '#6d6f72', moundReach: 3, gravel: 0, lineWear: 0.4, repair: 0, sideLine: 0, centreLine: 0.05 },
    softPuff: 2,
    kartShadow: [0.02, 0.035, 0.03, 0.62],
  },
  music: 'romania',
  landmarks: 'transfagarasan',
};
