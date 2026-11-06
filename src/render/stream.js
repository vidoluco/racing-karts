// The world of a long track (def.long), by distance from each view. Every chunk of ground, road and scenery is an item with a
// near mesh and maybe a cheap far one; each view keeps its own list of what to draw and refreshes it when its camera has moved,
// so the cost of a frame depends on what is around the camera and never on the length of the lap. Near geometry that no view is
// close to gives its GPU buffers back and uploads again on its next showing. Short tracks never come here.
import * as THREE from 'three';

const MOVE = 10;        // m a camera moves before its list is looked at again
const HYST = 45;        // m past a limit before something changes back, so a camera on the line does not flicker it
const SWEEP = 90;       // frames between looks for buffers to give back

export const LONG_DEFAULTS = {
  groundNear: 300,      // m from a 1 km ground cell where its fine chunks take over from its coarse mesh
  roadNear: 300,        // the same, for a 512 m stretch of road
  statics: 1100,        // m at which a cell of buildings and props stops being drawn; batch.add(g, { far: true }) stays to the horizon
  detail: 500,          // m at which a cell swaps to its `low` geometry, if it has any
  water: 2600,
  release: 1100,        // m past which near geometry gives its GPU buffers back
};

const bytesOf = (g) => {
  let b = g.index ? g.index.array.byteLength : 0;
  for (const k in g.attributes) b += g.attributes[k].array.byteLength;
  return b;
};

export function createStream({ ground, road, statics, extra = [], water = null, look, def, cameraFar }) {
  const O = { ...LONG_DEFAULTS, ...(typeof def.long === 'object' ? def.long : null) };
  // past where the mist has eaten everything nothing need be drawn
  const horizon = look.mist && look.mist.amount >= 0.995 ? look.mist.to + 100 : cameraFar;
  const items = [];
  const add = (near, far, box, nearTo, farTo) => {
    const it = { near, far, ax: box.min.x, az: box.min.z, bx: box.max.x, bz: box.max.z, nearTo, farTo, warm: true };
    for (const m of near) m.visible = false;
    if (far) far.visible = false;
    items.push(it);
    return it;
  };
  const boxOf = (list) => {
    const b = new THREE.Box3();
    for (const m of list) { if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); b.union(m.geometry.boundingBox); }
    return b;
  };
  for (const c of ground.cells) add(c.near, c.far, boxOf([c.far]), O.groundNear, horizon);
  for (const g of road.groups) add(g.near, g.far, boxOf([g.far, ...g.near]), O.roadNear, horizon);
  for (const e of statics) {
    if (e.low) add([e.mesh], e.low, boxOf([e.mesh]), O.detail, e.far ? horizon : O.statics);
    else add([e.mesh], null, boxOf([e.mesh]), e.far ? horizon : O.statics, 0);
  }
  for (const m of extra) add([m], null, boxOf([m]), O.statics, 0);
  if (water) for (const m of water.children) add([m], null, boxOf([m]), O.water, 0);
  // m from a point to an item's box on the map
  const away = (it, x, z) => Math.hypot(Math.max(it.ax - x, 0, x - it.bx), Math.max(it.az - z, 0, z - it.bz));

  const views = new Set();
  let active = [], frame = 0, swaps = 0, near = 0, far = 0;
  const totals = { bytes: 0 };

  function createView() {
    const v = { state: new Uint8Array(items.length), list: [], x: 1e9, z: 1e9 };
    views.add(v);
    return v;
  }
  function dropView(v) { views.delete(v); if (active === v.list) { for (const m of active) m.visible = false; active = []; } }

  // state: 0 nothing, 1 near, 2 far
  function refresh(v, x, z) {
    const dx = x - v.x, dz = z - v.z;
    if (dx * dx + dz * dz < MOVE * MOVE) return false;
    v.x = x; v.z = z;
    const L = v.list;
    let changed = false;
    if (active === L) { for (const m of L) m.visible = false; active = []; } // what leaves the list must not stay shown
    L.length = 0;
    for (let i = 0; i < items.length; i++) {
      const it = items[i], was = v.state[i], d = away(it, x, z);
      const slackN = was === 1 ? HYST : 0, slackF = was === 2 ? HYST : 0;
      const now = d < it.nearTo + slackN ? 1 : it.far && d < it.farTo + slackF ? 2 : 0;
      if (now !== was) { v.state[i] = now; swaps++; changed = true; }
      if (now === 1) { for (const m of it.near) L.push(m); it.warm = true; } else if (now === 2) L.push(it.far);
    }
    return changed;
  }

  function show(v) {
    for (const m of active) m.visible = false;
    for (const m of v.list) m.visible = true;
    active = v.list;
  }

  // Buffers of near geometry no view is close to go back to the GPU; three uploads them again at their next draw.
  function sweep() {
    if (++frame % SWEEP) return;
    let bytes = 0;
    near = 0; far = 0;
    for (const it of items) {
      let keep = false;
      for (const v of views) if (away(it, v.x, v.z) < O.release) { keep = true; break; }
      if (!keep && it.warm && views.size) { it.warm = false; for (const m of it.near) m.geometry.dispose(); }
      if (it.warm) { near++; for (const m of it.near) bytes += bytesOf(m.geometry); }
      if (it.far) { far++; bytes += bytesOf(it.far.geometry); }
    }
    totals.bytes = bytes;
  }

  // Everything at its cheapest, for the bird's eye bake of the overview.
  function showAll(on) {
    for (const m of active) m.visible = false;
    active = [];
    for (const it of items) {
      if (it.far) it.far.visible = on;
      else if (it.farTo === 0 && it.nearTo >= O.statics) for (const m of it.near) m.visible = on;
    }
    for (const v of views) { v.x = 1e9; v.z = 1e9; }
  }

  return {
    items, options: O, createView, dropView, refresh, show, sweep, showAll,
    stats: () => ({ items: items.length, warmNear: near, far, swaps, gpuBytes: totals.bytes }),
    dispose() { views.clear(); active = []; },
  };
}

// Rocks of a long track: the world's list stays in plain arrays, each view instances only those around its camera.
export function createRockIndex(master, cell = 128) {
  const A = master.instanceMatrix.array, C = master.instanceColor?.array, n = master.count, map = new Map();
  for (let i = 0; i < n; i++) {
    const k = Math.floor(A[i * 16 + 12] / cell) * 65536 + Math.floor(A[i * 16 + 14] / cell);
    let l = map.get(k);
    if (!l) map.set(k, (l = []));
    l.push(i);
  }
  return { A, C, map, cell, geometry: master.geometry, material: master.material };
}

export function createRockView(index, { radius = 460, cap = 220 } = {}) {
  const { A, C, map, cell, geometry, material } = index;
  const mesh = new THREE.InstancedMesh(geometry, material, cap);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false; mesh.count = 0; mesh.visible = false;
  const R = Math.ceil(radius / cell);
  return {
    mesh,
    gather(x, z) {
      const ci = Math.floor(x / cell), cj = Math.floor(z / cell), M = mesh.instanceMatrix.array, K = mesh.instanceColor.array, r2 = radius * radius;
      let n = 0;
      for (let b = -R; b <= R && n < cap; b++) for (let a = -R; a <= R && n < cap; a++) {
        const l = map.get((ci + a) * 65536 + cj + b);
        if (!l) continue;
        for (let q = 0; q < l.length && n < cap; q++) {
          const i = l[q], dx = A[i * 16 + 12] - x, dz = A[i * 16 + 14] - z;
          if (dx * dx + dz * dz > r2) continue;
          for (let e = 0; e < 16; e++) M[n * 16 + e] = A[i * 16 + e];
          if (C) { K[n * 3] = C[i * 3]; K[n * 3 + 1] = C[i * 3 + 1]; K[n * 3 + 2] = C[i * 3 + 2]; }
          n++;
        }
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
    },
    show(on) { mesh.visible = on && mesh.count > 0; },
    dispose() { mesh.dispose(); },
  };
}
