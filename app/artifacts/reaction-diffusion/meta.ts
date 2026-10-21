import type { ArtifactMeta } from '../types'

export const meta: ArtifactMeta = {
  title: 'Reaction–Diffusion',
  tagline: 'Spots and stripes from two chemicals.',
  description:
    'The Gray–Scott model running on the GPU: two virtual chemicals spread and react, and out ' +
    'come coral, mazes, spots that split like cells, and wandering worms. Paint chemicals with ' +
    'the pointer and pick the feed and kill rates on a map of the parameter space.',
  category: 'generative',
  tags: ['Gray–Scott', 'WebGL2', 'ping-pong', 'Turing patterns'],
  size: 'S',
  difficulty: 'hard',
  glyph: '◉◎',
}
