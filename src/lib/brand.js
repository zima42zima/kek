/** Public app name (UI, invites, stamps). Member word stays "fren". */
export const APP_NAME = 'MISAO'

/** Location map feature — UI copy only (code/API still uses echo). */
export const ECHO_LABEL = 'Echo'
export const ECHOES_LABEL = 'Echoes'

export function echoWord(count = 1) {
  return count === 1 ? 'echo' : 'echoes'
}

export function echoCountLabel(count) {
  return `${count} ${echoWord(count)}`
}

/** Production domain — used for fallbacks and docs. */
export const APP_DOMAIN = 'misao.app'
export const APP_ORIGIN = `https://${APP_DOMAIN}`

/** Current site origin in the browser; production fallback when building server-side. */
export function appOrigin() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  return APP_ORIGIN
}
