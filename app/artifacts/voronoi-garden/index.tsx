import { useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import { useCanvas, useFrame, type Frame } from '../../kit/canvas'
import { Checkbox, Segmented, Slider } from '../../kit/Controls'
import { cells, nearest, relax, type Cell, type Point } from './voronoi'
import './style.css'

/** Sites live in normalized [0, 1] coordinates, so resizing the canvas keeps the picture. */
interface Site extends Point {
  vx: number
  vy: number
  id: number
}

type ColorMode = 'garden' | 'area' | 'glass'

const GOLDEN = 137.508 // degrees: consecutive ids get well-separated hues
const GRAB_RADIUS = 12
const DRIFT_SPEED = 0.04 // normalized units per second
const RELAX_RATE = 6 // fraction of the way to the centroid per second

let nextId = 0
const makeSite = (x: number, y: number): Site => {
  const a = Math.random() * Math.PI * 2
  return { x, y, vx: Math.cos(a) * DRIFT_SPEED, vy: Math.sin(a) * DRIFT_SPEED, id: nextId++ }
}
const scatter = (n: number) => Array.from({ length: n }, () => makeSite(Math.random(), Math.random()))

const isDark = (hex: string) => {
  const n = parseInt(hex.replace('#', ''), 16)
  return ((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11 < 128
}

export default function VoronoiGarden() {
  const [count, setCount] = useState(40)
  const [mode, setMode] = useState<ColorMode>('garden')
  const [showSites, setShowSites] = useState(true)
  const [showDelaunay, setShowDelaunay] = useState(false)
  const [showCentroids, setShowCentroids] = useState(false)
  const [drift, setDrift] = useState(false)
  const [relaxing, setRelaxing] = useState(false)
  const [hover, setHover] = useState(-1)
  const [, setTick] = useState(0)

  const sites = useRef<Site[]>(scatter(40))
  const size = useRef({ width: 1, height: 1 })
  const latest = useRef<Cell[]>([])
  const drag = useRef<number | null>(null)
  const frames = useRef(0)

  const rerender = () => setTick((t) => t + 1)
  const toPx = (s: Point) => ({ x: s.x * size.current.width, y: s.y * size.current.height })
  const compute = () => {
    latest.current = cells(sites.current.map(toPx), size.current.width, size.current.height)
    return latest.current
  }

  const draw = ({ ctx, width, height, color }: Frame) => {
    size.current = { width, height }
    const list = compute()
    const dark = isDark(color('--bg'))
    const maxArea = Math.max(1, ...list.map((c) => c.area))
    const hovered = list[hover]

    list.forEach((cell, i) => {
      if (cell.polygon.length < 3) return
      const id = sites.current[i].id
      const hue = (id * GOLDEN) % 360
      if (mode === 'garden') ctx.fillStyle = `hsl(${hue} 60% ${dark ? 38 : 76}%)`
      else if (mode === 'glass') ctx.fillStyle = `hsl(${hue} 85% ${dark ? 45 : 55}%)`
      else ctx.fillStyle = `hsl(${210 - 170 * Math.sqrt(cell.area / maxArea)} 70% ${dark ? 42 : 68}%)`
      if (hovered && (i === hover || hovered.neighbors.includes(i))) ctx.globalAlpha = i === hover ? 1 : 0.85
      ctx.beginPath()
      cell.polygon.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
      ctx.closePath()
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.strokeStyle = mode === 'glass' ? '#14161b' : color('--surface')
      ctx.lineWidth = mode === 'glass' ? 4 : 1.5
      ctx.lineJoin = 'round'
      ctx.stroke()
    })

    if (hovered) {
      ctx.strokeStyle = color('--text')
      ctx.lineWidth = 3
      ctx.beginPath()
      hovered.polygon.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
      ctx.closePath()
      ctx.stroke()
    }

    const px = sites.current.map(toPx)
    if (showDelaunay) {
      ctx.strokeStyle = color('--text')
      ctx.globalAlpha = 0.4
      ctx.lineWidth = 1
      ctx.beginPath()
      list.forEach((cell, i) => {
        for (const j of cell.neighbors) {
          if (j < i) continue
          ctx.moveTo(px[i].x, px[i].y)
          ctx.lineTo(px[j].x, px[j].y)
        }
      })
      ctx.stroke()
      ctx.globalAlpha = 1
    }
    if (showCentroids) {
      ctx.strokeStyle = color('--text')
      ctx.lineWidth = 1.5
      for (const cell of list) {
        const { x, y } = cell.centroid
        ctx.beginPath()
        ctx.moveTo(x - 4, y - 4)
        ctx.lineTo(x + 4, y + 4)
        ctx.moveTo(x + 4, y - 4)
        ctx.lineTo(x - 4, y + 4)
        ctx.stroke()
      }
    }
    if (showSites) {
      ctx.fillStyle = color('--text')
      for (const p of px) {
        ctx.beginPath()
        ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  const canvas = useCanvas(draw)

  useFrame((dt) => {
    if (drift) {
      for (const s of sites.current) {
        if (drag.current !== null && sites.current[drag.current] === s) continue
        s.x += s.vx * dt
        s.y += s.vy * dt
        if (s.x < 0 || s.x > 1) s.vx *= -1
        if (s.y < 0 || s.y > 1) s.vy *= -1
        s.x = Math.min(1, Math.max(0, s.x))
        s.y = Math.min(1, Math.max(0, s.y))
      }
    }
    if (relaxing) relaxStep(Math.min(1, RELAX_RATE * dt))
    canvas.redraw()
    if (++frames.current % 20 === 0) rerender() // refresh the stats now and then
  }, drift || relaxing)

  function relaxStep(amount: number) {
    const { width, height } = size.current
    const moved = relax(sites.current.map(toPx), latest.current.length === sites.current.length ? latest.current : compute(), amount)
    moved.forEach((p, i) => {
      if (drag.current === i) return
      sites.current[i].x = p.x / width
      sites.current[i].y = p.y / height
    })
  }

  // ---- Pointer --------------------------------------------------------------

  const local = (e: MouseEvent<HTMLCanvasElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height }
  }

  /** The site under the pointer (within a few pixels), or -1. */
  const siteAt = (p: Point) => {
    const i = nearest(sites.current, p)
    if (i < 0) return -1
    const a = toPx(sites.current[i])
    const b = toPx(p)
    return Math.hypot(a.x - b.x, a.y - b.y) <= GRAB_RADIUS ? i : -1
  }

  const remove = (i: number) => {
    sites.current = sites.current.filter((_, k) => k !== i)
    setHover(-1)
    rerender()
  }

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    const p = local(e)
    const hit = siteAt(p)
    if (e.button === 2 || e.altKey) {
      if (hit >= 0) remove(hit)
      return
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    if (hit >= 0) drag.current = hit
    else {
      sites.current = [...sites.current, makeSite(p.x, p.y)]
      drag.current = sites.current.length - 1
    }
    setHover(drag.current)
    rerender()
  }

  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const p = local(e)
    if (drag.current !== null) {
      const s = sites.current[drag.current]
      s.x = Math.min(1, Math.max(0, p.x))
      s.y = Math.min(1, Math.max(0, p.y))
      canvas.redraw()
      return
    }
    const i = nearest(sites.current, p)
    if (i !== hover) setHover(i)
  }

  // Stats come from the cells at render time (the canvas draws after render).
  const list = cells(sites.current.map(toPx), size.current.width, size.current.height)
  const hovered = list[hover]
  const totalArea = size.current.width * size.current.height
  const avgNeighbors = list.length ? list.reduce((s, c) => s + c.neighbors.length, 0) / list.length : 0

  return (
    <>
      <div className="card vg-toolbar">
        <div className="row">
          <Slider label="Seeds" value={count} min={2} max={400} onChange={setCount} />
          <button
            className="primary"
            onClick={() => {
              sites.current = scatter(count)
              setHover(-1)
              rerender()
            }}
          >
            Scatter {count}
          </button>
          <button
            onClick={() => {
              sites.current = []
              setHover(-1)
              rerender()
            }}
          >
            Clear
          </button>
          <span className="divider" />
          <button
            onClick={() => {
              compute()
              relaxStep(1)
              rerender()
            }}
          >
            Relax once
          </button>
          <Checkbox checked={relaxing} onChange={setRelaxing}>
            Keep relaxing
          </Checkbox>
          <Checkbox checked={drift} onChange={setDrift}>
            Drift
          </Checkbox>
        </div>
        <div className="row">
          <Segmented
            value={mode}
            options={[
              { value: 'garden', label: 'Garden' },
              { value: 'area', label: 'By size' },
              { value: 'glass', label: 'Stained glass' },
            ]}
            onChange={setMode}
          />
          <span className="spacer" />
          <Checkbox checked={showSites} onChange={setShowSites}>
            Seeds
          </Checkbox>
          <Checkbox checked={showDelaunay} onChange={setShowDelaunay}>
            Delaunay triangulation
          </Checkbox>
          <Checkbox checked={showCentroids} onChange={setShowCentroids}>
            Centroids
          </Checkbox>
        </div>
      </div>

      <div className="card vg-stage">
        <canvas
          ref={canvas.ref}
          className="canvas vg-canvas"
          aria-label="Voronoi diagram: click to add a seed, drag to move, right-click to remove"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          onPointerLeave={() => drag.current === null && setHover(-1)}
          onContextMenu={(e) => e.preventDefault()}
          onDoubleClick={(e) => {
            const hit = siteAt(local(e))
            if (hit >= 0) remove(hit)
          }}
        />
        <div className="vg-stats small">
          <span>
            <strong>{sites.current.length}</strong> seeds
          </span>
          <span>
            <strong>{avgNeighbors.toFixed(2)}</strong> neighbours per cell on average
          </span>
          {hovered && (
            <span>
              This cell: <strong>{((hovered.area / totalArea) * 100).toFixed(1)}%</strong> of the area,{' '}
              <strong>{hovered.neighbors.length}</strong> neighbours
            </span>
          )}
        </div>
      </div>

      <p className="hint">
        Every point of the canvas belongs to its nearest seed. Click to plant a seed, drag to move it,
        right-click (or double-click) to remove it. With many seeds, cells average close to six
        neighbours, as in a honeycomb. <strong>Relax</strong> runs Lloyd's algorithm: each seed moves
        to the centre of its cell, and after a few rounds the cells settle into even, almost
        hexagonal tiles.
      </p>
    </>
  )
}
