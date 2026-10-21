import { mulberry32 } from '../../kit/random'
import type { Preview } from '../types'
import { cells } from './voronoi'

/** Sixteen seeds wandering on little circles, their cells reshaping as they go. */
export const preview: Preview = () => {
  const random = mulberry32(21)
  const seeds = Array.from({ length: 16 }, () => ({ x: random(), y: random(), r: 0.03 + random() * 0.05, speed: 0.3 + random() * 0.5, phase: random() * 6.28 }))
  return ({ ctx, width, height, t, color }) => {
    const sites = seeds.map((s) => ({
      x: (s.x + Math.cos(t * s.speed + s.phase) * s.r) * width,
      y: (s.y + Math.sin(t * s.speed + s.phase) * s.r) * height,
    }))
    cells(sites, width, height).forEach((cell, i) => {
      ctx.fillStyle = `hsl(${(i * 137.5) % 360} 60% 72%)`
      ctx.strokeStyle = color('--surface')
      ctx.lineWidth = 2
      ctx.beginPath()
      cell.polygon.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    })
    ctx.fillStyle = color('--text')
    for (const s of sites) {
      ctx.beginPath()
      ctx.arc(s.x, s.y, 2.5, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}
