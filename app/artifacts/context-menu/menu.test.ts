import { describe, expect, it } from 'vitest'
import { entryTop, inTriangle, ITEM_H, menuHeight, PADDING, placeMenu, placeSubmenu, safeTriangle, SEPARATOR_H, step, typeahead, type Entry } from './menu'

const entries: Entry[] = [{ label: 'Open' }, { label: 'Copy' }, { separator: true }, { label: 'Cut', disabled: true }, { label: 'Delete' }]

describe('inTriangle', () => {
  const a = { x: 0, y: 0 }
  const b = { x: 10, y: 0 }
  const c = { x: 0, y: 10 }
  it('accepts points inside and on edges, either winding', () => {
    expect(inTriangle({ x: 2, y: 2 }, a, b, c)).toBe(true)
    expect(inTriangle({ x: 2, y: 2 }, a, c, b)).toBe(true)
    expect(inTriangle({ x: 5, y: 0 }, a, b, c)).toBe(true)
  })
  it('rejects points outside', () => {
    expect(inTriangle({ x: 8, y: 8 }, a, b, c)).toBe(false)
    expect(inTriangle({ x: -1, y: 2 }, a, b, c)).toBe(false)
  })
})

describe('safeTriangle', () => {
  it('reaches from the anchor to the near edge of the submenu', () => {
    const sub = { x: 200, y: 50, w: 180, h: 120 }
    expect(safeTriangle({ x: 150, y: 80 }, sub, true)).toEqual([{ x: 150, y: 80 }, { x: 200, y: 50 }, { x: 200, y: 170 }])
    expect(safeTriangle({ x: 150, y: 80 }, sub, false)[1].x).toBe(380)
  })

  it('covers a diagonal path down to the submenu but not a sideways move to a sibling', () => {
    const [a, b, c] = safeTriangle({ x: 150, y: 80 }, { x: 200, y: 50, w: 180, h: 200 }, true)
    expect(inTriangle({ x: 175, y: 120 }, a, b, c)).toBe(true)
    expect(inTriangle({ x: 120, y: 120 }, a, b, c)).toBe(false)
  })
})

describe('placement', () => {
  const viewport = { w: 800, h: 600 }
  const size = { w: 200, h: 300 }

  it('opens at the pointer when there is room', () => {
    expect(placeMenu({ x: 100, y: 100 }, size, viewport)).toMatchObject({ x: 100, y: 100, flippedX: false, flippedY: false })
  })

  it('flips left and up near the right and bottom edges', () => {
    expect(placeMenu({ x: 700, y: 500 }, size, viewport)).toMatchObject({ x: 500, y: 200, flippedX: true, flippedY: true })
  })

  it('shifts inside when flipping would not fit either', () => {
    const tiny = { w: 300, h: 320 }
    expect(placeMenu({ x: 150, y: 300 }, { w: 200, h: 310 }, tiny)).toMatchObject({ x: 92, y: 8 })
  })

  it('opens submenus to the right, or left near the edge', () => {
    expect(placeSubmenu({ x: 100, y: 40, w: 200, h: 30 }, size, viewport)).toMatchObject({ opensRight: true, x: 298, y: 36 })
    expect(placeSubmenu({ x: 560, y: 40, w: 200, h: 30 }, size, viewport)).toMatchObject({ opensRight: false, x: 362 })
    expect(placeSubmenu({ x: 100, y: 500, w: 200, h: 30 }, size, viewport).y).toBe(292)
  })
})

describe('menu helpers', () => {
  it('measures heights with separators', () => {
    expect(menuHeight(entries)).toBe(PADDING * 2 + 4 * ITEM_H + SEPARATOR_H)
    expect(entryTop(entries, 3)).toBe(PADDING + 2 * ITEM_H + SEPARATOR_H)
  })

  it('steps over separators and disabled items, wrapping', () => {
    expect(step(entries, 1, 1)).toBe(4)
    expect(step(entries, 4, 1)).toBe(0)
    expect(step(entries, 0, -1)).toBe(4)
  })

  it('jumps by first letter', () => {
    expect(typeahead(entries, 0, 'd')).toBe(4)
    expect(typeahead(entries, 0, 'c')).toBe(1)
    expect(typeahead(entries, 0, 'z')).toBe(0)
  })
})
