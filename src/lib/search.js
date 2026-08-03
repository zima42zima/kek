/**
 * Unified app search — people, public post text, public echoes (taglines / places).
 * Soft-fails per section so one broken backend does not kill the whole modal.
 */
import { supabase } from '../supabaseClient'
import { searchProfiles } from './social'
import { listPosts } from './posts'
import { searchEchoPlaces } from './echoes'

function escapeLike(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

function escapePostgrestValue(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '""')
}

function needleOf(query) {
  return String(query || '').trim()
}

function includesNeedle(text, needle) {
  if (!text || !needle) return false
  return String(text).toLowerCase().includes(needle.toLowerCase())
}

/** @returns {Promise<{ people, posts, echoes, places }>} */
export async function searchAll(query, {
  userId = null,
  limitPeople = 8,
  limitPosts = 8,
  limitEchoes = 8,
  limitPlaces = 6,
  /** Optional already-loaded public-ish echoes (near / explore) for offline-ish match. */
  localEchoes = [],
  /** Optional feed posts already in memory. */
  feedPosts = [],
} = {}) {
  const q = needleOf(query)
  if (!q) {
    return { people: [], posts: [], echoes: [], places: [] }
  }

  const peopleQ = q.replace(/^@+/, '').trim() || q

  const [peopleSettled, postsSettled, echoesSettled, placesSettled] = await Promise.allSettled([
    searchProfiles(peopleQ, { limit: limitPeople }),
    searchPublicPosts(q, { limit: limitPosts, feedPosts }),
    searchPublicEchoes(q, { limit: limitEchoes, userId, localEchoes }),
    searchEchoPlaces(q, limitPlaces).catch(() => []),
  ])

  const peopleRaw = peopleSettled.status === 'fulfilled' ? peopleSettled.value : []
  const people = (peopleRaw || []).filter((p) => p.userId !== userId)

  return {
    people,
    posts: postsSettled.status === 'fulfilled' ? postsSettled.value : [],
    echoes: echoesSettled.status === 'fulfilled' ? echoesSettled.value : [],
    places: placesSettled.status === 'fulfilled' ? (placesSettled.value || []) : [],
  }
}

/**
 * Public-ish post body search (audience everyone).
 * Falls back to filtering the current feed list if table/RPC path fails.
 */
export async function searchPublicPosts(query, { limit = 8, feedPosts = [] } = {}) {
  const q = needleOf(query)
  if (!q) return []

  const like = `%${escapeLike(q)}%`
  const quoted = `"${escapePostgrestValue(like)}"`

  // Prefer direct table: public posts whose body matches.
  const { data, error } = await supabase
    .from('posts')
    .select('id, user_id, body, image, audience, tags, created_at, author_name, avatar_type, avatar_url')
    .eq('audience', 'everyone')
    .or(`body.ilike.${quoted}`)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!error && data) {
    return data.map((row) => ({
      id: row.id,
      userId: row.user_id,
      text: row.body || '',
      image: row.image || null,
      frenName: row.author_name || 'fren',
      avatarType: row.avatar_type || 'frog',
      avatarUrl: row.avatar_url || null,
      createdAt: row.created_at,
    }))
  }

  // Schema may omit author_name columns — retry minimal select.
  if (error) {
    const retry = await supabase
      .from('posts')
      .select('id, user_id, body, image, audience, created_at')
      .eq('audience', 'everyone')
      .ilike('body', like)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (!retry.error && retry.data) {
      return retry.data.map((row) => ({
        id: row.id,
        userId: row.user_id,
        text: row.body || '',
        image: row.image || null,
        frenName: 'fren',
        avatarType: 'frog',
        avatarUrl: null,
        createdAt: row.created_at,
      }))
    }
  }

  // Feed-only fallback (what the user already sees + list_feed_posts).
  let pool = Array.isArray(feedPosts) ? feedPosts : []
  if (pool.length === 0) {
    try {
      pool = await listPosts()
    } catch {
      pool = []
    }
  }

  return pool
    .filter((p) => {
      const aud = p.audience || 'everyone'
      if (aud !== 'everyone' && aud !== 'cave') return false
      return includesNeedle(p.text, q)
        || (Array.isArray(p.tags) && p.tags.some((t) => includesNeedle(t, q)))
    })
    .slice(0, limit)
    .map((p) => ({
      id: p.id,
      userId: p.userId,
      text: p.text || '',
      image: p.image || null,
      frenName: p.frenName || 'fren',
      avatarType: p.avatarType || 'frog',
      avatarUrl: p.avatarUrl || null,
      createdAt: p.createdAt,
    }))
}

/**
 * Public world echoes by tagline / place / city.
 * Merges local near-you echoes so search works even when table filters are tight.
 */
export async function searchPublicEchoes(query, { limit = 8, userId = null, localEchoes = [] } = {}) {
  const q = needleOf(query)
  if (!q) return []

  const like = `%${escapeLike(q)}%`
  const quoted = `"${escapePostgrestValue(like)}"`
  const byId = new Map()

  function push(echo) {
    if (!echo?.id || byId.has(echo.id)) return
    // Global search only surfaces world echoes (not private / friends-only).
    if (echo.visibility && echo.visibility !== 'world') return
    byId.set(echo.id, echo)
  }

  for (const e of localEchoes || []) {
    if (
      includesNeedle(e.label, q)
      || includesNeedle(e.placeLabel, q)
      || includesNeedle(e.cityLabel, q)
      || includesNeedle(e.authorName, q)
    ) {
      push(e)
    }
  }

  const { data, error } = await supabase
    .from('echoes')
    .select('*')
    .eq('visibility', 'world')
    .eq('hidden', false)
    .or(`label.ilike.${quoted},place_label.ilike.${quoted},city_label.ilike.${quoted},author_name.ilike.${quoted}`)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!error && data) {
    for (const row of data) {
      // mapTableRow is not exported — inline minimal map
      push({
        id: row.id,
        kind: row.kind,
        ownerId: row.owner_id,
        authorName: row.author_name || 'a fren',
        avatarType: row.avatar_type || 'frog',
        avatarUrl: row.avatar_url || null,
        label: row.label || '',
        cityLabel: row.city_label || null,
        placeLabel: row.place_label || null,
        visibility: row.visibility,
        lat: row.lat,
        lon: row.lon,
        createdAt: row.created_at,
        mine: row.owner_id === userId,
      })
    }
  }

  return [...byId.values()].slice(0, limit)
}
