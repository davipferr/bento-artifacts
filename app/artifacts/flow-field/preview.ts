import { createNoise3D } from '../../kit/noise'
import { mulberry32 } from '../../kit/random'
import type { Preview } from '../types'
import { palettes } from './flow'

/** Short streamlines through a drifting noise field, in the Ocean palette. */
export const preview: Preview = () => {
  const noise = createNoise3D(mulberry32(11))
  const random = mulberry32(12)
  const seeds = Array.from({ length: 220 }, () => [random(), random()] as const)
  const { background, colors } = palettes.find((p) => p.name === 'Ocean')!
  return ({ ctx, width, height, t }) => {
    ctx.fillStyle = background
    ctx.fillRect(0, 0, width, height)
    ctx.lineWidth = 1.2
    ctx.globalAlpha = 0.75
    seeds.forEach(([sx, sy], i) => {
      let x = sx * width
      let y = sy * height
      ctx.strokeStyle = colors[i % colors.length]
      ctx.beginPath()
      ctx.moveTo(x, y)
      for (let s = 0; s < 16; s++) {
        const a = noise(x * 0.006, y * 0.006, t * 0.12) * Math.PI * 2
        x += Math.cos(a) * 3.5
        y += Math.sin(a) * 3.5
        ctx.lineTo(x, y)
      }
      ctx.stroke()
    })
    ctx.globalAlpha = 1
  }
}
