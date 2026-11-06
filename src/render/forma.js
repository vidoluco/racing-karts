// Caccia alla Forma on the road: the wheel itself, twice the size of the item, a soft column of light over it so that it can be found
// from anywhere, a ring on the road while it is loose and a bouncing arrow over it that nothing hides. On a kart it lies flat on the
// roof. Built the first time a race has it, and it stays hidden in every other: a normal race draws none of it.
import { loadItem } from './models.js';
import { clamp, lerp } from './math.js';

const SCALE = 1.5;             // the item's wheel is 1.15 m of radius; the sim's is 1.75
const HAT = 0.86;              // on a kart it sits no wider than the kart, or the driver sees nothing else
const ROOF = 2.7;              // m over a kart's wheels, on most roofs and hats
const TILT = -0.62;            // its face towards the chase camera, so that it reads as a cheese and not as a drum
const BEAM_H = 70, ARROW_Y = 6;
const GOLD = '#ffd23f', GLOW = '#ffb52e';

export function createFormaWorld({ THREE, scene, mat, shapes }) {
  const root = new THREE.Group();
  root.visible = false;
  root.renderOrder = 6;
  scene.add(root);
  let time = 0;

  // ---------- the wheel: the item's model, ready when the file has loaded, a plain disc until then ----------
  const wheel = new THREE.Group();
  root.add(wheel);
  const holder = new THREE.Group();
  wheel.add(holder);
  loadItem('formaggio', { THREE, mat, shapes }).then((m) => { holder.add(m.group.clone()); }).catch(() => {});
  holder.scale.setScalar(SCALE);

  // ---------- the column of light: bright at the foot, gone at the top, and it fades at its edges by the angle of view, so it has no outline ----------
  const beamGeo = new THREE.CylinderGeometry(1.5, 2.3, BEAM_H, 20, 1, true);
  beamGeo.translate(0, BEAM_H / 2, 0);
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0.5 }, uColor: { value: new THREE.Color(GLOW) } },
    vertexShader: `varying float vUp; varying vec3 vN; varying vec3 vV;
      void main() { vUp = position.y / ${BEAM_H.toFixed(1)}; vec4 m = modelViewMatrix * vec4(position, 1.0); vN = normalMatrix * normal; vV = -m.xyz; gl_Position = projectionMatrix * m; }`,
    fragmentShader: `uniform float uOpacity; uniform vec3 uColor; varying float vUp; varying vec3 vN; varying vec3 vV;
      void main() { float edge = abs(dot(normalize(vN), normalize(vV))); float a = pow(edge, 2.4) * pow(1.0 - vUp, 1.7) * uOpacity; gl_FragColor = vec4(uColor * a, a); }`,
    transparent: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, depthWrite: false, side: THREE.FrontSide,
  });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.frustumCulled = false;
  root.add(beam);

  // ---------- the ring on the road while it rolls ----------
  const ringGeo = new THREE.RingGeometry(2.6, 3.7, 32);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.frustumCulled = false;
  root.add(ring);

  // ---------- the arrow: seen through the mountains, and it grows with distance so that it reads as a mark, not as an object ----------
  const shape = new THREE.Shape();
  shape.moveTo(0, -1); shape.lineTo(1.05, 0.15); shape.lineTo(0.45, 0.15); shape.lineTo(0.45, 1.05); shape.lineTo(-0.45, 1.05); shape.lineTo(-0.45, 0.15); shape.lineTo(-1.05, 0.15); shape.closePath();
  const arrowGeo = new THREE.ShapeGeometry(shape);
  const inkMat = new THREE.MeshBasicMaterial({ color: '#1d1f2b', depthTest: false, depthWrite: false, transparent: true, side: THREE.DoubleSide, fog: false });
  const faceMat = new THREE.MeshBasicMaterial({ color: GOLD, depthTest: false, depthWrite: false, transparent: true, side: THREE.DoubleSide, fog: false });
  const arrow = new THREE.Group(), ink = new THREE.Mesh(arrowGeo, inkMat), face = new THREE.Mesh(arrowGeo, faceMat);
  ink.scale.setScalar(1.3); ink.renderOrder = 60; face.renderOrder = 61; face.position.z = 0.02;
  ink.frustumCulled = false; face.frustumCulled = false;
  arrow.add(ink, face);
  root.add(arrow);

  const at = new THREE.Vector3();
  let mine = -1;

  return {
    // state.forma with its own previous position, and the karts as they are drawn this frame
    update(F, K, alpha, dt) {
      time += dt;
      root.visible = true;
      const w = F.wheel, h = F.holder, k = h >= 0 ? K[h] : null;
      mine = h;
      if (k) {
        // flat on the roof like a hat, a little tilt with the kart, and it wobbles harder as it gets heavy
        const heavy = clamp((F.streak[h] || 0) / 60, 0, 1), wob = Math.sin(time * 7) * (0.03 + heavy * 0.06);
        wheel.position.set(k.x, k.y + ROOF, k.z);
        wheel.rotation.set(TILT - (k.pitch || 0) * 0.6 + wob, k.yaw, -(k.roll || 0) * 0.6 + Math.cos(time * 5.3) * (0.02 + heavy * 0.04), 'YXZ');
        holder.rotation.set(0, 0, Math.PI / 2);
        holder.scale.setScalar(HAT);
        at.copy(wheel.position);
      } else {
        wheel.position.set(lerp(w.px, w.x, alpha), lerp(w.py, w.y, alpha), lerp(w.pz, w.z, alpha));
        wheel.rotation.set(0, w.yaw, 0, 'YXZ');
        holder.scale.setScalar(SCALE);
        // the axle across the road and round it goes: one roll per its own circumference
        holder.rotation.set(w.roll, 0, 0);
        at.copy(wheel.position);
      }
      beam.position.set(at.x, k ? k.y : w.y - 1.75, at.z);
      beamMat.uniforms.uOpacity.value = (k ? 0.34 : 0.52) * (0.9 + 0.1 * Math.sin(time * 3.2));
      ring.visible = !k;
      if (!k) {
        ring.position.set(at.x, w.y - w.h - 1.75 + 0.14, at.z);
        const s = 1 + 0.12 * Math.sin(time * 6);
        ring.scale.set(s, 1, s);
      }
    },
    // One view: the holder does not need a beam out of its own head, nor an arrow; the rest get them, sized by how far off it is.
    viewPrepare(kart, camera) {
      const own = kart === mine;
      beam.visible = !own;
      arrow.visible = !own;
      if (own) return;
      const dx = at.x - camera.position.x, dy = at.y - camera.position.y, dz = at.z - camera.position.z, d = Math.hypot(dx, dy, dz);
      const s = clamp(d * 0.03, 1.15, 9);
      arrow.position.set(at.x, at.y + (mine >= 0 ? 1.4 : 1.2) + ARROW_Y * Math.min(1.6, 0.4 + s * 0.35) + Math.sin(time * 5.5) * 0.3 * s, at.z);
      arrow.scale.setScalar(s);
      arrow.quaternion.copy(camera.quaternion);
    },
    hide() { root.visible = false; },
    dispose() { scene.remove(root); beamGeo.dispose(); ringGeo.dispose(); arrowGeo.dispose(); beamMat.dispose(); ringMat.dispose(); inkMat.dispose(); faceMat.dispose(); },
  };
}

