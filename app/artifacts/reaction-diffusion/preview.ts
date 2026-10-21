import { mulberry32 } from '../../kit/random'
import type { Preview } from '../types'
import { emptyField, presets, stamp, step, type Field } from './grayscott'

const W = 72
const H = 40
const STOPS = [
  [6, 20, 31],
  [14, 58, 83],
  [31, 122, 140],
  [143, 211, 232],
  [241, 251, 255],
]

/** A small CPU Gray–Scott field in the coral regime, warmed up so it looks alive at once. */
export const preview: Preview = () => {
  const { feed, kill } = presets.find((p) => p.name === 'Coral')!
  const random = mulberry32(5)
  let field: Field = emptyField(W, H)
  for (let i = 0; i < 14; i++) stamp(field, random() * W, random() * H, 2)
  for (let i = 0; i < 900; i++) field = step(field, feed, kill)
  const off = document.createElement('canvas')
  off.width = W
  off.height = H
  const offCtx = off.getContext('2d')!
  const image = offCtx.createImageData(W, H)
  let lastT = -1
  return ({ ctx, width, height, t }) => {
    if (lastT >= 0 && t > lastT) for (let i = 0; i < 8; i++) field = step(field, feed, kill)
    lastT = t
    for (let i = 0; i < field.a.length; i++) {
      const v = Math.min(1, Math.max(0, 1 - (field.a[i] - field.b[i]))) * 4
      const k = Math.min(3, Math.floor(v))
      const u = v - k
      for (let c = 0; c < 3; c++) image.data[i * 4 + c] = STOPS[k][c] + (STOPS[k + 1][c] - STOPS[k][c]) * u
      image.data[i * 4 + 3] = 255
    }
    offCtx.putImageData(image, 0, 0)
    ctx.imageSmoothingEnabled = true
    // Cover the tile, cropping the field's edges if the aspect differs.
    const scale = Math.max(width / W, height / H)
    ctx.drawImage(off, (width - W * scale) / 2, (height - H * scale) / 2, W * scale, H * scale)
  }
}
