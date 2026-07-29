import { normalizeExternalUrl, isDirectImageUrl } from './urls'

/** Cosmos profile: @handle or cosmos.so/... */
export function normalizeCosmosProfileUrl(input) {
  const t = (input || '').trim()
  if (!t) return null
  if (t.startsWith('@')) return `https://www.cosmos.so/${t.slice(1)}`
  const url = normalizeExternalUrl(t)
  if (!url) return null
  try {
    const u = new URL(url)
    if (!u.hostname.includes('cosmos.so')) return url
    if (!u.pathname || u.pathname === '/') return url
    return url
  } catch {
    return url
  }
}

export function cosmosProfileLabel(url) {
  if (!url) return null
  try {
    const u = new URL(url)
    const path = u.pathname.replace(/^\/+/, '')
    if (!path) return 'cosmos.so'
    return path.startsWith('@') ? path : `@${path.split('/')[0]}`
  } catch {
    return url
  }
}

async function fetchPreviewImage(pageUrl) {
  const { resolvePagePreviewImage } = await import('./linkPreview')
  return resolvePagePreviewImage(pageUrl)
}

/**
 * Resolve a pasted link into a displayable image URL.
 * Direct CDN/image links work immediately; page URLs try a preview fetch.
 */
export async function resolveGalleryImageUrl(input) {
  const sourceUrl = normalizeExternalUrl(input)
  if (!sourceUrl) throw new Error('Paste a link or image URL.')

  if (isDirectImageUrl(sourceUrl)) {
    return { imageUrl: sourceUrl, sourceUrl }
  }

  const preview = await fetchPreviewImage(sourceUrl)
  if (preview) return { imageUrl: preview, sourceUrl }

  throw new Error(
    'Could not load an image from that link. Paste a direct image URL (Cosmos: copy image address), or upload the photo.',
  )
}
