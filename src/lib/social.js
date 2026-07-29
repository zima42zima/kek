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

// Search any account by username (even people you don't follow).
export async function searchProfiles(query, { limit = 20 } = {}) {
  const q = (query || '').trim()
  let req = supabase
    .from('profiles')
    .select('id, fren_handle, silly_name, avatar_type, avatar_url, bio')
    .limit(limit)
  if (q) {
    const needle = q.replace(/^@/, '').trim()
    req = req.or(`fren_handle.ilike.%${needle}%,silly_name.ilike.%${needle}%`)
  }
  const { data, error } = await req
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return (data ?? []).map((r) => ({
    userId: r.id,
    frenHandle: r.fren_handle || null,
    frenName: r.silly_name || 'a fren',
    avatarType: r.avatar_type || 'frog',
    avatarUrl: r.avatar_url || null,
    bio: r.bio || '',
  }))
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
