import { describe, expect, it } from 'vitest'
import {
  chordName,
  diatonic,
  FIFTHS,
  MAJOR_LABELS,
  MINOR_LABELS,
  progressions,
  shortestTurn,
  tonicOf,
  usesFlats,
  voicing,
  wheelSlot,
} from './theory'

const names = (slot: number, mode: 'major' | 'minor') => diatonic(slot, mode).map((c) => chordName(c, usesFlats(slot)))

describe('circle of fifths', () => {
  it('steps by 7 semitones and visits every pitch class once', () => {
    for (let i = 1; i < 12; i++) expect(FIFTHS[i]).toBe((FIFTHS[i - 1] + 7) % 12)
    expect(new Set(FIFTHS).size).toBe(12)
  })

  it('pairs each major key with its relative minor, 3 semitones down', () => {
    expect(tonicOf(0, 'minor')).toBe(9) // C → A minor
    expect(MAJOR_LABELS[3]).toBe('A')
    expect(MINOR_LABELS[3]).toBe('F♯m')
  })
})

describe('diatonic chords', () => {
  it('C major', () => {
    expect(names(0, 'major')).toEqual(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'B°'])
  })

  it('E♭ major is spelled with flats', () => {
    expect(names(9, 'major')).toEqual(['E♭', 'Fm', 'Gm', 'A♭', 'B♭', 'Cm', 'D°'])
  })

  it('A minor (relative of C) has the same chords, starting on Am', () => {
    expect(names(0, 'minor')).toEqual(['Am', 'B°', 'C', 'Dm', 'Em', 'F', 'G'])
  })

  it('every major and minor chord of a key sits within one slot of it on the wheel', () => {
    for (let slot = 0; slot < 12; slot++) {
      for (const chord of diatonic(slot, 'major')) {
        const place = wheelSlot(chord)
        if (!place) continue
        expect(Math.abs(shortestTurn(slot, place.slot))).toBeLessThanOrEqual(1)
      }
    }
  })

  it('the diminished chord has no slot', () => {
    expect(wheelSlot({ root: 11, quality: 'dim' })).toBeNull()
  })
})

describe('voicing', () => {
  it('puts the bass in octave 2 and the triad between G3 and F♯4', () => {
    const [bass, ...upper] = voicing({ root: 7, quality: 'maj' }) // G major
    expect(bass).toBe(43)
    expect(upper).toEqual([55, 59, 62]) // G3 B3 D4
    for (const root of FIFTHS) {
      for (const note of voicing({ root, quality: 'min' }).slice(1)) {
        expect(note).toBeGreaterThanOrEqual(55)
        expect(note).toBeLessThan(67)
      }
    }
  })
})

describe('shortestTurn', () => {
  it('wraps around the wheel', () => {
    expect(shortestTurn(0, 1)).toBe(1)
    expect(shortestTurn(11, 0)).toBe(1)
    expect(shortestTurn(0, 11)).toBe(-1)
    expect(shortestTurn(2, 8)).toBe(6)
  })
})

it('progressions only use degrees 0–6', () => {
  for (const list of Object.values(progressions)) {
    for (const p of list) for (const d of p.degrees) expect(d >= 0 && d < 7).toBe(true)
  }
})
