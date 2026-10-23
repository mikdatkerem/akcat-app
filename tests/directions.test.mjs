import { test } from 'node:test'
import assert from 'node:assert/strict'
import { googleDirectionsUrl } from '../src/utils/directions.ts'

test('directions: fixed Google Maps endpoint and driving navigation without an origin or API key', () => {
  const url = new URL(googleDirectionsUrl('İzole adres metni'))
  assert.equal(url.origin, 'https://www.google.com')
  assert.equal(url.pathname, '/maps/dir/')
  assert.deepEqual(Object.fromEntries(url.searchParams), { api: '1', destination: 'İzole adres metni', travelmode: 'driving', dir_action: 'navigate' })
})
test('directions: Turkish characters, newlines, spaces and reserved characters round-trip as one destination', () => {
  const address = '  Çığlı Şükrü Öztürk Sokak No: 19/2\nA&B #5 + % ? İstanbul  '
  const url = new URL(googleDirectionsUrl(address))
  assert.equal(url.searchParams.get('destination'), address.trim())
  assert.equal(url.hash, '')
  assert.equal(url.searchParams.size, 4)
  assert.ok(url.href.includes('%C3%87'))
})
test('directions: missing or whitespace-only addresses never create a link', () => {
  for (const address of [undefined, null, '', '  \n\t ']) assert.equal(googleDirectionsUrl(address), null)
})
test('directions: URL and HTML-looking address text cannot change the external target or inject parameters', () => {
  for (const address of ['https://evil.invalid/?origin=secret&key=wrong#fragment', 'javascript:alert(1)', '<img src=x onerror="alert(1)"> &destination=elsewhere']) {
    const url = new URL(googleDirectionsUrl(address))
    assert.equal(url.origin, 'https://www.google.com')
    assert.equal(url.searchParams.get('destination'), address)
    assert.equal(url.searchParams.size, 4)
    assert.equal(url.hash, '')
  }
})
test('directions: over-limit URLs are refused rather than truncating the destination', () => {
  assert.equal(googleDirectionsUrl('Ş'.repeat(1000)), null)
  assert.ok(googleDirectionsUrl('A'.repeat(1000)))
})
