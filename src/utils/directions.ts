export function validCoordinates(latitude: unknown, longitude: unknown): boolean {
  return typeof latitude === 'number' && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
    && typeof longitude === 'number' && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180
}
// A customer address is data, never a caller-supplied URL or an inferred location.
export function googleDirectionsUrl(address: string | null | undefined, latitude?: number | null, longitude?: number | null): string | null {
  const destination = validCoordinates(latitude, longitude) ? `${latitude},${longitude}` : address?.trim()
  if (!destination) return null
  const url = new URL('https://www.google.com/maps/dir/')
  url.search = new URLSearchParams({ api: '1', destination, travelmode: 'driving', dir_action: 'navigate' }).toString()
  // Maps URLs have a 2,048-character limit. Never silently truncate an address.
  return url.href.length <= 2048 ? url.href : null
}
