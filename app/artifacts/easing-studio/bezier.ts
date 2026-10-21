/**
 * CSS cubic-bézier timing functions. The curve runs from (0,0) to (1,1) with two control
 * points (x1, y1) and (x2, y2); x is time, y is progress. To get progress at a time we must
 * first find the curve parameter t whose x equals that time, which has no closed form,
 * so we use Newton's method with a bisection fallback (as browsers do).
 */

export type Bezier = [x1: number, y1: number, x2: number, y2: number]

/** One coordinate of the curve at parameter t, given its two control values. */
const coord = (p1: number, p2: number, t: number) => 3 * p1 * t * (1 - t) ** 2 + 3 * p2 * t * t * (1 - t) + t ** 3

const slope = (p1: number, p2: number, t: number) =>
  3 * p1 * (1 - t) ** 2 + 6 * (p2 - p1) * t * (1 - t) + 3 * (1 - p2) * t * t

/** Find t with x(t) = x. x1 and x2 are in [0, 1], so x(t) is monotonic and t is unique. */
export function solveT([x1, , x2]: Bezier, x: number): number {
  let t = x
  for (let i = 0; i < 8; i++) {
    const error = coord(x1, x2, t) - x
    if (Math.abs(error) < 1e-7) return t
    const d = slope(x1, x2, t)
    if (Math.abs(d) < 1e-6) break
    t -= error / d
  }
  // Newton stalled (flat spot): bisect instead.
  let lo = 0
  let hi = 1
  t = x
  for (let i = 0; i < 40; i++) {
    const value = coord(x1, x2, t)
    if (Math.abs(value - x) < 1e-7) break
    if (value < x) lo = t
    else hi = t
    t = (lo + hi) / 2
  }
  return t
}

/** Progress (y) at time x in [0, 1]. Can go below 0 or above 1 for "back" curves. */
export function ease(curve: Bezier, x: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const t = solveT(curve, x)
  return coord(curve[1], curve[3], t)
}

/** A point on the curve at parameter t, for drawing. */
export const point = ([x1, y1, x2, y2]: Bezier, t: number): [number, number] => [coord(x1, x2, t), coord(y1, y2, t)]

export const keywords: Record<string, Bezier> = {
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  'ease-in': [0.42, 0, 1, 1],
  'ease-out': [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1],
}

export const presets: { name: string; curve: Bezier }[] = [
  ...Object.entries(keywords).map(([name, curve]) => ({ name, curve })),
  { name: 'in cubic', curve: [0.32, 0, 0.67, 0] },
  { name: 'out cubic', curve: [0.33, 1, 0.68, 1] },
  { name: 'in-out cubic', curve: [0.65, 0, 0.35, 1] },
  { name: 'out quint', curve: [0.22, 1, 0.36, 1] },
  { name: 'in back', curve: [0.36, 0, 0.66, -0.56] },
  { name: 'out back', curve: [0.34, 1.56, 0.64, 1] },
  { name: 'in-out back', curve: [0.68, -0.6, 0.32, 1.6] },
]

const round = (v: number) => +v.toFixed(2)

/** CSS text for a curve, using the keyword when it is one. */
export function format(curve: Bezier): string {
  const rounded = curve.map(round) as Bezier
  for (const [name, k] of Object.entries(keywords)) {
    if (k.every((v, i) => v === rounded[i])) return name
  }
  return `cubic-bezier(${rounded.join(', ')})`
}

/** Parse a keyword or cubic-bezier(...); null if invalid (x values must be within 0–1). */
export function parse(text: string): Bezier | null {
  const trimmed = text.trim().toLowerCase().replace(/;$/, '')
  if (keywords[trimmed]) return [...keywords[trimmed]]
  const m = /^cubic-bezier\(([^)]*)\)$/.exec(trimmed)
  if (!m) return null
  const values = m[1].split(',').map((v) => Number(v.trim()))
  if (values.length !== 4 || values.some((v) => !Number.isFinite(v))) return null
  if (values[0] < 0 || values[0] > 1 || values[2] < 0 || values[2] > 1) return null
  return values as Bezier
}

/** How far the curve overshoots above 1 or undershoots below 0 (0 when it doesn't). */
export function overshoot(curve: Bezier): { above: number; below: number } {
  let max = 1
  let min = 0
  for (let i = 1; i < 200; i++) {
    const [, y] = point(curve, i / 200)
    max = Math.max(max, y)
    min = Math.min(min, y)
  }
  return { above: Math.max(0, max - 1), below: Math.max(0, -min) }
}
