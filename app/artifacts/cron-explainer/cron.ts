/**
 * Standard 5-field cron (minute hour day-of-month month day-of-week), Vixie-cron semantics:
 * lists (1,15), ranges (1-5), steps (*\/15, 9-17/2), month and weekday names, 7 = Sunday,
 * and the @hourly-style macros. When both day fields are restricted, a day matches if
 * EITHER matches (the classic cron surprise).
 */

export interface FieldSpec {
  name: string
  min: number
  max: number
  names?: string[]
}

export const FIELDS: FieldSpec[] = [
  { name: 'minute', min: 0, max: 59 },
  { name: 'hour', min: 0, max: 23 },
  { name: 'day of month', min: 1, max: 31 },
  { name: 'month', min: 1, max: 12, names: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] },
  { name: 'day of week', min: 0, max: 6, names: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] },
]

export const MACROS: Record<string, string> = {
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@hourly': '0 * * * *',
}

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export class CronError extends Error {
  constructor(
    message: string,
    /** Index of the offending field, or null for whole-expression problems. */
    readonly field: number | null,
  ) {
    super(message)
  }
}

export interface Cron {
  /** The five field texts (macros expanded). */
  fields: string[]
  minute: number[]
  hour: number[]
  dom: number[]
  month: number[]
  dow: number[]
  domAny: boolean
  dowAny: boolean
}

function value(token: string, spec: FieldSpec, index: number): number {
  const upper = token.toUpperCase()
  const named = spec.names?.indexOf(upper) ?? -1
  if (named >= 0) return named + spec.min
  if (!/^\d+$/.test(token)) throw new CronError(`"${token}" is not a valid ${spec.name}`, index)
  const n = Number(token)
  const max = index === 4 ? 7 : spec.max // 7 is also Sunday
  if (n < spec.min || n > max) throw new CronError(`${spec.name} must be ${spec.min}–${max}, got ${n}`, index)
  return n
}

export function parseField(text: string, index: number): number[] {
  const spec = FIELDS[index]
  const result = new Set<number>()
  for (const part of text.split(',')) {
    const m = /^(\*|[a-z0-9]+(?:-[a-z0-9]+)?)(?:\/(\d+))?$/i.exec(part)
    if (!m) throw new CronError(`"${part || '(empty)'}" is not valid in the ${spec.name} field`, index)
    const [, range, stepText] = m
    const step = stepText === undefined ? 1 : Number(stepText)
    if (step < 1) throw new CronError(`Step must be at least 1 in the ${spec.name} field`, index)
    let from: number
    let to: number
    if (range === '*') {
      from = spec.min
      to = spec.max
    } else if (range.includes('-')) {
      const [a, b] = range.split('-')
      from = value(a, spec, index)
      to = value(b, spec, index)
      if (from > to) throw new CronError(`Range ${range} goes backwards in the ${spec.name} field`, index)
    } else {
      from = value(range, spec, index)
      to = stepText === undefined ? from : spec.max // "5/15" means 5, 20, 35, 50
    }
    for (let v = from; v <= to; v += step) result.add(index === 4 ? v % 7 : v)
  }
  return [...result].sort((a, b) => a - b)
}

export function parse(expression: string): Cron {
  const trimmed = expression.trim()
  const expanded = MACROS[trimmed.toLowerCase()] ?? trimmed
  if (trimmed.startsWith('@') && !MACROS[trimmed.toLowerCase()]) throw new CronError(`Unknown macro ${trimmed}`, null)
  const fields = expanded.split(/\s+/).filter(Boolean)
  if (fields.length !== 5) throw new CronError(`Expected 5 fields, got ${fields.length}`, null)
  const [minute, hour, dom, month, dow] = fields.map((f, i) => parseField(f, i))
  const any = (text: string) => text === '*' || text === '?'
  return { fields, minute, hour, dom, month, dow, domAny: any(fields[2]), dowAny: any(fields[4]) }
}

// ---- English description ---------------------------------------------------

const pad = (n: number) => String(n).padStart(2, '0')
const time = (h: number, m: number) => `${pad(h)}:${pad(m)}`

export function list(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

const ordinal = (n: number) => {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'
  return `${n}${s}`
}

type Shape =
  | { kind: 'any' }
  | { kind: 'step'; step: number; from: number; to: number }
  | { kind: 'range'; from: number; to: number }
  | { kind: 'values'; values: number[] }

/** Recognise the common shapes of a field so the description can read naturally. */
function shape(text: string, values: number[], index: number): Shape {
  const spec = FIELDS[index]
  if (text === '*' || text === '?') return { kind: 'any' }
  const step = /^(\*|\w+-\w+|\w+)\/(\d+)$/.exec(text)
  if (step) {
    const [from, to] = step[1] === '*' ? [spec.min, spec.max] : step[1].includes('-') ? step[1].split('-').map((t) => value(t, spec, index)) : [value(step[1], spec, index), spec.max]
    return { kind: 'step', step: Number(step[2]), from, to }
  }
  const range = /^(\w+)-(\w+)$/.exec(text)
  if (range) return { kind: 'range', from: value(range[1], spec, index) % (index === 4 ? 7 : 100), to: value(range[2], spec, index) }
  return { kind: 'values', values }
}

function timePart(c: Cron): string {
  const minute = shape(c.fields[0], c.minute, 0)
  const hour = shape(c.fields[1], c.hour, 1)

  // A handful of exact clock times: "At 09:30 and 17:30".
  if (minute.kind === 'values' && hour.kind === 'values' && c.minute.length * c.hour.length <= 6) {
    return `At ${list(c.hour.flatMap((h) => c.minute.map((m) => time(h, m))))}`
  }

  let minutes: string
  switch (minute.kind) {
    case 'any':
      minutes = 'Every minute'
      break
    case 'step':
      minutes = `Every ${minute.step} minutes${minute.from !== 0 || minute.to !== 59 ? ` from minute ${minute.from} through ${minute.to}` : ''}`
      break
    case 'range':
      minutes = `Every minute from ${minute.from} through ${minute.to} past the hour`
      break
    case 'values':
      minutes = c.minute.length === 1 ? `At ${c.minute[0]} minutes past the hour` : `At minutes ${list(c.minute.map(String))} past the hour`
      if (c.minute.length === 1 && c.minute[0] === 0) minutes = 'At the start of the hour'
  }

  switch (hour.kind) {
    case 'any':
      return minute.kind === 'values' && c.minute.length === 1 && c.minute[0] === 0 ? 'Every hour, on the hour' : minutes
    case 'step':
      return `${minutes}, every ${hour.step} hours${hour.from !== 0 || hour.to !== 23 ? ` from ${time(hour.from, 0)} through ${time(hour.to, 59)}` : ''}`
    case 'range':
      return `${minutes}, between ${time(hour.from, 0)} and ${time(hour.to, 59)}`
    case 'values':
      return `${minutes}, during the ${list(c.hour.map((h) => time(h, 0)))} hour${c.hour.length > 1 ? 's' : ''}`
  }
}

function domPart(c: Cron): string | null {
  const s = shape(c.fields[2], c.dom, 2)
  switch (s.kind) {
    case 'any':
      return null
    case 'step':
      return `every ${s.step} days of the month${s.from !== 1 ? ` starting on the ${ordinal(s.from)}` : ''}`
    case 'range':
      return `from the ${ordinal(s.from)} through the ${ordinal(s.to)} of the month`
    case 'values':
      return `on the ${list(c.dom.map(ordinal))} of the month`
  }
}

function dowPart(c: Cron): string | null {
  const s = shape(c.fields[4], c.dow, 4)
  switch (s.kind) {
    case 'any':
      return null
    case 'step':
      return `on ${list(c.dow.map((d) => WEEKDAYS[d]))}`
    case 'range':
      return `${WEEKDAYS[s.from]} through ${WEEKDAYS[s.to % 7]}`
    case 'values':
      return `on ${list(c.dow.map((d) => WEEKDAYS[d]))}`
  }
}

function monthPart(c: Cron): string | null {
  const s = shape(c.fields[3], c.month, 3)
  switch (s.kind) {
    case 'any':
      return null
    case 'step':
      return `every ${s.step} months (${list(c.month.map((m) => MONTHS[m - 1]))})`
    case 'range':
      return `${MONTHS[s.from - 1]} through ${MONTHS[s.to - 1]}`
    case 'values':
      return `in ${list(c.month.map((m) => MONTHS[m - 1]))}`
  }
}

export function describe(c: Cron): string {
  const parts = [timePart(c)]
  const dom = domPart(c)
  const dow = dowPart(c)
  if (dom && dow) parts.push(`${dom}, or ${dow}`)
  else if (dom ?? dow) parts.push((dom ?? dow)!)
  const month = monthPart(c)
  if (month) parts.push(month)
  return parts.join(', ')
}

// ---- Matching and next runs ------------------------------------------------
// Times here are "wall clock" fields stored in a Date's UTC slots, so no time zone
// arithmetic leaks in; the UI converts to and from a real zone.

export function dayMatches(c: Cron, date: Date): boolean {
  const domOk = c.dom.includes(date.getUTCDate())
  const dowOk = c.dow.includes(date.getUTCDay())
  if (c.domAny && c.dowAny) return true
  if (c.domAny) return dowOk
  if (c.dowAny) return domOk
  return domOk || dowOk
}

/** Runs per day for a matching day: every listed hour × every listed minute. */
export const runsPerDay = (c: Cron) => c.hour.length * c.minute.length

/** The next `count` wall-clock times strictly after `from`. Gives up after ~5 years. */
export function nextRuns(c: Cron, from: Date, count: number): Date[] {
  const runs: Date[] = []
  const limit = from.getTime() + 5 * 366 * 86400_000
  const t = new Date(from)
  t.setUTCSeconds(0, 0)
  t.setUTCMinutes(t.getUTCMinutes() + 1)
  while (runs.length < count && t.getTime() < limit) {
    if (!c.month.includes(t.getUTCMonth() + 1)) {
      t.setUTCMonth(t.getUTCMonth() + 1, 1)
      t.setUTCHours(0, 0)
    } else if (!dayMatches(c, t)) {
      t.setUTCDate(t.getUTCDate() + 1)
      t.setUTCHours(0, 0)
    } else if (!c.hour.includes(t.getUTCHours())) {
      t.setUTCHours(t.getUTCHours() + 1, 0)
    } else if (!c.minute.includes(t.getUTCMinutes())) {
      t.setUTCMinutes(t.getUTCMinutes() + 1)
    } else {
      runs.push(new Date(t))
      t.setUTCMinutes(t.getUTCMinutes() + 1)
    }
  }
  return runs
}
