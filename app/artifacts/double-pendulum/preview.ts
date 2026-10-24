import type { Preview } from '../types'
import { advance, defaults, ensemble, positions, type State } from './pendulum'

const N = 14
const TRAIL = 70 // samples at 60 per second
const START: State = { t1: 2.1, t2: 2.7, w1: 0, w2: 0 }

/** A fan of pendulums with fading trails that come apart; restarts every 14 seconds. */
export const preview: Preview = () => {
  let sims = ensemble(START, N, 0.02)
  let trails: { x: number; y: number }[][] = sims.map(() => [])
  let simT = 0
  return ({ ctx, width, height, t, color }) => {
    const target = t % 14
    if (target < simT) {
      sims = ensemble(START, N, 0.02)
      trails = sims.map(() => [])
      simT = 0
    }
    while (simT < target) {
      sims.forEach((s, i) => {
        advance(s, defaults, 1 / 60, 1 / 300)
        const { x2, y2 } = positions(s, defaults)
        trails[i].push({ x: x2, y: y2 })
        if (trails[i].length > TRAIL) trails[i].shift()
      })
      simT += 1 / 60
    }
    const scale = (Math.min(width, height) / 2 - 8) / 2
    const cx = width / 2
    const cy = height / 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    sims.forEach((s, i) => {
      const hue = (i / (N - 1)) * 300
      ctx.strokeStyle = `hsl(${hue} 80% 58% / 0.35)`
      ctx.lineWidth = 1.2
      ctx.beginPath()
      trails[i].forEach((p, k) => (k ? ctx.lineTo(cx + p.x * scale, cy + p.y * scale) : ctx.moveTo(cx + p.x * scale, cy + p.y * scale)))
      ctx.stroke()
      const { x1, y1, x2, y2 } = positions(s, defaults)
      ctx.strokeStyle = `hsl(${hue} 70% 55% / 0.7)`
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + x1 * scale, cy + y1 * scale)
      ctx.lineTo(cx + x2 * scale, cy + y2 * scale)
      ctx.stroke()
      ctx.fillStyle = `hsl(${hue} 80% 58%)`
      ctx.beginPath()
      ctx.arc(cx + x2 * scale, cy + y2 * scale, 4, 0, Math.PI * 2)
      ctx.fill()
    })
    ctx.fillStyle = color('--text')
    ctx.beginPath()
    ctx.arc(cx, cy, 3, 0, Math.PI * 2)
    ctx.fill()
  }
}
