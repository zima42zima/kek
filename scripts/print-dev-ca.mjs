#!/usr/bin/env node
/**
 * Print where the local dev CA lives so you can install it on phones / other laptops.
 * Run once after: npm run dev:https
 */
import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

const mkcertBin = join(homedir(), '.vite-plugin-mkcert', 'mkcert')

if (!existsSync(mkcertBin)) {
  console.log('\n  mkcert not set up yet. Run this first:\n')
  console.log('    npm run dev:https')
  console.log('\n  (enter your Mac password when asked)\n')
  process.exit(1)
}

const caroot = execSync(`"${mkcertBin}" -CAROOT`, { encoding: 'utf8' }).trim()
const caFile = join(caroot, 'rootCA.pem')

console.log('\n  Dev certificate for other devices\n')
console.log(`  CA file: ${caFile}\n`)
console.log('  iPhone / iPad')
console.log('    1. AirDrop or email rootCA.pem to the device')
console.log('    2. Settings → General → VPN & Device Management → install profile')
console.log('    3. Settings → General → About → Certificate Trust Settings')
console.log('       → enable full trust for the mkcert root\n')
console.log('  Android')
console.log('    1. Copy rootCA.pem to the phone')
console.log('    2. Settings → Security → Install a certificate → CA certificate')
console.log('    3. Confirm the warning (dev only)\n')
console.log('  Other Mac / laptop')
console.log('    1. Copy rootCA.pem over')
console.log('    2. Double-click → Keychain Access → set to Always Trust\n')
console.log('  Then open: https://YOUR-MAC-IP:5173  (from npm run dev:https)\n')
console.log('  Easier option (no cert install): npm run dev:tunnel — see URL in terminal\n')
