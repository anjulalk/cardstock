// What does the browser send for Sampath's promotions call, and does replaying
// those headers with a plain client work?
// Run from the repo: node packages/worker/probe-sampath-headers.mts
import { closeBrowser } from './src/lib/browser.ts'

const { chromium } = await import('playwright')
const browser = await chromium.launch()
const userAgent =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

const page = await browser.newPage({ userAgent })
let requestHeaders: Record<string, string> | null = null
let requestUrl = ''
const cookies: string[] = []

page.on('request', (request) => {
  if (request.url().includes('/api/card-promotions') && !requestHeaders) {
    requestHeaders = request.headers()
    requestUrl = request.url()
  }
})
page.on('response', async (response) => {
  if (!response.url().includes('/api/card-promotions')) return
  const body = await response.json().catch(() => null)
  if (body && Array.isArray((body as { data?: unknown[] }).data)) {
    console.log('browser saw rows:', (body as { data: unknown[] }).data.length)
  }
})

await page.goto('https://www.sampath.lk/sampath-cards/credit-card-offer?firstTab=super_markets', {
  waitUntil: 'domcontentloaded',
  timeout: 60000,
})
await page.waitForTimeout(9000)
for (const cookie of await page.context().cookies()) cookies.push(`${cookie.name}=${cookie.value}`)

console.log('\nrequest url:', requestUrl)
console.log('request headers:', JSON.stringify(requestHeaders, null, 1))
console.log('cookies:', cookies.length, cookies.map((c) => c.split('=')[0]).join(', '))

await page.close()
await closeBrowser()

if (!requestHeaders) process.exit(0)

// Replay the same call with a plain client.
const replay = await fetch(requestUrl, {
  headers: { ...requestHeaders, 'User-Agent': userAgent, Cookie: cookies.join('; ') },
})
const json = (await replay.json().catch(() => null)) as { data?: unknown[]; total?: number } | null
console.log('\nreplayed status:', replay.status)
console.log('replayed total:', json?.total, 'rows:', Array.isArray(json?.data) ? json.data.length : 'n/a')
