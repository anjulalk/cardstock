import { type SourceContract } from '../contract.ts'
import { fetchText } from '../lib/http.ts'
import { firstMatch, splitItems } from '../lib/html.ts'
import type { Draft } from '../normalize.ts'
import { stripHtml } from '../normalize.ts'

/** Union lists 24 offers on one page, each a WordPress card:
 *
 *  <div class="single-offer">
 *    <div class="merchant-logo-wrap"><a href="https://www.unionb.com/offer/ub-12/">
 *      <img src=".../uploads/...jpg" class="img-responsive"></a></div>
 *    <div class="offer-content"><a class="offer-btn-wrap" href=".../offer/ub-12/">
 *      <h3>UB 12</h3>
 *      <span class="offer-val">Anything anywhere EMI Plans</span>
 *      <p>18th to 20th September 2026</p>
 *      <span class="terms">Terms & Conditions</span></a></div>
 *    <div class="offer-footer">
 *      <a href="https://www.google.com/calendar/render?...&dates=20260917/20260922"
 *         class="add-to-calendar">Add to Calendar</a>
 *
 *  The prose date is the one the bank shows a customer, so it wins. The calendar
 *  link is a convenience export and is padded: for an offer the page reads as
 *  "18th to 20th September", its link runs 17th to 22nd. It is only used when
 *  the prose has no date at all.
 */
export function mapUnionList(html: string, contract: SourceContract): Draft[] {
  const parts = splitItems(html, contract)
  const drafts: Draft[] = []

  for (const part of parts) {
    const link = firstMatch(part, /href="(https:\/\/www\.unionb\.com\/offer\/[^"]+)"/)
    const title = stripHtml(firstMatch(part, /<h3>([\s\S]*?)<\/h3>/) ?? '')
    if (!link || !title) continue

    const slug = decodeURIComponent(link).split('/').filter(Boolean).pop() ?? ''
    if (!slug) continue

    const value = stripHtml(firstMatch(part, /<span class="offer-val">([\s\S]*?)<\/span>/) ?? '')
    const proseDate = stripHtml(firstMatch(part, /<p>([\s\S]*?)<\/p>/) ?? '')

    drafts.push({
      source: 'union',
      externalId: slug,
      bank: 'union',
      title,
      vendorHint: title,
      image: firstMatch(part, /<img src="([^"]+)"[^>]*class="img-responsive"/),
      periodText: proseDate || calendarPeriod(part),
      discountText: [value, title].filter(Boolean).join(' '),
      eligibilityText: [value, title].filter(Boolean).join(' '),
      sourceUrl: link,
    })
  }

  return drafts
}

/** `dates=20260917/20260922` is an all day span with an exclusive end. */
function calendarPeriod(block: string): string | null {
  const match = /calendar\.google\.com[^"]*?dates=(\d{8})(?:\/(\d{8}))?/.exec(block)
  if (!match) return null
  const start = iso(match[1]!)
  const end = match[2] ? iso(match[2]!) : null
  if (!start) return null
  if (!end || end === start) return `Valid only on ${start}`
  const exclusive = new Date(`${end}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()
  if (exclusive === 86_400_000) return `Valid only on ${start}`
  return `Valid from ${start} to ${end}`
}

function iso(value: string): string | null {
  if (!/^\d{8}$/.test(value)) return null
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
}

export async function fetchUnion(contract: SourceContract): Promise<Draft[]> {
  const request = contract.requests[0]
  if (!request) throw new Error('[union] the contract has no request')
  const html = await fetchText(request.url, {
    source: 'union',
    userAgent: contract.policy.userAgent,
    delayMs: contract.policy.delayMs ?? 1500,
  })
  const drafts = mapUnionList(html, contract)
  console.log(`[union] the page holds ${drafts.length} offers`)
  return drafts
}
