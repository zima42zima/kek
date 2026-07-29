import ThemeToggle from './ThemeToggle'

export default function ThemeControls({ className = '' }) {
  return (
    <div className={`flex items-center shrink-0 ${className}`}>
      <ThemeToggle />
    </div>
  )
}
