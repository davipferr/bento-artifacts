import { useEffect, useRef, useState, type ChangeEvent, type ClipboardEvent, type CSSProperties, type KeyboardEvent } from 'react'
import { Checkbox, Segmented } from '../../kit/Controls'
import { backspace, clean, empty, focusFor, grouped, insert, isComplete, makeCode, move, remove, value, type Mode, type State } from './otp'
import './style.css'

const LENGTHS = [
  { value: '4', label: '4' },
  { value: '6', label: '6' },
  { value: '8', label: '8' },
] as const
const MODES = [
  { value: 'numeric', label: '0–9' },
  { value: 'alphanumeric', label: 'A–Z 0–9' },
] as const
const ATTEMPTS = 3
const RESEND_SECONDS = 20

type Status = 'idle' | 'checking' | 'error' | 'success' | 'locked'

export default function OtpInput() {
  const [length, setLength] = useState<'4' | '6' | '8'>('6')
  const [mode, setMode] = useState<Mode>('numeric')
  const [masked, setMasked] = useState(false)
  const [autoSubmit, setAutoSubmit] = useState(true)
  const n = Number(length)

  const [code, setCode] = useState(() => makeCode(6, 'numeric'))
  const [state, setState] = useState<State>(() => empty(6))
  const [status, setStatus] = useState<Status>('idle')
  const [attempts, setAttempts] = useState(ATTEMPTS)
  const [shake, setShake] = useState(0)
  const [cooldown, setCooldown] = useState(RESEND_SECONDS)
  const [copied, setCopied] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const boxes = useRef<HTMLDivElement>(null)
  /** Only move DOM focus after the user did something, never on first render. */
  const steer = useRef(false)

  const note = (text: string) => setLog((l) => [text, ...l].slice(0, 7))

  const newCode = (len = n, m = mode, reason = 'New code sent') => {
    setCode(makeCode(len, m))
    setState(empty(len))
    setStatus('idle')
    setAttempts(ATTEMPTS)
    setCooldown(RESEND_SECONDS)
    setCopied(false)
    note(reason)
  }

  // Resend cooldown.
  useEffect(() => {
    if (cooldown <= 0) return
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(id)
  }, [cooldown])

  // Replay the shake without remounting the inputs (which would drop focus).
  useEffect(() => {
    const el = boxes.current
    if (!shake || !el) return
    el.classList.remove('shake')
    void el.offsetWidth
    el.classList.add('shake')
  }, [shake])

  // Follow the logical focus with the real one.
  useEffect(() => {
    if (!steer.current) return
    const el = refs.current[state.focus]
    if (el && document.activeElement !== el) el.focus()
    el?.select()
  }, [state])

  const verify = (attempt: State) => {
    const entered = value(attempt)
    setStatus('checking')
    setTimeout(() => {
      if (entered === code) {
        setStatus('success')
        note(`Verified ${entered} ✓`)
        refs.current.forEach((el) => el?.blur())
        return
      }
      const left = attempts - 1
      setAttempts(left)
      setShake((s) => s + 1)
      note(`Rejected ${entered}: ${left} ${left === 1 ? 'try' : 'tries'} left`)
      if (left <= 0) {
        setStatus('locked')
        return
      }
      setStatus('error')
      // Let the shake play with the wrong code visible, then clear for a retry.
      setTimeout(() => {
        steer.current = true
        setState(empty(n))
      }, 650)
    }, 550)
  }

  const update = (next: State, event: string) => {
    if (status === 'success' || status === 'locked' || status === 'checking') return
    steer.current = true
    setState(next)
    if (status === 'error') setStatus('idle')
    note(event)
    if (autoSubmit && isComplete(next) && !isComplete(state)) verify(next)
  }

  const onChange = (i: number, e: ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value
    // The box already held a character: keep only what was just typed.
    const old = state.slots[i]
    if (old && raw.length > 1) raw = raw.startsWith(old) ? raw.slice(old.length) : raw.replace(old, '')
    if (!raw) return update(backspace(state, i), `Cleared box ${i + 1}`)
    const kept = clean(raw, mode)
    if (!kept) {
      note(`Ignored “${raw}”: ${mode === 'numeric' ? 'digits only' : 'letters and digits only'}`)
      setShake((s) => s + 1)
      return
    }
    const next = insert(state, i, raw, mode)
    update(next, kept.length > 1 ? `Autofill “${kept}” spread from box ${kept.length >= n ? 1 : i + 1}` : `Typed ${kept} in box ${i + 1}`)
  }

  const onPaste = (i: number, e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text')
    const kept = clean(text, mode)
    if (!kept) return note(`Paste had nothing usable: “${text.slice(0, 20)}”`)
    update(insert(state, i, text, mode), `Pasted “${kept}” → filled from box ${kept.length >= n ? 1 : i + 1}`)
  }

  const onKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      const next = backspace(state, i)
      update(next, state.slots[i] ? `Backspace cleared box ${i + 1}` : `Backspace on empty box ${i + 1} → cleared box ${next.focus + 1}`)
    } else if (e.key === 'Delete') {
      e.preventDefault()
      update(remove(state, i), `Delete in box ${i + 1}: the rest shifted left`)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      steer.current = true
      setState(move(state, i, e.key))
    } else if (e.key === 'Enter' && isComplete(state) && status === 'idle') {
      verify(state)
    }
  }

  const changeLength = (next: '4' | '6' | '8') => {
    setLength(next)
    newCode(Number(next), mode, `Switched to ${next} boxes`)
  }
  const changeMode = (next: Mode) => {
    setMode(next)
    newCode(n, next, next === 'numeric' ? 'Digits only now' : 'Letters and digits now')
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      note('Copied the code: now paste it into any box')
    } catch {
      note('Clipboard blocked: select the code and copy it by hand')
    }
  }

  const autofill = () => {
    steer.current = true
    update(insert(empty(n), 0, code, mode), `Keyboard suggestion “${code}” filled every box`)
  }

  const half = n === 6 ? 3 : n === 8 ? 4 : -1
  const locked = status === 'locked'
  const done = status === 'success'

  return (
    <div className="otp-layout">
      <div className="card otp-main">
        <div className="otp-sms" aria-label="Incoming message">
          <span className="otp-sms-icon" aria-hidden>
            💬
          </span>
          <div className="otp-sms-text">
            <div className="row otp-sms-head">
              <strong>Messages</strong>
              <span className="muted small">now</span>
            </div>
            <p>
              Your Bento code is <strong className="mono otp-code">{grouped(code)}</strong>. Don’t share it with anyone.
            </p>
            <div className="row">
              <button className="chip" onClick={copy}>
                {copied ? '✓ Copied' : 'Copy code'}
              </button>
              <button className="chip" onClick={autofill} disabled={done || locked}>
                Autofill from keyboard
              </button>
            </div>
          </div>
        </div>

        <div className="otp-panel">
          <h2>{done ? 'You’re in' : 'Enter the code'}</h2>
          <p className="muted small">
            {done ? 'The code matched.' : `We sent a ${n}-${mode === 'numeric' ? 'digit' : 'character'} code to •••• 4021.`}
          </p>

          <div
            ref={boxes}
            className={`otp-boxes ${status}`}
            style={{ '--n': n } as CSSProperties}
            role="group"
            aria-label={`Verification code, ${n} characters`}
          >
            {state.slots.map((ch, i) => (
              <span key={i} className="otp-slot-wrap">
                {i === half && <span className="otp-dash" aria-hidden />}
                <input
                  ref={(el) => {
                    refs.current[i] = el
                  }}
                  className={`otp-slot${ch ? ' filled' : ''}${i === state.focus ? ' current' : ''}`}
                  value={masked && ch ? '•' : ch}
                  placeholder=" "
                  inputMode={mode === 'numeric' ? 'numeric' : 'text'}
                  autoComplete={i === 0 ? 'one-time-code' : 'off'}
                  autoCapitalize="characters"
                  spellCheck={false}
                  disabled={done || locked}
                  aria-label={`Character ${i + 1} of ${n}`}
                  onChange={(e) => onChange(i, e)}
                  onPaste={(e) => onPaste(i, e)}
                  onKeyDown={(e) => onKeyDown(i, e)}
                  onMouseDown={(e) => {
                    const target = focusFor(state, i)
                    if (target !== i) {
                      e.preventDefault()
                      steer.current = true
                      setState({ ...state, focus: target })
                    }
                  }}
                  onFocus={(e) => {
                    e.target.select()
                    if (state.focus !== i) setState((s) => ({ ...s, focus: i }))
                  }}
                />
              </span>
            ))}
          </div>

          <div className="otp-status" aria-live="polite">
            {status === 'checking' && <span className="otp-spinner">Checking…</span>}
            {status === 'error' && <span className="otp-error">That code didn’t match. {attempts} {attempts === 1 ? 'try' : 'tries'} left.</span>}
            {done && <span className="otp-ok">✓ Verified</span>}
            {locked && <span className="otp-error">Too many wrong codes. Request a new one.</span>}
          </div>

          <div className="row otp-actions">
            {!autoSubmit && !done && !locked && (
              <button className="primary" disabled={!isComplete(state) || status === 'checking'} onClick={() => verify(state)}>
                Verify
              </button>
            )}
            {done || locked ? (
              <button className="primary" onClick={() => newCode(n, mode, 'Started over with a new code')}>
                {done ? 'Start over' : 'Send a new code'}
              </button>
            ) : (
              <button className="otp-link" disabled={cooldown > 0} onClick={() => newCode()}>
                {cooldown > 0 ? `Resend code in 0:${String(cooldown).padStart(2, '0')}` : 'Resend code'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="card otp-side">
        <Segmented label="Length" value={length} options={LENGTHS} onChange={changeLength} />
        <Segmented label="Characters" value={mode} options={MODES} onChange={changeMode} />
        <Checkbox checked={masked} onChange={setMasked}>
          Mask like a PIN
        </Checkbox>
        <Checkbox checked={autoSubmit} onChange={setAutoSubmit}>
          Submit when the last box fills
        </Checkbox>
        <div>
          <h3 className="otp-log-title">What just happened</h3>
          {log.length ? (
            <ol className="otp-log">
              {log.map((l, i) => (
                <li key={`${log.length - i}`}>{l}</li>
              ))}
            </ol>
          ) : (
            <p className="small muted">Type, paste, backspace or use the arrows. Each step shows up here.</p>
          )}
        </div>
        <p className="callout small">
          Try typing a wrong code to see the shake, pasting “12-34-56” into the middle box, or pressing Backspace on an
          empty box. <code>autocomplete="one-time-code"</code> lets phones offer the SMS code above the keyboard.
        </p>
      </div>
    </div>
  )
}
