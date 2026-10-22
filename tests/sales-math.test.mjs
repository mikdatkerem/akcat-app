import test from 'node:test'
import assert from 'node:assert/strict'
import { lineTotal, quantityValue, sumLines } from '../src/sales/math.ts'
import { parsePriceToKurus } from '../src/utils/format.ts'
test('sale preview uses exact integer kuruş, multi-line totals and 500/100/400 debt', () => {
  assert.equal(lineTotal(1999, '3'), 5997)
  assert.equal(sumLines([{ price: 25000, quantity: '2' }, { price: 10000, quantity: '3' }]), 80000)
  const total = sumLines([{ price: 25000, quantity: '2' }])
  assert.equal(total, 50000)
  assert.equal(total - parsePriceToKurus('100'), 40000)
  assert.equal(lineTotal(0, String(Number.MAX_SAFE_INTEGER)), 0)
})
test('invalid quantities and overflowing line/sale totals never round into valid values', () => {
  for (const value of ['', '0', '-1', '1.5', '1e2', 'NaN', '9007199254740992']) assert.throws(() => quantityValue(value), RangeError)
  assert.throws(() => lineTotal(Number.MAX_SAFE_INTEGER, '2'), RangeError)
  assert.throws(() => sumLines([{ price: Number.MAX_SAFE_INTEGER, quantity: '1' }, { price: 1, quantity: '1' }]), RangeError)
})
