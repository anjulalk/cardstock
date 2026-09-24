import test from 'node:test'
import assert from 'node:assert/strict'
import { isProxied, proxiedUrl, restoreUrls } from './net.ts'

// The relay is only used when CARDSTOCK_PROXY is unset, so the tests pin that.
const savedProxy = process.env.CARDSTOCK_PROXY
delete process.env.CARDSTOCK_PROXY

test('net: a bank URL becomes a relay URL', () => {
  const relay = proxiedUrl('https://www.combank.lk/rewards-promotions')
  assert.ok(relay)
  assert.match(relay, /^https:\/\/www-combank-lk\.translate\.goog\/rewards-promotions/)
  assert.match(relay, /_x_tr_tl=en/)
})

test('net: a URL already going through the relay is left alone', () => {
  const relayed = 'https://www-seylan-lk.translate.goog/promotions/cards?_x_tr_tl=en'
  assert.equal(proxiedUrl(relayed), null)
  assert.equal(isProxied(relayed), true)
})

test('net: a custom relay takes the url where it says, or at the end', () => {
  process.env.CARDSTOCK_PROXY = 'https://relay.example/fetch?target={url}'
  assert.equal(
    proxiedUrl('https://www.boc.lk/x'),
    'https://relay.example/fetch?target=https%3A%2F%2Fwww.boc.lk%2Fx',
  )
  process.env.CARDSTOCK_PROXY = 'https://relay.example/'
  assert.equal(proxiedUrl('https://www.boc.lk/x'), 'https://relay.example/https%3A%2F%2Fwww.boc.lk%2Fx')
  if (savedProxy === undefined) delete process.env.CARDSTOCK_PROXY
  else process.env.CARDSTOCK_PROXY = savedProxy
})

test('net: a relayed page comes back with the bank own URLs', () => {
  const html = `<a href="https://www-seylan-lk.translate.goog/promotions/cards?type%5B0%5D=credit_card&amp;_x_tr_sl=auto&amp;_x_tr_tl=en&amp;_x_tr_hl=en">x</a>
<img src="https://www-peoplesbank-lk.translate.goog/roastoth/2022/10/x.jpg?_x_tr_sl=auto&amp;_x_tr_tl=en">`

  const restored = restoreUrls(html)
  assert.match(restored, /href="https:\/\/www\.seylan\.lk\/promotions\/cards\?type%5B0%5D=credit_card"/)
  assert.match(restored, /src="https:\/\/www\.peoplesbank\.lk\/roastoth\/2022\/10\/x\.jpg"/)
  assert.ok(!restored.includes('translate.goog'))
  assert.ok(!restored.includes('_x_tr_'))
})
