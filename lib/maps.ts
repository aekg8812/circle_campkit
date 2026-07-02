export function createGoogleMapsSearchUrl(query: string) {
  const trimmed = query.trim()
  if (!trimmed) return ''
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`
}
