import { type SourceContract } from '../contract.ts'
import { parsePeriodText } from '../../../shared/src/index.ts'
import { fetchText } from '../lib/http.ts'
import { firstMatch, splitItems } from '../lib/html.ts'
import type { Draft } from '../normalize.ts'
import { stripHtml } from '../normalize.ts'

/** ComBank lists every offer on one page, grouped into category rows:
 *
 *  <div class="offers-row" id="food-restaurants">
 *    <a class="reward box-shadow active"
 *       href="https://www.combank.lk/rewards-promotion/food-restaurants/<slug>">
 *      <div class="reward-image" style="background-image: url('https://s3.../thumb.jpg')"></div>
 *      <div class="offer-tag percentage"><p>Up to</p><p>20%</p><p>Off</p></div>
 *      <div class="reward-content">
 *        <p class="category">Food &amp; Restaurants</p>
 *        <h3>Enjoy the art of dining at Hilton Colombo with ComBank Credit Cards</h3>
 *        <p class="valid-date">Offer valid till 30th September 2026</p>
 *
 *  The category is in the URL, so the offer id is the path after
 *  /rewards-promotion/ and the manifest template rebuilds the link.
 */
export function mapCombankList(html: string, contract: SourceContract): Draft[] {
  const parts = splitItems(html, contract)
  const drafts: Draft[] = []
  const seen = new Set<string>()
  let skipped = 0

  for (const part of parts) {
    const href = firstMatch(part, /href="(https:\/\/www\.combank\.lk\/rewards-promotion\/[^"]+)"/)
    const title = stripHtml(firstMatch(part, /<h3>([\s\S]*?)<\/h3>/) ?? '')
    if (!href || !title) continue

    const path = new URL(href).pathname.split('/').filter(Boolean)
    const index = path.indexOf('rewards-promotion')
    const externalId = path.slice(index + 1).join('/')
    if (!externalId || seen.has(externalId)) continue
    seen.add(externalId)

    const categorySegment = path[index + 1] ?? ''
    const tag = stripHtml(firstMatch(part, /<div class="offer-tag[^"]*">([\s\S]*?)<\/div>/) ?? '')
    const dateText = stripHtml(firstMatch(part, /class="valid-date"[^>]*>([\s\S]*?)<\/p>/) ?? '')

    // A card whose period cannot be placed is skipped rather than published
    // undated, and the offer count guard notices if that becomes common. An
    // offer with a start and no end cannot be placed either, so it needs an end.
    const period = parsePeriodText(dateText)
    if (!dateText || !period.to) {
      skipped += 1
      continue
    }

    drafts.push({
      source: 'combank',
      externalId,
      bank: 'combank',
      title,
      vendorHint: title,
      image: firstMatch(part, /background-image:\s*url\('([^']+)'\)/),
      periodText: dateText || null,
      discountText: [tag, title].filter(Boolean).join(' '),
      eligibilityText: title,
      categoryHint: contract.categoryMap?.[categorySegment] ?? null,
      sourceUrl: href,
    })
  }

  if (skipped > 0) console.log(`[combank] skipped ${skipped} card(s) with no placeable period`)
  return drafts
}

export async function fetchCombank(contract: SourceContract): Promise<Draft[]> {
  const request = contract.requests[0]
  if (!request) throw new Error('[combank] the contract has no request')
  const html = await fetchText(request.url, {
    source: 'combank',
    userAgent: contract.policy.userAgent,
    delayMs: contract.policy.delayMs ?? 1500,
  })
  const drafts = mapCombankList(html, contract)
  console.log(`[combank] the page holds ${drafts.length} offers`)
  return drafts
}
