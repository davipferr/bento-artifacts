import type { Preview } from '../types'
import { chunkSizes } from './chunk'

const DIGITS = '4821390756'

/** A ten-digit string sliding apart into chunks and back together. */
export const preview: Preview = () => ({ ctx, width, height, t, color }) => {
  const split = (1 - Math.cos(t * 1.3)) / 2
  const size = Math.min(30, width / 13)
  ctx.font = `bold ${size}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const sizes = chunkSizes(DIGITS.length)
  const charW = size * 0.62
  const gap = charW * 1.2 * split
  const total = DIGITS.length * charW + gap * (sizes.length - 1)
  let x = (width - total) / 2 + charW / 2
  let group = 0
  let inGroup = 0
  for (const c of DIGITS) {
    ctx.fillStyle = group % 2 && split > 0.5 ? color('--cat-ui') : color('--text')
    ctx.fillText(c, x, height / 2)
    x += charW
    if (++inGroup === sizes[group]) {
      group++
      inGroup = 0
      x += gap
    }
  }
  ctx.font = '11px ui-sans-serif, system-ui, sans-serif'
  ctx.fillStyle = color('--muted')
  ctx.fillText(split > 0.5 ? `${sizes.length} chunks` : `${DIGITS.length} items`, width / 2, height / 2 + size)
}
