import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { CardProduct } from '../../shared/src/index.ts'
import { registryDir } from './paths.ts'

export type { CardProduct }

export interface Bank {
  id: string
  name: string
  aliases: string[]
  site: string
}

export interface Vendor {
  id: string
  name: string
  category: string
  /** Spelling variants a bank may publish. */
  aliases?: string[]
  /** Match terms for the names a bank actually writes, such as a branch or a
   *  chain's longer title. */
  keywords?: string[]
}

export interface Category {
  id: string
  name: string
}

function load<T>(file: string): T {
  return JSON.parse(readFileSync(resolve(registryDir, file), 'utf8')) as T
}

const vendorRegistry = load<{ categories: Category[]; vendors: Vendor[] }>('vendors.json')

export const banks: Bank[] = load<{ banks: Bank[] }>('banks.json').banks
export const cards: CardProduct[] = load<{ cards: CardProduct[] }>('cards.json').cards
export const categories: Category[] = vendorRegistry.categories
export const vendors: Vendor[] = vendorRegistry.vendors

export const bankById = new Map(banks.map((bank) => [bank.id, bank]))

/** Words that carry no identity, so "Keells Supermarket" still matches "Keells". */
const NOISE = new Set([
  'pvt', 'ltd', 'limited', 'plc', 'the', 'and', 'or', 'of', 'at', 'in', 'on',
  'outlet', 'outlets', 'supermarket', 'super', 'store', 'stores', 'showroom',
  'lk', 'com', 'www', 'shop', 'shops', 'group', 'holdings', 'company', 'co',
  'hotel', 'hotels', 'resort', 'resorts', 'spa', 'spas', 'restaurant',
  'restaurants', 'cafe', 'cafes', 'boutique', 'bank', 'card', 'cards',
])

export function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 1 && !NOISE.has(token))
    .join(' ')
}

/** "Keells Super - Union Place" and "Club Palm Bay, Marawila" name a branch or a
 *  town after the merchant, which is not part of its identity. */
export function stripBranch(value: string): string[] {
  const variants = new Set<string>()
  const cut = value.split(/\s+[-–—]\s+|,\s+/)[0]?.trim()
  if (cut && cut.length > 2 && cut !== value) variants.add(cut)
  const withoutTail = value.replace(/\s*[-–—]\s*[^,]{0,24}$/g, '').trim()
  if (withoutTail.length > 2 && withoutTail !== value) variants.add(withoutTail)
  return [...variants]
}

export interface VendorMatch {
  vendor: Vendor
  score: number
  term: string
}

/** Matches a bank's merchant text to a registry vendor by keyword. The score
 *  says how sure it is: 4 is the same name, 3 is a name inside a longer one,
 *  2 is every word of a keyword present. Below that the match is refused and
 *  the bank's own name is shown instead, which is the honest fallback. */
export function matchVendor(hint: string | null | undefined): VendorMatch | null {
  if (!hint) return null
  const variants = [hint, ...stripBranch(hint)]
  let best: VendorMatch | null = null
  let bestScore = 0

  for (const variant of variants) {
    const target = normalizeName(variant)
    if (target.length === 0) continue
    const targetTokens = target.split(' ')

    for (const vendor of vendors) {
      for (const term of [vendor.name, ...(vendor.aliases ?? []), ...(vendor.keywords ?? [])]) {
        const key = normalizeName(term)
        if (key.length === 0) continue
        const keyTokens = key.split(' ')

        let score = 0
        if (key === target) score = 4
        else if (target.includes(key)) score = 3
        else if (keyTokens.every((token) => targetTokens.includes(token))) score = 2
        if (score === 0) continue

        const better =
          !best ||
          score > best.score ||
          (score === best.score && key.length > normalizeName(best.term).length)
        if (better) {
          best = { vendor, score, term }
          bestScore = score
        }
      }
    }

    // The exit reads a plain number rather than the match itself: narrowing the
    // match inside a break condition leaves TypeScript thinking it is null once
    // the loop is over, and every read after it fails to compile.
    if (bestScore === 4) break
  }

  // Two shared words at least. A single long word is not enough: "Hilton Colombo"
  // shares "Colombo" with a jewellery shop, which is a city, not a brand.
  return best && best.score >= 2 ? best : null
}
