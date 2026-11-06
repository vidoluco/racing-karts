// Grappa: a slim clear bottle, a fingerful of spirit, a cork and a paper label. Sharp shoulders, no brand.
import { itemKit } from './_kit.js';

export function build(ctx) {
  const k = itemKit(ctx), { shapes, x, piece, mesh, group } = k, { lathe, box } = shapes, { trim } = x;
  const GLASS = '#cfeaf2', SPIRIT = '#f2f8e8';
  group.add(mesh('bottle', [
    piece(trim(lathe([[0, 0], [0.21, 0], [0.23, 0.04], [0.21, 0.5]], 14)), SPIRIT),
    piece(trim(lathe([[0.21, 0.5], [0.2, 0.92], [0.1, 1.12], [0.075, 1.2], [0.075, 1.56]], 14)), GLASS),
    piece(trim(lathe([[0.095, 1.5], [0.1, 1.58], [0.1, 1.7], [0, 1.74]], 10)), '#c9a06a'),
    piece(box(0.3, 0.3, 0.02), '#f7efdc', { p: [0, 0.4, 0.215] }),
    piece(box(0.22, 0.05, 0.02), '#a8362e', { p: [0, 0.44, 0.226] }),
    piece(box(0.16, 0.03, 0.02), '#3a3238', { p: [0, 0.34, 0.226] }),
  ], { vertexColors: true, gloss: [46, 0.22], rim: [0.28, 2] }));
  return { group };
}
