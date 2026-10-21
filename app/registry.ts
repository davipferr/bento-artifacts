import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import type { ArtifactMeta, Preview } from './artifacts/types'

/**
 * Artifacts are discovered from the folder layout, so adding one never touches this file:
 *   artifacts/<slug>/meta.ts     -> loaded eagerly (the gallery needs every tile)
 *   artifacts/<slug>/index.tsx   -> loaded lazily, in its own chunk, when opened
 *   artifacts/<slug>/preview.ts  -> optional, loaded lazily when its tile becomes visible
 */
const metas = import.meta.glob<ArtifactMeta>('./artifacts/*/meta.ts', { eager: true, import: 'meta' })
const loaders = import.meta.glob<{ default: ComponentType }>('./artifacts/*/index.tsx')
const previews = import.meta.glob<Preview>('./artifacts/*/preview.ts', { import: 'preview' })

export interface Artifact extends ArtifactMeta {
  slug: string
  Component: LazyExoticComponent<ComponentType>
  loadPreview?: () => Promise<Preview>
}

export const artifacts: Artifact[] = Object.entries(metas)
  .map(([path, meta]) => {
    const slug = path.split('/')[2]
    const load = loaders[`./artifacts/${slug}/index.tsx`]
    if (!load) throw new Error(`artifacts/${slug} has a meta.ts but no index.tsx`)
    return { ...meta, slug, Component: lazy(load), loadPreview: previews[`./artifacts/${slug}/preview.ts`] }
  })
  .sort((a, b) => a.title.localeCompare(b.title))
