/**
 * Mandelbrot maths shared by the GPU shader (float32) and the CPU deep-zoom renderer
 * (float64): the view transform, escape-time with smooth colouring, and the palettes.
 */

export interface View {
  /** Centre of the screen in the complex plane. */
  cx: number
  cy: number
  /** Complex units per CSS pixel. */
  scale: number
}

export const HOME: View = { cx: -0.6, cy: 0, scale: 3 / 800 }

/** The complex number under a CSS pixel (y grows downwards on screen, upwards in the plane). */
export function toComplex(view: View, px: number, py: number, width: number, height: number): [number, number] {
  return [view.cx + (px - width / 2) * view.scale, view.cy - (py - height / 2) * view.scale]
}

/** Zoom by `factor` (< 1 zooms in) keeping the point under (px, py) fixed. */
export function zoomAt(view: View, px: number, py: number, width: number, height: number, factor: number): View {
  const [re, im] = toComplex(view, px, py, width, height)
  return { cx: re + (view.cx - re) * factor, cy: im + (view.cy - im) * factor, scale: view.scale * factor }
}

export const pan = (view: View, dx: number, dy: number): View => ({ ...view, cx: view.cx - dx * view.scale, cy: view.cy + dy * view.scale })

/** Magnification relative to the home view. */
export const zoomLevel = (view: View) => HOME.scale / view.scale

/**
 * float32 has a 24-bit mantissa: once one pixel is smaller than about 2⁻²³ of the
 * coordinates' size, neighbouring pixels round to the same number and the image breaks
 * into blocks. Past that point the GPU can't help; we switch to 64-bit doubles on the CPU.
 */
export function needsDouble(view: View, dpr = 1): boolean {
  return view.scale / dpr < floatLimit(view)
}

/** Smallest pixel size float32 can still tell apart around the view's centre. */
const floatLimit = (view: View) => Math.max(Math.abs(view.cx), Math.abs(view.cy), 1e-3) * 2 ** -23 * 4

/** The zoom level at which the current spot runs out of float32 precision. */
export const float32ZoomLimit = (view: View, dpr = 1) => HOME.scale / (floatLimit(view) * dpr)

/** Iteration budget that grows with depth: deep zooms need more steps to resolve the edge. */
export const autoIterations = (view: View) => Math.round(Math.min(5000, 120 + 300 * Math.log10(Math.max(1, zoomLevel(view)))))

/**
 * Escape time with smooth colouring: iterate z → z² + c until |z| > 16, then
 * μ = n + 1 − log₂(ln|z|) turns integer bands into a continuous value. −1 = inside.
 */
export function escape(cRe: number, cIm: number, maxIter: number, zRe = 0, zIm = 0): number {
  let x = zRe
  let y = zIm
  for (let n = 0; n < maxIter; n++) {
    const x2 = x * x
    const y2 = y * y
    if (x2 + y2 > 256) return n + 1 - Math.log2(0.5 * Math.log(x2 + y2))
    y = 2 * x * y + cIm
    x = x2 - y2 + cRe
  }
  return -1
}

/** Cosine palettes (Iñigo Quilez): colour(t) = a + b·cos(2π(c·t + d)). */
export const palettes: { name: string; a: number[]; b: number[]; c: number[]; d: number[] }[] = [
  { name: 'Classic', a: [0.5, 0.5, 0.5], b: [0.5, 0.5, 0.5], c: [1, 1, 1], d: [0.0, 0.1, 0.2] },
  { name: 'Fire', a: [0.5, 0.3, 0.1], b: [0.5, 0.4, 0.2], c: [1, 1, 1], d: [0.0, 0.05, 0.1] },
  { name: 'Ice', a: [0.4, 0.55, 0.7], b: [0.4, 0.4, 0.3], c: [1, 1, 1], d: [0.5, 0.55, 0.6] },
  { name: 'Neon', a: [0.5, 0.5, 0.5], b: [0.5, 0.5, 0.5], c: [2, 1, 0], d: [0.5, 0.2, 0.25] },
]

/** Smooth escape value → colour band position (0–1, repeating). */
export const bandOf = (mu: number) => (Math.sqrt(Math.max(0, mu)) * 0.18) % 1

export function colorOf(mu: number, paletteIndex: number): [number, number, number] {
  if (mu < 0) return [0, 0, 0]
  const { a, b, c, d } = palettes[paletteIndex]
  const t = bandOf(mu)
  return [0, 1, 2].map((i) => Math.min(1, Math.max(0, a[i] + b[i] * Math.cos(2 * Math.PI * (c[i] * t + d[i]))))) as [number, number, number]
}

export const spots: { name: string; view: View }[] = [
  { name: 'Home', view: HOME },
  { name: 'Seahorse Valley', view: { cx: -0.743643887037151, cy: 0.13182590420533, scale: 2e-6 } },
  { name: 'Elephant Valley', view: { cx: 0.282, cy: 0.0103, scale: 4e-5 } },
  { name: 'Triple spiral', view: { cx: -0.0881, cy: 0.6549, scale: 2e-5 } },
  { name: 'Mini Mandelbrot', view: { cx: -1.7568, cy: 0, scale: 5e-5 } },
  { name: 'Deep (CPU)', view: { cx: -0.743643887037158704752191506114774, cy: 0.131825904205311970493132056385139, scale: 3e-11 } },
]
