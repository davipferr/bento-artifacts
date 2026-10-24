import type { Preview } from '../types'
import { EASINGS, ends, lerpIcon, PAIRS } from './morph'

/** Three icon pairs morphing back and forth in turn. */
export const preview: Preview = () => {
  const pairs = [PAIRS[0], PAIRS[1], PAIRS[5]].map((p) => ends(p, true))
  return ({ ctx, width, height, t, color }) => {
    const size = Math.min(height * 0.62, (width - 40) / 3.4)
    const gap = size * 0.3
    const x0 = (width - size * 3 - gap * 2) / 2
    pairs.forEach(([a, b], i) => {
      // Each icon holds, then morphs, offset from its neighbours.
      const phase = (t * 0.6 + i * 0.33) % 2
      const k = phase < 1 ? Math.min(1, Math.max(0, (phase - 0.55) / 0.45)) : Math.max(0, 1 - Math.max(0, (phase - 1.55) / 0.45))
      const icon = lerpIcon(a, b, EASINGS.easeInOut(k))
      ctx.save()
      ctx.translate(x0 + i * (size + gap), (height - size) / 2 - 6)
      ctx.scale(size / 24, size / 24)
      for (const shape of icon) {
        ctx.beginPath()
        shape.points.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
        if (shape.closed) {
          ctx.closePath()
          ctx.fillStyle = color('--cat')
          ctx.fill()
        } else {
          ctx.strokeStyle = color('--cat')
          ctx.lineWidth = 2.2
          ctx.lineCap = 'round'
          ctx.stroke()
        }
      }
      ctx.restore()
    })
  }
}
