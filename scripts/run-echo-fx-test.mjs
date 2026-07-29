import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto('http://127.0.0.1:5179/test-echo-fx.html', { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForFunction(() => document.getElementById('log').textContent.includes('done'), { timeout: 120000 })
const log = await page.locator('#log').textContent()
console.log(log)
const failed = log.split('\n').filter((l) => l.startsWith('✗'))
await browser.close()
process.exit(failed.length ? 1 : 0)
