import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { Segmented, Slider } from '../../kit/Controls'
import {
  contrast,
  cssOklch,
  harmonies,
  harmony,
  hex,
  hexToRgb,
  inGamut,
  MAX_CHROMA,
  oklchToRgb,
  rating,
  rgbToOklch,
  SCALE_STEPS,
  tonalScale,
  type Harmony,
  type Oklch,
} from './color'
import './style.css'

/** The wheel is painted at a fixed resolution and scaled by CSS: cheap to repaint while dragging. */
const SIZE = 240
const R = SIZE / 2

const WHITE = { r: 1, g: 1, b: 1 }
const BLACK = { r: 0, g: 0, b: 0 }

type Format = 'hex' | 'oklch'
type ExportKind = 'css' | 'tailwind' | 'json'

/** Hue/chroma disc at one lightness. Out-of-gamut areas are drawn faded at their mapped colour. */
function paintWheel(canvas: HTMLCanvasElement, l: number) {
  const ctx = canvas.getContext('2d')!
  const image = ctx.createImageData(SIZE, SIZE)
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = x - R + 0.5
      const dy = y - R + 0.5
      const r = Math.hypot(dx, dy)
      if (r > R) continue
      const color = { l, c: (r / R) * MAX_CHROMA, h: ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360 }
      let rgb = oklchToRgb(color)
      const ok = inGamut(rgb)
      if (!ok) rgb = oklchToRgb({ ...color, c: color.c * 0.4 })
      const i = (y * SIZE + x) * 4
      image.data[i] = Math.max(0, Math.min(255, rgb.r * 255))
      image.data[i + 1] = Math.max(0, Math.min(255, rgb.g * 255))
      image.data[i + 2] = Math.max(0, Math.min(255, rgb.b * 255))
      image.data[i + 3] = ok ? 255 : 70
    }
  }
  ctx.putImageData(image, 0, 0)
}

const position = (color: Oklch): [number, number] => {
  const r = (Math.min(color.c, MAX_CHROMA) / MAX_CHROMA) * R
  const a = (color.h * Math.PI) / 180
  return [R + Math.cos(a) * r, R + Math.sin(a) * r]
}

function Wheel({ base, palette, onChange }: { base: Oklch; palette: Oklch[]; onChange: (c: Oklch) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const dragging = useRef(false)

  useEffect(() => {
    if (canvas.current) paintWheel(canvas.current, base.l)
  }, [base.l])

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const dx = ((e.clientX - rect.left) / rect.width) * SIZE - R
    const dy = ((e.clientY - rect.top) / rect.height) * SIZE - R
    const c = Math.min(1, Math.hypot(dx, dy) / R) * MAX_CHROMA
    const h = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360
    onChange({ l: base.l, c: +c.toFixed(3), h: +h.toFixed(1) })
  }

  const [bx, by] = position(base)
  return (
    <div className="wheel-box">
      <canvas ref={canvas} width={SIZE} height={SIZE} className="color-wheel" aria-hidden />
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="wheel-overlay"
        role="slider"
        aria-label="Hue and chroma"
        aria-valuetext={cssOklch(base)}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          dragging.current = true
          pick(e)
        }}
        onPointerMove={(e) => dragging.current && pick(e)}
        onPointerUp={() => (dragging.current = false)}
      >
        {palette.map((color, i) => {
          const [x, y] = position(color)
          return (
            <g key={i}>
              <line x1={R} y1={R} x2={x} y2={y} className="spoke" />
              <circle cx={x} cy={y} r={7} fill={hex(color)} className="marker" />
            </g>
          )
        })}
        <circle cx={bx} cy={by} r={11} fill={hex(base)} className="marker base" />
      </svg>
    </div>
  )
}

function exportText(kind: ExportKind, scales: Oklch[][], format: Format) {
  const value = (c: Oklch) => (format === 'hex' ? hex(c) : cssOklch(c))
  if (kind === 'css') {
    const lines = scales.flatMap((scale, i) => scale.map((c, s) => `  --color-${i + 1}-${SCALE_STEPS[s]}: ${value(c)};`))
    return `:root {\n${lines.join('\n')}\n}`
  }
  if (kind === 'tailwind') {
    const body = scales
      .map(
        (scale, i) =>
          `      'color-${i + 1}': {\n${scale.map((c, s) => `        ${SCALE_STEPS[s]}: '${value(c)}',`).join('\n')}\n      },`,
      )
      .join('\n')
    return `// tailwind.config.js\nexport default {\n  theme: {\n    extend: {\n      colors: {\n${body}\n      },\n    },\n  },\n}`
  }
  const json = Object.fromEntries(
    scales.map((scale, i) => [`color-${i + 1}`, Object.fromEntries(scale.map((c, s) => [SCALE_STEPS[s], value(c)]))]),
  )
  return JSON.stringify(json, null, 2)
}

async function copy(text: string, done: () => void) {
  try {
    await navigator.clipboard.writeText(text)
    done()
  } catch {
    // Clipboard blocked: the text is on screen to select by hand.
  }
}

export default function ColorPalette() {
  const [base, setBase] = useState<Oklch>(() => rgbToOklch(hexToRgb('#4c6ef5')!))
  const [kind, setKind] = useState<Harmony>('triadic')
  const [format, setFormat] = useState<Format>('hex')
  const [exportKind, setExportKind] = useState<ExportKind>('css')
  const [hexInput, setHexInput] = useState('#4c6ef5')
  const [copied, setCopied] = useState<string | null>(null)

  const palette = useMemo(() => harmony(base, kind), [base, kind])
  const scales = useMemo(() => palette.map(tonalScale), [palette])
  const text = useMemo(() => exportText(exportKind, scales, format), [exportKind, scales, format])
  const show = (c: Oklch) => (format === 'hex' ? hex(c) : cssOklch(c))

  const update = (next: Oklch) => {
    setBase(next)
    setHexInput(hex(next))
  }

  const flash = (what: string) => {
    setCopied(what)
    window.setTimeout(() => setCopied((c) => (c === what ? null : c)), 1200)
  }

  const clipped = !inGamut(oklchToRgb(base))
  const grid = [...palette.map((c, i) => ({ name: `${i + 1}`, rgb: oklchToRgb(c), css: hex(c) })), { name: 'white', rgb: WHITE, css: '#ffffff' }, { name: 'black', rgb: BLACK, css: '#000000' }]

  return (
    <>
      <div className="palette-top">
        <div className="card wheel-card">
          <Wheel base={base} palette={palette} onChange={update} />
          <p className="hint">
            Drag on the disc: angle is hue, distance from the centre is chroma. Faded areas can't be
            shown on an sRGB screen at this lightness.
          </p>
        </div>

        <div className="card base-card">
          <div className="base-row">
            <span className="base-swatch" style={{ background: hex(base) }} />
            <label className="hex-input">
              Base colour
              <input
                value={hexInput}
                spellCheck={false}
                onChange={(e) => {
                  setHexInput(e.target.value)
                  const rgb = hexToRgb(e.target.value)
                  if (rgb) setBase(rgbToOklch(rgb))
                }}
              />
            </label>
            <button
              onClick={() =>
                update({ l: 0.55 + Math.random() * 0.15, c: 0.12 + Math.random() * 0.08, h: Math.random() * 360 })
              }
            >
              🎲 Random
            </button>
          </div>
          <p className="mono small muted">
            {cssOklch(base)}
            {clipped && ' · out of sRGB, shown with less chroma'}
          </p>
          <Slider label="Lightness L" value={Math.round(base.l * 100)} min={15} max={97} format={(v) => `${v}%`} onChange={(v) => update({ ...base, l: v / 100 })} />
          <Slider label="Chroma C" value={Math.round(base.c * 1000)} min={0} max={370} format={(v) => (v / 1000).toFixed(3)} onChange={(v) => update({ ...base, c: v / 1000 })} />
          <Slider label="Hue H" value={Math.round(base.h)} min={0} max={359} format={(v) => `${v}°`} onChange={(v) => update({ ...base, h: v })} />
          <Segmented
            label="Harmony"
            value={kind}
            options={(Object.keys(harmonies) as Harmony[]).map((k) => ({ value: k, label: k }))}
            onChange={setKind}
          />
        </div>
      </div>

      <div className="card palette-mid">
        <div className="row">
          <h3>Palette</h3>
          <span className="spacer" />
          <Segmented
            value={format}
            options={[
              { value: 'hex', label: 'HEX' },
              { value: 'oklch', label: 'OKLCH' },
            ]}
            onChange={setFormat}
          />
        </div>
        <div className="swatches">
          {palette.map((color, i) => {
            const rgb = oklchToRgb(color)
            const onWhite = contrast(rgb, WHITE)
            const onBlack = contrast(rgb, BLACK)
            const text = onBlack > onWhite ? '#000' : '#fff'
            return (
              <button
                key={i}
                className="swatch-big"
                style={{ background: hex(color), color: text }}
                onClick={() => copy(show(color), () => flash(`swatch${i}`))}
                title="Copy"
              >
                <span className="swatch-value mono">{copied === `swatch${i}` ? 'copied ✓' : show(color)}</span>
                <span className="swatch-contrast">
                  <span>white {onWhite.toFixed(1)} · {rating(onWhite)}</span>
                  <span>black {onBlack.toFixed(1)} · {rating(onBlack)}</span>
                </span>
              </button>
            )
          })}
        </div>

        <div className="scales">
          {scales.map((scale, i) => (
            <div key={i} className="scale-row">
              {scale.map((c, s) => (
                <button
                  key={s}
                  className="scale-cell"
                  style={{ background: hex(c), color: c.l > 0.6 ? '#000' : '#fff' }}
                  title={`${SCALE_STEPS[s]} · ${show(c)} (click to copy)`}
                  onClick={() => copy(show(c), () => flash(`${i}-${s}`))}
                >
                  {copied === `${i}-${s}` ? '✓' : SCALE_STEPS[s]}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="palette-bottom">
        <div className="card">
          <h3>Contrast grid</h3>
          <p className="muted small">Text colour (rows) on background (columns). WCAG needs 4.5 for body text, 3 for large text.</p>
          <div className="contrast-scroll">
            <table className="contrast-grid">
              <thead>
                <tr>
                  <th />
                  {grid.map((col) => (
                    <th key={col.name}>
                      <i className="swatch" style={{ background: col.css }} />
                      {col.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grid.map((row) => (
                  <tr key={row.name}>
                    <th>
                      <i className="swatch" style={{ background: row.css }} />
                      {row.name}
                    </th>
                    {grid.map((col) => {
                      const ratio = contrast(row.rgb, col.rgb)
                      const level = rating(ratio)
                      return (
                        <td key={col.name} style={{ background: col.css, color: row.css }}>
                          {row.name === col.name ? (
                            '—'
                          ) : (
                            <>
                              <strong>Aa</strong> <span className={`level level-${level.replace(' ', '-')}`}>{ratio.toFixed(1)}</span>
                            </>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="row">
            <h3>Export</h3>
            <span className="spacer" />
            <Segmented
              value={exportKind}
              options={[
                { value: 'css', label: 'CSS variables' },
                { value: 'tailwind', label: 'Tailwind' },
                { value: 'json', label: 'JSON' },
              ]}
              onChange={setExportKind}
            />
          </div>
          <pre className="export-code">{text}</pre>
          <button className="primary" onClick={() => copy(text, () => flash('export'))}>
            {copied === 'export' ? 'Copied ✓' : 'Copy'}
          </button>
        </div>
      </div>
    </>
  )
}
