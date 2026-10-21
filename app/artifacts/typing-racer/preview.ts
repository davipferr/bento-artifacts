import type { Preview } from '../types'
import { passages } from './typing'

/** A line being typed, with a cursor, one slip and the ghost marker a little ahead. */
export const preview: Preview = () => {
  const text = passages[0].body.slice(0, 66)
  return ({ ctx, width, height, t, color }) => {
    const size = Math.max(12, Math.min(18, width / 22))
    ctx.font = `${size}px ui-monospace, Menlo, Consolas, monospace`
    const charW = ctx.measureText('m').width
    const perLine = Math.max(8, Math.floor((width - 28) / charW))
    const lines = Math.ceil(text.length / perLine)
    const lineH = size * 1.6
    const oy = (height - lines * lineH) / 2 + size
    const typed = Math.floor(t * 11) % (text.length + 14)
    const ghost = Math.min(text.length, typed + 4)
    for (let i = 0; i < text.length; i++) {
      const x = 14 + (i % perLine) * charW
      const y = oy + Math.floor(i / perLine) * lineH
      if (i === 17 && typed > 17 && typed < 24) {
        ctx.fillStyle = color('--cat-games')
        ctx.fillRect(x, y - size, charW, size * 1.25)
      }
      if (i === ghost) {
        ctx.strokeStyle = color('--cat-sound')
        ctx.lineWidth = 1.5
        ctx.strokeRect(x, y - size, charW, size * 1.25)
      }
      ctx.fillStyle = i < typed ? color('--text') : color('--muted')
      ctx.globalAlpha = i < typed ? 1 : 0.6
      ctx.fillText(text[i], x, y)
      ctx.globalAlpha = 1
      if (i === typed) {
        ctx.fillStyle = color('--cat')
        ctx.fillRect(x - 1, y - size, 2, size * 1.25)
      }
    }
  }
}
