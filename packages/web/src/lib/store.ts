import type { CardProduct, Stub } from '@shared/types.ts'

const CARDS_KEY = 'cardstock.cards'
const MINE_KEY = 'cardstock.onlyMine'

export function loadSelection(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(CARDS_KEY) ?? '[]') as unknown
    return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

export function saveSelection(ids: string[]): void {
  localStorage.setItem(CARDS_KEY, JSON.stringify(ids))
}

export function loadOnlyMine(): boolean {
  return localStorage.getItem(MINE_KEY) !== 'false'
}

export function saveOnlyMine(value: boolean): void {
  localStorage.setItem(MINE_KEY, String(value))
}

/** An offer applies when the bank matches and every rule the offer states is
 *  satisfied. An empty list means the offer did not narrow that dimension. */
export function offerMatches(offer: Stub, cards: CardProduct[]): boolean {
  if (cards.length === 0) return true
  return cards.some(
    (card) =>
      offer.banks.includes(card.bank) &&
      (offer.tiers.length === 0 || offer.tiers.includes(card.tier)) &&
      (offer.networks.length === 0 || offer.networks.includes(card.network)) &&
      (offer.cardTypes.length === 0 || offer.cardTypes.includes(card.type)),
  )
}

export function discountLabel(offer: Stub): string | null {
  const discount = offer.discount
  if (!discount) return null
  switch (discount.kind) {
    case 'percent':
      return discount.value ? `${discount.value}% off` : 'discount'
    case 'cashback':
      return discount.value ? `${discount.value}% back` : 'cash back'
    case 'installments':
      return discount.value ? `${discount.value} months 0%` : 'instalments'
    case 'amount':
      return discount.value ? `Rs ${discount.value.toLocaleString('en-LK')}` : 'cash off'
    default:
      return null
  }
}
