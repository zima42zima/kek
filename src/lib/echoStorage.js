import { ECHO_SEARCH_RADIUS_KEY, ECHO_DEFAULT_SEARCH_RADIUS_M } from './echoConstants'
import { clampSearchRadius } from './echoRange'

const ECHO_KEY = (userId) => `frens-echoes-v1-${userId || 'anon'}`
const DISCOVERED_KEY = (userId) => `frens-echo-discovered-v1-${userId || 'anon'}`
const HINTED_KEY = (userId) => `frens-echo-hinted-v1-${userId || 'anon'}`
const AURA_KEY = (userId) => `frens-echo-aura-v1-${userId || 'anon'}`
const HISTORY_KEY = (userId) => `frens-echo-history-v1-${userId || 'anon'}`
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
