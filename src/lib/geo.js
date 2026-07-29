// Geolocation helpers for the Echo Map.

const EARTH_R = 6371000 // metres

// Great-circle distance between two lat/lon points, in metres.
export function distanceMeters(a, b) {
  if (!a || !b) return Infinity
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_R * Math.asin(Math.sqrt(h))
}

// Round to ~2 decimals (~1km) so the map centre never reveals an exact spot.
export function blurCoord({ lat, lon }) {
  return { lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100 }
}

// Offset a point by metres (used to scatter dummy echoes near the user).
export function offsetMeters({ lat, lon }, north, east) {
  const dLat = north / EARTH_R
  const dLon = east / (EARTH_R * Math.cos((lat * Math.PI) / 180))
  return {
    lat: lat + (dLat * 180) / Math.PI,
    lon: lon + (dLon * 180) / Math.PI,
  }
}

// Uniform random point within a circle (metres).
export function randomOffsetInRadius(center, maxRadiusM) {
  const angle = Math.random() * 2 * Math.PI
  const dist = Math.sqrt(Math.random()) * maxRadiusM
  return offsetMeters(center, dist * Math.cos(angle), dist * Math.sin(angle))
}

// Keep a point within maxRadiusM of center.
export function clampToRadius(center, point, maxRadiusM) {
  const d = distanceMeters(center, point)
  if (d <= maxRadiusM) return point
  const scale = maxRadiusM / d
  return {
    lat: center.lat + (point.lat - center.lat) * scale,
    lon: center.lon + (point.lon - center.lon) * scale,
  }
}

function hashEchoSeed(id) {
  let h1 = 0
  let h2 = 0
  const s = String(id ?? '')
  for (let i = 0; i < s.length; i += 1) {
    h1 = (h1 * 31 + s.charCodeAt(i)) >>> 0
    h2 = (h2 * 17 + s.charCodeAt(i)) >>> 0
  }
  return {
    a: (h1 % 10000) / 10000,
    b: (h2 % 10000) / 10000,
  }
}

// Deterministic neighborhood fuzz — bat hints never reveal the exact pin.
export function fuzzHintCoord(echoId, { lat, lon }, fuzzRadiusM = 400) {
  const { a, b } = hashEchoSeed(echoId)
  const angle = a * 2 * Math.PI
  const dist = fuzzRadiusM * (0.45 + b * 0.55)
  return offsetMeters({ lat, lon }, dist * Math.cos(angle), dist * Math.sin(angle))
}

// Coarse, IP-based location. Used ONLY as a dev fallback when the page is
// served over an insecure origin (e.g. http://LAN-IP) where the browser
// blocks the precise Geolocation API. Not used in production.
export async function approxLocationByIp() {
  const res = await fetch('https://ipapi.co/json/')
  if (!res.ok) throw new Error('ip lookup failed')
  const data = await res.json()
  const lat = Number(data.latitude)
  const lon = Number(data.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error('no coords from ip lookup')
  }
  return { lat, lon, city: data.city || null }
}

export async function reverseGeocode(lat, lon) {
  const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
  const res = await fetch(url)
  if (!res.ok) throw new Error('geocode failed')
  const data = await res.json()
  return data.city || data.locality || data.principalSubdivision || data.countryName || 'your region'
}

/** Forward geocode — search cities and places (Nominatim / OSM). */
export async function forwardGeocode(query) {
  const q = (query || '').trim()
  if (!q) return []
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', q)
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', '8')
  url.searchParams.set('addressdetails', '1')
  const res = await fetch(url, {
    headers: { 'Accept-Language': 'en', 'User-Agent': 'MISAO Echo Map' },
  })
  if (!res.ok) throw new Error('place search failed')
  const rows = await res.json()
  return (rows ?? []).map((row) => ({
    id: row.place_id,
    label: row.display_name,
    shortLabel: [row.address?.city, row.address?.town, row.address?.village, row.address?.state, row.address?.country]
      .filter(Boolean)
      .slice(0, 2)
      .join(', ') || row.display_name,
    lat: Number(row.lat),
    lon: Number(row.lon),
    type: row.type,
    city: row.address?.city || row.address?.town || row.address?.village || null,
    country: row.address?.country || null,
  })).filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lon))
}
