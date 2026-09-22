// Generates the icons, the social card, the manifest, robots.txt and the CNAME
// from the shared paper palette, so none of them can drift from the site.
//
// Run from the repo root:  node scripts/make-brand-assets.mts
//
// The PNGs are rendered with the same browser the blocked bank sources use, so
// there is no second renderer to install. Inspect the social card afterwards.
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const OUT = resolve('packages/web/public')
const SITE = 'https://cardstock.anjula.dev'
const NAME = 'cardstock'

const PAPER = '#faf8f3'
const LINE = '#dfdbd0'
const INK = '#44403a'
const BODY = '#5f5a51'
const SOFT = '#767064'
const CLAY = '#c1603c'

/** The mark: a small calendar of offers, one day pressed in clay. */
function mark(size: number): string {
  const cell = size * 0.16
  const gap = size * 0.07
  const left = (size - (cell * 3 + gap * 2)) / 2
  const top = (size - (cell * 2 + gap)) / 2 + size * 0.05
  const squares: string[] = []
  for (let row = 0; row < 2; row++) {
    for (let column = 0; column < 3; column++) {
      const filled = row === 0 && column === 1
      squares.push(
        `<rect x="${left + column * (cell + gap)}" y="${top + row * (cell + gap)}" width="${cell}" height="${cell}" rx="${cell * 0.22}" fill="${filled ? CLAY : LINE}"/>`,
      )
    }
  }
  return `<rect x="${size * 0.11}" y="${size * 0.11}" width="${size * 0.78}" height="${size * 0.78}" rx="${size * 0.16}" fill="none" stroke="${LINE}" stroke-width="${Math.max(1, size * 0.012)}"/>${squares.join('')}`
}

function iconSvg(size: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="${PAPER}"/>
  ${mark(size)}
</svg>`
}

/** The social card, in the printed page the site already looks like. */
function ogHtml(): string {
  const width = 1200
  const height = 630
  const markInner = iconSvg(92).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')
  return `<!doctype html>
<html><head><meta charset="utf-8"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap" rel="stylesheet"/>
<style>
  * { margin: 0; box-sizing: border-box; }
  body { width: ${width}px; height: ${height}px; background: ${PAPER}; position: relative; overflow: hidden; }
  .veil { position: absolute; inset: 0; background:
    radial-gradient(720px 420px at 6% -12%, rgb(193 96 60 / 0.10), transparent 62%),
    radial-gradient(620px 360px at 94% -6%, rgb(120 135 106 / 0.09), transparent 58%); }
  .frame { position: absolute; inset: 0; border: 1px solid ${LINE}; }
  .stack { position: relative; height: 100%; padding: 64px 74px 56px; display: flex; flex-direction: column; }
  .eyebrow { font-family: 'JetBrains Mono', monospace; font-size: 18px; letter-spacing: 0.34em; color: ${SOFT}; }
  .mark { margin-top: 34px; }
  h1 { margin-top: 30px; font-family: 'Source Serif 4', Georgia, serif; font-size: 78px;
    line-height: 1.06; font-weight: 600; color: ${INK}; letter-spacing: -0.015em; }
  p { margin-top: 22px; font-family: 'Source Serif 4', Georgia, serif; font-size: 29px;
    line-height: 1.4; color: ${BODY}; max-width: 800px; }
  .rule { margin-top: 30px; width: 150px; height: 5px; border-radius: 3px; background: ${CLAY}; }
  .foot { margin-top: auto; font-family: 'JetBrains Mono', monospace; font-size: 18px;
    letter-spacing: 0.08em; color: ${SOFT}; }
</style></head>
<body>
  <div class="veil"></div>
  <div class="frame"></div>
  <div class="stack">
    <div class="eyebrow">CARDSTOCK</div>
    <svg class="mark" width="92" height="92" viewBox="0 0 92 92" xmlns="http://www.w3.org/2000/svg">${markInner}</svg>
    <h1>Sri Lankan card offers,<br/>on a calendar</h1>
    <p>The offers that apply to the cards you actually hold, on the days they run.</p>
    <div class="rule"></div>
    <div class="foot">cardstock.anjula.dev</div>
  </div>
</body></html>`
}

const { chromium } = await import('playwright')
const browser = await chromium.launch()
mkdirSync(OUT, { recursive: true })

// The SVG favicon and the manifest are text; write them directly.
writeFileSync(resolve(OUT, 'favicon.svg'), iconSvg(64) + '\n')
writeFileSync(
  resolve(OUT, 'site.webmanifest'),
  JSON.stringify(
    {
      name: 'cardstock - Sri Lankan credit card offers',
      short_name: NAME,
      description: "Sri Lankan credit card offers on a calendar, filtered to the cards you hold.",
      start_url: '/',
      scope: '/',
      display: 'standalone',
      background_color: PAPER,
      theme_color: PAPER,
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    },
    null,
    2,
  ) + '\n',
)
writeFileSync(
  resolve(OUT, 'robots.txt'),
  `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`,
)
writeFileSync(resolve(OUT, 'CNAME'), `${SITE.replace('https://', '')}\n`)

// The PNGs are rendered, so the icons and the card match the site exactly.
const page = await browser.newPage({ deviceScaleFactor: 1 })

for (const size of [192, 512]) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(
    `<html><body style="margin:0">${iconSvg(size).replace(`width="${size}" height="${size}"`, `width="${size}" height="${size}" style="display:block"`)}</body></html>`,
  )
  await page.screenshot({ path: resolve(OUT, `icon-${size}.png`), omitBackground: false })
  console.log(`icon-${size}.png`)
}

await page.setViewportSize({ width: 1200, height: 630 })
await page.setContent(ogHtml(), { waitUntil: 'load' })
await page.evaluate(() => document.fonts.ready)
await page.waitForTimeout(600)
await page.screenshot({ path: resolve(OUT, 'og.png') })
console.log('og.png')

await browser.close()
console.log('wrote favicon.svg, icon-192.png, icon-512.png, og.png, site.webmanifest, robots.txt, CNAME')
