import type { Preview } from '../types'

/** A cursor flying from start to targets of shrinking size, slowing down to land on each. */
export const preview: Preview = () => {
  const targets = [
    { fx: 0.82, fy: 0.3, w: 36 },
    { fx: 0.2, fy: 0.72, w: 22 },
    { fx: 0.75, fy: 0.78, w: 12 },
    { fx: 0.3, fy: 0.25, w: 28 },
  ]
  return ({ ctx, width, height, t, color }) => {
    const cat = color('--cat-ui')
    const period = 1.6
    const i = Math.floor(t / period) % targets.length
    const k = (t % period) / period
    const from = targets[(i + targets.length - 1) % targets.length]
    const to = targets[i]
    const move = Math.min(1, k / 0.7)
    // Fast ballistic phase, then a slow homing-in phase: the shape behind the log.
    const e = 1 - (1 - move) ** 3
    const px = (from.fx + (to.fx - from.fx) * e) * width
    const py = (from.fy + (to.fy - from.fy) * e) * height

    ctx.strokeStyle = color('--grid')
    ctx.setLineDash([3, 5])
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(from.fx * width, from.fy * height)
    ctx.lineTo(to.fx * width, to.fy * height)
    ctx.stroke()
    ctx.setLineDash([])

    ctx.fillStyle = color('--chip')
    ctx.beginPath()
    ctx.arc(from.fx * width, from.fy * height, 10, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = cat
    ctx.globalAlpha = k > 0.7 ? 1 : 0.85
    ctx.beginPath()
    ctx.arc(to.fx * width, to.fy * height, to.w / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
    if (k > 0.7) {
      ctx.strokeStyle = cat
      ctx.globalAlpha = 1 - (k - 0.7) / 0.3
      ctx.beginPath()
      ctx.arc(to.fx * width, to.fy * height, to.w / 2 + (k - 0.7) * 60, 0, Math.PI * 2)
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    // Arrow cursor.
    ctx.fillStyle = color('--text')
    ctx.strokeStyle = color('--surface')
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(px, py)
    ctx.lineTo(px, py + 16)
    ctx.lineTo(px + 4.5, py + 12)
    ctx.lineTo(px + 11, py + 12)
    ctx.closePath()
    ctx.stroke()
    ctx.fill()
  }
}
