import echoIcon from '../../assets/icons/echo-mark.png'
import batIcon from '../../assets/icons/echo.png'
import { maskImageStyle } from '../../lib/maskIcon'

/**
 * Echo brand mark — sound-wave silhouette for nav, buttons, headers.
 * CSS mask + currentColor so light/dark both work.
 */
export default function EchoIcon({ className = 'w-5 h-4' }) {
  return (
    <span
      aria-hidden
      className={`frens-mask-icon inline-block align-middle shrink-0 ${className}`}
      style={{
        ...maskImageStyle(echoIcon),
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskPosition: 'center',
      }}
    />
  )
}

/** Brand mark asset (`assets/icons/echo-mark.png`). */
export { echoIcon }

/** Bat silhouette — map pins only (not the app echo mark). */
export { batIcon }
