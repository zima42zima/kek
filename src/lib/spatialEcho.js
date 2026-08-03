/** Spatial echo anchors — web layer with LiDAR-ready metadata for native AR later. */

export const SPATIAL_ECHO_VERSION = 1

/** Dev-only: localStorage.setItem('frens-lidar-dev','1') to test LiDAR UI on desktop. */
export function isLidarDevForce() {
  try {
    return import.meta.env.DEV && localStorage.getItem('frens-lidar-dev') === '1'
  } catch {
    return false
  }
}

export function supportsLidarFilters(tier) {
  return tier === 'lidar' || isLidarDevForce()
}

function isIOSDevice() {
  const ua = navigator.userAgent || ''
  return /iPhone|iPad|iPod/.test(ua)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isIPadDevice() {
  const ua = navigator.userAgent || ''
  return /iPad/.test(ua)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

/** Weak heuristic for iPhone Pro / iPad Pro class hardware (LiDAR-capable family). */
function isLidarLikelyDevice() {
  if (!isIOSDevice()) return false
  if (isIPadDevice()) return true
  const narrow = Math.min(screen.width, screen.height)
  return narrow >= 390
}

/**
 * Probe whether this device can do spatial echo placement.
 * Returns tier: 'lidar' | 'spatial' | 'none'
 */
export async function probeSpatialEchoSupport() {
  if (!window.isSecureContext) {
    return { supported: false, tier: 'none', reason: 'Secure connection (HTTPS) required' }
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return { supported: false, tier: 'none', reason: 'Camera not available' }
  }

  const hasOrientation = typeof DeviceOrientationEvent !== 'undefined'
  let hasWebXR = false
  if (navigator.xr?.isSessionSupported) {
    try {
      hasWebXR = await navigator.xr.isSessionSupported('immersive-ar')
    } catch { /* unsupported */ }
  }

  const lidarLikely = isLidarLikelyDevice() || isLidarDevForce()
  let tier = 'none'
  if (hasWebXR || (lidarLikely && hasOrientation) || isLidarDevForce()) tier = 'lidar'
  else if (hasOrientation) tier = 'spatial'

  return {
    supported: tier !== 'none',
    tier,
    hasWebXR,
    hasOrientation,
    lidarLikely,
    label: tier === 'lidar' ? 'Spatial + motion' : tier === 'spatial' ? 'Spatial pinning' : '',
  }
}

export async function probeCameraPermission() {
  try {
    const status = await navigator.permissions?.query?.({ name: 'camera' })
    if (status?.state) return status.state
  } catch { /* Safari / older browsers */ }
  return 'unknown'
}

/** Subscribe to device orientation; returns cleanup. */
export function watchDeviceOrientation(onReading) {
  if (typeof DeviceOrientationEvent === 'undefined') return () => {}

  function handler(e) {
    onReading({
      alpha: e.alpha,
      beta: e.beta,
      gamma: e.gamma,
      absolute: e.absolute,
    })
  }

  function attach() {
    window.addEventListener('deviceorientation', handler, true)
  }

  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission()
      .then((state) => { if (state === 'granted') attach() })
      .catch(() => {})
    return () => window.removeEventListener('deviceorientation', handler, true)
  }

  attach()
  return () => window.removeEventListener('deviceorientation', handler, true)
}

export function createSpatialAnchor({
  point,
  orientation,
  position,
  plane = 'wall',
  tier = 'spatial',
}) {
  return {
    v: SPATIAL_ECHO_VERSION,
    tier,
    point: {
      nx: clamp01(point.nx),
      ny: clamp01(point.ny),
    },
    orientation: orientation && orientation.alpha != null
      ? {
          alpha: orientation.alpha,
          beta: orientation.beta,
          gamma: orientation.gamma,
        }
      : null,
    plane,
    placedAt: Date.now(),
    position: position
      ? {
          lat: position.lat,
          lon: position.lon,
          accuracy: position.accuracy ?? null,
        }
      : null,
  }
}

/** Offset pin on screen based on how much the viewer rotated since placement. */
export function spatialPinOffset(anchor, currentOrientation) {
  if (!anchor?.point || !anchor.orientation || !currentOrientation) {
    return { nx: anchor?.point?.nx ?? 0.5, ny: anchor?.point?.ny ?? 0.5 }
  }

  const dAlpha = normalizeAngle(currentOrientation.alpha - anchor.orientation.alpha)
  const dGamma = (currentOrientation.gamma ?? 0) - (anchor.orientation.gamma ?? 0)

  const nx = clamp01(anchor.point.nx + dAlpha * 0.0018)
  const ny = clamp01(anchor.point.ny + dGamma * 0.004)

  return { nx, ny }
}

export function spatialTierLabel(tier) {
  if (tier === 'lidar') return 'Spatial'
  if (tier === 'spatial') return 'Spatial'
  return ''
}

export function planeLabel(plane) {
  if (plane === 'floor') return 'Floor'
  if (plane === 'table') return 'Surface'
  return 'Wall'
}

function clamp01(n) {
  return Math.min(1, Math.max(0, n))
}

function normalizeAngle(deg) {
  if (deg == null || Number.isNaN(deg)) return 0
  let a = deg % 360
  if (a > 180) a -= 360
  if (a < -180) a += 360
  return a
}
