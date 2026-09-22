// One short pass: does DFCC render its hub page, and what shape does Sampath's
// own JSON response have?
// Run from the repo: node packages/worker/probe-two.mts
import { renderHtml, captureJson, closeBrowser } from './src/lib/browser.ts'

const userAgent =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

const dfcc = await renderHtml('https://www.dfcc.lk/cards/credit-card-promotions', {
  userAgent,
  idleMs: 6000,
})
console.log('dfcc hub cards:', (dfcc.match(/class="cardd"/g) ?? []).length)
console.log('dfcc hub bytes:', dfcc.length)

const captured = await captureJson(
  'https://www.sampath.lk/sampath-cards/credit-card-offer?firstTab=super_markets',
  '/api/card-promotions',
  { userAgent, idleMs: 9000 },
)
if (!captured) {
  console.log('sampath: nothing captured')
} else {
  const json = captured as { data?: unknown[]; total?: number }
  console.log('sampath total:', json.total, 'rows:', Array.isArray(json.data) ? json.data.length : 'n/a')
  const first = Array.isArray(json.data) ? (json.data[0] as Record<string, unknown>) : null
  if (first) {
    console.log('row keys:', Object.keys(first).join(', '))
    console.log('row sample:', JSON.stringify(first).slice(0, 600))
  }
}

await closeBrowser()
