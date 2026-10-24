import { describe, expect, it } from 'vitest'
import { build, codes, decode, encode, entropy, fixedWidth, frequencies, layout } from './huffman'

const roundTrip = (text: string) => {
  const { root } = build(text)
  const table = codes(root)
  const bits = encode(text, table)
  return { bits, table, decoded: decode(bits, root) }
}

describe('huffman', () => {
  it('counts symbols in order of first appearance', () => {
    expect([...frequencies('abracadabra')]).toEqual([
      ['a', 5],
      ['b', 2],
      ['r', 2],
      ['c', 1],
      ['d', 1],
    ])
  })

  it('round-trips text, including whitespace and non-ASCII', () => {
    for (const text of ['abracadabra', 'the quick brown fox\njumps over the lazy dog', 'ação é coração 🙂🙂', 'zz']) {
      expect(roundTrip(text).decoded).toBe(text)
    }
  })

  it('makes a prefix-free code', () => {
    const { table } = roundTrip('she sells sea shells by the sea shore')
    const words = [...table.values()]
    for (const a of words) for (const b of words) if (a !== b) expect(b.startsWith(a)).toBe(false)
  })

  it('hits the optimal length on a textbook example', () => {
    // CLRS: a:45 b:13 c:12 d:16 e:9 f:5 → 224 bits.
    const text = 'a'.repeat(45) + 'b'.repeat(13) + 'c'.repeat(12) + 'd'.repeat(16) + 'e'.repeat(9) + 'f'.repeat(5)
    const { bits, table } = roundTrip(text)
    expect(bits.length).toBe(224)
    expect(table.get('a')).toHaveLength(1)
  })

  it('lands between the entropy bound and entropy + 1 bit per symbol', () => {
    for (const text of ['mississippi river', 'aaaaaaaabbbc', 'lorem ipsum dolor sit amet']) {
      const n = [...text].length
      const perSymbol = roundTrip(text).bits.length / n
      expect(perSymbol).toBeGreaterThanOrEqual(entropy(text) - 1e-9)
      expect(perSymbol).toBeLessThan(entropy(text) + 1)
      expect(perSymbol).toBeLessThanOrEqual(fixedWidth(frequencies(text).size))
    }
  })

  it('gives a lone symbol a one-bit code', () => {
    const { bits, table, decoded } = roundTrip('aaaa')
    expect(table.get('a')).toBe('0')
    expect(bits).toBe('0000')
    expect(decoded).toBe('aaaa')
  })

  it('handles empty text', () => {
    const { root, steps } = build('')
    expect(root).toBeNull()
    expect(steps).toEqual([[]])
    expect(decode('', root)).toBe('')
  })

  it('records one forest per merge, ending in the root', () => {
    const { root, steps } = build('abracadabra')
    expect(steps.map((f) => f.length)).toEqual([5, 4, 3, 2, 1])
    expect(steps.at(-1)![0]).toBe(root)
    expect(root!.weight).toBe(11)
  })

  it('lays out leaves in consecutive slots with parents centred', () => {
    const placed = layout([build('abracadabra').root!])
    const leaves = placed.filter((p) => p.node.symbol !== undefined)
    expect(leaves.map((p) => p.x)).toEqual([0, 1, 2, 3, 4])
    for (const p of placed) {
      if (!p.node.left) continue
      const kids = placed.filter((c) => c.parent === p)
      expect(p.x).toBeCloseTo((kids[0].x + kids[1].x) / 2)
      expect(kids.map((c) => c.bit)).toEqual(['0', '1'])
    }
  })
})
