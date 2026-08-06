import { supabase } from '../supabaseClient'
import { getLinkEmbed, normalizeUrl } from './urls'
import { prepareImageAttachment, finalizeImageUrl } from './imageAttach'
import { retireMedia } from './storage'

export class PlaylistsNotInstalledError extends Error {}

function throwIfNotInstalled(error) {
  if (error?.code === 'PGRST202' || error?.code === '42P01' || error?.code === '42883') {
    throw new PlaylistsNotInstalledError(error.message)
  }
}

function mapPlaylist(row) {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order ?? 0,
    trackCount: Number(row.track_count ?? 0),
    coverUrl: row.cover_url || null,
    createdAt: row.created_at,
  }
}

function mapTrack(row) {
  return {
    id: row.id,
    videoType: row.video_type,
    videoId: row.video_id,
    videoUrl: row.video_url,
    title: row.title || null,
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at,
    auraCount: Number(row.aura_count ?? 0),
    iGaveAura: Boolean(row.i_gave_aura),
  }
}

function mapComment(row) {
  return {
    id: row.id,
    playlistId: row.playlist_id,
    userId: row.user_id,
    frenName: row.author_name || 'fren',
    avatarType: row.avatar_type || 'frog',
    avatarUrl: row.avatar_url || null,
    text: row.body,
    createdAt: row.created_at,
    timestamp: row.created_at
      ? new Date(row.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      : '',
  }
}

function mapLikedTrack(row) {
  return {
    trackId: row.track_id,
    videoType: row.video_type,
    videoId: row.video_id,
    videoUrl: row.video_url,
    title: row.title || null,
    playlistId: row.playlist_id,
    playlistName: row.playlist_name,
    ownerId: row.owner_id,
    ownerName: row.owner_name || 'fren',
    likedAt: row.liked_at,
  }
}

export function trackToEmbed(track) {
  const type = track?.videoType || track?.video_type
  const id = track?.videoId || track?.video_id
  const url = track?.videoUrl || track?.video_url
  if (!type || !id) return null
  return { type, id, url }
}

/** Validate a URL for playlist use (YouTube or Vimeo — free embeddable video). */
export function validatePlaylistVideoUrl(input) {
  const url = normalizeUrl(input?.trim())
  if (!url) return { ok: false, error: 'Paste a valid video link.' }
  const embed = getLinkEmbed(url)
  if (!embed || (embed.type !== 'youtube' && embed.type !== 'vimeo')) {
    return { ok: false, error: 'Only YouTube and Vimeo links work in playlists.' }
  }
  return { ok: true, url: embed.url, type: embed.type, id: embed.id }
}

export async function listUserPlaylists(userId) {
  const { data, error } = await supabase.rpc('list_user_playlists', { p_user: userId })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return (data ?? []).map(mapPlaylist)
}

export async function listPlaylistTracks(playlistId) {
  const { data, error } = await supabase.rpc('list_playlist_tracks', { p_playlist: playlistId })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return (data ?? []).map(mapTrack)
}

export async function createPlaylist(name) {
  const { data, error } = await supabase.rpc('create_profile_playlist', { p_name: name })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return data
}

export async function renamePlaylist(id, name) {
  const { error } = await supabase.rpc('rename_profile_playlist', { p_id: id, p_name: name })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
}

export async function deletePlaylist(id) {
  const { error } = await supabase.rpc('delete_profile_playlist', { p_id: id })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
}

export async function setPlaylistCover(id, coverUrl) {
  const { data: prior } = await supabase
    .from('profile_playlists')
    .select('cover_url')
    .eq('id', id)
    .maybeSingle()
  const previousUrl = prior?.cover_url || null

  const { error } = await supabase.rpc('set_playlist_cover', {
    p_id: id,
    p_cover_url: coverUrl || null,
  })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  await retireMedia(previousUrl, coverUrl || null)
}

export async function uploadPlaylistCoverImage(file) {
  const { dataUrl, blob } = await prepareImageAttachment(file, { maxDimension: 900 })
  return finalizeImageUrl({ image: dataUrl, blob, prefix: 'playlist-covers' })
}

export async function addPlaylistTrack(playlistId, url, title = null) {
  const check = validatePlaylistVideoUrl(url)
  if (!check.ok) throw new Error(check.error)

  const { data, error } = await supabase.rpc('add_playlist_track', {
    p_playlist: playlistId,
    p_video_url: check.url,
    p_video_type: check.type,
    p_video_id: check.id,
    p_title: title?.trim() || null,
  })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return data
}

export async function addEmbedToPlaylist(playlistId, embed, title = null) {
  if (!embed?.type || !embed?.id || !embed?.url) throw new Error('Invalid video.')
  if (embed.type !== 'youtube' && embed.type !== 'vimeo') {
    throw new Error('Only YouTube and Vimeo links work in playlists.')
  }

  const { data, error } = await supabase.rpc('add_playlist_track', {
    p_playlist: playlistId,
    p_video_url: embed.url,
    p_video_type: embed.type,
    p_video_id: embed.id,
    p_title: title?.trim() || null,
  })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return data
}

export async function removePlaylistTrack(id) {
  const { error } = await supabase.rpc('remove_playlist_track', { p_id: id })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
}

export async function reorderPlaylistTracks(playlistId, orderedIds) {
  const { error } = await supabase.rpc('reorder_playlist_tracks', {
    p_playlist: playlistId,
    p_ordered_ids: orderedIds,
  })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
}

export async function toggleTrackAura(trackId) {
  const { data, error } = await supabase.rpc('toggle_track_aura', { p_track: trackId })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  const row = data?.[0] ?? data
  return {
    auraCount: Number(row?.aura_count ?? 0),
    iGaveAura: Boolean(row?.i_gave_aura),
  }
}

export async function listPlaylistComments(playlistId) {
  const { data, error } = await supabase.rpc('list_playlist_comments', { p_playlist: playlistId })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return (data ?? []).map(mapComment)
}

export async function addPlaylistComment(playlistId, body, profile = {}) {
  const { data, error } = await supabase.rpc('add_playlist_comment', {
    p_playlist: playlistId,
    p_body: body,
    p_author_name: profile.frenName || null,
    p_avatar_type: profile.avatarType || 'frog',
    p_avatar_url: profile.avatarUrl || null,
  })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return data
}

export async function deletePlaylistComment(id) {
  const { error } = await supabase.rpc('delete_playlist_comment', { p_id: id })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
}

export async function listMyLikedTracks(limit = 48) {
  const { data, error } = await supabase.rpc('list_my_liked_tracks', { p_limit: limit })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return (data ?? []).map(mapLikedTrack)
}

function mapSavedPlaylist(row) {
  return {
    id: row.playlist_id,
    name: row.name,
    ownerId: row.owner_id,
    ownerName: row.owner_name || 'fren',
    trackCount: Number(row.track_count ?? 0),
    coverUrl: row.cover_url || null,
    savedAt: row.saved_at,
  }
}

export async function listSavedPlaylists() {
  const { data, error } = await supabase.rpc('list_saved_playlists')
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return (data ?? []).map(mapSavedPlaylist)
}

export async function savePlaylist(playlistId) {
  const { error } = await supabase.rpc('save_playlist', { p_playlist: playlistId })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
}

export async function unsavePlaylist(playlistId) {
  const { error } = await supabase.rpc('unsave_playlist', { p_playlist: playlistId })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
}

export async function isPlaylistSaved(playlistId) {
  const { data, error } = await supabase.rpc('is_playlist_saved', { p_playlist: playlistId })
  if (error) {
    throwIfNotInstalled(error)
    throw false
  }
  return Boolean(data)
}
