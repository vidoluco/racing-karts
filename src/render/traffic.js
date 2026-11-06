// Draws a city's traffic. The sim says where every vehicle is at any time; this asks only about the road near each view, once per
// view per frame, and fills one instanced mesh per kind, near and far. So the count on the lap, in the thousands, costs nothing here.
import * as THREE from 'three';
import { createTraffic, crossingState, forEachVehicle, VEHICLES, slotHash } from '../sim/traffic.js';
import { VEHICLE_MODELS, commuterTrain, bucharestTram } from './vehicles.js';
import { createBlobs } from './fx.js';
import { linear } from './math.js';

// m: where a vehicle swaps to its simple body, by weight, and where traffic stops being drawn. A bike has a middle step, because there are hundreds of them
const NEAR = [24, 36, 52], MID = 58, FAR = 430;
const NEAR_CAP = { motor: 18, ojek: 9 }, NEAR_CAP_DEF = 8, MID_CAP = 190, FAR_CAP = { bike: 1500, other: 300 }, SHADOWS = 620;
const CLEAR_AHEAD = 8.5;                // m ahead of a camera kept clear of vehicles, just past where the chase camera has its kart
const PART_D = 130, PART_MAX = 1.1;    // m: within this of a camera vehicles that overlap are drawn apart, by no more than this; the sim's own place stays what counts
const RANGE_EVERY = 12;                // frames between looks at which stretches of road are near this view
const COARSE = 16;                     // samples between those looks' stops

const pool = [], closeBy = [], byF = (a, b) => a.f - b.f, WEIGHT = [1, 0.18, 0];
const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(0, 0, 0, 'YXZ'), V3 = new THREE.Vector3(), S3 = new THREE.Vector3(), C = new THREE.Color();

export function createTrafficWorld({ track, mat, scene, shadowTint = null }) {
  const T = createTraffic(track);
  if (!T) return null;
  // the instance's tint goes only on what is painted white, so that glass, tyres and riders keep their own colours on a red bus or a black car
  const material = mat('#ffffff', { vertexColors: true, code: { key: 'tint-white', vmain: 'vColor.rgb = color.rgb * mix(vec3(1.0), instanceColor.rgb, smoothstep(0.62, 0.95, min(color.r, min(color.g, color.b))));' } });
  const kinds = {}, meshes = [];
  const lightGeo = new THREE.SphereGeometry(0.13, 10, 6), lightMat = new THREE.MeshBasicMaterial({ color: '#ff3a26' });
  const BRAKES = 160, brake = new THREE.InstancedMesh(lightGeo, lightMat, BRAKES);
  brake.frustumCulled = false; brake.count = 0; brake.visible = false; brake.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(brake);
  const shadow = createBlobs(SHADOWS);
  if (shadowTint) shadow.mesh.material.uniforms.uC.value.set(...shadowTint); // a night road: the pink of the day's blob would glow on it
  shadow.mesh.visible = false;
  scene.add(shadow.mesh);
  const farGeos = new Map(), midGeos = new Map();
  const make = (geo, cap) => {
    const m = new THREE.InstancedMesh(geo, material, cap);
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.instanceColor.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false; m.count = 0; m.visible = false;
    scene.add(m); meshes.push(m);
    return m;
  };
  const used = new Set();
  for (const st of T.streams) for (const q of st.kinds) used.add(q);
  for (const q of used) {
    const def = VEHICLE_MODELS[q], key = def.far;
    if (!farGeos.has(key)) farGeos.set(key, { geo: def.far(), mesh: null, n: 0 });
    const farEntry = farGeos.get(key);
    if (!farEntry.mesh) { farEntry.cap = VEHICLES[q].heavy === 0 && def.mid ? FAR_CAP.bike : FAR_CAP.other; farEntry.mesh = make(farEntry.geo, farEntry.cap); }
    let midEntry = null;
    if (def.mid) {
      if (!midGeos.has(def.mid)) { const geo = def.mid(); midGeos.set(def.mid, { geo, mesh: make(geo, MID_CAP), n: 0, cap: MID_CAP }); }
      midEntry = midGeos.get(def.mid);
    }
    const nearCap = NEAR_CAP[q] || NEAR_CAP_DEF;
    kinds[q] = { near: make(def.near(), nearCap), nearCap, mid: midEntry, far: farEntry, nearN: 0, nearD: VEHICLES[q].load ? 20 : NEAR[VEHICLES[q].heavy], tints: def.tints.map((c) => linear(c)), spec: VEHICLES[q] };
  }
  const S = track.samples;
  const rangesOf = new Map();
  const rail = createRail({ T, track, material: mat('#ffffff', { vertexColors: true }), scene });
  const weather = track.def.traffic.rain ? createRain(scene) : null;
  const bubbles = createBubbles(scene);

  // Stretches of road in reach of a camera, as [f0, f1] pairs: more than one where a road passes under another.
  function ranges(cam, key, frame) {
    let r = rangesOf.get(key);
    if (r && frame - r.at < RANGE_EVERY) return r.list;
    if (!r) rangesOf.set(key, (r = { at: 0, list: [] }));
    r.at = frame; r.list.length = 0;
    const lim = (FAR + 60) ** 2;
    let a = -1;
    for (let i = 0; i < T.n; i += COARSE) {
      const dx = S.x[i] - cam.x, dz = S.z[i] - cam.z, inside = dx * dx + dz * dz < lim;
      if (inside && a < 0) a = i;
      if (!inside && a >= 0) { r.list.push(a - COARSE, i); a = -1; }
    }
    if (a >= 0) r.list.push(a - COARSE, T.n - 1);
    return r.list;
  }

  // Everything for one view into the instance buffers. Called just before that view renders.
  function prepare(key, camera, t, frame, knocked, rain = 0) {
    rail.update(camera, t);
    weather?.update(camera, t, rain);
    for (const q in kinds) kinds[q].nearN = 0;
    for (const e of farGeos.values()) e.n = 0;
    for (const e of midGeos.values()) e.n = 0;
    let lights = 0, shadows = 0;
    const cam = camera.position, fx = -camera.matrixWorld.elements[8], fz = -camera.matrixWorld.elements[10], fl = Math.hypot(fx, fz) || 1, nx = fx / fl, nz = fz / fl;
    const list = ranges(cam, key, frame);
    syncKnocked(T, knocked);
    let count = 0;
    for (let r = 0; r < list.length; r += 2) {
      forEachVehicle(T, Math.max(0, list[r]), list[r + 1], t, (e) => {
        const i = Math.min(T.n - 2, Math.max(0, Math.floor(e.f))), a = e.f - i, j = i + 1;
        const sx = S.x[i] + (S.x[j] - S.x[i]) * a, sz = S.z[i] + (S.z[j] - S.z[i]) * a;
        const px = S.nx[i], pz = S.nz[i], x = sx + px * e.d, z = sz + pz * e.d, dx = x - cam.x, dz = z - cam.z, d2 = dx * dx + dz * dz;
        if (d2 > FAR * FAR) return;
        const along = dx * nx + dz * nz;
        // behind the camera, or far to its side: not drawn
        if (along < -8 || (d2 > 2500 && along * along < d2 * 0.42)) return;
        // a vehicle coming on or off the end of a lane grows in the sim; a third-size scooter in plain sight is worse than one that appears
        if (e.scale < 0.72) return;
        const K = kinds[e.kind];
        // anything that would stand between this view's camera and its kart is not drawn: the road ahead is what you are racing on
        if (along - K.spec.len / 2 < CLEAR_AHEAD && along + K.spec.len / 2 > 0) {
          const lat = Math.abs(-dx * nz + dz * nx);
          if (lat - K.spec.wid / 2 < [0.55, 1, 1.9][K.spec.heavy] + Math.max(0, along - K.spec.len / 2) * 0.36) return;
        }
        // the callback's object is reused by the sim, so what is needed later goes in the pool
        let it = pool[count];
        if (!it) it = pool[count] = {};
        count++;
        it.f = e.f; it.d = e.d; it.i = i; it.a = a; it.d2 = d2; it.along = along; it.K = K; it.id = e.id; it.stream = e.stream; it.scale = e.scale; it.knock = e.knock || null; it.knockA = e.knockA; it.rate = e.rate; it.part = 0;
      }, T.streams);
    }
    // Road a dense queue has bikes on bikes. The sim is a pure function of time and stays so: only what is drawn near the camera moves aside, a bike the most and a bus not at all.
    let near = 0;
    for (let q = 0; q < count; q++) { const it = pool[q]; if (it.d2 < PART_D * PART_D && !it.knock) closeBy[near++] = it; }
    closeBy.length = near;
    closeBy.sort(byF);
    for (let pass = 0; pass < 2; pass++) {
      for (let p = 0; p < near; p++) {
        const A = closeBy[p], la = A.K.spec.len;
        for (let q = p + 1; q < near; q++) {
          const B = closeBy[q], df = (B.f - A.f) * T.step, reach = (la + B.K.spec.len) / 2 + 0.25;
          if (df > reach) break;
          const lat = (B.d + B.part) - (A.d + A.part), room = (A.K.spec.wid + B.K.spec.wid) / 2 + 0.12, over = room - Math.abs(lat);
          if (over <= 0) continue;
          const wa = WEIGHT[A.K.spec.heavy], wb = WEIGHT[B.K.spec.heavy], sum = wa + wb;
          if (!sum) continue;
          const sign = lat !== 0 ? Math.sign(lat) : (A.id & 1 ? 1 : -1);
          A.part = Math.max(-PART_MAX, Math.min(PART_MAX, A.part - sign * over * wa / sum));
          B.part = Math.max(-PART_MAX, Math.min(PART_MAX, B.part + sign * over * wb / sum));
        }
      }
    }
    for (let q = 0; q < count; q++) {
      const e = pool[q], { i, a, K, id, along } = e, j = i + 1, d = e.d + e.part;
      const tx = S.tx[i] + (S.tx[j] - S.tx[i]) * a, tz = S.tz[i] + (S.tz[j] - S.tz[i]) * a, sx = S.x[i] + (S.x[j] - S.x[i]) * a, sz = S.z[i] + (S.z[j] - S.z[i]) * a;
      const x = sx + S.nx[i] * d, z = sz + S.nz[i] * d, dx = x - cam.x, dz = z - cam.z, d2 = dx * dx + dz * dz;
      const y0 = track.heightAt(e.f, d) + e.stream.lift, near2 = d2 < K.nearD * K.nearD;
      let y = y0, yaw = Math.atan2(tx, tz) + (e.stream.dir < 0 ? Math.PI : 0), roll = 0;
      const light = K.spec.heavy === 0;
      // bikes lean into their wandering, and everything sways a little
      const wob = slotHash(id, 3.3) * 40;
      if (light) { roll = Math.sin(t * 1.3 + wob) * 0.11; yaw += Math.sin(t * 1.3 + wob + 1.2) * 0.07; } else if (near2) { roll = Math.sin(t * 2.1 + wob) * 0.012; y += Math.abs(Math.sin(t * 3.3 + wob)) * 0.02; }
      if (e.knock) {
        const qa = e.knockA, H = e.knock.hop;
        y += H * Math.sin(Math.min(1, qa * 3) * Math.PI);
        yaw += e.knock.spin * Math.sin(qa * Math.PI) * 2.6;
        roll += e.knock.spin ? e.knock.spin * Math.sin(qa * Math.PI * 2) * 0.5 : 0.08 * Math.sin(qa * 14);
      }
      let sc = e.scale;
      // a bike passing right by the camera would fill the screen: it ducks out of the picture as it goes by
      if (light && along < 6.5) { const lat = Math.abs(-dx * nz + dz * nx); if (lat < 3.2) { sc *= Math.max(0, Math.min(1, along - 5.5)); if (sc < 0.6) continue; } }
      E.set(0, yaw, roll);
      Q.setFromEuler(E);
      M.compose(V3.set(x, y, z), Q, S3.set(sc, sc, sc));
      const tint = K.tints[Math.floor(slotHash(id, e.stream.seed) * K.tints.length) % K.tints.length];
      let target = null, n = 0;
      if (near2 && K.nearN < K.nearCap) { target = K.near; n = K.nearN++; } else if (K.mid && d2 < MID * MID && K.mid.n < K.mid.cap) { target = K.mid.mesh; n = K.mid.n++; } else if (K.far.n < K.far.cap) { target = K.far.mesh; n = K.far.n++; }
      if (!target) continue;
      M.toArray(target.instanceMatrix.array, n * 16);
      target.instanceColor.array[n * 3] = tint[0]; target.instanceColor.array[n * 3 + 1] = tint[1]; target.instanceColor.array[n * 3 + 2] = tint[2];
      if (shadows < SHADOWS && d2 < 240 * 240) {
        const sp = K.spec;
        shadow.set(shadows++, x, y0 + 0.08, z, yaw, sp.wid * 1.5, sp.len * 1.28);
      }
      // brake lights: the wave of red that runs up a queue
      if (near2 && K.spec.heavy > 0 && e.rate < 0.72 && e.stream.dir > 0) {
        const cy = Math.cos(yaw), sy = Math.sin(yaw), back = K.spec.len / 2 + 0.05, up = K.spec.heavy === 2 ? 1 : 0.8, wide = K.spec.wid * 0.36;
        for (const s of [-1, 1]) {
          if (lights >= BRAKES) break;
          M.makeTranslation(x - sy * back + cy * wide * s, y + up, z - cy * back - sy * wide * s);
          brake.setMatrixAt(lights++, M);
        }
      }
    }
    for (const q in kinds) {
      const m = kinds[q].near;
      m.count = kinds[q].nearN; m.visible = m.count > 0;
      if (m.count) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
    }
    for (const e of [...farGeos.values(), ...midGeos.values()]) {
      e.mesh.count = e.n; e.mesh.visible = e.n > 0;
      if (e.n) { e.mesh.instanceMatrix.needsUpdate = true; e.mesh.instanceColor.needsUpdate = true; }
    }
    brake.count = lights; brake.visible = lights > 0; if (lights) brake.instanceMatrix.needsUpdate = true;
    shadow.commit(shadows); shadow.mesh.visible = shadows > 0;
  }

  function hide() {
    for (const m of meshes) m.visible = false;
    brake.visible = false; shadow.mesh.visible = false;
    rail.hide(); weather?.hide();
  }

  // A horn gets a word over it, a knock gets its stars. Called once per event; the words fade on their own clock.
  function onEvent(e, fx) {
    if (e.type === 'honk') { if (e.word) bubbles.say(e); } else if (e.type === 'traffic') {
      if (e.kind === 'nudge' || e.kind === 'part') return;
      // stars are for a real crash: a scattered bike throws its load about, in the load's own colour
      if (e.kind === 'crash') fx.pof(e.x, e.y + 0.8, e.z, 3);
      if (e.kind === 'scatter') fx.sparks(e.x, e.y + 1, e.z, 14, VEHICLES[e.veh]?.load || '#e9e4da', 7);
      else if (e.kind !== 'plow') fx.sparks(e.x, e.y + 0.6, e.z, e.kind === 'crash' ? 22 : 10, '#ffd06a');
    }
  }

  function dispose() {
    rail.dispose(); weather?.dispose(); bubbles.dispose();
    for (const m of meshes) { scene.remove(m); m.dispose(); }
    for (const q in kinds) kinds[q].near.geometry.dispose();
    for (const e of [...farGeos.values(), ...midGeos.values()]) e.geo.dispose();
    scene.remove(brake, shadow.mesh); brake.dispose(); shadow.mesh.dispose();
    lightGeo.dispose(); lightMat.dispose();
  }

  return { T, prepare, hide, onEvent, update: (dt, cam) => bubbles.update(dt), dispose };
}

// The renderer keeps its own copy of the traffic: only the knocked list has to come over from the state.
function syncKnocked(T, list) {
  T.knocked.clear();
  if (!list) return;
  for (const q of list) T.knocked.set(q.stream * 1e6 + q.id, q);
}

// ---------- the railway ----------
// The train across the road and its gates obey the sim's crossingState; a second one rolls over the viaduct for show, on its own clock.
function createRail({ T, track, material, scene }) {
  const S = track.samples, def = track.def.traffic, parts = [];
  const add = (mesh) => { mesh.frustumCulled = false; mesh.visible = false; scene.add(mesh); parts.push(mesh); return mesh; };
  const trainGeo = def.train === 'tram' ? bucharestTram() : commuterTrain(), crossings = [];
  const flash = new THREE.MeshBasicMaterial({ color: '#ff2a18' });
  const lampGeo = new THREE.SphereGeometry(0.34, 8, 6);
  const armGeo = new THREE.BoxGeometry(1, 0.22, 0.14); armGeo.translate(0.5, 0, 0);
  const armMat = new THREE.MeshBasicMaterial({ color: '#ffffff', vertexColors: true });
  // red and white bands along the barrier arm
  {
    const pos = armGeo.attributes.position, col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) { const c = pos.getX(i) > 0.5 ? [0.85, 0.12, 0.08] : [0.95, 0.95, 0.95]; col.set(c, i * 3); }
    armGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  for (const c of T.crossings) {
    const i = Math.round(c.f), nx = S.nx[i], nz = S.nz[i], yaw = Math.atan2(nx, nz);
    const q = { c, x: S.x[i], y: S.y[i], z: S.z[i], nx, nz, yaw, tx: S.tx[i], tz: S.tz[i] };
    q.train = add(new THREE.Mesh(trainGeo, material));
    q.arms = add(new THREE.InstancedMesh(armGeo, armMat, 4)); q.arms.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    q.lamps = add(new THREE.InstancedMesh(lampGeo, flash, 8)); q.lamps.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    crossings.push(q);
  }
  const shows = (def.showTrains || []).map((r) => {
    const m = atMetresRender(track, r.at), i = Math.round(m / track.step);
    return { r, x: S.x[i], z: S.z[i], nx: S.nx[i], nz: S.nz[i], y: r.y, mesh: add(new THREE.Mesh(trainGeo, material)) };
  });
  const W = new THREE.Matrix4(), Qa = new THREE.Quaternion(), Vp = new THREE.Vector3(), Vs = new THREE.Vector3(), Ey = new THREE.Euler(0, 0, 0, 'YXZ');
  const HALF_LEN = 36, SPEED_MIN = 22, GATE_D = [-1, 1];

  function update(camera, t) {
    const cam = camera.position;
    for (const q of crossings) {
      const near = (q.x - cam.x) ** 2 + (q.z - cam.z) ** 2 < 620 * 620;
      q.arms.visible = near;
      if (!near) { q.train.visible = false; q.lamps.visible = false; continue; }
      const st = crossingState(q.c, t), c = q.c, run = c.half + HALF_LEN + 2, v = Math.max(SPEED_MIN, (2 * run) / c.pass);
      // the train's nose comes from far off during the warning and leaves the same way after the pass
      let along = null;
      if (st.phase === 'warn') along = -run - v * (c.warn * (1 - st.a));
      else if (st.phase === 'pass') along = -run + 2 * run * st.a;
      else {
        const after = (((t / c.period + c.phase) % 1 + 1) % 1) * c.period - c.warn - c.pass;
        if (after < 12) along = run + v * after;
      }
      q.train.visible = along != null;
      if (along != null) { q.train.position.set(q.x + q.nx * along, q.y, q.z + q.nz * along); q.train.rotation.y = q.yaw; q.train.updateMatrixWorld(); }
      // arm down during warn and pass
      const down = st.phase === 'warn' ? Math.min(1, st.a * 2.5) : st.phase === 'pass' ? 1 : Math.max(0, 1 - (((t / c.period + c.phase) % 1 + 1) % 1 * c.period - c.warn - c.pass) / 1.4);
      const halfRoad = S.w[Math.round(c.f)] / 2 + 1.2, bl = halfRoad - 0.6;
      let n = 0, lamps = 0;
      for (const s of GATE_D) for (const a of GATE_D) {
        // posts at each road edge, one pair each side of the rails
        const px = q.x + q.tx * s * c.half + q.nx * a * halfRoad, pz = q.z + q.tz * s * c.half + q.nz * a * halfRoad;
        Ey.set(0, q.yaw - Math.PI / 2 + (a > 0 ? Math.PI : 0), (Math.PI / 2 - 0.02) * (1 - down));
        Qa.setFromEuler(Ey);
        W.compose(Vp.set(px, q.y + 1.3, pz), Qa, Vs.set(bl, 1, 1));
        q.arms.setMatrixAt(n++, W);
        if (st.phase !== 'quiet') {
          const on = Math.floor(t * 3) % 2 ? 1 : -1;
          W.makeTranslation(px + q.tx * on * 0.55, q.y + 3.2, pz + q.tz * on * 0.55);
          q.lamps.setMatrixAt(lamps++, W);
        }
      }
      q.arms.count = n; q.arms.instanceMatrix.needsUpdate = true;
      q.lamps.count = lamps; q.lamps.visible = lamps > 0; q.lamps.instanceMatrix.needsUpdate = true;
    }
    for (const q of shows) {
      const near = (q.x - cam.x) ** 2 + (q.z - cam.z) ** 2 < 800 * 800, p = ((t / q.r.period + (q.r.phase || 0)) % 1 + 1) % 1, reach = q.r.reach;
      const along = (p * 2 - 1) * (reach + 80);
      q.mesh.visible = near && Math.abs(along) < reach + 60;
      if (q.mesh.visible) { q.mesh.position.set(q.x + q.nx * along, q.y, q.z + q.nz * along); q.mesh.rotation.y = Math.atan2(q.nx, q.nz); q.mesh.updateMatrixWorld(); }
    }
  }
  return {
    update,
    hide() { for (const m of parts) m.visible = false; },
    dispose() {
      for (const m of parts) { scene.remove(m); m.dispose?.(); }
      trainGeo.dispose(); armGeo.dispose(); lampGeo.dispose(); flash.dispose(); armMat.dispose();
    },
  };
}
const atMetresRender = (track, at) => (Array.isArray(at) ? track.pointU[track.def.marks[at[0]]] * track.length + (at[1] || 0) : at * track.length);

// ---------- rain ----------
// Streaks in a box that wraps round the camera, all moved in the vertex shader, and a veil over the whole view for the grey. Two draws, and none when it is dry.
function createRain(scene) {
  const N = 1500, BOX = 46, H = 26, pos = new Float32Array(N * 6), end = new Float32Array(N * 2), rng = (i, k) => { const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };
  for (let i = 0; i < N; i++) {
    const x = rng(i, 1) * BOX, y = rng(i, 2) * H, z = rng(i, 3) * BOX;
    pos.set([x, y, z, x, y, z], i * 6);
    end[i * 2] = 0; end[i * 2 + 1] = 1;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  const uniforms = { uT: { value: 0 }, uCam: { value: new THREE.Vector3() }, uAmt: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms,
    vertexShader: /* glsl */`attribute float aEnd; uniform float uT, uAmt; uniform vec3 uCam; varying float vA;
      void main(){ vec3 p = position; p.y -= uT * 26.0; p.x += uT * 3.5;
        p.x = mod(p.x - uCam.x + ${(BOX / 2).toFixed(1)}, ${BOX.toFixed(1)}) - ${(BOX / 2).toFixed(1)} + uCam.x;
        p.z = mod(p.z - uCam.z + ${(BOX / 2).toFixed(1)}, ${BOX.toFixed(1)}) - ${(BOX / 2).toFixed(1)} + uCam.z;
        p.y = mod(p.y - uCam.y + 8.0, ${H.toFixed(1)}) - 8.0 + uCam.y;
        p.y += aEnd * 1.15; p.x -= aEnd * 0.14;
        vA = (0.22 + 0.33 * aEnd) * uAmt * smoothstep(1.5, 5.0, length(p - uCam));
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
    fragmentShader: /* glsl */`varying float vA; void main(){ gl_FragColor = vec4(0.82, 0.9, 1.0, vA); }`,
  });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false; lines.visible = false; lines.renderOrder = 880;
  const veilGeo = new THREE.SphereGeometry(2, 12, 8), veilMat = new THREE.MeshBasicMaterial({ color: '#5a6a7c', transparent: true, opacity: 0, side: THREE.BackSide, depthTest: false, depthWrite: false, fog: false });
  const veil = new THREE.Mesh(veilGeo, veilMat);
  veil.frustumCulled = false; veil.visible = false; veil.renderOrder = 890;
  scene.add(lines, veil);
  return {
    update(camera, t, amt) {
      const on = amt > 0.02;
      lines.visible = on; veil.visible = on;
      if (!on) return;
      uniforms.uT.value = t; uniforms.uCam.value.copy(camera.position); uniforms.uAmt.value = amt;
      veil.position.copy(camera.position); veil.updateMatrixWorld();
      veilMat.opacity = 0.27 * amt;
    },
    hide() { lines.visible = false; veil.visible = false; },
    dispose() { scene.remove(lines, veil); geo.dispose(); mat.dispose(); veilGeo.dispose(); veilMat.dispose(); },
  };
}

// ---------- horn words ----------
const WORDS = [['TIN TIN!', '#e63c2e'], ['TOT!', '#2a78d8'], ['WOI!', '#e0841a'], ['MINGGIR!', '#27964a'], ['TET TET!', '#b43cc8']];
function createBubbles(scene) {
  const POOL = 3, mats = WORDS.map(([w, col]) => {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
    const g = cv.getContext('2d');
    g.fillStyle = '#fffdf2'; g.strokeStyle = '#26252b'; g.lineWidth = 6;
    g.beginPath(); g.roundRect(8, 8, 240, 88, 30); g.moveTo(104, 96); g.lineTo(124, 122); g.lineTo(146, 96); g.fill(); g.stroke();
    g.fillStyle = '#fffdf2'; g.fillRect(106, 90, 38, 8);
    g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `900 ${w.length > 6 ? 40 : 54}px system-ui, sans-serif`;
    g.fillText(w, 128, 54);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    // alpha is taken out of the target too, as the fx do it: the outline pass then does not draw through the word
    return new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor });
  });
  const items = [];
  for (let i = 0; i < POOL; i++) {
    const sp = new THREE.Sprite(mats[0]);
    sp.visible = false; sp.frustumCulled = false; sp.renderOrder = 870; sp.scale.set(2.5, 1.25, 1);
    scene.add(sp); items.push({ sp, life: 0, y: 0, base: 1 });
  }
  let at = 0;
  return {
    say(e) {
      const it = items[at = (at + 1) % POOL];
      it.sp.material = mats[Math.abs(Math.floor((e.seed || 0) * 7.13)) % mats.length];
      it.sp.position.set(e.x, e.y + 2.2, e.z);
      it.life = 1; it.sp.visible = true;
    },
    update(dt) {
      for (const it of items) {
        if (it.life <= 0) continue;
        it.life -= dt / 1.1;
        if (it.life <= 0) { it.sp.visible = false; continue; }
        const k = Math.min(1, (1 - it.life) * 8), pop = k < 1 ? k * (2 - k) * 1.15 : 1;
        it.sp.scale.set(2.5 * pop, 1.25 * pop, 1);
        it.sp.position.y += dt * 0.7;
      }
    },
    dispose() {
      for (const it of items) scene.remove(it.sp);
      for (const m of mats) { m.map.dispose(); m.dispose(); }
    },
  };
}
