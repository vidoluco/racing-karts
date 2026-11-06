// Jukung: a Balinese outrigger fishing boat on wheels. A slim hull in stripes with the fish snout of the gagah minah at the prow, big
// painted eyes and jaws to guide it home, the raised stern, bright S-curved booms to two long bamboo floats, and the crab-claw sail in
// bold colour blocks. Komo the Komodo dragon steers from the middle, his tail over the stern, tongue flicking.
import { createRig, swing, spring } from './_kit.js';
import { chibi } from '../chibi.js';

const YEL = '#f4c430', BLUE = '#2a8fc4', RED = '#de3e2c', WHITE = '#f8f4e6', INK = '#231a22', BAMBOO = '#d9bd76', SCALE = '#7f8e5a', SCALE_D = '#5d6a42';

export function build(ctx) {
  const r = createRig(ctx), { part, bone, wheel, x, shapes, grad } = r, { box, tube, lathe, capsule } = shapes, { ball, wheelGeo, limb, poly, dome, trim, twoSided } = x;
  const B = 'body', wR = 0.3, opts = { tyre: DARKT(), rim: YEL, hub: RED, rimAt: 0.72 };
  wheel('wFL', [0.5, wR, 0.68], { front: true, geo: wheelGeo(wR, 0.3, { ...opts, side: 1 }) });
  wheel('wFR', [-0.5, wR, 0.68], { front: true, geo: wheelGeo(wR, 0.3, { ...opts, side: -1 }) });
  wheel('wBL', [0.5, wR, -0.7], { geo: wheelGeo(wR, 0.3, { ...opts, side: 1 }) });
  wheel('wBR', [-0.5, wR, -0.7], { geo: wheelGeo(wR, 0.3, { ...opts, side: -1 }) });

  // the hull: a spindle, the stations colour by colour, bent up at both ends
  const hullY = 0.72, L = 1.58;
  const station = [[-1, 0.03], [-0.82, 0.16], [-0.55, 0.3], [-0.2, 0.37], [0.2, 0.37], [0.55, 0.3], [0.8, 0.17], [1, 0.03]];
  const hull = (run, color) => {
    const pts = run.map((i) => [station[i][1], station[i][0] * L]);
    const g = trim(lathe(pts, 12));
    g.rotateX(Math.PI / 2);
    const P = g.attributes.position;
    for (let i = 0; i < P.count; i++) {
      const z = P.getZ(i) / L, y = P.getY(i), xx = P.getX(i);
      // flat bottom, sheer rising at the ends: y over zero is the sides, under it the belly
      const lift = z > 0 ? 0.52 * z ** 3.2 : 0.62 * (-z) ** 3;
      P.setXYZ(i, xx * 0.9, (y > 0 ? y * 0.92 : y * 0.62) + hullY + lift, P.getZ(i));
    }
    g.computeVertexNormals();
    part(B, g, color);
  };
  hull([0, 1, 2], BLUE); hull([2, 3], YEL); hull([3, 4], RED); hull([4, 5], YEL); hull([5, 6, 7], BLUE);

  // a pale deck band along the top and thwarts
  part(B, box(0.58, 0.05, 1.3), '#caa877', { p: [0, hullY + 0.27, -0.02] });
  for (const z of [-0.5, 0.42]) part(B, box(0.66, 0.06, 0.12), '#8f5e34', { p: [0, hullY + 0.3, z] });

  // the prow: the great painted eye, ringed, on both sides, and the jaws of the fish
  const eyeZ = 1.08;
  for (const sx of [1, -1]) {
    const py = hullY + 0.2, n = [sx * 0.85, 0.1, 0.5], ry = Math.atan2(n[0], n[2]), px = sx * 0.2;
    part(B, ball(0.15, [1, 1, 0.3], 10, 4), WHITE, { p: [px, py, eyeZ], r: [0, ry, 0] });
    part(B, ball(0.1, [1, 1, 0.34], 9, 4), INK, { p: [px + n[0] * 0.03, py, eyeZ + n[2] * 0.03], r: [0, ry, 0] });
    part(B, x.disc(0.034, 6), [1.5, 1.5, 1.5], { p: [px + n[0] * 0.06, py + 0.04, eyeZ + n[2] * 0.06], r: [0, ry, 0] });
    part(B, tube([[px - sx * 0.05, py - 0.16, eyeZ + 0.34], [px + sx * 0.05, py - 0.17, eyeZ + 0.1], [px + sx * 0.14, py - 0.13, eyeZ - 0.12]], 0.018, 3), RED);
  }

  // the stern rises in a tail, a painted fin on it
  part(B, tube([[0, hullY + 0.5, -L * 0.94], [0, hullY + 0.9, -L * 1.08]], [0.05, 0.02], 4), BLUE);

  // booms: two bright S curves across the boat, fat enough to read, the shape everyone remembers
  const booms = (z) => {
    for (const sx of [1, -1]) part(B, tube(x.curve([[sx * 0.05, hullY + 0.3, z], [sx * 0.42, hullY + 0.56, z], [sx * 0.82, hullY + 0.36, z], [sx * 1.08, hullY + 0.0, z], [sx * 1.3, hullY - 0.12, z]], 7), 0.052, 5), RED);
  };
  booms(0.56); booms(-0.56);
  // floats: long and white with red tips, they bounce on their booms
  const floats = bone('floats', B, [0, 0.58, 0]);
  for (const sx of [1, -1]) {
    part(floats, tube([[sx * 1.32, 0.56, -0.96], [sx * 1.32, 0.58, -0.7], [sx * 1.32, 0.59, 0.7], [sx * 1.32, 0.56, 1.0]], [0.09, 0.13, 0.13, 0.09], 8), WHITE);
    part(floats, ball(0.09, [1, 1, 2.4], 7, 4), RED, { p: [sx * 1.32, 0.56, 1.1] });
    part(floats, ball(0.09, [1, 1, 2.0], 7, 4), BAMBOO, { p: [sx * 1.32, 0.56, -1.04] });
  }

  // mast and the crab-claw sail: two curved spars and bold colour blocks, the whole thing swings to the wind
  const sc = [0.02, hullY + 0.32, -0.34];
  part(B, tube([sc, [0.1, hullY + 1.0, -0.42]], 0.035, 5), BAMBOO);
  const sail = bone('sail', B, sc);
  const sp = (t) => [0.02 + 0.03 * t, sc[1] + 1.72 * t ** 0.9 - 0.05, sc[2] - 0.7 * t ** 1.5 + 0.05];       // the upper spar
  const lo = (t) => [0.02 + 0.03 * t, sc[1] + 0.7 * t, sc[2] - 1.3 * t ** 0.86];                            // the lower spar
  const blocks = [RED, YEL, '#3aa55a', BLUE, RED];
  const tri = (a, b, c, d, color) => {
    const g = new ctx.THREE.BufferGeometry();
    g.setAttribute('position', new ctx.THREE.Float32BufferAttribute([...a, ...b, ...c, ...d, ...a, ...b, ...c, ...d], 3));
    g.setIndex([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6]);
    g.computeVertexNormals();
    // the two faces share no vertices, so light works on each side
    part(sail, g, color);
  };
  for (let i = 0; i < blocks.length; i++) {
    const t0 = i / blocks.length, t1 = (i + 1) / blocks.length;
    tri(sp(t0), lo(t0), lo(t1), sp(t1), blocks[i]);
  }
  part(sail, tube([0, 0.25, 0.5, 0.75, 1].map(sp), 0.028, 4), BAMBOO);
  part(sail, tube([0, 0.25, 0.5, 0.75, 1].map(lo), 0.028, 4), BAMBOO);

  // Komo: a fat grey-green head, long snout, small ear holes, spines down the back, a heavy tail over the stern
  const tail = bone('tail', B, [0, hullY + 0.34, -0.62]);
  part(tail, tube([[0, hullY + 0.36, -0.58], [0, hullY + 0.38, -0.92], [0.05, hullY + 0.22, -1.22], [0.1, hullY - 0.04, -1.42]], [0.15, 0.13, 0.09, 0.03], 6), SCALE_D);
  const d = chibi(r, {
    at: [0, hullY + 0.24, -0.26], size: 0.98, fur: SCALE, belly: '#d5d4a2', muzzleColor: '#a0ac76', nose: '#2b2224', inner: SCALE_D, noseR: 0.03, cheeks: null,
    head: { r: 0.4, s: [1.14, 0.84, 1.08] }, torso: { r: 0.27, h: 0.1 },
    eyes: { r: 0.135, gap: 0.21, y: 0.08, iris: '#2a1c16' }, muzzle: { r: 0.25, s: [1.15, 0.58, 1.12], y: -0.09, z: -0.04 },
    ears: { kind: 'dot', r: 0.04, side: 0.96, up: 0.08 },
    arms: { r: 0.08, grip: [[0.16, hullY + 0.56, 0.32], [-0.16, hullY + 0.56, 0.32]], hand: SCALE_D },
    extra: ({ head, torso, center: c, hr, at, tr, th }) => {
      for (let i = 0; i < 4; i++) part(torso, shapes.cone(0.05, 0.1, 4), SCALE_D, { p: [at[0], at[1] + tr * 0.6 + i * 0.13, at[2] - tr * 0.96 + i * 0.005], r: [-0.8, 0, 0] });
      for (let i = 0; i < 3; i++) part(head, shapes.cone(0.05, 0.1, 4), SCALE_D, { p: [c[0], c[1] + hr * 0.82 - i * 0.1, c[2] - 0.12 - i * 0.13], r: [-0.5 - i * 0.3, 0, 0] });
      for (const [dx, dy, dz] of [[0.2, 0.6, 0.22], [-0.24, 0.48, 0.3], [0.32, 0.25, 0.32], [-0.1, 0.8, -0.1], [0.3, 0.72, -0.2]]) part(head, ball(0.035, [1, 0.5, 1], 4, 3), SCALE_D, { p: [c[0] + dx * hr * 1.2, c[1] + dy * hr * 0.8, c[2] + dz * hr] });
    },
  });
  // the tongue flicks now and then
  const tong = bone('tongue', d.head, [0, d.center[1] - 0.14, d.center[2] + 0.4 * 1.08 + 0.2]);
  const tg = [0, d.center[1] - 0.14, d.center[2] + 0.4 * 1.08 + 0.2];
  part(tong, tube([tg, [0, tg[1], tg[2] + 0.2]], 0.015, 3), '#e84f6c');
  part(tong, tube([[0, tg[1], tg[2] + 0.18], [0.06, tg[1] - 0.01, tg[2] + 0.28]], 0.012, 3), '#e84f6c');
  part(tong, tube([[0, tg[1], tg[2] + 0.18], [-0.06, tg[1] - 0.01, tg[2] + 0.28]], 0.012, 3), '#e84f6c');
  r.hide(tong);

  // steering oar under his hands
  part(B, limb([0, hullY + 0.3, 0.42], [0, hullY + 0.56, 0.3], 0.03, 4, 1), '#8f5e34');
  const sw = bone('steer', B, [0, hullY + 0.58, 0.3]);
  part(sw, shapes.torus(0.15, 0.03, 3, 9), '#8f5e34', { p: [0, hullY + 0.58, 0.3], r: [Math.PI / 2 - 0.7, 0, 0] });

  const sailS = spring(4, 0.22);
  let flick = 0, flickAt = 2, furl = 1;
  const model = r.finish({
    driver: d,
    update(m, k, dt) {
      sw.rotation.y = -m.steer * 0.6;
      // the sail swings across on a turn, away from the wind of the race, and flutters at speed
      const a = sailS.step(0.55 - m.lean * 0.35 + m.lat * 0.2, m.dt || 1 / 60);
      sail.rotation.y = a + Math.sin(m.t * 15) * 0.012 * (0.3 + m.sn);
      sail.rotation.z = -m.lean * 0.05 - m.sn * 0.05;
      sail.scale.set(1, furl, furl);
      floats.position.y = floats.userData.rest.y + Math.sin(m.dist * 0.9) * 0.018 * m.sn - m.vert * 0.03;
      floats.rotation.z = m.lat * 0.015;
      // the boat pitches over its own waves, a boat out of water is still a boat
      r.get('body').rotation.x += Math.sin(m.dist * 0.5) * 0.012 * m.sn;
      if (m.t > flickAt && dt > 0) { flick = 1; flickAt = m.t + 2 + Math.random() * 4; }
      flick = Math.max(0, flick - (dt || 0) * 3.5);
      tong.scale.setScalar(Math.max(0.001, Math.sin(flick * Math.PI)));
    },
  });
  // Asked for each view just before it draws: the sail is the one flat thing tall enough to fill a chasing camera, so for a view
  // whose kart is right behind this one it drops onto the deck. Its own driver's view always has it up.
  model.viewClose = (dist, own) => { furl = own ? 1 : Math.max(0.08, Math.min(1, (dist - 7) / 8)); sail.scale.set(1, furl, furl); };
  return model;
}
function DARKT() { return '#2b2931'; }
