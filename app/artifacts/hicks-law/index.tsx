import { useRef, useState } from 'react'
import { Segmented } from '../../kit/Controls'
import { bits, fit, menu, plan, SIZES, summary, type Item, type Layout, type Size, type Trial } from './hick'
import './style.css'

const LAYOUTS = [
  { value: 'flat', label: 'Flat (shuffled)' },
  { value: 'grouped', label: 'Grouped' },
  { value: 'search', label: 'Searchable' },
] as const
const COLOR: Record<Layout, string> = { flat: 'var(--cat-games)', grouped: 'var(--cat-tools)', search: 'var(--cat-generative)' }
const NAME: Record<Layout, string> = { flat: 'Flat', grouped: 'Grouped', search: 'Search' }
const PER_SIZE = 3

interface Current {
  n: Size
  items: Item[]
  target: string
  start: number
  errors: number
  wrong: string | null
}

function Chart({ trials }: { trials: Trial[] }) {
  const W = 420
  const H = 230
  const pad = { l: 46, r: 14, t: 14, b: 34 }
  const maxMs = Math.max(2000, ...trials.map((t) => t.ms)) * 1.08
  const x = (n: number) => pad.l + ((bits(n) - bits(4)) / (bits(64) - bits(4))) * (W - pad.l - pad.r)
  const y = (ms: number) => H - pad.b - (ms / maxMs) * (H - pad.t - pad.b)
  const ticks = Array.from({ length: 5 }, (_, i) => Math.round((maxMs / 4) * i / 100) * 100)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="hk-chart" role="img" aria-label="Your choice times by menu size">
      {ticks.map((ms) => (
        <g key={ms}>
          <line x1={pad.l} x2={W - pad.r} y1={y(ms)} y2={y(ms)} className="hk-gridline" />
          <text x={pad.l - 6} y={y(ms) + 4} textAnchor="end">
            {ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}`}
          </text>
        </g>
      ))}
      {SIZES.map((n) => (
        <text key={n} x={x(n)} y={H - pad.b + 18} textAnchor="middle">
          {n} items
        </text>
      ))}
      {(['flat', 'grouped', 'search'] as const).map((layout) => {
        const own = trials.filter((t) => t.layout === layout)
        const f = fit(own.map((t) => ({ n: t.n, ms: t.ms })))
        return (
          <g key={layout} style={{ color: COLOR[layout] }}>
            {f && (
              <path
                className="hk-fit"
                d={Array.from({ length: 31 }, (_, i) => {
                  const n = 4 * 16 ** (i / 30)
                  return `${i ? 'L' : 'M'}${x(n).toFixed(1)},${y(Math.max(0, f.a + f.b * bits(n))).toFixed(1)}`
                }).join('')}
              />
            )}
            {own.map((t, i) => (
              <circle key={i} cx={x(t.n) + ((i % 5) - 2) * 3} cy={y(t.ms)} r={3.5} className="hk-dot" />
            ))}
          </g>
        )
      })}
    </svg>
  )
}

export default function HicksLaw() {
  const [layout, setLayout] = useState<Layout>('flat')
  const [trials, setTrials] = useState<Trial[]>([])
  const [queue, setQueue] = useState<Size[]>([])
  const [stage, setStage] = useState<'idle' | 'ready' | 'choosing'>('idle')
  const [current, setCurrent] = useState<Current | null>(null)
  const [query, setQuery] = useState('')
  const [flash, setFlash] = useState<string | null>(null)
  const readyRef = useRef<HTMLButtonElement>(null)

  const setUp = (sizes: Size[]) => {
    if (!sizes.length) {
      setStage('idle')
      setCurrent(null)
      setQueue([])
      return
    }
    const n = sizes[0]
    const items = menu(n, layout, Math.random)
    const target = items[Math.floor(Math.random() * items.length)].label
    setQueue(sizes)
    setCurrent({ n, items, target, start: 0, errors: 0, wrong: null })
    setQuery('')
    setStage('ready')
    requestAnimationFrame(() => readyRef.current?.focus())
  }

  const go = () => {
    if (!current) return
    setCurrent({ ...current, start: performance.now() })
    setStage('choosing')
  }

  const pick = (label: string) => {
    if (!current || stage !== 'choosing') return
    if (label !== current.target) {
      setCurrent({ ...current, errors: current.errors + 1, wrong: label })
      return
    }
    const ms = Math.round(performance.now() - current.start)
    setTrials((t) => [...t, { layout, n: current.n, target: current.target, ms, errors: current.errors }])
    setFlash(`${ms} ms`)
    window.setTimeout(() => setFlash(null), 700)
    setUp(queue.slice(1))
  }

  const sums = summary(trials)
  const shown = current && stage === 'choosing' ? current.items : []
  const filtered = layout === 'search' && query ? shown.filter((i) => i.label.toLowerCase().includes(query.trim().toLowerCase())) : shown
  const progress = queue.length ? SIZES.length * PER_SIZE - queue.length + 1 : 0

  return (
    <>
      <div className="card hk-controls">
        <div className="row">
          <Segmented value={layout} options={LAYOUTS} onChange={(v) => stage === 'idle' && setLayout(v)} />
          <span className="spacer" />
          {stage === 'idle' ? (
            <button className="primary" onClick={() => setUp(plan(PER_SIZE, Math.random))}>
              Start a round ({SIZES.length * PER_SIZE} picks)
            </button>
          ) : (
            <button onClick={() => setUp([])}>Stop</button>
          )}
        </div>
        <p className="small muted">
          Each pick: read the word, press <strong>Ready</strong>, then click it in the menu as fast as you can. The clock starts
          when the menu appears. Do a round with each layout and compare the curves.
        </p>
      </div>

      <div className="hk-layout">
        <div className={`card hk-arena ${layout}`}>
          {stage === 'idle' && (
            <div className="hk-empty">
              <p>
                <strong>Hick’s law:</strong> choosing takes longer with more options, but only logarithmically:
                T = a + b · log₂(n + 1).
              </p>
              <p className="muted small">Grouping lets you skip whole sections. Search turns choosing into typing.</p>
            </div>
          )}
          {current && stage !== 'idle' && (
            <>
              <div className="hk-target">
                <span className="muted small">
                  Pick {progress} of {SIZES.length * PER_SIZE} · {current.n} options
                </span>
                <strong>{current.target}</strong>
                {stage === 'ready' && (
                  <button ref={readyRef} className="primary hk-ready" onClick={go}>
                    Ready
                  </button>
                )}
                {flash && <span className="hk-flash">✓ {flash}</span>}
              </div>
              {stage === 'choosing' && (
                <div className="hk-menu" role="menu" aria-label="Options">
                  {layout === 'search' && (
                    <input
                      autoFocus
                      className="hk-search"
                      placeholder="Type to filter…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && filtered[0]) pick(filtered[0].label)
                      }}
                      aria-label="Filter options"
                    />
                  )}
                  {layout === 'grouped' ? (
                    <div className="hk-groups">
                      {[...new Set(shown.map((i) => i.category))].map((category) => (
                        <div key={category} className="hk-group">
                          <span className="hk-group-name">{category}</span>
                          {shown
                            .filter((i) => i.category === category)
                            .map((i) => (
                              <button key={i.label} role="menuitem" className={`hk-item${current.wrong === i.label ? ' wrong' : ''}`} onClick={() => pick(i.label)}>
                                {i.label}
                              </button>
                            ))}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={`hk-grid n${current.n}`}>
                      {filtered.map((i) => (
                        <button key={i.label} role="menuitem" className={`hk-item${current.wrong === i.label ? ' wrong' : ''}`} onClick={() => pick(i.label)}>
                          {i.label}
                        </button>
                      ))}
                      {!filtered.length && <span className="muted small">No match for “{query}”.</span>}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="card hk-results">
          <Chart trials={trials} />
          <div className="legend">
            {(['flat', 'grouped', 'search'] as const).map((l) => {
              const f = fit(trials.filter((t) => t.layout === l).map((t) => ({ n: t.n, ms: t.ms })))
              return (
                <span key={l}>
                  <i className="swatch" style={{ background: COLOR[l] }} />
                  {NAME[l]}
                  {f && (
                    <span className="mono">
                      {' '}
                      ≈ {Math.round(f.a)} + {Math.round(f.b)}·log₂(n+1)
                    </span>
                  )}
                </span>
              )
            })}
          </div>
          <table className="hk-table small">
            <thead>
              <tr>
                <th>Median</th>
                {SIZES.map((n) => (
                  <th key={n}>{n}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(['flat', 'grouped', 'search'] as const).map((l) => (
                <tr key={l}>
                  <th>
                    <i className="swatch" style={{ background: COLOR[l] }} />
                    {NAME[l]}
                  </th>
                  {SIZES.map((n) => (
                    <td key={n}>{sums[l][n] ? `${sums[l][n]} ms` : '·'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="row">
            <span className="small muted">
              {trials.length} picks · {trials.reduce((s, t) => s + t.errors, 0)} misclicks
            </span>
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
