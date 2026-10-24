import type { Preview } from '../types'
import { bits } from './hick'

/** The three curves drawing themselves: flat climbs, grouped less, search stays flat. */
export const preview: Preview = () => ({ ctx, width, height, t, color }) => {
  const pad = 26
  const k = Math.min(1, ((t + 1) % 5) / 2.5)
  const x = (n: number) => pad + ((bits(n) - bits(4)) / (bits(64) - bits(4))) * (width - pad * 2)
  const y = (ms: number) => height - pad - (ms / 2600) * (height - pad * 2)
  ctx.strokeStyle = color('--border')
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(pad, pad / 2)
  ctx.lineTo(pad, height - pad)
  ctx.lineTo(width - pad / 2, height - pad)
  ctx.stroke()
  const curves = [
    { tone: '--cat-games', a: 250, b: 360 },
    { tone: '--cat-tools', a: 380, b: 190 },
    { tone: '--cat-generative', a: 900, b: 40 },
  ]
  for (const c of curves) {
    ctx.strokeStyle = color(c.tone)
    ctx.lineWidth = 2.5
    ctx.beginPath()
    const steps = Math.max(2, Math.round(40 * k))
    for (let i = 0; i < steps; i++) {
      const n = 4 * 16 ** ((i / 39) * 1)
      const px = x(n)
      const py = y(c.a + c.b * bits(n))
      if (i) ctx.lineTo(px, py)
      else ctx.moveTo(px, py)
    }
    ctx.stroke()
  }
  ctx.fillStyle = color('--muted')
  ctx.font = '11px ui-sans-serif, system-ui, sans-serif'
  ctx.textAlign = 'center'
  for (const n of [4, 16, 64]) ctx.fillText(String(n), x(n), height - pad + 14)
}
