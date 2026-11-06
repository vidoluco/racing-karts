// createRenderer: draws a race. One multisampled target, a scissor per view, one composite pass. The far backdrop is drawn
// first in each view, then the depth resets, so the near world is always in front. See the Renderer section of the spec.
import * as THREE from 'three';
import { DEFAULT_LOOK, createMat, createShared, resolveLook, setLook } from './toon.js';
import { createPost } from './post.js';
import { createDepthReset, createSky } from './sky.js';
import { createHorizon, fetchHorizon } from './horizon.js';
import { createBackdrop } from './backdrop.js';
import { bakeGroundShade, buildGround, createForest } from './terrain.js';
import { buildRoad, buildStructures } from './road.js';
import { BANDS, SHAPES, casterMesh, createTreeView, placeTrees, treeGeometry } from './trees.js';
import { placeRocks, rockMesh } from './rocks.js';
import { buildJumpRamps, createBatch, createBoxes, createHazards, createPads } from './props.js';
import { createBlobs, createFx } from './fx.js';
import { createDisasterWorld, planDisasters } from './disasters.js';
import { createTrafficWorld } from './traffic.js';
import { createViewCamera } from './camera.js';
import { createOverview } from './overview.js';
import { createRockIndex, createRockView, createStream } from './stream.js';
import { createKartPool, buildKart, loadItem } from './models.js';
import { createGhostPool } from './ghost.js';
import { createFormaWorld } from './forma.js';
import { createTeamFlags } from './teamflags.js';
import { GRADE_GLSL, bakeLitMap, createGradeUniforms, createWeatherWorld, gradeBytes, gradeHex, gradeOf, isNightTrack, nightLamps, setGrade, tagWindows, weatherLook, wxShared } from './weather.js';
import { createInk, fitShowcase } from './showcase.js';
import * as shapes from './shapes.js';
import { angleTo, clamp, lerp } from './math.js';

const LANDMARKS = async (id) => import(`./landmarks/${id}.js`); // async: the bundler's lookup throws at the call for a file that does not exist yet
const BLANK_LAND = { build: () => ({}) };
const NEAR_THINGS = 650 * 650; // m squared: how near a view crates and animals are drawn on a long track
const TREE_BUDGET_HIGH = 450000, TREE_BUDGET_LOW = 360000; // triangles in a view of a long track: past the first the far trees thin out, under the second they return

// [x, y, w, h] of each view in 0..1 of the canvas, y from the bottom. Three players: the fourth cell is the overview.
export function viewLayout(n) {
  if (n <= 1) return [[0, 0, 1, 1]];
  if (n === 2) return [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]];
  return [[0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5], [0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5]];
}

export function createRenderer(canvas, { quality = 'auto', dataBase = 'data/horizon/', backdropBase = 'assets/backdrops/', shadeSize = 4096, antialias = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias, powerPreference: 'high-performance', stencil: false, depth: false, preserveDrawingBuffer: quality === 'capture' });
  renderer.autoClear = false;
  renderer.info.autoReset = false;
  renderer.setClearColor(0x000000, 0);
  // Tonemapping and encoding happen in the composite: everything renders in linear light.
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;

  const shared = createShared(resolveLook({}));
  shared.grade = createGradeUniforms();
  const mat = createMat(shared);
  const post = createPost(renderer);
  const hemi = new THREE.HemisphereLight('#ffffff', '#ffffff', 1), sunLight = new THREE.DirectionalLight('#ffffff', 1);
  const scene = new THREE.Scene();
  scene.add(hemi, sunLight, sunLight.target);
  const worldGroup = new THREE.Group();
  scene.add(worldGroup);
  const reset = createDepthReset();
  scene.add(reset);
  const blobs = createBlobs(32);
  const fx = createFx(shared);
  scene.add(blobs.mesh, fx.points);
  const kartPool = createKartPool(scene, { mat, shapes, THREE }, shared);
  const ghostPool = createGhostPool(scene, { mat, shapes, THREE });
  let formaWorld = null;  // made by the first race that has a wheel of cheese, hidden in any other
  const teamFlags = createTeamFlags({ mat, shapes, THREE });

  let W = null;           // the loaded world
  let views = [];         // [{ kart index, cam, trees, gx, gz, gyaw }]
  let layout = viewLayout(1);
  let scale = 1, targetW = 2, targetH = 2;
  let colors = [];
  let flyT = -1, flyDur = 7, flyResolve = null;
  const stats = { fps: 60, drawCalls: 0, triangles: 0, scale: 1, perView: 0, trianglesPerView: 0, ms: 0 };
  let emaMs = 16.7, slowFor = 0, fastFor = 0, lastNow = 0, time = 0;
  let staged = false, hazards = null, boxes = null, overview = null, disasters = null, traffic = null, frameNo = 0;
  const scratch = [];

  function size() {
    const cw = canvas.clientWidth || canvas.width || 1280, ch = canvas.clientHeight || canvas.height || 720;
    // pixels are capped near 1080 rows: the budget is set at 1080p, and the TV is the target
    const dpr = window.devicePixelRatio || 1, pr = quality === 'capture' ? 1 : Math.min(dpr, 1080 / Math.min(ch, 1080));
    renderer.setPixelRatio(pr);
    renderer.setSize(cw, ch, false);
    const dw = Math.round(cw * pr), dh = Math.round(ch * pr);
    targetW = Math.max(2, Math.round(dw * scale)); targetH = Math.max(2, Math.round(dh * scale));
    post.setSize(targetW, targetH);
    fx.material.uniforms.uScale.value = targetH * 0.6;
  }

  function makeView(i) {
    const v = { kart: i, cam: createViewCamera(W.look, W), trees: createTreeView(W.trees, W.treeMat, W.treeGeos), gx: 1e9, gz: 1e9, gyaw: 1e9, gat: 0 };
    if (W.stream) { v.stream = W.stream.createView(); v.rocks = createRockView(W.rockIndex); }
    return v;
  }
  function disposeViews() {
    for (const v of views) {
      for (const m of v.trees.meshes) scene.remove(m);
      v.trees.dispose();
      if (v.stream) { W?.stream?.dropView(v.stream); scene.remove(v.rocks.mesh); v.rocks.dispose(); }
    }
    views = [];
  }

  // opts.weather: null, or { kind, night } (data/weather.js): the same world under another sky
  async function loadTrack(track, terrain, { weather = null } = {}) {
    unload();
    const def = track.def, look = weather ? weatherLook(resolveLook(def), weather, def) : resolveLook(def);
    setLook(shared, look);
    const grade = weather ? { uniforms: shared.grade, glsl: GRADE_GLSL, time: shared.time, bytes: (d) => gradeBytes(gradeOf(weather, def), d) } : null;
    if (grade) setGrade(shared.grade, gradeOf(weather, def), weather, look, shared.sunDir.value, def);
    fx.material.uniforms.uFxTint.value.setRGB(1, 1, 1);
    if (weather?.night && !isNightTrack(def)) fx.material.uniforms.uFxTint.value.setRGB(0.3, 0.36, 0.52);
    else if (weather?.kind === 'rain') fx.material.uniforms.uFxTint.value.setRGB(0.82, 0.86, 0.9);
    hemi.color.set(look.hemi.sky); hemi.groundColor.set(look.hemi.ground); hemi.intensity = look.hemi.intensity;
    sunLight.color.set(look.sun.color); sunLight.intensity = look.sun.intensity;
    sunLight.position.copy(shared.sunDir.value).multiplyScalar(1000);
    post.setLook(look, look.camera.far, look.camera.near);
    size();

    blobs.mesh.material.uniforms.uC.value.set(...(look.kartShadow || [0.09, 0.06, 0.12, 0.55]));
    blobs.shotShadow = !!look.shotShadow; blobs.kartScale = look.kartShadowScale ?? 1; // how much wider than the kart its shadow, default 1
    const world = { track, terrain, look, def, keepOut: [], groves: [], plant: [], casters: [], blobs: [], staticGroup: new THREE.Group() };
    world.backdropBase = backdropBase; // for a landmark that wears a picture of its own
    worldGroup.add(world.staticGroup);
    world.sky = createSky(look, shared.sunDir.value, grade);
    scene.add(world.sky);
    world.sky.material.uniforms.uTime = shared.time;
    const hz = await fetchHorizon(def.id, dataBase).catch(() => null);
    if (hz) { world.horizon = createHorizon(hz, def, look, shared); scene.add(world.horizon.mesh); } else console.warn(`no horizon for ${def.id}: run tools/bake-horizon.mjs ${def.id}`);
    world.backdrop = createBackdrop(def, look, { base: backdropBase, renderer, sky: world.sky, shared, grade });
    if (world.backdrop.mesh) scene.add(world.backdrop.mesh);
    await world.backdrop.ready;
    if (world.horizon && world.backdrop.covers) world.horizon.mesh.visible = false;

    // landmarks first: they say where the forest opens and thickens, and the ground paints itself from that
    const batch = track.long ? createBatch(320) : createBatch();
    world.batch = batch;
    const ctx = { THREE, track, terrain, look, batch, mat, shapes, world };
    const land = def.landmarkModule ? def.landmarkModule : def.landmarks ? await LANDMARKS(def.landmarks).catch((e) => { if (!/Module not found|Unknown variable|Could not resolve|Failed to fetch|No such/i.test(String(e.message))) console.warn(`landmarks ${def.landmarks}:`, e); return BLANK_LAND; }) : BLANK_LAND;
    // what a landmark needs before the ground exists
    land.plan?.(ctx);
    // world.groundPaint: { canvas, rect: [x0, z0, x1, z1] }, a canvas a landmark painted to lay on the ground (toon.js)
    if (world.groundPaint) {
      const gt = new THREE.CanvasTexture(world.groundPaint.canvas), [gx0, gz0, gx1, gz1] = world.groundPaint.rect;
      gt.colorSpace = THREE.SRGBColorSpace; gt.anisotropy = 8; gt.wrapS = gt.wrapT = THREE.ClampToEdgeWrapping; gt.flipY = false;
      shared.cover.uGroundPaint.value = gt; shared.cover.uGroundRect.value.set(gx0, gz0, 1 / (gx1 - gx0), 1 / (gz1 - gz0));
    }
    planDisasters(world);
    const forestOf = createForest(look, world);
    world.forestOf = forestOf;
    world.ground = buildGround(track, terrain, look, mat, forestOf, world);
    shared.cover.uBank.value.set(terrain.water ?? 0, look.terrain.bankHeight ?? 2.6, 0, terrain.water === null || terrain.water === undefined ? 0 : 1);
    worldGroup.add(world.ground.group);
    if (world.ground.water) { scene.add(world.ground.water); world.waterMat = world.ground.water.userData.material; world.waterMat.uniforms.uTime = shared.time; world.waterMat.uniforms.uShadeMap = shared.shadeMap; world.waterMat.uniforms.uShadeRect = shared.shadeRect; world.waterMat.uniforms.uMist = shared.mist.uMist; world.waterMat.uniforms.uMistRing = shared.mist.uMistRing; }
    const road = buildRoad(track, look, shared);
    world.road = road;
    worldGroup.add(road.group);
    land.build?.(ctx);
    buildStructures(track, world, batch, look, mat);
    buildJumpRamps(track, batch, look);
    const staticMat = mat('#ffffff', { vertexColors: true, paint: true, side: THREE.DoubleSide, ...(look.staticRim ? { rim: look.staticRim } : {}) });
    const statics = batch.finish(staticMat);
    world.statics = statics;
    if (weather?.night && !isNightTrack(def)) world.windows = tagWindows(statics.entries.flatMap((e) => (e.low ? [e.mesh, e.low] : [e.mesh])), { track });
    worldGroup.add(statics.group);
    world.casters.push(...statics.meshes);

    // trees
    // look.trees.noPlant: kinds a structure may not plant for itself, on a track above the treeline
    if (look.trees.noPlant) world.plant = world.plant.filter((p) => !look.trees.noPlant.includes(p.kind));
    world.trees = placeTrees(track, world, look, forestOf);
    world.trees.farCap = look.trees.farCap; world.trees.nearBand = look.trees.nearBand;
    // look.trees.snow { color, amount, edge: [from, to], clump }: boughs under snow, white where a face looks up (edge, default 0.2 to 0.42), dark under each tier, broken by noise (clump, default 0.62; much of it reads as blotches); none by default
    const treeSnow = look.trees.snow && { code: { key: 'treeSnow', uniforms: { uTreeSnow: { value: new THREE.Color(look.trees.snow.color) }, uTreeSnowA: { value: look.trees.snow.amount ?? 1 }, uTreeSnowE: { value: new THREE.Vector3(look.trees.snow.edge?.[0] ?? 0.2, look.trees.snow.edge?.[1] ?? 0.42, look.trees.snow.clump ?? 0.62) } }, pars: 'uniform vec3 uTreeSnow; uniform float uTreeSnowA; uniform vec3 uTreeSnowE;',
      color: /* glsl */`{ vec3 wn = normalize(cross(dFdx(vCWorld), dFdy(vCWorld))); float clump = cVn(vec2(vCWorld.x + vCWorld.z * 0.6, vCWorld.y * 1.3) * 0.9) * 0.55 + cVn(vec2(vCWorld.z - vCWorld.x * 0.5, vCWorld.y * 2.1) * 1.9 + 3.0) * 0.45; float sn = smoothstep(uTreeSnowE.x, uTreeSnowE.y, wn.y + (clump - 0.5) * uTreeSnowE.z); diffuseColor.rgb = mix(diffuseColor.rgb, uTreeSnow, sn * uTreeSnowA); }` } };
    // look.trees.mottle: an amount: clumps of leaf painted over a crown, so that up close it is foliage and not a smooth lit mesh; none by default
    const treeMottle = !treeSnow && look.trees.mottle && { code: { key: 'treeMottle', uniforms: { uTM: { value: look.trees.mottle } }, pars: 'uniform float uTM;',
      color: /* glsl */`{ float tm = cVn(vec2(vCWorld.x + vCWorld.z * 0.6, vCWorld.y * 1.2) * 1.1) * 0.55 + cVn(vec2(vCWorld.z - vCWorld.x * 0.5, vCWorld.y * 1.7) * 2.7 + 3.0) * 0.45; float tf = 1.0 - smoothstep(0.05, 0.4, length(fwidth(vCWorld))); diffuseColor.rgb *= 1.0 + uTM * tf * (smoothstep(0.38, 0.62, tm) - 0.5); }` } };
    // look.trees.trunk: a colour: a trunk in its own wood, not in a dark shade of the instance's leaves; none by default
    if (treeMottle && look.trees.trunk) { const t = new THREE.Color(look.trees.trunk); treeMottle.code.key += `:${look.trees.trunk}`; treeMottle.code.vmain = `if (color.r < 0.45) vColor.rgb = vec3(${t.r.toFixed(3)}, ${t.g.toFixed(3)}, ${t.b.toFixed(3)}) * (color.r / 0.33);`; }
    world.treeMat = mat('#ffffff', { vertexColors: true, sway: 0.0035, ...treeSnow, ...treeMottle });
    world.treeGeos = SHAPES.map((_, s) => BANDS.map((__, b) => treeGeometry(s, b, s === 0 ? 5 : 9, look.trees.roundLods)));
    const casters = casterMesh(world.trees, world.treeGeos, world.treeMat, track.long ? 2 : 1);
    for (const m of casters) worldGroup.add(m);
    world.casters.push(...casters);
    const blobsList = batch.blobs.slice();
    const T = world.trees;
    for (let i = 0; i < T.count; i++) blobsList.push({ x: T.pos[i * 3], z: T.pos[i * 3 + 2], r: T.height[i] * 0.34, a: 0.34 });
    world.blobs = blobsList;

    const rocksList = placeRocks(track, world, look);
    world.rocks = rockMesh(rocksList, mat('#ffffff', { facets: false, cover: false }), look);
    worldGroup.add(world.rocks);
    world.casters.push(world.rocks);
    for (const r of rocksList) blobsList.push({ x: r.x, z: r.z, r: r.r * 1.5, a: 0.4 });

    world.pads = createPads(track, shared);
    if (world.pads) worldGroup.add(world.pads);

    bakeGroundShade(renderer, scene, world, look, shared, { size: shadeSize });
    land.ready?.({ ...ctx, renderer, scene }); // optional, once all that stands has been built: for what is captured from the finished world
    for (const m of casters) { worldGroup.remove(m); m.dispose(); }

    // a long track from here on is drawn by distance from each view (render/stream.js)
    if (track.long) {
      world.rockIndex = createRockIndex(world.rocks);
      worldGroup.remove(world.rocks);
      world.rocks.dispose();
      world.stream = createStream({ ground: world.ground, road, statics: statics.entries, extra: world.staticGroup.children.filter((m) => m.isMesh), water: world.ground.water, look, def, cameraFar: look.camera.far });
    }

    if (weather) {
      const X = wxShared(weather, def, look), U = shared.wx;
      U.uWxOn.value = 1; U.uWxCover.value.set(X.snow, X.wet, 3.2, 0); U.uWxSky.value.setRGB(...X.sky); U.uWxLamps.value = X.lamps; U.uWxNight.value = X.night;
      // a night on a track that has none of its own: street lamps along the road
      const lamps = weather.night && !isNightTrack(def) ? nightLamps(track, terrain, def) : null;
      if (lamps) { world.litMap = bakeLitMap(track, lamps, world.windows); U.uLitMap.value = world.litMap.tex; U.uLitRect.value.set(...world.litMap.rect); U.uLitY.value.set(...world.litMap.height); }
      world.weather = createWeatherWorld({ scene, shared, mat, track, wx: weather, look, def, lamps, fx });
      if (world.bromoSprites) for (const k of ['smokeLit', 'smokeLow', 'dustC']) world.bromoSprites[k].set(gradeHex(gradeOf(weather, def), `#${world.bromoSprites[k].getHexString()}`)); // the volcano's plume, under the same sky
      world.hemiBase = look.hemi.intensity;
    }
    W = world;
    W.overview = null;
    W.land = land;
    W.landUpdate = null;
    if (land.update) W.landUpdate = land.update;
    return world;
  }

  function unload() {
    disposeViews();
    for (const c of [...worldGroup.children]) { worldGroup.remove(c); disposeTree(c); }
    if (W) {
      scene.remove(W.sky); W.sky.geometry.dispose(); W.sky.material.dispose();
      if (W.horizon) { scene.remove(W.horizon.mesh); W.horizon.dispose(); }
      if (W.backdrop) { if (W.backdrop.mesh) scene.remove(W.backdrop.mesh); W.backdrop.dispose(); }
      if (W.weather) W.weather.dispose();
      if (W.litMap) W.litMap.tex.dispose();
      const U = shared.wx;
      U.uWxOn.value = 0; U.uLitRect.value.set(0, 0, 0, 0); U.uWxLamps.value = 0; U.uWxCover.value.set(0, 0, 0, 0); shared.grade.uGrFlash.value = 0;
      if (W.ground.water) { scene.remove(W.ground.water); disposeTree(W.ground.water); }
      if (hazards) { scene.remove(hazards.group); hazards.dispose(); hazards = null; }
      if (disasters) { disasters.dispose(); disasters = null; }
      if (traffic) { traffic.dispose(); traffic = null; }
      if (boxes) { scene.remove(boxes.mesh, boxes.glow); boxes.mesh.dispose(); boxes.glow.dispose(); boxes = null; }
      if (overview) { overview.dispose(); overview = null; }
      for (const row of W.treeGeos) for (const g of row) g.dispose();
    }
    staged = false;
    W = null;
    fx.clear();
  }
  function disposeTree(o) {
    o.traverse((c) => { if (c.geometry) c.geometry.dispose(); if (c.isInstancedMesh) c.dispose(); });
  }

  function setKarts(players) {
    colors = players.map((p) => p.color || '#ffffff');
    teamFlags.clear();
    return kartPool.set(players).then(() => teamFlags.set(kartPool.karts, players));
  }

  function setViews(indices) {
    disposeViews();
    if (!W) throw new Error('setViews before loadTrack');
    const list = indices.length ? indices : [0];
    views = list.slice(0, 4).map(makeView);
    for (const v of views) { for (const m of v.trees.meshes) scene.add(m); if (v.rocks) scene.add(v.rocks.mesh); }
    layout = viewLayout(views.length);
    if (views.length === 3 && !overview) {
      overview = createOverview(renderer, scene, W.track, W.look);
      if (W.bakedTree) W.bakedTree();
      const mapShow = W.stream ? (on) => W.stream.showAll(on) : undefined;
      // seen from straight above, the far ground is not far: no mist on the map
      const mistK = shared.mist.uMist.value.z;
      shared.mist.uMist.value.z = 0;
      overview.bake(mapShow);
      shared.mist.uMist.value.z = mistK;
    }
  }

  // Scratch copy of a kart interpolated between two sim states; yaw round the short way.
  function interp(out, a, b, t) {
    for (const key of Object.keys(b)) out[key] = b[key];
    if (!a) return out;
    out.x = lerp(a.x, b.x, t); out.y = lerp(a.y, b.y, t); out.z = lerp(a.z, b.z, t);
    out.vx = lerp(a.vx, b.vx, t); out.vz = lerp(a.vz, b.vz, t); out.vy = lerp(a.vy, b.vy, t);
    out.yaw = a.yaw + angleTo(a.yaw, b.yaw) * t;
    out.pitch = lerp(a.pitch, b.pitch, t); out.roll = lerp(a.roll, b.roll, t);
    return out;
  }

  function gatherFor(v, cam, force) {
    const fx0 = -cam.matrixWorld.elements[8], fz0 = -cam.matrixWorld.elements[10], l = Math.hypot(fx0, fz0) || 1, fxx = fx0 / l, fzz = fz0 / l;
    const px = cam.position.x, pz = cam.position.z, dx = px - v.gx, dz = pz - v.gz, dot = fxx * v.fx + fzz * v.fz;
    if (!force && dx * dx + dz * dz < 36 && dot > 0.985) return false;
    const half = Math.atan(Math.tan((cam.fov * Math.PI) / 360) * cam.aspect) + 0.22;
    v.trees.gather(px, pz, fxx, fzz, Math.cos(Math.min(half, 1.35)));
    v.rocks?.gather(px, pz);
    v.gx = px; v.gz = pz; v.fx = fxx; v.fz = fzz;
    return true;
  }

  function flyover({ duration = 7 } = {}) {
    flyT = 0; flyDur = duration;
    return new Promise((res) => { flyResolve = res; });
  }
  const skipFlyover = () => { if (flyT >= 0) { flyT = -1; const r = flyResolve; flyResolve = null; r?.(); } };

  // Everything that belongs to the state, then one pass per view. dt in seconds of real time.
  function frame(prev, state, alpha = 1, dt = 1 / 60, events = []) {
    if (!W) return;
    const now = performance.now();
    if (lastNow) { const ms = now - lastNow; emaMs = lerp(emaMs, Math.min(ms, 100), 0.08); }
    lastNow = now;
    time += dt;
    shared.time.value = time;
    const karts = state.karts, n = karts.length;
    while (scratch.length < n) scratch.push({});
    for (let i = 0; i < n; i++) interp(scratch[i], prev?.karts?.[i], karts[i], alpha);
    const K = scratch.slice(0, n);

    if (!staged) {
      staged = true;
      boxes = createBoxes(W.track, W.look, mat, state.boxes.length || 1);
      scene.add(boxes.mesh, boxes.glow);
      hazards = createHazards(state, mat, shared);
      scene.add(hazards.group);
      disasters = createDisasterWorld({ track: W.track, terrain: W.terrain, look: W.look, mat, shared, scene, fx, world: W, state });
      if (W.track.def.traffic) traffic = createTrafficWorld({ track: W.track, mat, scene, shadowTint: W.look.trafficShadow ?? (W.weather ? W.look.kartShadow : null) });
    }
    frameNo++;
    traffic?.update(dt);
    // crates and animals only near a view, so their triangles do not grow with the lap
    const near = (x, z) => {
      for (const v of views) {
        const c = v.cam.camera.position, q = K[v.kart], dx = x - q.x, dz = z - q.z, ex = x - c.x, ez = z - c.z;
        if (dx * dx + dz * dz < NEAR_THINGS || ex * ex + ez * ez < NEAR_THINGS) return true;
      }
      return false;
    };
    // and a crate behind every camera costs its triangles for nothing: two bands in reach is 50k on a long lap
    const nearAhead = (x, z) => {
      for (const v of views) {
        const c = v.cam.camera.position, q = K[v.kart], dx = x - q.x, dz = z - q.z, ex = x - c.x, ez = z - c.z, fx = q.x - c.x, fz = q.z - c.z;
        if ((dx * dx + dz * dz < NEAR_THINGS || ex * ex + ez * ez < NEAR_THINGS) && (fx * fx + fz * fz > 1600 || ex * fx + ez * fz > -Math.hypot(fx, fz) * 12)) return true; // a free or flyover camera sees all round
      }
      return false;
    };
    boxes.update(state.boxes, time, dt, nearAhead);
    hazards.update(state.hazards, time, near);
    for (const e of events) {
      fx.onEvent(e, K);
      W.weather?.onEvent(e, K);
      traffic?.onEvent(e, fx);
      disasters.onEvent(e);
      kartPool.onEvent(e);
      views.forEach((v) => {
        if (e.type === 'hit' && e.kart === v.kart && (e.kind === 'spin' || e.kind === 'tumble')) { v.cam.bump(1); v.cam.jolt(e.kind === 'tumble' ? 1 : 0.8); }
        else if (e.type === 'boom' && e.kind !== 'clear' && e.kind !== 'polenta' && e.kind !== 'durian' && e.kind !== 'tile' && e.kind !== 'log' && e.kind !== 'bank' && Math.hypot(e.x - K[v.kart].x, e.z - K[v.kart].z) < 22) v.cam.bump(0.9);
        else if (e.type === 'boost' && e.kart === v.kart) v.cam.bump(0.3 + 0.15 * (e.tier || 1));
        else if (e.type === 'land' && e.kart === v.kart) { const hard = clamp((e.force || 0) / 14, 0, 1); v.cam.bump(0.3 + 0.4 * hard); v.cam.jolt(0.2 + 0.5 * hard); }
        else if ((e.type === 'bump' && (e.a === v.kart || e.b === v.kart)) || (e.type === 'wall' && e.kart === v.kart) || (e.type === 'traffic' && e.kart === v.kart && (e.kind === 'scrape' || e.kind === 'scatter'))) v.cam.bump(0.4);
      });
    }
    for (let i = 0; i < n; i++) fx.kart(i, K[i], dt);
    fx.objects(state, K, dt);
    disasters.update(state, K, views, time, dt);
    fx.update(dt);
    kartPool.update(K, state, dt, W.track, W.terrain, blobs, fx, time);
    ghostPool.update(dt);
    if (state.forma) (formaWorld ||= createFormaWorld({ THREE, scene, mat, shapes })).update(state.forma, K, alpha, dt);
    else formaWorld?.hide();
    teamFlags.update(K, dt, time);
    W.landUpdate?.(time, dt, K);
    if (W.weather) { W.weather.update(K, time, dt, state); hemi.intensity = W.hemiBase * (1 + (state.weather?.flash ?? 0) * 1.1); }

    if (flyT >= 0) { flyT += dt / flyDur; if (flyT >= 1) skipFlyover(); }

    // views
    renderer.info.reset();
    const target = post.target;
    renderer.setRenderTarget(target);
    target.scissorTest = false;
    let drew = 0;
    for (let q = 0; q < views.length; q++) {
      const v = views[q], [lx, ly, lw, lh] = layout[q], px = Math.round(lx * targetW), py = Math.round(ly * targetH), pw = Math.round(lw * targetW), ph = Math.round(lh * targetH);
      target.viewport.set(px, py, pw, ph);
      target.scissor.set(px, py, pw, ph);
      target.scissorTest = true;
      renderer.setRenderTarget(target);
      const aspect = pw / ph;
      if (v.cam.camera.aspect !== aspect) { v.cam.camera.aspect = aspect; v.cam.camera.updateProjectionMatrix(); }
      const k = K[v.kart];
      if (v.poseOn) { /* a tool holds the camera */ }
      else if (flyT >= 0) v.cam.flyover(flyT, q * 0.02);
      else if (k.finished) v.cam.orbit(k, dt);
      else { v.cam.quake(state.quake || 0); v.cam.chase(k, dt); }
      // at most one view refills its trees per frame, oldest first, unless it has none yet
      const force = v.gx > 1e8;
      if (force || !drew) { if (gatherFor(v, v.cam.camera, force)) drew = 1; }
      for (const o of views) { o.trees.show(o === v); o.rocks?.show(o === v); }
      if (v.stream) { const c = v.cam.camera.position; W.stream.refresh(v.stream, c.x, c.z); W.stream.show(v.stream); }
      renderer.clear(true, true, false);
      kartPool.viewPrepare(v.kart);
      teamFlags.viewPrepare(v.kart);
      ghostPool.viewPrepare(v.kart, k);
      if (state.forma) formaWorld.viewPrepare(v.kart, v.cam.camera);
      traffic?.prepare(q, v.cam.camera, state.t - (1 - alpha) / 60, frameNo, state.traffic?.knocked, state.traffic?.rain);
      W.weather?.prepare(q, v.cam.camera, K, v.kart, dt, ph);
      const trisBefore = renderer.info.render.triangles;
      renderer.render(scene, v.cam.camera);
      if (v.stream) budgetTrees(v, renderer.info.render.triangles - trisBefore);
    }
    for (const o of views) { o.trees.show(false); o.rocks?.show(false); }
    W.stream?.sweep();
    // the fourth cell of a three player race
    if (views.length === 3 && overview) {
      const pw = Math.round(0.5 * targetW), ph = Math.round(0.5 * targetH), px = pw;
      target.viewport.set(px, 0, pw, ph); target.scissor.set(px, 0, pw, ph);
      renderer.setRenderTarget(target);
      renderer.clear(true, true, false);
      overview.update(K, colors, views.map((v) => v.kart), ph, state.forma?.wheel);
      renderer.render(overview.scene, overview.camera);
    }
    target.scissorTest = false;
    const calls = renderer.info.render.calls, tris = renderer.info.render.triangles;
    post.composite(views.length <= 1 ? 0 : views.length === 2 ? 1 : 2);

    stats.drawCalls = calls; stats.triangles = tris; stats.perView = calls / views.length; stats.trianglesPerView = tris / views.length;
    stats.fps = 1000 / emaMs; stats.scale = scale; stats.live = fx.live;
    if (W.stream) stats.stream = W.stream.stats();
    adapt(dt);
  }

  // A long track holds each view under the triangle budget whatever its landmarks bring: the far trees give way, and come back slowly.
  function budgetTrees(v, tris) {
    const k = v.trees.density;
    if (tris > TREE_BUDGET_HIGH && k > 0.3) { v.trees.setDensity(Math.max(0.3, k - 0.12)); v.gx = 1e9; v.hold = 120; }
    else if (v.hold > 0) v.hold--;
    else if (tris < TREE_BUDGET_LOW && k < 1) { v.trees.setDensity(Math.min(1, k + 0.04)); v.gx = 1e9; v.hold = 60; }
  }

  // Dynamic resolution: a slow frame rate lowers the scale in steps, a long fast spell brings it back. Never during a capture.
  function adapt(dt) {
    if (quality !== 'auto') return;
    const budget = views.length >= 3 ? 1000 / 45 : 1000 / 60;
    if (emaMs > budget * 1.06) { slowFor += dt; fastFor = 0; } else if (emaMs < budget * 0.82) { fastFor += dt; slowFor = 0; } else { slowFor = 0; fastFor = 0; }
    if (slowFor > 0.7 && scale > 0.6) { scale = Math.max(0.6, scale - 0.08); slowFor = 0; size(); }
    if (fastFor > 4 && scale < 1) { scale = Math.min(1, scale + 0.06); fastFor = 0; size(); }
  }

  // The pick screen's turntable: one kart under the look of the current track (or the default), on a clear background, with the race's ink lines.
  async function showcase(kartId, { canvas: cv = null, yaw = 2.5, size: sz = 512, color } = {}) {
    if (!cv) { cv = document.createElement('canvas'); cv.width = sz; cv.height = sz; }
    const r2 = new THREE.WebGLRenderer({ canvas: cv, antialias: false, alpha: true, preserveDrawingBuffer: true, depth: false, stencil: false });
    r2.outputColorSpace = THREE.LinearSRGBColorSpace;
    r2.setSize(cv.width, cv.height, false);
    r2.setClearColor(0x000000, 0);
    const sc = new THREE.Scene();
    sc.add(new THREE.HemisphereLight('#ffffff', '#b7a78a', 2.2));
    const s2 = new THREE.DirectionalLight('#fff0dc', 2.7); s2.position.set(-2, 3, 2.2); sc.add(s2);
    const model = await buildKart(kartId, { THREE, mat, shapes }, color);
    model.group.rotation.y = yaw;
    sc.add(model.group);
    const c2 = new THREE.PerspectiveCamera(30, cv.width / cv.height, 0.5, 50);
    const framed = fitShowcase(model);
    c2.position.set(0, framed.y + 1.3, 6.4); c2.lookAt(0, framed.y, 0); c2.fov = framed.fov(c2.position); c2.updateProjectionMatrix();
    const ink = createInk(r2, cv.width, cv.height, c2);
    function draw(dt = 1 / 60, a = yaw, state = null) {
      model.group.rotation.y = a;
      model.update?.({ speed: 0, steer: 0, boostT: 0, drift: 0, grounded: true, t: time, ...state }, dt);
      // the turntable stands in no weather: its materials share the world's uniforms
      const wxOn = shared.wx.uWxOn.value;
      shared.wx.uWxOn.value = 0;
      ink.render(sc, c2);
      shared.wx.uWxOn.value = wxOn;
      return cv;
    }
    draw();
    return { canvas: cv, draw, model, dispose() { ink.dispose(); r2.dispose(); } };
  }

  function resize() { size(); }
  function dispose() {
    unload();
    post.dispose();
    kartPool.dispose();
    ghostPool.dispose();
    formaWorld?.dispose();
    renderer.dispose();
  }

  return {
    three: renderer, scene, shared, mat, shapes, THREE,
    loadTrack, setKarts, setViews, frame, showcase, resize, dispose, flyover, skipFlyover,
    teamFlagCount: () => teamFlags.count, setGhosts: (list) => ghostPool.set(list), setGhostPoses: (poses) => ghostPool.pose(poses), ghostStats: () => ghostPool.stats(),
    stats: () => ({ ...stats }),
    get world() { return W; },
    get views() { return views; },
    get look() { return W?.look || DEFAULT_LOOK; },
    setScale(v) { scale = clamp(v, 0.4, 1); size(); },
    setPatches: (list) => W?.weather?.setPatches(list), weatherStats: () => W?.weather?.stats() ?? null,
    loadItem: (id) => loadItem(id, { THREE, mat, shapes }),
  };
}
