import type { Preview } from '../types'

/** main and a feature branch growing commit by commit, then merging; loops every ~8 s. */
const STEPS = [
  { col: 0, lane: 0 },
  { col: 1, lane: 0 },
  { col: 2, lane: 1, from: 1 },
  { col: 3, lane: 1, from: 2 },
  { col: 2, lane: 0, from: 1 },
  { col: 3, lane: 0, from: 4 },
  { col: 4, lane: 0, from: 5, merge: 3 },
] as const

export const preview: Preview = () => ({ ctx, width, height, t, color }) => {
  const shown = Math.min(STEPS.length, Math.floor(((t + 4) % 9) * 1.1))
  const dx = Math.min(64, (width - 60) / 4)
  const dy = Math.min(56, (height - 40) / 2)
  const x0 = (width - dx * 4) / 2
  const y0 = (height - dy) / 2 + 6
  const pos = (i: number) => ({ x: x0 + STEPS[i].col * dx, y: y0 + STEPS[i].lane * dy })
  const lane = (l: number) => color(l === 0 ? '--cat-ui' : '--cat-sound') || color('--cat')
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  const edge = (a: number, b: number) => {
    const p = pos(a)
    const c = pos(b)
    ctx.strokeStyle = lane(Math.max(STEPS[a].lane, STEPS[b].lane))
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    ctx.bezierCurveTo(p.x + dx / 2, p.y, c.x - dx / 2, c.y, c.x, c.y)
    ctx.stroke()
  }
  for (let i = 1; i < shown; i++) {
    const step = STEPS[i]
    edge('from' in step ? step.from : i - 1, i)
    if ('merge' in step) edge(step.merge, i)
  }
  for (let i = 0; i < shown; i++) {
    const p = pos(i)
    ctx.fillStyle = lane(STEPS[i].lane)
    ctx.beginPath()
    ctx.arc(p.x, p.y, 9, 0, Math.PI * 2)
    ctx.fill()
  }
  // Branch labels ride on the newest commit of each lane.
  ctx.font = '600 11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const [name, l] of [['main', 0], ['feature', 1]] as const) {
    let last = -1
    for (let i = 0; i < shown; i++) if (STEPS[i].lane === l) last = i
    if (l === 1 && shown > 6) last = 3
    if (last < 0) continue
    const p = pos(last)
    const w = name.length * 7 + 12
    const y = l === 0 ? p.y - 24 : p.y + 24
    ctx.fillStyle = lane(l)
    ctx.beginPath()
    ctx.roundRect(p.x - w / 2, y - 9, w, 18, 9)
    ctx.fill()
    ctx.fillStyle = color('--accent-text')
    ctx.fillText(name, p.x, y + 0.5)
  }
}
