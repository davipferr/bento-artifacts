import type { Preview } from '../types'

/** A four-dot stepper filling up step by step, with the form panel sliding in each time. */
export const preview: Preview = () => ({ ctx, width, height, t, color }) => {
  const phase = (t + 0.3) % 6
  const step = Math.min(3, Math.floor(phase / 1.3))
  const local = phase - step * 1.3
  const w = Math.min(280, width - 40)
  const x0 = (width - w) / 2
  const y = Math.max(22, height * 0.22)
  const dx = w / 3

  ctx.lineWidth = 3
  ctx.strokeStyle = color('--border')
  ctx.beginPath()
  ctx.moveTo(x0, y)
  ctx.lineTo(x0 + w, y)
  ctx.stroke()
  ctx.strokeStyle = color('--cat')
  ctx.beginPath()
  ctx.moveTo(x0, y)
  ctx.lineTo(x0 + dx * step, y)
  ctx.stroke()

  for (let i = 0; i < 4; i++) {
    const cx = x0 + i * dx
    const done = i < step
    const current = i === step
    ctx.fillStyle = done ? color('--cat') : color('--surface')
    ctx.strokeStyle = done || current ? color('--cat') : color('--border')
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.arc(cx, y, current ? 12 : 10, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = done ? color('--accent-text') : current ? color('--cat') : color('--muted')
    ctx.font = '700 11px ui-sans-serif, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(done ? '✓' : String(i + 1), cx, y + 0.5)
  }

  // The step's form panel slides in from the right.
  const slide = Math.max(0, 1 - local / 0.35)
  ctx.globalAlpha = 1 - slide
  const px = x0 + slide * 40
  const py = y + 28
  const ph = Math.min(height - py - 10, 90)
  ctx.fillStyle = color('--surface')
  ctx.strokeStyle = color('--border')
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.roundRect(px, py, w, ph, 8)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = color('--chip')
  for (let r = 0; r < 3; r++) {
    if (py + 14 + r * 24 + 14 > py + ph) break
    ctx.beginPath()
    ctx.roundRect(px + 12, py + 12 + r * 24, w - 24 - (r === 2 ? w * 0.3 : 0), 14, 5)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}
