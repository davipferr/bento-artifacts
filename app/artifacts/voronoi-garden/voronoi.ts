/**
 * Voronoi cells by half-plane clipping: a site's cell is everything closer to it than to
 * any other site. Start from the whole box and, for every other site, cut away the half
 * beyond the perpendicular bisector between the two. O(n²), but simple and exact, and
 * fast enough for a few hundred sites. Each polygon edge remembers which site's bisector
 * made it, which gives the neighbours (the Delaunay triangulation) for free.
 */

export interface Point {
  x: number
  y: number
}

/** A polygon corner; `edge` labels the edge from this corner to the next: a site index, or -1 for the box. */
interface Corner extends Point {
  edge: number
}

export interface Cell {
  polygon: Point[]
  neighbors: number[]
  area: number
  centroid: Point
}

/** Keep the part of the polygon where nx·x + ny·y ≤ c (Sutherland–Hodgman for one half-plane). */
function clip(polygon: Corner[], nx: number, ny: number, c: number, label: number): Corner[] {
  const out: Corner[] = []
  for (let i = 0; i < polygon.length; i++) {
    const cur = polygon[i]
    const next = polygon[(i + 1) % polygon.length]
    const dc = nx * cur.x + ny * cur.y - c
    const dn = nx * next.x + ny * next.y - c
    const inCur = dc <= 0
    const inNext = dn <= 0
    if (inCur) out.push(cur)
    if (inCur !== inNext) {
      const t = dc / (dc - dn)
      const p = { x: cur.x + (next.x - cur.x) * t, y: cur.y + (next.y - cur.y) * t }
      // Leaving: the new edge runs along the cut. Entering: it continues the old edge.
      out.push({ ...p, edge: inCur ? label : cur.edge })
    }
  }
  return out
}

export function area(polygon: Point[]): number {
  let sum = 0
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]
    const b = polygon[(i + 1) % polygon.length]
    sum += a.x * b.y - b.x * a.y
  }
  return Math.abs(sum) / 2
}

export function centroid(polygon: Point[]): Point {
  let cx = 0
  let cy = 0
  let twice = 0
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]
    const b = polygon[(i + 1) % polygon.length]
    const cross = a.x * b.y - b.x * a.y
    twice += cross
    cx += (a.x + b.x) * cross
    cy += (a.y + b.y) * cross
  }
  if (Math.abs(twice) < 1e-12) return polygon[0] ?? { x: 0, y: 0 }
  return { x: cx / (3 * twice), y: cy / (3 * twice) }
}

export function cells(sites: Point[], width: number, height: number): Cell[] {
  return sites.map((s, i) => {
    let polygon: Corner[] = [
      { x: 0, y: 0, edge: -1 },
      { x: width, y: 0, edge: -1 },
      { x: width, y: height, edge: -1 },
      { x: 0, y: height, edge: -1 },
    ]
    for (let j = 0; j < sites.length && polygon.length; j++) {
      if (j === i) continue
      const t = sites[j]
      // Points closer to s than to t:  2p·(t − s) ≤ |t|² − |s|²
      const nx = t.x - s.x
      const ny = t.y - s.y
      if (nx === 0 && ny === 0) continue // two sites on the same spot
      polygon = clip(polygon, nx, ny, (t.x * t.x + t.y * t.y - s.x * s.x - s.y * s.y) / 2, j)
    }
    const neighbors = new Set<number>()
    polygon.forEach((corner, k) => {
      const next = polygon[(k + 1) % polygon.length]
      if (corner.edge >= 0 && Math.hypot(next.x - corner.x, next.y - corner.y) > 1e-6) neighbors.add(corner.edge)
    })
    const points = polygon.map(({ x, y }) => ({ x, y }))
    return { polygon: points, neighbors: [...neighbors], area: area(points), centroid: centroid(points) }
  })
}

/** One step of Lloyd's relaxation: move each site part of the way to its cell's centroid. */
export function relax(sites: Point[], cellList: Cell[], amount = 1): Point[] {
  return sites.map((s, i) => {
    const c = cellList[i]?.centroid
    if (!c) return s
    return { x: s.x + (c.x - s.x) * amount, y: s.y + (c.y - s.y) * amount }
  })
}

/** Index of the nearest site: the cell that contains p. */
export function nearest(sites: Point[], p: Point): number {
  let best = -1
  let bestDistance = Infinity
  sites.forEach((s, i) => {
    const d = (s.x - p.x) ** 2 + (s.y - p.y) ** 2
    if (d < bestDistance) {
      bestDistance = d
      best = i
    }
  })
  return best
}
