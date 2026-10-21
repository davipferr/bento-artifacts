import type { Preview } from '../types'

/** "30 9 * * 1-5" on a month grid: weekdays light up, a cursor walks the days. */
export const preview: Preview = () => ({ ctx, width, height, t, color }) => {
  const cols = 7
  const rows = 5
  const gap = 4
  const top = 30
  const cell = Math.min((width - 28 - gap * (cols - 1)) / cols, (height - top - 8 - gap * (rows - 1)) / rows)
  const ox = (width - (cell * cols + gap * (cols - 1))) / 2
  const cursor = Math.floor(t * 3) % (cols * rows)
  ctx.fillStyle = color('--text')
  ctx.font = '600 14px ui-monospace, Menlo, Consolas, monospace'
  ctx.textAlign = 'left'
  ctx.fillText('30 9 * * 1-5', ox, 20)
  for (let i = 0; i < cols * rows; i++) {
    const col = i % cols
    const x = ox + col * (cell + gap)
    const y = top + Math.floor(i / cols) * (cell + gap)
    const weekday = col >= 1 && col <= 5
    ctx.fillStyle = weekday ? color('--cat') : color('--chip')
    ctx.globalAlpha = weekday ? (i <= cursor ? 0.85 : 0.35) : 0.8
    ctx.beginPath()
    ctx.roundRect(x, y, cell, cell, 4)
    ctx.fill()
    ctx.globalAlpha = 1
    if (i === cursor) {
      ctx.strokeStyle = color('--text')
      ctx.lineWidth = 2
      ctx.stroke()
    }
  }
}
