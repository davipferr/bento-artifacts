/**
 * The Gray–Scott model: two chemicals A and B spread out (diffuse) and react, A + 2B → 3B.
 * A is fed in at rate f; B is removed at rate k + f. Per step:
 *   A' = A + Da·∇²A − A·B² + f·(1 − A)
 *   B' = B + Db·∇²B + A·B² − (k + f)·B
 * Tiny changes in (f, k) give spots, stripes, mazes or dividing "cells".
 * This CPU version is the reference for the GPU shader and its fallback.
 */

export const DA = 1.0
export const DB = 0.5

export interface Preset {
  name: string
  feed: number
  kill: number
}

// Values from Robert Munafo's map of the Gray–Scott parameter space (mrob.com/pub/comp/xmorphia).
export const presets: Preset[] = [
  { name: 'Coral', feed: 0.0545, kill: 0.062 },
  { name: 'Mitosis', feed: 0.0367, kill: 0.0649 },
  { name: 'Spots', feed: 0.03, kill: 0.062 },
  { name: 'Worms', feed: 0.058, kill: 0.065 },
  { name: 'Maze', feed: 0.029, kill: 0.057 },
  { name: 'Holes', feed: 0.039, kill: 0.058 },
  { name: 'Chaos', feed: 0.026, kill: 0.051 },
  { name: 'U-Skate', feed: 0.062, kill: 0.06093 },
]

/** The region of the (k, f) map shown in the picker. */
export const MAP = { kMin: 0.03, kMax: 0.07, fMin: 0, fMax: 0.1 }

/**
 * The saddle-node line k = √f / 2 − f: above it, the "all A" state is the only stable one,
 * below it, a B-rich state exists too. The interesting patterns live just around it.
 */
export const saddleNode = (feed: number) => Math.sqrt(feed) / 2 - feed

export interface Field {
  width: number
  height: number
  a: Float32Array
  b: Float32Array
}

/** All A, no B. */
export function emptyField(width: number, height: number): Field {
  return { width, height, a: new Float32Array(width * height).fill(1), b: new Float32Array(width * height) }
}

/** Drop B in a disc (wrapping around the edges like the simulation does). */
export function stamp(field: Field, cx: number, cy: number, radius: number, value = 1) {
  const { width, height } = field
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > radius * radius) continue
      const x = (((Math.round(cx) + dx) % width) + width) % width
      const y = (((Math.round(cy) + dy) % height) + height) % height
      field.b[y * width + x] = value
      if (value === 0) field.a[y * width + x] = 1
    }
  }
}

/** One explicit Euler step with the 3×3 Laplacian (0.2 edges, 0.05 corners, −1 centre), on a torus. */
export function step(field: Field, feed: number, kill: number): Field {
  const { width, height, a, b } = field
  const na = new Float32Array(a.length)
  const nb = new Float32Array(b.length)
  for (let y = 0; y < height; y++) {
    const up = ((y - 1 + height) % height) * width
    const row = y * width
    const down = ((y + 1) % height) * width
    for (let x = 0; x < width; x++) {
      const left = (x - 1 + width) % width
      const right = (x + 1) % width
      const i = row + x
      const lap = (v: Float32Array) =>
        -v[i] +
        0.2 * (v[row + left] + v[row + right] + v[up + x] + v[down + x]) +
        0.05 * (v[up + left] + v[up + right] + v[down + left] + v[down + right])
      const ai = a[i]
      const bi = b[i]
      const abb = ai * bi * bi
      na[i] = Math.min(1, Math.max(0, ai + DA * lap(a) - abb + feed * (1 - ai)))
      nb[i] = Math.min(1, Math.max(0, bi + DB * lap(b) + abb - (kill + feed) * bi))
    }
  }
  return { width, height, a: na, b: nb }
}

export const totalB = (field: Field) => field.b.reduce((sum, v) => sum + v, 0)
