import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadContract } from '../contract.ts'
import { buildOffer } from '../normalize.ts'
import { sourcesDir } from '../paths.ts'
import { mapDfccList } from './dfcc.ts'

/** Saved markup, four cards from the one DFCC route that renders on the server. */
const contract = loadContract('dfcc')
const html = readFileSync(resolve(sourcesDir, 'dfcc', 'fixtures', 'list.html'), 'utf8')

const NOW = '2026-09-20T06:00:00.000Z'
const TODAY = '2026-09-20'

const offers = mapDfccList(html, contract).map((draft) => buildOffer(draft, NOW, TODAY))
const byId = (fragment: string) => offers.find((offer) => offer.externalId.includes(fragment))

test('dfcc fixture: four cards, each with a slug id and a rebuilt link', () => {
  assert.equal(offers.length, 4)
  for (const offer of offers) {
    assert.equal(offer.bank, 'dfcc')
    assert.match(offer.externalId, /^[a-z0-9-]+$/)
    assert.equal(offer.sourceUrl, `https://www.dfcc.lk/dfcc-card-offers/${offer.externalId}`)
    assert.ok(offer.validTo, 'every card publishes a period')
  }
})

test('dfcc fixture: the from and until line is read as a window', () => {
  const offer = byId('citrus-waskaduwa-2')
  assert.ok(offer)
  assert.equal(offer.validFrom, '2026-08-31')
  assert.equal(offer.validTo, '2026-10-31')
})

test('dfcc fixture: the tag row gives the card types and the network', () => {
  const offer = byId('icon-cancer-centre')
  assert.ok(offer)
  assert.deepEqual(offer.cardTypes, ['credit'])
  assert.deepEqual(offer.networks, ['visa'])
  assert.equal(offer.category, 'health')
})

test('dfcc fixture: a debit tag is a debit offer', () => {
  const offer = byId('singhe-hospitals')
  assert.ok(offer)
  assert.deepEqual(offer.cardTypes, ['debit'])
})

test('dfcc fixture: the badge gives the discount', () => {
  const offer = byId('citrus-waskaduwa-2')
  assert.ok(offer)
  assert.equal(offer.discount?.kind, 'percent')
  assert.equal(offer.discount?.value, 15)
  assert.match(offer.image ?? '', /^https:\/\/properties\.dfcc\.lk\//)
})
