import { supabase } from '../supabaseClient'
import {
  validatePlaylistVideoUrl,
  trackToEmbed,
  PlaylistsNotInstalledError,
} from './playlists'

export class CavePlaylistsNotInstalledError extends Error {}

function throwIfNotInstalled(error) {
  if (error?.code === 'PGRST202' || error?.code === '42P01' || error?.code === '42883') {
    throw new CavePlaylistsNotInstalledError(error.message)
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
  }
}

export { trackToEmbed, validatePlaylistVideoUrl }

export async function listCavePlaylists(caveId) {
  const { data, error } = await supabase.rpc('list_cave_playlists', { p_cave: caveId })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return (data ?? []).map(mapPlaylist)
}

export async function listCavePlaylistTracks(playlistId) {
  const { data, error } = await supabase.rpc('list_cave_playlist_tracks', { p_playlist: playlistId })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return (data ?? []).map(mapTrack)
}

export async function createCavePlaylist(caveId, name) {
  const { data, error } = await supabase.rpc('create_cave_playlist', {
    p_cave: caveId,
    p_name: name,
  })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
  return data
}

export async function deleteCavePlaylist(id) {
  const { error } = await supabase.rpc('delete_cave_playlist', { p_id: id })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
}

export async function setCavePlaylistCover(id, coverUrl) {
  const { error } = await supabase.rpc('set_cave_playlist_cover', {
    p_id: id,
    p_cover_url: coverUrl || null,
  })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
}

export async function addCavePlaylistTrack(playlistId, url, title = null) {
  const check = validatePlaylistVideoUrl(url)
  if (!check.ok) throw new Error(check.error)

  const { data, error } = await supabase.rpc('add_cave_playlist_track', {
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

export async function removeCavePlaylistTrack(id) {
  const { error } = await supabase.rpc('remove_cave_playlist_track', { p_id: id })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
}

export async function reorderCavePlaylistTracks(playlistId, orderedIds) {
  const { error } = await supabase.rpc('reorder_cave_playlist_tracks', {
    p_playlist: playlistId,
    p_ordered_ids: orderedIds,
  })
  if (error) {
    throwIfNotInstalled(error)
    throw error
  }
}
