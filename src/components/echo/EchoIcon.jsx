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

/** Bat silhouette — map pins / anonymous author mark (not the app echo mark). */
export { batIcon }

/** Circular bat avatar for anonymous echo authors. */
export function BatAvatar({ className = 'w-11 h-11' }) {
  return (
    <div
      className={`shrink-0 rounded-full frens-avatar-ring overflow-hidden bg-white dark:bg-black flex items-center justify-center ${className}`}
      aria-hidden
    >
      <img src={batIcon} alt="" className="w-[70%] h-[70%] object-contain" draggable={false} />
    </div>
  )
}
