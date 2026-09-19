import { decodeMonthOffer } from '@shared/chunks.ts'
import type { CardProduct, Manifest, MonthChunk, MonthOffer } from '@shared/types.ts'

/** The client half of the data contract: everything is resolved from the
 *  manifest, so no URL is ever composed by hand here. Requests are deduped per
 *  URL, which matters because the calendar and the list ask for the same month. */

const dataBase = `${import.meta.env.BASE_URL}data/`
const inflight = new Map<string, Promise<unknown>>()
/** Decoded offers per chunk file, so moving back and forth costs nothing. */
const fileCache = new Map<string, MonthOffer[]>()

let manifest: Manifest | null = null

function load<T>(path: string, fresh = false): Promise<T> {
  const url = dataBase + path
  const existing = inflight.get(url) as Promise<T> | undefined
  if (existing) return existing
  const promise = fetch(url, fresh ? { cache: 'no-cache' } : undefined)
    .then((response) => {
      if (!response.ok) throw new Error(`${response.status} for ${url}`)
      return response.json() as Promise<T>
    })
    .finally(() => inflight.delete(url))
  inflight.set(url, promise)
  return promise
}

export async function loadManifest(): Promise<Manifest> {
  // The manifest is the one file that must never come from cache: it is how a
  // new dataVersion is noticed.
  manifest = await load<Manifest>('index.json', true)
  return manifest
}

export function getManifest(): Manifest | null {
  return manifest
}

export async function loadCards(): Promise<CardProduct[]> {
  if (!manifest) throw new Error('the manifest must load first')
  return load<CardProduct[]>(manifest.chunks.cards.url)
}

async function loadMonthFile(url: string): Promise<MonthOffer[]> {
  const cached = fileCache.get(url)
  if (cached) return cached
  const chunk = await load<MonthChunk>(url)
  const offers = chunk.entries.map((entry) => decodeMonthOffer(entry, manifest!.sourceTemplates))
  fileCache.set(url, offers)
  return offers
}

/** A month is published one file per bank, so the caller says which banks it
 *  cares about. Leaving them out fetches the whole month. */
export async function loadMonth(key: string, banks?: string[]): Promise<MonthOffer[]> {
  if (!manifest) throw new Error('the manifest must load first')
  const ref = manifest.chunks.months[key]
  if (!ref) return []
  const wanted =
    banks && banks.length > 0 ? banks.filter((bank) => ref.banks[bank]) : Object.keys(ref.banks)
  const parts = await Promise.all(wanted.map((bank) => loadMonthFile(ref.banks[bank]!.url)))
  return parts.flat()
}

/** The months that cover a range, so "next 30 days" is derived, not guessed. */
export function monthsFor(from: string, to: string): string[] {
  if (!manifest) return []
  const keys: string[] = []
  let key = from.slice(0, 7)
  const last = to.slice(0, 7)
  while (key <= last) {
    if (manifest.chunks.months[key]) keys.push(key)
    const [year, month] = key.split('-').map(Number) as [number, number]
    const next = year * 12 + month
    key = `${Math.floor(next / 12)}-${String((next % 12) + 1).padStart(2, '0')}`
  }
  return keys
}
