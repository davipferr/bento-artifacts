import { useEffect, useRef, useState } from 'react'
import type { Preview } from './artifacts/types'
import { prepare } from './kit/canvas'

/** The moment shown while a tile is still: far enough in that most previews look interesting. */
const STILL_T = 2.5

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * A tile's live picture. The preview module loads when the tile first scrolls into view,
 * draws one still frame, and animates only while `active` (hovered or focused).
 * Until it's ready, or if there is no preview, the glyph shows instead.
 */
export function TilePreview({ load, glyph, active }: { load?: () => Promise<Preview>; glyph: string; active: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const draw = useRef<ReturnType<Preview> | null>(null)
  const t = useRef(STILL_T)
  const [ready, setReady] = useState(false)

  const render = () => {
    const el = canvas.current
    if (!el || !draw.current || el.clientWidth === 0) return
    draw.current({ ...prepare(el), t: t.current })
  }

  // Load when visible.
  useEffect(() => {
    const el = canvas.current
    if (!el || !load) return
    let cancelled = false
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return
      observer.disconnect()
      void load().then((factory) => {
        if (cancelled) return
        draw.current = factory()
        render()
        setReady(true)
      })
    })
    observer.observe(el)
    return () => {
      cancelled = true
      observer.disconnect()
    }
  }, [load])

  // Redraw the still frame on resize and theme changes.
  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const observer = new ResizeObserver(() => render())
    observer.observe(el)
    window.addEventListener('themechange', render)
    return () => {
      observer.disconnect()
      window.removeEventListener('themechange', render)
    }
  }, [])

  // Animate while active.
  useEffect(() => {
    if (!active || !ready || reducedMotion()) return
    let id = 0
    let last = performance.now()
    const loop = (now: number) => {
      t.current += Math.min(0.1, (now - last) / 1000)
      last = now
      render()
      id = requestAnimationFrame(loop)
    }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [active, ready])

  return (
    <div className="tile-art" aria-hidden>
      {load && <canvas ref={canvas} className={`tile-canvas${ready ? ' ready' : ''}`} />}
      {!ready && <span className="glyph">{glyph}</span>}
    </div>
  )
}
