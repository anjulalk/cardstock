import test from 'node:test'
import assert from 'node:assert/strict'
import {
  addMonths,
  datesInRange,
  monthRange,
  parsePeriodText,
  parseValidityLabel,
  weekdayOf,
} from './dates.ts'

// The prose below is copied from the banks' own pages.
const YEAR = 2026

test('dates: till a worded day', () => {
  assert.deepEqual(parsePeriodText('Till 30th September 2026', YEAR), {
    from: null,
    to: '2026-09-30',
    days: [],
  })
})

test('dates: from and till, second date carrying the year', () => {
  assert.deepEqual(parsePeriodText('Valid from 1st September till 31st October 2026', YEAR), {
    from: '2026-09-01',
    to: '2026-10-31',
    days: [],
  })
})

test('dates: a weekly recurrence resolves the weekday', () => {
  assert.deepEqual(parsePeriodText('Every Wednesday till 26th August 2026', YEAR), {
    from: null,
    to: '2026-08-26',
    days: [3],
  })
})

test('dates: a single day offer', () => {
  assert.deepEqual(parsePeriodText('Valid only on 27th August 2026', YEAR), {
    from: '2026-08-27',
    to: '2026-08-27',
    days: [],
  })
})

test('dates: a bare date after on', () => {
  assert.deepEqual(parsePeriodText('on 16 Sept 2026', YEAR), {
    from: '2026-09-16',
    to: '2026-09-16',
    days: [],
  })
})

test('dates: two dates around a dash', () => {
  assert.deepEqual(parsePeriodText('1 Sept 2026 – 30 Sept 2026', YEAR), {
    from: '2026-09-01',
    to: '2026-09-30',
    days: [],
  })
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
