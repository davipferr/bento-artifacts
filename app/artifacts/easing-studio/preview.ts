import type { Preview } from '../types'
import { ease, point, type Bezier } from './bezier'

/** An "out back" curve and a ball overshooting along a track. */
export const preview: Preview = () => {
  const curve: Bezier = [0.34, 1.56, 0.64, 1]
  return ({ ctx, width, height, t, color }) => {
    const size = Math.min(height * 0.62, width * 0.5)
    const x0 = 18
    const y0 = 12 + size * 1.15
    const sx = (x: number) => x0 + x * size
    const sy = (y: number) => y0 - y * size
    const cycle = (t * 0.7) % 1.4
    const p = Math.min(1, cycle)

    ctx.strokeStyle = color('--grid')
    ctx.lineWidth = 1
    ctx.strokeRect(sx(0), sy(1), size, size)
    ctx.strokeStyle = color('--cat')
    ctx.lineWidth = 3
    ctx.beginPath()
    for (let i = 0; i <= 50; i++) {
      const [x, y] = point(curve, i / 50)
      if (i) ctx.lineTo(sx(x), sy(y))
      else ctx.moveTo(sx(x), sy(y))
    }
    ctx.stroke()
    const y = ease(curve, p)
    ctx.fillStyle = color('--cat')
    ctx.beginPath()
    ctx.arc(sx(p), sy(y), 5, 0, Math.PI * 2)
    ctx.fill()

    // Track on the right.
    const tx = x0 + size + 26
    const tw = width - tx - 18
    if (tw < 40) return
    const ty = height / 2
    ctx.fillStyle = color('--chip')
    ctx.beginPath()
    ctx.roundRect(tx, ty - 12, tw, 24, 12)
    ctx.fill()
    ctx.fillStyle = color('--cat')
    ctx.beginPath()
    ctx.arc(tx + 12 + (tw - 24) * y, ty, 9, 0, Math.PI * 2)
    ctx.fill()
  }
}
