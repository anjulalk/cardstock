import { type SourceContract } from '../contract.ts'
import { parsePeriodText } from '../../../shared/src/index.ts'
import { fetchJson } from '../lib/http.ts'
import type { Draft } from '../normalize.ts'
import { stripHtml } from '../normalize.ts'

/** Sampath's list API answers only a request that says which locale and platform
 *  it comes from, which is why a plain call returns a correct total with an
 *  empty data array. With those two headers it returns the promotions:
 *
 *  { "id": 3111, "company_name": "SPAR Supermarket", "category": "super_markets",
 *    "expire_on": "1790792940000", "image_url": "...",
 *    "description": "<span ...>25% Discount on TOTAL BILL</span>",
 *    "calender_url": "https://calendar.google.com/...?dates=20260731/20261001" }
 *
 *  The richer fields (promotion_period, eligible_card_categories, location) come
 *  back empty in the list and are only filled by the detail route, which is one
 *  request per offer. The calendar needs none of them, so the list is enough and
 *  the card types are read from the description.
 */
export interface SampathPromotion {
  id: number
  company_name?: string | null
  category?: string | null
  expire_on?: string | null
  image_url?: string | null
  description?: string | null
  short_description?: string | null
  terms_and_conditions?: string | null
  calender_url?: string | null
}

export interface SampathResponse {
  total?: number
  data?: SampathPromotion[]
}

export function mapSampathPromotions(
  payload: SampathResponse,
  contract: SourceContract,
): Draft[] {
  const drafts: Draft[] = []
  const seen = new Set<string>()
  let skipped = 0

  for (const row of payload.data ?? []) {
    const externalId = String(row.id ?? '')
    if (!externalId || seen.has(externalId)) continue
    seen.add(externalId)

    const title = stripHtml(row.company_name ?? '')
    const description = stripHtml(row.description ?? row.short_description ?? '')
    if (!title && !description) continue

    // Six of the 121 rows carry no expiry, and an offer without an end date
    // cannot be placed on a calendar.
    const periodText = periodFrom(row)
    if (!periodText || !parsePeriodText(periodText).to) {
      skipped += 1
      continue
    }

    drafts.push({
      source: 'sampath',
      externalId,
      bank: 'sampath',
      title: title || description.slice(0, 70),
      vendorHint: title || null,
      image: row.image_url ?? null,
      periodText,
      discountText: [description, title].filter(Boolean).join(' '),
      eligibilityText: description,
      termsText: stripHtml(row.terms_and_conditions ?? '') || null,
      categoryHint: contract.categoryMap?.[String(row.category ?? '')] ?? null,
      sourceUrl: contract.sourceUrlTemplate.replace('{id}', externalId),
    })
  }

  if (skipped > 0) console.log(`[sampath] skipped ${skipped} row(s) with no end date`)
  return drafts
}

/** `expire_on` is epoch milliseconds; the calendar link carries a start. */
function periodFrom(row: SampathPromotion): string | null {
  const end = row.expire_on ? new Date(Number(row.expire_on)) : null
  const start = /dates=(\d{8})/.exec(row.calender_url ?? '')?.[1]
  const startIso = start
    ? `${start.slice(0, 4)}-${start.slice(4, 6)}-${start.slice(6, 8)}`
    : null

  if (!end || Number.isNaN(end.getTime())) {
    return startIso ? `Valid from ${startIso}` : null
  }
  // The bank stamps the last minute of the day in Colombo time, so the date is
  // read there rather than in UTC.
  const endIso = new Date(end.getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10)
  return startIso ? `Valid from ${startIso} to ${endIso}` : `Valid till ${endIso}`
}

export async function fetchSampath(contract: SourceContract): Promise<Draft[]> {
  const request = contract.requests[0]
  if (!request) throw new Error('[sampath] the contract has no request')

  const payload = await fetchJson<SampathResponse>(request.url, {
    source: 'sampath',
    userAgent: contract.policy.userAgent,
    delayMs: contract.policy.delayMs ?? 1200,
    headers: request.headers,
  })
  const drafts = mapSampathPromotions(payload, contract)
  console.log(`[sampath] the api returns ${drafts.length} promotions`)
  return drafts
}
