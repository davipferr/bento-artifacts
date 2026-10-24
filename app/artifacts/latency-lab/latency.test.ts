import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../../kit/random'
import { averages, band, blindPlan, SPINNER_AFTER, viewAt, type Trial } from './latency'

describe('viewAt', () => {
  it('shows nothing at all until the result with no trick', () => {
    expect(viewAt('none', 300, 100)).toEqual({ pressed: false, spinner: false, skeleton: false, shown: false, unconfirmed: false })
    expect(viewAt('none', 300, 300).shown).toBe(true)
  })

  it('acknowledges the press immediately', () => {
    expect(viewAt('press', 1000, 10).pressed).toBe(true)
    expect(viewAt('press', 0, 10)).toMatchObject({ pressed: true, shown: true })
  })

  it('only shows a spinner when the wait is long', () => {
    expect(viewAt('spinner', 300, 250).spinner).toBe(false)
    expect(viewAt('spinner', 1000, SPINNER_AFTER - 1).spinner).toBe(false)
    expect(viewAt('spinner', 1000, SPINNER_AFTER).spinner).toBe(true)
    expect(viewAt('spinner', 1000, 1000).spinner).toBe(false)
  })

  it('shows a skeleton while waiting', () => {
    expect(viewAt('skeleton', 300, 0).skeleton).toBe(true)
    expect(viewAt('skeleton', 300, 300)).toMatchObject({ skeleton: false, shown: true })
  })

  it('shows optimistic results at once, unconfirmed until the server answers', () => {
    expect(viewAt('optimistic', 1000, 0)).toMatchObject({ shown: true, unconfirmed: true })
    expect(viewAt('optimistic', 1000, 1000)).toMatchObject({ shown: true, unconfirmed: false })
  })
})

describe('bands', () => {
  it('follows Nielsen’s limits', () => {
    expect(band(80)).toBe('feels instant')
    expect(band(300)).toBe('keeps your flow')
    expect(band(5000)).toBe('loses your attention')
  })
})

describe('blind test', () => {
  it('covers every delay three times, always including the bare button', () => {
    const plan = blindPlan(mulberry32(5))
    expect(plan).toHaveLength(12)
    for (const delay of [0, 100, 300, 1000]) {
      const own = plan.filter((t) => t.delay === delay)
      expect(own).toHaveLength(3)
      expect(own.some((t) => t.trick === 'none')).toBe(true)
      expect(new Set(own.map((t) => t.trick)).size).toBe(3)
    }
  })

  it('averages only rated trials', () => {
    const trials: Trial[] = [
      { delay: 1000, trick: 'none', rating: 0 },
      { delay: 1000, trick: 'optimistic', rating: 2 },
      { delay: 0, trick: 'none', rating: 2 },
      { delay: 100, trick: 'press' },
    ]
    const { byDelay, byTrick } = averages(trials)
    expect(byDelay[1000]).toBe(1)
    expect(byDelay[100]).toBeNull()
    expect(byTrick.none).toBe(1)
    expect(byTrick.optimistic).toBe(2)
  })
})
