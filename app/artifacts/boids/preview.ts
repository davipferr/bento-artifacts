import { mulberry32 } from '../../kit/random'
import type { Preview } from '../types'
import { createFlock, defaultRules, step, type Flock } from './flock'

/** A small flock in a wrapped world, stepped to the tile's clock. */
export const preview: Preview = () => {
  let flock: Flock | null = null
  let simT = 0
  return ({ ctx, width, height, t }) => {
    if (!flock || flock.width !== width || flock.height !== height) {
      flock = createFlock(90, width, height, mulberry32(12))
      simT = 0
    }
    const rules = { ...defaultRules, radius: 40, maxSpeed: 90 }
    while (simT < t) {
      step(flock, rules, 1 / 30)
      simT += 1 / 30
    }
    for (const b of flock.boids) {
      const a = Math.atan2(b.vy, b.vx)
      ctx.fillStyle = `hsl(${(a * 180) / Math.PI + 180} 75% 58%)`
      ctx.beginPath()
      ctx.moveTo(b.x + Math.cos(a) * 6, b.y + Math.sin(a) * 6)
      ctx.lineTo(b.x + Math.cos(a + 2.5) * 3.6, b.y + Math.sin(a + 2.5) * 3.6)
      ctx.lineTo(b.x + Math.cos(a - 2.5) * 3.6, b.y + Math.sin(a - 2.5) * 3.6)
      ctx.closePath()
      ctx.fill()
    }
  }
}
