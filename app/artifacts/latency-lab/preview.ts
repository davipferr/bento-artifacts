import type { Preview } from '../types'
import { DELAYS, viewAt } from './latency'

/** Four buttons clicked together; results land at 0, 100, 300 and 1000 ms (the slow one shows a spinner). */
export const preview: Preview = () => ({ ctx, width, height, t, color }) => {
  const ms = ((t + 0.6) % 2.2) * 1000 - 300
  const rowH = Math.min(30, (height - 20) / 4.4)
  const w = Math.min(250, width - 40)
  const x = (width - w) / 2
  const y0 = (height - rowH * 4 - 18) / 2
  ctx.textBaseline = 'middle'
  DELAYS.forEach((delay, i) => {
    const y = y0 + i * (rowH + 6)
    const view = ms < 0 ? null : viewAt('spinner', delay, ms)
    ctx.fillStyle = color('--muted')
    ctx.font = '11px ui-monospace, Menlo, Consolas, monospace'
    ctx.textAlign = 'right'
    ctx.fillText(`${delay}ms`, x + 44, y + rowH / 2)
    // The button.
    ctx.fillStyle = color('--cat')
    ctx.globalAlpha = view?.pressed ? 0.75 : 1
    ctx.beginPath()
    ctx.roundRect(x + 52, y + (view?.pressed ? 2 : 0), 70, rowH - 4, 6)
    ctx.fill()
    ctx.globalAlpha = 1
    if (view?.spinner) {
      ctx.strokeStyle = color('--accent-text')
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(x + 87, y + rowH / 2, 6, t * 8, t * 8 + 4)
      ctx.stroke()
    }
    // The result.
    if (view?.shown) {
      ctx.fillStyle = `hsl(${i * 70} 65% 55%)`
      ctx.beginPath()
      ctx.arc(x + 146, y + rowH / 2, rowH / 2 - 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = color('--text')
      ctx.font = '12px ui-sans-serif, system-ui, sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(['Ana', 'Ravi', 'Joana', 'Kai'][i], x + 162, y + rowH / 2)
    }
  })
}
