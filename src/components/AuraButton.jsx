import { useEffect, useState } from 'react'
import { usePosts } from '../context/PostsContext'
import AuraIcon, { AURA_COLORS, AURA_IDLE } from './AuraIcon'
import { POST_ACTION_BTN, POST_ACTION_ICON, POST_ACTION_BADGE } from './icons/UiIcons'
import PostActionTip from './PostActionTip'

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
    <PostActionTip label="aura">
      <button
        type="button"
        onClick={handleClick}
        aria-pressed={displayGave}
        aria-label={displayGave ? 'Remove aura' : 'Give aura'}
        className={`${POST_ACTION_BTN} ${
          displayGave ? 'ring-1 ring-black/15 dark:ring-white/25' : 'frens-muted'
        } ${className}`}
      >
        <AuraIcon color={iconColor} animate={animating} active={displayGave} className={POST_ACTION_ICON} />
        {displayCount > 0 ? (
          <span className={POST_ACTION_BADGE}>
            {displayCount}
          </span>
        ) : null}
      </button>
    </PostActionTip>
  )
}

/** Read-only aura count with icon (own posts). */
export function AuraCount({ count = 0, className = '' }) {
  return (
    <PostActionTip label="aura">
      <span className={`relative ${POST_ACTION_BTN} frens-muted pointer-events-none ${className}`}>
        <AuraIcon color={count > 0 ? AURA_COLORS[0] : AURA_IDLE} className={POST_ACTION_ICON} />
        {count > 0 ? (
          <span className={POST_ACTION_BADGE}>
            {count}
          </span>
        ) : null}
      </span>
    </PostActionTip>
  )
}
