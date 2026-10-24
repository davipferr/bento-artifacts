/**
 * Fitts's law: the time to hit a target grows with its index of difficulty,
 * ID = log2(D / W + 1) bits (the Shannon form, as used by ISO 9241-9), where D is the distance
 * to the target and W its width. This module plans the trials, places targets so they fit the
 * arena, and fits MT = a + b · ID to your own clicks.
 */
export const WIDTHS = [16, 32, 64] as const
export const DISTANCES = [120, 240, 480] as const
/** Diameter of the start button. */
export const START = 34

export interface Point {
  x: number
  y: number
}

export interface Condition {
  d: number
  w: number
}

export interface Trial extends Condition {
  device: Device
  ms: number
  hit: boolean
  /** Signed error along the start→target axis: positive is overshoot. */
  offset: number
}

export type Device = 'mouse' | 'trackpad' | 'touch'

export const difficulty = (d: number, w: number) => Math.log2(d / w + 1)

function shuffle<T>(list: T[], random: () => number): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Every width × distance pair, `repeats` times, shuffled. Distances are multiplied by `scale`. */
export function plan(repeats: number, scale: number, random: () => number): Condition[] {
  const all = WIDTHS.flatMap((w) => DISTANCES.map((d) => ({ w, d: Math.round(d * scale) })))
  return shuffle(
    Array.from({ length: repeats }, () => all).flat(),
    random,
  )
}

/** How much to shrink the distances so the longest still fits across an arena this wide. */
export function scaleFor(width: number, margin = 12): number {
  const room = width - margin * 2 - START / 2 - WIDTHS[WIDTHS.length - 1] / 2
  return Math.max(0.25, Math.min(1, room / DISTANCES[DISTANCES.length - 1]))
}

/**
 * Put the start and the target `d` apart, centred in the arena, along a random direction that
 * keeps both inside it. Tries a few angles, then falls back to horizontal.
 */
export function place(d: number, w: number, width: number, height: number, random: () => number, margin = 12): { start: Point; target: Point } {
  const cx = width / 2
  const cy = height / 2
  const fits = (p: Point, r: number) => p.x - r >= margin && p.x + r <= width - margin && p.y - r >= margin && p.y + r <= height - margin
  const at = (angle: number) => {
    const dx = (Math.cos(angle) * d) / 2
    const dy = (Math.sin(angle) * d) / 2
    return { start: { x: cx - dx, y: cy - dy }, target: { x: cx + dx, y: cy + dy } }
  }
  for (let i = 0; i < 24; i++) {
    const p = at(random() * Math.PI * 2)
    if (fits(p.start, START / 2) && fits(p.target, w / 2)) return p
  }
  return random() < 0.5 ? at(0) : at(Math.PI)
}

/** The click's error along the movement axis, relative to the target centre (positive = overshoot). */
export function axisOffset(start: Point, target: Point, click: Point): number {
  const dx = target.x - start.x
  const dy = target.y - start.y
  const len = Math.hypot(dx, dy) || 1
  return ((click.x - target.x) * dx + (click.y - target.y) * dy) / len
}

/** Least squares y = a + b·x. Needs at least two different x values. */
export function linearFit(xs: number[], ys: number[]): { a: number; b: number; r2: number } | null {
  if (xs.length !== ys.length || new Set(xs).size < 2) return null
  const mx = xs.reduce((s, x) => s + x, 0) / xs.length
  const my = ys.reduce((s, y) => s + y, 0) / ys.length
  let sxy = 0
  let sxx = 0
  let syy = 0
  xs.forEach((x, i) => {
    sxy += (x - mx) * (ys[i] - my)
    sxx += (x - mx) ** 2
    syy += (ys[i] - my) ** 2
  })
  const b = sxy / sxx
  return { a: my - b * mx, b, r2: syy === 0 ? 1 : (sxy * sxy) / (sxx * syy) }
}

/** Fit MT = a + b · ID over the hits only (misses don't tell you how long aiming takes). */
export function fitTrials(trials: Trial[]) {
  const hits = trials.filter((t) => t.hit)
  return linearFit(
    hits.map((t) => difficulty(t.d, t.w)),
    hits.map((t) => t.ms),
  )
}

/** Mean of ID / MT over hits, in bits per second: one number for "how good is this pointer". */
export function throughput(trials: Trial[]): number {
  const hits = trials.filter((t) => t.hit && t.ms > 0)
  if (!hits.length) return NaN
  return hits.reduce((s, t) => s + difficulty(t.d, t.w) / (t.ms / 1000), 0) / hits.length
}

/**
 * Effective width: 4.133 × the standard deviation of the click offsets, the width you
 * actually aimed at (ISO 9241-9). Bigger than W means sloppy, smaller means careful.
 */
export function effectiveWidth(offsets: number[]): number {
  if (offsets.length < 2) return NaN
  const mean = offsets.reduce((s, o) => s + o, 0) / offsets.length
  const variance = offsets.reduce((s, o) => s + (o - mean) ** 2, 0) / (offsets.length - 1)
  return 4.133 * Math.sqrt(variance)
}
