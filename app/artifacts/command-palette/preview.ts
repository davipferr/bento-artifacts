import type { Preview } from '../types'
import { fuzzy } from './fuzzy'

const ITEMS = ['Toggle sidebar', 'Open Swipe Deck', 'Switch to dark mode', 'Change accent color', 'New note', 'Show word count']
const QUERIES = ['tsb', 'dark', 'acc']

/** A palette typing three queries in turn, with live ranking and highlighted letters. */
export const preview: Preview = () => ({ ctx, width, height, t, color }) => {
  const cycle = 3.4
  const which = Math.floor((t + 2) / cycle) % QUERIES.length
  const local = ((t + 2) % cycle) / cycle
  const full = QUERIES[which]
  const query = full.slice(0, Math.min(full.length, Math.floor(local * 9)))
  const ranked = ITEMS.map((text) => ({ text, m: fuzzy(query, text) }))
    .filter((r) => r.m)
    .sort((a, b) => b.m!.score - a.m!.score)
    .slice(0, 4)

  const w = Math.min(300, width - 32)
  const x = (width - w) / 2
  const row = 22
  const h = 34 + Math.max(1, ranked.length) * row + 8
  const y = Math.max(8, (height - h) / 2)
  ctx.fillStyle = color('--surface')
  ctx.strokeStyle = color('--border')
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, 10)
  ctx.fill()
  ctx.stroke()

  ctx.font = '13px ui-sans-serif, system-ui, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillStyle = query ? color('--text') : color('--muted')
  ctx.fillText(query ? `› ${query}` : '› Type a command…', x + 12, y + 17)
  if (Math.floor(t * 2.5) % 2 === 0) ctx.fillRect(x + 12 + ctx.measureText(`› ${query}`).width + 1, y + 10, 1.5, 14)
  ctx.strokeStyle = color('--border')
  ctx.beginPath()
  ctx.moveTo(x, y + 34)
  ctx.lineTo(x + w, y + 34)
  ctx.stroke()

  ranked.forEach(({ text, m }, i) => {
    const ry = y + 40 + i * row
    if (i === 0) {
      ctx.fillStyle = color('--chip')
      ctx.beginPath()
      ctx.roundRect(x + 5, ry, w - 10, row - 2, 6)
      ctx.fill()
      ctx.fillStyle = color('--cat')
      ctx.fillRect(x + 5, ry + 3, 2.5, row - 8)
    }
    const hits = new Set(m!.indices)
    let cx = x + 16
    for (let c = 0; c < text.length; c++) {
      const hit = hits.has(c)
      ctx.font = `${hit ? '700 ' : ''}12.5px ui-sans-serif, system-ui, sans-serif`
      ctx.fillStyle = hit ? color('--cat') : color('--text')
      ctx.fillText(text[c], cx, ry + row / 2)
      cx += ctx.measureText(text[c]).width
    }
  })
}
