import { type SourceContract } from '../contract.ts'
import { fetchText } from '../lib/http.ts'
import { escapeRegExp, firstMatch, slugify } from '../lib/html.ts'
import type { Draft } from '../normalize.ts'
import { stripHtml } from '../normalize.ts'

/** NTB renders its promotions server side, one card per grid item:
 *
 *  <div class="col-lg-3 col-md-6 col-sm-12 grid-item supermarket">
 *    <div class="promo-box">
 *      <div class="promo-image"><img src="..."><div class="tag">Supermarket</div></div>
 *      <div class="info"><h6>Cargills Food City</h6><h5>30% off with Mastercard...</h5></div>
 *      <div class="promo-footer">
 *        <small>Valid on 2nd, 16th and 30th September 2026</small>
 *        <a href="https://www.nationstrust.com/promotions/30-off-...">Learn More</a>
 *
 *  The detail slug is stable and unique, so it doubles as the offer id and the
 *  manifest template rebuilds the link from it.
 */
export function mapNtbList(html: string, contract: SourceContract): Draft[] {
  const marker = contract.itemMarker ?? '<div class="col-lg-3'
  const parts = html.split(new RegExp(`(?=${escapeRegExp(marker)})`)).slice(1)
  const drafts: Draft[] = []
  let skipped = 0

  for (const part of parts) {
    const rawTitle = firstMatch(part, /<h5>([\s\S]*?)<\/h5>/)
    if (!rawTitle) continue
    const title = stripHtml(rawTitle)

    // The grid also carries one informational card ("General Terms and
    // Condition for Offers") with no period. It is not an offer.
    const periodText = firstMatch(part, /<small>([\s\S]*?)<\/small>/)
    if (!periodText || periodText.trim().length === 0) {
      skipped += 1
      continue
    }

    const link = firstMatch(part, /<a\s+href="(https?:\/\/[^"]+\/promotions\/[^"]+)"/)
    const tail = link?.split('/').filter(Boolean).pop() ?? ''
    const externalId = tail && tail !== 'promotions' ? tail : slugify(title)
    if (!externalId) continue

    const categoryClass = firstMatch(part, /grid-item\s+([a-z0-9-]+)/)

    drafts.push({
      source: 'ntb',
      externalId,
      bank: 'ntb',
      title,
      vendorHint: firstMatch(part, /<h6>([\s\S]*?)<\/h6>/),
      image: firstMatch(part, /<img[^>]*src="([^"]+)"/),
      periodText,
      discountText: title,
      categoryHint: categoryClass ? (contract.categoryMap?.[categoryClass] ?? null) : null,
      sourceUrl: link ?? contract.sourceUrlTemplate.replace('{id}', externalId),
    })
  }

  if (skipped > 0) console.log(`[ntb] skipped ${skipped} card(s) with no period`)
  return drafts
}

export async function fetchNtb(contract: SourceContract): Promise<Draft[]> {
  const request = contract.requests[0]
  if (!request) throw new Error('[ntb] the contract has no request')
  const html = await fetchText(request.url, {
    source: 'ntb',
    userAgent: contract.policy.userAgent,
    delayMs: contract.policy.delayMs ?? 1500,
  })
  const drafts = mapNtbList(html, contract)
  console.log(`[ntb] the page holds ${drafts.length} offers`)
  return drafts
}
