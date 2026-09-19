/** Shapes that cross the contract boundary between the build and the browser.
 *  Bump CONTRACT when a field changes meaning; adding a field is free. */
export const CONTRACT = 2

export type CardType = 'credit' | 'debit'
export type Network = 'visa' | 'mastercard' | 'amex'
export type Tier =
  | 'infinite'
  | 'signature'
  | 'platinum'
  | 'world'
  | 'gold'
  | 'titanium'
  | 'freedom'
  | 'classic'
  | 'premier'

export type DiscountKind = 'percent' | 'amount' | 'installments' | 'cashback' | 'other'

export interface Discount {
  kind: DiscountKind
  value: number | null
  cap: number | null
  minSpend: number | null
  text: string | null
}

export type OfferStatus = 'active' | 'unconfirmed' | 'expired'

/** Canonical offer, one line in data/offers.jsonl. */
export interface Offer {
  id: string
  source: string
  externalId: string
  bank: string
  title: string
  vendor: string | null
  vendorHint: string | null
  category: string | null
  networks: Network[]
  tiers: Tier[]
  cardTypes: CardType[]
  discount: Discount | null
  validFrom: string | null
  validTo: string | null
  /** Weekday rule, 0 is Sunday, when the offer runs on set days of the week. */
  days: number[]
  /** Explicit dates, when the offer names them instead of a rule. */
  dates: string[]
  termsText: string | null
  sourceUrl: string
  image: string | null
  fetchedAt: string
  status: OfferStatus
}

/** Compact entry for the client: everything a list, a filter and a picker
 *  match need, and nothing more. */
export interface Stub {
  id: string
  title: string
  vendor: string | null
  vendorHint: string | null
  category: string | null
  banks: string[]
  tiers: Tier[]
  networks: Network[]
  cardTypes: CardType[]
  discount: Discount | null
  validFrom: string | null
  validTo: string | null
}

/** One concrete month, with the qualifying day numbers already resolved. */
export interface MonthOffer extends Stub {
  days: number[]
  termsText: string | null
  sourceUrl: string
}

/** A card product a visitor can say they hold. Published as its own chunk
 *  because the picker cannot work without it. */
export interface CardProduct {
  id: string
  bank: string
  name: string
  tier: Tier
  network: Network
  type: CardType
}

export interface Facet {
  id: string
  name: string
  count: number
}

export interface VendorFacet extends Facet {
  category: string
}

export interface ChunkRef {
  url: string
  bytes: number
  offers?: number
}

/** A month is published per bank, so a visitor who holds two banks downloads
 *  two files rather than every offer in the country. */
export interface MonthRef {
  banks: Record<string, ChunkRef>
}

/** data/index.json, the agreement between the build and the client. */
export interface Manifest {
  contract: number
  minClient: number
  dataVersion: string
  generatedAt: string
  window: { from: string; to: string }
  counts: { offers: number; vendors: number; cards: number }
  facets: {
    banks: Facet[]
    categories: Facet[]
    tiers: Facet[]
    vendors: VendorFacet[]
  }
  /** How to build an offer's page on the bank's site, so the chunks do not have
   *  to repeat a URL per offer: "https://www.hnb.lk/card-promotion/search/{id}". */
  sourceTemplates: Record<string, string>
  chunks: {
    cards: ChunkRef
    months: Record<string, MonthRef>
  }
}

/** One bank's offers for one month, as it travels. */
export interface MonthChunk {
  month: string
  bank: string
  fields: string[]
  entries: unknown[][]
}
