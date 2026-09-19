import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  CONTRACT,
  MONTH_FIELDS,
  addMonths,
  monthKey,
  monthRange,
  qualifyingDays,
  todayIso,
} from '../../shared/src/index.ts'
import type { Facet, Manifest, MonthChunk, Offer, VendorFacet } from '../../shared/src/index.ts'
import { loadContract } from './contract.ts'
import { banks, cards, categories, vendors } from './registry.ts'
import { dataDir, sourcesDir, webDataDir } from './paths.ts'
import { validateChunks } from './validate.ts'

/** How much past is still served, and how far ahead is published. The three
 *  months back keep "what did I just miss" answerable; the six forward keep the
 *  payload bounded. */
const BACK_MONTHS = 3
const FORWARD_MONTHS = 6

function readOffers(): Offer[] {
  const path = resolve(dataDir, 'offers.jsonl')
  if (!existsSync(path)) {
    console.error('data/offers.jsonl is missing. Run npm run sync first.')
    process.exit(1)
  }
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Offer)
}

const dayOf = (iso: string) => Number(iso.slice(8, 10))
const max = (a: string, b: string) => (a > b ? a : b)
const min = (a: string, b: string) => (a < b ? a : b)

function lastDayOf(key: string): number {
  const [year, month] = key.split('-').map(Number) as [number, number]
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** One offer as a positional row. Keys are gone, so an entry costs roughly the
 *  title plus its identifiers rather than twelve field names. */
function toEntry(offer: Offer, days: number[]): unknown[] {
  const discount = offer.discount
  return [
    offer.id,
    offer.title,
    offer.vendor,
    offer.vendorHint,
    offer.category,
    [offer.bank],
    offer.tiers,
    offer.networks,
    offer.cardTypes,
    discount ? [discount.kind, discount.value, discount.cap, discount.minSpend] : null,
    offer.validFrom,
    offer.validTo,
    days,
    offer.termsText,
  ]
}

function countFacet(ids: string[], names: Map<string, string>): Facet[] {
  const counts = new Map<string, number>()
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1)
  return [...counts.entries()]
    .map(([id, count]) => ({ id, name: names.get(id) ?? id, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

function main(): void {
  const offers = readOffers()
  const today = todayIso()
  const window = {
    from: addMonths(monthKey(today), -BACK_MONTHS),
    to: addMonths(monthKey(today), FORWARD_MONTHS),
  }

  const months = new Map<string, MonthChunk>()
  const published = new Set<string>()
  const inWindow: Offer[] = []

  for (const offer of offers) {
    // Nothing without an end date can be placed on a calendar.
    if (offer.status === 'unconfirmed' || !offer.validTo) continue

    // A source that publishes only an end date (HNB's feeds do) leaves the
    // start unknown. The current month is the honest floor: the offer was
    // published, so it is running, and the month is where a visitor looks.
    const from = offer.validFrom ?? `${monthKey(today)}-01`
    const to = offer.validTo
    if (to < `${window.from}-01` || from > `${window.to}-31`) continue

    const clampedFrom = max(from, `${window.from}-01`)
    const clampedTo = min(to, `${window.to}-31`)
    const keys = monthRange(clampedFrom, clampedTo, window)
    if (keys.length === 0) continue

    for (const key of keys) {
      const segmentFrom = max(clampedFrom, `${key}-01`)
      const segmentTo = min(clampedTo, `${key}-${String(lastDayOf(key)).padStart(2, '0')}`)
      if (segmentFrom > segmentTo) continue

      const days = qualifyingDays(segmentFrom, segmentTo, offer.days, offer.dates).map(dayOf)
      if (days.length === 0) continue

      const chunk = months.get(key) ?? { month: key, fields: [...MONTH_FIELDS], entries: [] }
      chunk.entries.push(toEntry(offer, [...new Set(days)].sort((a, b) => a - b)))
      months.set(key, chunk)
      published.add(offer.id)
    }

    inWindow.push(offer)
  }

  const version = createHash('sha1').update(JSON.stringify(offers)).digest('hex').slice(0, 10)

  rmSync(webDataDir, { recursive: true, force: true })
  mkdirSync(resolve(webDataDir, 'm'), { recursive: true })

  const monthRefs: Manifest['chunks']['months'] = {}
  for (const key of [...months.keys()].sort()) {
    const chunk = months.get(key)!
    const payload = JSON.stringify(chunk)
    const file = `m/${key}.${version}.json`
    writeFileSync(resolve(webDataDir, file), payload)
    monthRefs[key] = { url: file, bytes: Buffer.byteLength(payload), offers: chunk.entries.length }
  }

  // The card list is small and the picker cannot work without it, so it ships
  // as its own chunk rather than bloating the manifest.
  const cardsPayload = JSON.stringify(cards)
  writeFileSync(resolve(webDataDir, `cards.${version}.json`), cardsPayload)

  const bankNames = new Map(banks.map((bank) => [bank.id, bank.name]))
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]))
  const vendorNames = new Map(vendors.map((vendor) => [vendor.id, vendor.name]))

  const vendorFacets: VendorFacet[] = [
    ...inWindow
      .filter((offer) => offer.vendor)
      .reduce((acc, offer) => {
        const id = offer.vendor!
        const entry =
          acc.get(id) ?? { id, name: vendorNames.get(id) ?? id, category: offer.category ?? 'other', count: 0 }
        entry.count += 1
        acc.set(id, entry)
        return acc
      }, new Map<string, VendorFacet>())
      .values(),
  ].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

  const tierIds = [...new Set(inWindow.flatMap((offer) => offer.tiers))]

  const sourceTemplates: Record<string, string> = {}
  for (const file of readdirSync(sourcesDir).filter((name) => name.endsWith('.json'))) {
    const id = file.replace(/\.json$/, '')
    sourceTemplates[id] = loadContract(id).sourceUrlTemplate
  }

  const manifest: Manifest = {
    contract: CONTRACT,
    minClient: CONTRACT,
    dataVersion: version,
    generatedAt: new Date().toISOString(),
    window,
    counts: { offers: published.size, vendors: vendorFacets.length, cards: cards.length },
    facets: {
      banks: countFacet(
        inWindow.map((offer) => offer.bank),
        bankNames,
      ),
      categories: countFacet(
        inWindow.map((offer) => offer.category ?? 'other'),
        categoryNames,
      ),
      tiers: countFacet(tierIds, new Map(tierIds.map((tier) => [tier, tier]))),
      vendors: vendorFacets,
    },
    sourceTemplates,
    chunks: {
      cards: { url: `cards.${version}.json`, bytes: Buffer.byteLength(cardsPayload) },
      months: monthRefs,
    },
  }

  writeFileSync(resolve(webDataDir, 'index.json'), JSON.stringify(manifest, null, 2) + '\n')

  const problems = validateChunks(manifest, months, window)
  if (problems.length > 0) {
    console.error('Chunk validation failed:\n - ' + problems.join('\n - '))
    process.exit(1)
  }

  const totalBytes = Object.values(monthRefs).reduce((sum, ref) => sum + ref.bytes, 0)
  console.log(
    `chunks: ${published.size} offers across ${Object.keys(monthRefs).length} months, ${(totalBytes / 1024).toFixed(0)} KB total, version ${version}`,
  )
  for (const [key, ref] of Object.entries(monthRefs)) {
    console.log(`  ${key}: ${ref.offers} offers, ${(ref.bytes / 1024).toFixed(1)} KB`)
  }
}

main()
