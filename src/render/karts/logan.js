// Logan vecchissima: the boxy three-box saloon of 2004 to 2008 that all of Romania knows, squashed chubby and on its last legs. No
// badge. What makes it the Logan from behind, the way it is seen all race: a tall flat boot between two tall lamps (red over amber over
// white), the wide dark plastic strip across the bumper, the plate low on the part below it, a trapezoid back window under a square roof.
// Then the rest of its life: a blue door from another car that will not shut, rust, silver tape, a boot lid on a rope that bounces, sacks
// on the roof rack, a fat exhaust that coughs (the smoke is fx.js's). Vlăduț the bat drives, his great ears out of the windows.
import { createRig, swing, spring } from './_kit.js';
import { chibi } from '../chibi.js';

const PAINT = '#dcc994', PAINT_D = '#cdb880', DOOR = '#3a74b6', RUST = '#a4582a', RUST_L = '#c47a3a', STRIP = '#3c3a42', RUBBER = '#26242b', TAPE = '#e6e9ee', ROPE = '#efe4bf', SACK = '#b89a6c', SACK_D = '#9a7b4e', RAFIA = '#ece6d4', GLINT = '#a9c6d6';

export function build(ctx) {
  const r = createRig(ctx), { part, bone, wheel, x, shapes, grad } = r, { box, tube, cone, quad } = shapes, { ball, wheelGeo, limb, poly, dome, loft, solid } = x;
  const wR = 0.38, opts = { tyre: '#2c2a33', rim: '#b9bcc4', hub: '#7c7f88', rimAt: 0.62, seg: 11 };
  wheel('wFL', [0.83, wR, 0.84], { front: true, geo: wheelGeo(wR, 0.28, { ...opts, side: 1 }) });
  wheel('wFR', [-0.83, wR, 0.84], { front: true, geo: wheelGeo(wR, 0.28, { ...opts, side: -1 }) });
  // one wheel from another car, of course, and one that lost its hubcap years ago
  wheel('wBL', [0.83, wR, -0.88], { geo: wheelGeo(wR, 0.28, { ...opts, rim: '#e9e5da', hub: '#b7402e', side: 1 }) });
  wheel('wBR', [-0.83, wR, -0.88], { geo: wheelGeo(wR, 0.28, { ...opts, rim: '#3b3a40', hub: '#55535c', side: -1 }) });

  const B = 'body', shade = grad(0.34, 0.8, 0.8);
  // flat decals, two triangles each: on a face looking along z (dir 1 front, -1 back), or along x (sx the side)
  const pz = (b, cx, cy, z, w, h, dir, c) => {
    const x0 = cx - (w / 2) * dir, x1 = cx + (w / 2) * dir, y0 = cy - h / 2, y1 = cy + h / 2;
    return part(b, quad([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]), c);
  };
  const px = (b, sx, x0, cy, cz, l, h, c) => {
    const z0 = cz + (l / 2) * sx, z1 = cz - (l / 2) * sx, y0 = cy - h / 2, y1 = cy + h / 2;
    return part(b, quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]), c);
  };
  // A cross section of the body: flat sides, a soft shoulder, a flat top.
  const sec = (hw, y0, y1) => [[-hw * 0.84, y0], [hw * 0.84, y0], [hw, y0 + 0.1], [hw, (y0 + y1) * 0.5], [hw * 0.985, y1 - 0.08], [hw * 0.78, y1], [-hw * 0.78, y1], [-hw * 0.985, y1 - 0.08], [-hw, (y0 + y1) * 0.5], [-hw, y0 + 0.1]];
  const HW = 0.79, zN = 1.54, zT = -1.54, belt = 1.1, deck = 1.2;
  // bonnet, cabin floor at the belt line, then the boot, higher than the belt and flat as a table: the three boxes
  part(B, loft([
    { z: zN, pts: sec(0.6, 0.5, 0.84) },
    { z: zN - 0.07, pts: sec(0.72, 0.42, 0.93) },
    { z: zN - 0.32, pts: sec(HW - 0.02, 0.38, 0.99) },
    { z: 0.66, pts: sec(HW, 0.36, belt) },
    { z: -0.74, pts: sec(HW, 0.36, belt) },
    { z: -0.88, pts: sec(HW, 0.36, deck) },
    { z: zT + 0.1, pts: sec(HW, 0.38, deck) },
    { z: zT + 0.03, pts: sec(HW - 0.03, 0.4, deck - 0.03) },
    { z: zT, pts: sec(HW - 0.09, 0.44, deck - 0.09) },
  ]), PAINT, null, shade);
  // the floor of the cabin seen through the windows: the inside of a car is dark
  part(B, quad([-HW * 0.76, belt + 0.012, 0.66], [HW * 0.76, belt + 0.012, 0.66], [HW * 0.76, belt + 0.012, -0.74], [-HW * 0.76, belt + 0.012, -0.74]), '#3a2f32');

  // the greenhouse, hollow, so the driver shows: a square roof, slim front pillars, the wide rear pillars of a saloon
  const roofY = 1.72, rw = 0.62, rF = 0.2, rB = -0.56;
  const sP = (hw, y0, y1) => [[-hw, y0], [hw, y0], [hw + 0.02, y0 + 0.04], [hw * 0.92, y1], [-hw * 0.92, y1], [-hw - 0.02, y0 + 0.04]];
  part(B, loft([{ z: rF + 0.05, pts: sP(rw - 0.03, roofY - 0.02, roofY + 0.04) }, { z: rF, pts: sP(rw, roofY - 0.05, roofY + 0.07) }, { z: rB, pts: sP(rw, roofY - 0.05, roofY + 0.07) }, { z: rB - 0.05, pts: sP(rw - 0.03, roofY - 0.02, roofY + 0.04) }]), PAINT);
  for (const sx of [1, -1]) {
    const bx = sx * (HW - 0.04), tx = sx * (rw - 0.02);
    // front pillar, leaning back; the thin dark one in the middle
    part(B, tube([[bx, belt, 0.7], [tx, roofY, rF - 0.02]], 0.05, 4), PAINT);
    part(B, tube([[bx, belt, -0.14], [tx, roofY, -0.17]], 0.028, 3), RUBBER);
    // the rear pillar, wide and flat as on the real one: outer face out, inner face to the cabin
    const c = [[bx, belt, -0.42], [tx, roofY, rB + 0.14], [tx - sx * 0.12, roofY, rB + 0.14], [bx - sx * 0.16, belt, -0.42], [bx, deck, -1.0], [tx, roofY, rB - 0.04], [tx - sx * 0.12, roofY, rB - 0.04], [bx - sx * 0.16, deck, -1.0]];
    part(B, solid(sx > 0 ? [c[3], c[0], c[1], c[2], c[7], c[4], c[5], c[6]] : [c[0], c[3], c[2], c[1], c[4], c[7], c[6], c[5]]), PAINT, null, grad(belt, roofY, 0.9));
  }
  // rubbers round the two big windows, wipers, and the streaks of light that say there is glass in them
  const frame = (pts) => part(B, tube(pts, 0.018, 3), RUBBER);
  frame([[-rw + 0.06, roofY - 0.05, rF - 0.02], [rw - 0.06, roofY - 0.05, rF - 0.02]]);
  frame([[-HW + 0.08, belt + 0.02, 0.7], [HW - 0.08, belt + 0.02, 0.7]]);
  frame([[-rw + 0.1, roofY - 0.05, rB - 0.05], [rw - 0.1, roofY - 0.05, rB - 0.05]]);
  frame([[-HW + 0.16, deck + 0.015, -1.0], [HW - 0.16, deck + 0.015, -1.0]]);
  part(B, tube([[0.06, belt + 0.04, 0.68], [0.44, belt + 0.08, 0.6]], 0.012, 3), RUBBER);
  part(B, tube([[-0.46, belt + 0.04, 0.68], [-0.08, belt + 0.08, 0.6]], 0.012, 3), RUBBER);
  // a streak across a sloping window from a low corner to a high one, seen from both sides
  const streak = (a, b, c, d) => { part(B, quad(a, b, c, d), GLINT); part(B, quad(d, c, b, a), GLINT); };
  const onFront = (px0, f) => [px0, belt + 0.05 + f * (roofY - belt - 0.1), 0.7 - f * 0.5], onBack = (px0, f) => [px0, deck + 0.02 + f * (roofY - deck - 0.07), -1.0 + f * 0.44];
  streak(onFront(0.66, 0.1), onFront(0.72, 0.1), onFront(0.6, 0.62), onFront(0.54, 0.62));
  streak(onBack(-0.62, 0.08), onBack(-0.56, 0.08), onBack(-0.46, 0.5), onBack(-0.52, 0.5));
  streak(onBack(-0.54, 0.08), onBack(-0.52, 0.08), onBack(-0.42, 0.38), onBack(-0.44, 0.38));
  // a strip of tape holding the corner of the back window
  part(B, box(0.26, 0.05, 0.02), TAPE, { p: [0.46, deck + 0.1, -0.94], r: [0.6, 0.3, 0.5] });
  // a dashboard, and the parcel shelf with its crocheted doily
  part(B, box(1.3, 0.08, 0.16), '#2c2730', { p: [0, belt + 0.05, 0.54], r: [0.25, 0, 0] });
  part(B, quad([-HW + 0.14, deck + 0.012, -0.72], [HW - 0.14, deck + 0.012, -0.72], [HW - 0.14, deck + 0.012, -1.0], [-HW + 0.14, deck + 0.012, -1.0]), '#3a3036');
  part(B, x.disc(0.12, 7), '#f4eedb', { p: [0.3, deck + 0.022, -0.84], r: [-Math.PI / 2, 0, 0] });

  // ---- what makes it a Logan from behind ----
  // the boot lid, an L of sheet metal hinged at the back window, tied down with a rope; it bounces
  const lidH = [0, deck, -1.0], lid = bone('lid', B, lidH), yL = 0.84, lw = 0.5;
  const t0 = deck + 0.03, t1 = deck - 0.03;
  part(lid, solid([[-lw, t0, -1.0], [-lw, t1, -1.0], [lw, t1, -1.0], [lw, t0, -1.0], [-lw, t0, zT - 0.03], [-lw, t1, zT + 0.03], [lw, t1, zT + 0.03], [lw, t0, zT - 0.03]]), PAINT_D);
  part(lid, box(lw * 2, deck + 0.03 - yL, 0.05), PAINT_D, { p: [0, (deck + 0.03 + yL) / 2, zT - 0.015] }, grad(yL, deck, 0.88));
  // what is in the boot, seen when it jumps open
  part(B, ball(0.3, [1.2, 0.46, 0.8], 5, 3), SACK_D, { p: [0, deck - 0.1, -1.24] });

  // the tall lamps on the corners and round them: red over amber over white, the signature. One lost its lens long ago and is mostly tape.
  const zL = zT - 0.045;
  const lamp = (sx, broken) => {
    const cx = sx * 0.65, w = 0.26, hi = 1.17;
    part(B, box(w + 0.03, hi - 0.84 + 0.03, 0.05), RUBBER, { p: [cx, (hi + 0.84) / 2, zT - 0.012] });
    pz(B, cx, 1.08, zL, w, 0.18, -1, '#d9261f');
    pz(B, cx, 0.945, zL, w, 0.09, -1, '#f2a024');
    pz(B, cx, 0.87, zL, w, 0.06, -1, '#f7f4ea');
    part(B, quad(...(sx > 0 ? [[HW + 0.002, 0.86, zT + 0.26], [HW + 0.002, 0.86, zT + 0.04], [HW + 0.002, hi, zT + 0.04], [HW + 0.002, hi, zT + 0.26]] : [[-HW - 0.002, 0.86, zT + 0.04], [-HW - 0.002, 0.86, zT + 0.26], [-HW - 0.002, hi, zT + 0.26], [-HW - 0.002, hi, zT + 0.04]])), '#d9261f');
    if (broken) { part(B, box(0.34, 0.07, 0.015), TAPE, { p: [cx, 1.02, zL - 0.008], r: [0, 0, 0.72] }); part(B, box(0.34, 0.07, 0.015), TAPE, { p: [cx, 1.02, zL - 0.01], r: [0, 0, -0.72] }); }
  };
  lamp(1, false); lamp(-1, true);
  // rust round the edges of the panels
  const blot = (bo, bx, by, bz, ry, s, c = RUST) => part(bo, poly([[-1, -0.3], [-0.6, 0.6], [0.1, 0.9], [0.8, 0.5], [1, -0.2], [0.4, -0.8], [-0.4, -0.7]]), c, { p: [bx, by, bz], r: [0, ry, 0], s: [s, s, 1] });
  blot(lid, 0.3, 0.93, zT - 0.043, Math.PI, 0.12);
  blot(lid, -0.34, 1.12, zT - 0.043, Math.PI, 0.07, RUST_L);
  // the wide dark plastic strip across the bumper, wrapped round the corners; one end hangs loose on its rope
  const bump = bone('bumper', B, [0.72, 0.72, zT]);
  part(bump, x.extrude([[zT - 0.07, 0.82], [zT + 0.02, 0.84], [zT + 0.02, 0.58], [zT - 0.07, 0.6]].reverse(), 1.68), STRIP);
  for (const sx of [1, -1]) part(bump, box(0.05, 0.22, 0.34), STRIP, { p: [sx * 0.82, 0.71, zT + 0.16] });
  part(bump, box(0.38, 0.09, 0.015), TAPE, { p: [0.34, 0.71, zT - 0.08], r: [0, 0, 0.42] });
  part(bump, box(0.38, 0.09, 0.015), TAPE, { p: [0.34, 0.71, zT - 0.082], r: [0, 0, -0.42] });
  // below it the body again, and the plate: white, the blue band, dark letters
  part(B, x.extrude([[zT - 0.02, 0.6], [zT + 0.06, 0.6], [zT + 0.06, 0.36], [zT - 0.02, 0.38]].reverse(), 1.48), PAINT, null, grad(0.36, 0.56, 0.82));
  pz(B, 0, 0.485, zT - 0.026, 0.52, 0.15, -1, '#f6f2e6');
  pz(B, 0.215, 0.485, zT - 0.03, 0.08, 0.15, -1, '#2a54a8');
  for (const dx of [-0.2, -0.13, -0.06, 0.02, 0.09]) pz(B, dx, 0.485, zT - 0.03, 0.045, 0.085, -1, '#25232a');
  blot(B, -0.56, 0.47, zT - 0.024, Math.PI, 0.1);

  // the exhaust: too fat for the car, wired on
  const pipe = bone('pipe', B, [0.54, 0.4, -1.3]);
  part(pipe, tube([[0.54, 0.4, -1.25], [0.56, 0.34, -1.56], [0.6, 0.35, -1.8]], [0.06, 0.08, 0.135], 6), '#6a6871');
  part(pipe, x.disc(0.1, 6), '#17151a', { p: [0.6, 0.35, -1.862], r: [0, Math.PI, 0] });

  // ---- the sides ----
  const dx = HW + 0.006;
  for (const sx of [1, -1]) {
    const ry = sx * Math.PI / 2;
    // wheel arches: dark round the tyre
    for (const z of [0.84, -0.88]) part(B, x.disc(0.47, 10), '#1c1a20', { p: [sx * dx, 0.42, z], r: [0, ry, 0] });
    // the thin dark rubbing strip of the doors, a handle, the seams
    px(B, sx, sx * (dx + 0.002), 0.68, 0.2, 0.6, 0.05, STRIP);
    px(B, sx, sx * (dx + 0.002), 0.95, 0.12, 0.12, 0.04, STRIP);
    px(B, sx, sx * (dx + 0.002), 0.76, 0.56, 0.018, 0.68, RUBBER);
    px(B, sx, sx * (dx + 0.002), 0.76, -0.14, 0.018, 0.68, RUBBER);
    blot(B, sx * dx, 0.48, 0.22, ry, 0.11);
    blot(B, sx * dx, 0.9, -1.14, ry, 0.09);
  }
  // the blue rear door from another car, on the bat's right, that never quite shut: its back edge sticks out, so it shows from behind too
  const hinge = [-HW - 0.01, 0.74, -0.14];
  const door = bone('door', B, hinge);
  part(door, box(0.05, 0.72, 0.68), DOOR, { p: [-HW - 0.03, 0.74, -0.48] }, grad(0.36, 0.7, 0.86));
  px(door, -1, -HW - 0.058, 0.95, -0.72, 0.13, 0.04, '#d7dbe2');
  part(door, tube([[-HW - 0.03, 1.1, -0.78], [-rw - 0.03, 1.66, -0.56]], 0.022, 3), DOOR);
  part(door, tube([[-HW - 0.03, 1.1, -0.15], [-rw - 0.03, 1.66, -0.17]], 0.022, 3), DOOR);
  part(door, tube([[-rw - 0.03, 1.66, -0.56], [-rw - 0.03, 1.66, -0.17]], 0.022, 3), DOOR);
  // the one mirror left
  part(B, limb([0.74, belt + 0.02, 0.58], [0.93, belt + 0.12, 0.54], 0.018, 3, 1), RUBBER);
  part(B, ball(0.1, [1, 0.8, 0.5], 5, 3), RUBBER, { p: [0.98, belt + 0.14, 0.54] });

  // ---- the face ----
  // the wide lamps swept round the corners, one drooping, and the V of the grille with its chrome top line; where the badge was, a hole
  for (const [sx, dy] of [[1, 0], [-1, -0.05]]) {
    part(B, ball(0.26, [1, 0.36, 0.24], 8, 4), '#bcd0d8', { p: [sx * 0.5, 0.84 + dy, zN - 0.03], r: [0, sx * 0.2, sx * 0.14] });
    part(B, dome(0.07, 6, 1, 0.3), [1.5, 1.5, 1.35], { p: [sx * 0.52, 0.84 + dy, zN + 0.025] });
  }
  part(B, poly([[-0.3, 0.92], [0.3, 0.92], [0.17, 0.76], [0, 0.71], [-0.17, 0.76]]), '#26242b', { p: [0, 0, zN + 0.008] });
  part(B, tube([[-0.33, 0.93, zN], [0.33, 0.93, zN]], 0.02, 3), '#e3e5ea');
  for (const sx of [1, -1]) part(B, tube([[sx * 0.33, 0.93, zN], [sx * 0.17, 0.75, zN + 0.01], [0, 0.7, zN + 0.01]], 0.015, 3), '#e3e5ea');
  // the bonnet, a different shade in the sun, on a bone so it flaps
  const bonnet = bone('bonnet', B, [0, 1.05, 0.68]);
  part(bonnet, solid([[-0.56, 1.0, 1.3], [0.56, 1.0, 1.3], [0.56, 1.03, 1.3], [-0.56, 1.03, 1.3], [-0.68, 1.08, 0.68], [0.68, 1.08, 0.68], [0.68, 1.12, 0.68], [-0.68, 1.12, 0.68]]), PAINT_D);
  // the dark strip again, the tape where it met a post, the plate
  part(B, x.extrude([[zN - 0.04, 0.66], [zN + 0.05, 0.64], [zN + 0.05, 0.46], [zN - 0.04, 0.44]].reverse(), 1.5), STRIP);
  part(B, box(0.36, 0.08, 0.015), TAPE, { p: [-0.46, 0.55, zN + 0.058], r: [0, 0, -0.5] });
  part(B, box(0.36, 0.08, 0.015), TAPE, { p: [-0.46, 0.55, zN + 0.06], r: [0, 0, 0.5] });
  pz(B, 0.02, 0.55, zN + 0.056, 0.42, 0.11, 1, '#f6f2e6');

  // ---- the roof rack and its load ----
  const rackY = roofY + 0.14;
  for (const sx of [1, -1]) {
    part(B, tube([[sx * 0.56, rackY, rB - 0.02], [sx * 0.56, rackY, rF + 0.02]], 0.026, 3), '#55525c');
    part(B, tube([[sx * 0.56, rackY, rB + 0.1], [sx * 0.56, roofY + 0.06, rB + 0.1]], 0.02, 3), '#55525c');
    part(B, tube([[sx * 0.56, rackY, rF - 0.1], [sx * 0.56, roofY + 0.06, rF - 0.1]], 0.02, 3), '#55525c');
  }
  for (const z of [rB + 0.1, rF - 0.1]) part(B, tube([[-0.6, rackY, z], [0.6, rackY, z]], 0.026, 3), '#55525c');
  const load = bone('load', B, [0, rackY, -0.15]);
  // sacks that sag over the rails: burlap and the white woven kind with the coloured stripe, tied at the neck
  for (const [lx, ly, lz, s, ry, c] of [[-0.3, 0.12, 0.0, 0.31, 0.2, SACK], [0.3, 0.11, -0.04, 0.3, -0.25, RAFIA], [0.0, 0.13, -0.36, 0.32, 0.1, SACK_D], [0.02, 0.25, -0.08, 0.24, 0.7, SACK]]) {
    part(load, ball(s, [1, 0.58, 1.05], 7, 4), c, { p: [lx, rackY + ly, lz], r: [0, ry, 0] });
  }
  part(load, x.trim(shapes.lathe([[0.302, -0.035], [0.302, 0.035]], 7)), '#d8482f', { p: [0.3, rackY + 0.11, -0.04], r: [Math.PI / 2, 0, 0.1], s: [1, 1, 0.58] });
  part(load, cone(0.06, 0.12, 4), SACK, { p: [0.04, rackY + 0.43, -0.08], r: [Math.PI, 0, 0.2] });
  part(load, tube([[0, rackY, rF - 0.05], [0, rackY + 0.36, -0.04], [0, rackY + 0.28, -0.34], [0, rackY, rB]], 0.014, 3), ROPE);
  part(load, tube([[-0.58, rackY, -0.12], [0, rackY + 0.38, -0.12], [0.58, rackY, -0.12]], 0.014, 3), ROPE);

  // the rope from the bumper up to the lid: it does not inspire confidence
  part(lid, tube([[0, deck - 0.14, zT - 0.05], [0, 0.82, zT - 0.05]], 0.014, 3), ROPE);

  // the seat, low: he has to show through the back window
  part(B, box(0.72, 0.3, 0.08), '#6b3a34', { p: [0, 1.0, -0.42] });

  // steering wheel
  part(B, limb([0, belt + 0.02, 0.48], [0, 1.26, 0.34], 0.024, 3, 1), RUBBER);
  const sw = bone('steer', B, [0, 1.28, 0.32]);
  part(sw, shapes.torus(0.14, 0.026, 3, 8), RUBBER, { p: [0, 1.28, 0.32], r: [Math.PI / 2 - 0.7, 0, 0] });

  // Vlăduț the bat: low in the seat, his ears do not fit in the car
  const d = chibi(r, {
    at: [0, 0.68, -0.12], size: 0.82, panTop: 2.42, fur: '#6a5476', belly: '#a58fb0', muzzleColor: '#cdb8d0', nose: '#2b2224', inner: '#f0a6b4', noseR: 0.04,
    head: { r: 0.4, s: [1.06, 0.96, 1] }, torso: { r: 0.24, h: 0.06 },
    eyes: { r: 0.14, gap: 0.19, y: 0.02 }, muzzle: { r: 0.14, s: [1.2, 0.72, 0.8], y: -0.17 },
    ears: { kind: 'bat', r: 0.34, side: 0.82, up: 0.2, out: 1.3 },
    arms: { r: 0.06, grip: [[0.12, 1.3, 0.32], [-0.12, 1.3, 0.32]], hand: '#4d3c58' }, wings: true, wingColor: '#4d3c58',
    extra: ({ head, center: c, hr }) => {
      // one small friendly fang
      part(head, cone(0.02, 0.05, 4), '#fff6dc', { p: [c[0] + 0.05, c[1] - hr * 0.56, c[2] + hr * 0.92], r: [Math.PI, 0, 0] });
    },
  });

  const doorS = spring(5, 0.2), lidS = spring(9, 0.16), body = r.bones.get('body');
  return r.finish({
    driver: d,
    update(m) {
      sw.rotation.y = -m.steer * 0.6;
      // the whole car rattles at speed, and it has sagged on one side for years
      const rat = 0.5 + m.sn;
      body.rotation.z += 0.022;
      bonnet.rotation.x = Math.max(0, Math.sin(m.t * 27)) * -0.03 * rat - m.air * 0.3 - Math.max(0, -m.vert) * 0.3;
      door.rotation.y = 0.2 + Math.abs(doorS.step(m.lat * 0.4 - m.fwd * 0.2, m.dt || 1 / 60)) + Math.sin(m.t * 15) * 0.015 * rat;
      lid.rotation.x = Math.max(0, lidS.step(0.04 * rat + m.air * 0.7 + Math.max(0, m.vert) * 0.8 + m.hit * 0.6 + m.cheer * 0.5 + Math.abs(Math.sin(m.t * 11)) * 0.05 * m.sn, m.dt || 1 / 60));
      bump.rotation.z = 0.05 + Math.sin(m.t * 19) * 0.025 * rat + m.vert * 0.05;
      pipe.rotation.y = Math.sin(m.t * 31) * 0.05;
      pipe.rotation.x = Math.sin(m.t * 37) * 0.04;
      load.rotation.z = m.lat * 0.03 + swing(m, 11, 0.012);
      load.position.y = load.userData.rest.y + Math.abs(Math.sin(m.t * 13)) * 0.022 * m.sn - m.vert * 0.03;
    },
  });
}
