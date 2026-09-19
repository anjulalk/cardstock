import { readdirSync } from 'node:fs'
import { fetchHnb, loadContract, type SourceContract } from './adapters/hnb.ts'
import { sourcesDir } from './paths.ts'

/** Live probe. A fixture proves the parser still reads the shape it was written
 *  for; this proves the shape is still there. Run it daily so a redesign shows
 *  up as a failed job rather than a quiet gap in the data. */

type Prober = (contract: SourceContract) => Promise<number>

const PROBES: Record<string, Prober> = {
  hnb: async (contract) => (await fetchHnb(contract)).length,
}

async function main(): Promise<void> {
  const contracts = readdirSync(sourcesDir).filter((file) => file.endsWith('.json'))
  const failures: string[] = []

  for (const file of contracts) {
    const id = file.replace(/\.json$/, '')
    const prober = PROBES[id]
    if (!prober) {
      console.log(`[${id}] no probe yet`)
      continue
    }
    const contract = loadContract(id)
    const floor = contract.guards?.minItems ?? 1
    try {
      const count = await prober(contract)
      const ok = count >= floor
      console.log(`[${id}] ${ok ? 'PASS' : 'FAIL'} ${count} items, floor ${floor}`)
      if (!ok) failures.push(`${id}: ${count} items, floor ${floor}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.log(`[${id}] FAIL ${message}`)
      failures.push(`${id}: ${message}`)
    }
  }

  if (failures.length > 0) {
    console.error('\nProbe failed:\n - ' + failures.join('\n - '))
    process.exit(1)
  }
  console.log('\nAll sources answered.')
}

await main()
