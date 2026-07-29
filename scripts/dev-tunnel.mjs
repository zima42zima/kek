#!/usr/bin/env node
/**
 * Expose local dev server over HTTPS for phones (localtunnel).
 * Prefer same Wi‑Fi without a tunnel: npm run dev:lan
 * Requires `npm run dev` already running on port 5173.
 */
import { spawn } from 'child_process'
import net from 'net'
import https from 'https'

function portOpen(port) {
  return new Promise((resolve) => {
    const s = net.connect({ port, host: '127.0.0.1' }, () => {
      s.end()
      resolve(true)
    })
    s.on('error', () => resolve(false))
  })
}

function fetchPublicIp(timeoutMs = 5000) {
  return new Promise((resolve) => {
    const req = https.get('https://api.ipify.org', (res) => {
      let body = ''
      res.on('data', (c) => { body += c })
      res.on('end', () => resolve(body.trim() || null))
    })
    req.on('error', () => resolve(null))
    req.setTimeout(timeoutMs, () => {
      req.destroy()
      resolve(null)
    })
  })
}

const up = await portOpen(5173)
if (!up) {
  console.error('\n  ❌ Nothing on port 5173.\n')
  console.error('  Terminal A — start the app first:\n')
  console.error('    npm run dev\n')
  console.error('  Same Wi‑Fi (no tunnel, recommended):\n')
  console.error('    npm run dev:https   # Terminal A')
  console.error('    npm run dev:lan     # Terminal B — open printed URL\n')
  console.error('  Or remote tunnel:\n')
  console.error('    npm run dev:tunnel\n')
  process.exit(1)
}

console.log('\n  ┌─────────────────────────────────────────────────┐')
console.log('  │  Frens dev tunnel — use this on your phone       │')
console.log('  └─────────────────────────────────────────────────┘\n')
console.log('  Tip: same Wi‑Fi? Use npm run dev:lan instead (more stable).\n')
console.log('  Connecting to localtunnel (may take 10–30 seconds)…\n')

const ip = await fetchPublicIp()

const child = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['--yes', 'localtunnel', '--port', '5173', '--local-host', '127.0.0.1'],
  { stdio: ['inherit', 'pipe', 'inherit'] },
)

child.stdout.on('data', (buf) => {
  const text = buf.toString()
  process.stdout.write(text)
  const m = text.match(/https:\/\/[^\s]+\.loca\.lt/)
  if (m) {
    console.log('\n  ─── Phone setup ───')
    console.log(`  1. Open in Safari/Chrome: ${m[0]}`)
    console.log('  2. First visit shows a localtunnel page — tap Continue')
    if (ip) {
      console.log(`  3. If it asks for a password, enter: ${ip}`)
      console.log('     (your Mac\'s public IP — only needed once)')
    }
    console.log('  4. Sign in → Messages → try a call\n')
    console.log('  ✓ Tunnel is RUNNING — leave this window open.')
    console.log('  ✗ Blank page? Stop this and use: npm run dev:lan (same Wi‑Fi)\n')
  }
})

child.on('exit', (code) => process.exit(code ?? 0))
