import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../../kit/random'
import { bits, CATEGORIES, fit, median, menu, plan, summary, type Trial } from './hick'

describe('menu', () => {
  it.each([
    [4, 2],
    [16, 4],
    [64, 8],
  ] as const)('has %i unique items across %i categories', (n, groups) => {
    const items = menu(n, 'grouped', mulberry32(n))
    expect(items).toHaveLength(n)
    expect(new Set(items.map((i) => i.label)).size).toBe(n)
    expect(new Set(items.map((i) => i.category)).size).toBe(groups)
  })

  it('keeps categories together when grouped', () => {
    const items = menu(16, 'grouped', mulberry32(2))
    const runs = items.filter((item, i) => i === 0 || items[i - 1].category !== item.category)
    expect(runs).toHaveLength(4)
  })

  it('uses real category members', () => {
    for (const item of menu(64, 'flat', mulberry32(9))) expect(CATEGORIES[item.category]).toContain(item.label)
  })
})

describe('plan', () => {
  it('has each size the same number of times', () => {
    const sizes = plan(4, mulberry32(1))
    expect(sizes).toHaveLength(12)
    for (const n of [4, 16, 64]) expect(sizes.filter((s) => s === n)).toHaveLength(4)
  })
})

describe('statistics', () => {
  it('computes bits and medians', () => {
    expect(bits(1)).toBe(1)
    expect(bits(15)).toBe(4)
    expect(median([5, 1, 3])).toBe(3)
    expect(median([4, 1, 3, 2])).toBe(2.5)
    expect(median([])).toBeNaN()
  })

  it('recovers a and b from exact Hick data', () => {
    const points = [4, 16, 64, 16].map((n) => ({ n, ms: 300 + 150 * bits(n) }))
    const result = fit(points)!
    expect(result.a).toBeCloseTo(300)
    expect(result.b).toBeCloseTo(150)
    expect(result.r2).toBeCloseTo(1)
  })

  it('needs two different sizes to fit', () => {
    expect(fit([{ n: 4, ms: 500 }, { n: 4, ms: 600 }])).toBeNull()
  })

  it('summarises medians per layout and size', () => {
    const trials: Trial[] = [
      { layout: 'flat', n: 4, target: 'Apple', ms: 500, errors: 0 },
      { layout: 'flat', n: 4, target: 'Plum', ms: 700, errors: 1 },
      { layout: 'search', n: 64, target: 'Oslo', ms: 900, errors: 0 },
    ]
    expect(summary(trials)).toEqual({ flat: { 4: 600 }, grouped: {}, search: { 64: 900 } })
  })
})
