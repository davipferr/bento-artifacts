import type { Noise3D } from '../../kit/noise'

/**
 * A flow field: every point of the plane gets a direction from smooth noise, and particles
 * follow it like dust in the wind. Each particle remembers its previous position so the
 * painter can draw the short segment it just travelled.
 */

export interface FlowParams {
  /** Noise frequency per pixel: smaller = broader, calmer currents. */
  scale: number
  /** How many half-turns the noise range maps to: higher = more swirling. */
  turbulence: number
  /** Pixels per step. */
  speed: number
}

export class Particles {
  readonly x: Float32Array
  readonly y: Float32Array
  /** Previous position; NaN right after a respawn, so no line is drawn across the canvas. */
  readonly px: Float32Array
  readonly py: Float32Array
  readonly life: Float32Array
  /** Direction of the latest step, for colouring by angle. */
  readonly angle: Float32Array

  constructor(
    readonly count: number,
    width: number,
    height: number,
    random: () => number,
  ) {
    this.x = new Float32Array(count)
    this.y = new Float32Array(count)
    this.px = new Float32Array(count)
    this.py = new Float32Array(count)
    this.life = new Float32Array(count)
    this.angle = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      this.respawn(i, width, height, random)
      this.life[i] *= random() // stagger lifetimes so they don't all respawn together
    }
  }

  respawn(i: number, width: number, height: number, random: () => number, at?: { x: number; y: number; radius: number }) {
    if (at) {
      const a = random() * Math.PI * 2
      const r = Math.sqrt(random()) * at.radius
      this.x[i] = at.x + Math.cos(a) * r
      this.y[i] = at.y + Math.sin(a) * r
    } else {
      this.x[i] = random() * width
      this.y[i] = random() * height
    }
    this.px[i] = NaN
    this.py[i] = NaN
    this.life[i] = 60 + random() * 240
  }
}

export const fieldAngle = (noise: Noise3D, x: number, y: number, z: number, p: FlowParams) =>
  noise(x * p.scale, y * p.scale, z) * Math.PI * p.turbulence

/** Advance every particle one step along the field. */
export function step(
  ps: Particles,
  noise: Noise3D,
  z: number,
  p: FlowParams,
  width: number,
  height: number,
  random: () => number,
) {
  for (let i = 0; i < ps.count; i++) {
    const x = ps.x[i]
    const y = ps.y[i]
    if (ps.life[i] <= 0 || x < 0 || y < 0 || x >= width || y >= height) {
      ps.respawn(i, width, height, random)
      continue
    }
    const a = fieldAngle(noise, x, y, z, p)
    ps.px[i] = x
    ps.py[i] = y
    ps.x[i] = x + Math.cos(a) * p.speed
    ps.y[i] = y + Math.sin(a) * p.speed
    ps.angle[i] = a
    ps.life[i] -= 1
  }
}

export interface Palette {
  name: string
  background: string
  colors: string[]
  /** Line opacity: lower on light paper so ink builds up gradually. */
  alpha: number
}

export const palettes: Palette[] = [
  { name: 'Ink', background: '#f3eee3', colors: ['#1b1b1f', '#2f3e46', '#7c3a2d'], alpha: 0.07 },
  { name: 'Ember', background: '#0f0a0a', colors: ['#ff7b00', '#ffb703', '#d00000', '#fb5607'], alpha: 0.12 },
  { name: 'Ocean', background: '#04131c', colors: ['#00b4d8', '#90e0ef', '#0077b6', '#48cae4'], alpha: 0.12 },
  { name: 'Neon', background: '#0a0a12', colors: ['#ff2e88', '#00f5d4', '#c6ff00', '#7b61ff'], alpha: 0.12 },
  { name: 'Forest', background: '#0e1a12', colors: ['#95d5b2', '#52b788', '#d8f3dc', '#e9c46a'], alpha: 0.11 },
]

export type ColorMode = 'angle' | 'particle' | 'height'

/** Which palette colour a particle uses this step. */
export function colorIndex(ps: Particles, i: number, mode: ColorMode, colors: number, height: number): number {
  switch (mode) {
    case 'angle': {
      const turn = ps.angle[i] / (Math.PI * 2)
      return Math.floor((((turn % 1) + 1) % 1) * colors) % colors
    }
    case 'particle':
      return i % colors
    case 'height':
      return Math.min(colors - 1, Math.max(0, Math.floor((ps.y[i] / height) * colors)))
  }
}
