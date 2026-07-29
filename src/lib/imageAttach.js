import { sanitizeImage } from './media'
import { uploadMedia, StorageNotInstalledError } from './storage'
import { isDataImageUrl, splitTextWithUrls } from './urls'

const MAX_GIF_BYTES = 15 * 1024 * 1024

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export function isGifFile(file) {
  return Boolean(file?.type === 'image/gif' || /\.gif$/i.test(file?.name || ''))
}

/**
 * Prepare an image file for posting. GIFs keep animation (no canvas re-encode).
 */
export async function prepareImageAttachment(file, { maxDimension = 1600 } = {}) {
  if (!file || !file.type?.startsWith('image/')) {
    throw new Error('Please choose an image file.')
  }

  if (isGifFile(file)) {
    if (file.size > MAX_GIF_BYTES) {
      throw new Error('GIF must be under 15MB.')
    }
    const buffer = await file.arrayBuffer()
    const blob = new Blob([buffer], { type: 'image/gif' })
    const dataUrl = await blobToDataUrl(blob)
    return { blob, dataUrl, isGif: true }
  }

  const result = await sanitizeImage(file, { maxDimension })
  return { ...result, isGif: false }
}

/**
 * Turn a prepared attachment or external GIF URL into the final post URL.
 */
export async function finalizeImageUrl({ image, blob, prefix = 'posts' }) {
  if (!blob) return image
  try {
    return await uploadMedia(blob, { prefix })
  } catch (err) {
    if (!(err instanceof StorageNotInstalledError)) {
      console.error('Media upload failed, embedding inline:', err.message)
    }
    return image
  }
}

/** Attach a hosted GIF URL into draft text (for text-only composers). */
export function appendGifUrlToText(text, url) {
  if (!url) return text
  const trimmed = (text || '').trim()
  return trimmed ? `${trimmed}\n${url}` : url
}

/** Upload GIF / image URLs in comment text so they render inline reliably. */
export async function prepareCommentText(text, { prefix = 'comments' } = {}) {
  const raw = (text || '').trim()
  if (!raw) return raw

  if (isDataImageUrl(raw)) {
    return finalizeGifUrl(raw, { prefix })
  }

  let next = raw
  for (const seg of splitTextWithUrls(raw)) {
    if (seg.type !== 'url') continue
    const href = seg.href || seg.value
    if (!isDataImageUrl(href)) continue
    const uploaded = await finalizeGifUrl(href, { prefix })
    if (uploaded && uploaded !== seg.value) {
      next = next.replace(seg.value, uploaded)
    }
  }
  return next
}

/** Turn a hosted or data-URL GIF into a storable image URL. */
export async function finalizeGifUrl(url, { prefix = 'posts' } = {}) {
  if (!url) return url
  if (/supabase\.co\/storage\/v1\/object\/public\//i.test(url)) return url
  if (!url.startsWith('data:image/')) return url
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    return finalizeImageUrl({ image: url, blob, prefix })
  } catch {
    return url
  }
}
