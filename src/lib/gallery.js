import { supabase } from '../supabaseClient'
import { uploadMedia, StorageNotInstalledError } from './storage'
import { resolveGalleryImageUrl } from './galleryResolve'

export class GalleryNotInstalledError extends Error {}

const LEGACY_MOODBOARD_PREFIX = 'legacy:'

let moodboardsInstalledCache = null

function throwIfGalleryMissing(error) {
  if (error?.code === 'PGRST202' || error?.code === '42P01' || error?.code === '42883') {
    throw new GalleryNotInstalledError(error.message)
  }
}

function isMoodboardsMissing(error) {
  return error?.code === 'PGRST202' && /moodboard/i.test(error.message || '')
}

export function isLegacyMoodboardId(id) {
  return String(id).startsWith(LEGACY_MOODBOARD_PREFIX)
}

export function legacyMoodboardId(userId) {
  return `${LEGACY_MOODBOARD_PREFIX}${userId}`
}

function userIdFromLegacyMoodboardId(id) {
  return String(id).slice(LEGACY_MOODBOARD_PREFIX.length)
}

function mapMoodboard(row) {
  return {
    id: row.id,
    name: row.name,
    isPublic: Boolean(row.is_public),
    sortOrder: row.sort_order ?? 0,
    itemCount: Number(row.item_count ?? 0),
    createdAt: row.created_at,
    legacy: Boolean(row.legacy),
  }
}

function mapItem(row) {
  return {
    id: row.id,
    imageUrl: row.image_url,
    sourceUrl: row.source_url || null,
    caption: row.caption || null,
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at,
  }
}

async function listProfileGalleryRaw(userId) {
  const { data, error } = await supabase.rpc('list_profile_gallery', { p_user: userId })
  if (error) {
    throwIfGalleryMissing(error)
    throw error
  }
  return (data ?? []).map(mapItem)
}

function legacyBoardForUser(userId, itemCount) {
  return {
    id: legacyMoodboardId(userId),
    name: 'My moodboard',
    isPublic: true,
    sortOrder: 0,
    itemCount,
    createdAt: null,
    legacy: true,
  }
}

export async function checkMoodboardsInstalled() {
  if (moodboardsInstalledCache !== null) return moodboardsInstalledCache
  const { error } = await supabase.rpc('list_user_moodboards', {
    p_user: '00000000-0000-0000-0000-000000000000',
  })
  moodboardsInstalledCache = !isMoodboardsMissing(error)
  return moodboardsInstalledCache
}

export async function listUserMoodboards(userId) {
  const { data, error } = await supabase.rpc('list_user_moodboards', { p_user: userId })
  if (error) {
    if (isMoodboardsMissing(error)) {
      const items = await listProfileGalleryRaw(userId)
      const { data: { user } } = await supabase.auth.getUser()
      const isOwn = user?.id === userId
      if (items.length === 0 && !isOwn) return []
      return [legacyBoardForUser(userId, items.length)]
    }
    throwIfGalleryMissing(error)
    throw error
  }
  return (data ?? []).map(mapMoodboard)
}

export async function listMoodboardItems(moodboardId) {
  if (isLegacyMoodboardId(moodboardId)) {
    return listProfileGalleryRaw(userIdFromLegacyMoodboardId(moodboardId))
  }
  const { data, error } = await supabase.rpc('list_moodboard_items', { p_moodboard: moodboardId })
  if (error) {
    if (isMoodboardsMissing(error)) {
      throw new Error('Run supabase-patch-moodboards.sql in Supabase SQL Editor.')
    }
    throwIfGalleryMissing(error)
    throw error
  }
  return (data ?? []).map(mapItem)
}

/** Flat gallery list across public boards (chip fallback). */
export async function listProfileGallery(userId) {
  return listProfileGalleryRaw(userId)
}

export async function createMoodboard(name, isPublic = true) {
  const { data, error } = await supabase.rpc('create_moodboard', {
    p_name: name,
    p_is_public: isPublic,
  })
  if (error) {
    if (isMoodboardsMissing(error)) {
      throw new Error('Named moodboards need supabase-patch-moodboards.sql in Supabase SQL Editor.')
    }
    throwIfGalleryMissing(error)
    throw error
  }
  moodboardsInstalledCache = true
  return data
}

export async function updateMoodboard(id, { name, isPublic } = {}) {
  if (isLegacyMoodboardId(id)) {
    throw new Error('Run supabase-patch-moodboards.sql to rename boards or change visibility.')
  }
  const { error } = await supabase.rpc('update_moodboard', {
    p_id: id,
    p_name: name ?? null,
    p_is_public: typeof isPublic === 'boolean' ? isPublic : null,
  })
  if (error) {
    if (isMoodboardsMissing(error)) {
      throw new Error('Run supabase-patch-moodboards.sql to edit moodboards.')
    }
    throwIfGalleryMissing(error)
    throw error
  }
}

export async function deleteMoodboard(id) {
  if (isLegacyMoodboardId(id)) {
    throw new Error('Run supabase-patch-moodboards.sql to delete named boards.')
  }
  const { error } = await supabase.rpc('delete_moodboard', { p_id: id })
  if (error) {
    if (isMoodboardsMissing(error)) {
      throw new Error('Run supabase-patch-moodboards.sql to delete moodboards.')
    }
    throwIfGalleryMissing(error)
    throw error
  }
}

export async function addMoodboardItemFromUrl(moodboardId, url) {
  const { imageUrl, sourceUrl } = await resolveGalleryImageUrl(url)
  if (isLegacyMoodboardId(moodboardId)) {
    return addGalleryFromUrl(url)
  }
  const { data, error } = await supabase.rpc('add_moodboard_item', {
    p_moodboard: moodboardId,
    p_image_url: imageUrl,
    p_source_url: sourceUrl,
    p_caption: null,
  })
  if (error) {
    if (isMoodboardsMissing(error)) {
      return addGalleryFromUrl(url)
    }
    throwIfGalleryMissing(error)
    throw error
  }
  return data
}

export async function addMoodboardItemFromFile(moodboardId, file) {
  if (isLegacyMoodboardId(moodboardId)) {
    return addGalleryFromFile(file)
  }

  const { sanitizeImage } = await import('./media')
  const { dataUrl } = await sanitizeImage(file, { maxDimension: 1400 })
  let imageUrl = dataUrl

  try {
    const blob = await (await fetch(dataUrl)).blob()
    imageUrl = await uploadMedia(blob, { prefix: 'gallery' })
  } catch (err) {
    if (!(err instanceof StorageNotInstalledError)) {
      console.error('Gallery upload failed, embedding inline:', err.message)
    }
  }

  const { data, error } = await supabase.rpc('add_moodboard_item', {
    p_moodboard: moodboardId,
    p_image_url: imageUrl,
    p_source_url: null,
    p_caption: null,
  })
  if (error) {
    if (isMoodboardsMissing(error)) {
      return addGalleryFromFile(file)
    }
    throwIfGalleryMissing(error)
    throw error
  }
  return data
}

export async function reorderMoodboardItems(moodboardId, orderedIds) {
  if (isLegacyMoodboardId(moodboardId)) {
    throw new Error('Run supabase-patch-moodboards.sql to reorder images.')
  }
  const { error } = await supabase.rpc('reorder_moodboard_items', {
    p_moodboard: moodboardId,
    p_ordered_ids: orderedIds,
  })
  if (error) {
    if (isMoodboardsMissing(error)) {
      throw new Error('Run supabase-patch-moodboards.sql to reorder images.')
    }
    throwIfGalleryMissing(error)
    throw error
  }
}

export async function removeGalleryItem(id) {
  const { error } = await supabase.rpc('remove_profile_gallery_item', { p_id: id })
  if (error) {
    throwIfGalleryMissing(error)
    throw error
  }
}

export async function addGalleryFromUrl(url) {
  const { imageUrl, sourceUrl } = await resolveGalleryImageUrl(url)
  const { data, error } = await supabase.rpc('add_profile_gallery_item', {
    p_image_url: imageUrl,
    p_source_url: sourceUrl,
    p_caption: null,
  })
  if (error) {
    throwIfGalleryMissing(error)
    throw error
  }
  return data
}

export async function addGalleryFromFile(file) {
  const { sanitizeImage } = await import('./media')
  const { dataUrl } = await sanitizeImage(file, { maxDimension: 1400 })
  let imageUrl = dataUrl

  try {
    const blob = await (await fetch(dataUrl)).blob()
    imageUrl = await uploadMedia(blob, { prefix: 'gallery' })
  } catch (err) {
    if (!(err instanceof StorageNotInstalledError)) {
      console.error('Gallery upload failed, embedding inline:', err.message)
    }
  }

  const { data, error } = await supabase.rpc('add_profile_gallery_item', {
    p_image_url: imageUrl,
    p_source_url: null,
    p_caption: null,
  })
  if (error) {
    throwIfGalleryMissing(error)
    throw error
  }
  return data
}
