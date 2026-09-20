import { type SourceContract } from '../contract.ts'
import { fetchText } from '../lib/http.ts'
import { firstMatch, slugify, splitItems } from '../lib/html.ts'
import type { Draft } from '../normalize.ts'
import { decodeEntities, stripHtml } from '../normalize.ts'

/** Amana lists 34 offers on one page, each an xList card whose popup holds the
 *  details and whose calendar button holds the dates:
 *
 *  <div class="item-wrapper-box offer-item-wrapper" data-districts="ampara">
 *    <img src="/images/.../tks.jpg" title="TKS Fashion (Ampara)">
 *    <div class="calendar-wrapper">
 *      <a class='calendar_button' data-ics='{"start": "2026-12-16",
 *           "end": "2026-12-17","summary":"TKS Fashion (Ampara)",
 *           "description":"15% on bills below 25,000/= for Amana Bank Debit Card Holders"}'>
 *    <div class="pop"><div class="pop_inner">
 *      <div class="pop-row-1"><h3 class="pop_up_title">TKS Fashion (Ampara)</h3></div>
 *      <div class="pop-row-2"><p>15% on bills below 25,000/= ...</p></div>
 *      ... location, contact, and a terms body in the pop-right
 *
 *  The `data-ics` JSON is the cleanest date source of any bank here: ISO start
 *  and end, end exclusive. There is no per offer page, so the id is a slug of
 *  the title, which carries the town, and the manifest template points at the
 *  listing itself.
 */
export function mapAmanaList(html: string, contract: SourceContract): Draft[] {
  const parts = splitItems(html, contract)
  const drafts: Draft[] = []
  const seen = new Set<string>()

  for (const part of parts) {
    const title = stripHtml(firstMatch(part, /class="pop_up_title">([\s\S]*?)<\/h3>/) ?? '')
    if (!title) continue

    const externalId = slugify(title)
    if (!externalId || seen.has(externalId)) continue
    seen.add(externalId)

    const description = stripHtml(firstMatch(part, /class="pop-row-2">([\s\S]*?)<\/div>/) ?? '')
    const location = stripHtml(firstMatch(part, /class="fa fa-map-marker">([\s\S]*?)<\/li>/) ?? '')
    const terms = stripHtml(firstMatch(part, /class="condition-body">([\s\S]*?)<\/div>/) ?? '')

    drafts.push({
      source: 'amana',
      externalId,
      bank: 'amana',
      title,
      vendorHint: title.replace(/\s*\([^)]*\)\s*$/, ''),
      image: firstMatch(part, /<img src="([^"]+)"/),
      // The JSON sits in a single quoted attribute and can itself contain an
      // apostrophe ("Earl's Regency"), so capture up to the quote that closes
      // the attribute rather than the first one.
      periodText: periodFromIcs(firstMatch(part, /data-ics='([\s\S]*?)'\s*\/?>/)),
      discountText: description || title,
      eligibilityText: description,
      termsText: [location, terms].filter(Boolean).join(' ') || null,
      sourceUrl: contract.sourceUrlTemplate.replace('{id}', externalId),
    })
  }

  return drafts
}

/** `{"start":"2026-12-16","end":"2026-12-17"}` is an all day event with an
 *  exclusive end, so a one day offer looks like a two day span.
 *
 *  The JSON is not always valid: four cards carry raw newlines inside their
 *  description strings, which JSON.parse rejects. Those are control characters
 *  inside values, so they are flattened to spaces first, and if the parse still
 *  fails the two date fields are read directly. */
function periodFromIcs(raw: string | null): string | null {
  if (!raw) return null
  const text = decodeEntities(raw).replace(/[\u0000-\u001f]+/g, ' ')

  let start: string | null = null
  let end: string | null = null
  try {
    const parsed = JSON.parse(text) as { start?: string; end?: string }
    start = parsed.start ?? null
    end = parsed.end ?? null
  } catch {
    start = /"start"\s*:\s*"(\d{4}-\d{2}-\d{2})"/.exec(text)?.[1] ?? null
    end = /"end"\s*:\s*"(\d{4}-\d{2}-\d{2})"/.exec(text)?.[1] ?? null
  }

  if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start)) return null
  if (!end || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return `Valid only on ${start}`

  const inclusiveEnd = shiftDays(end, -1)
  if (inclusiveEnd <= start) return `Valid only on ${start}`
  return `Valid from ${start} to ${inclusiveEnd}`
}

function shiftDays(iso: string, delta: number): string {
  const date = new Date(`${iso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + delta)
  return date.toISOString().slice(0, 10)
}

export async function fetchAmana(contract: SourceContract): Promise<Draft[]> {
  const request = contract.requests[0]
  if (!request) throw new Error('[amana] the contract has no request')
  const html = await fetchText(request.url, {
    source: 'amana',
    userAgent: contract.policy.userAgent,
    delayMs: contract.policy.delayMs ?? 1500,
  })
  const drafts = mapAmanaList(html, contract)
  console.log(`[amana] the page holds ${drafts.length} offers`)
  return drafts
}
