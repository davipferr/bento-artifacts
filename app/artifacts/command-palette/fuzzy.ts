/**
 * Fuzzy matching for a command palette: the query's characters must appear in order, and
 * the best alignment wins. Matches at word starts, camelCase humps and in consecutive runs
 * score more; gaps cost a little. Solved with a small dynamic program, so "tsb" finds the
 * T, S and B of "Toggle Sidebar" rather than the first t, s and b it sees.
 */
export interface Match {
  score: number
  /** Positions in the text that matched, for highlighting. */
  indices: number[]
}

export const BONUS = {
  first: 8,
  wordStart: 7,
  camel: 5,
  consecutive: 5,
  gapStart: -1.5,
  gapPerChar: -0.25,
  leading: -0.15,
}

const isSeparator = (ch: string) => /[\s\-_./:]/.test(ch)
const isUpper = (ch: string) => ch !== ch.toLowerCase() && ch === ch.toUpperCase()

/** What matching this one position is worth on its own. */
function charBonus(text: string, j: number): number {
  if (j === 0) return BONUS.first
  const prev = text[j - 1]
  if (isSeparator(prev)) return BONUS.wordStart
  if (isUpper(text[j]) && !isUpper(prev)) return BONUS.camel
  return 1
}

export function fuzzy(query: string, text: string): Match | null {
  const q = query.toLowerCase().replace(/\s+/g, '')
  if (!q) return { score: 0, indices: [] }
  const t = text.toLowerCase()
  const n = q.length
  const m = t.length
  if (n > m) return null

  // best[i][j]: best score with q[i] matched at t[j]; from[i][j]: where q[i-1] was matched.
  const best: number[][] = Array.from({ length: n }, () => new Array<number>(m).fill(-Infinity))
  const from: number[][] = Array.from({ length: n }, () => new Array<number>(m).fill(-1))
  for (let j = 0; j < m; j++) if (t[j] === q[0]) best[0][j] = charBonus(text, j) + BONUS.leading * j
  for (let i = 1; i < n; i++) {
    for (let j = i; j < m; j++) {
      if (t[j] !== q[i]) continue
      let top = -Infinity
      let arg = -1
      for (let k = i - 1; k < j; k++) {
        if (best[i - 1][k] === -Infinity) continue
        const gap = j - k - 1
        const link = gap === 0 ? BONUS.consecutive : BONUS.gapStart + BONUS.gapPerChar * gap
        const s = best[i - 1][k] + link
        if (s > top) {
          top = s
          arg = k
        }
      }
      if (arg >= 0) {
        best[i][j] = top + charBonus(text, j)
        from[i][j] = arg
      }
    }
  }

  let end = -1
  for (let j = 0; j < m; j++) if (best[n - 1][j] > (end < 0 ? -Infinity : best[n - 1][end])) end = j
  if (end < 0 || best[n - 1][end] === -Infinity) return null
  const indices = new Array<number>(n)
  for (let i = n - 1, j = end; i >= 0; j = from[i][j], i--) indices[i] = j
  // A slight nudge toward shorter texts, so "Open" beats "Open recent files" on a tie.
  const score = best[n - 1][end] - m * 0.02
  return { score: Math.round(score * 100) / 100, indices }
}

export interface Ranked<T> {
  item: T
  match: Match
}

/**
 * Rank items by their best match against the title or, at a discount, any keyword.
 * Keyword hits have no highlights (the keyword isn't on screen). Ties keep the input order.
 */
export function rank<T>(items: T[], query: string, title: (item: T) => string, keywords: (item: T) => string[] = () => []): Ranked<T>[] {
  const results: (Ranked<T> & { order: number })[] = []
  items.forEach((item, order) => {
    let match = fuzzy(query, title(item))
    for (const word of keywords(item)) {
      const hit = fuzzy(query, word)
      if (hit && (!match || hit.score * 0.7 > match.score)) match = { score: Math.round(hit.score * 70) / 100, indices: [] }
    }
    if (match) results.push({ item, match, order })
  })
  return results.sort((a, b) => b.match.score - a.match.score || a.order - b.order).map(({ item, match }) => ({ item, match }))
}

export type Kind = 'first' | 'word start' | 'camelCase' | 'consecutive' | 'plain'

/** Why each matched character scored what it did, for the "why this result" panel. */
export function explain(text: string, indices: number[]): { ch: string; kind: Kind }[] {
  return indices.map((j, i) => {
    const bonus = charBonus(text, j)
    const kind: Kind =
      bonus === BONUS.first ? 'first' : bonus === BONUS.wordStart ? 'word start' : bonus === BONUS.camel ? 'camelCase' : i > 0 && indices[i - 1] === j - 1 ? 'consecutive' : 'plain'
    return { ch: text[j], kind }
  })
}

/** Split text into runs of matched / unmatched characters for rendering. */
export function highlight(text: string, indices: number[]): { text: string; hit: boolean }[] {
  const hits = new Set(indices)
  const parts: { text: string; hit: boolean }[] = []
  for (let i = 0; i < text.length; i++) {
    const hit = hits.has(i)
    const last = parts[parts.length - 1]
    if (last && last.hit === hit) last.text += text[i]
    else parts.push({ text: text[i], hit })
  }
  return parts
}

/** Most recent first, no duplicates, capped. */
export const pushRecent = (list: string[], id: string, max = 5) => [id, ...list.filter((x) => x !== id)].slice(0, max)
