import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadContract } from '../contract.ts'
import { buildOffer } from '../normalize.ts'
import { sourcesDir } from '../paths.ts'
import { mapUnionList } from './union.ts'

/** Saved markup, three cards. Union publishes a prose date and a calendar link
 *  which disagree, so these pin that the prose is believed. */
const contract = loadContract('union')
const html = readFileSync(resolve(sourcesDir, 'union', 'fixtures', 'list.html'), 'utf8')

const NOW = '2026-09-20T06:00:00.000Z'
const TODAY = '2026-09-20'

const offers = mapUnionList(html, contract).map((draft) => buildOffer(draft, NOW, TODAY))
const byTitle = (fragment: string) => offers.find((offer) => offer.title.includes(fragment))

test('union fixture: three cards, each with a slug id and a rebuilt link', () => {
  assert.equal(offers.length, 3)
  for (const offer of offers) {
    assert.equal(offer.bank, 'union')
    assert.match(offer.externalId, /^[a-z0-9-]+$/)
    assert.equal(offer.sourceUrl, `https://www.unionb.com/offer/${offer.externalId}/`)
    assert.ok(offer.validTo, 'every card publishes a period')
  }
})

test('union fixture: the prose date wins over the padded calendar link', () => {
  const offer = byTitle('UB 12')
  assert.ok(offer)
  // The page reads 18th to 20th; its calendar link runs 17th to 22nd.
  assert.equal(offer.validFrom, '2026-09-18')
  assert.equal(offer.validTo, '2026-09-20')
})

test('union fixture: a list of days becomes explicit dates', () => {
  const offer = byTitle('Cargills')
  assert.ok(offer)
  assert.deepEqual(offer.dates, ['2026-09-08', '2026-09-22'])
  assert.deepEqual(offer.days, [])
  assert.equal(offer.validTo, '2026-09-22')
})

test('union fixture: a single day offer', () => {
  const offer = byTitle('Taco Bell')
  assert.ok(offer)
  assert.equal(offer.validTo, '2026-09-24')
  assert.equal(offer.validFrom, null)
})

test('union fixture: merchants are matched to the registry', () => {
  const cargills = byTitle('Cargills')
  assert.ok(cargills)
  assert.equal(cargills.vendor, 'cargills')
  assert.equal(cargills.category, 'supermarket')
  assert.equal(cargills.discount?.kind, 'percent')
  assert.equal(cargills.discount?.value, 10)

  const taco = byTitle('Taco Bell')
  assert.ok(taco)
  assert.equal(taco.vendor, 'tacobell')
  assert.equal(taco.category, 'dining')
})
