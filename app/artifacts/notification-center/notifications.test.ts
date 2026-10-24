import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../../kit/random'
import { badge, bucket, dismiss, generate, group, markAllRead, markRead, relative, seed, swipeOutcome, unreadCount, type Notice } from './notifications'

// A fixed local "now": 24 Oct 2026, 15:00.
const NOW = new Date(2026, 9, 24, 15, 0).getTime()
const MIN = 60_000
const HOUR = 60 * MIN

const notice = (id: string, source: Notice['source'], ago: number, read = false): Notice => ({ id, source, title: id, body: '', at: NOW - ago, read })

describe('time', () => {
  it('buckets by age and calendar day', () => {
    expect(bucket(NOW - 2 * MIN, NOW)).toBe('New')
    expect(bucket(NOW - 3 * HOUR, NOW)).toBe('Today')
    expect(bucket(NOW - 16 * HOUR, NOW)).toBe('Yesterday')
    expect(bucket(NOW - 50 * HOUR, NOW)).toBe('Earlier')
  })

  it('formats relative times', () => {
    expect(relative(NOW - 20_000, NOW)).toBe('now')
    expect(relative(NOW - 5 * MIN, NOW)).toBe('5m')
    expect(relative(NOW - 3 * HOUR, NOW)).toBe('3h')
    expect(relative(NOW - 20 * HOUR, NOW)).toBe('Yesterday')
    expect(relative(NOW - 4 * 24 * HOUR, NOW)).toBe('4d')
    expect(relative(NOW + 5000, NOW)).toBe('now')
  })
})

describe('group', () => {
  const list = [notice('a', 'chat', 3 * HOUR), notice('b', 'builds', 1 * MIN), notice('c', 'chat', 2 * MIN), notice('d', 'deploys', 30 * HOUR)]

  it('groups by app, newest app first, newest notice first', () => {
    const groups = group(list, NOW, 'app')
    expect(groups.map((g) => g.key)).toEqual(['builds', 'chat', 'deploys'])
    expect(groups[1].items.map((n) => n.id)).toEqual(['c', 'a'])
    expect(groups[1].label).toBe('Team chat')
  })

  it('groups by time bucket', () => {
    expect(group(list, NOW, 'time').map((g) => `${g.key}:${g.items.map((n) => n.id).join('')}`)).toEqual(['New:bc', 'Today:a', 'Yesterday:d'])
  })
})

describe('state', () => {
  const list = [notice('a', 'chat', MIN), notice('b', 'chat', MIN, true), notice('c', 'builds', MIN)]

  it('counts and marks read', () => {
    expect(unreadCount(list)).toBe(2)
    expect(unreadCount(markRead(list, ['a']))).toBe(1)
    expect(unreadCount(markRead(list, ['b'], false))).toBe(3)
    expect(unreadCount(markAllRead(list))).toBe(0)
  })

  it('dismisses', () => {
    expect(dismiss(list, ['a', 'c']).map((n) => n.id)).toEqual(['b'])
  })

  it('caps the badge', () => {
    expect(badge(0)).toBe('')
    expect(badge(7)).toBe('7')
    expect(badge(99)).toBe('99')
    expect(badge(100)).toBe('99+')
  })
})

describe('swipeOutcome', () => {
  it('dismisses past the distance threshold', () => {
    expect(swipeOutcome(150, 0, 300)).toBe('right')
    expect(swipeOutcome(-150, 0, 300)).toBe('left')
    expect(swipeOutcome(60, 0, 300)).toBeNull()
  })

  it('dismisses on a fling in the same direction only', () => {
    expect(swipeOutcome(40, 1.2, 300)).toBe('right')
    expect(swipeOutcome(40, -1.2, 300)).toBeNull()
    expect(swipeOutcome(3, 2, 300)).toBeNull()
  })
})

describe('generate', () => {
  it('makes unread notices with unique ids', () => {
    const random = mulberry32(3)
    const a = generate(NOW, random)
    const b = generate(NOW, random, 'calendar')
    expect(a.read).toBe(false)
    expect(b.source).toBe('calendar')
    expect(a.id).not.toBe(b.id)
  })

  it('seeds a mixed inbox', () => {
    const inbox = seed(NOW, mulberry32(1))
    expect(inbox.length).toBeGreaterThan(5)
    expect(unreadCount(inbox)).toBe(5)
  })
})
