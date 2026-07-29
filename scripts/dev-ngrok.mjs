#!/usr/bin/env node
/**
 * Expose local Vite dev server over HTTPS via ngrok (phone / remote testing).
 * Requires `npm run dev` already running on port 5173.
 *
 * One-time setup:
 *   ngrok config add-authtoken <token from dashboard.ngrok.com>
 */
import { spawn } from 'child_process'
import net from 'net'

function portOpen(port) {
  return new Promise((resolve) => {
    const s = net.connect({ port, host: '127.0.0.1' }, () => {
      s.end()
      resolve(true)
    })
    s.on('error', () => resolve(false))
  })
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchTunnelUrl() {
  try {
    const res = await fetch('http://127.0.0.1:4040/api/tunnels')
    if (!res.ok) return null
    const data = await res.json()
    const https = data.tunnels?.find((t) => t.public_url?.startsWith('https://'))
    return https?.public_url ?? null
  } catch {
    return null
  }
}

async function waitForTunnelUrl(maxMs = 15000) {
  const deadline = Date.now() + maxMs
  while (Date.now() < deadline) {
    const url = await fetchTunnelUrl()
    if (url) return url
    await sleep(400)
  }
  return null
}

function printPhoneSetup(url) {
  console.log('  ─── Phone setup ───')
  console.log(`  1. Open: ${url}`)
  console.log('  2. First visit may show ngrok “Visit Site” — tap through')
  console.log('  3. Camera / mic / location need this https URL (not http://LAN-IP)')
  console.log('  4. Keep BOTH terminals running (npm run dev + this tunnel)\n')
  console.log('  Dashboard: http://127.0.0.1:4040\n')
  console.log('  ✓ Tunnel is RUNNING — leave this window open.')
  console.log('  ✗ Do not type commands here (ngrok owns this terminal).')
  console.log('  → Use a separate Terminal window for npm run dev or other commands.\n')
}

const devUp = await portOpen(5173)
if (!devUp) {
  console.error('\n  ❌ Nothing on port 5173.\n')
  console.error('  Terminal A — start the app first:\n')
  console.error('    cd /Users/alena/frens-app')
  console.error('    npm run dev\n')
  console.error('  Terminal B — then start the tunnel:\n')
  console.error('    cd /Users/alena/frens-app')
  console.error('    npm run dev:ngrok\n')
  process.exit(1)
}

const ngrokDashboardUp = await portOpen(4040)
if (ngrokDashboardUp) {
  const existing = await fetchTunnelUrl()
  if (existing) {
    console.log('\n  ┌─────────────────────────────────────────────────┐')
    console.log('  │  ngrok is already running on this Mac            │')
    console.log('  └─────────────────────────────────────────────────┘\n')
    printPhoneSetup(existing)
    console.log('  Do NOT start dev:ngrok again — find the other terminal')
    console.log('  where ngrok is running and leave that one open.\n')
    process.exit(0)
  }
}

console.log('\n  ┌─────────────────────────────────────────────────┐')
console.log('  │  Frens ngrok tunnel — open on your phone         │')
console.log('  └─────────────────────────────────────────────────┘\n')
console.log('  Starting ngrok → localhost:5173 …\n')

const child = spawn('ngrok', ['http', '5173', '--host-header=rewrite', '--log=stdout'], {
  stdio: ['inherit', 'pipe', 'pipe'],
})

child.stderr.on('data', (buf) => {
  const text = buf.toString()
  if (text.includes('ERR_NGROK_4018') || text.includes('not authenticated')) {
    console.error('\n  ❌ ngrok is not authenticated on this Mac.\n')
    console.error('  1. Open https://dashboard.ngrok.com/get-started/your-authtoken')
    console.error('  2. Copy your authtoken')
    console.error('  3. Run:  ngrok config add-authtoken YOUR_TOKEN_HERE')
    console.error('  4. Retry: npm run dev:ngrok\n')
    child.kill()
  }
  if (text.includes('ERR_NGROK_334') || text.includes('already online')) {
    console.error('\n  ❌ Another ngrok tunnel is already running.')
    console.error('  Leave that terminal open, or stop it first (Ctrl+C).\n')
    child.kill()
  }
})

const url = await waitForTunnelUrl()
if (url) {
  printPhoneSetup(url)
} else {
  console.log('  Tunnel starting… check http://127.0.0.1:4040 for the public URL.\n')
}

child.on('exit', (code) => process.exit(code ?? 0))
