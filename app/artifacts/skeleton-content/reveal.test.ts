import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../../kit/random'
import { arrivals, FADE, finishedAt, IMAGE_EXTRA, layoutShift, look, STAGGER, startTimes } from './reveal'

describe('arrivals', () => {
  it('lands everything at once when the data comes together', () => {
    expect(arrivals(4, 800, false, Math.random)).toEqual([800, 800, 800, 800])
  })

  it('spreads items out when they stream one by one', () => {
    const times = arrivals(6, 1000, true, mulberry32(4))
    expect(new Set(times).size).toBeGreaterThan(1)
    for (const t of times) {
      expect(t).toBeGreaterThanOrEqual(350)
      expect(t).toBeLessThanOrEqual(1250)
    }
  })
})

describe('look', () => {
  const arrive = [500, 300, 900]

  it('shows only the skeleton before the data arrives', () => {
    expect(look('crossfade', 0, arrive, 499)).toMatchObject({ content: 0, skeleton: 1, sized: false })
  })

  it('hard cut swaps instantly', () => {
    expect(look('cut', 0, arrive, 500)).toMatchObject({ content: 1, skeleton: 0 })
  })

  it('crossfade blends over the fade time', () => {
    const half = look('crossfade', 0, arrive, 500 + FADE / 2)
    expect(half.content).toBeCloseTo(0.5)
    expect(half.skeleton).toBeCloseTo(0.5)
  })

  it('stagger keeps top-to-bottom order even when a lower item arrives first', () => {
    const starts = startTimes('stagger', arrive)
    expect(starts).toEqual([500, 500 + STAGGER, 900])
    expect(look('stagger', 1, arrive, 400).content).toBe(0)
    expect(look('stagger', 1, arrive, starts[1] + FADE).offsetY).toBeCloseTo(0)
  })

  it('blur-up shows a placeholder, then sharpens the image', () => {
    expect(look('blurUp', 0, arrive, 600)).toMatchObject({ placeholder: true, blur: 14 })
    expect(look('blurUp', 0, arrive, 500 + IMAGE_EXTRA + 1000)).toMatchObject({ placeholder: false, blur: 0 })
    expect(look('blurUp', 0, arrive, 600, false).blur).toBe(0)
  })

  it('knows when everything is done', () => {
    expect(finishedAt('cut', arrive)).toBe(900 + FADE)
    expect(finishedAt('blurUp', arrive)).toBeGreaterThan(finishedAt('crossfade', arrive))
  })
})

describe('layoutShift', () => {
  it('is zero when skeletons match the content', () => {
    expect(layoutShift([80, 120], [80, 120], [true, true])).toBe(0)
  })

  it('counts how far later items get pushed', () => {
    // Item 0 grows by 40 and pushes the two items below it.
    expect(layoutShift([60, 60, 60], [100, 60, 60], [true, false, false])).toBe(80)
    expect(layoutShift([60, 60, 60], [100, 60, 60], [false, false, false])).toBe(0)
  })
})
