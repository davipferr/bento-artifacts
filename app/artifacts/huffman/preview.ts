import type { Preview } from '../types'
import { build, layout, show } from './huffman'

/** The "hello world" tree building itself, one merge per second, then holding. */
export const preview: Preview = () => {
  const { steps } = build('hello world')
  return ({ ctx, width, height, t, color }) => {
    // Offset so the still frame (t = 2.5) shows the finished tree.
    const at = Math.min(steps.length - 1, Math.floor((t + 2) % (steps.length + 3)))
    const placed = layout(steps[at])
    const maxX = Math.max(...placed.map((p) => p.x))
    const slot = Math.min(44, (width - 40) / (maxX + 1))
    const row = Math.min(40, (height - 30) / 4.5)
    const x0 = (width - maxX * slot) / 2
    const x = (px: number) => x0 + px * slot
    const y = (depth: number) => 18 + depth * row
    ctx.strokeStyle = color('--muted')
    ctx.lineWidth = 1.5
    for (const p of placed) {
      if (!p.parent) continue
      ctx.beginPath()
      ctx.moveTo(x(p.parent.x), y(p.parent.depth))
      ctx.lineTo(x(p.x), y(p.depth))
      ctx.stroke()
    }
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = '600 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
    for (const p of placed) {
      const leaf = p.node.symbol !== undefined
      ctx.fillStyle = leaf ? color('--cat-algorithms') : color('--surface')
      ctx.strokeStyle = color('--cat-algorithms')
      ctx.beginPath()
      ctx.arc(x(p.x), y(p.depth), 11, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = leaf ? color('--accent-text') : color('--text')
      ctx.fillText(leaf ? show(p.node.symbol!) : String(p.node.weight), x(p.x), y(p.depth) + 0.5)
    }
  }
}
