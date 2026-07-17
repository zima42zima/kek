const POST_FOCUS_KEY = 'frens-focus-post'
const ECHO_FOCUS_KEY = 'frens-focus-echo'
const PLAYLISTS_FOCUS_KEY = 'frens-focus-playlists'
const GATHERER_FOCUS_KEY = 'frens-focus-gatherer'

/** Queue scrolling to a feed post (survives tab navigation). */
export function requestPostFocus({ postId, openComments = false }) {
  if (!postId) return
  try {
    sessionStorage.setItem(POST_FOCUS_KEY, JSON.stringify({ postId: String(postId), openComments }))
  } catch { /* ignore */ }
}

export function consumePostFocus() {
  try {
    const raw = sessionStorage.getItem(POST_FOCUS_KEY)
    if (!raw) return null
    sessionStorage.removeItem(POST_FOCUS_KEY)
    const parsed = JSON.parse(raw)
    if (!parsed?.postId) return null
    return {
      postId: String(parsed.postId),
      openComments: Boolean(parsed.openComments),
    }
  } catch {
    return null
  }
}

/** Queue opening a specific echo on the Echo Map tab. */
export function requestEchoFocus(echoId) {
  if (!echoId) return
  try {
    sessionStorage.setItem(ECHO_FOCUS_KEY, String(echoId))
  } catch { /* ignore */ }
}

export function consumeEchoFocus() {
  try {
    const id = sessionStorage.getItem(ECHO_FOCUS_KEY)
    if (!id) return null
    sessionStorage.removeItem(ECHO_FOCUS_KEY)
    return id
  } catch {
    return null
  }
}

/** Queue opening a fren's playlists section (null userId = own). */
export function requestOpenPlaylists(userId = null, playlistId = null) {
  try {
    sessionStorage.setItem(
      PLAYLISTS_FOCUS_KEY,
      JSON.stringify({ userId: userId || null, playlistId: playlistId || null }),
    )
  } catch { /* ignore */ }
}

export function consumeOpenPlaylists() {
  try {
    const raw = sessionStorage.getItem(PLAYLISTS_FOCUS_KEY)
    if (!raw) return null
    sessionStorage.removeItem(PLAYLISTS_FOCUS_KEY)
    const parsed = JSON.parse(raw)
    return {
      userId: parsed?.userId || null,
      playlistId: parsed?.playlistId || null,
    }
  } catch {
    return null
  }
}

/** Queue opening a fren's moodboard / gatherer section (null userId = own). */
export function requestOpenGatherer(userId = null, moodboardId = null) {
  try {
    sessionStorage.setItem(
      GATHERER_FOCUS_KEY,
      JSON.stringify({ userId: userId || null, moodboardId: moodboardId || null }),
    )
  } catch { /* ignore */ }
}

export function consumeOpenGatherer() {
  try {
    const raw = sessionStorage.getItem(GATHERER_FOCUS_KEY)
    if (!raw) return null
    sessionStorage.removeItem(GATHERER_FOCUS_KEY)
    const parsed = JSON.parse(raw)
    return {
      userId: parsed?.userId || null,
      moodboardId: parsed?.moodboardId || null,
    }
  } catch {
    return null
  }
}

export function isNotificationClickable(n) {
  if (!n) return false
  if (n.type === 'follow' && n.actorId) return true
  if ((n.type === 'aura' || n.type === 'comment') && n.postId) return true
  if (n.type === 'dm' && n.conversationId) return true
  if ((n.type === 'rabbit_reply' || n.type === 'rabbit_follow') && n.rabbitTopicId) return true
  if (n.type === 'owl_letter') return true
  if ((n.type === 'cave' || n.type === 'cave_add') && n.caveId) return true
  if (n.type === 'echo' && n.echoId) return true
  if (n.type === 'echo_follow' && n.echoId) return true
  if (n.type === 'echo_aura' && n.echoId) return true
  return false
}
