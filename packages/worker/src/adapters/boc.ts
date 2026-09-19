import { type SourceContract } from '../contract.ts'
import { fetchText } from '../lib/http.ts'
import { firstMatch, splitItems } from '../lib/html.ts'
import type { Draft } from '../normalize.ts'
import { stripHtml } from '../normalize.ts'

/** BOC lists every offer on one page, 72 of them, each an anchor:
 *
 *  <a href="https://www.boc.lk/personal-banking/card-offers/travel-and-leisure/
 *           villa-labugolla/product" class="swiper-slide product unique">
 *    <figure class="offer-logo-wrap">
 *      <div class="offers-panel"><div class="offer"><p><strong>UP TO</strong></p>
 *        <p><strong>50% OFF*</strong></p></div></div>
 *      <img class="offer-logo" src="...">
 *    </figure>
 *    <div class="product-detail"><div class="top">
 *      <h4>Villa Labugolla</h4>
 *      <p class="location-name">Galagedara, Sri Lanka</p>
 *      <div class="description"><p>Up to 50% off for BOC Credit &amp; Debit Cardholders</p>...</div>
 *      <table class="highligh-box"><tr><td>Expiration date : </td><td>30 Sep 2026</td></tr></table>
 *
 *  The category and the slug both sit in the URL, so the offer id is the middle
 *  of the path, "travel-and-leisure/villa-labugolla", and the manifest template
 *  rebuilds the link. BOC publishes an expiry only, so the window start is left
 *  to the chunker.
 */
export function mapBocList(html: string, contract: SourceContract): Draft[] {
  const parts = splitItems(html, contract)
  const drafts: Draft[] = []

  for (const part of parts) {
    const href = firstMatch(part, /href="(https:\/\/www\.boc\.lk\/[^"]+\/product)"/)
    const title = stripHtml(firstMatch(part, /<h4>([\s\S]*?)<\/h4>/) ?? '')
    if (!href || !title) continue

    const path = new URL(href).pathname.split('/').filter(Boolean)
    const productIndex = path.lastIndexOf('product')
    if (productIndex < 2) continue
    const slug = path[productIndex - 1]!
    const categorySegment = path[productIndex - 2]!
    const externalId = `${categorySegment}/${slug}`

    const description = firstMatch(part, /<div class="description">([\s\S]*?)<\/div>/)
    const highlight = stripHtml(firstMatch(part, /<div class="offer">([\s\S]*?)<\/div>/) ?? '')
    const location = stripHtml(firstMatch(part, /class="location-name">([\s\S]*?)<\/p>/) ?? '')
    const expiry = firstMatch(
      part,
      /Expiration date\s*:?\s*<\/td>\s*<td>([\s\S]*?)<\/td>/,
    )

    drafts.push({
      source: 'boc',
      externalId,
      bank: 'boc',
      title,
      vendorHint: title,
      image: firstMatch(part, /<img class="offer-logo"\s*src="([^"]+)"/),
      periodText: expiry ? `Valid till ${stripHtml(expiry)}` : null,
      discountText: [highlight, stripHtml(description ?? '')].filter(Boolean).join(' '),
      eligibilityText: stripHtml(description ?? ''),
      termsText: [location, stripHtml(description ?? '')].filter(Boolean).join(' '),
      categoryHint: contract.categoryMap?.[categorySegment] ?? null,
      sourceUrl: href,
    })
  }

  return drafts
}

export async function fetchBoc(contract: SourceContract): Promise<Draft[]> {
  const request = contract.requests[0]
  if (!request) throw new Error('[boc] the contract has no request')
  const html = await fetchText(request.url, {
    source: 'boc',
    userAgent: contract.policy.userAgent,
    delayMs: contract.policy.delayMs ?? 1500,
  })
  const drafts = mapBocList(html, contract)
  console.log(`[boc] the page holds ${drafts.length} offers`)
  return drafts
}
