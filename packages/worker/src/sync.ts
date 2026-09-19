import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { todayIso } from '../../shared/src/index.ts'
import type { Offer } from '../../shared/src/index.ts'
import { fetchHnb } from './adapters/hnb.ts'
import { fetchNtb } from './adapters/ntb.ts'
import { loadContract, type SourceContract } from './contract.ts'
import { buildOffer, type Draft } from './normalize.ts'
import { dataDir, sourcesDir } from './paths.ts'
import { validateSource, type Guards } from './validate.ts'

type Fetcher = (contract: SourceContract) => Promise<Draft[]>

/** One entry per source that has an adapter. Adding a bank means adding a
 *  contract file and one line here. */
const FETCHERS: Record<string, Fetcher> = { hnb: fetchHnb, ntb: fetchNtb }

interface RunRecord {
  source: string
  at: string
  offers: number
  ms: number
  ok: boolean
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
  const errors: string[] = []

  for (const file of contracts) {
    const id = file.replace(/\.json$/, '')
    const fetcher = FETCHERS[id]
    if (!fetcher) {
      console.log(`[${id}] no adapter yet, skipping`)
      continue
    }

    const contract = loadContract(id)
    const started = Date.now()
    const drafts = await fetcher(contract)
    const offers = drafts.map((draft) => buildOffer(draft, now, today))
    const guards: Guards = contract.guards ?? {}
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

    if (problems.length > 0) {
      errors.push(...problems)
      console.error(`[${id}] guards failed: ${problems.join('; ')}`)
    } else {
      console.log(`[${id}] ${offers.length} offers in ${ms}ms`)
    }

    appendRun({ source: id, at: now, offers: offers.length, ms, ok: problems.length === 0 })
    produced.push(...offers)
    touched.add(id)
  }

  if (errors.length > 0) {
    console.error('\nValidation failed. Nothing was written.')
    process.exit(1)
  }

  const kept = previous.filter((offer) => !touched.has(offer.source))
  const merged = [...kept, ...produced].sort((a, b) => a.id.localeCompare(b.id))

  mkdirSync(dataDir, { recursive: true })
  writeFileSync(resolve(dataDir, 'offers.jsonl'), merged.map((offer) => JSON.stringify(offer)).join('\n') + '\n')
  writeFileSync(
    resolve(dataDir, 'latest.json'),
    JSON.stringify(
      {
        generatedAt: now,
        today,
        offers: merged.length,
        sources: Object.fromEntries(
          [...touched].map((id) => [id, merged.filter((offer) => offer.source === id).length]),
        ),
      },
      null,
      2,
    ) + '\n',
  )

  const active = merged.filter((offer) => offer.status === 'active').length
  const unconfirmed = merged.filter((offer) => offer.status === 'unconfirmed').length
  console.log(`\nwrote ${merged.length} offers (${active} active, ${unconfirmed} unconfirmed)`)
  console.log(`kept ${kept.length} offers from sources without an adapter`)
}

await main()
