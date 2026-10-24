import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../../kit/random'
import { axisOffset, difficulty, effectiveWidth, fitTrials, place, plan, scaleFor, START, throughput, type Trial } from './fitts'

describe('difficulty', () => {
  it('uses the Shannon form', () => {
    expect(difficulty(16, 16)).toBe(1)
    expect(difficulty(480, 16)).toBeCloseTo(Math.log2(31))
  })
})

describe('plan', () => {
  it('covers every width × distance pair equally', () => {
    const trials = plan(2, 1, mulberry32(3))
    expect(trials).toHaveLength(18)
    const keys = new Set(trials.map((t) => `${t.w}/${t.d}`))
    expect(keys.size).toBe(9)
  })

  it('scales distances down for narrow arenas', () => {
    expect(scaleFor(2000)).toBe(1)
    expect(scaleFor(300)).toBeLessThan(1)
    expect(Math.max(...plan(1, 0.5, mulberry32(1)).map((t) => t.d))).toBe(240)
  })
})

describe('place', () => {
  it('keeps both circles in the arena, the right distance apart', () => {
    const random = mulberry32(7)
    for (let i = 0; i < 50; i++) {
      const { start, target } = place(240, 32, 600, 400, random)
      expect(Math.hypot(target.x - start.x, target.y - start.y)).toBeCloseTo(240)
      for (const [p, r] of [
        [start, START / 2],
        [target, 16],
      ] as const) {
        expect(p.x - r).toBeGreaterThanOrEqual(12)
        expect(p.x + r).toBeLessThanOrEqual(588)
        expect(p.y - r).toBeGreaterThanOrEqual(12)
        expect(p.y + r).toBeLessThanOrEqual(388)
      }
    }
  })
})

describe('axisOffset', () => {
  it('is positive past the target and ignores sideways error', () => {
    const start = { x: 0, y: 0 }
    const target = { x: 100, y: 0 }
    expect(axisOffset(start, target, { x: 110, y: 0 })).toBeCloseTo(10)
    expect(axisOffset(start, target, { x: 95, y: 30 })).toBeCloseTo(-5)
  })
})

describe('statistics', () => {
  const trial = (d: number, w: number, ms: number, hit = true): Trial => ({ device: 'mouse', d, w, ms, hit, offset: 0 })

  it('recovers a and b from exact data and ignores misses', () => {
    const trials = [
      trial(120, 64, 200 + 150 * difficulty(120, 64)),
      trial(480, 16, 200 + 150 * difficulty(480, 16)),
      trial(240, 32, 200 + 150 * difficulty(240, 32)),
      trial(240, 32, 5000, false),
    ]
    const f = fitTrials(trials)!
    expect(f.a).toBeCloseTo(200)
    expect(f.b).toBeCloseTo(150)
    expect(f.r2).toBeCloseTo(1)
  })

  it('computes throughput in bits per second', () => {
    expect(throughput([trial(16, 16, 500)])).toBeCloseTo(2)
    expect(throughput([])).toBeNaN()
  })

  it('computes effective width from the spread of offsets', () => {
    expect(effectiveWidth([-1, 1])).toBeCloseTo(4.133 * Math.SQRT2)
    expect(effectiveWidth([3])).toBeNaN()
  })
})
