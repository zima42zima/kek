import { distanceMeters } from './geo'
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

export function sortByDistance(echoes, userPos) {
  return [...echoes].sort((a, b) => echoDistanceM(a, userPos) - echoDistanceM(b, userPos))
}
