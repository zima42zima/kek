import { supabase } from '../supabaseClient'

// Bucket that holds all user media (post photos, avatars, covers).
const BUCKET = 'media'

// Thrown when the storage bucket hasn't been created yet (SQL not run).
// Callers fall back to embedding the image as a data URL so nothing breaks.
export class StorageNotInstalledError extends Error {}

function extForType(type) {
  if (!type) return 'jpg'
  if (type.includes('png')) return 'png'
  if (type.includes('webp')) return 'webp'
  if (type.includes('gif')) return 'gif'
  if (type.includes('webm')) return 'webm'
  if (type.includes('quicktime')) return 'mov'
  if (type.includes('mp4') || type.includes('mpeg')) return 'mp4'
  return 'jpg'
}

/**
 * Upload a Blob to Supabase Storage and return its public URL.
 * Files are stored under `${userId}/${prefix}/...` so per-user RLS works.
 *
 * @param {Blob} blob            image/video bytes (already sanitized)
 * @param {{prefix?: string}} [opts]
 * @returns {Promise<string>} public URL
 */
export async function uploadMedia(blob, { prefix = 'posts' } = {}) {
  const { data: auth } = await supabase.auth.getUser()
  const userId = auth?.user?.id
  if (!userId) throw new Error('Not authenticated')

  const ext = extForType(blob.type)
  const rand = Math.random().toString(36).slice(2, 8)
  const path = `${userId}/${prefix}/${Date.now()}-${rand}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type || 'image/jpeg',
    cacheControl: '3600',
    upsert: false,
  })

  if (error) {
    const msg = String(error.message || '')
    // Bucket missing / not found -> treat as "not installed" so callers fall back.
    if (error.status === 404 || /bucket|not found|does not exist/i.test(msg)) {
      throw new StorageNotInstalledError(msg)
    }
    throw error
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

/**
 * Extract object path from a public media URL, or null if not our bucket.
 * e.g. …/storage/v1/object/public/media/{userId}/avatars/….jpg → {userId}/avatars/….jpg
 */
export function mediaPathFromPublicUrl(url) {
  if (!url || typeof url !== 'string' || url.startsWith('data:') || url.startsWith('blob:')) {
    return null
  }
  try {
    const u = new URL(url)
    const marker = `/storage/v1/object/public/${BUCKET}/`
    const idx = u.pathname.indexOf(marker)
    if (idx === -1) return null
    const path = decodeURIComponent(u.pathname.slice(idx + marker.length))
    return path || null
  } catch {
    return null
  }
}

/**
 * Delete a file from the media bucket (own files only). Soft-fails — never blocks saves.
 * @param {string|null|undefined} urlOrPath public URL or storage path
 */
export async function removeMedia(urlOrPath) {
  if (!urlOrPath) return false
  const path = String(urlOrPath).includes('://')
    ? mediaPathFromPublicUrl(urlOrPath)
    : String(urlOrPath).replace(/^\/+/, '')
  if (!path) return false

  const { data: auth } = await supabase.auth.getUser()
  const userId = auth?.user?.id
  if (!userId || !path.startsWith(`${userId}/`)) return false

  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) {
    console.warn('Media remove failed:', error.message)
    return false
  }
  return true
}

/**
 * Drop a previous media URL after a successful DB update (no-op if same/missing).
 * Call only after the new URL is committed so a failed save never orphans the old file.
 */
export async function retireMedia(previousUrl, nextUrl = null) {
  if (!previousUrl || previousUrl === nextUrl) return false
  return removeMedia(previousUrl)
}
