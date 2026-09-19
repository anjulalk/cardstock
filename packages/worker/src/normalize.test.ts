import test from 'node:test'
import assert from 'node:assert/strict'
import { buildOffer } from './normalize.ts'

const NOW = '2026-09-20T06:00:00.000Z'
const TODAY = '2026-09-20'

test('normalize: a supermarket hint resolves to a registry vendor', () => {
  const offer = buildOffer(
    {
      source: 'hnb',
      externalId: '1',
      bank: 'hnb',
      title: '25% Discount on Fresh Vegetables, Fruits & Seafood',
      vendorHint: 'Keells Supermarket',
      validTo: '2026-08-31',
      cardTypeText: 'credit',
      sourceUrl: 'https://example.test/1',
    },
    NOW,
    TODAY,
  )
  assert.equal(offer.vendor, 'keells')
  assert.equal(offer.category, 'supermarket')
  assert.deepEqual(offer.cardTypes, ['credit'])
  assert.equal(offer.discount?.kind, 'percent')
  assert.equal(offer.discount?.value, 25)
  assert.equal(offer.status, 'expired')
})

test('normalize: a weekly offer keeps its weekday and window', () => {
  const offer = buildOffer(
    {
      source: 'ntb',
      externalId: '2',
      bank: 'ntb',
      title: '30% off with Mastercard Credit Cards',
      vendorHint: 'CARGILLS FOOD CITY',
      periodText: 'every wednesday till 26th October 2026',
      cardTypeText: 'credit',
      sourceUrl: 'https://example.test/2',
    },
    NOW,
    TODAY,
  )
  assert.deepEqual(offer.days, [3])
  assert.equal(offer.validTo, '2026-10-26')
  assert.equal(offer.status, 'active')
  assert.equal(offer.vendor, 'cargills')
})

test('normalize: entities are decoded and amex platinum is read', () => {
  const offer = buildOffer(
    {
      source: 'hnb',
      externalId: '3',
      bank: 'hnb',
      title: '10% off at &amp;Co Pub and Kitchen',
      eligibilityText: 'Sampath Bank American Express Platinum Ultramiles Credit Cardmembers',
      discountText: '10% off on dine-in',
      validFrom: '2026-01-01',
      validTo: '2026-09-30',
      sourceUrl: 'https://example.test/3',
    },
    NOW,
    TODAY,
  )
  assert.equal(offer.title, '10% off at &Co Pub and Kitchen')
  assert.deepEqual(offer.networks, ['amex'])
  assert.deepEqual(offer.tiers, ['platinum'])
  assert.equal(offer.category, 'dining')
  assert.equal(offer.status, 'active')
})

test('normalize: no date means unconfirmed, not guessed', () => {
  const offer = buildOffer(
    {
      source: 'hnb',
      externalId: '4',
      bank: 'hnb',
      title: 'Something with no period',
      sourceUrl: 'https://example.test/4',
    },
    NOW,
    TODAY,
  )
  assert.equal(offer.status, 'unconfirmed')
  assert.equal(offer.validTo, null)
  assert.equal(offer.validFrom, null)
})
