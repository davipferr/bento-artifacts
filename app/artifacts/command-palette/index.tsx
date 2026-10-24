import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Checkbox } from '../../kit/Controls'
import { href } from '../../kit/router'
import { artifacts } from '../../registry'
import { explain, highlight, pushRecent, rank, type Match } from './fuzzy'
import './style.css'

const NOTES = [
  { id: 'groceries', emoji: '🛒', title: 'Groceries', body: 'Oat milk, lemons, basil, the good coffee, rice noodles.' },
  { id: 'standup', emoji: '🗓️', title: 'Standup notes', body: 'Ship the palette. Fix flaky test in CI. Review the onboarding copy.' },
  { id: 'ideas', emoji: '💡', title: 'Artifact ideas', body: 'Fireworks, Chladni plates, a theremin, a lava lamp made of metaballs.' },
  { id: 'reading', emoji: '📚', title: 'Reading list', body: 'Designing Data-Intensive Applications. The Pragmatic Programmer. Refactoring UI.' },
  { id: 'trip', emoji: '🧳', title: 'Trip to Lisbon', body: 'Pastéis de nata in Belém, tram 28, sunset at Miradouro da Senhora do Monte.' },
  { id: 'recipes', emoji: '🍝', title: 'Pasta recipes', body: 'Cacio e pepe: pecorino, black pepper, pasta water. Stir off the heat.' },
  { id: 'workout', emoji: '🏃', title: 'Workout plan', body: 'Mon run 5k · Wed strength · Fri intervals · Sun long walk.' },
]

const ACCENTS = [
  { id: 'blue', label: 'Ocean blue', hue: 225 },
  { id: 'violet', label: 'Violet', hue: 270 },
  { id: 'pink', label: 'Hot pink', hue: 330 },
  { id: 'orange', label: 'Tangerine', hue: 30 },
  { id: 'green', label: 'Mint green', hue: 155 },
  { id: 'teal', label: 'Teal', hue: 190 },
]

const RECENTS_KEY = 'bento-palette-recents'
const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const MOD = mac ? '⌘' : 'Ctrl'
const ALT = mac ? '⌥' : 'Alt'

interface Command {
  id: string
  title: string
  group: string
  icon: string
  keywords?: string[]
  shortcut?: string[]
  /** Runs and closes the palette. */
  run?: () => void
  /** Opens a nested page instead. */
  page?: 'accent' | 'notes'
}

function loadRecents(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENTS_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}
function saveRecents(list: string[]) {
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(list))
  } catch {
    // Storage blocked: recents just won't survive a reload.
  }
}

function Highlighted({ text, match }: { text: string; match?: Match }) {
  if (!match?.indices.length) return <>{text}</>
  return (
    <>
      {highlight(text, match.indices).map((part, i) => (part.hit ? <mark key={i}>{part.text}</mark> : <span key={i}>{part.text}</span>))}
    </>
  )
}

export default function CommandPalette() {
  // ---- The mock app ---------------------------------------------------
  const [notes, setNotes] = useState(NOTES)
  const [current, setCurrent] = useState(NOTES[0].id)
  const [sidebar, setSidebar] = useState(true)
  const [fontSize, setFontSize] = useState(16)
  const [zen, setZen] = useState(false)
  const [dark, setDark] = useState(false)
  const [accent, setAccent] = useState(ACCENTS[0])
  const [toast, setToast] = useState<string | null>(null)

  // ---- The palette ----------------------------------------------------
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState<'root' | 'accent' | 'notes'>('root')
  const [active, setActive] = useState(0)
  const [recents, setRecents] = useState(loadRecents)
  const [showScores, setShowScores] = useState(false)
  const [lastRun, setLastRun] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  /** Hover only moves the selection after the mouse really moved, not when the list scrolls under it. */
  const pointerMoved = useRef(false)

  const note = notes.find((n) => n.id === current) ?? notes[0]

  const flash = (text: string) => {
    setToast(text)
    window.setTimeout(() => setToast((t) => (t === text ? null : t)), 1800)
  }

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [
      { id: 'new-note', title: 'New note', group: 'Actions', icon: '＋', keywords: ['create', 'add'], shortcut: [ALT, 'N'], run: () => newNote() },
      { id: 'goto-note', title: 'Go to note…', group: 'Navigation', icon: '↪', keywords: ['open', 'switch', 'jump'], page: 'notes' },
      { id: 'toggle-sidebar', title: 'Toggle sidebar', group: 'View', icon: '◧', keywords: ['hide', 'show', 'panel'], shortcut: [MOD, 'B'], run: () => setSidebar((s) => !s) },
      { id: 'zen', title: 'Toggle zen mode', group: 'View', icon: '☯', keywords: ['focus', 'distraction free'], shortcut: [ALT, 'Z'], run: () => setZen((z) => !z) },
      { id: 'font-up', title: 'Increase font size', group: 'View', icon: 'A⁺', keywords: ['zoom in', 'bigger', 'text'], shortcut: [ALT, '='], run: () => setFontSize((s) => Math.min(26, s + 2)) },
      { id: 'font-down', title: 'Decrease font size', group: 'View', icon: 'A⁻', keywords: ['zoom out', 'smaller', 'text'], shortcut: [ALT, '−'], run: () => setFontSize((s) => Math.max(12, s - 2)) },
      { id: 'theme', title: dark ? 'Switch to light mode' : 'Switch to dark mode', group: 'Appearance', icon: dark ? '☀' : '☾', keywords: ['theme', 'toggle', 'colors'], run: () => setDark((d) => !d) },
      { id: 'accent', title: 'Change accent color…', group: 'Appearance', icon: '🎨', keywords: ['theme', 'colour', 'hue'], page: 'accent' },
      { id: 'duplicate', title: 'Duplicate current note', group: 'Actions', icon: '⧉', keywords: ['copy', 'clone'], run: () => duplicate() },
      { id: 'copy-link', title: 'Copy link to note', group: 'Actions', icon: '🔗', keywords: ['share', 'url'], run: () => flash(`Link to “${note.title}” copied (pretend)`) },
      { id: 'word-count', title: 'Show word count', group: 'Actions', icon: '#', keywords: ['stats', 'length'], run: () => flash(`${note.body.split(/\s+/).length} words in “${note.title}”`) },
      { id: 'clear-recents', title: 'Clear recent commands', group: 'Palette', icon: '⌫', keywords: ['history', 'reset'], run: () => setRecents([]) },
    ]
    for (const a of artifacts) {
      if (a.slug === 'command-palette') continue
      list.push({
        id: `artifact:${a.slug}`,
        title: `Open ${a.title}`,
        group: 'Bento gallery',
        icon: '▦',
        keywords: a.tags,
        run: () => {
          location.hash = href(a.slug)
        },
      })
    }
    return list
    // newNote and duplicate only use state setters, so the list depends on the labels and the current note.
  }, [dark, note])

  const pageItems = useMemo<Command[]>(() => {
    if (page === 'accent')
      return ACCENTS.map((a) => ({ id: `accent:${a.id}`, title: a.label, group: 'Accent color', icon: '●', run: () => setAccent(a) }))
    if (page === 'notes')
      return notes.map((n) => ({ id: `note:${n.id}`, title: n.title, group: 'Notes', icon: n.emoji, keywords: [n.body], run: () => setCurrent(n.id) }))
    return commands
  }, [page, commands, notes])

  const results = useMemo(() => {
    const q = query.trim()
    if (q) return rank(pageItems, q, (c) => c.title, (c) => c.keywords ?? []).slice(0, 60)
    if (page !== 'root') return pageItems.map((item) => ({ item, match: undefined }))
    // Empty query on the main page: recents first, then everything except the long artifact list.
    const recent = recents.map((id) => pageItems.find((c) => c.id === id)).filter((c): c is Command => !!c)
    const rest = pageItems.filter((c) => !recents.includes(c.id) && c.group !== 'Bento gallery')
    return [...recent.map((item) => ({ item: { ...item, group: 'Recent' }, match: undefined })), ...rest.map((item) => ({ item, match: undefined }))]
  }, [query, pageItems, page, recents])

  useEffect(() => saveRecents(recents), [recents])
  useEffect(() => setActive(0), [query, page])

  // Keep the active row visible.
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  const openPalette = () => {
    opener.current = document.activeElement as HTMLElement | null
    setOpen(true)
    setQuery('')
    setPage('root')
  }
  const closePalette = () => {
    setOpen(false)
    opener.current?.focus?.()
  }

  const execute = (command: Command) => {
    if (command.page) {
      setPage(command.page)
      setQuery('')
      inputRef.current?.focus()
      return
    }
    if (page === 'root') setRecents((r) => pushRecent(r, command.id))
    setLastRun(command.title)
    closePalette()
    command.run?.()
  }

  function newNote() {
    const id = `note-${Date.now()}`
    setNotes((list) => [...list, { id, emoji: '📝', title: 'Untitled', body: 'Start typing…' }])
    setCurrent(id)
    flash('New note created')
  }
  function duplicate() {
    const id = `note-${Date.now()}`
    setNotes((list) => {
      const source = list.find((n) => n.id === current) ?? list[0]
      return [...list, { ...source, id, title: `${source.title} (copy)` }]
    })
    setCurrent(id)
    flash('Note duplicated')
  }

  // Global shortcuts: ⌘K / Ctrl+K toggles the palette, the rest mirror commands.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = mac ? e.metaKey : e.ctrlKey
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (open) closePalette()
        else openPalette()
        return
      }
      if (open) return
      const find = (id: string) => commands.find((c) => c.id === id)
      let hit: Command | undefined
      if (mod && e.key.toLowerCase() === 'b') hit = find('toggle-sidebar')
      else if (e.altKey && e.code === 'KeyN') hit = find('new-note')
      else if (e.altKey && e.code === 'KeyZ') hit = find('zen')
      else if (e.altKey && e.code === 'Equal') hit = find('font-up')
      else if (e.altKey && e.code === 'Minus') hit = find('font-down')
      if (!hit) return
      e.preventDefault()
      setLastRun(`${hit.title} (shortcut)`)
      hit.run?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const onInputKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    const count = results.length
    if (e.key === 'ArrowDown' || (e.key === 'n' && e.ctrlKey)) {
      e.preventDefault()
      setActive((a) => (count ? (a + 1) % count : 0))
    } else if (e.key === 'ArrowUp' || (e.key === 'p' && e.ctrlKey)) {
      e.preventDefault()
      setActive((a) => (count ? (a - 1 + count) % count : 0))
    } else if (e.key === 'Home' && e.ctrlKey) {
      setActive(0)
    } else if (e.key === 'End' && e.ctrlKey) {
      setActive(count - 1)
    } else if (e.key === 'PageDown') {
      e.preventDefault()
      setActive((a) => Math.min(count - 1, a + 8))
    } else if (e.key === 'PageUp') {
      e.preventDefault()
      setActive((a) => Math.max(0, a - 8))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const hit = results[active]
      if (hit) execute(hit.item)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      if (page !== 'root') setPage('root')
      else if (query) setQuery('')
      else closePalette()
    } else if (e.key === 'Backspace' && !query && page !== 'root') {
      e.preventDefault()
      setPage('root')
    }
  }

  const activeResult = results[active]
  const breakdown = activeResult?.match?.indices.length ? explain(activeResult.item.title, activeResult.match.indices) : []
  const appStyle = { '--app-accent': `oklch(0.62 0.17 ${accent.hue})`, fontSize } as CSSProperties
  let lastGroup = ''

  return (
    <div className="cp-layout">
      <div className={`cp-app${dark ? ' dark' : ''}${zen ? ' zen' : ''}`} style={appStyle}>
        <header className="cp-topbar">
          <span className="cp-brand">
            <i /> Notes
          </span>
          <button className="cp-search" onClick={openPalette} aria-keyshortcuts={mac ? 'Meta+K' : 'Control+K'}>
            <span>Search or run a command…</span>
            <kbd>{MOD}</kbd>
            <kbd>K</kbd>
          </button>
        </header>
        <div className="cp-body">
          {sidebar && !zen && (
            <nav className="cp-sidebar" aria-label="Notes">
              {notes.map((n) => (
                <button key={n.id} className={n.id === current ? 'active' : ''} onClick={() => setCurrent(n.id)}>
                  <span>{n.emoji}</span> {n.title}
                </button>
              ))}
            </nav>
          )}
          <article className="cp-editor">
            <h2>
              {note.emoji} {note.title}
            </h2>
            <p>{note.body}</p>
            {!zen && (
              <p className="cp-tip">
                Press <kbd>{MOD}</kbd> <kbd>K</kbd> and try typing <em>tsb</em>, <em>dark</em>, <em>accent</em>, <em>lis</em> or the name of
                another artifact.
              </p>
            )}
          </article>
        </div>
        {toast && (
          <div className="cp-toast" role="status">
            {toast}
          </div>
        )}

        {open && (
          <div className="cp-overlay" onMouseDown={(e) => e.target === e.currentTarget && closePalette()}>
            <div className="cp-palette" role="dialog" aria-modal="true" aria-label="Command palette">
              <div className="cp-input-row">
                {page !== 'root' && (
                  <button className="cp-crumb" onClick={() => setPage('root')} aria-label="Back to all commands">
                    {page === 'accent' ? 'Accent color' : 'Go to note'} ✕
                  </button>
                )}
                <input
                  ref={inputRef}
                  autoFocus
                  className="cp-input"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onInputKey}
                  placeholder={page === 'root' ? 'Type a command or search…' : page === 'accent' ? 'Pick a color…' : 'Find a note…'}
                  role="combobox"
                  aria-expanded="true"
                  aria-controls="cp-listbox"
                  aria-activedescendant={activeResult ? `cp-opt-${active}` : undefined}
                  aria-autocomplete="list"
                  spellCheck={false}
                  autoComplete="off"
                />
                <kbd className="cp-esc">esc</kbd>
              </div>
              <div className="cp-list" id="cp-listbox" role="listbox" ref={listRef} onMouseMove={() => (pointerMoved.current = true)}>
                {results.length === 0 && <p className="cp-empty">No commands match “{query}”.</p>}
                {results.map(({ item, match }, i) => {
                  const header = !query && item.group !== lastGroup ? item.group : null
                  lastGroup = item.group
                  return (
                    <div key={`${item.group}-${item.id}`}>
                      {header && <div className="cp-group">{header}</div>}
                      <div
                        id={`cp-opt-${i}`}
                        role="option"
                        aria-selected={i === active}
                        className={`cp-item${i === active ? ' active' : ''}`}
                        onMouseEnter={() => pointerMoved.current && setActive(i)}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => execute(item)}
                      >
                        <span className="cp-icon" style={item.id.startsWith('accent:') ? { color: `oklch(0.62 0.17 ${ACCENTS.find((a) => `accent:${a.id}` === item.id)?.hue})` } : undefined}>
                          {item.icon}
                        </span>
                        <span className="cp-title">
                          <Highlighted text={item.title} match={match} />
                        </span>
                        {query && <span className="cp-item-group">{item.group}</span>}
                        {showScores && match && <span className="cp-score">{match.score.toFixed(1)}</span>}
                        {item.page && <span className="cp-chevron">›</span>}
                        {item.shortcut && (
                          <span className="cp-keys">
                            {item.shortcut.map((k) => (
                              <kbd key={k}>{k}</kbd>
                            ))}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="cp-footer">
                <span>
                  <kbd>↑</kbd>
                  <kbd>↓</kbd> navigate
                </span>
                <span>
                  <kbd>↵</kbd> run
                </span>
                <span>
                  <kbd>esc</kbd> {page !== 'root' ? 'back' : 'close'}
                </span>
                <span className="spacer" />
                <span>{results.length} results</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="card cp-side">
        <div>
          <h3>Why this result?</h3>
          {breakdown.length ? (
            <>
              <p className="small">
                <strong>{activeResult.item.title}</strong> scores <strong>{activeResult.match!.score.toFixed(1)}</strong>:
              </p>
              <div className="cp-breakdown">
                {breakdown.map((b, i) => (
                  <span key={i} className={`cp-chip ${b.kind.replace(/\s/g, '-')}`}>
                    <b>{b.ch}</b> {b.kind}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="small muted">Open the palette and type: the active result’s matched letters show up here with the bonus each one earned.</p>
          )}
        </div>
        <ul className="cp-rules small">
          <li>
            <b>Word starts</b> and the <b>first letter</b> earn the most, so <em>tsb</em> finds <em>T</em>oggle <em>S</em>ide<em>b</em>ar.
          </li>
          <li>
            <b>Consecutive</b> letters earn a bonus; every <b>gap</b> costs a little.
          </li>
          <li>
            A dynamic program picks the <b>best</b> alignment, not the first one it sees.
          </li>
          <li>Keywords (like “theme” for the accent color) match at a discount and aren’t highlighted.</li>
        </ul>
        <Checkbox checked={showScores} onChange={setShowScores}>
          Show scores in the list
        </Checkbox>
        <div>
          <h3>Recent</h3>
          {recents.length ? (
            <ol className="cp-recents small">
              {recents.map((id) => (
                <li key={id}>{commands.find((c) => c.id === id)?.title ?? id}</li>
              ))}
            </ol>
          ) : (
            <p className="small muted">Commands you run show up first next time (saved in this browser).</p>
          )}
        </div>
        {lastRun && <p className="small muted">Last run: {lastRun}</p>}
      </div>
    </div>
  )
}
