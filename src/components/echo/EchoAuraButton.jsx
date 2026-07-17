import { useEffect, useState } from 'react'
import AuraIcon, { AURA_COLORS, AURA_IDLE } from '../AuraIcon'
import { toggleEchoAura } from '../../lib/echoes'

/** Give or remove aura on a discovered echo — same UX as feed posts. */
export default function EchoAuraButton({
  echoId,
  auraCount = 0,
  iGaveAura = false,
  useRemote = true,
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
  }, [iGaveAura, auraCount, echoId])

  if (!echoId) return null

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
      if (useRemote) {
        const result = await toggleEchoAura(echoId)
        setDisplayGave(result.iGaveAura)
        setDisplayCount(result.auraCount)
        onAuraChange?.(echoId, result)
      } else {
        onAuraChange?.(echoId, {
          auraCount: Math.max(0, prevCount + (prevGave ? -1 : 1)),
          iGaveAura: !prevGave,
        })
      }
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
      className={`relative z-10 flex items-center gap-1.5 text-xs frens-action transition cursor-pointer touch-manipulation min-h-[36px] px-1 -mx-1 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-60 ${
        displayGave ? 'font-medium text-black dark:text-white' : 'frens-muted'
      } ${className}`}
    >
      <AuraIcon color={iconColor} animate={animating} active={displayGave} />
      <span className="pointer-events-none">Aura {displayCount}</span>
    </button>
  )
}

export function EchoAuraCount({ count = 0, className = '', compact = false }) {
  return (
    <span
      className={`flex items-center gap-1 ${
        compact ? 'text-[10px] text-white/90 font-medium' : 'frens-muted text-xs gap-1.5'
      } ${className}`}
    >
      <AuraIcon color={count > 0 ? AURA_COLORS[0] : AURA_IDLE} />
      <span>{compact ? count : `Aura ${count}`}</span>
    </span>
  )
}
