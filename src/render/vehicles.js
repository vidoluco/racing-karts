// The vehicles of a city's traffic, fat and friendly like everything else, each once near and once as a few boxes far off. White
// parts take the colour of the instance; everything painted in a colour stays near that colour, since the instance tint multiplies.
// Facing +z, on the ground at y = 0. No brand on anything: a Jakarta bus is its blue and its long windows.
import { box, capsule, cone, cylinder, lathe, merge, paint, place, roundedBox, sphere, torus } from './shapes.js';

const TYRE = '#26252b', HUB = '#c4c6cc', GLASS = '#3f6a88', GLASS_L = '#8fc0d8', SEAT = '#35323a', HEADL = '#fff4c2', RED = '#d93f33', SKIN = '#e0b184', CHROME = '#d9dce0', WHITE = '#ffffff', INK = '#1d1f2b';

const wheel = (r, w, x, y, z, seg = 12) => [
  paint(place(cylinder(r, r, w, seg), { p: [x, y, z], r: [0, 0, Math.PI / 2] }), TYRE),
  paint(place(cylinder(r * 0.52, r * 0.52, w * 1.06, 8), { p: [x, y, z], r: [0, 0, Math.PI / 2] }), HUB),
];
const eyes = (x, y, z, r = 0.2) => [-1, 1].flatMap((s) => [
  paint(place(sphere(r, 8, 5), { p: [s * x, y, z] }), HEADL),
  paint(place(sphere(r * 0.42, 5, 3), { p: [s * x, y + r * 0.2, z + r * 0.72] }), WHITE),
]);
const tail = (x, y, z, r = 0.14) => [-1, 1].flatMap((s) => [
  paint(place(box(r * 2.5, r * 1.5, 0.07), { p: [s * x, y, z - 0.01] }), '#3a2226'),
  paint(place(box(r * 2.2, r * 1.2, 0.09), { p: [s * x, y, z - 0.02] }), RED),
  paint(place(box(r * 0.8, r * 0.28, 0.1), { p: [s * x, y + r * 0.26, z - 0.03] }), '#ff9a86'),
]);
// the plate: everybody has one, nobody reads it
const plate = (y, z, w = 0.5) => [paint(place(box(w, w * 0.32, 0.05), { p: [0, y, z] }), '#23242a'), paint(place(box(w * 0.68, w * 0.08, 0.06), { p: [0, y, z] }), '#e8e6dc')];
const windowsSide = (w, y0, y1, zs, depth = 0.12) => zs.flatMap(([z, l]) => [-1, 1].map((s) => paint(place(box(depth, y1 - y0, l), { p: [s * w / 2, (y0 + y1) / 2, z] }), GLASS)));

// A rider: fat and short, a jacket that takes the instance's tint, a big round helmet with a shining visor, hands on the bars, knees and shoes.
function rider(z, seat, { jacket = WHITE, helmet = null, small = 1, hands = true, legs = true } = {}) {
  const P = [], k = small;
  P.push(paint(place(capsule(0.21 * k, 0.32 * k, 2, 8), { p: [0, seat + 0.36 * k, z], r: [0.14, 0, 0], s: [1.08, 1, 0.92] }), jacket));
  // the helmet, its rim and the dark visor standing clear of it, with one streak of sky on the glass
  P.push(paint(place(sphere(0.25 * k, 10, 6), { p: [0, seat + 0.86 * k, z + 0.04 * k] }), helmet || '#3a3d46'));
  // an open face under the peak: skin, two eyes, the strap; from behind a stripe over the shell and a bag on the back, so nobody is a pill
  P.push(paint(place(sphere(0.165 * k, 6, 4), { p: [0, seat + 0.8 * k, z + 0.13 * k], s: [1, 0.86, 0.9] }), SKIN));
  for (const s of [-1, 1]) P.push(paint(place(sphere(0.026 * k, 3, 2), { p: [s * 0.065 * k, seat + 0.83 * k, z + 0.275 * k] }), INK));
  P.push(paint(place(sphere(0.2 * k, 6, 2), { p: [0, seat + 0.97 * k, z + 0.17 * k], s: [1.02, 0.3, 0.9] }), INK));
  P.push(paint(place(box(0.07 * k, 0.03 * k, 0.5 * k), { p: [0, seat + 1.1 * k, z + 0.02 * k] }), helmet === WHITE || !helmet ? '#d9483b' : WHITE));
  if (hands && k >= 1) P.push(paint(place(box(0.3 * k, 0.34 * k, 0.13 * k), { p: [0, seat + 0.42 * k, z - 0.21 * k], r: [0.14, 0, 0] }), jacket === WHITE ? '#34383f' : '#b98a4a'));
  if (hands) for (const s of [-1, 1]) {
    P.push(paint(place(capsule(0.07 * k, 0.38 * k, 1, 6), { p: [s * 0.27 * k, seat + 0.38 * k, z + 0.26], r: [1.12, 0, 0] }), jacket));
    P.push(paint(place(sphere(0.08 * k, 5, 3), { p: [s * 0.32 * k, seat + 0.48 * k, z + 0.5] }), SKIN));
  }
  if (legs) for (const s of [-1, 1]) {
    // a thigh along the seat, a shin down to the floorboard, a shoe on it
    P.push(paint(place(capsule(0.085 * k, 0.26 * k, 1, 5), { p: [s * 0.15 * k, seat + 0.06 * k, z + 0.2 * k], r: [1.3, 0, 0] }), '#3a4150'));
    P.push(paint(place(capsule(0.07 * k, 0.32 * k, 1, 5), { p: [s * 0.16 * k, seat - 0.24 * k, z + 0.34 * k], r: [0.1, 0, 0] }), '#3a4150'));
    P.push(paint(place(box(0.13 * k, 0.09 * k, 0.26 * k), { p: [s * 0.16 * k, seat - 0.5 * k, z + 0.4 * k] }), '#22222a'));
  }
  return P;
}

// A step-through scooter: what most of the road is. Fat little body, a fat tail, two fat wheels.
function scooter({ body = WHITE } = {}) {
  const P = [...wheel(0.27, 0.13, 0, 0.27, 0.68, 12), ...wheel(0.27, 0.13, 0, 0.27, -0.66, 12)];
  // rear fairing: a slim teardrop, tapering back to the tail light, a dark belly under it
  P.push(paint(place(sphere(0.42, 12, 8), { p: [0, 0.6, -0.42], s: [0.62, 0.74, 1.26] }), body));
  P.push(paint(place(sphere(0.3, 6, 3), { p: [0, 0.38, -0.46], s: [0.58, 0.5, 1.2] }), '#2c2c34'));
  // the flat floorboard, dark on top where the shoes go
  P.push(paint(place(box(0.34, 0.1, 0.72), { p: [0, 0.34, 0.16] }), body));
  P.push(paint(place(box(0.28, 0.02, 0.6), { p: [0, 0.4, 0.16] }), SEAT));
  // the leg shield, raked back, and the mudguard over the front wheel
  P.push(paint(place(roundedBox(0.4, 0.72, 0.1, 0.045, 1), { p: [0, 0.72, 0.58], r: [-0.22, 0, 0] }), body));
  P.push(paint(place(sphere(0.3, 8, 4), { p: [0, 0.5, 0.7], s: [0.5, 0.36, 1] }), body));
  P.push(paint(place(sphere(0.3, 8, 4), { p: [0, 0.5, -0.74], s: [0.42, 0.3, 0.86] }), body));
  P.push(paint(place(roundedBox(0.34, 0.12, 0.72, 0.055, 1), { p: [0, 0.96, -0.38] }), SEAT));
  // the bars, grips, two mirrors on stalks, the lamp
  P.push(paint(place(cylinder(0.024, 0.024, 0.72, 4), { p: [0, 1.14, 0.6], r: [0, 0, Math.PI / 2] }), CHROME));
  for (const s of [-1, 1]) {
    P.push(paint(place(cylinder(0.034, 0.034, 0.16, 4), { p: [s * 0.32, 1.14, 0.6], r: [0, 0, Math.PI / 2] }), TYRE));
    P.push(paint(place(cylinder(0.012, 0.012, 0.24, 4), { p: [s * 0.24, 1.26, 0.6], r: [0, 0, -s * 0.28] }), CHROME));
    P.push(paint(place(sphere(0.055, 5, 3), { p: [s * 0.28, 1.38, 0.6], s: [1, 0.72, 0.35] }), INK));
  }
  P.push(paint(place(sphere(0.1, 6, 4), { p: [0, 1.02, 0.7] }), HEADL));
  P.push(paint(place(box(0.22, 0.09, 0.05), { p: [0, 0.78, -0.96] }), RED));
  P.push(...plate(0.6, -1.0, 0.2));
  return P;
}

const motor = () => merge([...scooter(), ...rider(-0.2, 0.92, { jacket: '#3e4250', helmet: WHITE })]);
// the motorcycle taxi: its green helmet and jacket, and someone on the back holding on to a phone
const ojek = () => merge([...scooter({ body: '#d7dade' }), ...rider(-0.04, 0.92, { jacket: '#2fa84f', helmet: '#2fa84f' }), ...rider(-0.56, 0.96, { jacket: '#e9e0d0', helmet: '#f4c542', small: 0.9, hands: false })]);
// four on one seat, the smallest standing in front
const family = () => merge([...scooter(), ...rider(-0.06, 0.92, { helmet: '#f4c542' }), ...rider(-0.56, 0.96, { jacket: '#e7799b', helmet: '#e7799b', small: 0.9, hands: false }), ...rider(0.34, 0.66, { jacket: '#74c0ee', helmet: '#f2a24a', small: 0.62, hands: false }), ...rider(-0.98, 0.98, { jacket: '#e9c04a', helmet: '#5cc77a', small: 0.66, hands: false })]);
// a mountain of prawn crackers in big clear bags, far wider than the bike
function krupuk() {
  const P = [...scooter(), ...rider(0, 0.92, { helmet: '#f2a24a' })];
  for (const [x, y, z, r] of [[-0.62, 1, -0.6, 0.46], [0.62, 1, -0.6, 0.46], [-0.58, 0.98, -0.02 - 0.1, 0.36], [0.58, 0.98, -0.12, 0.36], [0, 1.28, -0.8, 0.5], [-0.3, 1.72, -0.7, 0.38], [0.32, 1.7, -0.72, 0.38], [0, 2, -0.72, 0.28]]) {
    P.push(paint(place(sphere(r, 9, 7), { p: [x, y, z], s: [1, 1.06, 1] }), '#f5e6b8', 0, (a, b) => 0.82 + 0.25 * (b / r + 0.5)));
  }
  P.push(paint(place(torus(0.42, 0.03, 4, 12), { p: [0, 1.5, -0.74], r: [Math.PI / 2, 0, 0] }), RED));
  return merge(P);
}
// A tower of blue water bottles, tied on with one piece of string and hope.
function galon() {
  const P = [...scooter(), ...rider(0, 0.92, { helmet: '#3d88d6' })];
  for (const [x, y, z] of [[-0.42, 0.92, -0.62], [0.42, 0.92, -0.62], [0, 0.92, -0.62], [-0.22, 1.42, -0.62], [0.22, 1.42, -0.62], [0, 1.92, -0.62]]) {
    P.push(paint(place(cylinder(0.21, 0.21, 0.42, 10), { p: [x, y, z] }), '#7fd0f2', 0, (a, b) => 0.82 + b * 0.8));
    P.push(paint(place(cylinder(0.07, 0.07, 0.08, 6), { p: [x, y + 0.24, z] }), '#2a70c8'));
  }
  return merge(P);
}
// Two cages of chickens, all of them with something to say about it.
function ayam() {
  const P = [...scooter(), ...rider(0, 0.92, { jacket: '#b06a3a', helmet: '#e9e4da' })];
  for (const s of [-1, 1]) {
    P.push(paint(place(roundedBox(0.56, 0.62, 0.9, 0.08, 1), { p: [s * 0.54, 0.86, -0.56] }), '#c9a24a'));
    for (const [z, up] of [[-0.86, 0], [-0.56, 0.06], [-0.26, 0]]) {
      const x = s * 0.54, y = 1.28 + up;
      P.push(paint(place(sphere(0.17, 7, 5), { p: [x, y, z] }), '#fbfaf2'), paint(place(sphere(0.1, 6, 4), { p: [x + s * 0.05, y + 0.17, z + 0.06] }), '#fbfaf2'), paint(place(sphere(0.05, 5, 3), { p: [x + s * 0.05, y + 0.28, z + 0.06] }), RED), paint(place(cone(0.03, 0.09, 4), { p: [x + s * 0.05, y + 0.17, z + 0.17], r: [Math.PI / 2, 0, 0] }), '#f2a24a'));
    }
  }
  return merge(P);
}
// The little green gas bottles every warung lives on, hung off a frame on both sides.
function melon() {
  const P = [...scooter(), ...rider(0, 0.92, { jacket: '#44464e', helmet: '#f2c042' })], BAR = '#6c6f76';
  for (const s of [-1, 1]) {
    // a welded rack on each side, and the bottles standing in it: slim, with a collar and a red valve
    const x0 = s * 0.5;
    for (const y of [0.42, 0.92]) P.push(paint(place(box(0.36, 0.04, 1.2), { p: [x0, y, -0.42] }), BAR));
    for (const z of [-1, 0.16]) P.push(paint(place(box(0.04, 0.54, 0.04), { p: [x0 + s * 0.16, 0.67, z] }), BAR));
    for (const z of [-0.84, -0.42, 0]) {
      P.push(paint(place(cylinder(0.13, 0.13, 0.32, 9), { p: [x0, 0.62, z] }), '#6cc452', 0, (a, b) => 0.86 + 0.3 * b));
      P.push(paint(place(sphere(0.13, 8, 4), { p: [x0, 0.78, z], s: [1, 0.55, 1] }), '#7ed062'));
      P.push(paint(place(cylinder(0.05, 0.06, 0.06, 6), { p: [x0, 0.88, z] }), '#f0ece0'));
      P.push(paint(place(cylinder(0.03, 0.03, 0.05, 5), { p: [x0, 0.93, z] }), '#d9483b'));
    }
  }
  return merge(P);
}
// Moving house: a whole sofa across the back of a scooter, and somebody sitting on it, because why waste a sofa.
function sofa() {
  const P = [...scooter(), ...rider(0.04, 0.92, { helmet: '#d9483b' })], C = '#d9604f', D = '#b84436';
  P.push(paint(place(roundedBox(2, 0.3, 0.8, 0.12, 2), { p: [0, 1.28, -0.7] }), C));
  P.push(paint(place(roundedBox(2, 0.72, 0.26, 0.12, 2), { p: [0, 1.66, -1.02] }), D));
  for (const s of [-1, 1]) {
    P.push(paint(place(roundedBox(0.28, 0.5, 0.8, 0.12, 2), { p: [s * 0.92, 1.56, -0.7] }), D));
    P.push(paint(place(roundedBox(0.8, 0.16, 0.66, 0.08, 1), { p: [s * 0.42, 1.48, -0.66] }), '#ee8a78'));
  }
  P.push(...rider(-0.66, 1.46, { jacket: '#74c0ee', helmet: '#f4c542', small: 0.9, hands: false }));
  return merge(P);
}
// The street food cart: a glass case of noodles under a little striped roof, pushed along by its owner at a walk.
function gerobak() {
  const P = [...wheel(0.32, 0.08, -0.5, 0.32, -0.1, 12), ...wheel(0.32, 0.08, 0.5, 0.32, -0.1, 12)];
  P.push(paint(place(roundedBox(1.1, 0.5, 1.6, 0.08, 1), { p: [0, 0.8, 0.1] }), '#c8332f'));
  P.push(paint(place(roundedBox(1.14, 0.1, 1.64, 0.04, 1), { p: [0, 1.08, 0.1] }), '#f3d36b'));
  P.push(paint(place(box(1, 0.6, 1.5), { p: [0, 1.4, 0.1] }), GLASS_L));
  P.push(paint(place(box(0.86, 0.3, 0.4), { p: [0, 1.28, 0.4] }), '#f0d9a0'), paint(place(sphere(0.25, 8, 6), { p: [0, 1.32, -0.28] }), '#7a4a2a'));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.push(paint(place(cylinder(0.03, 0.03, 0.8, 5), { p: [sx * 0.5, 1.7, 0.1 + sz * 0.72] }), CHROME));
  P.push(paint(place(lathe([[1.08, 2.04], [0.1, 2.34]], 4), { r: [0, Math.PI / 4, 0], s: [0.9, 1, 1.28] }), '#f4e9d8', 0));
  P.push(paint(place(lathe([[1.1, 2.0], [0.98, 2.06]], 4), { r: [0, Math.PI / 4, 0], s: [0.9, 1, 1.28] }), '#d9483b'));
  P.push(...rider(-1.1, 0.34, { jacket: '#f2f2ea', helmet: '#4d6fa8' }));
  P.push(paint(place(capsule(0.1, 0.6, 2, 6), { p: [0, 0.3, -1.1], r: [0, 0, 0] }), '#46506a'));
  return merge(P);
}
// Bajaj: the three wheeled taxi, a fat blue bubble with one wheel in front, a white roof, a driver who has seen everything.
function bajaj() {
  const P = [...wheel(0.26, 0.15, 0, 0.26, 1.02, 10), ...wheel(0.26, 0.15, -0.58, 0.26, -0.72, 10), ...wheel(0.26, 0.15, 0.58, 0.26, -0.72, 10)];
  P.push(paint(place(roundedBox(1.32, 0.72, 2.2, 0.26, 2), { p: [0, 0.7, -0.08] }), WHITE));
  P.push(paint(place(roundedBox(0.8, 0.4, 0.5, 0.14, 1), { p: [0, 0.52, 0.98] }), WHITE));
  P.push(paint(place(roundedBox(1.36, 0.14, 2.3, 0.07, 1), { p: [0, 1.74, -0.1] }), '#f4f2ea'));
  for (const sx of [-1, 1]) for (const sz of [-0.95, 0.72]) P.push(paint(place(cylinder(0.05, 0.05, 0.72, 5), { p: [sx * 0.6, 1.36, sz - 0.1] }), WHITE));
  P.push(paint(place(roundedBox(1.16, 0.62, 0.08, 0.04, 1), { p: [0, 1.32, 0.68], r: [-0.14, 0, 0] }), GLASS_L));
  P.push(...rider(0.18, 0.86, { jacket: '#7b6a50', helmet: SKIN }));
  P.push(paint(place(roundedBox(1, 0.3, 0.5, 0.1, 1), { p: [0, 1.14, -0.62] }), SEAT));
  P.push(paint(place(sphere(0.13, 7, 5), { p: [0, 0.82, 1.2] }), HEADL));
  P.push(...tail(0.54, 0.7, -1.2, 0.09));
  P.push(paint(place(roundedBox(1.36, 0.16, 1.2, 0.05, 1), { p: [0, 0.98, -0.3] }), '#f4f2ea'));
  return merge(P);
}
function car({ tall = false } = {}) {
  const L = tall ? 4.1 : 3.8, W = 1.76, h0 = 0.9, top = tall ? 1.84 : 1.54;
  const P = [...wheel(0.3, 0.22, -W / 2 + 0.08, 0.3, L * 0.31), ...wheel(0.3, 0.22, W / 2 - 0.08, 0.3, L * 0.31), ...wheel(0.3, 0.22, -W / 2 + 0.08, 0.3, -L * 0.31), ...wheel(0.3, 0.22, W / 2 - 0.08, 0.3, -L * 0.31)];
  P.push(paint(place(roundedBox(W, 0.62, L, 0.24, 2), { p: [0, h0 - 0.26, 0] }), WHITE));
  const cabL = tall ? L * 0.74 : L * 0.56, cabZ = tall ? -L * 0.09 : -L * 0.06;
  P.push(paint(place(roundedBox(W * 0.86, top - h0 + 0.06, cabL, 0.2, 2), { p: [0, (top + h0) / 2 - 0.03, cabZ] }), WHITE));
  P.push(paint(place(roundedBox(W * 0.74, (top - h0) * 0.74, 0.08, 0.04, 1), { p: [0, (top + h0) / 2 - 0.02, cabZ + cabL / 2 + 0.01], r: [-0.14, 0, 0] }), GLASS_L));
  P.push(paint(place(roundedBox(W * 0.74, (top - h0) * 0.7, 0.08, 0.04, 1), { p: [0, (top + h0) / 2 - 0.01, cabZ - cabL / 2 - 0.01] }), GLASS));
  P.push(...windowsSide(W * 0.87, h0 + 0.08, top - 0.12, [[cabZ + cabL * 0.22, cabL * 0.38], [cabZ - cabL * 0.22, cabL * 0.38]]));
  // a bumper either end, its plate, the sill, mirrors and door lines, so the body is more than a soap
  for (const e of [-1, 1]) P.push(paint(place(box(W * 0.98, 0.2, 0.2), { p: [0, 0.46, e * (L / 2 - 0.03)] }), '#2f3036'));
  P.push(...plate(0.5, -L / 2 - 0.08));
  for (const s of [-1, 1]) {
    P.push(paint(place(box(0.05, 0.14, L * 0.6), { p: [s * W / 2, 0.42, 0] }), '#2f3036'));
    P.push(paint(place(box(0.03, 0.56, 0.03), { p: [s * (W / 2 + 0.002), 0.74, cabZ] }), '#46484e'));
    P.push(paint(place(sphere(0.09, 5, 3), { p: [s * (W / 2 + 0.06), h0 + 0.1, cabZ + cabL / 2 - 0.04], s: [1.1, 0.8, 0.5] }), '#2f3036'));
  }
  P.push(...eyes(W * 0.34, 0.72, L / 2 - 0.08, 0.18), ...tail(W * 0.36, 0.76, -L / 2 + 0.02));
  return merge(P);
}
// Angkot: the little public minibus, sky blue with a painted band and a door that is always open, somebody's whole life on the roof.
function angkot() {
  const L = 3.8, W = 1.74, top = 2.04;
  const P = [...wheel(0.27, 0.2, -W / 2 + 0.08, 0.27, L * 0.33), ...wheel(0.27, 0.2, W / 2 - 0.08, 0.27, L * 0.33), ...wheel(0.27, 0.2, -W / 2 + 0.08, 0.27, -L * 0.3), ...wheel(0.27, 0.2, W / 2 - 0.08, 0.27, -L * 0.3)];
  P.push(paint(place(roundedBox(W, top - 0.32, L, 0.26, 2), { p: [0, (top + 0.32) / 2, 0] }), WHITE));
  P.push(paint(place(roundedBox(W * 1.01, 0.2, L * 1.0, 0.09, 1), { p: [0, 0.98, 0] }), '#f4f0e0'));
  P.push(paint(place(roundedBox(W * 0.8, 0.6, 0.08, 0.04, 1), { p: [0, 1.5, L / 2 - 0.02], r: [-0.1, 0, 0] }), GLASS_L));
  P.push(paint(place(roundedBox(W * 0.76, 0.6, 0.08, 0.04, 1), { p: [0, 1.5, -L / 2 + 0.02] }), GLASS));
  P.push(...windowsSide(W + 0.02, 1.18, 1.82, [[1.1, 0.8], [0.1, 0.8], [-0.9, 0.9]]));
  P.push(paint(place(box(0.08, 1.2, 0.72), { p: [-W / 2 - 0.0, 0.92, 0.6] }), INK));
  P.push(paint(place(roundedBox(W * 0.78, 0.1, L * 0.7, 0.04, 1), { p: [0, top + 0.08, -0.1] }), '#4a4238'));
  for (const [x, z, s, c] of [[-0.3, -0.5, 0.42, '#e5c04f'], [0.3, 0.2, 0.36, '#d9483b'], [0.2, -0.8, 0.3, '#4a8f4f']]) P.push(paint(place(roundedBox(s * 1.2, s, s * 1.5, 0.1, 1), { p: [x, top + 0.14 + s / 2, z] }), c));
  for (const e of [-1, 1]) P.push(paint(place(box(W * 0.98, 0.18, 0.16), { p: [0, 0.42, e * (L / 2 - 0.02)] }), '#2f3036'));
  P.push(...plate(0.46, -L / 2 - 0.08));
  P.push(...eyes(W * 0.32, 0.72, L / 2 - 0.05, 0.17), ...tail(W * 0.36, 0.78, -L / 2 + 0.02));
  return merge(P);
}
// A truck with painted boards at the back and a tarp piled high.
function truck() {
  const L = 6, W = 2.16;
  const P = [...wheel(0.42, 0.3, -W / 2 + 0.12, 0.42, 2), ...wheel(0.42, 0.3, W / 2 - 0.12, 0.42, 2), ...wheel(0.42, 0.34, -W / 2 + 0.12, 0.42, -1.9), ...wheel(0.42, 0.34, W / 2 - 0.12, 0.42, -1.9)];
  P.push(paint(place(roundedBox(W, 1.64, 1.6, 0.26, 2), { p: [0, 1.5, 2.1] }), '#e5c13f'));
  P.push(paint(place(roundedBox(W * 0.86, 0.68, 0.1, 0.04, 1), { p: [0, 1.86, 2.9], r: [-0.08, 0, 0] }), GLASS_L));
  P.push(paint(place(box(W, 0.3, L - 1.2), { p: [0, 0.82, -0.6] }), '#5a4632'));
  P.push(paint(place(box(W, 1.1, L - 2), { p: [0, 1.52, -1.02] }), '#3f9f62'));
  P.push(paint(place(box(W * 1.01, 1.0, 0.1), { p: [0, 1.5, -L / 2 + 0.05 + 0.02] }), '#d9483b'));
  P.push(paint(place(box(W * 0.8, 0.26, 0.06), { p: [0, 1.5, -L / 2] }), '#f4c542'));
  P.push(paint(place(sphere(1, 12, 8), { p: [0, 2.1, -1.02], s: [W * 0.5, 0.9, (L - 2) * 0.48] }), '#6b6f8f', 0, (x, y) => 0.8 + 0.3 * y));
  P.push(...eyes(W * 0.36, 0.84, 2.9, 0.2), ...tail(W * 0.38, 0.92, -L / 2 - 0.02, 0.16));
  return merge(P);
}
// A long bus. colour: white takes the tint, so one geometry is both the blue city bus and the old orange one.
function busBody(L, W, top, { door = true, band = '#f6f6f2', roof = '#f4f4ee', floor = 0.42, win = GLASS } = {}) {
  const P = [...wheel(0.44, 0.3, -W / 2 + 0.1, 0.44, L * 0.3), ...wheel(0.44, 0.3, W / 2 - 0.1, 0.44, L * 0.3), ...wheel(0.44, 0.3, -W / 2 + 0.1, 0.44, -L * 0.28), ...wheel(0.44, 0.3, W / 2 - 0.1, 0.44, -L * 0.28)];
  P.push(paint(place(roundedBox(W, top - floor, L, 0.34, 2), { p: [0, (top + floor) / 2, 0] }), WHITE));
  P.push(paint(place(roundedBox(W * 1.01, 0.3, L * 1.002, 0.12, 1), { p: [0, floor + (top - floor) * 0.42, 0] }), band));
  P.push(paint(place(roundedBox(W * 0.8, 0.14, L * 0.9, 0.06, 1), { p: [0, top + 0.03, 0] }), roof));
  const y0 = floor + (top - floor) * 0.52, y1 = top - 0.26, n = Math.round(L / 1.7), pitch = (L - 1.2) / n, zs = [];
  for (let i = 0; i < n; i++) zs.push([-(L - 1.2) / 2 + (i + 0.5) * pitch, pitch * 0.86]);
  P.push(...windowsSide(W + 0.02, y0, y1, zs));
  P.push(paint(place(roundedBox(W * 0.84, y1 - y0 + 0.26, 0.1, 0.05, 1), { p: [0, (y0 + y1) / 2 - 0.06, L / 2 - 0.02] }), GLASS_L));
  P.push(paint(place(roundedBox(W * 0.8, y1 - y0, 0.1, 0.05, 1), { p: [0, (y0 + y1) / 2, -L / 2 + 0.02] }), win));
  if (door) P.push(paint(place(box(0.06, 1.8, 1.05), { p: [-W / 2 - 0.0, floor + 0.9, L * 0.14] }), '#f6f6f2'), paint(place(box(0.08, 1.5, 0.82), { p: [-W / 2 - 0.0, floor + 1, L * 0.14] }), GLASS));
  P.push(paint(place(box(W * 0.96, 0.28, 0.14), { p: [0, 0.56, -L / 2 + 0.01] }), '#2f3036'), paint(place(box(W * 0.96, 0.28, 0.14), { p: [0, 0.56, L / 2 - 0.01] }), '#2f3036'));
  P.push(...plate(0.62, -L / 2 - 0.08));
  P.push(...eyes(W * 0.36, 0.84, L / 2 - 0.05, 0.2), ...tail(W * 0.4, 0.94, -L / 2 + 0.02, 0.15));
  return P;
}
const bus = () => merge(busBody(10.5, 2.48, 3.24, {}));
const metromini = () => {
  const P = busBody(7.2, 2.26, 2.86, { band: '#f4f0e0', roof: '#c9c3b0' });
  P.push(paint(place(cylinder(0.08, 0.1, 0.5, 6), { p: [0.8, 0.5, -3.6], r: [Math.PI / 2, 0, 0] }), '#3a3a3a'));
  return merge(P);
};

// The middle distance, for the crowd: a bike and rider in a tenth of the triangles, a tint on the bike, and for a loaded one its load.
const midWheels = () => [0.66, -0.64].map((z) => paint(place(cylinder(0.27, 0.27, 0.12, 7), { p: [0, 0.27, z], r: [0, 0, Math.PI / 2] }), TYRE));
// A rider who sits: torso on the seat, thighs and shins down to the footboard, arms to the bars, a helmet on the shoulders. At 25 m a lozenge under a floating ball reads as a toy.
const midRider = (z, helmet) => [
  paint(place(capsule(0.2, 0.3, 1, 7), { p: [0, 1.22, z], r: [0.14, 0, 0] }), '#3e4250'),
  paint(place(box(0.36, 0.14, 0.56), { p: [0, 0.94, z + 0.24] }), '#3e4250'),
  paint(place(box(0.3, 0.5, 0.13), { p: [0, 0.66, z + 0.48] }), '#3e4250'),
  ...[-1, 1].map((k) => paint(place(box(0.09, 0.09, 0.6), { p: [k * 0.25, 1.26, z + 0.34], r: [0.42, 0, 0] }), '#3e4250')),
  paint(place(sphere(0.23, 6, 4), { p: [0, 1.74, z + 0.04] }), helmet),
  paint(place(box(0.28, 0.32, 0.12), { p: [0, 1.32, z - 0.2], r: [0.14, 0, 0] }), '#b98a4a'),
];
const mid = {
  bike: () => merge([
    ...midWheels(),
    paint(place(roundedBox(0.34, 0.5, 1.1, 0.12, 1), { p: [0, 0.6, -0.3] }), WHITE),
    paint(place(box(0.36, 0.76, 0.1), { p: [0, 0.74, 0.56], r: [-0.22, 0, 0] }), WHITE),
    paint(place(box(0.3, 0.08, 0.7), { p: [0, 0.38, 0.14] }), WHITE),
    paint(place(box(0.3, 0.07, 0.62), { p: [0, 0.88, -0.42] }), TYRE),
    ...midRider(-0.2, WHITE),
  ]),
  load: () => merge([
    ...midWheels(),
    paint(place(roundedBox(0.34, 0.5, 1.1, 0.12, 1), { p: [0, 0.6, -0.3] }), '#c9ccd2'),
    paint(place(box(0.36, 0.76, 0.1), { p: [0, 0.74, 0.56], r: [-0.22, 0, 0] }), '#c9ccd2'),
    ...midRider(0.02, '#44464e'),
    paint(place(roundedBox(1.3, 1, 0.9, 0.22, 1), { p: [0, 1.28, -0.74] }), WHITE),
  ]),
};
// The far ones: a body and, for the bikes, a rider's bulk.
const FARCOL = WHITE;
const far = {
  bike: () => merge([paint(place(box(0.54, 0.84, 1.9), { p: [0, 0.5, 0] }), FARCOL), paint(place(box(0.6, 1, 0.6), { p: [0, 1.4, -0.1] }), FARCOL)]),
  bajaj: () => merge([paint(place(box(1.3, 1.3, 2.4), { p: [0, 0.85, 0] }), FARCOL), paint(place(box(1.3, 0.2, 2.4), { p: [0, 1.74, 0] }), '#f4f2ea')]),
  car: () => merge([paint(place(box(1.7, 0.7, 3.8), { p: [0, 0.6, 0] }), FARCOL), paint(place(box(1.5, 0.6, 2.1), { p: [0, 1.2, -0.2] }), GLASS)]),
  van: () => merge([paint(place(box(1.74, 1.72, 3.8), { p: [0, 1.15, 0] }), FARCOL), paint(place(box(1.76, 0.5, 3.0), { p: [0, 1.5, 0] }), GLASS)]),
  long: () => merge([paint(place(box(2.4, 2.8, 10.2), { p: [0, 1.8, 0] }), FARCOL), paint(place(box(2.42, 0.8, 9.2), { p: [0, 2.4, 0] }), GLASS)]),
  mid: () => merge([paint(place(box(2.2, 2.4, 7), { p: [0, 1.6, 0] }), FARCOL), paint(place(box(2.22, 0.7, 6.2), { p: [0, 2.2, 0] }), GLASS)]),
};

// The old Romanian saloon: long square bonnet, square boot, four square lamps, in the colours they came in
const saloon = () => merge([
  paint(place(roundedBox(1.64, 0.6, 4.28, 0.12, 1), { p: [0, 0.62, 0] }), '#ffffff'),
  paint(place(roundedBox(1.42, 0.5, 2, 0.1, 1), { p: [0, 1.15, -0.1] }), '#ffffff'),
  paint(place(box(1.3, 0.34, 1.9), { p: [0, 1.17, -0.1] }), GLASS),
  paint(place(box(1.46, 0.08, 1.7), { p: [0, 1.42, -0.1] }), '#ffffff'),
  paint(place(box(1.62, 0.2, 0.1), { p: [0, 0.5, 2.14] }), '#8d9097'),
  paint(place(box(1.62, 0.2, 0.1), { p: [0, 0.5, -2.14] }), '#8d9097'),
  ...[-0.56, 0.56].map((x) => paint(place(box(0.34, 0.24, 0.06), { p: [x, 0.74, 2.15] }), HEADL)),
  ...[-0.56, 0.56].map((x) => paint(place(box(0.34, 0.2, 0.06), { p: [x, 0.74, -2.15] }), '#d03a30')),
  ...[-1.3, 1.3].flatMap((z) => [-0.76, 0.76].map((x) => paint(place(cylinder(0.3, 0.3, 0.2, 10), { p: [x, 0.3, z], r: [0, 0, Math.PI / 2] }), TYRE))),
]);

export const VEHICLE_MODELS = {
  motor: { near: motor, mid: mid.bike, far: far.bike, tints: ['#ee5d52', '#3d88d6', '#f2c042', '#e9e4da', '#39a87a', '#b06fd4', '#44464e', '#f28bbd'] },
  ojek: { near: ojek, mid: mid.bike, far: far.bike, tints: ['#2fa84f', '#2fa84f', '#27964a'] },
  family: { near: family, mid: mid.bike, far: far.bike, tints: ['#d9483b', '#3d88d6', '#44464e'] },
  krupuk: { near: krupuk, mid: mid.load, far: far.bike, tints: ['#f5e6b8'] },
  galon: { near: galon, mid: mid.load, far: far.bike, tints: ['#7fd0f2'] },
  ayam: { near: ayam, mid: mid.load, far: far.bike, tints: ['#fbfaf2'] },
  melon: { near: melon, mid: mid.load, far: far.bike, tints: ['#6cc452'] },
  sofa: { near: sofa, mid: mid.load, far: far.bike, tints: ['#d9604f', '#4f8fc0', '#7bb05a'] },
  gerobak: { near: gerobak, far: far.car, tints: ['#c8332f'] },
  bajaj: { near: bajaj, far: far.car, tints: ['#2f7dc4', '#2f7dc4', '#2f7dc4', '#e88a2c'] },
  saloon: { near: saloon, far: far.car, tints: ['#efe7d4', '#efe7d4', '#c64a3c', '#d9b75e', '#4f7a9a', '#74966a', '#a8a39a'] },
  car: { near: () => car(), far: far.car, tints: ['#e9e9e6', '#c9ccd2', '#46494f', '#2b2d33', '#b53b34', '#e9e9e6', '#c9ccd2'] },
  mpv: { near: () => car({ tall: true }), far: far.van, tints: ['#f0efea', '#b9bcc2', '#36383e', '#23252a', '#8a2f2c'] },
  angkot: { near: angkot, far: far.van, tints: ['#6fc2e8', '#6fc2e8', '#e88d3b', '#c64a4a', '#5cb8a0'] },
  truck: { near: truck, far: far.mid, tints: ['#ffffff'] },
  metromini: { near: metromini, far: far.mid, tints: ['#ec8a2e', '#e27a26', '#3a8cc0'] },
  bus: { near: bus, far: far.long, tints: ['#2a70c8', '#2a70c8', '#2f7ccc', '#d9482f'] },
};

// The commuter train over the crossing and along the viaduct: four long cars, cream with a red and yellow stripe, a flat friendly face at each end. Runs along z, centred.
export function commuterTrain() {
  const P = [], CAR = 17.4, CARS = 4, CREAM = '#efe9dc', STRIPE = '#d8362c', YEL = '#f2bd2c', ROOF = '#a9adb4', DOOR = '#c8ccd2';
  for (let c = 0; c < CARS; c++) {
    const z = (c - (CARS - 1) / 2) * (CAR + 0.7);
    P.push(paint(place(roundedBox(3, 3.2, CAR, 0.3, 2), { p: [0, 2.5, z] }), CREAM));
    P.push(paint(place(box(3.06, 0.32, CAR - 0.3), { p: [0, 2.0, z] }), STRIPE));
    P.push(paint(place(box(3.06, 0.14, CAR - 0.3), { p: [0, 1.74, z] }), YEL));
    P.push(paint(place(roundedBox(2.5, 0.3, CAR - 1.4, 0.1, 1), { p: [0, 4.2, z] }), ROOF));
    for (const d of [-5.4, 0, 5.4]) P.push(paint(place(box(3.08, 2.3, 1.3), { p: [0, 2.15, z + d] }), DOOR));
    for (const w of [-7.3, -2.7, 2.7, 7.3]) P.push(paint(place(box(3.08, 0.8, 2.7), { p: [0, 3.05, z + w] }), GLASS));
    for (const b of [-5.5, 5.5]) {
      P.push(paint(place(box(2.5, 0.6, 2.4), { p: [0, 0.65, z + b] }), TYRE));
      for (const s of [-1, 1]) P.push(paint(place(cylinder(0.42, 0.42, 0.2, 10), { p: [s * 1.2, 0.45, z + b], r: [0, 0, Math.PI / 2] }), TYRE));
    }
  }
  for (const s of [-1, 1]) {
    const z = s * (CARS * (CAR + 0.7) / 2 - 0.2);
    P.push(paint(place(sphere(1.5, 12, 8), { p: [0, 2.7, z], s: [1, 1.08, 0.4] }), STRIPE));
    P.push(paint(place(roundedBox(2.1, 1, 0.2, 0.08, 1), { p: [0, 3.2, z + s * 0.55] }), GLASS));
    for (const x of [-0.9, 0.9]) P.push(paint(place(sphere(0.2, 8, 6), { p: [x, 2, z + s * 0.56] }), HEADL));
  }
  return merge(P);
}

// A Bucharest tram: three jointed cars in cream and red, a pantograph, the wire it runs on is the street's own. Length about 28 m.
export function bucharestTram() {
  const P = [], CAR = 8.8, CREAM = '#f1e6c8', RED = '#c9402f', ROOF = '#a9adb4';
  for (let k = 0; k < 3; k++) {
    const z = (k - 1) * (CAR + 0.5);
    P.push(paint(place(roundedBox(2.5, 2.9, CAR, 0.3, 2), { p: [0, 2.05, z] }), CREAM));
    P.push(paint(place(box(2.56, 0.9, CAR - 0.2), { p: [0, 1.05, z] }), RED));
    P.push(paint(place(box(2.56, 1, CAR - 1.6), { p: [0, 2.55, z] }), GLASS));
    P.push(paint(place(roundedBox(2, 0.26, CAR - 1, 0.08, 1), { p: [0, 3.6, z] }), ROOF));
    for (const s of [-1, 1]) P.push(paint(place(cylinder(0.36, 0.36, 2.2, 10), { p: [0, 0.38, z + s * 3], r: [0, 0, Math.PI / 2] }), TYRE));
  }
  for (const s of [-1, 1]) {
    P.push(paint(place(roundedBox(2.5, 2.8, 0.7, 0.3, 2), { p: [0, 2, s * (1.5 * CAR + 1)] }), RED));
    P.push(paint(place(box(2, 1.05, 0.08), { p: [0, 2.6, s * (1.5 * CAR + 1.35)] }), GLASS));
    for (const x of [-0.8, 0.8]) P.push(paint(place(sphere(0.17, 8, 6), { p: [x, 1.15, s * (1.5 * CAR + 1.36)] }), HEADL));
  }
  P.push(paint(place(box(0.08, 1.5, 0.08), { p: [0, 4.4, 0], r: [0.5, 0, 0] }), '#2c2c30'));
  P.push(paint(place(box(1.6, 0.06, 0.1), { p: [0, 5.15, 0.36] }), '#2c2c30'));
  return merge(P);
}

// The two pairs of gate posts at the crossing, with their signs. Set in the road's own frame: x across, z along; lamps and arms move, these stay.
export function crossingGates(HALF = 16, BACK = 7) {
  const P = [];
  for (const a of [-1, 1]) for (const s of [-1, 1]) {
    const x = a * HALF, z = s * BACK;
    P.push(paint(place(cylinder(0.14, 0.18, 3.8, 8), { p: [x, 1.9, z] }), '#f1f1ec'));
    P.push(paint(place(roundedBox(1.7, 0.34, 0.14, 0.05, 1), { p: [x, 3.2, z] }), '#26252b'));
    // the striped cross of a level crossing
    for (const r of [0.7, -0.7]) P.push(paint(place(box(1.5, 0.22, 0.06), { p: [x, 2.4, z], r: [0, 0, r] }), '#e0b628'));
    P.push(paint(place(cylinder(0.32, 0.4, 1.2, 8), { p: [x, 0.7, z + s * 0.42] }), '#55585e'));
  }
  return merge(P);
}
