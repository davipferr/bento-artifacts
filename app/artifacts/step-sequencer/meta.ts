import type { ArtifactMeta } from '../types'

export const meta: ArtifactMeta = {
  title: 'Step Sequencer',
  tagline: 'A 16-step drum machine, no samples.',
  description:
    'Paint a beat on a 16-step grid and play it. Every drum is synthesized live with the Web Audio ' +
    'API (sine sweeps and filtered noise), timed on the audio clock with a look-ahead scheduler. ' +
    'Tempo, swing and the pattern live in the URL, so the address bar is always a link to your beat.',
  category: 'sound',
  tags: ['Web Audio', 'synthesis', 'scheduling', 'rhythm'],
  size: 'M',
  difficulty: 'easy',
  glyph: '▪▫▪▪',
}
