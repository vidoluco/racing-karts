// Sambal: a red chilli beside the stone bowl of an ulek-ulek, full of red paste. On the road the sim lays it down as burning trail, so a
// spill shows only the flames, licking and dying.
import { itemKit, child, clock } from './_kit.js';

export function build(ctx) {
  const k = itemKit(ctx), { shapes, x, piece, mesh, group } = k, { lathe, tube } = shapes, { ball, trim } = x;
  const prop = mesh('prop', [
    piece(trim(lathe([[0, 0], [0.42, 0], [0.56, 0.16], [0.6, 0.32], [0.5, 0.34], [0.42, 0.2], [0, 0.17]], 14)), '#7b7682'),
    piece(ball(0.46, [1, 0.12, 1], 12, 4), '#d7321c', { p: [0, 0.23, 0] }),
    piece(ball(0.08, [1, 0.5, 1], 6, 3), '#f2752e', { p: [-0.14, 0.27, 0.1] }),
    piece(ball(0.06, [1, 0.5, 1], 6, 3), '#f6d24a', { p: [0.12, 0.27, -0.08] }),
    // the pestle resting in the bowl
    piece(tube([[0.1, 0.28, 0.02], [0.32, 0.72, 0.1]], [0.09, 0.06], 6), '#8c8791'),
    // the chilli: fat at the shoulder, a hooked tip, a green cap
    piece(tube([[0.6, 0.36, 0.52], [0.46, 0.38, 0.64], [0.3, 0.38, 0.73], [0.02, 0.3, 0.78], [-0.28, 0.16, 0.68], [-0.46, 0.05, 0.5]], [0.15, 0.165, 0.16, 0.12, 0.07, 0.015], 12), '#e4331e'),
    piece(ball(0.13, [1, 0.7, 1], 7, 3), '#4a8a45', { p: [0.68, 0.37, 0.46] }),
    piece(tube([[0.72, 0.38, 0.44], [0.84, 0.46, 0.34]], 0.032, 4), '#4a8a45'),
  ]);
  group.add(prop);
  // tongues of flame: a teardrop turned on a lathe, round at the foot and pointed at the tip
  const tongue = (px, pz, h, r, c) => piece(trim(lathe([[0, 0], [r * 0.75, h * 0.06], [r, h * 0.24], [r * 0.82, h * 0.46], [r * 0.44, h * 0.72], [0.012, h]], 10)), c, { p: [px, 0, pz] });
  const fire = mesh('fire', [tongue(0, 0, 1.9, 0.5, '#ff5a24'), tongue(0.46, 0.2, 1.3, 0.34, '#ff8a2a'), tongue(-0.44, -0.14, 1.4, 0.36, '#ff8a2a'), tongue(0, 0.3, 1.0, 0.28, '#ffd24a')], { vertexColors: true, emissive: '#ff5a10', emissiveIntensity: 0.8 });
  fire.visible = false;
  group.add(fire);
  return {
    group,
    update(g, s, dt) {
      const t = clock(g, s, dt), P = child(g, 'prop'), F = child(g, 'fire'), spill = !!s.ttl;
      P.visible = !spill; F.visible = spill;
      // it rises from the road, so the kart that lays it (and the camera just behind) is past it before it stands tall
      if (spill) { const life = Math.min(1, (s.ttl - s.t) * 1.6, 0.08 + s.t / 0.32); F.scale.set(life * (1 + Math.sin(t * 31) * 0.1), life * (1 + Math.sin(t * 23) * 0.22), life * (1 + Math.cos(t * 29) * 0.1)); }
    },
  };
}
