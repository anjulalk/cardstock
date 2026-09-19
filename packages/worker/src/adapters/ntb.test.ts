import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadContract } from '../contract.ts'
import { buildOffer } from '../normalize.ts'
import { sourcesDir } from '../paths.ts'
import { mapNtbList } from './ntb.ts'

/** Saved markup, four cards, covering every date shape NTB publishes: a list
 *  of named days, two weekday rules and a plain end date. */
const contract = loadContract('ntb')
const html = readFileSync(resolve(sourcesDir, 'ntb', 'fixtures', 'list.html'), 'utf8')

const NOW = '2026-09-20T06:00:00.000Z'
const TODAY = '2026-09-20'

const drafts = mapNtbList(html, contract)
const offers = drafts.map((draft) => buildOffer(draft, NOW, TODAY))
const bySlug = (slug: string) => offers.find((offer) => offer.externalId === slug)

test('ntb fixture: every card is read from the markup', () => {
  assert.equal(drafts.length, 4)
  for (const offer of offers) {
    assert.ok(offer.externalId.length > 0)
    assert.equal(offer.bank, 'ntb')
    assert.ok(offer.title.length > 3)
    assert.match(offer.sourceUrl, /^https:\/\/www\.nationstrust\.com\/promotions\//)
    assert.ok(offer.validTo, 'each card publishes a period')
  }
})

test('ntb fixture: named days become explicit dates, not a range', () => {
  const offer = bySlug('30-off-with-mastercard-credit-cards')
  assert.ok(offer)
  assert.deepEqual(offer.dates, ['2026-09-02', '2026-09-16', '2026-09-30'])
  assert.deepEqual(offer.days, [])
  assert.equal(offer.validTo, '2026-09-30')
  assert.equal(offer.vendor, 'cargills')
  assert.equal(offer.category, 'supermarket')
  assert.equal(offer.discount?.kind, 'percent')
  assert.equal(offer.discount?.value, 30)
})

test('ntb fixture: a weekly rule keeps its weekday', () => {
  const sunday = bySlug('25-off-with-mastercard-credit-cards-3')
  assert.ok(sunday)
  assert.deepEqual(sunday.days, [0])
  assert.equal(sunday.validTo, '2026-09-30')
  assert.equal(sunday.vendor, 'keells')

  const thursday = bySlug('15-off-with-mastercard-credit-cards-11-1')
  assert.ok(thursday)
  assert.deepEqual(thursday.days, [4])
})

test('ntb fixture: the source category beats our keyword guess', () => {
  const offer = bySlug('enjoy-20-off-with-mastercard-credit-cards-4')
  assert.ok(offer)
  // The word hotel would have said travel; the page says dining.
  assert.equal(offer.category, 'dining')
  assert.match(offer.vendorHint ?? '', /Sheraton Colombo Hotel/)
})
