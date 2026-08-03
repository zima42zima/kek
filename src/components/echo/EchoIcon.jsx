import echoIcon from '../../assets/icons/echo.svg'
import batIcon from '../../assets/icons/echo.png'

/**
 * Echo brand mark for app UI — nav, buttons, headers.
 * CSS mask + currentColor so light/dark both work.
 */
export default function EchoIcon({ className = 'w-5 h-5' }) {
  return (
    <span
      aria-hidden
      className={`inline-block align-middle shrink-0 ${className}`}
      style={{
        backgroundColor: 'currentColor',
        maskImage: `url(${echoIcon})`,
        WebkitMaskImage: `url(${echoIcon})`,
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

/** Brand mark asset (`assets/icons/echo.svg`). */
export { echoIcon }

/** Bat silhouette — map pins only (not the app echo mark). */
export { batIcon }
