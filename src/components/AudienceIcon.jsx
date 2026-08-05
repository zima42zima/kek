import worldIcon from '../assets/icons/world.png'
import cavesIcon from '../assets/icons/caves-mark.png'
import frogIcon from '../assets/icons/frog-icon.svg'
import { maskImageStyle } from '../lib/maskIcon'

// Masked (theme-colored) icons for audiences we have art for.
const MASKED = {
  everyone: worldIcon,
  cave: cavesIcon,
  frens: frogIcon,
}

// Minimal black & white audience icons. Masked art takes the current theme
// color (black in light, white in dark); the rest are inline mono SVGs.
export default function AudienceIcon({ id, className = 'w-4 h-4' }) {
  const masked = MASKED[id]
  if (masked) {
    return (
      <span
        aria-hidden
        className={`frens-mask-icon inline-block align-middle ${className}`}
        style={maskImageStyle(masked)}
      />
    )
  }

  if (id === 'fam') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className={`inline-block align-middle ${className}`} fill="currentColor">
        <path d="M12 21s-6.7-4.35-9.33-8.09C1.03 10.26 1.86 6.8 4.86 6.13c1.86-.42 3.63.52 4.64 2.02.36.54 1.64.54 2 0 1.01-1.5 2.78-2.44 4.64-2.02 3 .67 3.83 4.13 2.19 6.78C18.7 16.65 12 21 12 21z" />
      </svg>
    )
  }

  if (id === 'other') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className={`inline-block align-middle ${className}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.6 13.4 12 22l-8.5-8.5V4H12l8.6 8.6a1 1 0 0 1 0 1.4z" />
        <circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
      </svg>
    )
  }

  // Fallback = everyone/world.
  return (
    <span
      aria-hidden
      className={`frens-mask-icon inline-block align-middle ${className}`}
      style={maskImageStyle(worldIcon)}
    />
  )
}
