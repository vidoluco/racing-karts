// A synthetic long track for the long track engine's tests and tools: a figure of eight whose two legs cross 14 m apart on
// a viaduct, with climbs, sweepers, a stack of switchbacks, a shortcut, jumps, pads, hazards and a lake. Not a track of the
// game: tracks.js does not list it, so it is never bundled in the game, only in the dev page (?track=long-test&km=10).
import antelao from '../../src/world/tracks/antelao.js';

const TAU = Math.PI * 2;
const bump = (t, a, b, edge) => { // 0 outside [a, b], 1 inside, smooth over `edge` at both ends
  const s = (x) => { const q = Math.min(1, Math.max(0, x)); return q * q * (3 - 2 * q); };
  return s((t - a) / edge) * s((b - t) / edge);
};

// wobble along the base curve: sweepers on one lobe, switchbacks on the other, straight through both crossings
function path(th, A, B) {
  const t = ((th % TAU) + TAU) % TAU;
  const bx = A * Math.sin(t), bz = B * Math.sin(2 * t), dx = A * Math.cos(t), dz = 2 * B * Math.cos(2 * t), l = Math.hypot(dx, dz);
  const sweep = bump(t, 0.34, 1.2, 0.12), hair = bump(t, 3.55, 4.5, 0.08), lazy = bump(t, 5.1, 5.9, 0.12);
  const off = sweep * 30 * Math.sin(t * 20) + hair * 48 * Math.sin(t * 24) + lazy * 40 * Math.sin(t * 14);
  // y: climbs and dips that all pass through their mid height at the crossings, whose 14 m apart come from the cosine alone
  const y = 7 * Math.cos(t) + 80 * Math.sin(2 * t) + 9 * Math.sin(7 * t);
  return [bx + (dz / l) * off, y, bz - (dx / l) * off];
}

function measure(A, B) {
  let L = 0, p = path(0, A, B);
  const N = 6000;
  for (let i = 1; i <= N; i++) { const q = path((i / N) * TAU, A, B); L += Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]); p = q; }
  return L;
}

export function longTestDef({ km = 10, spacing = 40, water = true } = {}) {
  let A = 1500, B = 900;
  for (let it = 0; it < 12; it++) { const k = (km * 1000) / measure(A, B); A *= k; B *= k; }
  // equal arc control points, starting on a straight just past the viaduct
  const N = 8000, cum = new Float64Array(N + 1), start = 5.95;
  let p = path(start, A, B);
  for (let i = 1; i <= N; i++) { const q = path(start + (i / N) * TAU, A, B); cum[i] = cum[i - 1] + Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]); p = q; }
  const L = cum[N], m = Math.round(L / spacing), points = [];
  const thetaAt = (s) => { let lo = 0, hi = N; while (hi - lo > 1) { const c = (lo + hi) >> 1; if (cum[c] < s) lo = c; else hi = c; } return start + (lo / N) * TAU; };
  for (let j = 0; j < m; j++) {
    const th = thetaAt((j / m) * L), t = ((th % TAU) + TAU) % TAU, q = path(th, A, B);
    const hair = bump(t, 3.55, 4.5, 0.08);
    const nearCross = Math.min(Math.abs(t), Math.abs(t - TAU));
    points.push({ p: q, w: 15 + 1.5 * Math.sin(t * 5), bank: hair > 0.5 ? 9 : 4, surface: 'asphalt', tag: nearCross < 0.07 ? 'viaduct' : null });
  }
  const atU = (u) => { const th = thetaAt(u * L); return path(th, A, B); };
  // the shortcut: a chord across the inside of the far bend of one lobe
  const u0 = 0.205, u1 = 0.262, a = atU(u0), b = atU(u1), mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  const lake = [-A * 0.62, 0];
  return {
    id: 'long-test', region: 'cadore', long: true,
    names: { it: 'Prova lunga', en: 'Long test' }, blurb: { it: '', en: '' },
    points,
    boostPads: [0.07, 0.17, 0.31, 0.44, 0.58, 0.72, 0.84, 0.95].map((u) => ({ u, offset: 0 })),
    jumps: [{ u: 0.335, strength: 1 }, { u: 0.8, strength: 0.8 }],
    zones: [{ from: 0.3, to: 0.36, surface: 'dirt' }, { from: 0.62, to: 0.65, surface: 'cobble' }, { from: 0.86, to: 0.88, surface: 'wood' }],
    shortcuts: [{ from: u0, to: u1, points: [mid], surface: 'dirt', w: 8 }],
    hazards: [
      { kind: 'cows', u: 0.12, width: 1, period: 9, phase: 0 }, { kind: 'sheep', u: 0.27, width: 1, period: 10, phase: 0.2 },
      { kind: 'ponies', u: 0.42, width: 1, period: 11, phase: 0.4 }, { kind: 'bear', u: 0.5, width: 1, period: 9, phase: 0.1, side: 1 },
      { kind: 'macaques', u: 0.66, width: 1, period: 8, phase: 0.6 }, { kind: 'cows', u: 0.78, width: 1, period: 9, phase: 0.5 },
      { kind: 'sheep', u: 0.9, width: 1, period: 10, phase: 0.8 },
    ],
    ground: {
      base: 0, hills: 26, hillScale: 240, rimHeight: 160, rimFrom: 520, rimTo: 1000, water: water ? -120 : null,
      shape: water ? (x, z) => { const d = Math.hypot(x - lake[0], z - lake[1]) / 420; return d < 1 ? -170 * (1 - d * d) ** 2 : 0; } : undefined,
    },
    grid: { spacing: 4 },
    horizon: antelao.horizon, backdrops: antelao.backdrops, look: antelao.look, music: 'cadore',
    landmarks: null,
  };
}
