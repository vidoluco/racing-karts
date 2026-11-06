// Mici: three plump grilled sausages, charred stripes across them, on the wing. In the air they fly side by side and turn.
import { itemKit, child, clock } from './_kit.js';

export function build(ctx) {
  const k = itemKit(ctx), { shapes, x, piece, mesh, group } = k, { capsule, box } = shapes;
  const list = [];
  for (const [dx, dy, ry] of [[-0.34, 0, 0.12], [0.34, 0, -0.1], [0, 0.26, 0.04]]) {
    list.push(piece(capsule(0.19, 0.62, 3, 8), '#a0522d', { p: [dx, 0.19 + dy, 0], r: [Math.PI / 2, ry, 0] }));
    for (const dz of [-0.26, 0, 0.26]) list.push(piece(box(0.22, 0.03, 0.05), '#3f2115', { p: [dx, 0.365 + dy, dz], r: [0, 0.6, 0] }));
  }
  group.add(mesh('sausages', list));
  return {
    group,
    update(g, s, dt) { child(g, 'sausages').rotation.x = clock(g, s, dt) * 9; child(g, 'sausages').position.y = 0; },
  };
}
