import { describe, expect, it } from 'vitest'
import { expand, MAX_LENGTH, parseRules, presets, rulesText, turtle } from './lsystem'

const preset = (name: string) => presets.find((p) => p.name === name)!

describe('expand', () => {
  it("grows Lindenmayer's algae by Fibonacci numbers", () => {
    const lengths = [0, 1, 2, 3, 4, 5, 6].map((n) => expand('A', { A: 'AB', B: 'A' }, n).text.length)
    expect(lengths).toEqual([1, 2, 3, 5, 8, 13, 21])
    expect(expand('A', { A: 'AB', B: 'A' }, 4).text).toBe('ABAABABA')
  })

  it('leaves symbols without a rule alone', () => {
    expect(expand('F+F', { F: 'FF' }, 2).text).toBe('FFFF+FFFF')
  })

  it('stops before the string gets too long', () => {
    const result = expand('F', { F: 'FFFFFFFFFF' }, 20)
    expect(result.truncated).toBe(true)
    expect(result.done).toBe(6)
    expect(result.text.length).toBeLessThanOrEqual(MAX_LENGTH)
  })
})

describe('parseRules', () => {
  it('accepts =, -> and →, and skips comments', () => {
    expect(parseRules('F = FF\nX->F[+X]\n# note\n\nY → -X')).toEqual({ F: 'FF', X: 'F[+X]', Y: '-X' })
  })

  it('round-trips with rulesText', () => {
    const rules = preset('Fractal plant').rules
    expect(parseRules(rulesText(rules))).toEqual(rules)
  })

  it('reports the bad line', () => {
    expect(() => parseRules('F = FF\nnonsense here')).toThrow('Line 2')
  })
})

describe('turtle', () => {
  it('draws 4ⁿ × 3 segments for the Koch snowflake', () => {
    const koch = preset('Koch snowflake')
    for (const n of [0, 1, 2, 3]) {
      expect(turtle(expand(koch.axiom, koch.rules, n).text, koch).count).toBe(3 * 4 ** n)
    }
  })

  it('closes the Koch snowflake back at the start', () => {
    const koch = preset('Koch snowflake')
    const d = turtle(expand(koch.axiom, koch.rules, 2).text, koch)
    const last = d.count - 1
    expect(d.lines[last * 4 + 2]).toBeCloseTo(0, 6)
    expect(d.lines[last * 4 + 3]).toBeCloseTo(0, 6)
  })

  it('fills a square for the Hilbert curve', () => {
    const hilbert = preset('Hilbert curve')
    const d = turtle(expand(hilbert.axiom, hilbert.rules, 4).text, hilbert)
    expect(d.count).toBe(4 ** 4 - 1)
    expect(d.bounds.maxX - d.bounds.minX).toBeCloseTo(15, 6)
    expect(d.bounds.maxY - d.bounds.minY).toBeCloseTo(15, 6)
  })

  it('returns to the branch point after ] and records depth', () => {
    const d = turtle('F[+F]F', { angle: 90, heading: 0, draw: 'F' })
    expect(d.count).toBe(3)
    expect([...d.depth]).toEqual([0, 1, 0])
    expect(d.maxDepth).toBe(1)
    // The third segment starts where the first ended, not at the branch tip.
    expect([d.lines[8], d.lines[9]]).toEqual([1, 0])
  })

  it('moves without drawing on f', () => {
    const d = turtle('FfF', { angle: 90, heading: 0, draw: 'F' })
    expect(d.count).toBe(2)
    expect(d.bounds.maxX).toBe(3)
  })

  it('only draws the system draw symbols', () => {
    const gosper = preset('Gosper curve')
    expect(turtle(expand(gosper.axiom, gosper.rules, 1).text, gosper).count).toBe(7)
  })
})
