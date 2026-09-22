const response = await fetch('https://www.sampath.lk/api/card-promotions', {
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    Accept: 'application/json, text/plain, */*',
    Referer: 'https://www.sampath.lk/sampath-cards/credit-card-offer',
    locale: 'en',
    platform: 'web',
  },
})
const json = (await response.json()) as { data?: Record<string, unknown>[] }
const rows = json.data ?? []

const categories = new Map<string, number>()
for (const row of rows) {
  const key = String(row.category ?? '(none)')
  categories.set(key, (categories.get(key) ?? 0) + 1)
}
console.log('categories:')
for (const [name, count] of [...categories.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(String(count).padStart(4), name)
}

console.log('\nexpire_on samples:')
for (const row of rows.slice(0, 3)) {
  const ms = Number(row.expire_on)
  console.log(' ', row.expire_on, '->', Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : 'unparsed')
}

console.log('\none description, stripped:')
const raw = String(rows.find((row) => String(row.description ?? '').length > 40)?.description ?? '')
console.log(' ', raw.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').slice(0, 260))

console.log('\none calendar url:')
console.log(' ', String(rows[1]?.calender_url ?? '').slice(0, 200))
