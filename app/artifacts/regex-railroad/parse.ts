/**
 * A parser for JavaScript regex syntax, producing a tree the railroad diagram can draw.
 * It doesn't validate everything the engine does (the UI also runs `new RegExp`), it just
 * needs the shape: sequences, alternatives, groups, repeats and terminals.
 * Every node remembers its [start, end) span in the source, for hover highlighting.
 */

interface Span {
  start: number
  end: number
}

export type Node =
  | ({ type: 'seq'; items: Node[] } & Span)
  | ({ type: 'alt'; options: Node[] } & Span)
  | ({ type: 'literal'; text: string } & Span)
  | ({ type: 'class'; label: string; negated: boolean } & Span)
  | ({ type: 'anchor'; label: string } & Span)
  | ({ type: 'backref'; label: string } & Span)
  | ({ type: 'group'; kind: GroupKind; index?: number; name?: string; body: Node } & Span)
  | ({ type: 'repeat'; min: number; max: number; lazy: boolean; body: Node } & Span)

export type GroupKind = 'capture' | 'named' | 'noncapture' | 'lookahead' | 'negLookahead' | 'lookbehind' | 'negLookbehind'

export class RegexSyntaxError extends Error {
  constructor(
    message: string,
    readonly position: number,
  ) {
    super(message)
  }
}

const CLASS_ESCAPES: Record<string, [string, boolean]> = {
  d: ['digit', false],
  D: ['digit', true],
  w: ['word char', false],
  W: ['word char', true],
  s: ['whitespace', false],
  S: ['whitespace', true],
}

const CONTROL_ESCAPES: Record<string, string> = { n: '\n', r: '\r', t: '\t', f: '\f', v: '\v', 0: '\0' }

/** How a single character is shown inside a terminal box. */
export function showChar(ch: string): string {
  switch (ch) {
    case ' ':
      return '␣'
    case '\n':
      return '↵'
    case '\t':
      return '⇥'
    case '\r':
      return '\\r'
    case '\0':
      return '\\0'
    default:
      return ch
  }
}

class Parser {
  pos = 0
  groups = 0

  constructor(readonly src: string) {}

  parse(): Node {
    const node = this.alternation()
    if (this.pos < this.src.length) throw new RegexSyntaxError('Unmatched ")"', this.pos)
    return node
  }

  private peek(offset = 0) {
    return this.src[this.pos + offset]
  }

  private alternation(): Node {
    const start = this.pos
    const options = [this.sequence()]
    while (this.peek() === '|') {
      this.pos++
      options.push(this.sequence())
    }
    return options.length === 1 ? options[0] : { type: 'alt', options, start, end: this.pos }
  }

  private sequence(): Node {
    const start = this.pos
    const items: Node[] = []
    while (this.pos < this.src.length && this.peek() !== '|' && this.peek() !== ')') {
      const node = this.quantified()
      const last = items[items.length - 1]
      // Merge runs of plain characters into one box: "abc" instead of "a" "b" "c".
      if (node.type === 'literal' && last?.type === 'literal' && last.end === node.start) {
        last.text += node.text
        last.end = node.end
      } else {
        items.push(node)
      }
    }
    return items.length === 1 ? items[0] : { type: 'seq', items, start, end: this.pos }
  }

  private quantified(): Node {
    const atom = this.atom()
    const q = this.quantifier()
    if (!q) return atom
    if (atom.type === 'anchor') throw new RegexSyntaxError('Nothing to repeat', atom.start)
    let lazy = false
    if (this.peek() === '?') {
      lazy = true
      this.pos++
    }
    // Only the last character of a literal run is repeated: "ab+" is "a" then "b+".
    return { type: 'repeat', min: q.min, max: q.max, lazy, body: atom, start: atom.start, end: this.pos }
  }

  private quantifier(): { min: number; max: number } | null {
    const ch = this.peek()
    if (ch === '*' || ch === '+' || ch === '?') {
      this.pos++
      return { min: ch === '+' ? 1 : 0, max: ch === '?' ? 1 : Infinity }
    }
    if (ch === '{') {
      const m = /^\{(\d+)(,(\d*))?\}/.exec(this.src.slice(this.pos))
      if (!m) return null
      const min = Number(m[1])
      const max = m[2] === undefined ? min : m[3] === '' ? Infinity : Number(m[3])
      if (max < min) throw new RegexSyntaxError('Numbers out of order in {} quantifier', this.pos)
      this.pos += m[0].length
      return { min, max }
    }
    return null
  }

  private atom(): Node {
    const start = this.pos
    const ch = this.src[this.pos++]
    switch (ch) {
      case '(':
        return this.group(start)
      case '[':
        return this.characterClass(start)
      case '.':
        return { type: 'class', label: 'any character', negated: false, start, end: this.pos }
      case '^':
        return { type: 'anchor', label: 'start', start, end: this.pos }
      case '$':
        return { type: 'anchor', label: 'end', start, end: this.pos }
      case '\\':
        return this.escape(start)
      case '*':
      case '+':
      case '?':
        throw new RegexSyntaxError('Nothing to repeat', start)
      case '{':
        if (/^\d+(,\d*)?\}/.test(this.src.slice(this.pos))) throw new RegexSyntaxError('Nothing to repeat', start)
        return { type: 'literal', text: ch, start, end: this.pos }
      default:
        return { type: 'literal', text: ch, start, end: this.pos }
    }
  }

  private group(start: number): Node {
    let kind: GroupKind = 'capture'
    let name: string | undefined
    if (this.peek() === '?') {
      const rest = this.src.slice(this.pos)
      const named = /^\?<([A-Za-z_$][\w$]*)>/.exec(rest)
      if (rest.startsWith('?:')) kind = 'noncapture'
      else if (rest.startsWith('?=')) kind = 'lookahead'
      else if (rest.startsWith('?!')) kind = 'negLookahead'
      else if (rest.startsWith('?<=')) kind = 'lookbehind'
      else if (rest.startsWith('?<!')) kind = 'negLookbehind'
      else if (named) {
        kind = 'named'
        name = named[1]
      } else throw new RegexSyntaxError('Invalid group', start)
      this.pos += kind === 'named' ? named![0].length : kind === 'lookbehind' || kind === 'negLookbehind' ? 3 : 2
    }
    // Groups are numbered by their opening parenthesis, like the engine does.
    const index = kind === 'capture' || kind === 'named' ? ++this.groups : undefined
    const body = this.alternation()
    if (this.peek() !== ')') throw new RegexSyntaxError('Unterminated group', start)
    this.pos++
    return { type: 'group', kind, index, name, body, start, end: this.pos }
  }

  private characterClass(start: number): Node {
    let negated = false
    if (this.peek() === '^') {
      negated = true
      this.pos++
    }
    const parts: string[] = []
    while (this.pos < this.src.length && this.peek() !== ']') {
      let item = this.classChar()
      // A range like a-z (but a trailing "-" is a literal).
      if (this.peek() === '-' && this.peek(1) !== undefined && this.peek(1) !== ']') {
        this.pos++
        item = `${item}–${this.classChar()}`
      }
      parts.push(item)
    }
    if (this.peek() !== ']') throw new RegexSyntaxError('Unterminated character class', start)
    this.pos++
    const label = parts.length ? parts.join(' ') : negated ? 'anything' : 'nothing'
    return { type: 'class', label, negated: negated && parts.length > 0, start, end: this.pos }
  }

  private classChar(): string {
    const ch = this.src[this.pos++]
    if (ch !== '\\') return showChar(ch)
    const next = this.src[this.pos++]
    if (next === undefined) throw new RegexSyntaxError('\\ at end of pattern', this.pos - 1)
    if (CLASS_ESCAPES[next]) {
      const [label, negated] = CLASS_ESCAPES[next]
      return negated ? `non-${label}` : label
    }
    if (next === 'b') return '⌫'
    return showChar(CONTROL_ESCAPES[next] ?? this.codeEscape(next) ?? next)
  }

  /** \xHH, \uHHHH and \u{H…}; returns null if this isn't one. */
  private codeEscape(letter: string): string | null {
    const rest = this.src.slice(this.pos)
    const m =
      letter === 'x' ? /^[0-9a-fA-F]{2}/.exec(rest) : letter === 'u' ? /^(\{[0-9a-fA-F]+\}|[0-9a-fA-F]{4})/.exec(rest) : null
    if (!m) return null
    this.pos += m[0].length
    return String.fromCodePoint(parseInt(m[0].replace(/[{}]/g, ''), 16))
  }

  private escape(start: number): Node {
    const next = this.src[this.pos++]
    if (next === undefined) throw new RegexSyntaxError('\\ at end of pattern', start)
    const end = () => this.pos
    if (CLASS_ESCAPES[next]) {
      const [label, negated] = CLASS_ESCAPES[next]
      return { type: 'class', label, negated, start, end: end() }
    }
    if (next === 'b') return { type: 'anchor', label: 'word boundary', start, end: end() }
    if (next === 'B') return { type: 'anchor', label: 'not word boundary', start, end: end() }
    if (/[1-9]/.test(next)) {
      let digits = next
      while (/\d/.test(this.peek() ?? '')) digits += this.src[this.pos++]
      return { type: 'backref', label: `group #${digits}`, start, end: end() }
    }
    if (next === 'k') {
      const m = /^<([A-Za-z_$][\w$]*)>/.exec(this.src.slice(this.pos))
      if (m) {
        this.pos += m[0].length
        return { type: 'backref', label: `group "${m[1]}"`, start, end: end() }
      }
    }
    const text = CONTROL_ESCAPES[next] ?? this.codeEscape(next) ?? next
    return { type: 'literal', text, start, end: end() }
  }
}

export function parse(source: string): Node {
  return new Parser(source).parse()
}

/** Human summary of a repeat's bounds, e.g. "2–4 times", "at least 3 times". */
export function repeatLabel(min: number, max: number): string | null {
  if ((min === 0 || min === 1) && (max === 1 || max === Infinity)) return null // ?, *, + speak for themselves
  if (min === max) return `${min} times`
  if (max === Infinity) return `${min}+ times`
  return `${min}–${max} times`
}
