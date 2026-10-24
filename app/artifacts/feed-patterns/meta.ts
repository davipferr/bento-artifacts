import type { ArtifactMeta } from '../types'

export const meta: ArtifactMeta = {
  title: 'Infinite Scroll vs Pagination',
  tagline: 'Find item #73, go back, find it again.',
  description:
    'The same 200-item feed three ways: infinite scroll, numbered pages, and a “Load more” button. Each panel ' +
    'gives you a task (find #73, open it, press Back, open #74) and measures the time, scrolling and clicks. ' +
    'Watch infinite scroll dump you back at the top and its footer run away as you approach it, then turn ' +
    'on position restoring to see the fix.',
  category: 'ui',
  tags: ['UX patterns', 'scroll restoration', 'pagination', 'experiment'],
  size: 'M',
  difficulty: 'easy',
  glyph: '1 2 … ∞',
}
