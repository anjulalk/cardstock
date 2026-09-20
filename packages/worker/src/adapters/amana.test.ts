import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadContract } from '../contract.ts'
import { buildOffer } from '../normalize.ts'
import { sourcesDir } from '../paths.ts'
import { mapAmanaList } from './amana.ts'

/** Saved markup, three cards. Amana publishes its dates as a data-ics JSON with
 *  an exclusive end, which these pin. */
const contract = loadContract('amana')
const html = readFileSync(resolve(sourcesDir, 'amana', 'fixtures', 'list.html'), 'utf8')

const NOW = '2026-09-20T06:00:00.000Z'
const TODAY = '2026-09-20'

const offers = mapAmanaList(html, contract).map((draft) => buildOffer(draft, NOW, TODAY))
const byId = (id: string) => offers.find((offer) => offer.externalId === id)

test('amana fixture: four cards, each with a slug id and the listing as its link', () => {
  assert.equal(offers.length, 4)
  for (const offer of offers) {
    assert.equal(offer.bank, 'amana')
    assert.match(offer.externalId, /^[a-z0-9-]+$/)
    assert.match(offer.sourceUrl, /^https:\/\/www\.amanabank\.lk\//)
    assert.ok(offer.validTo, 'every card carries an ics date')
  }
})

test('amana fixture: a one day event is not read as a two day span', () => {
  const offer = byId('tks-fashion-ampara')
  assert.ok(offer)
  // data-ics runs 2026-12-16 to 2026-12-17, which is one day.
  assert.equal(offer.validFrom, '2026-12-16')
  assert.equal(offer.validTo, '2026-12-16')
})

test('amana fixture: a multi day event loses the exclusive end day', () => {
  const offer = byId('hameedia')
  assert.ok(offer)
  // data-ics runs 2026-12-11 to 2026-12-20, so the last day is the 19th.
  assert.equal(offer.validFrom, '2026-12-11')
  assert.equal(offer.validTo, '2026-12-19')
})

test('amana fixture: a description with raw newlines still gives up its dates', () => {
  // Four cards carry newlines inside the data-ics strings, which JSON.parse
  // rejects outright. This one is in the fixture for exactly that reason.
  const offer = byId('courtyard-by-marriott-colombo')
  assert.ok(offer)
  assert.equal(offer.validFrom, '2026-10-01')
  assert.equal(offer.validTo, '2026-10-30')
})

test('amana fixture: the popup text gives the discount, the card type and the category', () => {
  const offer = byId('tks-fashion-ampara')
  assert.ok(offer)
  assert.equal(offer.discount?.kind, 'percent')
  assert.equal(offer.discount?.value, 15)
  assert.deepEqual(offer.cardTypes, ['debit'])
  assert.equal(offer.category, 'fashion')
  assert.equal(offer.vendorHint, 'TKS Fashion')
})
