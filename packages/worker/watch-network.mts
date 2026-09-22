// Watches the requests a browser makes on the two sources that still resist a
// plain client, and prints what looks like data.
// Run from the repo: node packages/worker/watch-network.mts
import { closeBrowser } from './src/lib/browser.ts'

const { chromium } = await import('playwright')
const browser = await chromium.launch()
const userAgent =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

const targets = [
  { name: 'dfcc', url: 'https://www.dfcc.lk/cards/credit-card-promotions/supermarket' },
  { name: 'sampath', url: 'https://www.sampath.lk/sampath-cards/credit-card-offer?firstTab=super_markets' },
]

for (const target of targets) {
  console.log(`\n=== ${target.name} ===`)
  const page = await browser.newPage({ userAgent })
  const interesting: Array<{ url: string; status: number; type: string }> = []

  page.on('response', (response) => {
    const url = response.url()
    if (!/api|promotion|offer|graphql|\.json|card/i.test(url)) return
    if (/\.(png|jpg|jpeg|svg|webp|css|woff2?)$/i.test(url)) return
    interesting.push({ url, status: response.status(), type: response.headers()['content-type'] ?? '' })
  })

  await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForLoadState('networkidle', { timeout: 45000 }).catch(() => undefined)
  await page.waitForTimeout(6000)
  await page.mouse.wheel(0, 3000)
  await page.waitForTimeout(4000)

  const html = await page.content()
  console.log('cards in the rendered page:', (html.match(/class="cardd"|flip-card|offer-card/g) ?? []).length)

  const seen = new Set<string>()
  for (const entry of interesting.slice(-25)) {
    const key = entry.url.split('?')[0]!
    if (seen.has(key + entry.status)) continue
    seen.add(key + entry.status)
    console.log(`  ${String(entry.status).padEnd(4)} ${entry.type.split(';')[0].padEnd(18)} ${entry.url.slice(0, 110)}`)
  }

  await page.close()
}

await closeBrowser()
