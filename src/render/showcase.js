// The turntable's picture: a model drawn with the same ink lines as the race (post.js), on a transparent background so a menu can put it
// on anything. One pass in its own GL context, no bloom, no FXAA: the target is multisampled and a menu shows it small.
import * as THREE from 'three';

const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

export function createInk(renderer, w, h, camera, { width = 2.2, threshold = [0.05, 0.12], gap = 0.5, strength = 0.9, color = '#2e2630' } = {}) {
  const target = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4, colorSpace: THREE.LinearSRGBColorSpace });
  target.depthTexture = new THREE.DepthTexture(w, h);
  target.depthTexture.type = THREE.FloatType;
  const material = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false, transparent: false,
    uniforms: {
      tC: { value: target.texture }, tD: { value: target.depthTexture }, uTx: { value: new THREE.Vector2(width / w, width / h) },
      uNear: { value: camera.near }, uFar: { value: camera.far }, uTh: { value: new THREE.Vector2(...threshold) }, uGap: { value: gap }, uLine: { value: strength }, uLc: { value: new THREE.Color(color) },
    },
    vertexShader: VS,
    fragmentShader: /* glsl */`
      uniform sampler2D tC, tD; uniform vec2 uTx, uTh; uniform float uNear, uFar, uGap, uLine; uniform vec3 uLc; varying vec2 vUv;
      float iw(vec2 p){ float d = texture2D(tD, p).x; float z = uNear * uFar / (uFar - d * (uFar - uNear)); return 1.0 / z; }
      void main(){
        vec4 src = texture2D(tC, vUv);
        float a = clamp(src.a * 2.0, 0.0, 1.0);
        if (a <= 0.0) { gl_FragColor = vec4(0.0); return; }
        // a multisampled edge is colour over clear black: back to the colour itself, then the ink, then premultiplied again for the page
        vec3 c = src.rgb / max(src.a, 0.001) * 1.0;
        float m = iw(vUv);
        float lx = iw(vUv + vec2(uTx.x, 0.0)) + iw(vUv - vec2(uTx.x, 0.0)) - 2.0 * m;
        float ly = iw(vUv + vec2(0.0, uTx.y)) + iw(vUv - vec2(0.0, uTx.y)) - 2.0 * m;
        float l1 = iw(vUv + uTx) + iw(vUv - uTx) - 2.0 * m, l2 = iw(vUv + vec2(uTx.x, -uTx.y)) + iw(vUv - vec2(uTx.x, -uTx.y)) - 2.0 * m;
        float e = max(max(-lx, -ly), max(-l1, -l2) * 0.7) / m;
        float line = smoothstep(uTh.x, uTh.y, e) * smoothstep(uGap * 0.5, uGap, e / m);
        c = mix(c, uLc, line * uLine);
        vec3 x = max(c - 0.8, 0.0); c = min(c, vec3(0.8)) + x / (1.0 + x * 2.2);
        gl_FragColor = sRGBTransferOETF(vec4(c, 1.0));
        gl_FragColor = vec4(gl_FragColor.rgb * a, a);
      }`,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const scene = new THREE.Scene(); scene.add(quad);
  const cam = new THREE.Camera();
  return {
    render(sc, c) {
      renderer.setRenderTarget(target);
      renderer.setClearColor(0x000000, 0);
      renderer.clear(true, true, false);
      renderer.render(sc, c);
      renderer.setRenderTarget(null);
      renderer.render(scene, cam);
    },
    dispose() { target.depthTexture.dispose(); target.dispose(); material.dispose(); quad.geometry.dispose(); },
  };
}

// Every kart fills its turntable the same way, a tower or a long cart: the height to look at, and the lens for a camera at a given spot.
export function fitShowcase(model) {
  const g = model.body?.geometry;
  if (g && !g.boundingBox) g.computeBoundingBox();
  const b = g?.boundingBox, H = b ? b.max.y : 1.8, reach = b ? Math.hypot(Math.max(-b.min.x, b.max.x), Math.max(-b.min.z, b.max.z)) : 1.8;
  const y = H * 0.4;
  return { y, fov: (pos) => (2 * Math.atan(Math.max(H * 0.66, reach * 1.04) / Math.hypot(pos.x, pos.y - y, pos.z)) * 180) / Math.PI };
}
