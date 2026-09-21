import { type SourceContract } from '../contract.ts'
import { fetchText } from '../lib/http.ts'
import { firstMatch, splitItems } from '../lib/html.ts'
import type { Draft } from '../normalize.ts'
import { stripHtml } from '../normalize.ts'

/** DFCC is a Next.js app. Its category pages render a hero and then fetch the
 *  offers in the browser, but /dfcc-card-offers/today-promotions is rendered on
 *  the server, which is where this shape comes from:
 *
 *  <a class="cardd" href="citrus-waskaduwa-2">
 *    <div class="card-tags"><p class="tag">Credit Card</p><p class="tag">Visa</p></div>
 *    <div class="card-img bg"><figure><img src="https://properties.dfcc.lk/...jpg"></figure>
 *      <div class="badge-containerr"><p class="discount-badgee">15%</p></div></div>
 *    <div class="cardContent">
 *      <h3>15% Savings at Citrus - Waskaduwa ... valid on DFCC Credit Cards ...</h3>
 *      <p>Valid from 31 August 2026 at 18:30 until 31 October 2026 at 17:30</p>
 *
 *  The same mapping applies to whatever the browser runner renders from the
 *  category pages, so only the fetching is outstanding.
 */
export function mapDfccList(html: string, contract: SourceContract): Draft[] {
  const parts = splitItems(html, contract)
  const drafts: Draft[] = []
  const seen = new Set<string>()

  for (const part of parts) {
    const slug = firstMatch(part, /^<a[^>]*class="cardd"[^>]*href="([^"?]+)"/) ??
      firstMatch(part, /href="([^"?]+)"/)
    const title = stripHtml(firstMatch(part, /<h3>([\s\S]*?)<\/h3>/) ?? '')
    if (!slug || !title) continue

    const externalId = slug.replace(/^https?:\/\/[^/]+\//, '').replace(/^\/+|\/+$/g, '')
    if (!externalId || seen.has(externalId)) continue
    seen.add(externalId)

    // The offer's own words sit in the paragraph that mentions Valid.
    const paragraphs = [...part.matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/g)]
      .map((match) => stripHtml(match[1]!))
      .filter((text) => text.length > 0)
    const periodText = paragraphs.find((text) => /valid/i.test(text)) ?? null
    const tags = [...part.matchAll(/class="tag"[^>]*>([\s\S]*?)<\/p>/g)].map((match) =>
      stripHtml(match[1]!),
    )
    const badge = stripHtml(firstMatch(part, /class="discount-badgee"[^>]*>([\s\S]*?)<\/p>/) ?? '')

    drafts.push({
      source: 'dfcc',
      externalId,
      bank: 'dfcc',
      title,
      vendorHint: title,
      image: firstMatch(part, /<img[^>]*src="([^"]+)"/),
      periodText,
      discountText: [badge, title].filter(Boolean).join(' '),
      eligibilityText: [tags.join(' '), title].filter(Boolean).join(' '),
      cardTypeText: tags.join(' ') || null,
      sourceUrl: contract.sourceUrlTemplate.replace('{id}', externalId),
    })
  }

  return drafts
}

export async function fetchDfcc(contract: SourceContract): Promise<Draft[]> {
  const request = contract.requests[0]
  if (!request) throw new Error('[dfcc] the contract has no request')
  const html = await fetchText(request.url, {
    source: 'dfcc',
    userAgent: contract.policy.userAgent,
    delayMs: contract.policy.delayMs ?? 1500,
  })
  const drafts = mapDfccList(html, contract)
  console.log(`[dfcc] the page holds ${drafts.length} offers`)
  return drafts
}
