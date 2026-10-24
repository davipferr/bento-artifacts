import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import { Checkbox } from '../../kit/Controls'
import { close, escaped, open, step, TABBABLE, tabOrder, type Layer } from './focus'
import './style.css'

type DialogId = 'profile' | 'avatar' | 'confirm'
const AVATARS = ['🦊', '🐼', '🦉', '🐙']

interface Options {
  trap: boolean
  inert: boolean
  restore: boolean
  initial: boolean
  order: boolean
  badTabindex: boolean
}

interface Badge {
  n: number
  x: number
  y: number
  cx: number
  cy: number
  focused: boolean
}

interface LogEntry {
  id: number
  name: string
  where: string
  warn: boolean
}

/** Every element that Tab can reach inside `root`, in the order Tab visits them. */
function tabbables(root: HTMLElement): HTMLElement[] {
  const all = [...root.querySelectorAll<HTMLElement>(TABBABLE)]
  const live = all
    .map((el, index) => ({ el, index, tabIndex: el.tabIndex }))
    .filter(({ el }) => !el.closest('[inert]') && el.getClientRects().length > 0)
  return tabOrder(live).map((c) => c.el)
}

const nameOf = (el: Element) =>
  (el as HTMLElement).dataset.name ?? el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 24) ?? el.tagName.toLowerCase()

function Dialog({
  id,
  title,
  depth,
  top,
  inert,
  alert,
  onClose,
  onKeyDown,
  children,
}: {
  id: DialogId
  title: string
  depth: number
  top: boolean
  inert: boolean
  alert?: boolean
  onClose: () => void
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void
  children: ReactNode
}) {
  return (
    <div className="mf-backdrop" style={{ zIndex: 10 + depth * 2 }} data-top={top || undefined}>
      <div
        className={`mf-dialog depth-${depth}`}
        role={alert ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={`mf-title-${id}`}
        data-layer={id}
        inert={inert}
        onKeyDown={onKeyDown}
      >
        <header>
          <h3 id={`mf-title-${id}`}>{title}</h3>
          <button className="mf-x" aria-label={`Close ${title}`} data-name="✕ close" onClick={onClose}>
            ✕
          </button>
        </header>
        {children}
      </div>
    </div>
  )
}

export default function ModalFocusTrap() {
  const [o, setO] = useState<Options>({ trap: true, inert: true, restore: true, initial: true, order: true, badTabindex: false })
  const [stack, setStack] = useState<Layer<DialogId>[]>([])
  const [log, setLog] = useState<LogEntry[]>([])
  const [badges, setBadges] = useState<{ list: Badge[]; wrap: boolean; w: number; h: number }>({ list: [], wrap: false, w: 0, h: 0 })
  const [avatar, setAvatar] = useState(AVATARS[0])
  const screen = useRef<HTMLDivElement>(null)
  const stackRef = useRef(stack)
  stackRef.current = stack
  const nextId = useRef(0)
  const lastBadges = useRef('')
  const set = (patch: Partial<Options>) => setO((prev) => ({ ...prev, ...patch }))

  const addLog = useCallback((name: string, where: string, warn: boolean) => {
    setLog((l) => [{ id: nextId.current++, name, where, warn }, ...l].slice(0, 40))
  }, [])

  const layerEl = (id: string) => screen.current?.querySelector<HTMLElement>(`[data-layer="${id}"]`) ?? null

  // Number every element Tab can reach in the current scope and record where it sits.
  const measure = useCallback(() => {
    const root = screen.current
    if (!root) return
    const box = root.getBoundingClientRect()
    const top = stackRef.current[stackRef.current.length - 1]
    const scope = o.trap && top ? layerEl(top.id) : root
    if (!scope) return
    const list = tabbables(scope).map((el, i) => {
      const r = el.getBoundingClientRect()
      return {
        n: i + 1,
        x: r.left - box.left,
        y: r.top - box.top,
        cx: r.left - box.left + r.width / 2,
        cy: r.top - box.top + r.height / 2,
        focused: el === document.activeElement,
      }
    })
    const next = { list, wrap: o.trap && !!top, w: box.width, h: box.height }
    const key = JSON.stringify(next)
    if (key === lastBadges.current) return
    lastBadges.current = key
    setBadges(next)
  }, [o.trap])

  useLayoutEffect(() => {
    measure()
  })

  useEffect(() => {
    const root = screen.current
    if (!root) return
    const observer = new ResizeObserver(() => measure())
    observer.observe(root)
    return () => observer.disconnect()
  }, [measure])

  // The focus log: where focus lands, and whether that's somewhere it shouldn't be.
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target as HTMLElement
      const root = screen.current
      measure()
      if (!root) return
      const inside = root.contains(el)
      const layer = inside ? (el.closest<HTMLElement>('[data-layer]')?.dataset.layer ?? null) : null
      const s = stackRef.current
      if (!inside) {
        if (s.length) addLog(nameOf(el), 'outside the demo', true)
        return
      }
      addLog(nameOf(el), layer === 'page' ? 'page' : `${layer} dialog`, escaped(s, layer))
    }
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && stackRef.current.length) {
        e.preventDefault()
        closeTop()
      }
    }
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('keydown', onKey)
    }
  })

  const openDialog = (id: DialogId, e: MouseEvent<HTMLElement>) => {
    const opener = e.currentTarget.dataset.fid ?? null
    setStack((s) => open(s, id, opener))
    requestAnimationFrame(() => {
      const el = layerEl(id)
      if (!el || !o.initial) return
      const target = el.querySelector<HTMLElement>('[data-autofocus]') ?? tabbables(el)[0]
      target?.focus()
    })
  }

  const closeTop = () => {
    const { stack: rest, restore } = close(stackRef.current)
    stackRef.current = rest
    setStack(rest)
    requestAnimationFrame(() => {
      if (o.restore && restore) {
        screen.current?.querySelector<HTMLElement>(`[data-fid="${restore}"]`)?.focus()
      } else if (document.activeElement === document.body) {
        addLog('<body>', 'focus was dropped', true)
      }
    })
  }

  // The trap itself: on Tab, move focus ourselves and wrap at both ends.
  const trapKeys = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !o.trap) return
    const items = tabbables(e.currentTarget)
    const at = items.indexOf(document.activeElement as HTMLElement)
    const next = step(at, items.length, e.shiftKey)
    e.preventDefault()
    items[next]?.focus()
  }

  const depthOf = (id: DialogId) => stack.findIndex((l) => l.id === id)
  const topId = stack[stack.length - 1]?.id
  const isOpen = (id: DialogId) => depthOf(id) >= 0
  const dialogProps = (id: DialogId) => ({
    id,
    depth: depthOf(id),
    top: topId === id,
    inert: o.inert && topId !== id,
    onClose: closeTop,
    onKeyDown: trapKeys,
  })
  const warnings = log.filter((l) => l.warn).length

  return (
    <>
      <div className="card mf-controls">
        <div className="mf-options">
          <Checkbox checked={o.trap} onChange={(trap) => set({ trap })}>
            Trap <kbd>Tab</kbd> inside the top dialog
          </Checkbox>
          <Checkbox checked={o.inert} onChange={(inert) => set({ inert })}>
            Make everything behind it <code>inert</code>
          </Checkbox>
          <Checkbox checked={o.initial} onChange={(initial) => set({ initial })}>
            Move focus into a dialog when it opens
          </Checkbox>
          <Checkbox checked={o.restore} onChange={(restore) => set({ restore })}>
            Return focus to the opener on close
          </Checkbox>
          <Checkbox checked={o.badTabindex} onChange={(badTabindex) => set({ badTabindex })}>
            Give “Subscribe” <code>tabindex="1"</code> (anti-pattern)
          </Checkbox>
          <Checkbox checked={o.order} onChange={(order) => set({ order })}>
            Show the Tab order
          </Checkbox>
        </div>
        <p className="small muted">
          Click into the fake app below and use <kbd>Tab</kbd>, <kbd>Shift</kbd>+<kbd>Tab</kbd> and <kbd>Esc</kbd>. Switch
          options off one at a time and watch the log turn red when focus ends up behind the dialog, or gets lost.
        </p>
      </div>

      <div className="mf-layout">
        <div className="mf-screen" ref={screen} onAnimationEnd={() => measure()}>
          <div className="mf-page" data-layer="page" inert={o.inert && stack.length > 0}>
            <nav className="mf-nav">
              <strong>Acme</strong>
              {['Home', 'Docs', 'Pricing'].map((label) => (
                <button key={label} className="mf-link" data-name={`${label} link`}>
                  {label}
                </button>
              ))}
              <input className="mf-search" placeholder="Search…" aria-label="Search" data-name="Search field" />
            </nav>
            <main className="mf-main">
              <div className="mf-hero">
                <span className="mf-avatar" aria-hidden>
                  {avatar}
                </span>
                <div>
                  <strong>Sam Rivera</strong>
                  <p className="small muted">sam@example.com</p>
                </div>
              </div>
              <div className="row">
                <button className="primary" data-fid="edit" data-name="Edit profile…" onClick={(e) => openDialog('profile', e)}>
                  Edit profile…
                </button>
                <button data-name="Subscribe" tabIndex={o.badTabindex ? 1 : undefined}>
                  Subscribe
                </button>
                <button data-name="Share">Share</button>
              </div>
              <p className="small muted">Plain page content. While a dialog is open, none of this should be reachable.</p>
            </main>
          </div>

          {isOpen('profile') && (
            <Dialog title="Edit profile" {...dialogProps('profile')}>
              <label className="mf-field">
                Name
                <input defaultValue="Sam Rivera" data-name="Name field" data-autofocus />
              </label>
              <label className="mf-field">
                Email
                <input defaultValue="sam@example.com" data-name="Email field" />
              </label>
              <div className="row">
                <span className="mf-avatar small" aria-hidden>
                  {avatar}
                </span>
                <button data-fid="change-avatar" data-name="Change avatar…" onClick={(e) => openDialog('avatar', e)}>
                  Change avatar…
                </button>
              </div>
              <footer className="row">
                <span className="spacer" />
                <button data-name="Cancel" onClick={closeTop}>
                  Cancel
                </button>
                <button className="primary" data-name="Save" onClick={closeTop}>
                  Save
                </button>
              </footer>
            </Dialog>
          )}

          {isOpen('avatar') && (
            <Dialog title="Change avatar" {...dialogProps('avatar')}>
              <div className="mf-avatars" role="group" aria-label="Avatars">
                {AVATARS.map((a, i) => (
                  <button
                    key={a}
                    className={`mf-pick${a === avatar ? ' on' : ''}`}
                    aria-pressed={a === avatar}
                    data-name={`Avatar ${i + 1}`}
                    data-autofocus={a === avatar || undefined}
                    onClick={() => setAvatar(a)}
                  >
                    {a}
                  </button>
                ))}
              </div>
              <footer className="row">
                <button data-fid="remove" data-name="Remove avatar…" onClick={(e) => openDialog('confirm', e)}>
                  Remove avatar…
                </button>
                <span className="spacer" />
                <button className="primary" data-name="Done" onClick={closeTop}>
                  Done
                </button>
              </footer>
            </Dialog>
          )}

          {isOpen('confirm') && (
            <Dialog title="Remove avatar?" alert {...dialogProps('confirm')}>
              <p className="small">You'll get the default one. Focus starts on the safe choice.</p>
              <footer className="row">
                <span className="spacer" />
                <button data-name="Keep it" data-autofocus onClick={closeTop}>
                  Keep it
                </button>
                <button
                  className="mf-danger"
                  data-name="Remove"
                  onClick={() => {
                    setAvatar('👤')
                    closeTop()
                  }}
                >
                  Remove
                </button>
              </footer>
            </Dialog>
          )}

          {o.order && (
            <svg className="mf-overlay" width={badges.w} height={badges.h} aria-hidden>
              <defs>
                <marker id="mf-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" />
                </marker>
              </defs>
              {badges.list.slice(1).map((b, i) => {
                const a = badges.list[i]
                const mx = (a.cx + b.cx) / 2
                const my = (a.cy + b.cy) / 2 - Math.min(40, Math.hypot(b.cx - a.cx, b.cy - a.cy) / 4)
                return <path key={b.n} className="mf-edge" d={`M${a.cx},${a.cy} Q${mx},${my} ${b.cx},${b.cy}`} markerEnd="url(#mf-arrow)" />
              })}
              {badges.wrap && badges.list.length > 1 && (() => {
                const a = badges.list[badges.list.length - 1]
                const b = badges.list[0]
                const side = Math.max(a.cx, b.cx) + 60
                return <path className="mf-edge wrap" d={`M${a.cx},${a.cy} C${side},${a.cy} ${side},${b.cy} ${b.cx},${b.cy}`} markerEnd="url(#mf-arrow)" />
              })()}
              {badges.list.map((b) => (
                <g key={b.n} className={`mf-badge${b.focused ? ' focused' : ''}`} transform={`translate(${b.x},${b.y})`}>
                  <circle r="9" />
                  <text y="3.5" textAnchor="middle">
                    {b.n}
                  </text>
                </g>
              ))}
            </svg>
          )}
        </div>

        <div className="card mf-log">
          <div className="row">
            <strong>Focus log</strong>
            <span className="spacer" />
            {warnings > 0 && <span className="mf-warn-count">{warnings} escaped</span>}
            {log.length > 0 && (
              <button className="chip" onClick={() => setLog([])}>
                Clear
              </button>
            )}
          </div>
          <div className="small muted">
            Open dialogs: {stack.length ? stack.map((l) => l.id).join(' → ') : 'none'}
          </div>
          <ol className="mf-entries" aria-live="polite">
            {log.map((l) => (
              <li key={l.id} className={l.warn ? 'warn' : ''}>
                <span className="mono">{l.name}</span>
                <span className="muted small">{l.warn ? `⚠ ${l.where}` : l.where}</span>
              </li>
            ))}
            {!log.length && <li className="muted small">Nothing yet. Click into the app and press Tab.</li>}
          </ol>
        </div>
      </div>
    </>
  )
}
