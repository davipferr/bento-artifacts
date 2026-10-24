import type { Preview } from '../types'
import { layerShift } from './parallax'

/** Three stacked layers swaying against an orbiting pointer: nearer layers move further. */
export const preview: Preview = () => ({ ctx, width, height, t, color }) => {
  const norm = { nx: Math.sin(t * 1.1), ny: Math.cos(t * 0.8) * 0.6 }
  const h = Math.min(height - 24, 150)
  const w = h * 0.75
  const x = (width - w) / 2
  const y = (height - h) / 2

  ctx.save()
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, 12)
  ctx.clip()
  const sky = ctx.createLinearGradient(0, y, 0, y + h)
  sky.addColorStop(0, color('--cat-math'))
  sky.addColorStop(1, color('--cat-sound'))
  ctx.fillStyle = sky
  ctx.fillRect(x, y, w, h)

  const sun = layerShift(norm, 20, 1)
  ctx.fillStyle = '#ffe8a3'
  ctx.beginPath()
  ctx.arc(x + w * 0.68 + sun.x, y + h * 0.3 + sun.y, h * 0.09, 0, Math.PI * 2)
  ctx.fill()

  const hills = [
    { depth: 40, tone: '--cat-math', base: 0.68, amp: 0.1 },
    { depth: 75, tone: '--cat-motion', base: 0.82, amp: 0.06 },
  ]
  for (const hill of hills) {
    const s = layerShift(norm, hill.depth, 1)
    ctx.fillStyle = color(hill.tone)
    ctx.globalAlpha = 0.9
    ctx.beginPath()
    ctx.moveTo(x - 20 + s.x, y + h + 20)
    for (let i = 0; i <= 12; i++) {
      const px = x - 20 + ((w + 40) * i) / 12 + s.x
      const py = y + h * (hill.base - Math.abs(Math.sin(i * 1.7 + hill.depth)) * hill.amp) + s.y
      ctx.lineTo(px, py)
    }
    ctx.lineTo(x + w + 20 + s.x, y + h + 20)
    ctx.fill()
    ctx.globalAlpha = 1
  }
  ctx.restore()

  ctx.strokeStyle = color('--border')
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, 12)
  ctx.stroke()
}
