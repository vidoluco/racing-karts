// Uova, speck e patate: a sizzling iron pan with its long handle, two fried eggs, rashers of speck and golden potatoes.
import { itemKit, child, clock } from './_kit.js';

export function build(ctx) {
  const k = itemKit(ctx), { shapes, x, piece, mesh, group } = k, { lathe, box, tube } = shapes, { ball, trim } = x;
  const list = [
    piece(trim(lathe([[0, 0], [0.74, 0], [0.86, 0.16], [0.88, 0.24], [0.8, 0.24], [0.72, 0.1], [0, 0.1]], 18)), '#37343c'),
    piece(tube([[0.82, 0.2, 0], [1.3, 0.3, 0], [1.72, 0.42, 0]], [0.07, 0.06, 0.08], 6), '#37343c'),
  ];
  for (const [ex, ez, r] of [[-0.3, 0.14, 0.32], [0.26, -0.22, 0.3]]) {
    list.push(piece(ball(r, [1.15, 0.12, 1], 11, 4), '#fbf7ec', { p: [ex, 0.13, ez] }));
    list.push(piece(ball(r * 0.44, [1, 0.62, 1], 9, 5), '#f6b21c', { p: [ex + 0.03, 0.17, ez - 0.02] }));
  }
  // the speck: pink rashers with a white rim of fat
  for (const [px, pz, ry] of [[-0.18, -0.42, 0.6], [0.4, 0.28, -0.8]]) {
    list.push(piece(box(0.42, 0.04, 0.16), '#c8504c', { p: [px, 0.13, pz], r: [0, ry, 0.05] }));
    list.push(piece(box(0.44, 0.045, 0.04), '#f3dfc8', { p: [px + Math.sin(ry) * 0.08, 0.13, pz + Math.cos(ry) * 0.08], r: [0, ry, 0.05] }));
  }
  for (const [px, pz, s] of [[0.5, -0.02, 0.14], [0.08, 0.46, 0.15], [-0.54, -0.2, 0.14], [-0.04, -0.06, 0.13], [0.4, 0.48, 0.11], [-0.48, 0.42, 0.12]]) list.push(piece(ball(s, [1.1, 0.8, 0.95], 7, 4), '#e8b84a', { p: [px, 0.17, pz] }));
  group.add(mesh('pan', list));
  // bubbles of fat that pop on the pan
  const bub = mesh('bubbles', [0, 1, 2].map((i) => piece(ball(0.05, [1, 1, 1], 5, 3), '#fff4cc', { p: [-0.5 + i * 0.5, 0.24, 0.2 - i * 0.22] })));
  group.add(bub);
  return { group, update(g, s, dt) { const t = clock(g, s, dt), b = child(g, 'bubbles'); b.scale.y = 1 + Math.abs(Math.sin(t * 19)) * 0.4; } };
}
