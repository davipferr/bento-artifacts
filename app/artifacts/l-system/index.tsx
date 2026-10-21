import { useEffect, useMemo, useState } from 'react'
import { useCanvas, useFrame, type Frame } from '../../kit/canvas'
import { Segmented, Slider } from '../../kit/Controls'
import { mulberry32, randomSeed } from '../../kit/random'
import { expand, parseRules, presets, rulesText, turtle, type Drawing, type Rules } from './lsystem'
import './style.css'

type ColorMode = 'depth' | 'path' | 'solid'

const BUCKETS = 24
const GROW_FRAMES = 100
const TRUNK = '#8a5a3b'

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const mix = (a: string, b: string, t: number) => {
  const [r1, g1, b1] = hexToRgb(a)
  const [r2, g2, b2] = hexToRgb(b)
  return `rgb(${Math.round(r1 + (r2 - r1) * t)}, ${Math.round(g1 + (g2 - g1) * t)}, ${Math.round(b1 + (b2 - b1) * t)})`
}

function draw({ ctx, width, height, color }: Frame, d: Drawing, shown: number, mode: ColorMode) {
  const { minX, minY, maxX, maxY } = d.bounds
  const pad = 24
  const scale = Math.min((width - 2 * pad) / (maxX - minX || 1), (height - 2 * pad) / (maxY - minY || 1))
  const ox = (width - (maxX - minX) * scale) / 2 - minX * scale
  const oy = (height - (maxY - minY) * scale) / 2 - minY * scale
  const base = Math.min(4, Math.max(0.7, scale * 0.35))
  const leaf = color('--cat-generative')
  const solid = color('--text')
  const n = Math.min(shown, d.count)

  // Group segments into a few buckets of the same colour and width: one stroke call each.
  const bucketOf = (i: number) =>
    mode === 'depth' ? Math.min(BUCKETS - 1, Math.round((d.depth[i] / Math.max(1, d.maxDepth)) * (BUCKETS - 1))) : mode === 'path' ? Math.floor((i / Math.max(1, d.count)) * BUCKETS) : 0
  const paths = Array.from({ length: BUCKETS }, () => new Path2D())
  for (let i = 0; i < n; i++) {
    const k = i * 4
    const path = paths[bucketOf(i)]
    path.moveTo(ox + d.lines[k] * scale, oy + d.lines[k + 1] * scale)
    path.lineTo(ox + d.lines[k + 2] * scale, oy + d.lines[k + 3] * scale)
  }
  ctx.lineCap = 'round'
  paths.forEach((path, b) => {
    const t = b / (BUCKETS - 1)
    if (mode === 'depth') {
      ctx.strokeStyle = mix(TRUNK, leaf, Math.min(1, t * 1.4))
      ctx.lineWidth = base * (1.6 - 1.2 * t)
    } else if (mode === 'path') {
      ctx.strokeStyle = `hsl(${200 + 160 * t} 75% 55%)`
      ctx.lineWidth = base
    } else {
      ctx.strokeStyle = solid
      ctx.lineWidth = base
    }
    ctx.stroke(path)
  })
}

export default function LSystemGarden() {
  const [presetName, setPresetName] = useState(presets[0].name)
  const [axiom, setAxiom] = useState(presets[0].axiom)
  const [source, setSource] = useState(rulesText(presets[0].rules))
  const [drawSymbols, setDrawSymbols] = useState(presets[0].draw)
  const [heading, setHeading] = useState(presets[0].heading)
  const [angle, setAngle] = useState(presets[0].angle)
  const [iterations, setIterations] = useState(presets[0].iterations)
  const [jitter, setJitter] = useState(0)
  const [seed, setSeed] = useState(1)
  const [mode, setMode] = useState<ColorMode>('depth')
  const [shown, setShown] = useState(0)

  const parsed = useMemo((): { rules: Rules; error: null } | { rules: null; error: string } => {
    try {
      return { rules: parseRules(source), error: null }
    } catch (e) {
      return { rules: null, error: (e as Error).message }
    }
  }, [source])

  const expansion = useMemo(
    () => (parsed.rules ? expand(axiom, parsed.rules, iterations) : null),
    [axiom, parsed.rules, iterations],
  )
  const drawing = useMemo(
    () =>
      expansion ? turtle(expansion.text, { angle, heading, draw: drawSymbols || 'F' }, jitter, mulberry32(seed)) : null,
    [expansion, angle, heading, drawSymbols, jitter, seed],
  )

  // Regrow from the root whenever the structure changes (not on angle tweaks: those redraw in place).
  useEffect(() => setShown(0), [expansion, presetName])
  const growing = drawing !== null && shown < drawing.count
  useFrame(() => {
    if (drawing) setShown((s) => Math.min(drawing.count, s + Math.max(1, Math.ceil(drawing.count / GROW_FRAMES))))
  }, growing)

  const canvas = useCanvas((frame) => {
    if (drawing) draw(frame, drawing, shown, mode)
  })

  const loadPreset = (name: string) => {
    const p = presets.find((x) => x.name === name)!
    setPresetName(name)
    setAxiom(p.axiom)
    setSource(rulesText(p.rules))
    setDrawSymbols(p.draw)
    setHeading(p.heading)
    setAngle(p.angle)
    setIterations(p.iterations)
    setJitter(0)
    setMode(p.heading === -90 ? 'depth' : 'path')
  }

  return (
    <>
      <div className="card">
        <div className="presets">
          {presets.map((p) => (
            <button key={p.name} className={`chip${p.name === presetName ? ' active' : ''}`} onClick={() => loadPreset(p.name)}>
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="ls-layout">
        <div className="card ls-stage">
          <canvas ref={canvas.ref} className="canvas ls-canvas" aria-label={`${presetName} drawn by the turtle`} />
          <div className="row">
            <button className="primary" onClick={() => setShown(0)}>
              ↻ Regrow
            </button>
            <button onClick={() => setSeed(randomSeed())} disabled={jitter === 0}>
              🎲 New wind
            </button>
            <span className="spacer" />
            <Segmented
              value={mode}
              options={[
                { value: 'depth', label: 'Trunk → leaves' },
                { value: 'path', label: 'Along the path' },
                { value: 'solid', label: 'Ink' },
              ]}
              onChange={setMode}
            />
          </div>
        </div>

        <div className="card ls-rules">
          <label className="ls-field">
            <span>Axiom (start)</span>
            <input value={axiom} onChange={(e) => setAxiom(e.target.value.replace(/\s/g, ''))} spellCheck={false} />
          </label>
          <label className="ls-field">
            <span>Rules, one per line</span>
            <textarea
              className={parsed.error ? 'invalid' : undefined}
              value={source}
              onChange={(e) => setSource(e.target.value)}
              rows={4}
              spellCheck={false}
            />
          </label>
          {parsed.error && <p className="ls-error small">{parsed.error}</p>}
          <label className="ls-field">
            <span>Symbols that draw</span>
            <input value={drawSymbols} onChange={(e) => setDrawSymbols(e.target.value.replace(/\s/g, ''))} spellCheck={false} />
          </label>
          <Slider label="Iterations" value={iterations} min={0} max={14} onChange={setIterations} />
          <Slider label="Angle" value={angle} min={1} max={180} step={0.5} format={(v) => `${v}°`} onChange={setAngle} />
          <Slider label="Wind (random turn)" value={jitter} min={0} max={20} step={0.5} format={(v) => (v ? `±${v}°` : 'calm')} onChange={setJitter} />

          <dl className="ls-stats">
            <div>
              <dt>String length</dt>
              <dd>{expansion ? expansion.text.length.toLocaleString('en-US') : '—'}</dd>
            </div>
            <div>
              <dt>Segments</dt>
              <dd>{drawing ? drawing.count.toLocaleString('en-US') : '—'}</dd>
            </div>
          </dl>
          {expansion?.truncated && (
            <p className="callout small">
              Stopped after {expansion.done} iterations: one more would pass 1.5 million symbols.
            </p>
          )}
          {expansion && (
            <p className="ls-preview mono small" title="The start of the rewritten string">
              {expansion.text.slice(0, 160)}
              {expansion.text.length > 160 && '…'}
            </p>
          )}
        </div>
      </div>

      <p className="hint">
        <code>F</code> draws a step, <code>+</code>/<code>-</code> turn by the angle, <code>[</code> and{' '}
        <code>]</code> start and end a branch. Letters like <code>X</code> draw nothing but get rewritten
        each round, which is how a plant "knows" where to sprout. Every iteration rewrites all symbols
        at once, so the string, and the picture, grow exponentially.
      </p>
    </>
  )
}
