/**
 * Hick's law: the time to choose among n equally likely options grows with log2(n + 1).
 * This module builds menus of 4, 16 and 64 items, and fits T = a + b · log2(n + 1)
 * to your own timings with least squares.
 */
export const CATEGORIES: Record<string, string[]> = {
  Fruit: ['Apple', 'Banana', 'Cherry', 'Grape', 'Lemon', 'Mango', 'Peach', 'Plum'],
  Animals: ['Badger', 'Camel', 'Dolphin', 'Falcon', 'Koala', 'Otter', 'Panda', 'Zebra'],
  Colours: ['Amber', 'Azure', 'Coral', 'Indigo', 'Lilac', 'Olive', 'Scarlet', 'Teal'],
  Cities: ['Berlin', 'Cairo', 'Lima', 'Lisbon', 'Oslo', 'Seoul', 'Sydney', 'Tokyo'],
  Music: ['Banjo', 'Cello', 'Drums', 'Flute', 'Guitar', 'Harp', 'Piano', 'Violin'],
  Sports: ['Archery', 'Boxing', 'Cricket', 'Fencing', 'Hockey', 'Judo', 'Rowing', 'Tennis'],
  Tools: ['Chisel', 'Drill', 'Hammer', 'Ladder', 'Pliers', 'Saw', 'Shovel', 'Wrench'],
  Space: ['Comet', 'Galaxy', 'Meteor', 'Nebula', 'Orbit', 'Pulsar', 'Quasar', 'Rocket'],
}

export const SIZES = [4, 16, 64] as const
export type Size = (typeof SIZES)[number]
export type Layout = 'flat' | 'grouped' | 'search'

export interface Item {
  label: string
  category: string
}

export const bits = (n: number) => Math.log2(n + 1)

function shuffle<T>(list: T[], random: () => number): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * A menu of n items: 4 → 2 categories × 2, 16 → 4 × 4, 64 → all 8 × 8. Flat menus come
 * shuffled (no order to exploit), grouped ones keep categories together.
 */
export function menu(n: Size, layout: Layout, random: () => number): Item[] {
  const groups = n === 4 ? 2 : n === 16 ? 4 : 8
  const per = n / groups
  const chosen = shuffle(Object.keys(CATEGORIES), random).slice(0, groups)
  const items = chosen.flatMap((category) => shuffle(CATEGORIES[category], random).slice(0, per).map((label) => ({ label, category })))
  if (layout === 'flat') return shuffle(items, random)
  return chosen.flatMap((category) => items.filter((i) => i.category === category).sort((a, b) => a.label.localeCompare(b.label)))
}

/** A trial plan: `each` trials per size, in random order so practice doesn't favour one size. */
export function plan(each: number, random: () => number): Size[] {
  return shuffle(
    SIZES.flatMap((s) => Array<Size>(each).fill(s)),
    random,
  )
}

export function median(values: number[]): number {
  if (!values.length) return NaN
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** Least-squares fit of ms = a + b · log2(n + 1). Needs at least two different sizes. */
export function fit(points: { n: number; ms: number }[]): { a: number; b: number; r2: number } | null {
  const xs = points.map((p) => bits(p.n))
  if (new Set(xs).size < 2) return null
  const ys = points.map((p) => p.ms)
  const mx = xs.reduce((s, x) => s + x, 0) / xs.length
  const my = ys.reduce((s, y) => s + y, 0) / ys.length
  let sxy = 0
  let sxx = 0
  let syy = 0
  xs.forEach((x, i) => {
    sxy += (x - mx) * (ys[i] - my)
    sxx += (x - mx) ** 2
    syy += (ys[i] - my) ** 2
  })
  const b = sxy / sxx
  const a = my - b * mx
  const r2 = syy === 0 ? 1 : (sxy * sxy) / (sxx * syy)
  return { a, b, r2 }
}

export interface Trial {
  layout: Layout
  n: Size
  target: string
  ms: number
  errors: number
}

/** Median time per layout and size. */
export function summary(trials: Trial[]): Record<Layout, Partial<Record<Size, number>>> {
  const out: Record<Layout, Partial<Record<Size, number>>> = { flat: {}, grouped: {}, search: {} }
  for (const layout of ['flat', 'grouped', 'search'] as const) {
    for (const n of SIZES) {
      const times = trials.filter((t) => t.layout === layout && t.n === n).map((t) => t.ms)
      if (times.length) out[layout][n] = median(times)
    }
  }
  return out
}
