// Finds a logo for each bank that has none, from the bank's own site.
// Run from the repo root: node scripts/find-bank-logos.mts
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const OUT = resolve('packages/web/public/banks')
const WANTED = [
  { id: 'hnb', url: 'https://www.hnb.lk/' },
  { id: 'amana', url: 'https://www.amanabank.lk/' },
  { id: 'panasia', url: 'https://www.pabcbank.com/' },
  { id: 'union', url: 'https://www.unionb.com/' },
]

mkdirSync(OUT, { recursive: true })
const { chromium } = await import('playwright')
const browser = await chromium.launch()
const page = await browser.newPage({
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
})

for (const bank of WANTED) {
  console.log(`\n=== ${bank.id} ${bank.url}`)
  try {
    await page.goto(bank.url, { waitUntil: 'domcontentloaded', timeout: 45000 })
    await page.waitForTimeout(3000)

    const candidates = await page.evaluate(() => {
      const found: Array<{ url: string; w: number; h: number; why: string }> = []
      const push = (url: string, why: string) => {
        if (!url || url.startsWith('data:')) return
        const image = new Image()
        image.src = url
        found.push({ url, w: image.naturalWidth, h: image.naturalHeight, why })
      }
      for (const link of document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]')) {
        push((link as HTMLLinkElement).href, 'icon link')
      }
      const og = document.querySelector('meta[property="og:image"]') as HTMLMetaElement | null
      if (og?.content) push(og.content, 'og:image')
      for (const img of document.querySelectorAll('img')) {
        const element = img as HTMLImageElement
        const text = `${element.src} ${element.alt} ${element.className}`.toLowerCase()
        if (!/logo|brand|emblem/.test(text)) continue
        if (element.naturalWidth < 40 || element.naturalHeight < 40) continue
        push(element.src, `img alt="${element.alt}" class="${element.className}"`)
      }
      return found
    })

    const seen = new Set<string>()
    for (const candidate of candidates) {
      const key = candidate.url.split('?')[0]!
      if (seen.has(key)) continue
      seen.add(key)
      console.log(`  ${String(candidate.w).padStart(4)}x${String(candidate.h).padEnd(4)} ${candidate.why.slice(0, 40).padEnd(42)} ${candidate.url.slice(0, 100)}`)
    }
    if (candidates.length === 0) console.log('  (nothing found)')
  } catch (error) {
    console.log(`  error: ${String(error).slice(0, 80)}`)
  }
}

await browser.close()
