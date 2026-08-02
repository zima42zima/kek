/** Handoff: Home “_log” → Profile _log panel. */

const OPEN_TRAIL_KEY = 'frens-open-trail'

export function requestOpenTrail() {
  try {
    sessionStorage.setItem(OPEN_TRAIL_KEY, '1')
  } catch { /* ignore */ }
}

export function consumeOpenTrailFlag() {
  try {
    if (sessionStorage.getItem(OPEN_TRAIL_KEY) !== '1') return false
    sessionStorage.removeItem(OPEN_TRAIL_KEY)
    return true
  } catch {
    return false
  }
}
