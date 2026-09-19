import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildOffer } from '../normalize.ts'
import { loadContract } from '../contract.ts'
import { sourcesDir } from '../paths.ts'
import {
  mapHnbPremium,
  mapHnbWeb,
  type HnbPremiumResponse,
  type HnbWebResponse,
} from './hnb.ts'

/** Saved payloads, trimmed to a handful of rows. These hold the parser still:
 *  a redesign at the bank fails the daily probe, and a change in our own
 *  mapping fails here. */
const contract = loadContract('hnb')
const read = <T>(file: string): T =>
  JSON.parse(readFileSync(resolve(sourcesDir, 'hnb', 'fixtures', file), 'utf8')) as T

const web = read<HnbWebResponse>('web.json')
const premium = read<HnbPremiumResponse>('premium.json')

const NOW = '2026-09-20T06:00:00.000Z'
const TODAY = '2026-09-20'

const webOffers = mapHnbWeb(web, contract).map((draft) => buildOffer(draft, NOW, TODAY))
const premiumOffers = mapHnbPremium(premium, contract).map((draft) => buildOffer(draft, NOW, TODAY))

test('hnb fixtures: the payloads still look like the recorded shape', () => {
  assert.ok(web.data.length >= 5, 'web fixture should hold several rows')
  assert.ok(premium.data.length >= 2, 'premium fixture should hold several rows')
  assert.equal(web.page, 1)
  assert.ok(web.total > 500)
})

test('hnb web: every row keeps an id, a bank link and an absolute image', () => {
  assert.equal(webOffers.length, web.data.length)
  for (const offer of webOffers) {
    assert.match(offer.id, /^hnb:\d+$/)
    assert.equal(offer.source, 'hnb')
    assert.equal(offer.bank, 'hnb')
    assert.match(offer.sourceUrl, /^https:\/\/www\.hnb\.lk\/card-promotion\/search\/\d+$/)
    if (offer.image) assert.match(offer.image, /^https:\/\/www\.hnb\.lk\/local-images\/card-promotion\//)
  }
})

test('hnb web: a Tuesday-only Keells offer keeps the weekday rule', () => {
  const offer = webOffers.find((entry) => entry.externalId === '2369')
  assert.ok(offer, 'the Keells fixture row should be present')
  assert.equal(offer.vendor, 'keells')
  assert.equal(offer.category, 'supermarket')
  assert.deepEqual(offer.days, [2])
  assert.equal(offer.validTo, '2026-09-29')
  assert.deepEqual(offer.cardTypes, ['credit'])
  assert.equal(offer.discount?.kind, 'percent')
  assert.equal(offer.discount?.value, 25)
})

test('hnb web: a Valid From label gives the offer a start date', () => {
  const offer = webOffers.find((entry) => entry.externalId === '4072')
  assert.ok(offer)
  assert.equal(offer.validFrom, '2026-11-01')
  assert.equal(offer.validTo, '2026-12-31')
  assert.equal(offer.discount?.kind, 'installments')
})

test('hnb premium: the labelled sections become fields', () => {
  const offer = premiumOffers.find((entry) => entry.externalId === '2455')
  assert.ok(offer, 'the Era Beach fixture row should be present')
  assert.equal(offer.vendorHint, 'Era Beach Thalpe')
  assert.equal(offer.validFrom, '2026-01-19')
  assert.equal(offer.validTo, '2026-12-31')
  assert.deepEqual(offer.cardTypes, ['credit', 'debit'])
  assert.ok(offer.termsText && offer.termsText.length > 20, 'terms should be carried over')
  assert.ok(offer.discount?.value === 20)
})
