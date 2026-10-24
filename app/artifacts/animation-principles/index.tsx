import { useRef, useState } from 'react'
import { useCanvas, useFrame } from '../../kit/canvas'
import { Checkbox, Slider } from '../../kit/Controls'
import { countOn, drawScene } from './draw'
import { allOff, allOn, locate, PRINCIPLES, type Options, type Principle } from './principles'
import './style.css'

export default function AnimationPrinciples() {
  const [on, setOn] = useState<Options>(allOn)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [trail, setTrail] = useState(false)
  const [compare, setCompare] = useState(true)
  const t = useRef(0)
  const [, setTick] = useState(0)

  const main = useCanvas((frame) => drawScene(frame, t.current, on, { trail, label: `${countOn(on)} of 12 principles` }))
  const plain = useCanvas((frame) => drawScene(frame, t.current, allOff(), { trail, label: 'All 12 off' }))

  useFrame((dt) => {
    t.current += dt * speed
    main.redraw()
    if (compare) plain.redraw()
    // The phase readout only needs a few updates a second.
    if (Math.floor(t.current * 8) !== Math.floor((t.current - dt * speed) * 8)) setTick((n) => n + 1)
  }, playing)

  const step = (frames: number) => {
    setPlaying(false)
    t.current = Math.max(0, t.current + frames / 24)
    main.redraw()
    plain.redraw()
    setTick((n) => n + 1)
  }

  const toggle = (key: Principle) => setOn((o) => ({ ...o, [key]: !o[key] }))
  const solo = (key: Principle) => setOn({ ...allOff(), [key]: true })
  const phase = locate(t.current, on).phase

  return (
    <>
      <div className="card ap-stage-card">
        <canvas ref={main.ref} className="canvas ap-canvas" aria-label="A hopping ball with the selected principles" />
        {compare && <canvas ref={plain.ref} className="canvas ap-canvas small" aria-label="The same hop with every principle off" />}
        <div className="row">
          <button className="primary" onClick={() => setPlaying((p) => !p)}>
            {playing ? '❚❚ Pause' : '▶ Play'}
          </button>
          <button onClick={() => step(-1)} aria-label="Back one frame">
            ‹ frame
          </button>
          <button onClick={() => step(1)} aria-label="Forward one frame">
            frame ›
          </button>
          <span className="ap-phase mono small">{phase}</span>
          <Slider label="Speed" value={speed} min={0.1} max={1.5} step={0.05} format={(v) => `${v.toFixed(2)}×`} onChange={setSpeed} />
          <span className="spacer" />
          <Checkbox checked={trail} onChange={setTrail}>
            Show path
          </Checkbox>
          <Checkbox checked={compare} onChange={setCompare}>
            Compare with all off
          </Checkbox>
        </div>
      </div>

      <div className="card">
        <div className="row">
          <h3 className="ap-title">The 12 principles</h3>
          <span className="spacer" />
          <button className="chip" onClick={() => setOn(allOn())}>
            All on
          </button>
          <button className="chip" onClick={() => setOn(allOff())}>
            All off
          </button>
        </div>
        <div className="ap-grid">
          {PRINCIPLES.map((p, i) => (
            <div
              key={p.key}
              className={`ap-principle${on[p.key] ? ' on' : ''}`}
            >
              <label className="ap-toggle">
                <input type="checkbox" checked={on[p.key]} onChange={() => toggle(p.key)} />
                <span className="ap-num">{i + 1}</span>
                <strong>{p.name}</strong>
              </label>
              <p className="small muted">{p.hint}</p>
              <button className="ap-solo" onClick={() => solo(p.key)} title={`Only ${p.name}`}>
                solo
              </button>
            </div>
          ))}
        </div>
        <p className="hint">
          Tip: turn everything on, then switch one off at a time. “Solo” keeps only that principle, which shows how little each
          one does alone and how much they do together.
        </p>
      </div>
    </>
  )
}
