import { useRef, useState } from 'react'
import { useFrame } from '../../kit/canvas'
import { averages, band, blindPlan, DELAYS, TRICKS, viewAt, type Rating, type Trial, type Trick } from './latency'
import './style.css'

const PEOPLE = ['Ana Ribeiro', 'Ravi Patel', 'Joana Costa', 'Kai Tanaka', 'Lena Novak', 'Omar Haddad']

/** One "Load profile" widget with a given delay and trick. Reports when its result is final. */
function Loader({ delay, trick, compact = false, onSettled }: { delay: number; trick: Trick; compact?: boolean; onSettled?: () => void }) {
  const [clickedAt, setClickedAt] = useState<number | null>(null)
  const [person, setPerson] = useState(0)
  const [, setTick] = useState(0)
  const settled = useRef(false)
  const t = clickedAt === null ? -1 : performance.now() - clickedAt
  const active = clickedAt !== null && t < delay + 200

  useFrame(() => {
    setTick((n) => n + 1)
    if (clickedAt !== null && performance.now() - clickedAt >= delay && !settled.current) {
      settled.current = true
      onSettled?.()
    }
  }, active)

  const view = clickedAt === null ? null : viewAt(trick, delay, t)
  const click = () => {
    settled.current = false
    setPerson((p) => (p + 1) % PEOPLE.length)
    setClickedAt(performance.now())
  }

  return (
    <div className={`lt-loader${compact ? ' compact' : ''}`}>
      <button className={`lt-button${view?.pressed ? ' pressed' : ''}`} onClick={click} aria-busy={!!view && !view.shown}>
        {view?.spinner && <span className="lt-spinner" aria-hidden />}
        {view?.spinner ? 'Loading' : 'Load profile'}
      </button>
      <div className="lt-result" aria-live="polite">
        {view?.shown ? (
          <div className="lt-profile">
            <span className="lt-avatar" style={{ background: `hsl(${person * 60} 65% 55%)` }}>
              {PEOPLE[person][0]}
            </span>
            <span className="lt-name">{PEOPLE[person]}</span>
            {view.unconfirmed && (
              <span className="lt-sync" title="Not confirmed by the server yet">
                ↻
              </span>
            )}
          </div>
        ) : view?.skeleton ? (
          <div className="lt-profile skeleton" aria-label="Loading">
            <span className="lt-avatar" />
            <span className="lt-bone" />
          </div>
        ) : (
          <span className="lt-empty">{clickedAt === null ? '—' : ''}</span>
        )}
      </div>
    </div>
  )
}

/** Log-scale strip from 10 ms to 10 s with Nielsen's limits and the delays used here. */
function Limits() {
  const x = (ms: number) => ((Math.log10(Math.max(10, ms)) - 1) / 3) * 100
  return (
    <div className="lt-limits" aria-hidden>
      <div className="lt-band instant" style={{ left: 0, width: `${x(100)}%` }}>
        instant
      </div>
      <div className="lt-band flow" style={{ left: `${x(100)}%`, width: `${x(1000) - x(100)}%` }}>
        flow kept
      </div>
      <div className="lt-band lost" style={{ left: `${x(1000)}%`, width: `${100 - x(1000)}%` }}>
        attention drifting
      </div>
      {DELAYS.map((d) => (
        <span key={d} className="lt-tick" style={{ left: `${x(d)}%` }}>
          {d} ms
        </span>
      ))}
    </div>
  )
}

const RATINGS: { value: Rating; label: string }[] = [
  { value: 2, label: '⚡ Instant' },
  { value: 1, label: '👌 Fine' },
  { value: 0, label: '🐢 Slow' },
]
const trickName = (id: Trick) => TRICKS.find((t) => t.id === id)!.name

function BlindTest() {
  const [trials, setTrials] = useState<Trial[]>([])
  const [index, setIndex] = useState(0)
  const [ready, setReady] = useState(false)
  const [revealed, setRevealed] = useState(false)

  const start = () => {
    setTrials(blindPlan(Math.random))
    setIndex(0)
    setReady(false)
    setRevealed(false)
  }
  const rate = (rating: Rating) => {
    setTrials((list) => list.map((t, i) => (i === index ? { ...t, rating } : t)))
    setRevealed(true)
  }
  const next = () => {
    setIndex((i) => i + 1)
    setReady(false)
    setRevealed(false)
  }

  if (!trials.length)
    return (
      <div className="lt-blind-start">
        <p>
          12 rounds. Each time, press <strong>Load profile</strong> and say how fast it felt. You won’t know the delay or the trick
          until after you answer.
        </p>
        <button className="primary" onClick={start}>
          Start the blind test
        </button>
      </div>
    )

  if (index >= trials.length) {
    const { byDelay, byTrick } = averages(trials)
    const bar = (v: number | null) => (v === null ? 0 : (v / 2) * 100)
    return (
      <div className="lt-blind-results">
        <h3>How fast it felt (0 = slow, 2 = instant)</h3>
        <div className="lt-bars">
          {DELAYS.map((d) => (
            <div key={d} className="lt-bar-row">
              <span>{d} ms</span>
              <div className="lt-bar">
                <i style={{ width: `${bar(byDelay[d])}%` }} />
              </div>
              <b>{byDelay[d]?.toFixed(1) ?? '·'}</b>
            </div>
          ))}
        </div>
        <div className="lt-bars">
          {TRICKS.map((t) => (
            <div key={t.id} className="lt-bar-row">
              <span>{t.name}</span>
              <div className="lt-bar trick">
                <i style={{ width: `${bar(byTrick[t.id])}%` }} />
              </div>
              <b>{byTrick[t.id]?.toFixed(1) ?? '·'}</b>
            </div>
          ))}
        </div>
        <p className="small muted">
          Usually 1000 ms feels slow with nothing, but much better with an instant press or a skeleton, and optimistic updates
          feel instant at any delay. Do your numbers agree?
        </p>
        <button onClick={start}>Run it again</button>
      </div>
    )
  }

  const trial = trials[index]
  return (
    <div className="lt-blind">
      <span className="muted small">
        Round {index + 1} of {trials.length}
      </span>
      <Loader key={index} delay={trial.delay} trick={trial.trick} onSettled={() => setReady(true)} />
      {ready && !revealed && (
        <div className="row lt-rate">
          <span className="small">How did that feel?</span>
          {RATINGS.map((r) => (
            <button key={r.value} className="chip" onClick={() => rate(r.value)}>
              {r.label}
            </button>
          ))}
        </div>
      )}
      {revealed && (
        <div className="row lt-reveal">
          <span className="small">
            That was <strong>{trial.delay} ms</strong> with <strong>{trickName(trial.trick)}</strong> ({band(trial.delay)}).
          </span>
          <span className="spacer" />
          <button className="primary" onClick={next}>
            Next
          </button>
        </div>
      )}
    </div>
  )
}

export default function LatencyLab() {
  return (
    <>
      <div className="card">
        <Limits />
        <p className="small muted lt-note">
          Below about 100 ms a response feels instant; up to about a second you notice the wait but keep your train of thought.
          Click the buttons in each row: the delay is the same across the row, only the feedback changes.
        </p>
      </div>

      <div className="card lt-grid-card">
        <div className="lt-grid" role="table" aria-label="Delays by feedback trick">
          <div className="lt-corner" role="columnheader" />
          {TRICKS.map((t) => (
            <div key={t.id} className="lt-head" role="columnheader" title={t.hint}>
              <strong>{t.name}</strong>
              <span className="muted">{t.hint}</span>
            </div>
          ))}
          {DELAYS.map((d) => (
            <div key={d} className="lt-row" role="row">
              <div className="lt-delay" role="rowheader">
                <strong>{d} ms</strong>
                <span className="muted">{band(d)}</span>
              </div>
              {TRICKS.map((t) => (
                <div key={t.id} role="cell" className="lt-cell">
                  <Loader delay={d} trick={t.id} compact />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 className="lt-title">Blind test</h3>
        <BlindTest />
      </div>
    </>
  )
}
