import { describe, expect, it } from 'vitest'
import { parse, repeatLabel, RegexSyntaxError, type Node } from './parse'

/** A compact text form of the tree, so expectations stay readable. */
function show(node: Node): string {
  switch (node.type) {
    case 'seq':
      return `seq(${node.items.map(show).join(', ')})`
    case 'alt':
      return `alt(${node.options.map(show).join(' | ')})`
    case 'literal':
      return `"${node.text}"`
    case 'class':
      return `${node.negated ? '!' : ''}[${node.label}]`
    case 'anchor':
      return `<${node.label}>`
    case 'backref':
      return `ref(${node.label})`
    case 'group':
      return `${node.kind}${node.index ?? ''}${node.name ? `:${node.name}` : ''}(${show(node.body)})`
    case 'repeat':
      return `rep${node.lazy ? '?' : ''}{${node.min},${node.max === Infinity ? '∞' : node.max}}(${show(node.body)})`
  }
}

describe('parse', () => {
  it.each([
    ['abc', '"abc"'],
    ['ab+c', 'seq("a", rep{1,∞}("b"), "c")'],
    ['a|b|cd', 'alt("a" | "b" | "cd")'],
    ['^\\d{3}-\\d{4}$', 'seq(<start>, rep{3,3}([digit]), "-", rep{4,4}([digit]), <end>)'],
    ['x{2,}y{1,3}?', 'seq(rep{2,∞}("x"), rep?{1,3}("y"))'],
    ['[a-z0-9_]', '[a–z 0–9 _]'],
    ['[^\\s]', '![whitespace]'],
    ['[a-]', '[a -]'],
    ['.\\W\\b', 'seq([any character], ![word char], <word boundary>)'],
    ['(a)(?:b)(?<year>c)', 'seq(capture1("a"), noncapture("b"), named2:year("c"))'],
    ['(?=a)(?!b)(?<=c)(?<!d)', 'seq(lookahead("a"), negLookahead("b"), lookbehind("c"), negLookbehind("d"))'],
    ['(a)\\1\\k<n>', 'seq(capture1("a"), ref(group #1), ref(group "n"))'],
    ['\\.\\*\\x41\\u0042', '".*AB"'],
    ['(a|)', 'capture1(alt("a" | seq()))'],
    ['a{', '"a{"'],
  ])('%s', (source, expected) => {
    expect(show(parse(source))).toBe(expected)
  })

  it('numbers nested groups by their opening parenthesis', () => {
    expect(show(parse('((a)(b))'))).toBe('capture1(seq(capture2("a"), capture3("b")))')
  })

  it('records source spans', () => {
    const node = parse('ab(cd)+')
    expect(node.type).toBe('seq')
    if (node.type !== 'seq') return
    const repeat = node.items[1]
    expect('ab(cd)+'.slice(repeat.start, repeat.end)).toBe('(cd)+')
  })

  it.each([
    ['(a', 'Unterminated group'],
    ['a)', 'Unmatched ")"'],
    ['*a', 'Nothing to repeat'],
    ['[abc', 'Unterminated character class'],
    ['a{3,1}', 'Numbers out of order in {} quantifier'],
    ['a\\', '\\ at end of pattern'],
  ])('rejects %s', (source, message) => {
    expect(() => parse(source)).toThrow(RegexSyntaxError)
    expect(() => parse(source)).toThrow(message)
  })
})

describe('repeatLabel', () => {
  it('stays quiet for ?, * and +', () => {
    expect(repeatLabel(0, 1)).toBeNull()
    expect(repeatLabel(0, Infinity)).toBeNull()
    expect(repeatLabel(1, Infinity)).toBeNull()
  })
  it('describes counted repeats', () => {
    expect(repeatLabel(3, 3)).toBe('3 times')
    expect(repeatLabel(2, Infinity)).toBe('2+ times')
    expect(repeatLabel(1, 4)).toBe('1–4 times')
  })
})
