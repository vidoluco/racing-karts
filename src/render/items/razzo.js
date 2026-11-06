// Razzo: a chubby tin toy rocket, red and cream with riveted bands, a round porthole, fat fins and a flame that never sits still.
import { itemKit, child, clock } from './_kit.js';

export function build(ctx) {
  const k = itemKit(ctx), { shapes, x, piece, mesh, group } = k, { lathe, box, tube } = shapes, { ball, trim, dome, poly } = x;
  const RED = '#d9483b', CREAM = '#f4e9cf', TIN = '#c7ccd4', DARK = '#2e2630';
  const body = (r0, c) => piece(trim(lathe(r0, 14)), c, { r: [Math.PI / 2, 0, 0] });
  const list = [
    body([[0.2, -0.86], [0.42, -0.62], [0.5, -0.3]], TIN),
    body([[0.5, -0.3], [0.52, -0.2]], DARK),
    body([[0.52, -0.2], [0.53, 0.2]], RED),
    body([[0.53, 0.2], [0.5, 0.3]], DARK),
    body([[0.5, 0.3], [0.42, 0.56]], CREAM),
    body([[0.42, 0.56], [0.28, 0.82]], CREAM),
    body([[0.28, 0.82], [0.12, 1.0], [0, 1.06]], RED),
    // the porthole on top, the part you see from behind
    piece(ball(0.2, [1, 1, 0.4], 10, 5), DARK, { p: [0, 0.46, 0.36], r: [-Math.PI / 2 + 0.25, 0, 0] }),
    piece(ball(0.15, [1, 1, 0.5], 10, 5), '#8fd3ea', { p: [0, 0.48, 0.36], r: [-Math.PI / 2 + 0.25, 0, 0] }),
  ];
  // four fat rounded fins
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4, cx = Math.cos(a), cy = Math.sin(a);
    list.push(piece(tube([[cx * 0.44, cy * 0.44, -0.36], [cx * 0.72, cy * 0.72, -0.62], [cx * 0.82, cy * 0.82, -0.92]], [0.12, 0.13, 0.05], 6), i % 2 ? RED : CREAM));
  }
  group.add(mesh('tin', list));
  const flame = mesh('flame', [
    piece(ball(0.3, [1, 1, 1.9], 9, 5), '#ffb13a', { p: [0, 0, -1.2] }),
    piece(ball(0.17, [1, 1, 2.2], 7, 4), '#fff2b8', { p: [0, 0, -1.06] }),
  ], { vertexColors: true, emissive: '#ff7a1a', emissiveIntensity: 0.9 });
  group.add(flame);
  return {
    group,
    update(g, s, dt) {
      const t = clock(g, s, dt), f = child(g, 'flame');
      if (f) { const q = 0.85 + 0.25 * Math.sin(t * 47) + 0.15 * Math.sin(t * 71); f.scale.set(0.9 + q * 0.14, 0.9 + q * 0.14, q); }
      child(g, 'tin').rotation.z = t * 3;
    },
  };
}
