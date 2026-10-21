/** Scoring for the typing race: speed, accuracy, the ghost of your best run, slow keys. */

export type Category = 'prose' | 'code' | 'pt-BR'

export interface Passage {
  id: string
  category: Category
  body: string
}

export const passages: Passage[] = [
  {
    id: 'prose-1',
    category: 'prose',
    body: 'The best way to learn how something works is to build a small version of it. Not the whole thing, just enough to see the moving parts. A toy model fits in your head, and once it does, the real one stops being magic.',
  },
  {
    id: 'prose-2',
    category: 'prose',
    body: 'Every morning the bakery on the corner opens before sunrise. The smell of bread reaches the bus stop long before the doors unlock, and by seven there is already a quiet line of people pretending they are not in a hurry.',
  },
  {
    id: 'prose-3',
    category: 'prose',
    body: 'Rivers do not run straight. A small bend makes the water push harder on the outside bank, which wears it away and makes the bend bigger. Give it a few thousand years and a gentle curve becomes a loop.',
  },
  {
    id: 'prose-4',
    category: 'prose',
    body: 'A good map leaves things out. It shows the roads you need and hides the ones you do not, so that the few lines that remain can tell a clear story about where you are and where you could go next.',
  },
  {
    id: 'code-1',
    category: 'code',
    body: 'function debounce(fn, wait) {\n  let timer\n  return (...args) => {\n    clearTimeout(timer)\n    timer = setTimeout(() => fn(...args), wait)\n  }\n}',
  },
  {
    id: 'code-2',
    category: 'code',
    body: 'const total = items\n  .filter((item) => item.inStock)\n  .map((item) => item.price * item.quantity)\n  .reduce((sum, value) => sum + value, 0)',
  },
  {
    id: 'code-3',
    category: 'code',
    body: 'export async function getJson(url) {\n  const response = await fetch(url)\n  if (!response.ok) throw new Error(response.statusText)\n  return response.json()\n}',
  },
  {
    id: 'code-4',
    category: 'code',
    body: 'for (let i = arr.length - 1; i > 0; i--) {\n  const j = Math.floor(Math.random() * (i + 1))\n  ;[arr[i], arr[j]] = [arr[j], arr[i]]\n}',
  },
  {
    id: 'pt-1',
    category: 'pt-BR',
    body: 'Quem aprende a programar descobre cedo que o computador faz exatamente o que você pediu, e não o que você quis dizer. A diferença entre as duas coisas é onde mora a maior parte do trabalho.',
  },
  {
    id: 'pt-2',
    category: 'pt-BR',
    body: 'No fim da tarde, a praia esvazia devagar. As barracas fecham, os vendedores contam o dia, e o mar continua no mesmo ritmo de sempre, como se nada tivesse acontecido.',
  },
  {
    id: 'pt-3',
    category: 'pt-BR',
    body: 'Uma boa receita de pão pede pouca coisa: farinha, água, sal e paciência. O segredo não está nos ingredientes, mas no tempo que a massa precisa para crescer sozinha.',
  },
  {
    id: 'pt-4',
    category: 'pt-BR',
    body: 'Viajar de ônibus pelo interior é ver o país passar pela janela: plantações, pequenas cidades, uma igreja branca no alto do morro e, de vez em quando, um cachorro correndo atrás do ônibus.',
  },
]

/** One forward keystroke: which position it filled, what was expected and typed, and when (ms from start). */
export interface Stroke {
  index: number
  expected: string
  typed: string
  t: number
}

export type CharState = 'correct' | 'wrong' | 'pending'

export function compare(text: string, typed: string): CharState[] {
  return [...text].map((ch, i) => (i >= typed.length ? 'pending' : typed[i] === ch ? 'correct' : 'wrong'))
}

/** Words per minute, by the usual convention of 5 characters per word, counting only correct ones. */
export const wpm = (correctChars: number, ms: number) => (ms > 0 ? correctChars / 5 / (ms / 60000) : 0)

/** Share of keystrokes that were right the first time. */
export const accuracy = (strokes: Stroke[]) =>
  strokes.length ? strokes.filter((s) => s.typed === s.expected).length / strokes.length : 1

/** How many characters the ghost had typed `elapsed` ms in. `times[i]` = when position i was filled. */
export function ghostIndex(times: number[], elapsed: number): number {
  let lo = 0
  let hi = times.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (times[mid] <= elapsed) lo = mid + 1
    else hi = mid
  }
  return lo
}

/** The keyboard key a character lives on: lowercase, accents stripped (ç → c, ã → a). */
export const keyOf = (ch: string) => (ch === ' ' ? 'space' : ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase())

export interface KeyStat {
  key: string
  /** Average ms from the previous keystroke to this one. */
  avg: number
  count: number
  errors: number
}

/** Per-key timing and mistakes, from every stroke after the first. Newlines are skipped. */
export function keyStats(strokes: Stroke[]): Map<string, KeyStat> {
  const stats = new Map<string, { total: number; count: number; errors: number }>()
  strokes.forEach((s, i) => {
    if (s.expected === '\n') return
    const k = keyOf(s.expected)
    const entry = stats.get(k) ?? { total: 0, count: 0, errors: 0 }
    if (i > 0) {
      entry.total += s.t - strokes[i - 1].t
      entry.count++
    }
    if (s.typed !== s.expected) entry.errors++
    stats.set(k, entry)
  })
  return new Map(
    [...stats].map(([k, v]) => [k, { key: k, avg: v.count ? v.total / v.count : 0, count: v.count, errors: v.errors }]),
  )
}

/**
 * After Enter in code, type the next line's indentation automatically: nobody wants to
 * race on space bars. Returns the spaces to insert after position `index`.
 */
export function autoIndent(text: string, index: number): string {
  if (text[index - 1] !== '\n') return ''
  let end = index
  while (text[end] === ' ') end++
  return text.slice(index, end)
}

export interface Best {
  wpm: number
  accuracy: number
  /** When each position was filled, for the ghost. */
  times: number[]
}

const storageKey = (id: string) => `bento-typing-best-${id}`

export function loadBest(id: string): Best | null {
  try {
    const raw = localStorage.getItem(storageKey(id))
    return raw ? (JSON.parse(raw) as Best) : null
  } catch {
    return null
  }
}

export function saveBest(id: string, best: Best) {
  try {
    localStorage.setItem(storageKey(id), JSON.stringify(best))
  } catch {
    // Storage blocked: the best run just isn't remembered.
  }
}
