/**
 * A tone is a sum of sine waves at whole-number multiples of its pitch: the harmonics.
 * amps[n - 1] is the amplitude (0–1) of harmonic n.
 */

export const COUNT = 16

export type Harmonics = number[]

const build = (f: (n: number) => number): Harmonics => Array.from({ length: COUNT }, (_, i) => +f(i + 1).toFixed(3))

export const presets: { name: string; amps: Harmonics }[] = [
  { name: 'Sine', amps: build((n) => (n === 1 ? 1 : 0)) },
  { name: 'Square', amps: build((n) => (n % 2 ? 1 / n : 0)) },
  { name: 'Sawtooth', amps: build((n) => 1 / n) },
  { name: 'Triangle', amps: build((n) => (n % 2 ? 1 / (n * n) : 0)) },
  { name: 'Flute', amps: build((n) => [1, 0.45, 0.18, 0.08, 0.04][n - 1] ?? 0) },
  { name: 'Clarinet', amps: build((n) => (n % 2 ? 1 / n ** 0.6 : 0.03)) },
  { name: 'Organ', amps: build((n) => ({ 1: 1, 2: 0.8, 3: 0.6, 4: 0.7, 6: 0.5, 8: 0.45 })[n] ?? 0) },
  { name: 'Brass', amps: build((n) => Math.max(0.08, 1 - (n - 1) * 0.11)) },
  { name: 'Hollow', amps: build((n) => (n === 1 ? 1 : n % 2 ? 0 : 0.6 / Math.sqrt(n))) },
]

/** The waveform value at `phase` (0–1 = one period). */
export function sample(amps: Harmonics, phase: number): number {
  let sum = 0
  for (let i = 0; i < amps.length; i++) sum += amps[i] * Math.sin(2 * Math.PI * (i + 1) * phase)
  return sum
}

/** The largest |value| over one period, sampled at `points` positions. */
export function peak(amps: Harmonics, points = 512): number {
  let max = 0
  for (let i = 0; i < points; i++) max = Math.max(max, Math.abs(sample(amps, i / points)))
  return max
}

/** One period as `points` samples, scaled so the peak is ±1 (silence stays 0). */
export function waveform(amps: Harmonics, points: number): number[] {
  const values = Array.from({ length: points }, (_, i) => sample(amps, i / points))
  const max = Math.max(...values.map(Math.abs))
  return max > 1e-9 ? values.map((v) => v / max) : values
}

/**
 * Spectral centroid in harmonic numbers: the amplitude-weighted average harmonic.
 * It tracks how "bright" a sound feels: 1 for a pure sine, higher with more upper harmonics.
 */
export function centroid(amps: Harmonics): number {
  let weighted = 0
  let total = 0
  amps.forEach((a, i) => {
    weighted += (i + 1) * a
    total += a
  })
  return total > 0 ? weighted / total : 0
}

/** Share of the total amplitude in the odd harmonics (1, 3, 5…). */
export function oddShare(amps: Harmonics): number {
  const total = amps.reduce((s, a) => s + a, 0)
  const odd = amps.reduce((s, a, i) => (i % 2 === 0 ? s + a : s), 0)
  return total > 0 ? odd / total : 0
}
