/** Equal temperament, A4 (MIDI 69) = 440 Hz. */
export const midiToFreq = (midi: number) => 440 * 2 ** ((midi - 69) / 12)

export const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'] as const
export const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'] as const

/** Name of a pitch class (0 = C), spelled with flats or sharps. */
export const pitchName = (pc: number, flats = false) => (flats ? FLAT_NAMES : SHARP_NAMES)[((pc % 12) + 12) % 12]

/** e.g. 60 → "C4". */
export const noteName = (midi: number, flats = false) => `${pitchName(midi, flats)}${Math.floor(midi / 12) - 1}`

export const isBlackKey = (midi: number) => [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12)
