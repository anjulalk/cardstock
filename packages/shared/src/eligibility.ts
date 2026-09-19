import type { CardType, Network, Tier } from './types.ts'

const NETWORK_PATTERNS: Array<[Network, RegExp]> = [
  ['visa', /\bvisa\b/i],
  ['mastercard', /master\s?card/i],
  ['amex', /american\s+express|\bamex\b/i],
]

const TIER_PATTERNS: Array<[Tier, RegExp]> = [
  ['infinite', /\binfinite\b/i],
  ['signature', /\bsignature\b/i],
  ['platinum', /\bplatinum\b/i],
  ['world', /\bworld\b/i],
  ['titanium', /\btitanium\b/i],
  ['freedom', /\bfreedom\b/i],
  ['gold', /\bgold\b/i],
  ['classic', /\bclassic\b/i],
  ['premier', /\bpremier\b/i],
]

export interface Eligibility {
  networks: Network[]
  tiers: Tier[]
  cardTypes: CardType[]
  /** True when the text says every card, so the offer applies unconditionally. */
  openToAll: boolean
}

/** Reads the eligibility sentence every bank writes under an offer, for
 *  example "for all Sampath Mastercard & Visa Credit Cardholders". */
export function parseEligibility(text: string | null): Eligibility {
  if (!text) return { networks: [], tiers: [], cardTypes: [], openToAll: false }

  const networks = NETWORK_PATTERNS.filter(([, re]) => re.test(text)).map(([id]) => id)
  const tiers = TIER_PATTERNS.filter(([, re]) => re.test(text)).map(([id]) => id)

  const cardTypes: CardType[] = []
  const mentionsCredit = /\bcredit\b/i.test(text)
  const mentionsDebit = /\bdebit\b/i.test(text)
  if (mentionsCredit || !mentionsDebit) cardTypes.push('credit')
  if (mentionsDebit) cardTypes.push('debit')

  const openToAll =
    /\ball\b[^.]{0,40}\bcards?\b/i.test(text) ||
    /\bany\b[^.]{0,20}\bcard\b/i.test(text) ||
    (!networks.length && !tiers.length && cardTypes.length > 0)

  return { networks, tiers, cardTypes, openToAll }
}
