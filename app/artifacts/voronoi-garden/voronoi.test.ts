import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../../kit/random'
import { area, cells, centroid, nearest, relax, type Point } from './voronoi'

const W = 400
const H = 300

function randomSites(n: number, seed: number): Point[] {
  const random = mulberry32(seed)
  return Array.from({ length: n }, () => ({ x: random() * W, y: random() * H }))
}

describe('polygon helpers', () => {
  const square = [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }]

  it('measures area and centroid', () => {
    expect(area(square)).toBe(4)
    expect(centroid(square)).toEqual({ x: 1, y: 1 })
  })
})

describe('cells', () => {
  it('splits the box in half between two sites', () => {
    const [a, b] = cells([{ x: 100, y: 150 }, { x: 300, y: 150 }], W, H)
    expect(a.area).toBeCloseTo(W * H / 2, 6)
    expect(b.area).toBeCloseTo(W * H / 2, 6)
    expect(a.neighbors).toEqual([1])
    expect(b.neighbors).toEqual([0])
  })

  it('gives one cell covering everything for a single site', () => {
    expect(cells([{ x: 50, y: 50 }], W, H)[0].area).toBe(W * H)
  })

  it('tiles the box exactly', () => {
    const list = cells(randomSites(80, 3), W, H)
    expect(list.reduce((sum, c) => sum + c.area, 0)).toBeCloseTo(W * H, 4)
  })

  it('puts each site inside its own cell, and no other', () => {
    const sites = randomSites(40, 5)
    const list = cells(sites, W, H)
    sites.forEach((s, i) => {
      // Every corner of my cell is at least as close to me as to any other site.
      for (const corner of list[i].polygon) {
        const mine = Math.hypot(corner.x - s.x, corner.y - s.y)
        for (const t of sites) expect(mine).toBeLessThanOrEqual(Math.hypot(corner.x - t.x, corner.y - t.y) + 1e-6)
      }
    })
  })

  it('has symmetric neighbours', () => {
    const list = cells(randomSites(60, 7), W, H)
    list.forEach((cell, i) => {
      for (const j of cell.neighbors) expect(list[j].neighbors).toContain(i)
    })
  })

  it('survives two sites on the same spot', () => {
    const list = cells([{ x: 10, y: 10 }, { x: 10, y: 10 }, { x: 200, y: 200 }], W, H)
    expect(list.every((c) => Number.isFinite(c.area))).toBe(true)
  })
})

describe('relax', () => {
  it("evens out cell areas (Lloyd's algorithm)", () => {
    let sites = randomSites(50, 11)
    const spread = (s: Point[]) => {
      const areas = cells(s, W, H).map((c) => c.area)
      const mean = areas.reduce((a, b) => a + b) / areas.length
      return Math.sqrt(areas.reduce((a, b) => a + (b - mean) ** 2, 0) / areas.length) / mean
    }
    const before = spread(sites)
    for (let i = 0; i < 20; i++) sites = relax(sites, cells(sites, W, H))
    expect(spread(sites)).toBeLessThan(before / 2)
  })
})

describe('nearest', () => {
  it('finds the closest site', () => {
    expect(nearest([{ x: 0, y: 0 }, { x: 10, y: 0 }], { x: 7, y: 1 })).toBe(1)
    expect(nearest([], { x: 0, y: 0 })).toBe(-1)
  })
})
