import type { Preview } from '../types'
import { expand, presets, turtle } from './lsystem'

/** The fractal plant growing from its root, then holding before regrowing. */
export const preview: Preview = () => {
  const plant = presets.find((p) => p.name === 'Fractal plant')!
  const d = turtle(expand(plant.axiom, plant.rules, 5).text, plant)
  return ({ ctx, width, height, t, color }) => {
    const { minX, minY, maxX, maxY } = d.bounds
    const scale = Math.min((width - 16) / (maxX - minX), (height - 12) / (maxY - minY))
    const ox = (width - (maxX - minX) * scale) / 2 - minX * scale
    const oy = (height - (maxY - minY) * scale) / 2 - minY * scale
    const shown = Math.floor(d.count * Math.min(1, ((t * 0.3) % 1.4) / 1.1))
    ctx.lineCap = 'round'
    ctx.lineWidth = 1.2
    for (const leafy of [false, true]) {
      ctx.strokeStyle = leafy ? color('--cat') : '#8a5a3b'
      ctx.beginPath()
      for (let i = 0; i < shown; i++) {
        if (d.depth[i] / Math.max(1, d.maxDepth) > 0.35 !== leafy) continue
        const k = i * 4
        ctx.moveTo(ox + d.lines[k] * scale, oy + d.lines[k + 1] * scale)
        ctx.lineTo(ox + d.lines[k + 2] * scale, oy + d.lines[k + 3] * scale)
      }
      ctx.stroke()
    }
  }
}
