import { ECHO_PUBLIC_VISIBILITIES } from './echoConstants'

export function isFrenOf(echo, { followingIds, followerIds } = {}) {
  if (!echo?.ownerId) return false
  return Boolean(followingIds?.has(echo.ownerId) || followerIds?.has(echo.ownerId))
}

/** Whether this echo can show a flying-bat hint on the map. */
export function canHintEcho(echo, { followingIds, followerIds }) {
  if (!echo || echo.mine) return false
  if (!ECHO_PUBLIC_VISIBILITIES.has(echo.visibility)) return false
  if (echo.visibility === 'friends' && !isFrenOf(echo, { followingIds, followerIds })) return false
  return true
}

/** Whether proximity discovery / notifications should fire for this echo. */
export function canDiscoverEcho(echo, { followingIds, followerIds }) {
  if (!echo || echo.mine) return false
  if (!ECHO_PUBLIC_VISIBILITIES.has(echo.visibility)) return false
  if (echo.visibility === 'friends' && !isFrenOf(echo, { followingIds, followerIds })) return false
  return true
}

/** Whether an exact pin may appear on the map (mine or already discovered). */
export function canShowEchoPin(echo, { discovered }) {
  if (!echo) return false
  if (echo.mine) return true
  if (!ECHO_PUBLIC_VISIBILITIES.has(echo.visibility)) return false
  return discovered?.has(echo.id)
}

/** World-map echoes — viewable from anywhere on the explore map. */
export function canBrowseGlobally(echo) {
  return Boolean(echo?.browseGlobally && echo.visibility === 'world')
}

/** Can open echo playback without walking into discover range. */
export function canOpenRemotely(echo, { discovered, followingIds, followerIds }) {
  if (!echo) return false
  if (echo.mine) return true
  if (discovered?.has(echo.id)) return true
  if (canBrowseGlobally(echo)) return true
  if (echo.visibility === 'friends' && isFrenOf(echo, { followingIds, followerIds })) return true
  return false
}
