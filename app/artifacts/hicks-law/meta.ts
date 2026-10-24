import type { ArtifactMeta } from '../types'

export const meta: ArtifactMeta = {
  title: 'Hick’s Law Menu',
  tagline: 'More choices, slower picks, but only log-slower.',
  description:
    'Find a word in menus of 4, 16 and 64 items while a clock times you. Do a round with a flat shuffled ' +
    'menu, one grouped by category, and one you can search, then compare your own curves: the app fits ' +
    'Hick’s law, T = a + b · log₂(n + 1), to your clicks and shows how grouping and search flatten it.',
  category: 'ui',
  tags: ['UX laws', 'menus', 'regression', 'experiment'],
  size: 'M',
  difficulty: 'easy',
  glyph: 'log₂',
}
