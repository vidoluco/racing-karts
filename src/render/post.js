// Composite: every view is drawn into one multisampled linear target with a depth texture, each in its scissor. One
// full-screen pass adds the thin dark outlines (curvature of the inverse depth, so silhouettes and not every slope
// break), a soft bloom, the dividers between the views and the sRGB encoding, into an 8-bit target; a last FXAA pass
// draws that to the canvas, so the outlines are antialiased too. The dynamic resolution scale only resizes the targets:
// FXAA upsamples to the canvas. Outlines skip what writes alpha 0 (sky, far horizon, water).
import * as THREE from 'three';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

const QUAD_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

export function createPost(renderer) {
  const target = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: 4, colorSpace: THREE.LinearSRGBColorSpace });
  target.depthTexture = new THREE.DepthTexture(2, 2);
  target.depthTexture.type = THREE.FloatType;
  target.scissorTest = true;
  const ldr = new THREE.WebGLRenderTarget(2, 2, { depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  // Bloom: a threshold pass down to a quarter, two blurs at an eighth. A cheap warm glow on what is brighter than white.
  const bloomA = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  const bloomB = bloomA.clone();
  const brightMat = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: { tC: { value: target.texture }, uTx: { value: new THREE.Vector2() }, uThresh: { value: 1 } },
    vertexShader: QUAD_VS,
    fragmentShader: /* glsl */`uniform sampler2D tC; uniform vec2 uTx; uniform float uThresh; varying vec2 vUv;
      void main(){ vec3 c = 0.25 * (texture2D(tC, vUv + uTx * vec2(-1.0, -1.0)).rgb + texture2D(tC, vUv + uTx * vec2(1.0, -1.0)).rgb + texture2D(tC, vUv + uTx * vec2(-1.0, 1.0)).rgb + texture2D(tC, vUv + uTx).rgb);
        float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(min(c, vec3(4.0)) * smoothstep(uThresh, uThresh + 0.5, l), 1.0); }`,
  });
  const blurMat = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: { tC: { value: null }, uDir: { value: new THREE.Vector2() } },
    vertexShader: QUAD_VS,
    fragmentShader: /* glsl */`uniform sampler2D tC; uniform vec2 uDir; varying vec2 vUv;
      void main(){ vec3 c = texture2D(tC, vUv).rgb * 0.227;
        c += (texture2D(tC, vUv + uDir * 1.385).rgb + texture2D(tC, vUv - uDir * 1.385).rgb) * 0.316;
        c += (texture2D(tC, vUv + uDir * 3.231).rgb + texture2D(tC, vUv - uDir * 3.231).rgb) * 0.070;
        gl_FragColor = vec4(c, 1.0); }`,
  });
  const mat = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: {
      tC: { value: target.texture }, tD: { value: target.depthTexture }, tB: { value: bloomA.texture }, uTx: { value: new THREE.Vector2(0.5, 0.5) },
      uNear: { value: 0.5 }, uFar: { value: 6000 }, uBloom: { value: 0 },
      uLine: { value: 0.85 }, uFade: { value: new THREE.Vector2(1e6, 2e6) }, uW: { value: 1.5 }, uTh: { value: new THREE.Vector2(0.06, 0.14) }, uGap: { value: 0.6 }, uLc: { value: new THREE.Color('#2e2630') },
      uDiv: { value: 0 }, uDivW: { value: 6 }, uDivC: { value: new THREE.Color('#14121a') }, uRes: { value: new THREE.Vector2(2, 2) },
      uExposure: { value: 1 },
    },
    vertexShader: QUAD_VS,
    fragmentShader: /* glsl */`
      uniform sampler2D tC, tD, tB; uniform vec2 uTx, uTh, uRes; uniform vec2 uFade; uniform float uNear, uFar, uLine, uW, uGap, uDiv, uDivW, uExposure, uBloom; uniform vec3 uLc, uDivC; varying vec2 vUv;
      float iw(vec2 p){ float d = texture2D(tD, p).x; float z = uNear * uFar / (uFar - d * (uFar - uNear)); return 1.0 / z; }
      void main(){
        vec4 src = texture2D(tC, vUv);
        vec3 c = src.rgb * uExposure;
        vec2 o = uTx * uW;
        float m = iw(vUv);
        float lx = iw(vUv + vec2(o.x, 0.0)) + iw(vUv - vec2(o.x, 0.0)) - 2.0 * m;
        float ly = iw(vUv + vec2(0.0, o.y)) + iw(vUv - vec2(0.0, o.y)) - 2.0 * m;
        float l1 = iw(vUv + o) + iw(vUv - o) - 2.0 * m, l2 = iw(vUv + vec2(o.x, -o.y)) + iw(vUv - vec2(o.x, -o.y)) - 2.0 * m;
        float e = max(max(-lx, -ly), max(-l1, -l2) * 0.7) / m;
        // ground writes alpha one half: it asks for a much bigger step, so a fold in a meadow never draws a broken line
        float gnd = 1.0 + 3.0 * (1.0 - smoothstep(0.6, 0.85, src.a));
        float line = smoothstep(uTh.x * gnd, uTh.y * gnd, e) * smoothstep(uGap * 0.5 * gnd, uGap * gnd, e / m);
        line *= smoothstep(0.25, 0.45, src.a);
        // a pen line is for what is near: far woods would be all ink, dark noise against the mountains
        line *= 1.0 - smoothstep(uFade.x, uFade.y, 1.0 / m);
        c = mix(c, uLc, line * uLine);
        c += texture2D(tB, vUv).rgb * uBloom;
        // a filmic shoulder only above 0.8: highlights stay coloured instead of clipping to white
        vec3 x = max(c - 0.8, 0.0); c = min(c, vec3(0.8)) + x / (1.0 + x * 2.2);
        float dv = 1.0, half_ = uDivW * 0.5;
        if (uDiv > 0.5) {
          float px = abs(vUv.x - 0.5) * uRes.x;
          dv = smoothstep(half_ - 0.75, half_ + 0.75, px);
          if (uDiv > 1.5) { float py = abs(vUv.y - 0.5) * uRes.y; dv = min(dv, smoothstep(half_ - 0.75, half_ + 0.75, py)); }
        }
        c = mix(uDivC, c, dv);
        gl_FragColor = sRGBTransferOETF(vec4(c, 1.0));
      }`,
  });
  const fxaa = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: THREE.UniformsUtils.clone(FXAAShader.uniforms),
    vertexShader: QUAD_VS,
    fragmentShader: FXAAShader.fragmentShader,
  });
  fxaa.uniforms.tDiffuse.value = ldr.texture;
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  const scene = new THREE.Scene(); scene.add(quad);
  const cam = new THREE.Camera();
  let bloomOn = true;

  function setLook(look, camFar, camNear) {
    const O = look.outline, U = mat.uniforms;
    U.uLine.value = O.strength; U.uFade.value.set(...(O.fade || [1e6, 2e6])); U.uTh.value.set(...O.threshold); U.uGap.value = O.minGap; U.uLc.value.set(O.color);
    U.uDivC.value.set(look.divider.color); U.uDivW.value = look.divider.width; U.uExposure.value = look.exposure;
    U.uNear.value = camNear; U.uFar.value = camFar; U.uBloom.value = look.bloom?.strength ?? 0;
    brightMat.uniforms.uThresh.value = look.bloom?.threshold ?? 1;
    bloomOn = (look.bloom?.strength ?? 0) > 0;
    post.outlineWidth = O.width;
  }
  function setSize(w, h) {
    target.setSize(w, h); ldr.setSize(w, h);
    const bw = Math.max(2, w >> 3), bh = Math.max(2, h >> 3);
    bloomA.setSize(bw, bh); bloomB.setSize(bw, bh);
    const U = mat.uniforms;
    U.uTx.value.set(1 / w, 1 / h); U.uRes.value.set(w, h);
    U.uW.value = Math.max(1, (post.outlineWidth * h) / 1080);
    brightMat.uniforms.uTx.value.set(0.5 / bw, 0.5 / bh);
    fxaa.uniforms.resolution.value.set(1 / w, 1 / h);
  }
  // divider: 0 none, 1 a vertical line (2 views), 2 a cross (3 and 4)
  function composite(divider) {
    if (bloomOn) {
      quad.material = brightMat; renderer.setRenderTarget(bloomA); renderer.render(scene, cam);
      quad.material = blurMat;
      blurMat.uniforms.tC.value = bloomA.texture; blurMat.uniforms.uDir.value.set(1 / bloomA.width, 0);
      renderer.setRenderTarget(bloomB); renderer.render(scene, cam);
      blurMat.uniforms.tC.value = bloomB.texture; blurMat.uniforms.uDir.value.set(0, 1 / bloomA.height);
      renderer.setRenderTarget(bloomA); renderer.render(scene, cam);
    }
    mat.uniforms.uDiv.value = divider;
    quad.material = mat;
    renderer.setRenderTarget(ldr);
    renderer.render(scene, cam);
    quad.material = fxaa;
    renderer.setRenderTarget(null);
    renderer.render(scene, cam);
  }
  function dispose() {
    target.dispose(); ldr.dispose(); bloomA.dispose(); bloomB.dispose();
    mat.dispose(); fxaa.dispose(); brightMat.dispose(); blurMat.dispose(); quad.geometry.dispose();
  }
  const post = { target, setSize, setLook, composite, dispose, material: mat, outlineWidth: 1.5 };
  return post;
}
