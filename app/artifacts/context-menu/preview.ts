import type { Preview } from '../types'

/** A pointer travelling diagonally from "Share" into its submenu inside the safe triangle. */
export const preview: Preview = () => ({ ctx, width, height, t, color }) => {
  const row = Math.min(22, (height - 30) / 7)
  const w = Math.min(130, width * 0.36)
  const x0 = Math.max(10, width / 2 - w - 10)
  const y0 = (height - row * 6) / 2
  const items = ['Open', 'Open with', 'Share', 'Copy', 'Duplicate', 'Rename']
  const sx = x0 + w - 2
  const sy = y0 + row * 1.5
  const subItems = ['Copy link', 'Email', 'Messages', 'Notes', 'More…']
  const k = ((t + 0.5) % 3) / 3
  const ax = x0 + w * 0.45
  const ay = y0 + row * 2.5
  // The pointer: from the parent item, diagonally down into the submenu.
  const px = ax + (sx + 30 - ax) * Math.min(1, k * 1.4)
  const py = ay + (sy + row * 3.6 - ay) * Math.min(1, k * 1.4)

  const panel = (x: number, y: number, labels: string[], active: number) => {
    ctx.fillStyle = color('--surface')
    ctx.strokeStyle = color('--border')
    ctx.beginPath()
    ctx.roundRect(x, y, w, labels.length * row + 8, 8)
    ctx.fill()
    ctx.stroke()
    labels.forEach((label, i) => {
      if (i === active) {
        ctx.fillStyle = color('--cat')
        ctx.beginPath()
        ctx.roundRect(x + 4, y + 4 + i * row, w - 8, row, 5)
        ctx.fill()
      }
      ctx.fillStyle = i === active ? color('--accent-text') : color('--text')
      ctx.font = '11.5px ui-sans-serif, system-ui, sans-serif'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, x + 12, y + 4 + i * row + row / 2)
    })
  }
  panel(x0, y0, items, 2)
  panel(sx, sy, subItems, py > sy + 4 && px > sx ? Math.min(4, Math.floor((py - sy - 4) / row)) : -1)

  // The safe triangle.
  ctx.fillStyle = color('--cat-generative')
  ctx.globalAlpha = 0.2
  ctx.beginPath()
  ctx.moveTo(ax, ay)
  ctx.lineTo(sx, sy)
  ctx.lineTo(sx, sy + subItems.length * row + 8)
  ctx.closePath()
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.strokeStyle = color('--cat-generative')
  ctx.setLineDash([4, 3])
  ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = color('--cat-generative')
  ctx.beginPath()
  ctx.arc(px, py, 4, 0, Math.PI * 2)
  ctx.fill()
}
