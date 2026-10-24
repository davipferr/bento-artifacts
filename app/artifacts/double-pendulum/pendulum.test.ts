import { describe, expect, it } from 'vitest'
import { advance, defaults, energy, ensemble, positions, separation, wrap, type State } from './pendulum'

const at = (t1: number, t2: number): State => ({ t1, t2, w1: 0, w2: 0 })

describe('double pendulum', () => {
  it('stays at rest hanging straight down', () => {
    const s = at(0, 0)
    advance(s, defaults, 5)
    expect(Math.abs(s.t1) + Math.abs(s.t2) + Math.abs(s.w1) + Math.abs(s.w2)).toBe(0)
  })

  it('conserves energy, even in the chaotic regime', () => {
    const s = at(2.2, 2.6)
    const e0 = energy(s, defaults)
    for (let i = 0; i < 20; i++) {
      advance(s, defaults, 1)
      expect(Math.abs(energy(s, defaults) - e0) / e0).toBeLessThan(1e-6)
    }
  })

  it('swings in the slow normal mode at the textbook frequency for small angles', () => {
    // Equal masses and rods: the slow mode has θ2 = √2·θ1 and ω² = (2 − √2)·g/l.
    const s = at(0.01, 0.01 * Math.SQRT2)
    const period = (2 * Math.PI) / Math.sqrt((2 - Math.SQRT2) * defaults.g)
    advance(s, defaults, period / 2)
    expect(s.t1).toBeCloseTo(-0.01, 4)
    expect(s.t2 / s.t1).toBeCloseTo(Math.SQRT2, 2)
    advance(s, defaults, period / 2)
    expect(s.t1).toBeCloseTo(0.01, 4)
  })

  it('is mirror-symmetric', () => {
    const a = at(1.9, -0.7)
    const b = at(-1.9, 0.7)
    advance(a, defaults, 3)
    advance(b, defaults, 3)
    expect(a.t1).toBeCloseTo(-b.t1, 9)
    expect(a.t2).toBeCloseTo(-b.t2, 9)
  })

  it('amplifies a tiny difference in the chaotic regime but not near rest', () => {
    const chaotic = ensemble(at(2.4, 2.4), 2, 1e-6)
    const calm = ensemble(at(0.2, 0.2), 2, 1e-6)
    for (const s of [...chaotic, ...calm]) advance(s, defaults, 30)
    expect(separation(chaotic[0], chaotic[1])).toBeGreaterThan(1e-2)
    expect(separation(calm[0], calm[1])).toBeLessThan(1e-4)
  })

  it('places the bobs at the ends of the rods', () => {
    const { x1, y1, x2, y2 } = positions(at(Math.PI / 2, 0), defaults)
    expect(x1).toBeCloseTo(1)
    expect(y1).toBeCloseTo(0)
    expect(x2).toBeCloseTo(1)
    expect(y2).toBeCloseTo(1)
  })

  it('spreads an ensemble evenly around the starting angle', () => {
    const list = ensemble(at(1, 2), 5, 0.4)
    expect(list.map((s) => s.t2)).toEqual([1.8, 1.9, 2, 2.1, 2.2].map((v) => expect.closeTo(v, 12)))
    expect(ensemble(at(1, 2), 1, 0.4)[0].t2).toBe(2)
  })

  it('wraps angle differences onto the circle', () => {
    expect(wrap(2 * Math.PI + 0.1)).toBeCloseTo(0.1)
    expect(wrap(-0.1 - 4 * Math.PI)).toBeCloseTo(-0.1)
  })
})
