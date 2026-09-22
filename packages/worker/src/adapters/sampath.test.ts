import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadContract } from '../contract.ts'
import { buildOffer } from '../normalize.ts'
import { sourcesDir } from '../paths.ts'
import { mapSampathPromotions, type SampathResponse } from './sampath.ts'

/** A trimmed payload from the live API, six rows across five categories. */
const contract = loadContract('sampath')
const payload = JSON.parse(
  readFileSync(resolve(sourcesDir, 'sampath', 'fixtures', 'list.json'), 'utf8'),
) as SampathResponse

const NOW = '2026-09-20T06:00:00.000Z'
const TODAY = '2026-09-20'

const offers = mapSampathPromotions(payload, contract).map((draft) => buildOffer(draft, NOW, TODAY))
const byId = (id: string) => offers.find((offer) => offer.externalId === id)

test('sampath fixture: every row becomes an offer with a rebuilt link', () => {
  assert.equal(offers.length, payload.data!.length)
  for (const offer of offers) {
    assert.equal(offer.bank, 'sampath')
    assert.match(offer.externalId, /^\d+$/)
    assert.equal(offer.sourceUrl, `https://www.sampath.lk/sampath-cards/credit-card-offer/${offer.externalId}`)
    assert.ok(offer.validTo, 'expire_on gives every row an end date')
  }
})

test('sampath fixture: epoch milliseconds become a date', () => {
  const offer = byId('3111')
  assert.ok(offer)
  // 1790360940000 is 23:59 on the 25th in Colombo.
  assert.equal(offer.validTo, '2026-09-25')
})

test('sampath fixture: the category is mapped to ours', () => {
  const spar = byId('3111')
  assert.ok(spar)
  assert.equal(spar.category, 'supermarket')
  assert.equal(spar.vendor, 'spar')

  const dining = byId('3207')
  assert.ok(dining)
  assert.equal(dining.category, 'dining')

  const hotel = byId('3213')
  assert.ok(hotel)
  assert.equal(hotel.category, 'travel')
})

test('sampath fixture: the description gives the discount', () => {
  const offer = byId('3111')
  assert.ok(offer)
  assert.equal(offer.discount?.kind, 'percent')
  assert.equal(offer.discount?.value, 25)
})

test('sampath fixture: the calendar link gives a start where it exists', () => {
  const withStart = offers.find((offer) => offer.validFrom !== null)
  if (withStart) {
    assert.match(withStart.validFrom!, /^\d{4}-\d{2}-\d{2}$/)
    assert.ok(withStart.validFrom! <= withStart.validTo!)
  }
})
