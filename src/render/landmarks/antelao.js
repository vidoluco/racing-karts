// Giro dell'Antelao: Borca di Cadore in golden autumn. Facts in docs/references/antelao.md. Everything is placed by u, the
// fraction of the lap, and d, metres to the left of the road's centre, so a retuned road carries its village with it.
// Scenery only: the churches are treated with care, nothing here is ever hit, and no road runs through them.
import * as THREE from 'three';
import { hash3, lerp, smooth, linear } from '../math.js';
import { cowGeometry, blobAnimal } from '../props.js';
import { merge, paint, place, box, sphere, capsule, cylinder, gable, tube, quad, lathe } from '../shapes.js';

// Colours of the place: larch boards gone silver and brown, the pale dolomite in the walls, grey shingle.
const WOOD = '#8a5f3c', WOOD_D = '#5f4029', WOOD_L = '#b58a58', SHINGLE = '#6c645f', STONE = '#b4a596', STONE_D = '#857668', PLASTER = '#efe3cf', HAY = '#dcbc62', GERANIUM = '#e0413c', LEAF = '#4c7a3c';

const foot = (x, y, z) => lerp(0.68, 1, smooth(0, 2.2, y));

// One tabia, as they stand round Borca: a stone foot with the byre in it, log walls with the round ends crossing at the
// corners, an upper gable of vertical larch boards silvered and orange, a big braced plank door, deep eaves, shingles.
export function tabia({ w = 7, l = 9, h = 5.2, rh = 4.2, hay = true, balcony = true, seed = 1 }) {
  const parts = [], base = box(w + 0.5, h * 0.42 + 9, l + 0.5);
  place(base, { p: [0, h * 0.21 - 5.1, 0] }); parts.push(paint(base, STONE, 1, (x, y) => lerp(0.7, 1, smooth(-h * 0.2, h * 0.1, y))));
  const tint = 0.9 + 0.22 * hash3(seed, 1, 3), wood = linear(WOOD).map((v) => v * tint);
  const body = box(w + 0.14, h * 0.46, l + 0.14);
  place(body, { p: [0, h * 0.62, 0] });
  parts.push(paint(body, wood, 4));
  const { walls, roof } = gable(w, l, h * 0.86, rh, 1.05);
  parts.push(paint(place(walls, { p: [0, 0.02, 0] }), linear(WOOD_L).map((v) => v * (0.8 + 0.34 * hash3(seed, 4, 2))), 2));
  parts.push(paint(place(roof, { p: [0, 0.02, 0] }), SHINGLE, 3));
  // the log ends crossing at each corner
  const y0 = h * 0.42 + 0.1, rows = 4, step = (h * 0.34) / rows;
  for (let r = 0; r < rows; r++) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const e = cylinder(0.15, 0.15, 0.9, 6);
    if (r % 2) e.rotateX(Math.PI / 2); else e.rotateZ(Math.PI / 2);
    place(e, { p: [sx * (w / 2 + (r % 2 ? -0.1 : 0.15)), y0 + r * step + 0.15, sz * (l / 2 + (r % 2 ? 0.15 : -0.1))] });
    parts.push(paint(e, '#a67c50'));
  }
  // the opening under the ridge, with hay behind it, and the big door
  const gx = l / 2 + 0.03;
  parts.push(paint(place(box(w * 0.4, 1.3, 0.14), { p: [0, h * 0.96, gx] }), '#2a1e16'));
  if (hay) parts.push(paint(place(box(w * 0.3, 0.85, 0.1), { p: [0, h * 0.93, gx + 0.1] }), HAY));
  parts.push(paint(place(box(2.3, 2.3, 0.14), { p: [0, h * 0.42 - 0.4, gx + 0.28] }), WOOD_D, 2));
  for (const y of [0.7, 0, -0.7]) parts.push(paint(place(box(2.4, 0.2, 0.1), { p: [0, h * 0.42 - 0.4 + y, gx + 0.38] }), WOOD_L));
  if (balcony) {
    const by = h * 0.86 - 1;
    parts.push(paint(place(box(w + 0.3, 0.14, 1.1), { p: [0, by, gx + 0.5] }), WOOD_D));
    for (let i = -3; i <= 3; i++) parts.push(paint(place(box(0.16, 0.85, 0.08), { p: [i * ((w + 0.1) / 6.3), by + 0.45, gx + 1.0] }), WOOD_D));
    parts.push(paint(place(box(w + 0.3, 0.12, 0.1), { p: [0, by + 0.9, gx + 1.0] }), WOOD_D));
  }
  return merge(parts);
}

// A Borca house as they stand round the church: two to four floors of pale plaster on a stone foot, a steep grey shingle roof, small dark windows,
// often a top floor of dark larch with a balcony. Every house has its shutters, a tall one its larch floor so it never stands as a blank box;
// `near`: lit windows and flower boxes, only for the ones along the road.
const PLASTERS = ['#f4ecdc', '#efe3cf', '#f6f0e4', '#e9dcc4', '#f1e7d6'];
export function house({ w = 8, l = 10, floors = 2, rh = 4.2, seed = 2, near = true }) {
  const parts = [], fh = 2.9, H = floors * fh, plaster = PLASTERS[seed % PLASTERS.length], topWood = seed % 3 === 0 || (floors >= 3 && seed % 2 === 1);
  parts.push(paint(place(box(w + 0.3, 9.4, l + 0.3), { p: [0, -4.1, 0] }), STONE, 1));
  const { walls, roof } = gable(w, l, H, rh, 0.95);
  parts.push(paint(walls, plaster, 5), paint(roof, '#4f4a4c', 3));
  if (topWood) parts.push(paint(place(box(w + 0.12, fh, l + 0.12), { p: [0, H - fh / 2, 0] }), WOOD_D, 2));
  const win = (x, y, z, ry) => {
    const m = [paint(box(0.95, 1.25, 0.1), '#3b342d'), paint(place(box(0.72, 1.0, 0.1), { p: [0, 0, 0.05] }), '#6d6a72')];
    for (const q of [-1, 1]) m.push(paint(place(box(0.42, 1.25, 0.08), { p: [q * 0.68, 0, 0.05] }), '#7c4a33'));
    if (near) {
      m[1] = paint(place(box(0.72, 1.0, 0.1), { p: [0, 0, 0.05] }), '#ffcf88');
      m.push(paint(place(box(1.1, 0.16, 0.3), { p: [0, -0.7, 0.14] }), WOOD_D));
      m.push(paint(place(sphere(0.2, 5, 3), { p: [0, -0.54, 0.17], s: [2.2, 0.7, 0.7] }), GERANIUM));
    }
    return place(merge(m), { p: [x, y, z], r: [0, ry, 0] });
  };
  for (let f = 0; f < floors; f++) {
    const y = f * fh + 1.45;
    for (const x of [-w * 0.27, w * 0.27]) {
      if (!(f === 0 && x < 0)) parts.push(win(x, y, l / 2 + 0.04, 0));
      parts.push(win(x, y, -l / 2 - 0.04, Math.PI));
    }
    for (const z of [-l * 0.25, l * 0.25]) {
      parts.push(win(w / 2 + 0.04, y, z, Math.PI / 2));
      parts.push(win(-w / 2 - 0.04, y, z, -Math.PI / 2));
    }
  }
  // a dark wood balcony across the upper floor
  const by = H - fh + 0.1;
  parts.push(paint(place(box(w - 0.6, 0.16, 1.2), { p: [0, by, l / 2 + 0.6] }), WOOD_D));
  for (let i = -4; i <= 4; i++) parts.push(paint(place(box(0.16, 0.9, 0.08), { p: [i * ((w - 0.8) / 8), by + 0.5, l / 2 + 1.14] }), WOOD_D));
  parts.push(paint(place(box(w - 0.6, 0.12, 0.12), { p: [0, by + 0.98, l / 2 + 1.14] }), WOOD_D));
  parts.push(paint(place(box(1.5, 2.3, 0.14), { p: [w * 0.26 - w * 0.53, 1.0, l / 2 + 0.05] }), '#5e3a25', 2));
  return merge(parts);
}

// The parish church of Borca: a white nave with a steep grey roof, a rounded apse, and its slim campanile.
function church() {
  const parts = [], nw = 11, nl = 21, nh = 9.5;
  const { walls, roof } = gable(nw, nl, nh, 6.2, 0.7);
  parts.push(paint(place(box(nw + 0.3, 5, nl + 0.3), { p: [0, -2.4, 0] }), STONE, 1));
  parts.push(paint(walls, '#f2e6d4', 5, foot));
  parts.push(paint(roof, '#6e665f', 3));
  // the apse
  parts.push(paint(place(lathe([[3.9, -3], [3.9, 8.1]], 16), { p: [0, 0, -nl / 2] }), '#f2e6d4', 5, foot));
  parts.push(paint(place(lathe([[4.4, 7.9], [3.2, 9.4], [0, 11.8]], 16), { p: [0, 0, -nl / 2] }), '#6e665f', 3));
  // the low side chapel with its own shingle roof
  const ch = gable(6.5, 8, 4.4, 2.8, 0.45);
  place(ch.walls, { p: [-nw / 2 - 3, 0, 1] }); place(ch.roof, { p: [-nw / 2 - 3, 0, 1] });
  parts.push(paint(ch.walls, '#f2e6d4', 5, foot), paint(ch.roof, '#6e665f', 3));
  parts.push(paint(place(box(6.8, 4, 8.3), { p: [-nw / 2 - 3, -1.8, 1] }), STONE, 1));
  // a front with a round window and a door
  parts.push(paint(place(box(2.6, 4.2, 0.2), { p: [0, 1.7, nl / 2 + 0.1] }), '#5c3b28', 2));
  parts.push(paint(place(cylinder(1.3, 1.3, 0.22, 16), { p: [0, 3.8, nl / 2 + 0.1], r: [Math.PI / 2, 0, 0], s: [1, 1, 1] }), '#5c3b28', 2));
  parts.push(paint(place(cylinder(1.25, 1.25, 0.24, 18), { p: [0, 9.8, nl / 2 + 0.1], r: [Math.PI / 2, 0, 0] }), '#c98f58'));
  parts.push(paint(place(cylinder(0.9, 0.9, 0.3, 18), { p: [0, 9.8, nl / 2 + 0.12], r: [Math.PI / 2, 0, 0] }), '#ffd69a'));
  for (const s of [-1, 1]) for (const z of [-6, 0, 6]) {
    parts.push(paint(place(capsule(0.62, 2.3, 3, 9), { p: [s * (nw / 2 + 0.05), 5.6, z], s: [0.2, 1, 1] }), '#ffcf8a'));
    parts.push(paint(place(capsule(0.78, 2.5, 3, 9), { p: [s * (nw / 2 + 0.02), 5.6, z], s: [0.16, 1, 1] }), '#a58d70'));
  }
  // the campanile, as it stands in Borca: a dark stone foot, a slim shaft of white plaster panels between grey stone corners, a big white clock, an open belfry, a dark shingled onion with a small figure on top
  const T = [], tw = 5.8, th = 31, tx = nw / 2 + tw / 2 + 0.4, tz = nl / 2 - 3, WHITE = '#f6f1e6', CORNER = '#a89f93', ONION = '#4a4a4f';
  T.push(paint(place(box(tw + 1.2, 9, tw + 1.2), { p: [0, 1.1, 0] }), '#6f675e', 1));
  T.push(paint(place(box(tw + 1.6, 0.5, tw + 1.6), { p: [0, 5.7, 0] }), STONE_D));
  // the shaft: corners, and the white panel on each face
  T.push(paint(place(box(tw, th - 6, tw), { p: [0, (th + 6) / 2, 0] }), CORNER, 5));
  for (let f = 0; f < 4; f++) {
    const a = (f * Math.PI) / 2, panel = paint(box(tw - 1.1, th - 8.4, 0.12), WHITE, 5);
    place(panel, { p: [Math.sin(a) * (tw / 2 + 0.03), (th + 6) / 2 - 0.2, Math.cos(a) * (tw / 2 + 0.03)], r: [0, a, 0] });
    T.push(panel);
    for (const y of [10, 13.5, 17]) T.push(place(paint(box(0.4, 0.8, 0.1), '#3a3430'), { p: [Math.sin(a) * (tw / 2 + 0.09), y, Math.cos(a) * (tw / 2 + 0.09)], r: [0, a, 0] }));
    // the big white clock, with its hours marked
    const clock = [paint(place(cylinder(1.35, 1.35, 0.16, 24), { r: [Math.PI / 2, 0, 0] }), '#fbf6ea'), paint(place(box(0.13, 1.05, 0.06), { p: [0, 0.44, 0.1] }), '#2a2422'), paint(place(box(0.9, 0.11, 0.06), { p: [0.38, 0, 0.1] }), '#2a2422')];
    for (let hr = 0; hr < 12; hr++) { const t = (hr * Math.PI) / 6; clock.push(paint(place(box(0.08, 0.24, 0.05), { p: [Math.sin(t) * 1.13, Math.cos(t) * 1.13, 0.09], r: [0, 0, -t] }), '#2a2422')); }
    const hands = merge(clock);
    place(hands, { p: [Math.sin(a) * (tw / 2 + 0.1), th - 5.6, Math.cos(a) * (tw / 2 + 0.1)], r: [0, a, 0] });
    T.push(hands);
    // the open belfry arch
    const arch = paint(place(capsule(0.86, 2.2, 4, 10), { s: [1, 1, 0.2] }), '#1f1a19');
    place(arch, { p: [Math.sin(a) * (tw / 2 + 0.02), th + 1.6, Math.cos(a) * (tw / 2 + 0.02)], r: [0, a, 0] });
    T.push(arch);
  }
  T.push(paint(place(box(tw + 0.5, 0.42, tw + 0.5), { p: [0, th - 2.3, 0] }), STONE_D));
  // the belfry storey
  T.push(paint(place(box(tw - 0.1, 5.4, tw - 0.1), { p: [0, th + 0.5, 0] }), WHITE, 5));
  T.push(paint(place(box(tw + 0.6, 0.5, tw + 0.6), { p: [0, th + 3.4, 0] }), STONE_D));
  T.push(paint(place(cylinder(0.62, 0.9, 1.3, 12), { p: [0, th + 0.8, 0] }), '#c9963c'));
  // the onion, with its neck and the little figure
  const cap = lathe([[tw * 0.42, 0], [tw * 0.3, 0.9], [tw * 0.5, 2.6], [tw * 0.42, 4.2], [tw * 0.13, 5.8], [0.16, 7.4], [0, 7.8]], 12);
  place(cap, { p: [0, th + 3.6, 0] });
  T.push(paint(cap, ONION, 3));
  T.push(paint(place(capsule(0.16, 0.9, 3, 6), { p: [0, th + 11.9, 0] }), '#c7a24a'));
  parts.push(place(merge(T), { p: [tx, 0, tz] }));
  return merge(parts);
}

// Nostra Signora del Cadore, as it stands: a giant equilateral A, the dark shingled slopes reaching almost to the ground;
// the gable set back, in warm larch planks, with two big pale concrete ribs leaning together and a gold double cross in
// the middle; a low green edged porch across the base; a thin steel spire rising behind. A cartoon of it, with respect.
function gellnerChurch() {
  const parts = [], W = 13.5, L = 28, H = 25, CON = '#c4bcb0', SLATE = '#3f3c42', BACK = 3.2;
  const slope = (s, a0, a1, top0, top1) => (s > 0 ? quad([s * a0, 0.4, L / 2], [s * a1, 0.4, -L / 2], [s * top1, H, -L / 2], [s * top0, H, L / 2]) : quad([s * a1, 0.4, -L / 2], [s * a0, 0.4, L / 2], [s * top0, H, L / 2], [s * top1, H, -L / 2]));
  for (const s of [-1, 1]) {
    parts.push(paint(slope(s, W, W, 0, 0), SLATE, 3));
    // the big glass inserts in the slopes
    for (const z of [-7, 2]) parts.push(paint(place(box(0.1, 8, 3.2), { p: [s * W * 0.52, H * 0.48, z], r: [0, 0, s * -Math.atan2(W, H)] }), '#ffd59a'));
  }
  // under the slopes, so that no light passes through at the foot
  parts.push(paint(place(box(W * 1.86, 6, L - 0.4), { p: [0, -2.4, 0] }), CON));
  // the gable set back: larch planks in a triangle
  const tri = new THREE.BufferGeometry(), z0 = L / 2 - BACK, tw = W * (1 - 0.4 / H) - 0.2;
  tri.setAttribute('position', new THREE.Float32BufferAttribute([-tw, 0.4, z0, tw, 0.4, z0, 0, H - 0.4, z0], 3));
  tri.setIndex([0, 1, 2]); tri.computeVertexNormals();
  parts.push(paint(tri, '#a2683c', 2));
  // the two ribs, leaning together inside the triangle, and the steel ties
  const rib = (x0, r) => paint(tube([[x0, 0.4, z0 + 0.7], [x0 * 0.5, H * 0.5, z0 + 0.8], [0, H - 1.4, z0 + 0.9]], r, 6), CON);
  parts.push(rib(tw * 0.62, 0.8), rib(-tw * 0.62, 0.8));
  for (const [ax, ay, bx, by] of [[-tw * 0.7, 2, tw * 0.28, H * 0.68], [tw * 0.7, 2, -tw * 0.28, H * 0.68]]) parts.push(paint(tube([[ax, ay, z0 + 0.4], [bx, by, z0 + 0.4]], 0.09, 4), '#4a4a50'));
  // the gold double cross
  parts.push(paint(place(box(0.34, 5.4, 0.2), { p: [0, H * 0.5, z0 + 1.0] }), '#d9b04a'));
  for (const [y, w] of [[H * 0.5 + 1.5, 2.2], [H * 0.5 + 0.2, 3.2]]) parts.push(paint(place(box(w, 0.3, 0.2), { p: [0, y, z0 + 1.0] }), '#d9b04a'));
  // the front edges of the slopes
  for (const s of [-1, 1]) parts.push(paint(tube([[s * W, 0.4, L / 2], [0, H, L / 2]], 0.42, 5), SLATE));
  parts.push(paint(tube([[0, H, L / 2], [0, H, -L / 2]], 0.42, 5), SLATE));
  // the low porch across the base, green edged, wooden doors, chunky piers
  parts.push(paint(place(box(W * 1.5, 0.5, 4), { p: [0, 3.5, L / 2 - 1] }), '#4f7a5e'));
  for (const x of [-1, -0.34, 0.34, 1]) parts.push(paint(place(box(1, 3.6, 1.4), { p: [x * W * 0.68, 1.4, L / 2 + 0.3] }), CON));
  parts.push(paint(place(box(5, 2.9, 0.16), { p: [0, 1.4, z0 + 0.25] }), '#5c3b28', 2));
  // the thin steel spire behind, not touching the roof
  const sp = [];
  for (let i = 0; i < 3; i++) { const a = i * 2.094 + 0.3; sp.push(paint(tube([[Math.sin(a) * 1.4, 0, Math.cos(a) * 1.4], [Math.sin(a) * 0.6, 20, Math.cos(a) * 0.6], [0, 40, 0]], [0.2, 0.14, 0.06], 4), '#8d9096')); }
  parts.push(place(merge(sp), { p: [0, 0, -L / 2 - 8] }));
  return merge(parts);
}

// A villa of the Corte: small, low and long, raised on raw concrete walls under a single pitched roof, dark wood and long windows divided by their frames.
function villa() {
  const parts = [], w = 6, l = 12;
  parts.push(paint(place(box(w - 0.6, 11, l - 1.2), { p: [0, -4.4, 0] }), '#a39b90', 1));
  parts.push(paint(place(box(w, 2.9, l), { p: [0, 2.55, 0] }), '#6a4a34', 2));
  for (const s of [-1, 1]) {
    parts.push(paint(place(box(0.1, 1.1, l * 0.74), { p: [s * (w / 2 + 0.02), 2.75, 0] }), '#f3c98a'));
    for (let i = -4; i <= 4; i++) parts.push(paint(place(box(0.12, 1.2, 0.16), { p: [s * (w / 2 + 0.04), 2.75, i * (l * 0.74 / 8)] }), '#3a2a20'));
    parts.push(paint(place(box(0.5, 0.14, l * 0.84), { p: [s * (w / 2 + 0.26), 1.75, 0] }), '#4a3426'));
  }
  const roof = box(w + 1.6, 0.26, l + 1.4);
  place(roof, { p: [0, 4.45, 0], r: [0, 0, 0.26] });
  parts.push(paint(roof, '#4b4648', 3));
  return merge(parts);
}

// One of the little A-frame cabins of the camp in the wood.
function cabin() {
  const parts = [], { walls, roof } = gable(4.4, 6, 0.4, 5, 0.6);
  parts.push(paint(place(box(4.2, 8, 5.8), { p: [0, -3.7, 0] }), '#bdb6ac'));
  parts.push(paint(walls, '#6d4a31', 2), paint(roof, '#4b4648', 3));
  return merge(parts);
}

// A round bale lying on its side, net wrapped or in white film: the bands round it, the end's rings and the seam are what says bale and not pumpkin. Its axis is x, its base at y = 0.
export function hayBale(film = false) {
  const r = 0.74, len = 1.2, body = film ? '#dfe4d6' : '#d6c07c', band = film ? '#b9c2b2' : '#a8905a', end = film ? '#cdd4c6' : '#c2a862', core = film ? '#eef0e6' : '#b0924e';
  const lie = (g, c, y = r, shade = null) => paint(place(g, { p: [0, y, 0], r: [0, 0, Math.PI / 2] }), c, 0, shade);
  const parts = [lie(cylinder(r, r, len, 16), body, r, (x, y) => lerp(0.74, 1.04, smooth(0, r * 1.5, y)))];
  for (const x of film ? [-0.3, 0.3] : [-0.42, -0.14, 0.14, 0.42]) parts.push(paint(place(cylinder(r + 0.012, r + 0.012, film ? 0.035 : 0.05, 16, true), { p: [x, r, 0], r: [0, 0, Math.PI / 2] }), band));
  parts.push(lie(cylinder(r * 0.66, r * 0.66, len + 0.02, 14), end), lie(cylinder(r * 0.56, r * 0.56, len + 0.03, 14), film ? end : body), lie(cylinder(r * 0.28, r * 0.28, len + 0.04, 10), core));
  return merge(parts);
}

// A hay rack: the long wooden frame the Cadore meadows dry hay on, half loaded.
export function hayRack(len = 9) {
  const parts = [];
  for (let i = 0; i <= 4; i++) parts.push(paint(place(cylinder(0.09, 0.12, 3, 5), { p: [(i / 4 - 0.5) * len, 1.4, 0], r: [0.06, 0, 0] }), WOOD_D));
  for (const y of [0.9, 1.5, 2.1, 2.7]) parts.push(paint(tube([[-len / 2, y, 0], [len / 2, y, 0]], 0.05, 4), WOOD_L));
  parts.push(paint(place(capsule(0.4, len * 0.82, 3, 7), { p: [0, 1.8, 0], r: [0, 0, Math.PI / 2], s: [1, 1, 0.55] }), HAY));
  return merge(parts);
}

export function woodPile(n = 18) {
  const parts = [], rows = Math.ceil(Math.sqrt(n));
  let c = 0;
  for (let r = 0; r < rows; r++) for (let i = 0; i < rows - r && c < n; i++, c++) {
    const log = cylinder(0.3, 0.3, 3.2, 7); log.rotateX(Math.PI / 2);
    place(log, { p: [(i - (rows - r - 1) / 2) * 0.62, 0.3 + r * 0.53, 0] });
    parts.push(paint(log, hash3(i, r, 3) < 0.5 ? '#b58a58' : '#a07444'));
    const end = cylinder(0.26, 0.26, 0.06, 7); end.rotateX(Math.PI / 2);
    place(end, { p: [(i - (rows - r - 1) / 2) * 0.62, 0.3 + r * 0.53, 1.62] });
    parts.push(paint(end, '#ecd2a0'));
  }
  return merge(parts);
}

// A Cadore rail fence along a line, diagonal stakes in pairs. Only as many as it needs: it runs hundreds of metres.
export function fenceRun(from, to, ground) {
  const parts = [], len = Math.hypot(to[0] - from[0], to[1] - from[1]), n = Math.max(2, Math.round(len / 3.2));
  const yaw = Math.atan2(to[0] - from[0], to[1] - from[1]);
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = lerp(from[0], to[0], t), z = lerp(from[1], to[1], t), y = ground(x, z);
    for (const s of [-1, 1]) parts.push(paint(place(cylinder(0.06, 0.07, 1.9, 4), { p: [x, y + 0.72, z], r: [0, yaw, s * 0.42] }), WOOD_D));
    if (i < n) {
      const x2 = lerp(from[0], to[0], (i + 1) / n), z2 = lerp(from[1], to[1], (i + 1) / n), y2 = ground(x2, z2);
      for (const h of [0.62, 1.12]) parts.push(paint(tube([[x, y + h, z], [x2, y2 + h, z2]], 0.05, 3), WOOD_L));
    }
  }
  return merge(parts);
}

// The little text atlas for road signs and the start banner. Fonts are the browser's sans: this is a road sign.
function signAtlas(list) {
  const W = 1024, rowH = 128, cv = document.createElement('canvas');
  cv.width = W; cv.height = rowH * list.length;
  const g = cv.getContext('2d');
  list.forEach((s, i) => {
    const y = i * rowH;
    g.fillStyle = s.bg; g.fillRect(0, y, W, rowH);
    g.strokeStyle = s.ink; g.lineWidth = 8; g.strokeRect(10, y + 10, W - 20, rowH - 20);
    g.fillStyle = s.ink; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `bold ${s.size || 78}px Arial Rounded MT Bold, Helvetica, Arial, sans-serif`;
    g.fillText(s.text, W / 2, y + rowH / 2 + 4);
  });
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return { texture: t, rows: list.length };
}
function signPlane(w, h, row, rows) {
  const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - (row + (1 - uv.getY(i))) / rows);
  return g;
}

export function plan({ track, terrain, world }) {
  const P = (u) => track.pointAt(u), add = (u, r, cover, kinds) => { const p = P(u); world.groves.push({ x: p.x, z: p.z, r, cover, kinds }); };
  // first match wins for the kinds: the churchyard pines, the larch wood of the hairpins, the valley's mix elsewhere
  add(0.505, 90, 0.5, [['pine', 6], ['spruce', 4]]);
  add(0.58, 150, 0.55, [['larch', 7], ['spruce', 3]]);
  add(0.285, 105, -0.9); // the far bank, open meadow
  add(0.25, 90, -0.6);
  add(0.68, 110, -0.9); // the high pasture
  add(0.75, 90, -0.8);
  add(0.82, 110, -0.8); // the sprint's fields
  add(0.90, 90, -0.6);
  add(0.98, 95, -1); // Borca
  { const p = P(0.96); world.groves.push({ x: p.x + p.nx * 75, z: p.z + p.nz * 75, r: 70, cover: -1.3 }); }
  add(0.02, 90, -1);
  add(0.06, 90, -0.4);
  add(0.125, 85, 0.1);
  add(0.385, 60, 0.15);
  // the sightline to the Antelao from the start straight: no wood stands in it, so the mountain comes all the way down behind the viaduct
  const clear = (u, d, r, cover = -1.2) => { const p = P(u); world.groves.push({ x: p.x + p.nx * d, z: p.z + p.nz * d, r, cover }); };
  clear(0.07, 70, 120); clear(0.11, 90, 130); clear(0.15, 110, 130); clear(0.17, 40, 90);
  // wherever the road runs at one of the two great mountains, the wood stands aside along the line of sight: a 20 m spruce 120 m ahead stands 9 degrees high and hid the whole foot of the painting
  const seen = new Set(), NORTH = -61;
  for (const az of [63.7 - NORTH, 253.5 - NORTH].map((v) => v * Math.PI / 180)) {
    const dx = Math.sin(az), dz = -Math.cos(az);
    for (let u = 0; u < 1; u += 0.01) {
      const p = P(u);
      if (p.tx * dx + p.tz * dz < 0.86) continue;
      for (const dist of [70, 130, 200, 290, 400, 530]) {
        const x = p.x + dx * dist, z = p.z + dz * dist, key = `${Math.round(x / 70)},${Math.round(z / 70)}`, ch = P(0.512), cx = ch.x + ch.nx * -54, cz = ch.z + ch.nz * -54;
        if (seen.has(key) || Math.hypot(x - cx, z - cz) < 110) continue;
        seen.add(key);
        world.groves.push({ x, z, r: dist * 0.26 + 26, cover: -1.1 });
      }
    }
  }
  // lone larches in the open meadows, as the real pastures keep them, standing to the side of the road
  for (let i = 0; i < 46; i++) {
    const u = [0.24, 0.27, 0.3, 0.66, 0.7, 0.74, 0.78, 0.81, 0.09, 0.12][i % 10] + 0.018 * (hash3(i, 7, 51) - 0.5), s = i % 2 ? 1 : -1, d = s * (26 + 62 * hash3(i, 8, 51)), p = P(u), x = p.x + p.nx * d, z = p.z + p.nz * d;
    if (terrain.roadDistAt(x, z) > 18) world.plant.push({ x, z, kind: 'larch', h: 11 + 8 * hash3(i, 9, 51) });
  }
  const keep = world.keepOut;
  world.buildings = [];
  const site = (kind, u, d, opts = {}) => {
    const p = P(u), at = (dd) => [p.x + p.nx * dd + p.tx * (opts.along || 0), p.z + p.nz * dd + p.tz * (opts.along || 0)];
    // a building whose site falls by another stretch of the road, where the road loops back past it, moves the least it can along its own
    // line until its middle is opts.clear m from any road's edge: two cabins once stood in the road at u 0.54, and the farmyard's barn in
    // the second road of its bend
    if (opts.clear) for (let k = 0, d0 = d; k < 80 && terrain.roadDistAt(...at(d)) < opts.clear; k++) d = d0 + (k % 2 ? -1 : 1) * Math.ceil((k + 1) / 2) * 0.5;
    const [x, z] = at(d);
    // a model's +z faces the road, unless it says otherwise
    const yaw = Math.atan2(-p.nx * Math.sign(d), -p.nz * Math.sign(d)) + (opts.turn || 0);
    world.buildings.push({ kind, x, z, yaw, u, d, ...opts });
    keep.push({ x, z, r: opts.r ?? 11 });
  };
  // Borca, along the run in and the start
  site('church', 0.97, 38, { r: 30, turn: 0.5 });
  // a compact village: houses shoulder to shoulder along the road, more of them behind, higher toward the church
  for (const [u, d, floors, seed, turn] of [
    [0.955, 21, 3, 3, 0], [0.985, -19, 3, 2, 0.1], [0.962, -22, 2, 5, -0.2], [0.005, 20, 3, 4, 0], [0.018, 22, 2, 7, 0.2], [0.012, -20, 3, 6, -0.15], [0.03, -24, 2, 8, 0],
    [0.945, -21, 2, 1, 0.1], [0.975, -25, 4, 9, 0.05], [0.998, -23, 3, 10, -0.1], [0.995, 21, 2, 11, 0.12], [0.022, -21, 3, 12, 0.1], [0.038, 24, 2, 13, -0.1],
  ]) site('house', u, d - Math.sign(d) * 3, { seed, floors, turn, r: 10, near: true });
  for (const [u, d, floors, seed, turn] of [
    [0.95, -38, 3, 14, 0.3], [0.965, -42, 4, 15, -0.2], [0.98, -44, 3, 16, 0.1], [0.993, -40, 4, 17, -0.3], [0.008, -41, 3, 18, 0.2], [0.02, -43, 2, 19, -0.1], [0.032, -42, 3, 20, 0.3],
    [0.99, 38, 4, 21, -0.2], [0.003, 40, 3, 22, 0.15], [0.015, 42, 4, 23, -0.1], [0.028, 40, 2, 24, 0.25], [0.94, -56, 2, 25, 0.4], [0.97, -60, 3, 26, -0.3], [0.0, -60, 3, 27, 0.2], [0.018, -60, 2, 28, -0.2],
    [0.004, 58, 2, 29, 0.2], [0.02, 60, 3, 30, -0.3],
  ]) if (terrain.roadDistAt(P(u).x + P(u).nx * d, P(u).z + P(u).nz * d) > 11) site('house', u, d, { seed, floors, turn, r: 9, near: false });
  // Borca climbs its terrace behind the church: white plaster and dark roofs that read from the far side of the valley
  for (const [u, d, floors, seed, turn] of [
    [0.93, 62, 3, 31, 0.2], [0.945, 74, 2, 32, -0.3], [0.955, 66, 3, 33, 0.4], [0.965, 84, 3, 34, 0.1], [0.98, 76, 2, 35, -0.2], [0.992, 70, 3, 36, 0.3],
    [0.94, 94, 2, 37, -0.1], [0.96, 104, 3, 38, 0.2], [0.975, 98, 2, 39, -0.4], [0.99, 92, 3, 40, 0.1], [0.008, 78, 2, 41, 0.2], [0.92, 44, 2, 42, 0.3],
  ]) if (terrain.roadDistAt(P(u).x + P(u).nx * d, P(u).z + P(u).nz * d) > 11) site('house', u, d, { seed, floors, turn, r: 9, near: false });
  site('tabia', 0.045, 19, { seed: 2, r: 9 });
  // the sweepers' barns, in a group as they really stand, on the side away from the river
  site('tabia', 0.09, 21, { seed: 3, r: 9, turn: 0.2 });
  site('tabia', 0.11, 27, { seed: 4, r: 9, turn: -0.3, hay: false });
  site('tabia', 0.128, 22, { seed: 5, r: 9, turn: 0.45 });
  site('tabia', 0.078, -22, { seed: 6, r: 9, balcony: false });
  // Corte di Cadore
  site('gellner', 0.512, -54, { r: 34, turn: Math.PI * 0.06 });
  site('villa', 0.482, -24, { r: 9, seed: 2, turn: -0.3 });
  site('villa', 0.535, 28, { r: 9, seed: 4, turn: 0.6 });
  site('cabin', 0.503, 44, { r: 6, turn: 0.7, clear: 6 });
  site('cabin', 0.515, 46, { r: 6, turn: -0.2, clear: 6 }); // u 0.508, 38 m: cleared of the road it fell on its neighbour's spot, one roof through the other
  site('cabin', 0.475, -30, { r: 6, turn: 0.9, clear: 6 });
  // the farmyard bend, in the middle of the two roads
  site('tabia', 0.862, -29, { seed: 8, r: 15, big: true, turn: 0.6, clear: 10 });
  site('tabia', 0.79, 22, { seed: 9, r: 9, turn: -0.3 });
  site('tabia', 0.76, -24, { seed: 10, r: 9, turn: 0.3, balcony: false });
  site('tabia', 0.31, 22, { seed: 11, r: 9, turn: 0.3 });
  site('tabia', 0.262, -24, { seed: 12, r: 9, turn: -0.4 });
  site('tabia', 0.725, 25, { seed: 13, r: 9, turn: 0.5, hay: false });
  site('tabia', 0.688, -30, { seed: 14, r: 9, turn: 0.2 });
  // the pines of the Corte, planted where the church wants them, so it reads as a clearing in a wood
  const pines = (u, d, n, spread) => {
    const p = P(u), cx = p.x + p.nx * d, cz = p.z + p.nz * d;
    for (let i = 0; i < n; i++) {
      const a = hash3(i, 3, 41) * 6.28, r = spread * (0.45 + 0.55 * hash3(i, 4, 41));
      const x = cx + Math.sin(a) * r, z = cz + Math.cos(a) * r;
      if (terrain.roadDistAt(x, z) > 7) world.plant.push({ x, z, kind: i % 3 ? 'pine' : 'spruce', h: 18 + 12 * hash3(i, 5, 41) });
    }
  };
  pines(0.512, -54, 26, 48);
  pines(0.49, -62, 12, 26);
}

export function build({ track, batch, mat, world }) {
  const groundAt = world.ground.groundAt, B = batch, foots = (x, z) => groundAt(x, z);
  for (const b of world.buildings) {
    // on a slope a building stands level on its uphill corner, the stone foot taking up the fall: the ground never cuts through its walls
    const rr = b.kind === 'church' || b.kind === 'gellner' ? 0 : 5.5;
    const y0 = foots(b.x, b.z);
    let y = y0;
    if (rr) for (const [ax, az] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) y = Math.max(y, foots(b.x + ax * rr, b.z + az * rr));
    // a little only: more and the stone foot becomes a tower; the rest of the slope goes into the hill behind it, as a barn is built
    y = Math.min(y, y0 + 1.6) - 0.05;
    let g, r = 9;
    if (b.kind === 'tabia') { g = tabia({ ...b, seed: b.seed, w: b.big ? 10 : 7, l: b.big ? 13 : 9, h: b.big ? 7 : 5.2, rh: b.big ? 5.6 : 4.2 }); }
    else if (b.kind === 'house') { g = house({ seed: b.seed, floors: Math.min(3, b.floors), w: b.floors >= 3 ? 10 : 8, l: b.floors >= 3 ? 12 : 10, rh: b.floors >= 3 ? 5 : 4.2, near: b.near }); r = 10; }
    else if (b.kind === 'church') { g = church(); r = 22; }
    else if (b.kind === 'gellner') { g = gellnerChurch(); r = 30; }
    else if (b.kind === 'villa') { g = villa(); r = 8; }
    else if (b.kind === 'cabin') { g = cabin(); r = 5; }
    place(g, { p: [b.x, y, b.z], r: [0, b.yaw, 0] });
    B.add(g);
    B.blob(b.x, b.z, r, 0.5);
  }

  const P = (u) => track.pointAt(u);
  const atRoad = (u, d, along = 0) => { const p = P(u); const x = p.x + p.nx * d + p.tx * along, z = p.z + p.nz * d + p.tz * along; return { x, z, y: groundAt(x, z), yaw: Math.atan2(p.tx, p.tz), p }; };

  // hay in the meadows
  for (const [u, d, n] of [[0.26, 16, 3], [0.3, -18, 2], [0.68, 15, 3], [0.71, -17, 3], [0.77, 15, 2], [0.8, -19, 3], [0.91, -15, 2]]) {
    for (let i = 0; i < n; i++) {
      const a = atRoad(u + i * 0.004, d + (i % 2) * 3, 0), g = hayBale(hash3(i, u * 97, 5) > 0.62);
      // it sits on the ground, on the slope's low side: never half buried
      place(g, { p: [a.x, Math.min(a.y, groundAt(a.x + 0.6, a.z), groundAt(a.x - 0.6, a.z), groundAt(a.x, a.z + 0.6), groundAt(a.x, a.z - 0.6)) - 0.03, a.z], r: [0, a.yaw + 0.6 * hash3(i, 3, 3), 0] });
      B.add(g); B.blob(a.x, a.z, 1.55, 0.8);
    }
  }
  for (const [u, d, turn] of [[0.27, -16, 0.2], [0.665, 18, -0.2], [0.74, 20, 0.1], [0.82, 18, -0.4], [0.11, -18, 0.2]]) {
    const a = atRoad(u, d), g = hayRack(); place(g, { p: [a.x, a.y, a.z], r: [0, a.yaw + Math.PI / 2 * 0 + turn, 0] }); B.add(g); B.blob(a.x, a.z, 4.5, 0.5);
  }
  for (const [u, d] of [[0.175, 12.5], [0.148, -12.5], [0.52, 14], [0.47, -12], [0.04, -13.2], [0.89, -13.5], [0.935, 13.5]]) {
    const a = atRoad(u, d), g = woodPile(); place(g, { p: [a.x, a.y, a.z], r: [0, a.yaw + Math.PI / 2, 0] }); B.add(g); B.blob(a.x, a.z, 3.2, 0.7);
  }

  // the pasture: the herd with their bells, the zig-zag fence, the road's stone kerbs through the hairpins
  const cow = cowGeometry();
  for (const [u, d, turn] of [[0.672, 26, 1.1], [0.678, 34, 2.4], [0.686, 24, 0.2], [0.69, 40, -1], [0.70, 30, 3], [0.71, -28, 0.5], [0.72, -36, 2.1], [0.915, 26, 0.8], [0.905, 31, -0.9]]) {
    const a = atRoad(u, d), g = cow.clone(); place(g, { p: [a.x, a.y - 0.02, a.z], r: [0, a.yaw + turn, 0], s: 1.05 }); B.add(g); B.blob(a.x, a.z, 2.8, 0.45);
  }
  const fence = (u0, u1, d, step = 0.008) => {
    let last = null;
    for (let u = u0; u <= u1 + 1e-6; u += step) {
      const p = atRoad(u, Math.sign(d) * (P(u).w / 2 + 3.2)), xz = [p.x, p.z];
      if (last) B.add(fenceRun(last, xz, foots));
      last = xz;
    }
  };
  fence(0.66, 0.698, 14.5); fence(0.665, 0.692, -14); fence(0.905, 0.916, 12.5); fence(0.935, 0.944, 12.5); fence(0.905, 0.916, -12.5); fence(0.935, 0.944, -12.5);
  fence(0.725, 0.775, 13); fence(0.77, 0.81, -13.5); fence(0.275, 0.3, 12.5);

  // cattle gate where the cows cross: two open swing gates and a bell on a post
  for (const s of [-1, 1]) {
    const a = atRoad(0.925, s * 10.5), parts = [];
    parts.push(paint(place(cylinder(0.2, 0.24, 2.6, 7), { p: [0, 1.25, 0] }), WOOD_D));
    for (const h of [0.7, 1.3, 1.9]) parts.push(paint(place(box(0.1, 0.14, 3.8), { p: [0, h, 1.8] }), WOOD_L));
    parts.push(paint(tube([[0, 0.55, 3.6], [0, 2.1, 0.1]], 0.06, 4), WOOD_L));
    const g = merge(parts); place(g, { p: [a.x, a.y, a.z], r: [0, a.yaw + (s > 0 ? 0.8 : 2.2), 0] }); B.add(g);
  }

  // the old railway's signal; no telegraph poles on the viaduct: from the SS51 they stand across the Antelao
  const S0 = track.structures.find((s) => s.kind === 'viaduct');
  if (S0) {
    const u = S0.to + 0.004, p = P(u), side = p.w / 2 + 2.2, x = p.x + p.nx * side, z = p.z + p.nz * side, y = groundAt(x, z), parts = [];
    parts.push(paint(place(cylinder(0.1, 0.14, 7.8, 6), { p: [0, 3.9, 0] }), '#5a5358'));
    parts.push(paint(place(box(1.9, 0.42, 0.1), { p: [0.8, 7.2, 0], r: [0, 0, 0.5] }), '#d9483b'));
    parts.push(paint(place(box(0.46, 0.44, 0.1), { p: [1.4, 7.5, 0.02], r: [0, 0, 0.5] }), '#f6efd8'));
    const g = merge(parts); place(g, { p: [x, y, z], r: [0, Math.atan2(p.tx, p.tz) + Math.PI, 0] }); B.add(g);
  }

  // the signs: a little atlas of real names and big chevrons at the hairpins, on real posts
  const SIGNS = [
    { text: 'BORCA DI CADORE', bg: '#f6f0da', ink: '#26222a', size: 76 },
    { text: 'FIUME BOITE', bg: '#2d6fb5', ink: '#f7f3e6', size: 88 },
    { text: 'SS 51 DI ALEMAGNA', bg: '#2d6fb5', ink: '#f7f3e6', size: 72 },
    { text: 'CORTE DI CADORE', bg: '#7b4a2a', ink: '#f7e9c8', size: 76 },
    { text: 'CICLABILE DELLE DOLOMITI', bg: '#7b4a2a', ink: '#f7e9c8', size: 58 },
    { text: 'MUCCHE!', bg: '#fbf7ea', ink: '#c9382c', size: 96 },
    { text: 'VIA', bg: '#ffffff', ink: '#26222a', size: 96 },
    { text: 'GIRO DELL\'ANTELAO', bg: '#c9382c', ink: '#fff6dc', size: 80 },
    { text: '>>>>>>', bg: '#fbf7ea', ink: '#26222a', size: 110 },
  ];
  const atlas = signAtlas(SIGNS), planes = [];
  const sign = (u, d, row, w = 5, h = 1.1, hp = 2.2, turn = 0) => {
    const a = atRoad(u, d), yaw = a.yaw + Math.PI + turn;
    B.add(paint(place(box(0.2, hp + h, 0.2), { p: [a.x + Math.cos(yaw) * (w * 0.42), a.y + (hp + h) / 2, a.z - Math.sin(yaw) * (w * 0.42)] }), '#6e6770'));
    B.add(paint(place(box(0.2, hp + h, 0.2), { p: [a.x - Math.cos(yaw) * (w * 0.42), a.y + (hp + h) / 2, a.z + Math.sin(yaw) * (w * 0.42)] }), '#6e6770'));
    B.add(paint(place(box(w + 0.2, h + 0.18, 0.14), { p: [a.x - Math.sin(yaw) * 0.09, a.y + hp + h / 2, a.z - Math.cos(yaw) * 0.09], r: [0, yaw, 0] }), '#3b363c'));
    const g = signPlane(w, h, row, atlas.rows);
    place(g, { p: [a.x + Math.sin(yaw) * 0.0, a.y + hp + h / 2, a.z + Math.cos(yaw) * 0.0], r: [0, yaw, 0] });
    planes.push(g);
    B.blob(a.x, a.z, 1.5, 0.3);
  };
  sign(0.93, -11, 0); sign(0.17, 10.5, 1); sign(0.015, 11.5, 2, 6, 1.1); sign(0.452, 10, 3, 5, 1.1); sign(0.34, -9.5, 4, 6, 0.9); sign(0.895, 10.5, 5, 3, 0.9);
  for (const m of track.markers.filter((q) => q.tag === 'hairpin')) {
    for (const off of [-0.012, 0, 0.012]) {
      const p = P(m.u + off), s = track.curvature[p.i] > 0 ? -1 : 1;
      sign(m.u + off, s * (p.w / 2 + 4), 8, 3.4, 1, 0.9, s * -0.3);
    }
  }
  const signsMesh = new THREE.Mesh(mergeUV(planes), mat('#ffffff', { map: true }));
  signsMesh.material.map = atlas.texture;
  signsMesh.material.needsUpdate = true;
  world.staticGroup.add(signsMesh);

  // the start gate: two big timber posts, the banner of the race, flags, bunting across the road
  {
    const a = atRoad(0.0, 0), wd = a.p.w / 2 + 2.6, yaw = a.yaw, parts = [];
    const nx = a.p.nx, nz = a.p.nz;
    for (const s of [-1, 1]) {
      parts.push(place(paint(capsule(0.5, 8.4, 3, 9), '#7a4c2c', 4), { p: [a.x + nx * wd * s, a.y + 4.2, a.z + nz * wd * s] }));
      parts.push(place(paint(sphere(0.74, 10, 8), '#d7ad4a'), { p: [a.x + nx * wd * s, a.y + 9.1, a.z + nz * wd * s] }));
    }
    parts.push(place(paint(box(wd * 2 + 1, 1.9, 0.3), '#3b2a22'), { p: [a.x, a.y + 7.8, a.z], r: [0, yaw, 0] }));
    B.add(merge(parts));
    const ban = signPlane(wd * 2 - 0.2, 1.72, 7, atlas.rows), b2 = signPlane(wd * 2 - 0.2, 1.72, 7, atlas.rows);
    place(ban, { p: [a.x - a.p.tx * 0.17, a.y + 7.8, a.z - a.p.tz * 0.17], r: [0, yaw + Math.PI, 0] });
    place(b2, { p: [a.x + a.p.tx * 0.17, a.y + 7.8, a.z + a.p.tz * 0.17], r: [0, yaw, 0] });
    planes.length = 0;
    const m2 = new THREE.Mesh(mergeUV([ban, b2]), signsMesh.material);
    world.staticGroup.add(m2);
    B.blob(a.x + nx * wd, a.z + nz * wd, 1.5, 0.4); B.blob(a.x - nx * wd, a.z - nz * wd, 1.5, 0.4);
  }
  // bunting over the run into Borca, in the colours of the valley
  const COLS = ['#d9483b', '#f6efd8', '#2f7a4f', '#f2c544', '#2d6fb5'];
  for (const [u, hp] of [[0.962, 6.4], [0.03, 6.2]]) {
    // the posts stand back from the kerb: a driver on the edge of the road must never have one across the view
    const p = P(u), wd = p.w / 2 + 4, parts = [], n = 18;
    const ax = p.x + p.nx * wd, az = p.z + p.nz * wd, bx = p.x - p.nx * wd, bz = p.z - p.nz * wd, y0 = p.y + hp;
    parts.push(paint(place(cylinder(0.07, 0.1, hp + 0.5, 5), { p: [ax, p.y + hp / 2, az] }), '#6c4a2c'));
    parts.push(paint(place(cylinder(0.07, 0.1, hp + 0.5, 5), { p: [bx, p.y + hp / 2, bz] }), '#6c4a2c'));
    const pts = [];
    for (let i = 0; i <= n; i++) { const t = i / n; pts.push([lerp(ax, bx, t), y0 - 1.1 * 4 * t * (1 - t), lerp(az, bz, t)]); }
    parts.push(paint(tube(pts, 0.03, 3), '#3b342d'));
    for (let i = 0; i < n; i++) {
      const A = pts[i], Bn = pts[i + 1], tri = new THREE.BufferGeometry(), mx = (A[0] + Bn[0]) / 2, mz = (A[2] + Bn[2]) / 2, my = (A[1] + Bn[1]) / 2;
      tri.setAttribute('position', new THREE.Float32BufferAttribute([...A, ...Bn, mx, my - 0.85, mz], 3));
      tri.setIndex([0, 1, 2]); tri.computeVertexNormals();
      parts.push(paint(tri, COLS[i % COLS.length]));
    }
    B.add(merge(parts));
  }
  roadside({ track, B, groundAt, P, atRoad });
  riverBed({ B, groundAt, river: world.def.ground.river, water: world.def.ground.water });
  // marmots watching from the verge, a few at each end of the village, and one on the bridge's far bank
  const marmot = blobAnimal('#9a6b43', 0.9, '#6a472c');
  for (const [u, d, turn] of [[0.99, 11, 0], [0.994, 12.2, 0.4], [0.008, -11.5, -0.2], [0.012, -12.8, 0.3], [0.975, -11.8, 0.2], [0.232, -9.5, 0.4], [0.56, 11, 0.4], [0.69, -11, 0.2]]) {
    const a = atRoad(u, d), g = marmot.clone(); place(g, { p: [a.x, a.y, a.z], r: [0, Math.atan2(-a.p.nx * Math.sign(d), -a.p.nz * Math.sign(d)) + turn, 0] }); B.add(g); B.blob(a.x, a.z, 1, 0.4);
  }
}

// What stands on the edge of a road in the Boite valley and on no circuit: the white delineators of an Italian state road, the larch rail with its round posts on the river side of the bends and the outside of the hairpins, the dry walls of the fields, the hewn larch water trough, the wooden wayside shrine, and the grass and autumn crocus right up to the asphalt.
function roadside({ track, B, groundAt, P, atRoad }) {
  const S = track.structures, clearOf = (u) => !S.some((s) => (s.from <= s.to ? u > s.from - 0.006 && u < s.to + 0.006 : u > s.from - 0.006 || u < s.to + 0.006));
  const town = (u) => u > 0.94 || u < 0.042;
  const edge = (u, s, off) => { const p = P(u), d = s * (p.w / 2 + off); return atRoad(u, d); };
  const L = track.length, parts = [];
  // delineators, staggered
  let n = 0;
  for (let m = 6; m < L; m += 22, n++) {
    const u = m / L;
    if (!clearOf(u) || town(u)) continue;
    const s = n % 2 ? 1 : -1, a = edge(u, s, 1.7), r = [0, a.yaw, 0];
    parts.push(place(paint(box(0.14, 1.05, 0.09), '#f1eee3'), { p: [a.x, a.y + 0.5, a.z], r }));
    parts.push(place(paint(box(0.15, 0.24, 0.1), '#26242a'), { p: [a.x, a.y + 0.86, a.z], r }));
    parts.push(place(paint(box(0.07, 0.15, 0.11), s > 0 ? '#f0f0e8' : '#e9852e'), { p: [a.x, a.y + 0.86, a.z], r }));
  }
  // larch guard rail: round posts and two round rails
  const rail = (u0, u1, s, off = 2.1) => {
    let last = null, st = 3.2 / L;
    for (let u = u0; u <= u1; u += st) {
      if (!clearOf(u)) { last = null; continue; }
      const a = edge(u, s, off), y = a.y;
      parts.push(paint(place(cylinder(0.11, 0.13, 1.3, 5), { p: [a.x, y + 0.45, a.z] }), WOOD_D));
      if (last) for (const h of [0.5, 0.9]) parts.push(paint(tube([[last.x, last.y + h, last.z], [a.x, y + h, a.z]], 0.075, 3), h > 0.7 ? WOOD_L : WOOD));
      last = a;
    }
  };
  rail(0.05, 0.075, 1); rail(0.1, 0.165, -1); rail(0.165, 0.2, 1); rail(0.215, 0.235, -1);
  for (const m of track.markers.filter((q) => q.tag === 'hairpin')) { const p = P(m.u), s = track.curvature[p.i] > 0 ? -1 : 1; rail(m.u - 0.022, m.u + 0.022, s, 2.3); }
  // dry stone walls in lumps, each a little off the line: never a ruled edge
  const wall = (u0, u1, s, off = 3.6) => {
    let i = 0;
    for (let u = u0; u <= u1; u += 1.5 / L, i++) {
      if (!clearOf(u)) continue;
      const a = edge(u, s, off + 0.25 * (hash3(i, 2, 61) - 0.5)), h = 0.55 + 0.26 * hash3(i, 3, 61), k = 0.82 + 0.26 * hash3(i, 4, 61), r = [0.04 * (hash3(i, 5, 61) - 0.5), a.yaw + 0.08 * (hash3(i, 6, 61) - 0.5), 0.05 * (hash3(i, 7, 61) - 0.5)];
      parts.push(place(paint(box(0.62, h + 0.4, 1.8), '#a59e92', 1, () => k), { p: [a.x, a.y + (h - 0.4) / 2, a.z], r }));
    }
  };
  wall(0.735, 0.772, 1); wall(0.782, 0.815, 1); wall(0.885, 0.915, -1); wall(0.922, 0.94, 1, 3.2); wall(0.045, 0.072, -1); wall(0.26, 0.3, 1);
  // the water trough: one hewn larch, a spout and a post; the wayside shrines of the valley
  for (const [u, s] of [[0.915, 1], [0.052, 1], [0.545, -1]]) {
    const a = edge(u, s, 4.6), r = [0, a.yaw, 0], g = [];
    g.push(paint(place(box(0.95, 0.56, 3.3), { p: [0, 0.35, 0] }), WOOD));
    g.push(paint(place(box(0.7, 0.05, 3.0), { p: [0, 0.63, 0] }), '#5d8f9a'));
    g.push(paint(place(cylinder(0.14, 0.17, 1.5, 6), { p: [0, 0.72, 1.82] }), WOOD_D));
    g.push(paint(place(cylinder(0.035, 0.035, 0.7, 5), { p: [0, 1.2, 1.46], r: [Math.PI / 2, 0, 0] }), '#6c7276'));
    const t = merge(g); place(t, { p: [a.x, a.y, a.z], r }); parts.push(t); B.blob(a.x, a.z, 2.4, 0.4);
  }
  for (const [u, s] of [[0.093, 1], [0.838, 1]]) {
    const a = edge(u, s, 4.2), g = [];
    g.push(paint(place(box(0.34, 1.7, 0.34), { p: [0, 0.85, 0] }), WOOD_D));
    g.push(paint(place(box(0.86, 0.95, 0.5), { p: [0, 2.1, 0] }), PLASTER));
    g.push(paint(place(box(0.5, 0.56, 0.08), { p: [0, 2.1, 0.24] }), '#39506a'));
    g.push(paint(place(gable(1.0, 0.7, 0.1, 0.42, 0.14).roof, { p: [0, 2.5, 0] }), SHINGLE, 3));
    const t = merge(g); place(t, { p: [a.x, a.y, a.z], r: [0, a.yaw + (s > 0 ? -Math.PI / 2 : Math.PI / 2), 0] }); parts.push(t); B.blob(a.x, a.z, 1.2, 0.4);
  }
  // hazel and rowan in the meadows, turning: a field is never a bare plate
  for (let k = 0; k < 120; k++) {
    const u = hash3(k, 1, 91), s = k % 2 ? 1 : -1, off = 5 + 44 * hash3(k, 2, 91) ** 1.3;
    if (!clearOf(u) || town(u)) continue;
    const a = edge(u, s, off), r = 0.5 + 0.7 * hash3(k, 3, 91), t = hash3(k, 4, 91);
    if (track.nearest(a.x, a.z, a.p.i) && Math.abs(track.nearest(a.x, a.z, a.p.i).d) < a.p.w / 2 + 2.5) continue;
    const shrubC = t > 0.66 ? '#7e7a3c' : t > 0.33 ? '#7b8a3e' : '#5c7440';
    for (let q = 0; q < 2; q++) {
      const qa = q * 2.1 + t * 6, qr = r * (q ? 0.68 : 0.8), qd = q ? r * 0.62 : 0;
      parts.push(place(paint(sphere(qr, 5, 4), shrubC, 0, (x, y) => 0.72 + 0.34 * smooth(a.y, a.y + r, y) + 0.06 * q), { p: [a.x + Math.cos(qa) * qd, a.y + qr * 0.4, a.z + Math.sin(qa) * qd], s: [1, 0.78, 1] }));
    }
    B.blob(a.x, a.z, r * 1.25, 0.5);
  }
  B.add(merge(parts));
  // the grass at the edge of the road, one geometry per colour, and the autumn crocus of the Cadore meadows
  const COLS = ['#93a54d', '#a8a64c', '#7c9449', '#aaa450', '#cda8d8'], pos = COLS.map(() => []);
  const blade = (arr, x, y, z, ang, w, h, lean) => {
    const cx = Math.cos(ang) * w, cz = Math.sin(ang) * w;
    arr.push(x - cx, y - 0.03, z - cz, x + cx, y - 0.03, z + cz, x + Math.sin(ang) * lean, y + h, z - Math.cos(ang) * lean);
  };
  let i = 0;
  for (let m = 0; m < L; m += 0.62) {
    const u = m / L;
    if (!clearOf(u)) continue;
    for (const s of [-1, 1]) {
      i++;
      const off = 0.9 + 8 * hash3(i, 1, 71) ** 1.4, a = edge(u + hash3(i, 2, 71) / L, s, off), crocus = hash3(i, 3, 71) > 0.93 && !town(u), c = crocus ? 4 : Math.floor(hash3(i, 4, 71) * 4), arr = pos[c];
      if (town(u) && hash3(i, 5, 71) > 0.35) continue;
      const nb = crocus ? 2 : 5, hh = crocus ? 0.2 : (0.2 + 0.26 * hash3(i, 6, 71)) * (0.85 + 0.09 * off);
      for (let b = 0; b < nb; b++) blade(arr, a.x + 0.3 * (hash3(i, b, 72) - 0.5), a.y, a.z + 0.3 * (hash3(i, b, 73) - 0.5), hash3(i, b, 74) * 6.28, crocus ? 0.07 : 0.028 + 0.02 * hash3(i, b, 75), hh, 0.1);
    }
  }
  const all = [];
  pos.forEach((arr, k) => {
    if (!arr.length) return;
    const g = new THREE.BufferGeometry(), N = new Float32Array(arr.length);
    for (let q = 1; q < N.length; q += 3) N[q] = 1;
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    g.setIndex(Array.from({ length: arr.length / 3 }, (_, q) => q));
    all.push(paint(g, COLS[k]));
  });
  B.add(merge(all));
}

// The Boite's bed is no plate of gravel: pale boulders on the bars, thicker toward the channel, and willow scrub where the bank starts.
function riverBed({ B, groundAt, river, water }) {
  const parts = [], R = river.points;
  let i = 0;
  for (let k = 0; k < R.length - 1; k++) {
    const [ax, az] = R[k], [bx, bz] = R[k + 1], len = Math.hypot(bx - ax, bz - az), tx = (bx - ax) / len, tz = (bz - az) / len;
    for (let m = 0; m < len; m += 6) {
      if (Math.hypot(ax + tx * m, az + tz * m) > 760) continue;
      i++;
      const off = (hash3(i, 1, 81) - 0.5) * 52, x = ax + tx * m - tz * off, z = az + tz * m + tx * off, y = groundAt(x, z), up = y - water;
      if (up > 7 || up < -3) continue;
      if (up > 2.6) {
        if (hash3(i, 2, 81) < 0.5) parts.push(place(paint(sphere(0.9 + 1.1 * hash3(i, 3, 81), 6, 4), hash3(i, 4, 81) > 0.5 ? '#7f8a4c' : '#a2873f'), { p: [x, y + 0.5, z], s: [1.1, 0.8 + 0.5 * hash3(i, 5, 81), 1.1] }));
        continue;
      }
      const r = 0.22 + 0.75 * hash3(i, 6, 81) ** 2.2, tone = hash3(i, 7, 81);
      parts.push(place(paint(sphere(r, 6, 4), tone > 0.6 ? '#d6cfc0' : tone > 0.25 ? '#b4ab9c' : '#8d877d'), { p: [x, y + r * 0.2, z], r: [0, tone * 6.28, 0], s: [1.2, 0.62, 0.95] }));
    }
  }
  if (parts.length) B.add(merge(parts));
}

function mergeUV(list) {
  let nv = 0, ni = 0;
  for (const g of list) { nv += g.attributes.position.count; ni += g.index.count; }
  const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), UV = new Float32Array(nv * 2), X = new Uint32Array(ni);
  let v = 0, x = 0;
  for (const g of list) {
    const c = g.attributes.position.count;
    P.set(g.attributes.position.array, v * 3); N.set(g.attributes.normal.array, v * 3); UV.set(g.attributes.uv.array, v * 2);
    for (let i = 0; i < g.index.count; i++) X[x + i] = g.index.getX(i) + v;
    x += g.index.count; v += c;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(P, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(UV, 2));
  out.setIndex(new THREE.BufferAttribute(X, 1));
  return out;
}
