import { describe, expect, it } from 'vitest'
import { build, children, count, create, iconFor, move, navigate, path, remove, rename, stemRange, typeahead, visible, within, type Tree } from './tree'

const sample = () =>
  build({
    src: { kit: { 'a.ts': null }, 'main.tsx': null, 'file10.ts': null, 'file2.ts': null },
    docs: {},
    'README.md': null,
  })

const idOf = (tree: Tree, p: string) => Object.keys(tree).find((id) => path(tree, id) === p)!

describe('structure', () => {
  it('sorts folders first, then naturally', () => {
    const tree = sample()
    expect(children(tree, idOf(tree, 'src')).map((n) => n.name)).toEqual(['kit', 'file2.ts', 'file10.ts', 'main.tsx'])
  })

  it('builds paths and checks containment', () => {
    const tree = sample()
    const a = idOf(tree, 'src/kit/a.ts')
    expect(path(tree, a)).toBe('src/kit/a.ts')
    expect(within(tree, a, idOf(tree, 'src'))).toBe(true)
    expect(within(tree, a, idOf(tree, 'docs'))).toBe(false)
  })

  it('only lists rows inside expanded folders', () => {
    const tree = sample()
    expect(visible(tree, new Set()).map((r) => r.node.name)).toEqual(['docs', 'src', 'README.md'])
    const rows = visible(tree, new Set([idOf(tree, 'src')]))
    expect(rows.map((r) => `${r.depth}:${r.node.name}`)).toEqual(['0:docs', '0:src', '1:kit', '1:file2.ts', '1:file10.ts', '1:main.tsx', '0:README.md'])
    expect(rows[2]).toMatchObject({ size: 4, pos: 1 })
  })

  it('counts what a folder holds', () => {
    const tree = sample()
    expect(count(tree, idOf(tree, 'src'))).toEqual({ files: 4, folders: 1 })
  })
})

describe('rename', () => {
  it('renames, trimming spaces', () => {
    const tree = sample()
    const next = rename(tree, idOf(tree, 'README.md'), '  NOTES.md ')
    expect(next.tree && path(next.tree, idOf(tree, 'README.md'))).toBe('NOTES.md')
  })

  it.each([
    ['', 'required'],
    ['a/b', 'can’t contain'],
    ['..', 'reserved'],
    ['MAIN.TSX', 'already exists'],
  ])('rejects %j', (name, message) => {
    const tree = sample()
    expect(rename(tree, idOf(tree, 'src/file2.ts'), name).error).toContain(message)
  })

  it('allows changing only the case of its own name', () => {
    const tree = sample()
    expect(rename(tree, idOf(tree, 'src/main.tsx'), 'Main.tsx').error).toBeUndefined()
  })
})

describe('move', () => {
  it('moves into another folder', () => {
    const tree = sample()
    const moved = move(tree, idOf(tree, 'README.md'), idOf(tree, 'docs'))
    expect(moved.tree && path(moved.tree, idOf(tree, 'README.md'))).toBe('docs/README.md')
  })

  it('refuses to move a folder into itself or its children', () => {
    const tree = sample()
    expect(move(tree, idOf(tree, 'src'), idOf(tree, 'src/kit')).error).toContain('inside itself')
    expect(move(tree, idOf(tree, 'src'), idOf(tree, 'src')).error).toContain('inside itself')
  })

  it('refuses name clashes and non-folders', () => {
    const tree = create(sample(), idOf(sample(), 'docs'), 'file', 'main.tsx').tree
    expect(move(tree, idOf(tree, 'docs/main.tsx'), idOf(tree, 'src')).error).toContain('already exists')
    expect(move(tree, idOf(tree, 'docs'), idOf(tree, 'README.md')).error).toContain('only drop into a folder')
  })
})

describe('create and remove', () => {
  it('picks a free name', () => {
    let tree = sample()
    const src = idOf(tree, 'src')
    tree = create(tree, src, 'file', 'untitled.ts').tree
    const second = create(tree, src, 'file', 'untitled.ts')
    expect(second.tree[second.id].name).toBe('untitled 2.ts')
  })

  it('removes a whole subtree', () => {
    const tree = sample()
    const next = remove(tree, idOf(tree, 'src'))
    expect(Object.values(next).map((n) => n.name).sort()).toEqual(['', 'README.md', 'docs'])
  })
})

describe('keyboard', () => {
  const setup = () => {
    const tree = sample()
    const src = idOf(tree, 'src')
    const expanded = new Set([src])
    return { tree, src, expanded, rows: visible(tree, expanded) }
  }

  it('moves up and down, Home and End', () => {
    const { tree, src, expanded, rows } = setup()
    expect(navigate(tree, rows, expanded, src, 'ArrowDown')?.focus).toBe(idOf(tree, 'src/kit'))
    expect(navigate(tree, rows, expanded, src, 'ArrowUp')?.focus).toBe(idOf(tree, 'docs'))
    expect(navigate(tree, rows, expanded, src, 'End')?.focus).toBe(idOf(tree, 'README.md'))
  })

  it('Right expands, then enters; Left collapses, then goes to the parent', () => {
    const { tree, src, expanded, rows } = setup()
    const kit = idOf(tree, 'src/kit')
    expect(navigate(tree, rows, expanded, kit, 'ArrowRight')).toEqual({ focus: kit, expand: [kit] })
    expect(navigate(tree, rows, expanded, src, 'ArrowRight')?.focus).toBe(kit)
    expect(navigate(tree, rows, expanded, src, 'ArrowLeft')).toEqual({ focus: src, collapse: src })
    expect(navigate(tree, rows, expanded, idOf(tree, 'src/main.tsx'), 'ArrowLeft')?.focus).toBe(src)
  })

  it('* expands every sibling folder', () => {
    const { tree, src, expanded, rows } = setup()
    expect(navigate(tree, rows, expanded, src, '*')?.expand?.sort()).toEqual([idOf(tree, 'docs'), src].sort())
  })

  it('type-ahead cycles through matches', () => {
    const { tree, rows } = setup()
    const f2 = idOf(tree, 'src/file2.ts')
    expect(typeahead(rows, f2, 'f')).toBe(idOf(tree, 'src/file10.ts'))
    expect(typeahead(rows, f2, 'fi')).toBe(f2)
    expect(typeahead(rows, f2, 'zz')).toBeNull()
  })
})

describe('helpers', () => {
  it('pre-selects the stem when renaming files', () => {
    expect(stemRange('index.test.ts', 'file')).toEqual([0, 10])
    expect(stemRange('.gitignore', 'file')).toEqual([0, 10])
    expect(stemRange('my.folder', 'folder')).toEqual([0, 9])
  })

  it('picks icons by name and extension', () => {
    expect(iconFor('App.tsx', 'file').tone).toBe('cyan')
    expect(iconFor('git.test.ts', 'file').label).toBe('✓')
    expect(iconFor('package.json', 'file').label).toBe('npm')
    expect(iconFor('src', 'folder', true).label).toBe('📂')
  })
})
