import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { todayIso } from '../../shared/src/index.ts'
import type { Offer } from '../../shared/src/index.ts'
import { fetchAmana } from './adapters/amana.ts'
import { fetchBoc } from './adapters/boc.ts'
import { fetchCombank } from './adapters/combank.ts'
import { fetchDfcc } from './adapters/dfcc.ts'
import { fetchHnb } from './adapters/hnb.ts'
import { fetchNdb } from './adapters/ndb.ts'
import { fetchNtb } from './adapters/ntb.ts'
import { fetchPanasia } from './adapters/panasia.ts'
import { fetchPeoples } from './adapters/peoples.ts'
import { fetchSampath } from './adapters/sampath.ts'
import { fetchSeylan } from './adapters/seylan.ts'
import { fetchUnionBrowser } from './adapters/union.ts'
import { browserAvailable, closeBrowser } from './lib/browser.ts'
import { loadContract, type SourceContract } from './contract.ts'
import { buildOffer, type Draft } from './normalize.ts'
import { dataDir, sourcesDir } from './paths.ts'
import { validateSource, type Guards } from './validate.ts'

type Fetcher = (contract: SourceContract) => Promise<Draft[]>

/** Fetched with a plain client. */
const FETCHERS: Record<string, Fetcher> = {
  hnb: fetchHnb,
  ntb: fetchNtb,
  seylan: fetchSeylan,
  boc: fetchBoc,
  ndb: fetchNdb,
  amana: fetchAmana,
  peoples: fetchPeoples,
  combank: fetchCombank,
  sampath: fetchSampath,
}

/** Fetched with a browser, because a WAF or a client side render stands in the
 *  way of a plain client. Skipped when Playwright is not installed. */
const BROWSER_FETCHERS: Record<string, Fetcher> = {
  union: fetchUnionBrowser,
  panasia: fetchPanasia,
}

void fetchDfcc

interface RunRecord {
  source: string
  at: string
  offers: number
  ms: number
  ok: boolean
  /** Why a source was unavailable, when it was. */
  error?: string
}

function readJson<T>(file: string, fallback: T): T {
  const path = resolve(dataDir, file)
  if (!existsSync(path)) return fallback
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

/** Last run's output, read before this run overwrites it. Used for the guards
 *  and to carry forward sources that have no adapter yet. */
function readOffers(): Offer[] {
  const path = resolve(dataDir, 'offers.jsonl')
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Offer)
}

function appendRun(record: RunRecord): void {
  mkdirSync(dataDir, { recursive: true })
  const history = readJson<RunRecord[]>('runs.json', [])
  history.push(record)
  writeFileSync(resolve(dataDir, 'runs.json'), JSON.stringify(history.slice(-200), null, 2) + '\n')
}

async function main(): Promise<void> {
  const now = new Date().toISOString()
  const today = todayIso()
  const previous = readOffers()
  // In CI there is no offers.jsonl to compare against, so fall back to the
  // committed counts from the last run. The guard still catches a source that
  // suddenly returns half of what it did yesterday.
  const previousCounts =
    previous.length > 0
      ? null
      : readJson<{ sources?: Record<string, number> }>('latest.json', {}).sources ?? null
  const contracts = readdirSync(sourcesDir).filter((file) => file.endsWith('.json'))

  const produced: Offer[] = []
  const touched = new Set<string>()

  for (const file of contracts) {
    const id = file.replace(/\.json$/, '')
    const contract = loadContract(id)

    // A browser source needs a browser. Without one it is skipped with the
    // reason, so a plain npm run sync still works on a machine without Chromium.
    let fetcher = FETCHERS[id]
    if (contract.kind === 'browser') {
      if (!(await browserAvailable())) {
        console.log(`[${id}] needs a browser runner, skipping${contract.blocked ? `: ${contract.blocked}` : ''}`)
        continue
      }
      fetcher = BROWSER_FETCHERS[id]
      if (!fetcher) {
        console.log(`[${id}] the browser runner has no fetcher for this source yet, skipping`)
        continue
      }
    }

    if (!fetcher) {
      console.log(`[${id}] no adapter yet, skipping`)
      continue
    }

    const started = Date.now()
    let drafts: Draft[] = []
    try {
      drafts = await fetcher(contract)
    } catch (error) {
      // Availability is not quality. A source the runner cannot reach, because a
      // datacenter IP is refused where a home one is not, must not stop the other
      // banks from publishing. The run log records it and the daily probe is what
      // fails loudly about it.
      const message = (error instanceof Error ? error.message : String(error)).slice(0, 200)
      const ms = Date.now() - started
      console.error(`[${id}] unavailable this run: ${message}`)
      appendRun({ source: id, at: now, offers: 0, ms, ok: false, error: message })
      continue
    }

    const offers = drafts.map((draft) => buildOffer(draft, now, today))
    const guards: Guards = contract.guards ?? {}

    // The same reasoning for a source that answers with nothing at all: no bank
    // legitimately publishes none, so this is a block or a redesign, and the
    // probe is the alarm rather than this run.
    if (offers.length === 0) {
      const ms = Date.now() - started
      console.error(`[${id}] answered with no offers, treating it as unavailable this run`)
      appendRun({ source: id, at: now, offers: 0, ms, ok: false, error: 'no offers' })
      continue
    }

    const problems = validateSource(id, offers, previous, guards)

    const baseline = previousCounts?.[id]
    if (baseline && baseline > 0 && guards.maxDropRatio !== undefined) {
      const drop = 1 - offers.length / baseline
      if (drop > guards.maxDropRatio) {
        problems.push(
          `${id}: ${offers.length} offers against ${baseline} last run (${Math.round(drop * 100)}% drop)`,
        )
      }
    }

    const ms = Date.now() - started

    // The guards decide what is published, not whether the run survives. A
    // source that trips one sits this run out: its previous offers stay in the
    // store and on the site, and data/runs.json carries the reason. The probe
    // is what fails loudly about a source that has gone.
    if (problems.length > 0) {
      const reason = problems.join('; ').slice(0, 300)
      console.error(`[${id}] skipped this run: ${reason}`)
      appendRun({ source: id, at: now, offers: 0, ms, ok: false, error: reason })
      continue
    }

    console.log(`[${id}] ${offers.length} offers in ${ms}ms`)
    appendRun({ source: id, at: now, offers: offers.length, ms, ok: true })
    produced.push(...offers)
    touched.add(id)
  }

  if (produced.length === 0) {
    await closeBrowser()
    console.error('\nNo source answered. Nothing was written.')
    process.exit(1)
  }

  const kept = previous.filter((offer) => !touched.has(offer.source))
  const merged = [...kept, ...produced]
  // HNB's feed can publish the same promotion id twice, so the canonical store
  // keeps one row per offer and the last reading wins.
  const unique = [...new Map(merged.map((offer) => [offer.id, offer])).values()].sort((a, b) =>
    a.id.localeCompare(b.id),
  )
  const duplicates = merged.length - unique.length

  mkdirSync(dataDir, { recursive: true })
  writeFileSync(resolve(dataDir, 'offers.jsonl'), unique.map((offer) => JSON.stringify(offer)).join('\n') + '\n')
  writeFileSync(
    resolve(dataDir, 'latest.json'),
    JSON.stringify(
      {
        generatedAt: now,
        today,
        offers: unique.length,
        duplicates: duplicates > 0 ? duplicates : undefined,
        // Every source still in the store, not only this run's, so the counts
        // stay a usable baseline for a run that starts from a fresh checkout.
        sources: Object.fromEntries(
          [...new Set(unique.map((offer) => offer.source))]
            .sort()
            .map((id) => [id, unique.filter((offer) => offer.source === id).length]),
        ),
      },
      null,
      2,
    ) + '\n',
  )

  const active = unique.filter((offer) => offer.status === 'active').length
  const unconfirmed = unique.filter((offer) => offer.status === 'unconfirmed').length
  console.log(
    `\nwrote ${unique.length} offers (${active} active, ${unconfirmed} unconfirmed)${duplicates > 0 ? `, dropped ${duplicates} duplicate id(s)` : ''}`,
  )
  console.log(`kept ${kept.length} offers from sources that sat this run out`)
  await closeBrowser()
}

await main()
