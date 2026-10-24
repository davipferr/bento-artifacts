import type { Preview } from '../types'

/** A bell whose badge counts up, ringing on each new notification; loops every 6 s. */
export const preview: Preview = () => ({ ctx, width, height, t, color }) => {
  const phase = (t + 0.6) % 6
  const count = Math.min(5, Math.floor(phase / 1.1) + 1)
  const since = phase - (count - 1) * 1.1
  const swing = since < 0.7 ? Math.sin(since * 28) * 0.35 * (1 - since / 0.7) : 0
  const s = Math.min(width, height) / 160
  const cx = width / 2
  const cy = height / 2 - 4

  ctx.save()
  ctx.translate(cx, cy - 34 * s)
  ctx.rotate(swing)
  ctx.translate(0, 34 * s)
  ctx.fillStyle = color('--cat')
  ctx.beginPath()
  // Bell body: a rounded dome flaring out at the bottom.
  ctx.moveTo(-30 * s, 18 * s)
  ctx.quadraticCurveTo(-24 * s, 8 * s, -24 * s, -6 * s)
  ctx.quadraticCurveTo(-24 * s, -34 * s, 0, -34 * s)
  ctx.quadraticCurveTo(24 * s, -34 * s, 24 * s, -6 * s)
  ctx.quadraticCurveTo(24 * s, 8 * s, 30 * s, 18 * s)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.arc(0, 24 * s, 7 * s, 0, Math.PI)
  ctx.fill()
  ctx.restore()

  // Badge, popping on each increment.
  const pop = since < 0.35 ? 1 + Math.sin((since / 0.35) * Math.PI) * 0.35 : 1
  const bx = cx + 22 * s
  const by = cy - 30 * s
  ctx.fillStyle = '#f03e3e'
  ctx.beginPath()
  ctx.arc(bx, by, 13 * s * pop, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = color('--surface')
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.fillStyle = '#fff'
  ctx.font = `700 ${Math.round(14 * s * pop)}px ui-sans-serif, system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(count), bx, by + 1)

  // Sound lines while ringing.
  if (since < 0.7) {
    ctx.strokeStyle = color('--muted')
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.arc(cx, cy - 6 * s, 44 * s, side < 0 ? Math.PI * 0.85 : -Math.PI * 0.15, side < 0 ? Math.PI * 1.15 : Math.PI * 0.15)
      ctx.stroke()
    }
  }
}
