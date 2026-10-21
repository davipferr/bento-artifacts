import { pitchName } from '../../kit/music'

/**
 * The circle of fifths: each step clockwise is 7 semitones up. Neighbours share all but
 * one note, so a key's most useful chords sit right next to it on the wheel.
 * Pitch classes: 0 = C … 11 = B.
 */
export const FIFTHS = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5]

/** Wheel labels; slot i holds the major key FIFTHS[i] and its relative minor. */
export const MAJOR_LABELS = ['C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'D♭', 'A♭', 'E♭', 'B♭', 'F']
export const MINOR_LABELS = ['Am', 'Em', 'Bm', 'F♯m', 'C♯m', 'G♯m', 'E♭m', 'B♭m', 'Fm', 'Cm', 'Gm', 'Dm']

/** Keys from D♭ round to F are written with flats. */
export const usesFlats = (slot: number) => slot >= 7

export type Mode = 'major' | 'minor'
export type Quality = 'maj' | 'min' | 'dim'

export const INTERVALS: Record<Quality, number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
}

export interface Chord {
  roman: string
  root: number
  quality: Quality
}

const SCALES: Record<Mode, { steps: number[]; qualities: Quality[]; romans: string[] }> = {
  major: {
    steps: [0, 2, 4, 5, 7, 9, 11],
    qualities: ['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim'],
    romans: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'],
  },
  minor: {
    steps: [0, 2, 3, 5, 7, 8, 10],
    qualities: ['min', 'dim', 'maj', 'min', 'min', 'maj', 'maj'],
    romans: ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'],
  },
}

/** The tonic pitch class of the key at a wheel slot. */
export const tonicOf = (slot: number, mode: Mode) => (mode === 'major' ? FIFTHS[slot] : (FIFTHS[slot] + 9) % 12)

/** The seven triads built on each note of the scale. */
export function diatonic(slot: number, mode: Mode): Chord[] {
  const tonic = tonicOf(slot, mode)
  const scale = SCALES[mode]
  return scale.steps.map((step, i) => ({
    roman: scale.romans[i],
    root: (tonic + step) % 12,
    quality: scale.qualities[i],
  }))
}

export const chordName = (chord: Pick<Chord, 'root' | 'quality'>, flats: boolean) =>
  pitchName(chord.root, flats) + (chord.quality === 'min' ? 'm' : chord.quality === 'dim' ? '°' : '')

/** Where a chord sits on the wheel: outer ring for major, inner for minor, nowhere for diminished. */
export function wheelSlot(chord: Pick<Chord, 'root' | 'quality'>): { ring: 'outer' | 'inner'; slot: number } | null {
  if (chord.quality === 'maj') return { ring: 'outer', slot: FIFTHS.indexOf(chord.root) }
  if (chord.quality === 'min') return { ring: 'inner', slot: FIFTHS.indexOf((chord.root + 3) % 12) }
  return null
}

/**
 * MIDI notes to play: a bass note (octave 2) plus the triad voiced close together
 * around middle C, so chord changes move as little as possible.
 */
export function voicing(chord: Pick<Chord, 'root' | 'quality'>): number[] {
  const bass = 36 + chord.root
  const upper = INTERVALS[chord.quality].map((i) => {
    let note = 48 + ((chord.root + i) % 12)
    while (note < 55) note += 12
    return note
  })
  return [bass, ...upper.sort((a, b) => a - b)]
}

/** Progressions as scale degrees (0 = the tonic chord). */
export const progressions: Record<Mode, { name: string; degrees: number[] }[]> = {
  major: [
    { name: 'Pop: I–V–vi–IV', degrees: [0, 4, 5, 3] },
    { name: '50s: I–vi–IV–V', degrees: [0, 5, 3, 4] },
    { name: 'Jazz: ii–V–I', degrees: [1, 4, 0, 0] },
    { name: 'Sad pop: vi–IV–I–V', degrees: [5, 3, 0, 4] },
    { name: 'Canon: I–V–vi–iii–IV–I–IV–V', degrees: [0, 4, 5, 2, 3, 0, 3, 4] },
    { name: '12-bar blues', degrees: [0, 0, 0, 0, 3, 3, 0, 0, 4, 3, 0, 4] },
  ],
  minor: [
    { name: 'Andalusian: i–VII–VI–v', degrees: [0, 6, 5, 4] },
    { name: 'Epic: i–VI–III–VII', degrees: [0, 5, 2, 6] },
    { name: 'Minor blues: i–iv–v', degrees: [0, 3, 4, 0] },
    { name: 'Ballad: i–iv–VII–III', degrees: [0, 3, 6, 2] },
  ],
}

/** Rotation change (in slots) to go from one slot to another the short way round. */
export function shortestTurn(from: number, to: number): number {
  const d = (((to - from) % 12) + 12) % 12
  return d > 6 ? d - 12 : d
}
