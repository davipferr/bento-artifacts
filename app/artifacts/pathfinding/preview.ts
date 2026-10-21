import { mulberry32 } from '../../kit/random'
import type { Preview } from '../types'
import { algorithms, maze, WALL, type SearchResult } from './search'

/** A* exploring a small maze, then its path. */
export const preview: Preview = () => {
  const grid = maze(31, 15, mulberry32(7))
  const visits: number[] = []
  const gen = algorithms.find((a) => a.id === 'astar')!.search(grid)
  let result: SearchResult
  for (;;) {
    const step = gen.next()
    if (step.done) {
      result = step.value
      break
    }
    if (step.value.kind === 'visit') visits.push(step.value.cell)
  }
  const hold = 50
  return ({ ctx, width, height, t, color }) => {
    const s = Math.min(width / grid.cols, height / grid.rows)
    const ox = (width - s * grid.cols) / 2
    const oy = (height - s * grid.rows) / 2
    const k = Math.floor(t * 40) % (visits.length + hold)
    const at = (i: number): [number, number] => [ox + (i % grid.cols) * s, oy + Math.floor(i / grid.cols) * s]
    ctx.fillStyle = color('--muted')
    ctx.globalAlpha = 0.55
    grid.cells.forEach((c, i) => {
      if (c !== WALL) return
      const [x, y] = at(i)
      ctx.fillRect(x, y, s + 0.5, s + 0.5)
    })
    ctx.globalAlpha = 0.3
    ctx.fillStyle = color('--cat')
    for (let n = 0; n < Math.min(k, visits.length); n++) {
      const [x, y] = at(visits[n])
      ctx.fillRect(x, y, s + 0.5, s + 0.5)
    }
    ctx.globalAlpha = 1
    if (k >= visits.length && result.path) {
      ctx.strokeStyle = color('--compare')
      ctx.lineWidth = Math.max(2, s * 0.35)
      ctx.lineJoin = 'round'
      ctx.beginPath()
      result.path.forEach((cell, n) => {
        const [x, y] = at(cell)
        if (n) ctx.lineTo(x + s / 2, y + s / 2)
        else ctx.moveTo(x + s / 2, y + s / 2)
      })
      ctx.stroke()
    }
  }
}
