import { decodeMonthOffer } from '@shared/chunks.ts'
import type { CardProduct, Manifest, MonthChunk, MonthOffer } from '@shared/types.ts'

/** The client half of the data contract: everything is resolved from the
 *  manifest, so no URL is ever composed by hand here. Requests are deduped per
 *  URL, which matters because the calendar and the list ask for the same month. */

const dataBase = `${import.meta.env.BASE_URL}data/`
const inflight = new Map<string, Promise<unknown>>()
/** Decoded months, keyed by file, so moving back and forth costs nothing. */
const monthCache = new Map<string, MonthOffer[]>()

let manifest: Manifest | null = null

function load<T>(path: string): Promise<T> {
  const url = dataBase + path
  const existing = inflight.get(url) as Promise<T> | undefined
  if (existing) return existing
  const promise = fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error(`${response.status} for ${url}`)
      return response.json() as Promise<T>
    })
    .finally(() => inflight.delete(url))
  inflight.set(url, promise)
  return promise
}

export async function loadManifest(): Promise<Manifest> {
  manifest = await load<Manifest>('index.json')
  return manifest
}

export function getManifest(): Manifest | null {
  return manifest
}

export async function loadCards(): Promise<CardProduct[]> {
  if (!manifest) throw new Error('the manifest must load first')
  return load<CardProduct[]>(manifest.chunks.cards.url)
}

export async function loadMonth(key: string): Promise<MonthOffer[]> {
  if (!manifest) throw new Error('the manifest must load first')
  const ref = manifest.chunks.months[key]
  if (!ref) return []
  const cached = monthCache.get(ref.url)
  if (cached) return cached
  const chunk = await load<MonthChunk>(ref.url)
  const decoded = chunk.entries.map((entry) => decodeMonthOffer(entry, manifest!.sourceTemplates))
  monthCache.set(ref.url, decoded)
  return decoded
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
