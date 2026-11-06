// Seggiovia: a two-seat chairlift chair bolted on a go-kart frame. The big bullwheel turns behind with its cable, the hanger arm
// and the grip rise over the seat, the safety bar is down (almost always). Nane the ibex rides with his skis on and his great
// ridged horns, a rucksack on the free seat.
import { createRig, swing, spring } from './_kit.js';
import { chibi } from '../chibi.js';

const BLUE = '#3f8fd0', BLUE_D = '#2a659c', YEL = '#f2c531', STEEL = '#aeb4bf', DARK = '#2b2931';

export function build(ctx) {
  const r = createRig(ctx), { part, bone, wheel, x, shapes, grad } = r, { roundedBox, box, tube, capsule, torus } = shapes, { ball, wheelGeo, limb, star } = x;
  const wR = 0.31, opts = { tyre: DARK, rim: YEL, hub: BLUE_D };
  wheel('wFL', [0.72, wR, 0.82], { front: true, geo: wheelGeo(wR, 0.3, { ...opts, side: 1 }) });
  wheel('wFR', [-0.72, wR, 0.82], { front: true, geo: wheelGeo(wR, 0.3, { ...opts, side: -1 }) });
  wheel('wBL', [0.76, wR + 0.04, -0.72], { geo: wheelGeo(wR + 0.04, 0.38, { ...opts, side: 1 }) });
  wheel('wBR', [-0.76, wR + 0.04, -0.72], { geo: wheelGeo(wR + 0.04, 0.38, { ...opts, side: -1 }) });

  // the kart frame: low and blue, a nose fairing, a number plate
  const B = 'body';
  part(B, roundedBox(1.12, 0.2, 2.12, 0.09, 1), BLUE, { p: [0, 0.34, 0] }, grad(0.22, 0.44, 0.76));
  part(B, roundedBox(0.8, 0.26, 0.66, 0.12, 1), YEL, { p: [0, 0.46, 0.76], r: [0.12, 0, 0] });
  part(B, star(0.15, 5, 0.46), '#f6f2e6', { p: [0, 0.52, 1.1], r: [-0.1, 0, 0] });
  // the tower: thick yellow post up from the frame, the bearing of the wheel on top
  part(B, tube([[0.26, 0.42, -0.78], [0.14, 0.92, -1.04]], 0.06, 5), YEL);
  part(B, tube([[-0.26, 0.42, -0.78], [-0.14, 0.92, -1.04]], 0.06, 5), YEL);

  // the bullwheel: huge, tipped towards whoever follows, the spokes let you see the ibex through it
  const tilt = 0.5, bc = [0, 1.03, -1.12];
  const bull = bone('bull', B, bc);
  bull.rotation.order = 'XYZ';
  const R = 0.68, ring = (g, c) => part(bull, g, c, { p: bc, r: [-tilt, 0, 0] });
  ring(torus(R, 0.085, 4, 20), YEL);
  for (let i = 0; i < 3; i++) ring(shapes.box(R * 2, 0.07, 0.05).rotateZ((i / 3) * Math.PI), i ? YEL : '#e0a818');
  ring(shapes.cylinder(0.14, 0.17, 0.12, 10).rotateX(Math.PI / 2), BLUE_D);
  // the cable leaves the wheel for the grip over the chair: it does not turn
  const grip = [-0.14, 2.42, 0.02];
  part(B, tube([[0.34, 1.6, -0.98], [-0.09, 2.42, 0]], 0.016, 3), DARK);
  part(B, tube([[-0.46, 1.58, -1.0], [-0.19, 2.42, 0]], 0.016, 3), DARK);

  // the chair: it hangs from the arm, so it swings a little against the frame
  const chair = bone('chair', B, grip);
  part(chair, roundedBox(0.2, 0.16, 0.34, 0.05, 1), YEL, { p: grip });
  part(chair, ball(0.05, [1, 1, 1], 5, 3), DARK, { p: [0, grip[1] + 0.09, grip[2]] });
  part(chair, tube([[-0.14, 2.38, 0], [-0.14, 2.26, -0.34], [-0.14, 1.95, -0.54], [-0.14, 1.4, -0.56], [-0.14, 1.1, -0.5]], 0.055, 6), STEEL);
  const sy = 0.88;
  part(chair, roundedBox(1.42, 0.16, 0.62, 0.07, 1), BLUE, { p: [0, sy, -0.08] }, grad(sy - 0.1, sy + 0.1, 0.72));
  part(chair, box(1.42, 0.05, 0.08), YEL, { p: [0, sy + 0.03, 0.26] });
  part(chair, roundedBox(1.42, 0.62, 0.13, 0.06, 1), BLUE, { p: [0, sy + 0.37, -0.42], r: [-0.12, 0, 0] }, grad(sy, sy + 0.5, 0.82));
  // the ribs of the backrest face the chasing driver
  for (let i = 0; i < 3; i++) part(chair, box(1.3, 0.05, 0.03), YEL, { p: [0, sy + 0.17 + i * 0.19, -0.5 + i * 0.024], r: [-0.12, 0, 0] });
  for (const sx of [1, -1]) part(chair, tube([[sx * 0.72, sy, -0.3], [sx * 0.74, sy + 0.42, -0.26], [sx * 0.74, sy + 0.44, 0.08]], 0.03, 4), STEEL);
  // pillars from the frame up to the seat, so the toy holds together
  for (const sx of [1, -1]) part(B, limb([sx * 0.5, 0.42, -0.1], [sx * 0.5, 0.82, -0.1], 0.05, 5, 1), STEEL);

  // the safety bar: hinged at the top of the arm rests, it comes down in front of the lap
  const hinge = [0, sy + 0.72, -0.34];
  const bar = bone('bar', chair, hinge);
  part(bar, tube([[0.74, sy + 0.72, -0.34], [0.74, sy + 0.62, 0.22], [0.5, sy + 0.42, 0.42], [-0.5, sy + 0.42, 0.42], [-0.74, sy + 0.62, 0.22], [-0.74, sy + 0.72, -0.34]], 0.032, 4), YEL);

  // Nane's skis dangle in front and swing
  const skis = bone('skis', chair, [0.34, sy, 0.24]);
  for (const sx of [0.1, -0.12]) {
    const zc = 0.86, h = 0.66, kx = 0.34 + sx * 1.5;
    part(skis, limb([0.34 + sx, sy + 0.04, 0.24], [kx, h + 0.1, 0.56], 0.075, 5, 1), '#a3926f');
    part(skis, box(0.17, 0.15, 0.27), '#d9463d', { p: [kx, h + 0.09, 0.6] });
    part(skis, box(0.15, 0.035, 1.12), '#f2552e', { p: [kx, h, zc], r: [-0.12, 0, 0] });
    part(skis, box(0.15, 0.035, 0.2), '#fbf7ec', { p: [kx, h + 0.17, zc + 0.64], r: [-0.62, 0, 0] });
  }

  // the rucksack rides on the other seat
  part(chair, roundedBox(0.42, 0.46, 0.3, 0.1, 1), '#d9463d', { p: [-0.42, sy + 0.32, -0.18] });
  part(chair, box(0.28, 0.17, 0.08), '#a93029', { p: [-0.42, sy + 0.24, -0.01] });
  part(chair, capsule(0.03, 0.34, 1, 4), '#fbf7ec', { p: [-0.42, sy + 0.6, -0.2], r: [0, 0, Math.PI / 2] });

  // Nane the ibex: grey-brown, a little beard and the horns that are the whole point
  const d = chibi(r, {
    at: [0.36, sy + 0.08, -0.14], parent: chair, size: 0.92, fur: '#a3926f', belly: '#e6dcc0', muzzleColor: '#e9e0c8', nose: '#2b2224', inner: '#dcb8a0',
    head: { r: 0.39, s: [1.0, 1.0, 1] }, torso: { r: 0.24, h: 0.1 },
    eyes: { r: 0.13, gap: 0.18, y: 0.03 }, muzzle: { r: 0.17, s: [1.08, 0.82, 0.9], y: -0.16 },
    ears: { kind: 'droop', len: 0.24, w: 0.08, side: 0.84, up: 0.34, drop: 0.3 },
    arms: { r: 0.07, grip: [[0.54, sy + 0.5, 0.42], [0.18, sy + 0.5, 0.42]], hand: '#5e5240' },
    extra: ({ head, center: c, hr }) => {
      for (const sx of [1, -1]) {
        const hx = c[0] + sx * 0.14, y0 = c[1] + hr * 0.66, z0 = c[2] + 0.1;
        // sweeping back in one arc, the knots of a real ibex as a wave in the radius
        part(head, tube([[hx, y0, z0 + 0.04], [hx + sx * 0.05, y0 + 0.2, z0 + 0.0], [hx + sx * 0.1, y0 + 0.32, z0 - 0.2], [hx + sx * 0.14, y0 + 0.34, z0 - 0.42], [hx + sx * 0.17, y0 + 0.22, z0 - 0.6], [hx + sx * 0.18, y0 + 0.04, z0 - 0.68]], [0.1, 0.11, 0.095, 0.08, 0.06, 0.024], 6), '#6b5a48', null, (_x, y, z) => (Math.abs(Math.sin((y + z) * 22)) > 0.5 ? 1 : 0.76));
      }
      // the beard
      part(head, ball(0.06, [0.8, 1.4, 0.8], 6, 4), '#6a5a48', { p: [c[0], c[1] - hr * 0.98, c[2] + hr * 0.62] });
    },
  });

  const swingS = spring(5, 0.22);
  return r.finish({
    driver: d,
    update(m) {
      bull.rotation.set(0, 0, 0);
      bull.rotateOnAxis(AX, m.dist * 1.1);
      const a = swingS.step(m.lat * 0.12 + m.hit * Math.sin(m.t * 19) * 0.08, m.dt || 1 / 60);
      chair.rotation.z = a;
      chair.rotation.x = -m.fwd * 0.06;
      skis.rotation.x = -m.fwd * 0.4 + swing(m, 8, 0.12) + m.air * 0.5;
      skis.rotation.z = a * 1.4;
      // nearly always down: it flies up on a hit and for a cheer
      bar.rotation.x = -Math.max(m.hit, m.cheer) * 1.1 + Math.sin(m.t * 17) * 0.02 * m.sn;
    },
  });
}
const AX = { x: 0, y: Math.sin(0.5), z: Math.cos(0.5), isVector3: true };
