// The page behind tools/shoot-karts.mjs: karts and items, alone, through the real toon materials and the real composite (ink
// outlines, bloom, FXAA). Every call returns a canvas with the picture, the tool stitches sheets and saves PNGs from them.
import * as THREE from 'three';
import { createMat, createShared, resolveLook } from '../src/render/toon.js';
import { createPost } from '../src/render/post.js';
import * as shapes from '../src/render/shapes.js';
import { buildKart, loadItem } from '../src/render/models.js';
import { createInk, fitShowcase } from '../src/render/showcase.js';

const dev = window.__karts = { ready: false, error: null };
window.addEventListener('error', (e) => { dev.error = e.message; });
window.addEventListener('unhandledrejection', (e) => { dev.error = String(e.reason?.stack || e.reason); });

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false, depth: false, preserveDrawingBuffer: true });
renderer.autoClear = false;
renderer.info.autoReset = false;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

// the sun over the left shoulder of a camera on +z, high enough to show faces; the rest is the game's default look
const LOOK = resolveLook({ look: { sun: { azimuth: 208, elevation: 44, color: '#fff0dc', intensity: 2.7, wrap: [-0.32, 0.62] }, hemi: { sky: '#dfe4ea', ground: '#b8be78', intensity: 2.0 } } });
const shared = createShared(LOOK);
const mat = createMat(shared), post = createPost(renderer);
const ctx = { THREE, mat, shapes };

const scene = new THREE.Scene();
const hemi = new THREE.HemisphereLight(LOOK.hemi.sky, LOOK.hemi.ground, LOOK.hemi.intensity);
const sun = new THREE.DirectionalLight(LOOK.sun.color, LOOK.sun.intensity);
sun.position.copy(shared.sunDir.value).multiplyScalar(100);
scene.add(hemi, sun, sun.target);

const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 48).rotateX(-Math.PI / 2), mat('#a9c95e', {}));
scene.add(ground);
const blob = new THREE.Mesh(new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  vertexShader: 'varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'varying vec2 vP; void main(){ float d = length(vP); gl_FragColor = vec4(0.1, 0.07, 0.12, 0.46 * (1.0 - smoothstep(0.35, 1.0, d))); }',
}));
blob.position.y = 0.01;
scene.add(blob);

const cam = new THREE.PerspectiveCamera(30, 1, LOOK.camera.near, LOOK.camera.far);
const models = new Map(), items = new Map();
const kartModel = async (id) => { if (!models.has(id)) models.set(id, await buildKart(id, ctx, '#c9513d')); return models.get(id); };
const itemModel = async (id) => { if (!items.has(id)) items.set(id, await loadItem(id, ctx)); return items.get(id); };

let current = null;
function stage(model) {
  if (current) scene.remove(current);
  current = model.group;
  scene.add(current);
}
function size(w, h, outline) {
  renderer.setPixelRatio(1);
  renderer.setSize(w, h, false);
  post.setLook({ ...LOOK, outline: { ...LOOK.outline, width: outline ?? LOOK.outline.width } }, LOOK.camera.far, LOOK.camera.near);
  post.setSize(w, h);
  post.target.scissor.set(0, 0, w, h); post.target.viewport.set(0, 0, w, h);
  cam.aspect = w / h; cam.updateProjectionMatrix();
}
function render(bg) {
  renderer.info.reset();
  scene.background = new THREE.Color(bg);
  renderer.setRenderTarget(post.target);
  renderer.clear(true, true, false);
  renderer.render(scene, cam);
  const out = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
  post.composite(0);
  return out;
}

// A kart as the sim would hand it to the model; pose names which reaction a tool wants to see.
function kartState(pose) {
  const fast = pose && !['cheer', 'sad', 'idle', 'soot', 'lick', 'big'].includes(pose);
  return { pose: pose === 'idle' ? null : pose || null, speed: fast ? 24 : 0, steer: 0, throttle: fast ? 1 : 0, grounded: pose !== 'air', vy: 0, yaw: 0, drift: pose === 'drift' ? 1 : 0, boostT: pose === 'boost' ? 1 : 0, boostKind: pose === 'boost' ? 'grappa' : null, hitT: pose === 'hit' ? 0.5 : 0, hitKind: pose === 'hit' ? 'spin' : null, tipsyT: pose === 'tipsy' ? 1 : 0, stinkT: pose === 'stink' ? 1 : 0, bigT: pose === 'big' ? 1 : 0, sootT: pose === 'soot' ? 1 : 0, rendangT: pose === 'lick' ? 1 : 0, finished: false, place: 1, orbit: pose === 'mici' ? 3 : 0 };
}
function settle(model, pose, steps = 90) {
  const st = kartState(pose);
  for (let i = 0; i < steps; i++) model.update?.(st, 1 / 60);
  for (const w of model.wheels || []) { if (w.userData.front) w.rotation.y = pose === 'leanL' ? 0.42 : pose === 'leanR' || pose === 'drift' ? -0.42 : 0; }
}
const CAMS = {
  // a 3/4 picture, long lens: pick screen and sheets
  hero: (y) => ({ yaw: y ?? 0.62, pos: [0, 2.5, 6.9], at: [0, 1.02, 0], fov: 27 }),
  back: (y) => ({ yaw: y ?? Math.PI - 0.62, pos: [0, 2.5, 6.9], at: [0, 1.02, 0], fov: 27 }),
  side: () => ({ yaw: Math.PI / 2, pos: [0, 1.5, 6.6], at: [0, 1, 0], fov: 25 }),
  // the race camera at speed, as src/render/camera.js places it: 6.2 m back, 2.2 m up, looking at 1.7 m high 5.5 m past the kart, its fast fov
  chase: (y) => ({ yaw: y ?? 0, pos: [0, 2.2, -6.2], at: [0, 1.7, 5.5], fov: 63 }),
};
const SKY = '#cfe0e6';

function aim(c) {
  cam.position.set(...c.pos); cam.fov = c.fov; cam.lookAt(...c.at); cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
}

// Every kart fills its picture the same way, a tall tower or a long cart: the camera stays where it is, the lens changes.
function fit(c, model) {
  const g = model.body?.geometry;
  if (!g) return;
  if (!g.boundingBox) g.computeBoundingBox();
  const b = g.boundingBox, reach = Math.hypot(Math.max(-b.min.x, b.max.x), Math.max(-b.min.z, b.max.z)), H = b.max.y;
  c.at = [0, H * 0.44, 0];
  const dist = Math.hypot(c.pos[0], c.pos[1] - c.at[1], c.pos[2]);
  c.fov = (2 * Math.atan(Math.max(H * 0.62, reach * 0.96) / dist) * 180) / Math.PI;
}

// Draws one picture on a fresh 2D canvas, opaque on a meadow and a pale sky.
dev.shot = async ({ id, kind = 'kart', cam: camName = 'hero', yaw, pose, w = 480, h = 480, crop = null, outline = null, zoom = 1, steps }) => {
  size(w, h, outline);
  ground.visible = true; blob.visible = true;
  let stats, model;
  if (kind === 'kart') {
    model = await kartModel(id);
    stage(model);
    settle(model, pose, steps);
    const c = CAMS[camName](yaw);
    current.rotation.y = c.yaw;
    if (camName !== 'chase') fit(c, model);
    aim(c);
    if (zoom !== 1) { cam.fov = c.fov / zoom; cam.updateProjectionMatrix(); }
    blob.scale.set(1.6, 1, 1.9); blob.rotation.y = c.yaw;
  } else {
    model = await itemModel(id);
    const g = model.group.clone();
    const st = { kind: id, t: 0.5, ttl: undefined, r: 2, x: 0, y: 0, z: 0, yaw: 0, ...(pose || {}) };
    stage({ group: g });
    for (let i = 0; i < 10; i++) model.update?.(g, st, 1 / 60);
    g.rotation.y = yaw ?? 0.7;
    g.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(g), s = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
    g.position.y = -box.min.y;
    mid.y -= box.min.y;
    const d = Math.max(s.x, s.y, s.z) * 3.1 + 1.2;
    cam.position.set(0, mid.y + d * 0.34, d); cam.fov = 25; cam.lookAt(mid.x, mid.y, mid.z); cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    blob.scale.set(Math.max(s.x, s.z) * 0.72, 1, Math.max(s.x, s.z) * 0.72); blob.rotation.y = 0;
  }
  stats = render(SKY);
  const out = document.createElement('canvas');
  if (crop) { out.width = crop[2]; out.height = crop[3]; out.getContext('2d').drawImage(canvas, crop[0], crop[1], crop[2], crop[3], 0, 0, crop[2], crop[3]); } else { out.width = w; out.height = h; out.getContext('2d').drawImage(canvas, 0, 0); }
  return { canvas: out, stats, tris: model.tris ?? null, placeholder: !!model.placeholder };
};

const toLin = new Float32Array(256).map((_, i) => { const c = i / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
const toS = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

// The UI picture: drawn once on black and once on white; the difference is the alpha, whatever the composite did at the edges.
dev.png = async (id, size_ = 512) => {
  const S = size_ * 2;
  size(S, S, 3.2);
  const model = await kartModel(id);
  stage(model);
  settle(model, null);
  ground.visible = false; blob.visible = true;
  const c = { yaw: 0.68, pos: [0, 2.3, 7], at: [0, 1.02, 0], fov: 25 };
  current.rotation.y = c.yaw;
  fit(c, model);
  aim(c);
  blob.scale.set(1.6, 1, 1.9); blob.rotation.y = c.yaw;
  const grab = (bg) => {
    render(bg);
    const t = document.createElement('canvas'); t.width = S; t.height = S;
    const g = t.getContext('2d', { willReadFrequently: true }); g.drawImage(canvas, 0, 0);
    return g.getImageData(0, 0, S, S);
  };
  const K = grab('#000000'), W = grab('#ffffff'), out = new ImageData(S, S);
  // the composite's shoulder does not leave white at one: what a bare corner measures is what all the way see-through looks like
  const full = Math.max(1e-3, toLin[W.data[0]] - toLin[K.data[0]]);
  for (let i = 0; i < K.data.length; i += 4) {
    const a = Math.max(0, Math.min(1, 1 - Math.max(toLin[W.data[i]] - toLin[K.data[i]], toLin[W.data[i + 1]] - toLin[K.data[i + 1]], toLin[W.data[i + 2]] - toLin[K.data[i + 2]]) / full));
    out.data[i + 3] = Math.round(a * 255);
    if (a > 0.003) for (let q = 0; q < 3; q++) out.data[i + q] = Math.round(Math.min(1, toS(Math.min(1, toLin[K.data[i + q]] / a))) * 255);
  }
  const big = document.createElement('canvas'); big.width = S; big.height = S;
  big.getContext('2d').putImageData(out, 0, 0);
  const small = document.createElement('canvas'); small.width = size_; small.height = size_;
  const g = small.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(big, 0, 0, size_, size_);
  return small.toDataURL('image/png');
};

// A labelled sheet from a list of cells; returns a PNG data URL and the numbers per cell.
dev.sheet = async (cells, { cols = 3, w = 480, h = 480, pad = 8, label = true, labelH = 26, bg = '#2a2730' } = {}) => {
  const rows = Math.ceil(cells.length / cols), cw = cells[0].crop ? cells[0].crop[2] : w, ch = cells[0].crop ? cells[0].crop[3] : h;
  const sheet = document.createElement('canvas');
  sheet.width = cols * cw + (cols + 1) * pad; sheet.height = rows * (ch + (label ? labelH : 0)) + (rows + 1) * pad;
  const g = sheet.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, sheet.width, sheet.height);
  const report = [];
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i], r = await dev.shot({ w, h, ...c });
    const X = pad + (i % cols) * (cw + pad), Y = pad + Math.floor(i / cols) * (ch + (label ? labelH : 0) + pad);
    g.drawImage(r.canvas, X, Y);
    report.push({ id: c.id, tris: r.tris, calls: r.stats.calls, placeholder: r.placeholder });
    if (label) {
      g.fillStyle = '#f4efe6'; g.font = '600 16px -apple-system, Helvetica, sans-serif'; g.textBaseline = 'middle';
      g.fillText(`${c.id}${c.pose ? ` (${typeof c.pose === 'string' ? c.pose : 'spill'})` : ''}${r.tris ? `  ${r.tris} tris` : ''}`, X + 4, Y + ch + labelH / 2);
    }
  }
  return { url: sheet.toDataURL('image/png'), report };
};

// The turntable's own ink pass on its own context, as R.showcase uses it. For the tests: how much is see-through, solid, and inked.
dev.ink = async (id) => {
  const cv = document.createElement('canvas'); cv.width = 384; cv.height = 384;
  const r2 = new THREE.WebGLRenderer({ canvas: cv, antialias: false, alpha: true, preserveDrawingBuffer: true, depth: false, stencil: false });
  r2.outputColorSpace = THREE.LinearSRGBColorSpace;
  const sc = new THREE.Scene();
  sc.add(new THREE.HemisphereLight('#ffffff', '#b7a78a', 2.2));
  const s2 = new THREE.DirectionalLight('#fff0dc', 2.7); s2.position.set(-2, 3, 2.2); sc.add(s2);
  const model = await buildKart(id, ctx, '#c9513d');
  model.group.rotation.y = 2.5;
  sc.add(model.group);
  model.update?.({ speed: 0, steer: 0, boostT: 0, drift: 0, grounded: true }, 1 / 60);
  const c2 = new THREE.PerspectiveCamera(30, 1, 0.5, 50), f = fitShowcase(model);
  c2.position.set(0, f.y + 1.3, 6.4); c2.lookAt(0, f.y, 0); c2.fov = f.fov(c2.position); c2.updateProjectionMatrix();
  const count = () => {
    const t = document.createElement('canvas'); t.width = t.height = 384;
    const g = t.getContext('2d'); g.drawImage(cv, 0, 0);
    const d = g.getImageData(0, 0, 384, 384).data;
    let solid = 0, ink = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 240) { solid++; if (d[i] < 75 && d[i + 1] < 70 && d[i + 2] < 80) ink++; }
    return { corner: d[3], solid: solid / (384 * 384), ink: ink / (384 * 384) };
  };
  const ink = createInk(r2, 384, 384, c2, {});
  ink.render(sc, c2);
  const inked = count();
  ink.dispose(); r2.dispose(); r2.forceContextLoss?.();
  return inked;
};
// For the tests: every bone that moved between two poses.
dev.build = async (id) => {
  const m = await kartModel(id);
  return { tris: m.tris, wheels: (m.wheels || []).length, placeholder: !!m.placeholder };
};
dev.ready = true;
