// The ghost of a time trial: the kart's own model, see-through and pale, with no shadow, smoke or sound, moved by poses the sim
// never hears of. Each view sees only its own driver's ghost, and a ghost right on top of you thins out so that it never hides the road.
//
// A see-through mesh shows its own inside unless its near skin wins, so it is drawn twice: first to depth alone, then in colour.
// Two draw calls a view, and the depth pass gives it the same ink outline as everything else.
import { buildKart } from './models.js';
import { clamp, lerp } from './math.js';

const ALPHA = 0.56, ALPHA_NEAR = 0.3;      // how solid it is on the road ahead, and when it overlaps your own kart
const NEAR = [3.5, 11];                     // m: from fully thin to fully there
const THROUGH = 12;                         // m: nearer than this it shows through what stands in front of it, your own kart above all: you are chasing it, it sits straight ahead of the camera, right behind your kart
const TINT = '#dcefff', GLOW = '#3f7fc0';

export function createGhostPool(scene, ctx) {
  const THREE = ctx.THREE, root = new THREE.Group();
  root.renderOrder = 10;
  scene.add(root);
  const mat = ctx.mat(TINT, { vertexColors: true, transparent: true, opacity: ALPHA, emissive: GLOW, emissiveIntensity: 0.55, rim: [1.1, 1.8], ghost: 1 });
  const depth = ctx.mat('#000000', { vertexColors: true, ghostDepth: 1 });
  depth.colorWrite = false;
  let list = [], token = 0;

  function skin(model) {
    const meshes = [];
    model.group.traverse((m) => { if (m.isMesh) meshes.push(m); });
    for (const m of meshes) {
      const pre = m.isSkinnedMesh ? new THREE.SkinnedMesh(m.geometry, depth) : new THREE.Mesh(m.geometry, depth);
      if (m.isSkinnedMesh) pre.bind(m.skeleton, m.bindMatrix);
      pre.position.copy(m.position); pre.quaternion.copy(m.quaternion); pre.scale.copy(m.scale);
      pre.frustumCulled = m.frustumCulled;
      pre.renderOrder = 9;
      m.parent.add(pre);
      m.material = mat;
      m.renderOrder = 10;
    }
  }

  function clear() {
    for (const g of list) { root.remove(g.pivot); g.model.dispose?.(); }
    list = [];
  }

  return {
    // [{ kart, owner }]: owner is the sim index of the kart whose view sees it. An empty list is every normal race.
    async set(ghosts = []) {
      const mine = ++token;
      clear();
      const built = await Promise.all(ghosts.map((g) => buildKart(g.kart, ctx, TINT)));
      if (mine !== token) { for (const m of built) m.dispose?.(); return; }
      list = built.map((model, n) => {
        skin(model);
        const pivot = new THREE.Group();
        pivot.add(model.group);
        pivot.visible = false;
        root.add(pivot);
        return { pivot, model, owner: ghosts[n].owner, pose: null, shown: false };
      });
    },
    // [{ owner, visible, x, y, z, yaw, pitch, roll, speed, steer, drift, boostT, grounded }]
    pose(poses = []) {
      for (const g of list) g.pose = poses.find((p) => p.owner === g.owner) || null;
    },
    update(dt) {
      for (const g of list) {
        const k = g.pose;
        g.shown = !!k?.visible;
        if (!g.shown) continue;
        g.pivot.position.set(k.x, k.y, k.z);
        g.pivot.rotation.set(-(k.pitch || 0), k.yaw, -(k.roll || 0), 'YXZ');
        const spin = (k.speed || 0) * dt / 0.42;
        for (const w of g.model.wheels || []) {
          w.rotation.x += spin;
          if (w.userData.front) w.rotation.y = lerp(w.rotation.y, -(k.steer || 0) * 0.42, 0.25);
        }
        g.model.update?.(k, dt);
      }
    },
    // Just before a view draws. me: the view's kart, drawn state; nothing outside this view changes.
    viewPrepare(view, me) {
      for (const g of list) {
        const on = g.shown && g.owner === view;
        g.pivot.visible = on;
        if (!on || !me) continue;
        const d = Math.hypot(g.pose.x - me.x, g.pose.z - me.z);
        mat.opacity = lerp(ALPHA_NEAR, ALPHA, clamp((d - NEAR[0]) / (NEAR[1] - NEAR[0]), 0, 1));
        depth.depthFunc = d < THROUGH ? THREE.AlwaysDepth : THREE.LessEqualDepth;
        g.model.viewClose?.(d, false);
      }
    },
    stats() {
      const g = list.find((q) => q.shown) || list[0];
      return { count: list.length, visible: list.filter((q) => q.shown).length, x: g?.pose?.x ?? 0, z: g?.pose?.z ?? 0, opacity: mat.opacity };
    },
    dispose() { clear(); scene.remove(root); },
  };
}
