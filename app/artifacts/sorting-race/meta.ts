import type { ArtifactMeta } from '../types'

export const meta: ArtifactMeta = {
  title: 'Sorting Race',
  tagline: 'Six algorithms, one shuffled array. Fewest steps wins.',
  description:
    'Bubble, insertion, selection, merge, quick and heap sort race on copies of the same array. ' +
    'Every comparison, swap or write costs one step and every lane gets the same steps per frame, ' +
    'so the finishing order is the operation count. Try "nearly sorted" and watch the podium flip.',
  category: 'algorithms',
  tags: ['sorting', 'big-O', 'generators', 'sonification'],
  size: 'L',
  difficulty: 'easy',
  glyph: '▂▅▃▇▁▆',
}
