// Il Carrello: a steel kitchen trolley on fat casters with a chef riding the footplate at the back, hands on the push bar, as every cook
// has wanted to do once. Two copper pans hang open-faced towards the chase camera either side of her and swing through the turns, the
// stock pot in front keeps its lid dancing, a tiered rantang rides on the lower shelf. A tall pleated toque, whites, a red neckerchief
// and the big bow of her apron strings read from behind. A cartoon chef, not a portrait.
import { createRig, swing } from './_kit.js';
import { chibi } from '../chibi.js';

const STEEL = '#c9d0d6', STEEL_D = '#8f98a2', COPPER = '#d9763c', COPPER_D = '#a9542a', IRON = '#34313a', WHITES = '#fbfaf5', RED = '#d8362e', APRON = '#2b6f78', SKIN = '#cf9460', HAIR = '#33252a';

export function build(ctx) {
  const r = createRig(ctx), { part, bone, wheel, x, shapes, grad } = r, { roundedBox, box, tube, capsule, torus, cone, cylinder, lathe } = shapes, { ball, wheelGeo, limb, trim, poly, disc } = x;
  const B = 'body', hw = 0.62, z0 = -0.42, z1 = 1.16;

  // fat casters in front, on their forks; bigger wheels behind
  const front = { tyre: '#2c2a33', rim: WHITES, hub: COPPER, seg: 8 };
  wheel('wFL', [0.72, 0.33, 0.98], { front: true, geo: wheelGeo(0.33, 0.3, { ...front, side: 1 }) });
  wheel('wFR', [-0.72, 0.33, 0.98], { front: true, geo: wheelGeo(0.33, 0.3, { ...front, side: -1 }) });
  wheel('wBL', [0.8, 0.4, -0.72], { geo: wheelGeo(0.4, 0.34, { ...front, side: 1 }) });
  wheel('wBR', [-0.8, 0.4, -0.72], { geo: wheelGeo(0.4, 0.34, { ...front, side: -1 }) });
  for (const sx of [1, -1]) part(B, limb([sx * 0.55, 0.62, 0.98], [sx * 0.68, 0.36, 0.98], 0.04, 4, 1), STEEL_D);

  // the trolley: two steel shelves on four posts, a rail round the top one
  const sh0 = 0.56, sh1 = 1.1;
  part(B, box(hw * 2 + 0.1, 0.08, z1 - z0 + 0.1), STEEL, { p: [0, sh0, (z0 + z1) / 2] }, grad(0.5, 0.62, 0.7));
  part(B, box(hw * 2 + 0.1, 0.07, z1 - z0 + 0.1), STEEL, { p: [0, sh1, (z0 + z1) / 2] }, grad(1.05, 1.15, 0.78));
  for (const sx of [1, -1]) for (const zz of [z0, z1]) part(B, tube([[sx * hw, sh0, zz], [sx * hw, sh1 + 0.24, zz]], 0.038, 4), STEEL_D);
  for (const sx of [1, -1]) part(B, tube([[sx * hw, sh1 + 0.2, z0], [sx * hw, sh1 + 0.2, z1]], 0.024, 4), STEEL);
  part(B, tube([[-hw, sh1 + 0.2, z1], [hw, sh1 + 0.2, z1]], 0.024, 4), STEEL);

  // the footplate she rides on, at the back, with a chequer of tread and a little red heart: this kart is somebody's
  part(B, box(1.14, 0.07, 0.72), STEEL_D, { p: [0, 0.42, -0.86] }, grad(0.36, 0.46, 0.7));
  for (const sx of [1, -1]) part(B, limb([sx * 0.46, 0.44, -0.54], [sx * 0.46, 0.56, -0.38], 0.04, 4, 1), STEEL_D);
  const heart = (s) => poly(Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2, q = 16 * Math.sin(a) ** 3, w = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a); return [q * s / 16, w * s / 16]; }));
  part(B, box(1.14, 0.26, 0.04), STEEL, { p: [0, 0.3, -1.2] });
  part(B, heart(0.1), RED, { p: [0, 0.3, -1.226], r: [0, Math.PI, 0] });

  // the push bar across the back of the top shelf, wrapped in red
  const barY = sh1 + 0.26, barZ = -0.5;
  for (const sx of [1, -1]) part(B, limb([sx * hw, sh1 + 0.1, z0], [sx * 0.5, barY, barZ], 0.034, 5, 1), STEEL_D);
  part(B, tube([[-0.5, barY, barZ], [0.5, barY, barZ]], 0.045, 6), RED);

  // two pans hanging from a rail across the back, their faces to the chase camera: copper on one side, black iron on the other
  const railY = sh1 + 0.5, railZ = -0.44, railX = 0.72;
  for (const sx of [1, -1]) part(B, limb([sx * hw, sh1 + 0.2, z0], [sx * railX, railY, railZ], 0.026, 4, 1), STEEL_D);
  part(B, tube([[0.3, railY, railZ], [railX + 0.14, railY, railZ]], 0.022, 4), STEEL);
  part(B, tube([[-railX - 0.14, railY, railZ], [-0.3, railY, railZ]], 0.022, 4), STEEL);
  const pan = (name, sx, R, out, inside) => {
    const at = [sx * (railX - 0.02), railY, railZ - 0.04], b = bone(name, B, at), cy = railY - 0.27 - R, lz = railZ - 0.06;
    part(b, tube([[at[0], railY, lz], [at[0], cy + R * 0.86, lz]], 0.028, 4), out);
    // the rim towards the camera: lathe about y, turned so its open face looks along -z
    part(b, trim(lathe([[0, 0.05], [R, 0.05], [R * 1.05, -0.08], [R * 0.86, -0.075], [0, -0.04]], 10)), out, { p: [at[0], cy, lz], r: [Math.PI / 2, 0, 0] });
    part(b, disc(R * 0.84, 10), inside, { p: [at[0], cy, lz - 0.052], r: [0, Math.PI, 0] });
    return b;
  };
  const panL = pan('panL', 1, 0.27, COPPER, '#efa56a'), panR = pan('panR', -1, 0.25, IRON, '#55525c');
  // a wooden spoon hung beside the iron pan
  const spoon = bone('spoon', B, [-0.42, railY, railZ - 0.05]);
  part(spoon, tube([[-0.42, railY, railZ - 0.05], [-0.42, railY - 0.4, railZ - 0.05]], 0.02, 3), '#c58a4c');
  part(spoon, ball(0.055, [1, 1.3, 0.5], 4, 2), '#c58a4c', { p: [-0.42, railY - 0.44, railZ - 0.05] });

  // the stock pot up front, its lid dancing on the boil
  const potZ = 0.74, potY = sh1 + 0.04;
  part(B, cylinder(0.33, 0.3, 0.42, 10), COPPER, { p: [0, potY + 0.21, potZ] }, grad(potY, potY + 0.42, 0.78));
  part(B, cylinder(0.35, 0.35, 0.05, 10), COPPER_D, { p: [0, potY + 0.42, potZ] });
  for (const sx of [1, -1]) part(B, capsule(0.03, 0.1, 1, 4), COPPER_D, { p: [sx * 0.36, potY + 0.3, potZ], r: [Math.PI / 2, 0, 0] });
  const lid = bone('lid', B, [0, potY + 0.43, potZ]);
  part(lid, trim(lathe([[0.32, 0], [0.26, 0.05], [0.08, 0.09], [0, 0.09]], 10)), STEEL, { p: [0, potY + 0.43, potZ] });
  part(lid, ball(0.045, [1, 1, 1], 5, 3), IRON, { p: [0, potY + 0.54, potZ] });
  // the steam, two soft puffs that rise and shrink over and over
  const puffs = [0, 1].map((i) => { const b = bone(`puff${i}`, B, [0, potY + 0.6, potZ]); part(b, ball(0.075, [1, 1, 1], 5, 3), '#f6f6f2', { p: [0, potY + 0.6, potZ] }); return b; });

  // on the top shelf behind the pot: a chopping board with a chilli and a bowl of tomatoes, the colour a chaser sees past her elbows
  part(B, box(0.5, 0.05, 0.3), '#d3a15f', { p: [0.3, sh1 + 0.07, 0.14] });
  part(B, capsule(0.035, 0.2, 1, 5), RED, { p: [0.3, sh1 + 0.13, 0.14], r: [0.2, 0, 1.3] });
  part(B, cylinder(0.17, 0.11, 0.1, 8), '#f4f1e8', { p: [-0.3, sh1 + 0.1, 0.14] });
  for (const [bx, bz] of [[-0.36, 0.1], [-0.24, 0.1], [-0.3, 0.21]]) part(B, ball(0.08, [1, 0.9, 1], 5, 3), '#e4453a', { p: [bx, sh1 + 0.18, bz] });

  // the lower shelf: the tiered rantang, Javanese enamel tiffin, and a sack of rice
  for (let i = 0; i < 3; i++) part(B, cylinder(0.2, 0.2, 0.13, 7), ['#2f9c8f', '#f4f1e8', '#e8505b'][i], { p: [0.26, sh0 + 0.12 + i * 0.14, 0.42] });
  part(B, ball(0.24, [1, 0.9, 0.9], 6, 3), '#efe3c4', { p: [-0.26, sh0 + 0.25, 0.42] });

  // Fifi, standing on the footplate
  const seat = [0, 0.86, -0.86], hand = [[0.2, barY + 0.03, barZ - 0.01], [-0.2, barY + 0.03, barZ - 0.01]];
  const d = chibi(r, {
    at: seat, size: 0.98, panTop: 2.78, fur: SKIN, belly: WHITES, muzzleColor: SKIN, nose: '#bb7d55', noseR: 0.026, inner: '#b97c50', brow: HAIR,
    head: { r: 0.4, s: [1.05, 1.0, 1] }, torso: { r: 0.25, h: 0.3 },
    eyes: { r: 0.125, gap: 0.18, y: 0.035, iris: '#2b1a16' }, muzzle: { r: 0.05, s: [1, 0.6, 0.3], y: -0.13, z: -0.012 },
    ears: { kind: 'none' },
    arms: { r: 0.08, color: WHITES, hand: SKIN, grip: hand },
    extra: ({ torso, head, center: c, hr, tr, th, at, H, size, onHead }) => {
      // the double-breasted whites over the fur a driver has, the skirt of the jacket, two legs and clogs down to the plate
      const mid = at[1] + tr + th / 2;
      part(torso, capsule(tr * 1.08, th + 0.02, 1, 8), WHITES, { p: [at[0], mid + 0.02, at[2]], s: [1, 1, 0.98] }, grad(at[1], at[1] + 0.5, 0.86));
      for (const sx of [1, -1]) for (const dy of [0.2, 0.06]) part(torso, disc(0.024, 5), '#c9a95e', { p: [at[0] + sx * 0.085, mid + dy, at[2] + tr * 1.0] });
      for (const sx of [1, -1]) {
        part('body', capsule(0.1, 0.22, 1, 5), '#2c2a33', { p: [at[0] + sx * 0.13, at[1] - 0.13, at[2]] });
        part('body', ball(0.13, [0.92, 0.6, 1.4], 6, 3), '#f4f1e8', { p: [at[0] + sx * 0.13, 0.52, at[2] + 0.05] });
      }
      // the apron: a deep teal skirt round the waist, the strings tied in a big bow on her back
      part(torso, cylinder(tr * 1.13, tr * 1.28, 0.42, 8), APRON, { p: [at[0], at[1] + 0.12, at[2]] }, grad(at[1] - 0.1, at[1] + 0.3, 0.84));
      const bow = bone('bow', torso, [at[0], at[1] + 0.35, at[2] - tr * 1.1]);
      for (const sx of [1, -1]) {
        part(bow, ball(0.1, [1.3, 0.72, 0.42], 5, 3), RED, { p: [at[0] + sx * 0.13, at[1] + 0.36, at[2] - tr * 1.14], r: [0, 0, sx * 0.3] });
        part(bow, capsule(0.03, 0.22, 1, 4), RED, { p: [at[0] + sx * 0.09, at[1] + 0.2, at[2] - tr * 1.14], r: [0, 0, sx * 0.35] });
      }
      part(bow, ball(0.05, [1, 1, 0.8], 4, 2), '#b52822', { p: [at[0], at[1] + 0.36, at[2] - tr * 1.16] });
      // the red neckerchief
      part(torso, torus(tr * 0.72, 0.075, 3, 8), RED, { p: [at[0], at[1] + tr * 2 + th - 0.05, at[2]], r: [Math.PI / 2, 0, 0] });
      // dark hair under the hat, a soft fringe at the front and a bun low on the nape, which the chase camera sees
      const hairTop = c[1] + hr * 0.1;
      part(head, ball(hr * 1.04, [H.s[0], H.s[1] * 0.92, H.s[2] * 0.96], 8, 5), HAIR, { p: [c[0], hairTop, c[2] - hr * 0.1] });
      part(head, ball(0.13 * size, [1, 0.92, 0.92], 6, 4), HAIR, { p: [c[0], c[1] - hr * 0.3, c[2] - hr * 1.1] });
      // the fringe swept to one side and two locks by the cheeks, so she is not bald under the hat; a flick of lashes at each eye
      for (const sx of [1, -1]) part(head, ball(hr * 0.34, [1.25, 0.3, 0.32], 5, 3), HAIR, { p: [c[0] + sx * hr * 0.32, c[1] + hr * 0.58, c[2] + hr * 0.76], r: [0.6, sx * 0.4, sx * -0.34] });
      for (const sx of [1, -1]) {
        part(head, ball(hr * 0.26, [0.62, 2, 0.7], 5, 3), HAIR, { p: [c[0] + sx * hr * 0.97, c[1] - hr * 0.08, c[2] + hr * 0.18], r: [0, 0, sx * -0.1] });
        const e = onHead(sx * 0.3 * size, 0.1 * size, 0.0);
        part(head, capsule(0.012, 0.07, 1, 3), HAIR, { p: e, r: [0, 0, sx * -0.9] });
      }
      // a wide warm smile drawn on the face: a person has no muzzle for the driver's own to sit on
      const gy = -hr * 0.54, gp = (ax, ay) => onHead(ax, gy + ay, 0.004), grinB = bone('grin', head, gp(0, 0));
      part(grinB, tube([gp(-0.12, 0.03), gp(-0.06, -0.012), gp(0, -0.024), gp(0.06, -0.012), gp(0.12, 0.03)], 0.012, 3), '#8c3338');
      // the toque: a band, then a tall pleated crown that flares to a soft puff. It rides its own bone, so it nods late.
      const hatY = c[1] + hr * 0.62, hat = bone('toque', head, [c[0], hatY, c[2]]);
      part(hat, cylinder(hr * 0.98, hr * 0.94, 0.16, 9), '#f8f6ee', { p: [c[0], hatY + 0.05, c[2] - 0.01] });
      part(hat, trim(lathe([[hr * 0.96, 0], [hr * 1.12, 0.24], [hr * 1.22, 0.38], [hr * 1.08, 0.5], [hr * 0.5, 0.55], [0, 0.56]], 10)), WHITES, { p: [c[0], hatY + 0.12, c[2] - 0.01] }, grad(hatY + 0.1, hatY + 0.6, 0.9));
      for (let i = 0; i < 3; i++) {
        const a = ((i + 0.5) / 3) * Math.PI * 2, ax = Math.sin(a), az = Math.cos(a);
        part(hat, tube([[c[0] + ax * hr * 0.98, hatY + 0.14, c[2] - 0.01 + az * hr * 0.98], [c[0] + ax * hr * 1.23, hatY + 0.48, c[2] - 0.01 + az * hr * 1.23]], 0.012, 3), '#cfd2d8');
      }
      r.hatAt = hatY;
      // the ladle she waves when she wins
      const lad = bone('ladle', 'armR', hand[1]);
      part(lad, tube([[hand[1][0], hand[1][1], hand[1][2]], [hand[1][0] - 0.02, hand[1][1] + 0.4, hand[1][2] + 0.1]], 0.02, 3), STEEL);
      part(lad, ball(0.085, [1, 0.72, 1], 5, 2), STEEL, { p: [hand[1][0] - 0.02, hand[1][1] + 0.46, hand[1][2] + 0.11] });
      r.hide(lad);
    },
  });

  const hat = r.get('toque'), bow = r.get('bow'), lad = r.get('ladle'), smile = r.get('smile'), grin = r.get('grin');
  return r.finish({
    driver: d,
    update(m) {
      // her smile does what the driver's own would, sad and open included, and the small one stays out of sight
      grin.scale.set(smile.scale.x, smile.scale.y, 1);
      smile.scale.setScalar(0.001);
      // and the mouth she opens to cheer is a person's, not a small muzzle's
      const mo = r.get('mouth');
      mo.position.y = mo.userData.rest.y - 0.06;
      mo.scale.multiplyScalar(4.2);
      // the pans lag the turn and answer the bumps
      const wave = swing(m, 3.6, 0.1), rock = -m.lat * 0.55 - m.lean * m.sn * 0.28;
      panL.rotation.z = rock + wave; panR.rotation.z = rock - wave * 0.8; spoon.rotation.z = rock * 1.2 + wave * 1.5;
      panL.rotation.x = -m.fwd * 0.35 + m.air * 0.5; panR.rotation.x = -m.fwd * 0.3 + m.air * 0.45;
      // the lid dances on the boil, more when the road is rough or the kart lands
      const boil = 0.012 + 0.03 * m.sn, lidUp = Math.abs(Math.sin(m.t * 17)) * boil + Math.max(0, m.vert) * 0.08 + m.air * 0.08;
      lid.position.y = lid.userData.rest.y + lidUp;
      lid.rotation.z = Math.sin(m.t * 23) * boil * 1.5;
      puffs.forEach((b, i) => {
        const u = (m.t * 0.7 + i / 2) % 1, rest = b.userData.rest;
        b.position.set(rest.x + Math.sin(u * 6 + i * 2) * 0.1, rest.y + u * 0.36, rest.z - u * m.sn * 0.5);
        b.scale.setScalar(Math.max(0.001, Math.sin(u * Math.PI) * (0.75 + u)));
      });
      hat.rotation.x = -m.fwd * 0.1 + m.vert * 0.04 + m.boost * 0.1;
      hat.rotation.z = -m.lat * 0.1;
      bow.rotation.z = swing(m, 11, 0.16);
      lad.scale.setScalar(m.cheer > 0.15 ? m.cheer : 0.001);
    },
  });
}
