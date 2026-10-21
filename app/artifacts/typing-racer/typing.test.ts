import { describe, expect, it } from 'vitest'
import { accuracy, autoIndent, compare, ghostIndex, keyOf, keyStats, passages, wpm, type Stroke } from './typing'

const stroke = (index: number, expected: string, typed: string, t: number): Stroke => ({ index, expected, typed, t })

describe('scoring', () => {
  it('counts 5 characters as a word', () => {
    expect(wpm(250, 60_000)).toBe(50)
    expect(wpm(100, 30_000)).toBe(40)
    expect(wpm(10, 0)).toBe(0)
  })

  it('measures first-try accuracy', () => {
    expect(accuracy([stroke(0, 'a', 'a', 0), stroke(1, 'b', 'x', 100), stroke(1, 'b', 'b', 300), stroke(2, 'c', 'c', 400)])).toBe(0.75)
    expect(accuracy([])).toBe(1)
  })

  it('marks characters as correct, wrong or pending', () => {
    expect(compare('cat', 'cu')).toEqual(['correct', 'wrong', 'pending'])
  })
})

describe('ghost', () => {
  const times = [100, 250, 400, 900]
  it('counts how far the best run had got', () => {
    expect(ghostIndex(times, 0)).toBe(0)
    expect(ghostIndex(times, 100)).toBe(1)
    expect(ghostIndex(times, 500)).toBe(3)
    expect(ghostIndex(times, 10_000)).toBe(4)
  })
})

describe('keys', () => {
  it('maps characters to keys without accents', () => {
    expect(keyOf('Ç')).toBe('c')
    expect(keyOf('ã')).toBe('a')
    expect(keyOf('É')).toBe('e')
    expect(keyOf(' ')).toBe('space')
  })

  it('averages the time before each key and counts mistakes', () => {
    const stats = keyStats([stroke(0, 'a', 'a', 0), stroke(1, 'b', 'b', 200), stroke(2, 'a', 'a', 300), stroke(3, 'b', 'x', 700)])
    expect(stats.get('a')).toEqual({ key: 'a', avg: 100, count: 1, errors: 0 })
    expect(stats.get('b')).toEqual({ key: 'b', avg: 300, count: 2, errors: 1 })
  })
})

describe('autoIndent', () => {
  const code = 'if (x) {\n    y()\n}'
  it('fills the indentation after a newline', () => {
    expect(autoIndent(code, code.indexOf('\n') + 1)).toBe('    ')
    expect(autoIndent(code, 3)).toBe('')
  })
})

describe('passages', () => {
  it('have unique ids and no trailing spaces on any line', () => {
    expect(new Set(passages.map((p) => p.id)).size).toBe(passages.length)
    for (const p of passages) for (const line of p.body.split('\n')) expect(line).toBe(line.trimEnd())
  })
})
