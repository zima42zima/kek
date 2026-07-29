/** Public app name (UI, invites, stamps). Member word stays "fren". */
export const APP_NAME = 'MISAO'

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
