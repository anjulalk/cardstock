import { type SourceContract } from '../contract.ts'
import { fetchText } from '../lib/http.ts'
import { escapeRegExp, firstMatch, slugify } from '../lib/html.ts'
import type { Draft } from '../normalize.ts'
import { stripHtml } from '../normalize.ts'

/** Seylan renders its promotions server side, six to a page, and paginates
 *  with a rel="next" link. Two details are worth knowing:
 *
 *  - The dates live only in a Google Calendar link, `dates=20261226/20261227`
 *    with an exclusive end, so the adapter turns them into the prose the shared
 *    parser already understands.
 *  - The offer title h5 carries a leftover PHP fragment in its attributes
 *    (`?name=".$result->slug}}"`), so the title is read from the tag's text.
 */
export function mapSeylanList(html: string, pageUrl: string, contract: SourceContract): Draft[] {
  const marker = contract.itemMarker ?? 'class="col-md-4 promotion-item'
  const parts = html.split(new RegExp(`(?=${escapeRegExp(marker)})`)).slice(1)
  const drafts: Draft[] = []
  const categoryHint = categoryFor(pageUrl, contract)

  for (const part of parts) {
    const title = cleanText(firstMatch(part, /<h5[^>]*>([\s\S]*?)<\/h5>/))
    if (!title) continue

    const link = firstMatch(part, /href="(https?:\/\/www\.seylan\.lk\/[^"]+)"/)
    const externalId = offerId(link, title)
    if (!externalId) continue

    const description = cleanText(firstMatch(part, /new-promotion-dis"[^>]*>([\s\S]*?)<\/p>/))

    drafts.push({
      source: 'seylan',
      externalId,
      bank: 'seylan',
      title,
      vendorHint: title,
      image: firstMatch(part, /new-promotion-img[^"]*"\s*src="([^"]+)"/),
      periodText: periodFromCalendar(part),
      discountText: description ?? title,
      eligibilityText: description,
      categoryHint,
      sourceUrl: link ?? contract.sourceUrlTemplate.replace('{id}', externalId),
    })
  }

  return drafts
}

/** The h5 can carry template debris before the text, so take what follows the
 *  last angle bracket. */
function cleanText(value: string | null): string | null {
  if (!value) return null
  const text = stripHtml(value.replace(/^[\s\S]*>/, ''))
  return text.length > 0 ? text : null
}

/** The id has to be the slug exactly as published, underscores and case
 *  included, because the manifest rebuilds the bank link from it. */
function offerId(link: string | null, title: string): string {
  if (link) {
    const tail = decodeURIComponent(link).split('/').filter(Boolean).pop() ?? ''
    if (tail && tail !== 'promotions' && tail !== 'cards') return tail
  }
  return slugify(title)
}

/** `dates=20261226/20261227` is an all day event with an exclusive end. */
function periodFromCalendar(block: string): string | null {
  const match = /calendar\.google\.com[^"]*?dates=(\d{8})(?:\/(\d{8}))?/.exec(block)
  if (!match) return null
  const start = isoFromCompact(match[1]!)
  const end = match[2] ? isoFromCompact(match[2]!) : null
  if (!start) return null
  if (!end) return `Valid only on ${start}`
  if (end === start) return `Valid only on ${start}`
  // A single day event ends the next day, so step the end back when it is one
  // day later and the start and end are a single day apart.
  const exclusive = new Date(`${end}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()
  if (exclusive === 86_400_000) return `Valid only on ${start}`
  return `Valid from ${start} to ${end}`
}

function isoFromCompact(value: string): string | null {
  if (!/^\d{8}$/.test(value)) return null
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
}

function categoryFor(pageUrl: string, contract: SourceContract): string | null {
  const path = new URL(pageUrl).pathname.split('/').filter(Boolean)
  const last = path[path.length - 1]
  if (!last || last === 'cards') return null
  return contract.categoryMap?.[last] ?? null
}

export async function fetchSeylan(contract: SourceContract): Promise<Draft[]> {
  const first = contract.requests[0]
  if (!first) throw new Error('[seylan] the contract has no request')

  const maxPages = contract.pagination?.maxPages ?? 40
  const seen = new Set<string>()
  const drafts: Draft[] = []
  let url: string | null = first.url
  let page = 0

  while (url && page < maxPages) {
    page += 1
    const html = await fetchText(url, {
      source: 'seylan',
      userAgent: contract.policy.userAgent,
      delayMs: contract.policy.delayMs ?? 1500,
    })
    const pageDrafts = mapSeylanList(html, url, contract).filter((draft) => !seen.has(draft.externalId))
    for (const draft of pageDrafts) seen.add(draft.externalId)
    drafts.push(...pageDrafts)
    console.log(`[seylan] page ${page}: +${pageDrafts.length} (total ${drafts.length})`)

    const next = firstMatch(html, /<a class="page-link" href="([^"]+)" rel="next">/)
    url = next ? next.replace(/&amp;/g, '&').replace(/^http:/, 'https:') : null
    if (pageDrafts.length === 0 && !next) break
  }

  return drafts
}
