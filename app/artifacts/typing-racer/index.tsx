import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '../../kit/canvas'
import { Segmented } from '../../kit/Controls'
import {
  accuracy,
  autoIndent,
  compare,
  ghostIndex,
  keyStats,
  loadBest,
  passages,
  saveBest,
  wpm,
  type Best,
  type Category,
  type KeyStat,
  type Stroke,
} from './typing'
import './style.css'

const ROWS = ['1234567890-=', 'qwertyuiop[]', "asdfghjkl;'", 'zxcvbnm,./']

interface Result {
  wpm: number
  accuracy: number
  seconds: number
  newBest: boolean
  previous: Best | null
  stats: Map<string, KeyStat>
}

function Heatmap({ stats }: { stats: Map<string, KeyStat> }) {
  const timed = [...stats.values()].filter((s) => s.count >= 2)
  const min = Math.min(...timed.map((s) => s.avg))
  const max = Math.max(...timed.map((s) => s.avg))
  const fill = (k: string) => {
    const s = stats.get(k)
    if (!s || s.count < 2) return 'var(--chip)'
    const t = max > min ? (s.avg - min) / (max - min) : 0
    return `hsl(${130 - 130 * t} 65% 48%)`
  }
  const KEY = 34
  const GAP = 4
  return (
    <svg className="heatmap" viewBox={`0 0 ${12 * (KEY + GAP) + 40} ${5 * (KEY + GAP)}`} role="img" aria-label="Keyboard coloured by how long each key took">
      {ROWS.map((row, r) =>
        [...row].map((k, i) => {
          const x = r * 14 + i * (KEY + GAP)
          const y = r * (KEY + GAP)
          const s = stats.get(k)
          return (
            <g key={k}>
              <rect x={x} y={y} width={KEY} height={KEY} rx={6} style={{ fill: fill(k) }}>
                <title>{s ? `${k}: ${Math.round(s.avg)} ms, ${s.errors} mistake${s.errors === 1 ? '' : 's'}` : `${k}: not typed`}</title>
              </rect>
              <text x={x + KEY / 2} y={y + KEY / 2 + 4} textAnchor="middle">
                {k}
              </text>
              {s && s.errors > 0 && <circle cx={x + KEY - 5} cy={y + 5} r={4} className="heat-error" />}
            </g>
          )
        }),
      )}
      <rect x={4 * 14 + 2 * (KEY + GAP)} y={4 * (KEY + GAP)} width={6 * (KEY + GAP) - GAP} height={KEY} rx={6} style={{ fill: fill('space') }}>
        <title>{stats.get('space') ? `space: ${Math.round(stats.get('space')!.avg)} ms` : 'space'}</title>
      </rect>
    </svg>
  )
}

export default function TypingRacer() {
  const [category, setCategory] = useState<Category>('prose')
  const [passageId, setPassageId] = useState(passages[0].id)
  const [typed, setTyped] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  const [focused, setFocused] = useState(false)

  const input = useRef<HTMLTextAreaElement>(null)
  const startedAt = useRef<number | null>(null)
  const strokes = useRef<Stroke[]>([])
  const times = useRef<number[]>([])

  const passage = passages.find((p) => p.id === passageId)!
  const text = passage.body
  const best = useMemo(() => loadBest(passageId), [passageId, result])
  const states = compare(text, typed)
  const correct = states.filter((s) => s === 'correct').length
  const running = startedAt.current !== null && !result
  const ghost = best && running ? ghostIndex(best.times, elapsed) : best && !result ? 0 : -1

  useFrame(() => {
    if (startedAt.current !== null) setElapsed(performance.now() - startedAt.current)
  }, running)

  const restart = (id = passageId) => {
    setPassageId(id)
    setTyped('')
    setElapsed(0)
    setResult(null)
    startedAt.current = null
    strokes.current = []
    times.current = []
    requestAnimationFrame(() => input.current?.focus())
  }

  useEffect(() => {
    input.current?.focus()
  }, [])

  const next = (cat = category) => {
    const pool = passages.filter((p) => p.category === cat && p.id !== passageId)
    const candidates = pool.length ? pool : passages.filter((p) => p.category === cat)
    restart(candidates[Math.floor(Math.random() * candidates.length)].id)
  }

  const finish = (finalTyped: string, t: number) => {
    const right = compare(text, finalTyped).filter((s) => s === 'correct').length
    const speed = wpm(right, t)
    const acc = accuracy(strokes.current)
    const previous = loadBest(passageId)
    const newBest = !previous || speed > previous.wpm
    if (newBest) saveBest(passageId, { wpm: speed, accuracy: acc, times: times.current.slice(0, text.length) })
    setResult({ wpm: speed, accuracy: acc, seconds: t / 1000, newBest, previous, stats: keyStats(strokes.current) })
  }

  const onChange = (raw: string) => {
    if (result) return
    let value = raw.slice(0, text.length)
    const now = performance.now()
    if (startedAt.current === null && value.length > 0) startedAt.current = now
    const t = startedAt.current === null ? 0 : now - startedAt.current
    if (value.length > typed.length) {
      for (let i = typed.length; i < value.length; i++) strokes.current.push({ index: i, expected: text[i], typed: value[i], t })
      // Enter in code jumps over the next line's indentation.
      if (value.endsWith('\n') && text[value.length - 1] === '\n') value += autoIndent(text, value.length)
      for (let i = typed.length; i < value.length; i++) times.current[i] = t
    }
    setTyped(value)
    if (value.length === text.length) finish(value, t)
  }

  const liveWpm = wpm(correct, elapsed)
  const liveAccuracy = accuracy(strokes.current)
  const slowest = result ? [...result.stats.values()].filter((s) => s.count >= 2).sort((a, b) => b.avg - a.avg).slice(0, 5) : []

  return (
    <>
      <div className="card tr-toolbar">
        <div className="row">
          <Segmented
            value={category}
            options={[
              { value: 'prose', label: 'Prose' },
              { value: 'code', label: 'Code' },
              { value: 'pt-BR', label: 'Português' },
            ]}
            onChange={(c) => {
              setCategory(c)
              next(c)
            }}
          />
          <span className="spacer" />
          <button onClick={() => restart()}>↺ Restart (Esc)</button>
          <button onClick={() => next()}>Next text →</button>
        </div>
        <div className="tr-stats">
          <span>
            <strong>{(elapsed / 1000).toFixed(1)}</strong> s
          </span>
          <span>
            <strong>{Math.round(liveWpm)}</strong> WPM
          </span>
          <span>
            <strong>{Math.round(liveAccuracy * 100)}%</strong> accuracy
          </span>
          <span className="muted">
            {best ? (
              <>
                <i className="ghost-dot" /> ghost of your best: <strong>{Math.round(best.wpm)}</strong> WPM
              </>
            ) : (
              'No best yet for this text: finish once to race your ghost.'
            )}
          </span>
        </div>
      </div>

      <div
        className={`card tr-board${focused ? ' focused' : ''}${passage.category === 'code' ? ' code' : ''}`}
        onClick={() => input.current?.focus()}
      >
        <textarea
          ref={input}
          className="tr-input"
          value={typed}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              restart()
            }
            if (e.key === 'Tab') e.preventDefault()
          }}
          onPaste={(e) => e.preventDefault()}
          onDrop={(e) => e.preventDefault()}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          aria-label="Type the text shown"
        />
        <p className="tr-text" aria-hidden>
          {[...text].map((ch, i) => {
            const classes = [states[i], i === typed.length && !result ? 'cursor' : '', i === ghost ? 'ghost' : ''].filter(Boolean).join(' ')
            if (ch === '\n') {
              return (
                <span key={i}>
                  <span className={`${classes} nl`}>↵</span>
                  <br />
                </span>
              )
            }
            return (
              <span key={i} className={classes}>
                {ch === ' ' && states[i] === 'wrong' ? '·' : ch}
              </span>
            )
          })}
        </p>
        {!focused && !result && <span className="tr-hint">Click here and start typing</span>}
      </div>

      {result && (
        <div className="card tr-result">
          <div className="tr-result-head">
            <div>
              <span className="tr-big">{Math.round(result.wpm)}</span> WPM
              {result.newBest && <span className="tr-badge">{result.previous ? 'New best!' : 'First run saved'}</span>}
            </div>
            <div className="muted">
              {Math.round(result.accuracy * 100)}% accuracy · {result.seconds.toFixed(1)} s
              {result.previous && !result.newBest && ` · best ${Math.round(result.previous.wpm)} WPM`}
              {result.previous && result.newBest && ` · was ${Math.round(result.previous.wpm)} WPM`}
            </div>
            <div className="row">
              <button className="primary" onClick={() => restart()}>
                Race the ghost again
              </button>
              <button onClick={() => next()}>Next text →</button>
            </div>
          </div>
          <div className="tr-result-body">
            <div>
              <h3>Your keyboard</h3>
              <p className="small muted">Green keys came quickly, red ones made you hesitate. A dot marks a key you missed.</p>
              <Heatmap stats={result.stats} />
            </div>
            <div>
              <h3>Slowest keys</h3>
              <ol className="tr-slow">
                {slowest.map((s) => (
                  <li key={s.key}>
                    <code>{s.key}</code> {Math.round(s.avg)} ms{s.errors ? ` · ${s.errors} miss${s.errors > 1 ? 'es' : ''}` : ''}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      )}

      <p className="hint">
        Words per minute counts 5 correct characters as a word. Backspace is allowed; accuracy counts
        how many keystrokes were right the first time. Your best run for each text is kept in this
        browser, and its ghost (the outlined letter) races you next time.
      </p>
    </>
  )
}
