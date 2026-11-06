// Bromo 4x4: a short old 4x4 of the Tengger sand sea, sun-worn green with a white top, volcanic sand up its flanks, round lamps, wide
// arches, a rack with bags and a can, the spare wheel on the back. No badge. Budi the macaque drives, his tail out of the back.
import { createRig, swing } from './_kit.js';
import { chibi } from '../chibi.js';

const PAINT = '#6f9a8d', PAINT_L = '#93b5a6', SAND = '#b8a68f', TOP = '#efe9da', TRIM = '#2c2a33', TAN = '#c9a169';

export function build(ctx) {
  const r = createRig(ctx), { part, bone, wheel, x, shapes, grad } = r, { roundedBox, box, tube, capsule } = shapes, { ball, wheelGeo, limb, poly, dome, dirty, extrude } = x;
  const B = 'body', wR = 0.42, wW = 0.38, opts = { tyre: '#2a2830', rim: '#d9d2bf', hub: PAINT, rimAt: 0.56, hubAt: 0.24 };
  wheel('wFL', [0.8, wR, 0.74], { front: true, geo: wheelGeo(wR, wW, { ...opts, side: 1 }) });
  wheel('wFR', [-0.8, wR, 0.74], { front: true, geo: wheelGeo(wR, wW, { ...opts, side: -1 }) });
  wheel('wBL', [0.8, wR, -0.68], { geo: wheelGeo(wR, wW, { ...opts, side: 1 }) });
  wheel('wBR', [-0.8, wR, -0.68], { geo: wheelGeo(wR, wW, { ...opts, side: -1 }) });
  const mudbody = (g, where) => { shapes.place(g, where); dirty(g, PAINT, SAND, 0.42, 0.72); part(B, g, null); };
  // the tub: short and boxy with soft corners, sand creeping up it
  mudbody(roundedBox(1.32, 0.56, 2.08, 0.16, 1), { p: [0, 0.82, 0] });
  // the bonnet
  mudbody(roundedBox(1.2, 0.26, 0.82, 0.1, 1), { p: [0, 1.13, 0.56] });
  // wide arches over the wheels
  for (const sx of [1, -1]) for (const z of [0.74, -0.68]) mudbody(ball(0.56, [0.48, 0.5, 1], 10, 5), { p: [sx * 0.71, 0.93, z] });
  // where the sun took the paint
  for (const [px, pz, s] of [[0.28, 0.5, 0.15], [-0.22, 0.72, 0.12]]) part(B, poly([[-1, -0.2], [-0.6, 0.7], [0.2, 0.9], [1, 0.3], [0.7, -0.7], [-0.3, -0.9]]), PAINT_L, { p: [px, 1.262, pz], r: [-Math.PI / 2, 0, 0], s: [s * 1.3, s, 1] });
  for (const sx of [1, -1]) part(B, poly([[-1, -0.2], [-0.6, 0.7], [0.2, 0.9], [1, 0.3], [0.7, -0.7], [-0.3, -0.9]]), PAINT_L, { p: [sx * 0.665, 0.96, 0.0], r: [0, sx * Math.PI / 2, 0], s: [0.16, 0.1, 1] });

  // the face: flat grille of slots, round lamps
  part(B, box(0.6, 0.26, 0.05), TRIM, { p: [0, 0.98, 1.05] });
  for (let i = -1; i <= 1; i++) part(B, box(0.06, 0.25, 0.04), PAINT_L, { p: [i * 0.15, 0.98, 1.07] });
  for (const sx of [1, -1]) {
    part(B, dome(0.15, 10, 1, 0.3), '#e2dcc8', { p: [sx * 0.46, 0.99, 1.05] });
    part(B, dome(0.11, 10, 2, 0.6), '#fff2c0', { p: [sx * 0.46, 0.99, 1.07] });
  }
  part(B, tube([[-0.72, 0.54, 1.1], [0.72, 0.54, 1.1]], 0.07, 6), '#55525c');

  // the flat windscreen frame, folded up, and four posts for the white top
  const sillY = 1.1, topY = 1.92;
  for (const sx of [1, -1]) {
    part(B, tube([[sx * 0.6, sillY, 0.2], [sx * 0.58, topY, 0.14]], 0.04, 5), TOP);
    part(B, tube([[sx * 0.62, sillY, -0.96], [sx * 0.58, topY, -0.92]], 0.05, 5), TOP);
  }
  part(B, tube([[-0.6, 1.14, 0.2], [0.6, 1.14, 0.2]], 0.04, 5), TOP);
  part(B, roundedBox(1.32, 0.13, 1.28, 0.06, 1), TOP, { p: [0, topY + 0.03, -0.38] }, grad(topY - 0.04, topY + 0.1, 0.84));

  // the roof rack, with what a guide carries: a bag, a can, a coil of rope
  const rackY = topY + 0.13;
  for (const sx of [1, -1]) part(B, tube([[sx * 0.56, rackY, -0.96], [sx * 0.56, rackY, 0.18]], 0.024, 4), TAN);
  for (const z of [-0.8, -0.4, 0.02]) part(B, tube([[-0.58, rackY, z], [0.58, rackY, z]], 0.024, 4), TAN);
  const load = bone('load', B, [0, rackY, -0.38]);
  part(load, ball(0.36, [1, 0.56, 0.68], 8, 4), '#c9692f', { p: [0.2, rackY + 0.14, -0.16] });
  part(load, ball(0.28, [1, 0.6, 0.7], 7, 4), '#d9b24a', { p: [-0.26, rackY + 0.13, -0.08] });
  part(load, box(0.28, 0.34, 0.2), '#b83a2c', { p: [-0.22, rackY + 0.2, -0.62] });
  part(load, shapes.torus(0.17, 0.04, 3, 9), '#e8dcb8', { p: [0.24, rackY + 0.05, -0.64], r: [Math.PI / 2, 0, 0] });

  // the spare wheel on the tailgate, the mark of the thing from behind
  part(B, box(1.04, 0.5, 0.05), PAINT, { p: [0, 0.86, -1.05] }, grad(0.42, 0.8, 0.72));
  const spare = bone('spare', B, [0, 0.98, -1.2]);
  const geo = wheelGeo(0.38, 0.28, { ...opts, rim: TOP, hub: '#d9463d', seg: 11, side: 1 });
  geo.rotateY(Math.PI / 2);
  part(spare, geo.translate(0, 0.98, -1.2), null);
  for (const sx of [1, -1]) {
    part(B, box(0.16, 0.24, 0.05), '#d9463d', { p: [sx * 0.56, 0.86, -1.05] });
    part(B, box(0.04, 0.09, 0.2), '#3a3640', { p: [sx * 0.46, 0.46, -1.08] });
  }
  part(B, tube([[-0.72, 0.54, -1.08], [0.72, 0.54, -1.08]], 0.07, 6), '#55525c');

  // bench and wheel
  part(B, box(0.9, 0.16, 0.1), '#7a5a3a', { p: [0, 1.14, -0.72] });
  part(B, limb([0, 1.06, 0.26], [0, 1.26, 0.14], 0.028, 4, 1), TRIM);
  const sw = bone('steer', B, [0, 1.28, 0.12]);
  part(sw, shapes.torus(0.16, 0.03, 3, 9), TRIM, { p: [0, 1.28, 0.12], r: [Math.PI / 2 - 0.7, 0, 0] });

  // Budi the macaque: olive-grey, a pink heart of a face, a crest of hair, the long tail
  const tailAt = [0, 1.1, -0.88];
  const tail = bone('tail', B, tailAt);
  part(tail, tube([[0, 1.1, -0.88], [0.05, 1.08, -1.14], [0.14, 1.34, -1.36], [0.2, 1.66, -1.3], [0.12, 1.84, -1.14]], [0.07, 0.07, 0.06, 0.05, 0.035], 5), '#8f7a5e');
  const d = chibi(r, {
    at: [0, 1.0, -0.42], size: 0.88, panTop: 2.5, fur: '#9a8467', belly: '#dcc8a6', muzzleColor: '#efb09c', nose: '#8a4f48', inner: '#efb09c', noseR: 0.022, earColor: '#efb09c',
    head: { r: 0.4, s: [1.08, 0.96, 1] }, torso: { r: 0.24, h: 0.04 },
    eyes: { r: 0.135, gap: 0.16, y: 0.01, iris: '#3a2418' }, muzzle: { r: 0.17, s: [1.15, 0.84, 0.8], y: -0.17 },
    ears: { kind: 'round', r: 0.09, side: 1.0, up: 0.1, out: 0.5 },
    arms: { r: 0.066, grip: [[0.13, 1.3, 0.16], [-0.13, 1.3, 0.16]], hand: '#efb09c' },
    extra: ({ head, center: c, hr, onHead }) => {
      // the pink face, a heart with its two lobes above the eyes
      for (const sx of [1, -1]) {
        const p = onHead(sx * 0.17, hr * 0.06, -0.06);
        part(head, ball(0.19, [1, 1.05, 0.5], 7, 3), '#f0bca6', { p, r: [0, sx * 0.4, 0] });
      }
      // the crest
      for (const [dx, dy, dz, s] of [[0, 0.98, -0.08, 0.11], [0.09, 0.93, -0.2, 0.09], [-0.09, 0.93, -0.2, 0.09]]) part(head, ball(s, [0.8, 1.5, 1], 6, 3), '#7a6650', { p: [c[0] + dx, c[1] + dy * hr, c[2] + dz] });
    },
  });
  return r.finish({
    driver: d,
    update(m) {
      sw.rotation.y = -m.steer * 0.6;
      spare.rotation.z = Math.sin(m.dist * 0.7) * 0.02;
      load.position.y = load.userData.rest.y + Math.abs(Math.sin(m.dist * 1.5)) * 0.03 * m.sn - m.vert * 0.04;
      load.rotation.z = m.lat * 0.04;
    },
  });
}
