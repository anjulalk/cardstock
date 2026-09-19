import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadContract } from '../contract.ts'
import { buildOffer } from '../normalize.ts'
import { sourcesDir } from '../paths.ts'
import { mapBocList } from './boc.ts'

/** Saved markup, three cards from three of BOC's own categories. BOC puts the
 *  category and the slug in the URL, and publishes an expiry but no start. */
const contract = loadContract('boc')
const html = readFileSync(resolve(sourcesDir, 'boc', 'fixtures', 'list.html'), 'utf8')

const NOW = '2026-09-20T06:00:00.000Z'
const TODAY = '2026-09-20'

const offers = mapBocList(html, contract).map((draft) => buildOffer(draft, NOW, TODAY))
const byId = (id: string) => offers.find((offer) => offer.externalId === id)

test('boc fixture: three cards, each with an id carrying its category', () => {
  assert.equal(offers.length, 3)
  for (const offer of offers) {
    assert.equal(offer.bank, 'boc')
    assert.match(offer.externalId, /^[a-z-]+\/[a-z0-9-]+$/)
    assert.match(offer.sourceUrl, /^https:\/\/www\.boc\.lk\/personal-banking\/card-offers\//)
    assert.ok(offer.validTo, 'the expiration row gives every card an end date')
  }
})

test('boc fixture: each card keeps its own link, not the next one', () => {
  // BOC writes the href before the class, which is what a naive split gets wrong.
  for (const offer of offers) {
    assert.equal(offer.sourceUrl, `https://www.boc.lk/personal-banking/card-offers/${offer.externalId}/product`)
  }
})

test('boc fixture: the expiry row is read as an end date', () => {
  const villa = byId('travel-and-leisure/villa-labugolla')
  assert.ok(villa)
  assert.equal(villa.validTo, '2026-09-30')
  assert.equal(villa.validFrom, null)

  const dsi = byId('online/dsi-footcandy')
  assert.ok(dsi)
  assert.equal(dsi.validTo, '2026-09-20')
})

test('boc fixture: the url category, the highlight and the card types', () => {
  const villa = byId('travel-and-leisure/villa-labugolla')
  assert.ok(villa)
  assert.equal(villa.category, 'travel')
  assert.equal(villa.title, 'Villa Labugolla')
  assert.equal(villa.discount?.kind, 'percent')
  assert.equal(villa.discount?.value, 50)
  assert.deepEqual(villa.cardTypes, ['credit', 'debit'])
  assert.match(villa.termsText ?? '', /Galagedara/)
})

test('boc fixture: a supermarket card is matched to its vendor', () => {
  const cargills = byId('supermarkets/cargills-food-city')
  assert.ok(cargills)
  assert.equal(cargills.category, 'supermarket')
  assert.equal(cargills.vendor, 'cargills')
  assert.equal(cargills.discount?.value, 25)
})
