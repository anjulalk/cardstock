import test from 'node:test'
import assert from 'node:assert/strict'
import { parseEligibility } from './eligibility.ts'

test('eligibility: every card, credit and debit', () => {
  const e = parseEligibility('All HNB Credit / Debit Cards')
  assert.deepEqual(e.cardTypes, ['credit', 'debit'])
  assert.deepEqual(e.networks, [])
  assert.equal(e.openToAll, true)
})

test('eligibility: two networks named on one line', () => {
  const e = parseEligibility('for all Sampath Mastercard & Visa Credit Cardholders')
  assert.deepEqual(e.networks, ['visa', 'mastercard'])
  assert.deepEqual(e.cardTypes, ['credit'])
  assert.deepEqual(e.tiers, [])
})

test('eligibility: an amex product with a tier', () => {
  const e = parseEligibility(
    'Sampath Bank American Express® Platinum Ultramiles Credit Cardmembers',
  )
  assert.deepEqual(e.networks, ['amex'])
  assert.deepEqual(e.tiers, ['platinum'])
  assert.deepEqual(e.cardTypes, ['credit'])
})

test('eligibility: seylans tier names', () => {
  const e = parseEligibility('Seylan Visa Signature Credit Card')
  assert.deepEqual(e.networks, ['visa'])
  assert.deepEqual(e.tiers, ['signature'])
})

test('eligibility: mastercard world', () => {
  const e = parseEligibility('World Mastercard Credit Card')
  assert.deepEqual(e.networks, ['mastercard'])
  assert.deepEqual(e.tiers, ['world'])
})

test('eligibility: debit only', () => {
  const e = parseEligibility('All Sampath Debit Cardholders')
  assert.deepEqual(e.cardTypes, ['debit'])
  assert.equal(e.openToAll, true)
})
