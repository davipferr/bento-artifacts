import { describe, expect, it } from 'vitest'
import { ago, direction, EMPTY, fromDraft, isValid, progress, reachable, slugify, strength, toDraft, validate, type Values } from './wizard'

const account: Values = { ...EMPTY, name: 'Davi', email: 'davi@example.com', password: 'Tr1cky-pass' }
const workspace: Values = { ...account, workspace: 'Bento Labs', slug: 'bento-labs', size: '2–10' }

describe('helpers', () => {
  it('slugifies names', () => {
    expect(slugify('My Cool Team!')).toBe('my-cool-team')
    expect(slugify('  Ação & Café ')).toBe('acao-cafe')
    expect(slugify('---')).toBe('')
  })

  it('rates passwords', () => {
    expect(strength('').score).toBe(0)
    expect(strength('abc').label).toBe('Weak')
    expect(strength('password123').score).toBe(1)
    expect(strength('Tr1cky-pass').score).toBe(3)
    expect(strength('Tr1cky-passphrase').label).toBe('Strong')
  })

  it('knows directions and progress', () => {
    expect(direction(1, 2)).toBe(1)
    expect(direction(2, 0)).toBe(-1)
    expect(progress(0)).toBeCloseTo(0.125)
    expect(progress(3)).toBeCloseTo(0.875)
  })

  it('formats ages', () => {
    expect(ago(2000)).toBe('just now')
    expect(ago(90_000)).toBe('2 min ago')
    expect(ago(3 * 3600_000)).toBe('3 h ago')
  })
})

describe('validation', () => {
  it('checks the account step', () => {
    expect(Object.keys(validate(0, EMPTY)).sort()).toEqual(['email', 'name', 'password'])
    expect(validate(0, { ...account, email: 'davi@' }).email).toBeDefined()
    expect(validate(0, { ...account, password: 'aaaaaaaa' }).password).toContain('guess')
    expect(isValid(0, account)).toBe(true)
  })

  it('checks the workspace step, including reserved slugs', () => {
    expect(isValid(1, workspace)).toBe(true)
    expect(validate(1, { ...workspace, slug: 'Bad Slug' }).slug).toContain('Lowercase')
    expect(validate(1, { ...workspace, slug: 'admin' }).slug).toContain('reserved')
    expect(validate(1, { ...workspace, size: '' }).size).toBeDefined()
  })

  it('needs the terms accepted on review', () => {
    expect(isValid(3, workspace)).toBe(false)
    expect(isValid(3, { ...workspace, agree: true })).toBe(true)
  })

  it('only lets you jump as far as the data is valid', () => {
    expect(reachable(EMPTY)).toBe(0)
    expect(reachable(account)).toBe(1)
    expect(reachable(workspace)).toBe(3)
  })
})

describe('drafts', () => {
  it('round-trips without the password', () => {
    const text = toDraft(workspace, 2, 1000)
    expect(text).not.toContain('Tr1cky')
    const back = fromDraft(text)!
    expect(back.values.workspace).toBe('Bento Labs')
    expect(back.values.password).toBe('')
    expect(back.savedAt).toBe(1000)
  })

  it('resumes no further than the data allows', () => {
    // Without the password, the account step is invalid again, so we resume there.
    expect(fromDraft(toDraft(workspace, 2, 0))!.step).toBe(0)
  })

  it('ignores missing, broken or old drafts', () => {
    expect(fromDraft(null)).toBeNull()
    expect(fromDraft('{oops')).toBeNull()
    expect(fromDraft(JSON.stringify({ version: 0, step: 1, values: {} }))).toBeNull()
  })
})
