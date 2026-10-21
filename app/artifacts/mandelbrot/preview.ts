import type { Preview } from '../types'
import { colorOf, escape, HOME, spots } from './mandel'

const START_ZOOM = 80

/** A slow CPU zoom into Seahorse Valley, at low resolution. */
export const preview: Preview = () => {
  const target = spots.find((s) => s.name === 'Seahorse Valley')!.view
  const W = 140
  const H = 90
  const off = document.createElement('canvas')
  off.width = W
  off.height = H
  const offCtx = off.getContext('2d')!
  const image = offCtx.createImageData(W, H)
  return ({ ctx, width, height, t }) => {
    // Zoom from ×80 to the spot's depth over 12 s, then start over. Starting at ×80 keeps the
    // set's black body from filling the frame; the seahorses are the interesting part.
    const p = (t % 12) / 12
    const deepest = HOME.scale / target.scale
    const zoom = START_ZOOM * (deepest / START_ZOOM) ** p
    const span = 3.4 / zoom / W // complex units per preview pixel
    const { cx, cy } = target
    const iterations = Math.round(60 + 40 * Math.log10(zoom))
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const [r, g, b] = colorOf(escape(cx + (x - W / 2) * span, cy - (y - H / 2) * span, iterations), 0)
        const i = (y * W + x) * 4
        image.data[i] = r * 255
        image.data[i + 1] = g * 255
        image.data[i + 2] = b * 255
        image.data[i + 3] = 255
      }
    }
    offCtx.putImageData(image, 0, 0)
    const scale = Math.max(width / W, height / H)
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(off, (width - W * scale) / 2, (height - H * scale) / 2, W * scale, H * scale)
  }
}
