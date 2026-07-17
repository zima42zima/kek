import auraIcon from '../assets/icons/aura.png'

export const AURA_COLORS = [
  '#6BC06B',
  '#e0703a',
  '#f59e0b',
  '#a78bfa',
  '#38bdf8',
  '#f472b6',
  '#34d399',
  '#fb7185',
]

export const AURA_IDLE = '#94a3b8'

/** Masked aura glyph — visible in light + dark mode, tinted any color. */
export default function AuraIcon({
  color = AURA_IDLE,
  className = 'w-4 h-4',
  animate = false,
  active = false,
}) {
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 pointer-events-none aura-glyph ${animate ? 'aura-glyph-pop' : ''} ${className}`}
      style={{
        width: '1rem',
        height: '1rem',
        backgroundColor: color,
        WebkitMaskImage: `url(${auraIcon})`,
        maskImage: `url(${auraIcon})`,
        filter: active && !animate ? `drop-shadow(0 0 4px ${color})` : undefined,
      }}
    />
  )
}
