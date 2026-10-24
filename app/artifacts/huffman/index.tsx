import { useEffect, useMemo, useState } from 'react'
import { Slider } from '../../kit/Controls'
import { build, codes, encode, entropy, fixedWidth, frequencies, layout, show, type Placed } from './huffman'
import './style.css'

const PRESETS = [
  { label: 'Hello world', text: 'hello world' },
  { label: 'Mississippi', text: 'mississippi river' },
  { label: 'Pangram', text: 'the quick brown fox jumps over the lazy dog' },
  { label: 'pt-BR', text: 'o rato roeu a roupa do rei de roma e a rainha com raiva resolveu remendar' },
  { label: 'Code', text: 'for (let i = 0; i < n; i++) {\n  sum += a[i] * a[i]\n}' },
  { label: 'Skewed', text: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabbbbbbbbccccdde' },
] as const

const SLOT = 36 // px per leaf column
const ROW = 58 // px per tree level
const R = 14 // node radius
const STREAM_LIMIT = 400 // characters of the encoded stream drawn as chips

export default function Huffman() {
  const [text, setText] = useState<string>(PRESETS[0].text)
  const [stepIndex, setStepIndex] = useState(Infinity)
  const [playing, setPlaying] = useState(false)
  const [hover, setHover] = useState<string | null>(null)

  const { root, steps } = useMemo(() => build(text), [text])
  const table = useMemo(() => codes(root), [root])
  const counts = useMemo(() => frequencies(text), [text])
  const bits = useMemo(() => encode(text, table), [text, table])

  const last = steps.length - 1
  const at = Math.min(stepIndex, last)
  const forest = steps[at]
  const placed = useMemo(() => layout(forest), [forest])
  // The tree made by the latest merge: the one with the highest id.
  const newest = at > 0 ? Math.max(...forest.map((n) => n.id)) : -1

  useEffect(() => {
    if (!playing) return
    if (at >= last) {
      setPlaying(false)
      return
    }
    const id = setTimeout(() => setStepIndex(at + 1), 650)
    return () => clearTimeout(id)
  }, [playing, at, last])

  // Path from the hovered leaf up to its root, for highlighting.
  const onPath = new Set<Placed>()
  for (let p = placed.find((q) => q.node.symbol === hover); p; p = p.parent) onPath.add(p)

  const chars = [...text]
  const n = chars.length
  const utf8Bits = new TextEncoder().encode(text).length * 8
  const fixedBits = n * fixedWidth(counts.size)
  const bound = entropy(text) * n
  const rows = [...counts].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))

  const maxX = Math.max(0, ...placed.map((p) => p.x))
  const maxDepth = Math.max(0, ...placed.map((p) => p.depth))
  const width = (maxX + 1) * SLOT + 2 * R
  const height = (maxDepth + 1) * ROW + 2 * R
  const cx = (p: Placed) => R + SLOT / 2 + p.x * SLOT
  const cy = (p: Placed) => R + 10 + p.depth * ROW

  return (
    <>
      <div className="card hf-input">
        <textarea
          className="hf-text mono"
          value={text}
          rows={3}
          spellCheck={false}
          onChange={(e) => {
            setText(e.target.value)
            setStepIndex(Infinity)
            setPlaying(false)
          }}
          aria-label="Text to compress"
        />
        <div className="row">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              className={`chip${p.text === text ? ' active' : ''}`}
              onClick={() => {
                setText(p.text)
                setStepIndex(Infinity)
                setPlaying(false)
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="hf-stats">
          <Stat label="UTF-8" bits={utf8Bits} n={n} />
          <Stat label={`Fixed ${fixedWidth(counts.size)}-bit`} bits={fixedBits} n={n} />
          <Stat label="Huffman" bits={bits.length} n={n} strong />
          <Stat label="Entropy bound" bits={bound} n={n} />
          <div className="hf-stat">
            <span className="muted small">Saved vs UTF-8</span>
            <strong>{utf8Bits ? `${(100 - (bits.length / utf8Bits) * 100).toFixed(1)}%` : '—'}</strong>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="row">
          <button
            className="primary"
            disabled={last === 0}
            onClick={() => {
              if (at >= last) setStepIndex(0)
              setPlaying((p) => !p || at >= last)
            }}
          >
            {playing ? '❚❚ Pause' : at >= last ? '▶ Replay the build' : '▶ Play'}
          </button>
          <div className="hf-step">
            <Slider
              label="Merge"
              value={at}
              min={0}
              max={Math.max(1, last)}
              format={(v) => (v === 0 ? 'leaves only' : `${v} of ${last}`)}
              onChange={(v) => {
                setPlaying(false)
                setStepIndex(v)
              }}
            />
          </div>
          <span className="small muted">
            {at === 0 ? 'Every symbol starts as its own tree, weighted by its count.' : at < last ? 'Merged the two lightest trees.' : 'One tree left: read a code from the root down, left = 0, right = 1.'}
          </span>
        </div>
        <div className="hf-tree">
          {n === 0 ? (
            <p className="muted">Type something above.</p>
          ) : (
            <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Huffman tree">
              {placed.map(
                (p) =>
                  p.parent && (
                    <g key={`e${p.node.id}`} className={`hf-edge${onPath.has(p) ? ' on' : ''}`}>
                      <line x1={cx(p.parent)} y1={cy(p.parent)} x2={cx(p)} y2={cy(p)} />
                      <text x={(cx(p.parent) + cx(p)) / 2 + (p.bit === '0' ? -7 : 7)} y={(cy(p.parent) + cy(p)) / 2} textAnchor="middle" dominantBaseline="middle">
                        {p.bit}
                      </text>
                    </g>
                  ),
              )}
              {placed.map((p) => {
                const leaf = p.node.symbol !== undefined
                const cls = ['hf-node', leaf ? 'leaf' : 'inner', onPath.has(p) ? 'on' : '', p.node.id === newest ? 'newest' : ''].join(' ')
                return (
                  <g
                    key={`n${p.node.id}`}
                    className={cls}
                    transform={`translate(${cx(p)} ${cy(p)})`}
                    onPointerEnter={() => leaf && setHover(p.node.symbol!)}
                    onPointerLeave={() => setHover(null)}
                  >
                    <circle r={R} />
                    <text className="hf-label" dominantBaseline="central" textAnchor="middle">
                      {leaf ? show(p.node.symbol!) : p.node.weight}
                    </text>
                    {leaf && (
                      <text className="hf-weight" y={R + 11} textAnchor="middle">
                        {p.node.weight}
                      </text>
                    )}
                  </g>
                )
              })}
            </svg>
          )}
        </div>
      </div>

      <div className="hf-layout">
        <div className="card">
          <h2>Code table</h2>
          <table className="hf-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Count</th>
                <th>Code</th>
                <th>Bits</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([symbol, count]) => (
                <tr key={symbol} className={hover === symbol ? 'on' : ''} onPointerEnter={() => setHover(symbol)} onPointerLeave={() => setHover(null)}>
                  <td className="mono">{show(symbol)}</td>
                  <td>{count}</td>
                  <td className="mono">{table.get(symbol)}</td>
                  <td>{count * (table.get(symbol)?.length ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h2>Encoded stream</h2>
          <p className="small muted">
            {bits.length} bits. Every chunk is one character; because no code is a prefix of another,
            the decoder never needs separators.
          </p>
          <div className="hf-stream mono">
            {chars.slice(0, STREAM_LIMIT).map((ch, i) => (
              <span
                key={i}
                className={`hf-chunk${hover === ch ? ' on' : ''}`}
                title={`${show(ch)} → ${table.get(ch)}`}
                onPointerEnter={() => setHover(ch)}
                onPointerLeave={() => setHover(null)}
              >
                {table.get(ch)}
              </span>
            ))}
            {n > STREAM_LIMIT && <span className="muted"> …</span>}
          </div>
        </div>
      </div>

      <p className="hint">
        Huffman's 1952 algorithm builds the best possible code that turns each symbol into a whole
        number of bits: keep merging the two lightest trees, and frequent symbols end up near the root
        with short codes. It can never beat the <strong>entropy bound</strong> (Shannon's limit for this
        letter mix) and always stays within one bit per symbol of it. Hover a symbol anywhere to trace
        its path, or press <strong>Play</strong> to watch the tree grow merge by merge.
      </p>
    </>
  )
}

function Stat({ label, bits, n, strong }: { label: string; bits: number; n: number; strong?: boolean }) {
  return (
    <div className={`hf-stat${strong ? ' strong' : ''}`}>
      <span className="muted small">{label}</span>
      <strong>{bits.toLocaleString(undefined, { maximumFractionDigits: 1 })} bits</strong>
      <span className="muted small">{n ? `${(bits / n).toFixed(2)} per char` : '—'}</span>
    </div>
  )
}
