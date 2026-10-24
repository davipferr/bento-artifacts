import type { Preview } from '../types'
import { item } from './feed'

/** Left: an endless list scrolling by. Right: a pager stepping through pages. */
export const preview: Preview = () => ({ ctx, width, height, t, color }) => {
  const colW = Math.min(150, (width - 48) / 2)
  const gap = 16
  const x1 = (width - colW * 2 - gap) / 2
  const x2 = x1 + colW + gap
  const top = 12
  const row = Math.min(20, (height - 60) / 5)
  const h = row * 5
  ctx.font = '10.5px ui-sans-serif, system-ui, sans-serif'
  ctx.textBaseline = 'middle'

  const drawRow = (x: number, y: number, id: number) => {
    const it = item(id)
    ctx.fillStyle = `hsl(${it.hue} 60% 60%)`
    ctx.fillRect(x + 4, y + 3, row - 6, row - 6)
    ctx.fillStyle = color('--text')
    ctx.textAlign = 'left'
    ctx.fillText(`#${it.id}`, x + row + 4, y + row / 2)
  }

  // Infinite: rows slide up forever.
  ctx.save()
  ctx.beginPath()
  ctx.rect(x1, top, colW, h + row)
  ctx.clip()
  const offset = (t * 30) % row
  const first = Math.floor((t * 30) / row)
  for (let i = 0; i < 7; i++) drawRow(x1, top + i * row - offset, first + i + 1)
  ctx.restore()
  ctx.fillStyle = color('--muted')
  ctx.textAlign = 'center'
  ctx.font = '700 15px ui-sans-serif, system-ui, sans-serif'
  ctx.fillText('∞', x1 + colW / 2, top + h + row + 14)

  // Pagination: a page of five, then the pager.
  ctx.font = '10.5px ui-sans-serif, system-ui, sans-serif'
  const page = (Math.floor(t / 1.2) % 5) + 6
  for (let i = 0; i < 5; i++) drawRow(x2, top + i * row, (page - 1) * 10 + i + 1)
  const labels = ['‹', String(page - 1), String(page), String(page + 1), '›']
  const by = top + h + 8
  labels.forEach((label, i) => {
    const bx = x2 + i * (colW / 5)
    if (i === 2) {
      ctx.fillStyle = color('--cat')
      ctx.beginPath()
      ctx.roundRect(bx + 2, by, colW / 5 - 4, 18, 4)
      ctx.fill()
    }
    ctx.fillStyle = i === 2 ? color('--accent-text') : color('--muted')
    ctx.textAlign = 'center'
    ctx.fillText(label, bx + colW / 10, by + 9)
  })
}
