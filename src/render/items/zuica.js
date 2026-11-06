// Țuică: a stout brown plum brandy bottle with a cloth stopper, and the plum that went into it leaning against the foot.
import { itemKit, child } from './_kit.js';

export function build(ctx) {
  const k = itemKit(ctx), { shapes, x, piece, mesh, group } = k, { lathe, box, tube } = shapes, { ball, trim } = x;
  group.add(mesh('bottle', [
    piece(trim(lathe([[0, 0], [0.28, 0], [0.31, 0.06], [0.3, 0.52], [0.2, 0.78], [0.1, 0.92], [0.1, 1.2]], 14)), '#c98a3a'),
    piece(ball(0.13, [1, 0.9, 1], 8, 5), '#d9463d', { p: [0, 1.25, 0] }),
    piece(trim(lathe([[0.115, 1.14], [0.115, 1.2]], 10)), '#fbf4e0'),
    piece(box(0.4, 0.26, 0.02), '#fbf4e0', { p: [0, 0.32, 0.3] }),
    piece(ball(0.08, [1, 1, 0.3], 8, 4), '#5c3a7e', { p: [0, 0.32, 0.31] }),
  ]));
  group.add(mesh('plum', [
    piece(ball(0.22, [0.96, 1.08, 0.96], 10, 7), '#5c3a7e', { p: [0.36, 0.22, 0.2] }),
    piece(ball(0.05, [1, 1, 0.3], 5, 3), '#cbb6e2', { p: [0.3, 0.32, 0.38] }),
    piece(tube([[0.36, 0.44, 0.2], [0.38, 0.54, 0.18]], 0.018, 3), '#5c3f22'),
    piece(ball(0.09, [1.5, 0.3, 0.7], 6, 3), '#4a8a45', { p: [0.46, 0.53, 0.16], r: [0, 0, -0.5] }),
  ], { vertexColors: true, gloss: [40, 0.14], rim: [0.05, 3] }));
  // thrown out between sips only the plum stone goes, the bottle only at the last one
  return { group, update(g, s) { if (s.sub) { child(g, 'bottle').visible = s.sub === 'bottle'; child(g, 'plum').visible = s.sub === 'plum'; } } };
}
