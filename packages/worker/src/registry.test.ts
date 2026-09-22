import test from 'node:test'
import assert from 'node:assert/strict'
import { matchVendor, normalizeName, stripBranch } from './registry.ts'

// The names below are the ones the banks actually publish.
test('vendors: the same supermarket under different names', () => {
  for (const name of ['Keells', 'Keells Supermarket', 'Keells Super - Union Place', 'KEELLS SUPER']) {
    const match = matchVendor(name)
    assert.equal(match?.vendor.id, 'keells', `failed on ${name}`)
  }
  assert.equal(matchVendor('Cargills Food City')?.vendor.id, 'cargills')
  assert.equal(matchVendor('CARGILLS ONLINE')?.vendor.id, 'cargills')
  assert.equal(matchVendor('Softlogic Glomark')?.vendor.id, 'glomark')
  assert.equal(matchVendor('Laugfs Supermarket')?.vendor.id, 'laugfs')
  assert.equal(matchVendor('SPAR Supermarket')?.vendor.id, 'spar')
  assert.equal(matchVendor('Arpico Supermarket')?.vendor.id, 'arpico')
})

test('vendors: a branch or a town is not part of the identity', () => {
  assert.equal(matchVendor('Club Palm Bay, Marawila')?.vendor.id, 'clubpalmbay')
  assert.equal(matchVendor('Citrus Hikkaduwa')?.vendor.id, 'citrus')
  assert.equal(matchVendor('Citrus Waskaduwa')?.vendor.id, 'citrus')
  assert.equal(matchVendor('Sheraton Kosgoda Turtle Beach Resort')?.vendor.id, 'sheraton')
  assert.equal(matchVendor('Siddhalepa Ayurveda Hospital')?.vendor.id, 'siddhalepa')
  assert.equal(matchVendor('Siddhalepa Clinics')?.vendor.id, 'siddhalepa')
})

test('vendors: chains the banks spell differently', () => {
  assert.equal(matchVendor('Domino\u2019s Pizza')?.vendor.id, 'dominos')
  assert.equal(matchVendor('Dominos')?.vendor.id, 'dominos')
  assert.equal(matchVendor('KFC')?.vendor.id, 'kfc')
  assert.equal(matchVendor('Pizza Hut')?.vendor.id, 'pizzahut')
  assert.equal(matchVendor('Taco Bell')?.vendor.id, 'tacobell')
  assert.equal(matchVendor('Singer Mega')?.vendor.id, 'singer')
  assert.equal(matchVendor('Singer Sri Lanka')?.vendor.id, 'singer')
})

test('vendors: a name that is not a merchant is left alone', () => {
  // Pan Asia falls back to its discount badge when it cannot read a merchant.
  assert.equal(matchVendor('35%'), null)
  assert.equal(matchVendor('25% OFF'), null)
  assert.equal(matchVendor(''), null)
  assert.equal(matchVendor(null), null)
})

test('vendors: normalising drops the words that carry no identity', () => {
  assert.equal(normalizeName('Keells Supermarket (Pvt) Ltd'), 'keells')
  assert.equal(normalizeName('ODEL'), 'odel')
  assert.deepEqual(stripBranch('Club Palm Bay, Marawila'), ['Club Palm Bay'])
})

test('vendors: the score says how sure the match is', () => {
  assert.equal(matchVendor('Keells')?.score, 4)
  // Stripping the branch leaves the exact name, so this is as sure as it gets.
  assert.equal(matchVendor('Keells Super - Union Place')?.score, 4)
  assert.ok((matchVendor('Sheraton Kosgoda Turtle Beach Resort')?.score ?? 0) >= 2)
})

test('vendors: a shared city name is not a merchant', () => {
  // "Hilton Colombo" and a jewellery shop on Colombo's name must not match.
  assert.equal(matchVendor('Hilton Colombo'), null)
  assert.equal(matchVendor('Enjoy the art of dining at Hilton Colombo with ComBank Credit Cards'), null)
})
