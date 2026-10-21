import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { Checkbox, Slider } from '../../kit/Controls'
import { createProgram, fitCanvas, fullscreenTriangle, FULLSCREEN_VS } from '../../kit/gl'
import {
  autoIterations,
  colorOf,
  escape,
  float32ZoomLimit,
  HOME,
  needsDouble,
  palettes,
  pan,
  spots,
  toComplex,
  zoomAt,
  zoomLevel,
  type View,
} from './mandel'
import './style.css'

/** Same maths as escape()/colorOf() in mandel.ts, in float32 on the GPU. */
const FS = `#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform vec2 uCenter;
uniform float uScale;
uniform int uMaxIter;
uniform bool uJulia;
uniform vec2 uJuliaC;
uniform vec3 uA, uB, uC, uD;
out vec4 outColor;
void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uResolution) * uScale;
  vec2 z = uJulia ? uCenter + p : vec2(0.0);
  vec2 c = uJulia ? uJuliaC : uCenter + p;
  float mu = -1.0;
  for (int n = 0; n < 5000; n++) {
    if (n >= uMaxIter) break;
    float d = dot(z, z);
    if (d > 256.0) { mu = float(n) + 1.0 - log2(0.5 * log(d)); break; }
    z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
  }
  if (mu < 0.0) { outColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  float t = fract(sqrt(max(mu, 0.0)) * 0.18);
  outColor = vec4(clamp(uA + uB * cos(6.2831853 * (uC * t + uD)), 0.0, 1.0), 1.0);
}`

const UNIFORMS = ['uResolution', 'uCenter', 'uScale', 'uMaxIter', 'uJulia', 'uJuliaC', 'uA', 'uB', 'uC', 'uD']
const CPU_BLOCK = 2 // CPU renders one sample per 2×2 CSS pixels: doubles are slow
const FLY_SECONDS = 2.4

interface Renderer {
  gl: WebGL2RenderingContext
  program: ReturnType<typeof createProgram>
  draw: () => void
}

function makeRenderer(canvas: HTMLCanvasElement): Renderer | null {
  const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: false })
  if (!gl) return null
  return { gl, program: createProgram(gl, FULLSCREEN_VS, FS, UNIFORMS), draw: fullscreenTriangle(gl) }
}

function render(r: Renderer, canvas: HTMLCanvasElement, opts: { center: [number, number]; scale: number; iterations: number; palette: number; julia: [number, number] | null }) {
  const { width, height, dpr } = fitCanvas(canvas)
  const { gl, program, draw } = r
  const { u } = program
  const p = palettes[opts.palette]
  gl.viewport(0, 0, width, height)
  gl.useProgram(program.program)
  gl.uniform2f(u.uResolution, width, height)
  gl.uniform2f(u.uCenter, opts.center[0], opts.center[1])
  gl.uniform1f(u.uScale, opts.scale / dpr)
  gl.uniform1i(u.uMaxIter, opts.iterations)
  gl.uniform1i(u.uJulia, opts.julia ? 1 : 0)
  gl.uniform2f(u.uJuliaC, opts.julia?.[0] ?? 0, opts.julia?.[1] ?? 0)
  gl.uniform3fv(u.uA, p.a)
  gl.uniform3fv(u.uB, p.b)
  gl.uniform3fv(u.uC, p.c)
  gl.uniform3fv(u.uD, p.d)
  draw()
}

const formatZoom = (z: number) => (z < 1000 ? `×${z.toFixed(z < 10 ? 1 : 0)}` : `×${z.toExponential(1).replace('e+', 'e')}`)

export default function Mandelbrot() {
  const [view, setView] = useState<View>(HOME)
  const [paletteIndex, setPaletteIndex] = useState(0)
  const [autoIter, setAutoIter] = useState(true)
  const [manualIter, setManualIter] = useState(300)
  const [juliaC, setJuliaC] = useState<[number, number]>([-0.8, 0.156])
  const [deep, setDeep] = useState<{ progress: number } | null>(null)
  const [flying, setFlying] = useState(false)
  const [glError, setGlError] = useState<string | null>(null)
  const [glReady, setGlReady] = useState(false)
  const [sizeTick, setSizeTick] = useState(0)

  const stage = useRef<HTMLDivElement>(null)
  const main = useRef<HTMLCanvasElement>(null)
  const cpu = useRef<HTMLCanvasElement>(null)
  const juliaCanvas = useRef<HTMLCanvasElement>(null)
  const renderers = useRef<{ main: Renderer | null; julia: Renderer | null }>({ main: null, julia: null })
  const cpuToken = useRef(0)
  const dragFrom = useRef<{ x: number; y: number } | null>(null)
  const flight = useRef(0)

  const iterations = autoIter ? autoIterations(view) : manualIter
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const useCpu = !glReady || needsDouble(view, dpr)

  // Set up WebGL once; without it everything falls back to the CPU renderer.
  useEffect(() => {
    try {
      renderers.current.main = main.current ? makeRenderer(main.current) : null
      renderers.current.julia = juliaCanvas.current ? makeRenderer(juliaCanvas.current) : null
      if (renderers.current.main) setGlReady(true)
      else setGlError('WebGL2 is not available, so everything is drawn on the CPU (slower).')
    } catch (error) {
      setGlError((error as Error).message)
    }
    const observer = new ResizeObserver(() => setSizeTick((t) => t + 1))
    if (stage.current) observer.observe(stage.current)
    return () => {
      observer.disconnect()
      cpuToken.current++
      cancelAnimationFrame(flight.current)
    }
  }, [])

  // Main view: GPU when float32 is enough, otherwise a progressive float64 render on the CPU.
  useEffect(() => {
    const canvas = main.current
    const r = renderers.current.main
    const id = requestAnimationFrame(() => {
      if (r && canvas) render(r, canvas, { center: [view.cx, view.cy], scale: view.scale, iterations, palette: paletteIndex, julia: null })
    })
    if (useCpu && !flying) renderCpu(view, iterations, paletteIndex)
    else {
      cpuToken.current++
      setDeep(null)
    }
    return () => cancelAnimationFrame(id)
  }, [view, iterations, paletteIndex, sizeTick, useCpu, flying])

  // Julia inset for the point last hovered.
  useEffect(() => {
    const canvas = juliaCanvas.current
    const r = renderers.current.julia
    if (!r || !canvas) return
    const id = requestAnimationFrame(() =>
      render(r, canvas, { center: [0, 0], scale: 3.2 / canvas.clientWidth, iterations: 300, palette: paletteIndex, julia: juliaC }),
    )
    return () => cancelAnimationFrame(id)
  }, [juliaC, paletteIndex, sizeTick])

  function renderCpu(v: View, maxIter: number, palette: number) {
    const canvas = cpu.current
    if (!canvas) return
    const token = ++cpuToken.current
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    const cw = Math.ceil(w / CPU_BLOCK)
    const ch = Math.ceil(h / CPU_BLOCK)
    canvas.width = cw
    canvas.height = ch
    const ctx = canvas.getContext('2d')!
    const image = ctx.createImageData(cw, ch)
    let row = 0
    setDeep({ progress: 0 })
    const work = () => {
      if (token !== cpuToken.current) return
      const started = performance.now()
      while (row < ch && performance.now() - started < 14) {
        for (let x = 0; x < cw; x++) {
          const [re, im] = toComplex(v, (x + 0.5) * CPU_BLOCK, (row + 0.5) * CPU_BLOCK, w, h)
          const [r, g, b] = colorOf(escape(re, im, maxIter), palette)
          const i = (row * cw + x) * 4
          image.data[i] = r * 255
          image.data[i + 1] = g * 255
          image.data[i + 2] = b * 255
          image.data[i + 3] = 255
        }
        row++
      }
      ctx.putImageData(image, 0, 0)
      setDeep({ progress: row / ch })
      if (row < ch) requestAnimationFrame(work)
    }
    requestAnimationFrame(work)
  }

  /** Animate to a view: zoom geometrically, steering the centre so the target stays on screen. */
  const flyTo = (target: View) => {
    cancelAnimationFrame(flight.current)
    const from = view
    const start = performance.now()
    setFlying(true)
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1000 / FLY_SECONDS)
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
      const scale = from.scale * (target.scale / from.scale) ** e
      // How far along the zoom we are decides how close the centre is to the target.
      const w = from.scale === target.scale ? e : (from.scale - scale) / (from.scale - target.scale)
      setView({ cx: from.cx + (target.cx - from.cx) * w, cy: from.cy + (target.cy - from.cy) * w, scale })
      if (t < 1) flight.current = requestAnimationFrame(tick)
      else setFlying(false)
    }
    flight.current = requestAnimationFrame(tick)
  }

  // Wheel zoom needs a non-passive listener to stop the page from scrolling.
  useEffect(() => {
    const el = stage.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const factor = Math.exp(e.deltaY * 0.0015)
      setView((v) => zoomAt(v, e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height, factor))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const local = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, w: rect.width, h: rect.height }
  }

  const zoomCenter = (factor: number) => {
    const el = stage.current
    if (!el) return
    setView((v) => zoomAt(v, el.clientWidth / 2, el.clientHeight / 2, el.clientWidth, el.clientHeight, factor))
  }

  return (
    <>
      <div className="card mb-toolbar">
        <div className="row">
          {spots.map((s) => (
            <button key={s.name} className="chip" onClick={() => flyTo(s.view)}>
              {s.name}
            </button>
          ))}
          <span className="spacer" />
          <button className="icon-button" onClick={() => zoomCenter(0.5)} aria-label="Zoom in">
            +
          </button>
          <button className="icon-button" onClick={() => zoomCenter(2)} aria-label="Zoom out">
            −
          </button>
        </div>
      </div>

      <div className="mb-layout">
        <div
          ref={stage}
          className="mb-stage"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            dragFrom.current = { x: e.clientX, y: e.clientY }
          }}
          onPointerMove={(e) => {
            const { x, y, w, h } = local(e)
            setJuliaC(toComplex(view, x, y, w, h))
            if (!dragFrom.current) return
            const dx = e.clientX - dragFrom.current.x
            const dy = e.clientY - dragFrom.current.y
            dragFrom.current = { x: e.clientX, y: e.clientY }
            setView((v) => pan(v, dx, dy))
          }}
          onPointerUp={() => (dragFrom.current = null)}
          onPointerCancel={() => (dragFrom.current = null)}
          onDoubleClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            setView((v) => zoomAt(v, e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height, e.shiftKey ? 3 : 0.33))
          }}
        >
          <canvas ref={main} className="mb-canvas" aria-label="Mandelbrot set: drag to pan, scroll or double-click to zoom" />
          <canvas ref={cpu} className={`mb-canvas mb-cpu${useCpu && !flying ? ' visible' : ''}`} aria-hidden />
          <div className="mb-badges">
            <span className="mb-badge">{formatZoom(zoomLevel(view))}</span>
            <span className={`mb-badge${useCpu && !flying ? ' cpu' : ''}`}>
              {useCpu && !flying
                ? `CPU · 64-bit${deep && deep.progress < 1 ? ` · ${Math.round(deep.progress * 100)}%` : ''}`
                : 'GPU · 32-bit'}
            </span>
          </div>
        </div>

        <div className="mb-side">
          <div className="card">
            <h3>Julia set</h3>
            <canvas ref={juliaCanvas} className="mb-julia" aria-label="Julia set for the hovered point" />
            <p className="mono small muted">
              c = {juliaC[0].toFixed(5)} {juliaC[1] < 0 ? '−' : '+'} {Math.abs(juliaC[1]).toFixed(5)}i
            </p>
            <p className="small muted">
              Hover the main view: each point c has its own Julia set. Inside the Mandelbrot set it's
              connected; outside, it shatters into dust.
            </p>
          </div>
          <div className="card">
            <div className="presets">
              {palettes.map((p, i) => (
                <button key={p.name} className={`chip${i === paletteIndex ? ' active' : ''}`} onClick={() => setPaletteIndex(i)}>
                  {p.name}
                </button>
              ))}
            </div>
            <Checkbox checked={autoIter} onChange={setAutoIter}>
              Iterations grow with zoom ({autoIterations(view)})
            </Checkbox>
            {!autoIter && <Slider label="Max iterations" value={manualIter} min={50} max={5000} step={50} onChange={setManualIter} />}
            <button onClick={() => flyTo(HOME)}>Reset view</button>
          </div>
        </div>
      </div>

      {glError && <p className="callout small">{glError}</p>}
      <p className="hint">
        Drag to pan, scroll or double-click to zoom (shift + double-click zooms out). The GPU uses
        32-bit floats: past roughly {formatZoom(float32ZoomLimit(view, dpr))} at this spot, neighbouring pixels round to the same number and the picture would turn blocky, so
        the page switches to 64-bit maths on the CPU, slower but sharp. Try "Deep (CPU)".
      </p>
    </>
  )
}
