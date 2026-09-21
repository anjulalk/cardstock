import test from 'node:test'
import assert from 'node:assert/strict'
import {
  addMonths,
  datesInRange,
  monthRange,
  parseDateList,
  parseMonthlyRange,
  parsePeriodText,
  parseValidityLabel,
  qualifyingDays,
  weekdayOf,
} from './dates.ts'

// The prose below is copied from the banks' own pages.
const YEAR = 2026

test('dates: till a worded day', () => {
  assert.deepEqual(parsePeriodText('Till 30th September 2026', YEAR), {
    from: null,
    to: '2026-09-30',
    days: [],
    dates: [],
  })
})

test('dates: from and till, second date carrying the year', () => {
  assert.deepEqual(parsePeriodText('Valid from 1st September till 31st October 2026', YEAR), {
    from: '2026-09-01',
    to: '2026-10-31',
    days: [],
    dates: [],
  })
})

test('dates: a weekly recurrence resolves the weekday', () => {
  assert.deepEqual(parsePeriodText('Every Wednesday till 26th August 2026', YEAR), {
    from: null,
    to: '2026-08-26',
    days: [3],
    dates: [],
  })
})

test('dates: a single day offer', () => {
  assert.deepEqual(parsePeriodText('Valid only on 27th August 2026', YEAR), {
    from: '2026-08-27',
    to: '2026-08-27',
    days: [],
    dates: [],
  })
})

test('dates: a bare date after on', () => {
  assert.deepEqual(parsePeriodText('on 16 Sept 2026', YEAR), {
    from: '2026-09-16',
    to: '2026-09-16',
    days: [],
    dates: [],
  })
})

test('dates: two dates around a dash', () => {
  assert.deepEqual(parsePeriodText('1 Sept 2026 – 30 Sept 2026', YEAR), {
    from: '2026-09-01',
    to: '2026-09-30',
    days: [],
    dates: [],
  })
})

test('dates: a range inside one month', () => {
  assert.deepEqual(parsePeriodText('Valid from 1st to 15th August 2026', YEAR), {
    from: '2026-08-01',
    to: '2026-08-15',
    days: [],
    dates: [],
  })
})

test('dates: named days sharing a month become explicit dates', () => {
  assert.deepEqual(parseDateList('Valid on 2nd, 16th and 30th September 2026', YEAR), [
    '2026-09-02',
    '2026-09-16',
    '2026-09-30',
  ])
  assert.deepEqual(parseDateList('Valid on 11th & 25th August 2026', YEAR), [
    '2026-08-11',
    '2026-08-25',
  ])
  assert.deepEqual(parsePeriodText('Valid on 2nd, 16th and 30th September 2026', YEAR), {
    from: '2026-09-02',
    to: '2026-09-30',
    days: [],
    dates: ['2026-09-02', '2026-09-16', '2026-09-30'],
  })
})

test('dates: a single named day stays a one day offer, not a list', () => {
  assert.deepEqual(parseDateList('Valid only on 27th August 2026', YEAR), [])
})

test('dates: hnbs label adds a from date and keeps its own to', () => {
  assert.deepEqual(parseValidityLabel('Valid From 2026-04-01 to ', '2026-12-31'), {
    from: '2026-04-01',
    to: '2026-12-31',
  })
  assert.deepEqual(parseValidityLabel('Valid Until', '2026-10-31'), {
    from: null,
    to: '2026-10-31',
  })
})

test('dates: month arithmetic crosses a year', () => {
  assert.equal(addMonths('2026-12', 1), '2027-01')
  assert.equal(addMonths('2026-01', -1), '2025-12')
})

test('dates: a month range is clamped to the published window', () => {
  assert.deepEqual(monthRange('2026-01-15', '2026-04-02', { from: '2026-02', to: '2026-03' }), [
    '2026-02',
    '2026-03',
  ])
})

test('dates: weekly dates land on the right weekdays', () => {
  const wednesdays = datesInRange('2026-08-01', '2026-08-31', [3])
  assert.deepEqual(wednesdays, ['2026-08-05', '2026-08-12', '2026-08-19', '2026-08-26'])
  for (const day of wednesdays) assert.equal(weekdayOf(day), 3)
})

test('dates: times of day are not read as days', () => {
  assert.deepEqual(
    parsePeriodText('Valid from 31 August 2026 at 18:30 until 31 October 2026 at 17:30', YEAR),
    { from: '2026-08-31', to: '2026-10-31', days: [], dates: [] },
  )
})

test('dates: a monthly day range expands into the dates it means', () => {
  const result = parseMonthlyRange(
    'Offer valid from 20th to 30th of every month till December 2026',
    '2026-09-20',
  )
  assert.ok(result)
  assert.equal(result.from, '2026-09-20')
  assert.equal(result.to, '2026-12-30')
  assert.deepEqual(result.dates.slice(0, 3), ['2026-09-20', '2026-09-21', '2026-09-22'])
  assert.ok(result.dates.includes('2026-10-20'))
  assert.ok(result.dates.includes('2026-12-30'))
  assert.ok(!result.dates.includes('2026-12-31'))
})

test('dates: a monthly range that runs backwards wraps into the next month', () => {
  const result = parseMonthlyRange(
    'Offer valid from 24th to 11th of every month till 31st December 2026',
    '2026-09-24',
  )
  assert.ok(result)
  assert.equal(result.from, '2026-09-24')
  assert.ok(result.dates.includes('2026-09-30'))
  assert.ok(result.dates.includes('2026-10-01'))
  assert.ok(result.dates.includes('2026-10-11'))
  assert.ok(result.dates.includes('2026-10-24'))
  assert.ok(!result.dates.includes('2026-10-12'))
})

test('dates: text that is not a monthly range is left alone', () => {
  assert.equal(parseMonthlyRange('Offer valid till 30th September 2026', '2026-09-20'), null)
})

test('dates: the American order reads the same day as ours', () => {
  assert.deepEqual(parsePeriodText('Till October 31, 2026', YEAR), {
    from: null,
    to: '2026-10-31',
    days: [],
    dates: [],
  })
  assert.deepEqual(parsePeriodText('Till 31 October 2026', YEAR), {
    from: null,
    to: '2026-10-31',
    days: [],
    dates: [],
  })
  // A bare month and year is not a day.
  assert.deepEqual(parsePeriodText('Valid during October 2026', YEAR), {
    from: null,
    to: null,
    days: [],
    dates: [],
  })
})

test('dates: a weekday span and a same-month range together', () => {
  const span = parsePeriodText('Valid every Monday to Thursday till 30 September 2026', YEAR)
  assert.deepEqual(span.days, [1, 2, 3, 4])
  assert.equal(span.to, '2026-09-30')

  const saturday = parsePeriodText('Valid every Saturday from 1 to 30 September 2026', YEAR)
  assert.deepEqual(saturday.days, [6])
  assert.equal(saturday.from, '2026-09-01')
  assert.equal(saturday.to, '2026-09-30')
})

test('dates: qualifying days prefer named dates, then a rule, then the range', () => {
  const named = ['2026-09-02', '2026-09-16', '2026-09-30']
  assert.deepEqual(qualifyingDays('2026-09-01', '2026-09-30', [], named), named)
  assert.deepEqual(qualifyingDays('2026-09-15', '2026-09-30', [], named), [
    '2026-09-16',
    '2026-09-30',
  ])
  assert.deepEqual(qualifyingDays('2026-08-01', '2026-08-31', [3], []), [
    '2026-08-05',
    '2026-08-12',
    '2026-08-19',
    '2026-08-26',
  ])
  assert.deepEqual(qualifyingDays('2026-08-30', '2026-09-01', [], []), [
    '2026-08-30',
    '2026-08-31',
    '2026-09-01',
  ])
})
