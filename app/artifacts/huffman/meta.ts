import type { ArtifactMeta } from '../types'

export const meta: ArtifactMeta = {
  title: 'Huffman Coding',
  tagline: 'Squeeze text into fewer bits, merge by merge.',
  description:
    'Type any text and watch Huffman’s algorithm build its optimal prefix code: the two lightest ' +
    'trees merge again and again until one remains. Compare the result with UTF-8, a fixed-width code ' +
    'and Shannon’s entropy bound, and hover a symbol to trace its path through the tree and the bit stream.',
  category: 'algorithms',
  tags: ['compression', 'greedy', 'information theory', 'SVG'],
  size: 'M',
  difficulty: 'easy',
  glyph: '01⑂',
}
