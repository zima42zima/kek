import cavesIcon from '../../assets/icons/caves.svg'

// The exact caves icon from the dashboard nav, rendered as a monochrome masked
// icon that takes the current theme color (black in light, white in dark).
export default function CaveIcon({ className = 'w-4 h-4' }) {
  return (
    <span
      aria-hidden
      className={`frens-mask-icon inline-block align-middle ${className}`}
      style={{ maskImage: `url(${cavesIcon})`, WebkitMaskImage: `url(${cavesIcon})` }}
    />
  )
}

// Always use the dashboard cave icon — monochrome, theme-colored.
export function CaveGlyph({ className = 'w-4 h-4' }) {
  return <CaveIcon className={className} />
}

export { cavesIcon }
