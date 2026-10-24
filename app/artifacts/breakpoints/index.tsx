import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { useFrame } from '../../kit/canvas'
import { Segmented } from '../../kit/Controls'
import { bands, clampWidth, current, DEVICES, diff, layout, MAX_WIDTH, MIN_WIDTH, SETS, stylesheet, tier, type SetName } from './breakpoints'
import './style.css'

const FRAME_H = 560 // logical height of the fake browser window
const SET_OPTIONS = (Object.keys(SETS) as SetName[]).map((value) => ({ value, label: SETS[value].label }))
const SWEEP_SPEED = 420 // px of width per second

const pct = (w: number) => ((w - MIN_WIDTH) / (MAX_WIDTH - MIN_WIDTH)) * 100

export default function Breakpoints() {
  const [set, setSet] = useState<SetName>('tailwind')
  const [width, setWidth] = useState(390)
  const [target, setTarget] = useState<number | null>(null)
  const [sweep, setSweep] = useState<0 | 1 | -1>(0)
  const [available, setAvailable] = useState(900)
  const [log, setLog] = useState<string[]>([])
  const stage = useRef<HTMLDivElement>(null)
  const ruler = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; w: number; scale: number } | null>(null)

  const points = SETS[set].points
  const L = layout(width, points)
  const scale = Math.min(1, (available - 28) / width)

  useEffect(() => {
    const el = stage.current
    if (!el) return
    const observer = new ResizeObserver(() => setAvailable(el.clientWidth))
    observer.observe(el)
    setAvailable(el.clientWidth)
    return () => observer.disconnect()
  }, [])

  // Log every breakpoint crossing with what it changed.
  const previous = useRef({ width, set })
  useEffect(() => {
    const before = previous.current
    previous.current = { width, set }
    if (before.set !== set) return setLog((l) => [`Switched to ${SETS[set].label} breakpoints`, ...l].slice(0, 8))
    const a = tier(before.width, points)
    const b = tier(width, points)
    if (a === b) return
    const crossed = b > a ? points[b - 1] : points[b]
    const head = `${b > a ? '↑' : '↓'} ${crossed.min}px ${b > a ? `into ${crossed.name}` : `back to ${current(width, points)}`}`
    const changes = diff(layout(before.width, points), layout(width, points))
    setLog((l) => [`${head}${changes.length ? `: ${changes.join(', ')}` : ''}`, ...l].slice(0, 8))
  }, [width, set])

  // Glide to a preset, or sweep back and forth.
  useFrame(
    (dt) => {
      if (sweep) {
        const next = width + sweep * SWEEP_SPEED * dt
        if (next >= MAX_WIDTH) setSweep(-1)
        if (next <= MIN_WIDTH) setSweep(1)
        setWidth(clampWidth(next))
        return
      }
      if (target === null) return
      const next = width + (target - width) * Math.min(1, dt * 9)
      if (Math.abs(target - next) < 1) {
        setWidth(target)
        setTarget(null)
      } else setWidth(next)
    },
    sweep !== 0 || target !== null,
  )

  const goTo = (w: number) => {
    setSweep(0)
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) setWidth(clampWidth(w))
    else setTarget(clampWidth(w))
  }

  const onHandleDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, w: width, scale }
    setSweep(0)
    setTarget(null)
  }
  const onHandleMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    // At scale 1 the edge follows the pointer; once the page is scaled down, a pixel of drag is worth more.
    setWidth(clampWidth(d.w + (e.clientX - d.x) / d.scale))
  }

  const fromRuler = (clientX: number) => {
    const rect = ruler.current!.getBoundingClientRect()
    return clampWidth(MIN_WIDTH + ((clientX - rect.left) / rect.width) * (MAX_WIDTH - MIN_WIDTH))
  }

  const rules = stylesheet(width, points)
  const name = current(width, points)
  const device = DEVICES.reduce((best, d) => (Math.abs(d.width - width) < Math.abs(best.width - width) ? d : best))
  const shownWidth = Math.round(width)

  return (
    <>
      <div className="card bp-controls">
        <div className="row">
          <Segmented value={set} options={SET_OPTIONS} onChange={setSet} />
          <span className="spacer" />
          <button className={sweep ? 'primary' : ''} onClick={() => setSweep(sweep ? 0 : width > 1100 ? -1 : 1)}>
            {sweep ? '■ Stop' : '↔ Sweep'}
          </button>
        </div>
        <div className="presets">
          {DEVICES.map((d) => (
            <button key={d.name} className={`chip${Math.round(width) === d.width ? ' active' : ''}`} onClick={() => goTo(d.width)}>
              {d.name} <span className="count">{d.width}</span>
            </button>
          ))}
        </div>

        <div
          className="bp-ruler"
          ref={ruler}
          role="slider"
          tabIndex={0}
          aria-label="Viewport width"
          aria-valuemin={MIN_WIDTH}
          aria-valuemax={MAX_WIDTH}
          aria-valuenow={shownWidth}
          aria-valuetext={`${shownWidth} pixels, ${name}`}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            setSweep(0)
            setTarget(null)
            setWidth(fromRuler(e.clientX))
          }}
          onPointerMove={(e) => {
            if (e.buttons & 1) setWidth(fromRuler(e.clientX))
          }}
          onKeyDown={(e) => {
            const step = e.shiftKey ? 100 : 10
            if (e.key === 'ArrowRight' || e.key === 'ArrowUp') setWidth((w) => clampWidth(w + step))
            else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') setWidth((w) => clampWidth(w - step))
            else if (e.key === 'PageUp' || e.key === 'PageDown') {
              // Jump to the next / previous breakpoint edge.
              const edges = [MIN_WIDTH, ...points.map((p) => p.min), MAX_WIDTH]
              const next = e.key === 'PageUp' ? edges.find((x) => x > width) : [...edges].reverse().find((x) => x < width)
              if (next !== undefined) setWidth(next)
            } else return
            e.preventDefault()
          }}
        >
          <div className="bp-bands">
            {bands(points).map((b) => {
            const from = Math.max(MIN_WIDTH, b.from)
            const to = Math.min(MAX_WIDTH, b.to)
            if (to <= MIN_WIDTH) return null
            const active = width >= b.from && width < b.to
            return (
              <div key={b.name} className={`bp-band${active ? ' active' : ''}`} style={{ left: `${pct(from)}%`, width: `${pct(to) - pct(from)}%` }}>
                <span>{b.name}</span>
              </div>
            )
            })}
          </div>
          {points.map((p) => (
            <span key={p.name} className="bp-tick" style={{ left: `${pct(p.min)}%` }}>
              {p.min}
            </span>
          ))}
          <div className="bp-marker" style={{ left: `${pct(width)}%` }} />
        </div>
      </div>

      <div className="bp-main">
        <div className="card bp-stage-card">
          <div className="bp-stage" ref={stage}>
            <div className="bp-frame-wrap" style={{ width: width * scale, height: FRAME_H * scale }}>
              <div className="bp-frame" style={{ width, height: FRAME_H, transform: `scale(${scale})` }}>
                <div className="bp-chrome">
                  <i />
                  <i />
                  <i />
                  <span className="bp-url">acme.dev · {shownWidth}px</span>
                </div>
                <div
                  className={[
                    'bp-page',
                    `cols-${L.columns}`,
                    `foot-${L.footerColumns}`,
                    L.menuButton ? 'menu' : '',
                    L.heroSplit ? 'split' : '',
                    L.sidebar ? 'side' : '',
                  ].join(' ')}
                >
                  <header className="bp-header">
                    <span className="bp-logo">◆ Acme</span>
                    {L.menuButton ? (
                      <span className="bp-menu">☰</span>
                    ) : (
                      <nav className="bp-links">
                        <span>Product</span>
                        <span>Pricing</span>
                        <span>Docs</span>
                        <span className="bp-cta">Sign up</span>
                      </nav>
                    )}
                  </header>
                  <section className="bp-hero">
                    <div>
                      <h4>Ship layouts that bend, not break.</h4>
                      <p>One stylesheet, five breakpoints, every screen.</p>
                      <span className="bp-button">Get started</span>
                    </div>
                    <div className="bp-hero-art" />
                  </section>
                  <div className="bp-body">
                    {L.sidebar && (
                      <aside className="bp-sidebar">
                        <b>Filters</b>
                        {['All', 'Design', 'Code', 'Docs', 'Video'].map((f, i) => (
                          <span key={f} className={i === 0 ? 'on' : ''}>
                            {f}
                          </span>
                        ))}
                      </aside>
                    )}
                    <div className="bp-cards">
                      {Array.from({ length: 8 }, (_, i) => (
                        <div key={i} className="bp-card" style={{ '--h': (i * 47) % 360 } as CSSProperties}>
                          <div />
                          <span />
                          <span className="short" />
                        </div>
                      ))}
                    </div>
                  </div>
                  <footer className="bp-footer">
                    {['Company', 'Product', 'Resources', 'Legal'].map((f) => (
                      <div key={f}>
                        <b>{f}</b>
                        <span />
                        <span />
                      </div>
                    ))}
                  </footer>
                </div>
              </div>
              <div
                className="bp-handle"
                role="separator"
                aria-orientation="vertical"
                aria-label="Drag to resize the viewport"
                onPointerDown={onHandleDown}
                onPointerMove={onHandleMove}
                onPointerUp={() => (drag.current = null)}
                onPointerCancel={() => (drag.current = null)}
              >
                <span />
              </div>
            </div>
          </div>
          <p className="hint">
            {scale < 1 ? `Shown at ${Math.round(scale * 100)}% so ${shownWidth}px fits. ` : ''}Drag the handle on the right edge, click the
            ruler, or focus it and use ← → (Shift for 100px, PageUp/PageDown to jump between breakpoints).
          </p>
        </div>

        <div className="card bp-side">
          <div className="bp-now">
            <span className="bp-name">{name}</span>
            <span className="mono">{shownWidth}px</span>
            <span className="muted small">≈ {device.name}</span>
          </div>
          <div className="bp-rules">
            {rules.map((r) => (
              <div key={r.name} className={`bp-rule${r.active ? ' active' : ''}`}>
                <div className="bp-query mono">{r.query || '/* base: every width */'}</div>
                <pre className="mono">{r.css}</pre>
              </div>
            ))}
          </div>
          {log.length > 0 && (
            <ol className="bp-log small">
              {log.map((l, i) => (
                <li key={`${log.length - i}`}>{l}</li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </>
  )
}
