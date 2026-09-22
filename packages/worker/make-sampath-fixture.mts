// Captures a trimmed Sampath payload for the fixture test.
// Run from the repo: node packages/worker/make-sampath-fixture.mts
import { mkdirSync, writeFileSync } from 'node:fs'

const response = await fetch('https://www.sampath.lk/api/card-promotions', {
  headers: {
    'User-Agent': 'cardstock/0.1 (+https://cardstock.anjula.dev/about)',
    Accept: 'application/json, text/plain, */*',
    Referer: 'https://www.sampath.lk/sampath-cards/credit-card-offer',
    locale: 'en',
    platform: 'web',
  },
})
const json = (await response.json()) as { total?: number; data?: Record<string, unknown>[] }
const rows = json.data ?? []
console.log('live rows:', rows.length)

// A handful covering the categories that matter, kept small for the repo.
const wanted = ['super_markets', 'dining', 'hotels', 'fashion', 'Premium_Offers']
const picked: Record<string, unknown>[] = []
for (const category of wanted) {
  const row = rows.find((candidate) => candidate.category === category)
  if (row) picked.push(row)
}
for (const row of rows) {
  if (picked.length >= 6) break
  if (!picked.includes(row)) picked.push(row)
}

const fixture = { total: json.total ?? rows.length, data: picked }
mkdirSync('sources/sampath/fixtures', { recursive: true })
writeFileSync('sources/sampath/fixtures/list.json', JSON.stringify(fixture, null, 2) + '\n')

for (const row of picked) {
  console.log(`  ${row.id} | ${row.category} | ${row.company_name} | ${row.expire_on}`)
}
