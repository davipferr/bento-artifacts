/**
 * A file tree as a flat map of nodes with parent links, plus the operations an explorer
 * needs: sorted children, the visible rows, rename/move/create/delete with validation,
 * and the WAI-ARIA tree keyboard model. Every operation returns a new tree.
 */
export interface Node {
  id: string
  name: string
  kind: 'file' | 'folder'
  parent: string | null
}

export type Tree = Record<string, Node>

export const ROOT = 'root'

/** Nested spec → tree: `{ app: { 'main.tsx': null } }`, where null is a file. */
export type Spec = { [name: string]: Spec | null }

export function build(spec: Spec): Tree {
  const tree: Tree = { [ROOT]: { id: ROOT, name: '', kind: 'folder', parent: null } }
  let n = 0
  const add = (parent: string, entries: Spec) => {
    for (const [name, child] of Object.entries(entries)) {
      const id = `n${++n}`
      tree[id] = { id, name, kind: child ? 'folder' : 'file', parent }
      if (child) add(id, child)
    }
  }
  add(ROOT, spec)
  return tree
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

/** Folders first, then natural order: file2 before file10. */
export function children(tree: Tree, id: string): Node[] {
  return Object.values(tree)
    .filter((node) => node.parent === id)
    .sort((a, b) => (a.kind === b.kind ? collator.compare(a.name, b.name) : a.kind === 'folder' ? -1 : 1))
}

export function path(tree: Tree, id: string): string {
  const parts: string[] = []
  for (let at: Node | undefined = tree[id]; at && at.id !== ROOT; at = at.parent ? tree[at.parent] : undefined) parts.unshift(at.name)
  return parts.join('/')
}

/** Is `id` the same as `ancestor` or somewhere inside it? */
export function within(tree: Tree, id: string, ancestor: string): boolean {
  for (let at: string | null = id; at; at = tree[at]?.parent ?? null) if (at === ancestor) return true
  return false
}

export function validateName(tree: Tree, parent: string, name: string, self?: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return 'A name is required.'
  if (/[\\/]/.test(trimmed)) return 'Names can’t contain / or \\.'
  if (trimmed === '.' || trimmed === '..') return `“${trimmed}” is reserved.`
  if (trimmed.length > 64) return 'Keep it under 64 characters.'
  const clash = children(tree, parent).find((c) => c.id !== self && c.name.toLowerCase() === trimmed.toLowerCase())
  if (clash) return `A ${clash.kind} named “${clash.name}” already exists here.`
  return null
}

export type Outcome = { tree: Tree; error?: undefined } | { tree?: undefined; error: string }

export function rename(tree: Tree, id: string, name: string): Outcome {
  const node = tree[id]
  const error = validateName(tree, node.parent ?? ROOT, name, id)
  if (error) return { error }
  return { tree: { ...tree, [id]: { ...node, name: name.trim() } } }
}

export function move(tree: Tree, id: string, target: string): Outcome {
  const node = tree[id]
  if (tree[target]?.kind !== 'folder') return { error: 'You can only drop into a folder.' }
  if (within(tree, target, id)) return { error: 'A folder can’t move inside itself.' }
  if (node.parent === target) return { tree }
  const error = validateName(tree, target, node.name, id)
  if (error) return { error }
  return { tree: { ...tree, [id]: { ...node, parent: target } } }
}

/** Create a node with a free name based on `base` ("untitled.ts", "untitled 2.ts", …). */
export function create(tree: Tree, parent: string, kind: Node['kind'], base: string): { tree: Tree; id: string } {
  const dot = kind === 'file' ? base.lastIndexOf('.') : -1
  const stem = dot > 0 ? base.slice(0, dot) : base
  const ext = dot > 0 ? base.slice(dot) : ''
  let name = base
  for (let i = 2; validateName(tree, parent, name); i++) name = `${stem} ${i}${ext}`
  let n = Object.keys(tree).length
  while (tree[`n${n}`]) n++
  const id = `n${n}`
  return { tree: { ...tree, [id]: { id, name, kind, parent } }, id }
}

/** Remove a node and everything under it. */
export function remove(tree: Tree, id: string): Tree {
  const next: Tree = {}
  for (const [key, node] of Object.entries(tree)) if (!within(tree, key, id)) next[key] = node
  return next
}

export const count = (tree: Tree, id: string) => {
  const inside = Object.keys(tree).filter((key) => key !== id && within(tree, key, id))
  return { files: inside.filter((k) => tree[k].kind === 'file').length, folders: inside.filter((k) => tree[k].kind === 'folder').length }
}

export interface Row {
  node: Node
  depth: number
  /** For aria-setsize / aria-posinset. */
  size: number
  pos: number
}

/** The rows on screen: a depth-first walk that only enters expanded folders. */
export function visible(tree: Tree, expanded: Set<string>): Row[] {
  const rows: Row[] = []
  const walk = (id: string, depth: number) => {
    const list = children(tree, id)
    list.forEach((node, i) => {
      rows.push({ node, depth, size: list.length, pos: i + 1 })
      if (node.kind === 'folder' && expanded.has(node.id)) walk(node.id, depth + 1)
    })
  }
  walk(ROOT, 0)
  return rows
}

export interface Nav {
  focus: string
  expand?: string[]
  collapse?: string
}

/** The WAI-ARIA tree pattern: what a key does to focus and expansion. */
export function navigate(tree: Tree, rows: Row[], expanded: Set<string>, focus: string, key: string): Nav | null {
  const i = rows.findIndex((r) => r.node.id === focus)
  if (i < 0) return rows[0] ? { focus: rows[0].node.id } : null
  const node = rows[i].node
  const open = node.kind === 'folder' && expanded.has(node.id)
  switch (key) {
    case 'ArrowDown':
      return { focus: rows[Math.min(rows.length - 1, i + 1)].node.id }
    case 'ArrowUp':
      return { focus: rows[Math.max(0, i - 1)].node.id }
    case 'Home':
      return { focus: rows[0].node.id }
    case 'End':
      return { focus: rows[rows.length - 1].node.id }
    case 'ArrowRight':
      if (node.kind !== 'folder') return { focus }
      if (!open) return { focus, expand: [node.id] }
      return { focus: children(tree, node.id)[0]?.id ?? focus }
    case 'ArrowLeft':
      if (open) return { focus, collapse: node.id }
      return { focus: node.parent && node.parent !== ROOT ? node.parent : focus }
    case '*':
      // Expand every folder at this level.
      return { focus, expand: children(tree, node.parent ?? ROOT).filter((c) => c.kind === 'folder').map((c) => c.id) }
    default:
      return null
  }
}

/** Type-ahead: the next visible row (after the focused one, wrapping) whose name starts with `prefix`. */
export function typeahead(rows: Row[], focus: string, prefix: string): string | null {
  const start = rows.findIndex((r) => r.node.id === focus)
  const p = prefix.toLowerCase()
  // A repeated single letter cycles; a longer prefix may still match the current row.
  const offset = p.length > 1 ? 0 : 1
  for (let k = 0; k < rows.length; k++) {
    const row = rows[(start + offset + k) % rows.length]
    if (row.node.name.toLowerCase().startsWith(p)) return row.node.id
  }
  return null
}

/** The part of a name to pre-select when renaming: the stem, not the extension (like VS Code). */
export function stemRange(name: string, kind: Node['kind']): [number, number] {
  const dot = name.lastIndexOf('.')
  return kind === 'file' && dot > 0 ? [0, dot] : [0, name.length]
}

/** A short coloured badge for the file icon, by extension or well-known name. */
export function iconFor(name: string, kind: Node['kind'], open = false): { label: string; tone: string } {
  if (kind === 'folder') return { label: open ? '📂' : '📁', tone: 'folder' }
  const lower = name.toLowerCase()
  if (lower === 'package.json') return { label: 'npm', tone: 'red' }
  if (lower.startsWith('readme')) return { label: 'i', tone: 'blue' }
  if (lower === '.gitignore') return { label: 'git', tone: 'orange' }
  if (/\.test\.[jt]sx?$/.test(lower)) return { label: '✓', tone: 'green' }
  const ext = lower.includes('.') ? lower.slice(lower.lastIndexOf('.') + 1) : ''
  const table: Record<string, { label: string; tone: string }> = {
    ts: { label: 'TS', tone: 'blue' },
    tsx: { label: '⚛', tone: 'cyan' },
    js: { label: 'JS', tone: 'yellow' },
    jsx: { label: '⚛', tone: 'cyan' },
    css: { label: '#', tone: 'violet' },
    html: { label: '<>', tone: 'orange' },
    json: { label: '{}', tone: 'yellow' },
    md: { label: 'M↓', tone: 'gray' },
    yml: { label: '!', tone: 'red' },
    yaml: { label: '!', tone: 'red' },
    png: { label: '▣', tone: 'green' },
    svg: { label: '◇', tone: 'orange' },
  }
  return table[ext] ?? { label: '·', tone: 'gray' }
}
