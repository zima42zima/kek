import { useEffect, useState } from 'react'
import AuraIcon, { AURA_COLORS, AURA_IDLE } from '../AuraIcon'
import { toggleTrackAura } from '../../lib/playlists'

export default function PlaylistTrackAuraButton({
  trackId,
  auraCount = 0,
  iGaveAura = false,
  onAuraChange,
  className = '',
}) {
  const [colorIndex, setColorIndex] = useState(0)
  const [animating, setAnimating] = useState(false)
  const [flashColor, setFlashColor] = useState(null)
  const [displayGave, setDisplayGave] = useState(iGaveAura)
  const [displayCount, setDisplayCount] = useState(auraCount)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    setDisplayGave(iGaveAura)
    setDisplayCount(auraCount)
  }, [iGaveAura, auraCount, trackId])

  if (!trackId) return null

  const savedColor = AURA_COLORS[colorIndex % AURA_COLORS.length]
  const iconColor = animating && flashColor
    ? flashColor
    : displayGave
      ? savedColor
      : AURA_IDLE

  async function handleClick(e) {
    e.preventDefault()
    e.stopPropagation()
    if (pending) return

    const prevGave = displayGave
    const prevCount = displayCount
    const next = (colorIndex + 1) % AURA_COLORS.length
    const color = AURA_COLORS[next]
    setColorIndex(next)
    setFlashColor(color)
    setAnimating(true)
    setDisplayGave(!prevGave)
    setDisplayCount(Math.max(0, prevCount + (prevGave ? -1 : 1)))

    window.setTimeout(() => {
      setAnimating(false)
      setFlashColor(null)
    }, 380)

    setPending(true)
    try {
      const result = await toggleTrackAura(trackId)
      setDisplayGave(result.iGaveAura)
      setDisplayCount(result.auraCount)
      onAuraChange?.(trackId, result)
    } catch {
      setDisplayGave(prevGave)
      setDisplayCount(prevCount)
    } finally {
      setPending(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-pressed={displayGave}
      title={displayGave ? 'Remove aura' : 'Give aura'}
      className={`flex items-center gap-1 text-[11px] frens-action shrink-0 px-1.5 py-1 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-60 ${
        displayGave ? 'font-medium text-black dark:text-white' : 'frens-muted'
      } ${className}`}
    >
      <AuraIcon color={iconColor} animate={animating} active={displayGave} className="w-3.5 h-3.5" />
      <span>{displayCount}</span>
    </button>
  )
}
