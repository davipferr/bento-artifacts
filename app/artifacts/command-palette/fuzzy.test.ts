import { describe, expect, it } from 'vitest'
import { explain, fuzzy, highlight, pushRecent, rank } from './fuzzy'

describe('fuzzy', () => {
  it('needs every query character, in order', () => {
    expect(fuzzy('tsb', 'Toggle sidebar')).not.toBeNull()
    expect(fuzzy('bst', 'Toggle sidebar')).toBeNull()
    expect(fuzzy('toggle sidebar!', 'Toggle sidebar')).toBeNull()
  })

  it('is case-insensitive and ignores spaces in the query', () => {
    expect(fuzzy('TOG SIDE', 'Toggle sidebar')?.indices).toEqual([0, 1, 2, 7, 8, 9, 10])
  })

  it('prefers word starts over the first occurrence', () => {
    expect(fuzzy('tsb', 'Toggle sidebar')?.indices).toEqual([0, 7, 11])
    // A greedy matcher would take the "t" of "settings"; the word start "tab" scores higher.
    expect(fuzzy('sta', 'Toggle settings tab')?.indices).toEqual([7, 16, 17])
  })

  it('rewards camelCase humps', () => {
    expect(fuzzy('gbi', 'getByIdSlow')?.indices).toEqual([0, 3, 5])
  })

  it('scores consecutive and early matches higher', () => {
    const run = fuzzy('side', 'Toggle sidebar')!.score
    const spread = fuzzy('side', 'Musical interlude')!.score
    expect(run).toBeGreaterThan(spread)
    expect(fuzzy('new', 'New note')!.score).toBeGreaterThan(fuzzy('new', 'Open new window')!.score)
  })

  it('matches everything with an empty query', () => {
    expect(fuzzy('', 'Anything')).toEqual({ score: 0, indices: [] })
  })
})

describe('rank', () => {
  const commands = [
    { title: 'Open recent files', keywords: [] },
    { title: 'Toggle sidebar', keywords: ['panel', 'hide'] },
    { title: 'Open', keywords: [] },
    { title: 'Change accent color', keywords: ['theme'] },
  ]
  const ranked = (q: string) => rank(commands, q, (c) => c.title, (c) => c.keywords).map((r) => r.item.title)

  it('sorts by score and drops non-matches', () => {
    expect(ranked('open')).toEqual(['Open', 'Open recent files'])
  })

  it('finds items through keywords, without highlights', () => {
    const hits = rank(commands, 'theme', (c) => c.title, (c) => c.keywords)
    expect(hits.map((h) => h.item.title)).toEqual(['Change accent color'])
    expect(hits[0].match.indices).toEqual([])
  })

  it('keeps the original order for an empty query', () => {
    expect(ranked('')).toEqual(commands.map((c) => c.title))
  })
})

describe('helpers', () => {
  it('splits text into highlighted runs', () => {
    expect(highlight('Toggle', [0, 1, 4])).toEqual([
      { text: 'To', hit: true },
      { text: 'gg', hit: false },
      { text: 'l', hit: true },
      { text: 'e', hit: false },
    ])
  })

  it('explains each matched character', () => {
    expect(explain('Toggle sidebar', [0, 1, 7, 11]).map((e) => e.kind)).toEqual(['first', 'consecutive', 'word start', 'plain'])
    expect(explain('getById', [3]).map((e) => e.kind)).toEqual(['camelCase'])
  })

  it('keeps recents unique and capped', () => {
    expect(pushRecent(['a', 'b', 'c'], 'b', 3)).toEqual(['b', 'a', 'c'])
    expect(pushRecent(['a', 'b', 'c'], 'd', 3)).toEqual(['d', 'a', 'b'])
  })
})
