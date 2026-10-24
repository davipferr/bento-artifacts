import { describe, expect, it } from 'vitest'
import { atRest, decide, exitVelocity, progress, rotation, springStep, velocity, type Sample } from './swipe'

const rules = { distance: 0.4, flick: 800 }

describe('velocity', () => {
  it('measures px/s over the recent window', () => {
    const samples: Sample[] = [0, 16, 32, 48, 64].map((t) => ({ t, x: t * 2, y: -t }))
    const v = velocity(samples)
    expect(v.vx).toBeCloseTo(2000)
    expect(v.vy).toBeCloseTo(-1000)
  })

  it('ignores old samples and is zero after a pause', () => {
    const samples: Sample[] = [
      { t: 0, x: 0, y: 0 },
      { t: 16, x: 50, y: 0 },
      { t: 300, x: 50, y: 0 },
    ]
    expect(velocity(samples)).toEqual({ vx: 0, vy: 0 })
  })

  it('needs two samples', () => {
    expect(velocity([{ t: 0, x: 5, y: 5 }])).toEqual({ vx: 0, vy: 0 })
  })
})

describe('decide', () => {
  it('decides by distance past the threshold', () => {
    expect(decide(130, 0, 0, 0, 300, rules)).toBe('right')
    expect(decide(-130, 10, 0, 0, 300, rules)).toBe('left')
    expect(decide(100, 0, 0, 0, 300, rules)).toBeNull()
  })

  it('accepts a quick flick from a short drag', () => {
    expect(decide(30, 0, 1200, 50, 300, rules)).toBe('right')
    expect(decide(-30, 0, -1200, 0, 300, rules)).toBe('left')
  })

  it('rejects a flick back toward the centre', () => {
    expect(decide(80, 0, -1200, 0, 300, rules)).toBeNull()
  })

  it('detects mostly-vertical swipes up', () => {
    expect(decide(10, -140, 0, 0, 300, rules)).toBe('up')
    expect(decide(5, -40, 100, -1500, 300, rules)).toBe('up')
    expect(decide(10, 140, 0, 0, 300, rules)).toBeNull()
  })
})

describe('rotation', () => {
  it('tilts with the drag and flips when grabbed low', () => {
    expect(rotation(100, 300, -0.5, 15)).toBeGreaterThan(0)
    expect(rotation(100, 300, 0.6, 15)).toBeLessThan(0)
    expect(rotation(0, 300, 0, 15)).toBe(0)
  })

  it('is clamped', () => {
    expect(rotation(5000, 300, 0, 10)).toBe(15)
  })
})

describe('progress', () => {
  it('goes from -1 to 1 across the thresholds', () => {
    expect(progress(60, 0, 300, 0.4).x).toBeCloseTo(0.5)
    expect(progress(-500, 0, 300, 0.4).x).toBe(-1)
    expect(progress(0, -60, 300, 0.4).up).toBeCloseTo(0.5)
  })
})

describe('spring', () => {
  it('settles at the target', () => {
    let x = 200
    let v = 0
    for (let i = 0; i < 240; i++) [x, v] = springStep(x, v, 0, 300, 22, 1 / 60)
    expect(atRest(x, v)).toBe(true)
  })

  it('overshoots when under-damped and not when critically damped', () => {
    const minimum = (damping: number) => {
      let x = 100
      let v = 0
      let min = x
      for (let i = 0; i < 240; i++) {
        ;[x, v] = springStep(x, v, 0, 400, damping, 1 / 60)
        min = Math.min(min, x)
      }
      return min
    }
    expect(minimum(10)).toBeLessThan(-5)
    expect(minimum(40)).toBeGreaterThan(-0.5)
  })
})

describe('exitVelocity', () => {
  it('keeps a fast throw as it is', () => {
    expect(exitVelocity('right', 2400, 300)).toEqual({ vx: 2400, vy: 300 })
  })

  it('tops up a slow release to the minimum speed in the verdict direction', () => {
    const v = exitVelocity('left', -200, 100, 1600)
    expect(v.vx).toBeCloseTo(-1600)
    expect(v.vy).toBe(100)
    expect(exitVelocity('up', 0, 0, 1000)).toEqual({ vx: 0, vy: -1000 })
  })
})
