import type { ArtifactMeta } from '../types'

export const meta: ArtifactMeta = {
  title: 'Game of Life Lab',
  tagline: 'Conway and friends on an endless board.',
  description:
    "Conway's Game of Life and seven other Life-like rules on a board with no edges. Draw cells, " +
    'stamp famous patterns (gliders, a glider gun, a pulsar), pan and zoom, and watch the population ' +
    'graph. Type your own B/S rule to invent a new universe.',
  category: 'games',
  tags: ['cellular automata', 'Conway', 'RLE', 'sparse sets'],
  size: 'M',
  difficulty: 'easy',
  glyph: '▚▞',
}
