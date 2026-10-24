import { useState, type CSSProperties } from 'react'
import { useFrame } from '../../kit/canvas'
import { Slider } from '../../kit/Controls'
import { COLS, GROUPING_NAME, labelReads, layout, NEUTRAL, perceive, PRINCIPLE_NAME, ROWS, type Principle, type Settings } from './gestalt'
import './style.css'

const W = 480
const H = 340
const R = 9

const PRESETS: { name: string; settings: Partial<Settings> }[] = [
  { name: 'Even grid', settings: {} },
  { name: 'Proximity → rows', settings: { proximity: 0.7 } },
  { name: 'Proximity vs colour', settings: { proximity: -0.7, color: 0.7 } },
  { name: 'Colour vs shape', settings: { color: 0.8, shape: 0.8 } },
  { name: 'Boxes beat spacing', settings: { proximity: 0.6, region: 0.8 } },
  { name: 'Lines beat boxes', settings: { region: 0.7, connect: 0.8 } },
  { name: 'Motion beats all', settings: { proximity: 0.5, color: 0.5, region: 0.5, fate: 1 } },
]

const SLIDERS: { key: Principle; min: number; hint: string }[] = [
  { key: 'proximity', min: -1, hint: '← columns · rows →' },
  { key: 'color', min: 0, hint: 'odd rows' },
  { key: 'shape', min: 0, hint: 'odd columns' },
  { key: 'region', min: 0, hint: '2 × 2 boxes' },
  { key: 'connect', min: 0, hint: 'pairs in a row' },
  { key: 'fate', min: 0, hint: 'odd columns move' },
]

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

function FormDemo() {
  const [spacing, setSpacing] = useState(0.2)
  const labelGap = Math.round(4 + spacing * 24)
  const fieldGap = Math.round(28 - spacing * 24)
  const reads = labelReads(labelGap, fieldGap)
  return (
    <div className="card gs-form-card">
      <strong>The same law in a form</strong>
      <Slider
        label="Label spacing"
        value={spacing}
        min={0}
        max={1}
        step={0.01}
        format={() => `${labelGap}px below the label · ${fieldGap}px above it`}
        onChange={setSpacing}
      />
      <div className="gs-form" style={{ '--label-gap': `${labelGap}px`, '--field-gap': `${fieldGap}px` } as CSSProperties}>
        {['Full name', 'Email', 'Phone'].map((label) => (
          <div key={label} className="gs-field">
            <span>{label}</span>
            <div className="gs-input" />
          </div>
        ))}
      </div>
      <p className={`small gs-verdict ${reads}`}>
        {reads === 'own' && '✓ Each label hugs its own field.'}
        {reads === 'ambiguous' && '≈ Labels float halfway: people have to read to work out which field they belong to.'}
        {reads === 'previous' && '✗ Each label now looks like a caption for the field above it.'}
      </p>
    </div>
  )
}

export default function Gestalt() {
  const [s, setS] = useState<Settings>({ ...NEUTRAL, proximity: 0.5, color: 0.6 })
  const [t, setT] = useState(0)
  const [showModel, setShowModel] = useState(true)
  const moving = s.fate > 0.02 && !reducedMotion()
  useFrame((dt) => setT((v) => v + dt), moving)

  const dots = layout(s.proximity, W, H)
  const at = (row: number, col: number) => dots[row * COLS + col]
  const bob = (col: number) => (moving && col % 2 ? Math.sin(t * 3.2) * s.fate * 16 : 0)
  const readings = perceive(s)
  const top = readings[0]
  const max = Math.max(1, ...readings.map((r) => r.score))

  return (
    <>
      <div className="card gs-controls">
        <div className="presets">
          {PRESETS.map((p) => (
            <button key={p.name} className="chip" onClick={() => setS({ ...NEUTRAL, ...p.settings })}>
              {p.name}
            </button>
          ))}
        </div>
        <p className="small muted">
          Every cue pulls the same {COLS * ROWS} dots towards a different grouping. Turn two of them up and decide what you see
          before you read the model’s guess.
        </p>
      </div>

      <div className="gs-layout">
        <div className="card gs-stage">
          <svg viewBox={`0 0 ${W} ${H}`} className="gs-field-svg" role="img" aria-label={`A grid of dots. Strongest grouping: ${top ? GROUPING_NAME[top.grouping] : 'none'}`}>
            {s.region > 0.02 &&
              Array.from({ length: ROWS / 2 }, (_, br) =>
                Array.from({ length: COLS / 2 }, (_, bc) => {
                  const a = at(br * 2, bc * 2)
                  const b = at(br * 2 + 1, bc * 2 + 1)
                  const pad = R + 7
                  return (
                    <rect
                      key={`${br}-${bc}`}
                      className="gs-region"
                      x={a.x - pad}
                      y={a.y - pad}
                      width={b.x - a.x + pad * 2}
                      height={b.y - a.y + pad * 2}
                      rx={12}
                      style={{ fillOpacity: s.region * 0.32, strokeOpacity: s.region * 0.7 }}
                    />
                  )
                }),
              )}
            {s.connect > 0.02 &&
              Array.from({ length: ROWS }, (_, row) =>
                Array.from({ length: COLS / 2 }, (_, pair) => {
                  const a = at(row, pair * 2)
                  const b = at(row, pair * 2 + 1)
                  return (
                    <line
                      key={`${row}-${pair}`}
                      className="gs-link"
                      x1={a.x}
                      y1={a.y + bob(a.col)}
                      x2={b.x}
                      y2={b.y + bob(b.col)}
                      style={{ strokeOpacity: s.connect, strokeWidth: 1.5 + s.connect * 2.5 }}
                    />
                  )
                }),
              )}
            {dots.map((d) => {
              const odd = d.row % 2 === 1
              const square = d.col % 2 === 1
              const fill = odd ? `color-mix(in oklab, var(--cat-sound) ${Math.round(s.color * 100)}%, var(--muted))` : 'var(--muted)'
              const rx = square ? R * (1 - s.shape) : R
              return (
                <rect
                  key={`${d.row}-${d.col}`}
                  x={d.x - R}
                  y={d.y - R + bob(d.col)}
                  width={R * 2}
                  height={R * 2}
                  rx={rx}
                  style={{ fill }}
                />
              )
            })}
          </svg>
          <div className="gs-sliders">
            {SLIDERS.map(({ key, min, hint }) => (
              <Slider
                key={key}
                label={
                  <>
                    {PRINCIPLE_NAME[key]} <span className="muted small">{hint}</span>
                  </>
                }
                value={s[key]}
                min={min}
                max={1}
                step={0.01}
                format={(v) => (key === 'proximity' ? (v > 0 ? `rows ${v.toFixed(2)}` : v < 0 ? `cols ${(-v).toFixed(2)}` : 'even') : v.toFixed(2))}
                onChange={(v) => setS((prev) => ({ ...prev, [key]: v }))}
              />
            ))}
          </div>
        </div>

        <div className="gs-side">
          <div className="card gs-model">
            <div className="row">
              <strong>What you probably see</strong>
              <span className="spacer" />
              <button className="chip" onClick={() => setShowModel((v) => !v)}>
                {showModel ? 'Hide' : 'Show'}
              </button>
            </div>
            {showModel ? (
              readings.length ? (
                <>
                  <p className="gs-answer">{GROUPING_NAME[top.grouping]}</p>
                  <ul className="gs-bars">
                    {readings.map((r) => (
                      <li key={r.grouping} className={r === top ? 'top' : ''}>
                        <span className="gs-bar-label">
                          {GROUPING_NAME[r.grouping]}
                          <span className="muted small"> · {r.because.map((p) => PRINCIPLE_NAME[p]).join(' + ')}</span>
                        </span>
                        <span className="gs-bar" style={{ width: `${(r.score / max) * 100}%` }} />
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="muted small">An even grid. Nothing pulls the dots together, so you see one big field (or start inventing groups).</p>
              )
            ) : (
              <p className="muted small">Decide first, then show the model.</p>
            )}
            <p className="small muted">
              A rough model: each cue scores its strength × a weight (common fate 1.4, connectedness 1.3, common region 1.2,
              proximity 1, colour 0.8, shape 0.6). Real perception isn’t this tidy, but the ranking holds up well.
            </p>
          </div>
          <FormDemo />
        </div>
      </div>
    </>
  )
}
