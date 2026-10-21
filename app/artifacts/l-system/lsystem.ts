/**
 * Lindenmayer systems: start from an axiom and rewrite every symbol in parallel with its
 * rule, again and again. The final string is then read by a turtle:
 *   F G (or the system's draw symbols)  forward, drawing
 *   f                                   forward, not drawing
 *   + -                                 turn left / right by the angle
 *   |                                   turn around
 *   [ ]                                 save / restore position and heading (branches)
 * Anything else (X, Y, A, B…) only steers the rewriting and is ignored by the turtle.
 */

export type Rules = Record<string, string>

export interface LSystem {
  name: string
  axiom: string
  rules: Rules
  angle: number
  iterations: number
  /** Initial heading in degrees: -90 points up (screen y grows downwards). */
  heading: number
  /** Symbols that draw a line. */
  draw: string
}

/** Strings longer than this stop growing: they'd take too long to draw. */
export const MAX_LENGTH = 1_500_000

export const presets: LSystem[] = [
  { name: 'Fractal plant', axiom: 'X', rules: { X: 'F+[[X]-X]-F[-FX]+X', F: 'FF' }, angle: 25, iterations: 6, heading: -90, draw: 'F' },
  { name: 'Bush', axiom: 'F', rules: { F: 'FF+[+F-F-F]-[-F+F+F]' }, angle: 22.5, iterations: 4, heading: -90, draw: 'F' },
  { name: 'Weed', axiom: 'F', rules: { F: 'F[+F]F[-F]F' }, angle: 25.7, iterations: 5, heading: -90, draw: 'F' },
  { name: 'Koch snowflake', axiom: 'F--F--F', rules: { F: 'F+F--F+F' }, angle: 60, iterations: 4, heading: 0, draw: 'F' },
  { name: 'Dragon curve', axiom: 'FX', rules: { X: 'X+YF+', Y: '-FX-Y' }, angle: 90, iterations: 12, heading: 0, draw: 'F' },
  { name: 'Sierpinski', axiom: 'F-G-G', rules: { F: 'F-G+F+G-F', G: 'GG' }, angle: 120, iterations: 6, heading: 0, draw: 'FG' },
  { name: 'Hilbert curve', axiom: 'A', rules: { A: '+BF-AFA-FB+', B: '-AF+BFB+FA-' }, angle: 90, iterations: 6, heading: 0, draw: 'F' },
  { name: 'Gosper curve', axiom: 'A', rules: { A: 'A-B--B+A++AA+B-', B: '+A-BB--B-A++A+B' }, angle: 60, iterations: 4, heading: 0, draw: 'AB' },
  { name: 'Lévy C curve', axiom: 'F', rules: { F: '+F--F+' }, angle: 45, iterations: 12, heading: 0, draw: 'F' },
]

/** Length of the string after one more rewrite, without building it. */
function nextLength(text: string, rules: Rules): number {
  let length = 0
  for (const ch of text) length += rules[ch]?.length ?? 1
  return length
}

export function expand(axiom: string, rules: Rules, iterations: number): { text: string; done: number; truncated: boolean } {
  let text = axiom
  for (let i = 0; i < iterations; i++) {
    if (nextLength(text, rules) > MAX_LENGTH) return { text, done: i, truncated: true }
    const parts: string[] = []
    for (const ch of text) parts.push(rules[ch] ?? ch)
    text = parts.join('')
  }
  return { text, done: iterations, truncated: false }
}

/** "F = FF" or "F -> FF" or "F → FF", one rule per line. Throws with a line number on mistakes. */
export function parseRules(source: string): Rules {
  const rules: Rules = {}
  source.split('\n').forEach((raw, index) => {
    const line = raw.trim()
    if (!line || line.startsWith('#')) return
    const m = /^(\S)\s*(?:=|->|→)\s*(\S*)$/.exec(line)
    if (!m) throw new Error(`Line ${index + 1}: write rules like "F = F+F"`)
    rules[m[1]] = m[2]
  })
  return rules
}

export const rulesText = (rules: Rules) =>
  Object.entries(rules)
    .map(([symbol, replacement]) => `${symbol} = ${replacement}`)
    .join('\n')

export interface Drawing {
  /** x1, y1, x2, y2 per segment, flattened. */
  lines: Float32Array
  /** Branch depth per segment (how many [ were open). */
  depth: Uint16Array
  count: number
  maxDepth: number
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
}

/** Walk the string with unit steps. `jitter` adds up to ± that many degrees to every turn. */
export function turtle(text: string, system: Pick<LSystem, 'angle' | 'heading' | 'draw'>, jitter = 0, random: () => number = Math.random): Drawing {
  let drawCount = 0
  for (const ch of text) if (system.draw.includes(ch)) drawCount++
  const lines = new Float32Array(drawCount * 4)
  const depth = new Uint16Array(drawCount)
  const stack: { x: number; y: number; heading: number }[] = []
  let x = 0
  let y = 0
  let heading = system.heading
  let count = 0
  let maxDepth = 0
  const bounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  const turn = (sign: number) => sign * system.angle + (jitter ? (random() * 2 - 1) * jitter : 0)

  for (const ch of text) {
    if (system.draw.includes(ch) || ch === 'f') {
      const rad = (heading * Math.PI) / 180
      const nx = x + Math.cos(rad)
      const ny = y + Math.sin(rad)
      if (ch !== 'f') {
        const k = count * 4
        lines[k] = x
        lines[k + 1] = y
        lines[k + 2] = nx
        lines[k + 3] = ny
        depth[count++] = stack.length
        maxDepth = Math.max(maxDepth, stack.length)
      }
      x = nx
      y = ny
      bounds.minX = Math.min(bounds.minX, x)
      bounds.maxX = Math.max(bounds.maxX, x)
      bounds.minY = Math.min(bounds.minY, y)
      bounds.maxY = Math.max(bounds.maxY, y)
    } else if (ch === '+') heading += turn(1)
    else if (ch === '-') heading += turn(-1)
    else if (ch === '|') heading += 180
    else if (ch === '[') stack.push({ x, y, heading })
    else if (ch === ']') {
      const saved = stack.pop()
      if (saved) ({ x, y, heading } = saved)
    }
  }
  return { lines, depth, count, maxDepth, bounds }
}
