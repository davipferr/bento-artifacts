import { useEffect, useRef, useState } from 'react'
import { audio, tone } from '../../kit/audio'
import { Segmented, Slider } from '../../kit/Controls'
import { midiToFreq } from '../../kit/music'
import { Piano } from '../../kit/Piano'
import {
  chordName,
  diatonic,
  FIFTHS,
  MAJOR_LABELS,
  MINOR_LABELS,
  progressions,
  shortestTurn,
  usesFlats,
  voicing,
  wheelSlot,
  type Chord,
  type Mode,
} from './theory'
import './style.css'

const R_OUT = 190
const R_MID = 132
const R_IN = 82

type Sounding = Pick<Chord, 'root' | 'quality'>

/** Point on the wheel: slot 0 at the top, clockwise, `radius` from the centre. */
function polar(slot: number, radius: number): [number, number] {
  const angle = ((slot * 30 - 90) * Math.PI) / 180
  return [radius * Math.cos(angle), radius * Math.sin(angle)]
}

function sector(slot: number, r0: number, r1: number) {
  const [x0, y0] = polar(slot - 0.5, r1)
  const [x1, y1] = polar(slot + 0.5, r1)
  const [x2, y2] = polar(slot + 0.5, r0)
  const [x3, y3] = polar(slot - 0.5, r0)
  return `M${x0} ${y0}A${r1} ${r1} 0 0 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 0 0 ${x3} ${y3}Z`
}

/** Bass plus a strummed triad: triangle waves with a slightly detuned sine for warmth. */
function playChord(chord: Sounding, duration: number) {
  const when = audio().currentTime + 0.01
  const [bass, ...upper] = voicing(chord)
  tone(midiToFreq(bass), { when, duration, gain: 0.16, type: 'sine', release: 0.5 })
  upper.forEach((note, i) => {
    const t = when + 0.025 * (i + 1)
    tone(midiToFreq(note), { when: t, duration, gain: 0.08, type: 'triangle', release: 0.6 })
    tone(midiToFreq(note), { when: t, duration, gain: 0.04, type: 'sine', release: 0.6, detune: 7 })
  })
}

export default function ChordWheel() {
  const [slot, setSlot] = useState(0)
  const [mode, setMode] = useState<Mode>('major')
  /** Cumulative turns, so the wheel always spins the short way round. */
  const [turns, setTurns] = useState(0)
  const [sounding, setSounding] = useState<Sounding | null>(null)
  const [progression, setProgression] = useState<{ name: string; step: number } | null>(null)
  const [tempo, setTempo] = useState(80)
  const timers = useRef<number[]>([])

  const flats = usesFlats(slot)
  const chords = diatonic(slot, mode)

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
  }
  useEffect(() => clearTimers, [])

  const sound = (chord: Sounding, seconds = 1.1) => {
    playChord(chord, seconds)
    setSounding(chord)
    const t = window.setTimeout(() => setSounding((s) => (s === chord ? null : s)), seconds * 1000 + 200)
    timers.current.push(t)
  }

  const chooseKey = (next: number, nextMode: Mode) => {
    clearTimers()
    setProgression(null)
    setTurns((t) => t + shortestTurn(slot, next))
    setSlot(next)
    setMode(nextMode)
    sound(nextMode === 'major' ? { root: FIFTHS[next], quality: 'maj' } : { root: (FIFTHS[next] + 9) % 12, quality: 'min' })
  }

  const playProgression = (name: string, degrees: number[]) => {
    clearTimers()
    const beat = 60 / tempo
    const length = beat * 2 // two beats per chord
    degrees.forEach((degree, i) => {
      const t = window.setTimeout(() => {
        setProgression({ name, step: i })
        sound(chords[degree], length * 0.92)
      }, i * length * 1000)
      timers.current.push(t)
    })
    timers.current.push(window.setTimeout(() => setProgression(null), degrees.length * length * 1000))
  }

  const stop = () => {
    clearTimers()
    setProgression(null)
    setSounding(null)
  }

  // Which wheel segments belong to the key, and their roman numerals.
  const romans = new Map<string, string>()
  for (const chord of chords) {
    const place = wheelSlot(chord)
    if (place) romans.set(`${place.ring}${place.slot}`, chord.roman)
  }
  const tonicKey = mode === 'major' ? `outer${slot}` : `inner${slot}`
  const soundingPlace = sounding ? wheelSlot(sounding) : null
  const soundingKey = soundingPlace ? `${soundingPlace.ring}${soundingPlace.slot}` : null
  const accidentals = slot === 0 ? 'no sharps or flats' : slot <= 6 ? `${slot} sharp${slot > 1 ? 's' : ''}` : `${12 - slot} flat${12 - slot > 1 ? 's' : ''}`
  const rotation = turns * 30

  const segment = (ring: 'outer' | 'inner', i: number) => {
    const key = `${ring}${i}`
    const roman = romans.get(key)
    const [r0, r1] = ring === 'outer' ? [R_MID, R_OUT] : [R_IN, R_MID]
    const [lx, ly] = polar(i, (r0 + r1) / 2)
    const label = ring === 'outer' ? MAJOR_LABELS[i] : MINOR_LABELS[i]
    const classes = ['seg', ring, roman ? 'in-key' : '', key === tonicKey ? 'tonic' : '', key === soundingKey ? 'sounding' : '']
    return (
      <g
        key={key}
        className={classes.filter(Boolean).join(' ')}
        role="button"
        tabIndex={0}
        aria-label={`${label}${ring === 'outer' ? ' major' : ''}: set key and play`}
        onClick={() => chooseKey(i, ring === 'outer' ? 'major' : 'minor')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            chooseKey(i, ring === 'outer' ? 'major' : 'minor')
          }
        }}
      >
        <path d={sector(i, r0, r1)} />
        <g transform={`translate(${lx} ${ly})`}>
          <g className="upright" style={{ transform: `rotate(${rotation}deg)` }}>
            <text className="seg-name" y={roman ? -3 : 5}>
              {label}
            </text>
            {roman && (
              <text className="seg-roman" y={14}>
                {roman}
              </text>
            )}
          </g>
        </g>
      </g>
    )
  }

  return (
    <>
      <div className="wheel-layout">
        <div className="card wheel-card">
          <svg className="wheel" viewBox="-200 -200 400 400" role="group" aria-label="Circle of fifths">
            <g className="spin" style={{ transform: `rotate(${-rotation}deg)` }}>
              {FIFTHS.map((_, i) => segment('outer', i))}
              {FIFTHS.map((_, i) => segment('inner', i))}
            </g>
            <circle className="wheel-hub" r={R_IN - 4} />
            <text className="hub-key" y={-4}>
              {mode === 'major' ? MAJOR_LABELS[slot] : MINOR_LABELS[slot].replace('m', '')}
            </text>
            <text className="hub-mode" y={16}>
              {mode}
            </text>
            <text className="hub-acc" y={34}>
              {accidentals}
            </text>
            <path className="wheel-pointer" d={`M0 ${-R_OUT - 8}l-7 -9h14z`} />
          </svg>
          <p className="hint">
            Click an outer key for major, an inner one for minor. The highlighted wedge is the key's
            family: its tonic plus the neighbours one step either way.
          </p>
        </div>

        <div className="wheel-side">
          <div className="card">
            <div className="row">
              <h3>Chords in {chordName(chords[0], flats).replace('m', '')} {mode}</h3>
              <span className="spacer" />
              <Segmented
                value={mode}
                options={[
                  { value: 'major', label: 'Major' },
                  { value: 'minor', label: 'Minor' },
                ]}
                onChange={(m) => chooseKey(slot, m)}
              />
            </div>
            <div className="chord-grid">
              {chords.map((chord) => (
                <button
                  key={chord.roman}
                  className={`chord-btn q-${chord.quality}${
                    sounding?.root === chord.root && sounding.quality === chord.quality ? ' sounding' : ''
                  }`}
                  onClick={() => sound(chord)}
                >
                  <span className="chord-roman">{chord.roman}</span>
                  <span className="chord-name">{chordName(chord, flats)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="row">
              <h3>Progressions</h3>
              <span className="spacer" />
              {progression && (
                <button className="chip" onClick={stop}>
                  ■ Stop
                </button>
              )}
            </div>
            <div className="presets">
              {progressions[mode].map((p) => (
                <button
                  key={p.name}
                  className={`chip${progression?.name === p.name ? ' active' : ''}`}
                  onClick={() => playProgression(p.name, p.degrees)}
                >
                  ▶ {p.name}
                </button>
              ))}
            </div>
            {progression && (
              <p className="progress-line mono">
                {progressions[mode]
                  .find((p) => p.name === progression.name)!
                  .degrees.map((d, i) => (
                    <span key={i} className={i === progression.step ? 'now' : undefined}>
                      {chordName(chords[d], flats)}
                    </span>
                  ))}
              </p>
            )}
            <Slider label="Tempo" value={tempo} min={50} max={160} format={(v) => `${v} BPM`} onChange={setTempo} />
          </div>
        </div>
      </div>

      <div className="card">
        <Piano from={36} to={71} active={new Set(sounding ? voicing(sounding) : [])} />
      </div>
    </>
  )
}
