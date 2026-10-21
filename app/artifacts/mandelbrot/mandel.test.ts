import { describe, expect, it } from 'vitest'
import { autoIterations, colorOf, escape, HOME, needsDouble, pan, spots, toComplex, zoomAt, zoomLevel } from './mandel'

const W = 800
const H = 600

describe('view', () => {
  it('maps the screen centre to the view centre, and up to +imaginary', () => {
    expect(toComplex(HOME, W / 2, H / 2, W, H)).toEqual([HOME.cx, HOME.cy])
    const [, above] = toComplex(HOME, W / 2, 0, W, H)
    expect(above).toBeGreaterThan(HOME.cy)
  })

  it('keeps the point under the cursor fixed while zooming', () => {
    const before = toComplex(HOME, 123, 456, W, H)
    const zoomed = zoomAt(HOME, 123, 456, W, H, 0.25)
    const after = toComplex(zoomed, 123, 456, W, H)
    expect(after[0]).toBeCloseTo(before[0], 12)
    expect(after[1]).toBeCloseTo(before[1], 12)
    expect(zoomLevel(zoomed)).toBeCloseTo(4)
  })

  it('pans with the drag (content follows the pointer)', () => {
    const moved = pan(HOME, 100, 0)
    expect(toComplex(moved, W / 2 + 100, H / 2, W, H)[0]).toBeCloseTo(HOME.cx, 12)
  })
})

describe('precision', () => {
  it('stays on the GPU at moderate zoom and switches deep down', () => {
    expect(needsDouble(HOME)).toBe(false)
    expect(needsDouble({ cx: -0.74, cy: 0.13, scale: 1e-6 })).toBe(false)
    expect(needsDouble({ cx: -0.74, cy: 0.13, scale: 1e-8 })).toBe(true)
    expect(needsDouble(spots.find((s) => s.name === 'Deep (CPU)')!.view)).toBe(true)
  })

  it('raises the iteration budget with depth', () => {
    expect(autoIterations(HOME)).toBe(120)
    expect(autoIterations({ ...HOME, scale: HOME.scale / 1e6 })).toBe(1920)
  })

  it('gives the deep spot enough iterations to resolve (it needs ~2000)', () => {
    const deep = spots.find((s) => s.name === 'Deep (CPU)')!.view
    expect(autoIterations(deep)).toBeGreaterThan(2000)
  })

  it('finds the mini Mandelbrot copy in view (some points inside)', () => {
    const mini = spots.find((s) => s.name === 'Mini Mandelbrot')!.view
    let inside = 0
    for (let x = 0; x < 800; x += 40) if (escape(...toComplex(mini, x, 300, 800, 600), 2000) < 0) inside++
    expect(inside).toBeGreaterThan(3)
  })
})

describe('escape', () => {
  it('never escapes inside the main cardioid and bulb', () => {
    expect(escape(0, 0, 500)).toBe(-1)
    expect(escape(-1, 0, 500)).toBe(-1)
    expect(escape(-0.1, 0.1, 500)).toBe(-1)
  })

  it('escapes quickly far outside', () => {
    const mu = escape(2, 2, 500)
    expect(mu).toBeGreaterThan(0)
    expect(mu).toBeLessThan(3)
  })

  it('is smooth: nearby points outside give nearby values', () => {
    const a = escape(0.5, 0.5, 1000)
    const b = escape(0.5 + 1e-6, 0.5, 1000)
    expect(a).toBeGreaterThan(0)
    expect(Math.abs(a - b)).toBeLessThan(0.01)
  })

  it('takes longer the closer you get to the boundary', () => {
    expect(escape(0.26, 0, 5000)).toBeGreaterThan(escape(0.3, 0, 5000))
  })

  it('computes Julia sets when given a starting z', () => {
    // For c = 0 the Julia set is the unit circle.
    expect(escape(0, 0, 200, 0.5, 0)).toBe(-1)
    expect(escape(0, 0, 200, 1.5, 0)).toBeGreaterThan(0)
  })
})

describe('colour', () => {
  it('paints the inside black and the outside within 0–1', () => {
    expect(colorOf(-1, 0)).toEqual([0, 0, 0])
    for (let p = 0; p < 4; p++) {
      for (const mu of [0.5, 10, 123.4]) for (const v of colorOf(mu, p)) expect(v >= 0 && v <= 1).toBe(true)
    }
  })
})
