import { MONTH_FIELDS } from '../../shared/src/index.ts'
import type { Manifest, MonthChunk, Offer } from '../../shared/src/index.ts'

export interface Guards {
  minItems?: number
  maxDropRatio?: number
  requireFields?: string[]
}

/** Guards that decide whether a source's fresh answer is published. The reasons
 *  they return leave that source out of this run: a source that suddenly returns
 *  half its offers is a broken parser, not a quiet week, and half a list is
 *  worse than the last good one. */
export function validateSource(
  source: string,
  offers: Offer[],
  previous: Offer[],
  guards: Guards,
): string[] {
  const reasons: string[] = []

  const floor = guards.minItems ?? 0
  if (offers.length < floor) {
    reasons.push(`${source}: ${offers.length} offers, the floor is ${floor}`)
  }

  for (const field of guards.requireFields ?? []) {
    const missing = offers.filter((offer) => {
      const value = (offer as unknown as Record<string, unknown>)[field]
      return value === null || value === undefined || String(value).trim() === ''
    }).length
    if (missing > 0) reasons.push(`${source}: ${missing} offers are missing ${field}`)
  }

  const prior = previous.filter((offer) => offer.source === source)
  if (prior.length > 0 && guards.maxDropRatio !== undefined) {
    const ids = new Set(offers.map((offer) => offer.id))
    const lost = prior.filter((offer) => !ids.has(offer.id)).length
    const ratio = lost / prior.length
    if (ratio > guards.maxDropRatio) {
      reasons.push(
        `${source}: lost ${lost} of ${prior.length} offers (${Math.round(ratio * 100)}%), the limit is ${Math.round(guards.maxDropRatio * 100)}%`,
      )
    }
  }

  return reasons
}

/** The chunk builder's own check: the manifest and the chunks it names must
 *  agree, and every entry must be usable by the client without further work. */
export function validateChunks(
  manifest: Manifest,
  months: Map<string, Map<string, MonthChunk>>,
  window: { from: string; to: string },
): string[] {
  const errors: string[] = []

  if (manifest.contract < 1) errors.push('manifest: contract must be at least 1')
  if (!manifest.dataVersion) errors.push('manifest: dataVersion is empty')
  if (manifest.window.from !== window.from || manifest.window.to !== window.to) {
    errors.push('manifest: window does not match the published range')
  }
  if (Object.keys(manifest.sourceTemplates).length === 0) {
    errors.push('manifest: no source templates, so offer links cannot be built')
  }

  const ids = new Set<string>()

  for (const [key, ref] of Object.entries(manifest.chunks.months)) {
    if (key < window.from || key > window.to) {
      errors.push(`manifest: month ${key} sits outside the window`)
    }
    const byBank = months.get(key)
    if (!byBank) {
      errors.push(`manifest: month ${key} is listed but was not built`)
      continue
    }

    const monthIds = new Map<string, string>()
    for (const [bank, bankRef] of Object.entries(ref.banks)) {
      const chunk = byBank.get(bank)
      if (!chunk) {
        errors.push(`manifest: ${key} lists ${bank}, which was not built`)
        continue
      }
      if (!bankRef.url || bankRef.bytes <= 0) errors.push(`manifest: ${key}/${bank} has no usable ref`)
      if (bankRef.offers !== chunk.entries.length) {
        errors.push(`manifest: ${key}/${bank} claims ${bankRef.offers} entries, built ${chunk.entries.length}`)
      }
      if (chunk.fields.length !== MONTH_FIELDS.length) {
        errors.push(`chunk ${key}/${bank}: the field header has ${chunk.fields.length} names`)
      }
      const bankIds = new Set<string>()
      for (const entry of chunk.entries) {
        const id = String(entry[0])
        if (!id) errors.push(`chunk ${key}/${bank}: an entry has no id`)
        if (!Array.isArray(entry[12]) || (entry[12] as unknown[]).length === 0) {
          errors.push(`chunk ${key}/${bank}: ${id} has no days`)
        }
        if (bankIds.has(id)) errors.push(`chunk ${key}/${bank}: ${id} appears twice`)
        bankIds.add(id)

        // An offer belongs to one bank, so a month must not repeat an id either.
        const seenIn = monthIds.get(id)
        if (seenIn) errors.push(`chunk ${key}: ${id} appears under ${seenIn} and ${bank}`)
        else monthIds.set(id, bank)
        ids.add(id)
      }
    }

    for (const bank of byBank.keys()) {
      if (!ref.banks[bank]) errors.push(`chunk ${key}/${bank} was built but is not listed`)
    }
  }

  if (manifest.counts.offers !== ids.size) {
    errors.push(`manifest: counts.offers is ${manifest.counts.offers}, the chunks hold ${ids.size}`)
  }

  return errors
}
