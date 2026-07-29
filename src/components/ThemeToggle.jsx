import { useTheme } from '../context/ThemeContext'
import sunIcon from '../assets/icons/sun.png'
import moonIcon from '../assets/icons/moon.png'

function ThemeIcon({ src, active }) {
  return (
    <span
      aria-hidden
      className={`frens-mask-icon w-4 h-4 shrink-0 transition-opacity ${active ? 'opacity-100' : 'opacity-30'}`}
      style={{
        maskImage: `url(${src})`,
        WebkitMaskImage: `url(${src})`,
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
        className={btnClass}
      >
        <ThemeIcon src={sunIcon} active={theme === 'light'} />
      </button>
      <button
        type="button"
        onClick={() => setTheme('dark')}
        aria-label="Dark mode"
        aria-pressed={theme === 'dark'}
        title="Dark mode"
        className={btnClass}
      >
        <ThemeIcon src={moonIcon} active={theme === 'dark'} />
      </button>
    </div>
  )
}
