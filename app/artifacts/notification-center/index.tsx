import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { Checkbox, Segmented } from '../../kit/Controls'
import { mulberry32 } from '../../kit/random'
import {
  badge,
  dismiss,
  generate,
  group,
  markAllRead,
  markRead,
  relative,
  seed,
  SOURCES,
  swipeOutcome,
  unreadCount,
  type Notice,
  type Source,
} from './notifications'
import './style.css'

const GROUPINGS = [
  { value: 'app', label: 'By app' },
  { value: 'time', label: 'By time' },
] as const
const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
] as const

/** Restart a CSS animation class on an element without remounting it. */
function replay(el: HTMLElement | null, className: string) {
  if (!el) return
  el.classList.remove(className)
  void el.offsetWidth
  el.classList.add(className)
}

/** One notification you can click (mark read), swipe sideways (dismiss) or close with ×. */
function Card({ notice, now, onRead, onDismiss }: { notice: Notice; now: number; onRead: () => void; onDismiss: () => void }) {
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [leaving, setLeaving] = useState<'left' | 'right' | null>(null)
  const drag = useRef({ x: 0, y: 0, t: 0, lastX: 0, lastT: 0, vx: 0, axis: '' as '' | 'x' | 'y', moved: false })
  const ref = useRef<HTMLDivElement>(null)

  const leave = (direction: 'left' | 'right') => {
    setLeaving(direction)
    // Slide out, then let the row collapse, then remove it for real.
    window.setTimeout(onDismiss, 420)
  }

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || leaving) return
    drag.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, lastX: e.clientX, lastT: e.timeStamp, vx: 0, axis: '', moved: false }
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
  }
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    const d = drag.current
    const mx = e.clientX - d.x
    const my = e.clientY - d.y
    // Decide the axis once: vertical drags belong to the list's scroll.
    if (!d.axis && Math.hypot(mx, my) > 6) d.axis = Math.abs(mx) > Math.abs(my) ? 'x' : 'y'
    if (d.axis !== 'x') return
    d.moved = true
    const dt = e.timeStamp - d.lastT
    if (dt > 0) d.vx = 0.7 * ((e.clientX - d.lastX) / dt) + 0.3 * d.vx
    d.lastX = e.clientX
    d.lastT = e.timeStamp
    setDx(mx)
  }
  const onUp = () => {
    if (!dragging) return
    setDragging(false)
    const d = drag.current
    // A pause before letting go means no fling.
    const vx = performance.now() - d.lastT > 80 && d.lastT !== d.t ? 0 : d.vx
    const outcome = d.axis === 'x' ? swipeOutcome(dx, vx, ref.current?.offsetWidth ?? 320) : null
    if (outcome) leave(outcome)
    else setDx(0)
  }

  const width = ref.current?.offsetWidth ?? 320
  const fade = Math.max(0.15, 1 - Math.abs(dx) / (width * 0.9))

  return (
    <div className={`nc-row${leaving ? ' leaving' : ''}`}>
      <div className="nc-row-inner">
        <div className={`nc-swipe-bg ${dx < 0 || leaving === 'left' ? 'left' : 'right'}`} aria-hidden>
          <span>Dismiss</span>
        </div>
        <div
          ref={ref}
          tabIndex={0}
          role="article"
          aria-label={`${SOURCES[notice.source].name}: ${notice.title}. ${notice.read ? 'Read' : 'Unread'}. Press Delete to dismiss.`}
          className={`nc-card${notice.read ? '' : ' unread'}${dragging ? ' dragging' : ''}`}
          style={{
            transform: leaving ? `translateX(${leaving === 'right' ? 110 : -110}%)` : `translateX(${dx}px)`,
            opacity: leaving ? 0 : fade,
          }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onClick={() => {
            if (!drag.current.moved && !notice.read) onRead()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Delete' || e.key === 'Backspace') leave('right')
            else if (e.key === 'Enter') onRead()
          }}
        >
          <span className="nc-app-icon" aria-hidden>
            {SOURCES[notice.source].icon}
          </span>
          <div className="nc-text">
            <div className="nc-line">
              <strong>{notice.title}</strong>
              <time className="muted">{relative(notice.at, now)}</time>
            </div>
            <p>{notice.body}</p>
          </div>
          {!notice.read && <span className="nc-dot" aria-hidden />}
          <button
            className="nc-close"
            aria-label="Dismiss"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              leave('right')
            }}
          >
            ×
          </button>
        </div>
      </div>
    </div>
  )
}

export default function NotificationCenter() {
  const random = useRef(mulberry32(Date.now() % 100000))
  const [now, setNow] = useState(() => Date.now())
  const [notices, setNotices] = useState<Notice[]>(() => seed(Date.now(), random.current))
  const [open, setOpen] = useState(false)
  const [by, setBy] = useState<'app' | 'time'>('app')
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [auto, setAuto] = useState(false)
  const [dnd, setDnd] = useState(false)
  const [source, setSource] = useState<Source | 'random'>('random')
  const [banner, setBanner] = useState<Notice | null>(null)
  const [announce, setAnnounce] = useState('')
  const bell = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const badgeRef = useRef<HTMLSpanElement>(null)

  const unread = unreadCount(notices)

  // Relative times tick.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15_000)
    return () => window.clearInterval(id)
  }, [])

  const deliver = (from: Source | 'random' = source) => {
    const t = Date.now()
    const notice = generate(t, random.current, from === 'random' ? undefined : from)
    setNow(t)
    setNotices((list) => [notice, ...list])
    setAnnounce(`New notification from ${SOURCES[notice.source].name}: ${notice.title}`)
    if (dnd) return
    replay(bell.current, 'ring')
    if (!open) setBanner(notice)
  }

  useEffect(() => {
    if (!auto) return
    const id = window.setInterval(() => deliver(), 4500)
    return () => window.clearInterval(id)
  })

  // The badge pops whenever the count goes up.
  const lastUnread = useRef(unread)
  useEffect(() => {
    if (unread > lastUnread.current) replay(badgeRef.current, 'bump')
    lastUnread.current = unread
  }, [unread])

  useEffect(() => {
    if (!banner) return
    const id = window.setTimeout(() => setBanner(null), 3500)
    return () => window.clearTimeout(id)
  }, [banner])

  // Close on Escape or a click outside, returning focus to the bell.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      bell.current?.focus()
    }
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (!panel.current?.contains(target) && !bell.current?.contains(target)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [open])

  const shown = filter === 'unread' ? notices.filter((n) => !n.read) : notices
  const groups = group(shown, now, by)

  const toggleOpen = () => {
    setOpen((o) => !o)
    setBanner(null)
    setNow(Date.now())
  }

  return (
    <div className="nc-layout">
      <div className="nc-app">
        <header className="nc-topbar">
          <span className="nc-logo">
            <i /> Acme
          </span>
          <nav className="nc-nav" aria-hidden>
            <span>Overview</span>
            <span>Projects</span>
            <span>Team</span>
          </nav>
          <span className="spacer" />
          <button
            ref={bell}
            className={`nc-bell${open ? ' open' : ''}`}
            aria-label={`Notifications, ${unread} unread`}
            aria-expanded={open}
            aria-controls="nc-panel"
            onClick={toggleOpen}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
              <path d="M12 3a6 6 0 0 0-6 6v3.6L4.3 15.4A1 1 0 0 0 5.2 17h13.6a1 1 0 0 0 .9-1.6L18 12.6V9a6 6 0 0 0-6-6Z" />
              <path d="M9.5 19a2.5 2.5 0 0 0 5 0" />
            </svg>
            {unread > 0 && (
              <span ref={badgeRef} className={`nc-badge${dnd ? ' quiet' : ''}`}>
                {dnd ? '' : badge(unread)}
              </span>
            )}
          </button>
          <span className="nc-avatar" aria-hidden>
            DP
          </span>
        </header>

        <div className="nc-page" aria-hidden>
          <div className="nc-skeleton wide" />
          <div className="nc-skeleton-row">
            <div className="nc-skeleton" />
            <div className="nc-skeleton" />
            <div className="nc-skeleton" />
          </div>
          <div className="nc-skeleton tall" />
        </div>

        {banner && !open && (
          <button className="nc-banner" onClick={toggleOpen}>
            <span className="nc-app-icon">{SOURCES[banner.source].icon}</span>
            <span className="nc-text">
              <strong>{banner.title}</strong>
              <span className="muted">{banner.body}</span>
            </span>
          </button>
        )}

        {open && (
          <div className="nc-panel" id="nc-panel" ref={panel} role="dialog" aria-label="Notifications">
            <div className="nc-panel-head">
              <h3>Notifications</h3>
              <span className="spacer" />
              <button className="nc-text-button" onClick={() => setNotices(markAllRead)} disabled={!unread}>
                Mark all read
              </button>
            </div>
            <div className="nc-panel-tabs">
              <div className="presets" role="tablist">
                {FILTERS.map((f) => (
                  <button key={f.value} role="tab" aria-selected={filter === f.value} className={`chip${filter === f.value ? ' active' : ''}`} onClick={() => setFilter(f.value)}>
                    {f.label}
                    {f.value === 'unread' && unread > 0 && <span className="count">{unread}</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="nc-list">
              {groups.length === 0 && (
                <div className="nc-empty">
                  <span aria-hidden>🎉</span>
                  <p>{filter === 'unread' ? 'No unread notifications.' : 'You’re all caught up.'}</p>
                </div>
              )}
              {groups.map((g) => {
                const stacked = by === 'app' && g.items.length > 1 && !expanded.has(g.key)
                const items = stacked ? g.items.slice(0, 1) : g.items
                return (
                  <section key={g.key} className="nc-group">
                    <div className="nc-group-head">
                      <span>
                        {g.source && <span aria-hidden>{SOURCES[g.source].icon} </span>}
                        {g.label}
                        <span className="muted"> · {g.items.length}</span>
                      </span>
                      <span className="spacer" />
                      {by === 'app' && g.items.length > 1 && expanded.has(g.key) && (
                        <button
                          className="nc-text-button"
                          onClick={() =>
                            setExpanded((s) => {
                              const next = new Set(s)
                              next.delete(g.key)
                              return next
                            })
                          }
                        >
                          Show less
                        </button>
                      )}
                      <button className="nc-text-button" onClick={() => setNotices((list) => dismiss(list, g.items.map((n) => n.id)))}>
                        Clear
                      </button>
                    </div>
                    <div className="nc-stack">
                      {items.map((n) => (
                        <Card
                          key={n.id}
                          notice={n}
                          now={now}
                          onRead={() => setNotices((list) => markRead(list, [n.id]))}
                          onDismiss={() => setNotices((list) => dismiss(list, [n.id]))}
                        />
                      ))}
                      {stacked && <div className="nc-ghost" aria-hidden />}
                      {stacked && g.items.length > 2 && <div className="nc-ghost second" aria-hidden />}
                      {stacked && (
                        <button className="nc-more" onClick={() => setExpanded((s) => new Set([...s, g.key]))}>
                          +{g.items.length - 1} more from {g.label}
                        </button>
                      )}
                    </div>
                  </section>
                )
              })}
            </div>
          </div>
        )}
        <div className="nc-live" aria-live="polite">
          {announce}
        </div>
      </div>

      <div className="card nc-side">
        <div className="row">
          <select value={source} onChange={(e) => setSource(e.target.value as Source | 'random')} aria-label="Which app sends it">
            <option value="random">Any app</option>
            {(Object.keys(SOURCES) as Source[]).map((s) => (
              <option key={s} value={s}>
                {SOURCES[s].name}
              </option>
            ))}
          </select>
          <button className="primary" onClick={() => deliver()}>
            Send notification
          </button>
        </div>
        <Checkbox checked={auto} onChange={setAuto}>
          Keep them coming (every 4.5 s)
        </Checkbox>
        <Checkbox checked={dnd} onChange={setDnd}>
          Do not disturb: no banner, no ring, a quiet dot
        </Checkbox>
        <Segmented label="Group" value={by} options={GROUPINGS} onChange={setBy} />
        <div className="row">
          <button
            className="chip"
            onClick={() => {
              const t = Date.now()
              setNotices((list) => [...Array.from({ length: 100 }, (_, i) => generate(t - i * 1000, random.current)), ...list])
              setNow(t)
            }}
          >
            Flood +100 (see “99+”)
          </button>
          <button
            className="chip"
            onClick={() => {
              setNotices(seed(Date.now(), random.current))
              setExpanded(new Set())
            }}
          >
            Reset inbox
          </button>
        </div>
        <p className="callout small">
          Swipe a card sideways (or flick it) to dismiss, click to mark it read, or focus one and press Delete. Stacks
          from the same app fan open when you click “more”.
        </p>
        <dl className="nc-stats small">
          <dt>Total</dt>
          <dd>{notices.length}</dd>
          <dt>Unread</dt>
          <dd>{unread}</dd>
          <dt>Badge shows</dt>
          <dd>{dnd ? 'a dot' : badge(unread) || 'nothing'}</dd>
        </dl>
      </div>
    </div>
  )
}
