// What a kart cannot drive through: the buildings and big structures by the road, as oriented boxes with a height range.
// Baked from the landmark modules by tools/bake-solids.mjs into src/world/solids/<id>.js, so the sim never touches the renderer.
// A uniform grid, so that a kart looks at the few boxes of its own cell and a track of three thousand costs what a track of thirty does.
import { SOLID } from './tuning.js';

const CELL = 16;
const cache = new WeakMap();

// track.def.solids rows: [x, z, half u, half v, yaw of u, y from, y to]
export function solidsFor(track) {
  const rows = track.def?.solids;
  if (!rows?.length) return null;
  let S = cache.get(track);
  if (S) return S;
  const n = rows.length, x = new Float64Array(n), z = new Float64Array(n), hu = new Float32Array(n), hv = new Float32Array(n), ux = new Float64Array(n), uz = new Float64Array(n), y0 = new Float32Array(n), y1 = new Float32Array(n), reach = new Float32Array(n);
  let ax = Infinity, az = Infinity, bx = -Infinity, bz = -Infinity;
  rows.forEach((r, i) => {
    x[i] = r[0]; z[i] = r[1]; hu[i] = r[2]; hv[i] = r[3]; ux[i] = Math.cos(r[4]); uz[i] = Math.sin(r[4]); y0[i] = r[5]; y1[i] = r[6];
    reach[i] = Math.hypot(r[2], r[3]) + SOLID.margin;
    ax = Math.min(ax, r[0] - reach[i]); bx = Math.max(bx, r[0] + reach[i]); az = Math.min(az, r[1] - reach[i]); bz = Math.max(bz, r[1] + reach[i]);
  });
  const cols = Math.floor((bx - ax) / CELL) + 1, lines = Math.floor((bz - az) / CELL) + 1, count = new Int32Array(cols * lines + 1);
  const each = (i, fn) => {
    const m = SOLID.margin, eu = Math.abs(ux[i]) * (hu[i] + m) + Math.abs(uz[i]) * (hv[i] + m), ev = Math.abs(uz[i]) * (hu[i] + m) + Math.abs(ux[i]) * (hv[i] + m);
    const c0 = Math.floor((x[i] - eu - ax) / CELL), c1 = Math.floor((x[i] + eu - ax) / CELL), l0 = Math.floor((z[i] - ev - az) / CELL), l1 = Math.floor((z[i] + ev - az) / CELL);
    for (let l = l0; l <= l1; l++) for (let c = c0; c <= c1; c++) fn(l * cols + c);
  };
  for (let i = 0; i < n; i++) each(i, (c) => { count[c + 1]++; });
  for (let c = 0; c < cols * lines; c++) count[c + 1] += count[c];
  const fill = count.slice(), ids = new Int32Array(count[cols * lines]);
  for (let i = 0; i < n; i++) each(i, (c) => { ids[fill[c]++] = i; });
  S = { n, x, z, hu, hv, ux, uz, y0, y1, ax, az, cols, lines, start: count, ids, hit: { nx: 0, nz: 0, pen: 0, box: -1 } };
  cache.set(track, S);
  return S;
}

// Is a kart at (x, y, z) inside a box grown by its margin? Fills and returns S.hit with the way out, or null. It came from (px, pz): the face it
// crossed is the one it leaves by, so that nothing fast ever comes out of the far side.
export function solidPush(S, x, y, z, px = x, pz = z, grow = SOLID.margin) {
  const c = Math.floor((x - S.ax) / CELL), l = Math.floor((z - S.az) / CELL);
  if (c < 0 || l < 0 || c >= S.cols || l >= S.lines) return null;
  const cell = l * S.cols + c, { ids, start } = S;
  for (let q = start[cell]; q < start[cell + 1]; q++) {
    const i = ids[q];
    if (y < S.y0[i] || y > S.y1[i]) continue;
    const dx = x - S.x[i], dz = z - S.z[i], ux = S.ux[i], uz = S.uz[i], u = dx * ux + dz * uz, v = -dx * uz + dz * ux, au = S.hu[i] + grow, av = S.hv[i] + grow;
    if (u <= -au || u >= au || v <= -av || v >= av) continue;
    const qx = px - S.x[i], qz = pz - S.z[i], pu = qx * ux + qz * uz, pv = -qx * uz + qz * ux;
    const outU = Math.abs(pu) >= au, outV = Math.abs(pv) >= av, penU = au - Math.abs(u), penV = av - Math.abs(v);
    // both outside, across a corner: the axis it was less far past; neither, it was inside already: the nearest face
    const byU = outU && !outV ? true : outV && !outU ? false : outU && outV ? Math.abs(pu) - au > Math.abs(pv) - av : penU < penV;
    const hit = S.hit;
    if (byU) { const s = (outU ? pu : u) >= 0 ? 1 : -1; hit.nx = ux * s; hit.nz = uz * s; hit.pen = s > 0 ? au - u : au + u; }
    else { const s = (outV ? pv : v) >= 0 ? 1 : -1; hit.nx = -uz * s; hit.nz = ux * s; hit.pen = s > 0 ? av - v : av + v; }
    hit.box = i;
    return hit;
  }
  return null;
}
