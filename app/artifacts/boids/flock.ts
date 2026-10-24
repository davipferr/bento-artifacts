/**
 * Craig Reynolds' boids (1986): each bird only looks at neighbours within a radius and
 * steers by three rules (separation, alignment, cohesion). The flock is emergent.
 * The world wraps around at the edges, like a torus.
 */
export interface Boid {
  x: number
  y: number
  vx: number
  vy: number
}

export interface Flock {
  boids: Boid[]
  width: number
  height: number
}

export interface Rules {
  separation: number
  alignment: number
  cohesion: number
  /** How far a boid sees, in world units. */
  radius: number
  maxSpeed: number
  /** Cap on steering acceleration, so turns stay smooth. */
  maxForce: number
  /** Random sideways steering, as a fraction of `maxForce`: keeps the flock restless. */
  wander: number
  /** Optional point that every boid within `radius * 3` flees (positive) or seeks (negative). */
  lure?: { x: number; y: number; strength: number }
}

export const defaultRules: Rules = { separation: 1.6, alignment: 1, cohesion: 0.8, radius: 50, maxSpeed: 140, maxForce: 260, wander: 0 }

export function createFlock(n: number, width: number, height: number, random = Math.random): Flock {
  const boids = Array.from({ length: n }, () => {
    const a = random() * Math.PI * 2
    const speed = 60 + random() * 60
    return { x: random() * width, y: random() * height, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed }
  })
  return { boids, width, height }
}

/** Shortest offset from a to b on a wrapped axis of the given size. */
export const wrapDelta = (d: number, size: number) => d - size * Math.round(d / size)

/**
 * Bucket boids into square cells of side `radius`, so a neighbour search only checks the
 * 3×3 cells around a boid instead of the whole flock.
 */
export function buildGrid(flock: Flock, radius: number) {
  const cols = Math.max(1, Math.floor(flock.width / radius))
  const rows = Math.max(1, Math.floor(flock.height / radius))
  const cells: number[][] = Array.from({ length: cols * rows }, () => [])
  const cellOf = (b: Boid) => {
    const cx = Math.min(cols - 1, Math.floor((b.x / flock.width) * cols))
    const cy = Math.min(rows - 1, Math.floor((b.y / flock.height) * rows))
    return [cx, cy] as const
  }
  flock.boids.forEach((b, i) => {
    const [cx, cy] = cellOf(b)
    cells[cy * cols + cx].push(i)
  })

  /** Indices of every other boid within `radius` (wrapped distance) of boid `i`. */
  const neighbors = (i: number): number[] => {
    const b = flock.boids[i]
    const [cx, cy] = cellOf(b)
    const seen = new Set<number>()
    const out: number[] = []
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const key = (((cy + dy) % rows) + rows) % rows * cols + ((((cx + dx) % cols) + cols) % cols)
        if (seen.has(key)) continue // tiny worlds: the 3×3 window can revisit a cell
        seen.add(key)
        for (const j of cells[key]) {
          if (j === i) continue
          const o = flock.boids[j]
          if (Math.hypot(wrapDelta(o.x - b.x, flock.width), wrapDelta(o.y - b.y, flock.height)) < radius) out.push(j)
        }
      }
    }
    return out
  }
  return { neighbors }
}

const limit = (x: number, y: number, max: number): [number, number] => {
  const m = Math.hypot(x, y)
  return m > max ? [(x / m) * max, (y / m) * max] : [x, y]
}

/** Steer toward `desired` velocity: Reynolds' "steering = desired − velocity". */
const steer = (b: Boid, dx: number, dy: number, rules: Rules): [number, number] => {
  const m = Math.hypot(dx, dy)
  if (m === 0) return [0, 0]
  return limit((dx / m) * rules.maxSpeed - b.vx, (dy / m) * rules.maxSpeed - b.vy, rules.maxForce)
}

/** Advance the flock by `dt` seconds. Forces are computed from the old state, then applied. */
export function step(flock: Flock, rules: Rules, dt: number, random = Math.random) {
  const { boids, width, height } = flock
  const grid = buildGrid(flock, rules.radius)
  const forces = boids.map((b, i) => {
    const near = grid.neighbors(i)
    let fx = 0
    let fy = 0
    if (near.length) {
      let sx = 0, sy = 0, ax = 0, ay = 0, cx = 0, cy = 0
      for (const j of near) {
        const o = boids[j]
        const dx = wrapDelta(o.x - b.x, width)
        const dy = wrapDelta(o.y - b.y, height)
        const d2 = Math.max(1e-6, dx * dx + dy * dy)
        // Only crowding neighbours (inside half the vision) push away, closer ones harder.
        if (d2 < (rules.radius * rules.radius) / 4) {
          sx -= dx / d2
          sy -= dy / d2
        }
        ax += o.vx
        ay += o.vy
        cx += dx
        cy += dy
      }
      const [s1, s2] = steer(b, sx, sy, rules)
      const [a1, a2] = steer(b, ax, ay, rules)
      const [c1, c2] = steer(b, cx, cy, rules)
      fx += s1 * rules.separation + a1 * rules.alignment + c1 * rules.cohesion
      fy += s2 * rules.separation + a2 * rules.alignment + c2 * rules.cohesion
    }
    if (rules.wander) {
      const speed = Math.hypot(b.vx, b.vy) || 1
      const k = (random() * 2 - 1) * rules.wander * rules.maxForce
      fx += (-b.vy / speed) * k
      fy += (b.vx / speed) * k
    }
    if (rules.lure) {
      const dx = wrapDelta(b.x - rules.lure.x, width)
      const dy = wrapDelta(b.y - rules.lure.y, height)
      const d = Math.hypot(dx, dy)
      if (d < rules.radius * 3 && d > 0) {
        const [l1, l2] = steer(b, dx, dy, rules)
        const k = rules.lure.strength * (1 - d / (rules.radius * 3))
        fx += l1 * k
        fy += l2 * k
      }
    }
    return [fx, fy] as const
  })

  boids.forEach((b, i) => {
    const [vx, vy] = limit(b.vx + forces[i][0] * dt, b.vy + forces[i][1] * dt, rules.maxSpeed)
    // A minimum speed keeps boids from stalling in place when the forces cancel out.
    const speed = Math.hypot(vx, vy)
    const min = rules.maxSpeed * 0.35
    b.vx = speed < min && speed > 0 ? (vx / speed) * min : vx
    b.vy = speed < min && speed > 0 ? (vy / speed) * min : vy
    b.x = (((b.x + b.vx * dt) % width) + width) % width
    b.y = (((b.y + b.vy * dt) % height) + height) % height
  })
}

/**
 * The polarization order parameter: length of the mean heading. 1 = everyone flies the same
 * way, ~0 = random directions.
 */
export function order(flock: Flock) {
  let x = 0
  let y = 0
  for (const b of flock.boids) {
    const m = Math.hypot(b.vx, b.vy) || 1
    x += b.vx / m
    y += b.vy / m
  }
  return flock.boids.length ? Math.hypot(x, y) / flock.boids.length : 0
}

/** Mean distance from each boid to its nearest neighbour. */
export function meanNearest(flock: Flock) {
  const { boids, width, height } = flock
  if (boids.length < 2) return 0
  let sum = 0
  for (const b of boids) {
    let best = Infinity
    for (const o of boids) {
      if (o === b) continue
      best = Math.min(best, Math.hypot(wrapDelta(o.x - b.x, width), wrapDelta(o.y - b.y, height)))
    }
    sum += best
  }
  return sum / boids.length
}
