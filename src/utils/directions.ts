// A customer address is data, never a caller-supplied URL or an inferred location.
export function googleDirectionsUrl(address: string | null | undefined): string | null {
  if (!address?.trim()) return null
  const url = new URL('https://www.google.com/maps/dir/')
  url.search = new URLSearchParams({ api: '1', destination: address.trim(), travelmode: 'driving', dir_action: 'navigate' }).toString()
  // Maps URLs have a 2,048-character limit. Never silently truncate an address.
  return url.href.length <= 2048 ? url.href : null
}
