import { useEffect, useRef, useState } from 'react'
import { audio } from '../../kit/audio'
import { useFrame } from '../../kit/canvas'
import { Slider } from '../../kit/Controls'
import { routeParams, setRouteParams } from '../../kit/router'
import { playDrum } from './drums'
import {
  decode,
  emptyPattern,
  encode,
  fromStrings,
  presets,
  randomPattern,
  sixteenth,
  STEPS,
  swingOffset,
  tracks,
  type Pattern,
} from './pattern'
import './style.css'

/** How far ahead (seconds) the scheduler books notes, and how often (ms) it wakes up. */
const LOOKAHEAD = 0.12
const TICK_MS = 25

/** Initial state: from the URL if it holds a shared beat, else the first preset. */
function initial() {
  const params = routeParams()
  const shared = decode(params.get('p') ?? '')
  const bpm = Number(params.get('bpm'))
  const swing = Number(params.get('swing'))
  if (shared) {
    return {
      pattern: shared,
      bpm: bpm >= 60 && bpm <= 180 ? bpm : 110,
      swing: swing >= 0 && swing <= 60 ? swing : 0,
    }
  }
  return { pattern: fromStrings(presets[0].rows), bpm: presets[0].bpm, swing: presets[0].swing * 100 }
}

export default function StepSequencer() {
  const [start] = useState(initial)
  const [pattern, setPattern] = useState<Pattern>(start.pattern)
  const [bpm, setBpm] = useState(start.bpm)
  /** Percent of a 16th, 0–60. */
  const [swing, setSwing] = useState(start.swing)
  const [muted, setMuted] = useState<boolean[]>(() => tracks.map(() => false))
  const [playing, setPlaying] = useState(false)
  const [playhead, setPlayhead] = useState(-1)
  const [copied, setCopied] = useState(false)

  // The scheduler runs on a timer outside React, so it reads the latest values from refs.
  const live = useRef({ pattern, bpm, swing, muted })
  live.current = { pattern, bpm, swing, muted }
  const clock = useRef({ step: 0, gridTime: 0, timer: 0, queue: [] as { step: number; time: number }[] })
  const paint = useRef<boolean | null>(null)

  // Keep the URL in sync so the address bar is always a shareable link to this beat.
  useEffect(() => {
    const params = new URLSearchParams({ p: encode(pattern), bpm: String(bpm), swing: String(swing) })
    setRouteParams(params)
  }, [pattern, bpm, swing])

  /** Book every step that falls inside the look-ahead window (the "two clocks" technique). */
  const schedule = () => {
    const ac = audio()
    const c = clock.current
    const { pattern: p, bpm: tempo, swing: sw, muted: m } = live.current
    while (c.gridTime < ac.currentTime + LOOKAHEAD) {
      const time = c.gridTime + swingOffset(c.step, tempo, sw / 100)
      tracks.forEach((track, t) => {
        if (p[t][c.step] && !m[t]) playDrum(track.id, time)
      })
      c.queue.push({ step: c.step, time })
      c.gridTime += sixteenth(tempo)
      c.step = (c.step + 1) % STEPS
    }
  }

  const play = () => {
    const ac = audio()
    const c = clock.current
    c.step = 0
    c.gridTime = ac.currentTime + 0.05
    c.queue = []
    schedule()
    c.timer = window.setInterval(schedule, TICK_MS)
    setPlaying(true)
  }

  const stop = () => {
    window.clearInterval(clock.current.timer)
    setPlaying(false)
    setPlayhead(-1)
  }

  useEffect(() => () => window.clearInterval(clock.current.timer), [])

  // The playhead follows what is actually sounding, not what was just scheduled.
  useFrame(() => {
    const c = clock.current
    const now = audio().currentTime
    let step = -1
    while (c.queue.length && c.queue[0].time <= now) step = c.queue.shift()!.step
    if (step >= 0) setPlayhead(step)
  }, playing)

  // Space bar toggles playback (except while typing).
  const toggle = useRef(() => {})
  toggle.current = () => (playing ? stop() : play())
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      e.preventDefault()
      toggle.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const setCell = (t: number, s: number, on: boolean) => {
    if (pattern[t][s] === on) return
    setPattern((p) => p.map((row, i) => (i === t ? row.map((v, j) => (j === s ? on : v)) : row)))
    if (on && !playing) playDrum(tracks[t].id)
  }

  const loadPreset = (index: number) => {
    const preset = presets[index]
    setPattern(fromStrings(preset.rows))
    setBpm(preset.bpm)
    setSwing(Math.round(preset.swing * 100))
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(location.href)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard blocked: the address bar already holds the link.
    }
  }

  return (
    <>
      <div className="card seq-toolbar">
        <div className="row">
          <button className="primary seq-play" onClick={playing ? stop : play}>
            {playing ? '■ Stop' : '▶ Play'}
          </button>
          <span className="muted small">or press Space</span>
          <span className="divider" />
          {presets.map((preset, i) => (
            <button key={preset.name} className="chip" onClick={() => loadPreset(i)}>
              {preset.name}
            </button>
          ))}
          <button className="chip" onClick={() => setPattern(randomPattern())}>
            🎲 Random
          </button>
          <button className="chip" onClick={() => setPattern(emptyPattern())}>
            Clear
          </button>
        </div>
        <div className="seq-sliders">
          <Slider label="Tempo" value={bpm} min={60} max={180} format={(v) => `${v} BPM`} onChange={setBpm} />
          <Slider
            label="Swing"
            value={swing}
            min={0}
            max={60}
            format={(v) => (v === 0 ? 'straight' : `${v}%`)}
            onChange={setSwing}
          />
          <button onClick={copyLink}>{copied ? 'Link copied ✓' : 'Copy share link'}</button>
        </div>
      </div>

      <div className="card seq-grid-card">
        <div
          className="seq-grid"
          onPointerUp={() => (paint.current = null)}
          onPointerLeave={() => (paint.current = null)}
        >
          {tracks.map((track, t) => (
            <div key={track.id} className={`seq-row${muted[t] ? ' muted' : ''}`}>
              <button
                className={`seq-name${playhead >= 0 && pattern[t][playhead] && !muted[t] ? ' hit' : ''}`}
                title={muted[t] ? 'Unmute' : 'Mute'}
                aria-pressed={!muted[t]}
                onClick={() => setMuted((m) => m.map((v, i) => (i === t ? !v : v)))}
              >
                {track.name}
              </button>
              <div className="seq-steps">
                {pattern[t].map((on, s) => (
                  <button
                    key={s}
                    className={`seq-cell${on ? ' on' : ''}${s === playhead ? ' now' : ''}${s % 4 === 0 ? ' beat' : ''}`}
                    aria-label={`${track.name}, step ${s + 1}`}
                    aria-pressed={on}
                    onPointerDown={(e) => {
                      e.currentTarget.releasePointerCapture(e.pointerId) // let the drag reach other cells
                      paint.current = !on
                      setCell(t, s, !on)
                    }}
                    onPointerEnter={() => {
                      if (paint.current !== null) setCell(t, s, paint.current)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') setCell(t, s, !on)
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
          <div className="seq-row seq-numbers" aria-hidden>
            <span />
            <div className="seq-steps">
              {Array.from({ length: STEPS }, (_, s) => (
                <span key={s} className={s === playhead ? 'now' : undefined}>
                  {s % 4 === 0 ? s / 4 + 1 : '·'}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <p className="hint">
        Click or drag across cells to paint a beat; click a track name to mute it. Every sound is
        synthesized on the spot: the kick is a sine wave whose pitch falls from 150 to 45 Hz, the
        snare and hats are white noise through filters. Notes are booked {LOOKAHEAD * 1000} ms ahead
        on the audio clock, so timing stays tight even when the page is busy. Swing delays every
        second 16th note; around 33% gives a shuffle.
      </p>
    </>
  )
}
