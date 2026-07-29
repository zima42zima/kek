import { isDirectImageUrl, normalizeUrl } from './urls'
import { mediaKindFromUrl } from './mediaKind'

const COSMOS_GRAPHQL = 'https://api.cosmos.so/graphql'

const COSMOS_ELEMENT_QUERY = `
fragment ElementMedia on Media {
  mediaId
  url
  __typename
  ... on AnimatedImage {
    video { url thumbnailUrl }
  }
  ... on Video {
    url
    mux { mp4Url(quality: LOW) playbackUrl }
  }
  ... on StaticImage { blurHash }
}
fragment ElementTile on ElementTile {
  id
  __typename
  ... on MediaElementTile { media { ...ElementMedia } }
  ... on ProductElementTile { media { ...ElementMedia } }
  ... on WebsiteElementTile { media { ...ElementMedia } }
}
query GetElementDetails($elementId: ElementId!) {
  elementView(elementId: $elementId) {
    element { ...ElementTile }
  }
}
`

export function isCosmosPageUrl(url) {
  const normalized = normalizeUrl(url)
  if (!normalized) return false
  try {
    const host = new URL(normalized).hostname.replace(/^www\./, '')
    if (host === 'cdn.cosmos.so') return false
    return host.includes('cosmos.so')
  } catch {
    return false
  }
}

export function isPinterestPageUrl(url) {
  const normalized = normalizeUrl(url)
  if (!normalized) return false
  try {
    const host = new URL(normalized).hostname.replace(/^www\./, '')
    if (host.includes('pinimg.com')) return false
    return host === 'pin.it' || host.includes('pinterest.')
  } catch {
    return false
  }
}

export function isPageImageLink(url) {
  return isCosmosPageUrl(url) || isPinterestPageUrl(url)
}

export function parseCosmosElementId(url) {
  const normalized = normalizeUrl(url)
  if (!normalized) return null
  try {
    const u = new URL(normalized)
    if (!u.hostname.includes('cosmos.so')) return null
    const match = u.pathname.match(/\/e\/(\d+)/)
    return match ? Number(match[1]) : null
  } catch {
    return null
  }
}

function stripCosmosCdnTransforms(url) {
  if (!url) return null
  const match = String(url).match(/https:\/\/cdn\.cosmos\.so\/[a-f0-9-]+(?:\.mp4)?/i)
  if (!match) return url
  return match[0].split('?')[0]
}

function pickCosmosMediaUrl(media) {
  if (!media) return null
  if (media.__typename === 'Video') {
    return media.url || media.mux?.mp4Url || media.mux?.playbackUrl || null
  }
  if (media.__typename === 'AnimatedImage') {
    return media.video?.url || media.url || null
  }
  return media.url || null
}

function cosmosMediaKind(media, url) {
  if (media?.__typename === 'Video') return 'video'
  if (media?.__typename === 'AnimatedImage') {
    const kind = mediaKindFromUrl(url)
    return kind === 'video' ? 'video' : 'image'
  }
  return 'image'
}

async function fetchCosmosElementMedia(elementId) {
  try {
    const res = await fetch(COSMOS_GRAPHQL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://www.cosmos.so',
      },
      body: JSON.stringify({
        operationName: 'GetElementDetails',
        query: COSMOS_ELEMENT_QUERY,
        variables: { elementId: Number(elementId) },
      }),
    })
    if (!res.ok) return null
    const json = await res.json().catch(() => null)
    const media = json?.data?.elementView?.element?.media
    const url = stripCosmosCdnTransforms(pickCosmosMediaUrl(media))
    if (!url) return null
    return { url, kind: cosmosMediaKind(media, url) }
  } catch {
    return null
  }
}

async function fetchMicrolinkPreview(pageUrl) {
  try {
    const res = await fetch(
      `https://api.microlink.io?url=${encodeURIComponent(pageUrl)}&screenshot=false&video=true&audio=false`,
    )
    if (!res.ok) return null
    const json = await res.json()
    const data = json?.data
    if (data?.video?.url) {
      return { url: data.video.url, kind: 'video' }
    }
    const imageUrl = data?.image?.url
    if (!imageUrl) return null
    const stripped = stripCosmosCdnTransforms(imageUrl)
    return { url: stripped || imageUrl, kind: 'image' }
  } catch {
    return null
  }
}

async function fetchPinterestPreview(pageUrl) {
  try {
    const res = await fetch(
      `https://www.pinterest.com/oembed.json?url=${encodeURIComponent(pageUrl)}`,
    )
    if (!res.ok) return null
    const json = await res.json()
    const url = json?.thumbnail_url
    if (!url) return null
    return { url, kind: 'image' }
  } catch {
    return null
  }
}

/** Resolve a Cosmos or Pinterest page URL to playable media. */
export async function resolvePagePreviewMedia(pageUrl) {
  const normalized = normalizeUrl(pageUrl)
  if (!normalized) return null

  if (isDirectImageUrl(normalized)) {
    return { url: normalized, kind: mediaKindFromUrl(normalized) }
  }

  if (isCosmosPageUrl(normalized)) {
    const elementId = parseCosmosElementId(normalized)
    if (elementId) {
      const cosmos = await fetchCosmosElementMedia(elementId)
      if (cosmos) return cosmos
    }
    const microlink = await fetchMicrolinkPreview(normalized)
    if (microlink) return microlink
    return null
  }

  if (isPinterestPageUrl(normalized)) {
    const pin = await fetchPinterestPreview(normalized)
    if (pin) return pin
  }

  const fallback = await fetchMicrolinkPreview(normalized)
  return fallback
}

/** Back-compat helper — returns a preview URL string. */
export async function resolvePagePreviewImage(pageUrl) {
  const media = await resolvePagePreviewMedia(pageUrl)
  return media?.url || null
}
