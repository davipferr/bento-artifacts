import { useMemo, useRef, useState, type PointerEvent } from 'react'
import { useCanvas, useFrame, type Frame } from '../../kit/canvas'
import { Checkbox, Slider } from '../../kit/Controls'
import { dft, epicycles, error, normalize, resample, shapes, type Point } from './fourier'
import './style.css'

const SAMPLES = 256
const QUICK_COUNTS = [1, 2, 5, 10, 30, 100, SAMPLES]

/** World coordinates are in [-1, 1]; map them to the canvas with some margin. */
const view = (width: number, height: number) => {
  const scale = (Math.min(width, height) / 2) * 0.78
  return { scale, cx: width / 2, cy: height / 2 }
}

export default function FourierDrawing() {
  const [shapeName, setShapeName] = useState('Heart')
  const [custom, setCustom] = useState<Point[] | null>(null)
  const [count, setCount] = useState(20)
  const [seconds, setSeconds] = useState(8)
  const [showCircles, setShowCircles] = useState(true)
  const [showOriginal, setShowOriginal] = useState(true)
  const [playing, setPlaying] = useState(true)
  const [drawing, setDrawing] = useState(false)

  const t = useRef(0)
  const trace = useRef<Point[]>([])
  const stroke = useRef<Point[]>([])

  const raw = shapeName === 'custom' && custom ? custom : shapes.find((s) => s.name === shapeName)!.points
  const samples = useMemo(() => resample(normalize(raw), SAMPLES), [raw])
  const terms = useMemo(() => dft(samples), [samples])
  const k = Math.min(count, terms.length)
  const err = useMemo(() => error(samples, terms, k), [samples, terms, k])

  const resetTrace = () => {
    trace.current = []
  }

  const drawMain = ({ ctx, width, height, color }: Frame) => {
    ctx.fillStyle = color('--bg')
    ctx.fillRect(0, 0, width, height)

    if (drawing) {
      ctx.fillStyle = color('--muted')
      ctx.font = '15px ui-sans-serif, system-ui, sans-serif'
      ctx.textAlign = 'center'
      if (stroke.current.length < 2) ctx.fillText('Draw one continuous shape, then let go', width / 2, height / 2)
      ctx.strokeStyle = color('--cat')
      ctx.lineWidth = 3
      ctx.lineJoin = 'round'
      ctx.beginPath()
      stroke.current.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
      ctx.stroke()
      return
    }

    const { scale, cx, cy } = view(width, height)
    const sx = (x: number) => cx + x * scale
    const sy = (y: number) => cy + y * scale

    if (showOriginal) {
      ctx.strokeStyle = color('--grid')
      ctx.lineWidth = 6
      ctx.lineJoin = 'round'
      ctx.beginPath()
      samples.forEach(([x, y], i) => (i ? ctx.lineTo(sx(x), sy(y)) : ctx.moveTo(sx(x), sy(y))))
      ctx.closePath()
      ctx.stroke()
    }

    const joints = epicycles(terms, k, t.current)
    if (showCircles) {
      ctx.lineWidth = 1
      ctx.strokeStyle = color('--muted')
      for (let i = 1; i < joints.length; i++) {
        const r = terms[i - 1].amp * scale
        if (r < 0.8) continue
        ctx.globalAlpha = 0.35
        ctx.beginPath()
        ctx.arc(sx(joints[i - 1][0]), sy(joints[i - 1][1]), r, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.globalAlpha = 0.9
      ctx.strokeStyle = color('--text')
      ctx.lineWidth = 1.2
      ctx.beginPath()
      joints.forEach(([x, y], i) => (i ? ctx.lineTo(sx(x), sy(y)) : ctx.moveTo(sx(x), sy(y))))
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    ctx.strokeStyle = color('--cat')
    ctx.lineWidth = 2.5
    ctx.lineJoin = 'round'
    ctx.beginPath()
    trace.current.forEach(([x, y], i) => (i ? ctx.lineTo(sx(x), sy(y)) : ctx.moveTo(sx(x), sy(y))))
    ctx.stroke()

    const [px, py] = joints[joints.length - 1]
    ctx.fillStyle = color('--cat')
    ctx.beginPath()
    ctx.arc(sx(px), sy(py), 4.5, 0, Math.PI * 2)
    ctx.fill()
  }

  const drawSpectrum = ({ ctx, width, height, color }: Frame) => {
    const shown = Math.min(terms.length, 128)
    const bw = width / shown
    const max = Math.sqrt(terms[0]?.amp || 1)
    for (let i = 0; i < shown; i++) {
      const h = (Math.sqrt(terms[i].amp) / max) * (height - 4)
      ctx.fillStyle = i < k ? color('--cat') : color('--grid')
      ctx.fillRect(i * bw + 0.5, height - h, Math.max(1, bw - 1), h)
    }
  }

  const main = useCanvas(drawMain)
  const spectrum = useCanvas(drawSpectrum)

  useFrame((dt) => {
    t.current += dt / seconds
    if (t.current >= 1) {
      t.current -= 1
      trace.current = []
    }
    const joints = epicycles(terms, k, t.current)
    trace.current.push(joints[joints.length - 1])
    main.redraw()
  }, playing && !drawing)

  const local = (e: PointerEvent<HTMLCanvasElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect()
    return [e.clientX - rect.left, e.clientY - rect.top]
  }

  const finishStroke = () => {
    if (stroke.current.length > 8) {
      setCustom(stroke.current)
      setShapeName('custom')
      setDrawing(false)
      t.current = 0
      resetTrace()
    }
    stroke.current = []
    main.redraw()
  }

  return (
    <>
      <div className="card fd-toolbar">
        <div className="row">
          {shapes.map((s) => (
            <button
              key={s.name}
              className={`chip${s.name === shapeName && !drawing ? ' active' : ''}`}
              onClick={() => {
                setShapeName(s.name)
                setDrawing(false)
                t.current = 0
                resetTrace()
              }}
            >
              {s.name}
            </button>
          ))}
          {custom && (
            <button
              className={`chip${shapeName === 'custom' && !drawing ? ' active' : ''}`}
              onClick={() => {
                setShapeName('custom')
                setDrawing(false)
                resetTrace()
              }}
            >
              Your drawing
            </button>
          )}
          <span className="spacer" />
          <button className={drawing ? '' : 'primary'} onClick={() => {
            stroke.current = []
            setDrawing((d) => !d)
          }}>
            {drawing ? 'Cancel' : '✎ Draw your own'}
          </button>
          <button onClick={() => setPlaying((p) => !p)} disabled={drawing}>
            {playing ? '❚❚ Pause' : '▶ Play'}
          </button>
        </div>
      </div>

      <div className="fd-layout">
        <div className="card fd-stage">
          <canvas
            ref={main.ref}
            className={`canvas fd-canvas${drawing ? ' drawing' : ''}`}
            aria-label={drawing ? 'Drawing area' : 'Epicycles tracing the shape'}
            onPointerDown={(e) => {
              if (!drawing) return
              e.currentTarget.setPointerCapture(e.pointerId)
              stroke.current = [local(e)]
              main.redraw()
            }}
            onPointerMove={(e) => {
              if (!drawing || !stroke.current.length) return
              const p = local(e)
              const last = stroke.current[stroke.current.length - 1]
              if (Math.hypot(p[0] - last[0], p[1] - last[1]) > 2) {
                stroke.current.push(p)
                main.redraw()
              }
            }}
            onPointerUp={() => drawing && finishStroke()}
          />
        </div>

        <div className="card fd-side">
          <Slider
            label="Circles (arrows)"
            value={k}
            min={1}
            max={SAMPLES}
            onChange={(v) => {
              setCount(v)
              resetTrace()
            }}
          />
          <div className="presets">
            {QUICK_COUNTS.map((n) => (
              <button
                key={n}
                className={`chip${n === k ? ' active' : ''}`}
                onClick={() => {
                  setCount(n)
                  resetTrace()
                }}
              >
                {n}
              </button>
            ))}
          </div>
          <dl className="fd-stats">
            <div>
              <dt>Average error</dt>
              <dd>{(err * 100).toFixed(err < 0.01 ? 2 : 1)}% of the size</dd>
            </div>
            <div>
              <dt>Biggest arrow</dt>
              <dd>
                {terms[0]?.freq === 0 ? 'the centre (0 turns)' : `${terms[0]?.freq} turn${Math.abs(terms[0]?.freq) === 1 ? '' : 's'} per cycle`}
              </dd>
            </div>
          </dl>
          <div>
            <p className="muted small">Arrow lengths, biggest first (the ones in use are coloured)</p>
            <canvas ref={spectrum.ref} className="canvas fd-spectrum" aria-label="Arrow lengths" />
          </div>
          <Slider label="Cycle length" value={seconds} min={2} max={30} format={(v) => `${v} s`} onChange={setSeconds} />
          <Checkbox checked={showCircles} onChange={setShowCircles}>
            Show circles and arms
          </Checkbox>
          <Checkbox checked={showOriginal} onChange={setShowOriginal}>
            Show the original shape
          </Checkbox>
        </div>
      </div>

      <p className="hint">
        Each arrow spins at a whole number of turns per cycle, and they are joined tip to tail; the
        last tip draws. The discrete Fourier transform finds how long each arrow is and where it
        starts. A handful of big, slow arrows give the rough shape; sharp corners, like the star's
        points, need many small, fast ones.
      </p>
    </>
  )
}
