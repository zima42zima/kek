export const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
}

export function canUseMedia() {
  return Boolean(window.isSecureContext && navigator.mediaDevices?.getUserMedia)
}

function isInAppBrowser() {
  const ua = navigator.userAgent || ''
  return /FBAN|FBAV|Instagram|Twitter|Line\/|Snapchat|LinkedInApp/i.test(ua)
}

function httpsHint() {
  const host = window.location.hostname
  const port = window.location.port || '5173'
  const proto = window.location.protocol
  if (window.isSecureContext && proto === 'https:') return null

  const isLocalhost = host === 'localhost' || host === '127.0.0.1'
  if (isLocalhost) {
    return `Calls need HTTPS here. On your Mac run: npm run dev:https — then open https://localhost:${port}`
  }
  return 'Calls need HTTPS on this device. Same Wi‑Fi: npm run dev:https + npm run dev:lan. Remote: npm run dev:tunnel (or install dev cert: npm run dev:ca).'
}

/** Actionable message when getUserMedia is blocked. */
export function mediaUnavailableReason() {
  if (canUseMedia()) return null

  const secureHint = httpsHint()
  if (secureHint) return secureHint

  if (isInAppBrowser()) {
    return 'Open this page in Safari or Chrome (not inside Instagram, etc.) to use calls.'
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    return 'Calls are not available in this browser. Use Safari or Chrome on a phone, or Chrome/Firefox on desktop.'
  }

  return 'Calls need HTTPS and microphone/camera permission.'
}

export function mediaErrorMessage(err) {
  const blocked = mediaUnavailableReason()
  if (blocked) return blocked
  if (err?.name === 'NotAllowedError') return 'Microphone/camera permission denied.'
  if (err?.name === 'NotFoundError') return 'No microphone or camera found.'
  return err?.message || 'Could not access microphone/camera.'
}

export async function getCallMedia(type) {
  const constraints = type === 'video'
    ? { audio: true, video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } }
    : { audio: true, video: false }
  return navigator.mediaDevices.getUserMedia(constraints)
}

export function stopStream(stream) {
  stream?.getTracks().forEach((t) => t.stop())
}

export function toggleTrack(stream, kind, enabled) {
  stream?.getTracks().forEach((t) => {
    if (t.kind === kind) t.enabled = enabled
  })
}
