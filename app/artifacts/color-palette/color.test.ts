import { describe, expect, it } from 'vitest'
import {
  contrast,
  harmony,
  hex,
  hexToRgb,
  inGamut,
  oklchToRgb,
  rating,
  rgbToHex,
  rgbToOklch,
  SCALE_STEPS,
  tonalScale,
  toGamut,
} from './color'

const fromHex = (h: string) => rgbToOklch(hexToRgb(h)!)

describe('conversions', () => {
  it('round-trips hex through OKLCH', () => {
    for (const h of ['#000000', '#ffffff', '#ff0000', '#4c6ef5', '#12b886', '#f08c00', '#7f7f7f']) {
      expect(rgbToHex(oklchToRgb(fromHex(h)))).toBe(h)
    }
  })

  it('matches known OKLCH values', () => {
    const white = fromHex('#ffffff')
    expect(white.l).toBeCloseTo(1, 3)
    expect(white.c).toBeCloseTo(0, 3)
    const red = fromHex('#ff0000')
    expect(red.l).toBeCloseTo(0.628, 2)
    expect(red.c).toBeCloseTo(0.258, 2)
    expect(red.h).toBeCloseTo(29.2, 0)
  })

  it('parses short and long hex, rejects junk', () => {
    expect(hexToRgb('#fff')).toEqual({ r: 1, g: 1, b: 1 })
    expect(hexToRgb('00ff00')).toEqual({ r: 0, g: 1, b: 0 })
    expect(hexToRgb('#12345')).toBeNull()
    expect(hexToRgb('red')).toBeNull()
  })
})

describe('gamut mapping', () => {
  it('keeps lightness and hue, lowers chroma until it fits', () => {
    const wild = { l: 0.7, c: 0.37, h: 200 }
    expect(inGamut(oklchToRgb(wild))).toBe(false)
    const mapped = toGamut(wild)
    expect(inGamut(oklchToRgb(mapped))).toBe(true)
    expect(mapped.l).toBe(0.7)
    expect(mapped.h).toBe(200)
    expect(mapped.c).toBeLessThan(0.37)
    expect(mapped.c).toBeGreaterThan(0.05)
  })

  it('leaves in-gamut colours alone', () => {
    const ok = { l: 0.6, c: 0.05, h: 30 }
    expect(toGamut(ok)).toBe(ok)
  })
})

describe('contrast', () => {
  it('is 21 for black on white and 1 for a colour on itself', () => {
    expect(contrast(hexToRgb('#000')!, hexToRgb('#fff')!)).toBeCloseTo(21)
    expect(contrast(hexToRgb('#4c6ef5')!, hexToRgb('#4c6ef5')!)).toBeCloseTo(1)
  })

  it('matches the WCAG reference for #767676 on white (4.54)', () => {
    expect(contrast(hexToRgb('#767676')!, hexToRgb('#fff')!)).toBeCloseTo(4.54, 2)
  })

  it('rates by WCAG thresholds', () => {
    expect(rating(7.1)).toBe('AAA')
    expect(rating(4.5)).toBe('AA')
    expect(rating(3.2)).toBe('AA large')
    expect(rating(2)).toBe('fail')
  })
})

describe('palettes', () => {
  const base = { l: 0.62, c: 0.15, h: 260 }

  it('spaces triadic hues 120° apart', () => {
    const [a, b, c] = harmony(base, 'triadic')
    expect(a.h).toBe(260)
    expect(b.h).toBe(20)
    expect(c.h).toBe(140)
  })

  it('builds an 11-step scale from light to dark, all in gamut', () => {
    const scale = tonalScale(base)
    expect(scale).toHaveLength(SCALE_STEPS.length)
    for (let i = 1; i < scale.length; i++) expect(scale[i].l).toBeLessThan(scale[i - 1].l)
    for (const color of scale) expect(inGamut(oklchToRgb(color))).toBe(true)
    expect(hex(scale[0])).toMatch(/^#[0-9a-f]{6}$/)
  })
})
