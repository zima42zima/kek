/**
 * Vercel serverless GIPHY proxy — keeps the API key off the client bundle.
 * Set GIPHY_API_KEY (preferred) or VITE_GIPHY_KEY in Vercel project env.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405
    res.setHeader('Allow', 'GET')
    res.end(JSON.stringify({ meta: { status: 405, msg: 'Method not allowed' }, data: [] }))
    return
  }

  const key = String(process.env.GIPHY_API_KEY || process.env.VITE_GIPHY_KEY || '')
    .trim()
    .replace(/^['"]|['"]$/g, '')

  if (!key) {
    res.statusCode = 503
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({
      meta: {
        status: 503,
        msg: 'GIPHY key missing — set GIPHY_API_KEY in Vercel env and redeploy.',
      },
      data: [],
    }))
    return
  }

  const pathSegments = req.query?.path
  const gifPath = Array.isArray(pathSegments)
    ? `/${pathSegments.join('/')}`
    : pathSegments
      ? `/${pathSegments}`
      : '/trending'

  const search = new URLSearchParams()
  for (const [k, v] of Object.entries(req.query || {})) {
    if (k === 'path' || k === 'api_key') continue
    if (Array.isArray(v)) v.forEach((item) => search.append(k, String(item)))
    else if (v != null) search.set(k, String(v))
  }
  search.set('api_key', key)

  const upstream = `https://api.giphy.com/v1/gifs${gifPath}?${search.toString()}`

  try {
    const upstreamRes = await fetch(upstream, { headers: { Accept: 'application/json' } })
    const body = await upstreamRes.text()
    res.statusCode = upstreamRes.status
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'public, max-age=60')
    res.end(body)
  } catch (err) {
    res.statusCode = 502
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({
      meta: { status: 502, msg: err?.message || 'GIPHY proxy error' },
      data: [],
    }))
  }
}
