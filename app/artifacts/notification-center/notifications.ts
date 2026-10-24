/**
 * The model behind a notification centre: notices, grouping by app or by time, relative
 * timestamps, the badge label, and the swipe-to-dismiss decision.
 */
export const SOURCES = {
  builds: { name: 'Build bot', icon: '⚙️' },
  calendar: { name: 'Calendar', icon: '📅' },
  chat: { name: 'Team chat', icon: '💬' },
  deploys: { name: 'Deploys', icon: '🚀' },
  reviews: { name: 'Code review', icon: '👀' },
} as const

export type Source = keyof typeof SOURCES

export interface Notice {
  id: string
  source: Source
  title: string
  body: string
  /** Epoch milliseconds. */
  at: number
  read: boolean
}

export interface Group {
  key: string
  label: string
  /** Set when grouped by app, for the icon. */
  source?: Source
  items: Notice[]
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** Local midnight of the day `t` falls in. */
const startOfDay = (t: number) => {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function bucket(at: number, now: number): 'New' | 'Today' | 'Yesterday' | 'Earlier' {
  if (now - at < 10 * MINUTE) return 'New'
  const today = startOfDay(now)
  if (at >= today) return 'Today'
  if (at >= today - DAY) return 'Yesterday'
  return 'Earlier'
}

/** Newest first inside each group; groups ordered by their newest notice (app) or by bucket (time). */
export function group(notices: Notice[], now: number, by: 'app' | 'time'): Group[] {
  const sorted = [...notices].sort((a, b) => b.at - a.at)
  const map = new Map<string, Group>()
  for (const n of sorted) {
    const key = by === 'app' ? n.source : bucket(n.at, now)
    let g = map.get(key)
    if (!g) {
      g = by === 'app' ? { key, label: SOURCES[n.source].name, source: n.source, items: [] } : { key, label: key, items: [] }
      map.set(key, g)
    }
    g.items.push(n)
  }
  return [...map.values()]
}

/** "now", "5m", "3h", "Yesterday", "4d", then a date. */
export function relative(at: number, now: number): string {
  const diff = Math.max(0, now - at)
  if (diff < MINUTE) return 'now'
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m`
  if (diff < DAY && at >= startOfDay(now)) return `${Math.floor(diff / HOUR)}h`
  if (bucket(at, now) === 'Yesterday') return 'Yesterday'
  if (diff < 7 * DAY) return `${Math.max(1, Math.round(diff / DAY))}d`
  return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** What the red badge shows: nothing at 0, the count up to 99, then "99+". */
export const badge = (unread: number) => (unread <= 0 ? '' : unread > 99 ? '99+' : String(unread))

export const unreadCount = (notices: Notice[]) => notices.filter((n) => !n.read).length

export const markRead = (notices: Notice[], ids: string[], read = true) => notices.map((n) => (ids.includes(n.id) ? { ...n, read } : n))
export const markAllRead = (notices: Notice[]) => notices.map((n) => (n.read ? n : { ...n, read: true }))
export const dismiss = (notices: Notice[], ids: string[]) => notices.filter((n) => !ids.includes(n.id))

/**
 * Dismiss a swiped card if it went past `distance` of its width, or was flung faster than
 * `speed` px/ms in the direction it's already going.
 */
export function swipeOutcome(dx: number, vx: number, width: number, distance = 0.4, speed = 0.6): 'left' | 'right' | null {
  if (Math.abs(dx) > width * distance) return dx > 0 ? 'right' : 'left'
  if (Math.abs(vx) > speed && Math.sign(vx) === Math.sign(dx) && Math.abs(dx) > 8) return vx > 0 ? 'right' : 'left'
  return null
}

const TEMPLATES: Record<Source, [string, string][]> = {
  builds: [
    ['CI passed on main', 'All 214 tests green in 1m 12s.'],
    ['Build failed: feature/login', 'Type error in auth.ts:42. Expected string, got undefined.'],
    ['Flaky test quarantined', 'swipe.test.ts › spring settles failed 1 of 20 runs.'],
  ],
  calendar: [
    ['Standup in 5 minutes', 'Daily sync · Room 2 or video call.'],
    ['Design review moved', 'Now Thursday 15:00. Bring the palette mockups.'],
    ['Focus time starts', 'Notifications will be quieter until 12:00.'],
  ],
  chat: [
    ['Ana mentioned you', '“Can you look at the command palette ranking?”'],
    ['New message in #frontend', 'Ravi: the swipe deck feels great on my phone.'],
    ['Joana replied', '“Ship it!” 🚢'],
  ],
  deploys: [
    ['Deployed to production', 'v2.4.0 is live. 0 errors in the first 5 minutes.'],
    ['Preview ready', 'Branch file-tree has a preview URL.'],
    ['Rollback complete', 'Production is back on v2.3.9.'],
  ],
  reviews: [
    ['Review requested', 'Add Batch 3 UI artifacts, 42 files changed.'],
    ['Changes approved', 'Your pull request can be merged.'],
    ['New comment on otp.ts', '“Should paste also accept dashes?”'],
  ],
}

let serial = 0

/** A believable notice from a random app. */
export function generate(now: number, random: () => number = Math.random, source?: Source): Notice {
  const keys = Object.keys(TEMPLATES) as Source[]
  const s = source ?? keys[Math.floor(random() * keys.length)]
  const options = TEMPLATES[s]
  const [title, body] = options[Math.floor(random() * options.length)]
  return { id: `n${++serial}-${now}`, source: s, title, body, at: now, read: false }
}

/** A starting inbox spread over the last couple of days. */
export function seed(now: number, random: () => number): Notice[] {
  const ages = [2 * MINUTE, 7 * MINUTE, 25 * MINUTE, 50 * MINUTE, 3 * HOUR, 5 * HOUR, 26 * HOUR, 30 * HOUR, 3 * DAY]
  return ages.map((age, i) => ({ ...generate(now - age, random), read: i >= 5 }))
}
