import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadContract } from '../contract.ts'
import { buildOffer } from '../normalize.ts'
import { sourcesDir } from '../paths.ts'
import { mapSeylanList } from './seylan.ts'

/** Saved markup, three cards. Seylan publishes the dates only in a Google
 *  Calendar link, so these also pin that conversion. */
const contract = loadContract('seylan')
const html = readFileSync(resolve(sourcesDir, 'seylan', 'fixtures', 'list.html'), 'utf8')

const NOW = '2026-09-20T06:00:00.000Z'
const TODAY = '2026-09-20'
const LIST = 'https://www.seylan.lk/promotions/cards'

const offers = mapSeylanList(html, LIST, contract).map((draft) => buildOffer(draft, NOW, TODAY))
const byId = (id: string) => offers.find((offer) => offer.externalId === id)

test('seylan fixture: three cards, each with an id and a bank link', () => {
  assert.equal(offers.length, 3)
  for (const offer of offers) {
    assert.equal(offer.bank, 'seylan')
    assert.ok(offer.title.length > 2)
    assert.equal(offer.sourceUrl, `https://www.seylan.lk/${offer.externalId}`)
    assert.ok(offer.validTo, 'the calendar link gives every card a date')
  }
})

test('seylan fixture: the leftover template text is not part of the title', () => {
  assert.deepEqual(
    offers.map((offer) => offer.title),
    ['GALIS', 'COOL PLANET', 'SUNIMALS'],
  )
})

test('seylan fixture: a calendar date becomes a single day or a range', () => {
  const single = byId('galis-1_')
  assert.ok(single)
  assert.equal(single.validFrom, '2026-12-26')
  assert.equal(single.validTo, '2026-12-26')
  assert.deepEqual(single.dates, [])

  const range = byId('sunimals-1')
  assert.ok(range)
  assert.equal(range.validFrom, '2026-12-19')
  assert.equal(range.validTo, '2026-12-30')
})

test('seylan fixture: the description carries the discount and the card types', () => {
  const offer = byId('galis-1_')
  assert.ok(offer)
  assert.equal(offer.discount?.kind, 'percent')
  assert.equal(offer.discount?.value, 20)
  assert.deepEqual(offer.cardTypes, ['credit', 'debit'])
})

test('seylan fixture: a category page labels the offers on it', () => {
  const [labelled] = mapSeylanList(
    html,
    'https://www.seylan.lk/promotions/cards/supermarket',
    contract,
  ).map((draft) => buildOffer(draft, NOW, TODAY))
  assert.ok(labelled)
  assert.equal(labelled.category, 'supermarket')
})
