// Kart and item models. A kart file src/render/karts/<id>.js exports build(ctx) -> KartModel; a missing file falls back to
// a rounded placeholder kart, so nothing ever waits on art. ctx = { THREE, mat, shapes }.
//   KartModel = { group, wheels?: [Object3D], body?, driver?, update?(kartState, dt) }
// group: model facing +z, wheels on the ground (y = 0), about 2.2 m long. The pool moves, rolls, leans and squashes the group from
// the sim; wheels listed here are spun about x and, if their userData.front is true, steered about y. update gets the
// interpolated kart for anything else (smoke, flags, the driver's lean).
import { clamp, lerp, follow } from './math.js';
import { ITEM_IDS } from '../data/items.js';

const kartFile = (id) => import(`./karts/${id}.js`);
const itemFile = (id) => import(`./items/${id}.js`);

// A rounded little go-kart in the player's colour with two big eyes, so an unbuilt kart is still a character.
export function placeholderKart({ THREE, mat, shapes }, color = '#e4553f') {
  const { roundedBox, capsule, cylinder, sphere, place, paint, merge, torus } = shapes, group = new THREE.Group();
  const body = merge([
    paint(place(roundedBox(1.5, 0.5, 2.2, 0.24, 2), { p: [0, 0.48, 0] }), color),
    paint(place(roundedBox(1.1, 0.46, 0.9, 0.22, 2), { p: [0, 0.86, -0.3] }), color),
    paint(place(sphere(0.34, 12, 9), { p: [0, 1.1, -0.16], s: [1, 0.96, 1] }), '#f3e2c0'),
    paint(place(sphere(0.13, 9, 7), { p: [-0.13, 1.17, 0.13] }), '#fbf7ee'),
    paint(place(sphere(0.13, 9, 7), { p: [0.13, 1.17, 0.13] }), '#fbf7ee'),
    paint(place(sphere(0.075, 8, 6), { p: [-0.13, 1.17, 0.21] }), '#1a1820'),
    paint(place(sphere(0.075, 8, 6), { p: [0.13, 1.17, 0.21] }), '#1a1820'),
    paint(place(torus(0.18, 0.04, 6, 12), { p: [0, 0.98, 0.34], r: [1.1, 0, 0] }), '#3a3238'),
    paint(place(roundedBox(1.7, 0.18, 0.5, 0.08, 1), { p: [0, 0.4, 1.14] }), '#f6efd8'),
    paint(place(capsule(0.08, 0.4, 2, 6), { p: [0.46, 0.76, -1.08], r: [Math.PI / 2 - 0.5, 0, 0] }), '#4a4248'),
    paint(place(capsule(0.08, 0.4, 2, 6), { p: [-0.46, 0.76, -1.08], r: [Math.PI / 2 - 0.5, 0, 0] }), '#4a4248'),
  ]);
  const bodyMesh = new THREE.Mesh(body, mat('#ffffff', { vertexColors: true, gloss: [46, 0.22], rim: [0.05, 3] }));
  group.add(bodyMesh);
  const wheelGeo = merge([paint(cylinder(0.42, 0.42, 0.34, 14), '#2a2730'), paint(cylinder(0.2, 0.2, 0.36, 10), '#f2c544')]);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = mat('#ffffff', { vertexColors: true, gloss: [30, 0.1] }), wheels = [];
  for (const [x, z, front] of [[-0.9, 0.78, true], [0.9, 0.78, true], [-0.9, -0.78, false], [0.9, -0.78, false]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(x, 0.42, z); w.userData.front = front;
    group.add(w); wheels.push(w);
  }
  return { group, wheels, body: bodyMesh, placeholder: true };
}

export async function buildKart(id, ctx, color) {
  try {
    const mod = await kartFile(id), build = mod.build || mod.default;
    if (build) return { ...build(ctx), id };
  } catch (e) {
    if (!isMissing(e)) console.warn(`kart ${id}:`, e);
  }
  return { ...placeholderKart(ctx, color), id };
}

// The tossed and dropped things of the items with no shot or spill of their own: seconds before they start, seconds until they go, their size.
const DECOR = { grappa: { wait: 0.75, ttl: 2.2, scale: 0.75 }, zuica: { wait: 0.75, ttl: 2.2, scale: 0.8 }, uova: { wait: 0, ttl: 0.34, scale: 0.9, drop: true } };
const FALLBACK_ITEM = { razzo: '#d9483b', grappa: '#dff1fa', zuica: '#d8a860', mici: '#a0522d', uova: '#f6d14c', polenta: '#f2c544', formaggio: '#f4d783', durian: '#b7a93e', sambal: '#e4331e', rendang: '#b4653a', frana: '#a59d9e' };
export function placeholderItem({ THREE, mat, shapes }, id) {
  const g = shapes.paint(shapes.sphere(0.5, 12, 9), FALLBACK_ITEM[id] || '#ffffff'), group = new THREE.Group();
  group.add(new THREE.Mesh(g, mat('#ffffff', { vertexColors: true, gloss: [40, 0.2] })));
  return { group, placeholder: true };
}
export async function loadItem(id, ctx) {
  try {
    const mod = await itemFile(id), build = mod.build || mod.default;
    if (build) return { ...build(ctx), id };
  } catch (e) {
    if (!isMissing(e)) console.warn(`item ${id}:`, e);
  }
  return { ...placeholderItem(ctx, id), id };
}
const isMissing = (e) => /Could not resolve|Unknown variable|Failed to fetch|Cannot find module|No such|ENOENT|not found/i.test(String(e?.message));

// All the karts of a race. Squash, lean, bump and big are the pool's, whatever the model.
export function createKartPool(scene, ctx, shared) {
  let karts = [], root = new ctx.THREE.Group();
  scene.add(root);
  const THREE = ctx.THREE, itemsCache = new Map();
  const shotGroup = new THREE.Group(), spillGroup = new THREE.Group();
  scene.add(shotGroup, spillGroup);
  const live = new Map();

  function makeEntry(model, i) {
    const pivot = new THREE.Group();
    pivot.add(model.group);
    const flame = flameMesh(THREE, shared);
    pivot.add(flame);
    const glow = glowMesh(THREE);
    pivot.add(glow);
    root.add(pivot);
    return { pivot, model, i, squash: 0, squashV: 0, spin: 0, flame, glow, scale: 1, mici: [] };
  }
  async function set(players) {
    for (const k of karts) { root.remove(k.pivot); k.model.dispose?.(); if (k.stork) scene.remove(k.stork.g); }
    karts = players.map(() => null);
    // placeholders at once, the real ones as their files arrive: a race never waits on a model
    const built = players.map((p, i) => {
      const e = makeEntry(placeholderKart(ctx, p.color), i);
      karts[i] = e;
      return buildKart(p.kart, ctx, p.color).then((model) => {
        root.remove(e.pivot);
        karts[i] = makeEntry(model, i);
      });
    });
    // the item models too: the first rocket of a race must not fly as a placeholder
    await Promise.all([...built, ...ITEM_IDS.map((id) => ensureItem(id).ready)]);
  }
  // What the sim has no object for, because bots would dodge it and a razzo would pop it: the empty bottle thrown over the shoulder after a
  // sip, a plum stone between sips of tuica, the iron pan coming down on the driver's head. Cosmetic, here and nowhere else.
  const decor = [];
  let decorId = 0;
  function onEvent(e) {
    if (e.type === 'itemUse' && DECOR[e.item] && karts[e.kart]) decor.push({ id: decorId++, kind: e.item, kart: e.kart, t: 0, sub: null, ...DECOR[e.item] });
    // the one the pot robbed spins, and licks its lips anyway
    if (e.type === 'hit' && e.cause === 'rendang' && karts[e.kart]?.model.sense) karts[e.kart].model.sense.lickT = 2.6;
    // Baileys snaps round at whoever came too close
    if (e.type === 'bite' && karts[e.kart]?.model.sense) { karts[e.kart].model.sense.biteT = 0.42; karts[e.kart].model.sense.biteSide = e.side; }
    if (e.type === 'land' && karts[e.kart]) karts[e.kart].squashV = -Math.min(7, 2 + (e.force || 1) * 3);
    if (e.type === 'jump' && karts[e.kart]) karts[e.kart].squashV = 4;
    if (e.type === 'bump') { for (const q of [e.a, e.b]) if (karts[q]) karts[q].squashV = -2.2; }
    if (e.type === 'hit' && karts[e.kart]) karts[e.kart].squashV = -5;
  }
  let lastK = null;
  // Per view, just before it draws: what must change for this camera alone. The bones are read at each render, so one view can differ from another.
  function viewPrepare(v) {
    const me = lastK?.[v];
    if (!me) return;
    for (const e of karts) if (e?.model.viewClose && lastK[e.i]) e.model.viewClose(Math.hypot(lastK[e.i].x - me.x, lastK[e.i].z - me.z), e.i === v);
  }
  const nrm = { pitch: 0, roll: 0 };
  function update(K, state, dt, track, terrain, blobs, fx, time) {
    lastK = K;
    for (let i = 0; i < karts.length && i < K.length; i++) {
      const e = karts[i], k = K[i];
      if (!e) continue;
      rescuer(e, k, dt);
      const p = e.pivot, tipsy = k.tipsyT > 0 ? Math.sin(time * 7 + i) * 0.11 : 0;
      p.position.set(k.x, k.y, k.z);
      // drive lean: the body leans out of a turn at speed
      const lean = clamp((k.steer || 0) * Math.min(1, (k.speed || 0) / 22), -1, 1) * (k.drift ? 0.2 : 0.09);
      p.rotation.set(-(k.pitch || 0), k.yaw + tipsy, -(k.roll || 0) + lean, 'YXZ');
      // squash and stretch as a spring: landings squash, jumps stretch
      e.squashV += (-e.squash * 62 - e.squashV * 7.5) * dt;
      e.squash += e.squashV * dt;
      const big = k.bigT > 0 ? 1.6 : 1;
      e.scale = lerp(e.scale, big, follow(8, dt));
      const sq = clamp(e.squash, -0.4, 0.4), sy = e.scale * (1 + sq), sxz = e.scale * (1 - sq * 0.6);
      p.scale.set(sxz, sy, sxz);
      const w = e.model.wheels || [], sp = (k.speed || 0) * dt / 0.42 * (k.vx * Math.sin(k.yaw) + k.vz * Math.cos(k.yaw) >= 0 ? 1 : -1);
      for (const wh of w) {
        wh.rotation.x += sp;
        if (wh.userData.front) wh.rotation.y = lerp(wh.rotation.y, -(k.steer || 0) * 0.42, follow(14, dt));
      }
      e.model.update?.(k, dt);
      // the flames and the gold glow of the iron pan
      const boosting = k.boostT > 0;
      e.flame.visible = boosting;
      if (boosting) { const f = 0.85 + 0.3 * Math.sin(time * 41 + i) + 0.2 * Math.sin(time * 67 + i * 3); e.flame.scale.set(0.75 + 0.2 * f, 0.75 + 0.2 * f, f * (k.boostKind === 'pad' ? 1 : 1.25)); }
      e.glow.visible = k.bigT > 0;
      // blob shadow on the road under it, lower and wider the higher it flies
      const fi = k.u * track.n, g = Math.abs(k.d) < track.samples.w[Math.round(fi) % track.n] / 2 + 2 ? track.heightAt(fi, k.d) : terrain.heightAt(k.x, k.z);
      const ground = k.shortcut >= 0 ? terrain.heightAt(k.x, k.z) + 0.16 : Math.abs(k.y - g) < 8 ? g : terrain.heightAt(k.x, k.z) + 0.16;
      const air = clamp((k.y - ground) / 6, 0, 1), sw = 2.9 * (1 + air * 0.4) * e.scale * (blobs.kartScale ?? 1);
      nrm.pitch = 0; nrm.roll = 0;
      blobs.set(i, k.x, ground + 0.05, k.z, k.yaw, sw, sw * 1.28, nrm);
    }
    let nBlobs = Math.min(karts.length, K.length);
    // look.shotShadow (default none): a cheese rolling down the road has its shadow under it, or it hangs in the air
    if (blobs.shotShadow) for (const s of state.shots || []) if (s.kind === 'formaggio' && !s.lob && nBlobs < blobs.mesh.instanceMatrix.count) { nrm.pitch = 0; nrm.roll = 0; blobs.set(nBlobs++, s.x, s.y - 1.15, s.z, s.yaw || 0, 3.4, 3.4, nrm); }
    blobs.commit(nBlobs);
    updateObjects(state, dt, time);
  }

  // A stork fetches a kart that left the road: it lands, carries it in its beak and goes. One lazily built per kart that needs it.
  let storkGeo = null;
  function rescuer(e, k, dt) {
    if (!(k.rescueT > 0) && !e.stork) return;
    if (!e.stork) {
      if (!storkGeo) storkGeo = storkParts(ctx);
      const g = new THREE.Group(), material = ctx.mat('#ffffff', { vertexColors: true, gloss: [40, 0.14] });
      const body = new THREE.Mesh(storkGeo.body, material), L = new THREE.Mesh(storkGeo.wing, material), R = new THREE.Mesh(storkGeo.wing, material);
      L.position.set(0.5, 1.3, 0); R.position.set(-0.5, 1.3, 0); R.scale.x = -1;
      g.add(body, L, R);
      e.stork = { g, L, R, t: 0 };
      scene.add(g);
    }
    const on = k.rescueT > 0, S = e.stork;
    S.g.visible = on;
    if (!on) return;
    S.t += dt;
    S.g.position.set(k.x, k.y + 1.5, k.z);
    S.g.rotation.y = k.yaw;
    const f = Math.sin(S.t * 15) * 0.8;
    S.L.rotation.z = f; S.R.rotation.z = -f;
  }

  // Shots and spills: a clone of the item's model per live one, kept while its id lives.
  function ensureItem(id) {
    let c = itemsCache.get(id);
    if (!c) {
      c = { model: placeholderItem(ctx, id) };
      itemsCache.set(id, c);
      c.ready = loadItem(id, ctx).then((m) => { c.model = m; });
    }
    return c;
  }
  const seen = new Set();
  function updateObjects(state, dt, time) {
    seen.clear();
    const place = (o, kind, parent, tag) => {
      const key = `${tag}${o.id}`;
      seen.add(key);
      let e = live.get(key);
      if (!e) {
        const c = ensureItem(kind), g = c.model.group.clone();
        parent.add(g);
        e = { g, model: c.model, parent };
        live.set(key, e);
      }
      return e;
    };
    for (const s of state.shots || []) {
      const e = place(s, s.kind, shotGroup, 's');
      e.g.position.set(s.x, s.y, s.z);
      e.g.rotation.set(0, s.yaw, 0);
      if (s.kind === 'formaggio') e.g.rotation.x = time * 8 * (s.dir ?? 1);
      // thrown things are small in the air, whatever they become on the road
      if (s.lob) { e.g.scale.setScalar(s.kind === 'polenta' ? 0.55 : 0.9); e.g.rotation.x = time * 7; }
      e.model.update?.(e.g, s, dt);
    }
    for (const s of state.spills || []) {
      const e = place(s, s.kind, spillGroup, 'p');
      e.g.position.set(s.x, s.y + 0.08, s.z);
      const r = (s.r || 3) / 2;
      if (s.kind === 'frana') e.g.scale.setScalar(s.r * 0.9);
      else e.g.scale.set(r, s.kind === 'durian' ? r : Math.min(r, 1), r);
      e.model.update?.(e.g, s, dt);
    }
    updateDecor(place, dt);
    for (const [key, e] of live) if (!seen.has(key)) { e.parent.remove(e.g); live.delete(key); }
  }
  function updateDecor(place, dt) {
    for (let i = decor.length - 1; i >= 0; i--) {
      const d = decor[i], k = lastK?.[d.kart];
      d.t += dt;
      if (!k || d.t >= d.ttl) { decor.splice(i, 1); continue; }
      if (d.sub === null) d.sub = d.kind === 'zuica' && k.itemCharges > 0 ? 'plum' : 'bottle';
      // it starts when the sip is over; until then, nothing to see
      if (d.t < d.wait) continue;
      if (d.drop) {
        // the pan falls on the head and stays with the kart: the model's own pan takes over where this one lands
        const q = (d.t - d.wait) / (d.ttl - d.wait), e = place(d, d.kind, shotGroup, 'd');
        e.g.position.set(k.x, k.y + 2.6 + (1 - q * q) * 5, k.z);
        e.g.rotation.set(-0.5, k.yaw + q * 6, 0);
        e.g.scale.setScalar(0.9);
        e.model.update?.(e.g, d, dt);
        continue;
      }
      if (d.vy === undefined) {
        const fx = Math.sin(k.yaw), fz = Math.cos(k.yaw);
        d.x = k.x; d.y = k.y + 1.9; d.z = k.z; d.floor = k.y + 0.2;
        d.vx = k.vx * 0.82 - fx * 3 + fz * 1.6; d.vz = k.vz * 0.82 - fz * 3 - fx * 1.6; d.vy = 6.5; d.spin = 10 + d.id % 5;
      }
      d.x += d.vx * dt; d.z += d.vz * dt; d.y += d.vy * dt; d.vy -= 17 * dt;
      if (d.y < d.floor) { d.y = d.floor; d.vy = Math.abs(d.vy) * 0.42; d.vx *= 0.7; d.vz *= 0.7; }
      const e = place(d, d.kind, shotGroup, 'd');
      e.g.position.set(d.x, d.y, d.z);
      e.g.rotation.set((d.t - d.wait) * d.spin, d.id, 0.4);
      e.g.scale.setScalar(d.scale * Math.min(1, (d.ttl - d.t) * 5));
      e.model.update?.(e.g, d, dt);
    }
  }
  return { set, update, onEvent, viewPrepare, dispose() { scene.remove(root, shotGroup, spillGroup); }, get karts() { return karts; } };
}

function storkParts({ shapes }) {
  const { sphere, capsule, cone, paint, place, merge, roundedBox } = shapes;
  return {
    body: merge([
      paint(place(sphere(0.62, 12, 9), { p: [0, 1.25, 0], s: [0.86, 0.9, 1.25] }), '#f7f3ea'),
      paint(place(capsule(0.17, 0.5, 2, 8), { p: [0, 1.82, 0.5], r: [0.5, 0, 0] }), '#f7f3ea'),
      paint(place(sphere(0.28, 10, 8), { p: [0, 2.2, 0.68] }), '#f7f3ea'),
      paint(place(cone(0.11, 0.8, 8), { p: [0, 2.14, 1.18], r: [Math.PI / 2 + 0.2, 0, 0] }), '#ef7a2a'),
      paint(place(sphere(0.085, 8, 6), { p: [0.2, 2.3, 0.84] }), '#1a1820'),
      paint(place(sphere(0.085, 8, 6), { p: [-0.2, 2.3, 0.84] }), '#1a1820'),
      paint(place(capsule(0.05, 0.8, 1, 5), { p: [0.2, 0.5, -0.1] }), '#ef7a2a'),
      paint(place(capsule(0.05, 0.8, 1, 5), { p: [-0.2, 0.5, -0.1] }), '#ef7a2a'),
    ]),
    wing: merge([
      paint(place(roundedBox(1.5, 0.12, 0.74, 0.05, 1), { p: [0.75, 0, 0] }), '#f7f3ea'),
      paint(place(roundedBox(0.5, 0.13, 0.76, 0.05, 1), { p: [1.34, 0, 0] }), '#232026'),
    ]),
  };
}

function flameMesh(THREE, shared) {
  // a long closed teardrop: additive and fading towards its tail, so it has no hard end to see
  const g = new THREE.SphereGeometry(0.36, 12, 10).scale(1, 1, 3).translate(0, 0.55, -2.0);
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: shared.time },
    vertexShader: 'varying vec3 vP; varying vec3 vN; void main(){ vP = position; vN = normalMatrix * normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`uniform float uTime; varying vec3 vP; varying vec3 vN;
      void main(){ float t = clamp((vP.z + 3.05) / 2.1, 0.0, 1.0); float f = 0.6 + 0.4 * sin(vP.z * 9.0 + uTime * 42.0);
        vec3 c = mix(vec3(1.5, 0.42, 0.06), vec3(1.7, 1.2, 0.4), t * t);
        gl_FragColor = vec4(c * (0.5 + 0.5 * f) * t * t, 1.0); }`,
  });
  const out = new THREE.Mesh(g, m);
  out.frustumCulled = false; out.visible = false; out.renderOrder = 6;
  return out;
}
function glowMesh(THREE) {
  const g = new THREE.SphereGeometry(1.6, 16, 12);
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying vec3 vN; varying vec3 vV; void main(){ float d = abs(dot(vN, vV)); gl_FragColor = vec4(vec3(1.5, 1.05, 0.28) * pow(d, 3.0), 1.0); }',
  });
  const out = new THREE.Mesh(g, m);
  out.position.y = 0.8; out.frustumCulled = false; out.visible = false; out.renderOrder = 6;
  return out;
}
