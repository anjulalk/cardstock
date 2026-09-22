import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadContract } from '../contract.ts'
import { buildOffer } from '../normalize.ts'
import { sourcesDir } from '../paths.ts'
import { mapPanasiaList } from './panasia.ts'

/** Saved markup from a browser-rendered page, three cards. */
const contract = loadContract('panasia')
const html = readFileSync(resolve(sourcesDir, 'panasia', 'fixtures', 'list.html'), 'utf8')

const NOW = '2026-09-20T06:00:00.000Z'
const TODAY = '2026-09-20'

const offers = mapPanasiaList(html, contract).map((draft) => buildOffer(draft, NOW, TODAY))
const byId = (id: string) => offers.find((offer) => offer.externalId === id)

test('panasia fixture: three cards, each with an id from its image', () => {
  assert.equal(offers.length, 3)
  for (const offer of offers) {
    assert.equal(offer.bank, 'panasia')
    assert.match(offer.externalId, /^[a-z0-9-]+$/)
    assert.equal(offer.sourceUrl, 'https://www.pabcbank.com/card-offers/')
    assert.ok(offer.validTo, 'every card is placed somehow')
  }
})

test('panasia fixture: the wording on the back places the offer, not the posted date', () => {
  const offer = byId('anantaya-resorts-spa')
  assert.ok(offer)
  // The front reads 11-09-2026, which is when it was posted; the wording says
  // bookings until 30 September and stays until 30 November.
  assert.equal(offer.validFrom, '2026-09-30')
  assert.equal(offer.validTo, '2026-11-30')
  assert.equal(offer.discount?.value, 35)
})

test('panasia fixture: the merchant is read out of the wording', () => {
  const offer = byId('anantaya-resorts-spa')
  assert.ok(offer)
  assert.match(offer.title, /Anantaya Resort/)
})

test('panasia fixture: supermarket cards are matched to their vendors', () => {
  const glomark = byId('glomark')
  assert.ok(glomark)
  assert.equal(glomark.vendor, 'glomark')
  assert.equal(glomark.category, 'supermarket')

  const cargills = byId('cargills')
  assert.ok(cargills)
  assert.equal(cargills.vendor, 'cargills')
})

test('panasia fixture: a slash date is read day first', () => {
  const offer = byId('glomark')
  assert.ok(offer)
  assert.ok(offer.validTo)
  assert.match(offer.validTo, /^2026-09-/)
})
