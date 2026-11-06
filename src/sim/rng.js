// A seeded stream (mulberry32). Each stream is independent, so what a bot rolls does not depend on what a human did.

export function createRng(seed) {
  let s = (seed >>> 0) || 1;
  const next = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next, range: (a, b) => a + (b - a) * next(), int: (n) => Math.floor(next() * n), chance: (p) => next() < p };
}

export const mixSeed = (seed, salt) => (Math.imul((seed >>> 0) ^ 0x9e3779b9, 2654435761) + Math.imul(salt + 1, 40503)) >>> 0;
