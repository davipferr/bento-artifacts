/**
 * Any closed drawing, read as complex numbers z = x + iy over time t ∈ [0, 1), is a sum
 * of rotating arrows (epicycles):  z(t) = Σ c_k · e^{2πi k t}.
 * The discrete Fourier transform finds every arrow's length and starting angle.
 */

export type Point = [number, number]

export interface Term {
  /** Turns per cycle; negative spins clockwise. */
  freq: number
  re: number
  im: number
  /** Arrow length. */
  amp: number
  /** Starting angle in radians. */
  phase: number
}

/** `n` points evenly spaced along the closed path (by arc length), so speed is constant. */
export function resample(points: Point[], n: number): Point[] {
  if (points.length < 2) return points.map((p) => [...p] as Point)
  const closed = [...points, points[0]]
  const cumulative = [0]
  for (let i = 1; i < closed.length; i++) {
    cumulative.push(cumulative[i - 1] + Math.hypot(closed[i][0] - closed[i - 1][0], closed[i][1] - closed[i - 1][1]))
  }
  const total = cumulative[cumulative.length - 1]
  if (total === 0) return Array.from({ length: n }, () => [...points[0]] as Point)
  const result: Point[] = []
  let seg = 0
  for (let k = 0; k < n; k++) {
    const target = (k / n) * total
    while (cumulative[seg + 1] < target) seg++
    const span = cumulative[seg + 1] - cumulative[seg] || 1
    const t = (target - cumulative[seg]) / span
    const [x0, y0] = closed[seg]
    const [x1, y1] = closed[seg + 1]
    result.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t])
  }
  return result
}

/** DFT with frequencies -N/2 … N/2-1, sorted by amplitude (biggest arrows first). */
export function dft(points: Point[]): Term[] {
  const n = points.length
  const terms: Term[] = []
  for (let f = -Math.floor(n / 2); f < Math.ceil(n / 2); f++) {
    let re = 0
    let im = 0
    for (let j = 0; j < n; j++) {
      const angle = (-2 * Math.PI * f * j) / n
      const [x, y] = points[j]
      // (x + iy)(cos a + i sin a)
      re += x * Math.cos(angle) - y * Math.sin(angle)
      im += x * Math.sin(angle) + y * Math.cos(angle)
    }
    re /= n
    im /= n
    terms.push({ freq: f, re, im, amp: Math.hypot(re, im), phase: Math.atan2(im, re) })
  }
  return terms.sort((a, b) => b.amp - a.amp)
}

/** The tip of the first `count` arrows at time t, plus every joint along the way. */
export function epicycles(terms: Term[], count: number, t: number): Point[] {
  const joints: Point[] = [[0, 0]]
  let x = 0
  let y = 0
  for (let i = 0; i < Math.min(count, terms.length); i++) {
    const { freq, amp, phase } = terms[i]
    const angle = 2 * Math.PI * freq * t + phase
    x += amp * Math.cos(angle)
    y += amp * Math.sin(angle)
    joints.push([x, y])
  }
  return joints
}

export const reconstruct = (terms: Term[], count: number, t: number): Point => {
  const joints = epicycles(terms, count, t)
  return joints[joints.length - 1]
}

/**
 * Average distance between the original samples and the approximation with `count`
 * arrows, as a fraction of the drawing's size.
 */
export function error(points: Point[], terms: Term[], count: number): number {
  const n = points.length
  if (!n) return 0
  let sum = 0
  for (let j = 0; j < n; j++) {
    const [x, y] = reconstruct(terms, count, j / n)
    sum += Math.hypot(x - points[j][0], y - points[j][1])
  }
  const xs = points.map((p) => p[0])
  const ys = points.map((p) => p[1])
  const size = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) || 1
  return sum / n / size
}

/** Centre on the origin and scale to fit in [-1, 1]. */
export function normalize(points: Point[]): Point[] {
  const xs = points.map((p) => p[0])
  const ys = points.map((p) => p[1])
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2
  const half = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2 || 1
  return points.map(([x, y]) => [(x - cx) / half, (y - cy) / half])
}

const curve = (n: number, f: (t: number) => Point): Point[] =>
  Array.from({ length: n }, (_, i) => f((i / n) * Math.PI * 2))

/** Screen coordinates: y grows downwards, so shapes are written upside down where it matters. */
export const shapes: { name: string; points: Point[] }[] = [
  {
    name: 'Heart',
    points: curve(400, (t) => [16 * Math.sin(t) ** 3, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))]),
  },
  {
    name: 'Star',
    points: Array.from({ length: 10 }, (_, i) => {
      const r = i % 2 ? 0.42 : 1
      const a = -Math.PI / 2 + (i * Math.PI) / 5
      return [r * Math.cos(a), r * Math.sin(a)] as Point
    }),
  },
  { name: 'Square', points: [[-1, -1], [1, -1], [1, 1], [-1, 1]] },
  {
    name: 'Infinity',
    points: curve(400, (t) => {
      const d = 1 + Math.sin(t) ** 2
      return [Math.cos(t) / d, (Math.sin(t) * Math.cos(t)) / d]
    }),
  },
  {
    name: 'Fish',
    points: curve(400, (t) => [Math.cos(t) - Math.sin(t) ** 2 / Math.SQRT2, Math.cos(t) * Math.sin(t)]),
  },
  {
    name: 'Flower',
    points: curve(600, (t) => {
      const r = 0.6 + 0.4 * Math.cos(5 * t)
      return [r * Math.cos(t), r * Math.sin(t)]
    }),
  },
]
