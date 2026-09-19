import { type SourceContract } from '../contract.ts'
import { parsePeriodText } from '../../../shared/src/index.ts'
import { fetchText } from '../lib/http.ts'
import { firstMatch, splitItems } from '../lib/html.ts'
import type { Draft } from '../normalize.ts'
import { stripHtml } from '../normalize.ts'

/** NDB lists all of its offers on one page, 101 of them:
 *
 *  <a href="/cards/card-offers/offer-details/345" title="View Offer Details">
 *    <div class="card offer-card h-100 shadow-none">
 *      <img src="...cardoffer/images/..." class="card-img-top">
 *      <img src="...media/...logo.png" class="card-img-top position-absolute offercompanylogo">
 *      <div class="card-body pb-0">
 *        <h5 class="card-title ndbcolor">22% Savings on Reservations</h5>
 *        <p class="card-title"> Club palm Bay - Marawila</p>
 *        <p class="text-muted py-1">Credit Cards</p>
 *        <p class="offer-date py-2 mb-0">... Until 31st March 2026</p>
 *
 *  The link is relative and numeric, so the id is the number and the manifest
 *  template rebuilds it. The card type line is where the tiers appear, for the
 *  few cards that name them ("Visa Infinite Cards", "Platinum, Signature and
 *  Infinite Credit cards").
 */
export function mapNdbList(html: string, contract: SourceContract): Draft[] {
  const parts = splitItems(html, contract)
  const drafts: Draft[] = []
  let skipped = 0

  for (const part of parts) {
    const externalId = firstMatch(part, /^<a href="\/cards\/card-offers\/offer-details\/(\d+)"/)
    const title = stripHtml(firstMatch(part, /class="card-title ndbcolor"[^>]*>([\s\S]*?)<\/h5>/) ?? '')
    if (!externalId || !title) continue

    const dateText = stripHtml(firstMatch(part, /<p class="offer-date[^"]*">([\s\S]*?)<\/p>/) ?? '')
    // Every card publishes a period, but a couple of them cannot be placed on a
    // calendar: one reads "20th - Month end in Every month 2026", a monthly
    // recurrence with no end, and three are empty. Ask the parser rather than
    // guess, and let the offer count guard notice if this ever becomes common.
    const parsed = parsePeriodText(dateText)
    if (!parsed.from && !parsed.to) {
      skipped += 1
      continue
    }

    const vendorHint = stripHtml(firstMatch(part, /<p class="card-title">([\s\S]*?)<\/p>/) ?? '')
    const cardTypes = stripHtml(firstMatch(part, /<p class="text-muted py-1">([\s\S]*?)<\/p>/) ?? '')

    drafts.push({
      source: 'ndb',
      externalId,
      bank: 'ndb',
      title,
      vendorHint,
      image: firstMatch(part, /<img\s+src="([^"]+)"[^>]*class="card-img-top"/),
      periodText: dateText,
      discountText: title,
      eligibilityText: [cardTypes, title].filter(Boolean).join(' '),
      cardTypeText: cardTypes,
      sourceUrl: contract.sourceUrlTemplate.replace('{id}', externalId),
    })
  }

  if (skipped > 0) console.log(`[ndb] skipped ${skipped} card(s) with no placeable period`)
  return drafts
}

export async function fetchNdb(contract: SourceContract): Promise<Draft[]> {
  const request = contract.requests[0]
  if (!request) throw new Error('[ndb] the contract has no request')
  const html = await fetchText(request.url, {
    source: 'ndb',
    userAgent: contract.policy.userAgent,
    delayMs: contract.policy.delayMs ?? 1500,
  })
  const drafts = mapNdbList(html, contract)
  console.log(`[ndb] the page holds ${drafts.length} offers`)
  return drafts
}
