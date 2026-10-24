import type { Preview } from '../types'

/** A card tilting right, its LIKE stamp fading in, then flying off with a velocity arrow; loops every 3.2 s. */
export const preview: Preview = () => ({ ctx, width, height, t, color }) => {
  const phase = (t + 1.1) % 3.2
  const w = Math.min(120, width * 0.36)
  const h = w * 1.3
  const cx = width / 2
  const cy = height / 2 + 4
  // Drag out slowly for 1.4 s, then throw.
  const drag = Math.min(phase, 1.4) / 1.4
  const thrown = Math.max(0, phase - 1.4)
  const dx = drag * w * 0.55 + thrown * thrown * 900
  const dy = -drag * 6 - thrown * 60
  const deg = (dx / w) * 10

  // The next card waiting underneath.
  ctx.fillStyle = color('--chip')
  ctx.beginPath()
  ctx.roundRect(cx - w / 2 + 6, cy - h / 2 + 10, w - 12, h, 14)
  ctx.fill()

  ctx.save()
  ctx.translate(cx + dx, cy + dy)
  ctx.rotate((deg * Math.PI) / 180)
  const gradient = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2)
  gradient.addColorStop(0, color('--cat'))
  gradient.addColorStop(1, color('--cat-math'))
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.roundRect(-w / 2, -h / 2, w, h, 14)
  ctx.fill()
  ctx.fillStyle = color('--surface')
  ctx.fillRect(-w / 2, h * 0.22, w, h * 0.28)
  ctx.globalAlpha = Math.min(1, drag * 1.3)
  ctx.strokeStyle = '#2fb344'
  ctx.lineWidth = 3
  ctx.rotate(-0.25)
  ctx.strokeRect(-w * 0.42, -h * 0.36, w * 0.5, 22)
  ctx.fillStyle = '#2fb344'
  ctx.font = '800 15px ui-sans-serif, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('LIKE', -w * 0.17, -h * 0.36 + 12)
  ctx.restore()

  // Velocity arrow while being dragged and thrown.
  const speed = phase < 1.4 ? 30 : 30 + thrown * 260
  ctx.strokeStyle = phase < 1.4 ? color('--muted') : color('--cat-generative')
  ctx.fillStyle = ctx.strokeStyle
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  const x0 = cx + dx
  const y0 = cy + dy
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.lineTo(x0 + speed, y0 - speed * 0.05)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x0 + speed + 6, y0 - speed * 0.05)
  ctx.lineTo(x0 + speed - 4, y0 - speed * 0.05 - 6)
  ctx.lineTo(x0 + speed - 4, y0 - speed * 0.05 + 6)
  ctx.fill()
}
