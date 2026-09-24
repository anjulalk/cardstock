// Checks that the relay works, which is what makes a run from CI possible for
// the banks that refuse cloud addresses.
//
// Run from the repo root:  node scripts/check-relay.mts
import { fetchText } from '../packages/worker/src/lib/http.ts'
import { proxiedUrl, restoreUrls } from '../packages/worker/src/lib/net.ts'

const BLOCKED = 'https://www.combank.lk/robots.txt'
const options = { source: 'relay-check', userAgent: 'cardstock/0.1 (+https://cardstock.anjula.dev/about)', delayMs: 0 }

console.log('relay:', proxiedUrl(BLOCKED))

try {
  const direct = await fetchText(BLOCKED, options)
  console.log(`direct: ${direct.length} bytes (not refused from here, which is fine)`)
} catch (error) {
  console.log(`direct: refused, as expected from a cloud address (${String(error).slice(0, 60)})`)
}

const via = proxiedUrl(BLOCKED)
if (via) {
  try {
    const text = await fetchText(via, options)
    console.log(`relay:  ${text.length} bytes`)
    console.log(`restored: ${/translate\.goog/.test(text) ? 'still contains proxy URLs' : 'no proxy URLs left'}`)
    console.log(`sample:   ${text.slice(0, 120).replace(/\s+/g, ' ')}`)
  } catch (error) {
    console.log(`relay:  failed (${String(error).slice(0, 120)})`)
  }
}

const sample = `<a href="https://www-combank-lk.translate.goog/rewards-promotions/x?_x_tr_sl=auto&amp;_x_tr_tl=en">x</a>`
console.log('\nrestoreUrls:', restoreUrls(sample))
