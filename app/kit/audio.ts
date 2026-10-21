let context: AudioContext | null = null
let master: GainNode | null = null
let noise: AudioBuffer | null = null

/**
 * One AudioContext shared by every artifact. Browsers only let it start after a user
 * gesture, so call this from a click handler (or code that runs after one).
 */
export function audio(): AudioContext {
  context ??= new AudioContext()
  if (context.state === 'suspended') void context.resume()
  return context
}

/** Where every voice connects: a master gain into a compressor, so stacked notes don't clip. */
export function output(): AudioNode {
  const ac = audio()
  if (!master) {
    const compressor = ac.createDynamicsCompressor()
    compressor.threshold.value = -12
    compressor.ratio.value = 6
    master = ac.createGain()
    master.gain.value = 0.9
    master.connect(compressor).connect(ac.destination)
  }
  return master
}

/** One second of white noise, made once: the raw material for snares and hats. */
export function noiseBuffer(): AudioBuffer {
  const ac = audio()
  if (!noise) {
    noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate)
    const data = noise.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  }
  return noise
}

interface ToneOptions {
  /** AudioContext time to start; defaults to now. */
  when?: number
  duration?: number
  gain?: number
  type?: OscillatorType
  attack?: number
  release?: number
  detune?: number
}

/** An enveloped oscillator note, scheduled at `when`. */
export function tone(
  frequency: number,
  { when, duration = 0.3, gain = 0.15, type = 'triangle', attack = 0.005, release = 0.25, detune = 0 }: ToneOptions = {},
) {
  const ac = audio()
  const t = when ?? ac.currentTime
  const osc = ac.createOscillator()
  const amp = ac.createGain()
  osc.type = type
  osc.frequency.value = frequency
  osc.detune.value = detune
  amp.gain.setValueAtTime(0, t)
  amp.gain.linearRampToValueAtTime(gain, t + attack)
  amp.gain.setValueAtTime(gain, t + attack + duration)
  amp.gain.exponentialRampToValueAtTime(0.0001, t + attack + duration + release)
  osc.connect(amp).connect(output())
  osc.start(t)
  osc.stop(t + attack + duration + release + 0.05)
}

/** A short blip for sonifying data. */
export function blip(frequency: number, { duration = 0.06, gain = 0.06, type = 'triangle' }: Omit<ToneOptions, 'when'> = {}) {
  tone(frequency, { duration: 0, gain, type, attack: 0.002, release: duration })
}
