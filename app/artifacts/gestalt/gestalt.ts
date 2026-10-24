/**
 * One field of dots, six Gestalt cues that can each pull it into a different grouping, and a
 * deliberately rough model of which grouping wins. The weights follow the usual ranking in the
 * research (common fate and connectedness beat common region, which beats proximity, which beats
 * similarity), not exact data.
 */
export const COLS = 8
export const ROWS = 6

export interface Settings {
  /** -1…1. Above 0 the dots in a row move closer (you see rows); below 0 the columns do. */
  proximity: number
  /** 0…1. Every other row turns a different colour. */
  color: number
  /** 0…1. Every other column turns square. */
  shape: number
  /** 0…1. Boxes drawn round 2 × 2 blocks. */
  region: number
  /** 0…1. Lines join dots in horizontal pairs. */
  connect: number
  /** 0…1. Every other column moves up and down together. */
  fate: number
}

export const NEUTRAL: Settings = { proximity: 0, color: 0, shape: 0, region: 0, connect: 0, fate: 0 }

export type Principle = keyof Settings
export type Grouping = 'rows' | 'columns' | 'blocks' | 'pairs' | 'movers'

export const GROUPING_NAME: Record<Grouping, string> = {
  rows: 'Rows',
  columns: 'Columns',
  blocks: '2 × 2 boxes',
  pairs: 'Linked pairs',
  movers: 'Every other column',
}

export const PRINCIPLE_NAME: Record<Principle, string> = {
  proximity: 'Proximity',
  color: 'Similar colour',
  shape: 'Similar shape',
  region: 'Common region',
  connect: 'Connectedness',
  fate: 'Common fate',
}

export const WEIGHT: Record<Principle, number> = {
  fate: 1.4,
  connect: 1.3,
  region: 1.2,
  proximity: 1,
  color: 0.8,
  shape: 0.6,
}

export interface Dot {
  x: number
  y: number
  row: number
  col: number
}

/** Dot centres in a width × height box. Proximity squeezes one axis and stretches the other. */
export function layout(proximity: number, width: number, height: number): Dot[] {
  const p = Math.max(-1, Math.min(1, proximity))
  const gx = 1 - 0.5 * p
  const gy = 1 + 0.5 * p
  const unit = Math.min(width / ((COLS - 1) * gx + 2), height / ((ROWS - 1) * gy + 2))
  const ox = (width - (COLS - 1) * gx * unit) / 2
  const oy = (height - (ROWS - 1) * gy * unit) / 2
  const dots: Dot[] = []
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) dots.push({ x: ox + col * gx * unit, y: oy + row * gy * unit, row, col })
  }
  return dots
}

export interface Reading {
  grouping: Grouping
  score: number
  because: Principle[]
}

/** Which way each cue pulls, and how hard. */
function pulls(s: Settings): { principle: Principle; grouping: Grouping; strength: number }[] {
  return [
    { principle: 'proximity', grouping: s.proximity >= 0 ? 'rows' : 'columns', strength: Math.abs(s.proximity) },
    { principle: 'color', grouping: 'rows', strength: s.color },
    { principle: 'shape', grouping: 'columns', strength: s.shape },
    { principle: 'region', grouping: 'blocks', strength: s.region },
    { principle: 'connect', grouping: 'pairs', strength: s.connect },
    { principle: 'fate', grouping: 'movers', strength: s.fate },
  ]
}

/** Score every grouping that something is pulling towards, strongest first. */
export function perceive(s: Settings): Reading[] {
  const scores = new Map<Grouping, Reading>()
  for (const { principle, grouping, strength } of pulls(s)) {
    if (strength <= 0.02) continue
    const r = scores.get(grouping) ?? { grouping, score: 0, because: [] }
    r.score += strength * WEIGHT[principle]
    r.because.push(principle)
    scores.set(grouping, r)
  }
  return [...scores.values()].sort((a, b) => b.score - a.score)
}

/**
 * The same idea in a form: a label should sit closer to its own field than to the one above.
 * `labelGap` is label→own field, `fieldGap` is the previous field→label.
 */
export function labelReads(labelGap: number, fieldGap: number): 'own' | 'ambiguous' | 'previous' {
  if (fieldGap >= labelGap * 1.5) return 'own'
  if (labelGap >= fieldGap * 1.5) return 'previous'
  return 'ambiguous'
}
