import { describe, expect, it } from 'vitest'
import { ease, format, keywords, overshoot, parse, point, presets, solveT, type Bezier } from './bezier'

describe('ease', () => {
  it('is the identity for linear', () => {
    for (const x of [0, 0.1, 0.5, 0.77, 1]) expect(ease(keywords.linear, x)).toBeCloseTo(x, 6)
  })

  it('pins the endpoints for every preset', () => {
    for (const { curve } of presets) {
      expect(ease(curve, 0)).toBe(0)
      expect(ease(curve, 1)).toBe(1)
    }
  })

  it('matches reference values for ease (0.25, 0.1, 0.25, 1)', () => {
    // Values as computed by browsers' implementations of the CSS spec.
    expect(ease(keywords.ease, 0.25)).toBeCloseTo(0.4085, 3)
    expect(ease(keywords.ease, 0.5)).toBeCloseTo(0.8024, 3)
  })

  it('ease-in-out is symmetric', () => {
    for (const x of [0.1, 0.3, 0.45]) {
      expect(ease(keywords['ease-in-out'], x) + ease(keywords['ease-in-out'], 1 - x)).toBeCloseTo(1, 5)
    }
  })

  it('solves t accurately even with flat x slopes', () => {
    const flat: Bezier = [1, 0, 0, 1] // x'(t) = 0 at t = 0.5
    for (const x of [0.2, 0.5, 0.8]) expect(point(flat, solveT(flat, x))[0]).toBeCloseTo(x, 5)
  })
})

describe('format / parse', () => {
  it('uses keywords when possible', () => {
    expect(format([0.25, 0.1, 0.25, 1])).toBe('ease')
    expect(format([0.123, 0.456, 0.789, 1.2345])).toBe('cubic-bezier(0.12, 0.46, 0.79, 1.23)')
  })

  it('parses keywords and functions', () => {
    expect(parse('ease-out')).toEqual([0, 0, 0.58, 1])
    expect(parse(' cubic-bezier(0.1, -0.5, .9, 1.5); ')).toEqual([0.1, -0.5, 0.9, 1.5])
  })

  it('rejects x outside 0–1 and malformed input', () => {
    expect(parse('cubic-bezier(1.2, 0, 0.5, 1)')).toBeNull()
    expect(parse('cubic-bezier(0.1, 0.2, 0.3)')).toBeNull()
    expect(parse('bouncy')).toBeNull()
  })
})

describe('overshoot', () => {
  it('is zero for ease and positive for back curves', () => {
    expect(overshoot(keywords.ease)).toEqual({ above: 0, below: 0 })
    expect(overshoot([0.34, 1.56, 0.64, 1]).above).toBeGreaterThan(0.05)
    expect(overshoot([0.36, 0, 0.66, -0.56]).below).toBeGreaterThan(0.05)
  })
})
