import { describe, expect, it } from 'vitest'
import { algorithms, drain, EMPTY, index, makeGrid, maze, neighbors, scatter, WALL, WEIGHT, WEIGHT_COST, type Grid } from './search'

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const byId = (id: string) => algorithms.find((a) => a.id === id)!

function isValidPath(grid: Grid, path: number[]) {
  expect(path[0]).toBe(grid.start)
  expect(path[path.length - 1]).toBe(grid.goal)
  for (let i = 1; i < path.length; i++) {
    expect(neighbors(grid, path[i - 1])).toContain(path[i])
  }
}

describe.each(algorithms)('$name', ({ search }) => {
  it('walks straight across an empty grid', () => {
    const grid = makeGrid(11, 5)
    const result = drain(search, grid)
    // Start at column 2, goal at column 8, same row.
    expect(result.path).toHaveLength(7)
    expect(result.cost).toBe(6)
    isValidPath(grid, result.path!)
  })

  it('finds a valid path through mazes', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const grid = maze(31, 19, mulberry32(seed))
      const result = drain(search, grid)
      expect(result.path).not.toBeNull()
      isValidPath(grid, result.path!)
    }
  })

  it('returns null when the goal is walled off', () => {
    const grid = makeGrid(9, 5)
    for (let r = 0; r < 5; r++) grid.cells[index(9, 4, r)] = WALL
    const result = drain(search, grid)
    expect(result.path).toBeNull()
    expect(result.visited).toBe(4 * 5)
  })
})

describe('optimality', () => {
  it('Dijkstra and A* agree on the cheapest cost with weights; BFS and greedy never beat it', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const random = mulberry32(seed)
      const grid = makeGrid(25, 15)
      scatter(grid, WALL, 0.2, random)
      scatter(grid, WEIGHT, 0.25, random)
      const dijkstra = drain(byId('dijkstra').search, grid)
      if (!dijkstra.path) continue
      expect(drain(byId('astar').search, grid).cost).toBe(dijkstra.cost)
      expect(drain(byId('bfs').search, grid).cost).toBeGreaterThanOrEqual(dijkstra.cost)
      expect(drain(byId('greedy').search, grid).cost).toBeGreaterThanOrEqual(dijkstra.cost)
    }
  })

  it('Dijkstra goes around a thick weight wall; BFS walks straight through it', () => {
    // Two columns of weights between start and goal, with a gap on the bottom row.
    const grid = makeGrid(9, 5)
    grid.start = index(9, 2, 1)
    grid.goal = index(9, 6, 1)
    for (let r = 0; r < 4; r++) {
      grid.cells[index(9, 4, r)] = WEIGHT
      grid.cells[index(9, 5, r)] = WEIGHT
    }
    const straight = 2 + 2 * WEIGHT_COST // 4 steps, two of them onto weights
    const around = 3 + 4 + 3 // down to the gap, across, back up
    expect(drain(byId('dijkstra').search, grid).cost).toBe(around)
    expect(drain(byId('bfs').search, grid).cost).toBe(straight)
  })

  it('A* visits fewer cells than Dijkstra on an open grid', () => {
    const grid = makeGrid(41, 25)
    expect(drain(byId('astar').search, grid).visited).toBeLessThan(drain(byId('dijkstra').search, grid).visited)
  })
})

describe('maze', () => {
  it('keeps the border solid and start/goal open', () => {
    const grid = maze(21, 13, mulberry32(9))
    for (let c = 0; c < 21; c++) {
      expect(grid.cells[index(21, c, 0)]).toBe(WALL)
      expect(grid.cells[index(21, c, 12)]).toBe(WALL)
    }
    expect(grid.cells[grid.start]).toBe(EMPTY)
    expect(grid.cells[grid.goal]).toBe(EMPTY)
  })
})
