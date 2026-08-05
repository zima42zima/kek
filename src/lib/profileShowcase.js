/**
 * Opt-in “show on my profile” for taste + social hubs.
 * Default: nothing public — join caves / leave echoes / make playlists without displaying them.
 *
 * Prefs are stored in localStorage always, and in profiles.profile_showcase when that column exists.
 */
import { supabase } from '../supabaseClient'

export const SHOWCASE_KEYS = [
  { id: 'caves', label: 'Caves', group: 'social', hint: 'Caves you join or host' },
  { id: 'echoes', label: 'Aftersounds', group: 'social', hint: 'Public aftersounds on the map' },
  { id: 'playlists', label: 'Playlists', group: 'taste', hint: 'Playlists you keep' },
  { id: 'moodboards', label: 'Moodboards', group: 'taste', hint: 'Gatherer boards' },
  { id: 'folds', label: 'Folds', group: 'taste', hint: 'Published paper folds' },
]

const DEFAULTS = Object.fromEntries(SHOWCASE_KEYS.map((k) => [k.id, false]))

function storageKey(userId) {
  return `misao-profile-showcase-v1-${userId || 'anon'}`
}

export function normalizeShowcase(raw) {
  const out = { ...DEFAULTS }
  if (!raw || typeof raw !== 'object') return out
  for (const k of SHOWCASE_KEYS) {
    if (typeof raw[k.id] === 'boolean') out[k.id] = raw[k.id]
  }
  return out
}

export function loadShowcaseLocal(userId) {
  if (!userId) return { ...DEFAULTS }
  try {
    const raw = localStorage.getItem(storageKey(userId))
    return normalizeShowcase(raw ? JSON.parse(raw) : null)
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveShowcaseLocal(userId, prefs) {
  if (!userId) return normalizeShowcase(prefs)
  const next = normalizeShowcase(prefs)
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(next))
  } catch { /* ignore */ }
  return next
}

/** Load showcase for any user (DB when available, else local — only accurate for self offline). */
export async function loadShowcasePrefs(userId) {
  if (!userId) return { ...DEFAULTS }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('profile_showcase')
      .eq('id', userId)
      .maybeSingle()
    if (!error && data && data.profile_showcase != null) {
      const fromDb = normalizeShowcase(data.profile_showcase)
      // Keep own local mirror in sync when reading self
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user?.id === userId) saveShowcaseLocal(userId, fromDb)
      } catch { /* ignore */ }
      return fromDb
    }
  } catch { /* column missing or RLS */ }

  return loadShowcaseLocal(userId)
}

/** Save prefs for the signed-in user. */
export async function saveShowcasePrefs(userId, prefs) {
  const next = saveShowcaseLocal(userId, prefs)
  if (!userId) return next

  try {
    const { error } = await supabase
      .from('profiles')
      .update({ profile_showcase: next })
      .eq('id', userId)
    if (error && import.meta.env.DEV) {
      console.warn('profile_showcase not saved to DB (run supabase-patch-profile-showcase.sql):', error.message)
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('profile_showcase update failed:', err?.message || err)
    }
  }
  return next
}

export function isShowcaseOn(prefs, key) {
  return Boolean(normalizeShowcase(prefs)[key])
}

/** Turn on a showcase hub when the user shares content (e.g. public cave on profile). */
export async function ensureShowcaseOn(userId, key) {
  if (!userId || !key) return normalizeShowcase(null)
  const prefs = await loadShowcasePrefs(userId)
  if (isShowcaseOn(prefs, key)) return prefs
  return saveShowcasePrefs(userId, { ...prefs, [key]: true })
}
