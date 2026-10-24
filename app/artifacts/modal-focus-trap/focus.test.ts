import { describe, expect, it } from 'vitest'
import { close, escaped, open, step, tabOrder } from './focus'

describe('tabOrder', () => {
  it('keeps document order for tabindex 0', () => {
    const items = [2, 0, 1].map((index) => ({ index, tabIndex: 0 }))
    expect(tabOrder(items).map((i) => i.index)).toEqual([0, 1, 2])
  })

  it('puts positive tabindex first, ascending, and skips negative ones', () => {
    const items = [
      { index: 0, tabIndex: 0 },
      { index: 1, tabIndex: 2 },
      { index: 2, tabIndex: -1 },
      { index: 3, tabIndex: 1 },
      { index: 4, tabIndex: 2 },
    ]
    expect(tabOrder(items).map((i) => i.index)).toEqual([3, 1, 4, 0])
  })
})

describe('step', () => {
  it('wraps forwards and backwards', () => {
    expect(step(0, 3, false)).toBe(1)
    expect(step(2, 3, false)).toBe(0)
    expect(step(0, 3, true)).toBe(2)
    expect(step(1, 3, true)).toBe(0)
  })

  it('enters at the right end from outside', () => {
    expect(step(-1, 4, false)).toBe(0)
    expect(step(-1, 4, true)).toBe(3)
    expect(step(-1, 0, false)).toBe(-1)
  })
})

describe('dialog stack', () => {
  it('closes the top layer and returns its opener', () => {
    let stack = open<string>([], 'a', 'button-1')
    stack = open(stack, 'b', 'button-2')
    stack = open(stack, 'b', 'ignored')
    expect(stack.map((l) => l.id)).toEqual(['a', 'b'])
    const first = close(stack)
    expect(first.restore).toBe('button-2')
    expect(first.stack.map((l) => l.id)).toEqual(['a'])
    expect(close(first.stack).restore).toBe('button-1')
    expect(close([])).toEqual({ stack: [], restore: null })
  })

  it('flags focus outside the top dialog', () => {
    const stack = open(open([], 'a', null), 'b', null)
    expect(escaped(stack, 'b')).toBe(false)
    expect(escaped(stack, 'a')).toBe(true)
    expect(escaped(stack, 'page')).toBe(true)
    expect(escaped([], 'page')).toBe(false)
  })
})
