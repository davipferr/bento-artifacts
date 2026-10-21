/**
 * Colour math in OKLCH: a perceptual space where equal steps in lightness (L) look equal,
 * and changing hue (H) keeps perceived lightness steady, unlike HSL.
 * Conversions follow Björn Ottosson's OKLab definition.
 */

export interface Oklch {
  /** Lightness 0–1. */
  l: number
  /** Chroma, 0 (grey) to about 0.37 (the most vivid sRGB colours). */
  c: number
  /** Hue in degrees 0–360. */
  h: number
}

/** sRGB channels 0–1 (may fall outside when the colour is out of gamut). */
export interface Rgb {
  r: number
  g: number
  b: number
}

export const MAX_CHROMA = 0.37

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const fromLinear = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.sign(c) * Math.abs(c) ** (1 / 2.4) - 0.055)

export function oklchToRgb({ l, c, h }: Oklch): Rgb {
  const hr = (h * Math.PI) / 180
  const a = c * Math.cos(hr)
  const b = c * Math.sin(hr)
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b
  const s_ = l - 0.0894841775 * a - 1.291485548 * b
  const L = l_ ** 3
  const M = m_ ** 3
  const S = s_ ** 3
  return {
    r: fromLinear(4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S),
    g: fromLinear(-1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S),
    b: fromLinear(-0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S),
  }
}

export function rgbToOklch({ r, g, b }: Rgb): Oklch {
  const R = toLinear(r)
  const G = toLinear(g)
  const B = toLinear(b)
  const l_ = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B)
  const m_ = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B)
  const s_ = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B)
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_
  const Bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_
  const c = Math.hypot(A, Bb)
  const h = c < 1e-6 ? 0 : ((Math.atan2(Bb, A) * 180) / Math.PI + 360) % 360
  return { l: L, c, h }
}

export const inGamut = ({ r, g, b }: Rgb, epsilon = 1e-4) =>
  r >= -epsilon && r <= 1 + epsilon && g >= -epsilon && g <= 1 + epsilon && b >= -epsilon && b <= 1 + epsilon

/**
 * Bring a colour into sRGB by lowering chroma only (binary search), which keeps its
 * lightness and hue: the CSS Color 4 approach, simplified.
 */
export function toGamut(color: Oklch): Oklch {
  if (inGamut(oklchToRgb(color))) return color
  let lo = 0
  let hi = color.c
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    if (inGamut(oklchToRgb({ ...color, c: mid }))) lo = mid
    else hi = mid
  }
  return { ...color, c: lo }
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

export function rgbToHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((v) => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0')).join('')}`
}

export function hexToRgb(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const full = m[1].length === 3 ? [...m[1]].map((ch) => ch + ch).join('') : m[1]
  const n = parseInt(full, 16)
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 }
}

/** Hex of an OKLCH colour, gamut-mapped first. */
export const hex = (color: Oklch) => rgbToHex(oklchToRgb(toGamut(color)))

export const cssOklch = ({ l, c, h }: Oklch) => `oklch(${(l * 100).toFixed(1)}% ${c.toFixed(3)} ${h.toFixed(1)})`

/** WCAG relative luminance. */
export function luminance(rgb: Rgb): number {
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((v) => toLinear(clamp01(v)))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG 2 contrast ratio, 1 (same) to 21 (black on white). */
export function contrast(a: Rgb, b: Rgb): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

export type Rating = 'AAA' | 'AA' | 'AA large' | 'fail'

/** WCAG level for normal text (large text needs only 3:1 for AA). */
export const rating = (ratio: number): Rating => (ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'AA large' : 'fail')

/** Hue offsets from the base colour for each harmony. */
export const harmonies = {
  complementary: [0, 180],
  analogous: [-30, 0, 30],
  triadic: [0, 120, 240],
  'split complementary': [0, 150, 210],
  tetradic: [0, 90, 180, 270],
  monochrome: [0],
} as const

export type Harmony = keyof typeof harmonies

export function harmony(base: Oklch, kind: Harmony): Oklch[] {
  if (kind === 'monochrome') {
    return [0.32, 0.47, 0.62, 0.77].map((l) => toGamut({ ...base, l }))
  }
  return harmonies[kind].map((offset) => toGamut({ ...base, h: (base.h + offset + 360) % 360 }))
}

export const SCALE_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const
const SCALE_LIGHTNESS = [0.97, 0.93, 0.87, 0.79, 0.7, 0.62, 0.54, 0.46, 0.38, 0.3, 0.23]

/**
 * A Tailwind-style tonal scale: fixed lightness steps, the base's hue, and chroma that
 * tapers towards white and black (very light or dark colours can't be very vivid).
 */
export function tonalScale(base: Oklch): Oklch[] {
  return SCALE_LIGHTNESS.map((l) => {
    const taper = Math.sin(Math.PI * Math.min(1, Math.max(0, (l - 0.1) / 0.9))) ** 0.6
    return toGamut({ l, c: base.c * (0.25 + 0.75 * taper), h: base.h })
  })
}
