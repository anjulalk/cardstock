import { type SourceContract } from '../contract.ts'
import { parsePeriodText } from '../../../shared/src/index.ts'
import { renderHtml } from '../lib/browser.ts'
import { firstMatch, slugify, splitItems } from '../lib/html.ts'
import type { Draft } from '../normalize.ts'
import { stripHtml } from '../normalize.ts'

/** Pan Asia answers a plain client with a Sucuri challenge, and renders its
 *  offers as flip cards once a browser is allowed in:
 *
 *  <div class="flip-card"><div class="flip-card-inner">
 *    <div class="flip-card-front">
 *      <img src="http://www.pabcbank.com/wp-content/uploads/2026/09/Anantaya-Resorts-Spa.jpg">
 *      <h2>35% OFF</h2><p>11-09-2026</p></div>
 *    <div class="flip-card-back">
 *      <p>Enjoy up to 35% OFF at Anantaya Resort &amp; Spa ... bookings made until
 *         30th September 2026, with stays valid until 30th November 2026 ...</p>
 *
 *  There is no detail page, so the id is a slug of the image file and the link
 *  points at the listing. The date on the front is when the card was posted, so
 *  the wording on the back is what places the offer; the front's date is only a
 *  fallback.
 */
export function mapPanasiaList(html: string, contract: SourceContract): Draft[] {
  const parts = splitItems(html, contract)
  const drafts: Draft[] = []
  const seen = new Set<string>()
  let skipped = 0

  for (const part of parts) {
    const badge = stripHtml(firstMatch(part, /<h2>([\s\S]*?)<\/h2>/) ?? '')
    const description = stripHtml(firstMatch(part, /class="flip-card-back">([\s\S]*?)<\/div>/) ?? '')
    const image = firstMatch(part, /<img src="([^"]+)"/)
    const posted = stripHtml(firstMatch(part, /<p>([\s\S]*?)<\/p>/) ?? '')
    if (!badge && !description) continue

    let externalId = image ? slugify(image.split('/').pop()!.replace(/\.[a-z]+$/i, '')) : ''
    if (!externalId) externalId = slugify(description.slice(0, 60))
    if (!externalId) continue
    while (seen.has(externalId)) externalId = `${externalId}-2`
    seen.add(externalId)

    // The merchant sits in the wording: "at Anantaya Resort & Spa ... with your".
    const merchant = firstMatch(description, /\bat\s+([^.]{3,70}?)\s+(?:with|for|from|when|on)\b/i)

    const periodText =
      /\d/.test(description) && /valid|until|till|book/i.test(description)
        ? description
        : posted || null
    // Without an end date there is nothing to put on a calendar.
    if (!periodText || !parsePeriodText(periodText).to) {
      skipped += 1
      continue
    }

    drafts.push({
      source: 'panasia',
      externalId,
      bank: 'panasia',
      title: merchant ? stripHtml(merchant) : badge || description.slice(0, 60),
      // The badge is a discount, not a merchant, so it never becomes the hint.
      vendorHint: merchant ? stripHtml(merchant) : null,
      image,
      periodText,
      discountText: [badge, description].filter(Boolean).join(' '),
      eligibilityText: description,
      termsText: description || null,
      sourceUrl: contract.sourceUrlTemplate,
    })
  }

  if (skipped > 0) console.log(`[panasia] skipped ${skipped} card(s) with no placeable period`)
  return drafts
}

export async function fetchPanasia(contract: SourceContract): Promise<Draft[]> {
  const request = contract.requests[0]
  if (!request) throw new Error('[panasia] the contract has no request')
  const html = await renderHtml(request.url, { userAgent: contract.policy.userAgent, idleMs: 2000 })
  const drafts = mapPanasiaList(html, contract)
  console.log(`[panasia] the rendered page holds ${drafts.length} offers`)
  return drafts
}
