/**
 * Disney's 12 principles of animation, applied to one hopping ball. `pose(t, on)` says where
 * the ball is and how it's deformed at time t; every principle that's switched off removes
 * its contribution, so you can feel what each one adds.
 */
export const PRINCIPLES = [
  { key: 'squash', name: 'Squash & stretch', hint: 'The ball flattens on impact and stretches with speed, keeping its volume.' },
  { key: 'anticipation', name: 'Anticipation', hint: 'A crouch before the jump tells you something is about to happen.' },
  { key: 'staging', name: 'Staging', hint: 'A clear silhouette and a spotlight; without it the ball gets lost in clutter.' },
  { key: 'poseToPose', name: 'Straight ahead & pose to pose', hint: 'Shows the key poses (ghosts) the motion is planned between.' },
  { key: 'followThrough', name: 'Follow-through & overlap', hint: 'The antenna lags behind and keeps wobbling after the body stops.' },
  { key: 'slowInOut', name: 'Slow in & slow out', hint: 'Motion eases out of and into each pose instead of moving at constant speed.' },
  { key: 'arcs', name: 'Arcs', hint: 'Things travel along curves, not straight lines.' },
  { key: 'secondary', name: 'Secondary action', hint: 'Blinks and dust puffs support the main action without stealing it.' },
  { key: 'timing', name: 'Timing', hint: 'Short crouch, long hang time, quick impact: durations give weight.' },
  { key: 'exaggeration', name: 'Exaggeration', hint: 'Push everything a bit further than real life so it reads.' },
  { key: 'solidDrawing', name: 'Solid drawing', hint: 'Shading and a contact shadow make it feel round and grounded.' },
  { key: 'appeal', name: 'Appeal', hint: 'A face and a pleasing design make you care about the ball.' },
] as const

export type Principle = (typeof PRINCIPLES)[number]['key']
export type Options = Record<Principle, boolean>

export const allOn = (): Options => Object.fromEntries(PRINCIPLES.map((p) => [p.key, true])) as Options
export const allOff = (): Options => Object.fromEntries(PRINCIPLES.map((p) => [p.key, false])) as Options

/** Seconds per hop. */
export const HOP = 1.5

export type Phase = 'anticipation' | 'air' | 'impact' | 'settle'

/** How a hop's time is split. Good timing: short crouch, long hang, quick impact. Bad: even quarters. */
export function phases(on: Options): [Phase, number][] {
  return on.timing
    ? [
        ['anticipation', 0.22],
        ['air', 0.5],
        ['impact', 0.08],
        ['settle', 0.2],
      ]
    : [
        ['anticipation', 0.25],
        ['air', 0.25],
        ['impact', 0.25],
        ['settle', 0.25],
      ]
}

export interface Pose {
  /** 0…1 across the stage. */
  x: number
  /** Height above the ground, 0…~0.6 of the stage height. */
  y: number
  /** Scale along / across the direction of motion (squash & stretch). */
  sx: number
  sy: number
  /** Radians: the stretch axis follows the velocity. */
  angle: number
  /** Antenna angle in radians (follow-through). */
  antenna: number
  /** 0 = eyes open, 1 = closed. */
  blink: number
  /** Which way it's heading: 1 right, -1 left. */
  facing: 1 | -1
  phase: Phase
  /** Seconds since the last landing; dust puffs use it. */
  sinceLanding: number
}

const easeInOut = (u: number) => 0.5 - Math.cos(Math.PI * u) / 2
const clamp01 = (u: number) => Math.max(0, Math.min(1, u))

/** Where in the cycle t falls: which hop, which phase, and progress u through that phase. */
export function locate(t: number, on: Options): { hop: number; phase: Phase; u: number; start: number } {
  const hop = Math.floor(t / HOP)
  let local = (t - hop * HOP) / HOP
  let start = hop * HOP
  for (const [phase, share] of phases(on)) {
    if (local < share || phase === 'settle') return { hop, phase, u: clamp01(local / share), start }
    local -= share
    start += share * HOP
  }
  throw new Error('unreachable')
}

/** The path during the jump: a parabola (arcs) or two straight segments. p is progress 0…1. */
function path(p: number, on: Options, height: number) {
  return on.arcs ? height * 4 * p * (1 - p) : height * (1 - Math.abs(2 * p - 1))
}

export function pose(t: number, on: Options): Pose {
  const ex = on.exaggeration ? 1.7 : 1
  const height = on.exaggeration ? 0.62 : 0.42
  const { hop, phase, u } = locate(t, on)
  // Hop back and forth between two spots.
  const facing: 1 | -1 = hop % 2 === 0 ? 1 : -1
  const [from, to] = facing === 1 ? [0.2, 0.8] : [0.8, 0.2]
  const airShare = phases(on).find(([p]) => p === 'air')![1]
  const airTime = airShare * HOP

  let x = from
  let y = 0
  let sx = 1
  let sy = 1
  let angle = 0
  let antenna = 0
  let sinceLanding = 99

  if (phase === 'anticipation') {
    // Crouch down and lean back, then spring up at the end.
    const crouch = on.anticipation ? Math.sin(Math.PI * clamp01(u * 1.15)) : 0
    if (on.squash) {
      sy = 1 - 0.22 * ex * crouch
      sx = 1 / sy
    }
    antenna = on.followThrough ? -0.25 * crouch * facing : 0
  } else if (phase === 'air') {
    const p = on.slowInOut ? easeInOut(u) : u
    x = from + (to - from) * p
    y = path(p, on, height)
    // Velocity from a small step along the same curve, for stretch direction and amount.
    const e = 0.01
    const p2 = on.slowInOut ? easeInOut(Math.min(1, u + e)) : Math.min(1, u + e)
    const vx = ((to - from) * (p2 - p)) / (e * airTime)
    const vy = (path(p2, on, height) - y) / (e * airTime)
    const speed = Math.hypot(vx, vy)
    if (on.squash) {
      sx = 1 + Math.min(0.35, 0.09 * speed) * ex
      sy = 1 / sx
      angle = Math.atan2(-vy, vx)
    }
    antenna = on.followThrough ? Math.max(-0.9, Math.min(0.9, vy * 0.35)) * -1 + 0.15 * facing : 0
  } else {
    x = to
    const impactShare = phases(on)[2][1]
    const elapsed = phase === 'impact' ? u * impactShare * HOP : impactShare * HOP + u * phases(on)[3][1] * HOP
    sinceLanding = elapsed
    if (on.squash) {
      if (phase === 'impact') {
        // Flatten fast, then start recovering.
        const k = Math.sin(Math.PI * u)
        sy = 1 - 0.38 * ex * k
        sx = 1 / Math.sqrt(sy)
      } else {
        // A small rebound overshoot as it settles.
        const k = Math.exp(-5 * u) * Math.sin(Math.PI * 2 * u)
        sy = 1 + 0.08 * ex * k
        sx = 1 / sy
      }
    }
    antenna = on.followThrough ? 0.7 * facing * Math.exp(-4.5 * elapsed) * Math.cos(16 * elapsed) : 0
  }

  // Blink once per hop, mid-settle (secondary action).
  const blink = on.secondary && phase === 'settle' ? Math.max(0, 1 - Math.abs(u - 0.5) * 10) : 0

  return { x, y, sx, sy, angle, antenna, blink, facing, phase, sinceLanding }
}

/** The key poses of one hop, as times: the poses an animator would draw first. */
export function keyTimes(on: Options, hop = 0): number[] {
  const [a, air, impact] = phases(on).map(([, share]) => share * HOP)
  const t0 = hop * HOP
  return [t0, t0 + a * 0.85, t0 + a + air * 0.5, t0 + a + air + impact * 0.5]
}
