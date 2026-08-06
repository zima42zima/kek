import { supabase } from '../supabaseClient'
import { uploadMedia, retireMedia, StorageNotInstalledError } from './storage'
import { validateFrenHandleFormat } from './frenName'

const DB_SETUP_HINT =
  'Open Supabase → SQL Editor, run supabase-fix-profile-permissions.sql on the SAME project as your .env URL, then refresh.'

export function getSupabaseProjectRef() {
  const url = import.meta.env.VITE_SUPABASE_URL || ''
  const match = url.match(/https:\/\/([^.]+)\.supabase\.co/)
  return match?.[1] || null
}

function inferLegacyHandle(sillyName) {
  const raw = String(sillyName || '').trim()
  if (!raw || raw.toLowerCase() === 'nameless fren') return null
  const candidate = raw.toLowerCase()
  return validateFrenHandleFormat(candidate) ? null : candidate
}

/** Upload profile photo to storage (fresh path). Caller retires previousUrl after DB save. */
export async function persistProfileAvatar(dataUrl, { prefix = 'avatars' } = {}) {
  if (!dataUrl) return { avatarType: 'frog', avatarUrl: null }

  try {
    const blob = await (await fetch(dataUrl)).blob()
    const url = await uploadMedia(blob, { prefix })
    return { avatarType: 'photo', avatarUrl: url }
  } catch (err) {
    if (!(err instanceof StorageNotInstalledError)) {
      console.error('Profile avatar upload failed:', err.message)
    }
    return { avatarType: 'photo', avatarUrl: dataUrl }
  }
}

async function readMyProfileMediaUrls(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('avatar_url, cover_url')
    .eq('id', userId)
    .maybeSingle()
  return {
    avatarUrl: data?.avatar_url || null,
    coverUrl: data?.cover_url || null,
  }
}

export function mapDbProfile(row, email) {
  if (!row) return null

  return {
    id: row.id,
    frenHandle: row.fren_handle || inferLegacyHandle(row.silly_name),
    frenName: row.silly_name,
    oneHumanThing: row.one_human_thing,
    bio: row.bio ?? row.current_vibe ?? null,
    avatarType: row.avatar_type || 'frog',
    avatarUrl: row.avatar_url,
    coverUrl: row.cover_url ?? null,
    cosmosUrl: row.cosmos_url ?? null,
    shareLocation: row.share_location ?? false,
    isFounder: row.is_founder ?? false,
    isCofounder: row.is_cofounder ?? false,
    suspendedAt: row.suspended_at ?? null,
    email: email ?? null,
  }
}

function wrapProfileError(error) {
  if (!error) return error

  const project = getSupabaseProjectRef()
  const projectHint = project ? ` (project: ${project})` : ''

  if (error.message?.includes('permission denied')) {
    return new Error(`Database permissions missing${projectHint}. ${DB_SETUP_HINT}`)
  }
  if (error.code === 'PGRST202') {
    return new Error(`Profile save functions not installed${projectHint}. ${DB_SETUP_HINT}`)
  }
  if (error.message === 'Not authenticated') {
    return new Error('You are not signed in. Log in again and retry.')
  }
  return error
}

async function requireUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) throw new Error(error.message)
  if (!user) throw new Error('You are not signed in. Log in again and retry.')
  return user
}

function rpcPayload(fields) {
  return {
    p_silly_name: fields.silly_name ?? null,
    p_one_human_thing: fields.one_human_thing ?? null,
    p_bio: fields.bio ?? null,
    p_avatar_url: fields.avatar_url ?? null,
    p_avatar_type: fields.avatar_type ?? null,
    p_share_location: fields.share_location ?? null,
    p_is_founder: fields.is_founder ?? null,
  }
}

export async function checkProfileDbSetup() {
  const project = getSupabaseProjectRef()
  const { error: rpcError } = await supabase.rpc('get_my_profile')

  if (rpcError?.code === 'PGRST202') {
    return {
      ok: false,
      project,
      message: `Profile functions missing on Supabase project${project ? ` "${project}"` : ''}. Run supabase-fix-profile-permissions.sql in SQL Editor.`,
    }
  }

  const { error: tableError } = await supabase.from('profiles').select('id').limit(1)
  if (tableError?.message?.includes('permission denied')) {
    return {
      ok: false,
      project,
      message: `Table permissions missing on Supabase project${project ? ` "${project}"` : ''}. Run supabase-fix-profile-permissions.sql in SQL Editor.`,
    }
  }

  return { ok: true, project, message: null }
}

async function fetchProfileViaTable(userId, email) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return mapDbProfile(data, email)
}

async function fetchProfileViaRpc(email) {
  const { data, error } = await supabase.rpc('get_my_profile')
  if (error) throw error

  const row = Array.isArray(data) ? data[0] : data
  return mapDbProfile(row, email)
}

export async function fetchProfileForUser(userId, email) {
  const user = await requireUser()
  if (user.id !== userId) {
    throw new Error('Session mismatch. Sign out and log in again.')
  }

  try {
    const fromRpc = await fetchProfileViaRpc(email)
    if (fromRpc) return fromRpc
  } catch (rpcError) {
    if (rpcError.code === 'PGRST202') {
      try {
        return await fetchProfileViaTable(userId, email)
      } catch {
        throw wrapProfileError(rpcError)
      }
    }
    try {
      return await fetchProfileViaTable(userId, email)
    } catch {
      throw wrapProfileError(rpcError)
    }
  }

  return fetchProfileViaTable(userId, email)
}

async function upsertProfileViaRpc(fields) {
  const { error } = await supabase.rpc('upsert_my_profile', rpcPayload(fields))
  if (error) throw error
}

export async function claimFrenHandle(userId, handle, displayName = null) {
  const user = await requireUser()
  if (user.id !== userId) {
    throw new Error('Session mismatch. Sign out and log in again.')
  }

  const { error } = await supabase.rpc('claim_fren_handle', {
    p_handle: handle,
    p_display_name: displayName,
  })

  if (error) {
    if (error.code === 'PGRST202') {
      throw wrapProfileError(error)
    }
    throw error
  }
}

export async function upsertProfileFields(userId, fields) {
  const user = await requireUser()
  if (user.id !== userId) {
    throw new Error('Session mismatch. Sign out and log in again.')
  }

  try {
    await upsertProfileViaRpc(fields)
    return
  } catch (rpcError) {
    if (rpcError.code === 'PGRST202') throw wrapProfileError(rpcError)
    throw wrapProfileError(rpcError)
  }
}

export async function setMyCover(userId, coverValue) {
  const user = await requireUser()
  if (user.id !== userId) {
    throw new Error('Session mismatch. Sign out and log in again.')
  }

  const { coverUrl: previousCover } = await readMyProfileMediaUrls(userId)
  let cover = coverValue ?? null

  // If it's an uploaded photo (data URL), push it to Storage and keep only the
  // lightweight URL. Colors (hex/gradients) are short text and stored as-is.
  if (typeof cover === 'string' && cover.startsWith('data:image')) {
    try {
      const blob = await (await fetch(cover)).blob()
      cover = await uploadMedia(blob, { prefix: 'covers' })
    } catch (err) {
      if (!(err instanceof StorageNotInstalledError)) {
        console.error('Cover upload failed, embedding inline:', err.message)
      }
      // Fall back to the data URL so saving still works without the bucket.
    }
  }

  // Write straight to the profile row. RLS lets a user update their own row,
  // so this doesn't depend on the set_my_cover RPC (older DBs may not have it).
  const { error } = await supabase
    .from('profiles')
    .update({ cover_url: cover })
    .eq('id', userId)

  if (error) {
    if (error.code === '42703' || /cover_url/i.test(error.message || '')) {
      const project = getSupabaseProjectRef()
      const projectHint = project ? ` (project: ${project})` : ''
      throw new Error(`Cover column missing${projectHint}. ${DB_SETUP_HINT}`)
    }
    throw wrapProfileError(error)
  }

  await retireMedia(previousCover, cover)
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
