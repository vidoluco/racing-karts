// The rounded animal drivers. A spec says what the animal is; the bones and the poses are the same for all of them, so every
// driver leans into turns, looks where it goes, blinks, is thrown about, cheers and sulks in the same language. The face is
// built for a close-up: big glossy eyes low on the head, as on the drop of Summit Descent.
import { clamp, lerp, follow } from './math.js';
import { spring } from './karts/_kit.js';

const HALF_PI = Math.PI / 2;
const FLASH = [1.5, 1.5, 1.5];   // brighter than white on purpose: an eye's highlight stays white in any shade

// spec: { at [x, y, z] the seat under the torso, parent, size, fur, belly, muzzleColor, nose, inner (ear),
//   head: { r, s, up }, torso: { r, h, s }, eyes: { r, gap, y, iris, lid }, muzzle: { r, s, y, z }, ears: { kind, ... },
//   arms: { r, grip: [[x, y, z], [x, y, z]], color, hand }, cheeks, brows, teeth, tongue,
//   extra(ctx) to add horns, a mane or a tail to the head and torso bones }
export function chibi(rig, spec) {
  const { shapes, x, part, bone, THREE } = rig, { sphere, capsule, torus, cone, tube } = shapes, { dome, disc, limb, ball } = x;
  const at = spec.at || [0, 0.5, 0], parent = spec.parent || 'body', size = spec.size || 1;
  const fur = spec.fur, belly = spec.belly || fur, muzzleC = spec.muzzleColor || belly, ink = '#241c26';

  const T = { r: 0.3, h: 0.28, s: [1, 1, 0.92], ...spec.torso };
  const torso = bone('torso', parent, at);
  const tr = T.r * size, th = T.h * size;
  part(torso, capsule(tr, th, 2, 8), fur, { p: [at[0], at[1] + tr + th / 2, at[2]], s: T.s }, rig.grad(at[1], at[1] + tr * 2, 0.7));
  part(torso, ball(tr * 0.8, [0.86, 1.02, 0.6], 6, 4), belly, { p: [at[0], at[1] + tr * 0.95 + th * 0.3, at[2] + tr * 0.42] });

  // head, everything on the face is modelled at its place and moves with its own bone
  const H = { r: 0.42, s: [1.08, 0.96, 1], up: 0, ...spec.head };
  const hr = H.r * size, neck = [at[0], at[1] + tr * 2 + th - 0.03, at[2]], c = [at[0], neck[1] + hr * H.s[1] * 0.86 + H.up, at[2] + 0.02];
  const head = bone('head', torso, neck);
  // the skin of the head and the muzzle has a bone of its own, so a burnt mask can take its place instead of fighting it for the same surface
  const skin = bone('skin', head, c);
  part(skin, sphere(hr, 12, 8), fur, { p: c, s: H.s }, (_x, y) => lerp(0.86, 1.04, clamp((y - c[1] + hr) / (hr * 2), 0, 1)));

  // where a point in the head's own direction lands on the ellipsoid
  const onHead = (ax, ay, z0 = 0) => {
    const nx = ax / (hr * H.s[0]), ny = ay / (hr * H.s[1]), nz = Math.sqrt(Math.max(0.02, 1 - nx * nx - ny * ny));
    return [c[0] + ax, c[1] + ay, c[2] + nz * hr * H.s[2] + z0];
  };

  // eyes
  const E = { r: 0.15, gap: 0.2, y: 0, iris: '#231a22', lid: fur, s: [1, 1.14, 1], pupil: 0.76, ...spec.eyes };
  const er = E.r * size, eyes = [], pupils = [];
  for (const sx of [1, -1]) {
    const p = onHead(sx * E.gap * size, E.y * size, -er * 0.28);
    const tilt = Math.atan2(sx * E.gap * size, hr * H.s[2]) * 0.62;
    const eye = bone(sx > 0 ? 'eyeL' : 'eyeR', head, p);
    part(eye, dome(er * 1.07, 10, 1, 0.5), ink, { p: [p[0], p[1], p[2] - 0.004], r: [0, tilt, 0], s: E.s });
    part(eye, dome(er, 12, 2, 0.74), '#fcfbf6', { p: [p[0], p[1], p[2]], r: [0, tilt, 0], s: E.s });
    const fx = Math.sin(tilt), fz = Math.cos(tilt), front = er * 0.68;
    const pp = [p[0] + fx * front, p[1], p[2] + fz * front];
    const pupil = bone(sx > 0 ? 'pupilL' : 'pupilR', eye, pp);
    const pr = er * E.pupil;
    part(pupil, dome(pr, 10, 1, 0.42), E.iris, { p: pp, r: [0, tilt, 0], s: E.s });
    // highlights on the pupil's upper side, the same side on both eyes as the sun would put them
    part(pupil, disc(pr * 0.4, 8), FLASH, { p: [pp[0] + fx * pr * 0.34 + pr * 0.34, pp[1] + pr * 0.42, pp[2] + fz * pr * 0.34 + 0.01], r: [0, tilt, 0] });
    part(pupil, disc(pr * 0.18, 6), FLASH, { p: [pp[0] + fx * pr * 0.32 - pr * 0.32, pp[1] - pr * 0.36, pp[2] + fz * pr * 0.32 + 0.01], r: [0, tilt, 0] });
    eyes.push(eye); pupils.push(pupil);
  }

  // muzzle, nose, mouth
  const M = { r: 0.2, s: [1.15, 0.78, 0.8], y: -0.15, z: -0.02, ...spec.muzzle };
  const mp = onHead(0, M.y * size, M.z * size), mr = M.r * size;
  part(skin, ball(mr, M.s, 7, 5), muzzleC, { p: mp });
  const nr = (spec.noseR ?? 0.05) * size, ntip = [mp[0], mp[1] + mr * M.s[1] * 0.56, mp[2] + mr * M.s[2] * 0.82];
  if (spec.nose) {
    part(head, ball(nr, [1.3, 0.9, 0.8], 6, 4), spec.nose, { p: ntip });
    part(head, disc(nr * 0.3, 6), [1, 1, 1], { p: [ntip[0] + nr * 0.34, ntip[1] + nr * 0.34, ntip[2] + nr * 0.68] });
  }
  const my = mp[1] - mr * M.s[1] * 0.24, mz = mp[2] + mr * M.s[2] * 0.86;
  const smile = bone('smile', head, [mp[0], my, mz]);
  const sw = mr * 0.62;
  part(smile, tube([[mp[0] - sw, my + sw * 0.28, mz - 0.03], [mp[0] - sw * 0.5, my - sw * 0.1, mz + 0.012], [mp[0], my - sw * 0.2, mz + 0.022], [mp[0] + sw * 0.5, my - sw * 0.1, mz + 0.012], [mp[0] + sw, my + sw * 0.28, mz - 0.03]], 0.012 * Math.max(size, 1), 3), ink);
  const mouth = bone('mouth', head, [mp[0], my - sw * 0.1, mz - 0.01]);
  part(mouth, ball(mr * 0.5, [1, 0.8, 0.5], 5, 3), '#7a2233', { p: [mp[0], my - sw * 0.1, mz - 0.03] });
  part(mouth, dome(mr * 0.3, 5, 1, 0.5), '#ef7f92', { p: [mp[0], my - sw * 0.34, mz - 0.005], s: [1, 0.5, 1] });
  rig.hide(mouth);
  // the tongue that goes round the lips at the smell of a rendang
  const lick = bone('lick', head, [mp[0], my + sw * 0.05, mz + 0.01]);
  part(lick, dome(mr * 0.46, 6, 1, 0.6), '#f0657f', { p: [mp[0], my + sw * 0.05, mz + 0.01], s: [1, 0.72, 1] });
  rig.hide(lick);
  if (spec.teeth) {
    part(head, shapes.box(mr * 0.5, mr * 0.46, 0.03), '#fff6dc', { p: [mp[0], my - sw * 0.46, mz - 0.012] });
    part(head, shapes.box(0.008, mr * 0.42, 0.012), ink, { p: [mp[0], my - sw * 0.46, mz + 0.008] });
  }

  // cheeks: soft and pink; a sip of grappa makes them glow
  const cheekC = spec.cheeks ?? '#f08a8a', cheeks = [];
  if (cheekC) for (const sx of [1, -1]) {
    const px = sx * (E.gap + E.r * 0.72) * size, p = onHead(px, (E.y - E.r * 1.35) * size, -0.008), tilt = Math.atan2(px, hr * H.s[2]) * 0.9;
    const b = bone(sx > 0 ? 'cheekL' : 'cheekR', head, p);
    part(b, dome(er * 0.5, 7, 1, 0.14), cheekC, { p, r: [0, tilt, 0], s: [1.15, 0.72, 1] });
    cheeks.push(b);
  }

  // brows carry most of the mood: a dark stroke each
  const brows = [];
  for (const sx of [1, -1]) {
    const p = onHead(sx * E.gap * size, (E.y + E.r * 1.28) * size, 0.006);
    const b = bone(sx > 0 ? 'browL' : 'browR', head, p);
    part(b, capsule(0.024 * size, er * 0.72, 1, 4), spec.brow || ink, { p, r: [0, Math.atan2(sx * E.gap * size, hr * H.s[2]) * 0.8, HALF_PI] });
    brows.push(b);
  }

  // ears
  const ears = [];
  const earC = spec.earColor || fur, inner = spec.inner || '#e9a8a0';
  const A = spec.ears || { kind: 'round' };
  for (const sx of [1, -1]) {
    const aS = (A.side ?? 0.74) * hr * H.s[0], aY = (A.up ?? 0.72) * hr * H.s[1];
    const base = [c[0] + sx * aS, c[1] + aY, c[2] - 0.02 * size];
    const b = bone(sx > 0 ? 'earL' : 'earR', head, base);
    const o = sx * (A.out ?? 0.28), f = A.fwd ?? 0;
    if (A.kind === 'round') {
      const R = (A.r ?? 0.14) * size, q = [base[0] + sx * R * 0.2, base[1] + R * 0.5, base[2]];
      part(b, ball(R, [1, 1, 0.5], 8, 4), earC, { p: q, r: [0, 0, -o] });
      part(b, dome(R * 0.64, 7, 1, 0.2), inner, { p: [q[0], q[1], q[2] + R * 0.42], r: [0, 0, -o] });
    } else if (A.kind === 'leaf') { // a chamois or a sheep: long and soft
      const L = (A.len ?? 0.3) * size, W = (A.w ?? 0.09) * size;
      const q = [base[0] + Math.sin(o) * L * 0.5, base[1] + Math.cos(o) * L * 0.5, base[2]];
      part(b, ball(W, [1, L / W / 2 + 0.25, 0.6], 7, 3), earC, { p: q, r: [f, 0, -o] });
      part(b, dome(W * 0.64, 7, 1, 0.2), inner, { p: [q[0], q[1], q[2] + W * 0.42], r: [f, 0, -o], s: [1, L / W / 2 + 0.1, 1] });
    } else if (A.kind === 'droop') { // hangs from the side of the head
      const L = (A.len ?? 0.26) * size, W = (A.w ?? 0.11) * size;
      const q = [base[0] + sx * L * 0.46, base[1] - L * 0.22, base[2]];
      part(b, ball(W, [L / W / 2 + 0.2, 0.8, 0.46], 7, 3), earC, { p: q, r: [0, 0, sx * -(A.drop ?? 0.5)] });
      part(b, dome(W * 0.62, 7, 1, 0.2), inner, { p: [q[0], q[1], q[2] + W * 0.38], r: [0, 0, sx * -(A.drop ?? 0.5)], s: [L / W / 2, 0.66, 1] });
    } else if (A.kind === 'bat') { // huge, with a fold
      const R = (A.r ?? 0.27) * size, q = [base[0] + sx * R * 0.34, base[1] + R * 0.78, base[2]];
      part(b, ball(R, [0.84, 1.24, 0.34], 8, 5), earC, { p: q, r: [0, 0, -o] });
      part(b, dome(R * 0.7, 8, 1, 0.2), inner, { p: [q[0], q[1] - R * 0.06, q[2] + R * 0.28], r: [0, 0, -o], s: [0.8, 1.2, 1] });
    } else if (A.kind === 'dot') { // a gecko or a dragon has no outer ear: a little hole
      part(b, ball((A.r ?? 0.05) * size, [1, 1, 0.5], 6, 4), inner, { p: base });
    }
    ears.push(b);
  }

  // arms hold whatever is in spec.arms.grip, in model space
  const R = { r: 0.085, ...spec.arms }, shoulderY = at[1] + tr + th * 0.86, arms = [];
  const armC = R.color || fur, handC = R.hand || armC;
  [1, -1].forEach((sx, i) => {
    const s = [at[0] + sx * tr * 0.88, shoulderY, at[2] + tr * 0.1], g = (R.grip || [[0.16, at[1] + 0.3, at[2] + 0.5], [-0.16, at[1] + 0.3, at[2] + 0.5]])[i];
    const b = bone(sx > 0 ? 'armL' : 'armR', torso, s), rr = R.r * size;
    b.userData.sh = s;
    b.userData.dir = new THREE.Vector3(g[0] - s[0], g[1] - s[1], g[2] - s[2]).normalize();
    part(b, limb(s, g, rr, 6, 1), armC);
    part(b, ball(rr * 1.42, [1, 1, 1], 6, 3), handC, { p: g });
    arms.push(b);
  });

  // the dizzy stars: a ring over the head, only there after a bad moment
  const dizzyAt = [c[0], c[1] + hr * H.s[1] + 0.16, c[2]], dizzy = bone('dizzy', head, dizzyAt);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2, p = [dizzyAt[0] + Math.sin(a) * hr * 0.92, dizzyAt[1] + (i === 1 ? 0.05 : -0.02), dizzyAt[2] + Math.cos(a) * hr * 0.92];
    part(dizzy, x.twoSided(x.star(0.13 * size, 4, 0.42), 0.03), '#ffd84a', { p, r: [0, a, 0] });
  }
  rig.hide(dizzy);
  // the green wisps of a durian
  const wisp = bone('wisp', head, [c[0], c[1] + hr, c[2]]);
  for (let i = 1; i < 3; i++) part(wisp, ball(0.09 + i * 0.03, [1, 1, 1], 5, 3), '#b7d35a', { p: [c[0] + [-0.3, 0.26, 0][i], c[1] + hr + 0.08 + i * 0.1, c[2] + [0.1, -0.1, 0.2][i]] });
  rig.hide(wisp);

  // burnt by a sambal: a black mask over the head and the muzzle that the eyes stay out of, the fur on top standing up singed
  const soot = bone('soot', head, c);
  part(soot, sphere(hr, 10, 5), '#2a2630', { p: c, s: H.s });
  part(soot, ball(mr, M.s, 5, 3), '#3a343c', { p: mp });
  for (const [ax, tilt] of [[-0.42, 0.5], [0, 0], [0.42, -0.5]]) part(soot, cone(0.07 * size, 0.2 * size, 4), '#2a2630', { p: [c[0] + ax * hr, c[1] + hr * H.s[1] * 0.98 - Math.abs(ax) * 0.06, c[2]], r: [0, 0, tilt] });
  rig.hide(soot);

  // the bottle of a sip, grappa or tuica: tipped up at the mouth, foot in the air, the right hand reaching for it
  const bL = 0.42 * Math.max(size, 0.85), sipFoot = [mp[0], my + bL * 0.62, mz + bL * 0.78], bottle = bone('bottle', head, [mp[0], my, mz]);
  part(bottle, x.trim(shapes.lathe([[0, 0], [0.085, 0], [0.09, bL * 0.5], [0.035, bL * 0.72], [0.035, bL]], 5)), '#e8c36a', { p: sipFoot, r: [-2.24, 0, 0] });
  rig.hide(bottle);

  // the iron pan of the uova, balanced on the head and tipped back, so a chasing camera sees the eggs in it
  // a driver under a roof has it on the roof, spec.panTop high
  const panAt = spec.panTop ? [c[0], spec.panTop, c[2] - 0.02] : [c[0], c[1] + hr * H.s[1] * 0.96, c[2] - 0.02], pan = bone('pan', spec.panTop ? parent : head, panAt);
  {
    const P = 0.42 + size * 0.12, tilt = -0.5, tip = { r: [tilt, 0, 0], p: panAt }, ct = Math.cos(tilt), st = Math.sin(tilt);
    part(pan, x.trim(shapes.lathe([[0, 0], [P * 0.9, 0], [P, 0.1], [P * 0.82, 0.08], [0, 0.07]], 9)), '#34313a', tip);
    part(pan, tube([[P * 0.95, 0.07, 0], [P * 1.7, 0.14, 0]], 0.03, 4), '#34313a', tip);
    for (const [ex, ez, er2] of [[-0.3, 0.12, 0.36], [0.28, -0.2, 0.33]]) {
      const lift = 0.09, y = lift * ct - ez * P * st, z = lift * st + ez * P * ct, on = { p: [panAt[0] + ex * P, panAt[1] + y, panAt[2] + z], r: [tilt - HALF_PI, 0, 0] };
      part(pan, disc(P * er2, 7), '#fbf7ec', on);
      part(pan, dome(P * er2 * 0.44, 5, 1, 0.8), '#f6b21c', { p: [on.p[0], on.p[1] + 0.012, on.p[2]], r: on.r });
    }
  }
  rig.hide(pan);

  // folded wings behind the shoulders: a scalloped web, what tells a bat from a mouse
  if (spec.wings) for (const sx of [1, -1]) {
    const y0 = at[1] + tr * 1.5 + th, z0 = at[2] - tr * 0.5, s2 = spec.wings === true ? 0.72 * size : spec.wings;
    const web = [[0, 0.1], [0.3, 0.24], [0.62, 0.3], [0.56, 0], [0.4, -0.14], [0.3, -0.04], [0.16, -0.3], [0.04, -0.22], [-0.02, -0.34]].map(([a, b]) => [a * s2, b * s2]);
    const g = x.twoSided(x.poly(web), 0.012);
    part(torso, g, spec.wingColor || fur, { p: [at[0] + sx * tr * 0.64, y0, z0], r: [0, sx > 0 ? -0.5 : Math.PI + 0.5, 0] });
  }

  const ctxOut = { torso, head, center: c, hr, tr, th, neck, size, at, ears, H, onHead };
  spec.extra?.(ctxOut);

  // ---- poses ----
  const earS = ears.map(() => spring(11, 0.26)), earF = ears.map(() => spring(10, 0.26)), headS = spring(9, 0.4), nod = spring(8, 0.36);
  const tail = rig.bones.get('tail');
  const tailS = spring(7, 0.28), q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), V = new THREE.Vector3(), up = new THREE.Vector3();
  const armW = [0, 0];
  let blinkAt = 1 + Math.random() * 3, blink = 0, glance = 0, glanceAt = 2 + Math.random() * 3, glanceTo = 0;
  const sign = spec.earSign ?? 1;

  function pose(m, k) {
    const { t, dt } = m;
    // blinking, and now and then a look around when not busy
    if (dt > 0) {
      if (t > blinkAt && !k.pose) { blink = 1; blinkAt = t + 1.6 + Math.random() * 3.5; }
      blink = Math.max(0, blink - dt * 8);
      if (t > glanceAt && !k.pose) { glanceTo = (Math.random() - 0.5) * 0.9; glanceAt = t + 2 + Math.random() * 3; }
      glance = lerp(glance, m.sn > 0.2 ? 0 : glanceTo, follow(3, dt));
    }
    const dizzyOn = Math.max(m.hit, m.tipsy * 0.55);

    // torso
    const wobble = Math.sin(t * 6) * 0.1 * m.tipsy + Math.sin(t * 19) * 0.1 * m.hit;
    const breathe = Math.sin(t * 2.2 + m.seed) * 0.012;
    torso.rotation.z = m.lean * (0.16 + 0.14 * m.drift) + m.lat * 0.09 + wobble + Math.sin(t * 7) * 0.08 * m.cheer;
    torso.rotation.x = clamp(-m.fwd * 0.2, -0.3, 0.26) - m.boost * 0.16 + m.sad * 0.2;
    torso.position.y = torso.userData.rest.y - m.vert * 0.03 + breathe + Math.abs(Math.sin(t * 7)) * 0.12 * m.cheer - m.sad * 0.05;
    const sq = 1 + clamp(m.vert * 0.1, -0.12, 0.12) + Math.abs(Math.sin(t * 7)) * 0.04 * m.cheer;
    torso.scale.set(2 - sq, sq, 2 - sq);

    // head looks into the turn, is thrown about by the rest
    const yawWant = -m.lean * (0.42 + 0.18 * m.drift) + glance * (1 - m.sn) * 0.8 + Math.sin(t * 13) * 0.32 * m.hit;
    head.rotation.y = headS.step(yawWant, dt > 0 ? dt : 1 / 60);
    head.rotation.z = m.lean * 0.12 + m.lat * 0.08 + Math.sin(t * 4.3) * 0.13 * m.tipsy + Math.sin(t * 17) * 0.18 * m.hit + Math.sin(t * 7) * 0.09 * m.cheer + Math.sin(t * 2.6) * 0.1 * m.lick;
    head.rotation.x = nod.step(clamp(-m.fwd * 0.14, -0.26, 0.2) + m.sad * 0.16 - m.cheer * 0.14 - m.boost * 0.06 - m.air * 0.12 + Math.sin(t * 3.1) * 0.05 * m.tipsy + m.stink * 0.12 - m.lick * 0.15 - m.sip * 0.34, dt > 0 ? dt : 1 / 60);
    const hs = 1 + m.big * 0.04;
    head.scale.setScalar(hs);

    // eyes: blink, wide on a hit, narrowed in a drift, happy on a cheer
    const open = (1 - blink) * lerp(1, 0.82, m.drift) * lerp(1, 0.9, m.sad) * lerp(1, 0.55, m.stink) * lerp(1, 0.86, m.tipsy) * lerp(1, 1.2, Math.max(m.hit, m.boost * 0.4)) * lerp(1, 0.42, m.lick) * lerp(1, 0.86, m.soot) * lerp(1, 0.62, m.sip);
    for (const e of eyes) { e.scale.y = Math.max(0.06, open); e.scale.x = lerp(1, 1.1, m.hit); }
    const lookX = -m.lean * 0.3 * er, lookY = -m.sad * 0.16 * er + m.cheer * 0.08 * er;
    pupils.forEach((p, i) => {
      const r = p.userData.rest, side = i === 0 ? 1 : -1;
      const dz = Math.max(m.hit, m.tipsy * 0.7);
      const dx = Math.cos(t * 13 + i * 2.4) * 0.26 * er * dz, dy = Math.sin(t * 13 + i * 2.4) * 0.26 * er * dz;
      // cross-eyed after a drink
      p.position.set(r.x + lookX + dx - side * 0.12 * er * m.tipsy, r.y + lookY + dy, r.z);
      const ps = lerp(1, 0.72, m.hit) * lerp(1, 1.12, m.cheer) * lerp(1, 1.1, m.sad);
      p.scale.setScalar(ps);
    });

    // mouth: a smile, opening for joy and for fright
    const openM = clamp(Math.max(m.hit, m.cheer * (0.75 + 0.25 * Math.sin(t * 7)), m.boost * 0.62, m.air * 0.55, m.soot * Math.max(0, Math.sin(t * 5.2)) * 0.5) * (1 - m.sip) * (1 - m.lick * 0.7), 0, 1);
    mouth.scale.set(Math.max(0.001, openM), Math.max(0.001, openM * lerp(1, 1.3, m.hit)), Math.max(0.001, openM));
    smile.scale.set(1, lerp(1, -0.8, m.sad), 1);
    smile.position.y = smile.userData.rest.y - m.sad * 0.02;
    const sm = Math.max(0.001, 1 - openM * 1.5);
    smile.scale.x = sm;
    for (const b of cheeks) b.scale.setScalar(lerp(1, 1.3, m.tipsy) + m.cheer * 0.08);

    // brows: a frown in a drift, a lift on a hit, slanted when sad
    brows.forEach((b, i) => {
      const side = i === 0 ? 1 : -1;
      b.rotation.z = side * (0.42 * m.drift - 0.34 * m.sad - 0.2 * m.stink + 0.16 * m.boost);
      b.position.y = b.userData.rest.y + 0.05 * m.hit + 0.018 * m.cheer + 0.01 * m.sad - 0.012 * m.drift;
    });

    // ears lag behind everything
    ears.forEach((b, i) => {
      const side = i === 0 ? 1 : -1;
      const ds = dt > 0 ? dt : 1 / 60;
      const down = clamp(m.vert * 0.6, -0.5, 0.5);
      const a = earS[i].step(m.lat * 0.35 + side * (down + m.sad * 0.55 - m.cheer * 0.12 + m.hit * Math.sin(t * 21 + i) * 0.5), ds);
      const f = earF[i].step(-m.sn * 0.32 - m.boost * 0.5 + m.fwd * 0.3 + Math.sin(t * 15 + i) * 0.05 * m.sn, ds);
      b.rotation.z = a * sign;
      b.rotation.x = f;
    });

    // arms: on the wheel, up on a cheer or in the air, flailing on a hit
    arms.forEach((b, i) => {
      const side = i === 0 ? 1 : -1, dir = b.userData.dir;
      // the wheel turns under the hands
      const steerA = m.steer * 0.15 * side;
      const raise = clamp(Math.max(m.cheer, m.air * 0.5, m.hit), 0, 1);
      armW[i] = raise;
      up.set(side * 0.55, 1, 0.12);
      if (m.cheer > 0.01) up.set(side * (0.95 + Math.sin(t * 7 + i) * 0.25), 1, 0.25 + Math.sin(t * 7 + i) * 0.14);
      if (m.hit > 0.3) up.set(side * (0.9 + Math.sin(t * 25 + i * 2) * 0.5), 0.35 + Math.sin(t * 19 + i) * 0.7, Math.cos(t * 21 + i) * 0.5);
      if (m.sad > 0.3 && m.cheer < 0.3) { up.set(side * 0.3, -0.75, 0.42); armW[i] = m.sad; }
      if (m.stink > 0.3 && i === 1 && raise < 0.3) { up.set(side * -0.15 + Math.sin(t * 13) * 0.4, 0.7, 0.8); armW[i] = m.stink; }
      // a sip: the right hand comes up in front of the mouth with the bottle, whatever else is going on short of a hit
      if (i === 1 && m.sip > 0.02 && m.hit < 0.3) { const h = b.userData.sh; up.set(sipFoot[0] - h[0], sipFoot[1] - 0.12 - h[1], sipFoot[2] - 0.1 - h[2]); armW[i] = Math.max(armW[i], m.sip); }
      up.normalize();
      q.setFromUnitVectors(dir, up);
      q2.identity().slerp(q, armW[i]);
      b.quaternion.copy(q2);
      if (armW[i] < 0.3) b.rotateZ(steerA * (1 - armW[i]));
    });

    // the tail wags with everything, and the driver's own moving bits follow
    if (tail) {
      const a = tailS.step(m.lat * 0.5 + Math.sin(t * 8) * (0.08 + m.cheer * 0.5) + m.hit * Math.sin(t * 19) * 0.5, dt > 0 ? dt : 1 / 60);
      tail.rotation.y = a * (spec.tailSign ?? 1);
      tail.rotation.x = lerp(0, 0.4, m.sad) - m.boost * 0.15;
    }
    dizzy.rotation.y = t * 5.5;
    dizzy.scale.setScalar(Math.max(0.001, dizzyOn > 0.1 ? dizzyOn : 0));
    wisp.rotation.y = t * 1.3;
    wisp.position.y = wisp.userData.rest.y + Math.sin(t * 2.3) * 0.06;
    wisp.scale.setScalar(Math.max(0.001, m.stink > 0.05 ? m.stink : 0));
    const burnt = m.soot > 0.5;
    bottle.scale.setScalar(Math.max(0.001, m.sip));
    soot.scale.setScalar(burnt ? 1 : 0.001);
    skin.scale.setScalar(burnt ? 0.001 : 1);
    // round the lips, one side to the other and over the top
    const lr = lick.userData.rest, la = t * 5.4;
    lick.position.set(lr.x + Math.sin(la) * sw * 0.8, lr.y + Math.cos(la) ** 2 * sw * 0.2 - 0.008, lr.z - Math.abs(Math.sin(la)) * 0.02);
    lick.scale.setScalar(Math.max(0.001, m.lick));
    pan.scale.setScalar(Math.max(0.001, m.pan));
    pan.position.y = pan.userData.rest.y + Math.abs(Math.sin(t * 9)) * 0.05 * m.pan;
    pan.rotation.z = Math.sin(t * 6.3) * 0.07 * m.pan;
    spec.pose?.(m, k, ctxOut);
  }
  return { pose, ...ctxOut };
}
