// The map of a long track: the whole route is painted once to a large offscreen canvas, and each view shows the piece around
// its kart, the road ahead pointing up, closer in slow corners and further out at speed. Under it a strip with the whole lap:
// where everybody is, and how far to the flag. Nothing here walks the samples after the first paint.
import { formaMark } from './forma.js';

const INK = '#1d1f2b';
const VIEW_M = 400;      // m from the kart to the map's edge at middling speed
const PAINT_PX_M = 0.42; // the offscreen route's pixels per metre, at a 250 px map: scaled with the map

const angleTo = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

export function createLongMap(track, canvas, size) {
  const S = track.samples, n = track.n, res = (PAINT_PX_M * size) / 250;
  let ax = 1e9, az = 1e9, bx = -1e9, bz = -1e9;
  for (let i = 0; i < n; i += 4) { ax = Math.min(ax, S.x[i]); bx = Math.max(bx, S.x[i]); az = Math.min(az, S.z[i]); bz = Math.max(bz, S.z[i]); }
  const pad = 60;
  ax -= pad; az -= pad; bx += pad; bz += pad;
  // +z is drawn up and x on the right-hand side, as on the short tracks' map
  const baseX = (x) => (bx - x) * res, baseY = (z) => (bz - z) * res;
  const base = document.createElement('canvas');
  base.width = Math.ceil((bx - ax) * res); base.height = Math.ceil((bz - az) * res);
  const b = base.getContext('2d');
  b.lineCap = 'round'; b.lineJoin = 'round';
  const trace = (list) => {
    b.beginPath();
    list.forEach((k, q) => { if (q === 0) b.moveTo(baseX(S.x[k]), baseY(S.z[k])); else b.lineTo(baseX(S.x[k]), baseY(S.z[k])); });
  };
  const all = [];
  for (let i = 0; i <= n; i += 3) all.push(i % n);
  const line = size * 0.068;
  trace(all); b.lineWidth = line * 1.64; b.strokeStyle = INK; b.stroke();
  trace(all); b.lineWidth = line; b.strokeStyle = '#fff6e6'; b.stroke();
  // a deck passes over: the road under it is seen to go on beneath, its own ink redrawn on top
  const decks = (track.structures || []).filter((st) => st.kind === 'bridge' || st.kind === 'viaduct');
  for (const st of decks) {
    const part = [], len = ((st.i1 - st.i0) % n + n) % n;
    for (let o = 0; o <= len; o += 2) part.push((st.i0 + o) % n);
    trace(part); b.lineWidth = line * 1.64; b.lineCap = 'butt'; b.strokeStyle = INK; b.stroke();
    trace(part); b.lineWidth = line; b.strokeStyle = '#fff6e6'; b.stroke();
    b.lineCap = 'round';
  }
  for (const sc of track.shortcuts || []) {
    const T = sc.samples;
    b.beginPath();
    for (let i = 0; i < sc.n; i += 3) { if (i === 0) b.moveTo(baseX(T.x[i]), baseY(T.z[i])); else b.lineTo(baseX(T.x[i]), baseY(T.z[i])); }
    b.setLineDash([line * 0.7, line * 0.7]); b.lineWidth = line * 0.5; b.strokeStyle = INK; b.stroke(); b.setLineDash([]);
  }
  for (const bd of track.bands || []) {
    const k = bd.i ?? Math.round(bd.u * n);
    b.beginPath(); b.arc(baseX(S.x[k]), baseY(S.z[k]), line * 0.36, 0, 7); b.fillStyle = '#e8a924'; b.fill();
  }
  { // the line
    const lx = S.nx[0] * 15, lz = S.nz[0] * 15;
    b.beginPath(); b.moveTo(baseX(S.x[0] + lx), baseY(S.z[0] + lz)); b.lineTo(baseX(S.x[0] - lx), baseY(S.z[0] - lz));
    b.lineWidth = line * 0.7; b.lineCap = 'butt'; b.strokeStyle = INK; b.stroke();
    b.setLineDash([line * 0.34, line * 0.34]); b.lineWidth = line * 0.42; b.strokeStyle = '#fff'; b.stroke(); b.setLineDash([]);
  }

  canvas.width = size; canvas.height = size;
  const g = canvas.getContext('2d');
  const stripH = size * 0.13, cx = size / 2, cy = (size - stripH) * 0.62, barY = size - stripH * 0.52, barA = size * 0.1, barB = size * 0.9;
  let heading = null, zoom = size / (VIEW_M * 2);
  return {
    draw(state, me, colors) {
      const K = state.karts, m = K[me];
      g.clearRect(0, 0, size, size);
      if (!m) return;
      // the way it is going, not where its nose points in a spin; slow enough that a drift does not swing the map
      const sp = Math.hypot(m.vx || 0, m.vz || 0), want = sp > 4 ? Math.atan2(m.vx, m.vz) : m.yaw ?? 0;
      heading = heading === null ? want : heading + angleTo(heading, want) * 0.1;
      const target = size / (VIEW_M * 2 * (0.72 + 0.42 * Math.min(1.2, sp / 30)));
      zoom += (target - zoom) * 0.06;
      const c = Math.cos(heading), s = Math.sin(heading);
      const sx = (x, z) => { const px = (m.x - x) * zoom, py = (m.z - z) * zoom; return [cx + c * px - s * py, cy + s * px + c * py]; };

      g.save();
      g.beginPath(); g.rect(0, 0, size, size - stripH); g.clip();
      g.translate(cx, cy); g.rotate(heading); g.scale(zoom / res, zoom / res);
      g.drawImage(base, -baseX(m.x), -baseY(m.z));
      g.restore();
      g.save();
      g.beginPath(); g.rect(0, 0, size, size - stripH); g.clip();
      for (const q of state.shots || []) {
        if (q.kind !== 'razzo') continue;
        const [x, y] = sx(q.x, q.z);
        g.beginPath(); g.arc(x, y, size * 0.02, 0, 7); g.fillStyle = '#e0483d'; g.fill(); g.lineWidth = size * 0.008; g.strokeStyle = INK; g.stroke();
      }
      const dot = (k, r, ring) => {
        const [x, y] = sx(k.x, k.z);
        g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = colors[k.i] || '#fff'; g.fill(); g.lineWidth = ring; g.strokeStyle = INK; g.stroke();
      };
      for (const k of K) if (k.i !== me && !k.human) dot(k, size * 0.024, size * 0.009);
      for (const k of K) if (k.i !== me && k.human) dot(k, size * 0.034, size * 0.011);
      if (state.forma) { const [x, y] = sx(state.forma.wheel.x, state.forma.wheel.z); formaMark(g, x, y, size, state.t); }
      // you: an arrow, always pointing up the map
      g.translate(cx, cy);
      g.beginPath(); g.arc(0, 0, size * 0.066, 0, 7); g.fillStyle = 'rgba(255,255,255,0.75)'; g.fill();
      g.beginPath(); g.moveTo(0, -size * 0.052); g.lineTo(size * 0.038, size * 0.036); g.lineTo(0, size * 0.018); g.lineTo(-size * 0.038, size * 0.036); g.closePath();
      g.fillStyle = colors[me] || '#fff'; g.fill(); g.lineJoin = 'round'; g.lineWidth = size * 0.014; g.strokeStyle = INK; g.stroke();
      g.restore();

      // the whole lap as a strip: left is the start, right the flag
      const u01 = (k) => { const p = k.finished ? 1 : ((k.progress % 1) + 1) % 1; return barA + (barB - barA) * p; };
      g.fillStyle = 'rgba(29, 31, 43, 0.14)'; g.fillRect(0, size - stripH, size, stripH);
      g.lineCap = 'round';
      g.beginPath(); g.moveTo(barA, barY); g.lineTo(barB, barY); g.lineWidth = size * 0.03; g.strokeStyle = INK; g.stroke();
      g.beginPath(); g.moveTo(barA, barY); g.lineTo(barB, barY); g.lineWidth = size * 0.014; g.strokeStyle = '#fff6e6'; g.stroke();
      g.beginPath(); g.moveTo(barA, barY); g.lineTo(u01(m), barY); g.strokeStyle = colors[me] || '#e8a924'; g.lineWidth = size * 0.014; g.stroke();
      for (const k of K) {
        if (k.i === me) continue;
        g.beginPath(); g.arc(u01(k), barY, size * (k.human ? 0.024 : 0.016), 0, 7); g.fillStyle = colors[k.i] || '#fff'; g.fill(); g.lineWidth = size * 0.007; g.strokeStyle = INK; g.stroke();
      }
      g.beginPath(); g.arc(u01(m), barY, size * 0.032, 0, 7); g.fillStyle = colors[me] || '#fff'; g.fill(); g.lineWidth = size * 0.012; g.strokeStyle = INK; g.stroke();
    },
  };
}
