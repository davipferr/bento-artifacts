/**
 * A falling-sand world: a grid where every cell holds one material, and each step every
 * cell looks at its neighbours and maybe moves or changes. Heavier things sink through
 * lighter ones, liquids spread sideways, gases rise, fire spreads to what burns.
 */

export const EMPTY = 0
export const WALL = 1
export const SAND = 2
export const WATER = 3
export const OIL = 4
export const WOOD = 5
export const FIRE = 6
export const SMOKE = 7
export const PLANT = 8

export interface Material {
  id: number
  name: string
  /** Base colour; each cell gets a slight random shade of it. */
  color: [number, number, number]
}

export const materials: Material[] = [
  { id: SAND, name: 'Sand', color: [222, 190, 120] },
  { id: WATER, name: 'Water', color: [45, 120, 220] },
  { id: OIL, name: 'Oil', color: [95, 70, 40] },
  { id: WOOD, name: 'Wood', color: [120, 78, 45] },
  { id: FIRE, name: 'Fire', color: [255, 120, 30] },
  { id: PLANT, name: 'Plant', color: [60, 170, 80] },
  { id: WALL, name: 'Wall', color: [120, 124, 132] },
  { id: SMOKE, name: 'Smoke', color: [150, 150, 155] },
  { id: EMPTY, name: 'Eraser', color: [13, 15, 20] },
]

/** How heavy each material is; things sink into lighter, non-solid neighbours. */
const DENSITY: Record<number, number> = { [EMPTY]: 0, [FIRE]: 0, [SMOKE]: 0.1, [OIL]: 0.9, [WATER]: 1, [SAND]: 3 }
const SOLID = new Set([WALL, WOOD, PLANT])
/** Chance per step that fire next door sets this alight. */
const FLAMMABLE: Record<number, number> = { [WOOD]: 0.04, [OIL]: 0.35, [PLANT]: 0.08 }

export interface World {
  width: number
  height: number
  cell: Uint8Array
  /** Remaining lifetime for fire and smoke. */
  life: Uint8Array
  /** Random per-cell shade, set when a cell is created. */
  shade: Uint8Array
  /** Step number when the cell last moved, so nothing moves twice in one step. */
  moved: Uint32Array
  step: number
}

export function createWorld(width: number, height: number): World {
  const n = width * height
  return { width, height, cell: new Uint8Array(n), life: new Uint8Array(n), shade: new Uint8Array(n), moved: new Uint32Array(n), step: 0 }
}

export function set(world: World, x: number, y: number, material: number, random: () => number = Math.random) {
  if (x < 0 || y < 0 || x >= world.width || y >= world.height) return
  const i = y * world.width + x
  world.cell[i] = material
  world.shade[i] = Math.floor(random() * 256)
  world.life[i] = material === FIRE ? 30 + Math.floor(random() * 40) : material === SMOKE ? 60 + Math.floor(random() * 60) : 0
}

export const get = (world: World, x: number, y: number) =>
  x < 0 || y < 0 || x >= world.width || y >= world.height ? WALL : world.cell[y * world.width + x]

/** Paint a disc. Materials only fill empty cells (so you don't erase by accident); the eraser clears. */
export function brush(world: World, cx: number, cy: number, radius: number, material: number, random: () => number = Math.random) {
  const loose = material === SAND || material === WATER || material === OIL || material === FIRE
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > radius * radius) continue
      const x = cx + dx
      const y = cy + dy
      if (material !== EMPTY && get(world, x, y) !== EMPTY) continue
      if (loose && random() > 0.5) continue // sprinkle loose stuff, so it falls as grains
      set(world, x, y, material, random)
    }
  }
}

function swap(world: World, i: number, j: number) {
  const { cell, life, shade, moved } = world
  ;[cell[i], cell[j]] = [cell[j], cell[i]]
  ;[life[i], life[j]] = [life[j], life[i]]
  ;[shade[i], shade[j]] = [shade[j], shade[i]]
  moved[j] = world.step
  moved[i] = world.step
}

/** Try each (dx, dy) in order; move into the first neighbour this material can displace. */
function tryMoves(world: World, x: number, y: number, moves: [number, number][], canEnter: (target: number) => boolean): boolean {
  for (const [dx, dy] of moves) {
    const nx = x + dx
    const ny = y + dy
    if (nx < 0 || ny < 0 || nx >= world.width || ny >= world.height) continue
    const j = ny * world.width + nx
    if (world.moved[j] === world.step) continue
    if (canEnter(world.cell[j])) {
      swap(world, y * world.width + x, j)
      return true
    }
  }
  return false
}

const sinksInto = (mover: number) => (target: number) => !SOLID.has(target) && target !== WALL && (DENSITY[target] ?? 99) < DENSITY[mover]

export function update(world: World, random: () => number = Math.random) {
  world.step++
  const { width, height, cell, life } = world
  // Bottom-up so falling things don't fall twice; alternate direction to avoid a sideways bias.
  const leftToRight = world.step % 2 === 0
  for (let y = height - 1; y >= 0; y--) {
    for (let k = 0; k < width; k++) {
      const x = leftToRight ? k : width - 1 - k
      const i = y * width + x
      const m = cell[i]
      if (m === EMPTY || m === WALL || world.moved[i] === world.step) continue
      const side = random() < 0.5 ? 1 : -1

      if (m === SAND) {
        tryMoves(world, x, y, [[0, 1], [side, 1], [-side, 1]], sinksInto(SAND))
      } else if (m === WATER || m === OIL) {
        tryMoves(world, x, y, [[0, 1], [side, 1], [-side, 1], [side, 0], [-side, 0]], sinksInto(m))
      } else if (m === SMOKE) {
        if (--life[i] === 0 || (y === 0 && random() < 0.1)) {
          cell[i] = EMPTY
          continue
        }
        tryMoves(world, x, y, [[0, -1], [side, -1], [-side, -1], [side, 0]], (t) => t === EMPTY)
      } else if (m === FIRE) {
        burn(world, x, y, random)
      } else if (m === PLANT) {
        // Plants drink neighbouring water and grow into it.
        if (random() < 0.03) {
          const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(random() * 4)]
          if (get(world, x + dx, y + dy) === WATER) set(world, x + dx, y + dy, PLANT, random)
        }
      }
    }
  }
}

function burn(world: World, x: number, y: number, random: () => number) {
  const i = y * world.width + x
  let fueled = false
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const t = get(world, x + dx, y + dy)
    if (t === WATER) {
      // Doused: the fire becomes steam.
      set(world, x, y, SMOKE, random)
      return
    }
    if (FLAMMABLE[t]) {
      fueled = true
      if (random() < FLAMMABLE[t]) set(world, x + dx, y + dy, FIRE, random)
    }
  }
  // A flame touching fuel ages slowly, so a spark on wood reliably catches.
  if ((!fueled || random() < 0.2) && --world.life[i] === 0) {
    set(world, x, y, random() < 0.6 ? SMOKE : EMPTY, random)
    return
  }
  // Flames with nothing to hold on to flicker upwards; flames on fuel stay and keep burning it.
  if (!fueled && random() < 0.35) tryMoves(world, x, y, [[0, -1], [random() < 0.5 ? 1 : -1, -1]], (t) => t === EMPTY)
}

export function count(world: World): Map<number, number> {
  const counts = new Map<number, number>()
  for (const m of world.cell) if (m !== EMPTY) counts.set(m, (counts.get(m) ?? 0) + 1)
  return counts
}

/** Ready-made scenes to start from. */
export function scene(world: World, name: 'beach' | 'campfire' | 'garden' | 'hourglass', random: () => number = Math.random) {
  world.cell.fill(EMPTY)
  world.life.fill(0)
  const { width: w, height: h } = world
  const fill = (x0: number, y0: number, x1: number, y1: number, m: number) => {
    for (let y = Math.max(0, y0); y < Math.min(h, y1); y++) for (let x = Math.max(0, x0); x < Math.min(w, x1); x++) set(world, x, y, m, random)
  }
  if (name === 'beach') {
    for (let x = 0; x < w; x++) {
      const top = Math.round(h * 0.6 + (x / w) * h * 0.25)
      fill(x, top, x + 1, h, SAND)
    }
    fill(0, Math.round(h * 0.55), Math.round(w * 0.45), Math.round(h * 0.8), WATER)
  } else if (name === 'campfire') {
    fill(0, h - 4, w, h, WALL)
    for (let k = 0; k < 4; k++) fill(Math.round(w * 0.4) + k * 4, h - 10 + k, Math.round(w * 0.6) - k * 4, h - 8 + k, WOOD)
    fill(Math.round(w * 0.1), h - 14, Math.round(w * 0.25), h - 4, OIL)
    fill(Math.round(w * 0.48), h - 12, Math.round(w * 0.52), h - 10, FIRE)
  } else if (name === 'garden') {
    fill(0, h - 6, w, h, SAND)
    for (let k = 0; k < 6; k++) fill(Math.round(((k + 0.5) * w) / 6), h - 8, Math.round(((k + 0.5) * w) / 6) + 2, h - 6, PLANT)
    fill(0, Math.round(h * 0.15), w, Math.round(h * 0.25), WATER)
  } else {
    const cx = Math.round(w / 2)
    for (let y = 0; y < h; y++) {
      const half = Math.abs(y - h / 2) * (w / h) * 0.7 + 2
      fill(0, y, cx - Math.round(half), y + 1, WALL)
      fill(cx + Math.round(half), y, w, y + 1, WALL)
    }
    fill(cx - Math.round(w * 0.3), 2, cx + Math.round(w * 0.3), Math.round(h * 0.3), SAND)
    // Re-wall anything the sand overwrote outside the glass.
    for (let y = 0; y < h; y++) {
      const half = Math.abs(y - h / 2) * (w / h) * 0.7 + 2
      for (let x = 0; x < w; x++) if (Math.abs(x - cx) >= half && get(world, x, y) === SAND) set(world, x, y, WALL, random)
    }
  }
}
