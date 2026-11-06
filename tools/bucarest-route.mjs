#!/usr/bin/env node
// tools/bucarest-route.mjs: the route of the bucarest track on the real streets. Reads the OpenStreetMap ways saved in data/raw/osm-bucarest/all.json
// (Overpass: every highway in 44.422,26.075,44.478,26.115), finds the shortest path through hand picked waypoints, one per real street, and prints metres in the track's
// frame (x east, z south, origin at CENTER) with the street names and the DEM height, for the POINTS of src/world/tracks/bucarest.js.
import { readFileSync, writeFileSync } from 'node:fs';
import { loadDem, ensureTiles, tilesForBox } from './dem.mjs';
export const CENTER = [44.447, 26.0925];
const K = Math.cos(CENTER[0] * Math.PI / 180) * 111320, L = 110950;
export const toXZ = (lat, lon) => [(lon - CENTER[1]) * K, -(lat - CENTER[0]) * L];
const WP = JSON.parse(readFileSync(new URL('./bucarest-route.json', import.meta.url)));
const d = JSON.parse(readFileSync(new URL('../data/raw/osm-bucarest/all.json', import.meta.url)));
const nodes = new Map(), adj = new Map();
const COST = { footway: 4, path: 3, cycleway: 4, service: 5, residential: 2, living_street: 2, pedestrian: 2, tertiary: 1.2, unclassified: 1.5 };
const nameOf = new Map();
for (const w of d.elements) {
  if (!w.nodes || !w.geometry) continue;
  const c = COST[w.tags.highway] ?? 1, name = w.tags.name || w.tags.highway, covered = w.tags.tunnel || w.tags.covered;
  for (let i = 0; i < w.nodes.length; i++) {
    const g = w.geometry[i]; if (!g) continue;
    nodes.set(w.nodes[i], [g.lat, g.lon]); if (!nameOf.has(w.nodes[i])) nameOf.set(w.nodes[i], new Set()); nameOf.get(w.nodes[i]).add(name);
    if (i && !covered && w.geometry[i - 1]) {
      const a = w.nodes[i - 1], b = w.nodes[i], [ax, az] = toXZ(w.geometry[i - 1].lat, w.geometry[i - 1].lon), [bx, bz] = toXZ(g.lat, g.lon), l = Math.hypot(ax - bx, az - bz);
      if (!adj.has(a)) adj.set(a, []); if (!adj.has(b)) adj.set(b, []);
      adj.get(a).push([b, l * c, name]); adj.get(b).push([a, l * c, name]);
    }
  }
}
const nearest = (lat, lon, road) => { let best = null, bd = 1e12; const [x, z] = toXZ(lat, lon); for (const [id] of adj) { if (road && ![...nameOf.get(id)].some((n) => n.includes(road))) continue; const [a, b] = nodes.get(id), [p, q] = toXZ(a, b), v = (p - x) ** 2 + (q - z) ** 2; if (v < bd) { bd = v; best = id; } } return best; };
function path(a, b) {
  const dist = new Map([[a, 0]]), prev = new Map(), open = new Set([a]);
  while (open.size) {
    let u = null, ud = 1e18; for (const q of open) { const v = dist.get(q); if (v < ud) { ud = v; u = q; } }
    open.delete(u); if (u === b) break;
    for (const [v, l, n] of adj.get(u) || []) { const nd = ud + l; if (nd < (dist.get(v) ?? 1e18)) { dist.set(v, nd); prev.set(v, [u, n]); open.add(v); } }
  }
  const out = []; let u = b; while (u !== a) { const [p, n] = prev.get(u); out.unshift([u, n]); u = p; }
  return out;
}
const route = []; const legs = [];
const ringPts = (r) => { const [cx, cz] = r.ring; return r.th.map((t) => [cx + r.r * Math.sin(t * Math.PI / 180), cz - r.r * Math.cos(t * Math.PI / 180)]); };
const xzOf = (id) => toXZ(...nodes.get(id));
let cursor = null;
for (let i = 0; i < WP.length; i++) {
  const W = WP[i], nx = WP[(i + 1) % WP.length];
  const start = route.length;
  if (W.direct) {
    const here = W.xz || (W.road ? xzOf(nearest(W.at[0], W.at[1], W.road)) : toXZ(W.at[0], W.at[1]));
    route.push({ xz: here, mark: W.mark, w: W.w, surface: W.surface, tag: W.tag });
    for (const q of W.direct) for (const p of q.ring ? ringPts(q) : [q.xz || toXZ(q.ll[0], q.ll[1])]) route.push({ xz: p, w: W.w, surface: W.surface, tag: W.tag });
    const last = route[route.length - 1].xz;
    cursor = null; let bd = 1e12; for (const [id] of adj) { const [p, q] = xzOf(id), v = (p - last[0]) ** 2 + (q - last[1]) ** 2; if (v < bd) { bd = v; cursor = id; } }
  } else {
    const A = W.road ? nearest(W.at[0], W.at[1], W.road) : cursor ?? nearest(W.at[0], W.at[1]);
    route.push({ xz: xzOf(A), mark: W.mark, w: W.w, surface: W.surface, tag: W.tag });
  }
  if (nx.direct && !nx.road) { cursor = null; continue; } // straight on to a hand drawn stretch
  const from = W.direct ? cursor : (W.road ? nearest(W.at[0], W.at[1], W.road) : cursor), to = nearest(nx.at[0], nx.at[1], nx.road);
  let len = 0, names = new Map(), last = from;
  for (const [id, n] of path(from, to)) { const [x0, z0] = xzOf(last), [x1, z1] = xzOf(id), l = Math.hypot(x1 - x0, z1 - z0); len += l; names.set(n, (names.get(n) || 0) + l); last = id; if (id !== to) route.push({ xz: xzOf(id), w: W.w, surface: W.surface, tag: W.tag }); }
  legs.push(`${W.mark}: ${len.toFixed(0)} m ${[...names].map(([n, l]) => `${n} ${l.toFixed(0)}`).join(', ')}`);
}
console.error(legs.join('\n'));
// even steps, then a running mean so that a junction's kink is a corner a kart can take, then points every 40 to 120 m of the track
const MAP = 0.56, STEP = 12, WIN = +(process.env.WIN || 2);
const dense = [];
for (let i = 0; i < route.length; i++) {
  const a = route[i], b = route[(i + 1) % route.length], l = Math.hypot(b.xz[0] - a.xz[0], b.xz[1] - a.xz[1]), n = Math.max(1, Math.round(l / STEP));
  for (let k = 0; k < n; k++) dense.push({ x: a.xz[0] + (b.xz[0] - a.xz[0]) * k / n, z: a.xz[1] + (b.xz[1] - a.xz[1]) * k / n, w: a.w, surface: a.surface, tag: a.tag, mark: k === 0 ? a.mark : null });
}
const N = dense.length, smooth = (v, win) => { const o = new Float64Array(N); for (let i = 0; i < N; i++) { let s = 0; for (let k = -win; k <= win; k++) s += v[(i + k + N) % N]; o[i] = s / (2 * win + 1); } return o; };
let xs = Float64Array.from(dense.map((d) => d.x)), zs = Float64Array.from(dense.map((d) => d.z));
for (let pass = 0; pass < 2; pass++) { xs = smooth(xs, WIN); zs = smooth(zs, WIN); }
// Calea Victoriei winds, and a street squeezed to 0.56 keeps its angles but loses its feel: its bends are drawn out by their own departure from the street's mean line, the true shape and no other
{
  const ia = dense.findIndex((d) => d.mark === 'victoriei'), ib = dense.findIndex((d) => d.mark === 'vest');
  const mx = smooth(smooth(xs, 14), 14), mz = smooth(smooth(zs, 14), 14), K2 = +(process.env.WIND || 0);
  for (let i = ia; i < ib; i++) { const t = Math.min(1, (i - ia) / 12, (ib - i) / 12); xs[i] += K2 * t * (xs[i] - mx[i]); zs[i] += K2 * t * (zs[i] - mz[i]); }
}
// the heights: the DEM holds the roofs and the crowns, so the floor of a 400 m window, then smoothed hard. A flat city with three real features: the Dealul Spirii, the Dambovita's valley, the low ground by the lake
await ensureTiles(tilesForBox([44.4, 26.05, 44.5, 26.15]));
const dem = await loadDem('data/raw/dem', { only: (f) => f.includes('N44_00_E026') });
const hs = new Float64Array(N); for (let i = 0; i < N; i++) { const lat = CENTER[0] - dense[i].z / L, lon = CENTER[1] + dense[i].x / K; hs[i] = dem.elevation(lon, lat); }
const floor = new Float64Array(N); const W2 = 16; for (let i = 0; i < N; i++) { const a = []; for (let k = -W2; k <= W2; k++) a.push(hs[(i + k + N) % N]); a.sort((p, q) => p - q); floor[i] = a[Math.floor(a.length * 0.15)]; }
const ys = smooth(smooth(floor, 12), 12);
const y0 = Math.min(...ys);
// the turn at every step, so that points are kept thick where the road bends
const out = []; let lastKept = -999, acc = 0;
for (let i = 0; i < N; i++) {
  const a = Math.atan2(xs[i] - xs[(i - 1 + N) % N], zs[i] - zs[(i - 1 + N) % N]), b = Math.atan2(xs[(i + 1) % N] - xs[i], zs[(i + 1) % N] - zs[i]);
  let t = Math.abs(b - a); if (t > Math.PI) t = 2 * Math.PI - t; acc += t;
  const gap = i - lastKept, mark = dense[i].mark;
  if (mark || (gap * STEP * MAP >= 26 && acc > 0.1) || gap * STEP * MAP >= 96) { out.push({ x: +(xs[i]).toFixed(1), z: +(zs[i]).toFixed(1), y: +(ys[i] - y0).toFixed(1), w: dense[i].w, ...(dense[i].surface ? { surface: dense[i].surface } : {}), ...(mark ? { mark } : {}) }); lastKept = i; acc = 0; }
}
const len = out.reduce((s, p, i) => s + Math.hypot(p.x - out[(i + 1) % out.length].x, p.z - out[(i + 1) % out.length].z), 0);
console.error(`points ${out.length}, real length ${(len / 1000).toFixed(2)} km, at ${MAP}: ${(len * MAP / 1000).toFixed(2)} km, y 0..${Math.max(...out.map((p) => p.y))}, y0 ${y0.toFixed(1)}`);
writeFileSync(process.argv[2] || '/dev/stdout', `// generated by tools/bucarest-route.mjs from OpenStreetMap ways and the Copernicus DEM: metres at full scale, x east, z south, origin at 44.447, 26.0925, y over the lowest point\nexport const ROUTE = ${JSON.stringify(out)};\n`);
