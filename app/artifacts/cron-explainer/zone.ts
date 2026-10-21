/**
 * Time zone helpers. Cron works in local wall-clock time, so we convert between real
 * instants and wall-clock fields (kept in a Date's UTC slots) for a given IANA zone.
 */

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatter(timeZone: string) {
  let f = formatters.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    formatters.set(timeZone, f)
  }
  return f
}

/** What a clock in `timeZone` shows at `instant`, as UTC fields. */
export function wallClock(instant: Date, timeZone: string): Date {
  const parts = formatter(timeZone).formatToParts(instant)
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value)
  return new Date(Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')))
}

/** The instant when a clock in `timeZone` shows `wall`. Two passes settle the zone offset. */
export function toInstant(wall: Date, timeZone: string): Date {
  let guess = wall.getTime()
  for (let i = 0; i < 2; i++) {
    const offset = wallClock(new Date(guess), timeZone).getTime() - guess
    guess = wall.getTime() - offset
  }
  return new Date(guess)
}

export const localZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone

export function zones(): string[] {
  const all = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : []
  return [...new Set(['UTC', localZone(), ...all])]
}

/** "in 5 min", "in 3 h 20 min", "in 4 days". */
export function relative(ms: number): string {
  const minutes = Math.round(ms / 60_000)
  if (minutes < 1) return 'now'
  if (minutes < 60) return `in ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `in ${hours} h${minutes % 60 ? ` ${minutes % 60} min` : ''}`
  return `in ${Math.round(hours / 24)} days`
}
