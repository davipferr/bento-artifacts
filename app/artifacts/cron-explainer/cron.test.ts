import { describe as group, expect, it } from 'vitest'
import { CronError, describe, nextRuns, parse, parseField } from './cron'

group('parseField', () => {
  it.each([
    ['*', 0, 60],
    ['*/15', 0, 4],
    ['5/15', 0, 4],
    ['1-5', 4, 5],
    ['MON-FRI', 4, 5],
    ['0,30', 0, 2],
    ['9-17/2', 1, 5],
  ])('%s in field %i has %i values', (text, field, count) => {
    expect(parseField(text, field)).toHaveLength(count)
  })

  it('treats 7 as Sunday and dedupes it with 0', () => {
    expect(parseField('0,7', 4)).toEqual([0])
    expect(parseField('5-7', 4)).toEqual([0, 5, 6])
  })

  it('reads month names case-insensitively', () => {
    expect(parseField('jan,Jun,DEC', 3)).toEqual([1, 6, 12])
  })

  it.each([
    ['60', 0, 'minute must be 0–59, got 60'],
    ['5-1', 1, 'goes backwards'],
    ['*/0', 0, 'Step must be at least 1'],
    ['FOO', 3, 'is not a valid month'],
    ['1,,2', 0, 'is not valid'],
  ])('rejects %s', (text, field, message) => {
    expect(() => parseField(text, field)).toThrow(message)
  })
})

group('parse', () => {
  it('expands macros', () => {
    expect(parse('@daily').fields).toEqual(['0', '0', '*', '*', '*'])
    expect(parse('@HOURLY').minute).toEqual([0])
  })

  it('needs exactly five fields', () => {
    expect(() => parse('* * * *')).toThrow(CronError)
    expect(() => parse('@sometimes')).toThrow('Unknown macro')
  })

  it('reports which field failed', () => {
    try {
      parse('0 25 * * *')
      expect.unreachable()
    } catch (error) {
      expect((error as CronError).field).toBe(1)
    }
  })
})

group('describe', () => {
  it.each([
    ['* * * * *', 'Every minute'],
    ['*/5 * * * *', 'Every 5 minutes'],
    ['0 * * * *', 'Every hour, on the hour'],
    ['30 9 * * 1-5', 'At 09:30, Monday through Friday'],
    ['0 9,17 * * *', 'At 09:00 and 17:00'],
    ['0 0 1 * *', 'At 00:00, on the 1st of the month'],
    ['*/15 9-17 * * MON-FRI', 'Every 15 minutes, between 09:00 and 17:59, Monday through Friday'],
    ['0 12 * JAN,JUL *', 'At 12:00, in January and July'],
    ['0 0 13 * 5', 'At 00:00, on the 13th of the month, or on Friday'],
    ['15 */2 * * *', 'At 15 minutes past the hour, every 2 hours'],
    ['0 0 1 */3 *', 'At 00:00, on the 1st of the month, every 3 months (January, April, July and October)'],
  ])('%s → %s', (expression, text) => {
    expect(describe(parse(expression))).toBe(text)
  })
})

group('nextRuns', () => {
  // Wall-clock times live in UTC slots: 2026-10-20 (a Tuesday) 10:07.
  const from = new Date(Date.UTC(2026, 9, 20, 10, 7))
  const iso = (dates: Date[]) => dates.map((d) => d.toISOString().slice(0, 16))

  it('finds the next quarter hours', () => {
    expect(iso(nextRuns(parse('*/15 * * * *'), from, 3))).toEqual(['2026-10-20T10:15', '2026-10-20T10:30', '2026-10-20T10:45'])
  })

  it('skips the weekend for weekday jobs', () => {
    expect(iso(nextRuns(parse('0 9 * * 1-5'), new Date(Date.UTC(2026, 9, 23, 12)), 2))).toEqual([
      '2026-10-26T09:00', // Friday noon → Monday
      '2026-10-27T09:00',
    ])
  })

  it('uses OR when both day fields are set', () => {
    // The 1st of the month OR any Monday.
    const runs = iso(nextRuns(parse('0 0 1 * 1'), from, 3))
    expect(runs).toEqual(['2026-10-26T00:00', '2026-11-01T00:00', '2026-11-02T00:00'])
  })

  it('handles leap days and gives up on impossible dates', () => {
    expect(iso(nextRuns(parse('0 0 29 2 *'), from, 1))).toEqual(['2028-02-29T00:00'])
    expect(nextRuns(parse('0 0 31 2 *'), from, 1)).toEqual([])
  })
})
