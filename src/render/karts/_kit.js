// What every kart is made of: one skinned mesh per kart, whatever moves is a bone. Eight karts in a race are eight draw
// calls instead of forty, and the driver's ears, a flag or a puff of smoke cost a bone, not a mesh. Each vertex follows
// one bone, rigidly. The pool spins and steers `wheels`, which are bones here too.
import { clamp, lerp, follow, linear } from '../math.js';

export const SHINY = { vertexColors: true, gloss: [26, 0.05], rim: [0.05, 3] };
const HALF_PI = Math.PI / 2;

// Round pieces the shared shapes do not have.
export function extras({ THREE, shapes }) {
  const { lathe, place, merge, capsule, sphere } = shapes;
  const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3();
  // A lathe closes at the axis with triangles of no area: they cost as much as the others, so they go.
  const trim = (g) => {
    const P = g.attributes.position, X = g.index, keep = [], a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let i = 0; i < X.count; i += 3) {
      a.fromBufferAttribute(P, X.getX(i)); b.fromBufferAttribute(P, X.getX(i + 1)); c.fromBufferAttribute(P, X.getX(i + 2));
      if (b.sub(a).cross(c.sub(a)).lengthSq() > 1e-14) keep.push(X.getX(i), X.getX(i + 1), X.getX(i + 2));
    }
    g.setIndex(keep);
    return g;
  };
  // Half a sphere, its pole on +z, so an eye or a button spends nothing on the side nobody sees.
  const dome = (r = 0.5, seg = 12, rows = 3, flat = 1) => {
    const p = [];
    for (let i = 0; i <= rows; i++) { const a = (i / rows) * HALF_PI; p.push([Math.max(Math.cos(a) * r, i === rows ? 0 : 1e-4), Math.sin(a) * r * flat]); }
    return place(trim(lathe(p, seg)), { r: [HALF_PI, 0, 0] });
  };
  // A filled disc facing +z: a highlight, a painted motif.
  const disc = (r = 0.5, seg = 8) => poly(Array.from({ length: seg }, (_, i) => [Math.sin((i / seg) * Math.PI * 2) * r, Math.cos((i / seg) * Math.PI * 2) * r]));
  // A flat fan from outline points [[x, y], ...] clockwise as seen from +z, facing +z.
  const poly = (pts) => {
    const pos = [0, 0, 0], nor = [0, 0, 1], idx = [];
    let cx = 0, cy = 0;
    for (const [x, y] of pts) { cx += x; cy += y; }
    pos[0] = cx / pts.length; pos[1] = cy / pts.length;
    pts.forEach(([x, y], i) => { pos.push(x, y, 0); nor.push(0, 0, 1); idx.push(0, 1 + (i + 1) % pts.length, 1 + i); });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setIndex(idx);
    return g;
  };
  const star = (r = 0.5, n = 5, inner = 0.48) => poly(Array.from({ length: n * 2 }, (_, i) => { const a = (i / (n * 2)) * Math.PI * 2, k = i % 2 ? r * inner : r; return [Math.sin(a) * k, Math.cos(a) * k]; }));
  // The same flat fan seen from both sides, and a little thick so it takes an ink line.
  const twoSided = (g, t = 0.02) => {
    const b = g.clone(), X = b.index, N = b.attributes.normal, P = b.attributes.position;
    for (let i = 0; i < X.count; i += 3) { const a = X.getX(i + 1); X.setX(i + 1, X.getX(i + 2)); X.setX(i + 2, a); }
    for (let i = 0; i < N.count; i++) { N.setXYZ(i, -N.getX(i), -N.getY(i), -N.getZ(i)); P.setZ(i, P.getZ(i) - t); }
    return merge([g, b]);
  };
  // A capsule from point a to point b.
  const limb = (a, b, r = 0.08, seg = 6, cap = 2) => {
    dir.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const len = dir.length();
    dir.multiplyScalar(1 / (len || 1));
    q.setFromUnitVectors(up, dir);
    const g = capsule(r, len, cap, seg);
    g.applyQuaternion(q);
    g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    return g;
  };
  const ball = (r, s = [1, 1, 1], ws = 10, hs = 7) => place(sphere(r, ws, hs), { s });
  // A tyre and its hub in one piece, axle along x, outer face on +x; side -1 mirrors it. Colour goes by ring, each colour with its own
  // copy of the ring so the rim stays crisp, and no triangle is spent between two copies.
  const wheelGeo = (R, W, { tyre = '#2c2a33', rim = '#f2c544', hub = '#d9483b', seg = 11, side = 1, rimAt = 0.62, hubAt = 0.26 } = {}) => {
    const hw = W / 2, runs = [
      [tyre, [[0, -hw], [R * 0.86, -hw], [R, -hw * 0.3], [R, hw * 0.45], [R * 0.88, hw], [R * rimAt, hw * 0.94]]],
      [rim, [[R * rimAt, hw * 0.94], [R * hubAt, hw * 1.04]]],
      [hub, [[R * hubAt, hw * 1.04], [0, hw * 1.3]]],
    ];
    const list = runs.map(([color, pts]) => shapes.paint(trim(lathe(pts, seg)), color));
    const g = merge(list);
    g.rotateZ(-HALF_PI); // lathe +y becomes +x
    if (side < 0) g.rotateZ(Math.PI);
    return g;
  };
  // Spoked cart wheel: iron tyre, wooden felloe, spokes and a hub, axle along x.
  const spokedGeo = (R, W, { iron = '#3a3640', wood = '#b8743a', hub = '#d9483b', spokes = 7, seg = 14, side = 1 } = {}) => {
    const { torus, paint } = shapes, list = [];
    list.push(paint(place(torus(R - W * 0.28, W * 0.34, 3, seg), { r: [0, HALF_PI, 0] }), iron));
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * Math.PI;
      list.push(paint(place(shapes.box(W * 0.34, (R - W * 0.3) * 2, W * 0.42), { r: [a, 0, 0] }), wood));
    }
    list.push(paint(place(shapes.lathe([[R * 0.22, -W * 0.5], [R * 0.2, W * 0.6], [0, W * 0.72]], 7), { r: [0, 0, -HALF_PI * side], p: [0, 0, 0] }), hub));
    return merge(list);
  };
  // Rows of roof tiles on a plane from corner a along u and v: only the top and the lip of each, so a tile costs 4 triangles.
  const tiles = (a, u, v, rows, cols, colors, lift = 0.03) => {
    const pos = [], col = [], idx = [], U = new THREE.Vector3(...u), V = new THREE.Vector3(...v), n = new THREE.Vector3().crossVectors(V, U).normalize(), A = new THREE.Vector3(...a), P = new THREE.Vector3();
    if (n.y < 0) n.negate();
    const e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
    const quad = (p, c, want) => {
      const b = pos.length / 3;
      for (const q of p) { pos.push(q.x, q.y, q.z); col.push(...c); }
      // whichever way the slope runs, the tile faces out
      e1.subVectors(p[1], p[0]); e2.subVectors(p[2], p[0]);
      if (e1.cross(e2).dot(want) > 0) idx.push(b, b + 1, b + 2, b, b + 2, b + 3); else idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
    };
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols + (i % 2); j++) {
      const c = linear(colors[(i * 3 + j * 5 + (i * j) % 3) % colors.length]), shift = i % 2 ? -0.5 : 0;
      const j0 = Math.max(0, (j + shift) / cols), j1 = Math.min(1, (j + 1 + shift) / cols), i0 = i / rows, i1 = (i + 1.25) / rows;
      const at = (f, g, h) => P.copy(A).addScaledVector(U, f).addScaledVector(V, g).addScaledVector(n, h).clone();
      const gap = 0.012 / V.length();
      // the tile's lower edge stands proud of the row below it
      quad([at(i0, j0 + gap, lift), at(i0, j1 - gap, lift), at(Math.min(i1, 1), j1 - gap, 0.002), at(Math.min(i1, 1), j0 + gap, 0.002)], c, n);
      quad([at(i0, j0 + gap, -0.01), at(i0, j1 - gap, -0.01), at(i0, j1 - gap, lift), at(i0, j0 + gap, lift)], c.map((q) => q * 0.62), U.clone().negate());
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };
  // A closed outline [[z, y], ...] drawn clockwise when seen from +x, pulled along x to width w; sides round, ends flat. A blade, a track, a roof.
  const extrude = (outline, w, { smooth = true } = {}) => {
    const n = outline.length, h = w / 2, pos = [], nor = [], idx = [];
    const norm = (i) => { const [z0, y0] = outline[(i - 1 + n) % n], [z1, y1] = outline[(i + 1) % n], dz = z1 - z0, dy = y1 - y0, l = Math.hypot(dz, dy) || 1; return [dy / l, -dz / l]; };
    for (let i = 0; i < n; i++) {
      const [z, y] = outline[i], [nz, ny] = norm(i);
      pos.push(h, y, z, -h, y, z); nor.push(0, ny, nz, 0, ny, nz);
    }
    for (let i = 0; i < n; i++) { const a = i * 2, b = a + 1, c = ((i + 1) % n) * 2, d = c + 1; idx.push(a, c, b, b, c, d); }
    for (const sx of [1, -1]) {
      const c0 = pos.length / 3;
      outline.forEach(([z, y]) => { pos.push(sx * h, y, z); nor.push(sx, 0, 0); });
      for (let i = 1; i < n - 1; i++) { if (sx > 0) idx.push(c0, c0 + i, c0 + i + 1); else idx.push(c0, c0 + i + 1, c0 + i); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setIndex(idx);
    if (!smooth) g.computeVertexNormals();
    return g;
  };
  // Two colours by height, the sand or the mud a kart has picked up: over y1 clean, under y0 all dirt.
  const dirty = (g, clean, dirt, y0, y1) => {
    const a = linear(clean), b = linear(dirt), n = g.attributes.position.count, C = new Float32Array(n * 3), P = g.attributes.position;
    for (let i = 0; i < n; i++) { const t = clamp((P.getY(i) - y0) / (y1 - y0), 0, 1); for (let c = 0; c < 3; c++) C[i * 3 + c] = lerp(b[c], a[c], t); }
    g.setAttribute('color', new THREE.BufferAttribute(C, 3));
    return g;
  };
  // A skin through cross sections, front to back: rings [{ z, pts: [[x, y], ...] }], each the same count, counter-clockwise seen from +z.
  // Smooth along the sides, flat caps: a car body, a horse's barrel, whatever a sphere is the wrong shape for.
  const loft = (rings) => {
    const n = rings[0].pts.length, pos = [], idx = [];
    rings.forEach(({ z, pts }) => pts.forEach(([px, py]) => pos.push(px, py, z)));
    for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < n; j++) {
      const a = i * n + j, b = i * n + (j + 1) % n, c = a + n, d = b + n;
      idx.push(a, c, b, b, c, d);
    }
    const cap = (ring, front) => {
      const c0 = pos.length / 3;
      let cx = 0, cy = 0;
      ring.pts.forEach(([px, py]) => { cx += px / n; cy += py / n; pos.push(px, py, ring.z); });
      pos.push(cx, cy, ring.z);
      for (let j = 0; j < n; j++) { const a = c0 + j, b = c0 + (j + 1) % n; if (front) idx.push(c0 + n, a, b); else idx.push(c0 + n, b, a); }
    };
    cap(rings[0], true); cap(rings[rings.length - 1], false);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };
  // A rounded ring for loft: half width, half height, centre height, and how square it is (0 a diamond-ish oval, 1 nearly a box).
  const oval = (hw, hh, cy, n = 8, square = 0) => Array.from({ length: n }, (_, i) => {
    const a = -HALF_PI + (i / n) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), e = 1 / (1 + square);
    return [Math.sign(c) * Math.abs(c) ** e * hw, cy + Math.sign(s) * Math.abs(s) ** e * hh];
  });
  // A six-sided solid from its eight corners, four at the front and four at the back, each face flat: a plank that leans, a pillar that tapers.
  // Corners go counter-clockwise seen from +z, the first four on the +z side.
  const solid = (c) => {
    const faces = [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]], pos = [], idx = [];
    for (const f of faces) {
      const b = pos.length / 3;
      for (const i of f) pos.push(...c[i]);
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };
  // A smooth run of points through a few: S-curved booms, bent pipes.
  const curve = (pts, n = 8) => new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))).getPoints(n).map((v) => [v.x, v.y, v.z]);
  return { dome, disc, poly, star, twoSided, limb, ball, wheelGeo, spokedGeo, tiles, extrude, dirty, trim, curve, loft, oval, solid };
}

// One lightly damped spring: rate in 1/s, how quickly it answers; damp below 1 overshoots, which is what makes things alive.
export function spring(rate = 12, damp = 0.45) {
  return {
    x: 0, v: 0,
    step(target, dt) {
      const k = rate * rate, c = 2 * damp * rate;
      this.v += (k * (target - this.x) - c * this.v) * dt;
      this.x += this.v * dt;
      return this.x;
    },
  };
}

// What the driver and the kart's own moving bits react to, read from the sim's kart each frame.
function createSense() {
  const m = {
    t: Math.random() * 40, dt: 0, speed: 0, sn: 0, steer: 0, lean: 0, drift: 0, air: 0, boost: 0, hit: 0, tumble: 0, cheer: 0, sad: 0, tipsy: 0, stink: 0, big: 0, throttle: 0, roll: 0,
    fwd: 0, lat: 0, vert: 0, dist: 0, seed: Math.random() * 10,
    soot: 0, lick: 0, lickT: 0, sip: 0, pan: 0,
  };
  const sLat = spring(9, 0.34), sFwd = spring(8, 0.32), sVert = spring(13, 0.28);
  let lastSpeed = 0, lastVy = 0, lastYaw = null, lastBoost = 0, sipAt = -9;
  const to = (key, want, rate, dt) => { m[key] = lerp(m[key], want, follow(rate, dt)); };
  m.sense = (k, dtIn) => {
    const dt = clamp(dtIn || 0, 0, 0.05);
    m.dt = dt; m.t += dt;
    const speed = k.speed || 0, pose = k.pose || null, vy = k.vy || 0;
    m.speed = speed; m.sn = clamp(speed / 30, 0, 1.4); m.dist += speed * dt;
    const steer = pose === 'leanL' ? -1 : pose === 'leanR' ? 1 : pose === 'drift' ? 1 : k.steer || 0;
    const driftWant = pose === 'drift' ? 1 : k.drift ? 1 : 0;
    const finished = !!k.finished, place = k.place || 1;
    const cheer = pose === 'cheer' || (finished && place <= 3) ? 1 : finished && place <= 5 ? 0.45 : 0;
    const sad = pose === 'sad' || (finished && place >= 6) ? 1 : 0;
    const hit = pose === 'hit' || k.hitT > 0 ? 1 : 0;
    if (dt > 0) {
      const acc = clamp((speed - lastSpeed) / dt, -60, 60) / 30;
      const turn = lastYaw === null ? 0 : clamp(((k.yaw || 0) - lastYaw) / dt, -3, 3) * m.sn;
      sFwd.step(acc, dt); sLat.step(turn * 0.7 + steer * m.sn * 0.8, dt);
      sVert.step(clamp((vy - lastVy) / dt, -80, 80) / 40, dt);
      to('steer', steer, 9, dt);
      to('lean', steer, 7, dt);
      to('drift', driftWant, 9, dt);
      to('air', pose === 'air' || (k.grounded === false && hit === 0) ? 1 : 0, 8, dt);
      to('boost', pose === 'boost' || k.boostT > 0 ? 1 : 0, 10, dt);
      to('hit', hit, hit ? 16 : 5, dt);
      to('tumble', k.hitKind === 'tumble' ? 1 : 0, 10, dt);
      to('cheer', cheer, 5, dt);
      to('sad', sad, 4, dt);
      to('tipsy', pose === 'tipsy' || k.tipsyT > 0 ? 1 : 0, 6, dt);
      to('stink', pose === 'stink' || k.stinkT > 0 ? 1 : 0, 6, dt);
      to('big', k.bigT > 0 ? 1 : 0, 7, dt);
      to('throttle', k.throttle > 0 && speed > 0.5 ? 1 : 0, 5, dt);
      // what the items leave on the face: a burnt one, lips licked at the smell of the pot, a sip from the bottle as the boost starts, the pan on the head
      to('soot', pose === 'soot' || k.sootT > 0 ? 1 : 0, 7, dt);
      m.lickT = Math.max(0, m.lickT - dt);
      to('lick', pose === 'lick' || k.rendangT > 0 || m.lickT > 0 ? 1 : 0, 7, dt);
      const boostT = k.boostT || 0;
      if (boostT > lastBoost + 0.05 && (k.boostKind === 'grappa' || k.boostKind === 'zuica')) sipAt = m.t;
      lastBoost = boostT;
      to('sip', pose === 'sip' || m.t - sipAt < 0.8 ? 1 : 0, 11, dt);
      to('pan', pose === 'big' || k.bigT > 0 ? 1 : 0, 9, dt);
    } else if (pose) {
      // a still picture: a tool asks for a pose with no time passing
      m.steer = m.lean = steer; m.drift = driftWant; m.cheer = cheer; m.sad = sad; m.hit = hit; m.boost = pose === 'boost' ? 1 : 0; m.air = pose === 'air' ? 1 : 0; m.tipsy = pose === 'tipsy' ? 1 : 0; m.stink = pose === 'stink' ? 1 : 0;
      m.soot = pose === 'soot' ? 1 : 0; m.lick = pose === 'lick' ? 1 : 0; m.sip = pose === 'sip' ? 1 : 0; m.pan = pose === 'big' ? 1 : 0;
    }
    m.fwd = sFwd.x; m.lat = sLat.x; m.vert = sVert.x;
    lastSpeed = speed; lastVy = vy; lastYaw = k.yaw || 0;
    return m;
  };
  return m;
}

// Builds one kart: bones and painted parts in model space, then one skinned mesh.
export function createRig(ctx) {
  const { THREE, mat, shapes } = ctx, { paint, place, merge } = shapes, x = extras(ctx);
  const group = new THREE.Group(), bones = new Map(), list = [], parts = [], wheels = [];
  const root = new THREE.Bone();
  root.userData.at = [0, 0, 0];
  bones.set('root', root); list.push(root);
  const boneOf = (b) => (typeof b === 'string' ? bones.get(b) : b);
  function bone(name, parent = 'body', at = [0, 0, 0]) {
    const p = boneOf(parent), b = new THREE.Bone(), a = p.userData.at;
    b.name = name;
    b.position.set(at[0] - a[0], at[1] - a[1], at[2] - a[2]);
    b.userData.at = at;
    b.userData.rest = b.position.clone();
    p.add(b);
    bones.set(name, b); list.push(b);
    return b;
  }
  bone('body', 'root', [0, 0.5, 0]);
  // part(boneName, geometry, colour, placement, shade): geometry goes in model space. A geometry with its own colours passes colour null.
  function part(b, g, color, where, shade) {
    if (where) place(g, where);
    if (color) paint(g, color, 0, shade || null);
    parts.push({ g, bone: list.indexOf(boneOf(b)) });
    return g;
  }
  // A gradient bake: darker towards y0, plain from y1 up. Contact shade, soft, in the vertex.
  const grad = (y0, y1, low = 0.62) => (_x, y) => lerp(low, 1, clamp((y - y0) / (y1 - y0), 0, 1));

  function wheel(name, at, { front = false, geo, parent = 'root' }) {
    const b = bone(name, parent, at);
    b.rotation.order = 'YXZ';
    b.userData.front = front;
    geo.translate(at[0], at[1], at[2]);
    parts.push({ g: geo, bone: list.indexOf(b) });
    wheels.push(b);
    return b;
  }

  // Everything any kart can show from the sim, in the same mesh: mici in orbit and the POF of a bad moment.
  function addCommon() {
    const { capsule } = shapes;
    for (let i = 0; i < 3; i++) {
      const b = bone(`orbit${i}`, 'root', [0, 0.95, 0]);
      part(b, capsule(0.16, 0.5, 1, 6), '#a0522d', { p: [0, 0.95, 0], r: [HALF_PI, 0, 0] });
      hide(b);
    }
  }

  // A bone must be at rest when the skeleton binds, so what starts hidden hides afterwards.
  const hidden = new Set();
  const hide = (b) => { hidden.add(boneOf(b)); return b; };

  function finish({ driver = null, update = null, tuck = null } = {}) {
    addCommon();
    tuck?.();
    const geo = merge(parts.map((p) => p.g));
    const n = geo.attributes.position.count, SI = new Uint16Array(n * 4), SW = new Float32Array(n * 4);
    let v = 0;
    for (const p of parts) {
      const c = p.g.attributes.position.count;
      for (let i = 0; i < c; i++) { SI[(v + i) * 4] = p.bone; SW[(v + i) * 4] = 1; }
      v += c;
    }
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(SI, 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(SW, 4));
    const mesh = new THREE.SkinnedMesh(geo, mat('#ffffff', SHINY));
    mesh.add(root);
    mesh.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(list));
    for (const b of hidden) b.scale.setScalar(0.001);
    // a fixed sphere big enough for the sausages in orbit: skinned bounds are costly to compute and never needed
    mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 3.6);
    mesh.frustumCulled = true;
    group.add(mesh);
    const m = createSense();
    const tris = geo.index.count / 3;
    const orbit = [0, 1, 2].map((i) => bones.get(`orbit${i}`)), orbitS = orbit.map(() => 0);
    return {
      group, wheels, body: mesh, driver, tris, bones, sense: m,
      update(k, dt) {
        m.sense(k, dt);
        // suspension: the body floats on the wheels, so landings and bumps travel through it
        const B = bones.get('body'), rest = B.userData.rest;
        B.position.y = rest.y + clamp(-m.vert * 0.12, -0.12, 0.16) + Math.sin(m.dist * 2.1 + m.seed) * 0.008 * m.sn;
        B.rotation.z = clamp(m.lat * 0.05 + m.lean * m.sn * 0.03, -0.14, 0.14);
        B.rotation.x = clamp(-m.fwd * 0.05, -0.1, 0.08);
        driver?.pose(m, k);
        update?.(m, k, dt);
        const on = k.orbit || 0;
        orbit.forEach((b, i) => {
          orbitS[i] = lerp(orbitS[i], on > i ? 1 : 0.001, dt > 0 ? follow(14, dt) : 1);
          const a = m.t * 2.6 + (i / 3) * Math.PI * 2;
          b.position.set(Math.sin(a) * 1.85, 0.95 + Math.sin(m.t * 3 + i * 2) * 0.1, Math.cos(a) * 1.85);
          b.rotation.y = a + HALF_PI;
          b.scale.setScalar(orbitS[i]);
        });
      },
      dispose() { geo.dispose(); mesh.skeleton.dispose(); },
    };
  }
  return { THREE, shapes, x, mat, group, bone, part, wheel, grad, finish, hide, bones, wheels, parts, list, get: boneOf };
}

// Wiggles for the things that hang off a kart: a flag, hay, a tassel. Each returns the angle to use this frame.
export const swing = (m, freq = 9, amp = 0.2, seed = 0) => Math.sin(m.t * freq + seed + m.seed) * amp * (0.25 + m.sn * 0.75);
