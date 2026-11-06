// Rounded boulders beside the road and along the river. One noise shaped geometry, instanced, static, in the toon material.
import * as THREE from 'three';
import { hash3, vnoise, linear } from './math.js';

export function boulderGeometry(seed = 3, detail = 2) {
  const g = new THREE.IcosahedronGeometry(1, detail), p = g.attributes.position, v = new THREE.Vector3();
  // icosahedrons come unindexed: weld them so the normals are smooth
  const map = new Map(), pos = [], idx = [];
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const key = `${v.x.toFixed(4)},${v.y.toFixed(4)},${v.z.toFixed(4)}`;
    let q = map.get(key);
    if (q === undefined) {
      q = pos.length / 3; map.set(key, q);
      const k = 1 + 0.2 * vnoise(v.x * 1.6 + seed, v.z * 1.6, 11) + 0.1 * vnoise(v.y * 3 + seed, v.x * 3, 12);
      pos.push(v.x * k, (v.y > 0 ? v.y * 0.72 : v.y * 0.45) * k, v.z * k);
    }
    idx.push(q);
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  m.setIndex(idx);
  m.computeVertexNormals();
  return m;
}

// A fractured angular rock: few big flat faces, for ground that breaks into shards. Lit flat, each face with its own tone.
export function shardGeometry(seed = 3, tone = null) {
  const src = new THREE.IcosahedronGeometry(1, 0), p = src.attributes.position, map = new Map();
  const at = (i) => {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
    let q = map.get(k);
    if (!q) {
      const n = map.size, r = 0.68 + 0.62 * hash3(n, seed, 41);
      q = [x * r * (0.9 + 0.5 * hash3(n, seed, 42)), Math.max(y * r * 0.74, -0.32), z * r * (0.8 + 0.5 * hash3(n, seed, 43))];
      map.set(k, q);
    }
    return q;
  };
  const pos = [], nor = [], col = [], a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    const A = at(i), B = at(i + 1), C = at(i + 2);
    a.fromArray(A); b.fromArray(B); c.fromArray(C);
    n.copy(b).sub(a).cross(c.clone().sub(a)).normalize();
    const t = (0.78 + 0.44 * hash3(i, seed, 44)) * (tone ?? 1);
    pos.push(...A, ...B, ...C);
    for (let k = 0; k < 3; k++) { nor.push(n.x, n.y, n.z); col.push(t, t, t); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

// Stones scattered along the road's edges and the river, in little groups.
export function placeRocks(track, world, look) {
  const { terrain, ground } = world, S = track.samples, out = [], want = (look.rocks.count ?? 90) * (track.long ? track.length / 2000 : 1), n = track.n, every = Math.max(4, Math.floor(n / want));
  for (let i = 0; i < n; i += every) {
    if (hash3(i, 2, 7) < 0.4 || track.structureAt(i)) continue;
    const side = hash3(i, 3, 7) < 0.5 ? -1 : 1, d = S.w[i] / 2 + 6 + 10 * hash3(i, 4, 7), x = S.x[i] + S.nx[i] * d * side, z = S.z[i] + S.nz[i] * d * side;
    if (terrain.roadDistAt(x, z) < 5) continue;
    // not against a building: a boulder beside a barn reads as floating
    if ((world.keepOut || []).some((c) => (x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + 6) ** 2)) continue;
    const cluster = 1 + Math.floor(hash3(i, 7, 7) * 3);
    for (let c = 0; c < cluster; c++) {
      const ox = x + (hash3(i, c, 8) - 0.5) * 5, oz = z + (hash3(i, c, 9) - 0.5) * 5;
      out.push({ x: ox, y: ground.groundAt(ox, oz), z: oz, r: (0.5 + 1.5 * hash3(i, c, 10) ** 2) * (look.rocks.scale ?? 1) }); // look.rocks.scale, default 1
    }
  }
  const R = terrain.river;
  if (R) {
    for (let i = 8; i < R.xs.length - 1; i += 11) {
      if (hash3(i, 1, 13) < 0.55) continue;
      const tx = R.xs[i + 1] - R.xs[i], tz = R.zs[i + 1] - R.zs[i], l = Math.hypot(tx, tz) || 1, s = (hash3(i, 2, 13) < 0.5 ? -1 : 1) * R.w * (0.1 + 0.5 * hash3(i, 3, 13));
      const x = R.xs[i] + (-tz / l) * s, z = R.zs[i] + (tx / l) * s;
      if (terrain.roadDistAt(x, z) < 3) continue;
      out.push({ x, y: Math.max(ground.groundAt(x, z), (terrain.water ?? -1e9) - 0.4), z, r: 0.5 + 1.3 * hash3(i, 4, 13) });
    }
  }
  return out;
}

export function rockMesh(list, material, look) {
  // look.rocks.angular: fractured rock in place of the rounded boulders, default rounded
  const mesh = new THREE.InstancedMesh(look.rocks.angular ? shardGeometry(5) : boulderGeometry(3, 2), material, Math.max(list.length, 1));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color(), base = linear(look.rocks.color);
  list.forEach((r, i) => {
    e.set((hash3(i, 1, 9) - 0.5) * 0.3, hash3(i, 2, 9) * 6.28, (hash3(i, 3, 9) - 0.5) * 0.3);
    q.setFromEuler(e);
    const k = r.r * (0.9 + 0.2 * hash3(i, 4, 9));
    m4.compose(p.set(r.x, r.y - 0.28 * k, r.z), q, s.set(k * (1 + 0.3 * hash3(i, 5, 9)), k, k));
    mesh.setMatrixAt(i, m4);
    const t = 0.82 + 0.3 * hash3(i, 6, 9);
    mesh.setColorAt(i, c.setRGB(base[0] * t, base[1] * t, base[2] * t));
  });
  mesh.count = list.length;
  mesh.computeBoundingSphere();
  mesh.frustumCulled = false;
  return mesh;
}
