import { useMemo, useState, type ReactNode } from 'react'
import { parse, RegexSyntaxError, type Node } from './parse'
import { Railroad } from './railroad'
import './style.css'

const presets = [
  {
    name: 'Date',
    pattern: String.raw`(\d{4})-(\d{2})-(\d{2})`,
    tests: 'released on 2026-10-20\nbirthday: 1999-01-31, party 2000-12-01\nnot a date: 20-10-2026',
  },
  {
    name: 'Email',
    pattern: String.raw`(?<user>[\w.+-]+)@(?<domain>[\w-]+(?:\.[\w-]+)+)`,
    tests: 'ana.silva+news@example.com.br\nwrite to bob@mail.io today\nnot@valid',
  },
  {
    name: 'Hex colour',
    pattern: String.raw`#(?:[0-9a-fA-F]{3}){1,2}\b`,
    tests: 'color: #4c6ef5;\nshort #fff and long #FFFFFF\nnope: #12345 #ggg',
  },
  {
    name: 'BR phone',
    pattern: String.raw`\(?(\d{2})\)?\s?(9?\d{4})-?(\d{4})`,
    tests: '(11) 98765-4321\n21 3456-7890\n11987654321\ncall 123',
  },
  {
    name: 'URL',
    pattern: String.raw`https?:\/\/(?:www\.)?([\w-]+(?:\.[\w-]+)+)(\/\S*)?`,
    tests: 'see https://www.example.com/docs?page=2\nhttp://localhost:5186 has no dot\nftp://old.site.org',
  },
  {
    name: 'Repeated word',
    pattern: String.raw`\b(\w+)\s+\1\b`,
    tests: 'this is is a test\nno repeats here\nthe the end of the the line',
  },
  {
    name: 'Password rules',
    pattern: String.raw`^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}$`,
    tests: 'Secret123\nsecret123\nShort1\nALLUPPER99x',
  },
]

const FLAGS = [
  { flag: 'i', title: 'ignore case' },
  { flag: 'm', title: '^ and $ match at line breaks' },
  { flag: 's', title: '. also matches line breaks' },
  { flag: 'u', title: 'unicode' },
] as const

const MAX_LINES = 40
const MAX_LINE_LENGTH = 500

interface LineResult {
  text: string
  /** Highlight ranges: [start, end, colour index]. */
  ranges: [number, number, number][]
  matches: number
  groups: { label: string; value: string | undefined }[]
}

/** Run the regex over each line. When `group` is set, highlight that group instead of the whole match. */
function test(regex: RegExp, text: string, group: number | null, names: Map<number, string>): LineResult[] {
  return text
    .split('\n')
    .slice(0, MAX_LINES)
    .map((line) => {
      const textLine = line.slice(0, MAX_LINE_LENGTH)
      const ranges: [number, number, number][] = []
      let first: RegExpMatchArray | null = null
      let count = 0
      for (const m of textLine.matchAll(regex)) {
        first ??= m
        const indices = m.indices!
        const span = group === null ? indices[0] : indices[group]
        if (span) ranges.push([span[0], span[1], count % 2])
        count++
      }
      const groups = first
        ? first.slice(1).map((value, i) => ({ label: names.get(i + 1) ? `${i + 1} ${names.get(i + 1)}` : `${i + 1}`, value }))
        : []
      return { text: textLine, ranges, matches: count, groups }
    })
}

/** Group number → name for named groups (the match result only keys them by name). */
function groupNames(node: Node, names = new Map<number, string>()): Map<number, string> {
  switch (node.type) {
    case 'seq':
      node.items.forEach((item) => groupNames(item, names))
      break
    case 'alt':
      node.options.forEach((option) => groupNames(option, names))
      break
    case 'group':
      if (node.index !== undefined && node.name) names.set(node.index, node.name)
      groupNames(node.body, names)
      break
    case 'repeat':
      groupNames(node.body, names)
      break
  }
  return names
}

function Highlighted({ text, ranges }: { text: string; ranges: [number, number, number][] }) {
  const parts: ReactNode[] = []
  let at = 0
  ranges.forEach(([start, end, tone], i) => {
    if (start < at) return // overlapping (nested group spans): keep the first
    if (start > at) parts.push(text.slice(at, start))
    parts.push(
      start === end ? (
        <span key={i} className="rx-empty" />
      ) : (
        <mark key={i} className={`rx-match tone-${tone}`}>
          {text.slice(start, end)}
        </mark>
      ),
    )
    at = end
  })
  parts.push(text.slice(at))
  return <>{parts}</>
}

export default function RegexRailroad() {
  const [pattern, setPattern] = useState(presets[0].pattern)
  const [flags, setFlags] = useState('')
  const [tests, setTests] = useState(presets[0].tests)
  const [hover, setHover] = useState<Node | null>(null)

  const parsed = useMemo(() => {
    try {
      // The engine is the judge of validity; our parser only needs to draw it.
      const regex = new RegExp(pattern, `${flags}gd`)
      const tree = parse(pattern)
      return { tree, regex, names: groupNames(tree), error: null }
    } catch (error) {
      // The engine's message has no position; our parser usually knows where it broke.
      let position = error instanceof RegexSyntaxError ? error.position : null
      if (position === null) {
        try {
          parse(pattern)
        } catch (parseError) {
          if (parseError instanceof RegexSyntaxError) position = parseError.position
        }
      }
      const message = (error as Error).message.replace(/^Invalid regular expression: \/.*\/[a-z]*: /, '')
      return { tree: null, regex: null, names: new Map<number, string>(), error: { message, position } }
    }
  }, [pattern, flags])

  const hoveredGroup = hover?.type === 'group' && hover.index !== undefined ? hover.index : null
  const results = useMemo(
    () => (parsed.regex ? test(parsed.regex, tests, hoveredGroup, parsed.names) : []),
    [parsed, tests, hoveredGroup],
  )
  const matchingLines = results.filter((r) => r.matches > 0).length

  const toggleFlag = (flag: string) =>
    setFlags((f) => (f.includes(flag) ? f.replace(flag, '') : [...f, flag].sort().join('')))

  return (
    <>
      <div className="card rx-editor">
        <div className="presets">
          {presets.map((preset) => (
            <button
              key={preset.name}
              className={`chip${pattern === preset.pattern ? ' active' : ''}`}
              onClick={() => {
                setPattern(preset.pattern)
                setTests(preset.tests)
                setHover(null)
              }}
            >
              {preset.name}
            </button>
          ))}
        </div>

        <label className="rx-input">
          <span className="rx-slash">/</span>
          <input
            value={pattern}
            onChange={(e) => {
              setPattern(e.target.value)
              setHover(null)
            }}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            aria-label="Regular expression"
          />
          <span className="rx-slash">/{flags}</span>
        </label>

        <div className="row">
          {FLAGS.map(({ flag, title }) => (
            <button
              key={flag}
              className={`chip mono${flags.includes(flag) ? ' active' : ''}`}
              title={title}
              aria-pressed={flags.includes(flag)}
              onClick={() => toggleFlag(flag)}
            >
              {flag} <span className="count">{title}</span>
            </button>
          ))}
        </div>

        {parsed.error ? (
          <p className="rx-error">
            {parsed.error.message}
            {parsed.error.position !== null && (
              <>
                {' '}
                at position {parsed.error.position}:{' '}
                <code>
                  {pattern.slice(0, parsed.error.position)}
                  <mark>{pattern[parsed.error.position] ?? '␄'}</mark>
                  {pattern.slice(parsed.error.position + 1)}
                </code>
              </>
            )}
          </p>
        ) : (
          <p className="rx-source mono" aria-label="Pattern with the hovered part highlighted">
            {hover ? (
              <>
                {pattern.slice(0, hover.start)}
                <mark>{pattern.slice(hover.start, hover.end)}</mark>
                {pattern.slice(hover.end)}
              </>
            ) : (
              <span className="muted">Hover the diagram to see which part of the pattern each piece is.</span>
            )}
          </p>
        )}
      </div>

      {parsed.tree && (
        <div className="card rx-diagram">
          <div className="rx-scroll">
            <Railroad node={parsed.tree} hover={hover} onHover={setHover} />
          </div>
          <div className="legend">
            <span><i className="swatch rx-sw-literal" /> exact text</span>
            <span><i className="swatch rx-sw-class" /> one character from a set</span>
            <span><i className="swatch rx-sw-anchor" /> position (matches no character)</span>
            <span><i className="swatch rx-sw-group" /> capture group (hover: highlights its matches)</span>
          </div>
        </div>
      )}

      <div className="rx-tests">
        <div className="card">
          <h3>Test strings</h3>
          <textarea
            value={tests}
            onChange={(e) => setTests(e.target.value)}
            spellCheck={false}
            rows={8}
            aria-label="Test strings, one per line"
          />
          <p className="hint">One test per line. Lines over {MAX_LINE_LENGTH} characters are cut.</p>
        </div>
        <div className="card">
          <h3>
            Matches{' '}
            <span className="muted small">
              {parsed.regex ? `${matchingLines} of ${results.length} lines` : ''}
              {hoveredGroup !== null && ` · showing group #${hoveredGroup}`}
            </span>
          </h3>
          <ul className="rx-results">
            {results.map((r, i) => (
              <li key={i} className={r.matches ? 'hit' : 'miss'}>
                <span className="rx-badge">{r.matches ? `${r.matches}×` : '✗'}</span>
                <div>
                  <div className="mono rx-line">
                    <Highlighted text={r.text} ranges={r.ranges} />
                  </div>
                  {r.groups.length > 0 && (
                    <div className="rx-groups">
                      {r.groups.map((g) => (
                        <span key={g.label} className="tag mono">
                          #{g.label} = {g.value === undefined ? '—' : `“${g.value}”`}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  )
}
