// Il Tabià: a little Cadore barn on wheels. Stone foot, log walls with their round ends crossing at the corners, a gable of
// vertical larch boards, deep eaves and a shingle roof, geraniums at the window, hay in the loft. Bepi the marmot drives from
// the front porch and looks over the ridge.
import { createRig, swing, spring } from './_kit.js';
import { chibi } from '../chibi.js';

const LARCH = '#b9793f', LARCH_D = '#8f5a2f', LARCH_L = '#d6a062', SILVER = '#a89a86', STONE = '#b8b0a6', SHINGLE = ['#7d5a3c', '#8d6742', '#6e5036', '#9b7449'], HAY = '#eec956', HAY_D = '#cfa63a';

export function build(ctx) {
  const r = createRig(ctx), { part, bone, wheel, x, shapes, grad } = r, { roundedBox, capsule, box, tube } = shapes, { ball, wheelGeo, limb, poly, tiles } = x;
  const shade = grad(0.36, 1.05, 0.72);

  // wheels: fat wooden hubs, a farm toy
  const wR = 0.4, wW = 0.34, opts = { tyre: '#3a3438', rim: LARCH_L, hub: '#d9463d' };
  wheel('wFL', [0.84, wR, 0.78], { front: true, geo: wheelGeo(wR, wW, { ...opts, side: 1 }) });
  wheel('wFR', [-0.84, wR, 0.78], { front: true, geo: wheelGeo(wR, wW, { ...opts, side: -1 }) });
  wheel('wBL', [0.86, wR + 0.03, -0.72], { geo: wheelGeo(wR + 0.03, wW + 0.03, { ...opts, side: 1 }) });
  wheel('wBR', [-0.86, wR + 0.03, -0.72], { geo: wheelGeo(wR + 0.03, wW + 0.03, { ...opts, side: -1 }) });

  // chassis: a stone foot under the barn, a plank porch in front
  const B = 'body', bx = 1.34, bz0 = -1.1, bz1 = 0.18, foot = 0.44;
  part(B, roundedBox(1.46, 0.3, 2.3, 0.13, 1), STONE, { p: [0, foot, -0.02] }, grad(0.26, 0.56, 0.72));
  for (const [sx, sz, w] of [[1, 0.42, 0.3], [-1, 0.0, 0.36], [1, -0.46, 0.34], [-1, -0.84, 0.28]]) part(B, box(0.04, 0.13, w), sx > 0 ? '#9d958c' : '#a59d93', { p: [sx * 0.735, 0.46, sz] });
  const zm = (bz0 + bz1) / 2, zl = bz1 - bz0;

  // log walls: rows of fat round logs whose ends cross at the corners, the first thing that says tabià
  const logs = 4, wy0 = 0.67, lh = 0.155;
  // a log has an end: the pale sawn face, or it shows as a hollow ring. Two triangles apiece, on the ends that show from a chasing camera: the kart is at its budget
  const cap = (e, o) => { const q = lh * 0.58; part(B, shapes.quad([0, -q, 0], [q, 0, 0], [0, q, 0], [-q, 0, 0]), '#e2c08a', { p: e, r: [0, Math.atan2(e[0] - o[0], e[2] - o[2]), 0] }); };
  const log = (a, b, tone, ends) => {
    part(B, tube([a, b], lh * 0.54, 5), tone, null, shade);
    if (ends === 'a') cap(a, b);
    if (ends === 'both') { cap(a, b); cap(b, a); }
  };
  for (let i = 0; i < logs; i++) {
    const y = wy0 + i * lh, tone = i % 2 ? LARCH : '#c58648', ot = i % 2 ? '#c58648' : LARCH;
    for (const sx of [1, -1]) log([sx * bx * 0.5, y, bz0 - 0.14], [sx * bx * 0.5, y, bz1 + 0.14], tone, 'a');
    if (i < logs - 1) log([-bx * 0.5 - 0.14, y + lh * 0.5, bz0 + 0.02], [bx * 0.5 + 0.14, y + lh * 0.5, bz0 + 0.02], ot, i ? 'both' : null);
  }
  part(B, box(bx - 0.06, logs * lh, zl), LARCH_D, { p: [0, wy0 + (logs - 1) * lh / 2, zm] });

  // the gable at the back: vertical boards silvered by the weather, what a chasing driver looks at
  const eave = wy0 + logs * lh - 0.08, ridge = eave + 0.6, gz = bz0 - 0.03;
  part(B, poly([[-bx * 0.5, 0], [0, ridge - eave], [bx * 0.5, 0]]), '#b98a58', { p: [0, eave, gz], r: [0, Math.PI, 0] });
  part(B, poly([[-bx * 0.5, 0], [0, ridge - eave], [bx * 0.5, 0]]), '#b98a58', { p: [0, eave, bz1] });
  for (let i = -2; i <= 2; i++) {
    const bp = i * 0.24, h = (ridge - eave) * (1 - (Math.abs(bp) + 0.08) / (bx * 0.5));
    part(B, box(0.2, h, 0.025), i % 2 ? SILVER : '#c6b08f', { p: [bp, eave + h / 2, gz - 0.016] });
  }
  // the plank door with wide braces and a brass latch
  part(B, box(0.66, 0.5, 0.05), '#8a5a33', { p: [0, 0.82, bz0 - 0.09] });
  for (const dy of [-0.16, 0.16]) part(B, box(0.7, 0.075, 0.04), '#6c4426', { p: [0, 0.82 + dy, bz0 - 0.125] });
  part(B, ball(0.05, [1, 1, 1], 5, 3), '#e9c04a', { p: [0.24, 0.82, bz0 - 0.13] });
  // the loft hatch, stuffed with hay
  part(B, box(0.46, 0.27, 0.04), '#5d3c24', { p: [0, eave + 0.17, gz - 0.03] });
  const hay = bone('hay', B, [0, eave + 0.17, gz - 0.05]);
  for (const [hx, hy, hs] of [[-0.11, -0.01, 0.12], [0.08, -0.01, 0.13]]) part(hay, ball(hs, [1.25, 0.84, 0.9], 6, 4), hx > 0 ? HAY : HAY_D, { p: [hx, eave + 0.17 + hy, gz - 0.09] });
  for (const [a, b, c] of [[-0.18, -0.08, 0.5], [0.19, -0.07, -0.4], [0.03, -0.13, 0.05]]) part(hay, capsule(0.013, 0.22, 1, 3), HAY, { p: [a, eave + 0.17 + b, gz - 0.17], r: [0.3, 0, c] });

  // the roof: deep eaves, rows of shingles each with its own tone, a ridge log. It rides a bone and lands late.
  const roof = bone('roof', B, [0, eave, zm]);
  const over = 0.28, ex = bx * 0.5 + over, slope = (ridge - eave) / (bx * 0.5), rz = zl + 0.44, drop = ex * slope;
  for (const sx of [1, -1]) {
    const run = Math.hypot(ex, drop);
    part(roof, box(run, 0.05, rz), '#5c432d', { p: [sx * ex / 2, ridge - drop / 2 - 0.02, zm], r: [0, 0, -sx * Math.atan(slope)] });
    const a = sx > 0 ? [0, ridge + 0.012, zm + rz / 2] : [0, ridge + 0.012, zm - rz / 2], u = [sx * ex, -drop, 0], v = sx > 0 ? [0, 0, -rz] : [0, 0, rz];
    part(roof, tiles(a, u, v, 4, 5, SHINGLE), null);
  }
  part(roof, tube([[0, ridge + 0.03, zm - rz / 2], [0, ridge + 0.03, zm + rz / 2]], 0.06, 6), '#5c432d');

  // geraniums: a box of them across the back wall over the door, and a pot at each corner of the porch; a green shutter on each flank
  const flowers = bone('flowers', B, [0, 1.1, 0]);
  part(B, box(0.76, 0.09, 0.14), '#7a4a26', { p: [0, 1.09, bz0 - 0.15] });
  const bloom = (fx, fy, fz, size) => part(flowers, ball(size, [1, 1, 1], 5, 3), size > 0.085 ? '#e3323f' : '#f25564', { p: [fx, fy, fz] });
  for (const [dx, dy, s2] of [[-0.3, 0.1, 0.082], [-0.1, 0.13, 0.095], [0.1, 0.13, 0.09], [0.3, 0.1, 0.082]]) bloom(dx, 1.09 + dy, bz0 - 0.17, s2);
  part(flowers, ball(0.26, [1.45, 0.3, 0.4], 6, 3), '#4a8a45', { p: [0, 1.14, bz0 - 0.15] });
  for (const sx of [1, -1]) {
    const wx = sx * (bx * 0.5 + 0.06);
    part(B, box(0.02, 0.24, 0.26), '#3b5a72', { p: [wx, 1.0, zm] });
    for (const dz of [-0.2, 0.2]) part(B, box(0.03, 0.27, 0.13), '#3f7a52', { p: [wx, 1.0, zm + dz] });
    // the pots
    part(B, shapes.cylinder(0.11, 0.08, 0.15, 6), '#c26a3a', { p: [sx * 0.56, 0.72, 1.02] });
    part(flowers, ball(0.1, [1, 0.9, 1], 5, 3), '#4a8a45', { p: [sx * 0.56, 0.83, 1.02] });
    bloom(sx * 0.53, 0.93, 1.04, 0.075); bloom(sx * 0.62, 0.88, 0.98, 0.07);
  }

  // the porch in front: planks, a red bench for Bepi, a log for a bumper
  part(B, box(1.42, 0.07, 1.0), LARCH, { p: [0, 0.62, 0.68] });
  part(B, roundedBox(0.92, 0.2, 0.4, 0.08, 1), '#d9463d', { p: [0, 0.74, 0.42] });
  part(B, roundedBox(0.92, 0.3, 0.1, 0.045, 1), '#a93029', { p: [0, 0.96, 0.24] });
  part(B, tube([[-0.74, 0.5, 1.16], [0.74, 0.5, 1.16]], 0.1, 6), '#a56c37');
  // steering column and wheel
  part(B, limb([0, 0.62, 0.98], [0, 0.98, 0.84], 0.035, 5, 1), '#5c432d');
  const sw = bone('steer', B, [0, 1.0, 0.82]);
  part(sw, shapes.torus(0.17, 0.035, 3, 9), '#3a3438', { p: [0, 1.0, 0.82], r: [Math.PI / 2 - 0.55, 0, 0] });
  part(sw, box(0.3, 0.035, 0.035), '#3a3438', { p: [0, 1.0, 0.82], r: [-0.55, 0, 0] });

  // Bepi the marmot: round, brown, buck teeth, little round ears
  const d = chibi(r, {
    at: [0, 0.8, 0.46], size: 1.0, fur: '#a8764a', belly: '#e8c897', muzzleColor: '#eed7ac', nose: '#3a2823', inner: '#7a5138',
    head: { r: 0.42, s: [1.12, 0.96, 1] }, torso: { r: 0.27, h: 0.1 },
    eyes: { r: 0.14, gap: 0.2, y: 0.03 }, muzzle: { r: 0.2, s: [1.2, 0.82, 0.8], y: -0.14 }, teeth: true,
    ears: { kind: 'round', r: 0.11, side: 0.76, up: 0.76, out: 0.3 },
    arms: { r: 0.08, grip: [[0.14, 1.01, 0.88], [-0.14, 1.01, 0.88]], hand: '#8d6039' },
  });

  return r.finish({
    driver: d,
    update(m) {
      sw.rotation.y = -m.steer * 0.5;
      // the roof and hay arrive late: a house on wheels has no suspension worth the name
      roof.position.y = roof.userData.rest.y + Math.max(0, -m.vert) * 0.05 + Math.abs(Math.sin(m.dist * 1.7)) * 0.012 * m.sn;
      roof.rotation.z = m.lat * 0.025;
      hay.rotation.z = swing(m, 12, 0.16);
      hay.rotation.x = -m.fwd * 0.2;
      flowers.position.y = flowers.userData.rest.y + Math.sin(m.t * 14) * 0.008 * m.sn;
    },
  });
}
