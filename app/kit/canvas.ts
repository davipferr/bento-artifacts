import { useCallback, useEffect, useRef } from 'react'

export interface Frame {
  ctx: CanvasRenderingContext2D
  width: number
  height: number
  /** Read a CSS custom property, e.g. color('--accent'). Follows the light/dark theme. */
  color: (name: string) => string
}

/** Size the backing store for the device pixel ratio and clear it. */
export function prepare(canvas: HTMLCanvasElement): Frame {
  const dpr = window.devicePixelRatio || 1
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  const pixelWidth = Math.round(width * dpr)
  const pixelHeight = Math.round(height * dpr)
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth
    canvas.height = pixelHeight
  }
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)
  ctx.font = '11px ui-sans-serif, system-ui, sans-serif'
  const css = getComputedStyle(canvas)
  return { ctx, width, height, color: (name) => css.getPropertyValue(name).trim() }
}

/**
 * A canvas that redraws after every render, on resize and on a theme switch.
 * Returns the ref plus `redraw` for per-frame updates outside React.
 */
export function useCanvas(draw: (frame: Frame) => void) {
  const ref = useRef<HTMLCanvasElement>(null)
  const drawRef = useRef(draw)
  drawRef.current = draw

  const redraw = useCallback(() => {
    const canvas = ref.current
    if (canvas && canvas.clientWidth > 0) drawRef.current(prepare(canvas))
  }, [])

  useEffect(() => redraw())

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const observer = new ResizeObserver(redraw)
    observer.observe(canvas)
    const media = matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', redraw)
    window.addEventListener('themechange', redraw)
    return () => {
      observer.disconnect()
      media.removeEventListener('change', redraw)
      window.removeEventListener('themechange', redraw)
    }
  }, [redraw])

  return { ref, redraw }
}

/**
 * Run `callback(dt)` on every animation frame while `running` is true.
 * `dt` is in seconds and capped, so a background tab doesn't cause one giant step.
 */
export function useFrame(callback: (dt: number) => void, running = true) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    if (!running) return
    let id = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 15)
      last = now
      callbackRef.current(dt)
      id = requestAnimationFrame(loop)
    }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [running])
}
