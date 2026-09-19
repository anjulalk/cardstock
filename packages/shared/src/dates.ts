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
  return hits.sort((a, b) => a.index - b.index)
}

export interface Validity {
  from: string | null
  to: string | null
  days: number[]
}

/** Reads "Valid until 31 Aug 2026", "Valid only on 27th August 2026",
 *  "Every Wednesday till 26th August 2026", "1 Sept 2026 - 30 Sept 2026". */
export function parsePeriodText(text: string | null, fallbackYear = new Date().getFullYear()): Validity {
  if (!text) return { from: null, to: null, days: [] }
  const days: number[] = []
  for (const m of text.matchAll(/every\s+([a-z]+)/gi)) {
    const day = WEEKDAYS[m[1]!.toLowerCase()]
    if (day !== undefined && !days.includes(day)) days.push(day)
  }

  const hits = findDates(text, fallbackYear)
  if (hits.length === 0) return { from: null, to: null, days }
  if (hits.length === 1) {
    const only = /only\s+on|\bon\s+\d|valid\s+on/i.test(text)
    if (only) return { from: hits[0]!.iso, to: hits[0]!.iso, days }
    if (/\bfrom\b/i.test(text)) return { from: hits[0]!.iso, to: null, days }
    return { from: null, to: hits[0]!.iso, days }
  }
  return { from: hits[0]!.iso, to: hits[hits.length - 1]!.iso, days }
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
