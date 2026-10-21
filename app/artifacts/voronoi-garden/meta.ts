import type { ArtifactMeta } from '../types'

export const meta: ArtifactMeta = {
  title: 'Voronoi Garden',
  tagline: 'Drop seeds, watch the plane split.',
  description:
    'Every point belongs to its nearest seed, and the plane splits into cells. Plant, drag and ' +
    'remove seeds, show the Delaunay triangulation hiding underneath, let the seeds drift, or run ' +
    "Lloyd's relaxation and watch random cells settle into an even, honeycomb-like tiling.",
  category: 'math',
  tags: ['Voronoi', 'Delaunay', "Lloyd's algorithm", 'geometry'],
  size: 'S',
  difficulty: 'easy',
  glyph: '⬡⬢',
}
