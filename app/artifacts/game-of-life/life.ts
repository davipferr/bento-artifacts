/**
 * Life-like cellular automata on an unbounded board. Only live cells are stored (a Set of
 * packed coordinates), so the board can grow forever and empty space costs nothing.
 * Each generation: count the neighbours of every live cell's neighbourhood, then apply
 * the rule "B…/S…": a dead cell is Born with those neighbour counts, a live one Survives.
 */

const OFFSET = 2 ** 25
const SPAN = 2 ** 26

/** Pack (x, y) into one number; works for |x|, |y| < 2²⁵. */
export const key = (x: number, y: number) => (x + OFFSET) * SPAN + (y + OFFSET)
export const unkey = (k: number): [number, number] => [Math.floor(k / SPAN) - OFFSET, (k % SPAN) - OFFSET]

export interface Rule {
  birth: boolean[]
  survive: boolean[]
}

/** Parse "B3/S23" (case-insensitive, either order). Returns null if malformed. */
export function parseRule(text: string): Rule | null {
  const m = /^\s*B([0-8]*)\s*\/\s*S([0-8]*)\s*$/i.exec(text) ?? /^\s*S([0-8]*)\s*\/\s*B([0-8]*)\s*$/i.exec(text)
  if (!m) return null
  const [born, stay] = /^\s*B/i.test(text) ? [m[1], m[2]] : [m[2], m[1]]
  const flags = (digits: string) => Array.from({ length: 9 }, (_, n) => digits.includes(String(n)))
  return { birth: flags(born), survive: flags(stay) }
}

export const rules: { name: string; rule: string; note: string }[] = [
  { name: 'Conway', rule: 'B3/S23', note: 'The classic.' },
  { name: 'HighLife', rule: 'B36/S23', note: 'Like Life, plus a self-copying replicator.' },
  { name: 'Seeds', rule: 'B2/S', note: 'Nothing survives; everything explodes.' },
  { name: 'Day & Night', rule: 'B3678/S34678', note: 'Live and dead cells behave symmetrically.' },
  { name: 'Maze', rule: 'B3/S12345', note: 'Grows corridors.' },
  { name: 'Life without death', rule: 'B3/S012345678', note: 'Cells never die: ink blots.' },
  { name: 'Replicator', rule: 'B1357/S1357', note: 'Every pattern copies itself.' },
  { name: 'Diamoeba', rule: 'B35678/S5678', note: 'Big blobs with wobbly edges.' },
]

export function step(cells: Set<number>, rule: Rule): Set<number> {
  const counts = new Map<number, number>()
  for (const k of cells) {
    const [x, y] = unkey(k)
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue
        const n = key(x + dx, y + dy)
        counts.set(n, (counts.get(n) ?? 0) + 1)
      }
    }
  }
  const next = new Set<number>()
  for (const [k, n] of counts) {
    if (cells.has(k) ? rule.survive[n] : rule.birth[n]) next.add(k)
  }
  // Live cells with no live neighbours never show up in `counts`.
  if (rule.survive[0]) for (const k of cells) if (!counts.has(k)) next.add(k)
  return next
}

/**
 * Run-length encoded patterns, the standard Life file format: b = dead, o = alive,
 * $ = end of row, ! = end, with optional repeat counts ("3o2b$"). Returns [x, y] cells.
 */
export function parseRle(rle: string): [number, number][] {
  const body = rle
    .split('\n')
    .filter((line) => !line.startsWith('#') && !/^\s*x\s*=/.test(line))
    .join('')
  const cells: [number, number][] = []
  let x = 0
  let y = 0
  let count = ''
  for (const ch of body) {
    if (/\d/.test(ch)) {
      count += ch
      continue
    }
    const n = count ? Number(count) : 1
    count = ''
    if (ch === 'b' || ch === '.') x += n
    else if (ch === 'o' || ch === 'A') {
      for (let i = 0; i < n; i++) cells.push([x++, y])
    } else if (ch === '$') {
      y += n
      x = 0
    } else if (ch === '!') break
  }
  return cells
}

export const patterns: { name: string; rle: string }[] = [
  { name: 'Glider', rle: 'bob$2bo$3o!' },
  { name: 'Lightweight spaceship', rle: 'bo2bo$o4b$o3bo$4o!' },
  { name: 'Blinker', rle: '3o!' },
  { name: 'Pulsar', rle: '2b3o3b3o2b2$o4bobo4bo$o4bobo4bo$o4bobo4bo$2b3o3b3o2b2$2b3o3b3o2b$o4bobo4bo$o4bobo4bo$o4bobo4bo2$2b3o3b3o!' },
  { name: 'Pentadecathlon', rle: '2bo4bo2b$2ob4ob2o$2bo4bo!' },
  {
    name: 'Gosper glider gun',
    rle: '24bo11b$22bobo11b$12b2o6b2o12b2o$11bo3bo4b2o12b2o$2o8bo5bo3b2o14b$2o8bo3bob2o4bobo11b$10bo5bo7bo11b$11bo3bo20b$12b2o!',
  },
  { name: 'R-pentomino', rle: 'b2o$2ob$bo!' },
  { name: 'Acorn', rle: 'bo5b$3bo3b$2o2b3o!' },
  { name: 'Diehard', rle: '6bob$2o6b$bo3b3o!' },
]

/** Rotate a pattern a quarter turn clockwise, keeping it at the origin. */
export function rotate(cells: [number, number][]): [number, number][] {
  const maxY = Math.max(0, ...cells.map(([, y]) => y))
  return cells.map(([x, y]) => [maxY - y, x])
}

export function bounds(cells: Iterable<number>): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let b: { minX: number; minY: number; maxX: number; maxY: number } | null = null
  for (const k of cells) {
    const [x, y] = unkey(k)
    if (!b) b = { minX: x, minY: y, maxX: x, maxY: y }
    else {
      b.minX = Math.min(b.minX, x)
      b.minY = Math.min(b.minY, y)
      b.maxX = Math.max(b.maxX, x)
      b.maxY = Math.max(b.maxY, y)
    }
  }
  return b
}
