import { useTheme } from '../context/ThemeContext'
import sunIcon from '../assets/icons/sun.png'
import moonIcon from '../assets/icons/moon.png'

function ThemeIcon({ src }) {
  return (
    <span
      aria-hidden
      className="w-4 h-4 shrink-0 bg-black dark:bg-white"
      style={{
        maskImage: `url(${src})`,
        WebkitMaskImage: `url(${src})`,
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

/**
 * One control: shows moon in dark mode, sun in light mode.
 * Click switches to the other theme.
 */
export default function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
      className={`frens-action w-9 h-9 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 transition shrink-0 ${className}`}
    >
      {/* Dark → moon (tap for light). Light → sun (tap for dark). */}
      <ThemeIcon src={isDark ? moonIcon : sunIcon} />
    </button>
  )
}
