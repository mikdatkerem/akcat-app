import assert from 'node:assert/strict'
import { test } from 'node:test'
import { apiOrigin } from '../src/config/apiOrigin.ts'
test('release API configuration accepts same-origin or a normalized HTTPS origin', () => {
  assert.equal(apiOrigin('', true), '')
  assert.equal(apiOrigin(' https://api.akcat.test/// ', true), 'https://api.akcat.test')
})
test('release API configuration rejects HTTP and all loopback URL spellings', () => {
  for (const value of ['http://api.akcat.test', 'http://localhost:8787', 'https://localhost', 'https://localhost.', 'https://app.localhost.', 'https://app.localhost', 'https://127.0.0.1', 'https://127.1', 'https://2130706433', 'https://[::1]', 'https://[::ffff:127.0.0.1]', 'https://[::]', 'https://0.0.0.0'])
    assert.throws(() => apiOrigin(value, true))
})
test('API configuration rejects credentials, non-origin paths, queries and executable schemes', () => {
  for (const value of ['/api', 'https://user:secret@api.akcat.test', 'https://api.akcat.test/api', 'https://api.akcat.test?key=value', 'https://api.akcat.test#hash', 'javascript:alert(1)', 'ftp://api.akcat.test'])
    assert.throws(() => apiOrigin(value, true))
  assert.equal(apiOrigin('http://localhost:8787', false), 'http://localhost:8787')
})
