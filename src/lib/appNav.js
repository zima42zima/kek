/** URL routes for the main app shell (Home tabs + sub-views). */

const KNOWN_PREFIXES = ['echoes', 'caves', 'messages', 'profile', 'rabbit', 'playlists', 'gatherer']

export function isKnownAppPath(pathname) {
  const path = normalizePath(pathname)
  if (path === '/' || path === '/home') return true
  const head = path.split('/').filter(Boolean)[0]
  return KNOWN_PREFIXES.includes(head)
}

function normalizePath(pathname) {
  if (!pathname) return '/'
  const trimmed = pathname.replace(/\/+$/, '')
  return trimmed || '/'
}

export function buildAppPath({
  tab = 'home',
  postId = null,
  caveId = null,
  conversationId = null,
  topicId = null,
  echoId = null,
  playlistsUserId = null,
  playlistId = null,
  gathererUserId = null,
  moodboardId = null,
} = {}) {
  switch (tab) {
    case 'home': {
      if (postId) return `/?post=${encodeURIComponent(postId)}`
      return '/'
    }
    case 'echoes': {
      if (echoId) return `/echoes?echo=${encodeURIComponent(echoId)}`
      return '/echoes'
    }
    case 'caves':
      return caveId ? `/caves/${encodeURIComponent(caveId)}` : '/caves'
    case 'messages':
      return conversationId ? `/messages/${encodeURIComponent(conversationId)}` : '/messages'
    case 'profile':
      return '/profile'
    case 'rabbit':
      return topicId ? `/rabbit/${encodeURIComponent(topicId)}` : '/rabbit'
    case 'playlists': {
      const q = new URLSearchParams()
      if (playlistsUserId) q.set('user', playlistsUserId)
      if (playlistId) q.set('playlist', playlistId)
      const qs = q.toString()
      return qs ? `/playlists?${qs}` : '/playlists'
    }
    case 'gatherer': {
      const q = new URLSearchParams()
      if (gathererUserId) q.set('user', gathererUserId)
      if (moodboardId) q.set('board', moodboardId)
      const qs = q.toString()
      return qs ? `/gatherer?${qs}` : '/gatherer'
    }
    default:
      return '/'
  }
}

export function parseAppRoute(location) {
  const path = normalizePath(location?.pathname)
  const params = new URLSearchParams(location?.search || '')

  if (path === '/' || path === '/home') {
    return { tab: 'home', postId: params.get('post') || null }
  }

  const parts = path.split('/').filter(Boolean)
  const head = parts[0]

  if (head === 'echoes') {
    return { tab: 'echoes', echoId: params.get('echo') || null }
  }
  if (head === 'caves') {
    return { tab: 'caves', caveId: parts[1] ? decodeURIComponent(parts[1]) : null }
  }
  if (head === 'messages') {
    return { tab: 'messages', conversationId: parts[1] ? decodeURIComponent(parts[1]) : null }
  }
  if (head === 'profile') {
    return { tab: 'profile' }
  }
  if (head === 'rabbit') {
    return { tab: 'rabbit', topicId: parts[1] ? decodeURIComponent(parts[1]) : null }
  }
  if (head === 'playlists') {
    return {
      tab: 'playlists',
      playlistsUserId: params.get('user') || null,
      playlistId: params.get('playlist') || null,
    }
  }
  if (head === 'gatherer') {
    return {
      tab: 'gatherer',
      gathererUserId: params.get('user') || null,
      moodboardId: params.get('board') || null,
    }
  }

  return { tab: 'home' }
}

/** Navigate helper: `goApp(navigate, { tab: 'caves', caveId: '…' })` */
export function goApp(navigate, patch, { replace = false } = {}) {
  navigate(buildAppPath(patch), { replace })
}
