import type { ArtifactMeta } from '../types'

export const meta: ArtifactMeta = {
  title: 'Fourier Drawing Machine',
  tagline: 'Any doodle, rebuilt from spinning circles.',
  description:
    'Draw a shape (or pick one) and watch a chain of rotating arrows trace it. The discrete Fourier ' +
    'transform turns the drawing into circles of different sizes and speeds; slide from 1 to 256 ' +
    'circles to see the approximation sharpen, and the error drop.',
  category: 'math',
  tags: ['Fourier', 'DFT', 'epicycles', 'complex numbers'],
  size: 'L',
  difficulty: 'medium',
  glyph: '◯◦∘',
}
