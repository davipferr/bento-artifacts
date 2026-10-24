/**
 * The pure part of a modal: which elements Tab visits and in what order, where Tab goes
 * from the last one, and the stack of open dialogs that decides where focus returns.
 */

/** Elements that can take focus from the keyboard, before filtering out hidden or inert ones. */
export const TABBABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]'

export interface Candidate {
  tabIndex: number
  /** Position in document order. */
  index: number
}

/**
 * The browser's sequential focus order: positive tabindex values first (ascending, ties in
 * document order), then every tabindex=0 element in document order. Negative ones are skipped.
 */
export function tabOrder<T extends Candidate>(items: T[]): T[] {
  const positive = items.filter((i) => i.tabIndex > 0).sort((a, b) => a.tabIndex - b.tabIndex || a.index - b.index)
  const zero = items.filter((i) => i.tabIndex === 0).sort((a, b) => a.index - b.index)
  return [...positive, ...zero]
}

/**
 * Where a trapped Tab goes. From the last item Tab wraps to the first, and Shift+Tab from the
 * first wraps to the last. Focus outside the list (-1) enters at the start, or the end going back.
 */
export function step(current: number, count: number, backwards: boolean): number {
  if (count === 0) return -1
  if (current < 0) return backwards ? count - 1 : 0
  return (current + (backwards ? count - 1 : 1)) % count
}

export interface Layer<Id extends string = string> {
  id: Id
  /** What had focus when this dialog opened, so closing it can put focus back. */
  opener: string | null
}

export function open<Id extends string>(stack: Layer<Id>[], id: Id, opener: string | null): Layer<Id>[] {
  if (stack.some((l) => l.id === id)) return stack
  return [...stack, { id, opener }]
}

/** Close the top dialog only (Escape never closes the whole stack). */
export function close<Id extends string>(stack: Layer<Id>[]): { stack: Layer<Id>[]; restore: string | null } {
  if (!stack.length) return { stack, restore: null }
  return { stack: stack.slice(0, -1), restore: stack[stack.length - 1].opener }
}

/** Is focus somewhere it shouldn't be? Only the top dialog is live while any dialog is open. */
export function escaped(stack: Layer[], focusedLayer: string | null): boolean {
  if (!stack.length || focusedLayer === null) return false
  return focusedLayer !== stack[stack.length - 1].id
}
