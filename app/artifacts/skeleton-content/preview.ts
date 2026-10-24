import type { Preview } from '../types'

/** Three skeleton cards shimmering, then crossfading to content one by one; loops every 5 s. */
export const preview: Preview = () => ({ ctx, width, height, t, color }) => {
  const phase = (t + 1) % 5
  const w = Math.min(260, width - 40)
  const x = (width - w) / 2
  const rowH = Math.min(46, (height - 24) / 3.3)
  const y0 = (height - rowH * 3 - 16) / 2
  for (let i = 0; i < 3; i++) {
    const y = y0 + i * (rowH + 8)
    const k = Math.max(0, Math.min(1, (phase - 1.6 - i * 0.35) / 0.35))
    ctx.fillStyle = color('--surface')
    ctx.strokeStyle = color('--border')
    ctx.beginPath()
    ctx.roundRect(x, y, w, rowH, 8)
    ctx.fill()
    ctx.stroke()
    // Skeleton bones with a moving shimmer band.
    ctx.globalAlpha = 1 - k
    const shine = ((phase * 0.8) % 1) * (w + 80) - 40
    for (const [bx, by, bw, bh, round] of [
      [10, rowH / 2 - 13, 26, 26, true],
      [44, rowH / 2 - 9, w * 0.45, 7, false],
      [44, rowH / 2 + 3, w * 0.3, 7, false],
    ] as const) {
      const g = ctx.createLinearGradient(x + shine - 40, 0, x + shine + 40, 0)
      g.addColorStop(0, color('--chip'))
      g.addColorStop(0.5, color('--border'))
      g.addColorStop(1, color('--chip'))
      ctx.fillStyle = g
      ctx.beginPath()
      if (round) ctx.arc(x + bx + bw / 2, y + by + bh / 2, bw / 2, 0, Math.PI * 2)
      else ctx.roundRect(x + bx, y + by, bw, bh, 3)
      ctx.fill()
    }
    // Real content fading in.
    ctx.globalAlpha = k
    ctx.fillStyle = `hsl(${[200, 30, 140][i]} 70% 55%)`
    ctx.beginPath()
    ctx.arc(x + 23, y + rowH / 2, 13, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = color('--text')
    ctx.font = '600 11.5px ui-sans-serif, system-ui, sans-serif'
    ctx.textBaseline = 'middle'
    ctx.fillText(['Ana Ribeiro', 'Ravi Patel', 'Joana Costa'][i], x + 44, y + rowH / 2 - 6)
    ctx.fillStyle = color('--muted')
    ctx.font = '11px ui-sans-serif, system-ui, sans-serif'
    ctx.fillText(['Shipped the onboarding flow', 'Lunch at the Lisbon office', 'Field trip to the garden'][i], x + 44, y + rowH / 2 + 8)
    ctx.globalAlpha = 1
  }
}
