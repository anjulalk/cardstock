import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadContract } from '../contract.ts'
import { buildOffer } from '../normalize.ts'
import { sourcesDir } from '../paths.ts'
import { mapNdbList } from './ndb.ts'

/** Saved markup, four cards chosen to cover NDB's date shapes and the tier
 *  names that appear in its card-type line. */
const contract = loadContract('ndb')
const html = readFileSync(resolve(sourcesDir, 'ndb', 'fixtures', 'list.html'), 'utf8')

const NOW = '2026-09-20T06:00:00.000Z'
const TODAY = '2026-09-20'

const offers = mapNdbList(html, contract).map((draft) => buildOffer(draft, NOW, TODAY))
const byTitle = (fragment: string) => offers.find((offer) => offer.title.includes(fragment))

test('ndb fixture: four cards, each with a numeric id and a rebuilt link', () => {
  assert.equal(offers.length, 4)
  for (const offer of offers) {
    assert.equal(offer.bank, 'ndb')
    assert.match(offer.externalId, /^\d+$/)
    assert.equal(
      offer.sourceUrl,
      `https://www.ndbbank.com/cards/card-offers/offer-details/${offer.externalId}`,
    )
    assert.ok(offer.validTo, 'every card publishes a period')
  }
})

test('ndb fixture: a range across two months is read as a window', () => {
  const offer = byTitle('Special Offer for NDB Bank')
  assert.ok(offer)
  assert.equal(offer.validFrom, '2026-09-10')
  assert.equal(offer.validTo, '2026-09-24')
})

test('ndb fixture: a range inside one month is read as a window', () => {
  const offer = byTitle('40% Savings')
  assert.ok(offer)
  assert.equal(offer.validFrom, '2026-09-01')
  assert.equal(offer.validTo, '2026-09-30')
  assert.deepEqual(offer.cardTypes, ['credit', 'debit'])
})

test('ndb fixture: a booking period is reduced to its end date', () => {
  const offer = byTitle('Agoda')
  assert.ok(offer)
  assert.equal(offer.validTo, '2026-12-31')
  assert.equal(offer.validFrom, null)
})

test('ndb fixture: a tier named on the card line is read as a tier', () => {
  const offer = byTitle('Agoda')
  assert.ok(offer)
  assert.deepEqual(offer.tiers, ['infinite'])
  assert.deepEqual(offer.networks, ['visa'])
})

test('ndb fixture: the merchant line becomes the vendor hint', () => {
  const offer = byTitle('22% Savings')
  assert.ok(offer)
  assert.match(offer.vendorHint ?? '', /Club palm Bay/)
  assert.equal(offer.validTo, '2026-03-31')
})
