// Polenta: a copper pot on its side, spilling a wide sticky yellow puddle with fat bubbles in it. Radius 2 m at scale 1: the sim's r
// sets the size of the spill, the pot is shrunk back so it stays a pot on a big puddle.
import { itemKit, child, clock } from './_kit.js';

export function build(ctx) {
  const k = itemKit(ctx), { shapes, x, piece, mesh, group } = k, { lathe, tube } = shapes, { ball, trim, dome } = x;
  const YEL = '#f2c544', COPPER = '#c8713c', list = [];
  // uneven lobes: a puddle, not a disc
  for (const [dx, dz, r] of [[0, 0, 1.55], [0.86, 0.4, 0.98], [-0.8, 0.58, 0.9], [0.42, -0.86, 1.0], [-0.72, -0.62, 0.92]]) list.push(piece(ball(r, [1, 0.06, 1], 14, 3), YEL, { p: [dx, 0.05, dz] }, (px, _y, pz) => 0.95 + 0.1 * Math.sin(px * 3.1 + pz * 2.3)));
  for (const [dx, dz, r] of [[0.4, 0.3, 0.2], [-0.7, 0.2, 0.15], [-0.1, -0.7, 0.17], [0.9, -0.3, 0.13]]) list.push(piece(ball(r, [1, 0.5, 1], 7, 3), '#f8d96e', { p: [dx, 0.1, dz] }));
  group.add(mesh('puddle', list));
  const pot = mesh('pot', [
    piece(trim(lathe([[0, -0.27], [0.27, -0.27], [0.31, -0.2], [0.33, 0.2], [0.36, 0.26], [0.3, 0.26], [0.27, 0.0]], 14)), COPPER, { r: [Math.PI / 2 - 0.1, 0, 0] }),
    piece(ball(0.27, [1, 1, 0.2], 11, 4), YEL, { p: [0, 0, 0.06], r: [-0.1, 0, 0] }),
    piece(tube([[0.3, 0.04, -0.2], [0.42, 0.1, -0.1], [0.3, 0.14, 0.04]], 0.028, 4), '#8a4a26'),
    piece(tube([[-0.3, 0.04, -0.2], [-0.42, 0.1, -0.1], [-0.3, 0.14, 0.04]], 0.028, 4), '#8a4a26'),
  ]);
  pot.position.set(0.55, 0.3, -0.5);
  group.add(pot);
  return {
    group,
    update(g, s, dt) {
      const t = clock(g, s, dt), P = child(g, 'pot'), scale = (s.r || 2) / 2;
      // the pot keeps its own size whatever the puddle does
      P.scale.set(1.2 / scale, 1.2 / Math.min(scale, 1), 1.2 / scale);
      P.rotation.z = Math.sin(t * 1.3) * 0.02;
      const life = s.ttl ? Math.min(1, (s.ttl - s.t) * 1.2) : 1, grow = Math.min(1, (s.t ?? 1) * 4 + 0.15);
      const pud = child(g, 'puddle'); pud.scale.setScalar(grow * life);
    },
  };
}
