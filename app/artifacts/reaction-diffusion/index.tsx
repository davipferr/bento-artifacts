import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { useCanvas, useFrame, type Frame } from '../../kit/canvas'
import { Checkbox, Segmented, Slider } from '../../kit/Controls'
import { createProgram, fitCanvas, floatTarget, fullscreenTriangle, FULLSCREEN_VS, rgb01, type Program, type Target } from '../../kit/gl'
import { emptyField, MAP, presets, saddleNode, stamp, step, type Field } from './grayscott'
import './style.css'

/** Same update as step() in grayscott.ts, one cell per fragment. */
const SIM_FS = `#version 300 es
precision highp float;
uniform sampler2D uState;
uniform vec2 uTexel;
uniform float uFeed, uKill;
uniform vec3 uBrush;      // x, y in uv; radius in cells (0 = no brush)
uniform float uBrushValue; // 1 paints B, 0 erases
in vec2 vUv;
out vec4 outState;
void main() {
  vec2 s = texture(uState, vUv).rg;
  vec2 lap = -s
    + 0.2 * (texture(uState, vUv + vec2(uTexel.x, 0.0)).rg + texture(uState, vUv - vec2(uTexel.x, 0.0)).rg
           + texture(uState, vUv + vec2(0.0, uTexel.y)).rg + texture(uState, vUv - vec2(0.0, uTexel.y)).rg)
    + 0.05 * (texture(uState, vUv + uTexel).rg + texture(uState, vUv - uTexel).rg
            + texture(uState, vUv + vec2(uTexel.x, -uTexel.y)).rg + texture(uState, vUv + vec2(-uTexel.x, uTexel.y)).rg);
  float a = s.r;
  float b = s.g;
  float abb = a * b * b;
  float na = a + 1.0 * lap.r - abb + uFeed * (1.0 - a);
  float nb = b + 0.5 * lap.g + abb - (uKill + uFeed) * b;
  if (uBrush.z > 0.0) {
    vec2 d = (vUv - uBrush.xy) / uTexel;
    if (dot(d, d) < uBrush.z * uBrush.z) {
      nb = uBrushValue;
      if (uBrushValue == 0.0) na = 1.0;
    }
  }
  outState = vec4(clamp(na, 0.0, 1.0), clamp(nb, 0.0, 1.0), 0.0, 1.0);
}`

/** Colour by how much B has taken over, with optional relief shading from B's slope. */
const RENDER_FS = `#version 300 es
precision highp float;
uniform sampler2D uState;
uniform vec2 uTexel;
uniform vec3 uColors[5];
uniform bool uRelief;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec2 s = texture(uState, vUv).rg;
  float t = clamp(1.0 - (s.r - s.g), 0.0, 1.0);
  float x = t * 4.0;
  int i = int(min(floor(x), 3.0));
  vec3 color = mix(uColors[i], uColors[i + 1], x - float(i));
  if (uRelief) {
    float dx = texture(uState, vUv + vec2(uTexel.x, 0.0)).g - texture(uState, vUv - vec2(uTexel.x, 0.0)).g;
    float dy = texture(uState, vUv + vec2(0.0, uTexel.y)).g - texture(uState, vUv - vec2(0.0, uTexel.y)).g;
    vec3 n = normalize(vec3(-dx * 6.0, -dy * 6.0, 1.0));
    color *= 0.75 + 0.35 * dot(n, normalize(vec3(-0.5, 0.6, 0.8)));
  }
  outColor = vec4(color, 1.0);
}`

const palettes: { name: string; colors: string[] }[] = [
  { name: 'Lagoon', colors: ['#06141f', '#0e3a53', '#1f7a8c', '#8fd3e8', '#f1fbff'] },
  { name: 'Ember', colors: ['#0c0507', '#4a0d0d', '#c2410c', '#f59e0b', '#fff4d6'] },
  { name: 'Bio', colors: ['#08130b', '#14532d', '#22c55e', '#bef264', '#f7fee7'] },
  { name: 'Ink', colors: ['#f7f3ea', '#d6cfc0', '#8a8172', '#3a3631', '#121110'] },
  { name: 'Candy', colors: ['#1a0b2e', '#5b1a8a', '#e0459b', '#ffa8d9', '#fff0fa'] },
]

type Seed = 'center' | 'scatter' | 'ring'

const GPU_CELL = 2 // CSS pixels per simulation cell
const CPU_CELL = 4

/** Starting chemicals: all A, with some B planted according to `seed`. */
function seedField(width: number, height: number, seed: Seed): Field {
  const field = emptyField(width, height)
  if (seed === 'center') stamp(field, width / 2, height / 2, 8)
  else if (seed === 'ring') {
    const r = Math.min(width, height) * 0.3
    for (let a = 0; a < Math.PI * 2; a += 0.05) stamp(field, width / 2 + Math.cos(a) * r, height / 2 + Math.sin(a) * r, 2)
  } else {
    for (let i = 0; i < 24; i++) stamp(field, Math.random() * width, Math.random() * height, 3 + Math.floor(Math.random() * 4))
  }
  return field
}

function pack(field: Field): Float32Array {
  const data = new Float32Array(field.width * field.height * 4)
  for (let i = 0; i < field.a.length; i++) {
    data[i * 4] = field.a[i]
    data[i * 4 + 1] = field.b[i]
    data[i * 4 + 3] = 1
  }
  return data
}

interface Gpu {
  gl: WebGL2RenderingContext
  sim: Program
  show: Program
  draw: () => void
  targets: [Target, Target]
  current: 0 | 1
  width: number
  height: number
}

export default function ReactionDiffusion() {
  const [feed, setFeed] = useState(presets[0].feed)
  const [kill, setKill] = useState(presets[0].kill)
  const [speed, setSpeed] = useState(12)
  const [brush, setBrush] = useState(6)
  const [paletteIndex, setPaletteIndex] = useState(0)
  const [relief, setRelief] = useState(true)
  const [running, setRunning] = useState(true)
  const [seed, setSeed] = useState<Seed>('scatter')
  const [mode, setMode] = useState<'gpu' | 'cpu' | null>(null)
  const [resetTick, setResetTick] = useState(0)

  const canvas = useRef<HTMLCanvasElement>(null)
  const gpu = useRef<Gpu | null>(null)
  const cpu = useRef<Field | null>(null)
  const pointer = useRef<{ x: number; y: number; erase: boolean } | null>(null)

  // The frame loop reads settings from here.
  const live = useRef({ feed, kill, speed, brush, paletteIndex, relief })
  live.current = { feed, kill, speed, brush, paletteIndex, relief }

  // Build the simulation for the canvas size: GPU if float render targets work, else CPU.
  // The GL context and programs are made once; Reset, a new seed or a resize only re-seed.
  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const build = () => {
      const cssW = el.clientWidth
      const cssH = el.clientHeight
      if (!gpu.current && !cpu.current) {
        // Probe on a throwaway canvas: once a canvas has a WebGL context it can't give a 2D one.
        const probe = document.createElement('canvas').getContext('webgl2')
        const supported = Boolean(probe?.getExtension('EXT_color_buffer_float'))
        probe?.getExtension('WEBGL_lose_context')?.loseContext()
        const gl = supported ? el.getContext('webgl2', { antialias: false }) : null
        if (gl && gl.getExtension('EXT_color_buffer_float')) {
          try {
            gpu.current = {
              gl,
              sim: createProgram(gl, FULLSCREEN_VS, SIM_FS, ['uState', 'uTexel', 'uFeed', 'uKill', 'uBrush', 'uBrushValue']),
              show: createProgram(gl, FULLSCREEN_VS, RENDER_FS, ['uState', 'uTexel', 'uColors', 'uRelief']),
              draw: fullscreenTriangle(gl),
              targets: null as unknown as [Target, Target],
              current: 0,
              width: 0,
              height: 0,
            }
            setMode('gpu')
          } catch {
            gpu.current = null
          }
        }
        if (!gpu.current) setMode('cpu')
      }
      const g = gpu.current
      if (g) {
        for (const old of g.targets ?? []) {
          g.gl.deleteTexture(old.texture)
          g.gl.deleteFramebuffer(old.framebuffer)
        }
        g.width = Math.max(8, Math.floor(cssW / GPU_CELL))
        g.height = Math.max(8, Math.floor(cssH / GPU_CELL))
        const data = pack(seedField(g.width, g.height, seed))
        g.targets = [floatTarget(g.gl, g.width, g.height, data), floatTarget(g.gl, g.width, g.height, data)]
        g.current = 0
      } else {
        const w = Math.max(8, Math.floor(cssW / CPU_CELL))
        const h = Math.max(8, Math.floor(cssH / CPU_CELL))
        el.width = w
        el.height = h
        cpu.current = seedField(w, h, seed)
      }
    }
    let lastWidth = -1
    const observer = new ResizeObserver(() => {
      if (el.clientWidth === lastWidth) return
      lastWidth = el.clientWidth
      build()
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [resetTick, seed])

  const stepGpu = (g: Gpu, steps: number) => {
    const { gl, sim, show, draw } = g
    const s = live.current
    const p = pointer.current
    gl.useProgram(sim.program)
    gl.viewport(0, 0, g.width, g.height)
    gl.uniform2f(sim.u.uTexel, 1 / g.width, 1 / g.height)
    gl.uniform1f(sim.u.uFeed, s.feed)
    gl.uniform1f(sim.u.uKill, s.kill)
    gl.uniform3f(sim.u.uBrush, p?.x ?? 0, p ? 1 - p.y : 0, p ? s.brush : 0)
    gl.uniform1f(sim.u.uBrushValue, p?.erase ? 0 : 1)
    gl.uniform1i(sim.u.uState, 0)
    gl.activeTexture(gl.TEXTURE0)
    for (let i = 0; i < steps; i++) {
      const next = (1 - g.current) as 0 | 1
      gl.bindFramebuffer(gl.FRAMEBUFFER, g.targets[next].framebuffer)
      gl.bindTexture(gl.TEXTURE_2D, g.targets[g.current].texture)
      draw()
      g.current = next
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    const { width, height } = fitCanvas(canvas.current!)
    gl.viewport(0, 0, width, height)
    gl.useProgram(show.program)
    gl.bindTexture(gl.TEXTURE_2D, g.targets[g.current].texture)
    gl.uniform1i(show.u.uState, 0)
    gl.uniform2f(show.u.uTexel, 1 / g.width, 1 / g.height)
    gl.uniform3fv(show.u.uColors, palettes[s.paletteIndex].colors.flatMap(rgb01))
    gl.uniform1i(show.u.uRelief, s.relief ? 1 : 0)
    draw()
  }

  const stepCpu = (field: Field, steps: number) => {
    const s = live.current
    const p = pointer.current
    let f = field
    if (p) stamp(f, p.x * f.width, p.y * f.height, Math.max(1, Math.round((s.brush * GPU_CELL) / CPU_CELL)), p.erase ? 0 : 1)
    for (let i = 0; i < steps; i++) f = step(f, s.feed, s.kill)
    cpu.current = f
    const ctx = canvas.current!.getContext('2d')!
    const image = ctx.createImageData(f.width, f.height)
    const stops = palettes[s.paletteIndex].colors.map(rgb01)
    for (let i = 0; i < f.a.length; i++) {
      const t = Math.min(1, Math.max(0, 1 - (f.a[i] - f.b[i]))) * 4
      const k = Math.min(3, Math.floor(t))
      const u = t - k
      for (let c = 0; c < 3; c++) image.data[i * 4 + c] = (stops[k][c] + (stops[k + 1][c] - stops[k][c]) * u) * 255
      image.data[i * 4 + 3] = 255
    }
    ctx.putImageData(image, 0, 0)
  }

  // Drawing still works while paused, so you can paint and then press play.
  useFrame(() => {
    // A frame can land after unmount has detached the ref but before the loop is cancelled.
    if (!canvas.current) return
    const steps = running ? live.current.speed : 0
    if (gpu.current?.targets) stepGpu(gpu.current, steps)
    else if (cpu.current) stepCpu(cpu.current, Math.min(steps, 4))
  }, mode !== null)

  const local = (e: PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height, erase: e.button === 2 || e.shiftKey }
  }

  // ---- (k, f) parameter map -----------------------------------------------

  const toMap = (k: number, f: number, w: number, h: number): [number, number] => [
    ((k - MAP.kMin) / (MAP.kMax - MAP.kMin)) * w,
    h - ((f - MAP.fMin) / (MAP.fMax - MAP.fMin)) * h,
  ]

  const drawMap = ({ ctx, width, height, color }: Frame) => {
    ctx.fillStyle = color('--bg')
    ctx.fillRect(0, 0, width, height)
    ctx.strokeStyle = color('--grid')
    ctx.lineWidth = 1
    for (let k = MAP.kMin; k <= MAP.kMax + 1e-9; k += 0.01) {
      const [x] = toMap(k, 0, width, height)
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }
    for (let f = MAP.fMin; f <= MAP.fMax + 1e-9; f += 0.02) {
      const [, y] = toMap(MAP.kMin, f, width, height)
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }
    ctx.strokeStyle = color('--muted')
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    for (let f = 0; f <= MAP.fMax; f += 0.0005) {
      const [x, y] = toMap(saddleNode(f), f, width, height)
      if (f === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
    ctx.setLineDash([])

    ctx.font = '10.5px ui-sans-serif, system-ui, sans-serif'
    for (const p of presets) {
      const [x, y] = toMap(p.kill, p.feed, width, height)
      ctx.fillStyle = color('--muted')
      ctx.beginPath()
      ctx.arc(x, y, 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = color('--text')
      ctx.fillText(p.name, x + 5, y + 3.5)
    }
    const [cx, cy] = toMap(kill, feed, width, height)
    ctx.strokeStyle = color('--cat')
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.arc(cx, cy, 7, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = color('--muted')
    ctx.fillText('kill k →', width - 46, height - 6)
    ctx.fillText('↑ feed f', 4, 12)
  }

  const map = useCanvas(drawMap)
  const pickFromMap = (e: PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const k = MAP.kMin + ((e.clientX - rect.left) / rect.width) * (MAP.kMax - MAP.kMin)
    const f = MAP.fMin + (1 - (e.clientY - rect.top) / rect.height) * (MAP.fMax - MAP.fMin)
    setKill(+Math.min(MAP.kMax, Math.max(MAP.kMin, k)).toFixed(4))
    setFeed(+Math.min(MAP.fMax, Math.max(MAP.fMin, f)).toFixed(4))
  }
  const preset = presets.find((p) => p.feed === feed && p.kill === kill)

  return (
    <>
      <div className="card rd-toolbar">
        <div className="row">
          <button className="primary" onClick={() => setRunning((r) => !r)}>
            {running ? '❚❚ Pause' : '▶ Run'}
          </button>
          <button onClick={() => setResetTick((t) => t + 1)}>Reset</button>
          <Segmented
            value={seed}
            options={[
              { value: 'scatter', label: 'Scattered seeds' },
              { value: 'center', label: 'One seed' },
              { value: 'ring', label: 'Ring' },
            ]}
            onChange={setSeed}
          />
          <span className="spacer" />
          {palettes.map((p, i) => (
            <button
              key={p.name}
              className={`rd-swatch${i === paletteIndex ? ' active' : ''}`}
              style={{ background: `linear-gradient(90deg, ${p.colors.join(', ')})` }}
              onClick={() => setPaletteIndex(i)}
              title={p.name}
              aria-label={`${p.name} colours`}
              aria-pressed={i === paletteIndex}
            />
          ))}
        </div>
        <div className="presets">
          {presets.map((p) => (
            <button
              key={p.name}
              className={`chip${preset === p ? ' active' : ''}`}
              onClick={() => {
                setFeed(p.feed)
                setKill(p.kill)
              }}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="rd-layout">
        <div className="rd-stage">
          <canvas
            ref={canvas}
            className={`rd-canvas${mode === 'cpu' ? ' pixelated' : ''}`}
            aria-label="Reaction–diffusion: drag to paint chemical B, right-drag or shift-drag to erase"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              pointer.current = local(e)
            }}
            onPointerMove={(e) => {
              if (pointer.current) pointer.current = { ...local(e), erase: pointer.current.erase }
            }}
            onPointerUp={() => (pointer.current = null)}
            onPointerCancel={() => (pointer.current = null)}
            onContextMenu={(e) => e.preventDefault()}
          />
          {mode === 'cpu' && <span className="rd-badge">CPU fallback (no float render targets)</span>}
        </div>

        <div className="card rd-side">
          <h3>Feed and kill rates</h3>
          <canvas
            ref={map.ref}
            className="canvas rd-map"
            aria-label="Parameter map: click to choose feed and kill"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              pickFromMap(e)
            }}
            onPointerMove={(e) => e.buttons && pickFromMap(e)}
          />
          <p className="mono small">
            f = {feed.toFixed(4)} · k = {kill.toFixed(4)}
          </p>
          <Slider label="Feed f" value={Math.round(feed * 10000)} min={0} max={1000} format={(v) => (v / 10000).toFixed(4)} onChange={(v) => setFeed(v / 10000)} />
          <Slider label="Kill k" value={Math.round(kill * 10000)} min={300} max={700} format={(v) => (v / 10000).toFixed(4)} onChange={(v) => setKill(v / 10000)} />
          <Slider label="Speed" value={speed} min={1} max={40} format={(v) => `${v} steps/frame`} onChange={setSpeed} />
          <Slider label="Brush" value={brush} min={2} max={30} format={(v) => `${v} cells`} onChange={setBrush} />
          <Checkbox checked={relief} onChange={setRelief}>
            Relief shading
          </Checkbox>
        </div>
      </div>

      <p className="hint">
        Two chemicals: A is fed in everywhere, B eats A to make more B and slowly dies off. Both
        spread, B half as fast. Drag on the canvas to pour in B (right-drag or shift-drag to erase).
        The dashed line on the map is where the empty state stops being the only stable one; the
        living patterns sit right around it, and moving a few thousandths changes spots into stripes.
      </p>
    </>
  )
}
