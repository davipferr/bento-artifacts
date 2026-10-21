import { audio, noiseBuffer, output } from '../../kit/audio'
import type { TrackId } from './pattern'

/**
 * Every drum is synthesized: no samples. Kicks and toms are sine waves with a falling
 * pitch; snares, claps and hats are filtered white noise with a fast decay.
 */

function envelope(when: number, peak: number, decay: number) {
  const amp = audio().createGain()
  amp.gain.setValueAtTime(peak, when)
  amp.gain.exponentialRampToValueAtTime(0.001, when + decay)
  amp.connect(output())
  return amp
}

function noise(when: number, duration: number, filter: BiquadFilterNode, amp: AudioNode) {
  const source = audio().createBufferSource()
  source.buffer = noiseBuffer()
  source.connect(filter).connect(amp)
  // Start at a random point in the buffer so repeated hits don't sound identical.
  source.start(when, Math.random() * 0.5)
  source.stop(when + duration)
}

function filter(type: BiquadFilterType, frequency: number, q = 1) {
  const f = audio().createBiquadFilter()
  f.type = type
  f.frequency.value = frequency
  f.Q.value = q
  return f
}

function pitchedDrop(when: number, from: number, to: number, drop: number, peak: number, decay: number) {
  const osc = audio().createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(from, when)
  osc.frequency.exponentialRampToValueAtTime(to, when + drop)
  osc.connect(envelope(when, peak, decay))
  osc.start(when)
  osc.stop(when + decay + 0.05)
}

export function playDrum(id: TrackId, when = audio().currentTime) {
  switch (id) {
    case 'kick':
      pitchedDrop(when, 150, 45, 0.12, 1, 0.45)
      break
    case 'snare': {
      noise(when, 0.2, filter('highpass', 1500), envelope(when, 0.55, 0.18))
      const body = audio().createOscillator()
      body.type = 'triangle'
      body.frequency.value = 185
      body.connect(envelope(when, 0.35, 0.1))
      body.start(when)
      body.stop(when + 0.15)
      break
    }
    case 'clap': {
      // Three quick bursts then a tail: several hands, not quite together.
      const amp = audio().createGain()
      amp.connect(output())
      const g = amp.gain
      g.setValueAtTime(0, when)
      for (const offset of [0, 0.011, 0.022]) {
        g.setValueAtTime(0.7, when + offset)
        g.exponentialRampToValueAtTime(0.1, when + offset + 0.009)
      }
      g.setValueAtTime(0.5, when + 0.033)
      g.exponentialRampToValueAtTime(0.001, when + 0.2)
      noise(when, 0.25, filter('bandpass', 1200, 0.8), amp)
      break
    }
    case 'chat':
      noise(when, 0.08, filter('highpass', 7000), envelope(when, 0.3, 0.05))
      break
    case 'ohat':
      noise(when, 0.45, filter('highpass', 6500), envelope(when, 0.25, 0.38))
      break
    case 'tom':
      pitchedDrop(when, 170, 90, 0.2, 0.7, 0.4)
      break
  }
}
