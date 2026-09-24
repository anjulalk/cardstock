// Checks what the build produced, so a pipeline that silently loses its data or
// its head tags fails where the reason is readable.
//
// Run from the repo root after a build:  node scripts/check-build.mts
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const DIST = resolve('packages/web/dist')
const failures: string[] = []

function check(label: string, ok: boolean): void {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}`)
  if (!ok) failures.push(label)
}

function present(path: string): boolean {
  return existsSync(resolve(DIST, path))
}

function mentions(path: string, needle: string): boolean {
  try {
    return readFileSync(resolve(DIST, path), 'utf8').includes(needle)
  } catch {
    return false
  }
}

check('index.html', present('index.html'))
check('sitemap.xml', present('sitemap.xml'))
check('robots.txt', present('robots.txt'))
check('the social card', present('og.png'))
check('the favicon', present('favicon.svg'))
check('a touch icon', present('icon-192.png'))
check('the web manifest', present('site.webmanifest'))
// The custom domain lives in the repository settings, not in this file, but an
// empty or misspelled one here is how a domain quietly stops answering.
check('the CNAME names the domain', mentions('CNAME', 'cardstock.anjula.dev'))
check('a bank mark', present('banks/hnb.png'))

check('the manifest', present('data/index.json'))
const cards = existsSync(resolve(DIST, 'data'))
  ? readdirSync(resolve(DIST, 'data')).filter((name) => /^cards\..+\.json$/.test(name))
  : []
check('the cards chunk', cards.length > 0)

const months = present('data/m')
  ? readdirSync(resolve(DIST, 'data/m'), { withFileTypes: true }).filter((entry) => entry.isDirectory())
  : []
const bankMonths = months.reduce((total, month) => {
  const files = readdirSync(resolve(DIST, 'data/m', month.name)).filter((name) => name.endsWith('.json'))
  return total + files.length
}, 0)
check('at least one bank-month', bankMonths > 0)
console.log(`      bank-months: ${bankMonths}`)

check('og:image in the head', mentions('index.html', 'og:image'))
check('a canonical link', mentions('index.html', 'rel="canonical"'))
check('structured data', mentions('index.html', 'application/ld+json'))
check('the sitemap names the site', mentions('sitemap.xml', '<loc>'))
check('robots names the sitemap', mentions('robots.txt', 'Sitemap:'))

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed: ${failures.join(', ')}`)
  process.exit(1)
}
console.log('\nthe built site is complete')
