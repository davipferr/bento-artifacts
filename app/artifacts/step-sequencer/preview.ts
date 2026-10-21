import type { Preview } from '../types'
import { fromStrings, presets, STEPS } from './pattern'

/** A drum grid with the playhead sweeping across at 120 BPM. */
export const preview: Preview = () => {
  const pattern = fromStrings(presets.find((p) => p.name === 'Funk')!.rows)
  const rows = [0, 1, 3, 4] // kick, snare, closed hat, open hat
  return ({ ctx, width, height, t, color }) => {
    const pad = 14
    const gap = 3
    const cw = (width - 2 * pad - gap * (STEPS - 1) - 9) / STEPS
    const ch = Math.min(cw, (height - 2 * pad - gap * (rows.length - 1)) / rows.length)
    const oy = (height - (ch * rows.length + gap * (rows.length - 1))) / 2
    const now = Math.floor(t * 8) % STEPS
    rows.forEach((track, r) => {
      for (let s = 0; s < STEPS; s++) {
        const x = pad + s * (cw + gap) + Math.floor(s / 4) * 3
        const y = oy + r * (ch + gap)
        const on = pattern[track][s]
        ctx.fillStyle = on ? color('--cat') : color('--chip')
        ctx.globalAlpha = on ? (s === now ? 1 : 0.75) : s === now ? 0.9 : 0.6
        ctx.beginPath()
        ctx.roundRect(x, y, cw, ch, 3)
        ctx.fill()
        if (s === now) {
          ctx.globalAlpha = 1
          ctx.strokeStyle = color('--text')
          ctx.lineWidth = 1.5
          ctx.stroke()
        }
      }
    })
    ctx.globalAlpha = 1
  }
}
