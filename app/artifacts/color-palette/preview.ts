import type { Preview } from '../types'
import { hex } from './color'

/** A ring of OKLCH swatches at even lightness, slowly turning through the hues. */
export const preview: Preview = () => ({ ctx, width, height, t }) => {
  const n = 12
  const cx = width / 2
  const cy = height / 2
  const ring = Math.min(width, height) / 2 - 22
  const r = Math.min(20, ring * 0.28)
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2
    ctx.fillStyle = hex({ l: 0.7, c: 0.15, h: (i * 30 + t * 25) % 360 })
    ctx.beginPath()
    ctx.arc(cx + Math.cos(a) * ring, cy + Math.sin(a) * ring, r, 0, Math.PI * 2)
    ctx.fill()
  }
  // The centre swatch, with its triadic partners as a three-colour stripe.
  for (let k = 0; k < 3; k++) {
    ctx.fillStyle = hex({ l: 0.62, c: 0.16, h: (t * 25 + k * 120) % 360 })
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, ring * 0.55, (k * 2 * Math.PI) / 3 - Math.PI / 2, ((k + 1) * 2 * Math.PI) / 3 - Math.PI / 2)
    ctx.closePath()
    ctx.fill()
  }
}
