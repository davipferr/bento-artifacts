import type { ArtifactMeta } from '../types'

export const meta: ArtifactMeta = {
  title: 'Skeleton → Content',
  tagline: 'Four ways to swap a loading skeleton for the real thing.',
  description:
    'The same feed loads four times side by side: a hard cut, a crossfade, a staggered top-to-bottom reveal, ' +
    'and blur-up images that start as a colour placeholder. Change the latency, let items stream in one by one, ' +
    'slow everything down, and switch off “skeleton matches the layout” to watch the content jump and the ' +
    'layout-shift counter climb.',
  category: 'motion',
  tags: ['loading states', 'skeletons', 'layout shift', 'perceived performance'],
  size: 'M',
  difficulty: 'easy',
  glyph: '▭▭▭',
}
