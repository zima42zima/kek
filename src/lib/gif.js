// GIPHY integration. Uses a free API key from `VITE_GIPHY_KEY`.
// Get one at https://developers.giphy.com/dashboard/

function readGiphyKey() {
  const raw = import.meta.env.VITE_GIPHY_KEY
    || import.meta.env.VITE_GIPHY_API_KEY
    || ''
  return String(raw).trim().replace(/^['"]|['"]$/g, '')
}

const GIPHY_KEY = readGiphyKey()
const GIPHY_DIRECT = 'https://api.giphy.com/v1/gifs'
const GIPHY_PROXY = '/api/giphy'
const RATING = 'pg-13'
/** GIPHY allows up to 50 per request. */
export const GIF_PICKER_LIMIT = 50

export function giphyEnabled() {
  return Boolean(GIPHY_KEY)
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

function apiBase() {
  // Dev + preview: same-origin proxy (see vite.config.js giphy-proxy plugin).
  if (import.meta.env.DEV || import.meta.env.MODE === 'preview') return GIPHY_PROXY
  return GIPHY_DIRECT
}

async function getJson(pathAndQuery) {
  const url = `${apiBase()}${pathAndQuery}`
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
    if (apiStatus === 401 || res.status === 401) {
      throw new Error(msg || 'GIPHY key rejected — check VITE_GIPHY_KEY in .env (use an API Key from developers.giphy.com, not SDK key).')
    }
    if (apiStatus === 429 || res.status === 429) {
      throw new Error('GIPHY rate limit (100/hour on free beta key) — wait a bit and try again.')
    }
    throw new Error(msg || 'Could not load GIFs from GIPHY.')
  }
  return json
}

export async function trendingGifs(limit = 24) {
  if (!GIPHY_KEY) return []
  const json = await getJson(
    `/trending?api_key=${encodeURIComponent(GIPHY_KEY)}&limit=${limit}&rating=${RATING}`,
  )
  return (json.data || []).map(mapGif).filter((g) => g.full)
}

export async function searchGifs(query, limit = 24) {
  if (!GIPHY_KEY) return []
  const q = query.trim()
  if (!q) return trendingGifs(limit)
  const json = await getJson(
    `/search?api_key=${encodeURIComponent(GIPHY_KEY)}&q=${encodeURIComponent(q)}&limit=${limit}&rating=${RATING}`,
  )
  return (json.data || []).map(mapGif).filter((g) => g.full)
}
