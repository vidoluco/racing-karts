// Landmarks for the synthetic long track: a stand-in for what a real one carries, sized for its worst case. A house every
// 30 m on both sides of the road, an always visible tower every 1.5 km, groves all along, so that the budgets are tested on a
// busy lap and not an empty one.
import * as THREE from 'three';

function house(s, x, y, z, yaw, tone) {
  const parts = [];
  const body = s.roundedBox(7, 5, 9, 0.2, 1); s.place(body, { p: [0, 2.5, 0] }); s.paint(body, tone); parts.push(body);
  const roof = s.cone(6.2, 3.4, 4); s.place(roof, { p: [0, 6.7, 0], r: [0, Math.PI / 4, 0] }); s.paint(roof, '#9c5438'); parts.push(roof);
  for (const a of [-2.6, 2.6]) { const w = s.roundedBox(1.2, 1.4, 0.2, 0.05, 1); s.place(w, { p: [a * 0.7, 2.9, 4.55] }); s.paint(w, '#364a5e'); parts.push(w); }
  const g = s.merge(parts);
  g.rotateY(yaw); g.translate(x, y, z);
  return g;
}

export default {
  plan(ctx) {
    const { track, world } = ctx, S = track.samples;
    for (let i = 0; i < track.n; i += 15) {
      if (track.structureAt(i)) continue;
      for (const side of [-1, 1]) {
        const d = S.w[i] / 2 + 13, x = S.x[i] + S.nx[i] * d * side, z = S.z[i] + S.nz[i] * d * side;
        world.keepOut.push({ x, z, r: 9 });
      }
    }
    for (let i = 0; i < track.n; i += 260) {
      const side = i % 520 ? 1 : -1, d = 90, x = S.x[i] + S.nx[i] * d * side, z = S.z[i] + S.nz[i] * d * side;
      world.groves.push({ x, z, r: 130, cover: i % 780 ? 0.7 : -0.7 });
    }
  },
  build(ctx) {
    const { track, batch, shapes: s, world, terrain } = ctx, T = track.samples;
    const tones = ['#e8d6b8', '#d6b58a', '#c98f62', '#f0e4cf'];
    for (let i = 0; i < track.n; i += 15) {
      if (track.structureAt(i)) continue;
      for (const side of [-1, 1]) {
        const d = T.w[i] / 2 + 13, x = T.x[i] + T.nx[i] * d * side, z = T.z[i] + T.nz[i] * d * side;
        if (terrain.roadDistAt(x, z) < 8) continue;
        const y = world.ground.groundAt(x, z), yaw = Math.atan2(T.tx[i], T.tz[i]) + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
        batch.add(house(s, x, y, z, yaw, tones[(i + side + 4) % 4]));
        batch.blob(x, z, 8, 0.4);
      }
    }
    for (let i = 300; i < track.n; i += 750) {
      const d = T.w[i] / 2 + 60, x = T.x[i] - T.nx[i] * d, z = T.z[i] - T.nz[i] * d, y = world.ground.groundAt(x, z), parts = [];
      for (let q = 0; q < 6; q++) { const g = s.cylinder(9 - q, 10 - q, 14, 16); s.place(g, { p: [x, y + 7 + q * 13, z] }); s.paint(g, q % 2 ? '#b74f3f' : '#efe6d4'); parts.push(g); }
      const low = s.cylinder(4, 9, 80, 8); s.place(low, { p: [x, y + 40, z] }); s.paint(low, '#c9836a');
      batch.add(s.merge(parts), { far: true, low });
      batch.blob(x, z, 16, 0.5);
    }
  },
  THREE,
};
