import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { sourcesDir } from './paths.ts'

/** One file per bank in sources/, and the only place a source's boundaries are
 *  declared. The parsing lives in the adapter next to it. */
export interface SourceContract {
  id: string
  name: string
  kind: 'api' | 'html' | 'browser'
  /** Why a browser source cannot be fetched yet, for the run log. */
  blocked?: string
  policy: {
    robots?: string
    delayMs?: number
    userAgent: string
  }
  requests: Array<{ name: string; url: string; params?: Record<string, string | number> }>
  /** How to build an offer's page from its id, published in the manifest. */
  sourceUrlTemplate: string
  imageBase?: string
  /** HTML sources: where one card starts in the markup, as a literal. */
  itemMarker?: string
  /** HTML sources: the same, as a regex source, for markup where the useful
   *  boundary (an anchor's href) comes before the class name. */
  itemPattern?: string
  /** HTML sources: the site's own category classes, mapped to ours. */
  categoryMap?: Record<string, string>
  /** A listing that pages through `rel="next"` links. */
  pagination?: { param?: string; maxPages?: number }
  cadence?: string
  guards?: { minItems?: number; maxDropRatio?: number; requireFields?: string[] }
}

export function loadContract(id: string): SourceContract {
  return JSON.parse(readFileSync(resolve(sourcesDir, `${id}.json`), 'utf8')) as SourceContract
}
