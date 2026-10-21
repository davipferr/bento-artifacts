/**
 * A 4-connected grid and four search algorithms. Each search is a generator that yields
 * every cell it visits (pops from the open set) or adds to the frontier, and returns the
 * path when it's done, so the UI can animate it step by step or drain it instantly.
 */

export const EMPTY = 0
export const WALL = 1
export const WEIGHT = 2
/** Walking onto a weight cell costs this much instead of 1. */
export const WEIGHT_COST = 5

export interface Grid {
  cols: number
  rows: number
  /** EMPTY, WALL or WEIGHT per cell, row-major. */
  cells: Uint8Array
  start: number
  goal: number
}

export type Step = { kind: 'visit'; cell: number } | { kind: 'frontier'; cell: number }

export interface SearchResult {
  /** Cells from start to goal inclusive, or null when the goal can't be reached. */
  path: number[] | null
  visited: number
  /** Sum of the entry costs along the path (weights count as WEIGHT_COST). */
  cost: number
}

export type Search = (grid: Grid) => Generator<Step, SearchResult, void>

export function makeGrid(cols: number, rows: number): Grid {
  return {
    cols,
    rows,
    cells: new Uint8Array(cols * rows),
    start: index(cols, 2, Math.floor(rows / 2)),
    goal: index(cols, cols - 3, Math.floor(rows / 2)),
  }
}

export const index = (cols: number, col: number, row: number) => row * cols + col

export const cost = (grid: Grid, cell: number) => (grid.cells[cell] === WEIGHT ? WEIGHT_COST : 1)

export function neighbors(grid: Grid, cell: number): number[] {
  const { cols, rows } = grid
  const col = cell % cols
  const row = (cell - col) / cols
  const result: number[] = []
  if (row > 0) result.push(cell - cols)
  if (col < cols - 1) result.push(cell + 1)
  if (row < rows - 1) result.push(cell + cols)
  if (col > 0) result.push(cell - 1)
  return result.filter((n) => grid.cells[n] !== WALL)
}

function manhattan(grid: Grid, a: number, b: number) {
  const { cols } = grid
  return Math.abs((a % cols) - (b % cols)) + Math.abs(Math.floor(a / cols) - Math.floor(b / cols))
}

function finish(grid: Grid, prev: Int32Array, visited: number): SearchResult {
  const path = [grid.goal]
  while (path[path.length - 1] !== grid.start) path.push(prev[path[path.length - 1]])
  path.reverse()
  let total = 0
  for (let i = 1; i < path.length; i++) total += cost(grid, path[i])
  return { path, visited, cost: total }
}

/** Breadth-first: explores in rings and ignores weights, so its path is shortest in steps, not cost. */
function* bfs(grid: Grid): Generator<Step, SearchResult, void> {
  const prev = new Int32Array(grid.cells.length).fill(-1)
  const seen = new Uint8Array(grid.cells.length)
  const queue = [grid.start]
  seen[grid.start] = 1
  let visited = 0
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head]
    visited++
    yield { kind: 'visit', cell }
    if (cell === grid.goal) return finish(grid, prev, visited)
    for (const next of neighbors(grid, cell)) {
      if (seen[next]) continue
      seen[next] = 1
      prev[next] = cell
      queue.push(next)
      yield { kind: 'frontier', cell: next }
    }
  }
  return { path: null, visited, cost: 0 }
}

/** A binary min-heap of cells, ordered by (priority, tiebreak). */
class MinHeap {
  private items: { priority: number; tiebreak: number; cell: number }[] = []

  get size() {
    return this.items.length
  }

  push(priority: number, tiebreak: number, cell: number) {
    const items = this.items
    items.push({ priority, tiebreak, cell })
    let i = items.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (!this.less(i, parent)) break
      ;[items[i], items[parent]] = [items[parent], items[i]]
      i = parent
    }
  }

  pop(): number {
    const items = this.items
    const top = items[0]
    const last = items.pop()!
    if (items.length) {
      items[0] = last
      let i = 0
      for (;;) {
        const l = 2 * i + 1
        const r = l + 1
        let smallest = i
        if (l < items.length && this.less(l, smallest)) smallest = l
        if (r < items.length && this.less(r, smallest)) smallest = r
        if (smallest === i) break
        ;[items[i], items[smallest]] = [items[smallest], items[i]]
        i = smallest
      }
    }
    return top.cell
  }

  private less(a: number, b: number) {
    const x = this.items[a]
    const y = this.items[b]
    return x.priority < y.priority || (x.priority === y.priority && x.tiebreak < y.tiebreak)
  }
}

/**
 * Dijkstra, A* and greedy best-first are the same loop with a different priority:
 *   Dijkstra  f = g          (cost so far: optimal, explores everywhere)
 *   A*        f = g + h      (plus a distance estimate: optimal, focused)
 *   Greedy    f = h          (estimate only: fast, not optimal)
 * Ties are broken on h, which keeps A* heading towards the goal.
 */
function bestFirst(priority: (g: number, h: number) => number): Search {
  return function* (grid) {
    const n = grid.cells.length
    const dist = new Float64Array(n).fill(Infinity)
    const prev = new Int32Array(n).fill(-1)
    const closed = new Uint8Array(n)
    const open = new MinHeap()
    const h = (cell: number) => manhattan(grid, cell, grid.goal)
    dist[grid.start] = 0
    open.push(priority(0, h(grid.start)), h(grid.start), grid.start)
    let visited = 0
    while (open.size) {
      const cell = open.pop()
      if (closed[cell]) continue // a stale entry: this cell was already reached more cheaply
      closed[cell] = 1
      visited++
      yield { kind: 'visit', cell }
      if (cell === grid.goal) return finish(grid, prev, visited)
      for (const next of neighbors(grid, cell)) {
        if (closed[next]) continue
        const g = dist[cell] + cost(grid, next)
        if (g >= dist[next]) continue
        dist[next] = g
        prev[next] = cell
        open.push(priority(g, h(next)), h(next), next)
        yield { kind: 'frontier', cell: next }
      }
    }
    return { path: null, visited, cost: 0 }
  }
}

export interface Algorithm {
  id: string
  name: string
  /** Whether the path it finds is guaranteed cheapest when there are weights. */
  optimal: boolean
  search: Search
}

export const algorithms: Algorithm[] = [
  { id: 'bfs', name: 'BFS', optimal: false, search: bfs },
  { id: 'dijkstra', name: 'Dijkstra', optimal: true, search: bestFirst((g) => g) },
  { id: 'astar', name: 'A*', optimal: true, search: bestFirst((g, h) => g + h) },
  { id: 'greedy', name: 'Greedy best-first', optimal: false, search: bestFirst((_, h) => h) },
]

/** Run a search to the end without animating. */
export function drain(search: Search, grid: Grid): SearchResult {
  const gen = search(grid)
  for (;;) {
    const step = gen.next()
    if (step.done) return step.value
  }
}

/**
 * A perfect maze by recursive backtracking: cells at odd coordinates are rooms,
 * the walls between them get knocked down. Start and goal go to opposite corners.
 */
export function maze(cols: number, rows: number, random: () => number = Math.random): Grid {
  const grid = makeGrid(cols, rows)
  grid.cells.fill(WALL)
  const at = (c: number, r: number) => index(cols, c, r)
  const stack: [number, number][] = [[1, 1]]
  grid.cells[at(1, 1)] = EMPTY
  while (stack.length) {
    const [c, r] = stack[stack.length - 1]
    const options = (
      [
        [2, 0],
        [-2, 0],
        [0, 2],
        [0, -2],
      ] as const
    ).filter(([dc, dr]) => {
      const nc = c + dc
      const nr = r + dr
      return nc > 0 && nr > 0 && nc < cols - 1 && nr < rows - 1 && grid.cells[at(nc, nr)] === WALL
    })
    if (!options.length) {
      stack.pop()
      continue
    }
    const [dc, dr] = options[Math.floor(random() * options.length)]
    grid.cells[at(c + dc / 2, r + dr / 2)] = EMPTY
    grid.cells[at(c + dc, r + dr)] = EMPTY
    stack.push([c + dc, r + dr])
  }
  // Knock out a few extra walls so there's more than one route and the algorithms differ.
  for (let k = 0; k < (cols * rows) / 25; k++) {
    const c = 1 + Math.floor(random() * (cols - 2))
    const r = 1 + Math.floor(random() * (rows - 2))
    if ((c + r) % 2 === 1) grid.cells[at(c, r)] = EMPTY
  }
  grid.start = at(1, 1)
  grid.goal = at(cols % 2 ? cols - 2 : cols - 3, rows % 2 ? rows - 2 : rows - 3)
  return grid
}

/** Scatter walls or weights over a fraction of the empty cells, keeping start and goal clear. */
export function scatter(grid: Grid, kind: typeof WALL | typeof WEIGHT, fraction: number, random: () => number = Math.random) {
  for (let i = 0; i < grid.cells.length; i++) {
    if (i === grid.start || i === grid.goal || grid.cells[i] !== EMPTY) continue
    if (random() < fraction) grid.cells[i] = kind
  }
}
