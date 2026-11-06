// Effects, one pooled point cloud shared by the views plus a few per-kart meshes: tyre smoke and sparks by drift tier,
// surface dust, boost flames, confetti at the finish, cartoon POF stars on hits, the item effects. Blob shadows under every
// kart. Fixed-size typed arrays, a ring buffer, no allocation per frame.
import * as THREE from 'three';
import { hash3, clamp } from './math.js';
import { FOG_GLSL } from './toon.js';

const KIND = { puff: 0, spark: 1, star: 2, confetti: 3, flame: 4 };
const TIER = ['#cfd4e0', '#68c6ff', '#ff9c3a', '#e668ff'];
// a drift by tier: the smoke barely takes the colour, the sparks come harder, bigger and further
const TIER_SMOKE = ['#f7f3ec', '#e6f4ff', '#ffeeda', '#fae6ff'];
const SPARK_RATE = [0, 20, 38, 62], SPARK_SIZE = [0, 0.2, 0.28, 0.38], SPARK_SPEED = [0, 1, 1.3, 1.65];
const PUFF_PEAK = 0.92, SOFT_PUFF_PEAK = 0.62;
const SURFACE_DUST = { dirt: '#c39a68', grass: '#b7b56c', sand: '#d8c49a', snow: '#f4f7fb', ice: '#dff1fa', wood: '#b58c62', cobble: '#b7aca0', asphalt: '#c7c2c6' };
const CONFETTI = ['#ff5a5f', '#ffc53d', '#4aa6f2', '#62c56e', '#f28bbd', '#ffffff'];

export function createFx(shared, { max = 2600 } = {}) {
  const N = max, pos = new Float32Array(N * 3), vel = new Float32Array(N * 3), col = new Float32Array(N * 3), life = new Float32Array(N), age = new Float32Array(N).fill(1e9);
  const size = new Float32Array(N), grow = new Float32Array(N), alpha = new Float32Array(N), kind = new Float32Array(N), rot = new Float32Array(N), spin = new Float32Array(N), grav = new Float32Array(N), drag = new Float32Array(N), sz = new Float32Array(N);
  const geo = new THREE.BufferGeometry();
  const aP = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage), aC = new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage);
  const aS = new THREE.BufferAttribute(sz, 1).setUsage(THREE.DynamicDrawUsage), aA = new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage);
  const aK = new THREE.BufferAttribute(kind, 1).setUsage(THREE.DynamicDrawUsage), aR = new THREE.BufferAttribute(rot, 1).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', aP); geo.setAttribute('aColor', aC); geo.setAttribute('aSize', aS); geo.setAttribute('aAlpha', aA); geo.setAttribute('aKind', aK); geo.setAttribute('aRot', aR);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    // alpha is taken out of the target as well: the outline pass then does not draw through smoke
    blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    uniforms: { ...shared.fog, uScale: { value: 500 }, uSoftPuff: { value: 0 }, uFxTint: { value: new THREE.Color(1, 1, 1) } }, // uFxTint: smoke has no light of its own, at night it takes the night's
    vertexShader: /* glsl */`attribute float aSize, aAlpha, aKind, aRot; attribute vec3 aColor; uniform float uScale; varying float vA, vK, vR, vZ, vY; varying vec3 vC;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vC = aColor; vK = aKind; vR = aRot; vZ = -mv.z; vY = position.y;
        vA = aAlpha * smoothstep(2.2, 5.0, -mv.z);
        gl_PointSize = clamp(aSize * uScale / max(-mv.z, 0.1), 0.0, 130.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */`
      ${FOG_GLSL}
      uniform float uSoftPuff; uniform vec3 uFxTint;
      varying float vA, vK, vR, vZ, vY; varying vec3 vC;
      float lobe(vec2 p, vec2 c, float r){ vec2 d = p - c; float v = 1.0 - dot(d, d) / (r * r); return v > 0.0 ? v * v : 0.0; }
      float star(vec2 p, float r, float rf){ float a = atan(p.x, p.y), s = 6.2832 / 5.0, h = mod(a, s) - s * 0.5; return length(p) * cos(h) - mix(r * rf, r, abs(h) / (s * 0.5)); }
      void main(){
        vec2 q = gl_PointCoord * 2.0 - 1.0; float c = cos(vR), s = sin(vR); vec2 p = vec2(c * q.x - s * q.y, s * q.x + c * q.y);
        float a = 1.0; vec3 col = vC;
        if (vK < 0.5) { // a cartoon puff: three soft round lobes melted together, nearly solid in the middle, bright on top with a shaded foot
          float r = dot(q, q); if (r > 1.0) discard;
          float f = lobe(p, vec2(-0.3, 0.1), 0.62) + lobe(p, vec2(0.3, 0.14), 0.58) + lobe(p, vec2(0.02, -0.26), 0.66) + lobe(p, vec2(0.0, 0.26), 0.56);
          a = smoothstep(0.08, 0.7, f);
          col *= 0.74 + 0.34 * (1.0 - smoothstep(-0.8, 0.75, q.y)) + 0.07 * smoothstep(0.6, 1.3, f);
          // look.softPuff: dust and not soap bubbles: no disc to see, a lumpy edge, thinner; none by default
          if (uSoftPuff > 0.0) { float lump = 0.72 + 0.28 * sin(p.x * 5.0 + vR * 3.0) * sin(p.y * 6.0 - vR * 2.0); a = pow(max(1.0 - r / lump, 0.0), 1.6) * 0.8; col = mix(col, vec3(dot(col, vec3(0.33))), 0.2); if (uSoftPuff > 1.5) a *= 0.55 * smoothstep(-0.7, 0.7, sin(p.x * 13.0 + vR * 5.0) * sin(p.y * 11.0 - vR * 3.0) + sin((p.x + p.y) * 7.0 + vR)); } // softPuff 2: torn wisps
        } else if (vK < 1.5) { // a spark: a hot stretched diamond
          float d = abs(p.x) * 3.6 + abs(p.y); if (d > 1.0) discard; a = 1.0 - smoothstep(0.6, 1.0, d); col = mix(vec3(1.0, 0.98, 0.9), col * 1.25, smoothstep(0.1, 0.6, d));
        } else if (vK < 2.5) { // POF star: yellow with an ink edge
          float d = star(p, 0.9, 0.48); if (d > 0.0) discard; col = mix(vec3(0.05, 0.04, 0.06), col, smoothstep(-0.02, -0.14, d));
        } else if (vK < 3.5) { // confetti: a little turning card
          if (abs(p.x) > 0.62 || abs(p.y) > 0.32 * (0.4 + 0.6 * abs(cos(vR * 2.3)))) discard;
        } else { // a flame's tongue
          float r = dot(q, q); if (r > 1.0) discard; a = pow(1.0 - r, 1.5); col *= 2.6;
        }
        if (vK < 0.5) col *= uFxTint;
        gl_FragColor = vec4(applyFog(col, vZ, vY), a * vA);
      }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false; points.renderOrder = 5;
  let head = 0, seed = 1, live = 0;
  const rnd = () => hash3(seed++, 17, 5);
  const color = new THREE.Color();

  function emit(k, x, y, z, vx, vy, vz, s, hex, l, g = 0, d = 1.6, gr = 0) {
    const i = head; head = (head + 1) % N;
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz;
    color.set(hex); col[i * 3] = color.r; col[i * 3 + 1] = color.g; col[i * 3 + 2] = color.b;
    age[i] = 0; life[i] = l; size[i] = s; kind[i] = k; grav[i] = g; drag[i] = d; grow[i] = gr;
    rot[i] = rnd() * 6.28; spin[i] = (rnd() - 0.5) * 7;
  }
  function pof(x, y, z, n = 9) {
    for (let q = 0; q < n; q++) {
      const a = (q / n) * 6.283 + rnd() * 0.5, sp = 5 + rnd() * 5;
      emit(KIND.star, x, y + 1, z, Math.cos(a) * sp, 3 + rnd() * 5, Math.sin(a) * sp, 0.8 + rnd() * 0.5, q % 2 ? '#ffe45c' : '#ffb13a', 0.7 + rnd() * 0.3, 11, 2.2);
    }
    for (let q = 0; q < 8; q++) {
      const a = rnd() * 6.283, sp = 2 + rnd() * 3;
      emit(KIND.puff, x, y + 0.8, z, Math.cos(a) * sp, 1 + rnd() * 2, Math.sin(a) * sp, 1.1 + rnd() * 0.9, '#f4efe6', 0.55 + rnd() * 0.3, 0, 3, 1.6);
    }
  }
  // A kart is hit: one big star on the spot for a blink, a wider burst of little ones, a thick ring of puffs.
  function impact(x, y, z, big) {
    emit(KIND.star, x, y + 1.2, z, 0, 0, 0, big ? 5.2 : 4, '#fff27a', 0.26, 0, 1);
    emit(KIND.star, x, y + 1.2, z, 0, 0, 0, big ? 3.2 : 2.4, '#ff8a2a', 0.2, 0, 1);
    pof(x, y, z, big ? 16 : 12);
    for (let q = 0; q < 10; q++) {
      const a = (q / 10) * 6.283, sp = 6 + rnd() * 2.5;
      emit(KIND.puff, x, y + 0.6, z, Math.cos(a) * sp, 0.6 + rnd(), Math.sin(a) * sp, 1 + rnd() * 0.6, '#fbf6ec', 0.5 + rnd() * 0.25, 0, 4, 1.2);
    }
  }
  function sparks(x, y, z, n, hex, sp = 8) {
    for (let q = 0; q < n; q++) { const a = rnd() * 6.283; emit(KIND.spark, x, y, z, Math.cos(a) * sp * rnd(), 2 + rnd() * sp * 0.6, Math.sin(a) * sp * rnd(), 0.28 + rnd() * 0.25, hex, 0.25 + rnd() * 0.25, 14, 1); }
  }
  function confetti(x, y, z, n = 90) {
    for (let q = 0; q < n; q++) {
      const a = rnd() * 6.283, sp = 2 + rnd() * 7;
      emit(KIND.confetti, x + Math.cos(a) * 1.5, y + 2 + rnd() * 2, z + Math.sin(a) * 1.5, Math.cos(a) * sp, 7 + rnd() * 9, Math.sin(a) * sp, 0.44 + rnd() * 0.3, CONFETTI[Math.floor(rnd() * CONFETTI.length)], 2.4 + rnd() * 1.4, 5.5, 2.2);
    }
  }
  function dust(x, y, z, vx, vz, surface, n = 6, s = 0.8) {
    const hex = shared.look?.dust?.[surface] || SURFACE_DUST[surface] || SURFACE_DUST.asphalt;
    // look.road.snowSpray: a small kick on snow is a burst of flakes; only what bursts a bank keeps the big puffs
    if (shared.look?.road?.snowSpray && s <= 1 && (surface === 'snow' || surface === 'ice' || shared.look.road.snowSpray === 'all')) {
      for (let q = 0; q < n * 3; q++) { const a = rnd() * 6.283, sp = 0.6 + rnd() * 2.6; emit(KIND.puff, x + (rnd() - 0.5) * 0.9, y + 0.15, z + (rnd() - 0.5) * 0.9, vx * 0.5 + Math.cos(a) * sp, 1.4 + rnd() * 3, vz * 0.5 + Math.sin(a) * sp, 0.07 + rnd() * 0.1, hex, 0.35 + rnd() * 0.3, 8, 1, 0.5); }
      return;
    }
    for (let q = 0; q < n; q++) {
      const a = rnd() * 6.283, sp = 0.5 + rnd() * 1.6;
      emit(KIND.puff, x + (rnd() - 0.5) * 0.8, y + 0.5, z + (rnd() - 0.5) * 0.8, vx * 0.15 + Math.cos(a) * sp, 0.8 + rnd() * 1.3, vz * 0.15 + Math.sin(a) * sp, s * (0.7 + rnd() * 0.7), hex, 0.6 + rnd() * 0.5, -0.6, 2.4, 1.4);
    }
  }

  // Per-kart emission: called once per frame for each kart, from its interpolated state.
  const carry = new Float32Array(32 * 4);
  function kart(i, k, dt) {
    const sp = Math.hypot(k.vx, k.vz);
    const fx = Math.sin(k.yaw), fz = Math.cos(k.yaw), sx = fz, sz = -fx; // sx, sz: to the kart's left
    if (k.drift && k.grounded) {
      const tier = k.driftTier | 0, wheel = () => { const side = rnd() < 0.5 ? -1 : 1; return [k.x - fx * 0.9 + sx * side * 0.8, k.z - fz * 0.9 + sz * side * 0.8]; }, y = k.y + 0.42;
      const flakes = shared.look?.road?.snowSpray && (k.surface === 'snow' || k.surface === 'ice' || shared.look.road.snowSpray === 'all');
      // snow is a spray of fine flakes; anywhere else a few round, chunky puffs read better than many thin ones
      carry[i * 4] += dt * (flakes ? 26 : 13 + tier * 2);
      while (carry[i * 4] >= 1) {
        carry[i * 4] -= 1;
        const [wx, wz] = wheel();
        if (flakes) emit(KIND.puff, wx, y - 0.25, wz, k.vx * 0.5 + (rnd() - 0.5) * 3, 1.6 + rnd() * 3, k.vz * 0.5 + (rnd() - 0.5) * 3, 0.08 + rnd() * 0.1, '#fbfcff', 0.3 + rnd() * 0.25, 8, 1, 0.5);
        else emit(KIND.puff, wx, y, wz, k.vx * 0.55 - fx * 1.5 + (rnd() - 0.5) * 1.4, 0.7 + rnd() * 1.1, k.vz * 0.55 - fz * 1.5 + (rnd() - 0.5) * 1.4, 0.46 + rnd() * 0.34, TIER_SMOKE[tier], 0.34 + rnd() * 0.24, -0.4, 2.4, 1.5);
      }
      carry[i * 4 + 3] += dt * SPARK_RATE[tier];
      while (carry[i * 4 + 3] >= 1) {
        carry[i * 4 + 3] -= 1;
        const [wx, wz] = wheel(), go = SPARK_SPEED[tier];
        emit(KIND.spark, wx, y, wz, k.vx * 0.8 - fx * sp * 0.2 + (rnd() - 0.5) * 6 * go, (2.5 + rnd() * 4.5) * go, k.vz * 0.8 - fz * sp * 0.2 + (rnd() - 0.5) * 6 * go, SPARK_SIZE[tier] * (0.8 + rnd() * 0.5), TIER[tier], 0.26 + rnd() * 0.24, 14, 1);
      }
    }
    const offroad = k.offroad || ['dirt', 'sand', 'snow', 'grass'].includes(k.surface);
    if (k.grounded && sp > 8 && offroad) {
      carry[i * 4 + 1] += dt * sp * 0.75;
      while (carry[i * 4 + 1] >= 1) {
        carry[i * 4 + 1] -= 1;
        const side = rnd() < 0.5 ? -1 : 1;
        // look.road.snowSpray: powder is thrown up in a fan of fine flakes that fall back, not rolled out in balls
        if (shared.look?.road?.snowSpray && (k.surface === 'snow' || k.surface === 'ice' || shared.look.road.snowSpray === 'all')) {
          for (let q = 0; q < 3; q++) emit(KIND.puff, k.x - fx * 1.0 + sx * side * 0.75 + (rnd() - 0.5) * 0.4, k.y + 0.12, k.z - fz * 1.0 + sz * side * 0.75 + (rnd() - 0.5) * 0.4, k.vx * 0.55 + sx * side * (0.5 + rnd() * 2.4), 1.6 + rnd() * 3.2, k.vz * 0.55 + sz * side * (0.5 + rnd() * 2.4), 0.07 + rnd() * 0.09, '#fbfcff', 0.35 + rnd() * 0.3, 8, 1, 0.5);
          continue;
        }
        dust(k.x - fx * 1.0 + sx * side * 0.75, k.y, k.z - fz * 1.0 + sz * side * 0.75, -k.vx * 0.5, -k.vz * 0.5, k.surface === 'grass' && offroad ? 'grass' : k.surface, 1, 0.5);
      }
    }
    if (k.boostT > 0) {
      const power = (k.boostTier || 1) - 1; // a bigger turbo throws more flame, and bigger
      carry[i * 4 + 2] += dt * (36 + power * 16);
      while (carry[i * 4 + 2] >= 1) {
        carry[i * 4 + 2] -= 1;
        const side = rnd() < 0.5 ? -1 : 1, hot = k.boostKind === 'sambal' ? '#ff5a24' : k.boostKind === 'zuica' ? '#ff9c5a' : '#ffb13a';
        emit(KIND.flame, k.x - fx * 1.2 + sx * side * 0.32, k.y + 0.55, k.z - fz * 1.2 + sz * side * 0.32, -fx * 8 + k.vx * 0.85, 0.3, -fz * 8 + k.vz * 0.85, (0.56 + rnd() * 0.42) * (1 + power * 0.3), hot, 0.14 + rnd() * 0.12, 0, 0.6, -1.6);
      }
    }
    // the Logan's exhaust coughs blue-grey all race, in soft puffs a chasing driver drives through
    if (k.kart === 'logan' && rnd() < dt * (5 + sp * 0.4)) emit(KIND.puff, k.x - fx * 1.9 + sx * 0.6, k.y + 0.4, k.z - fz * 1.9 + sz * 0.6, k.vx * 0.72 - fx * 1.5, 0.5 + rnd() * 0.7, k.vz * 0.72 - fz * 1.5, 0.42 + rnd() * 0.3, '#7d8090', 0.55 + rnd() * 0.3, -0.3, 1.2, 1.8);
    if (k.tipsyT > 0 || k.stinkT > 0) {
      if (rnd() < dt * 7) emit(KIND.puff, k.x, k.y + 1.9, k.z, (rnd() - 0.5) * 1, 1.1, (rnd() - 0.5) * 1, 0.42, k.stinkT > 0 ? '#c2d467' : '#ffe6a6', 0.7, -0.4, 1, 1);
    }
    // a sooty face: black smoke coming off a kart that met the sambal
    if (k.sootT > 0 && rnd() < dt * 22) emit(KIND.puff, k.x + (rnd() - 0.5) * 0.8, k.y + 1.3, k.z + (rnd() - 0.5) * 0.8, k.vx * 0.5, 1.8 + rnd(), k.vz * 0.5, 0.5 + rnd() * 0.3, '#2c2a30', 0.8, -0.3, 1, 1.4);
    // the pan sizzles: gold specks flying off the big kart
    if (k.bigT > 0 && rnd() < dt * 26) emit(KIND.spark, k.x + (rnd() - 0.5) * 2.4, k.y + 1 + rnd() * 1.4, k.z + (rnd() - 0.5) * 2.4, k.vx * 0.7 + (rnd() - 0.5) * 3, 3 + rnd() * 4, k.vz * 0.7 + (rnd() - 0.5) * 3, 0.3 + rnd() * 0.2, rnd() < 0.5 ? '#ffe45c' : '#ffb13a', 0.45, 10, 0.8);
  }

  // Shots and warnings: what flies has a trail, what is about to fall shows dust on the road. Once per frame.
  function objects(state, karts, dt) {
    for (const s of state.shots || []) {
      if (s.kind === 'razzo') {
        const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw);
        const n = Math.max(1, Math.round(dt * 110));
        for (let q = 0; q < n; q++) {
          const b = 1.0 + rnd() * 1.2;
          emit(KIND.flame, s.x - fx * b, s.y + (rnd() - 0.5) * 0.16, s.z - fz * b, -fx * 9, 0, -fz * 9, 0.62 + rnd() * 0.4, rnd() < 0.3 ? '#ffe9a0' : '#ff8a2a', 0.2 + rnd() * 0.12, 0, 0.5, -1.2);
          if (q % 2 === 0) emit(KIND.puff, s.x - fx * (b + 1), s.y, s.z - fz * (b + 1), (rnd() - 0.5), 0.6 + rnd() * 0.6, (rnd() - 0.5), 0.46 + rnd() * 0.3, '#ece6dc', 0.7 + rnd() * 0.4, -0.3, 1.6, 1.8);
        }
      } else if (s.kind === 'rendang') {
        // a smell you can see, drifting to the kart it is dragging towards
        const o = s.target >= 0 ? karts[s.target] : null;
        if (rnd() < dt * 26) {
          const a = o ? rnd() : 0, x = o ? s.x + (o.x - s.x) * a : s.x, z = o ? s.z + (o.z - s.z) * a : s.z, y = o ? s.y + (o.y + 1.4 - s.y) * a : s.y + 0.6;
          emit(KIND.puff, x + (rnd() - 0.5) * 1.2, y + (rnd() - 0.5) * 0.8, z + (rnd() - 0.5) * 1.2, (rnd() - 0.5) * 0.8, 0.7, (rnd() - 0.5) * 0.8, 0.5 + rnd() * 0.3, '#f4c98a', 0.9, -0.2, 1.2, 1);
        }
      }
    }
    for (const p of state.spills || []) {
      if (p.kind === 'frana' && p.t < p.warn) {
        if (rnd() < dt * 18) dust(p.x + (rnd() - 0.5) * 4, p.y, p.z + (rnd() - 0.5) * 4, 0, 0, 'dirt', 1, 0.9);
      } else if (p.kind === 'sambal' && rnd() < dt * 14) {
        emit(KIND.flame, p.x + (rnd() - 0.5) * 2, p.y + 0.5, p.z + (rnd() - 0.5) * 2, 0, 2.6 + rnd() * 2, 0, 0.6 + rnd() * 0.3, '#ff7a24', 0.3 + rnd() * 0.2, 0, 0.5, -1);
      } else if (p.kind === 'durian' && rnd() < dt * 12) {
        const a = rnd() * 6.283, r = p.r * rnd();
        emit(KIND.puff, p.x + Math.cos(a) * r, p.y + 0.8 + rnd(), p.z + Math.sin(a) * r, 0, 0.9, 0, 0.9 + rnd() * 0.7, '#b7d35a', 1.2, -0.2, 1, 1.4);
      }
    }
  }

  // The sambal: a huge cartoon flame out of the back of the kart, and the black puffs that follow it.
  function blast(x, y, z, fx, fz) {
    for (let q = 0; q < 70; q++) {
      const sp = 7 + rnd() * 17, sx = (rnd() - 0.5) * 9, sy = 1 + rnd() * 5;
      emit(KIND.flame, x, y + 1 + rnd(), z, -fx * sp + fz * sx, sy, -fz * sp - fx * sx, 1.3 + rnd() * 1.5, q % 3 ? '#ff6a1e' : '#ffd24a', 0.45 + rnd() * 0.4, 0, 1.2, -0.6);
    }
    for (let q = 0; q < 10; q++) {
      const sp = 2 + rnd() * 6, sx = (rnd() - 0.5) * 5;
      emit(KIND.puff, x - fx * 3, y + 1.6, z - fz * 3, -fx * sp + fz * sx, 2 + rnd() * 2, -fz * sp - fx * sx, 0.8 + rnd() * 0.7, '#6a5a58', 1 + rnd() * 0.5, -0.5, 1.6, 1.4);
    }
  }
  // The landslide coming down: a wall of dust, and stones thrown about.
  function slide(x, y, z) {
    for (let q = 0; q < 34; q++) {
      const a = rnd() * 6.283, sp = 3 + rnd() * 9;
      emit(KIND.puff, x + Math.cos(a) * 3, y + 0.8 + rnd() * 2, z + Math.sin(a) * 3, Math.cos(a) * sp, 2 + rnd() * 4, Math.sin(a) * sp, 1.3 + rnd() * 1.6, q % 2 ? '#a58a6a' : '#c3ab8c', 1.2 + rnd() * 0.8, -0.3, 1.8, 1.8);
    }
    sparks(x, y + 1, z, 20, '#8f8a84', 13);
  }

  function onEvent(e, karts) {
    const k = e.kart !== undefined ? karts[e.kart] : null;
    switch (e.type) {
      case 'hit': if (k) { if (e.kind === 'spin' || e.kind === 'tumble') impact(k.x, k.y, k.z, e.kind === 'tumble'); else dust(k.x, k.y, k.z, 0, 0, 'dirt', 8, 1); } break;
      case 'land': if (k) dust(k.x, k.y, k.z, k.vx * 0.5, k.vz * 0.5, k.surface, Math.min(14, 4 + Math.floor((e.force || 1) * 3)), 1.0); break;
      case 'bump': { const a = karts[e.a], b = karts[e.b]; if (a && b) sparks((a.x + b.x) / 2, (a.y + b.y) / 2 + 0.5, (a.z + b.z) / 2, 10, '#ffe08a', 8); break; }
      case 'wall': if (k) { if (shared.look?.road?.snowSpray) { dust(k.x, k.y + 0.3, k.z, 0, 0, 'snow', 6, 1.2); sparks(k.x, k.y + 0.6, k.z, 12, '#ffffff', 6); } else sparks(k.x, k.y + 0.5, k.z, 8, '#ffe08a', 7); } break; // look.road.snowSpray: a bank of snow throws snow, not sparks
      case 'boom':
        switch (e.kind) {
          case 'sambal': { const o = e.by !== undefined ? karts[e.by] : null, yaw = e.yaw ?? o?.yaw ?? 0; blast(e.x, e.y, e.z, Math.sin(yaw), Math.cos(yaw)); break; }
          case 'frana': slide(e.x, e.y, e.z); break;
          case 'rock': case 'boulder': dust(e.x, e.y, e.z, 0, 0, 'dirt', 12, 1.5); sparks(e.x, e.y + 1, e.z, 12, '#8f8a84', 9); break;
          case 'log': dust(e.x, e.y, e.z, 0, 0, 'dirt', 6, 1); break;
          case 'snow': case 'bank': dust(e.x, e.y, e.z, 0, 0, 'snow', 10, 1.4); sparks(e.x, e.y + 1, e.z, 10, '#ffffff', 8); break;
          case 'tile': sparks(e.x, e.y + 0.6, e.z, 14, '#d9754a', 8); break;
          case 'bomb': sparks(e.x, e.y + 1, e.z, 30, '#ff9c3a', 13); for (let q = 0; q < 14; q++) { const a = rnd() * 6.283, sp = 3 + rnd() * 6; emit(KIND.flame, e.x, e.y + 1, e.z, Math.cos(a) * sp, 3 + rnd() * 6, Math.sin(a) * sp, 1.2 + rnd(), q % 3 ? '#ff6a1e' : '#ffd24a', 0.4 + rnd() * 0.3, 0, 1.2, -0.5); } break;
          case 'clear': pof(e.x, e.y, e.z, 5); break;
          case 'polenta': dust(e.x, e.y, e.z, 0, 0, 'sand', 10, 1); break;
          case 'durian': dust(e.x, e.y, e.z, 0, 0, 'grass', 12, 1.3); break;
          case 'mici': pof(e.x, e.y, e.z, 7); sparks(e.x, e.y + 1, e.z, 10, '#ff9c3a', 8); break;
          default: pof(e.x, e.y, e.z, 14); sparks(e.x, e.y + 1, e.z, 24, '#ffb13a', 12);
        }
        break;
      case 'finish': if (k) confetti(k.x, k.y, k.z, e.place === 1 ? 180 : 80); break;
      case 'boxTake': if (k) sparks(k.x, k.y + 1, k.z, 12, '#fff0b3', 6); break;
      case 'boost': if (k && e.kind === 'pad') sparks(k.x, k.y + 0.4, k.z, 14, '#ffb13a', 7); break;
      case 'driftStart': if (k) dust(k.x, k.y, k.z, k.vx * 0.3, k.vz * 0.3, k.surface, 5, 0.6); break;
      case 'driftTier': if (k) sparks(k.x, k.y + 0.4, k.z, 6 + (e.tier | 0) * 8, TIER[e.tier | 0] || TIER[1], 5 + (e.tier | 0) * 2.5); break;
      // the turbo of a released drift: a ring of its tier's colour
      case 'driftEnd': if (k && e.tier > 0) sparks(k.x, k.y + 0.5, k.z, 8 + e.tier * 14, TIER[e.tier] || TIER[1], 7 + e.tier * 3.5); break;
      case 'jump': if (k) dust(k.x, k.y, k.z, k.vx * 0.3, k.vz * 0.3, k.surface, 6, 0.8); break;
      case 'shield': if (k) { pof(k.x, k.y, k.z, 4); sparks(k.x, k.y + 1, k.z, 12, '#ff9c3a', 8); } break;
      case 'steal': if (k) { pof(k.x, k.y + 1, k.z, 6); sparks(k.x, k.y + 1.4, k.z, 16, '#ffe45c', 7); } break;
      case 'rescue': if (k) dust(k.x, k.y, k.z, 0, 0, k.surface, 12, 1.2); break;
      case 'itemUse':
        if (!k) break;
        if (e.item === 'uova') { pof(k.x, k.y, k.z, 6); sparks(k.x, k.y + 1, k.z, 26, '#ffe45c', 9); }
        else if (e.item === 'grappa' || e.item === 'zuica') sparks(k.x, k.y + 1.6, k.z, 10, '#fff4d6', 4);
        else if (e.item === 'rendang') sparks(k.x, k.y + 2.4, k.z, 10, '#f4c98a', 3);
        break;
      default:
    }
  }

  function update(dt) {
    mat.uniforms.uSoftPuff.value = Number(shared.look?.softPuff) || 0;
    const puffPeak = mat.uniforms.uSoftPuff.value ? SOFT_PUFF_PEAK : PUFF_PEAK;
    live = 0;
    for (let i = 0; i < N; i++) {
      if (age[i] >= life[i]) { if (alpha[i] !== 0) alpha[i] = 0; sz[i] = 0; continue; }
      live++;
      age[i] += dt;
      vel[i * 3 + 1] -= grav[i] * dt;
      const dk = Math.exp(-drag[i] * dt);
      vel[i * 3] *= dk; vel[i * 3 + 1] *= dk; vel[i * 3 + 2] *= dk;
      pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      rot[i] += spin[i] * dt;
      const u = age[i] / life[i];
      alpha[i] = kind[i] === KIND.star || kind[i] === KIND.confetti ? clamp((1 - u) * 5, 0, 1) : kind[i] === KIND.puff ? clamp(u * 10, 0, 1) * clamp((1 - u) * 2.6, 0, 1) * puffPeak : clamp(u * 10, 0, 1) * (1 - u);
      sz[i] = Math.max(0, size[i] * (1 + grow[i] * u));
    }
    aP.needsUpdate = aC.needsUpdate = aS.needsUpdate = aA.needsUpdate = aK.needsUpdate = aR.needsUpdate = true;
  }
  function clear() { age.fill(1e9); alpha.fill(0); sz.fill(0); }
  return { points, emit, pof, impact, sparks, confetti, dust, kart, objects, onEvent, update, clear, material: mat, get live() { return live; } };
}

// Soft dark ovals on the road under every kart, so a kart sits on the ground and shows its height in a jump.
export function createBlobs(count) {
  const quad = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    // uC: the shadow's colour and strength; look.kartShadow sets it for a track, a night road is darker than the default
    uniforms: { uC: { value: new THREE.Vector4(0.09, 0.06, 0.12, 0.55) } },
    vertexShader: 'varying vec2 vQ; void main(){ vQ = position.xz * 2.0; gl_Position = projectionMatrix * viewMatrix * instanceMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec4 uC; varying vec2 vQ; void main(){ float r = length(vQ); float a = (1.0 - smoothstep(0.35, 1.0, r)) * uC.a; gl_FragColor = vec4(uC.rgb, a); }',
  });
  const mesh = new THREE.InstancedMesh(quad, mat, count);
  mesh.frustumCulled = false; mesh.renderOrder = 3;
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), S = new THREE.Vector3();
  function set(i, x, y, z, yaw, w, l, nrm) {
    E.set(nrm ? nrm.pitch : 0, yaw, nrm ? nrm.roll : 0);
    Q.setFromEuler(E);
    M.compose(P.set(x, y, z), Q, S.set(w, 1, l));
    mesh.setMatrixAt(i, M);
  }
  return { mesh, set, commit(n) { mesh.count = n; mesh.instanceMatrix.needsUpdate = true; } };
}
