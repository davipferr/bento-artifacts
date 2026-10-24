import type { Preview } from '../types'
import { layout, SETS } from './breakpoints'

/** A page frame breathing between phone and desktop width while its card grid reflows. */
export const preview: Preview = () => ({ ctx, width, height, t, color }) => {
  const points = SETS.tailwind.points
  // Logical width sweeps 360 → 1400 → 360 every 8 s.
  const k = (1 - Math.cos(((t + 2) / 8) * Math.PI * 2)) / 2
  const logical = 360 + k * 1040
  const L = layout(logical, points)
  const maxW = width - 32
  const w = 70 + (maxW - 70) * k
  const h = height - 26
  const x = (width - w) / 2
  const y = 12

  ctx.fillStyle = color('--surface')
  ctx.strokeStyle = color('--border')
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, 8)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = color('--chip')
  ctx.fillRect(x + 1, y + 1, w - 2, 12)

  const pad = 6
  const inner = w - pad * 2
  let top = y + 20
  // Header: logo + links or a menu button.
  ctx.fillStyle = color('--cat')
  ctx.fillRect(x + pad, top, 18, 6)
  ctx.fillStyle = color('--muted')
  if (L.menuButton) ctx.fillRect(x + w - pad - 10, top, 10, 6)
  else for (let i = 0; i < 4; i++) ctx.fillRect(x + w - pad - (i + 1) * 22, top, 16, 6)
  top += 14

  // Hero: stacked or split.
  ctx.fillStyle = color('--cat')
  ctx.globalAlpha = 0.25
  if (L.heroSplit) {
    ctx.fillRect(x + pad, top, inner / 2 - 3, 26)
    ctx.globalAlpha = 0.5
    ctx.fillRect(x + pad + inner / 2 + 3, top, inner / 2 - 3, 26)
  } else ctx.fillRect(x + pad, top, inner, 26)
  ctx.globalAlpha = 1
  top += 32

  // Sidebar + cards.
  let cx = x + pad
  let cw = inner
  if (L.sidebar) {
    ctx.fillStyle = color('--chip')
    ctx.fillRect(cx, top, inner * 0.18, h - (top - y) - 8)
    cx += inner * 0.18 + 5
    cw -= inner * 0.18 + 5
  }
  const gap = 4
  const col = (cw - gap * (L.columns - 1)) / L.columns
  const rowH = 18
  for (let i = 0; top + Math.floor(i / L.columns) * (rowH + gap) + rowH < y + h - 6; i++) {
    const r = Math.floor(i / L.columns)
    const c = i % L.columns
    ctx.fillStyle = color(['--cat-math', '--cat-sound', '--cat-generative', '--cat-tools'][i % 4])
    ctx.globalAlpha = 0.55
    ctx.beginPath()
    ctx.roundRect(cx + c * (col + gap), top + r * (rowH + gap), col, rowH, 3)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  ctx.fillStyle = color('--text')
  ctx.font = '600 11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
  ctx.textAlign = 'center'
  ctx.fillText(`${Math.round(logical)}px`, width / 2, y + h + 11)
}
