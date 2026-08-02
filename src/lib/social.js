import { supabase } from '../supabaseClient'

// Thrown when the social SQL (follows / post_reactions / RPCs) isn't installed yet.
export class SocialNotInstalledError extends Error {}

function throwIfNotInstalled(error) {
  if (error?.code === 'PGRST202' || error?.code === '42P01' || error?.code === '42883') {
    throw new SocialNotInstalledError(error.message)
  }
}

export async function toggleAura(postId) {
  const { data, error } = await supabase.rpc('toggle_aura', { p_post: postId })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  const row = Array.isArray(data) ? data[0] : data
  return {
    auraCount: Number(row?.aura_count ?? 0),
    iGaveAura: row?.i_gave_aura ?? false,
  }
}

export async function followUser(targetId) {
  const { error } = await supabase.rpc('follow_user', { p_target: targetId })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
}

export async function unfollowUser(targetId) {
  const { error } = await supabase.rpc('unfollow_user', { p_target: targetId })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
}

export async function followCounts(userId) {
  const { data, error } = await supabase.rpc('follow_counts', { p_user: userId })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  const row = Array.isArray(data) ? data[0] : data
  return {
    following: Number(row?.following ?? 0),
    followers: Number(row?.followers ?? 0),
  }
}

function mapSearchRow(r) {
  return {
    userId: r.id ?? r.user_id,
    frenHandle: r.handle || r.fren_handle || null,
    frenName: r.name || r.silly_name || 'a fren',
    avatarType: r.avatar_type || 'frog',
    avatarUrl: r.avatar_url || null,
    bio: r.bio || '',
  }
}

/** Escape a value for PostgREST filter strings (or/ilike). */
function escapePostgrestValue(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '""')
}

/** Escape LIKE wildcards so user input is literal. */
function escapeLike(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

async function searchProfilesViaTable(needle, limit) {
  const like = `%${escapeLike(needle)}%`
  const quoted = `"${escapePostgrestValue(like)}"`

  // Prefer handle + display name. If fren_handle column is missing on older DBs,
  // retry with silly_name only so search still works.
  const attempts = [
    {
      select: 'id, fren_handle, silly_name, avatar_type, avatar_url, bio',
      or: `fren_handle.ilike.${quoted},silly_name.ilike.${quoted}`,
    },
    {
      select: 'id, silly_name, avatar_type, avatar_url, bio',
      or: `silly_name.ilike.${quoted}`,
    },
  ]

  let lastError = null
  for (const attempt of attempts) {
    let req = supabase.from('profiles').select(attempt.select).limit(limit)
    if (attempt.or.includes(',')) {
      req = req.or(attempt.or)
    } else {
      // single column — use ilike directly
      req = req.ilike('silly_name', like)
    }
    const { data, error } = await req
    if (!error) return (data ?? []).map(mapSearchRow)

    lastError = error
    // Column missing / schema cache — try next shape
    const msg = error.message || ''
    if (
      error.code === '42703' ||
      error.code === 'PGRST204' ||
      /fren_handle|column|schema cache/i.test(msg)
    ) {
      continue
    }
    throwIfNotInstalled(error)
    throw error
  }
  if (lastError) {
    throwIfNotInstalled(lastError)
    throw lastError
  }
  return []
}

// Search any account by username / display name (even people you don't follow).
export async function searchProfiles(query, { limit = 20 } = {}) {
  const raw = (query || '').trim()
  if (!raw) return []

  const needle = raw.replace(/^@+/, '').trim()
  if (!needle) return []

  // Preferred path: security-definer RPC (bypasses tight RLS, stable search).
  const { data: rpcData, error: rpcError } = await supabase.rpc('search_profiles', {
    p_query: needle,
    p_limit: limit,
  })

  if (!rpcError) {
    return (rpcData ?? []).map(mapSearchRow)
  }

  // RPC not installed yet — fall back to direct table select.
  if (rpcError.code === 'PGRST202' || rpcError.code === '42883') {
    return searchProfilesViaTable(needle, limit)
  }

  throwIfNotInstalled(rpcError)
  throw rpcError
}

function mapPerson(row) {
  return {
    userId: row.user_id,
    frenHandle: row.handle || null,
    frenName: row.name || 'a fren',
    avatarType: row.avatar_type || 'frog',
    avatarUrl: row.avatar_url || null,
    bio: row.bio || '',
    iFollow: row.i_follow ?? false,
  }
}

export async function listFollowers(userId) {
  const { data, error } = await supabase.rpc('list_followers', { p_user: userId })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return (data ?? []).map(mapPerson)
}

export async function listFollowing(userId) {
  const { data, error } = await supabase.rpc('list_following', { p_user: userId })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return (data ?? []).map(mapPerson)
}

export async function getProfileCard(userId) {
  const { data, error } = await supabase.rpc('get_profile_card', { p_user: userId })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  const row = Array.isArray(data) ? data[0] : data
  if (!row) return null
  return {
    id: row.id,
    frenHandle: row.handle || null,
    frenName: row.name || 'a fren',
    oneHumanThing: row.one_human_thing || null,
    bio: row.bio || null,
    avatarType: row.avatar_type || 'frog',
    avatarUrl: row.avatar_url || null,
    isFounder: row.is_founder ?? false,
    cosmosUrl: row.cosmos_url || null,
    owlPostOpen: row.owl_post_open ?? false,
    following: Number(row.following ?? 0),
    followers: Number(row.followers ?? 0),
    iFollow: row.i_follow ?? false,
  }
}
