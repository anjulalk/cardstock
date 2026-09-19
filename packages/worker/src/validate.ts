import { MONTH_FIELDS } from '../../shared/src/index.ts'
import type { Manifest, MonthChunk, Offer } from '../../shared/src/index.ts'

export interface Guards {
  minItems?: number
  maxDropRatio?: number
  requireFields?: string[]
}

/** Guards that run before anything is committed. A source that suddenly
 *  returns half its offers is a broken parser, not a quiet week. */
export function validateSource(
  source: string,
  offers: Offer[],
  previous: Offer[],
  guards: Guards,
): string[] {
  const errors: string[] = []

  const floor = guards.minItems ?? 0
  if (offers.length < floor) {
    errors.push(`${source}: ${offers.length} offers, the floor is ${floor}`)
  }

  for (const field of guards.requireFields ?? []) {
    const missing = offers.filter((offer) => {
      const value = (offer as unknown as Record<string, unknown>)[field]
      return value === null || value === undefined || String(value).trim() === ''
    }).length
    if (missing > 0) errors.push(`${source}: ${missing} offers are missing ${field}`)
  }

  const prior = previous.filter((offer) => offer.source === source)
  if (prior.length > 0 && guards.maxDropRatio !== undefined) {
    const ids = new Set(offers.map((offer) => offer.id))
    const lost = prior.filter((offer) => !ids.has(offer.id)).length
    const ratio = lost / prior.length
    if (ratio > guards.maxDropRatio) {
      errors.push(
        `${source}: lost ${lost} of ${prior.length} offers (${Math.round(ratio * 100)}%), the limit is ${Math.round(guards.maxDropRatio * 100)}%`,
      )
    }
  }

  return errors
}

/** The chunk builder's own check: the manifest and the chunks it names must
 *  agree, and every entry must be usable by the client without further work. */
export function validateChunks(
  manifest: Manifest,
  months: Map<string, MonthChunk>,
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

  for (const [key, ref] of Object.entries(manifest.chunks.months)) {
    if (key < window.from || key > window.to) {
      errors.push(`manifest: month ${key} sits outside the window`)
    }
    if (!ref.url || ref.bytes <= 0) errors.push(`manifest: month ${key} has no usable ref`)
    if (!months.has(key)) errors.push(`manifest: month ${key} is listed but was not built`)
  }
  for (const key of months.keys()) {
    if (!manifest.chunks.months[key]) errors.push(`chunk ${key} was built but is not listed`)
  }

  const ids = new Set<string>()
  for (const [key, chunk] of months) {
    if (chunk.entries.length === 0) errors.push(`chunk ${key}: no offers`)
    if (chunk.fields.length !== MONTH_FIELDS.length) {
      errors.push(`chunk ${key}: the field header has ${chunk.fields.length} names`)
    }
    for (const entry of chunk.entries) {
      const id = String(entry[0])
      if (!id) errors.push(`chunk ${key}: an entry has no id`)
      if (!Array.isArray(entry[12]) || (entry[12] as unknown[]).length === 0) {
        errors.push(`chunk ${key}: ${id} has no days`)
      }
      ids.add(id)
    }
    if (chunk.entries.length !== manifest.chunks.months[key]?.offers) {
      errors.push(`chunk ${key}: entry count does not match the manifest ref`)
    }
  }

  if (manifest.counts.offers !== ids.size) {
    errors.push(`manifest: counts.offers is ${manifest.counts.offers}, the chunks hold ${ids.size}`)
  }

  return errors
}
