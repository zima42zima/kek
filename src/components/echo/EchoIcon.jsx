import echoIcon from '../../assets/icons/echo.png'

// The echo brand mark. Painted with `currentColor` via a CSS mask so it always
// matches the surrounding text color (works on any background).
export default function EchoIcon({ className = 'w-5 h-4' }) {
  return (
    <span
      aria-hidden
      className={`inline-block align-middle ${className}`}
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

// Raw asset URL, for contexts that can't render React (e.g. Leaflet HTML markers).
export { echoIcon }
