import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../../kit/random'
import { buildGrid, createFlock, defaultRules, meanNearest, order, step, wrapDelta, type Flock, type Rules } from './flock'

const run = (flock: Flock, rules: Rules, seconds: number) => {
  for (let t = 0; t < seconds; t += 1 / 60) step(flock, rules, 1 / 60)
}

describe('boids', () => {
  it('finds the same neighbours with the grid as by brute force, across the wrap', () => {
    const flock = createFlock(300, 400, 300, mulberry32(2))
    const radius = 45
    const grid = buildGrid(flock, radius)
    flock.boids.forEach((b, i) => {
      const brute = flock.boids
        .map((o, j) => ({ j, d: Math.hypot(wrapDelta(o.x - b.x, 400), wrapDelta(o.y - b.y, 300)) }))
        .filter(({ j, d }) => j !== i && d < radius)
        .map(({ j }) => j)
      expect(grid.neighbors(i).sort((a, b) => a - b)).toEqual(brute)
    })
  })

  it('works in a world smaller than three cells', () => {
    const flock = createFlock(20, 60, 60, mulberry32(3))
    const grid = buildGrid(flock, 50)
    expect(new Set(grid.neighbors(0)).size).toBe(grid.neighbors(0).length)
  })

  it('lines up when alignment is the only rule', () => {
    const flock = createFlock(150, 500, 500, mulberry32(4))
    const before = order(flock)
    run(flock, { ...defaultRules, separation: 0, cohesion: 0, alignment: 1, radius: 80 }, 15)
    expect(before).toBeLessThan(0.3)
    expect(order(flock)).toBeGreaterThan(0.9)
  })

  it('keeps more room between boids with separation than without', () => {
    const rules = { ...defaultRules, alignment: 0.5 }
    const a = createFlock(120, 400, 400, mulberry32(5))
    const b = createFlock(120, 400, 400, mulberry32(5))
    run(a, { ...rules, separation: 3 }, 10)
    run(b, { ...rules, separation: 0 }, 10)
    expect(meanNearest(a)).toBeGreaterThan(meanNearest(b) * 1.5)
  })

  it('respects the speed limit and stays inside the wrapped world', () => {
    const flock = createFlock(100, 300, 200, mulberry32(6))
    run(flock, defaultRules, 5)
    for (const b of flock.boids) {
      expect(Math.hypot(b.vx, b.vy)).toBeLessThanOrEqual(defaultRules.maxSpeed + 1e-9)
      expect(b.x).toBeGreaterThanOrEqual(0)
      expect(b.x).toBeLessThan(300)
      expect(b.y).toBeGreaterThanOrEqual(0)
      expect(b.y).toBeLessThan(200)
    }
  })

  it('flees a scary lure', () => {
    const flock = createFlock(200, 600, 600, mulberry32(7))
    const lure = { x: 300, y: 300, strength: 4 }
    const close = (f: Flock) => f.boids.filter((b) => Math.hypot(b.x - 300, b.y - 300) < 60).length
    run(flock, { ...defaultRules, lure }, 4)
    expect(close(flock)).toBeLessThanOrEqual(2)
  })

  it('wraps offsets the short way around', () => {
    expect(wrapDelta(90, 100)).toBe(-10)
    expect(wrapDelta(-90, 100)).toBe(10)
    expect(wrapDelta(30, 100)).toBe(30)
  })
})
