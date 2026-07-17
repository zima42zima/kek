import { useEffect, useState } from 'react'
import { usePosts } from '../context/PostsContext'
import AuraIcon, { AURA_COLORS, AURA_IDLE } from './AuraIcon'

/** Give or remove aura on any feed post, anywhere in the app. */
export default function AuraButton({ postId, auraCount = 0, iGaveAura = false, className = '' }) {
  const { giveAura } = usePosts()
  const [colorIndex, setColorIndex] = useState(0)
  const [animating, setAnimating] = useState(false)
  const [flashColor, setFlashColor] = useState(null)
  const [displayGave, setDisplayGave] = useState(iGaveAura)
  const [displayCount, setDisplayCount] = useState(auraCount)

  useEffect(() => {
    setDisplayGave(iGaveAura)
    setDisplayCount(auraCount)
  }, [iGaveAura, auraCount, postId])

  if (!postId) return null

  const savedColor = AURA_COLORS[colorIndex % AURA_COLORS.length]
  const iconColor = animating && flashColor
    ? flashColor
    : displayGave
      ? savedColor
      : AURA_IDLE

  function handleClick(e) {
    e.preventDefault()
    e.stopPropagation()

    const next = (colorIndex + 1) % AURA_COLORS.length
    const color = AURA_COLORS[next]
    setColorIndex(next)
    setFlashColor(color)
    setAnimating(true)
    setDisplayGave((gave) => !gave)
    setDisplayCount((count) => Math.max(0, count + (displayGave ? -1 : 1)))

    window.setTimeout(() => {
      setAnimating(false)
      setFlashColor(null)
    }, 380)

    giveAura(postId)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={displayGave}
      title={displayGave ? 'Remove aura' : 'Give aura'}
      className={`relative z-10 flex items-center gap-1.5 text-xs frens-action transition cursor-pointer touch-manipulation min-h-[36px] px-1 -mx-1 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] ${
        displayGave ? 'font-medium text-black dark:text-white' : 'frens-muted'
      } ${className}`}
    >
      <AuraIcon color={iconColor} animate={animating} active={displayGave} />
      <span className="pointer-events-none">Aura {displayCount}</span>
    </button>
  )
}

/** Read-only aura count with icon (own posts). */
export function AuraCount({ count = 0, className = '' }) {
  return (
    <span className={`flex items-center gap-1.5 frens-muted text-xs ${className}`}>
      <AuraIcon color={count > 0 ? AURA_COLORS[0] : AURA_IDLE} />
      <span>Aura {count}</span>
    </span>
  )
}
