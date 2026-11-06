// What a natural disaster looks like: the sign, the shadow and the free lane on the road, the flow, the falling things, cartoon
// smoke balls, the far plume, the ash, the lanterns. All of it reads the sim's state.disasters; nothing here decides anything.
// Also the two hazards that have no animal: the steam vents and the ice patch.
import * as THREE from 'three';
import { hash3, clamp, lerp, smooth } from './math.js';
import { sphere, capsule, cylinder, cone, roundedBox, paint, place, merge, torus } from './shapes.js';
import { summitTruth } from './backdrop.js';
import { disasterEntries, disasterGap, DISASTER_KINDS } from '../sim/disasters.js';

const D2R = Math.PI / 180;
const INK = '#1d1f2b';

// Each kind's own colours. mud: the flow's dark, body and light; top: the rim of its head; puff: its cloud.
const PALETTE = {
  debris: { dark: '#4f3524', body: '#7a5536', light: '#a57c4e', top: '#c49a68', puff: ['#dccbae', '#ebdfc9', '#c9b695'], height: 3, slab: 0.32, shade: 0.58 },
  avalanche: { dark: '#d4e4f2', body: '#f2f8fc', light: '#ffffff', top: '#ffffff', puff: ['#ffffff', '#ffffff', '#eef6fc'], height: 3.4, slab: 0.22, shade: 0.5 },
  lahar: { dark: '#4a3f36', body: '#75644f', light: '#a08a6c', top: '#e6dcc6', puff: ['#7d6a54', '#8f7c64', '#6c5a47'], height: 2.1, slab: 0.26, shade: 0.5 },
  banjir: { dark: '#5a5a3e', body: '#8a8552', light: '#a9a874', top: '#efe8cc', puff: ['#c8c8a4', '#e6e2c4', '#a9a874'], height: 2.1, slab: 0.26, shade: 0.5 },
  rockfall: { puff: ['#e0d6c6', '#efe7da', '#cfc3b0'], shade: 0.32 },
  quake: { puff: ['#e6dcc8', '#f1e9da', '#d6c9b2'], shade: 0.2 },
  eruption: { puff: ['#5d5660', '#7c7480', '#3f3a44'], shade: 0.14 },
  cloud: { puff: ['#8a838c', '#a59ea6'], shade: 0 },
};
const SIGN_COLOR = { debris: '#f6c23e', avalanche: '#7cc7f2', lahar: '#f2a64a', banjir: '#6cc4e8', rockfall: '#f6c23e', quake: '#ff9f6a', eruption: '#ff7f5a', cloud: '#c9b6dc' };

// ---------- geometry ----------
function lump(seed, r = 1, seg = 12, amt = 0.2) {
  const g = sphere(r, seg, Math.round(seg * 0.75)), P = g.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i), l = Math.hypot(x, y, z) / r;
    // low frequency, keyed on the direction so the sphere's seam stays closed: a boulder, not a potato
    const f = 1 + amt * (Math.sin(x / r * 2.1 + seed) * Math.cos(y / r * 2.7 + seed * 1.3) + 0.5 * Math.sin(z / r * 3.3 + seed * 2.1));
    P.setXYZ(i, (x / l) * f, (y / l) * f * 0.86, (z / l) * f);
  }
  g.computeVertexNormals();
  return g;
}
const shadeBy = (a, b) => (x, y) => lerp(a, b, clamp(y * 0.5 + 0.5, 0, 1));
const pieceGeometry = {
  boulder: () => {
    const g = merge([paint(lump(1.3), '#a79f96', 0, shadeBy(0.78, 1.08)), paint(place(lump(3.1, 0.45, 8), { p: [0.6, 0.42, 0.28] }), '#b9b1a8', 0, shadeBy(0.8, 1.05))]);
    return g;
  },
  // a whole larch trunk carried along: wood and a bit of bark, nothing to do with anyone's roof
  log: () => {
    const g = merge([
      paint(place(capsule(0.42, 2.4, 3, 9), { r: [0, 0, Math.PI / 2] }), '#7d5a38'),
      paint(place(cylinder(0.36, 0.36, 0.06, 9), { p: [1.63, 0, 0], r: [0, 0, Math.PI / 2] }), '#dcb98a'),
      paint(place(cylinder(0.36, 0.36, 0.06, 9), { p: [-1.63, 0, 0], r: [0, 0, Math.PI / 2] }), '#dcb98a'),
    ]);
    return g;
  },
  bank: () => merge([
    paint(lump(2.2, 1, 12, 0.14), '#f4f9fd', 0, shadeBy(0.86, 1.03)),
    paint(place(lump(4.4, 0.62, 10, 0.12), { p: [0.75, -0.12, 0.3] }), '#ffffff', 0, shadeBy(0.86, 1.03)),
    paint(place(lump(5.7, 0.55, 10, 0.12), { p: [-0.72, -0.2, -0.3] }), '#eef6fc', 0, shadeBy(0.86, 1.03)),
    paint(place(lump(1.7, 0.42, 8, 0.12), { p: [0.1, -0.3, 0.86] }), '#ffffff', 0, shadeBy(0.86, 1.03)),
  ]),
  // dark crust, hot cracks. The cracks are far over white so that they stay lit in any shade, and the bloom takes them
  bomb: () => {
    const g = paint(lump(6.1, 1, 20, 0.18), '#2c2428'), P = g.attributes.position, C = g.attributes.color;
    for (let i = 0; i < P.count; i++) {
      const crack = Math.abs(Math.sin(P.getX(i) * 4.1 + P.getZ(i) * 3.1) * Math.cos(P.getY(i) * 3.4 - P.getZ(i) * 2.1));
      if (crack < 0.11) C.setXYZ(i, 5, 1.4, 0.16);
    }
    return g;
  },
  cold: () => paint(lump(6.1, 1, 10, 0.18), '#4d4449', 0, shadeBy(0.8, 1.1)),
  // a stack of roof tiles, curved and terracotta, the kind a Saxon village is roofed with
  tile: () => merge([
    paint(place(capsule(0.5, 1.2, 3, 9), { p: [-0.42, 0, 0], r: [Math.PI / 2, 0, 0], s: [1, 0.5, 1] }), '#c9623a'),
    paint(place(capsule(0.5, 1.2, 3, 9), { p: [0.42, 0.04, 0.12], r: [Math.PI / 2, 0, 0], s: [1, 0.5, 1] }), '#d9754a'),
    paint(place(capsule(0.5, 1.2, 3, 9), { p: [0, 0.24, -0.2], r: [Math.PI / 2, 0, 0], s: [1, 0.5, 1] }), '#b5522f'),
  ]),
};

// ---------- cartoon smoke: solid balls that swell and shrink away, inked like the rest of the world ----------
function createBillows(scene, mat, max = 420) {
  const geo = lump(2.9, 1, 12, 0.07);
  const mesh = new THREE.InstancedMesh(geo, mat('#ffffff', { gloss: [10, 0.02] }), max);
  mesh.frustumCulled = false; mesh.count = 0; mesh.renderOrder = 4;
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
  mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  scene.add(mesh);
  const x = new Float32Array(max * 3), v = new Float32Array(max * 3), life = new Float32Array(max), age = new Float32Array(max).fill(1e9), size = new Float32Array(max), drag = new Float32Array(max), rot = new Float32Array(max), tint = new Float32Array(max * 3);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(), E = new THREE.Euler(), c = new THREE.Color();
  let head = 0, seed = 1;
  const rnd = () => hash3(seed++, 41, 3);
  function emit(px, py, pz, vx, vy, vz, s, l, hex, d = 1.2) {
    const i = head; head = (head + 1) % max;
    x[i * 3] = px; x[i * 3 + 1] = py; x[i * 3 + 2] = pz; v[i * 3] = vx; v[i * 3 + 1] = vy; v[i * 3 + 2] = vz;
    age[i] = 0; life[i] = l; size[i] = s; drag[i] = d; rot[i] = rnd() * 6;
    c.set(hex);
    // smoke holds its colour in any light, or snow powder goes the colour of the evening
    const t = (0.94 + rnd() * 0.12) * 1.3;
    tint[i * 3] = c.r * t; tint[i * 3 + 1] = c.g * t; tint[i * 3 + 2] = c.b * t;
  }
  function update(dt) {
    let n = 0;
    for (let i = 0; i < max; i++) {
      if (age[i] >= life[i]) continue;
      age[i] += dt;
      const k = Math.exp(-drag[i] * dt), u = age[i] / life[i];
      v[i * 3] *= k; v[i * 3 + 1] *= k; v[i * 3 + 2] *= k;
      x[i * 3] += v[i * 3] * dt; x[i * 3 + 1] += v[i * 3 + 1] * dt; x[i * 3 + 2] += v[i * 3 + 2] * dt;
      // pops up fast, holds, then shrinks to nothing: smoke with no alpha, the way a cartoon draws it
      const s = size[i] * smooth(0, 0.16, u) * (1 + u * 0.5) * (1 - smooth(0.62, 1, u));
      if (s <= 0.01) continue;
      E.set(rot[i], rot[i] * 1.7 + u, 0); Q.setFromEuler(E);
      M.compose(P.set(x[i * 3], x[i * 3 + 1], x[i * 3 + 2]), Q, S.set(s, s, s));
      mesh.setMatrixAt(n, M);
      mesh.instanceColor.setXYZ(n, tint[i * 3], tint[i * 3 + 1], tint[i * 3 + 2]);
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
  }
  return { emit, update, rnd, mesh, dispose() { scene.remove(mesh); mesh.dispose(); geo.dispose(); } };
}

// ---------- the road: the shadow where it comes down, chevrons on the free lane ----------
function roadStrip(track, c, len, extra = 8) {
  const T = track, S = T.samples, n = T.n, half = Math.ceil((len / 2 + extra) / T.step), pos = [], dd = [], aa = [], idx = [], steps = Math.max(8, Math.ceil(half * 2 / 2)), W = 8;
  for (let q = 0; q <= steps; q++) {
    const o = -half + (q / steps) * half * 2, f = ((c + o) % n + n) % n, i = Math.round(f) % n, hw = S.w[i] / 2 + 0.3;
    for (let w = 0; w <= W; w++) {
      const d = -hw + (w / W) * hw * 2;
      pos.push(S.x[i] + S.nx[i] * d, T.heightAt(f, Math.max(-hw + 0.3, Math.min(hw - 0.3, d))) + 0.07, S.z[i] + S.nz[i] * d);
      dd.push(d); aa.push(o * T.step);
    }
  }
  for (let q = 0; q < steps; q++) for (let w = 0; w < W; w++) { const a = q * (W + 1) + w, b = a + W + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aD', new THREE.Float32BufferAttribute(dd, 1));
  g.setAttribute('aA', new THREE.Float32BufferAttribute(aa, 1));
  g.setIndex(idx);
  return g;
}
function warnMaterial(shared) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
    uniforms: { uTime: shared.time, uK: { value: 0 }, uLane: { value: 1 }, uShade: { value: 0.5 }, uGap: { value: new THREE.Vector4(0, 5, 0, 1) }, uLen: { value: 30 }, uHot: { value: new THREE.Color('#f6c23e') }, uLevel: { value: 0 } },
    vertexShader: 'attribute float aD, aA; varying float vD, vA; void main(){ vD = aD; vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`uniform float uTime, uK, uLane, uShade, uLen; uniform vec4 uGap; uniform vec3 uHot; varying float vD, vA;
      void main(){
        float gap = uGap.x + uGap.z * sin(vA / uGap.w * 6.28318), off = abs(vD - gap) - uGap.y * 0.5, w = max(fwidth(off), 0.01);
        float ends = smoothstep(uLen * 0.5 + 8.0, uLen * 0.5 + 2.0, abs(vA));
        // where it comes down: the road goes dark under the shadow, with slow warning stripes on it
        float dark = smoothstep(-w, w, off), st = fract((vA + vD * 0.9) * 0.2 + uTime * 0.5), sw = max(fwidth((vA + vD * 0.9) * 0.2), 0.002);
        float band = smoothstep(0.62 - sw, 0.62 + sw, st) * (1.0 - smoothstep(0.86 - sw, 0.86 + sw, st));
        vec3 col = mix(vec3(0.03, 0.02, 0.05), uHot, band * 0.4);
        float alpha = dark * uShade * (0.86 + band * 0.2) * ends;
        // the edge of the free lane, a bright dashed kerb
        float edge = (1.0 - smoothstep(0.1, 0.2, abs(off))) * step(0.5, fract(vA * 0.28 - uTime * 1.6));
        col = mix(col, uHot, edge); alpha = max(alpha, edge * 0.95 * ends * step(0.001, uShade));
        // the way through: fat white chevrons running forward on the free lane
        float x = abs(vD - gap), ch = fract((vA - x * 1.1) * 0.1 - uTime * 1.1), cw = max(fwidth((vA - x * 1.1) * 0.1), 0.003);
        float chev = smoothstep(0.82 - cw, 0.82 + cw, ch) * (1.0 - smoothstep(0.93 - cw, 0.93 + cw, ch)) * (1.0 - smoothstep(1.05, 1.15, x)) * (1.0 - dark);
        if (chev > 0.0) { col = mix(col, vec3(1.0, 0.98, 0.86), chev); alpha = max(alpha, chev * 0.8 * uLane * ends); }
        if (alpha < 0.005) discard;
        gl_FragColor = vec4(col, alpha * uK);
      }`,
  });
}

// ---------- a flow, from up the hill to where it stops ----------
function createFlow(R, D, tone = 1) {
  const { track: T, terrain, mat } = R, S = T.samples, n = T.n, NA = 18, NS = 40, count = (NA + 1) * (NS + 1), P = PALETTE[D.kind];
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), idx = [];
  for (let s = 0; s < NS; s++) for (let a = 0; a < NA; a++) { const q = s * (NA + 1) + a, w = q + NA + 1; idx.push(q, w, q + 1, q + 1, w, w + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage));
  g.setIndex(idx);
  const mesh = new THREE.Mesh(g, mat('#ffffff', { vertexColors: true, side: THREE.DoubleSide, gloss: D.kind === 'avalanche' ? [14, 0.04] : [30, 0.12] }));
  mesh.frustumCulled = false; mesh.renderOrder = 1;
  R.group.add(mesh);
  const dark = new THREE.Color(P.dark), body = new THREE.Color(P.body), light = new THREE.Color(P.light), top = new THREE.Color(P.top), tmp = new THREE.Color();
  // look.flowTone: the mud and its cloud darkened by this, where a place's strong light would turn them to cream; 1 by default
  if (tone !== 1) for (const c of [dark, body, light, top]) c.multiplyScalar(tone);
  const hw = S.w[D.c] / 2, side = D.side, start = side * (hw + D.source), stop = D.stop, sign = side, gullyHalf = Math.max(4, D.len * 0.16);
  function update(time) {
    const settle = clamp((D.t - D.warn - D.strike * 0.8) / 2.5, 0, 1), H = lerp(P.height, P.slab, settle), flowing = D.kind === 'lahar' || D.kind === 'banjir' ? 1 : 1 - settle;
    let v = 0;
    for (let sI = 0; sI <= NS; sI++) {
      const s0 = sI / NS, ds = s0 ** 0.8;
      const base = start + (stop - start) * ds;
      for (let aI = 0; aI <= NA; aI++) {
        const a = aI / NA * 2 - 1;
        // the front's edge wanders in lobes, the mesh gathers along it: it grows, it never pops
        const lobes = 1.4 * Math.sin(a * 5.3 + D.id) + 0.8 * Math.sin(a * 11.1 + D.id * 2 + time * 0.8 * flowing);
        const frontHere = (D.front + sign * lobes * Math.min(1, Math.abs(D.front - stop) / 6 + 0.45));
        const d = sign > 0 ? Math.max(base, frontHere) : Math.min(base, frontHere);
        const m = Math.max(0, (d - sign * hw) * sign), fan = clamp(1 - m / (D.source * 0.55), 0, 1) ** 0.7;
        // the tongue's sides wander: a straight edge would read as a ruled shape on the hill
        const half = lerp(gullyHalf, D.len / 2, fan) + Math.abs(a) ** 2 * (2.6 * Math.sin(m * 0.19 + (a > 0 ? 1.1 : 2.9)) + 1.2 * Math.sin(m * 0.53 + (a > 0 ? 0.3 : 4.1))) * (m > 0.5 ? 1 : 0), o = a * half / T.step, f = ((D.c + o) % n + n) % n, i = Math.round(f) % n;
        const x = S.x[i] + S.nx[i] * d, z = S.z[i] + S.nz[i] * d, onRoad = Math.abs(d) <= S.w[i] / 2 - 0.2;
        const y0 = onRoad ? T.heightAt(f, d) : Math.max(terrain.heightAt(x, z), Math.abs(d) < S.w[i] / 2 + 3 ? T.heightAt(f, Math.sign(d) * (S.w[i] / 2 - 0.3)) - 0.3 : -1e9);
        const behind = (d - D.front) * sign, ends = 1 - a * a * a * a, gather = behind <= 0.02 ? 0 : 1;
        const head = smooth(0, 2.2, behind) * (0.55 + 0.45 * Math.exp(-behind / 12));
        const wave = Math.sin(behind * 0.8 - time * 5 * flowing + a * 4) * 0.2 + Math.sin(a * 13 + behind * 0.33 - time * 2.6 * flowing + D.id) * 0.16;
        const h = gather * ends * H * head * (0.82 + wave);
        pos[v * 3] = x; pos[v * 3 + 1] = y0 + (onRoad ? 0.05 : 0.22) + Math.max(0, h); pos[v * 3 + 2] = z;
        const n1 = 0.5 + 0.5 * Math.sin(a * 8.3 + behind * 0.55 - time * 3.2 * flowing + D.id), n2 = 0.5 + 0.5 * Math.sin(a * 19 - behind * 0.9 + time * 2.1 * flowing);
        tmp.copy(dark).lerp(body, smooth(0.2, 0.6, n1)).lerp(light, smooth(0.62, 0.92, n1 * 0.6 + n2 * 0.4));
        // the head's rim catches the light, and the sides fade into the ground's colour by going thin
        tmp.lerp(top, (1 - smooth(0.6, 3.2, behind)) * 0.85);
        col[v * 3] = tmp.r; col[v * 3 + 1] = tmp.g; col[v * 3 + 2] = tmp.b;
        v++;
      }
    }
    g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true;
    g.computeVertexNormals();
  }
  update(0);
  return { update, dispose() { R.group.remove(mesh); g.dispose(); } };
}

// ---------- signs ----------
function pictogram(g, kind, cx, cy, s) {
  g.save(); g.translate(cx, cy); g.scale(s, s);
  g.lineJoin = 'round'; g.lineCap = 'round';
  g.beginPath(); g.moveTo(0, -0.92); g.lineTo(1, 0.76); g.lineTo(-1, 0.76); g.closePath();
  g.fillStyle = '#fff8e6'; g.fill(); g.lineWidth = 0.17; g.strokeStyle = '#d43d2c'; g.stroke();
  g.fillStyle = INK; g.strokeStyle = INK; g.lineWidth = 0.08;
  const rock = (x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
  if (kind === 'debris' || kind === 'rockfall' || kind === 'lahar' || kind === 'banjir') {
    g.beginPath(); g.moveTo(-0.62, 0.58); g.lineTo(0.62, 0.58); g.lineTo(0.62, -0.1); g.closePath(); g.fill();
    rock(-0.12, -0.1, 0.17); rock(0.16, -0.42, 0.12); rock(-0.34, 0.26, 0.13);
  } else if (kind === 'avalanche') {
    g.beginPath(); g.moveTo(-0.62, 0.58); g.lineTo(0.62, 0.58); g.lineTo(0.62, -0.1); g.closePath(); g.fill();
    for (const [x, y] of [[-0.25, -0.05], [0.05, -0.38], [-0.45, 0.28]]) { g.save(); g.translate(x, y); for (let i = 0; i < 3; i++) { g.rotate(1.05); g.beginPath(); g.moveTo(-0.15, 0); g.lineTo(0.15, 0); g.stroke(); } g.restore(); }
  } else if (kind === 'quake') {
    g.lineWidth = 0.13; g.beginPath(); g.moveTo(0.05, -0.56); g.lineTo(-0.2, -0.16); g.lineTo(0.18, 0.06); g.lineTo(-0.14, 0.34); g.lineTo(0.08, 0.6); g.stroke();
    g.lineWidth = 0.07; for (const s0 of [-1, 1]) { g.beginPath(); g.arc(s0 * 0.34, 0.12, 0.16, -1.1 + (s0 < 0 ? Math.PI : 0), 1.1 + (s0 < 0 ? Math.PI : 0)); g.stroke(); }
  } else {
    g.beginPath(); g.moveTo(-0.64, 0.58); g.lineTo(-0.16, -0.14); g.lineTo(0.16, -0.14); g.lineTo(0.64, 0.58); g.closePath(); g.fill();
    rock(0, -0.32, 0.13); rock(-0.22, -0.5, 0.09); rock(0.24, -0.52, 0.1);
  }
  g.restore();
}
function signTexture(entry) {
  const W = 1024, H = 420, cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const r = 58;
  g.fillStyle = INK; g.beginPath(); g.roundRect(0, 0, W, H, r + 10); g.fill();
  g.fillStyle = SIGN_COLOR[entry.kind] || '#f6c23e'; g.beginPath(); g.roundRect(16, 16, W - 32, H - 32, r); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.22)'; g.beginPath(); g.roundRect(30, 30, W - 60, 70, 34); g.fill();
  pictogram(g, entry.kind, 190, 216, 135);
  // the name fills the rest, on one or two lines, in the same chunky type as the HUD
  const words = entry.name.split(' '), box = W - 390, fit = (t, size) => { g.font = `700 ${size}px Fredoka, "Arial Rounded MT Bold", system-ui, sans-serif`; return g.measureText(t).width <= box; };
  let lines = [entry.name], size = 150;
  if (!fit(entry.name, 104) && words.length > 1) {
    const m = Math.ceil(words.length / 2); lines = [words.slice(0, m).join(' '), words.slice(m).join(' ')];
  }
  while (size > 44 && !lines.every((l) => fit(l, size))) size -= 4;
  g.font = `700 ${size}px Fredoka, "Arial Rounded MT Bold", system-ui, sans-serif`; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = INK;
  lines.forEach((l, i) => g.fillText(l, 350, H / 2 + (i - (lines.length - 1) / 2) * size * 1.06));
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.generateMipmaps = true;
  return t;
}
function createSign(R, entry, along, side, scale) {
  const { track: T, terrain, mat } = R, S = T.samples, n = T.n, i = ((entry.c + Math.round(along / T.step)) % n + n) % n, hw = S.w[i] / 2;
  const d = side * (hw + 2.6 + 3.4 * scale), x = S.x[i] + S.nx[i] * d, z = S.z[i] + S.nz[i] * d, y = Math.max(terrain.heightAt(x, z), T.heightAt(i, side * (hw - 0.3)) - 0.5);
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = Math.atan2(-S.tx[i], -S.tz[i]) + side * 0.22;
  const bw = 7 * scale, bh = bw * 420 / 1024, top = 5.6 * scale;
  const wood = merge([
    paint(place(cylinder(0.2 * scale, 0.26 * scale, top, 8), { p: [-bw * 0.36, top / 2, -0.34] }), '#6c4a2c'),
    paint(place(cylinder(0.2 * scale, 0.26 * scale, top, 8), { p: [bw * 0.36, top / 2, -0.34] }), '#6c4a2c'),
    paint(place(roundedBox(bw + 0.2, bh + 0.2, 0.16, 0.08, 1), { p: [0, top - bh / 2, -0.06] }), '#3a3238'),
  ]);
  const post = new THREE.Mesh(wood, mat('#ffffff', { vertexColors: true }));
  const texture = signTexture(entry);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), new THREE.MeshBasicMaterial({ map: texture }));
  board.position.set(0, top - bh / 2, 0.04);
  const lampMat = new THREE.MeshBasicMaterial({ color: '#6a5a3c' }), lampGeo = new THREE.SphereGeometry(0.3 * scale, 12, 9);
  const lamps = [-1, 1].map((q) => { const l = new THREE.Mesh(lampGeo, lampMat.clone()); l.position.set(q * bw * 0.36, top + 0.3 * scale, -0.2); group.add(l); return l; });
  group.add(post, board);
  R.group.add(group);
  return {
    group, lamps,
    // the lamps flash in turn and the board wags a little while it is on
    update(on, time) {
      lamps.forEach((l, q) => {
        const lit = on && Math.sin(time * 11 + q * Math.PI) > 0;
        l.material.color.set(lit ? '#ffd24a' : '#6a5a3c');
        l.scale.setScalar(lit ? 1.35 : 1);
      });
      group.scale.setScalar(on ? 1 + 0.03 * Math.sin(time * 7) : 1);
      board.rotation.z = on ? 0.012 * Math.sin(time * 9) : 0;
    },
    dispose() { R.group.remove(group); wood.dispose(); board.geometry.dispose(); board.material.dispose(); texture.dispose(); lampGeo.dispose(); lamps.forEach((l) => l.material.dispose()); },
  };
}

// The dry gully a flow will come down: pale gravel and stones, there on every lap, so that the third lap you know where to look.
function createGully(R, entry) {
  // entry.gully.rows, cols, rocks, wobble: a finer sheet with more stones and a wandering edge, default the plain gully
  const { track: T, terrain, mat } = R, S = T.samples, n = T.n, side = entry.side, c = entry.c, hw = S.w[c] / 2, NS = entry.gully?.rows ?? 22, NA = entry.gully?.cols ?? 6, pos = [], col = [], idx = [], wobble = entry.gully?.wobble ?? 1.4;
  const color = entry.gully?.color ?? (entry.kind === 'avalanche' ? ['#f0f6fa', '#dfeaf2'] : ['#b5a58c', '#9d8e78']); // entry.gully.color overrides, entry.gully.lump the stones in it
  const half0 = Math.max(4, entry.len * 0.16), C0 = new THREE.Color(color[0]), C1 = new THREE.Color(color[1]), t = new THREE.Color();
  for (let s = 0; s <= NS; s++) {
    const m = 1 + (s / NS) * entry.source, fan = clamp(1 - m / (entry.source * 0.55), 0, 1) ** 0.7, half = lerp(half0, entry.len * 0.3, fan) + wobble * Math.sin(s * 0.9 * 22 / NS);
    for (let a = 0; a <= NA; a++) {
      const ka = a / NA * 2 - 1, o = ka * half / T.step, i = Math.round(((c + o) % n + n) % n) % n, d = side * (S.w[i] / 2 + m), x = S.x[i] + S.nx[i] * d, z = S.z[i] + S.nz[i] * d;
      pos.push(x, terrain.heightAt(x, z) + 0.16, z);
      t.copy(C0).lerp(C1, hash3(s, a, 7));
      col.push(t.r, t.g, t.b);
    }
  }
  for (let s = 0; s < NS; s++) for (let a = 0; a < NA; a++) { const q = s * (NA + 1) + a, w = q + NA + 1; idx.push(q, w, q + 1, q + 1, w, w + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const parts = [];
  for (let q = 0; q < (entry.gully?.rocks ?? 16); q++) {
    const m = 3 + hash3(q, 3, 5) * entry.source * 0.9, a = (hash3(q, 9, 2) - 0.5) * half0 * 1.6, i = Math.round(((c + a / T.step) % n + n) % n) % n, d = side * (S.w[i] / 2 + m), x = S.x[i] + S.nx[i] * d, z = S.z[i] + S.nz[i] * d, r = 0.4 + hash3(q, 1, 1) * 1.1;
    parts.push(paint(place(lump(q * 1.7, 1, 8, 0.18), { p: [x, terrain.heightAt(x, z) + r * 0.3, z], s: r }), entry.gully?.lump ?? (entry.kind === 'avalanche' ? '#c9d6df' : '#a59a8c'), 0, shadeBy(0.8, 1.08)));
  }
  const rocks = merge(parts), m0 = new THREE.Mesh(g, mat('#ffffff', { vertexColors: true, side: THREE.DoubleSide })), m1 = new THREE.Mesh(rocks, mat('#ffffff', { vertexColors: true }));
  m0.renderOrder = 0;
  R.group.add(m0, m1);
  return { dispose() { R.group.remove(m0, m1); g.dispose(); rocks.dispose(); } };
}

// ---------- the far plume ----------
function plumeGeometry(seed, dark, light) {
  const parts = [], C0 = new THREE.Color(dark), C1 = new THREE.Color(light), t = new THREE.Color();
  const N = 46;
  for (let q = 0; q < N; q++) {
    const u = q / (N - 1), h = u ** 0.85, spread = (0.05 + 0.34 * Math.sin(Math.min(1, h * 1.05) * Math.PI * 0.62) ** 2.2) * (1 + (h > 0.8 ? (h - 0.8) * 3.4 : 0)), a = hash3(q, seed, 1) * 6.283, rr = spread * (0.4 + 0.6 * hash3(q, seed, 2));
    const r = 0.055 + 0.12 * Math.sin(h * Math.PI * 0.8) + hash3(q, seed, 3) * 0.04, x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    const g = lump(q * 0.7 + seed, 1, 10, 0.12);
    t.copy(C0).lerp(C1, clamp(h * 0.9 + hash3(q, seed, 4) * 0.28, 0, 1));
    parts.push(paint(place(g, { p: [x, h * 0.96, z], s: r }), `#${t.getHexString()}`, 0, shadeBy(0.76, 1.1)));
  }
  return merge(parts);
}
function plumePlace(R, entry) {
  const { track: T } = R, H = T.def.horizon, S = T.samples;
  let ax = 0, az = 0;
  for (let i = 0; i < T.n; i += 16) { ax += S.x[i]; az += S.z[i]; }
  const c = Math.max(1, Math.ceil(T.n / 16)); ax /= c; az /= c;
  if (entry.at) return { x: entry.at[0], z: entry.at[1], near: true };
  let bearing = entry.bearing;
  if (entry.summit && H?.center) bearing = summitTruth(H, entry.summit).bearing;
  const az0 = bearing !== undefined ? (bearing - (H?.northDeg ?? 0)) * D2R : (entry.azimuth ?? 0.8), far = entry.far ?? 3400;
  return { x: ax + Math.sin(az0) * far, z: az - Math.cos(az0) * far, near: false };
}

// ---------- lanterns on poles, for the earthquake to swing ----------
function createLanterns(R, entries) {
  const { track: T, terrain, mat } = R, S = T.samples, n = T.n, poles = [], list = [];
  for (const e of entries) {
    if (e.kind !== 'quake') continue;
    for (let along = -(e.len / 2 + 10); along <= e.len / 2 + 10; along += 19) {
      const side = Math.round(along / 19) % 2 ? 1 : -1, i = ((e.c + Math.round(along / T.step)) % n + n) % n, d = side * (S.w[i] / 2 + 2.6), x = S.x[i] + S.nx[i] * d, z = S.z[i] + S.nz[i] * d, y = Math.max(terrain.heightAt(x, z), T.heightAt(i, side * (S.w[i] / 2 - 0.3)) - 0.5), h = 4.8, inX = S.nx[i] * -side, inZ = S.nz[i] * -side;
      poles.push(paint(place(cylinder(0.11, 0.15, h, 7), { p: [x, y + h / 2, z] }), '#4d3a2c'));
      poles.push(paint(place(capsule(0.07, 1.3, 2, 6), { p: [x + inX * 0.65, y + h - 0.05, z + inZ * 0.65], r: [Math.atan2(inZ, 1) * 0 + (Math.PI / 2) * Math.abs(inZ), 0, -(Math.PI / 2) * inX] }), '#4d3a2c'));
      list.push({ x: x + inX * 1.3, y: y + h - 0.1, z: z + inZ * 1.3, yaw: Math.atan2(S.tx[i], S.tz[i]), s: along * 0.37 });
    }
  }
  if (!list.length) return null;
  const pg = merge(poles), pm = new THREE.Mesh(pg, mat('#ffffff', { vertexColors: true }));
  const lg = merge([
    paint(place(cylinder(0.028, 0.028, 0.55, 5), { p: [0, -0.28, 0] }), '#3a3238'),
    paint(place(cone(0.42, 0.34, 8), { p: [0, -0.68, 0] }), '#3a3238'),
    paint(place(sphere(0.38, 10, 8), { p: [0, -1.08, 0], s: [1, 1.15, 1] }), '#ffc861'),
    paint(place(cylinder(0.34, 0.26, 0.12, 8), { p: [0, -1.52, 0] }), '#3a3238'),
  ]);
  const lm = new THREE.InstancedMesh(lg, mat('#ffffff', { vertexColors: true, emissive: '#6a3c10', emissiveIntensity: 1.2 }), list.length);
  lm.frustumCulled = false;
  R.group.add(pm, lm);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), One = new THREE.Vector3(1, 1, 1);
  return {
    update(quake, time) {
      list.forEach((l, q) => {
        // always a breath of swing; an earthquake throws them about
        const amp = 0.05 + quake * 0.62, a = Math.sin(time * (1.7 + quake * 3.4) + l.s) * amp, b = Math.cos(time * (1.3 + quake * 4.1) + l.s * 1.7) * amp * 0.55;
        E.set(a, l.yaw, b, 'YXZ'); Q.setFromEuler(E);
        M.compose(P.set(l.x, l.y, l.z), Q, One);
        lm.setMatrixAt(q, M);
      });
      lm.instanceMatrix.needsUpdate = true;
    },
    dispose() { R.group.remove(pm, lm); pg.dispose(); lg.dispose(); lm.dispose(); },
  };
}

// ---------- the steam vents and the ice patch ----------
function createHazardFx(R, hazards) {
  const { track: T, mat, shared, billows, fx } = R, S = T.samples, n = T.n, steam = hazards.filter((h) => h.kind === 'steam'), ice = hazards.filter((h) => h.kind === 'ice'), out = [];
  let ventMesh = null, ventGeo = null, iceMat = null;
  if (steam.length) {
    ventGeo = merge([
      paint(place(cylinder(1.7, 1.9, 0.14, 16), { p: [0, 0.07, 0] }), '#3b3238'),
      paint(place(torus(1.72, 0.2, 7, 18), { p: [0, 0.12, 0], r: [Math.PI / 2, 0, 0] }), shared.look?.vent?.ring ?? '#d8c36a'),
      paint(place(cylinder(1.15, 1.15, 0.03, 14), { p: [0, 0.17, 0] }), '#1b1620'),
    ]);
    ventMesh = new THREE.InstancedMesh(ventGeo, mat('#ffffff', { vertexColors: true }), steam.length);
    ventMesh.frustumCulled = false;
    R.group.add(ventMesh);
  }
  for (const h of ice) {
    const f0 = h.i, len = h.r * 2, half = Math.ceil(len / 2 / T.step), pos = [], uv = [], idx = [];
    for (let o = -half; o <= half; o++) {
      const f = ((f0 + o) % n + n) % n, i = Math.round(f) % n, hw = S.w[i] / 2 + 0.2;
      for (const q of [-1, 0, 1]) { pos.push(S.x[i] + S.nx[i] * q * hw, T.heightAt(f, q * (hw - 0.4)) + 0.06, S.z[i] + S.nz[i] * q * hw); uv.push(q * hw, o * T.step); }
    }
    for (let o = 0; o < half * 2; o++) for (let q = 0; q < 2; q++) { const a = o * 3 + q, b = a + 3; idx.push(a, a + 1, b, a + 1, b + 1, b); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    iceMat ||= new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, uniforms: { uLen: { value: h.r }, uSoft: { value: shared.look?.road?.iceSoft ?? 0 }, uHw: { value: S.w[Math.round(f0) % n] / 2 } }, // look.road.iceSoft 0..1: the sheet in the track's own shade of ice, its sides blown soft; 0 the old pale sheet
      vertexShader: 'varying vec2 vQ; void main(){ vQ = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: /* glsl */`uniform float uLen, uSoft, uHw; varying vec2 vQ;
        void main(){
          // a pale sheet with a wandering edge and a skater's white scratches: slippery reads from far off
          float e = 1.0 - smoothstep(uLen - 4.0 - 2.0 * sin(vQ.x * 0.9), uLen - 1.0 - 2.0 * sin(vQ.x * 0.9), abs(vQ.y));
          float g = sin(vQ.x * 2.1 + vQ.y * 0.33) * 0.5 + sin(vQ.x * 0.7 - vQ.y * 0.19 + 1.3) * 0.5, sc = smoothstep(0.82, 0.9, sin(vQ.y * 0.31 + vQ.x * 1.3 + g * 1.4));
          vec3 c = mix(vec3(0.58, 0.82, 0.95), vec3(0.8, 0.93, 1.0), g * 0.5 + 0.5); c = mix(c, vec3(1.0), sc * 0.85);
          if (uSoft > 0.0) { c = mix(c, c * vec3(0.62, 0.74, 0.86), uSoft); e *= mix(1.0, (1.0 - smoothstep(uHw - 3.4, uHw - 0.2, abs(vQ.x) + 0.9 * sin(vQ.y * 0.37) + 0.5 * sin(vQ.y * 1.1))) * 0.72, uSoft); }
          gl_FragColor = vec4(c, e * 0.86);
        }`,
    });
    const m = new THREE.Mesh(g, iceMat);
    m.renderOrder = 2;
    R.group.add(m);
    out.push(m);
  }
  const M = new THREE.Matrix4();
  steam.forEach((h, q) => {
    if (ventMesh) { M.makeTranslation(h.x, h.y + 0.02, h.z); ventMesh.setMatrixAt(q, M); }
  });
  if (ventMesh) ventMesh.instanceMatrix.needsUpdate = true;
  return {
    update(list, dt) {
      for (const h of list) {
        if (h.kind === 'steam') {
          const rnd = billows.rnd, V = shared.look?.vent;
          // look.vent: soft steam, the same air as the rest of the place's smoke, a column thick enough to read as a danger
          // look.vent.lit: thin steam that stands in the light: wider and fewer, warm on the side of the low sun and mauve on the other
          if (V?.lit) {
            const sa = (shared.look.sun?.azimuth ?? 0) * D2R, sx = Math.sin(sa), sz = -Math.cos(sa);
            if (h.active) for (let q = dt * 24 + rnd(); q >= 1; q--) {
              const a = rnd() * 6.283, r = rnd() * 1.1, on = Math.cos(a) * sx + Math.sin(a) * sz;
              fx.emit(0, h.x + Math.cos(a) * r, h.y + 0.5, h.z + Math.sin(a) * r, Math.cos(a) * 1.1, 7 + rnd() * 6, Math.sin(a) * 1.1, (1.8 + rnd() * 1.6) * (V.size ?? 1), on > 0.1 ? V.puffB : on > -0.4 ? V.puff : V.shade, 0.9 + rnd() * 0.7, 0, 0.7, 3.4);
            } else if (h.warn && rnd() < dt * 22) {
              const a = rnd() * 6.283, r = rnd() * 1.1;
              fx.emit(0, h.x + Math.cos(a) * r, h.y + 0.3, h.z + Math.sin(a) * r, 0, 2.2 + rnd() * 2, 0, 0.9 + rnd() * 0.6, V.puff, 0.6 + rnd() * 0.4, 0, 1, 1.4);
            }
          } else if (V) {
            if (h.active) for (let q = dt * 70 + rnd(); q >= 1; q--) {
              const a = rnd() * 6.283, r = rnd() * 0.9;
              fx.emit(0, h.x + Math.cos(a) * r, h.y + 0.5, h.z + Math.sin(a) * r, Math.cos(a) * 0.7, 9 + rnd() * 8, Math.sin(a) * 0.7, (1.3 + rnd() * 1.2) * (V.size ?? 1), rnd() < 0.3 ? V.puff : V.puffB, 0.8 + rnd() * 0.6, 0, 0.7, 2.6);
            } else if (h.warn && rnd() < dt * 22) {
              const a = rnd() * 6.283, r = rnd() * 1.1;
              fx.emit(0, h.x + Math.cos(a) * r, h.y + 0.3, h.z + Math.sin(a) * r, 0, 2.2 + rnd() * 2, 0, 0.8 + rnd() * 0.5, V.puff, 0.6 + rnd() * 0.4, 0, 1, 1.4);
            }
          } else if (h.active && rnd() < dt * 34) {
            const a = rnd() * 6.283, r = rnd() * 1.1;
            billows.emit(h.x + Math.cos(a) * r, h.y + 0.6, h.z + Math.sin(a) * r, Math.cos(a) * 0.5, 9 + rnd() * 6, Math.sin(a) * 0.5, (1 + rnd() * 0.9) * (shared.look?.vent?.size ?? 1), 0.9 + rnd() * 0.5, rnd() < 0.2 ? shared.look?.vent?.puff ?? '#fff4c6' : shared.look?.vent?.puffB ?? '#ffffff', 0.9);
          } else if (h.warn && rnd() < dt * 12) {
            const a = rnd() * 6.283, r = rnd() * 1.2;
            billows.emit(h.x + Math.cos(a) * r, h.y + 0.3, h.z + Math.sin(a) * r, 0, 2.4 + rnd() * 2, 0, 0.42 + rnd() * 0.4, 0.5 + rnd() * 0.3, shared.look?.vent?.puff ?? '#f6edb8', 0.6);
            if (rnd() < 0.4 && !shared.look?.vent) fx.sparks(h.x, h.y + 0.4, h.z, 1, '#fff2a8', 4);
          }
        } else if (h.kind === 'ice') {
          if (billows.rnd() < dt * 16) {
            const al = (billows.rnd() - 0.5) * h.r * 2, i = ((h.i + Math.round(al / T.step)) % n + n) % n, d = (billows.rnd() - 0.5) * S.w[i];
            fx.emit(1, S.x[i] + S.nx[i] * d, T.heightAt(i, d) + 0.25, S.z[i] + S.nz[i] * d, 0, 0.8, 0, 0.5 + billows.rnd() * 0.45, '#ffffff', 0.55, 0, 1);
          }
        }
      }
    },
    dispose() { if (ventMesh) { R.group.remove(ventMesh); ventMesh.dispose(); ventGeo.dispose(); } for (const m of out) { R.group.remove(m); m.geometry.dispose(); } iceMat?.dispose(); },
  };
}

// ---------- the whole thing ----------
export function planDisasters(world) {
  // the gully stays clear of trees and rocks, so that the flow comes down in plain sight, all race long
  const { track: T } = world, S = T.samples;
  for (const e of disasterEntries(T)) {
    if (!DISASTER_KINDS[e.kind].flow || !e.side) continue;
    const c = e.c, hw = S.w[c] / 2, half = e.len / 2;
    for (let m = 6; m <= e.source + 10; m += 12) {
      const fan = clamp(1 - m / (e.source * 0.55), 0, 1), r = Math.max(8, lerp(e.len * 0.16, half, fan) + 5);
      const d = e.side * (hw + m), x = S.x[c] + S.nx[c] * d, z = S.z[c] + S.nz[c] * d;
      world.keepOut.push({ x, z, r });
      if (fan > 0.3) for (const o of [-1, 1]) { const i = ((c + o * Math.round(half * 0.6 / T.step)) % T.n + T.n) % T.n; world.keepOut.push({ x: S.x[i] + S.nx[i] * d, z: S.z[i] + S.nz[i] * d, r: r * 0.7 }); }
    }
  }
}

export function createDisasterWorld({ track, terrain, look, mat, shared, scene, fx, world, state }) {
  const group = new THREE.Group();
  scene.add(group);
  const R = { track, terrain, look, mat, shared, group, fx };
  const billows = createBillows(scene, mat);
  R.billows = billows;
  const entries = disasterEntries(track), S = track.samples, n = track.n;
  const live = new Map();
  const rnd = billows.rnd;

  // signs: one well before the place, on the free lane's side when that is known, one at the place on the other
  const signs = new Map(), statics = [];
  for (const e of entries) {
    if (DISASTER_KINDS[e.kind].free) continue;
    const before = -(e.signLead ?? 45) - (e.len / 2), far = e.side ? -e.side : -1;
    const list = [createSign(R, e, before, far, e.signScale ?? 1)];
    signs.set(e.index, list);
    if (DISASTER_KINDS[e.kind].flow && e.side) statics.push(createGully(R, e));
  }
  const lanterns = createLanterns(R, entries);

  // the far plumes, one per entry that has one, hidden until it goes off
  const plumes = new Map();
  // lit by the sun like the rest, but outside the near ground's haze: it stands as far off as the painted mountains do
  const plumeMat = new THREE.ShaderMaterial({
    vertexColors: true, uniforms: { uSun: shared.sunDir },
    vertexShader: 'varying vec3 vN, vC; void main(){ vC = color; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 uSun; varying vec3 vN, vC; void main(){ float d = dot(normalize(vN), uSun), r = smoothstep(-0.25, 0.5, d); gl_FragColor = vec4(vC * mix(0.66, 1.28, r), 1.0); }',
  });
  for (const e of entries) {
    if (e.kind !== 'eruption' && e.kind !== 'cloud') continue;
    const at = plumePlace(R, e), geo = plumeGeometry(e.index + 3, e.kind === 'cloud' ? '#6d6670' : '#3e3940', e.kind === 'cloud' ? '#d8cfd6' : '#b5a7a8');
    const mesh = new THREE.Mesh(geo, plumeMat);
    mesh.frustumCulled = false; mesh.visible = false;
    const baseY = (at.near ? terrain.heightAt(at.x, at.z) : 0) + (e.baseY ?? 0);
    mesh.position.set(at.x, baseY, at.z);
    group.add(mesh);
    plumes.set(e.index, { mesh, geo, h: e.height ?? (e.kind === 'cloud' ? 1500 : 620), at, y: baseY });
  }

  // the pieces, instanced per role, and the marks they make on the road on their way down
  const pieceMeshes = new Map();
  const pieceMat = mat('#ffffff', { vertexColors: true, gloss: [24, 0.08] }), hotMat = mat('#ffffff', { vertexColors: true, emissive: '#ff6a1e', emissiveIntensity: 0, gloss: [24, 0.08] });
  const geoFor = (role) => {
    let e = pieceMeshes.get(role);
    if (!e) {
      const g = pieceGeometry[role](), m = new THREE.InstancedMesh(g, role === 'bomb' ? hotMat : pieceMat, 96);
      m.frustumCulled = false; m.count = 0;
      group.add(m);
      e = { g, m, used: 0 };
      pieceMeshes.set(role, e);
    }
    return e;
  };
  const markGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const aHot = new THREE.InstancedBufferAttribute(new Float32Array(160), 1).setUsage(THREE.DynamicDrawUsage), aU = new THREE.InstancedBufferAttribute(new Float32Array(160), 1).setUsage(THREE.DynamicDrawUsage);
  markGeo.setAttribute('aHot', aHot); markGeo.setAttribute('aU', aU);
  const markMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, uniforms: { uTime: shared.time },
    vertexShader: 'attribute float aHot, aU; varying vec2 vQ; varying float vH, vU; void main(){ vQ = position.xz * 2.0; vH = aHot; vU = aU; gl_Position = projectionMatrix * viewMatrix * instanceMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`uniform float uTime; varying vec2 vQ; varying float vH, vU;
      void main(){
        float r = length(vQ), w = max(fwidth(r), 0.01);
        // the shadow gathers towards the spot, and a ring closes on it as it comes: you can read the time from it
        float core = 1.0 - smoothstep(0.72 - w, 0.72 + w, r), ring = smoothstep(0.91 - w, 0.91, r) * (1.0 - smoothstep(0.97, 0.97 + w, r));
        float close = abs(r - mix(0.97, 0.12, vU)), chase = 1.0 - smoothstep(0.022, 0.03 + w, close);
        vec3 hot = mix(vec3(1.0, 0.78, 0.2), vec3(1.0, 0.36, 0.1), vH), col = mix(vec3(0.05, 0.03, 0.07), hot, max(ring, chase));
        float a = max(core * (0.5 + 0.3 * vU), max(ring, chase) * 0.95);
        if (a < 0.01) discard;
        gl_FragColor = vec4(col, a);
      }`,
  });
  const marks = new THREE.InstancedMesh(markGeo, markMat, 160);
  marks.frustumCulled = false; marks.count = 0; marks.renderOrder = 3;
  group.add(marks);

  // ash: the air itself. A dome over the far view and the fog over the near one, so that it really cuts how far you can see
  const domeGeo = new THREE.SphereGeometry(4600, 24, 14);
  const domeMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: true, side: THREE.BackSide, uniforms: { uA: { value: 0 }, uC: { value: new THREE.Color('#857d8c') }, uT: { value: new THREE.Color('#5a5362') } },
    vertexShader: 'varying float vH; void main(){ vH = normalize(position).y; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform float uA; uniform vec3 uC, uT; varying float vH; void main(){ gl_FragColor = vec4(mix(uC, uT, smoothstep(0.0, 0.5, vH)), uA * (0.7 + 0.3 * smoothstep(-0.1, 0.3, vH))); }',
  });
  const dome = new THREE.Mesh(domeGeo, domeMat);
  dome.frustumCulled = false; dome.visible = false; dome.renderOrder = 1;
  dome.onBeforeRender = (r, sc, camera) => { dome.position.copy(camera.position); dome.updateMatrixWorld(); dome.modelViewMatrix.multiplyMatrices(camera.matrixWorldInverse, dome.matrixWorld); };
  group.add(dome);
  const fogBase = { color: new THREE.Color(look.fog.color), density: look.fog.density, falloff: look.fog.heightFalloff, max: look.fog.max ?? 0.82 }, ashColor = new THREE.Color('#857d8c');
  let ashNow = 0;

  const hazardFx = createHazardFx(R, state.hazards || []);

  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), V = new THREE.Vector3();

  function makeLive(D) {
    const P0 = PALETTE[D.kind], L = { D, id: D.id, strip: null, flow: null, boomed: false };
    if (!D.free && P0.shade > 0) {
      const g = roadStrip(track, D.c, D.len), m = warnMaterial(shared);
      m.uniforms.uHot.value.set(SIGN_COLOR[D.kind]);
      m.uniforms.uShade.value = P0.shade;
      m.uniforms.uLen.value = D.len;
      m.uniforms.uGap.value.set(D.gapD, D.gapW, D.gapAmp, D.gapWave);
      const mesh = new THREE.Mesh(g, m);
      mesh.renderOrder = 2; mesh.frustumCulled = false;
      group.add(mesh);
      L.strip = { mesh, g, m };
    }
    if (D.flow) L.flow = createFlow(R, D, look.flowTone ?? 1);
    if (D.kind === 'quake') {
      const g = roadStrip(track, D.c, 6, 1), m = crackMaterial();
      m.uniforms.uStop.value.set(D.stop, D.side);
      const mesh = new THREE.Mesh(g, m);
      mesh.renderOrder = 3; mesh.frustumCulled = false;
      group.add(mesh);
      L.crack = { mesh, g, m };
    }
    return L;
  }
  function dropLive(L) {
    if (L.strip) { group.remove(L.strip.mesh); L.strip.g.dispose(); L.strip.m.dispose(); }
    if (L.crack) { group.remove(L.crack.mesh); L.crack.g.dispose(); L.crack.m.dispose(); }
    L.flow?.dispose();
    const p = plumes.get(L.D.entry);
    if (p) p.mesh.visible = false;
  }
  function crackMaterial() {
    return new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
      uniforms: { uOpen: { value: 0 }, uStop: { value: new THREE.Vector2() }, uHair: { value: 0 } },
      vertexShader: 'attribute float aD, aA; varying float vD, vA; void main(){ vD = aD; vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: /* glsl */`uniform float uOpen, uHair; uniform vec2 uStop; varying float vD, vA;
        void main(){
          float line = 1.3 * sin(vD * 1.3) + 0.9 * sin(vD * 2.9 + 1.0) + 0.5 * sin(vD * 6.7), reach = (vD - uStop.x) * uStop.y;
          float cut = smoothstep(-0.6, 0.6, reach);
          float width = max(uHair * 0.11, uOpen * 1.7 * (0.55 + 0.45 * sin(vD * 0.7 + 1.0))) * cut, off = abs(vA - line), w = max(fwidth(off), 0.015);
          float hole = 1.0 - smoothstep(width - w, width + w, off), lip = 1.0 - smoothstep(width + 0.1, width + 0.3 + w, off);
          vec3 c = mix(vec3(0.58, 0.54, 0.5), vec3(0.03, 0.02, 0.05), hole);
          float a = max(hole, lip * 0.75 * step(0.001, width));
          if (a < 0.01) discard;
          gl_FragColor = vec4(c, a);
        }`,
    });
  }

  function stepPieces(list, dt, time) {
    for (const e of pieceMeshes.values()) e.used = 0;
    let markN = 0;
    for (const D of list) {
      for (const p of D.pieces) {
        const left = p.t0 - D.t;
        // every thing falling shows its mark first
        if (p.st === 0 && left <= 2.1 && (p.role === 'bomb' || p.role === 'tile' || (p.role === 'boulder' && !D.flow)) && markN < 160) {
          const u = clamp(1 - left / 2.1, 0, 1), s = (p.r + 0.7) * 2.1;
          M.compose(P.set(p.gx, p.gy + 0.12, p.gz), Q.identity(), V.set(s, 1, s));
          marks.setMatrixAt(markN, M); aHot.setX(markN, p.role === 'bomb' ? 1 : 0); aU.setX(markN, u);
          markN++;
        }
        if (p.a <= 0 && p.st === 0) continue;
        const cooled = p.role === 'bomb' && p.st === 1 && D.t - p.t0 > 4.5, role = cooled ? 'cold' : p.role, e = geoFor(role);
        if (e.used >= 96) continue;
        const turn = (D.t - (p.t0 - p.dur)) * (p.role === 'bank' ? 1.2 : 4.5), roll = p.st === 1 ? clamp(p.t0 - (p.t0 - p.dur), 0, 9) * (p.role === 'bank' ? 1.2 : 4.5) : turn;
        E.set(roll + p.yaw, p.yaw * 2.3, roll * 0.6); Q.setFromEuler(E);
        const r = p.role === 'log' ? 1 : p.role === 'tile' ? 0.92 : p.r;
        M.compose(P.set(p.x, p.y + (p.role === 'tile' ? 0.3 : p.r * 0.5), p.z), Q, V.setScalar(r));
        e.m.setMatrixAt(e.used++, M);
        // a lava bomb trails fire on its way down
        if (p.role === 'bomb' && p.st === 0 && rnd() < dt * 60) {
          fx.emit(4, p.x, p.y + p.r, p.z, 0, 2, 0, 0.8 + rnd() * 0.6, rnd() < 0.3 ? '#ffe9a0' : '#ff7a24', 0.3, 0, 0.8, -0.7);
          if (rnd() < 0.3) billows.emit(p.x, p.y + p.r, p.z, 0, 1.5, 0, 0.5 + rnd() * 0.4, 0.8 + rnd() * 0.4, '#4a444e', 0.9);
        }
        if (p.role === 'bomb' && p.st === 1 && !cooled && rnd() < dt * 5) fx.emit(4, p.x + (rnd() - 0.5) * p.r, p.y + p.r * 0.9, p.z + (rnd() - 0.5) * p.r, 0, 1.6, 0, 0.7, '#ff8a2a', 0.5, 0, 0.8, -0.5);
      }
    }
    for (const e of pieceMeshes.values()) { e.m.count = e.used; e.m.instanceMatrix.needsUpdate = true; }
    hotMat.emissiveIntensity = 0;
    marks.count = markN;
    marks.instanceMatrix.needsUpdate = true; aHot.needsUpdate = true; aU.needsUpdate = true;
  }

  function emitFor(L, dt, time) {
    const D = L.D, T = track, k = PALETTE[D.kind], c = D.c, hw = S.w[c] / 2, puff = (look.flowTone && D.flow) ? (L.puff ??= k.puff.map((h) => `#${new THREE.Color(h).multiplyScalar(look.flowTone).getHexString()}`)) : k.puff, pick = () => puff[Math.floor(rnd() * puff.length)];
    const strike = D.phase === 'strike', warn = D.phase === 'warn';
    if (D.flow) {
      const crossing = Math.abs(D.front - D.stop) > 0.2 && D.phase !== 'after';
      const rate = crossing ? (D.kind === 'avalanche' ? 240 : D.kind === 'lahar' || D.kind === 'banjir' ? 46 : 130) : strike ? 18 : 0;
      for (let q = rate * dt + rnd(); q >= 1; q--) {
        // along the head of the flow: dust where it moves, more where it meets the road
        const a = rnd() * 2 - 1, m = Math.max(0, (D.front - D.side * hw) * D.side), fan = clamp(1 - m / (D.source * 0.55), 0, 1) ** 0.7, half = lerp(Math.max(4, D.len * 0.16), D.len / 2, fan);
        const o = a * half / T.step, f = ((c + o) % n + n) % n, i = Math.round(f) % n, d = D.front + D.side * (1 + rnd() * 3.2), x = S.x[i] + S.nx[i] * d, z = S.z[i] + S.nz[i] * d;
        const y = Math.abs(d) < S.w[i] / 2 ? T.heightAt(f, d) : terrain.heightAt(x, z);
        // up and back over the flow: the free lane stays in the clear
        const out = D.side * (0.5 + rnd() * 2), big = D.kind === 'avalanche' ? 1.3 : D.kind === 'lahar' || D.kind === 'banjir' ? 0.42 : 1;
        billows.emit(x, y + 0.8 + rnd() * 1.4, z, S.nx[i] * out + (rnd() - 0.5) * 2, 2.4 + rnd() * (D.kind === 'avalanche' ? 6 : 4), S.nz[i] * out + (rnd() - 0.5) * 2, big * (0.55 + rnd() * 0.8), (D.kind === 'lahar' ? 0.7 : 0.9) + rnd() * 0.7, pick(), 1.2);
      }
      // a lahar steams, hot from the mountain
      if (D.kind === 'lahar' && D.phase !== 'after' && rnd() < dt * 26) {
        const o = (rnd() - 0.5) * D.len / T.step, f = ((c + o) % n + n) % n, i = Math.round(f) % n, a = rnd(), d = lerp(D.front, D.side * hw, a), x = S.x[i] + S.nx[i] * d, z = S.z[i] + S.nz[i] * d;
        billows.emit(x, S.y[i] + 0.8, z, 0, 3 + rnd() * 3, 0, 0.35 + rnd() * 0.45, 0.9 + rnd() * 0.5, '#f4efe6', 0.8);
      }
    } else if (D.kind === 'rockfall' && (warn || strike)) {
      // dust off the cliff side while the stones let go
      if (rnd() < dt * 30) {
        const o = (rnd() - 0.5) * D.len / T.step, f = ((c + o) % n + n) % n, i = Math.round(f) % n, d = D.side * (S.w[i] / 2 + 20 + rnd() * 22), x = S.x[i] + S.nx[i] * d, z = S.z[i] + S.nz[i] * d;
        billows.emit(x, terrain.heightAt(x, z) + 2 + rnd() * 7, z, S.nx[i] * D.side, 1.5 + rnd() * 2, S.nz[i] * D.side, 0.9 + rnd() * 1.1, 0.9 + rnd() * 0.7, pick(), 0.8);
      }
    } else if (D.kind === 'quake' && (warn || strike)) {
      // the road's edges puff dust as they shake
      const rate = warn ? 14 : 36;
      for (let q = rate * dt + rnd(); q >= 1; q--) {
        const o = (rnd() - 0.5) * (D.len + 40) / T.step, f = ((c + o) % n + n) % n, i = Math.round(f) % n, d = (rnd() < 0.5 ? -1 : 1) * (S.w[i] / 2 + 0.6 + rnd() * 2.4), x = S.x[i] + S.nx[i] * d, z = S.z[i] + S.nz[i] * d;
        billows.emit(x, S.y[i] + 0.2, z, 0, 1 + rnd() * 1.4, 0, 0.22 + rnd() * 0.3, 0.45 + rnd() * 0.25, pick(), 1);
      }
      if (D.open > 0.2 && rnd() < dt * 14) {
        const d = D.stop + D.side * rnd() * Math.max(2, (hw - D.stop * D.side)), x = S.x[c] + S.nx[c] * d, z = S.z[c] + S.nz[c] * d;
        billows.emit(x, S.y[c] + 0.2, z, 0, 2.6 + rnd() * 2, 0, 0.35 + rnd() * 0.4, 0.6, pick(), 1);
      }
    }
    // the plumes rise out of the mountain, a column that keeps building
    const pl = plumes.get(D.entry);
    if (pl) {
      const rise = D.kind === 'cloud' ? smooth(0, D.warn + D.strike * 0.9, D.t) : smooth(0, D.warn + 1.6, D.t), leave = 1 - smooth(D.warn + D.strike + D.after * 0.7, D.warn + D.strike + D.after, D.t);
      const s = pl.h * (0.12 + 0.88 * rise) * leave, w = pl.h * (0.4 + 0.6 * rise) * leave;
      pl.mesh.visible = leave > 0.01;
      pl.mesh.scale.set(w * (1 + 0.012 * Math.sin(time * 0.9)), s, w * (1 + 0.012 * Math.cos(time * 0.8)));
      pl.mesh.rotation.y = time * 0.012;
    }
  }

  // ash falling all round each view: flakes close by, so it is in the air you drive through, not a filter
  function ashFall(amount, karts, views, dt) {
    if (amount < 0.02) return;
    for (const v of views) {
      const k = karts[v.kart];
      if (!k) continue;
      const fx0 = Math.sin(k.yaw), fz0 = Math.cos(k.yaw);
      for (let q = amount * 90 * dt + rnd(); q >= 1; q--) {
        const f = 6 + rnd() * 40, sd = (rnd() - 0.5) * 34;
        fx.emit(0, k.x + fx0 * f + fz0 * sd, k.y + 2 + rnd() * 14, k.z + fz0 * f - fx0 * sd, (rnd() - 0.5) * 1.2, -2.6 - rnd() * 1.6, (rnd() - 0.5) * 1.2, 0.2 + rnd() * 0.22, rnd() < 0.4 ? '#4a4450' : '#9a939e', 2 + rnd() * 1.2, 0, 0.2, 0);
      }
    }
  }

  function applyAsh(amount, dt) {
    ashNow = lerp(ashNow, amount, clamp(dt * 1.6, 0, 1));
    if (ashNow < 0.004) {
      if (dome.visible) {
        dome.visible = false;
        shared.fog.uFogColor.value.copy(fogBase.color); shared.fog.uFogDensity.value = fogBase.density; shared.fog.uFogFalloff.value = fogBase.falloff; shared.fog.uFogMax.value = fogBase.max;
      }
      return;
    }
    dome.visible = true;
    domeMat.uniforms.uA.value = 0.9 * smooth(0, 0.9, ashNow);
    shared.fog.uFogColor.value.copy(fogBase.color).lerp(ashColor, smooth(0, 0.5, ashNow));
    shared.fog.uFogDensity.value = fogBase.density + 0.0085 * ashNow * ashNow;
    shared.fog.uFogFalloff.value = lerp(fogBase.falloff, 0.0008, smooth(0, 0.6, ashNow));
    shared.fog.uFogMax.value = lerp(fogBase.max, 0.86, smooth(0, 0.6, ashNow));
  }

  const seen = new Set();
  function update(st, karts, views, time, dt) {
    const list = st.disasters || [];
    seen.clear();
    for (const D of list) {
      seen.add(D.id);
      let L = live.get(D.id);
      if (!L) { L = makeLive(D); live.set(D.id, L); }
      L.D = D;
      if (L.strip) {
        const after = D.t - D.warn - D.strike, u = L.strip.m.uniforms;
        u.uK.value = smooth(0, 0.5, D.t) * (1 - smooth(0.5, 3.5, after));
        L.strip.mesh.visible = u.uK.value > 0.002;
      }
      L.flow?.update(time);
      if (L.crack) { L.crack.m.uniforms.uOpen.value = D.open; L.crack.m.uniforms.uHair.value = smooth(0, D.warn, D.t) * (D.phase === 'after' ? clamp(1 - (D.t - D.warn - D.strike) / 3, 0, 1) : 1); }
      emitFor(L, dt, time);
    }
    for (const [id, L] of live) if (!seen.has(id)) { dropLive(L); live.delete(id); }
    // the signs of what is on
    for (const [idx, ss] of signs) { const on = list.some((D) => D.entry === idx && D.phase !== 'after'); for (const s of ss) s.update(on, time); }
    stepPieces(list, dt, time);
    lanterns?.update(st.quake || 0, time);
    hazardFx.update(st.hazards || [], dt);
    applyAsh(st.ash || 0, dt);
    ashFall(st.ash || 0, karts, views, dt);
    billows.update(dt);
    world.quake = st.quake || 0;
    world.ash = ashNow;
  }

  // what an event throws up when it lands
  function onEvent(e) {
    if (e.type !== 'boom') return;
    if (e.kind === 'bomb') {
      for (let q = 0; q < 12; q++) { const a = rnd() * 6.283, sp = 2 + rnd() * 5; billows.emit(e.x, e.y + 0.8, e.z, Math.cos(a) * sp, 2 + rnd() * 5, Math.sin(a) * sp, 0.4 + rnd() * 0.55, 0.45 + rnd() * 0.4, rnd() < 0.35 ? '#ffb04a' : '#6a6470', 1.5); }
    } else if (e.kind === 'boulder' || e.kind === 'rock' || e.kind === 'log') {
      for (let q = 0; q < 8; q++) { const a = rnd() * 6.283, sp = 2 + rnd() * 4; billows.emit(e.x, e.y + 0.6, e.z, Math.cos(a) * sp, 1 + rnd() * 3, Math.sin(a) * sp, 0.7 + rnd() * 0.8, 0.5 + rnd() * 0.5, rnd() < 0.5 ? '#b5a999' : '#cdc2b4', 1.6); }
    } else if (e.kind === 'snow' || e.kind === 'bank') {
      for (let q = 0; q < 12; q++) { const a = rnd() * 6.283, sp = 3 + rnd() * 6; billows.emit(e.x, e.y + 0.8, e.z, Math.cos(a) * sp, 2 + rnd() * 5, Math.sin(a) * sp, 0.8 + rnd() * 0.9, 0.5 + rnd() * 0.5, rnd() < 0.5 ? '#ffffff' : '#e6f0f8', 1.6); }
    } else if (e.kind === 'tile') {
      for (let q = 0; q < 5; q++) { const a = rnd() * 6.283, sp = 2 + rnd() * 3; billows.emit(e.x, e.y + 0.4, e.z, Math.cos(a) * sp, 1 + rnd() * 2, Math.sin(a) * sp, 0.4 + rnd() * 0.4, 0.4 + rnd() * 0.3, rnd() < 0.5 ? '#c9623a' : '#d9c8b2', 1.6); }
    }
  }

  function dispose() {
    for (const L of live.values()) dropLive(L);
    live.clear();
    for (const ss of signs.values()) for (const s of ss) s.dispose();
    for (const s of statics) s.dispose();
    lanterns?.dispose();
    hazardFx.dispose();
    for (const p of plumes.values()) { group.remove(p.mesh); p.geo.dispose(); }
    plumeMat.dispose();
    for (const e of pieceMeshes.values()) { group.remove(e.m); e.m.dispose(); e.g.dispose(); }
    marks.dispose(); markGeo.dispose(); markMat.dispose();
    group.remove(dome); domeGeo.dispose(); domeMat.dispose();
    billows.dispose();
    scene.remove(group);
  }
  return { update, onEvent, dispose, group, billows, get gapAt() { return disasterGap; } };
}
