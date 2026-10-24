import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { useFrame } from '../../kit/canvas'
import { Checkbox, Slider } from '../../kit/Controls'
import { atRest, decide, exitVelocity, progress, rotation, springStep, velocity, type Sample, type Verdict } from './swipe'
import './style.css'

/** The deck: artifact ideas that didn't make it into the gallery (yet). */
const CARDS = [
  { title: 'Chladni Plates', emoji: '〰️', line: 'Sand dancing into patterns on a vibrating plate.', hue: 32, tags: ['physics', 'sound'] },
  { title: 'Fireworks', emoji: '🎆', line: 'Click to launch shells with trails and bloom.', hue: 330, tags: ['particles', 'canvas'] },
  { title: 'Black Hole', emoji: '🕳️', line: 'Starlight bent around an event horizon.', hue: 265, tags: ['shader', 'space'] },
  { title: 'Theremin', emoji: '🎛️', line: 'Mouse X is pitch, Y is volume. Spooky.', hue: 200, tags: ['web audio'] },
  { title: 'Cloth Tear', emoji: '🧵', line: 'A Verlet cloth you can poke, pull and cut.', hue: 12, tags: ['physics', 'verlet'] },
  { title: 'Dither Studio', emoji: '▦', line: 'Floyd–Steinberg, Bayer and Game Boy palettes.', hue: 140, tags: ['images'] },
  { title: 'Maze Race', emoji: '🌀', line: 'Four algorithms carve mazes side by side.', hue: 220, tags: ['algorithms'] },
  { title: 'Lava Lamp', emoji: '🫧', line: 'Metaballs rising, merging and splitting.', hue: 15, tags: ['generative'] },
  { title: 'Bytebeat', emoji: '🔊', line: 'Music from one line: t*(t>>5|t>>8).', hue: 290, tags: ['web audio', 'math'] },
  { title: 'Orbit Sandbox', emoji: '🪐', line: 'Fling planets around a star, leave trails.', hue: 245, tags: ['gravity'] },
  { title: 'Snowflake Grower', emoji: '❄️', line: 'Hexagonal crystals, every one unique.', hue: 190, tags: ['cellular automata'] },
  { title: 'Wordle Brain', emoji: '🟩', line: 'Every guess scored by information theory.', hue: 120, tags: ['entropy', 'game'] },
]
type Card = (typeof CARDS)[number]

interface Motion {
  x: number
  y: number
  vx: number
  vy: number
  /** Where the card was grabbed, -1 (top) … 1 (bottom). */
  grabY: number
  phase: 'idle' | 'drag' | 'spring'
}
interface Flying {
  card: Card
  x: number
  y: number
  vx: number
  vy: number
  grabY: number
}
interface Decision {
  card: Card
  verdict: Exclude<Verdict, null>
  /** Where it left the stage, so Undo can bring it back from there. */
  exit: { x: number; y: number; grabY: number }
}

const STAMP: Record<Exclude<Verdict, null>, string> = { right: 'LIKE', left: 'NOPE', up: 'SUPER' }
const VECTOR_SCALE = 0.12 // px of arrow per px/s

export default function SwipeDeck() {
  const [index, setIndex] = useState(0)
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [distance, setDistance] = useState(0.4)
  const [flick, setFlick] = useState(800)
  const [stiffness, setStiffness] = useState(320)
  const [damping, setDamping] = useState(18)
  const [maxTilt, setMaxTilt] = useState(12)
  const [physics, setPhysics] = useState(true)
  const [animating, setAnimating] = useState(false)
  const [, setTick] = useState(0)

  const stage = useRef<HTMLDivElement>(null)
  const motion = useRef<Motion>({ x: 0, y: 0, vx: 0, vy: 0, grabY: 0, phase: 'idle' })
  const flying = useRef<Flying[]>([])
  const samples = useRef<Sample[]>([])
  const grab = useRef({ px: 0, py: 0, x: 0, y: 0, lx: 0, ly: 0 })
  const lastRelease = useRef<{ vx: number; vy: number } | null>(null)
  const rerender = () => setTick((n) => n + 1)

  const size = () => {
    const el = stage.current
    const w = el ? Math.min(330, el.clientWidth - 40) : 300
    return { w, h: Math.round(w * 1.3), stageW: el?.clientWidth ?? 600, stageH: el?.clientHeight ?? 480 }
  }
  const rules = { distance, flick }

  const send = (verdict: Exclude<Verdict, null>, vx: number, vy: number) => {
    const card = CARDS[index]
    if (!card) return
    const m = motion.current
    const v = exitVelocity(verdict, vx, vy)
    flying.current.push({ card, x: m.x, y: m.y, vx: v.vx, vy: v.vy, grabY: m.grabY })
    setDecisions((d) => [...d, { card, verdict, exit: { x: m.x, y: m.y, grabY: m.grabY } }])
    setIndex((i) => i + 1)
    motion.current = { x: 0, y: 0, vx: 0, vy: 0, grabY: 0, phase: 'idle' }
    setAnimating(true)
  }

  const undo = () => {
    const last = decisions[decisions.length - 1]
    if (!last) return
    // Pull it back from wherever it is now: mid-flight or from the edge it left by.
    const inFlight = flying.current.find((f) => f.card === last.card)
    flying.current = flying.current.filter((f) => f !== inFlight)
    const { stageW, stageH } = size()
    const offstage = {
      x: last.verdict === 'up' ? last.exit.x : (last.verdict === 'right' ? 1 : -1) * stageW * 0.75,
      y: last.verdict === 'up' ? -stageH * 0.9 : last.exit.y,
    }
    const from = inFlight ?? { ...offstage, grabY: last.exit.grabY }
    motion.current = { x: from.x, y: from.y, vx: 0, vy: 0, grabY: from.grabY, phase: 'spring' }
    setDecisions((d) => d.slice(0, -1))
    setIndex((i) => i - 1)
    setAnimating(true)
  }

  useFrame((dt) => {
    const { stageW, stageH } = size()
    const m = motion.current
    let busy = false
    if (m.phase === 'spring') {
      ;[m.x, m.vx] = springStep(m.x, m.vx, 0, stiffness, damping, dt)
      ;[m.y, m.vy] = springStep(m.y, m.vy, 0, stiffness, damping, dt)
      if (atRest(m.x, m.vx) && atRest(m.y, m.vy)) Object.assign(m, { x: 0, y: 0, vx: 0, vy: 0, phase: 'idle' })
      else busy = true
    }
    for (const f of flying.current) {
      f.x += f.vx * dt
      f.y += f.vy * dt
    }
    flying.current = flying.current.filter((f) => Math.abs(f.x) < stageW * 1.4 && Math.abs(f.y) < stageH * 1.6)
    if (flying.current.length) busy = true
    rerender()
    if (!busy) setAnimating(false)
  }, animating)

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const rect = e.currentTarget.getBoundingClientRect()
    const m = motion.current
    // You can catch the card mid-spring: it continues from where it is.
    grab.current = { px: e.clientX, py: e.clientY, x: m.x, y: m.y, lx: e.clientX - rect.left, ly: e.clientY - rect.top }
    m.grabY = Math.max(-1, Math.min(1, (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2)))
    m.phase = 'drag'
    m.vx = m.vy = 0
    samples.current = [{ t: e.timeStamp, x: m.x, y: m.y }]
    lastRelease.current = null
    rerender()
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const m = motion.current
    if (m.phase !== 'drag') return
    m.x = grab.current.x + e.clientX - grab.current.px
    m.y = grab.current.y + e.clientY - grab.current.py
    samples.current.push({ t: e.timeStamp, x: m.x, y: m.y })
    if (samples.current.length > 30) samples.current.shift()
    const v = velocity(samples.current)
    m.vx = v.vx
    m.vy = v.vy
    rerender()
  }

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const m = motion.current
    if (m.phase !== 'drag') return
    samples.current.push({ t: e.timeStamp, x: m.x, y: m.y })
    const v = velocity(samples.current)
    lastRelease.current = v
    const verdict = decide(m.x, m.y, v.vx, v.vy, size().w, rules)
    if (verdict) return send(verdict, v.vx, v.vy)
    // Snap back, keeping the release velocity so the spring feels continuous.
    Object.assign(m, { vx: v.vx, vy: v.vy, phase: 'spring' })
    setAnimating(true)
  }

  // Keyboard: arrows decide, Backspace / Z undoes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowRight') send('right', 0, 0)
      else if (e.key === 'ArrowLeft') send('left', 0, 0)
      else if (e.key === 'ArrowUp') send('up', 0, 0)
      else if (e.key === 'Backspace' || e.key.toLowerCase() === 'z') undo()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const { w, h, stageW, stageH } = size()
  const m = motion.current
  const p = progress(m.x, m.y, w, distance)
  const prediction = m.phase === 'drag' ? decide(m.x, m.y, m.vx, m.vy, w, rules) : null
  const speed = Math.hypot(m.vx, m.vy)
  const tilt = rotation(m.x, w, m.grabY, maxTilt)
  const cx = stageW / 2
  const cy = stageH / 2
  const reach = distance * w
  const done = index >= CARDS.length
  const back = CARDS.slice(index + 1, index + 3)
  // How far the top card has gone toward deciding; the next card grows into place with it.
  const lift = Math.min(1, Math.max(Math.abs(p.x), p.up))

  const cardStyle = (x: number, y: number, deg: number, extra: CSSProperties = {}): CSSProperties => ({
    width: w,
    height: h,
    marginLeft: -w / 2,
    marginTop: -h / 2,
    transform: `translate(${x}px, ${y}px) rotate(${deg}deg)`,
    ...extra,
  })

  const face = (card: Card) => (
    <>
      <div className="sd-art" style={{ '--hue': card.hue } as CSSProperties}>
        <span>{card.emoji}</span>
      </div>
      <div className="sd-info">
        <h3>{card.title}</h3>
        <p>{card.line}</p>
        <div className="sd-tags">
          {card.tags.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      </div>
    </>
  )

  const counts = { right: 0, left: 0, up: 0 }
  for (const d of decisions) counts[d.verdict]++

  return (
    <>
      <div className="sd-layout">
        <div className="card sd-stage-card">
          <div className="sd-stage" ref={stage}>
            {done && flying.current.length === 0 && (
              <div className="sd-empty">
                <p>That’s the whole deck.</p>
                <p className="muted small">
                  {counts.right} liked · {counts.up} super · {counts.left} passed
                </p>
                <button
                  className="primary"
                  onClick={() => {
                    setIndex(0)
                    setDecisions([])
                  }}
                >
                  Shuffle back in
                </button>
              </div>
            )}

            {[...back].reverse().map((card, i, arr) => {
              const depth = arr.length - i // 1 = right under the top card
              const scale = 1 - 0.05 * depth + 0.05 * lift * (depth === 1 ? 1 : 0)
              const offset = 14 * depth - 14 * lift * (depth === 1 ? 1 : 0)
              return (
                <div key={card.title} className="sd-card back" style={cardStyle(0, offset, 0, { transform: `translateY(${offset}px) scale(${scale})` })}>
                  {face(card)}
                </div>
              )
            })}

            {!done && (
              <div
                key={CARDS[index].title}
                className={`sd-card top${m.phase === 'drag' ? ' dragging' : ''}`}
                style={cardStyle(m.x, m.y, tilt)}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                aria-label={`${CARDS[index].title}. Drag right to like, left to pass, up to super-like, or use the arrow keys.`}
              >
                {face(CARDS[index])}
                <span className="sd-stamp like" style={{ opacity: Math.max(0, p.x) }}>
                  LIKE
                </span>
                <span className="sd-stamp nope" style={{ opacity: Math.max(0, -p.x) }}>
                  NOPE
                </span>
                <span className="sd-stamp super" style={{ opacity: p.up }}>
                  SUPER
                </span>
              </div>
            )}

            {flying.current.map((f) => (
              <div key={`fly-${f.card.title}`} className="sd-card flying" style={cardStyle(f.x, f.y, rotation(f.x, w, f.grabY, maxTilt))}>
                {face(f.card)}
              </div>
            ))}

            {physics && !done && (
              <svg className="sd-physics" width={stageW} height={stageH} aria-hidden>
                <line x1={cx - reach} x2={cx - reach} y1={14} y2={stageH - 14} className={`sd-threshold${p.x <= -1 ? ' hit' : ''}`} />
                <line x1={cx + reach} x2={cx + reach} y1={14} y2={stageH - 14} className={`sd-threshold${p.x >= 1 ? ' hit' : ''}`} />
                <line x1={cx - reach} x2={cx + reach} y1={cy - reach} y2={cy - reach} className={`sd-threshold${p.up >= 1 ? ' hit' : ''}`} />
                <text x={cx - reach - 6} y={26} textAnchor="end">
                  nope
                </text>
                <text x={cx + reach + 6} y={26}>
                  like
                </text>
                <text x={cx + reach + 6} y={cy - reach + 4}>
                  super
                </text>
                {m.phase === 'drag' && (
                  <>
                    <polyline
                      className="sd-trail"
                      points={samples.current.map((s) => `${cx + s.x},${cy + s.y}`).join(' ')}
                    />
                    <circle cx={cx - w / 2 + grab.current.lx + (m.x - grab.current.x)} cy={cy - h / 2 + grab.current.ly + (m.y - grab.current.y)} r={7} className="sd-grab" />
                  </>
                )}
                {speed > 20 && (
                  <g className={`sd-vector${speed > flick ? ' fast' : ''}`}>
                    <line x1={cx + m.x} y1={cy + m.y} x2={cx + m.x + m.vx * VECTOR_SCALE} y2={cy + m.y + m.vy * VECTOR_SCALE} markerEnd="url(#sd-arrow)" />
                    <text x={cx + m.x + m.vx * VECTOR_SCALE + 8} y={cy + m.y + m.vy * VECTOR_SCALE}>
                      {Math.round(speed)} px/s
                    </text>
                  </g>
                )}
                <defs>
                  <marker id="sd-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M0,0 L10,5 L0,10 z" />
                  </marker>
                </defs>
              </svg>
            )}
          </div>

          <div className="sd-buttons">
            <button className="sd-round nope" onClick={() => send('left', 0, 0)} disabled={done} aria-label="Pass (left arrow)">
              ✕
            </button>
            <button className="sd-round super" onClick={() => send('up', 0, 0)} disabled={done} aria-label="Super like (up arrow)">
              ★
            </button>
            <button className="sd-round like" onClick={() => send('right', 0, 0)} disabled={done} aria-label="Like (right arrow)">
              ♥
            </button>
            <button className="sd-round undo" onClick={undo} disabled={!decisions.length} aria-label="Undo (Backspace)">
              ↺
            </button>
          </div>
        </div>

        <div className="card sd-side">
          <div className="sd-readout mono">
            <span>dx</span>
            <b>{Math.round(m.x)} px</b>
            <span>dy</span>
            <b>{Math.round(m.y)} px</b>
            <span>velocity</span>
            <b>
              {Math.round(m.vx)}, {Math.round(m.vy)} px/s
            </b>
            <span>tilt</span>
            <b>{tilt.toFixed(1)}°</b>
            <span>grabbed</span>
            <b>{m.grabY > 0.15 ? 'bottom half' : 'top half'}</b>
            <span>release now</span>
            <b className={prediction ? `sd-verdict ${prediction}` : ''}>
              {m.phase === 'drag' ? (prediction ? STAMP[prediction] : 'snap back') : '—'}
            </b>
          </div>
          {lastRelease.current && m.phase !== 'drag' && (
            <p className="small muted">
              Last release: {Math.round(Math.hypot(lastRelease.current.vx, lastRelease.current.vy))} px/s
            </p>
          )}

          <Slider label="Decide past" value={distance} min={0.15} max={0.8} step={0.05} format={(v) => `${Math.round(v * 100)}% of width`} onChange={setDistance} />
          <Slider label="Flick speed" value={flick} min={300} max={2500} step={50} format={(v) => `${v} px/s`} onChange={setFlick} />
          <Slider label="Spring stiffness" value={stiffness} min={60} max={900} step={10} onChange={setStiffness} />
          <Slider label="Spring damping" value={damping} min={4} max={60} step={1} format={(v) => (v >= 2 * Math.sqrt(stiffness) ? `${v} (no bounce)` : `${v}`)} onChange={setDamping} />
          <Slider label="Max tilt" value={maxTilt} min={0} max={30} format={(v) => `${v}°`} onChange={setMaxTilt} />
          <Checkbox checked={physics} onChange={setPhysics}>
            Show thresholds and velocity
          </Checkbox>
          <p className="callout small">
            A short, fast flick counts as much as a long drag. Grab the card low and it tilts the other way. Catch it while
            it springs back and it keeps going from there.
          </p>
        </div>
      </div>

      {decisions.length > 0 && (
        <div className="card sd-results">
          {(['up', 'right', 'left'] as const).map((verdict) => {
            const list = decisions.filter((d) => d.verdict === verdict)
            if (!list.length) return null
            return (
              <div key={verdict} className="row">
                <span className={`sd-verdict ${verdict}`}>{STAMP[verdict]}</span>
                {list.map((d) => (
                  <span key={d.card.title} className="tag">
                    {d.card.emoji} {d.card.title}
                  </span>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
