import { describe, expect, it } from 'vitest'
import { dft, epicycles, error, normalize, reconstruct, resample, shapes, type Point } from './fourier'

const circle = (n: number, r = 1, turns = 1): Point[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * turns * i) / n
    return [r * Math.cos(a), r * Math.sin(a)]
  })

describe('resample', () => {
  it('spaces points evenly along a closed square', () => {
    const square: Point[] = [[0, 0], [1, 0], [1, 1], [0, 1]]
    const points = resample(square, 8)
    expect(points).toHaveLength(8)
    for (let i = 0; i < 8; i++) {
      const [a, b] = [points[i], points[(i + 1) % 8]]
      expect(Math.hypot(b[0] - a[0], b[1] - a[1])).toBeCloseTo(0.5, 6)
    }
  })
})

describe('dft', () => {
  it('turns a circle into a single arrow', () => {
    const terms = dft(circle(64, 2))
    expect(terms[0].freq).toBe(1)
    expect(terms[0].amp).toBeCloseTo(2, 6)
    expect(terms[1].amp).toBeLessThan(1e-9)
  })

  it('reads a backwards circle as a negative frequency', () => {
    expect(dft(circle(64, 1, -1))[0].freq).toBe(-1)
  })

  it('puts the centre of mass in the frequency-0 term', () => {
    const shifted = circle(32).map(([x, y]) => [x + 3, y - 1] as Point)
    const zero = dft(shifted).find((t) => t.freq === 0)!
    expect(zero.re).toBeCloseTo(3, 6)
    expect(zero.im).toBeCloseTo(-1, 6)
  })

  it('rebuilds the samples exactly with every term', () => {
    const points = resample(shapes[0].points, 64)
    const terms = dft(points)
    for (let j = 0; j < 64; j += 7) {
      const [x, y] = reconstruct(terms, terms.length, j / 64)
      expect(x).toBeCloseTo(points[j][0], 6)
      expect(y).toBeCloseTo(points[j][1], 6)
    }
  })
})

describe('approximation', () => {
  it('gets better with more arrows', () => {
    const points = resample(normalize(shapes.find((s) => s.name === 'Star')!.points), 128)
    const terms = dft(points)
    const e = [1, 5, 20, 128].map((k) => error(points, terms, k))
    for (let i = 1; i < e.length; i++) expect(e[i]).toBeLessThan(e[i - 1])
    expect(e[3]).toBeLessThan(1e-9)
  })

  it('returns one joint per arrow plus the origin', () => {
    const terms = dft(circle(16))
    expect(epicycles(terms, 5, 0.3)).toHaveLength(6)
  })
})

describe('normalize', () => {
  it('fits shapes into [-1, 1], centred', () => {
    for (const shape of shapes) {
      const pts = normalize(shape.points)
      const xs = pts.map((p) => p[0])
      const ys = pts.map((p) => p[1])
      expect(Math.max(...xs, ...ys)).toBeLessThanOrEqual(1 + 1e-9)
      expect(Math.min(...xs, ...ys)).toBeGreaterThanOrEqual(-1 - 1e-9)
      expect(Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))).toBeCloseTo(2, 6)
    }
  })
})
