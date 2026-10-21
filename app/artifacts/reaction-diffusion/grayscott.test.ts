import { describe, expect, it } from 'vitest'
import { emptyField, MAP, presets, saddleNode, stamp, step, totalB } from './grayscott'

const preset = (name: string) => presets.find((p) => p.name === name)!

describe('Gray–Scott', () => {
  it('leaves the all-A state alone', () => {
    let field = emptyField(16, 16)
    for (let i = 0; i < 20; i++) field = step(field, 0.04, 0.06)
    expect(totalB(field)).toBe(0)
    expect(field.a.every((v) => v === 1)).toBe(true)
  })

  it('keeps every value in 0–1', () => {
    let field = emptyField(32, 32)
    stamp(field, 16, 16, 5)
    for (let i = 0; i < 200; i++) field = step(field, preset('Coral').feed, preset('Coral').kill)
    for (const v of field.a) expect(v >= 0 && v <= 1).toBe(true)
    for (const v of field.b) expect(v >= 0 && v <= 1).toBe(true)
  })

  it('lets a seed of B die out when the kill rate is high', () => {
    let field = emptyField(32, 32)
    stamp(field, 16, 16, 4)
    for (let i = 0; i < 1500; i++) field = step(field, 0.02, 0.1)
    expect(totalB(field)).toBeLessThan(0.01)
  })

  it('lets a pattern spread in the coral regime', () => {
    let field = emptyField(48, 48)
    stamp(field, 24, 24, 4)
    const start = totalB(field)
    for (let i = 0; i < 2000; i++) field = step(field, preset('Coral').feed, preset('Coral').kill)
    expect(totalB(field)).toBeGreaterThan(start * 2)
  })

  it('wraps diffusion around the edges (a torus)', () => {
    let field = emptyField(16, 16)
    stamp(field, 0, 8, 1)
    field = step(field, 0.04, 0.06)
    expect(field.b[8 * 16 + 15]).toBeGreaterThan(0) // neighbour across the left edge
  })
})

describe('parameter map', () => {
  it('puts every preset inside the map', () => {
    for (const p of presets) {
      expect(p.kill).toBeGreaterThanOrEqual(MAP.kMin)
      expect(p.kill).toBeLessThanOrEqual(MAP.kMax)
      expect(p.feed).toBeGreaterThanOrEqual(MAP.fMin)
      expect(p.feed).toBeLessThanOrEqual(MAP.fMax)
    }
  })

  it('has the saddle-node line peak at f = 1/16, k = 1/16', () => {
    expect(saddleNode(1 / 16)).toBeCloseTo(1 / 16)
    expect(saddleNode(0.04)).toBeLessThan(saddleNode(1 / 16))
    expect(saddleNode(0.09)).toBeLessThan(saddleNode(1 / 16))
  })
})
