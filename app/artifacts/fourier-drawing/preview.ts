import type { Preview } from '../types'
import { dft, epicycles, normalize, resample, shapes, type Point } from './fourier'

/** Fourteen spinning arrows tracing the heart. */
export const preview: Preview = () => {
  const samples = resample(normalize(shapes.find((s) => s.name === 'Heart')!.points), 128)
  const terms = dft(samples)
  const count = 14
  const trace: Point[] = Array.from({ length: 200 }, (_, i) => {
    const j = epicycles(terms, count, i / 200)
    return j[j.length - 1]
  })
  return ({ ctx, width, height, t, color }) => {
    const scale = Math.min(width, height) * 0.42
    const cx = width / 2
    const cy = height / 2
    const phase = (t * 0.12) % 1
    const upTo = Math.floor(phase * trace.length)
    ctx.strokeStyle = color('--cat')
    ctx.lineWidth = 2.5
    ctx.lineJoin = 'round'
    ctx.beginPath()
    for (let i = 0; i <= upTo; i++) {
      const [x, y] = trace[i]
      if (i) ctx.lineTo(cx + x * scale, cy + y * scale)
      else ctx.moveTo(cx + x * scale, cy + y * scale)
    }
    ctx.stroke()
    const joints = epicycles(terms, count, phase)
    ctx.strokeStyle = color('--muted')
    ctx.lineWidth = 1
    ctx.globalAlpha = 0.45
    for (let i = 1; i < joints.length; i++) {
      ctx.beginPath()
      ctx.arc(cx + joints[i - 1][0] * scale, cy + joints[i - 1][1] * scale, terms[i - 1].amp * scale, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
    ctx.strokeStyle = color('--text')
    ctx.beginPath()
    joints.forEach(([x, y], i) => (i ? ctx.lineTo(cx + x * scale, cy + y * scale) : ctx.moveTo(cx + x * scale, cy + y * scale)))
    ctx.stroke()
  }
}
