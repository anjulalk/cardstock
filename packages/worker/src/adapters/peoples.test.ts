import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadContract } from '../contract.ts'
import { buildOffer } from '../normalize.ts'
import { sourcesDir } from '../paths.ts'
import { mapPeoplesList } from './peoples.ts'

/** Saved markup, three cards from the leisure category page. People's writes the
 *  visible date American style, so the adapter reads the data-end attribute. */
const contract = loadContract('peoples')
const html = readFileSync(resolve(sourcesDir, 'peoples', 'fixtures', 'list.html'), 'utf8')
const LIST = 'https://www.peoplesbank.lk/promotion-category/leisure/'

const NOW = '2026-09-20T06:00:00.000Z'
const TODAY = '2026-09-20'

const offers = mapPeoplesList(html, LIST, contract).map((draft) => buildOffer(draft, NOW, TODAY))
const byId = (id: string) => offers.find((offer) => offer.externalId === id)

test('peoples fixture: three cards, each with a slug id and a rebuilt link', () => {
  assert.equal(offers.length, 3)
  for (const offer of offers) {
    assert.equal(offer.bank, 'peoples')
    assert.match(offer.externalId, /^[a-z0-9-]+$/)
    assert.equal(offer.sourceUrl, `https://www.peoplesbank.lk/promotion/${offer.externalId}/`)
    assert.ok(offer.validTo, 'the data-end attribute gives every card an end date')
  }
})

test('peoples fixture: the data-end attribute is read, not the American date line', () => {
  const offer = byId('amaara-sky-hotel-kandy-30-off-credit')
  assert.ok(offer)
  assert.equal(offer.validTo, '2026-10-31')
  assert.equal(offer.validFrom, null)
})

test('peoples fixture: the badge gives the discount and the merchant gives the category', () => {
  const offer = byId('amaara-sky-hotel-kandy-30-off-credit')
  assert.ok(offer)
  assert.equal(offer.discount?.kind, 'percent')
  assert.equal(offer.discount?.value, 40)
  assert.equal(offer.category, 'travel')
  assert.deepEqual(offer.cardTypes, ['credit'])
  assert.match(offer.termsText ?? '', /Promo Code/)
})

test('peoples fixture: the category page labels the offers on it', () => {
  const [first] = mapPeoplesList(
    html,
    'https://www.peoplesbank.lk/promotion-category/supermarkets/',
    contract,
  ).map((draft) => buildOffer(draft, NOW, TODAY))
  assert.ok(first)
  assert.equal(first.category, 'supermarket')
})

test('peoples: the slug says whether the offer is for a debit card', () => {
  const card = `<article class="offer-card">
    <div class="discount-badge">15% off</div>
    <div class="offer-image"><a href="https://www.peoplesbank.lk/promotion/some-shop-15-off-debit/">
      <img src="https://www.peoplesbank.lk/x.jpg" alt="Some Shop"></a></div>
    <div class="card-content"><div>
      <div class="promo-short fw-medium">Some Shop</div>
      <div class="meta"><span class="merchant-name">Somewhere</span>
      <span class="fw-medium valid-date">Till December 31, 2026</span></div>
    </div></div>
    <div class="card-footer p-0"><a class="icon-btn calendar-btn" data-end="20261231"></a></div>
  </article>`

  const [offer] = mapPeoplesList(card, LIST, contract).map((draft) => buildOffer(draft, NOW, TODAY))
  assert.ok(offer)
  assert.equal(offer.externalId, 'some-shop-15-off-debit')
  assert.deepEqual(offer.cardTypes, ['debit'])
})
