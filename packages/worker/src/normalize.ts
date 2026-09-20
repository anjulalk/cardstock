import { parseEligibility, parseMonthlyRange, parsePeriodText, parseValidityLabel } from '../../shared/src/index.ts'
import type { CardType, Discount, Offer } from '../../shared/src/index.ts'
import { matchVendor, type Vendor } from './registry.ts'

/** What an adapter returns. Everything here still needs normalizing, and any
 *  field may be absent: an adapter that cannot see a date says so. */
export interface Draft {
  source: string
  externalId: string
  bank: string
  title: string
  sourceUrl: string
  vendorHint?: string | null
  image?: string | null
  validFrom?: string | null
  validTo?: string | null
  validityLabel?: string | null
  periodText?: string | null
  eligibilityText?: string | null
  cardTypeText?: string | null
  discountText?: string | null
  termsText?: string | null
  /** A source that publishes its own category is believed over our keywords. */
  categoryHint?: string | null
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&#x2F;': '/',
  '&#39;': "'",
  '&quot;': '"',
  '&nbsp;': ' ',
  '&rsquo;': "'",
  '&lsquo;': "'",
  '&ldquo;': '"',
  '&rdquo;': '"',
}

export function decodeEntities(value: string): string {
  return value.replace(/&(?:amp|#x2F|#39|quot|nbsp|rsquo|lsquo|ldquo|rdquo);/g, (m) => ENTITIES[m] ?? m)
}

export function stripHtml(value: string): string {
  return decodeEntities(
    value
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/p>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim()
}

function cardTypesFromText(text: string | null | undefined): CardType[] {
  if (!text) return []
  const value = text.toLowerCase()
  const types: CardType[] = []
  if (value.includes('credit') || !value.includes('debit')) types.push('credit')
  if (value.includes('debit')) types.push('debit')
  return types
}

/** Best effort reading of the money on the card: the text always survives on
 *  the offer, so a miss here costs detail, not correctness. */
export function guessDiscount(text: string | null | undefined): Discount | null {
  if (!text) return null
  const clean = stripHtml(text)
  const cap = /(?:up to|maximum(?: of)?|max)\s*rs\.?\s*([\d,]+)/i.exec(clean)
  const minSpend =
    /(?:bill|spend|purchase|transaction)[^.]{0,28}?(?:above|over|of|exceed(?:ing)?)\s*rs\.?\s*([\d,]+)/i.exec(
      clean,
    ) ?? /(?:minimum|min)\s*(?:spend|bill|purchase)[^.]{0,20}?rs\.?\s*([\d,]+)/i.exec(clean)
  const numeric = (v: string | undefined) => (v ? Number(v.replace(/,/g, '')) : null)

  const months = /(\d{1,2})\s*(?:-|to)?\s*(\d{1,2})?\s*months?/i.exec(clean)
  if (months && /installment/i.test(clean)) {
    return {
      kind: 'installments',
      value: Math.max(Number(months[1]), Number(months[2] ?? months[1])),
      cap: numeric(cap?.[1]),
      minSpend: numeric(minSpend?.[1]),
      text: clean,
    }
  }
  if (/cash\s?back/i.test(clean)) {
    const pct = /(\d{1,3})\s*%/.exec(clean)
    return {
      kind: 'cashback',
      value: pct ? Number(pct[1]) : null,
      cap: numeric(cap?.[1]),
      minSpend: numeric(minSpend?.[1]),
      text: clean,
    }
  }
  const percent = /(\d{1,3})\s*%/.exec(clean)
  if (percent) {
    return {
      kind: 'percent',
      value: Number(percent[1]),
      cap: numeric(cap?.[1]),
      minSpend: numeric(minSpend?.[1]),
      text: clean,
    }
  }
  const amount = /rs\.?\s*([\d,]+)/i.exec(clean)
  if (amount) {
    return {
      kind: 'amount',
      value: numeric(amount[1]),
      cap: numeric(cap?.[1]),
      minSpend: numeric(minSpend?.[1]),
      text: clean,
    }
  }
  return { kind: 'other', value: null, cap: null, minSpend: null, text: clean }
}

const CATEGORY_KEYWORDS: Array<[string, RegExp]> = [
  ['supermarket', /supermarket|grocer|food city|fresh|vegetable|groceries/i],
  ['fashion', /fashion|apparel|clothing|garment|footwear|shoes|boutique/i],
  ['dining', /restaurant|dine|dining|cafe|coffee|pizza|burger|chicken|bakery|food|pub|bar|kitchen/i],
  ['fuel', /fuel|petrol|diesel|filling station|ioc/i],
  ['electronics', /electronic|mobile|smartphone|television|laptop|appliance|computer/i],
  ['home', /furniture|tile|mattress|home|hardware|paint/i],
  ['travel', /hotel|resort|airline|travel|tour|booking|villa|stay|beach|bungalow|guest ?house/i],
  ['health', /hospital|pharmacy|medical|health|clinic|optical|dental/i],
  ['online', /online|e-?commerce|delivery|app|website/i],
  ['jewellery', /jewel|gems|diamond|gold coin/i],
]

export function guessCategory(text: string, vendor: Vendor | null): string {
  if (vendor) return vendor.category
  for (const [id, pattern] of CATEGORY_KEYWORDS) {
    if (pattern.test(text)) return id
  }
  return 'other'
}

export function buildOffer(draft: Draft, now: string, today: string): Offer {
  const title = stripHtml(draft.title)
  const vendorHint = draft.vendorHint ? stripHtml(draft.vendorHint) : null
  const vendor = matchVendor(vendorHint) ?? matchVendor(title)

  const eligibility = parseEligibility(
    [draft.eligibilityText, title, draft.discountText].filter(Boolean).join(' '),
  )
  const label = parseValidityLabel(draft.validityLabel ?? null, draft.validTo ?? null)
  const period = parsePeriodText(draft.periodText ?? draft.validityLabel ?? null)
  // A monthly day range has no weekday rule to read, so it arrives as the dates
  // it means.
  const monthly = parseMonthlyRange(draft.periodText ?? draft.validityLabel ?? null, today)

  const validFrom = draft.validFrom ?? label.from ?? monthly?.from ?? period.from ?? null
  const validTo = period.to ?? label.to ?? draft.validTo ?? monthly?.to ?? null
  const cardTypes = draft.cardTypeText ? cardTypesFromText(draft.cardTypeText) : eligibility.cardTypes

  const status: Offer['status'] = !validTo ? 'unconfirmed' : validTo < today ? 'expired' : 'active'

  return {
    id: `${draft.source}:${draft.externalId}`,
    source: draft.source,
    externalId: draft.externalId,
    bank: draft.bank,
    title,
    vendor: vendor?.id ?? null,
    vendorHint,
    category:
      draft.categoryHint ??
      guessCategory([title, vendorHint, draft.discountText, draft.termsText].filter(Boolean).join(' '), vendor),
    networks: eligibility.networks,
    tiers: eligibility.tiers,
    cardTypes,
    discount: guessDiscount(draft.discountText ?? title),
    validFrom,
    validTo,
    days: period.days,
    dates: monthly?.dates.length ? monthly.dates : period.dates,
    termsText: draft.termsText ? stripHtml(draft.termsText) : null,
    sourceUrl: draft.sourceUrl,
    image: draft.image ?? null,
    fetchedAt: now,
    status,
  }
}
