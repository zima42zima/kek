#!/usr/bin/env node
/** Quick GIPHY setup check — run: node scripts/check-giphy.mjs [port] */
import { readFileSync } from 'fs'

const port = process.argv[2] || '5173'
const env = readFileSync('.env', 'utf8')
const key = env.match(/^VITE_GIPHY_KEY=(.*)$/m)?.[1]?.trim()

console.log('GIPHY key in .env:', key ? `yes (${key.length} chars)` : 'MISSING')
if (!key) {
  console.log('\nAdd VITE_GIPHY_KEY to .env from https://developers.giphy.com/dashboard/')
  process.exit(1)
}

const url = `http://127.0.0.1:${port}/api/giphy/trending?api_key=${encodeURIComponent(key)}&limit=2&rating=pg-13`
console.log(`Testing proxy at port ${port}…`)

try {
  const res = await fetch(url)
  const json = await res.json().catch(async () => ({ raw: await res.text() }))
  const status = json?.meta?.status ?? res.status
  const msg = json?.meta?.msg || json?.raw || res.statusText
  const count = json?.data?.length ?? 0
  console.log(`HTTP ${res.status} · API ${status} · ${msg} · ${count} GIF(s)`)
  if (status === 200 && count > 0) {
    console.log('\n✓ GIPHY search should work — open the app on this same port and hard-refresh.')
    process.exit(0)
  }
  if (status === 401) {
    console.log('\n✗ Key rejected. In GIPHY dashboard create an "API Key" (beta is free). No paid upgrade needed for dev.')
  } else if (status === 429) {
    console.log('\n✗ Rate limited (100 calls/hour on free beta). Wait and retry — still no paid upgrade required.')
  } else {
    console.log('\n✗ Unexpected response. Is `npm run dev` running on this port?')
  }
  process.exit(1)
} catch (err) {
  console.log(`\n✗ Could not reach http://127.0.0.1:${port}/api/giphy/`)
  console.log('  Start dev: npm run dev')
  console.log('  Use the port Vite prints (5173, 5174, …) — old tabs on the wrong port show "Failed to fetch".')
  console.log(`  Error: ${err.message}`)
  process.exit(1)
}
