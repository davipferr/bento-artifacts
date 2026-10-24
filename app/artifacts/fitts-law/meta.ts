import type { ArtifactMeta } from '../types'

export const meta: ArtifactMeta = {
  title: 'Fitts’s Law Target Lab',
  tagline: 'Far and small is slow. Measure exactly how slow.',
  description:
    'Press start, then hit a target that is 16, 32 or 64px wide and up to 480px away, 27 times. The app fits ' +
    'Fitts’s law, MT = a + b · log₂(D/W + 1), to your own clicks and reports your throughput in bits per second, ' +
    'your miss rate and your effective target width. Do a round with a mouse, a trackpad and a finger, and ' +
    'see the lines pull apart.',
  category: 'ui',
  tags: ['UX laws', 'pointing', 'regression', 'experiment'],
  size: 'M',
  difficulty: 'easy',
  glyph: '◎→',
}
