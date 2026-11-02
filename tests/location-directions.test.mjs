import { test } from 'node:test'
import assert from 'node:assert/strict'
import { googleDirectionsUrl, validCoordinates } from '../src/utils/directions.ts'
test('coordinates take priority, including zero; address safely falls back', () => {
  assert.equal(new URL(googleDirectionsUrl('Başka adres', 0, 0)).searchParams.get('destination'), '0,0')
  assert.equal(new URL(googleDirectionsUrl('İnönü Cad. No: 1 & 2', null, null)).searchParams.get('destination'), 'İnönü Cad. No: 1 & 2')
  assert.equal(googleDirectionsUrl('', null, null), null)
  assert.equal(validCoordinates(NaN, 29), false); assert.equal(validCoordinates(40, 181), false)
  assert.equal(new URL(googleDirectionsUrl('Manuel adres', 100, 29)).searchParams.get('destination'), 'Manuel adres')
})
