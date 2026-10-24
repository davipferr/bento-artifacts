import type { ArtifactMeta } from '../types'

export const meta: ArtifactMeta = {
  title: 'Breakpoint Visualizer',
  tagline: 'Drag the viewport, watch the layout reflow.',
  description:
    'A sample site in a resizable browser frame, from a 320px phone to a 1920px desktop. Drag the edge, ' +
    'pick a device or sweep the whole range and watch the nav fold away, the hero split, the sidebar appear ' +
    'and the card grid go from 1 to 4 columns. A ruler shows the breakpoint bands (Tailwind, Bootstrap or ' +
    'Material), and the mobile-first stylesheet lights up the media queries in force.',
  category: 'ui',
  tags: ['responsive design', 'media queries', 'mobile-first', 'CSS'],
  size: 'M',
  difficulty: 'easy',
  glyph: '▭▯',
}
