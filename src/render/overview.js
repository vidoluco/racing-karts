// The overview cell of a three player race: the whole track seen from a drone, baked once to a texture at load, with the
// road picked out, and live kart dots drawn over it. Cheap: one textured quad and a few dots per frame.
import * as THREE from 'three';

export function createOverview(renderer, scene, track, look, { width = 960, height = 540 } = {}) {
  const S = track.samples;
  let ax = 1e9, az = 1e9, bx = -1e9, bz = -1e9, my = 0;
  for (let i = 0; i < track.n; i++) { ax = Math.min(ax, S.x[i]); bx = Math.max(bx, S.x[i]); az = Math.min(az, S.z[i]); bz = Math.max(bz, S.z[i]); my += S.y[i] / track.n; }
  const cx = (ax + bx) / 2, cz = (az + bz) / 2, r = Math.max(bx - ax, bz - az) * 0.56 * Math.max(1, (height / width) * 1.78);
  const cam = new THREE.PerspectiveCamera(36, width / height, 1, 8000);
  // from the sun's side and high, so shadows fall away from the viewer and the road reads
  const dist = r / Math.tan(18 * Math.PI / 180) * 1.0;
  if (track.long) { cam.far = Math.max(cam.far, dist * 2.5); cam.updateProjectionMatrix(); }
  cam.position.set(cx - dist * 0.22, my + dist * 0.92, cz + dist * 0.38);
  cam.lookAt(cx, my, cz);
  cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const rt = new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType, samples: 4 });

  // a bright route over the road, only for the bake, on top of everything
  const pos = [], idx = [];
  const W = 7;
  for (let i = 0; i <= track.n; i += 3) {
    const k = i % track.n;
    pos.push(S.x[k] + S.nx[k] * W, S.y[k] + 1.5, S.z[k] + S.nz[k] * W, S.x[k] - S.nx[k] * W, S.y[k] + 1.5, S.z[k] - S.nz[k] * W);
  }
  for (let i = 0; i < pos.length / 6 - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const rg = new THREE.BufferGeometry();
  rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  rg.setIndex(idx);
  const routeMat = new THREE.MeshBasicMaterial({ color: '#fff3cf', side: THREE.DoubleSide, depthTest: false, transparent: true, opacity: 0.78 });
  const route = new THREE.Mesh(rg, routeMat);
  route.renderOrder = 50; route.frustumCulled = false;

  function bake(extraShow = () => {}) {
    const prevAuto = renderer.autoClear;
    renderer.autoClear = true;
    scene.add(route);
    extraShow(true);
    renderer.setRenderTarget(rt);
    renderer.render(scene, cam);
    renderer.setRenderTarget(null);
    extraShow(false);
    scene.remove(route);
    renderer.autoClear = prevAuto;
  }

  // the cell: a quad plus dots, all in clip space of the cell
  const cellScene = new THREE.Scene(), cellCam = new THREE.Camera();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false, uniforms: { t: { value: rt.texture } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'uniform sampler2D t; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(t, vUv).rgb, 0.0); }',
  }));
  quad.frustumCulled = false; quad.renderOrder = 0;
  cellScene.add(quad);
  const dotMat = new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false,
    vertexShader: 'attribute vec3 aColor; attribute float aSize; varying vec3 vC; void main(){ vC = aColor; gl_PointSize = aSize; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'varying vec3 vC; void main(){ float r = length(gl_PointCoord * 2.0 - 1.0); if (r > 1.0) discard; vec3 c = mix(vC, vec3(0.03, 0.02, 0.05), smoothstep(0.62, 0.72, r)); gl_FragColor = vec4(c, 1.0 - smoothstep(0.92, 1.0, r)); }',
  });
  const MAX = 16, dp = new Float32Array(MAX * 3), dc = new Float32Array(MAX * 3), ds = new Float32Array(MAX);
  const dg = new THREE.BufferGeometry();
  dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  dg.setAttribute('aColor', new THREE.BufferAttribute(dc, 3));
  dg.setAttribute('aSize', new THREE.BufferAttribute(ds, 1));
  const dots = new THREE.Points(dg, dotMat);
  dots.frustumCulled = false; dots.renderOrder = 1;
  cellScene.add(dots);
  const v = new THREE.Vector3(), c = new THREE.Color();
  function update(karts, colors, viewKarts, pxH, extra = null) {
    let n = 0;
    // the wheel of a hunt: a gold dot, the biggest on the map, drawn under the karts so that its holder stays seen
    if (extra) {
      v.set(extra.x, extra.y, extra.z).project(cam);
      dp[0] = v.x; dp[1] = v.y; dp[2] = 0;
      c.set('#ffd23f');
      dc[0] = c.r; dc[1] = c.g; dc[2] = c.b;
      ds[0] = 0.085 * pxH;
      n = 1;
    }
    for (let i = karts.length - 1; i >= 0 && n < MAX; i--) {
      const k = karts[i];
      v.set(k.x, k.y, k.z).project(cam);
      dp[n * 3] = v.x; dp[n * 3 + 1] = v.y; dp[n * 3 + 2] = 0;
      c.set(colors[i] || '#ffffff');
      dc[n * 3] = c.r; dc[n * 3 + 1] = c.g; dc[n * 3 + 2] = c.b;
      ds[n] = (viewKarts.includes(i) ? 0.05 : 0.03) * pxH;
      n++;
    }
    dg.setDrawRange(0, n);
    dg.attributes.position.needsUpdate = dg.attributes.aColor.needsUpdate = dg.attributes.aSize.needsUpdate = true;
  }
  return { bake, update, scene: cellScene, camera: cellCam, dispose() { rt.dispose(); rg.dispose(); routeMat.dispose(); quad.geometry.dispose(); quad.material.dispose(); dg.dispose(); dotMat.dispose(); } };
}
