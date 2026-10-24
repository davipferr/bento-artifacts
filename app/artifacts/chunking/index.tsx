import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent } from 'react'
import { Checkbox, Segmented, Slider } from '../../kit/Controls'
import {
  accuracy,
  backspace,
  caretFor,
  chunkSizes,
  format,
  formatInput,
  generate,
  LENGTHS,
  normalize,
  plan,
  rawIndex,
  score,
  span,
  type Condition,
  type Kind,
  type Pattern,
  type Trial,
} from './chunk'
import './style.css'

const KINDS = [
  { value: 'digits', label: 'Digits' },
  { value: 'mixed', label: 'Letters + digits' },
] as const
const COLOR = { raw: 'var(--cat-games)', chunked: 'var(--cat-ui)' }

type Stage = 'idle' | 'show' | 'hold' | 'answer' | 'feedback'

interface Current extends Condition {
  truth: string
  answer: string
}

function Chart({ trials }: { trials: Trial[] }) {
  const W = 420
  const H = 220
  const pad = { l: 40, r: 14, t: 14, b: 32 }
  const x = (n: number) => pad.l + ((n - LENGTHS[0]) / (LENGTHS[LENGTHS.length - 1] - LENGTHS[0])) * (W - pad.l - pad.r)
  const y = (v: number) => H - pad.b - v * (H - pad.t - pad.b)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="ch-chart" role="img" aria-label="Exact recall by length, raw and chunked">
      {[0, 0.25, 0.5, 0.75, 1].map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className="ch-gridline" />
          <text x={pad.l - 6} y={y(v) + 4} textAnchor="end">
            {v * 100}%
          </text>
        </g>
      ))}
      {/* Miller's 7 ± 2 band. */}
      <rect className="ch-band" x={x(6)} y={pad.t} width={x(9) - x(6)} height={H - pad.t - pad.b} />
      <text x={(x(6) + x(9)) / 2} y={pad.t + 12} textAnchor="middle" className="ch-band-label">
        7 ± 2
      </text>
      {LENGTHS.map((n) => (
        <text key={n} x={x(n)} y={H - pad.b + 16} textAnchor="middle">
          {n} chars
        </text>
      ))}
      {([false, true] as const).map((chunked) => {
        const acc = accuracy(trials, chunked)
        const points = LENGTHS.filter((n) => acc[n] !== undefined).map((n) => [x(n), y(acc[n]!)] as const)
        const color = chunked ? COLOR.chunked : COLOR.raw
        return (
          <g key={String(chunked)} style={{ color }}>
            {points.length > 1 && <polyline className="ch-line" points={points.map((p) => p.join(',')).join(' ')} />}
            {points.map(([px, py], i) => (
              <circle key={i} cx={px} cy={py} r={4.5} className="ch-dot" />
            ))}
          </g>
        )
      })}
    </svg>
  )
}

const PATTERNS: Record<string, Pattern & { label: string; placeholder: string }> = {
  card: { label: 'Card number', sizes: [4], max: 16, kind: 'digits', placeholder: '4242 4242 4242 4242' },
  phone: { label: 'Phone', sizes: [3, 3, 4], max: 10, kind: 'digits', placeholder: '415 555 0132' },
  iban: { label: 'IBAN', sizes: [4], max: 22, kind: 'mixed', placeholder: 'GB82 WEST 1234 5698 7654 32' },
}

function GroupedInput() {
  const [which, setWhich] = useState<keyof typeof PATTERNS>('card')
  const [value, setValue] = useState('')
  const [chunk, setChunk] = useState(true)
  const input = useRef<HTMLInputElement>(null)
  const caret = useRef<number | null>(null)
  const pattern = PATTERNS[which]

  useLayoutEffect(() => {
    if (caret.current !== null && input.current) {
      input.current.setSelectionRange(caret.current, caret.current)
      caret.current = null
    }
  })

  const apply = (raw: string, index: number) => {
    const next = chunk ? formatInput(raw, pattern) : formatInput(raw, { ...pattern, sizes: [pattern.max] })
    caret.current = caretFor(next, index)
    setValue(next)
  }

  const onInput = (e: ChangeEvent<HTMLInputElement>) => {
    const el = e.currentTarget
    apply(el.value, rawIndex(el.value, el.selectionStart ?? el.value.length))
  }

  return (
    <div className="card ch-input-card">
      <strong>Chunking while you type</strong>
      <Segmented
        value={which}
        options={Object.entries(PATTERNS).map(([value, p]) => ({ value, label: p.label }))}
        onChange={(v) => {
          setWhich(v)
          setValue('')
        }}
      />
      <input
        ref={input}
        className="ch-grouped mono"
        value={value}
        placeholder={chunk ? pattern.placeholder : pattern.placeholder.replace(/ /g, '')}
        inputMode={pattern.kind === 'digits' ? 'numeric' : 'text'}
        aria-label={pattern.label}
        onChange={onInput}
        onKeyDown={(e) => {
          const el = e.currentTarget
          if (e.key !== 'Backspace' || el.selectionStart !== el.selectionEnd) return
          const result = backspace(el.value, el.selectionStart ?? 0)
          if (!result) return
          e.preventDefault()
          apply(result.raw, result.index)
        }}
      />
      <Checkbox
        checked={chunk}
        onChange={(v) => {
          setChunk(v)
          setValue((old) => (v ? formatInput(old, pattern) : old.replace(/ /g, '')))
        }}
      >
        Group as you type
      </Checkbox>
      <p className="small muted">
        Typing in the middle, pasting with spaces or dashes, and backspacing over a gap all keep the caret where you expect.
        Compare checking the value against the card in your hand with grouping on and off.
      </p>
    </div>
  )
}

export default function Chunking() {
  const [kind, setKind] = useState<Kind>('digits')
  const [seconds, setSeconds] = useState(3)
  const [hold, setHold] = useState(false)
  const [stage, setStage] = useState<Stage>('idle')
  const [queue, setQueue] = useState<Condition[]>([])
  const [current, setCurrent] = useState<Current | null>(null)
  const [trials, setTrials] = useState<Trial[]>([])
  const answerRef = useRef<HTMLInputElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)

  // Timed stages: show the string, optionally hold a blank, then ask.
  useEffect(() => {
    if (stage === 'show') {
      const id = window.setTimeout(() => setStage(hold ? 'hold' : 'answer'), seconds * 1000)
      return () => window.clearTimeout(id)
    }
    if (stage === 'hold') {
      const id = window.setTimeout(() => setStage('answer'), 3000)
      return () => window.clearTimeout(id)
    }
    if (stage === 'answer') answerRef.current?.focus()
    if (stage === 'feedback') nextRef.current?.focus()
  }, [stage, seconds, hold])

  const setUp = (conditions: Condition[]) => {
    setQueue(conditions)
    if (!conditions.length) {
      setStage('idle')
      setCurrent(null)
      return
    }
    const { n, chunked } = conditions[0]
    setCurrent({ n, chunked, truth: generate(kind, n, Math.random), answer: '' })
    setStage('show')
  }

  const submit = () => {
    if (!current) return
    const s = score(current.answer, current.truth)
    setTrials((t) => [...t, { ...current, kind, ...s }])
    setStage('feedback')
  }

  const sizes = current ? chunkSizes(current.n) : []
  const shown = current ? (current.chunked ? format(current.truth, sizes) : current.truth) : ''
  const last = trials[trials.length - 1]
  const progress = queue.length ? LENGTHS.length * 2 - queue.length + 1 : 0
  const rawSpan = span(trials, false)
  const chunkSpan = span(trials, true)

  return (
    <>
      <div className="card ch-controls">
        <div className="row">
          <Segmented value={kind} options={KINDS} onChange={(v) => stage === 'idle' && setKind(v)} />
          <Slider label="Time to look" value={seconds} min={1.5} max={6} step={0.5} format={(v) => `${v}s`} onChange={setSeconds} />
          <Checkbox checked={hold} onChange={setHold}>
            Hold it for 3s first
          </Checkbox>
          <span className="spacer" />
          {stage === 'idle' ? (
            <button className="primary" onClick={() => setUp(plan(Math.random))}>
              Start a round ({LENGTHS.length * 2} strings)
            </button>
          ) : (
            <button onClick={() => setUp([])}>Stop</button>
          )}
        </div>
        <p className="small muted">
          A string flashes up, sometimes as one run of characters, sometimes split into chunks. When it disappears, type it
          back. Same length, same time to look: only the grouping changes.
        </p>
      </div>

      <div className="ch-layout">
        <div className="card ch-arena">
          {stage === 'idle' && (
            <div className="ch-empty">
              <p>
                <strong>Miller (1956):</strong> we hold about 7 ± 2 <em>chunks</em> in short-term memory, and a chunk can be a
                digit, a word or a whole group.
              </p>
              <p className="muted small">That’s why phone numbers, card numbers and codes are printed in groups.</p>
            </div>
          )}
          {current && stage !== 'idle' && (
            <>
              <div className="row small muted">
                <span>
                  String {progress} of {LENGTHS.length * 2} · {current.n} characters ·{' '}
                  {current.chunked ? `${sizes.length} chunks` : 'no chunks'}
                </span>
              </div>
              <div className="ch-display">
                {stage === 'show' && (
                  <>
                    <span className="ch-string mono">{shown}</span>
                    <span className="ch-timer" style={{ animationDuration: `${seconds}s` }} />
                  </>
                )}
                {stage === 'hold' && <span className="ch-hold muted">Keep it in your head…</span>}
                {stage === 'answer' && (
                  <form
                    className="ch-answer"
                    onSubmit={(e) => {
                      e.preventDefault()
                      submit()
                    }}
                  >
                    <input
                      ref={answerRef}
                      className="mono"
                      value={current.answer}
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      inputMode={kind === 'digits' ? 'numeric' : 'text'}
                      aria-label="Type what you saw"
                      placeholder="Type what you saw"
                      onChange={(e) => setCurrent({ ...current, answer: e.target.value })}
                    />
                    <button className="primary" type="submit">
                      Check
                    </button>
                  </form>
                )}
                {stage === 'feedback' && last && (
                  <div className="ch-feedback">
                    <span className={`ch-verdict ${last.exact ? 'ok' : 'bad'}`}>
                      {last.exact ? '✓ Exactly right' : `✗ ${last.positions} of ${last.n} in the right place`}
                    </span>
                    <span className="ch-diff mono" aria-label={`It was ${last.truth}`}>
                      {[...last.truth].map((c, i) => (
                        <span key={i} className={normalize(last.answer)[i] === c ? 'ok' : 'bad'}>
                          {c}
                        </span>
                      ))}
                    </span>
                    <button ref={nextRef} className="primary" onClick={() => setUp(queue.slice(1))}>
                      {queue.length > 1 ? 'Next' : 'See results'}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="card ch-results">
          <Chart trials={trials} />
          <div className="legend">
            <span>
              <i className="swatch" style={{ background: COLOR.raw }} />
              Raw · span {rawSpan || '·'}
            </span>
            <span>
              <i className="swatch" style={{ background: COLOR.chunked }} />
              Chunked · span {chunkSpan || '·'}
            </span>
            <span>span = longest length you got right at least half the time</span>
          </div>
          {trials.length > 0 && (
            <ol className="ch-history">
              {[...trials].reverse().map((t, i) => (
                <li key={i} className={t.exact ? 'ok' : 'bad'}>
                  <span className="mono">{t.chunked ? format(t.truth, chunkSizes(t.n)) : t.truth}</span>
                  <span className="small muted">{t.exact ? '✓' : `${t.positions}/${t.n}`}</span>
                </li>
              ))}
            </ol>
          )}
          <div className="row">
            <span className="small muted">{trials.length} strings · run a few rounds for a smoother curve</span>
            <span className="spacer" />
            {trials.length > 0 && (
              <button className="chip" onClick={() => setTrials([])}>
                Clear results
              </button>
            )}
          </div>
        </div>
      </div>

      <GroupedInput />
    </>
  )
}
