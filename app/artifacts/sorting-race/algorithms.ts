/**
 * Each sort is a generator: it sorts the array in place and yields one Op for every
 * comparison, swap or write. The race calls `next()` the same number of times per frame
 * on every lane, so an algorithm that needs fewer operations finishes first.
 */
export type Op =
  | { kind: 'compare'; i: number; j: number }
  | { kind: 'swap'; i: number; j: number }
  | { kind: 'write'; i: number }

export type Sorter = (a: number[]) => Generator<Op, void, void>

function swap(a: number[], i: number, j: number) {
  const t = a[i]
  a[i] = a[j]
  a[j] = t
}

function* bubble(a: number[]): Generator<Op, void, void> {
  for (let end = a.length - 1; end > 0; end--) {
    let swapped = false
    for (let i = 0; i < end; i++) {
      yield { kind: 'compare', i, j: i + 1 }
      if (a[i] > a[i + 1]) {
        swap(a, i, i + 1)
        swapped = true
        yield { kind: 'swap', i, j: i + 1 }
      }
    }
    // A pass without swaps means it's sorted: this is why bubble wins on sorted input.
    if (!swapped) return
  }
}

function* insertion(a: number[]): Generator<Op, void, void> {
  for (let i = 1; i < a.length; i++) {
    for (let j = i; j > 0; j--) {
      yield { kind: 'compare', i: j - 1, j }
      if (a[j - 1] <= a[j]) break
      swap(a, j - 1, j)
      yield { kind: 'swap', i: j - 1, j }
    }
  }
}

function* selection(a: number[]): Generator<Op, void, void> {
  for (let i = 0; i < a.length - 1; i++) {
    let min = i
    for (let j = i + 1; j < a.length; j++) {
      yield { kind: 'compare', i: min, j }
      if (a[j] < a[min]) min = j
    }
    if (min !== i) {
      swap(a, i, min)
      yield { kind: 'swap', i, j: min }
    }
  }
}

function* mergeRange(a: number[], lo: number, hi: number): Generator<Op, void, void> {
  if (hi - lo < 2) return
  const mid = (lo + hi) >> 1
  yield* mergeRange(a, lo, mid)
  yield* mergeRange(a, mid, hi)
  const left = a.slice(lo, mid)
  const right = a.slice(mid, hi)
  let i = 0
  let j = 0
  let k = lo
  while (i < left.length && j < right.length) {
    yield { kind: 'compare', i: k, j: mid + j }
    a[k] = left[i] <= right[j] ? left[i++] : right[j++]
    yield { kind: 'write', i: k++ }
  }
  while (i < left.length) {
    a[k] = left[i++]
    yield { kind: 'write', i: k++ }
  }
  while (j < right.length) {
    a[k] = right[j++]
    yield { kind: 'write', i: k++ }
  }
}

/** Lomuto partition with the middle element as pivot, so sorted input isn't the worst case. */
function* quickRange(a: number[], lo: number, hi: number): Generator<Op, void, void> {
  if (lo >= hi) return
  const mid = (lo + hi) >> 1
  if (mid !== hi) {
    swap(a, mid, hi)
    yield { kind: 'swap', i: mid, j: hi }
  }
  let store = lo
  for (let i = lo; i < hi; i++) {
    yield { kind: 'compare', i, j: hi }
    if (a[i] < a[hi]) {
      if (i !== store) {
        swap(a, i, store)
        yield { kind: 'swap', i, j: store }
      }
      store++
    }
  }
  if (store !== hi) {
    swap(a, store, hi)
    yield { kind: 'swap', i: store, j: hi }
  }
  yield* quickRange(a, lo, store - 1)
  yield* quickRange(a, store + 1, hi)
}

function* heap(a: number[]): Generator<Op, void, void> {
  function* siftDown(root: number, end: number): Generator<Op, void, void> {
    for (;;) {
      let child = 2 * root + 1
      if (child >= end) return
      if (child + 1 < end) {
        yield { kind: 'compare', i: child, j: child + 1 }
        if (a[child] < a[child + 1]) child++
      }
      yield { kind: 'compare', i: root, j: child }
      if (a[root] >= a[child]) return
      swap(a, root, child)
      yield { kind: 'swap', i: root, j: child }
      root = child
    }
  }
  for (let start = (a.length >> 1) - 1; start >= 0; start--) yield* siftDown(start, a.length)
  for (let end = a.length - 1; end > 0; end--) {
    swap(a, 0, end)
    yield { kind: 'swap', i: 0, j: end }
    yield* siftDown(0, end)
  }
}

export interface Algorithm {
  id: string
  name: string
  /** Average-case complexity, for the lane header. */
  complexity: string
  sort: Sorter
}

export const algorithms: Algorithm[] = [
  { id: 'bubble', name: 'Bubble sort', complexity: 'O(n²)', sort: bubble },
  { id: 'insertion', name: 'Insertion sort', complexity: 'O(n²)', sort: insertion },
  { id: 'selection', name: 'Selection sort', complexity: 'O(n²)', sort: selection },
  { id: 'merge', name: 'Merge sort', complexity: 'O(n log n)', sort: (a) => mergeRange(a, 0, a.length) },
  { id: 'quick', name: 'Quicksort', complexity: 'O(n log n)', sort: (a) => quickRange(a, 0, a.length - 1) },
  { id: 'heap', name: 'Heap sort', complexity: 'O(n log n)', sort: heap },
]

export type Preset = 'random' | 'nearly' | 'reversed' | 'few'

export const presets: { value: Preset; label: string }[] = [
  { value: 'random', label: 'Random' },
  { value: 'nearly', label: 'Nearly sorted' },
  { value: 'reversed', label: 'Reversed' },
  { value: 'few', label: 'Few unique' },
]

function shuffle(a: number[], random: () => number) {
  for (let i = a.length - 1; i > 0; i--) swap(a, i, Math.floor(random() * (i + 1)))
}

/** Values 1..n arranged by the preset. */
export function makeArray(n: number, preset: Preset, random: () => number = Math.random): number[] {
  const a = Array.from({ length: n }, (_, i) => i + 1)
  switch (preset) {
    case 'random':
      shuffle(a, random)
      break
    case 'nearly':
      // A handful of short-distance swaps: almost in order.
      for (let k = 0; k < Math.max(1, Math.round(n / 20)); k++) {
        const i = Math.floor(random() * n)
        swap(a, i, Math.min(n - 1, i + 1 + Math.floor(random() * 3)))
      }
      break
    case 'reversed':
      a.reverse()
      break
    case 'few':
      for (let i = 0; i < n; i++) a[i] = Math.ceil(((Math.floor(random() * 4) + 1) * n) / 4)
      break
  }
  return a
}
