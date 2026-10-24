/**
 * The behaviour of a one-time-code input made of separate boxes, as pure functions over
 * `{ slots, focus }`. The component only maps DOM events onto these.
 */
export type Mode = 'numeric' | 'alphanumeric'

export interface State {
  /** One entry per box; '' when empty. */
  slots: string[]
  /** Index of the focused box. */
  focus: number
}

export const empty = (length: number): State => ({ slots: Array(length).fill(''), focus: 0 })

/** Keep only characters the mode allows, upper-cased, e.g. a pasted "123 456" → "123456". */
export function clean(text: string, mode: Mode): string {
  const kept = mode === 'numeric' ? text.replace(/\D/g, '') : text.replace(/[^0-9a-z]/gi, '')
  return kept.toUpperCase()
}

const clamp = (i: number, length: number) => Math.max(0, Math.min(length - 1, i))

/**
 * Type or paste `text` starting at `index`. One character fills the box and moves on; a
 * longer string spreads across the following boxes. A full-length paste always starts at the
 * first box, since that's what pasting a whole code means.
 */
export function insert(state: State, index: number, text: string, mode: Mode): State {
  const chars = [...clean(text, mode)]
  if (!chars.length) return state
  const length = state.slots.length
  const start = chars.length >= length ? 0 : index
  const slots = [...state.slots]
  let i = start
  for (const ch of chars) {
    if (i >= length) break
    slots[i++] = ch
  }
  return { slots, focus: clamp(i, length) }
}

/** Backspace: clear this box, or if it's already empty, clear the previous one and move there. */
export function backspace(state: State, index: number): State {
  const slots = [...state.slots]
  if (slots[index]) {
    slots[index] = ''
    return { slots, focus: index }
  }
  const prev = Math.max(0, index - 1)
  slots[prev] = ''
  return { slots, focus: prev }
}

/** Delete: clear this box and shift the rest left, like deleting in a text field. */
export function remove(state: State, index: number): State {
  const slots = [...state.slots.slice(0, index), ...state.slots.slice(index + 1), '']
  return { slots, focus: index }
}

export function move(state: State, index: number, key: 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End'): State {
  const last = state.slots.length - 1
  const firstEmpty = state.slots.indexOf('')
  const focus =
    key === 'ArrowLeft' ? index - 1 : key === 'ArrowRight' ? index + 1 : key === 'Home' ? 0 : firstEmpty === -1 ? last : firstEmpty
  return { ...state, focus: clamp(focus, state.slots.length) }
}

/**
 * Where a click should land: on the clicked box if it or an earlier one is filled,
 * otherwise on the first empty box, so you can't leave holes in the middle.
 */
export function focusFor(state: State, index: number): number {
  const firstEmpty = state.slots.indexOf('')
  return firstEmpty === -1 || index <= firstEmpty ? index : firstEmpty
}

export const isComplete = (state: State) => state.slots.every(Boolean)
export const value = (state: State) => state.slots.join('')

/** A random code for the fake SMS. Alphanumeric codes skip look-alikes (0/O, 1/I). */
export function makeCode(length: number, mode: Mode, random: () => number = Math.random): string {
  const alphabet = mode === 'numeric' ? '0123456789' : 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length }, () => alphabet[Math.floor(random() * alphabet.length)]).join('')
}

/** "482913" → "482 913", the way codes are usually printed for reading. */
export const grouped = (code: string) => (code.length % 3 === 0 ? code.replace(/(.{3})(?=.)/g, '$1 ') : code.replace(/(.{4})(?=.)/g, '$1 '))
