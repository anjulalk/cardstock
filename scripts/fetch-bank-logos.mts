// Fetches a square mark for the banks that do not have one, straight from the
// bank's own site, and normalises it to the 64x64 the rest of the set uses.
//
// Run from the repo root:  node scripts/fetch-bank-logos.mts
//
// Two of these banks sit behind a bot filter, so the download goes through the
// same browser the blocked sources use. The rest of the set was taken from the
// sibling project's bank marks, which are the same 64x64 shape.
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const OUT = resolve('packages/web/public/banks')
const SIZE = 64

/** Each bank's own square mark, or the recipe for one when it publishes none. */
const SOURCES: Array<{ id: string; url?: string; monogram?: { colour: string; text: string } }> = [
  { id: 'hnb', url: 'https://www.hnb.lk/logo192.png' },
  {
    id: 'panasia',
    url: 'https://www.pabcbank.com/wp-content/uploads/2022/06/cropped-PABC-Fav-192x192.jpg',
  },
  { id: 'union', url: 'https://www.unionb.com/wp-content/uploads/2024/04/UB_new_favicon-512px.png' },
  // Amãna publishes a wordmark on purple and a 16px icon, no square mark, so its
  // tile is its own brand colour with its initial.
  { id: 'amana', monogram: { colour: '#6b2c91', text: 'A' } },
]

mkdirSync(OUT, { recursive: true })
const { chromium } = await import('playwright')
const browser = await chromium.launch()
const page = await browser.newPage({
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
})
await page.setViewportSize({ width: SIZE, height: SIZE })

for (const bank of SOURCES) {
  let html: string

  if (bank.monogram) {
    html = `<html><body style="margin:0">
      <div style="width:${SIZE}px;height:${SIZE}px;background:${bank.monogram.colour};
        color:#fff;font-family:Georgia,'Times New Roman',serif;font-size:${SIZE * 0.56}px;
        display:flex;align-items:center;justify-content:center">${bank.monogram.text}</div>
    </body></html>`
  } else {
    // Through the browser context, so a WAF in front of the bank is satisfied.
    const response = await page.request.get(bank.url!)
    if (!response.ok()) {
      console.log(`${bank.id.padEnd(8)} failed: ${response.status()} ${bank.url}`)
      continue
    }
    const type = response.headers()['content-type'] ?? 'image/png'
    const base64 = Buffer.from(await response.body()).toString('base64')
    html = `<html><body style="margin:0;background:transparent">
      <img src="data:${type};base64,${base64}"
        style="width:${SIZE}px;height:${SIZE}px;object-fit:contain;display:block" />
    </body></html>`
  }

  await page.setContent(html, { waitUntil: 'load' })
  await page.waitForTimeout(300)
  const png = await page.screenshot({ omitBackground: true })
  writeFileSync(resolve(OUT, `${bank.id}.png`), png)
  console.log(
    `${bank.id.padEnd(8)} ${bank.monogram ? `monogram ${bank.monogram.colour}` : bank.url} -> ${png.length} bytes`,
  )
}

await browser.close()
