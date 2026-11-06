// The cameras of one view. Chase: 5.5 m back and 2.2 m up with lag, slight roll into turns, wider with speed, a shake on
// hits, a punch back and wider on a turbo that grows with its tier, soft on jumps, never into the ground. Flyover: a drone along the lap. Orbit: slowly round the kart at the end.
import * as THREE from 'three';
import { follow, lerp, clamp, smooth, angleTo } from './math.js';

// LOOK_UP sets the pitch: 2.6 deg down over 11 m, frame top 24.4 deg at the slowest fov, so a great mountain can loom over the road
const BACK = 5.5, UP = 2.2, LOOK_UP = 1.7, LOOK_AHEAD = 5.5, CLEAR = 1.0;
// a turbo per tier: metres the camera is left behind by, degrees of fov, and how fast it opens and closes (/s)
const PUNCH_BACK = 0.55, PUNCH_FOV = 2, PUNCH_IN = 10, PUNCH_OUT = 1.7;
// a jolt (a hit, a landing) of 1: metres the camera drops and degrees it closes in, gone at this rate (/s)
const JOLT_DROP = 0.55, JOLT_FOV = 5, JOLT_OUT = 3.2;

export function createViewCamera(look, world) {
  const C = look.camera, cam = new THREE.PerspectiveCamera(C.fov, 16 / 9, C.near, C.far);
  const st = { init: false, yaw: 0, x: 0, y: 0, z: 0, ly: 0, roll: 0, fov: C.fov, shake: 0, shakeT: 0, punch: 0, jolt: 0, lat: 0, orbit: 0, orbitOn: 0, seed: 0 };
  const tmp = new THREE.Vector3();
  const { track, terrain } = world;

  // the height a camera may not go under at (x, z): the ground, or the road it is on if that is higher, or a deck beside it
  function floorAt(x, z, hintY, trackI) {
    let y = terrain.heightAt(x, z);
    if (hintY !== undefined) {
      const near = track.nearest(x, z, trackI);
      if (Math.abs(near.d) < track.samples.w[near.i] / 2 + 3) {
        const r = track.heightAt(near.f, near.d);
        // only the level the kart is on: an underpass stays an underpass
        if (Math.abs(r - hintY) < 6) y = Math.max(track.structureAt(near.i) ? -1e9 : y, r);
      }
    }
    return y;
  }

  function chase(k, dt, snap = false) {
    const sp = Math.hypot(k.vx, k.vz);
    // follow where the kart looks, not where it slides: in a drift the view holds the turn's line
    const moveYaw = sp > 3 ? Math.atan2(k.vx, k.vz) : k.yaw;
    const want = k.yaw + angleTo(k.yaw, moveYaw) * 0.42;
    st.yaw += angleTo(st.yaw, want) * (snap || !st.init ? 1 : follow(5.2, dt));
    const fx = Math.sin(st.yaw), fz = Math.cos(st.yaw);
    // lag along the way grows with speed, held short; a little lag in height for jumps
    const speedK = clamp(sp / 30, 0, 1.3), wantPunch = k.boostT > 0 ? k.boostTier || 1 : 0;
    st.punch = snap || !st.init ? wantPunch : lerp(st.punch, wantPunch, follow(wantPunch > st.punch ? PUNCH_IN : PUNCH_OUT, dt));
    st.jolt = Math.max(0, st.jolt - dt * JOLT_OUT);
    const back = (C.chaseBack ?? BACK) + speedK * 0.7 + st.punch * PUNCH_BACK + (k.bigT > 0 ? 1.6 : 0) + (k.rescueT > 0 ? 5 : 0);
    const up = (C.chaseUp ?? UP) + (k.bigT > 0 ? 0.7 : 0); // look.camera.chaseUp, chaseBack, chaseLook: a track's own chase camera; none, the old one
    // a jump is followed softly; a kart being carried off by the stork is kept in the frame
    const carried = k.rescueT > 0;
    const groundedTarget = k.grounded || carried ? k.y : Math.max(k.y - 1.2, lerp(k.y, st.ly, 0.5));
    st.ly = snap || !st.init ? k.y : lerp(st.ly, groundedTarget, follow(k.grounded || carried ? 9 : 3.2, dt));
    const yBase = st.ly;
    let x = k.x - fx * back, z = k.z - fz * back, y = yBase + up;
    // never in the ground: test the camera spot and the line to the kart
    const fl = floorAt(x, z, k.y, k.trackI);
    if (y < fl + CLEAR) y = fl + CLEAR;
    for (let q = 1; q <= 3; q++) {
      const f = q / 4, gx = lerp(x, k.x, f), gz = lerp(z, k.z, f), g = floorAt(gx, gz, k.y, k.trackI) + 0.5, line = lerp(y, k.y + 0.8, f);
      if (g > line) y += (g - line) / (1 - f);
    }
    const ky = snap || !st.init ? 1 : follow(10, dt);
    st.x = lerp(st.x, x, snap || !st.init ? 1 : follow(16, dt)); st.z = lerp(st.z, z, snap || !st.init ? 1 : follow(16, dt)); st.y = lerp(st.y, y, ky);
    if (st.y < fl + CLEAR) st.y = fl + CLEAR;
    const wantRoll = clamp(-angleTo(st.yaw, moveYaw) * 0.22 + (k.steer || 0) * (k.drift ? -0.03 : -0.018) * speedK, -0.09, 0.09);
    st.roll = lerp(st.roll, wantRoll, snap || !st.init ? 1 : follow(4.5, dt));
    const wantFov = C.fov + (C.fovFast - C.fov) * smooth(10, 42, sp);
    st.fov = snap || !st.init ? wantFov : lerp(st.fov, wantFov, follow(3, dt));
    st.init = true;
    st.shake = Math.max(0, st.shake - dt * 2.2);
    st.shakeT += dt;
    const sh = st.shake * st.shake;
    cam.position.set(st.x + Math.sin(st.shakeT * 47) * sh * 0.24, Math.max(fl + CLEAR * 0.6, st.y - st.jolt * JOLT_DROP) + Math.sin(st.shakeT * 53 + 1) * sh * 0.2, st.z + Math.cos(st.shakeT * 41) * sh * 0.24);
    tmp.set(k.x + fx * LOOK_AHEAD, yBase + (C.chaseLook ?? LOOK_UP) + (k.rescueT > 0 ? 1.6 : k.grounded ? 0 : 0.3), k.z + fz * LOOK_AHEAD);
    cam.up.set(0, 1, 0);
    cam.lookAt(tmp);
    cam.rotateZ(st.roll + Math.sin(st.shakeT * 31) * sh * 0.04);
    const fov = st.fov + st.punch * PUNCH_FOV - st.jolt * JOLT_FOV;
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
    cam.updateMatrixWorld();
  }

  function orbit(k, dt) {
    st.orbit += dt * 0.42;
    const r = 7.5, a = st.orbit + k.yaw, x = k.x + Math.sin(a) * r, z = k.z + Math.cos(a) * r, y = Math.max(terrain.heightAt(x, z) + 1.4, k.y + 2.4);
    const kk = follow(3, dt);
    st.x = lerp(st.x, x, kk); st.y = lerp(st.y, y, kk); st.z = lerp(st.z, z, kk);
    cam.position.set(st.x, st.y, st.z);
    cam.up.set(0, 1, 0);
    cam.lookAt(k.x, k.y + 1.05, k.z);
    if (Math.abs(cam.fov - 46) > 0.01) { cam.fov = lerp(cam.fov, 46, follow(2, dt)); cam.updateProjectionMatrix(); }
    cam.updateMatrixWorld();
  }

  // t in 0..1 over a flyover: high over the lap's far side, down along the road, ending behind the grid.
  function flyover(t, offset = 0) {
    // a long lap flies the same few hundred metres as a short one, not a fifth of its length
    const span = track.long ? 700 / track.length : 0.22, ease = t * t * (3 - 2 * t), u = (1 - span + offset + span * ease) % 1;
    const P = track.pointAt(u), ahead = track.pointAt(u + (track.long ? 60 / track.length : 0.03)), h = lerp(46, 9, smooth(0.3, 1, t));
    const side = lerp(36, 0, smooth(0.25, 0.95, t));
    const x = P.x + P.nx * side, z = P.z + P.nz * side, y = Math.max(P.y, terrain.heightAt(x, z)) + h;
    cam.position.set(x, y, z);
    cam.up.set(0, 1, 0);
    // first the place: the drone looks at the track's great mountain (the backdrop that stands highest), then comes round to the road
    const hero = world.backdrop?.hero, k = hero ? smooth(0.55, 0.95, t) : 1, D = 240;
    const hx = hero ? x + Math.sin(hero.summitAzimuth) * D : 0, hz = hero ? z - Math.cos(hero.summitAzimuth) * D : 0, hy = y + D * Math.tan(5 * Math.PI / 180);
    cam.lookAt(lerp(hx, ahead.x, k), lerp(hy, ahead.y + 1.5, k), lerp(hz, ahead.z, k));
    if (Math.abs(cam.fov - 56) > 0.01) { cam.fov = 56; cam.updateProjectionMatrix(); }
    cam.updateMatrixWorld();
    st.init = false;
  }

  // A free pose for tools: position and a point to look at.
  function pose(px, py, pz, lx, ly, lz, fov) {
    cam.position.set(px, py, pz);
    cam.up.set(0, 1, 0);
    cam.lookAt(lx, ly, lz);
    if (fov && cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
    cam.updateMatrixWorld();
    st.init = false;
  }

  return {
    camera: cam, state: st, chase, orbit, flyover, pose,
    bump(amount) { st.shake = Math.min(1, st.shake + amount); },
    jolt(amount) { st.jolt = Math.min(1, Math.max(st.jolt, amount)); },
    quake(amount) { if (amount > st.shake) st.shake = amount; },
    reset() { st.init = false; st.shake = 0; st.punch = 0; st.jolt = 0; st.orbit = 0; },
  };
}
