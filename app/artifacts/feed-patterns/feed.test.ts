import { describe, expect, it } from 'vitest'
import { item, items, loadedAfter, pageCount, pageList, pageOf, pageRange, shouldLoad } from './feed'

describe('items', () => {
  it('are deterministic by id', () => {
    expect(item(73)).toEqual(item(73))
    expect(item(73).id).toBe(73)
    expect(new Set(items(0, 12).map((i) => i.title)).size).toBeGreaterThan(6)
  })

  it('slices ranges 1-based', () => {
    expect(items(70, 75).map((i) => i.id)).toEqual([71, 72, 73, 74, 75])
    expect(items(5, 5)).toEqual([])
  })
})

describe('pages', () => {
  it('maps items to pages and back', () => {
    expect(pageCount()).toBe(20)
    expect(pageOf(73)).toBe(8)
    expect(pageOf(70)).toBe(7)
    expect(pageRange(8)).toEqual([71, 80])
    expect(pageRange(3, 10, 25)).toEqual([21, 25])
  })

  it('lists page buttons with gaps', () => {
    expect(pageList(1, 20)).toEqual([1, 2, '…', 20])
    expect(pageList(8, 20)).toEqual([1, '…', 7, 8, 9, '…', 20])
    expect(pageList(20, 20)).toEqual([1, '…', 19, 20])
    expect(pageList(3, 20)).toEqual([1, 2, 3, 4, '…', 20])
    expect(pageList(2, 3)).toEqual([1, 2, 3])
  })
})

describe('infinite scroll', () => {
  it('loads when close to the bottom', () => {
    expect(shouldLoad(0, 400, 2000)).toBe(false)
    expect(shouldLoad(1400, 400, 2000)).toBe(true)
  })

  it('caps loaded items at the total', () => {
    expect(loadedAfter(0)).toBe(10)
    expect(loadedAfter(6)).toBe(70)
    expect(loadedAfter(99)).toBe(200)
  })
})
