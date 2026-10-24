/**
 * Miller's "magical number seven": short-term memory holds a handful of chunks, not characters,
 * so 482 139 07 is easier than 48213907. This module makes the test strings, splits them into
 * chunks, scores recall, and formats grouped inputs (card numbers, phones) while you type.
 */
export type Kind = 'digits' | 'mixed'
export const LENGTHS = [6, 8, 10, 12] as const

const ALPHABET: Record<Kind, string> = {
  digits: '0123456789',
  // No 0/O, 1/I: recall should be about memory, not squinting.
  mixed: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
}

export function generate(kind: Kind, n: number, random: () => number): string {
  const chars = ALPHABET[kind]
  let out = ''
  while (out.length < n) {
    const c = chars[Math.floor(random() * chars.length)]
    // No triples: "777" is a chunk on its own and would make the raw version easier.
    if (out.length >= 2 && out[out.length - 1] === c && out[out.length - 2] === c) continue
    out += c
  }
  return out
}

/** Split n characters into groups of 3–4, as even as possible, bigger groups first: 10 → 4 3 3. */
export function chunkSizes(n: number): number[] {
  if (n <= 4) return [n]
  const count = Math.ceil(n / 4)
  const base = Math.floor(n / count)
  const extra = n % count
  return Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0))
}

export function format(s: string, sizes: number[], sep = ' '): string {
  const parts: string[] = []
  let i = 0
  for (const size of sizes) {
    if (i >= s.length) break
    parts.push(s.slice(i, i + size))
    i += size
  }
  if (i < s.length) parts.push(s.slice(i))
  return parts.join(sep)
}

export const normalize = (s: string) => s.toUpperCase().replace(/[^0-9A-Z]/g, '')

/** Exact recall, plus how many characters landed in the right position. */
export function score(answer: string, truth: string): { exact: boolean; positions: number } {
  const a = normalize(answer)
  const t = normalize(truth)
  let positions = 0
  for (let i = 0; i < t.length; i++) if (a[i] === t[i]) positions++
  return { exact: a === t, positions }
}

export interface Condition {
  n: number
  chunked: boolean
}

export interface Trial extends Condition {
  kind: Kind
  truth: string
  answer: string
  exact: boolean
  positions: number
}

function shuffle<T>(list: T[], random: () => number): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Every length once raw and once chunked, shuffled. */
export function plan(random: () => number): Condition[] {
  return shuffle(
    LENGTHS.flatMap((n) => [
      { n, chunked: false },
      { n, chunked: true },
    ]),
    random,
  )
}

/** Share of exact recalls per length, for raw or chunked trials. Lengths with no trials are left out. */
export function accuracy(trials: Trial[], chunked: boolean): Partial<Record<number, number>> {
  const out: Partial<Record<number, number>> = {}
  for (const n of LENGTHS) {
    const own = trials.filter((t) => t.n === n && t.chunked === chunked)
    if (own.length) out[n] = own.filter((t) => t.exact).length / own.length
  }
  return out
}

/** The longest length you recalled exactly at least half the time (0 if none). */
export function span(trials: Trial[], chunked: boolean): number {
  const acc = accuracy(trials, chunked)
  let best = 0
  for (const n of LENGTHS) if ((acc[n] ?? 0) >= 0.5) best = n
  return best
}

/* ---- Grouped input: chunking while you type ------------------------------------------- */

export interface Pattern {
  /** Group sizes; the last one repeats until `max`. */
  sizes: number[]
  max: number
  kind: Kind
}

export function groupsFor(pattern: Pattern, length: number): number[] {
  const out: number[] = []
  let total = 0
  let i = 0
  while (total < length) {
    const size = pattern.sizes[Math.min(i++, pattern.sizes.length - 1)]
    out.push(size)
    total += size
  }
  return out
}

export function clean(raw: string, pattern: Pattern): string {
  const allowed = pattern.kind === 'digits' ? /[^0-9]/g : /[^0-9A-Z]/g
  return raw.toUpperCase().replace(allowed, '').slice(0, pattern.max)
}

export const formatInput = (raw: string, pattern: Pattern) => {
  const value = clean(raw, pattern)
  return format(value, groupsFor(pattern, value.length))
}

/** How many real characters come before `caret` in a formatted string. */
export const rawIndex = (formatted: string, caret: number) => normalize(formatted.slice(0, caret)).length

/** Where the caret goes in a formatted string so that `index` real characters are before it. */
export function caretFor(formatted: string, index: number): number {
  if (index <= 0) return 0
  let seen = 0
  for (let i = 0; i < formatted.length; i++) {
    if (/[0-9A-Z]/i.test(formatted[i]) && ++seen === index) return i + 1
  }
  return formatted.length
}

/**
 * Backspace right after a separator should delete the character before it, not the space
 * (which formatting would just put back, leaving the caret stuck).
 */
export function backspace(formatted: string, caret: number): { raw: string; index: number } | null {
  if (caret === 0 || /[0-9A-Z]/i.test(formatted[caret - 1])) return null
  const index = rawIndex(formatted, caret)
  if (index === 0) return null
  const raw = normalize(formatted)
  return { raw: raw.slice(0, index - 1) + raw.slice(index), index: index - 1 }
}
