// What merchant names do the banks actually publish, and how many of them does
// the registry currently match?
// Run from the repo: node packages/worker/report-vendors.mts
import { readFileSync } from 'node:fs'

const rows = readFileSync('data/offers.jsonl', 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line) as { bank: string; vendor: string | null; vendorHint: string | null; category: string | null; title: string })

const matched = rows.filter((row) => row.vendor)
const unmatched = rows.filter((row) => !row.vendor)
console.log('offers:', rows.length, '| matched:', matched.length, '| unmatched:', unmatched.length)

const byHint = new Map<string, { count: number; banks: Set<string>; categories: Set<string> }>()
for (const row of unmatched) {
  const hint = (row.vendorHint ?? '').trim()
  if (!hint) continue
  const entry = byHint.get(hint) ?? { count: 0, banks: new Set<string>(), categories: new Set<string>() }
  entry.count += 1
  entry.banks.add(row.bank)
  if (row.category) entry.categories.add(row.category)
  byHint.set(hint, entry)
}

console.log('\n--- unmatched merchant names, most common first ---')
const sorted = [...byHint.entries()].sort((a, b) => b[1].count - a[1].count)
for (const [hint, entry] of sorted.slice(0, 60)) {
  console.log(
    `${String(entry.count).padStart(3)} ${[...entry.banks].join(',').padEnd(9)} ${[...entry.categories].join(',').padEnd(14)} ${hint.slice(0, 62)}`,
  )
}
console.log('\ndistinct unmatched names:', sorted.length)
