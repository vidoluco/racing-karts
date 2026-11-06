// Jakarta Macet: central Jakarta on its true map, squeezed to 0.45 so that a day's driving fits in a lap. -z is true north, the
// origin is the Monas. The road goes three quarters round the Merdeka square, down Thamrin, round the Selamat Datang statue at
// Bundaran HI, along the canyon of Sudirman with its busway, under the railway at Dukuh Atas, up the spiral of the Semanggi
// interchange onto the elevated toll road, down at Kuningan, north past the Manggarai railway crossing, through the kampung
// lanes along the Ciliwung and back through leafy Menteng to Gambir. Facts: docs/references/jakarta.md.
// The main obstacle is the traffic (def.traffic, src/sim/traffic.js): streams of vehicles laid along stretches of the road.

const POINTS = [], MARK = {};
const mark = (name) => { MARK[name] = POINTS.length; };
const MAP = 0.82; // the map below was drawn at 0.55 of the real city and came out at 10 km; this brings it to about 8
// the widths below were drawn for the lanes of the real avenues; this brings them to a street that a kart driver feels the walls of. Lane offsets scale with it. The kampung lanes (GANG) stay as they are, and a junction (bank 3 and up) opens to its full width, as junctions do.
// Thamrin and Sudirman (24) keep more of it: their jam needs the room, the bots must get through.
const NARROW = 0.82, AVENUE = 0.9;
const P = (x, z, y = 0, w = 22, surface = 'asphalt', tag = null, bank = 0) => { POINTS.push({ p: [x * MAP, y, z * MAP], w: w <= 12 ? w : bank >= 3 ? w * 1.06 : w === 24 ? w * AVENUE : w * NARROW, bank, surface, tag }); };

// The start: Cikini Raya, north west under the rain trees with the Monas dead ahead at the end of the road, and the finish the same way, so the whole race is run from the monument back to the monument.
mark('start');
P(530, 780, 0, 20); P(452, 672, 0, 20); P(392, 588, 0, 20); P(340, 510, 0, 20, 'asphalt', null, 3);
// Merdeka Timur north past Gambir, the mosque and the cathedral ahead on the right, then west along Merdeka Utara
mark('merdeka');
// a slight lean toward the square: a street dead parallel to it never has the Monas in its windscreen, this one has it ahead on the left for its first 130 m
P(345, 430, 0, 22); P(335, 350, 0, 22); P(322, 270, 0, 22); P(310, 190, 0, 22); P(300, 110, 0, 22); P(295, 30, 0, 22); P(295, -70, 0, 22); P(298, -170, 0, 22); P(298, -262, 0, 22, 'asphalt', null, 4);
P(256, -326, 0, 22, 'asphalt', null, 6);
mark('utara');
P(180, -346, 0, 22); P(90, -346, 0, 22); P(0, -346, 0, 22); P(-90, -346, 0, 22); P(-180, -346, 0, 22);
P(-262, -358, 0, 22, 'asphalt', null, 6); P(-332, -354, 0, 22, 'asphalt', null, 6); P(-366, -312, 0, 22, 'asphalt', null, 4);
// Merdeka Barat, south and swung in at the top, the Monas ahead on the left, the Arjuna Wijaya chariot beyond
mark('barat');
P(-350, -262); P(-332, -205); P(-322, -140); P(-316, -60); P(-312, 20); P(-310, 100); P(-310, 180); P(-310, 260);
mark('thamrin');
P(-306, 340, 0, 24); P(-296, 430, 0, 24); P(-286, 520, 0, 24); P(-276, 620, 0, 24); P(-270, 720, 0, 24); P(-266, 820, 0, 24); P(-262, 920, 0, 24); P(-260, 1000, 0, 24);
// Bundaran HI: clockwise round the fountain, as the city drives it
mark('hi');
P(-250, 1060, 0, 20, 'asphalt', null, 3); P(-214, 1106, 0, 20, 'asphalt', null, 3); P(-178, 1150, 0, 20, 'asphalt', null, 6); P(-168, 1200, 0, 20, 'asphalt', null, 6); P(-190, 1250, 0, 20, 'asphalt', null, 6); P(-236, 1276, 0, 20, 'asphalt', null, 4); P(-278, 1306, 0, 20, 'asphalt', null, 3);
// Sudirman: the canyon, the busway down the middle
mark('sudirman');
P(-296, 1360, 0, 24); P(-296, 1440, 0, 24); P(-290, 1520, -0.4, 24);
mark('dukuh');
P(-286, 1580, -1.4, 24); P(-286, 1640, -2, 24); P(-290, 1700, -1.4, 24); P(-300, 1760, -0.4, 24);
mark('sudirman2');
P(-322, 1830, 0, 24); P(-348, 1910, 0, 24); P(-385, 2000, 0, 24); P(-430, 2100, 0, 24); P(-475, 2200, 0, 24); P(-525, 2300, 0, 24); P(-580, 2400, 0, 24); P(-640, 2500, 0, 24); P(-700, 2590, 0, 24);
// Semanggi: on past the crossing, then right and up, right round over Sudirman
mark('semanggi');
P(-752, 2660, 0.3, 18); P(-800, 2730, 1.4, 16, 'asphalt', null, 6); P(-856, 2762, 2.8, 15, 'asphalt', 'viaduct', 9); P(-916, 2740, 4.2, 15, 'asphalt', 'viaduct', 9); P(-948, 2682, 5.6, 15, 'asphalt', 'viaduct', 9); P(-926, 2626, 7, 15, 'asphalt', 'viaduct', 9); P(-866, 2600, 8.4, 15, 'asphalt', 'viaduct', 6);
mark('tol');
P(-790, 2600, 9.6, 18, 'asphalt', 'viaduct'); P(-705, 2612, 10, 18, 'asphalt', 'viaduct'); P(-610, 2656, 10, 18, 'asphalt', 'viaduct'); P(-500, 2740, 10, 18, 'asphalt', 'viaduct'); P(-390, 2830, 10, 18, 'asphalt', 'viaduct');
mark('tolgate');
P(-280, 2930, 10, 18, 'asphalt', 'viaduct'); P(-170, 3030, 10, 18, 'asphalt', 'viaduct'); P(-60, 3130, 10, 18, 'asphalt', 'viaduct'); P(40, 3226, 10, 18, 'asphalt', 'viaduct'); P(130, 3296, 9.4, 16, 'asphalt', 'viaduct');
// Kuningan: the off ramp, down on a long right
mark('ramp');
P(220, 3336, 7.6, 15, 'asphalt', 'viaduct', 4); P(310, 3340, 5.2, 15, 'asphalt', 'viaduct', 6); P(390, 3300, 3, 15, 'asphalt', 'viaduct', 6); P(450, 3240, 1, 15, 'asphalt', null, 4);
// north east up Dr Saharjo: narrower, every motorbike in the city
mark('saharjo');
P(520, 3160, 0, 16); P(600, 3060, 0, 16); P(690, 2960, 0, 16); P(790, 2850, 0, 16); P(900, 2730, 0, 16); P(1020, 2600, 0, 16); P(1140, 2470, 0, 16); P(1250, 2350, 0, 16); P(1330, 2250, 0, 16);
// Manggarai: over the level crossing
mark('crossing');
P(1372, 2170, 0, 15, 'asphalt'); P(1374, 2090, 0, 14, 'asphalt');
// the kampung, along the Ciliwung: a gang, two or three cars wide at the most
const GANG = 8.4;
mark('kampung');
P(1356, 2020, 0, GANG, 'cobble', null, 3); P(1312, 1966, 0, GANG, 'cobble', null, 3); P(1250, 1924, 0, GANG, 'cobble', null, 2); P(1176, 1886, 0, GANG, 'cobble', null, 2); P(1110, 1824, 0, GANG, 'cobble', null, 4); P(1058, 1742, 0, GANG, 'cobble', null, 4); P(1032, 1658, 0, GANG, 'cobble', null, 2); P(1004, 1584, 0, GANG, 'cobble', null, 3);
mark('bridge1');
P(1012, 1524, 0.5, GANG, 'cobble', 'bridge'); P(1056, 1486, 0.8, GANG, 'cobble', 'bridge'); P(1104, 1456, 0.5, GANG, 'cobble', 'bridge');
P(1132, 1404, 0, GANG, 'cobble', null, 4); P(1110, 1340, 0, GANG, 'cobble', null, 4); P(1050, 1296, 0, GANG, 'cobble', null, 3); P(1006, 1236, 0, GANG, 'cobble', null, 3); P(984, 1160, 0, GANG, 'cobble', null, 3); P(964, 1090, 0, GANG, 'cobble', null, 3);
mark('bridge2');
P(928, 1036, 0.5, GANG, 'cobble', 'bridge'); P(868, 1006, 0.8, GANG, 'cobble', 'bridge'); P(806, 990, 0.5, GANG, 'cobble', 'bridge');
// Back into Cikini and Menteng: rain trees, villas, the road opens up, the Monas far ahead again
mark('menteng');
P(744, 968, 0, 14); P(680, 920, 0, 16); P(610, 856, 0, 18);

// Lanes of traffic, by stretch. d: metres left of the centre. The gaps between the lanes are the point: a car lane at d leaves a kart's width either side of it, and motorbikes wander in those gaps with holes in their ranks.
const MOTOR = { motor: 12, ojek: 5, family: 1, krupuk: 0.7, galon: 0.7, ayam: 0.6, melon: 0.6, sofa: 0.25 };
const PLAIN = { motor: 10, ojek: 3 };
const CARS = { car: 5, mpv: 4, angkot: 2.4, bajaj: 1.8 };
const CITY = { car: 3, mpv: 3, angkot: 3.4, bajaj: 3, metromini: 0.8 };
const lanes = [];
// and more bikes than the map's first go, packed closer. Cars stay as they are: a road this narrow has no room for fuller ones
const L = (from, to, d, mix, o = {}) => { const tight = o.gap <= 9 ? { gap: o.gap * 0.88, fill: Math.min(0.92, o.fill + 0.08) } : {}; const at = Array.isArray(from) ? from[0] : from, k = at === 'kampung' ? 0.74 : ['thamrin', 'hi', 'sudirman', 'dukuh'].includes(at) ? AVENUE : NARROW; lanes.push({ from, to, d: d * k, mix, ...o, ...tight }); };
// An avenue: a bus lane, two car lanes a side, and between and beside them bikes in ranks, so close that a rider could read the next one's phone.
const avenue = (from, to, { cars = 0.8, bikes = 0.7, gapB = 6, gapC = 24, bus = true, swap = true } = {}) => {
  if (bus) L(from, to, 0, { bus: 1 }, { speed: 9, gap: 58, fill: 0.74, weave: 0.05 });
  for (const s of [-1, 1]) {
    // the car lanes stay a kart's width apart: offsets are before NARROW
    L(from, to, s * 5.6, CARS, { speed: 11, gap: gapC, fill: cars, weave: 0.1, swap: swap ? -s * 1.3 : null });
    L(from, to, s * 10.2, CITY, { speed: 9.5, gap: gapC + 3, fill: cars * 0.92, weave: 0.08 });
    L(from, to, s * 7.9, MOTOR, { speed: 14, gap: gapB, fill: bikes, weave: 0.5, swarm: 0.28, jit: 0.3 });
    L(from, to, s * 2.9, MOTOR, { speed: 16, gap: gapB * 1.25, fill: bikes * 0.85, weave: 0.72, swarm: 0.28, jit: 0.3 });
    L(from, to, s * 11, PLAIN, { speed: 12.5, gap: gapB, fill: bikes * 0.8, weave: 0.3, swarm: 0.3, jit: 0.3 });
  }
};
// the pavement belongs to whoever is in a hurry, and half of those are going the wrong way
const pavement = (from, to, at = 14.8, fill = 0.6, lift = 0.16) => {
  L(from, to, at, PLAIN, { speed: 7.5, gap: 12, fill, weave: 0.32, swarm: 0.3, jit: 0.3, lift });
  L(from, to, -at, PLAIN, { speed: 7, gap: 15, fill, weave: 0.32, swarm: 0.3, jit: 0.3, lift, dir: -1 });
};
// the first taste, leaving Cikini
for (const [d, mix, o] of [[-5.6, CARS, { speed: 11, gap: 26, fill: 0.56, weave: 0.1 }], [5.2, CITY, { speed: 10, gap: 28, fill: 0.56, weave: 0.1 }], [-1, MOTOR, { speed: 15, gap: 7, fill: 0.6, weave: 0.7, swarm: 0.3, jit: 0.3 }], [2.2, MOTOR, { speed: 14, gap: 8, fill: 0.55, weave: 0.6, swarm: 0.3, jit: 0.3 }], [-8.2, PLAIN, { speed: 13, gap: 7, fill: 0.55, weave: 0.4, swarm: 0.3, jit: 0.3 }], [8.4, PLAIN, { speed: 13, gap: 8, fill: 0.5, weave: 0.4, swarm: 0.3, jit: 0.3 }]]) L(['start', 36], ['merdeka', -8], d, mix, o);
// the square: wide and flowing, for a city
avenue(['merdeka', 4], ['utara', -40], { cars: 0.64, bikes: 0.7, gapB: 6, gapC: 26, bus: false, swap: false });
for (const [d, mix, o] of [[-5.3, CARS, { speed: 11, gap: 30, fill: 0.54, weave: 0.08 }], [5.3, CARS, { speed: 11, gap: 30, fill: 0.54, weave: 0.08 }], [0, MOTOR, { speed: 15, gap: 6, fill: 0.68, weave: 0.6, swarm: 0.3, jit: 0.3 }], [-8.4, PLAIN, { speed: 14, gap: 6, fill: 0.66, weave: 0.4, swarm: 0.3, jit: 0.3 }], [8.4, PLAIN, { speed: 14, gap: 6, fill: 0.66, weave: 0.4, swarm: 0.3, jit: 0.3 }]]) L(['utara', -30], ['barat', -60], d, mix, o);
avenue(['barat', -50], ['thamrin', -2], { cars: 0.64, bikes: 0.7, gapB: 6, gapC: 26, bus: false, swap: false });
avenue(['thamrin', 6], ['hi', -30], { cars: 0.72, bikes: 0.68 });
pavement(['thamrin', 30], ['hi', -50]);
// round the fountain: no bus lane, everybody cutting across everybody
for (const [d, mix, o] of [[-7, CITY, { speed: 10, gap: 26, fill: 0.66, weave: 0.2 }], [-1, CARS, { speed: 11, gap: 24, fill: 0.66, weave: 0.2, swap: 1.2 }], [5.5, CITY, { speed: 10, gap: 26, fill: 0.66, weave: 0.2 }], [-4, MOTOR, { speed: 15, gap: 6, fill: 0.68, weave: 0.7, swarm: 0.3, jit: 0.3 }], [2.4, MOTOR, { speed: 15, gap: 6, fill: 0.68, weave: 0.7, swarm: 0.3, jit: 0.3 }], [8.2, MOTOR, { speed: 15, gap: 7, fill: 0.68, weave: 0.5, swarm: 0.3, jit: 0.3 }], [-9.2, PLAIN, { speed: 13, gap: 7, fill: 0.6, weave: 0.4, swarm: 0.3, jit: 0.3 }]]) L(['hi', -24], ['sudirman', -6], d, mix, o);
// Sudirman, where the lap's jam lives: the busway flows, all else crawls, a real gap only for those who dare the bus lane
avenue(['sudirman', 2], 'semanggi', { cars: 0.84, bikes: 0.58, gapB: 7.6, gapC: 22 }); // the jam packs them twice as close as this already
pavement(['sudirman', 20], ['dukuh', -70], 14.8, 0.7);
// past the underpass they have a slip road of their own, beyond the planted separator: landmarks/jakarta.js, the road's section
pavement(['dukuh', 230], ['semanggi', -60], 18.2, 0.7, 0.04);
// the spiral and the toll road: quick, no motorbikes by law, and yet
for (const [d, mix, o] of [[-5.4, { car: 5, mpv: 5, truck: 1.2, bus: 0.5 }, { speed: 15, gap: 21, fill: 0.8, weave: 0.1 }], [0, { car: 5, mpv: 4, bajaj: 0.25 }, { speed: 19, gap: 25, fill: 0.76, weave: 0.14, swap: -2.4 }], [5.4, { car: 4, mpv: 4, truck: 2.5 }, { speed: 13, gap: 20, fill: 0.76, weave: 0.1 }], [2.7, { motor: 6, sofa: 1, krupuk: 1 }, { speed: 17, gap: 13, fill: 0.7, weave: 0.7 }], [-2.8, { motor: 6, ojek: 2, galon: 1 }, { speed: 16, gap: 24, fill: 0.66, weave: 0.7 }]]) L(['tol', 40], ['ramp', 60], d, mix, o);
// Dr Saharjo: less room, more of everything
for (const [d, mix, o] of [[-5.2, CITY, { speed: 9, gap: 26, fill: 0.7, weave: 0.1 }], [3.2, CITY, { speed: 9, gap: 26, fill: 0.7, weave: 0.1 }], [-1.4, MOTOR, { speed: 14, gap: 5, fill: 0.78, weave: 0.7, swarm: 0.25, jit: 0.3 }], [6.6, MOTOR, { speed: 14, gap: 5, fill: 0.72, weave: 0.5, swarm: 0.25, jit: 0.3 }], [0.6, PLAIN, { speed: 15, gap: 7, fill: 0.6, weave: 0.6, swarm: 0.3, jit: 0.3 }], [-7.2, { motor: 8, ojek: 2 }, { speed: 7, gap: 14, fill: 0.6, weave: 0.2, dir: -1 }]]) L(['saharjo', 30], ['crossing', -22], d, mix, o);
// past the railway the queue that was waiting for it
for (const [d, mix, o] of [[-3.6, CARS, { speed: 9, gap: 24, fill: 0.5, weave: 0.1 }], [1.5, MOTOR, { speed: 13, gap: 5, fill: 0.72, weave: 0.6, swarm: 0.3, jit: 0.3 }], [4.8, MOTOR, { speed: 13, gap: 6, fill: 0.62, weave: 0.4, swarm: 0.3, jit: 0.3 }]]) L(['crossing', 26], ['kampung', -4], d, mix, o);
// the kampung: only what fits, and the carts go at walking pace
for (const [d, mix, o] of [[2.6, { motor: 8, ojek: 3, krupuk: 1.2, family: 1.2, gerobak: 1.2, ayam: 0.7, galon: 0.6 }, { speed: 9, gap: 11, fill: 0.46, weave: 0.4, swarm: 0.3, jit: 0.3 }], [-2.6, { motor: 8, ojek: 3, krupuk: 1, family: 1.2, gerobak: 1.2, melon: 0.8, sofa: 0.2 }, { speed: 8, gap: 12, fill: 0.42, weave: 0.4, swarm: 0.3, jit: 0.3 }], [-4.3, { motor: 8, ojek: 2 }, { speed: 7, gap: 30, fill: 0.3, weave: 0.15, dir: -1 }]]) L(['kampung', 8], ['menteng', -6], d, mix, o);
// the last of it, right up to the grid with the Monas ahead
for (const [d, mix, o] of [[-3.6, CARS, { speed: 11, gap: 26, fill: 0.58, weave: 0.1 }], [3.2, CITY, { speed: 10, gap: 26, fill: 0.58, weave: 0.1 }], [-0.2, MOTOR, { speed: 15, gap: 6, fill: 0.66, weave: 0.6, swarm: 0.3, jit: 0.3 }]]) L(['menteng', 6], ['menteng', 205], d, mix, o);

const TRAFFIC = {
  jams: [
    { from: ['thamrin', 200], to: ['thamrin', 420], k: 0.72 },
    { from: ['hi', 10], to: ['sudirman', -10], k: 0.55 },
    { from: ['sudirman', 60], to: ['sudirman2', 430], k: 0.42 },          // the great Sudirman jam, in and out of the underpass
    { from: ['sudirman2', 560], to: ['semanggi', -30], k: 0.5 },
    { from: ['tolgate', -170], to: ['tolgate', 40], k: 0.3, ramp: 110 },  // everyone queuing for the toll gate
    { from: ['saharjo', 760], to: ['crossing', -6], k: 0.32 },           // waiting for the train at Manggarai
    { from: 'kampung', to: 'menteng', k: 0.75 },
    { from: ['merdeka', 40], to: ['merdeka', 240], k: 0.7 },
  ],
  lanes,
  crossings: [{ at: ['crossing', 2], period: 36, warn: 5, pass: 5, half: 7 }],
    showTrains: [{ at: ['dukuh', 72], y: 4.5, period: 40, reach: 340 }],
  rain: { chance: 0.7, first: 40, spread: 110, len: 95 },
};

const DEF = {
  id: 'jakarta', region: 'indonesia',
  long: { statics: 575, detail: 250, groundNear: 230, roadNear: 250 }, // a city closes in: towers at 1 km are already most of the way into the haze
  roadRange: [8, 25], // avenues wide enough for lanes of traffic and the gaps between them, lanes only a motorbike wants
  names: { it: 'Jakarta Macet', en: 'Jakarta Gridlock' },
  blurb: {
    it: 'Otto chilometri di ingorgo vero: motorini a sciami, bajaj, angkot e autobus, attorno al Monas, lungo Sudirman, sul raccordo e nei kampung.',
    en: 'Eight kilometres of real gridlock: swarms of scooters, bajaj, angkot and buses, round the Monas, down Sudirman, on the toll road and through the kampung.',
  },
  points: POINTS,
  marks: MARK,
  mapScale: MAP,
  traffic: TRAFFIC,
  // for those who dare the bus lane, and on the toll road where it is safe to be stupid
  boostPads: [{ u: 0.2688, offset: 0 }, { u: 0.4055, offset: 0 }, { u: 0.4501, offset: 0 }, { u: 0.5641, offset: 0 }, { u: 0.6235, offset: 0.4 }, { u: 0.0147, offset: 0 }],
  // the sleeping policemen of the kampung, and a ramp of road works at the foot of the off ramp: a kart in the air clears a motorbike
  jumps: [{ u: 0.6968, strength: 1.2 }, { u: 0.8494, strength: 0.75 }, { u: 0.8732, strength: 0.75 }, { u: 0.9425, strength: 0.75 }, { u: 0.2619, strength: 0.7 }],
  zones: [],
  boxesAcross: 3, // the gang has no room for five
  // the gang: the back lane along the west bank that never crosses the river; too narrow for anything but a bike, so no traffic in it, and it skips both bridges
  shortcuts: [{ from: 0.8883, to: 0.9675, points: [[940, 1510, 0.3], [850, 1380, 0.5], [790, 1230, 0.4], [790, 1090, 0.2]].map(([x, z, y]) => [x * MAP, y, z * MAP]), surface: 'cobble', w: 6 }],
  hazards: [],
  disasters: [
    { kind: 'banjir', u: 0.7781, side: 1, name: 'Banjir Manggarai', say: { it: 'La strada si allaga: resta sulla corsia libera!', en: 'The street is flooding: keep to the free lane!' } },
    { kind: 'banjir', u: 0.8534, side: -1, name: 'Banjir Ciliwung', say: { it: 'Il Ciliwung esce dagli argini!', en: 'The Ciliwung is over its banks!' } },
  ],
  // the great mosque and the cathedral: nothing is ever thrown at them
  sacred: [{ x: 470 * MAP + 40, z: -520 * MAP - 40, r: 110 }, { x: 470 * MAP + 150, z: -520 * MAP + 110, r: 60 }],
  ground: {
    base: 0, hills: 0.04, hillScale: 300, rimHeight: 64, rimFrom: 1150, rimTo: 1200, water: -4.2, dry: true, displayRise: 0.02,
    // the Ciliwung, from the south past Manggarai, between the kampungs and on past Gambir
    river: { w: 26, depth: 2.5, walled: true, points: [[1900, 3000], [1760, 2700], [1620, 2400], [1530, 2240], [1480, 2080], [1420, 1985], [1332, 1936], [1270, 1894], [1193, 1854], [1135, 1797], [1088, 1723], [1066, 1647], [1050, 1570], [1056, 1486], [1040, 1405], [1029, 1325], [977, 1257], [949, 1170], [929, 1100], [885, 1012], [840, 880], [810, 700], [800, 500], [780, 300], [730, 100], [690, -100], [650, -400], [640, -900], [600, -1400]].map(([x, z]) => [x * MAP, z * MAP]) },
  },
  grid: { spacing: 4 },
  horizon: { center: [-6.2098, 106.8502], northDeg: 0, exaggerate: 1, peak: 1, scale: 18, altitude: 12, panelDistance: 16000 },
  // One painted panorama from eye level, closed all round, cut into tiles: tools/panoramas/jakarta-paint.py writes the files and these lines. center is Manggarai, the place the painted Monas is seen from; the last panel takes it away when the 3D one is the one in view.
  backdrops: [
{"file": "jakarta-pano-000.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#d2c6a6", "bearing": 0, "elevation": 0, "row": 0.92028},
    {"file": "jakarta-pano-060.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#d2c6a6", "bearing": 60, "elevation": 0, "row": 0.92028},
    {"file": "jakarta-pano-120.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#d2c6a6", "bearing": 120, "elevation": 0, "row": 0.92028},
    {"file": "jakarta-pano-180.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#d2c6a6", "summit": {"name": "Gunung Pangrango", "lat": -6.7705, "lon": 106.9636, "altitude": 3019, "u": 0.31505, "row": 0.68831}, "elevation": 8.6, "compressed": "true 2.7 deg from the Monas: a long lens on a clear morning, standing over the towers, still as far away as it is"},
    {"file": "jakarta-pano-240.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#d2c6a6", "bearing": 240, "elevation": 0, "row": 0.92028},
    {"file": "jakarta-pano-300.jpg", "width": 62, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#d2c6a6", "summit": {"name": "Monas", "lat": -6.1754, "lon": 106.8272, "altitude": 144, "u": 0.9113, "row": 0.66636}, "elevation": 9.4, "compressed": "true 3.2 deg from Manggarai: it stands as a long lens on the whole half lap sees it, and exactly the size the 3D Monas has where the two change over (showWithin, 797 m)"},
    {"file": "jakarta-hero-far.jpg", "width": 8, "edge": 0, "rise": 0, "baseHaze": [1, 1.01, 0], "mist": "#d2c6a6", "bearing": 325.5, "elevation": 0, "row": 0.92028, "showWithin": {"x": 0, "z": 0, "r": 797}},
  ],
  look: {
    // late afternoon, the sun low in the west through the city's haze: warm on every facade
    sun: { azimuth: 262, elevation: 27, color: '#ffe0b4', intensity: 3.0, wrap: [-0.26, 0.64] },
    hemi: { sky: '#cfe0ea', ground: '#b8a890', intensity: 2.2 },
    sky: {
      stops: [[-8, '#f2cfa4'], [0, '#f2d0a6'], [6, '#f1d0a8'], [8.5, '#edd8ba'], [10, '#e6e3d0'], [12, '#d2e8e2'], [14, '#b6dce8'], [16, '#a8d5e8'], [24, '#80c6e6'], [40, '#5cb0e4'], [60, '#4aa4e2']],
      glow: '#ffeac8', glowStrength: 0.55, glowWidth: 0.4,
      clouds: { amount: 0.5, scale: 1.1, lit: '#fff6e6', shade: '#c9c6d4', speed: 0.004 },
    },
    shadeFine: { bias: 0.5 }, // towers and rain trees lay real shadows across the road
    kartShadow: [0.06, 0.05, 0.09, 0.62], trafficShadow: [0.05, 0.04, 0.08, 0.62],
    fog: { color: '#f1d6b4', density: 0.00042, heightFalloff: 0.004, max: 0.7 },
    mist: { from: 500, to: 1200, amount: 0.88, ring: 0.9 },
    terrain: {
      meadowY: '#8fa45c', meadow: '#789c54', meadowF: '#6a924e', meadowD: '#5f8848', forest: '#2c7048', forestMix: 0.8, verge: '#a8987c',
      facetTone: 0.04, facetTilt: 0.05, patch: { size: 30, tone: 0.08 }, grass: [0.08, 0.04],
      rock: '#9c958a', rockB: '#8a8378', rockSlope: [55, 70],
      bank: '#a9a498', bankD: '#8f8a7e', bankWet: '#6f6a5f', bed: '#6f8f6f', bankHeight: 3.4,
    },
    stone: { color: '#c9c4b8', dark: '#9c988f', wall: '#a8a498' },
    deck: { style: 'concrete', span: 30, color: '#bab6ad', barrier: '#dcd8cc' },
    water: { deep: '#6e5a40', base: '#8c7450', light: '#ab9570', far: '#b0a080', foam: '#e8dcc0', flow: 0.6, facetTone: 0.05 },
    horizon: { rock: '#7f86a0', rockB: '#6f7892', scree: '#8a90a8', grass: '#6f9a88', forest: '#567f7e', gold: '#6f9a88', haze: '#f1d3ae', hazeNear: 1500, hazeFar: 26000, hazeMax: 0.85, shade: '#8fa0b8', strataTone: 0.03, ink: 0.1 },
    trees: {
      kinds: [
        { name: 'rain', shape: 'round', share: 0.42, height: [10, 17], width: 1.5, colors: ['#4f9c50', '#46924e', '#5aa656', '#3f8a4c'] },
        { name: 'angsana', shape: 'round', share: 0.2, height: [7, 12], width: 1, colors: ['#7cc05e', '#6cb458', '#8cc864'] },
        { name: 'cemara', shape: 'conifer', share: 0.16, height: [12, 22], width: 0.42, colors: ['#4a7a4c', '#55855a', '#3f7048'] },
        { name: 'palm', shape: 'palm', share: 0.22, height: [13, 22], width: 1, colors: ['#5faf52', '#6fbc56', '#84c85e'] },
      ],
      density: 0.6, spacing: 13, cover: -1, far: 760, maxSlope: 50, nearScale: 0.9, roadGap: 7, mottle: 0.5, trunk: '#6d5240', roundLods: [{ canopy: true, lumps: 9, segs: 8, rings: 4 }, { canopy: true, lumps: 5, segs: 6, rings: 3 }, { canopy: true, lumps: 3, segs: 6, rings: 3 }, null],
    },
    rocks: { color: '#8a8a84', count: 0 },
    road: { repair: 0.8, wear: 1, cracks: 1.3, grit: 0.55, glare: ['#ffd9a8', 0.5], sett: 3.6, noKerbOn: 'cobble', jumpMarks: false, asphalt: '#5a565f', dirt: '#ad7f58', cobble: '#8e8678', wood: '#a88c62', line: '#fbf6e2', kerb: ['#2b2b30', '#f8f6ec'], shoulder: '#b8b09c', verge: '#a39a84', kerbW: 0.42 },
    outline: { color: '#3c3438', strength: 0.5, width: 1.2, threshold: [0.06, 0.14], minGap: 0.6, fade: [120, 620] },
    softPuff: 1,
    camera: { fov: 54, fovFast: 68, near: 0.5, far: 7000 },
  },
  music: 'indonesia',
  landmarks: 'jakarta',
};

export default DEF;
