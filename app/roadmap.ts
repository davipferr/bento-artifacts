import type { ArtifactMeta } from './artifacts/types'

/**
 * Artifacts from IDEAS.md that aren't built yet. The gallery shows them as "soon" tiles
 * until a folder with the same slug exists in ./artifacts.
 */
export type Planned = Pick<ArtifactMeta, 'title' | 'tagline' | 'category' | 'size' | 'glyph'> & { slug: string }

// Batch 1 is fully built. Add the next batch's ideas here to show them as "soon" tiles.
export const roadmap: Planned[] = []
