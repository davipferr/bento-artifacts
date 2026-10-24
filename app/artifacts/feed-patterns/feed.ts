/**
 * One feed, three ways to walk it: infinite scroll, pagination, and a "Load more" button.
 * Items are generated from their index, so every pattern shows the exact same content.
 */
export const TOTAL = 200
export const PER_PAGE = 10

const ADJECTIVES = ['Quiet', 'Golden', 'Hidden', 'Electric', 'Paper', 'Velvet', 'Northern', 'Tiny', 'Lunar', 'Wild', 'Glass', 'Copper']
const NOUNS = ['Harbor', 'Garden', 'Signal', 'Lantern', 'Orchard', 'Comet', 'Library', 'Canyon', 'Bridge', 'Atlas', 'Meadow', 'Engine']
const AUTHORS = ['Ana', 'Ravi', 'Joana', 'Kai', 'Lena', 'Omar', 'Mei', 'Theo']

export interface Item {
  id: number
  title: string
  author: string
  hue: number
  minutes: number
}

/** Item number `id` (1-based), always the same. */
export function item(id: number): Item {
  const k = id * 7919
  return {
    id,
    title: `The ${ADJECTIVES[k % ADJECTIVES.length]} ${NOUNS[(k >> 3) % NOUNS.length]}`,
    author: AUTHORS[(k >> 5) % AUTHORS.length],
    hue: (id * 47) % 360,
    minutes: 2 + (k % 9),
  }
}

export const items = (from: number, to: number) => Array.from({ length: Math.max(0, to - from) }, (_, i) => item(from + i + 1))

export const pageCount = (total = TOTAL, per = PER_PAGE) => Math.ceil(total / per)

/** 1-based page that holds item `id`. */
export const pageOf = (id: number, per = PER_PAGE) => Math.floor((id - 1) / per) + 1

/** [first, last] item ids on a page. */
export const pageRange = (page: number, per = PER_PAGE, total = TOTAL): [number, number] => [(page - 1) * per + 1, Math.min(total, page * per)]

/**
 * Page buttons with gaps: always the first and last page, the current one and `siblings`
 * on each side, and "…" where pages are skipped (but never a "…" that hides just one page).
 */
export function pageList(current: number, count: number, siblings = 1): (number | '…')[] {
  const wanted = new Set([1, count])
  for (let p = current - siblings; p <= current + siblings; p++) if (p >= 1 && p <= count) wanted.add(p)
  const sorted = [...wanted].sort((a, b) => a - b)
  const out: (number | '…')[] = []
  sorted.forEach((p, i) => {
    const prev = sorted[i - 1]
    if (prev !== undefined && p - prev === 2) out.push(prev + 1)
    else if (prev !== undefined && p - prev > 2) out.push('…')
    out.push(p)
  })
  return out
}

/** Infinite scroll's trigger: load more when the bottom is within `threshold` px. */
export const shouldLoad = (scrollTop: number, clientHeight: number, scrollHeight: number, threshold = 240) =>
  scrollHeight - (scrollTop + clientHeight) <= threshold

/** How many items an infinite list holds after `loads` batches. */
export const loadedAfter = (loads: number, per = PER_PAGE, total = TOTAL) => Math.min(total, (loads + 1) * per)
