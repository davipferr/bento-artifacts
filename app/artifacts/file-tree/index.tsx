import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type KeyboardEvent } from 'react'
import { build, children, count, create, iconFor, move, navigate, path, remove, rename, ROOT, stemRange, typeahead, visible, within, type Node, type Tree } from './tree'
import './style.css'

/** This very project, roughly. */
const START = build({
  '.github': { workflows: { 'deploy.yml': null } },
  app: {
    artifacts: {
      'file-tree': { 'index.tsx': null, 'meta.ts': null, 'style.css': null, 'tree.test.ts': null, 'tree.ts': null },
      'git-graph': { 'git.test.ts': null, 'git.ts': null, 'index.tsx': null, 'meta.ts': null },
      'swipe-deck': { 'index.tsx': null, 'swipe.ts': null },
      'types.ts': null,
    },
    kit: { 'canvas.ts': null, 'Controls.tsx': null, 'router.ts': null, 'theme.tsx': null },
    'App.tsx': null,
    'Gallery.tsx': null,
    'index.html': null,
    'main.tsx': null,
    'styles.css': null,
  },
  '.gitignore': null,
  'IDEAS.md': null,
  'package.json': null,
  'README.md': null,
  'tsconfig.json': null,
  'vite.config.ts': null,
})
const START_OPEN = ['app', 'app/kit']

/** A believable first few lines for the preview pane. */
function previewText(name: string): string {
  const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase()
  const stem = name.replace(/\.[^.]+$/, '').replace(/\.test$/, '')
  if (name.endsWith('.test.ts')) return `import { describe, expect, it } from 'vitest'\nimport { ${stem} } from './${stem}'\n\ndescribe('${stem}', () => {\n  it('works', () => {\n    expect(${stem}).toBeDefined()\n  })\n})`
  if (ext === 'tsx') return `import { useState } from 'react'\n\nexport default function ${stem.replace(/[^A-Za-z]/g, '') || 'Component'}() {\n  const [open, setOpen] = useState(false)\n  return <div onClick={() => setOpen(!open)} />\n}`
  if (ext === 'ts') return `/** ${stem}: pure logic, no DOM. */\nexport function ${stem.replace(/[^A-Za-z]/g, '') || 'run'}(input: string) {\n  return input.trim()\n}`
  if (ext === 'css') return `.${stem} {\n  display: grid;\n  gap: 12px;\n}`
  if (ext === 'json') return `{\n  "name": "bento-artifacts",\n  "private": true\n}`
  if (ext === 'md') return `# ${stem}\n\nA static gallery of small, self-contained interactive artifacts.`
  if (ext === 'yml' || ext === 'yaml') return `name: Deploy\non:\n  push:\n    branches: [main]`
  if (ext === 'html') return `<!doctype html>\n<html lang="en">\n  <body><div id="root"></div></body>\n</html>`
  return `(${name} is empty)`
}

interface Editing {
  id: string
  value: string
  error: string | null
  /** A just-created node: cancelling removes it again. */
  fresh: boolean
}

export default function FileTree() {
  const [tree, setTree] = useState<Tree>(START)
  const [expanded, setExpanded] = useState(() => new Set(Object.keys(START).filter((id) => START_OPEN.includes(path(START, id)))))
  const [focus, setFocus] = useState(() => Object.keys(START).find((id) => path(START, id) === 'app/kit/canvas.ts')!)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [undo, setUndo] = useState<{ tree: Tree; label: string } | null>(null)
  const [log, setLog] = useState<string[]>([])
  const rowRefs = useRef(new Map<string, HTMLDivElement>())
  const steer = useRef(false)
  const typed = useRef({ text: '', at: 0 })
  const hoverTimer = useRef<{ id: string; timer: number } | null>(null)
  /** The edit in progress as of the last render: a blur after Enter/Escape already finished must do nothing. */
  const editRef = useRef(editing)
  editRef.current = editing

  const rows = useMemo(() => visible(tree, expanded), [tree, expanded])
  const note = (text: string) => setLog((l) => [text, ...l].slice(0, 6))

  // Move DOM focus with the logical focus once the user has interacted.
  useEffect(() => {
    if (steer.current && !editing) rowRefs.current.get(focus)?.focus()
  }, [focus, editing, rows])

  const expand = (ids: string[]) => setExpanded((s) => new Set([...s, ...ids]))
  const collapse = (id: string) =>
    setExpanded((s) => {
      const next = new Set(s)
      next.delete(id)
      return next
    })
  const toggle = (node: Node) => (expanded.has(node.id) ? collapse(node.id) : expand([node.id]))

  /** New items go inside the focused folder, or next to the focused file. */
  const targetFolder = () => {
    const node = tree[focus]
    return !node ? ROOT : node.kind === 'folder' ? node.id : node.parent ?? ROOT
  }

  const startCreate = (kind: Node['kind']) => {
    const parent = targetFolder()
    const made = create(tree, parent, kind, kind === 'file' ? 'untitled.ts' : 'New folder')
    setTree(made.tree)
    if (parent !== ROOT) expand([parent])
    setFocus(made.id)
    setEditing({ id: made.id, value: made.tree[made.id].name, error: null, fresh: true })
  }

  const startRename = (id = focus) => {
    if (!tree[id]) return
    setEditing({ id, value: tree[id].name, error: null, fresh: false })
  }

  const commitEdit = (cancel = false) => {
    if (!editing) return
    steer.current = true
    const node = tree[editing.id]
    if (cancel) {
      if (editing.fresh) setTree(remove(tree, editing.id))
      setEditing(null)
      return
    }
    const result = rename(tree, editing.id, editing.value)
    if (!result.tree) {
      setEditing({ ...editing, error: result.error })
      return
    }
    setTree(result.tree)
    note(editing.fresh ? `Created ${path(result.tree, editing.id)}` : node.name === editing.value.trim() ? `Kept ${node.name}` : `Renamed ${node.name} → ${editing.value.trim()}`)
    setEditing(null)
  }

  const deleteNode = (id = focus) => {
    const node = tree[id]
    if (!node) return
    const index = rows.findIndex((r) => r.node.id === id)
    const next = remove(tree, id)
    const after = visible(next, expanded)
    setUndo({ tree, label: `Deleted ${node.name}` })
    setTree(next)
    setFocus(after[Math.min(index, after.length - 1)]?.node.id ?? ROOT)
    note(`Deleted ${path(tree, id)}${node.kind === 'folder' ? ' and everything in it' : ''}`)
  }

  const restore = () => {
    if (!undo) return
    setTree(undo.tree)
    note(`Undid: ${undo.label}`)
    setUndo(null)
  }

  const onRowKey = (e: KeyboardEvent<HTMLDivElement>, node: Node) => {
    if (editing) return
    steer.current = true
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault()
      return restore()
    }
    const nav = navigate(tree, rows, expanded, node.id, e.key)
    if (nav) {
      e.preventDefault()
      if (nav.expand) expand(nav.expand)
      if (nav.collapse) collapse(nav.collapse)
      setFocus(nav.focus)
      return
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (node.kind === 'folder') toggle(node)
      else note(`Opened ${path(tree, node.id)}`)
    } else if (e.key === 'F2') {
      e.preventDefault()
      startRename(node.id)
    } else if (e.key === 'Delete' || (e.key === 'Backspace' && (e.metaKey || e.ctrlKey))) {
      e.preventDefault()
      deleteNode(node.id)
    } else if (e.key.length === 1 && /\S/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Type-ahead: letters typed within 600 ms build up a prefix.
      const now = performance.now()
      const text = now - typed.current.at < 600 ? typed.current.text + e.key : e.key
      typed.current = { text, at: now }
      const hit = typeahead(rows, node.id, text)
      if (hit) setFocus(hit)
    }
  }

  // ---- Drag and drop ----------------------------------------------------

  /** Where a drop on this row lands: the folder itself, or a file's folder. */
  const dropFolder = (node: Node | null) => (!node ? ROOT : node.kind === 'folder' ? node.id : node.parent ?? ROOT)
  const canDrop = (folder: string) => !!dragging && !within(tree, folder, dragging) && tree[dragging]?.parent !== folder

  const onDragOver = (e: DragEvent, node: Node | null) => {
    const folder = dropFolder(node)
    e.stopPropagation()
    if (!canDrop(folder)) {
      setDropTarget(null)
      return
    }
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropTarget(folder)
    // Hovering a closed folder opens it after a moment, so you can drop deep inside.
    if (node?.kind === 'folder' && !expanded.has(node.id) && hoverTimer.current?.id !== node.id) {
      if (hoverTimer.current) clearTimeout(hoverTimer.current.timer)
      hoverTimer.current = { id: node.id, timer: window.setTimeout(() => expand([node.id]), 650) }
    }
  }

  const onDrop = (e: DragEvent, node: Node | null) => {
    e.preventDefault()
    e.stopPropagation()
    const folder = dropFolder(node)
    const id = dragging
    endDrag()
    if (!id) return
    const result = move(tree, id, folder)
    if (!result.tree) return note(`Can’t move: ${result.error}`)
    setUndo({ tree, label: `Moved ${tree[id].name}` })
    setTree(result.tree)
    if (folder !== ROOT) expand([folder])
    setFocus(id)
    steer.current = true
    note(`Moved ${tree[id].name} → ${folder === ROOT ? '(root)' : path(tree, folder)}/`)
  }

  const endDrag = () => {
    setDragging(null)
    setDropTarget(null)
    if (hoverTimer.current) clearTimeout(hoverTimer.current.timer)
    hoverTimer.current = null
  }

  // ---- Render -----------------------------------------------------------

  const current = tree[focus]
  const totals = count(tree, ROOT)
  const crumbs = current
    ? path(tree, current.id)
        .split('/')
        .map((name, i, all) => ({ name, id: Object.keys(tree).find((id) => path(tree, id) === all.slice(0, i + 1).join('/'))! }))
    : []

  return (
    <div className="ft-layout">
      <div className="card ft-explorer">
        <div className="ft-toolbar">
          <span className="ft-title">Explorer</span>
          <span className="spacer" />
          <button className="ft-tool" title="New file" aria-label="New file" onClick={() => startCreate('file')}>
            ＋📄
          </button>
          <button className="ft-tool" title="New folder" aria-label="New folder" onClick={() => startCreate('folder')}>
            ＋📁
          </button>
          <button className="ft-tool" title="Rename (F2)" aria-label="Rename" onClick={() => startRename()} disabled={!current || current.id === ROOT}>
            ✎
          </button>
          <button className="ft-tool" title="Delete (Del)" aria-label="Delete" onClick={() => deleteNode()} disabled={!current || current.id === ROOT}>
            🗑
          </button>
          <button className="ft-tool" title="Collapse all" aria-label="Collapse all" onClick={() => setExpanded(new Set())}>
            ⊟
          </button>
          <button
            className="ft-tool"
            title="Expand all"
            aria-label="Expand all"
            onClick={() => setExpanded(new Set(Object.values(tree).filter((n) => n.kind === 'folder').map((n) => n.id)))}
          >
            ⊞
          </button>
        </div>

        <div
          className={`ft-tree${dropTarget === ROOT ? ' drop-root' : ''}`}
          role="tree"
          aria-label="Project files"
          onDragOver={(e) => onDragOver(e, null)}
          onDrop={(e) => onDrop(e, null)}
          onDragLeave={(e) => {
            if (e.currentTarget === e.target) setDropTarget(null)
          }}
        >
          {rows.map(({ node, depth, size, pos }) => {
            const open = expanded.has(node.id)
            const icon = iconFor(node.name, node.kind, open)
            const isEditing = editing?.id === node.id
            const inZone = dropTarget && dropTarget !== ROOT && within(tree, node.id, dropTarget)
            const classes = [
              'ft-row',
              node.id === focus ? 'focused' : '',
              dragging === node.id ? 'dragging' : '',
              inZone ? 'drop-zone' : '',
              dropTarget === node.id ? 'drop-target' : '',
            ]
            return (
              <div
                key={node.id}
                ref={(el) => {
                  if (el) rowRefs.current.set(node.id, el)
                  else rowRefs.current.delete(node.id)
                }}
                role="treeitem"
                aria-level={depth + 1}
                aria-setsize={size}
                aria-posinset={pos}
                aria-expanded={node.kind === 'folder' ? open : undefined}
                aria-selected={node.id === focus}
                tabIndex={node.id === focus ? 0 : -1}
                className={classes.filter(Boolean).join(' ')}
                style={{ '--depth': depth } as CSSProperties}
                draggable={!isEditing}
                onClick={() => {
                  setFocus(node.id)
                  if (node.kind === 'folder') toggle(node)
                }}
                onDoubleClick={() => node.kind === 'file' && startRename(node.id)}
                onKeyDown={(e) => onRowKey(e, node)}
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', path(tree, node.id))
                  e.dataTransfer.effectAllowed = 'move'
                  setDragging(node.id)
                }}
                onDragEnd={endDrag}
                onDragOver={(e) => onDragOver(e, node)}
                onDrop={(e) => onDrop(e, node)}
              >
                <span className="ft-indent" aria-hidden />
                <span className={`ft-chevron${node.kind === 'folder' ? (open ? ' open' : '') : ' none'}`} aria-hidden>
                  ›
                </span>
                <span className={`ft-icon ${icon.tone}`} aria-hidden>
                  {icon.label}
                </span>
                {isEditing ? (
                  <span className="ft-edit">
                    <input
                      autoFocus
                      className={editing.error ? 'invalid' : ''}
                      value={editing.value}
                      aria-label={`Rename ${node.name}`}
                      aria-invalid={!!editing.error}
                      onClick={(e) => e.stopPropagation()}
                      onFocus={(e) => e.target.setSelectionRange(...stemRange(node.name, node.kind))}
                      onChange={(e) => setEditing({ ...editing, value: e.target.value, error: null })}
                      onKeyDown={(e) => {
                        e.stopPropagation()
                        if (e.key === 'Enter') commitEdit()
                        else if (e.key === 'Escape') commitEdit(true)
                      }}
                      onBlur={() => {
                        if (editRef.current?.id !== node.id) return
                        // Leaving the box keeps a valid name and drops an invalid one.
                        const ok = !rename(tree, editing.id, editing.value).error
                        commitEdit(!ok)
                      }}
                    />
                    {editing.error && <span className="ft-error">{editing.error}</span>}
                  </span>
                ) : (
                  <span className="ft-name">{node.name}</span>
                )}
              </div>
            )
          })}
          {rows.length === 0 && <p className="muted small ft-empty">Empty. Use ＋ to add a file.</p>}
        </div>
        <p className="hint ft-hint">
          {totals.files} files · {totals.folders} folders · drag rows onto folders (or the empty space for the root)
        </p>
      </div>

      <div className="ft-right">
        <div className="card ft-details">
          {current && current.id !== ROOT ? (
            <>
              <nav className="ft-crumbs" aria-label="Path">
                {crumbs.map((c, i) => (
                  <span key={c.id}>
                    {i > 0 && <span className="muted"> / </span>}
                    <button
                      className="ft-crumb"
                      onClick={() => {
                        steer.current = true
                        setFocus(c.id)
                      }}
                    >
                      {c.name}
                    </button>
                  </span>
                ))}
              </nav>
              {current.kind === 'file' ? (
                <pre className="ft-code mono">{previewText(current.name)}</pre>
              ) : (
                <div className="ft-folder">
                  {(() => {
                    const c = count(tree, current.id)
                    return (
                      <p className="small muted">
                        {c.files} files and {c.folders} folders inside.
                      </p>
                    )
                  })()}
                  <div className="ft-grid">
                    {children(tree, current.id).map((child) => {
                      const icon = iconFor(child.name, child.kind)
                      return (
                        <button
                          key={child.id}
                          className="ft-tile"
                          onClick={() => {
                            steer.current = true
                            setExpanded((s) => new Set([...s, current.id]))
                            setFocus(child.id)
                          }}
                        >
                          <span className={`ft-icon ${icon.tone}`}>{icon.label}</span>
                          <span>{child.name}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="muted">Nothing selected.</p>
          )}
          {undo && (
            <div className="ft-undo" role="status">
              <span>{undo.label}</span>
              <button className="chip" onClick={restore}>
                Undo
              </button>
            </div>
          )}
        </div>

        <div className="card ft-help">
          <h3>Keyboard</h3>
          <dl className="ft-keys small">
            <dt>↑ ↓</dt>
            <dd>move</dd>
            <dt>→ ←</dt>
            <dd>expand / enter · collapse / go to parent</dd>
            <dt>Home End</dt>
            <dd>first / last row</dd>
            <dt>a–z</dt>
            <dd>jump to a name (type quickly for more letters)</dd>
            <dt>*</dt>
            <dd>expand all folders at this level</dd>
            <dt>F2 · Enter</dt>
            <dd>rename · open / toggle</dd>
            <dt>Del · Ctrl Z</dt>
            <dd>delete · undo</dd>
          </dl>
          {log.length > 0 && (
            <ol className="ft-log small">
              {log.map((l, i) => (
                <li key={`${log.length - i}`}>{l}</li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  )
}
