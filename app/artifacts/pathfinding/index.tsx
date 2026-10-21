import { useMemo, useRef, useState, type PointerEvent } from 'react'
import { useCanvas, useFrame, type Frame } from '../../kit/canvas'
import { Segmented, Slider } from '../../kit/Controls'
import {
  algorithms,
  drain,
  EMPTY,
  makeGrid,
  maze,
  scatter,
  WALL,
  WEIGHT,
  WEIGHT_COST,
  type Grid,
  type SearchResult,
  type Step,
} from './search'
import './style.css'

const SIZES = {
  S: { cols: 31, rows: 19 },
  M: { cols: 41, rows: 25 },
  L: { cols: 61, rows: 37 },
} as const
type Size = keyof typeof SIZES

type Tool = 'wall' | 'weight' | 'erase'
const toolValue = { wall: WALL, weight: WEIGHT, erase: EMPTY } as const

/** Search steps per frame for each notch of the speed slider. */
const SPEEDS = [1, 2, 4, 8, 16, 40, 100]

// Overlay colours are theme tokens drawn translucent, so they work on light and dark.
const VISITED_ALPHA = 0.25
const FRONTIER_ALPHA = 0.55
const WEIGHT_ALPHA = 0.8

interface Run {
  gen: Generator<Step, SearchResult, void>
  visited: Uint8Array
  frontier: Uint8Array
  result: SearchResult | null
}

function newRun(grid: Grid, algorithmId: string): Run {
  const algorithm = algorithms.find((a) => a.id === algorithmId)!
  return {
    gen: algorithm.search(grid),
    visited: new Uint8Array(grid.cells.length),
    frontier: new Uint8Array(grid.cells.length),
    result: null,
  }
}

/** Advance a run by up to `count` steps. Returns true once it has finished. */
function advance(run: Run, count: number): boolean {
  for (let k = 0; k < count && !run.result; k++) {
    const step = run.gen.next()
    if (step.done) {
      run.result = step.value
      break
    }
    const { kind, cell } = step.value
    if (kind === 'visit') {
      run.visited[cell] = 1
      run.frontier[cell] = 0
    } else {
      run.frontier[cell] = 1
    }
  }
  return run.result !== null
}

function draw({ ctx, width, color }: Frame, grid: Grid, run: Run | null) {
  const { cols, rows } = grid
  const s = width / cols
  const palette = {
    bg: color('--bg'),
    grid: color('--grid'),
    wall: color('--wall'),
    weight: color('--weight'),
    visited: color('--visited'),
    frontier: color('--frontier'),
    path: color('--path'),
    start: color('--start'),
    goal: color('--goal'),
  }
  ctx.fillStyle = palette.bg
  ctx.fillRect(0, 0, width, rows * s)

  for (let i = 0; i < grid.cells.length; i++) {
    const x = (i % cols) * s
    const y = Math.floor(i / cols) * s
    if (grid.cells[i] === WALL) {
      ctx.fillStyle = palette.wall
      ctx.fillRect(x, y, s + 0.5, s + 0.5)
      continue
    }
    if (run?.visited[i] || run?.frontier[i]) {
      ctx.globalAlpha = run.visited[i] ? VISITED_ALPHA : FRONTIER_ALPHA
      ctx.fillStyle = run.visited[i] ? palette.visited : palette.frontier
      ctx.fillRect(x, y, s + 0.5, s + 0.5)
      ctx.globalAlpha = 1
    }
    if (grid.cells[i] === WEIGHT) {
      ctx.globalAlpha = WEIGHT_ALPHA
      ctx.fillStyle = palette.weight
      const inset = s * 0.22
      ctx.beginPath()
      ctx.roundRect(x + inset, y + inset, s - 2 * inset, s - 2 * inset, s * 0.15)
      ctx.fill()
      ctx.globalAlpha = 1
    }
  }

  if (s >= 10) {
    ctx.strokeStyle = palette.grid
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let c = 1; c < cols; c++) {
      ctx.moveTo(Math.round(c * s) + 0.5, 0)
      ctx.lineTo(Math.round(c * s) + 0.5, rows * s)
    }
    for (let r = 1; r < rows; r++) {
      ctx.moveTo(0, Math.round(r * s) + 0.5)
      ctx.lineTo(cols * s, Math.round(r * s) + 0.5)
    }
    ctx.stroke()
  }

  const center = (i: number): [number, number] => [((i % cols) + 0.5) * s, (Math.floor(i / cols) + 0.5) * s]
  const path = run?.result?.path
  if (path) {
    ctx.strokeStyle = palette.path
    ctx.lineWidth = Math.max(2, s * 0.32)
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.beginPath()
    path.forEach((cell, k) => {
      const [x, y] = center(cell)
      if (k === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()
  }

  const [sx, sy] = center(grid.start)
  ctx.fillStyle = palette.start
  ctx.beginPath()
  ctx.arc(sx, sy, s * 0.42, 0, Math.PI * 2)
  ctx.fill()

  const [gx, gy] = center(grid.goal)
  ctx.strokeStyle = palette.goal
  ctx.fillStyle = palette.goal
  ctx.lineWidth = Math.max(1.5, s * 0.12)
  ctx.beginPath()
  ctx.arc(gx, gy, s * 0.38, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(gx, gy, s * 0.15, 0, Math.PI * 2)
  ctx.fill()
}

export default function Pathfinding() {
  const [size, setSize] = useState<Size>('M')
  const [algorithmId, setAlgorithmId] = useState('astar')
  const [tool, setTool] = useState<Tool>('wall')
  const [speedIndex, setSpeedIndex] = useState(3)
  const [running, setRunning] = useState(false)
  /** After a finished run, edits re-solve instantly so you can drag the goal around. */
  const [live, setLive] = useState(false)
  const [gridVersion, setGridVersion] = useState(0)
  const [, setTick] = useState(0)

  const grid = useRef<Grid>(maze(SIZES.M.cols, SIZES.M.rows))
  const run = useRef<Run | null>(null)
  const drag = useRef<{ mode: 'start' | 'goal' | 'paint'; value: number; last: number } | null>(null)

  const rerender = () => setTick((t) => t + 1)
  const canvas = useCanvas((frame) => draw(frame, grid.current, run.current))

  const solveInstantly = (id = algorithmId) => {
    run.current = newRun(grid.current, id)
    advance(run.current, Infinity)
  }

  /** Call after any edit to the grid. */
  const gridChanged = () => {
    if (live) solveInstantly()
    else {
      run.current = null
      setRunning(false)
    }
    setGridVersion((v) => v + 1)
  }

  const replaceGrid = (next: Grid, keepLive = false) => {
    grid.current = next
    if (!keepLive) setLive(false)
    run.current = null
    setRunning(false)
    if (keepLive && live) solveInstantly()
    setGridVersion((v) => v + 1)
  }

  useFrame(() => {
    if (!run.current) return
    if (advance(run.current, SPEEDS[speedIndex])) {
      setRunning(false)
      setLive(true)
    }
    rerender()
  }, running)

  const start = () => {
    if (!run.current || run.current.result) run.current = newRun(grid.current, algorithmId)
    setLive(false)
    setRunning(true)
  }

  const clearPath = () => {
    run.current = null
    setRunning(false)
    setLive(false)
    rerender()
  }

  const changeAlgorithm = (id: string) => {
    setAlgorithmId(id)
    if (live) solveInstantly(id)
    else {
      run.current = null
      setRunning(false)
    }
    rerender()
  }

  // ---- Pointer editing --------------------------------------------------

  const cellAt = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const { cols, rows } = grid.current
    const col = Math.floor(((event.clientX - rect.left) / rect.width) * cols)
    const row = Math.floor(((event.clientY - rect.top) / rect.height) * rows)
    if (col < 0 || row < 0 || col >= cols || row >= rows) return -1
    return row * cols + col
  }

  const paint = (cell: number, value: number) => {
    const g = grid.current
    if (cell === g.start || cell === g.goal || g.cells[cell] === value) return false
    g.cells[cell] = value
    return true
  }

  /** Paint every cell on the straight line between two cells, so fast drags leave no gaps. */
  const paintLine = (from: number, to: number, value: number) => {
    const { cols } = grid.current
    const [c0, r0, c1, r1] = [from % cols, Math.floor(from / cols), to % cols, Math.floor(to / cols)]
    const steps = Math.max(Math.abs(c1 - c0), Math.abs(r1 - r0), 1)
    let changed = false
    for (let k = 0; k <= steps; k++) {
      const c = Math.round(c0 + ((c1 - c0) * k) / steps)
      const r = Math.round(r0 + ((r1 - r0) * k) / steps)
      changed = paint(r * cols + c, value) || changed
    }
    return changed
  }

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    const cell = cellAt(event)
    if (cell < 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const g = grid.current
    if (cell === g.start || cell === g.goal) {
      drag.current = { mode: cell === g.start ? 'start' : 'goal', value: 0, last: cell }
      return
    }
    // Clicking a cell that already has the tool's type erases instead, like a toggle.
    const value = toolValue[tool] !== EMPTY && g.cells[cell] === toolValue[tool] ? EMPTY : toolValue[tool]
    drag.current = { mode: 'paint', value, last: cell }
    if (paint(cell, value)) gridChanged()
  }

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current
    if (!d) return
    const cell = cellAt(event)
    if (cell < 0 || cell === d.last) return
    const g = grid.current
    if (d.mode === 'paint') {
      if (paintLine(d.last, cell, d.value)) gridChanged()
    } else {
      const other = d.mode === 'start' ? g.goal : g.start
      if (cell === other || g.cells[cell] === WALL) return
      g[d.mode] = cell
      gridChanged()
    }
    d.last = cell
  }

  const onPointerUp = () => {
    drag.current = null
  }

  // ---- Comparison table: every algorithm on the current grid, instantly --

  const comparison = useMemo(
    () => algorithms.map((algorithm) => ({ algorithm, result: drain(algorithm.search, grid.current) })),
    [gridVersion],
  )
  const cheapest = Math.min(...comparison.map((c) => (c.result.path ? c.result.cost : Infinity)))

  const result = run.current?.result
  const { cols, rows } = grid.current

  return (
    <>
      <div className="card path-toolbar">
        <Segmented
          label="Algorithm"
          value={algorithmId}
          options={algorithms.map((a) => ({ value: a.id, label: a.name }))}
          onChange={changeAlgorithm}
        />
        <div className="row">
          {running ? (
            <button className="primary" onClick={() => setRunning(false)}>
              Pause
            </button>
          ) : (
            <button className="primary" onClick={start}>
              {run.current && !run.current.result ? 'Resume' : 'Find path'}
            </button>
          )}
          <button onClick={clearPath} disabled={!run.current}>
            Clear path
          </button>
          <span className="divider" />
          <button onClick={() => replaceGrid(maze(cols, rows))}>Maze</button>
          <button
            onClick={() => {
              const next = makeGrid(cols, rows)
              scatter(next, WALL, 0.28)
              replaceGrid(next)
            }}
          >
            Random walls
          </button>
          <button
            onClick={() => {
              const g = grid.current
              for (let i = 0; i < g.cells.length; i++) if (g.cells[i] === WEIGHT) g.cells[i] = EMPTY
              scatter(g, WEIGHT, 0.2)
              replaceGrid(g, true)
            }}
          >
            Random weights
          </button>
          <button onClick={() => replaceGrid(makeGrid(cols, rows))}>Clear all</button>
        </div>
        <div className="path-controls">
          <Segmented
            label="Brush"
            value={tool}
            options={[
              { value: 'wall', label: 'Walls' },
              { value: 'weight', label: `Weights (cost ${WEIGHT_COST})` },
              { value: 'erase', label: 'Eraser' },
            ]}
            onChange={setTool}
          />
          <Segmented
            label="Grid"
            value={size}
            options={[
              { value: 'S', label: 'Small' },
              { value: 'M', label: 'Medium' },
              { value: 'L', label: 'Large' },
            ]}
            onChange={(next) => {
              setSize(next)
              replaceGrid(maze(SIZES[next].cols, SIZES[next].rows))
            }}
          />
          <Slider
            label="Speed"
            value={speedIndex}
            min={0}
            max={SPEEDS.length - 1}
            format={(i) => `${SPEEDS[i]} cells/frame`}
            onChange={setSpeedIndex}
          />
        </div>
      </div>

      <div className="path-layout">
        <div className="card path-board">
          <canvas
            ref={canvas.ref}
            className="canvas path-canvas"
            style={{ aspectRatio: `${cols} / ${rows}` }}
            aria-label="Grid: drag the start and goal, paint walls and weights"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
          <div className="legend">
            <span><i className="swatch round" style={{ background: 'var(--start)' }} /> start (drag)</span>
            <span><i className="swatch round" style={{ background: 'var(--goal)' }} /> goal (drag)</span>
            <span><i className="swatch" style={{ background: 'var(--wall)' }} /> wall</span>
            <span><i className="swatch" style={{ background: 'var(--weight)', opacity: WEIGHT_ALPHA }} /> weight</span>
            <span><i className="swatch" style={{ background: 'var(--frontier)', opacity: FRONTIER_ALPHA }} /> frontier</span>
            <span><i className="swatch" style={{ background: 'var(--visited)', opacity: VISITED_ALPHA * 2 }} /> visited</span>
            <span><i className="swatch" style={{ background: 'var(--path)' }} /> path</span>
          </div>
          <p className="path-status small">
            {result
              ? result.path
                ? `Visited ${result.visited} cells · path ${result.path.length - 1} steps · cost ${result.cost}`
                : `No path: visited all ${result.visited} reachable cells.`
              : run.current
                ? 'Searching…'
                : 'Paint walls with the mouse, drag the start or goal, then press Find path.'}
            {live && ' · live: edits re-solve instantly'}
          </p>
        </div>

        <div className="card path-compare">
          <h3>Same grid, every algorithm</h3>
          <table>
            <thead>
              <tr>
                <th>Algorithm</th>
                <th>Visited</th>
                <th>Steps</th>
                <th>Cost</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map(({ algorithm, result: r }) => (
                <tr
                  key={algorithm.id}
                  className={algorithm.id === algorithmId ? 'selected' : undefined}
                  onClick={() => changeAlgorithm(algorithm.id)}
                >
                  <td>{algorithm.name}</td>
                  <td>{r.visited}</td>
                  <td>{r.path ? r.path.length - 1 : '—'}</td>
                  <td className={r.path && r.cost === cheapest ? 'best' : undefined}>{r.path ? r.cost : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint">
            <strong>BFS</strong> spreads in rings and ignores weights. <strong>Dijkstra</strong> always
            finds the cheapest path but explores in every direction. <strong>A*</strong> adds a
            distance-to-goal guess and finds the same cost while visiting far fewer cells.{' '}
            <strong>Greedy</strong> only follows the guess: fastest, but it can take long detours.
          </p>
        </div>
      </div>
    </>
  )
}
