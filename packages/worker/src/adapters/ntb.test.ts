import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadContract } from '../contract.ts'
import { buildOffer } from '../normalize.ts'
import { sourcesDir } from '../paths.ts'
import { mapNtbList } from './ntb.ts'

/** Saved markup, four cards, covering the date shapes NTB publishes: a weekday
 *  rule with a day range, a same month range, a plain weekday rule, and an end
 *  date written with non-breaking spaces as entities. */
const contract = loadContract('ntb')
const html = readFileSync(resolve(sourcesDir, 'ntb', 'fixtures', 'list.html'), 'utf8')

const NOW = '2026-10-03T00:00:00.000Z'
const TODAY = '2026-10-03'

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

test('ntb fixture: a non-breaking space written as an entity still gives an end date', () => {
  // The bank separates the day from the month with a non-breaking space, which a
  // relayed page arrives carrying as &nbsp;. Parsed as markup that entity is
  // eight characters in the gap, so nothing matches and the card goes out with
  // no end date, which is what put the source over its requireFields guard.
  const offer = bySlug('40-off-with-mastercard-credit-cards-3')
  assert.ok(offer)
  assert.equal(offer.validTo, '2026-10-31')
  assert.equal(offer.status, 'active')
})

test('ntb fixture: an entity between the words does not hide the weekday', () => {
  const offer = bySlug('20-off-with-mastercard-credit-cards-18-1')
  assert.ok(offer)
  assert.deepEqual(offer.days, [6])
  assert.equal(offer.validFrom, '2026-10-01')
  assert.equal(offer.validTo, '2026-10-31')
})

test('ntb fixture: a same month range is read as a window', () => {
  const offer = bySlug('20-off-for-oktoberfest-with-mastercard-credit-cards')
  assert.ok(offer)
  assert.equal(offer.validFrom, '2026-10-09')
  assert.equal(offer.validTo, '2026-10-11')
  assert.deepEqual(offer.days, [])
})

test('ntb fixture: a weekday rule keeps its weekday', () => {
  const offer = bySlug('25-off-with-mastercard-credit-cards-6-1')
  assert.ok(offer)
  assert.deepEqual(offer.days, [0])
  assert.equal(offer.validTo, '2026-10-31')
  assert.equal(offer.vendor, 'keells')
})

test('ntb fixture: the source category beats our keyword guess', () => {
  // A restaurant named on a hotel card would read as travel, but the page's own
  // class says dining, and the page wins.
  const pub = offers.find((offer) => offer.vendorHint?.includes('Bavarian'))
  assert.ok(pub)
  assert.equal(pub.category, 'dining')

  const hotel = offers.find((offer) => offer.vendorHint?.includes('Royal Beach Hotel'))
  assert.ok(hotel)
  assert.equal(hotel.category, 'travel')
})
