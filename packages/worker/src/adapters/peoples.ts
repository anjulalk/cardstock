import { type SourceContract } from '../contract.ts'
import { parsePeriodText } from '../../../shared/src/index.ts'
import { fetchText } from '../lib/http.ts'
import { firstMatch, splitItems } from '../lib/html.ts'
import type { Draft } from '../normalize.ts'
import { stripHtml } from '../normalize.ts'

/** People's renders its cards inside a script, and each is an article:
 *
 *  <article class="offer-card">
 *    <div class="discount-badge">40% off</div>
 *    <div class="offer-image"><a href=".../promotion/<slug>/">
 *      <img src=".../amaara_sky.jpg" alt="Amaara Sky Hotel - Kandy - 40% off - Credit"></a></div>
 *    <div class="card-content"><div>
 *      <div class="promo-short fw-medium">Amaara Sky Hotel - Kandy</div>
 *      <div class="meta">
 *        <span class="merchant-name">Book Online: ... Promo Code: PBCC</span>
 *        <span class="fw-medium valid-date">Till October 31, 2026</span></div>
 *    <div class="card-footer p-0">
 *      <a class="icon-btn calendar-btn" data-title="..." data-description="..."
 *         data-start="" data-end="20261031" data-location="Amaara Sky Hotel - Kandy">
 *
 *  The dates come from `data-end`, as YYYYMMDD, because the visible line is
 *  written American style ("Till October 31, 2026") which the shared parser
 *  does not read. The card type is in the slug: the same merchant is listed
 *  once for credit and once for debit.
 */
export function mapPeoplesList(html: string, pageUrl: string, contract: SourceContract): Draft[] {
  const parts = splitItems(html, contract)
  const drafts: Draft[] = []
  const categoryHint = categoryFor(pageUrl, contract)
  let skipped = 0

  for (const part of parts) {
    const link = firstMatch(part, /href="(https:\/\/www\.peoplesbank\.lk\/promotion\/[^"]+)"/)
    const title = stripHtml(firstMatch(part, /class="promo-short[^"]*">([\s\S]*?)<\/div>/) ?? '')
    if (!link || !title) continue

    const slug = decodeURIComponent(link).split('/').filter(Boolean).pop() ?? ''
    if (!slug) continue

    const badge = stripHtml(firstMatch(part, /class="discount-badge"[^>]*>([\s\S]*?)<\/div>/) ?? '')
    const merchant = stripHtml(firstMatch(part, /class="merchant-name"[^>]*>([\s\S]*?)<\/span>/) ?? '')
    const visibleDate = stripHtml(firstMatch(part, /class="fw-medium valid-date"[^>]*>([\s\S]*?)<\/span>/) ?? '')
    const dataEnd = firstMatch(part, /data-end="(\d{8})"/)

    const periodText = dataEnd ? `Valid till ${iso(dataEnd)}` : visibleDate || null
    // The visa category carries three informational cards ("Singapore Visa
    // Offers") with no date and no calendar button. They are not offers.
    const period = parsePeriodText(periodText)
    if (!period.from && !period.to) {
      skipped += 1
      continue
    }

    drafts.push({
      source: 'peoples',
      externalId: slug,
      bank: 'peoples',
      title,
      vendorHint: title,
      image: firstMatch(part, /<img src="([^"]+)"/),
      periodText,
      discountText: [badge, title].filter(Boolean).join(' '),
      eligibilityText: [title, slug.replace(/-/g, ' ')].join(' '),
      cardTypeText: /-debit|debit/i.test(slug) ? 'debit' : 'credit',
      termsText: merchant || null,
      categoryHint,
      sourceUrl: link,
    })
  }

  if (skipped > 0) console.log(`[peoples] skipped ${skipped} card(s) with no period`)
  return drafts
}

function iso(value: string): string {
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
}

function categoryFor(pageUrl: string, contract: SourceContract): string | null {
  const parts = new URL(pageUrl).pathname.split('/').filter(Boolean)
  const index = parts.indexOf('promotion-category')
  const slug = index >= 0 ? parts[index + 1] : undefined
  if (!slug) return null
  return contract.categoryMap?.[slug] ?? null
}

/** The pager is a path: /promotion-category/<slug>/page/2/. */
function pageUrl(base: string, page: number): string {
  const url = new URL(base)
  const path = url.pathname.replace(/\/page\/\d+\/?$/, '').replace(/\/$/, '')
  url.pathname = `${path}/page/${page}/`
  return url.toString()
}

export async function fetchPeoples(contract: SourceContract): Promise<Draft[]> {
  const maxPages = contract.pagination?.maxPages ?? 8
  const drafts: Draft[] = []
  const seen = new Set<string>()

  for (const request of contract.requests) {
    for (let page = 1; page <= maxPages; page++) {
      const url = page === 1 ? request.url : pageUrl(request.url, page)
      let html: string
      try {
        html = await fetchText(url, {
          source: 'peoples',
          userAgent: contract.policy.userAgent,
          delayMs: contract.policy.delayMs ?? 1500,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        // Categories have different lengths, so running out of pages is a 404.
        // A category that is not there at all is worth a warning, not a failure:
        // the offer count guard is what notices if that becomes systematic.
        if (/404/.test(message)) {
          if (page === 1) console.warn(`[peoples] ${request.name} answered 404, skipping it`)
          break
        }
        throw error
      }

      const found = mapPeoplesList(html, request.url, contract).filter(
        (draft) => !seen.has(draft.externalId),
      )
      if (found.length === 0) break
      for (const draft of found) seen.add(draft.externalId)
      drafts.push(...found)
      console.log(`[peoples] ${request.name} page ${page}: +${found.length} (total ${drafts.length})`)
    }
  }

  return drafts
}
