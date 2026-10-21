import type { Preview } from '../types'
import { MAJOR_LABELS } from './theory'

/** The circle of fifths with a key's three-chord family lighting up and moving round. */
export const preview: Preview = () => ({ ctx, width, height, t, color }) => {
  const cx = width / 2
  const cy = height / 2
  const r1 = Math.min(width, height) / 2 - 6
  const r0 = r1 * 0.58
  const key = Math.floor(t * 0.9) % 12
  for (let i = 0; i < 12; i++) {
    const a0 = ((i - 0.5) * 30 - 90) * (Math.PI / 180)
    const a1 = ((i + 0.5) * 30 - 90) * (Math.PI / 180)
    const d = Math.min((i - key + 12) % 12, (key - i + 12) % 12)
    ctx.fillStyle = color('--cat')
    ctx.globalAlpha = d === 0 ? 0.9 : d === 1 ? 0.45 : 0.12
    ctx.beginPath()
    ctx.arc(cx, cy, r1, a0, a1)
    ctx.arc(cx, cy, r0, a1, a0, true)
    ctx.closePath()
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.strokeStyle = color('--surface')
    ctx.lineWidth = 2
    ctx.stroke()
    const am = (i * 30 - 90) * (Math.PI / 180)
    ctx.fillStyle = color('--text')
    ctx.font = `600 ${Math.max(10, r1 * 0.17)}px ui-sans-serif, system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(MAJOR_LABELS[i], cx + Math.cos(am) * (r0 + r1) / 2, cy + Math.sin(am) * (r0 + r1) / 2 + 4)
  }
}
