import { useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { useFrame } from '../../kit/canvas'
import { Slider } from '../../kit/Controls'
import { ease, format, overshoot, parse, point, presets, type Bezier } from './bezier'
import './style.css'

// Editor geometry: x spans 0–1, y spans -0.5–1.5 so "back" curves have room to overshoot.
const PAD = 24
const UX = 260
const UY = 150
const Y_MIN = -0.5
const Y_MAX = 1.5
const WIDTH = UX + 2 * PAD
const HEIGHT = (Y_MAX - Y_MIN) * UY + 2 * PAD
const sx = (x: number) => PAD + x * UX
const sy = (y: number) => PAD + (Y_MAX - y) * UY

const COLORS = ['var(--cat-algorithms)', 'var(--cat-sound)', 'var(--cat-generative)']
const HOLD = 0.45 // seconds to rest at the end before looping

function pathOf(curve: Bezier) {
  const points = Array.from({ length: 61 }, (_, i) => point(curve, i / 60))
  return points.map(([x, y], i) => `${i ? 'L' : 'M'}${sx(x).toFixed(1)} ${sy(y).toFixed(1)}`).join('')
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const round2 = (v: number) => Math.round(v * 100) / 100

export default function EasingStudio() {
  const [curves, setCurves] = useState<Bezier[]>([[0.25, 0.1, 0.25, 1], [0.34, 1.56, 0.64, 1]])
  const [active, setActive] = useState(0)
  const [duration, setDuration] = useState(1000)
  const [playing, setPlaying] = useState(true)
  const [progress, setProgress] = useState(0)
  const [draft, setDraft] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const clock = useRef(0)
  const drag = useRef<1 | 2 | null>(null)

  const curve = curves[active]
  const setCurve = (next: Bezier) => setCurves((list) => list.map((c, i) => (i === active ? next : c)))

  useFrame((dt) => {
    const total = duration / 1000 + HOLD
    clock.current = (clock.current + dt) % total
    setProgress(Math.min(1, clock.current / (duration / 1000)))
  }, playing)

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!drag.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const vx = ((e.clientX - rect.left) / rect.width) * WIDTH
    const vy = ((e.clientY - rect.top) / rect.height) * HEIGHT
    const x = round2(clamp((vx - PAD) / UX, 0, 1))
    const y = round2(clamp(Y_MAX - (vy - PAD) / UY, Y_MIN, Y_MAX))
    const next: Bezier = [...curve]
    if (drag.current === 1) [next[0], next[1]] = [x, y]
    else [next[2], next[3]] = [x, y]
    setCurve(next)
    setDraft(null)
  }

  const handle = (which: 1 | 2) => {
    const [x, y] = which === 1 ? [curve[0], curve[1]] : [curve[2], curve[3]]
    const [ax, ay] = which === 1 ? [0, 0] : [1, 1]
    return (
      <g key={which}>
        <line x1={sx(ax)} y1={sy(ay)} x2={sx(x)} y2={sy(y)} className="ez-arm" />
        <circle
          cx={sx(x)}
          cy={sy(y)}
          r={9}
          className="ez-handle"
          style={{ fill: COLORS[active] }}
          onPointerDown={(e) => {
            ;(e.currentTarget.ownerSVGElement as SVGSVGElement).setPointerCapture(e.pointerId)
            drag.current = which
          }}
        />
      </g>
    )
  }

  const css = format(curve)
  const { above, below } = overshoot(curve)
  const y = ease(curve, progress)
  const parsedDraft = draft === null ? null : parse(draft)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`transition-timing-function: ${css};`)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      // Clipboard blocked: the value is visible in the input.
    }
  }

  return (
    <>
      <div className="ez-layout">
        <div className="card ez-editor">
          <div className="row">
            {curves.map((c, i) => (
              <button
                key={i}
                className={`chip${i === active ? ' active' : ''}`}
                onClick={() => {
                  setActive(i)
                  setDraft(null)
                }}
              >
                <i className="dot" style={{ background: COLORS[i] }} /> {String.fromCharCode(65 + i)}: {format(c)}
              </button>
            ))}
            {curves.length < 3 && (
              <button className="chip" onClick={() => {
                setCurves((list) => [...list, [0.65, 0, 0.35, 1]])
                setActive(curves.length)
              }}>
                + Compare
              </button>
            )}
            {curves.length > 1 && (
              <button
                className="chip"
                onClick={() => {
                  setCurves((list) => list.filter((_, i) => i !== active))
                  setActive(0)
                }}
              >
                Remove {String.fromCharCode(65 + active)}
              </button>
            )}
          </div>

          <svg
            className="ez-svg"
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            onPointerMove={onPointerMove}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
            role="group"
            aria-label="Bézier curve editor: drag the two handles"
          >
            {[0, 0.25, 0.5, 0.75, 1].map((v) => (
              <g key={v} className="ez-grid">
                <line x1={sx(v)} y1={sy(Y_MIN)} x2={sx(v)} y2={sy(Y_MAX)} />
                <line x1={sx(0)} y1={sy(v)} x2={sx(1)} y2={sy(v)} />
              </g>
            ))}
            <rect x={sx(0)} y={sy(1)} width={UX} height={UY} className="ez-unit" />
            <line x1={sx(0)} y1={sy(0)} x2={sx(1)} y2={sy(1)} className="ez-linear" />
            <text x={sx(0)} y={sy(0) + 16} className="ez-axis">0</text>
            <text x={sx(1)} y={sy(0) + 16} className="ez-axis" textAnchor="end">time →</text>
            <text x={sx(0) - 6} y={sy(1) + 4} className="ez-axis" textAnchor="end">1</text>

            {curves.map((c, i) =>
              i === active ? null : <path key={i} d={pathOf(c)} className="ez-curve faint" style={{ stroke: COLORS[i] }} />,
            )}
            <path d={pathOf(curve)} className="ez-curve" style={{ stroke: COLORS[active] }} />
            <line x1={sx(progress)} y1={sy(Y_MIN)} x2={sx(progress)} y2={sy(Y_MAX)} className="ez-time" />
            {curves.map((c, i) => (
              <circle key={i} cx={sx(progress)} cy={sy(ease(c, progress))} r={4} style={{ fill: COLORS[i] }} />
            ))}
            {handle(1)}
            {handle(2)}
          </svg>

          <label className={`ez-input${draft !== null && !parsedDraft ? ' invalid' : ''}`}>
            <span className="muted small">CSS (edit or paste)</span>
            <input
              value={draft ?? css}
              spellCheck={false}
              onChange={(e) => {
                setDraft(e.target.value)
                const parsed = parse(e.target.value)
                if (parsed) setCurve(parsed)
              }}
              onBlur={() => setDraft(null)}
            />
          </label>
          <div className="row">
            <button className="primary" onClick={copy}>
              {copied ? 'Copied ✓' : 'Copy CSS'}
            </button>
            <span className="muted small">
              {above > 0.005 || below > 0.005
                ? `Overshoots ${above > 0.005 ? `${Math.round(above * 100)}% past the end` : ''}${above > 0.005 && below > 0.005 ? ' and ' : ''}${below > 0.005 ? `${Math.round(below * 100)}% before the start` : ''}`
                : 'Stays within 0–100%'}
            </span>
          </div>
        </div>

        <div className="ez-side">
          <div className="card">
            <h3>Presets</h3>
            <div className="presets">
              {presets.map((p) => (
                <button
                  key={p.name}
                  className={`chip${format(p.curve) === css ? ' active' : ''}`}
                  onClick={() => {
                    setCurve([...p.curve])
                    setDraft(null)
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="row">
              <h3>Motion</h3>
              <span className="spacer" />
              <button className="chip" onClick={() => setPlaying((p) => !p)}>
                {playing ? '❚❚ Pause' : '▶ Play'}
              </button>
            </div>
            {curves.map((c, i) => {
              const v = ease(c, progress)
              return (
                <div key={i} className="ez-track">
                  <span className="ez-ball" style={{ left: `${v * 100}%`, transform: `translateX(-${v * 100}%)`, background: COLORS[i] }} />
                </div>
              )
            })}
            <div className="ez-demos" style={{ '--c': COLORS[active] } as CSSProperties}>
              <div>
                <span className="ez-box" style={{ transform: `scale(${0.3 + 0.7 * y})` }} />
                <span className="small muted">scale</span>
              </div>
              <div>
                <span className="ez-box" style={{ transform: `rotate(${y * 180}deg)` }} />
                <span className="small muted">rotate</span>
              </div>
              <div>
                <span className="ez-box" style={{ opacity: Math.min(1, Math.max(0, y)) }} />
                <span className="small muted">opacity</span>
              </div>
              <div>
                <span className="ez-bar">
                  <span style={{ width: `${Math.max(0, y) * 100}%` }} />
                </span>
                <span className="small muted">width</span>
              </div>
            </div>
            <Slider
              label="Time"
              value={Math.round(progress * 100)}
              min={0}
              max={100}
              format={(v) => `${v}% → progress ${Math.round(y * 100)}%`}
              onChange={(v) => {
                setPlaying(false)
                clock.current = (v / 100) * (duration / 1000)
                setProgress(v / 100)
              }}
            />
            <Slider label="Duration" value={duration} min={200} max={3000} step={50} format={(v) => `${v} ms`} onChange={setDuration} />
          </div>
        </div>
      </div>
      <p className="hint">
        A timing function maps time (x) to progress (y). The two handles are the Bézier control
        points: steep at the start means a fast start. Their x must stay between 0 and 1, but y can
        leave the box, which makes the motion overshoot and bounce back.
      </p>
    </>
  )
}
