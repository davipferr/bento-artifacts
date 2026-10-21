import type { ArtifactMeta } from '../types'

export const meta: ArtifactMeta = {
  title: 'Regex Railroad',
  tagline: 'See a regex as a railway map.',
  description:
    'Type a regular expression and it is drawn as a railroad diagram: follow any track from left ' +
    'to right and you spell a string it matches. Hover a piece of the diagram to see its part of the ' +
    'pattern; hover a capture group to highlight what it captured in the test strings.',
  category: 'algorithms',
  tags: ['regex', 'parsing', 'SVG', 'text'],
  size: 'S',
  difficulty: 'medium',
  glyph: '/a+/',
}
