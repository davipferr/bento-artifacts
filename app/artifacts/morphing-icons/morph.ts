/**
 * Morphing one icon into another by moving points. That only works when both shapes have
 * the same structure: the same number of sub-shapes, each with the same number of points,
 * starting in matching places. Hand-made pairs are drawn that way; arbitrary outlines get
 * resampled to equal counts and rotated so their start points line up.
 */
export type Pt = [number, number]

export interface Shape {
  points: Pt[]
  /** Closed shapes are filled; open ones are stroked lines. */
  closed: boolean
}

export type Icon = Shape[]

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export function lerpIcon(a: Icon, b: Icon, t: number): Icon {
  if (a.length !== b.length) throw new Error('Icons need the same number of shapes')
  return a.map((shape, i) => {
    const other = b[i]
    if (shape.points.length !== other.points.length) throw new Error(`Shape ${i} has ${shape.points.length} vs ${other.points.length} points`)
    return { closed: shape.closed, points: shape.points.map(([x, y], j) => [lerp(x, other.points[j][0], t), lerp(y, other.points[j][1], t)] as Pt) }
  })
}

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1])

/** Twice the signed area: positive for one winding direction, negative for the other. */
export function signedArea(points: Pt[]): number {
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i]
    const [x2, y2] = points[(i + 1) % points.length]
    sum += x1 * y2 - x2 * y1
  }
  return sum
}

/** `n` points evenly spaced by arc length along a closed outline. */
export function resample(points: Pt[], n: number): Pt[] {
  const edges = points.map((p, i) => dist(p, points[(i + 1) % points.length]))
  const total = edges.reduce((s, e) => s + e, 0)
  const out: Pt[] = []
  let edge = 0
  let walked = 0
  for (let k = 0; k < n; k++) {
    const target = (k / n) * total
    while (edge < edges.length - 1 && walked + edges[edge] < target) walked += edges[edge++]
    const a = points[edge]
    const b = points[(edge + 1) % points.length]
    const f = edges[edge] ? (target - walked) / edges[edge] : 0
    out.push([lerp(a[0], b[0], f), lerp(a[1], b[1], f)])
  }
  return out
}

/** Sum of squared distances between matching points. */
export const cost = (a: Pt[], b: Pt[]) => a.reduce((s, p, i) => s + dist(p, b[i]) ** 2, 0)

/**
 * Re-order `b` (same length as `a`) so that point i of each lands close together: match the
 * winding direction, then try every starting index and keep the cheapest.
 */
export function align(a: Pt[], b: Pt[]): Pt[] {
  const base = Math.sign(signedArea(a)) !== Math.sign(signedArea(b)) ? [...b].reverse() : b
  let best = base
  let bestCost = Infinity
  for (let shift = 0; shift < base.length; shift++) {
    const rotated = [...base.slice(shift), ...base.slice(0, shift)]
    const c = cost(a, rotated)
    if (c < bestCost) {
      bestCost = c
      best = rotated
    }
  }
  return best
}

/**
 * Make two single-outline icons morphable. `matched` resamples and aligns; without it the
 * shorter outline is padded by repeating its last point, which is what a naive morph does.
 */
export function prepare(a: Pt[], b: Pt[], matched: boolean, n = 64): [Icon, Icon] {
  if (matched) {
    const ra = resample(a, n)
    return [[{ closed: true, points: ra }], [{ closed: true, points: align(ra, resample(b, n)) }]]
  }
  const len = Math.max(a.length, b.length)
  const pad = (p: Pt[]) => [...p, ...Array.from({ length: len - p.length }, () => p[p.length - 1])]
  return [[{ closed: true, points: pad(a) }], [{ closed: true, points: pad(b) }]]
}

export function toPath(shape: Shape): string {
  const [first, ...rest] = shape.points
  if (!first) return ''
  const f = (n: number) => Math.round(n * 100) / 100
  return `M${f(first[0])} ${f(first[1])}${rest.map(([x, y]) => `L${f(x)} ${f(y)}`).join('')}${shape.closed ? 'Z' : ''}`
}

export const EASINGS = {
  linear: (t: number) => t,
  easeInOut: (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
  overshoot: (t: number) => {
    const c = 1.70158 * 1.3
    return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2
  },
} as const

export type Easing = keyof typeof EASINGS

// ---- The icons (24 × 24 grid) ------------------------------------------------

const line = (...points: Pt[]): Shape => ({ points, closed: false })
const poly = (...points: Pt[]): Shape => ({ points, closed: true })

function heart(n = 40): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2
    const x = 16 * Math.sin(t) ** 3
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
    return [12 + x * 0.5, 11 - y * 0.5] as Pt
  })
}
function star(points = 5): Pt[] {
  return Array.from({ length: points * 2 }, (_, i) => {
    const r = i % 2 ? 4.2 : 10
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2
    return [12 + r * Math.cos(a), 12.6 + r * Math.sin(a)] as Pt
  })
}
const circle = (n = 24): Pt[] => Array.from({ length: n }, (_, i) => [12 + 8 * Math.cos((i / n) * Math.PI * 2), 12 + 8 * Math.sin((i / n) * Math.PI * 2)] as Pt)
const square: Pt[] = [
  [5, 5],
  [19, 5],
  [19, 19],
  [5, 19],
]

export interface Pair {
  id: string
  label: [string, string]
  /** Hand-matched pairs; outline pairs are built by `prepare`. */
  a?: Icon
  b?: Icon
  outlines?: [Pt[], Pt[]]
}

export const PAIRS: Pair[] = [
  {
    id: 'play-pause',
    label: ['Play', 'Pause'],
    // The triangle is split into two quads (the right one has a doubled tip) so each becomes a bar.
    a: [poly([6, 4], [13, 8], [13, 16], [6, 20]), poly([13, 8], [20, 12], [20, 12], [13, 16])],
    b: [poly([6, 4], [10, 4], [10, 20], [6, 20]), poly([14, 4], [18, 4], [18, 20], [14, 20])],
  },
  {
    id: 'menu-close',
    label: ['Menu', 'Close'],
    // Top and bottom bars swing into an X; the middle one shrinks to nothing.
    a: [line([4, 6], [20, 6]), line([4, 12], [20, 12]), line([4, 18], [20, 18])],
    b: [line([5, 5], [19, 19]), line([12, 12], [12, 12]), line([5, 19], [19, 5])],
  },
  {
    id: 'check-cross',
    label: ['Check', 'Cross'],
    a: [line([4, 12.5], [9.5, 18]), line([9.5, 18], [20, 6])],
    b: [line([6, 6], [18, 18]), line([6, 18], [18, 6])],
  },
  {
    id: 'plus-minus',
    label: ['Plus', 'Minus'],
    a: [line([5, 12], [19, 12]), line([12, 5], [12, 19])],
    b: [line([5, 12], [19, 12]), line([19, 12], [5, 12])],
  },
  { id: 'circle-square', label: ['Circle', 'Square'], outlines: [circle(), square] },
  { id: 'heart-star', label: ['Heart', 'Star'], outlines: [heart(), star()] },
]

/** Both ends of a pair, ready to lerp. */
export function ends(pair: Pair, matched: boolean): [Icon, Icon] {
  if (pair.outlines) return prepare(pair.outlines[0], pair.outlines[1], matched)
  return [pair.a!, pair.b!]
}
