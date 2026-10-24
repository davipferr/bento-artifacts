import { useRef, useState, type PointerEvent } from 'react'
import { useCanvas, useFrame, type Frame } from '../../kit/canvas'
import { Checkbox, Slider } from '../../kit/Controls'
import { advance, defaults, energy, ensemble, positions, separation, type State } from './pendulum'
import './style.css'

interface Point {
  x: number
  y: number
}

const PRESETS = [
  { label: 'Chaos', t1: 2.0, t2: 2.6 },
  { label: 'Normal mode', t1: 0.4, t2: 0.4 * Math.SQRT2 },
  { label: 'Almost upright', t1: Math.PI - 0.02, t2: Math.PI },
  { label: 'Whip', t1: 0.2, t2: Math.PI - 0.15 },
] as const

const GRAB_RADIUS = 22
const SAMPLE_EVERY = 0.05 // seconds of simulated time between separation samples
const MAX_SAMPLES = 2000
const trailLength = (n: number) => (n <= 3 ? 420 : n <= 20 ? 140 : 50)
const hueOf = (i: number, n: number) => (n === 1 ? 265 : (i / (n - 1)) * 300)
const sci = (v: number) => (v === 0 ? '0' : v.toExponential(1).replace('e', '·10^').replace('+', ''))

export default function DoublePendulum() {
  const [count, setCount] = useState(40)
  const [spreadExp, setSpreadExp] = useState(-6)
  const [speed, setSpeed] = useState(1)
  const [showTrails, setShowTrails] = useState(true)
  const [showRods, setShowRods] = useState(true)
  const [running, setRunning] = useState(true)
  const [, setTick] = useState(0)

  const start = useRef<State>({ t1: PRESETS[0].t1, t2: PRESETS[0].t2, w1: 0, w2: 0 })
  const sims = useRef<State[]>(ensemble(start.current, 40, 1e-6))
  const trails = useRef<Point[][]>(sims.current.map(() => []))
  const samples = useRef<{ t: number; log: number }[]>([])
  const time = useRef(0)
  const nextSample = useRef(0)
  const energy0 = useRef(energy(start.current, defaults))
  const drag = useRef<1 | 2 | null>(null)
  const geometry = useRef({ cx: 0, cy: 0, scale: 1 })
  const frames = useRef(0)

  const reset = (from = start.current, n = count, spread = 10 ** spreadExp) => {
    start.current = { ...from, w1: 0, w2: 0 }
    sims.current = ensemble(start.current, n, spread)
    trails.current = sims.current.map(() => [])
    samples.current = []
    time.current = 0
    nextSample.current = 0
    energy0.current = energy(start.current, defaults)
    setTick((t) => t + 1)
  }

  const draw = ({ ctx, width, height, color }: Frame) => {
    const reach = defaults.l1 + defaults.l2
    const scale = (Math.min(width, height) / 2 - 16) / reach
    const cx = width / 2
    const cy = height / 2
    geometry.current = { cx, cy, scale }
    const toPx = (x: number, y: number) => [cx + x * scale, cy + y * scale] as const
    const n = sims.current.length

    ctx.strokeStyle = color('--grid')
    ctx.setLineDash([4, 6])
    ctx.beginPath()
    ctx.arc(cx, cy, reach * scale, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])

    if (showTrails) {
      ctx.lineWidth = n > 20 ? 1 : 1.5
      ctx.lineJoin = 'round'
      trails.current.forEach((trail, i) => {
        // Four chunks, older ones fainter, so the trail fades out behind the bob.
        const chunk = Math.ceil(trail.length / 4)
        for (let c = 0; c < 4; c++) {
          const part = trail.slice(c * chunk, (c + 1) * chunk + 1)
          if (part.length < 2) continue
          ctx.strokeStyle = `hsl(${hueOf(i, n)} 80% 58% / ${(n > 20 ? 0.16 : 0.3) * (c + 1)})`
          ctx.beginPath()
          part.forEach((p, k) => (k ? ctx.lineTo(...toPx(p.x, p.y)) : ctx.moveTo(...toPx(p.x, p.y))))
          ctx.stroke()
        }
      })
    }

    sims.current.forEach((s, i) => {
      const { x1, y1, x2, y2 } = positions(s, defaults)
      const hue = hueOf(i, n)
      if (showRods || n === 1) {
        ctx.strokeStyle = `hsl(${hue} 70% 55% / ${n > 20 ? 0.45 : 0.85})`
        ctx.lineWidth = n > 20 ? 1.5 : 3
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(...toPx(x1, y1))
        ctx.lineTo(...toPx(x2, y2))
        ctx.stroke()
      }
      ctx.fillStyle = `hsl(${hue} 80% 58%)`
      for (const [x, y, r] of [
        [x1, y1, n > 20 ? 3 : 6],
        [x2, y2, n > 20 ? 4 : 8],
      ] as const) {
        ctx.beginPath()
        ctx.arc(...toPx(x, y), r, 0, Math.PI * 2)
        ctx.fill()
      }
    })

    ctx.fillStyle = color('--text')
    ctx.beginPath()
    ctx.arc(cx, cy, 4, 0, Math.PI * 2)
    ctx.fill()
  }

  const drawChart = ({ ctx, width, height, color }: Frame) => {
    const list = samples.current
    const pad = { left: 46, right: 10, top: 10, bottom: 20 }
    const lo = -12
    const hi = 2
    const t0 = list.length ? list[0].t : 0
    const t1 = Math.max(t0 + 10, list.length ? list[list.length - 1].t : 0)
    const x = (t: number) => pad.left + ((t - t0) / (t1 - t0)) * (width - pad.left - pad.right)
    const y = (log: number) => pad.top + ((hi - Math.max(lo, Math.min(hi, log))) / (hi - lo)) * (height - pad.top - pad.bottom)

    ctx.fillStyle = color('--muted')
    ctx.strokeStyle = color('--grid')
    ctx.lineWidth = 1
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    for (let e = lo; e <= hi; e += 2) {
      ctx.beginPath()
      ctx.moveTo(pad.left, y(e))
      ctx.lineTo(width - pad.right, y(e))
      ctx.stroke()
      ctx.fillText(`10^${e}`, pad.left - 6, y(e))
    }
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    for (let t = Math.ceil(t0 / 5) * 5; t <= t1; t += 5) ctx.fillText(`${t}s`, x(t), height - pad.bottom + 5)

    if (list.length < 2) return
    ctx.strokeStyle = color('--cat')
    ctx.lineWidth = 2
    ctx.beginPath()
    list.forEach((s, k) => (k ? ctx.lineTo(x(s.t), y(s.log)) : ctx.moveTo(x(s.t), y(s.log))))
    ctx.stroke()
  }

  const canvas = useCanvas(draw)
  const chart = useCanvas(drawChart)

  useFrame((dt) => {
    const list = sims.current
    const simDt = dt * speed
    const limit = trailLength(list.length)
    list.forEach((s, i) => {
      advance(s, defaults, simDt)
      const { x2, y2 } = positions(s, defaults)
      const trail = trails.current[i]
      trail.push({ x: x2, y: y2 })
      if (trail.length > limit) trail.shift()
    })
    time.current += simDt
    if (list.length > 1 && time.current >= nextSample.current) {
      nextSample.current = time.current + SAMPLE_EVERY
      const d = separation(list[0], list[list.length - 1])
      samples.current.push({ t: time.current, log: Math.log10(Math.max(d, 1e-15)) })
      if (samples.current.length > MAX_SAMPLES) samples.current.shift()
    }
    canvas.redraw()
    chart.redraw()
    if (++frames.current % 12 === 0) setTick((t) => t + 1)
  }, running && drag.current === null)

  // ---- Pointer: drag either bob of the first pendulum to set the start ---------------

  const local = (e: PointerEvent<HTMLCanvasElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    const p = local(e)
    const { cx, cy, scale } = geometry.current
    const { x1, y1, x2, y2 } = positions(sims.current[0] ?? start.current, defaults)
    const d1 = Math.hypot(p.x - (cx + x1 * scale), p.y - (cy + y1 * scale))
    const d2 = Math.hypot(p.x - (cx + x2 * scale), p.y - (cy + y2 * scale))
    if (Math.min(d1, d2) > GRAB_RADIUS) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = d2 <= d1 ? 2 : 1
    // Freeze the first pendulum's current pose as the new start, alone, while dragging.
    reset(sims.current[0] ?? start.current, 1, 0)
  }

  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (drag.current === null) return
    const p = local(e)
    const { cx, cy, scale } = geometry.current
    const s = start.current
    if (drag.current === 1) s.t1 = Math.atan2(p.x - cx, p.y - cy)
    else {
      const { x1, y1 } = positions(s, defaults)
      s.t2 = Math.atan2(p.x - (cx + x1 * scale), p.y - (cy + y1 * scale))
    }
    sims.current = [{ ...s }]
    trails.current = [[]]
    canvas.redraw()
  }

  const onPointerUp = () => {
    if (drag.current === null) return
    drag.current = null
    reset(start.current)
    setRunning(true)
  }

  const list = sims.current
  const last = samples.current[samples.current.length - 1]
  const drift = Math.abs(energy(list[0] ?? start.current, defaults) - energy0.current) / Math.max(1e-9, Math.abs(energy0.current))

  return (
    <>
      <div className="card dp-toolbar">
        <div className="row">
          <button className="primary" onClick={() => setRunning((r) => !r)}>
            {running ? '❚❚ Pause' : '▶ Play'}
          </button>
          <button onClick={() => reset()}>Restart</button>
          <span className="divider" />
          {PRESETS.map((p) => (
            <button key={p.label} className="chip" onClick={() => reset({ t1: p.t1, t2: p.t2, w1: 0, w2: 0 })}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="dp-sliders">
          <Slider
            label="Pendulums"
            value={count}
            min={1}
            max={200}
            onChange={(n) => {
              setCount(n)
              reset(start.current, n)
            }}
          />
          <Slider
            label="Total spread"
            value={spreadExp}
            min={-12}
            max={-1}
            format={(v) => `10^${v} rad`}
            onChange={(v) => {
              setSpreadExp(v)
              reset(start.current, count, 10 ** v)
            }}
          />
          <Slider label="Speed" value={speed} min={0.1} max={2} step={0.05} format={(v) => `${v.toFixed(2)}×`} onChange={setSpeed} />
        </div>
        <div className="row">
          <Checkbox checked={showTrails} onChange={setShowTrails}>
            Trails
          </Checkbox>
          <Checkbox checked={showRods} onChange={setShowRods}>
            Rods
          </Checkbox>
        </div>
      </div>

      <div className="dp-layout">
        <div className="card dp-stage">
          <canvas
            ref={canvas.ref}
            className="canvas dp-canvas"
            aria-label="Double pendulums: drag a bob of the pendulum to choose the starting angles"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
        </div>
        <div className="card dp-side">
          <h2>How far apart?</h2>
          <p className="small muted">
            Distance in phase space between the first and the last pendulum, on a log scale. A straight
            climb means the gap multiplies by the same factor every second.
          </p>
          <canvas ref={chart.ref} className="canvas dp-chart" aria-label="Separation over time, log scale" />
          <div className="dp-stats small">
            <span>
              Time <strong>{time.current.toFixed(1)} s</strong>
            </span>
            <span>
              Gap <strong>{list.length > 1 && last ? sci(10 ** last.log) : '—'}</strong>
            </span>
            <span>
              Energy error <strong>{sci(drift)}</strong>
            </span>
          </div>
        </div>
      </div>

      <p className="hint">
        Each pendulum is two rods with a weight at each end, integrated with fourth-order Runge–Kutta
        at 600 steps per simulated second. They all start a hair apart in the lower angle, spread over
        the <strong>total spread</strong>. At low energy (try <strong>Normal mode</strong>) they stay
        together forever; with enough energy the tiny gap grows exponentially until the pendulums swing
        completely independently. That is deterministic chaos: no randomness anywhere, yet the future is
        unpredictable past a few seconds. Drag a weight to pick your own start.
      </p>
    </>
  )
}
