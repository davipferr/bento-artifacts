/**
 * Huffman coding: repeatedly merge the two lightest trees until one is left. Frequent
 * symbols end up near the root with short codes, rare ones deep down with long codes.
 */
export interface Node {
  id: number
  weight: number
  /** Set on leaves only. */
  symbol?: string
  left?: Node
  right?: Node
}

/** Symbol counts in order of first appearance. */
export function frequencies(text: string): Map<string, number> {
  const counts = new Map<string, number>()
  for (const ch of text) counts.set(ch, (counts.get(ch) ?? 0) + 1)
  return counts
}

/**
 * Build the tree, recording the forest after every merge (index 0 = only leaves).
 * Ties break by creation order, so the result is deterministic; the lighter tree goes left (bit 0).
 */
export function build(text: string): { root: Node | null; steps: Node[][] } {
  let id = 0
  const leaves = [...frequencies(text)]
    .sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1))
    .map(([symbol, weight]): Node => ({ id: id++, weight, symbol }))
  let forest = leaves
  const byWeight = (a: Node, b: Node) => a.weight - b.weight || a.id - b.id
  const steps = [forest]
  while (forest.length > 1) {
    const [left, right] = [...forest].sort(byWeight)
    const merged: Node = { id: id++, weight: left.weight + right.weight, left, right }
    // Keep the merged tree where its left child used to be, so the picture moves as little as possible.
    forest = forest.flatMap((n) => (n === left ? [merged] : n === right ? [] : [n]))
    steps.push(forest)
  }
  return { root: forest[0] ?? null, steps }
}

/** Code word per symbol. A one-symbol text still needs one bit per character. */
export function codes(root: Node | null): Map<string, string> {
  const out = new Map<string, string>()
  const walk = (n: Node, prefix: string) => {
    if (n.symbol !== undefined) out.set(n.symbol, prefix || '0')
    if (n.left) walk(n.left, prefix + '0')
    if (n.right) walk(n.right, prefix + '1')
  }
  if (root) walk(root, '')
  return out
}

export function encode(text: string, table: Map<string, string>): string {
  let bits = ''
  for (const ch of text) bits += table.get(ch)!
  return bits
}

export function decode(bits: string, root: Node | null): string {
  if (!root) return ''
  if (root.symbol !== undefined) return root.symbol.repeat(bits.length)
  let out = ''
  let node = root
  for (const bit of bits) {
    node = (bit === '0' ? node.left : node.right)!
    if (node.symbol !== undefined) {
      out += node.symbol
      node = root
    }
  }
  return out
}

/** Shannon entropy in bits per symbol: the floor no symbol-by-symbol code can beat. */
export function entropy(text: string): number {
  const n = [...text].length
  let h = 0
  for (const count of frequencies(text).values()) {
    const p = count / n
    h -= p * Math.log2(p)
  }
  return h
}

/** Bits per symbol for a fixed-length code over this alphabet. */
export const fixedWidth = (alphabet: number) => Math.max(1, Math.ceil(Math.log2(alphabet)))

export interface Placed {
  node: Node
  x: number
  depth: number
  parent?: Placed
  /** The bit on the edge from the parent. */
  bit?: '0' | '1'
}

/**
 * Tidy layout for a forest: leaves get consecutive x slots left to right, each parent sits
 * midway between its children, depth is the row.
 */
export function layout(forest: Node[]): Placed[] {
  const out: Placed[] = []
  let slot = 0
  const place = (node: Node, depth: number, parent?: Placed, bit?: '0' | '1'): Placed => {
    const p: Placed = { node, x: 0, depth, parent, bit }
    out.push(p)
    if (node.left && node.right) {
      const l = place(node.left, depth + 1, p, '0')
      const r = place(node.right, depth + 1, p, '1')
      p.x = (l.x + r.x) / 2
    } else p.x = slot++
    return p
  }
  for (const tree of forest) {
    place(tree, 0)
    slot += 0.5 // a little gap between separate trees
  }
  return out
}

/** Readable label for whitespace symbols. */
export const show = (symbol: string) => (symbol === ' ' ? '␣' : symbol === '\n' ? '↵' : symbol === '\t' ? '⇥' : symbol)
