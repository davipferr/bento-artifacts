import { useLayoutEffect, useRef, useState } from 'react'
import { Checkbox } from '../../kit/Controls'
import { item, items, PER_PAGE, pageCount, pageList, pageOf, pageRange, shouldLoad, TOTAL, type Item } from './feed'
import './style.css'

type Mode = 'infinite' | 'pages' | 'more'
const MODES: { id: Mode; name: string; hint: string }[] = [
  { id: 'infinite', name: 'Infinite scroll', hint: 'Loads 10 more as you near the bottom.' },
  { id: 'pages', name: 'Pagination', hint: '10 per page, with numbered pages.' },
  { id: 'more', name: 'Load more', hint: 'A button adds 10 more; you decide.' },
]

interface Stats {
  phase: 'find' | 'open' | 'refind' | 'done'
  started: number | null
  found: number | null
  back: number | null
  refound: number | null
  scrolled: number
  clicks: number
  footerSeen: number
}
const fresh = (): Stats => ({ phase: 'find', started: null, found: null, back: null, refound: null, scrolled: 0, clicks: 0, footerSeen: 0 })
const secs = (ms: number | null) => (ms === null ? '·' : `${(ms / 1000).toFixed(1)} s`)

function Row({ it, onOpen }: { it: Item; onOpen: () => void }) {
  return (
    <button className="fp-row" onClick={onOpen}>
      <span className="fp-thumb" style={{ background: `hsl(${it.hue} 60% 60%)` }} />
      <span className="fp-text">
        <strong>
          #{it.id} {it.title}
        </strong>
        <span className="muted">
          {it.author} · {it.minutes} min read
        </span>
      </span>
    </button>
  )
}

function Panel({ mode, target, restore }: { mode: Mode; target: number; restore: boolean }) {
  const [loaded, setLoaded] = useState(PER_PAGE)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<number | null>(null)
  const [stats, setStats] = useState(fresh)
  const [jump, setJump] = useState('')
  const list = useRef<HTMLDivElement>(null)
  const saved = useRef(0)
  const restoreTo = useRef<number | null>(null)
  const lastTop = useRef(0)
  const footerVisible = useRef(false)

  useLayoutEffect(() => {
    if (restoreTo.current === null || !list.current) return
    list.current.scrollTop = restoreTo.current
    lastTop.current = restoreTo.current
    restoreTo.current = null
  })

  const touch = () => setStats((s) => (s.started === null ? { ...s, started: performance.now() } : s))
  const click = () => {
    touch()
    setStats((s) => ({ ...s, clicks: s.clicks + 1 }))
  }

  const open = (id: number) => {
    touch()
    saved.current = list.current?.scrollTop ?? 0
    setDetail(id)
    setStats((s) => {
      const now = performance.now()
      if (s.phase === 'find' && id === target) return { ...s, phase: 'open', found: now - (s.started ?? now) }
      if (s.phase === 'refind' && id === target + 1) return { ...s, phase: 'done', refound: now - (s.back ?? now) }
      return s
    })
  }

  const back = () => {
    setDetail(null)
    setStats((s) => (s.phase === 'open' ? { ...s, phase: 'refind', back: performance.now() } : s))
    // What you come back to is the whole point of this artifact.
    if (mode === 'infinite' && !restore) {
      setLoaded(PER_PAGE)
      restoreTo.current = 0
    } else restoreTo.current = mode === 'pages' ? 0 : saved.current
  }

  const onScroll = () => {
    const el = list.current
    if (!el) return
    touch()
    const delta = Math.abs(el.scrollTop - lastTop.current)
    lastTop.current = el.scrollTop
    setStats((s) => ({ ...s, scrolled: s.scrolled + delta }))
    const bottom = shouldLoad(el.scrollTop, el.clientHeight, el.scrollHeight, 60)
    if (bottom && !footerVisible.current) setStats((s) => ({ ...s, footerSeen: s.footerSeen + 1 }))
    footerVisible.current = bottom
    if (mode === 'infinite' && !loading && loaded < TOTAL && shouldLoad(el.scrollTop, el.clientHeight, el.scrollHeight)) {
      setLoading(true)
      window.setTimeout(() => {
        setLoaded((n) => Math.min(TOTAL, n + PER_PAGE))
        setLoading(false)
      }, 450)
    }
  }

  const goPage = (p: number) => {
    click()
    setPage(Math.max(1, Math.min(pageCount(), p)))
    restoreTo.current = 0
  }

  const [from, to] = mode === 'pages' ? pageRange(page) : [1, loaded]
  const rows = items(from - 1, to)
  const info = MODES.find((m) => m.id === mode)!
  const task =
    stats.phase === 'find'
      ? `Find #${target} and open it.`
      : stats.phase === 'open'
        ? 'Found it! Now press Back…'
        : stats.phase === 'refind'
          ? `…and open #${target + 1}, right after it.`
          : 'Done.'

  return (
    <section className="card fp-panel">
      <header>
        <h3>{info.name}</h3>
        <span className="small muted">{info.hint}</span>
      </header>
      <div className={`fp-task ${stats.phase}`}>{task}</div>

      <div className="fp-frame">
        <div className="fp-list" ref={list} onScroll={onScroll}>
          {rows.map((it) => (
            <Row key={it.id} it={it} onOpen={() => open(it.id)} />
          ))}

          {mode === 'infinite' && loaded < TOTAL && <div className="fp-loading">{loading ? 'Loading…' : '·'}</div>}
          {mode === 'more' && loaded < TOTAL && (
            <button
              className="fp-more"
              onClick={() => {
                click()
                setLoaded((n) => Math.min(TOTAL, n + PER_PAGE))
              }}
            >
              Load more ({loaded} of {TOTAL})
            </button>
          )}
          {mode === 'pages' && (
            <nav className="fp-pager" aria-label="Pages">
              <button onClick={() => goPage(page - 1)} disabled={page === 1} aria-label="Previous page">
                ‹
              </button>
              {pageList(page, pageCount()).map((p, i) =>
                p === '…' ? (
                  <span key={`gap${i}`} className="fp-gap">
                    …
                  </span>
                ) : (
                  <button key={p} className={p === page ? 'current' : ''} aria-current={p === page ? 'page' : undefined} onClick={() => goPage(p)}>
                    {p}
                  </button>
                ),
              )}
              <button onClick={() => goPage(page + 1)} disabled={page === pageCount()} aria-label="Next page">
                ›
              </button>
              <form
                className="fp-jump"
                onSubmit={(e) => {
                  e.preventDefault()
                  const n = Number(jump)
                  if (n) goPage(n)
                  setJump('')
                }}
              >
                <input value={jump} onChange={(e) => setJump(e.target.value.replace(/\D/g, ''))} placeholder="page" aria-label="Go to page" inputMode="numeric" />
              </form>
            </nav>
          )}
          <footer className="fp-footer">
            Footer · About · Careers · Contact
            {mode === 'infinite' && loaded < TOTAL && <span className="muted"> (it keeps running away)</span>}
          </footer>
        </div>

        {detail !== null && (
          <div className="fp-detail">
            <button className="fp-back" onClick={back}>
              ← Back
            </button>
            <div className="fp-hero" style={{ background: `hsl(${item(detail).hue} 60% 60%)` }} />
            <h4>
              #{detail} {item(detail).title}
            </h4>
            <p className="muted small">
              By {item(detail).author} · {item(detail).minutes} min read. Imagine the article here. When you go back, where will
              you land?
            </p>
          </div>
        )}
      </div>

      <dl className="fp-stats small">
        <dt>Find #{target}</dt>
        <dd>{secs(stats.found)}</dd>
        <dt>Back to #{target + 1}</dt>
        <dd>{secs(stats.refound)}</dd>
        <dt>Scrolled</dt>
        <dd>{Math.round(stats.scrolled).toLocaleString()} px</dd>
        <dt>Clicks</dt>
        <dd>{stats.clicks}</dd>
        {mode === 'pages' && (
          <>
            <dt>#{target} is on</dt>
            <dd>page {pageOf(target)}</dd>
          </>
        )}
        {mode === 'infinite' && (
          <>
            <dt>Footer sightings</dt>
            <dd>{stats.footerSeen}</dd>
          </>
        )}
      </dl>
    </section>
  )
}

export default function FeedPatterns() {
  const [target, setTarget] = useState(73)
  const [restore, setRestore] = useState(false)
  const [resetKey, setResetKey] = useState(0)

  return (
    <>
      <div className="card fp-controls">
        <div className="row">
          <label className="fp-target">
            Target item
            <input
              type="number"
              min={11}
              max={TOTAL - 1}
              value={target}
              onChange={(e) => {
                setTarget(Math.max(11, Math.min(TOTAL - 1, Number(e.target.value) || 73)))
                setResetKey((k) => k + 1)
              }}
            />
          </label>
          <Checkbox checked={restore} onChange={setRestore}>
            Infinite scroll remembers your place on Back
          </Checkbox>
          <span className="spacer" />
          <button onClick={() => setResetKey((k) => k + 1)}>Reset all three</button>
        </div>
        <p className="small muted">
          In each panel: find the target, open it, press Back, then open the next item. Then try reaching the footer. Infinite scroll
          is great for browsing, but it’s hard to find a specific item, come back to it, or reach the bottom.
        </p>
      </div>
      <div className="fp-grid">
        {MODES.map((m) => (
          <Panel key={`${m.id}-${resetKey}`} mode={m.id} target={target} restore={restore} />
        ))}
      </div>
    </>
  )
}
