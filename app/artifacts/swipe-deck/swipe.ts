/**
 * The physics of a swipeable card: velocity from recent pointer samples, the release
 * decision (far enough, or flicked fast enough), rotation that depends on where you grabbed,
 * a damped spring for snapping back, and the exit path for a throw.
 */
export interface Sample {
  /** Milliseconds. */
  t: number
  x: number
  y: number
}

export type Verdict = 'left' | 'right' | 'up' | null

export interface Rules {
  /** Fraction of the card width you must drag past to decide on distance alone. */
  distance: number
  /** Release speed (px/s) that counts as a flick even when the card hasn't gone far. */
  flick: number
}

/**
 * Velocity in px/s over the last `window` ms of samples. If the pointer paused before the
 * release, the window holds a single sample and the velocity is zero, as it should be.
 */
export function velocity(samples: Sample[], window = 90): { vx: number; vy: number } {
  if (samples.length < 2) return { vx: 0, vy: 0 }
  const last = samples[samples.length - 1]
  let first = last
  for (let i = samples.length - 2; i >= 0 && last.t - samples[i].t <= window; i--) first = samples[i]
  const dt = (last.t - first.t) / 1000
  if (dt <= 0) return { vx: 0, vy: 0 }
  return { vx: (last.x - first.x) / dt, vy: (last.y - first.y) / dt }
}

/** What releasing the card right now would do. */
export function decide(dx: number, dy: number, vx: number, vy: number, width: number, rules: Rules): Verdict {
  const reach = rules.distance * width
  const speed = Math.hypot(vx, vy)
  // Up wins when the motion is mostly vertical.
  if (-dy > Math.abs(dx) && (-dy > reach || (speed > rules.flick && -vy > Math.abs(vx)))) return 'up'
  if (Math.abs(dx) > reach) return dx > 0 ? 'right' : 'left'
  // A flick only counts if it isn't moving back against where the card already is.
  if (Math.abs(vx) > rules.flick && Math.abs(vx) > Math.abs(vy) && (Math.sign(vx) === Math.sign(dx) || Math.abs(dx) < 24)) {
    return vx > 0 ? 'right' : 'left'
  }
  return null
}

/**
 * Degrees of tilt. Grab above the centre and the card swings like it's pinned at the bottom;
 * grab below and it swings the other way, which is what a real card in your hand does.
 */
export function rotation(dx: number, width: number, grabY: number, maxDeg: number): number {
  const side = grabY > 0.15 ? -1 : 1
  const deg = (dx / width) * maxDeg * 2 * side
  return Math.max(-maxDeg * 1.5, Math.min(maxDeg * 1.5, deg))
}

/** -1 (nope) … 1 (like), and 0…1 for up: how close the card is to deciding by distance. */
export function progress(dx: number, dy: number, width: number, distance: number): { x: number; up: number } {
  const reach = distance * width
  return {
    x: Math.max(-1, Math.min(1, dx / reach)),
    up: Math.max(0, Math.min(1, -dy / reach)) * (-dy > Math.abs(dx) ? 1 : 0),
  }
}

/** One step of a damped spring pulling `x` toward `target` (unit mass, semi-implicit Euler, sub-stepped). */
export function springStep(x: number, v: number, target: number, stiffness: number, damping: number, dt: number): [number, number] {
  const steps = Math.max(1, Math.ceil(dt / (1 / 240)))
  const h = dt / steps
  for (let i = 0; i < steps; i++) {
    v += (-stiffness * (x - target) - damping * v) * h
    x += v * h
  }
  return [x, v]
}

/** Settled when both the distance and the speed are tiny. */
export const atRest = (x: number, v: number, target = 0) => Math.abs(x - target) < 0.3 && Math.abs(v) < 4

/**
 * The velocity a released card flies off with: along the throw if it was fast enough and
 * roughly in the right direction, otherwise straight out at a minimum speed.
 */
export function exitVelocity(verdict: Exclude<Verdict, null>, vx: number, vy: number, minSpeed = 1600): { vx: number; vy: number } {
  const dir = verdict === 'up' ? { x: 0, y: -1 } : { x: verdict === 'right' ? 1 : -1, y: 0 }
  const along = vx * dir.x + vy * dir.y
  if (along >= minSpeed) return { vx, vy }
  // Keep the sideways part of the throw so the card leaves on the angle you threw it.
  const k = minSpeed - Math.max(0, along)
  return { vx: vx + dir.x * k, vy: vy + dir.y * k }
}
