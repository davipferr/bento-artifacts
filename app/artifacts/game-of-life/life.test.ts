import { describe, expect, it } from 'vitest'
import { bounds, key, parseRle, parseRule, patterns, rotate, rules, step, unkey } from './life'

const conway = parseRule('B3/S23')!
const toSet = (cells: [number, number][], dx = 0, dy = 0) => new Set(cells.map(([x, y]) => key(x + dx, y + dy)))
const pattern = (name: string) => parseRle(patterns.find((p) => p.name === name)!.rle)
const run = (cells: Set<number>, n: number, rule = conway) => {
  let c = cells
  for (let i = 0; i < n; i++) c = step(c, rule)
  return c
}

describe('keys', () => {
  it('round-trip negative and large coordinates', () => {
    for (const [x, y] of [[0, 0], [-5, 7], [123456, -654321], [-1, -1]]) expect(unkey(key(x, y))).toEqual([x, y])
  })
})

describe('parseRule', () => {
  it('reads B/S notation in either order and any case', () => {
    expect(parseRule('B36/S23')!.birth[6]).toBe(true)
    expect(parseRule('s23/b3')).toEqual(conway)
    expect(parseRule('B2/S')!.survive.some(Boolean)).toBe(false)
  })
  it('rejects junk', () => {
    expect(parseRule('B9/S23')).toBeNull()
    expect(parseRule('hello')).toBeNull()
  })
  it('parses every preset', () => {
    for (const r of rules) expect(parseRule(r.rule)).not.toBeNull()
  })
})

describe('parseRle', () => {
  it('reads the glider', () => {
    expect(pattern('Glider')).toEqual([[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]])
  })
  it('handles counts on $ (blank rows) and headers', () => {
    expect(parseRle('#C comment\nx = 1, y = 3\no2$o!')).toEqual([[0, 0], [0, 2]])
  })
  it('gives the gun its 36 cells', () => {
    expect(pattern('Gosper glider gun')).toHaveLength(36)
  })
})

describe('Conway', () => {
  it('blinker oscillates with period 2', () => {
    const blinker = toSet(pattern('Blinker'))
    expect(run(blinker, 1)).not.toEqual(blinker)
    expect(run(blinker, 2)).toEqual(blinker)
  })

  it('glider moves one cell diagonally every 4 generations', () => {
    expect(run(toSet(pattern('Glider')), 4)).toEqual(toSet(pattern('Glider'), 1, 1))
  })

  it('pulsar has period 3 and pentadecathlon period 15', () => {
    const pulsar = toSet(pattern('Pulsar'))
    expect(run(pulsar, 3)).toEqual(pulsar)
    const pd = toSet(pattern('Pentadecathlon'))
    expect(run(pd, 15)).toEqual(pd)
    expect(run(pd, 5)).not.toEqual(pd)
  })

  it('the Gosper gun emits one 5-cell glider every 30 generations', () => {
    const gun = toSet(pattern('Gosper glider gun'))
    const sizes = [0, 30, 60].map((n) => run(gun, n).size)
    expect(sizes[1] - sizes[0]).toBe(5)
    expect(sizes[2] - sizes[1]).toBe(5)
  })

  it('diehard vanishes after 130 generations', () => {
    expect(run(toSet(pattern('Diehard')), 130).size).toBe(0)
  })
})

describe('other rules', () => {
  it('Life without death never loses a cell', () => {
    const rule = parseRule('B3/S012345678')!
    const start = toSet(pattern('R-pentomino'))
    const after = run(start, 20, rule)
    for (const k of start) expect(after.has(k)).toBe(true)
  })

  it('Seeds kills every cell that was alive', () => {
    const rule = parseRule('B2/S')!
    const start = toSet(pattern('Glider'))
    for (const k of run(start, 1, rule)) expect(start.has(k)).toBe(false)
  })
})

describe('helpers', () => {
  it('rotating four times gives the original shape', () => {
    const g = pattern('Lightweight spaceship')
    expect(toSet(rotate(rotate(rotate(rotate(g)))))).toEqual(toSet(g))
  })
  it('measures bounds', () => {
    expect(bounds(toSet(pattern('Glider'), 10, -3))).toEqual({ minX: 10, minY: -3, maxX: 12, maxY: -1 })
    expect(bounds(new Set())).toBeNull()
  })
})
