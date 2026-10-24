import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { useFrame } from '../../kit/canvas'
import { Checkbox, Segmented, Slider } from '../../kit/Controls'
import { follow, glare, layerShift, orientationToNorm, pointerToNorm, tiltFor, toCss, type Norm } from './parallax'
import './style.css'

type Mode = '3d' | '2d' | 'flat'
const MODES = [
  { value: '3d', label: '3D: tilt + translateZ' },
  { value: '2d', label: '2D: shift layers only' },
  { value: 'flat', label: 'Tilt, no depth' },
] as const

const LAYERS = [
  { name: 'Sky', depth: 0 },
  { name: 'Sun', depth: 20 },
  { name: 'Far hills', depth: 40 },
  { name: 'Near hills', depth: 65 },
  { name: 'Title', depth: 95 },
  { name: 'Badge', depth: 120 },
] as const

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

type OrientationCtor = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> }

function Layer({ index }: { index: number }) {
  switch (index) {
    case 0:
      return <div className="pd-sky" />
    case 1:
      return (
        <svg viewBox="0 0 300 400" className="pd-svg">
          <circle cx="205" cy="120" r="34" className="pd-sun" />
        </svg>
      )
    case 2:
      return (
        <svg viewBox="0 0 300 400" className="pd-svg">
          <path d="M-20 300 L40 220 L90 265 L150 190 L215 260 L260 215 L320 280 L320 420 L-20 420 Z" className="pd-far" />
        </svg>
      )
    case 3:
      return (
        <svg viewBox="0 0 300 400" className="pd-svg">
          <path d="M-20 340 C40 290 90 300 140 320 C190 340 240 290 320 305 L320 420 L-20 420 Z" className="pd-near" />
        </svg>
      )
    case 4:
      return (
        <div className="pd-title">
          <span className="small">Field notes</span>
          <strong>Ridge at dusk</strong>
        </div>
      )
    default:
      return <span className="pd-badge">★ 4.9</span>
  }
}

export default function ParallaxCard() {
  const [mode, setMode] = useState<Mode>('3d')
  const [max, setMax] = useState(14)
  const [spread, setSpread] = useState(1)
  const [perspective, setPerspective] = useState(900)
  const [smoothing, setSmoothing] = useState(0.6)
  const [showGlare, setShowGlare] = useState(true)
  const [invert, setInvert] = useState(false)
  const [exploded, setExploded] = useState(false)
  const [gyro, setGyro] = useState<'off' | 'on' | 'denied' | 'missing'>('off')

  const stage = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const layers = useRef<(HTMLDivElement | null)[]>([])
  const glareEl = useRef<HTMLDivElement>(null)
  const readout = useRef<HTMLElement>(null)
  const target = useRef<Norm>({ nx: 0, ny: 0 })
  const now = useRef({ nx: 0, ny: 0, explode: 0 })

  useFrame((dt) => {
    const smooth = reducedMotion() ? 0 : smoothing
    const n = now.current
    n.nx = follow(n.nx, target.current.nx, dt, smooth)
    n.ny = follow(n.ny, target.current.ny, dt, smooth)
    n.explode = follow(n.explode, exploded ? 1 : 0, dt, reducedMotion() ? 0 : 0.7)
    const e = n.explode
    const norm = { nx: n.nx, ny: n.ny }
    const tilt = mode === '2d' ? { rx: 0, ry: 0 } : tiltFor(norm, max, invert)
    const rx = tilt.rx + e * 16
    const ry = tilt.ry - e * 52
    if (card.current) {
      card.current.style.transform = `scale(${1 - e * 0.3}) rotateX(${rx}deg) rotateY(${ry}deg)`
      card.current.style.boxShadow = `${(-tilt.ry * 0.9).toFixed(1)}px ${(tilt.rx * 0.9 + 24).toFixed(1)}px 48px -16px rgb(0 0 0 / 0.45)`
    }
    layers.current.forEach((el, i) => {
      if (!el) return
      const depth = LAYERS[i].depth
      if (mode === '2d' && e < 0.01) {
        const s = layerShift(norm, depth, spread)
        el.style.transform = `translate(${s.x}px, ${s.y}px)`
      } else {
        const z = (mode === 'flat' ? 0 : depth * spread) * (1 - e) + depth * 1.3 * e
        el.style.transform = `translateZ(${z}px)`
      }
    })
    if (glareEl.current) {
      const g = glare(invert ? { nx: -n.nx, ny: -n.ny } : norm)
      glareEl.current.style.background = `radial-gradient(circle at ${g.x}% ${g.y}%, rgb(255 255 255 / ${showGlare && mode !== '2d' ? g.opacity : 0}), transparent 60%)`
    }
    if (readout.current) {
      const css = mode === '2d' ? 'transform: none  /* layers slide instead */' : `transform: ${toCss(tilt.rx, tilt.ry, perspective)}`
      if (readout.current.textContent !== css) readout.current.textContent = css
    }
  })

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (gyro === 'on' || !card.current) return
    const r = card.current.getBoundingClientRect()
    // Measure against the card's untilted footprint so the edges don't feed back into the tilt.
    const w = card.current.offsetWidth
    const h = card.current.offsetHeight
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    target.current = pointerToNorm(e.clientX - (cx - w / 2), e.clientY - (cy - h / 2), w, h)
  }

  const onLeave = () => {
    if (gyro !== 'on') target.current = { nx: 0, ny: 0 }
  }

  useEffect(() => {
    if (gyro !== 'on') return
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.beta === null || e.gamma === null) return
      target.current = orientationToNorm(e.beta, e.gamma)
    }
    window.addEventListener('deviceorientation', onTilt)
    return () => window.removeEventListener('deviceorientation', onTilt)
  }, [gyro])

  const toggleGyro = async () => {
    if (gyro === 'on') {
      setGyro('off')
      target.current = { nx: 0, ny: 0 }
      return
    }
    const Ctor = (window as { DeviceOrientationEvent?: OrientationCtor }).DeviceOrientationEvent
    if (!Ctor) return setGyro('missing')
    if (Ctor.requestPermission) {
      try {
        if ((await Ctor.requestPermission()) !== 'granted') return setGyro('denied')
      } catch {
        return setGyro('denied')
      }
    }
    setGyro('on')
  }

  return (
    <>
      <div className="card pd-controls">
        <Segmented value={mode} options={MODES} onChange={setMode} />
        <div className="pd-sliders">
          <Slider label="Max tilt" value={max} min={0} max={30} format={(v) => `${v}°`} onChange={setMax} />
          <Slider label="Depth spread" value={spread} min={0} max={2} step={0.05} format={(v) => `${v.toFixed(2)}×`} onChange={setSpread} />
          <Slider label="Perspective" value={perspective} min={300} max={2400} step={50} format={(v) => `${v}px`} onChange={setPerspective} />
          <Slider label="Smoothing" value={smoothing} min={0} max={1} step={0.05} format={(v) => (v === 0 ? 'none' : v.toFixed(2))} onChange={setSmoothing} />
        </div>
        <div className="row">
          <Checkbox checked={showGlare} onChange={setShowGlare}>
            Glare
          </Checkbox>
          <Checkbox checked={invert} onChange={setInvert}>
            Lean towards the pointer
          </Checkbox>
          <Checkbox checked={exploded} onChange={setExploded}>
            Exploded view
          </Checkbox>
          <span className="spacer" />
          <button onClick={() => void toggleGyro()}>{gyro === 'on' ? 'Stop using motion' : 'Use device motion'}</button>
          {gyro === 'denied' && <span className="small muted">Motion permission was denied.</span>}
          {gyro === 'missing' && <span className="small muted">No motion sensor here.</span>}
        </div>
      </div>

      <div className="pd-layout">
        <div
          ref={stage}
          className="card pd-stage"
          style={{ perspective: `${perspective}px` }}
          onPointerMove={onMove}
          onPointerLeave={onLeave}
        >
          <div ref={card} className={`pd-card${mode === '2d' && !exploded ? ' clip' : ''}${exploded ? ' exploded' : ''}`}>
            {LAYERS.map((layer, i) => (
              <div
                key={layer.name}
                ref={(el) => {
                  layers.current[i] = el
                }}
                className={`pd-layer layer-${i}`}
              >
                <Layer index={i} />
                <span className="pd-tag">
                  {layer.name} · z {Math.round(layer.depth * spread)}px
                </span>
              </div>
            ))}
            <div ref={glareEl} className="pd-glare" />
          </div>
        </div>

        <div className="card pd-notes">
          <strong>What’s going on</strong>
          <code ref={readout} className="pd-readout" />
          <ul className="small">
            <li>
              The stage has <code>perspective</code>; the card has <code>transform-style: preserve-3d</code>, so each layer’s{' '}
              <code>translateZ</code> pushes it towards you and the tilt makes near layers move more than far ones.
            </li>
            <li>
              <strong>2D</strong> fakes the same thing with no 3D at all: each layer slides against the pointer in proportion to
              its depth. It’s cheaper and can clip to the card, but it never looks like the card turns.
            </li>
            <li>
              <strong>Smoothing</strong> uses <code>exp(−rate·dt)</code>, so it feels the same at any frame rate. With no smoothing
              the card jitters with every pointer event.
            </li>
            <li>
              <code>overflow: hidden</code> flattens 3D, which is why the 3D card can’t clip its layers and the near hills poke out.
            </li>
            <li>With “reduce motion” turned on in your system, smoothing is skipped and the card follows the pointer directly.</li>
          </ul>
        </div>
      </div>
    </>
  )
}
