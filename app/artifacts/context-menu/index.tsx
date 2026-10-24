import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
import { Checkbox, Segmented } from '../../kit/Controls'
import { entryTop, inTriangle, ITEM_H, MENU_W, menuHeight, placeMenu, placeSubmenu, safeTriangle, step, typeahead, type Entry, type P, type Rect } from './menu'
import './style.css'

const MENU: Entry[] = [
  { label: 'Open', shortcut: '↵' },
  {
    label: 'Open with',
    children: [{ label: 'Text editor' }, { label: 'Image viewer' }, { label: 'Browser' }, { label: 'Terminal' }, { separator: true }, { label: 'Choose another app…' }],
  },
  {
    label: 'Share',
    children: [{ label: 'Copy link' }, { label: 'Email' }, { label: 'Messages' }, { label: 'Nearby devices' }, { label: 'Notes' }, { label: 'Reminders' }, { label: 'More…' }],
  },
  { separator: true },
  { label: 'Copy', shortcut: 'Ctrl C' },
  { label: 'Duplicate', shortcut: 'Ctrl D' },
  { label: 'Rename', shortcut: 'F2' },
  {
    label: 'Move to',
    children: [{ label: 'Desktop' }, { label: 'Documents' }, { label: 'Downloads' }, { label: 'Pictures' }, { label: 'Projects' }],
  },
  {
    label: 'Tags',
    children: [
      { label: 'Red', dot: '#fa5252' },
      { label: 'Orange', dot: '#fd7e14' },
      { label: 'Green', dot: '#40c057' },
      { label: 'Blue', dot: '#4c6ef5' },
      { label: 'Purple', dot: '#ae3ec9' },
    ],
  },
  { separator: true },
  { label: 'Compress', disabled: true },
  { label: 'Move to Trash', shortcut: 'Del', danger: true },
]

const FILES = [
  { name: 'Roadmap.pdf', icon: '📄', x: 0.08, y: 0.1 },
  { name: 'Holiday.jpg', icon: '🖼️', x: 0.08, y: 0.42 },
  { name: 'notes.md', icon: '📝', x: 0.3, y: 0.18 },
  { name: 'Projects', icon: '📁', x: 0.55, y: 0.12 },
  { name: 'budget.xlsx', icon: '📊', x: 0.86, y: 0.75 },
]

const MODES = [
  { value: 'triangle', label: 'Safe triangle' },
  { value: 'naive', label: 'Instant switch' },
  { value: 'delay', label: '300 ms delay' },
] as const
type Mode = (typeof MODES)[number]['value']

/** How long the pointer may rest inside the triangle before we believe it really means the sibling. */
const SETTLE = 250

interface Open {
  file: string
  at: ReturnType<typeof placeMenu>
  /** Highlighted root entry, and which root entry has its submenu out. */
  active: number
  sub: number | null
  subActive: number
  /** Where keyboard focus is. */
  level: 'root' | 'sub'
}

export default function ContextMenu() {
  const stage = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const subRef = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<Mode>('triangle')
  const [debug, setDebug] = useState(true)
  const [open, setOpen] = useState<Open | null>(null)
  const [pointer, setPointer] = useState<P | null>(null)
  const [trail, setTrail] = useState<P[]>([])
  const [log, setLog] = useState<string[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [stats, setStats] = useState({ kept: 0, switched: 0 })
  const anchor = useRef<P | null>(null)
  const timer = useRef<number | null>(null)
  const longPress = useRef<number | null>(null)

  const note = (text: string) => setLog((l) => [text, ...l].slice(0, 6))
  const clearTimer = () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
  }
  const size = () => ({ w: stage.current?.clientWidth ?? 700, h: stage.current?.clientHeight ?? 460 })
  const local = (e: { clientX: number; clientY: number }): P => {
    const r = stage.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const show = (file: string, at: P) => {
    const rect = placeMenu(at, { w: MENU_W, h: menuHeight(MENU) }, size())
    setOpen({ file, at: rect, active: -1, sub: null, subActive: -1, level: 'root' })
    clearTimer()
    requestAnimationFrame(() => rootRef.current?.focus())
  }
  const close = (focusFile = true) => {
    const file = open?.file
    setOpen(null)
    clearTimer()
    if (focusFile && file) (stage.current?.querySelector(`[data-file="${file}"]`) as HTMLElement | null)?.focus()
  }

  // Geometry of the open submenu, derived from fixed row heights.
  const subRect = (o: Open, index = o.sub): (Rect & { opensRight: boolean }) | null => {
    if (index === null || !MENU[index].children) return null
    const item = { x: o.at.x, y: o.at.y + entryTop(MENU, index), w: MENU_W, h: ITEM_H }
    return placeSubmenu(item, { w: MENU_W, h: menuHeight(MENU[index].children!) }, size())
  }

  const switchTo = (o: Open, index: number, why: string) => {
    clearTimer()
    const opensSub = MENU[index].children ? index : null
    if (o.sub !== null && o.sub !== index) {
      setStats((s) => ({ ...s, switched: s.switched + 1 }))
      note(`${why}: ${MENU[o.sub].label} → ${MENU[index].label}`)
    }
    setOpen({ ...o, active: index, sub: opensSub, subActive: -1, level: 'root' })
  }

  const run = (label: string, parent?: string) => {
    const what = parent ? `${parent} → ${label}` : label
    setToast(`${what} · ${open?.file}`)
    note(`Ran “${what}”`)
    window.setTimeout(() => setToast((t) => (t?.startsWith(what) ? null : t)), 1600)
    close()
  }

  /** Pointer over a root entry: the heart of the safe-triangle logic. */
  const hoverRoot = (index: number, p: P) => {
    if (!open || MENU[index].separator || MENU[index].disabled) return
    if (index === open.sub || (open.sub === null && index === open.active)) {
      anchor.current = p
      clearTimer()
      if (open.active !== index) setOpen({ ...open, active: index })
      return
    }
    const sub = subRect(open)
    if (mode === 'naive' || !sub) return switchTo(open, index, 'Switched')
    if (mode === 'delay') {
      clearTimer()
      timer.current = window.setTimeout(() => switchTo(open, index, 'Switched after the delay'), 300)
      return
    }
    const [a, b, c] = safeTriangle(anchor.current ?? p, sub, sub.opensRight)
    if (inTriangle(p, a, b, c)) {
      // Heading for the submenu: keep it open, but switch if the pointer stops here.
      if (timer.current === null) {
        setStats((s) => ({ ...s, kept: s.kept + 1 }))
        note(`Kept ${MENU[open.sub!].label} open: pointer inside the triangle over “${MENU[index].label}”`)
      }
      clearTimer()
      timer.current = window.setTimeout(() => switchTo(open, index, 'Pointer rested, switched'), SETTLE)
    } else switchTo(open, index, 'Left the triangle, switched')
  }

  const onStageMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!open) return
    const p = local(e)
    setPointer(p)
    setTrail((t) => [...t.slice(-40), p])
  }

  // Close on outside clicks or when the window loses focus.
  useEffect(() => {
    if (!open) return
    const onDown = (e: globalThis.MouseEvent) => {
      const t = e.target as Node
      if (!rootRef.current?.contains(t) && !subRef.current?.contains(t)) close(false)
    }
    const onBlur = () => close(false)
    document.addEventListener('mousedown', onDown)
    window.addEventListener('blur', onBlur)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('blur', onBlur)
    }
  })

  useEffect(() => {
    if (open?.level === 'sub') subRef.current?.focus()
    else if (open) rootRef.current?.focus()
  }, [open?.level, open?.sub])

  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!open) return
    const inSub = open.level === 'sub' && open.sub !== null
    const list = inSub ? MENU[open.sub!].children! : MENU
    const at = inSub ? open.subActive : open.active
    const set = (i: number) => setOpen(inSub ? { ...open, subActive: i } : { ...open, active: i, sub: null })
    if (e.key === 'ArrowDown') set(step(list, at, 1))
    else if (e.key === 'ArrowUp') set(step(list, at < 0 ? 0 : at, -1))
    else if (e.key === 'Home') set(step(list, -1, 1))
    else if (e.key === 'End') set(step(list, 0, -1))
    else if ((e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') && !inSub && MENU[at]?.children) {
      setOpen({ ...open, active: at, sub: at, level: 'sub', subActive: step(MENU[at].children!, -1, 1) })
    } else if ((e.key === 'ArrowLeft' || e.key === 'Escape') && inSub) setOpen({ ...open, level: 'root', sub: null })
    else if (e.key === 'Escape' || e.key === 'Tab') close()
    else if (e.key === 'Enter' || e.key === ' ') {
      if (at >= 0 && list[at].label) run(list[at].label!, inSub ? MENU[open.sub!].label : undefined)
    } else if (e.key.length === 1 && /\S/.test(e.key)) set(typeahead(list, at, e.key))
    else return
    e.preventDefault()
  }

  const onFileKey = (e: KeyboardEvent<HTMLButtonElement>, name: string) => {
    if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
      e.preventDefault()
      const r = e.currentTarget.getBoundingClientRect()
      show(name, local({ clientX: r.left + r.width / 2, clientY: r.bottom }))
    }
  }

  const sub = open ? subRect(open) : null
  const tri = open && sub && anchor.current && mode === 'triangle' ? safeTriangle(anchor.current, sub, sub.opensRight) : null
  const inside = tri && pointer ? inTriangle(pointer, ...tri) : false

  const renderEntries = (entries: Entry[], activeIndex: number, level: 'root' | 'sub', parent?: string) =>
    entries.map((e, i) =>
      e.separator ? (
        <div key={i} className="cm-sep" role="separator" />
      ) : (
        <div
          key={i}
          role="menuitem"
          aria-haspopup={e.children ? 'menu' : undefined}
          aria-expanded={e.children ? open?.sub === i : undefined}
          aria-disabled={e.disabled || undefined}
          className={`cm-item${i === activeIndex ? ' active' : ''}${e.danger ? ' danger' : ''}${e.disabled ? ' disabled' : ''}`}
          onPointerMove={(ev) => {
            if (level === 'root') hoverRoot(i, local(ev))
            else if (open && open.subActive !== i) {
              clearTimer()
              setOpen({ ...open, subActive: i })
            }
          }}
          onClick={() => {
            if (e.disabled) return
            if (e.children && open) setOpen({ ...open, active: i, sub: i, level: 'root' })
            else run(e.label!, parent)
          }}
        >
          {e.dot && <span className="cm-dot" style={{ background: e.dot }} />}
          <span className="cm-label">{e.label}</span>
          {e.shortcut && <kbd>{e.shortcut}</kbd>}
          {e.children && <span className="cm-chevron">›</span>}
        </div>
      ),
    )

  return (
    <>
      <div className="card cm-controls">
        <div className="row">
          <Segmented label="When the pointer crosses other items on the way to a submenu" value={mode} options={MODES} onChange={setMode} />
          <span className="spacer" />
          <Checkbox checked={debug} onChange={setDebug}>
            Show the triangle and pointer trail
          </Checkbox>
        </div>
        <p className="small muted">
          Right-click a file (or the desktop), hover <strong>Share</strong>, then move diagonally down into its submenu, right across
          <strong> Copy</strong> and <strong>Duplicate</strong>. Try each mode. Keyboard: focus a file, press Shift+F10 or the menu key.
        </p>
      </div>

      <div className="cm-layout">
        <div
          ref={stage}
          className="cm-desktop"
          onContextMenu={(e: MouseEvent<HTMLDivElement>) => {
            e.preventDefault()
            const file = (e.target as HTMLElement).closest('[data-file]')?.getAttribute('data-file') ?? 'Desktop'
            show(file, local(e))
          }}
          onPointerMove={onStageMove}
          onPointerDown={(e) => {
            // Long press opens the menu on touch screens.
            if (e.pointerType !== 'touch') return
            const p = local(e)
            const file = (e.target as HTMLElement).closest('[data-file]')?.getAttribute('data-file') ?? 'Desktop'
            longPress.current = window.setTimeout(() => show(file, p), 500)
          }}
          onPointerUp={() => longPress.current && window.clearTimeout(longPress.current)}
        >
          {FILES.map((f) => (
            <button
              key={f.name}
              data-file={f.name}
              className={`cm-file${open?.file === f.name ? ' selected' : ''}`}
              style={{ left: `${f.x * 100}%`, top: `${f.y * 100}%` }}
              onKeyDown={(e) => onFileKey(e, f.name)}
            >
              <span className="cm-file-icon">{f.icon}</span>
              <span>{f.name}</span>
            </button>
          ))}

          {debug && open && (
            <svg className="cm-debug" aria-hidden>
              {tri && <polygon points={tri.map((p) => `${p.x},${p.y}`).join(' ')} className={inside ? 'inside' : ''} />}
              <polyline points={trail.map((p) => `${p.x},${p.y}`).join(' ')} className="cm-trail" />
              {pointer && <circle cx={pointer.x} cy={pointer.y} r={4} className={inside ? 'inside' : ''} />}
            </svg>
          )}

          {open && (
            <div
              ref={rootRef}
              role="menu"
              tabIndex={-1}
              aria-label={`Actions for ${open.file}`}
              className={`cm-menu${open.at.flippedX || open.at.flippedY ? ' flipped' : ''}`}
              style={{ left: open.at.x, top: open.at.y, width: MENU_W }}
              onKeyDown={onMenuKey}
              onContextMenu={(e) => e.preventDefault()}
            >
              {renderEntries(MENU, open.active, 'root')}
            </div>
          )}
          {open && sub && open.sub !== null && (
            <div
              ref={subRef}
              role="menu"
              tabIndex={-1}
              aria-label={MENU[open.sub].label}
              className="cm-menu sub"
              style={{ left: sub.x, top: sub.y, width: MENU_W }}
              onKeyDown={onMenuKey}
              onPointerEnter={clearTimer}
              onContextMenu={(e) => e.preventDefault()}
            >
              {renderEntries(MENU[open.sub].children!, open.subActive, 'sub', MENU[open.sub].label)}
            </div>
          )}
          {toast && <div className="cm-toast">{toast}</div>}
        </div>

        <div className="card cm-side">
          <dl className="cm-stats">
            <dt>Kept open by the triangle</dt>
            <dd>{stats.kept}</dd>
            <dt>Submenu switches</dt>
            <dd>{stats.switched}</dd>
          </dl>
          {log.length > 0 ? (
            <ol className="cm-log small">
              {log.map((l, i) => (
                <li key={`${log.length - i}`}>{l}</li>
              ))}
            </ol>
          ) : (
            <p className="small muted">What the menu decides shows up here.</p>
          )}
          <p className="callout small">
            The triangle runs from where the pointer last was on the parent item to the near corners of the submenu. While the
            pointer moves inside it, hovering a sibling doesn’t steal the submenu. If it stops for {SETTLE} ms, we take the hint
            and switch. A plain delay works too, but makes every hover feel sluggish.
          </p>
        </div>
      </div>
    </>
  )
}
