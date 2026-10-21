import { describe, expect, it } from 'vitest'
import { createNoise3D } from './noise'
import { mulberry32 } from './random'

describe('mulberry32', () => {
  it('is deterministic per seed and stays in [0, 1)', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    for (let i = 0; i < 1000; i++) {
      const v = a()
      expect(v).toBe(b())
      expect(v >= 0 && v < 1).toBe(true)
    }
    expect(mulberry32(1)()).not.toBe(mulberry32(2)())
  })
})

describe('simplex noise', () => {
  const noise = createNoise3D(mulberry32(7))

  it('is deterministic for the same seed', () => {
    const again = createNoise3D(mulberry32(7))
    expect(noise(1.3, 4.2, 0.5)).toBe(again(1.3, 4.2, 0.5))
  })

  it('stays within [-1, 1] and actually varies', () => {
    let min = Infinity
    let max = -Infinity
    for (let i = 0; i < 5000; i++) {
      const v = noise(i * 0.137, i * 0.071, i * 0.013)
      min = Math.min(min, v)
      max = Math.max(max, v)
    }
    expect(min).toBeGreaterThanOrEqual(-1)
    expect(max).toBeLessThanOrEqual(1)
    expect(max - min).toBeGreaterThan(1)
  })

  it('is continuous: tiny steps give tiny changes', () => {
    for (let i = 0; i < 200; i++) {
      const x = i * 0.31
      expect(Math.abs(noise(x, 2, 3) - noise(x + 1e-4, 2, 3))).toBeLessThan(0.01)
    }
  })

  it('is zero on the integer lattice', () => {
    expect(noise(0, 0, 0)).toBe(0)
  })
})
