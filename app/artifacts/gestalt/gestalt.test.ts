import { describe, expect, it } from 'vitest'
import { COLS, labelReads, layout, NEUTRAL, perceive, ROWS } from './gestalt'

describe('layout', () => {
  it('places every dot inside the box', () => {
    const dots = layout(0.8, 480, 340)
    expect(dots).toHaveLength(COLS * ROWS)
    for (const d of dots) {
      expect(d.x).toBeGreaterThan(0)
      expect(d.x).toBeLessThan(480)
      expect(d.y).toBeGreaterThan(0)
      expect(d.y).toBeLessThan(340)
    }
  })

  it('squeezes rows together for positive proximity, columns for negative', () => {
    const gaps = (p: number) => {
      const dots = layout(p, 480, 340)
      return { x: dots[1].x - dots[0].x, y: dots[COLS].y - dots[0].y }
    }
    expect(gaps(0).x).toBeCloseTo(gaps(0).y)
    expect(gaps(0.6).x).toBeLessThan(gaps(0.6).y)
    expect(gaps(-0.6).x).toBeGreaterThan(gaps(-0.6).y)
  })
})

describe('perceive', () => {
  it('sees nothing in an even grid', () => {
    expect(perceive(NEUTRAL)).toEqual([])
  })

  it('follows proximity on its own', () => {
    expect(perceive({ ...NEUTRAL, proximity: 0.5 })[0].grouping).toBe('rows')
    expect(perceive({ ...NEUTRAL, proximity: -0.5 })[0].grouping).toBe('columns')
  })

  it('lets proximity beat colour at equal strength, and region beat proximity', () => {
    expect(perceive({ ...NEUTRAL, proximity: -0.7, color: 0.7 })[0].grouping).toBe('columns')
    expect(perceive({ ...NEUTRAL, proximity: 0.6, region: 0.8 })[0].grouping).toBe('blocks')
  })

  it('adds up cues that agree', () => {
    const [top] = perceive({ ...NEUTRAL, proximity: 0.4, color: 0.4 })
    expect(top.grouping).toBe('rows')
    expect(top.because).toEqual(['proximity', 'color'])
    expect(top.score).toBeCloseTo(0.4 + 0.4 * 0.8)
  })
})

describe('labelReads', () => {
  it('attaches a label to whichever field is clearly closer', () => {
    expect(labelReads(4, 24)).toBe('own')
    expect(labelReads(14, 14)).toBe('ambiguous')
    expect(labelReads(24, 4)).toBe('previous')
  })
})
