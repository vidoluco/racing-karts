// Gatto delle Nevi: a chubby red piste groomer. Rubber tracks whose lugs really run, a blade with snow on it that dips and lifts,
// the tiller and the corduroy comb at the back, an orange beacon. Toni the chamois drives in the open glasshouse of a cab.
import { createRig, swing } from './_kit.js';
import { chibi } from '../chibi.js';

const RED = '#d8362e', RED_D = '#a8261f', CREAM = '#f4f1e8', TRACK = '#2b2931', STEEL = '#8d8f99', SNOW = '#f8fbff';

export function build(ctx) {
  const r = createRig(ctx), { part, bone, wheel, x, shapes, grad } = r, { roundedBox, box, tube, capsule } = shapes, { ball, wheelGeo, limb, extrude, star, dome } = x;
  const B = 'body', tx = 0.8, tw = 0.5, tr = 0.36, tz = 0.74, ty = tr;

  // the tracks: a stadium in rubber, sprockets with a bright hub at each end
  const stadium = [];
  for (let i = 0; i < 8; i++) { const a = (i / 7) * Math.PI; stadium.push([tz + Math.sin(a) * tr, ty + Math.cos(a) * tr]); }
  for (let i = 0; i < 8; i++) { const a = (i / 7) * Math.PI; stadium.push([-tz - Math.sin(a) * tr, ty - Math.cos(a) * tr]); }
  const belts = [];
  for (const sx of [1, -1]) {
    part('root', extrude(stadium, tw), TRACK, { p: [sx * tx, 0, 0] });
    const lugs = bone(sx > 0 ? 'lugL' : 'lugR', 'root', [sx * tx, ty + tr, 0]);
    for (let i = 0; i < 5; i++) part(lugs, box(tw + 0.06, 0.07, 0.13), '#413e47', { p: [sx * tx, ty + tr + 0.015, -tz + 0.06 + i * 0.3] });
    belts.push(lugs);
    for (const [zz, front] of [[tz, 'F'], [-tz, 'B']]) {
      const geo = wheelGeo(0.25, tw + 0.08, { tyre: '#3a3840', rim: '#f2c531', hub: RED, seg: 9, side: sx, rimAt: 0.78, hubAt: 0.3 });
      wheel(`w${front}${sx > 0 ? 'L' : 'R'}`, [sx * tx, ty, zz], { geo });
    }
  }

  // the hull: fat and red, a cream band round the waist, a snowflake on the door
  part(B, roundedBox(1.22, 0.56, 1.74, 0.24, 2), RED, { p: [0, 0.8, 0] }, grad(0.5, 1.0, 0.72));
  part(B, box(1.24, 0.09, 1.3), CREAM, { p: [0, 0.76, 0.02] });
  for (const sx of [1, -1]) part(B, star(0.13, 6, 0.42), CREAM, { p: [sx * 0.615, 0.93, -0.12], r: [0, sx * Math.PI / 2, 0] });
  // the bonnet slopes down to the blade
  part(B, roundedBox(1.08, 0.3, 0.7, 0.14, 1), RED, { p: [0, 1.04, 0.56], r: [0.18, 0, 0] });
  for (const sx of [1, -1]) {
    part(B, dome(0.11, 10, 2, 0.5), '#fff6c8', { p: [sx * 0.36, 1.08, 0.89] });
  }

  // the cab: an open glasshouse, four thin posts and a fat roof, so Toni can be seen from anywhere
  const c0 = 1.06, c1 = 2.02, cz0 = -0.72, cz1 = 0.34, chw = 0.55;
  for (const [sx, zz] of [[1, cz1], [-1, cz1], [1, cz0], [-1, cz0]]) part(B, tube([[sx * chw, c0, zz], [sx * (chw - 0.05), c1, zz - (zz > 0 ? 0.12 : -0.03)]], 0.04, 4), '#2b2931');
  part(B, roundedBox(1.26, 0.17, 1.2, 0.08, 1), RED, { p: [0, c1 + 0.03, (cz0 + cz1) / 2 - 0.03] });
  part(B, box(0.96, 0.03, 0.86), CREAM, { p: [0, c1 + 0.115, (cz0 + cz1) / 2 - 0.03] });
  // the beacon that turns
  part(B, roundedBox(0.2, 0.05, 0.2, 0.02, 1), '#2b2931', { p: [0, c1 + 0.17, -0.42] });
  const beacon = bone('beacon', B, [0, c1 + 0.2, -0.42]);
  part(beacon, ball(0.12, [1, 1.1, 1], 8, 5), '#ff9c1c', { p: [0, c1 + 0.27, -0.42] });
  part(beacon, shapes.box(0.05, 0.13, 0.25), [1.8, 1.25, 0.5], { p: [0, c1 + 0.27, -0.42] });
  // the seat
  part(B, box(0.66, 0.42, 0.1), '#3a3840', { p: [0, 1.22, -0.55] });
  // steering wheel
  part(B, limb([0, 1.06, 0.44], [0, 1.24, 0.3], 0.03, 4, 1), '#2b2931');
  const sw = bone('steer', B, [0, 1.26, 0.28]);
  part(sw, shapes.torus(0.15, 0.03, 3, 8), '#2b2931', { p: [0, 1.26, 0.28], r: [Math.PI / 2 - 0.7, 0, 0] });

  // the blade: wide, curved, cream with a red stripe, carrying its heap of snow
  const blade = bone('blade', B, [0, 0.72, 0.84]);
  const arc = [];
  for (let i = 0; i <= 5; i++) { const a = (i / 5 - 0.5) * 1.9; arc.push([1.0 + Math.pow(Math.abs(a), 2) * 0.13, 0.08 + (i / 5) * 0.62]); }
  for (let i = 5; i >= 0; i--) arc.push([arc[i][0] - 0.05, arc[i][1]]);
  part(blade, extrude(arc, 2.16), CREAM, null);
  part(blade, box(2.18, 0.1, 0.05), RED, { p: [0, 0.6, 1.14], r: [-0.45, 0, 0] });
  for (const sx of [1, -1]) part(blade, limb([sx * 0.5, 0.56, 0.74], [sx * 0.5, 0.42, 0.97], 0.05, 5, 1), STEEL);
  for (const [sx, zz, ss] of [[0.58, 1.3, 0.2], [-0.54, 1.3, 0.18], [0.02, 1.32, 0.26]]) part(blade, ball(ss, [1.5, 0.9, 0.9], 6, 4), SNOW, { p: [sx, 0.22, zz] });

  // the tiller: a toothed drum under a red cowl, trailing the comb that leaves corduroy on the piste
  part(B, tube([[0.36, 0.72, -0.84], [0.36, 0.56, -1.12]], 0.05, 5), STEEL);
  part(B, tube([[-0.36, 0.72, -0.84], [-0.36, 0.56, -1.12]], 0.05, 5), STEEL);
  const tiller = bone('wTiller', 'root', [0, 0.26, -1.28]);
  tiller.rotation.order = 'YXZ'; r.wheels.push(tiller);
  part(tiller, shapes.cylinder(0.18, 0.18, 1.64, 8), STEEL, { p: [0, 0.26, -1.28], r: [0, 0, Math.PI / 2] });
  for (let i = 0; i < 3; i++) part(tiller, box(1.62, 0.5, 0.06), '#5c5e68', { p: [0, 0.26, -1.28], r: [(i / 3) * Math.PI, 0, 0] });
  part(B, extrude([[-1.04, 0.28], [-1.05, 0.5], [-1.16, 0.62], [-1.34, 0.66], [-1.5, 0.56], [-1.55, 0.3], [-1.47, 0.3], [-1.42, 0.5], [-1.3, 0.56], [-1.18, 0.52], [-1.12, 0.3]].reverse(), 1.72), RED, null, grad(0.3, 0.66, 0.78));
  part(B, box(1.74, 0.05, 0.05), CREAM, { p: [0, 0.6, -1.45], r: [0.7, 0, 0] });
  const comb = bone('comb', B, [0, 0.3, -1.52]);
  part(comb, box(1.66, 0.05, 0.26), '#3f3d46', { p: [0, 0.16, -1.64], r: [0.5, 0, 0] });
  for (let i = 0; i < 4; i++) part(comb, box(0.16, 0.07, 0.28), '#55525c', { p: [-0.6 + i * 0.4, 0.18, -1.64], r: [0.5, 0, 0] });

  // Toni the chamois: tan, a pale face with the dark bandit stripes through the eyes, little black hooks for horns
  const d = chibi(r, {
    at: [0, 0.98, -0.2], size: 0.92, panTop: 2.3, fur: '#b08552', belly: '#ecdcbc', muzzleColor: '#f2e7cf', nose: '#2b2224', inner: '#f0d9c0',
    head: { r: 0.4, s: [1.0, 1.0, 1] }, torso: { r: 0.24, h: 0.08 },
    eyes: { r: 0.13, gap: 0.18, y: 0.04 }, muzzle: { r: 0.17, s: [1.1, 0.86, 0.9], y: -0.17 },
    ears: { kind: 'leaf', len: 0.3, w: 0.075, side: 0.82, up: 0.5, out: 1.05 },
    arms: { r: 0.07, grip: [[0.13, 1.28, 0.32], [-0.13, 1.28, 0.32]], hand: '#3a2c26' },
    extra: ({ head, center: c, hr, onHead }) => {
      // the face pale, the stripe dark: a chamois at a glance
      for (const sx of [1, -1]) {
        const a = onHead(sx * 0.17, hr * 0.5, -0.03), b = onHead(sx * 0.18, -hr * 0.28, -0.03);
        part(head, tube([a, [(a[0] + b[0]) / 2 + sx * 0.03, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2 + 0.005], b], [0.04, 0.075, 0.04], 5), '#3f2f28');
        // the hooks grow straight up and bend back at the tip
        const hx = sx * 0.13, by = c[1] + hr * 0.82;
        part(head, tube([[c[0] + hx, by, c[2] + 0.06], [c[0] + hx * 1.1, by + 0.13, c[2] + 0.05], [c[0] + hx * 1.15, by + 0.24, c[2] - 0.02], [c[0] + hx * 1.15, by + 0.23, c[2] - 0.13]], [0.055, 0.05, 0.04, 0.016], 5), '#26222a');
      }
    },
  });

  return r.finish({
    driver: d,
    update(m) {
      sw.rotation.y = -m.steer * 0.6;
      beacon.rotation.y = m.t * 7;
      for (const b of belts) b.position.z = b.userData.rest.z + ((m.dist * 1.1) % 0.3);
      // the blade dips with the bumps and lifts in the air
      blade.position.y = blade.userData.rest.y + m.air * 0.14 + Math.sin(m.dist * 1.3) * 0.012 * m.sn;
      blade.rotation.x = -m.air * 0.2 + m.vert * 0.05;
      comb.rotation.x = swing(m, 22, 0.05) + m.air * 0.4;
    },
  });
}
