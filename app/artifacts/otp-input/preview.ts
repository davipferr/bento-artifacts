import type { Preview } from '../types'

const WRONG = '483012'
const RIGHT = '482913'

/** A wrong code typed, a shake and a clear, then the right one turning green; loops every 7 s. */
export const preview: Preview = () => ({ ctx, width, height, t, color }) => {
  const phase = (t + 1.5) % 7
  const n = 6
  const gap = 7
  const box = Math.min(34, (width - 40 - gap * (n - 1)) / n)
  const h = box * 1.22
  let x0 = (width - (box * n + gap * (n - 1))) / 2
  const y = (height - h) / 2
  // 0–1.8 s typing the wrong code, 1.8–2.6 shake, 2.6–4.4 typing the right one, then hold green.
  let text = ''
  let state: 'typing' | 'error' | 'ok' = 'typing'
  if (phase < 1.8) text = WRONG.slice(0, Math.floor(phase / 0.3))
  else if (phase < 2.6) {
    text = WRONG
    state = 'error'
    x0 += Math.sin(phase * 60) * 6 * Math.max(0, 2.3 - phase) * 2
  } else if (phase < 4.4) text = RIGHT.slice(0, Math.floor((phase - 2.6) / 0.3))
  else {
    text = RIGHT
    state = 'ok'
  }
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `600 ${Math.round(box * 0.55)}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`
  for (let i = 0; i < n; i++) {
    const x = x0 + i * (box + gap)
    const ch = text[i] ?? ''
    const current = state === 'typing' && i === text.length
    const accent = state === 'error' ? color('--cat-games') : state === 'ok' ? color('--cat-generative') : color('--cat')
    ctx.fillStyle = color('--bg')
    ctx.strokeStyle = ch || current || state !== 'typing' ? accent : color('--border')
    ctx.lineWidth = current ? 2.5 : 2
    ctx.beginPath()
    ctx.roundRect(x, y - (state === 'ok' ? Math.max(0, Math.sin((phase - 4.4 - i * 0.06) * 8)) * 5 * (phase < 5 ? 1 : 0) : 0), box, h, 8)
    ctx.fill()
    ctx.stroke()
    if (ch) {
      ctx.fillStyle = color('--text')
      ctx.fillText(ch, x + box / 2, y + h / 2 + 1)
    } else if (current && Math.floor(t * 2) % 2 === 0) {
      ctx.fillStyle = accent
      ctx.fillRect(x + box / 2 - 1, y + h * 0.28, 2, h * 0.44)
    }
  }
}
