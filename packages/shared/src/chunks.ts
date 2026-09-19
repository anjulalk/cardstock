import type { CardType, Discount, DiscountKind, MonthOffer, Network, Stub, Tier } from './types.ts'

/** The wire format. Chunks carry positional arrays with a field header, not
 *  objects, which removes every key name from payloads that run to hundreds of
 *  offers. The client decodes once, here, into the readable shapes. */

export const STUB_FIELDS = [
  'id',
  'title',
  'vendor',
  'vendorHint',
  'category',
  'banks',
  'tiers',
  'networks',
  'cardTypes',
  'discount',
  'validFrom',
  'validTo',
] as const

export const MONTH_FIELDS = [...STUB_FIELDS, 'days', 'terms'] as const

const DISCOUNT_KINDS: DiscountKind[] = ['percent', 'amount', 'installments', 'cashback', 'other']

function decodeDiscount(value: unknown): Discount | null {
  if (!Array.isArray(value) || value.length === 0) return null
  const [kind, amount, cap, minSpend] = value as [string, number | null, number | null, number | null]
  return {
    kind: DISCOUNT_KINDS.includes(kind as DiscountKind) ? (kind as DiscountKind) : 'other',
    value: amount ?? null,
    cap: cap ?? null,
    minSpend: minSpend ?? null,
    text: null,
  }
}

const str = (value: unknown): string | null => (typeof value === 'string' && value.length > 0 ? value : null)
const list = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : [])

export function decodeStub(entry: unknown[]): Stub {
  return {
    id: String(entry[0]),
    title: String(entry[1]),
    vendor: str(entry[2]),
    vendorHint: str(entry[3]),
    category: str(entry[4]) ?? 'other',
    banks: list<string>(entry[5]),
    tiers: list<Tier>(entry[6]),
    networks: list<Network>(entry[7]),
    cardTypes: list<CardType>(entry[8]),
    discount: decodeDiscount(entry[9]),
    validFrom: str(entry[10]),
    validTo: str(entry[11]),
  }
}

/** The offer's page on the bank's site is rebuilt from the manifest template,
 *  so the chunks do not repeat a URL per offer. */
export function decodeMonthOffer(
  entry: unknown[],
  sourceTemplates: Record<string, string>,
): MonthOffer {
  const stub = decodeStub(entry)
  const [source, externalId] = stub.id.split(':')
  const template = source ? sourceTemplates[source] : undefined
  return {
    ...stub,
    days: list<number>(entry[12]),
    termsText: str(entry[13]),
    sourceUrl: template ? template.replace('{id}', externalId ?? '') : '',
  }
}
