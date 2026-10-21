/** Mulberry32: a tiny seeded PRNG returning floats in [0, 1). Same seed, same sequence. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A random 32-bit seed, for "new seed" buttons. */
export const randomSeed = () => Math.floor(Math.random() * 2 ** 32)
