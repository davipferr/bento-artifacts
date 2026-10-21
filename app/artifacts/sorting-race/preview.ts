import { mulberry32 } from '../../kit/random'
import type { Preview } from '../types'
import { algorithms, makeArray, type Op } from './algorithms'

/** Insertion sort replayed from recorded snapshots, then a pause on the sorted bars. */
export const preview: Preview = () => {
  const values = makeArray(28, 'random', mulberry32(4))
  const frames: { values: number[]; op: Op }[] = []
  for (const op of algorithms.find((a) => a.id === 'insertion')!.sort(values)) frames.push({ values: [...values], op })
  const hold = 60
  return ({ ctx, width, height, t, color }) => {
    const k = Math.floor(t * 70) % (frames.length + hold)
    const done = k >= frames.length
    const { values: v, op } = frames[Math.min(k, frames.length - 1)]
    const bw = width / v.length
    v.forEach((value, i) => {
      const hot = !done && (op.i === i || (op.kind !== 'write' && op.j === i))
      ctx.fillStyle = done ? color('--done') : hot ? color('--cat') : color('--bar')
      const h = (value / v.length) * (height - 16)
      ctx.fillRect(i * bw + 1, height - h, bw - 2, h)
    })
  }
}
