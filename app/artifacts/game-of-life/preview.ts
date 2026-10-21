import type { Preview } from '../types'
import { key, parseRle, parseRule, patterns, step, unkey } from './life'

/** The Gosper glider gun firing, 12 generations a second; restarts after 240. */
export const preview: Preview = () => {
  const rule = parseRule('B3/S23')!
  const start = () => new Set(parseRle(patterns.find((p) => p.name === 'Gosper glider gun')!.rle).map(([x, y]) => key(x + 1, y + 1)))
  let cells = start()
  let generation = 0
  return ({ ctx, width, height, t, color }) => {
    const target = Math.floor(t * 12) % 240
    if (target < generation) {
      cells = start()
      generation = 0
    }
    while (generation < target) {
      cells = step(cells, rule)
      generation++
    }
    const cols = 48
    const s = width / cols
    const oy = (height - s * Math.ceil(height / s)) / 2
    ctx.fillStyle = color('--cat')
    for (const k of cells) {
      const [x, y] = unkey(k)
      if (x < 0 || x >= cols || y < 0 || y * s > height) continue
      ctx.fillRect(x * s + 0.5, oy + y * s + 0.5, s - 1, s - 1)
    }
  }
}
