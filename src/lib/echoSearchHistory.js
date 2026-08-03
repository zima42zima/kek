const KEY = 'frens-echo-search-history-v1'
const MAX = 5

export function loadEchoSearchHistory() {
  try {
    const raw = localStorage.getItem(KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr.slice(0, MAX) : []
  } catch {
    return []
  }
}

export function pushEchoSearchHistory(place) {
  if (!place?.lat || !place?.lon || !place?.label) return loadEchoSearchHistory()
  const entry = {
    id: place.id ?? `${place.lat},${place.lon}`,
    label: place.label,
    lat: place.lat,
    lon: place.lon,
    zoom: place.zoom ?? 12,
    at: Date.now(),
  }
  const prev = loadEchoSearchHistory().filter((p) => p.id !== entry.id && p.label !== entry.label)
  const next = [entry, ...prev].slice(0, MAX)
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch { /* ignore */ }
  return next
}

/** Sensible map zoom from Nominatim place type. */
export function zoomForPlaceType(type) {
  const t = (type || '').toLowerCase()
  if (['continent', 'sea'].includes(t)) return 4
  if (['country', 'state', 'region'].includes(t)) return 6
  if (['county', 'district', 'municipality'].includes(t)) return 9
  if (['city', 'town', 'borough'].includes(t)) return 11
  if (['village', 'suburb', 'neighbourhood', 'quarter'].includes(t)) return 13
  if (['house', 'building', 'road', 'pedestrian', 'footway'].includes(t)) return 16
  return 12
}
