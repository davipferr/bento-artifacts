import { describe, expect, it } from 'vitest'
import { decode, emptyPattern, encode, fromStrings, presets, randomPattern, sixteenth, STEPS, swingOffset, tracks } from './pattern'

describe('pattern encoding', () => {
  it('round-trips every preset', () => {
    for (const preset of presets) {
      const pattern = fromStrings(preset.rows)
      expect(decode(encode(pattern))).toEqual(pattern)
    }
  })

  it('encodes an empty pattern as zeros', () => {
    expect(encode(emptyPattern())).toBe('0'.repeat(tracks.length * 4))
  })

  it('puts step 1 in the lowest bit', () => {
    const pattern = emptyPattern()
    pattern[0][0] = true
    pattern[0][15] = true
    expect(encode(pattern).slice(0, 4)).toBe('8001')
  })

  it('rejects malformed text', () => {
    expect(decode('xyz')).toBeNull()
    expect(decode('0'.repeat(tracks.length * 4 - 1))).toBeNull()
  })
})

describe('fromStrings', () => {
  it('reads x as a hit and pads missing rows', () => {
    const pattern = fromStrings(['x...x'])
    expect(pattern[0].slice(0, 5)).toEqual([true, false, false, false, true])
    expect(pattern[0]).toHaveLength(STEPS)
    expect(pattern[1].every((on) => !on)).toBe(true)
  })
})

describe('timing', () => {
  it('has four 16ths per beat', () => {
    expect(sixteenth(120)).toBeCloseTo(0.125)
    expect(sixteenth(60) * 4).toBeCloseTo(1)
  })

  it('swings only the off-beat 16ths', () => {
    expect(swingOffset(0, 120, 0.5)).toBe(0)
    expect(swingOffset(2, 120, 0.5)).toBe(0)
    expect(swingOffset(1, 120, 0.5)).toBeCloseTo(0.0625)
    expect(swingOffset(3, 120, 0)).toBe(0)
  })
})

it('random patterns always have the downbeat kick and backbeat snare', () => {
  let seed = 1
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
  for (let i = 0; i < 20; i++) {
    const pattern = randomPattern(random)
    expect(pattern[0][0]).toBe(true)
    expect(pattern[1][4] && pattern[1][12]).toBe(true)
  }
})
