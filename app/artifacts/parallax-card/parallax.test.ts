import { describe, expect, it } from 'vitest'
import { follow, glare, layerShift, orientationToNorm, pointerToNorm, tiltFor, toCss } from './parallax'

describe('pointerToNorm', () => {
  it('maps the box to -1…1 and clamps outside it', () => {
    expect(pointerToNorm(150, 200, 300, 400)).toEqual({ nx: 0, ny: 0 })
    expect(pointerToNorm(0, 400, 300, 400)).toEqual({ nx: -1, ny: 1 })
    expect(pointerToNorm(-50, 900, 300, 400)).toEqual({ nx: -1, ny: 1 })
  })
})

describe('orientationToNorm', () => {
  it('treats 45° front-back as rest and clamps', () => {
    expect(orientationToNorm(45, 0)).toEqual({ nx: 0, ny: 0 })
    expect(orientationToNorm(70, 25)).toEqual({ nx: 1, ny: 1 })
    expect(orientationToNorm(-90, -90)).toEqual({ nx: -1, ny: -1 })
  })
})

describe('tiltFor', () => {
  it('presses the side under the pointer away', () => {
    expect(tiltFor({ nx: 1, ny: 0 }, 10)).toEqual({ rx: 0, ry: 10 })
    expect(tiltFor({ nx: 0, ny: -1 }, 10)).toEqual({ rx: 10, ry: 0 })
  })

  it('flips when inverted', () => {
    expect(tiltFor({ nx: 1, ny: 1 }, 10, true)).toEqual({ rx: 10, ry: -10 })
  })
})

describe('follow', () => {
  it('snaps with no smoothing and approaches otherwise', () => {
    expect(follow(0, 1, 1 / 60, 0)).toBe(1)
    const v = follow(0, 1, 1 / 60, 0.5)
    expect(v).toBeGreaterThan(0)
    expect(v).toBeLessThan(1)
  })

  it('is frame-rate independent', () => {
    let at60 = 0
    for (let i = 0; i < 60; i++) at60 = follow(at60, 1, 1 / 60, 0.6)
    let at120 = 0
    for (let i = 0; i < 120; i++) at120 = follow(at120, 1, 1 / 120, 0.6)
    expect(at120).toBeCloseTo(at60, 10)
  })
})

describe('2D shift and glare', () => {
  it('moves deeper layers further, against the pointer', () => {
    expect(layerShift({ nx: 1, ny: 0 }, 0, 1)).toEqual({ x: 0, y: 0 })
    const near = layerShift({ nx: 1, ny: -1 }, 100, 1)
    const far = layerShift({ nx: 1, ny: -1 }, 20, 1)
    expect(near.x).toBeLessThan(far.x)
    expect(near.y).toBeGreaterThan(far.y)
  })

  it('puts the glare opposite the pointer and hides it at rest', () => {
    expect(glare({ nx: 0, ny: 0 }).opacity).toBe(0)
    const g = glare({ nx: 1, ny: 1 })
    expect(g.x).toBe(0)
    expect(g.y).toBe(0)
    expect(g.opacity).toBeGreaterThan(0)
  })

  it('writes the CSS', () => {
    expect(toCss(5, -3.25, 900)).toBe('perspective(900px) rotateX(5.0deg) rotateY(-3.3deg)')
  })
})
