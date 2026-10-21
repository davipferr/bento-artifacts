import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { useFrame } from '../../kit/canvas'
import { Slider } from '../../kit/Controls'
import { brush, count, createWorld, EMPTY, FIRE, materials, scene, SMOKE, update, type World } from './sand'
import './style.css'

const CELL = 4 // CSS pixels per grid cell
const ASPECT = 0.6
const BACKGROUND: [number, number, number] = [13, 15, 20]
const SCENES = [
  { value: 'beach', label: 'Beach' },
  { value: 'campfire', label: 'Campfire' },
  { value: 'garden', label: 'Garden' },
  { value: 'hourglass', label: 'Hourglass' },
] as const

const colorOf = new Map(materials.map((m) => [m.id, m.color]))

function paint(world: World, image: ImageData) {
  const { cell, shade, life } = world
  const data = image.data
  for (let i = 0; i < cell.length; i++) {
    const m = cell[i]
    let [r, g, b] = m === EMPTY ? BACKGROUND : colorOf.get(m)!
    if (m === FIRE) {
      // Young flames are yellow, dying ones deep red.
      const t = Math.min(1, life[i] / 60)
      r = 255
      g = 60 + 170 * t
      b = 20 + 40 * t
    } else if (m === SMOKE) {
      const t = Math.min(1, life[i] / 120)
      r = BACKGROUND[0] + (r - BACKGROUND[0]) * t
      g = BACKGROUND[1] + (g - BACKGROUND[1]) * t
      b = BACKGROUND[2] + (b - BACKGROUND[2]) * t
    } else if (m !== EMPTY) {
      const k = 0.88 + (shade[i] / 255) * 0.24
      r *= k
      g *= k
      b *= k
    }
    data[i * 4] = r
    data[i * 4 + 1] = g
    data[i * 4 + 2] = b
    data[i * 4 + 3] = 255
  }
}

export default function PixelSandbox() {
  const [material, setMaterial] = useState(materials[0].id)
  const [size, setSize] = useState(3)
  const [speed, setSpeed] = useState(2)
  const [running, setRunning] = useState(true)
  const [counts, setCounts] = useState<Map<number, number>>(new Map())

  const canvas = useRef<HTMLCanvasElement>(null)
  const world = useRef<World | null>(null)
  const image = useRef<ImageData | null>(null)
  const pointer = useRef<{ x: number; y: number; last: { x: number; y: number } | null } | null>(null)
  const frames = useRef(0)

  // The grid size is fixed from the canvas width at first layout; CSS scales it after that.
  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const width = Math.max(60, Math.round(el.clientWidth / CELL))
    const height = Math.round(width * ASPECT)
    el.width = width
    el.height = height
    world.current = createWorld(width, height)
    image.current = el.getContext('2d')!.createImageData(width, height)
    scene(world.current, 'beach')
  }, [])

  const toCell = (e: PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const w = world.current!
    return { x: Math.floor(((e.clientX - rect.left) / rect.width) * w.width), y: Math.floor(((e.clientY - rect.top) / rect.height) * w.height) }
  }

  /** Paint along the line from the last pointer cell, so fast strokes stay continuous. */
  const stroke = () => {
    const w = world.current
    const p = pointer.current
    if (!w || !p) return
    const from = p.last ?? p
    const steps = Math.max(1, Math.abs(p.x - from.x), Math.abs(p.y - from.y))
    for (let k = 0; k <= steps; k++) {
      brush(w, Math.round(from.x + ((p.x - from.x) * k) / steps), Math.round(from.y + ((p.y - from.y) * k) / steps), size, material)
    }
    p.last = { x: p.x, y: p.y }
  }

  useFrame(() => {
    const w = world.current
    const img = image.current
    // A frame can land after unmount has detached the ref but before the loop is cancelled.
    if (!w || !img || !canvas.current) return
    stroke() // holding still keeps pouring
    if (running) for (let i = 0; i < speed; i++) update(w)
    paint(w, img)
    canvas.current!.getContext('2d')!.putImageData(img, 0, 0)
    if (++frames.current % 15 === 0) setCounts(count(w))
  })

  const step = () => {
    if (world.current) update(world.current)
  }

  return (
    <>
      <div className="card ps-toolbar">
        <div className="row ps-materials">
          {materials.map((m) => (
            <button
              key={m.id}
              className={`ps-material${m.id === material ? ' active' : ''}`}
              onClick={() => setMaterial(m.id)}
              aria-pressed={m.id === material}
            >
              <i style={{ background: `rgb(${m.color.join(',')})` }} />
              {m.name}
              {m.id !== EMPTY && <span className="count">{counts.get(m.id) ?? 0}</span>}
            </button>
          ))}
        </div>
        <div className="row">
          <button className="primary" onClick={() => setRunning((r) => !r)}>
            {running ? '❚❚ Pause' : '▶ Play'}
          </button>
          <button onClick={step} disabled={running}>
            Step
          </button>
          <button
            onClick={() => {
              if (world.current) world.current.cell.fill(EMPTY)
            }}
          >
            Clear
          </button>
          <span className="divider" />
          {SCENES.map((s) => (
            <button key={s.value} className="chip" onClick={() => world.current && scene(world.current, s.value)}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="ps-sliders">
          <Slider label="Brush" value={size} min={0} max={12} format={(v) => `${v * 2 + 1} cells`} onChange={setSize} />
          <Slider label="Speed" value={speed} min={1} max={6} format={(v) => `${v} steps/frame`} onChange={setSpeed} />
        </div>
      </div>

      <div className="ps-stage">
        <canvas
          ref={canvas}
          className="ps-canvas"
          style={{ aspectRatio: `${1 / ASPECT}` }}
          aria-label="Sandbox: press and drag to pour the selected material"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            pointer.current = { ...toCell(e), last: null }
          }}
          onPointerMove={(e) => {
            if (pointer.current) pointer.current = { ...toCell(e), last: pointer.current.last }
          }}
          onPointerUp={() => (pointer.current = null)}
          onPointerCancel={() => (pointer.current = null)}
        />
      </div>

      <p className="hint">
        Every pixel follows a few local rules each step: sand falls and slides off slopes, water and oil
        fall and then spread sideways, oil is lighter so it floats, smoke rises and fades, fire spreads
        to wood, oil and plants and turns to steam in water, and plants grow by drinking the water next
        to them. Press and hold to keep pouring.
      </p>
    </>
  )
}
