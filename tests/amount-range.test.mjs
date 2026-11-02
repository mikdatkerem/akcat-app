import test from 'node:test'
import assert from 'node:assert/strict'
import { parseAmountRange, readKurusBound } from '../src/utils/amountRange.ts'

test('amount ranges: empty, inclusive equal and one-sided bounds preserve exact kuruş', () => {
  assert.deepEqual(parseAmountRange('', ' '), { min: undefined, max: undefined })
  assert.deepEqual(parseAmountRange('19,99', '19.99'), { min: 1999, max: 1999 })
  assert.deepEqual(parseAmountRange('150', ''), { min: 15000, max: undefined })
  assert.deepEqual(parseAmountRange('', '0'), { min: undefined, max: 0 })
  assert.deepEqual(parseAmountRange('90071992547409,91', ''), { min: Number.MAX_SAFE_INTEGER, max: undefined })
})
test('amount ranges: invalid, negative, grouped, reversed and unsafe amounts reject without rounding', () => {
  for (const value of ['-1','19,999','1.000','NaN','1e3','0x10','90071992547409,92']) assert.throws(() => parseAmountRange(value, ''))
  assert.throws(() => parseAmountRange('500', '100'))
  for (const value of ['-1','1.2','NaN','1e3','9007199254740992']) assert.throws(() => readKurusBound(value))
  assert.equal(readKurusBound(null), undefined); assert.equal(readKurusBound(''), undefined); assert.equal(readKurusBound('1999'), 1999)
})
