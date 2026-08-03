/** Profile hub row badges — actionable "new" only, cleared when opened. */

const psSeenKey = (userId) => `misao-ps-hub-seen-${userId || 'anon'}`
const foldsSeenKey = (userId) => `misao-folds-hub-seen-${userId || 'anon'}`

export const FOLDS_HUB_BADGE_EVENT = 'frens:folds-hub-badge'

function readSeenCount(key) {
  try {
    const raw = localStorage.getItem(key)
    const n = Number(raw)
    return Number.isFinite(n) && n >= 0 ? n : 0
  } catch {
    return 0
  }
}

function writeSeenCount(key, count) {
  try {
    localStorage.setItem(key, String(Math.max(0, Number(count) || 0)))
  } catch { /* ignore */ }
}

/** P.S. — new letters (pending + ready) since last open. */
export function markPsHubSeen(userId, pendingCount) {
  if (!userId) return
  writeSeenCount(psSeenKey(userId), pendingCount)
}

export function psHubBadgeCount(userId, pendingCount) {
  const pending = Number(pendingCount) || 0
  if (!userId || pending <= 0) return 0
  const seen = readSeenCount(psSeenKey(userId))
  if (pending <= seen) return 0
  return pending > 9 ? '9+' : pending
}

/** Folds hub — incoming peer/zine folds since last open. */
export function markFoldsHubSeen(userId, unreadCount) {
  if (!userId) return
  writeSeenCount(foldsSeenKey(userId), unreadCount)
  try {
    window.dispatchEvent(new CustomEvent(FOLDS_HUB_BADGE_EVENT))
  } catch { /* ignore */ }
}

export function foldsHubBadgeCount(userId, unreadCount) {
  const unread = Number(unreadCount) || 0
  if (!userId || unread <= 0) return 0
  const seen = readSeenCount(foldsSeenKey(userId))
  if (unread <= seen) return 0
  return unread > 9 ? '9+' : unread
}
