import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../../kit/random'
import { brush, count, createWorld, EMPTY, FIRE, get, OIL, PLANT, SAND, scene, set, SMOKE, update, WALL, WATER, WOOD, type World } from './sand'

const run = (world: World, steps: number, seed = 1) => {
  const random = mulberry32(seed)
  for (let i = 0; i < steps; i++) update(world, random)
}

/** Average row of a material: bigger = lower on screen. */
const meanY = (world: World, m: number) => {
  let sum = 0
  let n = 0
  world.cell.forEach((c, i) => {
    if (c === m) {
      sum += Math.floor(i / world.width)
      n++
    }
  })
  return sum / n
}

const columnHeight = (world: World, x: number) => {
  let h = 0
  for (let y = 0; y < world.height; y++) if (get(world, x, y) !== EMPTY) h++
  return h
}

describe('sand', () => {
  it('falls to the floor', () => {
    const w = createWorld(5, 20)
    set(w, 2, 0, SAND)
    run(w, 25)
    expect(get(w, 2, 19)).toBe(SAND)
  })

  it('piles into a slope instead of a tower, and is conserved', () => {
    const w = createWorld(41, 40)
    for (let k = 0; k < 120; k++) {
      set(w, 20, 0, SAND)
      run(w, 2, k)
    }
    run(w, 200)
    expect(count(w).get(SAND)).toBe(120)
    expect(columnHeight(w, 20)).toBeLessThan(25)
    expect(columnHeight(w, 20)).toBeGreaterThan(columnHeight(w, 10))
  })

  it('sinks through water', () => {
    const w = createWorld(10, 20)
    for (let x = 0; x < 10; x++) for (let y = 10; y < 20; y++) set(w, x, y, WATER)
    for (let x = 0; x < 10; x++) set(w, x, 0, SAND)
    run(w, 200)
    expect(meanY(w, SAND)).toBeGreaterThan(meanY(w, WATER))
  })
})

describe('liquids', () => {
  it('water spreads out flat', () => {
    const w = createWorld(30, 30)
    for (let y = 0; y < 20; y++) set(w, 15, y, WATER)
    run(w, 400)
    expect(count(w).get(WATER)).toBe(20)
    for (let x = 0; x < 30; x++) expect(columnHeight(w, x)).toBeLessThanOrEqual(2)
  })

  it('oil floats on water', () => {
    const w = createWorld(12, 30)
    for (let x = 0; x < 12; x++) for (let y = 0; y < 5; y++) set(w, x, y, WATER)
    for (let x = 0; x < 12; x++) for (let y = 5; y < 10; y++) set(w, x, y, OIL)
    run(w, 600)
    expect(meanY(w, OIL)).toBeLessThan(meanY(w, WATER))
  })
})

describe('fire', () => {
  it('burns wood away and leaves smoke', () => {
    const w = createWorld(30, 30)
    const random = mulberry32(3)
    for (let x = 5; x < 25; x++) for (let y = 20; y < 24; y++) set(w, x, y, WOOD, random)
    set(w, 15, 19, FIRE, random)
    const before = count(w).get(WOOD)!
    let sawSmoke = false
    for (let i = 0; i < 800; i++) {
      update(w, random)
      if (count(w).get(SMOKE)) sawSmoke = true
    }
    expect(count(w).get(WOOD) ?? 0).toBeLessThan(before / 2)
    expect(sawSmoke).toBe(true)
  })

  it('is put out by water', () => {
    // A full bottom row of water can't flow anywhere, so it stays under the flame.
    const w = createWorld(5, 5)
    for (let x = 0; x < 5; x++) set(w, x, 4, WATER)
    set(w, 2, 3, FIRE)
    run(w, 1)
    expect(get(w, 2, 3)).not.toBe(FIRE)
  })

  it('dies out with nothing to burn', () => {
    const w = createWorld(10, 10)
    set(w, 5, 5, FIRE)
    run(w, 400)
    expect(count(w).get(FIRE) ?? 0).toBe(0)
  })
})

describe('solids', () => {
  it('walls never move', () => {
    const w = createWorld(10, 10)
    set(w, 3, 3, WALL)
    for (let x = 0; x < 10; x++) set(w, x, 0, SAND)
    run(w, 50)
    expect(get(w, 3, 3)).toBe(WALL)
  })

  it('plants grow into water', () => {
    const w = createWorld(10, 10)
    set(w, 5, 9, PLANT)
    for (let x = 0; x < 10; x++) set(w, x, 8, WATER)
    run(w, 600)
    expect(count(w).get(PLANT)!).toBeGreaterThan(1)
  })
})

describe('painting and scenes', () => {
  it('only fills empty cells unless erasing', () => {
    const w = createWorld(10, 10)
    set(w, 5, 5, WALL)
    brush(w, 5, 5, 2, WOOD)
    expect(get(w, 5, 5)).toBe(WALL)
    brush(w, 5, 5, 2, EMPTY)
    expect(get(w, 5, 5)).toBe(EMPTY)
  })

  it('builds every scene', () => {
    for (const name of ['beach', 'campfire', 'garden', 'hourglass'] as const) {
      const w = createWorld(80, 50)
      scene(w, name, mulberry32(1))
      expect(count(w).size).toBeGreaterThan(0)
    }
  })
})
