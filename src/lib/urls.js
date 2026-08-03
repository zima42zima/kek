/** Shared URL parsing for links + embeds across MISAO. */

const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>"']+/gi
const DATA_IMAGE_PATTERN = /data:image\/[^\s<>"']+/gi

const TRAILING_PUNCT = /[.,;:!?)]+$/

export function normalizeUrl(raw) {
  let url = (raw || '').trim().replace(TRAILING_PUNCT, '')
  if (!url) return null
  if (/^www\./i.test(url)) url = `https://${url}`
  if (!/^https?:\/\//i.test(url)) return null
  return url
}

function pushUrlSegment(segments, text, last, match) {
  if (match.index > last) {
    segments.push({ type: 'text', value: text.slice(last, match.index) })
  }
  const raw = match[0]
  segments.push({ type: 'url', value: raw, href: normalizeUrl(raw) || raw })
  return match.index + raw.length
}

export function splitTextWithUrls(text) {
  if (!text) return []
  const segments = []
  let last = 0
  const combined = new RegExp(
    `${URL_PATTERN.source}|${DATA_IMAGE_PATTERN.source}`,
    'gi',
  )
  let match

  while ((match = combined.exec(text)) !== null) {
    last = pushUrlSegment(segments, text, last, match)
  }

  if (last < text.length) {
    segments.push({ type: 'text', value: text.slice(last) })
  }

  return segments
}

export function normalizeExternalUrl(input) {
  const t = (input || '').trim()
  if (!t) return null
  if (/^https?:\/\//i.test(t)) return t
  return `https://${t}`
}

export function isDirectImageUrl(url) {
  const normalized = normalizeUrl(url)
  if (!normalized) return false
  try {
    const u = new URL(normalized)
    const host = u.hostname.replace(/^www\./, '')
    if (host === 'cdn.cosmos.so') {
      if (/\.mp4(\?|$)/i.test(u.pathname)) return false
      return true
    }
    if (host.includes('pinimg.com')) return true
    if (host.includes('supabase.co') && u.pathname.includes('/storage/v1/object/public/')) return true
    if (host.includes('giphy.com') && u.pathname.includes('/media/')) return true
    if (host.includes('tenor.com') && (host.startsWith('media.') || /\.gif$/i.test(u.pathname))) return true
    if (/\.(jpe?g|png|gif|webp|avif)(\?|$)/i.test(u.pathname)) return true
    return false
  } catch {
    return false
  }
}

/** Resolve share/page links to a direct animated image URL when possible. */
export function parseGiphyMediaUrl(url) {
  const normalized = normalizeUrl(url)
  if (!normalized) return null
  try {
    const u = new URL(normalized)
    if (!u.hostname.includes('giphy.com')) return null

    // Already a CDN media URL (including modern v1.Y2lk… paths) — keep as-is.
    if (u.pathname.includes('/media/')) return normalized

    const pageId = u.pathname.match(/\/gifs\/(?:[^/]+-)?([a-zA-Z0-9]+)/)?.[1]
    if (pageId) return `https://media.giphy.com/media/${pageId}/giphy.gif`
  } catch {
    return null
  }
  return null
}

export function resolveImageEmbedUrl(url) {
  const normalized = normalizeUrl(url)
  if (!normalized) return null

  // Prefer the original CDN URL — parseGiphyMediaUrl must not rewrite modern paths.
  if (isDirectImageUrl(normalized)) return normalized

  return parseGiphyMediaUrl(normalized)
}

export function parseYouTubeId(url) {
  const normalized = normalizeUrl(url)
  if (!normalized) return null

  // Regex fallback — catches share links URL() parsing can miss.
  const fallback = normalized.match(
    /(?:youtube\.com\/(?:watch\?.*v=|shorts\/|embed\/|live\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  )
  if (fallback?.[1]) return fallback[1]

  try {
    const u = new URL(normalized)
    const host = u.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0]?.slice(0, 11) || null
    if (
      host === 'youtube.com'
      || host === 'm.youtube.com'
      || host === 'music.youtube.com'
    ) {
      if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2]?.slice(0, 11) || null
      if (u.pathname.startsWith('/embed/')) return u.pathname.split('/')[2]?.slice(0, 11) || null
      if (u.pathname.startsWith('/live/')) return u.pathname.split('/')[2]?.slice(0, 11) || null
      if (u.pathname.startsWith('/v/')) return u.pathname.split('/')[2]?.slice(0, 11) || null
      return u.searchParams.get('v')?.slice(0, 11) || null
    }
  } catch {
    return null
  }
  return null
}

export function youtubeThumbnail(id) {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
}

export function embedMatchKey(embed) {
  if (!embed) return null
  if (embed.type === 'youtube') return `youtube:${embed.id}`
  if (embed.type === 'vimeo') return `vimeo:${embed.id}`
  if (embed.type === 'video') return `video:${embed.url}`
  if (embed.type === 'pageImage') return `pageImage:${embed.pageUrl}`
  return embed.url
}

export function parseVimeoId(url) {
  const normalized = normalizeUrl(url)
  if (!normalized) return null
  try {
    const u = new URL(normalized)
    if (!u.hostname.includes('vimeo.com')) return null
    const parts = u.pathname.split('/').filter(Boolean)
    const id = parts.find((p) => /^\d+$/.test(p))
    return id || null
  } catch {
    return null
  }
}

import { isPageImageLink } from './linkPreview'

export function isDataImageUrl(url) {
  return /^data:image\//i.test(String(url || '').trim())
}

export function getLinkEmbed(url) {
  const trimmed = String(url || '').trim()
  if (isDataImageUrl(trimmed)) {
    return { type: 'image', url: trimmed, sourceUrl: trimmed }
  }

  const normalized = normalizeUrl(trimmed)
  if (!normalized) return null

  const youtubeId = parseYouTubeId(normalized)
  if (youtubeId) return { type: 'youtube', id: youtubeId, url: normalized }

  const vimeoId = parseVimeoId(normalized)
  if (vimeoId) return { type: 'vimeo', id: vimeoId, url: normalized }

  if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(normalized)) {
    return { type: 'video', url: normalized, sourceUrl: normalized }
  }

  const imageUrl = resolveImageEmbedUrl(normalized)
  if (imageUrl) {
    return {
      type: 'image',
      url: imageUrl,
      sourceUrl: isDirectImageUrl(normalized) ? normalized : normalized,
    }
  }

  if (isPageImageLink(normalized)) {
    return { type: 'pageImage', pageUrl: normalized, url: normalized }
  }

  return null
}

export function collectEmbeds(text) {
  const seen = new Set()
  const embeds = []
  for (const seg of splitTextWithUrls(text)) {
    if (seg.type !== 'url') continue
    const embed = getLinkEmbed(seg.href || seg.value)
    if (!embed) continue
    const key = embedMatchKey(embed)
    if (!key || seen.has(key)) continue
    seen.add(key)
    embeds.push(embed)
  }
  return embeds
}

export function hasRichEmbeds(text) {
  return collectEmbeds(text).length > 0
}

export function textHasUrls(text) {
  if (!text) return false
  return splitTextWithUrls(text).some((seg) => seg.type === 'url')
}

/** Plain written thought — text only, no attached media or links. */
export function isTextOnlyThoughtPost({ text, image } = {}) {
  const body = (text || '').trim()
  if (!body || image) return false
  return !textHasUrls(body)
}

export function linkLabel(url) {
  const normalized = normalizeUrl(url)
  if (!normalized) return url
  try {
    const u = new URL(normalized)
    const yt = parseYouTubeId(normalized)
    if (yt) return 'YouTube'
    const vm = parseVimeoId(normalized)
    if (vm) return 'Vimeo'
    if (u.hostname.includes('cosmos.so')) return 'Cosmos'
    if (u.hostname.includes('pinterest.')) return 'Pinterest'
    if (u.hostname.includes('giphy.com')) return 'GIF'
    if (u.hostname.includes('tenor.com')) return 'GIF'
    return u.hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
