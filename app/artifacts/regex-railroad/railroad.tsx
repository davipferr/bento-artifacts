import { Fragment, type MouseEvent, type ReactNode } from 'react'
import { repeatLabel, showChar, type GroupKind, type Node } from './parse'

/**
 * Railroad layout: every node becomes a Box that knows its width and how far it reaches
 * above (`up`) and below (`down`) the track it sits on. A box is drawn with its entry at
 * (x, y) and its exit at (x + w, y), so boxes chain left to right on one line.
 */
interface Box {
  w: number
  up: number
  down: number
  render: (x: number, y: number) => ReactNode
}

interface Ctx {
  hover: Node | null
  onHover: (node: Node) => void
}

const R = 10 // curve radius
const GAP = 16 // track between items in a sequence
const VGAP = 12 // between stacked alternatives
const CHAR_W = 7.8 // monospace 13px
const TERM_H = 26
const PAD = 11
const FRAME = 10 // inner padding of a group frame
const LABEL = 16 // room for a group's label

const line = (x1: number, y: number, x2: number) => (x2 > x1 ? <path d={`M${x1} ${y}H${x2}`} /> : null)

const lookLabels: Partial<Record<GroupKind, string>> = {
  lookahead: 'followed by',
  negLookahead: 'not followed by',
  lookbehind: 'preceded by',
  negLookbehind: 'not preceded by',
}

function hoverProps(node: Node, ctx: Ctx) {
  return {
    onMouseOver: (e: MouseEvent) => {
      e.stopPropagation()
      ctx.onHover(node)
    },
  }
}

function terminal(node: Node, text: string, variant: string, ctx: Ctx): Box {
  const w = Math.max(28, [...text].length * CHAR_W + 2 * PAD)
  const half = TERM_H / 2
  return {
    w,
    up: half,
    down: half,
    render: (x, y) => (
      <g className={`rr-term rr-${variant}${ctx.hover === node ? ' hot' : ''}`} {...hoverProps(node, ctx)}>
        <rect x={x} y={y - half} width={w} height={TERM_H} rx={variant === 'literal' ? half : 5} />
        <text x={x + w / 2} y={y + 4.5} textAnchor="middle">
          {text}
        </text>
      </g>
    ),
  }
}

function sequence(items: Node[], ctx: Ctx): Box {
  const boxes = items.map((item) => layout(item, ctx))
  if (!boxes.length) return { w: 2 * R, up: 0, down: 0, render: (x, y) => line(x, y, x + 2 * R) }
  return {
    w: boxes.reduce((sum, b) => sum + b.w, 0) + GAP * (boxes.length - 1),
    up: Math.max(...boxes.map((b) => b.up)),
    down: Math.max(...boxes.map((b) => b.down)),
    render: (x, y) => {
      let cx = x
      return boxes.map((b, i) => {
        const start = cx
        if (i > 0) cx += GAP
        const at = cx
        cx += b.w
        return (
          <Fragment key={i}>
            {i > 0 && line(start, y, at)}
            {b.render(at, y)}
          </Fragment>
        )
      })
    },
  }
}

function alternation(options: Node[], ctx: Ctx): Box {
  const boxes = options.map((option) => layout(option, ctx))
  const inner = Math.max(...boxes.map((b) => b.w))
  const offsets = [0]
  for (let i = 1; i < boxes.length; i++) offsets.push(offsets[i - 1] + boxes[i - 1].down + VGAP + boxes[i].up)
  const w = inner + 4 * R
  return {
    w,
    up: boxes[0].up,
    down: offsets[offsets.length - 1] + boxes[boxes.length - 1].down,
    render: (x, y) =>
      boxes.map((b, i) => {
        const yi = y + offsets[i]
        const right = x + w
        return (
          <Fragment key={i}>
            {i === 0 ? (
              line(x, y, x + 2 * R)
            ) : (
              <path
                d={`M${x} ${y}Q${x + R} ${y} ${x + R} ${y + R}V${yi - R}Q${x + R} ${yi} ${x + 2 * R} ${yi}`}
              />
            )}
            {b.render(x + 2 * R, yi)}
            {line(x + 2 * R + b.w, yi, right - 2 * R)}
            {i === 0 ? (
              line(right - 2 * R, y, right)
            ) : (
              <path
                d={`M${right - 2 * R} ${yi}Q${right - R} ${yi} ${right - R} ${yi - R}V${y + R}Q${right - R} ${y} ${right} ${y}`}
              />
            )}
          </Fragment>
        )
      }),
  }
}

function repeat(node: Extract<Node, { type: 'repeat' }>, ctx: Ctx): Box {
  const b = layout(node.body, ctx)
  const skip = node.min === 0
  const loop = node.max > 1
  const label = [repeatLabel(node.min, node.max), node.lazy ? 'lazy' : null].filter(Boolean).join(', ')
  const w = b.w + 4 * R
  const top = Math.max(b.up, R) + R
  const bottom = Math.max(b.down, R) + R
  const below = loop ? bottom : b.down
  return {
    w,
    up: skip ? top : b.up,
    down: below + (label ? LABEL : 0),
    render: (x, y) => {
      const right = x + w
      return (
        <>
          {line(x, y, x + 2 * R)}
          {b.render(x + 2 * R, y)}
          {line(x + 2 * R + b.w, y, right)}
          {skip && (
            <g className="rr-bypass">
              <path
                d={`M${x} ${y}Q${x + R} ${y} ${x + R} ${y - R}V${y - top + R}Q${x + R} ${y - top} ${x + 2 * R} ${y - top}H${right - 2 * R}Q${right - R} ${y - top} ${right - R} ${y - top + R}V${y - R}Q${right - R} ${y} ${right} ${y}`}
              />
              <path className="rr-arrow" d={`M${x + w / 2 - 4} ${y - top - 4}l8 4l-8 4z`} />
            </g>
          )}
          {loop && (
            <g className="rr-loop">
              <path
                d={`M${right - 2 * R} ${y}Q${right - R} ${y} ${right - R} ${y + R}V${y + bottom - R}Q${right - R} ${y + bottom} ${right - 2 * R} ${y + bottom}H${x + 2 * R}Q${x + R} ${y + bottom} ${x + R} ${y + bottom - R}V${y + R}Q${x + R} ${y} ${x + 2 * R} ${y}`}
              />
              <path className="rr-arrow" d={`M${x + w / 2 + 4} ${y + bottom - 4}l-8 4l8 4z`} />
            </g>
          )}
          {label && (
            <text className="rr-label" x={x + w / 2} y={y + below + 13} textAnchor="middle">
              {label}
            </text>
          )}
        </>
      )
    },
  }
}

function group(node: Extract<Node, { type: 'group' }>, ctx: Ctx): Box {
  const b = layout(node.body, ctx)
  if (node.kind === 'noncapture') return b
  const label =
    lookLabels[node.kind] ?? (node.kind === 'named' ? `group #${node.index} “${node.name}”` : `group #${node.index}`)
  const w = Math.max(b.w + 2 * FRAME, label.length * 6.5 + 12)
  const look = node.kind in lookLabels
  return {
    w,
    up: b.up + FRAME + LABEL,
    down: b.down + FRAME,
    render: (x, y) => {
      const inner = x + (w - b.w) / 2
      return (
        <g
          className={`rr-group${look ? ' rr-look' : ''}${ctx.hover === node ? ' hot' : ''}`}
          {...hoverProps(node, ctx)}
        >
          <rect x={x} y={y - b.up - FRAME} width={w} height={b.up + b.down + 2 * FRAME} rx={8} />
          <text className="rr-label" x={x + 4} y={y - b.up - FRAME - 5}>
            {label}
          </text>
          {line(x, y, inner)}
          {b.render(inner, y)}
          {line(inner + b.w, y, x + w)}
        </g>
      )
    },
  }
}

function layout(node: Node, ctx: Ctx): Box {
  switch (node.type) {
    case 'seq':
      return sequence(node.items, ctx)
    case 'alt':
      return alternation(node.options, ctx)
    case 'literal':
      return terminal(node, [...node.text].map(showChar).join(''), 'literal', ctx)
    case 'class':
      return terminal(node, node.negated ? `not ${node.label}` : node.label, node.negated ? 'class negated' : 'class', ctx)
    case 'anchor':
      return terminal(node, node.label, 'anchor', ctx)
    case 'backref':
      return terminal(node, `same as ${node.label}`, 'backref', ctx)
    case 'group':
      return group(node, ctx)
    case 'repeat':
      return repeat(node, ctx)
  }
}

const MARGIN = 34
const EDGE = 16

export function Railroad({
  node,
  hover,
  onHover,
}: {
  node: Node
  hover: Node | null
  onHover: (node: Node | null) => void
}) {
  const box = layout(node, { hover, onHover })
  const width = box.w + 2 * MARGIN
  const height = box.up + box.down + 2 * EDGE
  const y = EDGE + box.up
  return (
    <svg
      className="railroad"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Railroad diagram of the pattern"
      onMouseLeave={() => onHover(null)}
      onMouseOver={() => onHover(null)}
    >
      <g className="rr-track">
        <circle className="rr-stop" cx={10} cy={y} r={5} />
        {line(15, y, MARGIN)}
        {box.render(MARGIN, y)}
        {line(MARGIN + box.w, y, width - 15)}
        <circle className="rr-stop" cx={width - 10} cy={y} r={5} />
      </g>
    </svg>
  )
}
