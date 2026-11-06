// Frana: a slide of round boulders with a mud lick under them, and a yellow warning triangle. Friendly rocks, cartoon physics.
import { itemKit, child, clock } from './_kit.js';

export function build(ctx) {
  const k = itemKit(ctx), { shapes, x, piece, mesh, group } = k, { sphere, tube } = shapes, { ball, poly, twoSided } = x;
  const list = [piece(ball(1.2, [1.1, 0.14, 0.9], 12, 4), '#8a6a4a', { p: [0, 0.08, 0] })];
  for (const [px, py, pz, r, c] of [[-0.36, 0.42, 0.04, 0.46, '#b3abb0'], [0.42, 0.34, 0.2, 0.38, '#a59d9e'], [0.05, 0.28, -0.42, 0.34, '#c4bdc0'], [0.02, 0.8, 0.06, 0.34, '#bdb5b8'], [-0.7, 0.2, 0.46, 0.2, '#a59d9e'], [0.82, 0.16, -0.3, 0.17, '#b3abb0']]) {
    list.push(piece(sphere(r, 10, 7), c, { p: [px, py, pz], s: [1.06, 0.92, 1] }, (_x, y) => 0.82 + (y - py + r) * 0.3));
  }
  group.add(mesh('rocks', list));
  const sign = mesh('sign', [
    piece(tube([[1.0, 0, 0.56], [1.0, 1.2, 0.56]], 0.035, 4), '#6a6570'),
    piece(twoSided(poly([[-0.3, 0], [0, 0.5], [0.3, 0]]), 0.03), '#2e2630', { p: [1.0, 0.94, 0.58] }),
    piece(poly([[-0.24, 0], [0, 0.42], [0.24, 0]]), '#f6c23e', { p: [1.0, 0.975, 0.59] }),
    piece(ball(0.035, [1, 1, 0.3], 5, 3), '#2e2630', { p: [1.0, 1.02, 0.595] }),
    piece(ball(0.03, [0.8, 2.2, 0.3], 5, 3), '#2e2630', { p: [1.0, 1.15, 0.595] }),
  ]);
  group.add(sign);
  // where it will land: a dark pool on the road that grows as the rocks come down
  const shadow = mesh('shadow', [piece(ball(1.5, [1, 0.02, 1], 16, 3), '#2a2230', { p: [0, 0.02, 0] })]);
  group.add(shadow);
  return {
    group,
    update(g, s, dt) {
      const t = clock(g, s, dt), R = child(g, 'rocks'), S = child(g, 'shadow'), Z = child(g, 'sign');
      const left = Math.max(0, (s.warn ?? 0) - (s.t ?? 1e9)), falling = left > 0;
      S.visible = falling;
      Z.visible = !falling;
      if (falling) {
        // it comes down with gravity; the shadow says where, long before it gets there
        const u = 1 - left / s.warn;
        R.position.y = 26 * left * left;
        R.rotation.x = t * 4;
        S.scale.setScalar(0.35 + 0.65 * u);
      } else {
        R.rotation.x = 0;
        const since = (s.t ?? 1e9) - (s.warn ?? 0);
        R.position.y = since < 0.4 ? Math.abs(Math.sin(since * 16)) * (0.4 - since) : 0;
      }
    },
  };
}
