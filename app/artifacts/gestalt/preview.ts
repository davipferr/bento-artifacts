import type { Preview } from '../types'
import { COLS, layout, ROWS } from './gestalt'

/** The grid breathing between rows and columns, with every other row tinted. */
export const preview: Preview = () => ({ ctx, width, height, t, color }) => {
  const proximity = Math.sin(t * 0.9) * 0.8
  const dots = layout(proximity, width, height)
  const muted = color('--muted')
  const tint = color('--cat-ui')
  const r = Math.max(3, Math.min(width / COLS, height / ROWS) * 0.16)
  for (const d of dots) {
    ctx.fillStyle = d.row % 2 ? tint : muted
    ctx.beginPath()
    ctx.arc(d.x, d.y, r, 0, Math.PI * 2)
    ctx.fill()
  }
}
