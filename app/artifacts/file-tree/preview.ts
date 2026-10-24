import type { Preview } from '../types'

const ROWS = [
  { depth: 0, name: 'app', folder: true },
  { depth: 1, name: 'artifacts', folder: true },
  { depth: 1, name: 'kit', folder: true },
  { depth: 2, name: 'canvas.ts', tone: '#3b82f6', label: 'TS' },
  { depth: 2, name: 'Controls.tsx', tone: '#06b6d4', label: '⚛' },
  { depth: 1, name: 'App.tsx', tone: '#06b6d4', label: '⚛' },
  { depth: 0, name: 'README.md', tone: '#6b7280', label: 'M↓' },
  { depth: 0, name: 'package.json', tone: '#dc2626', label: 'npm' },
]

/** An explorer with a focus ring walking the rows and kit/ folding open and shut. */
export const preview: Preview = () => ({ ctx, width, height, t, color }) => {
  const kitOpen = Math.floor(t / 2.4) % 2 === 0
  const rows = ROWS.filter((r) => kitOpen || r.depth < 2)
  const row = Math.min(22, (height - 16) / ROWS.length)
  const x0 = Math.max(14, (width - 200) / 2)
  const y0 = (height - rows.length * row) / 2
  const focus = Math.floor(t * 1.6) % rows.length
  ctx.textBaseline = 'middle'
  rows.forEach((r, i) => {
    const y = y0 + i * row
    if (i === focus) {
      ctx.fillStyle = color('--cat')
      ctx.globalAlpha = 0.18
      ctx.fillRect(x0 - 8, y, Math.min(220, width - x0), row)
      ctx.globalAlpha = 1
      ctx.fillStyle = color('--cat')
      ctx.fillRect(x0 - 8, y, 2, row)
    }
    const x = x0 + r.depth * 14
    // Indent guides.
    ctx.strokeStyle = color('--border')
    for (let d = 0; d < r.depth; d++) {
      ctx.beginPath()
      ctx.moveTo(x0 + d * 14 + 4, y)
      ctx.lineTo(x0 + d * 14 + 4, y + row)
      ctx.stroke()
    }
    ctx.font = '12px ui-sans-serif, system-ui, sans-serif'
    if (r.folder) {
      const open = r.name !== 'kit' || kitOpen
      ctx.fillStyle = color('--muted')
      ctx.fillText(open && r.name !== 'artifacts' ? '⌄' : '›', x, y + row / 2)
      ctx.fillText(open && r.name !== 'artifacts' ? '📂' : '📁', x + 10, y + row / 2 + 1)
    } else {
      ctx.fillStyle = r.tone!
      ctx.globalAlpha = 0.16
      ctx.fillRect(x + 8, y + 4, 22, row - 8)
      ctx.globalAlpha = 1
      ctx.font = '700 9px ui-monospace, Menlo, Consolas, monospace'
      ctx.textAlign = 'center'
      ctx.fillText(r.label!, x + 19, y + row / 2 + 0.5)
      ctx.textAlign = 'left'
    }
    ctx.font = '12.5px ui-sans-serif, system-ui, sans-serif'
    ctx.fillStyle = color('--text')
    ctx.fillText(r.name, x + 36, y + row / 2 + 0.5)
  })
}
