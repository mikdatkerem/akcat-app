// Public deployment configuration only. No credentials may be embedded in an API URL.
export function apiOrigin(value: string, production: boolean): string {
  const input = value.trim().replace(/\/+$/, '')
  if (!input) return ''
  let url: URL
  try { url = new URL(input) } catch { throw new Error('VITE_API_BASE_URL geçerli bir API origin’i olmalı.') }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/')
    throw new Error('VITE_API_BASE_URL yalnızca origin içermeli; kullanıcı bilgisi, path veya query kullanmayın.')
  const host = url.hostname.replace(/\.$/, '')
  const local = host === 'localhost' || host.endsWith('.localhost') || host === '[::1]' || host === '[::]'
    || /^127\./.test(host) || /^\[::ffff:7f[0-9a-f]{2}:[0-9a-f]{1,4}\]$/i.test(host) || host === '0.0.0.0'
  if (production && (url.protocol !== 'https:' || local)) throw new Error('Üretim API origin’i HTTPS kullanmalı ve localhost/loopback olmamalı.')
  return url.origin
}
