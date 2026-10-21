import type { ArtifactMeta } from '../types'

export const meta: ArtifactMeta = {
  title: 'Harmonic Explorer',
  tagline: 'Mix harmonics, hear the timbre.',
  description:
    'Every pitched sound is a stack of sine waves at 1×, 2×, 3×… its frequency. Draw how strong ' +
    'each of the first 16 harmonics is, see the waveform they add up to, and play it on the keyboard. ' +
    'Notes already sounding change shape as you draw.',
  category: 'sound',
  tags: ['Fourier', 'timbre', 'Web Audio', 'PeriodicWave'],
  size: 'S',
  difficulty: 'easy',
  glyph: '∿',
}
