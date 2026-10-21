import { useEffect } from 'react'
import { ArtifactPage } from './ArtifactPage'
import { Gallery } from './Gallery'
import { href, useRoute } from './kit/router'
import { artifacts } from './registry'

export function App() {
  const route = useRoute()
  const artifact = artifacts.find((a) => a.slug === route)

  useEffect(() => {
    document.title = artifact ? `${artifact.title} · Bento` : 'Bento'
    window.scrollTo(0, 0)
  }, [artifact])

  if (artifact) return <ArtifactPage key={artifact.slug} artifact={artifact} />
  if (route) {
    return (
      <div className="page not-found">
        <h1>Nothing here</h1>
        <p className="muted">
          There's no artifact called <code>{route}</code>. <a href={href()}>Back to the gallery</a>
        </p>
      </div>
    )
  }
  return <Gallery />
}
