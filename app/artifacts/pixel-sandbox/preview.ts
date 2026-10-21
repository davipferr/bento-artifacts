import { mulberry32 } from '../../kit/random'
import type { Preview } from '../types'
import { count, createWorld, EMPTY, materials, OIL, SAND, set, update, WALL, WATER, type World } from './sand'

const W = 80
const H = 44
const colorOf = new Map(materials.map((m) => [m.id, m.color]))

/** Sand, water and oil pouring onto a ledge; the world resets once it fills up. */
export const preview: Preview = () => {
  const random = mulberry32(31)
  const fresh = () => {
    const w = createWorld(W, H)
    for (let x = 18; x < 44; x++) set(w, x, 26, WALL, random)
    return w
  }
  let world: World = fresh()
  const pour = () => {
    for (const [x, m] of [[24, SAND], [40, WATER], [58, OIL]] as const) {
      if (random() < 0.7) set(world, x + Math.floor(random() * 3) - 1, 0, m, random)
    }
    update(world, random)
  }
  for (let i = 0; i < 260; i++) pour()
  const off = document.createElement('canvas')
  off.width = W
  off.height = H
  const offCtx = off.getContext('2d')!
  const image = offCtx.createImageData(W, H)
  let lastT = -1
  return ({ ctx, width, height, t }) => {
    if (lastT >= 0 && t > lastT) {
      pour()
      pour()
      const filled = [...count(world).values()].reduce((a, b) => a + b, 0)
      if (filled > W * H * 0.55) world = fresh()
    }
    lastT = t
    world.cell.forEach((m, i) => {
      const [r, g, b] = m === EMPTY ? [13, 15, 20] : colorOf.get(m)!
      const k = m === EMPTY ? 1 : 0.88 + (world.shade[i] / 255) * 0.24
      image.data[i * 4] = r * k
      image.data[i * 4 + 1] = g * k
      image.data[i * 4 + 2] = b * k
      image.data[i * 4 + 3] = 255
    })
    offCtx.putImageData(image, 0, 0)
    ctx.imageSmoothingEnabled = false
    const scale = Math.max(width / W, height / H)
    ctx.drawImage(off, (width - W * scale) / 2, (height - H * scale) / 2, W * scale, H * scale)
  }
}
