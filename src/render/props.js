// What stands by the road and moves on it. The static batch merges all buildings and props by area with one material
// (vertex colours and painted kinds), so a whole village is one draw call per cell. Dynamic: crates in bands, boost pads,
// jump ramps, the start gate, hazards (cows and friends), shots and spills.
import * as THREE from 'three';
import { hash3, linear, lerp, clamp } from './math.js';
import { paint, merge, roundedBox, sphere, capsule, cylinder, cone, place, tube, lathe, torus } from './shapes.js';

const BATCH_CELL = 220;

// add(geometry): into the static batch of its map cell. blob(x, z, r, a): contact shade on the ground.
export function createBatch(CELL = BATCH_CELL) {
  const cells = new Map(), blobs = [];
  const B = {
    blobs,
    // opts, for a long track (render/stream.js): far: true stays to the horizon, a landmark seen from afar; low: a cheap geometry shown past def.long.detail m in its place
    add(g, opts) {
      if (!g.boundingSphere) g.computeBoundingSphere();
      const c = g.boundingSphere.center, big = g.boundingSphere.radius > CELL, far = !!opts?.far;
      const k = big ? `big${cells.size}` : `${far ? 'far' : ''}${Math.floor(c.x / CELL)},${Math.floor(c.z / CELL)}`;
      let cell = cells.get(k);
      if (!cell) { cells.set(k, (cell = [])); cell.far = far || big; }
      cell.push(g);
      if (opts?.low) (cell.low ||= []).push(opts.low);
    },
    blob(x, z, r, a = 0.45) { blobs.push({ x, z, r, a }); },
    finish(material) {
      const group = new THREE.Group(), meshes = [], entries = [];
      for (const list of cells.values()) {
        const g = merge(list);
        g.computeBoundingSphere();
        const m = new THREE.Mesh(g, material);
        group.add(m); meshes.push(m);
        let low = null;
        if (list.low) { const lg = merge(list.low); lg.computeBoundingSphere(); low = new THREE.Mesh(lg, material); group.add(low); }
        entries.push({ mesh: m, low, far: list.far });
      }
      return { group, meshes, entries };
    },
  };
  return B;
}

// ---------- crates ----------
function crateGeometry(look) {
  const wood = '#c79a5c', dark = '#8a6238', ribbon = '#e4553f', gold = '#f5c84a', parts = [];
  // a market crate of slats, a ribbon both ways, a bow on top and an embroidered star on the sides
  // the core and the slats are plain boxes: their rounding was 1450 of a crate's 2350 triangles, under the slats or too fine to read, and a lap shows twenty crates
  parts.push(paint(new THREE.BoxGeometry(1.72, 1.72, 1.72), dark));
  for (const a of [-0.58, 0, 0.58]) {
    for (const f of [[0, 0, 0], [0, Math.PI / 2, 0]]) for (const z of [-0.87, 0.87]) {
      const g = new THREE.BoxGeometry(1.74, 0.42, 0.08);
      place(g, { p: [0, a, z], r: [0, 0, 0] });
      if (f[1]) g.rotateY(Math.PI / 2);
      paint(g, wood, 0, () => 0.92 + 0.18 * hash3(Math.round(a * 10), Math.round(z * 10), f[1] * 7 | 0));
      parts.push(g);
    }
  }
  const lid = roundedBox(1.92, 0.2, 1.92, 0.08, 1); place(lid, { p: [0, 0.92, 0] }); paint(lid, wood); parts.push(lid);
  const lid2 = roundedBox(1.92, 0.2, 1.92, 0.08, 1); place(lid2, { p: [0, -0.92, 0] }); paint(lid2, wood, 0, () => 0.8); parts.push(lid2);
  // ribbon bands
  for (const r of [0, Math.PI / 2]) {
    const g = roundedBox(0.34, 2.1, 2.05, 0.06, 1); g.rotateY(r); paint(g, ribbon); parts.push(g);
  }
  // star patches
  for (let q = 0; q < 4; q++) {
    const star = starGeometry(0.34, 0.14, 0.05); star.rotateX(Math.PI / 2); star.translate(0, 0, 1.03); star.rotateY((q * Math.PI) / 2);
    paint(star, gold); parts.push(star);
  }
  // a bow
  for (const s of [-1, 1]) {
    const loop = torus(0.2, 0.07, 5, 10); place(loop, { p: [s * 0.24, 1.2, 0], r: [Math.PI / 2, s * 0.5, 0], s: [1.2, 0.8, 1] }); paint(loop, ribbon); parts.push(loop);
  }
  const knot = sphere(0.13, 8, 6); place(knot, { p: [0, 1.15, 0] }); paint(knot, ribbon); parts.push(knot);
  const g = merge(parts); g.scale(0.92, 0.92, 0.92);
  return g;
}

export function starGeometry(R = 1, r = 0.42, h = 0.2, points = 5) {
  const pos = [], idx = [], n = points * 2;
  pos.push(0, h, 0);
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, rr = i % 2 ? r : R; pos.push(Math.sin(a) * rr, 0, Math.cos(a) * rr); }
  for (let i = 0; i < n; i++) idx.push(0, 1 + i, 1 + (i + 1) % n);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function createBoxes(track, look, mat, count) {
  const mesh = new THREE.InstancedMesh(crateGeometry(look), mat('#ffffff', { vertexColors: true, gloss: [30, 0.1], rim: [0.05, 3] }), count);
  mesh.frustumCulled = false; mesh.count = 0;
  const glowGeo = new THREE.PlaneGeometry(1, 1);
  const glowMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uC: { value: new THREE.Color('#ffd98a') } },
    vertexShader: /* glsl */`varying vec2 vQ;
      void main(){ vQ = position.xy * 2.0; vec4 c = viewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0); float s = length(instanceMatrix[0].xyz); gl_Position = projectionMatrix * (c + vec4(position.xy * s, 0.0, 0.0)); }`,
    fragmentShader: 'uniform vec3 uC; varying vec2 vQ; void main(){ float r = length(vQ); gl_FragColor = vec4(uC * 0.55 * pow(max(1.0 - r, 0.0), 2.2), 0.0); }',
  });
  const glow = new THREE.InstancedMesh(glowGeo, glowMat, count);
  glow.frustumCulled = false; glow.count = 0; glow.renderOrder = 4;
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), S = new THREE.Vector3();
  const pop = new Float32Array(count + 8);
  // near(x, z), on a long track: only the bands around a view are worth their triangles
  function update(boxes, t, dt, near = null) {
    let n = 0;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i], want = b.up ? 1 : 0;
      // scale eases on the way back, and pops away at once
      pop[i] = want ? Math.min(1, pop[i] + dt * 3.2) : 0;
      if (pop[i] <= 0.001 || (near && !near(b.x, b.z))) continue;
      const k = pop[i], bounce = k * (1 + 0.35 * Math.sin(k * Math.PI) * (1 - k));
      E.set(0.12 * Math.sin(t * 1.4 + i), t * 1.25 + i * 1.3, 0);
      Q.setFromEuler(E);
      M.compose(P.set(b.x, b.y + 0.14 * Math.sin(t * 2 + i * 0.9), b.z), Q, S.setScalar(bounce));
      mesh.setMatrixAt(n, M);
      M.compose(P, Q.identity(), S.setScalar(4.4 * bounce));
      glow.setMatrixAt(n, M);
      n++;
    }
    mesh.count = n; glow.count = n;
    mesh.instanceMatrix.needsUpdate = true; glow.instanceMatrix.needsUpdate = true;
  }
  return { mesh, glow, update };
}

// ---------- boost pads, jump ramps, the gate ----------
export function createPads(track, shared) {
  if (!track.pads.length) return null;
  const pos = [], uv = [], idx = [], S = track.samples, PADL = track.def?.look?.pad;
  // look.pad: { mat, stripe, band }, a track's own colours for the pad; none, the old ones
  const glc = (h, d) => { if (!h) return d; const c = new THREE.Color(h); return `vec3(${c.r.toFixed(3)}, ${c.g.toFixed(3)}, ${c.b.toFixed(3)})`; };
  for (const p of track.pads) {
    const base = pos.length / 3, len = 10, hw = Math.min(2.5, p.w * 0.22), steps = 8;
    for (let s = 0; s <= steps; s++) {
      const a = (s / steps - 0.5) * len, fi = p.u * track.n + a / track.step, i = Math.round(fi);
      const idxS = ((i % track.n) + track.n) % track.n;
      // look.pad: rows at the true place between samples; rounded to a sample, two rows could land on one and notch the chevrons
      const j = ((Math.floor(fi) % track.n) + track.n) % track.n, k = (j + 1) % track.n, ft = PADL ? fi - Math.floor(fi) : 0, A = PADL ? j : idxS, B = PADL ? k : idxS;
      for (const lat of [-1, 1]) {
        const d = p.d + lat * hw;
        pos.push(lerp(S.x[A] + S.nx[A] * d, S.x[B] + S.nx[B] * d, ft), track.heightAt(fi, d) + 0.05, lerp(S.z[A] + S.nz[A] * d, S.z[B] + S.nz[B] * d, ft));
        uv.push(lat * 0.5 + 0.5, s / steps);
      }
    }
    for (let s = 0; s < steps; s++) {
      const a = base + s * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uTime: shared.time },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`uniform float uTime; varying vec2 vUv;
      void main(){
        vec2 q = vec2(abs(vUv.x - 0.5) * 2.0, vUv.y);
        // painted chevrons on a dark mat: crisp at any distance, bright enough to read, not enough to bloom over the road
        float ch = fract(q.y * 5.0 - q.x * 1.1 - uTime * 1.6), w = max(fwidth(q.y) * 5.0, 0.01);
        float a = smoothstep(0.5 - w, 0.5 + w, ch) * (1.0 - smoothstep(0.94 - w, 0.94 + w, ch));
        float rim = max(q.x, abs(vUv.y - 0.5) * 2.0), rw = max(fwidth(rim), 0.004);
        float edge = 1.0 - smoothstep(0.985 - rw, 0.985 + rw, rim), band = smoothstep(0.92 - rw, 0.92 + rw, rim);
        vec3 c = mix(${glc(PADL?.mat, 'vec3(0.3, 0.12, 0.07)')}, ${glc(PADL?.stripe, 'vec3(1.0, 0.5, 0.1)')}, a);
        c = mix(c, ${glc(PADL?.band, 'vec3(0.42, 0.17, 0.07)')}, band);
        gl_FragColor = vec4(c, edge * 0.96);
      }`,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.renderOrder = 2;
  mesh.polygonOffset = true;
  return mesh;
}

export function buildJumpRamps(track, batch, look) {
  // look.road.jumpMarks false: the landmarks module marks its own crest, in the manner of the place; default the bales and boards
  if (look?.road?.jumpMarks === false) return;
  for (const j of track.jumps) {
    // hay bales lining the lip, a wooden kicker under the road's own hump: where to fly from reads from afar
    const yaw = Math.atan2(j.tx, j.tz);
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
      const d = s * (j.w / 2 + 1.6 + k * 0.1), a = -k * 3.2, x = j.x + j.nx * d + j.tx * a, z = j.z + j.nz * d + j.tz * a, fi = j.u * track.n + a / track.step, y = track.heightAt(fi, s * j.w / 2);
      const bale = cylinder(1.05, 1.05, 2.1, 12);
      place(bale, { p: [x, y + 0.85, z], r: [0, yaw, Math.PI / 2] });
      paint(bale, look?.road?.bale ?? '#d9b45a', 4);
      batch.add(bale);
      batch.blob(x, z, 2.2, 0.35);
    }
    // two big chevron boards point the way
    for (const s of [-1, 1]) {
      const d = s * (j.w / 2 + 3.4), x = j.x + j.nx * d, z = j.z + j.nz * d, y = track.heightAt(j.u * track.n, s * j.w / 2);
      batch.add(paint(place(roundedBox(0.2, 3.6, 0.2, 0.06, 1), { p: [x, y + 1.8, z] }), '#6c4a2c'));
      const b = roundedBox(2.2, 1.1, 0.16, 0.08, 1); place(b, { p: [x, y + 3.3, z], r: [0, yaw, 0] }); paint(b, '#f2c544'); batch.add(b);
      const arrow = starGeometry(0.62, 0.62, 0.02, 3); place(arrow, { p: [x - Math.sin(yaw) * 0.1, y + 3.3, z - Math.cos(yaw) * 0.1], r: [Math.PI / 2, 0, yaw + Math.PI] }); paint(arrow, '#d9483b'); batch.add(arrow);
    }
  }
}

// ---------- the hazards: rounded animals, instanced per kind ----------
// Eyes are big and glossy; everything is capsules and spheres, so the herd reads as a friendly blob with a bell.
function eyes(parts, x, y, z, r = 0.14, sep = 0.2) {
  for (const s of [-1, 1]) {
    parts.push(paint(place(sphere(r, 8, 6), { p: [x + s * sep, y, z] }), '#fbf7ee'));
    parts.push(paint(place(sphere(r * 0.62, 8, 6), { p: [x + s * sep, y + 0.01, z + r * 0.5] }), '#1a1820'));
    parts.push(paint(place(sphere(r * 0.2, 5, 4), { p: [x + s * (sep - r * 0.15), y + r * 0.3, z + r * 0.92] }), '#ffffff'));
  }
}
export function cowGeometry() {
  const parts = [], hide = '#f4ead8', patch = '#7d5233', snout = '#f2bdb0', horn = '#e9dcc0';
  parts.push(paint(place(capsule(0.66, 1.5, 4, 12), { p: [0, 1.25, 0], r: [Math.PI / 2, 0, 0] }), hide));
  parts.push(paint(place(sphere(0.55, 10, 8), { p: [0.34, 1.5, -0.42], s: [1, 0.7, 1.2] }), patch));
  parts.push(paint(place(sphere(0.42, 10, 8), { p: [-0.44, 1.25, 0.34], s: [0.8, 0.9, 1.1] }), patch));
  for (const [x, z] of [[-0.36, 0.62], [0.36, 0.62], [-0.36, -0.62], [0.36, -0.62]]) parts.push(paint(place(capsule(0.17, 0.5, 3, 7), { p: [x, 0.42, z] }), '#6f4a2e'));
  parts.push(paint(place(sphere(0.56, 12, 9), { p: [0, 1.68, 1.28], s: [0.96, 0.96, 1] }), hide));
  parts.push(paint(place(sphere(0.33, 10, 7), { p: [0, 1.46, 1.72], s: [1.16, 0.8, 0.8] }), snout));
  for (const s of [-1, 1]) {
    parts.push(paint(place(cone(0.08, 0.34, 7), { p: [s * 0.36, 2.16, 1.24], r: [0, 0, -s * 0.5] }), horn));
    parts.push(paint(place(capsule(0.12, 0.22, 2, 6), { p: [s * 0.62, 1.82, 1.2], r: [0, 0, s * 1.35] }), patch));
  }
  eyes(parts, 0, 1.82, 1.72, 0.17, 0.24);
  // the bell: the point of the whole hazard
  parts.push(paint(place(cylinder(0.18, 0.28, 0.36, 10), { p: [0, 0.84, 1.28] }), '#f0c33c'));
  parts.push(paint(place(torus(0.34, 0.05, 5, 12), { p: [0, 1.1, 1.26], r: [1.25, 0, 0] }), '#b5482f'));
  parts.push(paint(place(capsule(0.05, 0.54, 2, 6), { p: [0, 1.5, -1.42], r: [0.5, 0, 0] }), '#6f4a2e'));
  return merge(parts);
}
function sheepGeometry(dog = false) {
  const parts = [];
  if (dog) {
    parts.push(paint(place(capsule(0.3, 0.8, 3, 8), { p: [0, 0.62, 0], r: [Math.PI / 2, 0, 0] }), '#f3ead8'));
    parts.push(paint(place(sphere(0.34, 10, 8), { p: [0, 0.94, 0.62] }), '#f3ead8'));
    for (const s of [-1, 1]) parts.push(paint(place(capsule(0.09, 0.14, 2, 5), { p: [s * 0.24, 1.12, 0.56] }), '#5a4632'));
    eyes(parts, 0, 1.02, 0.86, 0.09, 0.13);
    for (const [x, z] of [[-0.18, 0.34], [0.18, 0.34], [-0.18, -0.34], [0.18, -0.34]]) parts.push(paint(place(capsule(0.08, 0.28, 2, 5), { p: [x, 0.2, z] }), '#e8dcc4'));
    return merge(parts);
  }
  for (let i = 0; i < 7; i++) parts.push(paint(place(sphere(0.38, 8, 6), { p: [(hash3(i, 1, 1) - 0.5) * 0.6, 0.9 + (hash3(i, 2, 1) - 0.5) * 0.3, (i / 6 - 0.5) * 1.1] }), '#fbf4e4'));
  parts.push(paint(place(sphere(0.3, 10, 8), { p: [0, 1.1, 0.78] }), '#3f3530'));
  eyes(parts, 0, 1.18, 1.0, 0.09, 0.13);
  for (const [x, z] of [[-0.2, 0.34], [0.2, 0.34], [-0.2, -0.34], [0.2, -0.34]]) parts.push(paint(place(capsule(0.07, 0.3, 2, 5), { p: [x, 0.24, z] }), '#3f3530'));
  return merge(parts);
}
// A small round creature on an old wooden sled, bobble hat and scarf flying, delighted: the kids who cross the piste.
function sledderGeometry() {
  const parts = [], wood = '#b98a58', dark = '#6a4a30', red = '#d43d33', fur = '#e58a4a';
  for (const s of [-1, 1]) parts.push(paint(tube([[s * 0.5, 0.5, 1.5], [s * 0.5, 0.16, 1.05], [s * 0.5, 0.05, 0], [s * 0.5, 0.05, -1.05]], 0.07, 5), dark));
  for (const z of [-0.85, -0.3, 0.25, 0.8]) parts.push(paint(place(roundedBox(1.14, 0.1, 0.42, 0.03, 1), { p: [0, 0.46, z] }), wood));
  const kid = blobAnimal(fur, 0.86, '#b55f2c'); place(kid, { p: [0, 0.42, -0.05] }); parts.push(kid);
  parts.push(paint(place(sphere(0.44, 9, 6), { p: [0, 2.0, 0.1], s: [1, 0.72, 1] }), red), paint(place(sphere(0.16, 6, 4), { p: [0, 2.36, 0.1] }), '#fbfaff'));
  parts.push(paint(place(torus(0.36, 0.11, 5, 10), { p: [0, 1.28, 0.08], r: [Math.PI / 2, 0, 0] }), '#2d62b5'), paint(place(roundedBox(0.26, 0.06, 0.9, 0.02, 1), { p: [0.3, 1.34, -0.66], r: [0.3, 0, 0] }), '#2d62b5'));
  return merge(parts);
}

// A Carpathian brown bear up on its hind legs at the roadside: a heavy pear of a body, fur darker down the arms and legs, a pale muzzle, small round ears, big paws. Faces +z.
export function bearGeometry() {
  const fur = '#6b4a31', dark = '#4b3323', pale = '#b08a60', parts = [];
  parts.push(paint(place(sphere(1, 12, 9), { p: [0, 1.02, -0.02], s: [0.8, 0.98, 0.68] }), fur));
  parts.push(paint(place(sphere(1, 12, 9), { p: [0, 1.82, 0.05], s: [0.58, 0.62, 0.52] }), fur));
  parts.push(paint(place(sphere(1, 10, 7), { p: [0, 1.0, 0.36], s: [0.5, 0.64, 0.38] }), pale));
  parts.push(paint(place(sphere(0.43, 12, 9), { p: [0, 2.38, 0.16] }), fur));
  parts.push(paint(place(sphere(0.2, 9, 7), { p: [0, 2.27, 0.5], s: [1, 0.82, 1.1] }), pale), paint(place(sphere(0.085, 7, 5), { p: [0, 2.33, 0.7], s: [1.2, 0.8, 0.8] }), '#1c1412'));
  eyes(parts, 0, 2.47, 0.48, 0.1, 0.17);
  for (const s of [-1, 1]) {
    parts.push(paint(place(sphere(0.15, 8, 6), { p: [s * 0.33, 2.74, 0.06] }), dark), paint(place(sphere(0.08, 6, 4), { p: [s * 0.33, 2.74, 0.15] }), pale));
    // arms held up and out, the paws open
    parts.push(paint(place(capsule(0.17, 0.72, 3, 8), { p: [s * 0.62, 1.82, 0.26], r: [-0.85, 0, s * -0.55] }), dark));
    parts.push(paint(place(sphere(0.22, 8, 6), { p: [s * 0.82, 2.14, 0.62], s: [1, 0.8, 0.8] }), dark));
    for (const c of [-1, 0, 1]) parts.push(paint(place(sphere(0.05, 5, 4), { p: [s * 0.82 + c * 0.1, 2.18, 0.78] }), '#e8dcc8'));
    // the hind legs, short and thick, the feet flat on the ground
    parts.push(paint(place(capsule(0.25, 0.42, 3, 8), { p: [s * 0.42, 0.42, 0.02] }), dark));
    parts.push(paint(place(sphere(0.28, 8, 6), { p: [s * 0.44, 0.14, 0.18], s: [1, 0.5, 1.45] }), dark));
  }
  return merge(parts);
}

export function blobAnimal(color, size = 1, ears = '#000000') {
  const parts = [];
  parts.push(paint(place(capsule(0.5, 0.6, 3, 10), { p: [0, 0.8, 0], s: [1, 1, 1] }), color));
  parts.push(paint(place(sphere(0.44, 10, 8), { p: [0, 1.5, 0.22] }), color));
  for (const s of [-1, 1]) parts.push(paint(place(sphere(0.16, 8, 6), { p: [s * 0.36, 1.88, 0.14] }), ears));
  eyes(parts, 0, 1.56, 0.58, 0.1, 0.16);
  const g = merge(parts); g.scale(size, size, size);
  return g;
}

// A Tenggerese pony as they stand at the foot of Bromo: stocky and buff, a dark mane cut upright, the blue saddle cloth with its star, and with `rider` a guide in a warm hood and a bright sarong. Faces +z.
export function ponyGeometry(rider = true, coat = '#c9a678', cloth = '#2f62b4') {
  const parts = [], mane = '#3a2a24', hoof = '#3b3034';
  parts.push(paint(place(capsule(0.62, 1.3, 4, 12), { p: [0, 1.42, 0], r: [Math.PI / 2, 0, 0] }), coat));
  for (const [x, z] of [[-0.38, 0.72], [0.38, 0.72], [-0.38, -0.72], [0.38, -0.72]]) {
    parts.push(paint(place(capsule(0.17, 0.72, 3, 7), { p: [x, 0.62, z] }), coat));
    parts.push(paint(place(cylinder(0.2, 0.22, 0.22, 8), { p: [x, 0.12, z] }), hoof));
  }
  // neck, big head, and the mane standing up along the neck
  parts.push(paint(place(capsule(0.34, 0.8, 3, 9), { p: [0, 2.0, 0.98], r: [0.62, 0, 0] }), coat));
  parts.push(paint(place(sphere(0.48, 12, 9), { p: [0, 2.62, 1.34], s: [0.86, 0.92, 1.24] }), coat));
  parts.push(paint(place(sphere(0.28, 9, 7), { p: [0, 2.46, 1.84], s: [1, 0.8, 0.86] }), '#e9d8bc'));
  for (const s of [-1, 1]) parts.push(paint(place(cone(0.13, 0.36, 6), { p: [s * 0.27, 3.12, 1.16], r: [0, 0, -s * 0.2] }), coat));
  for (let i = 0; i < 5; i++) parts.push(paint(place(sphere(0.2, 6, 5), { p: [0, 3.04 - i * 0.26, 1.02 - i * 0.2], s: [0.5, 1.2, 0.9] }), mane));
  parts.push(paint(place(capsule(0.13, 0.86, 3, 7), { p: [0, 1.15, -1.42], r: [-0.3, 0, 0] }), mane));
  eyes(parts, 0, 2.76, 1.64, 0.13, 0.22);
  // the blue cloth, its star, and the green reins
  const blanket = place(cylinder(0.68, 0.68, 1.15, 14, true), { p: [0, 1.5, -0.1], r: [Math.PI / 2, 0, 0] });
  parts.push(paint(blanket, cloth));
  for (const s of [-1, 1]) parts.push(paint(place(starGeometry(0.26, 0.11, 0.05), { p: [s * 0.69, 1.32, -0.1], r: [0, s * Math.PI / 2, 0] }), '#f4e6b4'));
  parts.push(paint(tube([[0.3, 2.42, 1.7], [0.3, 2.3, 0.9], [0.18, 2.34, 0.34]], 0.035, 4), '#3b8a52'), paint(tube([[-0.3, 2.42, 1.7], [-0.3, 2.3, 0.9], [-0.18, 2.34, 0.34]], 0.035, 4), '#3b8a52'));
  if (rider) {
    parts.push(paint(place(capsule(0.34, 0.56, 3, 9), { p: [0, 2.56, -0.08] }), '#d9463c'));
    parts.push(paint(place(sphere(0.36, 11, 9), { p: [0, 3.32, 0] }), '#c98a5e'));
    parts.push(paint(place(sphere(0.42, 11, 8), { p: [0, 3.42, -0.05], s: [1, 0.9, 1] }), '#3b4a7a'));
    eyes(parts, 0, 3.34, 0.33, 0.07, 0.14);
    for (const s of [-1, 1]) {
      parts.push(paint(place(capsule(0.12, 0.62, 2, 6), { p: [s * 0.36, 2.54, 0.2], r: [1.1, 0, 0] }), '#d9463c'));
      parts.push(paint(place(capsule(0.14, 0.7, 2, 6), { p: [s * 0.62, 1.56, -0.02] }), '#f0b43c'));
    }
  }
  return merge(parts);
}

// A chubby bat, faces +z, wings out, big ears and big eyes; light enough on purple to read over a dark wood.
export function batGeometry(flap = 1) {
  // dark fur and a real wing, seen from both sides: the chase camera sees them from behind, and a wing with one face was a few spikes. flap: the wing's position, up 1 or down -1, the two frames of its beat
  const parts = [], fur = '#50466a', wing = '#3b3454', rib = '#1f1a30', belly = '#7a6e90', ear = '#a8788e', up = flap * 0.3;
  parts.push(paint(place(sphere(0.5, 10, 8), { p: [0, 0, 0], s: [1, 1.1, 0.95] }), fur));
  parts.push(paint(place(sphere(0.28, 8, 6), { p: [0, -0.16, 0.3] }), belly));
  for (const s of [-1, 1]) {
    parts.push(paint(place(sphere(0.24, 8, 6), { p: [s * 0.3, 0.62, 0], r: [0, 0, -s * 0.28], s: [0.8, 1.35, 0.5] }), fur));
    parts.push(paint(place(sphere(0.15, 7, 5), { p: [s * 0.3, 0.6, 0.08], r: [0, 0, -s * 0.28], s: [0.75, 1.3, 0.5] }), ear));
    const sh = [s * 0.34, 0.16, 0], wr = [s * 1.25, 0.56 + up * 0.6, -0.05], f1 = [s * 2.0, 0.36 + up * 1.3, -0.1], tip = [s * 2.75, 0.06 + up * 1.9, -0.15], b1 = [s * 0.8, -0.46 + up * 0.2, -0.55], b2 = [s * 1.55, -0.36 + up * 0.7, -0.7], b3 = [s * 2.2, -0.2 + up * 1.3, -0.6];
    for (const [a, b, c] of [[sh, wr, b1], [wr, b2, b1], [wr, f1, b2], [f1, b3, b2], [f1, tip, b3]]) for (const flip of [0, 1]) {
      const t = new THREE.BufferGeometry();
      t.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c], 3));
      t.setIndex(flip ? [0, 2, 1] : [0, 1, 2]); t.computeVertexNormals();
      parts.push(paint(t, wing));
    }
    parts.push(paint(tube([sh, wr, f1, tip], 0.045, 4), rib));
  }
  eyes(parts, 0, 0.14, 0.42, 0.11, 0.2);
  return merge(parts);
}

// A sulphur vent: a stack of puffs, y 0..1, that the renderer stretches to the steam's height; its crust on the road is always there, so a quiet vent can be read from far off.
function ventCrust(V) {
  // look.vent.rock: a fumarole in rock: a low smooth mound of lava with sulphur stains, boulders of many sizes round a dark sunk throat, nothing to read as a ring
  if (V?.rock) {
    const parts = [paint(place(sphere(2.3, 24, 10), { p: [0, -0.42, 0], s: [1, 0.3, 1] }), V.crust, 0, (x, y) => (y > 0.1 ? 1.08 : 0.84)), paint(place(sphere(0.92, 16, 8), { p: [0.1, -0.02, -0.05], s: [1, 0.22, 0.9] }), V.throat)];
    for (let i = 0; i < 11; i++) {
      const a = i * 2.399 + 0.5 * Math.sin(i * 7.1), r = 1.15 + 0.85 * (0.5 + 0.5 * Math.sin(i * 3.7)), s = 0.2 + 0.42 * (0.5 + 0.5 * Math.sin(i * 5.3)) ** 2;
      parts.push(paint(place(sphere(s, 12, 8), { p: [Math.cos(a) * r, s * 0.32, Math.sin(a) * r], r: [i, i * 2, 0], s: [1.25, 0.8, 1] }), i % 4 === 1 ? V.sulphur : V.rock, 0, (x, y) => (y > 0 ? 1.18 : 0.8)));
    }
    return merge(parts);
  }
  // look.vent: a fumarole in the sand is a ragged heap of lava round a dark throat, never a clean disc
  if (V) {
    const parts = [paint(place(cylinder(1.1, 2.1, 0.22, 14), { p: [0, 0.06, 0] }), V.crust), paint(place(cylinder(0.85, 1.05, 0.24, 10), { p: [0, 0.14, 0] }), V.throat)];
    for (let i = 0; i < 13; i++) {
      const a = i * 2.399 + 0.4 * Math.sin(i * 7.1), r = 1.15 + 0.5 * (0.5 + 0.5 * Math.sin(i * 3.7)), s = 0.26 + 0.2 * (0.5 + 0.5 * Math.sin(i * 5.3));
      parts.push(paint(place(sphere(s, 8, 6), { p: [Math.cos(a) * r, s * 0.45, Math.sin(a) * r], s: [1.3, 0.75, 1] }), i % 3 ? V.ring : V.throat));
    }
    return merge(parts);
  }
  return merge([paint(place(cylinder(1.5, 2.2, 0.34, 12), { p: [0, 0.1, 0] }), V?.crust ?? '#e6cf6a'), paint(place(cylinder(0.72, 1.05, 0.3, 10), { p: [0, 0.22, 0] }), V?.throat ?? '#6d5a4c')]);
}
function ventGeometry() {
  const parts = [];
  for (let i = 0; i < 14; i++) {
    const t = i / 13, a = i * 2.4, r = 0.3 + 0.5 * t;
    parts.push(paint(place(sphere(1, 12, 9), { p: [Math.sin(a) * r * 0.5, 0.05 + t * 0.9, Math.cos(a) * r * 0.5], s: [0.34 + 0.5 * t, 0.045 + 0.06 * t, 0.34 + 0.5 * t] }), i % 2 ? '#fff4dc' : '#f6e3cf'));
  }
  return merge(parts);
}

const HAZARD_MODELS = {
  cows: { geo: () => cowGeometry(), scale: 1 },
  sheep: { geo: () => sheepGeometry(false), scale: 1.05 },
  dog: { geo: () => sheepGeometry(true), scale: 1.1 },
  pony: { geo: () => ponyGeometry(true), scale: 1 },
  ponies: { geo: () => ponyGeometry(true), scale: 1 },
  steam: { geo: () => ventGeometry(), scale: 1 },
  macaques: { geo: () => blobAnimal('#a98f70', 0.72, '#e2b9a2'), scale: 1 },
  bear: { geo: () => bearGeometry(), scale: 1, shadow: true },
  sledders: { geo: () => sledderGeometry(), scale: 1 },
  bats: { geo: () => batGeometry(1), alt: () => batGeometry(-1), scale: 1, shadow: true },
};

export function createHazards(state, mat, shared) {
  const byKind = new Map(), group = new THREE.Group(), list = state.hazards || [];
  const material = mat('#ffffff', { vertexColors: true, gloss: [40, 0.12] });
  for (const h of list) {
    const key = h.role || h.kind, def = HAZARD_MODELS[key];
    if (!def) continue;
    let e = byKind.get(key);
    // look.vent: a fumarole whose steam is the renderer's billows alone, no stack of puffs
    if (!e) { e = { def, count: 0, geo: key === 'steam' && shared?.look?.vent ? new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([], 3)) : def.geo() }; byKind.set(key, e); }
    e.count++;
  }
  for (const e of byKind.values()) {
    e.mesh = new THREE.InstancedMesh(e.geo, material, e.count);
    e.mesh.frustumCulled = false;
    group.add(e.mesh);
    // a second frame for what beats its wings, and a soft spot on the road under what flies
    if (e.def.alt) { e.altGeo = e.def.alt(); e.altMesh = new THREE.InstancedMesh(e.altGeo, material, e.count); e.altMesh.frustumCulled = false; group.add(e.altMesh); }
    if (e.def.shadow) {
      e.spotGeo = new THREE.CircleGeometry(1.7, 14); e.spotGeo.rotateX(-Math.PI / 2);
      e.spot = new THREE.InstancedMesh(e.spotGeo, new THREE.MeshBasicMaterial({ color: '#0c0e1c', transparent: true, opacity: 0.32, depthWrite: false }), e.count);
      e.spot.frustumCulled = false; e.spot.renderOrder = 1; group.add(e.spot);
    }
    if (e.def === HAZARD_MODELS.steam) { e.crustGeo = ventCrust(shared?.look?.vent); e.crust = new THREE.InstancedMesh(e.crustGeo, material, e.count); e.crust.frustumCulled = false; group.add(e.crust); }
  }
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), S = new THREE.Vector3(), used = new Map();
  // steam and ice have no animal: a column of puffs and a pale disc, the renderer's fx draw them
  function update(items, t, near = null) {
    used.clear();
    for (const h of items) {
      const key = h.role || h.kind, e = byKind.get(key);
      if (!e || (near && !near(h.x, h.z))) continue;
      const n = used.get(key) || 0;
      used.set(key, n + 1);
      const move = Math.abs(h.vd) > 0.1 ? 1 : 0, phase = t * 9 + h.id * 1.7, bob = move * Math.abs(Math.sin(phase)) * 0.16;
      E.set(0, h.yaw, move * 0.06 * Math.sin(phase));
      Q.setFromEuler(E);
      const s = e.def.scale * (key === 'bear' ? 0.7 + 0.3 * clamp(h.h / 2.6, 0, 1) : 1);
      if (key === 'steam') {
        // it grows into its height over a few frames, and turns as it rises
        const cur = (e.cur ||= new Float32Array(e.count));
        cur[n] += (h.h - cur[n]) * (h.h > cur[n] ? 0.32 : 0.14);
        E.set(0, t * 1.4 + h.id, 0); Q.setFromEuler(E);
        const hy = cur[n], wide = 1 + 0.12 * Math.sin(t * 13 + h.id) * clamp(hy / 3, 0, 1);
        const sw = wide * clamp(0.3 + hy / 9, 0, 1.15);
        M.compose(P.set(h.x, h.y, h.z), Q, S.set(sw, Math.max(0.5, hy), sw));
        e.mesh.setMatrixAt(n, M);
        M.compose(P, Q.identity(), S.set(1, 1, 1));
        e.crust.setMatrixAt(n, M);
        e.crust.instanceMatrix.needsUpdate = true;
        e.crust.count = n + 1;
        continue;
      }
      M.compose(P.set(h.x, h.y + bob, h.z), Q, S.set(s, s * (1 - 0.05 * bob), s));
      if (e.altMesh) {
        // the frame of its wingbeat: the two meshes share the instance list, what is on the other frame is scaled away
        const down = Math.sin(t * 15 + h.id * 2.1) < 0;
        (down ? e.altMesh : e.mesh).setMatrixAt(n, M);
        M.compose(P, Q, S.setScalar(0));
        (down ? e.mesh : e.altMesh).setMatrixAt(n, M);
        if (e.spot) { M.compose(P.set(h.x, h.y - (h.h || 0) + 0.12, h.z), Q.identity(), S.setScalar(0.6 + 0.5 * clamp(1 - (h.h || 0) / 8, 0, 1))); e.spot.setMatrixAt(n, M); }
        continue;
      }
      e.mesh.setMatrixAt(n, M);
    }
    for (const [k, e] of byKind) {
      e.mesh.count = used.get(k) || 0; e.mesh.instanceMatrix.needsUpdate = true;
      if (e.altMesh) { e.altMesh.count = e.mesh.count; e.altMesh.instanceMatrix.needsUpdate = true; }
      if (e.spot) { e.spot.count = e.mesh.count; e.spot.instanceMatrix.needsUpdate = true; }
    }
  }
  return { group, update, dispose() { for (const e of byKind.values()) { e.mesh.dispose(); e.geo.dispose(); e.crust?.dispose(); e.crustGeo?.dispose(); e.altMesh?.dispose(); e.altGeo?.dispose(); e.spot?.dispose(); e.spotGeo?.dispose(); } } };
}

export { lathe, tube, cone, lerp, linear };
