import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadContract } from '../contract.ts'
import { buildOffer } from '../normalize.ts'
import { sourcesDir } from '../paths.ts'
import { mapCombankList } from './combank.ts'

/** Saved markup, five cards from five of ComBank's own categories. */
const contract = loadContract('combank')
const html = readFileSync(resolve(sourcesDir, 'combank', 'fixtures', 'list.html'), 'utf8')

const NOW = '2026-09-20T06:00:00.000Z'
const TODAY = '2026-09-20'

const offers = mapCombankList(html, contract).map((draft) => buildOffer(draft, NOW, TODAY))
const byId = (fragment: string) => offers.find((offer) => offer.externalId.includes(fragment))

test('combank fixture: five cards, each with a path id and a rebuilt link', () => {
  assert.equal(offers.length, 5)
  for (const offer of offers) {
    assert.equal(offer.bank, 'combank')
    assert.match(offer.externalId, /^[a-z-]+\/[a-z0-9-]+$/)
    assert.equal(offer.sourceUrl, `https://www.combank.lk/rewards-promotion/${offer.externalId}`)
    assert.ok(offer.validTo, 'every card publishes a period')
  }
})

test('combank fixture: the url category, the tag and the card type', () => {
  const offer = byId('food-restaurants/enjoy-the-art-of-dining-at-hilton-colombo')
  assert.ok(offer)
  assert.equal(offer.category, 'dining')
  assert.equal(offer.validTo, '2026-09-30')
  assert.deepEqual(offer.cardTypes, ['credit'])
  assert.match(offer.discount?.text ?? '', /20%/)
})

test('combank fixture: a supermarket offer keeps its weekday rule', () => {
  const offer = byId('supermarket/')
  assert.ok(offer)
  assert.equal(offer.category, 'supermarket')
  assert.deepEqual(offer.days, [0])
  assert.equal(offer.validTo, '2026-09-27')
  assert.equal(offer.vendor, 'laugfs')
})

test('combank fixture: an offer on the premium page falls back to its own words', () => {
  const premium = offers.find((offer) => offer.externalId.startsWith('premium-card-offers/'))
  assert.ok(premium)
  // No category in the map for that page, so the title decides.
  assert.equal(premium.category, 'dining')
})

test('combank fixture: the image is read out of the background style', () => {
  const offer = byId('food-restaurants/enjoy-the-art-of-dining-at-hilton-colombo')
  assert.ok(offer)
  assert.match(offer.image ?? '', /^https:\/\/s3\./)
})
