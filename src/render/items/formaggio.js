// Forma di Formaggio: a big wheel of mountain cheese, a rind with a stamped rim and a wedge gone, ready to roll. Axle along x, 1.15 m of
// radius, to fit the centre the sim gives it. The pool turns it; it turns round its own axle whatever way the road runs.
import { itemKit, clock, child } from './_kit.js';

export function build(ctx) {
  const k = itemKit(ctx), { shapes, x, piece, mesh, group } = k, { lathe } = shapes, { ball, trim, disc, poly } = x;
  const RIND = '#d9a441', CHEESE = '#f8e08c', R = 1.15, W = 0.44;
  const list = [
    piece(trim(lathe([[R * 0.88, -W], [R, -W * 0.72], [R, W * 0.72], [R * 0.88, W]], 22)), RIND, { r: [0, 0, Math.PI / 2] }),
    piece(trim(lathe([[0, -W * 1.04], [R * 0.88, -W]], 22)), CHEESE, { r: [0, 0, Math.PI / 2] }),
    piece(trim(lathe([[R * 0.88, W], [0, W * 1.04]], 22)), CHEESE, { r: [0, 0, Math.PI / 2] }),
  ];
  // holes on the faces and a stamped rim, so the roll can be seen
  for (const sx of [1, -1]) {
    for (const [a, r, s] of [[0.5, 0.55, 0.13], [1.7, 0.32, 0.1], [2.9, 0.62, 0.12], [4.1, 0.42, 0.14], [5.3, 0.66, 0.1]]) list.push(piece(disc(s, 8), '#e2bd5c', { p: [sx * (W * 1.03 + 0.012), Math.cos(a) * r, Math.sin(a) * r], r: [0, sx * Math.PI / 2, 0] }));
    list.push(piece(disc(0.2, 10), RIND, { p: [sx * (W * 1.04 + 0.012), 0, 0], r: [0, sx * Math.PI / 2, 0] }));
  }
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; list.push(piece(shapes.box(W * 1.5, 0.08, 0.06), '#b6822c', { p: [0, Math.cos(a) * (R + 0.006), Math.sin(a) * (R + 0.006)], r: [a, 0, 0] })); }
  group.add(mesh('wheel', list));
  return {
    group,
    update(g, s, dt) {
      // yaw first, then the roll: the pool's order would make it wobble when the road turns
      g.rotation.order = 'YXZ';
      g.userData.roll = (g.userData.roll || 0) + (dt || 0) * 11;
      g.rotation.x = g.userData.roll;
      child(g, 'wheel').position.y = Math.abs(Math.sin(clock(g, s, 0) + g.userData.roll * 0.3)) * 0.04;
    },
  };
}
