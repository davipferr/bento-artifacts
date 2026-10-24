import type { Frame } from '../kit/canvas'

/** Every artifact folder has a `meta.ts` exporting one of these, plus an `index.tsx` default export. */
export interface ArtifactMeta {
  title: string
  /** One line for the gallery tile. */
  tagline: string
  /** A short paragraph shown above the artifact. */
  description: string
  category: Category
  tags: string[]
  /** Tile size in the bento grid: S = 1×1, M = 2×1, L = 2×2. */
  size: 'S' | 'M' | 'L'
  difficulty: 'easy' | 'medium' | 'hard'
  /** A few characters drawn big on the tile as its picture. */
  glyph: string
}

/**
 * An optional `preview.ts` exports one of these for the gallery tile: a factory (so each
 * tile can keep its own state) returning a draw function called with the elapsed seconds.
 * It is loaded lazily when the tile scrolls into view and animates while hovered.
 */
export type Preview = () => (frame: Frame & { t: number }) => void

export const categories = {
  math: 'Math & Geometry',
  algorithms: 'Algorithms & CS',
  sound: 'Sound & Music',
  generative: 'Generative Art',
  tools: 'Everyday Tools',
  games: 'Games & Toys',
  ui: 'Interface & UI',
} as const

export type Category = keyof typeof categories
