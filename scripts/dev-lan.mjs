#!/usr/bin/env node
/**
 * Same-WiFi phone testing — no Cloudflare, no localtunnel.
 * Terminal A: npm run dev:https
 * Terminal B: npm run dev:lan  (prints the URL to open on your phone)
 */
import net from 'net'
import os from 'os'

function portOpen(port) {
  return new Promise((resolve) => {
    const s = net.connect({ port, host: '127.0.0.1' }, () => {
      s.end()
      resolve(true)
    })
    s.on('error', () => resolve(false))
  })
}

function lanIpv4() {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces || []) {
      const v4 = iface.family === 'IPv4' || iface.family === 4
      if (v4 && !iface.internal && iface.address) return iface.address
    }
  }
  return null
}

const up = await portOpen(5173)
const ip = lanIpv4()

console.log('\n  ┌─────────────────────────────────────────────────┐')
console.log('  │  Frens local (same Wi‑Fi) — open on your phone   │')
console.log('  └─────────────────────────────────────────────────┘\n')

if (!up) {
  console.error('  ❌ Nothing on port 5173.\n')
  console.error('  Start the app first (HTTPS recommended for calls):\n')
  console.error('    npm run dev:https\n')
  process.exit(1)
}

if (!ip) {
  console.error('  ❌ Could not find your Mac’s Wi‑Fi IP.\n')
  console.error('  Connect to Wi‑Fi, then retry.\n')
  process.exit(1)
}

console.log('  Terminal A should be running:\n')
console.log('    npm run dev:https\n')
console.log('  On your phone (same Wi‑Fi as this Mac), open:\n')
console.log(`    https://${ip}:5173\n`)
console.log('  First time on iPhone: you may need the dev cert.')
console.log('  Run on Mac: npm run dev:ca — install rootCA.pem on the phone.\n')
console.log('  Plain HTTP (no calls/mic): http://' + ip + ':5173')
console.log('  (only if you used npm run dev instead of dev:https)\n')
console.log('  ✓ No tunnel — nothing to crash. Keep npm run dev:https running.\n')
