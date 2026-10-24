import { useMemo, useRef, useState } from 'react'
import { useFrame } from '../../kit/canvas'
import { Checkbox, Segmented, Slider } from '../../kit/Controls'
import { EASINGS, ends, lerpIcon, PAIRS, toPath, type Easing, type Icon, type Pair } from './morph'
import './style.css'

const EASING_OPTIONS = [
  { value: 'easeInOut', label: 'Ease in-out' },
  { value: 'linear', label: 'Linear' },
  { value: 'overshoot', label: 'Overshoot' },
] as const

/** Where each pair's morph is: animating from `from` to `to` since `start` (ms). */
interface Motion {
  from: number
  to: number
  start: number
}

function Glyph({ icon, size, strokeWidth = 2 }: { icon: Icon; size: number; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden className="mi-glyph">
      {icon.map((shape, i) => (
        <path
          key={i}
          d={toPath(shape)}
          className={shape.closed ? 'fill' : 'stroke'}
          style={shape.closed ? undefined : { strokeWidth }}
        />
      ))}
    </svg>
  )
}

export default function MorphingIcons() {
  const [duration, setDuration] = useState(400)
  const [easing, setEasing] = useState<Easing>('easeInOut')
  const [matched, setMatched] = useState(true)
  const [showPoints, setShowPoints] = useState(true)
  const [selected, setSelected] = useState(PAIRS[0].id)
  const [scrub, setScrub] = useState<number | null>(null)
  const motions = useRef(new Map<string, Motion>(PAIRS.map((p) => [p.id, { from: 0, to: 0, start: 0 }])))
  const [animating, setAnimating] = useState(false)
  const [, setTick] = useState(0)

  /** Linear progress 0…1 toward the pair's end state, as of now. */
  const raw = (id: string, now = performance.now()) => {
    const m = motions.current.get(id)!
    const k = Math.min(1, (now - m.start) / duration)
    return m.from + (m.to - m.from) * k
  }
  const value = (id: string) => {
    const m = motions.current.get(id)!
    const k = Math.min(1, (performance.now() - m.start) / duration)
    // Ease the journey, not the position, so reversing mid-way stays smooth.
    return m.from + (m.to - m.from) * EASINGS[easing](k)
  }

  useFrame(() => {
    setTick((n) => n + 1)
    const now = performance.now()
    const busy = [...motions.current.values()].some((m) => now - m.start < duration)
    if (!busy) setAnimating(false)
  }, animating)

  const toggle = (pair: Pair) => {
    const now = performance.now()
    const current = raw(pair.id, now)
    const m = motions.current.get(pair.id)!
    motions.current.set(pair.id, { from: current, to: m.to === 1 ? 0 : 1, start: now })
    setSelected(pair.id)
    setScrub(null)
    setAnimating(true)
  }

  const cache = useMemo(() => new Map(PAIRS.map((p) => [p.id, ends(p, matched)])), [matched])
  const iconAt = (pair: Pair, t: number) => {
    const [a, b] = cache.get(pair.id)!
    return lerpIcon(a, b, t)
  }

  const pair = PAIRS.find((p) => p.id === selected)!
  const t = scrub ?? value(pair.id)
  const [a, b] = cache.get(pair.id)!
  const big = lerpIcon(a, b, t)
  const pointCount = a.reduce((n, s) => n + s.points.length, 0)

  return (
    <>
      <div className="card mi-buttons">
        <p className="muted small">Click an icon to morph it. Each is a single set of points moving, not a crossfade.</p>
        <div className="mi-row">
          {PAIRS.map((p) => {
            const end = motions.current.get(p.id)!.to
            return (
              <button
                key={p.id}
                className={`mi-button${selected === p.id ? ' selected' : ''}`}
                aria-pressed={end === 1}
                aria-label={`${p.label[end]}: click to switch to ${p.label[1 - end]}`}
                onClick={() => toggle(p)}
              >
                <Glyph icon={iconAt(p, value(p.id))} size={34} />
                <span className="small">{p.label[end]}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mi-layout">
        <div className="card mi-inspector">
          <svg viewBox="-1 -1 26 26" className="mi-big" role="img" aria-label={`${pair.label[0]} to ${pair.label[1]} at ${Math.round(t * 100)}%`}>
            <defs>
              <pattern id="mi-grid" width="1" height="1" patternUnits="userSpaceOnUse">
                <path d="M1 0H0V1" className="mi-grid-line" />
              </pattern>
            </defs>
            <rect x="0" y="0" width="24" height="24" fill="url(#mi-grid)" />
            {showPoints &&
              a.map((shape, s) =>
                shape.points.map((p, i) => {
                  const q = b[s].points[i]
                  return <line key={`${s}-${i}`} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} className="mi-trail" />
                }),
              )}
            {big.map((shape, i) => (
              <path key={i} d={toPath(shape)} className={shape.closed ? 'fill' : 'stroke'} />
            ))}
            {showPoints &&
              big.map((shape, s) =>
                shape.points.map((p, i) => (
                  <circle key={`${s}-${i}`} cx={p[0]} cy={p[1]} r={pointCount > 24 ? 0.24 : 0.4} style={{ fill: `hsl(${(i / shape.points.length) * 300 + s * 50} 80% 55%)` }} />
                )),
              )}
          </svg>
          <Slider
            label={`${pair.label[0]} → ${pair.label[1]}`}
            value={Math.round(t * 1000) / 1000}
            min={0}
            max={1}
            step={0.001}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => setScrub(v)}
          />
          {scrub !== null && (
            <button className="chip" onClick={() => setScrub(null)}>
              Back to the animation
            </button>
          )}
        </div>

        <div className="card mi-side">
          <Slider label="Duration (slow-mo)" value={duration} min={150} max={4000} step={50} format={(v) => `${v} ms`} onChange={setDuration} />
          <Segmented label="Easing" value={easing} options={EASING_OPTIONS} onChange={setEasing} />
          <Checkbox checked={showPoints} onChange={setShowPoints}>
            Show points and where each one travels
          </Checkbox>
          <Checkbox checked={matched} onChange={setMatched}>
            Match points (resample + align) for outline pairs
          </Checkbox>
          <div className="mi-facts small">
            <span>Shapes</span>
            <b>{a.length}</b>
            <span>Points</span>
            <b>{pointCount}</b>
            <span>Made by</span>
            <b>{pair.outlines ? (matched ? 'resampling to 64 + best rotation' : 'padding the shorter outline') : 'hand, point for point'}</b>
          </div>
          <p className="callout small">
            A morph moves point <em>i</em> of one shape to point <em>i</em> of the other, so both need the same count, in the same
            winding, starting near each other. Turn off matching on <strong>Heart → Star</strong> to see the mess you get
            otherwise. Play → Pause works because the triangle is drawn as two quads.
          </p>
        </div>
      </div>
    </>
  )
}
