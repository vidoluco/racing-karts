// Mocănița: the little steam loco of the Vaser valley, as it stands at Vișeu de Sus: black all over above the running board, boiler, domes,
// cab, tender and the big inverted cone funnel, and red below it, frame, buffer beam and wheels with white rims. The winged logo in white
// on the side and on the back of the tender, a tricolour plate, a round lamp, a stack of wood. Puffs of smoke, rods that really turn.
// Ursu the bear is the engine driver, cap on.
import { createRig, swing } from './_kit.js';
import { chibi } from '../chibi.js';

const BLACK = '#2c2e3a', BLACK_L = '#3b3e4d', RED = '#d13a2d', RED_D = '#a42a20', BRASS = '#e5b23c', WOOD = '#a56f3f', WOOD_L = '#d7ad78';

export function build(ctx) {
  const r = createRig(ctx), { part, bone, wheel, x, shapes, grad } = r, { roundedBox, box, tube, lathe, capsule } = shapes, { ball, wheelGeo, limb, dome, trim, extrude, poly } = x;
  const B = 'body', wR = 0.31, wZ = [0.72, -0.56], opts = { tyre: '#f4efe2', rim: RED, hub: RED_D, rimAt: 0.84, hubAt: 0.28 };
  wZ.forEach((z, i) => {
    wheel(`wF${i}`, [0.7, wR, z], { front: i === 0, geo: wheelGeo(wR, 0.24, { ...opts, side: 1 }) });
    wheel(`wB${i}`, [-0.7, wR, z], { front: i === 0, geo: wheelGeo(wR, 0.24, { ...opts, side: -1 }) });
  });
  // the coupling rods go round with the wheels, their crank pins on the rim
  const rods = [1, -1].map((sx) => {
    const b = bone(sx > 0 ? 'rodL' : 'rodR', 'root', [sx * 0.87, wR, 0.08]);
    part(b, tube([[sx * 0.87, wR, 0.82], [sx * 0.87, wR, -0.66]], 0.035, 4), '#d7dbe2');
    return b;
  });

  // the red frame, the buffer beam, the cow catcher
  part(B, roundedBox(1.2, 0.2, 2.36, 0.07, 1), RED, { p: [0, 0.5, -0.02] }, grad(0.4, 0.6, 0.74));
  part(B, box(1.32, 0.2, 0.14), RED_D, { p: [0, 0.5, 1.2] });
  for (const sx of [1, -1]) part(B, ball(0.1, [1, 1, 0.7], 6, 3), '#d7dbe2', { p: [sx * 0.42, 0.5, 1.3] });
  part(B, extrude([[1.26, 0.42], [1.26, 0.24], [1.5, 0.08], [1.5, 0.14]].reverse(), 0.96), RED, null);

  // the boiler: bands of brass as coloured rings, a smokebox door at the front
  const seg = 14, cy = 1.03, cr = 0.42, z0 = -0.2, z1 = 1.14;
  const run = (color, pts) => part(B, trim(lathe(pts, seg)), color, { p: [0, cy, 0], r: [Math.PI / 2, 0, 0] });
  // the boiler is one long black shape; a pale line where the smokebox starts, only so the eye has something to hold in the shade
  run(BLACK, [[cr, z0], [cr, 0.68]]);
  run('#5b5e6c', [[cr + 0.012, 0.68], [cr + 0.012, 0.72]]);
  run(BLACK_L, [[cr + 0.02, 0.72], [cr + 0.02, 1.08]]);
  run(BLACK, [[cr + 0.02, 1.08], [cr * 0.92, z1 + 0.02], [cr * 0.3, z1 + 0.08], [0, z1 + 0.09]]);
  part(B, roundedBox(0.03, 0.42, 0.03, 0.01, 1), BRASS, { p: [0, cy - 0.05, z1 + 0.09] });
  // the round lamp: a bright eye on top of the smokebox
  part(B, box(0.16, 0.05, 0.16), BLACK, { p: [0, cy + cr * 0.86, z1 - 0.02] });
  part(B, ball(0.12, [1, 1, 0.9], 7, 4), BRASS, { p: [0, cy + cr * 0.86 + 0.13, z1 + 0.0] });
  part(B, dome(0.09, 8, 1, 0.4), [1.5, 1.32, 0.8], { p: [0, cy + cr * 0.86 + 0.13, z1 + 0.09] });

  // the big inverted cone of the spark arrester, a red band
  const fz = 0.86, fy = cy + cr - 0.05;
  const funnel = bone('funnel', B, [0, fy, fz]);
  part(funnel, trim(lathe([[0.15, fy], [0.11, fy + 0.2], [0.14, fy + 0.34]], 12)), BLACK, { p: [0, 0, fz] });
  part(funnel, trim(lathe([[0.14, fy + 0.34], [0.2, fy + 0.5]], 12)), BLACK, { p: [0, 0, fz] });
  part(funnel, trim(lathe([[0.2, fy + 0.5], [0.38, fy + 0.84], [0.39, fy + 0.92], [0.27, fy + 0.94], [0, fy + 0.9]], 12)), BLACK_L, { p: [0, 0, fz] });
  // two domes, black like the rest, a small brass whistle
  for (const [z, h] of [[0.48, 0.26], [0.1, 0.22]]) part(B, trim(lathe([[0.15, cy + cr - 0.03], [0.14, cy + cr + h * 0.55], [0.08, cy + cr + h * 0.92], [0, cy + cr + h]], 10)), BLACK_L, { p: [0, 0, z] });
  part(B, tube([[0, cy + cr + 0.26, 0.48], [0, cy + cr + 0.36, 0.48]], 0.03, 4), BRASS);

  // the logo of the forest railway: two white wings and a chevron between them
  const wings = (wx, wy, wz, ry, s) => {
    const wing = [[0.12, 0.12], [0.95, 0.28], [0.7, 0.08], [0.42, -0.04], [0.14, -0.08]];
    part(B, poly(wing), '#f4f1e8', { p: [wx, wy, wz], r: [0, ry, 0], s: [s, s, 1] });
    part(B, poly(wing.map(([a, c]) => [-a, c]).reverse()), '#f4f1e8', { p: [wx, wy, wz], r: [0, ry, 0], s: [s, s, 1] });
    part(B, poly([[-0.1, 0.16], [0.1, 0.16], [0, -0.2]]), '#f4f1e8', { p: [wx, wy, wz], r: [0, ry, 0], s: [s, s, 1] });
  };
  // side tanks
  for (const sx of [1, -1]) {
    part(B, box(0.24, 0.42, 0.96), BLACK, { p: [sx * 0.5, 0.79, 0.32] }, grad(0.6, 0.98, 0.84));
    // the winged logo, white on black, and the little tricolour under it
    wings(sx * 0.624, 0.86, 0.32, sx * Math.PI / 2, 0.22);
    [['#2a54a8', -0.06], ['#f2c531', 0], ['#d13a2d', 0.06]].forEach(([c, dz]) => part(B, poly([[-0.03, -0.035], [-0.03, 0.035], [0.03, 0.035], [0.03, -0.035]]), c, { p: [sx * 0.624, 0.72, 0.32 + dz * sx], r: [0, sx * Math.PI / 2, 0] }));
  }

  // the cab: black walls low enough to show the bear, posts, an arched roof, oval windows ahead
  const czf = -0.26, czb = -1.0, chw = 0.6, top = 2.1;
  part(B, box(1.24, 0.72, 0.07), BLACK_L, { p: [0, 0.96, czf] });
  for (const sx of [1, -1]) {
    part(B, ball(0.13, [0.9, 1.1, 0.2], 8, 4), '#c8e6ee', { p: [sx * 0.4, 1.12, czf + 0.03] });
    part(B, tube([[sx * chw, 1.3, czf], [sx * (chw - 0.04), top, czf]], 0.045, 5), BLACK);
    part(B, box(0.07, 0.42, 0.78), BLACK, { p: [sx * chw, 0.8, (czf + czb) / 2] }, grad(0.6, 1, 0.84));
    part(B, box(0.08, 0.04, 0.78), RED, { p: [sx * chw, 1.03, (czf + czb) / 2] });
    part(B, tube([[sx * chw, 1.0, czb], [sx * (chw - 0.04), top, czb]], 0.045, 5), BLACK);
  }
  const rw = 1.48, arch = [];
  for (let i = 0; i <= 5; i++) { const a = (i / 5) * Math.PI; arch.push([Math.cos(a) * rw * 0.5, top + Math.sin(a) * 0.22]); }
  for (let i = 5; i >= 0; i--) arch.push([arch[i][0] * 0.96, arch[i][1] - 0.05]);
  part(B, extrude(arch.map(([zz, y]) => [zz, y]).reverse(), 1.06).rotateY(Math.PI / 2), BLACK_L, { p: [0, 0, (czf + czb) / 2 - 0.02] });
  part(B, box(rw + 0.02, 0.05, 1.08), RED, { p: [0, top - 0.04, (czf + czb) / 2 - 0.02] });

  // a stack of wood, cut ends out, for the tender at the very back
  part(B, box(1.12, 0.32, 0.36), BLACK, { p: [0, 0.76, -1.18] }, grad(0.6, 0.92, 0.84));
  part(B, box(1.14, 0.05, 0.38), RED, { p: [0, 0.94, -1.18] });
  wings(0, 0.78, -1.362, Math.PI, 0.3);
  for (const [lx, ly, tone] of [[-0.3, 0, WOOD], [0, 0, '#8f5e34'], [0.3, 0, WOOD], [-0.15, 0.17, '#8f5e34'], [0.15, 0.17, WOOD]]) {
    part(B, tube([[lx, 1.04 + ly, -0.98], [lx, 1.04 + ly, -1.32]], 0.1, 7), tone);
    part(B, x.disc(0.085, 7), WOOD_L, { p: [lx, 1.04 + ly, -1.385], r: [0, Math.PI, 0] });
  }

  // the tricolour on the roof
  const flag = bone('flag', B, [-0.62, top + 0.12, -0.92]);
  part(B, tube([[-0.62, top - 0.02, -0.92], [-0.62, top + 0.55, -0.92]], 0.016, 3), '#d7dbe2');
  [['#2a54a8', 0], ['#f2c531', 0.17], ['#d13a2d', 0.34]].forEach(([c, dz]) => part(flag, box(0.02, 0.26, 0.17), c, { p: [-0.62, top + 0.41, -0.92 - 0.085 - dz] }));

  // the puffs: they rise, grow and go, one after the other
  const puffs = [0, 1].map((i) => {
    const at = [0, fy + 1.0, fz];
    const b = bone(`puff${i}`, B, at);
    part(b, ball(0.22, [1, 0.9, 1], 7, 4), '#fbf7ee', { p: at });
    r.hide(b);
    return b;
  });

  // Ursu: big and brown, the engine driver's cap
  const d = chibi(r, {
    at: [0, 0.62, -0.72], size: 1.0, panTop: 2.42, fur: '#7a5233', belly: '#c49a6c', muzzleColor: '#e4c79c', nose: '#2b2224', inner: '#c49a6c',
    head: { r: 0.42, s: [1.08, 0.98, 1] }, torso: { r: 0.3, h: 0.06 },
    eyes: { r: 0.125, gap: 0.19, y: 0.05 }, muzzle: { r: 0.2, s: [1.12, 0.82, 0.9], y: -0.15 },
    ears: { kind: 'round', r: 0.13, side: 0.78, up: 0.72, out: 0.3 },
    arms: { r: 0.09, grip: [[0.2, 1.05, -0.32], [-0.2, 1.05, -0.32]], hand: '#5e3f27' },
    extra: ({ head, center: c, hr }) => {
      const top2 = c[1] + hr * 0.8;
      part(head, shapes.cylinder(0.3, 0.33, 0.13, 8), '#3e4a68', { p: [c[0], top2, c[2]] });
      part(head, ball(0.32, [1.05, 0.34, 1.05], 8, 4), '#4d5a7c', { p: [c[0], top2 + 0.1, c[2]] });
      part(head, box(0.34, 0.03, 0.16), '#23232e', { p: [c[0], top2 - 0.02, c[2] + 0.34], r: [0.3, 0, 0] });
      part(head, box(0.08, 0.06, 0.02), BRASS, { p: [c[0], top2 + 0.03, c[2] + 0.32] });
    },
  });

    return r.finish({
    driver: d,
    update(m) {
      const a = m.dist / wR;
      rods.forEach((b) => { const q = b.userData.rest; b.position.set(q.x, q.y + Math.cos(a) * 0.13, q.z + Math.sin(a) * 0.13); });
      // a chuff on every half turn: the funnel kicks and a puff leaves
      const chuff = Math.abs(Math.sin(a));
      funnel.scale.set(1 + chuff * 0.03 * m.sn, 1 + chuff * 0.05 * m.sn, 1 + chuff * 0.03 * m.sn);
      puffs.forEach((b, i) => {
        const q = b.userData.rest, f = (m.t * (0.75 + m.sn * 1.1) + i / 2) % 1;
        b.position.set(q.x + Math.sin(f * 7 + i * 2) * 0.1 - m.lat * f * 0.4, q.y + f * (0.6 + Math.min(1, m.sn * 2) * 0.45), q.z - f * (0.2 + m.sn * 1.5));
        b.scale.setScalar(Math.max(0.001, Math.sin(Math.min(1, f * 1.15) * Math.PI) ** 0.7 * (0.75 + f * 1.05)));
      });
      flag.rotation.y = swing(m, 13, 0.4) - m.sn * 0.1;
    },
  });
}
