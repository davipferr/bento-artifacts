import type { ArtifactMeta } from '../types'

export const meta: ArtifactMeta = {
  title: 'Latency Lab',
  tagline: '0, 100, 300 or 1000 ms: how slow does it feel?',
  description:
    'The same “Load profile” button with four response delays, each paired with a trick that hides the wait: ' +
    'an instant press, a spinner that only appears after 400 ms, a skeleton, or an optimistic result. Click across a row ' +
    'to feel the difference, then take the blind test: rate 12 rounds without knowing the delay or the trick, and see ' +
    'which ones fooled you.',
  category: 'ui',
  tags: ['perceived performance', 'feedback', 'spinners', 'optimistic UI'],
  size: 'M',
  difficulty: 'easy',
  glyph: '⏱',
}
