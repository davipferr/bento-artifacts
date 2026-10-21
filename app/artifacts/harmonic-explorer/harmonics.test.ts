import { describe, expect, it } from 'vitest'
import { centroid, COUNT, oddShare, presets, sample, waveform } from './harmonics'

const preset = (name: string) => presets.find((p) => p.name === name)!.amps

describe('presets', () => {
  it('all have one amplitude per harmonic, in 0–1', () => {
    for (const { amps } of presets) {
      expect(amps).toHaveLength(COUNT)
      for (const a of amps) expect(a >= 0 && a <= 1).toBe(true)
    }
  })

  it('square and triangle use only odd harmonics', () => {
    expect(oddShare(preset('Square'))).toBe(1)
    expect(oddShare(preset('Triangle'))).toBe(1)
    expect(oddShare(preset('Sawtooth'))).toBeLessThan(1)
  })
})

describe('sample', () => {
  it('a sine peaks at a quarter period', () => {
    expect(sample(preset('Sine'), 0.25)).toBeCloseTo(1)
    expect(sample(preset('Sine'), 0.75)).toBeCloseTo(-1)
  })

  it('the 1/n odd series approaches a square wave (π/4 plateau)', () => {
    // Sum of sin(nx)/n over odd n is π/4 on the plateau; with 8 terms it's close but rippled.
    expect(sample(preset('Square'), 0.25)).toBeCloseTo(Math.PI / 4, 1)
  })
})

describe('waveform', () => {
  it('normalizes the peak to 1', () => {
    const wave = waveform(preset('Sawtooth'), 256)
    expect(Math.max(...wave.map(Math.abs))).toBeCloseTo(1)
  })

  it('stays silent for all-zero amplitudes', () => {
    expect(waveform(Array(COUNT).fill(0), 8).every((v) => v === 0)).toBe(true)
  })
})

describe('centroid', () => {
  it('is 1 for a pure sine and grows with brightness', () => {
    expect(centroid(preset('Sine'))).toBe(1)
    expect(centroid(preset('Sawtooth'))).toBeGreaterThan(centroid(preset('Triangle')))
    expect(centroid(Array(COUNT).fill(0))).toBe(0)
  })
})
