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

export default function ThemeToggle({ className = '' }) {
  const { theme, setTheme } = useTheme()

  const btnClass =
    'frens-action w-9 h-9 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 transition shrink-0'

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <button
        type="button"
        onClick={() => setTheme('light')}
        aria-label="Light mode"
        aria-pressed={theme === 'light'}
        title="Light mode"
        className={`${btnClass} ${theme === 'light' ? 'ring-1 ring-black dark:ring-white' : ''}`}
      >
        <ThemeIcon src={sunIcon} />
      </button>
      <button
        type="button"
        onClick={() => setTheme('dark')}
        aria-label="Dark mode"
        aria-pressed={theme === 'dark'}
        title="Dark mode"
        className={`${btnClass} ${theme === 'dark' ? 'ring-1 ring-black dark:ring-white' : ''}`}
      >
        <ThemeIcon src={moonIcon} />
      </button>
    </div>
  )
}
