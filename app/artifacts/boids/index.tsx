import { useRef, useState, type PointerEvent } from 'react'
import { useCanvas, useFrame, type Frame } from '../../kit/canvas'
import { Checkbox, Segmented, Slider } from '../../kit/Controls'
import { buildGrid, createFlock, defaultRules, meanNearest, order, step, type Flock, type Rules } from './flock'
import './style.css'

type PointerMode = 'scare' | 'attract' | 'off'

const TAIL = 10 // remembered positions per boid
const PRESETS: { label: string; rules: Partial<Rules> }[] = [
  { label: 'Murmuration', rules: { separation: 1.6, alignment: 1, cohesion: 0.8, radius: 50 } },
  { label: 'School of fish', rules: { separation: 2.4, alignment: 2.2, cohesion: 0.4, radius: 35 } },
  { label: 'Swarm', rules: { separation: 0.6, alignment: 0, cohesion: 2, radius: 90 } },
  { label: 'Loners', rules: { separation: 3, alignment: 0, cohesion: 0, radius: 60 } },
]

export default function Boids() {
  const [count, setCount] = useState(300)
  const [rules, setRules] = useState<Rules>({ ...defaultRules, wander: 1.5 })
  const [mode, setMode] = useState<PointerMode>('scare')
  const [showVision, setShowVision] = useState(false)
  const [showTails, setShowTails] = useState(true)
  const [running, setRunning] = useState(true)
  const [stats, setStats] = useState({ order: 0, nearest: 0 })

  const flock = useRef<Flock | null>(null)
  const tails = useRef<{ x: number; y: number }[][]>([])
  const pointer = useRef<{ x: number; y: number } | null>(null)
  const frames = useRef(0)

  const set = (patch: Partial<Rules>) => setRules((r) => ({ ...r, ...patch }))

  const scatter = (n: number, width: number, height: number) => {
    flock.current = createFlock(n, width, height)
    tails.current = flock.current.boids.map(() => [])
  }

  const resize = (n: number) => {
    const f = flock.current
    if (!f) return
    while (f.boids.length > n) {
      f.boids.pop()
      tails.current.pop()
    }
    const extra = createFlock(n - f.boids.length, f.width, f.height).boids
    f.boids.push(...extra)
    tails.current.push(...extra.map(() => []))
  }

  const draw = ({ ctx, width, height, color }: Frame) => {
    if (!flock.current) scatter(count, width, height)
    const f = flock.current!
    if (f.width !== width || f.height !== height) {
      for (const b of f.boids) {
        b.x = (b.x / f.width) * width
        b.y = (b.y / f.height) * height
      }
      f.width = width
      f.height = height
      tails.current.forEach((t) => (t.length = 0))
    }

    if (showTails) {
      ctx.lineWidth = 1.2
      f.boids.forEach((b, i) => {
        const tail = tails.current[i]
        if (tail.length < 2) return
        ctx.strokeStyle = `hsl(${(Math.atan2(b.vy, b.vx) * 180) / Math.PI + 180} 70% 60% / 0.35)`
        ctx.beginPath()
        tail.forEach((p, k) => {
          // Don't draw a streak across the screen where a boid wrapped around an edge.
          const prev = tail[k - 1]
          if (k && Math.abs(p.x - prev.x) < 40 && Math.abs(p.y - prev.y) < 40) ctx.lineTo(p.x, p.y)
          else ctx.moveTo(p.x, p.y)
        })
        ctx.stroke()
      })
    }

    if (showVision && f.boids.length) {
      const b = f.boids[0]
      const near = buildGrid(f, rules.radius).neighbors(0)
      ctx.strokeStyle = color('--text')
      ctx.globalAlpha = 0.5
      ctx.lineWidth = 1
      for (const j of near) {
        const o = f.boids[j]
        if (Math.abs(o.x - b.x) > rules.radius || Math.abs(o.y - b.y) > rules.radius) continue // across the wrap
        ctx.beginPath()
        ctx.moveTo(b.x, b.y)
        ctx.lineTo(o.x, o.y)
        ctx.stroke()
      }
      ctx.fillStyle = color('--text')
      ctx.globalAlpha = 0.08
      ctx.beginPath()
      ctx.arc(b.x, b.y, rules.radius, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }

    f.boids.forEach((b, i) => {
      const a = Math.atan2(b.vy, b.vx)
      const highlighted = showVision && i === 0
      const s = highlighted ? 9 : 6
      ctx.fillStyle = highlighted ? color('--text') : `hsl(${(a * 180) / Math.PI + 180} 75% 58%)`
      ctx.beginPath()
      ctx.moveTo(b.x + Math.cos(a) * s, b.y + Math.sin(a) * s)
      ctx.lineTo(b.x + Math.cos(a + 2.5) * s * 0.6, b.y + Math.sin(a + 2.5) * s * 0.6)
      ctx.lineTo(b.x + Math.cos(a - 2.5) * s * 0.6, b.y + Math.sin(a - 2.5) * s * 0.6)
      ctx.closePath()
      ctx.fill()
    })

    const p = pointer.current
    if (p && mode !== 'off') {
      ctx.strokeStyle = color('--cat')
      ctx.setLineDash([3, 5])
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(p.x, p.y, rules.radius * 3, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
    }
  }

  const canvas = useCanvas(draw)

  useFrame((dt) => {
    const f = flock.current
    if (!f || !canvas.ref.current) return
    if (running) {
      const p = pointer.current
      step(f, { ...rules, lure: p && mode !== 'off' ? { ...p, strength: mode === 'scare' ? 5 : -2 } : undefined }, dt)
      f.boids.forEach((b, i) => {
        const tail = tails.current[i]
        tail.push({ x: b.x, y: b.y })
        if (tail.length > TAIL) tail.shift()
      })
    }
    canvas.redraw()
    if (++frames.current % 30 === 0) setStats({ order: order(f), nearest: meanNearest(f) })
  })

  const local = (e: PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  return (
    <>
      <div className="card bo-toolbar">
        <div className="row">
          <button className="primary" onClick={() => setRunning((r) => !r)}>
            {running ? '❚❚ Pause' : '▶ Play'}
          </button>
          <button
            onClick={() => {
              const f = flock.current
              if (f) scatter(count, f.width, f.height)
            }}
          >
            Scatter
          </button>
          <span className="divider" />
          {PRESETS.map((p) => (
            <button key={p.label} className="chip" onClick={() => set(p.rules)}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="bo-sliders">
          <Slider label="Separation" value={rules.separation} min={0} max={4} step={0.1} format={(v) => v.toFixed(1)} onChange={(v) => set({ separation: v })} />
          <Slider label="Alignment" value={rules.alignment} min={0} max={4} step={0.1} format={(v) => v.toFixed(1)} onChange={(v) => set({ alignment: v })} />
          <Slider label="Cohesion" value={rules.cohesion} min={0} max={4} step={0.1} format={(v) => v.toFixed(1)} onChange={(v) => set({ cohesion: v })} />
          <Slider label="Vision" value={rules.radius} min={15} max={120} format={(v) => `${v} px`} onChange={(v) => set({ radius: v })} />
          <Slider label="Top speed" value={rules.maxSpeed} min={40} max={320} step={10} format={(v) => `${v} px/s`} onChange={(v) => set({ maxSpeed: v })} />
          <Slider label="Wander" value={rules.wander} min={0} max={4} step={0.1} format={(v) => v.toFixed(1)} onChange={(v) => set({ wander: v })} />
          <Slider
            label="Boids"
            value={count}
            min={10}
            max={1000}
            step={10}
            onChange={(n) => {
              setCount(n)
              resize(n)
            }}
          />
        </div>
        <div className="row">
          <Segmented
            label="Pointer"
            value={mode}
            options={[
              { value: 'scare', label: 'Hawk (scare)' },
              { value: 'attract', label: 'Bread (attract)' },
              { value: 'off', label: 'Off' },
            ]}
            onChange={setMode}
          />
          <span className="spacer" />
          <Checkbox checked={showTails} onChange={setShowTails}>
            Tails
          </Checkbox>
          <Checkbox checked={showVision} onChange={setShowVision}>
            Show one boid's neighbours
          </Checkbox>
        </div>
      </div>

      <div className="card bo-stage">
        <canvas
          ref={canvas.ref}
          className="canvas bo-canvas"
          aria-label="Flock of boids: move the pointer over it to scare or attract them"
          onPointerMove={(e) => (pointer.current = local(e))}
          onPointerDown={(e) => (pointer.current = local(e))}
          onPointerLeave={() => (pointer.current = null)}
        />
        <div className="bo-stats small">
          <span>
            Polarization <strong>{stats.order.toFixed(2)}</strong>
            <span className="bo-meter">
              <i style={{ width: `${stats.order * 100}%` }} />
            </span>
          </span>
          <span>
            Nearest neighbour <strong>{stats.nearest.toFixed(1)} px</strong> on average
          </span>
        </div>
      </div>

      <p className="hint">
        No boid knows where the flock is going. Each one only sees neighbours within its{' '}
        <strong>vision</strong> radius and steers by three rules: <strong>separation</strong> (don't
        crowd), <strong>alignment</strong> (fly the way they fly) and <strong>cohesion</strong> (drift
        toward their middle). Neighbours are found with a spatial grid, so a thousand boids stay
        cheap. <strong>Polarization</strong> is the length of the average heading: 1 means everyone
        flies the same way. Turn alignment off and watch it fall apart; colours follow heading.
      </p>
    </>
  )
}
