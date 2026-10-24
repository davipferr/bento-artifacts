/**
 * Geometry for context menus: where a menu and its submenu go so they stay on screen,
 * and the "safe triangle" that lets the pointer travel diagonally from a parent item to its
 * submenu across other items without switching to them.
 */
export interface P {
  x: number
  y: number
}
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export const ITEM_H = 30
export const SEPARATOR_H = 9
export const PADDING = 4
export const MENU_W = 210

export interface Entry {
  label?: string
  shortcut?: string
  children?: Entry[]
  disabled?: boolean
  danger?: boolean
  /** A colour dot (tags). */
  dot?: string
  separator?: boolean
}

/** Height of a menu drawn with the fixed row sizes above. */
export const menuHeight = (entries: Entry[]) => entries.reduce((h, e) => h + (e.separator ? SEPARATOR_H : ITEM_H), PADDING * 2)

/** Top of entry i inside its menu. */
export const entryTop = (entries: Entry[], i: number) => PADDING + entries.slice(0, i).reduce((h, e) => h + (e.separator ? SEPARATOR_H : ITEM_H), 0)

/** Which side of the line a→b point p is on (sign of the cross product). */
const side = (p: P, a: P, b: P) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)

export function inTriangle(p: P, a: P, b: P, c: P): boolean {
  const d1 = side(p, a, b)
  const d2 = side(p, b, c)
  const d3 = side(p, c, a)
  const negative = d1 < 0 || d2 < 0 || d3 < 0
  const positive = d1 > 0 || d2 > 0 || d3 > 0
  return !(negative && positive)
}

/** The triangle from where the pointer was on the parent item to the near edge of the submenu. */
export function safeTriangle(anchor: P, sub: Rect, opensRight: boolean): [P, P, P] {
  const x = opensRight ? sub.x : sub.x + sub.w
  return [anchor, { x, y: sub.y }, { x, y: sub.y + sub.h }]
}

/**
 * Place a menu at a point, flipping to the other side of the point when it would overflow
 * and finally shifting it inside the viewport.
 */
export function placeMenu(at: P, size: { w: number; h: number }, viewport: { w: number; h: number }, margin = 8): Rect & { flippedX: boolean; flippedY: boolean } {
  const flippedX = at.x + size.w > viewport.w - margin && at.x - size.w >= margin
  const flippedY = at.y + size.h > viewport.h - margin && at.y - size.h >= margin
  const x = Math.max(margin, Math.min(viewport.w - size.w - margin, flippedX ? at.x - size.w : at.x))
  const y = Math.max(margin, Math.min(viewport.h - size.h - margin, flippedY ? at.y - size.h : at.y))
  return { x, y, w: size.w, h: size.h, flippedX, flippedY }
}

/** Put a submenu beside its item: to the right when it fits, else to the left; keep it on screen vertically. */
export function placeSubmenu(item: Rect, size: { w: number; h: number }, viewport: { w: number; h: number }, margin = 8): Rect & { opensRight: boolean } {
  const opensRight = item.x + item.w + size.w <= viewport.w - margin || item.x - size.w < margin
  const x = opensRight ? item.x + item.w - 2 : item.x - size.w + 2
  const y = Math.max(margin, Math.min(viewport.h - size.h - margin, item.y - PADDING))
  return { x, y, w: size.w, h: size.h, opensRight }
}

/** Next selectable entry going `delta` (±1), wrapping and skipping separators and disabled items. */
export function step(entries: Entry[], from: number, delta: 1 | -1): number {
  const n = entries.length
  for (let k = 1; k <= n; k++) {
    const i = (((from + delta * k) % n) + n) % n
    if (!entries[i].separator && !entries[i].disabled) return i
  }
  return from
}

/** First selectable entry after `from` whose label starts with `letter`. */
export function typeahead(entries: Entry[], from: number, letter: string): number {
  const n = entries.length
  for (let k = 1; k <= n; k++) {
    const i = (from + k) % n
    const e = entries[i]
    if (!e.separator && !e.disabled && e.label?.toLowerCase().startsWith(letter.toLowerCase())) return i
  }
  return from
}
