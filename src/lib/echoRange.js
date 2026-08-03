import { distanceMeters, blurCoord } from './geo'
import {
  ECHO_CITY_RADIUS_M,
  ECHO_DISCOVER_RADIUS_MIN_M,
  ECHO_RANGE_PRESETS,
} from './echoConstants'

const PRESET_BY_METERS = new Map(ECHO_RANGE_PRESETS.map((p) => [p.meters, p]))

export function clampDiscoverRadius(m) {
  const n = Number(m)
  if (!Number.isFinite(n)) return ECHO_RANGE_PRESETS[1]?.meters ?? 800
  return Math.min(ECHO_CITY_RADIUS_M, Math.max(ECHO_DISCOVER_RADIUS_MIN_M, Math.round(n)))
}

export function clampSearchRadius(m) {
  return clampDiscoverRadius(m)
}

/** Per-echo discover radius set by the publisher (defaults to 800m). */
export function echoDiscoverRadiusM(echo) {
  return clampDiscoverRadius(echo?.discoverRadiusM ?? 800)
}

export function isCityDiscoverRadius(echo) {
  return echoDiscoverRadiusM(echo) >= ECHO_CITY_RADIUS_M
}

export function formatRangeM(m) {
  const n = Math.round(m)
  if (n >= 1000) {
    const km = n / 1000
    return Number.isInteger(km) ? `${km}km` : `${km.toFixed(1)}km`
  }
  return `${n}m`
}

export function rangePresetLabel(meters) {
  return PRESET_BY_METERS.get(meters)?.label ?? formatRangeM(meters)
}

export function rangePresetHint(meters) {
  return PRESET_BY_METERS.get(meters)?.hint ?? ''
}

/** Fuzzy distance label — never reveals exact pin location. */
export function distanceBucket(meters) {
  if (!Number.isFinite(meters)) return 'nearby'
  if (meters < 180) return 'very close'
  if (meters < 450) return 'nearby'
  if (meters < 900) return 'in the area'
  return 'around here'
}

export function echoDistanceM(echo, userPos) {
  if (!echo || !userPos) return Infinity
  return distanceMeters(userPos, { lat: echo.lat, lon: echo.lon })
}

export function isInDiscoverRange(echo, userPos) {
  return echoDistanceM(echo, userPos) <= echoDiscoverRadiusM(echo)
}

/** Whether an echo should appear in map scan / hints / fetch (viewer search vs publisher city range). */
export function isEchoScannable(echo, userPos, searchRadiusM) {
  const dist = echoDistanceM(echo, userPos)
  if (isCityDiscoverRadius(echo)) return dist <= echoDiscoverRadiusM(echo)
  return dist <= clampSearchRadius(searchRadiusM)
}

export function isInSearchRange(echo, userPos, searchRadiusM) {
  return isEchoScannable(echo, userPos, searchRadiusM)
}

/** Whether publisher pinned a named public venue at block-level (420m) range. */
export function isNamedExactPlace(echo) {
  return Boolean(echo?.placeLabel?.trim())
    && echoDiscoverRadiusM(echo) <= ECHO_DISCOVER_RADIUS_MIN_M
}

/** Map target when tapping the world icon — city-level unless a named venue at 420m. */
export function echoMapNavTarget(echo) {
  if (!echo || echo.visibility !== 'world') return null
  if (echo.lat == null || echo.lon == null) return null

  if (isNamedExactPlace(echo)) {
    return {
      lat: echo.lat,
      lon: echo.lon,
      label: echo.placeLabel.trim(),
      zoom: 17,
      exact: true,
    }
  }

  const { lat, lon } = blurCoord({ lat: echo.lat, lon: echo.lon })
  return {
    lat,
    lon,
    label: echo.cityLabel?.trim() || 'this city',
    zoom: 12,
    exact: false,
  }
}

export function sortByDistance(echoes, userPos) {
  return [...echoes].sort((a, b) => echoDistanceM(a, userPos) - echoDistanceM(b, userPos))
}

export function echoInSameCity(echo, cityLabel) {
  if (!echo || !cityLabel || cityLabel === 'your region') return false
  const city = (echo.cityLabel || '').trim().toLowerCase()
  if (!city) return false
  const head = String(cityLabel).split(',')[0].trim().toLowerCase()
  if (!head) return false
  return city.includes(head) || head.includes(city)
}

/** Whether an echo belongs to the place/city the map is centered on (explore mode). */
export function echoMatchesExplorePlace(echo, place) {
  if (!echo || echo.lat == null || echo.lon == null) return false
  if (!place?.lat || !place?.lon) return true

  const dist = distanceMeters(
    { lat: place.lat, lon: place.lon },
    { lat: echo.lat, lon: echo.lon },
  )
  if (dist <= ECHO_CITY_RADIUS_M) return true

  const needle = (place.label || place.cityLabel || '').trim().toLowerCase()
  if (!needle) return true
  const head = needle.split(',')[0].trim()
  const city = (echo.cityLabel || '').trim().toLowerCase()
  const venue = (echo.placeLabel || '').trim().toLowerCase()
  if (city && (needle.includes(city) || city.includes(head))) return true
  if (venue && (needle.includes(venue) || venue.includes(head))) return true
  return false
}

export function sortByDistanceFrom(echoes, anchor) {
  if (!anchor?.lat || !anchor?.lon) return [...echoes]
  return [...echoes].sort((a, b) => {
    const da = distanceMeters(anchor, { lat: a.lat, lon: a.lon })
    const db = distanceMeters(anchor, { lat: b.lat, lon: b.lon })
    return da - db
  })
}
