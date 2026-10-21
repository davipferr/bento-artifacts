import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { audio, output } from '../../kit/audio'
import { useCanvas, type Frame } from '../../kit/canvas'
import { Checkbox, Segmented } from '../../kit/Controls'
import { midiToFreq, noteName } from '../../kit/music'
import { Piano } from '../../kit/Piano'
import { centroid, COUNT, oddShare, peak, presets, waveform, type Harmonics } from './harmonics'
import './style.css'

/** Computer keys → semitones above the keyboard's lowest note (a piano-like layout). */
const KEYS = ['a', 'w', 's', 'e', 'd', 'f', 't', 'g', 'y', 'h', 'u', 'j', 'k', 'o', 'l', 'p', ';']
const SPAN = 16
const OCTAVES = [
  { value: '36', label: 'C2' },
  { value: '48', label: 'C3' },
  { value: '60', label: 'C4' },
] as const
const DRONE = 1000 // voice-map key offset so the drone never collides with a held key
const VOICE_GAIN = 0.22

/**
 * Our own normalization: scale so the waveform's peak is 1. (The browser's default
 * normalization can't handle all-zero amplitudes, and this keeps loudness steady.)
 */
function periodicWave(ac: AudioContext, amps: Harmonics) {
  const real = new Float32Array(COUNT + 1)
  const imag = new Float32Array(COUNT + 1)
  const max = peak(amps)
  amps.forEach((a, i) => (imag[i + 1] = max > 0 ? a / max : 0))
  return ac.createPeriodicWave(real, imag, { disableNormalization: true })
}

function drawSpectrum({ ctx, width, height, color }: Frame, amps: Harmonics) {
  const top = 10
  const bottom = 22
  const h = height - top - bottom
  const bw = width / COUNT
  const accent = color('--cat')
  ctx.textAlign = 'center'
  for (let i = 0; i < COUNT; i++) {
    const x = i * bw
    ctx.fillStyle = color('--grid')
    ctx.fillRect(x + 3, top, bw - 6, h)
    ctx.fillStyle = accent
    const bh = amps[i] * h
    ctx.fillRect(x + 3, top + h - bh, bw - 6, bh)
    ctx.fillStyle = color('--muted')
    ctx.fillText(String(i + 1), x + bw / 2, height - 6)
  }
}

function drawWave({ ctx, width, height, color }: Frame, amps: Harmonics, showParts: boolean) {
  const mid = height / 2
  const scaleY = height / 2 - 12
  const periods = 2
  const points = 400
  ctx.strokeStyle = color('--grid')
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, mid)
  ctx.lineTo(width, mid)
  ctx.moveTo(width / 2, 0)
  ctx.lineTo(width / 2, height)
  ctx.stroke()

  const wave = waveform(amps, points)
  // waveform() is normalized; divide the components by the same peak so they line up with it.
  const max = peak(amps, points)

  if (showParts && max > 0) {
    ctx.lineWidth = 1
    ctx.strokeStyle = color('--muted')
    ctx.globalAlpha = 0.45
    amps.forEach((a, n) => {
      if (a < 0.01) return
      ctx.beginPath()
      for (let px = 0; px <= width; px++) {
        const phase = (px / width) * periods
        const y = mid - ((a * Math.sin(2 * Math.PI * (n + 1) * phase)) / max) * scaleY
        if (px === 0) ctx.moveTo(px, y)
        else ctx.lineTo(px, y)
      }
      ctx.stroke()
    })
    ctx.globalAlpha = 1
  }

  ctx.strokeStyle = color('--cat')
  ctx.lineWidth = 2.5
  ctx.lineJoin = 'round'
  ctx.beginPath()
  for (let px = 0; px <= width; px++) {
    const i = Math.floor(((px / width) * periods * points) % points)
    const y = mid - wave[i] * scaleY
    if (px === 0) ctx.moveTo(px, y)
    else ctx.lineTo(px, y)
  }
  ctx.stroke()
}

export default function HarmonicExplorer() {
  const [amps, setAmps] = useState<Harmonics>(presets[2].amps)
  const [base, setBase] = useState(48)
  const [active, setActive] = useState<Set<number>>(new Set())
  const [lastNote, setLastNote] = useState(57)
  const [drone, setDrone] = useState(false)
  const [showParts, setShowParts] = useState(true)

  const voices = useRef(new Map<number, { osc: OscillatorNode; amp: GainNode }>())
  const ampsRef = useRef(amps)
  ampsRef.current = amps
  const dragging = useRef<{ last: number } | null>(null)

  const spectrum = useCanvas((frame) => drawSpectrum(frame, amps))
  const wave = useCanvas((frame) => drawWave(frame, amps, showParts))

  const startVoice = (key: number, midi: number) => {
    if (voices.current.has(key)) return
    const ac = audio()
    const osc = ac.createOscillator()
    osc.setPeriodicWave(periodicWave(ac, ampsRef.current))
    osc.frequency.value = midiToFreq(midi)
    const amp = ac.createGain()
    amp.gain.setValueAtTime(0, ac.currentTime)
    amp.gain.linearRampToValueAtTime(VOICE_GAIN, ac.currentTime + 0.015)
    osc.connect(amp).connect(output())
    osc.start()
    voices.current.set(key, { osc, amp })
  }

  const stopVoice = (key: number) => {
    const voice = voices.current.get(key)
    if (!voice) return
    const t = audio().currentTime
    voice.amp.gain.cancelScheduledValues(t)
    voice.amp.gain.setValueAtTime(voice.amp.gain.value, t)
    voice.amp.gain.setTargetAtTime(0, t, 0.04)
    voice.osc.stop(t + 0.3)
    voices.current.delete(key)
  }

  const noteOn = (midi: number) => {
    startVoice(midi, midi)
    setLastNote(midi)
    setActive((s) => new Set(s).add(midi))
  }

  const noteOff = (midi: number) => {
    stopVoice(midi)
    setActive((s) => {
      const next = new Set(s)
      next.delete(midi)
      return next
    })
  }

  // Changing the harmonics re-shapes every sounding note immediately.
  useEffect(() => {
    if (!voices.current.size) return
    const ac = audio()
    const wave = periodicWave(ac, amps)
    for (const { osc } of voices.current.values()) osc.setPeriodicWave(wave)
  }, [amps])

  useEffect(() => {
    if (drone) startVoice(DRONE + base, base)
    return () => stopVoice(DRONE + base)
  }, [drone, base])

  // Computer keyboard.
  const keyHandlers = useRef({ noteOn, noteOff, base })
  keyHandlers.current = { noteOn, noteOff, base }
  useEffect(() => {
    const held = new Map<string, number>()
    const down = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.target instanceof HTMLInputElement) return
      const offset = KEYS.indexOf(e.key.toLowerCase())
      if (offset < 0) return
      const midi = keyHandlers.current.base + offset
      held.set(e.key.toLowerCase(), midi)
      keyHandlers.current.noteOn(midi)
    }
    const up = (e: KeyboardEvent) => {
      const midi = held.get(e.key.toLowerCase())
      if (midi === undefined) return
      held.delete(e.key.toLowerCase())
      keyHandlers.current.noteOff(midi)
    }
    const releaseAll = () => {
      for (const midi of held.values()) keyHandlers.current.noteOff(midi)
      held.clear()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', releaseAll)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', releaseAll)
    }
  }, [])

  // Silence everything when leaving the page.
  useEffect(
    () => () => {
      for (const key of [...voices.current.keys()]) stopVoice(key)
    },
    [],
  )

  // ---- Drawing the spectrum with the pointer -----------------------------

  const barAt = (e: PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const index = Math.min(COUNT - 1, Math.max(0, Math.floor(((e.clientX - rect.left) / rect.width) * COUNT)))
    const value = Math.min(1, Math.max(0, 1 - (e.clientY - rect.top - 10) / (rect.height - 32)))
    return { index, value: Math.round(value * 100) / 100 }
  }

  const setBars = (from: number, to: number, value: number) =>
    setAmps((a) => a.map((v, i) => (i >= Math.min(from, to) && i <= Math.max(from, to) ? value : v)))

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const { index, value } = barAt(e)
    dragging.current = { last: index }
    setBars(index, index, value)
  }

  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!dragging.current) return
    const { index, value } = barAt(e)
    setBars(dragging.current.last, index, value)
    dragging.current.last = index
  }

  const captions = Object.fromEntries(KEYS.map((k, i) => [base + i, k]))
  const f0 = midiToFreq(lastNote)
  const preset = presets.find((p) => p.amps.every((a, i) => a === amps[i]))

  return (
    <>
      <div className="card harm-toolbar">
        <div className="presets">
          {presets.map((p) => (
            <button key={p.name} className={`chip${preset === p ? ' active' : ''}`} onClick={() => setAmps(p.amps)}>
              {p.name}
            </button>
          ))}
        </div>
        <dl className="harm-stats">
          <div>
            <dt>Brightness (centroid)</dt>
            <dd>harmonic {centroid(amps).toFixed(2)}</dd>
          </div>
          <div>
            <dt>In odd harmonics</dt>
            <dd>{Math.round(oddShare(amps) * 100)}%</dd>
          </div>
          <div>
            <dt>Last note</dt>
            <dd>
              {noteName(lastNote)} · {f0.toFixed(1)} Hz
            </dd>
          </div>
          <div>
            <dt>Highest harmonic</dt>
            <dd>{Math.round(f0 * COUNT).toLocaleString('en-US')} Hz</dd>
          </div>
        </dl>
      </div>

      <div className="harm-panels">
        <div className="card">
          <h3>Harmonics</h3>
          <p className="muted small">Drag across the bars to draw a spectrum. Bar n is a sine at n × the pitch.</p>
          <canvas
            ref={spectrum.ref}
            className="canvas harm-spectrum"
            aria-label="Harmonic amplitudes, drag to edit"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={() => (dragging.current = null)}
            onPointerCancel={() => (dragging.current = null)}
          />
        </div>
        <div className="card">
          <h3>Waveform</h3>
          <p className="muted small">Two periods of the sum{showParts ? ', with each harmonic underneath' : ''}.</p>
          <canvas ref={wave.ref} className="canvas harm-wave" aria-label="Resulting waveform" />
          <Checkbox checked={showParts} onChange={setShowParts}>
            Show the individual harmonics
          </Checkbox>
        </div>
      </div>

      <div className="card">
        <div className="row harm-keys-head">
          <h3>Play it</h3>
          <span className="muted small">Click the keys or use your keyboard (A W S E D F…)</span>
          <span className="spacer" />
          <Segmented value={String(base)} options={OCTAVES} onChange={(v) => setBase(Number(v))} />
          <Checkbox checked={drone} onChange={setDrone}>
            Drone {noteName(base)}
          </Checkbox>
        </div>
        <Piano from={base} to={base + SPAN} active={active} captions={captions} onDown={noteOn} onUp={noteOff} />
      </div>

      <p className="hint">
        Same pitch, different harmonics: that's timbre, the reason a flute and a clarinet playing the
        same note sound different. Square and clarinet only have odd harmonics, which sounds hollow.
        The triangle preset has the right harmonic strengths but not the alternating phases of a real
        triangle wave, so its drawing is rounder, and yet it sounds the same: your ear hears the
        strengths, not the phases.
      </p>
    </>
  )
}
