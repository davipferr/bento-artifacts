import { describe, expect, it } from 'vitest'
import { align, cost, EASINGS, ends, lerpIcon, PAIRS, prepare, resample, signedArea, toPath, type Pt } from './morph'

const square: Pt[] = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
]

describe('resample', () => {
  it('spaces points evenly by arc length', () => {
    const points = resample(square, 8)
    expect(points).toHaveLength(8)
    expect(points[0]).toEqual([0, 0])
    expect(points[1]).toEqual([5, 0])
    expect(points[2]).toEqual([10, 0])
    expect(points[5]).toEqual([5, 10])
  })
})

describe('align', () => {
  it('matches winding and start point', () => {
    const reversedShifted: Pt[] = [
      [10, 10],
      [10, 0],
      [0, 0],
      [0, 10],
    ]
    expect(Math.sign(signedArea(reversedShifted))).not.toBe(Math.sign(signedArea(square)))
    const aligned = align(square, reversedShifted)
    expect(aligned).toEqual(square)
    expect(cost(square, aligned)).toBe(0)
  })

  it('never does worse than the input order', () => {
    const [a] = prepare(PAIRS[5].outlines![0], PAIRS[5].outlines![1], true)
    const b = resample(PAIRS[5].outlines![1], 64)
    expect(cost(a[0].points, align(a[0].points, b))).toBeLessThanOrEqual(cost(a[0].points, b))
  })
})

describe('pairs', () => {
  it('have matching structure at both ends', () => {
    for (const pair of PAIRS) {
      for (const matched of [true, false]) {
        const [a, b] = ends(pair, matched)
        expect(a.length).toBe(b.length)
        a.forEach((shape, i) => expect(shape.points.length).toBe(b[i].points.length))
      }
    }
  })

  it('lerp hits both ends exactly', () => {
    const [a, b] = ends(PAIRS[0], true)
    expect(lerpIcon(a, b, 0)).toEqual(a)
    expect(lerpIcon(a, b, 1)).toEqual(b)
    expect(lerpIcon(a, b, 0.5)[0].points[1]).toEqual([11.5, 6])
  })

  it('refuses mismatched shapes', () => {
    expect(() => lerpIcon([{ closed: true, points: square }], [{ closed: true, points: square.slice(1) }], 0.5)).toThrow('points')
  })
})

describe('helpers', () => {
  it('writes SVG paths', () => {
    expect(toPath({ closed: true, points: square.slice(0, 3) })).toBe('M0 0L10 0L10 10Z')
    expect(toPath({ closed: false, points: [[1.234, 2], [3, 4]] })).toBe('M1.23 2L3 4')
  })

  it('easings start at 0 and end at 1', () => {
    for (const ease of Object.values(EASINGS)) {
      expect(ease(0)).toBeCloseTo(0)
      expect(ease(1)).toBeCloseTo(1)
    }
    expect(Math.max(...Array.from({ length: 50 }, (_, i) => EASINGS.overshoot(i / 49)))).toBeGreaterThan(1)
  })
})
