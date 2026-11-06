// A sign painter's alphabet: letters as brush strokes on a 4 by 6 grid, not as pixels, so a shop sign holds up at any distance
// a chase camera gets to it. Each stroke is a flat ribbon, so a word costs a few dozen triangles and goes in the same draw as the wall.
const ROUND_C = [[3.9, 5], [3.1, 5.8], [2, 6], [0.95, 5.7], [0.3, 4.7], [0, 3], [0.3, 1.3], [0.95, 0.3], [2, 0], [3.1, 0.2], [3.9, 1]];
const ROUND_O = [[2, 6], [0.95, 5.7], [0.3, 4.7], [0, 3], [0.3, 1.3], [0.95, 0.3], [2, 0], [3.05, 0.3], [3.7, 1.3], [4, 3], [3.7, 4.7], [3.05, 5.7], [2, 6]];
const GLYPH = {
  A: [[[0, 0], [2, 6], [4, 0]], [[0.8, 2.1], [3.2, 2.1]]],
  B: [[[0, 0], [0, 6], [2.3, 6], [3.3, 5.5], [3.6, 4.5], [3.2, 3.5], [2.2, 3.1], [0, 3.1]], [[2.2, 3.1], [3.4, 2.7], [3.9, 1.7], [3.4, 0.6], [2.4, 0], [0, 0]]],
  C: [ROUND_C],
  D: [[[0, 0], [0, 6], [1.7, 6], [3, 5.4], [3.8, 4.2], [4, 3], [3.8, 1.8], [3, 0.6], [1.7, 0], [0, 0]]],
  E: [[[3.7, 6], [0, 6], [0, 0], [3.7, 0]], [[0, 3.1], [3, 3.1]]],
  F: [[[3.7, 6], [0, 6], [0, 0]], [[0, 3.1], [3, 3.1]]],
  G: [ROUND_C, [[2.2, 2.6], [4, 2.6], [3.9, 1]]],
  H: [[[0, 0], [0, 6]], [[4, 0], [4, 6]], [[0, 3.1], [4, 3.1]]],
  I: [[[2, 0], [2, 6]]],
  J: [[[3, 6], [3, 1.5], [2.6, 0.5], [1.7, 0], [0.8, 0.2], [0.2, 1]]],
  K: [[[0, 0], [0, 6]], [[3.8, 6], [0, 2.3]], [[1.2, 3.4], [4, 0]]],
  L: [[[0, 6], [0, 0], [3.6, 0]]],
  M: [[[0, 0], [0, 6], [2, 2], [4, 6], [4, 0]]],
  N: [[[0, 0], [0, 6], [4, 0], [4, 6]]],
  O: [ROUND_O],
  P: [[[0, 0], [0, 6], [2.5, 6], [3.5, 5.4], [3.9, 4.4], [3.5, 3.3], [2.5, 2.7], [0, 2.7]]],
  Q: [ROUND_O, [[2.4, 1.5], [4.1, -0.3]]],
  R: [[[0, 0], [0, 6], [2.5, 6], [3.5, 5.4], [3.9, 4.4], [3.5, 3.3], [2.5, 2.7], [0, 2.7]], [[2, 2.7], [4, 0]]],
  S: [[[3.8, 5], [3, 5.8], [1.9, 6], [0.8, 5.7], [0.25, 4.7], [0.7, 3.7], [2, 3.1], [3.3, 2.5], [3.85, 1.4], [3.3, 0.35], [2.1, 0], [0.9, 0.2], [0.1, 1]]],
  T: [[[0, 6], [4, 6]], [[2, 6], [2, 0]]],
  U: [[[0, 6], [0, 1.8], [0.5, 0.6], [2, 0], [3.5, 0.6], [4, 1.8], [4, 6]]],
  V: [[[0, 6], [2, 0], [4, 6]]],
  W: [[[0, 6], [1, 0], [2, 4.2], [3, 0], [4, 6]]],
  X: [[[0, 6], [4, 0]], [[4, 6], [0, 0]]],
  Y: [[[0, 6], [2, 3], [4, 6]], [[2, 3], [2, 0]]],
  Z: [[[0, 6], [4, 6], [0, 0], [4, 0]]],
  0: [ROUND_O],
  1: [[[0.9, 4.8], [2.2, 6], [2.2, 0]]],
  2: [[[0.2, 4.6], [0.8, 5.6], [2, 6], [3.2, 5.6], [3.8, 4.5], [3.2, 3], [0, 0], [4, 0]]],
  3: [[[0.3, 5.2], [1.8, 6], [3.3, 5.5], [3.6, 4.4], [2.8, 3.4], [1.6, 3.2]], [[2.8, 3.1], [3.9, 2.2], [3.5, 0.7], [2, 0], [0.3, 0.7]]],
  4: [[[3, 0], [3, 6], [0, 1.8], [4, 1.8]]],
  5: [[[3.6, 6], [0.6, 6], [0.3, 3.3], [2, 3.7], [3.4, 3.1], [3.9, 1.8], [3.3, 0.5], [1.8, 0], [0.2, 0.7]]],
};
const ADVANCE = 5.1, SPACE = 3;

export const textWidth = (text, h) => {
  let w = 0;
  for (const ch of text) w += ch === ' ' ? SPACE : ch === 'I' ? 2.6 : ADVANCE;
  return (w - 1.1) * h / 6;
};

// Calls quad(a, b, c, d) per ribbon, wound to face along (sinYaw, cosYaw). x, y, z: the middle of the word's baseline. h: height of a capital. weight: stroke as a share of h.
export function writeText(quad, text, x, y, z, yaw, h, { weight = 0.15, slant = 0.08, fit = null } = {}) {
  const k0 = h / 6, tw = textWidth(text, h), squeeze = fit && tw > fit ? fit / tw : 1, k = k0 * squeeze;
  const cs = Math.cos(yaw), sn = Math.sin(yaw), half = h * weight / 2;
  let pen = -tw * squeeze / 2;
  const P = (u, v) => [x + cs * u, y + v, z - sn * u];
  for (const ch of text.toUpperCase()) {
    if (ch === ' ') { pen += SPACE * k; continue; }
    const strokes = GLYPH[ch];
    if (!strokes) { pen += ADVANCE * k; continue; }
    const off = ch === 'I' ? -2 * k : 0;
    for (const line of strokes) {
      for (let i = 0; i + 1 < line.length; i++) {
        const [a0, b0] = line[i], [a1, b1] = line[i + 1];
        const u0 = pen + off + a0 * k + slant * b0 * k0, v0 = b0 * k0, u1 = pen + off + a1 * k + slant * b1 * k0, v1 = b1 * k0;
        const du = u1 - u0, dv = v1 - v0, l = Math.hypot(du, dv) || 1;
        // a touch past each end so that the corners close, a brush does not leave a notch
        const ex = (du / l) * half * 0.55, ey = (dv / l) * half * 0.55, nu = (-dv / l) * half, nv = (du / l) * half;
        quad(P(u0 - ex + nu, v0 - ey + nv), P(u0 - ex - nu, v0 - ey - nv), P(u1 + ex - nu, v1 + ey - nv), P(u1 + ex + nu, v1 + ey + nv));
      }
    }
    pen += (ch === 'I' ? 2.6 : ADVANCE) * k;
  }
}
