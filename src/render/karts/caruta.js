// Căruța: the Romanian horse cart as it still goes down any village road. A long plank trough of weathered wood, its sides leaning out on
// stakes with a rail along the top, four iron-tyred wooden wheels, smaller in front, a little hay; a painted tailboard is the one bit of
// folk licence, and a cart seen from behind all race has earned it. Murgu, a plump dun horse with the red tassels on his bridle and
// collar, gallops between the shafts with four jointed legs, his gait, neck, mane and tail all following the kart. Oița the sheep sits
// off to one side of the bench so a chasing camera sees him past her, and holds the reins.
import { createRig, swing, spring } from './_kit.js';
import { chibi } from '../chibi.js';
import { clamp, lerp } from '../math.js';

const WOOD = '#a97f4f', WOOD_L = '#bf9663', WOOD_D = '#7d5a36', IRON = '#3a3640', CREAM = '#f3e7c9', RED = '#cf2d28', INK = '#2b2028', BLUE = '#2b6fb8', HAY = '#eec956', HAY_D = '#d4a93e';
const COAT = '#8c7566', COAT_L = '#a08a7a', COAT_D = '#5f5048', MANE = '#2e272c', HOOF = '#26222a', MUZZLE = '#5a4c48';
const TAU = Math.PI * 2;
// the order the feet land in. Trot: diagonal pairs. Gallop: hind, hind, fore, fore, then all four off the ground.
const TROT = [0, 0.5, 0.5, 0], GALLOP = [0.42, 0.56, 0, 0.14];

export function build(ctx) {
  const r = createRig(ctx), { part, bone, wheel, x, shapes, grad } = r, { box, tube, cone, torus, quad } = shapes, { ball, spokedGeo, limb, poly, star, dome, loft, oval, solid } = x;
  const B = 'body';
  const opts = { iron: IRON, wood: '#b98545', hub: RED, spokes: 3, seg: 12 };
  const zFW = 0.04, zBW = -1.14, rF = 0.38, rB = 0.46;
  wheel('wFL', [0.72, rF, zFW], { front: true, geo: spokedGeo(rF, 0.14, { ...opts, side: 1 }) });
  wheel('wFR', [-0.72, rF, zFW], { front: true, geo: spokedGeo(rF, 0.14, { ...opts, side: -1 }) });
  wheel('wBL', [0.76, rB, zBW], { geo: spokedGeo(rB, 0.15, { ...opts, side: 1 }) });
  wheel('wBR', [-0.76, rB, zBW], { geo: spokedGeo(rB, 0.15, { ...opts, side: -1 }) });

  // ---- the cart ----
  // Two planks a side leaning out over a narrow floor. y0 floor, y1 top, half widths at floor and top.
  const z0 = -1.66, z1 = 0.26, y0 = 0.52, y1 = 1.02, h0 = 0.42, h1 = 0.72;
  // the axles under the floor
  part(B, box(1.4, 0.08, 0.08), '#5e4228', { p: [0, 0.44, zBW] });
  part(B, box(1.3, 0.08, 0.08), '#5e4228', { p: [0, 0.38, zFW] });
  const across = (t) => lerp(h0, h1, t);
  for (const sx of [1, -1]) {
    // lower and upper plank: outer face out, a shadow line between them
    for (const [t0, t1, c] of [[0, 0.5, WOOD], [0.53, 1, WOOD_L]]) {
      const ya = lerp(y0, y1, t0), yb = lerp(y0, y1, t1), xa = sx * across(t0), xb = sx * across(t1), e = sx * 0.04;
      const a = [xa, ya, z1 + 0.04], b = [xb, yb, z1 + 0.04], c1 = [xb - e, yb, z1 + 0.04], d = [xa - e, ya, z1 + 0.04], a2 = [xa, ya, z0], b2 = [xb, yb, z0], c2 = [xb - e, yb, z0], d2 = [xa - e, ya, z0];
      part(B, solid(sx > 0 ? [d, a, b, c1, d2, a2, b2, c2] : [a, d, c1, b, a2, d2, c2, b2]), c, null, grad(y0, y1, 0.86));
    }
    // the rail along the top, on stakes with their diagonal braces, what makes it a cart and not a box
    part(B, tube([[sx * (h1 + 0.03), y1 + 0.03, z0 - 0.08], [sx * (h1 + 0.03), y1 + 0.03, z1 + 0.14]], 0.036, 3), WOOD_D);
    for (const z of [-1.45, 0.02]) part(B, tube([[sx * (h0 + 0.05), y0 - 0.02, z], [sx * (h1 + 0.05), y1 + 0.03, z]], 0.026, 3), WOOD_D);
    part(B, tube([[sx * (h0 + 0.05), y0 - 0.02, -0.76], [sx * (h1 + 0.05), y1 + 0.03, -0.34]], 0.022, 3), WOOD_D);
    part(B, tube([[sx * (h0 + 0.05), y0 - 0.02, -0.76], [sx * (h1 + 0.05), y1 + 0.03, -1.18]], 0.022, 3), WOOD_D);
    // a small band of red and black on the top plank: the folk licence, again
    for (const z of [-0.95, -0.45]) {
      part(B, poly([[-0.075, 0], [0, 0.085], [0.075, 0], [0, -0.085]]), RED, { p: [sx * (across(0.76) + 0.006), lerp(y0, y1, 0.76), z], r: [0, sx * Math.PI / 2, 0] });
    }
  }
  // the tailboard and the front board, with the great rosette and two tulips on the back: what a chasing driver looks at
  part(B, box(1.42, y1 - y0 + 0.02, 0.05), WOOD_L, { p: [0, (y0 + y1) / 2, z0 - 0.015] }, grad(y0, y1, 0.86));
  part(B, box(1.42, y1 - y0, 0.05), WOOD, { p: [0, (y0 + y1) / 2, z1 + 0.05] }, grad(y0, y1, 0.86));
  const zT = z0 - 0.043, cy = (y0 + y1) / 2 + 0.02;
  const tail = (g, color, px, py, lift = 0.003) => part(B, g, color, { p: [px, py, zT - lift], r: [0, Math.PI, 0] });
  // cream painted panel, ink line, so the wood stays wood round it
  part(B, quad([0.62, y0 + 0.05, zT - 0.001], [-0.62, y0 + 0.05, zT - 0.001], [-0.62, y1 - 0.05, zT - 0.001], [0.62, y1 - 0.05, zT - 0.001]), CREAM);
  tail(star(0.2, 8, 0.48), RED, 0, cy);
  tail(star(0.095, 8, 0.55), INK, 0, cy, 0.006);
  for (const sx of [1, -1]) {
    tail(poly([[-0.09, 0], [0, 0.14], [0.09, 0], [0, -0.14]]), RED, sx * 0.4, cy);
    tail(poly([[-0.04, 0], [0, 0.065], [0.04, 0], [0, -0.065]]), BLUE, sx * 0.4, cy, 0.006);
  }

  // the bench across the front, a plank on two uprights
  part(B, box(1.2, 0.07, 0.3), WOOD_L, { p: [0, 0.82, 0.02] });
  // the heap: a low soft bed of hay in the back half, low enough to see the horse over it, and it shakes on the road
  const hay = bone('hay', B, [0, 1.05, -0.8]);
  for (const [hx, hy, hz, hs, c] of [[0, 1.0, -0.8, 0.56, HAY], [0.32, 0.98, -0.34, 0.34, HAY_D], [-0.3, 1.0, -1.24, 0.34, HAY_D], [0.3, 1.0, -1.22, 0.36, HAY]]) part(hay, ball(hs, [1.1, 0.5, 1.15], hs > 0.5 ? 7 : 6, 4), c, { p: [hx, hy, hz] });
  for (const [a, b, c, tz, tx] of [[0.1, 1.3, -0.84, 0.5, 0.4], [-0.32, 1.17, -1.26, -0.6, 0.5]]) part(hay, shapes.cone(0.02, 0.3, 3), HAY, { p: [a, b, c], r: [tz, 0, tx] });

  // ---- Murgu ----
  // Everything hangs from the hitch at the front of the cart, so the horse leads the turn and the shafts go with him.
  const horse = bone('horse', 'root', [0, 0.6, 0.3]);
  for (const sx of [1, -1]) part(horse, tube([[sx * 0.34, 0.66, 0.26], [sx * 0.42, 0.98, 0.92], [sx * 0.4, 1.12, 1.26]], 0.026, 3), WOOD_D);
  const tc = [0, 1.14, 1.02];
  const trunk = bone('trunk', horse, tc);
  // The barrel, rump to chest: a deep chest, a round belly, a big soft rump. A sphere is the wrong animal.
  const sh = (px) => (_x, y) => (y < px ? 0.84 : 1);
  part(trunk, loft([
    { z: 1.5, pts: oval(0.2, 0.2, 1.14, 8) },
    { z: 1.4, pts: oval(0.33, 0.33, 1.1, 8) },
    { z: 1.2, pts: oval(0.39, 0.4, 1.1, 8) },
    { z: 0.94, pts: oval(0.39, 0.38, 1.12, 8) },
    { z: 0.68, pts: oval(0.4, 0.39, 1.18, 8) },
    { z: 0.5, pts: oval(0.33, 0.33, 1.2, 8) },
    { z: 0.42, pts: oval(0.19, 0.2, 1.2, 8) },
  ]), COAT, null, sh(0.86));
  // the darker stripe along the spine of a dun, a red strap over the back with a tassel each side
  part(trunk, tube([[0, 1.54, 0.72], [0, 1.5, 1.1], [0, 1.44, 1.32]], [0.06, 0.05, 0.05], 3), COAT_D);

  // A leg: thigh, joint, shin with its hoof. Rest pose straight down; the gallop bends them.
  const legSpec = [[0.24, 1.32, 0.62, 'F'], [-0.24, 1.32, 0.62, 'F'], [0.24, 0.68, 0.66, 'H'], [-0.24, 0.68, 0.66, 'H']];
  const legs = legSpec.map(([lx, lz, hip, kind], i) => {
    const up = bone(`leg${i}`, trunk, [lx, 0.9 + (kind === 'H' ? 0.06 : 0), lz]), yh = up.userData.at[1], ka = [lx, hip - 0.16 + (kind === 'H' ? 0.04 : 0), lz + (kind === 'H' ? -0.03 : 0)];
    part(up, limb([lx, yh, lz], ka, kind === 'H' ? 0.15 : 0.12, 5, 1), COAT);
    const lo = bone(`shin${i}`, up, ka), hoof = [lx, 0.07, lz];
    part(lo, limb(ka, [lx, 0.14, lz], 0.085, 5, 1), COAT_D);
    part(lo, shapes.cylinder(0.09, 0.115, 0.14, 5), HOOF, { p: hoof });
    return { up, lo, kind, i };
  });
  // the tail, thick and dark, on a bone
  const tailH = bone('tailH', trunk, [0, 1.42, 0.46]);
  part(tailH, tube([[0, 1.42, 0.46], [0, 1.32, 0.3], [0, 1.0, 0.24], [0, 0.72, 0.28]], [0.05, 0.1, 0.09, 0.02], 5), MANE);

  // the neck rises from the chest, the head nods on it
  const neck = bone('neck', trunk, [0, 1.3, 1.36]);
  const headAt = [0, 1.9, 1.62];
  part(neck, tube([[0, 1.14, 1.34], [0, 1.5, 1.42], [0, 1.82, 1.56]], [0.28, 0.2, 0.14], 7), COAT_L);
  // the mane in a row of tufts along the crest, with a flutter of their own
  const mane = bone('mane', neck, [0, 1.8, 1.42]);
  part(mane, tube([[0, 2.02, 1.52], [0, 1.84, 1.38], [0, 1.6, 1.26], [0, 1.36, 1.17], [0, 1.16, 1.12]], [0.05, 0.13, 0.15, 0.12, 0.03], 5), MANE, { s: [0.5, 1, 1] });
  const nod = bone('nod', neck, headAt);
  // a long face, not a ball: forehead, cheeks, then down to a soft dark nose
  part(nod, loft([
    { z: 2.14, pts: oval(0.12, 0.11, 1.62, 8) },
    { z: 2.04, pts: oval(0.16, 0.15, 1.63, 8) },
    { z: 1.84, pts: oval(0.18, 0.19, 1.77, 8) },
    { z: 1.62, pts: oval(0.23, 0.24, 1.94, 8) },
    { z: 1.46, pts: oval(0.15, 0.17, 1.98, 8) },
  ]), COAT_L);
  part(nod, loft([{ z: 2.15, pts: oval(0.11, 0.1, 1.61, 8) }, { z: 2.07, pts: oval(0.145, 0.135, 1.62, 8) }]), MUZZLE);
  for (const sx of [1, -1]) {
    part(nod, ball(0.024, [1, 1, 0.5], 4, 2), '#1c181c', { p: [sx * 0.065, 1.64, 2.145] });
    // ears up, tips in
    part(nod, ball(0.075, [0.62, 1.5, 0.45], 5, 3), COAT_D, { p: [sx * 0.13, 2.22, 1.56], r: [0, 0, -sx * 0.18] });
    // an eye the size a friendly horse deserves
    const eye = [sx * 0.19, 1.97, 1.72], tilt = sx * 0.85, fx = Math.sin(tilt), fz = Math.cos(tilt);
    part(nod, dome(0.098, 10, 1, 0.7), '#fcfbf6', { p: eye, r: [0, tilt, 0] });
    part(nod, dome(0.078, 9, 1, 0.5), '#231a22', { p: [eye[0] + fx * 0.036, eye[1], eye[2] + fz * 0.036], r: [0, tilt, 0] });
    part(nod, x.disc(0.028, 5), [1.5, 1.5, 1.5], { p: [eye[0] + fx * 0.078 + 0.02, eye[1] + 0.03, eye[2] + fz * 0.078], r: [0, tilt, 0] });
  }
  // the forelock
  part(nod, tube([[0, 2.18, 1.56], [0, 2.14, 1.68], [0, 2.02, 1.8]], [0.05, 0.09, 0.03], 4), MANE, { s: [0.8, 1, 1] });
  // the jaw, to whinny with
  const jaw = bone('jaw', nod, [0, 1.56, 1.96]);
  part(jaw, ball(0.1, [1, 0.42, 1.2], 5, 3), MUZZLE, { p: [0, 1.52, 2.03] });

  // ---- the harness: the red the whole of Romania knows ----
  // the padded collar round the base of the neck, straps along his side, and the tassels: on the brow, the cheeks, the collar, in bright red wool
  part(neck, torus(0.27, 0.05, 3, 8), RED, { p: [0, 1.28, 1.38], r: [Math.PI / 2 - 0.42, 0, 0], s: [1, 1.2, 1] });
  for (const sx of [1, -1]) part(trunk, tube([[sx * 0.33, 1.22, 1.34], [sx * 0.4, 1.1, 0.92], [sx * 0.36, 1.2, 0.6]], 0.018, 3), RED);
  part(trunk, tube([[-0.39, 1.0, 0.98], [0, 1.54, 0.98], [0.39, 1.0, 0.98]], 0.024, 3), RED);
  part(nod, tube([[-0.19, 1.98, 1.84], [0, 2.09, 1.86], [0.19, 1.98, 1.84]], 0.016, 3), RED);
  const tassels = bone('tassels', neck, [0, 1.18, 1.5]);
  // the red wool pompoms the whole of Romania knows, hanging a little long
  const tassel = (b, tx, ty, tz, s) => part(b, ball(s, [1, 1.35, 1], 5, 3), '#ea3a30', { p: [tx, ty, tz] });
  for (const [tx, ty, tz, s] of [[0, 1.0, 1.62, 0.1], [0.27, 1.06, 1.5, 0.09], [-0.27, 1.06, 1.5, 0.09]]) tassel(tassels, tx, ty, tz, s);
  const brow = bone('brow', nod, [0, 2.1, 1.86]);
  for (const [tx, ty, tz, s] of [[0, 2.02, 1.93, 0.08], [0.21, 1.84, 1.84, 0.07], [-0.21, 1.84, 1.84, 0.07]]) tassel(brow, tx, ty, tz, s);

  // ---- Oița, off to the right of the bench, with the reins ----
  const hand = [[-0.28, 1.02, 0.34], [-0.56, 1.02, 0.34]];
  const reins = bone('reins', B, [-0.42, 1.02, 0.34]);
  for (const i of [0, 1]) part(reins, tube([hand[i], [(i ? -1 : 1) * 0.28, 1.22, 1.3]], 0.012, 3), '#3a2c26');
  const d = chibi(r, {
    at: [-0.42, 0.8, 0.0], size: 0.72, fur: '#fbf6ea', belly: '#f4ecd9', muzzleColor: '#f1e0c8', nose: '#5a3f3a', inner: '#e8b7a8', earColor: '#efdcc0',
    head: { r: 0.38, s: [1, 1, 1], up: 0.0 }, torso: { r: 0.3, h: 0.0 },
    eyes: { r: 0.14, gap: 0.17, y: -0.02 }, muzzle: { r: 0.14, s: [1.12, 0.78, 0.8], y: -0.17 }, noseR: 0.035,
    ears: { kind: 'droop', len: 0.26, w: 0.08, side: 0.92, up: 0.2, drop: 0.3 },
    arms: { r: 0.075, grip: hand, hand: '#efdcc0' },
    extra: ({ head, center: c, hr }) => {
      // the wool: a crown of lumps on the head
      for (const [ax, ay, az, s] of [[0, 0.72, -0.1, 0.22], [0.3, 0.52, -0.2, 0.18], [-0.3, 0.52, -0.2, 0.18]]) part(head, ball(s, [1.08, 0.94, 1], 6, 3), '#fbf6ea', { p: [c[0] + ax * hr * 1.5, c[1] + ay * hr * 1.5, c[2] + az * hr * 1.5] });
    },
  });

  // ---- the gait ----
  let phase = Math.random();
  const yawS = spring(5.5, 0.42), rollS = spring(6, 0.4);
  // Where a leg is at phase f of the stride: reach forward, drive back along the ground, snap the shin up and swing through.
  const STANCE = 0.42;
  function stride(f, kind, reach) {
    const a = reach * (kind === 'H' ? 0.85 : 1);
    if (f < STANCE) return { hip: lerp(-a, a, f / STANCE), knee: kind === 'H' ? 0.18 : 0.05 };
    const q = (f - STANCE) / (1 - STANCE);
    return { hip: lerp(a, -a, q * q * (3 - 2 * q)), knee: Math.sin(q * Math.PI) * (kind === 'H' ? 1.15 : 1.45) };
  }
  return r.finish({
    driver: d,
    update(m, k) {
      const dt = m.dt || 0, g = clamp((m.sn - 0.22) / 0.26, 0, 1), go = clamp(m.sn * 7, 0, 1);
      // he canters up to about 4 strides a second: quick enough to feel, slow enough to see, and more when the boost is on
      phase = (phase + dt * (0.8 + Math.sqrt(m.sn) * 2.7 + m.boost * 0.7) * go) % 1;
      const reach = lerp(0.3, 0.74, g) * go + m.boost * 0.1;
      const rear = clamp(Math.max(m.hit, m.cheer * 0.9), 0, 1), air = m.air, sad = m.sad;
      legs.forEach(({ up, lo, kind, i }) => {
        const f = (phase + lerp(TROT[i], GALLOP[i], g)) % 1, s = stride(f, kind, reach);
        let hip = s.hip, knee = s.knee * go;
        // legs out front and back in a jump
        hip = lerp(hip, kind === 'H' ? 0.8 : -0.85, air);
        knee = lerp(knee, 0.25, air);
        // rearing: he stands up on the hind legs and the forelegs paddle
        if (kind === 'F') { hip = lerp(hip, -0.9 + Math.sin(m.t * 11 + i * 2.2) * 0.45, rear); knee = lerp(knee, 1.2 + Math.sin(m.t * 11 + i * 2.2) * 0.4, rear); }
        else { hip = lerp(hip, 0.45, rear); knee = lerp(knee, 0.25, rear); }
        // braking: hind legs under him
        const bk = clamp(-m.fwd, 0, 1);
        if (kind === 'H') hip -= bk * 0.4; else hip -= bk * 0.25;
        up.rotation.x = hip; lo.rotation.x = knee;
      });
      // the barrel rocks over the stride: rump up as the hind feet push, chest up as the fore feet reach; all of him clear of the ground at the top
      const w = phase * TAU;
      const rock = Math.sin(w) * 0.13 * g + Math.sin(w * 2) * 0.012 * (1 - g) * go;
      const bob = (g * (0.06 + Math.sin(w + 0.6) * 0.12) + (1 - g) * go * Math.abs(Math.sin(w)) * 0.05);
      const breath = Math.sin(m.t * 1.7) * 0.006;
      trunk.position.y = trunk.userData.rest.y + bob + breath + rear * 0.14 - sad * 0.03 - clamp(-m.fwd, 0, 1) * 0.1;
      trunk.position.z = trunk.userData.rest.z - rear * 0.18;
      trunk.rotation.x = rock - rear * 0.72 + air * -0.08 + clamp(-m.fwd, 0, 1) * -0.22 + Math.sin(m.t * 21) * 0.05 * m.hit;
      trunk.rotation.z = rollS.step(m.lean * m.sn * 0.16 + m.lat * 0.04, dt || 1 / 60) + Math.sin(m.t * 5) * 0.05 * m.tipsy;
      // the neck pumps against the rocking, stretches out flat when he is flying, and hangs when he sulks
      neck.rotation.x = -rock * 1.1 + m.boost * 0.26 + g * 0.1 + sad * 0.5 + rear * 0.22;
      nod.rotation.x = Math.sin(w + 1) * 0.09 * g + Math.sin(m.t * 1.3) * 0.03 + m.hit * Math.sin(m.t * 15) * 0.22 - m.boost * 0.14 - m.cheer * 0.12 + sad * 0.42;
      nod.rotation.y = -m.lean * 0.32 + Math.sin(m.t * 9) * 0.2 * m.hit + Math.sin(m.t * 3) * 0.14 * m.tipsy;
      neck.rotation.y = -m.lean * 0.26;
      jaw.rotation.x = Math.max(m.cheer * (0.3 + Math.sin(m.t * 9) * 0.14), m.hit * 0.3, m.boost * 0.12, m.lick * 0.12);
      tailH.rotation.x = 0.1 + lerp(0, 0.9, Math.min(1, m.sn * 1.4)) + m.boost * 0.5 + Math.sin(w) * 0.16 * g - sad * 0.1;
      tailH.rotation.y = swing(m, 7, 0.3) + m.lat * 0.5 + (m.speed < 1 ? Math.sin(m.t * 2.3) * 0.3 : 0);
      mane.rotation.x = m.sn * 0.32 + m.boost * 0.2 + Math.sin(w * 2) * 0.1 * g;
      tassels.rotation.x = -m.sn * 0.5 + Math.sin(w * 2) * 0.3 * m.sn;
      tassels.rotation.z = swing(m, 9, 0.22);
      brow.rotation.x = -m.sn * 0.6 + Math.sin(w * 2 + 1) * 0.25 * m.sn;
      // he leads the turn, swings wide past it on the shafts in a drift, and the reins go with him
      const yw = yawS.step(-m.steer * (0.24 + m.drift * 0.14) - m.lat * 0.12, dt || 1 / 60);
      horse.rotation.y = yw;
      reins.rotation.y = yw * 0.8;
      horse.rotation.z = m.lean * 0.05;
      hay.rotation.z = swing(m, 13, 0.018) + m.lat * 0.015;
      hay.position.y = hay.userData.rest.y + Math.abs(Math.sin(m.dist * 2.1)) * 0.016 * m.sn - m.vert * 0.03;
    },
  });
}
