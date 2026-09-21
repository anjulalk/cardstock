/** Date parsing for the prose the banks actually publish, plus the month maths
 *  both the chunker and the calendar need. Everything is a plain ISO day
 *  (YYYY-MM-DD) in Asia/Colombo, so no timezone work is ever required. */

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
}

export const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
}

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`)

export function todayIso(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7)
}

export function daysInMonth(key: string): string[] {
  const [y, m] = key.split('-').map(Number) as [number, number]
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return Array.from({ length: count }, (_, i) => `${key}-${pad(i + 1)}`)
}

export function weekdayOf(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

export function addMonths(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number) as [number, number]
  const total = y * 12 + (m - 1) + delta
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`
}

/** Inclusive list of month keys, clamped to a window. */
export function monthRange(from: string, to: string, window?: { from: string; to: string }): string[] {
  const out: string[] = []
  const start = window && from < window.from ? window.from : from
  const end = window && window.to < to ? window.to : to
  let key = monthKey(start)
  const last = monthKey(end)
  while (key <= last) {
    out.push(key)
    key = addMonths(key, 1)
  }
  return out
}

interface Hit {
  index: number
  iso: string
}

/** Both the worded dates the banks use and the ISO ones HNB mixes in. */
function findDates(text: string, fallbackYear: number): Hit[] {
  const hits: Hit[] = []
  const iso = /(\d{4})-(\d{2})-(\d{2})/g
  let m: RegExpExecArray | null
  while ((m = iso.exec(text))) hits.push({ index: m.index, iso: `${m[1]}-${m[2]}-${m[3]}` })

  const worded = /(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s*(\d{4})?/gi
  while ((m = worded.exec(text))) {
    const day = Number(m[1])
    const month = MONTHS[m[2]!.slice(0, 3).toLowerCase()]
    if (!month || day < 1 || day > 31) continue
    const year = m[3] ? Number(m[3]) : fallbackYear
    hits.push({ index: m.index, iso: `${year}-${pad(month)}-${pad(day)}` })
  }

  // American order, as People's Bank writes it: "Till October 31, 2026". The
  // lookahead stops a bare year ("October 2026") from being read as a day.
  const monthFirst = /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?!\d),?\s*(\d{4})?/gi
  while ((m = monthFirst.exec(text))) {
    const month = MONTHS[m[1]!.slice(0, 3).toLowerCase()]
    const day = Number(m[2])
    if (!month || day < 1 || day > 31) continue
    const year = m[3] ? Number(m[3]) : fallbackYear
    hits.push({ index: m.index, iso: `${year}-${pad(month)}-${pad(day)}` })
  }

  return hits.sort((a, b) => a.index - b.index)
}

export interface Validity {
  from: string | null
  to: string | null
  /** Weekday rule, 0 is Sunday. */
  days: number[]
  /** Explicit dates, when the offer names them instead of a rule. */
  dates: string[]
}

/** Reads a list of days sharing one month: "Valid on 2nd, 16th and 30th
 *  September 2026", "11th & 25th August 2026". */
export function parseDateList(text: string | null, fallbackYear = new Date().getFullYear()): string[] {
  if (!text) return []
  const out: string[] = []
  const pattern =
    /((?:\d{1,2}(?:st|nd|rd|th)?\s*(?:,|and|&|\/)\s*)+)(\d{1,2})(?:st|nd|rd|th)?\s*(?:of\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s*(\d{4})?/gi
  for (const match of text.matchAll(pattern)) {
    const month = MONTHS[match[3]!.slice(0, 3).toLowerCase()]
    if (!month) continue
    const year = match[4] ? Number(match[4]) : fallbackYear
    const days = [...(match[1] ?? '').matchAll(/\d{1,2}/g)].map((hit) => Number(hit[0]))
    days.push(Number(match[2]))
    for (const day of days) {
      if (day >= 1 && day <= 31) out.push(`${year}-${pad(month)}-${pad(day)}`)
    }
  }
  return [...new Set(out)].sort()
}

/** The ISO days an offer qualifies for inside a segment: named dates win,
 *  then a weekday rule, and a bare range means every day. */
export function qualifyingDays(
  from: string,
  to: string,
  weekdays: number[],
  dates: string[],
): string[] {
  if (dates.length > 0) return dates.filter((iso) => iso >= from && iso <= to)
  return datesInRange(from, to, weekdays)
}

/** A day range that repeats every month, as ComBank writes it: "Offer valid
 *  from 20th to 30th of every month till December 2026". There is no way to
 *  express that as a weekday rule, so it is expanded into the explicit dates it
 *  means, from today up to the end the offer names. A range that runs backwards
 *  ("from 24th to 11th") wraps into the following month. */
export function parseMonthlyRange(text: string | null, from: string): Validity | null {
  if (!text) return null
  const match =
    /from\s+(\d{1,2})(?:st|nd|rd|th)?\s+to\s+(\d{1,2})(?:st|nd|rd|th)?\s+of\s+every\s+month\s+till\s+(.+)$/i.exec(
      text,
    )
  if (!match) return null

  const startDay = Number(match[1])
  const endDay = Number(match[2])
  if (startDay < 1 || startDay > 31 || endDay < 1 || endDay > 31) return null

  const tail = parsePeriodText(match[3]!, Number(from.slice(0, 4)))
  // "till December 2026" names a month without a day, which means the end of it.
  const bareMonth = /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{4})/i.exec(match[3]!)
  const last =
    tail.to ??
    tail.from ??
    (bareMonth
      ? (() => {
          const key = `${bareMonth[2]}-${pad(MONTHS[bareMonth[1]!.slice(0, 3).toLowerCase()]!)}`
          return `${key}-${pad(daysInMonth(key).length)}`
        })()
      : null)
  if (!last) return null

  const dates: string[] = []
  const lastKey = monthKey(last)
  let key = monthKey(from)
  let guard = 0

  while (key <= lastKey && guard++ < 24) {
    const days = daysInMonth(key)
    const push = (iso: string) => {
      if (iso >= from && iso <= last) dates.push(iso)
    }

    if (startDay <= endDay) {
      for (let day = startDay; day <= endDay && day <= days.length; day++) {
        push(`${key}-${pad(day)}`)
      }
    } else {
      for (let day = startDay; day <= days.length; day++) push(`${key}-${pad(day)}`)
      const next = addMonths(key, 1)
      for (let day = 1; day <= endDay; day++) push(`${next}-${pad(day)}`)
    }

    key = addMonths(key, 1)
  }

  if (dates.length === 0) return null
  const sorted = [...new Set(dates)].sort()
  return { from: sorted[0]!, to: sorted[sorted.length - 1]!, days: [], dates: sorted }
}

/** Reads "Valid until 31 Aug 2026", "Valid only on 27th August 2026",
 *  "Every Wednesday till 26th August 2026", "1 Sept 2026 - 30 Sept 2026". */
export function parsePeriodText(text: string | null, fallbackYear = new Date().getFullYear()): Validity {
  if (!text) return { from: null, to: null, days: [], dates: [] }
  // Times of day carry digits that look like days: DFCC writes "Valid from 31
  // August 2026 at 18:30 until 31 October 2026 at 17:30", and the 30 of 18:30
  // would otherwise pair with the following date.
  const cleaned = text.replace(/\bat\s+\d{1,2}:\d{2}\b/gi, ' ').replace(/\b\d{1,2}:\d{2}\b/g, ' ')

  const days: number[] = []
  for (const m of cleaned.matchAll(/every\s+([a-z]+)/gi)) {
    const day = WEEKDAYS[m[1]!.toLowerCase()]
    if (day !== undefined && !days.includes(day)) days.push(day)
  }
  // A span, as in "every Monday to Thursday".
  for (const m of cleaned.matchAll(/every\s+([a-z]+)\s*(?:to|through|till|until|-|–)\s*([a-z]+)/gi)) {
    const start = WEEKDAYS[m[1]!.toLowerCase()]
    const end = WEEKDAYS[m[2]!.toLowerCase()]
    if (start === undefined || end === undefined) continue
    const span = (end - start + 7) % 7
    for (let i = 0; i <= span; i++) {
      const day = (start + i) % 7
      if (!days.includes(day)) days.push(day)
    }
  }
  days.sort((a, b) => a - b)

  const dates = parseDateList(cleaned, fallbackYear)
  if (dates.length > 1) {
    return { from: dates[0]!, to: dates[dates.length - 1]!, days, dates }
  }

  // A range inside one month, as in "1st to 15th August 2026". The lookbehind
  // stops a year like 2026, or a time like 18:30, from being read as the day.
  const sameMonth =
    /(?<![\d:])(\d{1,2})(?:st|nd|rd|th)?\s*(?:to|till|until|-|–|—)\s*(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s*(\d{4})?/i.exec(
      cleaned,
    )
  if (sameMonth) {
    const month = MONTHS[sameMonth[3]!.slice(0, 3).toLowerCase()]
    if (month) {
      const year = sameMonth[4] ? Number(sameMonth[4]) : fallbackYear
      const from = `${year}-${pad(month)}-${pad(Number(sameMonth[1]))}`
      const to = `${year}-${pad(month)}-${pad(Number(sameMonth[2]))}`
      return { from, to, days, dates: [] }
    }
  }

  const hits = findDates(cleaned, fallbackYear)
  if (hits.length === 0) return { from: null, to: null, days, dates: [] }
  if (hits.length === 1) {
    const only = /only\s+on|\bon\s+\d|valid\s+on/i.test(cleaned)
    if (only) return { from: hits[0]!.iso, to: hits[0]!.iso, days, dates: [] }
    if (/\bfrom\b/i.test(cleaned)) return { from: hits[0]!.iso, to: null, days, dates: [] }
    return { from: null, to: hits[0]!.iso, days, dates: [] }
  }
  return { from: hits[0]!.iso, to: hits[hits.length - 1]!.iso, days, dates: [] }
}

/** HNB's feed carries an ISO `to` plus a label such as "Valid Until" or
 *  "Valid From 2026-04-01 to ". The label wins only when it says more. */
export function parseValidityLabel(
  label: string | null,
  to: string | null,
): { from: string | null; to: string | null } {
  if (!label) return { from: null, to }
  const iso = label.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null
  const labelTo = /to\s+(\d{4}-\d{2}-\d{2})/.exec(label)?.[1] ?? null
  const from = /\bfrom\b/i.test(label) ? iso : null
  return { from, to: labelTo ?? to }
}

/** Every ISO day in [from, to] that matches the weekday rule, capped so a
 *  long window cannot explode. */
export function datesInRange(from: string, to: string, days: number[], limit = 400): string[] {
  const out: string[] = []
  if (to < from) return out
  let cursor = from
  while (cursor <= to && out.length < limit) {
    if (days.length === 0 || days.includes(weekdayOf(cursor))) out.push(cursor)
    const [y, m, d] = cursor.split('-').map(Number) as [number, number, number]
    const next = new Date(Date.UTC(y, m - 1, d + 1))
    cursor = `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`
  }
  return out
}
