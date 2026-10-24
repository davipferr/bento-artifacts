import { describe, expect, it } from 'vitest'
import { bands, clampWidth, current, diff, layout, SETS, stylesheet, tier } from './breakpoints'

const tw = SETS.tailwind.points

describe('matching', () => {
  it('counts matching min-width queries, inclusive at the edge', () => {
    expect(tier(639, tw)).toBe(0)
    expect(tier(640, tw)).toBe(1)
    expect(tier(1024, tw)).toBe(3)
    expect(tier(5000, tw)).toBe(5)
  })

  it('names the current breakpoint', () => {
    expect(current(375, tw)).toBe('base')
    expect(current(800, tw)).toBe('md')
    expect(current(1440, SETS.bootstrap.points)).toBe('xxl')
    expect(current(900, SETS.material.points)).toBe('expanded')
  })

  it('splits the axis into bands', () => {
    expect(bands(SETS.material.points)).toEqual([
      { name: 'base', from: 0, to: 600 },
      { name: 'medium', from: 600, to: 840 },
      { name: 'expanded', from: 840, to: 1200 },
      { name: 'large', from: 1200, to: 1600 },
      { name: 'xlarge', from: 1600, to: Infinity },
    ])
  })

  it('clamps widths to the supported range', () => {
    expect(clampWidth(100)).toBe(320)
    expect(clampWidth(2500)).toBe(1920)
    expect(clampWidth(800.6)).toBe(801)
  })
})

describe('layout', () => {
  it('builds up mobile-first', () => {
    expect(layout(375, tw)).toEqual({ menuButton: true, heroSplit: false, sidebar: false, columns: 1, footerColumns: 1 })
    expect(layout(700, tw)).toMatchObject({ menuButton: true, columns: 2 })
    expect(layout(800, tw)).toMatchObject({ menuButton: false, heroSplit: true, sidebar: false, columns: 2 })
    expect(layout(1100, tw)).toMatchObject({ sidebar: true, columns: 3 })
    expect(layout(1300, tw)).toMatchObject({ columns: 4, footerColumns: 4 })
  })

  it('follows the chosen framework', () => {
    // 1000px is lg in Bootstrap (992) but only md in Tailwind (1024).
    expect(layout(1000, SETS.bootstrap.points).sidebar).toBe(true)
    expect(layout(1000, tw).sidebar).toBe(false)
  })

  it('describes what changed', () => {
    expect(diff(layout(700, tw), layout(800, tw))).toEqual(['Nav links appear; ☰ menu hides', 'Hero splits into two columns', 'Footer: 2 → 4 columns'])
    expect(diff(layout(800, tw), layout(800, tw))).toEqual([])
  })
})

describe('stylesheet', () => {
  it('marks the rules in force', () => {
    const rules = stylesheet(800, tw)
    expect(rules.map((r) => `${r.name}:${r.active}`)).toEqual(['base:true', 'sm:true', 'md:true', 'lg:false', 'xl:false', '2xl:false'])
    expect(rules[2].query).toBe('@media (min-width: 768px)')
  })

  it('works with fewer breakpoints', () => {
    expect(stylesheet(1700, SETS.material.points).every((r) => r.active)).toBe(true)
    expect(stylesheet(1700, SETS.material.points)).toHaveLength(5)
  })
})
