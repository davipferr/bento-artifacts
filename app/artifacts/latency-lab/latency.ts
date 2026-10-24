/**
 * What a button and its result area show while waiting on a slow response, for a few
 * classic tricks that make waiting feel shorter. Everything is a pure function of the
 * delay and the time since the click.
 */
export const DELAYS = [0, 100, 300, 1000] as const
export type Delay = (typeof DELAYS)[number]

export type Trick = 'none' | 'press' | 'spinner' | 'skeleton' | 'optimistic'

export const TRICKS: { id: Trick; name: string; hint: string }[] = [
  { id: 'none', name: 'Nothing', hint: 'No feedback until the result arrives.' },
  { id: 'press', name: 'Instant press', hint: 'The button reacts the moment you click, then waits.' },
  { id: 'spinner', name: 'Spinner after 400 ms', hint: 'A spinner, but only if it’s slow, so fast responses don’t flash one.' },
  { id: 'skeleton', name: 'Skeleton', hint: 'The result’s shape appears at once and fills in later.' },
  { id: 'optimistic', name: 'Optimistic', hint: 'Shows the result straight away and confirms it quietly later.' },
]

export const SPINNER_AFTER = 400
export const PRESS_MS = 140

export interface View {
  /** The button looks pushed in. */
  pressed: boolean
  spinner: boolean
  skeleton: boolean
  /** The result is on screen. */
  shown: boolean
  /** Shown before the server confirmed (optimistic). */
  unconfirmed: boolean
}

export function viewAt(trick: Trick, delay: number, t: number): View {
  const done = t >= delay
  const view: View = { pressed: false, spinner: false, skeleton: false, shown: done, unconfirmed: false }
  if (trick === 'none') return view
  // Busy until the answer comes, and always long enough to see the press.
  view.pressed = !done || t < PRESS_MS
  if (trick === 'spinner') view.spinner = !done && t >= SPINNER_AFTER
  if (trick === 'skeleton') view.skeleton = !done
  if (trick === 'optimistic') {
    view.shown = true
    view.unconfirmed = !done
  }
  return view
}

/** Nielsen's response-time limits. */
export const LIMITS = [
  { ms: 100, label: 'feels instant' },
  { ms: 1000, label: 'keeps your flow' },
  { ms: 10000, label: 'loses your attention' },
]

/** Which of Nielsen's bands a delay falls in. */
export const band = (ms: number) => LIMITS.find((l) => ms <= l.ms)?.label ?? 'gone'

export type Rating = 0 | 1 | 2 // slow, fine, instant

export interface Trial {
  delay: Delay
  trick: Trick
  rating?: Rating
}

/** A blind test: every delay with the bare button and with two random tricks, shuffled. */
export function blindPlan(random: () => number): Trial[] {
  const tricks: Trick[] = ['press', 'spinner', 'skeleton', 'optimistic']
  const trials: Trial[] = []
  for (const delay of DELAYS) {
    trials.push({ delay, trick: 'none' })
    const pool = [...tricks]
    for (let k = 0; k < 2; k++) trials.push({ delay, trick: pool.splice(Math.floor(random() * pool.length), 1)[0] })
  }
  for (let i = trials.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[trials[i], trials[j]] = [trials[j], trials[i]]
  }
  return trials
}

/** Average rating (0 slow … 2 instant) by delay and by trick, over the rated trials. */
export function averages(trials: Trial[]) {
  const avg = (list: Trial[]) => (list.length ? list.reduce((s, t) => s + (t.rating ?? 0), 0) / list.length : null)
  const rated = trials.filter((t) => t.rating !== undefined)
  return {
    byDelay: Object.fromEntries(DELAYS.map((d) => [d, avg(rated.filter((t) => t.delay === d))])) as Record<Delay, number | null>,
    byTrick: Object.fromEntries(TRICKS.map(({ id }) => [id, avg(rated.filter((t) => t.trick === id))])) as Record<Trick, number | null>,
  }
}
