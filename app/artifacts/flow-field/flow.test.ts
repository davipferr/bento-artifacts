import { describe, expect, it } from 'vitest'
import { createNoise3D } from '../../kit/noise'
import { mulberry32 } from '../../kit/random'
import { colorIndex, Particles, step } from './flow'

const W = 400
const H = 300
const params = { scale: 0.004, turbulence: 2, speed: 1.5 }

describe('flow field particles', () => {
  it('start inside the canvas with no previous position', () => {
    const ps = new Particles(500, W, H, mulberry32(1))
    for (let i = 0; i < ps.count; i++) {
      expect(ps.x[i] >= 0 && ps.x[i] < W && ps.y[i] >= 0 && ps.y[i] < H).toBe(true)
      expect(Number.isNaN(ps.px[i])).toBe(true)
    }
  })

  it('move exactly `speed` pixels per step', () => {
    const random = mulberry32(2)
    const ps = new Particles(200, W, H, random)
    const noise = createNoise3D(mulberry32(3))
    step(ps, noise, 0, params, W, H, random)
    for (let i = 0; i < ps.count; i++) {
      if (Number.isNaN(ps.px[i])) continue
      expect(Math.hypot(ps.x[i] - ps.px[i], ps.y[i] - ps.py[i])).toBeCloseTo(1.5, 4)
    }
  })

  it('respawn instead of wandering off forever', () => {
    const random = mulberry32(4)
    const ps = new Particles(300, W, H, random)
    const noise = createNoise3D(mulberry32(5))
    for (let k = 0; k < 2000; k++) step(ps, noise, k * 0.001, { ...params, speed: 4 }, W, H, random)
    // After a step a particle may sit just past the edge; it is moved back on the next one.
    for (let i = 0; i < ps.count; i++) {
      expect(ps.x[i]).toBeGreaterThan(-5)
      expect(ps.x[i]).toBeLessThan(W + 5)
      expect(ps.y[i]).toBeGreaterThan(-5)
      expect(ps.y[i]).toBeLessThan(H + 5)
    }
  })

  it('can respawn around a point (the brush)', () => {
    const random = mulberry32(6)
    const ps = new Particles(10, W, H, random)
    for (let i = 0; i < 10; i++) {
      ps.respawn(i, W, H, random, { x: 100, y: 80, radius: 20 })
      expect(Math.hypot(ps.x[i] - 100, ps.y[i] - 80)).toBeLessThanOrEqual(20)
    }
  })
})

describe('colorIndex', () => {
  it('maps every mode into the palette range', () => {
    const random = mulberry32(7)
    const ps = new Particles(100, W, H, random)
    step(ps, createNoise3D(mulberry32(8)), 0, params, W, H, random)
    for (const mode of ['angle', 'particle', 'height'] as const) {
      for (let i = 0; i < ps.count; i++) {
        const c = colorIndex(ps, i, mode, 4, H)
        expect(c >= 0 && c < 4 && Number.isInteger(c)).toBe(true)
      }
    }
  })
})
