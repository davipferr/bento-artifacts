/**
 * The double pendulum: two rigid massless rods, point masses at their ends, no friction.
 * Angles are measured from straight down, counter-clockwise positive; SI units throughout.
 */
export interface State {
  t1: number
  t2: number
  w1: number
  w2: number
}

export interface Params {
  m1: number
  m2: number
  l1: number
  l2: number
  g: number
}

export const defaults: Params = { m1: 1, m2: 1, l1: 1, l2: 1, g: 9.81 }

/** Angular accelerations from the Lagrangian equations of motion. */
export function accelerations({ t1, t2, w1, w2 }: State, { m1, m2, l1, l2, g }: Params): [number, number] {
  const d = t1 - t2
  const den = 2 * m1 + m2 - m2 * Math.cos(2 * d)
  const a1 =
    (-g * (2 * m1 + m2) * Math.sin(t1) - m2 * g * Math.sin(t1 - 2 * t2) - 2 * Math.sin(d) * m2 * (w2 * w2 * l2 + w1 * w1 * l1 * Math.cos(d))) /
    (l1 * den)
  const a2 = (2 * Math.sin(d) * (w1 * w1 * l1 * (m1 + m2) + g * (m1 + m2) * Math.cos(t1) + w2 * w2 * l2 * m2 * Math.cos(d))) / (l2 * den)
  return [a1, a2]
}

/** One classic fourth-order Runge–Kutta step, in place. */
export function step(s: State, p: Params, dt: number) {
  const { t1, t2, w1, w2 } = s
  const [a1, b1] = accelerations(s, p)
  const k2s = { t1: t1 + (w1 * dt) / 2, t2: t2 + (w2 * dt) / 2, w1: w1 + (a1 * dt) / 2, w2: w2 + (b1 * dt) / 2 }
  const [a2, b2] = accelerations(k2s, p)
  const k3s = { t1: t1 + (k2s.w1 * dt) / 2, t2: t2 + (k2s.w2 * dt) / 2, w1: w1 + (a2 * dt) / 2, w2: w2 + (b2 * dt) / 2 }
  const [a3, b3] = accelerations(k3s, p)
  const k4s = { t1: t1 + k3s.w1 * dt, t2: t2 + k3s.w2 * dt, w1: w1 + a3 * dt, w2: w2 + b3 * dt }
  const [a4, b4] = accelerations(k4s, p)
  s.t1 += (dt / 6) * (w1 + 2 * k2s.w1 + 2 * k3s.w1 + k4s.w1)
  s.t2 += (dt / 6) * (w2 + 2 * k2s.w2 + 2 * k3s.w2 + k4s.w2)
  s.w1 += (dt / 6) * (a1 + 2 * a2 + 2 * a3 + a4)
  s.w2 += (dt / 6) * (b1 + 2 * b2 + 2 * b3 + b4)
}

/** Advance by `time` seconds in substeps no longer than `maxDt`. */
export function advance(s: State, p: Params, time: number, maxDt = 1 / 600) {
  const n = Math.max(1, Math.ceil(time / maxDt))
  for (let i = 0; i < n; i++) step(s, p, time / n)
}

/** Bob positions relative to the pivot, y pointing down (screen coordinates). */
export function positions({ t1, t2 }: State, { l1, l2 }: Params) {
  const x1 = l1 * Math.sin(t1)
  const y1 = l1 * Math.cos(t1)
  return { x1, y1, x2: x1 + l2 * Math.sin(t2), y2: y1 + l2 * Math.cos(t2) }
}

/** Total mechanical energy, zero with both rods hanging straight down. */
export function energy(s: State, p: Params) {
  const { t1, t2, w1, w2 } = s
  const { m1, m2, l1, l2, g } = p
  const kinetic = 0.5 * m1 * l1 * l1 * w1 * w1 + 0.5 * m2 * (l1 * l1 * w1 * w1 + l2 * l2 * w2 * w2 + 2 * l1 * l2 * w1 * w2 * Math.cos(t1 - t2))
  const { y1, y2 } = positions(s, p)
  const potential = m1 * g * (l1 - y1) + m2 * g * (l1 + l2 - y2)
  return kinetic + potential
}

/** Wrap an angle difference into (-π, π]. */
export const wrap = (a: number) => a - 2 * Math.PI * Math.round(a / (2 * Math.PI))

/** Distance between two states in phase space, with angles compared on the circle. */
export function separation(a: State, b: State) {
  return Math.hypot(wrap(a.t1 - b.t1), wrap(a.t2 - b.t2), a.w1 - b.w1, a.w2 - b.w2)
}

/**
 * `n` copies of a starting state whose second angle differs by `spread` radians in total,
 * evenly spaced: the butterfly effect, made visible.
 */
export function ensemble(start: State, n: number, spread: number): State[] {
  return Array.from({ length: n }, (_, i) => ({ ...start, t2: start.t2 + (n > 1 ? (i / (n - 1) - 0.5) * spread : 0) }))
}
