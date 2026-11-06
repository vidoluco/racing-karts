// Becak: the three-wheeled pedal cab of Java. The passenger bench in front between two wheels under a folding hood like a pram's, painted
// in bands with a volcano on the back panel (the motifs are licence), and the driver behind on a saddle over the single rear wheel,
// really pedalling. A brass bell. Tokek the gecko has the big eyes and the sticky toes.
import { createRig, swing, spring } from './_kit.js';
import { chibi } from '../chibi.js';

const PINK = '#e0476b', TEAL = '#37b6b0', YEL = '#f6c23e', STEEL = '#d7dbe2', DARK = '#2b2931', GREEN = '#6cc24a', GREEN_D = '#45a040', ORANGE = '#f28a2e';

export function build(ctx) {
  const r = createRig(ctx), { part, bone, wheel, x, shapes, grad } = r, { roundedBox, box, tube, capsule, lathe, torus } = shapes, { ball, wheelGeo, limb, poly, star, dome, trim } = x;
  const B = 'body', fR = 0.36, rR = 0.42, opts = { tyre: DARK, rim: YEL, hub: PINK, rimAt: 0.78, hubAt: 0.22 };
  wheel('wFL', [0.72, fR, 0.42], { front: true, geo: wheelGeo(fR, 0.17, { ...opts, side: 1 }) });
  wheel('wFR', [-0.72, fR, 0.42], { front: true, geo: wheelGeo(fR, 0.17, { ...opts, side: -1 }) });
  wheel('wB', [0, rR, -1.18], { geo: wheelGeo(rR, 0.19, { ...opts, seg: 13, side: 1 }) });

  // the foot board at the very front and the mudguards
  part(B, roundedBox(1.06, 0.07, 0.56, 0.03, 1), TEAL, { p: [0, 0.42, 0.98] });
  part(B, box(0.9, 0.16, 0.05), PINK, { p: [0, 0.5, 1.25], r: [-0.2, 0, 0] });
  part(B, star(0.08, 8, 0.5), YEL, { p: [0, 0.53, 1.285], r: [-0.2, 0, 0] });
  for (const sx of [1, -1]) part(B, tube([[sx * 0.72, 0.5, 0.0], [sx * 0.72, 0.74, 0.14], [sx * 0.72, 0.8, 0.42], [sx * 0.72, 0.74, 0.7], [sx * 0.72, 0.52, 0.86]], 0.1, 8), TEAL);

  // the seat box: pink flanks painted with a flower
  part(B, roundedBox(1.18, 0.46, 0.8, 0.1, 1), PINK, { p: [0, 0.72, 0.3] }, grad(0.5, 0.92, 0.78));
  part(B, roundedBox(1.04, 0.15, 0.62, 0.06, 1), '#d92f2a', { p: [0, 1.02, 0.4] });
  part(B, roundedBox(1.04, 0.42, 0.13, 0.05, 1), '#d92f2a', { p: [0, 1.24, 0.06], r: [-0.14, 0, 0] });
  for (const sx of [1, -1]) {
    part(B, star(0.17, 8, 0.52), YEL, { p: [sx * 0.595, 0.74, 0.3], r: [0, sx * Math.PI / 2, 0] });
    part(B, x.disc(0.07, 7), TEAL, { p: [sx * 0.6, 0.74, 0.3], r: [0, sx * Math.PI / 2, 0] });
  }

  // the hood: half a dome open to the front, painted in rings, with ribs. Inside and outside, since you see both.
  const hc = [0, 1.02, 0.28], hr = 0.66, bands = [[TEAL, 0, 0.3], [YEL, 0.3, 0.42], [PINK, 0.42, 0.72], [YEL, 0.72, 0.84], [TEAL, 0.84, 1]];
  const P = (t) => { const a = t * Math.PI / 2; return [Math.cos(a) * hr, Math.sin(a) * hr * 1.06]; };
  const hood = bone('hood', B, hc);
  bands.forEach(([c, t0, t1]) => {
    const pts = [t0, (t0 + t1) / 2, t1].map(P);
    if (t1 === 1) pts[2][0] = 0;
    const g = trim(lathe(pts, 14));
    part(hood, g, c, { p: hc, r: [-Math.PI / 2, 0, 0], s: [0.98, 1, 1] }, (_x, y) => (y < hc[1] - 0.02 ? 1 : 1));
  });
  // the same shell, inside: dark cloth
  const inner = trim(lathe([P(0), P(0.5), [0, hr * 1.06]].map(([a, b]) => [a * 0.95, b * 0.95]).reverse(), 12));
  part(hood, inner, '#5a2a56', { p: hc, r: [-Math.PI / 2, 0, 0], s: [0.98, 1, 1] });
  // ribs of the fold
  part(hood, torus(hr + 0.008, 0.024, 3, 13, Math.PI), DARK, { p: [0, hc[1], hc[2] + 0.0], s: [1, 1.06, 1] });
  // a skirt closing the bottom of the half dome is the seat box; pennants on top
  const pen = bone('pennant', hood, [0, hc[1] + hr * 1.06, hc[2] - 0.34]);
  part(hood, tube([[0, hc[1] + hr * 0.96, hc[2] - 0.34], [0, hc[1] + hr * 1.5, hc[2] - 0.4]], 0.014, 3), STEEL);
  part(pen, x.twoSided(poly([[0, 0], [0, -0.2], [-0.32, -0.1]]).rotateY(Math.PI / 2), 0.01), PINK, { p: [0, hc[1] + hr * 1.5, hc[2] - 0.4] });

  // the frame: steel tubes back to the rear wheel, the fork, the saddle
  part(B, tube([[0.34, 0.66, -0.08], [0.1, 0.72, -0.72], [0.06, rR + 0.02, -1.14]], 0.04, 5), STEEL);
  part(B, tube([[-0.34, 0.66, -0.08], [-0.1, 0.72, -0.72], [-0.06, rR + 0.02, -1.14]], 0.04, 5), STEEL);
  part(B, tube([[0, 0.5, -0.46], [0, 1.14, -0.94]], 0.05, 5), PINK);
  part(B, tube([[0, 1.14, -0.94], [0.05, rR, -1.18]], 0.035, 5), STEEL);
  part(B, tube([[0, 0.78, -0.86], [0, 0.92, -1.08], [0, 0.88, -1.34], [0, 0.66, -1.56], [0, 0.42, -1.64]], 0.12, 8), PINK);
    part(B, ball(0.15, [1.05, 0.46, 1.45], 8, 4), '#5a3626', { p: [0, 1.18, -0.92] });

  // the painted medallion on the back of the hood: a volcano and a sun on a round of sky, what you read from behind
  const pz = -0.42, py = 1.3;
  part(B, x.disc(0.36, 16), '#6fc7de', { p: [0, py, pz], r: [0, Math.PI, 0] });
  part(B, shapes.torus(0.36, 0.035, 3, 14), YEL, { p: [0, py, pz + 0.01] });
  part(B, poly([[-0.3, -0.2], [-0.06, 0.13], [0.08, 0.13], [0.3, -0.2]]), '#7a5f70', { p: [0, py, pz - 0.006], r: [0, Math.PI, 0] });
  part(B, poly([[-0.1, 0.05], [-0.05, 0.13], [0.07, 0.13], [0.11, 0.06], [0.03, 0.03], [-0.03, 0.02]]), '#f6f2e6', { p: [0, py, pz - 0.01], r: [0, Math.PI, 0] });
  part(B, x.disc(0.07, 8), YEL, { p: [-0.18, py + 0.17, pz - 0.006], r: [0, Math.PI, 0] });
  part(B, box(0.56, 0.1, 0.012), '#58a24c', { p: [0, py - 0.22, pz - 0.012] });
  part(B, tube([[0, py, pz + 0.02], [0, py, pz + 0.16]], 0.07, 5), '#5a2a56');

  // the handlebar on the back of the panel, and the bell: it swings and rings at everybody
  const hbY = 1.08, hbZ = -0.44;
  part(B, tube([[-0.36, hbY, hbZ - 0.1], [-0.3, hbY, hbZ], [0.3, hbY, hbZ], [0.36, hbY, hbZ - 0.1]], 0.026, 4), STEEL);
  const bell = bone('bell', B, [0.2, hbY + 0.05, hbZ - 0.02]);
  part(bell, trim(lathe([[0.1, hbY + 0.03], [0.09, hbY + 0.07], [0.05, hbY + 0.14], [0, hbY + 0.16]], 9)), '#e9bc3f', { p: [0.2, 0, hbZ - 0.02] });

  // the pedals: the crank goes round with the wheel, Tokek's feet follow it
  const crank = [0, 0.58, -0.6], cR = 0.16;
  part(B, ball(0.08, [0.7, 1, 1], 6, 3), STEEL, { p: crank });
  const feet = [1, -1].map((sx, i) => {
    const hip = [sx * 0.15, 1.2, -0.84];
    const b = bone(`legB${i}`, B, hip);
    const foot = [sx * 0.15, crank[1] + 0.03, crank[2] - 0.02];
    part(b, limb(hip, foot, 0.075, 5, 1), GREEN);
    part(b, ball(0.095, [1, 0.56, 1.4], 6, 3), YEL, { p: [foot[0], foot[1] - 0.03, foot[2] + 0.05] });
    b.userData.ph = i * Math.PI;
    b.userData.len = Math.hypot(hip[1] - foot[1], hip[2] - foot[2]);
    return b;
  });

  // Tokek the gecko: bright green, orange spots, huge eyes high on a wide head, a tail with a curl
  const tail = bone('tail', B, [0, 1.16, -1.0]);
  part(tail, tube([[0, 1.16, -1.0], [0, 1.12, -1.28], [0.06, 1.28, -1.56], [0.2, 1.5, -1.58], [0.18, 1.62, -1.38], [0.04, 1.56, -1.3]], [0.095, 0.08, 0.07, 0.055, 0.04, 0.02], 5), GREEN_D);
  const d = chibi(r, {
    at: [0, 1.2, -0.92], size: 0.9, fur: GREEN, belly: '#e4f2a8', muzzleColor: '#a7e070', inner: GREEN_D, cheeks: '#f6b04a',
    head: { r: 0.42, s: [1.2, 0.84, 1] }, torso: { r: 0.22, h: 0.08 },
    eyes: { r: 0.17, gap: 0.24, y: 0.1, iris: '#1d1a22', pupil: 0.72 }, muzzle: { r: 0.18, s: [1.5, 0.5, 0.8], y: -0.14 },
    ears: { kind: 'dot', r: 0.035, side: 0.96, up: 0.15 },
    arms: { r: 0.06, grip: [[0.3, hbY, hbZ], [-0.3, hbY, hbZ]], hand: YEL },
    extra: ({ head, torso, center: c, hr, at, tr }) => {
      // orange spots
      for (const [sx, ay, az, s] of [[0.14, 0.86, -0.12, 0.05], [-0.2, 0.74, -0.34, 0.06], [0.28, 0.62, -0.5, 0.045], [-0.05, 0.82, -0.52, 0.055]]) part(head, ball(s, [1, 0.5, 1], 5, 3), ORANGE, { p: [c[0] + sx, c[1] + ay * hr * 0.84, c[2] + az * hr] });
      for (const [sx, ay] of [[0.14, 0.72], [-0.12, 0.34]]) part(torso, ball(0.04, [1, 1, 0.5], 5, 3), ORANGE, { p: [at[0] + sx, at[1] + ay * tr * 2, at[2] - tr * 0.88] });
      // round sticky toes: three on each hand
    },
  });
  const bellS = spring(16, 0.08);
  let ring = 0;
  return r.finish({
    driver: d,
    update(m, k, dt) {
      if (dt > 0) { ring -= dt; if (ring <= 0) { ring = 2.5 + Math.random() * 3; bellS.v += 7; } }
      bell.rotation.z = bellS.step(m.lat * 0.1 + m.vert * 0.5, m.dt || 1 / 60);
      // the wheel drives the crank, and the crank the knees: they push in turn
      const a = m.dist * 1.9 + m.t * 0.7 * (m.speed < 1 ? 0 : 1);
      feet.forEach((b) => {
        b.rotation.x = Math.sin(a + b.userData.ph) * 0.26 * Math.min(1, m.sn * 3 + 0.1);
        b.scale.y = 1 + Math.cos(a + b.userData.ph) * 0.14 * Math.min(1, m.sn * 3 + 0.1);
      });
      d.torso.position.x = Math.sin(a) * 0.015 * Math.min(1, m.sn * 3);
      hood.rotation.x = Math.sin(m.dist * 0.9) * 0.012 * m.sn - Math.max(0, m.vert) * 0.04;
      pen.rotation.y = swing(m, 14, 0.6) - m.lat * 0.2;
    },
  });
}
