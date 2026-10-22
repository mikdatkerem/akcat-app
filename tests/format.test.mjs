import assert from 'node:assert/strict'
import test from 'node:test'
import { formatMoney, parsePriceToKurus, priceInputFromKurus } from '../src/utils/format.ts'

test('TL text converts to exact integer kuruş without binary decimal rounding', () => {
  for (const [input, expected] of [['19,99', 1999], ['150', 15000], ['19.99', 1999], ['0,01', 1], ['0', 0], [' 1,1 ', 110], ['90071992547409,91', Number.MAX_SAFE_INTEGER]]) {
    assert.equal(parsePriceToKurus(input), expected)
    assert.equal(parsePriceToKurus(priceInputFromKurus(expected)), expected)
  }
})
test('invalid, fractional-kuruş and unsafe amounts are rejected without rounding', () => {
  for (const input of ['', ' ', '-1', '+1', '1,999', '1.234', '1.000,00', '1e3', 'Infinity', 'NaN', '1,', ',01', '90071992547409,92', '999999999999999999999999']) {
    assert.throws(() => parsePriceToKurus(input), RangeError, input)
  }
  for (const input of [-1, 1.1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => priceInputFromKurus(input), RangeError)
})
test('TL display retains exact cents, Turkish separators and currency', () => {
  assert.equal(formatMoney(1999), '19,99\u00a0₺')
  assert.equal(formatMoney(15000), '150,00\u00a0₺')
  assert.equal(formatMoney(Number.MAX_SAFE_INTEGER), '90.071.992.547.409,91\u00a0₺')
})
