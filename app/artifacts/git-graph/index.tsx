import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Checkbox } from '../../kit/Controls'
import { decorations, headId, init, layout, run, short, tracking, type Placed, type Repo } from './git'
import './style.css'

const SCENARIOS = [
  {
    label: 'Undo pushed commits',
    hint: 'Drop two pushed commits but keep their changes, then force-push.',
    lines: [
      'git commit -m "Finish the project"',
      'git commit -m "Add artifacts"',
      'git commit -m "Better Huffman text"',
      'git push',
      'git reset HEAD~2',
      'git status',
      'git commit -am "Add artifacts, take two"',
      'git push',
      'git push --force-with-lease',
    ],
  },
  {
    label: 'Feature branch + merge',
    hint: 'Work on a branch while main moves on, then merge with a two-parent commit.',
    lines: [
      'git commit -m "Set up app"',
      'git switch -c feature',
      'git commit -m "Add login form"',
      'git commit -m "Validate email"',
      'git switch main',
      'git commit -m "Fix typo in README"',
      'git merge feature',
    ],
  },
  {
    label: 'Rebase instead',
    hint: 'Same history, but replay the feature on top of main for a straight line.',
    lines: [
      'git commit -m "Set up app"',
      'git switch -c feature',
      'git commit -m "Add login form"',
      'git commit -m "Validate email"',
      'git switch main',
      'git commit -m "Fix typo in README"',
      'git switch feature',
      'git rebase main',
      'git switch main',
      'git merge feature',
    ],
  },
  {
    label: 'Hotfix cherry-pick',
    hint: 'Copy one fix from a release branch onto main.',
    lines: [
      'git commit -m "v1.0"',
      'git branch release',
      'git commit -m "New dashboard"',
      'git switch release',
      'git commit -m "Fix crash on save"',
      'git switch main',
      'git cherry-pick release',
      'git log',
    ],
  },
  {
    label: 'Detached HEAD',
    hint: 'Commit without a branch, walk away, and rescue it from the reflog.',
    lines: [
      'git commit -m "Stable"',
      'git commit -m "Latest"',
      'git checkout HEAD~1',
      'git commit -m "Experiment"',
      'git switch main',
      'git reflog',
      'git branch experiment HEAD@1',
    ],
  },
] as const

const DX = 70 // px per column
const DY = 84 // px per lane
const R = 12 // commit radius
const PAD = 28
const LANE_COLORS = ['--cat-algorithms', '--cat-sound', '--cat-generative', '--cat-tools', '--cat-math', '--cat-games']
const SUBCOMMANDS = ['add', 'branch', 'checkout', 'cherry-pick', 'commit', 'log', 'merge', 'push', 'rebase', 'reflog', 'reset', 'revert', 'status', 'switch']

interface Line {
  kind: 'cmd' | 'out' | 'err'
  text: string
}
interface Pos {
  x: number
  y: number
  o: number
}

const laneColor = (lane: number) => `var(${LANE_COLORS[lane % LANE_COLORS.length]})`
const ease = (k: number) => 1 - (1 - k) ** 3

/**
 * Tween every key (commit or ref label) from where it is drawn now to its new target.
 * Keys seen for the first time grow out of `spawn(key)`, e.g. the new commit's parent.
 */
function useTween(targets: Map<string, Pos>, spawn: (key: string, drawn: Map<string, Pos>) => Pos | undefined) {
  const drawn = useRef(new Map<string, Pos>())
  const [, setFrame] = useState(0)
  const spawnRef = useRef(spawn)
  spawnRef.current = spawn

  useEffect(() => {
    const from = new Map(drawn.current)
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    const start = performance.now()
    let id = 0
    const step = (now: number) => {
      const k = reduced ? 1 : Math.min(1, (now - start) / 450)
      const e = ease(k)
      const next = new Map<string, Pos>()
      for (const [key, to] of targets) {
        const f = from.get(key) ?? spawnRef.current(key, from) ?? { ...to, o: 0 }
        next.set(key, { x: f.x + (to.x - f.x) * e, y: f.y + (to.y - f.y) * e, o: f.o + (to.o - f.o) * e })
      }
      drawn.current = next
      setFrame((n) => n + 1)
      if (k < 1) id = requestAnimationFrame(step)
    }
    id = requestAnimationFrame(step)
    return () => cancelAnimationFrame(id)
  }, [targets])

  return drawn.current
}

/** The edge from a parent to a child: branch-offs bend right away, merges bend at the end. */
function edgePath(p: Pos, c: Pos, merge: boolean) {
  if (Math.abs(p.y - c.y) < 0.5) return `M${p.x},${p.y}L${c.x},${c.y}`
  if (merge) {
    const bx = Math.max(p.x, c.x - DX)
    return `M${p.x},${p.y}L${bx},${p.y}C${bx + DX / 2},${p.y} ${c.x - DX / 2},${c.y} ${c.x},${c.y}`
  }
  const bx = Math.min(c.x, p.x + DX)
  return `M${p.x},${p.y}C${p.x + DX / 2},${p.y} ${bx - DX / 2},${c.y} ${bx},${c.y}L${c.x},${c.y}`
}

export default function GitGraph() {
  const [repo, setRepo] = useState<Repo>(init)
  const [past, setPast] = useState<Repo[]>([])
  const [lines, setLines] = useState<Line[]>([{ kind: 'out', text: 'A toy repo with one commit on main. Type "help", or pick a scenario above.' }])
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [cursor, setCursor] = useState<number | null>(null)
  const [queue, setQueue] = useState<string[]>([])
  const [showOrphans, setShowOrphans] = useState(true)
  const [hover, setHover] = useState<string | null>(null)
  const outputRef = useRef<HTMLDivElement>(null)
  const graphRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const execute = (line: string) => {
    const text = line.trim()
    if (!text) return
    setHistory((h) => [...h.filter((x) => x !== text), text])
    setCursor(null)
    if (text === 'clear') return setLines([])
    if (text === 'undo') {
      const previous = past[past.length - 1]
      setLines((l) => [...l, { kind: 'cmd', text }, previous ? { kind: 'out', text: 'Restored the repo to before the last command.' } : { kind: 'err', text: 'Nothing to undo.' }])
      if (previous) {
        setRepo(previous)
        setPast((p) => p.slice(0, -1))
      }
      return
    }
    // `HEAD@1` is accepted as a shorthand for HEAD@{1} (braces are awkward to type).
    const expanded = text.replace(/HEAD@\{?(\d+)\}?/g, (_, n) => repo.reflog[Number(n)]?.id ?? 'HEAD')
    const result = run(repo, expanded)
    const printed = result.output.map((o): Line => ({ kind: result.error ? 'err' : 'out', text: o }))
    setLines((l) => [...l, { kind: 'cmd' as const, text }, ...printed].slice(-300))
    if (result.repo !== repo) {
      setPast((p) => [...p.slice(-50), repo])
      setRepo(result.repo)
    }
  }

  // Scenario playback: one command every ~0.9 s.
  useEffect(() => {
    if (!queue.length) return
    const id = setTimeout(() => {
      execute(queue[0])
      setQueue((q) => q.slice(1))
    }, 900)
    return () => clearTimeout(id)
  }, [queue])

  const startScenario = (scenario: (typeof SCENARIOS)[number]) => {
    setRepo(init())
    setPast([])
    setLines([{ kind: 'out', text: `Scenario: ${scenario.label}. ${scenario.hint}` }])
    setQueue([...scenario.lines])
  }

  const reset = () => {
    setQueue([])
    setRepo(init())
    setPast([])
    setLines([{ kind: 'out', text: 'Fresh repo: one commit on main.' }])
  }

  useEffect(() => {
    outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight })
  }, [lines])

  // ---- Graph ----------------------------------------------------------

  const placed = useMemo(() => layout(repo, showOrphans), [repo, showOrphans])
  const byId = useMemo(() => new Map(placed.map((p) => [p.commit.id, p])), [placed])
  const maxDepth = Math.max(0, ...placed.map((p) => p.depth))
  const maxLane = Math.max(0, ...placed.map((p) => p.lane))

  // Ref labels stack above their commit: HEAD, then local branches, then origin/*.
  const labels = useMemo(() => {
    const result: { key: string; text: string; kind: 'head' | 'branch' | 'remote'; commit: string; index: number }[] = []
    for (const p of placed) {
      const refs = decorations(repo, p.commit.id).flatMap((d) => (d.startsWith('HEAD -> ') ? ['HEAD', d.slice(8)] : [d]))
      refs.forEach((text, index) => {
        const kind = text === 'HEAD' ? 'head' : text.startsWith('origin/') ? 'remote' : 'branch'
        result.push({ key: `ref:${text}`, text, kind, commit: p.commit.id, index })
      })
    }
    return result
  }, [placed, repo])

  // Make room above every lane for the tallest stack of labels.
  const stack = Math.max(1, ...labels.map((l) => l.index + 1))
  const top = R + 14 + (stack - 1) * 19 + 16
  const dy = Math.max(DY, top + 34)
  const width = PAD * 2 + maxDepth * DX + 80
  const height = top + maxLane * dy + 44
  const at = (p: Placed) => ({ x: PAD + p.depth * DX, y: top + p.lane * dy })

  const targets = useMemo(() => {
    const map = new Map<string, Pos>()
    for (const p of placed) map.set(p.commit.id, { ...at(p), o: p.reachable ? 1 : 0.4 })
    for (const l of labels) {
      const base = at(byId.get(l.commit)!)
      map.set(l.key, { x: base.x, y: base.y - R - 14 - l.index * 19, o: 1 })
    }
    return map
  }, [placed, labels, byId, top, dy])

  const drawn = useTween(targets, (key, from) => {
    const commit = repo.commits[key]
    const parent = commit && from.get(commit.parents[0])
    return parent ? { ...parent, o: 0 } : undefined
  })

  // Keep the newest commits in view as the graph grows.
  useEffect(() => {
    const el = graphRef.current
    if (el) el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' })
  }, [maxDepth])

  const tip = headId(repo)
  const branchName = 'branch' in repo.head ? repo.head.branch : null
  const shownCommit = hover ? repo.commits[hover] : repo.commits[tip]

  // ---- Terminal input -------------------------------------------------

  const complete = () => {
    const words = input.split(' ')
    const last = words[words.length - 1]
    const pool =
      words.length === 2 && words[0] === 'git'
        ? SUBCOMMANDS
        : [...Object.keys(repo.branches), ...Object.keys(repo.remote).map((b) => `origin/${b}`), 'HEAD']
    const hits = pool.filter((w) => w.startsWith(last))
    if (hits.length === 1) setInput([...words.slice(0, -1), hits[0]].join(' ') + ' ')
    else if (hits.length > 1) setLines((l): Line[] => [...l, { kind: 'out', text: hits.join('   ') }])
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      execute(input)
      setInput('')
    } else if (e.key === 'Tab') {
      e.preventDefault()
      complete()
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      if (!history.length) return
      const i = cursor ?? history.length
      const next = Math.max(0, Math.min(history.length, i + (e.key === 'ArrowUp' ? -1 : 1)))
      setCursor(next)
      setInput(history[next] ?? '')
    }
  }

  const track = branchName ? tracking(repo, branchName) : null

  return (
    <>
      <div className="card gg-top">
        <div className="presets">
          {SCENARIOS.map((s) => (
            <button key={s.label} className="chip" title={s.hint} onClick={() => startScenario(s)}>
              ▶ {s.label}
            </button>
          ))}
          <span className="spacer" />
          <button className="chip" onClick={reset}>
            Reset repo
          </button>
        </div>

        <div className="gg-graph" ref={graphRef}>
          <svg width={width} height={height} role="img" aria-label="Commit graph">
            {placed.map((p) =>
              p.commit.parents.map((parentId, i) => {
                const from = drawn.get(parentId)
                const to = drawn.get(p.commit.id)
                if (!from || !to) return null
                const lane = i === 0 ? p.lane : byId.get(parentId)?.lane ?? p.lane
                return (
                  <path
                    key={`${parentId}-${p.commit.id}`}
                    d={edgePath(from, to, i > 0)}
                    className={`gg-edge${p.reachable ? '' : ' orphan'}`}
                    style={{ stroke: laneColor(lane), opacity: to.o }}
                  />
                )
              }),
            )}

            {placed.map((p) => {
              const pos = drawn.get(p.commit.id)
              if (!pos) return null
              const isHead = p.commit.id === tip
              return (
                <g
                  key={p.commit.id}
                  className={`gg-commit${p.reachable ? '' : ' orphan'}${isHead ? ' head' : ''}`}
                  transform={`translate(${pos.x},${pos.y})`}
                  style={{ opacity: pos.o }}
                  onPointerEnter={() => setHover(p.commit.id)}
                  onPointerLeave={() => setHover(null)}
                  onClick={() => {
                    setInput((v) => (v.endsWith(' ') || !v ? v : v + ' ') + p.commit.id)
                    inputRef.current?.focus()
                  }}
                >
                  <circle r={R} style={{ fill: p.reachable ? laneColor(p.lane) : 'var(--surface)', stroke: laneColor(p.lane) }} />
                  {p.commit.parents.length > 1 && <circle r={4} className="gg-merge-dot" />}
                  <text y={R + 14} className="gg-id">
                    {p.commit.id.slice(0, 4)}
                  </text>
                </g>
              )
            })}

            {labels.map((l) => {
              const pos = drawn.get(l.key)
              if (!pos) return null
              const w = l.text.length * 7 + 14
              return (
                <g key={l.key} transform={`translate(${pos.x},${pos.y})`} style={{ opacity: pos.o }} className={`gg-label ${l.kind}`}>
                  <rect x={-w / 2} y={-9} width={w} height={18} rx={9} />
                  <text y={4}>{l.text}</text>
                </g>
              )
            })}
          </svg>
        </div>

        <div className="row gg-caption">
          {shownCommit && (
            <span className="mono small">
              <strong>{shownCommit.id}</strong> {shownCommit.message}
              {shownCommit.parents.length > 1 && <span className="muted"> · merge of {shownCommit.parents.map(short).join(' + ')}</span>}
            </span>
          )}
          <span className="spacer" />
          <Checkbox checked={showOrphans} onChange={setShowOrphans}>
            Show unreachable commits
          </Checkbox>
        </div>
      </div>

      <div className="gg-bottom">
        <div className="card gg-terminal" onClick={() => inputRef.current?.focus()}>
          <div className="gg-output mono" ref={outputRef} aria-live="polite">
            {lines.map((l, i) => (
              <div key={i} className={`gg-line ${l.kind}`}>
                {l.kind === 'cmd' && <span className="gg-prompt">$ </span>}
                {l.text}
              </div>
            ))}
          </div>
          <div className="gg-input-row mono">
            <span className="gg-prompt">{branchName ?? short(tip)} $</span>
            <input
              ref={inputRef}
              className="gg-input mono"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder={queue.length ? `next: ${queue[0]}` : 'git commit -m "Hello"'}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              aria-label="Git command"
            />
          </div>
          <p className="hint">Enter runs · ↑↓ history · Tab completes · click a commit to paste its id · "undo" goes back</p>
        </div>

        <div className="card gg-side">
          <div>
            <h3>HEAD</h3>
            <p className="small">
              {branchName ? (
                <>
                  on <code>{branchName}</code> at <code>{short(tip)}</code>
                </>
              ) : (
                <>
                  <strong>detached</strong> at <code>{short(tip)}</code>
                </>
              )}
            </p>
            {track && (
              <p className="small muted">
                vs <code>origin/{branchName}</code>:{' '}
                {track.ahead || track.behind ? `${track.ahead} ahead, ${track.behind} behind` : 'up to date'}
              </p>
            )}
          </div>
          <div>
            <h3>Staged</h3>
            {repo.staged.length ? (
              <ul className="gg-changes staged">
                {repo.staged.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            ) : (
              <p className="small muted">Nothing staged.</p>
            )}
          </div>
          <div>
            <h3>Working tree</h3>
            {repo.unstaged.length ? (
              <ul className="gg-changes">
                {repo.unstaged.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            ) : (
              <p className="small muted">Clean.</p>
            )}
          </div>
          <p className="callout small">
            <code>reset --soft</code> keeps undone commits <em>staged</em>, <code>--mixed</code> (the default) keeps them
            as <em>unstaged</em> edits, and <code>--hard</code> deletes them. Commits nothing points at fade out but stay
            in the reflog.
          </p>
        </div>
      </div>
    </>
  )
}
