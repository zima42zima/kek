import { ECHO_SEARCH_RADIUS_KEY, ECHO_DEFAULT_SEARCH_RADIUS_M } from './echoConstants'
import { clampSearchRadius } from './echoRange'

const ECHO_KEY = (userId) => `frens-echoes-v1-${userId || 'anon'}`
const DISCOVERED_KEY = (userId) => `frens-echo-discovered-v1-${userId || 'anon'}`
const HINTED_KEY = (userId) => `frens-echo-hinted-v1-${userId || 'anon'}`
const AURA_KEY = (userId) => `frens-echo-aura-v1-${userId || 'anon'}`
const HISTORY_KEY = (userId) => `frens-echo-history-v1-${userId || 'anon'}`
const COLLECTION_KEY = (userId) => `frens-echo-collection-v1-${userId || 'anon'}`
const WORLD_KEY = 'frens-world-echoes-v1'

export function loadSearchRadius() {
  try {
    const raw = localStorage.getItem(ECHO_SEARCH_RADIUS_KEY)
    if (raw) return clampSearchRadius(Number(raw))
  } catch { /* ignore */ }
  return ECHO_DEFAULT_SEARCH_RADIUS_M
}

export function saveSearchRadius(meters) {
  try {
    localStorage.setItem(ECHO_SEARCH_RADIUS_KEY, String(clampSearchRadius(meters)))
  } catch { /* quota */ }
}

export function loadEchoes(userId) {
  try {
    const raw = localStorage.getItem(ECHO_KEY(userId))
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

export function saveEchoes(userId, echoes) {
  try {
    localStorage.setItem(ECHO_KEY(userId), JSON.stringify(echoes.slice(0, 200)))
  } catch { /* quota */ }
}

export function loadWorldEchoes() {
  try {
    const raw = localStorage.getItem(WORLD_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

export function saveWorldEchoes(echoes) {
  try {
    localStorage.setItem(WORLD_KEY, JSON.stringify(echoes.slice(0, 500)))
  } catch { /* quota */ }
}

export function publishToWorldPool(echo) {
  const pool = loadWorldEchoes().filter((e) => e.id !== echo.id)
  const { mine, saved, ...rest } = echo
  pool.unshift({ ...rest, mine: false, saved: false })
  saveWorldEchoes(pool)
}

export function removeFromWorldPool(echoId) {
  saveWorldEchoes(loadWorldEchoes().filter((e) => e.id !== echoId))
}

export function loadDiscovered(userId) {
  try {
    const raw = localStorage.getItem(DISCOVERED_KEY(userId))
    const arr = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(arr) ? arr : [])
  } catch {
    return new Set()
  }
}

export function saveDiscovered(userId, discovered) {
  try {
    localStorage.setItem(DISCOVERED_KEY(userId), JSON.stringify([...discovered]))
  } catch { /* quota */ }
}

export function loadHinted(userId) {
  try {
    const raw = localStorage.getItem(HINTED_KEY(userId))
    const arr = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(arr) ? arr : [])
  } catch {
    return new Set()
  }
}

export function saveHinted(userId, hinted) {
  try {
    localStorage.setItem(HINTED_KEY(userId), JSON.stringify([...hinted]))
  } catch { /* quota */ }
}

export function loadEchoAura(userId) {
  try {
    const raw = localStorage.getItem(AURA_KEY(userId))
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function saveEchoAura(userId, auraMap) {
  try {
    localStorage.setItem(AURA_KEY(userId), JSON.stringify(auraMap))
  } catch { /* quota */ }
}

export function loadEchoHistory(userId) {
  try {
    const raw = localStorage.getItem(HISTORY_KEY(userId))
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

export function saveEchoHistory(userId, history) {
  try {
    localStorage.setItem(HISTORY_KEY(userId), JSON.stringify(history.slice(0, 300)))
  } catch { /* quota */ }
}

export function recordEchoHistory(userId, entry) {
  const history = loadEchoHistory(userId).filter((h) => h.echoId !== entry.echoId)
  history.unshift({ ...entry, listenedAt: Date.now() })
  saveEchoHistory(userId, history)
  return history
}

export function loadEchoCollection(userId) {
  try {
    const raw = localStorage.getItem(COLLECTION_KEY(userId))
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

export function saveEchoCollection(userId, entries) {
  try {
    localStorage.setItem(COLLECTION_KEY(userId), JSON.stringify(entries.slice(0, 200)))
  } catch { /* quota */ }
}

/** Move legacy saved echoes (stored in mine blob) into the collection store. */
export function migrateLegacySavedEchoes(userId) {
  if (!userId) return []
  const existing = loadEchoCollection(userId)
  const legacySaved = loadEchoes(userId).filter((e) => e.saved && !e.mine)
  if (legacySaved.length === 0) return existing

  const byId = new Map(existing.map((e) => [e.id, e]))
  legacySaved.forEach((e) => {
    if (!byId.has(e.id)) {
      byId.set(e.id, {
        ...e,
        mine: false,
        saved: true,
        savedAt: e.savedAt ?? e.createdAt ?? Date.now(),
        collectionPreviewUrl: e.collectionPreviewUrl ?? (e.kind === 'image' ? e.mediaUrl : null),
      })
    }
  })
  const merged = [...byId.values()].sort(
    (a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0),
  )
  saveEchoCollection(userId, merged)
  saveEchoes(userId, loadEchoes(userId).filter((e) => e.mine))
  return merged
}

export function addToEchoCollection(userId, echo) {
  if (!userId || !echo?.id || echo.mine) return loadEchoCollection(userId)
  const collectionPreviewUrl = echo.kind === 'image' && echo.mediaUrl
    ? echo.mediaUrl
    : null
  const entry = {
    ...echo,
    mine: false,
    saved: true,
    savedAt: Date.now(),
    collectionPreviewUrl,
  }
  const next = [entry, ...loadEchoCollection(userId).filter((e) => e.id !== echo.id)]
  saveEchoCollection(userId, next)
  return next
}

export function listProfileEchoes(ownerId) {
  if (!ownerId) return []
  const mine = loadEchoes(ownerId).filter(
    (e) => e.visibility === 'world' && e.shareOnProfile !== false,
  )
  const world = loadWorldEchoes().filter(
    (e) => e.ownerId === ownerId && e.visibility === 'world' && e.shareOnProfile !== false,
  )
  const byId = new Map()
  ;[...mine, ...world].forEach((e) => byId.set(e.id, e))
  return [...byId.values()].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
}

export async function blobToDataUrl(blob) {
  if (!blob) return null
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
