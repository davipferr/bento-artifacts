import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { Segmented } from '../../kit/Controls'
import {
  axisOffset,
  difficulty,
  effectiveWidth,
  fitTrials,
  place,
  plan,
  scaleFor,
  START,
  throughput,
  WIDTHS,
  type Condition,
  type Device,
  type Point,
  type Trial,
} from './fitts'
import './style.css'

const DEVICES = [
  { value: 'mouse', label: 'Mouse' },
  { value: 'trackpad', label: 'Trackpad' },
  { value: 'touch', label: 'Touch / pen' },
] as const
const COLOR: Record<Device, string> = { mouse: 'var(--cat-ui)', trackpad: 'var(--cat-tools)', touch: 'var(--cat-sound)' }
const NAME: Record<Device, string> = { mouse: 'Mouse', trackpad: 'Trackpad', touch: 'Touch' }
const REPEATS = 3
const ROUND = WIDTHS.length * 3 * REPEATS

interface Current extends Condition {
  start: Point
  target: Point
  phase: 'waiting' | 'aiming'
  t0: number
}

interface Mark {
  id: number
  x: number
  y: number
  hit: boolean
}

function Chart({ trials }: { trials: Trial[] }) {
  const W = 420
  const H = 240
  const pad = { l: 46, r: 14, t: 14, b: 34 }
  const maxId = 5.5
  const hits = trials.filter((t) => t.hit)
  const maxMs = Math.max(1000, ...hits.map((t) => t.ms)) * 1.1
  const x = (id: number) => pad.l + (id / maxId) * (W - pad.l - pad.r)
  const y = (ms: number) => H - pad.b - (ms / maxMs) * (H - pad.t - pad.b)
  const ticks = Array.from({ length: 5 }, (_, i) => Math.round(((maxMs / 4) * i) / 100) * 100)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="ft-chart" role="img" aria-label="Movement time against index of difficulty">
      {ticks.map((ms) => (
        <g key={ms}>
          <line x1={pad.l} x2={W - pad.r} y1={y(ms)} y2={y(ms)} className="ft-gridline" />
          <text x={pad.l - 6} y={y(ms) + 4} textAnchor="end">
            {ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : ms}
          </text>
        </g>
      ))}
      {[0, 1, 2, 3, 4, 5].map((id) => (
        <text key={id} x={x(id)} y={H - pad.b + 16} textAnchor="middle">
          {id}
        </text>
      ))}
      <text x={(pad.l + W - pad.r) / 2} y={H - 4} textAnchor="middle">
        index of difficulty, log₂(D/W + 1) bits
      </text>
      {(['mouse', 'trackpad', 'touch'] as const).map((device) => {
        const own = trials.filter((t) => t.device === device)
        const f = fitTrials(own)
        return (
          <g key={device} style={{ color: COLOR[device] }}>
            {f && <line className="ft-fit" x1={x(0.5)} x2={x(maxId)} y1={y(Math.max(0, f.a + f.b * 0.5))} y2={y(Math.max(0, f.a + f.b * maxId))} />}
            {own
              .filter((t) => t.hit)
              .map((t, i) => (
                <circle key={i} cx={x(difficulty(t.d, t.w))} cy={y(t.ms)} r={t.w === 16 ? 2.5 : t.w === 32 ? 3.5 : 5} className="ft-dot" />
              ))}
          </g>
        )
      })}
    </svg>
  )
}

export default function FittsLaw() {
  const [device, setDevice] = useState<Device>('mouse')
  const [trials, setTrials] = useState<Trial[]>([])
  const [queue, setQueue] = useState<Condition[]>([])
  const [current, setCurrent] = useState<Current | null>(null)
  const [marks, setMarks] = useState<Mark[]>([])
  const [size, setSize] = useState({ w: 600, h: 420 })
  const arena = useRef<HTMLDivElement>(null)
  const markId = useRef(0)

  useEffect(() => {
    const el = arena.current
    if (!el) return
    const observer = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const setUp = (conditions: Condition[]) => {
    setQueue(conditions)
    if (!conditions.length) {
      setCurrent(null)
      return
    }
    const { d, w } = conditions[0]
    const { start, target } = place(d, w, size.w, size.h, Math.random)
    setCurrent({ d, w, start, target, phase: 'waiting', t0: 0 })
  }

  const begin = () => setUp(plan(REPEATS, scaleFor(size.w), Math.random))

  const mark = (p: Point, hit: boolean) => {
    const id = markId.current++
    setMarks((m) => [...m.slice(-6), { id, ...p, hit }])
    window.setTimeout(() => setMarks((m) => m.filter((k) => k.id !== id)), 600)
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!current || !arena.current) return
    const box = arena.current.getBoundingClientRect()
    const p = { x: e.clientX - box.left, y: e.clientY - box.top }
    if (current.phase === 'waiting') {
      if (Math.hypot(p.x - current.start.x, p.y - current.start.y) <= START / 2) {
        setCurrent({ ...current, phase: 'aiming', t0: performance.now() })
      }
      return
    }
    const ms = Math.round(performance.now() - current.t0)
    const hit = Math.hypot(p.x - current.target.x, p.y - current.target.y) <= current.w / 2
    mark(p, hit)
    setTrials((t) => [...t, { device, d: current.d, w: current.w, ms, hit, offset: axisOffset(current.start, current.target, p) }])
    setUp(queue.slice(1))
  }

  const own = trials.filter((t) => t.device === device)
  const f = fitTrials(own)
  const misses = own.filter((t) => !t.hit).length
  const we = effectiveWidth(own.filter((t) => t.w === 32).map((t) => t.offset))
  const tp = throughput(own)
  const predict = (d: number, w: number) => (f ? Math.max(0, Math.round(f.a + f.b * difficulty(d, w))) : null)
  const progress = queue.length ? ROUND - queue.length + 1 : 0

  return (
    <>
      <div className="card ft-controls">
        <div className="row">
          <Segmented label="Pointing with" value={device} options={DEVICES} onChange={(v) => !current && setDevice(v)} />
          <span className="spacer" />
          {current ? (
            <button onClick={() => setUp([])}>Stop</button>
          ) : (
            <button className="primary" onClick={begin}>
              Start a round ({ROUND} targets)
            </button>
          )}
        </div>
        <p className="small muted">
          Press the grey <strong>start</strong> circle, then hit the coloured target as fast as you can while staying accurate.
          Targets come in three sizes at three distances. Do a round with each pointer you have and compare the lines.
        </p>
      </div>

      <div className="ft-layout">
        <div className="card ft-arena-card">
          <div className="row small muted">
            {current ? (
              <span>
                Target {progress} of {ROUND} · W = {current.w}px · D = {current.d}px · ID ={' '}
                {difficulty(current.d, current.w).toFixed(2)} bits
              </span>
            ) : (
              <span>
                <strong>Fitts’s law:</strong> MT = a + b · log₂(D/W + 1). Far and small is slow; near and big is fast.
              </span>
            )}
          </div>
          <div ref={arena} className={`ft-arena${current?.phase === 'aiming' ? ' aiming' : ''}`} onPointerDown={onPointerDown}>
            {!current && <div className="ft-empty muted">Press “Start a round” to begin.</div>}
            {current && (
              <>
                <svg className="ft-guide" aria-hidden>
                  <line x1={current.start.x} y1={current.start.y} x2={current.target.x} y2={current.target.y} />
                </svg>
                <div
                  className="ft-start"
                  style={{ left: current.start.x, top: current.start.y, width: START, height: START }}
                  data-active={current.phase === 'waiting' || undefined}
                >
                  {current.phase === 'waiting' ? 'start' : ''}
                </div>
                <div
                  className="ft-target"
                  style={{ left: current.target.x, top: current.target.y, width: current.w, height: current.w }}
                  data-live={current.phase === 'aiming' || undefined}
                />
              </>
            )}
            {marks.map((m) => (
              <span key={m.id} className={`ft-mark${m.hit ? ' hit' : ' miss'}`} style={{ left: m.x, top: m.y }} />
            ))}
          </div>
        </div>

        <div className="card ft-results">
          <Chart trials={trials} />
          <div className="legend">
            {(['mouse', 'trackpad', 'touch'] as const).map((d) => {
              const fd = fitTrials(trials.filter((t) => t.device === d))
              return (
                <span key={d}>
                  <i className="swatch" style={{ background: COLOR[d] }} />
                  {NAME[d]}
                  {fd && (
                    <span className="mono">
                      {' '}
                      ≈ {Math.round(fd.a)} + {Math.round(fd.b)}·ID
                    </span>
                  )}
                </span>
              )
            })}
            <span>dot size = target width</span>
          </div>
          <dl className="ft-stats">
            <div>
              <dt>Throughput</dt>
              <dd>{Number.isNaN(tp) ? '·' : `${tp.toFixed(1)} bits/s`}</dd>
            </div>
            <div>
              <dt>Fit r²</dt>
              <dd>{f ? f.r2.toFixed(2) : '·'}</dd>
            </div>
            <div>
              <dt>Misses</dt>
              <dd>
                {misses} / {own.length}
              </dd>
            </div>
            <div>
              <dt title="4.133 × SD of where you clicked along the movement, for the 32px targets">Effective W (32px)</dt>
              <dd>{Number.isNaN(we) ? '·' : `${Math.round(we)}px`}</dd>
            </div>
          </dl>
          <div className="callout small">
            {f ? (
              <>
                With your {NAME[device].toLowerCase()}: a 16px icon 480px away takes about <strong>{predict(480, 16)} ms</strong>; a
                64px button 120px away about <strong>{predict(120, 64)} ms</strong>. That’s why primary actions are big and sit
                close to where the pointer already is.
              </>
            ) : (
              <>Finish a few targets to get your own a and b, and predictions for real buttons.</>
            )}
          </div>
          <div className="row">
            <span className="small muted">{trials.length} targets in total</span>
            <span className="spacer" />
            {trials.length > 0 && (
              <button className="chip" onClick={() => setTrials([])}>
                Clear results
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
