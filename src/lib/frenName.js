import { supabase } from '../supabaseClient'

const RESERVED_HANDLES = new Set([
  'frens', 'admin', 'founder', 'anonymous', 'null', 'nameless', 'nameless fren',
])

/** Permanent @handle — lowercase, unique, set once at signup. */
export function normalizeFrenHandle(value) {
  return (value || '').trim().toLowerCase()
}

export function validateFrenHandleFormat(handle) {
  const h = normalizeFrenHandle(handle)
  if (h.length < 3) return 'At least 3 characters.'
  if (h.length > 20) return 'Max 20 characters.'
  if (!/^[a-z][a-z0-9_]*$/.test(h)) {
    return 'Start with a letter; use letters, numbers, underscores only.'
  }
  if (RESERVED_HANDLES.has(h)) return 'That handle is reserved.'
  return null
}

/** Changeable display name — what shows on posts (not unique). */
export function normalizeDisplayName(value) {
  return (value || '').replace(/\s+/g, ' ').trim()
}

export function validateDisplayNameFormat(name) {
  const n = normalizeDisplayName(name)
  if (!n) return 'Display name cannot be empty.'
  if (n.length > 40) return 'Max 40 characters.'
  return null
}

// Backwards-compatible aliases used across the app.
export const normalizeFrenName = normalizeDisplayName
export const validateFrenNameFormat = validateDisplayNameFormat

export async function isFrenHandleAvailable(handle, { excludeUserId = null } = {}) {
  const formatErr = validateFrenHandleFormat(handle)
  if (formatErr) return { ok: false, reason: formatErr }

  const { data, error } = await supabase.rpc('check_fren_handle_available', {
    p_handle: normalizeFrenHandle(handle),
    p_exclude_user: excludeUserId,
  })

  if (error) {
    if (error.code === 'PGRST202') {
      return isFrenNameAvailableLegacy(handle, { excludeUserId })
    }
    return { ok: false, reason: error.message }
  }

  if (!data) return { ok: false, reason: 'That handle is already taken.' }
  return { ok: true, reason: null }
}

async function isFrenNameAvailableLegacy(handle, { excludeUserId = null } = {}) {
  const { data, error } = await supabase.rpc('check_fren_name_available', {
    p_name: normalizeFrenHandle(handle),
    p_exclude_user: excludeUserId,
  })
  if (error) {
    if (error.code === 'PGRST202') return { ok: true, reason: null, needsSql: true }
    return { ok: false, reason: error.message }
  }
  if (!data) return { ok: false, reason: 'That handle is already taken.' }
  return { ok: true, reason: null }
}

/** @deprecated use isFrenHandleAvailable */
export async function isFrenNameAvailable(name, opts) {
  return isFrenHandleAvailable(name, opts)
}

export function frenHandleErrorMessage(err) {
  const msg = err?.message || ''
  if (/already taken/i.test(msg)) return 'That handle is already taken.'
  if (/already set/i.test(msg)) return 'Your handle is already set and cannot be changed.'
  if (/reserved/i.test(msg)) return 'That handle is reserved.'
  return msg || 'Could not save handle.'
}

export function displayNameErrorMessage(err) {
  const msg = err?.message || ''
  if (/max 40/i.test(msg)) return 'Display name max 40 characters.'
  return msg || 'Could not save display name.'
}

export function frenNameErrorMessage(err) {
  return displayNameErrorMessage(err)
}

export function formatFrenHandle(handle) {
  const h = normalizeFrenHandle(handle)
  return h ? `@${h}` : ''
}
