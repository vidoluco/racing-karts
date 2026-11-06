// A team championship's pennant: on a thin mast at the back corner of each kart racing for a side, flying across the kart above the
// driver's head, so that from behind and from in front it shows whole, a ball on top for the side views. Nobody sees their own: the HUD
// says which side you are on, and a mast in the middle of your own view would only hide the road. Nothing here exists in any other race.
import { teamInfo } from '../data/teams.js';

const CREAM = '#fff6e6', INK = '#2a2230';
const MAST_X = 0.62; // the kart's left, the screen's left from a chase camera

function pennant(THREE, grow, depth) {
  const s = new THREE.Shape(), h = 0.4 * grow, l = 1 * grow, tip = 0.12 * grow;
  s.moveTo(0, h);
  s.lineTo(-l, tip);
  s.quadraticCurveTo(-l - tip * 1.2, 0, -l, -tip);
  s.lineTo(0, -h);
  s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 4 }).translate(0, 0, -depth / 2);
}

function flagGeometry({ THREE, shapes }, color, top) {
  const { cylinder, sphere, place, paint, merge } = shapes;
  return merge([
    paint(place(cylinder(0.04, 0.055, top, 6), { p: [0, top / 2, 0] }), INK),
    paint(place(sphere(0.17, 10, 8), { p: [0, top + 0.1, 0] }), color),
    paint(place(pennant(THREE, 1.2, 0.05), { p: [0.03, top - 0.42, 0] }), CREAM),
    paint(place(pennant(THREE, 0.98, 0.09), { p: [-0.02, top - 0.42, 0] }), color),
  ]);
}

export function createTeamFlags(ctx) {
  const { THREE, mat } = ctx, live = [], box = new THREE.Box3();
  const material = mat('#ffffff', { vertexColors: true, gloss: [30, 0.2] });
  function clear() {
    for (const f of live) { f.mesh.parent?.remove(f.mesh); f.mesh.geometry.dispose(); }
    live.length = 0;
  }
  return {
    // karts: the pool's entries, once their real models are in; players: { team } in the same order
    set(karts, players) {
      clear();
      players.forEach((p, i) => {
        const info = teamInfo(p.team), e = karts[i];
        if (!info || !e) return;
        box.setFromObject(e.model.group);
        // above the driver, but a sail or a funnel does not send it up into the sky
        const top = Math.max(1.75, Math.min(2.55, box.max.y + 0.3)), z = Math.max(-1.5, box.min.z * 0.7);
        const mesh = new THREE.Mesh(flagGeometry(ctx, info.color, top), material);
        mesh.position.set(MAST_X, 0, Number.isFinite(z) ? z : -0.9);
        mesh.frustumCulled = false;
        e.pivot.add(mesh);
        live.push({ mesh, i, phase: i * 1.7, lean: 0, sway: 0 });
      });
    },
    // It leans back with speed and into the turn, and shivers: alive, like everything else on the kart.
    update(K, dt, time) {
      for (const f of live) {
        const k = K[f.i];
        if (!k) continue;
        const a = Math.min(1, dt * 8);
        f.lean += (-Math.min(1, Math.abs(k.speed || 0) / 34) * 0.14 - f.lean) * a;
        f.sway += ((k.steer || 0) * 0.12 - f.sway) * a;
        f.mesh.rotation.x = f.lean;
        f.mesh.rotation.z = f.sway;
        f.mesh.rotation.y = Math.sin(time * 8 + f.phase) * 0.1 * Math.min(1, Math.abs(k.speed || 0) / 12);
      }
    },
    // Per view, just before it draws.
    viewPrepare(me) { for (const f of live) f.mesh.visible = f.i !== me; },
    get count() { return live.length; },
    clear,
  };
}
