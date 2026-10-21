import { useRef, useState } from 'react'
import { audio, blip } from '../../kit/audio'
import { useCanvas, useFrame, type Frame } from '../../kit/canvas'
import { Checkbox, Segmented, Slider } from '../../kit/Controls'
import { algorithms, makeArray, presets, type Algorithm, type Op, type Preset } from './algorithms'
import './style.css'

/** Steps per frame for each notch of the speed slider. */
const SPEEDS = [1, 2, 3, 5, 8, 13, 21, 40, 80, 160, 400]
const MEDALS = ['🥇', '🥈', '🥉']

interface Lane {
  algorithm: Algorithm
  values: number[]
  gen: Generator<Op, void, void>
  /** The op from the latest step, highlighted in the drawing. */
  last: Op | null
  compares: number
  writes: number
  /** Operations so far; also the lane's finishing "time". */
  ops: number
  done: boolean
}

function makeLanes(base: number[]): Lane[] {
  return algorithms.map((algorithm) => {
    const values = [...base]
    return { algorithm, values, gen: algorithm.sort(values), last: null, compares: 0, writes: 0, ops: 0, done: false }
  })
}

function advance(lane: Lane) {
  const result = lane.gen.next()
  if (result.done) {
    lane.done = true
    lane.last = null
    return
  }
  const op = result.value
  lane.last = op
  lane.ops++
  if (op.kind === 'compare') lane.compares++
  else lane.writes += op.kind === 'swap' ? 2 : 1
}

/** 1 + how many finished lanes needed strictly fewer operations (ties share a place). */
function rankOf(lane: Lane, lanes: Lane[]): number | null {
  if (!lane.done) return null
  return 1 + lanes.filter((other) => other.done && other.ops < lane.ops).length
}

const number = (value: number) => value.toLocaleString('en-US')

function drawBars({ ctx, width, height, color }: Frame, lane: Lane, max: number) {
  const n = lane.values.length
  if (!n) return
  const barWidth = width / n
  const gap = barWidth > 4 ? 1 : 0
  const palette = {
    bar: color('--bar'),
    compare: color('--compare'),
    swap: color('--swap'),
    done: color('--done'),
  }
  const op = lane.last
  for (let i = 0; i < n; i++) {
    let fill = lane.done ? palette.done : palette.bar
    if (op && (op.i === i || (op.kind !== 'write' && op.j === i))) {
      fill = op.kind === 'compare' ? palette.compare : palette.swap
    }
    const h = (lane.values[i] / max) * (height - 4)
    ctx.fillStyle = fill
    ctx.fillRect(i * barWidth, height - h, Math.max(1, barWidth - gap), h)
  }
}

function LaneView({
  lane,
  rank,
  max,
  listening,
  onListen,
}: {
  lane: Lane
  rank: number | null
  max: number
  listening: boolean
  onListen: () => void
}) {
  const canvas = useCanvas((frame) => drawBars(frame, lane, max))
  return (
    <section className={`card lane${rank === 1 ? ' winner' : ''}${listening ? ' listening' : ''}`}>
      <div className="lane-head">
        <div>
          <h3>{lane.algorithm.name}</h3>
          <span className="muted small mono">{lane.algorithm.complexity}</span>
        </div>
        <div className="row">
          {rank !== null && (
            <span className="rank" title={`Finished #${rank}`}>
              {MEDALS[rank - 1] ?? `#${rank}`}
            </span>
          )}
          <button
            className={`icon-button listen${listening ? ' active' : ''}`}
            aria-pressed={listening}
            title={listening ? 'You are listening to this lane' : 'Listen to this lane'}
            onClick={onListen}
          >
            ♪
          </button>
        </div>
      </div>
      <canvas ref={canvas.ref} className="canvas lane-canvas" aria-label={`${lane.algorithm.name} bars`} />
      <div className="lane-stats small mono">
        <span>{number(lane.compares)} compares</span>
        <span>{number(lane.writes)} writes</span>
        <span className="total">{number(lane.ops)} steps</span>
      </div>
    </section>
  )
}

export default function SortingRace() {
  const [size, setSize] = useState(60)
  const [preset, setPreset] = useState<Preset>('random')
  const [speedIndex, setSpeedIndex] = useState(4)
  const [running, setRunning] = useState(false)
  const [sound, setSound] = useState(false)
  const [listen, setListen] = useState('quick')
  const [base, setBase] = useState(() => makeArray(60, 'random'))
  const lanes = useRef<Lane[]>(makeLanes(base))
  // The race state is mutated in place every frame; this just asks React to repaint.
  const [, setTick] = useState(0)
  const rerender = () => setTick((t) => t + 1)

  const all = lanes.current
  const finished = all.every((lane) => lane.done)
  const started = all.some((lane) => lane.ops > 0)

  const reset = (array: number[]) => {
    lanes.current = makeLanes(array)
    setRunning(false)
    rerender()
  }

  const newArray = (n: number, p: Preset) => {
    const array = makeArray(n, p)
    setBase(array)
    reset(array)
  }

  /** Step-major: every lane takes step k before any lane takes step k+1, so ranks are exact. */
  const advanceAll = (count: number) => {
    for (let k = 0; k < count; k++) {
      const active = lanes.current.filter((lane) => !lane.done)
      if (!active.length) break
      for (const lane of active) advance(lane)
    }
  }

  useFrame(() => {
    advanceAll(SPEEDS[speedIndex])
    if (sound) {
      const lane = lanes.current.find((l) => l.algorithm.id === listen)
      if (lane?.last) blip(180 + (lane.values[lane.last.i] / base.length) * 900)
    }
    if (lanes.current.every((lane) => lane.done)) setRunning(false)
    rerender()
  }, running)

  const start = () => {
    if (finished) lanes.current = makeLanes(base)
    if (sound) audio()
    setRunning(true)
  }

  const podium = finished ? [...all].sort((a, b) => a.ops - b.ops) : []

  return (
    <>
      <div className="card race-toolbar">
        <div className="row">
          {running ? (
            <button className="primary" onClick={() => setRunning(false)}>
              Pause
            </button>
          ) : (
            <button className="primary" onClick={start}>
              {finished ? 'Race again' : started ? 'Resume' : 'Start race'}
            </button>
          )}
          <button
            disabled={running || finished}
            onClick={() => {
              advanceAll(1)
              rerender()
            }}
          >
            Step
          </button>
          <button onClick={() => reset(base)} disabled={!started}>
            Reset
          </button>
          <button onClick={() => newArray(size, preset)}>Shuffle</button>
          <Checkbox
            checked={sound}
            onChange={(on) => {
              if (on) audio()
              setSound(on)
            }}
          >
            Sound (pitch = value)
          </Checkbox>
        </div>

        <div className="race-controls">
          <Segmented
            label="Starting order"
            value={preset}
            options={presets}
            onChange={(p) => {
              setPreset(p)
              newArray(size, p)
            }}
          />
          <Slider
            label="Array size"
            value={size}
            min={8}
            max={200}
            onChange={(n) => {
              setSize(n)
              newArray(n, preset)
            }}
          />
          <Slider
            label="Speed"
            value={speedIndex}
            min={0}
            max={SPEEDS.length - 1}
            format={(i) => `${SPEEDS[i]} steps/frame`}
            onChange={setSpeedIndex}
          />
        </div>

        {podium.length > 0 && (
          <p className="podium">
            🏁 <strong>{podium[0].algorithm.name}</strong> wins with {number(podium[0].ops)} steps.
            {' '}
            {podium[podium.length - 1].algorithm.name} needed {number(podium[podium.length - 1].ops)} (
            {(podium[podium.length - 1].ops / Math.max(1, podium[0].ops)).toFixed(1)}× more).
          </p>
        )}
      </div>

      <div className="race-grid">
        {all.map((lane) => (
          <LaneView
            key={lane.algorithm.id}
            lane={lane}
            rank={rankOf(lane, all)}
            max={base.length}
            listening={sound && listen === lane.algorithm.id}
            onListen={() => {
              audio()
              setSound(true)
              setListen(lane.algorithm.id)
            }}
          />
        ))}
      </div>

      <div className="legend">
        <span><i className="swatch" style={{ background: 'var(--compare)' }} /> comparing</span>
        <span><i className="swatch" style={{ background: 'var(--swap)' }} /> swapping / writing</span>
        <span><i className="swatch" style={{ background: 'var(--done)' }} /> sorted</span>
      </div>
      <p className="hint">
        Each lane runs the same number of steps per frame, so the order they finish in is their
        operation count. O(n²) sorts are fine on 10 items and hopeless on 200; insertion sort beats
        everyone on nearly-sorted input; quicksort slows down on "few unique" because Lomuto
        partitioning handles equal values badly.
      </p>
    </>
  )
}
