import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../../kit/random'
import { accuracy, backspace, caretFor, chunkSizes, format, formatInput, generate, plan, rawIndex, score, span, type Pattern, type Trial } from './chunk'

describe('generate', () => {
  it('makes strings of the right length and alphabet with no triples', () => {
    const random = mulberry32(5)
    for (let i = 0; i < 100; i++) {
      const s = generate('digits', 12, random)
      expect(s).toMatch(/^\d{12}$/)
      expect(s).not.toMatch(/(.)\1\1/)
    }
    expect(generate('mixed', 8, random)).toMatch(/^[A-HJ-NP-Z2-9]{8}$/)
  })
})

describe('chunks', () => {
  it('splits into even groups of 3–4, bigger first', () => {
    expect(chunkSizes(4)).toEqual([4])
    expect(chunkSizes(6)).toEqual([3, 3])
    expect(chunkSizes(7)).toEqual([4, 3])
    expect(chunkSizes(10)).toEqual([4, 3, 3])
    expect(chunkSizes(12)).toEqual([4, 4, 4])
  })

  it('formats with a separator and keeps leftovers', () => {
    expect(format('4821390756', [4, 3, 3])).toBe('4821 390 756')
    expect(format('12345', [2])).toBe('12 345')
  })
})

describe('scoring', () => {
  it('ignores case and spacing', () => {
    expect(score('482 139 07', '48213907')).toEqual({ exact: true, positions: 8 })
    expect(score('ab-c', 'ABC').exact).toBe(true)
  })

  it('counts characters in the right place', () => {
    expect(score('48213970', '48213907')).toEqual({ exact: false, positions: 6 })
    expect(score('', '123').positions).toBe(0)
  })

  it('plans every length raw and chunked', () => {
    const p = plan(mulberry32(1))
    expect(p).toHaveLength(8)
    expect(p.filter((c) => c.chunked)).toHaveLength(4)
  })

  it('computes accuracy and span', () => {
    const t = (n: number, chunked: boolean, exact: boolean): Trial => ({ n, chunked, exact, kind: 'digits', truth: '', answer: '', positions: 0 })
    const trials = [t(6, false, true), t(8, false, false), t(6, true, true), t(8, true, true), t(10, true, true), t(10, true, false), t(12, true, false)]
    expect(accuracy(trials, true)).toEqual({ 6: 1, 8: 1, 10: 0.5, 12: 0 })
    expect(span(trials, true)).toBe(10)
    expect(span(trials, false)).toBe(6)
    expect(span([], false)).toBe(0)
  })
})

describe('grouped input', () => {
  const card: Pattern = { sizes: [4], max: 16, kind: 'digits' }
  const phone: Pattern = { sizes: [3, 3, 4], max: 10, kind: 'digits' }

  it('formats as you type and drops junk', () => {
    expect(formatInput('4242-4242 42', card)).toBe('4242 4242 42')
    expect(formatInput('41555501329999', phone)).toBe('415 555 0132')
    expect(formatInput('gb82west', { sizes: [4], max: 22, kind: 'mixed' })).toBe('GB82 WEST')
  })

  it('maps the caret between raw and formatted positions', () => {
    const f = '4242 4242 42'
    expect(rawIndex(f, 5)).toBe(4)
    expect(caretFor(f, 4)).toBe(4)
    expect(caretFor(f, 5)).toBe(6)
    expect(caretFor(f, 0)).toBe(0)
    expect(caretFor(f, 99)).toBe(f.length)
  })

  it('backspaces over a separator into the character before it', () => {
    expect(backspace('4242 4242', 5)).toEqual({ raw: '4244242', index: 3 })
    expect(backspace('4242 4242', 4)).toBeNull()
    expect(backspace('4242', 0)).toBeNull()
  })
})
