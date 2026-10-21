/** Pattern data and timing for a one-bar, 16-step drum machine. */

export const STEPS = 16

export const tracks = [
  { id: 'kick', name: 'Kick' },
  { id: 'snare', name: 'Snare' },
  { id: 'clap', name: 'Clap' },
  { id: 'chat', name: 'Closed hat' },
  { id: 'ohat', name: 'Open hat' },
  { id: 'tom', name: 'Low tom' },
] as const

export type TrackId = (typeof tracks)[number]['id']

/** pattern[track][step] */
export type Pattern = boolean[][]

export const emptyPattern = (): Pattern => tracks.map(() => Array<boolean>(STEPS).fill(false))

/** Build a pattern from strings like "x...x...x...x..." (one per track, missing = empty). */
export function fromStrings(rows: readonly string[]): Pattern {
  return tracks.map((_, t) => Array.from({ length: STEPS }, (_, s) => (rows[t] ?? '')[s] === 'x'))
}

export interface Preset {
  name: string
  bpm: number
  swing: number
  rows: string[]
}

//            step: 1...2...3...4...
export const presets: Preset[] = [
  {
    name: 'Four on the floor',
    bpm: 124,
    swing: 0,
    rows: ['x...x...x...x...', '', '....x.......x...', 'xx.xxx.xxx.xxx.x', '..x...x...x...x.', ''],
  },
  {
    name: 'Boom bap',
    bpm: 90,
    swing: 0.3,
    rows: ['x......x..x.....', '....x.......x...', '', 'x.x.x.x.x.x.x.x.', '', ''],
  },
  {
    name: 'Funk',
    bpm: 104,
    swing: 0.15,
    rows: ['x.x...x...x..x..', '....x..x.x..x..x', '', 'xxxxxxx.xxxxx.xx', '.......x.....x..', ''],
  },
  {
    name: 'Dembow',
    bpm: 96,
    swing: 0,
    rows: ['x...x...x...x...', '...x..x....x..x.', '', 'x.x.x.x.x.x.x.x.', '', ''],
  },
  {
    name: 'Trap',
    bpm: 140,
    swing: 0,
    rows: ['x......x..x.....', '', '........x.......', 'x.x.x.xxx.x.xxxx', '', '..............x.'],
  },
]

/** Length of one 16th note in seconds. */
export const sixteenth = (bpm: number) => 60 / bpm / 4

/**
 * Swing delays every second 16th (the off-beat ones) by a fraction of a 16th.
 * 0 is straight; about 0.33 gives the classic triplet shuffle.
 */
export const swingOffset = (step: number, bpm: number, swing: number) => (step % 2 === 1 ? swing * sixteenth(bpm) : 0)

/** Each track as 16 bits → 4 hex digits, all tracks concatenated. Short enough for a URL. */
export function encode(pattern: Pattern): string {
  return pattern
    .map((row) => row.reduce((bits, on, s) => bits | (on ? 1 << s : 0), 0).toString(16).padStart(4, '0'))
    .join('')
}

export function decode(text: string): Pattern | null {
  if (!new RegExp(`^[0-9a-f]{${tracks.length * 4}}$`).test(text)) return null
  return tracks.map((_, t) => {
    const bits = parseInt(text.slice(t * 4, t * 4 + 4), 16)
    return Array.from({ length: STEPS }, (_, s) => (bits & (1 << s)) !== 0)
  })
}

/** A plausible random beat: anchors on the downbeats, sprinkles elsewhere. */
export function randomPattern(random: () => number = Math.random): Pattern {
  const chance: Record<TrackId, (s: number) => number> = {
    kick: (s) => (s === 0 ? 1 : s % 4 === 0 ? 0.45 : s % 2 === 0 ? 0.2 : 0.08),
    snare: (s) => (s === 4 || s === 12 ? 1 : 0.06),
    clap: (s) => (s === 12 ? 0.4 : 0.03),
    chat: (s) => (s % 2 === 0 ? 0.85 : 0.35),
    ohat: (s) => (s % 4 === 2 ? 0.25 : 0),
    tom: (s) => (s >= 12 ? 0.2 : 0.02),
  }
  return tracks.map((track) => Array.from({ length: STEPS }, (_, s) => random() < chance[track.id](s)))
}
