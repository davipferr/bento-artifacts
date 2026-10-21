import type { Preview } from '../types'
import { COUNT, presets, waveform } from './harmonics'

/** A sawtooth built up one harmonic at a time: the bars below, the wave above. */
export const preview: Preview = () => {
  const saw = presets.find((p) => p.name === 'Sawtooth')!.amps
  return ({ ctx, width, height, t, color }) => {
    const k = 1 + (Math.floor(t * 1.6) % 12)
    const amps = saw.map((a, i) => (i < k ? a : 0))
    const wave = waveform(amps, 200)
    const mid = height * 0.38
    const amp = height * 0.26
    ctx.strokeStyle = color('--cat')
    ctx.lineWidth = 2.5
    ctx.beginPath()
    for (let px = 0; px <= width; px += 2) {
      const v = wave[Math.floor(((px / width) * 2 * 200) % 200)]
      if (px) ctx.lineTo(px, mid - v * amp)
      else ctx.moveTo(px, mid - v * amp)
    }
    ctx.stroke()
    const bw = width / COUNT
    for (let i = 0; i < COUNT; i++) {
      const h = amps[i] * height * 0.25
      ctx.fillStyle = i < k ? color('--cat') : color('--grid')
      ctx.fillRect(i * bw + 3, height - 6 - Math.max(2, h), bw - 6, Math.max(2, h))
    }
  }
}
