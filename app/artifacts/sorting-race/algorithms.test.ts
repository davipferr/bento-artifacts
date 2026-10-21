import { describe, expect, it } from 'vitest'
import { algorithms, makeArray, presets, type Op } from './algorithms'

/** Deterministic PRNG so failures are reproducible. */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function run(sort: (a: number[]) => Generator<Op, void, void>, input: number[]) {
  const a = [...input]
  const ops: Op[] = []
  for (const op of sort(a)) ops.push(op)
  return { a, ops }
}

describe.each(algorithms)('$name', ({ sort }) => {
  it.each(presets.map((p) => p.value))('sorts %s input', (preset) => {
    for (const n of [0, 1, 2, 3, 17, 100]) {
      const input = makeArray(n, preset, mulberry32(n + 1))
      const { a } = run(sort, input)
      expect(a).toEqual([...input].sort((x, y) => x - y))
    }
  })

  it('only yields indices inside the array', () => {
    const input = makeArray(50, 'random', mulberry32(7))
    for (const op of run(sort, input).ops) {
      expect(op.i).toBeGreaterThanOrEqual(0)
      expect(op.i).toBeLessThan(50)
      if (op.kind !== 'write') expect(op.j).toBeLessThan(50)
    }
  })
})

describe('makeArray', () => {
  it('builds a permutation of 1..n for random, nearly and reversed', () => {
    for (const preset of ['random', 'nearly', 'reversed'] as const) {
      const a = makeArray(40, preset, mulberry32(3))
      expect([...a].sort((x, y) => x - y)).toEqual(Array.from({ length: 40 }, (_, i) => i + 1))
    }
  })

  it('uses at most four values for "few unique"', () => {
    expect(new Set(makeArray(100, 'few', mulberry32(5))).size).toBeLessThanOrEqual(4)
  })
})

it('bubble sort needs a single pass on sorted input', () => {
  const bubble = algorithms.find((a) => a.id === 'bubble')!
  const { ops } = run(bubble.sort, Array.from({ length: 30 }, (_, i) => i + 1))
  expect(ops).toHaveLength(29)
})
