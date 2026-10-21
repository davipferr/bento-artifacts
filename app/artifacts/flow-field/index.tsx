import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { useFrame } from '../../kit/canvas'
import { Checkbox, Segmented, Slider } from '../../kit/Controls'
import { createNoise3D, type Noise3D } from '../../kit/noise'
import { mulberry32, randomSeed } from '../../kit/random'
import { colorIndex, fieldAngle, palettes, Particles, step, type ColorMode, type FlowParams } from './flow'
import './style.css'

const STEPS_PER_FRAME = 2
const BRUSH = { perFrame: 40, radius: 26 }
const ARROW_GAP = 30

const looks: { name: string; zoom: number; turbulence: number; speed: number }[] = [
  { name: 'Silk', zoom: 8, turbulence: 1, speed: 1.2 },
  { name: 'Rivers', zoom: 5, turbulence: 2.5, speed: 2 },
  { name: 'Storm', zoom: 30, turbulence: 4, speed: 2.5 },
  { name: 'Marble', zoom: 16, turbulence: 7, speed: 1.4 },
  { name: 'Fur', zoom: 45, turbulence: 1.5, speed: 1 },
]

export default function FlowField() {
  const [paletteIndex, setPaletteIndex] = useState(2)
  const [colorMode, setColorMode] = useState<ColorMode>('angle')
  const [count, setCount] = useState(3000)
  const [zoom, setZoom] = useState(12)
  const [turbulence, setTurbulence] = useState(2)
  const [speed, setSpeed] = useState(1.5)
  const [fade, setFade] = useState(0)
  const [lineWidth, setLineWidth] = useState(1)
  const [evolve, setEvolve] = useState(true)
  const [showField, setShowField] = useState(false)
  const [running, setRunning] = useState(true)
  const [seed, setSeed] = useState(randomSeed)

  const art = useRef<HTMLCanvasElement>(null)
  const overlay = useRef<HTMLCanvasElement>(null)
  const size = useRef({ width: 0, height: 0 })
  const particles = useRef<Particles | null>(null)
  const noise = useRef<Noise3D>(createNoise3D(mulberry32(seed)))
  const z = useRef(0)
  const frames = useRef(0)
  const pointer = useRef<{ x: number; y: number } | null>(null)

  const palette = palettes[paletteIndex]
  const params: FlowParams = { scale: zoom / 10000, turbulence, speed }
  // The frame loop reads the latest settings from here.
  const live = useRef({ palette, params, colorMode, fade, lineWidth, evolve, showField, count })
  live.current = { palette, params, colorMode, fade, lineWidth, evolve, showField, count }

  /** Fit both canvases to their box at device resolution; returns the 2D context of the art canvas. */
  const fit = () => {
    const dpr = window.devicePixelRatio || 1
    for (const canvas of [art.current, overlay.current]) {
      if (!canvas) continue
      canvas.width = Math.round(canvas.clientWidth * dpr)
      canvas.height = Math.round(canvas.clientHeight * dpr)
      canvas.getContext('2d')!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    size.current = { width: art.current!.clientWidth, height: art.current!.clientHeight }
  }

  const clear = () => {
    const ctx = art.current?.getContext('2d')
    if (!ctx) return
    ctx.globalAlpha = 1
    ctx.fillStyle = live.current.palette.background
    ctx.fillRect(0, 0, size.current.width, size.current.height)
    particles.current = new Particles(live.current.count, size.current.width, size.current.height, Math.random)
  }

  const drawField = () => {
    const ctx = overlay.current?.getContext('2d')
    if (!ctx) return
    const { width, height } = size.current
    ctx.clearRect(0, 0, width, height)
    if (!live.current.showField) return
    const light = live.current.palette.background.toLowerCase() > '#888888'
    ctx.strokeStyle = light ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.45)'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let y = ARROW_GAP / 2; y < height; y += ARROW_GAP) {
      for (let x = ARROW_GAP / 2; x < width; x += ARROW_GAP) {
        const a = fieldAngle(noise.current, x, y, z.current, live.current.params)
        const dx = Math.cos(a) * 10
        const dy = Math.sin(a) * 10
        ctx.moveTo(x - dx, y - dy)
        ctx.lineTo(x + dx, y + dy)
        ctx.lineTo(x + dx - Math.cos(a - 0.5) * 4, y + dy - Math.sin(a - 0.5) * 4)
      }
    }
    ctx.stroke()
  }

  // Size the canvases now and whenever their box changes (that also wipes the painting).
  useEffect(() => {
    const canvas = art.current
    if (!canvas) return
    let lastWidth = -1
    const observer = new ResizeObserver(() => {
      if (canvas.clientWidth === lastWidth) return
      lastWidth = canvas.clientWidth
      fit()
      clear()
      drawField()
    })
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  // A new seed is a new field: start a fresh painting. A new palette needs a new background.
  useEffect(() => {
    noise.current = createNoise3D(mulberry32(seed))
    clear()
    drawField()
  }, [seed, paletteIndex])

  useEffect(() => {
    if (particles.current?.count !== count) {
      particles.current = new Particles(live.current.count, size.current.width, size.current.height, Math.random)
    }
  }, [count])

  useEffect(drawField, [showField, zoom, turbulence])

  useFrame((dt) => {
    const ctx = art.current?.getContext('2d')
    const ps = particles.current
    if (!ctx || !ps) return
    const s = live.current
    const { width, height } = size.current

    if (s.fade > 0) {
      ctx.globalAlpha = s.fade
      ctx.fillStyle = s.palette.background
      ctx.fillRect(0, 0, width, height)
    }
    if (pointer.current) {
      for (let k = 0; k < BRUSH.perFrame; k++) {
        ps.respawn(Math.floor(Math.random() * ps.count), width, height, Math.random, { ...pointer.current, radius: BRUSH.radius })
      }
    }

    ctx.globalAlpha = s.palette.alpha
    ctx.lineWidth = s.lineWidth
    ctx.lineCap = 'round'
    const colors = s.palette.colors.length
    const bucket = new Uint8Array(ps.count)
    for (let n = 0; n < STEPS_PER_FRAME; n++) {
      step(ps, noise.current, z.current, s.params, width, height, Math.random)
      for (let i = 0; i < ps.count; i++) bucket[i] = colorIndex(ps, i, s.colorMode, colors, height)
      // One path per colour: thousands of segments, only a few stroke calls.
      for (let c = 0; c < colors; c++) {
        ctx.strokeStyle = s.palette.colors[c]
        ctx.beginPath()
        for (let i = 0; i < ps.count; i++) {
          if (bucket[i] !== c || Number.isNaN(ps.px[i])) continue
          ctx.moveTo(ps.px[i], ps.py[i])
          ctx.lineTo(ps.x[i], ps.y[i])
        }
        ctx.stroke()
      }
    }
    ctx.globalAlpha = 1

    if (s.evolve) z.current += dt * 0.06
    if (s.showField && s.evolve && ++frames.current % 6 === 0) drawField()
  }, running)

  const toCanvas = (e: PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const savePng = () => {
    art.current?.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `flow-field-${seed}.png`
      a.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }

  return (
    <>
      <div className="card flow-toolbar">
        <div className="row">
          <button className="primary" onClick={() => setRunning((r) => !r)}>
            {running ? '❚❚ Pause' : '▶ Paint'}
          </button>
          <button onClick={clear}>Clear</button>
          <button onClick={() => setSeed(randomSeed())}>🎲 New field</button>
          <button onClick={savePng}>Save PNG</button>
          <span className="divider" />
          {looks.map((look) => (
            <button
              key={look.name}
              className="chip"
              onClick={() => {
                setZoom(look.zoom)
                setTurbulence(look.turbulence)
                setSpeed(look.speed)
                clear()
              }}
            >
              {look.name}
            </button>
          ))}
        </div>
        <div className="row">
          {palettes.map((p, i) => (
            <button
              key={p.name}
              className={`palette-chip${i === paletteIndex ? ' active' : ''}`}
              style={{ background: p.background }}
              onClick={() => setPaletteIndex(i)}
              title={p.name}
              aria-label={`${p.name} palette`}
              aria-pressed={i === paletteIndex}
            >
              {p.colors.map((c) => (
                <i key={c} style={{ background: c }} />
              ))}
            </button>
          ))}
          <span className="spacer" />
          <Segmented
            value={colorMode}
            options={[
              { value: 'angle', label: 'Colour by direction' },
              { value: 'particle', label: 'by particle' },
              { value: 'height', label: 'by height' },
            ]}
            onChange={setColorMode}
          />
        </div>
      </div>

      <div className="flow-stage">
        <canvas
          ref={art}
          className="flow-canvas"
          aria-label="Flow field painting; press and drag to spray particles"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            pointer.current = toCanvas(e)
          }}
          onPointerMove={(e) => {
            if (pointer.current) pointer.current = toCanvas(e)
          }}
          onPointerUp={() => (pointer.current = null)}
          onPointerCancel={() => (pointer.current = null)}
        />
        <canvas ref={overlay} className="flow-overlay" aria-hidden />
      </div>

      <div className="card flow-controls">
        <Slider label="Zoom (noise scale)" value={zoom} min={2} max={60} onChange={setZoom} />
        <Slider label="Turbulence" value={turbulence} min={0.5} max={8} step={0.5} onChange={setTurbulence} />
        <Slider label="Speed" value={speed} min={0.3} max={5} step={0.1} format={(v) => `${v} px/step`} onChange={setSpeed} />
        <Slider label="Particles" value={count} min={500} max={10000} step={500} onChange={setCount} />
        <Slider label="Line width" value={lineWidth} min={0.5} max={4} step={0.5} format={(v) => `${v} px`} onChange={setLineWidth} />
        <Slider
          label="Fade"
          value={Math.round(fade * 100)}
          min={0}
          max={20}
          format={(v) => (v === 0 ? 'never (painting)' : `${v}% per frame`)}
          onChange={(v) => setFade(v / 100)}
        />
        <div className="flow-checks">
          <Checkbox checked={evolve} onChange={setEvolve}>
            Field drifts over time
          </Checkbox>
          <Checkbox checked={showField} onChange={setShowField}>
            Show the field
          </Checkbox>
        </div>
      </div>

      <p className="hint">
        Each particle asks the noise field "which way?" at its position and takes a small step. Noise
        changes smoothly, so nearby particles agree and their trails braid into currents. Press and
        drag on the canvas to spray particles from the pointer. With fade at zero nothing is erased,
        so the picture keeps building up like ink.
      </p>
    </>
  )
}
