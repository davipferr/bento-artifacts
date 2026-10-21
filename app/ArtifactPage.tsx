import { Suspense, useEffect, useRef, useState, type CSSProperties } from 'react'
import { categories } from './artifacts/types'
import { href } from './kit/router'
import { ThemeToggle } from './kit/theme'
import type { Artifact } from './registry'

export function ArtifactPage({ artifact }: { artifact: Artifact }) {
  const stage = useRef<HTMLDivElement>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const { Component } = artifact

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === stage.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void stage.current?.requestFullscreen?.()
  }

  return (
    <div className="page" style={{ '--cat': `var(--cat-${artifact.category})` } as CSSProperties}>
      <header className="artifact-bar">
        <a className="back" href={href()}>
          ← Gallery
        </a>
        <div className="bar-actions">
          <button onClick={toggleFullscreen}>{fullscreen ? 'Exit fullscreen' : 'Fullscreen'}</button>
          <ThemeToggle />
        </div>
      </header>

      <div className="artifact-head">
        <span className="tile-category">
          <i className="dot" /> {categories[artifact.category]}
        </span>
        <h1>{artifact.title}</h1>
        <p className="muted">{artifact.description}</p>
        <div className="tags">
          {artifact.tags.map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="stage" ref={stage}>
        <Suspense fallback={<p className="muted">Loading…</p>}>
          <Component />
        </Suspense>
      </div>
    </div>
  )
}
