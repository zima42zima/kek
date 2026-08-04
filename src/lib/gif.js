// GIPHY via same-origin /api/giphy proxy (Vite in dev, Vercel serverless in prod).
// Set GIPHY_API_KEY or VITE_GIPHY_KEY in .env / Vercel — key stays off the client when using the proxy.

function readGiphyKey() {
  const raw = import.meta.env.VITE_GIPHY_KEY
    || import.meta.env.VITE_GIPHY_API_KEY
    || ''
  return String(raw).trim().replace(/^['"]|['"]$/g, '')
}

const GIPHY_KEY = readGiphyKey()
const GIPHY_PROXY = '/api/giphy'
const RATING = 'pg-13'
/** GIPHY allows up to 50 per request. */
export const GIF_PICKER_LIMIT = 50

/** GIF search UI is on; the proxy returns a clear error if the server key is missing. */
export function giphyEnabled() {
  return true
}

function mapGif(g) {
  const images = g.images || {}
  return {
    id: g.id,
    preview:
      images.fixed_width_small?.url ||
      images.fixed_width?.url ||
      images.preview_gif?.url,
    full:
      images.downsized_medium?.url ||
      images.downsized?.url ||
      images.original?.url,
    title: g.title || 'gif',
  }
}

function withKey(pathAndQuery) {
  // Prefer letting the proxy inject the server key. Fall back to client key for older setups.
  if (!GIPHY_KEY) return pathAndQuery
  const sep = pathAndQuery.includes('?') ? '&' : '?'
  if (/[?&]api_key=/.test(pathAndQuery)) return pathAndQuery
  return `${pathAndQuery}${sep}api_key=${encodeURIComponent(GIPHY_KEY)}`
}

async function getJson(pathAndQuery) {
  const url = `${GIPHY_PROXY}${withKey(pathAndQuery)}`
  let res
  try {
    res = await fetch(url)
  } catch (err) {
    const hint = import.meta.env.DEV
      ? ' Restart dev server (npm run dev) after changing .env.'
      : ''
    throw new Error(`${err?.message || 'Could not reach GIPHY.'}${hint}`)
  }
  const json = await res.json().catch(() => ({}))
  const apiStatus = Number(json?.meta?.status)
  if (!res.ok || (apiStatus && apiStatus !== 200)) {
    const msg = json?.meta?.msg || json?.message
    if (apiStatus === 503 || res.status === 503) {
      throw new Error(msg || 'GIPHY is not configured on the server yet.')
    }
    if (apiStatus === 401 || res.status === 401) {
      throw new Error(msg || 'GIPHY key rejected — check GIPHY_API_KEY / VITE_GIPHY_KEY.')
    }
    if (apiStatus === 429 || res.status === 429) {
      throw new Error('GIPHY rate limit (100/hour on free beta key) — wait a bit and try again.')
    }
    throw new Error(msg || 'Could not load GIFs from GIPHY.')
  }
  return json
}

export async function trendingGifs(limit = 24) {
  const json = await getJson(
    `/trending?limit=${limit}&rating=${RATING}`,
  )
  return (json.data || []).map(mapGif).filter((g) => g.full)
}

export async function searchGifs(query, limit = 24) {
  const q = query.trim()
  if (!q) return trendingGifs(limit)
  const json = await getJson(
    `/search?q=${encodeURIComponent(q)}&limit=${limit}&rating=${RATING}`,
  )
  return (json.data || []).map(mapGif).filter((g) => g.full)
}
