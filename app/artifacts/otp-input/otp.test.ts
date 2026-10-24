import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../../kit/random'
import { backspace, clean, empty, focusFor, grouped, insert, isComplete, makeCode, move, remove, value, type State } from './otp'

const filled = (text: string, focus = text.length): State => ({ slots: [...text.padEnd(6, ' ')].map((c) => c.trim()), focus })

describe('clean', () => {
  it('keeps digits only in numeric mode', () => {
    expect(clean('Your code: 123-456', 'numeric')).toBe('123456')
  })
  it('keeps letters and upper-cases them in alphanumeric mode', () => {
    expect(clean('ab 12-cd', 'alphanumeric')).toBe('AB12CD')
  })
})

describe('insert', () => {
  it('fills one box and advances', () => {
    expect(insert(empty(6), 0, '4', 'numeric')).toEqual({ slots: ['4', '', '', '', '', ''], focus: 1 })
  })

  it('ignores characters the mode rejects', () => {
    const state = empty(6)
    expect(insert(state, 0, 'x', 'numeric')).toBe(state)
  })

  it('spreads a partial paste from the focused box', () => {
    expect(insert(filled('12'), 2, '345', 'numeric')).toEqual({ slots: ['1', '2', '3', '4', '5', ''], focus: 5 })
  })

  it('starts a full-length paste at the first box, wherever focus is', () => {
    expect(value(insert(filled('99'), 2, '482 913', 'numeric'))).toBe('482913')
  })

  it('stops at the last box and keeps focus there', () => {
    const state = insert(filled('1234'), 4, '567', 'numeric')
    expect(value(state)).toBe('123456')
    expect(state.focus).toBe(5)
    expect(isComplete(state)).toBe(true)
  })

  it('overwrites a filled box', () => {
    expect(value(insert(filled('123456', 2), 2, '9', 'numeric'))).toBe('129456')
  })
})

describe('backspace and delete', () => {
  it('clears the current box when it has a value', () => {
    expect(backspace(filled('123'), 2)).toEqual({ slots: ['1', '2', '', '', '', ''], focus: 2 })
  })

  it('moves back and clears the previous box when the current one is empty', () => {
    expect(backspace(filled('123'), 3)).toEqual({ slots: ['1', '2', '', '', '', ''], focus: 2 })
  })

  it('stays on the first box', () => {
    expect(backspace(empty(4), 0).focus).toBe(0)
  })

  it('delete shifts the rest left', () => {
    expect(value(remove(filled('123456'), 1))).toBe('13456')
  })
})

describe('focus', () => {
  it('moves with arrows, Home and End (End = first empty box)', () => {
    const state = filled('123')
    expect(move(state, 2, 'ArrowLeft').focus).toBe(1)
    expect(move(state, 5, 'ArrowRight').focus).toBe(5)
    expect(move(state, 2, 'Home').focus).toBe(0)
    expect(move(state, 0, 'End').focus).toBe(3)
  })

  it('redirects clicks past the first empty box', () => {
    expect(focusFor(filled('12'), 5)).toBe(2)
    expect(focusFor(filled('12'), 1)).toBe(1)
  })
})

describe('codes', () => {
  it('makes codes of the right length and alphabet', () => {
    const random = mulberry32(7)
    expect(makeCode(6, 'numeric', random)).toMatch(/^\d{6}$/)
    expect(makeCode(8, 'alphanumeric', random)).toMatch(/^[A-HJ-NP-Z2-9]{8}$/)
  })

  it('groups for reading', () => {
    expect(grouped('482913')).toBe('482 913')
    expect(grouped('12345678')).toBe('1234 5678')
    expect(grouped('1234')).toBe('1234')
  })
})
