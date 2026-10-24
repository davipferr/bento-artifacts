import { useRef, useState, type CSSProperties } from 'react'
import { useFrame } from '../../kit/canvas'
import { Checkbox, Slider } from '../../kit/Controls'
import { arrivals, finishedAt, layoutShift, look, STRATEGIES, type Strategy } from './reveal'
import './style.css'

const POSTS = [
  { name: 'Ana Ribeiro', hue: 200, text: ['Shipped the new onboarding flow today.', 'Conversion is up 12% in the first hour.'], image: true },
  { name: 'Ravi Patel', hue: 30, text: ['Lunch at the Lisbon office 🍝'], image: false },
  { name: 'Joana Costa', hue: 140, text: ['Field trip! The team at the botanical garden.', 'Turns out cacti are great listeners.', 'Who knew.'], image: true },
  { name: 'Kai Tanaka', hue: 290, text: ['Reminder: design critique moved to Thursday.'], image: false },
]

const LINE = 18
const HEAD = 52
const IMAGE = 120
const contentHeight = (p: (typeof POSTS)[number]) => HEAD + p.text.length * LINE + (p.image ? IMAGE + 10 : 0) + 16
const CONTENT_H = POSTS.map(contentHeight)
const GENERIC_SKELETON = 76

function Post({ post, strategy, t, arrive, index, matched, shimmer }: { post: (typeof POSTS)[number]; strategy: Strategy; t: number; arrive: number[]; index: number; matched: boolean; shimmer: boolean }) {
  const l = look(strategy, index, arrive, t, post.image)
  const skeletonH = matched ? CONTENT_H[index] : GENERIC_SKELETON
  // The box takes its real size as soon as content starts showing: that's the moment layout can jump.
  const height = l.sized ? CONTENT_H[index] : skeletonH
  return (
    <div className="sk-item" style={{ height }}>
      {l.content > 0 && (
        <div className="sk-content" style={{ opacity: l.content, transform: `translateY(${l.offsetY}px)` }}>
          <div className="sk-head">
            <span className="sk-avatar" style={{ background: `hsl(${post.hue} 70% 55%)` }}>
              {post.name[0]}
            </span>
            <div>
              <strong>{post.name}</strong>
              <span className="muted small">{index + 2}m ago</span>
            </div>
          </div>
          {post.text.map((line) => (
            <p key={line}>{line}</p>
          ))}
          {post.image && (
            <div
              className="sk-image"
              style={
                {
                  '--hue': post.hue,
                  filter: l.blur ? `blur(${l.blur}px)` : undefined,
                } as CSSProperties
              }
            >
              {!l.placeholder && <div className="sk-image-art" />}
            </div>
          )}
        </div>
      )}
      {l.skeleton > 0 && (
        <div className={`sk-skeleton${shimmer ? ' shimmer' : ''}`} style={{ opacity: l.skeleton }} aria-hidden>
          <div className="sk-head">
            <span className="sk-bone circle" />
            <div className="sk-bones">
              <span className="sk-bone" style={{ width: '45%' }} />
              <span className="sk-bone" style={{ width: '25%' }} />
            </div>
          </div>
          {(matched ? post.text : [1]).map((_, i, all) => (
            <span key={i} className="sk-bone" style={{ width: i === all.length - 1 ? '62%' : '92%' }} />
          ))}
          {matched && post.image && <span className="sk-bone image" />}
        </div>
      )}
    </div>
  )
}

export default function SkeletonContent() {
  const [latency, setLatency] = useState(1400)
  const [oneByOne, setOneByOne] = useState(true)
  const [matched, setMatched] = useState(true)
  const [shimmer, setShimmer] = useState(true)
  const [slow, setSlow] = useState(1)
  const [arrive, setArrive] = useState(() => arrivals(POSTS.length, 1400, true, Math.random))
  const t = useRef(0)
  const [running, setRunning] = useState(true)
  const [, setTick] = useState(0)

  const end = Math.max(...STRATEGIES.map((s) => finishedAt(s.id, arrive))) + 400

  useFrame((dt) => {
    t.current += dt * 1000 * slow
    setTick((n) => n + 1)
    if (t.current > end) setRunning(false)
  }, running)

  const reload = (opts: { latency?: number; oneByOne?: boolean } = {}) => {
    setArrive(arrivals(POSTS.length, opts.latency ?? latency, opts.oneByOne ?? oneByOne, Math.random))
    t.current = 0
    setRunning(true)
  }

  const now = t.current
  return (
    <>
      <div className="card sk-controls">
        <div className="row">
          <button className="primary" onClick={() => reload()}>
            ↻ Reload all four
          </button>
          <span className="mono small sk-clock">{(Math.min(now, end) / 1000).toFixed(2)} s</span>
          <span className="spacer" />
          <Checkbox
            checked={oneByOne}
            onChange={(v) => {
              setOneByOne(v)
              reload({ oneByOne: v })
            }}
          >
            Items arrive one by one
          </Checkbox>
          <Checkbox checked={matched} onChange={setMatched}>
            Skeleton matches the final layout
          </Checkbox>
          <Checkbox checked={shimmer} onChange={setShimmer}>
            Shimmer
          </Checkbox>
        </div>
        <div className="row">
          <Slider label="Network latency" value={latency} min={200} max={3000} step={100} format={(v) => `${v} ms`} onChange={(v) => {
              setLatency(v)
              reload({ latency: v })
            }}
          />
          <Slider label="Slow motion" value={slow} min={0.1} max={1} step={0.05} format={(v) => `${v.toFixed(2)}×`} onChange={setSlow} />
        </div>
        <div className="sk-timeline" aria-hidden>
          {arrive.map((a, i) => (
            <span key={i} className="sk-arrival" style={{ left: `${(a / end) * 100}%` }} title={`Item ${i + 1} arrives at ${a} ms`}>
              {i + 1}
            </span>
          ))}
          <span className="sk-playhead" style={{ left: `${(Math.min(now, end) / end) * 100}%` }} />
        </div>
      </div>

      <div className="sk-grid">
        {STRATEGIES.map((s) => {
          const sized = POSTS.map((_, i) => look(s.id, i, arrive, now).sized)
          const shift = layoutShift(
            POSTS.map((_, i) => (matched ? CONTENT_H[i] : GENERIC_SKELETON)),
            CONTENT_H,
            sized,
          )
          return (
            <section key={s.id} className="card sk-panel">
              <header>
                <h3>{s.name}</h3>
                <span className={`sk-shift${shift ? ' bad' : ''}`} title="Total pixels of content pushed down so far">
                  {shift ? `${shift}px layout shift` : 'no layout shift'}
                </span>
              </header>
              <p className="small muted">{s.hint}</p>
              <div className="sk-feed">
                {POSTS.map((post, i) => (
                  <Post key={post.name} post={post} strategy={s.id} t={now} arrive={arrive} index={i} matched={matched} shimmer={shimmer} />
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </>
  )
}
