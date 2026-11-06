// Durian: a spiky but soft green fruit with a wisp of green stink rising from it. Whole fruit in the hand; on the road the sim's r makes it
// a wide cloud, and the fruit stays fruit sized in the middle.
import { itemKit, child, clock } from './_kit.js';

export function build(ctx) {
  const k = itemKit(ctx), { shapes, x, piece, mesh, group } = k, { cone, sphere, tube } = shapes, { ball } = x;
  const fruit = [piece(sphere(0.62, 14, 10), '#94b03f', { p: [0, 0.68, 0], s: [0.95, 1.1, 0.95] }, (_x, y) => 0.8 + (y - 0.1) * 0.36)];
  // soft spikes: fat little cones with blunt tips, in rings
  for (let r = 0; r < 5; r++) {
    const phi = 0.42 + r * 0.56, n = [4, 7, 8, 7, 4][r];
    for (let i = 0; i < n; i++) {
      const th = ((i + (r % 2) * 0.5) / n) * Math.PI * 2, dir = new k.THREE.Vector3(Math.sin(phi) * Math.cos(th) * 0.95, Math.cos(phi) * 1.1, Math.sin(phi) * Math.sin(th) * 0.95), q = new k.THREE.Quaternion().setFromUnitVectors(new k.THREE.Vector3(0, 1, 0), dir.clone().normalize());
      const g = cone(0.13, 0.19, 6);
      g.applyQuaternion(q);
      g.translate(dir.x * 0.65, 0.68 + dir.y * 0.65, dir.z * 0.65);
      fruit.push(piece(g, '#7f9a33'));
    }
  }
  fruit.push(piece(tube([[0, 1.32, 0], [0.03, 1.48, 0.02]], 0.05, 5), '#5a4a2a'));
  group.add(mesh('fruit', fruit));
  // the wisp: three puffs in a rising curl; the cloud: a ring of soft green puffs, a tint on the road, a stink you can see
  const wisp = mesh('wisp', [[0.0, 1.72, 0.16, 0.2], [0.2, 2.04, 0.06, 0.15], [0.04, 2.3, 0.1, 0.11]].map(([px, py, pz, r]) => piece(ball(r, [1, 1, 1], 7, 4), '#b7d35a', { p: [px, py, pz] })));
  group.add(wisp);
  const cloudParts = [];
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; cloudParts.push(piece(ball(0.62, [1, 0.7, 1], 11, 6), i % 2 ? '#a9c94e' : '#c6dc72', { p: [Math.cos(a) * 1.45, 0.5, Math.sin(a) * 1.45] })); }
  cloudParts.push(piece(ball(1.1, [1, 0.56, 1], 14, 7), '#b7d35a', { p: [0, 0.74, 0] }));
  const cloud = mesh('cloud', cloudParts);
  cloud.visible = false;
  group.add(cloud);
  return {
    group,
    update(g, s, dt) {
      const t = clock(g, s, dt), f = child(g, 'fruit'), w = child(g, 'wisp'), c = child(g, 'cloud'), spill = !!s.ttl;
      w.position.y = Math.sin(t * 1.7) * 0.06; w.rotation.y = t * 0.9;
      c.visible = spill;
      if (spill) {
        const inv = 1 / ((s.r || 2) / 2), life = Math.min(1, (s.ttl - s.t) * 1.2), grow = Math.min(1, s.t * 3 + 0.2);
        f.scale.setScalar(inv * 1.5); w.scale.setScalar(inv * 1.6);
        // the cloud breathes
        c.scale.set(grow * life * (1 + Math.sin(t * 1.3) * 0.04), grow * life * 0.56 * (1 + Math.sin(t * 2.1) * 0.08), grow * life * (1 + Math.cos(t * 1.1) * 0.04));
        c.rotation.y = t * 0.4;
      }
    },
  };
}
