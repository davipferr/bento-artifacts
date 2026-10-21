import type { Preview } from '../types'

/** A hand-drawn mini railroad for /a(b|cd)+$/ with a train running along it. */
export const preview: Preview = () => ({ ctx, width, height, t, color }) => {
  const y = height / 2 - 4
  const left = width * 0.08
  const right = width * 0.92
  const box = (x: number, yy: number, label: string, round: boolean) => {
    const w = 12 + label.length * 9
    ctx.fillStyle = color('--surface')
    ctx.strokeStyle = color('--cat')
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(x - w / 2, yy - 11, w, 22, round ? 11 : 4)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = color('--text')
    ctx.font = '13px ui-monospace, Menlo, Consolas, monospace'
    ctx.textAlign = 'center'
    ctx.fillText(label, x, yy + 4.5)
  }
  const x1 = left + (right - left) * 0.2
  const x2 = left + (right - left) * 0.55
  const x3 = left + (right - left) * 0.86

  ctx.strokeStyle = color('--muted')
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(left, y)
  ctx.lineTo(right, y)
  // Alternative branch (cd) under the main track.
  ctx.moveTo(x2 - 50, y)
  ctx.quadraticCurveTo(x2 - 40, y, x2 - 40, y + 14)
  ctx.lineTo(x2 - 40, y + 22)
  ctx.quadraticCurveTo(x2 - 40, y + 32, x2 - 30, y + 32)
  ctx.lineTo(x2 + 30, y + 32)
  ctx.quadraticCurveTo(x2 + 40, y + 32, x2 + 40, y + 22)
  ctx.lineTo(x2 + 40, y + 14)
  ctx.quadraticCurveTo(x2 + 40, y, x2 + 50, y)
  // Repeat loop above.
  ctx.moveTo(x2 + 58, y)
  ctx.quadraticCurveTo(x2 + 66, y, x2 + 66, y - 12)
  ctx.lineTo(x2 + 66, y - 24)
  ctx.quadraticCurveTo(x2 + 66, y - 34, x2 + 56, y - 34)
  ctx.lineTo(x2 - 56, y - 34)
  ctx.quadraticCurveTo(x2 - 66, y - 34, x2 - 66, y - 24)
  ctx.lineTo(x2 - 66, y - 12)
  ctx.quadraticCurveTo(x2 - 66, y, x2 - 58, y)
  ctx.stroke()
  ctx.fillStyle = color('--muted')
  ctx.beginPath()
  ctx.arc(left, y, 4, 0, Math.PI * 2)
  ctx.arc(right, y, 4, 0, Math.PI * 2)
  ctx.fill()

  box(x1, y, 'a', true)
  box(x2, y, 'b', true)
  box(x2, y + 32, 'cd', true)
  box(x3, y, 'end', false)

  const p = (t * 0.35) % 1
  ctx.fillStyle = color('--compare')
  ctx.beginPath()
  ctx.arc(left + (right - left) * p, y, 5, 0, Math.PI * 2)
  ctx.fill()
}
