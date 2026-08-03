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
