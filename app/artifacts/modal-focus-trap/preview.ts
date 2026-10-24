import type { Preview } from '../types'

/** A dialog over a dimmed page, with focus hopping round its four controls and wrapping back. */
export const preview: Preview = () => ({ ctx, width, height, t, color }) => {
  const cat = color('--cat-ui')
  ctx.fillStyle = color('--grid')
  for (let i = 0; i < 4; i++) ctx.fillRect(16, 18 + i * 22, width * (0.5 - i * 0.07), 9)

  ctx.fillStyle = 'rgba(0,0,0,0.18)'
  ctx.fillRect(0, 0, width, height)

  const w = Math.min(220, width - 40)
  const h = Math.min(130, height - 30)
  const x = (width - w) / 2
  const y = (height - h) / 2
  ctx.fillStyle = color('--surface')
  ctx.strokeStyle = color('--border')
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, 10)
  ctx.fill()
  ctx.stroke()

  const controls = [
    { x: x + 14, y: y + 30, w: w - 28, h: 18 },
    { x: x + 14, y: y + 58, w: w - 28, h: 18 },
    { x: x + w - 134, y: y + h - 32, w: 56, h: 20 },
    { x: x + w - 70, y: y + h - 32, w: 56, h: 20 },
  ]
  const at = Math.floor(t * 1.4) % controls.length
  controls.forEach((c, i) => {
    ctx.fillStyle = color('--chip')
    ctx.beginPath()
    ctx.roundRect(c.x, c.y, c.w, c.h, 5)
    ctx.fill()
    if (i === at) {
      ctx.strokeStyle = cat
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.roundRect(c.x - 3, c.y - 3, c.w + 6, c.h + 6, 7)
      ctx.stroke()
    }
    ctx.fillStyle = i === at ? cat : color('--surface')
    ctx.strokeStyle = cat
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(c.x, c.y, 7, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = i === at ? color('--surface') : color('--text')
    ctx.font = 'bold 9px ui-sans-serif, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(String(i + 1), c.x, c.y + 3)
  })

  // The wrap from the last control back to the first.
  const last = controls[3]
  const first = controls[0]
  ctx.strokeStyle = cat
  ctx.globalAlpha = 0.6
  ctx.setLineDash([4, 3])
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(last.x + last.w, last.y + last.h / 2)
  ctx.bezierCurveTo(x + w + 22, last.y, x + w + 22, first.y, first.x + first.w, first.y + first.h / 2)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.globalAlpha = 1
}
