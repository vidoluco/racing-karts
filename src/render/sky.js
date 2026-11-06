// Sky dome: a gradient by elevation with a soft glow low around the sun's azimuth, a sun halo, and soft painted clouds
// that drift. Drawn first in each view, centred on its camera, writing alpha 0: no outline on the sky.
import * as THREE from 'three';

// grade: the uniforms of render/weather.js for a chosen sky: the same function as the panels', so sky and paintings stay one sky. None by default.
export function createSky(look, sunDir, grade = null) {
  const S = look.sky, n = S.stops.length, C = S.clouds;
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false,
    uniforms: {
      cols: { value: S.stops.map(([, h]) => new THREE.Color(h)) }, els: { value: S.stops.map(([e]) => e) },
      uSun: { value: new THREE.Vector3(sunDir.x, sunDir.y, sunDir.z) }, uGlow: { value: new THREE.Color(S.glow) },
      uGlowA: { value: S.glowStrength }, uGlowW: { value: S.glowWidth }, uTime: { value: 0 },
      uCloud: { value: new THREE.Vector3(C.amount, C.scale, C.speed) }, uCloudLit: { value: new THREE.Color(C.lit) }, uCloudShade: { value: new THREE.Color(C.shade) },
      ...(grade?.uniforms || {}),
    },
    vertexShader: /* glsl */`varying vec3 vD;
      void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w * 0.99999; }`,
    fragmentShader: /* glsl */`${grade?.glsl || ''}
      varying vec3 vD; uniform vec3 cols[${n}]; uniform float els[${n}]; uniform vec3 uSun, uGlow, uCloud, uCloudLit, uCloudShade; uniform float uGlowA, uGlowW, uTime;
      float h12(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f); return mix(mix(h12(i), h12(i + vec2(1.0, 0.0)), u.x), mix(h12(i + vec2(0.0, 1.0)), h12(i + vec2(1.0, 1.0)), u.x), u.y); }
      float fbm(vec2 p){ return vn(p) * 0.52 + vn(p * 2.03 + 3.7) * 0.28 + vn(p * 4.1 + 7.1) * 0.14 + vn(p * 8.3 + 1.3) * 0.06; }
      void main(){
        vec3 d = normalize(vD); float e = degrees(asin(clamp(d.y, -1.0, 1.0))); vec3 c = cols[0];
        for (int i = 1; i < ${n}; i++) c = mix(c, cols[i], smoothstep(els[i - 1], els[i], e));
        vec2 a = normalize(d.xz + 1e-5), s = normalize(uSun.xz + 1e-5);
        float g = acos(clamp(dot(a, s), -1.0, 1.0));
        c = mix(c, uGlow, uGlowA * exp(-g * g / uGlowW) * (1.0 - smoothstep(2.0, 26.0, e)));
        // the sun itself: a soft disc and a wide halo, never a hard ball
        float sd = max(dot(d, uSun), 0.0);
        c += uGlow * (0.32 * pow(sd, 160.0) + 0.42 * smoothstep(0.99968, 0.99986, sd));
        if (uCloud.x > 0.0 && d.y > -0.02) {
          // cumulus along the horizon, flat bases and piled tops: the sample is compressed in height, not stretched in width,
          // and a second sample toward the sun gives their lit edge
          vec2 q = vec2(atan(d.x, d.z) * 12.0, d.y * 62.0) * uCloud.y + vec2(uTime * uCloud.z, 0.0);
          float band = smoothstep(0.02, 0.06, d.y) * (1.0 - smoothstep(0.13, 0.27, d.y));
          float f = fbm(q + 2.0), th = 0.68 - 0.18 * uCloud.x + 0.22 * (1.0 - band);
          float m = smoothstep(th, th + 0.03, f) * band;
          float lit = smoothstep(-0.03, 0.09, f - fbm(q + 2.0 + vec2(dot(normalize(d.xz + 1e-5), vec2(-s.y, s.x)) * 0.25, -0.22)));
          vec3 cc = mix(uCloudShade, uCloudLit, lit);
          c = mix(c, cc, m * 0.92);
        }
        ${grade ? 'c = wxGrade(c, d.y / max(length(d.xz), 1e-4)) + wxStars(d, uTime) * vec3(0.9, 0.95, 1.0) + wxMoon(d);' : ''}
        gl_FragColor = vec4(c, 0.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 24), mat);
  mesh.frustumCulled = false; mesh.renderOrder = -30;
  mesh.onBeforeRender = (r, sc, cam) => { mesh.position.copy(cam.position); mesh.updateMatrixWorld(); };
  return mesh;
}

// Clears the depth inside this view: everything drawn so far (the far backdrop) is behind whatever comes next, whatever
// its real distance. A single render call per view keeps the costly MSAA resolve at one per view.
export function createDepthReset() {
  const mat = new THREE.ShaderMaterial({
    depthWrite: true, depthTest: true, depthFunc: THREE.AlwaysDepth, colorWrite: false,
    vertexShader: 'void main(){ gl_Position = vec4(position.xy, 1.0, 1.0); }',
    fragmentShader: 'void main(){ gl_FragColor = vec4(0.0); }',
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  mesh.frustumCulled = false; mesh.renderOrder = -10;
  return mesh;
}
