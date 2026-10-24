import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Checkbox } from '../../kit/Controls'
import { ago, direction, EMPTY, fromDraft, isValid, progress, reachable, SIZES, slugify, STEPS, strength, toDraft, validate, type Errors, type Values } from './wizard'
import './style.css'

const KEY = 'bento-wizard-draft'

function readDraft() {
  try {
    return fromDraft(localStorage.getItem(KEY))
  } catch {
    return null
  }
}
function writeDraft(text: string | null) {
  try {
    if (text === null) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, text)
    return true
  } catch {
    return false
  }
}

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className={`wz-field${error ? ' invalid' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {error ? (
        <span id={`${id}-error`} className="wz-error" role="alert">
          {error}
        </span>
      ) : (
        hint && <span className="wz-hint">{hint}</span>
      )}
    </div>
  )
}

export default function Wizard() {
  const [values, setValues] = useState<Values>(EMPTY)
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState<1 | -1 | 0>(0)
  const [errors, setErrors] = useState<Errors>({})
  const [shown, setShown] = useState<Set<number>>(new Set())
  const [offer, setOffer] = useState(readDraft)
  const [screen, setScreen] = useState<'form' | 'saved' | 'done'>('form')
  const [autosave, setAutosave] = useState(true)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [, setNow] = useState(0)
  const body = useRef<HTMLDivElement>(null)
  const shake = useRef<HTMLDivElement>(null)

  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((v) => {
      const next = { ...v, [key]: value }
      // The slug follows the workspace name until you edit it yourself.
      if (key === 'workspace' && !v.slugTouched) next.slug = slugify(String(value))
      if (key === 'slug') next.slugTouched = true
      return next
    })
    // Re-check a field as you fix it, once its errors have been shown.
    if (shown.has(step)) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  // Autosave a moment after you stop typing.
  useEffect(() => {
    if (!autosave || screen !== 'form' || values === EMPTY) return
    const id = window.setTimeout(() => {
      if (writeDraft(toDraft(values, step, Date.now()))) setSavedAt(Date.now())
    }, 700)
    return () => window.clearTimeout(id)
  }, [values, step, autosave, screen])

  // Keep "saved 5 s ago" fresh.
  useEffect(() => {
    const id = window.setInterval(() => setNow((n) => n + 1), 5000)
    return () => window.clearInterval(id)
  }, [])

  const goTo = (target: number) => {
    if (target === step) return
    setDir(direction(step, target) as 1 | -1)
    setStep(target)
    setErrors({})
  }

  const focusFirstError = (errs: Errors) => {
    const first = Object.keys(errs)[0]
    // After React has rendered the error messages.
    window.setTimeout(() => {
      const el = body.current?.querySelector<HTMLElement>(`[name="${first}"]`)
      el?.focus()
      shake.current?.classList.remove('shake')
      void shake.current?.offsetWidth
      shake.current?.classList.add('shake')
    }, 0)
  }

  const next = (e?: FormEvent) => {
    e?.preventDefault()
    const errs = validate(step, values)
    if (Object.keys(errs).length) {
      setErrors(errs)
      setShown((s) => new Set([...s, step]))
      focusFirstError(errs)
      return
    }
    if (step === STEPS.length - 1) {
      writeDraft(null)
      setScreen('done')
      return
    }
    goTo(step + 1)
  }

  const saveAndExit = () => {
    if (writeDraft(toDraft(values, step, Date.now()))) setSavedAt(Date.now())
    setScreen('saved')
  }

  const resume = (draft = readDraft()) => {
    if (!draft) return
    setValues(draft.values)
    setDir(0)
    setStep(draft.step)
    setErrors({})
    setOffer(null)
    setScreen('form')
  }

  const startOver = () => {
    writeDraft(null)
    setValues(EMPTY)
    setStep(0)
    setDir(0)
    setErrors({})
    setShown(new Set())
    setOffer(null)
    setSavedAt(null)
    setScreen('form')
  }

  const furthest = reachable(values)
  const pw = strength(values.password)
  const input = (name: keyof Values, props: Record<string, unknown> = {}) => ({
    id: `wz-${name}`,
    name,
    'aria-invalid': !!errors[name],
    'aria-describedby': errors[name] ? `wz-${name}-error` : undefined,
    ...props,
  })

  if (screen === 'saved')
    return (
      <div className="card wz-screen">
        <span className="wz-icon" aria-hidden>
          💾
        </span>
        <h2>Saved for later</h2>
        <p className="muted">
          Your answers are stored in this browser (but not your password). Imagine you closed the tab and came back tomorrow.
        </p>
        <div className="row">
          <button className="primary" onClick={() => resume()}>
            Come back and resume
          </button>
          <button onClick={startOver}>Discard draft</button>
        </div>
      </div>
    )

  if (screen === 'done')
    return (
      <div className="card wz-screen">
        <svg className="wz-check" viewBox="0 0 52 52" aria-hidden>
          <circle cx="26" cy="26" r="24" />
          <path d="M14 27l8 8 16-17" />
        </svg>
        <h2>{values.workspace} is ready</h2>
        <p className="muted">
          acme.app/<strong>{values.slug}</strong> · {values.size} · signed in as {values.email}
        </p>
        <button className="primary" onClick={startOver}>
          Start again
        </button>
      </div>
    )

  return (
    <div className="wz-layout">
      <div className="card wz-card">
        {offer && (
          <div className="wz-resume" role="status">
            <span>
              You have a draft from <strong>{ago(Date.now() - offer.savedAt)}</strong>, at step {offer.step + 1}: {STEPS[offer.step].title}.
            </span>
            <span className="spacer" />
            <button className="chip active" onClick={() => resume(offer)}>
              Resume
            </button>
            <button
              className="chip"
              onClick={() => {
                writeDraft(null)
                setOffer(null)
              }}
            >
              Start fresh
            </button>
          </div>
        )}

        <ol className="wz-steps" aria-label="Progress">
          <div className="wz-track" aria-hidden>
            <i style={{ width: `${(step / (STEPS.length - 1)) * 100}%` }} />
          </div>
          {STEPS.map((s, i) => {
            const done = i < step && isValid(i, values)
            const hasErrors = shown.has(i) && !isValid(i, values) && i !== step
            const canGo = i <= furthest || i < step
            return (
              <li key={s.id} className={`wz-step${i === step ? ' current' : ''}${done ? ' done' : ''}${hasErrors ? ' error' : ''}`}>
                <button type="button" disabled={!canGo} aria-current={i === step ? 'step' : undefined} onClick={() => goTo(i)}>
                  <span className="wz-dot">{done ? '✓' : hasErrors ? '!' : i + 1}</span>
                  <span className="wz-step-text">
                    <strong>{s.title}</strong>
                    <span>{s.hint}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>

        <form onSubmit={next} noValidate>
          <div className="wz-body" ref={body}>
            <div key={step} className={`wz-panel${dir > 0 ? ' from-right' : dir < 0 ? ' from-left' : ''}`} ref={shake}>
              {step === 0 && (
                <>
                  <h2>Create your account</h2>
                  <Field id="wz-name" label="Full name" error={errors.name}>
                    <input {...input('name', { autoComplete: 'name' })} value={values.name} onChange={(e) => set('name', e.target.value)} />
                  </Field>
                  <Field id="wz-email" label="Work email" error={errors.email}>
                    <input {...input('email', { type: 'email', autoComplete: 'email' })} value={values.email} onChange={(e) => set('email', e.target.value)} />
                  </Field>
                  <Field
                    id="wz-password"
                    label="Password"
                    error={errors.password}
                    hint={
                      values.password && (
                        <span className={`wz-strength s${pw.score}`}>
                          <i />
                          <i />
                          <i />
                          <i /> {pw.label}
                        </span>
                      )
                    }
                  >
                    <input
                      {...input('password', { type: 'password', autoComplete: 'new-password' })}
                      value={values.password}
                      onChange={(e) => set('password', e.target.value)}
                    />
                  </Field>
                </>
              )}
              {step === 1 && (
                <>
                  <h2>Set up your workspace</h2>
                  <Field id="wz-workspace" label="Workspace name" error={errors.workspace}>
                    <input {...input('workspace')} value={values.workspace} onChange={(e) => set('workspace', e.target.value)} />
                  </Field>
                  <Field id="wz-slug" label="Address" error={errors.slug} hint={values.slugTouched ? 'Edited by hand.' : 'Follows the name until you edit it.'}>
                    <div className="wz-prefix">
                      <span>acme.app/</span>
                      <input {...input('slug', { spellCheck: false })} value={values.slug} onChange={(e) => set('slug', e.target.value.toLowerCase())} />
                    </div>
                  </Field>
                  <fieldset className={`wz-field wz-choices${errors.size ? ' invalid' : ''}`}>
                    <legend>Team size</legend>
                    <div className="wz-pills">
                      {SIZES.map((s, i) => (
                        <label key={s} className={`wz-pill${values.size === s ? ' on' : ''}`}>
                          <input type="radio" name={i === 0 ? 'size' : undefined} checked={values.size === s} onChange={() => set('size', s)} />
                          {s}
                        </label>
                      ))}
                    </div>
                    {errors.size && (
                      <span className="wz-error" role="alert">
                        {errors.size}
                      </span>
                    )}
                  </fieldset>
                </>
              )}
              {step === 2 && (
                <>
                  <h2>Make it yours</h2>
                  <fieldset className="wz-field wz-choices">
                    <legend>Theme</legend>
                    <div className="wz-pills">
                      {(['system', 'light', 'dark'] as const).map((t) => (
                        <label key={t} className={`wz-pill${values.theme === t ? ' on' : ''}`}>
                          <input type="radio" checked={values.theme === t} onChange={() => set('theme', t)} />
                          {t === 'system' ? '◐ System' : t === 'light' ? '☀ Light' : '☾ Dark'}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset className="wz-field wz-choices">
                    <legend>Email digest</legend>
                    <div className="wz-pills">
                      {(['daily', 'weekly', 'never'] as const).map((d) => (
                        <label key={d} className={`wz-pill${values.digest === d ? ' on' : ''}`}>
                          <input type="radio" checked={values.digest === d} onChange={() => set('digest', d)} />
                          {d[0].toUpperCase() + d.slice(1)}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <Checkbox checked={values.mentions} onChange={(v) => set('mentions', v)}>
                    Notify me when someone mentions me
                  </Checkbox>
                  <p className="small muted">Nothing here is required: optional steps should never block you.</p>
                </>
              )}
              {step === 3 && (
                <>
                  <h2>Review</h2>
                  <dl className="wz-review">
                    {[
                      ['Name', values.name, 0],
                      ['Email', values.email, 0],
                      ['Workspace', `${values.workspace} (acme.app/${values.slug})`, 1],
                      ['Team size', values.size, 1],
                      ['Theme', values.theme, 2],
                      ['Digest', `${values.digest}${values.mentions ? ', plus mentions' : ''}`, 2],
                    ].map(([label, value, at]) => (
                      <div key={label as string}>
                        <dt>{label}</dt>
                        <dd>{value || '·'}</dd>
                        <button type="button" className="wz-edit" onClick={() => goTo(at as number)}>
                          Edit
                        </button>
                      </div>
                    ))}
                  </dl>
                  <div className={`wz-field${errors.agree ? ' invalid' : ''}`}>
                    <label className="wz-agree">
                      <input type="checkbox" name="agree" checked={values.agree} onChange={(e) => set('agree', e.target.checked)} aria-invalid={!!errors.agree} />I accept the
                      (pretend) terms of service
                    </label>
                    {errors.agree && (
                      <span className="wz-error" role="alert">
                        {errors.agree}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="wz-footer">
            <button type="button" onClick={() => goTo(step - 1)} disabled={step === 0}>
              ← Back
            </button>
            <button type="button" className="wz-save" onClick={saveAndExit}>
              Save &amp; exit
            </button>
            <span className="spacer" />
            <span className="small muted wz-saved">{savedAt ? `Draft saved ${ago(Date.now() - savedAt)}` : ''}</span>
            <button type="submit" className="primary">
              {step === STEPS.length - 1 ? 'Create workspace' : 'Next →'}
            </button>
          </div>
        </form>
      </div>

      <div className="card wz-side">
        <div className="wz-progress" aria-hidden>
          <i style={{ width: `${progress(step) * 100}%` }} />
        </div>
        <p className="small">
          Step {step + 1} of {STEPS.length}
        </p>
        <Checkbox checked={autosave} onChange={setAutosave}>
          Autosave a draft while I type
        </Checkbox>
        <ul className="wz-notes small">
          <li>Next checks only this step and focuses the first problem.</li>
          <li>Errors appear after you try, not while you type the first letter.</li>
          <li>Steps slide in from the side you’re heading to.</li>
          <li>You can jump back freely, and forward only as far as everything before is valid.</li>
          <li>Drafts skip the password, so resuming asks for it again.</li>
          <li>Enter submits the step, like any form.</li>
        </ul>
      </div>
    </div>
  )
}
