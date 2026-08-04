import { supabase } from '../supabaseClient'
import { ECHO_CITY_RADIUS_M, ECHO_DEFAULT_DISCOVER_RADIUS_M } from './echoConstants'
import { clampDiscoverRadius } from './echoRange'

export class EchoesNotInstalledError extends Error {}

const BUCKET = 'echo-media'

function throwIfNotInstalled(error) {
  if (error?.code === 'PGRST202' || error?.code === '42P01' || error?.code === '42883') {
    throw new EchoesNotInstalledError(error.message)
  }
}

function extForBlob(blob) {
  const type = blob.type || ''
  if (type.includes('png')) return 'png'
  if (type.includes('webp')) return 'webp'
  if (type.includes('gif')) return 'gif'
  if (type.includes('jpeg') || type.includes('jpg')) return 'jpg'
  if (type.includes('mp4')) return 'mp4'
  if (type.includes('quicktime')) return 'mov'
  if (type.includes('mpeg')) return 'mp3'
  if (type.includes('webm')) return 'webm'
  return 'bin'
}

function mapTableRow(row, userId) {
  return {
    id: row.id,
    kind: row.kind,
    mediaPath: row.media_path,
    mediaUrl: null,
    coverPath: row.cover_path || null,
    coverUrl: null,
    ownerId: row.owner_id,
    authorName: row.author_name || 'a fren',
    avatarType: row.avatar_type || 'frog',
    avatarUrl: row.avatar_url || null,
    lat: row.lat,
    lon: row.lon,
    visibility: row.visibility,
    shareOnProfile: row.share_on_profile !== false,
    allowComments: Boolean(row.allow_comments),
    voiceFilter: row.voice_filter,
    senseFilter: row.sense_filter,
    label: row.label || '',
    title: row.title || '',
    cityLabel: row.city_label || null,
    placeLabel: row.place_label || null,
    browseGlobally: Boolean(row.browse_globally),
    expiresAt: row.expires_at ? new Date(row.expires_at).getTime() : null,
    discoverRadiusM: clampDiscoverRadius(row.discover_radius_m ?? ECHO_DEFAULT_DISCOVER_RADIUS_M),
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    mine: row.owner_id === userId,
    saved: false,
    auraCount: Number(row.aura_count ?? 0),
    iGaveAura: Boolean(row.i_gave_aura),
    comments: [],
    spatial: null,
    distanceM: row.distance_m ?? null,
  }
}

function mapNearRow(row, userId) {
  return mapTableRow({
    id: row.id,
    owner_id: row.owner_id,
    kind: row.kind,
    media_path: row.media_path,
    cover_path: row.cover_path,
    lat: row.lat,
    lon: row.lon,
    visibility: row.visibility,
    voice_filter: row.voice_filter,
    sense_filter: row.sense_filter,
    allow_comments: row.allow_comments,
    share_on_profile: row.share_on_profile,
    label: row.label,
    title: row.title,
    city_label: row.city_label,
    place_label: row.place_label,
    browse_globally: row.browse_globally,
    expires_at: row.expires_at,
    discover_radius_m: row.discover_radius_m,
    created_at: row.created_at,
    author_name: row.author_name,
    avatar_type: row.avatar_type,
    avatar_url: row.avatar_url,
    distance_m: row.distance_m,
    aura_count: row.aura_count,
    i_gave_aura: row.i_gave_aura,
  }, userId)
}

export async function echoesInstalled() {
  const { error } = await supabase.rpc('list_my_echoes')
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') return false
    return false
  }
  return true
}

export async function uploadEchoMedia(blob) {
  const { data: auth } = await supabase.auth.getUser()
  const userId = auth?.user?.id
  if (!userId) throw new Error('Not authenticated')

  const ext = extForBlob(blob)
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type || 'application/octet-stream',
    cacheControl: '3600',
    upsert: false,
  })
  if (error) throw error
  return path
}

export async function getEchoMediaUrl(mediaPath) {
  if (!mediaPath) return null
  if (mediaPath.startsWith('data:') || mediaPath.startsWith('blob:') || mediaPath.startsWith('http')) {
    return mediaPath
  }
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(mediaPath, 3600)
  if (error) throw error
  return data?.signedUrl ?? null
}

export async function attachMediaUrls(echoes) {
  return Promise.all(echoes.map(async (echo) => {
    let next = echo
    if (!next.mediaUrl && next.mediaPath) {
      try {
        next = { ...next, mediaUrl: await getEchoMediaUrl(next.mediaPath) }
      } catch { /* keep */ }
    }
    if (!next.coverUrl && next.coverPath) {
      try {
        next = { ...next, coverUrl: await getEchoMediaUrl(next.coverPath) }
      } catch { /* keep */ }
    }
    return next
  }))
}

export async function publishEcho({
  kind,
  visibility,
  mediaPath,
  lat,
  lon,
  voiceFilter,
  senseFilter,
  allowComments,
  shareOnProfile,
  label,
  title,
  cityLabel,
  placeLabel,
  expiresAt,
  coverPath,
  discoverRadiusM,
  browseGlobally,
}) {
  const { data, error } = await supabase.rpc('publish_echo', {
    p_kind: kind,
    p_visibility: visibility,
    p_media_path: mediaPath,
    p_lat: lat,
    p_lon: lon,
    p_voice_filter: voiceFilter || null,
    p_sense_filter: senseFilter || null,
    p_allow_comments: Boolean(allowComments),
    p_share_on_profile: shareOnProfile !== false,
    p_label: label || null,
    p_title: (title || '').trim().slice(0, 222) || null,
    p_city_label: cityLabel || null,
    p_expires_at: expiresAt || null,
    p_cover_path: coverPath || null,
    p_discover_radius_m: clampDiscoverRadius(discoverRadiusM ?? ECHO_DEFAULT_DISCOVER_RADIUS_M),
    p_place_label: placeLabel || null,
    p_browse_globally: Boolean(browseGlobally),
  })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return data
}

export async function listMyEchoes(userId) {
  const { data, error } = await supabase.rpc('list_my_echoes')
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return (data ?? []).map((row) => mapTableRow(row, userId))
}

export async function listEchoesNear(lat, lon, radiusM = ECHO_CITY_RADIUS_M, userId) {
  const { data, error } = await supabase.rpc('list_echoes_near', {
    p_lat: lat,
    p_lon: lon,
    p_radius_m: radiusM,
  })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return (data ?? []).map((row) => mapNearRow(row, userId))
}

export async function getEchoById(echoId, userId) {
  const { data, error } = await supabase.rpc('get_echo', { p_echo_id: echoId })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  const row = Array.isArray(data) ? data[0] : data
  if (!row) return null
  return mapTableRow(row, userId)
}

export async function listEchoesInBbox({ south, west, north, east, limit = 150 }, userId) {
  const { data, error } = await supabase.rpc('list_echoes_in_bbox', {
    p_south: south,
    p_west: west,
    p_north: north,
    p_east: east,
    p_limit: limit,
  })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return (data ?? []).map((row) => mapNearRow(row, userId))
}

export async function searchEchoPlaces(query, limit = 40) {
  const { data, error } = await supabase.rpc('search_echo_places', {
    p_query: query,
    p_limit: limit,
  })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return (data ?? []).map((row) => ({
    placeKey: row.place_key,
    placeLabel: row.place_label,
    cityLabel: row.city_label,
    lat: Number(row.lat),
    lon: Number(row.lon),
    echoCount: Number(row.echo_count ?? 0),
  }))
}

export async function listUserProfileEchoes(ownerId, viewerId) {
  const { data, error } = await supabase
    .from('echoes')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('visibility', 'world')
    .eq('share_on_profile', true)
    .eq('hidden', false)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return (data ?? []).map((row) => mapTableRow(row, viewerId))
}

export async function deleteEcho(id) {
  const { error } = await supabase.rpc('delete_echo', { p_echo_id: id })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
}

export async function toggleEchoAura(echoId) {
  const { data, error } = await supabase.rpc('toggle_echo_aura', { p_echo: echoId })
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

function mapEchoComment(row) {
  return {
    id: row.id,
    echoId: row.echo_id,
    authorId: row.user_id,
    userId: row.user_id,
    authorName: row.author_name || 'a fren',
    frenName: row.author_name || 'a fren',
    avatarType: row.avatar_type || 'frog',
    avatarUrl: row.avatar_url || null,
    text: row.body,
    body: row.body,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    timestamp: row.created_at
      ? new Date(row.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      : '',
    reactions: [],
  }
}

export async function listEchoComments(echoId) {
  const { data, error } = await supabase.rpc('list_echo_comments', { p_echo: echoId })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return (data ?? []).map(mapEchoComment)
}

export async function addEchoComment(echoId, body, profile = {}, userId = null) {
  const { data, error } = await supabase.rpc('add_echo_comment', {
    p_echo: echoId,
    p_body: body,
    p_author_name: profile.frenName || null,
    p_avatar_type: profile.avatarType || 'frog',
    p_avatar_url: profile.avatarUrl || null,
  })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  const id = Array.isArray(data) ? data[0] : data
  const authorId = userId || profile.userId || profile.id || null
  return {
    id,
    echoId,
    authorId,
    userId: authorId,
    authorName: profile.frenName || 'you',
    frenName: profile.frenName || 'you',
    avatarType: profile.avatarType || 'frog',
    avatarUrl: profile.avatarUrl || null,
    text: body,
    body,
    createdAt: Date.now(),
    timestamp: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    reactions: [],
  }
}

export async function deleteEchoComment(commentId) {
  const { error } = await supabase.rpc('delete_echo_comment', { p_id: commentId })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
}
