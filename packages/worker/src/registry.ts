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
  aliases?: string[]
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

/** Best effort match from the bank's merchant text to a registry vendor. A miss
 *  is fine: the hint is kept and the row shows as unclassified. */
export function matchVendor(hint: string | null | undefined): Vendor | null {
  if (!hint) return null
  const target = normalizeName(hint)
  if (!target) return null

  let best: { vendor: Vendor; score: number } | null = null
  for (const vendor of vendors) {
    for (const name of [vendor.name, ...(vendor.aliases ?? [])]) {
      const candidate = normalizeName(name)
      if (!candidate) continue
      let score = 0
      if (candidate === target) score = 3
      else if (target.startsWith(candidate) || candidate.startsWith(target)) score = 2
      else if (target.includes(candidate) || candidate.includes(target)) score = 1
      if (score > 0 && (!best || score > best.score)) best = { vendor, score }
      if (best?.score === 3) break
    }
    if (best?.score === 3) break
  }
  return best?.vendor ?? null
}
