/**
 * How content replaces a loading skeleton, as pure functions of time. Four strategies, the
 * same fake network underneath, and a measure of how far things jump when the skeleton
 * doesn't match the final layout.
 */
export type Strategy = 'cut' | 'crossfade' | 'stagger' | 'blurUp'

export const STRATEGIES: { id: Strategy; name: string; hint: string }[] = [
  { id: 'cut', name: 'Hard cut', hint: 'Each item snaps in the instant its data lands. Fast, but it pops like popcorn.' },
  { id: 'crossfade', name: 'Crossfade', hint: 'The skeleton fades out as the content fades in, item by item.' },
  { id: 'stagger', name: 'Staggered reveal', hint: 'Items wait their turn top to bottom, sliding up a little. Calm and ordered.' },
  { id: 'blurUp', name: 'Blur-up images', hint: 'Text fades in; images start as a blurry colour placeholder and sharpen when they load.' },
]

export const FADE = 300 // ms
export const STAGGER = 90 // ms between items
export const IMAGE_EXTRA = 700 // ms an image takes after its text data

/**
 * When each item's data arrives (ms after the request). Together: one response for all.
 * One by one: each item streams in at its own pace, so later items aren't always last.
 */
export function arrivals(n: number, latency: number, oneByOne: boolean, random: () => number): number[] {
  if (!oneByOne) return Array(n).fill(latency)
  return Array.from({ length: n }, () => Math.round(latency * (0.35 + random() * 0.9)))
}

export interface Look {
  /** 0…1 opacity of the real content. */
  content: number
  /** 0…1 opacity of the skeleton on top of it. */
  skeleton: number
  /** Image blur in px (blur-up only). */
  blur: number
  /** Whether the image is still the low-res colour placeholder. */
  placeholder: boolean
  /** Slide-in offset in px (stagger). */
  offsetY: number
  /** True once the item takes its final size in the layout. */
  sized: boolean
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

/** When item i starts revealing under each strategy. */
export function startTimes(strategy: Strategy, arrive: number[]): number[] {
  if (strategy !== 'stagger') return arrive
  // Never before its data, and never before the item above has started.
  const out: number[] = []
  arrive.forEach((a, i) => out.push(i === 0 ? a : Math.max(a, out[i - 1] + STAGGER)))
  return out
}

export function look(strategy: Strategy, i: number, arrive: number[], t: number, hasImage = true): Look {
  const start = startTimes(strategy, arrive)[i]
  if (t < start) return { content: 0, skeleton: 1, blur: 0, placeholder: hasImage, offsetY: strategy === 'stagger' ? 10 : 0, sized: false }
  const k = clamp01((t - start) / FADE)
  switch (strategy) {
    case 'cut':
      return { content: 1, skeleton: 0, blur: 0, placeholder: false, offsetY: 0, sized: true }
    case 'crossfade':
      return { content: k, skeleton: 1 - k, blur: 0, placeholder: false, offsetY: 0, sized: true }
    case 'stagger': {
      const e = 1 - (1 - k) ** 3
      return { content: e, skeleton: 1 - k, blur: 0, placeholder: false, offsetY: 10 * (1 - e), sized: true }
    }
    case 'blurUp': {
      const imageAt = start + IMAGE_EXTRA
      const sharp = clamp01((t - imageAt) / 450)
      return {
        content: k,
        skeleton: 1 - k,
        blur: hasImage ? (t < imageAt ? 14 : 14 * (1 - sharp)) : 0,
        placeholder: hasImage && t < imageAt,
        offsetY: 0,
        sized: true,
      }
    }
  }
}

/** When everything has settled, so the clock can stop. */
export function finishedAt(strategy: Strategy, arrive: number[]): number {
  const last = Math.max(...startTimes(strategy, arrive))
  return last + FADE + (strategy === 'blurUp' ? IMAGE_EXTRA + 450 : 0)
}

/**
 * Pixels of layout shift so far: each time an item takes its real size, everything below it
 * moves by the size difference. Zero when the skeleton matches the content.
 */
export function layoutShift(skeletonHeights: number[], contentHeights: number[], sized: boolean[]): number {
  let shift = 0
  for (let i = 0; i < sized.length; i++) {
    if (!sized[i]) continue
    const diff = Math.abs(contentHeights[i] - skeletonHeights[i])
    const below = sized.length - 1 - i
    shift += diff * below
  }
  return shift
}
