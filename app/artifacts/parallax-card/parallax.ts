/**
 * The maths behind a tilt card: pointer or device tilt → a normalised position, → rotation,
 * smoothed over time, plus the per-layer offsets for a 2D (no-3D) fallback and the glare.
 */
export interface Norm {
  /** -1 (left) … 1 (right) */
  nx: number
  /** -1 (top) … 1 (bottom) */
  ny: number
}

export const clamp = (v: number, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, v))

/** Where the pointer is over a box, from -1 to 1 on each axis, clamped at the edges. */
export function pointerToNorm(x: number, y: number, width: number, height: number): Norm {
  return { nx: clamp((x / width) * 2 - 1), ny: clamp((y / height) * 2 - 1) }
}

/**
 * Phone tilt to the same range. `gamma` is left/right (-90…90), `beta` front/back (-180…180);
 * people hold a phone at roughly 45° so that is the rest position.
 */
export function orientationToNorm(beta: number, gamma: number, range = 25, rest = 45): Norm {
  return { nx: clamp(gamma / range), ny: clamp((beta - rest) / range) }
}

/**
 * Rotation in degrees. By default the side under the pointer presses away from you, as if you
 * were pushing it; `invert` makes it lean towards the pointer instead.
 */
export function tiltFor({ nx, ny }: Norm, max: number, invert = false): { rx: number; ry: number } {
  const s = invert ? -1 : 1
  return { rx: -ny * max * s || 0, ry: nx * max * s || 0 }
}

/**
 * Frame-rate independent smoothing towards a target. `smoothing` 0 snaps, 1 is very lazy.
 * The same input gives the same motion at 30, 60 or 120 fps.
 */
export function follow(current: number, target: number, dt: number, smoothing: number): number {
  if (smoothing <= 0) return target
  const rate = 4 + (1 - smoothing) * 36
  return target + (current - target) * Math.exp(-rate * dt)
}

/** The 2D fallback: no rotation, deeper layers slide further against the pointer. */
export function layerShift({ nx, ny }: Norm, depth: number, strength: number): { x: number; y: number } {
  return { x: -nx * depth * strength * 0.25 || 0, y: -ny * depth * strength * 0.25 || 0 }
}

/** The highlight sits opposite the side that tilts away, and brightens the further you tilt. */
export function glare({ nx, ny }: Norm): { x: number; y: number; opacity: number } {
  return { x: 50 - nx * 50, y: 50 - ny * 50, opacity: Math.min(1, Math.hypot(nx, ny)) * 0.35 }
}

export const toCss = (rx: number, ry: number, perspective: number) =>
  `perspective(${Math.round(perspective)}px) rotateX(${rx.toFixed(1)}deg) rotateY(${ry.toFixed(1)}deg)`
