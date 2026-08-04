import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import mkcert from 'vite-plugin-mkcert'
import os from 'os'

// `npm run dev` → plain http (fine on localhost for calls).
// `npm run dev:https` → trusted local HTTPS via mkcert (phone / LAN testing).
const useHttps = process.env.HTTPS === 'true'

function localHosts() {
  const hosts = new Set(['localhost', '127.0.0.1'])
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces || []) {
      const v4 = iface.family === 'IPv4' || iface.family === 4
      if (v4 && !iface.internal && iface.address) {
        hosts.add(iface.address)
      }
    }
  }
  return [...hosts]
}

/** Server-side GIPHY proxy — browser fetches same-origin /api/giphy/* instead of api.giphy.com. */
function giphyProxyPlugin() {
  function readKey() {
    const raw = process.env.GIPHY_API_KEY || process.env.VITE_GIPHY_KEY || ''
    return String(raw).trim().replace(/^['"]|['"]$/g, '')
  }

  async function handle(req, res) {
    const path = (req.url || '/').split('?')[0]
    const search = new URLSearchParams((req.url || '').includes('?') ? req.url.slice(req.url.indexOf('?') + 1) : '')
    const incomingKey = String(search.get('api_key') || '').trim()
    const key = readKey() || incomingKey
    search.delete('api_key')

    if (!key) {
      res.statusCode = 503
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({
        meta: { status: 503, msg: 'Add GIPHY_API_KEY or VITE_GIPHY_KEY to .env and restart dev.' },
        data: [],
      }))
      return
    }

    search.set('api_key', key)
    const upstream = `https://api.giphy.com/v1/gifs${path}?${search.toString()}`
    try {
      const upstreamRes = await fetch(upstream, {
        headers: { Accept: 'application/json' },
      })
      const body = await upstreamRes.text()
      const contentType = upstreamRes.headers.get('content-type') || ''
      if (!contentType.includes('json') && !body.trimStart().startsWith('{')) {
        res.statusCode = 502
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({
          meta: {
            status: 502,
            msg: body.trim().slice(0, 120) || `GIPHY returned HTTP ${upstreamRes.status}`,
          },
          data: [],
        }))
        return
      }
      res.statusCode = upstreamRes.status
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Cache-Control', 'no-store')
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

  function attach(server) {
    server.middlewares.use((req, res, next) => {
      if (!req.url?.startsWith('/api/giphy')) return next()
      const stripped = req.url.replace(/^\/api\/giphy/, '') || '/'
      req.url = stripped
      handle(req, res)
    })
  }

  return {
    name: 'giphy-proxy',
    configureServer(server) {
      attach(server)
    },
    configurePreviewServer(server) {
      attach(server)
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    giphyProxyPlugin(),
    ...(useHttps ? [mkcert({ hosts: localHosts() })] : []),
  ],
  server: {
    host: '0.0.0.0',
    port: Number(process.env.PORT) || 5173,
    strictPort: false,
    allowedHosts: true,
    ...(useHttps ? { https: true } : {}),
  },
  preview: {
    host: '0.0.0.0',
    port: Number(process.env.PORT) || 5173,
  },
})
