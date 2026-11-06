// La Cuccia: a wooden kennel on wheels with Baileys sitting up through its roof. White cat, brown tabby cap with a white blaze, big pink
// ears, olive eyes, a tabby saddle with dark bars, pink pads: his own coat, from his photo. From behind: the gable with its arched door, a
// striped tail coming out of it in a question mark, the yellow sign that warns about the cat and the back of his head between the ears.
// Very affectionate, and he bites: when a kart stays too close his ears go flat, then he snaps round at it (`biteWind`, `sense.biteT`).
import { createRig, swing } from './_kit.js';
import { chibi } from '../chibi.js';
import { clamp, lerp, follow } from '../math.js';

const WHITE = '#fbf7ef', TABBY = '#a57a4c', TABBY_L = '#c2966a', BAR = '#4f3a2b', PINK = '#f49aa6', PINK_D = '#e87688', EYE = '#83923c';
const WALL = '#3fa7a0', WALL_D = '#2f8b86', TRIM = '#f4ead4', ROOF = ['#e8505b', '#d8434f', '#ee6068', '#cf3c49'], WOOD = '#b77c44';

export function build(ctx) {
  const r = createRig(ctx), { part, bone, wheel, x, shapes, grad } = r, { roundedBox, box, tube, capsule, torus, cone, cylinder } = shapes, { ball, wheelGeo, limb, poly, tiles, dome, disc } = x;

  // chubby wheels, pink hubs like his pads
  const wR = 0.4, wW = 0.36, opts = { tyre: '#35303a', rim: TRIM, hub: PINK_D, seg: 10 };
  wheel('wFL', [0.82, 0.36, 0.86], { front: true, geo: wheelGeo(0.36, 0.32, { ...opts, side: 1 }) });
  wheel('wFR', [-0.82, 0.36, 0.86], { front: true, geo: wheelGeo(0.36, 0.32, { ...opts, side: -1 }) });
  wheel('wBL', [0.86, wR, -0.74], { geo: wheelGeo(wR, wW, { ...opts, side: 1 }) });
  wheel('wBR', [-0.86, wR, -0.74], { geo: wheelGeo(wR, wW, { ...opts, side: -1 }) });

  // the floor and the front deck, where the bowl rides
  const B = 'body', hw = 0.68, z0 = -1.08, z1 = 0.34, eave = 1.04, ridge = 1.5, zm = (z0 + z1) / 2, zl = z1 - z0;
  part(B, box(1.44, 0.14, 2.44), WOOD, { p: [0, 0.44, 0.0] }, grad(0.36, 0.52, 0.72));

  // the kennel: plank walls, a darker line every plank, pale corner boards
  part(B, box(hw * 2, eave - 0.5, zl), WALL, { p: [0, (eave + 0.5) / 2, zm] }, grad(0.5, 1, 0.78));
  for (const sx of [1, -1]) {
    for (let i = 1; i < 3; i++) part(B, box(0.02, 0.022, zl - 0.04), WALL_D, { p: [sx * (hw + 0.004), 0.5 + i * 0.18, zm] });
    for (const zz of [z0, z1]) part(B, box(0.1, eave - 0.5, 0.1), TRIM, { p: [sx * (hw - 0.02), (eave + 0.5) / 2, zz] });
    // a paw print on each flank
    const fp = [sx * (hw + 0.012), 0.76, zm];
    part(B, disc(0.1, 7), PINK, { p: fp, r: [0, sx * Math.PI / 2, 0], s: [1, 0.86, 1] });
    for (const [dz, dy] of [[-0.11, 0.08], [-0.04, 0.14], [0.04, 0.14], [0.11, 0.08]]) part(B, disc(0.038, 6), PINK, { p: [fp[0], fp[1] + dy, fp[2] + dz], r: [0, sx * Math.PI / 2, 0] });
  }

  // the gable at the back, what a chaser looks at: the triangle, the arch with the dark inside, a pale frame
  const gz = z0 - 0.005, back = { r: [0, Math.PI, 0] };
  part(B, poly([[-hw - 0.02, 0], [0, ridge - eave], [hw + 0.02, 0]]), WALL, { p: [0, eave, gz], ...back });
  part(B, poly([[-hw - 0.02, 0], [0, ridge - eave], [hw + 0.02, 0]]), WALL, { p: [0, eave, z1 + 0.004] });
  const arch = (R, top, n = 9) => { const o = [[-R, 0.5]]; for (let i = 0; i <= n; i++) { const a = Math.PI - (i / n) * Math.PI; o.push([Math.cos(a) * R, top + Math.sin(a) * R]); } o.push([R, 0.5]); return o; };
  part(B, poly(arch(0.4, 0.8)), TRIM, { p: [0, 0, gz - 0.012], ...back });
  part(B, poly(arch(0.32, 0.78)), '#2a2230', { p: [0, 0, gz - 0.022], ...back });
  // the cushion just inside the door
  part(B, ball(0.27, [1.1, 0.34, 0.5], 7, 3), '#f6c94a', { p: [0, 0.56, gz - 0.03] });

  // the yellow diamond that warns about the cat, on the gable over the door
  const sign = bone('sign', B, [0, 1.3, gz - 0.03]);
  part(sign, poly([[0, 0.19], [0.19, 0], [0, -0.19], [-0.19, 0]]), '#2a2230', { p: [0, 1.28, gz - 0.026], ...back });
  part(sign, poly([[0, 0.155], [0.155, 0], [0, -0.155], [-0.155, 0]]), '#ffd23e', { p: [0, 1.28, gz - 0.032], ...back });
  part(sign, disc(0.062, 7), '#2a2230', { p: [0, 1.262, gz - 0.038], ...back });
  // his two ears on the sign's round head; a fan wants its points clockwise, and a mirrored ear runs the other way
  for (const sx of [1, -1]) { const ear = [[sx * 0.058, 0.0], [sx * 0.064, 0.075], [sx * 0.012, 0.03]]; part(sign, poly(sx > 0 ? ear : ear.reverse()), '#2a2230', { p: [0, 1.28, gz - 0.038], ...back }); }

  // the roof, in red shingles, two slopes that stop either side of the cat
  const roof = bone('roof', B, [0, eave, zm]);
  const ex = hw + 0.17, slope = (ridge - eave) / hw, drop = ex * slope, rz = zl + 0.34;
  for (const sx of [1, -1]) {
    const run = Math.hypot(ex, drop);
    part(roof, box(run, 0.05, rz), '#9d2f3a', { p: [sx * ex / 2, ridge - drop / 2 - 0.02, zm], r: [0, 0, -sx * Math.atan(slope)] });
    const a = sx > 0 ? [0, ridge + 0.012, zm + rz / 2] : [0, ridge + 0.012, zm - rz / 2], u = [sx * ex, -drop, 0], v = sx > 0 ? [0, 0, -rz] : [0, 0, rz];
    part(roof, tiles(a, u, v, 3, 5, ROOF, 0.035), null);
  }
  part(roof, tube([[0, ridge + 0.03, zm - rz / 2], [0, ridge + 0.03, zm + rz / 2]], 0.055, 5), '#9d2f3a');

  // the hole he sits up through, framed in wood
  const sz = -0.2;
  part(B, torus(0.37, 0.07, 3, 10), TRIM, { p: [0, ridge + 0.02, sz], r: [Math.PI / 2, 0, 0], s: [1, 0.86, 1] });

  // the front deck: a bumper log, a steering column, and the fish bowl he never lets out of his sight
  part(B, tube([[-0.72, 0.42, 1.22], [0.72, 0.42, 1.22]], 0.09, 6), TRIM);
  part(B, cylinder(0.22, 0.17, 0.13, 8), '#e8505b', { p: [0, 0.58, 0.9] });
  part(B, ball(0.17, [1, 0.24, 1], 6, 3), '#b5713a', { p: [0, 0.645, 0.9] });
  const col = [0, 1.3, 0.66];
  part(B, limb([0, 0.52, 0.58], col, 0.035, 5, 1), '#35303a');
  const sw = bone('steer', B, col);
  part(sw, torus(0.17, 0.035, 3, 9), '#35303a', { p: col, r: [Math.PI / 2 - 0.6, 0, 0] });
  part(sw, box(0.28, 0.03, 0.03), '#35303a', { p: col, r: [-0.6, 0, 0] });

  // the tail, three bones, out of the arch and up in a question mark beside the door, so it hides neither the door nor his head; ringed
  const T0 = [0.12, 0.62, z0 - 0.06], T1 = [0.5, 0.9, z0 - 0.34], T2 = [0.72, 1.46, z0 - 0.3], T3 = [0.5, 1.82, z0 - 0.14];
  const tail = bone('tail', B, T0), tail2 = bone('tail2', tail, T1), tail3 = bone('tail3', tail2, T2);
  const ring = (b, a, c, rad, n, c0, c1) => {
    for (let i = 0; i < n; i++) {
      const s = i / n, e = (i + 1) / n, p = (t) => [lerp(a[0], c[0], t), lerp(a[1], c[1], t), lerp(a[2], c[2], t)];
      part(b, limb(p(s), p(e), rad, 7, 1), i % 2 ? c1 : c0);
    }
  };
  ring(tail, [T0[0], T0[1], T0[2] + 0.1], T1, 0.1, 2, TABBY, BAR);
  ring(tail2, T1, T2, 0.1, 3, TABBY_L, BAR);
  ring(tail3, T2, T3, 0.095, 2, TABBY_L, BAR);

  // Baileys, sitting up tall so he clears the roof
  const seat = [0, 1.14, sz];
  const d = chibi(r, {
    at: seat, size: 1.08, fur: TABBY, belly: WHITE, muzzleColor: WHITE, nose: '#f28a9b', noseR: 0.052, inner: PINK, brow: '#5a4230',
    head: { r: 0.44, s: [1.14, 0.96, 1] }, torso: { r: 0.27, h: 0.05 },
    eyes: { r: 0.138, gap: 0.2, y: 0.02, iris: EYE, pupil: 0.82, s: [1.04, 1.12, 1] }, muzzle: { r: 0.15, s: [1.2, 0.74, 0.8], y: -0.2, z: -0.015 },
    ears: { kind: 'cat', side: 0.62, up: 0.68 },
    arms: { r: 0.082, color: WHITE, hand: WHITE, grip: [[0.14, col[1] + 0.03, col[2] + 0.03], [-0.14, col[1] + 0.03, col[2] + 0.03]] },
    extra: ({ torso, head, center: c, hr, tr, th, at, ears, H, onHead, size }) => {
      // the white chest and flanks, the tabby saddle over the shoulders
      part(torso, ball(tr * 1.02, [1, 1.06, 0.98], 8, 5), WHITE, { p: [at[0], at[1] + tr + th * 0.2, at[2] + tr * 0.1] });
      part(torso, ball(tr * 1.08, [1.02, 1.0, 0.72], 8, 5), TABBY, { p: [at[0], at[1] + tr * 1.0 + th, at[2] - tr * 0.42] });
      // the dark bars across the back, seen from the chase camera
      for (const [dy, w] of [[0.06, 0.26], [-0.08, 0.3]]) part(torso, capsule(0.028, w, 1, 4), BAR, { p: [at[0], at[1] + tr * 1.2 + th + dy, at[2] - tr * 1.14], r: [0, 0, Math.PI / 2] });

      // the white mask over the brown head: chin, cheeks and muzzle, and the blaze up between the eyes
      const skin = r.get('skin');
      part(skin, ball(hr * 0.86, [H.s[0] * 1.03, H.s[1] * 0.74, H.s[2] * 1.03], 11, 6), WHITE, { p: [c[0], c[1] - hr * 0.36, c[2] + hr * 0.2] });
      const bl = onHead(0, hr * 0.26, -0.03);
      part(skin, ball(hr * 0.16, [0.72, 2.7, 0.62], 6, 4), WHITE, { p: bl, r: [-0.3, 0, 0] });
      // the M on the forehead, the stripes that run back over the head to the neck: the back of his head is all a chaser gets of the face
      for (const [ax, top] of [[-0.14, 0.2], [0.14, 0.2], [-0.29, 0.14], [0.29, 0.14]]) {
        const a = onHead(ax * hr * 1.6, hr * (0.62 + top * 0.3), -0.006);
        part(head, ball(0.024 * size, [1, 3.4, 0.6], 4, 3), BAR, { p: a, r: [-0.7, 0, ax * 1.4] });
      }
      // long tabby stripes over the crown and down to the nape, each bent along the head
      const onBack = (ax, ay) => [c[0] + ax * hr * H.s[0], c[1] + ay * hr * H.s[1], c[2] - Math.sqrt(Math.max(0.03, 1 - ax * ax - ay * ay)) * hr * H.s[2] - 0.006];
      for (const ax of [-0.46, -0.16, 0.16, 0.46]) {
        const top = 0.78 - Math.abs(ax) * 0.5, low = -0.3 + Math.abs(ax) * 0.22;
        const p = [0, 0.5, 1].map((u) => onBack(ax * (1 + (1 - u) * 0.1), lerp(top, low, u)));
        part(head, limb(p[0], p[1], 0.024, 4, 1), BAR);
        part(head, limb(p[1], p[2], 0.024, 4, 1), BAR);
      }
      // whiskers, three a side
      for (const sx of [1, -1]) for (const [dy, tip] of [[0.03, 0.08], [-0.015, 0], [-0.06, -0.07]]) {
        const a = onHead(sx * hr * 0.3, -hr * 0.42 + dy, 0.0);
        part(head, tube([a, [a[0] + sx * 0.3, a[1] + tip, a[2] - 0.06]], 0.007, 3), '#6a5a54');
      }
      // slit pupils on the olive eyes
      for (const name of ['pupilL', 'pupilR']) {
        const pb = r.get(name), at2 = pb.userData.at;
        part(pb, ball(0.05 * size, [0.46, 1.5, 0.3], 5, 4), '#1d1820', { p: [at2[0], at2[1], at2[2] + 0.052] });
      }
      // the fangs he shows on a bite, on the mouth's own bone
      const mouth = r.get('mouth'), ma = mouth.userData.at;
      for (const sx of [1, -1]) part(mouth, cone(0.03, 0.09, 4), '#fffdf4', { p: [ma[0] + sx * 0.05, ma[1] + 0.012, ma[2] + 0.03], r: [Math.PI, 0, 0] });
      // the red collar with its bell: he is somebody's cat
      part(torso, torus(0.2 * size, 0.04, 3, 8), '#e8505b', { p: [at[0], at[1] + tr * 2 + th - 0.02, at[2] + 0.01], r: [Math.PI / 2, 0, 0] });
      part(torso, ball(0.052, [1, 1, 1], 5, 3), '#ffd23e', { p: [at[0], at[1] + tr * 2 + th - 0.07, at[2] + 0.2 * size + 0.03] });
      // tall triangular ears: brown backs with a pale edge, the very pink insides of the photo
      ears.forEach((b, i) => {
        const sx = i === 0 ? 1 : -1, base = b.userData.at, R = 0.2 * size, h = 0.42 * size, tilt = -sx * 0.3, q = [base[0] + sx * 0.03, base[1] + h * 0.34, base[2] - 0.01];
        part(b, cone(R, h, 5), TABBY, { p: q, r: [0, 0, tilt], s: [1, 1, 0.46] });
        part(b, cone(R * 0.72, h * 0.78, 4), PINK, { p: [q[0], q[1] - 0.01, q[2] + 0.052], r: [0, 0, tilt], s: [1, 1, 0.34] });
      });
    },
    pose(m, k, { head, ears }) {
      // the windup: ears flat and a low look; the bite: the head goes round to the side of the victim, mouth wide, and back
      const wind = clamp(m.biteWindS ?? 0, 0, 1), bite = clamp(m.bite ?? 0, 0, 1);
      if (wind > 0.01) ears.forEach((b, i) => { b.rotation.z += (i === 0 ? -1 : 1) * wind * 0.9; b.rotation.x += wind * 0.55; });
      if (bite > 0.01) {
        head.rotation.y += (m.biteSide || 0) * bite * 1.25;
        head.rotation.x -= bite * 0.1;
        head.position.x = head.userData.rest.x + (m.biteSide || 0) * bite * 0.34;
        head.position.z = head.userData.rest.z + bite * 0.1;
        const mouth = r.get('mouth'), s = Math.max(mouth.scale.x, bite * 1.7);
        mouth.scale.set(s, s * 1.15, s);
        r.get('smile').scale.x = Math.max(0.001, 1 - bite * 1.5);
        for (const a of ['armL', 'armR']) if (a === (m.biteSide > 0 ? 'armL' : 'armR')) r.get(a).rotateZ((m.biteSide || 0) * bite * 0.9);
      } else {
        head.position.x = head.userData.rest.x; head.position.z = head.userData.rest.z;
      }
      // a slow satisfied blink when all is quiet at rest: a purring cat
      if (m.sn < 0.05 && !m.cheer && !k.pose) r.get('eyeL').scale.y = r.get('eyeR').scale.y = Math.min(r.get('eyeL').scale.y, 0.55 + 0.45 * Math.abs(Math.sin(m.t * 0.7)));
    },
  });

  const cush = r.get('roof');
  return r.finish({
    driver: d,
    update(m, k) {
      sw.rotation.y = -m.steer * 0.5;
      cush.position.y = cush.userData.rest.y + Math.max(0, -m.vert) * 0.05;
      cush.rotation.z = m.lat * 0.02;
      sign.rotation.z = swing(m, 8, 0.06);
      // the tail: a lazy sway at rest, whips out in a turn, straight up on a cheer or when annoyed
      const dt = m.dt, wind = k.biteWind || 0;
      m.biteWindS = dt > 0 ? lerp(m.biteWindS ?? 0, wind, follow(20, dt)) : wind;
      m.biteT = Math.max(0, (m.biteT || 0) - dt);
      const want = k.pose === 'bite' || m.biteT > 0 ? 1 : 0;
      if (k.pose === 'bite' && !m.biteSide) m.biteSide = 1;
      m.bite = dt > 0 ? lerp(m.bite ?? 0, want, follow(want ? 26 : 7, dt)) : want;
      const sway = Math.sin(m.t * 1.9 + m.seed) * 0.18, whip = -m.lat * 0.5 - m.lean * m.sn * 0.25;
      tail.rotation.z = sway * 0.6 + whip;
      tail2.rotation.z = Math.sin(m.t * 1.9 + m.seed - 0.7) * 0.2 + whip * 0.7;
      tail3.rotation.z = Math.sin(m.t * 1.9 + m.seed - 1.4) * 0.32 + whip * 0.5 + Math.sin(m.t * 9) * 0.25 * (m.cheer + m.bite);
      tail2.rotation.x = -m.air * 0.3 + m.sad * 0.6 + m.boost * 0.35;
      tail3.rotation.x = m.sad * 0.7 + m.boost * 0.45;
    },
  });
}
