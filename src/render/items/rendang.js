// Rendang: a round clay pot of dark, thick rendang, the lid off to the side, and a smell you can see: warm curling wisps.
import { itemKit, child, clock } from './_kit.js';

export function build(ctx) {
  const k = itemKit(ctx), { shapes, x, piece, mesh, group } = k, { lathe, tube } = shapes, { ball, trim } = x;
  const CLAY = '#b4653a';
  const list = [
    piece(trim(lathe([[0, 0], [0.34, 0], [0.56, 0.2], [0.6, 0.42], [0.5, 0.62], [0.54, 0.7], [0.46, 0.72]], 16)), CLAY, null, (_x, y) => 0.8 + y * 0.32),
    piece(ball(0.46, [1, 0.2, 1], 13, 4), '#5c2a18', { p: [0, 0.66, 0] }),
  ];
  for (const [px, pz, s] of [[0.18, 0.1, 0.14], [-0.18, 0.14, 0.13], [0.02, -0.2, 0.15], [-0.24, -0.1, 0.1]]) list.push(piece(ball(s, [1.1, 0.72, 1], 7, 4), '#7a3a20', { p: [px, 0.72, pz] }));
  list.push(piece(ball(0.05, [1.8, 0.4, 1], 5, 3), '#4a8a45', { p: [0.06, 0.8, 0.04], r: [0, 0.8, 0] }));
  for (const sx of [1, -1]) list.push(piece(tube([[sx * 0.56, 0.5, 0], [sx * 0.74, 0.5, 0], [sx * 0.72, 0.36, 0]], 0.045, 5), CLAY));
  group.add(mesh('pot', list));
  const smell = mesh('smell', [0, 1].flatMap((i) => {
    const sx = i ? 1 : -1;
    const pts = Array.from({ length: 11 }, (_, j) => [sx * (0.24 + Math.sin(j * 0.95) * 0.1), 0.84 + j * 0.095, 0]);
    return [piece(tube(pts, pts.map((_, j) => Math.max(0.012, 0.075 * Math.sin(((j + 1) / 12) * Math.PI))), 5), '#f4dcb8')];
  }));
  group.add(smell);
  return {
    group,
    update(g, s, dt) { const t = clock(g, s, dt), w = child(g, 'smell'); w.rotation.y = Math.sin(t * 1.3) * 0.3; w.scale.y = 1 + Math.sin(t * 2.1) * 0.08; },
  };
}
