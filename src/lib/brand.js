/** Public app name (UI, invites, stamps). Member word stays "fren". */
export const APP_NAME = 'MISAO'

/** Location map feature — UI copy only (code/API still uses echo). */
export const AFTERSOUND_LABEL = 'Aftersound'
export const AFTERSOUNDS_LABEL = 'Aftersounds'

export function aftersoundWord(count = 1) {
  return count === 1 ? 'aftersound' : 'aftersounds'
}

export function aftersoundCountLabel(count) {
  return `${count} ${aftersoundWord(count)}`
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
