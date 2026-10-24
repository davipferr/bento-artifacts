import { describe, expect, it } from 'vitest'
import { allOff, allOn, HOP, keyTimes, locate, phases, pose, type Options } from './principles'

const only = (...keys: (keyof Options)[]): Options => ({ ...allOff(), ...Object.fromEntries(keys.map((k) => [k, true])) })
/** Sample a whole hop. */
const hop = (on: Options) => Array.from({ length: 300 }, (_, i) => pose((i / 300) * HOP, on))

describe('phases', () => {
  it('always fill exactly one hop', () => {
    for (const on of [allOn(), allOff()]) expect(phases(on).reduce((s, [, share]) => s + share, 0)).toBeCloseTo(1)
  })

  it('locates time inside the right phase', () => {
    expect(locate(0.01, allOn()).phase).toBe('anticipation')
    expect(locate(HOP * 0.5, allOn()).phase).toBe('air')
    expect(locate(HOP * 0.99, allOn()).phase).toBe('settle')
    expect(locate(HOP * 1.01, allOn()).hop).toBe(1)
  })
})

describe('pose', () => {
  it('keeps the ball undeformed with everything off', () => {
    for (const p of hop(allOff())) {
      expect(p.sx).toBe(1)
      expect(p.sy).toBe(1)
      expect(p.antenna).toBe(0)
      expect(p.blink).toBe(0)
    }
  })

  it('preserves volume when squashing and stretching', () => {
    for (const p of hop(only('squash', 'anticipation'))) if (p.phase !== 'impact') expect(p.sx * p.sy).toBeCloseTo(1, 5)
  })

  it('crouches only with anticipation on', () => {
    const minSy = (on: Options) => Math.min(...hop(on).filter((p) => p.phase === 'anticipation').map((p) => p.sy))
    expect(minSy(only('squash', 'anticipation'))).toBeLessThan(0.85)
    expect(minSy(only('squash'))).toBe(1)
  })

  it('travels on a curve with arcs, a straight peak without', () => {
    // Halfway up the climb, a parabola is higher than the straight line.
    const at = (on: Options) => hop(on).filter((p) => p.phase === 'air').find((p) => p.x > 0.35)!.y
    expect(at(only('arcs'))).toBeGreaterThan(at(allOff()))
  })

  it('starts and ends the jump slowly with slow in & out', () => {
    const firstStep = (on: Options) => {
      const air = hop(on).filter((p) => p.phase === 'air')
      return air[1].x - air[0].x
    }
    expect(firstStep(only('slowInOut'))).toBeLessThan(firstStep(allOff()))
  })

  it('jumps higher with exaggeration', () => {
    const peak = (on: Options) => Math.max(...hop(on).map((p) => p.y))
    expect(peak(only('exaggeration'))).toBeGreaterThan(peak(allOff()) * 1.3)
  })

  it('wobbles the antenna after landing with follow-through', () => {
    const settle = hop(only('followThrough')).filter((p) => p.phase === 'impact' || p.phase === 'settle')
    expect(Math.max(...settle.map((p) => Math.abs(p.antenna)))).toBeGreaterThan(0.3)
  })

  it('alternates direction every hop', () => {
    expect(pose(0.01, allOn()).facing).toBe(1)
    expect(pose(HOP + 0.01, allOn()).facing).toBe(-1)
    expect(pose(HOP * 0.99, allOn()).x).toBeCloseTo(0.8)
  })
})

describe('keyTimes', () => {
  it('gives four increasing key poses within the hop', () => {
    const times = keyTimes(allOn(), 2)
    expect(times).toHaveLength(4)
    expect([...times].sort((a, b) => a - b)).toEqual(times)
    expect(times[0]).toBe(2 * HOP)
    expect(times[3]).toBeLessThan(3 * HOP)
  })
})
