/** Build shareable invite links and copy-paste messages (no SMS/email from MISAO). */
import { APP_NAME, appOrigin } from './brand'

export function normalizeInviteCode(code) {
  return (code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function inviteCodeFromUrl(search = '') {
  if (typeof window !== 'undefined' && !search) {
    search = window.location.search
  }
  const params = new URLSearchParams(search)
  const raw = params.get('invite') || params.get('code') || ''
  const clean = normalizeInviteCode(raw)
  return clean || null
}

export function inviteJoinUrl(code) {
  const clean = normalizeInviteCode(code)
  const origin = appOrigin()
  return `${origin}/?invite=${encodeURIComponent(clean)}`
}

export function inviteMessage(code, { inviterName } = {}) {
  const clean = normalizeInviteCode(code)
  const url = inviteJoinUrl(clean)
  const opener = inviterName
    ? `${inviterName} invited you to ${APP_NAME}`
    : `A fren invited you to ${APP_NAME}`

  return [
    opener,
    'A small human cave — no clout, no ads, just frens.',
    '',
    `Code: ${clean}`,
    url,
    '',
    'Open the link or enter the code at the gate.',
  ].join('\n')
}

export function clearInviteFromUrl() {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  url.searchParams.delete('invite')
  url.searchParams.delete('code')
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

export async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const el = document.createElement('textarea')
  el.value = text
  document.body.appendChild(el)
  el.select()
  document.execCommand('copy')
  document.body.removeChild(el)
}

export async function shareInvite(code, { inviterName } = {}) {
  const clean = normalizeInviteCode(code)
  const text = inviteMessage(clean, { inviterName })
  const url = inviteJoinUrl(clean)

  if (navigator.share) {
    try {
      await navigator.share({
        title: `${APP_NAME} invite`,
        text,
        url,
      })
      return 'shared'
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled'
    }
  }

  await copyText(text)
  return 'copied'
}
