import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { useCanvas, useFrame, type Frame } from '../../kit/canvas'
import { Segmented, Slider } from '../../kit/Controls'
import { bounds, key, parseRle, parseRule, patterns, rotate, rules, step, unkey } from './life'
import './style.css'

type Tool = 'draw' | 'stamp' | 'pan'

/** Generations per second for each notch; the last notch runs as many as fit in a frame. */
const SPEEDS = [1, 2, 5, 10, 20, 30, 60, Infinity]
const HISTORY = 240
const MIN_CELL = 2
const MAX_CELL = 40

interface ViewState {
  /** World coordinates of the canvas's top-left corner (in cells). */
  ox: number
  oy: number
  /** CSS pixels per cell. */
  cell: number
}

const start = () => new Set(parseRle(patterns.find((p) => p.name === 'Gosper glider gun')!.rle).map(([x, y]) => key(x + 4, y + 6)))

export default function GameOfLife() {
  const [ruleText, setRuleText] = useState('B3/S23')
  const [tool, setTool] = useState<Tool>('draw')
  const [patternIndex, setPatternIndex] = useState(0)
  const [turns, setTurns] = useState(0)
  const [speedIndex, setSpeedIndex] = useState(4)
  const [running, setRunning] = useState(false)
  const [, setTick] = useState(0)

  const cells = useRef<Set<number>>(start())
  const generation = useRef(0)
  const history = useRef<number[]>([])
  const view = useRef<ViewState>({ ox: -2, oy: -2, cell: 14 })
  const hover = useRef<[number, number] | null>(null)
  const drag = useRef<{ mode: 'paint' | 'pan'; alive: boolean; lastX: number; lastY: number; lastCell: string } | null>(null)
  const pending = useRef(0)

  const rule = useMemo(() => parseRule(ruleText), [ruleText])
  const stamp = useMemo(() => {
    let shape = parseRle(patterns[patternIndex].rle)
    for (let i = 0; i < turns % 4; i++) shape = rotate(shape)
    return shape
  }, [patternIndex, turns])

  const rerender = () => setTick((t) => t + 1)

  const draw = ({ ctx, width, height, color }: Frame) => {
    const { ox, oy, cell } = view.current
    ctx.fillStyle = color('--bg')
    ctx.fillRect(0, 0, width, height)

    if (cell >= 8) {
      ctx.strokeStyle = color('--grid')
      ctx.lineWidth = 1
      ctx.beginPath()
      const fx = Math.floor(ox)
      const fy = Math.floor(oy)
      for (let x = fx; x <= ox + width / cell; x++) {
        const px = Math.round((x - ox) * cell) + 0.5
        ctx.moveTo(px, 0)
        ctx.lineTo(px, height)
      }
      for (let y = fy; y <= oy + height / cell; y++) {
        const py = Math.round((y - oy) * cell) + 0.5
        ctx.moveTo(0, py)
        ctx.lineTo(width, py)
      }
      ctx.stroke()
    }

    ctx.fillStyle = color('--cat')
    const gap = cell >= 6 ? 1 : 0
    for (const k of cells.current) {
      const [x, y] = unkey(k)
      const px = (x - ox) * cell
      const py = (y - oy) * cell
      if (px < -cell || py < -cell || px > width || py > height) continue
      ctx.fillRect(px + gap, py + gap, cell - gap, cell - gap)
    }

    if (tool === 'stamp' && hover.current) {
      ctx.globalAlpha = 0.4
      ctx.fillStyle = color('--text')
      const [hx, hy] = hover.current
      for (const [x, y] of stamp) ctx.fillRect((hx + x - ox) * cell, (hy + y - oy) * cell, cell, cell)
      ctx.globalAlpha = 1
    }
  }

  const drawSpark = ({ ctx, width, height, color }: Frame) => {
    const h = history.current
    if (h.length < 2) return
    const max = Math.max(...h, 1)
    ctx.strokeStyle = color('--cat')
    ctx.lineWidth = 1.5
    ctx.beginPath()
    h.forEach((v, i) => {
      const x = (i / (HISTORY - 1)) * width
      const y = height - 2 - (v / max) * (height - 4)
      if (i) ctx.lineTo(x, y)
      else ctx.moveTo(x, y)
    })
    ctx.stroke()
  }

  const board = useCanvas(draw)
  const spark = useCanvas(drawSpark)

  const advance = (n: number) => {
    if (!rule) return
    for (let i = 0; i < n; i++) {
      cells.current = step(cells.current, rule)
      generation.current++
      history.current.push(cells.current.size)
      if (history.current.length > HISTORY) history.current.shift()
    }
  }

  useFrame((dt) => {
    const speed = SPEEDS[speedIndex]
    if (speed === Infinity) {
      // As many generations as fit in ~12 ms.
      const t0 = performance.now()
      do advance(1)
      while (performance.now() - t0 < 12)
    } else {
      pending.current += dt * speed
      const n = Math.floor(pending.current)
      pending.current -= n
      if (n) advance(n)
    }
    rerender()
  }, running && rule !== null)

  // R rotates the stamp; Space toggles play.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'r' || e.key === 'R') setTurns((t) => t + 1)
      if (e.code === 'Space') {
        e.preventDefault()
        setRunning((r) => !r)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Wheel zoom around the pointer (non-passive so the page doesn't scroll).
  useEffect(() => {
    const el = board.ref.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const v = view.current
      const wx = v.ox + (e.clientX - rect.left) / v.cell
      const wy = v.oy + (e.clientY - rect.top) / v.cell
      const cell = Math.min(MAX_CELL, Math.max(MIN_CELL, v.cell * Math.exp(-e.deltaY * 0.0015)))
      view.current = { cell, ox: wx - (e.clientX - rect.left) / cell, oy: wy - (e.clientY - rect.top) / cell }
      board.redraw()
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [board])

  const cellAt = (e: PointerEvent<HTMLCanvasElement>): [number, number] => {
    const rect = e.currentTarget.getBoundingClientRect()
    const v = view.current
    return [Math.floor(v.ox + (e.clientX - rect.left) / v.cell), Math.floor(v.oy + (e.clientY - rect.top) / v.cell)]
  }

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const [x, y] = cellAt(e)
    if (tool === 'pan' || e.button === 1 || e.button === 2) {
      drag.current = { mode: 'pan', alive: false, lastX: e.clientX, lastY: e.clientY, lastCell: '' }
      return
    }
    if (tool === 'stamp') {
      for (const [sx, sy] of stamp) cells.current.add(key(x + sx, y + sy))
      rerender()
      return
    }
    const alive = !cells.current.has(key(x, y))
    drag.current = { mode: 'paint', alive, lastX: e.clientX, lastY: e.clientY, lastCell: `${x},${y}` }
    if (alive) cells.current.add(key(x, y))
    else cells.current.delete(key(x, y))
    rerender()
  }

  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const [x, y] = cellAt(e)
    hover.current = [x, y]
    const d = drag.current
    if (!d) {
      if (tool === 'stamp') board.redraw()
      return
    }
    if (d.mode === 'pan') {
      view.current.ox -= (e.clientX - d.lastX) / view.current.cell
      view.current.oy -= (e.clientY - d.lastY) / view.current.cell
      d.lastX = e.clientX
      d.lastY = e.clientY
      board.redraw()
      return
    }
    if (`${x},${y}` === d.lastCell) return
    d.lastCell = `${x},${y}`
    if (d.alive) cells.current.add(key(x, y))
    else cells.current.delete(key(x, y))
    board.redraw()
  }

  const fit = () => {
    const b = bounds(cells.current)
    const el = board.ref.current
    if (!b || !el) return
    const cell = Math.min(MAX_CELL, Math.max(MIN_CELL, Math.min(el.clientWidth / (b.maxX - b.minX + 6), el.clientHeight / (b.maxY - b.minY + 6))))
    view.current = {
      cell,
      ox: (b.minX + b.maxX + 1) / 2 - el.clientWidth / cell / 2,
      oy: (b.minY + b.maxY + 1) / 2 - el.clientHeight / cell / 2,
    }
    board.redraw()
  }

  const randomFill = () => {
    const el = board.ref.current
    if (!el) return
    const { ox, oy, cell } = view.current
    const next = new Set<number>()
    for (let y = Math.floor(oy); y < oy + el.clientHeight / cell; y++) {
      for (let x = Math.floor(ox); x < ox + el.clientWidth / cell; x++) if (Math.random() < 0.3) next.add(key(x, y))
    }
    reset(next)
  }

  const reset = (next: Set<number>) => {
    cells.current = next
    generation.current = 0
    history.current = []
    rerender()
  }

  const activeRule = rules.find((r) => parseRule(r.rule) && r.rule.toUpperCase() === ruleText.toUpperCase().replace(/\s/g, ''))

  return (
    <>
      <div className="card gol-toolbar">
        <div className="row">
          <button className="primary" onClick={() => setRunning((r) => !r)} disabled={!rule}>
            {running ? '❚❚ Pause' : '▶ Run'}
          </button>
          <button onClick={() => {
            advance(1)
            rerender()
          }} disabled={running || !rule}>
            Step
          </button>
          <button onClick={() => reset(new Set())}>Clear</button>
          <button onClick={randomFill}>Random</button>
          <button onClick={fit}>Fit view</button>
          <span className="spacer" />
          <Segmented
            value={tool}
            options={[
              { value: 'draw', label: '✎ Draw' },
              { value: 'stamp', label: '⧉ Stamp' },
              { value: 'pan', label: '✥ Pan' },
            ]}
            onChange={setTool}
          />
        </div>
        {tool === 'stamp' && (
          <div className="row">
            {patterns.map((p, i) => (
              <button key={p.name} className={`chip${i === patternIndex ? ' active' : ''}`} onClick={() => setPatternIndex(i)}>
                {p.name}
              </button>
            ))}
            <button className="chip" onClick={() => setTurns((t) => t + 1)}>
              ⟳ Rotate (R)
            </button>
          </div>
        )}
      </div>

      <div className="gol-layout">
        <div className="gol-stage">
          <canvas
            ref={board.ref}
            className={`gol-canvas tool-${tool}`}
            aria-label="Life board: draw cells, stamp patterns, drag with the right button to pan, scroll to zoom"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
            onPointerLeave={() => {
              hover.current = null
              board.redraw()
            }}
            onContextMenu={(e) => e.preventDefault()}
          />
        </div>

        <div className="card gol-side">
          <dl className="gol-stats">
            <div>
              <dt>Generation</dt>
              <dd>{generation.current.toLocaleString('en-US')}</dd>
            </div>
            <div>
              <dt>Population</dt>
              <dd>{cells.current.size.toLocaleString('en-US')}</dd>
            </div>
          </dl>
          <canvas ref={spark.ref} className="gol-spark" aria-label="Population over time" />
          <Slider
            label="Speed"
            value={speedIndex}
            min={0}
            max={SPEEDS.length - 1}
            format={(i) => (SPEEDS[i] === Infinity ? 'max' : `${SPEEDS[i]} gen/s`)}
            onChange={setSpeedIndex}
          />
          <label className="gol-rule">
            <span>Rule</span>
            <input className={rule ? undefined : 'invalid'} value={ruleText} onChange={(e) => setRuleText(e.target.value)} spellCheck={false} />
          </label>
          <div className="presets">
            {rules.map((r) => (
              <button key={r.name} className={`chip${activeRule === r ? ' active' : ''}`} title={r.note} onClick={() => setRuleText(r.rule)}>
                {r.name}
              </button>
            ))}
          </div>
          <p className="small muted">{activeRule ? activeRule.note : rule ? 'A custom rule.' : 'Write rules like B3/S23.'}</p>
        </div>
      </div>

      <p className="hint">
        B3/S23 means: a dead cell with exactly 3 live neighbours is <strong>born</strong>; a live cell with
        2 or 3 <strong>survives</strong>; everything else dies. The board has no edges: only live cells are
        stored, so gliders fly forever. Scroll to zoom, drag with the right button (or the Pan tool) to
        move, Space to play and pause.
      </p>
    </>
  )
}
