import { useEffect, useMemo, useState } from 'react'
import { CronError, dayMatches, describe, FIELDS, MACROS, MONTHS, nextRuns, parse, runsPerDay, type Cron } from './cron'
import { localZone, relative, toInstant, wallClock, zones } from './zone'
import './style.css'

const presets = [
  { label: 'Every 5 minutes', expression: '*/5 * * * *' },
  { label: 'Hourly', expression: '0 * * * *' },
  { label: 'Daily at midnight', expression: '@daily' },
  { label: 'Weekdays 09:30', expression: '30 9 * * 1-5' },
  { label: 'Business hours', expression: '*/15 9-17 * * MON-FRI' },
  { label: 'Weekends 10:00', expression: '0 10 * * SAT,SUN' },
  { label: 'Monthly', expression: '0 0 1 * *' },
  { label: 'Quarterly', expression: '0 0 1 */3 *' },
  { label: 'Friday the 13th?', expression: '0 0 13 * 5' },
]

const HINTS = ['0–59', '0–23', '1–31', '1–12 or JAN–DEC', '0–7 or SUN–SAT']

/** Format wall-clock fields (stored in UTC slots) without any zone shift. */
const formatWall = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

type Parsed = { cron: Cron; error: null } | { cron: null; error: CronError }

function tryParse(expression: string): Parsed {
  try {
    return { cron: parse(expression), error: null }
  } catch (error) {
    if (error instanceof CronError) return { cron: null, error }
    throw error
  }
}

function Calendar({ cron, year, month, today, next }: { cron: Cron; year: number; month: number; today: Date; next: Date | null }) {
  const first = new Date(Date.UTC(year, month, 1))
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const blanks = first.getUTCDay()
  const monthMatches = cron.month.includes(month + 1)
  const sameDay = (a: Date, d: number) => a.getUTCFullYear() === year && a.getUTCMonth() === month && a.getUTCDate() === d
  return (
    <div className="cal-grid">
      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
        <span key={i} className="cal-head">
          {d}
        </span>
      ))}
      {Array.from({ length: blanks }, (_, i) => (
        <span key={`b${i}`} />
      ))}
      {Array.from({ length: days }, (_, i) => {
        const day = i + 1
        const runs = monthMatches && dayMatches(cron, new Date(Date.UTC(year, month, day))) ? runsPerDay(cron) : 0
        const classes = ['cal-day', runs ? 'runs' : '', sameDay(today, day) ? 'today' : '', next && sameDay(next, day) ? 'next' : '']
        return (
          <span key={day} className={classes.filter(Boolean).join(' ')} title={runs ? `${runs} run${runs > 1 ? 's' : ''}` : 'no runs'}>
            <span>{day}</span>
            {runs > 0 && <small>{runs > 99 ? '99+' : runs}×</small>}
          </span>
        )
      })}
    </div>
  )
}

export default function CronExplainer() {
  const [expression, setExpression] = useState('30 9 * * 1-5')
  const [zone, setZone] = useState(localZone)
  const [now, setNow] = useState(() => new Date())
  const [view, setView] = useState<{ year: number; month: number } | null>(null)

  // Keep "next run" and the relative times fresh.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const parsed = useMemo(() => tryParse(expression), [expression])
  const wallNow = wallClock(now, zone)
  const runs = useMemo(() => (parsed.cron ? nextRuns(parsed.cron, wallNow, 10) : []), [parsed, wallNow.getTime()])
  const shown = view ?? { year: wallNow.getUTCFullYear(), month: wallNow.getUTCMonth() }
  const allZones = useMemo(zones, [])

  // Fields shown in the builder: the expanded macro, or the raw split while typing.
  const fields = parsed.cron?.fields ?? (MACROS[expression.trim().toLowerCase()] ?? expression).trim().split(/\s+/)
  /** The field being typed into; an empty box counts as "*" until you type something. */
  const [editing, setEditing] = useState<{ index: number; text: string } | null>(null)
  const setField = (index: number, raw: string) => {
    const text = raw.replace(/\s+/g, '')
    setEditing({ index, text })
    const next = Array.from({ length: 5 }, (_, i) => (i === index ? text || '*' : fields[i] ?? '*'))
    setExpression(next.join(' '))
  }

  const moveMonth = (delta: number) => {
    const d = new Date(Date.UTC(shown.year, shown.month + delta, 1))
    setView({ year: d.getUTCFullYear(), month: d.getUTCMonth() })
  }

  const bothDays = parsed.cron && !parsed.cron.domAny && !parsed.cron.dowAny

  return (
    <>
      <div className="card cron-editor">
        <input
          className={`cron-input${parsed.error ? ' invalid' : ''}`}
          value={expression}
          onChange={(e) => setExpression(e.target.value)}
          spellCheck={false}
          aria-label="Cron expression"
        />
        <div className="presets">
          {presets.map((p) => (
            <button
              key={p.expression}
              className={`chip${p.expression === expression ? ' active' : ''}`}
              onClick={() => setExpression(p.expression)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="cron-fields">
          {FIELDS.map((spec, i) => (
            <label key={spec.name} className={`cron-field${parsed.error?.field === i ? ' invalid' : ''}`}>
              <input
                value={editing?.index === i ? editing.text : fields[i] ?? ''}
                onChange={(e) => setField(i, e.target.value)}
                onBlur={() => setEditing(null)}
                spellCheck={false}
              />
              <span className="cron-field-name">{spec.name}</span>
              <span className="cron-field-hint">{HINTS[i]}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="card cron-sentence">
        {parsed.cron ? (
          <>
            <p className="sentence">“{describe(parsed.cron)}.”</p>
            {bothDays && (
              <p className="callout small">
                Both day fields are set, so cron runs when <strong>either</strong> matches, not both.
                That's why "Friday the 13th" runs every Friday <em>and</em> every 13th.
              </p>
            )}
          </>
        ) : (
          <p className="sentence error">{parsed.error.message}</p>
        )}
      </div>

      {parsed.cron && (
        <div className="cron-bottom">
          <div className="card">
            <div className="row">
              <h3>Next runs</h3>
              <span className="spacer" />
              <select value={zone} onChange={(e) => setZone(e.target.value)} aria-label="Time zone">
                {allZones.map((z) => (
                  <option key={z} value={z}>
                    {z === localZone() ? `${z} (yours)` : z}
                  </option>
                ))}
              </select>
            </div>
            {runs.length === 0 ? (
              <p className="muted">This expression never runs (within the next 5 years).</p>
            ) : (
              <ol className="runs">
                {runs.map((run) => (
                  <li key={run.getTime()}>
                    <span className="mono">{formatWall.format(run)}</span>
                    <span className="muted small">{relative(toInstant(run, zone).getTime() - now.getTime())}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="card">
            <div className="row">
              <button className="icon-button" onClick={() => moveMonth(-1)} aria-label="Previous month">
                ‹
              </button>
              <h3 className="cal-title">
                {MONTHS[shown.month]} {shown.year}
              </h3>
              <button className="icon-button" onClick={() => moveMonth(1)} aria-label="Next month">
                ›
              </button>
              <span className="spacer" />
              {view && (
                <button className="chip" onClick={() => setView(null)}>
                  Today
                </button>
              )}
            </div>
            <Calendar cron={parsed.cron} year={shown.year} month={shown.month} today={wallNow} next={runs[0] ?? null} />
            <p className="hint">
              Highlighted days have runs; the number is how many. The outlined day holds the next run.
            </p>
          </div>
        </div>
      )}
    </>
  )
}
